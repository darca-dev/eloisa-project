# Investigación 007 - Inscripción a paciente persistente

Medido sobre `develop` el 2026-08-25.

## R1. Modelos creados

La migración `core_01_init` crea las tablas `tenant`, `person` y `patient`, más
14 tipos enumerados: `DocumentType`, `SexGenderCode`, `PatientStatus`,
`PatientOrigin`, `PopulationType`, `PopulationSource`, `TerritorialUnitType`,
`TerritorialUnitStatus`, `AreaType`, `ConsentType`, `AuditEventType`,
`AuditActorType`, `AuditOutcome` y los de estado territorial.

`core_01_reference_data` carga datos de referencia. `core_01_hardening` activa
Row Level Security y crea políticas sobre `tenant`, `person` y `patient`.

## R2. Row Level Security desde el primer dato

El endurecimiento no llegó como parche tardío: es la tercera migración del
repositorio, aplicada el mismo día que se abrió la persistencia. Cumple
`docs/ARCHITECTURE.md` §2.1, que exige aislar tenants desde el primer dato
persistido.

## R3. El navegador no envía tenant

`tenant-context.service.ts` documenta la regla en su propia cabecera: el tenant
se resuelve exclusivamente desde configuración del servidor, el navegador nunca
lo envía y no existe selector. Está trazado a `TASK-MVP-CORE-01` §4, §9 y §18.1.

## R4. Cobertura

Pruebas unitarias del ámbito: `document-normalization.test.ts`,
`enrollment.validation.test.ts`, `population-derivation.test.ts`,
`unique-document-violation.test.ts`, `enrollment-session.test.ts`,
`environment.test.ts`.

Pruebas de integración: `patient-enrollment.db.test.ts`,
`patient-enrollment.api.test.ts`, `core-01-hardening.db.test.ts`,
`runtime-fail-closed.db.test.ts`.

`runtime-fail-closed.db.test.ts` es notable: prueba que el sistema falla cerrado
en vez de degradar cuando el contexto de ejecución no es válido.

## R5. Controles del punto de entrada

`POST /api/v1/patients/enrollments` lleva `EnrollmentRateLimitGuard`. Los límites
son configurables (`ENROLLMENT_RATE_LIMIT_MAX`,
`ENROLLMENT_RATE_LIMIT_WINDOW_SECONDS`). `malformed-json.filter.ts` evita que un
cuerpo inválido produzca una traza interna.

La cookie de sesión de inscripción es `HttpOnly`, con `SameSite` y `Secure`
configurables y TTL propio.

## R6. Verificación no ejecutada

Las pruebas `.db.test.ts` requieren PostgreSQL en marcha
(`apps/api/test/database-availability.ts`). No se ejecutaron: `node_modules`
ausente y sin base de datos levantada.
