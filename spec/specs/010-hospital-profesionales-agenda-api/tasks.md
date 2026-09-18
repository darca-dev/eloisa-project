# Tareas 010 - Hospital · Profesionales y Agenda (API y vistas conectadas)

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

### Modelo y aislamiento

- [x] Migración `20260822160000_hospital_core_02`, aditiva y sin insertar ninguna fila
- [x] Cuatro tablas: `professional_profile`, `professional_affiliation`, `care_assignment`, `appointment`
- [x] Siete enums: `ProfessionalStatus`, `ProfessionalEngagementType`, `ProfessionalAffiliationStatus`, `CareAssignmentRole`, `CareAssignmentStatus`, `AppointmentModality`, `AppointmentStatus`
- [x] Valor `HOSPITAL_SCHEDULER` añadido a `InstitutionalRole`
- [x] Seis valores nuevos en `AuditEventType`
- [x] Claves foráneas **compuestas** `(id, tenantId)` en toda relación
- [x] Índice único parcial de una sola asignación primaria activa por paciente
- [x] Check de coherencia de estado de la cita: `REQUESTED` sin asignación ni fecha; `ASSIGNED` con ambas
- [x] Check `version >= 1` y check de forma del código de profesión
- [x] RLS habilitada en las cuatro tablas, con `USING` y `WITH CHECK` por tenant
- [x] Privilegio mínimo: sin `DELETE` en ninguna tabla, sin `INSERT` de citas, sin `UPDATE` de asignaciones
- [x] Rollback documental `prisma/migrations/ROLLBACK-hospital_core_02.sql`

### API

- [x] `GET /api/v1/hospital/professionals` con allowlist estricta de consulta y paginación
- [x] `GET /api/v1/hospital/professionals/:professionalId` con pacientes activos, ventana y afiliación
- [x] `GET /api/v1/hospital/agenda` que **exige** `from` y `to`, sin ventana por defecto
- [x] `PATCH /api/v1/hospital/appointments/:appointmentId/assignment` como única mutación
- [x] Ventana de agenda limitada a 31 días inclusivos
- [x] Cuerpo de la mutación con allowlist exacta de tres campos; campo extra → `400`
- [x] `scheduledStart` exige desplazamiento horario explícito (`Z` o `±HH:MM`)
- [x] Asignación, vínculo y auditoría en una sola transacción
- [x] Control optimista con la versión en el `WHERE` del `updateMany`
- [x] `409 APPOINTMENT_VERSION_CONFLICT` y `409 APPOINTMENT_NOT_ASSIGNABLE` sin revelar la cita en conflicto
- [x] `404` uniforme para profesional inexistente, de otro tenant, inactivo o sin afiliación
- [x] Cabeceras `private, no-store` en éxito y en error
- [x] Auditoría de las tres lecturas concedidas y de la denegación
- [x] DTO explícito; nunca se devuelve un objeto Prisma
- [x] OpenAPI documenta las cuatro rutas (`apps/api/test/openapi.test.ts:38-44`)

### Autorización

- [x] `HospitalSchedulerGuard`: `401` sin sesión válida, `403` para otro rol, `503` fail-closed
- [x] Roles disjuntos: no compone ni extiende el guard de `HOSPITAL_PATIENT_VIEWER`
- [x] Cabeceras de no-caché fijadas antes de decidir, también en las denegaciones
- [x] Auditoría de denegación best-effort: un fallo al auditar nunca convierte una denegación en permiso
- [x] `HOSPITAL_SCHEDULER` sin código por defecto: exige `MERDN_HOSPITAL_SCHEDULER_CODE` **y** `MERDN_HOSPITAL_SCHEDULER_SECRET` válidos
- [x] Los motivos de identidad omitida nombran la variable, nunca el valor recibido
- [x] Comprobación de origen de la mutación contra `API_WEB_ORIGINS`, por igualdad exacta
- [x] `PATCH` añadido a CORS sin `PUT` ni `DELETE`

### Web

- [x] `hospitalProfessionalsClient.ts` y `hospitalAgendaClient.ts` como única frontera con la red
- [x] `credentials: "include"`, `AbortSignal` propagado, sin cabecera de tenant, rol ni actor
- [x] `HospitalProfessionals.tsx` con listado, filtros y paginación server-side
- [x] Panel de detalle remoto con retorno de foco al disparador
- [x] `ProfessionalEngagementPanel.tsx` publica solo la afiliación persistida; el resto es `Sin información registrada`
- [x] `HospitalAgenda.tsx` con las tres escalas Día/Semana/Mes activas y coherentes
- [x] Formulario de asignación con bloqueo de doble envío y conservación de la entrada ante `409`
- [x] Estados de carga, vacío, sin resultados, `400`, `401`, `403`, `404`, `409`, `503` y reintento
- [x] Sin ningún import runtime de fixtures factuales en ninguna de las dos vistas
- [x] Acciones fuera de alcance visibles, deshabilitadas, con ayuda accesible y sin controlador
- [x] Reloj inyectable: un único `new Date()` sin argumentos en todo el módulo Hospital
- [x] Gate estático `hospitalAlcance.test.ts` con igualdad exacta de conjuntos

## Límites conocidos (no autorizados como trabajo)

- [ ] Alta de profesionales, afiliaciones o citas por API, comando o importación
- [ ] `INSERT` de citas y `UPDATE` de asignaciones para el rol de ejecución
- [ ] Terminar o reasignar una `CareAssignment`
- [ ] Cancelar, reprogramar, rechazar, aceptar o finalizar una cita
- [ ] Modelado de duración, turnos, sedes, salas, rutas o solapamiento por intervalos
- [ ] Validación de que `scheduledStart` sea futuro
- [ ] Conversión de zona horaria a `America/Bogota` en ventanas y conteos
- [ ] Presentación de `activePatientCount`, `todayAppointmentCount` y `nextAppointmentAt` en alguna vista
- [ ] Controles de orden (`sort`, `direction`) y de tamaño de página en la interfaz
- [ ] Documentación de `MERDN_HOSPITAL_SCHEDULER_CODE` y `MERDN_HOSPITAL_SCHEDULER_SECRET` en `.env.example`
- [ ] Catálogo de profesiones compartido en `packages/shared` en vez de duplicado
- [ ] Endurecimiento del check `audit_event_resource_required` con los dos eventos de mutación
- [ ] Identidad humana nominal: la auditoría atribuye a una identidad institucional opaca
- [ ] Ocultamiento de las vistas por rol en el shell; la autoridad es la API
- [ ] Confinamiento del rol `HOSPITAL_SCHEDULER` al módulo Hospital, ya ampliado por la spec 012
- [ ] Auditoría de tercero: no existe `reviews/REVIEW-HOSPITAL-CORE-02*`

## Verificación pendiente

- [ ] Instalar dependencias (`node_modules` ausente) para poder ejecutar cualquier prueba
- [ ] Levantar PostgreSQL normal con rol no propietario, sin `BYPASSRLS` y `MERDN_RUNTIME_ROLE=enforce`
- [ ] Ejecutar `apps/api/test/hospital-core-02.db.test.ts` con `availability.engine === 'postgresql-server'` para verificar las escrituras bajo RLS
- [ ] Verificar en ejecución `WITH CHECK`, la denegación de `DELETE`/`INSERT`/`UPDATE` y la reutilización del pool
- [ ] Ejecutar `hospital-professionals.api.test.ts`, `hospital-agenda.api.test.ts`, `hospital-scheduler.guard.test.ts`, `hospital-professionals.query.test.ts`, `hospital-appointment-assignment.request.test.ts`, `institutional-auth.unit.test.ts` y `openapi.test.ts`
- [ ] Ejecutar `hospitalProfessionals.test.tsx`, `hospitalAgenda.test.tsx`, los dos `*Client.test.ts` y `hospitalAlcance.test.ts`
- [ ] Ejecutar `npm --workspace apps/api run typecheck` y `npm --workspace apps/web run typecheck`
- [ ] Aplicar la migración sobre una base con `core_01` y `hospital_core_01` para confirmar que es aditiva
- [ ] Comprobar en un navegador el foco del panel, la región viva y la navegación por teclado
