# Decisión importante — Adopción del sidecar SDD y congelado del histórico `tasks/` y `reviews/`

## Fecha

2026-08-25

## Contexto

MERDN ya tenía un sistema de gobernanza completo y en uso: `AGENTS.md` (694 líneas),
`CLAUDE.md` con el TASK SPECIFICATION CONTRACT (§8) y las STOP CONDITIONS (§9),
58 Task Specifications en `tasks/` y 20 auditorías de Codex en `reviews/`.

El problema: **toda esa gobernanza era prosa, no mecanismo.** No existe ningún
pipeline de CI en el repositorio (verificado el 2026-08-25: no hay
`.github/workflows` ni configuración equivalente). La regla "no hay código sin
Task Specification aprobada" (`CLAUDE.md` §3) dependía por completo de que cada
agente la leyera y la respetara, y de que Codex la auditara después a mano.

El Product Owner pidió adoptar el template Spec-Driven Development
(`@juanklagos/create-sdd-project`) para ordenar el ciclo de especificación.

Restricción determinante: SDD trae su propia estructura (`spec/specs/NNN-slug/`
con `spec.md`, `plan.md`, `tasks.md`, `history.md`) que se solapa casi 1:1 con
`tasks/` y `reviews/`. Instalarlo sin resolver ese solapamiento produciría dos
fuentes de verdad en paralelo — que es literalmente la STOP CONDITION §9.1 del
propio `CLAUDE.md`.

## Decisión

**Se adopta el sidecar SDD en `spec/` como sistema canónico de especificación, y
se congelan `tasks/` y `reviews/` como archivo histórico de solo lectura.**

Detalle:

1. Instalación en modo `sidecar`, perfil `recommended`, template v2.6.0. El código
   ejecutable sigue en la raíz; `spec/` contiene únicamente gobernanza.
2. `tasks/` y `reviews/` quedan cerrados en la fecha de esta decisión. No se
   migran ni se reescriben. Cada uno lleva un `README.md` que declara el estado y
   redirige a `spec/`. Ver `tasks/README.md` y `reviews/README.md`.
3. Toda especificación nueva nace en `spec/specs/<NNN-slug>/` vía
   `./spec/scripts/new-spec.sh`.
4. Se añade `CLAUDE.md` §14 y `AGENTS.md` §22, que fijan ubicaciones canónicas,
   orden de precedencia y las reglas de la compuerta. Sin eso, los agentes leen
   `CLAUDE.md` y nunca se enteran de que `spec/` existe — el propio instalador
   emite un warning por esto y no toca esos archivos.
5. Se establece que `CLAUDE.md` §8 prevalece sobre el `spec.md` genérico del
   framework: una spec no autoriza implementar hasta cubrir los 18 campos del
   contrato, aunque la compuerta devuelva OK.
6. De los 11 stubs raíz que el instalador ofrece, se conservan `AI_START_HERE.md`
   y `INSTRUCTIONS.md`; se eliminan los de Gemini, Windsurf, Aider, Roo, Cursor y
   Copilot por no corresponder a los agentes que operan este repositorio
   (Claude Code y Codex).

## Alternativas consideradas

**Migrar las 58 Task Specs y 20 revisiones al formato SDD.** Rechazada. Produce
fuente única real, pero reescribe artefactos que Codex ya auditó en su formato
original, rompe la correspondencia entre cada Task Spec y su revisión y los
commits que la implementaron, y es un trabajo grande cuyo beneficio es sobre todo
cosmético: el histórico se lee, no se ejecuta.

**Mantener `tasks/` como canónico y usar SDD solo como tablero visual.**
Rechazada. Mínima disrupción, pero renuncia justamente a lo único que SDD aporta
que MERDN no tenía: una compuerta que falla. Sin eso la adopción no resuelve el
problema que la motivó.

## Consecuencias

Mejora: la regla de §3 pasa a ser verificable por script. `check-sdd-gate.sh`
devuelve **exit code 1** cuando hay una spec aprobada con campos de aprobación
incompletos o sin consentimiento registrado (verificado el 2026-08-25 con una
spec de prueba, después eliminada). Eso lo hace utilizable como paso de CI, que
es el hallazgo abierto más importante del análisis del repositorio.

Trade-off aceptado: durante un tiempo habrá dos ubicaciones donde buscar el
"porqué" de una parte del código — `tasks/` para lo anterior al 2026-08-25 y
`spec/specs/` para lo posterior. Se acepta porque la frontera es una fecha, no un
criterio de juicio, y por tanto no es ambigua.

Se vuelve más difícil: crear una spec nueva cuesta más que antes, porque además
del `spec.md` del framework hay que satisfacer los 18 campos de `CLAUDE.md` §8.
Es deliberado.

Archivos afectados: `spec/` (64 archivos nuevos), `CLAUDE.md` (§2 y §14 nuevos),
`AGENTS.md` (§22 nuevo), `tasks/README.md`, `reviews/README.md`, `.gitignore`.

Limitación conocida, declarada por el propio script: la compuerta **no** verifica
que el código del repositorio corresponda a una spec aprobada. Solo verifica que
exista una spec aprobada, consistente y consentida. La correspondencia entre
código y spec sigue siendo trabajo de la auditoría de Codex (`CLAUDE.md` §11).

## Cuándo revisar esta decisión

- Si se conecta `check-sdd-gate.sh` a un pipeline de CI: revisar entonces si el
  congelado de `tasks/` sigue siendo suficiente o si el CI necesita que el
  histórico sea legible por máquina.
- Si el equipo crece más allá del Product Owner, Codex y Claude Code: los stubs
  de agentes eliminados en el punto 6 habría que reponerlos.
- Si `tasks/` deja de consultarse durante dos ciclos completos de trabajo: la
  frontera dejó de tener coste y el histórico puede archivarse más agresivamente.
- Si el framework SDD publica una versión cuyo contrato de `spec.md` ya cubra los
  campos de `CLAUDE.md` §8: entonces §14.3 pasa a ser redundante y debe retirarse.

## Registros relacionados

Primer registro de la bitácora. No extiende ni reemplaza ninguno.

Documentos que esta decisión modifica: `CLAUDE.md` §2 y §14, `AGENTS.md` §22.
