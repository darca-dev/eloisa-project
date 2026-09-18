# Investigación 005 - Experiencia visual Alcaldía

Medido sobre `develop` el 2026-08-25.

## R1. Concentración de datos estáticos

`municipalityConfig.ts` son **5.059 líneas**, el archivo más grande del
repositorio por un margen amplio (el segundo es `engine.ts` del orquestador, con
2.125).

## R2. Qué está conectado

`grep -l "municipalityAggregatesClient\|useMunicipalityAggregate" features/municipality/*.tsx`
devuelve `MunicipalityPopulation.tsx` y `MunicipalityTerritory.tsx`. Nada más.

El cliente es `municipalityAggregatesClient.ts`, con su prueba, y el hook
`useMunicipalityAggregate.ts`.

## R3. Cobertura de pruebas

10 archivos de prueba: `municipalityBudget`, `municipalityDemoFinal`,
`municipalityEvidence`, `municipalityHome`, `municipalityPrivacidad`,
`municipalityPrograms`, `municipalityShell`, `municipalityViews`,
`MunicipalityPopulation`, `MunicipalityTerritory`, más `municipalityTestUtils.ts`.

`municipalityPrivacidad.test.tsx` es relevante: prueba explícitamente el
comportamiento de privacidad de las vistas conectadas.

## R4. Dominios sin persistencia

Ninguno de los 20 modelos de `prisma/schema.prisma` cubre presupuesto,
asignación, ejecución, gasto, proveedor, contrato, evidencia documental,
indicador, brecha, FURAG, MIPG ni ADRES.

## R5. Multi-municipio

No se encontró ningún código de municipio codificado en las vistas. El contexto
territorial procede de `data/divipola.ts` y del tenant resuelto en servidor.

## R6. Verificación no ejecutada

`node_modules` ausente: no se ejecutó la suite.
