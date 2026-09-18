Handoff-Version: 3
Updated-At: 2026-08-30T13:05:30-04:00
Updated-By: Codex
Current-Branch: develop
Current-HEAD: 0b2cdc6cf25473949c29357f52aec5739b55f13a
Related-Spec: NONE
Status: VALIDATED

# Protocolo oficial de handoffs de ELOISA

Este directorio coordina el flujo Product Owner → ChatGPT → Codex → Claude → Codex → GitHub → ChatGPT. Es un mecanismo documental simple, reemplazable y auditable; no es software de orquestación.

## Responsabilidades de los archivos

- `STATE.md`: verdad operativa canónica del proyecto en este momento. Contiene únicamente estado confirmado y versionado: HEAD, rama, MVP, módulos, bloqueos, último checkpoint y siguiente objetivo. No acumula conversaciones.
- `TO-CODEX.md`: próxima instrucción estratégica o de diagnóstico que Codex debe resolver.
- `TO-CLAUDE.md`: único paquete actualmente autorizado para Claude. Define Task/Spec, objetivo, allowlist, denylist, pruebas, STOP CONDITIONS, hard stop o timebox cuando aplique y estado previo requerido.
- `FROM-CLAUDE.md`: último reporte estructurado de Claude después de ejecutar. Registra status, archivos modificados, pruebas, errores, stop condition, estado Git, pendientes y preparación para review.
- `CODEX-REVIEW.md`: última revisión de Codex sobre la ejecución de Claude. Registra PASS/FAIL, correcciones, evidencia, seguridad para checkpoint, commit, push y próxima acción.

## Autoridad y regla de escritura

Una sola IA escribe código a la vez.

- Claude implementa únicamente lo descrito en `TO-CLAUDE.md`.
- Codex analiza, valida, actualiza handoffs y realiza checkpoints Git solo cuando estén autorizados.
- ChatGPT coordina la estrategia y las decisiones del Product Owner.
- El Product Owner aprueba decisiones de producto, seguridad, permisos, datos, deployment, dinero y alcance.

Estos archivos no reemplazan `spec/`, SDD, consentimiento, Git ni pruebas. Solo coordinan el trabajo. Las reglas de `AGENTS.md`, la documentación canónica y las specs aprobadas conservan su precedencia.

## Estados permitidos

`IDLE`, `READY`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `VALIDATED` y `CLOSED`.

## Vigencia y reemplazo

Los encabezados obligatorios de cada archivo son `Handoff-Version`, `Updated-At`, `Updated-By`, `Current-Branch`, `Current-HEAD`, `Related-Spec` y `Status`.

Al comenzar una tarea nueva:

- `TO-CLAUDE.md` reemplaza el paquete anterior.
- `FROM-CLAUDE.md` reemplaza el último resultado.
- `CODEX-REVIEW.md` reemplaza la última revisión.
- `TO-CODEX.md` representa una sola instrucción estratégica o diagnóstica activa.
- `STATE.md` se actualiza exclusivamente con hechos verificados en el repositorio.

No se conservan reportes históricos completos aquí. El historial permanente permanece en Git, `spec/`, la bitácora y los commits.

## Autorización permanente limitada para checkpoints

El Product Owner autorizó a Codex a crear commits y hacer push automáticamente después de cada ciclo de handoff validado, exclusivamente para cambios dentro de `spec/bitacora/handoffs/*.md` y únicamente hacia `origin/develop`.

Esta autorización no cubre código de producto, specs funcionales fuera de handoffs, base de datos, configuración, `.agents/`, `.claude/`, `.codex/`, `.mcp.json`, otros archivos, otras ramas, merges ni `main`. Codex debe validar el ciclo, añadir mediante rutas explícitas solo los `.md` necesarios, comprobar el diff staged, crear el checkpoint, hacer push y confirmar sincronización. Cualquier necesidad fuera de esos límites es una STOP CONDITION que requiere autorización nueva.

Como un commit no puede incluir anticipadamente su propio hash, `Current-HEAD` registra el HEAD real observado al redactar el handoff. El hash del checkpoint resultante se confirma después del push y pasa a `STATE.md` al comenzar el siguiente ciclo.

## Autorización permanente limitada de sincronización

Antes de leer o ejecutar un handoff, Codex puede ejecutar `git fetch origin` y `git merge --ff-only origin/develop` únicamente cuando la rama actual sea `develop`, `origin/develop` esté solo por delante, no exista divergencia, el avance sea exclusivamente fast-forward y no haya conflictos ni resolución manual.

Si falla cualquiera de esas condiciones, Codex debe detenerse. Esta autorización no permite merge no-fast-forward, merge commit, rebase, reset, force push, tocar `main`, integrar ramas funcionales, resolver conflictos, descartar cambios locales ni modificar producto por motivo de sincronización.
