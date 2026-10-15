# 047 — Login directo desde el hub institucional

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para implementación y aplicación local`.
- Fecha: 2026-10-14.
- Aprobado por: PO, conversación vigente.
- Evidencia: ../../bitacora/decisiones/2026-10-14-login-directo-desde-hub.md.

## Contrato

1. Objetivo: eliminar el clic redundante entre «Ingresar» del hub institucional y el login real.
2. Contexto: el hub manda a /municipality o /hospital sin sesión; esas rutas muestran una tarjeta que obliga a pulsar «Iniciar sesión» otra vez. El PO la rechaza expresamente.
3. Usuarios: cuentas Hospital y Alcaldía existentes; primer registro sigue separado en el hub.
4. Módulos: solo enlaces de entrada del hub, sin tocar paneles interiores.
5. Funcional: ambos botones institucionales navegan directamente al inicio OIDC compartido mediante urlDeLoginHumano; mismo texto/estilo. Registro sigue mediante InstitutionalRegistrationLink cuando servidor lo permite. Retorno /acceso resuelve experiencias aprobadas como ya hace el sistema.
6. Datos: no crea cuentas, registros ni cifras; no transporta tenant/rol/destino libre.
7. Permisos: autenticación y autorizaciones siguen en API/proveedor; pulsar una tarjeta no concede un perfil. La cuenta determina el destino autorizado.
8. Auditoría: inicio/callback/sesión usan eventos existentes. Sin nuevos datos en logs.
9. Seguridad: enlace HTML de navegación completa, sin prefetch hacia el endpoint que crea intentos, sin credenciales propias ni storage. Conservar PKCE, state, nonce y cookie transitoria.
10. UX: un clic del hub abre formulario Eloisa; con SSO vigente el proveedor puede devolver directamente. No se cambia diseño del hub ni login046.
11. Permitidos: apps/web/src/features/hub/HubAccessPortal.tsx; caso existente en apps/web/src/features/access/CentralAccess.test.ts; docs/ACCESO-ELOISA.md; artefactos047, INDEX y consentimiento.
12. Prohibidos: paneles Hospital/Municipality, InstitutionalAccess, API, schema, migraciones, dependencias, proveedor, cuentas/datos, prototype-claude/, tasks/, reviews/, ramas protegidas.
13. Dependencias: urlDeLoginHumano, callback y selector /acceso existentes; Docker web actual. Sin paquetes ni nueva arquitectura.
14. Aceptación: sin sesión, cada botón institucional abre formulario real sin visitar /hospital o /municipality antes de autenticarse; registration links conservados según servidor. Cuenta municipal vuelve al panel correcto, denegación Hospital y logout sin reautenticación automática.
15. Pruebas: adaptar caso existente a enlaces reales/semánticos; suite focal de acceso/cliente, tipos/lint/scanner/build. E2E ambos botones sin sesión; login/callback/panel/logout con cuenta municipal existente, error y preservación de registro. Sin nueva batería de CSS ni repetir baseline de dominios intactos.
16. Aprobado: PO limita trabajo a entradas/logins y rechaza pantalla redundante; autorización previa para implementar módulos y corregir acceso local permanece. Aplicación solo web en Docker del proyecto Eloisa-develop; sin Git nuevo.
17. Fuera: eliminar todas las pantallas de sesión cerrada, cambiar logout/SSO, ampliar destinos backend, personalizar flujo por rol, tocar módulos interiores o completar pendientes.
18. Rollback/evidencia: copia de fuentes previas, imagen/config web anterior por ID inmutable; reemplazo solo web preservando env/puertos/red y IDs API/DB/IdP. Capturas y revisión focal independiente.
