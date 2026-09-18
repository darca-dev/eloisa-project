# Plan 025 — FORCE RLS y baseline aislada

## Estado

`APPROVED / CONSENT RECORDED`. MP01 queda preparado en `TO-CLAUDE.md`; MP02–MP42 permanecen cerrados.

## Estrategia

Implementar primero artefactos pequeños y revisables; después ejecutar una corrida con run-id único en paquetes cronometrados. Sin métricas históricas confiables, cada suite DB ocupa su propio paquete. Esto es el mínimo documental seguro que garantiza hard stop ≤15 minutos sin omitir cobertura.

## Contrato común de los 42 micro-paquetes

- Timebox total por paquete: 15 minutos exactos como máximo.
- Trabajo/ejecución estimada: 10–12 min; review/checkpoint: 3–5 min.
- Al minuto 15: detener proceso, preservar evidencia, ejecutar cleanup si hay recursos test y reportar `BLOCKED`; nunca continuar silenciosamente.
- Denylist común: archivos fuera de allowlist, migraciones históricas, schema, producto, Compose local/staging, demo/staging/prod, datos existentes, dependencias, secretos y configuración local.
- Git esperado: rama autorizada; sin staged/commit/push de Claude; cambios previos validados más solo la allowlist actual; ningún archivo ajeno.
- Rollback común de edición: retirar solo cambios no validados del paquete actual, sin descartar trabajo ajeno. Rollback operativo: cleanup exacto del proyecto test verificado.
- STOP común: dependencia nueva, archivo extra, test inesperado, identidad/lock/owner ambiguo, timeout, skip, disabled, cleanup incierto o contradicción con spec.
- Cada paquete depende de PASS/review Codex del anterior. Claude no investiga fuera del objetivo único.

## Fase I — artefactos de implementación

| ID | Objetivo único | Dependencia | Allowlist exacta | Acción/prueba focal | PASS | Est./review/hard stop |
|---|---|---|---|---|---|---|
| MP01 | Topología test | Consentimiento | `compose.test.yml`, `.env.test.example` | Definir proyecto/servicio/DB/puerto/red/volumen exclusivos; `docker compose config` con placeholders | Cero referencia demo/staging/prod y sin secretos | 10/5/15 |
| MP02 | Guard anti-entorno | MP01 | `scripts/testing/test-environment-guard.mjs` | Parseo estructural, labels e identidad esperada; typecheck sintáctico Node | Rechazo fail-closed antes de Docker | 10/5/15 |
| MP03 | Pruebas del guard | MP02 | `tests/testing/test-environment-guard.test.mts` | Casos válidos y colisiones/URLs prohibidas | Todos los negativos fallan sin comando destructivo | 10/5/15 |
| MP04 | Migración FORCE forward | MP03 | `prisma/migrations/20260830160000_force_rls_core_institutional_hospital/migration.sql` | FORCE solo a 15 tablas, transacción/timeouts/preflight | SQL acotado, sin DML/history/schema/policy/grant | 10/5/15 |
| MP05 | Prueba catálogo FORCE | MP04 | `apps/api/test/force-rls-catalog.db.test.ts`, `apps/api/test/core-01-hardening.db.test.ts` solo aserciones | 26 tablas, 27 policies, owners/flags y owner no bypass | 26 ENABLE+FORCE, runtime seguro, negativos cross-tenant | 10/5/15 |
| MP06 | Runbook remediación | MP05 | `docs/runbooks/FORCE_RLS_REMEDIATION.md` | Pre/postflight, locks, rollback forward-only, emergencia | Sin down improvisado/BYPASS/disabled | 10/5/15 |
| MP07 | Provision test DB | MP06 | `scripts/testing/test-db-provision.mjs` | Pre-clean verificado, up, readiness, 13 migraciones, tenant | Identidad server-side y migración completa | 10/5/15 |
| MP08 | Preflight runtime/RLS | MP07 | `scripts/testing/test-db-preflight.mjs` | URLs, roles, owners, 26/27, tenant, cross-tenant | enforce y catálogo/conducta PASS | 10/5/15 |
| MP09 | Cleanup test DB | MP08 | `scripts/testing/test-db-cleanup.mjs` | finally/signals, proyecto+labels exactos, postcheck | Cero recursos test; nunca target ambiguo | 10/5/15 |
| MP10 | Pruebas lifecycle | MP09 | `tests/testing/test-db-lifecycle.test.mts` | Construcción de comandos, errores, señales y redacción | Fallos seguros y cleanup verificable | 10/5/15 |
| MP11 | Stale cuarto rol | MP10 | `apps/api/src/institutional-auth/institutional-auth.unit.test.ts` | Solo expectativas/nombre/listas del cuarto rol | Unit focal verde; diff sin producto | 8/7/15 |
| MP12 | Stale branding | MP11 | `apps/web/src/config/branding.test.tsx` | Allowlist test exacta o importar branding | Web focal verde; ningún productivo exceptuado | 8/7/15 |
| MP13 | Runner baseline | MP12 | `scripts/testing/run-baseline.mjs`, `package.json` solo scripts | Stages/run-id, timeout, zero-skip, redacción | Matriz exacta y códigos inequívocos | 10/5/15 |
| MP14 | Pruebas runner | MP13 | `tests/testing/run-baseline.test.mts` | Omisión/skip/timeout/fallo/cleanup/evidencia | Ningún falso verde | 10/5/15 |

En todos MP01–MP14 aplican denylist, rollback, STOP y estado Git comunes. Cualquier modificación adicional requiere volver a Codex.

## Fase II — primera corrida cronometrada

Todos los paquetes MP15–MP42 tienen allowlist de escritura `NONE` salvo evidencia efímera ignorada creada por el runner dentro del directorio test temporal aprobado. No modifican Git. El run-id y cluster test abierto por MP15 deben ser los mismos hasta MP42; antes de cada paquete se revalida identidad/labels. Ante cualquier STOP se ejecuta inmediatamente el cleanup definido para MP42.

| ID | Objetivo/acción autorizada | Dependencia | Prueba focal/criterio PASS | Est./review/hard stop |
|---|---|---|---|---|
| MP15 | Provisionar corrida | MP14 | Guard + up + readiness + 13 migraciones + preflight; PASS sin demo | 12/3/15 |
| MP16 | Typecheck global | MP15 | `npm run typecheck`; exit 0 | 12/3/15 |
| MP17 | Unitarias API no DB + health general | MP16 | stage exacto, cero DB-gated/skip, exit 0 | 12/3/15 |
| MP18 | Suite web | MP17 | todas web, exit 0 | 12/3/15 |
| MP19 | OpenAPI `+1` | MP18 | solo `openapi.test.ts`, exit 0 | 10/5/15 |
| MP20 | `cold-start-auth.api.test.ts` | MP19 | suite ejecutada, cero skip, enforce | 12/3/15 |
| MP21 | `core-01-hardening.db.test.ts` | MP20 | suite ejecutada, catálogo/owner/cross-tenant PASS | 12/3/15 |
| MP22 | `eloisa-admin-support-foundation.db.test.ts` | MP21 | suite ejecutada, cero skip | 12/3/15 |
| MP23 | `hospital-agenda.api.test.ts` | MP22 | suite ejecutada bajo enforce | 12/3/15 |
| MP24 | `hospital-core-02.db.test.ts` | MP23 | suite ejecutada, cero skip | 12/3/15 |
| MP25 | `hospital-institutional-auth.api.test.ts` | MP24 | suite ejecutada bajo enforce | 12/3/15 |
| MP26 | `hospital-patients.api.test.ts` | MP25 | suite ejecutada bajo enforce | 12/3/15 |
| MP27 | `hospital-professionals.api.test.ts` | MP26 | suite ejecutada bajo enforce | 12/3/15 |
| MP28 | `human-auth.api.test.ts` | MP27 | suite ejecutada bajo enforce | 12/3/15 |
| MP29 | `identity-professional-assignment.db.test.ts` | MP28 | suite ejecutada, cero skip | 12/3/15 |
| MP30 | `municipality.api.test.ts` | MP29 | suite ejecutada bajo enforce | 12/3/15 |
| MP31 | `municipality-aggregates.db.test.ts` | MP30 | suite ejecutada, cero skip | 12/3/15 |
| MP32 | `patient-enrollment.api.test.ts` | MP31 | suite ejecutada bajo enforce | 12/3/15 |
| MP33 | `patient-enrollment.db.test.ts` | MP32 | suite ejecutada, cero skip | 12/3/15 |
| MP34 | `patient-self.api.test.ts` | MP33 | suite ejecutada bajo enforce | 12/3/15 |
| MP35 | `patient-self.db.test.ts` | MP34 | suite ejecutada, cero skip | 12/3/15 |
| MP36 | `runtime-fail-closed.db.test.ts` | MP35 | suite ejecutada, negativos PASS | 12/3/15 |
| MP37 | `tenant-bootstrap.db.test.ts` | MP36 | suite ejecutada bajo enforce | 12/3/15 |
| MP38 | `visits.api.test.ts` | MP37 | suite ejecutada bajo enforce | 12/3/15 |
| MP39 | `visits-db-foundation.db.test.ts` | MP38 | suite ejecutada, cero skip | 12/3/15 |
| MP40 | `visits-materialization.db.test.ts` | MP39 | suite ejecutada, cero skip | 12/3/15 |
| MP41 | `visits-professional-transitions.db.test.ts` | MP40 | suite ejecutada, cero skip | 12/3/15 |
| MP42 | Agregación y cleanup | MP41 | 22+1 completos con misma huella/run-id; evidencia sanitizada; cero recursos | 10/5/15 |

Cada MP20–MP41 autoriza exactamente un archivo DB-gated. Si un archivo excede 12 minutos, el runner reserva 3 para detener/reportar/cleanup y el paquete queda `BLOCKED`; no se divide semánticamente ni se omite.

## Riesgos y mitigación

- Lock FORCE: ventana controlada, timeouts, transacción y STOP sin retry.
- Owner bypass implícito: FORCE + prueba owner/no-context.
- Fixtures privilegiados: admin solo cluster test; API solo runtime.
- Runtime degradado: `disabled` es FAIL.
- Duración desconocida: una suite por paquete y hard timeout.
- Cluster entre paquetes: revalidar run-id/labels cada vez; cleanup inmediato ante STOP.
- Falso agregado: MP42 exige misma huella de commit/run-id y todos los stages MP15–MP41.

## Compatibilidad y remediation

DDL futuro continúa posible. DML administrativo/backfills futuros deben especificar contexto o mecanismo aprobado. Una regresión posterior se corrige forward-only; no se edita historia ni se concede bypass.
