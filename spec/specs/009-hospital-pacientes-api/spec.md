# Especificación 009 - Hospital · Pacientes (API y vista conectada)

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specifications: `tasks/TASK-HOSPITAL-CORE-01.md` y
`tasks/TASK-HOSPITAL-CORE-01-CORRECTION.md`. Congeladas.

**No existe auditoría registrada de esta capacidad.** `grep -ril
"HOSPITAL-CORE-01" reviews/` no devuelve ninguna coincidencia: las 20 auditorías
del archivo histórico cubren la experiencia visual Hospital (spec 003), la
Alcaldía, la marca y MVP CORE-01 (spec 007), pero ninguna cubre la conexión de
Hospital · Pacientes a datos reales. Lo más cercano a un veredicto formal es
`TASK-HOSPITAL-CORE-01-CORRECTION.md`, un paquete de corrección de Codex
limitado a dos archivos de prueba, que además dejó dos *gates* diferidos
—rendimiento y RLS— recogidos abajo. `reviews/README.md` declara el directorio
cerrado el 2026-08-25: esa ausencia ya no puede subsanarse ahí.

Es la primera superficie institucional que devuelve datos NOMINALES de personas.
Todo lo anterior era interfaz demostrativa (specs 002-006) o agregado sin
nombres (spec 008).

## Objetivo

Que la vista Hospital → Pacientes deje de calcular listado y analítica en el
navegador sobre un fixture y pase a servirlos desde PostgreSQL, acotados al
tenant institucional que resuelve el servidor, publicando una proyección
deliberadamente mínima: lo que basta para reconocer y segmentar a una persona
inscrita, y nada más.

## Historia de usuario principal

Como identidad institucional del Hospital con rol de consulta de Pacientes,
quiero ver, filtrar y segmentar la población efectivamente inscrita en mi
institución, para poder planificar la atención domiciliaria sin acceder a
contacto, dirección exacta, documento completo ni información clínica que este
permiso no acredita.

## Qué hace hoy el sistema

| Capacidad | Dónde |
|---|---|
| `GET /api/v1/hospital/patients` — listado paginado, filtrado y ordenado en PostgreSQL | `apps/api/src/hospital/hospital-patients.controller.ts:97` |
| `GET /api/v1/hospital/patients/analytics` — analítica del conjunto filtrado completo | `hospital-patients.controller.ts:154` |
| `GET /api/v1/hospital/patients/:patientId` — detalle minimizado | `hospital-patients.controller.ts:201` |
| Precedencia de rutas: `analytics` se declara antes que `:patientId` | `hospital-patients.controller.ts:79-81` |
| `Cache-Control: private, no-store`, `Pragma: no-cache`, `Vary: Cookie` en las tres | `hospital-patients.controller.ts:327-331` |
| Denegación por defecto: `401` sin sesión, `403` sin el rol, `503` fail-closed | `institutional-auth/hospital-patient-viewer.guard.ts:75-114` |
| Auditoría de la denegación, best-effort y sin oráculo | `hospital/hospital-patient-access.guard.ts:38-44,102-110` |
| Auditoría del acceso concedido, dentro de la misma transacción | `hospital-patients.service.ts:202,251,312,494-513` |
| Contrato propio, no derivado de Prisma, con datos prohibidos declarados | `hospital/hospital.contract.ts:1-19` |
| Selección mínima de columnas; contacto y dirección ni se leen de la base | `hospital-patients.service.ts:79-126` |
| Documento SIEMPRE enmascarado; menos de 4 caracteres → `···reservado` | `hospital-patients.projection.ts:95-105` |
| Edad DERIVADA de la fecha de nacimiento contra la fecha de corte en UTC | `hospital-patients.projection.ts:130-141` |
| Territorio canónico; el texto libre de localidad nunca se proyecta | `hospital-patients.projection.ts:150-160` |
| Allowlist cerrada de consulta; parámetro desconocido o repetido → `400` | `hospital-patients.query.ts:102-120,204-210` |
| La analítica rechaza `page`, `pageSize`, `sort` y `direction` | `hospital-patients.query.ts:316-324` |
| Ocho intersecciones disjuntas que reconcilian el universo filtrado | `hospital.contract.ts:266-292`, `hospital-patients.projection.ts:331-365` |
| `percentage: null` cuando el denominador es cero; nunca un `0` | `hospital-patients.projection.ts:167-169` |
| Rol `HOSPITAL_PATIENT_VIEWER` y cuatro eventos de auditoría nuevos | `prisma/migrations/20260822140000_hospital_core_01/migration.sql:41-50` |
| Cliente web tipado, sin repliegue a fixtures, que nunca lanza | `apps/web/src/features/hospital/hospitalPatientsClient.ts:22-23,270-277` |
| Listado y analítica coordinados por un mismo `AbortController` | `apps/web/src/features/hospital/HospitalPatients.tsx:216-279` |
| Ante error se limpia todo el estado nominal; no se mezcla con demo | `HospitalPatients.tsx:329-334` |
| Badge de procedencia real `Registros ELOISA` solo en esta vista | `hospitalPatientsConfig.ts:274,325-328` |
| Capacidades del diseño conservadas, visibles y deshabilitadas | `HospitalPatientsPieces.tsx:233-256,591-593,1396-1435` |
| Allowlist de red del módulo Hospital, verificada por prueba | `hospitalAlcance.test.ts:60-81` |

`GET /api/v1/institutional/sessions/current`
(`institutional-auth/institutional-auth.controller.ts:149`) se creó en el mismo
commit para que el encabezado Hospital dejara de mostrar literales
demostrativos. Devuelve solo rol, caducidad, nombre del tenant y un actor
impersonal. Hoy lo comparten varias experiencias y su interfaz fue reelaborada
por la spec 014: aquí se documenta únicamente su origen.

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | Monorepo, NestJS, Next.js, Prisma, validación de entorno | Sin ese esqueleto no hay API ni build |
| 003-experiencia-visual-hospital | La composición aprobada de la vista Pacientes (TASK-003H-03B), shell, sidebar y estilos | Esta spec cambia la FUENTE, no el diseño: sin aquella composición no hay vista que conectar |
| 006-marca-eloisa-isa | `src/config/branding.ts` | El aviso de historia clínica compone el nombre visible desde la marca centralizada, no desde un literal |
| 007-inscripcion-paciente-persistente | `Person`, `Patient`, `PatientAddress`, `PatientPopulationMembership`, `TerritorialUnit`, `AuditEvent`; tenant resuelto en servidor; `PrismaService.withTenant()`; RLS; fail-closed; catálogos de EPS y tipo documental; `deriveAgeInYears` | Es la única fuente de personas y pacientes: sin inscripciones persistidas esta superficie no tiene qué leer |
| 008-agregados-municipales-protegidos | `InstitutionalIdentity`, `InstitutionalSession`, cookie `merdn_institutional_session`, `InstitutionalAuthService`, `InstitutionalAuditService`, `institutionalPrincipalOf`, límite de tasa del inicio de sesión, y el check `audit_event_resource_required` que esta migración relaja | Hospital no crea autenticación propia: reutiliza la institucional y solo añade un rol disjunto |

**Dependencias externas:**

- PostgreSQL en marcha. Sin base de datos, la suite de API se salta entera
  (`hospital-patients.api.test.ts:116`).
- Migraciones aplicadas, en orden: `20260821120000_core_01_init`,
  `20260821120100_core_01_reference_data`, `20260822120000_core_01_hardening`
  (RLS), `20260822130000_municipality_core_01` (identidad institucional) y
  `20260822140000_hospital_core_01` (esta spec).
- Configuración de la identidad hospitalaria:
  `MERDN_HOSPITAL_PATIENT_VIEWER_SECRET` y `MERDN_HOSPITAL_PATIENT_VIEWER_CODE`.
  **No están en `.env.example` de `develop`** (ver «Estado real y límites
  conocidos»).
- No depende de Keycloak/OIDC: esa identidad es humana y llegó con la spec 011.

**Specs que dependen de esta:**

- 010-hospital-profesionales-agenda-api — extiende `hospital.contract.ts` y
  `hospital.module.ts` con la superficie de Operaciones y un segundo rol
  hospitalario disjunto.
- 014-sesion-profesional-en-shell — construye la interfaz de acceso
  institucional sobre `GET /api/v1/institutional/sessions/current` y
  `hospitalInstitutionClient.ts`, creados aquí.
- 015-fidelidad-visual-hospital — recuperó la estructura visual de
  `HospitalPatientsPieces.tsx` (commit `c9a1195`) sin tocar la fuente de datos.

## Escenarios de aceptación

1. Dada una sesión institucional con rol `HOSPITAL_PATIENT_VIEWER`, cuando se
   pide el listado, entonces la API devuelve una página del conjunto filtrado con
   identidad minimizada, documento enmascarado, edad derivada, EPS, las tres
   clasificaciones y territorio canónico, y nada más.
2. Dada una sesión municipal válida, cuando consulta cualquier ruta hospitalaria
   de Pacientes, entonces recibe `403` sin que se revele ningún dato.
3. Dada la cookie de autoinscripción de paciente, cuando consulta una ruta
   hospitalaria, entonces recibe `401`, porque esa cookie no autentica a ninguna
   institución.
4. Dado un `patientId` de otro tenant, cuando se pide su detalle, entonces la
   respuesta es `404` idéntica a la de un identificador inexistente.
5. Dado un parámetro desconocido, repetido o fuera de rango, cuando llega a la
   API, entonces responde `400` nombrando el parámetro y la regla, nunca el valor
   recibido ni SQL ni esquema.
6. Dada una consulta a la analítica con `page` o `sort`, cuando llega, entonces
   responde `400`: la analítica describe el conjunto completo, no una página.
7. Dado un conjunto filtrado vacío, cuando se pide la analítica, entonces los
   porcentajes son `null` y nunca `0`.
8. Dado un acceso concedido, cuando se sirven los datos, entonces su evento de
   auditoría se persiste en la MISMA transacción; si el evento no se persiste, la
   respuesta falla.
9. Dado un acceso denegado, cuando se registra, entonces el evento no guarda
   recurso, causa, filtros ni término de búsqueda; y si la escritura del evento
   falla, la denegación se mantiene igualmente.
10. Dado un cambio de filtro en la vista, cuando aún hay una consulta en curso,
    entonces se aborta y una respuesta tardía no puede sustituir al estado
    actual.
11. Dado un fallo de red o un `503`, cuando la vista lo recibe, entonces limpia
    todo el estado nominal y ofrece reintentar, sin mostrar jamás cifras de
    demostración.
12. Dado un registro con localidad pendiente de normalización, cuando se
    proyecta, entonces se publica el HECHO de que está pendiente y nunca su texto
    libre.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se reciba cualquier petición a `/api/v1/hospital/patients`, EL SISTEMA
  DEBERÁ exigir sesión institucional vigente con rol `HOSPITAL_PATIENT_VIEWER`
  antes de tocar ningún dato.
- SI la identidad autenticada carece de ese rol, ENTONCES EL SISTEMA DEBERÁ
  responder `403` sin confirmar la existencia de dato alguno.
- CUANDO resuelva el tenant, EL SISTEMA DEBERÁ tomarlo del principal
  institucional y NUNCA de un parámetro, cuerpo o cabecera del navegador.
- EL SISTEMA NO DEBERÁ devolver `personId`, documento completo, teléfono, correo,
  dirección exacta, indicaciones, texto libre territorial, consentimiento,
  `tenantId` ni ningún dato clínico en ninguna de las tres lecturas.
- CUANDO publique un documento, EL SISTEMA DEBERÁ enmascararlo dejando visibles
  como máximo los tres últimos caracteres.
- CUANDO publique una edad, EL SISTEMA DEBERÁ derivarla de la fecha de nacimiento
  contra la fecha de corte en UTC, y NO DEBERÁ leerla de una pertenencia
  poblacional persistida.
- SI un parámetro no pertenece a la allowlist, llega repetido o queda fuera de
  rango, ENTONCES EL SISTEMA DEBERÁ responder `400` sin aplicar un recorte
  silencioso.
- CUANDO sirva una lectura nominal, EL SISTEMA DEBERÁ persistir su evento de
  auditoría en la misma transacción, y SI no puede, DEBERÁ fallar la respuesta.
- CUANDO registre una denegación, EL SISTEMA NO DEBERÁ guardar recurso, causa,
  filtros ni término de búsqueda, y un fallo al registrarla NO DEBERÁ convertir
  la denegación en permiso.
- CUANDO el denominador de un porcentaje sea cero, EL SISTEMA DEBERÁ publicar
  `null` y NO DEBERÁ publicar `0`.
- EL SISTEMA NO DEBERÁ ofrecer creación, edición, archivado, importación,
  exportación, descarga ni conciliación en esta superficie.
- CUANDO la vista reciba un error, EL SISTEMA DEBERÁ limpiar todo el estado
  nominal y NO DEBERÁ sustituirlo por datos de demostración.
- EL SISTEMA NO DEBERÁ escribir respuestas, filtros ni detalle en
  `localStorage`, `sessionStorage`, IndexedDB, service worker ni en la URL.
- CUANDO un dominio no esté modelado, EL SISTEMA DEBERÁ representarlo con un
  texto de no disponibilidad y NO DEBERÁ escribir `Sin asignar`, un cero, un
  porcentaje ni un color de semáforo.

## Ámbito de archivos / File scope

- `apps/api/src/hospital/hospital.contract.ts` — contrato propio; su cabecera
  declara los datos prohibidos y lo que la superficie no es
- `apps/api/src/hospital/hospital-patients.controller.ts` — las tres lecturas
- `apps/api/src/hospital/hospital-patients.service.ts` — consulta, transacción y
  auditoría del acceso concedido
- `apps/api/src/hospital/hospital-patients.query.ts` — allowlist y normalización,
  función pura
- `apps/api/src/hospital/hospital-patients.projection.ts` — minimización y
  analítica, funciones puras
- `apps/api/src/hospital/hospital-patients.dto.ts` — DTO explícitos para OpenAPI
- `apps/api/src/hospital/hospital-patient-access.guard.ts` — auditoría de la
  denegación
- `apps/api/src/hospital/hospital.module.ts` — montaje
- `apps/api/src/institutional-auth/hospital-patient-viewer.guard.ts` — decisión
  de autorización
- `apps/api/src/institutional-auth/institutional-audit.service.ts` — eventos
  hospitalarios de acceso
- `apps/api/src/institutional-auth/institutional-auth.config.ts` — identidad
  hospitalaria configurable y fail-closed
- `prisma/migrations/20260822140000_hospital_core_01/migration.sql` — migración
  aditiva; no crea tablas
- `prisma/migrations/ROLLBACK-hospital_core_01.sql` — rollback documentado
- `apps/web/src/features/hospital/hospitalPatientsClient.ts` — frontera única
  vista→API
- `apps/web/src/features/hospital/HospitalPatients.tsx` — vista conectada
- `apps/web/src/features/hospital/HospitalPatientsPieces.tsx` — piezas de la
  composición aprobada
- `apps/web/src/features/hospital/hospitalPatientsConfig.ts` — textos,
  procedencia y estados
- `apps/api/test/hospital-patients.api.test.ts` — 40 casos de extremo a extremo
- `apps/api/test/hospital-fixtures.ts` — campos y valores prohibidos
- `apps/api/src/hospital/hospital-patients.query.test.ts` — 29 casos
- `apps/api/src/hospital/hospital-patients.projection.test.ts` — 29 casos
- `apps/api/src/institutional-auth/hospital-patient-viewer.guard.test.ts` — 8
  casos
- `apps/web/src/features/hospital/hospitalPatientsClient.test.ts` — 17 casos
- `apps/web/src/features/hospital/hospitalPatients.test.tsx` — 63 casos
- `apps/web/src/features/hospital/hospitalAlcance.test.ts` — allowlist de red del
  módulo Hospital

## Estado real y límites conocidos

Esta sección es la razón de ser de una spec as-built. Todo lo que sigue está
medido, no supuesto; el detalle y la evidencia están en `research.md`.

**1. La Row Level Security hospitalaria NO está verificada en ejecución.**
`hospital-patients.api.test.ts:102-114` arranca la aplicación con
`MERDN_RUNTIME_ROLE=disabled` cuando el motor conectado no sostiene RLS bajo el
rol runtime, e imprime un aviso que dice literalmente que el aislamiento por base
de datos NO queda verificado. Lo que sí está medido es la defensa de la
aplicación: todo `where` lleva `tenantId` explícito además de `withTenant()`.
`TASK-HOSPITAL-CORE-01-CORRECTION.md` acepta la limitación solo para uso ficticio
y controlado, y bloquea producción hasta ejecutar las lecturas con un servidor
PostgreSQL normal, `MERDN_RUNTIME_ROLE=enforce`, identidad runtime no
propietaria y sin `BYPASSRLS`, dos tenants y reutilización de pool.

**2. La analítica agrega EN MEMORIA y no cumple el objetivo de rendimiento.**
`hospital-patients.service.ts:305-308` trae todas las filas del conjunto filtrado
con `findMany` sin `take` y las recorre en Node: no hay `GROUP BY` ni agregación
en PostgreSQL. El p95 medido y reportado en la corrección es ~1719 ms sin filtros
y ~884 ms con filtros, frente al objetivo documentado de ≤500 ms. El rendimiento
sigue siendo un gate de producción abierto.

**3. La migración no crea ningún índice.** Se apoya en los índices existentes por
`tenantId`. No existe índice sobre `person.familyNames`, `person.givenNames` ni
`person.birthDate`, que son exactamente las columnas por las que el listado
ordena. Ampliar la indexación exige una Task propia con justificación y rollback.

**4. En `develop` la identidad hospitalaria no está configurada.**
`.env.example` no declara `MERDN_HOSPITAL_PATIENT_VIEWER_SECRET` ni
`MERDN_HOSPITAL_PATIENT_VIEWER_CODE`. El aprovisionamiento es fail-closed: sin
secreto válido la identidad se omite por completo, sin fallback. Un despliegue
hecho solo con `.env.example` de `develop` expone la superficie pero no permite
abrir ninguna sesión hospitalaria, de modo que responde `401` uniforme. La
configuración local existe fuera de `develop`, en el commit `45b12e2` de una rama
WIP (`spec/bitacora/decisiones/2026-08-25-auditoria-git-y-estado-de-ramas.md`).

**5. No hay auditoría de Codex de esta capacidad.** Ver «Naturaleza de esta
spec». Es la brecha de proceso, no de código, más relevante de esta spec:
ninguna de las decisiones de minimización descritas arriba fue revisada por un
segundo agente con veredicto registrado.

**6. Desviación de literal respecto a la Task.** `TASK-HOSPITAL-CORE-01` §4.3
exige el texto `No disponible en CORE-01`; el código usa `Información no
disponible` (`hospitalPatientsConfig.ts:253`), porque la configuración visible no
puede nombrar terminología interna del proyecto. La intención —no escribir `Sin
asignar`, ni cero, ni porcentaje, ni semáforo— sí se cumple. No hay auditoría que
acepte formalmente el cambio.

**7. Dominios que la vista muestra y el sistema no tiene.** Condición principal,
Patologías, Profesional, Cuidador, Programa, Próxima atención, Últimas
atenciones, Semáforo, «Sin cuidador» y «Sin profesional» aparecen en la
composición y siempre valen «Información no disponible». No son campos vacíos ni
ceros: el sistema no puede distinguir «no tiene» de «no está modelado». Ningún
control asociado se envía a la API.

**8. `patientStatus` solo modela `ACTIVE`.** En consecuencia `sort=status` es un
orden real pero hoy inerte, y el campo `status` de la respuesta es el literal
`'ACTIVE'` (`hospital-patients.service.ts:274,489`) en vez de derivarse de
`row.status`. Es coherente mientras el `where` restrinja siempre al estado
consultado; dejaría de serlo al añadir otro estado.

**9. La superficie es de solo lectura y no lo será de otro modo aquí.** No hay
creación, edición, archivado, exportación, descarga, impresión dedicada ni
conciliación. Tampoco hay intercambio entre instituciones: ver un paciente de
otro tenant exigiría una relación interinstitucional aprobada que esta capacidad
no diseña (`hospital-patients.service.ts:64-67`).

**10. Este rol no es RBAC definitivo ni autorización clínica.**
`TASK-HOSPITAL-CORE-01` §9.10 lo declara: producción con información personal o
de salud real queda bloqueada hasta que existan identidad individual, finalidad,
relación o asignación, vigencia, consentimiento aplicable y política de retención
aprobadas.

## Criterios de éxito

- Una identidad hospitalaria con el rol correcto ve exclusivamente los pacientes
  de su tenant, con la proyección mínima descrita, y ninguna otra identidad ve
  nada.
- Ninguna respuesta, error ni evento de auditoría contiene un solo campo de la
  lista de prohibidos de `hospital.contract.ts:8-12`.
- Toda lectura nominal servida tiene su evento de auditoría; no existe la
  combinación contraria.
- La vista nunca mezcla cifras servidas con cifras de demostración, ni siquiera
  ante error.
- Las suites `hospital-patients.api.test.ts`, `hospital-patients.query.test.ts`,
  `hospital-patients.projection.test.ts`, `hospital-patient-viewer.guard.test.ts`,
  `hospitalPatientsClient.test.ts`, `hospitalPatients.test.tsx` y
  `hospitalAlcance.test.ts` pasan. **No se ejecutaron el 2026-08-25**: ver
  `research.md` R16.
