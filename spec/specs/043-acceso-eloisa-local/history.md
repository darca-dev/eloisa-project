# Historial 043

| Fecha | Tipo | Cambio | Responsable |
|---|---|---|---|
| 2026-10-12 | Solicitud | PO rechaza pantalla genérica del login municipal. Tema Eloisa existente no aplicado al Keycloak activo. Se acota corrección visual/local conservando cuenta y autenticación. | PO / Codex |
| 2026-10-14 | Aplicación | Tema Eloisa/es instalado y seleccionado en mismo IdP; corregida hoja base a css/styles.css. Backup privado, hashes de seguridad/clientes/perfil/usuarios intactos. | Codex |
| 2026-10-14 | Revisión | Corregido rollback con valores explícitos y GET, conservación de mutex si incierto y restauración de archivos aunque falle instalación; tres casos Node correctos y revisión independiente sin bloqueantes remanentes. | Codex / review_access |
| 2026-10-14 | Verificación | E2E real conjunto 043/044 correcto con cuenta original: credenciales erróneas, login/panel/logout, recursos200, axe0/teclado/320px; sin disparar cambio de contraseña ni crear cuentas. | Codex |
