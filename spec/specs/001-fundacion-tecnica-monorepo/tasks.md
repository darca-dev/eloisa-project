# Tareas 001 - Fundación técnica del monorepo

> As-built: `[x]` = verificado presente en el código el 2026-08-25.
> `[ ]` = límite conocido, no trabajo autorizado.

## Implementado

- [x] Monorepo npm workspaces con `apps/*` y `packages/*`
- [x] API NestJS con composición modular en `app.module.ts`
- [x] Web Next.js App Router
- [x] Paquete `@merdn/shared` con el contrato de salud
- [x] Prisma 7.9 + PostgreSQL y `prisma.config.ts`
- [x] Docker Compose con `postgres`, `api`, `web`, `oidc-local`
- [x] `GET /health` con contrato compartido
- [x] Validación de entorno al arranque, con prueba unitaria
- [x] Node 24 fijado en `engines` y `.nvmrc`
- [x] ESLint 9 plano y `tsconfig.base.json`
- [x] `@scarf/scarf` bloqueado en `allowScripts`

## Límites conocidos (no autorizados como trabajo)

- [ ] Pipeline de CI que ejecute `lint`, `typecheck`, `test`, `prisma:validate`
- [ ] `@merdn/shared` consumido por el frontend en vez de contratos duplicados
- [ ] Despliegue en Hostinger VPS (`TASK-DEPLOY-DEMO-01`, diferida)

## Verificación pendiente

- [ ] Ejecutar `npm ci && npm run typecheck && npm run lint && npm run test` y
      registrar el resultado en `history.md`
