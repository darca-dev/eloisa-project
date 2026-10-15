# Plan 045

## Hitos

1. Preservar estado anterior y pasar gate con instrucción PO registrada.
2. Rediseñar navegación/marco/indicadores/acciones usando misma API y marca.
3. Tipos/suite web/lint; reconstruir solo web y aplicar preservando configuración.
4. E2E real y revisión visual de escritorio/tablet/móvil; revisión independiente.

Dependencias: cuenta de prueba autorizada ya existente, API actual, iconos/assets
versionados. Sin fuentes externas ni nuevos componentes de infraestructura.
Riesgos: foco perdido al cerrar menú, degradación de contraste o cifras falsas;
mitigar con disclosure semántico, foco explícito y comparación UI/API.
