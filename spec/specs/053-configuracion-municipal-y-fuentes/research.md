# Investigación 053

MunicipalityOperationalPanel monta diez layouts sin consultas y solo Inicio/Población/Territorio tienen agregados reales. No existe persistencia municipal editable ni Configuración. Las pantallas antiguas de prototipo contienen cifras que nunca deben pasar a esta captura.

Fuentes primarias revisadas el2026-10-15:

- DANE, certificados municipales por departamento/municipio/vigencia: https://sitios.dane.gov.co/certificados-poblacion/
- DANE, proyecciones: https://sitios.dane.gov.co/visor-de-proyecciones-de-poblacion/
- Función Pública, resultados publicados MDI/FURAG: https://www.funcionpublica.gov.co/resultados-medici%C3%B3n-del-desempe%C3%B1o-institucional
- Función Pública, diligenciamiento FURAG: https://furag.funcionpublica.gov.co/furag
- ADRES, información territorial: https://www.adres.gov.co/entidades-territoriales
- SENA, oferta educativa oficial: https://betowa.sena.edu.co/
- SENA, consulta de certificados: https://certificados.sena.edu.co/
- Corte Constitucional, texto T-319/25: https://www.corteconstitucional.gov.co/relatoria/2025/t-319-25.htm

Las fuentes permiten consultar documentos/resultados, pero no prueban que un dato pertenezca al municipio actual ni habilitan inferencias de cumplimiento. No se ingieren datos individuales. Se solicita municipio/departamento/vigencia al PO antes de capturar cifras externas.
