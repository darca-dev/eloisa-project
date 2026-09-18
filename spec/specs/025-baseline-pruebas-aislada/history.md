# History 025 — FORCE RLS y baseline de pruebas aislada
## 2026-08-30 — v0.3 APPROVED / CONSENT RECORDED

- Registrado el consentimiento explícito por-spec para los 42 micro-paquetes secuenciales.
- Abierta únicamente la compuerta particular de Spec 025.
- Preparado MP01; MP02–MP42 permanecen cerrados.
- Persisten hard stop máximo de 15 minutos, FORCE forward-only para 15 tablas, historia inmutable y prohibición de demo/staging/producción/main.
- No se implementó MP01 ni se modificó producto, migración o configuración.

## 2026-08-30 — v0.2 READY FOR IMPLEMENTATION CONSENT

### Changed

- Incorporada la decisión de remediar FORCE RLS dentro de Spec 025.
- Corregido el inventario: 26 tablas con RLS, 11 ya con FORCE y 15 pendientes; 27 políticas esperadas.
- Definida una migración nueva, hacia adelante, sin editar migraciones históricas.
- Documentados roles, ownership, preflight, postflight, locks y remediación forward-only.
- Rediseñada la ejecución en 42 micro-paquetes, todos con hard stop de 15 minutos.
- Conservadas la DB test desechable, la matriz 22+1 y los dos stale fixes aprobados.
- Registradas revisiones independientes de arquitectura, seguridad, testing y timeboxing.

### Impact

Solo documentación. No se implementó código, migración, configuración, DB, runtime ni dependencia. La especificación queda lista para solicitar consentimiento de implementación; dicho consentimiento aún no está registrado.

## 2026-08-30 — v0.1 BLOCKED DRAFT

- Creada la arquitectura inicial de baseline aislada.
- El borrador quedó bloqueado por un inventario FORCE incorrecto y por el límite anterior de tres paquetes.
- La Product Owner resolvió ambos bloqueos en `SPEC-025-RLS-REVISION`.
