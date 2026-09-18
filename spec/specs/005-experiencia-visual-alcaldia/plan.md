# Plan 005 - Experiencia visual Alcaldía

## Resumen

**Retrospectivo.** Cuatro tareas encadenadas más un cierre de demostración, cada
una auditada antes de la siguiente.

## Contexto técnico

Alcaldía y Hospital son experiencias diferenciadas sobre capacidades compartidas
(`CLAUDE.md` §5). El shell municipal se construyó aparte del hospitalario pero
sobre los mismos componentes de interfaz, sin duplicar arquitectura.

## Fases de implementación (ejecutadas)

1. A-01 — `2bc3cac`, `687fe77`, `1a921ee`.
2. A-02 — `55ea79a`, `7de7eeb`, `672a11a`.
3. A-03 — `b5e0225`, `3f4fdd1`, `257cbcb`.
4. A-04 — `f467312`, `58d7b98`, `e1d6970`.
5. Cierre de demostración — `e4fb006`, `f112821`, `72284a3`.

## Dependencias

- Spec 001: monorepo y app Next.js.
- Spec 008 conectó después Población y Territorio a la API.

## Hitos

- H1: shell municipal navegable — fase 1.
- H2: las 13 vistas alcanzables — fase 4.
- H3: demostración cerrada y auditada — fase 5.

## Riesgos (vigentes)

- **11 de 13 vistas sin backend**, con 5.059 líneas de configuración estática
  detrás. Es el mayor riesgo de lectura errónea del estado del producto.
- **Ámbitos regulados representados sin fuente oficial.** FURAG, MIPG y ADRES
  aparecen como vistas. Cualquier trabajo futuro sobre ellos entra directamente en
  las STOP CONDITIONS de `CLAUDE.md` §9.4.
- El tamaño de `municipalityConfig.ts` dificulta distinguir qué es estructura y
  qué es dato de demostración.
