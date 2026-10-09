# S00-MP06 — procedencia de nuevos registros del flujo real

Updated-At: 2026-10-09
Related-Spec: 039-termino-s00-base-y-baseline
Status: PROPOSAL — decisión de datos pendiente, no READY

## Problema, alternativas y recomendación

El PO requiere funcionamiento real con botones de usuarios test. La interfaz ya se corrigió, pero el enum Prisma AccessRequestSource solo admite TEST_DATA; backend lo fija y cliente rechaza cualquier otro origen. Ocultar el aviso sin corregir el contrato dejaría todos los registros nuevos clasificados como pruebas.

Se recomienda añadir SELF_REGISTRATION para las solicitudes nuevas enviadas por el formulario, incluyendo cuentas reales de usuarios test cuando se pruebe el circuito. Describe el canal de registro, no certifica identidad, veracidad clínica ni permisos. Los datos test de precarga siguen identificados visualmente como usuarios test; el campo source no se usa para dar privilegios ni para afirmar que una persona es real. TEST_DATA se conserva para los históricos/fixtures técnicos existentes; no se reclasifica ninguna fila ni se inventa un detector de personas test mediante nombres, documentos o campos del cliente.

Alternativas descartadas: renombrar TEST_DATA o actualizar históricos destruye linaje; permitir cualquier string pierde contrato cerrado; aceptar source del cliente permite suplantar procedencia; introducir ahora otro modelo de clasificación de pacientes/tenant amplía el alcance sin decisión. No se añade una bandera que conceda acceso por ser test.

## Contrato propuesto y límites

1. Migración nueva aditiva que agrega SELF_REGISTRATION al enum existente. Conservar TEST_DATA y el default heredado para compatibilidad de fixtures, sin UPDATE/DELETE de datos, SQL de permisos o tablas nuevas. El servicio siempre escribe explícitamente SELF_REGISTRATION en altas nuevas; reuso idempotente conserva source original.
2. DTO/contrato documentan ambos orígenes cerrados. Cliente acepta exactamente SELF_REGISTRATION y TEST_DATA para compatibilidad de respuestas históricas, sin relajar estado PENDING, tres claves ni referencia. El cuerpo público sigue sin admitir source, tenant, rol, decisión o privilegio. El servidor sigue siendo autoridad.
3. Catálogo de migraciones de baseline pasa de 17 a 18 mediante actualización explícita, no omisión del nuevo archivo. Permanecen 27 tablas/28 policies, ownership, enforce, RLS/FORCE, matriz y cleanup. MP04C continúa pendiente; MP06 no lo activa ni presenta baseline verde.
4. Sin cambiar aprobación, identidad OIDC, consentimiento, relaciones, reglas clínicas, retención o tenancy. No se ingresan datos personales reales como fixtures ni se crean cuentas automáticamente durante validación. Nuevos registros reales de producción requieren completar la aceptación S01; esta tarea corrige únicamente procedencia y compatibilidad.

## Allowlist propuesta

- prisma/schema.prisma: solo nuevo miembro del enum.
- prisma/migrations/20261009170000_access_request_self_registration/migration.sql: nuevo archivo aditivo, sin editar históricos.
- apps/api/src/access-requests/access-request.service.ts, access-request.contract.ts, access-request.dto.ts: source explícito y documentación, sin otras reglas.
- apps/api/test/access-requests.test.ts, access-request-review.test.ts, openapi.test.ts: nuevas altas frente a históricos; no reemplazar todos los fixtures indiscriminadamente.
- apps/web/src/features/access/accessRequestClient.ts y accessRequestClient.test.ts: dos orígenes exactos/compatibilidad y negativas.
- scripts/testing/test-db-provision.mjs, tests/testing/baseline-catalog.test.mjs, tests/testing/test-db-lifecycle.test.mts: catálogo exacto de 18 migraciones; sin cambios a guard/roles.
- Documentación 039/decisiones/handoffs/runbook/plan/índice. Prohibidos prototipo, archivos históricos, main, secretos, permisos, reglas y cambios ajenos.

## Aceptación, riesgos y operación

Gates antes de código; Prisma validate/generate, tipos/build API-web, lint/scanner, contratos de altas y legado, origen arbitrario del cliente rechazado, respuesta desconocida no aceptada, autorización/tenant/revisión sin cambios; suite web y pruebas de catálogo. Migración aislada y verificación de ambos valores sin borrar datos; distinguirla de la matriz completa pendiente por MP04C.

El retorno registra diff, nuevo SHA, conteos, evidencia minimizada, compatibilidad e imagen exacta. Aplicar primero frontend compatible con ambos valores, después migración y API que escribe el nuevo origen. No actualizar API contra enum viejo. La operación sobre PostgreSQL compartido de aplicación se especificará y revisará con identidad exacta/configuración/backup privado antes de aplicarla; esta propuesta no permite improvisarla ni tocar otros recursos. Sin despliegue de producción.

Rollback conserva valores/filas: volver al servicio anterior no reclasifica ni elimina SELF_REGISTRATION; requiere cliente que siga admitiendo ambos valores y compatibilidad Prisma. No DROP TYPE, reset o restauración destructiva. Ante un fallo fuera de allowlist se documenta y detiene su parte. Git local bajo autorización vigente, no push/main/merge.

## Decisión requerida

Aprobar la semántica SELF_REGISTRATION para nuevas solicitudes y la conservación de TEST_DATA histórico, junto con este alcance de implementación/migración aislada. AGENTS.md §6 exige aprobación en decisiones materiales de datos; §22.2 no permite resolver en silencio el contrato antiguo exclusivamente TEST_DATA. La petición de funcionamiento real define el objetivo; esta propuesta concreta la procedencia sin sustituir el linaje histórico ni inventar nuevas reglas.
