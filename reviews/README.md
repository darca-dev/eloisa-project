# `reviews/` — Archivo histórico congelado (pre-SDD)

**Estado: solo lectura. Cerrado el 2026-08-25.**

Este directorio contiene las 20 auditorías que Codex realizó sobre las Task
Specifications de `tasks/` antes de la adopción de Spec-Driven Development. Cada
archivo es el veredicto de una auditoría cerrada.

## Qué NO se debe hacer aquí

- No crear auditorías nuevas. La trazabilidad de trabajo nuevo vive en
  `spec/specs/<NNN-slug>/history.md` y en `spec/bitacora/handoffs/`.
- No editar, reescribir ni reabrir un veredicto existente. Una auditoría cerrada
  es un hecho registrado, no un documento vivo.
- No borrar ninguno, aunque su Task Spec parezca obsoleta.

## Qué SÍ se debe hacer

- Leerlos antes de tocar un módulo que ya fue auditado: registran defectos
  encontrados, desviaciones aceptadas y riesgos residuales que siguen vigentes
  en el código actual.
- Citarlos desde una spec nueva cuando un riesgo residual documentado aquí sea
  relevante para el trabajo propuesto.

## Dónde está lo vigente

| Necesitas | Ve a |
|---|---|
| Registrar el resultado de una implementación | `spec/specs/<NNN-slug>/history.md` |
| Entregar trabajo a Codex (handoff de `CLAUDE.md` §11) | `spec/bitacora/handoffs/` |
| Registrar una decisión del Product Owner | `spec/bitacora/decisiones/` |
| Bitácora diaria | `spec/bitacora/diaria/` |
| Task Specs históricas correspondientes | `tasks/` |

El mapeo entre este archivo histórico y el modelo SDD está en `CLAUDE.md` §14.1
y `AGENTS.md` §22.1.
