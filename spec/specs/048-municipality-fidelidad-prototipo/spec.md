# 048 — Municipality conforme a la referencia Alcaldía

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para implementación y aplicación local`.
- Fecha: 2026-10-14.
- Aprobado por: Product Owner, conversación vigente.
- Evidencia: ../../bitacora/decisiones/2026-10-14-municipality-fidelidad-prototipo.md.

## Contrato

1. Objetivo: que /municipality siga la composición de prototype-claude/Eligeme-Alcaldia.dc.html señalada por PO.
2. Contexto: 044 sirve datos guardados en una presentación básica; el PO ahora indica expresamente cómo debe verse el interior municipal. Esta instrucción autoriza ese ámbito visual, sin extenderse al Hospital.
3. Usuarios: administrador municipal autorizado, misma institución y permisos.
4. Módulos: marco municipal, cabecera, Inicio y presentación de pendientes; Población/Territorio conservan componentes y API existentes.
5. Funcional: menú azul con trece destinos y orden de referencia, cabecera institucional, titulares azules, cadena persona/evidencia, tarjetas de pendientes, accesos rápidos y actividad. Navegación real entre vistas, logout real, menú móvil con teclado/Escape/foco.
6. Datos: cuatro conteos publicados y corte de API actual; nombre institucional de la sesión ya resuelta, con etiqueta neutral «Alcaldía» si el nombre local contiene la marca técnica interna que nunca debe mostrarse. Sin cifras de diseño ni nuevas estadísticas, porcentajes, eventos o alertas. Ausencia de implementación/fuente se expresa sin confundirla con cero registros. Cobertura sin dato oficial, sin porcentaje.
7. Permisos: gate previo y autorización servidor/RLS intactos; la apariencia no concede capacidad ni añade carga nominal.
8. Auditoría: mismas consultas/login/logout existentes. No nuevas escrituras de negocio, carga de datos o cuentas.
9. Seguridad: conservar cookie HttpOnly, supresión de grupos pequeños, errores sin fallback, consulta cancelable y fuente declarada. No usar runtime DC, iframe, HTML del prototipo ni scripts/fuentes remotos nuevos en producto.
10. Referencia: HTML Alcaldía como fuente visual, leído sin modificar. Reutilizar Sidebar/Icon/ProfileBadge/tokens/Nunito ya presentes. Marca definitiva Eloisa permanece; entidad/rol vienen de sesión, sin Secretarías o ciudades ficticias.
11. Permitidos: MunicipalityOperationalPanel.tsx, municipalityOperational.module.css y su prueba semántica existentes; MunicipalityShell.tsx solo para pasar nombre institucional de la sesión al panel; apps/web/src/app/page.test.tsx solo para corregir expectativas obsoletas de enlaces047 detectadas en regresión, sin modificar el hub. docs/ACCESO-ELOISA.md; artefactos048, INDEX y consentimiento.
12. Prohibidos: Hospital, hub, login/proveedor, API, esquema/migraciones, datos/cuentas, dependencias, prototipo y archivos históricos, módulos/fixtures de diseño, ramas protegidas. No deshacer 047.
13. Dependencias: API poblacional actual, componentes visuales existentes e imagen web local. Sin librerías nuevas ni migraciones.
14. Aceptación: composición reconocible y comparable con referencia a1340px; trece destinos en orden, identidad de sesión, cuatro conteos exactos/API, diez módulos pendientes sin tablas/forms ficticios; cero desborde a320/768/1340, teclado y contraste correctos.
15. Pruebas: tres casos semánticos operativos existentes adaptados para nombre de sesión y regiones sin inventar datos; pruebas web existentes apropiadas, tipos/build/lint/scanner. E2E real cuenta existente, trece destinos, menú/Escape/foco, API/503/reintento/401/logout, axe y capturas comparadas. Sin tests de CSS/snapshots ni baseline DB intacta.
16. Aprobado: PO «revisa en la carpeta prototipe claide Eligeme-Acaldia asi debe verse http://127.0.0.1:3000/municipality». Autoriza ajuste visual municipal local; mantiene orden previa de usar base actual sin cifras de ejemplo. Git no incluido.
17. Fuera: implementar CRUD de diez módulos pendientes, importar datos del prototipo, periodos sin consulta real, autoridad oficial de indicadores, nuevo panel Hospital o nueva arquitectura de acceso.
18. Rollback/evidencia: copias de fuentes e imagen/config web previas, despliegue solo web con configuración/otros IDs conservados; prototipo intacto y capturas referencia/producto, revisión focal independiente y reporte de diferencias por datos no disponibles.
