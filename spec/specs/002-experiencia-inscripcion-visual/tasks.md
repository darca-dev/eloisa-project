# Tareas 002 - Experiencia de inscripción y paciente (visual)

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

- [x] Tres recorridos de inscripción por rol (paciente, cuidador, visitador)
- [x] Máquina de pasos separada de la vista, probada sin jsdom
- [x] Elí con expresiones por contexto y burbuja de diálogo
- [x] Shell de móvil e indicador de progreso
- [x] Catálogo DIVIPOLA sin municipio piloto codificado
- [x] Inicio y bitácora del paciente
- [x] Restauración de sesión de la experiencia, con prueba
- [x] Errores comunicados con texto, no solo con color

## Límites conocidos (no autorizados como trabajo)

- [ ] Persistencia de la bitácora del paciente: no existe modelo en Prisma
- [ ] División de `inscripcionFlow.ts` (1.315 líneas)

## Verificación pendiente

- [ ] Ejecutar la suite de `features/inscripcion` y `features/paciente`
