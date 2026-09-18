# MERDN Task Specification — VISITS-CORE-01

## 1. Identificación y gate

- **Task ID:** `VISITS-CORE-01`
- **Título:** Núcleo compartido del ciclo mínimo de visita domiciliaria
- **Estado:** `DESIGN COMPLETE — IMPLEMENTATION BLOCKED`
- **Prioridad:** siguiente shared core después de `TASK-HOSPITAL-CORE-02`
- **Precedencia validada:** `TASK-HOSPITAL-CORE-02`
- **Precedencia faltante:** identidad humana y relaciones/delegaciones compartidas

Este documento define el dominio compartido y sus límites. **No autoriza a Claude Code a implementar todavía.**

## 2. Objetivo

Implementar una sola capacidad transversal de visita domiciliaria que reutilice:

- `Appointment` como única agenda;
- `CareAssignment` como única asignación profesional-paciente;
- `ProfessionalProfile` como participación profesional de `Person`;
- `Person` y `Patient` canónicos;
- identidad/sesión aprobadas;
- tenant, RLS y auditoría existentes.

La misma visita debe ser consumible después por Hospital, Visitador/Profesional, Paciente y Cuidador mediante permisos y adaptadores distintos. No habrá cuatro modelos, cuatro calendarios ni cuatro copias de la visita.

## 3. Bloqueo arquitectónico comprobado

### Hechos

1. `HOSPITAL_SCHEDULER` es una identidad institucional compartida y opaca; no identifica a una persona trabajadora y no está vinculada a `ProfessionalProfile`.
2. `EnrollmentSession` identifica una inscripción/paciente temporal, pero no es todavía una cuenta personal durable con el contrato de principal común necesario para un módulo multi-actor.
3. No existen `CaregiverProfile`, relación Paciente–Cuidador, delegación, alcance, consentimiento ni sesión Cuidador en producción.
4. No existen vistas productivas Profesional/Visitador o Cuidador; solo prototipos read-only.

### Consecuencia

No puede atribuirse `IN_PROGRESS`, `COMPLETED` o `NOT_COMPLETED` al profesional seleccionado usando la cookie Scheduler. Eso falsearía la autoría. Tampoco puede permitirse consulta/aporte Cuidador aceptando un `patientId` del navegador, ni convertir la sesión de inscripción en autorización durable sin una decisión explícita.

### Alternativas evaluadas

- **Usar `HOSPITAL_SCHEDULER` como Visitador:** rechazada; identidad compartida, sin atribución humana ni vínculo a `ProfessionalProfile`.
- **Crear autenticación Profesional/Cuidador dentro de Visits:** rechazada; mezclaría identidad, relaciones y dominio de visita en una Task y obligaría a Claude a decidir arquitectura.
- **Implementar solo Hospital y llamar al resultado “ciclo compartido”:** rechazada para el objetivo solicitado; no ejecutaría el Visitador ni sostendría permisos de Paciente/Cuidador.
- **Prerequisito común de identidad/relaciones y luego una implementación única de Visits:** recomendada.

## 4. Decisión requerida antes de implementación

Debe aprobarse y validarse un shared core previo que proporcione, como mínimo:

1. principal humano autenticado y sesión revocable vinculada a `Person`;
2. vínculo server-side principal → `ProfessionalProfile` para profesional/visitador;
3. vínculo server-side principal → `Patient` para paciente;
4. perfil/relación Paciente–Cuidador con institución, alcance, finalidad, estado y vigencia;
5. permisos explícitos `visits.view`, `visits.execute` y, si se aprueba, `visits.contribute`;
6. auditoría capaz de identificar al actor humano opaco sin guardar nombres ni usar el profesional seleccionado como actor;
7. matriz de convivencia con `InstitutionalIdentity`, `InstitutionalSession` y `EnrollmentSession`, sin reutilizar cookies entre clases de principal de forma ambigua.

Nombre recomendado del prerequisito: `IDENTITY-RELATIONSHIPS-CORE-01`. Su arquitectura y alcance requieren aprobación separada del Product Owner.

## 5. Modelo compartido mínimo aprobado en diseño

### 5.1 Reutilización obligatoria

- No crear `VisitAppointment`, `VisitPatient`, `VisitProfessional`, `HospitalVisitAssignment` ni copias de persona.
- `Appointment` sigue siendo la única fuente de modalidad, horario y estado de agenda.
- `CareAssignment` sigue siendo la única fuente del profesional asignado.
- `ProfessionalProfile → Person` y `Patient → Person` siguen resolviendo identidades mostrables.
- Una visita nunca acepta `tenantId`, `patientId`, `professionalId`, actor ni rol desde el body para decidir su pertenencia o autoría.

### 5.2 `HomeVisit`

Modelo propuesto:

- `id UUID`
- `tenantId UUID`
- `appointmentId UUID`
- `patientId UUID`
- `careAssignmentId UUID`
- `status HomeVisitStatus`
- `version Int @default(1)`
- `startedAt DateTime?`
- `endedAt DateTime?`
- `createdByInstitutionalIdentityId UUID`
- `createdAt`, `updatedAt`

Invariantes:

1. único `(appointmentId, tenantId)`;
2. FKs compuestas tenant-aware a `Appointment`, `Patient`, `CareAssignment` e identidad creadora;
3. solo puede originarse desde `Appointment.modality = HOME` y `Appointment.status = ASSIGNED`;
4. la cita debe tener `careAssignmentId`, y esa asignación debe estar `ACTIVE`, pertenecer al mismo paciente y tenant;
5. el profesional se deriva de `CareAssignment`; no se duplica en `HomeVisit`;
6. el horario se obtiene de `Appointment.scheduledStart`; no se crea una segunda agenda;
7. no persiste nombre, documento, dirección, zona, diagnóstico, motivo, contacto, pago, alerta, cuidador, GPS, firma, archivo ni nota clínica.

`createdByInstitutionalIdentityId` identifica únicamente quién materializó administrativamente la visita al asignar la cita. No representa al Visitador que la ejecuta.

### 5.3 `HomeVisitTransition`

Historial append-only propuesto:

- `id UUID`
- `tenantId UUID`
- `homeVisitId UUID`
- `fromStatus HomeVisitStatus?`
- `toStatus HomeVisitStatus`
- `performedByPrincipalId UUID` — FK al principal humano que debe aportar el prerequisito
- `occurredAt` server-side
- `createdAt`

Debe haber exactamente un transition de creación `null → SCHEDULED`. Las transiciones posteriores se insertan en la misma transacción que el cambio de estado y el `AuditEvent`.

No se autoriza un actor polimórfico sin integridad referencial ni `professionalId` recibido desde UI como sustituto del principal.

### 5.4 Evidencia operativa mínima

En esta Task, evidencia significa exclusivamente:

- estado anterior/nuevo;
- versión anterior/nueva;
- timestamps fijados por servidor;
- actor autenticado opaco;
- relación con visita/cita/asignación;
- evento de auditoría.

Quedan fuera: texto libre, motivo clínico, signos vitales, diagnóstico, conducta, educación, firma, foto, audio, ubicación, ruta, tracking, biometría, documentos y calificación.

Un motivo controlado para `NOT_COMPLETED` requiere catálogo y responsabilidad operativa aprobados; hasta entonces no se persiste motivo.

## 6. Estados y transiciones

```text
Appointment HOME + ASSIGNED
           │
           ▼
       SCHEDULED
        │      │
        │      └──────────────► NOT_COMPLETED
        ▼
    IN_PROGRESS
        │      │
        │      └──────────────► NOT_COMPLETED
        ▼
     COMPLETED
```

Reglas:

- `SCHEDULED → IN_PROGRESS`
- `SCHEDULED → NOT_COMPLETED`
- `IN_PROGRESS → COMPLETED`
- `IN_PROGRESS → NOT_COMPLETED`
- `COMPLETED` y `NOT_COMPLETED` son terminales e inmutables.
- Prohibidos saltos, reapertura, reversión, borrado y corrección silenciosa.
- `startedAt` se fija al entrar en `IN_PROGRESS`.
- `endedAt` se fija al entrar en un estado terminal.
- Cada transición exige `expectedVersion`; actualización condicional e incremento atómico. Carrera: exactamente una gana, la otra recibe `409`.
- No incluir `EN_ROUTE`/`ARRIVED`: implican despacho, ubicación o reglas operativas aún no aprobadas.
- No incluir `CANCELLED`: la cancelación pertenece a Agenda y no está implementada por CORE-02.

## 7. Responsabilidades por actor

### 7.1 Hospital

Con `HOSPITAL_SCHEDULER`:

- materializa automáticamente `HomeVisit(SCHEDULED)` dentro de la misma transacción que asigna una `Appointment HOME`;
- consulta listado/detalle operativo minimizado de visitas del tenant;
- filtra por ventana, estado, profesional o paciente mediante IDs/criterios permitidos server-side;
- ve horario, paciente/profesional minimizados y estado.

No puede iniciar, completar ni marcar no realizada una visita. No puede actuar como Visitador ni acceder a clínica/dirección por implicación.

### 7.2 Visitador/Profesional

Con principal humano individual vinculado server-side al mismo `ProfessionalProfile`:

- lista solo visitas cuya `CareAssignment` activa corresponde a su perfil y afiliación vigente;
- consulta detalle operativo mínimo;
- ejecuta únicamente las transiciones permitidas;
- no selecciona `professionalId`, paciente ni actor desde el navegador;
- no accede a otros pacientes, profesionales o tenants.

“Visitador domiciliario” es una función/asignación del profesional asistencial, no un segundo perfil de persona ni un rol técnico global.

### 7.3 Paciente

Con principal humano durable vinculado al `Patient`:

- consulta exclusivamente sus propias visitas;
- ve institución, horario, profesional mostrable, estado y timestamps permitidos;
- no ve auditoría interna, asignaciones de otros pacientes ni datos internos del profesional;
- no cambia el estado profesional de ejecución.

La futura capacidad de confirmar logística debe especificarse separadamente; no se infiere de “ser paciente”.

### 7.4 Cuidador

Solo con relación Paciente–Cuidador activa, institución/finalidad vigentes y scope explícito:

- `visits.view`: consulta las visitas del paciente relacionado;
- `visits.contribute`: podría aportar información logística no clínica mediante eventos append-only separados, si el Product Owner aprueba catálogo, retención y visibilidad.

Nunca puede iniciar/completar una visita ni aportar como si fuera el profesional. Sin catálogo aprobado de contribuciones, `visits.contribute` permanece denegado y no existe endpoint de escritura.

## 8. APIs compartidas objetivo

El módulo debe vivir en `apps/api/src/visits/`, no bajo `hospital/`. Un servicio de dominio único aplica transiciones; controladores/guards adaptan cada principal.

### Hospital

- `GET /api/v1/visits?from&to&status&professionalId&patientId&page&pageSize`
- `GET /api/v1/visits/:visitId`

La creación no usa un segundo formulario: la mutación CORE-02 de asignación crea la visita atómicamente solo para modalidad `HOME`. `ON_SITE` y `VIRTUAL` no crean `HomeVisit`.

### Profesional

- `GET /api/v1/professional/visits?from&to&status&page&pageSize`
- `GET /api/v1/professional/visits/:visitId`
- `PATCH /api/v1/professional/visits/:visitId/status`

Body exacto:

```json
{
  "status": "IN_PROGRESS | COMPLETED | NOT_COMPLETED",
  "expectedVersion": 1
}
```

### Paciente

- `GET /api/v1/patient/visits?from&to&status&page&pageSize`
- `GET /api/v1/patient/visits/:visitId`

No acepta `patientId`; lo obtiene del principal.

### Cuidador

- `GET /api/v1/caregiver/patients/:patientId/visits`
- `GET /api/v1/caregiver/patients/:patientId/visits/:visitId`

El `patientId` solo selecciona entre relaciones ya autorizadas del principal. Sin relación vigente, respuesta uniforme sin confirmar existencia.

No se autoriza POST de contribución en esta Task mientras no exista catálogo aprobado.

### Contratos comunes

- DTO explícitos y minimizados; nunca objetos Prisma.
- Queries allowlist; repetidos/desconocidos/malformados → `400`.
- Rango máximo de fechas: 31 días.
- IDs opacos UUID.
- `401` sin principal válido; `403` sin permiso; `404` uniforme para recurso inexistente/no relacionado/cross-tenant; `409` para versión o transición; `503` fail-closed.
- `Cache-Control: private, no-store`, `Pragma: no-cache`, `Vary: Cookie`.
- CSRF/origen aprobado en PATCH.

## 9. RBAC y aislamiento

Matriz objetivo:

| Capacidad | Scheduler Hospital | Profesional asignado | Paciente propio | Cuidador relacionado |
|---|---:|---:|---:|---:|
| Crear desde cita HOME asignada | Automático | No | No | No |
| Listar/ver | Tenant minimizado | Solo asignadas | Solo propias | Solo relación + scope |
| Iniciar | No | Sí | No | No |
| Completar/no realizada | No | Sí | No | No |
| Aportar logística | No | No en v1 | No en v1 | No hasta catálogo aprobado |
| Clínica/dirección/GPS/archivos | No | No | No | No |

Todas las tablas nuevas:

- `tenantId NOT NULL`;
- FKs/uniques compuestas tenant-aware;
- RLS `ENABLE` + `FORCE`, `USING`/`WITH CHECK` por tenant;
- grants mínimos para runtime; sin `DELETE`;
- `withTenant(principal.tenantId)` y filtro explícito en toda consulta/mutación;
- contexto ausente/incorrecto o pool contaminado falla cerrado;
- IDs cross-tenant responden igual que inexistentes.

El guard profesional exige además principal → `ProfessionalProfile`, perfil y afiliación activos, `CareAssignment` activa y coincidencia con la visita. El guard Cuidador exige relación, scope, institución/finalidad y vigencia. UI o ruta nunca conceden permiso.

## 10. Auditoría

Eventos mínimos propuestos:

- `HOME_VISIT_CREATED`
- `HOME_VISIT_LIST_ACCESS_GRANTED`
- `HOME_VISIT_DETAIL_ACCESS_GRANTED`
- `HOME_VISIT_STARTED`
- `HOME_VISIT_COMPLETED`
- `HOME_VISIT_NOT_COMPLETED`
- `HOME_VISIT_ACCESS_DENIED`

Creación/transición, `HomeVisitTransition` y auditoría se confirman en una transacción; fallo de auditoría revierte la mutación. Registrar actor opaco, rol/capacidad, tenant, recurso, estado/versión anterior y nueva mediante campos estructurados aprobados, endpoint, outcome, correlation ID y timestamp. No registrar nombres, dirección, body, query, notas, secretos, GPS ni datos clínicos.

Denegaciones siguen el patrón best-effort aprobado cuando fallar cerrado generaría oráculo/DoS.

## 11. Experiencias y fixtures

### Hospital

Una vez desbloqueado, conectar la vista existente `HospitalHomeVisits` sin rediseño:

- reemplazar `hospitalVisitasDemo.estados` y `.visitas` por API;
- retirar del runtime chips factuales `Fecha: hoy` y `Municipio: Soacha` si no se derivan;
- conteos calculados por servidor sobre la misma ventana;
- estados carga, vacío, sin resultados, 401/403/503 y reintento;
- sin fallback demo.

`hospitalVisitasDemo` puede permanecer para consumidores demostrativos fuera del árbol conectado; no borrarlo transversalmente.

### Profesional, Paciente y Cuidador

No crear sus interfaces productivas dentro de esta Task hasta validar el prerequisito de identidad/relaciones. Los prototipos son referencia read-only. Cuando se autoricen adaptadores, deben consumir el mismo servicio/API y no recrear dominio.

No trasladar del prototipo: historia clínica, signos, diagnóstico, conducta, educación, firma, calificación, GPS, rutas, pagos, alertas ni evidencia documental.

## 12. Allowlist prevista después del desbloqueo

Esta lista documenta el límite futuro; **no autoriza edición mientras el gate de §4 siga abierto**.

### Datos

- `prisma/schema.prisma`
- una migración `prisma/migrations/<timestamp>_visits_core_01/migration.sql`
- `prisma/migrations/ROLLBACK-visits_core_01.sql`

### API compartida

- nuevos archivos exclusivamente en `apps/api/src/visits/**`
- `apps/api/src/app.module.ts`
- `apps/api/src/audit/audit.service.ts`, solo extensión estructurada imprescindible
- `apps/api/src/openapi/openapi.ts`
- `apps/api/test/openapi.test.ts`
- nuevos `apps/api/test/visits-core-01-fixtures.ts`, `visits.api.test.ts`, `visits.db.test.ts`
- `apps/api/src/hospital/hospital-appointment-assignment.service.ts` y su prueba, exclusivamente para crear `HomeVisit` atómicamente al asignar una cita HOME

### Web Hospital

- `HospitalHomeVisits.tsx`
- `hospitalVisitsConfig.ts`
- `hospitalVisits.module.css`
- nuevo `hospitalVisitsClient.ts` y prueba
- `hospitalOperaciones.test.tsx`, solo bloque de Visitas
- `HospitalShell.tsx` y prueba, solo inyección del cliente
- `hospitalAlcance.test.ts`, solo allowlist exacta del quinto cliente

### Dependencia de identidad

Los archivos de identidad/relaciones no se incluirán silenciosamente aquí. Deben pertenecer al prerequisito aprobado o a una revisión explícita de esta allowlist.

## 13. Archivos y acciones prohibidos

- `prototype-claude/**`
- reescribir migraciones CORE-01/CORE-02
- duplicar o alterar semántica de `Person`, `Patient`, `Appointment`, `CareAssignment` o `ProfessionalProfile`
- vistas/configs de Agenda, Pacientes o Profesionales salvo la integración atómica expresamente permitida en assignment service
- Virtuales, Finanzas, Reportes, Alertas, Membresías, Alcaldía
- clínica, dirección, GPS, archivos, firma, calificaciones, pagos o notificaciones
- dependencias, infraestructura, secretos, commit, push, merge o deploy

## 14. Pruebas obligatorias después del desbloqueo

### Dominio/DB

- solo `HOME + ASSIGNED + CareAssignment ACTIVE` crea visita;
- `ON_SITE`, `VIRTUAL`, REQUESTED, assignment inactiva/mismatch no crean;
- una visita por cita y FKs cross-tenant rechazadas;
- coherencia de estados/timestamps/versiones;
- transiciones legales e ilegales; terminales inmutables;
- carrera: exactamente una transición gana;
- mutación + historial + auditoría atómicos;
- RLS dos tenants, contexto ausente/equivocado, pool reuse, runtime sin DELETE.

### RBAC/API

- cookies ausente/manipulada/expirada/revocada y roles institucionales cruzados;
- Scheduler lista/ve pero no ejecuta;
- profesional correcto ejecuta; otro profesional/no asignado recibe denegación uniforme;
- paciente solo propio;
- cuidador: relación activa + scope versus vencida/revocada/sin scope;
- `tenantId`, actor, `professionalId` y campos extra rechazados;
- cross-tenant `404` uniforme;
- CSRF/origen en PATCH;
- no-cache y DTO/log scan sin PII prohibida.

### UI/accesibilidad Hospital

- carga/éxito/vacío/sin resultados/error/reintento;
- cancelación y respuestas tardías;
- cero fixtures/fallback factual;
- conteos reconciliados;
- semántica, teclado, foco, `aria-live`, estado textual además de color y responsive;
- regresión focal Agenda: asignar HOME crea visita una vez; otras modalidades no.

## 15. STOP CONDITIONS

Claude debe detenerse —y actualmente ya está detenido por los puntos 1 y 2— si:

1. no existe identidad humana validada vinculada a `ProfessionalProfile`;
2. no existe identidad/relación Cuidador validada con alcance y vigencia;
3. se intenta usar `HOSPITAL_SCHEDULER` como Visitador o atribuir la acción al profesional seleccionado;
4. se intenta usar `EnrollmentSession` como cuenta durable sin decisión aprobada;
5. actor/tenant/profesional llega desde el navegador;
6. se requiere dirección, clínica, nota, firma, foto, GPS, ruta, pago, alerta o calificación;
7. se requiere cancelación/reprogramación o modificación de Agenda fuera del hook atómico aprobado;
8. no pueden garantizarse FK tenant-aware + filtro explícito + RLS;
9. transición/historial/auditoría no pueden ser atómicos;
10. se requiere tocar archivos fuera de la allowlist aprobada posterior al desbloqueo;
11. una prueba de permisos, tenant, RLS, concurrencia, auditoría o migración falla;
12. se solicita commit, push o deploy.

## 16. Criterio de desbloqueo

Después de validar `IDENTITY-RELATIONSHIPS-CORE-01`, Codex debe revisar este packet únicamente para:

1. sustituir `performedByPrincipalId` por el modelo/principal exacto aprobado;
2. fijar guards y cookies concretos por actor;
3. confirmar la relación Cuidador y scopes exactos;
4. convertir §12 en allowlist autorizada;
5. cambiar el estado a `READY FOR CLAUDE CODE`.

Claude no deberá investigar arquitectura ni elegir alternativas en ese momento.

---

VISITS-CORE-01 READY FOR CLAUDE: NO

REUSED EXISTING MODULES: `Appointment`, `CareAssignment`, `ProfessionalProfile`, `Person`, `Patient`, identidad/sesión institucional y de paciente existentes como contextos separados, `withTenant`, RLS y `AuditEvent`.

NEW SHARED CAPABILITIES: Modelo único `HomeVisit`, máquina de estados operativa, historial append-only, transición optimista y auditada, permisos objetivo para Hospital/Profesional/Paciente/Cuidador y adaptadores sobre un servicio transversal; implementación bloqueada hasta identidad humana y relación Cuidador validadas.

CLAUDE PACKET: `tasks/VISITS-CORE-01.md` — DESIGN ONLY; DO NOT IMPLEMENT UNTIL UNBLOCKED
