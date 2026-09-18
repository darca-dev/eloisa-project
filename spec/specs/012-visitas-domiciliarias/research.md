# Investigación 012 - Visitas domiciliarias

Medido sobre `develop` el 2026-08-25. Cada hallazgo indica el comando o la ruta
que lo respalda. `node_modules` está ausente y PostgreSQL no está levantado: no
se ejecutó ninguna prueba (ver R20).

## R1. La capacidad estuvo bloqueada por arquitectura, no por esfuerzo

`tasks/VISITS-CORE-01.md` fue escrita el 2026-08-22 (commit `24adc73`) con estado
literal `DESIGN COMPLETE — IMPLEMENTATION BLOCKED` y la frase «No autoriza a
Claude Code a implementar todavía».

El motivo está en su §3: `HOSPITAL_SCHEDULER` es una identidad institucional
compartida y opaca, no vinculada a `ProfessionalProfile`. Usarla para atribuir
`IN_PROGRESS` habría falseado la autoría. El diseño nombra el prerequisito
—`IDENTITY-RELATIONSHIPS-CORE-01`— y la implementación no arranca hasta que ese
prerequisito existe: dos días de distancia entre `24adc73` (diseño, 08-22) y
`d8500c9` (primer commit de código, 08-24), con `03255de` (identidad humana,
08-24) en medio.

## R2. Cuatro micropaquetes, cuatro commits `feat()`, sin mezcla

`git show --stat` sobre los commits de `history.md`:

| Paquete | Commit | Archivos | Qué añadió |
|---|---|---|---|
| MP01 | `d8500c9` | 4 | migración `visits_core_01` (397 líneas SQL), `schema.prisma` (+141), rollback, `visits-db-foundation.db.test.ts` (1.361) |
| MP02 | `7b2bdb1` | 6 | `home-visit-materialization.service.ts` (323), migración `visits_core_02` (51), `audit.service.ts` (+45), test (788) |
| MP03 | `fef1dae` | 6 | `home-visit-transition.service.ts` (381), migración `visits_core_03` (85), `audit.service.ts` (+79), test (1.340) |
| MP04 | `62e3147` | 8 | `visits.controller.ts` (482), `visits.dto.ts` (380), `professional-visit-query.service.ts` (194), `visits.module.ts` (58), `app.module.ts`, `openapi.ts`, tests (1.319 + 242) |

Ningún commit de implementación toca archivos fuera de su allowlist declarada.
En particular `62e3147` **no modifica** los servicios de MP02 ni MP03, tal como
`tasks/VISITS-CORE-01-MP04-API.md` exigía.

## R3. Las migraciones 02 y 03 NO crean estructura

`grep -oE 'CREATE TABLE "[a-z_]+"'` sobre las tres migraciones:

- `20260824120000_visits_core_01` → `home_visit`, `home_visit_transition`.
- `20260824180000_visits_core_02` → **ninguna**. Contiene una sola sentencia
  efectiva: `ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HOME_VISIT_MATERIALIZED'`.
- `20260824200000_visits_core_03` → **ninguna**. Tres `ALTER TYPE ... ADD VALUE`:
  `HOME_VISIT_STARTED`, `HOME_VISIT_COMPLETED`, `HOME_VISIT_NOT_COMPLETED`.

Las dos migraciones pequeñas existen por una restricción de PostgreSQL que ambas
documentan: `ALTER TYPE ... ADD VALUE` se admite dentro de la transacción de la
migración, pero el valor recién añadido **no puede usarse en esa misma
transacción**. Por eso el valor de enum y su primer uso viven en commits
distintos, y por eso ninguna de las dos inserta filas.

## R4. Todo el peso estructural está en `visits_core_01`

397 líneas de SQL. Comprobado con
`grep -oE 'CREATE TABLE|ADD CONSTRAINT|CREATE (UNIQUE )?INDEX|ENABLE ROW LEVEL SECURITY|FORCE|CREATE POLICY|CREATE TRIGGER|GRANT'`:

- 2 tablas, 1 enum cerrado de 4 valores.
- 5 índices únicos/normales sobre `home_visit`, 3 sobre `home_visit_transition`.
- 4 CHECK nombrados: `home_visit_version_positive`,
  `home_visit_status_timestamps`, `home_visit_temporal_order`,
  `home_visit_transition_machine`; más 8 FK, ninguna `ON DELETE CASCADE`, y el
  índice parcial `home_visit_transition_creation_unique`.
- 1 trigger `BEFORE INSERT`, `merdn_home_visit_guard()`, `SECURITY INVOKER`.
- `ENABLE` **y** `FORCE ROW LEVEL SECURITY` en las dos tablas, con política
  `FOR ALL TO merdn_runtime USING/WITH CHECK ("tenantId" = merdn_current_tenant())`.
- Grants: `SELECT, INSERT, UPDATE` en `home_visit`; `SELECT, INSERT` en
  `home_visit_transition`. **`DELETE` no se concede en ninguna de las dos.**

Ninguna FK es `CASCADE`: cuatro son `NO ACTION`/`RESTRICT` hacia cita, paciente,
asignación e identidad creadora. El comentario del SQL lo justifica: la visita es
un registro material con procedencia, no puede desaparecer como efecto colateral.

## R5. La ausencia de columnas es la garantía, no una omisión

`home_visit` **no tiene** `professionalId` ni columna de horario. El comentario
del SQL (§2) y el de `schema.prisma:1285-1304` dicen lo mismo: el profesional se
deriva de `care_assignment` y el horario se lee de `appointment.scheduledStart`.
La formulación exacta es «ninguna comprobación podría sustituirla, porque no
existe el valor que podría divergir». Es una decisión de diseño verificable:
`grep -n "professionalId" prisma/schema.prisma` no muestra esa columna en
`HomeVisit`.

## R6. El trigger valida el ORIGEN una sola vez, y esto es deliberado

`merdn_home_visit_guard()` se dispara `BEFORE INSERT` y **no** en `UPDATE`.
Comprueba cinco cosas: la cita existe en el tenant, es `HOME`, está `ASSIGNED`,
su paciente coincide, su asignación coincide y está `ACTIVE` y es del mismo
paciente.

El SQL explica por qué no se revalida en `UPDATE`: si se revalidara, una visita
realmente iniciada no podría registrarse como completada cuando la cita o la
asignación evolucionaran después, «y el historial perdería justamente el hecho
que debe conservar». Es `SECURITY INVOKER` a propósito, para quedar sujeto a RLS
y no convertirse en canal de lectura privilegiada.

## R7. MP02: materialización transaccional, y no duplica reglas de la base

`apps/api/src/visits/home-visit-materialization.service.ts:120` abre
`this.prisma.withTenant(tenantId, ...)` y escribe tres cosas dentro:
`homeVisit.create` (223), `homeVisitTransition.create` (167) y
`audit.recordHomeVisitMaterializedWithin` (184).

Lo notable es lo que **no** hace: no reimplementa modalidad, estado, coincidencia
de paciente ni asignación. Se apoya en el trigger y traduce su fallo. Solo hay
una comprobación previa, en la línea 140 (`careAssignmentId === null`), y el
comentario justifica que no es duplicación: sin asignación no hay fila que
construir y el trigger ni siquiera llegaría a evaluarse.

La traducción de errores no mira el texto del mensaje sino el SQLSTATE:
`esRechazoDelGuard()` (285) compara contra `'23514'` extraído de
`meta.driverAdapterError.cause.originalCode`. El comentario lo razona: «el
mensaje es humano y podría cambiar sin aviso».

## R8. MP03: la autorización viaja DENTRO de la escritura, no antes

`home-visit-transition.service.ts` hace la lectura autorizada en la línea 173 y
después repite la **condición completa** dentro del `updateMany` (218-232):
`id`, `tenantId`, `status: origen`, `version: expectedVersion` y
`careAssignment: autorizacion`. El comentario explica el efecto: PostgreSQL
reevalúa la condición tras liberar el bloqueo de fila, de modo que en una carrera
solo la primera escritura encuentra `version = expectedVersion`. `count !== 1`
(234) es la señal de haber perdido.

Un detalle de contrato deliberado, en la línea 188: **primero se comprueba la
legalidad de la transición, después la versión**. El razonamiento está escrito:
una visita terminal no admite la operación con ninguna versión, y responder
«versión obsoleta» invitaría a reintentar algo que nunca será legal.

La versión se incrementa con `{ increment: 1 }`, es decir en la base, no en la
aplicación (229).

## R9. La cadena de autorización profesional, medida

`asignacionAutorizada()` (`home-visit-transition.service.ts:324`,
`professional-visit-query.service.ts:156`) construye una única condición SQL que
exige, a la vez:

1. `CareAssignment` `ACTIVE`, `startsAt <= now`, `endsAt` nulo o `> now`;
2. `professional.personId === principal.personId` y perfil `ACTIVE`;
3. al menos una `ProfessionalAffiliation` `ACTIVE` con `startsOn <= hoy` y
   `endsOn` nulo o `>= hoy`.

`principal.personId` viene de `HumanPrincipal`
(`apps/api/src/identity-access/human-principal.ts:20`), que solo puede crear el
validador de sesión. La clave con que el guard lo adjunta a la petición es un
`Symbol` (`HUMAN_PRINCIPAL_KEY`, línea 35), precisamente para que ningún cuerpo,
consulta ni cabecera pueda inyectarlo.

`fechaSinHora()` reduce el instante a su día UTC antes de comparar con las
columnas `DATE` de la afiliación, para no reintroducir desplazamiento de zona.

## R10. Doble superficie con guardas disjuntas, verificado en el controlador

`grep -nE "@(Controller|Get|Post|Patch|UseGuards)\(" apps/api/src/visits/visits.controller.ts`:

```
127  @Controller(VISITS_MATERIALIZE_PATH)        -> 'api/v1/visits'
140  @UseGuards(HospitalSchedulerGuard, InstitutionalSameOriginGuard)
149    @Post('materialize')
255  @Controller(PROFESSIONAL_VISITS_PATH)       -> 'api/v1/professional/visits'
265  @UseGuards(HumanSessionGuard)
283    @Get()                                    <- NO es de esta spec (017)
352    @Get(':visitId')
404    @Patch(':visitId/status')
411    @UseGuards(SameOriginGuard)
```

La misma consulta sobre `git show 62e3147:...` devuelve exactamente tres rutas:
`@Post('materialize')`, `@Get(':visitId')` y `@Patch(':visitId/status')`. El
`@Get()` de colección lo añadió `15a9ae1` (`feat(visitador): add professional
worklist api`), que pertenece a la spec 017.

El comentario del controlador (105-112) da la razón de la separación: «cada guard
mira solo la suya y las demás son inertes» — presentar las tres cookies del
sistema a la vez no produce un principal ambiguo. `SameOriginGuard` solo se
aplica al `PATCH`, no a los `GET`, porque solo la mutación necesita protección
frente a una escritura provocada desde un origen ajeno.

## R11. El módulo provee tres guards y no amplía superficies exportadas

`apps/api/src/visits/visits.module.ts:58-66` declara como providers
`HospitalSchedulerGuard`, `InstitutionalSameOriginGuard` y `SameOriginGuard`
además de los cuatro servicios. El comentario (42-48) lo justifica:
`@UseGuards(Clase)` obliga a Nest a resolver la instancia en el módulo del
controlador, y declararlos aquí evita ampliar la superficie exportada de los
módulos de autenticación y evita crear un ciclo. `VisitsModule` está registrado
en `apps/api/src/app.module.ts:62`.

## R12. Auditoría: cuatro eventos, dos clases de actor, y dos campos vacíos

`apps/api/src/audit/audit.service.ts`:

- `recordHomeVisitMaterializedWithin` (58): `actorType: 'INSTITUTIONAL_IDENTITY'`,
  `actorRole: input.role`, evento `HOME_VISIT_MATERIALIZED`.
- `recordHomeVisitTransitionWithin` (114): `actorType: 'HUMAN_ACCOUNT'`,
  `actorRole: null` —el comentario indica que la base lo exige vía
  `audit_event_actor_role_scope`— y el evento se deriva del estado destino
  mediante `EVENTO_POR_ESTADO_DESTINO`, un `Record` completo del tipo, de modo
  que añadir un destino sin su evento no compila.

**Hallazgo:** ninguno de los dos métodos escribe `endpoint` ni `correlationId`.
El comentario de las líneas 50-53 lo declara: «MP02 no crea ningún endpoint HTTP
[...] El paquete del endpoint los suministrará». MP04 creó el endpoint, pero su
allowlist prohibía modificar los servicios de MP02 y MP03, y nadie cerró el
pendiente. `grep -rn "correlationId" apps/api/src/visits/` no devuelve nada.

`grep -n "HOME_VISIT" prisma/schema.prisma` devuelve exactamente cuatro valores
de `AuditEventType` (líneas 148-151), más `SUPPORT_HOME_VISIT_READ_GRANTED` y
`_DENIED` (167-168), que pertenecen a la spec 016.

## R13. Lo que el diseño pedía y no existe

Comprobado uno a uno contra el código:

| §  de `VISITS-CORE-01` | Pedía | Estado medido |
|---|---|---|
| §7.1 | Materializar dentro de la MISMA transacción que asigna la cita | **No.** `grep -rn "HomeVisit" apps/api/src/hospital/` → vacío. Es un `POST` separado |
| §8 Hospital | `GET /api/v1/visits` y `GET /api/v1/visits/:visitId` | **No existen.** El controlador institucional tiene una sola ruta |
| §8 Paciente | `GET /api/v1/patient/visits...` | **No existe** |
| §8 Cuidador | `GET /api/v1/caregiver/patients/:patientId/visits...` | **No existe** |
| §9 | Permisos `visits.view`, `visits.execute`, `visits.contribute` | **No existen.** `grep -rn "visits\.view\|visits\.execute\|visits\.contribute" apps/ prisma/` → vacío |
| §10 | 7 eventos de auditoría | **4.** Faltan `HOME_VISIT_LIST_ACCESS_GRANTED`, `HOME_VISIT_DETAIL_ACCESS_GRANTED` y `HOME_VISIT_ACCESS_DENIED`. `HOME_VISIT_CREATED` se llamó `HOME_VISIT_MATERIALIZED` |
| §10 | Registrar endpoint, correlation ID, estado y versión anterior/nueva | **No.** Ver R12; `model AuditEvent` (`schema.prisma:577`) no tiene columnas de estado ni versión |
| §5.3 | `performedByPrincipalId` | Implementado como `performedByHumanAccountId`, FK a `human_account`. Equivalente y mejor tipado |

Consecuencia operativa concreta de la primera fila: una cita `HOME` asignada
puede quedar **sin visita** si nadie llama al endpoint de materialización. No hay
nada en la base ni en Hospital que lo garantice.

## R14. `apps/api/src/visits/` no tiene NINGUNA prueba unitaria

`find apps/api/src/visits -name "*.test.ts" -o -name "*.spec.ts" | wc -l` → `0`.

Para contraste, `find apps/api/src -name "*.test.ts"` devuelve 24 archivos en
`patients/`, `hospital/`, `institutional-auth/`, `human-auth/`, `municipality/`,
`identity-access/`, `config/`, `health/`, `people-relationships/` y
`enrollment-sessions/`. Visitas es el módulo grande que no tiene ninguna.

Toda su cobertura es de integración contra PostgreSQL:

| Archivo | Líneas | `it()` | `describe()` |
|---|---:|---:|---:|
| `apps/api/test/visits-db-foundation.db.test.ts` | 1.361 | 41 | 10 |
| `apps/api/test/visits-materialization.db.test.ts` | 788 | 12 | 7 |
| `apps/api/test/visits-professional-transitions.db.test.ts` | 1.340 | 28 | 9 |
| `apps/api/test/visits.api.test.ts` | 1.865 | 32 | 5 |
| **Total** | **5.354** | **113** | **31** |

Los bloques cubren exactamente lo que las tasks exigían: RLS con dos tenants y
contexto ausente (db-foundation §7), mínimo privilegio del rol (§8), «el borrado
no destruye procedencia ni evidencia» (§9), atomicidad todo-o-nada
(materialization §2), carrera concurrente con un solo ganador (transitions §7),
y reversión ante fallo de historial o auditoría (transitions §8).

El coste de esa elección es medible: `visits.dto.ts` contiene lógica **pura**
—`asObject()`, `parseMaterializeBody()`, `parseStatusChangeBody()`— que podría
probarse sin base de datos y hoy solo se ejerce a través de la API.

## R15. La suite se omite en silencio sin base de datos

`apps/api/test/visits.api.test.ts:120` define
`const puedeEjecutarse = availability.available && availability.migrated;` y la
línea 310 abre `describe.skipIf(!puedeEjecutarse)(...)`. Los tres `.db.test.ts`
importan el mismo `./database-availability`.

Efecto: sin PostgreSQL migrado la suite **no falla, se omite**. Un pipeline sin
base puede reportar verde sin haber ejercido esta capacidad.

## R16. Divergencia entre `schema.prisma` y la base

`grep -n "creation_unique\|home_visit_transition_machine\|home_visit_status_timestamps\|home_visit_guard" prisma/schema.prisma`
→ ninguna coincidencia.

Cuatro garantías existen solo en SQL y son invisibles para Prisma: el índice
parcial `home_visit_transition_creation_unique` (Prisma no modela índices
parciales `WHERE`), los tres `CHECK` y el trigger. `schema.prisma:1382` solo
declara `@@unique([id, tenantId])` y `@@index([tenantId, homeVisitId, occurredAt])`.

La garantía «exactamente una transición de creación por visita», que
`VISITS-CORE-01` §5.3 exige literalmente, depende por completo de que nadie
regenere el schema desde la base y aplique el resultado como fuente de verdad.

## R17. La condición de autorización está copiada tres veces

`grep -n "function asignacionAutorizada" apps/api/src/visits/*.ts`:

```
home-visit-transition.service.ts:324
professional-visit-query.service.ts:156
professional-visit-worklist.service.ts:303   (spec 017)
```

Junto con `fechaSinHora()`, tres veces también. `professional-visit-query.service.ts:37`
documenta el motivo —la allowlist de MP04 prohibía modificar el servicio de MP03—
y argumenta que lo compartido de verdad es la barrera (mismo `withTenant()`,
misma RLS). El argumento es honesto, pero el efecto sigue siendo que un cambio de
política de vigencia hay que aplicarlo en tres archivos.

Hallazgo adicional: `grep -rn "IdentityAccessService\|hasActiveAssignmentOverPatient" apps/api/src/visits/`
no devuelve nada. El gate `IdentityAccessService.hasActiveAssignmentOverPatient()`,
que `tasks/IDENTITY-RELATIONSHIPS-CORE-01-MP03-B.md` probó en PostgreSQL
declarando como objetivo literal «cerrar con evidencia PostgreSQL el gate
Profesional autenticado → paciente asignado requerido por `VISITS-CORE-01`»,
**no lo usa el módulo de visitas**: visitas reimplementó la condición en Prisma.

## R18. No hay auditoría de Codex para esta capacidad

`ls reviews/ | grep -i visit` → salida vacía, código de salida `1`.

`reviews/` contiene 22 entradas, de las cuales 20 son informes (dos de
`REVIEW-001`, uno de `REVIEW-002`, nueve de la serie `REVIEW-003H`, cinco de
`ALCALDIA`, más `BRAND-01`, `MERDN-ORCHESTRATOR-V1` y `MVP-CORE-01`); las otras
dos son `REVIEW-TEMPLATE.md` y `README.md`, que no son informes. Ninguno cubre
`VISITS-CORE-01` ni sus micropaquetes. `grep -ril "visit" reviews/` devuelve cuatro archivos, pero son
menciones de contexto en auditorías de otras capacidades, no revisiones de esta.

Dato relevante: es la capacidad de dominio más extensa del repositorio (2.612
líneas de servicio y controlador, 397 de SQL, 5.354 de pruebas) y no tiene
revisión externa registrada.

## R19. Quién consume esta superficie hoy

`grep -rn "professional/visits\|visits/materialize\|api/v1/visits" apps/web/src`:

- `apps/web/src/features/hospital/hospitalVisitsClient.ts:120-121` define
  `'/api/v1/visits'` y `'/api/v1/professional/visits'`.
- `git log --diff-filter=A` sobre ese archivo → `0e5d183`
  `feat(hospital): add visits api client`, que figura en
  `spec/specs/013-visitas-visibles-en-hospital/history.md`.

`grep -rln "HomeVisit\|homeVisit" packages/` → vacío: `packages/shared` no
comparte ningún tipo de visitas. El contrato web↔API se mantiene por duplicación
manual, no por tipo compartido.

## R20. Verificación no ejecutada

No se ejecutó ninguna prueba. `ls -d node_modules` y `ls -d apps/api/node_modules`
→ **ausentes**; PostgreSQL no está levantado. En consecuencia **no** se pudo
comprobar:

- que los 113 casos de las cuatro suites pasen;
- que las tres migraciones apliquen limpiamente sobre una base vacía;
- que el trigger `merdn_home_visit_guard()` rechace efectivamente cada uno de sus
  OCHO caminos de error: cita inexistente en el tenant, modalidad ≠ HOME, estado
  ≠ ASSIGNED, paciente discrepante, asignación discrepante, asignación de cuidado
  inexistente en el tenant, asignación no ACTIVE y asignación de otro paciente;
- que la política RLS falle cerrada sin contexto de tenant (afirmado por el SQL
  y probado en `visits-db-foundation.db.test.ts` §7, pero no ejecutado aquí);
- que el `updateMany` condicional deje exactamente un ganador en una carrera real
  (probado en `visits-professional-transitions.db.test.ts` §7, no ejecutado);
- que los rollbacks `ROLLBACK-visits_core_0*.sql` reviertan sin dejar residuos;
- que el documento OpenAPI generado contenga las operaciones declaradas
  (`apps/api/test/openapi.test.ts` creció 232 líneas netas en `62e3147` —237
  inserciones y 5 borrados—, no ejecutado);
- que TypeScript compile hoy el módulo de visitas.

Todo lo afirmado en R1–R19 es lectura estática de archivos y de `git`, no
ejecución.
