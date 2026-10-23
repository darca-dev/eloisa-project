# 055 / MP04–MP05 — Criterios individuales, alarmas automáticas, seguimiento y semáforo

Estado: **contrato redactado por Claude Code** por delegación expresa del Product Owner («termina el semáforo», «acceso total»), porque Codex no había cerrado este paquete. Se deriva solo de D03, D04, D05 y D07 aprobadas. **No sustituye la auditoría de Codex** y contiene una decisión que el Product Owner debe ratificar (§4, D04.5). Sin umbrales ni valores clínicos: todos los valores los fija el visitador competente.

Actualización de vigencia 2026-10-22: D04.5 fue ratificada en la decisión del PO del 2026-10-21. Las correcciones de procedencia, episodio, evidencia, semáforo y paginación se rigen por `MP07-CORRECCIONES-A01-A10.md`, autorizado después de la auditoría. Este documento conserva el diseño inicial para trazabilidad y no puede usarse para mantener las desviaciones allí identificadas.

## 1. Objetivo

Que la alarma automática dependa EXCLUSIVAMENTE de un criterio individual vigente, definido y validado por el profesional con MANAGE_RULES y competencia para ESE paciente, incluida la frecuencia. Que la evaluación sea síncrona y transaccional al recibir un registro (D07), produzca una alarma por episodio (D05) y que Hospital vea un semáforo accesible y conteos autorizados sin inventar verde.

## 2. Modelo (migración `20261021140000_care_alarm_criteria`)

- `CareAlarmCriterion`: identidad ESTABLE entre versiones, ligada al contexto (FK de cuatro campos), con estado ACTIVE o RETIRED, creador, retiro con actor y fecha del servidor.
- `CareAlarmCriterionVersion`: versión inmutable con:
  - `observableCode` (identidad del dato entre sus versiones) y `valueType` copiado de la definición vigente al validar;
  - comparación: EQ/NEQ/GT/GTE/LT/LTE para NUMBER, EQ para BOOLEAN, IN para CHOICE;
  - valor: decimal, booleano o lista de códigos de opción;
  - `requiredCount` de 1 a 1000 y `windowMinutes` de 1 a 525 600;
  - `severity` ROJA, AMARILLA o ESTABLE, elegida por el visitador;
  - `activatedAt` del servidor, `validUntil` opcional, validador y estado ACTIVE, SUPERSEDED o RETIRED.

  Una versión nueva reemplaza a la ACTIVE dentro de la misma transacción. Los límites son técnicos, no clínicos.
- `CareAlarmEvidence`: vínculo append-only entre alarma, observación y versión del criterio que la admitió. Única por (alarma, observación).
- `care_alarm`:
  - FK `criterionId` al criterio;
  - `criterionVersionId` y `previousAlarmId` (episodio anterior enlazado);
  - índice único parcial: UNA sola alarma AUTOMATIC no CERRADA por criterio. La base sostiene «una alarma por episodio» aunque el criterio cambie de versión.
- RLS + FORCE con políticas tenant + organización. El runtime tiene SELECT/INSERT, y UPDATE solo de las columnas de retiro o reemplazo. Sin DELETE. Append-only para versiones y evidencia.

## 3. Evaluación (D04, D05)

Se ejecuta DENTRO de la transacción que crea el registro, después del advisory lock del contexto. Para cada versión ACTIVE vigente del contexto cuyo `observableCode` coincide con una observación nueva:

1. **Admisibles**: observaciones canónicas (sin `canonicalObservationId`) del mismo código, con `occurredAt` dentro de `[recepción − ventana, recepción]` (ambos límites inclusivos), `occurredAt >= activatedAt` y, si existe, `< validUntil`. Cada `occurrenceKey` cuenta una vez. Un registro repetido o vinculado al mismo evento no suma.
2. **Valor efectivo**: el original, o el último reemplazo de una enmienda (§4).
3. **Excluye** las observaciones ya usadas como evidencia de una alarma de ese criterio: la evidencia de un episodio cerrado no vuelve a disparar.
4. Si los que coinciden son al menos `requiredCount`:
   - **Hay alarma abierta** (no CERRADA) del criterio: se agregan las coincidencias nuevas como evidencia; no se crea otra alarma.
   - **No la hay**: se crea una alarma AUTOMATIC, NUEVA, con la severidad del criterio, `previousAlarmId` del último episodio cerrado, transición CREATE atribuida al autor del registro que la desencadenó, y evidencia de las coincidencias. Se audita `CARE_ALARM_CREATED`.
5. Una observación tardía dentro de la ventana puede completar el criterio. Fuera de ella queda guardada, no dispara de forma retroactiva y la vía manual sigue disponible.
6. Sin criterio o sin datos, **nunca** se produce un verde.

## 4. Correcciones (D04.5) — RATIFICADA POR EL PO

Política adoptada, la más conservadora:
- las evaluaciones FUTURAS usan el valor efectivo vigente (el corregido, si lo hay);
- una enmienda NO dispara evaluación, NO crea, cierra ni rebaja una alarma ya emitida y NO retira evidencia;
- la evidencia de una alarma marca «corregida después — revisar» si su observación tiene enmiendas.

Si el Product Owner prefiere otra semántica (por ejemplo, reevaluar al enmendar), debe cambiarse con una versión nueva del motor, no en silencio.

## 5. Seguimiento y semáforo (MP05)

- Las transiciones de MP03 aplican igual a las automáticas. Resolver o cerrar exige motivo y competencia.
- **Semáforo por contexto** (sin agregar entre pacientes):
  - ROJO si hay alguna alarma abierta ROJA;
  - si no, AMARILLO si hay alguna AMARILLA;
  - si no, «PENDIENTE DE CLASIFICACIÓN» si hay alguna abierta sin severidad;
  - si no, «ESTABLE» solo si hay alguna alarma abierta con clasificación ESTABLE autorizada;
  - con criterios pero sin clasificación autorizada: «SIN EVALUACIÓN»; la ausencia de alarmas no determina estabilidad;
  - «SIN CRITERIOS NI SOLICITUDES» si no hay nada. Nunca «verde» por falta de evaluación.

  Siempre texto, nunca solo color.
- **Cola de revisión** `GET /api/v1/care/review-queue`: alarmas abiertas de todos los contextos donde la cuenta tiene REVIEW_ALARMS confirmado por MP01, con la etiqueta mínima del paciente, el semáforo del contexto y conteos por estado. Se audita como lectura del directorio.
- **Conteos autorizados**: solo para quien puede revisar, y solo de sus contextos.

## 6. HTTP

- `GET /api/v1/care/contexts/:contextId/criteria`: VIEW_RECORDS, REVIEW_ALARMS o MANAGE_RULES.
- `POST /api/v1/care/contexts/:contextId/criteria`: MANAGE_RULES con competencia. Idempotente; con `criterionId` crea una versión nueva del mismo criterio.
- `POST /api/v1/care/contexts/:contextId/criteria/:criterionId/retire`: MANAGE_RULES, con motivo.
- `GET /api/v1/care/contexts/:contextId/semaphore`: semáforo y conteos; REVIEW_ALARMS, VIEW_RECORDS o MANAGE_RULES.
- `GET /api/v1/care/review-queue`: §5.
- El detalle de alarma añade la evidencia: dato, valor efectivo, ocurrencia y marca de corrección.

## 7. Fuera de alcance

Worker/outbox, WhatsApp, correo, Elí, escalamiento por reloj, condiciones compuestas, fórmulas, catálogos clínicos reales y uso con pacientes reales. Requieren aprobación separada.

## 8. Pruebas

- Unitarias del evaluador puro: ventana inclusiva, futuro, activación, `validUntil`, deduplicación por ocurrencia, canónica, valor efectivo, evidencia consumida y comparadores.
- API contra PostgreSQL aislado: solo MANAGE_RULES con competencia define; sin criterio no hay alarma; cumplir N dispara una vez; una coincidencia más con el episodio abierto agrega evidencia; tras cerrar, solo un nuevo conteo completo abre un episodio enlazado; una enmienda no crea ni cierra; el índice parcial impide dos abiertas; semáforo sin datos ≠ verde; cola de revisión sin contextos ajenos.
