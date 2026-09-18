# Especificación 011 - Identidad humana y relaciones paciente-cuidador

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specifications: `tasks/IDENTITY-RELATIONSHIPS-CORE-01.md`,
`tasks/IDENTITY-RELATIONSHIPS-CORE-01-OWNER-DECISION-PACKET.md`,
`tasks/IDENTITY-RELATIONSHIPS-CORE-01-CLAUDE-PACKET.md`,
`tasks/IDENTITY-RELATIONSHIPS-CORE-01-CONTINUATION.md`,
`tasks/IDENTITY-RELATIONSHIPS-CORE-01-MICRO-01-KEYCLOAK-REIMPORT.md` y
`tasks/IDENTITY-RELATIONSHIPS-CORE-01-MP03-B.md`. Congeladas.

**Auditoría: NO EXISTE.** Comprobado con `ls reviews/` el 2026-08-25: ningún
archivo de `reviews/` menciona `IDENTITY-RELATIONSHIPS`. La capacidad más
sensible del repositorio —autenticación humana y autorización por relación— es
la única de este tamaño que se integró sin auditoría de Codex registrada. El
handoff exigido por el packet §17 existió como intercambio de trabajo, pero no
dejó documento en `reviews/`. Esa ausencia no invalida lo construido; sí
significa que nadie distinto de quien implementó verificó por escrito los quince
criterios de aceptación del packet.

Decisiones del Product Owner aprobadas el 2026-08-23
(`OWNER-DECISION-PACKET` §10) y reflejadas en el código:

| # | Decisión aprobada | Estado medido hoy |
|---|---|---|
| 1 | Un solo flujo OIDC estándar, Authorization Code + PKCE S256, fail-closed | Implementado. **Corregido**: el proveedor no es Entra External ID sino Keycloak local `26.7.1`; Entra queda diferido |
| 2 | Linking previo, allowlisted, sin endpoint público ni auto-link por claims | Implementado en `tools/identity-provisioning/` |
| 3 | `CAREGIVER_RELATIONSHIP_MANAGER` institucional dedicado, con procedencia opaca | Implementado, disjunto de `HOSPITAL_SCHEDULER` |
| 4 | Tenant activo como única frontera institucional temporal del MVP | Implementado. No existe `Institution` ni selector |
| 5 | Catálogo cerrado `DECLARED_CARE_SUPPORT` / `HOME_CARE_COORDINATION` / `VISITS_VIEW` | Implementado como enums de un solo valor |
| 6 | Sesión humana 8 h absolutas, 30 min inactividad, una sesión activa | Implementado |

La condición vinculante del Product Owner —«ninguna dependencia OIDC externa
puede bloquear el MVP»— es la razón por la que la decisión 1 se ejecutó con
Keycloak local y no con Entra. Está resuelta en el `CLAUDE-PACKET` §AD-01, que
prevalece sobre el texto del `OWNER-DECISION-PACKET`.

## Objetivo

Dar a MERDN un principal humano atribuible: que una persona se autentique contra
un proveedor OIDC, que el servidor —y solo el servidor— derive qué es esa
persona dentro de la institución (paciente, profesional, cuidadora), y que la
relación paciente-cuidador exista como autorización con finalidad, alcance,
vigencia y revocación propias, en vez de como un permiso implícito.

## Historia de usuario principal

Como persona cuidadora autorizada para acompañar a un paciente concreto, quiero
que mi acceso dependa de una relación validada, con alcance y vigencia
explícitos y revocable en cualquier momento, para que nadie —ni siquiera yo—
pueda ver información de una persona a la que ya no cuido.

## Qué hace hoy el sistema

### Autenticación humana (`apps/api/src/human-auth/`)

| Superficie | Archivo | Qué hace |
|---|---|---|
| `GET /api/v1/human-auth/login` | `human-auth.controller.ts:85` | Crea un `HumanAuthAttempt` y redirige al proveedor. Rate limit aplicado |
| `GET /api/v1/human-auth/callback` | `human-auth.controller.ts:112` | Consume el intento de forma atómica, verifica el ID token y emite sesión |
| `GET /api/v1/human-auth/session` | `human-auth.controller.ts:174` | Devuelve vigencia y contextos. Ningún identificador |
| `POST /api/v1/human-auth/logout` | `human-auth.controller.ts:233` | Revoca en servidor y borra cookie. Rate limit + origen + sesión |
| `GET /api/v1/me/contexts` | `me-contexts.controller.ts:53` | Contextos disponibles derivados en servidor |

- **Adapter OIDC único** (`oidc.adapter.ts`): `openid-client`, Authorization
  Code + PKCE S256, algoritmo `RS256` (`human-auth.contract.ts:107`), `scope`
  exactamente `openid` (`human-auth.contract.ts:110`). Devuelve solo
  `{ issuer, subject }`. No existe `dev-login`, cabecera de identidad ni
  repliegue.
- **Intento efímero** (`HumanAuthAttempt`): `state` y `nonce` hasheados, verifier
  PKCE cifrado con AES-256-GCM desde `MERDN_HUMAN_AUTH_ATTEMPT_KEY`
  (`human-auth-attempt.crypto.ts`), TTL 600 s. Consumo atómico mediante
  `updateMany` con `consumedAt: null` en el filtro
  (`human-auth.service.ts:382`).
- **Sesión humana**: 8 h absolutas y 30 min de inactividad
  (`human-auth.contract.ts:98` y `:101`). Una sola sesión activa: el callback
  revoca las vivas y crea la nueva en la misma transacción
  (`human-auth.service.ts:541-566`). `lastUsedAt` nunca desplaza `expiresAt`
  (`human-auth.service.ts:673`).
- **Revalidación por operación** (`human-auth.service.ts:639-668`): sesión no
  revocada, dentro de vigencia absoluta, dentro de la ventana de inactividad,
  tenant coincidente, `HumanAccount` `ACTIVE` y **al menos un vínculo externo
  `ACTIVE`**. Desvincular cierra el acceso en la petición siguiente.
- **Destino de retorno**: allowlist cerrada de exactamente `['/']`
  (`human-auth.contract.ts:78`).
- **Origen** (`same-origin.guard.ts`): denegación por defecto si faltan `Origin`
  y `Referer`. Aplicado a `logout` y a las tres mutaciones de relación.
- **Límite de tasa** (`human-auth-rate-limit.guard.ts`): ventana fija en memoria
  del proceso, por IP, sin registrar la IP.

### Participaciones derivadas en servidor (`apps/api/src/identity-access/`)

- `IdentityAccessService.resolvePatient(principal)` — `Person -> Patient ACTIVE`.
- `IdentityAccessService.resolveProfessional(principal, now)` — exige perfil
  `ACTIVE` **y** al menos una `ProfessionalAffiliation` `ACTIVE` vigente.
- `IdentityAccessService.hasActiveAssignmentOverPatient(principal, patientId, now)`
  — perfil + afiliación + `CareAssignment` vigente, todo en una sola transacción
  tenant-scoped. `professionalId` nunca llega del cliente.
- `HumanContextsService` — deriva `PATIENT` / `PROFESSIONAL` / `CAREGIVER` sin
  devolver los identificadores que los sostienen.

### Relación paciente-cuidador (`apps/api/src/people-relationships/`)

| Superficie | Archivo | Qué hace |
|---|---|---|
| `POST /api/v1/caregiver-relationships` | `caregiver-relationship.controller.ts:105` | Crea en `PENDING_VALIDATION`, `version=1`, con alcance `VISITS_VIEW` |
| `GET /api/v1/caregiver-relationships/:id` | `:160` | Consulta del propio tenant. `404` uniforme |
| `PATCH /api/v1/caregiver-relationships/:id/activate` | `:203` | `PENDING_VALIDATION -> ACTIVE` con `expectedVersion` |
| `PATCH /api/v1/caregiver-relationships/:id/revoke` | `:263` | `PENDING_VALIDATION \| ACTIVE -> REVOKED` con motivo cerrado |

Toda la superficie está tras `CaregiverRelationshipManagerGuard`
(`caregiver-relationship.controller.ts:96`); las mutaciones añaden
`SameOriginGuard`. `CaregiverRelationshipPolicy.canCaregiverViewVisits()`
resuelve la autorización de lectura exigiendo a la vez tenant, persona del
principal, estado `ACTIVE`, vigencia viva, tipo y finalidad exactos y alcance
`VISITS_VIEW`.

### Base de datos (`prisma/migrations/20260823120000_identity_relationships_core_01/`)

- Seis tablas: `human_account`, `external_auth_identity`, `human_session`,
  `human_auth_attempt`, `patient_caregiver_relationship`,
  `patient_caregiver_relationship_scope`.
- Ocho enums nuevos, más `CAREGIVER_RELATIONSHIP_MANAGER` en `InstitutionalRole`,
  `HUMAN_ACCOUNT` y `SYSTEM` en `AuditActorType` y ocho eventos en
  `AuditEventType`.
- `ENABLE` + `FORCE ROW LEVEL SECURITY` y política `USING`/`WITH CHECK` sobre
  `merdn_current_tenant()` en las seis tablas (`migration.sql:571-618`).
- Grants sin `DELETE`; `patient_caregiver_relationship_scope` solo
  `SELECT, INSERT` (`migration.sql:558-563`).
- Trigger tenant-aware contra la autorrelación (`migration.sql:452-478`) y
  exclusion constraint `btree_gist` contra relaciones `ACTIVE` solapadas
  (`migration.sql:490-502`).
- Rollback documentado: `prisma/migrations/ROLLBACK-identity_relationships_core_01.sql`.

### Aprovisionamiento y proveedor local

- `tools/identity-provisioning/` — comando `npm run identity:provision` con
  `--dry-run` por defecto. Acciones `LINK`, `UNLINK`, `DISABLE_ACCOUNT`.
  `UNLINK` y `DISABLE_ACCOUNT` revocan las sesiones vivas en la misma operación
  (`operations.ts:259` y `:339`). Auditoría con `actorType = SYSTEM`, sin actor
  ni rol (`operations.ts:450`).
- `infra/local-oidc/realm-merdn-local.json` — realm `merdn-local`, cliente
  público `merdn-human-web` con `pkce.code.challenge.method: S256`, redirect y
  web origin exactos, contraseñas por sustitución
  `${MERDN_OIDC_LOCAL_TEST_PASSWORD}` y nunca versionadas.
- `compose.yml:153-176` — servicio `oidc-local` opt-in tras el perfil
  `oidc-local`, imagen fijada `quay.io/keycloak/keycloak:26.7.1`, publicado solo
  en `127.0.0.1`. Emisor canónico
  `http://host.docker.internal:8081/realms/merdn-local`, alcanzable por navegador
  y por el contenedor de la API (`compose.yml:78`).

### Varios cuidadores por paciente y varios pacientes por cuidador

`docs/PRODUCT.md` §3.6 y §3.7 exigen que un paciente pueda tener varios
cuidadores, que un cuidador pueda estar autorizado para varios pacientes y que
cada relación conserve autorización, alcance, estado y vigencia propios. El
esquema lo cumple por construcción: `patient_caregiver_relationship` **no**
declara unicidad por `patientId` ni por `caregiverPersonId`. La única
restricción es parcial y solo sobre relaciones `ACTIVE` de la combinación exacta
tenant + paciente + cuidadora + tipo + finalidad con vigencias solapadas. Cada
fila lleva su propio `status`, `startsAt`/`endsAt`, `validationSource`,
`authorizationReference`, `version` y sus propias filas de alcance.

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | Prisma, PostgreSQL, Compose, validación tipada de entorno | Sin ella no hay esquema, migración ni configuración fail-closed |
| 007-inscripcion-paciente-persistente | `Tenant`, `Person`, `Patient`, `AuditEvent`, `TenantContextService`, `withTenant()`, RLS y rol `merdn_runtime` | `HumanAccount` se vincula a una `Person` que ya existe; la relación apunta a un `Patient` que ya existe. Esta spec no crea identidad, la reutiliza |
| 008-agregados-municipales-protegidos | `InstitutionalIdentity`, `InstitutionalSession`, patrón de guard y aprovisionamiento institucional | `CAREGIVER_RELATIONSHIP_MANAGER` es una identidad institucional más, no un mecanismo nuevo |
| 009-hospital-pacientes-api | Primer rol institucional aditivo (`HOSPITAL_PATIENT_VIEWER`) y la regla de roles disjuntos | Fija la convención que el rol de relaciones respeta: aditivo y sin heredar poderes |
| 010-hospital-profesionales-agenda-api | `ProfessionalProfile`, `ProfessionalAffiliation`, `CareAssignment` y el rol `HOSPITAL_SCHEDULER` | `resolveProfessional` y `hasActiveAssignmentOverPatient` consultan exactamente esos modelos; la separación frente a Scheduler es una decisión aprobada |

**Dependencias externas:**

- PostgreSQL con la extensión `btree_gist` disponible. Sin ella la migración no
  aplica: el packet §18.9 declara STOP explícito y prohíbe sustituir la
  exclusion constraint por una comprobación de aplicación.
- Un proveedor OIDC alcanzable. En local es Keycloak `26.7.1` levantado con
  `docker compose --profile oidc-local up -d oidc-local`. **Entra External ID no
  está integrado**: es el mismo adapter con otra configuración, y queda diferido.
- Migraciones concretas: `20260821120000_core_01_init`,
  `20260822120000_core_01_hardening`, `20260822130000_municipality_core_01`,
  `20260822140000_hospital_core_01`, `20260822160000_hospital_core_02` y, la
  propia, `20260823120000_identity_relationships_core_01`.
- Variables sin valor por defecto: `MERDN_HUMAN_AUTH_ISSUER`,
  `MERDN_HUMAN_AUTH_CLIENT_ID`, `MERDN_HUMAN_AUTH_CALLBACK_URI`,
  `MERDN_HUMAN_AUTH_ATTEMPT_KEY`, `MERDN_IDENTITY_PROVISIONING_ISSUERS`,
  `MERDN_CAREGIVER_RELATIONSHIP_MANAGER_CODE` y `_SECRET`. Su ausencia
  deshabilita la autenticación humana, no la degrada.

**Specs que dependen de esta:** 012-visitas-domiciliarias,
013-visitas-visibles-en-hospital, 014-sesion-profesional-en-shell,
016-acceso-de-soporte-administrativo y 017-worklist-del-visitador. Todas
consumen el principal humano; 012 y 017 protegen su superficie con
`HumanSessionGuard`, 014 consume `session`, `login` y `logout` desde el
navegador y 016 cuelga `SupportContextSession` de una clave foránea compuesta
sobre `human_session`.

## Escenarios de aceptación

1. Dada una persona con `Person` en el tenant y un vínculo OIDC aprovisionado,
   cuando completa el flujo de autorización, entonces el servidor consume el
   intento, verifica el ID token y emite una cookie de sesión humana opaca.
2. Dado un `subject` verificado por el proveedor pero sin vínculo aprovisionado,
   cuando llega al callback, entonces el sistema **no crea cuenta** y responde
   igual que ante un fallo cualquiera.
3. Dada una sesión humana viva, cuando la misma cuenta inicia sesión desde otro
   navegador, entonces la sesión anterior queda revocada y solo una sigue válida.
4. Dada una sesión sin actividad durante más de 30 minutos, cuando se usa,
   entonces se deniega aunque no hayan pasado las 8 horas absolutas.
5. Dada una sesión usada continuamente, cuando se alcanzan las 8 horas desde su
   creación, entonces se deniega: el uso no prolongó la vigencia absoluta.
6. Dada una identidad institucional con rol `CAREGIVER_RELATIONSHIP_MANAGER`,
   cuando crea una relación, entonces nace en `PENDING_VALIDATION` con
   `version=1` y con el alcance `VISITS_VIEW` ya escrito.
7. Dada una relación en `PENDING_VALIDATION`, cuando dos operadores intentan
   activarla con el mismo `expectedVersion`, entonces solo uno lo consigue y el
   otro recibe `409`.
8. Dada una relación `ACTIVE` y vigente, cuando el operador la revoca, entonces
   la persona cuidadora pierde la autorización de inmediato, aunque su sesión
   siga viva.
9. Dada una relación cuya `endsAt` ya pasó, cuando se evalúa la autorización,
   entonces se deniega aunque la fila almacenada siga diciendo `ACTIVE`.
10. Dada una identidad con rol `HOSPITAL_SCHEDULER`, cuando llama a la superficie
    de relaciones, entonces se le deniega: los roles son disjuntos.
11. Dado un identificador de relación de otro tenant, cuando se consulta,
    entonces la respuesta es `404` uniforme, indistinguible de inexistente.
12. Dado un paciente con dos personas cuidadoras distintas, cuando ambas
    relaciones se activan, entonces coexisten con estado y vigencia propios.
13. Dada la cookie institucional presentada contra la superficie humana, cuando
    llega la petición, entonces no autentica: las tres clases de cookie son
    distintas y no intercambiables.
14. Dado un `UNLINK` o un `DISABLE_ACCOUNT` ejecutado por el comando de
    aprovisionamiento, cuando se reutiliza el token de sesión anterior, entonces
    responde `401`.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se inicie el flujo de autenticación, EL SISTEMA DEBERÁ persistir
  `state` y `nonce` hasheados y el verifier PKCE cifrado, y entregar al
  navegador únicamente un token opaco.
- CUANDO se reciba un callback, EL SISTEMA DEBERÁ consumir el intento de forma
  atómica y no reutilizarlo jamás.
- SI el intento está ausente, expirado, consumido o no coincide, ENTONCES EL
  SISTEMA DEBERÁ responder de forma idéntica en todos los casos.
- SI un `subject` verificado no tiene vínculo aprovisionado, ENTONCES EL SISTEMA
  NO DEBERÁ crear cuenta ni vínculo.
- CUANDO se cree una sesión humana, EL SISTEMA DEBERÁ revocar en la misma
  transacción las sesiones vivas de esa cuenta.
- EL SISTEMA NO DEBERÁ prolongar `expiresAt` al usar la sesión.
- CUANDO se valide una sesión, EL SISTEMA DEBERÁ exigir cuenta `ACTIVE` y al
  menos un vínculo externo `ACTIVE`.
- EL SISTEMA NO DEBERÁ aceptar `tenantId`, `personId`, `patientId`,
  `professionalId`, actor ni rol enviados por el cliente.
- CUANDO se cree una relación, EL SISTEMA DEBERÁ fijar en el servidor tipo,
  finalidad, estado, fuente de validación, alcance y versión.
- SI la relación no está `ACTIVE`, o su vigencia no incluye el instante, o le
  falta el alcance `VISITS_VIEW`, ENTONCES EL SISTEMA DEBERÁ denegar.
- SI `expectedVersion` no coincide o la transición no está permitida, ENTONCES
  EL SISTEMA DEBERÁ responder `409` sin escribir nada.
- CUANDO se mute una relación, EL SISTEMA DEBERÁ confirmar la mutación y su
  evento de auditoría de forma atómica.
- EL SISTEMA DEBERÁ impedir en la base de datos que la persona cuidadora sea la
  persona del propio paciente.
- EL SISTEMA DEBERÁ impedir en la base de datos dos relaciones `ACTIVE`
  solapadas de la misma combinación tenant/paciente/cuidadora/tipo/finalidad.
- EL SISTEMA NO DEBERÁ arrancar con un emisor local o sin TLS fuera de
  `development` y `test`.
- EL SISTEMA NO DEBERÁ registrar ni devolver `code`, tokens, claims, verifier,
  `issuer`, `subject` ni `authorizationReference`.

## Ámbito de archivos / File scope

- `apps/api/src/human-auth/` — adapter OIDC, intento cifrado, sesión, cookie, guards, controladores
- `apps/api/src/identity-access/` — principal humano y resolutores de participación
- `apps/api/src/people-relationships/` — relación paciente-cuidador, política y superficie del gestor
- `apps/api/src/institutional-auth/caregiver-relationship-manager.guard.ts` — guard del rol dedicado
- `apps/api/src/institutional-auth/institutional-auth.config.ts` — aprovisionamiento del rol (`:141`)
- `apps/api/src/audit/identity-audit.service.ts` — eventos de identidad y de relación
- `prisma/schema.prisma` — enums (`:959-1014`) y modelos (`:1026-1261`)
- `prisma/migrations/20260823120000_identity_relationships_core_01/migration.sql` — migración aditiva
- `prisma/migrations/ROLLBACK-identity_relationships_core_01.sql` — rollback documentado
- `tools/identity-provisioning/` — comando administrativo de vinculación
- `infra/local-oidc/realm-merdn-local.json` — realm Keycloak sin secretos
- `infra/local-oidc/README.md` — instrucciones del proveedor local
- `compose.yml` — servicio `oidc-local` opt-in y `extra_hosts` de la API
- `.env.example` — variables del módulo, sin valores reales
- `apps/api/test/human-auth.api.test.ts` — superficie humana y de relaciones
- `apps/api/test/identity-professional-assignment.db.test.ts` — cadena profesional (MP03-B)
- `apps/api/test/identity-relationships-fixtures.ts` — datos ficticios compartidos

## Estado real y límites conocidos

Esta es la sección que más importa. Lo construido es sólido en la base de datos
y en la sesión; es incompleto donde la capacidad tenía que llegar a una persona.

1. **La persona cuidadora no tiene ninguna superficie.** `canCaregiverViewVisits()`
   está implementada, probada en la parte de política y exportada desde
   `PeopleRelationshipsModule`, pero **ningún módulo la consume**. Comprobado por
   grep: fuera de `people-relationships/` e `identity-access/`, nadie importa
   `CaregiverRelationshipPolicy`. `apps/api/src/visits/` importa
   `HumanSessionGuard` y nada más. Consecuencia medida: **hoy una persona
   cuidadora no puede ver ninguna visita**. El gate existe; la puerta que
   debería abrir no está construida.
2. **`EXPIRED` no se escribe nunca.** El valor existe en el enum y la
   documentación lo trata como estado terminal, pero no hay una sola escritura
   de `status: 'EXPIRED'` en `apps/api/src/`, `prisma/` ni `tools/`. La
   caducidad se aplica siempre por vigencia (`endsAt`) en la consulta de
   autorización, que es lo que impide un acceso indebido; pero una relación
   caducada sigue almacenada como `ACTIVE` indefinidamente. El packet permitía
   materialización perezosa y prohibía añadir un worker: no se implementó ni una
   cosa ni la otra.
3. **Los resolutores compartidos no se reutilizan en Visitas.**
   `apps/api/src/visits/professional-visit-query.service.ts`,
   `professional-visit-worklist.service.ts` y `home-visit-transition.service.ts`
   derivan el profesional desde `principal.personId` con sus propias consultas,
   en vez de llamar a `IdentityAccessService`. La regla de seguridad se respeta
   —el cliente nunca aporta `professionalId`— pero la lógica está duplicada en
   cuatro lugares y puede divergir.
4. **El flujo OIDC feliz no tiene ninguna prueba automatizada.** No existe
   prueba del `OidcAdapter`. `human-auth.api.test.ts` lo declara en su cabecera:
   «el descubrimiento OIDC NO se ejecuta en estas pruebas, que no llegan a tocar
   el proveedor». Las sesiones de prueba se siembran con la fixture
   `crearSesionHumana`, y la única prueba de callback cubre exclusivamente los
   caminos de fallo. La verificación del login real contra Keycloak fue manual y
   quedó registrada en los packets, no en la suite.
5. **Las garantías de base de datos que introduce esta migración no tienen
   prueba.** Ni la exclusion constraint contra solapamiento, ni el trigger
   contra la autorrelación, ni la RLS o los grants de las seis tablas nuevas
   aparecen en ninguna prueba: grep de los nombres de las restricciones sobre
   `apps/api/test/` no devuelve coincidencias.
   `identity-professional-assignment.db.test.ts` sí usa el rol `merdn_runtime`
   real y prueba el aislamiento de tenant, pero sobre `professional_profile`,
   `professional_affiliation` y `care_assignment`, que son de la spec 010.
6. **`HumanAuthAttempt` crece de forma monótona.** No hay `DELETE` en tiempo de
   ejecución ni proceso de limpieza. El packet §4.3 difirió la limpieza física
   de forma explícita, así que es una deuda declarada y no un descuido.
7. **El límite de tasa vive en memoria del proceso**
   (`human-auth-rate-limit.guard.ts:36`). Es proporcional a un MVP de instancia
   única y el propio archivo lo declara: no protege un despliegue con varias
   instancias ni sustituye un control anti-automatización en el borde.
8. **No hay endpoint de listado de relaciones.** Solo existe `GET` por
   identificador. El gestor no puede enumerar las relaciones que administra y
   una persona cuidadora no puede listar sus pacientes. Cualquier operación
   exige conocer de antemano el identificador.
9. **Entra External ID no está integrado.** Solo Keycloak local. El
   `OWNER-DECISION-PACKET` §3 recomendaba Entra en un tenant no productivo; la
   condición del Product Owner lo desplazó y el `CLAUDE-PACKET` §AD-01 lo dejó
   fuera de alcance. Migrar es cambiar issuer, cliente y configuración, no el
   adapter.
10. **El destino de retorno tras el login es exactamente `/`.** La allowlist
    tiene un solo elemento. No se puede volver a la página desde la que se pidió
    iniciar sesión.
11. **Las pruebas del comando de aprovisionamiento no tocan PostgreSQL.**
    `tools/identity-provisioning/src/operations.test.ts` usa una base ficticia en
    memoria que imita las barreras del motor. Su propia cabecera lo declara: lo
    que verifica es la lógica y el conjunto exacto de escrituras, no las
    garantías del motor.
12. **`human-auth.api.test.ts` se salta en silencio sin base de datos**
    (`describe.skipIf(!puedeEjecutarse)`, línea 119). Una ejecución sin
    PostgreSQL levantado termina en verde sin haber probado nada de esta spec.
13. **No existe interfaz de usuario de esta capacidad.** `apps/web/` no tiene
    ruta `/caregiver` ni pantalla de gestión de relaciones. Lo único que consume
    la sesión humana desde el navegador es
    `apps/web/src/features/hospital/hospitalHumanSessionClient.ts`, que pertenece
    a la spec 014.
14. **La validación de una relación es una aserción de operador.**
    `CONTROLLED_MVP_OPERATOR_ASSERTION` es el único valor posible de
    `validationSource`, y el esquema lo documenta expresamente: no acredita
    representación legal, ni parentesco, ni capacidad, ni consentimiento
    clínico. La `authorizationReference` es una cadena opaca con patrón
    `^[A-Z0-9][A-Z0-9._:-]{0,99}$`; no hay documentos ni evidencia adjunta.
15. **La identidad institucional gestora es compartida, no personal.** El
    evento de auditoría identifica a la `InstitutionalIdentity`, no a la persona
    que operó. Es una decisión aprobada y honesta, y es también el motivo por el
    que el `OWNER-DECISION-PACKET` §5 la declara insuficiente para datos reales.
16. **Solo datos ficticios o controlados.** Ni esta spec ni sus Task
    Specifications autorizan datos personales reales, uso clínico ni producción.

## Criterios de éxito

- Una persona aprovisionada se autentica contra Keycloak local, sin Internet, y
  obtiene una sesión humana revocable; no existe ningún camino alterno de acceso.
- El servidor deriva paciente, profesional y cuidadora sin aceptar jamás un
  identificador del cliente como autoridad.
- Un paciente sostiene varias relaciones de cuidado simultáneas y una persona
  cuidadora sostiene varias, cada una con su estado, alcance y vigencia.
- Revocar una relación cierra la autorización en la petición siguiente, sin
  esperar a que caduque la sesión.
- La base de datos —y no solo el servicio— impide la autorrelación y el
  solapamiento de relaciones activas.
- `human-auth.api.test.ts`, `identity-professional-assignment.db.test.ts`,
  `identity-access.service.test.ts`, `caregiver-relationship.request.test.ts`,
  `human-auth.config.test.ts`, `human-auth-attempt.crypto.test.ts`,
  `human-session.cookie.test.ts` y `tools/identity-provisioning/src/operations.test.ts`
  pasan con PostgreSQL levantado.
