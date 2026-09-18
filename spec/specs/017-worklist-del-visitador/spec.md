# Especificación 017 - Worklist del profesional visitador

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

> **Auditoría de MP02 del 2026-08-25: `SPEC 017 READY FOR APPROVAL: NO`.**
> El estado sigue en `Pendiente` por decisión de esa auditoría. Ver la sección
> «Auditoría de MP02 (2026-08-25)».

## Naturaleza de esta spec

**As-built, y con MP02 auditado pero no integrado.** Es la única spec del
repositorio que documenta un micropaquete cuya implementación existe fuera de
`develop`, ya tiene veredicto de auditoría —`PASS WITH CORRECTIONS`— y sigue sin
integrarse porque ese veredicto exige correcciones previas.

Task Specifications: `tasks/VISITADOR-CORE-01-MP01-PROFESSIONAL-WORKLIST-API.md`
y `tasks/VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md`. Ambas congeladas.

**No existe auditoría de Codex para esta capacidad.** `ls reviews/` devuelve 22
entradas —20 veredictos de auditoría más `README.md` y `REVIEW-TEMPLATE.md`— y
ninguna nombra `VISITADOR`. MP01 se implementó y se commiteó sin
veredicto de auditoría registrado; ninguna de las dos Task Specifications fue
auditada. La ausencia es un dato, no un olvido de esta spec.

**Actualizado el 2026-08-25.** El párrafo anterior sigue siendo cierto para MP01
y para `reviews/`, que además está congelado. Dejó de serlo para MP02: Codex lo
auditó y devolvió `PASS WITH CORRECTIONS`. El veredicto y las correcciones que
exige se registran en esta spec, no en `reviews/`. Ver «Auditoría de MP02
(2026-08-25)».

MP01 es el penúltimo commit de `develop` en el corte original (`15a9ae1`). MP02
se especificó en `6a54de9` y solo añade su propia Task Specification: en
`develop` no tiene implementación. Esta capacidad es, por tanto, el trabajo en
curso de MERDN el 2026-08-25.

**Corrección del 2026-08-25, posterior al corte.** La frase original de esta
spec —«no tiene implementación posterior en ninguna rama»— dejó de ser cierta.
Con autorización expresa del Product Owner, el código de MP02 que vivía sin
control de versiones se preservó en la rama `wip/visitador-mp02-20260825`,
commit `cffbf6bd7b5e19a4fb712467e928f92698b18b99`
(`wip(visitador): preserve mp02 implementation`), seis archivos y 2.763 líneas
añadidas, subida a `origin/wip/visitador-mp02-20260825`.

Preservar no es integrar ni aprobar. La rama **no** se fusionó con `develop` y
**no** se ejecutó ninguna de las dos suites que incluyen. Detalle en
`spec/bitacora/global/PROJECT_LOG.md`; contexto previo en
`spec/bitacora/decisiones/2026-08-25-auditoria-git-y-estado-de-ramas.md`.

**Segunda corrección del 2026-08-25.** Este párrafo decía además que el contenido
de los seis archivos no se había leído ni contrastado con la Task Specification
de MP02 y que no existía auditoría de Codex. Ambas cosas dejaron de ser ciertas
ese mismo día: Codex auditó MP02 y devolvió `PASS WITH CORRECTIONS`, con
`SAFE TO INTEGRATE INTO DEVELOP: NO`. Lo que ese veredicto exige está en
«Auditoría de MP02 (2026-08-25)».

## Auditoría de MP02 (2026-08-25) — `PASS WITH CORRECTIONS`

**Fuente.** Auditoría independiente de Codex sobre el código preservado en
`wip/visitador-mp02-20260825` (`cffbf6b`), trasladada por el Product Owner el
2026-08-25. Veredicto literal:

| Campo del veredicto | Valor |
|---|---|
| `MP02 CODEX VERDICT` | `PASS WITH CORRECTIONS` |
| `SAFE TO INTEGRATE INTO DEVELOP` | `NO` |
| `SPEC 017 READY FOR APPROVAL` | `NO` |

`PASS WITH CORRECTIONS` significa que la dirección de MP02 se acepta y que la
integración queda **condicionada**. Mientras B1–B6 no estén hechas y verificadas,
MP02 no entra en `develop` y esta spec no se aprueba.

Esta sección **registra** lo exigido; no lo implementa. En la sesión que la
escribió no se modificó código, no se tocó la rama WIP, no se fusionó nada y el
estado de aprobación siguió en `Pendiente`. La §12 de `CLAUDE.md` sigue vigente
sin excepción: nada de esto autoriza commit, merge, push, release ni despliegue.
El detalle verificable está en `tasks.md`; la fase que lo agrupa, en la Fase 4 de
`plan.md`.

### Estado de aprobación de las correcciones

El 2026-08-25 el Product Owner aprobó el **alcance** de B1 y B2, y solo de esas
dos. Registro:
`spec/bitacora/decisiones/2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md`.

| Corrección | Alcance aprobado | Ejecutable hoy |
|---|---|---|
| B1 · fail-closed de `visit` | **Sí**, 2026-08-25 | No: compuerta SDD cerrada |
| B2 · validación de ventana | **Sí**, 2026-08-25 | No: compuerta SDD cerrada |
| B3 · pruebas de interacción real | No | No: además faltan decisiones de dependencia y allowlist |
| B4 · foco y accesibilidad | No | No: depende de B3 |
| B5 · verificación visual y de ejecución | No | No: falta entorno de ejecución |
| B6 · verificaciones finales | Solo su parte de B1 y B2 | No: sigue a la ejecución |

**Aprobar el alcance no abre la compuerta.** SDD no admite aprobación parcial: el
gate lee el `Estado / Status` de esta `spec.md` completa y exige además
consentimiento por spec en `.sdd/user-consent.log`, archivo que hoy no existe. El
consentimiento es un acto del Product Owner (`CLAUDE.md` §14.4). Por eso el estado
de esta spec sigue en `Pendiente`.

**Dónde se ejecutan B1 y B2: en la spec 018.** El 2026-08-25 el Product Owner
eligió la «vía B» y B1 y B2 se trasladaron a
`spec/specs/018-correcciones-visitador-mp02/`, una spec acotada a esas dos
correcciones, con allowlist de dos archivos. Aprobar y consentir **esa** spec
abre la compuerta solo para ellas, sin aprobar esta. B3, B4, B5 y todo el
hardening siguen viviendo aquí.

### Correcciones BLOQUEANTES antes de integrar en `develop`

**B1 · Fail-closed de `visit`.**
CUANDO el cliente normalice una fila del worklist, EL SISTEMA DEBERÁ tratar
**solo** `visit: null` explícito como «cita no materializada», y DEBERÁ tratar
como respuesta inválida cualquier fila en la que `visit` falte o llegue mal
formado.

Medido en `cffbf6b`: `normalizarVisita` devuelve `null` tanto para `null` como
para `undefined` (`visitadorWorklistClient.ts:281-284`). Hoy, una respuesta a la
que le falte el campo se pinta como `Pendiente de preparación por la
institución`, que es una afirmación que el servidor no hizo.

**B2 · Validación de ventana.**
CUANDO se resuelva una ventana, EL SISTEMA DEBERÁ rechazar la ventana invertida
y la ventana mayor de 31 días; y CUANDO reciba la respuesta, DEBERÁ exigir que la
ventana devuelta por el servidor coincida **exactamente** con la solicitada, y
tratar cualquier discrepancia como respuesta inválida.

Medido en `cffbf6b`: la salida sí se valida antes de la red
(`esVentanaValida:240`, invocada en `:428`), pero la entrada no.
`normalizarWorklist` solo comprueba la forma de día de `window.from` y
`window.to` (`:361-364`) y nunca la compara con la ventana pedida (`:468`): una
agenda de otro periodo se mostraría como si fuera la solicitada.

**B3 · Pruebas de interacción real.**
Las suites actuales renderizan marcado estático con `renderToStaticMarkup` e
inyectan cada desenlace por propiedad; la propia suite declara que clic, foco,
teclado y navegación entre vistas quedan fuera
(`visitadorExperience.test.tsx:33-43`). Deben cubrirse, como mínimo:

1. detección inicial de sesión;
2. carga inicial del día UTC actual;
3. aplicar periodo;
4. anterior;
5. siguiente;
6. hoy;
7. abrir visita;
8. cargar detalle;
9. volver a la agenda;
10. reintento;
11. logout exitoso;
12. logout fallido;
13. peticiones abortadas o rezagadas que no deben repintar información
    incorrecta.

**B4 · Foco y accesibilidad.**
Gestionar el foco al entrar al detalle, restaurarlo al regresar a la agenda, y
verificar navegación por teclado y accesibilidad.

**B5 · Verificación visual y de ejecución.**
Comprobar en ejecución: escritorio, viewport estrecho, comportamiento responsive
y fidelidad con el diseño aprobado, sin alterar la dirección visual aprobada.

**B6 · Verificaciones finales.**
Tras las correcciones deben volver a pasar, y reportarse con su salida exacta:
las 78 pruebas focales existentes; las nuevas pruebas de interacción; el
typecheck de web; el ESLint acotado a los archivos del paquete;
`git diff --check`; y la validación SDD correspondiente.

> **Las 78 pruebas focales, medidas.** `visitadorWorklistClient.test.ts` declara
> 23 bloques `it` que expanden a 43 casos por sus tres recorridos parametrizados
> (5 ventanas inválidas, 7 desenlaces de estado, 11 cuerpos inválidos), y
> `visitadorExperience.test.tsx` declara 30 que expanden a 35 (6 desenlaces de
> fallo). 43 + 35 = 78. **Medido leyendo la rama, no ejecutado**: en la sesión
> que escribió esta sección no se corrió ninguna suite.

### Hardening RECOMENDADO después de integrar — NO bloqueante

Ninguna de estas líneas condiciona la integración de MP02. Son límites ya
registrados en «Estado real y límites conocidos» y se listan aquí únicamente para
que no se confundan con B1–B6:

- evento de auditoría para la lectura del worklist (límite conocido 4);
- paginación, límite de filas y límite de tasa (límite conocido 5);
- zona institucional en vez de ventana UTC pura (límite conocido 6);
- desambiguación de los dos casos que hoy comparten `visit: null` (límite
  conocido 7);
- unificación de la condición de autorización duplicada entre
  `professional-visit-worklist.service.ts:303` y
  `professional-visit-query.service.ts:156`;
- ejecución de las 12 pruebas del bloque `E` de la API y del resto de la
  «Verificación pendiente» de `tasks.md`;
- MP03, las transiciones profesionales desde la interfaz, que ni siquiera está
  especificado.

### Decisiones de producto todavía requeridas

B3, B4 y B5 no se pueden ejecutar con el repositorio tal como está. Lo que sigue
son decisiones del Product Owner, no de Claude Code (`CLAUDE.md` §4 y §9):

1. **Entorno DOM de pruebas.** `apps/web/vitest.config.mts:28` fija
   `environment: 'node'` y el repositorio no tiene `jsdom`, `happy-dom` ni
   `@testing-library/*`. Probar clic, foco, teclado y accesibilidad exige una
   dependencia nueva: decisión de dependencia (§9.11) y además una de las stop
   conditions declaradas por la propia Task Specification de MP02.
2. **Ampliación de la allowlist de MP02.** Esa dependencia obliga a tocar
   `apps/web/vitest.config.mts`, `apps/web/package.json` y el lockfile, los tres
   fuera de los seis archivos de la allowlist congelada (§9.10).
3. **Entorno de ejecución para B5.** La verificación visual exige la aplicación
   en marcha con API, PostgreSQL con tenant aplicado, proveedor OIDC y agenda
   sembrada. `tools/hospital-local-data/` no existe en esta copia (límite
   conocido 13) y `apps/api/node_modules` está vacío.
4. **Vía de integración.** Cómo llega MP02 corregido a `develop` —sobre la rama
   WIP, sobre una rama nueva desde `develop`, con qué operación Git y con qué
   autorización— no está decidido. La §12 no admite inferencia.

Hasta que existan esas decisiones, B3, B4 y B5 quedan **registradas y
bloqueadas**, no en curso. B1 y B2 caben dentro de la allowlist congelada de MP02
y solo esperan aprobación de alcance.

## Objetivo

Que una persona profesional autenticada pueda **descubrir su propia agenda
domiciliaria** —qué citas HOME asignadas tiene en una ventana de calendario y
cuáles de ellas ya están materializadas como visita— sin recibir identificadores
desde Hospital, desde fixtures ni desde datos inventados, y sin que el navegador
pueda preguntar por el trabajo de otra persona.

## Historia de usuario principal

Como profesional que realiza visitas domiciliarias, quiero ver mis citas
asignadas de un periodo y saber cuáles ya están listas para ejecutar, para poder
abrir la visita correcta sin depender de que alguien me pase su identificador.

## Qué hace hoy el sistema

| Capacidad | Dónde vive | Qué hace exactamente |
|---|---|---|
| Ruta de worklist | `apps/api/src/visits/visits.controller.ts:283` (`@Get()`), handler en `:335` | `GET /api/v1/professional/visits?from=AAAA-MM-DD&to=AAAA-MM-DD`. Se declara ANTES que `:visitId` para hacer la precedencia explícita |
| Guarda | `visits.controller.ts:265` | `HumanSessionGuard` sobre TODO el controlador profesional. La lectura no exige `SameOriginGuard`; el `PATCH` de estado sí (`:411`) |
| No caché | `apps/api/src/human-auth/human-session.guard.ts:124-127` | `noStore(response)` fija `Cache-Control: private, no-store` y `Vary: Cookie`. El guard las pone antes de decidir, de modo que también las lleva el `401` |
| Validación de ventana | `apps/api/src/visits/visits.dto.ts:531` `parseWorklistQuery` | `from` y `to` obligatorios, sin valor por defecto; allowlist cerrada `['from','to']` (`:400`); fecha real de calendario (`2026-02-31` se rechaza); ventana no invertida; máximo 31 días inclusive (`:409`); repetición y sintaxis anidada rechazadas |
| Autorización | `apps/api/src/visits/professional-visit-worklist.service.ts:303` `asignacionAutorizada` | Cadena completa en UNA sola condición SQL: `principal.personId` → `ProfessionalProfile` `ACTIVE` → al menos una `ProfessionalAffiliation` `ACTIVE` y vigente hoy → `CareAssignment` `ACTIVE` y vigente en el instante del servidor |
| Consulta | `professional-visit-worklist.service.ts:102` `listAuthorized` | Una sola operación bajo `PrismaService.withTenant(principal.tenantId)`. Filtro explícito por `tenantId` en cita, paciente, asignación, perfil y afiliación, ADEMÁS de RLS y de las claves foráneas compuestas |
| Ventana UTC | `visits.dto.ts:441` y `:452` | `startOfUtcDay` / `endOfUtcDayExclusive`. Cota superior EXCLUSIVA sobre el día siguiente: el último milisegundo de `to` entra |
| Filtro de citas | `professional-visit-worklist.service.ts:119-135` | Solo `modality = HOME` y `status = ASSIGNED`, con `scheduledStart` dentro de la ventana. Una cita sin `scheduledStart` queda fuera por construcción |
| Orden | `professional-visit-worklist.service.ts:160` | `scheduledStart ASC`, desempate por `id ASC`. Dos lecturas idénticas devuelven el mismo orden |
| Proyección minimizada | `professional-visit-worklist.service.ts:202-257` | `{ appointmentId, scheduledStart, modality: 'HOME', patient: { displayName, initials }, visit: null \| { homeVisitId, status, version, startedAt, endedAt, updatedAt } }` |
| Coherencia defensiva | `professional-visit-worklist.service.ts:235-247` | La visita solo se proyecta si su `careAssignmentId` coincide con el de la cita autorizada. Una incoherencia se resuelve CERRADO, devolviendo `visit: null` |
| Lista vacía en vez de `403` | `professional-visit-worklist.service.ts:54-58` | Sin perfil, sin afiliación vigente, sin asignaciones o sin citas se devuelve `200` con `items: []`. No se puede enumerar quién es profesional operativo |
| DTOs y OpenAPI | `visits.dto.ts:575`, `:594`, `:642`, `:685`, `:696` | Cinco clases documentadas. `operationId: listProfessionalVisitWorklist`, dos parámetros de consulta, ambos obligatorios |
| Registro del módulo | `apps/api/src/visits/visits.module.ts` | `ProfessionalVisitWorklistService` declarado como proveedor junto a los servicios de materialización, transición y lectura de detalle |
| Pruebas de borde | `apps/api/test/visits.api.test.ts:1285-1740` (bloque `E`) | 12 pruebas de integración contra PostgreSQL real; el `503` fail-closed se cubre en el bloque `D` (`:1742`) |

### Lo que el cliente NO puede aportar

La consulta admite exactamente dos parámetros. `tenantId`, `professionalId`,
`patientId`, `careAssignmentId`, `personId`, `humanAccountId`, `identityId`,
`status`, `modality`, `role` y `now` producen `400`
(`apps/api/test/visits.api.test.ts:1408-1418`). No se filtran después: **no
figuran en la allowlist**, y esa ausencia es la garantía. El instante de
evaluación lo fija el servidor (`visits.controller.ts:348`).

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | Monorepo, Prisma, PostgreSQL, validación de entorno, NestJS | Sin base de datos ni módulo no hay ruta que exponer |
| 007-inscripcion-paciente-persistente | `Person`, `Patient`, tenant resuelto en servidor, RLS desde el primer dato, fail-closed | `patient.displayName` e `initials` se proyectan de `Person.givenNames` y `familyNames`; el aislamiento por tenant es el que fijó esta spec |
| 010-hospital-profesionales-agenda-api | `ProfessionalProfile`, `ProfessionalAffiliation`, `CareAssignment`, `Appointment` y la migración `hospital_core_02` | Es literalmente la agenda que el worklist lee. Sin asignación vigente no hay nada que devolver |
| 011-identidad-humana-y-relaciones | OIDC, `HumanSession`, `HumanSessionGuard`, `HumanPrincipal` (`sessionId`, `humanAccountId`, `personId`, `tenantId`) y el helper `noStore` | Toda la autorización deriva de `principal.personId`. Sin sesión humana el controlador no se ejecuta |
| 012-visitas-domiciliarias | `HomeVisit`, `HomeVisitStatus`, `ProfessionalVisitsController`, `visits.dto.ts`, `visits.module.ts` y la MISMA barrera de `professional-visit-query.service.ts` | El worklist es una lectura más sobre el módulo que esa spec creó: no crea dominio, no crea modelos y no reimplementa la máquina de estados |
| 013-visitas-visibles-en-hospital | `apps/web/src/features/hospital/hospitalVisitsClient.ts` (`consultarVisitaProfesional`, `:351`) y la materialización desde `HospitalAgenda` | Hospital es quien materializa: sin ese acto, toda fila del worklist llega con `visit: null`. MP02 reutilizaría ese cliente para el detalle |
| 014-sesion-profesional-en-shell | `apps/web/src/features/hospital/hospitalHumanSessionClient.ts` (`urlDeLoginHumano:135`, consulta y cierre de sesión) | MP02 debe importarlo sin copiarlo: es el único camino de login humano aprobado en la web |

**Dependencias externas:** PostgreSQL en marcha con el tenant activo aplicado;
proveedor OIDC (Keycloak local) para emitir la sesión humana;
`tools/identity-provisioning` como **único** camino para asociar un `subject`
del proveedor a una `Person` (no existe endpoint de vinculación).

**Migraciones de las que depende:** `20260822160000_hospital_core_02`
(`appointment`, `care_assignment`, `professional_profile`,
`professional_affiliation`, sus cuatro políticas RLS y los grants de
`merdn_runtime`), `20260823120000_identity_relationships_core_01`
(`human_account`, `human_session`, con `ENABLE` + `FORCE` RLS) y
`20260824120000_visits_core_01` (`home_visit`, `home_visit_transition`, trigger
`home_visit_guard`, `ENABLE` + `FORCE` RLS).

**Esta spec NO introduce ninguna migración.** El commit `15a9ae1` toca cinco
archivos y ninguno está en `prisma/`.

**Specs que dependen de esta:** ninguna hoy. MP02 —la interfaz `/visitador`— y
un eventual MP03 de transiciones profesionales dependerían de ella. MP02 existe
como código preservado en `wip/visitador-mp02-20260825`, no en `develop` y sin
verificar; MP03 no existe.

## Escenarios de aceptación

1. Dada una persona con perfil profesional `ACTIVE`, afiliación vigente y una
   `CareAssignment` `ACTIVE`, cuando consulta `GET /api/v1/professional/visits`
   con una ventana que contiene su cita HOME `ASSIGNED`, entonces la respuesta
   lista esa cita con la ventana pedida sin ampliarla ni recortarla.
2. Dada una cita HOME asignada que Hospital todavía no materializó, cuando la
   profesional consulta su worklist, entonces la fila aparece con `visit: null`
   y ninguna acción de materialización.
3. Dada una visita ya materializada, cuando la profesional consulta su worklist,
   entonces la fila devuelve `status` y `version` reales; y tras una transición
   ejecutada por el `PATCH`, la siguiente lectura refleja el estado nuevo.
4. Dada una petición sin cookie de sesión humana, cuando llega al worklist,
   entonces la API responde `401` con código `HUMAN_SESSION_REQUIRED` y ninguna
   otra cookie la sustituye.
5. Dada una consulta sin `from`, con fecha inexistente, invertida, de más de 31
   días, con parámetro repetido o con cualquier campo de autoridad, cuando llega
   al worklist, entonces la API responde `400` sin devolver el valor recibido.
6. Dada una persona autenticada sin perfil profesional, o con perfil inactivo, o
   sin afiliación vigente, cuando consulta el worklist existiendo agenda real en
   el tenant, entonces recibe `200` con `items: []` y no un `403`.
7. Dadas dos profesionales del mismo tenant y una tercera de otro tenant, cuando
   cada una consulta su worklist, entonces cada quien ve exclusivamente sus
   citas y ningún identificador ajeno aparece en el cuerpo serializado.
8. Dadas citas `VIRTUAL`, `ON_SITE`, `CANCELLED` y HOME fuera de la ventana en
   la misma asignación, cuando se consulta el worklist, entonces solo aparece la
   cita HOME `ASSIGNED` dentro de la ventana.
9. Dadas dos citas programadas en el mismo instante, cuando se consulta dos
   veces, entonces el orden es idéntico y desempata por identificador de cita.
10. Dado que el contexto de ejecución seguro no se confirma, cuando llega
    cualquiera de las cuatro operaciones de Visitas, entonces responden `503`
    con `VISITS_SERVICE_UNAVAILABLE` y nada se escribe.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se reciba una consulta de worklist, EL SISTEMA DEBERÁ exigir `from` y
  `to` y rechazar cualquier otro parámetro con `400`.
- CUANDO se resuelva la autorización, EL SISTEMA DEBERÁ derivarla exclusivamente
  de `principal.personId` y `principal.tenantId`, nunca de la consulta.
- CUANDO se ejecute la lectura, EL SISTEMA DEBERÁ hacerlo en una sola operación
  bajo `withTenant()`, con filtro explícito de tenant además de Row Level
  Security.
- SI la persona autenticada no tiene perfil, afiliación vigente o asignaciones
  vigentes, ENTONCES EL SISTEMA DEBERÁ devolver `200` con lista vacía y NO
  DEBERÁ distinguir ese caso con un código propio.
- CUANDO una cita HOME asignada no esté materializada, EL SISTEMA DEBERÁ
  devolver `visit: null` y NO DEBERÁ ofrecer materializarla.
- CUANDO se devuelva una fila, EL SISTEMA NO DEBERÁ incluir institución,
  profesional, paciente, asignación, persona, documento, fecha de nacimiento,
  contacto, dirección, diagnóstico, alerta ni dato clínico.
- EL SISTEMA DEBERÁ ordenar por `scheduledStart` ascendente y desempatar por
  identificador de cita.
- EL SISTEMA DEBERÁ responder con `Cache-Control: private, no-store` y
  `Vary: Cookie`, también en el `401`.
- SI el contexto de ejecución seguro no se confirma, ENTONCES EL SISTEMA DEBERÁ
  responder `503` sin describir la topología.
- EL SISTEMA NO DEBERÁ escribir ningún evento de auditoría por esta lectura: el
  catálogo `AuditEventType` no tiene ninguno aprobado para esta superficie.

## Ámbito de archivos / File scope

- `apps/api/src/visits/professional-visit-worklist.service.ts` — servicio de solo lectura, 341 líneas, creado por MP01
- `apps/api/src/visits/visits.controller.ts` — `ProfessionalVisitsController`, ruta y contrato OpenAPI del worklist
- `apps/api/src/visits/visits.dto.ts` — `parseWorklistQuery`, ventana UTC, límite de 31 días y las cinco clases DTO
- `apps/api/src/visits/visits.module.ts` — registro del servicio como proveedor
- `apps/api/test/visits.api.test.ts` — bloque `E` (12 pruebas) y el `503` del bloque `D`
- `tasks/VISITADOR-CORE-01-MP01-PROFESSIONAL-WORKLIST-API.md` — Task Specification implementada
- `tasks/VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md` — Task Specification con implementación preservada fuera de `develop`, sin verificar contra ella
- `prototype-claude/Eligeme-Profesional.dc.html` — referencia de composición que MP02 declara, sin consumidor en el código de `develop`

**Fuera de `develop`, en `wip/visitador-mp02-20260825` (`cffbf6b`):**
`apps/web/src/app/visitador/page.tsx`,
`apps/web/src/features/visitador/VisitadorExperience.tsx`,
`apps/web/src/features/visitador/visitador.module.css`,
`apps/web/src/features/visitador/visitadorWorklistClient.ts`,
`apps/web/src/features/visitador/visitadorWorklistClient.test.ts` y
`apps/web/src/features/visitador/visitadorExperience.test.tsx`. Ninguno está en
la rama de integración.

## Estado real y límites conocidos

**1. MP02 no está en `develop`. En la rama de integración la capacidad sigue
siendo invisible para la persona visitadora.** En `develop`,
`grep -ril "worklist" apps/web/` no devuelve nada y no existen
`apps/web/src/app/visitador/` ni `apps/web/src/features/visitador/`. La única
referencia a `professional/visits` en la web de `develop` es
`hospitalVisitsClient.ts:121`, que solo construye las rutas de detalle y de
cambio de estado. Ninguna interfaz de `develop` consume el worklist: **en esta
rama la ruta solo se puede ejercitar con una herramienta HTTP y una cookie de
sesión humana válida.** La implementación preservada en
`wip/visitador-mp02-20260825` no cambia esto mientras no se integre y se
verifique.

**2. El trabajo de MP02 ya está bajo control de versiones, en una rama WIP.**
Esto corrige la afirmación original de esta spec, que decía que no estaba en
ninguna rama y que era cierta en el corte del 2026-08-25. La decisión
`spec/bitacora/decisiones/2026-08-25-auditoria-git-y-estado-de-ramas.md`
registraba que `apps/web/src/app/visitador/` y
`apps/web/src/features/visitador/` existían solo en la copia de trabajo del
auditor, los clasificaba como riesgo **CRÍTICO** y dejaba constancia de que
desde otra copia no podían protegerse.

Ese mismo día, y con autorización expresa del Product Owner, los seis archivos
se preservaron en `wip/visitador-mp02-20260825` (`cffbf6b`), rama subida a
GitHub:

| Archivo | Líneas |
|---|---|
| `apps/web/src/app/visitador/page.tsx` | 32 |
| `apps/web/src/features/visitador/VisitadorExperience.tsx` | 931 |
| `apps/web/src/features/visitador/visitador.module.css` | 357 |
| `apps/web/src/features/visitador/visitadorExperience.test.tsx` | 491 |
| `apps/web/src/features/visitador/visitadorWorklistClient.test.ts` | 466 |
| `apps/web/src/features/visitador/visitadorWorklistClient.ts` | 486 |

Los nombres coinciden con la allowlist de seis archivos de la Task
Specification de MP02.

**Actualizado el 2026-08-25, tras la auditoría.** Este párrafo decía «eso es lo
único verificado» y afirmaba que no se había leído ni revisado el contenido de
los archivos y que no había auditoría de Codex. Dejó de ser cierto: Codex auditó
MP02 sobre `cffbf6b` y devolvió `PASS WITH CORRECTIONS`, con
`SAFE TO INTEGRATE INTO DEVELOP: NO`. Sigue vigente todo lo demás: las
correcciones B1–B6 no se han aplicado, ninguna de las dos suites se ha ejecutado
en esta copia y la rama no se ha fusionado con `develop`. El riesgo de pérdida en
una única máquina queda cerrado; el de corrección e integración sigue abierto,
ahora con su lista exacta.

**3. Qué falta exactamente para MP02** (según su Task Specification): la ruta
`/visitador`, el componente de experiencia, su hoja de estilos, un cliente
tipado del worklist y dos suites de prueba; reutilizando por importación —sin
copiarlos ni modificarlos— `hospitalHumanSessionClient.ts` para el login OIDC y
`hospitalVisitsClient.ts` para el detalle. Seis archivos de allowlist; los seis
existen con esos nombres en `wip/visitador-mp02-20260825`. Tras la auditoría del
2026-08-25, lo que falta ya no es escribirlos sino corregirlos: ver B1–B6 en
«Auditoría de MP02 (2026-08-25)».

**4. La lectura del worklist no deja rastro de auditoría.** `AuditEventType`
tiene 46 valores y ninguno cubre esta superficie: existen
`HOSPITAL_AGENDA_ACCESS_GRANTED` (institucional) y `SUPPORT_AGENDA_READ_GRANTED`
(soporte), pero nada para la agenda propia de la profesional. MP01 §5 lo declara
como residual explícito para un paquete posterior. Hoy no se sabe, desde los
datos, quién consultó su worklist ni cuándo.

**5. No hay paginación, límite de filas ni límite de tasa.** La consulta no lleva
`take`, `skip` ni `cursor`: una ventana de 31 días devuelve todas las citas que
contenga. El controlador solo lleva `HumanSessionGuard`; no hay guarda de tasa
como la de `human-auth` o la de inscripción.

**6. La ventana es UTC pura y sin zona institucional.** `startOfUtcDay` fija el
criterio y el propio código explica por qué no se inventa una zona: MERDN no
tiene ninguna modelada. Una profesional en Colombia (UTC−5) verá los límites de
su día desplazados cinco horas. Es una decisión declarada, no un descuido, y
sigue siendo un límite real de producto.

**7. `visit: null` cubre dos casos distintos.** Significa «cita todavía no
materializada» y también «visita cuya asignación no coincide con la de la cita»
(`professional-visit-worklist.service.ts:242-247`). El segundo es hoy
inalcanzable —el trigger `home_visit_guard` de `visits_core_01` lo impide—, pero
si ocurriera, la respuesta sería indistinguible de una cita pendiente.

**8. La profesional no puede materializar.** Una fila con `visit: null` queda
bloqueada hasta que Hospital ejecute `POST /api/v1/visits/materialize` con
identidad institucional `HOSPITAL_SCHEDULER`. El worklist no abre ese camino y
MP01 lo declara fuera de alcance.

**9. Solo HOME + ASSIGNED.** `REQUESTED`, `CANCELLED`, `VIRTUAL` y `ON_SITE`
quedan fuera. No existe ninguna superficie profesional para consultar citas
virtuales o presenciales propias.

**10. La respuesta expone identificadores opacos.** `appointmentId` y
`homeVisitId` son necesarios para abrir el detalle. MP01 §3 exige que una UI
futura nunca los muestre como texto; esa exigencia **no está verificada por
ninguna prueba**, porque no hay UI que verificar.

**11. Matiz medido sobre RLS.** MP01 §4 exige «filtros explícitos por tenant
además de FKs compuestas y FORCE RLS». Medido: de las tablas que esta consulta
toca, solo `home_visit` y `home_visit_transition` declaran `ENABLE` **y**
`FORCE`; `appointment`, `care_assignment`, `professional_profile`,
`professional_affiliation`, `person` y `patient` declaran solo `ENABLE`. Las
políticas actúan igualmente porque `merdn_runtime` no es propietario de las
tablas y se creó `NOBYPASSRLS`
(`prisma/migrations/20260822120000_core_01_hardening/migration.sql:204-205`),
y son `FOR ALL TO "merdn_runtime"`. El aislamiento se sostiene; lo que no se
cumple al pie de la letra es la redacción de la Task, no la propiedad de
seguridad. El código del servicio no afirma `FORCE` en ningún comentario.

**12. Auditoría de Codex: MP02 sí, MP01 no.** Ninguna de las dos Task
Specifications tiene veredicto en `reviews/`, directorio además congelado. MP02
sí fue auditado el 2026-08-25 —`PASS WITH CORRECTIONS`, registrado en esta spec y
no en `reviews/`—. El código de MP01 sigue sin revisión independiente registrada.

**13. No hay datos de demostración para ejercitarlo.** `tools/` contiene
`identity-provisioning` y `merdn-orchestrator`. `tools/hospital-local-data/`,
que la bitácora describe como cargador local, **no existe en esta copia**.
Probar el worklist a mano exige sembrar tenant, persona, paciente, perfil
profesional, afiliación, asignación y cita, y luego vincular un `subject` OIDC.

**14. «Visitador médico» en `/inscripcion` es otra capacidad.**
`inscripcionFlow.ts:47` ofrece ese perfil, pero `InscripcionExperience.tsx:198`
solo envía a la API la rama `paciente`: la rama visitador no persiste nada y no
crea ningún `ProfessionalProfile`. Pertenece a las specs 002 y 007 y no debe
confundirse con esta superficie.

## Criterios de éxito

- La ruta `GET /api/v1/professional/visits` existe, está protegida por
  `HumanSessionGuard` y responde `no-store` + `Vary: Cookie`.
- Ningún parámetro de autoridad enviado por el navegador es aceptado: los 11
  probados producen `400`.
- Una persona sin agenda propia recibe `200` con lista vacía, nunca `403`.
- Las 12 pruebas del bloque `E` de `apps/api/test/visits.api.test.ts` pasan
  contra PostgreSQL real, incluida la de contrato OpenAPI.
- El módulo de Visitas no crece en dominio: cero migraciones, cero modelos, cero
  eventos de auditoría nuevos.
- **Pendiente:** que exista una interfaz que consuma esta lectura **en
  `develop`**. MP02 existe implementado en `wip/visitador-mp02-20260825` y
  auditado con `PASS WITH CORRECTIONS`; mientras las correcciones B1–B6 no se
  apliquen y se verifiquen, no se integra y esta capacidad no cumple su objetivo
  de producto.
