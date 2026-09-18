# Contrato — Aceptación de la respuesta del worklist en el cliente Visitador

Reglas verificables que gobiernan cuándo el cliente
`apps/web/src/features/visitador/visitadorWorklistClient.ts` **acepta** el cuerpo
de `GET /api/v1/professional/visits?from&to` y cuándo lo **rechaza**.

Este contrato no describe el servidor: describe qué exige el cliente antes de
mostrar algo. El contrato del servidor es el de la spec 017 y no cambia.

## Vocabulario

- **Aceptar** — devolver `{ kind: 'ok', datos }` y mostrar la agenda.
- **Rechazar** — devolver `{ kind: 'no-disponible' }`: ninguna fila visible,
  copy de producto de servicio no disponible, opción de reintentar, sin datos de
  reserva y sin lenguaje técnico.
- **Ventana solicitada** — el par `{ from, to }` con el que el cliente construyó
  la consulta.

Rechazar es siempre sobre la **respuesta completa**. Nunca se omite una fila
defectuosa mostrando las demás: una lista parcial silenciosa es una afirmación
que el servidor no hizo.

## C1 — Campo `visit` de una fila

| Valor recibido | Significado | Resultado |
|---|---|---|
| `null` explícito | Cita todavía no materializada por la institución | **Aceptar** la fila, con `visit: null` |
| Propiedad **ausente** | La respuesta no cumple el contrato | **Rechazar** la respuesta completa |
| Objeto completo y válido | Visita materializada | **Aceptar** la fila con su visita |
| Objeto con `homeVisitId` vacío o ausente | Forma inválida | **Rechazar** |
| Objeto con `status` fuera de `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `NOT_COMPLETED` | Forma inválida | **Rechazar** |
| Objeto con `version` no numérica o no finita | Forma inválida | **Rechazar** |
| Objeto con `startedAt` o `endedAt` que no sean instante ni `null` | Forma inválida | **Rechazar** |
| Objeto sin `updatedAt` válido | Forma inválida | **Rechazar** |
| Valor no-objeto (`'x'`, `3`, `[]`) | Forma inválida | **Rechazar** |

**Invariante C1.** `null` y «ausente» **nunca** son equivalentes. `null` es una
afirmación del servidor; la ausencia es la falta de afirmación, y mostrarla como
`Pendiente de preparación por la institución` inventaría un estado
institucional.

## C2 — Ventana

| Situación | Momento | Resultado |
|---|---|---|
| `from` o `to` no son día `AAAA-MM-DD` real | Antes de la red | `solicitud-invalida`, sin petición |
| Ventana invertida (`from > to`) | Antes de la red | `solicitud-invalida`, sin petición |
| Ventana mayor de 31 días | Antes de la red | `solicitud-invalida`, sin petición |
| Ventana de exactamente 31 días | Antes de la red | Petición emitida |
| `window.from` o `window.to` devueltos no son día válido | Al normalizar | **Rechazar** |
| `window` devuelta distinta de la solicitada en `from`, en `to` o en ambos | Al normalizar | **Rechazar** |
| `window` devuelta idéntica a la solicitada | Al normalizar | **Aceptar** |

**Invariante C2.** La comparación es **literal** sobre las dos cadenas
`AAAA-MM-DD`. No hay tolerancia, normalización, redondeo ni reintento con otra
ventana. El servidor devuelve la ventana exactamente como se pidió
(spec 017, `professional-visit-worklist.service.ts:166-170`); si dejara de
hacerlo, es un cambio de contrato del servidor y una STOP CONDITION, no un motivo
para relajar el cliente.

## C3 — Lo que este contrato NO cambia

- El resto de la validación de fila: `appointmentId`, `scheduledStart`,
  `modality === 'HOME'` y el paciente minimizado a `displayName` e `initials`.
- El orden recibido del servidor, que se conserva tal cual.
- El descarte de campos no declarados en el contrato.
- La traducción de 400, 401, 403, 404, 409, 503, red, abort y cuerpo ilegible.
- El texto de producto de cada desenlace.
- La ausencia de identificadores opacos, `version`, rutas y códigos en el
  contenido visible.

## Verificación

Cada fila de C1 y C2 se corresponde con al menos una prueba en
`apps/web/src/features/visitador/visitadorWorklistClient.test.ts`. Las filas que
hoy ya se cumplen se conservan como regresión; las dos que no —«propiedad
ausente» en C1 y «ventana devuelta distinta» en C2— son el trabajo nuevo de esta
spec.
