# HOSPITAL-VISUAL-RECOVERY-01-C — Agenda

- **Estado:** READY FOR CLAUDE
- **Tiempo máximo:** 15 minutos
- **Objetivo:** recuperar la composición visual reconocible de Hospital → Agenda y citas, preservando íntegramente assignment, concurrencia optimista y materialización real de HomeVisit.

## Referencias vinculantes

1. Composición original: `prototype-claude/Eligeme-Hospital.dc.html`, bloque Agenda (aprox. líneas 204–295).
2. Decisiones funcionales: `TASK-HOSPITAL-CORE-02`, su corrección final, `HOSPITAL-VISITS-01-B` e implementación actual en `develop`.
3. Decisión Product Owner: estructura visual original + funcionalidad real actual + decisiones posteriores aprobadas.

El prototipo solo define jerarquía, densidad y agrupación; sus solicitudes, personas, pagos, conteos y estados no son datos autorizados.

## Alcance exacto

1. Mantener consulta real, ventana/escala, solicitudes, profesionales asignables, citas, conteos reales, estados carga/vacío/error y cancelación de respuestas tardías.
2. Recuperar visualmente el bloque de solicitudes como tarjetas densas y reconocibles: modalidad, paciente, fecha de solicitud y controles reales de profesional/fecha/hora.
3. Mantener `Asignar` con el mismo payload/controlador actual, bloqueo de doble envío, conservación ante conflicto y refresco posterior.
4. Conservar la estructura de calendario/conteos solo con valores devueltos por la respuesta real.
5. Recuperar las citas como filas/tarjetas densas con jerarquía clara de fecha/hora, paciente, profesional, modalidad y estado, únicamente cuando esos campos vengan servidos.
6. Agrupar acciones como en la referencia: `Asignar` operativa; `Reprogramar` y `Rechazar con motivo` visibles solo deshabilitadas, con copy neutral que no simule disponibilidad.
7. Para una cita `HOME + ASSIGNED`, conservar exactamente `Preparar visita domiciliaria`, su materialización institucional real, navegación a Visitas y estado resultante.
8. Mantener responsive, teclado, labels, regiones vivas y foco visible.

## Invariantes funcionales

- `Appointment`, `Patient`, `Professional`, `CareAssignment` y sesión institucional siguen siendo reales y tenant-scoped.
- `expectedVersion` permanece en lógica/payload interno y pruebas, pero nunca es visible.
- Los clientes, endpoints, DTO, filtros, reloj aprobado, reglas de assignment, manejo 400/401/403/404/409/503 y materialización no cambian.
- Cero fixture o fallback ante vacío, fallo o denegación.

## Prohibiciones

- No restaurar pagos, cobros, montos, solicitudes/nombres/profesionales ficticios, disponibilidad, conflictos, direcciones, origen, WhatsApp, perspectivas o métricas del prototipo.
- No mostrar IDs internos, `expectedVersion`, `CORE`, `API`, `backend`, `demo` o `fixture`.
- No habilitar Reprogramar/Rechazar ni añadir controladores/endpoints.
- No tocar Pacientes, Profesionales, Reportes, VISITS backend, Identity, shell, H-FID-C, `prototype-claude/**`, clientes, dependencias o datos.
- No Task adicional, commit o push.

## Allowlist exacta

- `apps/web/src/features/hospital/HospitalAgenda.tsx`
- `apps/web/src/features/hospital/hospitalAgendaConfig.ts`
- `apps/web/src/features/hospital/hospitalAgenda.module.css`
- `apps/web/src/features/hospital/hospitalAgenda.test.tsx`

`hospitalAgendaClient.ts`, `hospitalVisitsClient.ts`, Hospital shell y backend son solo lectura.

## Pruebas focales

Ejecutar únicamente:

```text
npx vitest run --root apps/web src/features/hospital/hospitalAgenda.test.tsx src/features/hospital/hospitalAgendaClient.test.ts src/features/hospital/hospitalOperaciones.test.tsx
npm run typecheck --workspace @merdn/web
npx eslint apps/web/src/features/hospital/HospitalAgenda.tsx apps/web/src/features/hospital/hospitalAgendaConfig.ts apps/web/src/features/hospital/hospitalAgenda.test.tsx
```

No ejecutar suites completas.

## Criterios de aceptación

1. Solicitudes y citas recuperan tarjetas/filas y jerarquía reconocibles usando solo DTO reales.
2. Assignment conserva `expectedVersion`, validación, doble-submit, conflicto y refresco sin cambio de lógica.
3. `HOME + ASSIGNED` conserva `Preparar visita domiciliaria` y el flujo real hacia HomeVisit.
4. Reprogramar/Rechazar permanecen claramente deshabilitadas y sin operación.
5. No reaparecen pagos, personas, métricas u otros datos del prototipo; no existe fallback.
6. Ningún texto renderizado contiene términos técnicos o IDs prohibidos.
7. Pruebas focales, typecheck y lint pasan.

## Evidencia de entrega

Claude debe devolver archivos cambiados, mapa dato visible → propiedad DTO, evidencia de invariantes assignment/Visits, comandos/resultados y confirmación de cero fixture/fallback/término prohibido. Detenerse si requiere ampliar la allowlist o modificar contratos.
