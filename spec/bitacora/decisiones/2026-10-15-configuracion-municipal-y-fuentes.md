# Captura institucional por administrador municipal

El PO pide que el administrador de Alcaldía pueda llenar apartados en Configuración y que se limpien los datos que deben capturarse, identificando los de páginas externas. Su solicitud autoriza esta captura persistente y aplicación local, sin asignar nuevos roles ni usar el administrador de plataforma.

Se elige un catálogo de formularios administrativos y revisiones append-only en PostgreSQL existente. Alternativas localStorage/fixtures no cumplen persistencia institucional; un formulario JSON arbitrario dificulta validación y procedencia. Las decisiones técnicas siguen Prisma, RLS y auditoría vigentes, sin nuevos servicios. Fuente: MunicipalityOperationalPanel.tsx, docs/PRODUCT.md sección3 y especificación053.

Los datos manuales son declaraciones institucionales; los externos son transcripciones con referencia y fecha, nunca resultados generados o certificados por Eloisa. Población y territorio calculados conservan su fuente y supresión. No se crean cifras, nombres municipales, presupuestos o programas de ejemplo. Los enlaces oficiales se documentan en research053.

Revisar al disponer del territorio/vigencia y de APIs oficiales autorizadas, y cuando programas, documentos o finanzas requieran sus flujos completos. Esta captura no se presenta como contabilidad, certificación ni reporte oficial automático.
