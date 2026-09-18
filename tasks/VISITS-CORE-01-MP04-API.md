# VISITS-CORE-01 — MP04 Protected API

## Identificación

- **Paquete:** `VISITS-CORE-01-MP04`
- **Estado:** `READY FOR CLAUDE`
- **Tiempo máximo:** 15 minutos.
- **Objetivo:** exponer por API protegida la materialización institucional, consulta profesional y transiciones profesionales ya implementadas.
- **Dependencias cerradas:** MP01, MP02, MP03 e Identity MP03-B.

No crear UI, trabajo visual, Reportes ni arquitectura nueva.

## Superficie exacta

### Hospital Scheduler

- `POST /api/v1/visits/materialize`
- body exacto: `{ "appointmentId": "uuid" }`
- `HospitalSchedulerGuard` + `InstitutionalSameOriginGuard`.
- El tenant, identidad, rol y `now` salen del principal/contexto server-side.
- Invoca `HomeVisitMaterializationService`; no reimplementa dominio.
- Responde el resultado minimizado existente: `homeVisitId`, `appointmentId`,
  `status`, `version`, `creationTransitionId`, `createdAt`.

### Professional

- `GET /api/v1/professional/visits/:visitId`
- `PATCH /api/v1/professional/visits/:visitId/status`
- `HumanSessionGuard`; PATCH añade `SameOriginGuard`.
- body PATCH exacto:
  `{ "status": "IN_PROGRESS | COMPLETED | NOT_COMPLETED", "expectedVersion": 1 }`.
- El principal se obtiene exclusivamente de la request poblada por el guard.
- GET devuelve solo `homeVisitId`, `appointmentId`, `status`, `version`,
  `startedAt`, `endedAt`, `createdAt`, `updatedAt`.
- GET autoriza con la misma cadena aprobada: Person del principal → perfil y
  afiliación vigentes → `CareAssignment` activa/vigente de la visita.
- PATCH invoca `HomeVisitTransitionService`; no duplica su máquina ni acepta
  `professionalId`, `patientId`, actor, tenant o timestamps.

## Contrato y fallos

- UUID/body/fields extra/estado/version inválidos: `400`.
- sesión ausente/inválida: `401`; principal sin acceso: `404` uniforme.
- versión o transición: `409`.
- contexto/DB indisponible: `503` fail-closed usando el patrón existente.
- todas las respuestas: `Cache-Control: private, no-store`, `Pragma: no-cache`,
  `Vary: Cookie`.
- errores sin stack, SQL, IDs ajenos ni detalles de asignación.
- DTOs explícitos; nunca devolver objetos Prisma.

No crear endpoint de listado, cuidador, paciente, notas, clínica, dirección,
GPS, archivos o cancelación en MP04.

## Módulo mínimo

Crear `VisitsModule`, importar los módulos existentes necesarios y registrar:

- ambos controladores (pueden convivir en un archivo);
- `HomeVisitMaterializationService`;
- `HomeVisitTransitionService`;
- un servicio mínimo de consulta profesional;
- guards existentes como providers únicamente cuando Nest lo requiera.

Registrar `VisitsModule` en `AppModule`. No mover servicios ni cambiar módulos
de Identity/Hospital.

## Allowlist exacta

- nuevo `apps/api/src/visits/visits.controller.ts`;
- nuevo `apps/api/src/visits/visits.dto.ts`;
- nuevo `apps/api/src/visits/professional-visit-query.service.ts`;
- nuevo `apps/api/src/visits/visits.module.ts`;
- `apps/api/src/app.module.ts` — solo registrar `VisitsModule`;
- `apps/api/src/openapi/openapi.ts` — solo si el patrón existente lo exige;
- `apps/api/test/openapi.test.ts` — solo contratos MP04;
- nuevo `apps/api/test/visits.api.test.ts`.

No modificar MP02/MP03 services, auth/identity guards, Hospital, Prisma,
migraciones, fixtures compartidas, web, prototype, Reportes ni dependencias.

## Pruebas focales

Desde `apps/api`:

```text
npx vitest run --config vitest.config.mts test/visits.api.test.ts
npx vitest run --config vitest.config.mts test/openapi.test.ts
```

Cubrir únicamente:

- Scheduler válido materializa; otros roles/cookies no;
- materialización inexistente/inválida/duplicada produce contrato 400/404/409;
- sesión humana profesional obtiene su visita y no otra/cross-tenant;
- PATCH ejecuta START, COMPLETE y NOT_COMPLETED con versión;
- otro profesional, assignment/perfil/afiliación inválidos deniegan;
- body extra, IDs/estado/version inválidos y campos de autoridad rechazados;
- cookie institucional/enrollment nunca sustituye la humana;
- CSRF/origin, no-cache, 503 fail-closed y DTO sin PII;
- OpenAPI contiene exactamente las tres operaciones nuevas y sus schemas.

Limpieza solo por IDs registrados. Prohibido `deleteMany({})` sobre tablas
compartidas o Visits. No ejecutar suites completas.

## STOP

Detenerse sin ampliar allowlist si hace falta cambiar auth/identity, dominio
MP02/MP03, Hospital o Prisma; si un principal llega desde body/header; o si la
consulta profesional no puede aplicar autorización server-side y tenant/RLS.

## Handoff

Claude devuelve archivos cambiados, comandos/resultados focales y evidencia de
guards, autorización, contratos 404/409, CSRF, no-cache y minimización.
Confirmará que no tocó UI, Hospital visual, prototype ni Reportes.

