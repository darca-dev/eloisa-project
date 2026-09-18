# Investigación 009 - Hospital · Pacientes (API y vista conectada)

Medido sobre `develop` el 2026-08-25. Cada hallazgo cita el archivo, la línea o
el comando con el que se comprobó. Lo que no se pudo comprobar está en R16.

## R1. Los tres endpoints existen y están montados

`grep -nE "@(Controller|Get|Post|Patch|Delete|UseGuards)"` sobre
`apps/api/src/hospital/hospital-patients.controller.ts` devuelve exactamente:

- `@Controller('api/v1/hospital/patients')` — línea 88
- `@UseGuards(HospitalPatientAccessGuard)` — línea 89
- `@Get()` — línea 97 (listado)
- `@Get('analytics')` — línea 154
- `@Get(':patientId')` — línea 201

No hay `@Post`, `@Patch` ni `@Delete`: la superficie es de SOLO LECTURA.

`analytics` se declara ANTES que `:patientId` (líneas 154 y 201). El propio
controlador documenta por qué en su cabecera (líneas 79-81): sin esa precedencia
`analytics` se leería como identificador y produciría `400`.

Montaje: `hospital.module.ts:50` declara `HospitalPatientsController`, y
`app.module.ts:58` importa `HospitalModule`.

Las tres respuestas fijan `Cache-Control: private, no-store`, `Pragma: no-cache`
y `Vary: Cookie` (`hospital-patients.controller.ts:327-331`).

## R2. La cabecera de `hospital.contract.ts` es el corazón de la spec

`apps/api/src/hospital/hospital.contract.ts:1-19` declara, literalmente, dos
cosas.

Datos PROHIBIDOS en cualquier punto del contrato, de sus errores y de sus
registros: `personId`, documento completo, teléfono, correo, dirección exacta,
indicaciones para llegar, texto libre de localidad o corregimiento,
consentimiento, `tenantId`, identificadores internos relacionados, historia
clínica, diagnóstico y cualquier dominio que CORE-01 no modela.

Lo que esta superficie NO es: no es una Historia Clínica Electrónica, no emite
diagnósticos, no evalúa rangos clínicos, no genera alertas ni semáforos y no
acredita relación de atención con ninguna persona. Que un registro aparezca aquí
NO demuestra asignación profesional, necesidad individual de conocer ni derecho
de acceso a más información.

El mismo archivo declara además:

- `HOSPITAL_PATIENTS_SOURCE = 'ELOISA_POSTGRESQL'` (línea 30) — procedencia; no
  es estadística oficial, no procede de EPS ni de ADRES.
- `HOSPITAL_SORT_FIELDS = ['name', 'age', 'status']` (línea 69) — `proxima` NO
  aparece porque la agenda no existe en CORE-01.
- `HOSPITAL_POPULATION_FILTERS = ['DISABILITY', 'HOME_CARE_REQUIRED']`
  (línea 84) — `OLDER_ADULT_60_PLUS` NO es filtrable por pertenencia: se deriva
  siempre de la fecha de nacimiento.
- `HOSPITAL_PATIENT_STATUSES = ['ACTIVE']` (línea 94) — hoy solo existe un
  estado.
- `keyFigures` y NO `indicators` (líneas 300-308): son conteos, no indicadores
  institucionales.
- `percentage: number | null` (líneas 238-241): `null` cuando el denominador es
  cero; nunca se escribe `0`.

## R3. Dos guards compuestos, no uno

`apps/api/src/institutional-auth/hospital-patient-viewer.guard.ts` decide:

- `401 INSTITUTIONAL_SESSION_REQUIRED` si no hay sesión institucional válida
  (líneas 95-100); la cookie de autoinscripción de paciente cae aquí;
- `403` si la identidad no tiene `HOSPITAL_PATIENT_VIEWER` (líneas 102-114); una
  sesión municipal válida cae exactamente en este caso;
- `503` fail-closed ante `RuntimeContextUnavailableError` (líneas 75-90).

No extiende `MunicipalViewerGuard` a propósito (comentario, líneas 48-52): los
roles son disjuntos y compartir jerarquía permitiría relajar los dos a la vez.

`apps/api/src/hospital/hospital-patient-access.guard.ts` lo COMPONE (línea 67) y
solo añade la auditoría de las DENEGACIONES. Su cabecera (líneas 38-44) declara
que esa auditoría es BEST-EFFORT deliberadamente: hacerla fail-closed convertiría
un fallo de escritura en denegación de servicio y permitiría distinguir
«denegado y auditado» de «denegado sin auditar», que es un oráculo. El
`catch` de la línea 102 nunca altera el resultado.

`endpointOf` (líneas 131-138) sustituye el identificador concreto por
`:patientId` para que la traza de una denegación no revele qué se intentó leer.

## R4. La migración `20260822140000_hospital_core_01` NO crea tablas

Comprobado con
`grep -oE 'CREATE TABLE "[A-Za-z]+"|ENABLE ROW LEVEL SECURITY|CREATE POLICY'`
sobre `prisma/migrations/20260822140000_hospital_core_01/migration.sql`:
**cero coincidencias**.

Lo que la migración hace realmente (96 líneas):

1. `ALTER TYPE "InstitutionalRole" ADD VALUE IF NOT EXISTS
   'HOSPITAL_PATIENT_VIEWER'` (línea 41).
2. Cuatro valores nuevos en `AuditEventType` (líneas 47-50):
   `HOSPITAL_PATIENT_LIST_ACCESS_GRANTED`,
   `HOSPITAL_PATIENT_DETAIL_ACCESS_GRANTED`,
   `HOSPITAL_PATIENT_ANALYTICS_ACCESS_GRANTED`,
   `HOSPITAL_PATIENT_ACCESS_DENIED`.
3. Reescribe el check `audit_event_resource_required` de lista POSITIVA a lista
   NEGATIVA (líneas 72-83), para que un evento de ACCESO pueda omitir
   `resourceId`.

Su §4 (líneas 85-96) es explícita: **no concede privilegios nuevos y no crea
ninguna política nueva**. La superficie lee las tablas que `merdn_runtime` ya
podía leer bajo las políticas de tenant ya vigentes (spec 007 y 008) y escribe
únicamente en `audit_event`.

Tampoco crea NINGÚN índice (líneas 21-25). Se apoya en
`person_tenantId_idx`, `patient_tenantId_idx`, `patient_id_tenant_unique` y
`patient_address_municipalityUnitId_idx`. Comprobado contra
`grep -n "@@index\|@@unique" prisma/schema.prisma`: **no existe índice sobre
`person.familyNames`, `person.givenNames` ni `person.birthDate`**, que son
exactamente las columnas por las que el listado ordena
(`hospital-patients.service.ts:453-476`).

Los cinco valores nuevos están reflejados en `prisma/schema.prisma:130-133` y
`prisma/schema.prisma:207`. Existe rollback documentado:
`prisma/migrations/ROLLBACK-hospital_core_01.sql`.

## R5. La minimización se aplica en la capa de datos, no en el borde

`hospital-patients.service.ts` declara dos selecciones cerradas:

- `SELECCION_MINIMA` (líneas 79-102): id, status, epsCode, epsNameControlled,
  nombres, apellidos, fecha de nacimiento, tipo y número normalizado de
  documento, pertenencias poblacionales y dirección reducida a área, bandera de
  normalización pendiente, municipio canónico y unidad local.
- `SELECCION_ANALITICA` (líneas 115-126): deliberadamente MÁS estrecha —no lee
  nombre, apellidos ni documento— porque una cifra agregada no muestra a nadie.

Teléfono, correo, dirección exacta, indicaciones, texto libre territorial y
consentimiento **no se seleccionan siquiera** de la base.

La proyección (`hospital-patients.projection.ts`) cierra el resto:

- `maskDocument` (líneas 95-105) publica etiqueta del tipo y TRES últimos
  caracteres; con menos de 4 caracteres escribe `···reservado`.
- `territoryOf` (líneas 150-160) nunca proyecta el texto libre; ante incoherencia
  elige NO atribuir territorio.
- `prioritiesOf` (líneas 135-141) deriva `older60` de la fecha de nacimiento.
- `statusLabel` (líneas 120-122) devuelve `Registro activo`, etiqueta no clínica.

`contactAvailability` es un texto FIJO — `'No disponible con el permiso actual'`
(`hospital-patients.service.ts:276`) — no un campo vacío.

`mapear()` (líneas 517-545) documenta que `OLDER_ADULT_60_PLUS` NO se lee de las
pertenencias persistidas porque quedan obsoletas cuando alguien cumple 60 después
de inscribirse.

La suite de API mantiene una lista de campos y de VALORES prohibidos
(`apps/api/test/hospital-fixtures.ts:183-212`): `personId`,
`documentNumberNormalized`, `phone`, `email`, `exactAddress`, `directions`,
`localityUnverifiedText`, `settlementUnverifiedText`, `tenantId`, `tokenHash`,
`accessSecret`, `consentVersion`, `createdByUserId`, `identityId`, más los
valores ficticios que las fixtures sí persisten para poder demostrar que la API
no los devuelve.

## R6. Allowlist cerrada de consulta; la analítica rechaza paginación

`hospital-patients.query.ts` es una función PURA (cabecera, líneas 24-45).

- `assertAllowlist` (líneas 204-210) rechaza cualquier nombre fuera de
  `HOSPITAL_QUERY_PARAMETERS`: un parámetro desconocido es `400`, no se ignora.
- `singleValue` (líneas 102-120) rechaza valores repetidos y sintaxis de objeto
  anidado.
- `epsCode` se valida contra el catálogo del servidor (`findEpsByCode`,
  línea 244) — el cliente no puede introducir un código arbitrario.
- `municipalityOfficialCode` exige `^\d{5}$` (línea 254).
- `parseAnalyticsQuery` (líneas 316-324) construye una allowlist reducida
  quitando `page`, `pageSize`, `sort` y `direction`.
- `HospitalQueryError` (líneas 48-56) nombra el parámetro y la regla, **nunca el
  valor recibido**.
- El término de búsqueda nunca se registra en logs, telemetría ni auditoría
  (comentario, línea 182; confirmado en R7).

`tenantId` y `personId` no figuran en la allowlist y por tanto son `400` por
construcción.

El rango de edad se traduce a un rango de FECHAS DE NACIMIENTO contra la fecha
de corte (`hospital-patients.service.ts:347-377`), y `older60` se combina con
`ageMax` eligiendo la cota más restrictiva, no sobrescribiéndola.

## R7. Auditoría: concedido fail-closed, denegado best-effort

`HospitalPatientsService.registrarAcceso` (líneas 494-513) escribe el evento
DENTRO de la misma transacción `prisma.withTenant()` que sirve los datos
(líneas 184, 232, 300). Si el evento no se persiste, la transacción se aborta.

`institutional-audit.service.ts:154-183` mapea recurso a evento y deja
`resourceId = null` en listado y analítica; solo el detalle guarda el
`patientId` opaco (líneas 172-175).

`recordHospitalPatientDenialWithin` (líneas 192-212) escribe
`HOSPITAL_PATIENT_ACCESS_DENIED` con `resourceId: null` y sin causa.

Una lectura de detalle que no devuelve fila **no se audita como acceso
concedido** (`hospital-patients.service.ts:239-247`), para no convertir la traza
en un oráculo de existencia.

## R8. Lado web: sin repliegue a fixtures, y hay prueba que lo verifica

`apps/web/src/features/hospital/hospitalPatientsClient.ts:22-23` declara
literalmente que **NO tiene repliegue a fixtures**: «un fallo es un fallo, y así
se comunica. La vista jamás sustituye un error por cifras de demostración».

Comprobaciones adicionales sobre el mismo archivo:

- `credentials: 'include'` y `cache: 'no-store'` (líneas 299-301).
- No lee ni escribe cookie: la sesión viaja en cookie `HttpOnly` (líneas 14-15).
- `serializarFiltros` (líneas 214-240) omite todo valor vacío y solo envía
  `older60=true` cuando está activo, porque `older60=false` significaría «solo
  menores de 60», que es otro filtro.
- `ResultadoHospital<T>` (líneas 270-277) nunca lanza: `ok`, `sin-sesion`,
  `sin-permiso`, `no-encontrado`, `consulta-invalida`, `cancelado`, `error`.
  `cancelado` es un desenlace de primera clase.

`HospitalPatients.tsx` no importa `hospitalPopulationFixtures`. Comprobado con
`grep -n "hospitalPopulationFixtures" HospitalPatients.tsx`: la única
coincidencia es la línea 61, que es un comentario declarando la prohibición. La
prueba `hospitalPatients.test.tsx:279` verifica esa ausencia leyendo el código
fuente.

Listado y analítica se piden con el MISMO `AbortController`
(`HospitalPatients.tsx:216-279`): o se sirven las dos del mismo conjunto
filtrado, o no se sirve ninguna. Ante error, `limpiarNominal()` (líneas 329-334)
borra listado, analítica, selección y detalle.

`hospitalAlcance.test.ts:60-67` mantiene una allowlist EXACTA de los seis únicos
archivos Hospital autorizados a usar `fetch`; `hospitalPatientsClient.ts` es uno
de ellos. `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`,
`XMLHttpRequest`, `WebSocket`, `axios`, `EventSource` y `sendBeacon` siguen
prohibidos en TODO el directorio (líneas 69-81).

## R9. Capacidades visibles pero no disponibles, y una desviación de literal

`HospitalPatientsPieces.tsx:45-53` declara que Condición principal, Profesional,
Cuidador, Programa, Próxima atención, Patologías y Semáforo se CONSERVAN y se
representan con un texto único. Comprobado en el panel de detalle
(líneas 1396-1435): `Condición principal`, `Patologías registradas`,
`Profesional responsable`, `Cuidador`, `Programa`, `Próxima atención`,
`Últimas atenciones` y `Alertas y semaforización`, todas con el mismo valor.

`Ordenar por Próxima atención` permanece visible y `disabled`
(`HospitalPatientsPieces.tsx:591-593`). `FiltroNoDisponible` (líneas 233-256)
mantiene el selector visible, `disabled` y con `aria-describedby`.
`GRAFICOS_NO_DISPONIBLES` (`HospitalPatients.tsx:102-107`) conserva el lugar de
Patologías, Programas, Cuidador asignado y Profesional asignado.

**Desviación medida.** `tasks/TASK-HOSPITAL-CORE-01.md` §4.3 exige el texto
`No disponible en CORE-01`. El código usa
`HOSPITAL_POBLACION_NO_DISPONIBLE = 'Información no disponible'`
(`hospitalPatientsConfig.ts:253`). El motivo aparece en el mismo archivo
(línea 195): la marca visible es exclusivamente ELÍGEME y ningún texto de esa
configuración nombra la terminología interna del proyecto. La intención de §4.3
—no escribir `Sin asignar`, ni cero, ni porcentaje, ni semáforo— se cumple; el
literal exacto, no. No hay auditoría registrada que acepte formalmente esa
desviación (ver R13).

El badge `Datos demostrativos` se sustituye por `Registros ELOISA` únicamente en
esta vista (`hospitalPatientsConfig.ts:274` y `325-328`). `hospitalPoblacionDemo`
sigue existiendo como base de `hospitalPoblacionCore`, pero solo aporta copy y
columnas, no valores.

## R10. La analítica agrega EN MEMORIA, no en SQL

`hospital-patients.service.ts:305-308` ejecuta
`tx.patient.findMany({ where, select: SELECCION_ANALITICA })` **sin `take`**, y
después `keyFiguresOf`, `distributionsOf` e `intersectionsOf`
(líneas 321-323) recorren el arreglo completo en Node. No hay `GROUP BY`, no hay
`groupBy` de Prisma y no hay agregación en PostgreSQL.

Esto está reconocido explícitamente en
`tasks/TASK-HOSPITAL-CORE-01-CORRECTION.md`, sección «Deferred gates —
Performance»: p95 medido ~1719 ms sin filtros y ~884 ms con filtros, frente al
objetivo documentado de ≤500 ms (`TASK-HOSPITAL-CORE-01.md` §11). La corrección
declara que el trabajo de agregación SQL, plan de consulta e índices exige una
Task propia y que el rendimiento **sigue siendo un gate de producción**.

## R11. La Row Level Security hospitalaria NO está verificada

`apps/api/test/hospital-patients.api.test.ts:116` es
`describe.skipIf(!puedeEjecutarse)`: la suite entera se salta si no hay base de
datos.

Peor aún, líneas 102-114: cuando el motor conectado no es
`postgresql-server` con `RUNTIME_DATABASE_URL`, la suite arranca la aplicación
con `MERDN_RUNTIME_ROLE=disabled` e imprime un aviso que dice literalmente que
«el aislamiento por base de datos NO queda verificado en esta ejecución; los
filtros explícitos por tenant de la aplicación SÍ».

`TASK-HOSPITAL-CORE-01-CORRECTION.md`, sección «Deferred gates — RLS», lo acepta
como limitación de entorno para uso ficticio y controlado, y enumera lo que hay
que ejecutar antes de producción: servidor PostgreSQL normal,
`MERDN_RUNTIME_ROLE=enforce`, identidad runtime no propietaria y sin
`BYPASSRLS`, dos tenants, contexto ausente o incorrecto, identificadores
cruzados directos y reutilización de pool.

La defensa que sí está medida en el código es la de la aplicación: todo `where`
lleva `tenantId` explícito además de `withTenant()`
(`hospital-patients.service.ts:235`, `302`, `411-415`, `423`, `440`).

## R12. En `develop`, la identidad hospitalaria NO está configurada

`grep -n "MERDN_" /Users/juanklagos/www/El-MERDN/.env.example` **no devuelve
`MERDN_HOSPITAL_PATIENT_VIEWER_SECRET` ni `MERDN_HOSPITAL_PATIENT_VIEWER_CODE`**.

`institutional-auth.config.ts:110-116` sí las lee y declara la identidad, con
`defaultCode: 'hospital-patient-viewer'`. Pero el aprovisionamiento es
fail-closed por credencial: sin secreto válido la identidad se omite por
completo, sin fallback (cabecera, línea 39).

Consecuencia real: en un despliegue hecho solo con `.env.example` de `develop`,
la superficie Hospital · Pacientes existe y responde, pero **no hay ninguna
identidad con la que abrir sesión**, de modo que devuelve `401` de forma
uniforme.

Esto es coherente con la Task, que prohibió tocar `.env.example`
(`TASK-HOSPITAL-CORE-01.md` §9.2, «no está autorizado; Claude debe reportarlos
en el handoff»). `spec/bitacora/decisiones/2026-08-25-auditoria-git-y-estado-de-ramas.md`
línea 40 confirma que la configuración local de `MERDN_HOSPITAL_PATIENT_VIEWER`
en `.env.example` y `compose.yml` vive **fuera de `develop`**, en el commit
`45b12e2` de una rama WIP.

## R13. No existe auditoría registrada de HOSPITAL-CORE-01

`ls reviews/` devuelve 22 entradas: 20 auditorías más `README.md` y
`REVIEW-TEMPLATE.md`, que no lo son.
`grep -ril "HOSPITAL-CORE-01" reviews/` no devuelve **ninguna** coincidencia.

Existen `REVIEW-003H-01` … `REVIEW-003H-07-FINAL` (la experiencia visual
Hospital, spec 003) y `REVIEW-MVP-CORE-01-FINAL` (spec 007), pero ninguna cubre
esta capacidad. `reviews/README.md` declara el directorio cerrado el 2026-08-25 y
prohíbe crear auditorías nuevas.

Lo más cercano a un veredicto formal es
`tasks/TASK-HOSPITAL-CORE-01-CORRECTION.md`, que es un paquete de corrección de
Codex —limitado a dos archivos de prueba— y no una auditoría completa.

## R14. Límites del modelo que la superficie hereda

- `HOSPITAL_PATIENT_STATUSES` solo contiene `ACTIVE`
  (`hospital.contract.ts:94`). En consecuencia `sort=status`
  (`hospital-patients.service.ts:466-467`) es un orden real pero hoy inerte:
  todas las filas comparten valor y solo desempata el `id`.
- El campo `status` de la respuesta es el literal `'ACTIVE'`
  (`hospital-patients.service.ts:274` y `489`), no `row.status`. Solo
  `statusLabel` deriva del valor persistido. Es coherente hoy porque el `where`
  siempre restringe a `filters.patientStatus`, pero dejaría de serlo si se
  añadiera otro estado.
- `activeUniverse` se cuenta con `{ tenantId, status: filters.patientStatus }`
  (línea 302): es el universo del estado consultado, no un universo absoluto.
- La búsqueda por documento usa `contains` sobre `documentNumberNormalized`
  (línea 405): permite localizar un registro que ya se conoce, no descubrirlo,
  porque el valor completo nunca se devuelve.
- `mapearAnalitica` fuerza `localityPendingNormalization: true` y
  `localUnitName: null` (líneas 575-576) porque la analítica no lee esos campos.

## R15. Cobertura de pruebas existente

Contada con `grep -c "  it("`:

| Archivo | Casos |
|---|---|
| `apps/api/test/hospital-patients.api.test.ts` | 40 |
| `apps/api/src/hospital/hospital-patients.query.test.ts` | 29 |
| `apps/api/src/hospital/hospital-patients.projection.test.ts` | 29 |
| `apps/api/src/institutional-auth/hospital-patient-viewer.guard.test.ts` | 8 |
| `apps/web/src/features/hospital/hospitalPatientsClient.test.ts` | 17 |
| `apps/web/src/features/hospital/hospitalPatients.test.tsx` | 63 |

La suite de API cubre matriz 401/403, contexto de sesión, listado, detalle,
aislamiento entre tenants, analítica y auditoría —incluido «la auditoría es
append-only: no puede modificarse ni borrarse» (línea 1085)—. Las dos suites
unitarias de API son puras: no necesitan base de datos, NestJS ni red.

## R16. Verificación no ejecutada

**No se ejecutó ninguna prueba.** `node_modules` no está instalado y PostgreSQL
no está levantado en este entorno, de modo que no se puede afirmar que ninguna
suite «pasa». Concretamente queda sin ejecutar:

1. `apps/api/test/hospital-patients.api.test.ts` — requiere base de datos
   (`describe.skipIf`, línea 116).
2. `apps/api/test/hospital-institutional-auth.api.test.ts` — mismo requisito.
3. Las suites unitarias de API y web, que sí podrían correr sin base de datos
   pero exigen dependencias instaladas.
4. `npm run lint`, `npm run typecheck`, `npm run build:api`, `npm run build:web`.

Tampoco se pudo verificar:

5. **La Row Level Security hospitalaria en ejecución** (ver R11). No se levantó
   PostgreSQL con `MERDN_RUNTIME_ROLE=enforce` ni con una identidad runtime no
   propietaria, de modo que el aislamiento por base de datos sigue sin evidencia.
6. **Las cifras de rendimiento** de R10. Los valores p95 citados proceden del
   paquete de corrección de Codex, no de una medición hecha hoy.
7. **El comportamiento del endpoint sin identidad aprovisionada** (R12). Se
   comprobó la ausencia de las variables en `.env.example` y la lógica
   fail-closed en el código, pero no se arrancó la API para observar el `401`.
8. **La fidelidad visual** de la vista conectada. No se ejecutó ningún navegador;
   lo que se midió es el código fuente de los componentes, no su render.
