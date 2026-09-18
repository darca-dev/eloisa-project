# Tareas 004 - Orquestador MERDN V1

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

- [x] Máquina de estados y modos del ciclo de tarea
- [x] Compuertas de aprobación con ventana explícita, cubiertas por prueba
- [x] Motor de ejecución con métricas y recuperación
- [x] Adaptadores Claude, Codex y asistente de producto
- [x] Modo mock ejecutable sin credenciales
- [x] Presupuesto y detención por límite
- [x] Redacción de datos sensibles antes de persistir, cubierta por prueba
- [x] Almacén persistente con esquema propio
- [x] Panel y servidor de interfaz
- [x] Guardas de espacio de trabajo y de git
- [x] Estado local `.merdn/` excluido del control de versiones
- [x] 11 archivos de prueba con el runner nativo de Node

## Límites conocidos (no autorizados como trabajo)

- [ ] Decisión sobre si el orquestador debe vivir en un repositorio propio
- [ ] División de `engine.ts` (2.125 líneas)

## Verificación pendiente

- [ ] Ejecutar `npm run orchestrator:test` y `npm run orchestrator:mock`
