# Investigación 017 - Worklist del profesional visitador

Medido sobre `develop` el 2026-08-25. `HEAD` = `6a54de9`, idéntico a
`origin/develop`. Cada hallazgo indica el comando o la ruta que lo respalda.

## R1. MP02 es el último commit del repositorio y no tiene implementación

`git log --oneline -3` devuelve, en orden:

```text
6a54de9 docs(visitador): add visible worklist agenda task
15a9ae1 feat(visitador): add professional worklist api
fb871e7 docs(visitador): add professional worklist API task
```

`git show --stat 6a54de9` cambia **un solo archivo**:
`tasks/VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md`, 176 líneas añadidas.
No hay ningún commit posterior. `git rev-parse HEAD origin/develop` devuelve el
mismo SHA: la rama local no adelanta a la remota.

**Confirmado: MP02 está especificado y pendiente.** Es el trabajo en curso del
repositorio.

## R2. No existe ningún consumidor web del worklist

```text
grep -ril "worklist" apps/web/    → sin resultados
```

`grep -ril "worklist"` sobre todo el repositorio (excluyendo `node_modules` y
`.git`) devuelve 20 archivos: las dos Task Specifications, cuatro archivos de
`apps/api/src/visits/`, `apps/api/test/visits.api.test.ts` y el resto son specs
y bitácora. **Ninguno está en `apps/web/`.**

`ls apps/web/src/app/` devuelve `hospital`, `municipality`, `layout.tsx`,
`page.tsx`, `globals.css` y dos pruebas: **no hay `visitador/`**.
`ls apps/web/src/features/` devuelve `experiencia`, `hospital`, `inscripcion`,
`municipality`, `paciente`: **no hay `visitador/`**.

`grep -rn "professional/visits" apps/web/src` devuelve tres coincidencias, todas
en `hospitalVisitsClient.ts:121` y su prueba, y todas construyen únicamente las
rutas de **detalle** y de **cambio de estado**. Ninguna construye la de
colección.

**Ésta es exactamente la brecha de MP02.** Los seis archivos de su allowlist
(`apps/web/src/app/visitador/page.tsx`,
`apps/web/src/features/visitador/VisitadorExperience.tsx`,
`visitador.module.css`, `visitadorWorklistClient.ts` y dos pruebas) tienen cero
implementación.

## R3. El trabajo de MP02 no está en ninguna rama de este repositorio

```text
git ls-tree -r --name-only <rama> | grep -i "visitador\|professional-visit-worklist"
```

| Rama | Resultado |
|---|---|
| `origin/develop` | `professional-visit-worklist.service.ts`, las dos Task Specs, `PasosVisitador.tsx` |
| `origin/wip/eloisa-admin-mp02-20260825` | solo `PasosVisitador.tsx` |
| `origin/wip/pre-fidelity-20260824` | solo `PasosVisitador.tsx` |
| `origin/main` | nada |
| `origin/desarrollar` | nada |

`PasosVisitador.tsx` pertenece al flujo de inscripción (specs 002/007) y no
tiene relación con esta capacidad. Las dos ramas WIP **no contienen** el
servicio del worklist: bifurcaron antes de `15a9ae1`, lo que coincide con lo que
registra `spec/bitacora/decisiones/2026-08-25-auditoria-git-y-estado-de-ramas.md`
(«`wip/eloisa-admin-mp02-20260825` elimina respecto a `develop`
`professional-visit-worklist.service.ts` (341 líneas)»).

Esa misma decisión registra que `apps/web/src/app/visitador/` y
`apps/web/src/features/visitador/` existen **solo en la copia de trabajo del
auditor**, sin commit, y los clasifica como riesgo CRÍTICO no protegible desde
esta copia. No pude verificar esa copia: no está en esta máquina.

## R4. La ruta y sus guardas

`grep -E "@(Controller|Get|Post|Patch|UseGuards)" apps/api/src/visits/visits.controller.ts`:

- `visits.controller.ts:124` — `PROFESSIONAL_VISITS_PATH = 'api/v1/professional/visits'`
- `visits.controller.ts:255` — `@Controller(PROFESSIONAL_VISITS_PATH)`
- `visits.controller.ts:265` — `@UseGuards(HumanSessionGuard)` sobre TODA la clase
- `visits.controller.ts:283` — `@Get()` (worklist), declarado **antes** de `:visitId`
- `visits.controller.ts:352` — `@Get(':visitId')`
- `visits.controller.ts:404` + `:411` — `@Patch(':visitId/status')` con `@UseGuards(SameOriginGuard)` adicional

**La lectura NO lleva `SameOriginGuard`**, y es correcto según MP01 §3: no es
una mutación. La única guarda es la de sesión humana. **No hay guarda de límite
de tasa** en este controlador, a diferencia de `human-auth` o de la inscripción.

El handler (`visits.controller.ts:335-350`) hace exactamente tres cosas: lee el
principal que el guard adjuntó bajo clave simbólica, valida la consulta y llama
al servicio pasando `new Date()` (`:348`). **El instante lo fija el servidor**;
la consulta no puede aportarlo.

## R5. La validación de la ventana es una allowlist, no un filtro

`apps/api/src/visits/visits.dto.ts`:

- `:400` — `PROFESSIONAL_WORKLIST_QUERY_PARAMETERS = ['from', 'to']`
- `:409` — `PROFESSIONAL_WORKLIST_MAX_WINDOW_DAYS = 31`
- `:531` — `parseWorklistQuery`: recorre `Object.keys(consulta)` y lanza si algún
  nombre no está en la allowlist; exige ambas fechas; rechaza `from > to`;
  rechaza más de 31 días inclusive
- `:441` / `:452` — `startOfUtcDay` y `endOfUtcDayExclusive`
- `:502-515` — `fechaCalendario`: comprueba forma `AAAA-MM-DD` **y** que la fecha
  reconstruida en UTC coincida, de modo que `2026-02-31` produce `400` en vez de
  desplazarse al mes siguiente
- `:470-491` — `valorUnico`: rechaza arreglo (parámetro repetido) y objeto
  (sintaxis anidada `?from[x]=y`)

`VisitsQueryError` (`:412`) nombra el parámetro y la regla y **nunca** el valor
recibido. La prueba `visits.api.test.ts:1426-1441` comprueba que ninguno de los
siete identificadores fabricados vuelve en el mensaje.

## R6. La barrera de autorización es la misma que la de la lectura de detalle

Comparé `professional-visit-worklist.service.ts:303-329` con
`professional-visit-query.service.ts:156-182`. La función `asignacionAutorizada`
es **textualmente equivalente** en ambos archivos: mismo `tenantId`, mismo
`status: 'ACTIVE'`, misma vigencia por `startsAt`/`endsAt`, mismo
`professional.personId = principal.personId`, mismo `status: 'ACTIVE'` del perfil
y mismo `affiliations: { some: { ... } }` con `startsOn`/`endsOn` reducidos a día
UTC por `fechaSinHora`.

Ambos archivos documentan la duplicación y su motivo: la allowlist de cada
paquete prohibía modificar el servicio del otro. **Es duplicación consciente de
la condición, no de la barrera**: las dos se evalúan sobre las mismas filas, bajo
el mismo `withTenant()` y con RLS vigente. Vale la pena registrarla como deuda:
si la regla de vigencia cambia, hay que cambiarla en dos sitios.

## R7. Qué devuelve exactamente, y qué no

`professional-visit-worklist.service.ts:202-257`. La proyección es
`{ appointmentId, scheduledStart, modality: 'HOME', patient: { displayName, initials }, visit }`,
y `visit` es `null` o
`{ homeVisitId, status, version, startedAt, endedAt, updatedAt }`.

`modality` es una **constante del contrato** (`:211`), no un reflejo del
almacenamiento: el filtro `where` ya la fijó.

`displayName` (`:265`) e `initials` (`:274`) se derivan de
`Person.givenNames`/`familyNames`. Son proyecciones de presentación: no hay
búsqueda por ellas en esta superficie.

`proyectarVisita` (`:235-257`) devuelve `null` si `careAssignmentId` de la visita
no coincide con el de la cita. **`visit: null` tiene por tanto dos significados**
—no materializada, o incoherente— y el cliente no puede distinguirlos. El
segundo caso es hoy inalcanzable por el trigger `home_visit_guard` de
`visits_core_01`, pero el contrato queda ambiguo.

`orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }]` (`:160`). **No hay `take`,
`skip` ni `cursor`**: `grep -n "take\|skip\|cursor"` sobre el servicio solo
encuentra la palabra «cursor» dentro de un comentario (`:23`). Una ventana de 31
días devuelve todas las filas que contenga.

## R8. Aislamiento por tenant: cuántas barreras hay realmente

El `where` (`:119-135`) repite `tenantId` en cita, paciente y —vía
`asignacionAutorizada`— en asignación, perfil y afiliación. Además:

`grep -rE 'ALTER TABLE "[a-z_]+" *(ENABLE|FORCE) +ROW LEVEL SECURITY' prisma/migrations/*/migration.sql`:

| Tabla | `ENABLE` | `FORCE` |
|---|---|---|
| `appointment`, `care_assignment`, `professional_profile`, `professional_affiliation` | sí (`hospital_core_02`) | **no** |
| `person`, `patient` | sí (`core_01_hardening`) | **no** |
| `home_visit`, `home_visit_transition` | sí (`visits_core_01:381,383`) | sí |
| `human_account`, `human_session`, `external_auth_identity`, ... | sí | sí |

La Task Specification de MP01 exige «filtros explícitos por tenant además de FKs
compuestas y FORCE RLS»
(`tasks/VISITADOR-CORE-01-MP01-PROFESSIONAL-WORKLIST-API.md:108`). Medido, de las
tablas que esta consulta toca solo `home_visit` declara `FORCE`; el propio
servicio es más preciso que su Task y no menciona `FORCE` en ningún comentario
(`grep -n "FORCE" professional-visit-worklist.service.ts` no devuelve nada): su
cabecera habla de «Row Level Security vigente» (`:51`) y el `where` de «filtro
explícito por tenant [...] ADEMÁS de Row Level Security [...] y ADEMÁS de las
claves foráneas COMPUESTAS» (`:111-118`).

**El aislamiento no se rompe.** `merdn_runtime` se crea `NOBYPASSRLS` y no es
propietario de las tablas (`core_01_hardening:204-205`), y las políticas son
`FOR ALL TO "merdn_runtime"` (`hospital_core_02:357-375`), de modo que se aplican
igual sin `FORCE`. Lo que no se cumple literalmente es la redacción de la Task,
no la propiedad de seguridad.

## R9. Ninguna migración, ningún evento de auditoría

`git show --stat 15a9ae1` toca exactamente cinco archivos, los cinco de la
allowlist de MP01, y **ninguno bajo `prisma/`**. La última migración del
repositorio es `20260825120000_eloisa_admin_access_01_mp01`, que pertenece a la
spec 016.

El enum ocupa `prisma/schema.prisma:124-171` y declara 46 valores (líneas
125-170; la 171 es la llave de cierre). Comprobado con
`awk '/^enum AuditEventType \{/,/^\}/' prisma/schema.prisma | grep -vE '^\s*///|^\s*$|^enum|^\}' | wc -l` → 46.
Hay `HOSPITAL_AGENDA_ACCESS_GRANTED` (agenda institucional) y
`SUPPORT_AGENDA_READ_GRANTED` / `_DENIED` (agenda vista por soporte), pero
**ninguno para la agenda propia de la profesional**. MP01 §5 lo declara como
residual consciente: «el enum/modelo actual no tiene todavía un evento aprobado
para worklist profesional y una migración excedería este packet».

Consecuencia medida: **la consulta del worklist no deja rastro**. Sí lo dejan la
materialización (`HOME_VISIT_MATERIALIZED`) y las tres transiciones.

## R10. Cobertura de pruebas del worklist

`apps/api/test/visits.api.test.ts`, 1.865 líneas. El bloque `E · GET
/api/v1/professional/visits` ocupa `:1285-1740` y contiene **12 pruebas**:

1. `:1286` cita asignada no materializada → `visit: null` + `no-store`
2. `:1315` cita materializada → estado y versión reales, y reflejo tras `PATCH`
3. `:1354` sin sesión humana → `401`; ninguna otra cookie sustituye
4. `:1381` ventana ausente, imposible, invertida, excesiva o con campos de autoridad → `400` (23 consultas inválidas: 12 de forma de ventana y 11 de campos de autoridad, incluidos `tenantId` `:1408`, `professionalId` `:1409`, `patientId`, `careAssignmentId`, `personId`, `humanAccountId`, `identityId`, `status`, `modality`, `role` `:1417` y `now` `:1418`), más la comprobación de que la ventana de 31 días **sí** se admite
5. `:1447` persona sin perfil profesional → lista vacía, no `403`
6. `:1463` perfil inactivo, afiliación ausente, futura o vencida → lista vacía
7. `:1525` otra profesional, otro paciente, otra institución → no aparecen, y en sentido inverso
8. `:1558` solo HOME + ASSIGNED + dentro de ventana (descarta `VIRTUAL`, `ON_SITE`, `CANCELLED` y los dos milisegundos frontera)
9. `:1575` la ventana incluye sus dos límites UTC completos
10. `:1595` orden estable con desempate por identificador, comprobado con dos lecturas
11. `:1614` respuesta minimizada: sin identificadores internos ni PII, con lista negra de 13 nombres de campo
12. `:1679` contrato OpenAPI: `operationId`, exactamente dos parámetros obligatorios y las propiedades exactas de las cinco clases DTO

El `503` fail-closed se cubre en el bloque `D` (`:1742`), que ejercita las
**cuatro** operaciones —incluida la worklist (`:1758`)— contra una aplicación
gemela cuyos servicios rechazan con `RuntimeContextUnavailableError`, y verifica
que el cuerpo sea exactamente `{ code, message }` sin traza, SQL ni tenant.

**Sí, `visits.api.test.ts` cubre el worklist**, y con más profundidad que la
media del repositorio. No existe ninguna prueba de la interfaz, porque no existe
interfaz.

## R11. Relación con la spec 012 y con Hospital

El worklist consume el modelo de la spec 012 sin ampliarlo:
`visits.module.ts` declara `ProfessionalVisitWorklistService` junto a los tres
servicios que 012 creó, y su propia documentación (`visits.module.ts:22-33`)
declara que la worklist «REUTILIZA los mismos núcleos y la misma barrera» y «NO
duplica dominio».

La dependencia operativa es asimétrica y conviene decirla claro: **una fila del
worklist solo deja de ser `visit: null` cuando Hospital materializa**. Esa acción
vive en `HospitalAgenda.tsx:714-733` (spec 013) y exige una identidad
institucional `HOSPITAL_SCHEDULER`. Sin ese acto administrativo, la profesional
ve su cita pero no puede abrir ninguna visita.

## R12. Ninguna auditoría de Codex para esta capacidad

`ls reviews/` devuelve 22 entradas: 20 veredictos de auditoría más `README.md`
y `REVIEW-TEMPLATE.md`, que no lo son.
`ls reviews/ | grep -i visitador` no devuelve nada. Tampoco hay `REVIEW-VISITS-*`
que cubra este paquete: el más cercano por dominio es
`REVIEW-MVP-CORE-01-FINAL.md`, que es de otra capacidad.

`reviews/README.md` declara el directorio cerrado el 2026-08-25 y prohíbe crear
auditorías nuevas allí. **Registro el hecho: MP01 se commiteó sin veredicto de
auditoría independiente**, y MP02 tampoco lo tiene.

## R13. Superficies que se llaman «visitador» y no lo son

`grep -ril "visitador" apps/web/` devuelve 10 archivos. Todos pertenecen al flujo
de inscripción o son etiquetas sueltas:

- `inscripcionFlow.ts:47` — perfil «Visitador médico» del asistente de
  inscripción, con su rama de cinco pasos;
- `InscripcionExperience.tsx:198-199` — `valoresPaciente` solo se puebla si
  `state.rama.perfil === 'paciente'`, y `:215` envía únicamente eso. **La rama
  visitador de la inscripción no persiste nada** y no crea `ProfessionalProfile`;
- `hospitalPatientsConfig.ts:114` — la cadena «rango configurado por el
  visitador» dentro de un texto de configuración.

No debe confundirse ninguna con la superficie profesional de esta spec.

## R14. Herramientas para ejercitar la capacidad a mano

`ls tools/` devuelve `identity-provisioning` y `merdn-orchestrator`.
`tools/hospital-local-data/`, que la bitácora del 2026-08-25 describe como
cargador local de datos de demostración, **no existe en esta copia**: vive en una
rama WIP.

`tools/identity-provisioning/README.md` declara que es el **único** camino para
asociar un `subject` OIDC a una `Person`, que no existe endpoint de vinculación y
que `--dry-run` es el comportamiento por defecto. Cualquier prueba manual del
worklist pasa por ahí.

## Verificación no ejecutada

No pude ejecutar nada. Lo declaro en vez de afirmarlo:

1. **Las 12 pruebas del bloque `E` no se ejecutaron.** `node_modules` no está
   instalado (comprobado en la raíz y en `apps/api`), el cliente Prisma generado
   `apps/api/src/generated/prisma` no existe y no hay PostgreSQL levantada. La
   suite es de integración: `visits.api.test.ts:310` la envuelve en
   `describe.skipIf(!puedeEjecutarse)`, de modo que **sin base de datos se
   omitiría entera**, y una ejecución omitida no es una verificación. No afirmo
   que pasen; afirmo que existen y qué comprueban.
2. `npx tsc --noEmit` y `eslint` tampoco se ejecutaron, por la misma razón.
3. **No comprobé el comportamiento en tiempo de ejecución de la ruta.** No he
   emitido una sesión humana real ni he llamado al endpoint. Todo lo descrito
   sobre códigos de estado y cabeceras está leído del código y de las
   aserciones de las pruebas, no observado.
4. **No verifiqué la copia de trabajo del auditor** donde, según la bitácora,
   existe el código de MP02. No está en esta máquina y no puedo confirmar ni su
   contenido ni su estado.
5. **No comprobé el rendimiento** de la consulta con ventanas grandes. La
   ausencia de `take` es un hecho leído del código; el efecto sobre una agenda
   real de 31 días no está medido.
6. No revisé si el proveedor OIDC local (Keycloak) está en marcha ni si el
   tenant activo está aplicado en alguna base.
