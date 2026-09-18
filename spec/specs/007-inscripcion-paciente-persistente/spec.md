# Especificación 007 - Inscripción a paciente persistente

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specification: `tasks/TASK-MVP-CORE-01.md`. Auditoría:
`reviews/REVIEW-MVP-CORE-01-FINAL.md`. Congeladas.

Es la primera capacidad con persistencia real del repositorio: hasta aquí todo
era interfaz.

## Objetivo

Que una inscripción completada deje de vivir en memoria del navegador y se
convierta en persona, paciente, dirección, pertenencia poblacional y
consentimiento persistidos en PostgreSQL, con tenant, procedencia y auditoría,
sin que el navegador pueda influir en el contexto institucional.

## Historia de usuario principal

Como persona que completa la inscripción, quiero que mis datos queden registrados
de forma segura y verificable, para que la institución pueda atenderme y yo pueda
consultar mi propio registro.

## Qué hace hoy el sistema

- **`POST /api/v1/patients/enrollments`** — crea el registro completo en una
  transacción (`patient-enrollment.controller.ts`, `.service.ts`).
- **`GET /api/v1/patients/me`** — devuelve el registro propio del solicitante.
- **Tenant resuelto en servidor** (`database/tenant-context.service.ts`): el
  navegador nunca envía tenant, ni en cuerpo, ni en URL, ni en cabecera. No existe
  selector ni administración multiempresa.
- **Sesión de inscripción** en cookie `HttpOnly` (`enrollment-sessions/`), con
  TTL configurable y prueba propia.
- **Normalización de documento** y detección de duplicado
  (`document-normalization.ts`, `unique-document-violation.test.ts`).
- **Derivación de tipo de población** (`population-derivation.ts`) a partir de los
  datos declarados, no inventada.
- **Consentimiento** versionado y con finalidad (`consents/consent.service.ts`,
  variables `MERDN_CONSENT_VERSION` y `MERDN_CONSENT_PURPOSE`).
- **Territorio** resuelto contra unidades territoriales persistidas
  (`territory/territory.service.ts`).
- **Auditoría** de la operación (`audit/audit.service.ts`).
- **Límite de tasa** en el punto de entrada (`enrollment-rate-limit.guard.ts`).
- **Filtro de JSON malformado** (`malformed-json.filter.ts`).
- **Row Level Security** activada en la migración de endurecimiento.

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | Prisma, PostgreSQL, Compose, validación de entorno | Sin base de datos ni configuración validada no hay persistencia |
| 002-experiencia-inscripcion-visual | El flujo de inscripción que ahora envía a la API | Esta spec le da destino a los datos que aquel recoge |

**Dependencias externas:** PostgreSQL en marcha. Las pruebas `.db.test.ts`
requieren base de datos (`apps/api/test/database-availability.ts`).

**Migraciones que introduce:** `20260821120000_core_01_init`,
`20260821120100_core_01_reference_data`, `20260822120000_core_01_hardening`.

**Specs que dependen de esta:** 008, 009, 010, 011, 012, 016 y 017. Todas
construyen sobre las decisiones que fijó aquí: tenant resuelto en servidor, Row
Level Security desde el primer dato, transacción única, auditoría y fail-closed.

## Escenarios de aceptación

1. Dada una inscripción válida, cuando se envía, entonces se crean persona,
   paciente, dirección, pertenencia poblacional y consentimiento en una sola
   transacción, o no se crea nada.
2. Dado un documento ya registrado, cuando se intenta inscribir de nuevo,
   entonces la API responde el conflicto sin revelar datos del registro existente.
3. Dado un cuerpo con `tenantId`, cuando se envía, entonces la API lo rechaza en
   vez de aceptarlo.
4. Dado un JSON malformado, cuando llega a la API, entonces responde un error
   controlado y no una traza interna.
5. Superado el límite de tasa, cuando se insiste, entonces la API rechaza sin
   crear registros.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se reciba una inscripción, EL SISTEMA DEBERÁ persistir todas sus
  entidades en una única transacción.
- CUANDO se resuelva el contexto institucional, EL SISTEMA DEBERÁ tomarlo
  exclusivamente de configuración del servidor.
- SI el documento ya existe en el tenant, ENTONCES EL SISTEMA DEBERÁ rechazar sin
  filtrar información del registro existente.
- CUANDO se registre el consentimiento, EL SISTEMA DEBERÁ almacenar su versión y
  su finalidad.
- EL SISTEMA DEBERÁ emitir evento de auditoría de la operación.
- EL SISTEMA NO DEBERÁ derivar tipo de población por inferencia no declarada.

## Ámbito de archivos / File scope

- `apps/api/src/patients/` — controlador, servicio, validación, catálogos
- `apps/api/src/enrollment-sessions/` — sesión de inscripción
- `apps/api/src/consents/`, `apps/api/src/territory/`, `apps/api/src/audit/`
- `apps/api/src/database/` — Prisma, tenant, transacción, fail-closed
- `prisma/migrations/20260821120000_core_01_init/`
- `prisma/migrations/20260821120100_core_01_reference_data/`
- `prisma/migrations/20260822120000_core_01_hardening/`
- `apps/web/src/features/inscripcion/patientEnrollmentClient.ts`

## Estado real y límites conocidos

- `GET /api/v1/patients/me` existe, pero la experiencia de paciente
  (`features/paciente`) no consume aún un cliente de API: su bitácora sigue en
  memoria (ver spec 002).
- El tenant activo se resuelve una sola vez y se cachea en memoria
  (`tenant-context.service.ts`): es configuración estable del despliegue. Cambiar
  de tenant requiere reiniciar.
- `GET /health` sigue respondiendo aunque el tenant activo no exista, para no
  impedir el arranque antes de aplicar datos de referencia.

## Criterios de éxito

- Una inscripción completa persiste y es recuperable por su titular.
- `patient-enrollment.db.test.ts`, `patient-enrollment.api.test.ts` y
  `core-01-hardening.db.test.ts` pasan.
- Ningún parámetro de tenant enviado por el navegador es aceptado.
