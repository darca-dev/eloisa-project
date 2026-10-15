# Plan 044

## Hitos

1. Acotar instrucción y registrar fuente actual; pasar gate.
2. Composición operativa sobre APIs existentes y estados honestos de pendientes.
3. Tipos/suite web y E2E local antes/después del rebuild web.
4. Revisar independencia de fixtures, privacidad y conservación de cuenta/IdP/DB.

Dependencias: primer administrador municipal de prueba ya autorizado, APIs
municipales existentes y fuente actual; no fuentes oficiales nuevas.
Riesgos: llamar real a un fixture persistido, confundir módulo no implementado
con base vacía, esconder fallos o permitir fuga de datos. Mitigar con procedencia,
estados separados y reutilización de supresión/autorización del servidor.
