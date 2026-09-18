# Investigación 002 - Experiencia de inscripción y paciente (visual)

Medido sobre `develop` el 2026-08-25.

## R1. Tamaño y forma

`apps/web/src/features/inscripcion/` contiene el flujo (`inscripcionFlow.ts`,
1.315 líneas), la experiencia (`InscripcionExperience.tsx`), tres archivos de
pasos por rol y `piezas.tsx` con los componentes compartidos.

## R2. Separación flujo / vista

`inscripcionFlow.ts` no importa React: la decisión de qué paso sigue y la
validación viven fuera del componente. Por eso se prueba sin jsdom
(`inscripcionFlow.test.ts`), igual que el resto del frontend de este repositorio.

## R3. Cobertura de pruebas

Archivos de prueba en el ámbito de esta spec: `inscripcionFlow.test.ts`,
`pantallas.test.tsx`, `envioInscripcion.test.ts`,
`patientEnrollmentClient.test.ts`, `paciente.test.tsx`, `bitacoraFlow.test.ts`,
`restauracionSesion.test.tsx`, `eliExpressions.test.ts`, `EliBubble.test.tsx`,
`divipola.test.ts`.

## R4. Catálogo territorial

`apps/web/src/data/divipola.ts` son 1.281 líneas de datos DIVIPOLA. Cumple la
decisión de producto de no construir alrededor de un municipio piloto
(`docs/PRODUCT.md` §3.1).

## R5. Lo que no persiste

`grep -E "^model" prisma/schema.prisma` no devuelve ningún modelo de bitácora,
entrada de diario ni registro de seguimiento del paciente. `bitacoraFlow.ts`
opera solo en memoria de la sesión.

## R6. Verificación no ejecutada

`node_modules` ausente: no se ejecutó la suite. Lo anterior es lectura de código.
