/**
 * Preparación del entorno de las pruebas de la API (TASK-MVP-CORE-01 §12).
 *
 * Reglas:
 * - todos los valores son ficticios y locales; no hay credenciales reales;
 * - `DATABASE_URL` NO se inventa cuando ya existe: las pruebas de integración
 *   deben ejecutarse contra la PostgreSQL de pruebas que indique el entorno;
 * - la configuración de sesión usa una vigencia corta para poder comprobar la
 *   expiración sin esperas artificiales.
 */

/** Cadena de conexión de respaldo cuando el entorno no define ninguna. */
const FALLBACK_DATABASE_URL =
  'postgresql://merdn_dev:change-me-local-only@127.0.0.1:5432/merdn_dev?schema=public';

process.env['DATABASE_URL'] ??= FALLBACK_DATABASE_URL;
process.env['MERDN_ENVIRONMENT'] ??= 'test';

/*
 * Modo del rol runtime en pruebas.
 *
 * `enforce` exige una credencial de EJECUCIÓN separada. Si el entorno no la
 * aporta, la suite arranca en modo degradado explícito: así las pruebas de
 * contrato pueden correr sin inventar credenciales.
 *
 * Esto NO debilita la verificación del aislamiento: `runtime-fail-closed.db.test.ts`
 * y `core-01-hardening.db.test.ts` construyen su propio contexto en modo
 * `enforce` y comprueban RLS, fail-closed y mínimo privilegio contra PostgreSQL
 * real, con independencia de esta variable.
 */
/*
 * Desde la Spec 024, el modo `enforce` exige ADEMAS `MERDN_ACTIVE_TENANT_ID`: el
 * arranque en frio abre la transaccion de contexto con un identificador que ya
 * aporta la configuracion. Ese UUID lo genera la carga de datos de referencia y
 * es distinto en cada base, de modo que aqui NO puede inventarse: se toma solo
 * si el entorno lo aporta.
 *
 * Por eso la suite arranca en modo degradado explicito mientras falte cualquiera
 * de las dos piezas —credencial de ejecucion o identificador—, en lugar de
 * declarar `enforce` con una configuracion incompleta que fallaria cerrada.
 *
 * Esto NO debilita la verificacion del aislamiento: `tenant-bootstrap.db.test.ts`,
 * `cold-start-auth.api.test.ts`, `runtime-fail-closed.db.test.ts` y
 * `core-01-hardening.db.test.ts` construyen su propio contexto en modo `enforce`
 * —leyendo el identificador real con la credencial administrativa— y comprueban
 * RLS, fail-closed y minimo privilegio contra PostgreSQL real, con independencia
 * de esta variable.
 */
if (process.env['MERDN_RUNTIME_ROLE'] === undefined) {
  const puedeAplicarRolRuntime =
    process.env['RUNTIME_DATABASE_URL'] !== undefined &&
    process.env['MERDN_ACTIVE_TENANT_ID'] !== undefined;
  process.env['MERDN_RUNTIME_ROLE'] = puedeAplicarRolRuntime ? 'enforce' : 'disabled';
}
process.env['MERDN_ACTIVE_TENANT_CODE'] ??= 'merdn-mvp';
process.env['MERDN_CONSENT_VERSION'] ??= 'paciente-tratamiento-datos-v1';
// Límite alto en pruebas: el control de abuso tiene su propia prueba dedicada,
// que lo configura explícitamente.
process.env['ENROLLMENT_RATE_LIMIT_MAX'] ??= '1000';
