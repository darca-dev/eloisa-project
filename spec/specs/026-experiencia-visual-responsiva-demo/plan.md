# Plan 026 Experiencia visual responsiva para demo

## Resumen

Corregir la divergencia de recursos del servidor local y adaptar progresivamente las cuatro rutas autorizadas, sin rediseñar ni cambiar lógica.

## Fases de implementación

1. Verificar qué directorio/proceso sirve `127.0.0.1:3000` y la carga de marca.
2. Adaptar Portal Central e Inscripción/Paciente.
3. Adaptar shell y vistas densas de Hospital y Alcaldía por módulos.
4. Ejecutar pruebas y validación visual en los anchos objetivo.

## Dependencias

- Consentimiento SDD personal de la Product Owner para la spec 026.
- Servidor local alineado con esta rama.

## Hitos

- Portal Central e Inscripción utilizables a 360 px.
- Hospital y Alcaldía sin desbordamiento de página en móvil.
- Recursos de marca servidos correctamente.

## Riesgos

- Las tablas anchas pueden requerir desplazamiento local para no perder información.
- El `404` puede depender de cómo se inició el servidor y no del recurso versionado.
