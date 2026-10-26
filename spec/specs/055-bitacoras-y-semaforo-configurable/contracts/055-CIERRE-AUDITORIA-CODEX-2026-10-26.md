# 055 — Auditoría de cierre de Codex

Fecha: 2026-10-26. Rama: `feat/preentrega-access-hardening`.
HEAD: `e94e4008905dbec1efc1aa453f08f9142e2bdff7`; implementación de MP07:
`527bdae`. En esta sesión Codex no modifica código de producto ni crea commits.

**Dictamen técnico: apto con observaciones para revisión del Product Owner.**
Correcciones A01–A10/B01–B10 verificadas por revisión, regresión y recorrido real;
baseline completa y navegador aprobados para e94e400. Después se aplicó y verificó
el ajuste textual B11 aprobado por el PO, sin cambiar el cálculo. El Product
Owner aceptó funcionalmente el alcance presentado el 2026-10-26; se conserva
el dictamen y sus observaciones. No implica validación clínica ni autorización
Git/despliegue.

## Evidencia de esta sesión

| Comprobación ejecutada por Codex | Resultado |
|---|---|
| Baseline `codex055-review-20261026` | 34/34 etapas; 2690 aprobadas, 0 fallidas, 0 omitidas; exit 0 |
| Web, repetida y dentro de la baseline | 1904/1904 |
| API/OpenAPI focal con DSN ficticio inutilizable | 169/169; exit 0 |
| Fundación de cuidado, dentro de la baseline | 37/37 PostgreSQL |
| Catálogo FORCE RLS, dentro de la baseline | 6/6 PostgreSQL |
| API de registros/alarmas, dentro de la baseline | 43/43 PostgreSQL |
| Runner, catálogos y script del gestor | 49/49; exit 0 |
| Tipos shared/API/web | exit 0; incluidos en la baseline |
| Lint focal API/care/web y consumidores B10 | exit 0 |
| Escáner de secretos final | exit 0; 1400 archivos versionables; sin hallazgos |
| Chromium, móvil, teclado y axe actuales | 12/12; 0 fallos/omisiones; axe sin serias/críticas en superficies probadas; exit 0 |
| Gate SDD final | exit 0; abierto, 0 errores y 19 avisos históricos |
| Validación SDD estricta final | exit 0; 0 errores, 0 avisos |
| `git diff --check` | exit 0; solo avisos de normalización LF/CRLF |

Evidencia saneada de baseline:
`.tmp/review055-2026-10-26T16-32-41.083Z.json`. Todos sus stages identifican
`e94e400`. Provisión, preflight y cleanup correctos. No se usa la base de la
aplicación. El intento previo falló antes de provisionar porque el motor Docker
estaba apagado; no fue una prueba de producto fallida. Se inició la instalación
existente de Docker Desktop y se ejecutó nuevamente el arnés aprobado.

Navegador ejecutado por Codex: run `baseline-20261026t163801`, evidencia saneada
`.tmp/browser055-2026-10-26T16-38-01.149Z.json`. Incluye dos pacientes con respuestas
demoradas, borradores independientes, reintento idempotente, revisor sin
administración, administrador único sin clínica implícita, criterios versionados,
paginación completa, móvil, teclado y axe. Provision/preflight/cleanup correctos;
el arnés terminó sus servidores temporales. No hubo cambios de producto mientras
corrieron las pruebas (`git diff --quiet -- apps packages prisma scripts tests`,
exit 0). Esa primera fase solo cambió documentación. El seguimiento B11 posterior
modifica la etiqueta y sus consumidores de prueba/comentario, con verificación focal.

La revisión de lectura de Claude terminó con exit 0, sin cambios ni ejecución de
pruebas por Claude. Su alcance parcial y sus límites se conservan en
`055-REVISION-LECTURA-CLAUDE-2026-10-26.md`. La transferencia fue autorizada
directamente por el PO; decisión canónica de continuación del 2026-10-26.

## Correcciones y criterios de aceptación

| Hallazgos | Cierre revisado | Criterios y evidencia |
|---|---|---|
| A01 | Ausencia/insuficiencia/vencimiento de reglas no infiere ESTABLE | AC03/AC05; evaluador y API de semáforo |
| A02, B01/B02 | Subárbol por contexto/ciclo, descarte de respuestas tardías, claves por intento y formularios independientes | AC01/AC07/AC09; código y recorrido interactivo actual aprobados |
| A03 | Definición exacta, FK compuesta y revalidación; legado sin reconstrucción inventada | AC03/AC08/AC09; migración revisada y API PostgreSQL |
| A04 | Identidad de evento entre versiones, consumo y frontera posterior al cierre | AC04/AC07/AC08; motor, guardas y API concurrente |
| A05, B07 | Entrada clínica separada y administrador único; administración no concede clínica | AC02/AC06/AC09; política/API y recorrido actual aprobados |
| A06, B06/B08/B09 | Cursores y continuación en páginas filtradas; conteos y acceso a alarmas antiguas | AC06/AC09; API y navegador con más de 200 candidatos, 56 alarmas y 23 entradas |
| A07 | Snapshot del valor efectivo y secuencia de enmiendas; evidencia inmutable | AC08/AC10; SQL, proyección y API PostgreSQL |
| A08 | Nueva versión del mismo criterio, definición exacta y vigencia | AC03/AC08; API y recorrido actual aprobados |
| A09 | Destinatario plenamente elegible sin exigir sesión propia; locks de ambas cuentas | AC02/AC09/AC11; fundación 37/37 y regresión API |
| A10 | Mensajes coherentes con motor síncrono y recepción manual | AC12; lectura y unitarias |
| B03/B05/B10 | Tipos/lint corregidos, excepción exacta next/link y estado SSR accesible | AC11; tipos, lint y web 1904/1904 |

AC10 conserva transiciones, versión, historia y auditoría; informar resolución no
borra evidencia ni cierra por inferencia. AC11 se verifica para los caminos de
revocación/auditoría/RLS ejercidos; no se extiende a escenarios no cubiertos.

## Observaciones y límites

1. **Decisión de presentación cerrada, PO:** conservar `SIN_CRITERIOS` y mostrar
   «Sin criterios vigentes ni solicitudes abiertas: no hay evaluación automática».
   Implementado por Claude y verificado por Codex en B11; no se cambió el cálculo.
2. **Clasificación abierta y reloj:** una alarma clasificada ESTABLE sigue
   representada mientras esté abierta aunque venza su regla. Así lo prescribe
   A01; no es una nueva evaluación ni certifica estabilidad clínica actual. No
   se cambia por decisión técnica de Codex/Claude.
3. **Decisión múltiple:** el código filtra concesiones por acción y actor y
   conserva todas las fronteras. PostgreSQL verifica conjuntos parciales de
   permisos; el spy unitario clona concesiones. Faltan pruebas específicas de
   actores mixtos por acción y revocación concurrente durante `decideManyWithin`.
   No se confirmó un bypass; se registra como límite de cobertura, no garantía
   universal de AC11 ni obligación clínica nueva.
4. **Guardas estáticas:** el parser histórico de imports solo contempla `from`
   con comillas simples y no es transitivo. B10 no lo amplía ni lo debilita; sus
   casos positivos/negativos usan ese mismo parser. No sustituye seguridad API.
5. **Datos reales y operación:** fundamento, retención, validación clínica del
   catálogo/reglas y vigilancia institucional siguen fuera de esta aceptación
   técnica. Worker/outbox, canales externos y resto de S12 no se declaran hechos.
6. **Evidencia histórica:** los informes del 23/10 describen momentos distintos
   del árbol aún sin commit y atribuyen algunas ejecuciones a Claude. No se
   inventa ahora una aprobación histórica ni se modifican sus resultados. La
   baseline actual y el recorrido actual de Codex resuelven la dependencia
   técnica de aquella atribución. Los commits 527bdae/e94e400 ya existían al
   comenzar esta sesión; aquí solo se inspeccionan.

La actualización real 29→30, con 12 filas históricas de ocho tablas conservadas,
corresponde a la verificación previa de Codex del 22/10. No se repite ni se
presenta como ejecución nueva: se revisó la migración aditiva y el código no
cambió desde `527bdae`. Los builds shared/API/web aprobados del 23/10 también se
distinguen de los typechecks ejecutados ahora.

## Seguimiento B11 — texto aprobado e implementado

Decisión directa del PO posterior a la presentación de esta auditoría; registro
`2026-10-26-055-texto-sin-criterios-vigentes.md`, contrato
`MP07B-B11-TEXTO-SIN-CRITERIOS.md` y entrega `MP07B-B11-FROM-CLAUDE.md`.

Claude modificó cuatro archivos permitidos: la constante de etiqueta en API, la
aserción existente de criterio vencido, el fixture/expectativa de render web y un
comentario descriptivo. Codex revisó el diff: SIN_CRITERIOS, cálculo, otros estados,
permisos, motor, servicios, esquema y migraciones permanecen sin cambios.

Codex repitió criterios17/17 y web/care48/48, y lint de los cuatro archivos, exit0.
PostgreSQL `codex055-b11-20261026`: **43/43, cero fallos/omisiones**, provisión,
preflight y cleanup correctos. La aserción ampliada prueba el texto exacto en la
respuesta HTTP del criterio vencido y conserva las guardas de no ESTABLE, sin
alarmas nuevas ni reescritura histórica. Evidencia saneada y hashes del candidato:
`.tmp/db055-b11-2026-10-26T16-58-38.528Z.json`, `candidateUnchanged:true`, exit0.
Los hashes identifican B11 aún sin commit sobre e94e400.

Claude ejecutó además tipos API/web, ambos exit0, y los dos gates antes de editar
(gate0errores/19avisos históricos, strict0/0). Codex había ejecutado igualmente
los gates antes del paquete. La baseline completa2690 y Chromium12/12 de arriba
son anteriores a B11; no se atribuyen al candidato textual posterior ni se
repiten para este cambio de una etiqueta sin lógica nueva. No hay despliegue.
Verificación final B11: SDD estricta0errores/0avisos, scanner1403archivos sin
hallazgos y diff-check correctos, todos exit0.

## Aceptación funcional y continuación

El Product Owner aceptó el resultado el 2026-10-26 con «si esta correcto prosigue»
después de la explicación del cálculo. Decisión canónica:
`2026-10-26-055-aceptacion-funcional.md`. Se conservan las observaciones y límites
anteriores. La continuación retoma la auditoría de054. Cualquier Git/despliegue
requiere autorización separada. Este informe no cierra el alcance integral de MERDN.
