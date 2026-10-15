# Historial 049

| Fecha | Tipo | Cambio | Responsable |
|---|---|---|---|
| 2026-10-14 | Defecto | PO confirma que Hospital lo devuelve a Alcaldía después del login municipal. Diagnóstico: retorno común /acceso y SSO, no nuevo permiso Hospital. | PO / Codex |
| 2026-10-14 | Implementación | Dos destinos literales en helper/API/CHECK del intento; prompt=login/max_age=0 sin vínculo step-up. Se preservan permisos, IdP y panel048. | Codex |
| 2026-10-14 | Pruebas | PostgreSQL aislado final:22casos human-auth y26personal, sin fallos/omisiones;1850web, tipos/build/lint/scanner. Corregida aserción previa de recuperación que elegía una solicitud sin ID concreto. Ejecuciones intermedias fallida/omitida fueron rechazadas, sin despliegue. | Codex |
| 2026-10-14 | Operación | Backup privado restaurado y verificado por conteos/checksums de todas las tablas;24migraciones, datos idénticos durante migración. API/web reemplazadas conservando configuración y IDsPG/IdP. | Codex |
| 2026-10-14 | Verificación real | Misma cuenta/contexto:Municipality→Hospital solicita credenciales, callback conservaHospital y deniega panel a cuenta municipal; vueltaMunicipality/logoutcorrectos. Axe detectó label ausente del parent26.7.1 en reautenticación; templatecopiado con único aria-label y licencia/procedencia, installer verificausuarios/configiguales, E2E finalaxe0. | Codex |
