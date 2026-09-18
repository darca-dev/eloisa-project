# Especificación 004 - Orquestador MERDN V1

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specification original: `tasks/TASK-MERDN-ORCHESTRATOR-V1.md`.
Auditoría: `reviews/REVIEW-MERDN-ORCHESTRATOR-V1-FINAL.md`. Diseño:
`docs/MERDN-ORCHESTRATOR-V1.md`. Congeladas.

## Objetivo

Que el ciclo Product Owner → Codex → Claude Code → auditoría descrito en
`CLAUDE.md` §13 se pueda ejecutar como proceso controlado, con estados
explícitos, compuertas de aprobación, presupuesto, redacción de datos sensibles
y recuperación ante fallo, en vez de depender de la coordinación manual.

## Historia de usuario principal

Como Product Owner, quiero ver en qué estado está cada tarea del ciclo de agentes
y aprobar explícitamente los puntos de control, para no descubrir a posteriori
que un agente cruzó una frontera que yo no autoricé.

## Qué hace hoy el sistema

- **Máquina de estados** del ciclo de tarea (`src/domain/states.ts`,
  `src/domain/modes.ts`), con compuertas en `src/domain/gates.ts`.
- **Motor de ejecución** (`src/runtime/engine.ts`, 2.125 líneas) con métricas
  (`runtime/metrics.ts`) y recuperación (`runtime/recovery.ts`).
- **Adaptadores por agente**: `adapters/claude.ts`, `adapters/codex.ts`,
  `adapters/openai-product-assistant.ts`, más `adapters/mocks.ts` para ejecución
  sin llamadas reales.
- **Presupuesto** (`domain/budget.ts`) y **redacción de datos sensibles**
  (`domain/redaction.ts`).
- **Almacén persistente** (`store/store.ts`, `store/schema.ts`).
- **Panel y servidor de interfaz** (`ui/panel.ts`, `ui/server.ts`).
- **Guardas de espacio de trabajo y git** (`workspace/guard.ts`,
  `workspace/git.ts`).
- **Modo mock** ejecutable sin credenciales: `npm run orchestrator:mock`.
- **11 archivos de prueba** en `tests/orchestrator/`, incluidos `security.test.mts`
  y `aprobacion-ventana.test.mts`.

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | Node 24, TypeScript, estructura de `tools/` | El orquestador se ejecuta con el runtime y el tipado del monorepo |

**Dependencias externas:** proveedores de modelo para los adaptadores reales
(Claude, Codex, asistente de producto). El modo `--mock` existe precisamente para
no depender de ellos.

**Documentos:** `docs/MERDN-ORCHESTRATOR-V1.md` (diseño) y los 9 documentos de
`agents/` (roles que orquesta).

**Specs que dependen de esta:** ninguna. Es tooling interno; ninguna capacidad de
producto la necesita para funcionar.

## Escenarios de aceptación

1. Dado un ciclo en curso, cuando alcanza una compuerta de aprobación, entonces
   se detiene y espera decisión explícita en vez de continuar.
2. Dado `--mock`, cuando se ejecuta el orquestador, entonces completa el ciclo sin
   realizar ninguna llamada a un proveedor externo ni requerir credenciales.
3. Dado un texto con datos sensibles, cuando el orquestador lo registra, entonces
   los redacta antes de persistirlos.
4. Dada una ejecución interrumpida, cuando se reanuda, entonces recupera el estado
   desde el almacén y no reinicia el ciclo.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO el ciclo alcance una compuerta de aprobación, EL SISTEMA DEBERÁ detener
  el avance hasta recibir una decisión explícita.
- CUANDO se registre cualquier salida de agente, EL SISTEMA DEBERÁ aplicar
  redacción antes de persistirla.
- SI se supera el presupuesto configurado, ENTONCES EL SISTEMA DEBERÁ detener la
  ejecución en vez de continuar consumiendo.
- EL SISTEMA NO DEBERÁ operar sobre `main` ni realizar commits, merges o
  despliegues por iniciativa propia (`CLAUDE.md` §12).
- EL SISTEMA DEBERÁ mantener su estado local fuera del control de versiones
  (`.merdn/`, declarado en `.gitignore`).

## Ámbito de archivos / File scope

- `tools/merdn-orchestrator/` — implementación completa
- `tests/orchestrator/` — 11 archivos de prueba
- `docs/MERDN-ORCHESTRATOR-V1.md` — diseño
- `.gitignore` — exclusión de `.merdn/`

## Estado real y límites conocidos

- Son **10.166 líneas de herramienta de orquestación de agentes dentro del
  repositorio de producto**. No entrega valor al usuario final de MERDN: es
  tooling interno. Su coste de mantenimiento compite con el del producto.
- El motor concentra 2.125 líneas en un solo archivo.
- Los adaptadores dependen de proveedores externos cuya disponibilidad no
  controla este repositorio; el modo mock existe precisamente por eso.

## Criterios de éxito

- `npm run orchestrator:mock` completa un ciclo sin credenciales.
- `npm run orchestrator:test` pasa.
- Ninguna ejecución escribe en `main` ni fuera del espacio de trabajo declarado.
