# Tareas 012 - Visitas domiciliarias

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

### MP01 — Fundación de base de datos (`d8500c9`)

- [x] Enum cerrado `HomeVisitStatus` con cuatro valores: `SCHEDULED`,
      `IN_PROGRESS`, `COMPLETED`, `NOT_COMPLETED`
      (`prisma/migrations/20260824120000_visits_core_01/migration.sql`, §1).
- [x] Tabla `home_visit` **sin** columna `professionalId` y **sin** columna de
      horario: el profesional se deriva de `care_assignment` y el horario de
      `appointment.scheduledStart` (migración §2; `prisma/schema.prisma:1305`).
- [x] Tabla `home_visit_transition` append-only con `fromStatus` nulable
      (`prisma/schema.prisma:1357`).
- [x] Índice único `home_visit_appointment_tenant_unique`: una cita materializa
      como mucho UNA visita.
- [x] Índice único **parcial** `home_visit_transition_creation_unique`
      (`WHERE "fromStatus" IS NULL`): exactamente una transición de creación.
- [x] Cuatro FK compuestas tenant-aware hacia `appointment`, `patient`,
      `care_assignment` e `institutional_identity`; ninguna `CASCADE`.
- [x] `CHECK home_visit_version_positive`: la versión empieza en 1 y solo crece.
- [x] `CHECK home_visit_status_timestamps`: coherencia exacta de `startedAt` y
      `endedAt` con cada uno de los cuatro estados, en un solo check para que las
      cuatro mitades no diverjan.
- [x] `CHECK home_visit_temporal_order`: `endedAt >= startedAt` cuando ambos
      existen; la duración cero se admite.
- [x] `CHECK home_visit_transition_machine`: las cuatro transiciones legales más
      la exigencia de actor humano en todas ellas y actor nulo en la creación.
- [x] Trigger `merdn_home_visit_guard()` `BEFORE INSERT`, `SECURITY INVOKER`:
      valida modalidad `HOME`, estado `ASSIGNED`, coincidencia de paciente y
      asignación, y asignación `ACTIVE` del mismo paciente.
- [x] `ENABLE` **y** `FORCE ROW LEVEL SECURITY` en las dos tablas, con política
      `USING`/`WITH CHECK` por `merdn_current_tenant()`.
- [x] Grants de mínimo privilegio: `SELECT, INSERT, UPDATE` en `home_visit`;
      `SELECT, INSERT` en `home_visit_transition`. **Sin `DELETE` en ninguna.**
- [x] Migración sin inserción de datos: instalación vacía = ninguna visita.
- [x] Rollback documentado (`prisma/migrations/ROLLBACK-visits_core_01.sql`).
- [x] 41 casos de integración (`apps/api/test/visits-db-foundation.db.test.ts`),
      incluidos RLS con dos tenants, contexto ausente, mínimo privilegio del rol
      y «el borrado no destruye procedencia ni evidencia».

### MP02 — Materialización transaccional (`7b2bdb1`)

- [x] `HomeVisitMaterializationService.materialize()` escribe visita `SCHEDULED`,
      transición `null → SCHEDULED` y evento `HOME_VISIT_MATERIALIZED` en una
      sola transacción `withTenant()`
      (`apps/api/src/visits/home-visit-materialization.service.ts:120`).
- [x] Actor = identidad institucional opaca, nunca la persona visitadora.
- [x] Filtro explícito por tenant **además** de RLS
      (`home-visit-materialization.service.ts:123`).
- [x] Traducción de errores por SQLSTATE `'23514'` y por código Prisma `P2002`,
      nunca por texto de mensaje
      (`home-visit-materialization.service.ts:274-287`).
- [x] `404` uniforme para cita inexistente y cita de otra institución.
- [x] `409 HOME_VISIT_ALREADY_MATERIALIZED` en el segundo intento.
- [x] `409 HOME_VISIT_APPOINTMENT_NOT_MATERIALIZABLE` sin decir qué regla falló.
- [x] Fallo de auditoría revierte la transacción completa (fail-closed).
- [x] `AuditEventType += 'HOME_VISIT_MATERIALIZED'`
      (`prisma/migrations/20260824180000_visits_core_02/migration.sql`).
- [x] 12 casos de integración (`apps/api/test/visits-materialization.db.test.ts`),
      incluida la atomicidad todo-o-nada y la ausencia de dato personal en la
      auditoría.

### MP03 — Transiciones profesionales (`fef1dae`)

- [x] `HomeVisitTransitionService.transition()` actualiza visita, escribe la
      transición y el evento en una sola transacción
      (`apps/api/src/visits/home-visit-transition.service.ts:139`).
- [x] Máquina declarada en el servicio (`ORIGENES_LEGALES`, línea 65) espejo del
      check de MP01, con la base como barrera final e independiente.
- [x] Actor = cuenta humana autenticada; se toma de `principal.humanAccountId` y
      de ningún otro sitio (línea 261).
- [x] El servicio **no admite** `professionalId`, `tenantId`, `patientId`, actor,
      rol ni marca de tiempo desde el cliente. El parámetro no existe.
- [x] Autorización repetida **dentro** de la condición del `updateMany`, no solo
      en la lectura previa (líneas 218-232).
- [x] Control optimista: `version: { increment: 1 }` lo aplica la base; `count !== 1`
      significa carrera perdida (línea 234).
- [x] Orden de desenlaces deliberado: transición ilegal **antes** que versión
      obsoleta (línea 188).
- [x] Estados terminales inmutables por construcción: `COMPLETED` y
      `NOT_COMPLETED` no figuran como origen de ninguna transición.
- [x] Instantes fijados por el servidor: `startedAt` al entrar en `IN_PROGRESS`,
      `endedAt` al entrar en terminal, sin tocar `startedAt` (línea 364).
- [x] Cadena de autorización completa en una sola condición SQL: asignación
      `ACTIVE` y vigente, perfil `ACTIVE` de esa persona, afiliación `ACTIVE` y
      vigente (línea 324).
- [x] Comparación de fechas puras reducida a día UTC (`fechaSinHora`, línea 379).
- [x] Tres valores de `AuditEventType` añadidos
      (`prisma/migrations/20260824200000_visits_core_03/migration.sql`).
- [x] `actorRole` nulo en los eventos humanos, exigido por
      `audit_event_actor_role_scope` (`apps/api/src/audit/audit.service.ts:114`).
- [x] Correspondencia estado-destino → evento como `Record` completo del tipo:
      añadir un destino sin evento no compila (`audit.service.ts:159`).
- [x] 28 casos de integración
      (`apps/api/test/visits-professional-transitions.db.test.ts`), incluidas la
      carrera concurrente con un solo ganador y la reversión ante fallo de
      historial o auditoría.

### MP04 — API protegida (`62e3147`)

- [x] `POST /api/v1/visits/materialize` con `HospitalSchedulerGuard` +
      `InstitutionalSameOriginGuard` (`apps/api/src/visits/visits.controller.ts:140`).
- [x] `GET /api/v1/professional/visits/:visitId` con `HumanSessionGuard`
      (`visits.controller.ts:352`).
- [x] `PATCH /api/v1/professional/visits/:visitId/status` con `HumanSessionGuard`
      + `SameOriginGuard` solo en la mutación (`visits.controller.ts:404-411`).
- [x] Doble superficie con cookies disjuntas: cada guard mira solo la suya y las
      demás son inertes (comentario del controlador, líneas 105-112).
- [x] `ProfessionalVisitQueryService.findAuthorized()` devuelve UNA visita con la
      misma cadena de autorización que MP03
      (`apps/api/src/visits/professional-visit-query.service.ts:71`).
- [x] Proyección minimizada: solo identificadores opacos, estado, versión y
      timestamps. Sin paciente, profesional, persona, horario ni dato clínico.
- [x] Allowlist estricta de cuerpo: campo desconocido → `400`, no se ignora
      (`apps/api/src/visits/visits.dto.ts:120`).
- [x] `expectedVersion` sin valor por defecto: sin él la escritura sería ciega
      (`visits.dto.ts:158`).
- [x] Validación de UUID en el borde, antes de tocar la base
      (`visits.controller.ts:530`).
- [x] Principal leído bajo clave `Symbol`, no inyectable por cuerpo, consulta ni
      cabecera (`apps/api/src/identity-access/human-principal.ts:35`).
- [x] `503` fail-closed ante `RuntimeContextUnavailableError` sin describir la
      topología (`visits.controller.ts:583`).
- [x] Cabeceras de no-caché fijadas por los guards y por `noStore(response)`.
- [x] `VisitsModule` provee TRES guards —`HospitalSchedulerGuard`,
      `InstitutionalSameOriginGuard` y `SameOriginGuard`— y está registrado en
      `apps/api/src/app.module.ts:62`. `HumanSessionGuard` no se provee ahí:
      `HumanAuthModule` lo exporta (`human-auth.module.ts:42`) y `VisitsModule`
      lo recibe al importarlo.
- [x] Descripción de la superficie actualizada en
      `apps/api/src/openapi/openapi.ts`.
- [x] 32 casos de integración (`apps/api/test/visits.api.test.ts`), secciones A
      (materialización), B (consulta), C (transiciones) y D (contexto no
      confirmado). La sección E es de la spec 017.

## Límites conocidos (no autorizados como trabajo)

### Especificado en `tasks/VISITS-CORE-01.md` y nunca implementado

- [ ] **Materialización automática al asignar la cita** (§7.1): hoy es un `POST`
      separado. `grep -rn "HomeVisit" apps/api/src/hospital/` no devuelve nada.
      Una cita `HOME` asignada puede quedar sin visita indefinidamente.
- [ ] `GET /api/v1/visits?from&to&status&professionalId&patientId&page&pageSize`
      (§8, superficie de Hospital sobre visitas).
- [ ] `GET /api/v1/visits/:visitId` (§8, detalle institucional).
- [ ] `GET /api/v1/patient/visits` y `GET /api/v1/patient/visits/:visitId` (§8).
- [ ] `GET /api/v1/caregiver/patients/:patientId/visits` y su detalle (§8), pese
      a que `patient_caregiver_relationship` sí existe desde la spec 011.
- [ ] Permisos nombrados `visits.view`, `visits.execute`, `visits.contribute`
      (§9). No existen: la autorización se resuelve por consulta SQL.
- [ ] Evento `HOME_VISIT_LIST_ACCESS_GRANTED` (§10). **Leer no deja rastro.**
- [ ] Evento `HOME_VISIT_DETAIL_ACCESS_GRANTED` (§10).
- [ ] Evento `HOME_VISIT_ACCESS_DENIED` (§10). **Una denegación no deja rastro.**
- [ ] Registro de estado y versión anterior/nueva en el evento de auditoría
      (§10): `model AuditEvent` (`prisma/schema.prisma:577`) no tiene esas
      columnas. La información existe solo en `home_visit_transition`.

### Implementado con deuda declarada

- [ ] `endpoint` y `correlationId` de los cuatro eventos de visitas siguen en
      `NULL`. MP02 y MP03 lo dejaron declarado
      (`apps/api/src/audit/audit.service.ts:50-53`); la allowlist de MP04
      prohibía tocar esos servicios y nadie cerró el pendiente.
- [ ] El check `audit_event_resource_required` no obliga a los cuatro eventos
      nuevos a llevar `resourceId`. Declarado como riesgo residual en las propias
      migraciones 02 y 03.
- [ ] El índice parcial `home_visit_transition_creation_unique`, los tres `CHECK`
      y el trigger **no aparecen en `prisma/schema.prisma`**: Prisma no los
      modela. Regenerar el schema desde la base los perdería de vista.
- [ ] `asignacionAutorizada()` está copiada en tres archivos
      (`home-visit-transition.service.ts:324`,
      `professional-visit-query.service.ts:156`,
      `professional-visit-worklist.service.ts:303`).
- [ ] `IdentityAccessService.hasActiveAssignmentOverPatient()` —probado en
      PostgreSQL por `tasks/IDENTITY-RELATIONSHIPS-CORE-01-MP03-B.md` con este
      uso como objetivo declarado— **no se usa en `apps/api/src/visits/`**.
- [ ] Cero pruebas unitarias en `apps/api/src/visits/`
      (`find apps/api/src/visits -name "*.test.ts"` → 0). Otros diez módulos de
      `apps/api/src/` sí las tienen. La lógica pura de `visits.dto.ts` solo se
      ejerce a través de la API.
- [ ] Las suites se **omiten en silencio** sin PostgreSQL migrado
      (`apps/api/test/visits.api.test.ts:310`, `describe.skipIf`). Un pipeline
      sin base puede reportar verde sin probar nada de esta capacidad.
- [ ] `packages/shared` no expone ningún tipo de visitas: el contrato web↔API se
      mantiene por duplicación manual y un cambio de DTO no rompe el cliente web
      en compilación.
- [ ] El rollback de las migraciones 02 y 03 no puede retirar los valores de enum
      (PostgreSQL no ofrece `ALTER TYPE ... DROP VALUE`). Los archivos lo
      documentan en vez de simular una reversión limpia.
- [ ] **No existe auditoría externa de esta capacidad.**
      `ls reviews/ | grep -i visit` → vacío. Es la capacidad de dominio más
      extensa del repositorio sin informe registrado.

## Verificación pendiente

- [ ] Ejecutar las cuatro suites (113 casos) con PostgreSQL levantado, las once
      migraciones aplicadas y el rol `merdn_runtime` creado.
- [ ] Aplicar `20260824120000_visits_core_01`, `..._02` y `..._03` sobre una base
      vacía y confirmar que no fallan.
- [ ] Confirmar que `merdn_home_visit_guard()` rechaza efectivamente cada uno de
      sus OCHO caminos de error: cita inexistente en el tenant, modalidad ≠ HOME,
      estado ≠ ASSIGNED, paciente discrepante, asignación discrepante, asignación
      de cuidado inexistente en el tenant, asignación no ACTIVE y asignación de
      otro paciente.
- [ ] Confirmar que la política RLS falla cerrada sin contexto de tenant.
- [ ] Confirmar que el `updateMany` condicional deja exactamente un ganador en
      una carrera concurrente real.
- [ ] Ejecutar `apps/api/test/openapi.test.ts` y confirmar que el documento
      generado contiene las operaciones declaradas.
- [ ] Ejecutar los `ROLLBACK-visits_core_0*.sql` y confirmar que revierten sin
      dejar residuos, más allá de los valores de enum que no pueden retirarse.
- [ ] Confirmar que TypeScript compila hoy el módulo de visitas.

> Nada de lo anterior se ejecutó el 2026-08-25: `node_modules` está ausente y
> PostgreSQL no está levantado. Todo lo afirmado en este archivo es lectura
> estática de archivos y de `git`.
