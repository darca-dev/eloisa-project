# S00-MP04B — contrato de ejecución autorizado

Updated-At: 2026-10-09
Current-Branch: feat/termino-00-mp04b-db-aislada
Required-Base: 720d07b
Related-Spec: 039-termino-s00-base-y-baseline
Implementation-Agent: Codex
Authorized-Package: S00-MP04B
Status: READY

Decisión vigente: 2026-10-09-s00-mp04b-catalogo-completo.md; el PO ordenó aplicar la recomendación 27 tablas/28 policies. S00-MP04B-PROPOSAL.md conserva origen, alternativas, archivos permitidos/prohibidos, permisos, datos, aceptación, operación y rollback. Este handoff activa ese contrato en la rama actual. Sin decisión adicional sobre producto/IdP ni consentimiento fabricado.

Allowlist técnica exacta: scripts/testing/test-db-provision.mjs, scripts/testing/test-db-preflight.mjs, tests/testing/test-db-lifecycle.test.mts, tests/testing/baseline-catalog.test.mjs. Añadir solo access_request/access_request_tenant y verificaciones/reporte de catálogo completo. No modificar SQL de migraciones ni conceder privilegios para pasar tests.

Operación: compose.test.yml existente; proyecto merdn-baseline-test, postgres-test, postgres:17.6-alpine, merdn_test, loopback 127.0.0.1:55432, red/volumen merdn-baseline-test-net/merdn-baseline-test-pgdata y tres labels del guard. Env-file nuevo privado .secrets/baseline-mp04.local.env, claves aleatorias diferentes; no tocar .env existente. RunId s00-mp04b-20261009-<sufijo>, mismos código/huella en cada stage. Primero comprobar ausencia de recursos/puerto, ignorado/ACL del env-file, guard, catálogo puro y gate/strict; después provision/preflight y matriz de 29 stages (23 DB), una etapa a la vez. Máximo 15 minutos por etapa, sin retry automático; STOP y cleanup exclusivo ante fallo. Scripts existentes sanitizan evidencia; nunca mostrar claves/DSN/cuerpos crudos. No reiniciar servicios compartidos.

Pruebas: comparación independiente esquema/migraciones/policies; negativas tabla/policy/owner/RLS/FORCE ausentes; contratos puros, tipos, lint/scanner; integración real sin skip/todo/disabled, runtime enforce y limpieza verificada de recursos propios. Registrar commit + diff/hash previo si aún sin commit y versión/digest de PostgreSQL, sin atribuir imagen API/web vieja al árbol actual. Un fallo fuera de allowlist se documenta y detiene su parte, sin corrección improvisada.

Guardar informe, tareas/historial y commit local según autorización de continuidad. No declarar S00/portales completos por checks de catálogo; S01/OIDC/E2E y decisiones materiales pendientes se reportan.
