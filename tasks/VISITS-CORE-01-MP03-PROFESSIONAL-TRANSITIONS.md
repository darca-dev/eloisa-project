# VISITS-CORE-01 — MP03 Professional Transitions

## Identificación

- **Paquete:** `VISITS-CORE-01-MP03`
- **Estado:** `READY FOR CLAUDE`
- **Tiempo máximo:** 15 minutos.
- **Objetivo:** implementar el servicio transaccional que permite al profesional autenticado iniciar, completar o marcar no completada únicamente una visita asignada.
- **Dependencias cerradas:** MP01, MP02 e Identity MP03-B.

No crear endpoint, módulo, guard HTTP, DTO, UI ni integración Hospital.

## Operación única

Crear `HomeVisitTransitionService.transition(principal, visitId, targetStatus,
expectedVersion, now)`.

Entradas autorizadas:

- `principal: HumanPrincipal`, producido server-side;
- `visitId` opaco;
- `targetStatus: IN_PROGRESS | COMPLETED | NOT_COMPLETED`;
- `expectedVersion` entero positivo;
- `now` fijado por servidor.

Nunca aceptar `tenantId`, `patientId`, `professionalId`, actor, timestamps ni
rol desde el cliente.

## Autorización y atomicidad

Dentro de un único `PrismaService.withTenant(principal.tenantId)`:

1. filtrar explícitamente por tenant además de RLS;
2. autorizar desde `principal.personId`, nunca desde `professionalId` recibido;
3. exigir que el `CareAssignment` de la visita siga `ACTIVE` y vigente, que su
   `ProfessionalProfile` corresponda a esa Person y esté `ACTIVE`, y que exista
   `ProfessionalAffiliation ACTIVE` vigente;
4. aplicar actualización condicional por `visitId + tenantId + status actual +
   expectedVersion + asignación/profesional autorizado`;
5. incrementar `version` exactamente una vez;
6. fijar `startedAt = now` al entrar en `IN_PROGRESS` y `endedAt = now` al entrar
   en estado terminal, preservando `startedAt` cuando ya exista;
7. insertar `HomeVisitTransition` con `performedByHumanAccountId =
   principal.humanAccountId`;
8. insertar el evento de auditoría correspondiente;
9. confirmar actualización + transición + auditoría como todo-o-nada.

No separar autorización y mutación en transacciones distintas. Una carrera de
versión debe dejar exactamente un ganador.

## Máquina cerrada

- `SCHEDULED → IN_PROGRESS`
- `SCHEDULED → NOT_COMPLETED`
- `IN_PROGRESS → COMPLETED`
- `IN_PROGRESS → NOT_COMPLETED`
- terminales inmutables; sin saltos, reapertura ni reversión.

Errores de dominio estables y minimizados:

- `404` uniforme para inexistente, cross-tenant o profesional no asignado;
- `409` para versión obsoleta o transición ilegal;
- fallos DB/contexto/auditoría se propagan fail-closed.

## Auditoría

Añadir exactamente:

- `HOME_VISIT_STARTED`
- `HOME_VISIT_COMPLETED`
- `HOME_VISIT_NOT_COMPLETED`

Actor: `HUMAN_ACCOUNT`, `actorUserId = principal.humanAccountId`, `actorRole =
null`; recurso `HomeVisit`; outcome `SUCCESS`; sin PII, horario, body, notas ni
datos clínicos. El método de auditoría recibe la transacción existente.

Residual no bloqueante ya registrado: endurecimiento posterior de
`audit_event_resource_required` para eventos Visits.

## Allowlist exacta

- `prisma/schema.prisma` — solo los tres valores de auditoría;
- nueva `prisma/migrations/20260824200000_visits_core_03/migration.sql`;
- nuevo `prisma/migrations/ROLLBACK-visits_core_03.sql`;
- nuevo `apps/api/src/visits/home-visit-transition.service.ts`;
- `apps/api/src/audit/audit.service.ts` — solo método transaccional requerido;
- nuevo `apps/api/test/visits-professional-transitions.db.test.ts`.

Todo lo demás está prohibido: módulos/endpoints/OpenAPI, Identity, Hospital,
web, prototype, Reportes, fixtures compartidas, dependencias y migraciones
anteriores.

## Pruebas focales

Desde la raíz:

```text
npm run prisma:validate
```

Desde `apps/api`:

```text
npx vitest run --config vitest.config.mts test/visits-professional-transitions.db.test.ts
```

Cubrir únicamente: las cuatro transiciones legales; timestamps/versiones;
historial y actor humano; evento correcto; otro profesional/paciente/tenant;
perfil, afiliación o assignment inactivos/vencidos; versión obsoleta;
transición ilegal/terminal; carrera con un ganador; rollback si historial o
auditoría fallan; rol runtime y tenant GUC.

La limpieza elimina exclusivamente IDs registrados por esta prueba. Prohibido
`deleteMany({})` sobre tablas compartidas o Visits.

No ejecutar suites completas ni pruebas visuales.

## STOP

Detenerse sin ampliar allowlist si la autorización y la actualización no
pueden quedar en la misma transacción, si se requiere tocar Identity/endpoint,
o si historial y auditoría no pueden ser atómicos.

## Handoff

Claude devuelve archivos cambiados, comandos/resultados focales, evidencia de
autorización, concurrencia y rollback, y confirma que no tocó endpoints,
Hospital, web, prototype ni Reportes.

