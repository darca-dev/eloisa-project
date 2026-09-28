# Especificación 032 — Agenda y citas: canvas demo local

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: `2026-09-22`
- Aprobado por / Approved by: `Product Owner`
- Evidencia de aprobación / Approval evidence: la Product Owner aprobó de forma
  explícita el consentimiento SDD para homologar Agenda y citas con el canvas
  dentro del modo demo local de solo lectura.

## Objetivo

Homologar la Agenda y citas de `/hospital` en modo demo local con la jerarquía
del canvas: solicitudes pendientes, calendario mensual, conteos y tarjeta de
estados. La operación real conectada debe quedar intacta.

## Alcance

- Solo `modoDemoLocal` monta una superficie de presentación separada.
- Debe mostrar cuatro solicitudes y un calendario mensual con datos ficticios
  deterministas, sin direcciones, pagos, alertas clínicas, datos reales ni
  entidades externas.
- Debe declarar datos ficticios locales y no ofrecer acciones persistentes.
- Fuera de demo continúa `HospitalAgenda`, sus permisos, asignación, consulta
  de API, materialización y comportamiento actuales sin cambios.

## Seguridad, datos y límites

- Cero red, cookies, almacenamiento, API, cambios de estado, auditoría de
  negocio o mutaciones desde la superficie demo.
- Estados son ejemplos visuales de flujo administrativo, no pagos, señales
  clínicas ni confirmaciones de atención.
- No se modifica `prototype-claude/`, backend, base de datos, Docker,
  autenticación, permisos ni integraciones.

## Accesibilidad

- Semántica de encabezados y listas; estados siempre en texto además de color.
- No botones engañosos ni controles inertes; la tabla/calendario debe conservar
  lectura comprensible a teclado y lector de pantalla.

## Archivos permitidos

- `apps/web/src/features/hospital/HospitalShell.tsx`
- `apps/web/src/features/hospital/HospitalAgendaDemo.tsx`
- `apps/web/src/features/hospital/hospitalAgendaCanvasDemo.ts`
- `apps/web/src/features/hospital/hospitalAgendaCanvasDemo.test.tsx`
- `apps/web/src/features/hospital/hospitalAgenda.module.css`
- `spec/specs/032-hospital-agenda-canvas-demo/**`
- `spec/specs/INDEX.md`
- `spec/.sdd/user-consent.log`

## Prohibido

- Cambiar `HospitalAgenda.tsx`, `hospitalAgendaClient.ts`, API, Prisma,
  PostgreSQL, cookies, sesiones, roles, autorizaciones, auditoría, Docker,
  `prototype-claude/`, `develop` o `main`.
- Acciones de asignar, reprogramar, rechazar, materializar, pagar, cancelar o
  persistir; datos reales, clínicos, geográficos precisos o institucionales.

## Criterios de aceptación

1. En `/hospital` demo, Agenda y citas reproduce las tres zonas principales
   del canvas con datos locales explícitamente ficticios.
2. Hay cuatro solicitudes ficticias y un calendario mensual; no hay red ni
   controles de escritura.
3. Fuera de demo se conserva la Agenda real actual.
4. Pruebas focalizadas, gate SDD, validación SDD y build web finalizan bien.
