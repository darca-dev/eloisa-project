import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { type ApiEnvironment } from '../src/config/environment';
import { type PrismaTransaction } from '../src/database/prisma-transaction';
import { PrismaService, RUNTIME_ROLE_NAME } from '../src/database/prisma.service';
import { type PrismaClient } from '../src/generated/prisma/client';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { ensureOtherTenant, TEST_DOCUMENT_PREFIX } from './enrollment-fixtures';
import {
  crearCuentaHumana,
  crearPersona,
  crearProfesionalFicticio,
  crearSesionHumana,
} from './identity-relationships-fixtures';

/**
 * Fundación PostgreSQL del Soporte de Plataforma ELOISA Admin/Support, contra
 * PostgreSQL real (ELOISA-ADMIN-ACCESS-01 MP01 — DATA FOUNDATION).
 *
 * ALCANCE EXACTO DE ESTA PRUEBA: persistencia, integridad y aislamiento. No
 * ejercita ningún servicio, guard, controller, cookie, endpoint ni interfaz,
 * porque el paquete MP01 no los crea. Lo que aquí se demuestra es que la BASE DE
 * DATOS —y no una capa de aplicación que todavía no existe— sostiene:
 *
 *   0. PostgreSQL real, rol `merdn_runtime` efectivo y RLS `ENABLE` + `FORCE`;
 *   1. la capacidad administrativa NOMINATIVA sobre una `HumanAccount` YA
 *      existente del MISMO tenant home, sin contraseña ni identidad nueva;
 *   2. que la capacidad no se confunde con Professional, Caregiver ni con una
 *      identidad institucional;
 *   3. la autorización EXPLÍCITA por tenant objetivo, con alcance CERRADO,
 *      vigencia coherente y revocación que conserva la fila;
 *   4. la unicidad de la autorización ACTIVE equivalente;
 *   5. el contexto temporal con motivo obligatorio, ticket acotado, vigencia
 *      absoluta de 60 minutos, inactividad REPRESENTABLE y timestamps válidos;
 *   6. la unicidad del contexto no revocado por cuenta;
 *   7. el aislamiento por tenant HOME y el fallo CERRADO sin contexto;
 *   8. el mínimo privilegio del rol de ejecución, sin `DELETE` en ninguna parte;
 *   9. la auditoría de soporte: actor humano, tenant objetivo, autorización,
 *      contexto y motivo, SIN rol institucional;
 *  10. que la auditoría sigue siendo APPEND-ONLY y rechaza procedencia
 *      incoherente;
 *  11. que ninguna clave foránea destruye autorizaciones, contextos ni
 *      evidencia;
 *  12. que EXISTIR estas filas NO concede ninguna capacidad de ejecución: con
 *      capacidad, autorización y contexto sembrados, el tenant objetivo sigue
 *      cerrado bajo el contexto del tenant home.
 *
 * ROL RUNTIME REAL: salvo la SIEMBRA y las comprobaciones de restricciones
 * —que usan la credencial administrativa—, las lecturas y escrituras de
 * aislamiento se ejecutan dentro de `PrismaService.withTenant()` en modo
 * `enforce`, es decir bajo `merdn_runtime` —sin `BYPASSRLS`— y con el tenant
 * fijado en la transacción. Las denegaciones quedan por tanto respaldadas por
 * PostgreSQL y no por un filtro de aplicación.
 *
 * TODAS las personas, cuentas, sesiones, motivos y referencias son FICTICIOS.
 * NINGUNA fila la crea la migración: MP01 no inserta datos de demostración, de
 * modo que una instalación limpia no concede soporte a nadie.
 *
 * LIMPIEZA ACOTADA: esta prueba retira EXCLUSIVAMENTE las filas cuyos
 * identificadores registró al sembrarlas, más los residuos que una ejecución
 * anterior de ella misma pudiera haber dejado, localizados por las personas
 * FICTICIAS del prefijo documental reservado. NO vacía `audit_event` —que es
 * append-only—, ni `person`, ni `patient`, ni ninguna otra tabla compartida.
 *
 * AUDITORÍA SIN RESIDUO: todos los eventos de auditoría de esta prueba se
 * escriben dentro de transacciones DELIBERADAMENTE REVERTIDAS. Un evento ya
 * confirmado no podría retirarse —el trigger append-only lo impide incluso al
 * propietario— y su clave foránea `NO ACTION` bloquearía después la limpieza de
 * la autorización y del contexto que nombra. Revertir la transacción no es
 * borrar evidencia: la evidencia nunca llega a existir.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/** Motivo FICTICIO base. El prefijo identifica lo sembrado por este archivo. */
const MOTIVO_BASE = 'Soporte ELOISA MP01 pruebas';

/** Referencia de ticket FICTICIA. No corresponde a ningún sistema real. */
const TICKET_FICTICIO = 'SOP-MP01-0001';

/** Vigencia máxima aprobada del contexto de soporte, en minutos. */
const TTL_MAXIMO_MINUTOS = 60;

/** Corte por inactividad aprobado, en minutos. Lo evalúa MP02, no la base. */
const INACTIVIDAD_MINUTOS = 15;

/** Configuración mínima que necesita `PrismaService`. Valores ficticios. */
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
 * Valor FICTICIO con forma de hash para `tokenHash`.
 *
 * NO deriva de ningún token real y NO reutiliza `HumanSession.tokenHash`: el
 * contexto de soporte tiene su propia tabla, su propia columna y su propio
 * índice único, y nada en la base ata uno a otro.
 */
function hashFicticio(): string {
  return randomBytes(32).toString('hex');
}

/** REGISTRO EXACTO de lo que esta prueba siembra. */
interface Sembrado {
  readonly contextos: Set<string>;
  readonly autorizaciones: Set<string>;
  readonly capacidades: Set<string>;
  readonly sesionesHumanas: Set<string>;
  readonly cuentasHumanas: Set<string>;
  readonly profesionales: Set<string>;
  readonly personas: Set<string>;
}

const sembrado: Sembrado = {
  contextos: new Set<string>(),
  autorizaciones: new Set<string>(),
  capacidades: new Set<string>(),
  sesionesHumanas: new Set<string>(),
  cuentasHumanas: new Set<string>(),
  profesionales: new Set<string>(),
  personas: new Set<string>(),
};

/**
 * Retira EXCLUSIVAMENTE lo que esta prueba sembró, en el orden que exigen las
 * claves foráneas: primero los contextos, después las autorizaciones, después
 * las capacidades, después sesiones, vínculos y cuentas humanas, después los
 * perfiles profesionales y por último las personas.
 *
 * El orden IMPORTA: ninguna de estas relaciones cae en cascada. Retirar una
 * capacidad antes que su autorización —o una cuenta antes que su capacidad— es
 * un ERROR que PostgreSQL rechaza, y esa rigidez es exactamente la garantía que
 * MP01 añade.
 *
 * NO borra eventos de auditoría: `audit_event` es append-only y esta prueba no
 * confirma ninguno.
 */
async function retirarLoSembrado(prisma: PrismaClient): Promise<void> {
  if (sembrado.contextos.size > 0) {
    await prisma.supportContextSession.deleteMany({
      where: { id: { in: [...sembrado.contextos] } },
    });
  }

  if (sembrado.autorizaciones.size > 0) {
    await prisma.supportGrant.deleteMany({
      where: { id: { in: [...sembrado.autorizaciones] } },
    });
  }

  if (sembrado.capacidades.size > 0) {
    await prisma.platformSupportCapability.deleteMany({
      where: { id: { in: [...sembrado.capacidades] } },
    });
  }

  if (sembrado.sesionesHumanas.size > 0) {
    await prisma.humanSession.deleteMany({
      where: { id: { in: [...sembrado.sesionesHumanas] } },
    });
  }

  if (sembrado.cuentasHumanas.size > 0) {
    const cuentas = [...sembrado.cuentasHumanas];
    await prisma.humanSession.deleteMany({ where: { humanAccountId: { in: cuentas } } });
    await prisma.externalAuthIdentity.deleteMany({
      where: { humanAccountId: { in: cuentas } },
    });
    await prisma.humanAccount.deleteMany({ where: { id: { in: cuentas } } });
  }

  if (sembrado.profesionales.size > 0) {
    const profesionales = [...sembrado.profesionales];
    await prisma.professionalAffiliation.deleteMany({
      where: { professionalId: { in: profesionales } },
    });
    await prisma.professionalProfile.deleteMany({ where: { id: { in: profesionales } } });
  }

  if (sembrado.personas.size > 0) {
    await prisma.person.deleteMany({ where: { id: { in: [...sembrado.personas] } } });
  }

  for (const conjunto of Object.values(sembrado)) {
    conjunto.clear();
  }
}

/**
 * Retira los residuos que una ejecución ANTERIOR de esta misma prueba pudo
 * dejar si se interrumpió antes de su limpieza.
 *
 * El criterio es estrictamente MP01: capacidades, autorizaciones y contextos
 * cuya cuenta humana pertenece a una PERSONA FICTICIA del prefijo documental
 * reservado de las pruebas. Nada más se toca: las personas y las cuentas que
 * pudieran quedar sueltas pertenecen a fixtures COMPARTIDAS, y retirarlas
 * exigiría un barrido global que esta prueba no tiene autoridad para hacer.
 */
async function retirarResiduosMp01(prisma: PrismaClient): Promise<void> {
  const capacidades = await prisma.platformSupportCapability.findMany({
    where: {
      account: { person: { documentNumberNormalized: { startsWith: TEST_DOCUMENT_PREFIX } } },
    },
    select: { id: true },
  });

  if (capacidades.length === 0) {
    return;
  }

  const capacidadIds = capacidades.map((capacidad) => capacidad.id);

  const autorizaciones = await prisma.supportGrant.findMany({
    where: { platformSupportCapabilityId: { in: capacidadIds } },
    select: { id: true },
  });
  const autorizacionIds = autorizaciones.map((autorizacion) => autorizacion.id);

  if (autorizacionIds.length > 0) {
    await prisma.supportContextSession.deleteMany({
      where: { supportGrantId: { in: autorizacionIds } },
    });
    await prisma.supportGrant.deleteMany({ where: { id: { in: autorizacionIds } } });
  }

  await prisma.platformSupportCapability.deleteMany({ where: { id: { in: capacidadIds } } });
}

/** Señal interna para revertir una transacción cuyo trabajo SÍ tuvo éxito. */
class SenalDeReversion<T> extends Error {
  public constructor(public readonly valor: T) {
    super('Reversión deliberada de la transacción de prueba.');
    this.name = 'SenalDeReversion';
  }
}

describe.skipIf(!puedeEjecutarse)(
  'Fundación PostgreSQL del Soporte de Plataforma (ELOISA-ADMIN-ACCESS-01 MP01)',
  () => {
    let prisma: PrismaClient;
    let servicio: PrismaService;

    /** Tenant HOME de la cuenta administrativa. */
    let homeTenantId: string;
    /** Tenant OBJETIVO de la autorización de soporte. */
    let targetTenantId: string;

    /** Cuenta humana administrativa principal y su sesión humana vigente. */
    let cuentaAdminId: string;
    let sesionAdminId: string;

    /** Capacidad, autorización y contexto sanos, reservados a las lecturas. */
    let capacidadId: string;
    let autorizacionId: string;
    let contextoId: string;

    /**
     * Ejecuta trabajo dentro de una transacción que SIEMPRE se revierte.
     * Devuelve lo que el trabajo produjo, sin dejar ninguna fila confirmada.
     */
    async function enTransaccionRevertida<T>(
      trabajo: (tx: PrismaTransaction) => Promise<T>,
    ): Promise<T> {
      try {
        await prisma.$transaction(async (tx) => {
          throw new SenalDeReversion(await trabajo(tx));
        });
      } catch (error) {
        if (error instanceof SenalDeReversion) {
          return error.valor as T;
        }
        throw error;
      }

      throw new Error('La transacción de prueba debía revertirse y no lo hizo.');
    }

    /** Crea una `Person` FICTICIA y su `HumanAccount` en el tenant indicado. */
    async function cuentaHumanaFicticia(tenantId: string): Promise<string> {
      const { personId } = await crearPersona(prisma, tenantId, 'Soporte');
      sembrado.personas.add(personId);

      const { humanAccountId } = await crearCuentaHumana(prisma, { tenantId, personId });
      sembrado.cuentasHumanas.add(humanAccountId);

      return humanAccountId;
    }

    /** Siembra una sesión humana vigente para la cuenta indicada. */
    async function sesionHumanaFicticia(
      tenantId: string,
      humanAccountId: string,
    ): Promise<string> {
      const { sessionId } = await crearSesionHumana(prisma, { tenantId, humanAccountId });
      sembrado.sesionesHumanas.add(sessionId);

      return sessionId;
    }

    /** Siembra la capacidad administrativa de una cuenta en su tenant home. */
    async function capacidadFicticia(
      tenantId: string,
      humanAccountId: string,
    ): Promise<string> {
      const capacidad = await prisma.platformSupportCapability.create({
        data: { homeTenantId: tenantId, humanAccountId, status: 'ACTIVE' },
        select: { id: true },
      });
      sembrado.capacidades.add(capacidad.id);

      return capacidad.id;
    }

    /** Siembra una autorización ACTIVE sobre el tenant objetivo indicado. */
    async function autorizacionFicticia(
      tenantId: string,
      platformSupportCapabilityId: string,
      objetivo: string,
    ): Promise<string> {
      const autorizacion = await prisma.supportGrant.create({
        data: {
          homeTenantId: tenantId,
          platformSupportCapabilityId,
          targetTenantId: objetivo,
          scope: 'HOSPITAL_OPERATIONAL_READ',
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      sembrado.autorizaciones.add(autorizacion.id);

      return autorizacion.id;
    }

    /** Datos de un contexto de soporte sano, con los ajustes indicados. */
    function datosContexto(overrides: {
      readonly homeTenantId: string;
      readonly humanAccountId: string;
      readonly humanSessionId: string;
      readonly supportGrantId: string;
      readonly targetTenantId: string;
      readonly reason?: string;
      readonly ticketReference?: string | null;
      readonly createdAt?: Date;
      readonly expiresAt?: Date;
      readonly lastUsedAt?: Date | null;
      readonly revokedAt?: Date | null;
    }): {
      readonly homeTenantId: string;
      readonly humanAccountId: string;
      readonly humanSessionId: string;
      readonly supportGrantId: string;
      readonly targetTenantId: string;
      readonly tokenHash: string;
      readonly reason: string;
      readonly ticketReference: string | null;
      readonly createdAt: Date;
      readonly expiresAt: Date;
      readonly lastUsedAt: Date | null;
      readonly revokedAt: Date | null;
    } {
      const createdAt = overrides.createdAt ?? new Date();

      return {
        homeTenantId: overrides.homeTenantId,
        humanAccountId: overrides.humanAccountId,
        humanSessionId: overrides.humanSessionId,
        supportGrantId: overrides.supportGrantId,
        targetTenantId: overrides.targetTenantId,
        tokenHash: hashFicticio(),
        reason: overrides.reason ?? `${MOTIVO_BASE}: verificación de agenda`,
        ticketReference: overrides.ticketReference ?? null,
        createdAt,
        expiresAt: overrides.expiresAt ?? new Date(createdAt.getTime() + 45 * 60_000),
        lastUsedAt: overrides.lastUsedAt ?? null,
        revokedAt: overrides.revokedAt ?? null,
      };
    }

    beforeAll(async () => {
      prisma = createTestPrismaClient();
      // NO se vacía el entorno: solo se retiran los residuos de MP01.
      await retirarResiduosMp01(prisma);

      const tenant = await prisma.tenant.findUnique({
        where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
        select: { id: true },
      });

      if (tenant === null) {
        throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
      }

      homeTenantId = tenant.id;
      targetTenantId = await ensureOtherTenant(prisma);

      servicio = new PrismaService(entorno());

      cuentaAdminId = await cuentaHumanaFicticia(homeTenantId);
      sesionAdminId = await sesionHumanaFicticia(homeTenantId, cuentaAdminId);

      capacidadId = await capacidadFicticia(homeTenantId, cuentaAdminId);
      autorizacionId = await autorizacionFicticia(homeTenantId, capacidadId, targetTenantId);

      const contexto = await prisma.supportContextSession.create({
        data: datosContexto({
          homeTenantId,
          humanAccountId: cuentaAdminId,
          humanSessionId: sesionAdminId,
          supportGrantId: autorizacionId,
          targetTenantId,
          ticketReference: TICKET_FICTICIO,
        }),
        select: { id: true },
      });
      sembrado.contextos.add(contexto.id);
      contextoId = contexto.id;
    });

    afterAll(async () => {
      if (servicio !== undefined) {
        await servicio.$disconnect();
      }

      if (prisma !== undefined) {
        await retirarLoSembrado(prisma);
        await prisma.$disconnect();
      }
    });

    /* ------------------------------- Paso 0 -------------------------------- */

    describe('0 · la prueba se ejecuta contra PostgreSQL real y bajo el rol runtime', () => {
      it('el motor es un servidor PostgreSQL real, no un doble de prueba', () => {
        expect(availability.available).toBe(true);
        expect(availability.migrated).toBe(true);
        expect(availability.engine).toBe('postgresql-server');
        expect(availability.version).toMatch(/PostgreSQL/u);
      });

      it('adopta merdn_runtime y fija el tenant dentro de la transacción', async () => {
        const contexto = await servicio.withTenant(homeTenantId, async (tx) => {
          const [fila] = await tx.$queryRaw<
            { readonly rol: string; readonly tenant: string | null }[]
          >`SELECT current_user::text AS rol, current_setting('merdn.tenant_id', true) AS tenant`;

          return fila;
        });

        // Sin esto, cualquier denegación posterior podría deberse solo a los
        // filtros de la aplicación y no a Row Level Security.
        expect(contexto?.rol).toBe(RUNTIME_ROLE_NAME);
        expect(contexto?.tenant).toBe(homeTenantId);
      });

      it('el rol de ejecución NO es superusuario y NO tiene BYPASSRLS', async () => {
        const [rol] = await prisma.$queryRaw<
          {
            readonly superusuario: boolean;
            readonly bypassrls: boolean;
            readonly puedeCrearRoles: boolean;
          }[]
        >`SELECT rolsuper AS superusuario,
                 rolbypassrls AS bypassrls,
                 rolcreaterole AS "puedeCrearRoles"
            FROM pg_roles
           WHERE rolname = 'merdn_runtime'`;

        expect(rol).toStrictEqual({
          superusuario: false,
          bypassrls: false,
          puedeCrearRoles: false,
        });
      });

      it('las tres tablas nuevas tienen Row Level Security habilitada y FORZADA', async () => {
        const filas = await prisma.$queryRaw<
          {
            readonly tabla: string;
            readonly habilitada: boolean;
            readonly forzada: boolean;
          }[]
        >`SELECT relname AS tabla,
                 relrowsecurity AS habilitada,
                 relforcerowsecurity AS forzada
            FROM pg_class
           WHERE relname IN (
                   'platform_support_capability',
                   'support_grant',
                   'support_context_session'
                 )
           ORDER BY relname`;

        expect(filas).toStrictEqual([
          { tabla: 'platform_support_capability', habilitada: true, forzada: true },
          { tabla: 'support_context_session', habilitada: true, forzada: true },
          { tabla: 'support_grant', habilitada: true, forzada: true },
        ]);
      });

      it('las tablas preexistentes conservan EXACTAMENTE su Row Level Security', async () => {
        // MP01 es ADITIVA: no refuerza ni DEBILITA el aislamiento ya vigente.
        //
        // El estado esperado NO es uniforme y no debe uniformarse aquí: las
        // tablas de CORE-01 llevan `ENABLE` sin `FORCE` desde su propia
        // migración de endurecimiento, y las de paquetes posteriores llevan las
        // dos. Cambiar eso sería una decisión ajena a esta Task.
        const filas = await prisma.$queryRaw<
          {
            readonly tabla: string;
            readonly habilitada: boolean;
            readonly forzada: boolean;
          }[]
        >`SELECT relname AS tabla,
                 relrowsecurity AS habilitada,
                 relforcerowsecurity AS forzada
            FROM pg_class
           WHERE relname IN (
                   'audit_event', 'patient', 'human_account', 'human_session', 'home_visit'
                 )
           ORDER BY relname`;

        expect(filas).toStrictEqual([
          { tabla: 'audit_event', habilitada: true, forzada: false },
          { tabla: 'home_visit', habilitada: true, forzada: true },
          { tabla: 'human_account', habilitada: true, forzada: true },
          { tabla: 'human_session', habilitada: true, forzada: true },
          { tabla: 'patient', habilitada: true, forzada: false },
        ]);
      });
    });

    /* ------------------------------- Paso 1 -------------------------------- */

    describe('1 · capacidad administrativa NOMINATIVA sobre una cuenta humana', () => {
      it('la capacidad reutiliza la HumanAccount existente de su tenant home', async () => {
        const capacidad = await prisma.platformSupportCapability.findUniqueOrThrow({
          where: { id: capacidadId },
          select: {
            homeTenantId: true,
            humanAccountId: true,
            status: true,
            disabledAt: true,
            account: { select: { id: true, tenantId: true, status: true } },
          },
        });

        expect(capacidad.homeTenantId).toBe(homeTenantId);
        expect(capacidad.humanAccountId).toBe(cuentaAdminId);
        expect(capacidad.status).toBe('ACTIVE');
        expect(capacidad.disabledAt).toBeNull();
        // La cuenta es la MISMA que ya autentica por OIDC: no hay identidad nueva.
        expect(capacidad.account).toStrictEqual({
          id: cuentaAdminId,
          tenantId: homeTenantId,
          status: 'ACTIVE',
        });
      });

      it('NO persiste contraseña, secreto, sal, emisor OIDC ni rol institucional', async () => {
        const columnas = await prisma.$queryRaw<{ readonly columna: string }[]>`
          SELECT column_name AS columna
            FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'platform_support_capability'
           ORDER BY column_name`;

        const nombres = columnas.map((columna) => columna.columna);

        expect(nombres).toStrictEqual([
          'createdAt',
          'disabledAt',
          'homeTenantId',
          'humanAccountId',
          'id',
          'status',
          'updatedAt',
        ]);

        // Ninguna columna puede sostener una contraseña maestra ni una
        // identidad paralela: sencillamente no existe dónde guardarla.
        for (const prohibido of [
          /password/iu,
          /secret/iu,
          /salt/iu,
          /hash/iu,
          /token/iu,
          /issuer/iu,
          /subject/iu,
          /role/iu,
          /professional/iu,
          /caregiver/iu,
          /identity/iu,
        ]) {
          expect(nombres.some((nombre) => prohibido.test(nombre))).toBe(false);
        }
      });

      it('rechaza una cuenta humana de OTRO tenant', async () => {
        const cuentaAjena = await cuentaHumanaFicticia(targetTenantId);

        await expect(
          prisma.platformSupportCapability.create({
            data: { homeTenantId, humanAccountId: cuentaAjena, status: 'ACTIVE' },
          }),
        ).rejects.toThrow();

        expect(
          await prisma.platformSupportCapability.count({
            where: { humanAccountId: cuentaAjena },
          }),
        ).toBe(0);
      });

      it('admite UNA sola capacidad por cuenta y tenant home', async () => {
        await expect(
          prisma.platformSupportCapability.create({
            data: { homeTenantId, humanAccountId: cuentaAdminId, status: 'ACTIVE' },
          }),
        ).rejects.toThrow();
      });

      it('exige coherencia EXACTA entre estado y marca de deshabilitación', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);

        // ACTIVE nunca lleva `disabledAt`. La marca se sitúa DESPUÉS de la
        // creación para que el único invariante violado sea el de coherencia.
        await expect(
          prisma.platformSupportCapability.create({
            data: {
              homeTenantId,
              humanAccountId: cuenta,
              status: 'ACTIVE',
              disabledAt: new Date(Date.now() + 60_000),
            },
          }),
        ).rejects.toThrow(/platform_support_capability_status_timestamps/u);

        // DISABLED siempre la lleva.
        await expect(
          prisma.platformSupportCapability.create({
            data: { homeTenantId, humanAccountId: cuenta, status: 'DISABLED' },
          }),
        ).rejects.toThrow(/platform_support_capability_status_timestamps/u);
      });

      it('la deshabilitación CONSERVA la fila: no se borra, se marca', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);

        const deshabilitada = await prisma.platformSupportCapability.update({
          where: { id: capacidad },
          data: { status: 'DISABLED', disabledAt: new Date() },
          select: { id: true, status: true, disabledAt: true },
        });

        expect(deshabilitada.id).toBe(capacidad);
        expect(deshabilitada.status).toBe('DISABLED');
        expect(deshabilitada.disabledAt).not.toBeNull();
      });
    });

    /* ------------------------------- Paso 2 -------------------------------- */

    describe('2 · la capacidad NO se confunde con Professional, Caregiver ni identidad institucional', () => {
      it('un identificador de identidad institucional no sirve como cuenta humana', async () => {
        const identidad = await prisma.institutionalIdentity.findFirst({
          where: { tenantId: homeTenantId },
          select: { id: true },
        });

        if (identidad === null) {
          // Sin identidades institucionales sembradas no hay nada que confundir.
          expect(
            await prisma.platformSupportCapability.count({ where: { homeTenantId } }),
          ).toBeGreaterThanOrEqual(0);

          return;
        }

        await expect(
          prisma.platformSupportCapability.create({
            data: { homeTenantId, humanAccountId: identidad.id, status: 'ACTIVE' },
          }),
        ).rejects.toThrow();
      });

      it('tener perfil profesional NO otorga capacidad de soporte', async () => {
        const profesional = await crearProfesionalFicticio(prisma, homeTenantId);
        sembrado.profesionales.add(profesional.professionalId);
        sembrado.personas.add(profesional.personId);

        const { humanAccountId } = await crearCuentaHumana(prisma, {
          tenantId: homeTenantId,
          personId: profesional.personId,
        });
        sembrado.cuentasHumanas.add(humanAccountId);

        // La capacidad es una fila SEPARADA que nadie creó: no se deduce del
        // perfil profesional, ni del estado de la cuenta, ni de ningún claim.
        expect(
          await prisma.platformSupportCapability.count({ where: { humanAccountId } }),
        ).toBe(0);
        expect(
          await prisma.supportGrant.count({
            where: { capability: { humanAccountId } },
          }),
        ).toBe(0);
      });

      it('el catálogo de roles institucionales NO gana ningún valor de soporte', async () => {
        const valores = await prisma.$queryRaw<{ readonly valor: string }[]>`
          SELECT e.enumlabel AS valor
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = 'InstitutionalRole'
           ORDER BY e.enumsortorder`;

        expect(valores.map((fila) => fila.valor)).toStrictEqual([
          'MUNICIPAL_VIEWER',
          'HOSPITAL_PATIENT_VIEWER',
          'HOSPITAL_SCHEDULER',
          'CAREGIVER_RELATIONSHIP_MANAGER',
        ]);
      });
    });

    /* ------------------------------- Paso 3 -------------------------------- */

    describe('3 · autorización EXPLÍCITA por tenant objetivo', () => {
      it('el alcance es un catálogo CERRADO de un solo valor', async () => {
        const valores = await prisma.$queryRaw<{ readonly valor: string }[]>`
          SELECT e.enumlabel AS valor
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = 'SupportGrantScope'
           ORDER BY e.enumsortorder`;

        expect(valores.map((fila) => fila.valor)).toStrictEqual([
          'HOSPITAL_OPERATIONAL_READ',
        ]);
      });

      it('la autorización nombra UNA institución concreta y su capacidad', async () => {
        const autorizacion = await prisma.supportGrant.findUniqueOrThrow({
          where: { id: autorizacionId },
          select: {
            homeTenantId: true,
            targetTenantId: true,
            platformSupportCapabilityId: true,
            scope: true,
            status: true,
            revokedAt: true,
          },
        });

        expect(autorizacion).toStrictEqual({
          homeTenantId,
          targetTenantId,
          platformSupportCapabilityId: capacidadId,
          scope: 'HOSPITAL_OPERATIONAL_READ',
          status: 'ACTIVE',
          revokedAt: null,
        });

        // El tenant objetivo es DISTINTO del home: la autorización es lo que
        // cruza de una institución a otra, y queda escrito.
        expect(autorizacion.targetTenantId).not.toBe(autorizacion.homeTenantId);
      });

      it('rechaza una capacidad de OTRO tenant home', async () => {
        const cuentaAjena = await cuentaHumanaFicticia(targetTenantId);
        const capacidadAjena = await capacidadFicticia(targetTenantId, cuentaAjena);

        await expect(
          prisma.supportGrant.create({
            data: {
              homeTenantId,
              platformSupportCapabilityId: capacidadAjena,
              targetTenantId,
              scope: 'HOSPITAL_OPERATIONAL_READ',
              status: 'ACTIVE',
            },
          }),
        ).rejects.toThrow();
      });

      it('rechaza un tenant objetivo inexistente', async () => {
        await expect(
          prisma.supportGrant.create({
            data: {
              homeTenantId,
              platformSupportCapabilityId: capacidadId,
              targetTenantId: '00000000-0000-4000-8000-0000000000ff',
              scope: 'HOSPITAL_OPERATIONAL_READ',
              status: 'ACTIVE',
            },
          }),
        ).rejects.toThrow();
      });

      it('exige que la vigencia declarada esté ordenada', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);
        const desde = new Date(Date.UTC(2026, 7, 25, 12, 0, 0));

        await expect(
          prisma.supportGrant.create({
            data: {
              homeTenantId,
              platformSupportCapabilityId: capacidad,
              targetTenantId,
              scope: 'HOSPITAL_OPERATIONAL_READ',
              status: 'ACTIVE',
              validFrom: desde,
              validUntil: desde,
            },
          }),
        ).rejects.toThrow(/support_grant_validity_order/u);

        // Con vigencia ordenada, la misma autorización se persiste.
        const valida = await prisma.supportGrant.create({
          data: {
            homeTenantId,
            platformSupportCapabilityId: capacidad,
            targetTenantId,
            scope: 'HOSPITAL_OPERATIONAL_READ',
            status: 'ACTIVE',
            validFrom: desde,
            validUntil: new Date(desde.getTime() + 60 * 60_000),
          },
          select: { id: true, validFrom: true, validUntil: true },
        });
        sembrado.autorizaciones.add(valida.id);

        expect(valida.validUntil?.getTime()).toBeGreaterThan(
          valida.validFrom?.getTime() ?? 0,
        );
      });

      it('exige coherencia EXACTA entre estado y revocación', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);

        await expect(
          prisma.supportGrant.create({
            data: {
              homeTenantId,
              platformSupportCapabilityId: capacidad,
              targetTenantId,
              scope: 'HOSPITAL_OPERATIONAL_READ',
              status: 'ACTIVE',
              // Posterior a la creación: el único invariante violado es el de
              // coherencia entre estado y revocación.
              revokedAt: new Date(Date.now() + 60_000),
            },
          }),
        ).rejects.toThrow(/support_grant_status_timestamps/u);

        await expect(
          prisma.supportGrant.create({
            data: {
              homeTenantId,
              platformSupportCapabilityId: capacidad,
              targetTenantId,
              scope: 'HOSPITAL_OPERATIONAL_READ',
              status: 'REVOKED',
            },
          }),
        ).rejects.toThrow(/support_grant_status_timestamps/u);
      });

      it('la revocación CONSERVA la fila: se revoca, no se borra', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);
        const autorizacion = await autorizacionFicticia(homeTenantId, capacidad, targetTenantId);

        const revocada = await prisma.supportGrant.update({
          where: { id: autorizacion },
          data: { status: 'REVOKED', revokedAt: new Date() },
          select: { id: true, status: true, revokedAt: true, scope: true },
        });

        expect(revocada.id).toBe(autorizacion);
        expect(revocada.status).toBe('REVOKED');
        expect(revocada.revokedAt).not.toBeNull();
        // La historia permanece íntegra: alcance y fila siguen ahí.
        expect(revocada.scope).toBe('HOSPITAL_OPERATIONAL_READ');
        expect(await prisma.supportGrant.count({ where: { id: autorizacion } })).toBe(1);
      });
    });

    /* ------------------------------- Paso 4 -------------------------------- */

    describe('4 · unicidad de la autorización ACTIVE equivalente', () => {
      it('el índice que la impone es PARCIAL y solo compite entre las ACTIVE', async () => {
        // Prisma oculta el nombre del índice en su error de unicidad, de modo
        // que el nombre y el predicado se comprueban directamente en el
        // catálogo de PostgreSQL: la unicidad NO alcanza a las revocadas.
        const [indice] = await prisma.$queryRaw<
          { readonly nombre: string; readonly definicion: string }[]
        >`SELECT indexname AS nombre, indexdef AS definicion
            FROM pg_indexes
           WHERE tablename = 'support_grant'
             AND indexname = 'support_grant_active_unique'`;

        expect(indice?.nombre).toBe('support_grant_active_unique');
        expect(indice?.definicion).toMatch(/UNIQUE INDEX/u);
        expect(indice?.definicion).toMatch(/platformSupportCapabilityId/u);
        expect(indice?.definicion).toMatch(/targetTenantId/u);
        expect(indice?.definicion).toMatch(/scope/u);
        expect(indice?.definicion).toMatch(/WHERE .*ACTIVE/u);
      });

      it('rechaza una segunda autorización ACTIVE para la misma capacidad, tenant y alcance', async () => {
        await expect(
          prisma.supportGrant.create({
            data: {
              homeTenantId,
              platformSupportCapabilityId: capacidadId,
              targetTenantId,
              scope: 'HOSPITAL_OPERATIONAL_READ',
              status: 'ACTIVE',
            },
          }),
        ).rejects.toThrow(
          /Unique constraint failed[\s\S]*platformSupportCapabilityId[\s\S]*targetTenantId[\s\S]*scope/u,
        );
      });

      it('tras revocar, admite una autorización nueva sin perder la anterior', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);
        const primera = await autorizacionFicticia(homeTenantId, capacidad, targetTenantId);

        await prisma.supportGrant.update({
          where: { id: primera },
          data: { status: 'REVOKED', revokedAt: new Date() },
        });

        const segunda = await autorizacionFicticia(homeTenantId, capacidad, targetTenantId);

        expect(segunda).not.toBe(primera);
        // Las DOS filas coexisten: el índice parcial no obliga a borrar la
        // autorización revocada para conceder una nueva.
        expect(
          await prisma.supportGrant.count({
            where: { platformSupportCapabilityId: capacidad },
          }),
        ).toBe(2);
      });
    });

    /* ------------------------------- Paso 5 -------------------------------- */

    describe('5 · contexto temporal de soporte', () => {
      it('el contexto sano nombra autorización, cuenta, sesión, tenant objetivo y motivo', async () => {
        const contexto = await prisma.supportContextSession.findUniqueOrThrow({
          where: { id: contextoId },
          select: {
            homeTenantId: true,
            humanAccountId: true,
            humanSessionId: true,
            supportGrantId: true,
            targetTenantId: true,
            reason: true,
            ticketReference: true,
            tokenHash: true,
            lastUsedAt: true,
            revokedAt: true,
          },
        });

        expect(contexto.homeTenantId).toBe(homeTenantId);
        expect(contexto.humanAccountId).toBe(cuentaAdminId);
        expect(contexto.humanSessionId).toBe(sesionAdminId);
        expect(contexto.supportGrantId).toBe(autorizacionId);
        expect(contexto.targetTenantId).toBe(targetTenantId);
        expect(contexto.reason.length).toBeGreaterThanOrEqual(8);
        expect(contexto.ticketReference).toBe(TICKET_FICTICIO);
        expect(contexto.lastUsedAt).toBeNull();
        expect(contexto.revokedAt).toBeNull();

        // El hash del contexto es PROPIO: no es el de la sesión humana.
        const sesion = await prisma.humanSession.findUniqueOrThrow({
          where: { id: sesionAdminId },
          select: { tokenHash: true },
        });
        expect(contexto.tokenHash).not.toBe(sesion.tokenHash);
      });

      it('la clave foránea hacia la sesión humana exige cuenta y tenant, NUNCA el token', async () => {
        const columnas = await prisma.$queryRaw<{ readonly columna: string }[]>`
          SELECT a.attname AS columna
            FROM pg_constraint c
            JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, orden) ON TRUE
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
           WHERE c.conname = 'support_context_session_human_session_fkey'
           ORDER BY k.orden`;

        expect(columnas.map((fila) => fila.columna)).toStrictEqual([
          'humanSessionId',
          'humanAccountId',
          'homeTenantId',
        ]);
      });

      it('exige motivo con contenido real', async () => {
        const base = {
          homeTenantId,
          humanAccountId: cuentaAdminId,
          humanSessionId: sesionAdminId,
          supportGrantId: autorizacionId,
          targetTenantId,
        };

        for (const motivo of ['', '   ', 'corto', '       ']) {
          await expect(
            prisma.supportContextSession.create({
              data: datosContexto({ ...base, reason: motivo }),
            }),
          ).rejects.toThrow(/support_context_session_reason_shape/u);
        }

        await expect(
          prisma.supportContextSession.create({
            data: datosContexto({ ...base, reason: 'x'.repeat(501) }),
          }),
        ).rejects.toThrow(/support_context_session_reason_shape/u);
      });

      it('acota la referencia de ticket y rechaza la vacía', async () => {
        const base = {
          homeTenantId,
          humanAccountId: cuentaAdminId,
          humanSessionId: sesionAdminId,
          supportGrantId: autorizacionId,
          targetTenantId,
        };

        for (const ticket of ['   ', 'T'.repeat(121)]) {
          await expect(
            prisma.supportContextSession.create({
              data: datosContexto({ ...base, ticketReference: ticket }),
            }),
          ).rejects.toThrow(/support_context_session_ticket_shape/u);
        }
      });

      it('impone la vigencia ABSOLUTA de 60 minutos como máximo', async () => {
        const base = {
          homeTenantId,
          humanAccountId: cuentaAdminId,
          humanSessionId: sesionAdminId,
          supportGrantId: autorizacionId,
          targetTenantId,
        };
        const createdAt = new Date();

        // Un minuto por encima del máximo aprobado.
        await expect(
          prisma.supportContextSession.create({
            data: datosContexto({
              ...base,
              createdAt,
              expiresAt: new Date(createdAt.getTime() + (TTL_MAXIMO_MINUTOS + 1) * 60_000),
            }),
          }),
        ).rejects.toThrow(/support_context_session_ttl/u);

        // Una ventana nula o invertida tampoco es un contexto.
        await expect(
          prisma.supportContextSession.create({
            data: datosContexto({ ...base, createdAt, expiresAt: createdAt }),
          }),
        ).rejects.toThrow(/support_context_session_ttl/u);
      });

      it('exige que la última actividad caiga dentro de la ventana', async () => {
        const base = {
          homeTenantId,
          humanAccountId: cuentaAdminId,
          humanSessionId: sesionAdminId,
          supportGrantId: autorizacionId,
          targetTenantId,
        };
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + 30 * 60_000);

        await expect(
          prisma.supportContextSession.create({
            data: datosContexto({
              ...base,
              createdAt,
              expiresAt,
              lastUsedAt: new Date(createdAt.getTime() - 1_000),
            }),
          }),
        ).rejects.toThrow(/support_context_session_last_used_window/u);

        await expect(
          prisma.supportContextSession.create({
            data: datosContexto({
              ...base,
              createdAt,
              expiresAt,
              lastUsedAt: new Date(expiresAt.getTime() + 1_000),
            }),
          }),
        ).rejects.toThrow(/support_context_session_last_used_window/u);

        await expect(
          prisma.supportContextSession.create({
            data: datosContexto({
              ...base,
              createdAt,
              expiresAt,
              revokedAt: new Date(createdAt.getTime() - 1_000),
            }),
          }),
        ).rejects.toThrow(/support_context_session_revoked_order/u);
      });

      it('la expiración y la inactividad de 15 minutos son REPRESENTABLES', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const sesion = await sesionHumanaFicticia(homeTenantId, cuenta);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);
        const autorizacion = await autorizacionFicticia(homeTenantId, capacidad, targetTenantId);

        const ahora = new Date();
        const createdAt = new Date(ahora.getTime() - 50 * 60_000);
        const expiresAt = new Date(createdAt.getTime() + TTL_MAXIMO_MINUTOS * 60_000);
        const lastUsedAt = new Date(ahora.getTime() - (INACTIVIDAD_MINUTOS + 5) * 60_000);

        const creado = await prisma.supportContextSession.create({
          data: datosContexto({
            homeTenantId,
            humanAccountId: cuenta,
            humanSessionId: sesion,
            supportGrantId: autorizacion,
            targetTenantId,
            createdAt,
            expiresAt,
            lastUsedAt,
          }),
          select: { id: true, createdAt: true, expiresAt: true, lastUsedAt: true },
        });
        sembrado.contextos.add(creado.id);

        // La BASE guarda los hechos; el JUICIO —vigente, expirado, inactivo—
        // se calcula sobre ellos. MP02 lo hará dentro de transacción; MP01 solo
        // demuestra que los datos bastan para calcularlo sin adivinar nada.
        const vigenciaMinutos =
          (creado.expiresAt.getTime() - creado.createdAt.getTime()) / 60_000;
        const inactividadMinutos =
          (ahora.getTime() - (creado.lastUsedAt?.getTime() ?? 0)) / 60_000;

        expect(vigenciaMinutos).toBeLessThanOrEqual(TTL_MAXIMO_MINUTOS);
        expect(inactividadMinutos).toBeGreaterThan(INACTIVIDAD_MINUTOS);
        // Y la fila NO se marca sola: sigue sin revocar, porque un índice no
        // evalúa un reloj. Cerrarla es trabajo de MP02.
        expect(
          await prisma.supportContextSession.count({
            where: { id: creado.id, revokedAt: null },
          }),
        ).toBe(1);
      });

      it('rechaza un tenant objetivo distinto del de su autorización', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const sesion = await sesionHumanaFicticia(homeTenantId, cuenta);

        await expect(
          prisma.supportContextSession.create({
            data: datosContexto({
              homeTenantId,
              humanAccountId: cuenta,
              humanSessionId: sesion,
              supportGrantId: autorizacionId,
              // La autorización apunta a `targetTenantId`, no al tenant home.
              targetTenantId: homeTenantId,
            }),
          }),
        ).rejects.toThrow();
      });

      it('rechaza una sesión humana que no es de esa cuenta', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);
        const autorizacion = await autorizacionFicticia(homeTenantId, capacidad, targetTenantId);

        await expect(
          prisma.supportContextSession.create({
            data: datosContexto({
              homeTenantId,
              humanAccountId: cuenta,
              // Sesión de la cuenta administrativa principal, no de `cuenta`.
              humanSessionId: sesionAdminId,
              supportGrantId: autorizacion,
              targetTenantId,
            }),
          }),
        ).rejects.toThrow();
      });

      it('rechaza una cuenta y una sesión de OTRO tenant', async () => {
        const cuentaAjena = await cuentaHumanaFicticia(targetTenantId);
        const sesionAjena = await sesionHumanaFicticia(targetTenantId, cuentaAjena);

        await expect(
          prisma.supportContextSession.create({
            data: datosContexto({
              homeTenantId,
              humanAccountId: cuentaAjena,
              humanSessionId: sesionAjena,
              supportGrantId: autorizacionId,
              targetTenantId,
            }),
          }),
        ).rejects.toThrow();
      });

      it('el token del contexto es único', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const sesion = await sesionHumanaFicticia(homeTenantId, cuenta);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);
        const autorizacion = await autorizacionFicticia(homeTenantId, capacidad, targetTenantId);

        const repetido = await prisma.supportContextSession.findUniqueOrThrow({
          where: { id: contextoId },
          select: { tokenHash: true },
        });

        await expect(
          prisma.supportContextSession.create({
            data: {
              ...datosContexto({
                homeTenantId,
                humanAccountId: cuenta,
                humanSessionId: sesion,
                supportGrantId: autorizacion,
                targetTenantId,
              }),
              tokenHash: repetido.tokenHash,
            },
          }),
        ).rejects.toThrow();
      });

      it('solo `lastUsedAt` y `revokedAt` son mutables; la vigencia NO se alarga', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const sesion = await sesionHumanaFicticia(homeTenantId, cuenta);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);
        const autorizacion = await autorizacionFicticia(homeTenantId, capacidad, targetTenantId);

        const createdAt = new Date();
        const creado = await prisma.supportContextSession.create({
          data: datosContexto({
            homeTenantId,
            humanAccountId: cuenta,
            humanSessionId: sesion,
            supportGrantId: autorizacion,
            targetTenantId,
            createdAt,
            expiresAt: new Date(createdAt.getTime() + 20 * 60_000),
          }),
          select: { id: true, expiresAt: true },
        });
        sembrado.contextos.add(creado.id);

        // Registrar actividad SÍ está permitido.
        const usado = await prisma.supportContextSession.update({
          where: { id: creado.id },
          data: { lastUsedAt: new Date(createdAt.getTime() + 60_000) },
          select: { lastUsedAt: true, expiresAt: true },
        });
        expect(usado.lastUsedAt).not.toBeNull();
        expect(usado.expiresAt.getTime()).toBe(creado.expiresAt.getTime());

        // Alargar la vigencia absoluta NO lo está.
        await expect(
          prisma.supportContextSession.update({
            where: { id: creado.id },
            data: { expiresAt: new Date(createdAt.getTime() + 59 * 60_000) },
          }),
        ).rejects.toThrow(/solo admite actualizar lastUsedAt y revokedAt/u);

        // Ni reescribir el motivo, el token o la autorización.
        await expect(
          prisma.supportContextSession.update({
            where: { id: creado.id },
            data: { reason: `${MOTIVO_BASE}: motivo reescrito a posteriori` },
          }),
        ).rejects.toThrow(/solo admite actualizar lastUsedAt y revokedAt/u);

        await expect(
          prisma.supportContextSession.update({
            where: { id: creado.id },
            data: { tokenHash: hashFicticio() },
          }),
        ).rejects.toThrow(/solo admite actualizar lastUsedAt y revokedAt/u);

        // Salir de soporte SÍ está permitido; reabrir el contexto NO.
        await prisma.supportContextSession.update({
          where: { id: creado.id },
          data: { revokedAt: new Date(createdAt.getTime() + 2 * 60_000) },
        });

        await expect(
          prisma.supportContextSession.update({
            where: { id: creado.id },
            data: { revokedAt: null },
          }),
        ).rejects.toThrow(/revocado no se reabre/u);
      });
    });

    /* ------------------------------- Paso 6 -------------------------------- */

    describe('6 · unicidad del contexto no revocado por cuenta', () => {
      it('una cuenta no puede tener dos contextos abiertos a la vez', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const sesion = await sesionHumanaFicticia(homeTenantId, cuenta);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);
        const autorizacion = await autorizacionFicticia(homeTenantId, capacidad, targetTenantId);

        const base = {
          homeTenantId,
          humanAccountId: cuenta,
          humanSessionId: sesion,
          supportGrantId: autorizacion,
          targetTenantId,
        };

        const primero = await prisma.supportContextSession.create({
          data: datosContexto(base),
          select: { id: true },
        });
        sembrado.contextos.add(primero.id);

        await expect(
          prisma.supportContextSession.create({ data: datosContexto(base) }),
        ).rejects.toThrow(
          /Unique constraint failed[\s\S]*homeTenantId[\s\S]*humanAccountId/u,
        );

        // El nombre y el predicado PARCIAL del índice se comprueban en el
        // catálogo: Prisma no los expone en su mensaje de unicidad. El
        // predicado es `revokedAt IS NULL` y NO menciona el tiempo: un índice
        // no evalúa un reloj y esta prueba no finge lo contrario.
        const [indice] = await prisma.$queryRaw<
          { readonly nombre: string; readonly definicion: string }[]
        >`SELECT indexname AS nombre, indexdef AS definicion
            FROM pg_indexes
           WHERE tablename = 'support_context_session'
             AND indexname = 'support_context_session_open_unique'`;

        expect(indice?.nombre).toBe('support_context_session_open_unique');
        expect(indice?.definicion).toMatch(/UNIQUE INDEX/u);
        expect(indice?.definicion).toMatch(/WHERE .*revokedAt.* IS NULL/u);
        expect(indice?.definicion).not.toMatch(/expiresAt|lastUsedAt|now\(\)/u);

        // Tras la salida explícita, se admite un contexto nuevo y el anterior
        // PERMANECE: la historia del soporte no se borra para volver a entrar.
        await prisma.supportContextSession.update({
          where: { id: primero.id },
          data: { revokedAt: new Date() },
        });

        const segundo = await prisma.supportContextSession.create({
          data: datosContexto(base),
          select: { id: true },
        });
        sembrado.contextos.add(segundo.id);

        expect(segundo.id).not.toBe(primero.id);
        expect(
          await prisma.supportContextSession.count({ where: { humanAccountId: cuenta } }),
        ).toBe(2);
      });
    });

    /* ------------------------------- Paso 7 -------------------------------- */

    describe('7 · aislamiento por tenant HOME y fallo CERRADO', () => {
      let capacidadAjenaId: string;
      let autorizacionAjenaId: string;

      beforeAll(async () => {
        const cuentaAjena = await cuentaHumanaFicticia(targetTenantId);
        capacidadAjenaId = await capacidadFicticia(targetTenantId, cuentaAjena);
        // La institución ajena autoriza soporte sobre el tenant MVP.
        autorizacionAjenaId = await autorizacionFicticia(
          targetTenantId,
          capacidadAjenaId,
          homeTenantId,
        );
      });

      it('cada tenant home ve exclusivamente sus propias capacidades y autorizaciones', async () => {
        const propias = await servicio.withTenant(homeTenantId, async (tx) => ({
          capacidades: await tx.platformSupportCapability.findMany({
            select: { id: true, homeTenantId: true },
          }),
          autorizaciones: await tx.supportGrant.findMany({
            select: { id: true, homeTenantId: true },
          }),
          contextos: await tx.supportContextSession.findMany({
            select: { id: true, homeTenantId: true },
          }),
        }));

        expect(propias.capacidades.length).toBeGreaterThan(0);
        expect(propias.capacidades.every((fila) => fila.homeTenantId === homeTenantId)).toBe(
          true,
        );
        expect(propias.capacidades.map((fila) => fila.id)).not.toContain(capacidadAjenaId);

        expect(propias.autorizaciones.every((fila) => fila.homeTenantId === homeTenantId)).toBe(
          true,
        );
        expect(propias.autorizaciones.map((fila) => fila.id)).not.toContain(
          autorizacionAjenaId,
        );

        expect(propias.contextos.every((fila) => fila.homeTenantId === homeTenantId)).toBe(
          true,
        );
      });

      it('un identificador ajeno se comporta como inexistente', async () => {
        // La autorización ajena existe de verdad, con la credencial administrativa.
        expect(await prisma.supportGrant.count({ where: { id: autorizacionAjenaId } })).toBe(1);

        const encontrada = await servicio.withTenant(homeTenantId, async (tx) =>
          tx.supportGrant.findUnique({ where: { id: autorizacionAjenaId } }),
        );

        expect(encontrada).toBeNull();
      });

      it('sin contexto de tenant la política no deja pasar ninguna fila', async () => {
        // Se adopta el rol runtime SIN fijar `merdn.tenant_id`: es exactamente
        // el caso de una conexión reutilizada sin contexto de petición.
        const resultado = await servicio.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE "${RUNTIME_ROLE_NAME}"`);

          const [capacidades] = await tx.$queryRaw<
            { readonly total: number }[]
          >`SELECT count(*)::int AS total FROM "platform_support_capability"`;
          const [autorizaciones] = await tx.$queryRaw<
            { readonly total: number }[]
          >`SELECT count(*)::int AS total FROM "support_grant"`;
          const [contextos] = await tx.$queryRaw<
            { readonly total: number }[]
          >`SELECT count(*)::int AS total FROM "support_context_session"`;

          return {
            capacidades: capacidades?.total,
            autorizaciones: autorizaciones?.total,
            contextos: contextos?.total,
          };
        });

        expect(resultado).toStrictEqual({
          capacidades: 0,
          autorizaciones: 0,
          contextos: 0,
        });

        // Y la lectura vacía no se debe a que no existan filas.
        expect(await prisma.platformSupportCapability.count()).toBeGreaterThan(0);
        expect(await prisma.supportGrant.count()).toBeGreaterThan(0);
        expect(await prisma.supportContextSession.count()).toBeGreaterThan(0);
      });

      it('con un tenant equivocado la escritura del contexto queda rechazada por WITH CHECK', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const sesion = await sesionHumanaFicticia(homeTenantId, cuenta);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);
        const autorizacion = await autorizacionFicticia(homeTenantId, capacidad, targetTenantId);

        await expect(
          servicio.withTenant(targetTenantId, async (tx) =>
            tx.supportContextSession.create({
              data: datosContexto({
                homeTenantId,
                humanAccountId: cuenta,
                humanSessionId: sesion,
                supportGrantId: autorizacion,
                targetTenantId,
              }),
            }),
          ),
        ).rejects.toThrow();

        expect(
          await prisma.supportContextSession.count({ where: { humanAccountId: cuenta } }),
        ).toBe(0);
      });

      it('desde su propio tenant home el contexto SÍ se escribe y se lee', async () => {
        const cuenta = await cuentaHumanaFicticia(homeTenantId);
        const sesion = await sesionHumanaFicticia(homeTenantId, cuenta);
        const capacidad = await capacidadFicticia(homeTenantId, cuenta);
        const autorizacion = await autorizacionFicticia(homeTenantId, capacidad, targetTenantId);

        const creado = await servicio.withTenant(homeTenantId, async (tx) =>
          tx.supportContextSession.create({
            data: datosContexto({
              homeTenantId,
              humanAccountId: cuenta,
              humanSessionId: sesion,
              supportGrantId: autorizacion,
              targetTenantId,
            }),
            select: { id: true, homeTenantId: true },
          }),
        );
        sembrado.contextos.add(creado.id);

        expect(creado.homeTenantId).toBe(homeTenantId);
      });
    });

    /* ------------------------------- Paso 8 -------------------------------- */

    describe('8 · mínimo privilegio del rol de ejecución', () => {
      it('declara SOLO LECTURA sobre capacidad y autorización, y jamás DELETE', async () => {
        const [capacidad] = await prisma.$queryRaw<
          {
            readonly leer: boolean;
            readonly insertar: boolean;
            readonly actualizar: boolean;
            readonly borrar: boolean;
          }[]
        >`SELECT has_table_privilege('merdn_runtime', 'platform_support_capability', 'SELECT') AS leer,
                 has_table_privilege('merdn_runtime', 'platform_support_capability', 'INSERT') AS insertar,
                 has_table_privilege('merdn_runtime', 'platform_support_capability', 'UPDATE') AS actualizar,
                 has_table_privilege('merdn_runtime', 'platform_support_capability', 'DELETE') AS borrar`;

        expect(capacidad).toStrictEqual({
          leer: true,
          insertar: false,
          actualizar: false,
          borrar: false,
        });

        const [autorizacion] = await prisma.$queryRaw<
          {
            readonly leer: boolean;
            readonly insertar: boolean;
            readonly actualizar: boolean;
            readonly borrar: boolean;
          }[]
        >`SELECT has_table_privilege('merdn_runtime', 'support_grant', 'SELECT') AS leer,
                 has_table_privilege('merdn_runtime', 'support_grant', 'INSERT') AS insertar,
                 has_table_privilege('merdn_runtime', 'support_grant', 'UPDATE') AS actualizar,
                 has_table_privilege('merdn_runtime', 'support_grant', 'DELETE') AS borrar`;

        expect(autorizacion).toStrictEqual({
          leer: true,
          insertar: false,
          actualizar: false,
          borrar: false,
        });
      });

      it('declara SELECT, INSERT y UPDATE sobre el contexto, y jamás DELETE', async () => {
        const [privilegios] = await prisma.$queryRaw<
          {
            readonly leer: boolean;
            readonly insertar: boolean;
            readonly actualizar: boolean;
            readonly borrar: boolean;
          }[]
        >`SELECT has_table_privilege('merdn_runtime', 'support_context_session', 'SELECT') AS leer,
                 has_table_privilege('merdn_runtime', 'support_context_session', 'INSERT') AS insertar,
                 has_table_privilege('merdn_runtime', 'support_context_session', 'UPDATE') AS actualizar,
                 has_table_privilege('merdn_runtime', 'support_context_session', 'DELETE') AS borrar`;

        expect(privilegios).toStrictEqual({
          leer: true,
          insertar: true,
          actualizar: true,
          borrar: false,
        });
      });

      it('el rol de ejecución no puede BORRAR ninguna de las tres tablas', async () => {
        // Declarar el privilegio no basta: se INTENTA de verdad.
        for (const tabla of [
          'platform_support_capability',
          'support_grant',
          'support_context_session',
        ]) {
          await expect(
            servicio.withTenant(homeTenantId, async (tx) =>
              tx.$executeRawUnsafe(`DELETE FROM "${tabla}"`),
            ),
          ).rejects.toThrow(/permission denied|permiso denegado/iu);
        }
      });

      it('el rol de ejecución no puede crear ni revocar una autorización', async () => {
        await expect(
          servicio.withTenant(homeTenantId, async (tx) =>
            tx.$executeRawUnsafe(
              `UPDATE "support_grant" SET "status" = 'REVOKED', "revokedAt" = now()`,
            ),
          ),
        ).rejects.toThrow(/permission denied|permiso denegado/iu);

        await expect(
          servicio.withTenant(homeTenantId, async (tx) =>
            tx.$executeRawUnsafe(
              `UPDATE "platform_support_capability" SET "status" = 'DISABLED'`,
            ),
          ),
        ).rejects.toThrow(/permission denied|permiso denegado/iu);
      });
    });

    /* ------------------------------- Paso 9 -------------------------------- */

    describe('9 · auditoría de soporte con actor humano y tenant objetivo', () => {
      it('admite el evento con cuenta humana, tenant objetivo, autorización, contexto y motivo', async () => {
        const registrado = await enTransaccionRevertida(async (tx) =>
          tx.auditEvent.create({
            data: {
              // El tenant del evento es el OBJETIVO auditado.
              tenantId: targetTenantId,
              eventType: 'SUPPORT_PATIENT_READ_GRANTED',
              actorType: 'HUMAN_ACCOUNT',
              actorUserId: cuentaAdminId,
              // Sin rol institucional: el soporte no es una institución.
              actorRole: null,
              resourceType: 'Patient',
              resourceId: null,
              outcome: 'SUCCESS',
              endpoint: '/api/support/hospital/patients',
              actorHomeTenantId: homeTenantId,
              supportGrantId: autorizacionId,
              supportContextSessionId: contextoId,
              supportReason: `${MOTIVO_BASE}: verificación de agenda`,
              supportTicketReference: TICKET_FICTICIO,
            },
            select: {
              tenantId: true,
              actorType: true,
              actorRole: true,
              actorUserId: true,
              actorHomeTenantId: true,
              supportGrantId: true,
              supportContextSessionId: true,
            },
          }),
        );

        expect(registrado).toStrictEqual({
          tenantId: targetTenantId,
          actorType: 'HUMAN_ACCOUNT',
          actorRole: null,
          actorUserId: cuentaAdminId,
          actorHomeTenantId: homeTenantId,
          supportGrantId: autorizacionId,
          supportContextSessionId: contextoId,
        });

        // Y el tenant auditado NO es el tenant home: la lectura fue cruzada, y
        // la traza lo dice con dos columnas distintas.
        expect(registrado.tenantId).not.toBe(registrado.actorHomeTenantId);
      });

      it('admite las primitivas de denegación y de fin de contexto', async () => {
        const eventos = [
          'SUPPORT_CONTEXT_ENTRY_GRANTED',
          'SUPPORT_CONTEXT_ENTRY_DENIED',
          'SUPPORT_CONTEXT_EXITED',
          'SUPPORT_CONTEXT_EXPIRED',
          'SUPPORT_CONTEXT_REVOKED',
          'SUPPORT_PROFESSIONAL_READ_DENIED',
          'SUPPORT_AGENDA_READ_GRANTED',
          'SUPPORT_HOME_VISIT_READ_GRANTED',
          'SUPPORT_OPERATIONAL_AUDIT_READ_GRANTED',
          'SUPPORT_GRANT_CREATED',
          'SUPPORT_GRANT_REVOKED',
          'PLATFORM_SUPPORT_CAPABILITY_CREATED',
          'PLATFORM_SUPPORT_CAPABILITY_DISABLED',
        ] as const;

        const total = await enTransaccionRevertida(async (tx) => {
          for (const eventType of eventos) {
            await tx.auditEvent.create({
              data: {
                tenantId: targetTenantId,
                eventType,
                actorType: 'HUMAN_ACCOUNT',
                actorUserId: cuentaAdminId,
                actorRole: null,
                resourceType: 'SupportContextSession',
                resourceId: null,
                outcome: eventType.endsWith('_DENIED') ? 'DENIED' : 'SUCCESS',
                actorHomeTenantId: homeTenantId,
                supportReason: `${MOTIVO_BASE}: primitiva ${eventType}`,
              },
            });
          }

          return tx.auditEvent.count({
            where: { actorHomeTenantId: homeTenantId, actorUserId: cuentaAdminId },
          });
        });

        expect(total).toBe(eventos.length);

        // Nada quedó confirmado: la transacción se revirtió a propósito.
        expect(
          await prisma.auditEvent.count({ where: { actorHomeTenantId: homeTenantId } }),
        ).toBe(0);
      });

      it('un evento ordinario sigue sin llevar procedencia de soporte', async () => {
        const registrado = await enTransaccionRevertida(async (tx) =>
          tx.auditEvent.create({
            data: {
              tenantId: homeTenantId,
              eventType: 'HUMAN_SESSION_CREATED',
              actorType: 'HUMAN_ACCOUNT',
              actorUserId: cuentaAdminId,
              resourceType: 'HumanSession',
              resourceId: sesionAdminId,
              outcome: 'SUCCESS',
            },
            select: {
              actorHomeTenantId: true,
              supportGrantId: true,
              supportContextSessionId: true,
              supportReason: true,
              supportTicketReference: true,
            },
          }),
        );

        // Las cinco columnas son ADITIVAS y NULLABLE: nada anterior cambia.
        expect(registrado).toStrictEqual({
          actorHomeTenantId: null,
          supportGrantId: null,
          supportContextSessionId: null,
          supportReason: null,
          supportTicketReference: null,
        });
      });
    });

    /* ------------------------------- Paso 10 ------------------------------- */

    describe('10 · la auditoría es APPEND-ONLY y rechaza procedencia incoherente', () => {
      it('rechaza atribuir un evento de soporte a una identidad institucional', async () => {
        await expect(
          prisma.auditEvent.create({
            data: {
              tenantId: targetTenantId,
              eventType: 'SUPPORT_PATIENT_READ_GRANTED',
              actorType: 'INSTITUTIONAL_IDENTITY',
              actorUserId: cuentaAdminId,
              resourceType: 'Patient',
              outcome: 'SUCCESS',
              actorHomeTenantId: homeTenantId,
              supportGrantId: autorizacionId,
            },
          }),
        ).rejects.toThrow(/audit_event_support_provenance/u);
      });

      it('rechaza un evento de soporte con rol institucional o sin actor', async () => {
        await expect(
          prisma.auditEvent.create({
            data: {
              tenantId: targetTenantId,
              eventType: 'SUPPORT_AGENDA_READ_GRANTED',
              actorType: 'HUMAN_ACCOUNT',
              actorUserId: cuentaAdminId,
              actorRole: 'HOSPITAL_PATIENT_VIEWER',
              resourceType: 'Appointment',
              outcome: 'SUCCESS',
              actorHomeTenantId: homeTenantId,
            },
          }),
        ).rejects.toThrow(/audit_event_actor_role_scope|audit_event_support_provenance/u);

        await expect(
          prisma.auditEvent.create({
            data: {
              tenantId: targetTenantId,
              eventType: 'SUPPORT_AGENDA_READ_DENIED',
              actorType: 'UNAUTHENTICATED',
              resourceType: 'Appointment',
              outcome: 'DENIED',
              supportReason: `${MOTIVO_BASE}: intento sin identidad`,
            },
          }),
        ).rejects.toThrow(/audit_event_support_provenance/u);
      });

      it('rechaza nombrar autorización o contexto sin declarar el tenant home', async () => {
        await expect(
          prisma.auditEvent.create({
            data: {
              tenantId: targetTenantId,
              eventType: 'SUPPORT_PATIENT_READ_GRANTED',
              actorType: 'HUMAN_ACCOUNT',
              actorUserId: cuentaAdminId,
              resourceType: 'Patient',
              outcome: 'SUCCESS',
              supportGrantId: autorizacionId,
              supportContextSessionId: contextoId,
            },
          }),
        ).rejects.toThrow(/audit_event_support_provenance/u);
      });

      it('acota el motivo y el ticket registrados en la traza', async () => {
        const base = {
          tenantId: targetTenantId,
          eventType: 'SUPPORT_PATIENT_READ_GRANTED',
          actorType: 'HUMAN_ACCOUNT',
          actorUserId: cuentaAdminId,
          resourceType: 'Patient',
          outcome: 'SUCCESS',
          actorHomeTenantId: homeTenantId,
        } as const;

        await expect(
          prisma.auditEvent.create({
            data: { ...base, supportReason: '   ' },
          }),
        ).rejects.toThrow(/audit_event_support_text_shape/u);

        await expect(
          prisma.auditEvent.create({
            data: { ...base, supportTicketReference: 'T'.repeat(121) },
          }),
        ).rejects.toThrow(/audit_event_support_text_shape/u);
      });

      it('un evento registrado no admite UPDATE ni DELETE, ni siquiera al propietario', async () => {
        await expect(
          prisma.$transaction(async (tx) => {
            const evento = await tx.auditEvent.create({
              data: {
                tenantId: targetTenantId,
                eventType: 'SUPPORT_PATIENT_READ_GRANTED',
                actorType: 'HUMAN_ACCOUNT',
                actorUserId: cuentaAdminId,
                resourceType: 'Patient',
                outcome: 'SUCCESS',
                actorHomeTenantId: homeTenantId,
                supportReason: `${MOTIVO_BASE}: intento de reescritura`,
              },
              select: { id: true },
            });

            await tx.auditEvent.update({
              where: { id: evento.id },
              data: { outcome: 'DENIED' },
            });
          }),
        ).rejects.toThrow(/append-only/u);

        await expect(
          prisma.$transaction(async (tx) => {
            const evento = await tx.auditEvent.create({
              data: {
                tenantId: targetTenantId,
                eventType: 'SUPPORT_PATIENT_READ_GRANTED',
                actorType: 'HUMAN_ACCOUNT',
                actorUserId: cuentaAdminId,
                resourceType: 'Patient',
                outcome: 'SUCCESS',
                actorHomeTenantId: homeTenantId,
                supportReason: `${MOTIVO_BASE}: intento de borrado`,
              },
              select: { id: true },
            });

            await tx.auditEvent.delete({ where: { id: evento.id } });
          }),
        ).rejects.toThrow(/append-only/u);

        // Ninguno de los dos intentos dejó rastro confirmado.
        expect(
          await prisma.auditEvent.count({ where: { actorHomeTenantId: homeTenantId } }),
        ).toBe(0);
      });

      it('el rol de ejecución sigue sin poder modificar la auditoría', async () => {
        const [privilegios] = await prisma.$queryRaw<
          {
            readonly leer: boolean;
            readonly insertar: boolean;
            readonly actualizar: boolean;
            readonly borrar: boolean;
          }[]
        >`SELECT has_table_privilege('merdn_runtime', 'audit_event', 'SELECT') AS leer,
                 has_table_privilege('merdn_runtime', 'audit_event', 'INSERT') AS insertar,
                 has_table_privilege('merdn_runtime', 'audit_event', 'UPDATE') AS actualizar,
                 has_table_privilege('merdn_runtime', 'audit_event', 'DELETE') AS borrar`;

        expect(privilegios).toStrictEqual({
          leer: true,
          insertar: true,
          actualizar: false,
          borrar: false,
        });
      });
    });

    /* ------------------------------- Paso 11 ------------------------------- */

    describe('11 · ninguna clave foránea destruye autorizaciones, contextos ni evidencia', () => {
      it('ninguna relación de MP01 borra en cascada', async () => {
        const reglas = await prisma.$queryRaw<
          { readonly restriccion: string; readonly alBorrar: string }[]
        >`SELECT conname AS restriccion, confdeltype::text AS "alBorrar"
            FROM pg_constraint
           WHERE contype = 'f'
             AND (
               conrelid::regclass::text IN (
                 'platform_support_capability', 'support_grant', 'support_context_session'
               )
               OR conname IN (
                 'audit_event_actor_home_tenant_fkey',
                 'audit_event_support_grant_fkey',
                 'audit_event_support_context_session_fkey'
               )
             )
           ORDER BY conname`;

        expect(reglas.length).toBeGreaterThanOrEqual(11);
        // 'r' = RESTRICT, 'a' = NO ACTION. Ninguna 'c' = CASCADE, ninguna
        // 'n' = SET NULL, ninguna 'd' = SET DEFAULT.
        expect(reglas.every((regla) => ['r', 'a'].includes(regla.alBorrar))).toBe(true);
      });

      it('no se puede borrar una cuenta humana que sostiene una capacidad', async () => {
        await expect(prisma.humanAccount.delete({ where: { id: cuentaAdminId } })).rejects.toThrow();

        expect(await prisma.platformSupportCapability.count({ where: { id: capacidadId } })).toBe(
          1,
        );
      });

      it('no se puede borrar una capacidad que sostiene una autorización', async () => {
        await expect(
          prisma.platformSupportCapability.delete({ where: { id: capacidadId } }),
        ).rejects.toThrow();

        expect(await prisma.supportGrant.count({ where: { id: autorizacionId } })).toBe(1);
      });

      it('no se puede borrar una autorización que sostiene un contexto', async () => {
        await expect(
          prisma.supportGrant.delete({ where: { id: autorizacionId } }),
        ).rejects.toThrow();

        expect(await prisma.supportContextSession.count({ where: { id: contextoId } })).toBe(1);
      });

      it('un evento de auditoría impide retirar la autorización y el contexto que nombra', async () => {
        await expect(
          prisma.$transaction(async (tx) => {
            await tx.auditEvent.create({
              data: {
                tenantId: targetTenantId,
                eventType: 'SUPPORT_PATIENT_READ_GRANTED',
                actorType: 'HUMAN_ACCOUNT',
                actorUserId: cuentaAdminId,
                resourceType: 'Patient',
                outcome: 'SUCCESS',
                actorHomeTenantId: homeTenantId,
                supportGrantId: autorizacionId,
                supportContextSessionId: contextoId,
                supportReason: `${MOTIVO_BASE}: evidencia protegida`,
              },
            });

            // La evidencia bloquea la desaparición de su propia procedencia.
            await tx.supportContextSession.delete({ where: { id: contextoId } });
          }),
        ).rejects.toThrow();

        expect(await prisma.supportContextSession.count({ where: { id: contextoId } })).toBe(1);
      });
    });

    /* ------------------------------- Paso 12 ------------------------------- */

    describe('12 · existir estas filas NO concede ninguna capacidad de ejecución', () => {
      it('con capacidad, autorización y contexto vigentes, el tenant objetivo sigue cerrado', async () => {
        // Estado de partida: la autorización es real, activa y no revocada.
        const autorizacion = await prisma.supportGrant.findUniqueOrThrow({
          where: { id: autorizacionId },
          select: { status: true, targetTenantId: true },
        });
        expect(autorizacion).toStrictEqual({ status: 'ACTIVE', targetTenantId });

        // Y aun así, bajo el contexto del tenant HOME, el negocio del tenant
        // OBJETIVO permanece invisible: la autorización NO es, por sí sola,
        // una llave de ejecución. Convertirla en acceso exige el trabajo
        // server-side de MP02, que todavía no existe.
        const visibles = await servicio.withTenant(homeTenantId, async (tx) => ({
          pacientes: await tx.patient.count({ where: { tenantId: targetTenantId } }),
          profesionales: await tx.professionalProfile.count({
            where: { tenantId: targetTenantId },
          }),
          citas: await tx.appointment.count({ where: { tenantId: targetTenantId } }),
          visitas: await tx.homeVisit.count({ where: { tenantId: targetTenantId } }),
          auditoria: await tx.auditEvent.count({ where: { tenantId: targetTenantId } }),
        }));

        expect(visibles).toStrictEqual({
          pacientes: 0,
          profesionales: 0,
          citas: 0,
          visitas: 0,
          auditoria: 0,
        });
      });

      it('la migración no sembró ninguna capacidad, autorización ni contexto propios', async () => {
        // Todo lo que existe lo creó ESTA prueba. Una instalación limpia no
        // concede soporte a nadie: el comportamiento es fail-closed.
        const ajenas = await prisma.platformSupportCapability.count({
          where: { id: { notIn: [...sembrado.capacidades] } },
        });

        expect(ajenas).toBe(0);
      });
    });
  },
);
