# VISITS-CORE-01 — MP02 MATERIALIZATION SERVICE

## Identificación

- **Paquete:** `VISITS-CORE-01-MP02`
- **Estado:** `READY FOR CLAUDE`
- **Objetivo:** una única mutación transaccional de dominio que materialice la
  visita domiciliaria a partir de una cita `HOME` ya asignada, escribiendo en la
  MISMA transacción la visita, su transición de creación y su evento de
  auditoría.
- **Tiempo máximo:** 15 minutos.
- **Dependencias cerradas:** `VISITS-CORE-01-MP01` (commit
  `feat(visits): add tenant-aware visit database foundation`),
  `HOSPITAL-CORE-02`, `IDENTITY-RELATIONSHIPS-CORE-01`.

Este paquete implementa SOLO lógica de dominio y auditoría. NO crea endpoint,
NO crea guard, NO crea DTO HTTP, NO registra módulo en el arranque, NO toca
Hospital, NO toca web y NO toca Reportes.

## Contexto

MP01 dejó la fundación PostgreSQL cerrada y verificada: `home_visit`,
`home_visit_transition`, RLS `ENABLE + FORCE`, grants mínimos sin `DELETE`, FKs
compuestas tenant-aware, historial append-only, índice único de creación,
reglas de borrado no destructivas y trigger de origen `BEFORE INSERT`.

MP01 aplazó explícitamente una sola cosa: *«la mutación transaccional que crea
visita + transición + auditoría; corresponde al siguiente paquete de
servicio»*. Eso es exactamente MP02, y nada más.

## Modelo y actor autorizados

El actor de la materialización es la **identidad institucional OPACA**, no una
persona. Es la decisión ya aprobada en MP01 y no se reabre aquí:

- `HomeVisit.createdByInstitutionalIdentityId` recibe la identidad
  institucional que opera;
- la transición de creación es exactamente `fromStatus = null`,
  `toStatus = SCHEDULED`, `performedByHumanAccountId = null`;
- el evento de auditoría lleva `actorType = 'INSTITUTIONAL_IDENTITY'` y
  `actorUserId = <identityId>`, siguiendo la convención ya vigente en
  `hospital.contract.ts`.

**El profesional NO autoriza ni firma la materialización.** La prioridad
funcional «Professional autorizado» del Product Owner se refiere a las
transiciones posteriores —iniciar, completar, no completar— y a la
autorización del endpoint. Ambas cosas están FUERA de MP02 y no deben
anticiparse, inferirse ni preparar campos para ellas.

## Requisitos funcionales

Un único método de servicio que, dentro de `PrismaService.withTenant()` y por
tanto bajo `merdn_runtime` con el tenant fijado:

1. localiza la cita por `(id, tenantId)` con filtro explícito de tenant ADEMÁS
   de RLS;
2. devuelve un desenlace `404` UNIFORME cuando la cita no existe o pertenece a
   otra institución —no se distinguen, para no confirmar la existencia de un
   registro ajeno—;
3. rechaza con código estable la cita cuya modalidad no sea `HOME`, cuyo estado
   no sea `ASSIGNED` o que no tenga `careAssignmentId`;
4. crea la visita en estado `SCHEDULED`, con `startedAt` y `endedAt` nulos y
   `version = 1`;
5. crea la transición de creación en la MISMA transacción;
6. escribe `HOME_VISIT_MATERIALIZED` sobre `resourceType = 'HomeVisit'` en la
   MISMA transacción;
7. confirma todo o nada;
8. traduce la violación del índice único `home_visit_appointment_tenant_unique`
   (`P2002`) a un desenlace `409` estable: esa cita ya materializó su visita.

Las comprobaciones de coherencia que MP01 ya impone en la base —modalidad,
estado, paciente, asignación `ACTIVE`, tenant— NO se reimplementan como reglas
de negocio duplicadas: el servicio se apoya en ellas y traduce el fallo a un
desenlace de dominio legible. Comprobar en el servicio lo que ya garantiza el
trigger es duplicación, no defensa.

### Lo que el servicio NO hace

- NO inicia, completa ni da por no realizada la visita;
- NO escribe `startedAt` ni `endedAt`;
- NO acepta ni persiste `professionalId`, horario, dirección, zona, motivo,
  nota, diagnóstico, GPS, firma ni archivo;
- NO crea personas, pacientes, profesionales, asignaciones ni citas;
- NO cambia el estado ni la versión de la cita;
- NO aplica regla clínica alguna;
- NO decide disponibilidad humana: la plataforma no modela turnos ni jornada.

## Auditoría

Se añade UN valor al enum existente:

```
AuditEventType += HOME_VISIT_MATERIALIZED
```

Campos del evento: `tenantId`, `eventType`, `actorType`, `actorUserId`,
`actorRole`, `resourceType = 'HomeVisit'`, `resourceId = <homeVisitId>`,
`outcome = 'SUCCESS'`, `occurredAt`.

`endpoint` y `correlationId` quedan NULOS en MP02 —son anulables en el
esquema— porque todavía no existe petición HTTP. El paquete del endpoint los
suministrará. No inventar un valor de relleno.

El evento NO copia nombre, documento, dirección, horario ni dato clínico: solo
referencia el recurso y su contexto institucional.

## Migración

Migración ADITIVA de un solo valor de enum.

**Advertencia obligatoria que debe quedar escrita en el ROLLBACK:**
PostgreSQL NO permite retirar un valor de un enum. La reversión de este paquete
NO puede deshacer `ALTER TYPE ... ADD VALUE`; exigiría recrear el tipo y
reescribir todas las columnas que lo usan, incluida `audit_event`, que es
append-only. El ROLLBACK debe DOCUMENTAR esa imposibilidad de forma explícita en
lugar de simular una reversión limpia, y limitarse a lo que sí es reversible.

`ALTER TYPE ... ADD VALUE` se ejecuta dentro de la transacción de la migración
(PostgreSQL 12+), pero el valor nuevo NO puede USARSE en esa misma transacción.
La migración por tanto SOLO añade el valor: no inserta ni actualiza ninguna
fila.

Tras cambiar el esquema hay que ejecutar `npx prisma generate` para que el
cliente tipado conozca el valor nuevo. El cliente generado está en
`.gitignore` y no se commitea.

## Archivos permitidos

1. `prisma/schema.prisma` — únicamente el valor nuevo de `AuditEventType`.
2. `prisma/migrations/20260824180000_visits_core_02/migration.sql` — nueva.
3. `prisma/migrations/ROLLBACK-visits_core_02.sql` — nueva.
4. `apps/api/src/visits/home-visit-materialization.service.ts` — nueva. Incluye
   en el MISMO archivo su clase de error de dominio y su tipo de resultado: no
   se crea un archivo de contrato separado en este paquete.
5. `apps/api/src/audit/audit.service.ts` — únicamente un método nuevo
   `recordHomeVisitMaterializedWithin`, dentro de la transacción recibida.
6. `apps/api/test/visits-materialization.db.test.ts` — nueva.

## Archivos prohibidos

Todo lo demás, y en particular:

- `apps/api/src/app.module.ts` y cualquier `*.module.ts` — el cableado Nest
  corresponde al paquete del endpoint;
- `apps/api/src/hospital/**`, `apps/api/src/identity-access/**`,
  `apps/api/src/institutional-auth/**`, `apps/api/src/human-auth/**`;
- `apps/api/test/*-fixtures.ts` — las fixtures compartidas se REUTILIZAN tal
  como están;
- `apps/api/test/visits-db-foundation.db.test.ts` — la prueba de MP01 no se
  modifica; se vuelve a ejecutar como regresión;
- `apps/web/**`, `prototype-claude/**`, Reportes, migraciones históricas,
  dependencias nuevas.

## Pruebas focales

Desde la raíz:

```text
npm run prisma:validate
```

Desde `apps/api`:

```text
npx vitest run --config vitest.config.mts test/visits-materialization.db.test.ts
npx vitest run --config vitest.config.mts test/visits-db-foundation.db.test.ts
```

La segunda es REGRESIÓN de MP01 y debe seguir en 41/41.

La prueba nueva debe cubrir, contra PostgreSQL real y bajo el rol runtime:

1. materialización válida: visita `SCHEDULED`, transición de creación sin actor
   humano y evento `HOME_VISIT_MATERIALIZED`, los tres presentes;
2. atomicidad: si la transición o la auditoría fallan, la visita NO queda
   persistida;
3. cita inexistente y cita de OTRA institución producen el MISMO desenlace;
4. modalidad `ON_SITE`/`VIRTUAL` y estado no `ASSIGNED` quedan rechazados;
5. segunda materialización de la misma cita rechazada con el desenlace `409`;
6. el evento de auditoría no contiene dato personal ni horario.

### Limpieza obligatoria

La limpieza debe retirar EXCLUSIVAMENTE las filas sembradas por esta prueba,
por identificador registrado, siguiendo el patrón ya corregido en
`visits-db-foundation.db.test.ts`. **Prohibido `deleteMany({})`** sobre
`appointment`, `care_assignment`, `patient`, `person` o cualquier tabla
compartida. `audit_event` es append-only y NO se borra nunca.

## Decisiones aprobadas que habilitan la implementación

- El actor de la materialización es la identidad institucional opaca (MP01).
- La transición de creación no lleva actor humano (MP01).
- `Appointment` sigue siendo la única agenda y `CareAssignment` la única fuente
  del profesional (MP01).
- La auditoría de MERDN registra el recurso y su contexto institucional, nunca
  el dato personal (CORE-01, HOSPITAL-CORE-02).

## Decisiones FUERA de alcance

No se infieren, no se preparan y no se implementan:

- autorización del profesional y su relación con la visita;
- transiciones `SCHEDULED → IN_PROGRESS | NOT_COMPLETED` e
  `IN_PROGRESS → COMPLETED | NOT_COMPLETED`;
- endpoints HTTP, DTO, guards, contrato OpenAPI y cableado de módulos;
- integración con Agenda hospitalaria y con la experiencia Hospital;
- cancelación de visitas, que pertenece a Agenda y no está aprobada;
- interfaz, Reportes e indicadores.

## STOP

Detenerse sin ampliar la allowlist y devolver el asunto a Codex y al Product
Owner si aparece:

1. necesidad de autorizar al profesional o de nombrarlo en la visita;
2. necesidad de tocar un módulo, un controlador o el arranque de la aplicación;
3. necesidad de modificar fixtures compartidas o la prueba de MP01;
4. imposibilidad de escribir la auditoría dentro de la misma transacción;
5. cualquier reversión que exigiera reescribir `audit_event` o recrear un enum
   en uso;
6. contradicción con el modelo aprobado de MP01.

## Handoff

Claude devuelve archivos cambiados, comandos exactos, resultados focales
—incluida la regresión de MP01—, evidencia de atomicidad y de auditoría, y
riesgos residuales. Confirmará expresamente que no tocó módulos, endpoints,
Hospital, web, prototipo ni Reportes, y que la limpieza de la prueba no borró
ninguna fila ajena.
