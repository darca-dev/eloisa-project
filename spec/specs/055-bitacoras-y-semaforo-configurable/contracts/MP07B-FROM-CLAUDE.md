# 055 / MP07B — Entrega de Claude Code (A02/A05/A06/A08/A10 y correcciones B01–B06)

Fecha: 2026-10-23. Task ID `055-MP07B`. Contrato: `MP07-CORRECCIONES-A01-A10.md` §3, §5 y §6. Revisión atendida: `MP07B-REVISION-CODEX.md`. Rama `feat/preentrega-access-hardening`, base publicada `43d94b1`.

**Estado: implementada con verificación pendiente.** B01, B02, B03 y B05 se corrigieron y verificaron con tipos, lint, build y unitarias. B06 se corrigió en código y tiene unitarias nuevas, pero la regresión PostgreSQL que fallaba **NO LA EJECUTÓ Claude**. B04 y las comprobaciones interactivas de B01/B02 quedan preparadas en la suite real de navegador, **NO EJECUTADAS por Claude**. Claude no usó DB, Docker, servidores, navegador, red, Git ni agentes.

## 0b. Seguimiento B10 (2026-10-23, tras la baseline `codex055-corrections` web 1900/1902)

**Estado: implementada con verificación pendiente.** Contrato: `MP07B-REGRESION-WEB.md`. Se tocaron solo `apps/web/src/features/hospital/hospitalAlcance.test.ts`, `apps/web/src/features/paciente/paciente.test.tsx` y este informe. No cambió producción, care, navegador, esquema, migraciones, permisos, dependencias ni configuración. B07–B09 no se reimplementaron ni se revirtieron. El recorrido Chromium 12/12 sin omitidas (móvil, teclado y axe) y los builds son de Codex (`baseline-20261023t204020`), no de esta sesión.

Antes de editar se comprobó en el código que las dos expectativas eran antiguas, no que ocultaran un defecto:

- `HospitalShell.tsx:2` importa `next/link` para el enlace A05 a `RUTA_REVISION_CUIDADO` (`/hospital/cuidado`). Next 16.3.1 ya es dependencia de `apps/web/package.json`.
- En el SSR inicial, `PortalPacienteVista` monta `<CareWorkspace perfil="paciente" />` con `estado = 'cargando'`. Eso pinta `VistaEstadoGeneral` (`careViews.tsx:66`), con `role="status"` y «Buscando sus espacios de cuidado…». La región `aria-live` explícita de `CareWorkspace.tsx:775` está dentro de `EspacioContexto` y solo se monta tras seleccionar paciente (A02). La única región explícita del SSR es la del portal (`#paciente-portal-sesion`).

| Hallazgo | Cambio | Garantías conservadas |
|---|---|---|
| **B10.1** `hospitalAlcance.test.ts:308` rechazaba `HospitalShell.tsx: next/link` | Mapa cerrado `IMPORTS_EXTERNOS_POR_ARCHIVO = { 'HospitalShell.tsx': ['next/link'] }`. Helpers `origenesImportados` (el MISMO parser `from '…'` de antes) e `importsNoAutorizados`. «no importa dependencias nuevas» los usa. Dos casos nuevos: (a) la excepción se usa de verdad, porque el shell importa `next/link`, y el mapa tiene exactamente esa clave y ese valor; (b) con el mismo parser se acepta `next/link` en el shell y se rechazan `HospitalPatients.tsx: next/link`, `HospitalShell.tsx: next/navigation` y `HospitalShell.tsx: axios` | Sin cambios en `IMPORTS_AUTORIZADOS`, sin `next/*` global y sin módulos nuevos. Intactos: `PROHIBIDO_SIEMPRE` (transporte, persistencia, telemetría, entorno), clientes, fachadas, inyección, adaptadores demo y reloj. `Link` sigue en producción |
| **B10.2** `paciente.test.tsx:667` exigía 2 `aria-live="polite"` | El caso se llama ahora «usa UNA sola región viva para sus secciones y el espacio de cuidado anuncia su carga». Exige exactamente 1 `aria-live="polite"` en el SSR. Esa región está antes del espacio de cuidado y es `<p id="paciente-portal-sesion" … role="status" aria-live="polite">`. Dentro de `<section aria-labelledby="cuidado-paciente-titulo">` exige `role="status"` y `TEXTO_ESTADO_GENERAL.cargando`. Ni la sección ni su contenido inicial llevan `aria-live` | No se cambió solo 2→1: se añadieron la identidad de la región del portal y el estado de carga dentro de cuidado. No se monta contexto ni borradores antes de la selección. No hay región envolvente en producción. Los demás casos de accesibilidad del portal no cambian |

Supuesto local: en el estado inicial, el espacio de cuidado no tiene secciones anidadas, así que su contenido se toma hasta el primer `</section>`. Si cambia ese estado, la prueba debe cambiar con él.

| Comando (cada uno en su propia llamada) | Exit | Resultado |
|---|---|---|
| `bash ./spec/scripts/check-sdd-gate.sh .` | 0 | ABIERTA; 0 errores, 19 avisos históricos; 34 specs aprobadas y consentidas |
| `bash ./spec/scripts/validate-sdd.sh . --strict` | 0 | 0 errores, 0 avisos |
| `npm run typecheck --workspace @merdn/web` | 0 | OK |
| `npm exec -- eslint apps/web/src/features/hospital/hospitalAlcance.test.ts apps/web/src/features/paciente/paciente.test.tsx` | 0 | Sin hallazgos |
| `npm run test --workspace @merdn/web` | 0 | 77/77 archivos, **1904/1904** pruebas, 0 omitidas: las 1902 anteriores más los 2 casos nuevos de B10.1 |
| `git diff --check` | 0 | Sin errores (solo avisos LF→CRLF de Git) |
| `npm run secrets:scan` | 0 | OK; 1396 archivos versionables |

No se ejecutó `confirm-user-consent.sh`. **NO EJECUTADO por Claude:** la baseline completa, PostgreSQL, el navegador y el build web (este último carga `.env`). Como no cambió producción ni la prueba de navegador, no hace falta repetir el recorrido Chromium aprobado.

**Pendiente para Codex:** repetir la baseline completa con evidencia y limpieza, y después la auditoría conjunta de A01–A10. 055 no está cerrada. Esto no es aceptación del PO ni autorización de Git o despliegue.

## 0a. Seguimiento B08–B09 (2026-10-23, tras el recorrido Chromium de Codex 9/3/0)

**Estado: implementada con verificación pendiente.** Contrato: `MP07B-SEGUIMIENTO-NAVEGADOR.md`. Solo se tocaron `apps/api/test/care-browser.real.test.ts`, `apps/web/src/features/care/CareWorkspace.tsx` y este informe. Sin cambios de API, paginación, tamaños de página, timeouts, permisos, RLS, esquema, migraciones ni dependencias. B07 (único administrador, concesión y revocación real por API) ya estaba en el árbol: no se reimplementó ni se revirtió. Navegador y axe: **NO EJECUTADOS por Claude**. El 9/3/0 es del recorrido de Codex (`baseline-20261023t203200`), no de esta sesión.

| Hallazgo | Corrección | Archivo |
|---|---|---|
| **B08.1**: `getByText(/Vigente hasta/u)` ambiguo (resumen + etiqueta del formulario) | Primero se leen de la DB las versiones del criterio (mismas aserciones: [1 SUPERSEDED, 2 ACTIVE], definición exacta, N, EQ, valor, un solo criterio y `validUntil` no nulo). Después se espera, dentro de `ul[aria-label="Criterios"] > li`, el resumen EXACTO `Evalúa: Dato ficticio de prueba, versión 1, sin unidad. Vigente hasta <fecha>.`. La fecha es el `validUntil` persistido, formateada en el propio navegador con el mismo `Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })` de `fechaLegible`. Se exige una sola coincidencia. La etiqueta «Vigente hasta (opcional)» no coincide con ese texto | test |
| **B08.2**: la espera de `SOLICITUD` podía encontrar el textarea antes de confirmar el POST | Antes del click se instalan dos esperas: el POST a `…/alarms` y el GET a `…/alarms` que llega DESPUÉS de esa respuesta (recarga). Se comprueban 201 y 200, se espera a que ambas respuestas terminen y luego a la nota dentro de `section[aria-label="Mis solicitudes"] ol[aria-label="Mis solicitudes"] > li`, que excluye el formulario, con `exact: true` y una sola coincidencia. Después `vaciarTareas`. No cambian: la igualdad exacta `[{ contextId: ctxA }]` en DB, el formulario de solicitud vacío, el borrador de bitácora conservado y no guardado, el corte de la primera respuesta, el reintento con la MISMA clave UUID y una sola entrada. Sin sleeps | test |
| **B09**: al llegar a la última página se desmontaban el conteo y el estado final | En la bitácora, `ControlPagina` queda siempre montado. En la bandeja queda montado salvo durante la primera consulta (o el reinicio por filtro), que ya anuncia «Consultando solicitudes…» con `role="status"` y aún no tiene conteo que mostrar. El control ya ocultaba por sí mismo el botón cuando no hay cursor. Por tanto el botón solo desaparece cuando no hay continuación; con error y cursor se mantiene el reintento. Se conservan cargados/«no es el total», el filtro, el contexto, la deduplicación, los mensajes de error y `aria-live`. No se tocaron el directorio ni la cola | `CareWorkspace.tsx` |
| **B09, teclado**: el caso B04 debe activar un control por teclado | En B04, la segunda página de la bitácora se pide por teclado: `focus()` sobre «Cargar entradas anteriores», se comprueba que es `document.activeElement` y se pulsa `Enter` con `page.keyboard`. Con la espera instalada antes, se comprueban el GET real de `…/records` (200, terminado), el texto «23 entradas cargados. No hay más.», que el botón ya no existe y las 23 entradas, una vez cada una. Las demás páginas se siguen pidiendo con click | test |

`NavegadorEvaluado` incorpora `document.activeElement: unknown` para la comprobación de foco. No se añadieron tipos DOM al API.

**Efecto visible (decisión local, reportada).** Con B09, toda bandeja y bitácora cargada muestra su conteo, también cuando cabe en una página (p. ej. «3 entradas cargados. No hay más.»). En una bandeja vacía aparece «0 solicitudes cargados. No hay más.» junto al mensaje vacío existente. No se cambió el texto de `ControlPagina`.

| Comando (cada uno en su propia llamada) | Exit | Resultado |
|---|---|---|
| `bash ./spec/scripts/check-sdd-gate.sh .` | 0 | ABIERTA; 0 errores, 19 avisos históricos; 34 specs aprobadas y consentidas |
| `bash ./spec/scripts/validate-sdd.sh . --strict` | 0 | 0 errores, 0 avisos |
| `npm run typecheck --workspace @merdn/api` | 0 | OK |
| `npm run typecheck --workspace @merdn/web` | 0 | OK |
| `npm exec -- eslint apps/api/test/care-browser.real.test.ts apps/web/src/features/care/CareWorkspace.tsx` | 0 | Sin hallazgos |
| `git diff --check` | 0 | Sin errores (solo avisos LF→CRLF de Git) |
| `npm run secrets:scan` | 0 | Sin hallazgos |

No se ejecutó `confirm-user-consent.sh`.

**NO EJECUTADO por Claude:** el navegador Chromium (12 casos, móvil y axe), PostgreSQL, la baseline y las unitarias web. Vitest web no estaba en los comandos autorizados de esta sesión, así que no hay recuento nuevo; ninguna unitaria existente afirma la ausencia del control. Tampoco el build web, porque carga `.env`.

**Riesgos.**

- B08.1 compara el formato de fecha del navegador con el de la vista. Ambos usan la misma configuración de `Intl` en el mismo Chromium. Si la vista cambia de formato, esta prueba debe cambiar con ella.
- B08.2 supone que la recarga que sigue a una solicitud confirmada incluye el GET de la bandeja (`tras` → `recargar` → `cargar`) y que no hay otro GET de alarmas pendiente de antes del click. El espacio ya terminó de cargar antes de escribir.
- El selector de B08.2 depende de que la cuidadora no tenga REVIEW_ALARMS (no lo tiene en la preparación), por eso su bandeja se llama «Mis solicitudes».

**Pendiente para Codex:** recorrido Chromium de los 12 casos con móvil y axe. Si pasa, baseline completa y auditoría conjunta A01–A10. Esto no es aceptación del PO ni autorización de Git o despliegue.

## 00. Navegador real ejecutado por Claude (2026-10-23, autorización expresa del PO)

El PO autorizó expresamente que Claude ejecutara el navegador, como excepción a §6 del contrato. Claude usó sin modificar el arnés aprobado de Codex, `.tmp/check-browser055.mjs`, con el runner, el preflight y la base efímera. No leyó ni mostró el entorno privado. La salida está saneada. No se migró ni se tocó la base de la aplicación.

| Etapa | Run | Resultado |
|---|---|---|
| provision | `baseline-20261023t215834` | pass |
| care-browser-audit (Chromium, `care-browser.real.test.ts`) | ídem | **12/12, 0 fallos, 0 omitidas, exit 0**. Incluye móvil y el caso de axe (sin violaciones serias ni críticas en las vistas auditadas) |
| cleanup | ídem | pass; puertos 3100/3101 liberados |

Evidencia: `.tmp/browser055-2026-10-23T21-58-34.350Z.json`. Ejecución sobre el árbol posterior a B08/B09/B10; confirma la ejecución verde anterior de Codex (`baseline-20261023t204020`). Además, la suite web completa da 1904/1904 (exit 0). **Pendiente:** la baseline completa de Codex y el cierre técnico; la aceptación del PO, Git y el despliegue siguen separados.

## 0. Seguimiento B07 (2026-10-23, después de la segunda revisión de Codex)

**Estado: implementada con verificación pendiente.** Solo se tocaron `apps/api/test/care-browser.real.test.ts` y este informe. No cambió producción, esquema, migraciones, permisos ni el modelo administrativo. Navegador y axe: **NO EJECUTADOS por Claude**.

Se aplica la decisión `2026-10-23-055-admin-hospital-unico.md`: un solo administrador de Hospital.

- **Un único registro HOSPITAL.** `administracionHospital` se llama una sola vez, para `revisora`, el único administrador. Se eliminaron la cuenta `adminSinClinica` y su segundo registro. Al final del `beforeAll` se comprueba que el tenant tiene exactamente un registro `HOSPITAL`.
- **Secuencia válida del mismo administrador.** El caso «el Hospital administrador ve la cola…» se ejecuta primero, con la concesión clínica (REVIEW_ALARMS) que emitió la fundadora. Después, el caso nuevo «A05/B07…» hace lo siguiente:
  1. Comprueba que el único registro `HOSPITAL` es el de la revisora y está `CONFIRMED`.
  2. Revoca esa concesión por la vía real: la fundadora, gestora que la emitió, usa la API `POST /care/admin/organizations/:org/grants/:id/revoke`. Se comprueban el 200, el estado `REVOKED` y que la revisora no tiene ninguna concesión `ACTIVE`.
  3. Comprueba que sigue siendo la administradora: `/hospital` monta `[data-hospital-content]` y sigue habiendo un único registro.
  4. Comprueba que en `/hospital/cuidado` ve el estado vacío, sin Lucía, Marta, solicitudes, cola ni bandeja, y pasa axe.

  No se sustituye la cuenta administradora por una cuenta ordinaria, ni se concede o quita nada por ser administradora.
- **Separaciones conservadas.** El revisor clínico sin administración sigue en su caso A05. La cuenta ajena y el visitante sin sesión quedan en su propio caso «A05: una cuenta ajena y un visitante sin sesión…», con el helper común `sinDatosClinicos`.
- **Orden de ejecución.** Vitest ejecuta en orden los casos del archivo. La revocación ocurre después del único caso que necesita la clínica de la revisora, y ningún caso posterior la usa. B04 usa cuentas propias.

| Comando | Exit | Resultado |
|---|---|---|
| `npm run typecheck --workspace @merdn/api` | 0 | OK |
| `npx eslint apps/api/test/care-browser.real.test.ts` | 0 | OK |
| `git diff --check` | 0 | Sin errores |
| `npm run secrets:scan` | 0 | Sin hallazgos |

La suite de navegador tiene ahora **12 casos**: los 11 anteriores, con el negativo de A05 dividido en dos. **Pendiente para Codex:** ejecutar los 12 casos, la vista móvil y axe, y después la baseline completa.

Esta sesión retoma la implementación parcial que una sesión anterior dejó interrumpida por límite de sesión. Lo que ya había en el árbol se conservó sin revertirlo ni reimplementarlo. Aquí solo se corrigieron los hallazgos B01–B06.

## 1. Compuerta

| Comando | Exit | Resultado |
|---|---|---|
| `bash ./spec/scripts/check-sdd-gate.sh .` | 0 | ABIERTA; 0 errores, 19 avisos históricos; 34 specs aprobadas y consentidas |
| `bash ./spec/scripts/validate-sdd.sh . --strict` | 0 | 0 errores, 0 avisos |

No se ejecutó `confirm-user-consent.sh`.

## 2. Correcciones B01–B06

| Hallazgo | Corrección | Archivos |
|---|---|---|
| **B01 / P1**: firma de mutaciones rota | Los callbacks de envío pasan a `(clave) => …` y ya no reciben la señal del ciclo. Se cambiaron todos: registro, enmienda, solicitud manual, revisión, informe de resolución, criterio, retiro y definición de dato. La escritura ya no lleva la señal de `fetch`. Así se mantiene la garantía del diseño: una escritura enviada puede confirmarse en el servidor aunque el usuario cambie de paciente. La señal se sigue capturando ANTES del envío y se comprueba al responder: si el ciclo terminó, la respuesta se descarta entera (sin recibo, mensaje, recarga ni aviso al padre). Las claves siguen saliendo de `claveDe(intento)`: se conservan en los reintentos del mismo ciclo y se limpian al desmontar | `CareWorkspace.tsx` |
| **B02 / P2**: una confirmación borraba borradores de otros formularios | La `ronda` única pasa a ser una ronda por formulario (`solicitud`, `registro`, `datos`, `criterios`). `mutar`/`tras` reciben el formulario que envió y solo incrementan esa ronda. `GestorCriterios` ya no se remonta: recibe `ronda` y, cuando cambia, vacía solo el borrador/ajuste del criterio, sin tocar los motivos de retiro ya escritos (patrón de React de ajustar el estado cuando cambia una prop). Revisión, informe y retiro no reinician formularios. La corrección de una entrada (`FormularioEnmienda`) se reinicia con `key = amendments.length`, así que solo cambia la de esa entrada. Al cambiar de contexto, ciclo o cuenta, el `EspacioContexto` entero se sigue remontando, como antes | `CareWorkspace.tsx`, `careCriteriaViews.tsx`, `careViews.tsx`, `care.test.tsx` (prop nueva en tres renders) |
| **B03 / P2**: typecheck del API roto por código de navegador | Se añadió un tipo local `NavegadorEvaluado` con solo lo que usan las evaluaciones (`requestAnimationFrame`, `innerWidth`, `document.documentElement.scrollWidth`). Dentro de `page.evaluate` se accede vía `globalThis`. No se añadió `DOM` al `tsconfig` del API. La comprobación móvil pasa a un helper, `sinDesbordeHorizontal` | `care-browser.real.test.ts` |
| **B04 / P2**: faltaba interacción de paginación | Caso nuevo de navegador «B04/A06» (ver §4) | `care-browser.real.test.ts` |
| **B05 / P3**: `== null` | Ahora `const definicionAjuste = ajuste?.current?.observableDefinition ?? null` y se compara con `=== null`. Se mantiene el texto de la versión anterior sin definición exacta | `careCriteriaViews.tsx` |
| **B06 / P1**: la página de candidatos agotaba la transacción (503) | Causa: por cada uno de hasta 50 candidatos, el directorio llamaba 5 veces a `decideWithin`, una por acción. Cada llamada repetía la sesión (3 consultas), la organización, el contexto, la resolución del paciente propio y las concesiones. Se añadió `CareContextPolicy.decideManyWithin`, que decide todas las acciones de un contexto en una pasada. Sesión, organización, contexto y paciente propio se comprueban una vez por candidato: repetirlos solo volvía a leer filas que ya estaban `FOR SHARE` hasta el commit. Las concesiones de las acciones pendientes se bloquean juntas, `ORDER BY id`, antes de sus fuentes, conforme al orden de MP01. Cada acción se decide después solo con SUS concesiones y con el mismo `ACTOR_ORDER`. `lockGrants` usa ahora `permission = ANY(...)`. `decideWithin` le pasa `[permission]`, de modo que su resultado no cambia, y el camino fijado de A09 (destinatario, `['REVIEW_ALARMS']`) tampoco cambia. El directorio y la cola usan la pasada única | `care-context.policy.ts`, `care-context-directory.service.ts`, `care-context.policy.test.ts` |

B06 no cambia: RLS/FORCE, GUC de descubrimiento, el ámbito de organización por candidato, el orden estable por id, el cursor, el tamaño de página, la revalidación de cada página, el presupuesto global de transacciones ni el timeout de Vitest. No se omite ningún candidato ni se prefiltra fuera de MP01. Ningún candidato se proyecta sin que la política conceda al menos una acción.

Estimación por candidato denegado: antes eran unas 40 consultas, ahora unas 10. **No hay medición real en PostgreSQL**: hace falta que Codex repita la regresión.

## 3. Pruebas unitarias nuevas o ajustadas

`care-context.policy.test.ts`:

- **Equivalencia.** En 11 escenarios, `decideManyWithin(CARE_PERMISSIONS)` concede exactamente las mismas acciones y las mismas autorizaciones, en el mismo orden, que `decideWithin` acción por acción. Escenarios: profesional, cuidador, revisor, competencia revocada, emisor que no era manager, sin concesión, paciente propio, sesión revocada, organización municipal, contexto inactivo y principal sin vínculo.
- **Una sola pasada.** Sesión, vínculo, organización, contexto y concesiones se bloquean una vez cada uno. El orden es cuenta → sesión → vínculo → organización → contexto → concesiones, y las concesiones van todas en una consulta `ORDER BY "id"`.
- **Paciente propio.** No bloquea concesiones para sus acciones propias, solo para las demás.
- **Sin acciones pedidas.** No consulta nada.
- **Consulta de concesiones.** La aserción existente se ajustó a `= ANY(?::text[])` y ahora comprueba además que el valor enlazado es exactamente `['MANAGE_RULES']`.
- **Arnés.** La concesión ficticia lleva la acción pedida, y solo en la consulta por acción. El prebloqueo de A09 no cambia.

## 4. Pruebas de navegador preparadas — NO EJECUTADAS

Todas en `apps/api/test/care-browser.real.test.ts`, con barreras y esperas por condición, nunca fijas. Los datos son ficticios.

1. **B01/B02, cuidadora.**
   - Escribe un borrador de bitácora y envía una solicitud manual desde el otro formulario. Se comprueba: la solicitud se confirma en `ctxA` (DB), su formulario queda vacío y el borrador de bitácora sobrevive sin haberse guardado.
   - Después, el primer POST de bitácora llega al servidor y se confirma (`route.fetch` = 201), pero su respuesta se corta (`abort('failed')`). La UI muestra «No se pudo confirmar…», el borrador sigue y hay una sola fila en DB.
   - El reintento envía la **misma** clave, con formato UUID. La DB sigue con una sola entrada en A, la entrada aparece una sola vez y solo entonces se reinicia la bitácora. Incluye axe.
2. **B02, visitador.** Deja a medias un criterio (dato, comparación EQ, 3 veces, ventana 7) y valida un dato nuevo en el mismo paciente. El formulario de datos se vacía; el borrador del criterio conserva sus valores y sigue siendo «Nuevo criterio»; no se crea ningún criterio.
3. **B04/A06**, con preparación aislada: cuentas y organizaciones nuevas.
   - 205 candidatos con competencia revocada se ordenan antes del único espacio válido. Ese espacio tiene 56 abiertas (la ROJA es la más antigua), 2 cerradas recientes y 23 entradas.
   - **Directorio:** la primera página llega vacía con continuación y la UI no declara ausencia.
   - **Cola:** se pulsa «Cargar más espacios de la cola» hasta encontrar el espacio. Son exactamente 11 páginas, y mientras tanto nunca aparece «No tiene espacios…». La cola muestra «Semáforo: Rojo» y «10 más recientes de 56».
   - **Bandeja:** el espacio se abre desde la cola, antes de que el directorio lo cargue, con «Ver todas las abiertas (56)». Muestra 50 y la roja no aparece; al cargar la página siguiente hay 56 sin duplicados, la roja una vez y «Clasificación: Roja». «Solo abiertas» se mantiene y las cerradas no aparecen.
   - **Bitácora:** 20 entradas y luego 23, cada una una sola vez.
   - **Directorio hasta el final:** 5 páginas. El espacio abierto aparece una sola vez en el selector, sigue seleccionado y conserva bandeja y bitácora.
   - **Filtro «Todas»:** reinicia la bandeja y aparecen las cerradas. Incluye axe.
4. **Barrera del detalle A05** (riesgo señalado por Codex). El manejador hace `route.continue().catch(…)`. La prueba ya no exige una respuesta: espera el desenlace (`requestfinished` o `requestfailed`) de esa lectura y después comprueba que nada de A aparece bajo B. La cancelación de producción se mantiene.

El caso A02 existente, con el POST de A retenido y el cambio a B, conserva su aserción de 201. Con B01 corregido, ese POST ya no lleva la señal del ciclo.

## 5. Verificación de esta sesión (por exit code)

| Comando | Exit | Resultado |
|---|---|---|
| `npm run typecheck --workspace @merdn/web` | 0 | Antes 20 errores (B01) |
| `npm run typecheck --workspace @merdn/api` (incluye `test/**`) | 0 | Antes 3 errores (B03) |
| `npx eslint` sobre `apps/web/src/features/care`, `HospitalShell.tsx` y su prueba, `app/hospital/cuidado`, `apps/api/src/care-{context,criteria,records,alerts}` y las 5 suites de prueba del API afectadas | 0 | Antes exit 1 (B05) |
| `npx vitest run src/features/care src/features/hospital/hospitalShell.test.tsx` (web) | 0 | 127/127 |
| `DATABASE_URL=<DSN ficticio inutilizable 127.0.0.1:1> npx vitest run src/care-context src/care-criteria src/care-records src/care-alerts test/openapi.test.ts` (API) | 0 | 169/169 (155 anteriores + 14 nuevas) |
| `npm run build:shared` / `npm run build:api` / `npm run build --workspace @merdn/web` | 0 / 0 / 0 | OK |
| `npm run secrets:scan` | 0 | Sin hallazgos |
| `git diff --check` | 0 | Sin errores |

**No ejecutado por Claude, por contrato:** PostgreSQL (fundación, FORCE RLS y API, incluida la regresión de B06), recorrido real de navegador y axe, y baseline completa. No hay conteos de esas suites. Las 127 unitarias web son estáticas y no ejercen los callbacks ni las interacciones: esos criterios dependen de la suite de navegador.

## 6. Matriz MP07B

| Req. | Implementación | Verificación |
|---|---|---|
| **A02** | Subárbol `EspacioContexto` con `key` = contexto:ciclo. Señal capturada antes de cada petición. Las respuestas tardías se descartan. Clave por intento dentro del ciclo. B01 y B02 corregidos | Tipos, lint y build verdes. Navegador: A02 existente más B01/B02, **pendiente de ejecución** |
| **A05** | `/hospital/cuidado`, enlaces visibles y sesión humana existente. Sin administración por tener REVIEW_ALARMS. Sesión anterior, no se tocó | Navegador A05, **pendiente** (con la barrera de detalle robustecida) |
| **A06** | Cursores `items/nextCursor`, continuación con páginas vacías, cola con conteo y `hasMoreOpenAlarms`. B06: decisión por candidato en una pasada | Unitarias de política 169/169. API PostgreSQL de más de 200 candidatos y navegador B04, **pendientes** |
| **A08** | Versión nueva del mismo `criterionId`, vigencia opcional, definición exacta y revalidación. Sesión anterior | Unitarias web. Navegador «visitador… ajusta como versión nueva», **pendiente** |
| **A10** | `TEXTO_MOTOR_HOSPITAL` describe el motor síncrono y la revisión humana. Sesión anterior | Unitarias web |

## 7. Riesgos, supuestos y pendientes

- **B06.** La reducción del trabajo por página es estructural, pero no se midió. Si en el entorno de Codex la página siguiera por encima de 5000 ms, la siguiente palanca sería bloquear las concesiones de todos los candidatos de la página en una sola consulta. Eso cambia el orden de bloqueo entre contextos y requiere revisión de Codex antes de hacerlo. No se tocó el presupuesto global.
- **`decideManyWithin` no admite fijación de A09.** Es solo para el directorio y la cola. ASSIGN sigue usando `decideWithin` con `pinned`.
- **Navegador B01.** Se supone que Playwright permite `route.fetch()` seguido de `route.abort('failed')` (API documentada). La prueba presupone que una entrada solo con nota se acepta en `ctxA` aunque haya datos validados, como ya presupone el caso A02 existente.
- **Navegador B04.** Supone tamaños de página de cola 20, directorio 50, alarmas 50 y registros 20 (`TAMANO_PAGINA`). Si cambian, cambian los conteos de páginas esperados. La preparación crea más de 200 contextos ficticios y tiene un tiempo límite de 600 s.
- **B02.** Una confirmación de criterio sigue vaciando todo el borrador de criterio (nuevo o ajuste) de ese formulario, que es el formulario que envió. Los motivos de retiro escritos en otros criterios se conservan.
- No hay cambios de esquema, migraciones, dependencias, configuración, prototipo, decisiones ni consentimientos. No se tocaron `tasks/`, `reviews/`, `.env*` ni `.git`. Prisma generado no se versiona.

**Pendiente para Codex:**

1. PostgreSQL aislado: fundación, FORCE RLS y API (43 casos, con la regresión de B06).
2. Navegador real con axe: 12 casos tras B07 (ver §0) y móvil.
3. Baseline completa con evidencia saneada.
4. Revisión conjunta de A01–A10.

Después corresponde la aceptación del PO. Git, integración y despliegue siguen requiriendo autorización separada.
