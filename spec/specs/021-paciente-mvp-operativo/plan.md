# Plan 021 - Paciente MVP operativo

## Resumen

Una experiencia de Paciente autenticada, de **solo lectura**, montada sobre la
sesión humana que ya existe y sobre `resolvePatient`, que ya resuelve el sujeto
en el servidor. Tres proyecciones minimizadas —resumen, citas, visitas—, seis
estados de interfaz y un cierre de sesión revocable.

**Este plan no autoriza nada.** La spec sigue en `Pendiente` y sin
consentimiento.

**Actualización del 2026-08-26.** **No queda ninguna decisión de producto
abierta** ni **ningún asunto de arquitectura abierto.** Se cerraron las nueve de
`spec.md` §17.B, las dos concreciones de §17.C y, el mismo día, Codex resolvió
los asuntos que el Product Owner le había delegado (§17.D):

| Punto | Qué es | Resolución de Codex |
|---|---|---|
| §17.D-1 | Forma técnica de la auditoría | **dos** valores de enum —`PATIENT_SELF_ACCESS_GRANTED`, `PATIENT_SELF_ACCESS_DENIED`—; diferenciación por `resourceType` y `endpoint`; registro en el `AuditService` **existente** |
| §17.D-2 | Superficie HTTP de la lectura self-scope | tres endpoints exactos: `GET /api/v1/patient-self/summary`, `/appointments`, `/visits` |
| §17.D-3 | Ubicación del cliente de sesión humana | **`MOVE TO SHARED`** — `features/auth/humanSessionClient.ts`, con **fachada compatible** en `features/hospital/hospitalHumanSessionClient.ts` |

Ya está decidido **con qué sesión entra el Paciente** —OIDC humana—, **cómo
obtiene cuenta** —aprovisionamiento administrativo, sin autorregistro—, **por
dónde entra** —`/`, sin migración de return targets—, **qué ve al terminar la
inscripción** —confirmación más entrada separada «Ingresar como Paciente»—,
**qué contiene el resumen** —exactamente tres campos—, **qué rutas expone**,
**cómo se audita** y **dónde vive el cliente de sesión**.

**Lo único que falta ahora son los dos actos del Product Owner:** aprobar la spec
y registrar el consentimiento. Hasta entonces la compuerta **no abre**.

## Contexto técnico

| Dato | Valor | Cómo se obtuvo |
|---|---|---|
| Rama de trabajo | `feat/paciente-mvp-20260826` | creada desde `develop` en esta sesión |
| Base | `ad25520` — «docs(spec): approve visitador mp02 corrections» | `git log --oneline -1` sobre `develop` |
| `develop` vs `origin/develop` | idénticas | `git rev-list --left-right --count origin/develop...develop` → `0 0` |
| Visitador | intacto en `feat/visitador-mp02-corrections`, `048ba94`, sincronizada, `BLOCKED_BROWSER_ACCESS` | `git status`, `git rev-list`, `spec/specs/019-*/history.md` |
| Sesión humana | OIDC + PKCE, cookie `merdn_human_session`, TTL 8 h, inactividad 30 min | `apps/api/src/human-auth/human-auth.contract.ts` |
| Contexto `PATIENT` | ya derivado en el servidor | `apps/api/src/identity-access/human-contexts.service.ts` |
| Sujeto del dato | `resolvePatient`, filtra por tenant además de RLS y exige `ACTIVE` | `apps/api/src/identity-access/identity-access.service.ts:51-61` |
| RLS | activa en `appointment`; activa y **forzada** en `home_visit` | migraciones `20260822160000_hospital_core_02` y `20260824120000_visits_core_01` |
| API self-scope de Paciente | **no existe** | inventario de `apps/api/src/` |
| Ruta `/paciente` | **no existe** | `apps/web/src/app/` |
| Línea base de pruebas | **no medida** | se mide ejecutando antes de tocar código; no se cuenta por lectura |

### Nota sobre la numeración

Los identificadores **019** y **020** están ocupados en
`feat/visitador-mp02-corrections` y no existen en `develop`. Esta spec toma
**021** para que las tres puedan convivir cuando Visitador se integre.
`new-spec.sh` habría asignado 019 sobre esta rama, así que el directorio se creó
a mano con la misma estructura que produce el script.

## Ejecución — cinco micro-paquetes

**Fase 0 — Cerrada el 2026-08-26.** Las once decisiones de producto —las nueve
de §17.B y las dos de §17.C— están resueltas por el Product Owner, y los tres
asuntos de arquitectura de §17.D están resueltos por Codex. **Ninguna fase queda
bloqueada por una decisión pendiente.**

Codex fijó el 2026-08-26 la descomposición de ejecución: **cinco micro-paquetes**,
en este orden, **quince minutos como máximo cada uno**, cada uno con sus propias
STOP CONDITIONS. Un paquete no empieza hasta que el anterior tiene sus pruebas
**ejecutadas**, y un paquete que se desborda se **detiene y se reporta**, no se
alarga en silencio (`spec.md` §19.18).

Antes del paquete 1, y fuera de su reloj: la **compuerta** (T1.1–T1.4), la
**línea base de pruebas medida ejecutando** y el **contrato**
`contracts/paciente-self-scope.contract.md`, que se escribe **antes** que
cualquier implementación.

### PACKET 1 — Auditoría mínima

**Qué:** los dos valores del `enum AuditEventType`, la migración aditiva, su
rollback condicional, los métodos de registro en el `AuditService` existente y
sus pruebas.

| | |
|---|---|
| **Archivos** | `prisma/schema.prisma`; `prisma/migrations/<timestamp>_patient_self_audit_event_type/migration.sql`; `prisma/migrations/ROLLBACK-patient_self_audit_event_type.sql`; `apps/api/src/audit/audit.service.ts`; `apps/api/src/audit/audit.service.test.ts` |
| **Termina cuando** | migración hacia adelante aplicada; rollback sin eventos verificado; rollback **rechazado** con eventos dependientes verificado; evento concedido y denegado registrados; actor `HUMAN_ACCOUNT` opaco; ausencia de PII comprobada campo a campo; fail-closed; inmutabilidad |

**STOP del paquete 1.** Cualquier cambio **no aditivo** del enum; cualquier otra
tabla, columna, índice, restricción o política RLS; un rollback que **borre o
reasigne** eventos dependientes en vez de rechazarse; un actor **de relleno**
para una petición sin principal humano resoluble; un valor de enum por endpoint
en lugar de la diferenciación por `resourceType` y `endpoint`; tocar
`identity-audit.service.ts` o `audit.module.ts`.

### PACKET 2 — API patient-self

**Qué:** los tres endpoints de `spec.md` §6.6-e —`summary`, `appointments`,
`visits`—, con el guard de sesión humana existente, `resolvePatient` y la regla
dura de minimización.

| | |
|---|---|
| **Archivos** | `apps/api/src/patient-self/**` (nuevo); `apps/api/src/app.module.ts` **solo** para registrar el módulo; `apps/api/test/patient-self.api.test.ts` |
| **Termina cuando** | los tres devuelven `200` con contexto `PATIENT`; `401` **indistinguible** ante ausencia, caducidad absoluta, caducidad por inactividad, revocación y cuenta deshabilitada; denegación sin contexto `PATIENT` que no revela si existe paciente asociado; `503` fail-closed; selector de sujeto **ignorado**; campos cerrados por **igualdad de conjunto**; sin `patientId`, `personId` ni `humanAccountId` en la respuesta |

**STOP del paquete 2.** Un cuarto endpoint, una ruta parametrizada o un método de
escritura; un selector de sujeto en cualquier firma, DTO o ruta; tocar
`human-auth/**`, `patients/**`, `identity-access/**`, `hospital/**` o
`visits/**`; tocar `app.module.ts` para algo que no sea el registro del módulo.

### PACKET 3 — DB / RLS / multitenant / IDOR

**Qué:** demostrar el aislamiento **ejecutando**, no leyendo.

| | |
|---|---|
| **Archivos** | `apps/api/test/patient-self.db.test.ts` |
| **Termina cuando** | RLS verificada con el rol de mínimo privilegio en `appointment` y `home_visit`; **doble control** demostrado —filtro explícito por tenant **además** de RLS—; dos tenants sin fuga por listado, detalle, orden, paginación ni mensaje de error; dos pacientes del **mismo** tenant sin fuga; paciente no `ACTIVE` sin contexto y sin filas; IDOR: respuesta con y sin selector ajeno **idéntica**; todos los datos ficticios |

**STOP del paquete 3.** Que una prueba de aislamiento **no se pueda ejecutar**
—sin ella la tarea **no** se declara terminada (`spec.md` §19.7)—; cualquier
necesidad de dato real de paciente; modificar una prueba existente de
`apps/api/test/` para que pase.

### PACKET 4 — Cliente humano compartido + fachada Hospital + pacienteSelfClient

**Qué:** la extracción `MOVE TO SHARED` de §17.D-3, la fachada compatible de
Hospital con su regresión, y el cliente HTTP del Paciente.

| | |
|---|---|
| **Archivos** | `apps/web/src/features/auth/humanSessionClient.ts` y `.test.ts` (nuevos); `apps/web/src/features/hospital/hospitalHumanSessionClient.ts` y `.test.ts` (fachada + regresión); `apps/web/src/features/paciente/pacienteSelfClient.ts` y `.test.ts` |
| **Termina cuando** | login en `/`; contextos `PATIENT` y `PROFESSIONAL` interpretados sin sumarse; `401`, contexto ausente, `503`, cuerpo inválido y cancelación traducidos; logout `204`, `401`, `403`, `429`, fallo y cancelación cubiertos; **regresión de Hospital en verde sin editar su suite**; `npm run typecheck` en verde |

**STOP del paquete 4.** Tocar cualquier archivo de `features/hospital/` distinto
de la fachada y su prueba; que la fachada **no** pueda conservar la superficie
que Hospital ya importa —entonces deja de ser «mínimo cambio» y vuelve a Codex—;
que la regresión de Hospital **no se pueda ejecutar**; duplicar la lógica de
sesión en vez de reutilizarla; ampliar `HUMAN_AUTH_RETURN_TARGETS`.

### PACKET 5 — Experiencia Paciente

**Qué:** la separación post-inscripción, los seis estados, el logout y el
ocultamiento de la superficie demostrativa.

| | |
|---|---|
| **Archivos** | `apps/web/src/features/paciente/PacienteExperience.tsx`, `InicioPaciente.tsx`, `paciente.module.css`, `paciente.test.tsx`, `pacienteExperience.dom.test.tsx` (nuevo); `apps/web/src/features/experiencia/ExperienciaMerdn.tsx` **solo** para la conmutación de fase |
| **Termina cuando** | `/` muestra «Inscripción completada» sin abrir la experiencia autenticada; existe la entrada separada «Ingresar como Paciente»; con **solo** la cookie de inscripción no hay resumen, citas ni visitas; el resumen tiene **exactamente tres campos** por igualdad de conjunto; los seis estados son observables y distinguibles; `retry` vuelve a salir al servidor; cierre confirmado y **no** confirmado cubiertos; sin persistencia en cliente; región viva `polite`, foco y no-solo-color; controles fuera del MVP **ocultos** con su código intacto |

**STOP del paquete 5.** **Borrar** el código de una capacidad oculta en vez de
dejar de montarla (`spec.md` §19.11); añadir un **cuarto campo** al resumen
(§19.12); que la cookie de inscripción abra el portal (§19.13); crear
`apps/web/src/app/paciente/`; tocar `bitacoraFlow.ts`, `bitacoraFlow.test.ts` o
`BitacoraPaciente.tsx`.

### Cierre — fuera del reloj de los paquetes

- **Verificación en navegador**, solo si existe navegador controlable. Si no lo
  hay, se declara `BLOCKED_BROWSER_ACCESS` y **no** se declara aprobada.
- **Comprobación de los dieciséis elementos** de `spec.md` §20, uno a uno, con su
  prueba ejecutada.
- **Handoff a Codex** conforme a `CLAUDE.md` §11, en `spec/bitacora/handoffs/`.

## Verificación

Los comandos exactos se fijan al aprobar la spec. La forma prevista:

```
npm run typecheck
npx vitest run --root apps/api src/patient-self src/audit
npx vitest run --root apps/api test/patient-self.api.test.ts test/patient-self.db.test.ts
npx vitest run --root apps/web src/features/paciente src/features/auth
npx vitest run --root apps/web src/features/hospital/hospitalHumanSessionClient.test.ts
npx eslint apps/api/src/patient-self apps/api/src/audit apps/web/src/features/paciente apps/web/src/features/auth
git diff --name-only          # debe caer entero dentro de la allowlist de spec.md §12
```

La quinta línea es la **regresión de Hospital** del paquete 4: se ejecuta **sin
editar** esa suite, y su resultado es condición para cerrar ese paquete.

Reglas de lectura del resultado:

- la **línea base** se mide ejecutando, antes de tocar código, y se anota aquí;
- una suite que no arranca **no** es una suite en verde, aunque el total parezca
  razonable —es exactamente el modo de fallo que ya ocurrió con el pool `forks`
  en el paquete de Visitador—;
- las pruebas de RLS y de aislamiento exigen base de datos: si no se pueden
  ejecutar, se reportan como **no ejecutadas**, con causa, y la tarea **no** se
  declara terminada (`CLAUDE.md` §10).

## Dependencias

- Spec **007** — inscripción y `GET /patients/me`. No se toca.
- Spec **011** — identidad, sesión humana, contextos, `resolvePatient`. No se toca.
- Spec **010** — `Appointment`. No se toca.
- Spec **012** — `HomeVisit` y su RLS forzada. No se toca.
- Spec **014** — patrón de sesión humana en la shell, ya probado en Hospital.
- Paquetes: **ninguno nuevo**. Si alguno resultara imprescindible: STOP y
  justificar antes (§17.B-9).
- Migraciones: **una sola**, la **aditiva y mínima** de auditoría (§17.B-4,
  §17.D-1): dos valores del enum, con su rollback **condicional** de §9.4.
  Ninguna de `HUMAN_AUTH_RETURN_TARGETS`: se conserva `/` para evitarla.

## Hitos

- **H0** — **Cumplido el 2026-08-26:** las once decisiones de producto resueltas
  por el Product Owner (§17.B, §17.C) y los tres asuntos de arquitectura
  resueltos por Codex (§17.D).
- **H1** — Contrato de la API self-scope escrito y auditado como documento.
- **H2** — **Paquete 1:** auditoría registrada sin valores sensibles, con
  migración aditiva y rollback condicional probado en sus dos desenlaces.
- **H3** — **Paquete 2:** los tres endpoints implementados, con `401` uniforme,
  `503` fail-closed y cero selectores de sujeto.
- **H4** — **Paquete 3:** aislamiento demostrado —tenant, RLS, multitenant e
  IDOR— con datos ficticios y pruebas **ejecutadas**.
- **H5** — **Paquete 4:** cliente de sesión compartido, fachada de Hospital con
  regresión en verde, y `pacienteSelfClient` con sus desenlaces.
- **H6** — **Paquete 5:** separación post-inscripción, los seis estados, logout
  revocable con su desenlace no confirmado, y controles fuera del MVP **ocultos**
  con su código intacto (§17.B-7).
- **H7** — Los dieciséis elementos de §20 comprobados uno a uno.
- **H8** — Verificación en navegador, o `BLOCKED_BROWSER_ACCESS` declarado.
- **H9** — Handoff entregado; `INDEX.md`, `history.md` y `PROJECT_LOG.md` al día.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Apartarse de una resolución de Codex** por comodidad, ahora que todo está decidido | §17.D las fija; §19.1 de `spec.md` declara STOP cualquier desviación de las tres |
| **Regresión silenciosa en Hospital** al extraer el cliente de sesión | Fachada que conserva la superficie exportada; prueba de regresión **obligatoria** y ejecutada sin editar la suite de Hospital; §19.16 y §19.17 |
| **Perder eventos de auditoría** al revertir la migración | Rollback **condicional**: se rechaza si hay eventos dependientes, y nunca los borra ni los reasigna (§9.4, §19.14) |
| **Inventar un actor** para auditar una petición sin principal humano | §9.2-2 lo prohíbe expresamente y §16 lo prueba |
| **Multiplicar el enum** de auditoría por endpoint | §9.1 lo resuelve con `resourceType` y `endpoint`; más valores rompen el límite «aditiva y mínima» |
| **Desbordar un micro-paquete** y arrastrar archivos de otro | Quince minutos por paquete, allowlist por paquete y §19.18 |
| **IDOR por comodidad**: aceptar `patientId` «solo para pruebas» | El parámetro no existe en ninguna firma; prueba que compara la respuesta con y sin selector |
| **Cruce de tenants** por confiar solo en RLS | Filtro explícito por tenant **además** de RLS, y prueba que exige ambos |
| **Sobreexposición de datos** al ser el sujeto quien lee | Regla dura: si no se pinta, no viaja. El resumen se prueba por **igualdad de conjunto** sobre tres campos, no por inclusión |
| **Confundir la cookie de inscripción con sesión de portal** — el modo de fallo que la §17.C-1 corrige | Prueba: con solo esa cookie no hay resumen, ni citas, ni visitas |
| **Presentar como funcional** una capacidad fuera del MVP | §6.15; prueba que recorre los controles |
| **Borrar** el código de una capacidad oculta en vez de dejar de montarla | §6.16, §13 y §19.11: prohibido sin autorización |
| **Confundir `empty` con `error`** | Estados separados y prueba explícita |
| **Falso cierre de sesión** en equipo compartido | Desenlace no confirmado cubierto por prueba, como en la spec 020 de Visitador |
| **Tocar `human-auth` «un momentito»** | Denylist §13 y STOP §19.2 |
| **Migración destructiva** al añadir auditoría | Solo valores aditivos, con `ROLLBACK-*.sql`; STOP §19.3 |
| **Declarar terminado sin ejecutar pruebas de aislamiento** | STOP §19.7; `CLAUDE.md` §10 |
| **Presión del hito del 2 de septiembre** | §20 fija los dieciséis elementos de «Paciente operativo». Un elemento sin prueba ejecutada no cuenta como cumplido |
