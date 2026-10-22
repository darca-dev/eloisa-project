# 055 / MP01 — Entrega del implementador (Claude Code)

Fecha: 2026-10-21. Paquete: `MP01-CUSTODIA-Y-PERMISOS.md`. Estado: **implementado y verificado localmente contra PostgreSQL aislado**, pendiente de auditoría de Codex. No se inició MP02. No hubo commit, push ni despliegue. La migración solo se aplicó a la base efímera de pruebas de la spec 025 (luego eliminada), nunca a `merdn_dev` ni a otra base. No se leyó `.env` ni el contenido de `.secrets`.

## 1. Gates previos

- `./spec/scripts/check-sdd-gate.sh .` → ABIERTA, 34 specs aprobadas/consentidas, 0 errores, 19 avisos históricos; 055 con consentimiento registrado.
- `./spec/scripts/validate-sdd.sh . --strict` → 0 errores, 0 avisos.
- Leídos: AGENTS.md, CLAUDE.md, spec/plan/tasks/history de 055, DECISIONES-PRODUCT-OWNER.md, la decisión del 2026-10-21 y este contrato.

## 2. Incidencia de ejecución: dos implementadores simultáneos

Durante la entrega hubo **dos procesos de Claude Code editando MP01 a la vez** en el mismo árbol: el lanzado por Codex y una sesión de VS Code. Se detectó porque aparecieron pruebas unitarias no escritas por esta sesión y se detuvo la edición. Cuando el segundo proceso terminó, el Product Owner autorizó continuar a esta sesión. Reconciliación:

- Se conservaron íntegras las pruebas unitarias del otro proceso (`care-context.policy.test.ts`, `care-context.service.test.ts`) como especificación. La política y el servicio se ajustaron a ellas, que eran más estrictas: bloquean la sesión y el vínculo externo `FOR SHARE`, castean timestamps, normalizan UUID en mayúsculas y tratan una acción fuera de catálogo como defecto. No se debilitó ninguna aserción.
- Se conservaron la migración, el esquema, `care-context.contract.ts` y `care-context-audit.service.ts` ya escritos, con las correcciones de §4.
- **Codex debe confirmar** que ningún otro archivo del árbol quedó escrito por el proceso concurrente fuera de la lista de §3.

## 3. Archivos

Modificados:
- `prisma/schema.prisma`: 6 enums, 5 modelos, `AuditEvent.organizationId` con FK compuesta e índice, y relaciones inversas.
- `scripts/testing/test-db-provision.mjs`: migración nueva en `REQUIRED_MIGRATIONS`, 5 tablas en `PROTECTED_TABLES` (30→35) y `EXPECTED_POLICY_COUNT` 31→37.
- `scripts/testing/test-db-preflight.mjs`: 6 pares policy/tabla en `RLS_POLICY_PAIRS`.
- `scripts/testing/run-baseline.mjs`: etapa `db/care-context-foundation.db.test.ts`.
- `tests/testing/baseline-catalog.test.mjs`: conteos exactos 35 tablas, 26 migraciones y 37 policies (autorizado por el PO; §5).
- `tests/testing/run-baseline.test.mts`: conteos exactos 31→32 etapas, 25→26 DB-gated e índice de `cleanup` 30→31. No se tocaron guardas ni casos.

Creados:
- `prisma/migrations/20261021120000_care_context_foundation/migration.sql`.
- `apps/api/src/care-context/`: `care-context.contract.ts`, `care-context-audit.service.ts`, `care-context.policy.ts`, `care-context.service.ts`, `care-context.module.ts`, `care-context.policy.test.ts`, `care-context.service.test.ts`.
- `apps/api/test/care-context-fixtures.ts`, `apps/api/test/care-context-foundation.db.test.ts`.
- Este documento.

No modificados: `app.module.ts` (el módulo no se importa; no hay endpoint), web, paquetes compartidos, migraciones históricas, prototipo, `tasks/`, `reviews/`, gobernanza, `history.md`, `tasks.md` ni `INDEX.md` de 055.

## 4. Desviaciones y decisiones locales que requieren auditoría

1. **Defecto en el contrato §5 (prefijo `CARE_`).** El evento histórico `CARE_ASSIGNMENT_CREATED` empieza por `CARE_`; un CHECK por prefijo literal fallaría sobre sus filas, que tienen organización nula. El CHECK `audit_event_care_context_scope` **enumera** los dos eventos nuevos. Además, ninguna otra familia de eventos puede llevar `organizationId`, y ambos eventos `CARE_CONTEXT_*` lo exigen. La organización no resoluble usa `EXPERIENCE_ACCESS_DENIED` con organización y recurso nulos, como pide §5.
2. **UPDATE de columna en tablas existentes, necesario para `FOR SHARE`.** PostgreSQL exige UPDATE sobre al menos una columna para bloquear filas. El runtime no tenía ninguna sobre `care_assignment`, `professional_profile` ni `professional_affiliation`. Se concedió **solo `UPDATE ("updatedAt")`** en esas tres, y `UPDATE ("updatedAt"/"version")` en las nuevas. No hay UPDATE de tabla: la prueba existente que impide terminar una asignación sigue siendo válida. Es una ampliación de privilegio sobre tablas históricas que §3 permite («especificar columnas mínimas»), pero debe revisarse expresamente.
3. **Sesión y vínculo también se bloquean** (`human_session`, `external_auth_identity` con `FOR SHARE`, sobre los que el runtime ya tenía UPDATE). Orden efectivo: cuenta → sesión → vínculo → organización → contexto → concesiones (por id) → relación → asignación → perfil → afiliaciones (por id) → competencia. Las concesiones de una cuenta se evalúan por tipo de actor (cuidador, profesional, revisor) para no invertir ese orden. La fila de manager se lee sin bloqueo: es un hecho histórico sobre la emisión.
4. **Denegación temprana sin bloqueos.** Sin vínculo, con cuenta, sesión o vínculo inválidos o sin límites de sesión, solo se lee la organización sin bloqueo para decidir qué evento de auditoría escribir.
5. **Revocación terminal e inmutable** (trigger `merdn_care_authority_revocation_guard`, también para el propietario): solo cambian `status`, `revokedAt` y `version`, y `REVOKED` no vuelve a `ACTIVE`. El contrato pedía revocación con fila conservada; la inmutabilidad del resto es una restricción local añadida.
6. **Emisión** (trigger `merdn_care_authorization_issuance_guard`): `createdAt` lo fija la base; exige emisor manager vigente; reafirma paciente y persona de la relación o asignación citadas. Un manager no puede nombrarse a sí mismo (CHECK). Consecuencia: el primer manager de una organización requiere una segunda cuenta como emisora. Decidirlo corresponde a la provisión controlada futura.
7. **Profesional con `REVIEW_ALARMS`**: se permite estructuralmente pero exige competencia, igual que `MANAGE_RULES`. El revisor institucional solo admite `VIEW_RECORDS` y `REVIEW_ALARMS`, siempre con competencia.
8. **Inactividad de sesión** revalidada con `sessionIdleSeconds` de la misma configuración que `HumanAuthService` (proveedor `CARE_SESSION_LIMITS`). Sin autenticación humana aprovisionada, se deniega.
9. **Formas de texto**: referencias opacas `^[A-Z0-9][A-Z0-9._:-]{2,99}$`, código de organización `^[a-z0-9][a-z0-9-]{1,62}$` y nombre visible de 1 a 160 caracteres sin espacios en los extremos.
10. **`merdn_current_organization()`**: un GUC ausente se convierte en NULL y no hay filas visibles; un GUC mal formado produce un error de conversión y la consulta falla cerrada. El servicio valida y normaliza el UUID antes de fijarlo, así que ese error solo puede venir de SQL ajeno.
11. **Errores**: los fallos de contexto, política o auditoría se convierten en `CareContextUnavailableError`; el error del trabajo se propaga intacto; la denegación (`CareContextAccessDeniedError`) se lanza tras confirmar su auditoría.

## 5. Allowlist: ruta adicional necesaria (no modificada)

El contrato nombra `tests/testing/test-db-provision.test.mts` y `test-db-preflight.test.mts`, que **no existen**. Las expectativas exactas viven en `tests/testing/baseline-catalog.test.mjs`, que fijaba 30 tablas, 25 migraciones y 31 policies y fallaba con 35, 26 y 37. Primero no se editó, por estar fuera de la allowlist.

**Actualización 2026-10-21:** el Product Owner autorizó expresamente ese cambio («sigue con el 2»). Se modificaron solo los cuatro valores numéricos (30→35, 25→26, 31→37 en las dos aserciones) y los tres títulos que los repiten; las comparaciones exactas de conjuntos y la prohibición de `DROP POLICY` quedan intactas. Resultado: `node --test tests/testing/baseline-catalog.test.mjs` → 4/4.

`tests/testing/test-db-lifecycle.test.mts` ya esperaba 29 tablas y 30 policies antes de este paquete (desactualizado previamente); no se tocó.

## 6. Verificación

| Prueba | Comando | Resultado |
|---|---|---|
| P01 Prisma | `npx prisma validate` / `npx prisma generate` (DSN ficticio inutilizable, `DOTENV_CONFIG_PATH` inexistente) | válido; cliente generado (artefacto ignorado) |
| P01 tipos | `npm run typecheck --workspace @merdn/api` | 0 errores |
| P01 build | `npm run build:shared && npm run build:api` | correcto |
| P01 lint | `npx eslint` sobre los archivos de §3 | 0 problemas |
| P01 secretos | `npm run secrets:scan` | OK |
| diff-check | `git diff --check` (más los archivos nuevos) | OK |
| Unitarias MP01 | `npx vitest run src/care-context` | 2 archivos, 41/41 |
| Unitarias relacionadas | `npx vitest run src/care-context src/identity-access test/care-context-foundation.db.test.ts` | 66 aprobadas; 26 de PostgreSQL **omitidas** |
| Suite API completa (sin DB) | `npx vitest run` | 732 aprobadas, 634 omitidas por falta de DB, **1 fallo previo ajeno** (abajo) |
| Runner | `node --test tests/testing/run-baseline.test.mts` | 41/41 |
| Catálogo | `node --test tests/testing/baseline-catalog.test.mjs` | 4/4 tras la actualización autorizada (§5) |

**P02–P06 contra PostgreSQL: EJECUTADAS por orden expresa del Product Owner** («ejecuta la suite postgreSQL»), que sustituye en este punto la previsión de que lo hiciera Codex. Se usó el runner aislado de la spec 025 sin modificarlo: proyecto `merdn-baseline-test`, PostgreSQL 17 en loopback `127.0.0.1:55432`, env-file privado `.secrets/baseline-mp04.local.env`. Claude solo pasó la ruta: el runner lo lee, deriva el entorno mínimo del hijo y borra los secretos de la captura.

| Run-id | Etapa | Resultado |
|---|---|---|
| `mp01-055-20261021` | `provision` | pass: 26 migraciones aplicadas; la verificación del provisionador confirma 35 tablas con RLS+FORCE, 37 policies y runtime no propietario |
| `mp01-055-20261021` | `db/care-context-foundation.db.test.ts` | **fail: 25/26**; cleanup automático correcto |
| `mp01-055-diag1` | `provision` + la misma etapa con diagnóstico | mismo fallo, identificado (abajo); cleanup automático correcto |
| `mp01-055-final` | `provision` | pass |
| `mp01-055-final` | `db/care-context-foundation.db.test.ts` | **pass: 26 aprobadas, 0 fallos, 0 omitidas** |
| `mp01-055-final` | `cleanup` | pass; ningún contenedor del proyecto queda en Docker |

**Fallo encontrado y corregido (defecto de la prueba, no de la política).** El caso de P03 «la auditoría con organización solo se ve bajo esa organización; las filas nulas siguen visibles» contaba las filas `audit_event` sin organización que ya hubiera en el tenant. En una base recién provisionada no hay ninguna, así que el conteo era 0. Ahora la prueba siembra su propia fila histórica sin organización y comprueba que esa fila concreta se ve bajo otra organización y sin ámbito. No se cambió código de producto ni la migración.

**Diagnóstico sin exponer secretos.** Para identificar el caso se usó un script temporal en el scratchpad de la sesión, fuera del repositorio. Ejecuta `runBaseline` sin cambios inyectando solo un `spawn` que copia la salida del hijo, y la imprime después de `scrubSecrets` con los secretos del env-file, sustituyendo además cualquier DSN.

**Regresión de la baseline completa (run-id `mp01-055-baseline`).** `--stage all` pasó `provision`, `typecheck` (0 errores) y `api-no-db-health` (51/51), y se detuvo en `web`: 1859/1860. El fallo es **previo y ajeno a MP01**: `src/config/branding.test.tsx` («solo la configuración y sus pruebas declaran los nombres definitivos») detecta literales de marca en `features/municipality/municipalityModuleLayouts.ts` y `MunicipalitySources.tsx`, ya confirmados; no se tocaron. Como el runner se detiene en el primer fallo, el resto se ejecutó etapa a etapa con el runner sin cambios:

- Run-id `mp01-055-dbsweep`: `provision` → las **26 etapas DB** → `cleanup`, todas pass. **618 pruebas aprobadas, 0 fallos, 0 omitidas.** Incluyen las 25 suites previas (sin regresión por la nueva policy RESTRICTIVE de `audit_event` ni por los grants de columna) y `care-context-foundation` (26/26).
- Run-id `mp01-055-openapi`: `provision` → `openapi` (56/56) → `cleanup`, todas pass.
- Al terminar no queda ningún contenedor, red ni volumen del proyecto `merdn-baseline-test`.

Pendiente fuera de MP01: el fallo de `web` y el de `human-auth.config.test.ts` (§6) impiden un `--stage all` verde de punta a punta.

Fallo previo ajeno: `src/human-auth/human-auth.config.test.ts`, «admite exactamente la raíz y el selector de experiencias». El código confirmado admite `/hospital` y `/municipality` y la prueba confirmada espera solo `['/', '/acceso']`. No guarda relación con MP01.

## 7. Cobertura de la suite DB (ejecutada: 26/26)

- **P02**: RLS y FORCE en las 5 tablas; propietario distinto del runtime; 6 policies (la de auditoría RESTRICTIVE); privilegios exactos de tabla y de columna, incluidas las tres tablas históricas; filas históricas sin organización; CHECK de familia; inmutabilidad y revocación terminal.
- **P03**: organización A frente a B del mismo tenant y frente al tenant C; sin GUC no se ve nada; GUC mal formado falla; el runtime no puede insertar ni revocar; las FK compuestas o el trigger rechazan organización, paciente, competencia, emisor o asignación cruzados; auditoría con organización invisible bajo otra; el pool no hereda la organización (5 vueltas).
- **P04**: paciente propio (incluye denegación por organización municipal); contextos y organización cruzados; cuidador sin concesión, con concesión y tras revocar la relación; profesional sin concesión, con concesión, y con competencia revocada; revisor con competencia vigente o vencida; manager sin concesión; emisor que deja el cargo después; sesión revocada, principal sin vínculo, cuenta deshabilitada, vínculo desvinculado; vencimiento exacto en `endsAt`.
- **P05**: el trabajo autorizado retiene la concesión. El backend que revoca se identifica por `pg_backend_pid()` y se espera a que `pg_stat_activity` lo muestre en `wait_event_type = 'Lock'` (barrera, no espera fija); el orden comprobado es «trabajo terminado → revocación aplicada» y la petición siguiente se deniega. También el caso en que la revocación gana antes.
- **P06**: la denegación persiste su evento; una organización no resoluble usa el evento genérico sin FK; el evento concedido no lleva datos clínicos; un fallo del trabajo revierte su escritura y la auditoría; un fallo de auditoría impide el trabajo y el commit.

## 8. Riesgos y trabajo fuera de alcance

- P02–P06 pasan en una base efímera y local; no es evidencia de staging ni de producción. La barrera de P05 depende de `pg_stat_activity` con un límite de 15 s; en esta ejecución terminó dentro del tiempo de la etapa (8 s en total).
- Las organizaciones que llegan a auditarse no pueden retirarse (FK RESTRICT con `audit_event` append-only) y quedan como datos ficticios en la base de pruebas aislada.
- Pendiente para paquetes posteriores, sin inferir: provisión controlada del primer manager, API de concesiones, endpoints, bitácoras, alarmas, catálogos clínicos, mensajes y uso con datos reales.

## 9. Correcciones tras `MP01-REVISION-CODEX.md`

Autorización: el Product Owner ordenó terminar el semáforo («termina el semáforo») y continuar con acceso total. Esta sesión lo interpreta como autorización para corregir y avanzar sin esperar cada auditoría; **no** como autorización de commit, push ni despliegue (CLAUDE.md §12), que no se nombraron.

1. **P04 «emisor que deja el cargo» (fallo reproducido por Codex).** Causa: la prueba revocaba al manager con `revokedAt` del reloj de Node (Windows), mientras la emisión la fecha PostgreSQL (`now()` dentro de Docker); con desfase de reloj, la revocación parecía anterior a la emisión. Además era una debilidad real: un cliente privilegiado podía fechar en el pasado una revocación para anular lo emitido. **Corrección en la migración:** `merdn_care_authority_revocation_guard` fija `revokedAt := clock_timestamp()` al pasar ACTIVE→REVOKED e ignora el valor aportado. La prueba ahora intenta fechar la revocación en el año 2000 y comprueba que el instante guardado es posterior a la emisión y que la concesión sigue vigente.
2. **Cierre de sesión concurrente.** Dos casos nuevos en P05 con PostgreSQL real: (a) un `UPDATE human_session SET revokedAt` concurrente queda en `wait_event_type = 'Lock'` hasta que termina el trabajo autorizado; orden comprobado «trabajo → cierre»; la petición siguiente se deniega; (b) si el cierre gana antes, la decisión se deniega y el trabajo no se ejecuta.
3. **`force-rls-catalog.db.test.ts`.** Sus conjuntos congelados (26 tablas / 27 policies, sin `access_request` y otras) se regeneraron desde `PROTECTED_TABLES` y `RLS_POLICY_PAIRS` (35/37). Se añadió a la baseline (`run-baseline.mjs`: 33 etapas, 27 DB; `run-baseline.test.mts` ajustado). Dos defectos previos de la prueba: la columna `name[]` no era deserializable por Prisma (se convierte a `text[]`), y exigía que cada policy nombrara al runtime, pero `access_password_recovery_tenant` (migración del 12-oct) se creó sin `TO` y aplica a PUBLIC, lo que incluye al runtime y restringe a todos. Se acepta explícitamente PUBLIC; **no** se modificó esa policy histórica. Hallazgo para Codex: decidir si debe recrearse `TO "merdn_runtime"`.

Ejecuciones con el runner aislado y sin cambios en él: `mp01-055-fix1`, `fix2` y `fix3`, en tres ciclos independientes `provision → db/care-context-foundation → cleanup`, **28/28** cada uno. `mp01-055-forcerls3`: `db/force-rls-catalog` **6/6** y `db/care-context-foundation` **28/28**. Runner/catálogo (`node --test`): 45/45. Tipos 0 errores; lint limpio.
