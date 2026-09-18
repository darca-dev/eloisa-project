# Investigación 008 - Agregados municipales protegidos

Medido sobre `develop` el 2026-08-25. Cada hallazgo indica el comando o la ruta
que lo respalda. Lo que no se pudo comprobar está en R18.

## R1. La superficie es de exactamente dos lecturas

```
grep -nE "@(Controller|Get|Post|Patch|Delete|UseGuards)" apps/api/src/municipality/municipality.controller.ts
```

Devuelve `@Controller('api/v1/municipality')`, `@UseGuards(MunicipalAggregateAccessGuard)`,
`@Get('population-summary')` y `@Get('territory-summary')`. No hay `@Post`,
`@Patch`, `@Delete`, `@Param`, `@Query` ni `@Body` en todo el archivo: ninguna
ruta admite identificador, filtro ni parámetro de consulta. El contexto lo
resuelve íntegramente el servidor (`municipality.controller.ts:50`).

## R2. La identidad institucional NACIÓ aquí, no en Hospital

Este es el hallazgo de atribución más importante y contradice la lectura
intuitiva de que la autenticación institucional pertenece a Hospital.

```
git show --diff-filter=A --name-only --format="" 4094e88
```

El commit `4094e88` («Implement Municipality CORE-01») **crea** trece archivos de
`apps/api/src/institutional-auth/`: `institutional-audit.service.ts`,
`institutional-auth.config.ts`, `.contract.ts`, `.controller.ts`, `.dto.ts`,
`.module.ts`, `.service.ts`, `.unit.test.ts`, `institutional-secret.ts`,
`institutional-session.cookie.ts`, `institutional-signin-rate-limit.guard.ts`,
`municipal-viewer.guard.ts` y su prueba.

```
git log --oneline --follow -- apps/api/src/institutional-auth/
```

Lista `4094e88` como el commit más antiguo del directorio. Lo que llegó DESPUÉS,
verificado con `git log --diff-filter=A` por archivo:

| Archivo | Commit que lo añade | Spec |
|---|---|---|
| `hospital-patient-viewer.guard.ts` | `30fb378` (2026-08-22) | 009 |
| `hospital-scheduler.guard.ts` | `3d63154` (2026-08-22) | 010 |
| `institutional-same-origin.guard.ts` | `231f6b6` (2026-08-23) | 014 |
| `institutional-session.guard.ts` | `231f6b6` (2026-08-23) | 014 |
| `caregiver-relationship-manager.guard.ts` | `03255de` (2026-08-24) | 011 |

Lo mismo ocurre con el enum. La migración de esta capacidad crea
`InstitutionalRole` con UN solo valor (`migration.sql:36`); los otros tres se
añaden después:

```
grep -rn 'ALTER TYPE "InstitutionalRole"' prisma/migrations/*/migration.sql
```
- `20260822140000_hospital_core_01` añade `HOSPITAL_PATIENT_VIEWER`
- `20260822160000_hospital_core_02` añade `HOSPITAL_SCHEDULER`
- `20260823120000_identity_relationships_core_01` añade `CAREGIVER_RELATIONSHIP_MANAGER`

También cambió la superficie del controlador institucional. En `4094e88` tenía
solo `POST` (con `InstitutionalSignInRateLimitGuard`) y `DELETE current` (con
`MunicipalViewerGuard`):

```
git show 4094e88:apps/api/src/institutional-auth/institutional-auth.controller.ts | grep -nE "@(Post|Get|Delete|UseGuards)"
```

Hoy tiene además `GET current`, `InstitutionalSameOriginGuard` e
`InstitutionalSessionGuard`, y el `DELETE` ya no exige rol municipal. El propio
archivo lo declara: «TASK-MUNICIPALITY-CORE-01, FR-13 y OD-01; ampliada por
TASK-HOSPITAL-CORE-01 §8.0» (`institutional-auth.controller.ts:56`).

**Conclusión honesta:** esta capacidad construyó el cimiento de autenticación
institucional de todo MERDN. Las specs 009, 010, 011 y 014 lo extendieron.

## R3. Lo que crea la migración

```
grep -oE 'CREATE TABLE "[a-z_]+"|CREATE TYPE "[A-Za-z]+"|ENABLE ROW LEVEL SECURITY|CREATE POLICY' prisma/migrations/20260822130000_municipality_core_01/migration.sql
```

- Dos enums nuevos: `InstitutionalRole`, `InstitutionalIdentityStatus`
  (`migration.sql:36` y `:38`).
- Cuatro valores nuevos en `AuditEventType`, dos en `AuditActorType`, uno
  (`DENIED`) en `AuditOutcome` (`:26`–`:34`).
- Tres columnas NULLABLE en `audit_event` (`actorRole`, `endpoint`,
  `correlationId`) y la relajación de `resourceId` a NULL, acotada por un CHECK
  que solo la permite en los dos eventos de acceso agregado (`:46`–`:61`).
- Dos tablas: `institutional_identity` e `institutional_session` (`:72`, `:106`).
- RLS activa y una política por tabla contra `merdn_current_tenant()`
  (`:159`–`:170`).
- `GRANT SELECT, INSERT, UPDATE` a `merdn_runtime`, **sin `DELETE`**: una sesión
  se revoca, no se borra (`:154`–`:157`).
- CHECK de forma sobre los secretos: el hash debe ser `^[0-9a-f]{128}$` y la sal
  `^[0-9a-f]{32}$` (`:104`); el token de sesión, `^[0-9a-f]{64}$` (`:144`). La
  base impide almacenar por error un secreto legible.
- Clave foránea COMPUESTA `(identityId, tenantId)`: una sesión no puede apuntar
  a una identidad de otra institución aunque se conozca su UUID (`:135`).

`prisma/migrations/ROLLBACK-municipality_core_01.sql` existe, es explícito en que
no se ejecuta automáticamente y declara que no toca ningún dato de CORE-01.

## R4. La supresión hace mucho más que el umbral

`suppression.ts` implementa dos capas. La primaria es trivial
(`applyPrimarySuppression`, `:102`): `0` exacto, `1`–`4` suprimido, `>=5` exacto.

La segunda es lo interesante. `protectDisclosure()` (`:126`) modela la respuesta
como un sistema lineal: cada celda publicada es la suma de un conjunto de
átomos disjuntos. `primerAtomoRevelado()` (`:268`) construye la matriz de las
celdas exactas restringida a las columnas desconocidas, la lleva a forma
escalonada reducida y comprueba si el vector indicador de un átomo sensible
pertenece al espacio de filas. Si pertenece, ese átomo está determinado: se
suprime una celda agregada más y se repite.

La aritmética es racional exacta con `bigint` (`:312`–`:398`). El comentario del
archivo explica por qué (`:20`): la coma flotante «podría declarar segura una
celda que no lo es». Es una decisión de seguridad, no de estilo.

Salvaguardas medidas:
- `EXACT_ANALYSIS_MAX_UNKNOWN_ATOMS = 96` (`:68`). Por encima se activa un modo
  conservador que suprime toda celda agregada que contenga un átomo sensible; el
  comentario declara que ese modo publica MENOS información, «nunca más».
- El bucle está acotado por `system.cells.length` y el comentario `:166` prueba
  la terminación.
- Desempate determinista por clave al elegir qué celda suprimir (`:206`), de modo
  que dos consultas idénticas suprimen lo mismo.
- Celdas con el mismo conjunto de átomos comparten estado: la misma cifra no
  puede salir suprimida en un sitio y exacta en otro (`:122`).
- El tipo `SuppressedCount` es una unión discriminada donde la variante
  `SUPPRESSED` tiene `value: null` (`:37`): el valor real 1–4 no puede
  serializarse por accidente.

## R5. Dos protecciones estructurales, además del umbral

**No se publica el resto.** `exclusiveRegionOf()` clasifica a cada persona en una
de ocho regiones, pero solo se publican siete: `noneOfThree` queda fuera
(`population-summary.ts:58`). El comentario declara la doble razón: es
información que no aporta y su ausencia impide reconstruir una región suprimida
restando del total.

**Cuatro sistemas independientes en territorio.**
`buildTerritorySummary()` ejecuta `protectDisclosure()` una vez por cada métrica
—`unique`, `older`, `disability`, `homeCare`— con su propio conjunto de átomos
(`territory-summary.ts:143`). Y `construirCeldas()` declara la columna de
pendientes solo para `unique`, y solo cuando hay más de un nodo pendiente en el
municipio (`:290`), precisamente para no declarar dos veces la misma cifra.

## R6. La consulta es mínima y el tenant nunca viene del navegador

`municipality.service.ts:59` toma `tenantId` de `context.principal.tenantId`, es
decir de la identidad persistida que el guard validó. Toda lectura ocurre dentro
de `this.prisma.withTenant(tenantId, ...)` (`:61`, `:108`) y además filtra
explícitamente por `tenantId` en el `where`: filtro y RLS, no uno u otro.

El `select` es deliberadamente pobre. Para población lee `person.birthDate` y
`populationMemberships.populationType`; para territorio añade `areaType`,
`localUnitId`, `localityPendingNormalization` y los nombres de exhibición. La
dirección exacta y el texto libre de localidad **no se seleccionan siquiera**
(`:31`).

Solo cuenta pacientes `status: 'ACTIVE'` (`:63`, `:110`).

`tieneMembresia()` (`:196`) consulta `DISABILITY` y `HOME_CARE_REQUIRED`, pero
**nunca** `OLDER_ADULT_60_PLUS`: la edad se deriva siempre de la fecha de
nacimiento, porque la pertenencia persistida queda obsoleta cuando alguien
cumple 60 después de inscribirse. `municipality-aggregates.db.test.ts:269`
prueba exactamente ese caso.

## R7. La cadena de guards y la auditoría de las denegaciones

`MunicipalAggregateAccessGuard` no reimplementa la autorización: **compone**
`MunicipalViewerGuard` (`municipal-aggregate-access.guard.ts:60`). Añade solo el
rastro de las denegaciones, que el controlador no puede registrar porque nunca
llega a ejecutarse.

Detalles medidos:
- Un fallo al auditar NO convierte una denegación en permiso: el `catch` de
  `registrarDenegacion()` solo escribe una advertencia y la excepción original se
  relanza siempre (`:99`–`:107`, `:69`).
- `correlationOf()` (`:112`) valida la cabecera `x-request-id` contra
  `^[A-Za-z0-9_-]{1,64}$` y cae a `'sin-correlacion'`: un cliente no puede
  inyectar contenido arbitrario en la auditoría.
- `endpointOf()` (`:122`) registra método y ruta, «nunca parámetros, filtros ni
  cuerpo».
- El acceso CONCEDIDO lo audita el servicio dentro de la misma transacción que
  sirve los datos (`municipality.service.ts:87`, `:154`), de modo que no puede
  existir respuesta servida sin evento.

`institutional-audit.service.ts:17` enumera lo que deliberadamente NO se
registra: credenciales, tokens y hashes, conteos «ni siquiera agregados»,
cuerpos, parámetros, SQL, datos individuales, IP y cabeceras.

## R8. Contrato de estados y cabeceras

`municipal-viewer.guard.ts:98` lanza `401` sin sesión válida y `:105` lanza `403`
cuando el rol no es `MUNICIPAL_VIEWER`. Su docstring declara que la cookie de
autoinscripción de paciente cae en el `401` porque «NO autentica a Alcaldía»
(`:38`); `municipality.api.test.ts:252` lo prueba.

Ante `RuntimeContextUnavailableError` el guard falla cerrado con `503` y deja el
detalle solo en el registro del servidor (`:80`–`:93`). El controlador repite la
misma traducción (`municipality.controller.ts:181`).

`noStore()` (`municipality.controller.ts:200`) fija `Cache-Control: private,
no-store`, `Pragma: no-cache` y `Vary: Cookie` en las dos rutas.

## R9. El lado web no tiene repliegue a fixtures

`municipalityAggregatesClient.ts` es la única frontera de red de la feature. No
lanza nunca: devuelve `{kind:'ok'|'no-autorizado'|'error'}` (`:25`). Trata `401`
y `403` igual, a propósito: «la diferencia no aporta nada que deba deducirse
desde el navegador» (`:50`). Pide `cache: 'no-store'` y no escribe en ningún
almacenamiento.

`useMunicipalityAggregate.ts:23` fuerza que el primer render sea siempre
`cargando`, incluso en servidor, y cancela con `AbortController` al desmontar.

`municipalityAggregates.ts:116` declara el tipo `EstadoAgregado` con el
comentario explícito de que «NO existe un estado fixture».

En la interfaz, un conteo suprimido muestra su `display` (`<5`) más la nota
«Grupo pequeño protegido: no se publica la cifra exacta»
(`MunicipalityPopulation.tsx:159`). El aviso general de la regla está siempre
visible en el encabezado (`:137`), venga o no suprimida alguna celda. En
territorio, la celda simplemente muestra `metrics.*.display`
(`MunicipalityTerritory.tsx:96`). Las métricas oficiales se pintan como `—` con
la leyenda «Dato oficial no disponible» (`MunicipalityPopulation.tsx:209`).

## R10. BRECHA: no existe acceso institucional desde Alcaldía

```
grep -rl institutional apps/web/src
```

Devuelve **solo** archivos de `apps/web/src/features/hospital/`. La feature
`municipality` no contiene ninguna referencia a la sesión institucional.

```
grep -rn "api/v1/institutional/sessions" apps/web/src
```

Devuelve dos líneas, ambas en
`apps/web/src/features/hospital/hospitalInstitutionClient.ts` (`:52` y `:154`).
La única función del navegador que abre una sesión es
`abrirSesionInstitucional()` (`:272`), que llegó con la spec 014.

`apps/web/src/app/municipality/page.tsx` monta `MunicipalityShell` sin ninguna
puerta de acceso, y `MunicipalityShell.tsx` no importa nada de sesión.

Consecuencia medida: las dos vistas conectadas piden los agregados con
`credentials: 'include'`, pero la experiencia Alcaldía no ofrece manera de
obtener esa cookie. Sin haberla conseguido por otra vía, el estado resultante es
siempre `no-autorizado`.

## R11. Coexistencia de datos reales y fixtures en la misma experiencia

`municipalityViews.ts:18` declara trece módulos y `:55` afirma que los trece
tienen contenido propio. Solo dos consumen la API:

```
grep -l "municipalityAggregatesClient" apps/web/src/features/municipality/*.tsx
```
devuelve `MunicipalityPopulation.tsx` y `MunicipalityTerritory.tsx`.

Los otros once siguen leyendo `municipalityConfig.ts`. `MunicipalityHome.tsx:73`
pinta sus KPI bajo la etiqueta «Datos demostrativos»
(`municipalityConfig.ts:4868`), mientras las dos vistas conectadas se rotulan
«Datos registrados en la plataforma» (`municipalityAggregates.ts:134`). La
coexistencia está etiquetada, no oculta, pero es real: `inicio` muestra «Total de
beneficiarios únicos: 3.050» (`municipalityConfig.ts:1046`) y `poblacion` muestra
el conteo de PostgreSQL.

El bloque de fixtures de `poblacion` sigue en `municipalityConfig.ts` (3.050,
1.284, 452, 268, 78). La vista conectada solo consume de ahí los títulos
(`MunicipalityPopulation.tsx:347`), no las cifras.

## R12. Dos documentos internos quedaron obsoletos tras la conexión

`apps/web/src/app/municipality/page.tsx:12` sigue afirmando que la experiencia
«no consume entorno, no llama a la API y no crea sesión, cuenta ni dato
persistente». Desde `4094e88` eso es falso para `poblacion` y `territorio`.

`municipalityPrivacidad.test.tsx:196` («el código de la feature no consulta red
ni almacenamiento») busca el patrón `/\bfetch\s*\(/` en cada archivo fuente de la
feature.

```
grep -nE "\bfetch\s*\(" apps/web/src/features/municipality/*.ts apps/web/src/features/municipality/*.tsx | grep -v test
```

No devuelve nada. El cliente sí hace una petición real, pero la ejecuta a través
de un parámetro `fetchImpl` (`municipalityAggregatesClient.ts:38`) y toma la URL
de `resolvePublicApiBaseUrl()`, de modo que ningún literal `fetch(` ni `https://`
aparece en el archivo. La prueba pasa; su título ya no describe el sistema. Las
dos pruebas vecinas (`:228` y `:248`) sí fueron actualizadas y acotan la frontera
de red a un único archivo, que es el control que de verdad sigue vigente.

## R13. Sin límite de tasa ni tiempo máximo en las rutas municipales

```
grep -riE "timeout|statement_timeout|rate.limit" apps/api/src/municipality/
```

No devuelve nada. El único límite de tasa del ámbito institucional es
`InstitutionalSignInRateLimitGuard`, aplicado a `POST
/api/v1/institutional/sessions` (`institutional-auth.controller.ts:84`). El punto
4 de «Security and Privacy Requirements» de la Task
(`tasks/TASK-MUNICIPALITY-CORE-01.md`) pedía «límites de tiempo»: no se
implementaron. Las rutas municipales tampoco llevan
`InstitutionalSameOriginGuard`; el control de origen para lecturas descansa en la
configuración CORS (`apps/api/src/main.ts:38`, `environment.webOrigins`).

## R14. Métricas oficiales: ausencia declarada, no calculada

`buildOfficialMetrics()` (`population-summary.ts:199`) devuelve las cuatro claves
de `OFFICIAL_METRIC_KEYS` con `status: 'UNAVAILABLE'` y `value: null`, sin
condicional alguno. El tipo `OfficialMetric` (`municipality.contract.ts:75`)
solo admite ese estado y ese valor: el contrato hace imposible publicar un
número ahí sin cambiar el tipo. `population-summary.test.ts:223` prueba que no
hay porcentajes, cobertura ni denominadores inventados.

## R15. Aprovisionamiento por configuración, credencial compartida

`institutional-auth.config.ts:102` declara `MUNICIPAL_VIEWER` con
`secretVariable: MERDN_MUNICIPAL_VIEWER_SECRET` y `codeVariable:
MERDN_MUNICIPAL_VIEWER_CODE`, con el código histórico `municipal-viewer` por
defecto (`institutional-auth.contract.ts:68`). La docstring (`:28`) declara la
regla: sin credencial válida la identidad NO se aprovisiona y su superficie
responde como no autenticada; «JAMÁS existe un valor por defecto para una
credencial».

La credencial es compartida por rol: no hay usuarios nominales, ni recuperación,
ni administración. Está reconocido en el propio repositorio
(`hospitalInstitutionClient.ts:14`): convertir esa credencial en un nombre propio
«afirmaría una atribución que el sistema no puede sostener».

## R16. Decisiones diferidas de la Task, todavía abiertas

`tasks/TASK-MUNICIPALITY-CORE-01.md:192`–`:196`:

| ID | Estado | Qué queda abierto |
|---|---|---|
| OD-01 | CERRADA | identidad institucional mínima y rol `MUNICIPAL_VIEWER` |
| OD-02 | CERRADA | regla de supresión 0/1–4/>=5 |
| OD-03 | CERRADA | adaptación de datos de la tabla territorial |
| OD-04 | DIFERIDA | definición de «registro completo»; por eso solo hay una métrica de calidad |
| OD-05 | DIFERIDA | validación jurídica del umbral; la regla vigente es salvaguarda de producto |

## R17. Cobertura de pruebas

Unitarias en `apps/api/src/municipality/`: `suppression.test.ts` (9 casos),
`population-summary.test.ts` (14), `territory-summary.test.ts` (10).

Integración en `apps/api/test/`: `municipality.api.test.ts` (17 casos) y
`municipality-aggregates.db.test.ts` (12), más el fixture compartido
`municipality-fixtures.ts`.

Web en `apps/web/src/features/municipality/`: `municipalityAggregatesClient.test.ts`
(9), `MunicipalityPopulation.test.tsx` (16), `MunicipalityTerritory.test.tsx` (16)
y `municipalityPrivacidad.test.tsx` (22, de las cuales las de red se comentan en
R12).

Casos notables por lo que prueban:
- `suppression.test.ts:155` «impide reconstruir una región suprimida restando de
  su total» y `:198` «un área con una sola unidad pequeña no delata su cifra por
  el municipio»: prueban la capa complementaria, no solo el umbral.
- `municipality.api.test.ts:212` «almacena solo el hash del token, nunca el token
  en claro» y `:230` «almacena la credencial únicamente como derivación».
- `municipality.api.test.ts:252` «la cookie de autoinscripción de paciente NO
  autentica a Alcaldía».
- `municipality-aggregates.db.test.ts:430` «el rol runtime no tiene privilegio de
  DELETE sobre identidad ni sesión» y `:468` «la base rechaza almacenar una
  credencial que no sea una derivación»: verifican la migración contra
  PostgreSQL, no contra la intención.
- `municipality-aggregates.db.test.ts:289` aislamiento entre instituciones.

## R18. Verificación no ejecutada

- **Ninguna prueba se ejecutó.** `node_modules` no está instalado y PostgreSQL no
  está levantado. Todo lo anterior es lectura de código, de migraciones y de
  historia de Git, no ejecución.
- `municipality.api.test.ts:88` y `municipality-aggregates.db.test.ts:43` usan
  `describe.skipIf(!puedeEjecutarse)` contra `inject('databaseAvailability')`:
  sin base de datos se marcan como NO EJECUTADAS. No puedo afirmar que pasen.
- No pude verificar el «API 300/300, Web 1095/1095» del mensaje de `4094e88`.
- **No se comprobó el comportamiento en un navegador.** La brecha de R10 está
  medida sobre el código (no existe ningún llamador de apertura de sesión en la
  feature `municipality`), no reproducida en ejecución. Queda pendiente confirmar
  si alguna otra vía —por ejemplo iniciar sesión desde `/hospital` con la
  credencial municipal— produce una cookie utilizable en `/municipality`.
- No se evaluó el rendimiento. `populationSummary()` hace `findMany` sobre todos
  los pacientes activos del tenant y agrega en memoria del proceso Node, no en
  SQL (`municipality.service.ts:62`); lo mismo `territorySummary()` con todas las
  direcciones (`:109`). Con un tenant grande eso podría importar, pero no se midió
  y no se afirma que sea un problema.
- No se auditó el coste del análisis exacto de supresión por debajo del límite de
  96 átomos desconocidos; solo se leyó que el límite existe y qué hace al
  superarse.
