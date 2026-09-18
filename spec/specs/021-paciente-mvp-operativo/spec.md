# Especificación 021 - Paciente MVP operativo

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `2026-08-26`
- Aprobado por / Approved by: `Product Owner`
- Evidencia de aprobación / Approval evidence: Aprobación formal explícita del Product Owner en la sesión del 2026-08-26 —«APRUEBO FORMALMENTE LA SPEC 021 — PACIENTE MVP OPERATIVO»—, sobre la spec con sus once decisiones de producto cerradas (§17.A, §17.B, §17.C), los tres asuntos de arquitectura resueltos por Codex (§17.D) y el veredicto `PASS WITH CORRECTIONS` de Codex ya aplicado. Decisiones de producto de respaldo: `spec/bitacora/decisiones/2026-08-26-alcance-paciente-mvp.md`, `2026-08-26-decisiones-paciente-mvp.md` y `2026-08-26-decisiones-finales-paciente-mvp.md`.

> **Aprobada el 2026-08-26, y todavía NO ejecutable.** La aprobación cierra el
> primero de los dos actos del Product Owner. Falta el segundo, y **no lo puede
> hacer Claude Code**:
>
> - **registrar el consentimiento por spec** con `confirm-user-consent.sh`
>   (`CLAUDE.md` §14.4, `AGENTS.md` §22.4).
>
> Mientras ese registro no exista, **la compuerta SDD no abre para la 021** y
> **no está autorizada ni una línea de código**, ni el contrato, ni la migración,
> ni el Micro-packet 1.
>
> **Estado de las decisiones.** **No queda ninguna decisión de producto abierta.**
> Las nueve que bloqueaban esta spec se cerraron (§17.B) y las dos concreciones
> que quedaban —la entrada post-inscripción y la lista de campos del resumen—
> también (§17.C).
>
> **Tampoco queda ningún asunto de arquitectura abierto.** Codex resolvió el
> 2026-08-26 los que el Product Owner le había delegado, y su resolución está
> transcrita en §17.D: **forma técnica de la auditoría** (§17.D-1), **superficie
> HTTP de la lectura self-scope** (§17.D-2) y **ubicación del cliente de sesión
> humana** (§17.D-3). Ninguna de las tres es decisión de producto.
>
> **Lo que la aprobación NO hace.** No registra consentimiento, no abre la
> compuerta, no autoriza commit, push, merge, integración ni despliegue
> (`CLAUDE.md` §12), y no convierte en aprobada ninguna decisión marcada como
> fuera de alcance en §18.

## Naturaleza de esta spec

**Prospectiva y de producto.** No es as-built: la experiencia de Paciente que hoy
existe en el repositorio es **demostrativa**, vive en memoria, no consulta al
servidor y no tiene sesión propia (`apps/web/src/features/paciente/`). Esta spec
define la primera experiencia de Paciente **operativa**: autenticada, con datos
propios reales del servidor, con logout revocable y con aislamiento verificado.

No reabre la inscripción (spec 007), no toca Hospital, Alcaldía, Visitador ni
Soporte, y no adelanta ninguna de las capacidades que el Product Owner dejó
fuera del MVP.

## 1. Task ID

**021-paciente-mvp-operativo** — Experiencia de Paciente autenticada, con
resumen propio, citas propias y visitas propias, para el hito del **2 de
septiembre de 2026**.

Numeración: se eligió **021** y no 019, porque los identificadores **019** y
**020** ya están ocupados en la rama `feat/visitador-mp02-corrections`
—`019-validacion-interactiva-visitador-mp02` y
`020-aviso-logout-fallido-visitador`— aunque no existan todavía en `develop`.
Reutilizar 019 provocaría una colisión de directorios al integrar Visitador.

## 2. Objetivo

Que una persona **paciente** pueda entrar a MERDN con su propia sesión, ver un
resumen mínimo de sí misma, ver **sus** citas y **sus** visitas domiciliarias, y
cerrar la sesión de verdad, en un dispositivo que puede ser compartido.

Valor para la persona: hoy no tiene ninguna forma de consultar lo suyo. La
pantalla que existe es una demostración que muestra tarjetas inertes y una
bitácora en memoria; nada de eso le dice cuándo es su próxima cita ni si su
visita quedó programada.

Valor para la institución: es la primera superficie de MERDN en la que el
**sujeto del dato** lo consulta directamente. Exige que el aislamiento
—tenant y self-scope— quede demostrado, no supuesto.

## 3. Contexto

### 3.1 Qué existe hoy, medido sobre `ad25520` (rama `develop`)

**Interfaz de Paciente — demostrativa.**

| Hecho | Evidencia |
|---|---|
| La experiencia de Paciente es efímera: `useState` / `useReducer`, sin red, sin Server Actions y sin almacenamiento del navegador | `apps/web/src/features/paciente/PacienteExperience.tsx:22-27` |
| Las cinco tarjetas —`MIS CITAS`, `PEDIR AYUDA`, `MI SALUD`, `MI CUIDADOR`, `MIS PAGOS`— son superficies inertes, con `aria-disabled="true"` | `apps/web/src/features/paciente/InicioPaciente.tsx:30-71`, `:161-167` |
| Los cuatro accesos rápidos —`Consulta Virtual`, `Visita en Casa`, `Ir al Hospital`, `Mensajes`— también son inertes | `InicioPaciente.tsx:73-99`, `:191-197` |
| Las cinco pestañas inferiores son inertes | `InicioPaciente.tsx:100-107`, `:226-248` |
| La **única** acción con efecto es abrir la bitácora de ocho etapas, en memoria | `InicioPaciente.tsx:145`, `bitacoraFlow.ts` |
| No existe ruta `/paciente`: la única ruta es `/`, que compone `ExperienciaMerdn` | `apps/web/src/app/page.tsx:15-17` |

**Entrada actual a la experiencia — cookie de inscripción, no sesión de acceso.**

`ExperienciaMerdn` comprueba en cada carga `GET /api/v1/patients/me` y, si hay
paciente, sustituye la inscripción por la experiencia de Paciente
(`ExperienciaMerdn.tsx:80-92`, `:94-105`). Esa comprobación usa la **cookie de
autoinscripción**, que es una entidad distinta de la sesión humana y **no tiene
endpoint de cierre**: `apps/api/src/patients/patient-enrollment.controller.ts`
expone exactamente `POST /enrollments` (`:73`) y `GET /me` (`:149`), y ningún
`logout`.

**Sesión humana — sí existe, sí es revocable, y ya conoce el contexto `PATIENT`.**

| Hecho | Evidencia |
|---|---|
| Flujo único OIDC Authorization Code + PKCE S256, sin repliegue y fail-closed | `apps/api/src/human-auth/human-auth.contract.ts:11-17` |
| Cookie propia `merdn_human_session`, distinta de la de inscripción y de la institucional | `human-auth.contract.ts:28` |
| Rutas: `GET /login` `:85`, `GET /callback` `:112`, `GET /session` `:174`, `POST /logout` `:233` | `apps/api/src/human-auth/human-auth.controller.ts` |
| El logout **revoca** y conserva la fila para trazabilidad; exige mismo origen y límite de intentos | `human-auth.controller.ts:224-232`, `:239-247` |
| Vigencia absoluta 8 h; inactividad máxima 30 min | `human-auth.contract.ts` `HUMAN_SESSION_TTL_SECONDS`, `HUMAN_SESSION_IDLE_SECONDS` |
| `PATIENT` es uno de los tres contextos humanos, derivado **en el servidor** | `human-auth.contract.ts` `HUMAN_CONTEXTS`; `apps/api/src/human-auth/me-contexts.controller.ts` |
| `resolvePatient` ya devuelve el `patientId` de la persona autenticada, filtrando por tenant **además** de RLS, y solo si el paciente está `ACTIVE` | `apps/api/src/identity-access/identity-access.service.ts:51-61` |
| El `patientId` **no** se devuelve nunca al cliente: se queda en el servidor | `apps/api/src/identity-access/human-contexts.service.ts:63-70` |
| Existe cliente web reutilizable de sesión humana —consultar, cerrar, interpretar el cierre— | `apps/web/src/features/hospital/hospitalHumanSessionClient.ts:182`, `:239`, `:278` |

**Datos propios — el modelo ya los sostiene.**

| Hecho | Evidencia |
|---|---|
| `Appointment` lleva `tenantId` y `patientId`, con FK compuesta que impide cruzar tenants | `prisma/schema.prisma:913-944` |
| `HomeVisit` lleva `tenantId` y `patientId`, no borra en cascada y conserva procedencia | `prisma/schema.prisma:1305-1348` |
| RLS por tenant activa en `appointment` | `prisma/migrations/20260822160000_hospital_core_02/migration.sql:353`, `:372` |
| RLS por tenant activa y **forzada** en `home_visit` y `home_visit_transition` | `prisma/migrations/20260824120000_visits_core_01/migration.sql:380-394` |

### 3.2 Los tres huecos reales

1. **No existe ninguna API de lectura con alcance de paciente.** Las consultas de
   citas y de visitas que hoy existen son de **profesional** o de **institución**:
   `GET /api/v1/hospital/agenda` (`apps/api/src/hospital/hospital-agenda.controller.ts:63-70`)
   y las rutas profesionales de visitas
   (`apps/api/src/visits/visits.controller.ts:255-404`). Ninguna sirve al sujeto
   del dato.
2. **No existe camino aprobado de la inscripción a una cuenta autenticada.** La
   `HumanAccount` y su `ExternalAuthIdentity` las crea **exclusivamente** el
   aprovisionamiento administrativo: «NO existe autorregistro, ni autovinculación
   por claims, ni creación implícita de cuenta en el callback»
   (`prisma/schema.prisma:1069-1078`). Inscribirse **no** produce cuenta.
3. **No existe evento de auditoría para la lectura propia.** El `enum
   AuditEventType` (`prisma/schema.prisma:124-171`) tiene 47 valores y ninguno
   describe a un paciente leyendo lo suyo.

Los tres huecos están **decididos** desde el 2026-08-26 (§17.B): el 1 se cubre
con un módulo nuevo de lectura self-scope; el 2 con aprovisionamiento
administrativo y **sin construir autorregistro**; y el 3 con una migración
**aditiva mínima** del enum, cuya forma técnica exacta define Codex.

## Historia de usuario principal

Como persona paciente de MERDN, quiero entrar con mi propia sesión y ver mi
resumen, mis citas y mis visitas, y poder cerrar la sesión de verdad cuando
termino, para saber qué me corresponde sin depender de nadie y sin dejar mi
información abierta en un equipo que otros usan.

## 4. Usuarios afectados

- **Rol:** persona con contexto humano `PATIENT` vivo en el tenant, derivado en
  el servidor. Es el único rol que esta spec habilita.
- **Institución y tenant:** el tenant lo aporta el principal de la sesión humana.
  El cliente no lo envía, no lo elige y no puede cambiarlo.
- **Relaciones:** **ninguna**. Esta spec **no** habilita a la persona cuidadora,
  aunque el contexto `CAREGIVER` exista en el modelo. Ver un paciente por
  relación es capacidad distinta y está fuera del MVP.
- **No afectados:** Hospital, Alcaldía, Visitador, Soporte de Plataforma,
  Cuidador y Reportes. Ninguna superficie existente cambia de comportamiento.
  **Matiz del 2026-08-26 (§17.D-3):** la extracción del cliente de sesión humana
  a un módulo compartido **toca dos archivos de Hospital** —el cliente y su
  prueba—, que quedan convertidos en **fachada compatible**. Es un cambio de
  **ubicación del código**, no de comportamiento: la superficie que Hospital
  importa y las respuestas que observa son las mismas, y la prueba de regresión
  de Hospital es obligatoria (§16). Riesgo de regresión evaluado por Codex:
  **BAJO**.

## 5. Módulos afectados

**Dentro de alcance**

- API: un módulo de lectura **self-scope** para la persona paciente autenticada
  —resumen, citas, visitas—, montado sobre la sesión humana y sobre
  `resolvePatient`.
- Web: una experiencia de Paciente **operativa**, con sus estados y su cierre de
  sesión, y el cliente HTTP correspondiente.
- Web, compartido: el **cliente de sesión humana** pasa a
  `apps/web/src/features/auth/`, y `features/hospital/` conserva una **fachada
  compatible** que reexporta la misma superficie (§17.D-3). Se reutiliza lógica
  de seguridad ya probada en vez de duplicarla.
- Auditoría: registro de acceso propio, **obligatorio** (§17.B-4), con **dos**
  valores nuevos del `enum AuditEventType` y una migración **aditiva mínima**
  (§9, §17.D-1).

**Fuera de alcance**

Hospital, Alcaldía, Visitador, Soporte, inscripción (spec 007), municipio,
territorio, consentimientos, relaciones paciente–cuidador, agenda profesional,
transiciones de visita, materialización de visitas, reportes, y toda escritura
de cualquier clase. Esta spec es **de solo lectura** salvo el propio cierre de
sesión.

## 6. Requisitos funcionales

### Acceso y sesión

1. **Acceso autenticado por sesión humana OIDC.** La experiencia operativa de
   Paciente solo se muestra cuando el **servidor** confirma una **sesión humana
   OIDC** vigente **y** el contexto `PATIENT` entre los contextos derivados. La
   interfaz no decide el contexto y no lo puede ampliar. La **cookie de
   autoinscripción no es la sesión del portal** y no abre esta experiencia
   (§17.B-1).
2. **Fail-closed.** Sin sesión, con sesión caducada por vigencia absoluta o por
   inactividad, con sesión revocada, con cuenta deshabilitada o con el servicio
   no disponible, la persona **no** ve ningún dato propio. La denegación es
   uniforme y no revela cuál de esos casos ocurrió.
3. **Recuperación de sesión.** Al recargar la página, la sesión se recupera
   consultando al servidor. No se guarda paciente, identificador, token ni dato
   personal en `localStorage`, `sessionStorage`, IndexedDB ni en la URL, y un
   identificador puesto a mano en la URL no concede acceso a ningún registro.
4. **Logout real y revocable.** Cerrar sesión llama al servidor, que **revoca**
   la sesión y borra la cookie. Al volver, no hay dato propio en pantalla.
5. **Comportamiento seguro en dispositivo compartido.** Tras un cierre
   confirmado, ningún dato del paciente permanece en pantalla ni en memoria de
   la vista: resumen, citas y visitas se descartan.
6. **Cierre no confirmado.** Si el servidor no confirma el cierre, la sesión
   sigue abierta, la pantalla **lo dice**, no afirma que se cerró y ofrece
   reintentar.

### Entrada post-inscripción (§17.C-1)

6-a. **La inscripción termina en confirmación, no en portal.** Tras una
   inscripción exitosa, `/` muestra una **confirmación clara de «Inscripción
   completada»**. La persona **no** entra automáticamente a la experiencia
   autenticada de Paciente.

6-b. **La cookie de inscripción solo confirma y completa la inscripción.** No es
   sesión permanente del portal, no abre la experiencia de Paciente y no otorga
   acceso a ninguna cita ni visita. Es exactamente el papel que ya tiene hoy en
   `GET /api/v1/patients/me`, y no se amplía.

6-c. **Existe una entrada separada «Ingresar como Paciente».** Es un control
   distinto de la confirmación, y lleva al acceso autenticado por **sesión humana
   OIDC canónica**. No hay ningún otro camino al portal.

6-d. **Las identidades de prueba y piloto se aprovisionan administrativamente**,
   con el mecanismo seguro existente. **No se crea autorregistro nuevo de
   identidad** (§17.B-2): ni en el callback, ni por claims, ni como efecto de la
   inscripción.

### Superficie HTTP — fijada por Codex (§17.D-2)

6-e. **Tres endpoints, exactamente estos tres.** La lectura self-scope del
   Paciente se expone **solo** en:

   | Método | Ruta | Proyección |
   |---|---|---|
   | `GET` | `/api/v1/patient-self/summary` | resumen del paciente (§6.7) |
   | `GET` | `/api/v1/patient-self/appointments` | citas propias (§6.8) |
   | `GET` | `/api/v1/patient-self/visits` | visitas propias (§6.9) |

   La lista es **cerrada**. Un cuarto endpoint, una variante de detalle, un
   `POST`, un `PATCH` o una ruta parametrizada —`/patient-self/:id` de cualquier
   forma— quedan fuera de esta spec y son STOP (§19.15). El único `POST` que la
   experiencia usa es el **logout de la sesión humana ya existente**, que esta
   spec **no** crea y **no** modifica.

6-f. **Reglas obligatorias de los tres, sin excepción.**

   1. **Ningún selector de sujeto desde el cliente:** ni `patientId`, ni
      `personId`, ni `subject`, ni documento, ni tenant, ni institución, en
      ruta, consulta, cuerpo o cabecera. No existe en la firma, luego no se
      puede pasar por descuido; si llegara igualmente, se **ignora** y la
      respuesta **no cambia** (§6.8, §16).
   2. **Sujeto derivado exclusivamente del principal autenticado**, con
      `resolvePatient` en el servidor.
   3. **Self-scope:** toda fila devuelta es del paciente de la persona
      autenticada.
   4. **Tenant y RLS:** filtro explícito por `tenantId` **además** de la RLS ya
      activa en `appointment` y forzada en `home_visit`.
   5. **Protección IDOR:** demostrada por prueba comparando la respuesta con y
      sin selector ajeno, no por inspección.
   6. **Paciente no `ACTIVE` → fail-closed:** no resuelve contexto, no devuelve
      filas y no revela que exista.

### Datos propios

7. **Resumen básico — lista CERRADA de tres campos (§17.B-5, §17.C-2).** El
   resumen del Paciente se limita **exactamente** a:

   1. **nombre de pila**;
   2. **iniciales**;
   3. **etiqueta fija `Paciente`**.

   **Nada más.** La lista es cerrada, no ilustrativa: cualquier cuarto campo está
   fuera de la decisión aprobada, y añadirlo es una STOP CONDITION (§19.12).

   **Prohibido expresamente en el resumen**, por decisión del Product Owner y no
   solo por minimización: documento; fecha de nacimiento; sexo o género; EPS;
   territorio; diagnósticos; información clínica; identificadores técnicos;
   información de terceros; **y cualquier otro dato no incluido en la lista de
   tres**. Prohibido además, como ya estaba: dirección exacta, teléfono, correo y
   detalle de consentimiento.

   La etiqueta `Paciente` es **fija**: no se deriva de datos, no varía por
   persona y no comunica ningún estado.
8. **Citas propias, exclusivamente.** La lista contiene **solo** citas cuyo
   `patientId` es el de la persona autenticada, resuelto en el servidor. La
   petición **no** admite `patientId`, documento ni ningún selector de sujeto: si
   llegara uno, se ignora, y la respuesta no cambia.
   **Contenido aprobado (§17.B-6):** **próximas** citas propias, con fecha y
   hora, **modalidad**, **estado** y los datos mínimos necesarios.
9. **Visitas propias, exclusivamente.** Idéntica regla de alcance.
   **Contenido aprobado (§17.B-6):** visitas propias **recientes**, con fecha y
   hora, modalidad cuando aplique, **estado** y los datos mínimos necesarios.
   **Regla común a citas y visitas (§17.B-6):** **ningún identificador técnico**
   —`id`, `patientId`, `careAssignmentId`, `appointmentId`, `homeVisitId`— y
   **ninguna información de terceros**: nombre de profesional, identidad
   institucional, asignación o actor de una transición.
10. **Sin lectura ajena por ninguna vía.** No existe parámetro, cabecera, orden,
    filtro, paginación ni error que permita observar una cita o una visita de
    otra persona, de otro tenant o de un paciente no `ACTIVE`.
11. **Sin escritura.** El Paciente no crea, no modifica, no cancela y no
    reagenda nada. Toda la superficie es de lectura, salvo `POST` de logout.

### Estados de la interfaz

12. La experiencia debe cubrir, de forma observable y distinguible, y sin
    comunicar ninguno **solo** por color:
    - `loading` — hay una consulta en curso;
    - `empty` — la consulta respondió y no hay citas, o no hay visitas;
    - `error` — la consulta falló;
    - `retry` — desde `error`, la persona puede volver a intentarlo, y el
      reintento vuelve a salir al servidor;
    - `sesión expirada` — la sesión dejó de ser válida durante el uso;
    - `acceso no autorizado` — hay sesión humana pero **no** contexto `PATIENT`.
13. `empty` y `error` son estados **distintos**. Un fallo nunca se presenta como
    «no tienes citas».
14. La expiración de sesión no se presenta como error de datos, y no deja en
    pantalla datos cargados antes.

### Superficie demostrativa

15. **Los controles fuera del MVP se OCULTAN de la experiencia operativa
    (§17.B-7).** El Product Owner eligió ocultar, y no marcar: ayuda urgente,
    bitácora clínica, pagos, mensajes, cuidador, consulta virtual, historia
    clínica y cualquier otra función demostrativa fuera del alcance **no
    aparecen** en la experiencia operativa del Paciente. Un control inerte pero
    visible sigue prometiendo una capacidad que no existe.
16. **Su código NO se borra (§17.B-7).** Ocultar es dejar de montarlo, no
    eliminarlo. `BitacoraPaciente.tsx`, `bitacoraFlow.ts` y sus pruebas
    permanecen en el repositorio, intactos y en la denylist (§13). Solo una
    implementación futura **autorizada** podría retirarlos.

### Accesibilidad

17. Semántica real, foco visible y manejable por teclado, etiquetas y errores
    legibles, y anuncio por región viva `polite` de los cambios de estado de
    sesión y de carga. Ningún estado crítico se comunica solo por color
    (`CLAUDE.md` §7.14).

## 7. Requisitos de datos

**Entradas.** Ninguna del cliente salvo la cookie de sesión humana. En concreto,
la API de esta spec **no acepta** `patientId`, documento, tenant, institución ni
ningún selector de sujeto.

**Salidas.** Tres proyecciones minimizadas, ya decididas en §17.B-5 y §17.B-6:

| Proyección | Contenido aprobado | Prohibido en la respuesta |
|---|---|---|
| Resumen del paciente | **lista cerrada de tres campos**: nombre de pila, iniciales y etiqueta fija `Paciente` (§17.C-2) | **todo lo demás**, y en particular: documento, **fecha de nacimiento**, **sexo o género**, EPS, territorio, diagnósticos, información clínica, identificadores técnicos e información de terceros; más dirección exacta, teléfono, correo, `patientId`, `personId`, `humanAccountId` y detalle de consentimiento |
| Citas propias | **próximas** citas: fecha y hora, modalidad, estado, datos mínimos | identificadores técnicos de cualquier clase; datos de profesional, de asignación o de cualquier tercero; nota clínica |
| Visitas propias | visitas **recientes**: fecha y hora, modalidad cuando aplique, estado, datos mínimos | identificadores técnicos; identidad institucional que materializó la visita; historial de transiciones y su actor |

**Propietario e institución.** Todo dato pertenece al tenant del principal.
Ninguna consulta cruza tenant.

**Procedencia y linaje.** Sin cambio: esta spec **lee** registros existentes y no
crea, no corrige y no reinterpreta ninguno. No deriva indicadores, no calcula
porcentajes y no produce dato oficial de ninguna clase.

**Sensibilidad.** Cita y visita son dato **operativo-asistencial** del sujeto.
Que el sujeto sea quien lee no relaja la minimización: se devuelve lo necesario
para la pantalla aprobada y nada más.

**Retención.** Sin cambio. Esta spec no persiste nada nuevo salvo los eventos de
auditoría, que son obligatorios (§9, §17.B-4).

**Minimización.** Regla dura: si un campo no se pinta en la pantalla aprobada,
no viaja en la respuesta.

**Datos de prueba.** Exclusivamente ficticios, en toda prueba, fixture, seed y
demostración (`CLAUDE.md` §7.11). Ningún dato real de paciente hasta el
hardening y la aceptación final —§17.A, punto 15—.

## 8. Permisos

- **Autenticación:** sesión humana OIDC vigente, verificada por el guard
  existente. Sin ella, `401` uniforme.
- **Autorización — self-scope:** el sujeto de toda consulta es **el paciente de
  la persona autenticada**, resuelto en el servidor con `resolvePatient`
  (`identity-access.service.ts:51-61`). El cliente no lo envía y no lo puede
  influir.
- **Alcance contextual:** tenant del principal, paciente `ACTIVE`. Un paciente no
  `ACTIVE` no resuelve contexto y por tanto no lee nada.
- **Denegaciones requeridas:**
  - sin sesión humana → `401`, uniforme;
  - con sesión humana pero sin contexto `PATIENT` → denegación **sin** revelar
    si existe algún paciente asociado;
  - contexto de ejecución de base de datos no seguro → `503` fail-closed, nunca
    degradación a acceso concedido;
  - cualquier intento de indicar sujeto → ignorado, nunca honrado.
- **Sin suma implícita de contextos:** una persona que sea a la vez paciente y
  profesional **no** ve como profesional desde esta superficie, ni al revés
  (`human-contexts.service.ts:22-27`).
- **Consentimiento y relaciones:** no aplican. Esta spec **no** habilita acceso
  por relación paciente–cuidador.

## 9. Auditoría

**Obligatoria.** El Product Owner decidió el 2026-08-26 (§17.B-4) que el acceso
propio del Paciente **debe quedar auditado**, y que **no se elimina la auditoría
para ahorrar tiempo**. No hay variante «sin auditoría» de este MVP.

### 9.1 Forma técnica — RESUELTA por Codex el 2026-08-26 (§17.D-1)

**Dos valores nuevos del `enum AuditEventType`, y solo dos:**

```
PATIENT_SELF_ACCESS_GRANTED
PATIENT_SELF_ACCESS_DENIED
```

**No** se crea un valor por endpoint. Resumen, citas y visitas se **diferencian
en el propio evento**, no en el enum, mediante los dos campos que la tabla
`audit_event` ya tiene:

| Campo | Qué distingue |
|---|---|
| `resourceType` | la proyección leída: `PatientSelfSummary`, `PatientSelfAppointments`, `PatientSelfVisits` |
| `endpoint` | la ruta exacta de §6.6-e que atendió la petición |

Multiplicar el enum por endpoint sería una migración mayor de la necesaria y
rompería el límite «aditiva **y mínima**» que fijó el Product Owner (§17.B-4).

**El registro vive en el servicio de auditoría existente**
—`apps/api/src/audit/audit.service.ts`—, con el mismo patrón append-only que ya
usan Hospital, Municipio, Visitas y Soporte. **No** se crea un servicio de
auditoría propio del módulo: duplicarlo duplicaría la superficie de seguridad
sin ganar nada.

### 9.2 Reglas del evento

1. **Solo se registra el intento con principal humano resoluble.** Una petición
   sin principal humano —sin cookie, con cookie inválida, con sesión ya
   revocada— **no** genera evento de esta familia.
2. **Prohibido el actor ficticio.** Si no hay principal humano resoluble,
   **no** se inventa un actor, no se usa un valor de relleno, no se registra
   `anonymous` y no se cae a `PUBLIC_SELF_ENROLLMENT`. Se deniega sin evento de
   acceso propio. La petición sin principal ya queda cubierta por el `401`
   uniforme de §8.
3. **Actor `HUMAN_ACCOUNT` opaco:** `actorUserId` es `HumanAccount.id`. No es un
   nombre, ni un documento, ni el `subject` del proveedor OIDC. `actorRole`
   queda **nulo**: la restricción `audit_event_actor_role_scope` de la base solo
   admite rol junto a un actor institucional.
4. **Campos obligatorios del evento:** `tenantId`, `eventType`, `actorType`,
   `actorUserId`, `resourceType`, `outcome` —`SUCCESS` para el concedido,
   `DENIED` para el denegado—, `endpoint`, `correlationId` y `occurredAt`.
5. **Sin PII y sin contenido clínico.** El evento **no** registra documento,
   nombre, iniciales, dirección, territorio, EPS, fecha de nacimiento, sexo o
   género, ni el contenido de la cita o de la visita —fecha, hora, modalidad,
   estado—. Tampoco registra el motivo de la denegación con detalle suficiente
   para deducir si existe un paciente asociado (`CLAUDE.md` §7, cierre).
6. **Fail-closed de la propia auditoría.** Si el evento **obligatorio** no se
   puede persistir, la petición **falla**: no se devuelven datos del paciente
   con la traza perdida. Auditoría obligatoria que no se escribe es acceso no
   auditado, y el Product Owner ya decidió que no existe variante sin auditoría
   (§17.B-4).
7. **Inmutable.** Append-only, sin `UPDATE` ni `DELETE`, y no modificable por
   roles ordinarios.

### 9.3 Migración — aditiva y mínima

Hoy el `enum AuditEventType` (`prisma/schema.prisma:124-171`) no tiene ningún
valor para un paciente leyendo lo suyo. El Product Owner autorizó una **migración
aditiva mínima y segura** del enum (§17.B-4) con la condición de que **quede
explícita en esta spec**. Queda explícita aquí, y Codex la concretó así:

- **exactamente dos** valores nuevos del enum —`PATIENT_SELF_ACCESS_GRANTED` y
  `PATIENT_SELF_ACCESS_DENIED`—, **nunca** renombrar, reordenar ni eliminar uno
  existente;
- una sola migración,
  `prisma/migrations/<timestamp>_patient_self_audit_event_type/migration.sql`,
  con **solo** las sentencias `ALTER TYPE ... ADD VALUE` correspondientes;
- su rollback en `prisma/migrations/ROLLBACK-patient_self_audit_event_type.sql`,
  siguiendo la convención ya establecida en el repositorio, donde los
  `ROLLBACK-*.sql` viven **junto** a los directorios de migración y no dentro de
  ellos;
- sin pérdida de datos y sin romper compatibilidad;
- **ninguna** otra tabla, columna, índice, restricción, política RLS ni valor de
  ningún otro enum.

Cualquier cosa que exceda eso es una STOP CONDITION (§19.3).

### 9.4 Rollback — condiciones duras

PostgreSQL no admite retirar un valor de un enum sin recrear el tipo, de modo
que el rollback es **condicional y verificable**, no incondicional:

1. **Permitido únicamente si NO existe ningún evento dependiente**, es decir,
   ninguna fila de `audit_event` con `eventType` en
   {`PATIENT_SELF_ACCESS_GRANTED`, `PATIENT_SELF_ACCESS_DENIED`}.
2. **Debe detenerse y rechazar la operación si existe al menos uno.** El script
   comprueba primero y aborta con error explícito; **no** borra eventos, **no**
   los reasigna a otro tipo y **no** continúa «porque son pocos».
3. **Cero pérdida de eventos.** Ningún camino del rollback puede eliminar,
   sobrescribir ni alterar una fila de `audit_event`. La traza es material
   (`CLAUDE.md` §7, cierre).
4. Un rollback rechazado por eventos dependientes **no** es un fallo del
   paquete: es el comportamiento correcto, y así se prueba (§16).

Las sesiones humanas ya registran su creación y su revocación
(`HUMAN_SESSION_CREATED`, `HUMAN_SESSION_REVOKED`), y eso **no** cambia.

Los eventos son inmutables y no modificables por roles ordinarios.

## 10. Seguridad

| Amenaza | Control |
|---|---|
| **IDOR** — leer la cita o la visita de otra persona | El sujeto no viaja en la petición; se resuelve en el servidor. Prueba obligatoria §16 |
| **Cruce de tenants** | RLS activa en `appointment` y forzada en `home_visit`, **más** filtro explícito por tenant en la consulta. Prueba obligatoria §16 |
| **Sesión residual en equipo compartido** | Logout revocable en el servidor; sin dato en pantalla tras cerrar; aviso explícito si el cierre no se confirma (§6.6) |
| **Escalada de contexto** — usar el contexto de paciente para ver como profesional o cuidadora | Sin suma implícita: cada capacidad conserva su comprobación (§8) |
| **Fuga por enumeración o por mensaje de error** | Denegación uniforme; los errores no distinguen ausencia, caducidad, revocación ni inexistencia |
| **Fuga por almacenamiento del navegador o por la URL** | Prohibido persistir en el cliente; ningún identificador en la URL concede acceso (§6.3) |
| **Falso cierre de sesión** | La pantalla nunca afirma un cierre que el servidor no confirmó (§6.6) |
| **Exceso de datos en la respuesta** | Regla dura de minimización (§7) |
| **CSRF sobre el cierre** | El logout ya exige mismo origen y límite de intentos (`human-auth.controller.ts:239`) |
| **Datos reales expuestos antes de tiempo** | Solo datos ficticios hasta hardening y aceptación final (§17.A, punto 15) |

**Secretos:** ninguno nuevo. Esta spec no añade variable de entorno, credencial
ni clave, y no las escribe en código, fixtures, logs ni documentación.

## 11. Referencia visual

`prototype-claude/` es referencia **de composición y de UX**, de solo lectura, y
esta spec **no lo toca** (`CLAUDE.md` §6).

Vinculante: la coherencia con la línea de marca **ELOISA** ya implementada en la
aplicación productiva —`apps/web/src/components/ui/`, `PhoneShell`, iconografía
semántica y tokens de estilo existentes—.

**No vinculante:** las tarjetas, accesos rápidos y pestañas del prototipo que
corresponden a capacidades fuera del MVP. Su presencia en el prototipo **no**
autoriza representarlas como funcionales (`CLAUDE.md` §5, cierre).

## 12. Archivos permitidos

Allowlist **propuesta por capas**. Queda cerrada cuando el Product Owner apruebe
esta spec; hasta entonces es una propuesta, no una autorización.

**Capa 1 — API, lectura self-scope (nuevo módulo)**

- `apps/api/src/patient-self/` — controlador, servicio, consulta, DTO, contrato y
  sus pruebas. Directorio nuevo, sin mezclar responsabilidades con `hospital/`
  ni con `visits/`.
- `apps/api/src/app.module.ts` — **solo** el registro del módulo nuevo.

**Capa 1-bis — Pruebas de servidor**

- `apps/api/test/patient-self.api.test.ts` — pruebas de API self-scope. Nuevo.
- `apps/api/test/patient-self.db.test.ts` — pruebas de DB, RLS, multitenant e
  IDOR. Nuevo.

Ambos siguen la convención ya existente en `apps/api/test/` —`*.api.test.ts` y
`*.db.test.ts`—, y **ningún otro archivo de ese directorio se toca**.

**Capa 2 — Auditoría (obligatoria, §17.B-4; forma técnica §17.D-1)**

- `prisma/schema.prisma` — **solo** los **dos** valores aditivos del
  `enum AuditEventType`: `PATIENT_SELF_ACCESS_GRANTED` y
  `PATIENT_SELF_ACCESS_DENIED`. Nada más de ese archivo.
- `prisma/migrations/<timestamp>_patient_self_audit_event_type/migration.sql` —
  migración nueva, **solo** los `ALTER TYPE ... ADD VALUE` de esos dos valores.
- `prisma/migrations/ROLLBACK-patient_self_audit_event_type.sql` — rollback
  condicional de §9.4, en la ubicación que ya usan los nueve `ROLLBACK-*.sql`
  existentes. Es **exigido** por §9.3, no una ampliación de alcance.
- `apps/api/src/audit/audit.service.ts` — **solo** los métodos de registro del
  acceso propio concedido y denegado.
- `apps/api/src/audit/audit.service.test.ts` — pruebas unitarias del servicio de
  auditoría. Nuevo.

**Capa 3 — Web, cliente HTTP y cliente de sesión (§17.D-3)**

- `apps/web/src/features/paciente/pacienteSelfClient.ts` y su prueba
  `pacienteSelfClient.test.ts`.
- `apps/web/src/features/auth/humanSessionClient.ts` — **nuevo módulo
  compartido**: destino de la extracción del cliente de sesión humana.
- `apps/web/src/features/auth/humanSessionClient.test.ts` — sus pruebas.
- `apps/web/src/features/hospital/hospitalHumanSessionClient.ts` — queda como
  **fachada compatible** que reexporta el módulo compartido. **Excepción
  expresa** a la denylist de `features/hospital/**` (§13).
- `apps/web/src/features/hospital/hospitalHumanSessionClient.test.ts` — prueba
  de **regresión** de esa fachada. Misma excepción expresa.

**Ningún otro archivo de `apps/web/src/features/hospital/` entra en esta
allowlist.** Los dos de arriba están permitidos **solo** para la extracción de
§17.D-3 y para nada más.

**Capa 4 — Web, experiencia**

- `apps/web/src/features/paciente/PacienteExperience.tsx`
- `apps/web/src/features/paciente/InicioPaciente.tsx`
- `apps/web/src/features/paciente/paciente.module.css`
- `apps/web/src/features/paciente/paciente.test.tsx`
- `apps/web/src/features/paciente/pacienteExperience.dom.test.tsx` (nuevo)
- `apps/web/src/features/experiencia/ExperienciaMerdn.tsx` — **solo** la
  conmutación de fase dentro de `/`: confirmación de inscripción, entrada
  separada «Ingresar como Paciente» y experiencia autenticada cuando el servidor
  confirma sesión humana y contexto `PATIENT` (§17.C-1).

**Retirado de la allowlist el 2026-08-26:** `apps/web/src/app/paciente/page.tsx`.
El Product Owner decidió conservar `/` y **no** crear `/paciente` (§17.B-3), de
modo que esa ruta ya no es parte de esta spec.

**Capa 5 — Documentación SDD**

- `spec/specs/021-paciente-mvp-operativo/**`
- `spec/specs/INDEX.md`
- `spec/bitacora/**`

Tocar cualquier archivo fuera de estas **seis** capas —1, 1-bis, 2, 3, 4 y 5—
bloquea el paquete y obliga a detenerse. Cada micro-paquete de §14 usa solo el
subconjunto que le corresponde, y tomar un archivo de otro paquete es STOP
(§19.18).

## 13. Archivos prohibidos

**Denylist.** Todo lo no listado en §12, y de forma expresa:

- `prototype-claude/**` — solo lectura (`CLAUDE.md` §6);
- `main`, `develop` y toda rama `wip/*` (`CLAUDE.md` §9.9, §12);
- `tasks/**` y `reviews/**` — congelados (`CLAUDE.md` §14.1);
- `apps/api/src/hospital/**` — la agenda hospitalaria no se toca;
- `apps/api/src/audit/identity-audit.service.ts` y `apps/api/src/audit/audit.module.ts`
  — el módulo de auditoría **se usa**; de él solo se tocan `audit.service.ts` y
  su prueba (§12 capa 2);
- `apps/api/test/**` — **salvo** los dos archivos nuevos de §12 capa 1-bis.
  Ninguna prueba existente se modifica: la línea base se mide ejecutándolas, no
  editándolas;
- `apps/api/src/visits/**` — las rutas profesionales de visitas no se tocan, no
  se generalizan y no se reutilizan por atajo;
- `apps/api/src/human-auth/**` — la sesión humana **se usa**, no se modifica.
  Cualquier necesidad de cambiarla es STOP;
- `apps/api/src/patients/**` — la inscripción (spec 007) no se toca;
- `apps/api/src/identity-access/**` — `resolvePatient` se usa tal cual;
- `apps/api/src/municipality/**`, `territory/**`, `consents/**`,
  `people-relationships/**`, `institutional-auth/**`;
- `apps/web/src/features/hospital/**` — **salvo** los dos archivos de la
  fachada de sesión humana expresamente permitidos en §12 capa 3:
  `hospitalHumanSessionClient.ts` y `hospitalHumanSessionClient.test.ts`.
  Cualquier otro archivo de Hospital sigue prohibido, y tocar la fachada para
  algo distinto de la extracción de §17.D-3 es STOP (§19.16);
- `apps/web/src/features/municipality/**`, `inscripcion/**`;
- `apps/web/src/features/paciente/bitacoraFlow.ts`, `bitacoraFlow.test.ts` y
  `BitacoraPaciente.tsx` — la bitácora está **fuera del MVP** y se **oculta**
  dejando de montarla, no borrándola. Su código **no se toca y no se elimina**
  (§17.B-7): solo una implementación futura autorizada podría retirarlo;
- `apps/web/src/app/paciente/` — **no se crea**: se conserva `/` (§17.B-3);
- `prisma/schema.prisma` **salvo** el caso aditivo de §12 capa 2, y **nunca** un
  cambio destructivo, un borrado de columna, un cambio de tipo ni una migración
  irreversible;
- `package.json`, `package-lock.json`, `apps/*/package.json` — **cero
  dependencias nuevas**; si alguna resultara imprescindible, es STOP y se
  justifica antes (§17.B-9);
- `infra/**`, `tools/**`, `compose.yml`, `eslint.config.mjs`,
  `tsconfig.base.json`;
- `docs/**` — es contexto autoritativo, no producto de esta tarea.

## 14. Dependencias

**Internas, todas existentes y ninguna modificada:**

- spec **007** — inscripción persistente y `GET /patients/me`;
- spec **011** — identidad humana, sesión humana, contextos y `resolvePatient`;
- spec **010** — modelo de `Appointment`;
- spec **012** — modelo de `HomeVisit` y su RLS forzada;
- spec **014** — patrón de sesión humana en la shell, ya probado en Hospital.

**De paquetes:** **ninguna nueva**, por decisión expresa del Product Owner
(§17.B-9). Si alguna resultara verdaderamente imprescindible, se **detiene** el
trabajo y se justifica **antes** de añadirla.

**De datos y migraciones:** una sola, **aditiva y mínima**: los valores nuevos
del `enum AuditEventType` que exija la auditoría obligatoria (§9, §17.B-4). Con
`ROLLBACK-*.sql`, sin pérdida de datos y sin romper compatibilidad. **Ninguna
otra**, y en particular **ninguna** de `HUMAN_AUTH_RETURN_TARGETS`: se conserva
`/` precisamente para evitarla (§17.B-3).

**Orden de ejecución — cinco micro-paquetes (§17.D, Codex 2026-08-26).** El
trabajo se ejecuta en **cinco** paquetes, en este orden, cada uno de **quince
minutos como máximo** y con sus propias STOP CONDITIONS. El detalle está en
`plan.md` y las tareas verificables en `tasks.md`:

| # | Paquete | Contenido |
|---|---|---|
| 1 | **Auditoría mínima** | los dos valores del enum, la migración aditiva, su rollback condicional, los métodos de `AuditService` y sus pruebas |
| 2 | **API patient-self** | los tres endpoints de §6.6-e: `summary`, `appointments`, `visits` |
| 3 | **DB / RLS / multitenant / IDOR** | el aislamiento, demostrado por prueba ejecutada |
| 4 | **Cliente humano compartido** | extracción a `features/auth/`, fachada de Hospital con su regresión, y `pacienteSelfClient` |
| 5 | **Experiencia Paciente** | separación post-inscripción, los seis estados, el logout y el ocultamiento de la superficie demostrativa |

Un paquete no empieza hasta que el anterior tiene sus pruebas **ejecutadas**. Un
paquete que se desborda de los quince minutos se detiene y se reporta, no se
alarga en silencio (§19.18).

La **verificación en navegador** ocurre al cerrar el paquete 5, y si no hay
navegador controlable se declara `BLOCKED_BROWSER_ACCESS` (§19.8).

**Rama:** `feat/paciente-mvp-20260826`, creada desde `develop` sincronizada. Esta
spec **no** autoriza commit, push, merge, integración ni despliegue
(`CLAUDE.md` §12).

## Escenarios de aceptación

1. Dada una persona con sesión humana vigente y contexto `PATIENT`, cuando abre
   la experiencia de Paciente, entonces ve su resumen básico, sus citas y sus
   visitas, y ningún dato de otra persona.
2. Dada esa misma persona, cuando el servidor está respondiendo, entonces la
   pantalla muestra el estado `loading` y no muestra datos a medias.
3. Dada esa misma persona sin ninguna cita, cuando la consulta responde,
   entonces la pantalla muestra el estado `empty`, distinto de un error.
4. Dada esa misma persona, cuando la consulta de citas falla, entonces la
   pantalla muestra el estado `error` con una acción de reintento, y activarla
   vuelve a consultar al servidor.
5. Dada una sesión que expira durante el uso, cuando se intenta consultar,
   entonces la pantalla comunica la expiración, retira los datos ya cargados y
   ofrece volver a entrar.
6. Dada una persona con sesión humana pero **sin** contexto `PATIENT`, cuando
   abre la experiencia, entonces ve el estado `acceso no autorizado`, sin dato
   alguno y sin revelar si existe un paciente asociado.
7. Dado un cliente que envía un `patientId` ajeno en la petición de citas,
   cuando el servidor responde, entonces la respuesta es idéntica a la del mismo
   cliente sin ese parámetro, y no contiene ninguna cita ajena.
8. Dado un paciente del tenant A y una sesión del tenant B, cuando se consulta,
   entonces no se devuelve ninguna fila del tenant A, con RLS y con filtro
   explícito.
9. Dada una sesión activa, cuando se cierra sesión y el servidor confirma,
   entonces la sesión queda revocada, la cookie borrada y no queda ningún dato
   del paciente en pantalla.
10. Dada una sesión activa, cuando se cierra sesión y el servidor **no**
    confirma, entonces la pantalla dice que la sesión sigue abierta, no afirma
    que se cerró y permite reintentar.
11. Dada la experiencia operativa, cuando se inspeccionan los controles de
    capacidades fuera del MVP, entonces ninguno simula funcionalidad real.
12. Dada una inscripción recién completada con éxito, cuando termina, entonces
    `/` muestra la confirmación «Inscripción completada», **no** abre la
    experiencia autenticada de Paciente y ofrece una entrada separada «Ingresar
    como Paciente».
13. Dada esa misma persona recién inscrita y **sin** sesión humana, cuando activa
    «Ingresar como Paciente», entonces se le lleva al acceso autenticado OIDC y
    **no** se le muestra ninguna cita, visita ni resumen.
14. Dado el resumen del Paciente, cuando se lee su contenido, entonces contiene
    **exactamente** nombre de pila, iniciales y la etiqueta `Paciente`, y ningún
    otro dato.

## 15. Criterios de aceptación (formato EARS recomendado)

- CUANDO una persona con sesión humana vigente y contexto `PATIENT` abre la
  experiencia, EL SISTEMA DEBERÁ mostrar su resumen, sus citas y sus visitas.
- SI no hay sesión humana vigente, ENTONCES EL SISTEMA DEBERÁ denegar de forma
  uniforme y NO mostrar ningún dato de paciente.
- SI hay sesión humana pero no contexto `PATIENT`, ENTONCES EL SISTEMA DEBERÁ
  mostrar acceso no autorizado sin revelar si existe un paciente asociado.
- CUANDO se consulten citas o visitas, EL SISTEMA DEBERÁ resolver el sujeto en el
  servidor a partir de la sesión y NO DEBERÁ aceptar ningún selector de sujeto
  enviado por el cliente.
- CUANDO una consulta esté en curso, EL SISTEMA DEBERÁ mostrar el estado de carga
  sin presentar datos parciales.
- CUANDO una consulta responda sin resultados, EL SISTEMA DEBERÁ mostrar el
  estado vacío, distinto del estado de error.
- SI una consulta falla, ENTONCES EL SISTEMA DEBERÁ mostrar el estado de error y
  ofrecer un reintento que vuelva a consultar al servidor.
- SI la sesión expira durante el uso, ENTONCES EL SISTEMA DEBERÁ comunicarlo,
  retirar los datos ya cargados y ofrecer volver a entrar.
- CUANDO se solicite cerrar sesión, EL SISTEMA DEBERÁ pedir la revocación al
  servidor y, confirmada, retirar todo dato del paciente de la pantalla.
- SI el servidor no confirma el cierre, ENTONCES EL SISTEMA DEBERÁ decir que la
  sesión sigue abierta, NO DEBERÁ afirmar que se cerró y DEBERÁ permitir
  reintentar.
- CUANDO se acceda a datos propios, EL SISTEMA DEBERÁ registrar el evento de
  auditoría aprobado sin incluir valores sensibles.
- CUANDO una inscripción termine con éxito, EL SISTEMA DEBERÁ mostrar una
  confirmación de inscripción completada y NO DEBERÁ abrir la experiencia
  autenticada de Paciente.
- CUANDO haya una inscripción completada, EL SISTEMA DEBERÁ ofrecer una entrada
  separada de ingreso como Paciente que exija la sesión humana OIDC.
- SI la única credencial presente es la cookie de inscripción, ENTONCES EL
  SISTEMA DEBERÁ NO mostrar resumen, citas ni visitas.
- CUANDO se muestre el resumen del Paciente, EL SISTEMA DEBERÁ mostrar
  exactamente nombre de pila, iniciales y la etiqueta fija `Paciente`, y NO
  DEBERÁ mostrar ningún otro dato.
- EL SISTEMA DEBERÁ NO presentar como funcional ninguna capacidad fuera del MVP.

## Requisitos

- Requisito 1 — Acceso autenticado, recuperación de sesión y logout revocable
  (§6.1 a §6.6).
- Requisito 2 — Resumen, citas y visitas **propias exclusivamente**, con
  self-scope resuelto en el servidor (§6.7 a §6.11), y resumen limitado a la
  lista cerrada de tres campos.
- Requisito 2-bis — Entrada post-inscripción: confirmación, entrada separada y
  acceso solo por sesión humana OIDC (§6.6-a a §6.6-d).
- Requisito 3 — Estados completos, distinguibles y accesibles (§6.12 a §6.14 y
  §6.17).
- Requisito 4 — Aislamiento demostrado: tenant, RLS y ausencia de IDOR (§10, §16).
- Requisito 5 — Auditoría sin exponer datos sensibles (§9).
- Requisito 6 — Ninguna capacidad fuera del MVP presentada como funcional
  (§6.15, §6.16).

## Propiedades de la spec

- Para toda respuesta de citas o de visitas, **toda** fila devuelta DEBERÁ tener
  el `patientId` de la persona autenticada y el `tenantId` de su principal.
- Para toda petición, el conjunto de filas devueltas DEBERÁ ser **independiente**
  de cualquier parámetro de sujeto que el cliente añada.
- Para todo campo presente en una respuesta, ese campo DEBERÁ pintarse en la
  pantalla aprobada.
- Para todo resumen devuelto, su conjunto de campos DEBERÁ ser **exactamente**
  {nombre de pila, iniciales, etiqueta `Paciente`}.
- Para todo estado en que la única credencial sea la cookie de inscripción, el
  conjunto de datos de paciente visibles DEBERÁ ser vacío.
- Para todo desenlace de cierre no confirmado, el estado observable DEBERÁ seguir
  siendo el de sesión activa.
- Para todo estado crítico, su comunicación DEBERÁ ser perceptible sin depender
  del color.

## 16. Pruebas requeridas

**Unitarias**

- Proyección y minimización: ningún campo prohibido en resumen, cita ni visita.
- Traducción de desenlaces del cliente web: éxito, vacío, error, `401`, `403`,
  `503` y cancelación.

**API** — sobre los tres endpoints de §6.6-e, cada uno con su propia cobertura

- `200` con sesión y contexto `PATIENT` en `GET /api/v1/patient-self/summary`.
- `200` con sesión y contexto `PATIENT` en `GET /api/v1/patient-self/appointments`.
- `200` con sesión y contexto `PATIENT` en `GET /api/v1/patient-self/visits`.
- **Cero selectores de sujeto:** ninguna firma, ningún DTO y ninguna ruta de los
  tres acepta `patientId`, `personId`, `subject`, documento, tenant ni
  institución. La prueba lo comprueba sobre el contrato, no solo sobre el
  comportamiento.
- **Campos cerrados:** el conjunto de campos de cada una de las tres respuestas
  es exactamente el aprobado en §7, comprobado por **igualdad de conjunto**.
- `401` uniforme sin sesión, con sesión caducada, revocada y con cuenta
  deshabilitada — respuestas indistinguibles entre sí.
- Denegación con sesión humana pero sin contexto `PATIENT`.
- `503` fail-closed cuando el contexto de ejecución de base de datos no es
  seguro.
- **Selector de sujeto ignorado:** la respuesta con `patientId` ajeno en consulta,
  cuerpo o cabecera es **idéntica** a la respuesta sin él.
- La respuesta no contiene `patientId`, `personId` ni `humanAccountId`.

**DB / RLS**

- Con el rol de mínimo privilegio y el tenant activo, `appointment` y
  `home_visit` no devuelven filas de otro tenant.
- La consulta filtra por tenant **además** de RLS, y se demuestra que ambos
  controles están presentes.
- Un paciente no `ACTIVE` no resuelve contexto y no devuelve filas.

**Multitenant / IDOR**

- Dos tenants con datos ficticios: la sesión de uno nunca observa filas del otro,
  ni por listado, ni por detalle, ni por orden, ni por paginación, ni por
  mensaje de error.
- Dos pacientes del **mismo** tenant: ninguno observa datos del otro.

**Sesión y logout**

- Cierre confirmado: sesión revocada, cookie borrada, pantalla sin datos.
- Cierre no confirmado: sesión conservada, aviso visible, reintento operable, y
  el reintento vuelve a salir al servidor.
- Recuperación tras recarga: sin sesión no hay datos; con sesión sí.
- Ausencia de persistencia en el cliente: nada del paciente en `localStorage`,
  `sessionStorage` ni en la URL.

**Cliente de sesión humana compartido (§17.D-3)**

- **Login desde `/`:** el cliente inicia el acceso OIDC con `/` como destino de
  retorno, sin ampliar `HUMAN_AUTH_RETURN_TARGETS` (§17.B-3).
- **Contexto `PATIENT`** derivado del servidor: se interpreta y se expone.
- **Contexto `PROFESSIONAL`** derivado del servidor: se interpreta y se expone,
  **sin** sumarlo al de paciente (§8).
- **`401`:** traducido a «sin sesión», sin excepción sin traducir.
- **Contexto ausente:** sesión humana válida sin contexto utilizable, traducida a
  «acceso no autorizado» y distinguible de `401`.
- **`503`:** traducido a «no disponible», fail-closed, nunca a acceso concedido.
- **Cuerpo inválido:** respuesta que no cumple la forma esperada, tratada como
  fallo y nunca como sesión válida.
- **Cancelación:** una petición abortada produce el desenlace `cancelado` y no un
  error espurio ni un estado a medias.
- **Logout `204`:** cierre confirmado.
- **Logout `401`:** sesión ya inexistente, tratada sin afirmar un cierre falso.
- **Logout `403`:** rechazo por origen, con aviso y sin afirmar el cierre.
- **Logout `429`:** límite de intentos, con aviso y reintento operable.
- **Logout con fallo de red o `5xx`:** la sesión se considera **abierta**, la
  pantalla lo dice y ofrece reintentar (§6.6).
- **Logout cancelado:** desenlace explícito, sin afirmar el cierre.
- **Regresión de Hospital:** la fachada
  `apps/web/src/features/hospital/hospitalHumanSessionClient.ts` conserva la
  misma superficie exportada y los mismos desenlaces que antes de la extracción,
  y la suite de Hospital sigue en verde sin editarla.
- **Typecheck:** `npm run typecheck` en verde con la nueva ubicación y con la
  fachada.

**Estados**

- `loading`, `empty`, `error`, `retry`, `sesión expirada` y `acceso no
  autorizado`, cada uno observable y distinguible de los demás.
- `empty` nunca se muestra ante un fallo.

**Entrada post-inscripción (§17.C-1)**

- Tras una inscripción exitosa, `/` muestra la confirmación de inscripción
  completada y **no** monta la experiencia autenticada de Paciente.
- Con **solo** la cookie de inscripción y **sin** sesión humana: no hay resumen,
  no hay citas y no hay visitas en pantalla.
- La entrada «Ingresar como Paciente» existe, es distinta de la confirmación y
  conduce al acceso autenticado OIDC.
- Ninguna ruta de la inscripción crea cuenta, vínculo de identidad ni sesión
  humana.

**Resumen — lista cerrada (§17.C-2)**

- El conjunto de campos del resumen es **exactamente** tres: nombre de pila,
  iniciales y etiqueta `Paciente`. La prueba comprueba **igualdad de conjunto**,
  no inclusión: un cuarto campo la hace fallar.
- Ausencia explícita de documento, fecha de nacimiento, sexo o género, EPS,
  territorio, diagnóstico, dato clínico, identificador técnico y dato de
  terceros.

**Accesibilidad**

- Región viva `polite` para los cambios de estado de sesión y de carga.
- Foco manejable y visible; nombres accesibles en los controles.
- Ningún estado crítico comunicado solo por color.

**Auditoría** (obligatoria, §17.B-4; forma técnica §17.D-1)

- **Migración hacia adelante:** aplicada, el `enum AuditEventType` contiene
  `PATIENT_SELF_ACCESS_GRANTED` y `PATIENT_SELF_ACCESS_DENIED`, y ningún valor
  preexistente cambió de nombre, de orden ni desapareció.
- **Rollback sin eventos dependientes:** con cero filas de esos dos tipos, el
  rollback se ejecuta y deja el esquema como estaba.
- **Rollback rechazado con eventos dependientes:** con al menos una fila de esos
  tipos, el rollback **se detiene con error explícito**, no borra ninguna fila de
  `audit_event` y no altera ninguna.
- **Acceso concedido:** una lectura self-scope válida registra
  `PATIENT_SELF_ACCESS_GRANTED` con `outcome = SUCCESS`.
- **Acceso denegado:** una lectura denegada con principal humano resoluble
  registra `PATIENT_SELF_ACCESS_DENIED` con `outcome = DENIED`.
- **Diferenciación por proyección:** resumen, citas y visitas producen eventos
  distinguibles por `resourceType` y por `endpoint`, y **no** por valores
  distintos del enum.
- **Actor `HUMAN_ACCOUNT`:** `actorType` es `HUMAN_ACCOUNT`, `actorUserId` es el
  `HumanAccount.id` **opaco** y `actorRole` es nulo.
- **Ausencia de PII:** el evento no contiene documento, nombre, iniciales,
  dirección, territorio, EPS, fecha de nacimiento, sexo o género, ni contenido
  de cita o de visita. La aserción recorre los campos del evento; no se limita a
  mirar uno.
- **Sin actor ficticio:** una petición **sin** principal humano resoluble **no**
  produce ningún evento de esta familia, y en particular no produce uno con
  actor de relleno.
- **Fail-closed de la auditoría:** si el evento obligatorio no se puede
  persistir, la petición falla y **no** devuelve datos del paciente.
- **Inmutabilidad:** el evento registrado no se actualiza ni se borra por la ruta
  de la aplicación.

**Regresión**

- La suite existente sigue en verde. La línea base exacta se mide **ejecutando**,
  nunca contando por lectura, y se registra en `plan.md` antes de tocar código.

**Runtime / navegador**

- Solo **cuando exista acceso real a un navegador controlable**. Si no lo hay, se
  reporta como **no ejecutada** con causa, y nunca como aprobada
  (`CLAUDE.md` §10). Es exactamente el desenlace `BLOCKED_BROWSER_ACCESS` que ya
  ocurrió en el paquete de Visitador.

**Prohibido en todas ellas:** datos reales de pacientes, secretos, credenciales y
salida a servicios externos.

## 17. Decisiones

### 17.A Decisión de producto de origen — alcance del MVP (Product Owner, 2026-08-26)

Registrada en `spec/bitacora/decisiones/2026-08-26-alcance-paciente-mvp.md`.
**Fija el alcance; no aprueba esta spec y no registra consentimiento.**

**Incluido:** acceso autenticado del Paciente; recuperación de sesión; logout
real y revocable; resumen básico; consulta de sus propias citas; consulta de sus
propias visitas; estados completos —`loading`, `empty`, `error`, `retry`, sesión
expirada—; autorización self-scope; tenant/RLS; auditoría; y validación con datos
exclusivamente ficticios en API, DB/RLS y runtime/navegador cuando exista
navegador controlable.

**Fuera del MVP:** ayuda urgente; bitácora clínica; pagos; mensajes; cuidador;
consulta virtual; historia clínica; automatización clínica; y cualquier capacidad
demostrativa fuera del alcance aprobado. Deben quedar fuera de la experiencia
operativa o no presentarse como funcionales.

**Punto 15 del alcance:** no se usan datos reales hasta hardening y aceptación
final.

### 17.B Decisiones de producto **cerradas** (Product Owner, 2026-08-26)

Registradas en `spec/bitacora/decisiones/2026-08-26-decisiones-paciente-mvp.md`.
Cierran las nueve decisiones que la redacción de esta spec dejó abiertas, más una
definición de terminación. **No aprueban esta spec y no registran consentimiento.**

1. **Sesión canónica — sesión humana OIDC.** La autenticación oficial del
   Paciente es la **sesión humana OIDC** (`merdn_human_session`). La **cookie de
   autoinscripción NO será la sesión permanente del portal**.
   *Consecuencia:* el logout revocable del alcance aprobado es alcanzable sin
   inventar nada, y el módulo `human-auth` se **usa** tal cual, sin modificarlo.

2. **Inscripción → Paciente — sin autorregistro nuevo.** Para el hito del 2 de
   septiembre **no se construye** ningún autorregistro de identidad. Las
   identidades Paciente necesarias para pruebas y piloto se **aprovisionan
   mediante el mecanismo administrativo seguro existente**. La automatización
   posterior queda **fuera** de este MVP.
   *Consecuencia:* se elimina el riesgo de suplantación que traía cualquier
   vinculación automática, y `ExternalAuthIdentity` conserva su regla de
   provisioning exclusivo (`prisma/schema.prisma:1069-1078`).

3. **Ruta — se conserva `/`.** **No** se crea `/paciente` ahora. La experiencia
   mostrada en `/` depende del **contexto y la sesión** correspondientes, **sin
   introducir ninguna migración de `HUMAN_AUTH_RETURN_TARGETS`**.
   *Consecuencia:* cero migraciones de identidad y cero cambios en el CHECK de la
   base.

4. **Auditoría — obligatoria.** El acceso propio del Paciente **debe quedar
   auditado**. La **solución técnica exacta la define Codex / arquitectura**. Si
   requiere una migración **aditiva mínima y segura** de `AuditEventType`, debe
   quedar **explícita en la spec** —queda explícita en §9 y en §14—. **No se
   elimina la auditoría para ahorrar tiempo.**

5. **Resumen del Paciente — mínimo.** Se muestra solo **nombre o iniciales** y
   **contexto básico de orientación**. **No** se muestran por defecto: documento,
   territorio, diagnósticos, información clínica, EPS ni otros datos sensibles
   innecesarios. Aplicado en §6.7 y en §7.

6. **Citas y visitas — solo las propias.** Para el MVP: **próximas citas
   propias** y **visitas propias recientes**, con **fecha y hora**, **modalidad**,
   **estado** y datos mínimos necesarios. **No** se muestran identificadores
   técnicos ni información de terceros. Aplicado en §6.8, §6.9 y §7.

7. **Controles demo fuera del MVP — se OCULTAN.** Ayuda urgente, bitácora
   clínica, pagos, mensajes, cuidador, consulta virtual, historia clínica y
   cualquier otra función demostrativa fuera del alcance se **ocultan** de la
   experiencia operativa. **Su código NO se borra**, salvo que una implementación
   futura lo requiera y esté autorizada. Aplicado en §6.15, §6.16 y §13.

8. **Cliente de sesión — no es decisión de producto.** La extracción o
   reutilización del cliente de sesión humana hoy alojado bajo `features/hospital/`
   la resuelven **Codex y el agente 09** dentro de la arquitectura existente y con
   **mínimo cambio**. Ver §17.D-2.

9. **Dependencias — ninguna nueva por defecto.** Si alguna resultara
   **verdaderamente imprescindible**: **STOP y justificar antes**. Aplicado en
   §13, §14 y §19.5.

10. **Definición de «Paciente MVP operativo».** Ver §20. Es la condición de
    terminación de esta spec: mientras falte cualquiera de sus elementos, el
    Paciente **no** se declara operativo. Todo lo demás queda **después** del 2 de
    septiembre.

### 17.C Concreciones de producto **cerradas** (Product Owner, 2026-08-26)

Las dos que quedaban abiertas tras §17.B. Registradas en
`spec/bitacora/decisiones/2026-08-26-decisiones-finales-paciente-mvp.md`.
**Con ellas, no queda ninguna decisión de producto abierta en esta spec.**

1. **Experiencia post-inscripción en `/`.** Tras una inscripción exitosa:
   - la **cookie de inscripción sirve únicamente para confirmar y completar la
     inscripción**;
   - **no** se considera sesión permanente del portal Paciente;
   - **no** se entra automáticamente a la experiencia autenticada;
   - la interfaz muestra una **confirmación clara de «Inscripción completada»**;
   - existe una **entrada separada «Ingresar como Paciente»**;
   - el acceso al portal exige la **sesión humana OIDC canónica** ya aprobada;
   - para el MVP, las identidades de prueba y piloto se **aprovisionan con el
     mecanismo administrativo seguro existente**, y **no se crea autorregistro
     nuevo de identidad**.

   Aplicado en §6.6-a a §6.6-d, en los escenarios de aceptación y en §16.

2. **Campos del resumen — lista cerrada.** El resumen básico queda limitado
   **exactamente** a **nombre de pila**, **iniciales** y **etiqueta fija
   `Paciente`**. **No** se muestran en ese resumen: documento, fecha de
   nacimiento, sexo o género, EPS, territorio, diagnósticos, información clínica,
   identificadores técnicos, información de terceros ni **cualquier otro dato no
   incluido expresamente arriba**.

   Aplicado en §6.7, en §7 y en §16.

### 17.D Asuntos delegados a Codex — **RESUELTOS el 2026-08-26**

No son decisiones de producto. El Product Owner los delegó en Codex, Codex los
resolvió el 2026-08-26 con veredicto `PASS WITH CORRECTIONS` sobre esta spec, y
aquí quedan transcritos. Claude Code **no** los tomó por su cuenta y **no** puede
alterarlos: apartarse de cualquiera de ellos exige una nueva resolución de Codex
(§19.1).

**17.D-1 — Forma técnica de la auditoría. RESUELTO.**

- **Dos** valores nuevos del enum, y solo dos: `PATIENT_SELF_ACCESS_GRANTED` y
  `PATIENT_SELF_ACCESS_DENIED`.
- Resumen, citas y visitas se diferencian por **`resourceType`** y **`endpoint`**,
  **no** por más valores de enum.
- El registro vive en el **servicio de auditoría existente**,
  `apps/api/src/audit/audit.service.ts`, **no** en uno propio del módulo.
- Reglas del evento, migración aditiva mínima y rollback condicional:
  desarrollados en §9.1 a §9.4.
- Se respeta el límite del Product Owner: **aditiva, mínima y segura**, y
  explícita en la spec.

**17.D-2 — Superficie HTTP de la lectura self-scope. RESUELTO.**

Tres endpoints exactos —`GET /api/v1/patient-self/summary`,
`GET /api/v1/patient-self/appointments`, `GET /api/v1/patient-self/visits`— con
las seis reglas obligatorias de §6.6-f. Lista **cerrada**: cualquier endpoint
adicional es STOP (§19.15).

**17.D-3 — Ubicación del cliente de sesión humana (§17.B-8). RESUELTO:
`MOVE TO SHARED`.**

| Qué | Ruta |
|---|---|
| Módulo compartido nuevo | `apps/web/src/features/auth/humanSessionClient.ts` |
| Su prueba | `apps/web/src/features/auth/humanSessionClient.test.ts` |
| Fachada compatible de Hospital | `apps/web/src/features/hospital/hospitalHumanSessionClient.ts` |
| Prueba de regresión de la fachada | `apps/web/src/features/hospital/hospitalHumanSessionClient.test.ts` |

Objetivo declarado por Codex: **reutilizar la lógica existente**, **no duplicar
seguridad** y **no romper a los consumidores de Hospital**. La fachada conserva
la superficie exportada, de modo que ningún componente de Hospital cambia sus
importaciones.

**Riesgo de regresión en Hospital: BAJO**, y aun así la prueba de regresión de la
fachada es **obligatoria** (§16) y su ausencia impide declarar terminado el
paquete 4.

Las cuatro rutas quedan en la allowlist §12 capa 3, y las dos de Hospital quedan
**expresamente exceptuadas** de la denylist §13, solo para esta extracción.

### 17.E Decisiones heredadas y no reabiertas

Flujo único OIDC sin repliegue y fail-closed (spec 011); cookies separadas por
entidad; derivación de contextos en el servidor sin suma implícita; `patientId`
que nunca sale al cliente; RLS por tenant en `appointment` y `home_visit`; y
prototipo de solo lectura (`CLAUDE.md` §6).

## 18. Decisiones fuera de alcance

No deben inferirse, ni implementarse, ni prepararse:

- **ayuda urgente** y cualquier flujo de urgencia, aviso o escalamiento;
- **bitácora clínica** y todo registro clínico por el paciente;
- **pagos**, membresías, precios, comprobantes e ingresos;
- **mensajes** y cualquier comunicación entre personas;
- **cuidador**: acceso por relación, gestión de la relación y su revocación;
- **consulta virtual** y videollamada;
- **historia clínica** y toda lectura de dato clínico;
- **automatización clínica**: reglas, umbrales, alertas y recomendaciones;
- **escritura de cualquier clase** por el Paciente: agendar, cancelar, reagendar,
  confirmar o corregir;
- cualquier **capacidad demostrativa** que no esté en el alcance aprobado;
- **datos reales** de pacientes, en cualquier entorno, hasta hardening y
  aceptación final;
- **integrar a `develop`**, hacer commit, push, merge, release o desplegar
  (`CLAUDE.md` §12);
- modificar la **sesión humana**, la **inscripción**, **Hospital**, **Alcaldía**,
  **Visitador** o **Soporte**;
- cualquier **migración destructiva** o irreversible.

## 19. STOP CONDITIONS de esta spec

Claude Code debe detener la parte afectada y devolver la decisión al Product
Owner y a Codex cuando:

1. aparezca una decisión **de producto** nueva: se marca para el Product Owner y
   **no** se infiere. **No queda ninguna abierta** (§17.B, §17.C). Los tres
   asuntos de arquitectura de §17.D quedaron **resueltos por Codex** el
   2026-08-26; si el trabajo exigiera **apartarse** de cualquiera de esas tres
   resoluciones, es STOP y vuelve a Codex, no se decide sobre la marcha;
2. haga falta modificar `apps/api/src/human-auth/**`, `patients/**`,
   `identity-access/**`, `hospital/**` o `visits/**`;
3. haga falta una migración **no aditiva**, un cambio de tipo, un borrado o
   cualquier cambio sin `ROLLBACK-*.sql` suficiente; o la migración de auditoría
   deje de ser **mínima** (§17.B-4);
4. haga falta ampliar `HUMAN_AUTH_RETURN_TARGETS` o crear `/paciente`: la §17.B-3
   lo excluye expresamente;
5. haga falta una dependencia nueva —**STOP y justificar antes**, §17.B-9—, una
   integración externa o un cambio de infraestructura;
6. aparezca cualquier necesidad de dato real de paciente, secreto o credencial;
7. una prueba de aislamiento —tenant, RLS o IDOR— no se pueda ejecutar: sin ella
   la tarea **no** se declara terminada;
8. no exista navegador controlable para la validación de runtime: se reporta como
   no ejecutada, nunca como aprobada;
9. el trabajo exceda materialmente la allowlist de §12;
10. se detecte contradicción entre `AGENTS.md`, `docs/`, esta spec y una decisión
    del Product Owner;
11. aparezca la tentación de **borrar** el código de una capacidad fuera del MVP
    en lugar de ocultarla: la §17.B-7 lo prohíbe sin autorización;
12. se pretenda **añadir un cuarto campo** al resumen del Paciente, o cualquier
    dato fuera de la lista cerrada de §6.7: la §17.C-2 la fija exactamente en
    tres;
13. se pretenda que la **cookie de inscripción** abra el portal, conceda acceso a
    citas o visitas, o sustituya a la sesión humana: la §17.C-1 lo prohíbe;
14. el **rollback** de la migración de auditoría encuentre eventos dependientes
    —filas con `PATIENT_SELF_ACCESS_GRANTED` o `PATIENT_SELF_ACCESS_DENIED`— y
    aparezca la tentación de **borrarlos o reasignarlos** para poder revertir: el
    rollback debe **rechazarse**, no forzarse (§9.4). Perder eventos de auditoría
    es pérdida de traza material;
15. haga falta un **cuarto endpoint**, una ruta parametrizada, un método de
    escritura o cualquier superficie HTTP fuera de los tres de §6.6-e: la lista
    es cerrada (§17.D-2);
16. haga falta tocar **cualquier archivo de `features/hospital/`** distinto de
    `hospitalHumanSessionClient.ts` y su prueba, o tocar esos dos por algo
    distinto de la extracción de §17.D-3; o la fachada **no** pueda conservar la
    superficie que Hospital ya importa: entonces el cambio deja de ser «mínimo» y
    vuelve a Codex;
17. la prueba de **regresión de Hospital** no se pueda ejecutar: sin ella el
    paquete 4 **no** se declara terminado;
18. un micro-paquete de §14 se **desborde** de sus quince minutos o necesite
    tocar archivos de otro paquete: se detiene y se reporta, no se alarga en
    silencio.

Cada bloqueo se reporta con el formato de `CLAUDE.md` §9: punto afectado, hecho
observado y evidencia, decisión faltante, impacto, alternativas con sus
tradeoffs, recomendación marcada como tal, y trabajo seguro ya completado.

## 20. Definición de «Paciente MVP operativo» (Product Owner, §17.B-10)

Es la **condición de terminación** de esta spec. Mientras falte cualquiera de
estos elementos, el Paciente **no** se declara operativo, aunque la pantalla
renderice (`CLAUDE.md` §10).

| # | Elemento | Verificado por |
|---|---|---|
| 1 | OIDC humano legítimo | §6.1; pruebas de API |
| 2 | Recuperación de sesión | §6.3; prueba de recarga |
| 3 | Logout real y revocable | §6.4, §6.6; pruebas de cierre confirmado y no confirmado |
| 4 | Resumen básico | §6.7; prueba de **igualdad de conjunto** sobre los tres campos |
| 5 | Citas propias | §6.8; pruebas de self-scope e IDOR |
| 6 | Visitas propias | §6.9; pruebas de self-scope e IDOR |
| 7 | Self-scope | §8; prueba del selector de sujeto ignorado |
| 8 | Tenant / RLS | §10; pruebas de RLS y multitenant |
| 9 | Auditoría | §9; prueba de evento sin valores sensibles |
| 10 | `loading` | §6.12; prueba de estado |
| 11 | `empty` | §6.12, §6.13; prueba de estado |
| 12 | `error` | §6.12, §6.13; prueba de estado |
| 13 | `retry` | §6.12; prueba de que vuelve a salir al servidor |
| 14 | Sesión expirada | §6.12, §6.14; prueba de estado |
| 15 | Pruebas API / DB / RLS | §16; ejecutadas, no contadas por lectura |
| 16 | Validación runtime / navegador **cuando exista navegador controlable** | §16; si no lo hay, `BLOCKED_BROWSER_ACCESS` declarado |

**Todo lo demás queda después del 2 de septiembre de 2026.**

Un elemento sin prueba ejecutada **no** cuenta como cumplido. Una prueba que no
se pudo ejecutar se reporta como no ejecutada, con su causa, y nunca como
aprobada.

## Ámbito de archivos / File scope

- `apps/api/src/patient-self/` — lectura self-scope del Paciente
- `apps/api/src/audit/audit.service.ts` — auditoría del acceso propio (§9)
- `apps/api/test/patient-self.*.test.ts` — pruebas de API y de DB / RLS / IDOR
- `prisma/schema.prisma` y una migración **aditiva** — los dos valores del enum
- `apps/web/src/features/paciente/` — experiencia operativa del Paciente
- `apps/web/src/features/auth/` — cliente de sesión humana compartido (§17.D-3)
- `apps/web/src/features/hospital/hospitalHumanSessionClient.*` — fachada
  compatible, **y nada más de Hospital**
- `apps/web/src/features/experiencia/` — conmutación de fase dentro de `/`
- `spec/specs/021-paciente-mvp-operativo/` — gobernanza de esta spec

## Criterios de éxito

- Una persona con contexto `PATIENT` entra, ve su resumen, sus citas y sus
  visitas, y cierra sesión de verdad.
- Ninguna persona ve una cita o una visita que no sea suya, demostrado por prueba
  y no por inspección.
- Ningún tenant observa filas de otro, demostrado con RLS **y** con filtro
  explícito.
- Los seis estados son observables y distinguibles, y ninguno se comunica solo
  por color.
- El acceso propio queda auditado sin exponer valores sensibles, o su ausencia
  queda declarada por decisión expresa del Product Owner.
- Ninguna capacidad fuera del MVP aparece como funcional.
- Cero datos reales, cero secretos y cero dependencias nuevas.
- El diff se mantiene dentro de la allowlist de §12.
- Toda prueba no ejecutada queda reportada como tal, con su causa.
