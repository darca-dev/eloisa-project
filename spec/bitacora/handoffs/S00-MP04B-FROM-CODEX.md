# S00-MP04B — catálogo completo verificado; baseline incompleta

Updated-At: 2026-10-09
Current-Branch: feat/termino-00-mp04b-db-aislada
Required-Base: 720d07b
Related-Spec: 039-termino-s00-base-y-baseline
Status: CATALOG-VERIFIED / BASELINE-FAILED

## Cambio y revisión

Decisión PO de 2026-10-09 aplicada: access_request/access_request_tenant integra el catálogo efectivo de 27 tablas/28 policies y ownership del owner NOLOGIN no privilegiado del cluster desechable. Solo cuatro archivos técnicos del handoff: provisionador, preflight, lifecycle tests y nuevo baseline-catalog.test.mjs. Sin modificación de migraciones, grants, policies SQL, código API/web, IdP o prototipo. Las comprobaciones mantienen catálogos exactos y denegación ante tabla/policy/owner/RLS/FORCE incorrectos.

Pruebas independientes comparan el catálogo con Prisma y las 17 migraciones versionadas, incluidos nombres de policies y grants existentes sin DELETE de access_request. Diff técnico auditado contra allowlist. No se amplió el runner para esconder el fallo posterior.

## Validación

- Gate previo: EXIT 0, 0 errores y 19 advertencias heredadas. Strict previo y de cierre: EXIT 0, 0 errores/0 advertencias. Consent log intacto.
- `node --test tests/testing/baseline-catalog.test.mjs tests/testing/test-db-lifecycle.test.mts tests/testing/test-environment-guard.test.mts tests/testing/run-baseline.test.mts`: 82/82, sin skips/todo.
- Scanner adversarial: 16/16. Lint completo y secrets:scan EXIT 0; 53 excepciones específicas/54 ocurrencias clasificadas, lockfile 1/1 y plantillas 3/3.
- Tres comandos reales de typecheck del runner: correctos durante la operación. No se repitieron builds ni suite web por este cambio de tooling.

## Operación real y linaje

Un intento: runId `s00-mp04b-20261009-8aec95bd`, 2026-10-09T15:58:57.363Z a 16:00:21.509Z. HEAD previo 720d07b222dcf2a0f07413949dfe3c4fa4f25b80 más diff autorizado. Huella de 1124 archivos versionables antes/después idéntica: 13e643f8fd566862388af60ddc3f7831e9e17719c3b551090c3ad0a2717d5be9. Esta huella corresponde al árbol probado antes de redactar este cierre, no al commit posterior de documentación.

compose.test.yml SHA-256: 50f564e7a359e8f77a9c9732f0f7c671fa29407c83c2ffa044273264a4396964. PostgreSQL: postgres:17.6-alpine, digest postgres@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94. Docker 29.7.2.

Provision PASS: 17 migraciones aplicadas, 27 tablas protegidas, 28 policies, owner de pruebas sobre las 27, runtime no owner, roles no privilegiados. Preflight real PASS: RLS/FORCE en todo el catálogo, runtime sin CREATE, tenant ficticio único antes/después; denegación sin contexto, aislamiento de tenant A, INSERT cruzado denegado, UPDATE cruzado sin filas, migrador sujeto a FORCE. Son sondas reales del preflight; no equivalen a ejecutar las 23 etapas DB posteriores.

Env-file nuevo ignorado por Git y privado por ACL, con claves aleatorias distintas. Conservado fuera de evidencia para revisión local. Sin credenciales, URLs autenticadas, filas ni UUIDs en este informe o JSON. Se inició Docker Desktop oculto porque el daemon estaba apagado. Los cuatro contenedores compartidos permanecieron detenidos; no se arrancaron/reiniciaron.

## Fallo y límite de aceptación

Después de provision/preflight/typecheck, api-no-db-health detuvo la baseline. El runner clasificó `skipped`, pero su parser registró conteos 0/0/0 no concluyentes; no significa que no se ejecutaran tests. Diagnóstico posterior sin DB ni nueva provisión: dos archivos fallidos, 1 prueba fallida/1 correcta/8 omitidas, error EnvironmentValidationError por ausencia de MERDN_ACTIVE_TENANT_ID en modo enforce. No timeout.

El entorno hijo cerrado del runner solo entrega tres claves de pruebas; la configuración API de spec 024 exige además el tenant ID confiable. No se debe heredar del padre, fijar un UUID, desactivar enforce ni aceptar skips. Corrección fuera de allowlist: propuesta MP04C separada, pendiente de decisión PO. No se ejecutaron web/OpenAPI ni las 23 etapas DB de la matriz después del fallo. Login OIDC/E2E, cuentas de S01, imagen API/web exacta y aceptación completa de S00 siguen pendientes.

Cleanup nativo PASS: cero contenedores/redes/volúmenes de baseline después, recursos compartidos sin cambios. Evidencia minimizada en S00-MP04B-EVIDENCE.json; diagnóstico en S00-MP04B-DIAGNOSIS.json. Git solo local conforme a la instrucción vigente; main intacto. Catálogo solicitado implementado y verificado; baseline completa NO verde.
