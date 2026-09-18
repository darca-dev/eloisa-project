import { pathToFileURL } from 'node:url';

export const SMOKE_PATHS = ['/', '/hospital', '/municipality'];

export async function runSmoke({ publicOrigin, oidcIssuer, fetchImpl = fetch }) {
  if (!publicOrigin?.startsWith('https://') || !oidcIssuer?.startsWith('https://')) {
    throw new Error('HTTPS public origin and OIDC issuer are required');
  }
  const targets = [
    ...SMOKE_PATHS.map((path) => ({ name: path, url: new URL(path, publicOrigin) })),
    { name: 'API health', url: new URL('/health', publicOrigin) },
    { name: 'OIDC metadata', url: new URL('.well-known/openid-configuration', `${oidcIssuer.replace(/\/$/u, '')}/`) },
  ];
  const results = [];
  for (const target of targets) {
    const response = await fetchImpl(target.url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    if (!response.ok && ![301, 302, 303, 307, 308].includes(response.status)) throw new Error(`${target.name} is not reachable`);
    results.push({ name: target.name, status: response.status });
  }
  return { reachable: results, browserAcceptance: 'NOT_EXECUTED' };
}

// Guarda de modulo principal portable (ver `preflight.mjs`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSmoke({ publicOrigin: process.env.MERDN_PUBLIC_ORIGIN, oidcIssuer: process.env.MERDN_HUMAN_AUTH_ISSUER })
    // eslint-disable-next-line no-console -- CLI de verificacion: la salida es la evidencia exigida.
    .then((r) => console.log(`HTTP smoke: PASS (${r.reachable.length}); browser acceptance: ${r.browserAcceptance}`))
    // eslint-disable-next-line no-console -- CLI de verificacion: la salida es la evidencia exigida.
    .catch(() => { console.error('HTTP smoke failed'); process.exitCode = 1; });
}
