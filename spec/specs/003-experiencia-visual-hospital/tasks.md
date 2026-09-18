# Tareas 003 - Experiencia visual Hospital

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

- [x] Shell con barra lateral y superior
- [x] Dashboard con KPI, accesos, atención y resúmenes
- [x] Secciones de operación: agenda, visitas domiciliarias, consultas virtuales
- [x] Secciones de cuidado: pacientes, profesionales, alertas
- [x] Administración, centro de control, roles y permisos, acceso de personal
- [x] Gestión financiera y membresías
- [x] Analítica de pacientes
- [x] Reportes
- [x] Auditoría, novedades, importación clínica, ajustes de institución
- [x] Sin repliegue a fixtures ante error de API en las secciones conectadas

## Estado de conexión (hecho / no hecho)

- [x] Pacientes conectado a la API — spec 009
- [x] Profesionales y agenda conectados — spec 010
- [x] Visitas domiciliarias conectadas — spec 013
- [x] Ajustes de institución conectados — spec 014
- [ ] Finanzas, presupuesto, proveedores, contratos — sin modelo en Prisma
- [ ] Membresías, pagos, catálogo de servicios — sin modelo en Prisma
- [ ] Alertas, evidencias, valoraciones, importación clínica — sin modelo en Prisma

## Límites conocidos (no autorizados como trabajo)

- [ ] Marca visual que distinga sección conectada de sección de configuración
- [ ] División de los archivos de más de 1.000 líneas

## Verificación pendiente

- [ ] Ejecutar la suite de `features/hospital`
