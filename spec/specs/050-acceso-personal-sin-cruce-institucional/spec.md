# 050 — Acceso personal sin cruce institucional

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para corrección y aplicación local`.
- Fecha: 2026-10-14.
- Aprobado por: PO, conversación vigente.
- Evidencia: ../../bitacora/decisiones/2026-10-14-acceso-personal-sin-cruce.md.

## Contrato

1. Objetivo: corregir que el ingreso de pacientes desde el portal abra Alcaldía con una sesión municipal previa.
2. Contexto: PO comunica «lo mismo pasa con el de pasientes» después del arreglo049. El hub personal aún enlaza /acceso, cuyo selector incluye instituciones.
3. Usuarios: pacientes, cuidadores y visitadores con aprobación vigente; cuentas institucionales no obtienen perfiles personales por navegar.
4. Módulos: enlace personal del hub, selector /acceso, solicitud OIDC existente y pruebas focales.
5. Funcional: el botón personal abre directamente el login real con retorno /acceso y petición interactiva aun con SSO. Después, solo experiencias personales aprobadas pueden dirigir a sus paneles; cuenta solo institucional queda en denegación personal con opción de cambiar cuenta.
6. Datos: no migraciones, cuentas nuevas ni cambios de registros; se reutiliza el intento persistido y retorno /acceso ya aprobado.
7. Permisos: el servidor conserva autoridad sobre experiencias, contextos y recursos; filtrar navegación no concede acceso ni reemplaza guardas.
8. Auditoría: eventos de intento/callback/sesión existentes, sin exponer cuentas, credenciales o datos nominales adicionales.
9. Seguridad: allowlist sin cambios, PKCE/state/nonce y cookies intactos; pedir credenciales no acredita step-up privilegiado. Ninguna selección de rol enviada al proveedor.
10. Decisión: restringir la presentación de /acceso a sus tres perfiles personales y usar el helper común desde hub. No crear realms, sesiones duplicadas ni rutas libres.
11. Permitidos: human-auth.service.ts; human-auth.controller.ts (solo destino /hospital de reautenticación para recuperación); personal-registration.db.test.ts; HubAccessPortal.tsx; humanSessionClient.ts/test; CentralAccess.tsx/test; app/page.test.tsx; docs/ACCESO-ELOISA.md; artefactos050, INDEX y consentimiento. Helpers/evidencias temporales ignorados.
12. Prohibidos: paneles Municipality/Hospital/paciente, roles/permisos/RLS, cuentas/datos, issuer/cliente/grants, dependencias, prototipo y Git protegido.
13. Operación: construir y reemplazar únicamente API/web desde este checkout, con backup privado de configuración e imágenes anteriores; preservar env/red/puertos/usuarios y contenedores PostgreSQL/IdP. Sin migración.
14. Aceptación: sesión municipal→hub→ingreso personal muestra login; la misma cuenta municipal retorna /acceso sin abrir Alcaldía/Hospital/paciente. Perfil personal aprobado conserva su destino y varios personales conservan selector. Registro guiado intacto, sin loop automático de login en denegación. Recuperación administrada Hospital reautentica con destino /hospital, manteniendo vínculo de sesión/cuenta/identidad y comprobación auth_time.
15. Pruebas: contrato SSR del enlace, filtro personal con listas mixtas/vacías, intento/callback /acceso interactivo sin step-up en PostgreSQL aislado; builds/tipos/lint/scanner. E2E real con cuenta municipal existente y comprobación separada de navegación personal con respuestas controladas de prueba, identificadas como tales; sin crear cuentas para probar.
16. Aprobación: solicitud correctiva expresa vigente y autorización previa de implementación/acceso real y Docker local. No publicación Git.
17. Fuera: sesiones simultáneas por institución, creación/aprobación de pacientes, nuevos módulos y cambios visuales de paneles.
18. Rollback: restaurar ambas imágenes/configuraciones anteriores; no hay cambios de esquema o cuentas que revertir. Documentar verificación y límites de prueba.
