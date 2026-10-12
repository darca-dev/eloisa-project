# Investigación 042

## Comportamiento actual

Medición con Vitest JSON: 1918 casos web en 72 archivos. Cuatro suites heredadas
de presentación suman 291 casos: Finanzas 80, Administración 75, Reportes vista
48 y Programas municipales 88. Repiten renders SSR del mismo estado, recorridos
de otros módulos ya cubiertos y comparaciones literales de catálogos/fixtures/CSS.
No ejecutan efectos ni interacciones del navegador; no tratarlos como E2E.

## Alternativas

Reducir discovery por carpetas ocultaría regresiones; prohibido. Agrupar todos
los assertions en pocos tests solo maquillaría conteos; descartado. Retirar casos
sin señal funcional y compartir fixtures SSR inmutables permite menos redundancia
manteniendo validación, privacidad, estados y semántica accesible.

## Decisión y límites

Allowlist de cuatro suites. Lista de retiradas exacta revisable en
docs/OPTIMIZACION-PRUEBAS.md. No modificar tests de autenticación, recuperación,
servidor, RLS, carreras, auditoría ni E2E. Medir resultados con mismo comando web;
duración observada no demuestra una mejora garantizada. No afirmar auditadas las
otras 68 suites. Revisión independiente obligatoria antes de cerrar.
