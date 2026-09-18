/*
 * Aprovisionamiento FICTICIO del proveedor OIDC. Debe quedar definido ANTES de
 * importar el módulo humano: su configuración se lee una sola vez, al
 * construirse el servicio.
 *
 * Los valores coinciden con los del resto de la suite humana: emisor canónico
 * LOCAL de desarrollo —admitido solo porque el entorno es `test`—, cliente
 * ficticio y clave ficticia que no cifra nada real. El descubrimiento OIDC NO
 * se ejecuta aquí: estas pruebas validan una sesión YA persistida y nunca
 * llegan a contactar al proveedor.
 */
process.env['MERDN_HUMAN_AUTH_ISSUER'] =
  'http://host.docker.internal:8081/realms/merdn-local';
process.env['MERDN_HUMAN_AUTH_CLIENT_ID'] = 'merdn-human-web';
process.env['MERDN_HUMAN_AUTH_CALLBACK_URI'] =
  'http://127.0.0.1:3001/api/v1/human-auth/callback';
process.env['MERDN_HUMAN_AUTH_ATTEMPT_KEY'] = 'b'.repeat(64);

import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { IdentityAuditService } from '../src/audit/identity-audit.service';
import { type ApiEnvironment } from '../src/config/environment';
import { PrismaService, RUNTIME_ROLE_NAME } from '../src/database/prisma.service';
import { TenantContextService } from '../src/database/tenant-context.service';
import { type PrismaClient } from '../src/generated/prisma/client';
import { HumanAuthService } from '../src/human-auth/human-auth.service';
import { type HumanPrincipal } from '../src/identity-access/human-principal';
import { IdentityAccessService } from '../src/identity-access/identity-access.service';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { cleanupTestData, ensureOtherTenant } from './enrollment-fixtures';
import {
  crearCuentaHumana,
  crearPacienteFicticio,
  crearProfesionalFicticio,
  crearSesionHumana,
  limpiarIdentidadYRelaciones,
} from './identity-relationships-fixtures';

/**
 * Puerta PROFESIONAL sobre un paciente concreto, contra PostgreSQL real
 * (IDENTITY-RELATIONSHIPS-CORE-01 §7.1 y §7.2, cierre MP03-B).
 *
 * Lo que aquí se demuestra es la CADENA COMPLETA, no una decisión aislada:
 *
 *   sesión humana válida
 *     → `HumanPrincipal` resuelto SERVER-SIDE por el validador de sesión
 *     → `resolveProfessional()` deriva el perfil de esa misma `Person`
 *     → afiliación institucional activa y vigente
 *     → `CareAssignment` activa y vigente sobre el paciente pedido
 *     → acceso autorizado a ESE paciente y a ninguno más.
 *
 * NADA de la cadena se construye a mano: el principal sale de
 * `HumanAuthService.validate()` a partir del token opaco de la sesión sembrada,
 * exactamente como lo obtendría `HumanSessionGuard` en una petición real. Un
 * principal fabricado en la prueba demostraría la consulta, no la puerta.
 *
 * ROL RUNTIME REAL: `PrismaService` se construye en modo `enforce`, de modo que
 * cada consulta se ejecuta bajo `merdn_runtime` —sin BYPASSRLS— con el tenant
 * fijado en la transacción. Las denegaciones que siguen están respaldadas por
 * Row Level Security, y no solo por los filtros de la aplicación.
 *
 * ESTA PRUEBA NO IMPLEMENTA VISITAS. `hasActiveAssignmentOverPatient()` es un
 * vínculo OPERATIVO de agenda: no concede historia clínica, no acredita título,
 * habilitación, contrato ni pago, y no autoriza ninguna decisión asistencial.
 *
 * TODAS las personas, documentos, `subject` y credenciales son FICTICIOS.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/** Código de la identidad institucional OPACA que figura como creadora. */
const CODIGO_IDENTIDAD_ASIGNADORA = 'care-assignment-creator-pruebas-mp03b';

/** Configuración mínima que necesitan los servicios. Valores ficticios. */
function entorno(): ApiEnvironment {
  return {
    merdnEnvironment: 'test',
    port: 3001,
    openApiPath: 'docs',
    // El objeto de esta prueba: rol de mínimo privilegio y RLS aplicados.
    runtimeRoleMode: 'enforce',
    hasSeparateRuntimeConnection: false,
    activeTenantCode: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp',
    // Spec 024: pareja confiable id + codigo. UUID FICTICIO exclusivo de
    // pruebas; el entorno lo suministra cuando corre contra una base real.
    activeTenantId:
      process.env['MERDN_ACTIVE_TENANT_ID'] ??
      '00000000-0000-4000-8000-000000000001',
    consent: {
      version: 'paciente-tratamiento-datos-v1',
      purpose: 'INSCRIPCION_PACIENTE_MERDN',
    },
    enrollmentSession: {
      cookieName: 'merdn_enrollment_session',
      sameSite: 'lax',
      secure: false,
      domain: undefined,
      ttlSeconds: 3600,
    },
    webOrigins: ['http://127.0.0.1:3000'],
    enrollmentRateLimit: { maxRequests: 1000, windowSeconds: 900 },
  };
}

/**
 * Identidad institucional OPACA a la que se atribuye la creación de las
 * asignaciones sembradas.
 *
 * La derivación almacenada es ALEATORIA y no corresponde a ninguna credencial:
 * nadie —tampoco la prueba— puede autenticarse con ella. Existe solo porque
 * `care_assignment.createdByIdentityId` exige un actor institucional, y ese
 * actor NUNCA es la persona profesional asignada.
 */
async function identidadAsignadora(
  prisma: PrismaClient,
  tenantId: string,
): Promise<string> {
  const existente = await prisma.institutionalIdentity.findFirst({
    where: { tenantId, code: CODIGO_IDENTIDAD_ASIGNADORA },
    select: { id: true },
  });

  if (existente !== null) {
    return existente.id;
  }

  const creada = await prisma.institutionalIdentity.create({
    data: {
      tenantId,
      code: CODIGO_IDENTIDAD_ASIGNADORA,
      role: 'HOSPITAL_SCHEDULER',
      status: 'ACTIVE',
      // Forma exigida por `institutional_identity_secret_shape`.
      accessSecretHash: randomBytes(64).toString('hex'),
      accessSecretSalt: randomBytes(16).toString('hex'),
    },
    select: { id: true },
  });

  return creada.id;
}

interface AsignacionOptions {
  readonly tenantId: string;
  readonly patientId: string;
  readonly professionalId: string;
  readonly status?: 'ACTIVE' | 'ENDED';
  readonly startsAt: Date;
  readonly endsAt?: Date | null;
}

/** Siembra una `CareAssignment` con el actor institucional exigido. */
async function crearAsignacion(
  prisma: PrismaClient,
  options: AsignacionOptions,
): Promise<string> {
  const asignacion = await prisma.careAssignment.create({
    data: {
      tenantId: options.tenantId,
      patientId: options.patientId,
      professionalId: options.professionalId,
      role: 'PRIMARY',
      status: options.status ?? 'ACTIVE',
      startsAt: options.startsAt,
      endsAt: options.endsAt ?? null,
      createdByIdentityId: await identidadAsignadora(prisma, options.tenantId),
    },
    select: { id: true },
  });

  return asignacion.id;
}

/**
 * Retira lo sembrado por ESTA prueba, en el orden que exigen las claves
 * foráneas: primero las asignaciones —`RESTRICT` hacia el perfil profesional—,
 * después identidad y relaciones, después personas y pacientes, y por último la
 * identidad institucional que las asignaciones referenciaban.
 *
 * NO borra eventos de auditoría: `audit_event` es append-only.
 */
async function limpiar(prisma: PrismaClient): Promise<void> {
  await prisma.careAssignment.deleteMany({
    where: { createdByIdentity: { code: CODIGO_IDENTIDAD_ASIGNADORA } },
  });
  await limpiarIdentidadYRelaciones(prisma);
  await cleanupTestData(prisma);
  await prisma.institutionalIdentity.deleteMany({
    where: { code: CODIGO_IDENTIDAD_ASIGNADORA },
  });
}

describe.skipIf(!puedeEjecutarse)(
  'Profesional autenticado con asignación activa sobre un paciente',
  () => {
    let prisma: PrismaClient;
    let servicio: PrismaService;
    let accesos: IdentityAccessService;
    let auth: HumanAuthService;

    let tenantId: string;
    let otroTenantId: string;

    /** Profesional AUTENTICADO en toda la prueba. */
    let profesional: { readonly personId: string; readonly professionalId: string };
    /** Token en claro de la sesión humana del profesional. */
    let tokenSesion: string;
    /** Principal resuelto por el validador de sesión. Nunca fabricado aquí. */
    let principal: HumanPrincipal;

    /** Segundo profesional del MISMO tenant, con su propia sesión válida. */
    let otroProfesional: { readonly personId: string; readonly professionalId: string };
    let principalOtroProfesional: HumanPrincipal;

    let pacienteAsignado: string;
    let pacienteSinAsignacion: string;
    let pacienteAsignacionInactiva: string;
    let pacienteAsignacionVencida: string;
    let pacienteOtroTenant: string;
    /** Persona SIN participación profesional: sirve al caso negativo de §7.2. */
    let personaNoProfesional: string;

    beforeAll(async () => {
      prisma = createTestPrismaClient();
      await limpiar(prisma);

      const tenant = await prisma.tenant.findUnique({
        where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
        select: { id: true },
      });

      if (tenant === null) {
        throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
      }
      tenantId = tenant.id;
      otroTenantId = await ensureOtherTenant(prisma);

      const configuracion = entorno();
      servicio = new PrismaService(configuracion);
      accesos = new IdentityAccessService(servicio);
      auth = new HumanAuthService(
        servicio,
        new TenantContextService(servicio, configuracion),
        new IdentityAuditService(),
        configuracion,
      );

      const ahora = new Date();
      const haceDosHoras = new Date(ahora.getTime() - 2 * 60 * 60 * 1000);

      /* --- Profesional autenticado, su cuenta humana y su sesión vigente --- */

      profesional = await crearProfesionalFicticio(prisma, tenantId);

      const cuenta = await crearCuentaHumana(prisma, {
        tenantId,
        personId: profesional.personId,
      });
      tokenSesion = (
        await crearSesionHumana(prisma, { tenantId, humanAccountId: cuenta.humanAccountId })
      ).token;

      /* ------------------------ Segundo profesional ------------------------ */

      otroProfesional = await crearProfesionalFicticio(prisma, tenantId);

      const otraCuenta = await crearCuentaHumana(prisma, {
        tenantId,
        personId: otroProfesional.personId,
      });
      const otroToken = (
        await crearSesionHumana(prisma, {
          tenantId,
          humanAccountId: otraCuenta.humanAccountId,
        })
      ).token;

      /* ------------------------------ Pacientes ---------------------------- */

      pacienteAsignado = (await crearPacienteFicticio(prisma, tenantId)).patientId;
      pacienteSinAsignacion = (await crearPacienteFicticio(prisma, tenantId)).patientId;
      pacienteAsignacionInactiva = (await crearPacienteFicticio(prisma, tenantId)).patientId;
      pacienteAsignacionVencida = (await crearPacienteFicticio(prisma, tenantId)).patientId;

      pacienteOtroTenant = (await crearPacienteFicticio(prisma, otroTenantId)).patientId;
      personaNoProfesional = (await crearPacienteFicticio(prisma, tenantId)).personId;

      /* ----------------------------- Asignaciones -------------------------- */

      // Autorizada: activa, ya iniciada y sin fin declarado.
      await crearAsignacion(prisma, {
        tenantId,
        patientId: pacienteAsignado,
        professionalId: profesional.professionalId,
        status: 'ACTIVE',
        startsAt: haceDosHoras,
      });

      // Inactiva: terminada aunque su periodo declarado aún no haya vencido.
      await crearAsignacion(prisma, {
        tenantId,
        patientId: pacienteAsignacionInactiva,
        professionalId: profesional.professionalId,
        status: 'ENDED',
        startsAt: haceDosHoras,
        endsAt: new Date(ahora.getTime() + 2 * 60 * 60 * 1000),
      });

      // Vencida: `endsAt` ya pasó.
      await crearAsignacion(prisma, {
        tenantId,
        patientId: pacienteAsignacionVencida,
        professionalId: profesional.professionalId,
        status: 'ENDED',
        startsAt: haceDosHoras,
        endsAt: new Date(ahora.getTime() - 30 * 60 * 1000),
      });

      // Asignación REAL y activa, pero de OTRA institución.
      const profesionalAjeno = await crearProfesionalFicticio(prisma, otroTenantId);
      await crearAsignacion(prisma, {
        tenantId: otroTenantId,
        patientId: pacienteOtroTenant,
        professionalId: profesionalAjeno.professionalId,
        status: 'ACTIVE',
        startsAt: haceDosHoras,
      });

      /* -------- Principales: SIEMPRE desde el validador de sesión --------- */

      const resuelto = await auth.validate(tokenSesion, new Date());
      if (resuelto === null) {
        throw new Error('La sesión humana sembrada no resolvió ningún principal.');
      }
      principal = resuelto.principal;

      const resueltoOtro = await auth.validate(otroToken, new Date());
      if (resueltoOtro === null) {
        throw new Error('La sesión del segundo profesional no resolvió principal.');
      }
      principalOtroProfesional = resueltoOtro.principal;
    });

    afterAll(async () => {
      if (servicio !== undefined) {
        await servicio.$disconnect().catch(() => undefined);
      }
      if (prisma !== undefined) {
        await limpiar(prisma);
        await prisma.$disconnect();
      }
    });

    /* ------------------------------- Paso 0 -------------------------------- */

    describe('0 · la prueba se ejecuta bajo el rol runtime real', () => {
      it('adopta merdn_runtime y fija el tenant dentro de la transacción', async () => {
        const contexto = await servicio.withTenant(tenantId, async (tx) => {
          const [fila] = await tx.$queryRaw<
            { readonly rol: string; readonly tenant: string | null }[]
          >`SELECT current_user::text AS rol, current_setting('merdn.tenant_id', true) AS tenant`;
          return fila;
        });

        // Sin esto, cualquier denegación posterior podría deberse solo a los
        // filtros de la aplicación y no a Row Level Security.
        expect(contexto?.rol).toBe(RUNTIME_ROLE_NAME);
        expect(contexto?.tenant).toBe(tenantId);
      });
    });

    /* ------------------------------- Paso 1 -------------------------------- */

    describe('1 · la sesión humana resuelve el principal en el servidor', () => {
      it('deriva persona y tenant del token opaco, sin dato alguno del cliente', async () => {
        const resuelto = await auth.validate(tokenSesion, new Date());

        expect(resuelto).not.toBeNull();
        expect(resuelto?.principal.personId).toBe(profesional.personId);
        expect(resuelto?.principal.tenantId).toBe(tenantId);
        // El principal NO lleva participaciones: tenerlas es otra evaluación.
        expect(resuelto?.principal).not.toHaveProperty('professionalId');
        expect(resuelto?.principal).not.toHaveProperty('patientId');
      });

      it('un token inexistente no resuelve principal alguno', async () => {
        const inventado = randomBytes(32).toString('base64url');

        expect(await auth.validate(inventado, new Date())).toBeNull();
      });
    });

    /* ------------------------------- Paso 2 -------------------------------- */

    describe('2 · resolveProfessional deriva el perfil de la misma Person', () => {
      it('devuelve el perfil activo y afiliado de la persona autenticada', async () => {
        const resuelto = await accesos.resolveProfessional(principal, new Date());

        expect(resuelto).toStrictEqual({ professionalId: profesional.professionalId });
      });

      it('cada sesión resuelve SU perfil y nunca el de otra persona', async () => {
        const resuelto = await accesos.resolveProfessional(
          principalOtroProfesional,
          new Date(),
        );

        expect(resuelto?.professionalId).toBe(otroProfesional.professionalId);
        expect(resuelto?.professionalId).not.toBe(profesional.professionalId);
      });

      it('una persona sin participación profesional no resuelve ninguna', async () => {
        const sinPerfil: HumanPrincipal = { ...principal, personId: personaNoProfesional };

        expect(await accesos.resolveProfessional(sinPerfil, new Date())).toBeNull();
      });
    });

    /* ------------------------------- Paso 3 -------------------------------- */

    describe('3 · la cadena completa autoriza el paciente asignado', () => {
      it('permite cuando hay perfil activo, afiliación vigente y asignación activa', async () => {
        expect(
          await accesos.hasActiveAssignmentOverPatient(
            principal,
            pacienteAsignado,
            new Date(),
          ),
        ).toBe(true);
      });
    });

    /* ------------------------------- Paso 4 -------------------------------- */

    describe('4 · denegaciones focales', () => {
      it('otro profesional del mismo tenant NO accede al paciente ajeno', async () => {
        expect(
          await accesos.hasActiveAssignmentOverPatient(
            principalOtroProfesional,
            pacienteAsignado,
            new Date(),
          ),
        ).toBe(false);
      });

      it('el profesional asignado NO accede a un paciente que no le asignaron', async () => {
        expect(
          await accesos.hasActiveAssignmentOverPatient(
            principal,
            pacienteSinAsignacion,
            new Date(),
          ),
        ).toBe(false);
      });

      it('una asignación activa de OTRA institución no cruza el aislamiento', async () => {
        // La asignación existe de verdad y está activa, vista con la credencial
        // administrativa: la denegación no se debe a que falten datos.
        expect(
          await prisma.careAssignment.count({
            where: {
              tenantId: otroTenantId,
              patientId: pacienteOtroTenant,
              status: 'ACTIVE',
            },
          }),
        ).toBe(1);

        expect(
          await accesos.hasActiveAssignmentOverPatient(
            principal,
            pacienteOtroTenant,
            new Date(),
          ),
        ).toBe(false);
      });

      it('una asignación INACTIVA no autoriza aunque su periodo siga abierto', async () => {
        expect(
          await accesos.hasActiveAssignmentOverPatient(
            principal,
            pacienteAsignacionInactiva,
            new Date(),
          ),
        ).toBe(false);
      });

      it('una asignación VENCIDA (endsAt <= now) no autoriza', async () => {
        expect(
          await accesos.hasActiveAssignmentOverPatient(
            principal,
            pacienteAsignacionVencida,
            new Date(),
          ),
        ).toBe(false);
      });

      /*
       * El caso «vencida» solo puede sembrarse con estado `ENDED`: el CHECK
       * `care_assignment_period_scope` PROHÍBE una asignación `ACTIVE` con
       * `endsAt`. La denegación por vencimiento está, por tanto, sostenida por
       * dos capas —la base impide el estado y la consulta lo descartaría—, y no
       * existe ninguna fila que pueda presentarse como activa y caducada a la
       * vez. Se comprueba explícitamente para que quede como evidencia.
       */
      it('la base impide siquiera representar una asignación activa con fin', async () => {
        await expect(
          crearAsignacion(prisma, {
            tenantId,
            patientId: pacienteSinAsignacion,
            professionalId: profesional.professionalId,
            status: 'ACTIVE',
            startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            endsAt: new Date(Date.now() - 30 * 60 * 1000),
          }),
        ).rejects.toThrow(/care_assignment_period_scope/u);

        // Y el paciente sigue sin ninguna asignación.
        expect(
          await prisma.careAssignment.count({ where: { patientId: pacienteSinAsignacion } }),
        ).toBe(0);
      });
    });

    /* ------------------------------- Paso 5 -------------------------------- */

    describe('5 · el contexto de tenant falla cerrado', () => {
      it('un tenant AJENO no convierte la asignación propia en autorización', async () => {
        const enOtroTenant: HumanPrincipal = { ...principal, tenantId: otroTenantId };

        expect(
          await accesos.hasActiveAssignmentOverPatient(
            enOtroTenant,
            pacienteAsignado,
            new Date(),
          ),
        ).toBe(false);
        expect(await accesos.resolveProfessional(enOtroTenant, new Date())).toBeNull();
      });

      it('un tenant INEXISTENTE deniega, no autoriza', async () => {
        const inexistente: HumanPrincipal = {
          ...principal,
          tenantId: '00000000-0000-0000-0000-0000000000ff',
        };

        expect(
          await accesos.hasActiveAssignmentOverPatient(
            inexistente,
            pacienteAsignado,
            new Date(),
          ),
        ).toBe(false);
      });

      it('un tenant AUSENTE aborta la operación y jamás devuelve autorización', async () => {
        const sinTenant: HumanPrincipal = { ...principal, tenantId: '' };

        // Se captura el desenlace en lugar de esperar solo un rechazo: lo que
        // hay que demostrar es que NO existe camino alguno hacia `true`.
        let desenlace: unknown = 'sin evaluar';

        try {
          desenlace = await accesos.hasActiveAssignmentOverPatient(
            sinTenant,
            pacienteAsignado,
            new Date(),
          );
        } catch (error) {
          desenlace = error;
        }

        expect(desenlace).not.toBe(true);
        expect(desenlace).toBeInstanceOf(Error);
      });
    });
  },
);
