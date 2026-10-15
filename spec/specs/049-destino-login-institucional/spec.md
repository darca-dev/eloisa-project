# 049 — Conservar destino del login institucional

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para corrección y aplicación local`.
- Fecha: 2026-10-14.
- Aprobado por: PO, conversación vigente.
- Evidencia: ../../bitacora/decisiones/2026-10-14-destino-login-institucional.md.

## Contrato

1. Objetivo: corregir que ingresar a Hospital reutilice SSO municipal y termine en Alcaldía, conservando el destino institucional elegido.
2. Contexto: 047 enviaba ambos botones al mismo retorno /acceso. PO confirma «Me devuelve al panel de Alcaldía» tras ingresar por Hospital. Las guardas sí deniegan Hospital a esa cuenta.
3. Usuarios: cuentas existentes y primer registro Hospital/Alcaldía. No crear otros administradores ni asignar roles.
4. Módulos: enlaces institucionales de hub/registro/acceso, allowlist de retorno OIDC y solicitud interactiva al proveedor. Interior048 y Hospital intactos.
5. Funcional: entrada Hospital retorna solo /hospital y entrada Alcaldía retorna solo /municipality. Cada inicio institucional pide credenciales al proveedor con prompt=login/max_age=0 existentes en adapter, evitando el salto silencioso SSO. Acceso personal mantiene /acceso y su conducta vigente.
6. Datos: dos nuevos valores literales de returnTarget, persistidos en intento protegido existente. Migración solo amplía CHECK a dos rutas internas, sin tablas/columnas nuevas ni alterar registros. No guardar intención en storage/cookies sin vínculo al intento.
7. Permisos: destino no es autorización. Gates/API vigentes verifican administrador de cada institución; cuenta municipal en Hospital queda denegada y no se redirige por selección de experiencias a otra institución.
8. Auditoría: eventos actuales de intento/callback/sesión, con PKCE/state/nonce y consumo atómico. No emitir credenciales ni nuevos datos nominales.
9. Seguridad: allowlist exacta /,/acceso,/hospital,/municipality en código y SQL, sin query libre/URLs externas/wildcards. Forzar formulario en login ordinario no acredita step-up: campos de vínculo/freshAuthenticationRequestedAt permanecen solo en reautenticación protegida. Cookies/issuer/cliente/redirect_uri del proveedor intactos.
10. Decisión: reutilizar intento y adapter existentes. Alternativas: selector común pierde destino; storage de intención no vinculada añade ambigüedad; separar realms/cookies duplicaría arquitectura. Recomendación: dos destinos cerrados, mismo control servidor, petición interactiva. Corrección del comportamiento solicitado, sin nuevo método/grant/permiso.
11. Permitidos: human-auth.contract.ts y human-auth.service.ts de API; migración20261014190000_institutional_login_return_targets/migration.sql; pruebas API personal-registration.db.test.ts e identity-relationships-db.test.ts si tienen expectativas del CHECK; institutionalAdministratorClient.ts/test, InstitutionalAccess.tsx, InstitutionalRegistration.tsx, HubAccessPortal.tsx y caso CentralAccess.test.ts; inventario REQUIRED_MIGRATIONS de scripts/testing/test-db-provision.mjs y expectativa de cantidad en tests/testing/baseline-catalog.test.mjs; tema Eloisa login/template.ftl copiado del parent26.7.1 con única corrección aria-label del usuario readonly, su licencia/procedencia fuera de carpeta de tema y allowlist del instalador043 para ese archivo; docs/ACCESO-ELOISA.md y artefactos049/INDEX/consentimiento.
12. Prohibidos: paneles/interiores048/Hospital, roles/capacidades/cuentas/datos clínicos, políticas RLS, cambio de issuer/client/grants del proveedor, schema de negocio, dependencias, prototipo/históricos y Git protegido. Conservar048.
13. Operación: construir API/web desde esta copia, respaldo privado de PostgreSQL y configuración/imagen previas verificados; aplicar migración transaccional con owner actual y API detenida brevemente; conservar env/red/puertos/extra_hosts/usuarios/volúmenes/IDs PostgreSQL/IdP.
14. Aceptación: sesión municipal→hub→Hospital muestra formulario en lugar de volver a Alcaldía; autenticarse con cuenta municipal retorna Hospital y no abre su panel; Alcaldía vuelve a Municipality; no clic redundante desde hub; login personal conserva selector. Destinos hostiles terminan en fallback /.
15. Pruebas: helper web y enlaces SSR por destino; pruebas de intento/callback con PostgreSQL aislado para dos destinos, prompt y sin step-up; allowlist hostil y guardas existentes. E2E real mismo contexto SSO municipal→Hospital, denegación real, regreso Alcaldía/logout; sin nuevos usuarios. Build/tipos/lint/scanner/migraciones y pruebas apropiadas, sin ampliar batería de CSS.
16. Aprobado: PO reporta cruce de login y confirma que vuelve a Alcaldía; implementación correctiva dentro de acceso real ya autorizado. Dos rutas protegidas internas no conceden nuevas capacidades. Operación local con backups, no publicación Git.
17. Fuera: sesiones simultáneas por institución, nuevos realms, seleccionar roles en cliente, autoasignar Hospital a administrador municipal o cambiar recuperación administrada.
18. Rollback: restaurar imágenes/config API/web anteriores; migración aditiva compatible se conserva. API anterior rechaza intentos pendientes con destinos nuevos y falla cerrado; no reescribir/borrar intentos ni cuentas para bajar CHECK. Si migración falla, transacción aborta y se reinicia API anterior. Evidencias sanitizadas y revisión focal de seguridad/aislamiento.
