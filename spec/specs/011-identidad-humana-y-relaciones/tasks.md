# Tareas 011 - Identidad humana y relaciones paciente-cuidador

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

### Modelo de datos y migración

- [x] Migración aditiva `20260823120000_identity_relationships_core_01` (616 líneas) con rollback documentado (137 líneas)
- [x] Seis tablas: `human_account`, `external_auth_identity`, `human_session`, `human_auth_attempt`, `patient_caregiver_relationship`, `patient_caregiver_relationship_scope`
- [x] Ocho enums cerrados; `PatientCaregiverRelationshipType`, `PatientCaregiverPurpose`, `CaregiverScope` y `CaregiverRelationshipValidationSource` tienen un solo valor cada uno
- [x] `CAREGIVER_RELATIONSHIP_MANAGER` añadido a `InstitutionalRole` (`migration.sql:53`)
- [x] `HUMAN_ACCOUNT` y `SYSTEM` añadidos a `AuditActorType`; ocho eventos añadidos a `AuditEventType` (`schema.prisma:140-147`)
- [x] Claves foráneas compuestas tenant-aware y unique `(id, tenantId)` en las seis tablas
- [x] `ENABLE` + `FORCE ROW LEVEL SECURITY` y política `USING`/`WITH CHECK` sobre `merdn_current_tenant()` en las seis tablas (`migration.sql:571-618`)
- [x] Grants de mínimo privilegio sin `DELETE`; la tabla de alcances solo `SELECT, INSERT` (`migration.sql:558-563`)
- [x] `CHECK` de `version > 0`, `startsAt < endsAt`, coherencia de validación y de revocación, y forma opaca de `authorizationReference` (`migration.sql:402-450`)
- [x] Trigger tenant-aware `merdn_caregiver_relationship_guard()` contra la autorrelación, `SECURITY INVOKER` y por tanto sujeto a RLS (`migration.sql:452-478`)
- [x] Exclusion constraint `btree_gist` contra relaciones `ACTIVE` solapadas, parcial y con rango `[startsAt, endsAt)` (`migration.sql:490-502`)
- [x] `HumanAccount` admite 0..* cuentas por `Person`: no se declaró unicidad por persona, conforme a `docs/DATA.md:189`, que declara «Persona 1 → 0..* cuentas (cardinalidad definitiva bloqueante)»
- [x] M:N real: sin unicidad por `patientId` ni por `caregiverPersonId`; cada relación conserva estado, alcance y vigencia propios (`PRODUCT.md` §3.6-3.7)

### Autenticación humana

- [x] Adapter OIDC único con `openid-client`, Authorization Code + PKCE S256 (`oidc.adapter.ts`)
- [x] Devuelve exclusivamente `{ issuer, subject }`; no copia ni confía ningún claim (`oidc.adapter.ts:43-46`)
- [x] Algoritmo fijado a `RS256` y `scope` exactamente `openid` (`human-auth.contract.ts:107`, `:110`)
- [x] Sin `dev-login`, sin cabecera de identidad, sin contraseña MERDN, sin repliegue
- [x] `HumanAuthAttempt` con `state` y `nonce` hasheados y verifier PKCE cifrado AES-256-GCM (`human-auth-attempt.crypto.ts`)
- [x] Clave del cifrado exclusivamente desde `MERDN_HUMAN_AUTH_ATTEMPT_KEY`, sin valor por defecto
- [x] Consumo atómico del intento mediante `updateMany` con `consumedAt: null` en el filtro (`human-auth.service.ts:382`)
- [x] TTL del intento 600 s (`human-auth.contract.ts:104`)
- [x] Allowlist cerrada de destino de retorno, exactamente `['/']` (`human-auth.contract.ts:78`)
- [x] Cookie `merdn_human_session`, `HttpOnly`, distinta de la de inscripción y de la institucional (`human-session.cookie.ts`)
- [x] Sesión de 8 h absolutas y 30 min de inactividad (`human-auth.contract.ts:98`, `:101`)
- [x] Una sola sesión activa: revocación de las anteriores y creación en la misma transacción (`human-auth.service.ts:541-566`)
- [x] `lastUsedAt` no desplaza `expiresAt` (`human-auth.service.ts:673`)
- [x] Revalidación por operación: revocación, vigencia absoluta, inactividad, tenant, cuenta `ACTIVE` y vínculo externo `ACTIVE` (`human-auth.service.ts:639-668`)
- [x] `GET /api/v1/human-auth/login`, `/callback`, `/session`, `POST /logout`
- [x] `GET /api/v1/me/contexts` con contextos derivados en servidor
- [x] Respuestas sin `tenantId`, `humanAccountId`, `personId`, `patientId`, `professionalId`, `issuer`, `subject` ni claims (`human-auth.dto.ts`)
- [x] Denegación uniforme: el código de error no distingue sesión ausente, expirada, revocada ni cuenta deshabilitada
- [x] `SameOriginGuard` con denegación por defecto en mutaciones (`same-origin.guard.ts`)
- [x] `HumanAuthRateLimitGuard` en `login`, `callback` y `logout`
- [x] Emisor local o sin TLS admitido solo en `development`/`test`; `merdn-local` prohibido en `mvp` (`human-auth.config.ts`, probado en `human-auth.config.test.ts`)

### Participaciones y relación

- [x] `HumanPrincipal` construido únicamente por el validador de sesión (`human-principal.ts`)
- [x] `resolvePatient()` — `Person -> Patient ACTIVE`, sin aceptar `patientId` del cliente
- [x] `resolveProfessional()` — exige perfil `ACTIVE` **y** afiliación `ACTIVE` vigente
- [x] `hasActiveAssignmentOverPatient()` — perfil, afiliación y `CareAssignment` evaluados en una sola transacción tenant-scoped
- [x] `canCaregiverViewVisits()` — tenant, persona del principal, `ACTIVE`, vigencia viva, tipo y finalidad exactos y alcance `VISITS_VIEW`
- [x] La vigencia manda sobre el estado: `endsAt <= now` deniega aunque la fila diga `ACTIVE` (`caregiver-relationship.policy.ts:70-71`)
- [x] `HumanContextsService` deriva `PATIENT`/`PROFESSIONAL`/`CAREGIVER` sin sumar permisos entre participaciones
- [x] `POST`, `GET :id`, `PATCH :id/activate` y `PATCH :id/revoke` de relaciones
- [x] Toda la superficie tras `CaregiverRelationshipManagerGuard`; mutaciones también tras `SameOriginGuard`
- [x] Rol disjunto: `HOSPITAL_SCHEDULER` no gestiona relaciones
- [x] Concurrencia optimista con `expectedVersion` y `409` sin escritura parcial (`caregiver-relationship.service.ts:322-352`)
- [x] Servidor fija tipo, finalidad, estado, fuente, alcance, fechas de validación/revocación y versión
- [x] `404` uniforme para inexistente y para otro tenant
- [x] Mutación de relación y evento de auditoría confirmados en la misma transacción (`caregiver-relationship.service.ts:346`)

### Auditoría, aprovisionamiento e infraestructura

- [x] Ocho eventos nuevos en el enum `AuditEventType` (`prisma/schema.prisma:140-147`); `identity-audit.service.ts` emite CINCO de ellos (sesión creada/revocada y relación creada/validada/revocada) y el comando de aprovisionamiento emite los tres restantes —`HUMAN_IDENTITY_LINKED`, `HUMAN_IDENTITY_UNLINKED` y `HUMAN_ACCOUNT_DISABLED`— desde `tools/identity-provisioning/src/operations.ts:155,254,334`
- [x] Atribución por clase de actor: `HUMAN_ACCOUNT` para la persona, `INSTITUTIONAL_IDENTITY` con rol para el gestor, `SYSTEM` sin actor ni rol para el aprovisionamiento
- [x] `npm run identity:provision` con `--dry-run` por defecto (`package.json:31`)
- [x] Acciones `LINK`, `UNLINK` y `DISABLE_ACCOUNT` con esquema discriminado estricto
- [x] Idempotencia por `(tenantId, issuer, subject)`; un binding de otra `Person` produce conflicto sin escribir
- [x] `UNLINK` y `DISABLE_ACCOUNT` revocan las sesiones vivas en la misma operación (`operations.ts:259`, `:307`, `:339`)
- [x] Auditoría del comando sin `issuer`, `subject` ni PII (`operations.ts:450`)
- [x] Sin endpoint público de vinculación
- [x] Servicio `oidc-local` opt-in tras el perfil `oidc-local`, imagen fijada `quay.io/keycloak/keycloak:26.7.1`, publicado solo en `127.0.0.1` (`compose.yml:153-176`)
- [x] Realm `merdn-local` versionado sin secretos, con `pkce.code.challenge.method: S256` y sustitución `${MERDN_OIDC_LOCAL_TEST_PASSWORD}`
- [x] Emisor canónico `host.docker.internal` alcanzable por navegador y por el contenedor de la API (`compose.yml:78`, `human-auth.contract.ts:145`)
- [x] `.env.example` con las variables del módulo y sin valores reales

### Pruebas presentes

- [x] `apps/api/test/human-auth.api.test.ts` — 22 casos de superficie humana y de relaciones, con PostgreSQL
- [x] `apps/api/test/identity-professional-assignment.db.test.ts` — 16 casos de la cadena profesional bajo el rol `merdn_runtime` real (MP03-B)
- [x] `apps/api/src/identity-access/identity-access.service.test.ts`
- [x] `apps/api/src/people-relationships/caregiver-relationship.request.test.ts`
- [x] `apps/api/src/human-auth/human-auth.config.test.ts`
- [x] `apps/api/src/human-auth/human-auth-attempt.crypto.test.ts`
- [x] `apps/api/src/human-auth/human-session.cookie.test.ts`
- [x] `tools/identity-provisioning/src/operations.test.ts` — 15 casos con base ficticia en memoria

## Límites conocidos (no autorizados como trabajo)

- [ ] Ninguna superficie consume `canCaregiverViewVisits()`: hoy una persona cuidadora no puede ver ninguna visita. `apps/api/src/visits/` importa solo `HumanSessionGuard`
- [ ] `EXPIRED` no se escribe nunca: no hay materialización perezosa ni worker. Una relación caducada sigue almacenada como `ACTIVE`
- [ ] Visitas no reutiliza `IdentityAccessService`: deriva el profesional con consultas propias en tres servicios distintos
- [ ] No existe endpoint de listado de relaciones; solo `GET` por identificador
- [ ] No existe interfaz de usuario de esta capacidad: ni pantalla de cuidador ni gestión de relaciones en `apps/web/`
- [ ] `HumanAuthAttempt` no se limpia: sin `DELETE` en runtime ni proceso de limpieza (diferido expresamente por el packet §4.3)
- [ ] Límite de tasa en memoria del proceso: no protege un despliegue con varias instancias
- [ ] Destino de retorno tras el login limitado a exactamente `/`
- [ ] Entra External ID no integrado: solo Keycloak local con personas ficticias
- [ ] La identidad institucional gestora es compartida: la auditoría identifica la credencial, no a la persona operadora
- [ ] `CONTROLLED_MVP_OPERATOR_ASSERTION` es la única procedencia posible: no acredita representación legal, parentesco, capacidad ni consentimiento clínico, y no admite documentos ni evidencia adjunta
- [ ] Sin MFA, sin recuperación, sin gestión de dispositivos, sin sesiones paralelas y sin `remember me`
- [ ] Un solo alcance de cuidador (`VISITS_VIEW`, solo lectura): no existe `VISITS_CONTRIBUTE`, `VISITS_EXECUTE`, clínica ni exportación
- [ ] Sin `Institution`/`Organization`, sin selector de contexto y sin acceso interinstitucional: el tenant es la frontera institucional temporal del MVP
- [ ] Solo datos ficticios o controlados: ni esta spec ni sus Task Specifications autorizan datos reales, uso clínico ni producción

## Verificación pendiente

- [ ] Ejecutar la suite: `node_modules` no está instalado y PostgreSQL no está levantado. No se ejecutó ninguna prueba, ni `lint`, `typecheck`, `prisma:validate`, `build`, `secrets:scan` ni `docker:config`
- [ ] `human-auth.api.test.ts` es `describe.skipIf(!puedeEjecutarse)` (línea 119): sin base de datos termina en verde sin probar nada de esta spec
- [ ] Probar el flujo OIDC feliz: no existe prueba del `OidcAdapter` ni del login completo. `human-auth.api.test.ts` declara que no toca el proveedor y siembra las sesiones con fixture; la única prueba de callback cubre solo caminos de fallo
- [ ] Probar la exclusion constraint contra solapamiento, incluida carrera concurrente (exigido por el packet §16)
- [ ] Probar el trigger tenant-aware contra la autorrelación
- [ ] Probar RLS, políticas `USING`/`WITH CHECK` y grants de las seis tablas nuevas con el rol `merdn_runtime` real y dos tenants (exigido por el packet §16)
- [ ] Probar que `AuditEvent` rechaza `UPDATE`, `DELETE` y `TRUNCATE` desde runtime
- [ ] Probar el comando de aprovisionamiento contra PostgreSQL: sus 15 casos usan una base ficticia en memoria
- [ ] Aplicar la migración desde cero y sobre estado previo, y evaluar el rollback documentado
- [ ] Confirmar que `btree_gist` está disponible en el motor local
- [ ] Levantar `oidc-local` y comprobar el discovery desde el host y desde el contenedor de la API con el emisor canónico
- [ ] Escanear registro, respuestas y base en busca de `code`, tokens, claims, verifier, `issuer`, `subject`, `authorizationReference` o PII
- [ ] Registrar una auditoría en `reviews/`: no existe ninguna para `IDENTITY-RELATIONSHIPS-CORE-01`, de modo que los quince criterios de aceptación del packet §15 no tienen verificación independiente
