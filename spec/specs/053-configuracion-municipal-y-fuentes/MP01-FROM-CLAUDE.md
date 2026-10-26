# 053-MP01 — Entrega de Claude (PE-04 / PE-05)

## Identificación

- Task: 053-MP01 — Validación textual y vigencia tras bloqueo (`MP01-CORRECCIONES-PE04-PE05.md`).
- Autoridad: spec053 aprobada + `spec/bitacora/decisiones/2026-10-26-053-continuacion-con-claude.md`.
- Base: e94e400, rama `feat/preentrega-access-hardening`. Cambios ajenos 055/054 preservados sin tocar.
- Estado: **implementada con verificación pendiente**. Código y pruebas sin DB verificados; los casos
  PostgreSQL (PE-04 API y las dos carreras PE-05) están **preparados y no ejecutados** por Claude, según contrato.
- Sin commit, push, despliegue, consentimiento ni cambios a aceptación/docs de Codex.

## Compuertas previas (ejecutadas antes de editar)

| Comando | Exit |
|---|---|
| `./spec/scripts/check-sdd-gate.sh .` | 0 (0 errores, 19 avisos de specs antiguas; 053 aprobada con consentimiento registrado) |
| `./spec/scripts/validate-sdd.sh . --strict` | 0 (0 errores, 0 avisos) |

## Cambios (solo allowlist)

| Archivo | Propósito |
|---|---|
| `packages/shared/src/municipality-management.ts` | PE-04: `values[key] ?? ''` sustituido por `Object.hasOwn(values, key) ? values[key] : ''`. Ausente = vacío; todo campo presente (incluido `null` o `undefined` explícito) pasa por `cleanText`, que exige `string`. Sin coerción. Límites, semántica de fecha/año/monto/entero/puntaje/URL, claves desconocidas, fuente oficial y requeridos sin cambios. |
| `apps/api/src/municipality/municipality-management.service.ts` | PE-05: `const now = new Date()` movido a después del `SELECT … FOR SHARE` de cuenta (y por tanto después del advisory en PUT). Orden advisory→cuenta, filtros, binding, capacidad, revocación, TTL y auditoría sin cambios; el `occurredAt` de auditoría usa este instante. |
| `packages/shared/src/municipality-management.test.ts` | Matriz de tipos inválidos (`null`, `undefined`, booleanos, números, `NaN`, arreglos, objetos) en opcional y requerido (`programas`) y opcional `money` (`presupuesto`); `null` en campos de registro; ausente y vacío opcionales aceptados; documento guardado→releído→editado sigue válido. |
| `apps/web/src/features/municipality/municipalityManagement.test.tsx` | Cliente: respuesta 200 con `null` en values, número en requerido o `notes: null` → `kind: 'error'` sin `document`. Secuencia PUT v0 → GET → PUT con `expectedVersion` 1 editado → `ok`. |
| `apps/api/test/municipality-management.api.cases.ts` | API PE-04 (`presupuesto`): `ejecutado` ∈ {null,false,0,[],{}} → 400, sin revisión ni SAVED; guardado válido→GET→edición v2→GET; revisión v1 intacta en historial; SAVED +2. Dos carreras reales PE-05 (GET `brechas`, PUT `cuidado`). |
| `spec/specs/053-configuracion-municipal-y-fuentes/MP01-FROM-CLAUDE.md` | Esta entrega. |

Sin cambios en editor/cliente (`MunicipalitySettings.tsx`, `municipalityManagementClient.ts`): el cliente ya valida
cada respuesta con `validateMunicipalWrite`, por lo que la corrección compartida cierra el borde y un valor no textual
no llega a `.trim()` del editor. Sin esquema, migraciones, permisos, dependencias, catálogos ni prototipo.

## Diseño de la carrera PE-05 (`expiresWhileWaitingForAccount`)

1. Sesión efímera propia (binding exacto, +10 min) por caso; no altera la sesión del fixture ni orden de otros casos.
2. Blocker: transacción interactiva del cliente de pruebas (`createTestPrismaClient`, no el `PrismaService` de la app)
   con `timeout` 20 s; obtiene `pg_backend_pid()`, toma `human_account … FOR UPDATE` y espera liberación explícita.
   Se convierte en promesa que resuelve al error, de modo que un fallo del blocker no deja la barrera colgada.
3. Se invoca `MunicipalityManagementService.document` real (obtenido de la app Nest) con principal ficticio válido.
4. Barrera: sondeo acotado (20 ms, deadline 10 s) hasta que `pg_stat_activity` muestre exactamente un backend con
   el pid del blocker en `pg_blocking_pids(pid)` **y** la llamada del servicio siga pendiente.
5. Con la espera confirmada se fija `expiresAt = now` (≥ instante previo al inicio de la llamada, antes de liberar).
6. `finally`: libera el blocker, espera su fin y espera el desenlace del servicio; ninguna promesa ni transacción queda viva.
7. Aserciones: `ForbiddenException`, sin documento; revisiones, READ y SAVED sin cambio; DENIED exactamente +1.

Sin `sleep` fijo, sin reloj global simulado, sin desactivar RLS/FORCE y sin reconectar el cliente de la aplicación.
Con el código anterior (`now` antes del `FOR SHARE`) la sesión seguiría vigente respecto a ese instante y el caso fallaría.

## Verificación ejecutada por Claude

Entorno: `DATABASE_URL`/`RUNTIME_DATABASE_URL` ficticios inutilizables (`127.0.0.1:1`); sin leer `.env`, sin DB, Docker,
navegador ni servidores.

| Comando | Exit | Resultado |
|---|---|---|
| `npm run build:shared` | 0 | dist compartido actualizado |
| `npm run typecheck --workspace @merdn/shared` | 0 | — |
| `npm run typecheck --workspace @merdn/api` | 0 | — |
| `npm run typecheck --workspace @merdn/web` | 0 | — |
| `npx eslint <5 archivos de código tocados>` | 0 | primer intento exit 1 (`no-unsafe-finally`), corregido |
| `cd packages/shared && npx vitest run` | 0 | 2 archivos, 11 pruebas aprobadas |
| `cd apps/web && npx vitest run src/features/municipality` | 0 | 14 archivos, 381 pruebas aprobadas |

## Pendiente para Codex (no ejecutado por Claude)

- `municipality.api` en clúster PostgreSQL efímero con runner/preflight/cleanup: casos 053 existentes, PE-04 API y
  ambas carreras PE-05; confirmar ausencia de omitidas, RLS, permisos y auditoría.

## Decisiones locales y riesgos

- Barrera sin filtro por texto de consulta: `pg_stat_activity.query` puede ocultarse a roles sin `pg_read_all_stats`;
  la identificación se apoya en `pg_blocking_pids` (nada más toca esa cuenta) y en que la llamada siga pendiente.
- Secciones `presupuesto`, `brechas`, `cuidado` separadas de `programas` para no alterar los conteos de los casos previos.
- Los casos nuevos se insertaron antes de RLS y de «sesión revocada» (que revoca la sesión del fixture).
- Riesgo: la transacción del servicio usa el timeout interactivo por defecto de Prisma (5 s); la barrera debe resolverse
  dentro de ese margen. En un clúster muy lento el caso fallaría por timeout, no daría falso positivo.
- Legado inválido: no se repara ni reescribe; una revisión persistida con valores no textuales ahora hace que el cliente
  muestre error controlado. No se encontró ni se buscó en datos reales (sin acceso a DB).

## Fuera de alcance

Paquetes de navegador, builds de aplicación, aplicación local, E2E y cierre de 053 quedan para después de la auditoría de MP01.
