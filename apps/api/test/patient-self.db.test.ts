import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { type PrismaTransaction } from '../src/database/prisma-transaction';
import { PrismaClient } from '../src/generated/prisma/client';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { ensureOtherTenant, nextTestDocument, TEST_DOCUMENT_PREFIX } from './enrollment-fixtures';
import { crearCuentaHumana } from './identity-relationships-fixtures';

/**
 * Aislamiento de la superficie self-scope del Paciente verificado contra
 * PostgreSQL REAL (spec 021, paquete 3: T5.7 a T5.13).
 *
 * COMPRUEBA LAS GARANTÍAS QUE SOLO PUEDE DAR LA BASE DE DATOS. No repite lo que
 * `patient-self.api.test.ts` verifica en el borde HTTP ni lo que
 * `src/patient-self/patient-self.service.test.ts` verifica en el dominio: aquí
 * se demuestra que, aunque la aplicación fallara, PostgreSQL sigue negando la
 * fila ajena.
 *
 * LAS DOS BARRERAS, POR SEPARADO (T5.8). El servicio aplica Row Level Security
 * Y ADEMÁS un filtro explícito por `tenantId`. Esta suite demuestra cada una
 * por su cuenta:
 *
 *   - RLS SOLA: una consulta SIN ningún filtro de tenant, ejecutada bajo el rol
 *     de mínimo privilegio con el tenant A fijado, no observa NINGUNA fila del
 *     tenant B. La aplicación no interviene.
 *   - FILTRO SOLO: una consulta con el filtro explícito apuntando a otro tenant
 *     no devuelve nada, con independencia de lo que RLS permitiera.
 *
 * ROL NO PROPIETARIO, SIN SUPERUSUARIO Y SIN BYPASSRLS. Toda evidencia POSITIVA
 * de aislamiento se produce bajo `merdn_runtime`, que no es dueño de ninguna
 * tabla. El propietario se usa EXCLUSIVAMENTE para sembrar y limpiar datos
 * ficticios, jamás como prueba de que el aislamiento funciona: para el dueño de
 * una tabla sin `FORCE ROW LEVEL SECURITY` la política ni siquiera se evalúa, de
 * modo que una lectura suya no probaría nada.
 *
 * NINGUNA PRUEBA DESACTIVA RLS, relaja una política, cambia un `GRANT` ni toca
 * el esquema. Si alguna necesitara hacerlo, la garantía no existiría.
 *
 * TODOS los datos son FICTICIOS y usan el prefijo documental reservado de la
 * suite. `audit_event` es append-only y NO se borra NUNCA.
 */

const ROL_RUNTIME = 'merdn_runtime';

/**
 * Correlaciones que escribe ESTA ejecución, y solo esta.
 *
 * `audit_event` es APPEND-ONLY: los eventos de ejecuciones anteriores —de esta
 * misma suite incluida— siguen ahí y no se borran. Un prefijo constante no
 * bastaría para distinguirlos, porque toda ejecución previa lo compartiría, y
 * sus cuentas ficticias ya fueron retiradas. Por eso cada evento se marca con
 * una correlación ÚNICA generada al vuelo y registrada aquí: el barrido puede
 * así razonar sobre lo que ACABA de escribir sin borrar absolutamente nada.
 */
const correlacionesPropias = new Set<string>();

/** Correlación opaca, única y registrada como propia de esta ejecución. */
function nuevaCorrelacion(): string {
  const correlationId = randomUUID();
  correlacionesPropias.add(correlationId);

  return correlationId;
}

/** Tablas cuya política de aislamiento sostiene esta superficie. */
const TABLAS_PROTEGIDAS = [
  'patient',
  'person',
  'appointment',
  'home_visit',
  'audit_event',
] as const;

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/**
 * Conexión de EJECUCIÓN separada, cuando el entorno la aporta.
 *
 * Si existe, la evidencia se produce sobre una sesión que INICIÓ SESIÓN como
 * `merdn_runtime`, sin `SET ROLE` de por medio: es la forma más difícil de
 * discutir. Si no existe, se adopta el rol dentro de la transacción, que es lo
 * que hace la aplicación en producción y lo que ya usan las demás pruebas de
 * base de datos de la suite. En AMBOS casos `current_user` se comprueba dentro
 * de la propia transacción antes de leer nada.
 */
const runtimeUrl = process.env['RUNTIME_DATABASE_URL'];
const hayConexionRuntime = runtimeUrl !== undefined && runtimeUrl.trim().length > 0;

describe.skipIf(!puedeEjecutarse)('Aislamiento self-scope del Paciente en PostgreSQL', () => {
  /** Cliente PROPIETARIO. Solo siembra y limpia. Nunca prueba aislamiento. */
  let owner: PrismaClient;
  /** Cliente de EJECUCIÓN, cuando hay credencial separada. */
  let runtime: PrismaClient | null = null;

  let tenantA: string;
  let tenantB: string;

  interface PacienteFicticio {
    readonly personId: string;
    readonly patientId: string;
    /**
     * Identificador OPACO de la CUENTA HUMANA autenticable de esta persona.
     *
     * Es el ÚNICO valor admisible como `actorUserId` de un evento
     * `PATIENT_SELF_ACCESS_*`: el contrato exige `actorType = HUMAN_ACCOUNT` y,
     * con él, `HumanAccount.id`. `Person.id` identifica a la PERSONA, no a la
     * cuenta que se autenticó, y usarlo atribuiría el acceso a una entidad que
     * no es la que la sesión resolvió.
     */
    readonly humanAccountId: string;
    /** Vínculo OIDC exacto con el que fue creada la sesión humana. */
    readonly externalAuthIdentityId: string;
    readonly documentNumber: string;
    readonly appointmentFuturo: string;
    readonly appointmentPasado: string;
    readonly homeVisitId: string;
  }

  /** Dos pacientes ficticios DISTINTOS del MISMO tenant. */
  let pacienteA1: PacienteFicticio;
  let pacienteA2: PacienteFicticio;
  /** Paciente ficticio del OTRO tenant. */
  let pacienteB1: PacienteFicticio;
  /** Persona ficticia SIN participación de paciente. */
  let personaSinPaciente: string;

  const sembrado = {
    visitas: new Set<string>(),
    citas: new Set<string>(),
    asignaciones: new Set<string>(),
    pacientes: new Set<string>(),
    profesionales: new Set<string>(),
    cuentas: new Set<string>(),
    personas: new Set<string>(),
    identidades: new Set<string>(),
  };

  const ahora = new Date();
  const futuro = new Date(ahora.getTime() + 3 * 60 * 60 * 1000);
  const pasado = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);

  beforeAll(async () => {
    owner = createTestPrismaClient();

    if (hayConexionRuntime) {
      runtime = new PrismaClient({
        adapter: new PrismaPg({ connectionString: runtimeUrl }),
        log: ['warn', 'error'],
      });
    }

    const tenant = await owner.tenant.findUnique({
      where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
      select: { id: true },
    });

    if (tenant === null) {
      throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
    }

    tenantA = tenant.id;
    tenantB = await ensureOtherTenant(owner);

    pacienteA1 = await sembrarPaciente(tenantA, 'Ana María');
    pacienteA2 = await sembrarPaciente(tenantA, 'Beatriz Elena');
    pacienteB1 = await sembrarPaciente(tenantB, 'Diana Sofía');
    personaSinPaciente = await sembrarPersona(tenantA, 'Carmen Lucía');
  });

  afterAll(async () => {
    if (owner !== undefined) {
      await retirarLoSembrado();
      await owner.$disconnect();
    }

    if (runtime !== null) {
      await runtime.$disconnect();
    }
  });

  /* ====================================================================== */
  /* Siembra y limpieza — SIEMPRE con el propietario, nunca como evidencia   */
  /* ====================================================================== */

  async function sembrarPersona(tenantId: string, nombres: string): Promise<string> {
    const documento = nextTestDocument();

    const persona = await owner.person.create({
      data: {
        tenantId,
        documentType: 'CEDULA_CIUDADANIA',
        documentNumber: documento,
        documentNumberNormalized: documento,
        givenNames: nombres,
        familyNames: 'Ejemplo Ficticio',
        birthDate: new Date(Date.UTC(1960, 5, 15)),
        sexGenderCode: 'PREFIERE_NO_DECIRLO',
      },
      select: { id: true },
    });

    sembrado.personas.add(persona.id);
    return persona.id;
  }

  async function identidadFicticia(tenantId: string): Promise<string> {
    const codigo = 'patient-self-db-identidad-ficticia';

    const existente = await owner.institutionalIdentity.findFirst({
      where: { tenantId, code: codigo },
      select: { id: true },
    });

    if (existente !== null) {
      sembrado.identidades.add(existente.id);
      return existente.id;
    }

    const creada = await owner.institutionalIdentity.create({
      data: {
        tenantId,
        code: codigo,
        role: 'HOSPITAL_SCHEDULER',
        status: 'ACTIVE',
        // Derivación ALEATORIA: nadie puede autenticarse con esta identidad.
        accessSecretHash: 'f'.repeat(128),
        accessSecretSalt: 'a'.repeat(32),
      },
      select: { id: true },
    });

    sembrado.identidades.add(creada.id);
    return creada.id;
  }

  async function sembrarPaciente(
    tenantId: string,
    nombres: string,
  ): Promise<PacienteFicticio> {
    const personId = await sembrarPersona(tenantId, nombres);
    const documento = await owner.person.findUniqueOrThrow({
      where: { id: personId },
      select: { documentNumber: true },
    });

    const patient = await owner.patient.create({
      data: {
        tenantId,
        personId,
        epsCode: 'NUEVA_EPS',
        epsNameControlled: 'Nueva EPS',
        origin: 'PUBLIC_SELF_ENROLLMENT',
      },
      select: { id: true },
    });

    /*
     * CUENTA HUMANA autenticable de esta misma persona, sembrada con la fixture
     * COMPARTIDA: es exactamente lo que persistiría el aprovisionamiento
     * administrativo, con su vínculo de identidad externa ficticio. No existe
     * autorregistro y esta suite no lo inventa.
     *
     * Su identificador es OPACO: no es un nombre, ni un documento, ni el
     * `subject` del proveedor OIDC, y es DISTINTO de `Person.id`.
     */
    const cuenta = await crearCuentaHumana(owner, { tenantId, personId });
    sembrado.cuentas.add(cuenta.humanAccountId);

    sembrado.pacientes.add(patient.id);

    const identityId = await identidadFicticia(tenantId);
    const profesionalPersonId = await sembrarPersona(tenantId, 'Profesional');

    const perfil = await owner.professionalProfile.create({
      data: {
        tenantId,
        personId: profesionalPersonId,
        professionCode: 'MEDICINA_GENERAL',
        professionNameControlled: 'Medicina general',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    sembrado.profesionales.add(perfil.id);

    const asignacion = await owner.careAssignment.create({
      data: {
        tenantId,
        patientId: patient.id,
        professionalId: perfil.id,
        role: 'PRIMARY',
        status: 'ACTIVE',
        startsAt: pasado,
        createdByIdentityId: identityId,
      },
      select: { id: true },
    });

    sembrado.asignaciones.add(asignacion.id);

    const citaFutura = await owner.appointment.create({
      data: {
        tenantId,
        patientId: patient.id,
        careAssignmentId: asignacion.id,
        modality: 'HOME',
        status: 'ASSIGNED',
        requestedAt: pasado,
        scheduledStart: futuro,
      },
      select: { id: true },
    });

    const citaPasada = await owner.appointment.create({
      data: {
        tenantId,
        patientId: patient.id,
        careAssignmentId: asignacion.id,
        modality: 'HOME',
        status: 'ASSIGNED',
        requestedAt: pasado,
        scheduledStart: pasado,
      },
      select: { id: true },
    });

    sembrado.citas.add(citaFutura.id);
    sembrado.citas.add(citaPasada.id);

    const visita = await owner.homeVisit.create({
      data: {
        tenantId,
        appointmentId: citaPasada.id,
        patientId: patient.id,
        careAssignmentId: asignacion.id,
        status: 'SCHEDULED',
        createdByInstitutionalIdentityId: identityId,
      },
      select: { id: true },
    });

    sembrado.visitas.add(visita.id);

    return {
      personId,
      patientId: patient.id,
      humanAccountId: cuenta.humanAccountId,
      externalAuthIdentityId: cuenta.bindingId,
      documentNumber: documento.documentNumber,
      appointmentFuturo: citaFutura.id,
      appointmentPasado: citaPasada.id,
      homeVisitId: visita.id,
    };
  }

  async function retirarLoSembrado(): Promise<void> {
    const ids = (conjunto: ReadonlySet<string>): string[] => [...conjunto];

    if (sembrado.visitas.size > 0) {
      await owner.homeVisitTransition.deleteMany({
        where: { homeVisitId: { in: ids(sembrado.visitas) } },
      });
      await owner.homeVisit.deleteMany({ where: { id: { in: ids(sembrado.visitas) } } });
    }

    if (sembrado.citas.size > 0) {
      await owner.appointment.deleteMany({ where: { id: { in: ids(sembrado.citas) } } });
    }

    if (sembrado.asignaciones.size > 0) {
      await owner.careAssignment.deleteMany({
        where: { id: { in: ids(sembrado.asignaciones) } },
      });
    }

    if (sembrado.pacientes.size > 0) {
      await owner.patient.deleteMany({ where: { id: { in: ids(sembrado.pacientes) } } });
    }

    if (sembrado.profesionales.size > 0) {
      await owner.professionalProfile.deleteMany({
        where: { id: { in: ids(sembrado.profesionales) } },
      });
    }

    if (sembrado.cuentas.size > 0) {
      // ORDEN OBLIGATORIO: las FK son `RESTRICT`, de modo que sesiones y
      // vínculos se van antes que su cuenta, y las cuentas antes que su persona.
      await owner.accessRequest.deleteMany({
        where: { humanAccountId: { in: ids(sembrado.cuentas) } },
      });
      await owner.humanSession.deleteMany({
        where: { humanAccountId: { in: ids(sembrado.cuentas) } },
      });
      await owner.externalAuthIdentity.deleteMany({
        where: { humanAccountId: { in: ids(sembrado.cuentas) } },
      });
      await owner.humanAccount.deleteMany({ where: { id: { in: ids(sembrado.cuentas) } } });
    }

    if (sembrado.personas.size > 0) {
      await owner.person.deleteMany({ where: { id: { in: ids(sembrado.personas) } } });
    }

    if (sembrado.identidades.size > 0) {
      await owner.institutionalIdentity.deleteMany({
        where: { id: { in: ids(sembrado.identidades) } },
      });
    }

    for (const conjunto of Object.values(sembrado)) {
      conjunto.clear();
    }
  }

  /* ====================================================================== */
  /* Contexto de ejecución de mínimo privilegio                              */
  /* ====================================================================== */

  /**
   * Ejecuta trabajo bajo el rol de EJECUCIÓN con el tenant indicado fijado, y
   * comprueba DENTRO de la transacción que el rol efectivo es realmente el de
   * mínimo privilegio. Sin esa comprobación, un fallo silencioso dejaría la
   * consulta corriendo con la credencial administrativa y la prueba pasaría sin
   * demostrar nada.
   *
   * `tenantId` puede ser `null` a propósito: es el caso de una sesión sin
   * contexto de tenant, que debe observar CERO filas.
   */
  async function comoRuntime<T>(
    tenantId: string | null,
    work: (tx: PrismaTransaction) => Promise<T>,
  ): Promise<T> {
    const cliente = runtime ?? owner;

    return cliente.$transaction(async (tx) => {
      if (runtime === null) {
        // Sin credencial separada se adopta el rol, igual que la aplicación.
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROL_RUNTIME}"`);
      }

      if (tenantId !== null) {
        await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${tenantId}, true)`;
      }

      const [contexto] = await tx.$queryRaw<
        { readonly rol: string; readonly rls: string }[]
      >`SELECT current_user::text AS rol, current_setting('row_security') AS rls`;

      if (contexto === undefined || contexto.rol !== ROL_RUNTIME) {
        throw new Error(
          `El contexto de la prueba NO corre como ${ROL_RUNTIME}: la evidencia no sería válida.`,
        );
      }

      if (contexto.rls !== 'on') {
        throw new Error(
          'Row Level Security no está activa en la sesión: la evidencia no sería válida.',
        );
      }

      return work(tx);
    });
  }

  describe('T5.13 / contexto — rol de mínimo privilegio y RLS realmente vigentes', () => {
    it('el rol de ejecución NO es superusuario y NO tiene BYPASSRLS', async () => {
      const [rol] = await owner.$queryRaw<
        {
          readonly rolsuper: boolean;
          readonly rolbypassrls: boolean;
          readonly rolcanlogin: boolean;
        }[]
      >`SELECT rolsuper, rolbypassrls, rolcanlogin
          FROM pg_roles WHERE rolname = ${ROL_RUNTIME}`;

      expect(rol).toBeDefined();
      expect(rol!.rolsuper).toBe(false);
      expect(rol!.rolbypassrls).toBe(false);
    });

    it('el rol de ejecución NO es propietario de ninguna tabla protegida', async () => {
      const propietarios = await owner.$queryRaw<
        { readonly tabla: string; readonly propietario: string }[]
      >`SELECT c.relname AS tabla, pg_get_userbyid(c.relowner) AS propietario
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'`;

      expect(propietarios.length).toBeGreaterThan(0);

      for (const fila of propietarios) {
        expect(fila.propietario).not.toBe(ROL_RUNTIME);
      }
    });

    it('las tablas de esta superficie tienen RLS habilitada y política para el rol', async () => {
      for (const tabla of TABLAS_PROTEGIDAS) {
        const [estado] = await owner.$queryRaw<{ readonly habilitada: boolean }[]>`
          SELECT c.relrowsecurity AS habilitada
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = ${tabla}
        `;

        expect(estado, `RLS no declarada en ${tabla}`).toBeDefined();
        expect(estado!.habilitada, `RLS deshabilitada en ${tabla}`).toBe(true);

        const politicas = await owner.$queryRaw<{ readonly policyname: string }[]>`
          SELECT policyname FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename = ${tabla}
             AND ${ROL_RUNTIME} = ANY (roles)
        `;

        expect(politicas.length, `sin política para ${ROL_RUNTIME} en ${tabla}`)
          .toBeGreaterThan(0);
      }
    });

    it('el contexto de la prueba corre efectivamente como el rol de ejecución', async () => {
      const rol = await comoRuntime(tenantA, async (tx) => {
        const [fila] = await tx.$queryRaw<{ readonly rol: string }[]>`
          SELECT current_user::text AS rol
        `;

        return fila?.rol ?? null;
      });

      expect(rol).toBe(ROL_RUNTIME);
    });

    /**
     * HALLAZGO DEL ENTORNO, REGISTRADO Y NO CORREGIDO AQUÍ.
     *
     * La base de este entorno tiene un VALOR POR DEFECTO de `merdn.tenant_id`
     * asociado al propio rol de ejecución (`pg_db_role_setting`). En
     * consecuencia, una sesión runtime que NO fijara el tenant no observa cero
     * filas: observa las del tenant configurado por defecto. Eso NO es una fuga
     * entre tenants —sigue sin verse ningún otro— pero SÍ debilita la defensa en
     * profundidad: un olvido de `withTenant()` degradaría a «tenant por
     * defecto» en lugar de fallar.
     *
     * Esta prueba REGISTRA el hecho tal como es; no lo afirma como garantía y no
     * lo corrige: cambiar una configuración de rol o de base excede el alcance
     * de este paquete y es una decisión de Codex y del Product Owner.
     *
     * Lo que SÍ se verifica aquí es lo que la superficie necesita: el contexto
     * explícito PREVALECE siempre sobre ese valor por defecto, de modo que
     * `withTenant()` —que además comprueba el tenant efectivo— nunca queda a
     * merced de él.
     */
    it('el contexto explícito PREVALECE sobre el valor por defecto del rol', async () => {
      const [porDefecto] = await owner.$queryRaw<{ readonly setconfig: string[] | null }[]>`
        SELECT s.setconfig
          FROM pg_db_role_setting s
          JOIN pg_roles r ON r.oid = s.setrole
         WHERE r.rolname = ${ROL_RUNTIME}
      `;

      const tenantPorDefecto = (porDefecto?.setconfig ?? [])
        .map((entrada) => /^merdn\.tenant_id=(.*)$/u.exec(entrada)?.[1] ?? null)
        .find((valor) => valor !== null);

      if (tenantPorDefecto !== undefined) {
        // Registro explícito: el entorno define un tenant por defecto y, por
        // tanto, una sesión sin contexto NO cae en cero filas.
        expect(tenantPorDefecto).not.toBe(tenantB);
      }

      // La garantía que la superficie sí necesita: fijar el tenant B en la
      // transacción manda sobre cualquier valor heredado.
      const visto = await comoRuntime(tenantB, async (tx) => ({
        propio: await tx.patient.count({ where: { id: pacienteB1.patientId } }),
        ajeno: await tx.patient.count({
          where: { id: { in: [pacienteA1.patientId, pacienteA2.patientId] } },
        }),
      }));

      expect(visto).toEqual({ propio: 1, ajeno: 0 });
    });
  });

  /* ====================================================================== */
  /* T5.7 y T5.9 — Aislamiento CROSS-TENANT                                  */
  /* ====================================================================== */

  describe('T5.7 / T5.9 — cross-tenant: cero fuga entre dos tenants ficticios', () => {
    it('los dos tenants ficticios son distintos y ambos tienen datos sembrados', () => {
      expect(tenantA).not.toBe(tenantB);
      expect(pacienteA1.patientId).not.toBe(pacienteB1.patientId);
      expect(pacienteA1.patientId).not.toBe(pacienteA2.patientId);
    });

    it('con el tenant A fijado, `appointment` no devuelve NINGUNA fila del tenant B', async () => {
      const filas = await comoRuntime(tenantA, async (tx) =>
        // Filtro EXPLÍCITO al tenant ajeno: si RLS no estuviera, esto devolvería
        // las citas de B. La política es lo único que lo impide.
        tx.$queryRaw<{ readonly id: string }[]>`
          SELECT id FROM appointment WHERE "tenantId" = ${tenantB}::uuid
        `,
      );

      expect(filas).toHaveLength(0);
    });

    it('con el tenant A fijado, `home_visit` no devuelve NINGUNA fila del tenant B', async () => {
      const filas = await comoRuntime(tenantA, async (tx) =>
        tx.$queryRaw<{ readonly id: string }[]>`
          SELECT id FROM home_visit WHERE "tenantId" = ${tenantB}::uuid
        `,
      );

      expect(filas).toHaveLength(0);
    });

    it('con el tenant A fijado, `patient` y `person` no devuelven filas del tenant B', async () => {
      const { pacientes, personas } = await comoRuntime(tenantA, async (tx) => ({
        pacientes: await tx.$queryRaw<{ readonly id: string }[]>`
          SELECT id FROM patient WHERE "tenantId" = ${tenantB}::uuid
        `,
        personas: await tx.$queryRaw<{ readonly id: string }[]>`
          SELECT id FROM person WHERE "tenantId" = ${tenantB}::uuid
        `,
      }));

      expect(pacientes).toHaveLength(0);
      expect(personas).toHaveLength(0);
    });

    it('el tenant B tampoco observa nada del tenant A: la negación es simétrica', async () => {
      const conteos = await comoRuntime(tenantB, async (tx) => ({
        citas: await tx.appointment.count({
          where: { id: { in: [pacienteA1.appointmentFuturo, pacienteA2.appointmentFuturo] } },
        }),
        visitas: await tx.homeVisit.count({
          where: { id: { in: [pacienteA1.homeVisitId, pacienteA2.homeVisitId] } },
        }),
        pacientes: await tx.patient.count({
          where: { id: { in: [pacienteA1.patientId, pacienteA2.patientId] } },
        }),
      }));

      expect(conteos).toEqual({ citas: 0, visitas: 0, pacientes: 0 });
    });

    it('ni por detalle, ni por orden, ni por paginación se filtra una fila ajena', async () => {
      const resultado = await comoRuntime(tenantB, async (tx) => ({
        // DETALLE: por identificador exacto y conocido.
        detalle: await tx.appointment.findUnique({
          where: { id: pacienteA1.appointmentFuturo },
          select: { id: true },
        }),
        // ORDEN: la fila ajena tampoco aparece al reordenar el conjunto.
        ordenado: await tx.appointment.findMany({
          orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
          select: { id: true, tenantId: true },
        }),
        // PAGINACIÓN: recorrer la lista completa no la descubre.
        paginado: await tx.appointment.findMany({
          skip: 0,
          take: 200,
          select: { id: true, tenantId: true },
        }),
      }));

      // Ausencia, no error: un error distinguible ya revelaría la existencia.
      expect(resultado.detalle).toBeNull();

      for (const fila of [...resultado.ordenado, ...resultado.paginado]) {
        expect(fila.tenantId).toBe(tenantB);
        expect(fila.id).not.toBe(pacienteA1.appointmentFuturo);
        expect(fila.id).not.toBe(pacienteA1.appointmentPasado);
      }
    });

    it('un tenant no puede ESCRIBIR una fila de otro: la política lo rechaza', async () => {
      // El único INSERT que esta superficie ejecuta es el de auditoría, y debe
      // caer dentro del tenant fijado. Intentarlo en el ajeno debe fallar.
      await expect(
        comoRuntime(tenantA, async (tx) => {
          await tx.auditEvent.create({
            data: {
              tenantId: tenantB,
              eventType: 'PATIENT_SELF_ACCESS_GRANTED',
              actorType: 'HUMAN_ACCOUNT',
              actorUserId: pacienteA1.humanAccountId,
              resourceType: 'PatientSelfSummary',
              outcome: 'SUCCESS',
              endpoint: '/api/v1/patient-self/summary',
              correlationId: nuevaCorrelacion(),
              occurredAt: ahora,
            },
            select: { id: true },
          });
        }),
      ).rejects.toThrow();
    });
  });

  /* ====================================================================== */
  /* T5.8 — Doble control: RLS y filtro explícito, cada uno por su cuenta    */
  /* ====================================================================== */

  describe('T5.8 — doble control: la aplicación filtra ADEMÁS de RLS', () => {
    it('BARRERA 1, RLS SOLA: sin ningún filtro de tenant, solo se ve el tenant fijado', async () => {
      const filas = await comoRuntime(tenantA, async (tx) =>
        // Deliberadamente SIN cláusula de tenant: si algo ajeno apareciera,
        // sería porque la política no está aplicándose.
        tx.$queryRaw<{ readonly tenantId: string }[]>`SELECT "tenantId" FROM appointment`,
      );

      expect(filas.length).toBeGreaterThan(0);

      for (const fila of filas) {
        expect(fila.tenantId).toBe(tenantA);
      }
    });

    it('BARRERA 2, FILTRO SOLO: el filtro explícito por tenant excluye por sí mismo', async () => {
      const filas = await comoRuntime(tenantA, async (tx) =>
        // Es la MISMA forma de consulta que usa el servicio: el filtro por
        // `tenantId` viaja siempre, aunque RLS ya lo garantizara.
        tx.appointment.findMany({
          where: { tenantId: tenantB, patientId: pacienteB1.patientId },
          select: { id: true },
        }),
      );

      expect(filas).toHaveLength(0);
    });

    it('la consulta REAL del servicio devuelve exclusivamente lo propio', async () => {
      const filas = await comoRuntime(tenantA, async (tx) =>
        tx.appointment.findMany({
          where: {
            tenantId: tenantA,
            patientId: pacienteA1.patientId,
            patient: {
              id: pacienteA1.patientId,
              tenantId: tenantA,
              personId: pacienteA1.personId,
              status: 'ACTIVE',
            },
            scheduledStart: { gte: ahora },
          },
          select: { id: true, patientId: true, tenantId: true },
          orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
          take: 20,
        }),
      );

      expect(filas).toHaveLength(1);
      expect(filas[0]!.id).toBe(pacienteA1.appointmentFuturo);
      expect(filas[0]!.tenantId).toBe(tenantA);
      expect(filas[0]!.patientId).toBe(pacienteA1.patientId);
    });
  });

  /* ====================================================================== */
  /* T5.10 — Cross-patient DENTRO del mismo tenant                           */
  /* ====================================================================== */

  describe('T5.10 — mismo tenant, dos pacientes: ninguno observa datos del otro', () => {
    it('las citas propias no incluyen ninguna del otro paciente', async () => {
      const filas = await comoRuntime(tenantA, async (tx) =>
        tx.appointment.findMany({
          where: {
            tenantId: tenantA,
            patientId: pacienteA1.patientId,
            patient: {
              id: pacienteA1.patientId,
              tenantId: tenantA,
              personId: pacienteA1.personId,
              status: 'ACTIVE',
            },
          },
          select: { id: true, patientId: true },
        }),
      );

      expect(filas.length).toBeGreaterThan(0);

      for (const fila of filas) {
        expect(fila.patientId).toBe(pacienteA1.patientId);
        expect(fila.id).not.toBe(pacienteA2.appointmentFuturo);
        expect(fila.id).not.toBe(pacienteA2.appointmentPasado);
      }
    });

    it('las visitas propias no incluyen ninguna del otro paciente', async () => {
      const filas = await comoRuntime(tenantA, async (tx) =>
        tx.homeVisit.findMany({
          where: {
            tenantId: tenantA,
            patientId: pacienteA1.patientId,
            patient: {
              id: pacienteA1.patientId,
              tenantId: tenantA,
              personId: pacienteA1.personId,
              status: 'ACTIVE',
            },
          },
          select: { id: true, patientId: true },
        }),
      );

      expect(filas).toHaveLength(1);
      expect(filas[0]!.id).toBe(pacienteA1.homeVisitId);
      expect(filas[0]!.id).not.toBe(pacienteA2.homeVisitId);
    });

    /**
     * IDOR EN LA CAPA DE DATOS. Es el intento exacto que la superficie HTTP no
     * permite ni expresar: dirigir el identificador de OTRO paciente
     * conservando la persona autenticada. La condición de self-scope exige que
     * `patient.id` y `patient.personId` correspondan a la MISMA fila, de modo
     * que la combinación cruzada no existe.
     */
    it('IDOR: el patientId ajeno con la persona propia no resuelve ninguna fila', async () => {
      const resultado = await comoRuntime(tenantA, async (tx) => ({
        paciente: await tx.patient.findFirst({
          where: {
            id: pacienteA2.patientId,
            tenantId: tenantA,
            // La persona autenticada sigue siendo la propia.
            personId: pacienteA1.personId,
            status: 'ACTIVE',
          },
          select: { id: true },
        }),
        citas: await tx.appointment.findMany({
          where: {
            tenantId: tenantA,
            patientId: pacienteA2.patientId,
            patient: {
              id: pacienteA2.patientId,
              tenantId: tenantA,
              personId: pacienteA1.personId,
              status: 'ACTIVE',
            },
          },
          select: { id: true },
        }),
        visitas: await tx.homeVisit.findMany({
          where: {
            tenantId: tenantA,
            patientId: pacienteA2.patientId,
            patient: {
              id: pacienteA2.patientId,
              tenantId: tenantA,
              personId: pacienteA1.personId,
              status: 'ACTIVE',
            },
          },
          select: { id: true },
        }),
      }));

      expect(resultado.paciente).toBeNull();
      expect(resultado.citas).toHaveLength(0);
      expect(resultado.visitas).toHaveLength(0);
    });

    it('el sujeto se deriva de la persona: cada persona resuelve SU propio paciente', async () => {
      const resuelto = await comoRuntime(tenantA, async (tx) => ({
        primero: await tx.patient.findFirst({
          where: { tenantId: tenantA, personId: pacienteA1.personId, status: 'ACTIVE' },
          select: { id: true },
        }),
        segundo: await tx.patient.findFirst({
          where: { tenantId: tenantA, personId: pacienteA2.personId, status: 'ACTIVE' },
          select: { id: true },
        }),
      }));

      expect(resuelto.primero?.id).toBe(pacienteA1.patientId);
      expect(resuelto.segundo?.id).toBe(pacienteA2.patientId);
      expect(resuelto.primero?.id).not.toBe(resuelto.segundo?.id);
    });
  });

  /* ====================================================================== */
  /* T5.11 — Sin participación de paciente: fail-closed                      */
  /* ====================================================================== */

  describe('T5.11 — sin participación de paciente ACTIVA: fail-closed', () => {
    /**
     * `PatientStatus` admite HOY un ÚNICO valor, `ACTIVE`. Un paciente «no
     * activo» NO es representable en el modelo aprobado, y esta suite no
     * inventa un estado que la spec no aprobó ni modifica el esquema para
     * poder probarlo. Se deja constancia explícita del hecho.
     */
    it('el catálogo de estados de paciente admite ÚNICAMENTE ACTIVE', async () => {
      const estados = await owner.$queryRaw<{ readonly enumlabel: string }[]>`
        SELECT e.enumlabel
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = 'PatientStatus'
         ORDER BY e.enumsortorder
      `;

      expect(estados.map((estado) => estado.enumlabel)).toEqual(['ACTIVE']);
    });

    it('una persona SIN participación de paciente no resuelve sujeto ni devuelve filas', async () => {
      const resultado = await comoRuntime(tenantA, async (tx) => ({
        paciente: await tx.patient.findFirst({
          where: { tenantId: tenantA, personId: personaSinPaciente, status: 'ACTIVE' },
          select: { id: true },
        }),
        citas: await tx.appointment.count({
          where: { tenantId: tenantA, patient: { personId: personaSinPaciente } },
        }),
        visitas: await tx.homeVisit.count({
          where: { tenantId: tenantA, patient: { personId: personaSinPaciente } },
        }),
      }));

      expect(resultado.paciente).toBeNull();
      expect(resultado.citas).toBe(0);
      expect(resultado.visitas).toBe(0);
    });

    it('la persona del tenant B no resuelve sujeto desde el contexto del tenant A', async () => {
      const resuelto = await comoRuntime(tenantA, async (tx) =>
        tx.patient.findFirst({
          where: { tenantId: tenantB, personId: pacienteB1.personId, status: 'ACTIVE' },
          select: { id: true },
        }),
      );

      expect(resuelto).toBeNull();
    });
  });

  /* ====================================================================== */
  /* Barrera de revocación — orden de bloqueos sin TOCTOU ni interbloqueo    */
  /* ====================================================================== */

  describe('autorización aprobada: barrera transaccional contra revocación', () => {
    it('FOR SHARE retiene la cuenta hasta terminar la lectura y serializa la revocación', async () => {
      const solicitud = await owner.accessRequest.create({
        data: {
          tenantId: tenantA,
          personId: pacienteA1.personId,
          requestedProfile: 'PATIENT',
          status: 'APPROVED',
          provisioningStatus: 'SUCCEEDED',
          source: 'TEST_DATA',
          reference: `AR-LOCK-${randomUUID()}`,
          humanAccountId: pacienteA1.humanAccountId,
          externalAuthIdentityId: pacienteA1.externalAuthIdentityId,
        },
        select: { id: true },
      });

      let anunciarLectura!: () => void;
      let liberarLectura!: () => void;
      let anunciarSolicitudBloqueada!: () => void;
      const lecturaLista = new Promise<void>((resolve) => {
        anunciarLectura = resolve;
      });
      const lecturaLiberada = new Promise<void>((resolve) => {
        liberarLectura = resolve;
      });
      const solicitudBloqueada = new Promise<void>((resolve) => {
        anunciarSolicitudBloqueada = resolve;
      });

      const lectura = owner.$transaction(async (tx) => {
        const cuentas = await tx.$queryRaw<{ readonly id: string }[]>`
          SELECT "id"
            FROM "human_account"
           WHERE "id" = ${pacienteA1.humanAccountId}::uuid
             AND "tenantId" = ${tenantA}::uuid
           FOR SHARE
        `;

        expect(cuentas).toHaveLength(1);
        anunciarLectura();
        await lecturaLiberada;
      });

      await lecturaLista;

      const revocacion = owner.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
            FROM "access_request"
           WHERE "id" = ${solicitud.id}::uuid
           FOR UPDATE
        `;
        anunciarSolicitudBloqueada();

        await tx.$queryRaw`
          SELECT "id"
            FROM "human_account"
           WHERE "id" = ${pacienteA1.humanAccountId}::uuid
           FOR UPDATE
        `;

        await tx.accessRequest.update({
          where: { id: solicitud.id },
          data: { status: 'REVOKED' },
        });
      });

      try {
        await solicitudBloqueada;

        const estadoTemprano = await Promise.race([
          revocacion.then(() => 'terminada' as const),
          new Promise<'bloqueada'>((resolve) => {
            setTimeout(() => resolve('bloqueada'), 150);
          }),
        ]);

        expect(estadoTemprano).toBe('bloqueada');
      } finally {
        liberarLectura();
      }

      await Promise.all([lectura, revocacion]);

      await expect(
        owner.accessRequest.findUniqueOrThrow({
          where: { id: solicitud.id },
          select: { status: true },
        }),
      ).resolves.toEqual({ status: 'REVOKED' });
    }, 15_000);
  });

  /* ====================================================================== */
  /* Auditoría — tenant correcto, append-only, sin PII                       */
  /* ====================================================================== */

  describe('auditoría: queda en el tenant correcto y no puede alterarse', () => {
    it('un evento escrito bajo el tenant A es invisible desde el tenant B', async () => {
      const correlationId = nuevaCorrelacion();

      const eventoId = await comoRuntime(tenantA, async (tx) => {
        const evento = await tx.auditEvent.create({
          data: {
            tenantId: tenantA,
            eventType: 'PATIENT_SELF_ACCESS_GRANTED',
            actorType: 'HUMAN_ACCOUNT',
            actorUserId: pacienteA1.humanAccountId,
            actorRole: null,
            resourceType: 'PatientSelfSummary',
            resourceId: null,
            outcome: 'SUCCESS',
            endpoint: '/api/v1/patient-self/summary',
            correlationId,
            occurredAt: ahora,
          },
          select: { id: true },
        });

        return evento.id;
      });

      const visibleEnA = await comoRuntime(tenantA, async (tx) =>
        tx.auditEvent.findFirst({
          where: { id: eventoId },
          select: { tenantId: true, actorType: true, actorUserId: true },
        }),
      );

      const visibleEnB = await comoRuntime(tenantB, async (tx) =>
        tx.auditEvent.findFirst({ where: { id: eventoId }, select: { id: true } }),
      );

      expect(visibleEnA?.tenantId).toBe(tenantA);
      expect(visibleEnA?.actorType).toBe('HUMAN_ACCOUNT');
      expect(visibleEnA?.actorUserId).toBe(pacienteA1.humanAccountId);
      expect(visibleEnB).toBeNull();
    });

    it('el evento no lleva rol, ni recurso, ni PII, y su endpoint es la ruta lógica', async () => {
      const correlationId = nuevaCorrelacion();

      await comoRuntime(tenantA, async (tx) => {
        await tx.auditEvent.create({
          data: {
            tenantId: tenantA,
            eventType: 'PATIENT_SELF_ACCESS_DENIED',
            actorType: 'HUMAN_ACCOUNT',
            actorUserId: pacienteA1.humanAccountId,
            actorRole: null,
            resourceType: 'PatientSelfVisits',
            resourceId: null,
            outcome: 'DENIED',
            endpoint: '/api/v1/patient-self/visits',
            correlationId,
            occurredAt: ahora,
          },
          select: { id: true },
        });
      });

      const evento = await comoRuntime(tenantA, async (tx) =>
        tx.auditEvent.findFirst({ where: { tenantId: tenantA, correlationId } }),
      );

      expect(evento).not.toBeNull();
      expect(evento!.actorType).toBe('HUMAN_ACCOUNT');
      expect(evento!.actorUserId).toBe(pacienteA1.humanAccountId);
      expect(evento!.actorRole).toBeNull();
      expect(evento!.resourceId).toBeNull();
      expect(evento!.outcome).toBe('DENIED');
      expect(evento!.endpoint).toBe('/api/v1/patient-self/visits');

      const serializado = JSON.stringify(evento);

      for (const valor of [
        pacienteA1.documentNumber,
        pacienteA1.patientId,
        pacienteA1.personId,
        'Ana María',
        'Ejemplo Ficticio',
        'NUEVA_EPS',
      ]) {
        expect(serializado).not.toContain(valor);
      }
    });

    /**
     * ATRIBUCIÓN DEL ACTOR. Es la corrección exigida por la auditoría de Codex
     * sobre MP3: `actorType = HUMAN_ACCOUNT` obliga a que `actorUserId` sea
     * `HumanAccount.id` y NADA MÁS.
     *
     * No basta con que el valor «parezca» un identificador: `Person.id`,
     * `Patient.id`, el documento, el `subject` del proveedor y el tenant son
     * todos UUID o cadenas plausibles, y cualquiera de ellos colocado ahí
     * produciría una traza que atribuye el acceso a una entidad que no se
     * autenticó. Por eso se comprueba la identidad EXACTA contra la cuenta y la
     * DESIGUALDAD frente a cada uno de los sustitutos prohibidos.
     */
    it('el actor es la CUENTA HUMANA y nunca la persona, el paciente ni otro sustituto', async () => {
      const correlationId = nuevaCorrelacion();

      await comoRuntime(tenantA, async (tx) => {
        await tx.auditEvent.create({
          data: {
            tenantId: tenantA,
            eventType: 'PATIENT_SELF_ACCESS_GRANTED',
            actorType: 'HUMAN_ACCOUNT',
            actorUserId: pacienteA1.humanAccountId,
            actorRole: null,
            resourceType: 'PatientSelfAppointments',
            resourceId: null,
            outcome: 'SUCCESS',
            endpoint: '/api/v1/patient-self/appointments',
            correlationId,
            occurredAt: ahora,
          },
          select: { id: true },
        });
      });

      const evento = await comoRuntime(tenantA, async (tx) =>
        tx.auditEvent.findFirst({ where: { tenantId: tenantA, correlationId } }),
      );

      expect(evento).not.toBeNull();
      expect(evento!.actorType).toBe('HUMAN_ACCOUNT');

      // IGUALDAD: el actor es EXACTAMENTE la cuenta humana sembrada...
      expect(evento!.actorUserId).toBe(pacienteA1.humanAccountId);

      // ...y esa cuenta existe de verdad, vinculada a ESTA persona y tenant.
      const cuenta = await owner.humanAccount.findUnique({
        where: { id: pacienteA1.humanAccountId },
        select: { id: true, personId: true, tenantId: true, status: true },
      });

      expect(cuenta).not.toBeNull();
      expect(cuenta!.personId).toBe(pacienteA1.personId);
      expect(cuenta!.tenantId).toBe(tenantA);
      expect(cuenta!.status).toBe('ACTIVE');

      // DESIGUALDAD: ninguno de los sustitutos prohibidos ocupa el lugar del
      // actor. `Person.id` el primero, que es el defecto que Codex detectó.
      expect(evento!.actorUserId).not.toBe(pacienteA1.personId);
      expect(evento!.actorUserId).not.toBe(pacienteA1.patientId);
      expect(evento!.actorUserId).not.toBe(pacienteA1.documentNumber);
      expect(evento!.actorUserId).not.toBe(tenantA);
      expect(evento!.actorUserId).not.toBe(tenantB);

      // El identificador es OPACO: no arrastra nombre, documento ni subject.
      const serializado = JSON.stringify(evento);

      for (const valor of [
        pacienteA1.personId,
        pacienteA1.patientId,
        pacienteA1.documentNumber,
        'sujeto-ficticio-de-pruebas',
      ]) {
        expect(serializado).not.toContain(valor);
      }
    });

    it('NINGÚN evento de esta familia queda atribuido a un Person.id', async () => {
      /*
       * Barrido sobre TODOS los eventos self-scope del tenant, no solo sobre
       * los que esta prueba escribió: si cualquier camino —de esta suite o de
       * la API— hubiera atribuido un acceso a una persona en vez de a una
       * cuenta, aquí se vería. Es la comprobación que habría cazado el defecto
       * corregido en esta iteración.
       *
       * LA COMPROBACIÓN ES DE NO PERTENENCIA A `person`, y NO de pertenencia a
       * `human_account`. La razón es que `audit_event` es APPEND-ONLY mientras
       * que las cuentas ficticias de las pruebas SÍ se retiran al terminar: un
       * evento cuyo actor ya no existe como cuenta es el comportamiento
       * correcto de una traza histórica, no un defecto. Exigir que todo actor
       * histórico siga existiendo convertiría la propia conservación de la
       * auditoría en un fallo.
       *
       * Este barrido solo es CONCLUYENTE sobre una base limpia: sobre una base
       * reutilizada, un actor defectuoso cuya persona ya fue borrada pasaría
       * inadvertido. Por eso la evidencia se repite sobre base aislada.
       */
      const eventos = await comoRuntime(tenantA, async (tx) =>
        tx.auditEvent.findMany({
          where: {
            tenantId: tenantA,
            eventType: {
              in: ['PATIENT_SELF_ACCESS_GRANTED', 'PATIENT_SELF_ACCESS_DENIED'],
            },
          },
          select: { actorType: true, actorUserId: true, correlationId: true },
        }),
      );

      expect(eventos.length).toBeGreaterThan(0);

      for (const evento of eventos) {
        expect(evento.actorType).toBe('HUMAN_ACCOUNT');
        expect(evento.actorUserId).not.toBeNull();
      }

      const actores = [
        ...new Set(
          eventos
            .map((evento) => evento.actorUserId)
            .filter((actor): actor is string => actor !== null),
        ),
      ];

      expect(actores.length).toBeGreaterThan(0);

      // NINGÚN actor es una persona existente.
      const personas = await owner.person.findMany({
        where: { id: { in: actores } },
        select: { id: true },
      });

      expect(personas).toEqual([]);

      // Y ninguno es, en concreto, una de las personas que esta suite sembró:
      // esa es la sustitución exacta que la auditoría de Codex rechazó.
      for (const personId of [
        pacienteA1.personId,
        pacienteA2.personId,
        pacienteB1.personId,
        personaSinPaciente,
      ]) {
        expect(actores).not.toContain(personId);
      }

      // Los eventos que ESTA suite escribió sí deben resolver a una cuenta
      // humana viva: aquí no cabe la excusa de la traza histórica.
      const propios = eventos.filter(
        (evento) =>
          evento.correlationId !== null && correlacionesPropias.has(evento.correlationId),
      );

      expect(propios.length).toBeGreaterThan(0);

      const actoresPropios = [
        ...new Set(
          propios
            .map((evento) => evento.actorUserId)
            .filter((actor): actor is string => actor !== null),
        ),
      ];

      const cuentas = await owner.humanAccount.findMany({
        where: { id: { in: actoresPropios } },
        select: { id: true },
      });

      expect(cuentas.map((cuenta) => cuenta.id).sort()).toEqual(
        [...actoresPropios].sort(),
      );
      expect(actoresPropios).toEqual([pacienteA1.humanAccountId]);
    });

    it('el rol de ejecución NO puede actualizar ni borrar auditoría', async () => {
      const [privilegios] = await owner.$queryRaw<
        {
          readonly leer: boolean;
          readonly insertar: boolean;
          readonly actualizar: boolean;
          readonly borrar: boolean;
        }[]
      >`SELECT has_table_privilege(${ROL_RUNTIME}, 'audit_event', 'SELECT') AS leer,
                has_table_privilege(${ROL_RUNTIME}, 'audit_event', 'INSERT') AS insertar,
                has_table_privilege(${ROL_RUNTIME}, 'audit_event', 'UPDATE') AS actualizar,
                has_table_privilege(${ROL_RUNTIME}, 'audit_event', 'DELETE') AS borrar`;

      expect(privilegios).toBeDefined();
      expect(privilegios!.leer).toBe(true);
      expect(privilegios!.insertar).toBe(true);
      expect(privilegios!.actualizar).toBe(false);
      expect(privilegios!.borrar).toBe(false);
    });

    it('el rol de ejecución NO puede borrar citas, visitas ni pacientes', async () => {
      for (const tabla of ['appointment', 'home_visit', 'patient', 'person']) {
        const [privilegio] = await owner.$queryRaw<{ readonly borrar: boolean }[]>`
          SELECT has_table_privilege(${ROL_RUNTIME}, ${tabla}, 'DELETE') AS borrar
        `;

        expect(privilegio!.borrar, `${tabla} admite DELETE para ${ROL_RUNTIME}`).toBe(false);
      }
    });
  });

  /* ====================================================================== */
  /* T5.13 — Datos ficticios y RLS intacta al terminar                       */
  /* ====================================================================== */

  describe('T5.13 — datos ficticios y garantías intactas', () => {
    it('todas las personas sembradas usan el prefijo documental reservado', async () => {
      const personas = await owner.person.findMany({
        where: { id: { in: [...sembrado.personas] } },
        select: { documentNumberNormalized: true },
      });

      expect(personas.length).toBeGreaterThan(0);

      for (const persona of personas) {
        expect(persona.documentNumberNormalized.startsWith(TEST_DOCUMENT_PREFIX)).toBe(true);
      }
    });

    it('ninguna prueba dejó RLS desactivada en las tablas protegidas', async () => {
      for (const tabla of TABLAS_PROTEGIDAS) {
        const [estado] = await owner.$queryRaw<{ readonly habilitada: boolean }[]>`
          SELECT c.relrowsecurity AS habilitada
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = ${tabla}
        `;

        expect(estado!.habilitada, `RLS quedó desactivada en ${tabla}`).toBe(true);
      }
    });
  });
});
