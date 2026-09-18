# Trazabilidad de MERDN

## Qué es este documento

Este documento responde, para cualquier parte del sistema, cinco preguntas:

1. **¿Qué spec la gobierna?** → tabla maestra (§1).
2. **¿De qué Task Specification histórica viene?** → tablas §1 y §2.
3. **¿Fue auditada?** → columna «Auditoría» de §1. En la mayoría de los casos la
   respuesta es **no**, y eso es un hallazgo.
4. **¿Qué código la implementa?** → mapas §3 (código) y §4 (migraciones).
5. **¿Qué la limita?** → «Brechas conocidas» (§5).

**Las specs 001–017 son *as-built*.** Describen lo que el repositorio contiene,
no lo que se desea construir. Aprobar una de ellas significa confirmar que
describe fielmente lo ya construido, no autorizar trabajo nuevo.

**La spec 018 no lo es, y por eso no aparece en las tablas de este documento.**
`018-correcciones-visitador-mp02` es prospectiva: define dos correcciones no
ejecutadas sobre el cliente de worklist de Visitador MP02, código que vive en
`wip/visitador-mp02-20260825` y no en `develop`. No gobierna todavía ninguna
línea de esta rama, así que no tiene entrada en el mapa de código (§3). La
tendrá cuando produzca su primer commit.

**`tasks/` y `reviews/` son archivo histórico congelado de solo lectura**
(`CLAUDE.md` §14.1). Contienen las Task Specifications que gobernaron MERDN
antes de la adopción de Spec-Driven Development y las auditorías que Codex
realizó sobre ellas. `CLAUDE.md` lo dice sin ambigüedad: «Claude Code no debe
crear Task Specifications nuevas en `tasks/` ni auditorías nuevas en `reviews/`.
Tampoco debe editar, reescribir ni "actualizar" su contenido histórico: son
evidencia de auditorías ya cerradas.» Este documento **cita** ese archivo; no lo
modifica.

**Fecha de corte: 2026-08-25.** Todo lo que sigue se midió contra la rama
`develop` en esa fecha con `ls`, `grep`, `find`, `git` y `awk`. Cuando un dato no
pudo verificarse, se dice explícitamente en lugar de afirmarlo.

### Advertencia de verificación

`node_modules/` **no está instalado** (`test -d node_modules` → MISSING) y
PostgreSQL no está levantado. Por tanto **ninguna suite de pruebas de este
repositorio se ejecutó el 2026-08-25**. Todos los recuentos de casos que
aparecen en las specs proceden de leer los archivos, no de una ejecución. Las
suites de API y de base de datos están además tras `describe.skipIf(...)`: sin
PostgreSQL terminarían en verde **sin ejecutar nada**, que es la peor forma
posible de «pasar».

### Tres cifras del archivo histórico que no coinciden con el repositorio

Dos ficheros del archivo congelado declaran cifras que la medición desmiente.
No se corrigen porque el archivo es de solo lectura; se registran aquí para que
ninguna spec futura las vuelva a copiar.

| Fuente | Afirma | Medición real | Comando |
|---|---|---|---|
| `reviews/README.md:5` | «las 21 auditorías» | **20 veredictos** `REVIEW-*.md`; `ls reviews/` devuelve **22 entradas** (los otros dos son `README.md` y `REVIEW-TEMPLATE.md`, que no son auditorías) | `ls reviews/ \| wc -l` → 22 |
| `tasks/README.md:5` | «las 57 Task Specifications» | **58 Task Specifications**; `ls tasks/` devuelve **60 entradas** (menos `README.md` y `TASK-TEMPLATE.md`) | `ls tasks/ \| wc -l` → 60 |
| `spec/specs/003-experiencia-visual-hospital/spec.md:15` | «sus siete auditorías `reviews/REVIEW-003H-*`» | **9 auditorías** de la serie 003H | `ls reviews/ \| grep -c "REVIEW-003H"` → 9 |

La cifra «21 auditorías» de `reviews/README.md` se propagó a las specs 008, 009,
010, 012, 014 y 015. Las specs 012, 015 y 017 ya están corregidas; **008, 009,
010 y 014 siguen repitiéndola** y quedan anotadas en §5 como deuda documental.

`spec/specs/INDEX.md` existe pero **está vacío**: contiene la cabecera de la
tabla y ninguna fila. Ninguna de las 17 specs está indexada allí.

---

## 1. Tabla maestra: las 17 specs

| Spec | Capacidad | Task Specs históricas | Auditoría en `reviews/` | Estado |
|---|---|---|---|---|
| **001**-fundacion-tecnica-monorepo | Monorepo TypeScript ejecutable: API NestJS, web Next.js, `@merdn/shared`, Prisma, contenedores. Sin dominio de negocio. | `TASK-001.md`; `TASK-DEPLOY-DEMO-01.md` (diferida, nunca implementada) | ✅ `REVIEW-001.md`, `REVIEW-001-FINAL.md` (2) | **Implementada** — sin CI y sin despliegue |
| **002**-experiencia-inscripcion-visual | Flujo de inscripción guiado en móvil y experiencia de paciente, en interfaz. | `TASK-002.md`, `TASK-002A.md`, `TASK-002B.md` | ✅ `REVIEW-002-FINAL.md` (1) | **Solo interfaz (sin persistencia)** — la persistencia llegó con la spec 007; la bitácora del paciente sigue sin modelo |
| **003**-experiencia-visual-hospital | Shell Hospital navegable completo: dashboard, operación, cuidado, administración, finanzas, analítica y reportes. | `TASK-003H-01`, `-02`, `-02B`, `-03`, `-03B`, `-03C`, `-04`, `-05`, `-06`, `-06A`, `-07` (11) | ✅ 9 auditorías `REVIEW-003H-*` (la spec dice «siete»: ver advertencia arriba) | **Implementada parcialmente** — el shell existe entero, pero solo Pacientes (009), Profesionales y Agenda (010) y Visitas (013) leen datos reales; el resto es configuración estática |
| **004**-orquestador-merdn | Ciclo Product Owner → Codex → Claude Code → auditoría, ejecutable como herramienta. | `TASK-MERDN-ORCHESTRATOR-V1.md` | ✅ `REVIEW-MERDN-ORCHESTRATOR-V1-FINAL.md` (1) | **Implementada** |
| **005**-experiencia-visual-alcaldia | Experiencia municipal diferenciada: población, territorio, programas, presupuesto, indicadores, brechas, evidencias, FURAG/MIPG y ADRES. | `TASK-ALCALDIA-A-01`, `-A-02`, `-A-03`, `-A-04`, `TASK-ALCALDIA-DEMO-FINAL` (5) | ✅ 5 auditorías: `REVIEW-ALCALDIA-A-01..04-FINAL`, `REVIEW-ALCALDIA-DEMO-FINAL` | **Solo interfaz (sin persistencia)** — salvo Población y Territorio, conectadas por la spec 008 |
| **006**-marca-eloisa-isa | Identidad de marca: nombre visible, logotipo, tipografía, color y expresiones de Eloísa e Isa. | `TASK-BRAND-01-ELOISA-ISA.md` | ✅ `REVIEW-BRAND-01-FINAL.md` (1) | **Implementada** — nombre comercial aún sin cerrar por el Product Owner |
| **007**-inscripcion-paciente-persistente | Primera capacidad con persistencia real: una inscripción completada deja de vivir en el navegador. | `TASK-MVP-CORE-01.md` | ✅ `REVIEW-MVP-CORE-01-FINAL.md` (1) | **Implementada** — `features/paciente` aún no consume `GET /api/v1/patients/me` |
| **008**-agregados-municipales-protegidos | Agregados municipales de población y territorio con supresión de cifras pequeñas y aislamiento por institución. | `TASK-MUNICIPALITY-CORE-01.md` | ❌ **sin auditoría registrada** | **Implementada parcialmente** — 2 de 13 módulos de Alcaldía conectados; no existe formulario de acceso institucional en la web |
| **009**-hospital-pacientes-api | Hospital · Pacientes conectado a datos reales, con guard de acceso y auditoría. | `TASK-HOSPITAL-CORE-01.md`, `TASK-HOSPITAL-CORE-01-CORRECTION.md` | ❌ **sin auditoría registrada** | **Implementada** — con dos *gates* diferidos: rendimiento (p95 ~1719 ms frente a un objetivo de ≤500 ms) y RLS |
| **010**-hospital-profesionales-agenda-api | Hospital · Profesionales y Agenda conectados, con asignación de cita a profesional. | `TASK-HOSPITAL-CORE-02.md` y sus cinco paquetes de corrección: `-CORRECTION`, `-FINAL-CORRECTION`, `-CONTINUATION`, `-FINAL-FAIL-CLOSED`, `-MINIMAL-CLOSE` (6) | ❌ **sin auditoría registrada** | **Implementada** — solo lectura y asignación; no hay alta, cancelación ni reprogramación por API |
| **011**-identidad-humana-y-relaciones | Identidad humana (cuenta, sesión, OIDC) y relaciones paciente–cuidador con ámbitos y revocación. | `IDENTITY-RELATIONSHIPS-CORE-01.md` + `-CLAUDE-PACKET`, `-CONTINUATION`, `-MICRO-01-KEYCLOAK-REIMPORT`, `-MP03-B`, `-OWNER-DECISION-PACKET` (6) | ❌ **sin auditoría registrada** | **Implementada** (backend) — **sin ninguna interfaz de usuario**: no hay pantalla de cuidador ni gestión de relaciones en `apps/web/` |
| **012**-visitas-domiciliarias | Visita domiciliaria como entidad propia: fundación en BD, materialización, transiciones profesionales y API protegida. | `VISITS-CORE-01.md` + `-MP01-DB-FOUNDATION`, `-MP02-MATERIALIZATION`, `-MP03-PROFESSIONAL-TRANSITIONS`, `-MP04-API` (5) | ❌ **sin auditoría registrada** (`ls reviews/ \| grep -i visit` → vacío) | **Implementada parcialmente** — falta la materialización automática al asignar la cita y los listados institucional, de paciente y de cuidador (§8 del packet) |
| **013**-visitas-visibles-en-hospital | Las visitas domiciliarias se ven y se operan desde el shell Hospital. | `HOSPITAL-VISITS-01-A-CLIENT.md`, `HOSPITAL-VISITS-01-B-VISIBLE-UI.md` | ❌ **sin auditoría registrada** | **Implementada** — sin listado: una visita materializada no se recupera tras recargar |
| **014**-sesion-profesional-en-shell | Acceso institucional y sesión profesional humana dentro del shell Hospital. | `HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI.md`, `H-FID-A.md` (fidelidad visual asociada) | ❌ **sin auditoría registrada** | **Implementada** — `GET /api/v1/me/contexts` no tiene ningún consumidor web |
| **015**-fidelidad-visual-hospital | Recuperación de la fidelidad visual del shell Hospital tras conectarlo a datos. | `H-FID-A.md`, `H-FID-B.md`, `HOSPITAL-VISUAL-RECOVERY-01-A-PATIENTS.md`, `-B-PROFESSIONALS.md`, `-C-AGENDA.md`, `HOSPITAL-REPORTS-UX-01-COMPACT-STICKY-FILTERS.md` (6) | ❌ **sin auditoría registrada** — la última auditoría del repositorio es `efc4656` (2026-08-22) y estas cinco tareas se implementaron el 2026-08-24 | **Implementada parcialmente** — `H-FID-C` («checkpoint 3 de 3», purga general de copy técnico) se anunció y **nunca se escribió como Task Specification ni se implementó** |
| **016**-acceso-de-soporte-administrativo | Acceso de soporte administrativo de plataforma: capacidad, concesión y contexto acotado con auditoría. | `ELOISA-ADMIN-ACCESS-01-MP01-DATA-FOUNDATION.md`, `-MP02-SUPPORT-SERVICES-GUARDS.md`, `-MP02-TEST-CONTRACT-CORRECTION.md` (3) | ❌ **sin auditoría registrada** | **Implementada parcialmente (MP02 pendiente)** — MP01 creó las tres tablas; `apps/api/src/support-access/` **no existe** y ningún código de `apps/api/src` nombra `SupportGrant`, `PlatformSupportCapability` ni `SupportContextSession` |
| **017**-worklist-del-visitador | Worklist del profesional visitador: su agenda propia de visitas domiciliarias. | `VISITADOR-CORE-01-MP01-PROFESSIONAL-WORKLIST-API.md`, `-MP02-VISIBLE-WORKLIST-AGENDA.md` (2) | ❌ **sin auditoría registrada** (`ls reviews/ \| grep -i visitador` → vacío) | **Implementada parcialmente (MP02 pendiente)** — la API existe; la ruta `apps/web/src/app/visitador/page.tsx` **no existe** y ningún archivo de `apps/web/src` nombra «worklist» |

### Resumen de auditoría

| | Specs | Cuáles |
|---|---|---|
| Con auditoría de Codex | **7** | 001, 002, 003, 004, 005, 006, 007 |
| **Sin auditoría registrada** | **10** | **008, 009, 010, 011, 012, 013, 014, 015, 016, 017** |

Los 20 veredictos se reparten así: 001 → 2, 002 → 1, 003 → 9, 004 → 1,
005 → 5, 006 → 1, 007 → 1. Sumen 20.

**El corte es exacto y no es casual:** la auditoría cubre **toda la etapa
visual** (specs 001–007, hasta MVP-CORE-01 inclusive) y **ninguna capacidad
posterior**. La última auditoría entró al repositorio en el commit `efc4656`
(2026-08-22). Todo lo construido a partir del 2026-08-22 —persistencia
municipal, persistencia hospitalaria, identidad humana, relaciones
paciente–cuidador, visitas domiciliarias, sesión profesional, soporte
administrativo y worklist— se integró **sin que ningún tercero verificara el
resultado**. Es decir: las capacidades con más superficie de seguridad (RLS,
guards, aislamiento por tenant, supresión de cifras, acceso de soporte) son
precisamente las no auditadas.

---

## 2. Cobertura de las 58 Task Specifications de `tasks/`

`ls tasks/` devuelve 60 entradas; se excluyen `README.md` y `TASK-TEMPLATE.md`,
que no son Task Specifications. Quedan **58**.

La columna «Citada por nombre» distingue si la spec nombra el archivo
literalmente o si lo cubre por notación de rango o de familia
(p. ej. `TASK-003H-01 a TASK-003H-07`, `TASK-ALCALDIA-A-01..04`, «sus cinco
paquetes de corrección»). Ambas formas son cobertura válida; la distinción
importa para quien busque un archivo concreto con `grep`.

| # | Task Specification | Spec SDD que la cubre | Citada por nombre |
|---|---|---|---|
| 1 | `ELOISA-ADMIN-ACCESS-01-MP01-DATA-FOUNDATION.md` | 016 | sí |
| 2 | `ELOISA-ADMIN-ACCESS-01-MP02-SUPPORT-SERVICES-GUARDS.md` | 016 | sí |
| 3 | `ELOISA-ADMIN-ACCESS-01-MP02-TEST-CONTRACT-CORRECTION.md` | 016 | sí |
| 4 | `H-FID-A.md` | 014, 015 | sí |
| 5 | `H-FID-B.md` | 015 | sí |
| 6 | `HOSPITAL-REPORTS-UX-01-COMPACT-STICKY-FILTERS.md` | 015 | sí |
| 7 | `HOSPITAL-VISITS-01-A-CLIENT.md` | 013 | sí |
| 8 | `HOSPITAL-VISITS-01-B-VISIBLE-UI.md` | 013 | sí |
| 9 | `HOSPITAL-VISUAL-RECOVERY-01-A-PATIENTS.md` | 015 | sí |
| 10 | `HOSPITAL-VISUAL-RECOVERY-01-B-PROFESSIONALS.md` | 015 | sí |
| 11 | `HOSPITAL-VISUAL-RECOVERY-01-C-AGENDA.md` | 015 | sí |
| 12 | `HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI.md` | 014, 015 | sí |
| 13 | `IDENTITY-RELATIONSHIPS-CORE-01-CLAUDE-PACKET.md` | 011 | sí |
| 14 | `IDENTITY-RELATIONSHIPS-CORE-01-CONTINUATION.md` | 011 | sí |
| 15 | `IDENTITY-RELATIONSHIPS-CORE-01-MICRO-01-KEYCLOAK-REIMPORT.md` | 011 | sí |
| 16 | `IDENTITY-RELATIONSHIPS-CORE-01-MP03-B.md` | 011, 012 | sí |
| 17 | `IDENTITY-RELATIONSHIPS-CORE-01-OWNER-DECISION-PACKET.md` | 011 | sí |
| 18 | `IDENTITY-RELATIONSHIPS-CORE-01.md` | 011, 012, 016 | sí |
| 19 | `TASK-001.md` | 001 | sí |
| 20 | `TASK-002.md` | 002 | sí |
| 21 | `TASK-002A.md` | 002 | sí |
| 22 | `TASK-002B.md` | 002, 006 | sí |
| 23 | `TASK-003H-01.md` | 003 | sí |
| 24 | `TASK-003H-02.md` | 003 | por rango |
| 25 | `TASK-003H-02B.md` | 003 | por rango |
| 26 | `TASK-003H-03.md` | 003 | por rango |
| 27 | `TASK-003H-03B.md` | 003 | por rango |
| 28 | `TASK-003H-03C.md` | 003 | por rango |
| 29 | `TASK-003H-04.md` | 003 | por rango |
| 30 | `TASK-003H-05.md` | 003 | por rango |
| 31 | `TASK-003H-06.md` | 003 | por rango |
| 32 | `TASK-003H-06A.md` | 003 | por rango |
| 33 | `TASK-003H-07.md` | 003 | sí |
| 34 | `TASK-ALCALDIA-A-01.md` | 005 | sí |
| 35 | `TASK-ALCALDIA-A-02.md` | 005 | por rango |
| 36 | `TASK-ALCALDIA-A-03.md` | 005 | por rango |
| 37 | `TASK-ALCALDIA-A-04.md` | 005 | por rango |
| 38 | `TASK-ALCALDIA-DEMO-FINAL.md` | 005 | sí |
| 39 | `TASK-BRAND-01-ELOISA-ISA.md` | 006 | sí |
| 40 | `TASK-DEPLOY-DEMO-01.md` | 001 | sí (declarada diferida) |
| 41 | `TASK-HOSPITAL-CORE-01-CORRECTION.md` | 009 | sí |
| 42 | `TASK-HOSPITAL-CORE-01.md` | 009 | sí |
| 43 | `TASK-HOSPITAL-CORE-02-CONTINUATION.md` | 010 | por familia |
| 44 | `TASK-HOSPITAL-CORE-02-CORRECTION.md` | 010 | por familia |
| 45 | `TASK-HOSPITAL-CORE-02-FINAL-CORRECTION.md` | 010 | por familia |
| 46 | `TASK-HOSPITAL-CORE-02-FINAL-FAIL-CLOSED.md` | 010 | por familia |
| 47 | `TASK-HOSPITAL-CORE-02-MINIMAL-CLOSE.md` | 010 | por familia |
| 48 | `TASK-HOSPITAL-CORE-02.md` | 010 | sí |
| 49 | `TASK-MERDN-ORCHESTRATOR-V1.md` | 004 | sí |
| 50 | `TASK-MUNICIPALITY-CORE-01.md` | 008 | sí |
| 51 | `TASK-MVP-CORE-01.md` | 007 | sí |
| 52 | `VISITADOR-CORE-01-MP01-PROFESSIONAL-WORKLIST-API.md` | 017 | sí |
| 53 | `VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md` | 017 (y citada por 013 y 015) | sí |
| 54 | `VISITS-CORE-01-MP01-DB-FOUNDATION.md` | 012 | sí |
| 55 | `VISITS-CORE-01-MP02-MATERIALIZATION.md` | 012 | sí |
| 56 | `VISITS-CORE-01-MP03-PROFESSIONAL-TRANSITIONS.md` | 012 | sí |
| 57 | `VISITS-CORE-01-MP04-API.md` | 012 | sí |
| 58 | `VISITS-CORE-01.md` | 012 (y citada por 011 y 016) | sí |

### Cuántas quedaron sin cubrir

**Ninguna. Las 58 Task Specifications están cubiertas por alguna de las 17
specs.** No hay huérfanas.

Matiz honesto: **12 de las 58 no se citan por su nombre de archivo completo**
(las marcadas «por rango» / «por familia»): las diez de la serie `TASK-003H-*`
intermedias, cubiertas por la spec 003 mediante «`TASK-003H-01` a
`TASK-003H-07` (incluidas `02B`, `03B`, `03C`, `06A`)»; las tres
`TASK-ALCALDIA-A-02..04`, cubiertas por la spec 005 mediante
«`tasks/TASK-ALCALDIA-A-01..04`»; y los cinco paquetes de corrección de
`TASK-HOSPITAL-CORE-02`, cubiertos por la spec 010 mediante «sus **cinco**
paquetes de corrección —`-CORRECTION`, `-FINAL-CORRECTION`, `-CONTINUATION`,
`-FINAL-FAIL-CLOSED` y `-MINIMAL-CLOSE`—». Un `grep` por nombre exacto no los
encuentra; la cobertura conceptual existe.

---

## 3. Mapa código → spec

### 3.1 `apps/api/src/` — 16 módulos

| Módulo | Spec que lo gobierna | Qué contiene |
|---|---|---|
| `audit/` | 007 (base), 011 (`identity-audit.service.ts`), 014 | Escritura de `AuditEvent`; `identity-audit.service.ts` emite **cinco** de los ocho eventos de identidad |
| `config/` | 001 | Variables de entorno y su validación |
| `consents/` | 007 | `ConsentRecord` de la inscripción |
| `database/` | 001 (base), 008–016 (`enterRuntimeContext`) | `PrismaService`, `withTenant()` (`:130`), `enterRuntimeContext()` (`:148`), contexto de tenant |
| `enrollment-sessions/` | 002, 007 | Sesión de inscripción y su cookie |
| `health/` | 001 | `GET /health`. **Único consumidor de `@merdn/shared` en todo el repositorio** |
| `hospital/` | 009 (Pacientes), 010 (Profesionales, Agenda, Asignación) | 4 controladores: `hospital/patients`, `/professionals`, `/agenda`, `/appointments` |
| `human-auth/` | 011 (identidad y sesión), 014 (`me-contexts.controller.ts`) | OIDC, sesión humana, `HumanSessionGuard`, `SameOriginGuard`, `GET /api/v1/me/contexts` |
| `identity-access/` | 011 | `IdentityAccessService`, `HumanPrincipal`, contextos humanos |
| `institutional-auth/` | 008 (guards municipales), 009 (`hospital-patient-viewer.guard`), 010 (`hospital-scheduler.guard`), 014 (sesión institucional) | Identidad y sesión institucional, auditoría institucional y **seis guards** |
| `municipality/` | 008 | Agregados de población y territorio, y `suppression.ts` |
| `openapi/` | 001 (base), y cada spec que añade operaciones | Generación del documento OpenAPI |
| `patients/` | 007 | Inscripción de paciente, normalización de documento, derivación de población |
| `people-relationships/` | 011 | Relaciones paciente–cuidador y su política |
| `territory/` | 007, 008 | `TerritorialUnit` |
| `visits/` | 012 (materialización y transiciones), 017 (`professional-visit-worklist.service.ts`) | `POST /materialize`, `GET`/`GET :visitId`/`PATCH :visitId/status` del worklist profesional |

**Los 13 controladores del repositorio**, declarados en 12 archivos —
`visits.controller.ts` declara dos— (`grep -rn '@Controller(' apps/api/src`)
y la spec que gobierna cada ruta:

| Ruta | Archivo | Spec |
|---|---|---|
| `(raíz)` `/health` | `health/health.controller.ts` | 001 |
| `api/v1/patients` | `patients/patient-enrollment.controller.ts` | 007 |
| `api/v1/municipality` | `municipality/municipality.controller.ts` | 008 |
| `api/v1/hospital/patients` | `hospital/hospital-patients.controller.ts` | 009 |
| `api/v1/hospital/professionals` | `hospital/hospital-professionals.controller.ts` | 010 |
| `api/v1/hospital/agenda` | `hospital/hospital-agenda.controller.ts` | 010 |
| `api/v1/hospital/appointments` | `hospital/hospital-appointment-assignment.controller.ts` | 010 |
| `api/v1/institutional/sessions` | `institutional-auth/institutional-auth.controller.ts` | 014 |
| `api/v1/human-auth` | `human-auth/human-auth.controller.ts` | 011 |
| `api/v1/me` | `human-auth/me-contexts.controller.ts` | 014 |
| `CAREGIVER_RELATIONSHIPS_PATH` | `people-relationships/caregiver-relationship.controller.ts` | 011 |
| `VISITS_MATERIALIZE_PATH` | `visits/visits.controller.ts:127` | 012 |
| `PROFESSIONAL_VISITS_PATH` | `visits/visits.controller.ts:255` | 017 (`GET`), 012 (`PATCH :visitId/status`) |

`app.module.ts` registra 10 módulos de dominio: `DatabaseModule`,
`HealthModule`, `PatientsModule`, `MunicipalityModule`, `HospitalModule`,
`InstitutionalAuthModule`, `HumanAuthModule`, `IdentityAccessModule`,
`PeopleRelationshipsModule` y `VisitsModule`. `AuditModule`, `ConsentModule`,
`EnrollmentSessionModule` y `TerritoryModule` se importan desde los módulos que
los consumen, no desde la raíz.

### 3.2 `apps/web/src/features/` — 5 áreas

| Área | Archivos | Spec que la gobierna | Datos |
|---|---|---|---|
| `experiencia/` | 2 | 002 | Punto de entrada `/`; `ExperienciaMerdn.tsx` |
| `inscripcion/` | 9 | 002 (interfaz), 007 (`patientEnrollmentClient.ts`) | **API** para el envío; el resto es flujo local (`inscripcionFlow.ts`, 1.315 líneas) |
| `paciente/` | 7 | 002 (interfaz) | **Estático**. `BitacoraPaciente.tsx` y `bitacoraFlow.ts` no tienen persistencia |
| `hospital/` | 110 | 003 (shell), 009, 010, 013, 014, 015 | Mixto: ver desglose abajo |
| `municipality/` | 38 | 005 (shell y vistas), 008 (Población y Territorio) | Mixto: 2 vistas conectadas de 13 |

**Desglose de `features/hospital/` — qué está conectado y qué no.** El criterio
es objetivo: existe o no un cliente de API que alimente la vista. Hay **6
clientes** en toda la web (`hospitalAgendaClient.ts`,
`hospitalPatientsClient.ts`, `hospitalProfessionalsClient.ts`,
`hospitalVisitsClient.ts`, `hospitalHumanSessionClient.ts`,
`hospitalInstitutionClient.ts`) más `patientEnrollmentClient.ts` y
`municipalityAggregatesClient.ts` fuera de Hospital.

| Vista | Spec | Origen de datos |
|---|---|---|
| `HospitalShell/Sidebar/Topbar.tsx` | 003, 014, 015 | Shell; sesión vía `hospitalHumanSessionClient` / `hospitalInstitutionClient` |
| `HospitalPatients.tsx` | 009 | **API** |
| `HospitalProfessionals.tsx`, `ProfessionalDetailPanel.tsx`, `ProfessionalEngagementPanel.tsx` | 010 | **API** |
| `HospitalAgenda.tsx` | 010, 013 | **API** |
| `HospitalHomeVisits.tsx` | 013 | **API** (parcial: sin listado) |
| `HospitalDashboard*.tsx` (5 archivos) | 003 | `hospitalDashboardConfig.ts` — estático |
| `HospitalAdministration.tsx`, `HospitalAdminPieces.tsx` | 003 | `hospitalAdministrationConfig.ts` — estático |
| `HospitalFinancialManagement.tsx`, `HospitalFinancialPieces.tsx`, `HospitalFinancialSections.tsx` | 003 | `hospitalFinancialConfig.ts` — estático |
| `HospitalAlerts.tsx` | 003 | `hospitalAlertsConfig.ts` — estático |
| `HospitalRatings.tsx` | 003 | `hospitalRatingsConfig.ts` — estático |
| `HospitalReports.tsx`, `HospitalReportsPieces.tsx` | 003, 015 | `hospitalReportsConfig.ts` — estático |
| `HospitalMemberships.tsx` | 003 | Estático |
| `HospitalVirtualConsultations.tsx` | 003 | `hospitalVirtualConfig.ts` — estático |
| `HospitalClinicalImport.tsx` | 003 | Estático |
| `HospitalUpdates.tsx` | 003 | `hospitalUpdatesConfig.ts` — estático |
| `HospitalAudit.tsx`, `HospitalPersonnelAccess.tsx`, `HospitalRolesPermissions.tsx`, `HospitalInstitutionSettings.tsx` | 003 | Estático |

**`features/municipality/`:** `MunicipalityPopulation.tsx` y
`MunicipalityTerritory.tsx` leen la API (spec 008, vía
`municipalityAggregatesClient.ts`). Las once restantes —`MunicipalityHome`,
`Programs`, `Budget`, `FinancialDetails`, `Evidence`, `Furag`, `Adres`, `Care`,
`Gaps`, `Caregivers`, `Indicators`, `Reports`— leen `municipalityConfig.ts`
(5.059 líneas de datos de demostración).

**Rutas de `apps/web/src/app/`:** solo `hospital/` y `municipality/`, más la raíz
`page.tsx`. No existe `visitador/` (spec 017, MP02) ni ruta propia de paciente.

---

## 4. Mapa migraciones → spec

`ls prisma/migrations/` devuelve 20 entradas: **11 directorios de migración** y
**9 archivos `ROLLBACK-*.sql`**, que no son migraciones sino guiones de reversión
manual. Las migraciones son 11, no 12.

| # | Migración | Spec | Qué crea |
|---|---|---|---|
| 1 | `20260821120000_core_01_init` | 007 | **9 tablas**: `tenant`, `person`, `patient`, `patient_address`, `patient_population_membership`, `territorial_unit`, `consent_record`, `enrollment_session`, `audit_event`. **13 enums**: `AreaType`, `AuditActorType`, `AuditEventType`, `AuditOutcome`, `ConsentType`, `DocumentType`, `PatientOrigin`, `PatientStatus`, `PopulationSource`, `PopulationType`, `SexGenderCode`, `TerritorialUnitStatus`, `TerritorialUnitType` |
| 2 | `20260821120100_core_01_reference_data` | 007 | Ninguna tabla. Solo datos de referencia: 3 `INSERT INTO` (1.210 líneas) que pueblan `territorial_unit` y el tenant inicial |
| 3 | `20260822120000_core_01_hardening` | 007 | Ninguna tabla. **Endurecimiento**: 10 `CREATE POLICY` (RLS), 4 `CREATE TRIGGER`, 4 funciones, grants de mínimo privilegio y el índice `territorial_unit_id_tenant_unique` |
| 4 | `20260822130000_municipality_core_01` | 008 | **2 tablas**: `institutional_identity`, `institutional_session`. **2 enums**: `InstitutionalIdentityStatus`, `InstitutionalRole` |
| 5 | `20260822140000_hospital_core_01` | 009 | Ninguna tabla. Añade el rol `HOSPITAL_PATIENT_VIEWER` a `InstitutionalRole` y **4 valores** a `AuditEventType` (`HOSPITAL_PATIENT_LIST_ACCESS_GRANTED`, `_DETAIL_ACCESS_GRANTED`, `_ANALYTICS_ACCESS_GRANTED`, `_ACCESS_DENIED`); relaja `audit_event_resource_required` |
| 6 | `20260822160000_hospital_core_02` | 010 | **4 tablas**: `professional_profile`, `professional_affiliation`, `care_assignment`, `appointment`. **7 enums**: `AppointmentModality`, `AppointmentStatus`, `CareAssignmentRole`, `CareAssignmentStatus`, `ProfessionalAffiliationStatus`, `ProfessionalEngagementType`, `ProfessionalStatus` |
| 7 | `20260823120000_identity_relationships_core_01` | 011 | **6 tablas**: `human_account`, `external_auth_identity`, `human_session`, `human_auth_attempt`, `patient_caregiver_relationship`, `patient_caregiver_relationship_scope`. **8 enums**: `CaregiverRelationshipRevocationReason`, `CaregiverRelationshipValidationSource`, `CaregiverScope`, `ExternalAuthIdentityStatus`, `HumanAccountStatus`, `PatientCaregiverPurpose`, `PatientCaregiverRelationshipStatus`, `PatientCaregiverRelationshipType`. Añade los **ocho** eventos de identidad a `AuditEventType` (`prisma/schema.prisma:140-147`) |
| 8 | `20260824120000_visits_core_01` | 012 (MP01) | **2 tablas**: `home_visit`, `home_visit_transition`. **1 enum**: `HomeVisitStatus`. **4 CHECK nombrados** y **8 claves foráneas** (4 compuestas y tenant-aware, ninguna `ON DELETE CASCADE`), el trigger `merdn_home_visit_guard()` con **8 caminos de error**, grants de mínimo privilegio y RLS `ENABLE` + `FORCE` |
| 9 | `20260824180000_visits_core_02` | 012 (MP02) | Ninguna tabla. Añade `HOME_VISIT_MATERIALIZED` a `AuditEventType` |
| 10 | `20260824200000_visits_core_03` | 012 (MP03) | Ninguna tabla. Añade **3 valores** a `AuditEventType`: `HOME_VISIT_STARTED`, `HOME_VISIT_COMPLETED`, `HOME_VISIT_NOT_COMPLETED` |
| 11 | `20260825120000_eloisa_admin_access_01_mp01` | 016 (MP01) | **3 tablas**: `platform_support_capability`, `support_grant`, `support_context_session`. **3 enums**: `PlatformSupportCapabilityStatus`, `SupportGrantScope`, `SupportGrantStatus`. Añade `human_session_id_account_tenant_unique` |

**Total: 26 tablas** (`grep -c "^model " prisma/schema.prisma` → 26 modelos).

Nueve de las once migraciones tienen guion de reversión. **No lo tienen**
`core_01_reference_data` ni las tres migraciones que solo hacen
`ALTER TYPE ... ADD VALUE`, porque PostgreSQL **no ofrece
`ALTER TYPE ... DROP VALUE`**: los propios archivos lo documentan
(`20260824180000_visits_core_02/migration.sql`,
`20260824200000_visits_core_03/migration.sql`). Es una limitación del motor, no
un descuido.

---

## 5. Brechas conocidas

Recopiladas de los `tasks.md` de las 17 specs y verificadas de nuevo contra el
repositorio. Cada una lleva su evidencia.

### 5.1 Dominios con interfaz completa y **sin modelo en Prisma**

El esquema tiene **26 modelos** y **ninguno** de los siguientes dominios está
entre ellos. Se comprobó modelo por modelo contra
`grep "^model " prisma/schema.prisma`, cuyo resultado completo es: `Appointment`,
`AuditEvent`, `CareAssignment`, `ConsentRecord`, `EnrollmentSession`,
`ExternalAuthIdentity`, `HomeVisit`, `HomeVisitTransition`, `HumanAccount`,
`HumanAuthAttempt`, `HumanSession`, `InstitutionalIdentity`,
`InstitutionalSession`, `Patient`, `PatientAddress`,
`PatientCaregiverRelationship`, `PatientCaregiverRelationshipScope`,
`PatientPopulationMembership`, `Person`, `PlatformSupportCapability`,
`ProfessionalAffiliation`, `ProfessionalProfile`, `SupportContextSession`,
`SupportGrant`, `Tenant`, `TerritorialUnit`.

| Dominio | Interfaz que ya existe | Fuente de datos hoy | Spec que lo declara |
|---|---|---|---|
| **Finanzas** | `HospitalFinancialManagement.tsx` + 2 archivos de piezas | `hospitalFinancialConfig.ts` | 003 |
| **Presupuesto** | `MunicipalityBudget.tsx`, `MunicipalityFinancialDetails.tsx` | `municipalityConfig.ts` | 005 |
| **Proveedores** | Dentro de Administración y de Alcaldía | Configuración estática | 003, 005 |
| **Contratos** | Dentro de Administración y de Alcaldía | Configuración estática | 003, 005 |
| **Membresías** | `HospitalMemberships.tsx` | Configuración estática | 003 |
| **Pagos** | Dentro de Finanzas y Membresías | Configuración estática | 003 |
| **Catálogo de servicios** | Dentro de Administración | `hospitalAdministrationConfig.ts` | 003 |
| **Alertas** | `HospitalAlerts.tsx` | `hospitalAlertsConfig.ts` | 003 |
| **Evidencias** | `MunicipalityEvidence.tsx` | `municipalityConfig.ts` | 005 |
| **Valoraciones** | `HospitalRatings.tsx` | `hospitalRatingsConfig.ts` | 003 |
| **FURAG** | `MunicipalityFurag.tsx` | `municipalityConfig.ts` | 005 |
| **MIPG** | Dentro de FURAG/Indicadores | `municipalityConfig.ts` | 005 |
| **ADRES** | `MunicipalityAdres.tsx` | `municipalityConfig.ts` | 005 |
| **Importación clínica** | `HospitalClinicalImport.tsx` | Configuración estática | 003 |
| **Bitácora del paciente** | `BitacoraPaciente.tsx`, `bitacoraFlow.ts` | Estado local del navegador | 002, 007 |

FURAG, MIPG y ADRES tienen un agravante que las specs 005 y 008 declaran: además
de no tener modelo, **no tienen fuente oficial aprobada**. No es solo que falte
la tabla; falta decidir de dónde saldría el dato.

**Consecuencia práctica:** de las 13 vistas de Alcaldía, 2 leen datos reales; de
las ~20 secciones de Hospital, 4 los leen. El resto son maquetas navegables. La
spec 003 y la 005 lo recogen como pendiente explícito: «Marca visual que
distinga sección conectada de sección de configuración» — hoy **nada en la
interfaz avisa al usuario de cuál es cuál**.

### 5.2 Micropaquetes especificados y no implementados

| Micropaquete | Spec | Evidencia |
|---|---|---|
| **`ELOISA-ADMIN-ACCESS-01-MP02`** — servicios y guards de soporte | 016 | `apps/api/src/support-access/` **no existe**. Las tres tablas de MP01 están creadas pero **ningún archivo de `apps/api/src` nombra `PlatformSupportCapability`, `SupportGrant` ni `SupportContextSession`**: la persistencia está vacía de código. Faltan la apertura de contexto con token propio, el TTL absoluto de 60 min e inactividad de 15, el cierre del contexto previo, la salida idempotente y el `SupportContextGuard` |
| **`VISITADOR-CORE-01-MP02`** — worklist visible | 017 | `apps/web/src/app/visitador/page.tsx` **no existe**; `grep -rn "worklist" apps/web/src` no devuelve nada. La API (`professional-visit-worklist.service.ts`, `GET PROFESSIONAL_VISITS_PATH`) existe y **no tiene ningún consumidor** |
| **`H-FID-C`** — purga general de copy técnico | 015 | No existe `tasks/H-FID-C.md`, no hay commit y no hay implementación. Se anunció en `H-FID-A` §6 y `H-FID-B` §8, y **seis** Task Specifications posteriores lo declaran fuera de su alcance. Copy técnico residual vivo en `hospitalAdministrationConfig.ts` (`:971`, `:981`, `:1388`) y `hospitalVirtualConfig.ts:101` |
| **`VISITS-CORE-01` §7.1 y §8** — materialización automática y listados | 012 | La materialización sigue siendo un `POST` explícito, no un efecto de asignar la cita. No existen `GET /api/v1/visits`, `GET /api/v1/visits/:visitId`, `GET /api/v1/patient/visits` ni `GET /api/v1/caregiver/patients/:patientId/visits`. Tampoco los permisos nombrados `visits.view`, `visits.execute`, `visits.contribute` |
| **`TASK-DEPLOY-DEMO-01`** — despliegue en VPS | 001 | Declarada diferida en el commit `3dd3c23`. Nunca implementada |

### 5.3 Ausencia total de pipeline de CI

**No existe integración continua de ningún tipo.**

- `.github/` **no existe** (`ls -a .github` → ausente). No hay workflows.
- No hay `.gitlab-ci.yml`, `Jenkinsfile` ni `.circleci/`.
- La spec 001 lo declara pendiente: «Pipeline de CI que ejecute `lint`,
  `typecheck`, `test`, `prisma:validate`».

Esto es lo que convierte el punto siguiente en un problema estructural y no en
una anécdota: **nada impide integrar código que no compila o que rompe pruebas.**
Combinado con que `node_modules` no está instalado y con que las suites de API y
BD se auto-omiten sin PostgreSQL, el resultado es que **una spec puede declarar
«las pruebas pasan» sin que nadie ni nada lo haya comprobado jamás**. Diez de las
diecisiete capacidades tampoco tuvieron auditoría humana. No hay red de
seguridad automática ni manual sobre la mitad más reciente del sistema.

### 5.4 `@merdn/shared` sin uso en el frontend

El paquete existe (`packages/shared/`) y **el frontend no lo consume en
absoluto**:

- `grep -rn "@merdn/shared" apps/web/src` → **sin resultados**.
- `apps/web/package.json` declara exactamente tres dependencias —`next`, `react`,
  `react-dom`— y **`@merdn/shared` no figura entre ellas**. No es que se importe
  poco: no está ni instalado.
- Sus únicos consumidores son tres archivos de `apps/api/src/health/`
  (`health.service.ts`, `health.controller.ts`, `health-response.dto.ts`), es
  decir, el endpoint más trivial de la API.
- La spec 001 lo declara pendiente: «`@merdn/shared` consumido por el frontend en
  vez de contratos duplicados».

**Consecuencia medible:** cada contrato de API está escrito dos veces, una en
`apps/api/src/**/*.contract.ts` y otra en los clientes de
`apps/web/src/features/**/*Client.ts`, sin ningún mecanismo que garantice que
coincidan. Con CI ausente (§5.3), una divergencia entre ambos lados solo se
descubre en ejecución.

### 5.5 Capacidades construidas sin superficie que las use

Backend completo, cero interfaz. Es trabajo pagado que ningún usuario alcanza:

| Capacidad | Spec | Evidencia |
|---|---|---|
| Relaciones paciente–cuidador | 011 | «No existe interfaz de usuario de esta capacidad: ni pantalla de cuidador ni gestión de relaciones en `apps/web/`». Además, ninguna superficie consume `canCaregiverViewVisits()`: **hoy una persona cuidadora no puede ver ninguna visita** |
| Contextos humanos | 014 | `GET /api/v1/me/contexts` no tiene ningún consumidor web |
| Worklist del visitador | 017 | Ver §5.2 |
| Fundación de datos de soporte | 016 | Ver §5.2 |
| Analítica de profesionales | 010 | `activePatientCount`, `todayAppointmentCount` y `nextAppointmentAt` se calculan y se envían; ningún componente de vista los lee |

### 5.6 Otras brechas declaradas por las specs

- **Rendimiento de Pacientes (009):** p95 ~1719 ms sin filtros y ~884 ms con
  filtros, frente a un objetivo declarado de ≤500 ms. La agregación de analítica
  se hace en memoria en vez de en SQL, y faltan índices para el orden por
  `person.familyNames` y `person.givenNames`.
- **Escritura hospitalaria (010):** no existe alta de profesionales,
  afiliaciones ni citas por API; no se puede cancelar, reprogramar, aceptar ni
  finalizar una cita; no se modelan duración, turnos, sedes, salas ni
  solapamiento.
- **Acceso institucional en Alcaldía (008):** no existe formulario de acceso en
  `apps/web/src/features/municipality/`; **sin cookie previa las dos vistas
  conectadas resuelven siempre en `no-autorizado`**.
- **Relaciones caducadas (011):** `EXPIRED` no se escribe nunca. No hay
  materialización perezosa ni worker: una relación caducada **sigue almacenada
  como `ACTIVE`**. `HumanAuthAttempt` tampoco se limpia nunca.
- **Visitas sin listado (013):** una visita materializada no se recupera tras
  recargar la página, y repetir la preparación responde `409` con un mensaje
  indistinguible de un conflicto de versión.
- **Archivos desmesurados:** `municipalityConfig.ts` (5.059 líneas),
  `engine.ts` del orquestador (2.125), `inscripcionFlow.ts` (1.315). Las specs
  005, 004 y 002 declaran su división como pendiente.
- **Deuda documental de la cifra «21 auditorías»:** las specs **008** (`spec.md:17`),
  **009** (`spec.md:18`, `research.md:328`), **010** (`spec.md:18`,
  `research.md:332`) y **014** (`research.md:485`) siguen repitiendo el recuento
  erróneo heredado de `reviews/README.md:5`. La cifra correcta es 20 veredictos
  en 22 entradas. La spec **003** declara «siete auditorías 003H» donde hay 9.

---

## 6. Cómo mantener este documento

Este documento se desactualiza en silencio: nada lo valida automáticamente. Cada
vez que se cree o modifique una spec, hay que actualizarlo a mano.

### Al crear una spec nueva (`018-...` en adelante)

1. **§1, tabla maestra.** Añadir una fila. Las cinco columnas son obligatorias:
   - **Task Specs históricas:** si la capacidad es nueva y no viene de `tasks/`,
     escribir «ninguna (capacidad nacida bajo SDD)». No inventar un origen.
   - **Auditoría:** comprobar con `ls reviews/` **antes** de escribir. Si no hay
     archivo, poner «❌ sin auditoría registrada». `reviews/` está congelado
     desde el 2026-08-25, así que toda spec nueva tendrá ❌ salvo que se adopte
     otro mecanismo de revisión, en cuyo caso se nombra ese mecanismo.
   - **Estado:** usar exactamente uno de los tres valores —«Implementada»,
     «Implementada parcialmente (MPxx pendiente)», «Solo interfaz (sin
     persistencia)»— y nombrar el micropaquete concreto que falta.
2. **§1, resumen de auditoría.** Actualizar los dos recuentos y la lista de
   specs sin auditoría.
3. **§2** solo cambia si se añade un archivo a `tasks/`. **No debería ocurrir
   nunca**: `CLAUDE.md` §14.1 lo prohíbe. Si `ls tasks/ | wc -l` deja de
   devolver 60, algo violó la congelación del archivo histórico y hay que
   investigarlo antes de tocar la tabla.
4. **§3** si la spec añade un módulo a `apps/api/src/`, un área a
   `apps/web/src/features/`, un `@Controller` o un cliente de API. Regenerar las
   listas con `ls`, no de memoria.
5. **§4** si la spec añade una migración. Registrar tablas y enums **leídos del
   `migration.sql`**, no del nombre del directorio. Verificar si existe su
   `ROLLBACK-*.sql`; si no existe, explicar por qué.
6. **§5** si la spec cierra una brecha (retirarla, no dejarla marcada como
   pendiente) o abre una nueva.
7. **Cabecera:** mover la fecha de corte y **rehacer la advertencia de
   verificación**. Si esta vez sí se ejecutaron las pruebas, decirlo con el
   comando y el resultado. Si no, decir que no se ejecutaron y por qué.

### Comandos de verificación

Ejecutar estos antes de dar por bueno cualquier recuento. Los valores a la
derecha son los del 2026-08-25.

```
ls spec/specs/ | grep -cE '^[0-9]{3}-'          # specs                    → 17
ls tasks/ | wc -l                                # entradas (58 + 2)        → 60
ls reviews/ | wc -l                              # entradas (20 + 2)        → 22
ls reviews/ | grep '^REVIEW-' | grep -vc TEMPLATE   # veredictos reales    → 20
ls -d prisma/migrations/*/ | wc -l               # migraciones              → 11
grep -c '^model ' prisma/schema.prisma           # modelos                  → 26
ls apps/api/src/*/ -d | wc -l                    # módulos de API           → 16
ls apps/web/src/features/*/ -d | wc -l           # áreas de web             → 5
grep -rn '@Controller(' apps/api/src | wc -l     # controladores (en 12 archivos) → 13
test -d .github && echo CI || echo "SIN CI"      #                          → SIN CI
grep -rn '@merdn/shared' apps/web/src | wc -l    # uso en frontend          → 0
```

### Dos reglas que no se negocian

**No copiar cifras de un documento a otro sin medirlas.** El recuento «21
auditorías» nació en `reviews/README.md:5` y se propagó a seis specs sin que
nadie ejecutara `ls reviews/ | wc -l`. Lo mismo pasó con «57 Task
Specifications» (`tasks/README.md:5`), con «siete auditorías 003H» y con varios
recuentos de casos de prueba. **Una cifra sin comando al lado es una cifra sin
verificar.**

**No editar `tasks/` ni `reviews/`.** Si un dato del archivo histórico es
erróneo —y hay al menos dos que lo son—, se registra la discrepancia **aquí**,
en la advertencia de la cabecera. El archivo permanece intacto: es evidencia de
auditorías cerradas, no documentación mantenible.
