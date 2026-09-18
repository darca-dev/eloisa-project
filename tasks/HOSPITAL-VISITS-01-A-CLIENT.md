# HOSPITAL-VISITS-01 — Packet A: API Client

## Identificación

- **Estado:** `READY FOR CLAUDE`
- **Tiempo máximo:** 15 minutos.
- **Objetivo:** añadir el cliente web tipado que conecta Hospital con las tres operaciones reales de VISITS MP04.

Este primer packet no modifica componentes. Prepara la conexión mínima para
que el packet B sustituya datos demo y añada acciones sin reimplementar HTTP.

## Contexto a reutilizar

Seguir el patrón de `hospitalAgendaClient.ts`, `hospitalPatientsClient.ts` y
`hospitalProfessionalsClient.ts`:

- `resolvePublicApiBaseUrl()`;
- `credentials: 'include'`;
- `cache: 'no-store'`;
- `AbortSignal` y desenlace `cancelado`;
- funciones que no lanzan errores de red al componente;
- DTOs minimizados y discriminated unions de resultado.

No copiar fixtures de `hospitalVisitsConfig.ts` ni usarlos como fallback.

## Operaciones exactas

Crear `hospitalVisitsClient.ts` con:

1. materializar por `appointmentId` mediante
   `POST /api/v1/visits/materialize`;
2. consultar una visita profesional por `visitId` mediante
   `GET /api/v1/professional/visits/:visitId`;
3. cambiar estado mediante
   `PATCH /api/v1/professional/visits/:visitId/status`, enviando únicamente
   `status` y `expectedVersion`.

No aceptar ni enviar `tenantId`, `patientId`, `professionalId`, actor, rol,
timestamps, notas o datos clínicos.

Mapear explícitamente:

- `400` → solicitud inválida;
- `401` → sesión requerida;
- `403` → permiso insuficiente;
- `404` → visita/cita no disponible, sin confirmar existencia;
- `409` → estado cambiado/conflicto; la UI deberá refrescar;
- `503` y otros fallos → servicio no disponible;
- aborto → cancelado.

Los textos de producto deben quedar centralizados en el cliente o en helpers
puros exportados, sin exponer códigos técnicos al componente.

## Allowlist exacta

- nuevo `apps/web/src/features/hospital/hospitalVisitsClient.ts`;
- nuevo `apps/web/src/features/hospital/hospitalVisitsClient.test.ts`;
- `apps/web/src/features/hospital/hospitalAlcance.test.ts` — únicamente añadir
  el quinto cliente permitido a la allowlist exacta.

No modificar componentes, CSS, config demo, Shell, Agenda, backend, prototype,
Reportes ni dependencias.

## Pruebas focales

Desde la raíz:

```text
npx vitest run --config apps/web/vitest.config.mts apps/web/src/features/hospital/hospitalVisitsClient.test.ts
npx vitest run --config apps/web/vitest.config.mts apps/web/src/features/hospital/hospitalAlcance.test.ts
```

Cubrir únicamente rutas/métodos/body exactos; credentials/no-store; DTOs de
éxito; 400/401/403/404/409/503; red; aborto; JSON inválido; ausencia de campos
de autoridad y cero fallback demo.

No ejecutar suites completas ni pruebas visuales.

## STOP

Detenerse si el cliente requiere modificar backend, inventar listado, aceptar
IDs de autoridad adicionales o usar datos demo como respuesta.

## Handoff

Claude devuelve tres archivos cambiados, comandos/resultados focales y confirma
que no tocó componentes, CSS, backend, prototype ni Reportes.

