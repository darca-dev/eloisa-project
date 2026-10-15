# Plan 052

## Hitos

1. Auditar el montaje de fixtures y registrar contrato/autorización.
2. Sustituir Inicio por agenda real y aislar módulos sin consulta.
3. Limpiar identidad técnica y verificar regresiones de operaciones reales.
4. Build/revisión; aplicar web y comprobar en navegador con cuenta existente.

## Dependencias

API de agenda y sesión Hospital actuales, componentes de operaciones reales y Docker local.

## Riesgos

Confundir cero con consulta fallida; publicar demostración tras login real; ocultar datos legítimos al tratar de borrar fixtures. Solo se cambia presentación/montaje, sin eliminación de base. El día de agenda sigue el contrato UTC existente y se identifica expresamente.
