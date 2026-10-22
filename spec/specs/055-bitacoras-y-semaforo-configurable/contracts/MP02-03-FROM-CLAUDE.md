# 055 / MP02–MP03 — Entrega del implementador (Claude Code)

Fecha: 2026-10-21. Contrato: `MP02-03-BITACORAS-Y-MANUALES.md`. Estado: **implementado y verificado localmente** (unitarias, API contra PostgreSQL aislado, web). Pendiente: auditoría de Codex, E2E de navegador y revisión de accesibilidad con axe (§7).

## 1. Autorización y alcance

- El Product Owner ordenó «termina el semáforo» y «después de terminar este semáforo continúa con los demás, acceso total». Esta sesión lo interpreta como autorización para implementar MP02–MP03 sin esperar la aceptación de MP01 por Codex. **No** lo interpreta como autorización de commit, push ni despliegue (CLAUDE.md §12), que no se nombraron.
- La allowlist de MP02–03 era una propuesta a concretar tras auditar MP01. Archivos efectivamente tocados en §3; todos están dentro de esa propuesta salvo los marcados con (*).

## 2. Qué hace

- **Directorio de contextos propios** (`GET /api/v1/care/contexts`). Usa los GUC transaccionales `merdn.discovery_account_id` y `merdn.discovery_patient_id`, que fija el servidor y limpia siempre. Tres políticas solo de SELECT (`care_authorization_discovery`, `patient_care_context_discovery`, `organization_discovery`) muestran metadatos de las concesiones propias y de los contextos del paciente propio. Cada candidato se vuelve a decidir con la política de MP01 antes de mostrarlo. Se audita `CARE_CONTEXT_DIRECTORY_READ` sin organización. Probado: con el GUC de descubrimiento no se lee ningún registro, alarma ni observable.
- **Recurso por ruta, organización por el servidor**: el nuevo `withAuthorizedOwnContext` recibe solo `:contextId`, resuelve la organización con el directorio y admite varias acciones en orden de preferencia, con una sola decisión auditada.
- **Bitácora**: observables versionados (BOOLEAN/NUMBER/CHOICE), validados solo con MANAGE_RULES y competencia; la versión nueva retira la anterior en la misma transacción. Registros atribuidos: la fuente se deriva del actor y la recepción la fija la base. Observaciones tipadas (NUMBER como decimal exacto en texto; sin NaN, infinito, exponente ni conversión silenciosa). Ocurrencia futura rechazada. Enmiendas append-only, solo del autor, con `expectedSequence` (409 ante carrera).
- **Alarma manual**: `REQUEST_REVIEW` es el único motivo; nace NUEVA y sin clasificación. Se muestra el texto de recepción aprobado en D03. No se aceptan severidad, estado, actor, tenant ni paciente del cliente.
- **Seguimiento**: NUEVA→EN_GESTION→RESUELTA→CERRADA, y reapertura con motivo. Clasificación y asignación son ejes separados. CAS por `version` (409). El destinatario de una asignación debe tener REVIEW_ALARMS con competencia vigente. El iniciador puede informar la resolución sin cambiar estado ni severidad.
- **Idempotencia**: recibo único por contexto, actor, acción y clave, con huella SHA-256 del contenido canónico. El mismo intento devuelve el mismo recurso; la misma clave con otro contenido devuelve 409. Probado con dos envíos simultáneos: una alarma, una transición CREATE y un evento de auditoría.
- **Serialización**: advisory lock por tenant, organización y contexto, tomado dentro del trabajo, después de los bloqueos de MP01.
- **Base**: append-only (también para el propietario) en registros, observaciones, enmiendas, transiciones y recibos. Una definición solo cambia para retirarse; la alarma solo en sus columnas de ciclo de vida, con `version + 1`. Triggers fijan la creación, la recepción y `updatedAt`. Un CHECK de auditoría exige actor humano, organización y recurso en las mutaciones `CARE_*`.
- **Interfaz** (`apps/web/src/features/care/`): una sola implementación montada en los cuatro portales. Lo que se ve lo deciden las acciones que concede el servidor, no el perfil. Sin almacenamiento del navegador; al cambiar de contexto se limpia el estado y se descartan respuestas obsoletas; la clave de idempotencia se conserva entre reintentos. La severidad siempre se escribe con palabras; «Pendiente de clasificación», nunca verde; la recepción no se presenta como atención.

## 3. Archivos

API nuevos: `care-context/care-context-directory.service.ts`, `care-context/care-mutation.ts`, `care-context/care-request.ts`, `care-records/*` (contrato, request, servicio, controlador, módulo), `care-alerts/*` (máquina de estados, contrato, request, servicio, controlador, módulo, `care-alerts.unit.test.ts`).
API modificados: `care-context/care-context.service.ts` (núcleo común, `withAuthorizedOwnContext`, `listDirectory`), `care-context/care-context-audit.service.ts` (mutación y directorio), `care-context/care-context.module.ts`, `app.module.ts`.
Base: `prisma/schema.prisma` (7 modelos, 7 enums, 6 eventos) y NUEVA `prisma/migrations/20261021130000_care_records_manual_alarms/migration.sql`.
Pruebas y catálogos: `apps/api/test/care-records-alarms.api.test.ts` (nueva), `care-context-fixtures.ts` (token de sesión), `openapi.test.ts` (8 rutas; se desbloquea `alert` con comentario; `semaforo` y `triage` siguen prohibidas), `force-rls-catalog.db.test.ts`, `scripts/testing/{run-baseline,test-db-provision,test-db-preflight}.mjs`, `tests/testing/{run-baseline.test.mts,baseline-catalog.test.mjs}`.
Web nuevos: `features/care/{careClient.ts,careViews.tsx,CareWorkspace.tsx,care.module.css,care.test.tsx}`.
Web modificados: `hospital/HospitalShell.tsx` (en modo real, `alarmas` monta el espacio con `h1` «Semáforo de alarmas»; el modo demo local no cambia), `hospital/HospitalPendingModule.tsx` (se retira `alarmas`), `caregiver/CaregiverAccessPortal.tsx` (el espacio de cuidado sustituye el montaje de la demo de liquidaciones; el archivo de la demo se conserva), `paciente/PacienteExperience.tsx` (*), `profesional/ProfesionalPortal.tsx`, `caregiver/caregiverAccessPortal.test.tsx`, `paciente/paciente.test.tsx` (*).

(*) Estos dos archivos tenían el atributo de solo lectura de Windows, igual que otros 347 sin tocar desde la copia del proyecto. Se le quitó el atributo solo a ellos para editarlos. Hallazgo para Codex: confirmar que ese atributo es un artefacto de la copia y no una protección deliberada.

## 4. Decisiones locales y desviaciones

1. **Tolerancia de reloj en la base**: `occurredAt <= receivedAt + 2 minutos`. La API rechaza de forma estricta cualquier ocurrencia futura con su reloj; la base tolera solo el desfase entre Windows y Docker que ya causó el fallo de MP01.
2. **Visibilidad mínima**: quien solo tiene CONTRIBUTE_RECORDS ve únicamente sus registros, y quien solo tiene REQUEST_ALARM ve únicamente sus solicitudes. VIEW_RECORDS y REVIEW_ALARMS ven el contexto completo.
3. **Clasificar exige motivo**, además de resolver, cerrar y reabrir.
4. **Límite de abuso**: se reutiliza `HumanAuthRateLimitGuard` (por IP, 20 por ventana por defecto, compartido con la superficie humana). Puede quedarse corto para un uso intenso; queda como riesgo operativo para decidir.
5. **Asignación desde la interfaz**: solo «Asignármela». La API admite otro revisor verificado, pero no existe un listado de revisores elegibles.
6. **Recepción manual**: no se envía WhatsApp, correo ni ninguna otra notificación, y nada se presenta como visto.

## 5. Verificación

| Prueba | Resultado |
|---|---|
| API typecheck / lint focal | **Corregido**: la primera versión de esta entrega decía «0 errores», pero filtraba la salida coloreada de `tsc` con un patrón que no coincidía. Al compilar aparecieron 2 errores reales de tipos en `care-records.service.ts` (literal `status` ensanchado). Se corrigieron y ahora se verifica por código de salida: `tsc` api/web/shared exit 0, eslint exit 0 |
| `vitest src/care-context src/care-alerts` | 56/56 |
| `vitest test/openapi.test.ts test/application-composition.test.ts` | 58/58 |
| Runner aislado `mp02-055-mig1`: provision (27 migraciones; 42 tablas con RLS+FORCE y 47 policies verificadas por el provisionador), `force-rls-catalog` 6/6, `care-context-foundation` 28/28, cleanup | todo pass |
| Runner aislado `mp02-055-api3`: `db/care-records-alarms.api.test.ts` | **18/18**, 0 omitidas; cleanup pass |
| `node --test` runner y catálogo | 41/41 y 4/4 |
| Web `vitest run` | 1859/1860; la única falla es la previa de `branding.test.tsx`, ajena |
| Web `care.test.tsx` | 24/24 |
| Web typecheck / lint focal | `tsc` exit 0; eslint exit 0 (verificado por código de salida) |

## 6. Pendiente y no ejecutado

- **E2E de navegador y axe no ejecutados**: requieren la pila completa (API, web y proveedor de identidad) con cuentas ficticias aprovisionadas. Lo comprobado es la semántica estática (etiquetas, `fieldset`/`legend`, región viva, `role="status"`, foco visible en CSS, severidad textual), no un recorrido real con teclado y lector de pantalla.
- La baseline completa sigue sin salir verde de punta a punta por las dos fallas previas ajenas (`branding.test.tsx` y `human-auth.config.test.ts`).
- MP02–03 no es el motor automático: queda para MP04.
