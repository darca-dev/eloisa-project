# Hospital operativo sin datos de ejemplo

El PO solicita quitar «MERDN — Tenant institucional MVP» y limpiar citas de hoy y demás datos falsos. Autoriza corregir el Hospital y aplicarlo en Docker local dentro del trabajo vigente. No solicita eliminar usuarios ni registros de la base.

Se decide conectar Inicio con consultarAgenda y excluir componentes demostrativos del montaje operativo en HospitalShell.tsx. Las capacidades sin API conservan sus destinos, con estado pendiente explícito, sin cifras ni acciones simuladas. Fuente: montaje actual en HospitalShell.tsx, contratos hospitalAgendaClient.ts y hospital-agenda.service.ts; especificación052.

Se presenta «Hospital» cuando la sesión devuelve el nombre técnico inicial; no se inventa una institución ni se renombra el tenant. Los nombres institucionales reales se conservan.

Revisar cuando cada módulo tenga consulta y reglas aprobadas: sustituir su estado pendiente por la integración correspondiente. Ninguna de estas pantallas pendientes constituye un módulo funcional terminado.
