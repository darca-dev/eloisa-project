# 055 / MP07B — Revisión de Codex

Fecha: 2026-10-23. Base publicada: `43d94b1`; rama `feat/preentrega-access-hardening`. Objeto: cambios locales de Claude posteriores a MP07A, contra `MP07-CORRECCIONES-A01-A10.md`. **Dictamen: no apto para cierre de MP07B ni de 055.**

**Seguimiento vigente 2026-10-26:** B10 ya está corregido; Codex repitió la baseline con 34/34 etapas y 2690 pruebas correctas y Chromium12/12, sin fallos/omisiones, con móvil/teclado/axe y cleanup correctos. Ver `055-CIERRE-AUDITORIA-CODEX-2026-10-26.md`. El dictamen y los apartados iniciales conservan evidencia histórica; no describen como fallidos los comandos posteriores ni sustituyen la aceptación del PO.

La ejecución de Claude quedó interrumpida por su límite de sesión, con `is_error: true` tras 163 turnos. No existe `MP07B-FROM-CLAUDE.md`; se revisa una implementación parcial, no una entrega final declarada por Claude. Codex no ha modificado producción para esta revisión.

## Hallazgos confirmados

### B01 / P1 — La nueva firma de mutaciones rompe los envíos

`apps/web/src/features/care/CareWorkspace.tsx:564–577` cambia `enviar` a un callback de un argumento (`clave`) y lo invoca así. Los callbacks de registro (592), enmienda (608), solicitud manual (623), informe de resolución (647), criterio (668) y definición de dato (679) aún esperan `(signal, clave)`. Por tanto reciben la clave en `signal` y `undefined` en `clave`; envían una clave idempotente vacía y pasan una cadena como señal de `fetch`. Los callbacks de revisión/retiro también conservan el parámetro anterior.

El typecheck web falla con 20 errores. Incluso omitiendo la comprobación de tipos, la firma de `fetch` rechaza esa señal: el cliente devuelve indisponibilidad sin guardar. Afecta las operaciones centrales de bitácoras, alarma manual y validación de criterios; A02/A08 no se pueden aceptar.

Corrección requerida: adaptar todos los callbacks a la firma elegida, mantener claves válidas y conservar el descarte de respuestas del ciclo anterior. El comentario de diseño exige permitir que una escritura enviada confirme en el servidor aunque el usuario cambie de paciente; corregir la firma no debe eliminar esa garantía. Verificar envíos reales, reintento idempotente y la carrera A→B.

### B06 / P1 — La página de candidatos agota la transacción y devuelve 503

La regresión nueva `directorio y cola recorren más de 200 candidatos filtrados…` falla realmente en PostgreSQL: esperaba HTTP 200 y recibe 503 al recorrer las páginas (`care-records-alarms.api.test.ts:1353`, invocación 1403). El registro del servidor confirma una transacción interactiva vencida: presupuesto de 5000 ms, consulta intentada a los 5006 ms. API termina 42/43, sin omitidas.

`apps/api/src/care-context/care-context-directory.service.ts:203–216` decide secuencialmente todos los permisos para cada uno de hasta 50 candidatos dentro de una misma transacción; la cola reutiliza esa decisión completa. El trabajo repetido de autorización es una causa identificada en código, no una razón para omitir permisos. El requisito A06 de continuar tras candidatos filtrados no se cumple en la ejecución observada.

Repetición independiente de la suite API, sin las otras suites en paralelo: `baseline-20261023t155027`, otra vez 42/43 y el mismo HTTP 503; transacción de 5000 ms vencida a los 5009 ms. Provision y limpieza correctos. Evidencia `.tmp/db055-2026-10-23T15-50-27.167Z.json`. Se confirma reproducibilidad en este entorno, sin extrapolar tiempos a producción.

Corrección requerida: acotar el trabajo por página y evitar comprobaciones repetidas de fuentes sin alterar los locks, la revalidación de permisos, el orden estable ni el aislamiento. No debilitar RLS, saltar candidatos o relajar la prueba. Si se propone cambiar un presupuesto global de transacciones, justificar su alcance antes de hacerlo; no ocultar el problema elevando el timeout de Vitest. Repetir los escenarios completos de directorio y cola.

### B02 / P2 — Una operación confirmada borra borradores de otros formularios

`CareWorkspace.tsx:539` incrementa una sola `ronda` para toda mutación exitosa. Esa ronda forma las claves de solicitud manual (779), registro (800), definición de datos (829) y criterios (834). React desmonta y monta todos esos formularios, no solo el enviado.

Ejemplo: un cuidador prepara una entrada de bitácora y envía una solicitud manual desde el otro formulario. Al confirmar la solicitud pierde la entrada todavía sin enviar. Un profesional puede perder un criterio en edición al guardar otro formulario. La consecuencia se verifica por el ciclo de montaje del código; no se presenta como reproducción de navegador, actualmente impedida por B01.

Corrección requerida: reiniciar únicamente el formulario cuya operación confirmó. Mantener el reinicio completo al cambiar contexto/ciclo/cuenta. Añadir interacción con dos formularios del mismo paciente, comprobando que sobrevive el borrador no enviado.

### B03 / P2 — Las nuevas pruebas de navegador rompen el typecheck del API

`apps/api/test/care-browser.real.test.ts:67` usa `requestAnimationFrame`; la línea 469 usa `document` y `window`. Son evaluaciones destinadas al navegador, pero el archivo se comprueba con el proyecto TypeScript del API sin biblioteca DOM. El comando de tipos del API termina con tres errores y exit 2.

Corrección requerida: expresar o tipar localmente el contexto del navegador conforme al patrón del repositorio. No ampliar globalmente los tipos DOM del servidor para ocultar el error. Volver a ejecutar el typecheck del API y el recorrido real.

### B04 / P2 — Falta la interacción de paginación exigida para A06

La suite de navegador contiene ocho casos y no acciona los controles para cargar páginas de contextos, cola, alarmas o entradas anteriores. Los casos nuevos de API para más de 200 candidatos, más de 50 alarmas y más de 20 registros son pertinentes, pero no prueban que el usuario pueda recorrer esas páginas, continuar desde una página filtrada vacía o abrir desde la cola un contexto fuera de la primera página del directorio.

Corrección requerida: incorporar y ejecutar esos recorridos de UI, incluida la alarma roja antigua y la conservación del filtro/contexto. No sustituirlos por render estático o pruebas del acumulador.

### B05 / P3 — Lint focal falla

`apps/web/src/features/care/careCriteriaViews.tsx:430` contiene `== null`, rechazado por `eqeqeq`. ESLint termina con exit 1. Corregir la comparación conservando el tratamiento de evidencia histórica indeterminada y repetir lint.

## Implementado y límites de verificación

Se observan en código la entrada `/hospital/cuidado` con enlaces visibles, la separación por contexto/ciclo, cursores y controles de continuación, edición de versiones de criterio/vigencia, `SIN_EVALUACION`, evidencia histórica indeterminada y el texto del motor síncrono. Esta presencia no certifica el comportamiento de navegador de A02/A05/A06/A08/A10.

Revisar además la barrera de detalle de `care-browser.real.test.ts:434–454`: retiene una petición antes de enviarla, cambia de contexto (lo que aborta las lecturas) y después exige una respuesta de esa petición. Podría esperar una respuesta que el navegador ya canceló. Es un riesgo de la prueba, pendiente de ejecución; no se afirma un fallo reproducido ni se recomienda quitar la cancelación de producción.

## Verificación independiente

| Comprobación | Resultado |
|---|---|
| Typecheck web | Exit 2, 20 errores, B01 |
| Typecheck API | Exit 2, 3 errores de las pruebas de navegador, B03 |
| Unitarias web de cuidado y HospitalShell | 127/127, exit 0 |
| ESLint focal de módulos/suites modificados | Exit 1, un error, B05 |
| PostgreSQL aislado, fundación de cuidado | 37/37, sin fallos ni omitidas |
| PostgreSQL aislado, FORCE RLS | 6/6, sin fallos ni omitidas |
| PostgreSQL aislado, API | 42/43, un fallo de paginación B06, sin omitidas |
| Unitarias API de cuidado y OpenAPI, DSN ficticio inutilizable | 155/155, exit 0 |
| Gate SDD | Exit 0; 0 errores, 19 avisos históricos |
| SDD estricta | Exit 0; 0 errores, 0 avisos |
| Escáner de secretos | Exit 0; 1392 archivos versionables, sin hallazgos |

La ejecución PostgreSQL usa `baseline-20261023t154721`; provision, preflight y limpieza aprobados, exit final 1 por B06. Evidencia saneada `.tmp/db055-2026-10-23T15-47-21.254Z.json`. El intento anterior `baseline-20261023t154320` no ejecutó pruebas porque Docker estaba apagado; no es un defecto del código. Se inició Docker Desktop y se repitió con el runner y preflight aprobados, sin migrar la base de aplicación.

No se ejecutaron navegador/axe ni baseline completa sobre este árbol con fallos de tipos conocidos. La verificación previa de MP07A (incluida actualización real de 29 a 30 migraciones y preservación histórica) conserva su alcance, pero no se reutiliza como prueba de MP07B. Las 127 unitarias verdes no ejercen los callbacks rotos ni suplen los criterios interactivos.

## Continuación requerida

Claude debe corregir B01–B06 dentro del contrato MP07B existente, entregar su handoff con resultados y pendientes reales y devolver el paquete para auditoría. Después corresponden navegador, accesibilidad, baseline completa y revisión conjunta A01–A10. No hace falta inventar decisiones clínicas o ampliar permisos para estas correcciones. La aceptación del Product Owner y cualquier acción Git/despliegue permanecen separadas.

## Segunda revisión — entrega posterior MP07B-FROM-CLAUDE

El PO pidió «revisa la propuesta». Codex localizó la nueva entrega de Claude del 2026-10-23, comparó sus correcciones con el contrato y ejerció comprobaciones independientes. El enfoque de corregir los callbacks, separar rondas por formulario y decidir las acciones de un contexto en una sola pasada es consistente con el alcance aprobado. No exige nuevos parámetros clínicos, ampliación de permisos ni cambio de presupuesto global de transacciones.

Una revisión especializada de seguridad, de solo lectura, no encontró defecto confirmado de aislamiento en `decideManyWithin`: mantiene los filtros de procedencia/tenant/organización/paciente/cuenta/finalidad/vigencia, separa concesiones por su propio permiso y conserva `authorizeGrant`. `decideWithin` y A09 siguen pasando un solo permiso a `lockGrants`; no se alteraron los prebloqueos conjuntos de destinatario. Es una revisión acotada, no una certificación de seguridad completa.

### B07 / P2 — El fixture de navegador viola la unicidad del administrador Hospital

**Defecto reproducido de preparación de pruebas.** `apps/api/test/care-browser.real.test.ts:157` ejecuta `administracionHospital(revisora)` y la línea 205 vuelve a ejecutarlo para `adminSinClinica` en el mismo `tenantId` y experiencia `HOSPITAL`. El helper de la línea 119 crea un registro nuevo en ambas ocasiones. `prisma/schema.prisma:904` impone `@@unique([tenantId, experience])`.

PostgreSQL rechaza el segundo registro con `Unique constraint failed on the fields: (tenantId, experience)`. La suite falla en `beforeAll` ANTES de lanzar Chromium: **0 pruebas ejecutadas y 11 omitidas, exit 1**. El clasificador operativo muestra `skipped` por esos once casos; la ejecución completa NO pasó. El arreglo no es eliminar la restricción ni ampliar el modelo administrativo.

Corrección requerida: preparar los escenarios de administrador con/sin concesión clínica respetando un único registro Hospital por tenant/experiencia, mediante escenarios aislados o una secuencia válida del único administrador. Conservar por separado las comprobaciones de revisor sin administración, administrador sin clínica y cuenta ajena; no sustituir la cuenta administradora por una cuenta ordinaria para hacer pasar el caso. Reejecutar los once casos, móvil y axe. La lista vacía de axe impresa por `afterAll` no constituye una auditoría de accesibilidad: ningún recorrido se ejecutó.

Ratificación explícita del PO: «solo debe haber un admin de hospital», registrada en `spec/bitacora/decisiones/2026-10-23-055-admin-hospital-unico.md`. B07 debe corregirse conservando el único administrador; no se autoriza agregar otro, quitar la unicidad ni conceder clínica automáticamente a la administración.

### Evidencia independiente de la nueva entrega

| Comprobación | Resultado actual |
|---|---|
| Tipos web y API | Ambos exit 0 |
| ESLint focal | Exit 0 |
| Unitarias web/HospitalShell | 127/127, exit 0 |
| Unitarias API de cuidado y OpenAPI, DSN ficticio inutilizable | 169/169, exit 0 |
| PostgreSQL: fundación de cuidado | 37/37, sin omitidas |
| PostgreSQL: FORCE RLS | 6/6, sin omitidas |
| PostgreSQL: API, incluida la regresión B06 de >200 candidatos | 43/43, sin omitidas |
| Navegador | Suite fallida en beforeAll por B07, exit 1; 0 ejecutadas / 11 omitidas |
| SDD estricta y diff-check | Exit 0; strict 0 errores/0 avisos |
| Escáner de secretos | Exit 0; 1393 archivos versionables, sin hallazgos |

PostgreSQL: `baseline-20261023t181840`, provision/preflight/cleanup correctos; evidencia saneada `.tmp/db055-2026-10-23T18-18-40.486Z.json`. Navegador: `baseline-20261023t182027`, servidores temporales 3100/3101 propios, provision/preflight/cleanup correctos y procesos propios detenidos; evidencia `.tmp/browser055-2026-10-23T18-20-27.403Z.json`. No base de aplicación ni servicios de Docker de la aplicación modificados.

Comprobación por hashes frente a MP07A: motor, evaluador, esquema y migración 30 sin cambios. Se conserva la evidencia previa de actualización histórica; no se presenta como otra ejecución de migración. No se repitió baseline completa en esta revisión: primero debe resolverse el bloqueo conocido de navegador.

### Estado de B01–B06 después de la nueva entrega

- B01 y B02: correcciones presentes y coherentes en código; tipos verdes. Confirmación interactiva de envíos/reintentos/borradores pendiente de B07.
- B03 y B05: fallos de tipos/lint corregidos y verificados.
- B04: recorrido de paginación incorporado, ejecución bloqueada por B07. No se acepta aún el criterio de interacción.
- B06: la regresión antes fallida pasa en PostgreSQL; la optimización no cambia RLS ni el timeout. Falta su recorrido desde UI.
- El riesgo de la barrera de detalle se atendió esperando `requestfinished` o `requestfailed`, sin exigir respuesta tras cancelación; pendiente ejecución.

Como mejora de cobertura, las unitarias de equivalencia deberían incluir concesiones reales distintas y actores diferentes por acción, además de revocación concurrente del camino múltiple. El spy actual clona una concesión para los distintos permisos. Esto limita la fuerza de esa comparación; no se afirma un defecto de autorización ni se bloquea por una hipótesis de escalamiento.

**Dictamen vigente:** propuesta técnica consistente y regresión API corregida; MP07B sigue con verificación incompleta por B07. Claude debe corregir el fixture y devolverlo para navegador/axe, baseline final y revisión conjunta A01–A10. Sin aceptación del PO, código de producción modificado por Codex, Git mutante o despliegue.

## Seguimiento B07–B10 — verificación real del navegador y baseline

La entrega B07 presente en el árbol conserva un único administrador, prueba su acceso con concesión y revoca esa concesión por la API de la gestora emisora. Codex detuvo su lanzamiento duplicado antes de editar y auditó la entrega existente. Chromium `baseline-20261023t203200`: 9/12, tres fallos y cero omitidas. B07 y A02/A05 pasan. Dos errores de selectores/sincronización y la desaparición del conteo al agotar cursor se documentaron antes de la corrección en `MP07B-SEGUIMIENTO-NAVEGADOR.md` (B08–B09).

Claude corrigió exclusivamente test, `CareWorkspace.tsx` y su entrega. Su ejecución terminó exit 0 y `is_error: false`. Codex revisó: se mantiene el conteo final, se oculta el botón de continuación al terminar, se espera confirmación real de la solicitud y se identifica el resumen de vigencia persistido sin confundir su etiqueta. No se debilitaron las aserciones de persistencia ni idempotencia.

**Chromium posterior `baseline-20261023t204020`: 12/12, cero fallos/omisiones, exit 0.** Verificados cambio A→B con escritura/detalle retenidos, reintento con la misma clave y una sola fila, borradores independientes, criterio versionado/vigencia, revisor sin administración, administrador único con/sin clínica y ajenos. Directorio/cola >200, 56 alarmas incluida roja antigua, 23 entradas y activación por teclado pasan; también móvil y axe sin serias/críticas en las vistas incluidas. Provision/preflight/cleanup correctos; `.tmp/browser055-2026-10-23T20-40-20.391Z.json`. Fuente de producto sin cambios durante la ejecución, comprobada por hashes.

Build shared/API/web: exit 0 independiente, `.tmp/055-final-build.log`, con DSN ficticio inutilizable y API puerto 1. Lint focal amplio exit 0. Runner/catálogos/gestor: 49/49, cero omitidas.

Baseline `codex055-corrections`: provision, tres typechecks y API sin DB 51/51 pasan. Web 1900/1902 falla, sin omitidas; se detiene antes de las etapas posteriores y limpia correctamente. Evidencia `.tmp/final055-2026-10-23T20-42-38.902Z.json`. B10 se describe en `MP07B-REGRESION-WEB.md`: excepción exacta para el import existente `next/link` en HospitalShell y comprobación accesible del estado SSR inicial de cuidado, conservando guardas y anuncios de lectura del portal. Ampliación justificada solo a los dos tests consumidores y handoff antes de editar. La baseline completa sigue pendiente; la prueba de navegador verde no equivale a aceptación final de 055.
