# 045 — Interfaz municipal profesional

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para implementación y aplicación local`.
- Fecha / Date: 2026-10-14.
- Aprobado por / Approved by: PO, conversación vigente.
- Evidencia / Evidence: ../../bitacora/decisiones/2026-10-14-interfaz-municipal-profesional.md.

## Contrato de tarea

1. ID/objetivo: 045, reconstruir la interfaz operativa de Municipality con diseño
   profesional y facilitar lectura, navegación y consulta de datos guardados.
2. Contexto: 044 aplicado; interfaz básica, sidebar móvil demasiado largo y
   jerarquía visual limitada. Usuario pide reconstrucción profesional.
3. Usuarios: administrador municipal autorizado, con sus mismos permisos/tenant.
4. Módulos: presentación del panel, navegación, Inicio y estados pendientes;
   Población/Territorio existentes comparten el nuevo marco sin cambiar datos.
5. Funcional: sidebar agrupado con selección visible, cabecera/breadcrumb,
   cuatro indicadores API, corte real, accesos funcionales, notas de privacidad
   y fuente. Menú móvil desplegable accesible, Escape y foco al navegar.
6. Datos: mismos DTO/estados/valores publicados por API, nunca cifras locales,
   trends, mapas, gráficos o actividad inventados. Nada nominal/clinical nuevo.
7. Permisos: gate vigente antes de montar, servidor/RLS/HttpOnly sin cambios;
   despliegue solo web, sin nuevas capacidades o registros.
8. Auditoría: consultas/cierre usan eventos existentes. No nuevas escrituras de
   negocio ni PII/credenciales en evidencia o logs.
9. Seguridad: conservar supresión, errores sin fallback, cancelación del hook,
   denegación uniforme y sesión. No enviar tenant ni guardar datos en navegador.
10. Referencia visual: marca Eloisa/assets/iconos existentes. Esta orden permite
    renovar composición autorizada; no modificar el prototipo histórico.
11. Permitidos: MunicipalityOperationalPanel.tsx, MunicipalityOperationalNavigation.tsx,
    municipalityOperational.module.css y MunicipalityOperationalPanel.test.tsx
    dentro de apps/web/src/features/municipality/; docs/ACCESO-ELOISA.md;
    spec/specs/045-interfaz-municipal-profesional/, spec/specs/INDEX.md,
    spec/.sdd/user-consent.log y decisión 2026-10-14-interfaz-municipal-profesional.md.
12. Prohibidos: demás apps/API/DB/schema/migrations/auth/IdP, fixtures, activos
    históricos, prototype-claude/, tasks/, reviews/, main/develop, datos/cuentas.
13. Dependencias: componentes/iconos/marca/APIs existentes. Sin librerías, fuentes
    remotas o imágenes nuevas. Reconstruir solo web con configuración conservada.
14. Aceptación: interfaz coherente en escritorio/tablet/320px; menú móvil no
    ocupa la página al cerrarse; controles reales, foco/contraste/semántica,
    datos exactamente API y diez apartados explícitamente pendientes.
15. Pruebas: tipos/lint/suite web existentes; no añadir snapshots/CSS tests.
    E2E real cuenta existente: 13 destinos, menú móvil/Escape/foco, datos API,
    error/reintento/logout, axe y sin desbordamiento en 320/768/1440.
16. Aprobado: renovación visual y aplicación Docker local solicitadas por PO;
    conservar 043/044 previos y cambios ajenos. Sin publicación Git nueva.
17. Fuera: completar CRUD pendiente, cambiar login/roles, reset/borrado/cargas
    de datos, estadísticas oficiales o presentar prueba como fuente institucional.
18. Rollback/evidencia: guardar archivos/imagen/config anteriores privadamente,
    reemplazar solo web; comprobar IDs de otros servicios y env/puertos/red,
    capturas y revisión focal accesibilidad/privacidad sin secretos.
