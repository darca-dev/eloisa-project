# Decisión PO — registro real y precarga de usuarios test

Fecha: 2026-10-09.

El PO indicó «ya no son datos ficticios» y precisó: «ya no se manejan datos ficticios todo es real solo, se dejan botones de test con la precarga de todos los datos ( usuarios test) para no llenar todo a mano en algun registro agrega tambien contraseña en esos test)».

Se sustituye la presentación general de demo del acceso por registro/solicitud real. Se conservan botones explícitos de usuarios test que solo precargan datos y una contraseña generada por pulsación; el envío sigue siendo manual, por la API existente, y no concede acceso sin aprobación. Datos test siguen separados conceptualmente de personas reales; no se introducen personas reales en fixtures ni secretos fijos en código. Autorización de Codex y Git local de continuidad conservadas. Esta decisión prima sobre el aviso visible de 038, sin reescribirla ni fabricar consentimiento.

MP05 aplica interfaz y precarga, sin cambiar seguridad/tenant/consentimientos manuales, migraciones ni backend. Hallazgo material separado: AccessRequestSource solo admite TEST_DATA y API/cliente lo fijan; el cierre de procedencia para datos reales requiere contrato/migración aparte antes de declararlo resuelto. No se presenta como producción habilitada ni como aceptación de S00/S01. MP04C sigue pendiente.
