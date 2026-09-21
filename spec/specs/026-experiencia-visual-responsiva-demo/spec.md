# Especificación 026 Experiencia visual responsiva para demo

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: `2026-09-17`
- Aprobado por / Approved by: `Product Owner`
- Evidencia de aprobación / Approval evidence: La Product Owner autorizó corregir recursos visuales y adaptar `/`, `/inscripcion`, `/hospital` y `/municipality` a móvil, preservando el diseño actual, sin alterar funcionalidades ni usar datos reales.

## Objetivo

Hacer utilizable la demo visual en teléfono, tableta y escritorio, preservando su línea visual y comportamiento existente.

## Alcance

- Corregir la carga visual de recursos de marca ya versionados.
- Adaptar Portal Central, Inscripción/Paciente, Hospital y Alcaldía a 360–430 px, tableta y escritorio.
- Ajustar pruebas de composición y accesibilidad afectadas.

## Fuera de alcance

- API, base de datos, autenticación, permisos, datos, rutas, reglas clínicas e integraciones.
- Datos personales o clínicos reales.
- Cualquier cambio a `prototype-claude/`.

## Seguridad y datos

No se crean datos, roles, permisos, sesiones ni eventos de negocio. Los cambios no deberán almacenar datos sensibles ni modificar cookies, contratos API o controles de acceso.

## Requisitos

1. Los recursos de marca locales deberán cargar sin `404` en el entorno que se valide.
2. A 360, 390 y 430 px el Portal Central deberá usar una columna, no desbordar horizontalmente y ofrecer controles táctiles de al menos 44 px.
3. Inscripción/Paciente deberá mantener foco visible, etiquetas, burbuja de Elí y composición sin recortes ni superposición.
4. Hospital y Alcaldía no deberán provocar desbordamiento horizontal de página. Los datos anchos conservarán un contenedor accesible de desplazamiento local o su adaptación local existente.
5. Teclado, lector de pantalla, foco y `prefers-reduced-motion` no deberán degradarse.
6. El comportamiento de negocio, las rutas y llamadas API deberán permanecer sin cambios.

## Ámbito de archivos

- `apps/web/src/app/layout.tsx`
- `apps/web/src/features/hub/`
- `apps/web/src/features/inscripcion/inscripcion.module.css`
- `apps/web/src/features/paciente/paciente.module.css`
- `apps/web/src/features/hospital/`
- `apps/web/src/features/municipality/`
- `apps/web/src/components/ui/`
- Pruebas web estrictamente relacionadas.
- `spec/specs/026-experiencia-visual-responsiva-demo/` y `spec/specs/INDEX.md`

## Archivos prohibidos

- `prototype-claude/`, `apps/api/`, `prisma/`, `packages/`, infraestructura, secretos y datos demo.

## Criterios de aceptación

1. En los anchos objetivo, las cuatro rutas no tienen controles truncados ni desplazamiento horizontal de página.
2. El navegador obtiene los recursos de marca usados por las rutas sin `404`.
3. El foco de teclado permanece visible y sigue un orden lógico.
4. Typecheck, lint y pruebas web aplicables pasan.

## Riesgos y dependencias

- `localhost:3000` podría servir una copia distinta del árbol de trabajo; debe comprobarse antes de atribuir el fallo del logo al código.
- La Product Owner debe registrar personalmente el consentimiento SDD de esta spec antes de modificar producción.
