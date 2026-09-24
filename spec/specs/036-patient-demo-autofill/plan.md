# Plan 036 — Autocarga de pacientes demo

## Resumen

Crear fixtures locales tipados y conectarlos al reductor ya existente mediante
una acción explícita de autocarga.

## Fases de implementación

1. Definir tres fixtures ficticios que cumplen la validación actual.
2. Añadir una acción del reductor que cargue una copia del fixture en la rama
   Paciente y limpie errores locales.
3. Renderizar los botones solo en Datos personales y verificar el flujo.

## Dependencias

- Tipos y validación existentes en `inscripcionFlow.ts`.

## Riesgos

- Una fixture incompleta puede fallar en un paso posterior; se comprobará cada
  perfil con la validación de los cinco pasos.
- Un documento ya enviado puede provocar el conflicto normal de la API; la
  autocarga por sí misma nunca hace ese envío.
