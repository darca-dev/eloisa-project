import { existsSync } from 'node:fs';
import path from 'node:path';

import type { NextConfig } from 'next';

/**
 * El `.env` vive en la raíz del monorepo, no en `apps/web`, así que Next no lo
 * carga por sí solo. Se carga aquí —y no con `node --env-file-if-exists=`— porque
 * `next dev` reenvía los `execArgv` del proceso padre al servidor de desarrollo
 * mediante `NODE_OPTIONS`, y Node prohíbe `--env-file`/`--env-file-if-exists` en
 * esa variable. Las variables ya presentes en el entorno (Docker Compose, CI)
 * conservan precedencia.
 */
const rootEnvFile = path.join(import.meta.dirname, '../../.env');

if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

/**
 * Configuración Next.js de la fundación técnica MERDN (TASK-001).
 *
 * `standalone` produce un artefacto autocontenido apto para la imagen Docker.
 * `outputFileTracingRoot` apunta a la raíz del monorepo npm workspaces para que
 * el trazado de dependencias incluya `packages/shared`.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  reactStrictMode: true,
  poweredByHeader: false,
  // Next genera `AGENTS.md`/`CLAUDE.md` en `apps/web` al arrancar. Esos nombres
  // están reservados en este repositorio para documentos protegidos de la raíz,
  // así que la generación queda desactivada.
  agentRules: false,
};

export default nextConfig;
