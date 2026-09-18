# Especificación 005 - Experiencia visual Alcaldía

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Agrupa `tasks/TASK-ALCALDIA-A-01..04` y `TASK-ALCALDIA-DEMO-FINAL`,
con sus auditorías `reviews/REVIEW-ALCALDIA-A-0*-FINAL.md` y
`REVIEW-ALCALDIA-DEMO-FINAL.md`. Congeladas.

## Objetivo

Que el gobierno municipal exista como experiencia diferenciada de MERDN —no como
un anexo del Hospital— con población, territorio, programas, presupuesto,
indicadores, brechas, evidencias y los ámbitos FURAG/MIPG y ADRES representados
estructuralmente desde el MVP (`docs/PRODUCT.md` §3.2 y §3.8-3.9).

## Historia de usuario principal

Como responsable en una alcaldía, quiero ver la población beneficiaria de mi
municipio, su distribución territorial y el estado de los programas, para tomar
decisiones y responder requerimientos institucionales sin pedir extractos a
terceros.

## Qué hace hoy el sistema

Shell propio (`MunicipalityShell.tsx`, `MunicipalitySidebar.tsx`,
`MunicipalityTopbar.tsx`) con estas vistas:

| Vista | Archivo | Origen de datos hoy |
|---|---|---|
| Inicio | `MunicipalityHome.tsx` | Configuración estática |
| Población | `MunicipalityPopulation.tsx` | **API** (spec 008) |
| Territorio | `MunicipalityTerritory.tsx` | **API** (spec 008) |
| Programas | `MunicipalityPrograms.tsx` + `MunicipalityProgramForm.tsx` | Configuración estática |
| Cuidadores | `MunicipalityCaregivers.tsx` | Configuración estática |
| Atención | `MunicipalityCare.tsx` | Configuración estática |
| Presupuesto | `MunicipalityBudget.tsx` + `MunicipalityFinancialDetails.tsx` | Configuración estática |
| Indicadores | `MunicipalityIndicators.tsx` | Configuración estática |
| Brechas | `MunicipalityGaps.tsx` | Configuración estática |
| Evidencias | `MunicipalityEvidence.tsx` | Configuración estática |
| FURAG | `MunicipalityFurag.tsx` | Configuración estática |
| ADRES | `MunicipalityAdres.tsx` | Configuración estática |
| Reportes | `MunicipalityReports.tsx` | Configuración estática |
| Próximamente | `MunicipalityComingSoon.tsx` | — |

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | App Next.js y ruta `/municipality` | Sin la app no hay shell |
| 002-experiencia-inscripcion-visual | Componentes de interfaz compartidos | Alcaldía y Hospital comparten piezas, no arquitectura duplicada |

**Dependencias externas:** ninguna en el momento de construirse. Población y
Territorio dependen hoy de la API y de PostgreSQL, por la spec 008.

**Specs que dependen de esta:** 008 conecta dos de sus vistas a la API.

## Escenarios de aceptación

1. Dado un municipio configurado, cuando se abre la experiencia Alcaldía,
   entonces los datos corresponden a ese municipio y no a un piloto codificado.
2. Dada una vista conectada, cuando la API devuelve agregados suprimidos por
   umbral, entonces la vista muestra la supresión en vez de inventar un número.
3. Dada una vista de FURAG, ADRES o evidencias, cuando se muestra, entonces **no**
   atribuye puntuaciones oficiales ni afirma integración viva con esas entidades.

## Criterios de aceptación (formato EARS recomendado)

- EL SISTEMA NO DEBERÁ atribuir puntuaciones, evaluaciones ni estados oficiales
  de FURAG, MIPG o ADRES que no hayan sido emitidos por la autoridad
  correspondiente (`CLAUDE.md` §5, `docs/PRODUCT.md` §3.8-3.9).
- CUANDO se muestre información de una vista no conectada, EL SISTEMA DEBERÁ
  evitar presentarla como procedente de una fuente oficial o de una integración
  activa.
- CUANDO una lectura agregada esté suprimida por umbral, EL SISTEMA DEBERÁ
  representar la supresión explícitamente.
- EL SISTEMA DEBERÁ ser configurable para múltiples municipios, sin valores de
  municipio piloto codificados (`docs/PRODUCT.md` §3.1).

## Ámbito de archivos / File scope

- `apps/web/src/features/municipality/` — vistas, configuración y pruebas
- `apps/web/src/app/municipality/page.tsx` — ruta de entrada

## Estado real y límites conocidos

**De 13 vistas con contenido, 2 consultan la API.** Las otras 11 se alimentan de
`municipalityConfig.ts`, que son **5.059 líneas**: el archivo más grande del
repositorio.

Los dominios que representan —presupuesto, ejecución, proveedores, indicadores,
brechas, evidencias documentales, FURAG/MIPG, ADRES— **no tienen ningún modelo en
`prisma/schema.prisma`**.

Esa presencia estructural es exigida por `CLAUDE.md` §5 y `docs/MODULES.md` §39:
representar el dominio no es opcional. Pero representar **no es implementar**, y
esta spec lo deja escrito para que ninguna lectura futura confunda una cosa con
la otra.

## Criterios de éxito

- Ninguna vista atribuye carácter oficial a información que no lo tiene.
- El municipio es configurable y no está codificado.
- La suite de `features/municipality` pasa.
