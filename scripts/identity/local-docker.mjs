import { execFileSync } from 'node:child_process';

export function assertLocalDockerEndpoint(endpoint, platform = process.platform) {
  const valid = platform === 'win32'
    ? /^npipe:\/\/\/\/\.\/pipe\/(?:docker_engine|dockerDesktopLinuxEngine)$/u.test(endpoint)
    : /^unix:\/\/\//u.test(endpoint) && !endpoint.includes('\n') && !endpoint.includes('\r');
  if (!valid) throw new Error('A verified local Docker endpoint is required');
  return endpoint;
}

/** Pin every call to the same local endpoint; labels cannot prove locality. */
export function createLocalDocker(env = process.env) {
  if (env.DOCKER_HOST) assertLocalDockerEndpoint(env.DOCKER_HOST);
  const metadata = args => execFileSync('docker', args, { env, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  let endpoint = env.DOCKER_HOST;
  if (env.DOCKER_CONTEXT || !endpoint) {
    const context = env.DOCKER_CONTEXT || metadata(['context', 'show']);
    endpoint = JSON.parse(metadata(['context', 'inspect', context, '--format', '{{json .Endpoints.docker.Host}}']));
  }
  assertLocalDockerEndpoint(endpoint);
  const fixedEnv = { ...env };
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete fixedEnv[key];
  return args => execFileSync('docker', ['--host', endpoint, ...args], { env: fixedEnv, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
