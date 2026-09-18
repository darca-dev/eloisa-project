# Especificación 001 - Fundación técnica del monorepo

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built. Aprobarla significa: el Product Owner confirma que este documento -->
<!-- describe fielmente lo ya construido. NO autoriza implementación nueva. -->

## Naturaleza de esta spec

**As-built.** Documenta capacidad ya implementada y auditada antes de la adopción
de SDD. Su Task Specification original es `tasks/TASK-001.md` y su auditoría
`reviews/REVIEW-001-FINAL.md`, ambas congeladas. No propone trabajo nuevo.

## Objetivo

Que MERDN tenga un monorepo TypeScript ejecutable —API, web, paquete compartido,
base de datos y contenedores— sin ningún dominio de negocio dentro, de modo que
las capacidades posteriores se construyan sobre una base común en vez de sobre
decisiones improvisadas por cada módulo.

## Historia de usuario principal

Como persona que se incorpora al desarrollo de MERDN, quiero clonar el
repositorio y levantar el sistema completo con un comando, para empezar a
trabajar sin reconstruir la infraestructura ni adivinar cómo se conectan las
piezas.

## Qué hace hoy el sistema

- **Monorepo npm workspaces** con `apps/*` y `packages/*` (`package.json:12-15`).
- **API NestJS** en `apps/api`, arrancada por `apps/api/src/main.ts`, que compone
  módulos por dominio desde `app.module.ts`.
- **Web Next.js App Router** en `apps/web`.
- **Paquete compartido** `@merdn/shared`, cuya superficie pública es
  exclusivamente el contrato de salud (`packages/shared/src/index.ts`).
- **PostgreSQL con Prisma 7.9** y `prisma.config.ts` en la raíz.
- **Docker Compose** con cuatro servicios: `postgres`, `api`, `web`, `oidc-local`,
  sobre la red `merdn-internal` y el volumen `merdn-postgres-data`.
- **Endpoint de salud** `GET /health` (`apps/api/src/health/health.controller.ts`),
  cuyo contrato vive en el paquete compartido y no en la API.
- **Configuración validada al arranque** en `apps/api/src/config/environment.ts`,
  que lee 18 variables y falla si faltan las obligatorias.
- **Node 24 fijado** por `engines` y `.nvmrc`.
- **ESLint 9 plano** y `tsconfig.base.json` compartido.

## Dependencias

Ninguna. Es la capacidad raíz del repositorio: el primer commit de código.

**Dependencias externas:** Node 24, PostgreSQL, Docker Compose.

**Specs que dependen de esta:** todas (002 a 017). Cualquier cambio en workspaces,
orden de compilación, validación de entorno o servicios de Compose las afecta a
todas.

## Escenarios de aceptación

1. Dado un repositorio recién clonado con `.env` derivado de `.env.example`,
   cuando se ejecuta `npm run docker:up`, entonces los cuatro servicios arrancan
   y `GET /health` responde el contrato declarado en `@merdn/shared`.
2. Dado que faltan variables de entorno obligatorias, cuando arranca la API,
   entonces falla en el arranque con un error que las nombra, en vez de arrancar
   degradada.
3. Dado el monorepo, cuando se ejecuta `npm run typecheck`, entonces se compila
   primero `@merdn/shared` y después cada workspace que declare el script.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se solicite `GET /health`, EL SISTEMA DEBERÁ responder con la forma
  declarada en `@merdn/shared`, sin exponer versión de dependencias, rutas
  internas ni estado de la base de datos más allá de lo contratado.
- CUANDO se construya el monorepo, EL SISTEMA DEBERÁ compilar `@merdn/shared`
  antes que `@merdn/api` y `@merdn/web`, porque ambos dependen de sus tipos.
- SI falta una variable de entorno obligatoria, ENTONCES EL SISTEMA DEBERÁ
  impedir el arranque de la API en vez de continuar con un valor por defecto.
- EL SISTEMA DEBERÁ mantener `prototype-claude/` fuera de toda ruta de
  compilación, empaquetado y ejecución.

## Ámbito de archivos / File scope

- `package.json`, `tsconfig.base.json`, `eslint.config.mjs`, `.nvmrc` — raíz del monorepo
- `apps/api/src/main.ts`, `apps/api/src/app.module.ts` — arranque y composición
- `apps/api/src/health/` — endpoint de salud
- `apps/api/src/config/` — validación de entorno
- `packages/shared/src/` — contrato compartido
- `compose.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile` — contenedores
- `prisma.config.ts` — configuración de Prisma

## Estado real y límites conocidos

- **`@merdn/shared` está prácticamente vacío.** 89 líneas, solo el contrato de
  salud. `apps/web` **no lo importa en ningún archivo** (verificado con `grep`
  el 2026-08-25). Los contratos de API se redeclaran a mano en cada cliente web.
  Es deuda estructural conocida, no un olvido de esta capacidad: TASK-001
  limitaba el paquete a contratos técnicos.
- **No existe pipeline de CI.** No hay `.github/workflows` ni equivalente. Los
  comandos `lint`, `typecheck`, `test` y `prisma:validate` existen y se ejecutan
  a mano.
- **`TASK-DEPLOY-DEMO-01` quedó diferida** (commit `3dd3c23`,
  «Add deferred Eloisa demo deployment task»). El despliegue en Hostinger VPS
  aprobado en `docs/ARCHITECTURE.md` §2.1 no se ha ejecutado. Lo que existe es
  Docker Compose local.

## Criterios de éxito

- `npm run docker:up` levanta los cuatro servicios y `GET /health` responde.
- `npm run typecheck` y `npm run lint` terminan sin error.
- Ningún dominio de negocio vive en `packages/shared`.
