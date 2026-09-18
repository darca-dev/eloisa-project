# MERDN Task Specification

## 1. Identificación y gate

- **Task ID:** `TASK-HOSPITAL-CORE-02`
- **Título:** Profesionales, asignaciones y Agenda Hospital conectados a datos persistidos
- **Estado:** `READY FOR CLAUDE CODE`, sujeto estrictamente a este paquete
- **Prioridad:** HIGH — vertical slice pequeño, base para Visitas
- **Precedencia obligatoria:** `TASK-HOSPITAL-CORE-01` VALIDATED
- **Agentes de diseño/revisión:** Orquestación/Arquitectura; Backend y Datos; Seguridad y Acceso; Frontend/QA

Este paquete autoriza a Claude Code a implementar y probar exclusivamente lo definido aquí. No autoriza commit, push, merge, rebase, deploy, datos reales de salud ni cambios al prototipo.

## 2. Objetivo y valor

Convertir únicamente **Hospital → Profesionales** y **Hospital → Agenda y citas** de superficies demostrativas a un flujo mínimo persistido y tenant-scoped:

1. consultar un directorio mínimo de profesionales vinculados al tenant;
2. consultar solicitudes de agenda y el calendario derivado de citas persistidas;
3. consultar, en el panel existente de un profesional, sus pacientes asignados y próximas citas;
4. asignar una solicitud existente a un profesional existente, con fecha y hora, creando una asignación paciente-profesional y actualizando la cita en una sola transacción auditada.

El resultado debe servir como base estructural para una futura Visita, pero **no crea ni abre el módulo Visitas**.

## 3. Decisión de slice y límites de identidad

### 3.1 Decisión

Se añade el rol mínimo separado `HOSPITAL_SCHEDULER`. Se reutilizan `InstitutionalIdentity`, `InstitutionalSession`, la cookie `merdn_institutional_session`, resolución server-side de tenant, `withTenant`, RLS y `AuditEvent`.

`HOSPITAL_PATIENT_VIEWER` conserva exactamente su carácter de solo lectura y no recibe permisos de escritura. `HOSPITAL_SCHEDULER` accede únicamente a los endpoints nuevos de este slice; no obtiene por implicación acceso a Hospital Pacientes, Alcaldía ni otros módulos.

### 3.2 Límite explícito

La identidad sigue siendo institucional compartida y no identifica a la persona trabajadora que opera. Por ello este slice solo puede usarse en desarrollo/MVP con datos ficticios o controlados. La auditoría atribuye actos a la `InstitutionalIdentity` opaca, nunca a la profesional seleccionada ni a una persona inventada.

Identidad individual de coordinador/profesional, autoagenda del profesional, producción con información real, o autorización clínica por asignación quedan bloqueadas por STOP CONDITION.

## 4. Alcance exacto

### 4.1 Incluido

1. Extender `InstitutionalRole` con `HOSPITAL_SCHEDULER` y aprovisionarlo mediante código/secreto separados, fail-closed y sin valores por defecto.
2. Crear modelos mínimos `ProfessionalProfile`, `ProfessionalAffiliation`, `CareAssignment` y `Appointment`, todos tenant-aware y relacionados con `Person`/`Patient` existentes.
3. Crear API:
   - `GET /api/v1/hospital/professionals`
   - `GET /api/v1/hospital/professionals/:professionalId`
   - `GET /api/v1/hospital/agenda?from=YYYY-MM-DD&to=YYYY-MM-DD`
   - `PATCH /api/v1/hospital/appointments/:appointmentId/assignment`
4. Conectar las vistas existentes `HospitalProfessionals` y `HospitalAgenda` a esas APIs con `credentials: "include"`.
5. Mantener composición, navegación, panel lateral, estilos, responsive, foco y jerarquía ya aprobados. Solo adaptar textos/estados para representar la capacidad real disponible.
6. Implementar carga, éxito, vacío, sin resultados, 400, 401, 403, 404, 409, 503 y reintento seguro. Nunca usar fixtures como fallback.
7. En la única mutación autorizada, exigir profesional, fecha, hora y versión de la cita; actualizar cita y crear/reactivar la asignación primaria en una transacción con auditoría obligatoria.
8. Derivar conteos de calendario, carga y próximas citas exclusivamente de registros persistidos. No inventar disponibilidad, conflicto clínico, calificación ni rendimiento.
9. Mantener los datos de paciente minimizados: `patientId`, nombre e iniciales; no documento, contacto, dirección, diagnóstico, alerta, cuidador, motivo clínico ni historia.

### 4.2 Única escritura funcional autorizada

`PATCH /api/v1/hospital/appointments/:appointmentId/assignment` acepta exactamente:

```json
{
  "professionalId": "uuid-opaco",
  "scheduledStart": "ISO-8601-con-offset",
  "expectedVersion": 1
}
```

La cita debe estar `REQUESTED`, sin profesional y dentro del mismo tenant. La operación:

1. valida cita, paciente, perfil y afiliación `ACTIVE` del mismo tenant;
2. crea o reutiliza una `CareAssignment` primaria activa para ese par paciente-profesional;
3. enlaza la cita a esa asignación;
4. cambia la cita a `ASSIGNED`, fija `scheduledStart`, incrementa `version` y `updatedAt`;
5. inserta `CARE_ASSIGNMENT_CREATED` solo cuando realmente se crea una asignación y siempre `APPOINTMENT_ASSIGNED`;
6. confirma todo o nada.

No comprueba disponibilidad humana ni aplica reglas clínicas. La única colisión mecánica bloqueada es que el mismo profesional tenga otra cita no cancelada con el mismo `scheduledStart`; responde `409` sin revelar la cita conflictiva. No se modela duración ni solapamiento por intervalos.

### 4.3 Fuera de alcance

- alta/edición/baja de `Person`, `Patient`, profesional, afiliación o cita desde UI/API;
- reprogramar, rechazar, cancelar, finalizar, aceptar o desasignar;
- autenticación o portal del profesional;
- documentos, credenciales profesionales verificadas, RETHUS, contratos, nómina, honorarios, pagos o calificaciones;
- disponibilidad, turnos, sedes, salas, geolocalización, rutas o detección de solapamientos por duración;
- detalle clínico, condiciones, patologías, alertas, semáforos, HCE, cuidadores, consentimientos nuevos o reglas clínicas;
- Visitas, Virtuales, Finanzas, Reportes, Membresías, Personal y cualquier otro módulo;
- mensajería, WhatsApp, integraciones, importación, exportación o notificaciones;
- intercambio interinstitucional o cross-tenant.

## 5. Modelo persistente mínimo

### 5.1 `ProfessionalProfile`

- `id UUID`, `tenantId UUID`, `personId UUID`
- `professionCode` y `professionNameControlled` (catálogo server-side mínimo; no texto libre del navegador)
- `status: ACTIVE | INACTIVE`
- timestamps
- FK compuesta `(personId, tenantId) → Person(id, tenantId)`
- único `(personId, tenantId)` y `(id, tenantId)`

No duplica nombre, documento, contacto ni fecha de nacimiento. Un profesional es una participación de la única `Person` del tenant.

### 5.2 `ProfessionalAffiliation`

- `id`, `tenantId`, `professionalId`
- `engagementType: EMPLOYEE | INDEPENDENT | THIRD_PARTY`
- `status: ACTIVE | INACTIVE | ENDED`
- `startsOn`, `endsOn?`, timestamps
- FK compuesta al perfil; único `(id, tenantId)`

Representa únicamente vínculo operativo declarado. No acredita relación laboral, contrato, habilitación, pago ni documento.

### 5.3 `CareAssignment`

- `id`, `tenantId`, `patientId`, `professionalId`
- `role: PRIMARY` (único valor permitido en este slice)
- `status: ACTIVE | ENDED`
- `startsAt`, `endsAt?`
- `createdByIdentityId`, timestamps
- FKs compuestas a `Patient`, `ProfessionalProfile` e `InstitutionalIdentity`
- único `(id, tenantId)`
- índice por tenant/paciente/status y tenant/profesional/status
- índice único parcial SQL para una sola asignación primaria activa por paciente dentro del tenant

No se borra ni sobrescribe historia. Este slice solo crea/reutiliza; finalizar/reasignar requiere otra Task.

### 5.4 `Appointment`

- `id`, `tenantId`, `patientId`, `careAssignmentId?`
- `modality: ON_SITE | HOME | VIRTUAL`; es clasificación de agenda, no apertura de esos módulos
- `status: REQUESTED | ASSIGNED | CANCELLED`; este slice solo transiciona `REQUESTED → ASSIGNED`
- `requestedAt`, `scheduledStart?`, `version Int @default(1)`, timestamps
- FKs tenant-aware a paciente y asignación; único `(id, tenantId)`
- índices por tenant/status/requestedAt y tenant/scheduledStart
- constraint: `REQUESTED` no tiene asignación ni fecha; `ASSIGNED` exige ambas

No persiste dirección, motivo, pago, diagnóstico, duración, zona, origen humano en texto ni notas.

### 5.5 Datos de entrada

La migración no inserta personas, pacientes, profesionales, afiliaciones, asignaciones ni citas demostrativas. Los tests DB/API crean fixtures ficticios mediante helpers autorizados y los eliminan dentro de su aislamiento de prueba. Una instalación sin datos muestra estados vacíos honestos.

El mecanismo productivo de alta/importación se difiere; no se habilita una puerta administrativa oculta en este slice.

## 6. Contratos API mínimos

Todas las respuestas, incluidas las de error, usan `Cache-Control: private, no-store`, `Pragma: no-cache` y `Vary: Cookie`. DTO explícito; nunca devolver objetos Prisma.

### 6.1 Profesionales

`GET /professionals` acepta allowlist: `page` (>=1), `pageSize` (25|50, default 25), `search` (<=100), `professionCode`, `affiliationType`, `status`, `sort=name|profession`, `direction=asc|desc`. Desconocido/repetido/inválido: `400`.

Devuelve fuente, `generatedAt`, paginación y por fila:

- `professionalId`, nombre/iniciales derivados de `Person`;
- profesión controlada, estado de perfil;
- afiliación activa y tipo, o `null`;
- `activePatientCount`, `todayAppointmentCount`, `nextAppointmentAt` derivados;
- sin calificación, disponibilidad, salario, honorarios, documentos ni contacto.

`GET /professionals/:professionalId` devuelve lo anterior más:

- pacientes de asignaciones activas: `patientId`, nombre/iniciales;
- agenda dentro de ventana `from/to` opcional limitada a 31 días, por defecto día actual del servidor;
- citas: `appointmentId`, paciente minimizado, modalidad, estado y `scheduledStart`.

ID cross-tenant/no existente: `404` uniforme.

### 6.2 Agenda

`GET /agenda` exige `from` y `to`, fechas válidas, rango inclusivo máximo 31 días y `from <= to`. Devuelve:

- solicitudes `REQUESTED`: id, versión, paciente minimizado, modalidad, `requestedAt`;
- profesionales asignables activos: id, nombre, profesión;
- citas asignadas dentro de ventana: id, paciente minimizado, profesional minimizado, modalidad, estado, `scheduledStart`;
- conteos diarios y totales por modalidad derivados de las mismas citas.

No devuelve detalle, dirección, solicitante, pago, alerta, cuidador ni copy demostrativo. Si la fecha solicitada no tiene filas, los conteos son cero y las listas vacías; eso no autoriza usar agosto de 2026 como fallback.

### 6.3 Asignación

`PATCH /appointments/:appointmentId/assignment`:

- JSON estricto; campos desconocidos, faltantes o repetidos se rechazan;
- `Origin`/`Referer` validado contra el origen web configurado usando el patrón aprobado del proyecto; si el patrón existente no es suficiente para mutaciones con cookie, STOP;
- `404` uniforme para cita/profesional/afiliación inexistente o cross-tenant;
- `409 APPOINTMENT_VERSION_CONFLICT` si cambió la versión;
- `409 APPOINTMENT_NOT_ASSIGNABLE` si estado/profesional/slot no permiten esta transición;
- éxito `200` con DTO minimizado de la cita ya asignada y nueva versión;
- reenvío con la versión anterior no repite ni duplica la operación.

Errores estables: `HOSPITAL_OPERATIONS_INVALID_QUERY`, `HOSPITAL_OPERATIONS_INVALID_BODY`, `INSTITUTIONAL_SESSION_REQUIRED`, `INSTITUTIONAL_ROLE_REQUIRED`, `HOSPITAL_PROFESSIONAL_NOT_FOUND`, `HOSPITAL_APPOINTMENT_NOT_FOUND`, los dos `409` anteriores y `HOSPITAL_OPERATIONS_SERVICE_UNAVAILABLE`.

## 7. Autorización, tenant, RLS y auditoría

1. `HOSPITAL_SCHEDULER` se aprovisiona con `MERDN_HOSPITAL_SCHEDULER_CODE` y `MERDN_HOSPITAL_SCHEDULER_SECRET`; no defaults, no secretos en repositorio ni logs.
2. Rol y tenant proceden solo de la sesión persistida. Body/query no aceptan `tenantId`, `personId`, `identityId`, actor ni rol.
3. Cookie ausente/paciente/expirada/revocada/manipulada: `401`. Sesión municipal o `HOSPITAL_PATIENT_VIEWER`: `403`. Identidad disabled: sesión inválida y `401` conforme al patrón existente.
4. Cada consulta y mutación corre dentro de `withTenant(principal.tenantId)` con filtro explícito `tenantId`. Las FKs compuestas impiden enlaces cross-tenant.
5. Cada tabla nueva tiene RLS habilitado, policy `USING`/`WITH CHECK` por tenant y grants mínimos para `merdn_runtime`; sin acceso público, sin `BYPASSRLS`, sin `DELETE` para runtime.
6. La ausencia/fallo del rol runtime, tenant GUC o verificación RLS falla cerrada antes del trabajo de dominio. No degradar a ejecución insegura.
7. Eventos nuevos mínimos:
   - `HOSPITAL_PROFESSIONAL_LIST_ACCESS_GRANTED`
   - `HOSPITAL_PROFESSIONAL_DETAIL_ACCESS_GRANTED`
   - `HOSPITAL_AGENDA_ACCESS_GRANTED`
   - `CARE_ASSIGNMENT_CREATED`
   - `APPOINTMENT_ASSIGNED`
   - `HOSPITAL_OPERATIONS_ACCESS_DENIED`
8. Lecturas concedidas registran actor institucional opaco, rol, tenant, endpoint lógico, outcome, timestamp y correlation ID; detalle puede registrar `professionalId` opaco. No guardar filtros, conteos ni resultados.
9. Mutación y sus eventos se escriben en la misma transacción; si auditoría falla, rollback y error. Denegaciones son best-effort solo para no crear oráculo/DoS, siguiendo CORE-01.
10. Logs nunca contienen nombres, documentos, pacientes, búsquedas, payloads, tokens/hashes, secretos ni IDs cross-tenant recibidos.

## 8. Conexión exacta de las vistas y fixtures a retirar

### 8.1 `HospitalProfessionals`

- Dejar de importar/usar `hospitalProfesionalesDemo.fichas` en runtime.
- Reemplazar filtrado/conteos completos en memoria por el cliente paginado server-side.
- Mantener `hospitalProfessionalsConfig.ts` solo para copy/estructura no factual.
- El listado conserva su forma visual. `Estado` significa estado del perfil, no disponibilidad inferida.
- `Pacientes`, actividad de hoy y próxima cita provienen de API.
- Calificación se muestra como `No disponible` y su filtro/uso factual se elimina; no mostrar cifras demo.
- El panel conserva sus secciones. `Pacientes a cargo` y `Agenda del profesional` se conectan al detalle. `Vinculación` muestra únicamente tipo/estado/fechas persistidas; documentos y economía quedan `No disponibles en este módulo`, sin fixture.
- Acciones `Asignar nueva visita`, `Reprogramar`, `Cambiar modalidad` y `Cancelar` permanecen deshabilitadas con ayuda accesible; no abren otros módulos.

### 8.2 `HospitalAgenda`

- Dejar de usar en runtime `hospitalAgendaDemo.solicitudes`, `HOSPITAL_CITAS_AGOSTO`, profesionales, totales y perspectivas como datos.
- El calendario muestra la ventana real seleccionada; puede conservar controles Día/Semana/Mes solo si cada control produce una ventana de API coherente. Si completar tres escalas excede el slice, conservar `Mes` activo y deshabilitar Día/Semana con ayuda accesible; no simular cambios.
- Las solicitudes y selector de profesional se alimentan de API.
- `Asignar` se habilita solo con profesional, fecha y hora válidos y envía el PATCH. Durante envío queda bloqueado; éxito refresca agenda y profesional afectado; conflicto conserva selección y anuncia el error.
- `Reprogramar` y `Rechazar con motivo` quedan deshabilitados y explican `Disponible en una etapa posterior`.
- Catálogo visual de estados puede permanecer como referencia no factual; copy que promete actualizaciones en cuatro vistas, WhatsApp o pagos debe retirarse.
- Bloque `Una cita, cuatro vistas` no muestra nombres/citas demo: se conserva como explicación neutral o estado futuro no factual.

### 8.3 Fixtures

Deben dejar de importarse desde los árboles runtime de estas dos vistas:

- `hospitalProfesionalesDemo.fichas` y derivados factual-demostrativos de `hospitalProfessionalsConfig.ts`;
- `hospitalPacientesDemo`, `hospitalVisitasDemo` y `hospitalVirtualesDemo` usados para construir fichas profesionales;
- `hospitalAgendaDemo.solicitudes`, `.solicitudes.profesionales`, `.calendario.dias`, `.calendario.totales`, perspectivas factuales y `HOSPITAL_CITAS_AGOSTO`.

No borrar estos archivos ni modificar consumidores de otros módulos. Pueden conservar copy/presentación no factual y fixtures explícitos de pruebas unitarias. Está prohibido usar cualquiera como fallback ante carga, error, 401/403 o vacío.

## 9. Archivos autorizados

### Base de datos

- `prisma/schema.prisma`, solo adiciones de esta Task.
- una migración nueva `prisma/migrations/<timestamp>_hospital_core_02/migration.sql`.
- nuevo `prisma/migrations/ROLLBACK-hospital_core_02.sql`, documental; no ejecutarlo.

### API

- `apps/api/src/institutional-auth/institutional-auth.contract.ts`
- `apps/api/src/institutional-auth/institutional-auth.config.ts`
- `apps/api/src/institutional-auth/institutional-auth.service.ts`
- `apps/api/src/institutional-auth/institutional-auth.unit.test.ts`
- nuevos `hospital-scheduler.guard.ts` y prueba en `apps/api/src/institutional-auth/**`
- `apps/api/src/hospital/hospital.module.ts`
- `apps/api/src/hospital/hospital.contract.ts`
- nuevos archivos prefijados `hospital-professionals*`, `hospital-agenda*` y `hospital-appointment-assignment*` dentro de `apps/api/src/hospital/**`
- `apps/api/src/openapi/openapi.ts`
- `apps/api/test/openapi.test.ts`
- nuevos `apps/api/test/hospital-core-02-fixtures.ts`, `hospital-professionals.api.test.ts`, `hospital-agenda.api.test.ts`, `hospital-core-02.db.test.ts`
- `apps/api/test/global-setup.ts` y `test-environment.ts` solo si son imprescindibles para credencial ficticia Scheduler.

### Web

- `HospitalProfessionals.tsx`, `ProfessionalDetailPanel.tsx`, `ProfessionalEngagementPanel.tsx`
- `hospitalProfessionalsConfig.ts`, `hospitalProfessionalsListado.ts`, `hospitalProfessionals.module.css`, `hospitalProfessionals.test.tsx`
- nuevos `hospitalProfessionalsClient.ts` y prueba
- `HospitalAgenda.tsx`, `hospitalAgendaConfig.ts`, `hospitalAgenda.module.css`, `hospitalAgenda.test.tsx`
- nuevos `hospitalAgendaClient.ts` y prueba
- `hospitalTestUtils.ts` solo para mocks de estas vistas.

Lectura sin modificación de cualquier archivo del repositorio está permitida.

## 10. Archivos y acciones prohibidos

1. `prototype-claude/**`.
2. Migraciones existentes, incluido HOSPITAL-CORE-01.
3. `apps/api/src/patients/**`, `municipality/**`, `consents/**`, `enrollment-sessions/**` y `database/**`.
4. Endpoints/servicios de Hospital Pacientes, salvo ejecutar sus pruebas; en particular no ampliar el guard de viewer.
5. Cualquier vista Hospital distinta de Profesionales y Agenda, incluidos Shell/sidebar/dashboard, Pacientes, Visitas, Virtuales, Finanzas, Reportes, Alertas, Personal, Membresías y Configuración.
6. Fixtures de Pacientes, Visitas y Virtuales: solo lectura; no editarlos ni borrarlos.
7. `package.json`, lockfile, dependencias, Docker/compose, `.env*`, infraestructura y secretos.
8. `AGENTS.md`, `CLAUDE.md`, `docs/**`, otras Tasks y Reviews.
9. Borrado físico, seed de demo en migración, commit, push, merge, rebase, deploy o datos reales.

Si un archivo no aparece en §9, está prohibido. Si Claude demuestra que uno adicional es indispensable, debe detenerse y pedir ampliación antes de editarlo.

## 11. Pruebas obligatorias

### 11.1 Modelo/migración/RLS

- migración forward sobre DB limpia y DB con CORE-01/HOSPITAL-CORE-01; rollback documental revisado;
- constraints de estados/fechas, versión y principal activo;
- FKs cross-tenant rechazadas;
- RLS real con runtime non-owner/non-BYPASSRLS: leer/escribir tenant A no revela/muta B;
- contexto ausente/incorrecto, fallo de role/GUC y reutilización de pool fallan cerrados;
- runtime sin DELETE y auditoría append-only.

### 11.2 API y seguridad

- matriz: sin cookie, cookie paciente, municipal, patient viewer, scheduler, expirada, revocada, manipulada e identidad disabled;
- dos tenants en list/detail/agenda/assignment; `404` uniforme cross-tenant;
- query/body allowlist, UUID y fechas inválidas, rango >31 días, campos extra y `tenantId` inyectado;
- CSRF/origin inválido denegado;
- asignación exitosa crea/reutiliza vínculo, actualiza cita y auditoría atómicamente;
- carrera con misma `expectedVersion`: exactamente una gana; la otra `409`;
- mismo profesional/mismo instante: `409` sin revelar conflicto;
- fallo de auditoría revierte toda mutación;
- headers no-cache en éxito y error; DTO/log scan sin campos prohibidos;
- OpenAPI documenta contratos y errores.

### 11.3 Frontend/accesibilidad

- carga/éxito/vacío/sin resultados/401/403/404/409/503 sin fallback demo;
- cancelación de solicitudes y descarte de respuestas tardías con `AbortController`;
- paginación/filtros y ventana de agenda consultan servidor;
- botón Asignar habilitado solo con entrada válida, evita doble submit, anuncia éxito/error en región viva y refresca datos;
- navegación por teclado, labels, foco del panel y retorno al disparador, contraste/estado sin depender solo de color y responsive conservados;
- ninguna acción fuera de scope produce red/mutación;
- prueba estática impide imports runtime de los fixtures enumerados.

### 11.4 Regresión

- suites completas de API y Web;
- HOSPITAL-CORE-01 Pacientes, sesión institucional, Alcaldía, autoinscripción y secrets scan permanecen verdes;
- no aceptar como PASS una suite DB omitida por falta de PostgreSQL. Si el entorno no permite RLS `enforce`, reportar `UNVERIFIED` y aplicar STOP para validación final.

## 12. Criterios de aceptación

1. No existe segunda `Person`, `Patient`, sesión, cookie, tenant ni auditoría paralela.
2. Profesionales y Agenda muestran exclusivamente datos persistidos del tenant de sesión o estados vacíos honestos.
3. No queda import runtime de fixtures factuales en ninguna de las dos vistas.
4. Directorio y detalle profesional son paginados/minimizados y no exponen documento/contacto/PII no necesaria.
5. Panel profesional reconcilia pacientes activos y citas con `CareAssignment`/`Appointment` persistidos.
6. Agenda reconcilia solicitudes, citas y conteos para la ventana solicitada.
7. Una solicitud puede asignarse una sola vez con control optimista; vínculo, cita y auditoría son atómicos.
8. No se habilita reprogramar, rechazar, cancelar, Visita, Virtual ni otra mutación.
9. `HOSPITAL_PATIENT_VIEWER` no escribe y `HOSPITAL_SCHEDULER` no obtiene permisos fuera del slice.
10. Tenant explícito + FK compuesta + RLS protegen toda ruta y asociación; cross-tenant nunca se confirma.
11. UI mantiene diseño aprobado, accesibilidad, responsive y foco sin afirmar disponibilidad, calificación, pago, clínica o vínculo laboral no modelados.
12. Migración es aditiva, sin demo seeds, con rollback documental, y todas las pruebas obligatorias pasan en PostgreSQL con RLS enforce.
13. Claude entrega diff enumerado, comandos/resultados, evidencia de RLS/tenant/concurrencia/auditoría, fixtures retirados, variables externas requeridas y riesgos residuales.

## 13. STOP CONDITIONS

Claude debe detener la parte afectada y devolver evidencia, sin improvisar, si:

1. CORE-01/HOSPITAL-CORE-01 no está aplicado, validado o sus pruebas de regresión fallan.
2. Se requiere identidad humana nominal, login de profesional, autoagenda o atribuir una acción a la profesional seleccionada.
3. Se pretende dar escritura a `HOSPITAL_PATIENT_VIEWER` o aceptar rol/tenant/actor desde el navegador.
4. Se necesita crear/importar profesionales o citas en producción para que el slice sea útil; eso requiere otra Task.
5. Se requiere compartir personas, profesionales, asignaciones o citas entre tenants/instituciones.
6. No pueden garantizarse filtro tenant explícito, FK compuesta tenant-aware y RLS fail-closed en cada tabla/consulta.
7. Mutación y auditoría no pueden ser atómicas o se requiere editar/borrar historial.
8. Un conflicto exige inventar disponibilidad, duración, prioridad, reglas clínicas o laborales.
9. Se requiere diagnóstico, HCE, motivo clínico, dirección/contacto, cuidador, consentimiento nuevo, pago o datos reales.
10. Se necesita tocar Visitas, Virtuales, Finanzas, Reportes, otros módulos, prototipo, infraestructura, dependencias o un archivo fuera de §9.
11. El patrón CSRF/origin seguro para cookie no existe o requiere una decisión arquitectónica no aprobada.
12. Una migración exige pérdida/reinterpretación de datos o modificación de migraciones aplicadas.
13. Falla una prueba de permisos, tenant, RLS, CSRF, auditoría, concurrencia, migración o regresión y no puede corregirse dentro del allowlist.
14. PostgreSQL real con `MERDN_RUNTIME_ROLE=enforce` no está disponible para la validación requerida: no reportar VALIDATED.
15. Se solicita commit, push, merge, deploy o uso productivo.

## 14. Evidencia requerida en el handoff de Claude

1. Resumen exacto y lista de archivos cambiados/nuevos.
2. Diagrama breve de relaciones y explicación de no duplicación de `Person`/`Patient`.
3. Contratos finales y ejemplos sanitizados de éxito/error.
4. Evidencia de matriz de roles, dos tenants, RLS enforce y consultas cross-tenant.
5. Evidencia de carrera/versionado, conflicto de slot y rollback por auditoría.
6. Lista de imports/fixtures retirados y prueba de ausencia de fallback.
7. Comandos y resultados completos; distinguir PASS, FAIL, SKIPPED y UNVERIFIED.
8. Variables externas nuevas, sin valores.
9. Supuestos, desviaciones y riesgos residuales. Ninguna desviación silenciosa.

---

TASK-HOSPITAL-CORE-02 READY FOR CLAUDE: YES

EXPECTED CLAUDE SCOPE: Implementar dos lecturas persistidas (Profesionales y Agenda) y una sola mutación atómica `REQUESTED → ASSIGNED`, con rol `HOSPITAL_SCHEDULER`, tenant/RLS/auditoría y conexión de las dos vistas existentes, sin abrir otros módulos.

CLAUDE PACKET: `tasks/TASK-HOSPITAL-CORE-02.md`
