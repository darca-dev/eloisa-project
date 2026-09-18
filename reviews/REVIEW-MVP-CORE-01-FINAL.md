# REVIEW-MVP-CORE-01-FINAL — Revisión después de corrección RLS

## Veredicto

**PASS condicionado para CORE-01 MVP con datos ficticios/controlados.**

**READY FOR COMMIT: SÍ**, sujeto a autorización expresa del Product Owner.

**READY FOR PRODUCTION: NO.** Queda prohibido desplegar o usar datos reales hasta repetir la suite completa en modo `enforce` contra PostgreSQL servidor normal y validar la provisión runtime mediante Docker/WSL2.

## Controles verificados

| Control | Resultado | Evidencia |
| --- | --- | --- |
| Fail-closed | PASS | `enterRuntimeContext()` aborta si falla `SET LOCAL ROLE`, si el rol efectivo no es `merdn_runtime` o si el tenant no queda fijado. El callback de negocio se ejecuta solo después de verificar ambos. |
| Runtime/migrator | PASS de diseño/configuración | `DATABASE_URL` permanece administrativa; `RUNTIME_DATABASE_URL` es obligatoria y distinta en `enforce`. Prisma usa la URL runtime. El rol no es owner, superusuario ni `BYPASSRLS`. |
| RLS | PASS | Políticas tenant-scoped en nueve tablas, `USING/WITH CHECK`, contexto transaccional y prueba adversa fail-closed. |
| Aislamiento tenant | PASS | Pruebas de lectura/escritura, contexto ausente/incorrecto y acceso cruzado entre tenants. |
| Auditoría | PASS | Runtime solo puede insertar/leer; triggers bloquean UPDATE, DELETE y TRUNCATE, incluido el owner ordinario. |
| Refresh y persistencia | PASS | POST persiste; cookie `HttpOnly`; GET `/me` recupera el mismo paciente tras reinicio. No se usa `localStorage` ni `sessionStorage`. |
| Duplicados/concurrencia | PASS | P2002 documental preciso; carrera reportada con un `201`, un `409` y una persona persistida. |
| Territorio | PASS | Urbana/Rural obligatoria; jerarquía territorial, tenant local y coherencia barrio/vereda protegidos en API y DB. |
| Allowlist/diff | PASS | No hay cambios en prototipo ni módulos excluidos. Los archivos de configuración, Docker, pruebas y wiring pertenecen a la corrección autorizada. |

## Pruebas

Evidencia final reportada por Claude:

- API: **215/215 PASS**, 0 omitidas.
- Web: **1104/1104 PASS**.
- Shared: **4/4 PASS**.
- lint, typecheck, build, Prisma validate/generate, secret scan y `git diff --check`: PASS.
- persistencia, reinicio, GET `/me`, concurrencia, RLS, aislamiento, mínimo privilegio, fail-closed y append-only: PASS.

Codex confirmó por inspección:

- fail-closed real antes del callback de negocio;
- separación de variables y rechazo de credenciales iguales/ausentes;
- políticas y privilegios de `merdn_runtime`;
- pruebas específicas `runtime-fail-closed.db.test.ts` y `core-01-hardening.db.test.ts`;
- prueba de cadena cliente POST/cookie/GET `/me` y ausencia de Web Storage;
- selector obligatorio Urbana/Rural;
- `git diff --check` sin errores;
- dependencias sin cambios en esta corrección.

La prueba frontend de restauración valida el cliente, la cookie simulada y la representación Paciente, aunque no ejecuta el `useEffect` mediante un navegador DOM completo. La implementación del efecto fue inspeccionada y la restauración fue reportada ejecutada; esta limitación de cobertura no bloquea el MVP, pero debe incluirse en la revalidación operativa.

## Limitación operativa no bloqueante para MVP

Prisma Dev/PostgreSQL 17.5 WASM presenta una limitación propia en ciertas escrituras bajo rol no propietario con claves foráneas compuestas. El workaround de pruebas solo desactiva el trigger interno `prisma_dev_wal_capture` cuando detecta WASM; no debilita migraciones, políticas ni privilegios MERDN.

Esta limitación se acepta exclusivamente para desarrollo/MVP con datos ficticios o controlados. No invalida las pruebas específicas de fail-closed, RLS, aislamiento, mínimo privilegio y append-only ya ejecutadas.

## Gate obligatorio antes de producción

Cuando Docker/WSL2 esté disponible se debe:

1. Levantar PostgreSQL servidor normal desde `compose.yml`.
2. Provisionar fuera del repositorio la identidad LOGIN runtime de mínimo privilegio descrita en `prisma/README.md`.
3. Inyectar `DATABASE_URL` solo al proceso de migración y `RUNTIME_DATABASE_URL` a la API.
4. Aplicar las tres migraciones mediante la identidad administrativa.
5. Ejecutar API con `MERDN_RUNTIME_ROLE=enforce`.
6. Ejecutar las 215 pruebas API/DB sin omisiones ni workaround WASM.
7. Repetir POST → cookie → reinicio → GET `/me`, concurrencia, pool reuse, cross-tenant y append-only.
8. Montar realmente `ExperienciaMerdn` en navegador y verificar la transición de refresh.
9. Construir y arrancar la imagen API desde checkout limpio.

Actualmente `compose.yml` no provisiona ni entrega automáticamente la credencial runtime. Esto es una limitación operativa conocida y no bloquea el slice local porque hosting/despliegue están fuera de CORE-01; sí bloquea cualquier producción.

## Alcance y dependencias

- Archivos fuera de alcance: ninguno.
- Dependencias nuevas en esta corrección: ninguna.
- Dependencias Prisma previamente aprobadas: `@prisma/client@7.9.1` y `@prisma/adapter-pg@7.9.1`.
- No hubo commit ni push durante la revisión.

## Gate final

- Bloqueantes restantes para CORE-01 MVP: ninguno.
- Limitación Docker/WSL2 bloqueante para MVP: **NO**.
- Limitación Docker/WSL2 bloqueante para producción: **SÍ**.
- READY FOR COMMIT: **SÍ**, previa autorización expresa del Product Owner.
- CORE-01 FUNCIONAL PARA MVP: **SÍ**, únicamente bajo las limitaciones anteriores.
