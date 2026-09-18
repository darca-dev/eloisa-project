# Tareas 009 - Hospital · Pacientes (API y vista conectada)

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

### API y contrato

- [x] `GET /api/v1/hospital/patients` — listado paginado
      (`hospital-patients.controller.ts:97`)
- [x] `GET /api/v1/hospital/patients/analytics` — analítica del conjunto filtrado
      (`hospital-patients.controller.ts:154`)
- [x] `GET /api/v1/hospital/patients/:patientId` — detalle minimizado
      (`hospital-patients.controller.ts:201`)
- [x] `analytics` declarado antes que `:patientId` para evitar la colisión de
      rutas
- [x] Superficie de SOLO LECTURA: ningún `@Post`, `@Patch` ni `@Delete`
- [x] `Cache-Control: private, no-store`, `Pragma: no-cache` y `Vary: Cookie` en
      las tres respuestas
- [x] Contrato propio en `hospital.contract.ts`, no derivado de Prisma
- [x] Cabecera del contrato que enumera los datos PROHIBIDOS y declara lo que
      esta superficie NO es
- [x] Envelope de error estable `{ code, message }` con tres códigos
      hospitalarios
- [x] DTO explícitos para OpenAPI (`hospital-patients.dto.ts`)

### Autorización, tenant y auditoría

- [x] Rol `HOSPITAL_PATIENT_VIEWER` añadido de forma aditiva al enum
- [x] `401` sin sesión institucional vigente; la cookie de paciente cae aquí
- [x] `403` con sesión institucional válida sin ese rol; una sesión municipal cae
      aquí
- [x] `503` fail-closed cuando el contexto de ejecución seguro no se confirma
- [x] Guard hospitalario separado de `MunicipalViewerGuard`, sin jerarquía
      compartida
- [x] Tenant tomado del principal resuelto en servidor; el navegador no puede
      enviarlo
- [x] Toda consulta dentro de `PrismaService.withTenant()` **y** con filtro
      explícito `tenantId`
- [x] Auditoría del acceso concedido en la MISMA transacción que sirve los datos
- [x] Auditoría de la denegación best-effort, documentada como excepción
      deliberada
- [x] La traza de una denegación sustituye el identificador por `:patientId`
- [x] Una lectura de detalle sin resultado no se audita como acceso concedido
- [x] Ni el término de búsqueda ni los filtros llegan a auditoría o a logs
- [x] Aprovisionamiento de la identidad hospitalaria fail-closed, sin fallback

### Minimización de datos

- [x] Dos selecciones cerradas de columnas; la analítica es más estrecha que el
      listado
- [x] Teléfono, correo, dirección exacta, indicaciones, texto libre territorial y
      consentimiento no se seleccionan siquiera de la base
- [x] Documento SIEMPRE enmascarado; menos de 4 caracteres → `···reservado`
- [x] Edad derivada de la fecha de nacimiento contra la fecha de corte en UTC
- [x] `older60` derivado y no leído de la pertenencia poblacional persistida
- [x] Territorio canónico; el texto libre de localidad nunca se proyecta
- [x] `contactAvailability` como texto fijo, no como campo vacío
- [x] `patientId` opaco; `personId` no aparece en ninguna respuesta ni evento
- [x] Lista de campos y valores prohibidos verificada por la suite de API

### Consulta y analítica

- [x] Allowlist cerrada de parámetros; desconocido, repetido o mal formado → 400
- [x] `epsCode` validado contra el catálogo controlado del servidor
- [x] `municipalityOfficialCode` con forma de cinco dígitos
- [x] Rango de edad traducido a rango de fechas de nacimiento
- [x] `older60` combinado con `ageMax` por la cota más restrictiva
- [x] La analítica rechaza `page`, `pageSize`, `sort` y `direction`
- [x] Orden total y estable, con el identificador como desempate
- [x] Página fuera de rango corregida de forma determinista y publicada
- [x] Ocho intersecciones disjuntas que reconcilian el universo filtrado
- [x] `percentage: null` cuando el denominador es cero; nunca `0`
- [x] `keyFigures` nombradas así a propósito: son conteos, no indicadores
      institucionales
- [x] Errores de validación que nombran el parámetro y nunca el valor recibido

### Web

- [x] Cliente tipado como frontera única vista→API
- [x] `credentials: 'include'` y `cache: 'no-store'`
- [x] Sin repliegue a fixtures, verificado por prueba que lee el código fuente
- [x] El cliente nunca lanza: devuelve un desenlace tipado, con `cancelado` como
      desenlace de primera clase
- [x] Listado y analítica coordinados por un mismo `AbortController`
- [x] Búsqueda con retardo y normalización antes de enviarse
- [x] Ante error se limpia todo el estado nominal
- [x] Estados reales: cargando, listo, vacío, sin resultados, 401, 403, error
      recuperable y detalle ausente
- [x] Badge de procedencia real `Registros ELOISA` solo en esta vista
- [x] Fecha de corte tomada siempre del servidor
- [x] Capacidades del diseño conservadas visibles y deshabilitadas, con ayuda
      accesible
- [x] Sin `localStorage`, `sessionStorage`, IndexedDB, `document.cookie` ni
      telemetría en todo el módulo Hospital
- [x] Allowlist exacta de archivos Hospital autorizados a usar `fetch`

### Base de datos

- [x] Migración aditiva única, con rollback documentado
- [x] Cuatro tipos de evento de auditoría hospitalarios
- [x] Check `audit_event_resource_required` reescrito de lista positiva a
      negativa
- [x] Ninguna tabla, columna, política ni privilegio nuevo
- [x] `audit_event` conserva su carácter append-only

## Límites conocidos (no autorizados como trabajo)

- [ ] Agregación de la analítica en SQL (`GROUP BY`) en lugar de en memoria
- [ ] Objetivo de rendimiento p95 ≤500 ms: hoy ~1719 ms sin filtros y ~884 ms con
      filtros, según la medición reportada en la corrección de Codex
- [ ] Índices para el orden por `person.familyNames`, `person.givenNames` y
      `person.birthDate`
- [ ] `MERDN_HOSPITAL_PATIENT_VIEWER_SECRET` y
      `MERDN_HOSPITAL_PATIENT_VIEWER_CODE` en `.env.example` de `develop`
- [ ] Estados de paciente distintos de `ACTIVE`; mientras solo exista uno,
      `sort=status` es inerte y el campo `status` de la respuesta es un literal
- [ ] Condición principal, Patologías, Profesional, Cuidador, Programa, Próxima
      atención, Últimas atenciones y Semáforo: visibles y siempre «Información no
      disponible»
- [ ] Ordenar por Próxima atención
- [ ] Teléfono, correo y dirección exacta con este rol institucional compartido
- [ ] Creación, edición, archivado, importación, exportación, descarga o
      impresión dedicada
- [ ] Intercambio entre instituciones: ver un paciente de otro tenant exigiría una
      relación interinstitucional aprobada
- [ ] RBAC definitivo con identidad individual, finalidad, relación de atención,
      vigencia, consentimiento aplicable y política de retención
- [ ] Auditoría independiente de esta capacidad: `reviews/` está cerrado y no
      contiene ninguna sobre HOSPITAL-CORE-01
- [ ] Reconciliar el literal de no disponibilidad con `TASK-HOSPITAL-CORE-01`
      §4.3, o registrar formalmente la desviación

## Verificación pendiente

- [ ] Instalar dependencias y ejecutar `hospital-patients.query.test.ts`,
      `hospital-patients.projection.test.ts`,
      `hospital-patient-viewer.guard.test.ts`, `hospitalPatientsClient.test.ts`,
      `hospitalPatients.test.tsx` y `hospitalAlcance.test.ts` — no necesitan base
      de datos
- [ ] Levantar PostgreSQL y ejecutar `hospital-patients.api.test.ts` y
      `hospital-institutional-auth.api.test.ts`, hoy saltadas por
      `describe.skipIf`
- [ ] Ejecutar esas suites con un servidor PostgreSQL normal,
      `MERDN_RUNTIME_ROLE=enforce` y una identidad runtime no propietaria y sin
      `BYPASSRLS`, con dos tenants, contexto ausente o incorrecto,
      identificadores cruzados directos y reutilización de pool: la RLS
      hospitalaria sigue sin evidencia
- [ ] Volver a medir el p95 de listado, detalle y analítica sobre un conjunto
      sintético ≥3.000 registros; las cifras citadas proceden de la corrección de
      Codex, no de una medición hecha hoy
- [ ] Arrancar la API sin las variables de la identidad hospitalaria y observar
      el `401` uniforme que la lógica fail-closed predice
- [ ] `npm run lint`, `npm run typecheck`, `npm run build:api` y
      `npm run build:web`
- [ ] Revisión visual de la vista conectada en 1440×900, 1024×768 y 390×844 con
      zoom al 200 %: hoy solo se midió el código fuente de los componentes
