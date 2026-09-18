# Especificación 006 - Marca Eloísa e Isa

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specification: `tasks/TASK-BRAND-01-ELOISA-ISA.md`. Auditoría:
`reviews/REVIEW-BRAND-01-FINAL.md`. Congeladas. La fidelidad visual posterior del
shell Hospital corresponde a la spec 015.

## Objetivo

Que la identidad de marca —nombre visible, logotipo, tipografía, color y la
figura de Elí— viva en un único punto de configuración, de modo que un cambio de
nombre comercial no obligue a tocar decenas de componentes.

## Historia de usuario principal

Como Product Owner, quiero poder cambiar el nombre y la identidad visible del
producto sin reescribir la aplicación, porque el nombre comercial no está cerrado
(`docs/PRODUCT.md` §1).

## Qué hace hoy el sistema

- **Configuración central de marca** en `apps/web/src/config/branding.ts`, con
  prueba (`branding.test.tsx`).
- **Metadatos de la aplicación** derivados de esa configuración, con prueba
  (`app/brandingMetadata.test.ts`).
- **Componente de logotipo** `BrandLogo.tsx` con su módulo CSS.
- **Recurso de marca** `public/brand/corazon-check.png`.
- **Elí** como figura de acompañamiento (`Eli.tsx`, `eliExpressions.ts`, 7
  imágenes en `public/eli/`).
- **Tokens de diseño** en `src/styles/tokens.css`.

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | `layout.tsx` y metadatos de la app | La marca se aplica en el layout raíz |
| 002-experiencia-inscripcion-visual | Elí y los componentes de interfaz | Esta spec los consolida en configuración central |

**Dependencias externas:** ninguna.

**Decisión abierta que la condiciona:** el nombre comercial no está aprobado como
definitivo (`docs/PRODUCT.md` §1). La configuración central existe para que esa
decisión siga siendo reversible.

**Specs que dependen de esta:** 015 recupera la fidelidad del logotipo y la barra
superior del shell Hospital.

## Escenarios de aceptación

1. Dado un cambio en la configuración de marca, cuando se recarga la aplicación,
   entonces el nombre visible y los metadatos cambian sin tocar componentes.
2. Dado el logotipo, cuando se renderiza, entonces expone texto alternativo y no
   depende solo de la imagen para comunicar identidad.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se muestre el nombre del producto, EL SISTEMA DEBERÁ tomarlo de la
  configuración central de marca y no de literales dispersos.
- CUANDO se generen los metadatos del documento, EL SISTEMA DEBERÁ derivarlos de
  esa misma configuración.
- EL SISTEMA DEBERÁ proporcionar alternativa textual para todo recurso gráfico de
  marca (`CLAUDE.md` §7.14).
- EL SISTEMA NO DEBERÁ tratar el nombre comercial como definitivo sin aprobación
  del Product Owner (`docs/PRODUCT.md` §1).

## Ámbito de archivos / File scope

- `apps/web/src/config/branding.ts` — configuración central
- `apps/web/src/app/layout.tsx`, `brandingMetadata.test.ts` — metadatos
- `apps/web/src/components/ui/BrandLogo.tsx`, `brandLogo.module.css`
- `apps/web/src/components/ui/Eli.tsx`, `eliExpressions.ts`, `eli.module.css`
- `apps/web/src/styles/tokens.css` — tokens de diseño
- `apps/web/public/brand/`, `apps/web/public/eli/`

## Estado real y límites conocidos

- El nombre técnico de trabajo sigue siendo MERDN. «Elí» y «Elígeme» aparecen en
  el prototipo y en la marca visible. **No es una decisión de marca cerrada**
  (`docs/PRODUCT.md` §1).
- Elí es una figura de guía determinista de interfaz. No genera contenido
  clínico, diagnóstico ni recomendación (`CLAUDE.md` §7.13).

## Criterios de éxito

- El nombre visible procede de un solo archivo.
- `branding.test.tsx` y `brandingMetadata.test.ts` pasan.
