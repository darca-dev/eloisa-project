# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# MERDN API (NestJS) — imagen de desarrollo/ejecución (TASK-001, FR-13)
#
# Contexto de build: raíz del monorepo (necesario para npm workspaces).
# Imagen base oficial con versión explícita. El proceso final se ejecuta como
# usuario no-root (`node`). No incluye SDKs de nube, pagos ni identidad.
# ---------------------------------------------------------------------------

FROM node:24.19.0-alpine AS base
WORKDIR /repo
ENV npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false

# --- Dependencias completas (incluye devDependencies para compilar) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

# --- Compilación -------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
# El cliente Prisma NO se versiona: se genera desde el esquema ANTES de compilar,
# porque `apps/api/src` lo importa. Sin este paso el build falla en un checkout
# limpio.
#
# `prisma generate` no abre ninguna conexión, pero `prisma.config.ts` resuelve
# `DATABASE_URL` al cargarse. Se usa `.env.example` —valores ficticios y ya
# versionados— únicamente en esta etapa intermedia. La imagen final NO copia
# este archivo: solo recibe `dist` y las dependencias de ejecución, y la cadena
# de conexión real llega por variables de entorno en el despliegue.
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY .env.example ./.env
RUN npx --no-install prisma generate && rm -f ./.env
RUN npm run build --workspace @merdn/shared \
 && npm run build --workspace @merdn/api

# --- Dependencias de ejecución ----------------------------------------------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev

# --- Imagen final ------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /repo/package.json ./package.json
COPY --from=build --chown=node:node /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist

USER node
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
