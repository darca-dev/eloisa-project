# Plan 003 - Experiencia visual Hospital

## Resumen

**Retrospectivo.** Ocho microtareas encadenadas, cada una con su auditoría antes
de la siguiente. Reconstruido desde `history.md`.

## Contexto técnico

Hospital es una **experiencia diferenciada sobre capacidades compartidas**, no un
producto aparte (`CLAUDE.md` §5, `docs/MODULES.md` §37-38). El shell se construyó
primero y las secciones se añadieron encima, de modo que ninguna sección
reimplementa navegación, contexto ni identidad.

## Fases de implementación (ejecutadas)

1. Shell — `ee7f878`, `97dc406`, `d462a16`.
2. Dashboard y KPI — `c386033`, `528a781`, `f5e928b`.
3. Operaciones — `d3c85be`, `263267f`, `2e1fe65`.
4. Cuidado y fuerza laboral — `f89353f`, `1ee64d5`, `d465813`.
5. Administración y centro de control — `b01c7e4` … `e9d612b`.
6. Gestión financiera — `cd4a41f`, `21920f5`, `3eb0a17`.
7. Analítica de pacientes — `55f7acf`, `57930dc`, `701d5d4`.
8. Reportes — `b9b71cd`, `20cb5d3`.

El flujo de alertas y Elí se documentó en paralelo (`9044009`,
`docs/WORKFLOW-ALERTAS-ELI.md`).

## Dependencias

- Spec 001: monorepo y app Next.js.
- Specs 009, 010, 013 y 014 conectaron después cinco secciones a la API.

## Hitos

- H1: shell navegable — fase 1.
- H2: las 18 secciones alcanzables — fase 8.

## Riesgos (vigentes)

- **13 de 18 secciones sin backend.** Riesgo de que la interfaz se lea como
  capacidad existente. Mitigado únicamente por documentación; no hay marca visual
  que distinga sección conectada de sección de configuración.
- **Concentración de complejidad** en archivos de más de 1.000 líneas.
- La fidelidad visual de varias secciones requirió recuperación posterior
  (spec 015), señal de que el shell y las secciones se acoplaron más de lo
  previsto.
