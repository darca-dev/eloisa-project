# Plan 009 - Hospital · Pacientes (API y vista conectada)

## Resumen

**RETROSPECTIVO.** Este plan no propone trabajo: describe cómo se ejecutó una
capacidad ya construida, para que la decisión y su coste queden trazables.

Dos commits en `develop`, ambos del 2026-08-22: la Task Specification y una única
implementación de 45 archivos y 9.734 líneas añadidas. Después, un paquete de
corrección de Codex que solo tocó dos archivos de prueba y dejó dos *gates*
diferidos que siguen abiertos hoy.

## Contexto técnico

Es la primera superficie institucional del repositorio que devuelve datos
NOMINALES de personas. Todo lo anterior era interfaz demostrativa o agregado sin
nombres.

Esa condición fijó la forma del trabajo: en lugar de exponer los modelos de
Prisma, se declaró un contrato propio (`hospital.contract.ts`) cuya cabecera
enumera qué está PROHIBIDO devolver y qué NO es esta superficie. La minimización
no se aplicó en el borde —donde se puede saltar— sino en la capa de datos, con
dos selecciones cerradas de columnas, y en funciones puras de proyección que se
prueban sin infraestructura.

Se reutilizó, sin duplicar: `Person` y `Patient` de la spec 007 siguen siendo las
únicas entidades de persona y paciente, y la identidad, la sesión, la cookie y la
auditoría institucionales de la spec 008 se comparten con la Alcaldía. Lo único
propio es un rol disjunto y una superficie disjunta.

La migración fue deliberadamente aditiva y mínima: un valor de enum de rol,
cuatro tipos de evento de auditoría y la relajación de un check. Ni una tabla, ni
una columna, ni un índice.

## Fases de implementación (ejecutadas)

1. **Task Specification** — `9294e88`, «Add Hospital CORE-01 task», 1 archivo:
   `tasks/TASK-HOSPITAL-CORE-01.md`. Define alcance exacto (§4), archivos
   autorizados (§5), prohibiciones (§6), contrato API (§8), reglas de sesión,
   rol, tenant, RLS y auditoría (§9), conexión frontend (§10) y pruebas
   obligatorias (§12).

2. **Implementación** — `30fb378`, «Implement Hospital CORE-01», 45 archivos:

   - Base de datos: `prisma/schema.prisma` (+17 líneas),
     `prisma/migrations/20260822140000_hospital_core_01/migration.sql` (96
     líneas) y `prisma/migrations/ROLLBACK-hospital_core_01.sql` (100 líneas).
   - API, contrato y lecturas: `hospital.contract.ts` (322),
     `hospital-patients.controller.ts` (331), `hospital-patients.service.ts`
     (599), `hospital-patients.query.ts` (325),
     `hospital-patients.projection.ts` (365), `hospital-patients.dto.ts` (321),
     `hospital.module.ts` (29) y el montaje en `app.module.ts`.
   - Autorización y auditoría: `hospital-patient-viewer.guard.ts` (120) y
     `hospital-patient-access.guard.ts` (148), más la generalización del
     aprovisionamiento institucional en `institutional-auth.config.ts` (+186) y
     los eventos hospitalarios en `institutional-audit.service.ts` (+122).
   - Contexto de sesión: `GET /api/v1/institutional/sessions/current` en
     `institutional-auth.controller.ts` (+109), consumido por
     `hospitalInstitutionClient.ts` (126) y por el topbar.
   - Web: `hospitalPatientsClient.ts` (399), `HospitalPatients.tsx` (reescrita),
     `HospitalPatientsPieces.tsx` (reescrita), `hospitalPatientsConfig.ts` (78) y
     `hospitalPopulationTypes.ts` (82).
   - Pruebas: `hospital-patients.api.test.ts` (1.100),
     `hospital-patients.projection.test.ts` (383),
     `hospital-patients.query.test.ts` (307),
     `hospital-institutional-auth.api.test.ts` (321), `hospital-fixtures.ts`
     (212), `hospital-patient-viewer.guard.test.ts` (167),
     `hospitalPatientsClient.test.ts` (289), `hospitalPatients.test.tsx`
     (reescrita) y `hospitalShell.test.tsx` (108).
   - En el mismo commit entró `tasks/TASK-HOSPITAL-CORE-01-CORRECTION.md`.

3. **Corrección de alcance** — recogida en
   `TASK-HOSPITAL-CORE-01-CORRECTION.md`, limitada a dos archivos de prueba:
   `apps/api/test/health.api.test.ts`, que dejó de esperar `404` en
   `/api/v1/hospital/patients` y pasó a exigir `401`, y
   `apps/web/src/features/hospital/hospitalAlcance.test.ts`, que sustituyó la
   regla «Hospital sin red» por una allowlist exacta de clientes autorizados.

**Fuera de este plan pero visible en el árbol de archivos:** la spec 015 recuperó
la estructura visual de `HospitalPatientsPieces.tsx` en `c9a1195` sin tocar la
fuente de datos, y la spec 010 amplió `hospital.contract.ts` y
`hospital.module.ts` con la superficie de Operaciones.

## Dependencias

- **Spec 001** — monorepo, NestJS, Next.js, Prisma, validación de entorno.
- **Spec 003** — la composición aprobada de la vista Pacientes, que esta
  capacidad conserva y solo reconecta a otra fuente.
- **Spec 006** — la marca centralizada de la que se compone el aviso de historia
  clínica.
- **Spec 007** — `Person`, `Patient`, dirección, pertenencias, territorio,
  auditoría, tenant en servidor, `withTenant()`, RLS y fail-closed.
- **Spec 008** — identidad y sesión institucionales, cookie, límite de tasa del
  inicio de sesión y el check de auditoría que esta migración relaja.
- **Externas** — PostgreSQL con las cinco migraciones aplicadas hasta
  `20260822140000_hospital_core_01`, y las variables
  `MERDN_HOSPITAL_PATIENT_VIEWER_SECRET` y `MERDN_HOSPITAL_PATIENT_VIEWER_CODE`,
  que hoy no están en `.env.example`.

## Hitos

- **H1 — Rol hospitalario disjunto.** `HOSPITAL_PATIENT_VIEWER` añadido de forma
  aditiva; ninguna sesión municipal emitida se invalida. Fase 2.
- **H2 — Contrato propio con prohibiciones declaradas.** `hospital.contract.ts`
  con la lista de datos prohibidos y la declaración de lo que la superficie no
  es. Fase 2.
- **H3 — Tres lecturas server-side.** Filtrado, orden, conteo y paginación
  resueltos en PostgreSQL; el navegador nunca recibe la población completa.
  Fase 2.
- **H4 — Auditoría no evitable.** Acceso concedido dentro de la transacción que
  sirve los datos; denegación best-effort y sin oráculo. Fase 2.
- **H5 — Vista conectada sin repliegue a fixtures.** Con prueba que verifica la
  ausencia leyendo el código fuente. Fase 2.
- **H6 — Alcance de red del módulo Hospital acotado por prueba.** Fase 3.

## Riesgos (vigentes hoy)

1. **RLS hospitalaria sin verificar.** El aislamiento entre instituciones se
   apoya hoy, en evidencia ejecutada, solo en los filtros explícitos por
   `tenantId` de la aplicación. La segunda barrera existe en la base pero no se
   ha ejercitado para estas rutas. Es un riesgo de producción, no de MVP
   controlado, y así lo declara la corrección de Codex.

2. **La analítica no escala.** Trae en memoria todas las filas del conjunto
   filtrado. Con el volumen sintético medido ya incumple el objetivo de p95
   ≤500 ms por más del triple. Cualquier crecimiento de población lo empeora de
   forma lineal, y no hay índice que ayude porque el coste está en el traslado y
   el recorrido, no en el plan.

3. **El listado ordena por columnas sin índice.** `person.familyNames`,
   `person.givenNames` y `person.birthDate` no están indexadas. Hoy se tolera
   porque el conjunto es pequeño.

4. **Configuración ausente en `develop`.** Sin las dos variables de la identidad
   hospitalaria, la superficie es inalcanzable. El comportamiento es correcto
   —fail-closed— pero silencioso: quien despliegue desde `.env.example` verá
   `401` sin ninguna pista de que falta configurar una credencial.

5. **Ninguna auditoría independiente.** Las decisiones de minimización de esta
   superficie —qué se enmascara, qué no se selecciona, qué no se audita— no
   fueron revisadas por un segundo agente con veredicto registrado. Es la única
   capacidad con datos nominales del repositorio en esa situación.

6. **Deuda de honestidad en la interfaz.** Ocho campos y cuatro gráficos de la
   composición muestran permanentemente «Información no disponible». Es la
   decisión correcta frente a inventar un cero, pero acumula una superficie
   visual que promete módulos que no existen y que envejece mal si no se conectan.
