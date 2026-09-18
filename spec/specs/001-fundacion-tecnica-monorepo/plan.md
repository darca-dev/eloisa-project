# Plan 001 - Fundación técnica del monorepo

## Resumen

**Retrospectivo.** Reconstruye cómo se construyó esta capacidad, a partir de los
commits reales listados en `history.md`. No es un plan de trabajo futuro.

## Contexto técnico

Stack aprobado en `docs/ARCHITECTURE.md` §2.1: TypeScript, Node 24 LTS, Next.js
App Router, NestJS, REST/OpenAPI, PostgreSQL, Prisma, Docker Compose y Hostinger
KVM 4. El estilo es monolito modular en monorepo, no microservicios
(`docs/ARCHITECTURE.md` §3.1).

## Fases de implementación (ejecutadas)

1. Especificación y auditoría previa — `16b73f4`, `a8f9449`, `c75a5d7`.
2. Implementación de la fundación — `f34127a`: workspaces, API NestJS, web
   Next.js, `@merdn/shared`, Prisma, Compose, `/health`, ESLint y tsconfig.
3. Corrección del arranque local del frontend — `780c4f8`.

## Dependencias

Ninguna previa: es la primera capacidad del repositorio. Todo lo demás depende
de ella.

## Hitos

- H1: monorepo compila y `/health` responde — alcanzado en `f34127a`.
- H2: arranque local reproducible — alcanzado en `780c4f8`.

## Riesgos (vigentes hoy, no históricos)

- **Sin CI**, nada garantiza que los comandos de verificación se ejecuten. Es el
  riesgo abierto más importante del repositorio.
- **`@merdn/shared` sin uso en el frontend** empuja a redeclarar contratos a
  mano en cada cliente web. Ya ocurre en 6 clientes.
- **Despliegue no ejecutado**: la arquitectura aprueba Hostinger VPS pero
  `TASK-DEPLOY-DEMO-01` quedó diferida.
