# VISITS-CORE-01 — MP01 DB Foundation

## Identificación

- **Paquete:** `VISITS-CORE-01-MP01`
- **Estado:** `READY FOR CLAUDE`
- **Objetivo:** crear la fundación PostgreSQL tenant-aware del dominio compartido de visitas domiciliarias.
- **Tiempo máximo:** 15 minutos.
- **Dependencias cerradas:** `IDENTITY-RELATIONSHIPS-CORE-01`, incluido MP03-B.

Este paquete implementa solo persistencia e integridad. No crea servicios,
endpoints, guards, integración con Agenda ni UI.

## Modelo autorizado

Añadir `HomeVisitStatus` con valores exactos:

- `SCHEDULED`
- `IN_PROGRESS`
- `COMPLETED`
- `NOT_COMPLETED`

Añadir `HomeVisit` conforme a `tasks/VISITS-CORE-01.md §5.2`:

- `id`, `tenantId`, `appointmentId`, `patientId`, `careAssignmentId`;
- `status`, `version`, `startedAt`, `endedAt`;
- `createdByInstitutionalIdentityId`, `createdAt`, `updatedAt`;
- unique `(id, tenantId)` y `(appointmentId, tenantId)`;
- FKs compuestas tenant-aware a `Appointment`, `Patient`, `CareAssignment` e
  `InstitutionalIdentity`;
- índices mínimos por tenant/estado, paciente y asignación.

Añadir `HomeVisitTransition` conforme a §5.3:

- `id`, `tenantId`, `homeVisitId`, `fromStatus`, `toStatus`;
- `performedByHumanAccountId` nullable;
- `occurredAt`, `createdAt`;
- unique `(id, tenantId)` y FKs compuestas tenant-aware a `HomeVisit` y
  `HumanAccount`.

La transición inicial `null → SCHEDULED` tiene
`performedByHumanAccountId = null`: su actor institucional íntegro está en
`HomeVisit.createdByInstitutionalIdentityId`. Toda transición posterior exige
un `HumanAccount`; no añadir actor polimórfico ni `professionalId`.

## Constraints DB obligatorios

1. `HomeVisit.version > 0`.
2. Coherencia exacta de timestamps:
   - `SCHEDULED`: `startedAt` y `endedAt` nulos;
   - `IN_PROGRESS`: `startedAt` no nulo y `endedAt` nulo;
   - terminal: `endedAt` no nulo; `COMPLETED` exige además `startedAt` no nulo;
   - `NOT_COMPLETED` puede originarse desde `SCHEDULED` o `IN_PROGRESS`.
3. Trigger tenant-aware valida al insertar/actualizar `HomeVisit` que:
   - la cita sea `HOME + ASSIGNED`;
   - `Appointment.patientId`, `careAssignmentId` y tenant coincidan;
   - la asignación sea `ACTIVE`, pertenezca al mismo paciente y tenant;
   - no se duplica profesional ni horario en `HomeVisit`.
4. La transición inicial es únicamente `fromStatus IS NULL`,
   `toStatus = SCHEDULED`, actor humano nulo.
5. Transiciones posteriores exigen actor humano y solo permiten:
   `SCHEDULED → IN_PROGRESS|NOT_COMPLETED` e
   `IN_PROGRESS → COMPLETED|NOT_COMPLETED`.
6. `HomeVisitTransition` es append-only para runtime; sin `UPDATE` ni `DELETE`.
7. Ambas tablas: `ENABLE/FORCE RLS`, policies `USING`/`WITH CHECK` mediante
   `merdn_current_tenant()`, y grants mínimos a `merdn_runtime` sin `DELETE`.

No implementar todavía la mutación transaccional que crea visita + transición
+ auditoría; corresponde al siguiente paquete de servicio/hook.

## Allowlist mínima

Claude puede modificar exclusivamente:

- `prisma/schema.prisma`;
- una nueva `prisma/migrations/<timestamp>_visits_core_01/migration.sql`;
- `prisma/migrations/ROLLBACK-visits_core_01.sql`;
- un nuevo `apps/api/test/visits-db-foundation.db.test.ts`.

Todo lo demás está prohibido, incluyendo `apps/api/src/**`, `apps/web/**`,
`prototype-claude/**`, Reportes, archivos históricos, dependencias y limpieza
opcional.

## Pruebas focales solamente

Desde la raíz:

```text
npm run prisma:validate
```

Desde `apps/api`:

```text
npx vitest run --config vitest.config.mts test/visits-db-foundation.db.test.ts
```

La prueba DB debe cubrir únicamente: creación válida; modalidades/estados de
cita inválidos; assignment inactiva o mismatch; unicidad por cita; FK
cross-tenant; constraints de estado/timestamps/transiciones; RLS con dos
tenants y contexto ausente/equivocado; grants runtime sin UPDATE/DELETE sobre
historial.

No ejecutar suites completas, build global, lint global ni pruebas visuales.

## STOP

Detenerse sin ampliar allowlist si una FK tenant-aware, constraint, RLS o grant
no puede implementarse como está especificado, o si una prueba exige cambios
en runtime/Agenda/auditoría.

## Handoff

Claude devuelve archivos cambiados, comandos exactos, resultados focales,
evidencia de RLS/integridad y riesgos residuales. Confirmará expresamente que no
tocó runtime, web, prototype ni Reportes.

