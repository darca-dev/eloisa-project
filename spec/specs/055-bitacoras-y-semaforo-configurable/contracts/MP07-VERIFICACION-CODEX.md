# 055 / MP07 — Verificación de correcciones por Codex

Fecha: 2026-10-22. Estado: **en curso; no aceptación ni cierre**. Base 43d94b1, rama `feat/preentrega-access-hardening`. Implementación por Claude Code; Codex revisa y ejerce los entornos efímeros. Sin Git mutante, despliegue ni migración a la base de aplicación.

## Evidencia de MP07A

- Actualización real desde las 29 migraciones publicadas: se sembraron datos ficticios en el esquema anterior, incluidas dos definiciones del mismo código, dos observaciones con la misma occurrenceKey y dos evidencias legadas. Después se aplicó la migración 30. Se compararon los valores de todas las columnas anteriores de ocho tablas: **12/12 filas conservadas sin cambios**. Las referencias y snapshots históricos quedan NULL, sin reconstrucción inventada; nuevas versiones/evidencias incompletas son rechazadas; la versión legada puede retirarse y la evidencia mantiene append-only. Preflight runtime y limpieza aprobados, exit 0. Evidencia operativa saneada: `.tmp/upgrade055-2026-10-22T21-12-26.985Z.json`.
- FORCE RLS: **6/6**, exit 0, sin omitidas.
- API de bitácoras/criterios/alarmas: ejecución inicial **30 aprobadas / 1 fallida / 0 omitidas**. No se considera cierre del paquete.
- Fundación de cuidado, incluidas nuevas regresiones A09: ejecución inicial **36 aprobadas / 1 fallida / 0 omitidas**. Pasan las barreras reales de revocación (cuenta, concesión, competencia, asignación) en ambos órdenes y las asignaciones cruzadas A→B/B→A. El fallo restante es preparación de un grant que la propia DB prohíbe, descrito abajo; todavía no se acepta la suite.
- Reejecución tras corregir la preparación del grant inválido: fundación **37/37, sin fallos ni omitidas**, run-id `baseline-20261022t212926`, exit 0; provision y cleanup aprobados. El caso espera ahora el rechazo de inserción por la propia DB y luego comprueba los demás destinatarios.
- Unitarias de cuidado ejercidas por Codex con DSN ficticio inutilizable: **98/98**, exit 0. Runner/catálogos/script de gestor: **49/49**, sin fallos ni omitidas, exit 0. Estos resultados son independientes de los comandos no ejecutados por Claude en su entrega.
- API ampliada: **38/39, sin omitidas**, run-id `baseline-20261022t213209`. Pasan todos los escenarios nuevos A01/A03/A04/A07/A09 y el fallo temporal A04 ya está corregido. La única expectativa pendiente es la prueba antigua de cola que supone un solo contexto; los tests A01 ahora conceden al mismo revisor dos contextos adicionales. Debe comprobar el conjunto exacto de tres contextos de fixture, conservando exclusión ajena y filtros de todas las alarmas, no debilitarlo a mera inclusión.
- ESLint focal de módulos, suites y catálogo modificados: exit 0. Prisma validate con DSN ficticio inutilizable: exit 0.
- Reejecución con el conjunto exacto de contextos: API **39/39, sin fallos ni omitidas**, run-id `baseline-20261022t213632`, exit 0, provision y cleanup aprobados. Conserva exclusión de otro contexto y comprueba solo alarmas abiertas en todos los elementos de la cola.

## Revisión de dependencia MP07A → MP07B

Codex revisó la entrega y sus dos seguimientos contra el contrato y ejerció las pruebas anteriores. **MP07A es técnicamente apto como dependencia de MP07B**, que puede comenzar; esto no cierra 055 ni sustituye la aceptación del PO. La revisión confirma definición exacta y revalidación, frontera/consumo de episodios, snapshots y secuencias de enmienda, semáforo sin estabilidad inferida, elegibilidad y orden de locks del destinatario. No hay defecto confirmado pendiente de A01/A03/A04/A07/A09 en el alcance revisado.

Las notas de Claude sobre un retiro de observación sin reemplazo no introducen esa operación: D04.5 y el modelo vigente conservan enmiendas aditivas y no retiran evidencia ni reevaluan por sí solas. La validación de destinatario 400 ocurre antes de consultar la alarma y revierte el trabajo; la autorización denegada del actor conserva su auditoría. No se crea un requisito de sesión para el destinatario ni un flujo de aprobación adicional.

## Corrección pendiente de la ejecución inicial

La regresión `A04: el mismo occurrenceKey entre versiones…` falla en `care-records-alarms.api.test.ts:718`: espera apertura de un evento distinto. La fecha se calcula desde el cierre +200 ms, pero se revalidó una versión DESPUÉS de ese cierre. Esa ocurrencia puede ser anterior a `revalidado.current.activatedAt`, y el motor la excluye correctamente. Corregir la preparación del evento para que sea estrictamente posterior al cierre y posterior o igual a la activación de la nueva versión; mantener las comprobaciones de canónica/consumo/frontera. No relajar el motor ni cambiar la expectativa sin corregir ese tiempo. Reejecutar PostgreSQL después de la corrección.

La suite de la primera ejecución todavía no contenía regresiones HTTP completas de A03 para reemplazo compatible, cambio de unidad, cambio de tipo y opciones CHOICE. Deben demostrar revalidación pendiente, ausencia de evaluación con la regla anterior, rechazo de una validación nueva con id antiguo, revalidación explícita y conservación de historial/evidencia; además del 400 por falta de id. La actualización real prueba la conservación del legado y sus guardas, pero no sustituye estos recorridos de aplicación.

En la regresión A09 `no es elegible sin experiencia aprobada, con emisor no manager…`, la preparación intenta crear una concesión emitida por una cuenta que nunca fue manager (`care-context-foundation.db.test.ts:1372`). El trigger la rechaza correctamente con 23514. La prueba debe esperar ese rechazo y continuar los demás casos; no debilitar la DB ni insertar una procedencia imposible para probar la política.

## Pendiente de verificación

MP07B completo, navegador con dos pacientes/revisor no administrador, baseline final y revisión conjunta de los diez hallazgos. Las comprobaciones informadas por otro ejecutor no se presentan como ejecución independiente de Codex.

## 2026-10-23 — Auditoría del árbol parcial MP07B

Dictamen: **MP07B no apto para cierre**. Informe y correcciones requeridas en `MP07B-REVISION-CODEX.md`. Claude agotó su sesión tras 163 turnos (`is_error: true`) sin entregar `MP07B-FROM-CLAUDE.md`; no se trata como entrega final.

- Defectos confirmados: callbacks de mutación incompatibles (B01/P1); borrado de otros formularios por ronda global (B02/P2); tipos DOM incorrectos en pruebas del API (B03/P2); ausencia de interacción de paginación exigida (B04/P2); lint fallido (B05/P3); paginación HTTP 503 por transacción vencida (B06/P1).
- Verificación actual: web 20 errores de tipos, API 3 errores de tipos, lint un error; unitarias web 127/127 y API/OpenAPI 155/155. No navegador/axe ni baseline completa sobre este árbol con bloqueos conocidos.
- PostgreSQL aislado `baseline-20261023t154721`: fundación 37/37, FORCE RLS 6/6, API 42/43 (falla el caso de >200 candidatos; timeout de transacción de 5000 ms y HTTP 503), sin omitidas. Provision/preflight/limpieza correctos. Evidencia saneada `.tmp/db055-2026-10-23T15-47-21.254Z.json`. El intento previo con Docker apagado no ejecutó tests y no se interpreta como defecto de producto.
- Gates actuales: 0 errores/19 avisos históricos; strict 0/0. La verificación previa MP07A conserva su alcance; no certifica la implementación parcial MP07B.
- Repetición API sola `baseline-20261023t155027`: mismo fallo 503/timeout de 5000 ms, 42/43 sin omitidas, provision y cleanup correctos; evidencia `.tmp/db055-2026-10-23T15-50-27.167Z.json`. Escáner de secretos: exit 0, 1392 archivos versionables, sin hallazgos.

Codex actualiza solo documentación de auditoría/estado y ejerce entornos de prueba aislados. No cambia producción, base de aplicación, prototipo ni Git, y no marca aceptación del PO.

## 2026-10-23 — Nueva entrega MP07B y revisión de la propuesta

Ya existe `MP07B-FROM-CLAUDE.md`. El seguimiento de `MP07B-REVISION-CODEX.md` sustituye el estado parcial anterior sin borrar su evidencia. Tipos web/API y lint focal exit 0; web 127/127 y API/OpenAPI 169/169. Revisión especializada de la optimización de permisos sin defecto confirmado de aislamiento, con límite de cobertura indicado en el informe.

PostgreSQL `baseline-20261023t181840`: fundación 37/37, FORCE RLS 6/6, API 43/43 (ahora pasa B06), sin omitidas y con provision/preflight/cleanup correctos. Evidencia `.tmp/db055-2026-10-23T18-18-40.486Z.json`.

Navegador `baseline-20261023t182027`: suite fallida en beforeAll, exit 1, 0 ejecutadas y 11 omitidas. B07: el fixture intenta crear dos registros HOSPITAL en el mismo tenant, contraviniendo la unicidad tenant/experiencia. No es un fallo del aislamiento de Docker ni una prueba de interfaz aprobada. Cleanup y terminación de procesos temporales propios correctos; evidencia `.tmp/browser055-2026-10-23T18-20-27.403Z.json`. Accesibilidad y baseline final pendientes después de corregir ese fixture. MP07B y 055 no se cierran.

## 2026-10-23 — B07–B09 verificados; B10 de regresión web

Claude entregó B07 conservando administrador único y revocación clínica real por API. Primer Chromium `baseline-20261023t203200`: 9/12, tres fallos y cero omitidas. Codex especificó B08 (selectores/espera real de POST) y B09 (conservar conteo final) en `MP07B-SEGUIMIENTO-NAVEGADOR.md`; Claude corrigió las tres rutas acotadas y entregó exit 0.

Nuevo Chromium `baseline-20261023t204020`: **12/12, 0 fallos/omisiones**, exit 0, incluyendo móvil, teclado, paginación >200/50/20 y axe sin serias/críticas en superficies probadas. Provision/preflight/cleanup correctos; `.tmp/browser055-2026-10-23T20-40-20.391Z.json`. Build shared/API/web exit 0 con DSN ficticio inutilizable/API puerto1; lint focal exit 0, runner/catálogos/gestor 49/49.

Baseline `codex055-corrections` falló en web1900/1902 después de provision/tipos/API51/51 correctos; cleanup correcto. `.tmp/final055-2026-10-23T20-42-38.902Z.json`. Las etapas posteriores no corrieron. B10 acota los dos tests consumidores con expectativas anteriores en `MP07B-REGRESION-WEB.md`; no modificación de producción ni relajación de guardas. Pendiente entrega y baseline completa para cierre técnico.
