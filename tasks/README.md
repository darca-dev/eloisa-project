# `tasks/` — Archivo histórico congelado (pre-SDD)

**Estado: solo lectura. Cerrado el 2026-08-25.**

Este directorio contiene las 58 Task Specifications que gobernaron MERDN antes de
la adopción de Spec-Driven Development. Se conserva íntegro como **evidencia de
auditoría**: cada archivo aquí fue la especificación aprobada contra la que
Codex auditó una implementación concreta, y su par correspondiente vive en
`reviews/`.

## Qué NO se debe hacer aquí

- No crear Task Specifications nuevas. Toda especificación nueva nace en
  `spec/specs/<NNN-slug>/` mediante `./spec/scripts/new-spec.sh`.
- No editar, reescribir, renumerar, reformatear ni "poner al día" ningún archivo
  existente. Son artefactos de auditorías cerradas; modificarlos destruye la
  correspondencia con `reviews/` y con los commits que los implementaron.
- No migrar su contenido al formato SDD. La decisión del Product Owner fue
  congelar el histórico, no reescribirlo.

## Qué SÍ se debe hacer

- Leerlos. Siguen siendo la explicación autoritativa de por qué el código
  existente es como es, y el contexto obligatorio antes de tocar un módulo que
  alguno de ellos definió.
- Citarlos desde una spec nueva cuando corresponda, por Task ID
  (p. ej. `TASK-HOSPITAL-CORE-02`, `VISITS-CORE-01-MP04`).

## Dónde está lo vigente

| Necesitas | Ve a |
|---|---|
| Crear una especificación | `./spec/scripts/new-spec.sh "<slug>" "<owner>"` |
| Especificaciones vigentes | `spec/specs/` |
| Índice de specs | `spec/specs/INDEX.md` |
| Contrato que debe cumplir una spec | `CLAUDE.md` §8 y §14.3 |
| Reglas de la compuerta | `CLAUDE.md` §14.4 |
| Auditorías históricas | `reviews/` |

El mapeo entre este archivo histórico y el modelo SDD está en `CLAUDE.md` §14.1
y `AGENTS.md` §22.1.
