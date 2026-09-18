# ELOISA-ADMIN-ACCESS-01 · MP01/MP02 — Test Contract Correction

## 1. Clasificación y objetivo

Corrección exclusivamente de pruebas. MP02 creó correctamente eventos de
auditoría confirmados y append-only; sus FKs `NO ACTION`/`RESTRICT` conservan la
capacidad, grant y contexto nombrados. Tres aserciones de MP01 asumían que todo
el tenant debía contener cero evidencia de soporte, supuesto que dejó de ser
válido cuando un packet posterior ejerció el modelo aprobado.

Actualizar esas aserciones para que MP01 verifique únicamente los fixtures y
efectos que posee. Aislar futuras ejecuciones MP02 en un home tenant ficticio
dedicado cuando pueda hacerse solo desde su test, sin reducir las pruebas de
RLS, cambio home→target, ownership, auditoría o denegación cross-tenant.

No corregir ni modificar runtime.

## 2. Hechos que deben preservarse

- Los cinco archivos runtime MP02 permanecen exactamente como están.
- Los 47 tests focales MP02 ya pasaron.
- Los 58 eventos de soporte existentes y todas sus filas dependientes son
  evidencia local válida e irreversible por diseño.
- `audit_event` continúa append-only.
- Las FKs, triggers, grants, RLS `ENABLE + FORCE` y mínimo privilegio no cambian.
- MP01 conserva todas sus verificaciones de integridad, procedencia, tenancy,
  permisos y aislamiento.

## 3. Corrección MP01

Modificar únicamente las tres aserciones globales incompatibles en
`eloisa-admin-support-foundation.db.test.ts`.

Reglas:

1. Una aserción de rollback o rechazo debe comparar el estado del recurso MP01
   antes/después de la operación, o consultar exclusivamente IDs,
   `correlationId`, cuenta, persona/documento ficticio o recursos creados por
   ese caso.
2. Nunca afirmar que `actorHomeTenantId = homeTenantId` implica cero eventos en
   toda la base: packets posteriores pueden haber confirmado eventos válidos.
3. Nunca afirmar que un tenant completo contiene cero
   `PlatformSupportCapability`, `SupportGrant` o `SupportContextSession` si la
   prueba no es dueña de todas esas filas.
4. Para transacciones deliberadamente revertidas, probar que no apareció el
   evento o recurso de ESA transacción mediante su `correlationId`/ID único, o
   que el conteo filtrado propio no cambió.
5. Para aislamiento RLS, comprobar que el tenant activo no ve IDs concretos del
   tenant ajeno y que sí ve los fixtures propios esperados; no usar el total
   global del tenant como sustituto.
6. Mantener intactas las pruebas de actor `HUMAN_ACCOUNT`, `actorRole=NULL`,
   home/target distintos, FKs restrictivas, append-only, ausencia de DELETE,
   FORCE RLS y fail-closed sin GUC.
7. No borrar eventos para lograr verde y no introducir orden dependiente entre
   tests.

## 4. Aislamiento MP02 futuro

En `support-access.service.db.test.ts`, preferir un home tenant ficticio y
estable dedicado a la suite MP02, creado/resuelto por código de test bajo la
credencial administrativa. No usar `merdn-mvp` como home tenant de nueva
evidencia MP02.

Condiciones obligatorias:

1. El tenant debe tener código/nombre inequívocamente ficticios y reservados a
   esta suite; no contiene identidades ni datos reales.
2. Reutilizar el tenant dedicado si ya existe. No crear uno nuevo en cada test o
   ejecución.
3. Mantener al menos dos tenants objetivo ficticios distintos para probar
   home→target, cambio de GUC y cross-tenant denial.
4. Seguir ejecutando el servicio bajo `merdn_runtime` y RLS real.
5. Los objetos no inmovilizados por auditoría pueden limpiarse solo por IDs
   registrados por la ejecución. Los inmovilizados permanecen; no intentar
   borrar sus eventos, dependencias o tenant.
6. Minimizar nueva acumulación: una sola ejecución por secuencia autorizada,
   evitar duplicar escenarios equivalentes y conservar cleanup por IDs para
   casos fallidos/no auditados.
7. No envolver casos confirmados en rollback para fingir ausencia de evidencia.
8. No cambiar expectativas funcionales, debilitar auditoría ni sustituir
   PostgreSQL/RLS por mocks.
9. Si mover el home tenant exige cambiar runtime, schema, migración o política,
   no hacerlo: mantener MP02 test sin esa mejora, documentar el motivo y aplicar
   únicamente la corrección MP01.

## 5. Allowlist exacta

- `apps/api/test/eloisa-admin-support-foundation.db.test.ts`
- `apps/api/test/support-access.service.db.test.ts`

Cualquier archivo adicional bloquea la corrección. En particular, quedan fuera
de alcance todos los archivos bajo `apps/api/src/support-access/`, Prisma,
migraciones y configuración.

## 6. Prohibiciones

- no eliminar/modificar eventos existentes;
- no desactivar triggers append-only;
- no debilitar o eliminar FKs;
- no alterar RLS, grants, schema o migraciones;
- no resetear, truncar o recrear la base;
- no `deleteMany({})` ni cleanup global;
- no tocar services, guards, módulos, contratos ni comportamiento runtime;
- no añadir skips, retries o tolerancias que oculten fallos;
- no suites completas;
- no commit ni push.

## 7. Secuencia exacta de validación

Ejecutar desde `apps/api`, exactamente en este orden:

### A. MP01 una vez

```text
npx vitest run --config vitest.config.mts test/eloisa-admin-support-foundation.db.test.ts --fileParallelism=false
```

Debe quedar PASS antes de continuar. Si falla, corregir solo las dos pruebas
allowlisted; no ejecutar MP02.

### B. MP02 una vez, solo después de A verde

```text
npx vitest run --config vitest.config.mts test/support-access.service.db.test.ts --fileParallelism=false
```

No repetir MP02 salvo que una corrección posterior cambie realmente su archivo
de test o se descubra un defecto verificable en ese test. Runtime permanece
fuera de alcance.

### C. MP01 una vez más después de MP02

```text
npx vitest run --config vitest.config.mts test/eloisa-admin-support-foundation.db.test.ts --fileParallelism=false
```

Resultado obligatorio: MP01 PASS → MP02 PASS → MP01 PASS.

Después:

```text
npx eslint test/eloisa-admin-support-foundation.db.test.ts test/support-access.service.db.test.ts
git diff --check
git status --short
```

No abrir typecheck o suites no relacionadas: MP02 ya reportó sus checks y esta
Task solo cambia tests.

## 8. Evidencia requerida

- diff limitado a los dos tests;
- identificación exacta de las tres aserciones corregidas;
- técnica usada en cada una: ID/correlation/baseline-delta/fixture scope;
- evidencia de que los 58 eventos existentes no fueron tocados;
- código del tenant home ficticio MP02, sin secretos ni IDs internos;
- conteos PASS de A, B y C en ese orden;
- confirmación de `merdn_runtime`, RLS y auditoría todavía ejercidos por MP02;
- confirmación de cero cambios runtime/schema/migrations.

## 9. Stop conditions

Detenerse si:

1. alguna corrección requiere borrar o reescribir auditoría;
2. una prueba solo puede pasar debilitando FK, trigger, RLS o autorización;
3. aparece un defecto runtime independiente y reproducible;
4. el tenant dedicado exige un cambio fuera de los tests;
5. aparece cualquier archivo fuera de allowlist;
6. A no queda verde tras corregir las aserciones propias;
7. la Task excede 15 minutos: reportar el punto exacto sin ampliar alcance.

READY FOR CLAUDE: YES
ESTIMATED CLAUDE TIME: 15 minutes
