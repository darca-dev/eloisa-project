# Especificación 029 — Recuperación de compilación y Docker

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Aprobado por / Approved by: Product Owner
- Fecha de aprobación / Approval date: 2026-09-21
- Evidencia de aprobación / Approval evidence: autorización explícita registrada en esta spec y en `spec/.sdd/user-consent.log` para `029-recuperacion-build-docker`.

**Número**: 029
**Slug**: `recuperacion-build-docker`
**Estado / Status**: `Aprobado`
**Prioridad**: Crítica
**Owner**: Product Owner
**Fecha**: 2026-09-21
**Evidencia de aprobación / Approval evidence**: autorización explícita del Product Owner en sesión del 2026-09-21: «tu harás todo aquí no manejo Claude tienes mi aprobación».

## 1. Objetivo

Recuperar la capacidad de compilar, construir imágenes y arrancar el entorno local de MERDN con Docker Compose, sin ampliar comportamiento de producto, modelo de datos, permisos ni integraciones.

El diagnóstico reproducible del 2026-09-21 determinó que `docker compose start` reactivó una imagen obsoleta. Al reconstruir desde el árbol actual, la API no compiló: el commit `ffef693` eliminó `apps/api/src/identity-access/identity-access.service.ts` mientras módulos existentes todavía lo importan. El mismo build informó comprobaciones de nulidad pendientes en `KeycloakAdminClient` y símbolos sin uso en una consulta de visitas.

## 2. Alcance

### Incluido

1. Restaurar `IdentityAccessService` únicamente desde su última versión versionada anterior a la eliminación (`ffef693^`), preservando sus reglas existentes de tenant, vigencia y fail-closed.
2. Reconciliar los imports y símbolos sin uso estrictamente necesarios para que la API compile sin modificar el comportamiento autorizado.
3. Hacer que el cliente local de administración Keycloak rechace de forma controlada una configuración ausente antes de desreferenciarla; no debe hacer llamadas de red ni crear identidades cuando esté deshabilitado.
4. Añadir una prueba de composición que compile `AppModule` para detectar proveedores o imports faltantes antes de Docker.
5. Verificar build de API y web, reconstrucción de Compose y respuesta sana de `GET /health`.

### Excluido

- Migraciones, cambios a `prisma/schema.prisma`, datos, seeds, roles PostgreSQL o políticas RLS.
- Cambios de contrato HTTP, UI, rutas, sesiones, cookies, reglas clínicas o autorización de negocio.
- Habilitar Keycloak, llamar la Admin API, crear usuarios, añadir proveedores externos, Redis, worker u outbox.
- Integraciones y datos oficiales de entidades externas; las capacidades institucionales futuras conservan su representación y sus pantallas demostrativas claramente no oficiales.
- Refactorizaciones no exigidas por los errores de compilación identificados.

## 3. Usuarios, datos, seguridad y auditoría

No se crean, consultan ni modifican registros de negocio. No se usan datos reales ni secretos. Esta corrección debe conservar el aislamiento por tenant y el fallo cerrado de `IdentityAccessService`; cualquier configuración Keycloak ausente debe terminar en error controlado, nunca en una llamada parcial ni en una degradación silenciosa.

No se crea un evento de auditoría de dominio: no ocurre una operación de negocio. La evidencia de la recuperación será el historial de esta spec, los resultados de validación y los logs sanitizados de Docker.

## 4. Archivos permitidos

- `apps/api/src/identity-access/identity-access.service.ts`
- `apps/api/src/patients/keycloak-admin.client.ts`
- `apps/api/src/visits/professional-visit-query.service.ts`
- `apps/api/test/application-composition.test.ts`
- `apps/api/src/patients/keycloak-admin.client.test.ts`
- `spec/specs/029-recuperacion-build-docker/**`
- `spec/specs/INDEX.md`

Todo otro archivo está prohibido. Si la recuperación exige ampliar esta lista, detenerse y actualizar esta spec antes de continuar.

## 5. Requisitos y criterios de aceptación

1. `npm run build --workspace @merdn/api` finaliza con código 0.
2. La prueba de composición compila `AppModule` con el entorno ficticio de pruebas y falla si falta un provider o módulo importado.
3. Las pruebas de `IdentityAccessService` pasan y mantienen tenant del principal, vigencias de afiliación/asignación y propagación de `RuntimeContextUnavailableError`.
4. `KeycloakAdminClient` no usa propiedades de una configuración indefinida; comunica una `KeycloakProvisionError` controlada.
5. `docker compose up -d --build` construye API y Web desde el árbol actual; `merdn-api-1` llega a estado saludable y `/health` responde 200 con el contrato exacto `{ "status": "ok" }`.
6. No se alteran migraciones, esquema, datos, endpoints ni permisos.

## 6. Dependencias, riesgos y rollback

**Dependencias**: Node 24, dependencias ya bloqueadas por `package-lock.json`, Docker Desktop y PostgreSQL local existente. No se añade dependencia.

**Riesgos**: restaurar un servicio con semántica distinta a la esperada por los consumidores actuales; se mitiga restaurando desde Git y ejecutando sus pruebas y las pruebas de composición. Las llamadas Keycloak permanecen deshabilitadas si no hay configuración válida.

**Rollback**: revertir exclusivamente los archivos permitidos de esta spec. No hay migración, dato ni contenedor persistente que deba eliminarse.
