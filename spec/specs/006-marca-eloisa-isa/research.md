# Investigación 006 - Marca Eloísa e Isa

Medido sobre `develop` el 2026-08-25.

## R1. Punto único de configuración

`apps/web/src/config/branding.ts` concentra la identidad. Tiene dos pruebas
asociadas: `branding.test.tsx` (el componente) y `app/brandingMetadata.test.ts`
(los metadatos del documento). Que los metadatos estén cubiertos por prueba es lo
que impide que el nombre se duplique en `layout.tsx`.

## R2. Recursos

`public/brand/corazon-check.png` y siete expresiones de Elí en `public/eli/`:
`agradece`, `escucha`, `explica`, `guia`, `motiva`, `pregunta`, `saluda2`.

`eliExpressions.ts` decide qué expresión corresponde a cada contexto, con prueba
propia (`eliExpressions.test.ts`), de modo que la elección no está codificada en
las vistas.

## R3. Tokens

`src/styles/tokens.css` centraliza color y tipografía. Los módulos CSS por
componente los consumen en vez de fijar valores.

## R4. Nombre no cerrado

`docs/PRODUCT.md` §1 dice literalmente que el nombre de marca no se considera
técnicamente final salvo aprobación expresa del Product Owner. Por eso la
configuración central no es una comodidad: es el mecanismo que hace reversible
esa decisión pendiente.

## R5. Verificación no ejecutada

`node_modules` ausente: no se ejecutaron las pruebas.
