# Plan 049

## Hitos

1. Confirmar síntoma/circuito, registrar corrección, respaldo de fuentes y gate.
2. Helper institucional por destino, allowlist exacta persistida y petición interactiva, sin cambiar step-up ni permisos.
3. Pruebas de migración e intentos/callback sobre PostgreSQL aislado, web/API focales, build/lint/scanner.
4. Backup privado verificado, migración y reemplazo API/web con configuración conservada; E2E SSO cruzado y documentación.

## Dependencias

Intentos existentes, adapter que soporta prompt/login, guards actuales, PostgreSQL de pruebas aislado, cuenta municipal existente y Docker local.

## Riesgos

Redirección abierta, confundir solicitud interactiva con step-up, perder datos/config al aplicar o autenticar Hospital con cuenta municipal. Mitigar con allowlists literales en SQL/código, vínculo privilegiado sin cambios, backups y comparación de cuentas/claims/configuración, denegación real E2E.
