# 055 / MP07A — Entrega de Claude Code (A01/A03/A04/A07/A09)

Fecha: 2026-10-22. Task ID `055-MP07A`. Contrato: `MP07-CORRECCIONES-A01-A10.md`; decisión `2026-10-22-055-correcciones-a01-a10.md`.

**Estado: implementada con verificación pendiente.** Las suites PostgreSQL/API quedan preparadas y NO EJECUTADAS por Claude. 055 no está completa. MP07B no se inició. No hubo Git, servidores, Docker, DB, red ni agentes.

Esta sesión continúa una ejecución anterior que se cortó por límite de sesión sin entregar. Los cambios de producción y pruebas que ya estaban en el árbol se conservaron: no se revirtieron ni se reimplementaron. Esta sesión añadió solo pruebas y este informe. Lo que hizo otro Claude, según informó el PO, se integra sin sobrescribirlo:

- A03 en servicio/contrato: tras resolver un recibo, una validación nueva exige `observableDefinitionId`.
- `test-db-provision.mjs` y `baseline-catalog.test.mjs` incluyen la migración 30.

## 00. Segundo seguimiento (2026-10-22, después de la segunda ejecución de Codex)

**Estado: implementada con verificación pendiente.** Solo se tocaron `apps/api/test/care-records-alarms.api.test.ts` y este informe. No hubo cambios de producción, esquema, migración ni dependencias. PostgreSQL y API **NO EJECUTADOS por Claude**.

**Evidencia de Codex** (según el PO; no la reejecutó Claude): fundación 37/37; API 38/39 con 0 omitidas; FORCE 6/6; unitarias 98/98; catálogo/script 49/49; ESLint focal exit 0; `prisma validate` exit 0; actualización real 29→30 conserva 12 filas en 8 tablas. Pasan todas las regresiones nuevas A01/A03/A04/A07/A09.

**El único fallo:** la prueba antigua «semáforo con texto y cola de revisión solo de contextos propios» esperaba exactamente `[ctx]`. Los dos tests A01 crean contextos adicionales y conceden `REVIEW_ALARMS` al mismo revisor, así que la cola devuelve, correctamente, 3 contextos. El defecto estaba en la expectativa, no en producción.

**Corrección:**

- Ahora el helper `contextoAislado` registra cada contexto en el que concede `REVIEW_ALARMS` al revisor, en `contextosConRevisionDelRevisor`.
- El segundo test A01 se consolidó sobre ese helper: tenía las mismas concesiones (CONTRIBUTE_RECORDS, MANAGE_RULES con competencia y REVIEW_ALARMS con competencia), así que el comportamiento no cambia.
- La cola se compara de forma exacta con `[ctx, ...contextosConRevisionDelRevisor]`. Ambas listas se ordenan y se comprueba que no hay duplicados. No se usa contains/any.
- Ahora se comprueba que **todos** los items de la cola tienen solo alarmas no cerradas, no solo el primero.
- Se mantienen la exclusión de `ctxOtro` y las colas vacías de cuidadora y gestor.
- El conjunto esperado sale de las concesiones de la prueba, no de las reglas del backend.

| Comando | Exit | Resultado |
|---|---|---|
| `bash ./spec/scripts/check-sdd-gate.sh .` | 0 | ABIERTA, 0 errores, 19 warnings |
| `bash ./spec/scripts/validate-sdd.sh . --strict` | 0 | 0 errores, 0 warnings |
| `npm run typecheck --workspace @merdn/api` | 0 | OK |
| `git diff --check` | 0 | Sin errores; solo avisos LF→CRLF |

**Pendiente para Codex:** reejecutar la suite API (39 casos) sobre PostgreSQL efímero. No se repitieron Prisma, unitarias, catálogos, ESLint ni DB, por instrucción.

## 0. Seguimiento de auditoría (2026-10-22, después de la primera ejecución de Codex)

**Estado: implementada con verificación pendiente.** Solo se tocaron dos archivos de prueba y este informe. No hubo cambios de producción, esquema, migración, catálogos, settings ni allowlist, ni dependencias. No se revirtió nada de otros ejecutores. PostgreSQL y API **NO EJECUTADOS por Claude**.

**Evidencia de Codex** (leída en `MP07-VERIFICACION-CODEX.md`; no la reejecutó Claude):

- Actualización real 29→30: 12/12 filas en 8 tablas conservadas, incluidas dos evidencias con la misma occurrenceKey entre definiciones, sin fuente inventada. Pasan las guardas de filas nuevas, el retiro del legado, append-only, el preflight runtime y la limpieza. FORCE RLS 6/6.
- API: 30/31, 0 omitidas. El fallo era la fecha del test A04 «mismo occurrenceKey entre versiones».
- Fundación P07: 36/37, 0 omitidas. Pasaron todas las barreras de revocación y las asignaciones A→B/B→A. El fallo era la preparación del test «emisor no manager» (23514 correcto de la DB).

**Correcciones de esta sesión:**

| Punto | Cambio |
|---|---|
| A04 mismo K entre versiones (`care-records-alarms.api.test.ts`, test «A04: el mismo occurrenceKey…») | El repetido y el evento distinto se fechan tras `frontera = max(closedAt, revalidado.current.activatedAt)` (+100/+200 ms), no tras el cierre. Así la exclusión del repetido la decide solo la identidad. Se mantienen la canónica, `alarmsOpened 0` y la ausencia de abiertas. Se añadió: el episodio siguiente enlaza `previousAlarmId` y su única evidencia es el evento distinto. El motor no se tocó |
| P07 «emisor no manager» (`care-context-foundation.db.test.ts`) | Ahora la prueba espera que `seed.concesion` sea rechazada con `/el emisor no es manager vigente de la organizacion/` y que no exista ninguna `care_authorization` de esa cuenta. Después sigue con los demás casos reales. El trigger no se desactiva ni se inventa historia. La descripción ahora distingue la fuente inválida rechazada al insertar de la elegibilidad de las concesiones persistidas. La cuenta sigue en la lista de destinatarios como «sin concesión persistida» → `false` |
| A03, prueba existente de cambio de unidad | Se añadió un evento POSTERIOR a la revalidación: abre una alarma con el mismo `criterionId` y `criterionVersionId` = v2. Su única evidencia es ese evento: el registro anterior a la revalidación no se cuenta retroactivamente |
| A03, tres regresiones HTTP nuevas (helper `reemplazoPendienteDeRevalidar`) | Reemplazo **compatible** (misma unidad y mismo contenido), **NUMBER→BOOLEAN** y **CHOICE con opciones distintas**. En CHOICE, `opcion-a` se conserva con otro significado. Cada una prueba lo siguiente: (1) la regla antigua conserva la definición exacta (id/version/tipo/unidad/opciones, `RETIRED`), queda `requiresRevalidation: true` y sigue siendo v1; (2) la definición retirada no admite datos (400) y un valor que la regla antigua aceptaría en la nueva no evalúa (0/0); (3) una validación nueva con el id antiguo da 409, sin filtrar el id vigente ni crear versión; con el id nuevo pero contenido incompatible (NUMBER sobre BOOLEAN, opción inexistente) da 400; (4) la revalidación con el id exacto conserva la identidad y crea v2 ACTIVE; (5) es prospectiva: lo anterior a la activación no cuenta y un evento posterior a max(cierre, activación) abre un episodio enlazado con evidencia de la definición nueva; (6) no se reescriben los campos inmutables de v1, la definición anterior ni la evidencia del episodio cerrado (comparación exacta antes/después), y la primera alarma sigue CERRADA |
| A01, vencimiento (nuevo, helper `contextoAislado`) | Criterio ESTABLE con `validUntil` = ahora+3 s. Antes de vencer: SIN_EVALUACION. Tras vencer (espera condicionada y acotada al reloj local, que es el del servidor en el mismo proceso), un dato que la regla aceptaría no abre nada. El semáforo **no** es ESTABLE: es `SIN_CRITERIOS` con 0 activos y 0 por revalidar. La versión sigue ACTIVE con el mismo `validUntil` y `supersededAt` NULL, y el criterio sigue ACTIVE: el reloj no reescribe historia |

Se conservan sin duplicar el A03 recibo legado, el A03 «sin id 400», el A01 API limpio y las unitarias. El parámetro `value` del helper `registrar` pasó a `unknown` para admitir BOOLEAN/CHOICE. No hay valores médicos reales ni conversión de unidades.

Decisión local para auditar: el test de vencimiento fija que un criterio vencido sin alarmas proyecta `SIN_CRITERIOS`. Ese es el comportamiento actual de `semaphoreWithin`, que solo cuenta las versiones vigentes. Si Codex/PO prefiere `SIN_EVALUACION` para criterios vencidos, es un cambio de producto, no de esta prueba.

**Comandos de esta sesión (por exit code):**

| Comando | Exit | Resultado |
|---|---|---|
| `bash ./spec/scripts/check-sdd-gate.sh .` | 0 | ABIERTA, 0 errores, 19 warnings; 055 aprobada y consentida |
| `bash ./spec/scripts/validate-sdd.sh . --strict` | 0 | 0 errores, 0 warnings |
| `npm run build:shared` | 0 | OK |
| `npm run typecheck --workspace @merdn/api` (incluye `test/**`) | 0 | OK tras los cambios |
| `npm run build:api` | 0 | OK |
| `npm run secrets:scan` | 0 | 1389 archivos, OK |
| `git diff --check` | 0 | Sin errores; solo avisos LF→CRLF |
| `git status --short` | 0 | Solo los archivos ya listados; nada nuevo fuera del alcance |

**Denegados por el modo de permisos, no forzados:** `DATABASE_URL=…127.0.0.1:1… npx prisma validate`, `npx eslint <dos tests>`, `npm run lint --workspace @merdn/api`, `npx vitest run --root apps/api …` (unitarias de cuidado) y `node --test tests/testing/baseline-catalog.test.mjs`. No hay conteos que reportar de ellos.

**Pendiente para Codex:** reejecutar la API (ahora con 31 + 4 casos nuevos) y la fundación P07 sobre PostgreSQL efímero, además de lint, unitarias, catálogos y prisma validate/generate. Riesgos de las nuevas pruebas: (a) suponen que `cerrar()` (RESOLVE→CLOSE) acepta alarmas automáticas AMARILLA de versión 1, igual que las A04 existentes; (b) el vencimiento depende de que la petición de criterio y el primer semáforo terminen antes de 3 s; si el entorno es más lento, hay que ampliar ese margen, no relajar el control.

## 1. Compuerta

| Comando | Resultado |
|---|---|
| `bash ./spec/scripts/check-sdd-gate.sh .` | ABIERTA, 0 errores, 19 warnings (specs antiguas sin aprobar y aviso de log de consentimiento previo); 055 aprobada y consentida |
| `bash ./spec/scripts/validate-sdd.sh . --strict` | 0 errores, 0 warnings |

No se ejecutó `confirm-user-consent.sh`.

## 2. Archivos

Árbol actual, de esta ejecución o de las anteriores:

| Archivo | Propósito |
|---|---|
| `prisma/schema.prisma` | Columnas A03/A07 y relaciones (versión→definición, evidencia→definición/enmienda) |
| `prisma/migrations/20261022120000_care_alarm_audit_corrections/migration.sql` (NUEVA) | FK compuesta definición exacta, guarda de INSERT de versión, snapshot tipado de evidencia + CHECK de forma, guarda de INSERT de evidencia (snapshot coherente, identidad consumida A04, frontera de cierre), postflight RLS/FORCE/privilegios/append-only |
| `apps/api/src/care-criteria/{criterion-evaluator,care-alarm-engine,care-criteria.service,care-criteria.contract,care-criteria.request}.ts` | A01 `SIN_EVALUACION`/ESTABLE solo por clasificación; A03 id exacto, 400/409, replay previo, `requiresRevalidation`; A04 identidad + frontera; A07 snapshot |
| `apps/api/src/care-records/care-records.service.ts` | Evaluación en la misma transacción bajo advisory; snapshot de enmienda |
| `apps/api/src/care-alerts/{care-alerts.service,care-alerts.contract}.ts` | A07 vista original/evaluado/posterior; A09 ASSIGN por `withAuthorizedReviewAssignment` |
| `apps/api/src/care-context/{care-context.service,care-context.policy}.ts` | A09 prebloqueo ordenado, decisión fijada a fuentes bloqueadas, elegibilidad del destinatario sin sesión |
| `apps/api/src/care-context/{care-context.service.test,care-context.policy.test}.ts`, `care-criteria/criterion-evaluator.test.ts` | Unitarias A01/A09 |
| `apps/api/test/care-context-foundation.db.test.ts` | **Esta sesión:** bloque P07 (A09) con barreras reales PostgreSQL |
| `apps/api/test/care-records-alarms.api.test.ts` | Regresiones API A03/A04/A07 (anteriores). **Esta sesión:** A09 API, A03 ×2 y A01 |
| `scripts/testing/test-db-provision.mjs`, `tests/testing/baseline-catalog.test.mjs` | Migración 30 en el catálogo (otro Claude, conservado) |
| `spec/.../contracts/MP04-05-...md`, `history.md` | Actualizados en ejecuciones previas; no tocados en esta |
| `spec/.../contracts/MP07A-FROM-CLAUDE.md` (NUEVO) | Este informe |

No se tocaron: frontend, MP07B, prototipo, migraciones publicadas, decisiones/consentimientos, AGENTS/CLAUDE, `tasks/`, `reviews/`, `.env*`, `.secrets`, `.git`. No hay dependencias nuevas.

## 3. Matriz MP07A

| Hallazgo | Implementación (evidencia) | Pruebas |
|---|---|---|
| **A01** | `criterion-evaluator.ts:151-177`. ESTABLE solo con una alarma abierta clasificada ESTABLE. Hay `SIN_EVALUACION` (criterios evaluables o pendientes de revalidar) y `SIN_CRITERIOS`. Sin reloj. Textos en `SEMAPHORE_LABELS` | Unitarias en `criterion-evaluator.test.ts`. API nueva «A01»: contexto limpio, SIN_CRITERIOS → criterio ROJA sin datos = SIN_EVALUACION (texto «no indica estabilidad») → datos < N = SIN_EVALUACION → regla ESTABLE cumplida = ESTABLE |
| **A03** | Las versiones nuevas exigen `observableDefinitionId` en el guarda de la DB y en el servicio (`care-criteria.service.ts:76-103`): se resuelve primero el recibo; si falta el id, **400**; si el id no es el vigente, **409** `VERSION_CONFLICT`. FK compuesta (id, contexto, código, tipo). El guarda exige ACTIVE, el mismo tenant/org/paciente y opciones CHOICE de la definición. La unidad y las opciones salen de la definición citada. Las versiones legadas quedan NULL, no evaluables, con `requiresRevalidation` | API: «sin la definición exacta…» 400. **Nueva «A03 reemplazar…»:** cambio de unidad sin reinterpretar (11 no dispara), `requiresRevalidation` true, contador de semáforo, id anterior 409, id aleatorio 409, sin id 400, revalidación v2 con la misma identidad, v1 SUPERSEDED conservada. **Nueva «A03 recibo previo»:** recibo con la huella previa sembrado por owner (sin relajar controles), se reproduce sin crear versión ni auditoría; misma clave con otro contenido 409; clave nueva sin id 400 |
| **A04** | La identidad es contexto + código + `occurrenceKey` y se consulta entre versiones (`care-alarm-engine.ts:254-274`). Frontera estricta `> closedAt` (`:120-129`), también al agregar evidencia. El guarda de la DB rechaza identidad consumida y ocurrencia ≤ cierre. Sin índice global. Una transacción con advisory | API (anteriores): tardíos antes del cierre, mismo K entre versiones, simultáneos con una alarma, acumulación en el episodio abierto |
| **A07** | Snapshot tipado (valor evaluado, definición, enmienda efectiva, secuencia) con CHECK de forma y guarda coherente. Append-only. El legado queda todo NULL e indeterminado. La vista distingue original, evaluado y `correctedAfterwards` | API (anteriores): enmienda anterior sin rótulo de posterior, reemplazos múltiples, corrección futura que no cambia el snapshot ni reevalúa, UPDATE rechazado, auditoría sin valores |
| **A09** | Ver §5. `care-alerts.service.ts:272-276`: con `assignee` usa `withAuthorizedReviewAssignment`; un destinatario no elegible da `CareValidationError('assignee')` → 400 uniforme y rollback total | Unitarias de servicio y política (orden, actor primero, fallo = indisponibilidad). **DB P07 nuevo** (§6). **API nueva «A09»** |

## 4. Compatibilidad con el legado

- La migración es aditiva: no hay INSERT/UPDATE/DELETE de filas ni backfill. No se editaron migraciones publicadas. No se desactiva RLS/FORCE, ningún trigger append-only ni ningún CHECK.
- Las versiones de criterio previas tienen `observableDefinitionId` NULL. MATCH SIMPLE no las valida y el guarda solo actúa en INSERT. Se pueden conservar y retirar porque el guarda de UPDATE de MP04 sigue intacto. No se evalúan y se proyectan con `requiresRevalidation`.
- La evidencia previa tiene todo el snapshot en NULL y cumple la primera rama del CHECK. Se muestra como indeterminada y no se inventa ningún snapshot.
- Las observaciones históricas duplicadas entre definiciones con el mismo `occurrenceKey` se conservan, porque no hay índice único global.
- Recibos previos: la huella sin `observableDefinitionId` es idéntica a la de antes, así que la réplica se resuelve antes de exigir el id.
- Codex ejecutará la prueba de actualización real: 29 migraciones, siembra con dos definiciones y el mismo K, migración 30 y comparación. Claude no la simuló ni debilitó el esquema.

## 5. Orden de bloqueos A09 (ASSIGN)

Todo ocurre en UNA transacción `withTenant` y ANTES del advisory:

1. `prelockAccountsWithin`: cuentas {actor, destinatario} del tenant, `FOR SHARE`, ordenadas y deduplicadas, sin filtro de estado.
2. Directorio: `resolveOrganizationWithin`, una lectura sin row lock.
3. Fijar la organización.
4. `prelockReviewSourcesWithin`: sesión exacta del actor → vínculos (el del actor y todos los del destinatario) → organización → contexto → concesiones REVIEW_ALARMS de ambas cuentas → asignaciones → perfiles → afiliaciones → competencias. Cada clase va por id ascendente y `FOR SHARE`.
5. Decisión del actor restringida a las ids fijadas.
6. Auditoría de concesión y elegibilidad del destinatario, solo con las filas fijadas.
7. Trabajo: advisory del contexto → alarma/CAS → historia/auditoría.

Los locks SHARE se retienen hasta el commit. AccessRequest se lee sin row lock. El destinatario profesional exige un vínculo que coincida EXACTAMENTE con su FIELD_PROFESSIONAL APPROVED. HOSPITAL_REVIEWER no necesita experiencia. No hay HumanPrincipal sintético ni se exige sesión al destinatario. El actor denegado se audita y se deniega antes de evaluar al destinatario. Los errores de elegibilidad, prebloqueo o auditoría son `CareContextUnavailableError` con rollback, nunca elegibilidad.

Nota de revisión: entre el paso 1 y la sesión del actor (paso 4) está el directorio, que no toma row locks. Por eso no se crea ninguna inversión cuenta/sesión/binding/grant/competencia.

## 6. Pruebas DB preparadas — NO EJECUTADAS

`apps/api/test/care-context-foundation.db.test.ts`, `describe('P07 — …(A09)')`, 9 casos. Usan el servicio real en `enforce` con directorio y barreras reales: `pg_stat_activity.wait_event_type='Lock'` y `pg_blocking_pids`, nunca esperas fijas. Ninguno desactiva triggers, RLS ni GRANT.

1. El destinatario sin sesión válida (sesión revocada + `authenticationNotBefore` posterior) es elegible, tanto revisora como profesional. La auto-asignación también lo es.
2. Fuentes rotas, cada una en un escenario nuevo; antes de romperla era `true` y después `false`: cuenta DISABLED, concesión REVOKED, competencia REVOKED, asignación ENDED, `passwordRecoveryBlocked`, vínculo UNLINKED, perfil INACTIVE, afiliación INACTIVE.
3. No elegibles: sin FIELD_PROFESSIONAL aprobada, emisor no manager, solo otra organización del mismo tenant, otra acción, otro tenant, paciente, gestor, uuid inexistente, id mal formado.
4. La concesión del destinatario vence exactamente en `endsAt`.
5. Actor denegado primero (paciente; revisora con sesión revocada), con destinatario elegible, inexistente o mal formado: error uniforme, el trabajo no corre y queda 1 evento DENIED sin `resourceId`.
6. Si el trabajo falla tras decidir, no queda auditoría.
7. **La revocación ESPERA hasta el commit** en 4 fuentes (cuenta, concesión, competencia, asignación). El backend que revoca queda en Lock; la asignación termina `true`; el orden es asignación→revocación; la siguiente asignación da `false`.
8. **La revocación GANA**, mismas 4 fuentes. La revocación retiene el lock; la asignación queda bloqueada por su pid; tras el commit, la asignación devuelve `false`.
9. **A→B / B→A** concurrentes (revisora y profesional): ambas llegan al trabajo reteniendo los locks SHARE a la vez, después se serializan por el advisory real (`lockContextForWrite`). Ambas `true` y sin deadlock.

API preparada, también NO EJECUTADA (`care-records-alarms.api.test.ts`), 4 casos nuevos: A09, A03 reemplazo, A03 recibo previo y A01. El de A09 cubre:

- asignar a una revisora suplente sin sesión: 200;
- actor sin REVIEW_ALARMS: 403, sin proyectar al destinatario;
- tras revocar la competencia, o con un uuid aleatorio: 400 `field=assignee`, sin cambiar la versión ni el número de ASSIGN.

## 7. Comandos y resultados (por exit code)

| Comando | Exit | Resultado |
|---|---|---|
| `bash ./spec/scripts/check-sdd-gate.sh .` | 0 | ABIERTA |
| `bash ./spec/scripts/validate-sdd.sh . --strict` | 0 | 0/0 |
| `npm run build:shared` | 0 | OK |
| `npm run typecheck --workspace @merdn/api` (incluye `test/**`) | 0 | OK, antes y después de las pruebas nuevas |
| `npm run build:api` | 0 | OK |
| `npm run secrets:scan` | 0 | 1388 archivos, OK |
| `git diff --check` | 0 | Sin errores; solo avisos LF→CRLF. No cubre archivos sin seguimiento |

**NO ejecutados en esta sesión:** el modo de permisos los denegó, y no se forzaron:

- `prisma validate`/`generate` con DSN ficticio. Se denegó toda forma con `DATABASE_URL=…`. El typecheck usó el cliente generado que ya existía.
- Unitarias de cuidado (vitest). El `globalSetup` sondea la DB y, sin un DSN ficticio, usaría el respaldo `127.0.0.1:5432`. No se ejecutaron para no abrir una conexión.
- `eslint` (`npx eslint …` y `npm run lint` denegados).
- Catálogos/runner (`node --test`, `npx vitest run tests/testing` denegados).

Codex debe correrlos o restablecer la allowlist de MP07A. No hay conteos de pruebas que reportar, y ningún skip cuenta como verde.

## 8. Pendientes y riesgos honestos

- **No afirmo DB probada.** Las 9 pruebas P07 y las 4 API se escribieron sin ejecutarse y suponen que la DB acepta ciertas actualizaciones del owner: `care_assignment` ENDED+`endsAt`, afiliación/perfil INACTIVE, `authenticationNotBefore`, inserción de `care_request_receipt`. Si un CHECK o trigger las rechaza, hay que ajustar la preparación, nunca relajar el control.
- Un destinatario no elegible da 400 y revierte toda la transacción, incluido `CARE_CONTEXT_ACCESS_GRANTED`. No persiste ningún evento del intento rechazado, igual que los demás 400 de cuidado. Si Codex exige auditar ese rechazo, es una decisión pendiente.
- Guarda de evidencia A07: la «última corrección» considera solo enmiendas con valor de reemplazo. Si existiera una enmienda de retiro sin valor, conviene confirmar que el motor no evalúa esa observación. No es un defecto confirmado: Codex no encontró otro.
- El orden de `prelockReviewSourcesWithin` bloquea todos los vínculos del destinatario, también los UNLINKED. Es más amplio que lo mínimo, pero inocuo, y se filtra después.
- Pendiente de Codex: la actualización real 29→30, la baseline completa, Chromium y la evidencia saneada.
- MP07B (A02/A05/A06/A08/A10) no se inició y no empieza automáticamente.

La aprobación técnica no equivale a aceptación clínica ni del PO. Me detengo aquí para la auditoría de Codex.
