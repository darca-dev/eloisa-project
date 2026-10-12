# Plan 042

## Estrategia

Conservar la entrega d0be21e y trabajar en chore/optimizar-pruebas-esenciales.
Reducir solo controles de presentación redundantes en cuatro suites, manteniendo
casos de comportamiento y riesgo. No alterar producto ni descubrimiento de tests.

## Hitos

1. Inventario web inicial y lista exacta de retiradas con razones.
2. Gate/consentimiento y revisión de criterios; modificar solo allowlist.
3. Retirar casos redundantes; compartir SSR determinista por props inmutables.
4. Suite web completa, tipos/lint/scanner y baseline PostgreSQL aislada.
5. Revisión independiente y reporte con resultados y límites.

## Dependencias

041 entregado, Vitest/TypeScript y runner aislado existentes. La publicación
remota depende de que PO indique destino accesible; no bloquea trabajo local.

## Riesgos y mitigación

Pérdida de cobertura única: lista explícita por caso y revisión. Cache de entrada
mutable: compartir solo SSR de props/fixtures fijos, no mocks ni servicios. Cifras
engañosas: separar reducción de casos de duración observada y no prometer tiempos.
