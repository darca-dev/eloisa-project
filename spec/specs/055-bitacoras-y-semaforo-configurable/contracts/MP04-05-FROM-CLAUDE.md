# 055 / MP04–MP05 — Entrega del implementador (Claude Code)

Fecha: 2026-10-21. Contrato: `MP04-05-CRITERIOS-ALARMAS-Y-SEMAFORO.md`, redactado por Claude Code por delegación del Product Owner. Estado: **implementado y verificado localmente** (unitarias, API contra PostgreSQL aislado, batería DB completa, web). Pendiente: ratificación de D04.5 por el PO, auditoría de Codex, E2E de navegador con axe y vía de concesión de permisos (§5).

## 1. Qué hace

- **Criterios individuales** (`care_alarm_criterion` con identidad estable y `care_alarm_criterion_version` inmutable). Solo un profesional con MANAGE_RULES y competencia vigente define, versiona o retira. El dato se cita por código estable; la comparación es estructurada (EQ/NEQ/GT/GTE/LT/LTE para números, EQ para sí/no, IN para opciones). El visitador fija valor, N veces, ventana en minutos, clasificación y vigencia opcional. **No hay ningún valor por defecto ni sugerido.** La activación la fija la base y es prospectiva.
- **Motor síncrono** (`CareAlarmEngine`): se ejecuta dentro de la transacción que crea el registro, después del bloqueo de MP01 y del advisory lock. Aplica la ventana inclusiva sobre la recepción; cada `occurrenceKey` cuenta una vez y solo cuentan las canónicas; usa el valor efectivo; la evidencia consumida por un episodio no vuelve a contar.
  - Con el episodio abierto, una coincidencia nueva se agrega como evidencia; no se crea otra alarma.
  - Tras el cierre, solo un conteo nuevo completo abre otro episodio, enlazado con `previousAlarmId`.
  - El índice único parcial `care_alarm_open_episode_unique` sostiene en base «una alarma automática abierta por criterio».
- **Correcciones (D04.5, política conservadora pendiente de ratificar)**: una enmienda no dispara el motor y no crea, cierra ni rebaja alarmas. Las evaluaciones futuras usan el valor corregido, y la evidencia marca «corregida después: revisar».
- **Retiro**: no cierra alarmas abiertas y deja de evaluar.
- **Semáforo por contexto**: ROJO, AMARILLO, PENDIENTE, ESTABLE o SIN_CRITERIOS, siempre con texto y conteos. Nunca verde por falta de datos.
- **Cola de revisión** (`GET /api/v1/care/review-queue`): todos los contextos donde MP01 confirma REVIEW_ALARMS, decididos en una sola transacción. Se audita como lectura del directorio.
- **Interfaz**:
  - el visitador tiene un gestor de criterios sin valores sugeridos;
  - quien puede ver o revisar tiene el semáforo con texto;
  - el detalle de la alarma muestra la evidencia y la historia;
  - Hospital tiene la cola de revisión en «Semáforo de alarmas»;
  - el aviso al guardar un registro dice si se generó una alarma.

## 2. Archivos

- **Base**: `prisma/schema.prisma` (3 modelos, 3 enums, 2 eventos y relaciones de episodio) y NUEVA `prisma/migrations/20261021140000_care_alarm_criteria/migration.sql`, que también reemplaza el CHECK de auditoría para incluir los eventos de criterio.
- **API nuevos**: `care-criteria/{criterion-evaluator.ts,criterion-evaluator.test.ts,care-alarm-engine.ts,care-criteria.contract.ts,care-criteria.request.ts,care-criteria.service.ts,care-criteria.controller.ts,care-criteria.module.ts}`.
- **API modificados**:
  - `care-records/*`: el motor se invoca al crear y se devuelve `evaluation`;
  - `care-alerts/*`: evidencia en el detalle;
  - `care-context/{care-context.service.ts,care-context-directory.service.ts,care-context-audit.service.ts}`: `withReviewableContexts`, `listAuthorizedWithin` y los tipos de evento;
  - `app.module.ts`.
- **Pruebas y catálogos**:
  - `test/care-records-alarms.api.test.ts`: 7 casos nuevos;
  - `test/openapi.test.ts`: 4 rutas;
  - `test/force-rls-catalog.db.test.ts`: regenerado a 45 tablas y 50 policies;
  - `scripts/testing/{test-db-provision,test-db-preflight}.mjs` y `tests/testing/baseline-catalog.test.mjs`: 28 migraciones, 45 tablas, 50 policies.
- **Web**: `features/care/{careClient.ts,careCriteriaViews.tsx,careViews.tsx,CareWorkspace.tsx,care.module.css,care.test.tsx}`.

## 3. Verificación

| Prueba | Resultado |
|---|---|
| `tsc` shared/api/web (mismo argv que la etapa `typecheck`) | exit 0 / 0 / 0 |
| eslint focal | exit 0 |
| `npm run build:api` | exit 0 |
| API `vitest src/care-context src/care-alerts src/care-criteria test/openapi.test.ts` | 122/122 |
| Evaluador puro | 10/10 |
| Runner aislado `mp04-055-api1`: `db/care-records-alarms.api.test.ts` | 25/25 (7 de MP04–MP05) |
| Runner aislado `mp04-055-dbsweep`: provision → **28 etapas DB** + openapi → cleanup | todas pass; 651 pruebas DB + 56 OpenAPI, 0 fallos, 0 omitidas |
| Web `vitest run` | 1873/1874; la única falla es la previa de `branding.test.tsx`, ajena |
| Web `care.test.tsx` | 28/28 |
| secretos / diff-check / SDD estricta | OK / exit 0 / 0 errores, 0 avisos |

Corrección de una afirmación anterior: durante MP02–MP04, varios «0 errores de tipos» se obtuvieron filtrando la salida coloreada de `tsc` con un patrón que no coincidía. Al compilar aparecieron 8 errores reales (6 en la API, 2 en la web). Se corrigieron, y desde entonces la verificación es por código de salida. También quedó corregida la entrega de MP02–03.

## 4. Riesgos y decisiones locales

1. **D04.5**: la política de correcciones (§1) debe ratificarla el Product Owner.
2. **Iniciador de la automática**: la alarma se atribuye al autor del registro que la desencadenó, porque `initiatedByHumanAccountId` es obligatorio y no existe actor de sistema en esta familia. Esa persona la ve en «mis solicitudes».
3. **Severidad ESTABLE en un criterio**: se admite porque D03 deja la clasificación al visitador.
4. **Coste**: el directorio y la cola deciden con MP01 cada contexto y acción (hasta 200 contextos por consulta). Es suficiente con datos ficticios; para volumen real hará falta medir.
5. **Desfase de reloj**: la activación la fija la base, por lo que una ocurrencia fechada antes de la activación con el reloj de la API no cuenta. Es prospectivo por diseño (D04.3).

## 5. Pendiente — requiere decisión o entorno

- **Vía de concesión de permisos.** MP01 difirió expresamente la API de gestión de organizaciones, managers, contextos y concesiones. Hoy solo se crean con provisión controlada (fixtures de prueba). Sin esa vía, la interfaz funciona pero ninguna persona real recibe un espacio de cuidado. Decidir quién y cómo concede (D02 dice «administración institucional humana identificada con evidencia») es una decisión de autorización (CLAUDE.md §4) que no tomé.
- **E2E de navegador y axe.** Requieren construir imágenes nuevas de API y web y levantar la pila desechable `merdn-admin040-e2e` con su proveedor de identidad, y además dependen del punto anterior para dar permisos a cuentas reales del IdP. No ejecutados.
- La baseline `--stage all` sigue bloqueada por las dos fallas previas ajenas (`branding.test.tsx` y `human-auth.config.test.ts`).
