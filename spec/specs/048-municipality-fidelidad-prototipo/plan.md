# Plan 048

## Hitos

1. Inspeccionar HTML de referencia y renderizar copia de lectura; registrar autorización, respaldar fuentes, pasar gate.
2. Reutilizar composición/tokens/Sidebar/Profile existentes para marco e Inicio operativos; pasar nombre de sesión sin alterar gate.
3. Validar estados reales, privacidad, navegación y accesibilidad; construir y aplicar solo web.
4. E2E, comparación visual y revisión focal independiente; documentar diferencias de datos/funcionalidad pendientes.

## Dependencias

Prototipo de solo lectura, Nunito/tokens/componentes existentes, API actual y cuenta municipal de prueba ya autorizada.

## Riesgos

Reintroducir fixtures al reutilizar componentes de demo, presentar ausencias como ceros, duplicar conteos o exponer cifras pequeñas. Usar solo componentes visuales sin datos de demo, cuatro display de API sin cálculos, estados explícitos y pruebas semánticas. Menú móvil sin duplicar navegación, foco y Escape comprobados.
