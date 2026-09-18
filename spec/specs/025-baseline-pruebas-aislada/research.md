# Investigación 025 — FORCE RLS y baseline aislada
## Evidencia observada

- Estado remoto sincronizado antes de la revisión: `86ead36a175b9b27e5c473cc762b4ed8d923b953`.
- PostgreSQL protege 26 tablas mediante RLS y 27 políticas (dos corresponden a `audit_event`).
- Once tablas ya tienen `ENABLE` y `FORCE ROW LEVEL SECURITY` ejecutables en migraciones: `human_account`, `external_auth_identity`, `human_session`, `human_auth_attempt`, `patient_caregiver_relationship`, `patient_caregiver_relationship_scope`, `home_visit`, `home_visit_transition`, `platform_support_capability`, `support_grant` y `support_context_session`.
- Quince tablas tienen RLS pero aún no FORCE: `tenant`, `territorial_unit`, `person`, `patient`, `patient_population_membership`, `patient_address`, `consent_record`, `enrollment_session`, `audit_event`, `institutional_identity`, `institutional_session`, `professional_profile`, `professional_affiliation`, `care_assignment` y `appointment`.
- La conclusión anterior de cero sentencias FORCE fue un falso negativo de una búsqueda con espacios rígidos. La verificación corregida usó `FORCE\s+ROW LEVEL SECURITY` sobre todos los `migration.sql`.
- `merdn_runtime` se crea `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE` y `NOBYPASSRLS`; el servicio debe usarlo mediante `SET ROLE` y nunca ser dueño de tablas.
- Hay 22 suites DB-gated y `openapi.test.ts` constituye el `+1`. `health.api.test.ts` permanece fuera de ese conteo.

## Decisión técnica

La remediación debe ser una migración nueva, hacia adelante y productiva, prevista como `prisma/migrations/20260830160000_force_rls_core_institutional_hospital/migration.sql`. Debe aplicar FORCE exactamente a las 15 tablas faltantes. No se edita historia y TEST no puede añadir FORCE por un camino alterno.

No existe una exclusión segura: las 26 tablas protegidas deben terminar con `relrowsecurity=true` y `relforcerowsecurity=true`. El postflight también debe verificar las 27 políticas, el rol efectivo, `rolsuper=false`, `rolbypassrls=false`, ownership no-runtime y pruebas negativas cross-tenant.

## Seguridad operativa

- Preflight: identidad de servidor/DB, owner y roles, flags de rol, políticas, catálogo y actividad/locks.
- Aplicación: ventana controlada, transacción, `lock_timeout` y `statement_timeout`; cualquier timeout o discrepancia aborta el paquete.
- Remediación: solo migraciones nuevas hacia adelante. Un flujo legítimo roto exige corregir contexto o política; no se concede BYPASSRLS ni superuser.
- `NO FORCE` solo podría existir como migración compensatoria de emergencia expresamente aprobada; nunca como rollback improvisado.

## Aislamiento y baseline

La alternativa seleccionada sigue siendo PostgreSQL Compose desechable y exclusivo, con proyecto, servicio, puerto, DB, red y volumen propios. Se rechaza reutilizar demo o crear una DB en su cluster. URL parsing, identidad del servidor y labels deben fallar cerrado ante `merdn_dev`, demo, staging o producción.

La matriz 22+1 y los dos stale fixes permanecen congelados. Para mantener el hard stop, la primera corrida divide cada suite DB-gated en su propio paquete. Un timeout produce `BLOCKED`; nunca extiende el paquete.

## Revisiones independientes

- Arquitectura/data isolation: PASS; migración forward-only, ownership y aislamiento definidos.
- Seguridad RLS/FORCE/roles: PASS; inventario 11+15 reconciliado con catálogo objetivo 26/27.
- Testing/lifecycle/timeboxing: PASS; lifecycle fail-closed, una suite DB por paquete y hard stop universal.
- Dependencia nueva: no requerida.

## Fuentes

- `prisma/migrations/**/migration.sql`.
- `apps/api/test/test-environment.ts` y `database-availability.ts`.
- `apps/api/vitest.config.mts`.
- `compose.yml`.
- `apps/api/src/institutional-auth/institutional-auth.unit.test.ts`.
- `apps/web/src/config/branding.test.tsx`.
