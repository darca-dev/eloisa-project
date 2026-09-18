# Tareas 016 - Acceso de soporte administrativo (fundación de datos)

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

- [x] Enum `PlatformSupportCapabilityStatus` (`ACTIVE`, `DISABLED`)
- [x] Enum `SupportGrantScope` con **un único** valor `HOSPITAL_OPERATIONAL_READ`
- [x] Enum `SupportGrantStatus` (`ACTIVE`, `REVOKED`)
- [x] Modelo `PlatformSupportCapability`, nominativo sobre `HumanAccount` del
      mismo tenant home, sin credencial, sal, `subject` OIDC ni rol institucional
- [x] Modelo `SupportGrant` con tenant objetivo único, alcance cerrado, vigencia
      declarada y revocación en vez de borrado
- [x] Modelo `SupportContextSession` con token hasheado, motivo obligatorio,
      ticket opcional, TTL absoluto y salida explícita
- [x] Migración aditiva
      `20260825120000_eloisa_admin_access_01_mp01/migration.sql` (657 líneas)
- [x] Rollback explícito `ROLLBACK-eloisa_admin_access_01_mp01.sql` (204 líneas)
- [x] `ENABLE` + `FORCE ROW LEVEL SECURITY` en las tres tablas
- [x] Tres políticas RLS contra `merdn_current_tenant()` por tenant **home**
- [x] `WITH CHECK` en la política de contexto: no se escribe ni se mueve a otro
      tenant home
- [x] Mínimo privilegio: `SELECT` en capacidad y autorización, `SELECT/INSERT/
      UPDATE` en contexto, **`DELETE` en ninguna**
- [x] Índice parcial `support_grant_active_unique`: una sola autorización activa
      equivalente, conservando la historia revocada
- [x] Índice parcial `support_context_session_open_unique`: un solo contexto no
      revocado por cuenta
- [x] Restricción de TTL absoluto `expiresAt <= createdAt + 60 minutos`
- [x] Restricción `lastUsedAt` dentro de la ventana `[createdAt, expiresAt]`
- [x] Restricciones de forma: motivo 8..500 con recorte lógico, ticket 1..120
- [x] Restricciones de coherencia estado ↔ timestamps en capacidad y autorización
- [x] Trigger `support_context_session_immutable`: solo `lastUsedAt` y
      `revokedAt` mutan; un contexto revocado no se reabre
- [x] 19 primitivas nuevas de `AuditEventType` para soporte
- [x] Cinco columnas nullables de procedencia de soporte en `AuditEvent`
- [x] `CHECK audit_event_support_provenance`: actor `HUMAN_ACCOUNT`, `actorRole`
      nulo, `actorUserId` y `actorHomeTenantId` presentes
- [x] `CHECK audit_event_support_text_shape`: motivo y ticket acotados en la traza
- [x] FKs de auditoría `RESTRICT` / `NO ACTION`: ninguna cascada destruye
      autorizaciones, contextos ni evidencia
- [x] Índice único aditivo `human_session_id_account_tenant_unique` para sostener
      la FK compuesta, sin tocar columnas, privilegios ni políticas de esa tabla
- [x] Prueba PostgreSQL `eloisa-admin-support-foundation.db.test.ts`: 2.072
      líneas, 62 casos, 13 grupos, sin datos reales
- [x] Task Specifications `MP01-DATA-FOUNDATION`, `MP02-SUPPORT-SERVICES-GUARDS`
      y `MP02-TEST-CONTRACT-CORRECTION` escritas y congeladas en `tasks/`

## Límites conocidos (no autorizados como trabajo)

- [ ] **MP02 completo: `apps/api/src/support-access/` no existe en `develop`.**
      Faltan contrato, servicio, guard y módulo. Vive solo en
      `origin/wip/eloisa-admin-mp02-20260825` (`6b0c74d`)
- [ ] Apertura de contexto de soporte con token propio y auditoría atómica
- [ ] Validación del contexto: TTL absoluto de 60 minutos e inactividad de 15
- [ ] Cierre automático del contexto previo expirado antes de abrir otro
- [ ] Salida explícita idempotente que revoca sin tocar la `HumanSession`
- [ ] `SupportContextGuard` y el `SupportPrincipal` server-side
- [ ] Cookie de soporte distinta de la humana, la institucional y la de
      inscripción
- [ ] Aplicación de la corrección `MP02-TEST-CONTRACT-CORRECTION` a las tres
      aserciones globales de `eloisa-admin-support-foundation.db.test.ts`
      (líneas 1748-1750, 1922-1924 y 2061-2068)
- [ ] Suite `apps/api/test/support-access.service.db.test.ts`
- [ ] MP03: controller, DTO, OpenAPI y endpoints de soporte
- [ ] MP04: guards de lectura Hospital y auditoría por lectura de Pacientes,
      Profesionales, Agenda, Visitas y auditoría operacional
- [ ] Emisión real de las 19 primitivas de auditoría: hoy ninguna se escribe
- [ ] Escritura de las cinco columnas de procedencia: hoy ninguna se rellena
- [ ] Creación y revocación de autorizaciones por Platform Owner/Admin. El rol de
      ejecución solo tiene `SELECT`: exigiría su propia migración de privilegios
- [ ] Aprovisionamiento de la cuenta administradora `eloisa-admin-local` en el
      realm OIDC y en la base
- [ ] Selector de institución, indicador de contexto de soporte y cualquier UI
- [ ] Endurecimiento de `audit_event_resource_required` con lista positiva para
      las 19 primitivas nuevas (residual declarado en `migration.sql:576-592`)
- [ ] Job de purga y política de retención: MP01 no implementa borrado
- [ ] Auditoría independiente: no existe `REVIEW-ELOISA-ADMIN-ACCESS-*` en
      `reviews/`

## Verificación pendiente

- [ ] Levantar PostgreSQL y ejecutar
      `npx vitest run --config vitest.config.mts test/eloisa-admin-support-foundation.db.test.ts --fileParallelism=false`
      desde `apps/api`, comprobando **cero saltados**: sin base de datos la suite
      entera se salta (`describe.skipIf`, línea 267) y no prueba nada
- [ ] `npx prisma validate`
- [ ] Aplicar la migración contra una base viva y comprobar `relrowsecurity` y
      `relforcerowsecurity` en `pg_class` para las tres tablas
- [ ] Comprobar en `information_schema.role_table_grants` que `merdn_runtime` no
      tiene `INSERT`/`UPDATE`/`DELETE` sobre `platform_support_capability` ni
      `support_grant`
- [ ] Comprobar que `merdn_runtime` no es superusuario y no tiene `BYPASSRLS`
- [ ] Ejecutar el rollback y verificar que retira solo objetos de MP01,
      aceptando que los 19 valores del enum no pueden retirarse
- [ ] Revisar el contenido funcional de `6b0c74d` antes de cualquier decisión
      sobre recuperar MP02: esta spec documenta que existe y dónde, no que sea
      correcto
