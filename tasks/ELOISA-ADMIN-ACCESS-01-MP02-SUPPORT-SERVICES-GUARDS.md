# ELOISA-ADMIN-ACCESS-01 · MP02 — Support Services + Guards

## 1. Objetivo

Implementar la lógica runtime mínima, sin endpoints ni UI, para que una
`HumanSession` autenticada pueda abrir, validar y cerrar un contexto separado de
soporte sobre exactamente un tenant autorizado por un `SupportGrant` vigente.

MP02 no concede todavía acceso a Pacientes, Profesionales, Agenda, Visitas ni
auditoría operacional. Produce un `SupportPrincipal` server-side que MP04 podrá
usar en guards read-only específicos.

## 2. Flujo aprobado

```text
HumanPrincipal autenticado
→ homeTenantId y humanAccountId derivados por servidor
→ PlatformSupportCapability ACTIVE de esa cuenta/home tenant
→ SupportGrant solicitado por identificador opaco, ACTIVE y vigente
→ targetTenantId derivado exclusivamente de la fila validada
→ rechazo si targetTenantId == homeTenantId
→ motivo obligatorio validado
→ cierre atómico de contexto previo expirado, si existe
→ SupportContextSession nueva con token propio
→ auditoría append-only de entrada
→ SupportPrincipal separado; HumanSession permanece intacta
```

El cliente nunca envía `targetTenantId`, `homeTenantId`, `humanAccountId`, rol,
capability, scope, TTL ni estado. El único selector aceptado para abrir soporte
es `supportGrantId`; no autoriza por sí mismo y siempre se resuelve bajo RLS del
home tenant.

## 3. Requisitos funcionales

### 3.1 Apertura

1. Recibir `HumanPrincipal`, `supportGrantId`, `reason`, `ticketReference?`,
   hora, endpoint y correlationId desde capas server-side tipadas.
2. Validar forma UUID del grant antes de consultar.
3. Validar motivo con la misma forma DB: trim, 8..500. Persistir el valor
   normalizado. Ticket opcional trim, 1..120; vacío se convierte en `null`.
4. Dentro de una única transacción iniciada con
   `PrismaService.withTenant(principal.tenantId)`:
   - confirmar `HumanAccount ACTIVE` y que coincide exactamente con el
     `HumanPrincipal`;
   - confirmar `PlatformSupportCapability ACTIVE` para
     `(homeTenantId, humanAccountId)`;
   - resolver el grant por id + home tenant + capability;
   - exigir `status=ACTIVE`, scope `HOSPITAL_OPERATIONAL_READ`,
     `validFrom <= now` si existe y `now < validUntil` si existe;
   - exigir `targetTenantId != homeTenantId`;
   - detectar el único contexto previo no revocado de la cuenta. Si está
     expirado por TTL absoluto o por idle >15 minutos, marcar `revokedAt=now` y
     registrar `SUPPORT_CONTEXT_EXPIRED` antes de crear el nuevo;
   - si el contexto previo sigue vigente, responder conflicto estable y no
     crear otro;
   - crear token criptográficamente aleatorio distinto de HumanSession,
     persistir solo SHA-256 y devolver el token en claro una sola vez;
   - fijar `expiresAt = createdAt + 60 minutos`, sin renovación;
   - crear el evento `SUPPORT_CONTEXT_ENTRY_GRANTED`.
5. La auditoría y los cambios de contexto deben ser atómicos. Para eventos cuyo
   `AuditEvent.tenantId` sea el tenant objetivo, cambiar el GUC dentro de la
   misma transacción mediante `PrismaService.enterRuntimeContext(tx,
   validatedTargetTenantId)`, ya existente. Bajo un tenant objetivo solo se
   permite insertar su evento. Si la operación aún necesita una escritura home
   —por ejemplo, expirar un contexto anterior cuyo target difiere del nuevo—,
   debe restablecer explícitamente y comprobar el contexto home con el mismo
   primitivo antes de tocar esas filas. Cada transición home→target→home se
   deriva de grants ya validados; nunca de input del cliente. Un fallo de
   cualquier auditoría revierte la transacción completa.
6. Si no existe grant confiable, el intento denegado se audita en el home tenant
   sin registrar el target no validado. Si el grant se resolvió de forma segura
   pero está revocado/vencido o es same-tenant, puede auditarse el tenant objetivo
   derivado. Toda respuesta permanece uniforme y no enumera tenants/grants.

### 3.2 Validación y guard

1. Definir cookie de contexto distinta de cookies humana, institucional y de
   inscripción. MP02 solo lee/valida el token; los builders `Set-Cookie` pueden
   quedar preparados para MP03 sin controller.
2. `SupportContextGuard` requiere que `HumanSessionGuard` ya haya fijado un
   `HumanPrincipal`; sin principal o token válido responde fail-closed.
3. Validar token por hash dentro del home tenant del principal y exigir:
   - misma cuenta y misma `HumanSession` activa;
   - contexto no revocado;
   - `now < expiresAt`;
   - actividad previa (o creación) dentro de 15 minutos;
   - cuenta y capability ACTIVE;
   - grant ACTIVE, vigente, scope cerrado y target distinto del home tenant.
4. Si TTL/idle/grant/capability invalidan el contexto, revocarlo cuando proceda,
   registrar `EXPIRED` o `REVOKED` en forma atómica y denegar.
5. En éxito, actualizar únicamente `lastUsedAt` sin extender `expiresAt` y
   adjuntar al request mediante `Symbol` un `SupportPrincipal` inmutable con:
   `supportContextSessionId`, `supportGrantId`, `humanAccountId`,
   `humanSessionId`, `homeTenantId`, `targetTenantId`, scope y expiración.
6. No copiar ni sustituir `HumanPrincipal`. No convertir soporte en un contexto
   Patient/Professional/Caregiver ni en rol institucional.

### 3.3 Salida explícita

1. Con HumanPrincipal + token de soporte, localizar únicamente el contexto de
   esa cuenta/sesión/home tenant.
2. Fijar `revokedAt=now`, registrar `SUPPORT_CONTEXT_EXITED` atómicamente y
   producir cabecera para borrar solo la cookie de soporte.
3. No revocar ni reemplazar la `HumanSession` y no tocar cookies institucionales.
4. Operación idempotente y fail-closed: un token inexistente/ajeno no revela
   estado ni revoca filas de otra cuenta.

## 4. Seguridad, tenant y auditoría

- Reutilizar OIDC/HumanSession; cero passwords nuevos, master password o claims
  de rol.
- RLS sigue `ENABLE + FORCE`; siempre `merdn_runtime`, sin `BYPASSRLS`.
- Toda consulta home pasa por `withTenant(homeTenantId)` derivado del principal.
- `targetTenantId` solo procede del grant validado. No existe argumento público
  que lo acepte del cliente.
- El cambio de GUC dentro de transacción no desactiva RLS y debe comprobar
  `current_user=merdn_runtime` y tenant efectivo mediante el primitivo existente.
- Auditoría: actor `HUMAN_ACCOUNT`, actorUserId real, actorRole `NULL`, grant,
  contexto, motivo/ticket minimizados, tenant objetivo confiable, endpoint,
  correlationId, outcome y timestamp. Nunca token/hash/cookie/OIDC subject,
  cuerpos, nombres, documentos o datos clínicos.
- Entrada, salida, expiración y revocación fallan cerradas si su auditoría no se
  puede persistir.
- No auditar lecturas Hospital en MP02; corresponden a MP04.
- Conservar como residual no bloqueante el endurecimiento posterior de
  `audit_event_resource_required`.

## 5. Contratos de error

Usar errores estables internos, sin filtrar existencia:

- autenticación humana ausente/inválida → `401` cuando exista controller;
- contexto/grant/capability ausente, ajeno, revocado, vencido, scope incorrecto
  o same-tenant → `403` uniforme;
- contexto vigente ya abierto → `409` estable;
- runtime/RLS/auditoría no disponibles → `503` fail-closed.

MP02 no crea todavía el mapeo HTTP, pero servicio y guard deben distinguir solo
lo necesario para que MP03 lo haga sin inspeccionar mensajes de excepción.

## 6. Allowlist exacta

- `apps/api/src/support-access/support-access.contract.ts`
- `apps/api/src/support-access/support-access.service.ts`
- `apps/api/src/support-access/support-context.guard.ts`
- `apps/api/src/support-access/support-access.module.ts`
- `apps/api/test/support-access.service.db.test.ts`

No modificar esquema ni crear migración en MP02. Cualquier otro archivo bloquea
el packet.

## 7. Fuera de alcance

- controllers, DTO, OpenAPI o rutas;
- UI o cambios Hospital;
- importación en `AppModule` antes de existir endpoint consumidor;
- provisioning de `eloisa-admin-local` o creación/revocación de grants;
- selector/directorio de instituciones;
- cualquier lectura de Pacientes, Profesionales, Agenda, Visits o AuditEvent;
- START/COMPLETE/NOT_COMPLETED y toda mutación de negocio;
- clínica, finanzas, documentos, descargas, exportaciones o Reportes;
- cambios a `HumanPrincipal`, human-auth, OIDC, Keycloak, roles institucionales,
  PrismaService, schema o migraciones;
- impersonation, bypass, identidad institucional o rol Professional/Caregiver;
- dependencias, refactor, suites completas, commit o push.

## 8. Pruebas focales obligatorias

Una suite PostgreSQL real, `fileParallelism=false`, fixtures propios y limpieza
por ids/prefijo exclusivamente:

1. cuenta nominativa + HumanSession válida + capability ACTIVE + grant vigente
   abre contexto con token propio y audit entry;
2. token claro no se persiste y difiere del token humano;
3. motivo/ticket se validan y no aparecen en logs/errores;
4. cuenta ajena, capability ausente/disabled y grant de otra capability/tenant
   deniegan;
5. grant revoked, futuro, vencido o scope no permitido deniega;
6. grant same home/target se rechaza en servicio;
7. el input público no contiene `targetTenantId`, home tenant, account, scope,
   TTL ni actor;
8. contexto previo expirado no revocado se marca expirado y audita antes de
   abrir el nuevo, en la misma transacción;
9. contexto previo vigente produce conflicto y no segundo contexto;
10. TTL exacto 60m, idle exacto 15m, boundary tests y no extensión absoluta;
11. validación revoca/audita TTL, idle, capability o grant invalidados;
12. salida revoca solo contexto, audita y conserva HumanSession válida;
13. token ajeno/cross-tenant falla uniforme y no modifica filas;
14. `current_user=merdn_runtime`, cambio home→target conserva RLS y no permite
    leer home después del cambio;
15. fallo inducido de auditoría revierte creación/revocación/expiración;
16. guard adjunta SupportPrincipal solo en éxito y no altera HumanPrincipal;
17. cookies humana/institucional/soporte tienen nombres distintos;
18. regresión focal MP01 permanece PASS.

Comandos:

```text
npx vitest run --config vitest.config.mts test/support-access.service.db.test.ts --fileParallelism=false
npx vitest run --config vitest.config.mts test/eloisa-admin-support-foundation.db.test.ts --fileParallelism=false
npx tsc --noEmit -p tsconfig.json
npx eslint src/support-access test/support-access.service.db.test.ts
git diff --check
git status --short
```

Ejecutar desde `apps/api`. No suites completas.

## 9. Evidencia requerida

- exactamente cinco archivos cambiados;
- PostgreSQL real, rol runtime y conteos focales;
- casos de ownership, vigencia, same-tenant, TTL/idle y cross-tenant;
- rollback atómico ante fallo de audit;
- prueba de HumanSession intacta al salir;
- typecheck/eslint scope PASS;
- cero endpoints/UI/backend Hospital;
- cero secretos, impersonation, BYPASSRLS o roles nuevos;
- residuales, sin corregir fuera de allowlist.

## 10. Stop conditions

Detenerse si:

1. se requiere aceptar `targetTenantId` como autoridad del cliente;
2. se requiere tocar RLS, PrismaService, schema o migraciones;
3. no puede mantenerse atomicidad entre contexto y auditoría;
4. cambiar el GUC permitiría una lectura no autorizada o no confirma
   `merdn_runtime`;
5. el guard necesita impersonar/alterar HumanPrincipal;
6. aparece un archivo fuera de allowlist;
7. PostgreSQL runtime no está disponible;
8. el packet excede 15 minutos: reportar el punto exacto, no ampliar.

READY FOR CLAUDE: YES
ESTIMATED CLAUDE TIME: 15 minutes
