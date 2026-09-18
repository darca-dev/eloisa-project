# Investigación 004 - Orquestador MERDN V1

Medido sobre `develop` el 2026-08-25.

## R1. Volumen y forma

`tools/` suma 10.166 líneas, casi todas del orquestador. Archivos mayores:
`src/runtime/engine.ts` (2.125) y `src/store/store.ts` (1.056).

Estructura por capas: `domain/` (budget, errors, gates, ids, modes, progress,
redaction, states), `runtime/` (context, engine, metrics, recovery), `adapters/`,
`store/`, `ui/`, `workspace/`.

## R2. Pruebas

`tests/orchestrator/` contiene 11 archivos: `adapters`, `aprobacion-ventana`,
`e2e`, `engine`, `fsm`, `gates`, `helpers`, `metrics`, `panel`, `security`,
`store`. Se ejecutan con el runner nativo de Node (`node --test`), no con Vitest,
a diferencia del resto del repositorio.

La existencia de `security.test.mts` y `aprobacion-ventana.test.mts` indica que
la redacción y la ventana de aprobación están cubiertas por prueba, no solo
implementadas.

## R3. Modo sin credenciales

`adapters/mocks.ts` y el script `orchestrator:mock` permiten ejecutar el ciclo
completo sin proveedor externo. Es lo que hace la herramienta verificable en
cualquier máquina.

## R4. Estado local fuera de git

`.gitignore` excluye `.merdn/` con el comentario
«Estado local del MERDN Orchestrator (TASK-MERDN-ORCHESTRATOR-V1, AD-09)». La
decisión está trazada a un identificador de decisión de la tarea original.

## R5. Relación con la gobernanza

La herramienta automatiza el flujo de `CLAUDE.md` §13. No lo sustituye ni lo
modifica: las compuertas siguen requiriendo decisión del Product Owner.

## R6. Verificación no ejecutada

`node_modules` ausente: no se ejecutaron `orchestrator:test` ni
`orchestrator:mock`.
