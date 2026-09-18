# TASK-MVP-CORE-01 — Inscripción → paciente persistente

## Estado y gate

- **Tipo:** Task Specification; no autoriza commit, push ni despliegue.
- **Objetivo:** convertir únicamente la rama Paciente de la Inscripción aprobada en una cadena real `formulario → validación servidor → PostgreSQL → recuperación`, conservando el paciente tras recargar.
- **Estado de preparación:** **READY FOR CLAUDE CODE**. Las decisiones materiales indispensables de CORE-01 fueron cerradas por el Product Owner; la implementación sigue requiriendo ejecución y posterior auditoría de Codex.
- **Rama inspeccionada:** `develop`.
- **Worktree observado:** existe `tasks/TASK-DEPLOY-DEMO-01.md` sin seguimiento; es ajeno a esta tarea y no debe tocarse.

## 1. Hechos verificados del repositorio

### 1.1 Backend existente

- `apps/api` es una aplicación NestJS 11 real y compilable.
- `apps/api/src/app.module.ts` importa solamente `HealthModule`.
- La única API implementada es `GET /health`; no existen módulos, controladores, servicios ni repositorios de Persona/Paciente/Inscripción.
- OpenAPI y validación tipada del entorno ya existen.
- No existe autenticación, JWT, guards, sesión, autorización ni resolución de tenant en `apps/api`.
- No existe cliente Prisma instanciado ni módulo de acceso a datos en la API.

### 1.2 Prisma y PostgreSQL existentes

- PostgreSQL está declarado como datasource en `prisma/schema.prisma` y configurado mediante `DATABASE_URL` en `prisma.config.ts`.
- La infraestructura local y las variables de ejemplo contemplan PostgreSQL.
- El schema contiene `datasource` y `generator`, pero **cero modelos**.
- No existe `prisma/migrations/` ni migración de negocio.
- Prisma CLI 7.9.1 está instalado en la raíz; la API aún no declara las dependencias de runtime necesarias para usar el cliente generado.
- La configuración demuestra intención y conectividad verificable, no persistencia de pacientes ya implementada.

### 1.3 Inscripción actual

- La experiencia aprobada vive en `apps/web/src/features/inscripcion/`.
- `inscripcionFlow.ts` declara expresamente que todo el flujo vive en memoria y que no usa red ni persistencia.
- La rama Paciente ya captura documento, nombres, apellidos, nacimiento/edad derivada, sexo, teléfonos, correo, las tres clasificaciones no excluyentes, ubicación DIVIPOLA, barrio, dirección, EPS, contactos y autorización de datos.
- Departamento y municipio usan códigos DIVIPOLA y se valida su relación.
- Barrio/vereda es hoy texto libre; `corregimiento` también es texto libre.
- La finalización solo cambia la experiencia a “Inscripción completada”; no llama a una API.

### 1.4 Paciente actual

- `apps/web/src/features/paciente/` es una experiencia frontend demostrativa.
- No recupera por API al paciente recién inscrito y no constituye un registro persistente.
- Las superficies hospitalarias y municipales contienen fixtures/analítica demostrativa; no son una fuente de pacientes productiva y no deben conectarse en CORE-01.

## 2. Alcance

### Incluido

1. Persistencia mínima de Persona/Paciente para la rama Paciente.
2. Territorio estructurado y catálogo normalizado mínimo de barrio/vereda.
3. Tres pertenencias poblacionales simultáneas.
4. Prevención de duplicado por tipo y número de documento dentro del tenant.
5. Creación y recuperación del registro mediante API.
6. Wiring del formulario existente, estados de envío/error/conflicto y prueba de persistencia tras refresh.
7. Timestamps y procedencia mínima de creación.

### Excluido

Cuidador, profesional/visitador, agenda, hospitales, programas, finanzas, FURAG/MIPG, ADRES, WhatsApp, Wompi, hosting, ERP, permisos municipales productivos, dashboards de Alcaldía, integración clínica, fusión de duplicados, edición/borrado de paciente y sistema completo de auditoría.

## 3. Reutilización obligatoria

- Mantener el layout, copy, pasos y componentes de la Inscripción aprobada; no rediseñar.
- Reutilizar tipos y reglas de interacción de la rama Paciente cuando sean compatibles, evitando hacer del tipo UI el contrato de dominio.
- Reutilizar `apps/web/src/data/divipola.ts` como referencia visual; el servidor debe validar contra una fuente controlada equivalente y no confiar en nombres enviados por el cliente.
- Reutilizar NestJS, PostgreSQL, Prisma, OpenAPI y validación de entorno.
- Mantener `prototype-claude/` en solo lectura.
- Mantener branding **Eloisa** y asistente **Isa**; no reintroducir “Evidencia Local Inteligente”.

## 4. Modelo físico mínimo propuesto

Los nombres finales pueden ajustarse a las convenciones Prisma sin cambiar estas fronteras.

### `Tenant`

- `id` UUID, PK.
- `code` string, unique.
- `name` string.
- `createdAt`, `updatedAt`.

CORE-01 usa un tenant institucional activo configurado y resuelto exclusivamente por el servidor. No acepta un `tenantId` libre del body/header y no incluye selector ni administración multiempresa.

### `Person`

- `id` UUID, PK.
- `tenantId` UUID, FK.
- `documentType` enum/catálogo controlado.
- `documentNumber` string normalizado.
- `givenNames`, `familyNames`.
- `birthDate` tipo fecha.
- `sexGenderCode` valor del catálogo aprobado existente; conservar el significado mostrado por la UI sin inventar una categoría clínica.
- `phone`, `email` nullable.
- `createdAt`, `updatedAt`.
- Restricción única compuesta: `(tenantId, documentType, documentNumberNormalized)`.

No persistir `age`: se deriva de `birthDate` y de la fecha de consulta. Esto evita edad obsoleta.

### `Patient`

- `id` UUID, PK e identificador interno del paciente.
- `tenantId` UUID, FK.
- `personId` UUID, FK unique dentro del tenant.
- `epsCode`/`epsNameControlled` según el catálogo existente aprobado para el MVP.
- `status` enum inicial recomendado `ACTIVE`.
- `enrolledAt` timestamp.
- `origin` enum controlado, inicialmente `SELF_REGISTRATION_WEB` (o el origen aprobado en la decisión material).
- `createdByUserId` nullable hasta que exista identidad autenticada; no sustituirlo por texto libre.
- `createdAt`, `updatedAt`.

### `PatientPopulationMembership`

- `patientId` UUID, FK.
- `populationType` enum: `OLDER_ADULT_60_PLUS`, `DISABILITY`, `HOME_CARE_REQUIRED`.
- `source` enum/controlado (`DECLARED`, `DERIVED_BIRTH_DATE`).
- `createdAt`.
- PK/unique `(patientId, populationType)`.

Debe existir al menos una pertenencia. `OLDER_ADULT_60_PLUS` se deriva en servidor cuando la edad calculada desde `birthDate` es **mayor o igual a 60 años** a la fecha de inscripción; el cliente no es autoridad. Las otras dos proceden de los datos declarados y estructurados correspondientes, y no son diagnósticos ni certificaciones oficiales.

### `TerritorialUnit`

- `id` UUID, PK.
- `parentId` nullable, FK a la misma tabla.
- `type` enum: `DEPARTMENT`, `MUNICIPALITY`, `NEIGHBORHOOD`, `RURAL_SETTLEMENT`.
- `officialCode` nullable; obligatorio para departamento/municipio (DIVIPOLA).
- `normalizedName`, `displayName`.
- `status`.
- `tenantId` nullable únicamente para unidades nacionales compartidas verificadas; obligatorio para barrio/vereda administrado por el tenant.
- Unique recomendado por `(tenantId, parentId, type, normalizedName)` y por código oficial cuando aplique.

### `PatientAddress`

- `id` UUID, PK.
- `tenantId`, `patientId`.
- `departmentUnitId`, `municipalityUnitId`, `localUnitId`.
- `areaType` enum `URBAN`/`RURAL`.
- `localityPendingNormalization` boolean.
- `localityUnverifiedText` nullable, separado del catálogo canónico.
- `exactAddress` siempre clasificado como dato personal sensible, separado del territorio canónico y protegido por controles de acceso/almacenamiento. El cifrado de campo a nivel de aplicación no se incorpora silenciosamente en CORE-01; requeriría gestión de claves aprobada en una tarea de seguridad posterior.
- `directions` nullable y minimizado.
- `createdAt`, `updatedAt`.

CORE-01 puede cargar un catálogo inicial controlado de barrios/veredas para el municipio MVP. Si no existe catálogo local confiable o no aparece la unidad, se usa una opción canónica `OTHER_PENDING_NORMALIZATION` y se conserva el texto declarado por separado. Ese texto nunca crea silenciosamente una `TerritorialUnit`, no se usa como categoría oficial y queda pendiente de validación futura. Departamento/municipio usan códigos verificables compatibles con DIVIPOLA y pueden venir preconfigurados por el tenant.

### `ConsentRecord`

- `id` UUID, PK; `tenantId`, `patientId`.
- `consentVersion` string controlado por configuración.
- `consentType`/`purpose` enum o código controlado.
- `acceptedAt` timestamp asignado por servidor.
- `createdAt`.

El consentimiento vigente mostrado por la UI es obligatorio. CORE-01 persiste su versión y aceptación sin inventar ni hardcodear un texto legal nuevo.

### `EnrollmentSession`

- `id` UUID, PK; `tenantId`, `patientId`.
- `tokenHash` hash criptográfico del token aleatorio; unique. El token en claro nunca se persiste.
- `expiresAt`, `createdAt`, `lastUsedAt` nullable y `revokedAt` nullable.
- Metadatos técnicos mínimos y no identificadores solo si son indispensables para seguridad.

Después de la transacción, el token se entrega exclusivamente mediante cookie `HttpOnly`, `Secure` fuera de desarrollo local, con `SameSite` elegido conforme a la topología real y expiración limitada/configurable. La cookie no contiene PII ni `patientId`. La comparación del token/hash debe ser segura y la rotación/revocación debe quedar encapsulada para futura autenticación completa.

### Auditoría mínima

Los timestamps y `origin` no equivalen al sistema de auditoría completo. La transacción de creación debe producir además un evento mínimo append-only `PATIENT_ENROLLMENT_CREATED` sin copiar documento, dirección u otros valores sensibles al log. Si este evento se difiere, debe quedar como desviación explícitamente aprobada; no puede afirmarse auditoría completa.

## 5. Migración

**Sí, requerida.** Debe crear los modelos, claves foráneas, índices, enums/restricciones, unicidad de documento por tenant, catálogo territorial mínimo, consentimiento, sesión con hash/expiración y tenant institucional MVP mediante mecanismo controlado. Debe incluir rollback documentado; no borrar datos ni modificar fixtures existentes.

Antes de implementar debe cerrarse si el catálogo se carga por migración idempotente o seed versionado. No usar nombres de barrio/vereda escritos en fixtures hospitalarios como datos oficiales.

## 6. Contrato de API propuesto

### `POST /api/v1/patients/enrollments`

- Crea Persona + Paciente + pertenencias + dirección + consentimiento + evento mínimo + sesión de inscripción en **una transacción**.
- No acepta `age`, `createdAt`, `status`, `origin`, `tenantId` ni `createdBy` como autoridad del cliente.
- El servidor asigna `origin = PUBLIC_SELF_ENROLLMENT` y no inventa un usuario autenticado; `createdByUserId` queda nullable.
- Genera un token criptográficamente aleatorio, persiste solo su hash y entrega la sesión por cookie segura `HttpOnly`.
- Respuesta `201`: estado, fecha de inscripción y representación mínima necesaria para confirmación; no necesita exponer un identificador utilizable para lectura pública.
- Respuesta `400`: JSON mal formado/formato inválido.
- Respuesta `422`: validación semántica (territorio incoherente, ninguna población, fecha futura, catálogo inválido).
- Respuesta `409`: documento ya registrado en el tenant; código estable `PATIENT_DOCUMENT_CONFLICT`; no revela datos del registro existente y no fusiona.
- Respuesta `401/403`: para recuperación sin sesión, sesión inválida/expirada o contexto no autorizado, según el contrato final documentado.
- Idempotencia/reintento: CORE-01 usa la restricción única en DB como barrera final para reintentos y concurrencia; no añade infraestructura de `Idempotency-Key`.

### `GET /api/v1/patients/me`

- Recupera únicamente el paciente asociado a la `EnrollmentSession` válida recibida por cookie.
- Requiere validación server-side de token, hash, expiración, revocación y tenant institucional activo.
- Nunca devuelve un paciente de otro tenant; ante acceso no autorizado usar la semántica acordada que no filtre existencia.
- No acepta `patientId` ni documento y no es endpoint municipal ni agregado.
- La respuesta general excluye por defecto documento completo, token/hash, consentimiento interno y dirección exacta.

No se incluye `GET /patients/:patientId` para la sesión pública, listado nominal ni búsqueda por documento en CORE-01.

## 7. Validación y normalización

- DTOs con allowlist, rechazo de propiedades desconocidas, límites de longitud y transformación explícita.
- Normalizar documento por tipo (trim y reglas aprobadas); no aplicar una transformación destructiva universal sin catálogo por tipo.
- Validar catálogo de tipo documental, sexo/género y EPS en servidor.
- Nombres: trim, límites y caracteres Unicode; conservar la forma de presentación.
- `birthDate`: fecha real, no futura; edad derivada con zona/fecha de corte consistente.
- Correo opcional/nullable; si existe, formato y longitud válidos. La validación frontend debe dejar de exigirlo sin rediseñar el flujo. Teléfono se mantiene conforme al formulario existente, con validación aprobada y sin asumir un número colombiano único si el catálogo no lo exige.
- Departamento/municipio: códigos válidos y relación padre-hijo.
- Área urbana/rural obligatoria.
- Barrio/vereda: `localUnitId` válido y descendiente del municipio; su tipo debe concordar con `areaType`.
- Dirección exacta obligatoria para esta inscripción según la UI aprobada; nunca se incluye en salidas agregadas.
- Una o más poblaciones; intersecciones se representan por filas independientes.
- Autorización de tratamiento requerida por la UI. Persistir `consentVersion`, `acceptedAt` asignado por servidor y `purpose/type` controlado; el booleano del cliente solo comunica aceptación de la versión configurada y no reemplaza el registro versionado.
- Error responses sin PII, stack traces ni detalles de DB.

## 8. Wiring frontend

1. Conservar el reducer y las cinco pantallas; añadir una capa cliente tipada separada.
2. Al confirmar Paciente, mapear únicamente los campos del contrato y enviar una vez; deshabilitar doble submit.
3. Mostrar estado accesible de envío, error recuperable y conflicto de documento; devolver foco al resumen/error correspondiente.
4. Solo mostrar “Inscripción completada” después de `201`.
5. No guardar paciente, token ni PII en `localStorage`; la sesión viaja en cookie `HttpOnly` administrada por el backend.
6. Al entrar/recargar la experiencia Paciente, llamar `GET /api/v1/patients/me` con credenciales de cookie. Un ID en URL no concede acceso.
7. No conectar todavía Alcaldía ni superficies hospitalarias.

## 9. Privacidad, aislamiento y seguridad

- Identidad, documento, contacto y dirección son `SENSITIVE_PERSONAL`.
- Denegación por defecto; autorización en servidor; tenant obtenido de sesión/token/contexto confiable, nunca del body o header arbitrario.
- Todas las tablas personales incluyen/validan tenant y las consultas filtran por él. Preparar RLS según `docs/SECURITY.md`; no afirmar aislamiento completo sin pruebas de aplicación y DB.
- Alcaldía solo consumirá en otra tarea proyecciones/consultas agregadas que excluyan nombres, documentos, contactos y dirección exacta.
- No crear ahora un endpoint municipal. La separación se preserva modelando ubicación y membresías aparte de la identidad y evitando una “vista universal”.
- No registrar DTOs, documentos, direcciones, teléfonos, correos ni consentimientos en logs.
- El POST público debe tener rate limit y protección anti-automatización proporcionados al riesgo, sin convertir el conflicto de documento en un canal que revele información adicional.
- La sesión de inscripción es una credencial: token aleatorio de entropía suficiente, hash en reposo, cookie `HttpOnly`, `Secure` según entorno, `SameSite` coherente con la topología real, expiración configurable, revocación y ausencia total en logs.
- Solo datos ficticios en tests y seeds.

## 10. Archivos permitidos para la implementación posterior

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_core_01/**`
- Un loader versionado bajo `prisma/` para el tenant/configuración y catálogo territorial mínimo controlado, sin personas ni datos reales.
- `prisma.config.ts` solo si Prisma lo requiere para migración/seed.
- `apps/api/package.json`
- `package-lock.json` únicamente por dependencias aprobadas.
- `apps/api/src/app.module.ts`
- Nuevos módulos enfocados bajo `apps/api/src/database/`, `apps/api/src/patients/`, `apps/api/src/territory/`, `apps/api/src/consents/`, `apps/api/src/enrollment-sessions/` y `apps/api/src/audit/` (auditoría mínima).
- Pruebas API bajo `apps/api/src/**/*.test.ts` y `apps/api/test/**`.
- `apps/api/src/openapi/openapi.ts` solo para registrar contratos/configuración necesaria.
- `apps/web/src/features/inscripcion/InscripcionExperience.tsx`
- `apps/web/src/features/inscripcion/inscripcionFlow.ts` solo para mapping/estado necesario, sin rediseño.
- Nuevos `apps/web/src/features/inscripcion/patientEnrollmentClient.ts` y pruebas.
- Archivos mínimos de `apps/web/src/features/paciente/` para recuperación real, únicamente si el destino post-inscripción aprobado es esa experiencia.
- `apps/web/src/config/environment.ts` y `.env.example` solo si falta exponer de forma segura la URL pública de API al cliente.
- `packages/shared/src/` solo para contratos puros realmente compartidos; no acoplar Prisma al frontend.

## 11. Archivos prohibidos

- Todo `prototype-claude/**`.
- Todo `apps/web/src/features/municipality/**` y `apps/web/src/features/hospital/**`.
- Fixtures ajenos y datos demostrativos existentes.
- Cuidador, visitador/profesional, agenda, finanzas, integraciones y hosting.
- `tasks/TASK-DEPLOY-DEMO-01.md` y cualquier cambio no relacionado.
- `.env`, secretos, credenciales, datos reales, builds (`dist`, `.next`) y artefactos generados versionados no exigidos.
- Git, CI/CD, infraestructura y despliegue.

## 12. Pruebas obligatorias

### Unidad

- Normalización de documento por cada tipo soportado.
- Fecha/edad de corte, incluido cumpleaños y fecha futura.
- Mapeo de las tres poblaciones y las siete combinaciones no vacías.
- Validación de jerarquía territorial y coherencia urbana/rural.
- Mapping UI → DTO sin campos clínicos/contactos no incluidos en el mínimo aprobado.

### Integración con PostgreSQL real de test

- La transacción crea todas las filas y puede recuperarlas tras crear una nueva instancia de aplicación/cliente.
- Solo se persiste el hash de la sesión; expiración/revocación impiden recuperación y una sesión válida recupera únicamente su paciente.
- Restricción única bloquea carrera concurrente de documento duplicado.
- Un fallo intermedio hace rollback completo.
- FK/constraints rechazan territorio incoherente y población duplicada.
- Aislamiento: mismo documento puede o no existir en tenants distintos conforme a la regla aprobada; ningún tenant recupera el registro de otro.

### API/e2e

- `201` establece cookie segura; `GET /me` funciona con ella. También se prueban `400`, `401/403`, `409`, `422` y respuestas sanitizadas.
- Documento duplicado devuelve conflicto estable y no fusiona ni revela PII.
- Propiedades extra y valores de catálogo falsos son rechazados.
- Autorización negativa y acceso cross-tenant.
- Logs de pruebas no contienen PII.

### Frontend y accesibilidad

- No se llama API antes de confirmar.
- Loading evita doble envío; error permite reintento seguro.
- `409` se comunica con lenguaje claro y foco manejado.
- Éxito solo tras `201`.
- Refresh recupera el mismo paciente mediante `GET /me` y cookie `HttpOnly`, no desde memoria/localStorage.
- Teclado, labels, resumen de errores, anuncios `aria-live`, foco y contraste se mantienen.
- Regresión visual de los cinco pasos: sin rediseño ni cambio de branding.

### Verificación final

- `npm run prisma:validate`
- migración limpia sobre DB vacía y prueba documentada de rollback/restore aplicable
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- escaneo de secretos

## 13. Definition of Done

1. Usuario completa la rama Paciente de Inscripción existente.
2. Backend valida y deriva edad/población de 60+.
3. Una transacción persiste Persona, Paciente, poblaciones y territorio en PostgreSQL.
4. El paciente se recupera mediante `GET /api/v1/patients/me` y la sesión de inscripción segura; persiste tras refresh/reinicio del cliente.
5. Funcionan simultáneamente las tres poblaciones y sus intersecciones.
6. Departamento, municipio, urbana/rural y barrio/vereda usan identificadores estructurados; dirección exacta permanece separada y sensible.
7. Duplicado por tipo y documento normalizado dentro del tenant se bloquea en DB y devuelve `409`, sin fusión, sobrescritura ni revelación adicional, incluso bajo concurrencia.
8. Aislamiento de tenant y pruebas negativas pasan.
9. No existe salida nominal para Alcaldía ni se modifica su UI.
10. No se rediseña Inscripción ni se modifica el prototipo.
11. OpenAPI refleja los contratos y fallos.
12. Todas las pruebas y checks de la sección 12 están verdes y Claude Code devuelve comandos, resultados y evidencia.
13. Codex audita la implementación antes de aceptación o Git.

## 14. Evidencia requerida de Claude Code

- Lista de archivos modificados y propósito.
- Diagrama/resumen de transacción y resolución de tenant/actor.
- Migración y evidencia de aplicación sobre DB limpia.
- Ejemplos sanitizados de `201`, `409`, `422` y denegación cross-tenant.
- Resultados completos de pruebas/checks y cobertura relevante.
- Evidencia de refresh y de que no se usa almacenamiento local como persistencia.
- Evidencia de las siete combinaciones poblacionales y territorio normalizado.
- Dependencias añadidas y justificación.
- Desviaciones, supuestos y riesgos residuales.

## 15. STOP CONDITIONS

Detener únicamente la parte afectada y volver al Product Owner/Codex si ocurre cualquiera:

1. La implementación no puede resolver el tenant institucional activo desde configuración server-side o intenta aceptarlo desde el navegador.
2. Se pretende publicar el POST sin rate limit/controles de abuso, o recuperar por ID/documento en vez de la sesión y `GET /me`.
3. Se intenta inventar un catálogo territorial, convertir texto pendiente en unidad canónica o atribuir barrio/vereda a DIVIPOLA sin fuente verificada.
4. Se necesita cambiar el diseño visual: emitir `REQUIERE CLAUDE DESIGN`.
5. Se propone aceptar `tenantId`, `createdBy`, edad o procedencia desde el cliente como autoridad.
6. Se pretende persistir diagnósticos/condiciones clínicas del formulario dentro de CORE-01.
7. Se intenta usar localStorage/fixtures como persistencia o integrar Alcaldía/Hospital.
8. Se requiere exponer dirección o datos nominales en agregados municipales.
9. La migración es destructiva, usa datos reales o no tiene ruta segura de rollback.
10. La unicidad o el aislamiento no pueden imponerse en PostgreSQL y probarse bajo concurrencia/cross-tenant.
11. La sesión no usa token criptográfico, persiste el token en claro, se expone a JavaScript, carece de expiración/revocación, o el consentimiento no conserva versión y fecha server-side.
12. Aparece contradicción con documentación autoritativa o cambio material de alcance.
13. Algún test obligatorio falla o no se puede ejecutar contra PostgreSQL real de test.

## 16. Agentes/revisiones utilizados

- 01 MERDN Orchestrator: alcance, gate, separación Codex/Claude y stop conditions.
- 02 UX/UI Fidelity Guardian: conservación del flujo aprobado y accesibilidad.
- 03 Backend & Data Architect: dominio, Prisma, transacción, unicidad y territorio.
- 04 Security & Access Guardian: autenticación, tenant, privacidad, PII y pruebas negativas.
- 05 Institutional & Regulatory Agent: agregación municipal y límites de significado de discapacidad/60+/cuidado.
- 06 Integrations & Automation Agent: confirma que CORE-01 no necesita integración externa; exige fallos/reintentos explícitos.
- 07 QA & Acceptance Agent: matriz de pruebas y Definition of Done verificable.
- 09 Frontend Application Architect: wiring tipado sin rediseño ni persistencia local.

## 17. Recomendación

Implementar este slice con Persona y Paciente separados, memberships poblacionales relacionales, territorio jerárquico y creación transaccional. Es la opción mínima compatible con persona única por tenant, intersecciones y futuras salidas agregadas; tres booleanos directamente en Paciente serían más rápidos, pero rigidizan el catálogo y debilitan procedencia/historial.

## 18. Decisiones materiales cerradas y pendientes

### Cerradas por el Product Owner

1. Tenant institucional activo, multi-tenant preservado y resolución exclusiva server-side; sin selector ni administración multiempresa.
2. Autoinscripción pública con `origin = PUBLIC_SELF_ENROLLMENT`; `createdByUserId` nullable y sin usuario ficticio.
3. Recuperación mediante `EnrollmentSession`: token aleatorio, solo hash persistido, cookie `HttpOnly`, expiración configurable y `GET /api/v1/patients/me`.
4. Consentimiento obligatorio y versionado con `consentVersion`, `acceptedAt` y `purpose/type`, reutilizando la UI y sin inventar texto legal.
5. Umbral de persona mayor: `>= 60`, derivado de fecha de nacimiento y sin edad autoritativa persistida.
6. Poblaciones múltiples no exclusivas; discapacidad/cuidado son datos declarados, no inferencias clínicas.
7. Correo opcional y teléfono conforme al formulario existente.
8. Territorio jerárquico; departamento/municipio verificables; `TerritorialUnit` local tenant-scoped; alternativa pendiente de normalización sin crear categoría canónica.
9. Dirección exacta separada, sensible, ausente de logs, agregados y respuestas generales.
10. Unicidad por `(tenantId, documentType, normalizedDocument)`; `409` seguro, sin fusión, sobrescritura ni revelación adicional.
11. Persistencia minimizada a Persona, Paciente, memberships, territorio/dirección, consentimiento, sesión y auditoría mínima.
12. Alcaldía, Hospital, Cuidador, Profesional, integraciones y demás módulos enumerados permanecen fuera.

### Pendientes no bloqueantes para CORE-01

- Valores/configuración operativa concretos del tenant MVP, expiración de sesión, `SameSite` y cookie domain se determinan por entorno y topología durante implementación, respetando este contrato; no habilitan una decisión de producto distinta.
- La posterior normalización administrativa de textos territoriales pendientes queda para otra tarea; CORE-01 solo conserva su estado no canónico.
- La matriz completa de permisos, autenticación permanente, retención general y acceso domiciliario futuro quedan fuera de alcance.

No queda una decisión material adicional indispensable para ejecutar el alcance definido. **READY FOR CLAUDE: SÍ**.
