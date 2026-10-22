import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { type PrismaClient } from '../src/generated/prisma/client';

import { createTestPrismaClient, unavailableBanner } from './database-availability';

/**
 * Catálogo FORCE ROW LEVEL SECURITY verificado contra PostgreSQL real.
 *
 * Estas pruebas son DB-gated: sin base migrada NO se sustituyen por dobles, se
 * marcan como no ejecutadas con un motivo visible. Solo leen catálogos
 * (`pg_class`, `pg_policy`, `pg_roles`, `information_schema`): no crean roles,
 * tablas, datos ni fixtures, y no alteran estado de base.
 *
 * Conjuntos congelados por spec 025. No se derivan de la base en tiempo de
 * ejecución: si una tabla protegida se añade o desaparece, la diferencia entre
 * el conjunto esperado y el observado es precisamente el hallazgo.
 *
 * La garantía de que el propietario queda sujeto a RLS se demuestra de forma
 * catalogada —`relforcerowsecurity` activo y propietario distinto del rol
 * runtime—, no conductualmente. Una conexión administrativa con superusuario
 * saltaría RLS por definición, así que un test de escritura leído con ella no
 * probaría nada sobre FORCE.
 *
 * FORCE no restringe a superusuarios ni a roles con BYPASSRLS: solo elimina el
 * bypass implícito del propietario no privilegiado. Por eso además de exigir
 * FORCE se exige que el dueño de cada tabla protegida sea un rol sin privilegios
 * de bypass.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/** Rol de mínimo privilegio. Su nombre es la identidad, no el OID. */
const ROL_RUNTIME = 'merdn_runtime';

/**
 * Las 45 tablas que deben tener RLS y FORCE activos en `public`. Spec 025
 * congeló 26; se amplían con access_request, el registro institucional, la
 * recuperación administrada, las revisiones municipales y las cinco tablas de
 * custodia de SPEC 055 / MP01 y las siete de bitacoras/alarmas de MP02–MP03, coincidiendo con el catálogo del provisionador.
 */
const TABLAS_PROTEGIDAS: readonly string[] = [
  'access_password_recovery',
  'access_request',
  'appointment',
  'audit_event',
  'care_alarm',
  'care_alarm_criterion',
  'care_alarm_criterion_version',
  'care_alarm_evidence',
  'care_alarm_transition',
  'care_assignment',
  'care_authorization',
  'care_observable_definition',
  'care_observation',
  'care_record',
  'care_record_amendment',
  'care_request_receipt',
  'clinical_competence_attestation',
  'consent_record',
  'enrollment_session',
  'external_auth_identity',
  'home_visit',
  'home_visit_transition',
  'human_account',
  'human_auth_attempt',
  'human_session',
  'institutional_administrator_registration',
  'institutional_identity',
  'institutional_session',
  'municipality_section_revision',
  'organization',
  'organization_care_manager',
  'patient',
  'patient_address',
  'patient_care_context',
  'patient_caregiver_relationship',
  'patient_caregiver_relationship_scope',
  'patient_population_membership',
  'person',
  'platform_support_capability',
  'professional_affiliation',
  'professional_profile',
  'support_context_session',
  'support_grant',
  'tenant',
  'territorial_unit',
];

/** Los 52 pares policy/tabla esperados, sobre esas mismas tablas. */
const POLICIES_ESPERADAS: readonly (readonly [string, string])[] = [
  ['access_password_recovery_tenant', 'access_password_recovery'],
  ['access_request_tenant', 'access_request'],
  ['appointment_tenant', 'appointment'],
  ['audit_event_organization_scope', 'audit_event'],
  ['audit_event_tenant_append', 'audit_event'],
  ['audit_event_tenant_read', 'audit_event'],
  ['care_alarm_criterion_scope', 'care_alarm_criterion'],
  ['care_alarm_criterion_version_scope', 'care_alarm_criterion_version'],
  ['care_alarm_evidence_scope', 'care_alarm_evidence'],
  ['care_alarm_scope', 'care_alarm'],
  ['care_alarm_transition_scope', 'care_alarm_transition'],
  ['care_assignment_tenant', 'care_assignment'],
  ['care_authorization_discovery', 'care_authorization'],
  ['care_authorization_scope', 'care_authorization'],
  ['care_observable_definition_scope', 'care_observable_definition'],
  ['care_observation_scope', 'care_observation'],
  ['care_record_amendment_scope', 'care_record_amendment'],
  ['care_record_scope', 'care_record'],
  ['care_request_receipt_scope', 'care_request_receipt'],
  ['clinical_competence_attestation_scope', 'clinical_competence_attestation'],
  ['consent_record_tenant', 'consent_record'],
  ['enrollment_session_tenant', 'enrollment_session'],
  ['external_auth_identity_tenant', 'external_auth_identity'],
  ['home_visit_tenant', 'home_visit'],
  ['home_visit_transition_tenant', 'home_visit_transition'],
  ['human_account_tenant', 'human_account'],
  ['human_auth_attempt_tenant', 'human_auth_attempt'],
  ['human_session_tenant', 'human_session'],
  ['institutional_administrator_registration_tenant', 'institutional_administrator_registration'],
  ['institutional_identity_tenant', 'institutional_identity'],
  ['institutional_session_tenant', 'institutional_session'],
  ['municipality_section_revision_tenant', 'municipality_section_revision'],
  ['organization_care_manager_discovery', 'organization_care_manager'],
  ['organization_care_manager_scope', 'organization_care_manager'],
  ['organization_discovery', 'organization'],
  ['organization_manager_discovery', 'organization'],
  ['organization_scope', 'organization'],
  ['patient_address_tenant', 'patient_address'],
  ['patient_care_context_discovery', 'patient_care_context'],
  ['patient_care_context_scope', 'patient_care_context'],
  ['patient_caregiver_relationship_scope_tenant', 'patient_caregiver_relationship_scope'],
  ['patient_caregiver_relationship_tenant', 'patient_caregiver_relationship'],
  ['patient_population_membership_tenant', 'patient_population_membership'],
  ['patient_tenant', 'patient'],
  ['person_tenant', 'person'],
  ['platform_support_capability_home_tenant', 'platform_support_capability'],
  ['professional_affiliation_tenant', 'professional_affiliation'],
  ['professional_profile_tenant', 'professional_profile'],
  ['support_context_session_home_tenant', 'support_context_session'],
  ['support_grant_home_tenant', 'support_grant'],
  ['tenant_self', 'tenant'],
  ['territorial_unit_scope', 'territorial_unit'],
];

const NOMBRE_SEGURO = /^[a-z_][a-z0-9_]*$/;

/**
 * Convierte un identificador del catálogo en literal SQL. Los nombres vienen de
 * constantes congeladas, pero la validación es explícita: si alguien incorpora
 * un nombre con comilla o espacio, la prueba falla en vez de construir SQL.
 */
function literal(identificador: string): string {
  if (!NOMBRE_SEGURO.test(identificador)) {
    throw new Error(`Identificador de catálogo no seguro para SQL: ${identificador}`);
  }
  return `'${identificador}'`;
}

const listaTablas = TABLAS_PROTEGIDAS.map(literal).join(', ');

function pares(políticas: readonly (readonly [string, string])[]): string[] {
  return políticas.map(([policy, tabla]) => `${policy}@${tabla}`).sort();
}

describe.skipIf(!puedeEjecutarse)('Catálogo FORCE ROW LEVEL SECURITY en PostgreSQL', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('las 45 tablas protegidas existen en public con RLS y FORCE, sin extras ni ausencias', async () => {
    const observadas = await prisma.$queryRawUnsafe<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }[]>(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relrowsecurity
        ORDER BY c.relname`,
    );

    // Sin filas de más: el conjunto observado debe ser exactamente el congelado.
    expect(observadas.map((fila) => fila.relname)).toEqual([...TABLAS_PROTEGIDAS]);

    for (const fila of observadas) {
      expect(fila.relrowsecurity, `RLS no habilitado en ${fila.relname}`).toBe(true);
      expect(fila.relforcerowsecurity, `FORCE no vigente en ${fila.relname}`).toBe(true);
    }
  });

  it('las 52 policies existen en su tabla y aplican al rol runtime, sin extras ni ausencias', async () => {
    const observadas = await prisma.$queryRawUnsafe<
      { polname: string; relname: string; roles: string[]; publica: boolean }[]
    >(
      `SELECT p.polname,
              c.relname,
              ARRAY(SELECT r.rolname::text FROM pg_roles r WHERE r.oid = ANY (p.polroles) ORDER BY r.rolname)::text[] AS roles,
              0::oid = ANY (p.polroles) AS publica
         FROM pg_policy p
         JOIN pg_class c ON c.oid = p.polrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN (${listaTablas})
        ORDER BY p.polname`,
    );

    expect(observadas.map((fila) => `${fila.polname}@${fila.relname}`).sort()).toEqual(
      pares(POLICIES_ESPERADAS),
    );

    /*
     * Una policy sin `TO` aplica a PUBLIC (oid 0), que incluye al runtime y
     * también restringe a cualquier otro rol. Es el caso conocido de
     * `access_password_recovery_tenant`; se acepta explícitamente en vez de
     * exigir el nombre del rol.
     */
    for (const fila of observadas) {
      expect(
        fila.publica || fila.roles.includes(ROL_RUNTIME),
        `la policy ${fila.polname} no aplica al rol runtime`,
      ).toBe(true);
    }
  });

  it('merdn_runtime existe y no puede saltarse RLS por atributos de rol', async () => {
    const rol = await prisma.$queryRawUnsafe<
      {
        rolname: string;
        rolsuper: boolean;
        rolbypassrls: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolreplication: boolean;
      }[]
    >(
      `SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
         FROM pg_roles
        WHERE rolname = 'merdn_runtime'`,
    );

    expect(rol).toHaveLength(1);
    const atributos = rol[0];
    expect(atributos?.rolname).toBe(ROL_RUNTIME);
    expect(atributos?.rolsuper, 'el runtime no debe ser superusuario').toBe(false);
    expect(atributos?.rolbypassrls, 'el runtime no debe tener BYPASSRLS').toBe(false);
    expect(atributos?.rolcreatedb, 'el runtime no debe poder crear bases').toBe(false);
    expect(atributos?.rolcreaterole, 'el runtime no debe poder crear roles').toBe(false);
    expect(atributos?.rolreplication, 'el runtime no debe tener replicacion').toBe(false);
  });

  it('merdn_runtime no es propietario de ninguna de las 45 tablas', async () => {
    const propietarios = await prisma.$queryRawUnsafe<{ relname: string; propietario: string }[]>(
      `SELECT c.relname, r.rolname AS propietario
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_roles r ON r.oid = c.relowner
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname IN (${listaTablas})
        ORDER BY c.relname`,
    );

    expect(propietarios).toHaveLength(TABLAS_PROTEGIDAS.length);
    for (const fila of propietarios) {
      expect(fila.propietario, `${fila.relname} es propiedad del rol runtime`).not.toBe(ROL_RUNTIME);
    }
  });

  it('merdn_runtime no tiene CREATE en el esquema public', async () => {
    const privilegio = await prisma.$queryRawUnsafe<{ puede_crear: boolean }[]>(
      `SELECT has_schema_privilege('merdn_runtime', 'public', 'CREATE') AS puede_crear`,
    );

    expect(privilegio).toHaveLength(1);
    expect(privilegio[0]?.puede_crear, 'el runtime no debe poder crear objetos en public').toBe(false);
  });

  it('el catalogo demuestra que FORCE sujeta al propietario en las 45 tablas', async () => {
    const catalogos = await prisma.$queryRawUnsafe<
      {
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
        propietario: string;
        propietario_superusuario: boolean;
        propietario_bypassrls: boolean;
      }[]
    >(
      `SELECT c.relname,
              c.relrowsecurity,
              c.relforcerowsecurity,
              dueno.rolname AS propietario,
              dueno.rolsuper AS propietario_superusuario,
              dueno.rolbypassrls AS propietario_bypassrls
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_roles dueno ON dueno.oid = c.relowner
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname IN (${listaTablas})
        ORDER BY c.relname`,
    );

    expect(catalogos).toHaveLength(TABLAS_PROTEGIDAS.length);
    for (const fila of catalogos) {
      // FORCE + propietario distinto del runtime = el owner también pasa por RLS.
      expect(fila.relrowsecurity, `RLS no habilitado en ${fila.relname}`).toBe(true);
      expect(fila.relforcerowsecurity, `FORCE no vigente en ${fila.relname}`).toBe(true);
      expect(fila.propietario, `${fila.relname} es propiedad del rol runtime`).not.toBe(ROL_RUNTIME);
      /*
       * FORCE solo elimina el bypass implícito del propietario NO privilegiado.
       * Si el dueño fuese superusuario o tuviera BYPASSRLS, la tabla seguiría
       * siendo accesible sin filtros y la garantía sería falsa. Por eso el
       * contrato exige que ningún owner de las 45 tenga esos atributos.
       */
      expect(
        fila.propietario_superusuario,
        `el propietario ${fila.propietario} de ${fila.relname} es superusuario: FORCE no lo restringe`,
      ).toBe(false);
      expect(
        fila.propietario_bypassrls,
        `el propietario ${fila.propietario} de ${fila.relname} tiene BYPASSRLS: FORCE no lo restringe`,
      ).toBe(false);
    }
  });
});
