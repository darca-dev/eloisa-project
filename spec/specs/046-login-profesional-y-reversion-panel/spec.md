# 046 — Login profesional y reversión del panel

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para implementación y aplicación local`.
- Fecha: 2026-10-14.
- Aprobado por: Product Owner, conversación vigente.
- Evidencia: ../../bitacora/decisiones/2026-10-14-login-profesional-y-reversion-panel.md.

## Contrato

1. Objetivo: mejorar la página de login real de Eloisa y deshacer el rediseño municipal 045, según corrección expresa del PO.
2. Contexto: el PO aclara que la pantalla a mejorar es el login; el formulario sigue alojado en el proveedor actual.
3. Usuarios: todas las cuentas del mismo proveedor y administrador municipal existente.
4. Módulos: tema visual Eloisa heredado de keycloak.v2 y restauración exacta de la presentación 044 del panel.
5. Funcional: login sobrio y profesional, marca reconocible, formulario legible, controles y errores en español, teclado, contraseña visible/oculta y vuelta al portal. Mantener plantillas funcionales heredadas.
6. Datos: imágenes de marca existentes; ningún dato, cifra o usuario nuevo. Conservar consultas reales, supresión y estados pendientes de 044.
7. Permisos: sin cambios en OIDC, issuer, PKCE, sesiones, cookies, cuentas, roles, tenant o API.
8. Auditoría: instalación local con backup privado y comparación de estado mediante script 043; eventos de login vigentes.
9. Seguridad: no credenciales en código/evidencia/Git, fuentes remotas, scripts nuevos en login, proxy, grants alternativos o acceso automático.
10. Referencia: identidad Eloisa existente; prototipo histórico permanece intacto. No se inventan promesas de certificación, disponibilidad o funciones.
11. Permitidos: CSS/mensajes/footer/theme.properties del tema infra/local-oidc/themes/eloisa/login (versión del recurso CSS para evitar caché anterior); restaurar los tres archivos de .tmp/ui-before045 a features/municipality y retirar MunicipalityOperationalNavigation.tsx creado por 045. Documentación ACCESO-ELOISA, README del IdP, spec 045/history, INDEX, consentimiento y artefactos 046.
12. Prohibidos: resto de aplicaciones, API, esquema, migraciones, dependencias, datos, cuentas, prototype-claude/, tasks/, reviews/, main/develop. No retirar 044 ni volver a fixtures.
13. Dependencias: script de aplicación 043 existente; imagen anterior 044 verificada por ID y origen; restauración desde copia previa 045. Sin reconstrucción API/DB/IdP.
14. Aceptación: panel vuelve a 044 conservando datos actuales; login profesional coherente a 320/768/1440px sin desborde, errores/foco/etiquetas/contraste correctos; acceso real a Municipality con cuenta existente, Hospital denegado.
15. Pruebas: pruebas semánticas municipales existentes, rollback del tema, lint/scanner/gate/diff; recorrido login/error/ocultar contraseña/panel/cierre, recursos y axe. No crear pruebas de CSS ni repetir baseline de dominios intactos.
16. Aprobado: PO pide «deshaz eso lo que debes mejorar es la pagina de login» y elige expresamente «Revertir el panel y mejorar el login». Incluye aplicación en Docker local dentro del flujo solicitado; sin publicar Git.
17. Fuera: cambiar arquitectura/origen de autenticación, nuevo formulario de credenciales propio, roles, recuperación nueva, nuevos registros o completar módulos pendientes.
18. Rollback/evidencia: conservar fuentes 045 antes de restaurar; script 043 respalda tema y verifica cuentas/config; reemplazo solo web con imagen inmutable anterior, backup y configuración conservada. Capturas y revisión focal independiente.
