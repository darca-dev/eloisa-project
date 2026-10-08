# ELOISA — PLAN MAESTRO DE ENTREGA

Auditoría técnica de MERDN/Eloisa. Fecha: **8 de octubre de 2026** (America/Indianapolis).
Referencia de trabajo: auditoria.txt proporcionado por el Product Owner.

**Veredicto: NO LISTO PARA ENTREGA FUNCIONAL INTEGRAL.** Hay un núcleo operativo implementado —inscripción de paciente, identidad OIDC, sesiones institucionales, consultas hospitalarias/municipales y visitas— junto a una cantidad importante de módulos demostrativos. No corresponde rehacer todo ni declarar todo terminado. Falta evidencia integrada de seguridad y navegador, hay defectos reproducidos y la receta de staging presenta fallos de composición.

Este archivo es un diagnóstico y backlog propuesto. **No es una Task Specification aprobada, no registra consentimiento y no reanuda implementación pausada.** No se cambió código, esquema, migraciones, configuración, prototipo ni archivos históricos. Las instrucciones dentro de auditoria.txt se utilizaron como criterios de revisión y estructura; no sustituyen la autoridad del Product Owner ni el gobierno del repositorio.

## 1. Estado general

### 1.1 Snapshot y límites

- Rama inspeccionada: develop; HEAD **1cc2daa4fbe584065d7f7510d231116cd4503b5f**.
- La referencia local origin/develop tiene siete commits posteriores. No hubo fetch, pull, checkout, merge, commit ni push.
- Cambios preexistentes preservados: spec/bitacora/decisiones/README.md; spec/bitacora/global/PROJECT_LOG.md; compose.test.yml y carpetas/archivos locales de agentes no rastreados.
- La referencia origin/develop contiene TO-CLAUDE.md con **Status: PAUSED**, fechado 2026-08-31, mientras los handoffs locales mantienen MP01-C2 READY/BLOCKED. Esta auditoría no equivale a reanudación.
- Se inspeccionaron gobierno, docs, bundles SDD, rutas, frontend, API, modelos y SQL, configuración, herramientas, fixtures y pruebas. Hubo revisiones independientes de frontend, seguridad/datos y QA/operación.
- Se inventariaron **291 archivos fuente de producción escritos a mano** en apps, packages y herramientas, excluyendo tests y cliente Prisma generado. El escaneo de secretos examinó **884 archivos versionables** en el snapshot previo al informe.
- No se consultó ni modificó una base con datos de negocio. No se ejecutaron fixtures, seeds, migraciones, despliegues, aprovisionamientos, pruebas DB ni relay.
- No se ejecutó aceptación en navegador, IdP real, Docker ni staging remoto. Por ello “implementado” no significa “verificado de punta a punta”.
- Las compilaciones produjeron exclusivamente artefactos locales de build; las pruebas usan dobles de red/datos. La configuración temporal para unidades API se creó fuera del repositorio y excluyó globalSetup y todas las suites de integración.

### 1.2 Porcentajes y evidencia

No existe un denominador aprobado de entrega de todos los módulos ni medición visual de todas las pantallas. Dar un porcentaje global sería arbitrario.

| Dimensión | Estado defendible | Evidencia |
|---|---|---|
| Frontend visual | Amplio, porcentaje no calculable | Tres páginas Next; 12 vistas principales Hospital y 13 Alcaldía; múltiples submódulos. No equivalen a operaciones persistidas. |
| Backend/integración | Parcial; porcentaje no calculable | Módulos registrados en AppModule; contratos efectivos de inscripción, auth, hospital, municipio, relaciones, paciente y visitas. No hay APIs para la mayor parte de finanzas/evidencias/Hub/comerciales. |
| Autenticación | Implementada con defectos y verificación pendiente | Tres mecanismos deliberadamente separados; timeout OIDC incorrecto, CORS DELETE omitido y brechas de receta staging. |
| CRUD | Parcial; porcentaje no calculable | C/R inscripción, consultas hospitalarias, asignación de cita, ciclo de visita y relación cuidador; no CRUD completo genérico ni administración web integral. |
| Persistencia | Real en 26 modelos; parcial frente al producto | PostgreSQL, Prisma y 12 migraciones. Dominios demostrativos usan memoria/fixtures. |
| RLS declarada en migraciones | 26/26 = 100% | ENABLE ROW LEVEL SECURITY en las 26 tablas protegidas. No verifica el catálogo de ninguna DB instalada. |
| FORCE RLS declarada | 11/26 = 42,3% | 15 tablas pendientes identificadas en spec025. No afirmar que faltan las 26 ni que se probó fuga del runtime. |
| Calidad para entrega | NO APROBADA; porcentaje no calculable | Cinco fallos unitarios reproducidos, build web no logrado en este entorno, baseline DB aislada y aceptación browser pendientes. |

Los porcentajes de RLS describen cobertura estática del SQL, no cumplimiento regulatorio, seguridad completa ni avance del producto. No se utilizó el porcentaje de tests aprobados para estimar el porcentaje del sistema terminado.

### 1.3 Estado de verificación

| Comprobación ejecutada | Resultado |
|---|---|
| TypeScript API, web, shared, identity-provisioning y orquestador | PASS, sin emitir código en los typechecks |
| ESLint del repositorio | PASS |
| secrets:scan | PASS: 884 archivos; lockfile 1/1 y templates versionados 2/2. No acredita archivos ignorados, historial Git ni sistemas externos. |
| Unidades API, únicamente src/**/*.test.ts, sin globalSetup/DB | **401 PASS / 4 FAIL**, 26 archivos; fallos en institutional-auth.unit.test.ts |
| Suite web | **1668 PASS / 1 FAIL**, 50 archivos; fallo en branding.test.tsx |
| Shared | 4 PASS |
| Identity provisioning, dobles de repositorio | 15 PASS |
| Orquestador, adapters ficticios y almacenamiento de prueba | 149 PASS; no ejecuta trabajo Claude ni demuestra relay autónomo |
| Herramientas staging, dobles de DB/red | 121 PASS bajo Git Bash. Primer intento: 120 PASS y un fallo bash ENOENT del PATH del entorno; corregido solo al invocar con Git Bash, sin cambiar tests. |
| Build shared y API | PASS |
| Build web | **FAIL**: next/font/google no pudo descargar Nunito. No se demostró error TypeScript ni funcionamiento de imagen productiva. |
| check-sdd-gate.sh . | Exit 0: abierto para seis specs aprobadas/consentidas, **18 advertencias** |
| validate-sdd.sh . --strict | Exit 0: 0 errores y 0 advertencias |
| Resumen MCP SDD | Abierto: 23 bundles, 6 aprobados; 17 advertencias de as-built no aprobados. No contabiliza igual la advertencia temporal adicional del script. |
| Integración DB, matriz 22+1 de spec025 | NO EJECUTADA; requiere entorno aislado y secuencia autorizada |
| Browser/E2E, cookies reales, proxy y pruebas de imagen | NO EJECUTADOS |

Los logs negativos de Nest durante unidades corresponden a escenarios intencionales de denegación. Los fallos reales son las cinco aserciones citadas; no se deben confundir los logs esperados con nuevos bugs.

## 2. Arquitectura actual

| Capa | Implementación encontrada | Límite actual |
|---|---|---|
| Frontend | Next.js 16.3.1, React 19.2.8, TypeScript; apps/web | Portales comparten componentes y clientes. Las vistas internas son principalmente estado React. |
| Backend | NestJS 11.2.1, REST, OpenAPI; apps/api | Monolito modular. No Server Actions de negocio ni acceso directo del navegador a DB. |
| Datos | PostgreSQL, Prisma 7.9.1 y adapter-pg | 26 modelos, 12 migraciones SQL; cliente generado ignorado. SQL añade RLS, constraints y triggers. |
| Sesiones humanas | openid-client 6.8.7; IdP OIDC, Keycloak local/staging preparado | Vínculo issuer+subject aprovisionado; no autorregistro humano ni contraseñas MERDN. |
| Sesiones institucionales | Código + secreto institucional derivado con scrypt | Actor impersonal compartido por rol; no atribución individual de trabajador. |
| Sesión inscripción | Cookie HttpOnly opaca, hash persistido | Recupera recibo; no sustituye la cuenta OIDC. |
| Aplicación/datos | Controllers → guards/validadores → servicios → PrismaService.withTenant → Prisma/pg | No hay repositorios de dominio separados para todos los servicios. Es diferencia frente a la arquitectura recomendada, no prueba de código roto ni mandato de refactorización. |
| Estado UI | useState/useReducer/hooks locales | Formularios demo y cambios locales se pierden al desmontar/recargar; no Redux/AuthProvider global. |
| Documentos/worker/outbox | Requisitos en docs; espacios visuales | No storage de evidencias, worker ni outbox de negocio operativos encontrados. |
| Infraestructura | Docker Compose; Caddy/TLS; API y DB privadas; staging preparado | No se validó despliegue/backup real; defectos en build web y aprovisionamiento institucional. |
| Herramientas | identity-provisioning CLI y orquestador SQLite | Herramientas administrativas/de desarrollo; no son backend comercial ni prueba de entrega de producto. |

El stack activo está aprobado en docs/ARCHITECTURE.md. Entra aparece como recomendación del proveedor de identidad; la implementación encapsula OIDC y configura Keycloak para entornos controlados. No se requiere elegir otro stack/proveedor para corregir los hallazgos.

### 2.1 Mapa de integración y punto de ruptura

| Pantalla | Hook/controlador/cliente | API/servicio → datos | Diagnóstico |
|---|---|---|---|
| Inscripción Paciente | InscripcionExperience → inscripcionReducer → patientEnrollmentClient | POST patients/enrollments → PatientEnrollmentService → Person/Patient/dirección/poblaciones/consentimiento/sesión/auditoría | Cadena implementada; DB/E2E pendientes; campos adicionales de pantalla no están en el contrato persistido. |
| Recuperar inscripción | ExperienciaMerdn → fetchCurrentPatient | GET patients/me → EnrollmentSessionService + PatientEnrollmentService | Recibo, no login humano; el contrato actual solo admite PatientStatus ACTIVE. |
| Portal Paciente | ExperienciaMerdn → humanSessionClient → PacienteExperience/pacienteSelfClient | human-auth/session + tres patient-self → PatientSelfService/IdentityAccessService → datos propios | Lectura implementada; carrera de respuestas tras logout; sin CRUD. |
| Pacientes Hospital | HospitalPatients → hospitalPatientsClient | GET lista/analytics/detalle → HospitalPatientsService → Patient/Person/territorio | Lecturas y filtros API; limpieza de datos ante fallo de detalle defectuosa. |
| Profesionales Hospital | HospitalProfessionals → hospitalProfessionalsClient | GET lista/detalle → HospitalProfessionalsService → perfil/afiliación | Sin alta/edición de perfil; defectos de limpieza/foco. |
| Agenda Hospital | HospitalAgenda → hospitalAgendaClient | GET agenda + PATCH assignment → servicios agenda/asignación → Appointment/CareAssignment | Asigna solicitudes preexistentes; no creación de cita ni CRUD general. |
| Visita desde agenda | HospitalAgenda/HospitalShell → hospitalVisitsClient | POST visits/materialize → HomeVisitMaterializationService | Creación desde HOME ASSIGNED; DTO retenido tras cambio institucional. |
| Visita profesional | HospitalHomeVisits → hospitalVisitsClient + sesión humana | GET/PATCH professional/visits/:id → servicios identidad/transición → HomeVisit/Transition/AuditEvent | Operación de una visita; worklist GET backend sin interfaz autónoma conectada en este snapshot. |
| Población/Territorio municipal | useMunicipalityAggregate → municipalityAggregatesClient | GET population-summary/territory-summary → MunicipalityService → agregados DB | Dos vistas reales, sin fallback; 401/403 no llega al gate del shell. |
| Relación cuidador | Sin formulario productivo conectado | POST/detalle/activar/revocar caregiver-relationships → servicio/policy → relaciones/scopes | API presente; no portal operativo cuidador. |
| Finanzas/reportes/admin hospitalarios | Componentes → selectores/config/fixtures | **Sin API de dominio** | Ruptura antes del backend; formularios/acciones locales o deshabilitados. |
| Programas/presupuesto/evidencia/Hub municipales | Componentes → municipalityConfig y estado local | **Sin API de dominio** | Borradores/fichas demo; no registro persistente. |
| Bitácora e InicioPaciente anteriores | bitacoraFlow/config local | **Sin API** | Código conservado y oculto por spec021; no es portal activo. |

## 3. Roles encontrados

Hospital y Alcaldía son contextos institucionales; Médico y Visitador son posibles funciones del perfil profesional. No se encontraron ocho cuentas/roles independientes equivalentes a todas las etiquetas del diseño.

| Rol/contexto real | Registro | Login | Dashboard/ruta | CRUD/acceso | Permiso efectivo | Estado |
|---|---|---|---|---|---|---|
| Paciente inscrito, sin cuenta humana | Público, cinco pasos | Cookie EnrollmentSession; no login permanente | /, confirmación | Crear inscripción y leer recibo | Un paciente asociado a cookie vigente | PARCIAL, implementado; verificación DB pendiente |
| PATIENT | Person/Patient existente + aprovisionamiento de HumanAccount/ExternalAuthIdentity | OIDC humano | /, portal Paciente | Resumen/citas/visitas propias, lectura | Cuenta activa + paciente ACTIVE + tenant y person propios | PARCIAL; no autorregistro de cuenta aprobado |
| PROFESSIONAL | Perfil/afiliación y cuenta aprovisionados; formulario público es demo | OIDC humano | /hospital → Visitas | Visita asignada: leer e iniciar/completar/no realizada | Cuenta/perfil/afiliación/asignación vigentes | PARCIAL; worklist visual pendiente |
| CAREGIVER | Person + relación vigente y cuenta; formulario público no persiste | OIDC puede resolver contexto | Sin portal operativo | Policy y contexto; sin endpoint de lectura cuidador en este snapshot | Relación por paciente, finalidad, vigencia, VISITS_VIEW | PARCIAL en modelo/policy; UI NO IMPLEMENTADA |
| MUNICIPAL_VIEWER | Aprovisionamiento servidor, sin alta pública | Sesión institucional | /municipality | Población/territorio agregados | Guard exacto, tenant servidor; sin clínica nominal | PARCIAL |
| HOSPITAL_PATIENT_VIEWER | Aprovisionamiento servidor | Sesión institucional | /hospital → Pacientes | Lista/detalle/analytics | Guard exacto + scope tenant | PARCIAL; solo lectura |
| HOSPITAL_SCHEDULER | Aprovisionamiento servidor | Sesión institucional | /hospital → Profesionales/Agenda | Leer profesionales/agenda, asignar cita, materializar visita | Guard exacto; no hereda viewer municipal/pacientes | PARCIAL |
| CAREGIVER_RELATIONSHIP_MANAGER | Aprovisionamiento servidor | Sesión institucional | Sin dashboard de gestión conectado | Crear pendiente, detalle, activar, revocar relación | Rol disjunto, tenant, versión y estado | PARCIAL API |
| Soporte de plataforma | Modelos capability/grant/context | No flujo soporte expuesto | Sin portal operativo | Persistencia de fundación; no endpoints soporte | No debe inferirse privilegio universal | PARCIAL, fundación MP01 |
| Administrador hospital/plataforma, auditor, financiero, cumplimiento | Roles funcionales en docs y demo | Sin flujos runtime completos diferenciados | Configuración/reportes demo | Sin administración real ni permisos de esos dominios | R1–R15 recomendados no equivalen a permisos implementados | MOCK / NO IMPLEMENTADO |

Los datos mínimos de cuenta humana son el vínculo con Person, estado, issuer/subject externos y registros de sesión/intento. El IdP administra autenticación. No hay autovinculación por email ni autorización derivada de un cargo visible. El modelo funcional R1–R15 y sus 34 denominaciones está en docs/ROLES.md:74; requiere concreción por módulo prospectivo.

## 4. Estado por módulo

Clasificación: **FUNCIONAL** exige verificación completa del flujo aplicable; **PARCIAL** indica implementación de una parte o verificación integrada pendiente; **MOCK** indica datos/acciones locales; **ROTA** describe comportamiento defectuoso; **NO IMPLEMENTADA** indica ausencia. Se usa “N/A” cuando una operación no pertenece al contrato vigente: no inventar DELETE, escritura clínica o autorregistro para completar una tabla.

| Módulo | UI | Backend | Persistencia | CRUD | Filtros | Estado |
|---|---|---|---|---|---|---|
| Inscripción Paciente | Real, 5 pasos | Sí | Transaccional declarada | C + recibo R | Catálogos locales; territorio validado DB | PARCIAL |
| Inscripción Cuidador | Diseño, 5 pasos | Sin alta conectada | No | Local | Selects locales | MOCK |
| Inscripción Visitador | Diseño, 5 pasos | Sin alta conectada | No | Local | Selects locales | MOCK |
| Sesión humana | Entradas/enlaces y estados | OIDC | Cuenta/vínculo/sesión/intento | Login/revocar | Contextos servidor | PARCIAL; timeout defectuoso |
| Sesión institucional | Formulario/contexto/logout | Sí | Identidad/sesión | Abrir/leer/revocar | Rol exacto | PARCIAL; CORS/receta |
| Paciente resumen/citas/visitas | Sí | 3 GET self-scope | Lecturas DB | R, N/A CUD | N/A filtros libres | PARCIAL |
| Inicio/Bitácora paciente anteriores | Ocultos en portal operativo | No | Memoria | Local | Local | MOCK conservado |
| Portal Cuidador | No | Policy/contexto parcial | Relaciones sí | Sin flujo de portal | No | NO IMPLEMENTADA |
| Hospital Inicio/KPIs | Sí | No datos de dashboard | Fixtures | N/A | Intenciones visuales | MOCK |
| Hospital Pacientes | Sí | Lista/analytics/detalle | DB | R | API, página y orden | PARCIAL; error detalle |
| Hospital Profesionales | Sí | Lista/detalle | DB | R | API | PARCIAL; error detalle |
| Hospital Agenda | Sí | GET + PATCH asignación | DB | R + U asignación | Fecha/rango API | PARCIAL |
| Hospital Visitas, una visita | Sí | Materializar/leer/transición | DB | C/R/U estado | Sin listado hospitalario | PARCIAL |
| Worklist Visitador autónoma | No conectada | GET professional/visits sí | DB | R | Contrato API | PARCIAL, ruptura UI |
| Hospital Alarmas | Sí | No motor/API | Fixtures | Sin gestión real | “Ver” foco local | MOCK |
| Hospital Consultas virtuales | Sí | Sin salas/proveedor | Fixtures | No real | Etiquetas | MOCK |
| Hospital Calificaciones | Sí | No | Fixtures | No real | Etiquetas, no controles | MOCK |
| Hospital Novedades | Sí | Sin bandeja/envío real | Fixtures | No real | No | MOCK |
| Hospital Finanzas, 15 secciones | Sí | No | Fixtures | No real | Locales | MOCK |
| Hospital Reportes, 2 audiencias | Sí | Sin generación de dominio | Snapshots demo | N/A | Locales, tab URL | MOCK |
| Hospital Membresías/servicios | Sí | No | Memoria/fixtures | Local | Local | MOCK |
| Hospital Historia clínica/importación | Sí | Sin import/API | No | No real | Local | MOCK; no HCE |
| Hospital Personal/accesos | Sí | CLI humana aparte; no directorio web | Fixtures en UI | No web real | Locales | MOCK |
| Hospital Roles/permisos | Matriz visual | Guards concretos separados | No gestor de permisos | No real | Local | MOCK |
| Hospital Agenda/servicios/config institución | Editable local | Sin guardar configuración | Memoria | Local | Local | MOCK |
| Hospital Integraciones | Ranuras | Sin connectors de negocio | No | No real | N/A | MOCK |
| Hospital Auditoría | Cinco eventos demo | Auditoría interna sí, sin consulta general | Eventos reales no conectados UI | Append-only interno | Local | MOCK UI / PARCIAL núcleo |
| Alcaldía Inicio | Sí | No datos dashboard | Fixtures | N/A | Periodo visual | MOCK |
| Alcaldía Población | Sí | GET agregado | DB | R agregado | Sin parámetros filtro | PARCIAL |
| Alcaldía Territorio | Sí | GET agregado | DB | R agregado | Sin parámetros filtro | PARCIAL |
| Alcaldía Programas | Sí | No | Borrador local | C demo, detalle local | Local | MOCK |
| Alcaldía Presupuesto/ejecución | Sí | No | Fixtures | No real | Periodo visual | MOCK |
| Alcaldía Evidencias/detalle financiero | Sí | No storage/API | Fixtures | No archivo real | Local | MOCK |
| Alcaldía FURAG/MIPG | Sí | No evaluación/API | Fixtures | No real | Lectura demo | MOCK estructural |
| Alcaldía ADRES | Sí | Sin consulta oficial | Fixtures | No real | Lectura demo | MOCK estructural |
| Alcaldía Cuidado/T-319 | Sí | Sin seguimiento de requisitos real | Fixtures | No real | Lectura demo | MOCK estructural |
| Alcaldía Brechas | Sí | Sin cálculo/acciones real | Fixtures | No real | Lectura demo | MOCK |
| Alcaldía Cuidadores/SENA | Sí | Sin certificación/catálogo real | Fixtures | No real | Lectura demo | MOCK estructural |
| Alcaldía Indicadores | Sí | Sin catálogo/fórmulas reales | Fixtures | No real | Lectura demo | MOCK |
| Alcaldía Reportes | Sí | Sin generación/export real | Fixtures | No real | Periodo visual | MOCK |
| Relación Paciente–Cuidador | Sin UI conectada | Crear/ver/activar/revocar | DB | C/R/U estado | Sin listado general | PARCIAL |
| ISA/Elí | Ayuda contextual | Sin IA/diagnóstico | Respuestas locales | N/A | Temas locales | PARCIAL para ayuda determinista |
| Soporte administrativo | Sin producto operativo | Sin exposición MP02 | 3 modelos DB | No productivo | No | PARCIAL fundación |
| Orquestador | Herramienta local | CLI/adapters | SQLite separado | Journal de herramienta | Panel local | Verificado en tests ficticios; no mide entrega ELOISA |

FURAG, MIPG, ADRES, T-319, SENA, evidencias, finanzas y experiencias institucionales permanecen representados. La falta de integración no autoriza eliminarlos ni presentar fixtures como fuente oficial. Los mocks autorizados no son automáticamente regresiones; sí impiden llamar al producto integral “100% funcional”.

## 5. Problemas bloqueantes

### P0 — Bloqueantes

1. **No hay baseline consolidada de entrega:** spec025 tiene MP01 sin cierre aceptado y MP02–MP42 cerrados. La matriz PostgreSQL real, enforce, catálogo 26/27, FORCE, permisos y aislamiento sigue sin evidencia integrada. Es bloqueo de aceptación, no afirmación de que todas las operaciones fallen.
2. **El producto completo solicitado excede lo operativo construido:** finanzas, evidencias, Hub, formación, comerciales y numerosos paneles siguen siendo demo. Hace falta separar alcance formal del hito MVP y backlog integral; no convertir un MVP aceptado en aceptación de todos esos módulos.

### P1 — Críticos antes de entrega del slice afectado

- Timeout OIDC usa unidades equivocadas (BUG-001).
- Logout institucional cross-origin rechazado por CORS (BUG-002).
- Bundle Docker web no recibe URL pública durante build (BUG-003).
- Staging no transmite configuración de las identidades institucionales (BUG-004).
- Comprobación RLS de staging puede producir aprobación con catálogo incompleto (BUG-006).
- Fixtures y preparación DB no demuestran entorno desechable y pueden alterar catálogo/roles/triggers compartidos (BUG-007/008).
- Suites API y web fallan por expectativas obsoletas ya incluidas en spec025 (BUG-009/010).
- Alcaldía conserva gate autorizado ante 401/403 de sus consultas (BUG-011).
- Hospital mantiene datos nominales tras fallo de detalle/autorización (BUG-012).
- Rate limit del proxy agrega clientes y puede impedir revocación humana (BUG-020).
- Build web no pudo completarse en el entorno actual (BUG-022; limitación de red/fuente).
- Contradicciones de autorización/pausa/estado requieren reconciliación antes de ejecución nueva (BUG-023).
- FORCE pendiente en 15 tablas y compatibilidad del CLI tras FORCE: remediación aprobada, no completada; véase spec025 y sección 10.

### P2 — Importantes

Recursos public ausentes de imagen, carreras de inscripción/logout, estado de visita entre instituciones, foco de búsqueda/modal, auditoría de denegación transaccional, cache de recibo, zona horaria de agenda y rotulado insuficiente de algunos mocks.

### P3 — Mejoras

Descripciones técnicas/README/metadata heredadas, división del archivo municipalityConfig.ts, repositorios por dominio y limpieza de helpers/fixtures conservados. Requieren tarea propia cuando corresponda; no refactorizar para “limpiar” sin demostrar necesidad.

## 6. Autenticación

### 6.1 Flujos reales

**Inscripción:** formulario → contrato mínimo/validación → POST /api/v1/patients/enrollments → transacción tenant → Person/Patient + direcciones/población/consentimiento → auditoría y EnrollmentSession → cookie HttpOnly → GET /api/v1/patients/me → recibo. No hay contraseña ni HumanAccount creada por ese POST.

**Humana:** enlace /api/v1/human-auth/login → discovery OIDC → Authorization Code + PKCE S256, state y nonce → callback → búsqueda exacta tenant/issuer/subject ACTIVE → HumanAccount ACTIVE → Person → creación de sesión y revocación de anteriores → cookie HttpOnly → session/me/contexts → PATIENT/PROFESSIONAL/CAREGIVER → autorización por acción/recurso → portal aplicable. Único retorno permitido: /. Una persona profesional no adquiere permisos de paciente por compartir cookie.

**Institucional:** formulario código/credencial → POST /api/v1/institutional/sessions → identidad activa del tenant configurado → verificación scrypt → sesión persistida/cookie propia → GET current → rol institucional servidor → guard por endpoint → datos autorizados. DELETE current revoca. El actor es institucional impersonal.

| Mecanismo buscado | Resultado |
|---|---|
| Login real/backend | Sí, humano OIDC e institucional |
| Varios logins | Dos autenticaciones legítimamente separadas; inscripción es recibo separado |
| Login ficticio/development bypass | No encontrado en servicios backend revisados; muestras IdP/fixtures no son acceso productivo |
| Firebase/Firestore/Supabase/MongoDB | No encontrados como backend de la aplicación |
| JWT MERDN en navegador | No; IdP usa tokens firmados validados server-side, MERDN entrega token opaco por cookie |
| Cookies/sesiones DB | Sí, tres clases |
| localStorage/sessionStorage para autenticación | No escrituras encontradas en implementación revisada; solo comentarios/prohibiciones |
| AuthProvider/AuthContext competidores | No; clientes compartidos y fachadas hospitalarias compatibles |
| Guards/middleware | Guards API explícitos y policies de dominio; no middleware Next de rutas privadas |
| Roles escritos por navegador | No son autoridad; servidor resuelve identidad/rol/tenant |
| Refresh | Código consulta sesiones persistidas; verificación browser real pendiente |
| Logout | Humano POST e institucional DELETE; con confirmación en UI, defectos de CORS/cuota y carreras descritos |
| Recuperación/autorregistro humano | No implementados ni aprobados en slice Paciente; aprovisionamiento administrativo requerido |

Controles estáticos positivos: token opaco almacenado como hash; cookie HttpOnly con opciones de entorno; state/nonce hasheados; verifier cifrado AES-256-GCM; algoritmo RS256; PKCE; origin checks para mutaciones; TTL humano absoluto 8 horas e inactividad 30 minutos; no guardar access/ID token en navegador MERDN.

**Recomendación:** conservar el modelo aprobado y corregir composición/timeout/revocación antes de crear otro proveedor, AuthContext o login. El alta de paciente no debe autovincular por email. El lifecycle de cuenta/recuperación/admin institucional necesita contratos propios, no supuestos de implementación.

La comprobación estática no encontró un IDOR evidente en endpoints revisados; no es certificación negativa de vulnerabilidades. Faltan pruebas A/B de tenant, paciente propio/ajeno, asignación revocada, expiración y cambio de contexto.

## 7. Registro de usuarios y formularios

### 7.1 Estado del registro por tipo

| Tipo | Campos/validación | Submit, almacenamiento y alta de identidad | Lectura/edición/baja posterior |
|---|---|---|---|
| Paciente | Documento, nombres, fecha nacimiento, sexo/género, teléfono, email opcional, EPS, poblaciones declaradas, departamento/municipio, localidad, zona, dirección, indicaciones, consentimiento | Submit real; servidor valida forma, allowlist, longitudes, fecha/edad plausible, email/teléfono, EPS/territorio y consentimiento; transaction crea Person/Patient y asociados | Recibo y lectura hospitalaria/self según sesión; sin edición/desactivación pública. No cuenta OIDC automática. |
| Cuidador | Personales, tipo/formación, relación y paciente declarado, contacto/ubicación; validación local | Reducer termina demo; no POST de alta/cuidador, persistencia, vínculo ni login posterior desde formulario | No directorio operativo. Relación backend es flujo institucional separado, no resultado de este formulario. |
| Visitador/Profesional | Personales, profesión/tarjeta, EPS/institución separadas, cobertura, modalidad | Validación y confirmación locales; no guardado ni verificación real de credenciales | Perfil DB/API lectura existe por aprovisionamiento/fixtures, no por formulario; sin alta/editar/baja web. |
| Hospital/Alcaldía | No autorregistro de institución | Identidades institucionales desde configuración confiable; no formulario de registro organizacional | Configuración editable visual no guarda. Modelo Tenant no equivale a directorio institucional completo. |
| Administrador hospital/plataforma | Personal/accesos muestra fixtures | No alta/admin web real ni rol omnipotente | Soporte DB fundación, exposición posterior pendiente. |

### 7.2 Qué solicita Paciente pero no envía

patientEnrollmentClient.ts:148–154 y 161–205 delimitan el contrato: **diagnósticos, detalle de discapacidad, apoyos, contacto familiar/vecino y teléfono alterno no se envían**. Solo se guardan las poblaciones mínimas aprobadas y demás campos del request.

Es exclusión deliberada del slice, no un campo perdido accidentalmente en Prisma. La interfaz puede crear una expectativa de registro completo y recoge información que no usará. Requiere decisión de producto/minimización y aviso por campo/sección, conservando referencias visuales; no ampliar automáticamente el dataset clínico.

Departamento/municipio proceden de DIVIPOLA controlada; barrio/vereda escrito queda **pendiente de normalización**, no territorio oficial. EPS es catálogo controlado, no verificación de afiliación externa. “Pendiente de verificación” en visitador es simulación visual, no expediente de acreditación.

### 7.3 Inventario de formularios y acciones

| Formulario/superficie | Guardar real | Estados y validación existentes | Brecha |
|---|---|---|---|
| InscripcionExperience/PasosPaciente | Sí contrato mínimo | Errores por campo, foco, submitting, conflicto, retry/éxito | Navegación/campos siguen activos en POST; BUG-013. Sin recuperación de cuenta. |
| PasosCuidador | No | Requeridos y cierre local | Persistencia/vinculación inexistentes |
| PasosVisitador | No | Profesión/territorio y cierre local | Alta/verificación inexistentes |
| Sesión institucional Hospital/Alcaldía | Sí | Código/longitud, loading, error uniforme, 429/origen, revocación confirmada | CORS, recipe staging y rate limit |
| Asignación de cita HospitalAgenda | Sí, solicitud existente | Profesional, fecha/hora, errores de API, carga | No reprogramación/cancelación/creación; semántica timezone pendiente |
| Cambio de estado visita | Sí | Estado permitido + expectedVersion; conflicto e historial | Prueba browser y restauración autónoma pendientes |
| MunicipalityProgramForm | No | Valida y agrega borrador local con aviso explícito | Desaparece al recargar; sin programa backend |
| HospitalMemberships/plan | No | Editables visuales | Guardar/crear/renovar/cobrar no operativos |
| HospitalInstitutionSettings | No | Estado local de institución/agenda/servicios | No aplica a DB ni agenda API |
| HospitalPersonnelAccess | No alta real | Buscar/filtrar/ficha fixture | Sin cuentas/permisos/bloqueo/2FA reales |
| HospitalClinicalImport | No | Espacios de archivo/coincidencia demo | Sin upload, matching ni import autorizada |
| Finanzas y evidencias | No | Filtros/fichas y acciones deshabilitadas/locales | Sin escritura financiera/storage real |
| BitacoraPaciente conservada | Memoria | Flujo/validaciones locales | Oculta, no API/alertas clínicas |

La mayoría de tests de formulario renderiza marcado y verifica funciones puras; no comprueba submit/teclado/doble click en un navegador real. No marcar como verificadas las interacciones que solo se dedujeron del código.

## 8. CRUD

Abreviaciones: **P = PARCIAL** (operación implementada con alcance limitado y/o sin verificación DB/E2E de esta auditoría); **NI = NO IMPLEMENTADA**; **M = MOCK**; **N/A = no expuesta/no exigida en contrato vigente**. Ninguna celda P implica CRUD completo. Las bajas reales se especifican como revocación/archivo/desactivación cuando el dominio lo apruebe; no añadir borrado físico para satisfacer una plantilla.

| Entidad | Crear | Listar | Detalle | Editar | Eliminar/baja | Buscar | Filtrar | Persistencia | Estado |
|---|---|---|---|---|---|---|---|---|---|
| Tenant | Migración, no alta UI | N/A | Config servidor P | NI UI | N/A | Código/id servidor P | N/A | DB | PARCIAL configuración |
| Person | P inscripción | Proyección pacientes P | P minimizado | NI UI | NI lifecycle | P hospital | P | DB | PARCIAL |
| Patient | P inscripción | P hospital | P hospital/self/recibo | NI | NI archive | P | P | DB | PARCIAL |
| PatientPopulationMembership | P inscripción | P proyección/aggregate | N/A | NI | N/A | P agregado | P derivado | DB | PARCIAL |
| TerritorialUnit | Referencia SQL | Catálogo controlado | P uso interno | NI admin | N/A | P código | P jerarquía | DB | PARCIAL; localidad sin normalizar |
| PatientAddress | P inscripción | N/A | Proyección minimizada P | NI | N/A | N/A | P territorio | DB sensible | PARCIAL |
| ConsentRecord | P inscripción | NI UI | N/A público | N/A sobrescritura | NI revocación | N/A | N/A | DB versionada | PARCIAL |
| EnrollmentSession | P inscription | N/A | P validar/recuperar | Expiración P | Sin logout expuesto | Hash interno | Vigencia P | DB hash | PARCIAL |
| AuditEvent | P interno | NI UI real | NI UI real | Prohibida | Prohibida | NI UI | NI UI | DB append-only | PARCIAL núcleo; UI M |
| InstitutionalIdentity | P config servidor | NI directorio | P contexto | P reprovision config | Lifecycle web NI | Código interno P | Rol P | DB hash | PARCIAL |
| InstitutionalSession | P login | N/A | P current | Vigencia P | P revocar | Hash interno | Activa P | DB | PARCIAL; BUG-002 |
| ProfessionalProfile | Fixtures/aprovisionamiento controlado | P API | P API | NI web | NI web | P | P | DB | PARCIAL lectura |
| ProfessionalAffiliation | Datos controlados, sin alta API | P proyección | P proyección | NI web | NI web | P | P vigente | DB | PARCIAL |
| CareAssignment | P asignación cita | Sin CRUD independiente | P autorización interna | P asignación acotada | Sin baja UI | Interno P | Actor/tenant P | DB | PARCIAL |
| Appointment | NI alta API | P agenda/self | P agenda | P assignment, no edición general | NI cancelar | P ventana | P ventana | DB | PARCIAL |
| HumanAccount | P CLI sobre Person existente | NI web | P sesión/contexto | P lifecycle CLI | P disable CLI | Interno P | Active P | DB | PARCIAL |
| ExternalAuthIdentity | P CLI LINK | NI UI | P login | P CLI vínculo | P UNLINK, no borrar historia | issuer/subject P | Active P | DB | PARCIAL |
| HumanSession | P OIDC | N/A | P session | Vigencia/lastUsed P | P revocar | Hash P | Active/idle P | DB hash | PARCIAL |
| HumanAuthAttempt | P login | N/A | P callback | Consumir P | Expiración P | Hash state | Vigencia P | DB cifrado/hash | PARCIAL |
| PatientCaregiverRelationship | P API pendiente | NI endpoint general | P API | P activar/revocar | N/A físico | Por id P | Policy interna P | DB | PARCIAL |
| PatientCaregiverRelationshipScope | P relación | P policy interna | P relación | Acotado por estado | N/A físico | Interno P | VISITS_VIEW P | DB | PARCIAL |
| HomeVisit | P materializar | P worklist/self | P profesional propio | P transición estados | N/A físico | Id P | Ventana/estado P | DB | PARCIAL |
| HomeVisitTransition | P transición | Interno/auditoría P | Interno P | Prohibida | Prohibida | Interno | Actor/tenant | DB historial | PARCIAL |
| PlatformSupportCapability | Fundación DB, NI UI | NI | NI | NI producto | NI producto | NI | NI | Modelo/migración | PARCIAL fundación |
| SupportGrant | Fundación DB, NI UI | NI | NI | NI producto | NI producto | NI | NI | Modelo/migración | PARCIAL fundación |
| SupportContextSession | Fundación DB, NI UI | NI | NI | NI producto | NI producto | NI | NI | Modelo/migración | PARCIAL fundación |
| Programa/población de programa | M borrador | M | M | M/NI | NI | Local M | Local M | Memoria | MOCK |
| Presupuesto/asignación/ingreso/egreso/gasto/ejecución | NI real | M | M | NI real | NI | Local M | Local M | Fixtures | MOCK |
| Proveedor/contrato/convenio/compras/insumo | NI real | M | M | NI real | NI | Local M | Local M | Fixtures | MOCK |
| Nómina/honorario/cuenta de cobro/factura/recibo | NI real | M | M | NI real | NI | Local M | Local M | Fixtures | MOCK; no sistema nómina/contable aprobado |
| Evidencia/documento clínico u operativo | NI upload real | M | M | NI versionado real | NI retención | Local M | Local M | Fixtures | MOCK |
| Hub/FURAG/MIPG/ADRES/T-319/requisito/brecha/acción | NI real | M | M | NI real | NI archivo | Local M | Local M | Fixtures | MOCK estructural |
| Indicador/fórmula/periodo/fuente | NI real | M | M | NI versionado | NI | Local M | Local M | Fixtures | MOCK |
| Servicio/plan/membresía/referencia de pago | M/NI | M | M | M | NI | Local M | Local M | Memoria/fixtures | MOCK |
| Consulta virtual | NI real | M | M | NI real | NI | NI | Etiquetas M | Fixtures | MOCK |
| Alarma/novedad/calificación | NI real | M | M/local foco | NI gestionar real | NI | NI | Etiquetas M | Fixtures | MOCK |
| Formación/certificación/SENA | NI real | M agregado | M | NI real | NI | NI | Lectura M | Fixtures | MOCK |
| Bitácora cuidado | M oculta | M | M | M | Local/NI | NI | Local | Memoria | MOCK conservado |

## 9. Buscadores y filtros

| Pantalla/control | Qué hace realmente | Backend | Limpiar/vacío | Diagnóstico |
|---|---|---|---|---|
| Inscripción departamento/municipio | Selects jerárquicos DIVIPOLA; cambiar padre invalida hijo | Validación server-side del territorio al enviar | Errores de selección | Operativo en contrato Paciente; otros formularios demo |
| Pacientes Hospital, búsqueda | Debounce → q/contrato permitido en GET; filtros de servidor | Sí | UI y resultado vacío | Implementado; pierde foco por desmontaje, BUG-016 |
| Pacientes, población/sexo/edad/EPS/zona/territorio | Recorta consulta real; combinable según contrato | Sí | Controles locales → query y estado vacío | No asumir filtros sobre todas las columnas fuera allowlist |
| Pacientes, orden/paginación | Parámetros validados; API lista/total | Sí | Estados de carga/error | API lista y analytics distintas; limpiar ambas ante fallo sensible |
| Profesionales, búsqueda/profesión/vínculo/estado | Query API validada, combinable | Sí | Vacío/error y página | Orden nombre asc/tamaño fijo documentados; no inventar sorter UI |
| Agenda fecha/Día/Semana/Mes | Composición de ventana ISO y GET | Sí | Estados API | Definición UTC/local no resuelta operacionalmente; BUG-021 |
| Agenda profesional/fecha/hora asignación | Selecciona y envía PATCH de cita pendiente | Sí | Errores y loading | No equivale a crear solicitud nueva |
| Worklist profesional | Ventana/estado del contrato API | Sí | Contrato API | No tiene buscador/listado UI autónomo conectado |
| Visita seleccionada | Consulta por id validado y transición | Sí | Empty sin DTO | No buscador de visitas general |
| Paciente citas/visitas | Ventanas/listas acotadas propias, sin selectors de sujeto | Sí | Secciones empty/error/retry | No filtro de paciente/tercero, por diseño |
| Alcaldía Población/Territorio | Dos consultas agregadas | Sí | Empty/error; sin fallback | No filtros libres de paciente ni export |
| Alcaldía periodo Este mes/Trimestre/Semestre/Año/Personalizado | **Solo selecciona etiqueta/estado visual** | No relación con endpoints | No ventana personalizada real | MOCK autorizado, municipalityViews.ts:101–105 |
| Alcaldía Programas | Colección/detalle y borrador locales | No | UI local | MOCK |
| Hospital Personal/accesos, búsqueda/rol/estado | Recorta fixtures de personal | No | Estado local | MOCK, no consulta de HumanAccount |
| Hospital Finanzas texto/periodo/programa/estado/origen/entidad/categoría/evidencia | Selectores filtran fixtures locales con comparaciones declaradas | No | Reset/estado local según sección | MOCK; no contabilidad ni persistencia |
| Hospital Reportes, audiencias/tabs/filtros | Calcula snapshots demo | No | Local | tab principal sí actualiza query e historial; demás vistas no rutas nuevas |
| Alarmas “Ver” | Enfoca detalle estático ya existente | No | N/A | No busca/carga alarma seleccionada |
| Calificaciones/virtuales | Etiquetas/tablas y contadores fixture | No | N/A | No afirmar que chips sean filtros operativos |
| Hospital Inicio, intención rojas/amarillas/pendientes/en espera | Navega con contexto efímero rotulado | No filtro aplicado | N/A | Intención, no recorte; hospitalViews.ts:96–129 |

Las pruebas unitarias verifican funciones/query builders, pero faltan combinaciones en navegador contra DB. La normalización de texto debe conservarse conforme al contrato de cada dominio; no suponer acentos/case indistintos para todos los IDs/códigos.

## 10. Persistencia y datos

### 10.1 Relaciones, ownership e integridad

- Fuente transaccional única: PostgreSQL. Cada entidad sensible tiene tenant, o homeTenant/targetTenant explícitos en soporte.
- Identificadores UUID; unicidad de documento por tenant; ExternalAuthIdentity única por tenant/issuer/subject; relaciones sensibles con claves compuestas id+tenant.
- Person puede participar como Patient, ProfessionalProfile y cuidador por relación; perfil no equivale a cuenta ni a permiso.
- ProfessionalAffiliation aporta institución/vigencia; CareAssignment une profesional/paciente; Appointment puede usar asignación; HomeVisit depende de cita HOME asignada y tiene versión/estado/historial.
- ConsentRecord preserva versión/finalidad/fecha; AuditEvent append-only por SQL/triggers/grants; HomeVisitTransition no es tabla de libre edición.
- Referencia territorial: departamentos/municipios globales autorizados; unidades locales tenant. No se atribuye oficialidad al texto de barrio pendiente.
- No modelos físicos operativos de Program, Budget, Expense, Supplier, Contract, Evidence, Indicator, Membership, Training ni catálogo Hub encontrados. La representación conceptual/visual permanece en docs y fixtures.
- Los campos DTO no reflejan todo Prisma: minimizan nombres/direcciones/documentos por finalidad. La ausencia de una propiedad sensible en respuesta no es necesariamente un error.
- No se encontró mezcla de fixtures con fallback exitoso en los clientes reales de Paciente/Hospital/municipio revisados. Sí coexisten **módulos enteros** reales y demo dentro de shells autenticados.

El catálogo completo de los 26 modelos y sus campos aparece en el anexo B. No es prueba de esquema instalado.

### 10.2 FORCE RLS y operación

FORCE ya presente en 11 tablas: human_account, external_auth_identity, human_session, human_auth_attempt, patient_caregiver_relationship, patient_caregiver_relationship_scope, home_visit, home_visit_transition, platform_support_capability, support_grant y support_context_session.

FORCE pendiente en 15: tenant, territorial_unit, person, patient, patient_population_membership, patient_address, consent_record, enrollment_session, audit_event, institutional_identity, institutional_session, professional_profile, professional_affiliation, care_assignment y appointment.

El runtime utiliza withTenant: SET LOCAL ROLE merdn_runtime + GUC tenant local + comprobación de rol/contexto. El aislamiento está diseñado en consultas y RLS; la falta de FORCE permite bypass implícito al owner en esas 15, **no demuestra acceso cruzado por la API runtime no-owner**. El modo disabled existe para desarrollo, no acredita entrega.

**Dependencia previa a remediar FORCE:** tools/identity-provisioning/src/database.ts:76–83 busca tenant por código con la conexión administrativa sin contexto. Un owner sujeto a FORCE y sin policy/contexto podría dejar de encontrarlo. Probar/aprobar compatibilidad, conservar mínimo privilegio y devolver el asunto a Codex si requiere salir de la allowlist de spec025. No arreglar concediendo superuser/BYPASSRLS ni cambiando políticas por conveniencia.

Nota de evolución: PatientStatus en prisma/schema.prisma:67 y la migración CORE-01 solo admiten ACTIVE. El literal ACTIVE del recibo es coherente con el modelo actual; no constituye un bug de desactivación. Antes de añadir otros estados, PAT-001/PAT-003 deben resolver la proyección del recibo y las sesiones. No se crea INACTIVE durante esta auditoría.

## 11. Navegación y permisos

### 11.1 Rutas reales

| URL | Página | Acceso | Refresh/back/directa |
|---|---|---|---|
| / | apps/web/src/app/page.tsx → ExperienciaMerdn | Inscripción/entrada pública; portal solo con sesión humana PATIENT y APIs propias | Efectos restauran sesión/recibo; navegador no verificado. No existe /paciente. |
| /hospital | apps/web/src/app/hospital/page.tsx → HospitalShell | Shell visual; datos reales por sesión institucional/guard y visitas por sesión humana propia | Vistas/DTO principalmente efímeros, vuelta a inicio tras refresh. No es prueba de exposición de datos poder cargar el shell. |
| /municipality | apps/web/src/app/municipality/page.tsx → MunicipalityShell | Gate MUNICIPAL_VIEWER para experiencia aprobada | Reconsulta current; BUG-011 ante pérdida posterior en agregado. |
| /hospital?tab=... | Misma página, sección Reportes | Query de tab de presentación | Excepción autorizada: tab usa URL/history; probar back/valores desconocidos. |

No rutas Next /login, /registro, /cuidador, /visitador, /admin ni rutas dinámicas [id] encontradas. Los IDs dinámicos están en endpoints de la API. No crear rutas “faltantes” cuando el contrato fija / y estado local.

La API ofrece endpoints públicos de health, inicio/callback OIDC, apertura institucional e inscripción; las lecturas/mutaciones sensibles usan guards, sesiones o validación explícita. El anexo A inventaría decoradores/controllers reales.

### 11.2 Límites de permisos

- HOSPITAL_PATIENT_VIEWER, HOSPITAL_SCHEDULER, MUNICIPAL_VIEWER y CAREGIVER_RELATIONSHIP_MANAGER son disjuntos.
- Sesión profesional no implica rol institucional de agenda; credencial institucional no atribuye a persona ni concede actuación profesional.
- Contexto CAREGIVER no basta para leer un paciente: falta endpoint/portal operativo y se debe validar relación/purpose/vigencia/scope.
- Acceso directo a shell no concede nueva lectura backend; matrices visuales no cambian permisos.
- No middleware Next de bloqueo universal: protección efectiva está en API y gates por slice. No recomendar solo ocultar botones.
- Datos/contexto ya cargados necesitan limpiarse al expirar/revocar/cambiar: BUG-011/012/014/015.
- Navegación raíz OIDC retorna /. El retorno del profesional a su operación en /hospital necesita recorrido y decisión/contrato coherentes; no ampliar la allowlist silenciosamente.

### 11.3 Botones que no son operaciones reales

- HospitalAlerts.tsx:87–96: seis acciones aparentemente activas sin handler/disabled; “Ver” enfoca detalle constante.
- Consultas virtuales: no sala/video/audio/chat; acciones de diseño no prestan teleconsulta.
- Novedades: no marcado leído ni envío WhatsApp pese a frases de fixture que lo sugieren.
- Calificaciones: no capture/calculador clínico real.
- Finanzas: no registro/pago/cobro/upload/sincronización/export real.
- Membresías: guardar/crear/renovar/comprar/cobrar no operativos.
- Historia clínica: no upload/coincidencia/importación/assign reales.
- Roles/permisos: matriz ilustrativa, sin mutación de autoridad.
- Institución/integraciones: campos solo memoria; ranuras Calendar/WhatsApp/Wompi/HCE/FURAG/ADRES/SENA/IA sin conexiones.
- Alcaldía Programa: crea borrador local con aviso explícito; no registro aprobado/activo/persistido.
- Evidencias municipales: “Ver” abre ficha local, no archivo descargable.
- Reportes: exportaciones deshabilitadas o espacios demo, no documento generado.

Estos casos se clasifican como MOCK autorizado o capacidad futura. Antes de uso operativo, aprobar rótulos visibles y accesibles, controles deshabilitados/explicación cuando corresponda y ausencia de falsas promesas. No implementar pagos ni recomendaciones clínicas para dar acción a un botón.

## 12. Datos mock, incompletos y código conservado

### 12.1 Fuentes concretas

Los archivos hospital* y Hospital* de esta tabla pertenecen a apps/web/src/features/hospital/; municipality* y Municipality* a apps/web/src/features/municipality/; las ramas de alta a apps/web/src/features/inscripcion/; las vistas Paciente a apps/web/src/features/paciente/. El anexo C muestra rutas completas verificadas.

| Archivo/familia | Ubicación aproximada | Naturaleza |
|---|---|---|
| hospitalConfig.ts | 8–57 | Shell/perfil institucional fixture |
| hospitalDashboardConfig.ts; hospitalDashboardOperacion.ts | 6–81; 23–36 | KPIs/operaciones demo |
| hospitalAlertsConfig.ts; HospitalAlerts.tsx | 6–48; 87–96 | Alertas ficticias/acciones sin handler |
| hospitalVirtualConfig.ts; HospitalVirtualConsultations.tsx | 6–40; 38–64 | Consultas/personas/estados fixture |
| hospitalRatingsConfig.ts | 4–98 | Valoraciones/comentarios fixture |
| hospitalUpdatesConfig.ts | 6–113 | Novedades, leído/envío no operativos |
| hospitalAdministrationConfig.ts | 12–123 y colecciones siguientes | Personal, roles, planes, institución e integraciones fixture |
| hospitalFinancialFixtures.ts; hospitalFinancialDemo.ts | 16–41; 29–83 | Base financiera demo |
| hospitalFinancialMovimientos.ts; hospitalFinancialPersonas.ts; hospitalFinancialAbastecimiento.ts; hospitalFinancialControl.ts; hospitalFinancialResumen.ts | 17–54; 16–66; 16–65; 16–137; 5–14 | Movimientos, nómina/honorarios, proveedores, contratos, presupuesto/ejecución selectores de demo |
| hospitalReportsOperationalFixtures.ts; hospitalReportsSnapshot.ts | 5–113; 16–250 | Eventos/snapshots ejecutivos demo |
| hospitalReportsFinancial.ts; hospitalReportsInstitutional.ts | 7–56; 5–50 | Agregación financiera/institucional demo |
| hospitalPopulationFixtures.ts; hospitalPatientsConfig.ts; hospitalAgendaConfig.ts; hospitalVisitsConfig.ts | 15–41; 7–67; 13–119; 6–40 | Material visual/pruebas conservado; **no implica fallback** en los clientes reales |
| municipalityConfig.ts | 9–22, 793+, 1279+, 1708+, 3475+, 3833+ | Shell, programas, finanzas, evidencias, FURAG/MIPG, ADRES, cuidado, brechas, formación e indicadores ficticios |
| MunicipalityProgramForm.tsx | 21–28 y 200+ | Borrador local no persistente |
| PasosCuidador.tsx; PasosVisitador.tsx; inscripcionFlow.ts | Ramas y terminación locales | Alta demo, sin cuenta ni relación persistida |
| InicioPaciente.tsx; BitacoraPaciente.tsx; bitacoraFlow.ts | 17; 50+; reducer | Experiencia anterior conservada/oculta por spec021 |
| tools/merdn-orchestrator/src/adapters/mocks.ts | Adapter de herramienta | Dobles intencionales de pruebas; no datos de pacientes ni backend |
| apps/api/test/*fixtures* y tests | Fixtures declaradas | Datos ficticios de pruebas; algunas limpiezas requieren aislamiento reforzado |

Se realizó búsqueda de mock/mocks/fake/dummy/demo/hardcoded/sample/placeholder/fixture/ficticio/demostrativo/temporal, TODO/FIXME, callbacks vacíos, console.log y mecanismos de almacenamiento. La palabra “TODO” en comentarios españoles (“TODO lo que…”) **no es deuda técnica automática**. Un placeholder de input, un catálogo EPS/DIVIPOLA o una respuesta educativa determinista tampoco son por sí mismos datos de negocio falsos.

El anexo C incluye las coincidencias de búsqueda en fuentes, con líneas y conteos, para recorrerlas sin presentar el resultado de una regex como hallazgo confirmado. No es necesario borrar los fixtures de pruebas ni el prototipo para completar entrega. Debe impedirse que módulos operativos usen fuente demo como información real.

## 13. Bugs detectados

23 hallazgos de defecto, riesgo operativo o bloqueo de validación. Los estáticos no se presentan como reproducciones en producción. FORCE pendiente y módulos demo se registran como trabajo faltante, aparte de esta lista.

### BUG-001 — Timeout OIDC interpreta milisegundos como segundos

**Problema:** Timeout OIDC interpreta milisegundos como segundos.

**Archivo(s):** apps/api/src/human-auth/oidc.adapter.ts:108; apps/api/src/human-auth/human-auth.config.ts:405; node_modules/openid-client/build/index.d.ts:836.

**Causa probable:** requestTimeoutMs se pasa directamente a discovery.timeout, cuya unidad instalada es segundos.

**Impacto:** 5000 ms configurados producen 5000 s (83m20s); la UI puede esperar mucho ante proveedor lento. No se ejecutó proveedor real.

**Solución propuesta:** Convertir la unidad conforme al contrato instalado y probar discovery/token/JWKS lentos con timeout real.

**Prioridad:** P1. **Evidencia:** Defecto estático comprobado.

### BUG-002 — Logout institucional no permitido por CORS

**Problema:** Logout institucional no permitido por CORS.

**Archivo(s):** apps/api/src/main.ts:44; apps/api/src/institutional-auth/institutional-auth.controller.ts:214; apps/web/src/features/auth/institutionalSessionClient.ts.

**Causa probable:** Métodos CORS no incluyen DELETE, que sí usa current logout.

**Impacto:** Navegador cross-origin bloquea preflight; no se revoca. Mismo origen de staging no presenta este bloqueo concreto.

**Solución propuesta:** Alinear allowlist con contrato efectivo y prueba OPTIONS + DELETE con credenciales/origen válido e inválido.

**Prioridad:** P1 en web/API cross-origin. **Evidencia:** Defecto estático condicionado a topología.

### BUG-003 — Bundle Docker apunta al fallback de API

**Problema:** Bundle Docker apunta al fallback de API.

**Archivo(s):** apps/web/Dockerfile:26; compose.staging.yml:97; apps/web/src/config/environment.ts:130; .dockerignore:31.

**Causa probable:** NEXT_PUBLIC_MERDN_API_BASE_URL se aporta en runtime, no antes de next build; se excluye .env.

**Impacto:** Imagen construida por receta puede llamar http://127.0.0.1:3001 del usuario en staging HTTPS; rompe datos/auth.

**Solución propuesta:** Definir contrato de URL pública en build o alternativa aprobada; comprobar bundle e imagen HTTPS. No basta cambiar env de contenedor.

**Prioridad:** P1. **Evidencia:** Defecto estático de receta; imagen no ejecutada.

### BUG-004 — Staging no aprovisiona identidades institucionales

**Problema:** Staging no aprovisiona identidades institucionales.

**Archivo(s):** compose.staging.yml:59; .env.staging.example; apps/api/src/institutional-auth/institutional-auth.config.ts:206.

**Causa probable:** No se transmiten variables de secret de municipal/viewer/scheduler; servicio omite identidades sin configuración.

**Impacto:** La receta no permite probar Hospital/Alcaldía con acceso institucional válido.

**Solución propuesta:** Documentar e inyectar aprovisionamiento externo controlado de roles aprobados, con placeholders y sin versionar valores.

**Prioridad:** P1 para hito institucional. **Evidencia:** Brecha de integración de receta.

### BUG-005 — Imagen web no copia public

**Problema:** Imagen web no copia public.

**Archivo(s):** apps/web/Dockerfile:41; apps/web/src/components/ui/BrandLogo.tsx:40; apps/web/public.

**Causa probable:** Solo copia standalone y static.

**Impacto:** Recursos /brand y /eli no están incorporados explícitamente en imagen final; branding/ayuda gráfica quedan incompletos.

**Solución propuesta:** Incluir public en artefacto según layout standalone y probar GET de los recursos en la imagen.

**Prioridad:** P2. **Evidencia:** Defecto estático; Docker no ejecutado.

### BUG-006 — Chequeo runtime puede aprobar FORCE incompleto

**Problema:** Chequeo runtime puede aprobar FORCE incompleto.

**Archivo(s):** scripts/staging/runtime-db-check.mjs:26; spec/specs/025-baseline-pruebas-aislada/spec.md:52.

**Causa probable:** Consulta solo tablas que ya tienen RLS y FORCE y basta que sean no vacías.

**Impacto:** Puede dar PASS con 15 tablas pendientes o una tabla sin RLS; cobertura afirmada mayor que comprobada.

**Solución propuesta:** Cotejar catálogo esperado de 26 tablas/27 policies y flags por tabla; pruebas negativas de una ausencia.

**Prioridad:** P1 de aseguramiento. **Evidencia:** Defecto estático comprobado.

### BUG-007 — Cleanup de fixtures puede borrar territorio local ajeno

**Problema:** Cleanup de fixtures puede borrar territorio local ajeno.

**Archivo(s):** apps/api/test/enrollment-fixtures.ts:108; apps/api/test/test-environment.ts:13; apps/api/test/patient-enrollment.api.test.ts:80.

**Causa probable:** Elimina todos NEIGHBORHOOD/RURAL_SETTLEMENT sin tenant/run-id y acepta DATABASE_URL existente/fallback dev.

**Impacto:** Riesgo de borrar catálogo local si suite se ejecuta en DB compartida. No se ejecutó esa suite.

**Solución propuesta:** Guard de entorno desechable antes de setup/fixtures; delimitar limpieza a datos de ejecución en follow-up aprobado.

**Prioridad:** P1. **Evidencia:** Riesgo destructivo probado por código, no daño observado.

### BUG-008 — Suites alteran rol/triggers globales sin prueba de aislamiento

**Problema:** Suites alteran rol/triggers globales sin prueba de aislamiento.

**Archivo(s):** apps/api/test/runtime-fail-closed.db.test.ts:100; apps/api/test/global-setup.ts:69; apps/api/test/database-availability.ts:84.

**Causa probable:** Renombra merdn_runtime, silencia restauración y desactiva triggers WASM; migrated se infiere solo por tenant.count.

**Impacto:** Puede afectar otro servicio o ocultar base parcialmente migrada; no demuestra cluster test desechable.

**Solución propuesta:** Aislar cluster, verificar identidad/run-id/catalogo antes de mutar y garantizar restitución o cleanup comprobado.

**Prioridad:** P1. **Evidencia:** Riesgo estático; ninguna mutación ejecutada.

### BUG-009 — Cuatro unidades API fallan por contrato de cuarto rol

**Problema:** Cuatro unidades API fallan por contrato de cuarto rol.

**Archivo(s):** apps/api/src/institutional-auth/institutional-auth.unit.test.ts:181; :281; :352; :547.

**Causa probable:** Expectativas todavía asumen tres roles; backend incluye CAREGIVER_RELATIONSHIP_MANAGER.

**Impacto:** 401 aprobadas/4 fallidas. Bloquea baseline verde; no demuestra fallo del login.

**Solución propuesta:** Corrección estrecha de expectativas/listas según spec025 MP11; conservar comportamiento productivo.

**Prioridad:** P1 de release. **Evidencia:** Reproducido en ejecución.

### BUG-010 — Test de branding rechaza literal en otra prueba

**Problema:** Test de branding rechaza literal en otra prueba.

**Archivo(s):** apps/web/src/config/branding.test.tsx:220; apps/web/src/features/hospital/hospitalShell.test.tsx.

**Causa probable:** Allowlist de test de literales no incluye la prueba con literal final.

**Impacto:** 1668 aprobadas/1 fallida; no es un bug visual de marca demostrado.

**Solución propuesta:** Corrección limitada prevista en spec025 MP12, sin exceptuar archivos productivos.

**Prioridad:** P1 de release. **Evidencia:** Reproducido en ejecución.

### BUG-011 — Gate Alcaldía no reacciona a 401/403 del agregado

**Problema:** Gate Alcaldía no reacciona a 401/403 del agregado.

**Archivo(s):** apps/web/src/features/municipality/useMunicipalityAggregate.ts:43; apps/web/src/features/municipality/MunicipalityShell.tsx:571; spec/specs/022-sesion-institucional-alcaldia-mvp/spec.md:78.

**Causa probable:** Error se queda en hook del módulo, sin retirar sesión/contexto del shell.

**Impacto:** Gate/identidad permanecen autorizados; API deniega nuevas lecturas, no se demostró bypass.

**Solución propuesta:** Propagar expiración/no-autorizado, limpiar contexto/agregados y volver a entrada neutral; prueba de interacción con sesión revocada.

**Prioridad:** P1. **Evidencia:** Defecto estático contra spec; browser pendiente.

### BUG-012 — Datos nominales permanecen tras fallo de detalle Hospital

**Problema:** Datos nominales permanecen tras fallo de detalle Hospital.

**Archivo(s):** apps/web/src/features/hospital/HospitalPatients.tsx:293; apps/web/src/features/hospital/HospitalProfessionals.tsx:436; spec/specs/009-hospital-pacientes-api/spec.md:183; spec/specs/010-hospital-profesionales-agenda-api/spec.md:139.

**Causa probable:** Todos errores de detalle se convierten en panel no disponible sin limpiar lista/analítica.

**Impacto:** Datos cargados anteriormente quedan visibles con autorización/servicio perdido; no prueba de lectura nueva ilícita.

**Solución propuesta:** Distinguir 404 de 401/403/503 y retirar todo nominal según contrato; pruebas pacientes y profesionales separadas.

**Prioridad:** P1. **Evidencia:** Defecto estático contra spec.

### BUG-013 — Inscripción modificable mientras envía

**Problema:** Inscripción modificable mientras envía.

**Archivo(s):** apps/web/src/features/inscripcion/InscripcionExperience.tsx:447; :530; apps/web/src/features/inscripcion/inscripcionFlow.ts:1078.

**Causa probable:** Controles de paso/rol/campos no se bloquean durante POST; snapshot enviado y estado actual divergen.

**Impacto:** Confirmación puede mostrar información distinta a persistida o ignorar 201 tras reset.

**Solución propuesta:** Bloquear modificaciones y conservar snapshot; prueba de POST diferido, edición/reset/doble submit.

**Prioridad:** P2. **Evidencia:** Defecto estático; interacción pendiente.

### BUG-014 — Respuesta tardía repuebla estado Paciente tras logout

**Problema:** Respuesta tardía repuebla estado Paciente tras logout.

**Archivo(s):** apps/web/src/features/paciente/PacienteExperience.tsx:296; :759.

**Causa probable:** Bandera de montaje sin epoch/cancelación por revocación permite éxito de petición previa.

**Impacto:** Datos vuelven a memoria sin-sesion; fase los oculta. No afirmar fuga visible demostrada.

**Solución propuesta:** Invalidar generaciones al cerrar/expirar y rechazar éxitos anteriores/no activos; probar red diferida.

**Prioridad:** P2. **Evidencia:** Carrera deducida de código.

### BUG-015 — Visita seleccionada sobrevive cambio institucional

**Problema:** Visita seleccionada sobrevive cambio institucional.

**Archivo(s):** apps/web/src/features/hospital/HospitalShell.tsx:423; :587.

**Causa probable:** Cierre limpia sesión pero no visita/navegación contextual.

**Impacto:** Institución B puede reabrir DTO seleccionado por A; backend conserva barreras. No se demostró acceso cruzado.

**Solución propuesta:** Limpiar DTO/contexto al cierre/cambio confirmado; prueba A→logout→B.

**Prioridad:** P2. **Evidencia:** Defecto estático de estado contextual.

### BUG-016 — Buscador desaparece en cada consulta

**Problema:** Buscador desaparece en cada consulta.

**Archivo(s):** apps/web/src/features/hospital/HospitalPatients.tsx:193; :375; apps/web/src/features/hospital/HospitalProfessionals.tsx:351; :498.

**Causa probable:** Loading retorna pantalla sin controles y desmonta input después del debounce.

**Impacto:** Pérdida de foco y dificultad para seguir escribiendo con pausas/teclado.

**Solución propuesta:** Mantener controles, cargar solo resultados, aria-busy; probar input/foco y respuestas fuera de orden.

**Prioridad:** P2. **Evidencia:** Defecto estático de interacción.

### BUG-017 — Dialog modal paciente permite foco fuera

**Problema:** Dialog modal paciente permite foco fuera.

**Archivo(s):** apps/web/src/features/hospital/HospitalPatientsPieces.tsx:1287.

**Causa probable:** aria-modal=true y Escape, sin trap de Tab/fondo inerte.

**Impacto:** Teclado alcanza controles detrás del modal. El cierre sí devuelve foco al abridor.

**Solución propuesta:** Confinar foco y fondo según comportamiento modal; prueba Tab/Shift+Tab/Escape y lector de pantalla.

**Prioridad:** P2 accesibilidad. **Evidencia:** Omisión estática; QA accesible pendiente.

### BUG-018 — Auditoría de denegación self se revierte

**Problema:** Auditoría de denegación self se revierte.

**Archivo(s):** apps/api/src/patient-self/patient-self.service.ts:125.

**Causa probable:** Se inserta denegación dentro de withTenant y se lanza excepción inmediatamente.

**Impacto:** Si la segunda consulta deja de resolver la fila propia por un cambio concurrente, el rollback elimina el evento; el acceso sigue denegado. Rama excepcional no reproducida contra DB.

**Solución propuesta:** Separar confirmación auditada de propagación del error sin permitir datos ni falso éxito; prueba de carrera.

**Prioridad:** P2. **Evidencia:** Defecto estático transaccional.

### BUG-019 — Respuestas inscripción sin encabezado no-store explícito

**Problema:** Respuestas inscripción sin encabezado no-store explícito.

**Archivo(s):** apps/api/src/patients/patient-enrollment.controller.ts:119; :164.

**Causa probable:** Controlador no fija Cache-Control private/no-store y Vary Cookie a diferencia de otras superficies.

**Impacto:** El caching efectivo depende de navegador/proxy; potencial conservación de resumen personal.

**Solución propuesta:** Fijar política coherente y probar headers en respuesta/recuperación/back de dispositivo compartido.

**Prioridad:** P2 privacidad. **Evidencia:** Omisión estática; efecto no comprobado.

### BUG-020 — Cuotas por IP de proxy y logout humano sujeto a bucket de login

**Problema:** Cuotas por IP de proxy y logout humano sujeto a bucket de login.

**Archivo(s):** infra/staging/Caddyfile:11; apps/api/src/main.ts:25; apps/api/src/institutional-auth/institutional-signin-rate-limit.guard.ts:38; apps/api/src/human-auth/human-auth-rate-limit.guard.ts:44; apps/api/src/human-auth/human-auth.controller.ts:235.

**Causa probable:** request.ip sin trust proxy acotado comparte dirección Caddy; humano login/callback/logout comparten guard.

**Impacto:** Un cliente consume cuota de todos y exceso puede impedir cerrar sesión; reproducción proxy pendiente.

**Solución propuesta:** Diseñar confianza limitada y resistencia a cabecera falsa; preservar revocación bajo cuota y probar dos clientes/bucket agotado.

**Prioridad:** P1 en staging. **Evidencia:** Defecto estático de composición.

### BUG-021 — Agenda usa día local y ventana UTC

**Problema:** Agenda usa día local y ventana UTC.

**Archivo(s):** apps/web/src/features/hospital/hospitalAgendaClient.ts:113; :168; spec/specs/010-hospital-profesionales-agenda-api/spec.md:255.

**Causa probable:** Selección y presentación local combinadas con corte de día UTC.

**Impacto:** 19:00 Colombia pertenece al día UTC siguiente; cita puede no aparecer en fecha esperada. No es nueva regresión.

**Solución propuesta:** Aprobar zona institucional y alinear query/presentación/asignación; bordes fin mes y dispositivo otra zona.

**Prioridad:** P2 decisión ya documentada. **Evidencia:** Limitación explícita del contrato actual.

### BUG-022 — Build web requiere descarga no disponible

**Problema:** Build web requiere descarga no disponible.

**Archivo(s):** apps/web/src/app/layout.tsx:1; :15.

**Causa probable:** next/font/google obtiene Nunito durante build; red actual no permitió fonts.googleapis.com.

**Impacto:** Build productivo web FAIL en esta auditoría; no se concluye que falle con conectividad correcta.

**Solución propuesta:** Asegurar build reproducible con fuente local/licencia aprobada o acceso de build controlado, sin omitir comprobación.

**Prioridad:** P1 de verificación/build. **Evidencia:** Reproducido; limitación de red del entorno.

### BUG-023 — Fuentes SDD contradicen consentimiento/pausa/progreso

**Problema:** Fuentes SDD contradicen consentimiento/pausa/progreso.

**Archivo(s):** spec/specs/INDEX.md:48; spec/specs/021-paciente-mvp-operativo/spec.md:11; spec/.sdd/user-consent.log; spec/bitacora/handoffs/STATE.md; origin/develop:spec/bitacora/handoffs/TO-CLAUDE.md.

**Causa probable:** Índice/spec antigua dicen sin consentimiento y cero código; log lo registra; 025 no está en índice; pausa posterior en tracking.

**Impacto:** Gate estructural abierto no permite elegir qué implementación ejecutar ni certificar entrega.

**Solución propuesta:** Reconciliar por evidencia y PO; no borrar consentimiento ni ejecutar reset sugerido por framework. No reanudar por esta auditoría.

**Prioridad:** P1 de gobierno antes de nueva ejecución. **Evidencia:** Contradicción documental comprobada.

## 14. Plan de implementación por fases

Este plan ordena el trabajo futuro; la ejecución corresponde a Claude Code bajo specs suficientes y aprobadas. Codex revisa la evidencia. La aceptación y la reanudación corresponden al Product Owner. Los tiempos de spec025 son topes por micropaquete, no estimaciones de entrega de toda la plataforma.

| Fase | Resultado que debe quedar comprobado | Tareas y puerta de salida |
|---|---|---|
| 0 — Autoridad y alcance | Snapshot aceptado, pausa reconciliada, contrato del hito y fuente canónica consistentes | GOV-001–004. No ejecutar handoff antiguo ni sincronizar Git por inferencia. |
| 1 — Baseline aislada y datos | PostgreSQL desechable, guard anti-entorno, FORCE de las 15 tablas y evidencia 22+1 completa | COMP-001; BASE-001–014; COMP-002; BASE-015–042. Mantener orden MP01→MP42 y aceptación individual. |
| 2 — Correcciones del núcleo | Timeout/login/logout, retiro de datos al perder autorización, carreras, foco y errores coherentes | FIX-001–012 y FIX-014–020. FIX-013 fue descartada al comprobar que PatientStatus solo admite ACTIVE; no se conserva una tarea sin defecto actual. |
| 3 — Imagen y operación | Bundle con API correcta, assets, identidades, fonts reproducibles y catálogo completo | OPS-001–008. Build y smoke de imagen exacta; restauración en entorno desechable, sin deploy productivo. |
| 4 — Aceptación del hito | Inscripción, OIDC, institución, hospital, municipio, agenda y visita probados en navegador/DB | QA-001–011. QA-010 acepta exclusivamente el hito definido en GOV-002. |
| 5 — Ciclos de personas e instituciones | Altas/cambios/archivo aprobados, cuidador y profesional conectados, configuración y worklist independientes | PAT, REL, PRO, AGD, VIS, INST. Cada dominio mantiene permisos, contexto, auditoría y pruebas A/B. |
| 6 — Programas y evidencia | Programas persistidos y soportes privados/versionados, con búsqueda y lectura autorizadas | PRG, EVI. Elegir storage/retención/autorización antes de escribir integración. |
| 7 — Finanzas, Hub e indicadores | Presupuesto/movimiento/soporte trazables; marcos y fórmulas con fuente/periodo/versiones | FIN, HUB. No inventar contabilidad oficial, puntuaciones FURAG/MIPG ni evaluaciones ADRES. |
| 8 — Servicios, formación y comunicación | Servicios/planes/membresías, consulta virtual controlada, formación y alertas aprobadas | COM, TRN, NOT. Pagos permanecen referencias/manuales salvo autorización separada de procesamiento. |
| 9 — Información clínica, reportes y entrega integral | Datos clínicos autorizados, bitácora, reportes/exportación y asistencia educativa trazables | CLN, REP, ISA y repetición de QA para capacidades activadas. REP-004 verifica cada módulo antes de aceptación integral. |

La fase 4 puede cerrar un hito operativo formalmente definido; no cierra automáticamente las fases 5–9. Para el objetivo integral del documento de auditoría, todo módulo existente incluido en entrega debe sustituir fixtures por cadenas operativas aprobadas y verificadas. Mientras tanto, lo demostrativo conserva rótulo explícito y no se ofrece como función operativa.

### 14.1 Decisiones necesarias antes de los dominios pendientes

| Decisión del Product Owner | Alternativas y efecto | Recomendación de auditoría |
|---|---|---|
| Alcance del hito vs entrega integral | Hito de slices ya aprobados o activación integral por fases | Cerrar primero seguridad/baseline del núcleo y mantener completo el backlog estratégico. No rebajar el producto a cuidado domiciliario. |
| Alta humana después de inscripción | Aprovisionamiento controlado existente o lifecycle de autoservicio aprobado | Mantener separación inscripción/cuenta; diseñar validación y recuperación antes de autorregistro. |
| Identidad de trabajador institucional | Credencial impersonal limitada existente o cuenta humana con delegación por institución | Mantener alcance actual explícito; delegación individual requiere spec y trazabilidad, no convertir un perfil visual en permiso. |
| Cambio/desactivación/archivo de registros | Archivo/versionado o eliminación física controlada por retención | Priorizar historial y revocación efectiva; no añadir DELETE genérico a consentimiento, auditoría o visitas append-only. |
| FORCE vs CLI administrativo | Bootstrap con contexto confiable o acceso administrativo formalmente acotado | Verificar COMP-001 antes de MP04; no compensar con superuser/BYPASSRLS ni cambiar silenciosamente la allowlist025. |
| Zona/fechas de agenda | UTC visible o zona institucional explícita | Aprobar zona/cortes y presentar fechas coherentes; no introducir política territorial por suposición. |
| Evidencia y almacenamiento | Puerto privado local/staging o proveedor aprobado | Aprobar ownership, acceso, retención, validación, hashes y restauración antes de conectar uploads. |
| Indicadores/normativa/clinica | Fuente controlada/manual o integración autorizada | Versionar fuentes, fórmulas y evidencia; no declarar validación oficial o clínica por fixtures. |
| Finanzas y pagos | Referencias/documentos controlados o procesamiento futuro separado | Conectar trazabilidad existente sin atribuir funciones de contabilidad gubernamental ni activar pagos por esta auditoría. |
| Soporte administrativo MP02 | Mantener solo fundación o exponer acceso temporal aprobado | No abrir panel de superadministrador ni acceso entre tenants sin grant/contexto aprobado. |

## 15. Catálogo de tareas pequeñas y dependencias

Cada fila es una unidad propuesta con objetivo, dependencias, archivos existentes y aceptación mínima. Las rutas son **referencias verificadas**, no permisos de escritura. Para componentes nuevos aún inexistentes se señala la spec o el componente/modelo actual: sus nombres y allowlists se definirán en la Task Specification, sin inventarlos en este informe.

Toda tarea que cambie producción hereda: inspección previa; spec suficiente según CLAUDE.md §8; decisiones materiales aprobadas; datos ficticios; autorización servidor; tenant/contexto; auditoría; prueba positiva y negativa; errores; compatibilidad/rollback; devolución de diff, checks y evidencia a Codex. Un PASS unitario aislado no cierra una tarea de integración.

Las tareas de diseño son contratos previos; las tareas de implementación siguientes siguen condicionadas a su aprobación. No se debe abrir una tarea global que implemente todos los contratos en GOV-004: ese ID representa el trabajo de gobierno para producir **specs separadas**. PRG/FIN/HUB/COM y otros dominios trabajan sobre capacidades ya representadas; su comportamiento pendiente es una decisión abierta, no una regla inventada.

BASE-001–042 trasladan **los 42 micropaquetes existentes de spec025**, no añaden otros 42 cambios de producto. La línea de plan.md identifica el paquete y su allowlist canónica. Los archivos nuevos previstos allí siguen siendo prospectivos; no se presentan como ya existentes. Cada paquete exige resultado/aceptación antes del siguiente; MP01 no está certificado por la mera existencia de compose.test.yml.


**Total: 177 tareas**, 86 de cierre del hito/baseline y 91 de evolución integral condicionada. No equivalen a 177 bugs ni a 177 autorizaciones.

### 15.1 Cierre del hito y baseline

| ID | Prioridad | Objetivo individual | Depende de | Archivos existentes / referencia | Aceptación mínima |
|---|---|---|---|---|---|
| GOV-001 | P0 | Reconciliar snapshot local, siete commits de tracking y pausa vigente; fijar la base de auditoría/ejecución aceptada. | — | spec/bitacora/handoffs/STATE.md; spec/bitacora/handoffs/TO-CLAUDE.md; spec/bitacora/handoffs/TO-CODEX.md | HEAD y orden PO identificados; sin sync ni reanudación implícitos. |
| GOV-002 | P0 | Definir el contrato de entrega del hito: slices operativos, demostrativos declarados y backlog integral protegido. | GOV-001 | docs/PRODUCT.md; docs/MODULES.md; docs/ROLES.md | Matriz aceptada por PO sin borrar capacidades estratégicas ni exigir pago/diagnóstico no aprobado. |
| GOV-003 | P1 | Reconciliar INDEX/spec021/handoffs con consentimiento real y código; añadir trazabilidad de 025 sin fabricar aprobaciones. | GOV-001 | spec/specs/INDEX.md; spec/specs/021-paciente-mvp-operativo/spec.md; spec/bitacora/handoffs/STATE.md | Estado/consentimiento y paquetes coherentes; archivos históricos intactos. |
| GOV-004 | P1 | Preparar specs de corrección por allowlist y aprobar decisiones materiales; mantener ejecución Claude secuencial. | GOV-002, GOV-003 | spec/specs/_template/spec.md; spec/specs/_template/plan.md; spec/specs/_template/tasks.md; CLAUDE.md | Cada tarea tiene contrato §8, aceptación, datos, permisos, auditoría y pruebas; gate/consentimiento según tarea. |
| COMP-001 | P1 | Revisar bootstrap del CLI y DML administrativo frente a FORCE; elegir estrategia con tenant confiable sin bypass. | GOV-004 | tools/identity-provisioning/src/database.ts; spec/specs/025-baseline-pruebas-aislada/spec.md | Prueba/plan preserva owner sujeto a RLS; si excede allowlist025, STOP y follow-up aprobado. |
| COMP-002 | P1 | Verificar compatibilidad LINK/UNLINK/DISABLE bajo catálogo FORCE y sin contexto residual. | BASE-014, COMP-001 | tools/identity-provisioning/src/database.ts; tools/identity-provisioning/src/operations.ts; tools/identity-provisioning/src/operations.test.ts | Operaciones aprobadas funcionan en DB aislada con privilegios previstos; no super/BYPASS improvisado. |
| FIX-001 | P1 | Corregir conversión ms→s en adapter OIDC y prueba de proveedor lento. | BASE-042, GOV-004 | apps/api/src/human-auth/oidc.adapter.ts; apps/api/src/human-auth/human-auth.config.test.ts | BUG-001: timeout efectivo coincide con configuración y error seguro en discovery/token/JWKS. |
| FIX-002 | P1 | Incluir método DELETE autorizado en CORS y probar logout institucional cross-origin. | BASE-042, GOV-004 | apps/api/src/main.ts; apps/api/test/hospital-institutional-auth.api.test.ts | BUG-002: OPTIONS permite origen válido/DELETE; revocación real y origen falso denegado. |
| FIX-003 | P1 | Propagar 401/403 municipal al gate y retirar contexto/agregados. | BASE-042, GOV-004 | apps/web/src/features/municipality/useMunicipalityAggregate.ts; apps/web/src/features/municipality/MunicipalityShell.tsx; apps/web/src/features/municipality/municipalitySession.test.tsx | BUG-011: revocación vuelve a entrada neutral sin datos anteriores. |
| FIX-004 | P1 | Limpiar listado/analytics Pacientes ante fallo sensible de detalle. | BASE-042, GOV-004 | apps/web/src/features/hospital/HospitalPatients.tsx; apps/web/src/features/hospital/hospitalPatients.test.tsx | BUG-012: 401/403/503 no dejan nominal; 404 tratado según contrato. |
| FIX-005 | P1 | Limpiar listado/detalle Profesionales ante fallo sensible de autorización/servicio. | BASE-042, GOV-004 | apps/web/src/features/hospital/HospitalProfessionals.tsx; apps/web/src/features/hospital/hospitalProfessionals.test.tsx | BUG-012: lista no queda visible tras respuesta denegada. |
| FIX-006 | P2 | Bloquear paso/rol/campos y conservar snapshot mientras inscripción envía. | BASE-042, GOV-004 | apps/web/src/features/inscripcion/InscripcionExperience.tsx; apps/web/src/features/inscripcion/inscripcionFlow.ts; apps/web/src/features/inscripcion/envioInscripcion.test.ts | BUG-013: POST diferido y reset/doble click no producen confirmación distinta al payload. |
| FIX-007 | P2 | Invalidar lecturas Paciente al cerrar/expirar sesión y rechazar respuesta tardía. | BASE-042, GOV-004 | apps/web/src/features/paciente/PacienteExperience.tsx; apps/web/src/features/paciente/pacienteExperience.dom.test.tsx | BUG-014: logout confirmado deja estado sin PHI aunque finalicen requests anteriores. |
| FIX-008 | P2 | Limpiar visita/navegación contextual al cambiar/cerrar identidad institucional. | BASE-042, GOV-004 | apps/web/src/features/hospital/HospitalShell.tsx; apps/web/src/features/hospital/hospitalShell.test.tsx | BUG-015: identidad B no conserva DTO de A; backend y sesión humana siguen disjuntos. |
| FIX-009 | P2 | Mantener buscador/filtros Pacientes montados durante carga. | FIX-004 | apps/web/src/features/hospital/HospitalPatients.tsx; apps/web/src/features/hospital/hospitalPatients.test.tsx | BUG-016: debounce no quita foco; loading/empty/error/orden/página correctos. |
| FIX-010 | P2 | Mantener buscador/filtros Profesionales montados durante carga. | FIX-005 | apps/web/src/features/hospital/HospitalProfessionals.tsx; apps/web/src/features/hospital/hospitalProfessionals.test.tsx | BUG-016: escribir lento conserva foco y resultados coherentes. |
| FIX-011 | P2 | Completar confinamiento de foco del modal Paciente. | FIX-004 | apps/web/src/features/hospital/HospitalPatientsPieces.tsx; apps/web/src/features/hospital/hospitalPatients.test.tsx | BUG-017: Tab/Shift+Tab/Escape, fondo inerte y retorno de foco verificados. |
| FIX-012 | P2 | Persistir denegación self concurrente antes de propagar error. | BASE-042, GOV-004 | apps/api/src/patient-self/patient-self.service.ts; apps/api/src/patient-self/patient-self.service.test.ts; apps/api/test/patient-self.db.test.ts | BUG-018: segunda lectura sin fila propia no devuelve resumen y evento no se pierde por rollback; caso concurrente controlado. |
| FIX-014 | P2 | Añadir política de cache coherente al recibo/inscripción. | BASE-042, GOV-004 | apps/api/src/patients/patient-enrollment.controller.ts; apps/api/test/patient-enrollment.api.test.ts | BUG-019: headers no-store/private y separación cookie comprobados. |
| FIX-015 | P1 | Definir confianza acotada de proxy y separación real de cuotas por cliente. | BASE-042, GOV-004 | apps/api/src/main.ts; apps/api/src/human-auth/human-auth-rate-limit.guard.ts; apps/api/src/institutional-auth/institutional-signin-rate-limit.guard.ts; infra/staging/Caddyfile | BUG-020: dos clientes no comparten cuota; forwarding falso no concede evasión. |
| FIX-016 | P1 | Permitir revocación humana segura cuando cuota de login esté agotada. | FIX-015 | apps/api/src/human-auth/human-auth.controller.ts; apps/api/src/human-auth/human-auth-rate-limit.guard.ts; apps/api/test/human-auth.api.test.ts | BUG-020: logout revoca aun con abuso de login, preservando origen/auditoría. |
| FIX-017 | P2 | Aprobar zona institucional/cortes y criterio de fecha para agenda. | GOV-004 | docs/ARCHITECTURE.md; spec/specs/010-hospital-profesionales-agenda-api/spec.md | Decisión específica de timezone y contratos; no usar zona del dispositivo como autoridad silenciosa. |
| FIX-018 | P2 | Alinear ventana/visualización/asignación con decisión de agenda. | BASE-042, FIX-017 | apps/web/src/features/hospital/hospitalAgendaClient.ts; apps/api/src/hospital/hospital-agenda.query.ts; apps/web/src/features/hospital/hospitalAgendaClient.test.ts | BUG-021: bordes 19:00 Colombia/fin mes y otro dispositivo pasan. |
| FIX-019 | P2 | Rotular todos módulos/acciones demo de manera visible y accesible dentro de shell autenticado. | GOV-004 | apps/web/src/features/hospital/HospitalAlerts.tsx; apps/web/src/features/hospital/HospitalUpdates.tsx; apps/web/src/features/hospital/HospitalVirtualConsultations.tsx; apps/web/src/features/hospital/HospitalRatings.tsx; apps/web/src/features/hospital/HospitalShell.tsx | Sin promesas de alarmas automáticas/WhatsApp/consulta real ni botones engañosos; conservar fidelidad aprobada. |
| FIX-020 | P2 | Aclarar campos Paciente excluidos del contrato y separar inscripción de cuenta en copy. | GOV-004 | apps/web/src/features/inscripcion/InscripcionExperience.tsx; apps/web/src/features/inscripcion/steps/PasosPaciente.tsx; apps/web/src/features/inscripcion/patientEnrollmentClient.ts | Usuario entiende qué se guarda y que necesita acceso OIDC; no se amplía dataset sensible. |
| OPS-001 | P1 | Fijar URL pública de API al compilar imagen web y probar bundle. | BASE-042, GOV-004 | apps/web/Dockerfile; compose.staging.yml; apps/web/src/config/environment.ts; docs/runbooks/STAGING_DEPLOYMENT.md | BUG-003: navegador HTTPS llama API aprobada, nunca loopback/fallback del visitante. |
| OPS-002 | P2 | Empaquetar recursos public en imagen standalone y comprobar logo/Elí. | GOV-004 | apps/web/Dockerfile; apps/web/public/brand/corazon-check.png; apps/web/public/eli/saluda2.png | BUG-005: rutas asset responden y aparecen sin secretos ni cambios al prototipo. |
| OPS-003 | P1 | Completar configuración/provisionamiento externo institucional de staging por roles aprobados. | GOV-004 | compose.staging.yml; .env.staging.example; docs/runbooks/STAGING_DEPLOYMENT.md; apps/api/src/institutional-auth/institutional-auth.config.ts | BUG-004: viewer municipal/hospital y scheduler utilizables sin credenciales en Git. |
| OPS-004 | P1 | Hacer check staging del catálogo RLS/FORCE/policies completo, no solo subconjunto. | BASE-042, GOV-004 | scripts/staging/runtime-db-check.mjs; tests/staging/staging-tools.test.mts | BUG-006: falta de cualquiera de 26/27 produce FAIL; owners/flags seguros. |
| OPS-005 | P1 | Resolver reproducibilidad de Nunito en build sin depender de descarga no controlada. | GOV-004 | apps/web/src/app/layout.tsx; apps/web/Dockerfile; docs/runbooks/STAGING_DEPLOYMENT.md | BUG-022: build web pasa en entorno aprobado con fuente/licencia y resultado visual conservados. |
| OPS-006 | P1 | Construir y probar imagen exacta API/web desde checkout limpio. | OPS-001, OPS-002, OPS-003, OPS-004, OPS-005, FIX-001, FIX-002, FIX-015, FIX-016 | apps/api/Dockerfile; apps/web/Dockerfile; compose.staging.yml; scripts/staging/smoke.mjs | Artefactos por digest: assets/API/cookies/proxy funcionan; requiere autorización aparte para desplegar. |
| OPS-007 | P1 | Ensayar backup/restore coordinado de DB aplicación e identidad en entorno desechable. | BASE-042, GOV-004 | scripts/staging/backup-postgres.ps1; scripts/staging/restore-postgres.ps1; docs/runbooks/STAGING_DEPLOYMENT.md | Integridad y custodia cifrada externa documentadas; restauración IdP/app coherente; no restore sobre datos existentes. |
| OPS-008 | P2 | Documentar readiness efectiva de DB/tenant/IdP y recuperación operativa del hito. | OPS-006, OPS-007 | apps/api/src/health/health.service.ts; scripts/staging/smoke.mjs; docs/runbooks/STAGING_DEPLOYMENT.md | Liveness verde no se presenta como aceptación de negocio; fallas y responsables verificables. |
| QA-001 | P1 | Verificar inscripción mínima contra DB aislada, recovery/refresh/errores y payload exacto. | BASE-042, FIX-006, FIX-014, FIX-020 | apps/api/test/patient-enrollment.api.test.ts; apps/api/test/patient-enrollment.db.test.ts; apps/web/src/features/inscripcion/envioInscripcion.test.ts | Crear→commit→UI→consulta posterior comprobados; sin datos reales ni cuenta automática. |
| QA-002 | P1 | Validar login OIDC real, expiración, refresh y logout en navegador controlado. | BASE-042, FIX-001, FIX-007, FIX-016, OPS-006 | apps/api/test/human-auth.api.test.ts; apps/web/src/features/experiencia/restauracionSesion.test.tsx; apps/web/src/features/paciente/pacienteExperience.dom.test.tsx | Cookies reales/redirect/claims/revocación y respuesta tardía pasan; mocks no sustituyen este recorrido. |
| QA-003 | P1 | Validar origen/CORS/login/logout institucional con Hospital y Alcaldía. | FIX-002, FIX-003, OPS-006 | apps/api/test/hospital-institutional-auth.api.test.ts; apps/api/test/municipality.api.test.ts; apps/web/src/features/municipality/municipalitySession.test.tsx | Guard disjunto y cierre real con preflight y proxy; sesión no se oculta si revocación falla. |
| QA-004 | P1 | Completar matriz autorización y aislamiento A/B en imagen runtime real. | BASE-042, OPS-004, OPS-006 | apps/api/test/core-01-hardening.db.test.ts; apps/api/test/runtime-fail-closed.db.test.ts; apps/api/test/patient-self.db.test.ts; apps/api/test/hospital-patients.api.test.ts | Dos tenants y sujetos propios/ajenos, asignación/relación revocadas, owner y pool sin contexto residual. |
| QA-005 | P1 | Validar filtros/paginación/empty/error y limpieza nominal de Pacientes/Profesionales. | FIX-004, FIX-005, FIX-009, FIX-010, FIX-011, OPS-006 | apps/web/src/features/hospital/hospitalPatients.test.tsx; apps/web/src/features/hospital/hospitalProfessionals.test.tsx; apps/api/test/hospital-patients.api.test.ts; apps/api/test/hospital-professionals.api.test.ts | Combinaciones, páginas fuera rango y teclado/modal probados en navegador/DB. |
| QA-006 | P1 | Validar Agenda→assignment→materialize→visita→transiciones con dos sesiones reales. | FIX-008, FIX-018, OPS-006 | apps/api/test/hospital-agenda.api.test.ts; apps/api/test/visits.api.test.ts; apps/web/src/features/hospital/hospitalOperaciones.test.tsx | Conflicto optimistic, audit atómica, doble click/retry/recarga y contexto A/B comprobados. |
| QA-007 | P1 | Validar Población/Territorio agregados, supresión y expiración en navegador. | FIX-003, OPS-006 | apps/api/test/municipality-aggregates.db.test.ts; apps/web/src/features/municipality/MunicipalityPopulation.test.tsx; apps/web/src/features/municipality/MunicipalityTerritory.test.tsx | No nominal ni fallback; grupos pequeños tratados según contrato; 401 retira contexto. |
| QA-008 | P1 | Auditar accesibilidad integral del slice, no solo atributos HTML estáticos. | QA-001, QA-002, QA-003, QA-005, QA-006, QA-007 | docs/SECURITY.md; apps/web/src/components/ui/Field.tsx; apps/web/src/components/ui/Choice.tsx; apps/web/src/app/globals.css | Teclado, focus, anuncios/errores, contraste, responsive y estados sin color como única señal. |
| QA-009 | P0 | Consolidar suites/build/scan/gates sin skips ni resultados de otro HEAD. | QA-001, QA-002, QA-003, QA-004, QA-005, QA-006, QA-007, QA-008, FIX-012, OPS-008 | package.json; tests/README.md; spec/bitacora/handoffs/CODEX-REVIEW.md | Misma huella de commit/run-id, 22+1 y navegador; bugs críticos cerrados, riesgo residual explícito. |
| QA-010 | P0 | Preparar aceptación PO por rol/capacidad y runbook de entrega del hito. | QA-009, GOV-002 | docs/runbooks/STAGING_DEPLOYMENT.md; spec/bitacora/handoffs/STATE.md; spec/bitacora/handoffs/CODEX-REVIEW.md | PO acepta alcance demostrativo/operativo por separado; sin declarar producto integral 100%. |
| QA-011 | P2 | Definir automatización CI repetible y matriz de regresión del hito antes de ampliar módulos. | QA-009, GOV-004 | package.json; tests/README.md; docs/ARCHITECTURE.md | Plan/contrato aprobado de CI con DB test aislada y navegador; no cron/relay/deploy automático sin aprobación. |
| BASE-001 | P0 | Spec025 MP01: Topología test | GOV-003 | spec/specs/025-baseline-pruebas-aislada/plan.md:26 | Cero referencia demo/staging/prod y sin secretos |
| BASE-002 | P0 | Spec025 MP02: Guard anti-entorno | BASE-001 | spec/specs/025-baseline-pruebas-aislada/plan.md:27 | Rechazo fail-closed antes de Docker |
| BASE-003 | P0 | Spec025 MP03: Pruebas del guard | BASE-002 | spec/specs/025-baseline-pruebas-aislada/plan.md:28 | Todos los negativos fallan sin comando destructivo |
| BASE-004 | P0 | Spec025 MP04: Migración FORCE forward | BASE-003, COMP-001 | spec/specs/025-baseline-pruebas-aislada/plan.md:29 | SQL acotado, sin DML/history/schema/policy/grant |
| BASE-005 | P0 | Spec025 MP05: Prueba catálogo FORCE | BASE-004 | spec/specs/025-baseline-pruebas-aislada/plan.md:30 | 26 ENABLE+FORCE, runtime seguro, negativos cross-tenant |
| BASE-006 | P0 | Spec025 MP06: Runbook remediación | BASE-005 | spec/specs/025-baseline-pruebas-aislada/plan.md:31 | Sin down improvisado/BYPASS/disabled |
| BASE-007 | P0 | Spec025 MP07: Provision test DB | BASE-006 | spec/specs/025-baseline-pruebas-aislada/plan.md:32 | Identidad server-side y migración completa |
| BASE-008 | P0 | Spec025 MP08: Preflight runtime/RLS | BASE-007 | spec/specs/025-baseline-pruebas-aislada/plan.md:33 | enforce y catálogo/conducta PASS |
| BASE-009 | P0 | Spec025 MP09: Cleanup test DB | BASE-008 | spec/specs/025-baseline-pruebas-aislada/plan.md:34 | Cero recursos test; nunca target ambiguo |
| BASE-010 | P0 | Spec025 MP10: Pruebas lifecycle | BASE-009 | spec/specs/025-baseline-pruebas-aislada/plan.md:35 | Fallos seguros y cleanup verificable |
| BASE-011 | P0 | Spec025 MP11: Stale cuarto rol | BASE-010 | spec/specs/025-baseline-pruebas-aislada/plan.md:36 | Unit focal verde; diff sin producto |
| BASE-012 | P0 | Spec025 MP12: Stale branding | BASE-011 | spec/specs/025-baseline-pruebas-aislada/plan.md:37 | Web focal verde; ningún productivo exceptuado |
| BASE-013 | P0 | Spec025 MP13: Runner baseline | BASE-012 | spec/specs/025-baseline-pruebas-aislada/plan.md:38 | Matriz exacta y códigos inequívocos |
| BASE-014 | P0 | Spec025 MP14: Pruebas runner | BASE-013 | spec/specs/025-baseline-pruebas-aislada/plan.md:39 | Ningún falso verde |
| BASE-015 | P0 | Spec025 MP15: Provisionar corrida | BASE-014, COMP-002 | spec/specs/025-baseline-pruebas-aislada/plan.md:49 | Guard + up + readiness + 13 migraciones + preflight; PASS sin demo |
| BASE-016 | P0 | Spec025 MP16: Typecheck global | BASE-015 | spec/specs/025-baseline-pruebas-aislada/plan.md:50 | `npm run typecheck`; exit 0 |
| BASE-017 | P0 | Spec025 MP17: Unitarias API no DB + health general | BASE-016 | spec/specs/025-baseline-pruebas-aislada/plan.md:51 | stage exacto, cero DB-gated/skip, exit 0 |
| BASE-018 | P0 | Spec025 MP18: Suite web | BASE-017 | spec/specs/025-baseline-pruebas-aislada/plan.md:52 | todas web, exit 0 |
| BASE-019 | P0 | Spec025 MP19: OpenAPI `+1` | BASE-018 | spec/specs/025-baseline-pruebas-aislada/plan.md:53 | solo `openapi.test.ts`, exit 0 |
| BASE-020 | P0 | Spec025 MP20: `cold-start-auth.api.test.ts` | BASE-019 | spec/specs/025-baseline-pruebas-aislada/plan.md:54 | suite ejecutada, cero skip, enforce |
| BASE-021 | P0 | Spec025 MP21: `core-01-hardening.db.test.ts` | BASE-020 | spec/specs/025-baseline-pruebas-aislada/plan.md:55 | suite ejecutada, catálogo/owner/cross-tenant PASS |
| BASE-022 | P0 | Spec025 MP22: `eloisa-admin-support-foundation.db.test.ts` | BASE-021 | spec/specs/025-baseline-pruebas-aislada/plan.md:56 | suite ejecutada, cero skip |
| BASE-023 | P0 | Spec025 MP23: `hospital-agenda.api.test.ts` | BASE-022 | spec/specs/025-baseline-pruebas-aislada/plan.md:57 | suite ejecutada bajo enforce |
| BASE-024 | P0 | Spec025 MP24: `hospital-core-02.db.test.ts` | BASE-023 | spec/specs/025-baseline-pruebas-aislada/plan.md:58 | suite ejecutada, cero skip |
| BASE-025 | P0 | Spec025 MP25: `hospital-institutional-auth.api.test.ts` | BASE-024 | spec/specs/025-baseline-pruebas-aislada/plan.md:59 | suite ejecutada bajo enforce |
| BASE-026 | P0 | Spec025 MP26: `hospital-patients.api.test.ts` | BASE-025 | spec/specs/025-baseline-pruebas-aislada/plan.md:60 | suite ejecutada bajo enforce |
| BASE-027 | P0 | Spec025 MP27: `hospital-professionals.api.test.ts` | BASE-026 | spec/specs/025-baseline-pruebas-aislada/plan.md:61 | suite ejecutada bajo enforce |
| BASE-028 | P0 | Spec025 MP28: `human-auth.api.test.ts` | BASE-027 | spec/specs/025-baseline-pruebas-aislada/plan.md:62 | suite ejecutada bajo enforce |
| BASE-029 | P0 | Spec025 MP29: `identity-professional-assignment.db.test.ts` | BASE-028 | spec/specs/025-baseline-pruebas-aislada/plan.md:63 | suite ejecutada, cero skip |
| BASE-030 | P0 | Spec025 MP30: `municipality.api.test.ts` | BASE-029 | spec/specs/025-baseline-pruebas-aislada/plan.md:64 | suite ejecutada bajo enforce |
| BASE-031 | P0 | Spec025 MP31: `municipality-aggregates.db.test.ts` | BASE-030 | spec/specs/025-baseline-pruebas-aislada/plan.md:65 | suite ejecutada, cero skip |
| BASE-032 | P0 | Spec025 MP32: `patient-enrollment.api.test.ts` | BASE-031 | spec/specs/025-baseline-pruebas-aislada/plan.md:66 | suite ejecutada bajo enforce |
| BASE-033 | P0 | Spec025 MP33: `patient-enrollment.db.test.ts` | BASE-032 | spec/specs/025-baseline-pruebas-aislada/plan.md:67 | suite ejecutada, cero skip |
| BASE-034 | P0 | Spec025 MP34: `patient-self.api.test.ts` | BASE-033 | spec/specs/025-baseline-pruebas-aislada/plan.md:68 | suite ejecutada bajo enforce |
| BASE-035 | P0 | Spec025 MP35: `patient-self.db.test.ts` | BASE-034 | spec/specs/025-baseline-pruebas-aislada/plan.md:69 | suite ejecutada, cero skip |
| BASE-036 | P0 | Spec025 MP36: `runtime-fail-closed.db.test.ts` | BASE-035 | spec/specs/025-baseline-pruebas-aislada/plan.md:70 | suite ejecutada, negativos PASS |
| BASE-037 | P0 | Spec025 MP37: `tenant-bootstrap.db.test.ts` | BASE-036 | spec/specs/025-baseline-pruebas-aislada/plan.md:71 | suite ejecutada bajo enforce |
| BASE-038 | P0 | Spec025 MP38: `visits.api.test.ts` | BASE-037 | spec/specs/025-baseline-pruebas-aislada/plan.md:72 | suite ejecutada bajo enforce |
| BASE-039 | P0 | Spec025 MP39: `visits-db-foundation.db.test.ts` | BASE-038 | spec/specs/025-baseline-pruebas-aislada/plan.md:73 | suite ejecutada, cero skip |
| BASE-040 | P0 | Spec025 MP40: `visits-materialization.db.test.ts` | BASE-039 | spec/specs/025-baseline-pruebas-aislada/plan.md:74 | suite ejecutada, cero skip |
| BASE-041 | P0 | Spec025 MP41: `visits-professional-transitions.db.test.ts` | BASE-040 | spec/specs/025-baseline-pruebas-aislada/plan.md:75 | suite ejecutada, cero skip |
| BASE-042 | P0 | Spec025 MP42: Agregación y cleanup | BASE-041 | spec/specs/025-baseline-pruebas-aislada/plan.md:76 | 22+1 completos con misma huella/run-id; evidencia sanitizada; cero recursos |

### 15.2 Evolución integral condicionada

| ID | Prioridad | Objetivo individual | Depende de | Archivos existentes / referencia | Aceptación mínima |
|---|---|---|---|---|---|
| PAT-001 | P1 | Especificar edición/desactivación de Person/Patient y revocación de consentimiento, conservando historia. | GOV-004, BASE-042 | docs/DATA.md; docs/ROLES.md; apps/api/src/patients/enrollment.contract.ts | Dataset, roles, tenant, finalidad, auditoría, correcciones y retención aprobados; readonly self no cambia por inferencia. |
| PAT-002 | P2 | Implementar actualización del dataset personal aprobado y conectar formulario de edición autorizado. | PAT-001 | apps/api/src/patients/patient-enrollment.service.ts; apps/web/src/features/hospital/HospitalPatients.tsx; prisma/schema.prisma | Validación servidor+permiso+lectura posterior+audit+prueba edición/cross-tenant; contratos/rutas nuevos definidos en spec. |
| PAT-003 | P2 | Implementar desactivación/archivo autorizado de paciente con confirmación y revisión de sesiones/relaciones. | PAT-001 | apps/api/src/patients/patient-enrollment.service.ts; apps/api/src/identity-access/identity-access.service.ts; apps/web/src/features/hospital/HospitalPatients.tsx | No DELETE indiscriminado; acceso futuro bloqueado y trazabilidad conservada. Nuevo estado y recibo/sesiones definidos antes de ampliar PatientStatus. |
| PAT-004 | P2 | Implementar consulta/ciclo de revocación de consentimiento aprobado y feedback UI. | PAT-001 | apps/api/src/consents/consent.service.ts; apps/web/src/features/paciente/PacienteExperience.tsx; prisma/schema.prisma | Versión/historia/finalidad y consecuencias de revocación verificadas, sin base jurídica inventada. |
| REL-001 | P1 | Especificar portal cuidador y alta/vinculación humana: identidad, validación, scopes y vigencia por paciente. | GOV-004, BASE-042 | docs/ROLES.md; docs/DATA.md; apps/api/src/people-relationships/caregiver-relationship.contract.ts; apps/web/src/features/inscripcion/steps/PasosCuidador.tsx | Formulario no concede acceso automático; canales de alta, revisión y evidencia aprobados. |
| REL-002 | P2 | Conectar gestión institucional de relación pendiente/activar/revocar con API existente. | REL-001 | apps/api/src/people-relationships/caregiver-relationship.controller.ts; apps/api/src/people-relationships/caregiver-relationship.service.ts; apps/web/src/features/hospital/HospitalPersonnelAccess.tsx | Estados/versiones/conflictos y audit reales; gestor exacto y tenant correctos. |
| REL-003 | P2 | Implementar lectura cuidador por relación aprobada y conectar selector/lista autorizados. | REL-001, REL-002 | apps/api/src/identity-access/identity-access.service.ts; apps/api/src/people-relationships/caregiver-relationship.policy.ts; apps/web/src/features/inscripcion/InscripcionExperience.tsx | Solo paciente autorizado/scopes vigentes, sin IDs ajenos; prueba expiración/revocación y estados UI. |
| PRO-001 | P1 | Especificar alta/verificación de profesional, afiliación, credenciales y cuenta; no adoptar declaración como certificación. | GOV-004, BASE-042 | docs/MODULES.md; docs/ROLES.md; apps/web/src/features/inscripcion/steps/PasosVisitador.tsx; apps/api/src/hospital/hospital-professionals.dto.ts | Autoridad de verificación/dataset/roles/tenant y rechazo/suspensión aprobados. |
| PRO-002 | P2 | Persistir alta profesional/afiliación aprobada y conectar el formulario, errores y consulta posterior. | PRO-001 | prisma/schema.prisma; apps/api/src/hospital/hospital-professionals.service.ts; apps/web/src/features/inscripcion/steps/PasosVisitador.tsx | Create→validación→commit→detalle real; no cuenta OIDC por claim/email automáticamente. |
| PRO-003A | P2 | Implementar edición autorizada de profesional/afiliación y feedback persistido. | PRO-001, PRO-002 | apps/api/src/hospital/hospital-professionals.service.ts; apps/api/src/identity-access/identity-access.service.ts; apps/web/src/features/hospital/HospitalProfessionals.tsx | Cambio preserva historia y bloquea operaciones posteriores no autorizadas. |
| PRO-003B | P2 | Implementar desactivación autorizada de profesional/afiliación con revisión de asignaciones. | PRO-001, PRO-002 | apps/api/src/hospital/hospital-professionals.service.ts; apps/api/src/identity-access/identity-access.service.ts; apps/web/src/features/hospital/HospitalProfessionals.tsx | Cambio preserva historia y bloquea operaciones posteriores no autorizadas. |
| AGD-001 | P1 | Especificar creación/reprogramación/cancelación de citas y disponibilidad con zona institucional. | GOV-004, FIX-017 | docs/MODULES.md; apps/api/src/hospital/hospital-agenda.dto.ts; apps/web/src/features/hospital/HospitalAgenda.tsx | Quién solicita/aprueba, conflictos, duración, modalidad, estados y efectos en visita definidos. |
| AGD-002 | P2 | Implementar creación de solicitud/cita autorizada y conectar formulario de agenda. | AGD-001, BASE-042 | prisma/schema.prisma; apps/api/src/hospital/hospital-agenda.service.ts; apps/web/src/features/hospital/HospitalAgenda.tsx | POST definido en spec, commit/lectura y estados reales; conflicto de disponibilidad probado. |
| AGD-003 | P2 | Implementar reprogramación autorizada con historial, versión y actualización de UI. | AGD-001, AGD-002 | apps/api/src/hospital/hospital-appointment-assignment.service.ts; apps/web/src/features/hospital/hospitalAgendaClient.ts; apps/web/src/features/hospital/HospitalAgenda.tsx | No doble reserva ni cambio silencioso de visita/evidencia; pruebas concurrencia. |
| AGD-004 | P2 | Implementar cancelación/declinación autorizada con confirmación y efectos aprobados. | AGD-001, AGD-002 | apps/api/src/hospital/hospital-appointment-assignment.service.ts; apps/web/src/features/hospital/HospitalAgenda.tsx; prisma/schema.prisma | Estado conserva historia y no afirma servicio prestado/ingreso por cita cancelada. |
| VIS-001 | P1 | Reconciliar specs017/018, rama del visitador y alcance real de worklist antes de integrar UI. | GOV-001, GOV-004, BASE-042 | spec/specs/017-worklist-del-visitador/spec.md; spec/specs/018-correcciones-visitador-mp02/spec.md; apps/api/src/visits/professional-visit-worklist.service.ts | Código/specs/aceptación definidos; no copiar rama ni inventar correcciones ya realizadas. |
| VIS-002 | P1 | Conectar worklist profesional existente con entrada/restauración sin depender de DTO de agenda efímero. | VIS-001 | apps/web/src/features/hospital/HospitalHomeVisits.tsx; apps/web/src/features/hospital/hospitalVisitsClient.ts; apps/api/src/visits/visits.controller.ts | Lista real assigned/propia con rango/estado y empty/loading/error; navegación tras OIDC/refresh aprobada. |
| VIS-003 | P1 | Probar worklist→detalle→transiciones, filtros y negativa de visita ajena con dos profesionales. | VIS-002 | apps/api/test/visits.api.test.ts; apps/web/src/features/hospital/hospitalVisitsClient.test.ts; apps/web/src/features/hospital/hospitalOperaciones.test.tsx | Punta a punta, revocación/versión/refresh y retorno comprobados. |
| INST-001 | P1 | Especificar instituciones/territorios/configuración delegada y administración de afiliaciones/roles. | GOV-004, BASE-042 | docs/DATA.md; docs/ROLES.md; docs/ARCHITECTURE.md; apps/web/src/features/hospital/HospitalInstitutionSettings.tsx | Hospital/Alcaldía sobre core compartido; directorio/ownership/tenant y roles privilegiados sin acceso clínico implícito. |
| INST-002A | P2 | Persistir configuración institucional aprobada y conectar formulario autorizado. | INST-001 | prisma/schema.prisma; apps/api/src/territory/territory.service.ts; apps/web/src/features/hospital/HospitalInstitutionSettings.tsx; apps/web/src/features/municipality/municipalityConfig.ts | Edición real y lectura tras refresh; unidades locales no se rotulan oficiales sin procedencia. |
| INST-002B | P2 | Persistir catálogo local territorial aprobado y conectar gestión permitida. | INST-001 | prisma/schema.prisma; apps/api/src/territory/territory.service.ts; apps/web/src/features/hospital/HospitalInstitutionSettings.tsx; apps/web/src/features/municipality/municipalityConfig.ts | Edición real y lectura tras refresh; unidades locales no se rotulan oficiales sin procedencia. |
| INST-003A | P2 | Conectar directorio de personal/cuentas con búsqueda y lectura autorizadas. | INST-001, PRO-001 | apps/web/src/features/hospital/HospitalPersonnelAccess.tsx; apps/web/src/features/hospital/HospitalRolesPermissions.tsx; tools/identity-provisioning/src/operations.ts | Lista/búsqueda/paginación real y alta/baja auditadas; cargo no concede permisos automáticamente. |
| INST-003B | P2 | Conectar cambios delegados de acceso conforme al lifecycle de cuentas aprobado. | INST-001, PRO-001 | apps/web/src/features/hospital/HospitalPersonnelAccess.tsx; apps/web/src/features/hospital/HospitalRolesPermissions.tsx; tools/identity-provisioning/src/operations.ts | Lista/búsqueda/paginación real y alta/baja auditadas; cargo no concede permisos automáticamente. |
| INST-004 | P2 | Especificar exposición soporte/admin MP02 sobre fundación existente y pruebas de alcance temporal. | INST-001 | spec/specs/016-acceso-de-soporte-administrativo/spec.md; prisma/schema.prisma; docs/SECURITY.md | Capability/grant/context separados; sin impersonation ni privilegio de contenido no aprobados. |
| PRG-001 | P1 | Cerrar contrato de programa, población, responsables y estados por institución. | GOV-004, INST-001 | docs/MODULES.md; docs/DATA.md; apps/web/src/features/municipality/MunicipalityProgramForm.tsx | Entidad/ownership/dataset/elegibilidad/procedencia/acciones y tenant aprobados. |
| PRG-002 | P2 | Añadir persistencia/modelo y migración aditiva de programa aprobado con RLS e historial. | PRG-001 | prisma/schema.prisma; apps/api/src/app.module.ts | Modelo real probado con owner/runtime/two tenants y rollback aprobado; rutas nuevas se fijan en spec. |
| PRG-003 | P2 | Conectar creación de borrador de programa con POST real y errores/éxito. | PRG-002 | apps/web/src/features/municipality/MunicipalityProgramForm.tsx; apps/web/src/features/municipality/MunicipalityPrograms.tsx | Borrador reaparece tras recarga; validación servidor/permiso/audit, sin aprobar/activar por guardar. |
| PRG-004 | P2 | Conectar listado/detalle/búsqueda/filtros de programas y estados empty/error. | PRG-002 | apps/web/src/features/municipality/MunicipalityPrograms.tsx; apps/web/src/features/municipality/municipalityConfig.ts | Solo tenant/programa autorizados, paginación y filtros combinados reales. |
| PRG-005A | P2 | Implementar edición/versionado de borrador de programa con feedback de guardado. | PRG-003, PRG-004 | apps/web/src/features/municipality/MunicipalityPrograms.tsx; apps/web/src/features/municipality/MunicipalityProgramForm.tsx; prisma/schema.prisma | Historial/versiones/confirmaciones y segregación de aprobación verificadas. |
| PRG-005B | P2 | Implementar transiciones/archivo aprobado de programa con confirmación y auditoría. | PRG-003, PRG-004 | apps/web/src/features/municipality/MunicipalityPrograms.tsx; apps/web/src/features/municipality/MunicipalityProgramForm.tsx; prisma/schema.prisma | Historial/versiones/confirmaciones y segregación de aprobación verificadas. |
| PRG-006 | P2 | Conectar pertenencia/seguimiento agregado de programa a población municipal y hospitalaria autorizada. | PRG-002, INST-002A, INST-002B | apps/api/src/municipality/municipality.service.ts; apps/api/src/hospital/hospital-patients.service.ts; apps/web/src/features/municipality/MunicipalityPopulation.tsx | Sin replicar padrón ni conceder clínica nominal municipal; lineage y supresión probados. |
| EVI-001 | P1 | Especificar documento/evidencia: ownership, finalidad, tipos, size, hash, virus, versiones, retención y acceso. | GOV-004, INST-001 | docs/DATA.md; docs/SECURITY.md; docs/ARCHITECTURE.md; apps/web/src/features/municipality/MunicipalityEvidence.tsx | Contrato storage privado aprobado, sin proveedor impuesto ni archivo público por URL/ID. |
| EVI-002 | P2 | Implementar metadatos/provenance y puerto de storage privado para evidencia aprobada. | EVI-001 | prisma/schema.prisma; apps/api/src/app.module.ts | Integridad archivo/metadata, cuarentena y tenant; migración/rollback/permiso test. |
| EVI-003 | P2 | Conectar carga autorizada de soporte con validación, progress/error y confirmación. | EVI-002 | apps/web/src/features/municipality/MunicipalityEvidence.tsx; apps/web/src/features/hospital/HospitalFinancialPieces.tsx | Archivo guardado con metadata/hash y autorización, no éxito ficticio ni doble upload. |
| EVI-004 | P2 | Conectar listado/detalle/descarga autorizados de evidencia con auditoría. | EVI-002 | apps/web/src/features/municipality/MunicipalityEvidence.tsx; apps/web/src/features/municipality/MunicipalityFinancialDetails.tsx; apps/web/src/features/hospital/HospitalFinancialSections.tsx | ID ajeno denegado, fuente/versiones visibles; descarga real y no pública. |
| EVI-005A | P2 | Implementar corrección/versionado de evidencia conservando versiones y hash. | EVI-002, EVI-004 | prisma/schema.prisma; apps/web/src/features/municipality/MunicipalityEvidence.tsx | Retención y revisión aprobadas; original intacto y audit. |
| EVI-005B | P2 | Implementar archivo de evidencia autorizado y lectura de historial sin eliminación física. | EVI-002, EVI-004 | prisma/schema.prisma; apps/web/src/features/municipality/MunicipalityEvidence.tsx | Retención y revisión aprobadas; original intacto y audit. |
| EVI-006 | P2 | Conectar consulta de auditoría real por dominio/permiso y reemplazar cinco eventos demo. | EVI-002, INST-001 | apps/api/src/audit/audit.service.ts; apps/web/src/features/hospital/HospitalAudit.tsx; apps/web/src/features/hospital/hospitalAdministrationConfig.ts | Acceso auditado, append-only sin PHI innecesaria, búsquedas/export solo autorizados. |
| FIN-001 | P1 | Cerrar semántica y permisos de presupuestos/movimientos/soportes y alcance financiero del hito. | GOV-004, INST-001 | docs/MODULES.md; docs/DATA.md; docs/ROLES.md; apps/web/src/features/hospital/hospitalFinancialContracts.ts | Fuentes, aprobación, estados, correcciones, moneda/periodo y límites contables aprobados. |
| FIN-002 | P2 | Persistir presupuesto y asignación por institución/programa/fuente/periodo. | FIN-001, PRG-002 | prisma/schema.prisma; apps/web/src/features/municipality/MunicipalityBudget.tsx; apps/web/src/features/hospital/hospitalFinancialControl.ts | Create/read/edit controladas con audit/tenant y sin fórmulas oficiales inventadas. |
| FIN-003 | P2 | Conectar listado/detalle y edición/versionado de presupuesto a UI Hospital/Alcaldía. | FIN-002 | apps/web/src/features/municipality/MunicipalityBudget.tsx; apps/web/src/features/hospital/HospitalFinancialManagement.tsx | Refresh y filtros compuestos reales; shared core, no arquitectura financiera duplicada. |
| FIN-004 | P2 | Persistir ingreso/egreso/gasto autorizado con soporte y ajuste trazable. | FIN-001, FIN-002, EVI-002 | prisma/schema.prisma; apps/web/src/features/hospital/hospitalFinancialMovimientos.ts | Movimientos atómicos y corrección histórica, separación clínica/financiera; no pago gateway. |
| FIN-005 | P2 | Conectar registro/listado/detalle de movimientos, loading y errores a datos persistidos. | FIN-004 | apps/web/src/features/hospital/HospitalFinancialSections.tsx; apps/web/src/features/municipality/MunicipalityFinancialDetails.tsx | Formulario→API→DB→UI y recuperación comprobadas por tipo de movimiento. |
| FIN-006 | P2 | Persistir proveedor y edición/archivo aprobados con validación y segregación. | FIN-001 | prisma/schema.prisma; apps/web/src/features/hospital/hospitalFinancialAbastecimiento.ts | Proveedor tenant, duplicate checks, audit y vida útil; sin borrar contratos asociados. |
| FIN-007 | P2 | Persistir contrato/convenio con proveedor/programa/periodo y evidence. | FIN-006, PRG-002, EVI-002 | prisma/schema.prisma; apps/web/src/features/hospital/hospitalFinancialAbastecimiento.ts; apps/web/src/features/hospital/hospitalFinancialContracts.ts | Estados/versiones/permiso y soporte aprobados; no interpretación contractual autónoma. |
| FIN-008A | P2 | Conectar tabla/buscador/ficha de proveedores a API real. | FIN-006 | apps/web/src/features/hospital/HospitalFinancialSections.tsx; apps/web/src/features/hospital/HospitalFinancialPieces.tsx | Filtros/empty/error/refresh y acciones permitidas reales. |
| FIN-008B | P2 | Conectar tabla/buscador/ficha de contratos a API real. | FIN-007 | apps/web/src/features/hospital/HospitalFinancialSections.tsx; apps/web/src/features/hospital/HospitalFinancialPieces.tsx | Filtros/empty/error/refresh y acciones permitidas reales. |
| FIN-009 | P1 | Especificar si nómina/honorarios/cuentas de cobro/compras/facturas son referencias o flujos activos y su dataset. | FIN-001 | docs/MODULES.md; apps/web/src/features/hospital/hospitalFinancialPersonas.ts; apps/web/src/features/hospital/hospitalFinancialAbastecimiento.ts | Alcance aprobado por subentidad; no convertir MERDN en payroll/ERP por apariencia UI. |
| FIN-010A | P2 | Persistir y conectar referencias de nómina aprobadas por periodo, con acceso segregado. | FIN-009, FIN-004, FIN-007 | prisma/schema.prisma; apps/web/src/features/hospital/HospitalFinancialSections.tsx; apps/web/src/features/hospital/hospitalFinancialPersonas.ts | Solo dataset/permisos aprobados; cada paquete devuelve create/read/update/error/audit y prueba aislada. |
| FIN-010B | P2 | Persistir y conectar referencias de honorarios aprobadas y vínculo al soporte. | FIN-009, FIN-004, FIN-007 | prisma/schema.prisma; apps/web/src/features/hospital/HospitalFinancialSections.tsx; apps/web/src/features/hospital/hospitalFinancialPersonas.ts | Solo dataset/permisos aprobados; cada paquete devuelve create/read/update/error/audit y prueba aislada. |
| FIN-010C | P2 | Persistir y conectar cuentas de cobro aprobadas y sus estados. | FIN-009, FIN-004, FIN-007 | prisma/schema.prisma; apps/web/src/features/hospital/HospitalFinancialSections.tsx; apps/web/src/features/hospital/hospitalFinancialPersonas.ts | Solo dataset/permisos aprobados; cada paquete devuelve create/read/update/error/audit y prueba aislada. |
| FIN-010D | P2 | Persistir y conectar referencias de compras aprobadas y relación proveedor/contrato. | FIN-009, FIN-004, FIN-007 | prisma/schema.prisma; apps/web/src/features/hospital/HospitalFinancialSections.tsx; apps/web/src/features/hospital/hospitalFinancialPersonas.ts | Solo dataset/permisos aprobados; cada paquete devuelve create/read/update/error/audit y prueba aislada. |
| FIN-010E | P2 | Persistir y conectar referencias de facturas aprobadas y lectura del soporte. | FIN-009, FIN-004, FIN-007 | prisma/schema.prisma; apps/web/src/features/hospital/HospitalFinancialSections.tsx; apps/web/src/features/hospital/hospitalFinancialPersonas.ts | Solo dataset/permisos aprobados; cada paquete devuelve create/read/update/error/audit y prueba aislada. |
| FIN-011 | P2 | Calcular ejecución/disponible desde movimientos soportados y fórmula versionada aprobada. | FIN-003, FIN-005, HUB-005 | apps/web/src/features/hospital/hospitalFinancialResumen.ts; apps/web/src/features/municipality/MunicipalityBudget.tsx; apps/web/src/features/municipality/MunicipalityIndicators.tsx | Fuente/periodo/owner/formula/lineage visibles; no balance oficial ni reconocimiento automático de ingreso. |
| HUB-001 | P1 | Especificar core extensible de marcos/requisitos/aplicabilidad/responsables/brechas/acciones. | GOV-004, INST-001, EVI-001 | docs/MODULES.md; docs/DATA.md; apps/web/src/features/municipality/municipalityConfig.ts | Modelo compartido y fuentes/revisión aprobadas; no inventar interpretación jurídica ni cumplimiento total. |
| HUB-002 | P2 | Persistir marcos/requisitos/versiones y aplicabilidad aprobados con tenant/provenance. | HUB-001, EVI-002 | prisma/schema.prisma; apps/api/src/app.module.ts | Metadatos/estados/versiones y auditoría; fuente e interpretación diferenciadas. |
| HUB-003A | P2 | Conectar vínculo de evidencia al requisito del Hub con lectura/descarga autorizadas. | HUB-002, EVI-004 | apps/web/src/features/municipality/MunicipalityGaps.tsx; apps/web/src/features/hospital/hospitalReportsInstitutional.ts | Acciones editables aprobadas y evidencia real; sin puntaje/cierre automático inventado. |
| HUB-003B | P2 | Persistir responsables/vigencia y conectar su asignación al requisito del Hub. | HUB-002, EVI-004 | apps/web/src/features/municipality/MunicipalityGaps.tsx; apps/web/src/features/hospital/hospitalReportsInstitutional.ts | Acciones editables aprobadas y evidencia real; sin puntaje/cierre automático inventado. |
| HUB-003C | P2 | Persistir brecha declarada y conectar captura/listado del Hub sin juicio oficial. | HUB-002, EVI-004 | apps/web/src/features/municipality/MunicipalityGaps.tsx; apps/web/src/features/hospital/hospitalReportsInstitutional.ts | Acciones editables aprobadas y evidencia real; sin puntaje/cierre automático inventado. |
| HUB-003D | P2 | Persistir plan de acción y estados aprobados, conectados al requisito/brecha. | HUB-002, HUB-003C | apps/web/src/features/municipality/MunicipalityGaps.tsx; apps/web/src/features/hospital/hospitalReportsInstitutional.ts | Acciones editables aprobadas y evidencia real; sin puntaje/cierre automático inventado. |
| HUB-004A | P2 | Configurar y conectar vista FURAG/MIPG a requisitos/evidencia versionados. | HUB-002, HUB-003A, HUB-003B, HUB-003C, HUB-003D | apps/web/src/features/municipality/MunicipalityFurag.tsx; apps/web/src/features/municipality/MunicipalityAdres.tsx; apps/web/src/features/municipality/MunicipalityCare.tsx | Representación manual/documental operativa, fechas/provenance y límites visibles; no integración oficial ficticia. |
| HUB-004B | P2 | Configurar y conectar vista ADRES a recursos/evidencia autorizados con provenance. | HUB-002, HUB-003A, HUB-003B, HUB-003C, HUB-003D | apps/web/src/features/municipality/MunicipalityFurag.tsx; apps/web/src/features/municipality/MunicipalityAdres.tsx; apps/web/src/features/municipality/MunicipalityCare.tsx | Representación manual/documental operativa, fechas/provenance y límites visibles; no integración oficial ficticia. |
| HUB-004C | P2 | Configurar y conectar vista T-319 a obligaciones/evidencia con interpretación aprobada. | HUB-002, HUB-003A, HUB-003B, HUB-003C, HUB-003D | apps/web/src/features/municipality/MunicipalityFurag.tsx; apps/web/src/features/municipality/MunicipalityAdres.tsx; apps/web/src/features/municipality/MunicipalityCare.tsx | Representación manual/documental operativa, fechas/provenance y límites visibles; no integración oficial ficticia. |
| HUB-005 | P1 | Aprobar catálogo de indicadores/fórmulas/periodos/owners/lineage/supresión por dominio. | GOV-004, HUB-001, FIN-001 | docs/DATA.md; docs/MODULES.md; apps/web/src/features/municipality/MunicipalityIndicators.tsx | Toda cifra calculada tiene contrato de fuente/version/periodo/evidencia; datos no disponibles etiquetados. |
| HUB-006 | P2 | Persistir definiciones y calcular indicadores aprobados desde fuentes operativas. | HUB-005, HUB-002, PRG-006, FIN-005 | prisma/schema.prisma; apps/web/src/features/municipality/MunicipalityIndicators.tsx; apps/web/src/features/hospital/hospitalReportsSnapshot.ts | Cálculo reproducible, denominadores y versionado; no inventar cobertura/oficialidad. |
| HUB-007 | P2 | Reemplazar series/KPI demo por indicadores autorizados o estado sin datos. | HUB-006 | apps/web/src/features/municipality/MunicipalityHome.tsx; apps/web/src/features/municipality/MunicipalityIndicators.tsx; apps/web/src/features/hospital/HospitalDashboard.tsx | Fuentes/periodos legibles, filtros reales y no mezclar fixture con valores institucionales. |
| COM-001 | P1 | Cerrar catálogo de servicios, planes, entitlements y referencias de cargo/pago autorizados. | GOV-004, INST-001, FIN-001 | docs/MODULES.md; docs/ROLES.md; apps/web/src/features/hospital/HospitalMemberships.tsx | Precios/reglas/renovación/evidencia/alcance aprobados; gateway productivo sigue fuera hasta aprobación separada. |
| COM-002 | P2 | Persistir catálogo servicio y planes versionados con permisos/evidencia. | COM-001 | prisma/schema.prisma; apps/web/src/features/hospital/hospitalAdministrationConfig.ts | List/create/edit/archive según contrato; no catálogo clínico/precio inventado. |
| COM-003A | P2 | Conectar creación/edición de servicios y planes al catálogo real con validaciones. | COM-002 | apps/web/src/features/hospital/HospitalMemberships.tsx; apps/web/src/features/hospital/HospitalInstitutionSettings.tsx | Guardar real, versión visible, filtro/empty/permiso y no cobro automático. |
| COM-003B | P2 | Conectar listado/detalle/búsqueda de servicios y planes con refresh y errores. | COM-002 | apps/web/src/features/hospital/HospitalMemberships.tsx; apps/web/src/features/hospital/HospitalInstitutionSettings.tsx | Guardar real, versión visible, filtro/empty/permiso y no cobro automático. |
| COM-004 | P2 | Persistir membresía/entitlement y renovación/cancelación aprobadas. | COM-002, PAT-001 | prisma/schema.prisma; apps/web/src/features/hospital/HospitalMemberships.tsx | Persona autorizada, vigencia/historia/reglas aprobadas y update de UI; no almacenar tarjeta. |
| COM-005 | P2 | Registrar referencia manual de cargo/pago soportado y vínculo servicio→prestación→evidencia. | COM-001, COM-004, FIN-004, EVI-002 | prisma/schema.prisma; apps/web/src/features/hospital/hospitalFinancialMovimientos.ts; apps/web/src/features/hospital/HospitalFinancialSections.tsx | Cita no equivale a servicio/ingreso; historial/permiso y conciliación según scope aprobado. |
| COM-006A | P2 | Aprobar spec de consulta virtual: identidad, proveedor, consentimiento, failure y evidencia. | COM-001, AGD-001, EVI-001 | docs/MODULES.md; apps/web/src/features/hospital/HospitalVirtualConsultations.tsx; apps/web/src/features/hospital/hospitalVirtualConfig.ts | Contrato separado aprobado; no activa proveedor ni clínica autónoma. |
| COM-006B | P2 | Implementar adaptador de sala virtual aprobado y validación de acceso servidor. | COM-006A, BASE-042 | docs/MODULES.md; apps/web/src/features/hospital/HospitalVirtualConsultations.tsx; apps/web/src/features/hospital/hospitalVirtualConfig.ts | Puerto/adaptador acotado, sala autorizada, error/timeouts y pruebas con doble; no secretos en navegador. |
| COM-006C | P2 | Conectar acceso/cierre de sala y estados virtuales a la UI y verificar provider controlado. | COM-006B | docs/MODULES.md; apps/web/src/features/hospital/HospitalVirtualConsultations.tsx; apps/web/src/features/hospital/hospitalVirtualConfig.ts | Sesión real, negativa de usuario ajeno, falla recuperable y evidencia mínima aprobada. |
| TRN-001 | P1 | Cerrar catálogo de formación y autoridad de validación/certificación/SENA con fuente y vigencia. | GOV-004, REL-001, HUB-001 | docs/MODULES.md; apps/web/src/features/municipality/MunicipalityCaregivers.tsx | Certificado declarado no se valida por UI; evidencia/procedencia y efecto sobre relaciones aprobados. |
| TRN-002 | P2 | Persistir formación y evidencia/certificación aprobadas por cuidador con versión y acceso. | TRN-001, REL-002, EVI-002 | prisma/schema.prisma; apps/web/src/features/municipality/MunicipalityCaregivers.tsx | Modelo auditable/tenant y validación manual controlada; sin conexión SENA fabricada. |
| TRN-003 | P2 | Conectar agregados/listados de formación y estados verificables a vistas municipales/hospitalarias. | TRN-002, HUB-006 | apps/web/src/features/municipality/MunicipalityCaregivers.tsx; apps/web/src/features/hospital/hospitalReportsInstitutional.ts | Fuente, expiración, vacío y supresión; no exponer nominal al rol municipal sin permiso. |
| NOT-001 | P1 | Especificar bandeja interna/alertas manuales y comunicaciones aprobadas, sin umbrales clínicos del prototipo. | GOV-004, INST-001 | docs/WORKFLOW-ALERTAS-ELI.md; docs/MODULES.md; apps/web/src/features/hospital/HospitalAlerts.tsx; apps/web/src/features/hospital/HospitalUpdates.tsx | Responsable, prioridad, canal, finalidad, retención y escalamiento aprobados; WhatsApp no inferido. |
| NOT-002 | P2 | Persistir alerta/novedad manual y estados leído/atendido con auditoría y destinatario autorizado. | NOT-001, EVI-002 | prisma/schema.prisma; apps/web/src/features/hospital/HospitalAlerts.tsx; apps/web/src/features/hospital/HospitalUpdates.tsx | Crear/leer/gestionar reales; entrega interna idempotente y pruebas de destinatario/tenant. |
| NOT-003 | P2 | Conectar acciones y bandejas con API real, quitando mensajes de envío ficticio. | NOT-002 | apps/web/src/features/hospital/HospitalAlerts.tsx; apps/web/src/features/hospital/HospitalUpdates.tsx; apps/web/src/features/hospital/hospitalUpdatesConfig.ts | Acción selecciona registro correcto, loading/error/empty y no promete mensajes externos inexistentes. |
| CLN-001 | P1 | Cerrar dataset hospitalario/bitácora/calificaciones permitido, provenance y revisión clínica específica. | GOV-004, EVI-001 | docs/MODULES.md; docs/DATA.md; docs/WORKFLOW-ALERTAS-ELI.md; apps/web/src/features/hospital/HospitalClinicalImport.tsx; apps/web/src/features/paciente/BitacoraPaciente.tsx | Fuente/dataset/roles/consent/revisión/versiones aprobados; no HCE, diagnósticos/prescripciones/umbrales inventados. |
| CLN-002 | P2 | Conectar importación/resumen clínico autorizado con evidencia y fallas según contrato de fuente. | CLN-001, EVI-002, PAT-001 | prisma/schema.prisma; apps/web/src/features/hospital/HospitalClinicalImport.tsx; apps/web/src/features/hospital/HospitalPatients.tsx | Matching autorizado, lineage y rechazo uniforme; datos sensibles por finalidad no rol visual. |
| CLN-003A | P2 | Conectar captura y lectura autorizadas de bitácora al contrato clínico aprobado. | CLN-001, CLN-002 | apps/web/src/features/paciente/BitacoraPaciente.tsx; apps/web/src/features/paciente/bitacoraFlow.ts | Captura persistida/versionada y lectura con errores/permisos; no reglas clínicas demo. |
| CLN-003B | P2 | Persistir calificación administrativa aprobada y conectar listado/estadística Hospital. | CLN-001, CLN-002 | apps/web/src/features/hospital/HospitalRatings.tsx | Datos reales y fuente controlada; no adoptar puntuaciones ficticias ni inferir calidad clínica. |
| REP-001 | P1 | Especificar reporte/export por audiencia con minimización, fuente, periodo y autorización. | GOV-004, HUB-005, FIN-001 | docs/MODULES.md; docs/ROLES.md; apps/web/src/features/hospital/hospitalReportsTypes.ts; apps/web/src/features/municipality/MunicipalityReports.tsx | Formato/campos/periodos/retención y permiso export aprobados, no estadísticas oficiales inferidas. |
| REP-002 | P2 | Conectar reportes/tableros operativos a agregados reales con periodo aplicado servidor. | REP-001, HUB-006, PRG-006, FIN-011 | apps/web/src/features/hospital/HospitalReports.tsx; apps/web/src/features/hospital/hospitalReportsSnapshot.ts; apps/web/src/features/municipality/MunicipalityReports.tsx; apps/web/src/features/municipality/MunicipalityTopbar.tsx | Periodo ya no solo etiqueta; resultados fuente/lineage, empty/error y sin nominal indebido. |
| REP-003 | P2 | Implementar exportación autorizada y auditada con evidencia del snapshot de datos. | REP-001, REP-002 | apps/web/src/features/hospital/HospitalReportsPieces.tsx; apps/web/src/features/municipality/MunicipalityReports.tsx; apps/api/src/app.module.ts | Archivo real, contenido minimizado, permission y fallo/descarga probados; no URL pública. |
| REP-004 | P0 | Auditar producto integral por cada módulo activado con pruebas CRUD/filtros/permisos/lineage y aceptación PO. | REP-003, PRG-005A, PRG-005B, EVI-005A, EVI-005B, EVI-006, FIN-008A, FIN-008B, FIN-010A, FIN-010B, FIN-010C, FIN-010D, FIN-010E, COM-005, COM-006A, COM-006B, COM-006C, TRN-003, NOT-003, CLN-003A, CLN-003B, REL-003, PRO-003A, PRO-003B, PAT-003, PAT-004, AGD-003, AGD-004, VIS-003, INST-003A, INST-003B, INST-004, ISA-002 | docs/MODULES.md; tests/README.md; spec/bitacora/handoffs/CODEX-REVIEW.md | No módulos completos por UI; ninguna decisión abierta confundida con implementación o aceptación. |
| ISA-001 | P2 | Cerrar alcance educativo de ISA/Elí y contenido aprobado por flujo, sin convertirlo en diagnóstico. | GOV-004, CLN-001 | docs/WORKFLOW-ALERTAS-ELI.md; apps/web/src/components/ui/EliBubble.tsx; apps/web/src/features/inscripcion/InscripcionExperience.tsx | Fuentes/versiones, no retención clínica implícita; ayuda correcta y accesible. |
| ISA-002 | P2 | Verificar ayuda/gestos/accesibilidad y límite de contenido en módulos operativos. | ISA-001, OPS-002, NOT-003, REP-002 | apps/web/src/components/ui/EliBubble.tsx; apps/web/src/components/ui/eliExpressions.ts; apps/web/src/components/ui/EliBubble.test.tsx | Contenido no afirma diagnóstico, envío externo ni integración no existente; teclado/lector/asset funcionan. |

## 16. Pruebas y evidencia exigidas

### 16.1 Reproducción de las comprobaciones sin DB

Se ejecutaron con Node.js 24.19.0 y las dependencias locales existentes. Typecheck/lint exitosos no prueban un checkout limpio ni un despliegue. No se instaló ni actualizó ningún paquete.

Desde la raíz, los equivalentes ejecutados fueron:

~~~text
node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit --allowImportingTsExtensions --incremental false
node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false
node node_modules/typescript/bin/tsc -p packages/shared/tsconfig.json --noEmit --incremental false
node node_modules/typescript/bin/tsc -p tools/identity-provisioning/tsconfig.json
node node_modules/typescript/bin/tsc -p tools/merdn-orchestrator/tsconfig.json
node node_modules/eslint/bin/eslint.js .
node tests/secrets-scan.check.mjs
node node_modules/vitest/vitest.mjs run --root apps/web --config vitest.config.mts
node node_modules/vitest/vitest.mjs run packages/shared/src/health.test.ts
node node_modules/vitest/vitest.mjs run --config tools/identity-provisioning/vitest.config.mts
node node_modules/typescript/bin/tsc -p packages/shared/tsconfig.build.json
./spec/scripts/check-sdd-gate.sh .
./spec/scripts/validate-sdd.sh . --strict
~~~

Las dos últimas comprobaciones y la suite staging se invocaron mediante Git Bash. La suite staging fue node node_modules/vitest/vitest.mjs run tests/staging. El orquestador se comprobó con node --test y los diez archivos existentes tests/orchestrator/*.test.mts pasados explícitamente; los adapters fueron ficticios y no se lanzó relay.

El build API se ejecutó con el CLI Nest local y cwd apps/api; el web con Next build y cwd apps/web. API PASS, web FAIL por descarga de Nunito.

**Importante para reproducir unidades API:** no se ejecutó la configuración estándar apps/api/vitest.config.mts, porque registra globalSetup con acceso/mutaciones DB. Se creó una configuración temporal externa que mantuvo environment: node, setupFiles al test-environment.ts existente, include exclusivamente src/**/*.test.ts, exclude generated/dist, root absoluto apps/api y **globalSetup: []**. Se pasó al CLI Vitest con --config. Esa restricción forma parte de la evidencia: el resultado 401/4 no es la suite integral API.

No ejecutar npm test global ni suites DB para “comprobar rápido” antes de BASE-001–014. No interpretar tests ignorados/DB no disponible como PASS. La guardia de entorno debe probarse con URL inválida, DB de negocio, DB sin marcador aislado, usuario/rol inapropiado y rollback seguro.

### 16.2 Matriz crítica pendiente

| Flujo | Prueba exigida antes de aceptación |
|---|---|
| Inscripción | Payload mínimo exacto; validación cliente/servidor; doble click; cambio de paso durante envío; duplicado; rollback sin registro parcial; refresh/recibo; red caída; minimización y cookies. |
| Login OIDC | Discovery/token/JWKS con timeouts reales; issuer/subject; state/nonce/PKCE; callback consumido/expirado; identidad/account deshabilitados; fallo de auditoría; redirect allowlist. |
| Sesión humana | Refresh; idle/absolute; dos sesiones/revocación; cookie Secure/HttpOnly/SameSite/Path; logout con bucket agotado; respuesta tardía; persona sin contexto. |
| Sesión institucional | Cuatro roles reales; credencial incorrecta; identidad deshabilitada; refresh/current/DELETE; preflight cross-origin permitido/denegado; expiración; datos retirados; varios clientes tras proxy. |
| Pacientes/Profesionales Hospital | Búsqueda y combinación real de filtros; paginación/recuento; empty y error; foco conservado; 401/403/503 de detalle; 404 opaco; ID ajeno y rol disjunto. |
| Agenda/asignación | Ventana/zona aprobada; profesional/afiliación activos; solicitud ya existente; versión stale/conflicto; inválidos y rollback; asignación simultánea. |
| Visita | HOME ASSIGNED → materialización idempotente/controlada; worklist asignado; detalle propio; versión; iniciar/completar/no realizada; historial/audit atómicos; negativa de profesional B. |
| Alcaldía | Agregado limitado por tenant; supresión/ausencia de dataset; periodo/territorio válidos; 401/403 retira sesión y datos; no salida nominal por IDs/errores. |
| Cuidador | Relación pendiente no permite lectura; activación autorizada; finalidad/scopes/vigencia/revocación; prohibición de escritura; no inferencia de paciente ajeno. La superficie lectora aún requiere spec. |
| PostgreSQL | Tenant A/B; owner bajo FORCE; runtime sin BYPASS ni herencia indebida; contexto ausente/incorrecto/residual; catálogo completo; FKs compuestas; audit append-only; rollback. |
| Infraestructura | Imagen limpia con assets y API pública correcta; identidades configuradas; cookie/proxy/CORS; readiness DB/IdP; restore; secretos externos; ningún puerto DB público. |
| Accesibilidad | Tab/Shift+Tab/Escape y retorno/confinamiento de foco; lector de pantalla; nombres/labels; errores y loading anunciados; contraste; zoom/responsive; no color único. |
| Dominios que se activen | Create/read/update/archivo aplicables con refresh; filtros servidor o dataset real declarado; tenant/rol; fuente/lineage/versiones; fallas; evidencia; export autorizado. |
| ISA/Elí | Ayuda accesible y contenido aprobado; no diagnóstico/prescripción, umbrales demo ni exposición de datos clínicos a proveedor no autorizado. |

La auditoría no certifica cumplimiento legal, clínico ni institucional por pasar estas pruebas. No hubo pentesting. Las pruebas DB, navegador, imagen, proxy y restore siguen pendientes y deben devolver evidencia verificable del mismo HEAD.

## 17. Definition of Done

### 17.1 Hito operativo de slices aprobados

- [ ] GOV-001–004 reconciliados; hito y base aceptados, con pausa/reanudación decididas por PO.
- [ ] Spec025 y compatibilidad CLI cerradas con 42 paquetes y evidencia aislada 22+1, sin skips ni daño a entornos ajenos.
- [ ] Todos los defectos P0/P1 que afectan al hito corregidos y auditados; P2 pendientes explícitamente aceptados o resueltos.
- [ ] Cada rol/contexto incluido inicia sesión por el mecanismo aprobado, recupera sesión con refresh y tiene logout efectivo.
- [ ] Protección servidor por rol, tenant, contexto y relación; ningún dato sensible accesible por ocultar botones o cambiar IDs.
- [ ] Inscripción mínima persiste y se relee; los campos excluidos están claramente explicados y no se presentan como guardados.
- [ ] Inscripción y cuenta humana tienen estados/mensajes inequívocos; no se promete login automático después del alta.
- [ ] Listados, búsqueda, filtros, paginación, detalle y analytics incluidos consultan datos reales.
- [ ] Operaciones aprobadas de agenda/visita tienen concurrencia, historial y auditoría atómicos.
- [ ] 401/403/expiración/contexto inválido retiran todos los datos nominales y DTOs contextualizados; respuestas tardías se descartan.
- [ ] Formularios validan tipos, obligatorios, fechas/catálogos/email/teléfono aplicables; bloquean doble envío y muestran resultado coherente.
- [ ] Loading, empty, error, cancelación y retry son recuperables; no spinner indefinido ni éxito ficticio.
- [ ] Pruebas A/B y DB aseguran RLS/FORCE y conexiones/roles; no solo regex de migraciones.
- [ ] Build limpio API/web e imagen exacta PASS; API pública, assets, fuente, credenciales externas y readiness comprobados.
- [ ] Flujo principal por rol probado en navegador controlado, incluyendo URL directa, refresh, back y logout.
- [ ] Accesibilidad de interacciones y ausencia de errores críticos de consola comprobadas.
- [ ] Módulos demostrativos fuera del hito están claramente rotulados y no confunden fixtures con operaciones.
- [ ] Backup/restore ensayado en entorno desechable; no hay secretos ni datos reales en source/fixtures/logs de evidencia.
- [ ] Informe de implementación, diff, tests y riesgos entregado por Claude, auditado por Codex y aceptado por PO.
- [ ] Commit/push/PR/merge/release/deploy requieren autorización aparte; aprobar un hito o este informe no la sustituye.

### 17.2 Entrega funcional integral solicitada

Además de lo anterior:

- [ ] Cada módulo existente comprendido en producto tiene contrato aprobado de UI, datos, roles, permisos y errores.
- [ ] Los registros de pacientes, cuidadores, profesionales y usuarios institucionales incluidos producen registros verificables y una vía de acceso válida.
- [ ] Cada CRUD tiene Create/Read/Update/archivo o ciclo aplicable, confirmación y actualización de UI tras persistencia.
- [ ] Ningún requisito de borrado obliga a destruir auditoría, consentimiento, historial o soporte retenido. N/A debe estar justificado por regla aprobada.
- [ ] Todos los listados/tablas/dashboards operativos usan fuentes reales autorizadas; no datos ficticios mezclados.
- [ ] Todos los buscadores/filtros/periodos visibles afectan la consulta o dataset real declarado; filtros combinables/limpiar/empty/error probados.
- [ ] Todos los botones operativos ejecutan su acción o explican una indisponibilidad real; no toast de éxito simulado.
- [ ] Programas, evidencia, presupuestos, movimientos, gastos/soportes, proveedores/contratos y reportes funcionan en alcances aprobados.
- [ ] Hub, FURAG/MIPG, ADRES, T-319, SENA y demás capacidades estratégicas conservan estructura y datos/evidencia/fuentes versionados.
- [ ] Hospital y Alcaldía comparten capacidades y aislamiento; no hay arquitecturas duplicadas ni permisos nominales municipales por defecto.
- [ ] Formación/certificación, membresías/planes/servicios e ingresos previstos tienen reglas y provenance aprobados.
- [ ] Consulta virtual tiene acceso, consentimiento y fallas controlados; pagos productivos solo si se aprobaron por separado.
- [ ] Bitácora/información clínica usan dataset y fuente aprobados; no reglas médicas demo ni sustitución de EHR.
- [ ] Reportes/exportación tienen fuente, periodo, minimización y audit; ninguna puntuación demo se presenta como oficial.
- [ ] No quedan mocks de negocio en módulos productivos; se permiten fixtures de test y prototipo protegido.
- [ ] REP-004 y aceptación PO cubren cada módulo activado; no se declara “100%” por la aceptación parcial del núcleo.


## 18. Orden exacto recomendado de ejecución

Este orden es topológico: toda dependencia aparece antes de su tarea. Es una propuesta para cuando la base y la reanudación hayan sido aceptadas, **no una orden de ejecución automática**. Durante spec025 se detiene tras cada micropaquete para su revisión; insertar COMP-001/002 es revisión de compatibilidad y no altera su allowlist ni abre paquetes posteriores.

La primera tarea es **GOV-001**: fijar la base aceptada y reconciliar la pausa/estado. El primer paquete técnico de baseline es **BASE-001 / MP01**, después de esa reconciliación. Después del cierre de baseline, la primera corrección de código es **FIX-001**, conversión del timeout OIDC.

No iniciar las tareas de evolución integral por haber aceptado QA-010: requieren los contratos/decisiones de la fase correspondiente. Si una aceptación excluye una capacidad de este hito, queda pendiente en el backlog integral, sin eliminarla del producto.

1. **GOV-001** — Reconciliar snapshot local, siete commits de tracking y pausa vigente; fijar la base de auditoría/ejecución aceptada.
2. **GOV-002** — Definir el contrato de entrega del hito: slices operativos, demostrativos declarados y backlog integral protegido.
3. **GOV-003** — Reconciliar INDEX/spec021/handoffs con consentimiento real y código; añadir trazabilidad de 025 sin fabricar aprobaciones.
4. **GOV-004** — Preparar specs de corrección por allowlist y aprobar decisiones materiales; mantener ejecución Claude secuencial.
5. **COMP-001** — Revisar bootstrap del CLI y DML administrativo frente a FORCE; elegir estrategia con tenant confiable sin bypass.
6. **BASE-001** — Spec025 MP01: Topología test
7. **BASE-002** — Spec025 MP02: Guard anti-entorno
8. **BASE-003** — Spec025 MP03: Pruebas del guard
9. **BASE-004** — Spec025 MP04: Migración FORCE forward
10. **BASE-005** — Spec025 MP05: Prueba catálogo FORCE
11. **BASE-006** — Spec025 MP06: Runbook remediación
12. **BASE-007** — Spec025 MP07: Provision test DB
13. **BASE-008** — Spec025 MP08: Preflight runtime/RLS
14. **BASE-009** — Spec025 MP09: Cleanup test DB
15. **BASE-010** — Spec025 MP10: Pruebas lifecycle
16. **BASE-011** — Spec025 MP11: Stale cuarto rol
17. **BASE-012** — Spec025 MP12: Stale branding
18. **BASE-013** — Spec025 MP13: Runner baseline
19. **BASE-014** — Spec025 MP14: Pruebas runner
20. **COMP-002** — Verificar compatibilidad LINK/UNLINK/DISABLE bajo catálogo FORCE y sin contexto residual.
21. **BASE-015** — Spec025 MP15: Provisionar corrida
22. **BASE-016** — Spec025 MP16: Typecheck global
23. **BASE-017** — Spec025 MP17: Unitarias API no DB + health general
24. **BASE-018** — Spec025 MP18: Suite web
25. **BASE-019** — Spec025 MP19: OpenAPI `+1`
26. **BASE-020** — Spec025 MP20: `cold-start-auth.api.test.ts`
27. **BASE-021** — Spec025 MP21: `core-01-hardening.db.test.ts`
28. **BASE-022** — Spec025 MP22: `eloisa-admin-support-foundation.db.test.ts`
29. **BASE-023** — Spec025 MP23: `hospital-agenda.api.test.ts`
30. **BASE-024** — Spec025 MP24: `hospital-core-02.db.test.ts`
31. **BASE-025** — Spec025 MP25: `hospital-institutional-auth.api.test.ts`
32. **BASE-026** — Spec025 MP26: `hospital-patients.api.test.ts`
33. **BASE-027** — Spec025 MP27: `hospital-professionals.api.test.ts`
34. **BASE-028** — Spec025 MP28: `human-auth.api.test.ts`
35. **BASE-029** — Spec025 MP29: `identity-professional-assignment.db.test.ts`
36. **BASE-030** — Spec025 MP30: `municipality.api.test.ts`
37. **BASE-031** — Spec025 MP31: `municipality-aggregates.db.test.ts`
38. **BASE-032** — Spec025 MP32: `patient-enrollment.api.test.ts`
39. **BASE-033** — Spec025 MP33: `patient-enrollment.db.test.ts`
40. **BASE-034** — Spec025 MP34: `patient-self.api.test.ts`
41. **BASE-035** — Spec025 MP35: `patient-self.db.test.ts`
42. **BASE-036** — Spec025 MP36: `runtime-fail-closed.db.test.ts`
43. **BASE-037** — Spec025 MP37: `tenant-bootstrap.db.test.ts`
44. **BASE-038** — Spec025 MP38: `visits.api.test.ts`
45. **BASE-039** — Spec025 MP39: `visits-db-foundation.db.test.ts`
46. **BASE-040** — Spec025 MP40: `visits-materialization.db.test.ts`
47. **BASE-041** — Spec025 MP41: `visits-professional-transitions.db.test.ts`
48. **BASE-042** — Spec025 MP42: Agregación y cleanup
49. **FIX-001** — Corregir conversión ms→s en adapter OIDC y prueba de proveedor lento.
50. **FIX-002** — Incluir método DELETE autorizado en CORS y probar logout institucional cross-origin.
51. **FIX-003** — Propagar 401/403 municipal al gate y retirar contexto/agregados.
52. **FIX-004** — Limpiar listado/analytics Pacientes ante fallo sensible de detalle.
53. **FIX-005** — Limpiar listado/detalle Profesionales ante fallo sensible de autorización/servicio.
54. **FIX-006** — Bloquear paso/rol/campos y conservar snapshot mientras inscripción envía.
55. **FIX-007** — Invalidar lecturas Paciente al cerrar/expirar sesión y rechazar respuesta tardía.
56. **FIX-008** — Limpiar visita/navegación contextual al cambiar/cerrar identidad institucional.
57. **FIX-009** — Mantener buscador/filtros Pacientes montados durante carga.
58. **FIX-010** — Mantener buscador/filtros Profesionales montados durante carga.
59. **FIX-011** — Completar confinamiento de foco del modal Paciente.
60. **FIX-012** — Persistir denegación self concurrente antes de propagar error.
61. **FIX-014** — Añadir política de cache coherente al recibo/inscripción.
62. **FIX-015** — Definir confianza acotada de proxy y separación real de cuotas por cliente.
63. **FIX-016** — Permitir revocación humana segura cuando cuota de login esté agotada.
64. **FIX-017** — Aprobar zona institucional/cortes y criterio de fecha para agenda.
65. **FIX-018** — Alinear ventana/visualización/asignación con decisión de agenda.
66. **FIX-019** — Rotular todos módulos/acciones demo de manera visible y accesible dentro de shell autenticado.
67. **FIX-020** — Aclarar campos Paciente excluidos del contrato y separar inscripción de cuenta en copy.
68. **OPS-001** — Fijar URL pública de API al compilar imagen web y probar bundle.
69. **OPS-002** — Empaquetar recursos public en imagen standalone y comprobar logo/Elí.
70. **OPS-003** — Completar configuración/provisionamiento externo institucional de staging por roles aprobados.
71. **OPS-004** — Hacer check staging del catálogo RLS/FORCE/policies completo, no solo subconjunto.
72. **OPS-005** — Resolver reproducibilidad de Nunito en build sin depender de descarga no controlada.
73. **OPS-006** — Construir y probar imagen exacta API/web desde checkout limpio.
74. **OPS-007** — Ensayar backup/restore coordinado de DB aplicación e identidad en entorno desechable.
75. **OPS-008** — Documentar readiness efectiva de DB/tenant/IdP y recuperación operativa del hito.
76. **QA-001** — Verificar inscripción mínima contra DB aislada, recovery/refresh/errores y payload exacto.
77. **QA-002** — Validar login OIDC real, expiración, refresh y logout en navegador controlado.
78. **QA-003** — Validar origen/CORS/login/logout institucional con Hospital y Alcaldía.
79. **QA-004** — Completar matriz autorización y aislamiento A/B en imagen runtime real.
80. **QA-005** — Validar filtros/paginación/empty/error y limpieza nominal de Pacientes/Profesionales.
81. **QA-006** — Validar Agenda→assignment→materialize→visita→transiciones con dos sesiones reales.
82. **QA-007** — Validar Población/Territorio agregados, supresión y expiración en navegador.
83. **QA-008** — Auditar accesibilidad integral del slice, no solo atributos HTML estáticos.
84. **QA-009** — Consolidar suites/build/scan/gates sin skips ni resultados de otro HEAD.
85. **QA-010** — Preparar aceptación PO por rol/capacidad y runbook de entrega del hito.
86. **QA-011** — Definir automatización CI repetible y matriz de regresión del hito antes de ampliar módulos.
87. **PAT-001** — Especificar edición/desactivación de Person/Patient y revocación de consentimiento, conservando historia.
88. **PAT-002** — Implementar actualización del dataset personal aprobado y conectar formulario de edición autorizado.
89. **PAT-003** — Implementar desactivación/archivo autorizado de paciente con confirmación y revisión de sesiones/relaciones.
90. **PAT-004** — Implementar consulta/ciclo de revocación de consentimiento aprobado y feedback UI.
91. **REL-001** — Especificar portal cuidador y alta/vinculación humana: identidad, validación, scopes y vigencia por paciente.
92. **REL-002** — Conectar gestión institucional de relación pendiente/activar/revocar con API existente.
93. **REL-003** — Implementar lectura cuidador por relación aprobada y conectar selector/lista autorizados.
94. **PRO-001** — Especificar alta/verificación de profesional, afiliación, credenciales y cuenta; no adoptar declaración como certificación.
95. **PRO-002** — Persistir alta profesional/afiliación aprobada y conectar el formulario, errores y consulta posterior.
96. **PRO-003A** — Implementar edición autorizada de profesional/afiliación y feedback persistido.
97. **PRO-003B** — Implementar desactivación autorizada de profesional/afiliación con revisión de asignaciones.
98. **AGD-001** — Especificar creación/reprogramación/cancelación de citas y disponibilidad con zona institucional.
99. **AGD-002** — Implementar creación de solicitud/cita autorizada y conectar formulario de agenda.
100. **AGD-003** — Implementar reprogramación autorizada con historial, versión y actualización de UI.
101. **AGD-004** — Implementar cancelación/declinación autorizada con confirmación y efectos aprobados.
102. **VIS-001** — Reconciliar specs017/018, rama del visitador y alcance real de worklist antes de integrar UI.
103. **VIS-002** — Conectar worklist profesional existente con entrada/restauración sin depender de DTO de agenda efímero.
104. **VIS-003** — Probar worklist→detalle→transiciones, filtros y negativa de visita ajena con dos profesionales.
105. **INST-001** — Especificar instituciones/territorios/configuración delegada y administración de afiliaciones/roles.
106. **INST-002A** — Persistir configuración institucional aprobada y conectar formulario autorizado.
107. **INST-002B** — Persistir catálogo local territorial aprobado y conectar gestión permitida.
108. **INST-003A** — Conectar directorio de personal/cuentas con búsqueda y lectura autorizadas.
109. **INST-003B** — Conectar cambios delegados de acceso conforme al lifecycle de cuentas aprobado.
110. **INST-004** — Especificar exposición soporte/admin MP02 sobre fundación existente y pruebas de alcance temporal.
111. **PRG-001** — Cerrar contrato de programa, población, responsables y estados por institución.
112. **PRG-002** — Añadir persistencia/modelo y migración aditiva de programa aprobado con RLS e historial.
113. **PRG-003** — Conectar creación de borrador de programa con POST real y errores/éxito.
114. **PRG-004** — Conectar listado/detalle/búsqueda/filtros de programas y estados empty/error.
115. **PRG-005A** — Implementar edición/versionado de borrador de programa con feedback de guardado.
116. **PRG-005B** — Implementar transiciones/archivo aprobado de programa con confirmación y auditoría.
117. **PRG-006** — Conectar pertenencia/seguimiento agregado de programa a población municipal y hospitalaria autorizada.
118. **EVI-001** — Especificar documento/evidencia: ownership, finalidad, tipos, size, hash, virus, versiones, retención y acceso.
119. **EVI-002** — Implementar metadatos/provenance y puerto de storage privado para evidencia aprobada.
120. **EVI-003** — Conectar carga autorizada de soporte con validación, progress/error y confirmación.
121. **EVI-004** — Conectar listado/detalle/descarga autorizados de evidencia con auditoría.
122. **EVI-005A** — Implementar corrección/versionado de evidencia conservando versiones y hash.
123. **EVI-005B** — Implementar archivo de evidencia autorizado y lectura de historial sin eliminación física.
124. **EVI-006** — Conectar consulta de auditoría real por dominio/permiso y reemplazar cinco eventos demo.
125. **FIN-001** — Cerrar semántica y permisos de presupuestos/movimientos/soportes y alcance financiero del hito.
126. **FIN-002** — Persistir presupuesto y asignación por institución/programa/fuente/periodo.
127. **FIN-003** — Conectar listado/detalle y edición/versionado de presupuesto a UI Hospital/Alcaldía.
128. **FIN-004** — Persistir ingreso/egreso/gasto autorizado con soporte y ajuste trazable.
129. **FIN-005** — Conectar registro/listado/detalle de movimientos, loading y errores a datos persistidos.
130. **FIN-006** — Persistir proveedor y edición/archivo aprobados con validación y segregación.
131. **FIN-007** — Persistir contrato/convenio con proveedor/programa/periodo y evidence.
132. **FIN-008A** — Conectar tabla/buscador/ficha de proveedores a API real.
133. **FIN-008B** — Conectar tabla/buscador/ficha de contratos a API real.
134. **FIN-009** — Especificar si nómina/honorarios/cuentas de cobro/compras/facturas son referencias o flujos activos y su dataset.
135. **FIN-010A** — Persistir y conectar referencias de nómina aprobadas por periodo, con acceso segregado.
136. **FIN-010B** — Persistir y conectar referencias de honorarios aprobadas y vínculo al soporte.
137. **FIN-010C** — Persistir y conectar cuentas de cobro aprobadas y sus estados.
138. **FIN-010D** — Persistir y conectar referencias de compras aprobadas y relación proveedor/contrato.
139. **FIN-010E** — Persistir y conectar referencias de facturas aprobadas y lectura del soporte.
140. **HUB-001** — Especificar core extensible de marcos/requisitos/aplicabilidad/responsables/brechas/acciones.
141. **HUB-002** — Persistir marcos/requisitos/versiones y aplicabilidad aprobados con tenant/provenance.
142. **HUB-003A** — Conectar vínculo de evidencia al requisito del Hub con lectura/descarga autorizadas.
143. **HUB-003B** — Persistir responsables/vigencia y conectar su asignación al requisito del Hub.
144. **HUB-003C** — Persistir brecha declarada y conectar captura/listado del Hub sin juicio oficial.
145. **HUB-003D** — Persistir plan de acción y estados aprobados, conectados al requisito/brecha.
146. **HUB-004A** — Configurar y conectar vista FURAG/MIPG a requisitos/evidencia versionados.
147. **HUB-004B** — Configurar y conectar vista ADRES a recursos/evidencia autorizados con provenance.
148. **HUB-004C** — Configurar y conectar vista T-319 a obligaciones/evidencia con interpretación aprobada.
149. **HUB-005** — Aprobar catálogo de indicadores/fórmulas/periodos/owners/lineage/supresión por dominio.
150. **FIN-011** — Calcular ejecución/disponible desde movimientos soportados y fórmula versionada aprobada.
151. **HUB-006** — Persistir definiciones y calcular indicadores aprobados desde fuentes operativas.
152. **HUB-007** — Reemplazar series/KPI demo por indicadores autorizados o estado sin datos.
153. **COM-001** — Cerrar catálogo de servicios, planes, entitlements y referencias de cargo/pago autorizados.
154. **COM-002** — Persistir catálogo servicio y planes versionados con permisos/evidencia.
155. **COM-003A** — Conectar creación/edición de servicios y planes al catálogo real con validaciones.
156. **COM-003B** — Conectar listado/detalle/búsqueda de servicios y planes con refresh y errores.
157. **COM-004** — Persistir membresía/entitlement y renovación/cancelación aprobadas.
158. **COM-005** — Registrar referencia manual de cargo/pago soportado y vínculo servicio→prestación→evidencia.
159. **COM-006A** — Aprobar spec de consulta virtual: identidad, proveedor, consentimiento, failure y evidencia.
160. **COM-006B** — Implementar adaptador de sala virtual aprobado y validación de acceso servidor.
161. **COM-006C** — Conectar acceso/cierre de sala y estados virtuales a la UI y verificar provider controlado.
162. **TRN-001** — Cerrar catálogo de formación y autoridad de validación/certificación/SENA con fuente y vigencia.
163. **TRN-002** — Persistir formación y evidencia/certificación aprobadas por cuidador con versión y acceso.
164. **TRN-003** — Conectar agregados/listados de formación y estados verificables a vistas municipales/hospitalarias.
165. **NOT-001** — Especificar bandeja interna/alertas manuales y comunicaciones aprobadas, sin umbrales clínicos del prototipo.
166. **NOT-002** — Persistir alerta/novedad manual y estados leído/atendido con auditoría y destinatario autorizado.
167. **NOT-003** — Conectar acciones y bandejas con API real, quitando mensajes de envío ficticio.
168. **CLN-001** — Cerrar dataset hospitalario/bitácora/calificaciones permitido, provenance y revisión clínica específica.
169. **CLN-002** — Conectar importación/resumen clínico autorizado con evidencia y fallas según contrato de fuente.
170. **CLN-003A** — Conectar captura y lectura autorizadas de bitácora al contrato clínico aprobado.
171. **CLN-003B** — Persistir calificación administrativa aprobada y conectar listado/estadística Hospital.
172. **REP-001** — Especificar reporte/export por audiencia con minimización, fuente, periodo y autorización.
173. **REP-002** — Conectar reportes/tableros operativos a agregados reales con periodo aplicado servidor.
174. **REP-003** — Implementar exportación autorizada y auditada con evidencia del snapshot de datos.
175. **ISA-001** — Cerrar alcance educativo de ISA/Elí y contenido aprobado por flujo, sin convertirlo en diagnóstico.
176. **ISA-002** — Verificar ayuda/gestos/accesibilidad y límite de contenido en módulos operativos.
177. **REP-004** — Auditar producto integral por cada módulo activado con pruebas CRUD/filtros/permisos/lineage y aceptación PO.


## Anexo A. Inventario de endpoints reales

Se extrae de los decoradores de los controllers; la protección depende de guards/servicios y de las matrices de las secciones 3/6/11. No hay endpoints de negocio para las familias demo por aparecer un botón.

| Método | Ruta efectiva | Fuente y línea |
|---|---|---|
| GET | /health | apps/api/src/health/health.controller.ts:23 |
| GET | /api/v1/hospital/agenda | apps/api/src/hospital/hospital-agenda.controller.ts:70 |
| PATCH | /api/v1/hospital/appointments/:appointmentId/assignment | apps/api/src/hospital/hospital-appointment-assignment.controller.ts:95 |
| GET | /api/v1/hospital/patients | apps/api/src/hospital/hospital-patients.controller.ts:97 |
| GET | /api/v1/hospital/patients/analytics | apps/api/src/hospital/hospital-patients.controller.ts:154 |
| GET | /api/v1/hospital/patients/:patientId | apps/api/src/hospital/hospital-patients.controller.ts:201 |
| GET | /api/v1/hospital/professionals | apps/api/src/hospital/hospital-professionals.controller.ts:90 |
| GET | /api/v1/hospital/professionals/:professionalId | apps/api/src/hospital/hospital-professionals.controller.ts:166 |
| GET | /api/v1/human-auth/login | apps/api/src/human-auth/human-auth.controller.ts:85 |
| GET | /api/v1/human-auth/callback | apps/api/src/human-auth/human-auth.controller.ts:112 |
| GET | /api/v1/human-auth/session | apps/api/src/human-auth/human-auth.controller.ts:174 |
| POST | /api/v1/human-auth/logout | apps/api/src/human-auth/human-auth.controller.ts:233 |
| GET | /api/v1/me/contexts | apps/api/src/human-auth/me-contexts.controller.ts:53 |
| POST | /api/v1/institutional/sessions | apps/api/src/institutional-auth/institutional-auth.controller.ts:82 |
| GET | /api/v1/institutional/sessions/current | apps/api/src/institutional-auth/institutional-auth.controller.ts:149 |
| DELETE | /api/v1/institutional/sessions/current | apps/api/src/institutional-auth/institutional-auth.controller.ts:214 |
| GET | /api/v1/municipality/population-summary | apps/api/src/municipality/municipality.controller.ts:70 |
| GET | /api/v1/municipality/territory-summary | apps/api/src/municipality/municipality.controller.ts:111 |
| GET | /api/v1/patient-self/summary | apps/api/src/patient-self/patient-self.controller.ts:81 |
| GET | /api/v1/patient-self/appointments | apps/api/src/patient-self/patient-self.controller.ts:100 |
| GET | /api/v1/patient-self/visits | apps/api/src/patient-self/patient-self.controller.ts:119 |
| POST | /api/v1/patients/enrollments | apps/api/src/patients/patient-enrollment.controller.ts:73 |
| GET | /api/v1/patients/me | apps/api/src/patients/patient-enrollment.controller.ts:149 |
| POST | /api/v1/caregiver-relationships | apps/api/src/people-relationships/caregiver-relationship.controller.ts:105 |
| GET | /api/v1/caregiver-relationships/:relationshipId | apps/api/src/people-relationships/caregiver-relationship.controller.ts:160 |
| PATCH | /api/v1/caregiver-relationships/:relationshipId/activate | apps/api/src/people-relationships/caregiver-relationship.controller.ts:203 |
| PATCH | /api/v1/caregiver-relationships/:relationshipId/revoke | apps/api/src/people-relationships/caregiver-relationship.controller.ts:263 |
| POST | /api/v1/visits/materialize | apps/api/src/visits/visits.controller.ts:149 |
| GET | /api/v1/professional/visits | apps/api/src/visits/visits.controller.ts:283 |
| GET | /api/v1/professional/visits/:visitId | apps/api/src/visits/visits.controller.ts:352 |
| PATCH | /api/v1/professional/visits/:visitId/status | apps/api/src/visits/visits.controller.ts:404 |

**Total: 31 endpoints declarados.** La worklist profesional GET /api/v1/professional/visits existe en backend; la ausencia de portal autónomo no equivale a ausencia de ese endpoint. Soporte MP02 aún no expone un controller operativo.

## Anexo B. Modelos, campos, claves y estados

Inventario estático completo de los **26 modelos** de prisma/schema.prisma. La tabla incluye campos Prisma de relación, que no son necesariamente columnas físicas. Las relaciones/keys compuestas y constraints SQL deben verificarse también en migraciones y catálogo DB. No hay modelo paralelo de paciente por portal ni denominación de permiso derivada del nombre de una pantalla.

| Modelo / tabla | Campos y tipos declarados | Identificadores, unicidad y FK declaradas en Prisma |
|---|---|---|
| Tenant / tenant; schema.prisma:242 | id:String, code:String, name:String, createdAt:DateTime, updatedAt:DateTime, people:Person[], patients:Patient[], territorialUnits:TerritorialUnit[], patientAddresses:PatientAddress[], consentRecords:ConsentRecord[], enrollmentSessions:EnrollmentSession[], auditEvents:AuditEvent[], institutionalIdentities:InstitutionalIdentity[], institutionalSessions:InstitutionalSession[], professionalProfiles:ProfessionalProfile[], professionalAffiliations:ProfessionalAffiliation[], careAssignments:CareAssignment[], appointments:Appointment[], humanAccounts:HumanAccount[], externalAuthIdentities:ExternalAuthIdentity[], humanSessions:HumanSession[], humanAuthAttempts:HumanAuthAttempt[], caregiverRelationships:PatientCaregiverRelationship[], caregiverRelationshipScopes:PatientCaregiverRelationshipScope[], homeVisits:HomeVisit[], homeVisitTransitions:HomeVisitTransition[], platformSupportCapabilities:PlatformSupportCapability[], supportGrantsAsHomeTenant:SupportGrant[], supportGrantsAsTargetTenant:SupportGrant[], supportContextSessions:SupportContextSession[], auditEventsAsSupportActorHome:AuditEvent[] | id        String   @id @default(uuid(7)) @db.Uuid<br>code      String   @unique<br>auditEvents AuditEvent[] @relation("AuditEventTenant")<br>supportGrantsAsHomeTenant SupportGrant[] @relation("SupportGrantHomeTenant")<br>supportGrantsAsTargetTenant SupportGrant[] @relation("SupportGrantTargetTenant")<br>auditEventsAsSupportActorHome AuditEvent[] @relation("AuditEventActorHomeTenant") |
| Person / person; schema.prisma:302 | id:String, tenantId:String, documentType:DocumentType, documentNumber:String, documentNumberNormalized:String, givenNames:String, familyNames:String, birthDate:DateTime, sexGenderCode:SexGenderCode, phone:String?, email:String?, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, patient:Patient?, professionalProfile:ProfessionalProfile?, humanAccounts:HumanAccount[], caregiverRelationships:PatientCaregiverRelationship[] | id       String @id @default(uuid(7)) @db.Uuid<br>@@unique([tenantId, documentType, documentNumberNormalized], map: "person_tenant_document_unique")<br>@@unique([id, tenantId], map: "person_id_tenant_unique")<br>@@unique([tenantId, documentType, documentNumberNormalized], map: "person_tenant_document_unique")<br>@@unique([id, tenantId], map: "person_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>caregiverRelationships PatientCaregiverRelationship[] @relation("CaregiverPerson") |
| Patient / patient; schema.prisma:349 | id:String, tenantId:String, personId:String, epsCode:String, epsNameControlled:String, status:PatientStatus, origin:PatientOrigin, enrolledAt:DateTime, createdByUserId:String?, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, person:Person, populationMemberships:PatientPopulationMembership[], address:PatientAddress?, consentRecords:ConsentRecord[], enrollmentSessions:EnrollmentSession[], careAssignments:CareAssignment[], appointments:Appointment[], caregiverRelationships:PatientCaregiverRelationship[], homeVisits:HomeVisit[] | id       String @id @default(uuid(7)) @db.Uuid<br>@@unique([personId, tenantId], map: "patient_person_tenant_unique")<br>@@unique([id, tenantId], map: "patient_id_tenant_unique")<br>@@unique([personId, tenantId], map: "patient_person_tenant_unique")<br>@@unique([id, tenantId], map: "patient_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>person Person @relation(fields: [personId, tenantId], references: [id, tenantId], onDelete: Restrict) |
| PatientPopulationMembership / patient_population_membership; schema.prisma:390 | patientId:String, tenantId:String, populationType:PopulationType, source:PopulationSource, createdAt:DateTime, patient:Patient | @@id([patientId, populationType])<br>patient Patient @relation(fields: [patientId, tenantId], references: [id, tenantId], onDelete: Cascade) |
| TerritorialUnit / territorial_unit; schema.prisma:422 | id:String, tenantId:String?, parentId:String?, type:TerritorialUnitType, officialCode:String?, normalizedName:String, displayName:String, status:TerritorialUnitStatus, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant?, parent:TerritorialUnit?, children:TerritorialUnit[], addressesAsDepartment:PatientAddress[], addressesAsMunicipality:PatientAddress[], addressesAsLocalUnit:PatientAddress[] | id       String  @id @default(uuid(7)) @db.Uuid<br>@@unique([type, officialCode], map: "territorial_unit_type_official_code_unique")<br>@@unique([tenantId, parentId, type, normalizedName], map: "territorial_unit_scope_name_unique")<br>@@unique([type, officialCode], map: "territorial_unit_type_official_code_unique")<br>@@unique([tenantId, parentId, type, normalizedName], map: "territorial_unit_scope_name_unique")<br>tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>parent TerritorialUnit? @relation("TerritorialUnitHierarchy", fields: [parentId], references: [id], onDelete: Restrict)<br>children TerritorialUnit[] @relation("TerritorialUnitHierarchy")<br>addressesAsDepartment PatientAddress[] @relation("PatientAddressDepartment")<br>addressesAsMunicipality PatientAddress[] @relation("PatientAddressMunicipality")<br>addressesAsLocalUnit PatientAddress[] @relation("PatientAddressLocalUnit") |
| PatientAddress / patient_address; schema.prisma:459 | id:String, tenantId:String, patientId:String, departmentUnitId:String, municipalityUnitId:String, localUnitId:String?, areaType:AreaType, localityPendingNormalization:Boolean, localityUnverifiedText:String?, settlementUnverifiedText:String?, exactAddress:String, directions:String?, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, patient:Patient, departmentUnit:TerritorialUnit, municipalityUnit:TerritorialUnit, localUnit:TerritorialUnit? | id        String @id @default(uuid(7)) @db.Uuid<br>@@unique([patientId, tenantId], map: "patient_address_patient_unique")<br>@@unique([patientId, tenantId], map: "patient_address_patient_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>patient Patient @relation(fields: [patientId, tenantId], references: [id, tenantId], onDelete: Cascade)<br>departmentUnit TerritorialUnit @relation("PatientAddressDepartment", fields: [departmentUnitId], references: [id], onDelete: Restrict)<br>municipalityUnit TerritorialUnit @relation("PatientAddressMunicipality", fields: [municipalityUnitId], references: [id], onDelete: Restrict)<br>localUnit TerritorialUnit? @relation("PatientAddressLocalUnit", fields: [localUnitId], references: [id], onDelete: Restrict) |
| ConsentRecord / consent_record; schema.prisma:517 | id:String, tenantId:String, patientId:String, consentVersion:String, consentType:ConsentType, purpose:String, acceptedAt:DateTime, createdAt:DateTime, tenant:Tenant, patient:Patient | id        String @id @default(uuid(7)) @db.Uuid<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>patient Patient @relation(fields: [patientId, tenantId], references: [id, tenantId], onDelete: Cascade) |
| EnrollmentSession / enrollment_session; schema.prisma:551 | id:String, tenantId:String, patientId:String, tokenHash:String, expiresAt:DateTime, createdAt:DateTime, lastUsedAt:DateTime?, revokedAt:DateTime?, tenant:Tenant, patient:Patient | id        String @id @default(uuid(7)) @db.Uuid<br>tokenHash String @unique<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>patient Patient @relation(fields: [patientId, tenantId], references: [id, tenantId], onDelete: Cascade) |
| AuditEvent / audit_event; schema.prisma:587 | id:String, tenantId:String, eventType:AuditEventType, actorType:AuditActorType, actorUserId:String?, actorRole:InstitutionalRole?, resourceType:String, resourceId:String?, outcome:AuditOutcome, endpoint:String?, correlationId:String?, actorHomeTenantId:String?, supportGrantId:String?, supportContextSessionId:String?, supportReason:String?, supportTicketReference:String?, occurredAt:DateTime, tenant:Tenant, actorHomeTenant:Tenant?, supportGrant:SupportGrant?, supportContextSession:SupportContextSession? | id       String @id @default(uuid(7)) @db.Uuid<br>tenant Tenant @relation("AuditEventTenant", fields: [tenantId], references: [id], onDelete: Restrict)<br>actorHomeTenant Tenant? @relation("AuditEventActorHomeTenant", fields: [actorHomeTenantId], references: [id], onDelete: Restrict)<br>supportGrant SupportGrant? @relation(fields: [supportGrantId], references: [id], onDelete: NoAction)<br>supportContextSession SupportContextSession? @relation(fields: [supportContextSessionId], references: [id], onDelete: NoAction) |
| InstitutionalIdentity / institutional_identity; schema.prisma:681 | id:String, tenantId:String, code:String, role:InstitutionalRole, status:InstitutionalIdentityStatus, accessSecretHash:String, accessSecretSalt:String, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, sessions:InstitutionalSession[], createdCareAssignments:CareAssignment[], validatedCaregiverRelationships:PatientCaregiverRelationship[], revokedCaregiverRelationships:PatientCaregiverRelationship[], createdHomeVisits:HomeVisit[] | id       String @id @default(uuid(7)) @db.Uuid<br>@@unique([tenantId, code], map: "institutional_identity_tenant_code_unique")<br>@@unique([id, tenantId], map: "institutional_identity_id_tenant_unique")<br>@@unique([tenantId, code], map: "institutional_identity_tenant_code_unique")<br>@@unique([id, tenantId], map: "institutional_identity_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>validatedCaregiverRelationships PatientCaregiverRelationship[] @relation("CaregiverRelationshipValidator")<br>revokedCaregiverRelationships PatientCaregiverRelationship[] @relation("CaregiverRelationshipRevoker") |
| InstitutionalSession / institutional_session; schema.prisma:727 | id:String, tenantId:String, identityId:String, tokenHash:String, expiresAt:DateTime, createdAt:DateTime, lastUsedAt:DateTime?, revokedAt:DateTime?, tenant:Tenant, identity:InstitutionalIdentity | id         String @id @default(uuid(7)) @db.Uuid<br>tokenHash String @unique<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>identity InstitutionalIdentity @relation(fields: [identityId, tenantId], references: [id, tenantId], onDelete: Cascade) |
| ProfessionalProfile / professional_profile; schema.prisma:817 | id:String, tenantId:String, personId:String, professionCode:String, professionNameControlled:String, status:ProfessionalStatus, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, person:Person, affiliations:ProfessionalAffiliation[], careAssignments:CareAssignment[] | id       String @id @default(uuid(7)) @db.Uuid<br>@@unique([personId, tenantId], map: "professional_profile_person_tenant_unique")<br>@@unique([id, tenantId], map: "professional_profile_id_tenant_unique")<br>@@unique([personId, tenantId], map: "professional_profile_person_tenant_unique")<br>@@unique([id, tenantId], map: "professional_profile_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>person Person @relation(fields: [personId, tenantId], references: [id, tenantId], onDelete: Cascade) |
| ProfessionalAffiliation / professional_affiliation; schema.prisma:851 | id:String, tenantId:String, professionalId:String, engagementType:ProfessionalEngagementType, status:ProfessionalAffiliationStatus, startsOn:DateTime, endsOn:DateTime?, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, professional:ProfessionalProfile | id             String @id @default(uuid(7)) @db.Uuid<br>@@unique([id, tenantId], map: "professional_affiliation_id_tenant_unique")<br>@@unique([id, tenantId], map: "professional_affiliation_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>professional ProfessionalProfile @relation(fields: [professionalId, tenantId], references: [id, tenantId], onDelete: Cascade) |
| CareAssignment / care_assignment; schema.prisma:883 | id:String, tenantId:String, patientId:String, professionalId:String, role:CareAssignmentRole, status:CareAssignmentStatus, startsAt:DateTime, endsAt:DateTime?, createdByIdentityId:String, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, patient:Patient, professional:ProfessionalProfile, createdByIdentity:InstitutionalIdentity, appointments:Appointment[], homeVisits:HomeVisit[] | id             String @id @default(uuid(7)) @db.Uuid<br>@@unique([id, tenantId], map: "care_assignment_id_tenant_unique")<br>@@unique([id, tenantId], map: "care_assignment_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>patient Patient @relation(fields: [patientId, tenantId], references: [id, tenantId], onDelete: Cascade)<br>professional ProfessionalProfile @relation(fields: [professionalId, tenantId], references: [id, tenantId], onDelete: Restrict)<br>createdByIdentity InstitutionalIdentity @relation(fields: [createdByIdentityId, tenantId], references: [id, tenantId], onDelete: Restrict) |
| Appointment / appointment; schema.prisma:923 | id:String, tenantId:String, patientId:String, careAssignmentId:String?, modality:AppointmentModality, status:AppointmentStatus, requestedAt:DateTime, scheduledStart:DateTime?, version:Int, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, patient:Patient, careAssignment:CareAssignment?, homeVisit:HomeVisit? | id               String  @id @default(uuid(7)) @db.Uuid<br>@@unique([id, tenantId], map: "appointment_id_tenant_unique")<br>@@unique([id, tenantId], map: "appointment_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>patient Patient @relation(fields: [patientId, tenantId], references: [id, tenantId], onDelete: Cascade)<br>careAssignment CareAssignment? @relation(fields: [careAssignmentId, tenantId], references: [id, tenantId], onDelete: NoAction) |
| HumanAccount / human_account; schema.prisma:1036 | id:String, tenantId:String, personId:String, status:HumanAccountStatus, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, person:Person, externalIdentities:ExternalAuthIdentity[], sessions:HumanSession[], homeVisitTransitions:HomeVisitTransition[], platformSupportCapabilities:PlatformSupportCapability[], supportContextSessions:SupportContextSession[] | id       String @id @default(uuid(7)) @db.Uuid<br>@@unique([id, tenantId], map: "human_account_id_tenant_unique")<br>@@unique([id, tenantId], map: "human_account_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>person Person @relation(fields: [personId, tenantId], references: [id, tenantId], onDelete: Restrict) |
| ExternalAuthIdentity / external_auth_identity; schema.prisma:1079 | id:String, tenantId:String, humanAccountId:String, issuer:String, subject:String, status:ExternalAuthIdentityStatus, linkedAt:DateTime, unlinkedAt:DateTime?, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, account:HumanAccount | id             String @id @default(uuid(7)) @db.Uuid<br>@@unique([id, tenantId], map: "external_auth_identity_id_tenant_unique")<br>@@unique([tenantId, issuer, subject], map: "external_auth_identity_tenant_issuer_subject_unique")<br>@@unique([id, tenantId], map: "external_auth_identity_id_tenant_unique")<br>@@unique([tenantId, issuer, subject], map: "external_auth_identity_tenant_issuer_subject_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>account HumanAccount @relation(fields: [humanAccountId, tenantId], references: [id, tenantId], onDelete: Restrict) |
| HumanSession / human_session; schema.prisma:1117 | id:String, tenantId:String, humanAccountId:String, tokenHash:String, expiresAt:DateTime, createdAt:DateTime, lastUsedAt:DateTime?, revokedAt:DateTime?, tenant:Tenant, account:HumanAccount, supportContextSessions:SupportContextSession[] | id             String @id @default(uuid(7)) @db.Uuid<br>tokenHash String @unique<br>@@unique([id, tenantId], map: "human_session_id_tenant_unique")<br>@@unique([id, humanAccountId, tenantId], map: "human_session_id_account_tenant_unique")<br>@@unique([id, tenantId], map: "human_session_id_tenant_unique")<br>@@unique([id, humanAccountId, tenantId], map: "human_session_id_account_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>account HumanAccount @relation(fields: [humanAccountId, tenantId], references: [id, tenantId], onDelete: Restrict) |
| HumanAuthAttempt / human_auth_attempt; schema.prisma:1156 | id:String, tenantId:String, browserTokenHash:String, stateHash:String, nonceHash:String, pkceVerifierCiphertext:String, pkceVerifierIv:String, pkceVerifierAuthTag:String, returnTarget:String, createdAt:DateTime, expiresAt:DateTime, consumedAt:DateTime?, tenant:Tenant | id       String @id @default(uuid(7)) @db.Uuid<br>browserTokenHash String @unique<br>stateHash        String @unique<br>@@unique([id, tenantId], map: "human_auth_attempt_id_tenant_unique")<br>@@unique([id, tenantId], map: "human_auth_attempt_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict) |
| PatientCaregiverRelationship / patient_caregiver_relationship; schema.prisma:1198 | id:String, tenantId:String, patientId:String, caregiverPersonId:String, relationshipType:PatientCaregiverRelationshipType, purpose:PatientCaregiverPurpose, status:PatientCaregiverRelationshipStatus, startsAt:DateTime, endsAt:DateTime?, validationSource:CaregiverRelationshipValidationSource, authorizationReference:String, validatedByInstitutionalIdentityId:String?, validatedAt:DateTime?, revokedByInstitutionalIdentityId:String?, revokedAt:DateTime?, revocationReason:CaregiverRelationshipRevocationReason?, version:Int, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, patient:Patient, caregiverPerson:Person, validatedByIdentity:InstitutionalIdentity?, revokedByIdentity:InstitutionalIdentity?, scopes:PatientCaregiverRelationshipScope[] | id                String @id @default(uuid(7)) @db.Uuid<br>@@unique([id, tenantId], map: "patient_caregiver_relationship_id_tenant_unique")<br>@@unique([id, tenantId], map: "patient_caregiver_relationship_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>patient Patient @relation(fields: [patientId, tenantId], references: [id, tenantId], onDelete: Restrict)<br>caregiverPerson Person @relation("CaregiverPerson", fields: [caregiverPersonId, tenantId], references: [id, tenantId], onDelete: Restrict)<br>validatedByIdentity InstitutionalIdentity? @relation("CaregiverRelationshipValidator", fields: [validatedByInstitutionalIdentityId, tenantId], references: [id, tenantId], onDelete: Restrict)<br>revokedByIdentity InstitutionalIdentity? @relation("CaregiverRelationshipRevoker", fields: [revokedByInstitutionalIdentityId, tenantId], references: [id, tenantId], onDelete: Restrict) |
| PatientCaregiverRelationshipScope / patient_caregiver_relationship_scope; schema.prisma:1255 | id:String, tenantId:String, relationshipId:String, scope:CaregiverScope, createdAt:DateTime, tenant:Tenant, relationship:PatientCaregiverRelationship | id             String @id @default(uuid(7)) @db.Uuid<br>@@unique([id, tenantId], map: "patient_caregiver_relationship_scope_id_tenant_unique")<br>@@unique([relationshipId, tenantId, scope], map: "patient_caregiver_relationship_scope_unique")<br>@@unique([id, tenantId], map: "patient_caregiver_relationship_scope_id_tenant_unique")<br>@@unique([relationshipId, tenantId, scope], map: "patient_caregiver_relationship_scope_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>relationship PatientCaregiverRelationship @relation(fields: [relationshipId, tenantId], references: [id, tenantId], onDelete: Cascade) |
| HomeVisit / home_visit; schema.prisma:1315 | id:String, tenantId:String, appointmentId:String, patientId:String, careAssignmentId:String, status:HomeVisitStatus, version:Int, startedAt:DateTime?, endedAt:DateTime?, createdByInstitutionalIdentityId:String, createdAt:DateTime, updatedAt:DateTime, tenant:Tenant, appointment:Appointment, patient:Patient, careAssignment:CareAssignment, createdByInstitutionalIdentity:InstitutionalIdentity, transitions:HomeVisitTransition[] | id               String @id @default(uuid(7)) @db.Uuid<br>@@unique([id, tenantId], map: "home_visit_id_tenant_unique")<br>@@unique([appointmentId, tenantId], map: "home_visit_appointment_tenant_unique")<br>@@unique([id, tenantId], map: "home_visit_id_tenant_unique")<br>@@unique([appointmentId, tenantId], map: "home_visit_appointment_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>appointment Appointment @relation(fields: [appointmentId, tenantId], references: [id, tenantId], onDelete: NoAction)<br>patient Patient @relation(fields: [patientId, tenantId], references: [id, tenantId], onDelete: Restrict)<br>careAssignment CareAssignment @relation(fields: [careAssignmentId, tenantId], references: [id, tenantId], onDelete: NoAction)<br>createdByInstitutionalIdentity InstitutionalIdentity @relation(fields: [createdByInstitutionalIdentityId, tenantId], references: [id, tenantId], onDelete: Restrict) |
| HomeVisitTransition / home_visit_transition; schema.prisma:1367 | id:String, tenantId:String, homeVisitId:String, fromStatus:HomeVisitStatus?, toStatus:HomeVisitStatus, performedByHumanAccountId:String?, occurredAt:DateTime, createdAt:DateTime, tenant:Tenant, homeVisit:HomeVisit, performedByHumanAccount:HumanAccount? | id          String @id @default(uuid(7)) @db.Uuid<br>@@unique([id, tenantId], map: "home_visit_transition_id_tenant_unique")<br>@@unique([id, tenantId], map: "home_visit_transition_id_tenant_unique")<br>tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)<br>homeVisit HomeVisit @relation(fields: [homeVisitId, tenantId], references: [id, tenantId], onDelete: Restrict)<br>performedByHumanAccount HumanAccount? @relation(fields: [performedByHumanAccountId, tenantId], references: [id, tenantId], onDelete: Restrict) |
| PlatformSupportCapability / platform_support_capability; schema.prisma:1448 | id:String, homeTenantId:String, humanAccountId:String, status:PlatformSupportCapabilityStatus, createdAt:DateTime, updatedAt:DateTime, disabledAt:DateTime?, homeTenant:Tenant, account:HumanAccount, grants:SupportGrant[] | id String @id @default(uuid(7)) @db.Uuid<br>@@unique([id, homeTenantId], map: "platform_support_capability_id_home_tenant_unique")<br>@@unique([homeTenantId, humanAccountId], map: "platform_support_capability_account_unique")<br>@@unique([id, homeTenantId], map: "platform_support_capability_id_home_tenant_unique")<br>@@unique([homeTenantId, humanAccountId], map: "platform_support_capability_account_unique")<br>homeTenant Tenant @relation(fields: [homeTenantId], references: [id], onDelete: Restrict)<br>account HumanAccount @relation(fields: [humanAccountId, homeTenantId], references: [id, tenantId], onDelete: Restrict) |
| SupportGrant / support_grant; schema.prisma:1494 | id:String, homeTenantId:String, platformSupportCapabilityId:String, targetTenantId:String, scope:SupportGrantScope, status:SupportGrantStatus, validFrom:DateTime?, validUntil:DateTime?, createdAt:DateTime, updatedAt:DateTime, revokedAt:DateTime?, homeTenant:Tenant, targetTenant:Tenant, capability:PlatformSupportCapability, contextSessions:SupportContextSession[], auditEvents:AuditEvent[] | id String @id @default(uuid(7)) @db.Uuid<br>@@unique([id, homeTenantId], map: "support_grant_id_home_tenant_unique")<br>@@unique([id, homeTenantId, targetTenantId], map: "support_grant_id_home_target_unique")<br>@@unique([id, homeTenantId], map: "support_grant_id_home_tenant_unique")<br>@@unique([id, homeTenantId, targetTenantId], map: "support_grant_id_home_target_unique")<br>homeTenant Tenant @relation("SupportGrantHomeTenant", fields: [homeTenantId], references: [id], onDelete: Restrict)<br>targetTenant Tenant @relation("SupportGrantTargetTenant", fields: [targetTenantId], references: [id], onDelete: Restrict)<br>capability PlatformSupportCapability @relation(fields: [platformSupportCapabilityId, homeTenantId], references: [id, homeTenantId], onDelete: Restrict) |
| SupportContextSession / support_context_session; schema.prisma:1560 | id:String, homeTenantId:String, humanAccountId:String, humanSessionId:String, supportGrantId:String, targetTenantId:String, tokenHash:String, reason:String, ticketReference:String?, createdAt:DateTime, expiresAt:DateTime, lastUsedAt:DateTime?, revokedAt:DateTime?, homeTenant:Tenant, account:HumanAccount, humanSession:HumanSession, grant:SupportGrant, auditEvents:AuditEvent[] | id String @id @default(uuid(7)) @db.Uuid<br>tokenHash String @unique<br>@@unique([id, homeTenantId], map: "support_context_session_id_home_tenant_unique")<br>@@unique([id, homeTenantId], map: "support_context_session_id_home_tenant_unique")<br>homeTenant Tenant @relation(fields: [homeTenantId], references: [id], onDelete: Restrict)<br>account HumanAccount @relation(fields: [humanAccountId, homeTenantId], references: [id, tenantId], onDelete: Restrict)<br>humanSession HumanSession @relation(fields: [humanSessionId, humanAccountId, homeTenantId], references: [id, humanAccountId, tenantId], onDelete: Restrict)<br>grant SupportGrant @relation(fields: [supportGrantId, homeTenantId, targetTenantId], references: [id, homeTenantId, targetTenantId], onDelete: Restrict) |

### Catálogos de estados y códigos

| Enum | Valores vigentes |
|---|---|
| DocumentType | CEDULA_CIUDADANIA, CEDULA_EXTRANJERIA, PASAPORTE, PERMISO_PROTECCION_TEMPORAL, OTRO |
| SexGenderCode | FEMENINO, MASCULINO, OTRO, PREFIERE_NO_DECIRLO |
| PatientStatus | ACTIVE |
| PatientOrigin | PUBLIC_SELF_ENROLLMENT |
| PopulationType | OLDER_ADULT_60_PLUS, DISABILITY, HOME_CARE_REQUIRED |
| PopulationSource | DECLARED, DERIVED_BIRTH_DATE |
| TerritorialUnitType | DEPARTMENT, MUNICIPALITY, NEIGHBORHOOD, RURAL_SETTLEMENT |
| TerritorialUnitStatus | ACTIVE, INACTIVE |
| AreaType | URBAN, RURAL |
| ConsentType | PERSONAL_AND_HEALTH_DATA_PROCESSING |
| AuditEventType | PATIENT_ENROLLMENT_CREATED, INSTITUTIONAL_SESSION_CREATED, INSTITUTIONAL_SESSION_REVOKED, MUNICIPAL_AGGREGATE_ACCESS_GRANTED, MUNICIPAL_AGGREGATE_ACCESS_DENIED, HOSPITAL_PATIENT_LIST_ACCESS_GRANTED, HOSPITAL_PATIENT_DETAIL_ACCESS_GRANTED, HOSPITAL_PATIENT_ANALYTICS_ACCESS_GRANTED, HOSPITAL_PATIENT_ACCESS_DENIED, HOSPITAL_PROFESSIONAL_LIST_ACCESS_GRANTED, HOSPITAL_PROFESSIONAL_DETAIL_ACCESS_GRANTED, HOSPITAL_AGENDA_ACCESS_GRANTED, CARE_ASSIGNMENT_CREATED, APPOINTMENT_ASSIGNED, HOSPITAL_OPERATIONS_ACCESS_DENIED, HUMAN_IDENTITY_LINKED, HUMAN_IDENTITY_UNLINKED, HUMAN_ACCOUNT_DISABLED, HUMAN_SESSION_CREATED, HUMAN_SESSION_REVOKED, CAREGIVER_RELATIONSHIP_CREATED, CAREGIVER_RELATIONSHIP_VALIDATED, CAREGIVER_RELATIONSHIP_REVOKED, HOME_VISIT_MATERIALIZED, HOME_VISIT_STARTED, HOME_VISIT_COMPLETED, HOME_VISIT_NOT_COMPLETED, PLATFORM_SUPPORT_CAPABILITY_CREATED, PLATFORM_SUPPORT_CAPABILITY_DISABLED, SUPPORT_GRANT_CREATED, SUPPORT_GRANT_REVOKED, SUPPORT_CONTEXT_ENTRY_GRANTED, SUPPORT_CONTEXT_ENTRY_DENIED, SUPPORT_CONTEXT_EXITED, SUPPORT_CONTEXT_EXPIRED, SUPPORT_CONTEXT_REVOKED, SUPPORT_PATIENT_READ_GRANTED, SUPPORT_PATIENT_READ_DENIED, SUPPORT_PROFESSIONAL_READ_GRANTED, SUPPORT_PROFESSIONAL_READ_DENIED, SUPPORT_AGENDA_READ_GRANTED, SUPPORT_AGENDA_READ_DENIED, SUPPORT_HOME_VISIT_READ_GRANTED, SUPPORT_HOME_VISIT_READ_DENIED, SUPPORT_OPERATIONAL_AUDIT_READ_GRANTED, SUPPORT_OPERATIONAL_AUDIT_READ_DENIED, PATIENT_SELF_ACCESS_GRANTED, PATIENT_SELF_ACCESS_DENIED |
| AuditActorType | PUBLIC_SELF_ENROLLMENT, INSTITUTIONAL_IDENTITY, UNAUTHENTICATED, HUMAN_ACCOUNT, SYSTEM |
| AuditOutcome | SUCCESS, DENIED |
| InstitutionalRole | MUNICIPAL_VIEWER, HOSPITAL_PATIENT_VIEWER, HOSPITAL_SCHEDULER, CAREGIVER_RELATIONSHIP_MANAGER |
| InstitutionalIdentityStatus | ACTIVE, DISABLED |
| ProfessionalStatus | ACTIVE, INACTIVE |
| ProfessionalEngagementType | EMPLOYEE, INDEPENDENT, THIRD_PARTY |
| ProfessionalAffiliationStatus | ACTIVE, INACTIVE, ENDED |
| CareAssignmentRole | PRIMARY |
| CareAssignmentStatus | ACTIVE, ENDED |
| AppointmentModality | ON_SITE, HOME, VIRTUAL |
| AppointmentStatus | REQUESTED, ASSIGNED, CANCELLED |
| HumanAccountStatus | ACTIVE, DISABLED |
| ExternalAuthIdentityStatus | ACTIVE, UNLINKED |
| PatientCaregiverRelationshipType | DECLARED_CARE_SUPPORT |
| PatientCaregiverPurpose | HOME_CARE_COORDINATION |
| PatientCaregiverRelationshipStatus | PENDING_VALIDATION, ACTIVE, REVOKED, EXPIRED |
| CaregiverScope | VISITS_VIEW |
| CaregiverRelationshipValidationSource | CONTROLLED_MVP_OPERATOR_ASSERTION |
| CaregiverRelationshipRevocationReason | AUTHORIZATION_WITHDRAWN, RELATIONSHIP_ENDED, CREATED_IN_ERROR |
| HomeVisitStatus | SCHEDULED, IN_PROGRESS, COMPLETED, NOT_COMPLETED |
| PlatformSupportCapabilityStatus | ACTIVE, DISABLED |
| SupportGrantScope | HOSPITAL_OPERATIONAL_READ |
| SupportGrantStatus | ACTIVE, REVOKED |

Estos nombres no demuestran integración con EPS, DIVIPOLA online, formación externa o autoridades institucionales. Person/documentNumberNormalized y claves compuestas sirven a integridad/aislamiento; issuer+subject identifica vínculo externo, tokenHash almacena referencia opaca de sesión. Ninguna columna de password humano MERDN fue encontrada. TerritorialUnit permite ámbito global controlado y ámbito local por tenant, no acceso nominal cruzado.

## Anexo C. Índice de marcadores en código y fixtures

Búsqueda sobre 291 archivos fuente escritos a mano; 169 archivos tienen al menos una coincidencia. Patrones: mock/mocks/fake/dummy/demo/hardcoded/sample/example/ejemplo/test data/TODO/FIXME/fictici*/demostrativ*/temporal/placeholder/fixture/Not implemented. Se excluyen dependencias, outputs y cliente generado; los tests y el prototipo tienen propósito distinto. **Esta tabla es navegación de evidencia, no 169 bugs.** Se citan hasta doce líneas iniciales y el total de líneas coincidentes por archivo; las fuentes de negocio confirmadas están clasificadas en §12.

| Archivo existente | Líneas iniciales | Líneas coincidentes |
|---|---|---|
| apps/api/src/audit/audit.service.ts | 187 | 1 |
| apps/api/src/audit/identity-audit.service.ts | 40 | 1 |
| apps/api/src/config/environment.ts | 118 | 1 |
| apps/api/src/database/prisma.service.ts | 32 | 1 |
| apps/api/src/health/health-response.dto.ts | 17 | 1 |
| apps/api/src/hospital/hospital-agenda.dto.ts | 20, 31, 43, 54, 61, 70, 75, 78, 119 | 9 |
| apps/api/src/hospital/hospital-appointment-assignment.controller.ts | 80, 102 | 2 |
| apps/api/src/hospital/hospital-appointment-assignment.dto.ts | 35, 44, 51, 54, 62, 66, 72, 85 | 8 |
| apps/api/src/hospital/hospital-appointment-assignment.origin.ts | 57 | 1 |
| apps/api/src/hospital/hospital-appointment-assignment.service.ts | 33 | 1 |
| apps/api/src/hospital/hospital-patients.dto.ts | 26, 34, 40, 50, 58, 66, 74, 102, 111, 118, 125, 129 … | 30 |
| apps/api/src/hospital/hospital-patients.projection.ts | 36, 177 | 2 |
| apps/api/src/hospital/hospital-patients.service.ts | 335, 389 | 2 |
| apps/api/src/hospital/hospital-professionals.dto.ts | 37, 52, 82, 87, 113, 121, 129, 138, 149, 155, 161, 164 … | 21 |
| apps/api/src/hospital/hospital-professionals.service.ts | 266, 297 | 2 |
| apps/api/src/hospital/hospital.contract.ts | 305, 486 | 2 |
| apps/api/src/human-auth/human-auth.config.ts | 185, 253 | 2 |
| apps/api/src/human-auth/human-auth.contract.ts | 94, 155, 174 | 3 |
| apps/api/src/human-auth/human-auth.dto.ts | 16, 25, 33, 44, 57, 69, 75 | 7 |
| apps/api/src/human-auth/human-auth.service.ts | 424 | 1 |
| apps/api/src/identity-access/identity-access.service.ts | 124 | 1 |
| apps/api/src/institutional-auth/institutional-auth.contract.ts | 147 | 1 |
| apps/api/src/institutional-auth/institutional-auth.dto.ts | 23, 36, 47, 53, 64, 82, 88, 101, 102, 110, 116 | 11 |
| apps/api/src/institutional-auth/institutional-auth.service.ts | 95, 353 | 2 |
| apps/api/src/municipality/municipality.contract.ts | 73 | 1 |
| apps/api/src/municipality/municipality.dto.ts | 30, 40, 46, 101, 108, 110, 118, 139, 145, 151, 211, 220 … | 21 |
| apps/api/src/municipality/population-summary.ts | 197 | 1 |
| apps/api/src/municipality/territory-summary.ts | 215 | 1 |
| apps/api/src/openapi/openapi.ts | 11 | 1 |
| apps/api/src/patient-self/patient-self.controller.ts | 51 | 1 |
| apps/api/src/patients/document-normalization.ts | 54 | 1 |
| apps/api/src/patients/enrollment.catalogs.ts | 23 | 1 |
| apps/api/src/patients/enrollment.contract.ts | 39 | 1 |
| apps/api/src/patients/patient-enrollment.dto.ts | 21, 27, 34, 41, 48, 55, 69, 75, 87, 91, 94, 100 … | 28 |
| apps/api/src/patients/patient-enrollment.service.ts | 36, 42, 363 | 3 |
| apps/api/src/patients/population-derivation.ts | 34 | 1 |
| apps/api/src/people-relationships/caregiver-relationship.dto.ts | 34, 43, 51, 61, 71, 82, 91, 100, 109, 116, 123, 132 … | 24 |
| apps/api/src/visits/home-visit-materialization.service.ts | 11 | 1 |
| apps/api/src/visits/home-visit-transition.service.ts | 12, 130, 299 | 3 |
| apps/api/src/visits/professional-visit-query.service.ts | 136 | 1 |
| apps/api/src/visits/professional-visit-worklist.service.ts | 19, 284 | 2 |
| apps/api/src/visits/visits.controller.ts | 102, 137, 307, 315, 417 | 5 |
| apps/api/src/visits/visits.dto.ts | 192, 201, 208, 217, 224, 233, 239, 248, 257, 266, 273, 280 … | 38 |
| apps/web/src/app/municipality/page.tsx | 25, 31 | 2 |
| apps/web/src/components/ui/BrandLogo.tsx | 9 | 1 |
| apps/web/src/components/ui/Button.tsx | 39 | 1 |
| apps/web/src/components/ui/Choice.tsx | 206, 211, 221 | 3 |
| apps/web/src/components/ui/eliExpressions.ts | 21 | 1 |
| apps/web/src/components/ui/Field.tsx | 202, 215, 230 | 3 |
| apps/web/src/components/ui/PhoneShell.tsx | 41 | 1 |
| apps/web/src/config/environment.ts | 29 | 1 |
| apps/web/src/features/auth/humanSessionClient.ts | 52 | 1 |
| apps/web/src/features/auth/institutionalSessionClient.ts | 28, 37, 51 | 3 |
| apps/web/src/features/experiencia/ExperienciaMerdn.tsx | 41 | 1 |
| apps/web/src/features/hospital/hospitalAdministrationConfig.ts | 12, 19, 26, 31, 98, 123, 127, 131, 136, 137, 138, 170 … | 57 |
| apps/web/src/features/hospital/HospitalAdminPieces.tsx | 38 | 1 |
| apps/web/src/features/hospital/HospitalAgenda.tsx | 58, 60, 65, 70, 72, 88, 89, 512, 526 | 9 |
| apps/web/src/features/hospital/hospitalAgendaClient.ts | 21, 30, 278 | 3 |
| apps/web/src/features/hospital/hospitalAgendaConfig.ts | 13, 16, 20, 41, 119, 156, 291, 293, 295, 302 | 10 |
| apps/web/src/features/hospital/HospitalAlerts.tsx | 29, 38, 57 | 3 |
| apps/web/src/features/hospital/hospitalAlertsConfig.ts | 6, 11, 18, 29, 48, 91 | 6 |
| apps/web/src/features/hospital/HospitalAudit.tsx | 15, 18 | 2 |
| apps/web/src/features/hospital/HospitalClinicalImport.tsx | 21, 22 | 2 |
| apps/web/src/features/hospital/hospitalConfig.ts | 8, 10, 25, 27, 45, 57, 63, 106 | 8 |
| apps/web/src/features/hospital/HospitalDashboard.tsx | 34, 35, 40 | 3 |
| apps/web/src/features/hospital/HospitalDashboardAtencion.tsx | 16, 21 | 2 |
| apps/web/src/features/hospital/hospitalDashboardConfig.ts | 6, 11, 13, 37, 81, 85, 104, 106, 128, 130, 183, 191 … | 13 |
| apps/web/src/features/hospital/HospitalDashboardHeader.tsx | 10 | 1 |
| apps/web/src/features/hospital/hospitalDashboardOperacion.ts | 23, 26, 31, 34, 36, 40, 42, 44, 104, 122, 144, 158 … | 18 |
| apps/web/src/features/hospital/hospitalFinancialAbastecimiento.ts | 16, 19, 43, 56, 65, 74, 79, 82, 85, 89, 116, 123 … | 91 |
| apps/web/src/features/hospital/hospitalFinancialConfig.ts | 20, 28, 157, 297, 599 | 5 |
| apps/web/src/features/hospital/hospitalFinancialContracts.ts | 20, 21, 37, 106, 119, 189, 221 | 7 |
| apps/web/src/features/hospital/hospitalFinancialControl.ts | 16, 19, 23, 34, 137, 150, 159, 165, 171, 177, 213, 232 … | 33 |
| apps/web/src/features/hospital/hospitalFinancialDemo.ts | 29, 32, 72, 74, 83 | 5 |
| apps/web/src/features/hospital/hospitalFinancialFixtures.ts | 16, 19, 26, 33, 41, 54, 55, 57, 67, 68, 88, 89 … | 15 |
| apps/web/src/features/hospital/HospitalFinancialManagement.tsx | 57, 70 | 2 |
| apps/web/src/features/hospital/hospitalFinancialMovimientos.ts | 17, 20, 24, 41, 54, 92, 96, 103, 110, 122, 133, 145 … | 108 |
| apps/web/src/features/hospital/hospitalFinancialPersonas.ts | 16, 19, 35, 53, 66, 94, 153, 213, 269, 292, 321, 334 … | 48 |
| apps/web/src/features/hospital/HospitalFinancialPieces.tsx | 253, 373, 414, 559, 777, 795 | 6 |
| apps/web/src/features/hospital/hospitalFinancialResumen.ts | 5, 9, 14, 32, 166, 372, 378, 384, 390, 398, 408, 418 | 12 |
| apps/web/src/features/hospital/HospitalFinancialSections.tsx | 48, 71, 169, 540, 551, 561 | 6 |
| apps/web/src/features/hospital/HospitalHomeVisits.tsx | 40, 47, 289, 447, 664 | 5 |
| apps/web/src/features/hospital/HospitalInstitutionSettings.tsx | 26, 47, 89 | 3 |
| apps/web/src/features/hospital/HospitalKpiCard.tsx | 23 | 1 |
| apps/web/src/features/hospital/HospitalMemberships.tsx | 31, 45, 48, 253, 261 | 5 |
| apps/web/src/features/hospital/HospitalPatients.tsx | 52, 61, 64 | 3 |
| apps/web/src/features/hospital/hospitalPatientsClient.ts | 11, 22 | 2 |
| apps/web/src/features/hospital/hospitalPatientsConfig.ts | 7, 10, 13, 17, 67, 191, 269, 276, 298, 304, 310, 323 | 12 |
| apps/web/src/features/hospital/HospitalPatientsPieces.tsx | 44, 66, 107, 303, 331, 349, 1252 | 7 |
| apps/web/src/features/hospital/HospitalPersonnelAccess.tsx | 39, 40, 59, 65, 71, 323, 485, 486, 487 | 9 |
| apps/web/src/features/hospital/hospitalPersonnelListado.ts | 13, 16, 21, 55 | 4 |
| apps/web/src/features/hospital/hospitalPopulationAnalytics.ts | 7, 38, 590, 593, 595, 841, 842, 864, 865 | 9 |
| apps/web/src/features/hospital/hospitalPopulationFixtures.ts | 15, 17, 26, 29, 33, 40, 41, 50, 59, 89, 230, 245 … | 22 |
| apps/web/src/features/hospital/hospitalPopulationTypes.ts | 10, 16, 28, 30, 31, 172, 176, 244, 252, 262, 388, 389 | 12 |
| apps/web/src/features/hospital/HospitalProfessionals.tsx | 57, 76, 302, 546 | 4 |
| apps/web/src/features/hospital/hospitalProfessionalsClient.ts | 13, 21 | 2 |
| apps/web/src/features/hospital/hospitalProfessionalsConfig.ts | 11, 12, 25, 36, 48, 58 | 6 |
| apps/web/src/features/hospital/hospitalProfessionalsListado.ts | 25, 45 | 2 |
| apps/web/src/features/hospital/HospitalRatings.tsx | 24, 145 | 2 |
| apps/web/src/features/hospital/hospitalRatingsConfig.ts | 4, 8, 48, 98 | 4 |
| apps/web/src/features/hospital/HospitalReports.tsx | 5, 36, 80, 103 | 4 |
| apps/web/src/features/hospital/hospitalReportsConfig.ts | 7, 49, 58, 198 | 4 |
| apps/web/src/features/hospital/hospitalReportsFinancial.ts | 7, 26, 50, 54, 56, 71, 192, 213, 655 | 9 |
| apps/web/src/features/hospital/hospitalReportsInstitutional.ts | 5, 23, 37, 49, 50, 51, 52, 117, 327, 330 | 10 |
| apps/web/src/features/hospital/hospitalReportsOperational.ts | 5, 14, 52, 83, 141, 255, 265, 698 | 8 |
| apps/web/src/features/hospital/hospitalReportsOperationalFixtures.ts | 5, 18, 34, 59, 60, 113, 172, 327, 337 | 9 |
| apps/web/src/features/hospital/HospitalReportsPieces.tsx | 35 | 1 |
| apps/web/src/features/hospital/hospitalReportsSnapshot.ts | 16, 42, 142, 241, 250, 784, 786 | 7 |
| apps/web/src/features/hospital/hospitalReportsTypes.ts | 11, 15, 44, 55, 65, 124, 322 | 7 |
| apps/web/src/features/hospital/HospitalShell.tsx | 96, 102, 105, 117, 226, 391, 480, 633, 637, 654, 699 | 11 |
| apps/web/src/features/hospital/HospitalSidebar.tsx | 16, 125, 219, 249 | 4 |
| apps/web/src/features/hospital/hospitalTestUtils.ts | 44, 49, 52, 56, 59 | 5 |
| apps/web/src/features/hospital/HospitalTopbar.tsx | 17, 18, 25, 31, 142 | 5 |
| apps/web/src/features/hospital/hospitalUpdatesConfig.ts | 6, 9, 27, 42 | 4 |
| apps/web/src/features/hospital/HospitalViewPieces.tsx | 206, 232 | 2 |
| apps/web/src/features/hospital/hospitalViews.ts | 101 | 1 |
| apps/web/src/features/hospital/hospitalVirtualConfig.ts | 6, 10, 40 | 3 |
| apps/web/src/features/hospital/HospitalVirtualConsultations.tsx | 27 | 1 |
| apps/web/src/features/hospital/hospitalVisitsClient.ts | 26, 277 | 2 |
| apps/web/src/features/hospital/hospitalVisitsConfig.ts | 6, 10, 40 | 3 |
| apps/web/src/features/hospital/ProfessionalDetailPanel.tsx | 30 | 1 |
| apps/web/src/features/hospital/ProfessionalEngagementPanel.tsx | 19, 24 | 2 |
| apps/web/src/features/inscripcion/InscripcionExperience.tsx | 45, 75, 113 | 3 |
| apps/web/src/features/inscripcion/inscripcionFlow.ts | 12 | 1 |
| apps/web/src/features/inscripcion/patientEnrollmentClient.ts | 30, 113 | 2 |
| apps/web/src/features/inscripcion/steps/PasosCuidador.tsx | 20, 53, 71, 129, 142, 152, 179, 190, 209, 274, 386, 425 … | 14 |
| apps/web/src/features/inscripcion/steps/PasosPaciente.tsx | 30, 63, 73, 149, 160, 170, 208, 219, 230, 431, 490, 499 … | 21 |
| apps/web/src/features/inscripcion/steps/PasosVisitador.tsx | 12, 115, 128, 138, 150, 161, 192, 202, 248, 266, 282, 324 … | 14 |
| apps/web/src/features/inscripcion/steps/piezas.tsx | 82, 106, 127, 148, 160, 182, 193, 205, 276, 290, 307, 370 | 12 |
| apps/web/src/features/municipality/MunicipalityAdres.tsx | 13, 30, 56, 59, 63, 72, 82, 199, 203 | 9 |
| apps/web/src/features/municipality/municipalityAggregates.ts | 10, 113 | 2 |
| apps/web/src/features/municipality/municipalityAggregatesClient.ts | 18 | 1 |
| apps/web/src/features/municipality/MunicipalityBudget.tsx | 26, 29, 30, 35, 37, 50, 76, 79, 83, 92, 95, 164 … | 15 |
| apps/web/src/features/municipality/MunicipalityCare.tsx | 13, 27, 42, 45, 49, 58, 78, 185, 189 | 9 |
| apps/web/src/features/municipality/MunicipalityCaregivers.tsx | 14, 25, 26, 30, 54, 57, 61, 70, 80, 172, 176 | 11 |
| apps/web/src/features/municipality/MunicipalityComingSoon.tsx | 14 | 1 |
| apps/web/src/features/municipality/municipalityConfig.ts | 9, 13, 16, 17, 22, 33, 93, 124, 125, 130, 131, 166 … | 292 |
| apps/web/src/features/municipality/MunicipalityEvidence.tsx | 38, 49, 56, 80, 83, 87, 96, 99, 145, 253, 293 | 11 |
| apps/web/src/features/municipality/MunicipalityFinancialDetails.tsx | 30 | 1 |
| apps/web/src/features/municipality/MunicipalityFurag.tsx | 14, 27, 55, 58, 62, 71, 85, 94, 262, 266 | 10 |
| apps/web/src/features/municipality/MunicipalityGaps.tsx | 14, 27, 51, 54, 58, 67, 77, 90, 94 | 9 |
| apps/web/src/features/municipality/MunicipalityHome.tsx | 21, 22, 57, 60, 64, 73, 86, 207, 211 | 9 |
| apps/web/src/features/municipality/MunicipalityIndicators.tsx | 14, 21, 23, 24, 52, 55, 59, 68, 78, 163, 167 | 11 |
| apps/web/src/features/municipality/MunicipalityPopulation.tsx | 31 | 1 |
| apps/web/src/features/municipality/MunicipalityProgramForm.tsx | 21, 25, 200, 201 | 4 |
| apps/web/src/features/municipality/MunicipalityPrograms.tsx | 32, 33, 96, 376, 411, 425 | 6 |
| apps/web/src/features/municipality/MunicipalityReports.tsx | 13, 16, 43, 46, 50, 59, 71, 109, 113 | 9 |
| apps/web/src/features/municipality/municipalitySession.tsx | 46, 139, 260, 371 | 4 |
| apps/web/src/features/municipality/MunicipalityShell.tsx | 69, 85, 88, 153, 289, 325 | 6 |
| apps/web/src/features/municipality/MunicipalityTerritory.tsx | 28 | 1 |
| apps/web/src/features/municipality/MunicipalityTopbar.tsx | 15, 27, 117, 125, 137 | 5 |
| apps/web/src/features/municipality/municipalityViews.ts | 7, 44, 53, 80, 102 | 5 |
| apps/web/src/features/paciente/BitacoraPaciente.tsx | 50, 275, 289, 306, 320, 368, 417, 511, 531 | 9 |
| apps/web/src/features/paciente/InicioPaciente.tsx | 17 | 1 |
| apps/web/src/features/paciente/PacienteExperience.tsx | 73, 209, 274, 808 | 4 |
| apps/web/src/features/paciente/pacienteSelfClient.ts | 35 | 1 |
| tools/identity-provisioning/src/identifiers.ts | 11 | 1 |
| tools/merdn-orchestrator/src/adapters/contract.ts | 14, 181 | 2 |
| tools/merdn-orchestrator/src/adapters/mocks.ts | 5, 65, 93, 97, 98 | 5 |
| tools/merdn-orchestrator/src/config.ts | 89 | 1 |
| tools/merdn-orchestrator/src/domain/gates.ts | 121 | 1 |
| tools/merdn-orchestrator/src/domain/states.ts | 5 | 1 |
| tools/merdn-orchestrator/src/main.ts | 8, 10, 21, 40, 70 | 5 |
| tools/merdn-orchestrator/src/runtime/context.ts | 6 | 1 |
| tools/merdn-orchestrator/src/runtime/engine.ts | 168, 1215 | 2 |
| tools/merdn-orchestrator/src/runtime/metrics.ts | 65 | 1 |
| tools/merdn-orchestrator/src/runtime/recovery.ts | 23, 141 | 2 |
| tools/merdn-orchestrator/src/ui/panel.ts | 5, 314 | 2 |
| tools/merdn-orchestrator/src/workspace/git.ts | 52 | 1 |

Fixtures de preparación DB existentes, revisadas por riesgo/ownership (no ejecutadas):

- apps/api/test/enrollment-fixtures.ts
- apps/api/test/hospital-core-02-fixtures.ts
- apps/api/test/hospital-fixtures.ts
- apps/api/test/identity-relationships-fixtures.ts
- apps/api/test/municipality-fixtures.ts

prototype-claude contiene 33 archivos de referencia. Se conserva read-only; sus datos/rules y runtime Claude Design no cuentan como servicios productivos. tests/ y *.test.* usan mocks necesarios para comprobaciones. Su existencia no exige borrado ni conexión a producción.


## 19. Comparación con Eloisa-develop del escritorio

Comparación solicitada por el Product Owner al finalizar la auditoría. Fecha: **8 de octubre de 2026**. Repositorio adicional: C:/Users/10plu/OneDrive/Desktop/Eloisa-develop/eloisa_project.

**Conclusión: la referencia local origin/develop del escritorio es más avanzada en registro, aprobación institucional de accesos, portales humanos y artefactos de aislamiento. La carpeta abierta del escritorio está en un main anterior y no representa ese avance. Ninguno de estos estados queda certificado aquí como una entrega integral lista para producción.**

Las secciones 1–18 corresponden exclusivamente al workspace MERDN auditado. Sus 23 bugs y 177 tareas no se trasladan automáticamente al otro repositorio. Esta comparación permite rebaselinar el plan si el Product Owner elige otra base; no modifica una decisión aprobada ni autoriza integración.

### 19.1 Tres snapshots distintos

| Identificador | Ubicación y estado | Commit inspeccionado | Fecha del commit | Cómo se inspeccionó |
|---|---|---|---|---|
| A — MERDN auditado | C:/Users/10plu/ElI-MERDN; develop, siete commits detrás de su origin/develop local | 1cc2daa4fbe584065d7f7510d231116cd4503b5f | 2026-08-30 | Archivos presentes, pruebas y checks descritos en §16 |
| B — escritorio abierto | Eloisa-develop/eloisa_project; main, árbol limpio | 1aa1201b8aa4483ecac6ffc59e15cb16cd79270b | 2026-09-21 | Lectura del árbol de trabajo y de objetos Git |
| C — avance del escritorio | origin/develop almacenado en ese repositorio; 19 commits alcanzables adicionales respecto de su main | 9980582bc40f41c80b90078f0c24374cbad9df9e | 2026-10-07 | git show y ls-tree; sin cambiar de rama |

No se hizo fetch: C es una referencia disponible localmente, no una afirmación sobre el HEAD remoto actual. El último commit C se titula “Add temporary artifacts and verification scripts”; su fecha reciente no certifica calidad. El historial local inspeccionado contiene 200 commits en A y 31 en el escritorio, sin hashes comunes. Hay continuidad de contenido, pero no se demostró ascendencia Git directa entre ambos repositorios; un merge entre ellos no puede darse por rutinario.

| Comparación de archivos rastreados | A contra B | A contra C |
|---|---:|---:|
| Archivos de referencia A | 878 | 878 |
| Archivos del otro snapshot | 910 | 1.094 |
| Rutas comunes | 877 | 878 |
| Contenido igual después de normalizar CRLF/LF | 839 | 792 |
| Rutas comunes con contenido distinto | 38 | 86 |
| Archivos adicionales del otro snapshot | 33 | 216 |
| Archivos A ausentes del otro snapshot | 1 | 0 |

Estos conteos incluyen documentación, pruebas y artefactos temporales. No son porcentajes de producto terminado. No incluyen ENTREGA.md, que no está rastreado. Se normalizaron finales de línea para evitar contabilizar cambios exclusivamente CRLF.

### 19.2 Qué avanzó realmente

| Capacidad | A — MERDN auditado | B — main del escritorio | C — origin/develop del escritorio |
|---|---|---|---|
| Entrada y rutas | Tres páginas Next; inscripción y experiencia Paciente en el flujo raíz | Hub inicial y rutas /inscripcion y /profesional; cinco páginas | Ocho páginas: /, /hospital, /municipality, /inscripcion, /acceso, /paciente, /cuidador y /profesional |
| Registro humano | Inscripción de paciente persistente; no crea una cuenta OIDC desde ese flujo mínimo | Añade campo password y creación de cuenta, pero el cliente antiguo no envía esa clave | Nuevo registro guiado por perfil, cinco pasos, solicitud persistente y expediente versionado; conserva la inscripción antigua separada |
| Aprobación de acceso | Sin entidad ni bandeja específica de solicitudes | Sin entidad ni bandeja específica | AccessRequest, estados de revisión/provisión, bandeja Hospital, detalle y decisión persistentes |
| Identidad OIDC | Autenticación sobre identidades provisionadas por herramientas; verificación integrada pendiente | Rama nueva de enrolamiento con vinculación incorrecta del subject | Saga de provisión dedicada: prepara usuario deshabilitado, conserva sub real, activa después de aprobación y maneja fallo reintentable |
| Portales humanos | Self-scope Paciente y API de worklist; sin portada autónoma de profesional conectada | Profesional con visitas estáticas y guardado en memoria | Selector de experiencias aprobadas; profesional consulta worklist real; cuidador puede abrir portada neutra sin relación |
| Autorización institucional | Cuatro roles disjuntos | Conserva esos cuatro | Añade HOSPITAL_ACCESS_REVIEWER como quinto rol disjunto; no convierte al scheduler en aprobador |
| Contextos humanos | PATIENT, PROFESSIONAL y CAREGIVER | Conservados | Conservados y separados de las experiencias PATIENT, FIELD_PROFESSIONAL y CAREGIVER; una experiencia no equivale a permiso sobre un recurso |
| Sesión humana por defecto | TTL 8 horas; idle 30 minutos | TTL 30 días; idle 72 horas | Conserva 30 días y 72 horas; es un cambio de política global, no solo de pacientes |
| Persistencia | 26 modelos; 12 migraciones forward | 26 modelos; 13 migraciones forward | 27 modelos, con AccessRequest; 17 migraciones forward |
| RLS declarada | ENABLE 26/26; FORCE 11/26 | ENABLE 26/26; FORCE 11/26 | ENABLE 27/27; FORCE 27/27 en SQL forward; no se consultó el catálogo instalado en esta comparación |
| Pruebas aisladas | Spec 025 parcialmente preparada; baseline no ejecutada en esta auditoría | Agrega pruebas que pueden omitir DB y quedar verdes | Guard de entorno, provisionador, preflight, cleanup, runner y tests de lifecycle; handoff reporta una ejecución DB focal aislada exitosa |
| Hospital/Alcaldía visual | Amplias superficies, mezcla de consultas reales y módulos demo | Inyecta sesión ficticia en las dos rutas sin bandera de entorno | Recupera rutas normales y limita recorrido demo a banderas resueltas por servidor, cerradas por defecto |
| Liquidaciones y finanzas | Principalmente demostrativas | Sin nuevo backend financiero integral | Más presentación de liquidaciones, incluida en portales, pero sin nuevo dominio persistente de pagos/liquidaciones |
| Imagen web | No copia public/ | Corrige copia de public/ | Conserva esa corrección; no resuelve por ello la URL de API compilada para staging |

C aporta funcionalidad de servidor, no solo pantallas. La cadena implementada está representada por apps/api/src/access-requests/, ApprovedExperiencesService y los clientes web de registro, revisión y worklist. El servicio de provisión describe y aplica fases separadas de transacción, llamada externa y confirmación; no crea por aprobación relaciones cuidador-paciente, asignaciones profesionales ni pagos.

El expediente de registro tiene fuente TEST_DATA y snapshot versionado; la credencial transita hacia el IdP local y no pertenece a ese snapshot. La conservación del sub real y la activación posterior a la aprobación corrigen el enfoque de la nueva vía respecto del enrolamiento legado. Esta conclusión es de inspección de código; no se reprodujo aquí el ciclo completo contra Keycloak/PostgreSQL.

La ruta profesional real muestra la worklist del servidor. Su vista es de consulta; la existencia de esta portada no acredita que se puedan completar visitas, persistir una bitácora clínica o ejecutar liquidaciones desde ella. Las presentaciones de liquidaciones siguen identificadas como demo. Los fixtures locales Hospital devuelven respuestas ficticias y rechazan mutaciones; no prueban búsquedas, filtros y paginación del backend real.

### 19.3 Defectos específicos y diferencias relevantes

| Hallazgo | Snapshot afectado | Evidencia y consecuencia | Acción de revisión propuesta |
|---|---|---|---|
| CMP-01 — Servicio de identidad ausente | B; corregido estáticamente en C | B no contiene apps/api/src/identity-access/identity-access.service.ts, aunque cuatro archivos lo importan. Impide un build API limpio. C restaura el servicio; la lectura sintáctica y la resolución de imports relativos no encontraron esa ausencia | No seleccionar B como base de implementación. Verificar typecheck/build del commit C en entorno aislado |
| CMP-02 — Vinculación OIDC incorrecta en la inscripción antigua | B y C, cuando se activa la provisión legada y se recibe password | patient-enrollment.service.ts:217–235 guarda un UUID generado localmente como subject; :302 ignora el ID real devuelto por createUser. El atributo merdn_subject no cambia el sub emitido por Keycloak. Además, :303 captura el fallo después del commit y permite devolver éxito de inscripción sin identidad utilizable | Especificar reconciliación o retiro controlado de esa rama legada. Probar identidad real, fallo IdP, compensación y reintento. No extender este hallazgo al cliente nuevo de AccessProvisioning |
| CMP-03 — Reintento legado sin límite efectivo | B y C, en KeycloakAdminClient antiguo | apps/api/src/patients/keycloak-admin.client.ts:118–120 llama createUserWithRetry(dto,1), y :157 vuelve a createUser, que reinicia el intento ante otro 5xx. El guard attempt>1 no se alcanza por esa ruta. La obtención del token :179–185 carece de timeout propio. Se registran username e ID y pueden propagarse cuerpos de error del proveedor | Acotar intentos y tiempo total, sanitizar logs y probar 5xx sostenido. El cliente NUEVO access-provisioning-identity.client.ts usa bucle y AbortSignal.timeout; no tiene este mismo patrón recursivo |
| CMP-04 — /paciente no vuelve a exigir experiencia aprobada | C | app/paciente/page.tsx:51 monta PacienteExperience. Este consulta sesión/contexto PATIENT y self-scope, pero no /me/experiences; PatientSelfService tampoco comprueba AccessRequest APPROVED. Una cuenta activa de procedencia previa con participación PATIENT puede entrar directamente aunque su lista de experiencias aprobadas esté vacía. SPEC 038 exige aprobación vigente para el acceso self-scope del solicitante | Reproducir con cuenta activa y Patient existente, sin solicitud APPROVED; probar acceso directo y APIs. Definir compatibilidad de cuentas anteriores y cerrar el requisito en servidor si no existe excepción aprobada. No se demostró acceso entre tenants ni acceso de una solicitud nueva pendiente, cuya cuenta queda deshabilitada |
| CMP-05 — Expiración automática sin auditoría por relación | B y C | people-relationships/expire-relationships.job.ts:46–57 y :80–91 ejecuta updateMany a EXPIRED sin evento de dominio ni incremento de version. El comentario :16–17 lo reconoce. El log agregado no conserva actor/recurso/resultado por relación ni acredita coherencia con las otras transiciones | Revisar contra contrato de lifecycle, auditoría y concurrencia; probar ejecución simultánea con cambio institucional. No afirmar que un trigger rechaza esta operación ni que el job es la única barrera de vigencia |
| CMP-06 — Evidencia de pruebas antigua con falsos verdes | B; no trasladar automáticamente a C | identity-relationships-db.test.ts tiene retornos tempranos si falta DB. Su comprobación de tenant compara una consulta filtrada a otro tenant y no reproduce por sí sola RLS con el rol runtime. E2E antiguo admite existsSync(...) || true y depende de sesión de otro test sin storageState | Sustituir aceptación aparente por evidencia sin skips y con aislamiento explícito; comparar tests de C por contrato, no aceptar todas las nuevas pruebas solo por su número |

El campo password de la inscripción antigua no se agrega al cuerpo construido por patientEnrollmentClient. Esto limita la vía alcanzable desde esa UI, pero no corrige el contrato API legado ni el código de provisión opcional. El nuevo registro de C usa otro cliente y otro endpoint; ambas vías deben revisarse por separado.

En B, Hospital y Alcaldía montan un contexto ficticio sin condición. Es una regresión de presentación y de la puerta de entrada, no una prueba de que el backend acepte permisos ficticios. C la corrige con MERDN_HOSPITAL_DEMO_LOCAL, MERDN_MUNICIPALITY_DEMO_LOCAL y MERDN_HUMAN_ACCESS_DEMO_LOCAL, todas false por defecto en Compose. No se leyó ni expuso un .env local; se desconoce cuáles están activadas en una instancia ya ejecutándose.

### 19.4 Qué ocurre con los 23 bugs de la auditoría A

“Conservado” significa que el archivo causal y la lógica relevante siguen presentes en C; no que se haya repetido la prueba de runtime allí. “Corregido estáticamente” exige aún reproducir los checks sobre ese commit. Los IDs de esta tabla remiten a §13 y no crean nuevas tareas aprobadas.

| Hallazgos A | Resultado de comparación con C |
|---|---|
| BUG-001 — unidades de timeout OIDC | Conservado: oidc.adapter.ts no cambió |
| BUG-002 — CORS DELETE | Conservado: main.ts mantiene la lista de métodos sin DELETE |
| BUG-003 — URL de API incorporada al bundle Docker | Conservado: Dockerfile no incorpora argumento de build para NEXT_PUBLIC_API_BASE_URL; el arreglo de public/ es independiente |
| BUG-004 — identidades institucionales staging | Conservado en la receta staging, que no cambió. Compose local agrega configuración de nuevos flujos; no equivale a aprovisionamiento staging |
| BUG-005 — copia public/ | Corregido estáticamente desde B y conservado en C; falta verificar imagen efectiva |
| BUG-006 — verificación incompleta FORCE | El script runtime histórico permanece. C agrega un catálogo y preflight más estrictos para baseline y declara FORCE en las 27 tablas. Hay avance, pero deben reconciliarse el chequeo operativo y el nuevo inventario AccessRequest |
| BUG-007 y BUG-008 — cleanup/DB compartida | Fixtures y suites antiguas conservan riesgo fuera del runner. C añade guard y lifecycle aislado que reducen el riesgo cuando se ejecutan por esa vía; no vuelven seguros todos los comandos antiguos por sí solos |
| BUG-009 — expectativas API de roles | Las expectativas unitarias se actualizan al contrato y nuevo quinto rol; corrección estática y evidencia focal previa reportada. No se reejecutaron aquí |
| BUG-010 — branding test | Allowlist de la prueba actualizada; corrección estática y evidencia focal reportada |
| BUG-011 — gate agregado Alcaldía | Conservado: hook y shell causales sin cambio relevante |
| BUG-012 — datos nominales tras fallo Hospital | Conservado: componentes de pacientes/profesionales causales sin cambio |
| BUG-013 — edición durante envío | Conservado en la inscripción antigua. El wizard nuevo incorpora bloqueo síncrono y flujo de reintento propios; no se debe confundir la corrección de una vía con la otra |
| BUG-014 — respuesta tardía Paciente | Conservado: PacienteExperience no cambió |
| BUG-015 — visita seleccionada tras identidad institucional | No se encontró corrección específica en HospitalShell; requiere repetir el caso sobre C |
| BUG-016 — foco buscador | Conservado en los listados causales |
| BUG-017 — trap de foco modal | Conservado: diálogo maneja Escape y retorno de foco, pero sigue sin contener Tab/Shift+Tab |
| BUG-018 — rollback auditoría self | Conservado: servicio self-scope sin cambio en esta comparación |
| BUG-019 — no-store inscripción | Conservado en el controller de inscripción antiguo. El endpoint nuevo tiene contrato y controles propios |
| BUG-020 — proxy/cuota/logout | Conservado: main.ts y guard de rate-limit humano sin cambio |
| BUG-021 — día local/UTC Hospital | Conservado en Hospital. La nueva worklist profesional declara su ventana UTC; eso no corrige por sí solo el selector Hospital |
| BUG-022 — build/font | Dependencia web de descarga de fuente conservada. El handoff C reporta builds exitosos en otro entorno; este fallo de red observado en A no se presenta como un fallo reproducido de C |
| BUG-023 — gobierno/consentimiento/progreso | C contiene decisiones posteriores que reanudan una secuencia y luego difieren baseline 025 para priorizar 038. A no debe importar esa aprobación implícitamente. En C los handoffs/tasks no reflejan uniformemente la última implementación y no se encontró aceptación final del paquete más reciente |

### 19.5 Pruebas ejecutadas aquí frente a evidencia encontrada

| Fuente | Evidencia | Límite |
|---|---|---|
| Auditoría A, ejecución directa | Checks y resultados detallados en §16; cinco fallos unitarios reproducidos, build web bloqueado por descarga de fuente | No hubo aceptación DB/IdP/browser integrada |
| Inspección estática B, ejecución directa | 301 archivos TS/TSX fuente examinados; sin errores sintácticos; cuatro imports productivos apuntan al servicio de identidad ausente | No es typecheck semántico ni ejecución API |
| Inspección estática C, ejecución directa | 347 archivos TS/TSX fuente examinados desde objetos Git; cero errores de parseo, cero imports relativos fuente ausentes, cero fallos de lectura | No resuelve tipado, dependencias externas, DI Nest, SQL en PostgreSQL ni comportamiento de navegador |
| Logs almacenados B | API: 17 archivos de pruebas fallidos, 33 exitosos; 14 tests fallidos, 682 exitosos y 316 omitidos. Web: cuatro archivos fallidos, 46 exitosos; cuatro tests fallidos y 1.668 exitosos | Artefactos históricos con otra ruta de ejecución; no corridas nuevas ni asociadas aquí a un HEAD exacto. No comparar sus totales con las unidades A como si tuvieran igual alcance |
| Handoff C, FROM-CLAUDE.md, paquete MP04-C3-C1-C1 + MP04-C4 | Reporta 17/17 migraciones en provision aislado, DB focal 8/8 sin omitidos y cleanup sin restos; runner 37/37, lifecycle 27/27, API focal 186/186, web 994/994 y E2E 26/26; typechecks/builds/SDD exit 0 | Evidencia declarada por el agente implementador, no reproducida en esta comparación. Su título indica IMPLEMENTADO, PENDIENTE AUDITORIA CODEX |
| Revisión C, CODEX-REVIEW.md | Conserva aceptación de MP03-C2 y evidencia 902/902 Hospital, 7/7 Chromium; autoriza MP04 | Esa aceptación no certifica automáticamente MP04-C3/C4 ni el último HEAD C |

Las pruebas DB focales reportadas en el handoff posterior matizan el estado histórico “DB pendiente”: existe una ejecución declarada más reciente. No corresponde ignorarla, pero tampoco convertir ocho pruebas del snapshot de registro en una baseline completa de permisos, tenants, clinical safety, accesibilidad y operación.

spec/bitacora/handoffs/STATE.md comienza en v73 y conserva estados históricos; CODEX-REVIEW.md comienza en v58; FROM-CLAUDE.md contiene la entrega posterior. Varias tareas 038 permanecen sin marcar pese a la implementación reportada. Se debe reconciliar commit, paquete, resultado reproducible y aceptación del Product Owner antes de certificar cierre. La decisión 2026-09-28-entorno-funcional-datos-prueba-y-prioridad-038.md mantiene SPEC 025 diferida y no acepta producción ni datos reales.

### 19.6 Alcance estratégico que continúa pendiente en ambos

El avance de C mejora un segmento necesario: identidad, registro, expediente y aprobación institucional. No añade por sí solo los dominios de presupuesto/asignaciones, movimientos financieros, gastos y soportes, proveedores/contratos, pagos aprobados, planes/membresías, servicios hospitalarios comercializables, consultas virtuales, Hub normativo/evidencias, linaje de indicadores oficiales ni reportes ejecutivos completos.

La diferencia de modelo persistente es AccessRequest; las superficies financieras/institucionales demostrativas conservan una gran parte del contenido común. FURAG, MIPG, ADRES, SENA, Sentencia T-319 de 2025 y las capacidades estratégicas de AGENTS.md deben conservarse en el plan. No hay evidencia en esta comparación de nuevas integraciones oficiales ni de cumplimiento normativo completo. No se emite una interpretación legal nueva ni se validan reglas clínicas del prototipo.

Hospital y Alcaldía siguen siendo experiencias diferenciadas sobre capacidades compartidas. Seleccionar C como candidata no justifica duplicar personas, auth, módulos institucionales o arquitectura por experiencia.

### 19.7 Recomendación y orden de continuación

**Recomendación arquitectónica:** evaluar C como candidata para consolidar la próxima línea de trabajo. Evita reimplementar desde A el acceso institucional y los portales ya desarrollados. B no es una base recomendable sin recuperar primero su build API; mirar solo sus archivos daría un diagnóstico equivocado del avance del escritorio.

1. Fijar el commit candidato y reconciliar las decisiones/aprobaciones y la entrega MP04-C3/C4. Documentar qué partes del backlog A siguen aplicando y cuáles ya tienen implementación candidata.
2. Ejecutar los checks permitidos contra ese commit en una copia aislada creada desde una rama de trabajo autorizada. Confirmar gates y suficiencia contractual; no trabajar ni integrar directamente sobre main.
3. Reproducir typecheck, builds, unidades y pruebas DB/IdP/browser con fixtures ficticios, sin skips en la matriz crítica. Verificar que se prueba el servidor del commit correcto y no una imagen vieja en el mismo puerto.
4. Resolver CMP-02/CMP-03 y comprobar CMP-04, junto con los bloqueos conservados de timeout OIDC, CORS, API del bundle y configuración institucional staging. Revisar política de TTL global y trazabilidad del job de expiración.
5. Rebaselinar catálogo RLS/owners/runtime, prueba real entre tenants, lifecycle y runner para las 17 migraciones y 27 tablas; conservar rollback e idempotencia. Obtener aceptación de la baseline requerida, no inferirla del SQL.
6. Cerrar aceptación del flujo registro → revisión Hospital → provisión → login → portal propio → suspensión/revocación → logout. Luego completar las capacidades estratégicas y módulos demostrativos mediante specs separadas aprobadas.

Este orden es una propuesta de revisión y especificación. No se ejecutó ninguna integración entre repositorios, no se copió código, no se instaló dependencias en el escritorio, no se arrancó allí servidores, Docker o bases, y no se cambiaron sus archivos ni ramas. Todos los cambios de esta tarea siguen limitados a ENTREGA.md en A. Se preservan los cambios locales anteriores y el prototipo read-only.
