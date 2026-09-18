# Plan 004 - Orquestador MERDN V1

## Resumen

**Retrospectivo.** Tres commits: diseño, auditoría e implementación completa.

## Contexto técnico

El diseño previo vive en `docs/MERDN-ORCHESTRATOR-V1.md` (297 líneas) y se
aprobó antes de escribir código. Es la única capacidad del repositorio con
documento de diseño propio en `docs/`.

## Fases de implementación (ejecutadas)

1. Diseño — `d813619`.
2. Auditoría final del diseño — `9b6a79f`.
3. Implementación V1 — `6ae59f2`: dominio, runtime, adaptadores, almacén, panel,
   guardas y las 11 pruebas.

## Dependencias

- Spec 001: monorepo y Node 24.
- Los 9 documentos de `agents/` definen los roles que la herramienta orquesta.

## Hitos

- H1: diseño aprobado y auditado — fase 2.
- H2: ciclo ejecutable en modo mock — fase 3.

## Riesgos (vigentes)

- **Tooling dentro del repositorio de producto.** 10.166 líneas que no sirven al
  usuario final y que cualquier cambio de gobernanza obliga a mantener. Valdría
  evaluar si debe vivir en un repositorio propio; es decisión del Product Owner,
  no local.
- **Concentración** de 2.125 líneas en `engine.ts`.
- **Dependencia de proveedores externos** en los adaptadores reales.
