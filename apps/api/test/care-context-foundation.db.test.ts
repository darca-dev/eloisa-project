import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { CareContextAuditService } from '../src/care-context/care-context-audit.service';
import { CareContextDirectoryService } from '../src/care-context/care-context-directory.service';
import {
  CareContextAccessDeniedError,
  type CareContextPermission,
  CareContextUnavailableError,
} from '../src/care-context/care-context.contract';
import { CareContextPolicy } from '../src/care-context/care-context.policy';
import { CareContextService } from '../src/care-context/care-context.service';
import { lockContextForWrite } from '../src/care-context/care-mutation';
import { type PrismaTransaction } from '../src/database/prisma-transaction';
import { PrismaService } from '../src/database/prisma.service';
import { type PrismaClient } from '../src/generated/prisma/client';
import { type HumanPrincipal } from '../src/identity-access/human-principal';
import { IdentityAccessService } from '../src/identity-access/identity-access.service';

import {
  CareSeed,
  type CuentaFicticia,
  entornoEnforce,
  principalDe,
} from './care-context-fixtures';
import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { ensureOtherTenant } from './enrollment-fixtures';

/**
 * Custodia institucional de cuidado verificada contra PostgreSQL REAL
 * (SPEC 055 / MP01, P02–P06).
 *
 * Toda evidencia POSITIVA de aislamiento y autorización se produce bajo
 * `merdn_runtime` —sin propiedad, sin superusuario y sin BYPASSRLS— a través del
 * `CareContextService` real en modo `enforce`, o de una transacción que adopta
 * ese rol y lo comprueba. El cliente propietario solo siembra, revoca y limpia;
 * nunca demuestra aislamiento.
 *
 * Ninguna prueba desactiva RLS, relaja una política, cambia un GRANT ni toca el
 * esquema. Todos los datos son FICTICIOS. `audit_event` es append-only y no se
 * borra: cada evento propio se identifica por una correlación única.
 *
 * La concurrencia se sincroniza con barreras explícitas y con el estado de
 * espera de PostgreSQL (`pg_stat_activity.wait_event_type = 'Lock'`) del
 * backend que revoca; ningún desenlace se infiere de una espera fija.
 */

const ROL_RUNTIME = 'merdn_runtime';

const TABLAS_NUEVAS = [
  'care_authorization',
  'clinical_competence_attestation',
  'organization',
  'organization_care_manager',
  'patient_care_context',
] as const;

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

function correlacion(): string {
  return `mp01-${randomUUID()}`;
}

describe.skipIf(!puedeEjecutarse)('Custodia institucional de cuidado en PostgreSQL (055/MP01)', () => {
  let owner: PrismaClient;
  let prismaService: PrismaService;
  let service: CareContextService;
  let seed: CareSeed;

  let tenantA: string;
  let tenantC: string;

  /** Cuenta que nombra managers. No es manager ni recibe concesiones. */
  let fundador: CuentaFicticia;
  /** Manager de las organizaciones del tenant A. No tiene concesiones. */
  let gestor: CuentaFicticia;

  let orgHospital: string;
  let orgHospital2: string;
  let orgMunicipio: string;
  let orgTenantC: string;

  beforeAll(async () => {
    owner = createTestPrismaClient();
    seed = new CareSeed(owner);

    prismaService = new PrismaService(entornoEnforce());
    await prismaService.$connect();
    service = construirServicio(new CareContextAuditService());

    const tenant = await owner.tenant.findUnique({
      where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
      select: { id: true },
    });

    if (tenant === null) {
      throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
    }

    tenantA = tenant.id;
    tenantC = await ensureOtherTenant(owner);

    fundador = await seed.cuenta(tenantA, 'Fundadora');
    gestor = await seed.cuenta(tenantA, 'Gestora');

    orgHospital = await seed.organizacion(tenantA, 'HOSPITAL');
    orgHospital2 = await seed.organizacion(tenantA, 'HOSPITAL');
    orgMunicipio = await seed.organizacion(tenantA, 'MUNICIPALITY');
    orgTenantC = await seed.organizacion(tenantC, 'HOSPITAL');

    for (const org of [orgHospital, orgHospital2, orgMunicipio]) {
      await seed.manager(tenantA, org, gestor.humanAccountId, fundador.humanAccountId);
    }
  });

  afterAll(async () => {
    if (seed !== undefined) {
      await seed.retirar();
    }

    await prismaService?.$disconnect();
    await owner?.$disconnect();
  });

  function construirServicio(audit: CareContextAuditService): CareContextService {
    const environment = entornoEnforce();
    const policy = new CareContextPolicy(new IdentityAccessService(prismaService), { idleSeconds: 3600 });

    return new CareContextService(prismaService, environment, policy, audit);
  }

  /** Igual, con el directorio de contextos propios que exige una asignación. */
  function construirServicioConDirectorio(): CareContextService {
    const identity = new IdentityAccessService(prismaService);
    const policy = new CareContextPolicy(identity, { idleSeconds: 3600 });

    return new CareContextService(
      prismaService,
      entornoEnforce(),
      policy,
      new CareContextAuditService(),
      new CareContextDirectoryService(identity, policy),
    );
  }

  /** Transacción bajo el rol runtime con tenant y, opcionalmente, organización. */
  async function comoRuntime<T>(
    tenantId: string,
    organizationId: string | null,
    work: (tx: PrismaTransaction) => Promise<T>,
  ): Promise<T> {
    return owner.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROL_RUNTIME}"`);
      await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${tenantId}, true)`;

      if (organizationId !== null) {
        await tx.$executeRaw`SELECT set_config('merdn.organization_id', ${organizationId}, true)`;
      }

      const [contexto] = await tx.$queryRaw<{ readonly rol: string; readonly rls: string }[]>`
        SELECT current_user::text AS rol, current_setting('row_security') AS rls`;

      if (contexto?.rol !== ROL_RUNTIME || contexto.rls !== 'on') {
        throw new Error('La evidencia no corre como merdn_runtime con RLS activa.');
      }

      return work(tx);
    });
  }

  /** Paciente ficticio con cuenta aprobada y contextos en las tres organizaciones del tenant A. */
  async function escenarioPaciente(): Promise<{
    readonly paciente: CuentaFicticia;
    readonly patientId: string;
    readonly ctxHospital: string;
    readonly ctxHospital2: string;
    readonly ctxMunicipio: string;
  }> {
    const paciente = await seed.cuenta(tenantA, 'Paciente');
    await seed.aprobar(paciente, 'PATIENT');
    const patientId = await seed.paciente(paciente);

    return {
      paciente,
      patientId,
      ctxHospital: await seed.contexto(tenantA, orgHospital, patientId, gestor.humanAccountId),
      ctxHospital2: await seed.contexto(tenantA, orgHospital2, patientId, gestor.humanAccountId),
      ctxMunicipio: await seed.contexto(tenantA, orgMunicipio, patientId, gestor.humanAccountId),
    };
  }

  async function profesionalAsignado(patientId: string): Promise<{
    readonly cuenta: CuentaFicticia;
    readonly assignmentId: string;
    readonly competenceId: string;
  }> {
    const cuenta = await seed.cuenta(tenantA, 'Profesional');
    await seed.aprobar(cuenta, 'FIELD_PROFESSIONAL');
    const professionalId = await seed.profesional(cuenta);

    return {
      cuenta,
      assignmentId: await seed.asignacion(tenantA, patientId, professionalId),
      competenceId: await seed.competencia(tenantA, orgHospital, cuenta.humanAccountId, gestor.humanAccountId),
    };
  }

  async function decide(
    principal: HumanPrincipal,
    organizationId: string,
    contextId: string,
    permission: CareContextPermission,
    options: { readonly correlationId?: string; readonly now?: Date } = {},
  ): Promise<'granted' | 'denied'> {
    try {
      await service.withAuthorizedContext(
        principal,
        { organizationId, contextId },
        permission,
        options.correlationId ?? correlacion(),
        options.now ?? new Date(),
        async () => 'ok',
      );
      return 'granted';
    } catch (error) {
      if (error instanceof CareContextAccessDeniedError) {
        return 'denied';
      }

      throw error;
    }
  }

  /* ====================================================================== */
  /* P02 — migración aditiva, RLS/FORCE, propiedad y privilegios             */
  /* ====================================================================== */

  describe('P02 — catálogo de la migración', () => {
    it('las cinco tablas tienen RLS y FORCE, y ninguna pertenece al rol runtime', async () => {
      const filas = await owner.$queryRaw<
        { readonly relname: string; readonly rls: boolean; readonly force: boolean; readonly owner: string }[]
      >`
        SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS force, r.rolname AS owner
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_roles r ON r.oid = c.relowner
         WHERE n.nspname = 'public' AND c.relname = ANY (${[...TABLAS_NUEVAS]}::text[])
         ORDER BY c.relname`;

      expect(filas.map((fila) => fila.relname)).toEqual([...TABLAS_NUEVAS]);

      for (const fila of filas) {
        expect(fila.rls, fila.relname).toBe(true);
        expect(fila.force, fila.relname).toBe(true);
        expect(fila.owner, fila.relname).not.toBe(ROL_RUNTIME);
      }
    });

    it('las políticas nuevas aplican al runtime y la de auditoría es RESTRICTIVE', async () => {
      const politicas = await owner.$queryRaw<
        { readonly policyname: string; readonly tablename: string; readonly permissive: string }[]
      >`
        SELECT policyname, tablename, permissive
          FROM pg_policies
         WHERE schemaname = 'public'
           AND ${ROL_RUNTIME} = ANY (roles)
           AND policyname IN ('organization_scope', 'organization_care_manager_scope',
                              'patient_care_context_scope', 'clinical_competence_attestation_scope',
                              'care_authorization_scope', 'audit_event_organization_scope')
         ORDER BY policyname`;

      expect(politicas).toHaveLength(6);
      expect(politicas.find((fila) => fila.policyname === 'audit_event_organization_scope')).toMatchObject({
        tablename: 'audit_event',
        permissive: 'RESTRICTIVE',
      });
    });

    /*
     * MP01 solo concedía lectura. MP05b (decisión del PO «Pantalla del gestor»)
     * añade INSERT donde escribe el gestor —contexto, concesión, competencia— y
     * UPDATE de las columnas de revocación. Organización y gestor siguen sin
     * INSERT en el runtime (los crea la provisión controlada) y ninguna tabla
     * admite DELETE ni UPDATE completo.
     */
    it('el runtime no borra ni actualiza filas completas; inserta solo donde administra el gestor', async () => {
      const insertables = new Set(['patient_care_context', 'care_authorization', 'clinical_competence_attestation']);

      for (const tabla of TABLAS_NUEVAS) {
        const [privilegios] = await owner.$queryRaw<
          { readonly leer: boolean; readonly insertar: boolean; readonly borrar: boolean; readonly actualizar: boolean }[]
        >`SELECT has_table_privilege(${ROL_RUNTIME}, ${tabla}, 'SELECT') AS leer,
                 has_table_privilege(${ROL_RUNTIME}, ${tabla}, 'INSERT') AS insertar,
                 has_table_privilege(${ROL_RUNTIME}, ${tabla}, 'DELETE') AS borrar,
                 has_table_privilege(${ROL_RUNTIME}, ${tabla}, 'UPDATE') AS actualizar`;

        expect(privilegios, tabla).toEqual({ leer: true, insertar: insertables.has(tabla), borrar: false, actualizar: false });
      }

      const columnas = await owner.$queryRaw<{ readonly table_name: string; readonly column_name: string }[]>`
        SELECT table_name, column_name
          FROM information_schema.column_privileges
         WHERE grantee = ${ROL_RUNTIME}
           AND privilege_type = 'UPDATE'
           AND table_name IN ('organization', 'organization_care_manager', 'patient_care_context',
                              'clinical_competence_attestation', 'care_authorization',
                              'care_assignment', 'professional_profile', 'professional_affiliation')
         ORDER BY table_name, column_name`;

      expect(columnas.map((fila) => `${fila.table_name}.${fila.column_name}`)).toEqual([
        'care_assignment.updatedAt',
        'care_authorization.revokedAt',
        'care_authorization.status',
        'care_authorization.version',
        'clinical_competence_attestation.revokedAt',
        'clinical_competence_attestation.status',
        'clinical_competence_attestation.version',
        'organization.updatedAt',
        'organization_care_manager.version',
        'patient_care_context.version',
        'professional_affiliation.updatedAt',
        'professional_profile.updatedAt',
      ]);
    });

    it('las filas históricas de auditoría no llevan organización y otras familias no pueden llevarla', async () => {
      const [historicas] = await owner.$queryRaw<{ readonly total: bigint }[]>`
        SELECT count(*) AS total
          FROM "audit_event"
         WHERE "organizationId" IS NOT NULL
           AND "eventType"::text NOT LIKE 'CARE\\_%' ESCAPE '\\'`;

      expect(Number(historicas?.total)).toBe(0);

      await expect(
        owner.auditEvent.create({
          data: {
            tenantId: tenantA,
            organizationId: orgHospital,
            eventType: 'EXPERIENCE_ACCESS_DENIED',
            actorType: 'HUMAN_ACCOUNT',
            actorUserId: gestor.humanAccountId,
            resourceType: 'CareContext',
            outcome: 'DENIED',
            correlationId: correlacion(),
          },
        }),
      ).rejects.toThrow();

      await expect(
        owner.auditEvent.create({
          data: {
            tenantId: tenantA,
            organizationId: null,
            eventType: 'CARE_CONTEXT_ACCESS_DENIED',
            actorType: 'HUMAN_ACCOUNT',
            actorUserId: gestor.humanAccountId,
            resourceType: 'CareContext',
            outcome: 'DENIED',
            correlationId: correlacion(),
          },
        }),
      ).rejects.toThrow();
    });

    it('la procedencia es inmutable y la revocación es terminal, también para el propietario', async () => {
      const { patientId, ctxHospital2 } = await escenarioPaciente();

      // Un segundo contexto de la misma organización y paciente no cabe.
      await expect(seed.contexto(tenantA, orgHospital2, patientId, gestor.humanAccountId)).rejects.toThrow();

      const ctx = { id: ctxHospital2 };

      await expect(
        owner.patientCareContext.update({ where: { id: ctx.id }, data: { patientId: randomUUID() } }),
      ).rejects.toThrow();

      await owner.patientCareContext.update({
        where: { id: ctx.id },
        data: { status: 'REVOKED', revokedAt: new Date(), version: { increment: 1 } },
      });

      await expect(
        owner.patientCareContext.update({ where: { id: ctx.id }, data: { status: 'ACTIVE', revokedAt: null } }),
      ).rejects.toThrow();
    });
  });

  /* ====================================================================== */
  /* P03 — aislamiento entre organizaciones del mismo tenant y entre tenants */
  /* ====================================================================== */

  describe('P03 — aislamiento institucional y de tenant', () => {
    it('con la organización A fijada no se ve el contexto de la organización B ni de otro tenant', async () => {
      const { patientId, ctxHospital, ctxHospital2 } = await escenarioPaciente();
      const pacienteC = await seed.cuenta(tenantC, 'Paciente C');
      const patientC = await seed.paciente(pacienteC);
      const gestorC = await seed.cuenta(tenantC, 'Gestora C');
      const ctxC = await seed.contexto(tenantC, orgTenantC, patientC, gestorC.humanAccountId);

      const visibles = await comoRuntime(tenantA, orgHospital, async (tx) =>
        tx.patientCareContext.findMany({ select: { id: true, organizationId: true } }),
      );
      const ids = visibles.map((fila) => fila.id);

      expect(ids).toContain(ctxHospital);
      expect(ids).not.toContain(ctxHospital2);
      expect(ids).not.toContain(ctxC);
      expect(new Set(visibles.map((fila) => fila.organizationId))).toEqual(new Set([orgHospital]));

      const organizaciones = await comoRuntime(tenantA, orgHospital, async (tx) =>
        tx.organization.findMany({ select: { id: true } }),
      );
      expect(organizaciones).toEqual([{ id: orgHospital }]);

      // Fijar en el GUC la organización de OTRO tenant no la vuelve visible.
      const cruzada = await comoRuntime(tenantA, orgTenantC, async (tx) =>
        tx.patientCareContext.findMany({ where: { patientId: { in: [patientId, patientC] } }, select: { id: true } }),
      );
      expect(cruzada).toEqual([]);
    });

    it('sin organización fijada no se lee ninguna fila nueva; un GUC mal formado falla cerrado', async () => {
      await escenarioPaciente();

      const sinAmbito = await comoRuntime(tenantA, null, async (tx) => ({
        organizaciones: await tx.organization.count(),
        contextos: await tx.patientCareContext.count(),
        concesiones: await tx.careAuthorization.count(),
        managers: await tx.organizationCareManager.count(),
        competencias: await tx.clinicalCompetenceAttestation.count(),
      }));

      expect(sinAmbito).toEqual({ organizaciones: 0, contextos: 0, concesiones: 0, managers: 0, competencias: 0 });

      await expect(
        comoRuntime(tenantA, 'no-es-un-uuid', async (tx) => tx.patientCareContext.count()),
      ).rejects.toThrow();
    });

    it('el runtime no puede insertar ni cambiar estado aunque apunte a su propia organización', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();

      await expect(
        comoRuntime(tenantA, orgHospital, async (tx) =>
          tx.$executeRaw`
            INSERT INTO "care_authorization"
              ("id","tenantId","organizationId","contextId","patientId","humanAccountId","actorKind",
               "permission","purpose","startsAt","caregiverRelationshipId","authorizationReference","grantedByHumanAccountId")
            VALUES (gen_random_uuid(), ${tenantA}::uuid, ${orgHospital}::uuid, ${ctxHospital}::uuid, ${patientId}::uuid,
                    ${gestor.humanAccountId}::uuid, 'CAREGIVER', 'VIEW_RECORDS', 'CARE_RECORDING_AND_ALERTS', now(),
                    gen_random_uuid(), 'PRUEBAS.INTRUSA', ${gestor.humanAccountId}::uuid)`,
        ),
      ).rejects.toThrow();

      await expect(
        comoRuntime(tenantA, orgHospital, async (tx) =>
          tx.$executeRaw`UPDATE "patient_care_context" SET "status" = 'REVOKED', "revokedAt" = now() WHERE "id" = ${ctxHospital}::uuid`,
        ),
      ).rejects.toThrow();
    });

    it('las FK compuestas impiden asociar contexto, organización, paciente o competencia cruzados', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();
      const profesional = await profesionalAsignado(patientId);
      const otro = await seed.cuenta(tenantA, 'Otra cuenta');
      const competenciaAjena = await seed.competencia(tenantA, orgHospital, otro.humanAccountId, gestor.humanAccountId);
      const pacienteC = await seed.cuenta(tenantC, 'Paciente C');
      const patientC = await seed.paciente(pacienteC);

      const base = {
        tenantId: tenantA,
        organizationId: orgHospital,
        contextId: ctxHospital,
        patientId,
        humanAccountId: profesional.cuenta.humanAccountId,
        actorKind: 'PROFESSIONAL' as const,
        permission: 'MANAGE_RULES' as const,
        careAssignmentId: profesional.assignmentId,
        competenceAttestationId: profesional.competenceId,
        grantedByHumanAccountId: gestor.humanAccountId,
      };

      await expect(seed.concesion({ ...base, organizationId: orgHospital2 })).rejects.toThrow();
      await expect(seed.concesion({ ...base, patientId: patientC })).rejects.toThrow();
      await expect(seed.concesion({ ...base, competenceAttestationId: competenciaAjena })).rejects.toThrow();
      await expect(
        seed.contexto(tenantA, orgTenantC, patientId, gestor.humanAccountId),
      ).rejects.toThrow();

      // Emisor que NO es manager vigente de la organización: la base lo rechaza.
      await expect(seed.concesion({ ...base, grantedByHumanAccountId: otro.humanAccountId })).rejects.toThrow();
      // La asignación de otro paciente o de otra persona tampoco se puede citar.
      await expect(
        seed.concesion({ ...base, humanAccountId: otro.humanAccountId, competenceAttestationId: competenciaAjena }),
      ).rejects.toThrow();

      await expect(seed.concesion(base)).resolves.toEqual(expect.any(String));
    });

    it('la auditoría con organización solo se ve bajo esa organización; las filas nulas siguen visibles', async () => {
      const { paciente, ctxHospital } = await escenarioPaciente();
      const correlationId = correlacion();
      const correlacionHistorica = correlacion();

      // Fila de otra familia, sin organización, como las históricas. Se siembra
      // aquí: una base recién provisionada puede no tener ninguna todavía.
      await owner.auditEvent.create({
        data: {
          tenantId: tenantA,
          eventType: 'EXPERIENCE_ACCESS_DENIED',
          actorType: 'HUMAN_ACCOUNT',
          actorUserId: paciente.humanAccountId,
          resourceType: 'HumanAccount',
          resourceId: paciente.humanAccountId,
          outcome: 'DENIED',
          correlationId: correlacionHistorica,
        },
      });

      await decide(principalDe(paciente), orgHospital, ctxHospital, 'VIEW_RECORDS', { correlationId });

      const enA = await comoRuntime(tenantA, orgHospital, async (tx) =>
        tx.auditEvent.findMany({ where: { correlationId }, select: { organizationId: true } }),
      );
      const enB = await comoRuntime(tenantA, orgHospital2, async (tx) =>
        tx.auditEvent.findMany({ where: { correlationId }, select: { id: true } }),
      );
      const sinAmbito = await comoRuntime(tenantA, null, async (tx) =>
        tx.auditEvent.findMany({ where: { correlationId }, select: { id: true } }),
      );
      const historicaVisible = await comoRuntime(tenantA, orgHospital2, async (tx) =>
        tx.auditEvent.count({ where: { correlationId: correlacionHistorica, organizationId: null } }),
      );
      const historicaSinAmbito = await comoRuntime(tenantA, null, async (tx) =>
        tx.auditEvent.count({ where: { correlationId: correlacionHistorica } }),
      );

      expect(enA).toEqual([{ organizationId: orgHospital }]);
      expect(enB).toEqual([]);
      expect(sinAmbito).toEqual([]);
      expect(historicaVisible).toBe(1);
      expect(historicaSinAmbito).toBe(1);
    });

    it('una transacción posterior del pool no hereda la organización fijada', async () => {
      const { paciente, ctxHospital } = await escenarioPaciente();

      for (let vuelta = 0; vuelta < 5; vuelta += 1) {
        expect(await decide(principalDe(paciente), orgHospital, ctxHospital, 'VIEW_RECORDS')).toBe('granted');

        const heredado = await prismaService.withTenant(tenantA, async (tx) => {
          const [fila] = await tx.$queryRaw<{ readonly org: string | null }[]>`
            SELECT nullif(current_setting('merdn.organization_id', true), '') AS org`;
          return { org: fila?.org ?? null, contextos: await tx.patientCareContext.count() };
        });

        expect(heredado).toEqual({ org: null, contextos: 0 });
      }
    });
  });

  /* ====================================================================== */
  /* P04 — política: positivos y negativos por actor                         */
  /* ====================================================================== */

  describe('P04 — política de autorización', () => {
    it('paciente propio: ver/aportar/pedir sí; reglas y revisión no; organización municipal nunca', async () => {
      const { paciente, ctxHospital, ctxMunicipio } = await escenarioPaciente();
      const principal = principalDe(paciente);

      expect(await decide(principal, orgHospital, ctxHospital, 'VIEW_RECORDS')).toBe('granted');
      expect(await decide(principal, orgHospital, ctxHospital, 'CONTRIBUTE_RECORDS')).toBe('granted');
      expect(await decide(principal, orgHospital, ctxHospital, 'REQUEST_ALARM')).toBe('granted');
      expect(await decide(principal, orgHospital, ctxHospital, 'MANAGE_RULES')).toBe('denied');
      expect(await decide(principal, orgHospital, ctxHospital, 'REVIEW_ALARMS')).toBe('denied');
      expect(await decide(principal, orgMunicipio, ctxMunicipio, 'VIEW_RECORDS')).toBe('denied');
    });

    it('paciente de otro contexto, contexto de otra organización y organización ajena deniegan', async () => {
      const uno = await escenarioPaciente();
      const otro = await escenarioPaciente();
      const principal = principalDe(uno.paciente);

      expect(await decide(principal, orgHospital, otro.ctxHospital, 'VIEW_RECORDS')).toBe('denied');
      expect(await decide(principal, orgHospital2, uno.ctxHospital, 'VIEW_RECORDS')).toBe('denied');
      expect(await decide(principal, orgTenantC, uno.ctxHospital, 'VIEW_RECORDS')).toBe('denied');
    });

    it('cuidador: solo con concesión nueva; la relación con VISITS_VIEW sola deniega', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();
      const cuidadora = await seed.cuenta(tenantA, 'Cuidadora');
      await seed.aprobar(cuidadora, 'CAREGIVER');
      const relacion = await seed.relacion(tenantA, patientId, cuidadora.personId);
      const principal = principalDe(cuidadora);

      expect(await decide(principal, orgHospital, ctxHospital, 'CONTRIBUTE_RECORDS')).toBe('denied');

      await seed.concesion({
        tenantId: tenantA,
        organizationId: orgHospital,
        contextId: ctxHospital,
        patientId,
        humanAccountId: cuidadora.humanAccountId,
        actorKind: 'CAREGIVER',
        permission: 'CONTRIBUTE_RECORDS',
        caregiverRelationshipId: relacion,
        grantedByHumanAccountId: gestor.humanAccountId,
      });

      expect(await decide(principal, orgHospital, ctxHospital, 'CONTRIBUTE_RECORDS')).toBe('granted');
      expect(await decide(principal, orgHospital, ctxHospital, 'VIEW_RECORDS')).toBe('denied');

      // Revocar la relación antigua retira el vínculo que la concesión cita.
      const revocadora = await owner.patientCaregiverRelationship.findUniqueOrThrow({
        where: { id: relacion },
        select: { validatedByInstitutionalIdentityId: true },
      });
      await owner.patientCaregiverRelationship.update({
        where: { id: relacion },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedByInstitutionalIdentityId: revocadora.validatedByInstitutionalIdentityId,
          revocationReason: 'AUTHORIZATION_WITHDRAWN',
          version: { increment: 1 },
        },
      });

      expect(await decide(principal, orgHospital, ctxHospital, 'CONTRIBUTE_RECORDS')).toBe('denied');
    });

    it('profesional asignado: aportar sin competencia; reglas exigen competencia vigente', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();
      const profesional = await profesionalAsignado(patientId);
      const principal = principalDe(profesional.cuenta);
      const comun = {
        tenantId: tenantA,
        organizationId: orgHospital,
        contextId: ctxHospital,
        patientId,
        humanAccountId: profesional.cuenta.humanAccountId,
        actorKind: 'PROFESSIONAL' as const,
        careAssignmentId: profesional.assignmentId,
        grantedByHumanAccountId: gestor.humanAccountId,
      };

      // Perfil, afiliación, asignación y experiencia aprobada no bastan.
      expect(await decide(principal, orgHospital, ctxHospital, 'CONTRIBUTE_RECORDS')).toBe('denied');

      await seed.concesion({ ...comun, permission: 'CONTRIBUTE_RECORDS' });
      await seed.concesion({ ...comun, permission: 'MANAGE_RULES', competenceAttestationId: profesional.competenceId });

      expect(await decide(principal, orgHospital, ctxHospital, 'CONTRIBUTE_RECORDS')).toBe('granted');
      expect(await decide(principal, orgHospital, ctxHospital, 'MANAGE_RULES')).toBe('granted');

      await owner.clinicalCompetenceAttestation.update({
        where: { id: profesional.competenceId },
        data: { status: 'REVOKED', revokedAt: new Date(), version: { increment: 1 } },
      });

      expect(await decide(principal, orgHospital, ctxHospital, 'MANAGE_RULES')).toBe('denied');
      expect(await decide(principal, orgHospital, ctxHospital, 'CONTRIBUTE_RECORDS')).toBe('granted');
    });

    it('revisor humano: revisión con competencia; sin competencia vigente o sin concesión deniega', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();
      const revisor = await seed.cuenta(tenantA, 'Revisora');
      const vigente = await seed.competencia(tenantA, orgHospital, revisor.humanAccountId, gestor.humanAccountId);
      const principal = principalDe(revisor);

      expect(await decide(principal, orgHospital, ctxHospital, 'REVIEW_ALARMS')).toBe('denied');

      await seed.concesion({
        tenantId: tenantA,
        organizationId: orgHospital,
        contextId: ctxHospital,
        patientId,
        humanAccountId: revisor.humanAccountId,
        actorKind: 'HOSPITAL_REVIEWER',
        permission: 'REVIEW_ALARMS',
        competenceAttestationId: vigente,
        grantedByHumanAccountId: gestor.humanAccountId,
      });

      expect(await decide(principal, orgHospital, ctxHospital, 'REVIEW_ALARMS')).toBe('granted');
      expect(await decide(principal, orgHospital, ctxHospital, 'VIEW_RECORDS')).toBe('denied');

      const otroRevisor = await seed.cuenta(tenantA, 'Revisor vencido');
      const vencida = await seed.competencia(tenantA, orgHospital, otroRevisor.humanAccountId, gestor.humanAccountId, {
        startsAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60 * 1000),
      });
      await seed.concesion({
        tenantId: tenantA,
        organizationId: orgHospital,
        contextId: ctxHospital,
        patientId,
        humanAccountId: otroRevisor.humanAccountId,
        actorKind: 'HOSPITAL_REVIEWER',
        permission: 'REVIEW_ALARMS',
        competenceAttestationId: vencida,
        grantedByHumanAccountId: gestor.humanAccountId,
      });

      expect(await decide(principalDe(otroRevisor), orgHospital, ctxHospital, 'REVIEW_ALARMS')).toBe('denied');
    });

    it('el manager no obtiene acceso por su condición; un emisor que deja el cargo no anula lo emitido', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();

      expect(await decide(principalDe(gestor), orgHospital, ctxHospital, 'VIEW_RECORDS')).toBe('denied');

      const emisora = await seed.cuenta(tenantA, 'Emisora temporal');
      const managerId = await seed.manager(tenantA, orgHospital, emisora.humanAccountId, fundador.humanAccountId);
      const revisor = await seed.cuenta(tenantA, 'Revisora');
      const competencia = await seed.competencia(tenantA, orgHospital, revisor.humanAccountId, gestor.humanAccountId);
      await seed.concesion({
        tenantId: tenantA,
        organizationId: orgHospital,
        contextId: ctxHospital,
        patientId,
        humanAccountId: revisor.humanAccountId,
        actorKind: 'HOSPITAL_REVIEWER',
        permission: 'VIEW_RECORDS',
        competenceAttestationId: competencia,
        grantedByHumanAccountId: emisora.humanAccountId,
      });

      // Se intenta fechar la revocación en el pasado para anular lo emitido: la
      // base fija el instante y la fecha aportada no tiene efecto.
      await owner.organizationCareManager.update({
        where: { id: managerId },
        data: { status: 'REVOKED', revokedAt: new Date('2000-01-01T00:00:00.000Z'), version: { increment: 1 } },
      });

      const [instantes] = await owner.$queryRaw<{ readonly posterior: boolean }[]>`
        SELECT m."revokedAt" > a."createdAt" AS posterior
          FROM "organization_care_manager" m
          JOIN "care_authorization" a ON a."grantedByHumanAccountId" = m."humanAccountId"
         WHERE m."id" = ${managerId}::uuid`;
      expect(instantes?.posterior).toBe(true);

      expect(await decide(principalDe(revisor), orgHospital, ctxHospital, 'VIEW_RECORDS')).toBe('granted');
    });

    it('sesión revocada, sin vínculo exacto, cuenta deshabilitada o vínculo desvinculado deniegan', async () => {
      const casos: ((cuenta: CuentaFicticia) => Promise<HumanPrincipal>)[] = [
        async (cuenta) => {
          await owner.humanSession.update({ where: { id: cuenta.sessionId }, data: { revokedAt: new Date() } });
          return principalDe(cuenta);
        },
        async (cuenta) => ({ ...principalDe(cuenta), externalAuthIdentityId: undefined }),
        async (cuenta) => {
          await owner.humanAccount.update({ where: { id: cuenta.humanAccountId }, data: { status: 'DISABLED' } });
          return principalDe(cuenta);
        },
        async (cuenta) => {
          await owner.externalAuthIdentity.update({
            where: { id: cuenta.bindingId },
            data: { status: 'UNLINKED', unlinkedAt: new Date() },
          });
          return principalDe(cuenta);
        },
      ];

      for (const preparar of casos) {
        const { paciente, ctxHospital } = await escenarioPaciente();
        expect(await decide(principalDe(paciente), orgHospital, ctxHospital, 'VIEW_RECORDS')).toBe('granted');
        expect(await decide(await preparar(paciente), orgHospital, ctxHospital, 'VIEW_RECORDS')).toBe('denied');
      }
    });

    it('la concesión vence exactamente en su endsAt', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();
      const profesional = await profesionalAsignado(patientId);
      const fin = new Date(Date.now() + 10 * 60 * 1000);
      await seed.concesion({
        tenantId: tenantA,
        organizationId: orgHospital,
        contextId: ctxHospital,
        patientId,
        humanAccountId: profesional.cuenta.humanAccountId,
        actorKind: 'PROFESSIONAL',
        permission: 'REQUEST_ALARM',
        careAssignmentId: profesional.assignmentId,
        grantedByHumanAccountId: gestor.humanAccountId,
        endsAt: fin,
      });
      const principal = principalDe(profesional.cuenta);

      expect(
        await decide(principal, orgHospital, ctxHospital, 'REQUEST_ALARM', { now: new Date(fin.getTime() - 1) }),
      ).toBe('granted');
      expect(await decide(principal, orgHospital, ctxHospital, 'REQUEST_ALARM', { now: fin })).toBe('denied');
    });
  });

  /* ====================================================================== */
  /* P05 — revocación concurrente serializada contra la decisión             */
  /* ====================================================================== */

  describe('P05 — concurrencia con revocación', () => {
    it('una revocación concurrente ESPERA al trabajo autorizado; la petición siguiente se deniega', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();
      const profesional = await profesionalAsignado(patientId);
      const concesion = await seed.concesion({
        tenantId: tenantA,
        organizationId: orgHospital,
        contextId: ctxHospital,
        patientId,
        humanAccountId: profesional.cuenta.humanAccountId,
        actorKind: 'PROFESSIONAL',
        permission: 'CONTRIBUTE_RECORDS',
        careAssignmentId: profesional.assignmentId,
        grantedByHumanAccountId: gestor.humanAccountId,
      });
      const principal = principalDe(profesional.cuenta);

      let anunciarTrabajo!: () => void;
      let liberarTrabajo!: () => void;
      const trabajoEnCurso = new Promise<void>((resolve) => {
        anunciarTrabajo = resolve;
      });
      const trabajoLiberado = new Promise<void>((resolve) => {
        liberarTrabajo = resolve;
      });
      let anunciarPid!: (pid: number) => void;
      const pidRevocacion = new Promise<number>((resolve) => {
        anunciarPid = resolve;
      });
      const orden: string[] = [];

      const autorizado = service.withAuthorizedContext(
        principal,
        { organizationId: orgHospital, contextId: ctxHospital },
        'CONTRIBUTE_RECORDS',
        correlacion(),
        new Date(),
        async () => {
          anunciarTrabajo();
          await trabajoLiberado;
          orden.push('trabajo-terminado');
          return 'ok';
        },
      );

      await trabajoEnCurso;

      const revocacion = owner.$transaction(async (tx) => {
        const [fila] = await tx.$queryRaw<{ readonly pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        anunciarPid(fila?.pid ?? -1);
        await tx.$executeRaw`
          UPDATE "care_authorization"
             SET "status" = 'REVOKED', "revokedAt" = now(), "version" = "version" + 1
           WHERE "id" = ${concesion}::uuid`;
        orden.push('revocacion-aplicada');
      });

      try {
        const pid = await pidRevocacion;
        // Barrera: PostgreSQL informa que el backend que revoca espera un bloqueo.
        await esperarBloqueo(pid);
        expect(orden).toEqual([]);
      } finally {
        liberarTrabajo();
      }

      await expect(autorizado).resolves.toBe('ok');
      await revocacion;

      expect(orden).toEqual(['trabajo-terminado', 'revocacion-aplicada']);
      expect(await decide(principal, orgHospital, ctxHospital, 'CONTRIBUTE_RECORDS')).toBe('denied');
    }, 30_000);

    it('si la revocación gana antes, la decisión ya la ve y el trabajo no se ejecuta', async () => {
      const { paciente, ctxHospital } = await escenarioPaciente();
      const principal = principalDe(paciente);

      await owner.patientCareContext.update({
        where: { id: ctxHospital },
        data: { status: 'REVOKED', revokedAt: new Date(), version: { increment: 1 } },
      });

      let ejecutado = false;
      await expect(
        service.withAuthorizedContext(principal, { organizationId: orgHospital, contextId: ctxHospital }, 'VIEW_RECORDS', correlacion(), new Date(), async () => {
          ejecutado = true;
        }),
      ).rejects.toBeInstanceOf(CareContextAccessDeniedError);
      expect(ejecutado).toBe(false);
    });

    it('un cierre de sesión concurrente ESPERA al trabajo autorizado; la petición siguiente se deniega', async () => {
      const { paciente, ctxHospital } = await escenarioPaciente();
      const principal = principalDe(paciente);

      let anunciarTrabajo!: () => void;
      let liberarTrabajo!: () => void;
      const trabajoEnCurso = new Promise<void>((resolve) => {
        anunciarTrabajo = resolve;
      });
      const trabajoLiberado = new Promise<void>((resolve) => {
        liberarTrabajo = resolve;
      });
      let anunciarPid!: (pid: number) => void;
      const pidCierre = new Promise<number>((resolve) => {
        anunciarPid = resolve;
      });
      const orden: string[] = [];

      const autorizado = service.withAuthorizedContext(
        principal,
        { organizationId: orgHospital, contextId: ctxHospital },
        'VIEW_RECORDS',
        correlacion(),
        new Date(),
        async () => {
          anunciarTrabajo();
          await trabajoLiberado;
          orden.push('trabajo-terminado');
          return 'ok';
        },
      );

      await trabajoEnCurso;

      // Mismo efecto que `HumanAuthService.logout`: la fila se conserva y se revoca.
      const cierre = owner.$transaction(async (tx) => {
        const [fila] = await tx.$queryRaw<{ readonly pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        anunciarPid(fila?.pid ?? -1);
        await tx.$executeRaw`
          UPDATE "human_session" SET "revokedAt" = now() WHERE "id" = ${paciente.sessionId}::uuid`;
        orden.push('sesion-cerrada');
      });

      try {
        await esperarBloqueo(await pidCierre);
        expect(orden).toEqual([]);
      } finally {
        liberarTrabajo();
      }

      await expect(autorizado).resolves.toBe('ok');
      await cierre;

      expect(orden).toEqual(['trabajo-terminado', 'sesion-cerrada']);
      expect(await decide(principal, orgHospital, ctxHospital, 'VIEW_RECORDS')).toBe('denied');
    }, 30_000);

    it('si el cierre de sesión gana antes, la decisión ya lo ve y el trabajo no se ejecuta', async () => {
      const { paciente, ctxHospital } = await escenarioPaciente();

      await owner.humanSession.update({ where: { id: paciente.sessionId }, data: { revokedAt: new Date() } });

      let ejecutado = false;
      await expect(
        service.withAuthorizedContext(principalDe(paciente), { organizationId: orgHospital, contextId: ctxHospital }, 'VIEW_RECORDS', correlacion(), new Date(), async () => {
          ejecutado = true;
        }),
      ).rejects.toBeInstanceOf(CareContextAccessDeniedError);
      expect(ejecutado).toBe(false);
    });

    async function esperarBloqueo(pid: number): Promise<void> {
      const limite = Date.now() + 15_000;

      while (Date.now() < limite) {
        const [fila] = await owner.$queryRaw<{ readonly espera: string | null }[]>`
          SELECT wait_event_type AS espera FROM pg_stat_activity WHERE pid = ${pid}`;

        if (fila?.espera === 'Lock') {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      throw new Error('La revocación nunca quedó esperando el bloqueo de la decisión.');
    }
  });

  /* ====================================================================== */
  /* P06 — auditoría transaccional y sin datos clínicos                      */
  /* ====================================================================== */

  describe('P06 — auditoría', () => {
    it('la denegación persiste su evento aunque la operación se rechace; sin contexto ni datos clínicos', async () => {
      const { ctxHospital } = await escenarioPaciente();
      const ajena = await escenarioPaciente();
      const correlationId = correlacion();

      expect(
        await decide(principalDe(ajena.paciente), orgHospital, ctxHospital, 'VIEW_RECORDS', { correlationId }),
      ).toBe('denied');

      const eventos = await owner.auditEvent.findMany({ where: { correlationId } });

      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        eventType: 'CARE_CONTEXT_ACCESS_DENIED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: ajena.paciente.humanAccountId,
        actorRole: null,
        organizationId: orgHospital,
        resourceType: 'CareContext',
        resourceId: null,
        outcome: 'DENIED',
        supportReason: null,
      });
    });

    it('una organización no resoluble se audita con el evento genérico y sin FK ajena', async () => {
      const { paciente, ctxHospital } = await escenarioPaciente();

      for (const organizationId of [orgTenantC, randomUUID(), 'mal-formada']) {
        const correlationId = correlacion();
        expect(await decide(principalDe(paciente), organizationId, ctxHospital, 'VIEW_RECORDS', { correlationId })).toBe(
          'denied',
        );

        const eventos = await owner.auditEvent.findMany({ where: { correlationId } });
        expect(eventos).toHaveLength(1);
        expect(eventos[0]).toMatchObject({
          eventType: 'EXPERIENCE_ACCESS_DENIED',
          organizationId: null,
          resourceType: 'CareContext',
          resourceId: null,
        });
      }
    });

    it('la concesión audita organización y contexto, sin cuerpo ni referencias clínicas', async () => {
      const { paciente, ctxHospital } = await escenarioPaciente();
      const correlationId = correlacion();

      expect(await decide(principalDe(paciente), orgHospital, ctxHospital, 'VIEW_RECORDS', { correlationId })).toBe(
        'granted',
      );

      const eventos = await owner.auditEvent.findMany({ where: { correlationId } });
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        eventType: 'CARE_CONTEXT_ACCESS_GRANTED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: paciente.humanAccountId,
        actorRole: null,
        organizationId: orgHospital,
        resourceType: 'CareContext',
        resourceId: ctxHospital,
        outcome: 'SUCCESS',
        endpoint: 'internal:care-context.authorize',
      });
    });

    it('si el trabajo falla se revierte su escritura y también la auditoría concedida', async () => {
      const { paciente, ctxHospital } = await escenarioPaciente();
      const correlationId = correlacion();
      const correlacionTrabajo = correlacion();
      const fallo = new Error('fallo del trabajo');

      await expect(
        service.withAuthorizedContext(
          principalDe(paciente),
          { organizationId: orgHospital, contextId: ctxHospital },
          'VIEW_RECORDS',
          correlationId,
          new Date(),
          async (tx) => {
            await tx.auditEvent.create({
              data: {
                tenantId: tenantA,
                eventType: 'PATIENT_SELF_ACCESS_GRANTED',
                actorType: 'HUMAN_ACCOUNT',
                actorUserId: paciente.humanAccountId,
                resourceType: 'PatientSelfSummary',
                outcome: 'SUCCESS',
                correlationId: correlacionTrabajo,
              },
            });
            throw fallo;
          },
        ),
      ).rejects.toBe(fallo);

      expect(await owner.auditEvent.count({ where: { correlationId: { in: [correlationId, correlacionTrabajo] } } })).toBe(0);
    });

    it('si la auditoría no puede escribirse, el trabajo no corre y nada se confirma', async () => {
      const { paciente, ctxHospital } = await escenarioPaciente();
      const correlationId = correlacion();
      const auditoriaRota = new CareContextAuditService();
      auditoriaRota.recordGrantedWithin = async () => {
        throw new Error('auditoría no disponible');
      };
      const servicioRoto = construirServicio(auditoriaRota);
      let ejecutado = false;

      await expect(
        servicioRoto.withAuthorizedContext(
          principalDe(paciente),
          { organizationId: orgHospital, contextId: ctxHospital },
          'VIEW_RECORDS',
          correlationId,
          new Date(),
          async () => {
            ejecutado = true;
          },
        ),
      ).rejects.toBeInstanceOf(CareContextUnavailableError);

      expect(ejecutado).toBe(false);
      expect(await owner.auditEvent.count({ where: { correlationId } })).toBe(0);
    });
  });

  /* ====================================================================== */
  /* P07 — destinatario de una asignación de alarma (MP07A / A09)            */
  /* ====================================================================== */

  describe('P07 — elegibilidad del destinatario de una asignación (A09)', () => {
    let asignador: CareContextService;

    beforeAll(() => {
      asignador = construirServicioConDirectorio();
    });

    interface Destinatario {
      readonly cuenta: CuentaFicticia;
      readonly grantId: string;
      readonly competenceId: string;
    }

    interface ProfesionalDestinatario extends Destinatario {
      readonly assignmentId: string;
      readonly professionalId: string;
    }

    /** Revisora hospitalaria con REVIEW_ALARMS y competencia; sin experiencia de solicitante. */
    async function revisoraElegible(
      patientId: string,
      contextId: string,
      nombre = 'Revisora',
      opciones: { readonly endsAt?: Date } = {},
    ): Promise<Destinatario> {
      const cuenta = await seed.cuenta(tenantA, nombre);
      const competenceId = await seed.competencia(tenantA, orgHospital, cuenta.humanAccountId, gestor.humanAccountId);
      const grantId = await seed.concesion({
        tenantId: tenantA,
        organizationId: orgHospital,
        contextId,
        patientId,
        humanAccountId: cuenta.humanAccountId,
        actorKind: 'HOSPITAL_REVIEWER',
        permission: 'REVIEW_ALARMS',
        competenceAttestationId: competenceId,
        grantedByHumanAccountId: gestor.humanAccountId,
        ...(opciones.endsAt === undefined ? {} : { endsAt: opciones.endsAt }),
      });

      return { cuenta, grantId, competenceId };
    }

    /** Profesional asignado al paciente con REVIEW_ALARMS, competencia, perfil y afiliación. */
    async function profesionalElegible(patientId: string, contextId: string): Promise<ProfesionalDestinatario> {
      const profesional = await profesionalAsignado(patientId);
      const grantId = await seed.concesion({
        tenantId: tenantA,
        organizationId: orgHospital,
        contextId,
        patientId,
        humanAccountId: profesional.cuenta.humanAccountId,
        actorKind: 'PROFESSIONAL',
        permission: 'REVIEW_ALARMS',
        careAssignmentId: profesional.assignmentId,
        competenceAttestationId: profesional.competenceId,
        grantedByHumanAccountId: gestor.humanAccountId,
      });
      const { professionalId } = await owner.careAssignment.findUniqueOrThrow({
        where: { id: profesional.assignmentId },
        select: { professionalId: true },
      });

      return { ...profesional, grantId, professionalId };
    }

    /**
     * Asignación por el servicio REAL: el trabajo devuelve la elegibilidad que
     * el servidor decidió con las fuentes bloqueadas; `denied` si el actor no
     * puede revisar.
     */
    async function asignar(
      actor: CuentaFicticia,
      contextId: string,
      destinatario: string,
      opciones: { readonly correlationId?: string; readonly now?: Date } = {},
    ): Promise<boolean | 'denied'> {
      try {
        return await asignador.withAuthorizedReviewAssignment(
          principalDe(actor),
          contextId,
          destinatario,
          opciones.correlationId ?? correlacion(),
          opciones.now ?? new Date(),
          async (_tx, _authorized, elegible) => elegible,
        );
      } catch (error) {
        if (error instanceof CareContextAccessDeniedError) {
          return 'denied';
        }

        throw error;
      }
    }

    async function esperarHasta(condicion: () => Promise<boolean>, mensaje: string): Promise<void> {
      const limite = Date.now() + 15_000;

      while (Date.now() < limite) {
        if (await condicion()) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      throw new Error(mensaje);
    }

    /** PostgreSQL informa que el backend `pid` espera un bloqueo. */
    function esperarBloqueoDe(pid: number): Promise<void> {
      return esperarHasta(async () => {
        const [fila] = await owner.$queryRaw<{ readonly espera: string | null }[]>`
          SELECT wait_event_type AS espera FROM pg_stat_activity WHERE pid = ${pid}`;
        return fila?.espera === 'Lock';
      }, 'La revocación nunca quedó esperando el bloqueo de la asignación.');
    }

    /** PostgreSQL informa que algún backend está bloqueado por `pid`. */
    function esperarBloqueadoPor(pid: number): Promise<void> {
      return esperarHasta(async () => {
        const [fila] = await owner.$queryRaw<{ readonly n: number }[]>`
          SELECT count(*)::int AS n FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`;
        return (fila?.n ?? 0) > 0;
      }, 'La asignación nunca quedó esperando el bloqueo de la revocación.');
    }

    /** Revocaciones reales de cada fuente del destinatario, como las haría su flujo. */
    const REVOCACIONES: readonly {
      readonly fuente: string;
      readonly aplicar: (tx: PrismaTransaction, d: ProfesionalDestinatario) => Promise<unknown>;
    }[] = [
      {
        fuente: 'cuenta deshabilitada',
        aplicar: (tx, d) =>
          tx.$executeRaw`UPDATE "human_account" SET "status" = 'DISABLED' WHERE "id" = ${d.cuenta.humanAccountId}::uuid`,
      },
      {
        fuente: 'concesión revocada',
        aplicar: (tx, d) => tx.$executeRaw`
          UPDATE "care_authorization"
             SET "status" = 'REVOKED', "revokedAt" = now(), "version" = "version" + 1
           WHERE "id" = ${d.grantId}::uuid`,
      },
      {
        fuente: 'competencia revocada',
        aplicar: (tx, d) => tx.$executeRaw`
          UPDATE "clinical_competence_attestation"
             SET "status" = 'REVOKED', "revokedAt" = now(), "version" = "version" + 1
           WHERE "id" = ${d.competenceId}::uuid`,
      },
      {
        fuente: 'asignación terminada',
        aplicar: (tx, d) => tx.$executeRaw`
          UPDATE "care_assignment" SET "status" = 'ENDED', "endsAt" = now() WHERE "id" = ${d.assignmentId}::uuid`,
      },
    ];

    it('un destinatario SIN sesión válida pero con todas sus capacidades es elegible; también la propia cuenta', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();
      const actora = await revisoraElegible(patientId, ctxHospital, 'Revisora actora');
      const revisora = await revisoraElegible(patientId, ctxHospital, 'Revisora destinataria');
      const profesional = await profesionalElegible(patientId, ctxHospital);

      for (const destinatario of [revisora.cuenta, profesional.cuenta]) {
        await owner.humanSession.update({ where: { id: destinatario.sessionId }, data: { revokedAt: new Date() } });
        // Corte de autenticación posterior a toda sesión emitida: ninguna sirve.
        await owner.humanAccount.update({
          where: { id: destinatario.humanAccountId },
          data: { authenticationNotBefore: new Date() },
        });

        expect(await asignar(actora.cuenta, ctxHospital, destinatario.humanAccountId)).toBe(true);
      }

      expect(await asignar(actora.cuenta, ctxHospital, actora.cuenta.humanAccountId)).toBe(true);
    });

    it('no es elegible si falla CUALQUIER fuente propia; antes de romperla sí lo era', async () => {
      const rupturas: readonly {
        readonly fuente: string;
        readonly romper: (d: ProfesionalDestinatario) => Promise<unknown>;
      }[] = [
        ...REVOCACIONES.map((revocacion) => ({
          fuente: revocacion.fuente,
          romper: (d: ProfesionalDestinatario) => owner.$transaction((tx) => revocacion.aplicar(tx, d)),
        })),
        {
          fuente: 'recuperación de contraseña bloqueada',
          romper: (d) =>
            owner.humanAccount.update({ where: { id: d.cuenta.humanAccountId }, data: { passwordRecoveryBlocked: true } }),
        },
        {
          fuente: 'vínculo desvinculado',
          romper: (d) =>
            owner.externalAuthIdentity.update({
              where: { id: d.cuenta.bindingId },
              data: { status: 'UNLINKED', unlinkedAt: new Date() },
            }),
        },
        {
          fuente: 'perfil profesional inactivo',
          romper: (d) => owner.professionalProfile.update({ where: { id: d.professionalId }, data: { status: 'INACTIVE' } }),
        },
        {
          fuente: 'afiliación inactiva',
          romper: (d) =>
            owner.professionalAffiliation.updateMany({ where: { professionalId: d.professionalId }, data: { status: 'INACTIVE' } }),
        },
      ];

      for (const { fuente, romper } of rupturas) {
        const { patientId, ctxHospital } = await escenarioPaciente();
        const actora = await revisoraElegible(patientId, ctxHospital, 'Revisora actora');
        const destinatario = await profesionalElegible(patientId, ctxHospital);

        expect(await asignar(actora.cuenta, ctxHospital, destinatario.cuenta.humanAccountId), fuente).toBe(true);
        await romper(destinatario);
        expect(await asignar(actora.cuenta, ctxHospital, destinatario.cuenta.humanAccountId), fuente).toBe(false);
      }
    }, 60_000);

    it('no es elegible sin experiencia aprobada, en otra organización, otro tenant, sin concesión o inexistente; la concesión de un emisor no manager ni llega a existir', async () => {
      const { paciente, patientId, ctxHospital, ctxHospital2 } = await escenarioPaciente();
      const actora = await revisoraElegible(patientId, ctxHospital, 'Revisora actora');
      const comun = { tenantId: tenantA, patientId, permission: 'REVIEW_ALARMS' as const };

      // Profesional sin FIELD_PROFESSIONAL aprobada, con todo lo demás.
      const sinExperiencia = await seed.cuenta(tenantA, 'Profesional sin experiencia');
      const perfil = await seed.profesional(sinExperiencia);
      const asignacion = await seed.asignacion(tenantA, patientId, perfil);
      await seed.concesion({
        ...comun,
        organizationId: orgHospital,
        contextId: ctxHospital,
        humanAccountId: sinExperiencia.humanAccountId,
        actorKind: 'PROFESSIONAL',
        careAssignmentId: asignacion,
        competenceAttestationId: await seed.competencia(tenantA, orgHospital, sinExperiencia.humanAccountId, gestor.humanAccountId),
        grantedByHumanAccountId: gestor.humanAccountId,
      });

      // Fuente inválida rechazada AL INSERTAR: la base no admite una concesión
      // emitida por quien nunca fue manager de la organización. No se finge que
      // exista; esa cuenta queda sin concesión persistida y se evalúa como tal.
      const emisorAjeno = await seed.cuenta(tenantA, 'Revisora de emisor ajeno');
      await expect(
        seed.concesion({
          ...comun,
          organizationId: orgHospital,
          contextId: ctxHospital,
          humanAccountId: emisorAjeno.humanAccountId,
          actorKind: 'HOSPITAL_REVIEWER',
          competenceAttestationId: await seed.competencia(tenantA, orgHospital, emisorAjeno.humanAccountId, gestor.humanAccountId),
          grantedByHumanAccountId: fundador.humanAccountId,
        }),
      ).rejects.toThrow(/el emisor no es manager vigente de la organizacion/u);
      expect(await owner.careAuthorization.count({ where: { humanAccountId: emisorAjeno.humanAccountId } })).toBe(0);

      // Revisora solo de OTRA organización del mismo tenant y paciente.
      const otraOrganizacion = await seed.cuenta(tenantA, 'Revisora de otra organización');
      await seed.concesion({
        ...comun,
        organizationId: orgHospital2,
        contextId: ctxHospital2,
        humanAccountId: otraOrganizacion.humanAccountId,
        actorKind: 'HOSPITAL_REVIEWER',
        competenceAttestationId: await seed.competencia(tenantA, orgHospital2, otraOrganizacion.humanAccountId, gestor.humanAccountId),
        grantedByHumanAccountId: gestor.humanAccountId,
      });

      // Revisora con concesión de OTRA acción en este contexto.
      const otraAccion = await seed.cuenta(tenantA, 'Revisora de solo lectura');
      await seed.concesion({
        ...comun,
        permission: 'VIEW_RECORDS',
        organizationId: orgHospital,
        contextId: ctxHospital,
        humanAccountId: otraAccion.humanAccountId,
        actorKind: 'HOSPITAL_REVIEWER',
        competenceAttestationId: await seed.competencia(tenantA, orgHospital, otraAccion.humanAccountId, gestor.humanAccountId),
        grantedByHumanAccountId: gestor.humanAccountId,
      });

      const otroTenant = await seed.cuenta(tenantC, 'Cuenta de otro tenant');

      for (const destinatario of [
        sinExperiencia.humanAccountId,
        emisorAjeno.humanAccountId,
        otraOrganizacion.humanAccountId,
        otraAccion.humanAccountId,
        otroTenant.humanAccountId,
        paciente.humanAccountId,
        gestor.humanAccountId,
        randomUUID(),
        'no-es-uuid',
      ]) {
        expect(await asignar(actora.cuenta, ctxHospital, destinatario)).toBe(false);
      }
    });

    it('la concesión del destinatario vence exactamente en su endsAt', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();
      const actora = await revisoraElegible(patientId, ctxHospital, 'Revisora actora');
      const fin = new Date(Date.now() + 10 * 60 * 1000);
      const destinataria = await revisoraElegible(patientId, ctxHospital, 'Revisora temporal', { endsAt: fin });

      expect(
        await asignar(actora.cuenta, ctxHospital, destinataria.cuenta.humanAccountId, { now: new Date(fin.getTime() - 1) }),
      ).toBe(true);
      expect(await asignar(actora.cuenta, ctxHospital, destinataria.cuenta.humanAccountId, { now: fin })).toBe(false);
    });

    it('el actor sin revisión se deniega PRIMERO y uniformemente: no se evalúa al destinatario ni corre el trabajo', async () => {
      const { paciente, patientId, ctxHospital } = await escenarioPaciente();
      const elegible = await revisoraElegible(patientId, ctxHospital, 'Revisora destinataria');
      const conSesionRevocada = await revisoraElegible(patientId, ctxHospital, 'Revisora sin sesión');
      await owner.humanSession.update({ where: { id: conSesionRevocada.cuenta.sessionId }, data: { revokedAt: new Date() } });

      for (const actor of [paciente, conSesionRevocada.cuenta]) {
        for (const destinatario of [elegible.cuenta.humanAccountId, randomUUID(), 'no-es-uuid']) {
          const correlationId = correlacion();
          let ejecutado = false;

          await expect(
            asignador.withAuthorizedReviewAssignment(principalDe(actor), ctxHospital, destinatario, correlationId, new Date(), async () => {
              ejecutado = true;
            }),
          ).rejects.toBeInstanceOf(CareContextAccessDeniedError);
          expect(ejecutado).toBe(false);

          const eventos = await owner.auditEvent.findMany({ where: { correlationId } });
          expect(eventos).toHaveLength(1);
          expect(eventos[0]).toMatchObject({ outcome: 'DENIED', actorUserId: actor.humanAccountId, resourceId: null });
        }
      }
    });

    it('si el trabajo falla tras decidir, la asignación no deja auditoría concedida ni cambios', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();
      const actora = await revisoraElegible(patientId, ctxHospital, 'Revisora actora');
      const destinataria = await revisoraElegible(patientId, ctxHospital, 'Revisora destinataria');
      const correlationId = correlacion();
      const fallo = new Error('fallo del trabajo de asignación');

      await expect(
        asignador.withAuthorizedReviewAssignment(
          principalDe(actora.cuenta),
          ctxHospital,
          destinataria.cuenta.humanAccountId,
          correlationId,
          new Date(),
          async () => {
            throw fallo;
          },
        ),
      ).rejects.toBe(fallo);

      expect(await owner.auditEvent.count({ where: { correlationId } })).toBe(0);
    });

    it('una revocación concurrente de cada fuente del destinatario ESPERA al commit de la asignación', async () => {
      for (const revocacion of REVOCACIONES) {
        const { patientId, ctxHospital } = await escenarioPaciente();
        const actora = await revisoraElegible(patientId, ctxHospital, 'Revisora actora');
        const destinatario = await profesionalElegible(patientId, ctxHospital);

        let anunciarTrabajo!: () => void;
        let liberarTrabajo!: () => void;
        const trabajoEnCurso = new Promise<void>((resolve) => {
          anunciarTrabajo = resolve;
        });
        const trabajoLiberado = new Promise<void>((resolve) => {
          liberarTrabajo = resolve;
        });
        let anunciarPid!: (pid: number) => void;
        const pidRevocacion = new Promise<number>((resolve) => {
          anunciarPid = resolve;
        });
        const orden: string[] = [];

        const asignacion = asignador.withAuthorizedReviewAssignment(
          principalDe(actora.cuenta),
          ctxHospital,
          destinatario.cuenta.humanAccountId,
          correlacion(),
          new Date(),
          async (_tx, _authorized, elegible) => {
            anunciarTrabajo();
            await trabajoLiberado;
            orden.push('asignacion-terminada');
            return elegible;
          },
        );

        await trabajoEnCurso;

        const revocada = owner.$transaction(
          async (tx) => {
            const [fila] = await tx.$queryRaw<{ readonly pid: number }[]>`SELECT pg_backend_pid() AS pid`;
            anunciarPid(fila?.pid ?? -1);
            await revocacion.aplicar(tx, destinatario);
            orden.push('revocacion-aplicada');
          },
          { maxWait: 10_000, timeout: 20_000 },
        );

        try {
          // Barrera: PostgreSQL informa que el backend que revoca espera el bloqueo SHARE.
          await esperarBloqueoDe(await pidRevocacion);
          expect(orden, revocacion.fuente).toEqual([]);
        } finally {
          liberarTrabajo();
        }

        await expect(asignacion, revocacion.fuente).resolves.toBe(true);
        await revocada;

        expect(orden, revocacion.fuente).toEqual(['asignacion-terminada', 'revocacion-aplicada']);
        expect(await asignar(actora.cuenta, ctxHospital, destinatario.cuenta.humanAccountId), revocacion.fuente).toBe(false);
      }
    }, 90_000);

    it('si la revocación de cada fuente gana antes, la asignación espera su commit y ya la ve', async () => {
      for (const revocacion of REVOCACIONES) {
        const { patientId, ctxHospital } = await escenarioPaciente();
        const actora = await revisoraElegible(patientId, ctxHospital, 'Revisora actora');
        const destinatario = await profesionalElegible(patientId, ctxHospital);

        let anunciarPid!: (pid: number) => void;
        const pidRevocacion = new Promise<number>((resolve) => {
          anunciarPid = resolve;
        });
        let confirmarRevocacion!: () => void;
        const revocacionLiberada = new Promise<void>((resolve) => {
          confirmarRevocacion = resolve;
        });

        const revocada = owner.$transaction(
          async (tx) => {
            await revocacion.aplicar(tx, destinatario);
            const [fila] = await tx.$queryRaw<{ readonly pid: number }[]>`SELECT pg_backend_pid() AS pid`;
            anunciarPid(fila?.pid ?? -1);
            await revocacionLiberada;
          },
          { maxWait: 10_000, timeout: 20_000 },
        );

        const pid = await pidRevocacion;
        let resuelta = false;
        const asignacion = asignar(actora.cuenta, ctxHospital, destinatario.cuenta.humanAccountId).finally(() => {
          resuelta = true;
        });

        try {
          // Barrera: PostgreSQL informa que la asignación espera la fila revocada.
          await esperarBloqueadoPor(pid);
          expect(resuelta, revocacion.fuente).toBe(false);
        } finally {
          confirmarRevocacion();
        }

        await revocada;
        await expect(asignacion, revocacion.fuente).resolves.toBe(false);
      }
    }, 90_000);

    it('dos asignaciones cruzadas A→B y B→A concurrentes no se bloquean mutuamente ni se interbloquean', async () => {
      const { patientId, ctxHospital } = await escenarioPaciente();
      const a = await revisoraElegible(patientId, ctxHospital, 'Revisora A');
      const b = await profesionalElegible(patientId, ctxHospital);

      let enTrabajo = 0;
      let abrir!: () => void;
      const puerta = new Promise<void>((resolve) => {
        abrir = resolve;
      });
      const orden: string[] = [];

      const cruzada = (actor: CuentaFicticia, destinatario: CuentaFicticia, etiqueta: string): Promise<boolean> =>
        asignador.withAuthorizedReviewAssignment(
          principalDe(actor),
          ctxHospital,
          destinatario.humanAccountId,
          correlacion(),
          new Date(),
          async (tx, authorized, elegible) => {
            // Ambas transacciones retienen a la vez sus bloqueos SHARE de las dos cuentas y fuentes.
            enTrabajo += 1;
            await puerta;
            // Después, el advisory del contexto las serializa como en una transición real.
            await lockContextForWrite(tx, authorized);
            orden.push(etiqueta);
            return elegible;
          },
        );

      const deAaB = cruzada(a.cuenta, b.cuenta, 'A→B');
      const deBaA = cruzada(b.cuenta, a.cuenta, 'B→A');

      try {
        await esperarHasta(async () => enTrabajo === 2, 'Las asignaciones cruzadas no llegaron juntas al trabajo.');
      } finally {
        abrir();
      }

      await expect(Promise.all([deAaB, deBaA])).resolves.toEqual([true, true]);
      expect([...orden].sort()).toEqual(['A→B', 'B→A']);
    }, 30_000);
  });
});
