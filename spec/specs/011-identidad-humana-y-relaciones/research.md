# Investigación 011 - Identidad humana y relaciones paciente-cuidador

Medido sobre `develop` el 2026-08-25. Cada hallazgo indica el comando o la ruta
que lo respalda. Lo que no se pudo comprobar está en R16.

## R1. El proveedor OIDC aprobado cambió respecto del paquete de decisiones

El `OWNER-DECISION-PACKET` §3 recomienda «Microsoft Entra External ID real en un
tenant no productivo». Su propio encabezado registra la condición vinculante del
Product Owner: ninguna dependencia OIDC externa puede bloquear el MVP. El
`CLAUDE-PACKET` §AD-01 cierra esa condición: «El proveedor local aprobado es
Keycloak `26.7.1` […]. Entra External ID queda fuera de esta Task».

Medido en el código: `compose.yml:155` fija
`image: quay.io/keycloak/keycloak:26.7.1` y `.env.example:120` declara
`MERDN_HUMAN_AUTH_ISSUER=http://host.docker.internal:8081/realms/merdn-local`.
No existe ninguna referencia a Entra en `apps/api/src/`. La spec debe reflejar la
decisión ejecutada, no la recomendada.

## R2. Seis tablas y ocho enums, en una sola migración aditiva

```
grep -E 'CREATE TABLE "[a-z_]+"' prisma/migrations/20260823120000_identity_relationships_core_01/migration.sql
```

Devuelve exactamente `human_account`, `external_auth_identity`, `human_session`,
`human_auth_attempt`, `patient_caregiver_relationship` y
`patient_caregiver_relationship_scope`. La migración tiene 616 líneas y su
rollback (`ROLLBACK-identity_relationships_core_01.sql`) 137.

Los enums viven en `prisma/schema.prisma:959-1014`; los modelos en `:1026-1261`.
La migración añade además `CAREGIVER_RELATIONSHIP_MANAGER` a `InstitutionalRole`
(`migration.sql:53`), `HUMAN_ACCOUNT` y `SYSTEM` a `AuditActorType` y ocho
eventos a `AuditEventType` (`schema.prisma:140-147`).

## R3. Row Level Security forzada y grants sin DELETE en las seis tablas

```
grep -E 'ENABLE ROW LEVEL SECURITY|CREATE POLICY|GRANT ' .../migration.sql
```

Seis `ENABLE ROW LEVEL SECURITY` (`:571-581`), seis `CREATE POLICY` sobre
`merdn_current_tenant()` (`:588-618`) y seis `GRANT`. Ninguno concede `DELETE`
(`:558-563`); `patient_caregiver_relationship_scope` recibe solo
`SELECT, INSERT`. Esto es coherente con la regla de auditoría append-only y con
la decisión de que desvincular no borre historia sino que la desactive.

## R4. Las garantías de integridad viven en la base, no solo en el servicio

Medido en la misma migración:

- `patient_caregiver_relationship_version_positive` (`:402`) — `version > 0`.
- `patient_caregiver_relationship_period_order` (`:407`) — `startsAt < endsAt`.
- `patient_caregiver_relationship_validation_scope` (`:413`) — `ACTIVE` exige
  validador y `validatedAt`.
- `patient_caregiver_relationship_revocation_scope` (`:423`) — `REVOKED` exige
  actor, fecha y motivo; cualquier otro estado los exige `NULL`. Las dos mitades
  están en un solo `CHECK` para que no puedan divergir.
- `patient_caregiver_relationship_authorization_reference_shape` (`:443`) —
  patrón `^[A-Z0-9][A-Z0-9._:-]{0,99}$`, nunca texto libre.
- `merdn_caregiver_relationship_guard()` (`:452-478`) — trigger `BEFORE INSERT OR
  UPDATE` que consulta el `personId` del paciente en el mismo tenant y rechaza
  que coincida con `caregiverPersonId`. Es `SECURITY INVOKER` a propósito: bajo
  `merdn_runtime` queda sujeto a RLS y no puede leer pacientes de otra
  institución.
- `patient_caregiver_relationship_active_no_overlap` (`:490-502`) — exclusion
  constraint `gist` con `btree_gist` (`:43`) sobre tenant, paciente, cuidadora,
  tipo, finalidad y `tstzrange("startsAt","endsAt",'[)')`, parcial
  `WHERE status = 'ACTIVE'`.

## R5. M:N confirmado: varios cuidadores por paciente y varios pacientes por cuidador

`docs/PRODUCT.md:45-46` exige ambas direcciones y que cada relación conserve
autorización, alcance, estado y vigencia propios.

Medido en `prisma/schema.prisma:1188-1243`: `PatientCaregiverRelationship` no
declara ninguna clave única sobre `patientId` ni sobre `caregiverPersonId`. Sus
únicas restricciones de unicidad son `(id, tenantId)` y la exclusion constraint
parcial de R4, que solo actúa sobre relaciones `ACTIVE` de la combinación exacta
con vigencias solapadas. Cada fila lleva su propio `status`, `startsAt`,
`endsAt`, `validationSource`, `authorizationReference` y `version`, y sus
alcances viven en filas separadas de `patient_caregiver_relationship_scope`.

Conclusión medida: el modelo cumple `PRODUCT.md` §3.6 y §3.7.

En la misma línea, `docs/DATA.md:189` declara «Persona 1 → 0..* cuentas
(cardinalidad definitiva bloqueante)», y el esquema lo respeta: `HumanAccount`
no declara unicidad por `personId` (`schema.prisma:1026-1057`). Es una omisión
deliberada y documentada en el propio comentario del modelo.

## R6. El catálogo aprobado se implementó como enums de un solo valor

`PatientCaregiverRelationshipType` contiene solo `DECLARED_CARE_SUPPORT`;
`PatientCaregiverPurpose` solo `HOME_CARE_COORDINATION`; `CaregiverScope` solo
`VISITS_VIEW`; `CaregiverRelationshipValidationSource` solo
`CONTROLLED_MVP_OPERATOR_ASSERTION`. No existe `SUSPENDED`, ni comodín, ni
`VISITS_CONTRIBUTE`, ni `VISITS_EXECUTE`. Ampliar el catálogo exige una
migración, no una configuración: es exactamente lo que pedía la decisión 5 del
Product Owner.

## R7. Sesión humana: los tres valores aprobados están en constantes

`apps/api/src/human-auth/human-auth.contract.ts`:

- `:98` `HUMAN_SESSION_TTL_SECONDS = 8 * 60 * 60`
- `:101` `HUMAN_SESSION_IDLE_SECONDS = 30 * 60`
- `:104` `HUMAN_AUTH_ATTEMPT_TTL_SECONDS = 600`
- `:107` `HUMAN_AUTH_ALLOWED_ALGORITHM = 'RS256'`
- `:110` `HUMAN_AUTH_SCOPE = 'openid'` — no se pide perfil, correo ni ningún dato
  personal.

Una sola sesión activa: `human-auth.service.ts:541-543` hace `updateMany` de las
sesiones no revocadas de la cuenta antes de `create` en `:556`, dentro de la
misma transacción. `:673` documenta y ejecuta que `expiresAt` no se toca al
actualizar `lastUsedAt`.

## R8. La validación de sesión reevalúa el vínculo externo en cada petición

`human-auth.service.ts:639-668` deniega si la sesión está revocada, si superó su
vigencia absoluta, si la inactividad alcanza `sessionIdleSeconds`, si el tenant
no coincide, si `HumanAccount.status !== 'ACTIVE'` o si
`externalAuthIdentity.count({ status: 'ACTIVE' })` es cero. Esa última
comprobación es la que hace que `UNLINK` cierre el acceso aunque la revocación de
sesiones fallara: no depende de que otro proceso acertara.

## R9. El intento de autenticación no confía nada al navegador

`HumanAuthAttempt` guarda `browserTokenHash`, `stateHash`, `nonceHash` y el
verifier PKCE cifrado en tres columnas
(`pkceVerifierCiphertext`/`Iv`/`AuthTag`), según `schema.prisma:1146-1186`. El
cifrado es AES-256-GCM con clave exclusiva de `MERDN_HUMAN_AUTH_ATTEMPT_KEY`
(`human-auth-attempt.crypto.ts`, probado en `human-auth-attempt.crypto.test.ts`).

El consumo es atómico: `human-auth.service.ts:382` ejecuta `updateMany` con
`consumedAt: null` dentro del filtro, de modo que dos callbacks concurrentes no
pueden consumir el mismo intento.

## R10. El adapter OIDC devuelve dos campos y ninguno más

`apps/api/src/human-auth/oidc.adapter.ts:43-46` define
`VerifiedExternalIdentity = { issuer, subject }`. La cabecera del archivo declara
que la verificación criptográfica se delega en `openid-client` —firma, `kid`
contra JWKS, emisor exacto, audiencia, `exp`, `nbf` y algoritmo— y que un fallo
de discovery no se memoriza (`:80-90`), de modo que un proveedor caído no
bloquea el módulo para siempre pero tampoco concede acceso.

## R11. La superficie de relaciones está tras un rol disjunto

`caregiver-relationship.controller.ts:96` aplica
`CaregiverRelationshipManagerGuard` a todo el controlador; las tres mutaciones
añaden `SameOriginGuard` (`:107`, `:205`, `:265`).
`institutional-auth/caregiver-relationship-manager.guard.ts:115` exige
`principal.role !== 'CAREGIVER_RELATIONSHIP_MANAGER'` para denegar. El rol se
aprovisiona en `institutional-auth.config.ts:141` desde
`MERDN_CAREGIVER_RELATIONSHIP_MANAGER_CODE` y `_SECRET`.

Concurrencia optimista medida en `caregiver-relationship.service.ts:322-352`: el
`updateMany` filtra por `version: request.expectedVersion` y por los estados
admitidos, y `count === 0` produce `409`. La auditoría se escribe dentro de la
misma transacción (`:346`), no después.

## R12. El comando de aprovisionamiento existe y revoca en la misma operación

`tools/identity-provisioning/src/operations.ts` implementa `LINK` (`:155`,
`:194`), `UNLINK` (`:254`) y `DISABLE_ACCOUNT` (`:334`). `UNLINK` y
`DISABLE_ACCOUNT` llaman a `revokeSessions()` (`:259`, `:307`, `:339`), que
ejecuta `SET "revokedAt" = now()` sobre las sesiones vivas (`:408-418`). La
auditoría se escribe con `'SYSTEM', NULL, NULL` (`:450`): el aprovisionamiento no
finge ser una persona. `package.json:31` expone
`identity:provision` con `--env-file-if-exists=.env`.

No existe ningún endpoint público de vinculación: grep de `ExternalAuthIdentity`
en controladores no devuelve escritura alguna.

## R13. Hallazgo principal: la capacidad de cuidador no llega a ninguna superficie

```
grep -rn "CaregiverRelationshipPolicy\|IdentityAccessService" apps/api/src --include="*.ts" | grep -v "\.test\.ts"
```

Fuera de `people-relationships/` e `identity-access/`, el único consumidor es
`app.module.ts`, que registra los módulos. **`apps/api/src/visits/` importa
`HumanSessionGuard` (`visits.controller.ts:42`, `:265`) y nada más.** Un grep de
`caregiver` sobre `apps/api/src/visits/*.ts` no devuelve ninguna coincidencia.

Consecuencia medida: `canCaregiverViewVisits()` está implementada, exportada
(`people-relationships.module.ts:42`) y sin consumidor. Hoy una persona
cuidadora autenticada no puede leer ninguna visita, porque no existe endpoint que
consulte la política. El gate del packet §7.2 se construyó; la superficie que
debía atravesarlo, no.

Relacionado: Visitas no reutiliza `IdentityAccessService`, sino que deriva el
profesional desde `principal.personId` con consultas propias en
`professional-visit-query.service.ts:170`,
`professional-visit-worklist.service.ts:317` y
`home-visit-transition.service.ts:339`. La regla de seguridad se respeta, pero la
lógica está duplicada.

## R14. `EXPIRED` nunca se escribe

```
grep -rn "status: 'EXPIRED'" apps/api/src prisma/ tools/
```

Sin coincidencias. `EXPIRED` aparece solo en el enum
(`schema.prisma:986-993`), en la lista de estados del contrato
(`caregiver-relationship.contract.ts:54`), en un comentario del servicio
(`:314`), en una descripción de DTO (`:147`) y en el tipo de una fixture de
prueba (`identity-relationships-fixtures.ts:299`).

La caducidad se aplica siempre por vigencia: tanto `canCaregiverViewVisits` como
`hasAnyActiveCaregiverRelationship` filtran `startsAt: { lte: now }` y
`OR: [{ endsAt: null }, { endsAt: { gt: now } }]`
(`caregiver-relationship.policy.ts:70-71` y `:103-104`). Es decir, una relación
caducada **no autoriza**, aunque su fila siga almacenada como `ACTIVE`
indefinidamente. El `CLAUDE-PACKET` §6 permitía materialización perezosa y
prohibía un worker; no se implementó ninguna de las dos, y la fila queda
desalineada con la realidad.

## R15. Cobertura de pruebas: qué existe y qué falta

Existente:

| Archivo | Naturaleza | Qué cubre |
|---|---|---|
| `apps/api/test/human-auth.api.test.ts` | API con PostgreSQL, 22 casos | Validez de sesión, denegación uniforme, no prolongar vigencia, separación de las tres cookies, logout, callback fallido, crear/activar/revocar con versión, revocación inmediata, `404` cross-tenant, `UNLINK`/`DISABLE_ACCOUNT` |
| `apps/api/test/identity-professional-assignment.db.test.ts` | DB con rol `merdn_runtime` real, 16 casos | Cadena profesional completa de MP03-B: sesión → principal → perfil → afiliación → asignación, y denegaciones focales incluido tenant ausente |
| `apps/api/src/identity-access/identity-access.service.test.ts` | Unitaria | Resolutores de participación |
| `apps/api/src/people-relationships/caregiver-relationship.request.test.ts` | Unitaria | Validación del contrato de petición |
| `apps/api/src/human-auth/human-auth.config.test.ts` | Unitaria | Configuración y rechazo de emisor local fuera de `development`/`test` |
| `apps/api/src/human-auth/human-auth-attempt.crypto.test.ts` | Unitaria | Cifrado AES-256-GCM del verifier |
| `apps/api/src/human-auth/human-session.cookie.test.ts` | Unitaria | Atributos de la cookie |
| `tools/identity-provisioning/src/operations.test.ts` | Unitaria, 15 casos | Idempotencia, conflicto, aislamiento de tenant y revocación del comando |

Ausente, medido:

1. **Ninguna prueba del `OidcAdapter` ni del login feliz.** La cabecera de
   `human-auth.api.test.ts:1-10` lo declara literalmente: «el descubrimiento OIDC
   NO se ejecuta en estas pruebas, que no llegan a tocar el proveedor». Las
   sesiones se siembran con la fixture `crearSesionHumana`. La prueba de callback
   (`:406-448`) recorre cuatro casos y los cuatro son de fallo. La comprobación
   del login real contra Keycloak fue manual (`CONTINUATION` §3.4,
   `MICRO-01-KEYCLOAK-REIMPORT`).
2. **Ninguna prueba de las garantías DB que introduce esta migración.** Grep de
   `no_overlap`, `caregiver_relationship_guard` y `merdn_current_tenant` sobre
   `apps/api/test/` y `tools/` no devuelve coincidencias. La exclusion
   constraint, el trigger contra autorrelación y la RLS/grants de las seis tablas
   nuevas no se prueban.
   `identity-professional-assignment.db.test.ts` sí usa el rol runtime real, pero
   sobre `professional_profile`, `professional_affiliation` y `care_assignment`,
   que pertenecen a la spec 010.
3. **Las pruebas del comando de aprovisionamiento no tocan PostgreSQL.** Su
   propia cabecera (`operations.test.ts:24-31`) declara que usa «una base
   FICTICIA en memoria» y que «las garantías del motor (RLS, CHECK, transacción)
   viven en las pruebas de base de datos». Esas pruebas de base de datos no
   existen para estas tablas.
4. **La suite de API se salta en silencio sin PostgreSQL:**
   `human-auth.api.test.ts:119` es `describe.skipIf(!puedeEjecutarse)`. Una
   ejecución sin base de datos termina en verde sin haber probado esta spec.

El `CLAUDE-PACKET` §16 exigía explícitamente «exclusion constraint bajo carrera
concurrente», «dos tenants con rol runtime real» y «prueba OIDC local contra
`oidc-local`». Las tres faltan en la suite.

## R16. Verificación no ejecutada

- **No se ejecutó ninguna prueba.** `node_modules` no está instalado y
  PostgreSQL no está levantado. No se ejecutaron `npm run lint`,
  `npm run typecheck`, `npm run prisma:validate`, `npm run build`,
  `npm run secrets:scan`, `npm run docker:config` ni ninguna suite de Vitest. Por
  tanto **no se afirma que ninguna prueba pase hoy**: lo que R15 documenta es qué
  archivos de prueba existen y qué casos declaran, medido leyéndolos.
- **No se levantó Keycloak.** No se ejecutó
  `docker compose --profile oidc-local up -d oidc-local` ni se comprobó el
  discovery. Que el emisor canónico responda `200` desde el host y desde el
  contenedor de la API está afirmado en `CONTINUATION` §3.4 y en
  `MICRO-01-KEYCLOAK-REIMPORT`, no verificado aquí.
- **No se aplicó la migración ni se probó el rollback.** No se comprobó que
  `btree_gist` esté disponible en el motor local, ni que la exclusion constraint
  se cree, ni que `ROLLBACK-identity_relationships_core_01.sql` revierta
  limpiamente.
- **No se verificó el comportamiento en tiempo de ejecución de la RLS.** Que las
  políticas existan está medido sobre el SQL; que `merdn_runtime` no pueda
  atravesarlas no se comprobó contra un motor.
- **No se auditó el registro real ni las respuestas** en busca de `code`,
  tokens, claims, verifier o PII. El código declara la regla en varios lugares y
  el `SameOriginGuard` documenta que no registra el origen, pero no se ejecutó
  ningún escaneo.
- **No existe auditoría de Codex de esta capacidad.** `ls reviews/` y
  `grep -rl "IDENTITY-RELATIONSHIPS" reviews/` no devuelven ningún archivo. Los
  quince criterios de aceptación del `CLAUDE-PACKET` §15 no tienen verificación
  independiente registrada en el repositorio.
