# S00-MP04A — resultado verificado sin infraestructura

Updated-At: 2026-10-08
Current-Branch: feat/termino-00-mp04-baseline-real
Required-Base: 581eb65
Related-Spec: 039-termino-s00-base-y-baseline
Status: VERIFIED-TECHNICAL

Solo scripts/testing/run-baseline.mjs (añadir --allowImportingTsExtensions a argv API de typecheck ya --noEmit) y tests/testing/run-baseline.test.mts (mantener aserciones e incluir regresión de opción API única). El comando coincide con el script ya aprobado de @merdn/api. Sin cambio de compilación emitida, imports de producto, matriz, catálogo, entorno hijo, roles, timeouts o cleanup.

Antes: comando real del runner API EXIT 1, nueve TS5097 en herramientas .ts importadas por human-auth.api.test.ts. Después: ejecutar realmente los tres comandos de STAGE_MATRIX typecheck sale 0/0/0. Contratos node:test runner/lifecycle/guard: 72/72 sin skips/todo. Lint completo correcto. Gate previo EXIT 0 (19 warnings heredados); strict previo EXIT 0/0 warnings. Scanner final EXIT 0 (53 excepciones/54 ocurrencias, lockfile 1/1 y plantillas 3/3 inspeccionados); diff-check correcto.

No Docker up/down, SQL, migración, cuenta o secreto nuevo. Inventario de MP04B es estático: 27 modelos frente a catálogo 26 tablas/27 policies, 17 migraciones correctas y única omisión access_request. Propuesta concreta MP04B separada para decisión PO; no se implementó ni ejecutó su operación. Los contenedores compartidos ya estaban detenidos al inspeccionarlos; Codex no los detuvo.

MP04A verificado técnicamente, sin aceptar S00 ni completar DB/OIDC. Guardado local y rama siguiente MP04B autorizados por la orden de continuidad. Sin push/merge/main/despliegue.
