# S00 — base de trabajo y baseline observada

Fecha: 8 de octubre de 2026. Estado: EN AUDITORÍA; baseline NO aceptada. Spec propuesta: [039](../../spec/specs/039-termino-s00-base-y-baseline/spec.md). Plan general: [PLAN-TERMINO-FUNCIONAL.md](../PLAN-TERMINO-FUNCIONAL.md).

## Base y traslado

Proyecto activo: C:\Users\10plu\Eloisa-develop\eloisa_project. Rama: feat/termino-00-base-y-baseline. Base local/HEAD sin commit nuevo: 9980582bc40f41c80b90078f0c24374cbad9df9e. main conserva 1aa1201b8aa4483ecac6ffc59e15cb16cd79270b. origin: https://github.com/arvtechv/eloisa_project.git; fetch no accesible con credenciales actuales (Repository not found). No se cambió remoto ni se afirma que la referencia local sea la última remota.

Se copió desde OneDrive con robocopy /E /COPY:DT /DCOPY:DT /R:1 /W:1 /XJ, sin mover/borrar/mirror. 1125 archivos, 43.80 MB, 0 errores; exit 1 de robocopy significa archivos copiados. Se omitieron dependencias/builds/caches/datos regenerables y se reinstalaron dependencias, evitando enlaces de workspaces hacia OneDrive. Se preservó la carpeta original como respaldo. Atributos ReadOnly de HEAD/reflog en OneDrive habían impedido completar el switch; se corrigieron solo esos atributos allí, conservando main, y la copia nueva usa archivos normales.

Los cinco documentos de auditoría/plan/catálogo provienen del commit documental ebcfdfe del repositorio original. No se importa su código ni su historia. ENTREGA.md permanece sin cambios como diagnóstico histórico; este registro aporta evidencia nueva.

## Entorno

Node v24.19.0. Instalación de dependencias con npm ci --ignore-scripts --no-audit --no-fund. Sin actualizaciones de lockfile ni instalación de hooks. Prisma generate ejecutado explícitamente después de revisar config.

Docker Desktop disponible en C:\Users\10plu\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe. Cliente/servidor 29.7.2. Se observaron API/web/Keycloak/PostgreSQL activos en loopback 3001/3000/8081/5432. No se inspeccionaron sus secretos ni se migraron, reiniciaron o limpiaron. Sus imágenes no se presentan como evidencia del HEAD actual.

## Resultados observados

| Check | Resultado | Límite |
|---|---|---|
| Prisma generate / validate | EXIT 0 | No migración ni conexión DB; DSN ficticio en puerto 1 para validación/generación |
| build:shared / typecheck | EXIT 0 | Los tres workspaces compilan tipos |
| build:api | EXIT 0 | No inicia el servicio |
| build:web | EXIT 0 | Next 16.3.1 compila; no despliega ni prueba login |
| Web Vitest | EXIT 1; 1882 correctos / 3 fallos / 1885 casos; 67 archivos correctos / 2 fallidos | Suite completa actual; no baseline verde |
| API contratos seleccionados | 31 archivos: 592 correctos; 3 archivos adicionales: 64 correctos; 656 correctos en conjunto | Mocks/contratos sin DB real; no suite API completa ni seguridad integrada |
| Baseline scripts, node:test | EXIT 0; 72 correctos / 0 fallos / 0 skips | Guard/lifecycle/runner probados con dobles; no se provisionó DB |
| eslint . | EXIT 1; 17 errores / 0 warnings | Los seis archivos afectados están versionados; no excluirlos |
| secrets:scan | EXIT 1; 52 coincidencias | Coincidencia no demuestra secreto real; clasificación individual pendiente |
| DB runtime/RLS/owners/grants | NO EJECUTADO | Falta paquete operativo reconciliado de baseline aislada; no usar DB activa |
| OIDC integrado / E2E real | NO EJECUTADO | No se han creado cuentas nuevas ni validado dataset |

Los resultados de SDD tras importar documentos se registran en history.md; se reporta el gate de framework separado de la aprobación de 039. No se ha ejecutado confirm-user-consent.sh.

## Comandos reproducibles de checks ejecutados

Desde la raíz nueva, usando Node/npm instalados y sin variables reales de la aplicación:

~~~powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' ci --ignore-scripts --no-audit --no-fund
# Solo para generate/validate: DSN ficticio inutilizable, no es una cuenta.
$env:DATABASE_URL='postgresql://s00_generate_only@127.0.0.1:1/s00_generate_only'
node node_modules/prisma/build/index.js generate
node node_modules/prisma/build/index.js validate
npm run build:shared
npm run typecheck
npm run build:api
npm run build:web
node node_modules/eslint/bin/eslint.js .
node tests/secrets-scan.check.mjs
node --test tests/testing/run-baseline.test.mts tests/testing/test-db-lifecycle.test.mts tests/testing/test-environment-guard.test.mts
~~~

Web: desde apps/web, node ../../node_modules/vitest/vitest.mjs run. API: desde apps/api, node ../../node_modules/vitest/vitest.mjs run src test/access-provisioning.test.ts test/access-request-review.test.ts test/access-requests.test.ts, más health.api.test.ts, application-composition.test.ts y openapi.test.ts. Esos tres archivos se repitieron únicamente porque el primer entorno de comando tenía admin/runtime idénticos: fue rechazado correctamente. Configuración final de contrato: DSN ficticios diferentes para admin/runtime, host 127.0.0.1 puerto 1, MERDN_ENVIRONMENT=test y MERDN_RUNTIME_ROLE=disabled. No cambiar con esos valores los servicios de aplicación ni ejecutar suites DB. Role disabled aquí no satisface aceptación runtime enforce.

Un primer comando web resolvió dos veces apps/web por combinar --root y --config relativos; se corrigió ejecutando desde apps/web. Un primer intento de tests/testing con Vitest fue incorrecto porque los archivos usan node:test; se repitieron con Node nativo. Ninguno de esos errores de comando se registra como regresión del producto.

## Fallos concretos y siguiente acción

| ID | Evidencia | Acción propuesta |
|---|---|---|
| H-S00-01 | 17 errores en dos .tmp CJS, job expiración, test relaciones y dos E2E | MP01: imports/tipos/variables/reportes; conservar DI/tokens y semántica; no borrar archivos |
| H-S00-02 | branding.test.tsx:125 espera Isa en portada sin esa asistente | MP02: reconciliar cobertura con la portada aprobada, sin añadir UI artificial |
| H-S00-03 | branding.test.tsx:253 detecta literal en HubAccessPortal | MP02: derivar nombre desde configuración y verificar sustitución |
| H-S00-04 | municipalityPrivacidad.test.tsx:378 detecta sesionInicial en ruta | MP02: retirar atajo municipal conforme al objetivo sin demo; conservar puerta real |
| H-S00-05 | Scanner 52 coincidencias; una variable-nombre es falso positivo confirmado | MP03: clasificar cada punto; no eximir carpetas completas ni declarar fuga sin evidencia |
| H-S00-06 | Baseline DB/imagen exacta aún sin ejecutar aquí | MP04: alcance y topología exacta antes de probar; no trasladar un reporte verde antiguo |

No se retira auditoría, RLS, consentimiento, roles ni capacidad estratégica para hacer pasar checks. Los fallos de acceso legados, patient directo sin aprobación, expiración sin evento y configuración Docker del informe histórico deben volver a verificarse en sus paquetes; no se dan por corregidos por compilar.

## Cuentas de prueba y aprobación

El catálogo contiene 32 escenarios sin credenciales. Estado: NOT_PROVISIONED. La creación de cuentas reales en IdP, vínculo issuer+sub, dos tenants ficticios y entrega de contraseñas protegidas corresponde a S01 tras definir D-02/D-03/D-04. No hay cuentas nuevas para entregar ahora.

La autorización actual permitió empezar S00, elegir base, rama y traslado. El Product Owner aprobó S00-MP01 de 039 exclusivamente para Claude Code. Los demás paquetes siguen pendientes. Codex es arquitecto/auditor según AGENTS; producción corresponde a Claude Code salvo autorización explícita del PO a Codex para un paquete definido. El handoff S00 separado permite revisar un resultado concreto; el READY antiguo de otra rama no autoriza este trabajo.

## Estado final de aprobación y compuerta

El PO aprobó S00-MP01 para Claude Code. Después de registrar esa aprobación: strict EXIT 0, 0 errores/0 advertencias; gate EXIT 1, 1 error/19 advertencias. El único error es consentimiento no registrado para 039. Es un bloqueo correcto de ejecución, distinto de los defectos de aplicación. No se ejecutó el script de consentimiento por el agente ni comenzó implementación.

El handoff S00-2026-10-08.md contiene allowlist exacta y hard stop. Claude Code no se encontró en PATH ni en las dos ubicaciones habituales de CLI verificadas; no se instaló ni se sustituyó por otro agente. Puede usarse el handoff en la sesión de Claude Code del Product Owner una vez registrado consentimiento.
## Actualización — consentimiento confirmado y ejecución habilitada

2026-10-08: registro personal del PO verificado para 039, alcance exclusivo S00-MP01 / Claude Code. Gate EXIT 0 (0 errores/19 advertencias heredadas), strict EXIT 0 (0 errores/0 advertencias). El handoff S00-2026-10-08.md está READY para ese paquete. Sustituye el bloqueo de consentimiento registrado anteriormente; no acepta S00 ni autoriza los demás paquetes. No se inició implementación desde Codex; Claude CLI sigue sin localizarse aquí.
## Actualización — S00-MP01 implementado por Codex

El PO retiró a Claude y autorizó explícitamente a Codex para el mismo paquete y consentimiento. MP01 corrige los 17 errores: lint 0, tipos de los tres workspaces y build API correctos, 65 contratos API correctos, 10 E2E colectados sin ejecución. Siete archivos de código permitidos; lógica del job comparada sin cambios. Scanner aún 52 coincidencias y tres fallos web heredados corresponden a los próximos paquetes. Informe: spec/bitacora/handoffs/S00-MP01-FROM-CODEX.md. Aceptación PO pendiente; S00 completo aún sin terminar. No se inició MP02 ni se crearon cuentas/commits.
## Actualización — MP02 y guardado local

MP01 aceptado y guardado localmente en 8bbdd6e. MP02 verificado: 1888/1888 pruebas web, tipos/lint/build web correctos; marca configurable y ruta municipal siempre detrás de sesión. Informe S00-MP02-FROM-CODEX.md. El PO ordenó guardar todo localmente tras falla de escritura remota; no se reintentará publicación. Scanner 52 coincidencias pendiente MP03. S00 completo, DB/RLS/OIDC y cuentas aún pendientes.
