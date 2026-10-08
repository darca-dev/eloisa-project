# S00-MP02 — resultado verificado

Updated-At: 2026-10-08
Current-Branch: feat/termino-00-mp02-web-real
Required-Base: 8bbdd6e128189928508147b9635cef21bb4fc3fb
Related-Spec: 039-termino-s00-base-y-baseline
Status: VERIFIED-TECHNICAL

Codex ejecutó el paquete autorizado por la orden de continuidad del PO. Git local por decisión posterior; sin publicación, merge, main o despliegue. No se declara aceptación completa de S00.

## Cambios y revisión

Cinco archivos en allowlist: HubAccessPortal deriva el título desde branding; branding.test verifica sustitución estructural en portal y asistente por separado; municipality/page elimina el contexto ficticio y siempre monta la puerta; municipalityPrivacidad prueba flag legacy true/false; municipality/page.test reconcilia el antiguo caso que exigía el bypass y restaura el entorno con vi. La extensión de este último archivo se documentó antes de editarlo, pues la suite completa reveló su expectativa incompatible con el comportamiento aprobado. No se añadió UI, rol, dependencia, persistencia o credencial.

Gate y strict ejecutados antes del código y de la extensión: EXIT 0; gate conserva 19 advertencias heredadas, strict 0 errores/0 advertencias. El agente no ejecutó confirm-user-consent.sh.

## Evidencia

- Unitarias focales branding/privacidad/sesión municipal: 77/77.
- Suite completa web tras reconciliar la prueba heredada: 69 archivos, 1888/1888, sin skips ni fallos.
- npm.cmd run typecheck: los tres workspaces correctos.
- npm.cmd run lint: 0 errores.
- npm.cmd run build:web: correcto, ruta municipal dinámica.
- Diff revisado: solo cinco archivos web y gobernanza permitida. Main y carpetas protegidas sin cambios.
- Scanner de repo: 52 coincidencias, valores no impresos; MP03 pendiente. Lockfile 1/1 y plantillas 3/3 inspeccionados.

PowerShell bloqueó npm.ps1 por política de ejecución; se usó npm.cmd sin alterar esa política. Primer pase completo: 1887 pasan/1 falla por caso demo heredado; se corrigió dentro del contrato ampliado y se repitió.

## Límites y continuación

SSR/unitarias comprueban la puerta y contratos con transporte simulado; no certifican OIDC, DB/RLS o E2E. Las vistas demostrativas restantes no se convierten en funciones reales mediante este cambio: se mantienen pendientes en el plan funcional. No se crearon cuentas, datos clínicos ni sesiones nuevas. MP03 clasifica coincidencias y preserva detección de secretos; MP04 define operación aislada antes de DB. Rollback puntual nunca debe reintroducir el bypass como mecanismo de acceso.
