# MERDN Claude Packet — IDENTITY-RELATIONSHIPS-CORE-01

## 1. Task identification

- **Task ID:** `IDENTITY-RELATIONSHIPS-CORE-01`
- **Title:** Implementación del núcleo compartido de identidad humana y relación Paciente–Cuidador
- **Status:** `APPROVED — READY FOR CLAUDE`
- **Priority:** `CRITICAL / prerequisite for VISITS-CORE-01`
- **Created by:** Codex
- **Approved by:** Product Owner, 2026-08-23
- **Implementation agent:** Claude Code

Claude Code debe ejecutar únicamente el código, migraciones, configuración
local y pruebas definidos aquí. El análisis, arquitectura y decisiones están
cerrados. Si encuentra una contradicción real, aplica STOP y la devuelve a
Codex; no elige otra arquitectura.

## 2. Objective

Implementar un núcleo único que:

1. autentique y atribuya a una persona humana mediante
   `HumanAccount -> Person`;
2. resuelva server-side las participaciones `Patient` y
   `ProfessionalProfile` existentes;
3. mantenga una sesión humana revocable y distinta de las sesiones
   institucional y de inscripción;
4. modele una relación M:N `Patient`–`Person` cuidadora con finalidad, vigencia
   y scope `VISITS_VIEW`;
5. permita a una identidad institucional dedicada crear, validar y revocar esa
   relación;
6. pueda implementarse, ejecutarse y probarse localmente sin Entra ni otro
   servicio externo pendiente;
7. conserve un único contrato OIDC estándar configurable posteriormente para
   Entra External ID, sin cambiar dominio, sesión o autorización.

No implementar Visits ni UI.

## 3. Approved decisions

### AD-01 — Un solo flujo OIDC estándar

Implementar un único adapter OIDC/OAuth 2.0 con Authorization Code + PKCE S256.
El proveedor local aprobado es Keycloak `26.7.1`, ejecutado como contenedor
local desechable y expuesto solo en loopback/red Docker. Entra External ID queda
fuera de esta Task: será la misma integración con issuer/client/configuración
distintos.

No existe segundo adapter de login, `dev-login`, header de identidad, JWT sin
firma, password MERDN, sesión manual ni fallback. Si discovery/JWKS/proveedor
falla, el acceso falla cerrado.

### AD-02 — Linking controlado

El linking se hace fuera de la API pública mediante un comando idempotente de
provisioning con `tenantCode + personId + issuer + subject`. No usa email,
documento, teléfono, nombre, claims ni `EnrollmentSession`.

### AD-03 — Autoridad cuidador

Añadir `InstitutionalRole.CAREGIVER_RELATIONSHIP_MANAGER`. Reutiliza
`InstitutionalIdentity`, `InstitutionalSession`, aprovisionamiento y patrón de
guards existentes. No es una identidad humana y su auditoría se declara
institucional/opaca. No obtiene poderes de Scheduler ni otros módulos.

### AD-04 — Frontera institucional

El tenant activo resuelto server-side es la única frontera institucional de
este slice. No crear `Institution`/`Organization`, selector ni acceso cruzado.
Esto no declara equivalencia conceptual Tenant=Institución.

### AD-05 — Catálogo cerrado

- relationship type: `DECLARED_CARE_SUPPORT`;
- purpose: `HOME_CARE_COORDINATION`;
- status: `PENDING_VALIDATION | ACTIVE | REVOKED | EXPIRED`;
- scope único: `VISITS_VIEW`;
- validation source: `CONTROLLED_MVP_OPERATOR_ASSERTION`;
- revocation reasons: `AUTHORIZATION_WITHDRAWN | RELATIONSHIP_ENDED | CREATED_IN_ERROR`.

No existe `SUSPENDED`, wildcard, `VISITS_CONTRIBUTE` ni `VISITS_EXECUTE` para
Cuidador.

### AD-06 — Sesión humana MVP

- TTL absoluto: 8 horas;
- inactividad máxima: 30 minutos;
- máximo una sesión activa por cuenta;
- nueva sesión revoca la anterior en la misma transacción;
- token opaco aleatorio; solo hash en DB;
- cookie `merdn_human_session`, separada de las existentes;
- logout, account disabled o binding unlinked revocan server-side;
- sin refresh token OIDC persistido ni remember-me;
- perfil, afiliación, asignación y relación se reevalúan por operación.

### AD-07 — Límite de datos y entorno

Solo datos ficticios/controlados. Keycloak local y HTTP local solo pueden
habilitarse en `development`/`test`. Cualquier entorno `mvp` o futuro
productivo rechaza al arrancar issuer local/HTTP y exige OIDC HTTPS externo.
Esta Task no autoriza datos reales ni producción.

## 4. OIDC local sin dependencia externa

### 4.1 Topología aprobada

Añadir a `compose.yml` un servicio profile/opt-in `oidc-local` usando la imagen
oficial `quay.io/keycloak/keycloak:26.7.1`. No usar `latest`. Debe:

- publicar únicamente en `127.0.0.1`;
- usar `start-dev` solo para desarrollo local;
- importar/generar un realm `merdn-local`;
- registrar un cliente público con PKCE S256 obligatorio;
- usar redirect URI y web origin exactos, sin wildcard;
- no publicar consola administrativa fuera de loopback;
- contener únicamente usuarios ficticios;
- recibir credenciales bootstrap desde `.env` ignorado, nunca desde archivos
  versionados;
- mantener un issuer canónico alcanzable tanto por navegador como API en la
  topología documentada.

El repositorio puede versionar realm/client/fixtures sin secretos ni passwords.
Si Keycloak exige material con secreto, generarlo desde configuración local en
arranque y mantener el artefacto generado ignorado.

### 4.2 Contrato OIDC

El adapter devuelve únicamente:

```ts
type VerifiedExternalIdentity = {
  readonly issuer: string;
  readonly subject: string;
};
```

Debe validar:

- discovery contra issuer exacto allowlisted;
- firma y `kid` usando JWKS;
- audience/client ID;
- issuer exacto;
- `exp`, `nbf` y algoritmo asimétrico allowlisted (`RS256` para local);
- authorization code, redirect URI, state, nonce y PKCE S256;
- consumo único y prevención de replay.

No devuelve ni confía email, nombre, documento, tenant, roles o grupos.

### 4.3 `HumanAuthAttempt`

Persistir el intento efímero server-side:

- `id UUID`;
- `tenantId UUID`;
- `browserTokenHash String @unique`;
- `stateHash String @unique`;
- `nonceHash String`;
- `pkceVerifierCiphertext String`;
- `pkceVerifierIv String`;
- `pkceVerifierAuthTag String`;
- `returnTarget String` — allowlist cerrada, inicialmente `/`;
- `createdAt`, `expiresAt`, `consumedAt?`.

TTL fijo: 10 minutos. El browser recibe solo un token opaco en cookie
transitoria `merdn_human_auth_attempt`, `HttpOnly`, `SameSite=Lax`, `Secure`
salvo loopback development. State/nonce se almacenan hasheados. El verifier
PKCE se cifra con AES-256-GCM usando una clave de 32 bytes obtenida únicamente
de `MERDN_HUMAN_AUTH_ATTEMPT_KEY`; nunca se registra.

El callback consume el intento atómicamente. Intento ausente, expirado,
consumido o no coincidente responde uniformemente y nunca se reutiliza. No hay
DELETE runtime; limpieza física queda diferida.

### 4.4 Transacción de callback

Tras validar OIDC:

1. consumir `HumanAuthAttempt`;
2. resolver binding exacto `(tenant, issuer, subject)` ACTIVE;
3. exigir `HumanAccount.ACTIVE` y `Person` del mismo tenant;
4. revocar sesiones humanas activas de esa cuenta;
5. crear una `HumanSession` nueva con expiración absoluta de 8 horas;
6. escribir `HUMAN_SESSION_CREATED`;
7. confirmar todo lo material de sesión/auditoría de manera atómica;
8. emitir cookie opaca y descartar code, ID/access token, claims y verifier.

Un subject no provisionado no crea cuenta y responde sin enumeración.

## 5. Data model normativo

### 5.1 Enums

Añadir exactamente:

- `HumanAccountStatus { ACTIVE DISABLED }`
- `ExternalAuthIdentityStatus { ACTIVE UNLINKED }`
- `PatientCaregiverRelationshipType { DECLARED_CARE_SUPPORT }`
- `PatientCaregiverPurpose { HOME_CARE_COORDINATION }`
- `PatientCaregiverRelationshipStatus { PENDING_VALIDATION ACTIVE REVOKED EXPIRED }`
- `CaregiverScope { VISITS_VIEW }`
- `CaregiverRelationshipValidationSource { CONTROLLED_MVP_OPERATOR_ASSERTION }`
- `CaregiverRelationshipRevocationReason { AUTHORIZATION_WITHDRAWN RELATIONSHIP_ENDED CREATED_IN_ERROR }`
- añadir `HUMAN_ACCOUNT` y `SYSTEM` a `AuditActorType`;
- añadir `CAREGIVER_RELATIONSHIP_MANAGER` a `InstitutionalRole`.

### 5.2 `HumanAccount`

- `id`, `tenantId`, `personId`, `status`, `createdAt`, `updatedAt`;
- FK compuesta a `Person`;
- unique `(id, tenantId)`;
- índice `(tenantId, personId, status)`;
- 0..* cuentas por `Person`, conforme `DATA.md`; no añadir unique por Person.

### 5.3 `ExternalAuthIdentity`

- `id`, `tenantId`, `humanAccountId`, `issuer`, `subject`, `status`;
- `linkedAt`, `unlinkedAt?`, `createdAt`, `updatedAt`;
- FK compuesta a `HumanAccount`;
- unique `(id, tenantId)` y `(tenantId, issuer, subject)`;
- índices por account/status;
- issuer y subject opacos; no duplicar claims.
- `issuer` máximo 2048 caracteres y `subject` máximo 255, ambos no vacíos y
  sin normalización que cambie el valor emitido/verificado por OIDC.

### 5.4 `HumanSession`

- `id`, `tenantId`, `humanAccountId`, `tokenHash @unique`;
- `expiresAt`, `createdAt`, `lastUsedAt?`, `revokedAt?`;
- FK compuesta a `HumanAccount`;
- unique `(id, tenantId)` e índices por account/expiry;
- validez: no revocada, `now < expiresAt` y última actividad/creación dentro de
  30 minutos;
- `lastUsedAt` nunca extiende `expiresAt`.

### 5.5 `PatientCaregiverRelationship`

- `id`, `tenantId`, `patientId`, `caregiverPersonId`;
- `relationshipType`, `purpose`, `status`;
- `startsAt`, `endsAt?`;
- `validationSource`;
- `authorizationReference String` — forma opaca allowlisted, 1..100 caracteres,
  patrón `^[A-Z0-9][A-Z0-9._:-]{0,99}$`, nunca texto libre/PII;
- `validatedByInstitutionalIdentityId?`, `validatedAt?`;
- `revokedByInstitutionalIdentityId?`, `revokedAt?`, `revocationReason?`;
- `version Int @default(1)`;
- `createdAt`, `updatedAt`;
- FKs compuestas a `Patient`, `Person` e identidades institucionales;
- unique `(id, tenantId)` e índices por patient/caregiver/status/vigencia.

Constraints DB obligatorios:

1. `version > 0`;
2. `startsAt < endsAt` cuando exista `endsAt`;
3. `ACTIVE` exige validador, fuente y `validatedAt`;
4. `REVOKED` exige actor, fecha y reason;
5. otros estados no pueden llevar campos de revocación incoherentes;
6. trigger tenant-aware impide que `caregiverPersonId` sea la `Person` del
   `Patient`;
7. garantía DB contra relaciones ACTIVE solapadas para la misma combinación
   tenant/patient/caregiver/type/purpose. Usar exclusion constraint con rango
   `[startsAt, endsAt)` y `btree_gist`, revisando que la extensión quede
   declarada de forma idempotente. Si el entorno aprobado no soporta la
   extensión, STOP; no sustituirla silenciosamente por un check solo de app.

### 5.6 `PatientCaregiverRelationshipScope`

- `id`, `tenantId`, `relationshipId`, `scope`, `createdAt`;
- FK compuesta a relación;
- unique `(id, tenantId)` y `(relationshipId, tenantId, scope)`;
- creación MVP añade exactamente `VISITS_VIEW`; no endpoint genérico de scope.

## 6. Lifecycle de relación

- Crear → `PENDING_VALIDATION`, `version=1`, scope `VISITS_VIEW`, source y
  reference controlados.
- Activar: solo `PENDING_VALIDATION -> ACTIVE`, exige `expectedVersion`,
  `startsAt <= now`, `endsAt` nulo/futuro; fija actor/fecha y aumenta versión.
- Revocar: `PENDING_VALIDATION | ACTIVE -> REVOKED`, exige `expectedVersion` y
  reason; fija actor/fecha y aumenta versión.
- `REVOKED` y `EXPIRED` son terminales.
- `endsAt <= now` deniega autorización aun si una fila aún dice ACTIVE. La
  materialización de EXPIRED puede ser lazy y auditada dentro del módulo; no
  añadir worker/job en esta Task.
- Reautorizar después de terminal crea un episodio nuevo; no reabre historia.
- Cada mutación de relación y su AuditEvent se confirman atómicamente.

## 7. Principals and policy services

### 7.1 `HumanPrincipal`

```ts
interface HumanPrincipal {
  sessionId: string;
  humanAccountId: string;
  personId: string;
  tenantId: string;
}
```

Solo el resolver de `HumanSession` puede construirlo. Controllers y clientes
no aportan ningún campo.

### 7.2 Resolutores obligatorios

- `resolvePatient(principal)`: `Person -> Patient ACTIVE`; nunca recibe
  patientId como autoridad.
- `resolveProfessional(principal, now)`: `Person -> ProfessionalProfile ACTIVE`
  más al menos una `ProfessionalAffiliation ACTIVE` cuya vigencia incluya
  `now`; no recibe professionalId.
- `canCaregiverViewVisits(principal, patientId, now)`: relación del mismo tenant,
  ACTIVE, vigente, purpose exacto y scope `VISITS_VIEW`.
- helper profesional para consumidores futuros que combine perfil,
  afiliación y `CareAssignment ACTIVE` del recurso.

Estos servicios se exportan desde sus módulos para `VISITS-CORE-01`; esta Task
no crea endpoints ni modelos de Visits.

## 8. API contracts

### 8.1 Human auth

- `GET /api/v1/human-auth/login?returnTo=/`
- `GET /api/v1/human-auth/callback?code&state`
- `GET /api/v1/human-auth/session`
- `POST /api/v1/human-auth/logout`
- `GET /api/v1/me/contexts`

`session` devuelve solo expiración absoluta, inactividad restante y contextos
disponibles (`PATIENT`, `PROFESSIONAL`, `CAREGIVER`) derivados server-side; no
devuelve tenant/account/person/profile IDs. Un contexto disponible no concede
acceso a un recurso sin policy posterior.

### 8.2 Relationship Manager

- `POST /api/v1/caregiver-relationships`
- `GET /api/v1/caregiver-relationships/:relationshipId`
- `PATCH /api/v1/caregiver-relationships/:relationshipId/activate`
- `PATCH /api/v1/caregiver-relationships/:relationshipId/revoke`

Create body exacto:

```json
{
  "patientId": "uuid",
  "caregiverPersonId": "uuid",
  "startsAt": "ISO-8601 instant",
  "endsAt": "ISO-8601 instant or null",
  "authorizationReference": "CONTROLLED-REFERENCE"
}
```

Activate body: `{ "expectedVersion": 1 }`.

Revoke body:

```json
{
  "expectedVersion": 1,
  "reason": "AUTHORIZATION_WITHDRAWN | RELATIONSHIP_ENDED | CREATED_IN_ERROR"
}
```

El servidor fija tenant, actor, tipo, purpose, source, scope, estado, fechas de
validación/revocación y versión. Rechazar fields extra.

### 8.3 Common behavior

- `400` contrato/query inválida;
- `401` sesión ausente/inválida;
- `403` principal válido sin rol/capacidad;
- `404` uniforme para inexistente, cross-tenant o fuera de relación;
- `409` versión/transición/solapamiento;
- `503` DB, tenant u OIDC indisponibles;
- `Cache-Control: private, no-store`, `Pragma: no-cache`, `Vary: Cookie`;
- CSRF/origin en POST/PATCH/logout;
- rate limit en login/callback y operaciones de autenticación;
- DTOs minimizados, nunca objetos Prisma.

## 9. Provisioning CLI

Crear un comando administrativo fuera de la API runtime:

```text
npm run identity:provision -- --file <absolute-json-path> --dry-run
npm run identity:provision -- --file <absolute-json-path> --apply
```

- dry-run es obligatorio por defecto; sin `--apply` no escribe;
- el archivo no se versiona y usa un esquema discriminado exacto:
  - LINK: `{action:"LINK",tenantCode,personId,issuer,subject}`;
  - UNLINK: `{action:"UNLINK",tenantCode,issuer,subject}`;
  - DISABLE_ACCOUNT: `{action:"DISABLE_ACCOUNT",tenantCode,humanAccountId}`;
- valida schema estricto, issuer allowlisted y `Person` existente;
- idempotencia por `(tenantId, issuer, subject)`;
- binding existente a otra Person produce conflicto y cero cambios;
- una Person puede tener varias cuentas. LINK nuevo crea exactamente una cuenta
  y su binding en la misma transacción; repetir el mismo binding es idempotente;
  binding ya existente para otra Person produce conflicto y no se reasigna;
- linking/unlink/disable son operaciones explícitas; unlink/disable revocan
  sesiones en la misma transacción;
- auditoría identifica el proceso de provisioning de forma opaca y registra
  resultado sin issuer, subject o PII;
- nunca imprimir tokens, subject completo, documento, nombres o secretos.

Fixtures y helpers de test pueden sembrar bindings directamente; no existe API
pública de linking.

## 10. Audit events

Añadir, como mínimo:

- `HUMAN_IDENTITY_LINKED`
- `HUMAN_IDENTITY_UNLINKED`
- `HUMAN_ACCOUNT_DISABLED`
- `HUMAN_SESSION_CREATED`
- `HUMAN_SESSION_REVOKED`
- `CAREGIVER_RELATIONSHIP_CREATED`
- `CAREGIVER_RELATIONSHIP_VALIDATED`
- `CAREGIVER_RELATIONSHIP_REVOKED`

Reglas:

- actor humano: `AuditActorType.HUMAN_ACCOUNT`, `actorUserId=HumanAccount.id`,
  `actorRole=null`;
- manager: `INSTITUTIONAL_IDENTITY`, identity id y
  `CAREGIVER_RELATIONSHIP_MANAGER`;
- provisioning: `AuditActorType.SYSTEM`, `actorUserId=null` y `actorRole=null`;
  nunca fingir una persona humana;
- mutación material + audit atómicos;
- audit append-only; runtime sin UPDATE/DELETE/TRUNCATE;
- no claims, issuer, subject, token/code, cookies, verifier, nombres,
  documentos, contacto, authorizationReference o bodies.

## 11. RLS, grants and integrity

Aplicar a las seis tablas nuevas (`HumanAuthAttempt` más las cinco de dominio):

- `tenantId NOT NULL`;
- unique `(id, tenantId)`;
- FKs compuestas tenant-aware;
- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`;
- policies `USING` y `WITH CHECK` con `merdn_current_tenant()`;
- toda consulta/mutación con filtro tenant explícito + `withTenant()`;
- rol `merdn_runtime` sin owner, superuser o `BYPASSRLS`;
- grants mínimos SELECT/INSERT/UPDATE solo según caso; nunca DELETE;
- contexto ausente/equivocado y pool contaminado fallan cerrados.

Verificar tablas reutilizadas con el rol runtime real. Si se descubre que una
tabla legada necesaria permite bypass real, STOP y reportar una corrección
separada; no ampliar silenciosamente esta migración a todo el esquema.

## 12. Configuration

Añadir configuración tipada y documentada, sin valores reales:

- auth mode OIDC único;
- issuer exacto;
- client ID;
- callback URI exacta;
- allowed algorithm `RS256`;
- discovery/JWKS timeouts razonables y fail-closed;
- `MERDN_HUMAN_AUTH_ATTEMPT_KEY`;
- TTL 600 segundos del attempt, sesión 28800 segundos e idle 1800 segundos;
- cookie/origin config reutilizando las reglas existentes;
- provisioning issuer allowlist;
- provisioning de `CAREGIVER_RELATIONSHIP_MANAGER` mediante el mecanismo
  institucional existente.

Validación de arranque:

- HTTP issuer solo si environment es `development`/`test` y host es
  loopback/nombre Docker local aprobado;
- issuer `merdn-local` prohibido en `mvp`/production;
- redirect/origin wildcard prohibido;
- config incompleta falla cerrada para auth; health puede conservar el patrón
  existente si reporta el módulo no disponible sin habilitar acceso.

## 13. Allowed files

Claude puede modificar exclusivamente:

- `prisma/schema.prisma`;
- una nueva `prisma/migrations/<timestamp>_identity_relationships_core_01/migration.sql`;
- `prisma/migrations/ROLLBACK-identity_relationships_core_01.sql`;
- nuevos archivos bajo `apps/api/src/human-auth/**`;
- nuevos archivos bajo `apps/api/src/identity-access/**`;
- nuevos archivos bajo `apps/api/src/people-relationships/**`;
- extensiones mínimas en `apps/api/src/institutional-auth/**` para el rol,
  provisioning y guard nuevos, sin cambiar semántica de roles existentes;
- extensiones mínimas en `apps/api/src/audit/**`;
- `apps/api/src/config/environment.ts` y sus tests/provider;
- `apps/api/src/openapi/openapi.ts` y `apps/api/test/openapi.test.ts`;
- `apps/api/src/app.module.ts`;
- nuevos tests/fixtures `apps/api/test/identity-relationships-*.ts`;
- nuevos unit tests junto a los módulos nuevos;
- nuevos archivos bajo `tools/identity-provisioning/**`;
- nuevos archivos sin secretos bajo `infra/local-oidc/**`;
- `compose.yml`, exclusivamente para `oidc-local` opt-in;
- `.env.example`, README local estrictamente necesario;
- `package.json`, `apps/api/package.json`, `package-lock.json`, únicamente para
  scripts y una librería OIDC madura necesaria.

No añadir otras dependencias mayores. Explicar y fijar la dependencia OIDC.

## 14. Forbidden files and actions

- `tasks/VISITS-CORE-01.md` y cualquier código futuro `visits/**`;
- `prototype-claude/**`;
- `apps/web/**`;
- `apps/api/src/hospital/**`, `municipality/**`, `patients/**`,
  `enrollment-sessions/**`, salvo imports sin cambio (preferir ninguno);
- migraciones existentes;
- Agenda, clínica, documentos, finanzas, notificaciones, pagos o reportes;
- datos/credenciales reales;
- secrets, private keys, passwords o tokens versionados;
- commit, push, merge, deploy;
- refactors no necesarios.

## 15. Acceptance criteria

1. `HumanAccount` se vincula a `Person` sin duplicarla y bindings cross-tenant o
   ambiguos son imposibles.
2. El mismo adapter completa login OIDC real contra Keycloak local sin Internet
   y produce `HumanSession`; no existe bypass alterno.
3. PKCE/state/nonce/code y validación criptográfica resisten manipulación y
   replay; tokens OIDC no quedan persistidos.
4. Cookies humana, institucional y enrollment son distintas, no
   intercambiables y su coexistencia no elige un principal ambiguo.
5. Sesión cumple 8h/30m/una activa, rotación y revocación inmediata.
6. Principal humano resuelve Patient propio y ProfessionalProfile/afiliación
   vigentes exclusivamente server-side.
7. Manager institucional separado crea, activa, consulta y revoca relaciones
   solo en su tenant; otros roles no pueden.
8. Cuidador solo obtiene `VISITS_VIEW` para paciente relacionado ACTIVE y
   vigente; nunca execute/contribute/clínica/exportación.
9. Estados, versión, terminalidad, self-relation y solapamiento se garantizan
   en DB y servicio, incluida concurrencia.
10. Cada mutación material y su auditoría son atómicas y minimizadas.
11. RLS/FKs/grants impiden acceso o asociación entre dos tenants y fallan sin
    contexto, incluido pool reuse.
12. APIs validan allowlists/DTOs, devuelven errores uniformes y headers seguros.
13. Suite, build y pruebas DB funcionan localmente sin Entra ni red externa
    después de disponer de la imagen/dependencias versionadas.
14. Config local OIDC no puede arrancar en `mvp`/production.
15. No se modifican Visits, web, prototipo ni dominios prohibidos.

## 16. Required tests

### OIDC/security

- discovery/JWKS local y callback feliz;
- state, nonce, code y PKCE ausentes/manipulados/replay;
- issuer, audience, alg, kid, firma, exp y nbf inválidos;
- unknown kid y outage JWKS fail-closed;
- redirect/return target no allowlisted;
- subject no provisionado/no activo: respuesta uniforme y no JIT account;
- cambio de email/claims no cambia binding;
- issuer local/HTTP rechazado fuera de development/test;
- scan DB/logs/responses sin code/tokens/claims/verifier/secrets/PII.

### Session/cookies

- ausente, manipulada, expirada absoluta, idle, revoked, account disabled,
  binding unlinked;
- reloj inyectable para 8h/30m; lastUsed no extiende absoluto;
- dos logins concurrentes dejan una única sesión válida;
- logout/disable/unlink revocan;
- intercambio y coexistencia de las tres cookies;
- CSRF/origin y no-cache.

### Identity/policy

- paciente propio versus otro;
- profesional profile/affiliation active, inactive, ended, future;
- assignment correcto/incorrecto preparado para consumidor Visits;
- persona multi-perfil sin suma implícita;
- nunca se acepta tenant/person/patient/professional/actor/role del cliente.

### Relationship

- M:N, create/activate/revoke y optimistic concurrency;
- self-relation, overlap y FK cross-tenant rechazados;
- pending/active/revoked/expired/future/no-scope/otra-finalidad/otro-paciente;
- revocación inmediata con sesión cuidador viva;
- manager correcto versus Scheduler/viewers/human/cookies cruzadas;
- relación + scope + audit atómicos y rollback si audit falla.

### DB/RLS/migration

- aplicar desde cero y sobre estado previo aprobado;
- rollback documentado evaluado;
- dos tenants con rol runtime real;
- `USING`/`WITH CHECK`, contexto ausente/equivocado, pool reuse;
- runtime no DELETE/owner/BYPASSRLS;
- AuditEvent UPDATE/DELETE/TRUNCATE rechazados;
- exclusion constraint bajo carrera concurrente.

### Commands required

Claude debe ejecutar y reportar, como mínimo:

- `npm run prisma:validate`
- `npm run lint`
- `npm run typecheck`
- tests unitarios/API afectados;
- tests PostgreSQL/RLS con DB real;
- prueba OIDC local contra `oidc-local`;
- `npm run build`
- `npm run secrets:scan`
- `npm run docker:config`

No afirmar éxito para un comando no ejecutado. Si Docker/DB no están
disponibles, reportar el bloqueo y no marcar READY FOR REVIEW.

## 17. Expected Claude handoff

Claude debe devolver a Codex:

1. estado y resumen estrictamente de implementación;
2. archivos cambiados y propósito;
3. dependencia OIDC añadida y razón;
4. migración, rollback, constraints, grants y RLS;
5. contratos/API/OpenAPI;
6. matriz principal/perfil/relación/rol implementada;
7. evidencia de los 15 acceptance criteria;
8. comandos y resultados completos;
9. evidencia Keycloak local sin Entra/red externa;
10. evidencia de dos tenants y rol runtime;
11. scan de secretos/PII/logs;
12. desviaciones, riesgos o STOP CONDITION;
13. confirmación de cero cambios a Visits, web y prototipo.

El handoff pasa a auditoría de Codex. No equivale a aceptación del Product
Owner y no autoriza Git integration o despliegue.

## 18. STOP CONDITIONS

Claude se detiene y devuelve el problema a Codex si:

1. necesita Entra, Internet u otra infraestructura externa para completar las
   pruebas locales después de obtener las dependencias/imágenes versionadas;
2. el flujo requiere auth bypass, login simulado, header de identidad, password
   MERDN o sesión manual;
3. Keycloak local/HTTP puede habilitarse en `mvp`/production;
4. no puede usar un issuer canónico alcanzable por browser y API;
5. requiere auto-link por claims o reutilizar EnrollmentSession;
6. necesita tocar Visits, web, prototipo o archivos fuera de allowlist;
7. no puede garantizar FK tenant-aware, RLS, grants o rol runtime;
8. no puede garantizar callback/session/audit o relación/audit atómicos;
9. `btree_gist`/exclusion constraint no está disponible;
10. una prueba de seguridad, tenant, permisos, concurrencia o auditoría falla;
11. necesita datos reales, representación legal, clínica o una semántica no
    aprobada;
12. encuentra contradicción material no resuelta por este packet.

## 19. No open decisions

No quedan decisiones de producto, arquitectura, seguridad, datos o alcance que
Claude deba resolver. Entra External ID, datos reales, producción,
multiinstitución, identity proofing productivo y autorización legal del
cuidador son requisitos diferidos y no bloquean esta implementación local.

---

IDENTITY-RELATIONSHIPS READY FOR CLAUDE: YES

CLAUDE PACKET: tasks/IDENTITY-RELATIONSHIPS-CORE-01-CLAUDE-PACKET.md

EXPECTED IMPLEMENTATION ONLY: Código, migración aditiva/rollback, configuración OIDC local sin secretos, provisioning CLI, APIs/guards/policies/auditoría y pruebas dentro de la allowlist; cero análisis/rediseño y cero cambios a VISITS
