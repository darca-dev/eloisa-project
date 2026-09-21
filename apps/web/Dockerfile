# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# MERDN web (Next.js App Router) — imagen de desarrollo/ejecución
# (TASK-001, FR-13)
#
# Contexto de build: raíz del monorepo (necesario para npm workspaces).
# Usa la salida `standalone` de Next.js, que traza únicamente las dependencias
# realmente utilizadas. El proceso final se ejecuta como usuario no-root.
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
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npm run build --workspace @merdn/shared \
 && npm run build --workspace @merdn/web

# --- Imagen final ------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
# Next does not copy `public/` into the standalone output.  Without this
# explicit copy, every local asset requested by the browser (brand and Eli
# assets) resolves to 404, and `next/image` consequently returns 400.
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
