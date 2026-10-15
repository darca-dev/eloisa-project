# 052 — Hospital sin datos demostrativos

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para implementación y aplicación local`.
- Fecha: 2026-10-15.
- Aprobado por: Product Owner, conversación vigente.
- Evidencia: ../../bitacora/decisiones/2026-10-15-hospital-sin-datos-demostrativos.md.

## Contrato

1. Objetivo: retirar del Hospital operativo el nombre técnico «MERDN — Tenant institucional MVP» y todos los datos demostrativos visibles, incluidos los indicadores y citas de Inicio.
2. Usuarios: administrador Hospital existente y sesiones institucionales autorizadas; no se crean roles ni usuarios.
3. Datos: Inicio consulta la API de agenda existente para el día UTC que esta API define. Muestra únicamente citas asignadas y el total publicado, fecha/corte y estados de carga, vacío real, error y denegación. No usa cero como sustituto de una consulta fallida. Los accesos a pacientes, profesionales, agenda y visitas conservan sus consultas reales.
4. Módulos sin consulta: alarmas, consultas virtuales, calificaciones, novedades, finanzas y reportes conservan navegación y descripción de su propósito, pero no montan componentes con fixtures ni ofrecen acciones simuladas. Configuración conserva solicitudes y recuperación reales; otras pestañas sin servicio no publican datos de ejemplo.
5. Identidad: el nombre técnico inicial o vacío se presenta como «Hospital», sin inventar razón social, municipio o logo; nombres institucionales reales se conservan. No se renombra el tenant ni se modifica la base.
6. Permisos/seguridad: autorización de API, cookies, auditoría, RLS y contratos intactos. Limpiar datos de Inicio al fallar o perder sesión. Cancelar consultas al desmontar; no completar con fixtures.
7. Alcance: cambios web Hospital, pruebas focales, documentación, artefactos052 e índice/consentimiento. Fixtures de referencia solo pueden usarse con modo de demostración explícito, nunca en /hospital operativo. No borrar cuentas de prueba ni registros de base bajo la suposición de que son falsos.
8. Prohibidos: modificar prototipos, Alcaldía, login, API, esquema, datos personales, permisos, dependencias o reglas clínicas. No implementar finanzas, calificaciones, reportes o semáforos con fórmulas inventadas.
9. Aceptación: ningún nombre técnico, persona, importe, cifra, evento o cita procedente de fixtures en las doce vistas operativas. Citas de Inicio corresponden a la respuesta real de agenda; ausencia de registros y consulta no disponible se distinguen. Configuración real sigue operativa.
10. Pruebas: casos semánticos de aislamiento de fixtures, estados y nombres; pruebas Hospital afectadas, tipos/lint/build/scanner/gate. E2E con Hospital existente, navegación, contraste con API, error/reintento/denegación, responsive/axe/logout. No nuevas pruebas DB: servidor y datos sin cambios.
11. Operación: construir web desde esta rama y sustituir solo web, con respaldo privado de imagen/configuración y comprobación de API/PG/IdP conservados; rollback si falla. Git posterior no incluido.
