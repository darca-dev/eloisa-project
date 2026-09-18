# Especificación 024 — Bootstrap de tenant con runtime enforce

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: `2026-08-28`
- Aprobado por / Approved by: `Product Owner`
- Evidencia de aprobación / Approval evidence: autorización explícita del Product Owner en sesión
  del 2026-08-28: «APRUEBO Y DOY CONSENTIMIENTO PARA SPEC 024 BOOTSTRAP TENANT
  ENFORCE», sobre el patrón durable, límites de seguridad, allowlists, pruebas y
  paquetes cerrados de esta especificación.
- Consentimiento de implementación: `REGISTRADO`

> La aprobación y el consentimiento autorizan únicamente los paquetes A, B y C
> definidos en `plan.md`, ejecutados secuencialmente dentro de sus allowlists.
> No autorizan commit o push de Claude, merge, `main`, despliegue, datos reales,
> ni ninguna excepción a los límites de seguridad de esta spec.

## Objetivo y valor

Corregir el arranque en frío de la API para que el único tenant activo configurado
pueda establecerse y verificarse bajo `MERDN_RUNTIME_ROLE=enforce`, sin relajar RLS,
sin una conexión privilegiada en la API y sin permitir que una petición elija o
enumere tenants. Hospital, Alcaldía y Paciente deben poder autenticarse después de
cualquier reinicio del proceso.

## Diagnóstico vinculante

`TenantContextService.resolveActiveTenant()` lee
`environment.activeTenantCode` y ejecuta
`prisma.tenant.findUnique({ where: { code } })` directamente sobre el cliente
construido con `RUNTIME_DATABASE_URL`. Esa lectura queda fuera de
`PrismaService.withTenant()` y, por tanto, fuera de una transacción que haya
ejecutado `SET LOCAL ROLE merdn_runtime` y
`set_config('merdn.tenant_id', ..., true)`. La política `tenant_self` exige
`tenant.id = merdn_current_tenant()`; sin GUC transaccional la función devuelve
`NULL` y PostgreSQL oculta incluso la fila configurada. El resultado aparente es
`tenant === null`, se lanza `ActiveTenantNotConfiguredError` y no se llena la
caché. La caché de un proceso anterior solo enmascaraba esta circularidad.

## Patrón aprobado propuesto

1. Añadir `MERDN_ACTIVE_TENANT_ID`, UUID suministrado exclusivamente por
   configuración confiable del despliegue, junto al código existente.
2. Cuando `MERDN_RUNTIME_ROLE=enforce`, ambas variables son obligatorias y se
   validan antes de atender peticiones. Ninguna procede de URL, cuerpo, cabecera,
   cookie, token OIDC ni otro dato de solicitud.
3. `resolveActiveTenant()` abre `PrismaService.withTenant(configuredTenantId)`.
   Dentro de esa única transacción se adopta/confirma `merdn_runtime`, se fija la
   GUC local y se consulta exactamente la pareja `id + code` en `tenant`.
4. Solo después de que RLS permita esa fila y ambos valores coincidan se publica y
   cachea el contexto. ID inexistente, código incorrecto, pareja discordante,
   imposibilidad de adoptar el rol o fallo de comprobación abortan y no cachean.
5. Tras el commit, toda operación normal conserva el patrón existente:
   `withTenant(tenantId)` bajo rol runtime y contexto transaccional explícito.

No se autoriza `SECURITY DEFINER`: una función que acepte códigos permitiría a su
invocador probar valores, y una función fija introduciría estado institucional en
la base que habría que administrar por una autoridad nueva. Tampoco se autoriza
usar `DATABASE_URL`, propietario o migrador desde la API: ampliaría secretos y
privilegios del proceso. No se autoriza cambiar políticas ni hacer `tenant`
globalmente legible.

## Autoridades y límites transaccionales

- Autoridad de selección: operador de despliegue que controla las dos variables;
  no el usuario autenticado ni anónimo.
- Autoridad efectiva de base de datos: `merdn_runtime`, `NOSUPERUSER`,
  `NOBYPASSRLS`, no propietario.
- Frontera de bootstrap: una transacción `withTenant(configuredTenantId)` con rol
  y GUC `SET LOCAL`; consulta solo de `tenant(id, code)`; commit/rollback elimina
  rol y GUC local.
- Frontera posterior: cada operación de negocio abre su propia transacción
  `withTenant`; la caché contiene solo la pareja previamente verificada.
- El error técnico no debe revelar UUID, código alternativo, existencia de otro
  tenant, credenciales ni topología.

## Datos, propiedad, sensibilidad, retención y procedencia

- Entrada: UUID y código institucional desde configuración de despliegue.
- Salida: `TenantContext { tenantId, tenantCode }` ya existente.
- Propiedad: configuración de la instancia y fila `tenant` de la institución.
- Sensibilidad: identificadores institucionales internos; no son PHI, pero no se
  exponen como catálogo.
- Retención: solo caché de proceso; no se crea dato nuevo ni auditoría persistida.
- Procedencia: UUID obtenido por canal administrativo controlado después de
  aplicar la migración/carga de referencia; nunca descubierto por el runtime.
- Linaje: configuración → `withTenant(UUID)` → verificación RLS de `id + code` →
  caché de proceso → contexto de transacciones de negocio.

## Seguridad, amenazas y restricciones

- Preservar `MERDN_RUNTIME_ROLE=enforce`, RLS y fail-closed.
- La API no debe abrir ni conservar un segundo cliente privilegiado.
- El runtime sin GUC sigue viendo cero tenants; con la GUC solo ve su propia fila.
- El bootstrap no acepta parámetros de petición y no ofrece endpoint ni método
  público para resolver códigos arbitrarios.
- Una pareja configurada discordante falla igual que inexistente, sin oráculo de
  existencia.
- No registrar el UUID ni secretos en errores de cliente. El log de arranque puede
  conservar el código activo ya registrado actualmente, pero no listar candidatos.
- No cambiar grants, `tenant_self`, `merdn_current_tenant()` ni `withTenant()`.
- No tocar valores demo municipales ni datos existentes.

## Auditoría

No se crea evento de dominio: es resolución técnica al inicio y no una acción de
usuario. Los inicios de sesión exitosos o denegados conservan sus eventos actuales.
Los fallos de bootstrap producen únicamente log técnico sanitizado y no deben
fabricar un actor, tenant o resultado de autenticación.

## Alcance funcional

- Arranque en frío y primera resolución sin caché.
- Hospital institucional, Alcaldía `MUNICIPAL_VIEWER` y autenticación humana OIDC
  de Paciente sobre el contexto ya verificado.
- Configuración local y de staging documentada.

## Fuera de alcance

- Multi-tenant seleccionable por petición, creación o administración de tenants.
- Cambios de roles, RLS, grants, esquema Prisma o datos de referencia.
- Cambios en flujos, credenciales, roles o valores demo de Alcaldía.
- Cambios visuales, de OIDC o de modelo de sesión.

## Allowlist exacta de implementación

- `apps/api/src/config/environment.ts`
- `apps/api/src/config/environment.test.ts`
- `apps/api/src/database/tenant-context.service.ts`
- `apps/api/src/database/tenant-context.service.test.ts` (nuevo)
- `apps/api/test/test-environment.ts`
- `apps/api/test/tenant-bootstrap.db.test.ts` (nuevo)
- `apps/api/test/cold-start-auth.api.test.ts` (nuevo)
- `apps/api/src/human-auth/human-auth.config.test.ts` (solo fixture tipado)
- `apps/api/src/institutional-auth/institutional-auth.unit.test.ts` (solo fixture tipado)
- `apps/api/test/runtime-fail-closed.db.test.ts` (solo fixture tipado o aserción RLS reutilizada)
- `.env.example`
- `.env.staging.example`
- `compose.yml`
- `compose.staging.yml`
- `scripts/staging/preflight.mjs`
- `tests/staging/staging-tools.test.mts`
- `docs/runbooks/STAGING_DEPLOYMENT.md`

Los paquetes de `plan.md` particionan esta allowlist sin escrituras solapadas.
Claude puede ejecutar A→B→C sin nueva aprobación del Product Owner y debe parar
entre paquetes únicamente ante fallo, STOP CONDITION o necesidad de salir de la
allowlist. La validación final consolidada corresponde a Codex.

## Denylist

- `prisma/schema.prisma`, `prisma/migrations/**`, políticas, grants y roles SQL.
- servicios de Hospital, Alcaldía, Paciente, identidad institucional y OIDC.
- `prototype-claude/**`, `tasks/**`, `reviews/**`, `.env` y datos de la base.
- valores locales existentes, incluido cualquier valor demo municipal.

## Criterios de aceptación EARS

1. CUANDO la API arranque sin caché con `MERDN_RUNTIME_ROLE=enforce` y la pareja
   configurada exista, EL SISTEMA DEBERÁ verificarla bajo RLS y autenticar los
   tres perfiles exigidos.
2. SI falta o no es UUID `MERDN_ACTIVE_TENANT_ID` en modo `enforce`, ENTONCES la
   validación de entorno DEBERÁ fallar antes de atender negocio.
3. SI ID o código no existen o no forman la misma pareja, ENTONCES la resolución
   DEBERÁ fallar cerrada, no llenar caché y no revelar cuál parte existía.
4. CUANDO el runtime consulte `tenant` sin contexto, DEBERÁ obtener cero filas;
   con el contexto configurado, DEBERÁ ver exactamente una y nunca otra.
5. CUANDO termine la transacción de bootstrap, rol y GUC locales NO DEBERÁN
   sobrevivir en una conexión reutilizada.
6. EL SISTEMA NO DEBERÁ aceptar código o UUID de tenant desde una petición.
7. EL SISTEMA DEBERÁ conservar las barreras RLS de lectura/escritura entre dos
   tenants ficticios.

## STOP CONDITIONS

- Se requiere `SECURITY DEFINER`, conexión propietaria/migradora o privilegio
  adicional para el runtime.
- Se requiere modificar una política, grant, migración o el esquema Prisma.
- La implementación permite entrada de tenant desde una solicitud o enumera
  códigos/filas.
- Alguna prueba decisiva usa `MERDN_RUNTIME_ROLE=disabled` o no usa PostgreSQL
  real con identidad runtime sin `BYPASSRLS`.
- Se necesita tocar un archivo fuera de la allowlist o cambiar valores demo.
