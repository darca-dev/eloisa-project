# Decision log / Bitácora de decisiones

EN: One file per decision, `YYYY-MM-DD-<slug>.md`, from `../templates/DECISION_TEMPLATE.md`.
ES: Un archivo por decisión, `YYYY-MM-DD-<slug>.md`, desde `../templates/DECISION_TEMPLATE.md`.

Record a decision when **any** of these is true / Registra una decisión cuando se cumpla **alguna**:

- it chose between real alternatives / eligió entre alternativas reales;
- it will be expensive to reverse / revertirla será caro;
- a future reader would ask *"why is it like this?"* / alguien preguntará después *"¿por qué es así?"*.

Every rationale points at a source (commit, `file:line`, spec history, CHANGELOG, `idea/`). If none exists, say so — never invent one.
Cada justificación apunta a una fuente. Si no existe, dilo — nunca la inventes.

Use `/sdd:decision` to capture one interactively. / Usa `/sdd:decision` para capturarla conversando.

## Records / Registros

| Date / Fecha | Decision / Decisión | File / Archivo |
|---|---|---|
| 2026-08-25 | Adopción del sidecar SDD y congelado de `tasks/` y `reviews/` | `2026-08-25-adopcion-sdd-sidecar.md` |
| 2026-08-25 | No aplicar `sdd-mcp upgrade` sobre `specs/_template/spec.md` | `2026-08-25-no-aplicar-upgrade-spec-template.md` |
| 2026-08-25 | Estado de ramas tras la auditoría Git y qué NO se hace todavía | `2026-08-25-auditoria-git-y-estado-de-ramas.md` |
| 2026-08-25 | Las capas del board son épicas, no grupos de JSON Canvas | `2026-08-25-capas-del-board-como-epicas.md` |
| 2026-08-25 | Aprobación de alcance de B1 y B2 de Visitador MP02, y por qué la compuerta SDD sigue cerrada | `2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md` |
