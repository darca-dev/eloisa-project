# MERDN Task Specification

## 1. Identificación y gate

- **Task ID:** `TASK-HOSPITAL-CORE-01`
- **Título:** Identidad institucional Hospital y Pacientes Hospital conectados a CORE-01
- **Estado:** `APPROVED — READY FOR CLAUDE CODE`, sujeto estrictamente a esta especificación
- **Prioridad:** HIGH
- **Precedencias:** `TASK-MVP-CORE-01`, `TASK-MUNICIPALITY-CORE-01` y diseño Hospital Pacientes aprobado en `TASK-003H-03B`
- **Agentes de diseño/revisión:** 01 Orchestrator; 03 Backend & Data Architect; 04 Security & Access; 07 QA & Acceptance; 09 Frontend Application Architect

Este paquete autoriza implementación y pruebas, no commit, push, merge, rebase, release ni deploy. No autoriza datos reales de pacientes en producción: la identidad institucional mínima sigue sin identificar a cada trabajador del Hospital.

## 2. Objetivo y valor

Convertir exclusivamente la vista existente **Hospital → Pacientes** de una superficie alimentada por fixtures a una lectura real, paginada y tenant-scoped de los registros persistidos por CORE-01. La implementación debe extender la identidad/sesión institucional ya creada por MUNICIPALITY-CORE-01, agregar un permiso hospitalario mínimo y reutilizar las entidades canónicas `Person` y `Patient`; queda prohibida una segunda persona, un segundo paciente o una base hospitalaria paralela.

## 3. Hechos de la línea base

1. CORE-01 ya persiste `Tenant`, `Person`, `Patient`, `PatientPopulationMembership`, `PatientAddress`, `TerritorialUnit`, consentimiento, sesiones y auditoría con claves tenant-aware y RLS.
2. MUNICIPALITY-CORE-01 ya implementa `InstitutionalIdentity`, `InstitutionalSession`, cookie institucional `HttpOnly`, tenant resuelto en servidor, rol `MUNICIPAL_VIEWER`, guard municipal y eventos de auditoría.
3. La identidad institucional actual está aprovisionada para un único rol/código municipal. Debe generalizarse de forma aditiva; no debe crearse otro sistema de sesión Hospital.
4. La vista `HospitalPatients` obtiene por defecto más de 3.000 personas de `hospitalPopulationFixtures.ts` y calcula localmente filtros, KPI y analítica.
5. CORE-01 no contiene condiciones/patologías, profesionales, cuidadores, programas, agenda, atenciones, visitas, consultas virtuales, alertas, semáforos clínicos ni procedencia clínica. Esos datos no pueden fabricarse ni inferirse.
6. La superficie Hospital es nominal. El mecanismo institucional mínimo no representa todavía una cuenta personal ni permite atribuir accesos a un trabajador concreto; por ello este slice queda limitado a desarrollo/MVP con datos ficticios o controlados.

## 4. Alcance exacto

### 4.1 Incluido

1. Extender aditivamente `InstitutionalRole` con `HOSPITAL_PATIENT_VIEWER`.
2. Generalizar el aprovisionamiento institucional para soportar, dentro del tenant activo, identidades configuradas de Alcaldía y Hospital sin invalidar sesiones municipales existentes.
3. Mantener una sola cookie y una sola tabla de sesión institucional. El login Hospital debe seleccionar una identidad por un `identityCode` explícito y validado; el servidor obtiene rol y tenant de la identidad persistida, nunca del navegador. Para compatibilidad, la ausencia de `identityCode` puede seguir resolviendo exclusivamente el código municipal configurado existente.
4. Crear un guard hospitalario específico que exija `HOSPITAL_PATIENT_VIEWER`.
5. Crear API de solo lectura:
   - `GET /api/v1/institutional/sessions/current`
   - `GET /api/v1/hospital/patients`
   - `GET /api/v1/hospital/patients/:patientId`
   - `GET /api/v1/hospital/patients/analytics`
6. Conectar `HospitalPatients` a esos endpoints con `credentials: "include"`, paginación, orden y filtros server-side.
7. Alimentar desde CORE-01 únicamente identidad minimizada, estado del paciente, EPS, edad derivada, clasificaciones declaradas y territorio canónico. El detalle no incluye contacto, documento completo, consentimiento ni dirección exacta en este slice: la identidad institucional compartida no demuestra necesidad individual de conocer esos campos.
8. Mantener la composición visual, navegación, estilos, responsive, drawer, foco y jerarquía aprobados. Se permite adaptar texto, estados y controles para distinguir capacidades disponibles de capacidades aún no conectadas; no rediseñar.
9. Sustituir solo en Hospital → Pacientes el badge `Datos demostrativos` por procedencia real `Registros ELOISA` y fecha de corte/generación devuelta por la API.
10. Estados reales: carga, éxito, vacío inicial, sin resultados, 401, 403, error recuperable y selección inexistente/404. Ante error nunca mostrar fixtures ni datos de una respuesta anterior de otro contexto.
11. Conectar el encabezado Hospital al contexto de sesión actual: nombre real del `Tenant`, rol efectivo y expiración. Mantener exactamente la composición visual del topbar; sustituir los literales demostrativos de institución/persona únicamente cuando exista sesión Hospital válida. No afirmar que la identidad compartida corresponde a “Claudia Vargas” ni a otro trabajador.

### 4.2 Datos funcionales disponibles

- Listado: `patientId` opaco, nombre, iniciales derivadas, documento enmascarado, edad derivada, EPS controlada, prioridades `60+`, `DISABILITY` declarada y `HOME_CARE_REQUIRED` declarada, municipio/unidad local canónica o estado pendiente, y `Patient.status` con etiqueta no clínica.
- Detalle: los anteriores, tipo/número de documento enmascarado, fecha de nacimiento, área y territorio canónico, texto no canónico solo como `Pendiente de normalización` sin revelar el texto libre, y clasificación/procedencia permitida por CORE-01. Contacto se muestra `No disponible con el permiso actual`.
- Analítica: universo de pacientes activos, 60+, discapacidad declarada, cuidado en casa declarado, rangos de edad, EPS, municipio/área y ocho intersecciones disjuntas incluyendo `ninguna`. Todo se calcula server-side sobre el conjunto filtrado y debe reconciliar con el universo.

### 4.3 Capacidades visibles pero no disponibles

Para proteger el diseño aprobado, conservar los espacios de `Condición principal`, `Profesional`, `Cuidador`, `Programa`, `Próxima atención`, `Últimas atenciones`, `Patologías`, `Sin cuidador`, `Sin profesional` y `Semáforo`, pero representar cada uno con texto neutral **`No disponible en CORE-01`** o estado visual equivalente accesible. No mostrar `Sin asignar`, cero, porcentaje, verde/amarillo/rojo ni conclusiones clínicas porque CORE-01 no permite distinguir ausencia real de dato no modelado.

Los filtros, órdenes y gráficos que dependan exclusivamente de esos dominios deben permanecer visibles deshabilitados con ayuda accesible `Disponible cuando el módulo correspondiente esté conectado`; no se envían a la API ni alteran resultados. `Ordenar por Próxima atención` queda deshabilitado. No se añaden entidades para habilitarlos.

### 4.4 Fuera de alcance

Agenda, citas, visitas, consultas virtuales, profesionales, cuidadores, programas, condiciones/patologías, HCE, alertas, semaforización, reglas clínicas, finanzas, membresías comerciales, reportes, exportación/descarga, CRUD, importación, conciliación, integraciones EPS/ADRES/HCE, recuperación de cuenta, directorio de personal, administración de roles, acceso municipal nominal y cualquier otra vista Hospital.

## 5. Archivos autorizados

Claude debe limitarse a las rutas siguientes y enumerar el diff final:

### Base de datos

- `prisma/schema.prisma`, solo extensión de enums/relaciones existentes estrictamente necesaria.
- Una única migración aditiva nueva `prisma/migrations/<timestamp>_hospital_core_01/migration.sql`.
- Un rollback documental nuevo `prisma/migrations/ROLLBACK-hospital_core_01.sql`, sin ejecutarlo.

### API

- `apps/api/src/institutional-auth/institutional-auth.contract.ts`
- `apps/api/src/institutional-auth/institutional-auth.config.ts`
- `apps/api/src/institutional-auth/institutional-auth.dto.ts`
- `apps/api/src/institutional-auth/institutional-auth.service.ts`
- `apps/api/src/institutional-auth/institutional-auth.controller.ts`
- `apps/api/src/institutional-auth/institutional-auth.module.ts`
- `apps/api/src/institutional-auth/institutional-audit.service.ts`
- `apps/api/src/institutional-auth/institutional-auth.unit.test.ts`
- nuevos `hospital-patient-viewer.guard.ts` y prueba dentro de `apps/api/src/institutional-auth/**`
- nuevos archivos exclusivamente dentro de `apps/api/src/hospital/**`
- `apps/api/src/app.module.ts`
- `apps/api/src/openapi/openapi.ts`
- `apps/api/test/openapi.test.ts`
- nuevos archivos `apps/api/test/**hospital**`
- `apps/api/test/global-setup.ts` y `apps/api/test/test-environment.ts`, solo si son imprescindibles para configurar credenciales ficticias Hospital.

### Web, exclusivamente Hospital Pacientes

- `apps/web/src/features/hospital/HospitalPatients.tsx`
- `apps/web/src/features/hospital/HospitalPatientsPieces.tsx`
- `apps/web/src/features/hospital/hospitalPatientsConfig.ts`
- `apps/web/src/features/hospital/hospitalPatients.module.css`
- `apps/web/src/features/hospital/hospitalPopulationTypes.ts`
- `apps/web/src/features/hospital/hospitalPopulationAnalytics.ts`
- `apps/web/src/features/hospital/hospitalPopulationAnalytics.test.ts`
- `apps/web/src/features/hospital/hospitalPatients.test.tsx`
- nuevos `hospitalPatientsClient.ts` y `hospitalPatientsClient.test.ts` en la misma carpeta.
- `apps/web/src/features/hospital/HospitalShell.tsx`
- `apps/web/src/features/hospital/HospitalTopbar.tsx`
- `apps/web/src/features/hospital/hospitalConfig.ts`, solo para retirar la identidad institucional/persona demo del runtime autenticado, sin alterar menús ni otros fixtures.
- `apps/web/src/features/hospital/hospitalShell.test.tsx`
- nuevos `hospitalInstitutionClient.ts` y `hospitalInstitutionClient.test.ts` en la misma carpeta.

Lectura sin modificación permitida de cualquier archivo del repositorio.

## 6. Archivos y acciones prohibidos

1. `prototype-claude/**` completo.
2. Migraciones CORE-01 y MUNICIPALITY-CORE-01 ya aplicadas; nunca reescribirlas.
3. `apps/api/src/patients/**`, salvo lectura: `/patients/me` y la sesión de autoinscripción no se reutilizan para Hospital.
4. `apps/api/src/municipality/**`, `apps/web/src/features/municipality/**` y pruebas municipales, salvo ejecución sin edición.
5. `hospitalPopulationFixtures.ts`: no borrarlo ni modificarlo; otros módulos aprobados pueden importarlo. Hospital Pacientes debe dejar de importarlo. Su eliminación transversal requiere otra Task.
6. Cualquier otra vista o fixture Hospital, incluidos Agenda, Visitas, Virtual, Finanzas, Dashboard, Reportes, Profesionales, Personal, Alertas y Configuración.
7. `package.json`, lockfile, Docker/compose, infraestructura, secretos reales y dependencias nuevas.
8. `AGENTS.md`, `CLAUDE.md`, `docs/**`, otras Tasks y Reviews.
9. Commit, push, merge, rebase, branch deletion, deploy o datos reales de salud.

Si un archivo no aparece en §5, está prohibido.

## 7. Modelo y migración

### 7.1 Reutilización obligatoria

- No crear `HospitalPatient`, `HospitalPerson`, `Beneficiary`, una tabla duplicada de identidad personal ni una copia por institución.
- `Patient.personId` sigue enlazando al único `Person` del tenant.
- El Hospital solo ve pacientes cuyo `tenantId` coincide con el tenant server-side de la sesión.
- Esta Task no diseña intercambio de pacientes entre tenants. Si un Hospital necesita ver un paciente propiedad de otro tenant, STOP: requiere relación/autorización interinstitucional aprobada.

### 7.2 Cambios aditivos mínimos

- `InstitutionalRole += HOSPITAL_PATIENT_VIEWER`.
- `AuditEventType += HOSPITAL_PATIENT_LIST_ACCESS_GRANTED`, `HOSPITAL_PATIENT_DETAIL_ACCESS_GRANTED`, `HOSPITAL_PATIENT_ANALYTICS_ACCESS_GRANTED`, `HOSPITAL_PATIENT_ACCESS_DENIED`.
- No se requiere una tabla `Hospital`: `Tenant` representa el límite institucional en este MVP. No inferir tipo de institución desde el nombre/código del tenant.
- No modificar `Person`, `Patient`, membresías, dirección o consentimiento salvo que una limitación técnica demostrable impida la lectura; en ese caso aplica STOP.

La migración debe preservar datos, sesiones y rol municipal existentes; mantener RLS/privilegios de mínimo privilegio y ampliar los checks/enums sin abrir tablas a acceso sin tenant. Debe incluir SQL de rollback documentado que advierta si existen filas con los nuevos valores.

## 8. Contrato API

Los DTO son explícitos y no exponen modelos Prisma. Todas las respuestas llevan `Cache-Control: private, no-store`, `Pragma: no-cache` y `Vary: Cookie`.

### 8.0 `GET /api/v1/institutional/sessions/current`

- Requiere una sesión institucional válida, cualquiera de los roles implementados; no usa el guard municipal.
- Devuelve únicamente `{ role, expiresAt, institution: { name }, actorDisplay: "Acceso institucional" }`.
- No devuelve `tenantId`, `identityId`, código interno, secreto, actor personal ficticio, tipo/municipio/logo no modelados ni permisos derivados de la UI.
- Una sesión ausente/expirada/revocada recibe `401` uniforme. Este endpoint no concede por sí mismo acceso a Hospital o Municipality; cada dominio mantiene su guard exacto.

### 8.1 `GET /api/v1/hospital/patients`

Query allowlist:

- `page` entero 1..N; default 1.
- `pageSize`: 25, 50 o 100; default 50.
- `search`: opcional, máximo 100 caracteres, normalizado; coincide por nombre o documento normalizado sin devolver el documento completo.
- `ageMin`, `ageMax`: 0..130, inclusivos y coherentes.
- `epsCode`, `populationType` (`DISABILITY` o `HOME_CARE_REQUIRED`), `older60`, `municipalityOfficialCode`, `areaType`, `patientStatus`.
- `sort`: `name | age | status`; `direction`: `asc | desc`.

Parámetro desconocido, repetido, mal formado o fuera de rango: `400`. Prohibidos `tenantId`, `personId`, filtros clínicos, SQL-like, filtros arbitrarios y selección de columnas.

Respuesta `HospitalPatientListDto`:

- `source: "ELOISA_POSTGRESQL"`, `asOfDate`, `generatedAt`.
- `page`, `pageSize`, `totalItems`, `totalPages` y `items[]`.
- Cada item contiene solo lo listado en §4.2 para listado. `patientId` es opaco; nunca `personId`, dirección exacta, teléfono, email o documento completo.

La búsqueda, filtros, sort, conteo y paginación ocurren en PostgreSQL dentro de `withTenant`; está prohibido descargar todo y filtrar en navegador.

### 8.2 `GET /api/v1/hospital/patients/:patientId`

- UUID opaco válido; `400` si mal formado.
- `404` uniforme si no existe o no pertenece al tenant; nunca confirmar existencia cross-tenant.
- Devuelve `HospitalPatientDetailDto` con los datos permitidos en §4.2.
- Documento permanece enmascarado. No devolver dirección exacta, `directions`, texto territorial no verificado, consentimiento, tokens, IDs internos relacionados ni campos no modelados.

### 8.3 `GET /api/v1/hospital/patients/analytics`

- Acepta la misma allowlist de filtros, sin paginación/sort.
- Calcula desde las mismas condiciones normalizadas del listado: universo activo/filtrado, cuatro KPI disponibles, rangos de edad, EPS, municipio/área y ocho intersecciones disjuntas.
- Incluye definición/versionado `population-v1`, fuente, fecha de corte y generación.
- No devuelve KPI, distribuciones o porcentajes de cuidadores, profesionales, patologías, programas, atenciones o alertas.
- Si el denominador es cero: `percentage: null`, display `Sin datos`.
- La ruta estática `analytics` debe declararse/probarse sin colisión con `:patientId`.

### 8.4 Errores

Envelope estable `{ code, message }`: `400 HOSPITAL_PATIENTS_INVALID_QUERY`, `401 INSTITUTIONAL_SESSION_REQUIRED`, `403 INSTITUTIONAL_ROLE_REQUIRED`, `404 HOSPITAL_PATIENT_NOT_FOUND`, `429` en login y `503 HOSPITAL_PATIENTS_SERVICE_UNAVAILABLE`. Sin stack, SQL, IDs internos, tenant, secreto, causa de sesión ni existencia de otro tenant.

## 9. Sesión, rol, tenant, RLS y auditoría

1. Reutilizar `InstitutionalIdentity`, `InstitutionalSession`, cookie `merdn_institutional_session`, hashing, TTL, revocación, rotación/fijación protegida y rate limit existentes.
2. Añadir configuración separada y fail-closed: `MERDN_HOSPITAL_PATIENT_VIEWER_SECRET` y `MERDN_HOSPITAL_PATIENT_VIEWER_CODE`. Sin secreto válido, la identidad Hospital no se aprovisiona y el endpoint niega acceso; jamás valor por defecto. No añadir estos nombres a `.env.example` en esta Task porque no está autorizado; Claude debe reportarlos en el handoff para configuración externa.
3. El `identityCode` solicitado solo identifica cuál credencial verificar dentro del tenant activo. No acepta rol ni tenant. Errores de código inexistente, secreto incorrecto o identidad deshabilitada son indistinguibles.
4. Una sesión municipal recibe `403` en Hospital. Una sesión Hospital recibe `403` en Municipality. Cookie de paciente recibe `401` en ambos. Sesión expirada/revocada/manipulada recibe `401`.
5. Autorización server-side deny-by-default. UI/route/sidebar no conceden acceso.
6. Toda consulta usa `PrismaService.withTenant(principal.tenantId)`, confirma el tenant activo server-side y contiene filtro explícito `tenantId`. RLS permanece como segunda barrera.
7. El pool no puede conservar contexto de otro tenant; ausencia/fallo de rol runtime, variable tenant o RLS produce fail-closed antes de la consulta de negocio.
8. Auditoría append-only, dentro de la transacción cuando sea viable:
   - sesión creada/revocada: reutilizar eventos actuales con rol efectivo;
   - listado y analítica concedidos usan sus eventos diferenciados: actor opaco, rol, tenant, endpoint lógico, resultado, timestamp, correlation ID; no guardar query/búsqueda, conteos ni payload;
   - detalle concedido: puede guardar `resourceId = patientId` opaco, nunca `personId` ni valores personales;
   - denegación: actor opaco si se conoce, rol si se conoce, endpoint, outcome; sin recurso ni causa detallada.
   - una lectura nominal concedida debe fallar cerrada si no puede persistirse su evento obligatorio; una denegación puede auditarse best-effort si hacerlo fail-closed crearía un oráculo o vía de denegación de servicio, y esa excepción debe probarse/documentarse.
9. Logs y telemetría no contienen nombres, documentos, contactos, búsquedas, filtros, tokens/hashes, secretos, payloads ni resultados nominales.
10. Este rol compartido mínimo no equivale a RBAC definitivo ni autorización clínica. Producción con información personal/health real queda bloqueada hasta identidad individual, finalidad, relación/asignación, vigencia, consentimiento aplicable y política de retención aprobadas.

## 10. Conexión frontend y retirada localizada de fixtures

1. `HospitalPatients.tsx` debe eliminar sus imports y fallback de `pacientesPoblacionDemo()` y dejar de usar `hospitalPoblacionDemo` para valores/fecha/procedencia demostrativos. Puede conservar de `hospitalPatientsConfig.ts` solo copy/presentación no factual.
2. `hospitalPopulationFixtures.ts` permanece intacto para compatibilidad de otras vistas; ninguna llamada desde el árbol renderizado de Hospital Pacientes puede ejecutarlo.
3. El cliente consulta listado y analítica coordinados mediante `AbortController`; un cambio de filtro/orden/página cancela la solicitud anterior. Respuestas tardías o de sesión anterior no sustituyen el estado actual.
4. No persistir respuestas, filtros nominales ni detalle en `localStorage`, `sessionStorage`, IndexedDB, service worker o caché compartida.
5. Búsqueda con debounce razonable y envío solo tras normalización; nunca registrar el término en telemetría cliente.
6. Abrir `Ver` consulta el detalle por `patientId`; cerrar limpia el detalle nominal de estado. Un 404 limpia selección y muestra estado seguro.
7. 401 ofrece estado `Sesión institucional requerida`; 403 `Sin permiso para consultar pacientes`; 503/error permite reintentar. No hay redirect o login nuevo si no existe ya en el alcance autorizado.
8. La fecha de corte proviene del servidor. La UI no usa `POBLACION_FECHA_CORTE` del fixture.
9. Los campos no soportados siguen §4.3. No mezclar cifras reales y fixture en KPI, gráfico, tabla, drawer, opciones de filtro, contador ni textos de procedencia.
10. `HospitalShell` obtiene el contexto de sesión y pasa al topbar solo `institution.name`, `actorDisplay` y la etiqueta del rol. Ante 401/403/revocación limpia inmediatamente identidad y cualquier PII de Pacientes; el topbar conserva su estructura pero no vuelve a literales demo.

## 11. Seguridad, privacidad, accesibilidad y rendimiento

- Validación estricta de query/path y consultas parametrizadas mediante Prisma.
- Documento enmascarado en listado y detalle; no exponer exact address ni texto libre territorial.
- No exponer teléfono ni email con el rol institucional compartido de este slice.
- Los nombres visibles tras autorización Hospital nunca aparecen en respuestas agregadas municipales.
- Sin export, descarga, copiar masivo, impresión dedicada ni URLs con nombre/documento/filtros sensibles.
- Contraste, semántica, labels, focus visible, Escape y retorno de foco del drawer, status/alert accesibles y no color-only.
- Viewports: 1440×900, 1024×768 y 390×844; zoom/reflow 200 %.
- Índices/query plan deben sostener paginación server-side. No autorizar un índice nuevo salvo dentro de la migración y con justificación/rollback. Objetivo documentado: respuesta p95 local sobre dataset sintético ≥3.000 de ≤500 ms; interacción posterior de UI ≤100 ms excluyendo red.

## 12. Pruebas obligatorias

### 12.1 Unitarias API

- Parseo/normalización de cada query, límites, combinaciones y rechazo de desconocidos.
- Edad calendario en UTC, cumpleaños exacto y rangos.
- Documento enmascarado por tipo sin fuga del valor completo.
- Ocho intersecciones disjuntas, `ninguna` y reconciliación exacta.
- Denominador cero produce `null`/`Sin datos`.
- Configuración municipal-only, hospital-only, ambas, ninguna, códigos inválidos, secretos cortos y secretos nunca logueados.
- Guard Hospital: 401/403/allow y fail-closed runtime.

### 12.2 Integración/API/DB

- Login municipal continúa funcionando y accede solo a Municipality.
- Login Hospital crea cookie segura y accede solo a Hospital.
- Matriz completa 401/403 entre cookie paciente, municipal, hospital, expirada, revocada, manipulada y deshabilitada.
- Dos tenants sintéticos: listado, búsqueda, detalle y analítica no cruzan tenant; `patientId` ajeno da 404 uniforme.
- Intentos de enviar `tenantId`, IDs cruzados y parámetros desconocidos fallan.
- RLS: contexto ausente/equivocado, pool reuse, lectura cross-tenant y fail-closed runtime.
- Paginación estable sin duplicados/omisiones ante empate, pageSize y última página.
- Filtros AND, búsqueda normalizada, status, EPS, edad, membresías y territorio devuelven exactamente el conjunto esperado.
- DTO list/detail no contiene `personId`, documento completo, exactAddress, directions, texto libre territorial, consentimiento ni campos no modelados.
- Analítica y listado filtrado reconcilian universo y categorías.
- Auditoría: eventos concedidos/denegados, rol correcto, detail `patientId` opaco; sin query, PII, secreto o payload; append-only y tenant-scoped.
- Headers `private, no-store`, `Pragma` y `Vary` en éxito y errores sensibles.
- Sesión actual devuelve nombre real del tenant y rol, nunca tenant/identity ID ni la persona demo; cada guard de dominio sigue separando permisos.
- Migración sobre baseline existente preserva identidades/sesiones municipales; rollback se valida en base desechable.

### 12.3 Web

- Ningún import/uso de `pacientesPoblacionDemo`, `POBLACION_FECHA_CORTE` o totales demo desde `HospitalPatients`/su árbol.
- El topbar autenticado no muestra `Hospital San Rafael`, `Claudia Vargas`, municipio/tipo/logo demo ni otro atributo no devuelto por sesión; mantiene layout, foco y navegación.
- Cliente serializa solo la allowlist, usa credentials/cancelación y maneja 400/401/403/404/503/red.
- Loading, éxito, vacío inicial, sin resultados, reintento y limpieza segura de respuesta previa.
- Filtros soportados, chips, contador, orden y paginación corresponden a la API; controles no soportados están deshabilitados y no generan parámetros.
- Drawer obtiene detalle, maneja cambio rápido/404, limpia datos al cerrar y conserva foco/Escape.
- Texto `No disponible en CORE-01` no se representa como dato ausente real, diagnóstico o semáforo.
- No Web Storage, service-worker cache ni fallback a fixtures.
- axe sin violaciones graves/críticas; teclado completo; capturas en los tres viewports y zoom 200 %.

### 12.4 Regresión y checks

- Suite completa API, web y shared.
- Pruebas dirigidas CORE-01, runtime/RLS, Municipality auth/API, Hospital shell/navegación y Hospital Pacientes.
- Prisma validate/generate, lint, typecheck, builds, OpenAPI, secret scan y `git diff --check`.
- Verificación de allowlist, `prototype-claude/**` intacto, sin dependencias ni archivos eliminados.

## 13. Criterios de aceptación

1. Hospital Pacientes renderiza únicamente datos persistidos de CORE-01 del tenant institucional activo; no existe fallback o mezcla con fixtures.
2. `Person`/`Patient` son las únicas entidades personales/paciente y no hay duplicación Hospital.
3. La identidad/sesión institucional es la misma base reutilizable de Municipality, con rol Hospital separado y compatibilidad municipal verificada.
4. El contexto de sesión muestra el nombre real del tenant y un actor institucional neutral; no transforma una credencial compartida en una identidad personal ficticia.
5. Ningún rol/cookie/tenant aportado por el cliente concede acceso; la matriz 401/403 y los casos cross-tenant pasan.
6. RLS, filtro explícito y `withTenant` impiden lectura cruzada incluso con IDs manipulados y pool reutilizado.
7. Listado/filtrado/orden/paginación ocurren server-side y son deterministas; no se carga la población completa al navegador.
8. Listado, detalle y analítica exponen solo campos autorizados y nunca contacto, dirección exacta, texto territorial libre, `personId`, documento completo o dominios no modelados.
9. Los KPI disponibles y las ocho intersecciones se calculan con fecha de corte server-side y reconcilian exactamente el universo.
10. Dominios ausentes de CORE-01 se muestran como no disponibles y jamás como cero, sin asignar, dato real, alerta o conclusión clínica.
11. La vista conserva diseño, jerarquía, navegación, responsive y accesibilidad aprobados; solo cambia la fuente y los estados necesarios.
12. Auditoría concedida/denegada es append-only, tenant-scoped, minimizada y no registra búsquedas ni datos personales.
13. Todas las pruebas/checks obligatorios pasan; cualquier excepción se reporta y bloquea aceptación salvo decisión expresa del Product Owner.
14. No se modifican otras vistas, fixtures compartidos, prototipo, módulos excluidos, dependencias ni Git/remotos.
15. El handoff de Claude contiene archivos/propósito, migración/rollback, contratos OpenAPI, comandos/resultados, evidencia RLS/tenant/roles/auditoría, capturas, rendimiento, riesgos y `git status --short`.

## 14. STOP CONDITIONS

Claude debe detener la ampliación afectada, no improvisar y devolverla a Codex/Product Owner si ocurre cualquiera:

1. Hace falta modificar una ruta fuera de §5, borrar/modificar el prototipo o reescribir una migración aplicada.
2. Se requiere crear o duplicar `Person`, `Patient`, Tenant, sesión institucional o una base Hospital paralela.
3. El paciente pertenece a otro tenant o se necesita intercambio/relación Hospital–Municipality/Provider no modelada.
4. Se requiere identidad individual de trabajador, asignación profesional, finalidad, consentimiento adicional o relación de atención para autorizar el acceso pretendido.
5. Se pretende usar datos personales/health reales o desplegar este rol institucional compartido en producción.
6. Se necesita exponer documento completo, dirección exacta, texto territorial no verificado, HCE, diagnóstico, condición, cuidador, profesional, programa, atención, alerta o semáforo.
7. Se pide habilitar Agenda, Visitas, Virtual, Finanzas, Reportes u otro módulo.
8. RLS, rol runtime de mínimo privilegio, tenant server-side o auditoría append-only no pueden verificarse fail-closed.
9. La compatibilidad municipal exige relajar el rol, compartir permiso, aceptar tenant/rol cliente o romper sesiones existentes.
10. Un filtro/KPI/gráfico del diseño necesita datos no presentes en CORE-01 y no puede representarse honestamente como no disponible.
11. Se requiere una dependencia nueva, integración externa, secreto real, gasto, infraestructura, commit, push, merge o deploy.
12. Falla una prueba obligatoria de permiso, tenant, RLS, minimización, auditoría, migración o regresión y no existe corrección dentro de alcance.

## 15. Evidencia requerida a Claude

Claude debe devolver: diff limitado a allowlist; ausencia de cambios eliminados; explicación de reutilización de `Person`/`Patient`; diagrama breve sesión→principal→guard→`withTenant`→RLS; OpenAPI final; matriz de permisos ejecutada; evidencia DB multi-tenant y auditoría; lista exacta de imports/fixtures retirados solo de Hospital Pacientes; capturas responsive; métricas de prueba/rendimiento; comandos y resultados completos; pruebas omitidas/fallidas; riesgos residuales; y confirmación de cero operaciones Git/remotas/deploy.

---

**TASK-HOSPITAL-CORE-01 READY FOR CLAUDE: YES**

**EXPECTED CLAUDE SCOPE:** Extensión aditiva de identidad institucional con `HOSPITAL_PATIENT_VIEWER`; API Hospital Pacientes read-only sobre `Person`/`Patient` CORE-01; conexión exclusiva de la vista Hospital Pacientes a datos PostgreSQL tenant-scoped; pruebas, migración y rollback dentro de la allowlist.

**RISKS/BLOCKERS:** No hay bloqueante para desarrollo/MVP con datos ficticios o controlados. Producción y datos reales quedan bloqueados por identidad institucional compartida sin usuario individual, finalidad/relación/asignación y política de acceso clínico definitivas. Los dominios no presentes en CORE-01 permanecen explícitamente no disponibles.

**CLAUDE PACKET:** `tasks/TASK-HOSPITAL-CORE-01.md`
