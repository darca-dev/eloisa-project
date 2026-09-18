# ELOISA-ADMIN-ACCESS-01 · MP01 — Data/Auth Foundation

## 1. Resultado esperado

Añadir únicamente la fundación persistente y tenant-aware para una cuenta humana
nominativa de Platform Admin/Support autenticada por el OIDC y `HumanSession` ya
existentes. MP01 modela la capacidad administrativa, la autorización explícita
por institución (`SupportGrant`), el contexto temporal de soporte y los
primitivos de auditoría. No crea servicios, guards, endpoints, cookies, UI ni
datos locales.

El resultado no concede acceso por sí mismo. Toda lectura Hospital continuará
denegada hasta MP02/MP04.

## 2. Decisiones cerradas

1. La administradora es una `HumanAccount` nominativa preaprovisionada mediante
   `ExternalAuthIdentity` y autenticada por OIDC Authorization Code + PKCE.
2. La capacidad Platform Admin/Support es persistida y separada de
   `HumanAccount.status`, claims OIDC, `HumanPrincipal`, contextos
   Patient/Professional/Caregiver e identidades institucionales.
3. La capacidad y sus grants pertenecen al tenant **home** de la cuenta humana.
   El grant referencia un único tenant objetivo. Esto permite que MP02 valide
   capacidad/grant bajo `withTenant(homeTenantId)` y lea el negocio bajo un
   segundo `withTenant(targetTenantId)`, sin `BYPASSRLS`.
4. El navegador nunca convierte un `targetTenantId` en autoridad. MP01 solo lo
   persiste; la resolución y validación server-side pertenecen a MP02.
5. V1 tiene un único alcance cerrado: lectura operacional Hospital de
   Pacientes, Profesionales, Agenda, Visitas y auditoría operacional necesaria.
   No incluye clínica editable, mutaciones de negocio o Visits, finanzas,
   exportaciones masivas, documentos sensibles, firma ni impersonación.
6. El contexto de soporte es distinto de `HumanSession`, dura como máximo 60
   minutos, expira por 15 minutos de inactividad, admite un tenant activo a la
   vez y conserva salida/revocación explícita. MP01 persiste timestamps y token
   hasheado; MP02 implementará su cookie y validación.
7. Motivo obligatorio, texto acotado y persistido. Ticket/reference opcional y
   acotado. Ninguno puede contener secretos; servicios posteriores deberán
   minimizar datos personales y clínicos.
8. Auditoría atribuida siempre a `HUMAN_ACCOUNT`; `actorRole` permanece `NULL`.
   Nunca se atribuye a una institución o Professional.
9. Retención de producto: mínimo cinco años, configurable y sujeta a política
   legal aplicable. MP01 no implementa borrado ni job de purga.

## 3. Modelo mínimo requerido

Claude puede adaptar nombres locales sin cambiar estas semánticas.

### 3.1 `PlatformSupportCapability`

- `id UUID`;
- `homeTenantId UUID`;
- `humanAccountId UUID`;
- estado cerrado `ACTIVE | DISABLED`;
- `createdAt`, `updatedAt`, `disabledAt?`;
- FK compuesta a `HumanAccount(id, tenantId)` usando `homeTenantId`;
- una sola capacidad por cuenta/home tenant;
- no contiene password, subject OIDC, rol institucional ni contexto humano.

### 3.2 `SupportGrant`

- `id UUID`;
- `homeTenantId UUID` (dueño RLS);
- `platformSupportCapabilityId UUID`;
- `targetTenantId UUID`;
- alcance cerrado `HOSPITAL_OPERATIONAL_READ`;
- estado `ACTIVE | REVOKED`;
- `validFrom?`, `validUntil?`, `createdAt`, `updatedAt`, `revokedAt?`;
- referencias restrictivas a capacidad y tenant objetivo;
- constraint: `validUntil > validFrom` cuando ambos existan;
- coherencia estado/timestamps: `ACTIVE` sin `revokedAt`; `REVOKED` con
  `revokedAt`;
- unicidad que impida más de un grant activo equivalente para la misma
  capacidad, tenant objetivo y alcance (índice parcial en SQL si Prisma no lo
  expresa).

La creación/revocación por Platform Owner/Admin se implementará después; MP01
no añade una mutación sin autorización.

### 3.3 `SupportContextSession`

- `id UUID`;
- `homeTenantId UUID` (dueño RLS);
- `humanAccountId UUID` y `humanSessionId UUID`;
- `supportGrantId UUID`;
- `targetTenantId UUID` desnormalizado y protegido por FK/constraint coherente
  con el grant;
- `tokenHash` único; nunca token en claro;
- `reason` obligatorio, trim lógico y longitud DB `8..500`;
- `ticketReference?` de longitud máxima 120;
- `createdAt`, `expiresAt`, `lastUsedAt?`, `revokedAt?`;
- constraint: `expiresAt > createdAt` y `expiresAt <= createdAt + 60 minutos`;
- constraint: `lastUsedAt` dentro de `[createdAt, expiresAt]` cuando exista;
- constraint: `revokedAt >= createdAt` cuando exista;
- FK compuesta a la cuenta/sesión humana del home tenant y al grant;
- índice para validar contexto por home tenant/token y para expiración;
- índice parcial que impida más de un contexto no revocado por cuenta. La
  vigencia temporal efectiva y idle de 15 minutos se validarán en MP02 dentro
  de transacción; un índice no debe fingir que evalúa el paso del tiempo.

No reutilizar `HumanSession.tokenHash` ni la cookie humana.

### 3.4 Auditoría

Extender aditivamente `AuditEventType` con primitivas cerradas para:

- capacidad creada/deshabilitada;
- grant creado/revocado;
- entrada a soporte concedida/denegada;
- salida, expiración y revocación del contexto;
- lectura concedida/denegada de Patient, Professional, Agenda, HomeVisit y
  auditoría operacional.

Extender `AuditEvent` solo con referencias/metadata nullable necesarias para
soporte:

- `actorHomeTenantId?`;
- `supportGrantId?`;
- `supportContextSessionId?`;
- `supportReason?`;
- `supportTicketReference?`.

Para eventos de soporte, `tenantId` es el tenant objetivo auditado,
`actorType = HUMAN_ACCOUNT`, `actorUserId` es la cuenta humana opaca y
`actorRole = NULL`. No añadir nombres, documentos, OIDC issuer/subject, tokens,
cookies, cuerpos, filtros ni información clínica. Las relaciones deben
preservar historia con `RESTRICT`/`NO ACTION`; nunca cascade destructivo.

MP01 prueba la forma y append-only existente. La escritura atómica de eventos
con cada operación pertenece a MP02/MP04.

## 4. RLS, grants SQL e integridad

1. Nuevas tablas con `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`.
2. Políticas runtime por `homeTenantId = current_setting('merdn.tenant_id',
   true)::uuid`; sin GUC o con tenant ajeno: cero autorización.
3. `merdn_runtime` recibe únicamente `SELECT`, `INSERT`, `UPDATE` donde lo
   requerirán los servicios; no `DELETE`, `TRUNCATE`, ownership, policy change
   ni `BYPASSRLS`.
4. Prohibir `DELETE` runtime. Grant y contexto se revocan, no se borran.
5. Triggers append-only/integridad donde sean necesarios; ninguna cascada puede
   destruir grants, contextos o auditoría.
6. No alterar ni debilitar las políticas, grants o FORCE RLS existentes.
7. La migración es aditiva y reversible mediante rollback explícito. El
   rollback elimina solamente objetos MP01 en orden seguro y revierte las
   extensiones MP01 compatibles del enum/modelo de auditoría según el patrón
   aprobado del repo; no borra datos ajenos.

## 5. Allowlist exacta de implementación

- `prisma/schema.prisma`
- `prisma/migrations/20260825120000_eloisa_admin_access_01_mp01/migration.sql`
- `prisma/migrations/ROLLBACK-eloisa_admin_access_01_mp01.sql`
- `apps/api/test/eloisa-admin-support-foundation.db.test.ts`

Cualquier otro archivo bloquea el packet.

## 6. Fuera de alcance

- cambios en `human-auth`, OIDC, Keycloak o `HumanPrincipal`;
- provisioning de `eloisa-admin-local`;
- service, guard, controller, module, DTO, OpenAPI, cookie o endpoint;
- selector de tenant, UI o integración Hospital;
- lectura real de negocio;
- mutaciones administrativas o clínicas;
- cambios a roles institucionales;
- MFA/step-up;
- fixtures globales, fallback demo o restauración de datos;
- Reportes, H-FID-C, finanzas, documentos o exportaciones;
- refactors, dependencias, suites completas, commit o push.

## 7. Prueba focal obligatoria

Archivo único PostgreSQL real, sin skip y con `fileParallelism=false`:

1. confirma PostgreSQL real y `current_user = merdn_runtime` dentro del contexto;
2. crea fixtures propios, identificables y limpia exclusivamente esos fixtures;
3. capacidad solo para `HumanAccount` del mismo home tenant;
4. no confunde capacidad con Professional/Caregiver/InstitutionalIdentity;
5. grant activo/revocado, alcance cerrado, fechas válidas y tenant objetivo;
6. contexto exige grant/cuenta/sesión coherentes, motivo, TTL <=60 minutos y
   timestamps válidos;
7. unicidad de grant activo y contexto no revocado;
8. RLS `ENABLE + FORCE`, aislamiento home tenant y ausencia de tenant fail-closed;
9. runtime no puede `DELETE` ni cruzar tenants;
10. auditoría soporta actor humano, tenant objetivo, grant/contexto y motivo sin
    exigir `actorRole` institucional;
11. auditoría sigue append-only y no admite procedencia incoherente;
12. FKs/`ON DELETE` preservan grants, contextos y evidencia.

Comandos focales, desde raíz:

```text
npx prisma validate
npx vitest run --config apps/api/vitest.config.mts --root apps/api test/eloisa-admin-support-foundation.db.test.ts --fileParallelism=false
git diff --check
git status --short
```

Si la configuración Vitest interpreta rutas respecto de `apps/api`, usar la
invocación equivalente desde ese cwd y reportar la diferencia; no abrir suite.

## 8. Evidencia de entrega

Claude debe devolver:

- archivos cambiados (exactamente cuatro);
- versión de PostgreSQL y `current_user`;
- migración aplicada localmente y rollback revisado;
- conteo focal PASS, cero skipped;
- `prisma validate` PASS;
- evidencia RLS/FORCE/cross-tenant/fail-closed;
- evidencia de que no existe `BYPASSRLS`, password, impersonación ni rol
  institucional nuevo;
- `git diff --check` y `git status --short`;
- riesgos residuales para MP02, sin corregirlos fuera de allowlist.

## 9. Stop conditions

Detenerse sin improvisar si:

1. el modelo exige debilitar RLS o usar `BYPASSRLS`;
2. se necesita cambiar `human-auth`, `HumanPrincipal` o roles institucionales;
3. una FK segura exige una decisión cross-tenant distinta de home/target;
4. no puede preservarse auditoría sin cascada destructiva;
5. PostgreSQL real o el rol `merdn_runtime` no están disponibles;
6. aparece cualquier archivo fuera de allowlist;
7. el packet no cabe en 15 minutos: reportar el punto exacto, no ampliar.

READY FOR CLAUDE: YES
ESTIMATED CLAUDE TIME: 15 minutes
