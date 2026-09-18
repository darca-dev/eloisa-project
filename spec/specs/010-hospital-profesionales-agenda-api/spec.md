# Especificación 010 - Hospital · Profesionales y Agenda (API y vistas conectadas)

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specifications: `tasks/TASK-HOSPITAL-CORE-02.md` y sus **cinco**
paquetes de corrección —`-CORRECTION`, `-FINAL-CORRECTION`, `-CONTINUATION`,
`-FINAL-FAIL-CLOSED` y `-MINIMAL-CLOSE`—. Congeladas.

**No existe auditoría registrada.** `ls reviews/` devuelve 20 auditorías y
ninguna corresponde a `HOSPITAL-CORE-02`; tampoco a `HOSPITAL-CORE-01`. La
última auditoría de Codex sobre el módulo Hospital es
`reviews/REVIEW-003H-07-FINAL.md`, anterior a toda persistencia hospitalaria.
Eso significa que el único rastro del control de calidad de esta capacidad son
los cinco paquetes de corrección, y que ningún tercero verificó el resultado
final. Es un dato relevante, no una omisión de este documento.

Es la primera capacidad del repositorio que **escribe** desde una superficie
hospitalaria: las specs 008 y 009 abrieron lectura institucional; esta abre la
única mutación autorizada del módulo Hospital.

## Objetivo

Que «Profesionales» y «Agenda y citas» del Hospital dejen de ser composiciones
alimentadas por fixtures y pasen a leer registros persistidos del tenant que el
servidor resuelve, y que una solicitud de cita existente pueda asignarse a un
profesional existente en una sola transacción auditada, con control optimista,
sin que el navegador aporte tenant, rol ni actor.

## Historia de usuario principal

Como persona que coordina la agenda de la institución, quiero ver el directorio
real de profesionales vinculados y las solicitudes de cita pendientes, y poder
asignar una solicitud a un profesional con fecha y hora, para que la asignación
quede registrada y auditada en vez de vivir en una maqueta.

## Qué hace hoy el sistema

| Superficie | Qué hace | Archivos |
|---|---|---|
| `GET /api/v1/hospital/professionals` | Directorio paginado y minimizado del tenant. Allowlist estricta de consulta (`page`, `pageSize` 25\|50, `search`, `professionCode`, `affiliationType`, `status`, `sort=name\|profession`, `direction`). Cualquier parámetro desconocido → `400`. | `hospital-professionals.controller.ts:80-90`, `.service.ts`, `.query.ts` |
| `GET /api/v1/hospital/professionals/:professionalId` | Añade pacientes con asignación **ACTIVA**, ventana de agenda (`from`/`to` opcionales, máximo 31 días, por defecto el día del servidor) y afiliación vigente. `404` uniforme para inexistente o de otro tenant. | `hospital-professionals.controller.ts:166-217` |
| `GET /api/v1/hospital/agenda` | Exige `from` y `to`; no hay ventana por defecto (`hospital-agenda.query.ts:16-23`). Devuelve solicitudes `REQUESTED`, profesionales asignables, citas asignadas, conteos diarios, conteos por modalidad y total. | `hospital-agenda.controller.ts:63-111`, `.service.ts`, `.dto.ts` |
| `PATCH /api/v1/hospital/appointments/:id/assignment` | Única mutación del módulo. Cuerpo exacto `{professionalId, scheduledStart, expectedVersion}`; campo extra → `400`. Valida origen, crea o reutiliza `CareAssignment` primaria, enlaza la cita, la pasa a `ASSIGNED`, incrementa `version` y escribe auditoría, **todo en una transacción**. | `hospital-appointment-assignment.controller.ts:84-153`, `.service.ts:81-268`, `.request.ts`, `.origin.ts` |
| Autorización | `HospitalSchedulerGuard`: `401` sin sesión institucional válida, `403` para cualquier otro rol, `503` fail-closed si el contexto de ejecución seguro no se confirma. No compone ni extiende el guard de `HOSPITAL_PATIENT_VIEWER`. | `institutional-auth/hospital-scheduler.guard.ts:99-113,127`, `.guard.test.ts` |
| Aprovisionamiento del rol | `HOSPITAL_SCHEDULER` **no tiene código por defecto**: exige `MERDN_HOSPITAL_SCHEDULER_CODE` y `MERDN_HOSPITAL_SCHEDULER_SECRET` válidos en la misma carga. Si falta o es inválido cualquiera, la identidad se omite con motivo que nombra la variable y nunca el valor. | `institutional-auth.config.ts:121-127,186,234-250` |
| Modelo | `professional_profile`, `professional_affiliation`, `care_assignment`, `appointment`, más siete enums y seis valores de `AuditEventType`. FKs **compuestas** `(id, tenantId)` en cada relación. | `prisma/migrations/20260822160000_hospital_core_02/migration.sql` |
| Aislamiento | RLS habilitada en las cuatro tablas con `USING` y `WITH CHECK` por `merdn_current_tenant()`. Privilegio mínimo: `SELECT` en perfil y afiliación, `SELECT, INSERT` en asignación, `SELECT, UPDATE` en cita. **Ningún `DELETE` en ninguna.** | `migration.sql:345-375` |
| Concurrencia | La versión esperada viaja en el `WHERE` del `updateMany`: dos peticiones simultáneas con la misma versión compiten en la base y exactamente una escribe; la otra recibe `409 APPOINTMENT_VERSION_CONFLICT` sin haber escrito. | `hospital-appointment-assignment.service.ts:196-219` |
| Colisión de instante | Mismo profesional con otra cita no cancelada en el mismo `scheduledStart` → `409 APPOINTMENT_NOT_ASSIGNABLE`, sin revelar la cita en conflicto. | `hospital-appointment-assignment.service.ts:166-186` |
| Vistas conectadas | `HospitalProfessionals.tsx` y `HospitalAgenda.tsx` consumen los clientes; ninguna llama a la red directamente (reciben `fetchImpl`). Estados de carga, vacío, sin resultados, `400`, `401`, `403`, `404`, `409`, `503` y reintento, **sin repliegue a fixtures**. | `HospitalProfessionals.tsx`, `HospitalAgenda.tsx`, `hospitalProfessionalsClient.ts`, `hospitalAgendaClient.ts` |
| Reloj único | Un solo `new Date()` sin argumentos en todo el módulo Hospital, en el default del reloj inyectable de Agenda. Verificado por gate estático. | `hospitalAlcance.test.ts:137-158,261-274` |
| CORS y CSRF | `methods: ['GET','POST','PATCH','OPTIONS']` (`apps/api/src/main.ts:44`). El origen de la mutación se compara por igualdad exacta de esquema/host/puerto contra `API_WEB_ORIGINS`; `Origin` preferido, `Referer` solo como respaldo, `null` y ausencia de ambos rechazados. | `hospital-appointment-assignment.origin.ts:27-70` |

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| `001-fundacion-tecnica-monorepo` | Monorepo npm workspaces, NestJS, Next.js, Prisma, Vitest, `tsconfig.base.json` | Sin ella no existen ni el proyecto de API ni el de Web donde vive esta capacidad |
| `003-experiencia-visual-hospital` | Shell del Hospital y las dos vistas originales `HospitalProfessionals` y `HospitalAgenda` (`TASK-003H-02`, `TASK-003H-03`) | Esta spec **no creó vistas**: sustituyó la fuente de dos vistas ya aprobadas y conservó su composición |
| `007-inscripcion-paciente-persistente` | `Tenant`, `Person`, `Patient`, `AuditEvent`, rol `merdn_runtime`, `merdn_current_tenant()`, `PrismaService.withTenant()`, RLS | Un profesional es una participación de la única `Person` del tenant; una cita cuelga del único `Patient`. Sin ellas no hay a qué apuntar ni con qué aislar |
| `008-agregados-municipales-protegidos` | `InstitutionalIdentity`, `InstitutionalSession`, enum `InstitutionalRole`, cookie `merdn_institutional_session` (`prisma/migrations/20260822130000_municipality_core_01/migration.sql:36,72,106`) | `HOSPITAL_SCHEDULER` es un valor **añadido** a ese enum y su sesión es la misma cookie. No hay segunda identidad ni segunda sesión |
| `009-hospital-pacientes-api` | `hospital.module.ts`, `hospital.contract.ts`, `HOSPITAL_PATIENTS_SOURCE`, patrón de guard institucional por rol y de auditoría de acceso | Los cuatro endpoints nuevos se registran en ese módulo y reutilizan su contrato y su forma de auditar. `care_assignment.createdByIdentityId` apunta a la identidad de ese mecanismo |

**Dependencias externas medidas:**

- **PostgreSQL** con el rol `merdn_runtime` (no propietario, sin `BYPASSRLS`) y la
  función `merdn_current_tenant()`, creados por
  `prisma/migrations/20260822120000_core_01_hardening/migration.sql`.
- **Migraciones concretas y en este orden**: `20260821120000_core_01_init` →
  `20260822120000_core_01_hardening` → `20260822130000_municipality_core_01` →
  `20260822140000_hospital_core_01` → `20260822160000_hospital_core_02`.
- **Variables de entorno** `MERDN_HOSPITAL_SCHEDULER_CODE` y
  `MERDN_HOSPITAL_SCHEDULER_SECRET`. Sin ambas, los cuatro endpoints existen y
  responden `401` para siempre.
- **`API_WEB_ORIGINS`**: allowlist única de CORS y de la comprobación de origen
  de la mutación.
- **No depende de Keycloak/OIDC.** La identidad de esta superficie es
  institucional compartida, con código y credencial en configuración del
  servidor. El OIDC del repositorio (`MERDN_IDENTITY_PROVISIONING_ISSUERS`)
  pertenece a la spec 011 y no interviene aquí.

**Specs que dependen de esta:**

- `011-identidad-humana-y-relaciones` — `identity-access.service.ts:86` resuelve
  el `ProfessionalProfile` creado aquí para vincularlo a una cuenta humana.
- `012-visitas-domiciliarias` — `home_visit` tiene FK compuesta a `appointment` y
  a `care_assignment` (`prisma/migrations/20260824120000_visits_core_01/migration.sql:124,136`).
- `013-visitas-visibles-en-hospital` — `HospitalAgenda.tsx` incorporó la acción
  «Preparar visita domiciliaria» sobre las citas servidas por esta agenda.
- `015-fidelidad-visual-hospital` — los commits `4843612` y `3c738c9` reescriben
  la composición de estas dos vistas sin cambiar su fuente de datos.
- `017-worklist-del-visitador` — `professional-visit-worklist.service.ts:110,134`
  lee `appointment` y `care_assignment` para construir la worklist.

## Escenarios de aceptación

1. Dada una sesión institucional con rol `HOSPITAL_SCHEDULER`, cuando se
   consulta el directorio de profesionales, entonces se devuelven solo perfiles
   del tenant de la sesión, paginados, sin documento ni contacto.
2. Dada una sesión con rol `HOSPITAL_PATIENT_VIEWER`, cuando se consulta
   cualquiera de los cuatro endpoints, entonces la API responde `403` y no
   ejecuta ninguna lectura de dominio.
3. Dada la ausencia de cookie institucional, o una cookie de paciente, o una
   sesión expirada, revocada o manipulada, cuando se consulta la agenda,
   entonces la API responde `401`.
4. Dado un `professionalId` que existe en otro tenant, cuando se pide su
   detalle, entonces la API responde `404` con el mismo cuerpo que para un
   identificador inexistente.
5. Dada una consulta de agenda sin `from` o sin `to`, o con un rango mayor de 31
   días, o con un parámetro fuera de la allowlist, entonces la API responde
   `400 HOSPITAL_OPERATIONS_INVALID_QUERY`.
6. Dada una solicitud `REQUESTED` sin profesional, cuando se asigna con
   profesional activo y afiliado, fecha, hora y la versión vigente, entonces se
   crea o reutiliza la asignación primaria, la cita pasa a `ASSIGNED`, la versión
   se incrementa y se escriben los eventos de auditoría en la misma transacción.
7. Dadas dos asignaciones simultáneas con la misma `expectedVersion`, cuando
   ambas llegan, entonces exactamente una tiene éxito y la otra recibe
   `409 APPOINTMENT_VERSION_CONFLICT` sin haber escrito nada.
8. Dado un profesional que ya tiene otra cita no cancelada en el mismo instante,
   cuando se intenta asignarle otra, entonces la API responde
   `409 APPOINTMENT_NOT_ASSIGNABLE` sin revelar la cita en conflicto.
9. Dado un cuerpo con un campo adicional, o con `tenantId`, o sin
   `expectedVersion`, cuando llega al PATCH, entonces la API responde `400` y
   nombra el campo, nunca su valor.
10. Dada una petición de mutación sin `Origin` ni `Referer`, o con un origen no
    listado en `API_WEB_ORIGINS`, entonces la API responde `403`.
11. Dado un tenant sin ningún profesional ni ninguna cita, cuando se abren las
    dos vistas, entonces se muestran estados vacíos honestos y **ningún** dato de
    demostración.
12. Dada una respuesta `401`, `403` o `503`, cuando la vista la recibe, entonces
    limpia el estado nominal y no conserva la respuesta anterior.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO llegue una petición a cualquiera de los cuatro endpoints, EL SISTEMA
  DEBERÁ resolver tenant y rol exclusivamente desde la sesión institucional
  persistida.
- SI la consulta contiene un parámetro fuera de la allowlist, ENTONCES EL
  SISTEMA DEBERÁ responder `400` sin ejecutar ninguna lectura de dominio.
- CUANDO se consulte la agenda, EL SISTEMA DEBERÁ exigir `from` y `to` y NO
  DEBERÁ elegir una ventana por su cuenta.
- EL SISTEMA DEBERÁ limitar toda ventana de agenda a 31 días inclusivos.
- CUANDO se asigne una solicitud, EL SISTEMA DEBERÁ escribir la asignación, la
  actualización de la cita y sus eventos de auditoría en una única transacción, o
  no escribir nada.
- SI la versión enviada no coincide con la persistida, ENTONCES EL SISTEMA
  DEBERÁ responder `409` sin modificar la cita.
- SI el profesional no existe, es de otro tenant, tiene perfil inactivo o carece
  de afiliación activa, ENTONCES EL SISTEMA DEBERÁ responder el mismo `404`.
- EL SISTEMA NO DEBERÁ conceder `DELETE` sobre ninguna de las cuatro tablas al
  rol de ejecución.
- SI faltan `MERDN_HOSPITAL_SCHEDULER_CODE` o `MERDN_HOSPITAL_SCHEDULER_SECRET`,
  ENTONCES EL SISTEMA DEBERÁ omitir la identidad y esa superficie DEBERÁ
  responder como no autenticada, sin recurrir a ningún código por defecto.
- CUANDO el contexto de ejecución seguro no pueda confirmarse, EL SISTEMA DEBERÁ
  responder `503` y NO DEBERÁ degradar a una ejecución sin RLS.
- EL SISTEMA NO DEBERÁ publicar documento, contacto, dirección, diagnóstico,
  cuidador ni motivo clínico de ningún paciente en estas superficies.
- EL SISTEMA NO DEBERÁ derivar disponibilidad, conflicto clínico, calificación,
  rendimiento ni vínculo laboral acreditado.
- CUANDO una vista reciba un error, EL SISTEMA DEBERÁ limpiar el estado nominal y
  NO DEBERÁ replegarse a datos de demostración.

## Ámbito de archivos / File scope

- `prisma/migrations/20260822160000_hospital_core_02/migration.sql` — enums, cuatro tablas, privilegios y RLS
- `prisma/migrations/ROLLBACK-hospital_core_02.sql` — rollback documental, no ejecutado
- `prisma/schema.prisma` — modelos `ProfessionalProfile`, `ProfessionalAffiliation`, `CareAssignment`, `Appointment` (líneas 750-944)
- `apps/api/src/hospital/hospital.contract.ts` — DTO, catálogo de profesiones, códigos de error, ventana máxima
- `apps/api/src/hospital/hospital-professionals.controller.ts` `.service.ts` `.dto.ts` `.query.ts` `.query.test.ts`
- `apps/api/src/hospital/hospital-agenda.controller.ts` `.service.ts` `.dto.ts` `.query.ts`
- `apps/api/src/hospital/hospital-appointment-assignment.controller.ts` `.service.ts` `.dto.ts` `.request.ts` `.request.test.ts` `.origin.ts`
- `apps/api/src/hospital/hospital.module.ts` — registro de los tres controladores nuevos
- `apps/api/src/institutional-auth/hospital-scheduler.guard.ts` y `.guard.test.ts`
- `apps/api/src/institutional-auth/institutional-auth.contract.ts` `.config.ts` `.unit.test.ts` — rol y aprovisionamiento fail-closed
- `apps/api/src/main.ts` — `PATCH` añadido a los métodos de CORS
- `apps/api/test/hospital-core-02-fixtures.ts` `hospital-professionals.api.test.ts` `hospital-agenda.api.test.ts` `hospital-core-02.db.test.ts` `openapi.test.ts`
- `apps/web/src/features/hospital/hospitalProfessionalsClient.ts` y `.test.ts`
- `apps/web/src/features/hospital/hospitalAgendaClient.ts` y `.test.ts`
- `apps/web/src/features/hospital/HospitalProfessionals.tsx` `ProfessionalDetailPanel.tsx` `ProfessionalEngagementPanel.tsx`
- `apps/web/src/features/hospital/hospitalProfessionalsConfig.ts` `hospitalProfessionalsListado.ts` `hospitalProfessionals.module.css` `hospitalProfessionals.test.tsx`
- `apps/web/src/features/hospital/HospitalAgenda.tsx` `hospitalAgendaConfig.ts` `hospitalAgenda.module.css` `hospitalAgenda.test.tsx`
- `apps/web/src/features/hospital/hospitalAlcance.test.ts` `hospitalTestUtils.ts` — gate estático de alcance

## Estado real y límites conocidos

**Lo más importante de esta spec.** Todo lo siguiente está medido contra el
código el 2026-08-25.

1. **No existe ninguna vía autorizada para crear un profesional, una afiliación
   ni una cita.** El rol de ejecución tiene `SELECT` sobre `professional_profile`
   y `professional_affiliation`, y `SELECT, UPDATE` —no `INSERT`— sobre
   `appointment` (`migration.sql:345-348`). No hay endpoint ni comando que los
   cree: `grep professionalProfile.create` solo aparece en
   `apps/api/test/**`. **Un despliegue real muestra estados vacíos para
   siempre**, y la única mutación autorizada no puede ejercerse porque nunca
   habrá una solicitud `REQUESTED`. La capacidad es hoy demostrable únicamente
   con fixtures de prueba creados por el rol propietario.

2. **Row Level Security en escritura está `UNVERIFIED`.**
   `apps/api/test/hospital-core-02.db.test.ts:57` condiciona las pruebas de
   escritura a `availability.engine === 'postgresql-server'`; la compilación
   WebAssembly del entorno de desarrollo aborta ante cualquier escritura bajo
   `SET LOCAL ROLE merdn_runtime`. Las **lecturas** bajo RLS y los **privilegios
   concedidos** sí se comprueban; la aplicación efectiva de `WITH CHECK`, la
   denegación de `DELETE`/`INSERT`/`UPDATE` en ejecución y la reutilización del
   pool quedan sin verificar. Los propios paquetes de corrección lo declararon
   gate obligatorio antes de preproducción, datos reales o despliegue.

3. **El check `audit_event_resource_required` no se endureció.**
   `migration.sql:48-60` lo declara explícitamente: `CARE_ASSIGNMENT_CREATED` y
   `APPOINTMENT_ASSIGNED` nombran su recurso porque la aplicación lo escribe
   siempre, pero **la base no lo obliga**, porque PostgreSQL prohíbe usar en la
   misma transacción un valor de enum añadido en ella. Endurecerlo exige otra
   migración que no se ha escrito.

4. **`HOSPITAL_SCHEDULER` ya no está confinado a este slice.**
   `TASK-HOSPITAL-CORE-02` §3.1 afirmaba que el rol accede «únicamente a los
   endpoints nuevos de este slice». Hoy `apps/api/src/visits/visits.controller.ts:140`
   protege `POST /api/v1/visits/materialize` con el mismo
   `HospitalSchedulerGuard`. La ampliación la hizo la spec 012; el límite
   original ya no describe el sistema.

5. **`MERDN_HOSPITAL_SCHEDULER_CODE` y `MERDN_HOSPITAL_SCHEDULER_SECRET` no
   están documentadas en `.env.example` ni en `compose.yml`.** Solo aparecen en
   `apps/api/src/**`, en `apps/api/test/**` y en las Task Specifications. Quien
   despliegue leyendo `.env.example` —que sí documenta las variables equivalentes
   del rol de relaciones paciente-cuidador (líneas 149-159)— no tiene forma de
   descubrir cómo habilitar esta superficie.

6. **`activePatientCount`, `todayAppointmentCount` y `nextAppointmentAt` se
   calculan y se envían, pero ninguna vista los muestra.** Están tipados en
   `hospitalProfessionalsClient.ts:61-63` y ningún componente de vista los lee:
   fuera de las pruebas, el único archivo que los nombra es el propio cliente.
   `hospitalProfessionals.test.tsx:406-408,608-610` los siembra con valores
   señuelo precisamente para comprobar que no se pintan.
   La recuperación visual de la spec 015 retiró la tira de métricas de la tarjeta
   y del panel por considerarlas afirmaciones sobre el desempeño de una persona.
   El coste de cálculo sigue pagándose en cada listado.

7. **La interfaz no expone orden ni tamaño de página.** La API acepta
   `sort=name|profession`, `direction=asc|desc` y `pageSize` 25 o 50;
   `HospitalProfessionals.tsx:380-386` envía siempre `'name'`, `'asc'` y el
   tamaño inicial fijo. Son capacidades de API sin control de interfaz.

8. **Todas las ventanas se calculan sobre el día UTC, no sobre el día
   colombiano.** `hospital.contract.ts:776-788` y
   `hospitalAgendaClient.ts:113-115` operan con `toISOString()`; no existe
   ninguna referencia a `America/Bogota` en la API ni en la web
   (`grep -rn "Bogota\|America/"` sin resultados en ambos árboles). En cambio
   `instanteDeFechaHora` (`hospitalAgendaClient.ts:168-183`) construye el
   instante en la zona del dispositivo. Consecuencia medible: una cita
   introducida a las 19:00 en Colombia (UTC-05) se serializa al día UTC
   siguiente y **no aparece** en la ventana del día que la persona seleccionó.

9. **No se valida que `scheduledStart` sea futuro.** No hay ninguna comparación
   contra `context.now` en `hospital-appointment-assignment.request.ts` ni en
   `.service.ts`. Es coherente con la decisión de no modelar disponibilidad, pero
   permite asignar una cita a un instante pasado.

10. **No se puede terminar ni reasignar una asignación de cuidado.** El rol de
    ejecución no tiene `UPDATE` sobre `care_assignment`, y el índice parcial
    `care_assignment_primary_active_unique` impone una sola asignación primaria
    activa por paciente. Si el paciente ya tiene una asignación activa con otro
    profesional, la operación se rechaza. Reasignar exige otra capacidad que no
    existe.

11. **No se puede cancelar ni reprogramar una cita.** `AppointmentStatus`
    incluye `CANCELLED` para que el contrato no cambie después, pero ningún
    endpoint lo produce. «Reprogramar» y «Rechazar con motivo» se muestran
    deshabilitadas y sin controlador (`HospitalAgenda.tsx:286-316`).

12. **No se modela duración ni solapamiento.** La única colisión bloqueada es la
    igualdad exacta de `scheduledStart` para el mismo profesional. Dos citas a
    las 10:00 y 10:01 conviven sin objeción.

13. **La identidad es institucional compartida y no nombra a nadie.** La
    auditoría atribuye el acto a la `InstitutionalIdentity` opaca, nunca a la
    profesional seleccionada. Por eso `TASK-HOSPITAL-CORE-02` §3.2 limitó el
    slice a desarrollo/MVP con datos ficticios o controlados. Ese límite sigue
    vigente.

14. **El catálogo de profesiones está duplicado a mano.**
    `hospital.contract.ts:384-395` (API) y `hospitalProfessionalsConfig.ts:80-92`
    (web) declaran los mismos siete códigos sin compartir origen en
    `packages/shared`. Una divergencia solo se manifestaría como un `400`.

15. **El shell no oculta las vistas por rol.** `HospitalShell.tsx:181-190` monta
    `HospitalAgenda` y `HospitalProfessionals` sea cual sea el rol de la sesión;
    la autoridad es la API, que responde `403`. Es coherente con «rotular un rol
    no concede nada», pero significa que la navegación muestra superficies que la
    sesión no puede usar.

16. **El gate de alcance ya no describe cuatro clientes.** `MINIMAL-CLOSE` cerró
    la capacidad con exactamente cuatro clientes de red y cuatro puntos de
    inyección. Hoy `hospitalAlcance.test.ts:57-64,125-131` declara **seis**
    clientes y **cinco** puntos de inyección, ampliados por las specs 012 y 014.
    El gate sigue siendo de igualdad exacta; lo que cambió es su contenido.

## Criterios de éxito

- Las dos vistas muestran exclusivamente registros persistidos del tenant de la
  sesión o estados vacíos honestos, sin ningún import runtime de fixtures
  factuales.
- Una solicitud puede asignarse una sola vez, con control optimista, y su
  vínculo, su cita y su auditoría son atómicos.
- Ningún parámetro de tenant, rol o actor enviado por el navegador es aceptado.
- `hospital-professionals.api.test.ts` (26 casos), `hospital-agenda.api.test.ts`
  (20), `hospital-core-02.db.test.ts` (18), `hospital-scheduler.guard.test.ts`
  (7), `hospital-professionals.query.test.ts` (15) y
  `hospital-appointment-assignment.request.test.ts` (13) pasan.
- `hospitalProfessionals.test.tsx` (57), `hospitalAgenda.test.tsx` (67),
  `hospitalProfessionalsClient.test.ts` (12), `hospitalAgendaClient.test.ts` (16)
  y `hospitalAlcance.test.ts` pasan. **Ninguna de estas suites se ejecutó el
  2026-08-25**: `node_modules` no está instalado; los recuentos proceden de leer
  los archivos, no de una ejecución. Ver `research.md` R19.
- Las pruebas de escritura bajo RLS pasan en un PostgreSQL normal con
  `MERDN_RUNTIME_ROLE=enforce`, rol no propietario y sin `BYPASSRLS`. **Este
  criterio no está satisfecho hoy.**
