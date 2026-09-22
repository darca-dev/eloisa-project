# Plan 034 — Liquidaciones demo de Cuidador y Visitador

## Estrategia

1. Crear tipos y fixtures locales, sin identificadores personales, para el
   resumen y registros de liquidación de ambos roles.
2. Construir una vista compartida y accesible de solo lectura que recibe el rol
   y los datos locales como propiedades.
3. Crear el portal demo de Cuidador y montar la misma vista como pestaña real
   dentro de Profesional, preservando su hoja de ruta al cambiar de pestaña.
4. Comprobar que no existen red ni mutaciones y validar SDD/build.

## Dependencias

- Ruta existente `/profesional` y su navegación local.
- Sistema visual de la aplicación; no requiere backend, instituciones ni
  procesadores externos.

## Riesgos y mitigación

- Riesgo: que el término wallet sugiera custodia. Mitigación: denominar la
  capacidad «Mis pagos y liquidaciones» y declarar que no hay dinero real.
- Riesgo: exponer o inferir datos de pacientes. Mitigación: actividades
  genéricas sin nombres, ubicación, clínica ni referencias de terceros.
- Riesgo: duplicar componentes. Mitigación: un modelo y presentación
  compartidos, con contenedores mínimos por rol.
