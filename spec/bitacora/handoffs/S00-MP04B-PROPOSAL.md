# S00-MP04B — catálogo completo y baseline DB local aislada

Updated-At: 2026-10-08
Current-Branch: feat/termino-00-mp04-baseline-real
Related-Spec: 039-termino-s00-base-y-baseline
Implementation-Agent: Codex
Status: PROPOSED — decisión PO pendiente

## Problema y evidencia

Inventario estático de HEAD 581eb65: 27 modelos/tablas Prisma, 17 migraciones que coinciden con REQUIRED_MIGRATIONS; catálogo de provision/preflight solo 26 tablas/27 policies. Única tabla ausente: access_request. Su migración aprobada por 038 habilita ENABLE/FORCE RLS, policy access_request_tenant y SELECT/INSERT/UPDATE (sin DELETE) para runtime. La baseline actual solo inspecciona las 26 tablas y transfiere ownership de ese subconjunto; un resultado verde no verifica owner/policy de access_request. No se ejecutó una DB para inferir este hallazgo.

025 congela catálogo/owner en 26 tablas; 038 incorpora la tabla adicional. 039 no puede resolver en silencio la contradicción. AGENTS.md §6: «Wait for user approval when the decision materially affects the architecture or product behavior.» §22.2 declara contradicciones entre autoridades una STOP CONDITION. Se solicita decisión únicamente para completar catálogo/ownership de prueba y operación local aislada; la implementación Codex y el Git local ya fueron autorizados.

## Recomendación y alternativa

Recomendación: catálogo efectivo completo de 27 tablas/28 policies (las existentes + access_request/access_request_tenant), 17 migraciones exactas. Transferir también access_request al owner de prueba merdn_test_migrator NOLOGIN/NOSUPERUSER/NOBYPASSRLS; runtime mantiene mínimos sin ownership ni CREATE. Cambia solo el cluster desechable, sin nueva migración ni cambio de policy/grant de aplicación. Mantener historia 025/038 intacta y registrar aquí la decisión de sustitución del catálogo efectivo.

Alternativa: mantener las 26 tablas congeladas y agregar un segundo preflight de access_request con owner propio. Aumenta contratos duplicados y riesgo de probar subconjuntos como aceptación global. No se recomienda excluir la tabla para obtener verde.

## Allowlist técnica propuesta

- scripts/testing/test-db-provision.mjs: catálogo 27/28 y mensajes derivados; algoritmos de guard/provision/cleanup sin relajación.
- scripts/testing/test-db-preflight.mjs: par exacto adicional, mensajes y evaluación de owner/RLS/FORCE; no reemplazar comportamiento negativo existente.
- tests/testing/test-db-lifecycle.test.mts: actualizar conteos y negativas específicas de tabla/policy/owner faltantes.
- tests/testing/baseline-catalog.test.mjs: comparar tablas/migraciones/policies con fuentes versionadas, evitando catálogos autoconsistentes pero incompletos.
- Documentación canónica 039/índice/decisión/handoffs/runbook. No editar 025/038, migrations, prototype, tasks/reviews, main, .env existente, Dockerfiles, compose compartido o aplicación de negocio.

Si otra falla aparece, guardar evidencia sanitizada y detener solo su paso; no cambiar archivos fuera del contrato ni relajar RLS, permisos o asserts para avanzar.

## Contrato operativo local propuesto

Topología existente compose.test.yml: proyecto merdn-baseline-test; servicio postgres-test; postgres:17.6-alpine; DB merdn_test; publicación exclusiva 127.0.0.1:55432; red merdn-baseline-test-net; volumen merdn-baseline-test-pgdata. Labels obligatorios com.merdn.project=merdn-baseline-test, scope=test, disposable=true. Sin API/web/IdP en este compose. Verificar nombres/labels/driver/publicación antes de mutar recursos. Última inspección: cero recursos de esta familia, puerto 55432 libre e imagen disponible. Los cuatro contenedores de aplicación están detenidos por estado externo; Codex no los detuvo y no los reiniciará para esta baseline.

Env-file nuevo relativo .secrets/baseline-mp04.local.env (ignorado por Git, permisos Windows solo usuario actual); passwords aleatorias distintas de 32 bytes, nunca stdout/argv/código/Git. DATABASE_URL administrativa exclusiva para migrate/fixtures; runtime URL separada y enforce para aplicación. No cargar ni sobrescribir .env del proyecto ni reutilizar cuentas/DB actuales. Confirmar ignorado y guard antes de Docker. No IdP/cuentas humanas en este paquete.

RunId s00-mp04b-20261008-<sufijo aleatorio corto>, válido para guard, misma huella Git de código verificado en todas las etapas. Registrar hash de compose/imagen PostgreSQL y commit; una imagen API/web anterior no sirve como prueba del código actual. Ejecutar provision/preflight, tipos/API sin DB/web/OpenAPI y 23 suites DB de la matriz cerrada, una a la vez bajo runtime enforce. Cada etapa con timeout finito y límite de 15 minutos por paquete; DB ausente/skip/todo/disabled/falso resumen es fallo, nunca éxito. Los contratos con mocks no sustituyen esas pruebas.

Cleanup mediante script aprobado project-scoped, verificando identidad/labels de cada recurso; solo container/red/volumen desechables creados por esta ejecución. Sin prune, reset de DB compartida o borrar datos ajenos. Guardar recursos observados antes y después. Ante fallo, cleanup seguro de esa familia, evidencia minimizada y un intento; nunca adoptar recursos ambiguos. Preservar el env-file privado local hasta revisión, sin entregarlo como cuenta de acceso humana.

## Aceptación y límites

Contratos puros y regresiones fallan ante falta/mutación de access_request/policy/owner, runtime inseguro o catálogo distinto. Baseline real 27 tablas/28 policies/17 migraciones, owners/flags/grants correctos y sondas sin contexto/cross-tenant pasan; 23 DB suites ejecutadas sin omisiones y cleanup confirmado. Conteos por stage, runId, commit e imagen exactos; cero valores sensibles en logs. Nuevas fallas se reportan, no se presentan como cerradas.

Este paquete no valida OIDC/E2E de portales ni aprovisiona las 32 cuentas. D-02 (actor institucional/legado), D-03 (TTL/MFA/recuperación) y D-04 completo de fixtures S01 siguen pendientes. No producción, push, merge, main o despliegue.
