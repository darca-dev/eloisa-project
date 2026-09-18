# MERDN Task Specification

## Task Identification

- **Task ID:** TASK-MERDN-ORCHESTRATOR-V1
- **Title:** Implementar MERDN Orchestrator V1 Runtime local
- **Status:** APPROVED
- **Priority:** HIGH
- **Created by:** Codex / MERDN Orchestrator
- **Approved by:** Product Owner — decisiones finales comunicadas 2026-08-21
- **READY FOR CLAUDE:** **SÍ**, para implementar con mocks

## Objective

Implementar un runtime local mínimo que registre una solicitud del Product Owner, coordine Task/implementación/review mediante adapters CLI, aplique gates y límites, preserve el estado ante errores y presente una interfaz simple sin introducir APIs pagas ni modificar el producto MERDN. La construcción se realiza con mocks; Claude CLI es requisito únicamente para la prueba end-to-end Alcaldía.

## Business Context

**Hecho:** el flujo actual exige copiar mensajes manualmente entre herramientas. **Decisión aprobada:** proceso local TypeScript/Node en `tools/merdn-orchestrator/`, panel loopback y `node:sqlite`. **Hecho:** Codex CLI está disponible; Claude Code CLI puede no estar en `PATH`, lo cual no bloquea mocks y sí bloquea la prueba Alcaldía real.

## Users Affected

- **Usuario directo:** Product Owner de MERDN.
- **Actores técnicos:** Codex, agentes especializados, Claude Code y QA.
- **Instituciones/tenants:** no aplica; es tooling local de desarrollo, no una capacidad multi-tenant del producto.
- **Impacto:** reduce copiado manual y muestra decisiones sencillas conservando la autoridad del Product Owner.

## Modules Affected

- **En alcance:** nuevo tooling local aislado `tools/merdn-orchestrator/`.
- **Relacionados:** Tasks, Reviews y gobernanza como entradas de solo lectura o artefactos aprobados.
- **No afectados:** todos los módulos de negocio MERDN, web, API, datos clínicos/institucionales, integraciones productivas e infraestructura Hostinger.

## Functional Requirements

1. **FR-01 — Intake:** aceptar una necesidad en lenguaje natural, crear ID, timestamp, modo y estado `IDEA` sin datos sensibles.
2. **FR-02 — FSM:** implementar exactamente la allowlist de estados/transiciones aprobada, con actor, precondición, evento append-only e idempotency key.
3. **FR-03 — Modos:** soportar AUTOMÁTICO, ASISTIDO y MANUAL sin perder Task, decisiones, métricas ni historial al cambiar.
4. **FR-04 — Codex:** ejecutar el adapter Codex mediante proceso hijo seguro, conservar ID exacto de sesión y validar salida contractual.
5. **FR-05 — Claude:** soportar mock durante construcción; para ejecución real exigir `claude --version` y autenticación Claude Max, o pasar a `PAUSED`; nunca invocarlo con `READY FOR CLAUDE = NO`.
6. **FR-06 — READY gate:** validar Task/hash/aprobación/decisiones/archivos/pruebas/workspace/CLI/presupuesto/lock antes de `IMPLEMENTANDO`.
7. **FR-07 — Handoff:** registrar implementación, archivos, tests, errores, riesgos y evidencia; enviarla a Codex/QA antes de aprobación visual.
8. **FR-08 — Corrección:** automatizar solo findings completamente especificados, no materiales, dentro del scope y presupuesto; escalar el resto.
9. **FR-09 — Aprobación:** mostrar APROBAR/CAMBIAR/RECHAZAR; APROBAR produce como máximo `READY_FOR_COMMIT`.
10. **FR-10 — Git:** no ejecutar commit/push sin gate separado y autorización expresa ligada al diff exacto; nunca push a `main`.
11. **FR-11 — Pausa:** kill switch visible que termina en forma segura el proceso hijo y conserva estado/código.
12. **FR-12 — Anti-loop:** aplicar límites aprobados, huella de progreso, detección de repetición/oscilación y `LOOP_DETECTED`.
13. **FR-13 — Contexto:** crear packs mínimos; al superar umbral usar checkpoint y sesión limpia sin reiniciar contadores.
14. **FR-14 — Recuperación:** ante API/CLI error conservar working tree, clasificar error, reconciliar y evitar reejecución ciega.
15. **FR-15 — Workspace:** operar sin worktrees y solo con working tree limpio; baseline antes/después, lock exclusivo, allowlist, bloqueo de escapes y `PAUSED` ante cambios no reconocidos; prohibir reset/clean/stash/rebase/checkout destructivo automático.
16. **FR-16 — Métricas:** registrar las métricas Manual vs Orchestrator sin inventar consumo/costo.
17. **FR-17 — UI:** servir exclusivamente en loopback una pantalla accesible, responsive y en español con detalles técnicos ocultos por defecto.
18. **FR-18 — Reinicio:** recuperar Tasks con lease vencido como `PAUSED`, reconciliar y exigir acción antes de continuar.
19. **FR-19 — Estados terminales:** implementar `RECHAZADO` y `CANCELADO` preservando el journal.
20. **FR-20 — Claude seguro:** modo no interactivo, JSON estructurado, cwd del repo, timeout, cancelación, máximo de turnos y herramientas permitidas; prohibir `dangerously-skip-permissions`.
21. **FR-21 — Git:** no ejecutar commit ni push automático en V1; aprobación visual termina en `READY_FOR_COMMIT`.
22. **FR-22 — Gates:** bloquear técnicamente ante decisión material, Task no aprobada, READY FOR CLAUDE fallido, divergencia visual, dependencia nueva, archivo fuera de alcance, gasto, secreto, acción destructiva, permisos sensibles, READY_FOR_COMMIT no autorizado o deploy.

## Data Requirements

| Dato | Uso | Propietario | Procedencia | Sensibilidad | Retención/linaje | Restricción |
| --- | --- | --- | --- | --- | --- | --- |
| Task y hash | gate de ejecución | repositorio/Product Owner | archivo aprobado | INTERNAL | versiones + SHA-256 | invalidar aprobación al cambiar |
| Decisión/aprobación | autoridad y trazabilidad | Product Owner | acción UI | AUDIT_RESTRICTED | append-only lógico | ligada a hash/diff |
| Invocación/intento | recuperación/métricas | runtime local | adapters CLI | INTERNAL | correlación y clase de error | salida redactada |
| Archivo/diff/hash | control de scope | repositorio | Git/filesystem | INTERNAL | baseline antes/después | no almacenar secretos/contenido completo por defecto |
| Test/resultados | aceptación | Claude/QA | comando autorizado | INTERNAL | evidencia referenciada | pass/fail/not run |

- **Entradas:** necesidad, acción del Product Owner, Tasks/Reviews y salidas estructuradas de adapters.
- **Salidas:** estado, preguntas simples, Task/Review, métricas y handoffs.
- **Datos prohibidos:** secretos, tokens, cookies, headers de autenticación, variables de entorno, credenciales, PHI/PII real, payloads completos innecesarios.
- **Fuente maestra aprobada:** `node:sqlite` de Node.js 24, sin dependencia SQLite externa.
- **Persistencia:** `.merdn/orchestrator.db`; `.merdn/` no versionada; schema versionado y migraciones reversibles/backup previo.
- **Retención:** journal local 30 días con purga manual; Tasks/Reviews Git son el historial duradero.

## Permissions

El panel es tooling local de un solo usuario y una sola computadora, enlazado a `127.0.0.1`, sin LAN, Internet ni autenticación multiusuario; no reutiliza roles MERDN.

| Acción | Actor | Condiciones | Denegación |
| --- | --- | --- | --- |
| Crear/cambiar solicitud | Product Owner local | panel loopback | procesos/agentes no deciden producto |
| Aprobar Task/resultado | Product Owner | hash vigente | aprobación stale/replay |
| Ejecutar Codex | Orchestrator | gate por fase | shell arbitrario |
| Ejecutar Claude | Orchestrator | READY SÍ y todos los gates | READY NO, CLI inválido, scope/budget fallido |
| Preparar Git | Orchestrator | resultado aprobado | ejecutar sin gate Git |
| Commit/push | executor futuro | autorización separada | `main`, diff distinto, deploy |

## Institutional Context

No aplica multi-tenancy productiva. El runtime no procesa población, pacientes, clínica, finanzas ni evidencia institucional. La prueba “Interfaz Alcaldía” coordina una Task de producto, pero no convierte el Orchestrator en módulo municipal.

## Audit Requirements

Registrar eventos para: creación, transición aceptada/denegada, cambio de modo, decisión, aprobación, invocación, retry, timeout/cancelación, archivo fuera de scope, test, finding, API error, loop/budget, reanudación, preparación Git y autorización Git. Campos: actor, UTC, run/task/attempt, acción, recurso/hash, estado previo/nuevo, resultado y motivo minimizado.

## Security Requirements

1. Bind estricto a `127.0.0.1`; no LAN, Internet ni Hostinger.
2. Usuario local único; sin autenticación multiusuario en V1.
3. CWD fijado al repo y comandos allowlisted; no shell generado por modelos.
4. Rechazar path traversal, rutas externas y symlink/junction escape.
5. Entorno filtrado; stdout/stderr limitado y redactado.
6. No leer, copiar, persistir ni mostrar archivos de autenticación de CLI.
7. Lock/lease por Task, optimistic concurrency y transiciones atómicas.
8. No revertir cambios ajenos; detener ante archivos fuera de allowlist.
9. No ejecutar `dangerously-skip-permissions` ni flags equivalentes de bypass.
10. Fallar cerrado ante preflight, schema, hash, gate o integridad inválidos.

## Regulatory and Evidence Requirements

FURAG/MIPG, ADRES, T-319, SENA, Hub, finanzas, indicadores y evidencias: **NO AFECTA** al runtime. Debe preservar las fuentes de gobernanza y no inventar contenido durante la coordinación de futuras Tasks.

## Hospital Commercial Impact

Agenda, servicios, visitas, consultas, membresías, pagos, ingresos y evidencia de prestación: **NO AFECTA**.

## Visual Reference

- **Referencia:** no aplica; el panel del Orchestrator no es UI de MERDN.
- **Restricción:** no consultar ni modificar `prototype-claude/` para diseñar este tooling.
- **UI vinculante:** los textos y estados definidos en la arquitectura aprobada y esta Task.

## Allowed Files

- `tools/merdn-orchestrator/**`
- `tests/orchestrator/**`
- `.gitignore` — únicamente la entrada `.merdn/`
- `package.json` — scripts/workspace mínimos
- `package-lock.json` — solo cambios derivados de dependencia aprobada

Toda ruta no listada está fuera de alcance.

## Forbidden Files

- `AGENTS.md`, `CLAUDE.md`, `agents/**`
- `prototype-claude/**`
- `apps/**`, `packages/**`, `prisma/**`
- `.env`, `.env.*` y configuración/credenciales de usuario de los CLI
- `compose.yml`, infraestructura, deploy y Hostinger
- `.git/**`, `main` y su historial
- Tasks/Reviews ajenas, salvo lectura

## Dependencies

### Functional

- Arquitectura y decisiones materiales aprobadas.
- Task final aprobada con hash vigente.
- CLI Codex y Claude disponibles, autenticados y verificados.

### Technical

- Node.js 24 y TypeScript existentes.
- `node:sqlite` incluido en Node.js 24; no añadir dependencia SQLite.
- No añadir framework frontend, ORM, cola, servidor externo ni SDK de OpenAI/Anthropic.

### Integration and Failure Behavior

- Procesos CLI no interactivos con JSON, cwd fijo, timeout/cancelación, máximo de turnos, herramientas allowlisted y códigos de error clasificados.
- Reintentar únicamente rate limit/timeout/red/5xx confirmados, con backoff y máximo aprobado.
- Auth, permiso, cuota, petición inválida y schema inválido requieren intervención.
- API_ERROR nunca borra ni revierte código.

## Approved Decisions

1. **AD-01:** no escribir aún el Runtime; solo esta arquitectura y Task.
2. **AD-02:** V1 no activa APIs, claves, servicios ni gasto.
3. **AD-03:** debe soportar AUTOMÁTICO, ASISTIDO y MANUAL conservando estado.
4. **AD-04:** nunca entregar a Claude con READY NO.
5. **AD-05:** primera prueba controlada será Interfaz Alcaldía y debe recomendar MANUAL si empeora resultados.
6. **AD-06:** push a main, destructivo, secretos, deploy, migración destructiva, permisos sensibles y gasto API nunca son automáticos.
7. **AD-07:** arquitectura local única bajo `tools/merdn-orchestrator/`, panel exclusivo `127.0.0.1`, sin microservicios, nube o deploy.
8. **AD-08:** prueba Alcaldía inicia en ASISTIDO; Product Owner aprueba Task y resultado visual; modos cambian sin pérdida.
9. **AD-09:** `node:sqlite`, `.merdn/orchestrator.db`, sin dependencia SQLite; `.merdn/` fuera de Git.
10. **AD-10:** sin worktrees; solo working tree limpio; cambios no reconocidos producen `PAUSED`; no hay limpieza Git destructiva automática.
11. **AD-11:** V1 no hace commit/push automático; aprobación visual llega a `READY_FOR_COMMIT`; gate final permanece humano.
12. **AD-12:** Claude CLI local con Max y sin API/key paga; ausencia pausa E2E pero no construcción con mocks.
13. **AD-13:** límites: 3 invocaciones Claude, 2 retries transitorios, 2 ciclos sin progreso, 6 invocaciones AI, warning 80k y limpieza antes de 120k cuando sea posible.
14. **AD-14:** journal 30 días, purga manual, sin secretos; Tasks/Reviews Git son historial duradero.
15. **AD-15:** un usuario local, sin LAN/Internet ni autenticación multiusuario.
16. **AD-16:** `RECHAZADO` y `CANCELADO` son terminales con journal preservado.
17. **AD-17:** OpenAI/Product Assistant V1 es Codex local; adapter futuro deshabilitado, sin key, llamadas o gasto.

## Open Decisions

No quedan decisiones materiales abiertas para implementar el Runtime con mocks. La disponibilidad de Claude CLI es una precondición operativa posterior para la prueba end-to-end Alcaldía, no una decisión de diseño.

## Out of Scope

- Implementar o modificar la Interfaz Alcaldía.
- APIs/SDK OpenAI o Anthropic y control de UI ChatGPT/Claude.
- Hostinger, Docker, servicios remotos, múltiples usuarios o acceso LAN.
- Migraciones o datos de MERDN, secretos, pagos, integraciones productivas.
- Commit, push, PR, merge, release o deploy durante esta Task.

## Acceptance Criteria

1. **AC-01:** ninguna ruta invoca Claude si falta cualquier precondición READY; prueba negativa cubre cada gate.
2. **AC-02:** todas las transiciones válidas/negadas por actor coinciden con la tabla aprobada y son idempotentes.
3. **AC-03:** cambiar modo conserva estado, Task, decisiones, intentos y métricas.
4. **AC-04:** reinicio/API error recupera checkpoint sin borrar o revertir cambios.
5. **AC-05:** dos procesos no mutan la misma Task simultáneamente.
6. **AC-06:** traversal/symlink y archivos fuera de allowlist detienen la ejecución sin tocar trabajo preexistente.
7. **AC-07:** loop exacto, oscilación y dos ciclos sin progreso se detectan y detienen.
8. **AC-08:** topes producen BUDGET_LIMIT y no se reinician con una sesión limpia.
9. **AC-09:** panel solo escucha loopback y ofrece intake, propuesta, implementación, review, pause y modos por teclado.
10. **AC-10:** logs/DB/UI no contienen secretos, tokens, env completo ni datos sensibles de fixtures.
11. **AC-11:** APROBAR no ejecuta commit/push; main/deploy/destructivo permanecen bloqueados.
12. **AC-12:** métricas comparativas se exportan con `unknown/not reported` cuando el CLI no informa tokens/costo.
13. **AC-13:** Codex/Claude adapters pasan contract tests con procesos falsos y preflight negativo.
14. **AC-14:** toda ejecución produce handoff trazable a Task hash, intentos, archivos y pruebas.
15. **AC-15:** `node:sqlite` persiste en `.merdn/orchestrator.db` sin dependencia externa y `.merdn/` queda ignorado.
16. **AC-16:** la prueba Alcaldía inicia en ASISTIDO y aplica 0 copias Codex/Claude, máximo 3 intervenciones PO, máximo 3 Claude, 0 archivos fuera de alcance, 0 decisiones inventadas y $0 API.

## Required Tests

| Test ID | Tipo | Escenario | Resultado esperado |
| --- | --- | --- | --- |
| T-01 | Unit | matriz completa de FSM/actores | válidas pasan; resto deny-by-default |
| T-02 | Unit | hash cambia tras aprobación | aprobación invalidada |
| T-03 | Integration | crash/restart por fase y lease vencido | PAUSED + reconciliación sin pérdida |
| T-04 | Integration | API error antes/durante/después de diff | código preservado; retry solo si transitorio |
| T-05 | Concurrency | dos procesos misma Task | solo uno adquiere lease |
| T-06 | Security | traversal/symlink/junction escape | bloqueado fuera del root |
| T-07 | Security | secretos en intake/output/env | bloqueados o redactados |
| T-08 | Security | comando/model output no allowlisted | nunca ejecutado |
| T-09 | Scope | cambio fuera de allowlist | STOP_CONDITION, sin auto-revert |
| T-10 | Unit | loop idéntico y A↔B | LOOP_DETECTED |
| T-11 | Unit | máximos de retry/ciclos/contexto | estado límite correcto |
| T-12 | Integration | AUTO/ASISTIDO/MANUAL | estado persistido; invocaciones según modo |
| T-13 | Security | aprobación stale/replay | rechazada por hash/idempotency |
| T-14 | Integration | Claude CLI ausente/unauthenticated | preflight cerrado; cero invocación |
| T-15 | Integration | API_ERROR con cambios parciales | diff preservado y enviado a review |
| T-16 | Accessibility | teclado, foco, nombres y live regions | interacción completa sin ratón |
| T-17 | E2E | flujo controlado con adapters falsos | IDEA a READY_FOR_COMMIT, sin Git |
| T-18 | Security | commit/main/deploy/destructivo sin gate | siempre bloqueado |
| T-19 | Integration | `node:sqlite` y retención | DB correcta; purga solo manual y limitada a journal >30 días |
| T-20 | Integration | Claude mock y CLI ausente | mocks permiten construcción; E2E real pasa a PAUSED |
| T-21 | Scope | working tree sucio/no reconocido | PAUSED antes de invocar AI |

Pruebas usan repositorio temporal y datos ficticios; nunca credenciales reales. Debe ejecutarse lint, typecheck y tests específicos, además de secret scan existente cuando aplique.

## Migration, Rollback and Operations

- Crear runtime nuevo, sin migración de producto.
- Antes de migrar schema local: snapshot consistente y versión.
- Rollback del tooling: detener proceso y volver a versión anterior; nunca borrar automáticamente DB/artifacts.
- Desinstalar no afecta código MERDN; `.merdn/` conserva el journal hasta su purga manual conforme a 30 días.
- V1 no se despliega ni opera como servicio persistente remoto.

## Expected Handoff

Claude Code debe devolver el formato completo de `CLAUDE.md`, más:

1. diagrama final de módulos y schema SQLite;
2. comandos/preflight reales de ambos CLI sin información de autenticación;
3. lista exacta de procesos/comandos allowlisted;
4. evidencia de bind loopback;
5. matriz de estados, gates y pruebas negativas;
6. pruebas de crash/restart, errores parciales, loop, contexto y concurrencia;
7. baseline y lista de todos los archivos tocados;
8. confirmación de cero cambios en rutas prohibidas y cero operaciones Git;
9. métricas de una prueba E2E con adapters falsos;
10. riesgos, pruebas no ejecutadas y bloqueo operativo de la prueba real Alcaldía si falta Claude CLI.

## Readiness Statement

No quedan decisiones materiales necesarias para construir el Runtime con mocks. La ausencia de Claude CLI conduce a `PAUSED` únicamente al intentar la prueba end-to-end Alcaldía.

**READY FOR CLAUDE: SÍ**
