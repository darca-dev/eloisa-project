# Plan 002 - Experiencia de inscripción y paciente (visual)

## Resumen

**Retrospectivo.** Reconstruido desde los commits de `history.md`.

## Contexto técnico

Referencia visual y de flujos: `prototype-claude/`, de solo lectura
(`CLAUDE.md` §6). La aplicación productiva se construyó fuera del prototipo y
sin depender de sus archivos `.dc.html`, su runtime ni sus datos de demostración.

## Fases de implementación (ejecutadas)

1. Fundación visual — `9d71946` (TASK-002).
2. Correcciones de inscripción — `7911314`, `819f8b3` (TASK-002A).
3. Auditoría de la fundación visual — `f4d5be3`.
4. Ajuste de marca — `21c78d7` (TASK-002B), ampliado después por la spec 006.
5. Implementación del flujo aprobado de inscripción y paciente — `06a76c3`.

## Dependencias

- Spec 001: monorepo y app Next.js.

## Hitos

- H1: los tres recorridos de inscripción completan — `06a76c3`.
- H2: restauración de sesión probada — `restauracionSesion.test.tsx`.

## Riesgos (vigentes)

- **La bitácora no persiste.** Una interfaz de bitácora sin modelo de datos puede
  leerse como capacidad existente. Cualquier trabajo futuro sobre ella requiere
  decisión de producto sobre propiedad, sensibilidad y retención del dato
  (`CLAUDE.md` §4).
- `inscripcionFlow.ts` con 1.315 líneas concentra mucha lógica en un archivo.
