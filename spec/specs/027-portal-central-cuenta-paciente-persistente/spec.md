# Especificación 027 — Portal Central + Cuenta Persistente de Paciente

**Número**: 027
**Slug**: `portal-central-cuenta-paciente-persistente`
**Estado**: `Borrador` (pendiente de aprobación PO)
**Prioridad**: Alta
**Owner**: Product Owner
**Fecha**: 2026-09-18

---

## 1. Contexto y Objetivo de Producto

### 1.1 Problema que Resuelve
El portal central (`/`) ya integra en una sola página los 6 módulos de acceso (Alcaldía, Hospital, Personal de Terreno, Médicos, Paciente, Cuidador). Actualmente:

1. **Módulos institucionales** (4 de 6) usan datos de fixture/demo —no hay indicación visual de esto, lo que confunde al usuario sobre qué es real y qué es demostración.
2. **Paciente** se inscribe vía formulario público (`/inscripcion`), pero la sesión creada (`enrollment_session` + cookie `merdn_enrollment_session`) es **temporal** (TTL 12h–7d). Al expirar o cerrar navegador, el paciente pierde acceso a su historial (bitácora, citas, visitas) y debe re-inscribirse, creando duplicados.

### 1.2 Objetivos
| Objetivo | Descripción |
|----------|-------------|
| **OBJ-01** (Visual) | Etiquetar claramente los 4 módulos institucionales como "Datos de demostración" en el portal central, sin tocar lógica, rutas ni componentes internos. |
| **OBJ-02** (Funcional) | Permitir que un paciente, tras inscribirse, pueda **volver a entrar días después** con email/teléfono + contraseña y recuperar su historial completo sin re-inscribirse ni duplicar registros. |

### 1.3 Valor de Usuario
- **Paciente domiciliario**: Acceso persistente a su bitácora, citas y visitas desde casa, sin barreras técnicas.
- **Institución (Alcaldía/Hospital)**: Trazabilidad real de continuidad de cuidado; no hay "pacientes fantasmas" por re-inscripciones.
- **Equipo de producto**: Base sólida para futuras capacidades (cuidador persistente, profesional autenticado, notificaciones push, etc.).

---

## 2. Alcance (In-Scope / Out-of-Scope)

### 2.1 In-Scope
| ID | Ítem | Detalle |
|----|------|---------|
| IS-01 | Badge "Datos de demostración" | Texto visible en 4 tarjetas de `HubAccessPortal`: Alcaldía, Hospital, Personal de Terreno, Médicos Clínicos. Solo CSS/JSX, sin lógica. |
| IS-02 | Campo contraseña en inscripción | Paso 2 (contacto) del formulario Paciente: email/tel + contraseña (mín 8 chars, 1 letra + 1 número). Campo `nullable` en BD para compatibilidad futura. |
| IS-03 | Provisión `HumanAccount` + `ExternalAuthIdentity` | Al crear paciente (`POST /patients/enrollments` 201), en la **misma transacción**: crear `HumanAccount` (status=ACTIVE, personId) + `ExternalAuthIdentity` (issuer=keycloak-local, subject=uuid-v4 pregenerado, status=PENDING_LINK). |
| IS-04 | Keycloak local para credenciales | Keycloak ya corre en Docker. Crear realm/client `merdn-patient` + user via Admin API al proveer cuenta. `ExternalAuthIdentity.subject` = Keycloak `sub`. |
| IS-05 | Login paciente persistente | Paciente usa email/tel + password → Keycloak (OIDC) → `HumanSession` con contexto `PATIENT` → `GET /patient-self/*` funciona. |
| IS-06 | TTL sesión paciente ajustado | `human-auth` config: `sessionTtlSeconds = 30 días` (2.592.000s), `sessionIdleSeconds = 72h` (259.200s) —override por contexto `PATIENT` o config global paciente. |
| IS-07 | Migración `enrollment_session` → `HumanSession` | Al primer login humano exitoso del paciente: revocar `enrollment_session` (set `revokedAt=now`). `HumanAccount` queda como credencial permanente. |
| IS-08 | Recuperación de cuenta (olvidé contraseña) | Flujo "¿Olvidó su contraseña?" en login: email/SMS → Keycloak reset password → login normal. Día 1. |
| IS-09 | Auditoría obligatoria | Eventos: `HUMAN_ACCOUNT_CREATED`, `HUMAN_IDENTITY_LINKED` (al vincular Keycloak), `HUMAN_SESSION_CREATED`, `ENROLLMENT_SESSION_REVOKED` (nuevo). |

### 2.2 Out-of-Scope
| ID | Ítem | Justificación |
|----|------|---------------|
| OS-01 | Conectar módulos institucionales a datos reales | Fuera de MVP; requieren integraciones externas aprobadas por separado. |
| OS-02 | Cuenta persistente para Cuidador / Visitador | Diferente flujo de provisión (institucional, no autoinscripción). Task posterior. |
| OS-03 | Migración de inscripciones existentes | BD en cero hoy; no hay usuarios reales. Campo `passwordHash` nullable evita bloqueo futuro. |
| OS-04 | Vincular cuenta existente (reclamar inscripción previa) | Sin usuarios reales que lo necesiten. Task posterior cuando exista. |
| OS-05 | MFA / 2FA / passkeys | Demo/MVP; añadir cuando Keycloak lo soporte y PO lo pida. |
| OS-06 | Cambios en self-scope API (`patient-self/*`) | Ya funciona con sesión humana + contexto `PATIENT` — sin tocar. |
| OS-07 | Nueva migración BD | Esquema Prisma ya tiene todas las tablas necesarias. |

---

## 3. Usuarios, Roles, Instituciones, Tenants Afectados

| Actor | Rol | Tenant | Acceso |
|-------|-----|--------|--------|
| Paciente domiciliario | `PATIENT` (contexto humano) | `merdn-mvp` (único MVP) | Self-scope: summary, appointments, visits |
| Sistema (backend) | `SYSTEM` (provisión) | `merdn-mvp` | Crea `HumanAccount` + `ExternalAuthIdentity` en transacción inscripción |
| Keycloak | Proveedor OIDC | N/A (externo) | Autentica credenciales, emite tokens, gestiona reset password |

**Nota**: No hay selección de tenant por usuario. El tenant activo se resuelve **exclusivamente por configuración del servidor** (`MERDN_ACTIVE_TENANT_ID`).

---

## 4. Requisitos Funcionales Detallados

### RF-01: Badge "Datos de demostración" (Solo Visual)
- **Dónde**: `apps/web/src/features/hub/HubAccessPortal.tsx`, 4 tarjetas institucionales (líneas ~79–148, ~115–148, ~164–201, ~204–237).
- **Qué**: Añadir `<span className="demo-badge">Datos de demostración</span>` en el header de cada tarjeta (junto a `cardTag`).
- **Estilo**: CSS existente (`hub.module.css`) — nuevo selector `.demoBadge` con fondo neutro, texto pequeño, icono opcional ℹ️.
- **No tocar**: `Link href`, `onClick`, lógica de navegación, estado, props.

### RF-02: Campo Contraseña en Inscripción (Paso 2)
- **Dónde**: `apps/web/src/features/inscripcion/steps/PasosPaciente.tsx` (paso 2: contacto).
- **UI**: Input `type="password"` + toggle "Mostrar/ocultar" + indicador fortaleza visual (barra 3 colores: rojo/ámbar/verde).
- **Validación cliente**: Mín 8 chars, al menos 1 letra `[a-zA-Z]` y 1 dígito `\d`. Mensaje accesible (`aria-live`).
- **Contrato API**: Añadir `password: string` a `PatientEnrollmentRequest` (opcional/nullable para compatibilidad).
- **No enviar**: Contraseña en claro al backend — solo hash (ver RF-03).

### RF-03: Provisión `HumanAccount` + `ExternalAuthIdentity` (Backend)
**Ubicación**: `apps/api/src/patients/patient-enrollment.service.ts`, método `enroll()`, dentro de la transacción `prisma.withTenant()` (líneas 113–215).

**Secuencia atómica (tras crear `patient`, antes de `commit`)**:
```typescript
// 1. Generar subject UUID v4 para Keycloak
const keycloakSubject = randomUUID();

// 2. Crear HumanAccount vinculada al personId
const humanAccount = await tx.humanAccount.create({
  data: {
    tenantId,
    personId: person.id,
    status: 'ACTIVE',
  },
  select: { id: true },
});

// 3. Crear ExternalAuthIdentity PENDING_LINK (se confirmará en primer login Keycloak)
await tx.externalAuthIdentity.create({
  data: {
    tenantId,
    humanAccountId: humanAccount.id,
    issuer: KEYCLOAK_ISSUER_URL, // p.ej. http://keycloak:8080/realms/merdn-patient
    subject: keycloakSubject,
    status: 'PENDING_LINK', // nuevo estado o reusar ACTIVE + flag
  },
});

// 4. Llamar Keycloak Admin API para crear usuario (async, fuera de transacción BD pero antes de responder 201)
//    Si falla Keycloak → rollback transacción completa (throw)
await keycloakAdmin.createUser({
  realm: 'merdn-patient',
  username: input.email ?? input.phone, // email preferido
  email: input.email,
  emailVerified: false,
  firstName: input.givenNames,
  lastName: input.familyNames,
  credentials: [{ type: 'password', value: passwordPlaintext, temporary: false }],
  attributes: { merdn_person_id: person.id, merdn_patient_id: patient.id },
});

// 5. Actualizar ExternalAuthIdentity.status = 'ACTIVE' (confirmado)
await tx.externalAuthIdentity.update({
  where: { id: extAuthId.id },
  data: { status: 'ACTIVE' },
});
```

**Manejo de error Keycloak**: Si `createUser` falla → `throw new KeycloakProvisionError()` → transacción BD hace rollback → paciente no se crea → cliente ve error "No fue posible crear su cuenta, intente de nuevo".

**Configuración Keycloak** (variables entorno nuevo):
```env
KEYCLOAK_ADMIN_URL=http://keycloak:8080
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=***
KEYCLOAK_PATIENT_REALM=merdn-patient
KEYCLOAK_PATIENT_CLIENT_ID=merdn-patient-client
KEYCLOAK_PATIENT_CLIENT_SECRET=***
KEYCLOAK_ISSUER_URL=http://keycloak:8080/realms/merdn-patient
```

### RF-04: Keycloak Local - Configuración
- **Realm**: `merdn-patient` (separado de realm institucional si existe).
- **Client**: `merdn-patient-client` (confidential, Standard Flow + Direct Access Grants ON, Service Accounts ON para Admin API).
- **Redirect URIs**: `http://localhost:3000/*` (dev), `https://dominio.produccion/*` (prod) — allowlist cerrada.
- **Scopes**: `openid`, `profile`, `email`, `offline_access` (para refresh token si se usa).
- **Password Policy**: Mín 8 chars, 1 letra, 1 número (coincide con validación cliente).

### RF-05: Login Paciente Persistente (Frontend + Backend)
**Frontend** (`apps/web/src/features/auth/humanSessionClient.ts` + `PacienteExperience.tsx`):
- Ya soporta `CONTEXTOS_HUMANOS.paciente = 'PATIENT'` — sin cambios.
- "Ingresar como Paciente" navega a `urlDeLoginHumano()` → `/api/v1/human-auth/login?returnTo=/` → Keycloak login → callback → `HumanSession` cookie → redirect a `/` → `ExperienciaMerdn` detecta `activa-con-contexto` → monta `PacienteExperience`.

**Backend** (`apps/api/src/human-auth/human-auth.service.ts`):
- `completeLogin()` ya resuelve `ExternalAuthIdentity` por `(tenantId, issuer, subject, status=ACTIVE)` → `HumanAccount` → `Person` → `Patient` (si existe).
- **Requisito**: El `subject` en Keycloak debe coincidir con el pregenerado en inscripción (`ExternalAuthIdentity.subject`).
- **Contexto `PATIENT`**: `HumanSession` no guarda contexto; `consultarSesionHumana()` filtra por `HumanAccount` → `Person` → `Patient` existe → devuelve `contexts: ['PATIENT']` en `SesionHumanaDto`.

### RF-06: TTL Sesión Paciente Ajustado
**Opción A (Recomendada)**: Config global en `human-auth.config.ts` con override por contexto:
```typescript
// human-auth.config.ts
sessionTtlSeconds: 30 * 24 * 60 * 60,      // 30 días absoluto
sessionIdleSeconds: 72 * 60 * 60,          // 72 horas inactividad
```
**Opción B**: Config por contexto (más complejo, requiere pasar contexto a `validate()`).
**Decisión**: Opción A — global, simple, cubre paciente y profesional (profesional puede tener TTL más corto si se configura luego por env var).

### RF-07: Migración `enrollment_session` → `HumanSession`
**Dónde**: `HumanAuthService.completeLogin()` (tras `establishSession()` exitoso).
```typescript
// Dentro de la transacción de establishSession(), tras crear HumanSession:
if (principal.personId) {
  // Verificar si hay enrollment_session activa para este paciente
  const enrollmentSession = await tx.enrollmentSession.findFirst({
    where: {
      patient: { personId: principal.personId },
      tenantId: principal.tenantId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });
  if (enrollmentSession) {
    await tx.enrollmentSession.update({
      where: { id: enrollmentSession.id },
      data: { revokedAt: now },
    });
    await this.audit.recordEnrollmentSessionRevokedWithin(tx, ...); // nuevo evento
  }
}
```
**Evento auditoría nuevo**: `ENROLLMENT_SESSION_REVOKED` (añadir a enum `AuditEventType` en `prisma/schema.prisma`).

### RF-08: Recuperación Contraseña (Día 1)
- **Frontend**: Link "¿Olvidó su contraseña?" en página login Keycloak (personalizar theme Keycloak) o página propia `/auth/recuperar` que llama Keycloak Admin API `executeActionsEmail(['UPDATE_PASSWORD'])`.
- **Backend**: Endpoint `POST /api/v1/human-auth/password/reset` → Keycloak Admin API → envía email con link temporal.
- **Simplicidad MVP**: Usar theme Keycloak por defecto (ya tiene "Forgot password") → cero código extra.

### RF-09: Auditoría
| Evento | Actor | Cuándo | Detalle |
|--------|-------|--------|---------|
| `HUMAN_ACCOUNT_CREATED` | `PUBLIC_SELF_ENROLLMENT` | En `enroll()` transacción | `resourceType: HumanAccount`, `resourceId: humanAccount.id` |
| `HUMAN_IDENTITY_LINKED` | `SYSTEM` | Tras Keycloak `createUser` OK | `resourceType: ExternalAuthIdentity`, `resourceId: extAuthId.id`, `endpoint: /patients/enrollments` |
| `HUMAN_SESSION_CREATED` | `HUMAN_ACCOUNT` | En `establishSession()` | Ya implementado |
| `ENROLLMENT_SESSION_REVOKED` | `HUMAN_ACCOUNT` | En `completeLogin()` migración | **NUEVO** — añadir a enum + `AuditService` |

---

## 5. Datos: Entradas, Salidas, Propiedad, Sensibilidad, Retención, Provenencia

| Dato | Origen | Destino | Sensibilidad | Retención | Provenencia |
|------|--------|---------|--------------|-----------|-------------|
| `person` (documento, nombres, fecha nac, sexo, tel, email) | Formulario inscripción | `person` table | ALTA (PII) | Permanente | Declarado por paciente |
| `patient` (eps, enrolledAt, origin) | Derivado servidor | `patient` table | MEDIA | Permanente | Servidor |
| `HumanAccount` (personId, status) | Provisión automática | `human_account` table | MEDIA | Permanente | Sistema |
| `ExternalAuthIdentity` (issuer, subject) | Keycloak callback | `external_auth_identity` | MEDIA | Permanente | Proveedor identidad |
| `HumanSession` (tokenHash, expiresAt) | Login exitoso | `human_session` table | BAJA (opaco) | TTL + auditoría | Sistema |
| `enrollment_session` (tokenHash) | Inscripción exitosa | `enrollment_session` table | BAJA (opaco) | 12h-7d, luego revocar | Sistema |
| `password` (hash) | Keycloak (scrypt) | Keycloak DB | ALTA (secreto) | Permanente | Usuario + Keycloak |

**Regla de oro**: Contraseña en claro **NUNCA** toca backend MERDN ni logs. Solo Keycloak la hashea (scrypt) y guarda.

---

## 6. Autorización y Permisos

| Situación | Permiso | Implementación |
|-----------|---------|----------------|
| Paciente autenticado (`HumanSession` + contexto `PATIENT`) | `GET /api/v1/patient-self/*` | `human-session.guard.ts` + `patient-self.controller.ts` validan `contexts.includes('PATIENT')` |
| Sin sesión / sesión expirada | 401 | `human-auth` devuelve `sin-sesion` → frontend muestra "Volver a entrar" |
| Sesión válida pero sin contexto `PATIENT` | 403 | `human-auth` devuelve `activa-sin-contexto` → frontend "No tiene acceso a esta experiencia" |
| Paciente tenant A intenta ver datos tenant B | Bloqueado | RLS PostgreSQL + composite FKs (`patient_id_tenant_unique`, `human_session_id_tenant_unique`) |

---

## 7. Eventos de Auditoría (Detalle Técnico)

### 7.1 Nuevos Valores Enum `AuditEventType` (prisma/schema.prisma)
```prisma
enum AuditEventType {
  // ... existentes ...
  HUMAN_ACCOUNT_CREATED
  HUMAN_IDENTITY_LINKED
  ENROLLMENT_SESSION_REVOKED  // NUEVO
}
```

### 7.2 Nuevo Actor Type (si no existe)
```prisma
enum AuditActorType {
  // ... existentes ...
  PUBLIC_SELF_ENROLLMENT  // ya existe en CORE-01
}
```

### 7.3 `AuditService` — Nuevos Métodos
```typescript
// apps/api/src/audit/audit.service.ts
async recordHumanAccountCreatedWithin(tx, context, { humanAccountId, personId }, now)
async recordHumanIdentityLinkedWithin(tx, context, { extAuthIdentityId, humanAccountId, issuer, subject }, now)
async recordEnrollmentSessionRevokedWithin(tx, context, { enrollmentSessionId, patientId }, now)
```
Todos append-only, sin PII, solo IDs opacos + `correlationId` + `endpoint`.

---

## 8. Integraciones y Comportamiento ante Fallo

| Integración | Qué Hace | Fallo → Comportamiento |
|-------------|----------|------------------------|
| **Keycloak Admin API** | Crea usuario al inscribir paciente | `throw KeycloakProvisionError()` → rollback BD completo → 500/503 al cliente |
| **Keycloak OIDC (Auth Code + PKCE)** | Autentica login paciente | `completeLogin()` devuelve `null` → frontend "No disponible" / reintentar |
| **BD (PostgreSQL + RLS)** | Persistencia transaccional | `RuntimeContextUnavailableError` → 503 fail-closed |
| **Email/SMS (Keycloak)** | Reset password | Keycloak gestiona; MERDN no envía emails directo |

**Rate Limits** (ya implementados):
- `EnrollmentRateLimitGuard`: 10 req/15min por IP (inscripción)
- `HumanAuthRateLimitGuard`: Configurable (login OIDC)

---

## 9. Seguridad y Privacidad

- **Secretos**: `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_CLIENT_SECRET` → variables entorno / secret manager. **Nunca en código**.
- **Cookies**: `HttpOnly`, `Secure` (no dev), `SameSite=Lax`, `Path=/`, `Max-Age` según TTL.
- **Tokens**: Solo hashes en BD (`tokenHash` scrypt, `accessSecretHash` scrypt).
- **RLS**: `merdn_runtime` role + `SET LOCAL ROLE` + `set_config('merdn.tenant_id', ...)` en toda transacción.
- **Auditoría**: Sin PII — solo IDs opacos (`humanAccountId`, `patientId`, `sessionId`).
- **Contraseña**: Validación cliente (UX) + política Keycloak (server-side). MERDN no ve hash ni claro.

---

## 10. Restricciones Regulatorias / Institucionales

- **Sentencia T-319 de 2025**: Trazabilidad de consentimiento (`ConsentRecord` ya versionado) y acceso a datos de salud (self-scope solo lectura propia).
- **Ley 1581/2012 (Protección Datos Colombia)**: Minimización, finalidad, consentimiento, seguridad — cumplidos por diseño.
- **Resolución 1995/1999 (Historia Clínica)**: Self-scope NO es historia clínica — solo citas/visitas/resumen. No diagnóstico ni prescripción.
- **No inventar reglas clínicas**: Umbrales, alertas, semáforos — fuera de alcance.

---

## 11. Accesibilidad

| Requisito | Implementación |
|-----------|----------------|
| Navegación teclado | `tabIndex`, `focus-visible`, orden lógico en formularios |
| Lectores de pantalla | `aria-live="polite"` en errores/estados, `aria-describedby` en inputs, labels explícitos |
| Contraste | Tokens CSS `--b-*` cumplen WCAG AA (ver `tokens.css`) |
| Tamaño texto | `rem` base, responsive, zoom hasta 200% sin pérdida |
| Errores claros | Mensajes en lenguaje natural, no códigos HTTP, foco al primer error |
| Solo color | Nunca: iconos + texto + patrón para estados críticos |

---

## 12. Componentes / Archivos Afectados (Mapa de Cambios)

### 12.1 Frontend (`apps/web`)
| Archivo | Cambio | Tipo |
|---------|--------|------|
| `features/hub/HubAccessPortal.tsx` | Añadir badge "Datos de demostración" a 4 tarjetas | **Visual only** |
| `features/hub/hub.module.css` | Nuevo selector `.demoBadge` | CSS |
| `features/inscripcion/steps/PasosPaciente.tsx` | Paso 2: input password + toggle + fortaleza | **Funcional** |
| `features/inscripcion/inscripcionFlow.ts` | Añadir `password` a `DatosPaciente` (nullable) | Tipo |
| `features/inscripcion/patientEnrollmentClient.ts` | Enviar `password` en request (no hash) | Cliente API |
| `features/auth/humanSessionClient.ts` | **Sin cambios** — ya soporta `PATIENT` | — |
| `features/paciente/PacienteExperience.tsx` | **Sin cambios** — ya usa sesión humana | — |
| `features/experiencia/ExperienciaMerdn.tsx` | **Sin cambios** — conmutación ya correcta | — |

### 12.2 Backend (`apps/api`)
| Archivo | Cambio | Tipo |
|---------|--------|------|
| `src/patients/patient-enrollment.service.ts` | Provisión `HumanAccount` + `ExternalAuthIdentity` + Keycloak `createUser` en transacción | **Core** |
| `src/patients/patient-enrollment.controller.ts` | Aceptar `password` en DTO (validación: no vacío si presente) | API |
| `src/patients/patient-enrollment.dto.ts` | Añadir `password?: string` a `PatientEnrollmentRequestDto` | DTO |
| `src/patients/enrollment.validation.ts` | Validar `password` si presente (mín 8, 1 letra, 1 número) | Validación |
| `src/human-auth/human-auth.service.ts` | Migración `enrollment_session` en `completeLogin()` + auditoría | **Core** |
| `src/human-auth/human-auth.config.ts` | TTL ajustado: 30d absoluto, 72h idle | Config |
| `src/human-auth/oidc.adapter.ts` | **Sin cambios** — Keycloak estándar | — |
| `src/audit/audit.service.ts` | 3 nuevos métodos `record*Within` | Auditoría |
| `src/config/environment.ts` | Nuevas vars `KEYCLOAK_*` + validación | Config |
| `prisma/schema.prisma` | Añadir `ENROLLMENT_SESSION_REVOKED` a `AuditEventType` | Schema (migración) |

### 12.3 Keycloak (Infraestructura)
| Acción | Detalle |
|--------|---------|
| Realm `merdn-patient` | Crear vía Docker compose / admin console |
| Client `merdn-patient-client` | Confidential, Standard Flow + Direct Grants + Service Accounts |
| Admin API user | Realm-management client con `manage-users` role |
| Theme login | Personalizar (opcional) para "¿Olvidó contraseña?" y branding MERDN |

---

## 13. Criterios de Aceptación (Definition of Done)

| CA | Descripción | Verificación |
|----|-------------|--------------|
| **CA-01** | Badge "Datos de demostración" visible en 4 tarjetas institucionales en `/` | Inspección visual manual + test snapshot |
| **CA-02** | Inscripción paciente con contraseña crea `HumanAccount` + `ExternalAuthIdentity` + usuario Keycloak | `POST /enrollments` 201 → BD: 1 `person`, 1 `patient`, 1 `human_account`, 1 `external_auth_identity` (status=ACTIVE, issuer=keycloak), Keycloak user existe |
| **CA-03** | Login con credenciales creadas → sesión humana `PATIENT` → portal paciente carga datos | E2E: Inscribir → "Ingresar como Paciente" → Keycloak login → `/` muestra `PacienteExperience` con resumen/citas/visitas |
| **CA-04** | Refresco página (F5) / cerrar y abrir navegador → sesión persiste (dentro de 30d/72h) | Prueba manual: F5, cerrar Chrome, reabrir → sigue logueado |
| **CA-05** | `enrollment_session` revocada tras primer login humano | BD: `enrollment_session.revokedAt` no nulo, `audit_event` tiene `ENROLLMENT_SESSION_REVOKED` |
| **CA-06** | No duplicados: re-inscribir mismo documento → 409 Conflict | `POST /enrollments` mismo doc → 409 "Ese documento ya está inscrito" |
| **CA-07** | "¿Olvidó contraseña?" → email Keycloak → reset → login funciona | Flujo manual en Keycloak theme o endpoint propio |
| **CA-08** | Auditoría registra 4 eventos nuevos en flujo completo | `SELECT * FROM audit_event WHERE eventType IN ('HUMAN_ACCOUNT_CREATED','HUMAN_IDENTITY_LINKED','HUMAN_SESSION_CREATED','ENROLLMENT_SESSION_REVOKED')` → 4 filas |
| **CA-09** | Tests unitarios/integración/E2E pasan | `vitest run` (web + api) → 0 fallos |
| **CA-10** | Accesibilidad: login/inscripción navegable teclado + screen reader | Prueba manual NVDA/VoiceOver + axe-core |

---

## 14. Tests Requeridos

### 14.1 Unitarios (Backend)
| Archivo | Qué Probar |
|---------|------------|
| `patient-enrollment.service.test.ts` | `enroll()` crea `HumanAccount` + `ExternalAuthIdentity` en transacción; rollback si Keycloak falla |
| `enrollment.validation.test.ts` | `password` opcional; si presente: mín 8, 1 letra, 1 número |
| `human-auth.service.test.ts` | `completeLogin()` revoca `enrollment_session` si existe; auditoría `ENROLLMENT_SESSION_REVOKED` |
| `audit.service.test.ts` | Nuevos métodos registran eventos con campos correctos |

### 14.2 Unitarios (Frontend)
| Archivo | Qué Probar |
|---------|------------|
| `PasosPaciente.test.tsx` | Paso 2 renderiza password input, toggle, fortaleza; validación cliente |
| `patientEnrollmentClient.test.ts` | Request incluye `password`; tipos correctos |

### 14.3 Integración (API)
| Endpoint | Escenario |
|----------|-----------|
| `POST /patients/enrollments` | 201 + BD correcta; 400 password inválido; 409 doc duplicado; 500 Keycloak down |
| `GET /human-auth/session?context=PATIENT` | 200 `activa-con-contexto` tras login; 401 sin sesión; 403 sin contexto |
| `POST /human-auth/login` | Redirect a Keycloak; callback completa sesión |

### 14.4 E2E (Playwright / Vitest + Testing Library)
| Flujo | Pasos |
|-------|-------|
| Inscripción + Login persistente | 1. `/inscripcion` → elegir Paciente → completar 5 pasos con password → "Terminar inscripción" 2. "Ingresar como Paciente" → Keycloak login (email/pass) → redirect `/` 3. Verificar `PacienteExperience` carga resumen/citas/visitas 4. F5 → sigue logueado 5. Cerrar navegador, reabrir → sigue logueado (si <72h idle) |
| Recuperación contraseña | 1. Login Keycloak → "¿Olvidó contraseña?" → email → link → nueva pass → login OK |

### 14.5 Permisos / Tenant Isolation
| Test | Qué Verifica |
|------|--------------|
| `patient-self` sin sesión | 401 |
| `patient-self` con sesión PROFESSIONAL | 403 |
| Paciente tenant A no ve datos tenant B | RLS bloquea (test con 2 tenants en BD) |

### 14.6 Accesibilidad
- `axe-core` en páginas: `/inscripcion`, `/` (login), `/` (paciente portal)
- Navegación teclado completa (Tab, Enter, Escape)
- NVDA/VoiceOver anuncian estados de carga, error, éxito

---

## 15. Migración, Rollback, Compatibilidad, Operación

### 15.1 Migración BD
- **Prisma migration**: Añadir `ENROLLMENT_SESSION_REVOKED` a enum `AuditEventType`.
- **Comando**: `npx prisma migrate dev --name add_enrollment_session_revoked_audit`
- **Rollback migración**: `npx prisma migrate resolve --rolled-back <migration_name>` (solo si no hay datos en prod).

### 15.2 Rollback Código
- Revertir commits → `git revert` o `git reset --hard <tag-previo>`.
- Datos en BD **no se borran** (auditoría, cuentas, pacientes persisten).
- Keycloak users quedan huérfanos — limpieza manual si se requiere.

### 15.3 Compatibilidad Hacia Atrás
- Campo `password` **nullable** en `PatientEnrollmentRequest` → inscripciones sin password (legacy) siguen funcionando.
- `ExternalAuthIdentity.status = 'PENDING_LINK'` permite distinguir cuentas pre-provisionadas sin Keycloak confirmado.
- Pacientes sin `HumanAccount` (pre-feature) → verán "Ingresar como Paciente" pero login fallará hasta flujo "vincular cuenta" (task futura).

### 15.4 Operación / Observabilidad
- **Logs**: `HumanAuthService` loggea `HUMAN_ACCOUNT_CREATED`, `HUMAN_IDENTITY_LINKED` (sin PII).
- **Métricas**: Contar inscricciones con/sin cuenta humana, logins exitosos/fallidos, sesiones revocadas.
- **Alertas**: Keycloak Admin API down → alerta (inscripciones fallan 500).

---

## 16. Supuestos, Riesgos, Dependencias, Decisiones Abiertas

| # | Ítem | Tipo | Mitigación / Nota |
|---|------|------|-------------------|
| 1 | Keycloak debe estar corriendo y accesible | Dependencia | `docker-compose.yml` ya incluye Keycloak; healthcheck en CI |
| 2 | Realm `merdn-patient` + client configurados | Dependencia | Script de bootstrap Keycloak en `tools/` o migración DB |
| 3 | `password` nullable en API → compatibilidad legacy | Decisión | Validación servidor: si `password` presente, validar; si ausente, OK (legacy) |
| 4 | TTL global 30d/72h afecta también a profesional | Riesgo | Profesional usa mismo `human-auth`; si necesita TTL distinto → config por contexto (futuro) |
| 5 | Keycloak `createUser` sync en transacción BD | Riesgo latencia | Timeout 10s; si Keycloak lento → 503; no bloquear BD indefinido |
| 6 | Email verificado en Keycloak | Decisión | `emailVerified: false` inicial; paciente verifica en primer login (Keycloak flow) |
| 7 | Reset password usa email Keycloak (no MERDN) | Decisión | Simplicidad MVP; theme Keycloak por defecto |

---

## 17. Evidencia que Debe Retornar la Implementación

Para que Codex audite y PO acepte:

1. **Diff completo**: `git diff` (todos los archivos modificados).
2. **Tests pasando**: `vitest run` (web + api) — output con 0 fallos.
3. **Verificación BD** (scripts SQL o Prisma Studio):
   ```sql
   -- Paciente de prueba
   SELECT p.documentNumber, p.givenNames, p.familyNames,
          ha.id as human_account_id, ha.status,
          eai.id as ext_auth_id, eai.issuer, eai.subject, eai.status,
          es.id as enrollment_session_id, es.revokedAt
   FROM person p
   JOIN patient pa ON pa.personId = p.id
   LEFT JOIN human_account ha ON ha.personId = p.id
   LEFT JOIN external_auth_identity eai ON eai.humanAccountId = ha.id
   LEFT JOIN enrollment_session es ON es.patientId = pa.id
   WHERE p.documentNumber = '1234567890';
   ```
4. **Auditoría**:
   ```sql
   SELECT eventType, actorType, resourceType, resourceId, occurredAt
   FROM audit_event
   WHERE eventType IN ('HUMAN_ACCOUNT_CREATED','HUMAN_IDENTITY_LINKED','HUMAN_SESSION_CREATED','ENROLLMENT_SESSION_REVOKED')
   ORDER BY occurredAt DESC;
   ```
5. **E2E documentado**: Capturas/video del flujo completo (inscripción → login → portal → refresh → reabrir navegador).
6. **Accesibilidad**: Reporte `axe-core` (0 violations críticos/serios en páginas afectadas).

---

## 18. Aprobación y Próximos Pasos

| Paso | Acción | Responsable |
|------|--------|-------------|
| 1 | Revisar y aprobar esta spec | Product Owner |
| 2 | PO ejecuta `./scripts/confirm-user-consent.sh --spec 027-portal-central-cuenta-paciente-persistente "Aprobado"` | Product Owner |
| 3 | Codex genera `plan.md` y `tasks.md` en este directorio | Codex |
| 4 | PO aprueba `plan.md` | Product Owner |
| 5 | Implementación (Claude Code) | Claude Code |
| 6 | Auditoría Codex + aceptación PO | Codex + PO |
| 7 | Commit + merge a `develop` (autorizado por PO) | PO |

---

**Firma Product Owner**: _________________________ **Fecha**: _______________