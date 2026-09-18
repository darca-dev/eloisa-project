# Contrato de la API self-scope del Paciente — spec 021, Micro-packet 2

**Tareas que cierra:** T2.1, T2.2, T2.3 y T2.4.

**Fuente cerrada y única:** `spec.md` §6.6-e, §6.6-f, §6.7, §6.8, §6.9, §6.10,
§6.11, §7, §8, §9 y §17.D-2, con las decisiones de producto §17.B-5, §17.B-6 y
§17.C-2. Este contrato **no** añade, relaja ni reinterpreta nada de esas
secciones: las transcribe en forma comprobable por prueba.

**Auditoría.** No se redefine aquí. El contrato de auditoría del acceso propio
está cerrado en `README.md` de esta misma carpeta (Micro-packet 1) y este
documento lo **usa** tal cual.

---

## 1. Las tres rutas — lista CERRADA (§6.6-e, §17.D-2)

| Método | Ruta | Proyección | `resourceType` de auditoría |
|---|---|---|---|
| `GET` | `/api/v1/patient-self/summary` | resumen del paciente (§6.7) | `PatientSelfSummary` |
| `GET` | `/api/v1/patient-self/appointments` | citas propias (§6.8) | `PatientSelfAppointments` |
| `GET` | `/api/v1/patient-self/visits` | visitas propias (§6.9) | `PatientSelfVisits` |

### 1.1 La lista es cerrada (T2.4)

Quedan **fuera de esta spec y son STOP** (§19.15):

- un **cuarto** endpoint de esta superficie, cualquiera que sea su nombre;
- una **variante de detalle** de cualquiera de las tres;
- una **ruta parametrizada** —`/patient-self/:id` de cualquier forma, incluidos
  `:patientId`, `:appointmentId` y `:visitId`—;
- cualquier **método de escritura**: `POST`, `PUT`, `PATCH`, `DELETE`.

El único `POST` que la experiencia usa es el **logout de la sesión humana ya
existente**, que esta spec **no** crea y **no** modifica.

---

## 2. Ningún selector de sujeto, en ninguna forma (T2.2, §6.6-f-1, §7)

**Ninguna de las tres rutas admite**, ni en **ruta**, ni en **cadena de
consulta**, ni en **cuerpo**, ni en **cabecera**:

`patientId` · `personId` · `subject` · `humanAccountId` · `sub` · documento
(`documentType`, `documentNumber`) · `tenantId` · `institutionId` · ni ningún
otro selector equivalente del sujeto o de su institución.

Tres garantías acumulativas, y no una:

1. **No existe en la firma.** Ningún controlador declara `@Param`, `@Query`,
   `@Body` ni `@Headers` de sujeto, y ningún DTO de entrada existe. Lo que no se
   declara no se puede pasar por descuido.
2. **No existe en el servicio.** Ninguna función de este módulo recibe
   `patientId` como argumento desde fuera. El sujeto se **deriva** dentro de la
   operación, desde `principal.personId`, con `resolvePatient` (§8,
   `identity-access`).
3. **Si llegara igualmente, se ignora.** La respuesta con un selector ajeno en
   consulta, cuerpo o cabecera es **idéntica** —cuerpo y código— a la respuesta
   sin él. No se valida, no se rechaza con un error propio y no se registra: un
   rechazo distinguible ya sería una señal.

**Única entrada aceptada del cliente:** la cookie `merdn_human_session`, que lee
el guard existente. Ninguna otra.

**Ninguna ventana, ningún filtro, ningún orden y ninguna paginación** los aporta
el cliente. Los fija el servidor (§4.5).

---

## 3. Sujeto, alcance y denegación

### 3.1 Cadena de resolución, idéntica en las tres rutas

```
cookie merdn_human_session
  → HumanSessionGuard  → HumanPrincipal {sessionId, humanAccountId, personId, tenantId}
  → resolvePatient(principal)  → { patientId }  |  null
  → consulta bajo withTenant(principal.tenantId), con filtro explícito por tenantId
```

- `HumanPrincipal` lo construye **exclusivamente** el validador de sesión.
- `resolvePatient` exige `Patient.status = 'ACTIVE'` y `personId` del principal:
  un paciente **no `ACTIVE`** devuelve `null` y por tanto **no resuelve contexto,
  no devuelve filas y no revela que exista** (§6.6-f-6).
- **Sin suma implícita de contextos** (§8): esta superficie **no** consulta
  `PROFESSIONAL` ni `CAREGIVER` y no concede nada por ellos.

### 3.2 Tenant y RLS — dos barreras, no una (§6.6-f-4)

Toda consulta se ejecuta dentro de `PrismaService.withTenant(principal.tenantId)`
—rol `merdn_runtime` de mínimo privilegio, tenant activo fijado en la
transacción y **Row Level Security** vigente— **y además** repite el filtro
explícito `tenantId: principal.tenantId` en la cita, en el paciente y en la
visita. La redundancia es deliberada: el aislamiento institucional no depende de
una sola barrera.

### 3.3 Prevención IDOR (§6.6-f-5)

El sujeto no viaja en la petición. La protección se demuestra **por prueba**
—respuesta con y sin selector ajeno, comparadas por igualdad— y **nunca** por
inspección visual del código.

### 3.4 Códigos y denegaciones uniformes

| Situación | Código | Cuerpo | Evento de auditoría |
|---|---|---|---|
| Sesión humana vigente **y** contexto `PATIENT` | `200` | la proyección de §4 | `PATIENT_SELF_ACCESS_GRANTED`, `outcome = SUCCESS` |
| **Sin principal humano resoluble**: sin cookie, cookie malformada, sesión caducada por vigencia absoluta, caducada por inactividad, revocada, cuenta deshabilitada, vínculo desvinculado o tenant ajeno | `401` **uniforme** | idéntico en todos esos casos | **ninguno** de esta familia (§9.2-1, §9.2-2) |
| Sesión humana válida **sin** contexto `PATIENT` —incluido el paciente no `ACTIVE`— | `403` | uniforme, **no** revela si existe paciente asociado | `PATIENT_SELF_ACCESS_DENIED`, `outcome = DENIED` |
| Contexto de ejecución de base de datos no seguro (`RuntimeContextUnavailableError`) | `503` | uniforme | **ninguno**: no hay transacción segura en la que escribirlo |
| La auditoría **obligatoria** no se persiste | **error**, nunca `200` con datos | uniforme | ninguno: la transacción se aborta |

**Uniformidad exigida.** Las causas de `401` producen respuestas
**indistinguibles** entre sí: mismo código, mismo cuerpo, mismas cabeceras. El
`403` no distingue «no tienes paciente» de «tu paciente no está activo».
Distinguirlas permitiría deducir el estado de una cuenta o la existencia de un
paciente.

**Nunca** se degrada un fallo a acceso concedido, y **nunca** se traduce un fallo
de contexto runtime a una lista vacía: un `[]` afirma «no tienes», y eso es una
afirmación distinta de «no pude comprobarlo».

### 3.5 Fail-closed — lista cerrada

La petición **falla y no devuelve dato alguno del paciente** cuando:

1. no hay principal humano resoluble;
2. `resolvePatient` devuelve `null` —inexistente, de otra persona, o no `ACTIVE`—;
3. el contexto de ejecución de base de datos no es seguro;
4. el evento de auditoría obligatorio no se persiste;
5. cualquier incoherencia de tenant o de self-scope en una fila leída.

---

## 4. Forma de la respuesta — conjuntos CERRADOS

### 4.1 Regla dura de minimización (T2.3, §7)

> **Si un campo no se pinta en la pantalla aprobada, no viaja en la respuesta.**

Se comprueba por **igualdad de conjunto** de las claves, no por inclusión: un
cuarto campo hace fallar la prueba (§16).

### 4.2 `GET /api/v1/patient-self/summary` — exactamente tres campos (§6.7, §17.C-2)

```jsonc
{
  "givenName": "…",       // nombre de pila
  "initials":  "…",       // iniciales
  "label":     "Paciente" // etiqueta FIJA
}
```

- `label` es **constante del contrato**: no se deriva de datos, no varía por
  persona y no comunica ningún estado.
- **Prohibido**, por decisión del Product Owner y no solo por minimización:
  documento, fecha de nacimiento, sexo o género, EPS, territorio, diagnósticos,
  información clínica, identificadores técnicos, información de terceros,
  dirección exacta, teléfono, correo, `patientId`, `personId`, `humanAccountId`,
  detalle de consentimiento **y cualquier otro dato**.

### 4.3 `GET /api/v1/patient-self/appointments` — citas propias (§6.8)

```jsonc
{
  "items": [
    { "scheduledStart": "2026-09-01T14:00:00.000Z", "modality": "ON_SITE", "status": "ASSIGNED" }
  ]
}
```

Cada elemento tiene **exactamente tres** claves: `scheduledStart` (fecha y hora),
`modality` y `status`. Nada más.

**Prohibido:** `id`, `patientId`, `careAssignmentId`, `appointmentId`, `tenantId`
y **cualquier** identificador técnico; nombre de profesional, identidad
institucional, asignación, actor de una transición y **cualquier** dato de
terceros; nota clínica, `version`, `requestedAt`, `createdAt`, `updatedAt`.

### 4.4 `GET /api/v1/patient-self/visits` — visitas propias (§6.9)

```jsonc
{
  "items": [
    { "scheduledStart": "2026-08-20T13:00:00.000Z", "modality": "HOME", "status": "COMPLETED" }
  ]
}
```

Cada elemento tiene **exactamente tres** claves: `scheduledStart`, `modality` y
`status`.

- `scheduledStart` se lee de `Appointment.scheduledStart`, que es la **única**
  agenda del sistema: `HomeVisit` no persiste horario propio (`schema.prisma`).
- `modality` es la **constante** `HOME`: una `HomeVisit` materializa siempre una
  cita `HOME`, de modo que la modalidad la fija el filtro y no se refleja de una
  columna. Es la lectura literal de «modalidad **cuando aplique**» (§6.9).
- `status` es el estado de la visita: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED` o
  `NOT_COMPLETED`.

**Prohibido:** `id`, `homeVisitId`, `appointmentId`, `patientId`,
`careAssignmentId`, `createdByInstitutionalIdentityId`, `version`, `startedAt`,
`endedAt`, `createdAt`, `updatedAt`, el **historial de transiciones** y su actor,
y la **identidad institucional** que materializó la visita.

### 4.5 Orden y ventana — los fija el SERVIDOR

El cliente no aporta ventana, orden, filtro ni paginación (§2). El servidor
aplica, para dar contenido observable a «próximas» y «recientes» de §17.B-6:

| Proyección | Ventana | Orden | Cota |
|---|---|---|---|
| Citas | `scheduledStart >= now` del servidor. Una cita sin `scheduledStart` no está programada y queda fuera por construcción | `scheduledStart` ascendente, desempatado por `id` interno | límite superior fijo del servidor |
| Visitas | visitas cuya cita tiene `scheduledStart <= now` del servidor | `scheduledStart` descendente, desempatado por `id` interno | límite superior fijo del servidor |

El desempate por `id` **no** expone el identificador: ordena dentro de la
consulta y **no** viaja en la respuesta (§4.3, §4.4). La cota y el instante son
del servidor y **no** son influibles por el cliente.

### 4.6 Lista vacía

Una persona con contexto `PATIENT` y sin citas —o sin visitas— recibe `200` con
`items: []`. **Vacío no es error y error no es vacío** (§6.13): un fallo nunca se
sirve como lista vacía.

---

## 5. Auditoría — se usa la fundación del Micro-packet 1

Sin redefinirla. De `README.md` §2 de esta carpeta:

- **concedido:** `PATIENT_SELF_ACCESS_GRANTED`, `outcome = SUCCESS`;
- **denegado, y solo con principal humano resoluble:**
  `PATIENT_SELF_ACCESS_DENIED`, `outcome = DENIED`;
- `actorType = HUMAN_ACCOUNT`, `actorUserId = HumanAccount.id` **opaco**,
  `actorRole` **nulo**, `resourceId` **nulo**;
- las tres proyecciones se diferencian por **`resourceType`** y **`endpoint`**, y
  **nunca** por más valores de enum. El `endpoint` lo **deriva** el servicio de
  auditoría desde el `resourceType`: este módulo **no** lo suministra como texto;
- **la atribución vale igual para el evento denegado.** Un `DENIED` registra la
  proyección **realmente solicitada** —la de la ruta que atendió la petición— y
  **nunca** una fija: atribuir toda denegación previa a `PatientSelfSummary`
  registraría contra `/summary` un intento hecho contra `/appointments` o
  `/visits`, describiendo un acceso que no ocurrió y perdiendo el que sí. La
  correspondencia es **cerrada y uno a uno**, de modo que errar el `resourceType`
  yerra también el `endpoint`. Esto **no** revela nada de más: el `resourceType`
  nombra la **ruta** que el cliente ya llamó, no el **motivo** de la denegación,
  que sigue sin registrarse (§9.2-5);
- **sin actor ficticio:** una petición sin principal humano resoluble **no**
  genera evento de esta familia;
- **sin PII y sin contenido clínico:** el evento no lleva nombre, iniciales,
  documento, ni fecha, hora, modalidad o estado de ninguna cita o visita, ni
  conteo de filas;
- **fail-closed:** el evento se escribe **dentro de la misma transacción** que
  sirve los datos, de modo que un fallo del evento aborta la transacción y no
  puede existir una lectura servida sin su traza.

---

## 6. Lo que este contrato NO autoriza

- Un cuarto endpoint, una ruta parametrizada o un método de escritura (§1.1).
- Un selector de sujeto en cualquier firma, DTO, ruta, cuerpo o cabecera (§2).
- Un campo de respuesta fuera de los conjuntos cerrados de §4.
- Tocar `human-auth/**`, `identity-access/**`, `patients/**`, `hospital/**`,
  `visits/**`, `audit/**`, `prisma/**` ni `apps/api/test/**`.
- Cualquier dependencia nueva, migración o cambio de esquema.
- Cualquier escritura sobre datos de negocio: la superficie es de **solo
  lectura**.
