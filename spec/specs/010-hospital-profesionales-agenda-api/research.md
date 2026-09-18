# Investigación 010 - Hospital · Profesionales y Agenda (API y vistas conectadas)

Medido sobre `develop` el 2026-08-25. Cada hallazgo cita el comando o la ruta
que lo respalda.

## R1. Cinco paquetes de corrección sobre una sola Task

`ls tasks/ | grep HOSPITAL-CORE-02` devuelve seis archivos: la Task original y
cinco correcciones. Leídos, cada uno responde a un fallo distinto y **ninguno
reabre el diseño**; todos estrechan la allowlist:

| Paquete | Qué corrigió |
|---|---|
| `-CORRECTION` | Cinco desbloqueos: el gate `hospitalAlcance.test.ts` seguía afirmando «dos clientes»; había que autorizar la *mención* (no la invocación) de `fetch` en dos vistas; una excepción mínima de reloj para Agenda; añadir `PATCH` a CORS; confirmar el patrón CSRF ya implementado |
| `-FINAL-CORRECTION` | Allowlist definitiva de 18 archivos que «sustituye cualquier allowlist parcial o ambigua de los paquetes anteriores» (§1). Es la admisión de que las allowlists previas eran ambiguas |
| `-CONTINUATION` | La ejecución se **interrumpió a mitad**: `hospitalProfessionalsConfig.ts` ya había adoptado los contratos nuevos y cinco consumidores seguían importando los antiguos. Estado registrado: clientes 36 PASS, gate 4 FAIL, typecheck Web FAIL con 43 errores (§6) |
| `-FINAL-FAIL-CLOSED` | Defecto de seguridad real: existía `HOSPITAL_SCHEDULER_IDENTITY_CODE`, un código por defecto en fuente. «Solo SECRET» aprovisionaba la identidad. §3.3 lo dice sin rodeos: «esa expectativa es el defecto y debe invertirse» |
| `-MINIMAL-CLOSE` | Cierre: la capacidad ya funcionaba (135 PASS focales, 64 de regresión) y solo quedaban «5 aserciones de `hospitalAlcance.test.ts` que todavía describen CORE-01» (§2) |

**Orden cronológico real**, medido con
`git log --format="%h %ad %s" --date=format:'%Y-%m-%d %H:%M' | grep CORE-02`:

```
861e643 2026-08-22 15:35  Add Hospital CORE-02 task
1386c7f 2026-08-22 17:22  Add Hospital CORE-02 final correction task
c879c52 2026-08-22 18:29  Add Hospital CORE-02 continuation task
9947c8e 2026-08-22 19:38  Add Hospital CORE-02 minimal close task
c2ba692 2026-08-22 19:50  Add Hospital CORE-02 fail-closed correction task
3d63154 2026-08-22 20:29  Implement Hospital CORE-02
```

Dos hechos que solo se ven con las marcas de tiempo:

- **Todo ocurrió en cuatro horas y cincuenta y cuatro minutos de un mismo día.**
  Los cinco paquetes no son iteraciones separadas por revisiones: son
  correcciones dentro de una sola sesión de trabajo.
- **`-FINAL-FAIL-CLOSED` llega DOCE MINUTOS DESPUÉS de `-MINIMAL-CLOSE`.** El
  paquete que declaraba la capacidad «FUNCTIONALLY IMPLEMENTED — ONE OBSOLETE
  SCOPE GATE REMAINS» precede al que corrige un defecto de seguridad real. El
  cierre se declaró antes de encontrar el fallo.
- `-CORRECTION` es el único de los cinco **sin commit de tarea propio**:
  `git show --stat 3d63154` lo lista entre los 49 archivos del commit de
  implementación.

**Lectura de conjunto:** tres de los cinco paquetes (`-CORRECTION`,
`-FINAL-CORRECTION`, `-MINIMAL-CLOSE`) giran alrededor del mismo artefacto, el
gate estático de alcance `hospitalAlcance.test.ts`. Ese gate impone **igualdad
exacta** de conjuntos —clientes de red, puntos de inyección de `fetch`, usos del
reloj—, de modo que cualquier conexión nueva lo rompe por diseño. La forma
actual del código es consecuencia directa de eso: los clientes son la única
frontera con la red, las vistas reciben `fetchImpl` sin llamarlo, y existe un
único `new Date()` en todo el módulo.

## R2. El defecto fail-closed era un código de identidad por defecto en fuente

`TASK-HOSPITAL-CORE-02-FINAL-FAIL-CLOSED.md` §3.1 ordena eliminar
`HOSPITAL_SCHEDULER_IDENTITY_CODE` «y su comentario de "código por defecto"».

Verificado hoy:

```
grep -rn "HOSPITAL_SCHEDULER_IDENTITY_CODE" .   # sin resultados fuera de tasks/
```

`apps/api/src/institutional-auth/institutional-auth.config.ts:98` declara
`readonly defaultCode?: string`; `MUNICIPAL_VIEWER` (línea 107) y
`HOSPITAL_PATIENT_VIEWER` (línea 114) lo conservan por compatibilidad
histórica, y `HOSPITAL_SCHEDULER` (líneas 121-127) **no lo tiene**.
`parseIdentityCode` (línea 186) devuelve `definicion.defaultCode ?? null`, y el
`null` cierra la identidad en el bloque de la línea 234, que registra un motivo
que nombra la variable pero nunca el valor recibido.

`grep -c "it(" apps/api/src/institutional-auth/institutional-auth.unit.test.ts`
→ **36** casos, entre ellos la matriz CODE/SECRET que el paquete exigía.

Consecuencia estructural: `HOSPITAL_SCHEDULER` es el **único** rol institucional
del repositorio sin código por defecto. Los dos anteriores lo conservan porque
cambiarlos habría roto despliegues existentes.

## R3. La implementación es un único commit; las cinco correcciones no se ven en `git log`

`spec/specs/010-hospital-profesionales-agenda-api/history.md` lista seis commits:
cinco añaden documentos de tarea y uno, `3d63154` «Implement Hospital CORE-02»,
toca **49 archivos** con 13 531 inserciones.

```
git show --stat 3d63154 | tail -3
```

Ese commit incluye `tasks/TASK-HOSPITAL-CORE-02-CORRECTION.md` entre los
archivos modificados: el ciclo completo de trabajo y corrección quedó
**aplastado en un solo commit**. Quien lea solo el historial de Git no puede
reconstruir que hubo cinco iteraciones ni qué falló en cada una. Las Task
Specifications de `tasks/` son la única fuente de esa historia.

## R4. Cuatro tablas, siete enums y seis eventos de auditoría, todo aditivo

```
grep -nE 'CREATE TABLE|CREATE TYPE|ALTER TYPE' prisma/migrations/20260822160000_hospital_core_02/migration.sql
```

- `ALTER TYPE "InstitutionalRole" ADD VALUE IF NOT EXISTS 'HOSPITAL_SCHEDULER'` (línea 36).
- Seis `ALTER TYPE "AuditEventType" ADD VALUE` (líneas 42-47).
- Siete `CREATE TYPE`: `ProfessionalStatus`, `ProfessionalEngagementType`,
  `ProfessionalAffiliationStatus`, `CareAssignmentRole`, `CareAssignmentStatus`,
  `AppointmentModality`, `AppointmentStatus` (líneas 66-88).
- Cuatro `CREATE TABLE`: `professional_profile` (96), `professional_affiliation`
  (143), `care_assignment` (195), `appointment` (265).

La migración **no inserta ni una fila**. Toda relación con datos existentes usa
clave foránea **compuesta** `(id, tenantId)`, de modo que una asociación entre
tenants es imposible aunque se conozca el identificador
(`migration.sql:127-132`, `234-252`, `296-311`).

## R5. Privilegio mínimo: no hay ninguna vía de alta de profesionales ni de citas

`migration.sql:345-348`:

```
GRANT SELECT          ON TABLE "professional_profile"     TO "merdn_runtime";
GRANT SELECT          ON TABLE "professional_affiliation" TO "merdn_runtime";
GRANT SELECT, INSERT  ON TABLE "care_assignment"          TO "merdn_runtime";
GRANT SELECT, UPDATE  ON TABLE "appointment"              TO "merdn_runtime";
```

Ningún `DELETE`; ningún `INSERT` sobre `appointment`; ningún `UPDATE` sobre
`care_assignment`. La migración lo justifica en su comentario: el alta de
profesionales se difiere y «NO se habilita aquí una puerta administrativa
oculta».

Comprobado que esa puerta sigue sin existir:

```
grep -rn "professionalProfile.create\|appointment.create\|professionalAffiliation.create" apps/api/src apps/api/test
```

Todas las apariciones están en `apps/api/test/**`. `tools/identity-provisioning`
no menciona ninguna de las tres tablas. `apps/api/src/identity-access/identity-access.service.ts:86`
solo **lee** `professionalProfile` (spec 011).

**Consecuencia medida:** un despliegue real nunca tendrá una solicitud
`REQUESTED`, de modo que la única mutación autorizada no puede ejercerse. La
capacidad se puede demostrar hoy únicamente con fixtures creados por el rol
propietario en pruebas.

## R6. RLS: lecturas verificadas, escrituras `UNVERIFIED`

`prisma/migrations/20260822160000_hospital_core_02/migration.sql:350-375`
habilita RLS en las cuatro tablas y crea una política por tabla con `USING` y
`WITH CHECK` contra `merdn_current_tenant()`.

`apps/api/test/hospital-core-02.db.test.ts:57`:

```ts
const escrituraBajoRuntimeVerificable = availability.engine === 'postgresql-server';
```

El comentario de las líneas 40-56 explica el motivo: la compilación WebAssembly
del motor de desarrollo «aborta su proceso ante cualquier escritura ejecutada
bajo `SET LOCAL ROLE merdn_runtime`, incluso una que no toque ninguna fila». Las
lecturas bajo RLS y los privilegios leídos del catálogo **sí** se comprueban.

Quedan sin verificar, por decisión explícita y no por olvido: aplicación
efectiva de `WITH CHECK`, denegación en ejecución de `DELETE`/`INSERT`/`UPDATE`,
escrituras entre tenants y reutilización del pool.
`TASK-HOSPITAL-CORE-02-CORRECTION.md` §3 fijó eso como gate obligatorio antes de
preproducción, datos reales o despliegue, y `-FINAL-CORRECTION` §7 lo repitió.

## R7. Un invariante de auditoría quedó deliberadamente sin endurecer

`migration.sql:48-60` documenta la limitación con precisión: el check
`audit_event_resource_required` no se amplía con `CARE_ASSIGNMENT_CREATED` ni
`APPOINTMENT_ASSIGNED` «porque PostgreSQL prohibe usar en la misma transaccion
un valor de enum anadido en esa misma transaccion. Endurecer el check exige una
migracion posterior separada; se reporta como riesgo residual conocido».

Esa migración posterior no existe: `ls prisma/migrations/` muestra que las
migraciones siguientes (`identity_relationships`, `visits_core_01/02/03`,
`eloisa_admin_access`) no vuelven sobre el check. La aplicación sí escribe
siempre el recurso (`hospital-appointment-assignment.service.ts:232-256`), pero
la base no lo obliga.

## R8. El guard es fail-closed en lo que importa y best-effort en la denegación

`apps/api/src/institutional-auth/hospital-scheduler.guard.ts`:

- las cabeceras `no-store` se fijan **antes** de decidir nada, de modo que las
  llevan también el `401` y el `403` (línea 90);
- `RuntimeContextUnavailableError` → `503`, nunca «conceder por si acaso»
  (líneas 99-113);
- `principal.role !== 'HOSPITAL_SCHEDULER'` → `403` (línea 127);
- la auditoría de la **denegación** es best-effort a propósito: hacerla
  fail-closed «convertiría un fallo de escritura en una vía de denegación de
  servicio y permitiría distinguir "denegado y auditado" de "denegado sin
  auditar", que es un oráculo» (comentario de cabecera).

`grep -c "it(" .../hospital-scheduler.guard.test.ts` → **7** casos, incluidos
«un fallo al auditar la denegación NO la convierte en permiso» y «propaga un
error inesperado en lugar de conceder acceso».

Los roles son **disjuntos por construcción**: el guard no compone ni extiende
`HospitalPatientViewerGuard`, y el comentario explica por qué —compartir una
jerarquía abriría la puerta a que relajar uno relajase el otro—.

## R9. Concurrencia resuelta en la base, no en la aplicación

`hospital-appointment-assignment.service.ts:196-219`: la versión esperada viaja
en el `WHERE` de un `updateMany`, junto con `status: 'REQUESTED'` y
`careAssignmentId: null`. Dos peticiones simultáneas compiten en PostgreSQL;
`count === 0` produce `409 APPOINTMENT_VERSION_CONFLICT` sin haber escrito.

La colisión de instante (líneas 166-186) busca otra cita **no cancelada** del
mismo profesional con idéntico `scheduledStart` y responde `409` con un mensaje
que no nombra la cita en conflicto: revelarla «permitiría reconstruir la agenda
ajena probando instantes».

El `404` de profesional es **uniforme** para cuatro causas distintas —no existe,
otro tenant, perfil inactivo, sin afiliación activa— por el mismo motivo
(líneas 148-164).

## R10. CSRF sin mecanismo nuevo

`hospital-appointment-assignment.origin.ts` reutiliza `API_WEB_ORIGINS`, la
misma allowlist que ya usa CORS. Comparación por origen completo
—`new URL(valor).origin`—, `Origin` preferido y `Referer` solo como respaldo,
`Origin: null` rechazado, ausencia de ambos rechazada. No hay token nuevo, ni
cabecera propietaria, ni segunda variable de entorno.

`apps/api/src/main.ts:44` → `methods: ['GET', 'POST', 'PATCH', 'OPTIONS']`. Ni
`PUT` ni `DELETE`.

`hospital-appointment-assignment.controller.ts:160` aplica la comprobación
**dentro** del controlador, después del guard de rol.

## R11. Las dos vistas quedaron sin fixtures y sin red propia

```
grep -rn "hospitalProfesionalesDemo\|hospitalAgendaDemo\|HOSPITAL_CITAS_AGOSTO" apps/web/src
```

→ sin resultados. Los fixtures factuales desaparecieron del árbol; los archivos
de configuración conservan solo copy, catálogos controlados y estructura.

`hospitalAlcance.test.ts` sigue siendo un gate de **igualdad exacta**, pero su
contenido creció con las specs posteriores: hoy declara **seis** clientes
(líneas 57-64) y **cinco** puntos de inyección (líneas 125-131), no los cuatro y
cuatro con que `-MINIMAL-CLOSE` cerró la capacidad. Los añadidos son
`hospitalVisitsClient.ts`, `hospitalHumanSessionClient.ts` y
`HospitalHomeVisits.tsx`.

Las tres reglas de reloj siguen vigentes y separadas (líneas 137-158):
`Date.now` prohibido en todo el módulo; `new Date()` sin argumentos exactamente
una vez y solo en `HospitalAgenda.tsx`; `new Date(valor)` únicamente en
`hospitalAgendaClient.ts`.

## R12. Todo el cálculo de ventanas es UTC; el formulario es hora local

`hospital.contract.ts:776-788` construye los límites con
`new Date(\`${date}T00:00:00.000Z\`)` y una cota superior **exclusiva**.
`hospitalAgendaClient.ts:113-115` deriva la fecha inicial con
`instante.toISOString().slice(0, 10)`.

En cambio `hospitalAgendaClient.ts:168-183` construye el instante de la
asignación con `new Date(anio, mes-1, dia, horas, minutos)` —zona del
dispositivo— y lo serializa con `toISOString()`.

```
grep -rn "Bogota\|America/" apps/api/src/hospital apps/web/src/features/hospital
```

→ sin resultados. No existe ninguna conversión de zona en toda la superficie.

**Consecuencia medible:** en Colombia (UTC-05), una cita asignada a las 19:00 se
serializa al día UTC siguiente y no aparece en la ventana del día seleccionado.
Ninguna Task Specification aborda esto.

## R13. Capacidades de API sin superficie de interfaz

- `hospitalProfessionalsClient.ts:61-63` tipa `activePatientCount`,
  `todayAppointmentCount` y `nextAppointmentAt`. `grep -rn` sobre `*.tsx` no
  encuentra ninguna referencia: la spec 015 (`HOSPITAL-VISUAL-RECOVERY-01-B`)
  retiró la tira de métricas de la tarjeta y del panel por considerarlas
  afirmaciones sobre el desempeño de una persona. El servidor las sigue
  calculando en cada listado.
- `HospitalProfessionals.tsx:380-386` invoca `serializarProfesionales(...,
  'name', 'asc')` con el tamaño inicial fijo. La API admite
  `sort=name|profession`, `direction=asc|desc` y `pageSize` 25 o 50; la interfaz
  no ofrece ningún control para ninguno.

## R14. El rol se amplió a otra superficie después de cerrarse la capacidad

`TASK-HOSPITAL-CORE-02` §3.1: «`HOSPITAL_SCHEDULER` accede únicamente a los
endpoints nuevos de este slice».

```
grep -rn "HospitalSchedulerGuard" apps/api/src | grep -v hospital-scheduler.guard
```

→ además de los tres controladores de Hospital, `apps/api/src/visits/visits.controller.ts:140`
protege con él `POST /api/v1/visits/materialize`
(`visits.controller.ts:121,149`). La spec 012 amplió el alcance del rol; el
límite original ya no describe el sistema.

## R15. El aprovisionamiento del rol no está documentado para quien despliega

```
grep -rn "MERDN_HOSPITAL_SCHEDULER_CODE\|MERDN_HOSPITAL_SCHEDULER_SECRET" . | grep -v node_modules | grep -v '^./.git'
```

Las dos variables aparecen en `apps/api/src/institutional-auth/**`, en seis
archivos de `apps/api/test/**` y en dos Task Specifications. **No aparecen en
`.env.example` ni en `compose.yml`**, mientras que `.env.example:149-159` sí
documenta las dos variables equivalentes del rol de relaciones
paciente-cuidador. Sin ambas variables los cuatro endpoints existen y responden
`401` para siempre, sin ningún mensaje que oriente al operador.

## R16. El catálogo de profesiones está duplicado a mano

`apps/api/src/hospital/hospital.contract.ts:384-395` y
`apps/web/src/features/hospital/hospitalProfessionalsConfig.ts:80-92` declaran
los mismos siete códigos (`MEDICINA_GENERAL` … `TRABAJO_SOCIAL`) sin compartir
origen en `packages/shared`. La restricción de forma vive además en SQL
(`migration.sql:136-139`, `CHECK ("professionCode" ~ '^[A-Z][A-Z0-9_]{2,63}$')`).
Una divergencia entre las dos listas solo se manifestaría como un `400`.

## R17. No existe auditoría de Codex para esta capacidad

```
ls reviews/
```

22 entradas: 20 auditorías más `REVIEW-TEMPLATE.md` y `README.md`. Ninguna es
`REVIEW-HOSPITAL-CORE-02` ni `REVIEW-HOSPITAL-CORE-01`.
La última del módulo Hospital es `REVIEW-003H-07-FINAL.md`, anterior a toda
persistencia hospitalaria. `reviews/README.md` declara el directorio cerrado el
2026-08-25, de modo que esa auditoría ya no se escribirá.

Es un hallazgo, no una nota administrativa: la capacidad con la única mutación
del módulo Hospital, con RLS de escritura sin verificar y con un defecto
fail-closed real corregido a mitad de camino, **nunca fue auditada por un
tercero**.

## R18. Cobertura de pruebas presente

| Archivo | Casos |
|---|---|
| `apps/api/test/hospital-professionals.api.test.ts` | 26 |
| `apps/api/test/hospital-agenda.api.test.ts` | 20 |
| `apps/api/test/hospital-core-02.db.test.ts` | 18 |
| `apps/api/src/hospital/hospital-professionals.query.test.ts` | 15 |
| `apps/api/src/hospital/hospital-appointment-assignment.request.test.ts` | 13 |
| `apps/api/src/institutional-auth/hospital-scheduler.guard.test.ts` | 7 |
| `apps/api/src/institutional-auth/institutional-auth.unit.test.ts` | 36 |
| `apps/web/src/features/hospital/hospitalProfessionals.test.tsx` | 57 |
| `apps/web/src/features/hospital/hospitalAgenda.test.tsx` | 67 |
| `apps/web/src/features/hospital/hospitalAgendaClient.test.ts` | 16 |
| `apps/web/src/features/hospital/hospitalProfessionalsClient.test.ts` | 12 |

Contados con `grep -cE "^\s*(it|test)\("`. **No existe** un
`hospital-agenda.query.test.ts`: `hospital-agenda.query.ts` reutiliza
`assertAllowlist` y `parseWindow` de `hospital-professionals.query.ts`, que sí
está cubierto. Es reutilización deliberada, documentada en el propio archivo,
no una laguna silenciosa.

## R19. Verificación no ejecutada

No se ejecutó **ninguna** prueba. Motivos verificados:

- `ls node_modules` y `ls apps/api/node_modules` → «No such file or directory».
  Sin dependencias instaladas no hay Vitest, ni cliente Prisma generado, ni
  `tsc`.
- `docker` no está disponible en el PATH de este entorno, de modo que tampoco se
  pudo levantar el stack de `compose.yml`.
- El puerto 5432 de `localhost` **sí** acepta conexiones, pero **no se
  comprobó** que corresponda a la base de MERDN, ni que tenga las migraciones
  aplicadas, ni que exponga el rol `merdn_runtime` con
  `MERDN_RUNTIME_ROLE=enforce`. No se ejecutó ninguna consulta contra él.

Por tanto, **ninguna** de estas afirmaciones se hace en esta spec:

- que las suites listadas en R18 pasen;
- que el typecheck de `apps/api` o `apps/web` pase;
- que la migración aplique limpiamente sobre una base con CORE-01 y
  HOSPITAL-CORE-01;
- que el rollback documental `ROLLBACK-hospital_core_02.sql` funcione —está
  marcado como documental y nunca se ejecuta—;
- que las políticas RLS denieguen en ejecución una escritura entre tenants.

Los conteos de R18 son de **casos declarados en el código fuente**, no de casos
ejecutados con éxito.

Tampoco se verificó el comportamiento del sistema en un navegador: las
afirmaciones sobre foco, región viva y navegación por teclado proceden de leer
el marcado y las pruebas de las vistas, no de una ejecución.
