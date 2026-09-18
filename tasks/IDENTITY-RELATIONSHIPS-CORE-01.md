# MERDN Task Specification — IDENTITY-RELATIONSHIPS-CORE-01

## 1. Identificación y gate

- **Task ID:** `IDENTITY-RELATIONSHIPS-CORE-01`
- **Título:** Núcleo compartido de identidad humana y relación Paciente–Cuidador
- **Estado:** `APPROVED — READY FOR CLAUDE VIA EXECUTION PACKET`
- **Dependencias existentes:** `TASK-MVP-CORE-01`, `TASK-MUNICIPALITY-CORE-01`, `TASK-HOSPITAL-CORE-01` y `TASK-HOSPITAL-CORE-02`
- **Consumidores objetivo:** Profesional/Visitador, Paciente, Cuidador, Hospital y `VISITS-CORE-01`

Este documento diseña exclusivamente el prerequisito solicitado. No rediseña
`VISITS-CORE-01`. Las decisiones de §17 fueron aprobadas en bloque por el
Product Owner el 2026-08-23, con la condición adicional de que ninguna
dependencia OIDC externa bloquee la implementación y verificación local.

La instrucción ejecutable y cerrada para Claude Code es
`tasks/IDENTITY-RELATIONSHIPS-CORE-01-CLAUDE-PACKET.md`. En caso de diferencia,
ese packet y la aprobación posterior del Product Owner prevalecen sobre las
recomendaciones anteriores de este documento.

## 2. Objetivo y valor

Proveer un principal humano autenticado, durable, revocable y atribuible que se
vincule a la `Person` canónica, y una relación Paciente–Cuidador muchos-a-muchos,
contextual, vigente y con alcance explícito.

El núcleo debe permitir que una misma persona participe como paciente,
profesional o cuidador sin duplicar identidad ni acumular permisos entre
contextos. Hospital conserva su identidad institucional actual. El resultado
debe satisfacer los dos gates de identidad de `VISITS-CORE-01` sin incorporar
el dominio de visitas a este incremento.

## 3. Hechos que este diseño preserva

1. `Person` es el maestro humano único dentro del tenant.
2. `Patient` y `ProfessionalProfile` son participaciones de `Person`; no son
   cuentas ni identidades de autenticación.
3. `ProfessionalAffiliation`, `CareAssignment` y `Appointment` conservan su
   semántica y no se modifican en este diseño.
4. `InstitutionalIdentity`/`InstitutionalSession` representan identidades
   institucionales opacas y compartidas. No identifican a una persona.
5. `EnrollmentSession` es una sesión temporal de inscripción. No es una cuenta
   durable ni se promociona, canjea o reutiliza como autenticación personal.
6. El tenant se resuelve en servidor; el navegador no determina tenant, actor,
   rol, persona, paciente o profesional.
7. La relación Paciente–Cuidador es M:N y cada vínculo tiene contexto, alcance,
   finalidad, estado y vigencia propios.
8. La asignación Profesional–Paciente sigue siendo `CareAssignment`, no una
   relación personal y no una relación de cuidador.
9. `AuditEvent` permanece append-only y sin copias de PII o credenciales.

## 4. Alcance

### 4.1 En alcance

- contrato común de cuenta humana vinculada a `Person`;
- vínculo mínimo con un proveedor OIDC externo;
- sesión web humana server-side separada de las sesiones existentes;
- principal humano mínimo y resolución server-side de las participaciones
  Paciente y Profesional;
- relación explícita `Patient`–`Person` cuidadora;
- scopes cerrados por relación, inicialmente solo `visits.view`;
- policy service común y deny-by-default para los consumidores indicados;
- RLS, constraints tenant-aware, grants mínimos y auditoría;
- contratos de autenticación, sesión, contexto y relación;
- pruebas unitarias, API, integración, RLS, seguridad y aislamiento.

### 4.2 Fuera de alcance

- implementación o cambio de `VISITS-CORE-01`;
- rediseño de `Person`, `Patient`, `ProfessionalProfile`, `CareAssignment`,
  `Appointment`, `InstitutionalIdentity`, `InstitutionalSession` o
  `EnrollmentSession`;
- contraseñas locales, autenticación casera o conversión de EnrollmentSession;
- creación de una segunda persona, paciente o profesional;
- un perfil global de “Visitador”;
- `visits.contribute` o `visits.execute` para Cuidador;
- representación legal, menores, capacidad, custodia, conflictos entre
  cuidadores o acceso de emergencia;
- historia clínica, medicamentos, dirección, GPS, archivos, notas, firma,
  pagos, alertas, notificaciones, exportación o evidencia documental;
- alta general de personas, recuperación de cuenta, autoservicio de linking,
  directorio, administración completa de usuarios, MFA productivo o SSO
  institucional;
- modelo general de Institución/Organización o acceso entre tenants;
- cambios al prototipo protegido.

## 5. Alternativas y recomendación

### 5.1 Cuenta humana

- Reutilizar `InstitutionalIdentity`: rechazado; produciría falsa autoría.
- Reutilizar `EnrollmentSession`: rechazado; es temporal y no prueba identidad.
- Vincular OIDC directamente a cada perfil: rechazado; duplicaría identidad y
  fallaría para personas con varias participaciones.
- **Recomendado:** una cuenta humana vinculada a `Person`, con bindings OIDC y
  sesiones humanas separados.

### 5.2 Cuidador

- Rol global `CAREGIVER`: rechazado; daría acceso sin relación por paciente.
- Reutilizar `CareAssignment`: rechazado; esa entidad es Profesional–Paciente.
- Crear `CaregiverProfile`: no justificado para este slice; no hay atributos
  propios aprobados. La participación de cuidador nace de la relación.
- **Recomendado:** `PatientCaregiverRelationship` + scopes normalizados.

### 5.3 Autenticación

- Passwords MERDN: rechazado por `SECURITY.md`.
- **Recomendado:** adapter OIDC/OAuth 2.0, Authorization Code + PKCE, con
  Microsoft Entra External ID como proveedor objetivo y autorización local.
  La aprobación del proveedor/configuración operativa sigue abierta en §17.

## 6. Modelo de datos propuesto

Los nombres son normativos para el packet posterior, salvo ajuste explícito
aprobado antes de implementación.

### 6.1 `HumanAccount`

- `id UUID`
- `tenantId UUID`
- `personId UUID`
- `status HumanAccountStatus = ACTIVE | DISABLED`
- `createdAt`, `updatedAt`

Reglas:

1. FK compuesta `(personId, tenantId) -> Person(id, tenantId)`.
2. Unique `(id, tenantId)`.
3. No imponer unique a `(personId, tenantId)`: `DATA.md` permite 0..* cuentas
   por persona y restringirlo a una requiere decisión del Product Owner.
4. No almacena password, email, documento, nombre, rol, perfil ni tenant del
   token.
5. Deshabilitar conserva historial e invalida el uso futuro de sus sesiones.

### 6.2 `ExternalAuthIdentity`

- `id UUID`
- `tenantId UUID`
- `humanAccountId UUID`
- `issuer String`
- `subject String`
- `status ExternalAuthIdentityStatus = ACTIVE | UNLINKED`
- `linkedAt`, `unlinkedAt?`, `createdAt`, `updatedAt`

Reglas:

1. FK compuesta a `HumanAccount`.
2. Unique `(tenantId, issuer, subject)` y `(id, tenantId)`.
3. `issuer` se normaliza contra allowlist de configuración; `subject` se trata
   como identificador opaco.
4. Email, teléfono, documento, nombre o display name no enlazan cuentas y no
   conceden permisos.
5. Unlink conserva la fila y autoría histórica; no hay DELETE runtime.

### 6.3 `HumanSession`

- `id UUID`
- `tenantId UUID`
- `humanAccountId UUID`
- `tokenHash String @unique`
- `expiresAt`, `createdAt`, `lastUsedAt?`, `revokedAt?`

Reglas:

1. FK compuesta a `HumanAccount`; unique `(id, tenantId)`.
2. El token aleatorio solo viaja en una cookie `HttpOnly`; DB guarda el hash.
3. Cookie distinta de las cookies institucional y de inscripción.
4. No persiste access token, ID token, refresh token ni claims OIDC en claro.
5. La validación reconsulta cuenta, binding y perfiles/relaciones necesarios;
   la sesión no congela permisos.
6. Logout y rotación revocan server-side. Los TTL exactos requieren §17.

### 6.4 Principal humano

Contrato interno mínimo:

```text
HumanPrincipal {
  sessionId
  humanAccountId
  personId
  tenantId
}
```

No incluye rol, `patientId`, `professionalId`, scopes ni contexto confiado del
navegador. Esos datos se resuelven para cada operación.

### 6.5 `PatientCaregiverRelationship`

- `id UUID`
- `tenantId UUID`
- `patientId UUID`
- `caregiverPersonId UUID`
- `relationshipType PatientCaregiverRelationshipType`
- `purpose PatientCaregiverPurpose`
- `status PatientCaregiverRelationshipStatus`
- `startsAt`, `endsAt?`
- `validatedByInstitutionalIdentityId UUID?`
- `validatedAt?`
- `revokedByInstitutionalIdentityId UUID?`
- `revokedAt?`
- `revocationReasonCode String?` — catálogo controlado, nunca texto libre
- `version Int @default(1)`
- `createdAt`, `updatedAt`

Catálogo mínimo propuesto, sujeto a aprobación en §17:

- `relationshipType = DECLARED_CARE_SUPPORT`
- `purpose = HOME_CARE_COORDINATION`
- estados: `PENDING_VALIDATION | ACTIVE | SUSPENDED | REVOKED | EXPIRED`

Reglas:

1. FKs compuestas tenant-aware a `Patient`, `Person` y actores validadores.
2. El cuidador no puede ser la misma `Person` del paciente.
3. `startsAt < endsAt` cuando exista fin.
4. `ACTIVE` exige validación, inicio vigente y fin futuro/nulo.
5. `REVOKED` exige actor y fecha de revocación.
6. No hay borrado, reapertura ni sobrescritura del episodio histórico.
7. Debe impedirse más de una relación activa solapada para la combinación
   `(tenant, patient, caregiverPerson, relationshipType, purpose)`; un nuevo
   episodio conserva los anteriores.
8. En este slice, el único contexto institucional implementado es el tenant
   activo. Esto no afirma que tenant e Institución sean equivalentes en la
   arquitectura definitiva ni autoriza operación multiinstitucional interna.

### 6.6 `PatientCaregiverRelationshipScope`

- `id UUID`
- `tenantId UUID`
- `relationshipId UUID`
- `scope CaregiverScope`
- `createdAt`

Catálogo mínimo:

- `VISITS_VIEW` — representación externa `visits.view`

Reglas:

1. Unique `(relationshipId, tenantId, scope)`.
2. FK compuesta a la relación.
3. No JSON libre, wildcard, “acceso total” ni permisos por parentesco.
4. No existe `VISITS_EXECUTE`. `VISITS_CONTRIBUTE` queda fuera de alcance.

## 7. Resolución de contexto y autorización

### 7.1 Profesional/Visitador

```text
sesión humana válida
→ HumanAccount ACTIVE
→ Person
→ ProfessionalProfile ACTIVE
→ ProfessionalAffiliation ACTIVE y vigente
→ CareAssignment ACTIVE y coincidente con el recurso
→ permiso exacto del caso de uso
```

El servidor deriva el perfil. Nunca acepta `professionalId` o actor desde el
cliente. “Visitador” es la función ejercida en la asignación, no otra entidad.

### 7.2 Paciente

```text
sesión humana válida
→ HumanAccount ACTIVE
→ Person
→ Patient ACTIVE
→ recurso perteneciente a ese Patient
```

Un endpoint de autoservicio no acepta `patientId` como autoridad.

### 7.3 Cuidador

```text
sesión humana válida
→ HumanAccount ACTIVE
→ Person cuidadora
→ relación del paciente solicitado
→ ACTIVE + vigente + tenant/finalidad coincidentes
→ scope exacto VISITS_VIEW
```

El `patientId` solo puede seleccionar entre relaciones ya autorizadas. Una
relación no concede clínica, ejecución profesional ni acceso a otros pacientes.

### 7.4 Hospital

Hospital conserva `InstitutionalIdentity`/`InstitutionalSession`. Sus roles no
se convierten en humanos y no heredan permisos de Profesional, Paciente o
Cuidador. `HOSPITAL_SCHEDULER` no valida relaciones salvo decisión explícita;
esa autoridad está bloqueada en §17.

### 7.5 Personas con varias participaciones

Los permisos se evalúan por caso de uso y contexto. Ser simultáneamente
paciente, profesional y cuidador no suma poderes. Cada operación registra la
función/capacidad efectiva y vuelve a comprobar asignación o relación.

## 8. Autenticación y sesión objetivo

1. Authorization Code Flow + PKCE, state y nonce de un solo uso.
2. Validar firma, issuer allowlisted, audience, `exp`, `nbf` y algoritmo.
3. JWKS con caché/rotación segura; imposibilidad de validar falla cerrado.
4. Tokens nunca por query string ni `localStorage`.
5. Backend establece `HumanSession` y cookie propia `Secure`, `HttpOnly`,
   `SameSite=Lax` o más restrictiva según el callback aprobado.
6. Rate limit y respuesta anti-enumeración en inicio/callback.
7. Mutaciones por cookie exigen CSRF/origen aprobado.
8. Sesión inválida, expirada, revocada, cuenta deshabilitada o binding unlinked
   produce `401` uniforme.
9. Revocación de relación o fin de afiliación surte efecto en la siguiente
   autorización aunque la sesión permanezca viva.
10. No se autoenlaza por email, documento o claims; el linking exige el flujo
    aprobado pendiente en §17.

## 9. APIs y contratos previstos

Las rutas definitivas pueden ajustarse al patrón existente, pero el packet
posterior debe conservar estos casos de uso:

- `GET /api/v1/human-auth/login`
- `GET /api/v1/human-auth/callback`
- `GET /api/v1/human-auth/session`
- `POST /api/v1/human-auth/logout`
- `GET /api/v1/me/contexts`
- endpoints institucionales mínimos de creación, validación, suspensión y
  revocación de relación, **solo después de aprobar el actor de §17**.

Contratos comunes:

- DTOs explícitos; nunca objetos Prisma;
- no devolver `tenantId`, account ID, binding subject, token/hash, claims,
  documento ni PII innecesaria;
- `400` para contrato inválido, `401` sin principal, `403` sin capacidad y
  `404` uniforme para recurso inexistente/no relacionado/cross-tenant;
- `409` para concurrencia, solapamiento o versión obsoleta;
- `503` fail-closed para DB, proveedor/JWKS o contexto no disponible;
- `Cache-Control: private, no-store`, `Pragma: no-cache`, `Vary: Cookie`.

## 10. RLS, integridad y privilegios

Todas las tablas nuevas deben tener:

1. `tenantId NOT NULL`;
2. unique `(id, tenantId)` y FKs compuestas;
3. filtro tenant explícito en aplicación + `withTenant()`;
4. `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`;
5. policies `USING` y `WITH CHECK` basadas en `merdn_current_tenant()`;
6. runtime sin owner, superuser ni `BYPASSRLS`;
7. grants mínimos: sin `DELETE`; UPDATE solo para estados, uso/revocación y
   transiciones autorizadas;
8. contexto RLS transaccional y prueba de reutilización del pool;
9. ausencia, error o contaminación de contexto falla cerrado.

Las tablas reutilizadas mantienen sus políticas existentes. Antes de declarar
el desbloqueo integral, el packet debe verificar con el rol runtime real que
`Person`, `Patient`, `ProfessionalProfile` y `ProfessionalAffiliation` están
efectivamente protegidas. El hardening global a `FORCE RLS` de tablas legadas no
se incorpora silenciosamente a esta Task; si la prueba demuestra una brecha,
se eleva como corrección separada.

## 11. Auditoría

Extensiones mínimas propuestas:

- `AuditActorType.HUMAN_ACCOUNT`;
- `HUMAN_SESSION_CREATED`, `HUMAN_SESSION_REVOKED`;
- `HUMAN_IDENTITY_LINKED`, `HUMAN_IDENTITY_UNLINKED`,
  `HUMAN_ACCOUNT_DISABLED`;
- `CAREGIVER_RELATIONSHIP_CREATED`,
  `CAREGIVER_RELATIONSHIP_VALIDATED`,
  `CAREGIVER_RELATIONSHIP_SCOPE_CHANGED`,
  `CAREGIVER_RELATIONSHIP_SUSPENDED`,
  `CAREGIVER_RELATIONSHIP_REVOKED`;
- accesos concedidos/denegados materiales que consuman la relación se añaden
  en el módulo consumidor, incluido Visits.

Reglas:

1. `actorUserId` usa `HumanAccount.id` opaco para actor humano.
2. `actorRole` institucional queda nulo para actor humano; no se falsea un
   `InstitutionalRole`.
3. Cambio material y auditoría se confirman en una transacción; fallo de
   auditoría revierte el cambio.
4. Denegaciones siguen patrón best-effort cuando una escritura fail-closed
   permitiría DoS u oráculo.
5. No registrar nombres, documentos, contacto, issuer/subject, claims, tokens,
   cookies, payload, texto de evidencia ni PII.
6. Deshabilitar o desvincular no elimina eventos ni rompe autoría histórica.

## 12. Seguridad, privacidad y límites de significado

- Un binding OIDC demuestra control de la identidad externa enlazada según el
  assurance configurado; no prueba título, RETHUS, relación laboral,
  representación legal, capacidad, parentesco o consentimiento clínico.
- `ProfessionalProfile` + afiliación siguen siendo condiciones necesarias y no
  acreditaciones profesionales oficiales.
- `DECLARED_CARE_SUPPORT` no es representación legal ni contacto de emergencia.
- Una relación activa solo autoriza scopes expresos y nunca acceso clínico
  general.
- No cachear decisiones de relación/asignación más allá de la operación.
- Logs técnicos y respuestas aplican minimización; audit log no es un almacén
  alternativo de PII.

## 13. Accesibilidad

Las superficies futuras de login, sesión y gestión de relaciones deben incluir
labels, teclado, foco visible/restaurado, errores claros, estado textual además
de color, `aria-live` para resultados y reflow/zoom sin pérdida. No revelar en
mensajes accesibles si una cuenta, persona o paciente existe fuera del ámbito.

## 14. Allowlist prevista para el packet de implementación

Esta lista es propuesta y **no autoriza edición mientras §17 esté abierto**:

- `prisma/schema.prisma`;
- una migración aditiva `identity_relationships_core_01` y rollback documentado;
- nuevos módulos `apps/api/src/human-auth/**`,
  `apps/api/src/identity-access/**` y
  `apps/api/src/people-relationships/**`;
- extensiones mínimas de `apps/api/src/audit/**`, `apps/api/src/app.module.ts`,
  configuración tipada y OpenAPI;
- contratos compartidos estrictamente necesarios;
- tests nuevos de identidad, relación, API, DB/RLS y fixtures ficticias.

No se autorizan cambios en `apps/web`, `prototype-claude/**`, Visits, Hospital,
Municipality, Patient enrollment, Agenda, finanzas, clínica o infraestructura.

## 15. Pruebas obligatorias

### 15.1 Identidad/OIDC

- binding resuelve exactamente `HumanAccount -> Person` del mismo tenant;
- no auto-link por email/documento y no FK cross-tenant;
- issuer/subject duplicado concurrente falla;
- firma, issuer, audience, `exp`, `nbf`, algoritmo, state, nonce y PKCE
  inválidos/replay fallan cerrados;
- fallo JWKS y proveedor no disponible producen error seguro;
- cookie ausente, manipulada, expirada/revocada, cuenta disabled o binding
  unlinked producen `401` uniforme;
- logout/rotación invalidan el token anterior;
- cookies humana, institucional y enrollment son distintas e
  intercambiarlas nunca autentica;
- coexistencia de cookies no crea precedencia ambigua ni confused deputy.

### 15.2 Resolución de participaciones

- Paciente se deriva solo desde la `Person` autenticada;
- Profesional se deriva desde `Person -> ProfessionalProfile ACTIVE` y exige
  afiliación ACTIVE/vigente;
- otro profesional, perfil inactivo o afiliación vencida deniega;
- `HOSPITAL_SCHEDULER` nunca satisface un guard humano;
- una persona con varias participaciones no acumula permisos entre contextos.

### 15.3 Relación Cuidador

- M:N: varios cuidadores por paciente y varios pacientes por cuidador;
- solo `ACTIVE` + vigente + finalidad + `VISITS_VIEW` permite lectura;
- pending, suspended, revoked, expired, futuro, sin scope, otra finalidad, otro
  paciente y otro tenant deniegan uniformemente;
- `visits.view` no implica contribute, execute, clínica o exportación;
- self-relationship y episodios activos solapados se rechazan;
- versión obsoleta/concurrencia produce un ganador y `409` para el otro;
- revocación tiene efecto inmediato y conserva historia.

### 15.4 DB/RLS/auditoría

- dos tenants: SELECT/INSERT/UPDATE y FKs cruzadas fallan;
- `USING` y `WITH CHECK`, contexto ausente/equivocado y pool reuse;
- pruebas ejecutadas con `merdn_runtime` real, sin owner/BYPASSRLS/DELETE;
- cambio + auditoría atómicos; fallo de auditoría revierte;
- AuditEvent rechaza UPDATE/DELETE/TRUNCATE;
- desactivación conserva eventos y actor opaco;
- scans de DTO, OpenAPI, respuesta y logs sin PII/tokens/hashes/claims.

### 15.5 API y seguridad

- fields extra y tenant/actor/role/person/patient/professional como autoridad se
  rechazan;
- 401/403/404/409/503 uniformes sin enumeración;
- CSRF/origin, rate limit, cookies y headers no-cache;
- pruebas negativas para cada endpoint y transición.

## 16. Evidencia que Claude deberá devolver

Cuando exista un packet aprobado, Claude deberá devolver:

1. archivos cambiados y justificación;
2. migración/rollback revisados y diff de grants/RLS;
3. diagrama o tabla del principal y resoluciones server-side;
4. contratos OpenAPI y rechazo de campos de autoridad;
5. matrices de permisos, relación y clases de sesión;
6. resultados de unit, typecheck, lint, API, DB/RLS y seguridad;
7. evidencia de ejecución con rol runtime y dos tenants;
8. scans de logs/respuestas sin PII o secretos;
9. limitaciones, supuestos y cualquier desviación;
10. confirmación de que no se tocó Visits ni el prototipo.

## 17. Decisiones aprobadas por el Product Owner

Las decisiones quedan cerradas y materializadas normativamente en
`tasks/IDENTITY-RELATIONSHIPS-CORE-01-CLAUDE-PACKET.md`:

1. un único adapter OIDC estándar; Keycloak local desechable para desarrollo y
   pruebas controladas, y Entra External ID diferido como cambio de
   configuración, no de dominio;
2. linking previo, allowlisted e idempotente por `Person.id + issuer + subject`;
3. `CAREGIVER_RELATIONSHIP_MANAGER` institucional, separado de Scheduler, con
   procedencia opaca `CONTROLLED_MVP_OPERATOR_ASSERTION`;
4. tenant activo como frontera institucional temporal del slice;
5. catálogo cerrado de relación/finalidad/estado/scope y solo `VISITS_VIEW`;
6. sesión humana de 8 horas absolutas, 30 minutos de inactividad y máximo una
   sesión activa;
7. datos exclusivamente ficticios/controlados y ninguna afirmación de
   preparación para datos reales o producción.

No quedan decisiones de producto o arquitectura abiertas para esta
implementación. Entra, datos reales y producción permanecen fuera de alcance,
pero no bloquean el MVP local/controlado.

## 18. STOP CONDITIONS

Claude debe detenerse si:

1. se contradice una decisión aprobada del execution packet;
2. se intenta reutilizar identidad institucional o sesión de inscripción;
3. se intenta autoenlazar por email, documento o claims no autorizados;
4. actor, tenant, rol, persona, paciente o profesional provienen del cliente;
5. el cuidador obtiene un rol global, wildcard o permiso de ejecución;
6. se requiere representación legal, clínica, archivos o datos fuera de scope;
7. falta FK compuesta, filtro explícito, RLS o rol runtime seguro;
8. auditoría y cambio material no pueden ser atómicos;
9. se requiere editar Visits, el prototipo o archivos fuera de allowlist;
10. falla una prueba de identidad, relación, permisos, tenant, RLS o auditoría.

## 19. Resultado de desbloqueo

Una implementación futura solo desbloqueará:

- **Profesional/Visitador:** principal humano atribuible y resolución a
  `ProfessionalProfile`/afiliación/asignación;
- **Paciente:** principal humano durable y resolución a su `Patient`;
- **Cuidador:** principal humano y relación activa con `visits.view`;
- **Hospital:** convivencia segura entre principal institucional y humano, sin
  confundir autoría;
- **VISITS-CORE-01:** sus gates 1 y 2 de identidad/relación.

No desbloquea por sí sola contribución del cuidador, clínica, representación
legal, alta general de usuarios ni producción con datos reales.

---

IDENTITY-RELATIONSHIPS-CORE-01 READY FOR CLAUDE: YES

UNBLOCKS: Profesional/Visitador, Paciente, Cuidador, convivencia segura con Hospital y los gates 1–2 de VISITS-CORE-01, después de implementar y verificar este núcleo

CLAUDE PACKET: tasks/IDENTITY-RELATIONSHIPS-CORE-01-CLAUDE-PACKET.md
