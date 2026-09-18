# Especificación 008 - Agregados municipales protegidos

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specification: `tasks/TASK-MUNICIPALITY-CORE-01.md`.

**No existe auditoría registrada.** `ls reviews/` no contiene ningún
`REVIEW-MUNICIPALITY-CORE-01`. Las 20 auditorías congeladas de `reviews/` cubren
TASK-001, TASK-002, la serie 003H, la serie ALCALDIA-A, BRAND-01,
MERDN-ORCHESTRATOR-V1 y MVP-CORE-01; esta capacidad no está entre ellas. El
mensaje del commit `4094e88` declara «API 300/300, Web 1095/1095», pero esa es
una afirmación del implementador, no un veredicto de Codex. La ausencia de
auditoría es un dato relevante: los controles de privacidad descritos aquí —muy
en particular la supresión complementaria— nunca fueron revisados por un
segundo agente.

Esta spec cubre además un hecho de atribución que conviene no perder: **la
identidad y la sesión institucional de MERDN nacieron en este commit**, no en
Hospital. Ver `## Dependencias` y R2 de `research.md`.

## Objetivo

Que la Alcaldía pueda ver cuántas personas hay registradas y dónde están, sin
poder ver a ninguna persona, y sin que una cifra pequeña permita deducir quién
es. El sistema publica únicamente agregados calculados en el servidor, protege
los grupos de 1 a 4 personas, impide reconstruirlos restando de sus totales y
declara como no disponible toda métrica que exigiría una fuente oficial externa
que MERDN no tiene.

## Historia de usuario principal

Como funcionaria de la Alcaldía, quiero conocer la población beneficiaria
registrada y su distribución territorial para planear, sin acceder al registro
de ninguna persona concreta y sin que mis consultas puedan identificar a nadie.

## Qué hace hoy el sistema

| Capacidad | Dónde vive |
|---|---|
| `GET /api/v1/municipality/population-summary` | `apps/api/src/municipality/municipality.controller.ts:70` |
| `GET /api/v1/municipality/territory-summary` | `apps/api/src/municipality/municipality.controller.ts:111` |
| Denegación por defecto: `401` sin sesión, `403` sin rol `MUNICIPAL_VIEWER` | `apps/api/src/institutional-auth/municipal-viewer.guard.ts:98` y `:105` |
| Auditoría de la denegación, que el controlador no puede registrar | `apps/api/src/municipality/municipal-aggregate-access.guard.ts:66` |
| Auditoría del acceso concedido, en la MISMA transacción que sirve los datos | `apps/api/src/municipality/municipality.service.ts:87` y `:154` |
| Supresión primaria: `0` exacto, `1`–`4` como `<5`, `>=5` exacto | `apps/api/src/municipality/suppression.ts:102` |
| Supresión complementaria por álgebra lineal racional exacta con `bigint` | `apps/api/src/municipality/suppression.ts:175` y `:268` |
| Siete regiones exclusivas; el resto `noneOfThree` NO se publica | `apps/api/src/municipality/population-summary.ts:60` |
| `60+` derivado de la fecha de nacimiento, nunca de la pertenencia persistida | `apps/api/src/municipality/population-summary.ts:97` |
| Jerarquía `Municipio → Urbana/Rural → Barrio o vereda`, con nodo de pendientes | `apps/api/src/municipality/territory-summary.ts:91` |
| Cuatro métricas oficiales siempre `UNAVAILABLE`, con `value: null` | `apps/api/src/municipality/population-summary.ts:199` |
| `Cache-Control: private, no-store`, `Pragma`, `Vary: Cookie` | `apps/api/src/municipality/municipality.controller.ts:200` |
| Fail-closed ante contexto de ejecución no confirmado (`503`) | `apps/api/src/municipality/municipality.controller.ts:181` |
| Identidad institucional con credencial derivada por `scrypt` | `prisma/migrations/20260822130000_municipality_core_01/migration.sql:72` |
| Sesión institucional server-side, token solo como SHA-256 | misma migración, `:106` y `:142` |
| RLS y políticas en las dos tablas nuevas, sin privilegio de `DELETE` | misma migración, `:156`–`:170` |
| Cliente web tipado, sin secretos, sin repliegue a fixtures | `apps/web/src/features/municipality/municipalityAggregatesClient.ts` |
| Estados accesibles `cargando` / `listo` / `no-autorizado` / `error` | `apps/web/src/features/municipality/useMunicipalityAggregate.ts:23` |
| Vista Población conectada a datos reales | `apps/web/src/features/municipality/MunicipalityPopulation.tsx:359` |
| Vista Territorio conectada a datos reales | `apps/web/src/features/municipality/MunicipalityTerritory.tsx` |

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| `001-fundacion-tecnica-monorepo` | Monorepo, NestJS, Next.js, Prisma, PostgreSQL en Compose | Sin ella no hay API donde montar el módulo ni migraciones que aplicar |
| `005-experiencia-visual-alcaldia` | Shell `/municipality` y las vistas `MunicipalityPopulation.tsx` y `MunicipalityTerritory.tsx`, creadas en `672a11a` | Esta spec NO creó esas vistas: las CONECTÓ. Sin ellas no hay dónde mostrar la cifra |
| `006-marca-eloisa-isa` | Marca pública consumida por la feature (`@/config/branding`) | Las vistas rotulan la plataforma con la marca aprobada, no con la técnica |
| `007-inscripcion-paciente-persistente` | `PrismaService.withTenant()`, rol `merdn_runtime`, función `merdn_current_tenant()`, RLS y las tablas `person`, `patient`, `patient_address`, `population_membership` y el catálogo territorial | Son la ÚNICA fuente de las cifras publicadas y el único mecanismo de aislamiento por institución. Sin inscripción persistida los agregados son ceros exactos |

Dependencias externas:

- **PostgreSQL** con el rol de mínimo privilegio `merdn_runtime` y la función
  `merdn_current_tenant()`, ambos creados en
  `prisma/migrations/20260822120000_core_01_hardening/`.
- **Migración `prisma/migrations/20260822130000_municipality_core_01/`**,
  aditiva, con rollback documentado en
  `prisma/migrations/ROLLBACK-municipality_core_01.sql`.
- **Configuración de servidor**: `MERDN_MUNICIPAL_VIEWER_SECRET` (obligatoria,
  sin valor por defecto: sin ella la identidad no se aprovisiona y Alcaldía
  responde como no autenticada) y `MERDN_MUNICIPAL_VIEWER_CODE` (opcional, con
  el código histórico `municipal-viewer` por defecto).
- **NO depende de Keycloak ni de ningún OIDC.** La identidad institucional es
  propia de MERDN, con credencial COMPARTIDA por rol, derivada con `scrypt` y
  aprovisionada desde variables de entorno.

Specs que dependen de esta: `009-hospital-pacientes-api`,
`010-hospital-profesionales-agenda-api`, `011-identidad-humana-y-relaciones` y
`014-sesion-profesional-en-shell`. Las cuatro se apoyan en el módulo
`apps/api/src/institutional-auth/` y en los enums `InstitutionalRole` e
`InstitutionalIdentityStatus`, que esta capacidad creó.

## Escenarios de aceptación

1. Dada una petición sin cookie institucional vigente, cuando llega a cualquiera
   de los dos endpoints, entonces el sistema responde `401`, no ejecuta el
   controlador, no toca ningún dato y registra la denegación sin identificar a
   nadie.
2. Dada una identidad institucional autenticada cuyo rol no es
   `MUNICIPAL_VIEWER`, cuando consulta un agregado, entonces el sistema responde
   `403` sin confirmar que exista dato alguno detrás.
3. Dada la cookie de autoinscripción de paciente, cuando se presenta a un
   endpoint municipal, entonces NO autentica y el sistema responde `401`.
4. Dado un grupo de 1 a 4 personas en cualquier celda publicada, cuando se sirve
   la respuesta, entonces esa celda viaja como `{ status: 'SUPPRESSED', value:
   null, display: '<5' }` y el valor real nunca se serializa.
5. Dado un total exacto publicado junto a sus partes, cuando solo una parte
   quedaría suprimida y podría reconstruirse restando, entonces el sistema
   suprime además otra celda agregada hasta que ningún conteo sensible quede
   determinado por el sistema publicado.
6. Dada una persona que cumple 60 años el día de corte, cuando se calcula el
   agregado, entonces cuenta como `60+` aunque su pertenencia persistida no se
   haya actualizado; el día anterior no cuenta.
7. Dadas personas registradas en dos instituciones distintas, cuando una
   identidad municipal consulta, entonces solo ve las de su propia institución,
   por filtro explícito de `tenantId` y por RLS.
8. Dada una dirección cuya localidad no corresponde a ninguna unidad canónica,
   cuando se agrega el territorio, entonces cuenta en un nodo «Pendiente de
   normalización territorial» y su texto declarado NUNCA se devuelve.
9. Dado que MERDN no tiene fuente oficial externa, cuando se pide el agregado de
   población, entonces las cuatro métricas oficiales se declaran `UNAVAILABLE`
   con `value: null`, sin porcentaje, sin barra y sin fixture.
10. Dada una respuesta servida, cuando se completa, entonces existe su evento de
    auditoría, escrito en la misma transacción, sin credenciales, sin tokens,
    sin IP, sin cabeceras y sin conteos.
11. Dado un fallo de red o un `5xx`, cuando la vista lo recibe, entonces muestra
    su estado de error accesible y NUNCA sustituye la cifra por un valor de
    diseño.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se reciba una petición municipal, EL SISTEMA DEBERÁ exigir sesión
  institucional vigente con rol `MUNICIPAL_VIEWER` antes de ejecutar el
  controlador.
- SI no hay sesión válida, ENTONCES EL SISTEMA DEBERÁ responder `401`; SI la
  identidad carece del rol, ENTONCES DEBERÁ responder `403`; ninguna de las dos
  respuestas DEBERÁ confirmar la existencia de datos.
- CUANDO un conteo publicado esté entre 1 y 4, EL SISTEMA DEBERÁ publicarlo como
  `<5` con `value: null`, y NO DEBERÁ serializar el valor real en ningún campo.
- CUANDO el conjunto de celdas exactas determine de forma única un conteo
  sensible, EL SISTEMA DEBERÁ suprimir celdas agregadas adicionales hasta que
  deje de estar determinado.
- CUANDO el número de átomos desconocidos supere `96`, EL SISTEMA DEBERÁ
  degradar hacia un modo conservador que publica MENOS información, nunca más
  (`suppression.ts:68` y `:244`).
- CUANDO se derive la condición de 60 años o más, EL SISTEMA DEBERÁ calcularla
  desde la fecha de nacimiento contra la fecha de corte, y NO DEBERÁ usar la
  pertenencia `OLDER_ADULT_60_PLUS` persistida.
- CUANDO se consulte cualquier agregado, EL SISTEMA DEBERÁ ejecutar la lectura
  dentro de `PrismaService.withTenant()` y filtrar explícitamente por
  `tenantId`.
- CUANDO se sirva una respuesta municipal, EL SISTEMA DEBERÁ emitir su evento de
  auditoría dentro de la misma transacción, y NO DEBERÁ registrar credenciales,
  tokens, IP, cabeceras, cuerpos ni conteos.
- SI el registro de auditoría de una denegación falla, ENTONCES EL SISTEMA
  DEBERÁ relanzar la excepción original y NO DEBERÁ convertir la denegación en
  permiso (`municipal-aggregate-access.guard.ts:99`).
- CUANDO se responda, EL SISTEMA DEBERÁ enviar `Cache-Control: private,
  no-store` y `Vary: Cookie`.
- EL SISTEMA NO DEBERÁ aceptar `tenantId`, municipio, identificador, filtro ni
  parámetro de consulta alguno en las rutas municipales.
- EL SISTEMA NO DEBERÁ devolver nombre, documento, contacto, `patientId`,
  `personId`, fecha de nacimiento, edad individual, dirección, texto libre de
  localidad ni coordenada en ningún punto del contrato, de sus errores o de sus
  registros.
- SI la consulta falla, ENTONCES LA INTERFAZ DEBERÁ mostrar un estado accesible
  y NO DEBERÁ rellenar el hueco con un dato de diseño.

## Ámbito de archivos / File scope

- `apps/api/src/municipality/municipality.controller.ts` — las dos únicas rutas
- `apps/api/src/municipality/municipality.service.ts` — consulta con tenant y auditoría transaccional
- `apps/api/src/municipality/suppression.ts` — control de privacidad; el archivo más delicado de la capacidad
- `apps/api/src/municipality/population-summary.ts` — siete regiones exclusivas y métricas oficiales ausentes
- `apps/api/src/municipality/territory-summary.ts` — jerarquía y nodo de pendientes
- `apps/api/src/municipality/municipality.contract.ts` — contrato propio, no derivado de Prisma
- `apps/api/src/municipality/municipality.dto.ts` — DTO de OpenAPI
- `apps/api/src/municipality/municipal-aggregate-access.guard.ts` — auditoría de denegaciones
- `apps/api/src/municipality/municipality.module.ts` — módulo; consume identidad, no la duplica
- `apps/api/src/institutional-auth/` — identidad, sesión y rol institucional; NACIÓ aquí
- `prisma/migrations/20260822130000_municipality_core_01/migration.sql` — enums, tablas, RLS y políticas
- `prisma/migrations/ROLLBACK-municipality_core_01.sql` — rollback documentado, no automático
- `apps/web/src/features/municipality/municipalityAggregatesClient.ts` — única frontera de red de la feature
- `apps/web/src/features/municipality/useMunicipalityAggregate.ts` — estados de la consulta
- `apps/web/src/features/municipality/municipalityAggregates.ts` — contrato y textos aprobados
- `apps/web/src/features/municipality/MunicipalityPopulation.tsx` — vista conectada
- `apps/web/src/features/municipality/MunicipalityTerritory.tsx` — vista conectada
- `apps/api/test/municipality.api.test.ts`, `apps/api/test/municipality-aggregates.db.test.ts`, `apps/api/test/municipality-fixtures.ts` — pruebas de integración

## Estado real y límites conocidos

1. **No hay forma de iniciar sesión en Alcaldía desde Alcaldía.** Las dos vistas
   piden los agregados con `credentials: 'include'`, pero la ruta
   `/municipality` no ofrece ningún formulario de acceso institucional. `grep -rl
   institutional apps/web/src` solo devuelve archivos de
   `apps/web/src/features/hospital/`: la única función que abre una sesión
   institucional en el navegador es `abrirSesionInstitucional()` en
   `apps/web/src/features/hospital/hospitalInstitutionClient.ts:272`, que llegó
   con la spec 014. En la práctica, quien abra `/municipality` sin haber
   obtenido antes la cookie por otro medio verá siempre el estado
   `no-autorizado`. Esta es la brecha funcional más importante de la capacidad.

2. **Once de las trece vistas de Alcaldía siguen siendo fixtures.** Solo
   `poblacion` y `territorio` consumen la API. `inicio`, `programas`,
   `presupuesto`, `evidencias`, `furag`, `adres`, `cuidado`, `brechas`,
   `cuidadores`, `indicadores` y `reportes` se alimentan de
   `municipalityConfig.ts` y se rotulan «Datos demostrativos». La coexistencia
   está etiquetada, no oculta, pero significa que en la misma pantalla conviven
   cifras reales y cifras ficticias: `inicio` muestra «Total de beneficiarios
   únicos: 3.050» (`municipalityConfig.ts:1046`) mientras `poblacion` muestra el
   conteo real de PostgreSQL.

3. **El bloque de fixtures de población sigue en el código.** `municipalityConfig.ts`
   conserva los números de diseño del módulo `poblacion` (3.050, 1.284, 452,
   268, 78). La vista conectada ya solo consume de ahí los TÍTULOS, no las
   cifras, pero el dato ficticio no fue eliminado.

4. **La docstring de la ruta quedó obsoleta.**
   `apps/web/src/app/municipality/page.tsx:12` sigue afirmando que la
   experiencia «no llama a la API y no crea sesión». Desde `4094e88` eso es
   falso para dos de sus vistas.

5. **La prueba negativa de red no cubre la conexión real.**
   `municipalityPrivacidad.test.tsx:196` afirma que «el código de la feature no
   consulta red ni almacenamiento» buscando el patrón `/\bfetch\s*\(/`. El
   cliente municipal sí hace una petición real, pero a través de un `fetchImpl`
   inyectado y de una URL base importada, de modo que no coincide con el patrón.
   La prueba pasa y su título ya no describe el sistema.

6. **La supresión es una salvaguarda de PRODUCTO, no un umbral legal.** Está
   declarado en `suppression.ts:23` y corresponde a la decisión OD-05 de
   `tasks/TASK-MUNICIPALITY-CORE-01.md:196`, marcada DIFERIDA. La validación
   jurídica colombiana del umbral no se hizo.

7. **La supresión protege una respuesta aislada, no una serie de respuestas.**
   `suppression.ts:25` reporta como riesgo residual lo que un observador podría
   deducir combinando dos consultas tomadas en momentos distintos. No hay
   protección diferencial ni ruido añadido.

8. **Los dos endpoints municipales no tienen límite de tasa ni tiempo máximo de
   consulta.** `grep -riE "timeout|rate.limit" apps/api/src/municipality/` no
   devuelve nada. Solo la apertura de sesión está limitada
   (`InstitutionalSignInRateLimitGuard`). El punto 4 de «Security and Privacy
   Requirements» de la Task pedía «límites de tiempo»; no se implementaron.

9. **La credencial institucional es COMPARTIDA por rol.** No hay usuarios
   nominales, ni recuperación, ni administración, ni rotación automatizada. La
   auditoría registra un identificador opaco de identidad, no a una persona: el
   rastro dice qué identidad consultó, nunca quién.

10. **Las cuatro métricas oficiales están cableadas como no disponibles.**
    `buildOfficialMetrics()` (`population-summary.ts:199`) devuelve siempre
    `UNAVAILABLE`. No hay integración con ADRES, RLCPD ni denominador oficial, y
    esta capacidad no la abrió.

11. **`territoryPendingNormalization` del resumen de población solo lleva regla
    primaria**, no complementaria, por una razón declarada en
    `population-summary.ts:181`: reparte a las personas por territorio y no
    comparte partición con las siete regiones. Es una decisión deliberada, no un
    olvido, pero conviene tenerla presente si alguna vez se publica otra métrica
    en esa misma sección.

12. **`OD-04` quedó diferida**: no existe definición aprobada de «registro
    completo», por lo que la única métrica de calidad publicada es la
    normalización territorial pendiente.

13. **La capacidad nunca fue auditada por Codex.** Ver `## Naturaleza de esta
    spec`.

## Criterios de éxito

- Los dos endpoints entregan únicamente agregados del tenant que el servidor
  resuelve, sin aceptar ningún parámetro del navegador.
- Ninguna respuesta, error, registro o evento de auditoría contiene un dato
  individual de los prohibidos en `municipality.contract.ts:10`.
- Ningún conteo real entre 1 y 4 se serializa, ni directamente ni por
  reconstrucción desde los totales publicados.
- Una identidad de otra institución no observa nada de esta, ni manipulando
  parámetros ni reutilizando conexiones.
- `suppression.test.ts`, `population-summary.test.ts`, `territory-summary.test.ts`,
  `municipality.api.test.ts`, `municipality-aggregates.db.test.ts`,
  `municipalityAggregatesClient.test.ts`, `MunicipalityPopulation.test.tsx`,
  `MunicipalityTerritory.test.tsx` y `municipalityPrivacidad.test.tsx` pasan.
  **No se ejecutaron el 2026-08-25**: `node_modules` no está instalado y
  PostgreSQL no está levantado; ver `research.md` R18.
