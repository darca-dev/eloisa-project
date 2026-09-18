import { pathToFileURL } from 'node:url';

const PLACEHOLDER = /(replace|example\.invalid|change-me|sha256:replace)/iu;
const REQUIRED = [
  'DATABASE_URL', 'RUNTIME_DATABASE_URL', 'MERDN_RUNTIME_ROLE',
  'MERDN_STAGING_DOMAIN', 'MERDN_OIDC_DOMAIN', 'MERDN_TLS_CONTACT_EMAIL',
  'MERDN_API_IMAGE', 'MERDN_WEB_IMAGE', 'MERDN_OIDC_IMAGE',
  'MERDN_OIDC_DATABASE_NAME', 'MERDN_OIDC_DATABASE_USER', 'MERDN_OIDC_DATABASE_PASSWORD',
  // Pareja confiable del tenant activo (Spec 024). Bajo enforce la API no puede
  // descubrir el tenant por codigo, asi que ambas deben llegar completas.
  'MERDN_ACTIVE_TENANT_CODE', 'MERDN_ACTIVE_TENANT_ID',
];

// Identificadores SQL conservadores: el bootstrap de Keycloak los interpola con
// `format(%I)` y rechaza cualquier cosa fuera de este contrato.
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/u;

// UUID canonico del tenant activo. La API exige exactamente esta forma bajo
// `MERDN_RUNTIME_ROLE=enforce`; el preflight lo comprueba antes del despliegue.
const TENANT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// Roles que Keycloak nunca puede reutilizar como identidad de runtime.
const RESERVED_DATABASE_ROLES = ['merdn_runtime', 'merdn_migrator', 'postgres'];

// Todas las imagenes de staging comparten el mismo estandar inmutable: OIDC no
// puede quedarse con un tag flotante mientras API y web se fijan por digest.
export const PINNED_IMAGE_KEYS = ['MERDN_API_IMAGE', 'MERDN_WEB_IMAGE', 'MERDN_OIDC_IMAGE'];

export function validateStagingEnvironment(env, { allowPlaceholders = false } = {}) {
  const errors = [];
  for (const key of REQUIRED) {
    const value = env[key]?.trim();
    if (!value) errors.push(`${key} is required`);
    else if (!allowPlaceholders && PLACEHOLDER.test(value)) errors.push(`${key} contains a placeholder`);
  }
  if (env.MERDN_RUNTIME_ROLE !== 'enforce') errors.push('MERDN_RUNTIME_ROLE must be enforce');
  if (env.DATABASE_URL && env.DATABASE_URL === env.RUNTIME_DATABASE_URL) {
    errors.push('migration and runtime database credentials must differ');
  }
  for (const key of PINNED_IMAGE_KEYS) {
    if (env[key] && !env[key].includes('@sha256:')) errors.push(`${key} must use an immutable digest`);
  }
  // El borde TLS no puede caer al fallback `off` de Caddy: sin contacto ACME
  // valido no hay emision de certificado y staging no debe declararse listo.
  const tlsContact = env.MERDN_TLS_CONTACT_EMAIL?.trim();
  if (tlsContact && (tlsContact === 'off' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(tlsContact))) {
    errors.push('MERDN_TLS_CONTACT_EMAIL must be a real contact address, never "off"');
  }
  // Identidad aislada de Keycloak: nombre y rol seguros, nunca reutilizados.
  for (const key of ['MERDN_OIDC_DATABASE_NAME', 'MERDN_OIDC_DATABASE_USER']) {
    const value = env[key]?.trim();
    if (value && !SAFE_IDENTIFIER.test(value)) errors.push(`${key} is not a safe SQL identifier`);
  }
  const oidcRole = env.MERDN_OIDC_DATABASE_USER?.trim();
  if (oidcRole && RESERVED_DATABASE_ROLES.includes(oidcRole)) {
    errors.push('MERDN_OIDC_DATABASE_USER must not reuse a reserved application role');
  }
  if (oidcRole && oidcRole === env.POSTGRES_USER?.trim()) {
    errors.push('MERDN_OIDC_DATABASE_USER must not reuse the migrator role');
  }
  const oidcDatabase = env.MERDN_OIDC_DATABASE_NAME?.trim();
  if (oidcDatabase && oidcDatabase === env.POSTGRES_DB?.trim()) {
    errors.push('MERDN_OIDC_DATABASE_NAME must not reuse the application database');
  }
  // La contrasena nunca se incluye en el mensaje de error, solo el nombre clave.
  const oidcPassword = env.MERDN_OIDC_DATABASE_PASSWORD?.trim();
  if (oidcPassword && oidcPassword.length < 12) {
    errors.push('MERDN_OIDC_DATABASE_PASSWORD is too short for staging');
  }
  // Tenant activo: el marcador del template ya lo captura la comprobacion de
  // placeholders; aqui se rechaza ademas cualquier valor sin forma de UUID. El
  // identificador nunca se incluye en el mensaje, solo el nombre de la clave.
  const tenantId = env.MERDN_ACTIVE_TENANT_ID?.trim();
  if (tenantId && !PLACEHOLDER.test(tenantId) && !TENANT_UUID.test(tenantId)) {
    errors.push('MERDN_ACTIVE_TENANT_ID must be a canonical UUID');
  }
  return errors;
}

export function runPreflight(env = process.env, options) {
  const errors = validateStagingEnvironment(env, options);
  if (errors.length) throw new Error(`Staging preflight failed: ${errors.join('; ')}`);
  return 'Staging configuration shape: PASS';
}

// Guarda de modulo principal portable: `file://` + ruta Windows produce
// `file://C:/...` y nunca coincide con `import.meta.url` (`file:///C:/...`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // eslint-disable-next-line no-console -- CLI de verificacion: la salida es la evidencia exigida.
  try { console.log(runPreflight()); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
