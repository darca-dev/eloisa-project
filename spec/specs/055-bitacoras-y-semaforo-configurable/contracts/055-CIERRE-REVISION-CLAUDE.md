# 055 — Revisión de cierre técnico (Claude Code)

Fecha: 2026-10-23. La pidió el Product Owner. Rama `feat/preentrega-access-hardening`, base publicada `43d94b1`. Alcance: MP01–MP07 (A01–A10 y B01–B10) frente a AC01–AC12 de `spec.md`.

**Dictamen técnico de Claude: apto para presentar al PO y a la auditoría final de Codex.** No es aceptación del PO ni validación clínica. Tampoco autoriza Git, publicación ni despliegue. Este informe no actualiza la documentación canónica de estado (`tasks.md`, `history.md`, `INDEX.md`, el estado de `spec.md`): según el contrato MP07 §5, esa actualización corresponde a Codex.

## 1. Evidencia ejecutada

Claude ejecutó el navegador y la baseline completa con autorización expresa del PO, como excepción a MP07 §6. Usó los arneses aprobados de Codex sin modificarlos (`.tmp/check-browser055.mjs`, `.tmp/check-baseline055.mjs`), con base efímera, preflight RLS y limpieza. No leyó ni mostró el entorno privado y no tocó la base de la aplicación.

| Verificación | Run / comando | Resultado |
|---|---|---|
| Baseline completa | `codex055-final`, `.tmp/final055-2026-10-23T22-42-22.912Z.json` | **34/34 etapas en pass; 2690 pruebas, 0 fallos, 0 omitidas, exit 0**. Provisión y limpieza correctas |
| — de ella: tipos | etapa `typecheck` | pass |
| — de ella: web | etapa `web` | 1904/1904 |
| — de ella: OpenAPI y API sin DB | `openapi`, `api-no-db-health` | 57/57 y 51/51 |
| — de ella: cuidado en PostgreSQL | fundación / FORCE RLS / API de bitácoras y alarmas | 37/37 · 6/6 · 43/43 |
| — de ella: regresión del resto de dominios | visitas, pacientes, agenda, autenticación, municipio y administración | todas en pass |
| Navegador real (Chromium) más móvil y axe | `baseline-20261023t215834`, `.tmp/browser055-2026-10-23T21-58-34.350Z.json` | **12/12, 0 omitidas, exit 0**; sin violaciones axe serias ni críticas en las vistas auditadas |
| Unitarias API de cuidado y OpenAPI (DSN ficticio) | vitest focal | 169/169 |
| Builds shared/API/web, lint focal, secretos, `git diff --check` | sesión MP07B | exit 0 |
| SDD gate y estricta | `check-sdd-gate.sh`, `validate-sdd.sh --strict` | exit 0; 0 errores |

Comprobaciones del árbol:

- Ninguna migración publicada modificada: `git diff HEAD -- prisma/migrations` vacío; la migración 30 es nueva y aditiva.
- `prototype-claude/` sin cambios.
- Sin operaciones sobre `main` y sin commits de esta tarea.
- La única mención de WhatsApp en el código de cuidado es un comentario que dice que **no** se envía.

## 2. Hallazgos A01–A10

| Hallazgo | Estado | Evidencia principal |
|---|---|---|
| A01 Estabilidad sin clasificación | Cerrado | `SIN_EVALUACION`/`SIN_CRITERIOS`; ESTABLE solo con una clasificación explícita. Evaluador unitario y API PostgreSQL |
| A02 Contaminación entre pacientes | Cerrado | Subárbol por contexto y ciclo; B01 (escritura no abortada y respuesta descartada) y B02 (formulario independiente). Navegador: A→B con POST y detalle retenidos, reintento con la misma clave y una sola fila, borradores |
| A03 Definición y unidad exactas | Cerrado | FK compuesta, guarda de INSERT, `requiresRevalidation`, 400/409. API PostgreSQL y actualización real 29→30 sin reescribir historia |
| A04 Identidad y episodio | Cerrado | Identidad contexto + código + occurrenceKey, frontera `> closedAt`, advisory. API PostgreSQL con duplicados entre definiciones |
| A05 Revisor sin administración | Cerrado | `/hospital/cuidado` con enlace visible. Navegador: revisor sin administración; único administrador con y sin concesión (B07); cuenta ajena y anónima sin datos |
| A06 Paginación sin truncar | Cerrado | Cursores en directorio, cola, bandeja y bitácora; B06 con decisión en una pasada. API con más de 200 candidatos (43/43) y navegador B04 con 11 páginas de cola, 5 de directorio, 56 alarmas con la roja antigua y 23 entradas |
| A07 Evidencia efectiva | Cerrado | Snapshot tipado inmutable; legado indeterminado. API PostgreSQL y vista |
| A08 Ajuste de criterio desde la UI | Cerrado | Versión nueva del mismo `criterionId` con vigencia. Navegador del visitador |
| A09 Destinatario elegible | Cerrado | Prebloqueo ordenado y elegibilidad sin sesión. Fundación P07 con barreras reales y API |
| A10 Mensaje de Hospital | Cerrado | `TEXTO_MOTOR_HOSPITAL` describe el motor síncrono y la revisión humana. Unitarias web |

B01–B10, los hallazgos de las revisiones de MP07B, están corregidos y cubiertos por las ejecuciones de §1.

## 3. Criterios de aceptación de `spec.md` §14

| AC | Veredicto técnico | Base |
|---|---|---|
| AC01 Recuperación de entradas; un envío fallido no confirma | Cumple | API de bitácoras; navegador: el fallo de red muestra «No se pudo confirmar…» y el reintento no duplica |
| AC02 Denegación uniforme; VISITS_VIEW no escribe | Cumple | Política MP01, fundación y API |
| AC03 Regla individual por paciente y versión, sin umbrales precargados | Cumple | A03/A08; la UI no sugiere valores |
| AC04 Límites de conteo y ventana; sin doble conteo | Cumple | Evaluador (límites) y A04 |
| AC05 Sin regla no hay alarma automática ni verde ficticio; manual disponible | Cumple | A01 y API |
| AC06 Alarma manual visible para el Hospital, pendiente de clasificar | Cumple | API y navegador (cuidadora → cola Hospital) |
| AC07 Reintentos y concurrencia sin duplicados ni pérdida del cruce | Cumple | API concurrente y A04; navegador con reintento idempotente |
| AC08 Evidencia reproducible; enmienda o cambio de regla sin cierre silencioso | Cumple | A03/A07; D04.5 se mantiene |
| AC09 Aislamiento de tenant, institución y paciente; roles no clínicos sin acceso | Cumple | FORCE RLS 6/6, dos organizaciones y otro tenant, administrador sin clínica (B07) |
| AC10 Historia y auditoría con versión; informar resolución no borra evidencia | Cumple | API de transiciones y CAS |
| AC11 RLS en runtime, rollback de auditoría, revocación concurrente, accesibilidad | Cumple | Fundación (barreras reales), preflight y axe |
| AC12 Sin canales simulados; no se presenta como validación médica | Cumple | A10; sin mensajes de WhatsApp, IA o escalamiento |

## 4. Riesgos residuales y límites (no bloqueantes)

1. **Validación clínica y datos reales.** Según D06, no hay validación clínica del formulario ni de las reglas, ni están cerrados el fundamento y la retención para datos reales. Todo lo probado usa datos ficticios. No usar con pacientes reales sin una decisión separada.
2. **Rendimiento de B06.** Se resolvió en el entorno de pruebas (43/43), pero no se midió con volumen de producción. Si hiciera falta más, la siguiente palanca, bloquear las concesiones de la página entera, cambia el orden de bloqueo y requiere revisión.
3. **Cobertura de equivalencia de `decideManyWithin`.** La observación de Codex sigue abierta: el spy clona una concesión por acción. Sería mejor añadir concesiones distintas y actores diferentes por acción, y una revocación concurrente en el camino múltiple. No hay un defecto demostrado.
4. **Decisión local de MP07A, pendiente de ratificar.** Un criterio vencido sin alarmas proyecta `SIN_CRITERIOS`, no `SIN_EVALUACION`. Si el PO prefiere lo segundo, es un cambio de producto.
5. **Evaluación síncrona.** El alcance aprobado es D07: sin worker, sin reloj y sin canales externos. S12 no está completo; outbox, Elí y WhatsApp siguen como trabajo futuro.
6. **Excepción de ejecución.** El navegador y la baseline de este informe los ejecutó Claude con autorización del PO. Si la gobernanza exige que Codex las ejecute, se pueden repetir con los mismos arneses.

## 5. Pasos siguientes

1. Codex: auditoría final A01–A10 y AC01–AC12 sobre esta evidencia, y actualización de la documentación canónica (`tasks.md`, `history.md`, `INDEX.md`, estado de `spec.md`).
2. Product Owner: aceptación o rechazo funcional de la 055.
3. Git, PR, merge y despliegue: cada paso requiere autorización expresa e independiente. `main` sigue sin tocarse.
