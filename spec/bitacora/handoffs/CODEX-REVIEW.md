Handoff-Version: 58
Updated-At: 2026-09-30
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Reviewed-Package: 038-MP03-C2
Status: ACCEPTED_MP04_AUTHORIZED

# Revision vigente - SPEC 038 / MP03-C2 aceptado

El Product Owner acepto expresamente MP03-C2 el 2026-09-30. Se conserva la
evidencia directa: 902/902 pruebas Hospital, 7/7 E2E Chromium, typecheck web,
ESLint focal y compuertas SDD en verde.

MP04 queda autorizado por `TO-CLAUDE.md` v58. El handoff reconcilia OD-11 con el
registro aceptado: la credencial ficticia se envia al OIDC local sin persistirla
ni registrarla, se conserva el `sub` real y la cuenta permanece deshabilitada
hasta provision confirmada. MP05 permanece cerrado.

---

Handoff-Version: 55
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Reviewed-Package: 038-MP03-C1
Status: FAIL_CORRECTION_AUTHORIZED

# Revision vigente - SPEC 038 / MP03-C1

`FAIL - CORRECCION AUTORIZADA`. La superficie, el rol exacto, el aislamiento,
las proyecciones, las decisiones y la concurrencia estan implementados, y las
suites focales reportadas pasan. La correccion del keyset evita perder filas con
fecha anterior y UUID mayor.

Quedan tres incumplimientos verificables: el texto promete normalizacion de
documento pero envia el `q` con puntos/espacios directamente al campo
normalizado; el decoder acepta un tercer segmento del cursor; y el 401 sin
sesion no genera `ACCESS_REQUEST_LIST_DENIED`, aunque SPEC 038 exige auditar
denegaciones y el esquema ya contempla `UNAUTHENTICATED`.

El hallazgo informado sobre `expire-relationships.job.ts` no se reproduce: el
archivo actual importa `PrismaService` y `TenantContextService` como valores. No
se autoriza modificarlo. MP03-C1-C1 queda autorizado como una unica correccion
antes de abrir la bandeja web.

---

Handoff-Version: 54
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Reviewed-Package: 038-MP02-C2-C1
Status: PASS_STATIC_DB_EVIDENCE_PENDING

# Revision vigente - SPEC 038 / MP02-C2-C1

`PASS`. `useRef` bloquea el segundo submit antes de cualquier `await`; el cliente
exige referencia, `PENDING` y `TEST_DATA`; el rótulo es Visitador médico y el
ejemplo OpenAPI coincide. OpenCode reporta 31 unitarias, 49 OpenAPI, typecheck,
lint y 7 Playwright focales en verde. La prueba demuestra doble submit, espera,
teclado, éxito y reintento.

La marca START tardía es desviación de proceso sin impacto funcional. Dos
mensajes `role=alert` en la validación local son redundantes pero no bloquean;
se corregirán al integrar la bandeja web. Falta evidencia PostgreSQL. MP03-C1
queda autorizado para la API de revisión Hospital.

---

Handoff-Version: 53
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Reviewed-Package: 038-MP02-C2
Status: FAIL_CORRECTION_AUTHORIZED

# Revision vigente - SPEC 038 / MP02-C2

`FAIL - CORRECCIÓN AUTORIZADA`. El cliente y formulario sustituyen la simulación,
mantienen nueve campos, no persisten en navegador y las suites reportadas pasan.
Sin embargo, `if (enviando)` usa el valor del render y dos submits sincrónicos
pueden llamar dos veces antes del siguiente render. No existe prueba de
interacción que detecte ese caso. Además, el 202 admite cualquier status/source
no vacío, el rótulo no refleja «Visitador médico» y OpenAPI publica una
referencia imposible.

MP02-C2-C1 queda autorizado para una corrección focal con prueba Playwright
interceptada. MP03 permanece cerrado. El exceso de tiempo se registra, pero no
es la causa técnica del rechazo.

---

Handoff-Version: 51
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Reviewed-Package: 038-MP02-C1
Status: FAIL_CORRECTION_AUTHORIZED

# Revision vigente - SPEC 038 / MP02-C1

`FAIL`. El endpoint, DTO cerrado, transacción, idempotencia, auditoría y pruebas
focales son coherentes, pero `AccessRequestRateLimitGuard` corre antes de la
validación de origen implementada dentro del controlador. Un origen ajeno puede
agotar el contador antes del 403. La prueba de OpenAPI falla porque su lista
cerrada no incluye la ruta aprobada. El paquete también omitió START y excedió
el hard stop.

MP02-C1-C1 corrige el guard/order y la única expectativa OpenAPI afectada, con
pruebas de que el origen denegado no consume cuota. MP03 sigue cerrado.

---

Handoff-Version: 50
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Reviewed-Package: 038-MP01-C1-C2
Status: PASS_STATIC_DB_EVIDENCE_PENDING

# Revision vigente - SPEC 038 / MP01-C1-C2

`PASS ESTATICO`. La constraint permite atribuir decisión en provisión, y se
conservan índice parcial, RLS forzada, grants, FKs compuestas y rollback.
OpenCode reporta `prisma validate` y `prisma format --check` con exit 0.

Queda pendiente evidencia PostgreSQL de RLS, FKs, unicidad, grants y rollback.
MP02-C1 queda autorizado para solicitud persistente sin crear acceso.

---

Handoff-Version: 49
Updated-At: 2026-09-28
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Reviewed-Package: 038-MP01-C1-C1
Status: FAIL_CORRECTION_AUTHORIZED

# Revision vigente - SPEC 038 / MP01-C1-C1

## Veredicto

`FAIL`. La migracion, RLS, FKs y rollback son estructuralmente coherentes, pero
la constraint `access_request_open_has_no_decision` contradice SPEC 038 §6.4:
impide persistir el revisor y la fecha al pasar de `PENDING` a
`APPROVED_PENDING_PROVISIONING`. La aprobacion no quedaria atribuida y la
transicion no puede ocurrir. Adicionalmente el reporte informa que Prisma no
esta formateado; la ejecucion independiente de Codex no pudo verificar formato
porque el sandbox bloqueo la descarga del binario, sin modificar archivos.

## Correccion autorizada

MP01-C1-C2 cambia solo esa constraint para exigir ausencia de decision en
`PENDING`, conserva el indice parcial y formatea `schema.prisma`. El siguiente
paquete sigue bloqueado hasta que ambos chequeos Prisma pasen.

---

Handoff-Version: 48
Updated-At: 2026-09-28
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Reviewed-Package: 038-MP01-C1
Status: INCOMPLETE_CORRECTION_AUTHORIZED

# Revision vigente - SPEC 038 / MP01-C1

## Veredicto

`INCOMPLETE`. El schema declara correctamente el agregado `AccessRequest`, sus
catalogos, fuentes de datos ficticios de prueba, FKs compuestas y limites de
datos; `npx prisma validate` termino con exit 0. Sin embargo, no existe la
migracion ni el rollback que deben materializarlo, y `npx prisma format --check`
no se ejecuto. La base sigue sin esa estructura, por lo que MP01-C1 no es
aceptable ni habilita MP02.

## Correccion autorizada

MP01-C1-C1 completa exclusivamente la migracion, rollback y ambos chequeos de
Prisma. El indice parcial define como abiertas `PENDING`,
`APPROVED_PENDING_PROVISIONING` y `PROVISIONING_FAILED`; los estados decididos
se conservan como historia y no bloquean una nueva solicitud. No se ejecutaran
Docker, SQL ni pruebas de base porque SPEC 025 permanece diferida.

---

Handoff-Version: 47
Updated-At: 2026-09-28
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 038-demo-funcional-accesos-ficticios
Reviewed-Package: 025-MP15-C7
Status: DEFERRED_BY_PRODUCT_OWNER

# Revision vigente - prioridad SPEC 038

SPEC 025 queda pendiente por decisión del Product Owner. Su fallo interno sigue en
el inventario seguro de Docker y no hay baseline aceptada. La prioridad autorizada
es SPEC 038 como aplicación funcional local con datos de prueba ficticios. MP01-C1
queda autorizado únicamente para su fundación de datos y migración no aplicada.

---

Handoff-Version: 46
Updated-At: 2026-09-28
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP15-C7
Status: FAIL

# Revision vigente - SPEC 025 / MP15-C7

## Veredicto

`PASS DIAGNOSTICO`. El fallo interno es `identity`: el inventario seguro de Docker
detiene el provisionador antes de crear recursos. El guard y la limpieza pasan y no
queda cluster. Sigue pendiente distinguir comando de inventario frente a inventario
rechazado; no se autoriza otro paquete hasta decisión de prioridad.

---

Handoff-Version: 32
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP12
Status: PASS

# Revision vigente - SPEC 025 / MP12

## Veredicto

`PASS (NO-OP)`. La allowlist cerrada de `branding.test.tsx` ya contenia la ruta
de prueba Hospital y su comentario justificativo; ningun archivo productivo fue
exceptuado. La prueba focal informada pasa con 12 pass y lint focal pasa. No hubo
infraestructura.

MP13 queda autorizado para construir el runner de baseline y su script npm, sin
ejecutar Docker, PostgreSQL ni una suite.

---

Handoff-Version: 31
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP11
Status: PASS

# Revision vigente - SPEC 025 / MP11

## Veredicto

`PASS (NO-OP)`. Las expectativas de cuarto rol ya estaban presentes en el arbol
y respetan el orden del contrato. No hubo cambio adicional. La prueba focal
informada pasa con 36 pass y el lint focal pasa. El setup de API emitio un log de
conexion Prisma sin afectar pruebas; no se inicio ni modifico una base.

MP12 queda autorizado para la gobernanza stale de branding en una sola prueba
web.

---

Handoff-Version: 30
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP10
Status: PASS

# Revision vigente - SPEC 025 / MP10

## Veredicto

`PASS`. Se agregaron 25 pruebas permanentes, puras y deterministas para MP02,
MP07, MP08 y MP09. Cubren guard, inventario, sanitizacion, catalogo, rollback,
IDs efimeros, argv de cleanup, postcheck, un solo intento y etapas de error.

Codex ejecutó `node --test tests/testing/test-db-lifecycle.test.mts` fuera del
sandbox de Windows porque el sandbox devolvia `spawn EPERM`: 25 pass, 0 fail,
0 skip. Lint focal y sintaxis pasan. No se ejecuto Docker, PostgreSQL, Prisma ni
migraciones. MP11 queda autorizado para corregir solo expectativas stale del
cuarto rol institucional.

---

Handoff-Version: 29
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP09-C2
Status: PASS

# Revision vigente - SPEC 025 / MP09-C2

## Veredicto

`PASS ESTATICO`. `loadEnvFile` y el guard ahora se ejecutan mediante un wrapper
que entrega `CleanupError` sanitizado: env-file conserva `env-file`, guard
conserva `guard`, y los ProvisionError posteriores conservan su propia etapa.
El orden de seguridad permanece env-file -> guard -> identidad -> down ->
postcheck, sin procesos antes del guard.

Codex verifico sintaxis, lint focal y la resolucion pura de las cinco etapas. No
se ejecuto Docker, PostgreSQL, Prisma, migraciones ni pruebas DB. MP10 queda
autorizado para escribir pruebas permanentes del lifecycle sin infraestructura.

---

Handoff-Version: 28
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP09-C1
Status: FAIL

# Revision vigente - SPEC 025 / MP09-C1

## Veredicto

`FAIL - CORRECCION ACOTADA REQUERIDA`. `resolveErrorStage` preserva correctamente
`stage`, despues `step`, despues `unknown`; sintaxis y lint focal pasan. No hubo
ejecucion de infraestructura.

`loadEnvFile` y `assertTestEnvironment` siguen fuera del bloque `try` de la
funcion principal. Un env-file invalido escapa como `ProvisionError`, no como
`CleanupError` sanitizado y con etapa. El contrato del cleanup requiere una
salida de error uniforme antes de cualquier proceso.

MP09-C2 queda autorizado solo para incluir env-file y guard en el manejo seguro,
conservando el orden env-file -> guard -> identidad -> down -> postcheck. No
autoriza Docker, PostgreSQL, Prisma, migraciones, pruebas DB, suites generales
ni Git.

---

Handoff-Version: 27
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP09
Status: FAIL

# Revision vigente - SPEC 025 / MP09

## Veredicto

`FAIL - CORRECCION ACOTADA REQUERIDA`. El cleanup respeta la allowlist, valida
identidad antes del unico `down`, usa argv fijo y postcheck sin segundo borrado.
Sintaxis y lint focal pasan; no se ejecuto infraestructura.

El bloque `catch` llama `toSafeCleanupError(error?.stage ?? 'unknown', ...)`.
`ProvisionError` de MP07 usa la propiedad `step`, asi que una falla de identidad,
down o postcheck se degrada a `unknown` aunque la etapa segura exista. Esto rompe
la trazabilidad prometida por el artefacto y por su reporte.

MP09-C1 queda autorizado para preservar `error.stage` o `error.step` al envolver
errores y cubrirlo con una prueba pura. No autoriza cambios de limpieza, Docker,
PostgreSQL, Prisma, migraciones, pruebas DB, suites generales ni Git.

---

Handoff-Version: 26
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP08-C1
Status: PASS

# Revision vigente - SPEC 025 / MP08-C1

## Veredicto

`PASS ESTATICO`. El INSERT cross-tenant usa ahora un tercer ID efimero distinto
de las personas A y B. El catalogo ya no interpreta el puerto de socket o
interno como puerto host; despues del guard reutiliza
`assertLoopbackPublication` de MP07 para validar la publicacion efectiva de
Compose antes de leer el catalogo. Se removieron todos los caracteres CJK.

Codex verifico sintaxis Node, lint focal, ausencia de CJK y contratos puros:
los tres IDs son distintos, el SQL no contiene `inet_server_port`, y un catalogo
conforme sin campo de puerto pasa la evaluacion. No se ejecuto Docker,
PostgreSQL, Prisma, migraciones ni una suite DB.

La ejecucion real de SQL, Compose y RLS permanece pendiente de la primera
corrida aislada autorizada. MP09 queda autorizado para crear el cleanup seguro,
sin ejecutarlo.

---

Handoff-Version: 25
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP08
Status: FAIL

# Revision vigente - SPEC 025 / MP08

## Veredicto

`FAIL - CORRECCION ACOTADA REQUERIDA`. El alcance de archivos, imports, guard,
catalogo, validadores puros, evidencia minimizada y diseno de rollback son
coherentes. `node --check`, lint focal y pruebas puras pasan. No se ejecuto
infraestructura, como ordenaba el paquete.

Hay dos defectos que harian fallar el preflight real:

1. La sonda `cross_insert` usa el mismo `personBId` ya insertado para el
   fixture B. Puede producir violacion de clave primaria antes de alcanzar la
   policy RLS, y solo captura `insufficient_privilege`.
2. El catalogo compara `inet_server_port()` con `55432`. `runSql` ejecuta psql
   dentro del contenedor por socket local (sin puerto TCP) o por el puerto
   interno `5432`, nunca por el puerto publicado del host. La identidad de
   publicacion debe verificarse mediante `assertLoopbackPublication` de MP07,
   que consulta Compose de forma segura durante la ejecucion posterior; el
   catalogo debe verificar solo identidad de base, administrador y version.

Tambien debe removerse el texto CJK accidental de un comentario. MP08-C1 queda
autorizado solo para esas correcciones y sus pruebas puras. No autoriza Docker,
PostgreSQL, Prisma, migraciones, pruebas DB, suites generales ni Git.

---

Handoff-Version: 24
Updated-At: 2026-09-26
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP07-C1
Status: PASS

# Revision vigente - SPEC 025 / MP07-C1

## Veredicto

`PASS ESTATICO`. La correccion inventaria contenedores, redes y volumenes antes
de cada `down --volumes --remove-orphans`. Un recurso se considera de la
baseline solo por el label exacto del proyecto o por el nombre exacto aprobado;
cada recurso asi encontrado debe tener los tres labels, el nombre permitido y
el driver `bridge` (red) o `local` (volumen). Cualquier ambiguedad detiene el
flujo antes de borrar. `preClean` y `cleanupAfterFailure` reutilizan la misma
verificacion.

Codex verifico `node --check`, lint focal y una prueba directa de
`validateResourceInventory`: bloquea etiquetas ausentes, driver no permitido y
nombre ajeno con label del proyecto. El modulo continua usando argv fijo y sin
shell.

No se inicio Docker ni PostgreSQL en este paquete, por lo que los argumentos
reales de inventario y el lifecycle completo se verificaran solo en la primera
corrida aislada autorizada. Esa limitacion esta declarada; no invalida el
artefacto estatico ni autoriza una ejecucion fuera del runner posterior.

MP08 queda autorizado para crear el preflight de runtime/RLS sin ejecutar
Docker, PostgreSQL, Prisma, migraciones ni suites DB.

---

Handoff-Version: 23
Updated-At: 2026-09-26
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a72279c8f500b34c915006b5d962063c6fd30
Related-Spec: 025-baseline-pruebas-aislada
Reviewed-Package: MP07
Status: FAIL

# Revisión vigente — SPEC 025 / MP07

## Veredicto

`FAIL — CORRECCIÓN ACOTADA REQUERIDA`. El script compila y su guard, lista de
14 migraciones, roles, ownership, timeouts, sanitización y verificaciones de
catálogo están correctamente delimitados. Sin embargo, `assertProjectIdentity`
solo inspecciona contenedores. Tanto `preClean` como el cleanup tras fallo usan
`down --volumes` y podrían actuar sobre red o volumen existente con nombre o
label ambiguo.

MP07-C1 queda autorizado para validar contenedores, redes y volúmenes antes de
cualquier borrado. No autoriza ejecutar Docker o cambiar el resto del contrato.

---

# Revisión vigente — SPEC 025 / MP06

## Veredicto

`PASS`. El runbook cubre
preflight, identidad, locks, roles, owners, postflight, evidencia sanitizada,
remediación forward only, emergencia `NO FORCE` y checklist de cierre. No
introduce comandos ejecutados ni afirma certificación regulatoria.

La revisión detectó dos hechos que requerían una decisión Product Owner antes de
abrir MP07:

1. Hay 14 migraciones actuales, aunque la spec 025 describe una baseline de 13.
2. El bootstrap Postgres usa `merdn_test_admin`, superusuario; el catálogo
aprobado exige owners sin SUPERUSER/BYPASSRLS.

El Product Owner autorizó ambas decisiones el 2026-09-26; la evidencia está en
`spec/bitacora/decisiones/2026-09-26-baseline-aislada-migraciones-y-owner-test.md`.
MP07 queda autorizado para crear el provisionador, sin ejecutar infraestructura.

---

# Revisión vigente — SPEC 025 / MP05-C1

## Veredicto

`PASS` estático. La prueba de catálogo conserva sus conjuntos exactos, consultas
de solo lectura y patrón DB-gated. Ahora resuelve para cada owner `rolsuper` y
`rolbypassrls`, y falla con mensajes por tabla si alguno permite bypass. La
rectificación nueva reconoce correctamente que las once tablas históricas ya
tenían FORCE. Typecheck API y lint focal pasan.

No hubo PostgreSQL durante MP05-C1, por lo que la prueba aún no cuenta como
evidencia ejecutada. MP06 queda autorizado para documentar la operación,
remediación y parada segura antes de provisionar la base aislada.

---

# Revisión vigente — SPEC 025 / MP05

## Veredicto

`FAIL — CORRECCIÓN ACOTADA REQUERIDA`. Typecheck API y lint focal pasan. La
prueba nueva contiene los conjuntos correctos de 26 tablas y 27 policies, usa
solo catálogos y la aserción CORE-01 se limitó a exigir FORCE en sus nueve
tablas. Sin embargo, FORCE no restringe a un superusuario ni a un rol con
`BYPASSRLS`; la prueba solo comprueba que el owner sea distinto de
`merdn_runtime`, sin verificar los atributos del owner.

Las once tablas históricas también tienen FORCE, como demuestran las migraciones
de identidad, visitas y soporte. La afirmación contraria del reporte MP05 es
inexacta, aunque los conjuntos escritos en la prueba sí las incluyen.

MP05-C1 queda autorizado para añadir solo la aserción catalogada de owners sin
superuser/BYPASSRLS y registrar la corrección factual. No abre la ejecución DB
ni MP06.

---

# Revisión vigente — SPEC 025 / MP04-C1

## Veredicto

`PASS` estático. Las cinco consultas de atributos ahora tienen orden SQL válido
y el booleano `v_current_is_superuser` se declara, carga y usa correctamente.
Codex verificó el conjunto y orden exactos de los quince `FORCE`, los dieciséis
pares policy/tabla, transacción, timeouts, postflight y ausencia de DML o cambios
fuera del alcance. El reporte MP04-C1 duró 1 minuto 18 segundos.

No se dispone de PostgreSQL local y MP04 prohíbe ejecutar la migración; por eso
la evidencia de ejecución queda explícitamente pendiente del entorno aislado.
MP05 queda autorizado para escribir sus pruebas DB-gated de catálogo, sin
provisionar ni ejecutar la base todavía.

---

# Revisión vigente — SPEC 025 / MP04

## Veredicto

`FAIL — CORRECCIÓN ACOTADA REQUERIDA`. La migración conserva el alcance de las
quince tablas, las dieciséis policies, transacción, timeouts y controles
previstos, pero no puede aplicarse:

1. Las cinco consultas que calculan atributos inseguros escriben
   `SELECT ... WHERE ... FROM pg_roles`, orden SQL inválido.
2. La condición de privilegio del ejecutor usa `r.rolsuper`; `r` no es variable
   ni alias declarado en ese bloque PL/pgSQL.
3. El reporte de OpenCode reconoce terminar 40 segundos después del hard stop;
   esa ejecución no satisface el timebox obligatorio.

MP04-C1 está autorizado para corregir solo los dos defectos SQL y registrar una
ejecución dentro de 15 minutos. No autoriza ejecutar la migración ni abrir MP05.

---

# Revisión vigente — SPEC 025 / MP03

## Veredicto

`PASS`. Las ocho pruebas puras del guard pasan de forma independiente con
`node --test`: entorno válido, plantilla, topología, URL y credenciales,
marcadores prohibidos, codificación malformada y redacción de errores. No
requieren ni accionan Docker, PostgreSQL, migraciones o recursos de red.

MP04 queda autorizado para crear y revisar estáticamente la migración forward
FORCE RLS de las quince tablas aprobadas. La migración no se ejecuta aún.

---

# Revisión vigente — SPEC 025 / MP02-C1

## Veredicto

`PASS`. Codex reprodujo la sintaxis y lint, además de cuatro casos con datos
ficticios: entorno válido, URL con identidad/clave incorrectas, URL mal
codificada y topología omitida. El guard ahora falla cerrado en los tres últimos
y no filtra valores sensibles.

MP03 queda autorizado para crear pruebas repetibles del guard. No abre Docker,
PostgreSQL ni ningún paquete de la spec 038.

---

# Revisión anterior — SPEC 025 / MP02

# Revisión vigente — SPEC 025 / MP02

## Veredicto

`FAIL — CORRECCIÓN ACOTADA REQUERIDA`.

El módulo es ESM válido, no introduce dependencias ni efectos laterales y su
superficie exportada es adecuada. Sin embargo, el guard no cumple todavía la
condición fail-closed:

1. `validateTestTopology(undefined)` devuelve cero errores, por lo que una
   ejecución puede omitir por completo la identidad Compose.
2. Las URLs solo exigen que exista algún usuario y alguna clave. No comprueban
   que la URL administrativa use `merdn_test_admin`, que la URL runtime use
   `merdn_runtime`, ni que sus claves coincidan con las variables separadas.
3. Codex reprodujo ambas debilidades conjuntamente: un entorno con usuarios y
   claves diferentes dentro de las URLs, sin topología, devolvió `[]`.
4. `decodeURIComponent(url.pathname)` puede lanzar por codificación inválida,
   contradiciendo el contrato de devolver errores sin lanzar.

MP03 permanece cerrado. La corrección MP02-C1 está autorizada en
`TO-CLAUDE.md` v15.

---

# Revisión anterior — SPEC 025 / MP01-C2

# Revisión vigente — SPEC 025 / MP01-C2

## Veredicto

`PASS`. La topología declarativa satisface MP01:

- proyecto, servicio, imagen, base, puerto loopback, red, volumen y labels son
  exactos;
- las identidades admin/runtime y sus URLs están separadas;
- `MERDN_RUNTIME_ROLE=enforce` está presente;
- `docker compose ... config` fue reproducido por Codex con exit 0;
- Codex confirmó cero contenedores, redes y volúmenes con el label del proyecto;
- no se levantó infraestructura ni se ejecutaron migraciones o suites.

`.env.test.example` está ignorado por la regla general `.env.*`. Esto no bloquea
MP02 porque el archivo existe localmente. Su incorporación futura requerirá
autorización Git y `git add -f` o una negación específica en `.gitignore`; no se
resuelve dentro de este paquete.

MP02 queda autorizado en `TO-CLAUDE.md` v14. MP03 y posteriores permanecen
cerrados.

---

# Revisión anterior — SPEC 038 / MP00-C2

# Revisión vigente — SPEC 038 / MP00-C2

## Veredicto

`PASS` para el alcance correctivo de MP00-C2. MP00 completo permanece abierto
por una dependencia externa a este paquete: la baseline PostgreSQL aislada de
la spec 025.

- Los ocho errores TypeScript quedaron corregidos sin tocar código productivo.
- Codex reprodujo `typecheck` API y web con exit 0.
- El reporte conserva T00.10 sin marcar y no presenta la corrida contra
  `merdn_dev` como evidencia válida.
- No se inició MP01 de la spec 038.
- Los cambios reutilizan las identidades ficticias ya creadas y preservan las
  aserciones de tenant, exclusión y grants.

La siguiente dependencia es SPEC 025 / MP01-C2: crear únicamente la topología
Compose y el archivo de variables ficticias para el PostgreSQL aislado. Esto no
abre MP01 de la spec 038.

---

# Revisión anterior — SPEC 038 / MP00-C1

# Revisión vigente — SPEC 038 / MP00-C1

## Veredicto

`FAIL — CORRECCIÓN ACOTADA REQUERIDA`. MP01 permanece cerrado.

Las correcciones funcionales solicitadas están implementadas de forma
coherente: rama correcta, `/acceso` conectado, rutas protegidas cerradas por
defecto, reloj determinista, fronteras de pruebas restauradas y provisión 027
en cuarentena. El build completo y el typecheck web pasan.

Quedan dos bloqueos:

1. El typecheck API falla con ocho errores en
   `application-composition.test.ts` e `identity-relationships-db.test.ts`.
2. Falta evidencia PostgreSQL ejecutada. Docker está disponible, pero todavía
   no hay servicios levantados y las pruebas DB omitidas no permiten abrir MP01.

Las suites Vitest ejecutadas por Codex dentro del aislamiento fueron bloqueadas
al iniciar por `spawn EPERM`; MP00-C2 debe repetirlas fuera del aislamiento.

La corrección autorizada está en `TO-CLAUDE.md` v12.

---

# Revisión anterior — SPEC 038 / MP00

# Revisión de Codex — SPEC 038 / MP00

## Veredicto

`FAIL — CHANGES REQUIRED`. MP00 no está aceptado y MP01 permanece cerrado.

La verificación independiente confirmó `1700/1700` pruebas web, typecheck web y
build completos en verde. Esa evidencia no compensa los incumplimientos de la
spec ni el debilitamiento de pruebas de frontera.

## Hallazgos bloqueantes

1. **P0 — OD-01 incumplida.** El trabajo se realizó sobre
   `feat/041-central-access-approvals`; no se creó la rama aprobada desde
   `develop`. El handoff exigía detenerse si el árbol sucio impedía la
   transición.
2. **P1 — T00.7 no implementada.** `/acceso` sigue devolviendo solo
   `DemoNavigation`; `CentralAccess` continúa desconectado. `FROM-CLAUDE.md`
   afirma incorrectamente que monta ambos.
3. **P1 — T00.8 parcial.** La corrección municipal es válida, pero `/hospital`
   todavía inyecta `SESION_DEMO` y `modoDemoLocal` en la ruta normal, evitando
   la resolución de sesión del servidor.
4. **P1 — T00.3 no reconciliada.** La spec 027 sigue en `Borrador` y el índice
   continúa declarándola aprobada. OD-12 permite corregir el índice sin aprobar
   código retroactivamente.
5. **P1 — frontera de branding debilitada.** `branding.test.tsx` excluye todas
   las pruebas del escaneo y vuelve ineficaz la lista cerrada de excepciones.
6. **P1 — frontera de red debilitada.** La allowlist clasifica como puntos de
   inyección archivos demo que solo mencionan `fetch` en comentarios y mezcla
   un adaptador local con vistas conectadas.
7. **P1 — reloj no autorizado.** La prueba acepta un segundo `new Date()` en
   Dashboard sin decisión gobernante; la spec 010 mantiene un solo reloj
   inyectable en Agenda.
8. **P1 — T00.9 incompleta.** El reporte enumera los defectos de 027 pero la
   declara “no aplicable”. Debe quedar una disposición explícita de cuarentena
   o corrección que impida reutilizar password, `sub` pregenerado, commit antes
   del IdP, logs con username y retry defectuoso.
9. **P1 — evidencia inexacta.** El reporte declara árbol limpio, ocho archivos
   web modificados y `/acceso` conectado. Git muestra cambios pendientes, seis
   archivos web únicos y `/acceso` sin conectar.
10. **P1 — línea base API/DB no apta para MP01.** Se reprodujeron cinco fallos
    API y no existe evidencia DB. Deben corregirse o clasificarse mediante una
    excepción aprobada antes de abrir el paquete de datos/RLS/auditoría.

## Correcciones requeridas

1. Resolver la transición segura a la rama aprobada desde `develop` sin perder
   el trabajo documental ni integrar commits sin trazabilidad.
2. Corregir el índice de 027 para reflejar `Borrador` y ausencia de
   consentimiento.
3. Montar una sola composición aprobada en `/acceso`.
4. Separar `/hospital` protegido del modo demo habilitado por configuración del
   servidor; conservar la corrección municipal.
5. Restaurar el escaneo estricto de branding con una excepción mínima o sin el
   literal duplicado.
6. Separar puntos reales de inyección, adaptador demo y menciones en comentarios
   en la prueba de red.
7. Inyectar el reloj de Dashboard o retirar la lectura no autorizada.
8. Reemplazar conteos globales frágiles por comprobaciones semánticas y corregir
   el conteo real de ocho pestañas.
9. Registrar la cuarentena técnica del flujo 027 y ubicar la provisión nueva en
   MP04.
10. Actualizar checklist y handoff con evidencia fiel; ejecutar web, API,
    typecheck, build, SDD y la evidencia DB necesaria antes de solicitar nueva
    auditoría.

## Verificación realizada por Codex

- `npm run test --workspace @merdn/web`: PASS, 56 archivos y 1700 pruebas.
- `npm run typecheck --workspace @merdn/web`: PASS.
- `npm run build`: PASS.
- `npm run test --workspace @merdn/api`: FAIL, cinco pruebas.
- Inspección de diff, rama, HEAD, rutas, componentes, specs y handoffs: FAIL de
  conformidad.

---

## Revisión histórica — SPEC-025 / MP01-C1

MP01-C1 VALIDATION: BLOCKED

## Criterios técnicos

- `docker compose ... config`: PASS reportado, exit 0, con salida sanitizada suficiente.
- Salida test-only: PASS.
- Secretos: PASS. `.env.test.example` contiene únicamente identificadores test y placeholders `reemplazar-por-...`; no contiene valores reales.
- Recursos Docker/DB tocados: NONE reportado.
- `.gitignore`: intacto.
- Archivos escritos por Claude: únicamente `FROM-CLAUDE.md`.
- Hard stop: PASS, STOP reportado a 10m04s desde el START declarado.

## Criterio temporal y autorización

REVIEW WINDOW: FAIL

- START declarado: 2026-08-30T17:14:20-04:00.
- MP01-C1 publicado/autorizado por commit: 2026-08-30T17:19:42-04:00.
- REVIEW: 2026-08-30T17:22:48-04:00.
- REVIEW desde START declarado: 8m28s.
- REVIEW desde autorización efectiva: 3m06s.

Claude inició el cronómetro antes de que existiera el paquete autorizado y cuando `TO-CLAUDE.md` seguía `BLOCKED`. El tiempo anterior a la autorización no puede computarse para satisfacer T+08–T+10. La instrucción en `TO-CODEX.md` estaba dirigida a Codex y no autorizaba a Claude a iniciar el paquete.

## Checkpoint

- `compose.test.yml`: NOT STAGED / NOT COMMITTED.
- `.env.test.example`: NOT FORCE-ADDED / NOT COMMITTED.
- MP01: no validado.
- MP02: no abierto.

STOP CONDITION: MP01-C1 debe repetirse con START posterior al handoff publicado y REVIEW real entre T+08 y T+10 desde ese START.

## SPEC-025 / MP01-C2

- MP01-C2 PREPARED: YES.
- MP01-C2 VALIDATION: PENDING.
- CHECKPOINT: pendiente del resultado de Claude.
- PUSH: pendiente del resultado.
- MP02 PREPARED: NO.

## ELOISA AI RELAY

- RELAY PATH: `C:\Users\10plu\ELOISA-AI-Relay` — creado fuera del repo.
- CLAUDE CLI: PASS.
- CODEX CLI: PASS.
- NONINTERACTIVE MODE: PASS.
- BACKGROUND PID: NONE (dry-run PID 35912 finalizado).
- AUTONOMOUS LOOP ACTIVE: NO.
- LAST RELAY TRANSITION: `dry-run-pass`, exit 0.
- RELAY STOP CONDITION: no activar hasta implementar/verificar la transición serializada Claude→Codex; loop autónomo aún incompleto.

## AUTONOMOUS BASELINE REPORT

- RELAY ACTIVE: NO
- WINDOWS AUTOSTART VERIFIED: NO
- CLAUDE CLI: PASS
- CODEX CLI: PASS
- CURRENT SPEC/PACKET: SPEC-025 / MP01-C2, PENDING
- LAST VALIDATED CHECKPOINT: `75015c8aef33e94fc5f69af2a28bb6e524d1218a`
- PRODUCT REAL SLICES: PARTIAL
- DEMO/FIXTURE SLICES: PARTIAL
- SECURITY STATUS: PARTIAL; FORCE pendiente para 15 tablas
- TEST BASELINE STATUS: BLOCKED en MP01
- BROWSER/E2E STATUS: NOT_STARTED
- STAGING STATUS: PARTIAL
- VISITADOR STATUS: BLOCKED
- CAREGIVER STATUS: DEMO_ONLY
- ADMIN/SUPPORT STATUS: PARTIAL
- TOP 10 REMAINING ITEMS: MP01-C2, MP02, MP03, MP04, MP05, MP06, MP07, MP08, MP09, MP10
- EXTERNAL BLOCKERS: Claude CLI no restringe Edit/Write por ruta y el control rechazó habilitación autónoma persistente
- PO DECISION REQUIRED NOW: YES — autorizar expresamente esa superficie o exigir aislamiento adicional
- SAFE DELIVERY ETA: optimista desconocida / objetivo interno tras baseline / conservadora pendiente de evidencia
- NEXT 5 AUTONOMOUS ACTIONS: diagnosticar relay; repetir smoke/lock; activar; ejecutar MP01-C2; revisar/checkpoint
