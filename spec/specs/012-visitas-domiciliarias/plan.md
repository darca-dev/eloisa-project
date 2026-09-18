# Plan 012 - Visitas domiciliarias

## Resumen

> **RETROSPECTIVO.** Este plan no propone trabajo: reconstruye, desde `git log` y
> desde el código, cómo se construyó realmente la capacidad de visitas
> domiciliarias entre el 2026-08-22 y el 2026-08-24. Las fases están redactadas
> en pasado porque ya se ejecutaron. Nada de lo que aquí figura autoriza trabajo
> nuevo.

La capacidad se diseñó completa el 2026-08-22 y se declaró **bloqueada**: sin
principal humano autenticado no había forma honesta de atribuir «yo inicié esta
visita». El diseño nombró su propio prerequisito y esperó. Cuando la spec 011
entregó identidad humana el 2026-08-24, la implementación se ejecutó ese mismo
día en cuatro micropaquetes secuenciales, cada uno con su Task Specification, su
allowlist cerrada y su commit `feat()`: base de datos, materialización,
transiciones profesionales y API protegida.

La estrategia dominante fue **poner el invariante en la base y no repetirlo
arriba**. La máquina de estados, la coherencia de timestamps, la unicidad de la
visita por cita y la exigencia de actor humano viven como restricciones de
PostgreSQL. Los servicios no las reimplementan: las traducen a desenlaces
legibles y dejan que la base sea la barrera final.

## Contexto técnico

- **Lenguaje y marco:** TypeScript, NestJS (`apps/api`), Prisma sobre PostgreSQL.
- **Aislamiento:** `PrismaService.withTenant()` + Row Level Security `ENABLE` y
  `FORCE` con política por tenant, heredado de la spec 007.
- **Rol de ejecución:** `merdn_runtime`, no superusuario y no propietario, con
  grants mínimos y **sin `DELETE`** sobre las tablas de visitas.
- **Dos clases de principal, disjuntas:** `InstitutionalPrincipal` con rol
  `HOSPITAL_SCHEDULER` (cookie `merdn_institutional_session`, spec 010/014) y
  `HumanPrincipal` con `personId` (cookie `merdn_human_session`, spec 011).
- **Auditoría:** `audit_event` de la spec 007, ampliada con cuatro valores de
  enum; se escribe **dentro** de la transacción de dominio, de modo que un fallo
  de auditoría revierte la mutación.
- **Reutilización obligatoria:** `Appointment` como única agenda,
  `CareAssignment` como única fuente del profesional. Ni el modelo ni el servicio
  crean una segunda copia de ninguno de los dos.

## Fases de implementación (ejecutadas)

### Fase 0 — Diseño y bloqueo declarado (2026-08-22)

- `24adc73` — *Add VISITS-CORE-01 design*: `tasks/VISITS-CORE-01.md`, 435 líneas.
  Estado `DESIGN COMPLETE — IMPLEMENTATION BLOCKED`.

Resultado: un diseño completo que **se prohíbe a sí mismo implementar**, nombra
el prerequisito (`IDENTITY-RELATIONSHIPS-CORE-01`) y rechaza por escrito tres
alternativas más rápidas, entre ellas usar `HOSPITAL_SCHEDULER` como visitador.

Entre esta fase y la siguiente se implementó la spec 011 (commit `03255de`,
2026-08-24) y su gate `MP03-B`, cuyo objetivo declarado era precisamente
desbloquear esta capacidad.

### Fase 1 — MP01, fundación de base de datos (2026-08-24)

- `0dbe445` — Task `VISITS-CORE-01-MP01-DB-FOUNDATION.md`.
- `d8500c9` — *feat(visits): add tenant-aware visit database foundation*, 4 archivos.

Entregó `20260824120000_visits_core_01/migration.sql` (397 líneas): enum
`HomeVisitStatus`, tablas `home_visit` y `home_visit_transition`, FK compuestas
tenant-aware sin `CASCADE`, tres `CHECK` de coherencia, el check
`home_visit_transition_machine` con las cuatro transiciones legales, el índice
parcial de transición de creación única, el trigger `merdn_home_visit_guard()`,
grants mínimos y RLS forzada. Más `schema.prisma` (+141), el rollback y
`visits-db-foundation.db.test.ts` (1.361 líneas, 41 casos).

Alcance declarado y respetado: **solo persistencia e integridad**. Ni servicios,
ni endpoints, ni guardas, ni interfaz. Cero filas insertadas: una instalación sin
datos no muestra ninguna visita, que es el comportamiento fail-closed buscado.

### Fase 2 — MP02, materialización transaccional (2026-08-24)

- `11e1aa1` — Task `VISITS-CORE-01-MP02-MATERIALIZATION.md`.
- `7b2bdb1` — *feat(visits): add transactional visit materialization*, 6 archivos.

Entregó `home-visit-materialization.service.ts` (323 líneas), la migración
`visits_core_02` (un solo valor de enum), el método
`recordHomeVisitMaterializedWithin` en `audit.service.ts` y
`visits-materialization.db.test.ts` (788 líneas, 12 casos).

Decisión central: el servicio **no duplica** las reglas del trigger. Solo hay una
comprobación previa —cita sin asignación— y está justificada por escrito. El
resto se traduce desde el SQLSTATE de PostgreSQL, no desde el texto del mensaje.

### Fase 3 — MP03, transiciones profesionales (2026-08-24)

- `40f7a26` — Task `VISITS-CORE-01-MP03-PROFESSIONAL-TRANSITIONS.md`.
- `fef1dae` — *feat(visits): add authorized professional visit transitions*, 6 archivos.

Entregó `home-visit-transition.service.ts` (381 líneas), la migración
`visits_core_03` (tres valores de enum), `recordHomeVisitTransitionWithin` y
`visits-professional-transitions.db.test.ts` (1.340 líneas, 28 casos).

Decisiones centrales:

1. la autorización viaja **dentro** de la condición del `updateMany`, no en una
   comprobación previa que pudiera quedar obsoleta;
2. la versión la incrementa la base, no la aplicación;
3. el orden de los desenlaces es transición-ilegal antes que versión-obsoleta;
4. el servicio **no acepta `professionalId`**: esa ausencia es la garantía de que
   nadie ejecuta la visita de otra persona.

### Fase 4 — MP04, API protegida (2026-08-24)

- `5299cbd` — Task `VISITS-CORE-01-MP04-API.md`.
- `62e3147` — *feat(visits): expose protected visits api*, 8 archivos.

Entregó `visits.controller.ts` (482 líneas en su forma original),
`visits.dto.ts` (380), `professional-visit-query.service.ts` (194),
`visits.module.ts` (58), el registro en `app.module.ts`, la descripción en
`openapi.ts` y `visits.api.test.ts` (1.319 líneas). Tres rutas exactamente:
`POST /api/v1/visits/materialize`, `GET /api/v1/professional/visits/:visitId` y
`PATCH /api/v1/professional/visits/:visitId/status`.

La allowlist de MP04 prohibía explícitamente modificar los servicios de MP02 y
MP03. Se respetó — y es la causa directa de que `endpoint` y `correlationId`
sigan nulos en los eventos de auditoría (ver Riesgos).

### Fase posterior, fuera de esta spec

`15a9ae1` (spec 017) añadió `GET /api/v1/professional/visits` y
`ProfessionalVisitWorklistService` **dentro de los archivos de esta spec**;
`43bd6ad` (spec 016) tocó `schema.prisma` para el acceso de soporte. Por eso
`visits.controller.ts` tiene hoy 594 líneas y `visits.dto.ts` 711, frente a 482 y
380 en `62e3147`.

## Dependencias

Orden real en que tuvieron que existir:

```
001 fundación técnica
     └── 007 persistencia, tenant, RLS, auditoría, withTenant()
            ├── 008 institutional_identity / institutional_session
            │      └── 014 InstitutionalSameOriginGuard
            ├── 009 check audit_event_resource_required en forma negativa
            ├── 010 appointment, care_assignment, professional_profile,
            │       professional_affiliation, HOSPITAL_SCHEDULER,
            │       HospitalSchedulerGuard
            └── 011 human_account, human_session, HumanSessionGuard,
                    SameOriginGuard, HumanPrincipal  ← el desbloqueo
                        └── 012 VISITAS DOMICILIARIAS (esta spec)
                                 ├── 013 cliente e interfaz de Hospital
                                 ├── 016 lectura de soporte sobre HomeVisit
                                 └── 017 worklist profesional
```

Externas: PostgreSQL con las once migraciones aplicadas y el rol
`merdn_runtime` creado; Keycloak/OIDC para que exista una `HumanSession`.

## Hitos

| Hito | Fecha | Commit | Estado hoy |
|---|---|---|---|
| Diseño completo y bloqueo declarado | 2026-08-22 | `24adc73` | Cerrado |
| Prerequisito de identidad humana resuelto | 2026-08-24 | `03255de` (spec 011) | Cerrado |
| Persistencia, integridad y RLS de visitas | 2026-08-24 | `d8500c9` | Cerrado |
| Materialización transaccional con auditoría | 2026-08-24 | `7b2bdb1` | Cerrado |
| Transiciones profesionales autorizadas | 2026-08-24 | `fef1dae` | Cerrado |
| API protegida con doble superficie | 2026-08-24 | `62e3147` | Cerrado |
| Auditoría externa de la capacidad | — | — | **No realizada** |
| Materialización automática al asignar cita | — | — | **No implementada** |
| Superficies de Hospital, Paciente y Cuidador | — | — | **No implementadas** |

## Riesgos (vigentes hoy)

1. **Una cita `HOME` asignada puede quedar sin visita.** El diseño §7.1 exigía
   materializar dentro de la transacción de asignación; se implementó como
   endpoint separado. Nada en la base ni en Hospital garantiza que se llame.
   Riesgo operativo real: visitas que existen en la agenda y no en el registro.
2. **Leer una visita no deja rastro, y una denegación tampoco.** Faltan los tres
   eventos de acceso de §10. Ante una investigación no se puede reconstruir quién
   consultó qué.
3. **`endpoint` y `correlationId` de los cuatro eventos de visitas están en
   `NULL`.** No se puede correlacionar un evento con la petición que lo produjo.
   Es una deuda de coordinación entre allowlists, no un descuido: MP02 y MP03 lo
   dejaron declarado y MP04 no podía tocarlos.
4. **El check `audit_event_resource_required` no obliga a los cuatro eventos
   nuevos a llevar `resourceId`.** Las migraciones 02 y 03 lo declaran como
   riesgo residual conocido. Que siempre lo lleven depende de la aplicación.
5. **Cuatro garantías viven solo en SQL y no en `schema.prisma`:** el índice
   parcial de transición de creación única, los tres `CHECK` y el trigger.
   Regenerar el schema desde la base y tratarlo como fuente de verdad las
   perdería de vista.
6. **La condición de autorización está copiada tres veces** y el gate
   `IdentityAccessService.hasActiveAssignmentOverPatient()` —probado en
   PostgreSQL por la spec 011 con este uso como objetivo declarado— no se usa
   aquí. Un cambio de política de vigencia hay que aplicarlo en tres archivos.
7. **Cero pruebas unitarias en `apps/api/src/visits/`.** Sin PostgreSQL no se
   verifica nada de esta capacidad, ni siquiera la lógica pura de parseo de
   `visits.dto.ts`. Y la suite **se omite en silencio** en vez de fallar cuando
   no hay base (`describe.skipIf`), de modo que un pipeline sin base puede
   reportar verde.
8. **Ninguna revisión externa registrada.** Es la capacidad de dominio más
   extensa del repositorio y `reviews/` no contiene ningún informe sobre ella.
9. **El contrato web↔API se mantiene por duplicación manual.** `packages/shared`
   no expone ningún tipo de visitas: un cambio de DTO no rompe el cliente web en
   compilación.
10. **El rollback de las migraciones 02 y 03 es incompleto por diseño de
    PostgreSQL:** no existe `ALTER TYPE ... DROP VALUE`. Los archivos lo
    documentan en vez de simular una reversión limpia — la honestidad es
    correcta, la limitación sigue siendo real.
