# 051 — Composición municipal conforme Alcaldía

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para implementación y aplicación local`.
- Fecha: 2026-10-14.
- Aprobado por: Product Owner, conversación vigente.
- Evidencia: ../../bitacora/decisiones/2026-10-14-municipality-composicion-alcaldia.md.

## Contrato

1. Objetivo: acercar /municipality a Eligeme-Alcaldia.dc.html, incluyendo composición de los apartados que todavía mostraban una tarjeta genérica.
2. Contexto: PO corrige explícitamente Hospital por Municipality: «que la pagina municipaly sea como la acaldia dentro de prororype claude». Inspección previa Hospital fue de solo lectura; Hospital queda fuera.
3. Usuarios: administrador municipal existente, misma sesión y consulta agregada.
4. Módulos: marco/Inicio operativo y composición visual de diez apartados sin consulta; Población/Territorio conservan consultas y componentes.
5. Funcional: navegación de trece destinos existente, títulos/tarjetas/tablas vacías/rutas conceptuales según la referencia. Los diez apartados conservan estado visible pendiente; no botones de escritura, filtros falsos, gráficas cuantitativas ni exportaciones simuladas.
6. Datos: cuatro conteos y fecha publicados por API actual sin alterar supresión. Eliminar repetición visual de la misma nota, conservando procedencia una vez. Diez apartados nuevos de presentación solo contienen etiquetas y estados de consulta no disponible, nunca registros/cifras del prototipo ni indicadores oficiales inventados.
7. Permisos: gate de sesión y servidor/RLS intactos; no acceder a información nominal ni ampliar queries.
8. Auditoría: consultas/login/logout existentes; sin nuevas escrituras, cuentas, eventos o archivos de negocio.
9. Seguridad: no importar runtime DC, iframe ni fixtures en flujo administrador; mismas cookies, cancelación y manejo de error/supresión. Prototipo solo lectura.
10. Referencia: jerarquía de cada apartado, colores, radios y separaciones; reutilizar tokens/Nunito/Sidebar/ProfileBadge/CSS de layout existentes. Mantener identidad real/neutra de la sesión y marca Eloisa.
11. Permitidos: MunicipalityOperationalPanel.tsx/test, municipalityOperational.module.css; nuevos MunicipalityModuleLayout.tsx y municipalityModuleLayouts.ts para títulos/estructura sin datos; docs/ACCESO-ELOISA.md, artefactos051, INDEX y consentimiento. Temporales de evidencia/deploy ignorados.
12. Prohibidos: Hospital, login/hub, API, DB/migraciones/cuentas/permisos, dependencias, prototype-claude, históricos y fixtures de módulos de diseño. No modificar Población/Territorio funcionales ni suprimir capacidades estratégicas.
13. Operación: build web desde checkout actual, reemplazo solo web con backup privado/configuración preservada; API/PostgreSQL/IdP conservan IDs. Sin migración.
14. Aceptación: trece destinos en orden, layouts diferenciados en diez pendientes con secciones correspondientes al HTML; ningún dato ni éxito simulado, Inicio conserva conteos/errores y diseño más compacto. Foco/menú/logout y autorización preservados; sin desborde320/768/1340.
15. Pruebas: ampliar caso semántico existente de todos los apartados para distinguir layout/pending/no fixtures y conservar gate; pruebas focales municipales y builds/tipos/lint/scanner. E2E real con cuenta existente, navegación trece destinos, capturas comparadas, móvil/teclado/axe, API/503/reintento/401/logout. No pruebas de CSS espejo ni nuevas suites DB.
16. Aprobación: solicitud visual expresa del PO, con instrucción vigente de base actual sin cifras de ejemplo. Implementación y aplicación Docker local autorizadas; Git no incluido.
17. Fuera: CRUD/consultas de los diez módulos aún pendientes, indicadores/reglas/fuentes oficiales, importación de datos del prototipo o rediseño Hospital.
18. Rollback/evidencia: fuentes previas e imagen/config web respaldadas; restaurar solo web si falla. Revisar fuentes y capturas, informar que la composición visual no habilita las consultas pendientes.
