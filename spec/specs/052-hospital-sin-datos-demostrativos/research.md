# Investigación 052

HospitalShell.tsx monta HospitalDashboard, Alerts, VirtualConsultations, Ratings, Updates, Reports y FinancialManagement con configuraciones de ejemplo aun cuando modoDemoLocal es false. HospitalAdministration también contiene configuraciones demostrativas, aunque el administrador humano recibe solo Solicitudes de acceso, que sí es real.

La API hospital-agenda.service.ts sirve citas ASSIGNED dentro de una ventana UTC y publica totalAppointments, appointments, source y generatedAt. El cliente consultarAgenda ya maneja errores y credenciales. Se reutiliza ese contrato, sin nuevas consultas de base ni métricas inventadas. Las solicitudes sin fecha no se cuentan como citas de hoy.

HospitalShell usa directamente institution.name para el lateral. El tenant inicial tiene un nombre técnico que no representa una razón social verificada. Se usa un rótulo neutral solo para ese valor, conservando nombres legítimos.
