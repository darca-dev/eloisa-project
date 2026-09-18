# Historial 018 - Correcciones B1 y B2 de Visitador MP02

> Spec **prospectiva**: define trabajo no ejecutado. A diferencia de las 17
> anteriores, aquí no hay commits que reconstruir. Este historial empieza el día
> en que la spec se escribió y crecerá cuando el trabajo ocurra.

## Cambios de la spec

| Date / Fecha | Change type / Tipo de cambio | Summary / Resumen | Files impacted / Archivos impactados | Owner / Responsable |
|---|---|---|---|---|
| 2026-08-25 | Approval / Aprobación | **Spec aprobada por el Product Owner**, con alcance limitado a B1 y B2. Registrada en `spec.md` (estado, fecha, aprobador y evidencia) sin ejecutar consentimiento, sin escribir código, sin tocar la rama WIP y sin merge. La compuerta SDD sigue sin abrir: falta el consentimiento por spec, que es acto del Product Owner | `spec.md`, `history.md`, `spec/specs/INDEX.md`, `spec/bitacora/global/PROJECT_LOG.md` | Product Owner |
| 2026-08-25 | Scope / Alcance | Creación de la spec, acotada a B1 y B2 de la auditoría de Visitador MP02. Redactada tras la decisión del Product Owner de seguir la «vía B»: spec nueva y acotada, en vez de aprobar la spec 017 completa. Estructura creada con `./spec/scripts/new-spec.sh`; contenido redactado sobre medición en solo lectura de `cffbf6b`. Sin código, sin tocar la rama WIP, sin merge y sin consentimiento | `spec.md`, `plan.md`, `tasks.md`, `research.md`, `history.md`, `contracts/worklist-response.contract.md` | Product Owner / Claude Code |

## Commits

Ninguno todavía. Esta spec no ha producido código.

Cuando lo produzca, cada commit se registra aquí con fecha, SHA, rama, asunto y
número de archivos, siguiendo el formato de la spec 017 y leyéndolo de `git log`,
no de memoria.

## Origen y relaciones

| Elemento | Referencia |
|---|---|
| Capacidad de origen | spec `017-worklist-del-visitador` |
| Micropaquete | `VISITADOR-CORE-01 · MP02 — Visible Worklist + Agenda` (`tasks/VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md`, congelada) |
| Código a corregir | `wip/visitador-mp02-20260825`, commit `cffbf6bd7b5e19a4fb712467e928f92698b18b99` |
| Auditoría que la motiva | Codex, 2026-08-25: `PASS WITH CORRECTIONS` · `SAFE TO INTEGRATE INTO DEVELOP: NO` · `SPEC 017 READY FOR APPROVAL: NO` |
| Aprobación de alcance | `spec/bitacora/decisiones/2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md` |
| Correcciones cubiertas | B1 y B2, y ninguna más |
| Correcciones explícitamente NO cubiertas | B3, B4 y B5, que siguen pendientes de decisiones de producto |

## Estado

- Aprobación de la spec: **Aprobada** el 2026-08-25 por el Product Owner, con
  alcance limitado a B1 y B2.
- Consentimiento por spec: **no registrado**. Es un acto del Product Owner
  (`CLAUDE.md` §14.4); mientras falte, el gate reporta error para esta spec.
- Compuerta SDD: **sin abrir**.
- Decisión de rama para implementar: **abierta** (STOP CONDITION declarada en
  `spec.md`).
- Código: **ninguno**.
