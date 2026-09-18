# Especificación 012 - Visitas domiciliarias (fundación, materialización, transiciones y API)

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specifications: `tasks/VISITS-CORE-01.md` (diseño, marcado
`DESIGN COMPLETE — IMPLEMENTATION BLOCKED`) y los cuatro micropaquetes que sí
autorizaron implementación: `tasks/VISITS-CORE-01-MP01-DB-FOUNDATION.md`,
`tasks/VISITS-CORE-01-MP02-MATERIALIZATION.md`,
`tasks/VISITS-CORE-01-MP03-PROFESSIONAL-TRANSITIONS.md` y
`tasks/VISITS-CORE-01-MP04-API.md`. Congeladas.

**No existe auditoría registrada.** `ls reviews/ | grep -i visit` no devuelve
nada: el directorio `reviews/` contiene 20 informes —más `README.md` y
`REVIEW-TEMPLATE.md`, que no lo son— y **ninguno** corresponde a
`VISITS-CORE-01` ni a sus micropaquetes. Es la capacidad de dominio más grande
del repositorio sin revisión de Codex archivada. La ausencia no invalida el
trabajo —su cobertura de integración es la mayor del repositorio— pero sí
significa que nadie externo verificó las decisiones que aquí se documentan.

Esta spec cubre exclusivamente lo que construyó `VISITS-CORE-01`. La worklist
profesional (`GET /api/v1/professional/visits`) vive hoy en los mismos archivos
pero pertenece a la spec 017; la interfaz de Hospital que la consume, a la 013.

## Objetivo

Que una cita domiciliaria asignada deje de ser solo una fila de agenda y se
convierta en una visita con ciclo de vida propio, historial append-only,
atribución humana verificable y aislamiento institucional forzado en la base,
sin crear una segunda agenda, sin duplicar al profesional asignado y sin que el
navegador pueda decidir a quién se atribuye un acto.

## Historia de usuario principal

Como profesional asignada a una visita domiciliaria, quiero registrar que la
inicié, que la completé o que no pude realizarla, para que quede constancia
institucional del acto con mi autoría y sin que otra persona pueda registrarlo
en mi nombre.

## Qué hace hoy el sistema

| Capacidad | Dónde vive | Qué hace exactamente |
|---|---|---|
| Persistencia de la visita | `prisma/migrations/20260824120000_visits_core_01/migration.sql` | Crea `HomeVisitStatus`, `home_visit` y `home_visit_transition`, 4 restricciones CHECK y 8 claves foráneas (4 de ellas compuestas y tenant-aware), el trigger `home_visit_guard`, grants de mínimo privilegio y RLS `ENABLE` + `FORCE` con política por tenant |
| Materialización transaccional | `apps/api/src/visits/home-visit-materialization.service.ts` | Crea visita `SCHEDULED` + transición de creación + evento `HOME_VISIT_MATERIALIZED` en una sola transacción `withTenant()` |
| Transiciones profesionales | `apps/api/src/visits/home-visit-transition.service.ts` | Ejecuta `IN_PROGRESS`, `COMPLETED` y `NOT_COMPLETED` con control optimista de versión, historial append-only y auditoría, todo en una transacción |
| Lectura profesional de una visita | `apps/api/src/visits/professional-visit-query.service.ts` | Devuelve UNA visita si quien pregunta es su profesional asignada y vigente. No hay listado en esta spec |
| Superficie institucional | `visits.controller.ts:141` `VisitsMaterializationController` | `POST /api/v1/visits/materialize` con `HospitalSchedulerGuard` + `InstitutionalSameOriginGuard` |
| Superficie humana | `visits.controller.ts:266` `ProfessionalVisitsController` | `GET /api/v1/professional/visits/:visitId` y `PATCH /api/v1/professional/visits/:visitId/status`, con `HumanSessionGuard`; el `PATCH` añade `SameOriginGuard` |
| Contrato de entrada | `apps/api/src/visits/visits.dto.ts:120` `asObject()` | Allowlist estricta de campos: un campo desconocido produce `400`, no se ignora |
| Auditoría | `apps/api/src/audit/audit.service.ts:58` y `:114` | Cuatro eventos: `HOME_VISIT_MATERIALIZED` (actor institucional) y `HOME_VISIT_STARTED` / `_COMPLETED` / `_NOT_COMPLETED` (actor cuenta humana) |
| Registro del módulo | `apps/api/src/visits/visits.module.ts`, `apps/api/src/app.module.ts:62` | `VisitsModule` provee TRES guards —`HospitalSchedulerGuard`, `InstitutionalSameOriginGuard` y `SameOriginGuard`— más los cuatro servicios; `HumanSessionGuard` no se provee aquí: `HumanAuthModule` lo exporta (`human-auth.module.ts:42`) y `VisitsModule` lo recibe al importarlo |

### Las dos superficies, y por qué las guardas son distintas

Materializar es un acto **administrativo**: lo ejecuta una identidad
institucional opaca con rol `HOSPITAL_SCHEDULER`, que no identifica a ninguna
persona. Iniciar, completar o dar por no realizada una visita es el acto de una
**persona concreta**: lo ejecuta una cuenta humana autenticada, y la
autorización se deriva de `principal.personId` y de ningún otro sitio.

La separación no es estilística. `tasks/VISITS-CORE-01.md` §3 la declara como el
bloqueo arquitectónico que retrasó toda la capacidad: atribuir `IN_PROGRESS` al
profesional usando la cookie de `HOSPITAL_SCHEDULER` habría **falseado la
autoría**, porque esa identidad es compartida y opaca. Por eso hay dos
controladores, dos cookies (`merdn_institutional_session` y
`merdn_human_session`), dos cadenas de guardas y ningún camino entre ellas.

### La máquina de estados de `HomeVisitStatus`

```text
   (materialización institucional)
                │
                ▼
            SCHEDULED ──────────────► NOT_COMPLETED
                │                            ▲
                ▼                            │
           IN_PROGRESS ──────────────────────┘
                │
                ▼
            COMPLETED
```

Cuatro transiciones legales y ninguna más: `SCHEDULED → IN_PROGRESS`,
`SCHEDULED → NOT_COMPLETED`, `IN_PROGRESS → COMPLETED`,
`IN_PROGRESS → NOT_COMPLETED`. `COMPLETED` y `NOT_COMPLETED` son terminales: no
aparecen como origen de ninguna transición, de modo que la inmutabilidad no
necesita una regla propia, se sigue de la tabla.

La máquina está declarada **dos veces a propósito**: en la base, como el check
`home_visit_transition_machine` (`migration.sql`, §3), y en el servicio, como
`ORIGENES_LEGALES` (`home-visit-transition.service.ts:65`). El servicio existe
para devolver un desenlace legible antes de escribir; la base es la barrera
final e independiente. Si divergieran, la transacción aborta en vez de colar una
transición ilegal.

El enum es cerrado y deliberadamente **no** incluye `EN_ROUTE`, `ARRIVED` ni
`CANCELLED`: los dos primeros implicarían despacho y ubicación no aprobados, y la
cancelación pertenece a Agenda.

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| `001-fundacion-tecnica-monorepo` | Monorepo npm, NestJS, Prisma, Compose, validación de entorno | Sin base ni configuración validada no hay migración ni módulo que registrar |
| `007-inscripcion-paciente-persistente` | `tenant`, `person`, `patient`, `audit_event`, rol `merdn_runtime`, `merdn_current_tenant()`, `withTenant()`, fail-closed | `home_visit.patientId` es FK compuesta a `patient`; toda la barrera de tenant, la RLS y la auditoría que estas tablas reutilizan nacieron ahí |
| `008-agregados-municipales-protegidos` | `institutional_identity` e `institutional_session` (migración `municipality_core_01`) | `home_visit.createdByInstitutionalIdentityId` es FK compuesta a `institutional_identity`; sin ella no hay procedencia administrativa |
| `009-hospital-pacientes-api` | Reescritura del check `audit_event_resource_required` en forma NEGATIVA (`hospital_core_01/migration.sql:72`) | Es lo que permite que los cuatro eventos nuevos de visitas entren sin modificar el check. También es la causa del riesgo residual declarado abajo |
| `010-hospital-profesionales-agenda-api` | `appointment`, `care_assignment`, `professional_profile`, `professional_affiliation`, rol `HOSPITAL_SCHEDULER` y `HospitalSchedulerGuard` | `Appointment` es la ÚNICA agenda y `CareAssignment` la ÚNICA fuente del profesional; sin ellas el trigger de origen no tiene qué validar |
| `011-identidad-humana-y-relaciones` | `human_account`, `human_session`, `HumanSessionGuard`, `SameOriginGuard`, `HumanPrincipal` y el gate probado en `MP03-B` | Es el desbloqueo literal del §3 de `VISITS-CORE-01`: sin principal humano no hay atribución verdadera de las transiciones |
| `014-sesion-profesional-en-shell` | `InstitutionalSameOriginGuard` (`institutional-same-origin.guard.ts`, commit `231f6b6`) | Protege la mutación institucional frente a una escritura provocada desde un origen ajeno |

**Dependencias externas:** PostgreSQL en marcha con las migraciones aplicadas y
con el rol `merdn_runtime` creado; Keycloak/OIDC operativo para que exista una
`HumanSession` válida (la superficie profesional es inalcanzable sin ella).
Migraciones concretas que introduce esta spec:
`20260824120000_visits_core_01`, `20260824180000_visits_core_02`,
`20260824200000_visits_core_03`, con sus tres archivos `ROLLBACK-visits_core_0*.sql`.

**Specs que dependen de esta:** `013-visitas-visibles-en-hospital` (consume
`POST /api/v1/visits/materialize` desde `apps/web/src/features/hospital/hospitalVisitsClient.ts`),
`016-acceso-de-soporte-administrativo` (añade los eventos
`SUPPORT_HOME_VISIT_READ_GRANTED` y `_DENIED` sobre este recurso) y
`017-worklist-del-visitador` (añadió `GET /api/v1/professional/visits` y
`ProfessionalVisitWorklistService` **dentro de los archivos de esta spec**).

## Escenarios de aceptación

1. Dada una cita de modalidad `HOME` en estado `ASSIGNED` con asignación de
   cuidado `ACTIVE` del mismo paciente y tenant, cuando una sesión institucional
   con rol `HOSPITAL_SCHEDULER` envía `POST /api/v1/visits/materialize`, entonces
   se crean en una sola transacción la visita `SCHEDULED`, su transición
   `null → SCHEDULED` y el evento `HOME_VISIT_MATERIALIZED`.
2. Dada una cita que ya materializó su visita, cuando se envía otra vez la misma
   materialización, entonces se responde `409 HOME_VISIT_ALREADY_MATERIALIZED` y
   no se crea una segunda visita.
3. Dada una cita de otra institución, cuando se intenta materializar, entonces la
   respuesta es idéntica a la de una cita inexistente: `404` uniforme.
4. Dada una visita `SCHEDULED` y la persona que es su profesional asignada y
   vigente, cuando envía `PATCH .../status` con `{"status":"IN_PROGRESS","expectedVersion":1}`,
   entonces la visita pasa a `IN_PROGRESS`, `startedAt` lo fija el servidor, la
   versión queda en 2 y se escribe `HOME_VISIT_STARTED`.
5. Dada una visita ya `COMPLETED`, cuando se intenta cualquier transición con
   cualquier versión, entonces se responde `409 HOME_VISIT_TRANSITION_NOT_ALLOWED`
   y nunca `HOME_VISIT_VERSION_CONFLICT`.
6. Dadas dos peticiones concurrentes con la misma `expectedVersion` sobre la
   misma visita, cuando ambas se ejecutan, entonces exactamente una escribe y la
   otra recibe `409 HOME_VISIT_VERSION_CONFLICT`.
7. Dada una persona autenticada que no es la profesional asignada de la visita,
   cuando consulta `GET .../:visitId` o intenta transicionarla, entonces recibe
   `404` idéntico al de una visita inexistente.
8. Dada una cuenta cuya afiliación profesional está terminada, cuando intenta
   transicionar una visita de una asignación que todavía figura activa, entonces
   se le deniega: la autorización exige perfil `ACTIVE`, afiliación `ACTIVE` y
   vigente, y asignación `ACTIVE` y vigente, todo a la vez.
9. Dado un cuerpo con un campo no previsto —`professionalId`, `tenantId`,
   `occurredAt`—, cuando llega a cualquiera de las dos superficies, entonces se
   rechaza con `400` en vez de ignorarse.
10. Dado que el contexto de ejecución seguro no puede confirmarse, cuando llega
    cualquier petición de visitas, entonces se responde `503` sin describir la
    topología.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se materialice una visita, EL SISTEMA DEBERÁ escribir visita,
  transición de creación y evento de auditoría en la MISMA transacción, o no
  escribir nada.
- CUANDO una cita no sea `HOME`, no esté `ASSIGNED`, no tenga asignación, o su
  asignación no esté `ACTIVE` o sea de otro paciente, EL SISTEMA DEBERÁ rechazar
  la materialización desde el trigger `home_visit_guard`, antes de crear la fila.
- EL SISTEMA NO DEBERÁ persistir en `home_visit` ni el profesional ni el horario:
  el profesional se deriva de `care_assignment` y el horario se lee de
  `appointment.scheduledStart`.
- CUANDO se ejecute una transición profesional, EL SISTEMA DEBERÁ tomar el actor
  EXCLUSIVAMENTE del principal de sesión y NO DEBERÁ admitir `professionalId`,
  `tenantId`, `patientId`, actor, rol ni marca de tiempo desde el cliente.
- SI la versión enviada no es la vigente, ENTONCES EL SISTEMA DEBERÁ responder
  `409` sin revelar la versión real.
- SI el estado actual no admite la transición pedida, ENTONCES EL SISTEMA DEBERÁ
  responder `409 HOME_VISIT_TRANSITION_NOT_ALLOWED` **antes** de comprobar la
  versión, para no invitar a reintentar algo que nunca será legal.
- EL SISTEMA DEBERÁ responder `404` uniforme ante visita inexistente, visita de
  otra institución y persona sin asignación vigente.
- EL SISTEMA NO DEBERÁ conceder `DELETE` sobre `home_visit` ni sobre
  `home_visit_transition` al rol de ejecución: la historia no se borra.
- CUANDO falle la escritura del evento de auditoría, EL SISTEMA DEBERÁ abortar la
  transacción completa (fail-closed).
- EL SISTEMA NO DEBERÁ registrar el motivo de una visita no realizada: MERDN no
  tiene aprobado ningún catálogo de causas.

## Ámbito de archivos / File scope

- `prisma/migrations/20260824120000_visits_core_01/migration.sql` — tablas, enum, restricciones, trigger, grants y RLS
- `prisma/migrations/20260824180000_visits_core_02/migration.sql` — SOLO `AuditEventType += 'HOME_VISIT_MATERIALIZED'`
- `prisma/migrations/20260824200000_visits_core_03/migration.sql` — SOLO los tres eventos de transición profesional
- `prisma/migrations/ROLLBACK-visits_core_01.sql`, `ROLLBACK-visits_core_02.sql`, `ROLLBACK-visits_core_03.sql` — reversión documentada
- `prisma/schema.prisma` — `enum HomeVisitStatus` (1278), `model HomeVisit` (1305), `model HomeVisitTransition` (1357)
- `apps/api/src/visits/home-visit-materialization.service.ts` — MP02
- `apps/api/src/visits/home-visit-transition.service.ts` — MP03
- `apps/api/src/visits/professional-visit-query.service.ts` — MP04, lectura de UNA visita
- `apps/api/src/visits/visits.controller.ts` — dos controladores; el `@Get()` de la línea 283 NO es de esta spec (es 017)
- `apps/api/src/visits/visits.dto.ts` — DTOs y allowlists; de la línea 400 en adelante es 017
- `apps/api/src/visits/visits.module.ts` — módulo y provisión de tres guards
  (`HospitalSchedulerGuard`, `InstitutionalSameOriginGuard`, `SameOriginGuard`);
  `HumanSessionGuard` llega importando `HumanAuthModule`
- `apps/api/src/audit/audit.service.ts` — `recordHomeVisitMaterializedWithin` (58) y `recordHomeVisitTransitionWithin` (114)
- `apps/api/src/app.module.ts` — registro de `VisitsModule` (línea 62)
- `apps/api/src/openapi/openapi.ts` — descripción de la superficie de visitas
- `apps/api/test/visits-db-foundation.db.test.ts` — 41 casos, MP01
- `apps/api/test/visits-materialization.db.test.ts` — 12 casos, MP02
- `apps/api/test/visits-professional-transitions.db.test.ts` — 28 casos, MP03
- `apps/api/test/visits.api.test.ts` — 32 casos, MP04 y 017

## Estado real y límites conocidos

**Lo que `tasks/VISITS-CORE-01.md` especificó y NUNCA se implementó:**

- **La materialización automática no existe.** §7.1 exige materializar
  `HomeVisit(SCHEDULED)` «dentro de la misma transacción que asigna una
  `Appointment HOME`». Medido: `grep -rn "HomeVisit" apps/api/src/hospital/` no
  devuelve nada. La materialización es un `POST` explícito y separado, de modo
  que **una cita HOME asignada puede quedar sin visita indefinidamente** si nadie
  llama al endpoint. Es la brecha funcional más importante de esta spec.
- **No existe la superficie de Hospital sobre visitas.** §8 especifica
  `GET /api/v1/visits?from&to&status&professionalId&patientId&page&pageSize` y
  `GET /api/v1/visits/:visitId`. Ninguna de las dos está implementada: el
  controlador institucional tiene exactamente una ruta, `POST .../materialize`.
- **No existe la superficie de Paciente** (`GET /api/v1/patient/visits...`).
- **No existe la superficie de Cuidador** (`GET /api/v1/caregiver/patients/:patientId/visits...`),
  pese a que `patient_caregiver_relationship` sí está persistida desde la spec 011.
- **No existen los permisos `visits.view`, `visits.execute` ni `visits.contribute`.**
  Medido: `grep -rn "visits\.view\|visits\.execute\|visits\.contribute" apps/ prisma/`
  no devuelve nada. La autorización se resuelve por consulta SQL, no por permiso nombrado.
- **Tres de los siete eventos de auditoría de §10 no existen:**
  `HOME_VISIT_LIST_ACCESS_GRANTED`, `HOME_VISIT_DETAIL_ACCESS_GRANTED` y
  `HOME_VISIT_ACCESS_DENIED`. `HOME_VISIT_CREATED` se implementó con otro nombre,
  `HOME_VISIT_MATERIALIZED`. Consecuencia concreta: **leer una visita no deja
  rastro y una denegación tampoco.**

**Lo que se implementó pero no cierra del todo:**

- **`endpoint` y `correlationId` de los eventos de visitas están siempre en
  `NULL`.** Los servicios de MP02 y MP03 los dejan nulos de forma declarada
  (`audit.service.ts:50-53`) porque en ese momento no existía endpoint; MP04
  creó el endpoint pero su allowlist prohibía tocar esos servicios, y nadie
  volvió a cerrarlo. §10 pedía registrar «endpoint, outcome, correlation ID»:
  hoy solo hay `outcome`.
- **El evento de auditoría no lleva estado ni versión anterior/nueva.** §10 lo
  pedía «mediante campos estructurados aprobados»; `model AuditEvent`
  (`schema.prisma:577`) no tiene esas columnas. Esa información existe, pero solo
  en `home_visit_transition`, que hay que correlacionar aparte.
- **Riesgo residual declarado en las propias migraciones:** el check
  `audit_event_resource_required` sigue expresado en forma negativa, de modo que
  los cuatro eventos nuevos **no están obligados por la base** a llevar
  `resourceId`. Que siempre lo lleven depende hoy solo de la aplicación. Las
  migraciones 02 y 03 lo documentan como riesgo conocido y explican por qué no se
  podía endurecer en la misma transacción.
- **El índice parcial `home_visit_transition_creation_unique` existe en
  PostgreSQL pero NO en `prisma/schema.prisma`** (Prisma no modela índices
  parciales). Una regeneración descuidada del schema desde la base podría
  perderlo de vista. La garantía «exactamente una transición de creación por
  visita» vive solo en el SQL.
- **La condición de autorización está copiada tres veces.**
  `asignacionAutorizada()` aparece idéntica en
  `home-visit-transition.service.ts:324`, `professional-visit-query.service.ts:156`
  y `professional-visit-worklist.service.ts:303`. `professional-visit-query.service.ts:37`
  explica por qué (la allowlist de MP04 prohibía modificar el servicio de MP03),
  pero el resultado es que un cambio de política de vigencia hay que aplicarlo en
  tres sitios. Además, `IdentityAccessService.hasActiveAssignmentOverPatient()`
  —el gate que la spec 011 probó en PostgreSQL con `MP03-B` precisamente para
  desbloquear esta capacidad— **no se usa en `apps/api/src/visits/`**.
- **Las migraciones 02 y 03 no crean tablas.** Añaden únicamente valores de enum
  (uno y tres respectivamente). Toda la estructura vive en la migración 01.
- **El rollback de 02 y 03 es incompleto por diseño de PostgreSQL:** no existe
  `ALTER TYPE ... DROP VALUE`, y los archivos `ROLLBACK-visits_core_02.sql` y
  `ROLLBACK-visits_core_03.sql` lo documentan en vez de simular una reversión limpia.
- **`apps/api/src/visits/` no tiene NINGUNA prueba unitaria junto al código.**
  Medido: `find apps/api/src/visits -name "*.test.ts"` devuelve 0. Otros módulos
  sí las tienen (`hospital/`, `patients/`, `institutional-auth/`, `human-auth/`).
  Toda la cobertura de visitas —5.354 líneas, 113 casos— es de **integración
  contra PostgreSQL**. La consecuencia práctica: sin base de datos levantada no
  se verifica **nada** de esta capacidad, ni siquiera el parseo de cuerpos de
  `visits.dto.ts`, que es lógica pura y sí podría probarse sin base.
- **La suite se SALTA en silencio sin base de datos.**
  `visits.api.test.ts:310` usa `describe.skipIf(!puedeEjecutarse)`: sin PostgreSQL
  migrado, la suite no falla, se omite. Un pipeline sin base puede reportar verde
  sin haber probado esta capacidad.
- **No hay superficie de cancelación, reapertura ni corrección.** Es deliberado y
  está bien: corregir un historial exige una decisión y una Task propias.

## Criterios de éxito

- Una cita `HOME` asignada materializa exactamente una visita, y la segunda
  petición se rechaza en vez de duplicar o sobrescribir.
- Ninguna persona puede registrar una transición sobre la visita de otra: el
  desenlace es `404` uniforme en los tres casos posibles.
- Ninguna visita, transición ni evento de auditoría queda huérfano: los tres se
  escriben juntos o no se escribe ninguno.
- El rol de ejecución no puede borrar filas de ninguna de las dos tablas nuevas.
- `visits-db-foundation.db.test.ts`, `visits-materialization.db.test.ts`,
  `visits-professional-transitions.db.test.ts` y `visits.api.test.ts` pasan
  **con PostgreSQL migrado y el rol `merdn_runtime` aplicado**; sin eso se omiten
  y no prueban nada.
