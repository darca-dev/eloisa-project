# 043 — Acceso Eloisa local

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para corrección y aplicación local`.
- Aprobado por / Approved by: PO, conversación vigente 2026-10-12.
- Evidencia / Evidence: ../../bitacora/decisiones/2026-10-12-acceso-eloisa.md.

## Contrato

1. **Objetivo:** mostrar acceso Eloisa en español y poder entrar al municipio
   desde la cuenta existente, sin presentar al usuario el login genérico.
2. **Contexto:** tema existente no instalado ni seleccionado en Keycloak vivo.
   La API/web sí corresponden a Eloisa-develop. Alta real ya probada.
3. **Usuarios:** primer administrador Municipality y demás cuentas del realm
   local; los permisos y tenants continúan resueltos en servidor.
4. **Módulos:** presentación del proveedor local y operación de instalación.
   Sin cambios en dominios clínicos, finanzas, regulación o permisos.
5. **Funcional:** tema heredado keycloak.v2 con estilos base conservados,
   marca general Eloisa, Usuario/Contraseña/Entrar, errores en español, enlace
   de vuelta al portal, controles accesibles y 320px sin desbordamiento.
6. **Datos:** assets existentes, mensajes y cinco campos de presentación del
   realm. Credenciales solo desde contenedor local, backup privado ignorado.
   Cuenta ficticia solicitada por PO permanece; ningún dato personal en logs.
7. **Permisos:** operador local únicamente para seleccionar tema. Servidor
   conserva Authorization Code/PKCE S256, issuer, redirects exactos, sesiones,
   reserva única, guardas, capacidades y separación Hospital/Municipality.
8. **Auditoría:** backup privado del estado de presentación anterior y evidencia
   de operación/validación; conservar auditorías de login existentes.
9. **Seguridad:** daemon local fijado, labels/puerto/origen verificados, mutex
   de mantenimiento; no imprimir tokens/secrets/cookies ni guardar en Git.
10. **Referencia:** tema/imagenes Eloisa ya versionados y estilos de aplicación;
    prototipo solo referencia, no modificarlo ni copiar su runtime.
11. **Permitidos:** infra/local-oidc/themes/eloisa/, README de ese proveedor,
    displayName de infra/local-oidc/realm-merdn-local.json,
    scripts/identity/apply-local-login-theme.mjs, tests/identity/login-theme.test.mjs,
    docs/ACCESO-ELOISA.md,
    spec/specs/043-acceso-eloisa-local/, spec/specs/INDEX.md,
    spec/.sdd/user-consent.log y decisión 2026-10-12-acceso-eloisa.md.
12. **Prohibidos:** otros dominios/apps/API/schema/migrations, dependencias,
    prototype-claude/, tasks/, reviews/, main/develop, reset/reimport/recreate
    del IdP, nuevas cuentas de prueba o borrado del administrador ya creado.
13. **Dependencias:** Keycloak local 26.7.1 vivo y tema heredado existente.
    Sin paquetes, migraciones o reconstrucción de imágenes API/web.
14. **Aceptación:** login real lleva a Municipality; cuenta/subject e issuer
    idénticos, realm sin cambios fuera de displayName/loginTheme/locales,
    contenedores persistentes con mismo ID, error neutral y campos en español.
15. **Pruebas:** recorrido real de login/callback/panel con cuenta ficticia ya
    autorizada, cierre de sesión, teclado/axe/320px y assets 200. Lint/scanner,
    gate/validación/diff-check. Sin repetir baseline de dominios sin cambios.
16. **Aprobadas:** aplicar presentación al entorno local desde Eloisa-develop y
    conservar autenticación actual; corrección rutinaria sin nueva arquitectura.
17. **Fuera de alcance:** nuevo origen/proxy, correo como identificador,
    roles adicionales, acceso automático por registro, S02–S14 y despliegue externo.
18. **Rollback/evidencia:** restaurar cinco campos desde backup privado; copia
    del tema previo si existía. Guardar resultados sin secretos, revisar diff
    independientemente y explicar límites reales al PO. No reiniciar contenedor.
