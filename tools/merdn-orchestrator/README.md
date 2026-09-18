# MERDN Orchestrator V1 — runtime local

Herramienta **local de desarrollo**. No es producto MERDN, no toca `apps/**`,
`packages/**`, `prisma/**` ni `prototype-claude/**`, y **nunca ejecuta commit,
push ni despliegue**.

Fuentes autoritativas: `docs/MERDN-ORCHESTRATOR-V1.md` y
`tasks/TASK-MERDN-ORCHESTRATOR-V1.md`.

## 1. Uso

```bash
npm run orchestrator          # panel local con Codex CLI y Claude Code CLI reales
npm run orchestrator:mock     # panel local con adapters simulados (sin CLI instalados)
npm run orchestrator:typecheck
npm run orchestrator:test
node tools/merdn-orchestrator/src/main.ts --purgar-journal   # purga manual (>30 días)
```

Panel: **http://127.0.0.1:4319/** (puerto configurable con `--port`).

El host de escucha **no** es configurable: `127.0.0.1` es el único admitido.
Intentar `0.0.0.0`, `::` o cualquier dirección LAN hace fallar el arranque
antes de abrir el socket. Además se valida el origen de la conexión y la
cabecera `Host`.

## 2. Módulos

```text
ui/server.ts + ui/panel.ts        Panel accesible en 127.0.0.1 (HTML/CSS/JS embebidos)
        |
runtime/engine.ts                 Comandos predefinidos, orquestación y trazabilidad
        |-- domain/states.ts      Máquina de estados (allowlist + actores)
        |-- domain/gates.ts       Gates obligatorios y READY FOR CLAUDE
        |-- domain/modes.ts       AUTOMATICO / ASISTIDO / MANUAL
        |-- domain/budget.ts      Límites de invocaciones y contexto
        |-- domain/progress.ts    Huella de progreso y detección de loop
        |-- domain/errors.ts      Clasificación de error y política de reintento
        |-- domain/redaction.ts   Detección/redacción de secretos y filtro de entorno
        |-- runtime/context.ts    Context packs mínimos firmados
        |-- runtime/recovery.ts   Checkpoints, reconciliación y plan ante fallo
        |-- runtime/metrics.ts    Comparación Manual vs Orchestrator
        |-- store/store.ts        node:sqlite (.merdn/orchestrator.db) + journal
        |-- workspace/*           Baseline, allowlist de rutas, Git de solo lectura
        |-- adapters/*            Codex CLI, Claude Code CLI, mocks y puerto OpenAI
```

## 3. Persistencia

`node:sqlite` de Node.js 24, sin dependencia externa. Base en
`.merdn/orchestrator.db` (`.merdn/` está en `.gitignore`).

Tablas (schema versión 2): `schema_meta`, `workflow_run`, `task_run`,
`state_transition`, `decision`, `approval`, `viewed_version`,
`agent_invocation`, `attempt`, `artifact`, `file_change`, `test_run`,
`review`, `finding`, `error_event`, `budget_counter`, `lease`, `checkpoint`,
`cycle`, `metric`, `journal_event`.

Retención: el journal se conserva 30 días y **sólo se purga manualmente**.
Tasks y Reviews versionadas en Git son el historial duradero.

## 3.1 Aprobación ligada a la versión vista

`APROBAR` exige **explícitamente** el hash de la versión que se aprueba. El
hash nunca se infiere ni se completa con el último visto: si la solicitud no
lo trae, la aprobación se rechaza (`aprobacion_sin_hash`).

Una aprobación sólo es válida si se cumplen las cuatro condiciones:

1. existe una versión registrada por `VER`;
2. la solicitud incluye `approval_hash` no vacío;
3. `approval_hash` == hash visto;
4. `approval_hash` == hash actual del artefacto.

Cada `VER` registra el hash del artefacto aprobable (`propuesta` o
`resultado`) en `viewed_version`. Todo intento rechazado queda en el journal
como `aprobacion_rechazada` y nunca se convierte en aprobación; las
aprobaciones aceptadas se registran con hash, actor, estado y momento.

## 4. Máquina de estados

```text
IDEA -> ANALISIS -> ESPERANDO_PRODUCT_OWNER -> ANALISIS
                 \-> TASK_READY -> IMPLEMENTANDO -> QA
                                             QA -> CHANGES_REQUIRED -> IMPLEMENTANDO
                                             QA -> ESPERANDO_APROBACION_VISUAL
ESPERANDO_APROBACION_VISUAL -> APROBADO -> READY_FOR_COMMIT -> COMMITTED
                            -> CHANGES_REQUIRED
                            -> RECHAZADO
IDEA | ANALISIS | ESPERANDO_PRODUCT_OWNER | TASK_READY | PAUSED -> CANCELADO
```

Interrupciones: `PAUSED`, `API_ERROR`, `LOOP_DETECTED`, `BUDGET_LIMIT`,
`STOP_CONDITION`. Sólo `PAUSED` y `API_ERROR` reanudan al estado previo; el
resto exige una decisión del Product Owner.

`ANALISIS -> RECHAZADO` implementa la frase de `docs/MERDN-ORCHESTRATOR-V1.md`
§7.2: «RECHAZADO registra el rechazo del resultado **o propuesta**».

## 5. Gates obligatorios

`decision_material`, `aprobacion_task`, `ready_for_claude`,
`divergencia_visual`, `dependencia_nueva`, `archivo_fuera_de_alcance`,
`gasto_o_secreto`, `accion_destructiva`, `permisos_sensibles`,
`ready_for_commit`, `deploy`.

Todos fallan cerrado. `READY FOR CLAUDE` exige simultáneamente: Task aprobada
con hash vigente, declaración explícita, cero decisiones materiales
pendientes, allowlist/denylist definidas, criterios y pruebas definidos,
workspace permitido con baseline, preflight de CLI aprobado, ausencia de
indicios de secretos, presupuesto disponible y lock exclusivo adquirido.

## 6. Procesos y comandos permitidos

Ejecutables en allowlist: `git`, `npm`, `node`, `codex`, `claude`.
Nunca se usa shell; los argumentos son fijos y ninguna salida de modelo se
convierte en comando.

| Agente | Preflight | Invocación |
| --- | --- | --- |
| Codex | `codex --version` | `codex exec --json --cd <repo> <context>` · reanudación: `codex exec resume --json <thread_id> <context>` (verificado: `resume` **no** admite `--cd`) |
| Claude Code | `claude --version` | `claude -p <context> --output-format json --max-turns <n> --allowedTools <lista>` · reanudación: `--resume <session_id>` |

Allowlist de herramientas de Claude Code (mínimo privilegio con capacidad
real de verificar): `Read`, `Grep`, `Glob`, `Edit`, `Write` y la ejecución
**acotada** de `npm run lint`, `npm run orchestrator:typecheck`,
`npm run orchestrator:test`, `npm run secrets:scan`, `git diff --check` y
`git status --short`. Nunca `Bash` sin acotar, Git mutante, commit, push ni
despliegue: la construcción del comando falla cerrado si aparecen.

Prohibido en cualquier adapter: `--dangerously-skip-permissions`,
`--dangerously-bypass-approvals-and-sandbox`, `--yolo`, `--no-sandbox`,
`--bypass-permissions`. El entorno se filtra: `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `DATABASE_URL` y similares nunca se propagan.

Git sólo de lectura: `status`, `rev-parse`, `diff`, `ls-files`, `show`, `log`,
`config`. `reset`, `clean`, `stash`, `rebase`, `checkout`, `commit`, `push`,
`merge`, `branch`, `worktree`, ... están bloqueados por política y ni siquiera
pueden construirse.

## 6.1 Working tree

Antes de comenzar una Task automatizada el working tree debe estar **limpio**:
cualquier cambio versionado y no ignorado produce `PAUSED` sin invocar a
ningún agente. Una vez iniciada la Task puede existir el diff que ella misma
produjo, siempre contrastado contra baseline y allowlist; un cambio ajeno
vuelve a pausar. `.merdn/` está ignorado y nunca cuenta como sucio. Nunca se
ejecuta `reset`, `clean`, `stash`, `rebase` ni `checkout` destructivo.

## 7. Límites aprobados

- 3 invocaciones Claude por Task; 2 reintentos transitorios por invocación;
  2 ciclos consecutivos sin progreso.
- 6 invocaciones AI por **ventana**: la ventana se reinicia únicamente
  DESPUÉS de una intervención del Product Owner explícita, válida, aceptada
  y que autorice continuar. Una acción rechazada por estado, payload, gate o
  hash no cuenta como intervención y deja la ventana intacta. El total
  histórico se conserva siempre como evidencia y no se reinicia nunca.
- El backoff de un reintento transitorio se espera de verdad antes del
  siguiente intento y se cancela si se pulsa DETENER.
- Contexto: aviso a 80.000 caracteres; a 120.000 se fuerza checkpoint y sesión
  limpia **sin reiniciar contadores**.
- Una Task activa y una invocación mutante a la vez (lease exclusivo).

## 7.1 Métricas: CONOCIDO vs DESCONOCIDO

Ninguna métrica desconocida vale cero. Cada valor es explícitamente conocido
o `DESCONOCIDO`, y el panel muestra «Dato no disponible».

- **Mensajes copiados a mano:** sólo se afirman con evidencia registrada
  (handoffs exportados en MODO MANUAL o una declaración del Product Owner).
- **Decisiones inventadas:** el mecanismo de detección es la revisión; sin
  una revisión ejecutada la métrica queda DESCONOCIDA.
- **Tokens y costo:** sólo si el CLI los reporta; `null` nunca se convierte
  en `0`.

`ORCHESTRATOR_MAS_EFICIENTE` exige que **todos** los umbrales obligatorios
sean conocidos y se cumplan. Con cualquier vacío de datos la comparación se
marca como no concluyente y la recomendación conservadora es MODO MANUAL.

## 8. Límites conocidos de V1

- La sintaxis de Codex CLI se verificó contra el binario real
  (`codex-cli 0.149.0-alpha.4`, distribuido con la extensión de VS Code)
  consultando únicamente `--version`, `exec --help` y `exec resume --help`.
  No se ejecutó ningún trabajo con él.
- Claude Code CLI no está disponible en este equipo, así que su adapter se
  validó con procesos falsos contra el contrato previsto. La prueba
  end-to-end Alcaldía sigue bloqueada hasta que `claude --version` pase con
  sesión Claude Max.
- `OpenAIProductAssistantAdapter` existe sólo como puerto **deshabilitado**:
  sin clave, sin llamadas y sin gasto.
- V1 no ejecuta Git: `autorizarCommit` deja constancia del intento y lo
  bloquea siempre.
