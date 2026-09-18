# Tareas 017 - Worklist del profesional visitador

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

### Ruta y contrato HTTP

- [x] `GET /api/v1/professional/visits` declarado con `@Get()` en
      `apps/api/src/visits/visits.controller.ts:283`, antes de `@Get(':visitId')`
      (`:352`) para hacer la precedencia explícita
- [x] Controlador montado en `PROFESSIONAL_VISITS_PATH = 'api/v1/professional/visits'`
      (`visits.controller.ts:124`, `@Controller` en `:255`)
- [x] `@UseGuards(HumanSessionGuard)` sobre toda la clase (`visits.controller.ts:265`)
- [x] `Cache-Control: private, no-store` y `Vary: Cookie` mediante `noStore`
      (`apps/api/src/human-auth/human-session.guard.ts:124-127`), aplicadas también al `401`
- [x] El instante de evaluación lo fija el servidor: `new Date()` en
      `visits.controller.ts:348`; la consulta no lo admite
- [x] Contrato OpenAPI con `operationId: listProfessionalVisitWorklist` y dos
      parámetros de consulta obligatorios (`visits.controller.ts:284-334`)

### Validación de la ventana

- [x] `parseWorklistQuery` (`apps/api/src/visits/visits.dto.ts:531`) con allowlist
      cerrada `['from','to']` (`:400`)
- [x] `from` y `to` obligatorios, sin periodo por defecto
- [x] Fecha real de calendario: `2026-02-31` y `2026-13-01` producen `400`
      (`visits.dto.ts:502-515`)
- [x] Ventana no invertida y máximo de 31 días inclusive (`visits.dto.ts:409`, `:551`)
- [x] Parámetro repetido y sintaxis anidada `?from[x]=y` rechazados
      (`visits.dto.ts:470-491`)
- [x] `VisitsQueryError` nombra el parámetro y la regla y nunca el valor recibido
      (`visits.dto.ts:412-420`)
- [x] Resolución UTC con cota superior exclusiva (`visits.dto.ts:441`, `:452`)

### Autorización y consulta

- [x] Cadena completa en una sola condición SQL: `principal.personId` →
      `ProfessionalProfile ACTIVE` → `ProfessionalAffiliation ACTIVE` y vigente →
      `CareAssignment ACTIVE` y vigente
      (`apps/api/src/visits/professional-visit-worklist.service.ts:303-329`)
- [x] Una sola operación bajo `PrismaService.withTenant(principal.tenantId)`
      (`professional-visit-worklist.service.ts:109`)
- [x] Filtro explícito por `tenantId` en cita, paciente, asignación, perfil y
      afiliación, además de RLS y de claves foráneas compuestas (`:119-135`)
- [x] Solo `modality = HOME`, `status = ASSIGNED` y `scheduledStart` dentro de la
      ventana (`:121-132`)
- [x] Afiliación comparada por día UTC puro mediante `fechaSinHora` (`:339`)
- [x] Lista vacía y `200` en vez de `403`/`404` cuando no hay perfil, afiliación,
      asignación ni citas (`:54-58`)

### Proyección de la respuesta

- [x] `{ window, items }` con la ventana devuelta exactamente como se pidió (`:166-170`)
- [x] Fila: `{ appointmentId, scheduledStart, modality, patient, visit }` (`:202-222`)
- [x] `modality: 'HOME'` como constante del contrato, no reflejo del almacenamiento (`:211`)
- [x] Paciente reducido a `displayName` e `initials` (`:265`, `:274`)
- [x] `visit` con `homeVisitId`, `status`, `version`, `startedAt`, `endedAt`,
      `updatedAt`, o `null` (`:235-257`)
- [x] Coherencia defensiva: la visita solo se proyecta si su `careAssignmentId`
      coincide con el de la cita autorizada (`:242-247`)
- [x] Orden estable `scheduledStart ASC`, desempate por `id ASC` (`:160`)
- [x] Cinco clases DTO documentadas (`visits.dto.ts:575`, `:594`, `:642`, `:685`, `:696`)

### Registro y pruebas

- [x] `ProfessionalVisitWorklistService` declarado como proveedor
      (`apps/api/src/visits/visits.module.ts:62`) y alcance del módulo actualizado
- [x] Bloque `E` de `apps/api/test/visits.api.test.ts:1285-1740` con 12 pruebas de
      integración: `visit: null`, visita materializada, `401`, 23 consultas
      inválidas (12 de forma de ventana y 11 de campos de autoridad), sin perfil, perfil/afiliación inválidos, aislamiento cruzado,
      filtro HOME/ASSIGNED/ventana, límites UTC, orden estable, minimización y
      contrato OpenAPI
- [x] `503` fail-closed ampliado a las cuatro operaciones del módulo
      (`visits.api.test.ts:1742-1800`, worklist en `:1758`)

### Disciplina de alcance respetada

- [x] Exactamente los cinco archivos de la allowlist de MP01 en el commit `15a9ae1`
- [x] Cero migraciones: ningún archivo de `prisma/` en el commit
- [x] Cero modelos y cero eventos de auditoría nuevos
- [x] Cero cambios en Hospital, Admin Support o cualquier superficie web

## Límites conocidos (no autorizados como trabajo)

> Ninguna de estas líneas es una tarea aprobada. Son el estado real de la
> capacidad el 2026-08-25.

### La brecha principal: MP02 está preservado fuera de `develop`, sin verificar

> **Actualizado el 2026-08-25.** Las líneas de este bloque decían que estos seis
> archivos «no existen» y que «el trabajo tampoco está en ninguna rama». Dejó de
> ser cierto: se preservaron en `wip/visitador-mp02-20260825` (`cffbf6b`),
> subida a GitHub. Siguen marcados `[ ]` porque **no** están en `develop` y
> porque su contenido no se ha verificado contra la Task Specification de MP02.

- [ ] `apps/web/src/app/visitador/page.tsx` — la ruta `/visitador` no existe en
      `develop`; el archivo existe en `wip/visitador-mp02-20260825` (32 líneas),
      sin verificar
- [ ] `apps/web/src/features/visitador/VisitadorExperience.tsx` — no existe en
      `develop`; existe en la rama WIP (931 líneas), sin verificar
- [ ] `apps/web/src/features/visitador/visitador.module.css` — no existe en
      `develop`; existe en la rama WIP (357 líneas), sin verificar
- [ ] `apps/web/src/features/visitador/visitadorWorklistClient.ts` — no existe en
      `develop`, donde `grep -ril "worklist" apps/web/` no devuelve nada; existe
      en la rama WIP (486 líneas), sin verificar
- [ ] `visitadorWorklistClient.test.ts` (466 líneas) y
      `visitadorExperience.test.tsx` (491 líneas) — no existen en `develop`;
      existen en la rama WIP y **no se han ejecutado**
- [ ] Ningún consumidor del worklist en la web de `develop`: la única referencia
      a `professional/visits` es `hospitalVisitsClient.ts:121`, que solo
      construye las rutas de detalle y de cambio de estado
- [x] **Actualizado el 2026-08-25.** Esta línea decía que el contenido de los
      seis archivos no se había leído, revisado ni contrastado con
      `tasks/VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md`. Dejó de ser
      cierto: Codex auditó MP02 y devolvió `PASS WITH CORRECTIONS`
- [ ] Las correcciones que esa auditoría exige no se han aplicado. Ver
      «Correcciones bloqueantes de MP02» más abajo
- [ ] La rama WIP no se ha fusionado con `develop` y la implementación no está
      aprobada: `SAFE TO INTEGRATE INTO DEVELOP: NO`. Detalle en
      `spec/bitacora/global/PROJECT_LOG.md`

### Límites de la API construida

- [ ] Sin evento de auditoría para la lectura del worklist: `AuditEventType` no
      tiene ninguno para esta superficie. Residual declarado en MP01 §5
- [ ] Sin paginación ni límite de filas: no hay `take`, `skip` ni `cursor`; una
      ventana de 31 días devuelve todas sus citas
- [ ] Sin guarda de límite de tasa en el controlador profesional
- [ ] `visit: null` es ambiguo: cubre «no materializada» y «asignación
      incoherente» (hoy inalcanzable por el trigger `home_visit_guard`)
- [ ] Ventana UTC pura, sin zona institucional modelada
      (`visits.dto.ts:433-440`): los límites del día se desplazan respecto a la
      hora local de la profesional
- [ ] Solo HOME + ASSIGNED: no hay superficie profesional para citas `VIRTUAL`,
      `ON_SITE`, `REQUESTED` ni `CANCELLED`
- [ ] La profesional no puede materializar: depende de que Hospital ejecute
      `POST /api/v1/visits/materialize` con identidad `HOSPITAL_SCHEDULER`
- [ ] La condición de autorización está duplicada entre
      `professional-visit-worklist.service.ts:303` y
      `professional-visit-query.service.ts:156`
- [ ] `appointmentId` y `homeVisitId` viajan en la respuesta; la exigencia de no
      renderizarlos (MP01 §3) no está verificada por ninguna prueba porque no hay UI
- [ ] Sin auditoría de Codex: `ls reviews/ | grep -i visitador` no devuelve nada
- [ ] Sin datos de demostración locales: `tools/hospital-local-data/` no existe en
      esta copia; ejercitar el worklist exige siembra manual más
      `tools/identity-provisioning`
- [ ] MP03 (transiciones desde la interfaz Visitador) no está ni especificado

## Correcciones bloqueantes de MP02 (registradas el 2026-08-25, NO autorizadas)

> **Origen:** auditoría de Codex sobre `wip/visitador-mp02-20260825` (`cffbf6b`).
> `MP02 CODEX VERDICT: PASS WITH CORRECTIONS`,
> `SAFE TO INTEGRATE INTO DEVELOP: NO`, `SPEC 017 READY FOR APPROVAL: NO`.
>
> **Actualizado el 2026-08-25.** Este bloque decía que ninguna casilla estaba
> aprobada. Dejó de ser exacto: el Product Owner aprobó el **alcance** de B1 y B2
> —registro en
> `spec/bitacora/decisiones/2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md`—
> y mantuvo B3, B4 y B5 pendientes.
>
> Aprobar el alcance **no** autoriza escribir código: la compuerta SDD sigue
> cerrada y no admite aprobación parcial. `[ ]` = exigido y sin hacer. Nada de
> esto autoriza commit, merge, push ni despliegue (`CLAUDE.md` §12).

### B1 · Fail-closed de `visit` — TRASLADADA A LA SPEC 018

> Alcance aprobado el 2026-08-25 y ejecución trasladada a
> `spec/specs/018-correcciones-visitador-mp02/`. Las casillas siguen aquí como
> registro del hallazgo; el trabajo se marca en la spec 018.

- [ ] Tratar **solo** `visit: null` explícito como «cita no materializada»
- [ ] Tratar como respuesta inválida toda fila en la que `visit` falte
      (`undefined`) o llegue mal formado, en vez de mostrarla como pendiente de
      preparación institucional
- [ ] Defecto medido en `cffbf6b`: `normalizarVisita` colapsa `undefined` con
      `null` (`apps/web/src/features/visitador/visitadorWorklistClient.ts:281-284`)
- [ ] Prueba que distinga los dos casos: `visit` ausente ≠ `visit: null`

### B2 · Validación de ventana — TRASLADADA A LA SPEC 018

> Alcance aprobado el 2026-08-25 y ejecución trasladada a
> `spec/specs/018-correcciones-visitador-mp02/`.

- [ ] Rechazar la ventana invertida
- [ ] Rechazar la ventana mayor de 31 días
- [ ] Exigir que la ventana devuelta por el servidor coincida **exactamente** con
      la solicitada, y tratar la discrepancia como respuesta inválida
- [ ] Estado medido en `cffbf6b`: la salida sí se valida antes de la red
      (`esVentanaValida:240`, invocada en `:428`); la entrada no —
      `normalizarWorklist` solo comprueba la forma de día de `window.from` y
      `window.to` (`:361-364`) y nunca la compara con la pedida (`:468`)
- [ ] Pruebas de los tres casos: invertida, mayor de 31 días y ventana devuelta
      distinta de la pedida

### B3 · Pruebas de interacción real — NO APROBADA, pendiente

> Las suites actuales renderizan marcado estático (`renderToStaticMarkup`) e
> inyectan cada desenlace por propiedad; la propia suite declara que clic, foco,
> teclado y navegación entre vistas quedan fuera
> (`visitadorExperience.test.tsx:33-43`). **Bloqueada** por la decisión de
> producto 1 y 2 de `spec.md`.

- [ ] Detección inicial de sesión
- [ ] Carga inicial del día UTC actual
- [ ] Aplicar período
- [ ] Anterior
- [ ] Siguiente
- [ ] Hoy
- [ ] Abrir visita
- [ ] Cargar detalle
- [ ] Volver a la agenda
- [ ] Reintento
- [ ] Logout exitoso
- [ ] Logout fallido
- [ ] Requests abortados o rezagados (`stale`) que no repinten información
      incorrecta

### B4 · Foco y accesibilidad — NO APROBADA, pendiente

> **Bloqueada** por las mismas decisiones que B3.

- [ ] Gestionar el foco al entrar al detalle
- [ ] Restaurar el foco al regresar a la agenda
- [ ] Verificación de navegación por teclado
- [ ] Verificación de accesibilidad

### B5 · Verificación visual y de ejecución — NO APROBADA, pendiente

> **Bloqueada** por la decisión de producto 3 de `spec.md`: exige la aplicación
> en marcha con API, PostgreSQL con tenant aplicado, OIDC y agenda sembrada.

- [ ] Escritorio
- [ ] Viewport estrecho
- [ ] Comportamiento responsive
- [ ] Fidelidad con el diseño aprobado
- [ ] Sin alterar la dirección visual aprobada

### B6 · Verificaciones finales tras las correcciones

- [ ] Las 78 pruebas focales existentes vuelven a pasar
      (`npx vitest run --root apps/web src/features/visitador/visitadorWorklistClient.test.ts src/features/visitador/visitadorExperience.test.tsx`)
- [ ] Las nuevas pruebas de interacción pasan
- [ ] Typecheck de web (`npm run typecheck --workspace @merdn/web`)
- [ ] ESLint acotado a los archivos del paquete
- [ ] `git diff --check`
- [ ] Validación SDD correspondiente
      (`./spec/scripts/check-sdd-gate.sh .` y
      `./spec/scripts/validate-sdd.sh . --strict`)

> Las 78 están medidas, no ejecutadas: `visitadorWorklistClient.test.ts` declara
> 23 bloques `it` que expanden a 43 casos y `visitadorExperience.test.tsx`
> declara 30 que expanden a 35. 43 + 35 = 78.

## Hardening recomendado DESPUÉS de integrar — no bloqueante

> Estas líneas **no** condicionan la integración de MP02. Se listan aquí solo
> para que no se confundan con B1–B6. Siguen sin ser trabajo aprobado y ya están
> descritas en «Límites conocidos».

- [ ] Evento de auditoría para la lectura del worklist
- [ ] Paginación, límite de filas y límite de tasa
- [ ] Zona institucional en vez de ventana UTC pura
- [ ] Desambiguar los dos casos que hoy comparten `visit: null` en el servidor
- [ ] Unificar la condición de autorización duplicada entre
      `professional-visit-worklist.service.ts:303` y
      `professional-visit-query.service.ts:156`
- [ ] Ejecutar las 12 pruebas del bloque `E` de la API y el resto de la
      «Verificación pendiente» de este archivo
- [ ] MP03: transiciones profesionales desde la interfaz, sin especificar

## Decisiones de producto requeridas antes de poder ejecutar B3, B4 y B5

- [ ] **Entorno DOM de pruebas.** `apps/web/vitest.config.mts:28` fija
      `environment: 'node'` y no hay `jsdom`, `happy-dom` ni
      `@testing-library/*`. B3 y B4 exigen una dependencia nueva
      (`CLAUDE.md` §9.11 y stop condition de la propia Task Spec de MP02)
- [ ] **Ampliación de la allowlist de MP02.** Esa dependencia obliga a tocar
      `apps/web/vitest.config.mts`, `apps/web/package.json` y el lockfile, fuera
      de los seis archivos congelados (`CLAUDE.md` §9.10)
- [ ] **Entorno de ejecución para B5.** API, PostgreSQL con tenant, OIDC y
      agenda sembrada; `tools/hospital-local-data/` no existe en esta copia y
      `apps/api/node_modules` está vacío
- [ ] **Vía de integración.** Sobre la rama WIP o sobre una rama nueva desde
      `develop`, con qué operación Git y con qué autorización (`CLAUDE.md` §12)

## Verificación pendiente

- [ ] Ejecutar las 12 pruebas del bloque `E`:
      `npx vitest run --config vitest.config.mts test/visits.api.test.ts --fileParallelism=false`
      desde `apps/api`. **No ejecutado**: `node_modules` ausente en la raíz y en
      `apps/api`, cliente Prisma no generado y sin PostgreSQL levantada
- [ ] Confirmar que la suite **no se omite**: `visits.api.test.ts:310` la envuelve
      en `describe.skipIf(!puedeEjecutarse)`, de modo que sin base de datos se
      saltaría entera y una omisión no es una verificación
- [ ] `npx tsc --noEmit -p tsconfig.json` en `apps/api`. **No ejecutado**
- [ ] `npx eslint` sobre los cuatro archivos de `src/visits/` del paquete y la
      suite. **No ejecutado**
- [ ] Comprobar en ejecución los códigos y cabeceras de la ruta con una sesión
      humana real. **No ejecutado**: nada de lo descrito sobre `200`/`400`/`401`/
      `503` fue observado; todo está leído del código y de las aserciones
- [ ] Medir el tamaño y el tiempo de respuesta de una ventana de 31 días con
      agenda real. **No medido**
- [ ] Leer y contrastar los seis archivos de `wip/visitador-mp02-20260825`
      (`cffbf6b`) contra `tasks/VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md`.
      **No ejecutado.** Ya no es imposible —el código está en el remoto— pero no
      se ha hecho
- [ ] Ejecutar las dos suites que MP02 incluye (`visitadorWorklistClient.test.ts`
      y `visitadorExperience.test.tsx`). **No ejecutado**: mismo impedimento de
      entorno que el resto del repositorio
