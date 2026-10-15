# Plan 053

## Hitos

1. Investigar fuentes primarias y revisar autorización/datos/versionado.
2. Contrato de captura, migración aditiva y API transaccional autorizada.
3. Configuración y lectura de registros propios en los apartados.
4. Pruebas aisladas, revisión, backup y aplicación local con E2E.

## Dependencias

Cuenta municipal y API/Prisma/RLS vigentes; fuentes públicas oficiales. Territorio y periodo esperan información del PO; no bloquean captura institucional vacía.

## Alternativas y riesgos

localStorage o fixtures no permiten persistencia institucional verificable. Un JSON arbitrario permitiría mezclar información sensible o indicadores no definidos. Se adopta catálogo cerrado de campos con revisiones append-only, sin nuevas reglas oficiales ni cálculos financieros. Conflictos explícitos evitan pérdida concurrente; enlaces no equivalen a integración ni certificación.
