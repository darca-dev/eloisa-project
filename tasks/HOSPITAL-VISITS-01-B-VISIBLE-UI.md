# HOSPITAL-VISITS-01 — Packet B: Visible UI Integration

## Identificación

- **Estado:** `READY FOR CLAUDE`
- **Tiempo máximo:** 15 minutos.
- **Objetivo:** conectar Agenda y la vista existente de Visitas al cliente real, sin rediseñar Hospital.
- **Dependencias:** VISITS MP04 y HOSPITAL-VISITS-01-A.

No backend, H-FID-C, Reportes, prototype ni datos inventados.

## Flujo visible mínimo

1. En la lista real de Agenda, reconocer exclusivamente citas con
   `modality = HOME` y `status = ASSIGNED`.
2. Mostrar una acción textual accesible para preparar/materializar la visita.
3. Invocar `materializarVisita(appointmentId)`; nunca enviar otros IDs.
4. Al éxito, transportar el DTO real en estado efímero de `HospitalShell`,
   navegar a la vista existente `visitas` y mostrar estado `Programada`.
5. `HospitalHomeVisits` deja de renderizar `hospitalVisitasDemo` como fallback.
   Sin visita real seleccionada muestra un estado vacío honesto.
6. Consultar `consultarVisitaProfesional(homeVisitId)` para refrescar estado y
   versión. Solo si responde `ok` existen acciones profesionales.
7. Acciones por estado:
   - `SCHEDULED`: Iniciar; No completada.
   - `IN_PROGRESS`: Completar; No completada.
   - terminal: ninguna acción.
8. Después de `cambiarEstadoVisita`, consultar de nuevo la visita y reemplazar
   el estado visible. Ante conflicto, refrescar antes de permitir reintento.

Etiquetas exactas de estado:

- `SCHEDULED` → `Programada`
- `IN_PROGRESS` → `En curso`
- `COMPLETED` → `Completada`
- `NOT_COMPLETED` → `No completada`

No mostrar versión, IDs, códigos HTTP/técnicos, paciente, profesional,
dirección, zona, horario ni cualquier dato que MP04 no devuelve.

## Separación de sesiones obligatoria

Materializar usa la sesión institucional. Consultar/transicionar usa la sesión
humana profesional. No inferir una de la otra.

Si la consulta profesional devuelve `sin-sesion`, mostrar:

`Para iniciar o cerrar esta visita hace falta una sesión personal profesional vigente.`

Conservar el estado `Programada` recibido al materializar, pero no mostrar
acciones profesionales. `sin-permiso`/`no-encontrado` tampoco muestran acciones.
No crear login profesional ni bypass en este packet.

## Estados y accesibilidad

- carga, vacío, éxito, error y reintento;
- bloquear doble envío durante cada mutación;
- abortar consultas al desmontar/cambiar de visita;
- región `aria-live`/alert para desenlaces;
- botones con texto visible y foco normal;
- mensajes 401/403/404/409/503 mediante `mensajeDeVisita`, sin códigos;
- cero fallback demo y cero datos previos después de fallo de autorización.

## Allowlist exacta

- `apps/web/src/features/hospital/HospitalAgenda.tsx`;
- `apps/web/src/features/hospital/HospitalHomeVisits.tsx`;
- `apps/web/src/features/hospital/HospitalShell.tsx`;
- `apps/web/src/features/hospital/hospitalAgenda.test.tsx`;
- `apps/web/src/features/hospital/hospitalOperaciones.test.tsx`;
- `apps/web/src/features/hospital/hospitalShell.test.tsx`;
- `apps/web/src/features/hospital/hospitalAlcance.test.ts` — solo corregir el
  texto heredado “CUATRO clientes” a cinco si aparece en una aserción/comentario.

Reutilizar estilos y componentes existentes; no modificar CSS ni config demo.
`hospitalVisitsConfig.ts` puede permanecer para referencias no conectadas, pero
la vista conectada no lo importa ni lo usa.

## Pruebas focales

Desde la raíz, usando el root correcto ya comprobado:

```text
npx vitest run --root apps/web src/features/hospital/hospitalAgenda.test.tsx src/features/hospital/hospitalOperaciones.test.tsx src/features/hospital/hospitalShell.test.tsx src/features/hospital/hospitalAlcance.test.ts
```

Cubrir solo: HOME+ASSIGNED visible; otras citas sin acción; éxito de
materialización y navegación; vacío sin demo; etiquetas reales; acciones por
estado; refresh tras mutación/conflicto; separación de cookies/sesiones;
acciones ausentes sin sesión profesional; errores de producto; doble envío,
abort y accesibilidad.

No ejecutar suites completas ni pruebas visuales.

## STOP

Detenerse si hace falta backend, mostrar IDs, inventar listado/datos, modificar
autenticación o conceder acciones profesionales desde sesión institucional.

## Handoff

Claude devuelve archivos cambiados, comando/resultado focal y confirma cero
fallback demo, cero bypass de sesión, cero backend/Reportes/H-FID-C.

