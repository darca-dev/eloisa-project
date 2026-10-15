# Plan 047

## Hitos

1. Registrar alcance exacto y pasar gate; respaldar fuentes.
2. Cambiar únicamente los dos enlaces institucionales del hub y adaptar el caso existente.
3. Pruebas focales/tipos/lint/scanner/build; reemplazar web con configuración conservada.
4. E2E ambos botones, registro disponible/cerrado, cuenta municipal y logout; revisión y documentación.

## Dependencias

Helper compartido urlDeLoginHumano, proveedor activo con login046 y selector /acceso.

## Riesgos

Prefetch involuntario, selector erróneo por inventar rol en cliente o logout que reautentique automáticamente. Usar enlace HTML normal al helper existente, no modificar gates ni logout, comprobar el circuito completo.
