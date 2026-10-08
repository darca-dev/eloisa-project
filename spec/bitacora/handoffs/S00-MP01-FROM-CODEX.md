# S00-MP01 — resultado de implementación y revisión por Codex

Fecha: 2026-10-08. Task ID: TERMINO-S00 / SPEC-039 / S00-MP01.
Rama: feat/termino-00-base-y-baseline.
Base/HEAD: 9980582bc40f41c80b90078f0c24374cbad9df9e (sin commit nuevo).
Estado: IMPLEMENTADO Y VERIFICADO EN SU ALCANCE; pendiente de aceptación del Product Owner. S00 completo sigue sin aceptación.

## Autoridad

El PO autorizó explícitamente a Codex a sustituir a Claude y mantener su consentimiento SDD del mismo paquete. Evidencia: decisión 2026-10-08-s00-mp01-codex.md y registro personal de consentimiento 039, conservado intacto por el agente. Gate antes de producto: EXIT 0, 0 errores/19 advertencias heredadas; strict: EXIT 0, 0 errores/0 advertencias. No se extendió autorización a MP02/MP03/MP04.

## Resultado

Se corrigieron los 17 errores de lint sin desactivar reglas, añadir exclusiones ni eliminar herramientas versionadas. Se preservaron permisos, contratos, lógica de negocio y cuerpo del job de expiración. Los tokens NestJS de PrismaService/TenantContextService quedan explícitos y una prueba comprueba que el job ejecuta trabajo a través del tenant recibido.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| .tmp-inspect-keycloak.cjs | Import dinámico Playwright, DOM por globalThis.document y salida stdout/stderr compatible con lint |
| .tmp-verify-eloisa-login.cjs | Acceso al módulo fs builtin de Node 24, import dinámico Playwright, stdout/stderr; sin ejecutar login |
| apps/api/src/people-relationships/expire-relationships.job.ts | Import Inject y dos tokens @Inject explícitos; ningún cambio en métodos, cron, estados o consultas |
| apps/api/test/application-composition.test.ts | Prueba con providers mock que verifica inyección y ejecución por contexto tenant; composición existente conservada |
| apps/api/test/identity-relationships-db.test.ts | Cliente tipado por ReturnType y aviso stderr; assertions/fixtures/scope intactos |
| apps/web/e2e/accessibility.spec.ts | Eliminación de una variable local sin uso; sin cambios de assertions |
| apps/web/e2e/patient-persistent-account.spec.ts | Imports fs/path y parámetro context sin page unused; datos/aserciones/provisión sin cambios |

Tres archivos tenían atributo Windows ReadOnly y bloquearon la edición. Se retiró únicamente ese atributo en el job y los dos E2E autorizados; no se cambiaron ACL ni controles de autorización del producto. No se añadió dependencia, migración o configuración de infraestructura.

## Verificación ejecutada

| Comando | Resultado | Alcance |
|---|---|---|
| node node_modules/eslint/bin/eslint.js . | EXIT 0; 0 errores/advertencias | Monorepo completo, mismas reglas |
| npm run typecheck | EXIT 0 | Shared/API/web, incluyendo tests definidos por tsconfig |
| npm run build:api | EXIT 0 | API compilada; build shared incluido en typecheck |
| Desde apps/api: node ../../node_modules/vitest/vitest.mjs run test/application-composition.test.ts test/health.api.test.ts test/openapi.test.ts | EXIT 0; 65/65, 3 archivos, 0 omisiones | Contratos/mocks, sin DB real |
| node --check .tmp-inspect-keycloak.cjs y .tmp-verify-eloisa-login.cjs | EXIT 0 | Sintaxis, sin navegador ni lectura de credenciales |
| Desde apps/web: node ../../node_modules/@playwright/test/cli.js test --list accessibility.spec.ts patient-persistent-account.spec.ts | EXIT 0; 10 casos en 2 archivos | Solo colección; NO equivale a E2E ejecutado |
| node tests/secrets-scan.check.mjs | EXIT 1; 52 coincidencias | Hallazgos heredados pendientes MP03; no se declara limpio |
| Comparación UTF-8 del job restaurando solo imports/tokens contra HEAD | Coincidencia exacta | Confirma lógica y cuerpo sin cambios |
| git diff --check / revisión de diff y rutas | Correcto | Siete archivos de código, todos en allowlist |

API: entorno ficticio test, conexiones admin/runtime distintas hacia loopback puerto 1, runtime disabled únicamente en el proceso unitario. El fallo de disponibilidad DB en su setup es esperado; los 65 casos de contrato no requieren DB real. No se usaron los servicios activos ni se probaron RLS/FORCE/tenancy real con ese modo.

La nueva prueba de job pasó antes y después de los tokens explícitos: protege la DI al corregir lint; no se reporta un defecto de DI observado antes de la corrección. Las comprobaciones iniciales de comparación tuvieron problemas de encoding/argv de PowerShell; la comparación final con script y UTF-8 explícito pasó. No fueron defectos de lógica del producto.

Web build había pasado en la preparación; no se repitió porque no cambió código productivo web. La suite web previa conserva tres fallos abiertos para MP02. Baseline DB/RLS, E2E real, login OIDC integrado y provisión de cuentas no ejecutados en MP01. No hubo cambios de fuentes protegidas, schema/migraciones, lockfile o main; no commit/push/merge/despliegue.

## Criterios y revisión

Cumplidos para MP01: allowlist, lint limpio, tipos/build API, DI preservada y probada, sintaxis/colección de herramientas, ausencia de cambios de negocio y protección de archivos/historia. La revisión de Codex cotejó diff y resultados; no es revisión independiente por un segundo agente. El PO conserva aceptación final.

No cumplidos para S00 completo: web verde (MP02), scanner clasificado/remediado (MP03), baseline DB e imagen exacta (MP04). No se presentan como defectos corregidos por este paquete.

## Hallazgos residuales que requieren paquete específico

1. El helper E2E de existencia de SQL contiene `existsSync(scriptPath) || true`: siempre pasa, por lo que no aporta verificación real. Se conservó dentro del límite MP01 de imports/variables. Debe corregirse con criterio de aceptación en QA/S01; no usarlo como evidencia de funcionalidad.
2. identity-relationships-db.test.ts retorna temprano si falta DB, en vez de marcar los casos como skipped: puede producir PASS nominal sin ejecución de garantías. No se ejecutó ni se consideró verde integrado aquí. Debe reconciliarse con el runner fail-closed en MP04 antes de aceptar aislamiento.
3. Auditoría/versionado de expiración, accesos legados y paciente directo mantienen los hallazgos del plan; no se alteraron en la corrección de lint.

## Control de cierre

HARD STOP cumplido: no se inició MP02. Cambios locales disponibles para revisión/aceptación PO. El siguiente paquete propuesto es MP02 (tres regresiones web); necesita su autorización correspondiente. Ante rollback solicitado, revertir solo el diff de este paquete y conservar documentos/cambios ajenos, sin reset global.
## Aceptación posterior

MP01 aceptado explícitamente por el PO el 2026-10-08. Commit/push y continuación por nuevas ramas autorizados. Este estado posterior sustituye el pendiente de aceptación del encabezado; los límites de prueba y riesgos de S00 se conservan.
