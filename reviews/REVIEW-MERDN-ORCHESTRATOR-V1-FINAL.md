# Segunda revisión final — MERDN Orchestrator V1

## Identificación

- **Review ID:** REVIEW-MERDN-ORCHESTRATOR-V1-FINAL — revisión 2
- **Task:** TASK-MERDN-ORCHESTRATOR-V1
- **Reviewer:** Codex
- **Fecha:** 2026-08-21
- **Resultado:** **FAIL — RETURN TO CLAUDE CODE**
- **READY FOR COMMIT:** **NO**
- **READY FOR CONECTAR CLAUDE CLI:** **SÍ**, para integración controlada después de instalar/autenticar el CLI local; el adapter ya cumple su contrato estático y de mocks.
- **READY FOR PRUEBA ALCALDÍA:** **NO**

Esta auditoría verificó directamente las ocho correcciones solicitadas contra `CLAUDE.md`, `docs/MERDN-ORCHESTRATOR-V1.md`, `tasks/TASK-MERDN-ORCHESTRATOR-V1.md`, el código y el working tree actual. No modificó código, no hizo commit ni push.

## Alcance y archivos auditados

- `.gitignore`, `package.json` y ausencia de cambios en `package-lock.json`.
- Todo `tools/merdn-orchestrator/**`.
- Todo `tests/orchestrator/**`.
- Diff y archivos no versionados actuales.
- Contrato real del Codex CLI disponible.
- Disponibilidad local de Codex y Claude CLI.
- Review anterior y sus ocho bloqueantes.

No se auditó como parte de esta Task el branding preexistente de `apps/web`; `apps/**` no presenta cambios en el diff actual.

## Verificación independiente

| Verificación | Resultado |
| --- | --- |
| `npm.cmd run orchestrator:test` | PASS — 136/136 |
| `npm.cmd run orchestrator:typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd run secrets:scan` | PASS |
| `git diff --check` | PASS |
| Dependencias SQLite externas | ninguna |
| Codex CLI | disponible — `codex-cli 0.149.0-alpha.4` |
| Claude CLI | no disponible en PATH |
| Aprobación después de VER, sin enviar hash | **se aceptó indebidamente** |
| CONTINUAR inválido con ventana AI=6 | transición denegada, pero ventana reiniciada indebidamente a 0 |

## Resultado de las ocho correcciones

### 1. Loopback — PASS

`assertLoopbackBindHost` solo admite exactamente `127.0.0.1` y se ejecuta antes de crear/abrir el socket. Las pruebas rechazan `0.0.0.0`, `::`, `localhost`, LAN, vacío y otros hosts. El bypass reproducido en la revisión anterior quedó cerrado.

### 2. Aprobación por hash visto — FAIL, BLOQUEANTE RESTANTE

Se implementaron VER, persistencia de versiones vistas, hash actual, journal y rechazo de hash distinto. Sin embargo, el hash enviado al aprobar sigue siendo opcional:

- `checkAprobacion` solo compara `hashVisto` cuando no es `null`.
- `aprobarPropuesta` y `aprobarResultado` conservan `hashVisto = null` por defecto.
- Tras un VER válido, una llamada a APROBAR sin `hashVisto` se acepta porque la base recuerda que el hash actual fue visto.

Reproducción independiente:

```text
APPROVE_WITHOUT_HASH_AFTER_VIEW={"ok":true,"state":"TASK_READY"}
```

Esto contradice “APROBAR exige hash visto == hash actual”. La API/gate debe rechazar hash ausente, incluso si existe un VER previo. El test actual cubre “sin VER”, hash distinto y contenido cambiado, pero no “VER seguido de APROBAR sin hash”.

**Corrección requerida:** hacer `hashVisto` obligatorio en el motor y API; rechazar `null`, vacío, ausente, stale o distinto; añadir prueba de panel y motor para la reproducción anterior.

### 3. Dirty workspace — PASS

Una Task nueva exige working tree limpio. Cualquier cambio versionado/no ignorado produce PAUSED. `.merdn/**` queda excluido. Una vez iniciada la Task, solo se tolera su propio diff reconocido y cualquier cambio ajeno vuelve a pausar. No existen reset, clean, stash, rebase, checkout destructivo, commit o push automáticos.

### 4. Codex resume/thread_id — PASS

La creación usa `codex exec --json --cd <repo> <prompt>` y la reanudación `codex exec resume --json <thread_id> <prompt>`, sin `--cd`. El parser reconoce `thread.started/thread_id`, mensajes de `item.completed`, turnos terminados/fallidos y consumo. No inventa IDs. La sintaxis coincide con la ayuda del CLI real disponible.

### 5. Claude allowlist/tests — PASS

Claude conserva lectura/escritura autorizada y Bash acotado a seis verificaciones exactas: lint, typecheck, tests Orchestrator, secret scan, `git diff --check` y `git status --short`. Bash general, flags peligrosos, Git mutante, commit, push, rm, Docker y deploy siguen bloqueados. No existe `dangerously-skip-permissions`.

La integración real con Claude CLI no se ejecutó porque el binario aún no está disponible. Esto no es un defecto del Runtime/mocks.

### 6. Ventana AI — FAIL, BLOQUEANTE RESTANTE

Se separaron correctamente `ai_invocations` histórico y `ai_invocations_window`; el presupuesto consulta la ventana y el histórico no se borra. Sin embargo, el reset ocurre antes de comprobar que la intervención sea válida.

Ejemplo: `continuar()` llama `registrarIntervencion()` antes de intentar la transición. Desde IDEA, `reanudar` es inválido, pero la ventana se reinicia igualmente:

```text
INVALID_CONTINUE_RESETS_WINDOW={"before":6,"transitionOk":false,"state":"IDEA","after":0,"total":6}
```

La API local expone `continuar`, por lo que este comportamiento permite eludir el límite de seis invocaciones sin una intervención válida que autorice continuar.

**Corrección requerida:** reiniciar la ventana solo después de una transición/decisión/aprobación válida y aceptada. Una acción denegada no debe alterar ningún contador. Añadir pruebas negativas para CONTINUAR, APROBAR, RESPONDER o DECIDIR inválidos.

### 7. Backoff — PASS

El motor espera realmente `backoffMs` mediante sleeper cancelable. DETENER aborta la espera, impide el siguiente intento y registra la cancelación. Los dos reintentos transitorios máximos permanecen vigentes.

### 8. Métricas unknown — PASS

`MetricValue` distingue conocido/desconocido; UI muestra “Dato no disponible”. Copias, decisiones inventadas, tokens y costo requieren evidencia. Un umbral desconocido hace la comparación no concluyente y nunca permite `ORCHESTRATOR_MAS_EFICIENTE`.

## Estados, gates y seguridad

- FSM, RECHAZADO, CANCELADO, PAUSED, LOOP_DETECTED y BUDGET_LIMIT: verificados.
- Los límites 3 Claude, 2 retries, 2 ciclos sin progreso y ventana 6 AI existen.
- LOOP_DETECTED/BUDGET_LIMIT detienen avance automático.
- READY FOR CLAUDE, scope, dependencia, gasto, secreto, destructivo, permisos, visual, commit y deploy están representados.
- Journal, entrada, salidas y entorno aplican redacción; secret scan pasa.
- OpenAIProductAssistantAdapter permanece deshabilitado, sin SDK, HTTP, clave o gasto.
- Persistencia usa `node:sqlite` y `.merdn/orchestrator.db`, sin dependencia externa.

Los dos hallazgos restantes afectan gates obligatorios: aprobación exacta y presupuesto. Por tanto, el conjunto todavía no puede considerarse listo para commit.

## Cobertura de pruebas

Las 136 pruebas pasan y mejoran sustancialmente la cobertura anterior: loopback negativo, dirty inicial/mitad de Task, JSONL realista de Codex, allowlist Claude, ventana AI, backoff cancelable, unknown metrics y accesibilidad semántica.

Brechas descubiertas por esta auditoría:

1. VER válido seguido de APROBAR sin `hashVisto`.
2. Intervención/transición inválida que reinicia `ai_invocations_window`.
3. Integración real Claude CLI y prueba Alcaldía, pendientes por disponibilidad externa.
4. Evidencia manual/automática completa de accesibilidad en navegador real sigue pendiente para la prueba visual.

## Hallazgos

### BLOCK-SECOND-01 — Hash ausente aceptado después de VER

- **Clasificación:** BLOQUEANTE.
- **Propietario:** Claude Code.
- **Cierre:** hash obligatorio y pruebas negativas de motor/API/panel.

### BLOCK-SECOND-02 — Acción PO inválida reinicia ventana AI

- **Clasificación:** BLOQUEANTE.
- **Propietario:** Claude Code.
- **Cierre:** reset posterior a acción válida y pruebas negativas de todas las rutas de intervención.

### NONBLOCK-SECOND-01 — Claude CLI real no disponible

- **Clasificación:** NO BLOQUEANTE para implementación/mocks; bloquea la prueba Alcaldía.
- **Cierre:** instalar/habilitar Claude CLI con autenticación Claude Max y superar preflight.

### NONBLOCK-SECOND-02 — Accesibilidad real pendiente

- **Clasificación:** NO BLOQUEANTE para commit técnico después de corregir bloqueantes; condición de prueba visual.
- **Cierre:** evidencia de teclado, foco, zoom/reflow y verificación automática/manual en navegador.

## Archivos, dependencias e infraestructura

- **Archivos fuera de alcance:** ninguno.
- **Cambios en `apps/**`:** ninguno.
- **Cambios en `prototype-claude/**`:** ninguno.
- **Dependencias nuevas:** ninguna.
- **Cambios en `package-lock.json`:** ninguno.
- **Nueva infraestructura, nube o deploy:** ninguno.
- **Commit/push realizados:** ninguno.

## Recomendación final

- **Estado:** FAIL — quedan 2 bloqueantes.
- **READY FOR COMMIT:** NO.
- **READY FOR CONECTAR CLAUDE CLI:** SÍ para una integración controlada; el adapter está preparado, aunque el CLI todavía no está disponible.
- **READY FOR PRUEBA ALCALDÍA:** NO; requiere cerrar ambos bloqueantes, habilitar Claude CLI local con Claude Max y ejecutar la validación end-to-end/accesibilidad.
- **Acción siguiente:** corrección mínima de los dos hallazgos, nuevas pruebas negativas y tercera revisión enfocada.
