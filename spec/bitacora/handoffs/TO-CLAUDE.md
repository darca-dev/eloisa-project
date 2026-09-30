Handoff-Version: 58
Updated-At: 2026-09-30
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP04
Status: READY

# Handoff vigente a OpenCode - SPEC 038 / MP04

## Objetivo unico

Completar en un solo paquete la provision OIDC local y el acceso humano posterior
a una aprobacion Hospital. Paciente, Cuidador y Visitador medico deben poder
preparar una credencial ficticia al registrar la solicitud, permanecer sin
acceso mientras no exista aprobacion, autenticarse despues de una provision
confirmada y perder acceso de inmediato al suspender o revocar.

Este paquete sustituye el acceso visual directo a `/cuidador` y `/profesional`
por superficies protegidas. No crea relaciones Cuidador-Paciente, asignaciones
profesionales, permisos clinicos, pagos ni datos reales.

MP04 se ejecuta de principio a fin con checkpoints internos; no detenerse entre
backend, web y pruebas para pedir autorizaciones parciales. Detenerse solo ante
una contradiccion material, un secreto/dato real, un archivo prohibido o una
compuerta SDD cerrada.

## Decisiones tecnicas cerradas para este paquete

1. Se reutiliza exclusivamente el flujo humano OIDC existente y el realm local
   `merdn-local`. No crear login local, arreglo de usuarios, token propio,
   Direct Access Grant ni rol derivado de claims.
2. OD-11 se materializa agregando una contrasena ficticia al formulario de
   solicitud. La API puede mantenerla en memoria solo durante la llamada para
   enviarla al Keycloak local; nunca la guarda, retorna, audita, registra ni la
   incorpora a errores. El campo se limpia de React inmediatamente al terminar
   cada intento, exitoso o fallido.
3. Al registrar, el servidor crea/reutiliza la `Person` y la solicitud, prepara
   en Keycloak un usuario DESHABILITADO con username opaco derivado de la
   referencia `AR-...`, persiste el `sub` real en `ExternalAuthIdentity` y deja
   `HumanAccount.status=DISABLED`. El `202` conserva exactamente
   `{reference,status:'PENDING',source:'TEST_DATA'}`; la referencia es tambien
   el identificador que la persona usara en el login OIDC.
4. No reutilizar ni adaptar `patients/keycloak-admin.client.ts` ni
   `patient-enrollment.service.ts`: quedaron en cuarentena documental por 027.
   Crear un cliente nuevo, limitado al realm humano local, sin PII en logs y con
   reintento iterativo acotado.
5. Una aprobacion ejecuta una saga explicita: decision versionada a
   `APPROVED_PENDING_PROVISIONING`, intento OIDC, participacion minima y solo
   entonces `APPROVED`. Puede completarse sincronicamente dentro de la misma
   llamada HTTP, pero en transacciones PostgreSQL separadas de la llamada
   externa. Un fallo deja `PROVISIONING_FAILED`, cuenta deshabilitada y accion
   reintentable; nunca deja acceso utilizable.
6. Cada solicitud se vincula a una cuenta humana propia. Agregar FK nullable
   tenant-scoped `AccessRequest.humanAccountId` y metadatos tecnicos de intento
   suficientes para reintento limitado, backoff y diagnostico por CODIGO
   cerrado. No guardar username, password, token, cuerpo de Keycloak ni error
   libre.
7. Perfil minimo al provisionar:
   - `PATIENT`: crear/reutilizar `Patient` de la misma `Person`, con el valor
     controlado `NO_SABE` / `No sabe` y origen `PUBLIC_SELF_ENROLLMENT`; no
     inventar poblaciones, direccion, consentimiento ni relacion.
   - `CAREGIVER`: no crear relacion ni contexto `CAREGIVER`. La cuenta aprobada
     recibe solo la experiencia neutra Cuidador.
   - `FIELD_PROFESSIONAL`: crear/reutilizar perfil `MEDICINA_GENERAL` /
     `Medicina general` y afiliacion ficticia `THIRD_PARTY` vigente desde la
     fecha UTC del servidor. No crear asignacion, paciente, visita ni permiso
     clinico.
8. Separar `experiences` de `contexts`. Crear `GET /api/v1/me/experiences`,
   protegido por sesion humana, que devuelve exactamente experiencias
   aprobadas de la cuenta: `PATIENT`, `CAREGIVER`, `FIELD_PROFESSIONAL`.
   `GET /me/contexts` conserva su significado actual: Cuidador sin relacion no
   obtiene contexto `CAREGIVER`; Profesional sin asignacion puede tener perfil
   y afiliacion, pero cada recurso sigue exigiendo asignacion.
9. Acciones institucionales cerradas:
   - `APPROVE`: `PENDING -> APPROVED_PENDING_PROVISIONING -> APPROVED` o
     `PROVISIONING_FAILED`;
   - `RETRY_PROVISIONING`: `PROVISIONING_FAILED -> APPROVED_PENDING_PROVISIONING`;
   - `SUSPEND`: `APPROVED -> SUSPENDED`;
   - `REACTIVATE`: `SUSPENDED -> APPROVED_PENDING_PROVISIONING`;
   - `REVOKE`: `APPROVED|SUSPENDED -> REVOKED`;
   - `REJECT`: `PENDING|PROVISIONING_FAILED -> REJECTED`.
   Cada accion exige version vigente y motivo cerrado. `REJECTED` y `REVOKED`
   son terminales.
10. Suspender o revocar deshabilita la cuenta, revoca todas sus sesiones en la
    misma transaccion y bloquea la siguiente peticion aunque Keycloak no
    responda. Revocar tambien deja el vinculo externo `UNLINKED`. La
    sincronizacion de `enabled=false` con Keycloak se intenta y audita sin
    debilitar el bloqueo MERDN.
11. `/acceso` inicia el mismo Authorization Code + PKCE y, al volver, consulta
    experiencias server-side: una sola experiencia redirige a `/paciente`,
    `/cuidador` o `/profesional`; varias muestran un selector; ninguna muestra
    una denegacion neutral. Agregar `/acceso` a la allowlist exacta de retorno.
12. `/paciente`, `/cuidador` y `/profesional` quedan protegidas. Paciente usa
    self-scope existente. Cuidador sin relacion muestra portada neutra sin datos
    nominales. Profesional sin asignacion muestra worklist vacia; no puede ver
    las visitas estaticas actuales. Las APIs, no la navegacion visual, siguen
    siendo autoridad.

## Allowlist exacta

### Configuracion, OIDC y datos

- `.env.example`
- `compose.yml`
- `infra/local-oidc/README.md`
- `infra/local-oidc/realm-merdn-local.json`
- `prisma/schema.prisma`
- `prisma/migrations/20260930170000_access_provisioning/migration.sql` nuevo
- `prisma/migrations/ROLLBACK-access_provisioning.sql` nuevo

### API

- `apps/api/src/app.module.ts`
- `apps/api/src/config/environment.ts`
- `apps/api/src/config/environment.test.ts`
- `apps/api/src/access-requests/access-request.contract.ts`
- `apps/api/src/access-requests/access-request.dto.ts`
- `apps/api/src/access-requests/access-request.validation.ts`
- `apps/api/src/access-requests/access-request.service.ts`
- `apps/api/src/access-requests/access-request.controller.ts`
- `apps/api/src/access-requests/access-request.module.ts`
- `apps/api/src/access-requests/access-request-review.contract.ts`
- `apps/api/src/access-requests/access-request-review.dto.ts`
- `apps/api/src/access-requests/access-request-review.validation.ts`
- `apps/api/src/access-requests/access-request-review.service.ts`
- `apps/api/src/access-requests/access-request-review.controller.ts`
- `apps/api/src/access-requests/access-provisioning.contract.ts` nuevo
- `apps/api/src/access-requests/access-provisioning-identity.client.ts` nuevo
- `apps/api/src/access-requests/access-provisioning.service.ts` nuevo
- `apps/api/src/audit/audit.service.ts`
- `apps/api/src/human-auth/human-auth.contract.ts`
- `apps/api/src/human-auth/human-auth.config.ts`
- `apps/api/src/human-auth/human-auth.config.test.ts`
- `apps/api/src/human-auth/human-auth.controller.ts`
- `apps/api/src/human-auth/human-auth.dto.ts`
- `apps/api/src/human-auth/human-auth.service.ts`
- `apps/api/src/human-auth/me-contexts.controller.ts`
- `apps/api/src/identity-access/identity-access.module.ts`
- `apps/api/src/identity-access/approved-experiences.service.ts` nuevo
- `apps/api/src/identity-access/approved-experiences.service.test.ts` nuevo
- `apps/api/test/access-requests.test.ts`
- `apps/api/test/access-request-review.test.ts`
- `apps/api/test/access-provisioning.test.ts` nuevo
- `apps/api/test/access-provisioning.db.test.ts` nuevo
- `apps/api/test/application-composition.test.ts`
- `apps/api/test/human-auth.api.test.ts`
- `apps/api/test/identity-relationships-db.test.ts`
- `apps/api/test/openapi.test.ts`

### Web y E2E

- `apps/web/src/features/access/AccessRequestForm.tsx`
- `apps/web/src/features/access/accessRequestClient.ts`
- `apps/web/src/features/access/accessRequestClient.test.ts`
- `apps/web/src/features/access/CentralAccess.tsx`
- `apps/web/src/features/access/CentralAccess.test.ts`
- `apps/web/src/features/access/centralAccess.module.css`
- `apps/web/src/features/auth/humanSessionClient.ts`
- `apps/web/src/features/auth/humanSessionClient.test.ts`
- `apps/web/src/features/hospital/HospitalAccessRequests.tsx`
- `apps/web/src/features/hospital/hospitalAccessRequestsClient.ts`
- `apps/web/src/features/hospital/hospitalAccessRequestsClient.test.ts`
- `apps/web/src/features/hospital/hospitalAccessRequests.test.tsx`
- `apps/web/src/features/hospital/hospitalAlcance.test.ts`
- `apps/web/src/app/paciente/page.tsx` nuevo
- `apps/web/src/app/paciente/page.test.tsx` nuevo
- `apps/web/src/app/cuidador/page.tsx`
- `apps/web/src/app/cuidador/page.test.tsx` nuevo
- `apps/web/src/app/profesional/page.tsx`
- `apps/web/src/app/profesional/page.test.tsx` nuevo
- `apps/web/src/features/paciente/PacienteExperience.tsx`
- `apps/web/src/features/caregiver/CaregiverLiquidationsDemo.tsx`
- `apps/web/src/features/caregiver/CaregiverAccessPortal.tsx` nuevo
- `apps/web/src/features/caregiver/caregiverAccessPortal.module.css` nuevo
- `apps/web/src/features/caregiver/caregiverAccessPortal.test.tsx` nuevo
- `apps/web/src/features/profesional/ProfesionalPortal.tsx`
- `apps/web/src/features/profesional/professionalWorklistClient.ts` nuevo
- `apps/web/src/features/profesional/professionalWorklistClient.test.ts` nuevo
- `apps/web/src/features/profesional/profesional.test.tsx` nuevo
- `apps/web/e2e/access-provisioning.spec.ts` nuevo

### Gobernanza y reporte

- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para START y reporte final

No modificar ningun otro archivo. Si una prueba de alcance cerrada exige una
expectativa adicional, detenerse y reportar el archivo exacto antes de tocarlo.

## Contrato de credencial y Keycloak

1. El cuerpo publico pasa a tener diez claves maximas: las nueve vigentes mas
   `password`. `password` es obligatoria, 8-72 caracteres, al menos una letra y
   un numero, sin espacios de control. Rechazar claves adicionales y todos los
   campos de autoridad ya prohibidos.
2. No imprimir, serializar fuera de la llamada a Keycloak, incluir en objetos de
   auditoria, excepciones o snapshots el valor de `password`. Las pruebas usan
   un secreto centinela y comprueban que no aparece en logs, errores, respuesta
   ni argumentos Prisma.
3. La configuracion administrativa OIDC es completa o ausente, solo se admite
   con `MERDN_ENVIRONMENT=development|test`, realm exacto `merdn-local`, host
   local aprobado y el mismo issuer que autenticacion humana. Configuracion
   parcial o presente en `mvp` impide arrancar.
4. El cliente admite solo token administrativo, buscar usuario por username
   exacto, crear/actualizar credencial mientras la cuenta esta PENDING,
   habilitar/deshabilitar y obtener el ID real. URLs con `URLSearchParams`,
   timeout, maximo dos intentos totales y backoff inyectable; nunca recursion.
5. Un `409` de creacion solo es idempotente si la busqueda exacta devuelve un
   unico usuario con el marcador opaco de la misma solicitud. Cualquier otra
   colision falla cerrada.
6. Keycloak nunca recibe nombre, documento, telefono, email, tenant visible ni
   perfil como claim/rol. Solo username opaco, password, enabled y marcador
   opaco de idempotencia.

## Persistencia, concurrencia y auditoria

1. La migracion es aditiva, con FK compuesta cuenta-tenant, indices y checks
   para contador/fechas/codigo de error. Mantener FORCE RLS, owner, grants y
   policies actuales; el rollback se niega si existen dependencias de MP04.
2. Preparacion de identidad y provision usan `withTenant`, filtros explicitos y
   locks/updates condicionales. Dos registros o dos decisiones concurrentes no
   crean dos usuarios, cuentas, perfiles, afiliaciones ni sesiones.
3. Persistir el `sub` real exclusivamente en `ExternalAuthIdentity.subject`.
   `provisioningReference` sigue opaca y no contiene issuer, subject o username.
4. Exito y fallo escriben `ACCESS_PROVISIONING_SUCCEEDED` /
   `ACCESS_PROVISIONING_FAILED`; preparacion escribe eventos separados
   `ACCESS_IDENTITY_PREPARED` / `ACCESS_IDENTITY_PREPARATION_FAILED`.
   Suspension, revocacion, reactivacion y accesos/denegaciones de experiencia
   tambien se auditan. Ningun evento contiene PII, secreto, issuer o subject.
5. Si falla una auditoria transaccional, falla cerrada la mutacion. Un fallo de
   log tecnico nunca cambia una denegacion en permiso.

## Interfaz y accesibilidad

1. El password usa `type=password`, label real, ayuda clara de que es ficticio,
   autocomplete apropiado y boton mostrar/ocultar accesible. No se rellena ni
   se persiste. El resto del formulario se conserva tras fallo.
2. Tras 202 mostrar referencia/username, `PENDING` y que todavia no puede entrar.
   No afirmar que la cuenta esta aprobada.
3. Hospital lista estados relevantes, muestra provision fallida y ofrece solo
   acciones validas con confirmacion, version vigente y bloqueo sincronico.
4. Acceso humano usa navegacion OIDC real. No pide password dentro de MERDN para
   iniciar sesion, no usa fallback demo y no decide perfiles en el navegador.
5. Las tres portadas manejan carga, sin sesion, sesion sin experiencia,
   indisponibilidad y cierre; teclado, foco, `aria-live`, 320 px y axe sin
   violaciones criticas/serias.

## Pruebas obligatorias

1. Unitarias de validacion, maquina de estados, version, idempotencia, limite de
   reintentos, backoff, colision Keycloak y redaccion del secreto.
2. API simulada: registro prepara cuenta deshabilitada/sub real; login se niega
   antes; aprobar activa solo el perfil pedido; fallo OIDC deja
   `PROVISIONING_FAILED`; retry recupera; suspender/revocar invalidan sesion;
   terminales no reabren; 401/403/cross-tenant no revelan existencia.
3. DB real aislada si la baseline 025 esta disponible: FK tenant, RLS, carreras,
   unicidad de cuenta/identidad/perfil y revocacion atomica. Si no esta
   disponible, no usar `merdn_dev`: reportar la evidencia DB como diferida sin
   convertirla en verde.
4. Cliente web: body exacto, password limpiada, respuesta 202 exacta,
   experiencias exactas y redirecciones cerradas.
5. Componentes: Paciente self-scope; Cuidador sin relacion sin contexto ni datos;
   Profesional sin asignacion sin nombres/visitas; selector si hay multiples;
   sin experiencia deniega neutralmente.
6. Playwright focal con API/OIDC interceptados: registro y limpieza de password,
   antes/despues de aprobacion, los tres destinos, fallo/retry, doble accion,
   suspension/revocacion, teclado, foco, responsive y axe. Cada escenario crea
   su propio estado y no depende de otro.
7. Ejecutar suites focales y regresiones afectadas, OpenAPI, composicion,
   typecheck API/web, lint focal, `prisma validate`, `prisma format --check`,
   escaneo focal de secretos y ambas compuertas SDD.

## Limites y cierre

- Sin dataset/reset/runbook de MP05 y sin E2E integral real de MP06.
- Sin relaciones Cuidador-Paciente, asignaciones, datos clinicos, pagos, correo,
  SMS, Firebase, nuevas dependencias, produccion, Git ni despliegue.
- No modificar `prototype-claude/`, `tasks/`, `reviews/`, migraciones existentes
  ni el flujo 027 en cuarentena.
- Registrar START antes de leer/editar y reemplazarlo al final por reporte con
  archivos, pruebas, conteos, estado de DB real, riesgos y confirmacion de no
  persistencia/exposicion del secreto.
- Detenerse para auditoria Codex. MP05 permanece cerrado.

---

Handoff-Version: 57
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP03-C2
Status: IMPLEMENTED_AWAITING_PRODUCT_OWNER_ACCEPTANCE

# Handoff vigente a OpenCode - SPEC 038 / MP03-C2

## Objetivo unico

Sustituir `HospitalAccessApprovalsDemo` y su estado en memoria por una bandeja
Hospital conectada a la API MP03-C1, utilizable por la sesion exacta
`HOSPITAL_ACCESS_REVIEWER`. Este paquete termina MP03 visual; no provisiona
cuentas ni concede acceso a Paciente, Cuidador o Visitador medico.

## Allowlist exacta

- `apps/web/src/features/hospital/HospitalAccessApprovalsDemo.tsx`
- `apps/web/src/features/hospital/hospitalAccessApprovalsDemo.module.css`
- `apps/web/src/features/hospital/HospitalAccessRequests.tsx` nuevo
- `apps/web/src/features/hospital/hospitalAccessRequests.module.css` nuevo
- `apps/web/src/features/hospital/hospitalAccessRequestsClient.ts` nuevo
- `apps/web/src/features/hospital/hospitalAccessRequestsClient.test.ts` nuevo
- `apps/web/src/features/hospital/hospitalAccessRequests.test.tsx` nuevo
- `apps/web/src/features/hospital/HospitalAdministration.tsx`
- `apps/web/src/features/hospital/HospitalShell.tsx`
- `apps/web/src/features/hospital/hospitalAdministration.test.tsx`
- `apps/web/src/features/hospital/hospitalAlcance.test.ts`
- `apps/web/src/features/hospital/hospitalInstitutionClient.test.ts`
- `apps/web/src/features/hospital/hospitalShell.test.tsx`
- `apps/web/src/features/auth/institutionalSessionClient.ts`
- `apps/web/src/features/auth/institutionalSessionClient.test.ts`
- `apps/web/e2e/hospital-access-requests.spec.ts` nuevo
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

Los dos archivos `*ApprovalsDemo*` pueden eliminarse cuando ya no tengan
imports. No modificar configuracion, backend, prototipo ni otros modulos.

## Contrato de cliente

1. Crear un unico cliente tipado sobre `resolvePublicApiBaseUrl()`:
   - `GET /api/v1/hospital/access-requests`
   - `GET /api/v1/hospital/access-requests/{requestId}`
   - `POST /api/v1/hospital/access-requests/{requestId}/decision`
2. Todas las llamadas usan `credentials: 'include'`; la decision usa JSON y
   exactamente `action`, `expectedVersion`, `reasonCode`.
3. El listado envia `status=PENDING`, `limit=20`, y solo agrega `profile`, `q`
   y `cursor` cuando correspondan. Usar `URLSearchParams`; nunca concatenar
   texto de busqueda sin codificar.
4. Validar cuerpos y claves exactas de 200. No aceptar DTO parcial, HTML, texto,
   estado/perfil fuera de catalogo, fechas invalidas, UUID/reference invalidos,
   version no positiva ni cursor vacio.
5. Mapear sin revelar cuerpo del servidor: 400 invalid-request, 401
   session-required, 403 forbidden, 404 not-found, 409 conflict, 503
   unavailable; red, JSON malformado y otros estados => unavailable.
6. No usar localStorage, sessionStorage, IndexedDB, URL para estado sensible,
   fixtures, fallback demo ni datos del prototipo.

## Comportamiento de la bandeja

1. Mostrar permanentemente `Datos ficticios de prueba` y explicar que aprobar
   deja el acceso pendiente de provision; no afirmar que ya puede iniciar sesion.
2. Cargar al montar y ofrecer recarga. Implementar estados visibles y
   mutuamente coherentes: carga, vacio, error, resultados, detalle y decision.
3. Busqueda explicita por referencia, nombre o documento y filtro de perfil con
   rotulos visibles. Buscar al enviar; limpiar restablece la lista. No disparar
   una peticion por cada tecla.
4. Listado minimizado: nombre, referencia, perfil, fecha y estado. Documento,
   nacimiento y contacto aparecen solo despues de pedir el detalle auditado.
5. Paginacion `Cargar mas` con el cursor devuelto. Mantener el conjunto de
   filtros de la pagina inicial, impedir doble carga y no duplicar filas.
6. Detalle accesible en una region o dialogo nombrado, cerrable con boton y
   Escape, con retorno de foco al control que lo abrio. No depender del color.
7. Aprobar/rechazar requieren un paso de confirmacion visible y cancelable. Los
   motivos son fijos: `APPROVE/DEMO_ELIGIBLE` y
   `REJECT/DEMO_NOT_ELIGIBLE`; nunca texto libre.
8. Bloquear doble decision sincronicamente con `useRef` ademas de `disabled`.
   En exito, anunciar el estado exacto y recargar desde servidor: el estado
   React no se convierte en fuente de verdad.
9. En 409 cerrar/invalidar el detalle vencido, anunciar que otra revision cambio
   la solicitud y recargar. En 401 limpiar inmediatamente lista y detalle y
   avisar al `HospitalShell` para retirar la sesion. En 403 limpiar datos y
   mostrar falta de capacidad. En 503 conservar filtros y permitir reintento.
10. Cancelar/ignorar respuestas tardias al desmontar o cambiar consulta. Una
    respuesta anterior no puede sobrescribir una busqueda posterior.

## Integracion por rol

1. Con sesion `HOSPITAL_ACCESS_REVIEWER`, el shell entra directamente en
   Administracion / Solicitudes de acceso y solo ofrece ese destino en su
   navegacion. No montar dashboard, pacientes, agenda u otras superficies para
   ese rol.
2. La bandeja solo se monta para ese rol. Otras sesiones institucionales no
   llaman esta API ni ven acciones de revision. Esto es coherencia de UI; los
   guards del backend siguen siendo la autoridad.
3. El modo demo local actual usa `HOSPITAL_PATIENT_VIEWER`: no debe recibir la
   bandeja real ni un fallback en memoria.

## Accesibilidad y responsive

- Labels reales, controles por teclado, foco visible, `aria-live` sin mensajes
  duplicados, encabezados de tabla asociados y alternativa legible en movil.
- Botones con nombre que incluya accion y referencia; estado de espera anunciado.
- Confirmacion y detalle no pueden atrapar ni perder el foco.
- Mantener el lenguaje visible `Visitador médico`; no usar `Personal de terreno`.

## Pruebas obligatorias

1. Cliente: URLs/encoding/cookie, cuerpos exactos, DTO estricto y todos los
   desenlaces HTTP anteriores.
2. Componente: carga, vacio, error+reintento, busqueda formateada, filtro,
   paginacion sin duplicados, detalle minimizado, aprobar, rechazar, cancelar,
   doble click, 409, 401 y respuestas fuera de orden.
3. Rol: reviewer entra directo y monta la bandeja; patient viewer y municipal no
   la montan ni llaman la API; modo demo no recupera la tabla en memoria.
4. Playwright real con red interceptada: teclado/foco, busqueda, detalle,
   confirmacion, una sola decision ante doble gesto, conflicto, vacio, error y
   responsive. Ejecutar axe sobre la bandeja en estado con datos y detalle.
5. Ejecutar unitarias focales, E2E focal, typecheck web, lint focal y compuertas
   SDD. La API y DB reales no son requisito de este E2E interceptado.

## Limites y cierre

- Sin provisioning, Keycloak, credenciales demo, seed/reset, cambios API/DB,
  suspender/revocar, Git ni despliegue.
- Registrar START antes de leer/editar; al terminar reemplazarlo por reporte
  final con archivos, conteos, comandos, resultados y riesgos reales.
- Detenerse para auditoria Codex. MP04 permanece cerrado.

---

Handoff-Version: 56
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP03-C1-C1
Status: READY

# Handoff vigente a OpenCode - SPEC 038 / MP03-C1-C1

## Objetivo unico

Cerrar en un solo paquete los hallazgos funcionales de la auditoria de MP03-C1:
busqueda documental util para la bandeja, cursor estrictamente valido y evento
de denegacion para una peticion sin sesion. No implementar UI ni provision.

## Allowlist exacta

- `apps/api/src/access-requests/access-request-review.validation.ts`
- `apps/api/src/access-requests/access-request-review.service.ts`
- `apps/api/src/access-requests/access-request-review.guard.ts`
- `apps/api/src/audit/audit.service.ts`
- `apps/api/test/access-request-review.test.ts`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Correcciones obligatorias

1. Mantener la busqueda por referencia y nombres. Para documento, buscar tanto
   `documentNumber` declarado como `documentNumberNormalized`. Derivar del `q`
   una variante documental que elimine espacios, puntos y guiones, y usarla en
   `documentNumberNormalized` solo si queda contenido. Una consulta como
   `44.556.677` debe encontrar una fila cuyo normalizado sea `44556677`. No
   registrar ni devolver el termino buscado.
2. El cursor decodificado debe contener exactamente dos segmentos separados por
   `|`: fecha UTC ISO canonica e UUID admitido. Rechazar segmentos adicionales,
   fechas no canonicas y cualquier forma que no pudiera haber producido
   `encodeAccessRequestReviewCursor`. Debe continuar respondiendo 400 opaco.
3. Una peticion sin sesion valida debe generar
   `ACCESS_REQUEST_LIST_DENIED` con `actorType=UNAUTHENTICATED`,
   `actorUserId=null`, `actorRole=null`, tenant resuelto exclusivamente mediante
   `TenantContextService`, ruta logica y correlacion saneada. Crear un metodo de
   auditoria separado para este caso; no volver opcionales el actor y rol de los
   eventos autenticados. La denegacion sigue siendo best-effort y siempre
   conserva la respuesta 401 original si falla la traza.
4. El 401 no puede consultar solicitudes ni revelar existencia, filtros, PII,
   cookie o token. El 403 autenticado conserva su actor institucional real.
5. Corregir la asercion tautologica del test de roles denegados: verificar de
   forma explicita el actor y rol esperados para cada intento.
6. No modificar el job de expiracion: en el arbol auditado sus dependencias ya
   son importaciones de valor y el hallazgo reportado no se reproduce.

## Pruebas obligatorias

- Busqueda con documento declarado y con `44.556.677` contra
  `documentNumberNormalized=44556677`, sin cruce de tenant.
- Cursor valido aceptado; cursores con tercer segmento y fecha ISO no canonica
  rechazados con 400.
- 401 sin sesion crea exactamente una denegacion `UNAUTHENTICATED` con actor y
  rol nulos, sin tocar `accessRequest`; si la auditoria falla, sigue respondiendo
  401 y nunca concede acceso.
- 403 conserva identidad y rol exactos, sin la asercion tautologica actual.
- Repetir suite focal, OpenAPI, composicion, access-requests, institutional-auth,
  typecheck API, lint focal y las dos compuertas SDD. PostgreSQL sigue diferido.

## Limites

- Sin cambios de esquema, migraciones, seed, Docker, Keycloak, UI, provision,
  credenciales, Git o despliegue.
- No ampliar el paquete por fallos de suites DB sin `DATABASE_URL`.
- Prependar el reporte y detenerse para auditoria Codex. MP03-C2 permanece
  cerrado hasta esta verificacion.

---

Handoff-Version: 55
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP03-C1
Status: READY

# Handoff vigente a OpenCode - SPEC 038 / MP03-C1

## Objetivo unico

Implementar la API institucional que permite al Hospital listar, buscar,
consultar, aprobar y rechazar solicitudes persistentes de los tres perfiles.
No implementar todavía provisión OIDC ni la bandeja web.

## Allowlist exacta

- `apps/api/src/access-requests/**`
- `apps/api/src/audit/audit.service.ts`
- `apps/api/src/institutional-auth/institutional-auth.contract.ts`
- `apps/api/src/institutional-auth/institutional-auth.config.ts`
- `apps/api/src/institutional-auth/institutional-auth.module.ts`
- `apps/api/src/institutional-auth/institutional-auth*.test.ts`
- `apps/api/src/generated/prisma/**` solo si Prisma generate lo modifica
- `apps/api/test/access-request-review*.test.ts`
- `apps/api/test/application-composition.test.ts`
- `apps/api/test/openapi.test.ts`
- `.env.example` solo nombres/comentarios, nunca valores utilizables
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato obligatorio

1. Leer SPEC 038, sus contratos, las decisiones del 2026-09-28 y 2026-09-29,
   v55 y los patrones institucionales existentes. Registrar START y ejecutar
   las dos compuertas SDD antes de editar.
2. Incorporar `HOSPITAL_ACCESS_REVIEWER` al contrato TypeScript institucional y
   al aprovisionamiento existente. Usar variables propias de código y secreto,
   ambas obligatorias y sin valor por defecto. Reutilizar la única sesión/cookie
   institucional; no crear otro AuthService ni credenciales en fuente.
3. Crear un guard exacto de revisor: sesión ausente/inválida responde 401 y otro
   rol 403, sin revelar solicitudes. Tenant, identidad y rol salen solo de la
   sesión. La decisión POST exige también origen permitido. Denegaciones y
   concesiones producen los eventos de SPEC 038 sin PII, filtros ni conteos.
4. Implementar `GET /api/v1/hospital/access-requests` con filtros cerrados
   opcionales `status`, `profile`, `q`, `limit` y `cursor`. `limit` será 1..50,
   con valor predeterminado 20. La consulta y el cursor se acotan y validan; la
   búsqueda opera solo dentro del tenant sobre referencia, nombres o documento
   normalizado. Responder `{ items, nextCursor }`, orden estable por
   `submittedAt DESC, id DESC`. Cada item incluye solo `requestId`, `reference`,
   `requestedProfile`, `status`, `version`, `submittedAt`, `givenNames` y
   `familyNames`. No devolver tenant, personId, documento, contacto ni auditoría.
5. Implementar `GET /api/v1/hospital/access-requests/{requestId}`. Devuelve los
   campos anteriores y, para revisión, `documentType`, `documentNumber`,
   `birthDate`, `sexGenderCode`, `phone`, `email`, `provisioningStatus`,
   `decidedAt` y `decisionReasonCode`. No devuelve IDs internos relacionados,
   secretos, OIDC, tokens ni datos de otro tenant. ID ajeno e inexistente son el
   mismo 404 neutral.
6. Implementar `POST /api/v1/hospital/access-requests/{requestId}/decision` con
   body exacto y sin texto libre:
   `{ action, expectedVersion, reasonCode }`. Solo aceptar
   `APPROVE + DEMO_ELIGIBLE` o `REJECT + DEMO_NOT_ELIGIBLE`. `APPROVE` transita
   `PENDING -> APPROVED_PENDING_PROVISIONING`; `REJECT` transita
   `PENDING -> REJECTED`. Guardar identidad revisora, fecha servidor, razón y
   versión incrementada dentro de una transacción con auditoría atómica. Nunca
   marcar `APPROVED` ni crear cuenta, perfil, relación o asignación.
7. Usar actualización optimista por `tenantId + requestId + PENDING + version`.
   Una repetición exacta del mismo actor/acción/razón/expectedVersion devuelve el
   resultado vigente sin segundo cambio ni segundo evento. Otro estado o versión
   produce 409 neutral; decisiones concurrentes aceptan como máximo una.
8. Respuestas y errores cerrados: 400 filtros/body, 401 sesión, 403 rol/origen,
   404 opaco, 409 conflicto y 503 indisponibilidad. No incluir PII, SQL,
   constraint, tenant ni causa interna en errores/logs. Documentar en OpenAPI
   únicamente estas tres rutas y métodos.
9. Añadir pruebas focales simuladas de lista/paginación/búsqueda, minimización,
   detalle, rol exacto, origen, dos tenants, 404 opaco, transición, replay,
   concurrencia, auditoría atómica y ausencia de provisión. Corregir dentro de
   allowlist la deuda de typecheck por el rol y el lint del módulo access-request.
10. Ejecutar pruebas focales API, composición, OpenAPI, typecheck API completo,
    lint de archivos autorizados, Prisma validate/format-check y SDD estricto.
    No Docker, DB real, migraciones, seed, Keycloak, web, dependencias, Git,
    deploy, MP03-C2 ni MP04. Reportar y detenerse.

## Precedencia

MP02-C2-C1 queda `PASS`: bloqueo sincrónico, contrato 202 literal, rótulo,
OpenAPI y siete pruebas Playwright están verificados. La duplicación de avisos
accesibles queda como mejora para MP03-C2 y no bloquea esta API. La evidencia DB
continúa pendiente por SPEC 025 diferida. MP03-C1 no concede acceso: una
aprobación queda esperando provisión en MP04.

---

Handoff-Version: 54
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP02-C2-C1
Status: READY

# Handoff vigente a OpenCode - SPEC 038 / MP02-C2-C1

## Objetivo unico

Corregir cuatro hallazgos focales de MP02-C2 y probar la interacción real del
formulario en navegador. No iniciar la bandeja Hospital ni ampliar el flujo.

## Allowlist exacta

- `apps/web/src/features/access/**`
- `apps/web/e2e/access-request.spec.ts`
- `apps/api/src/access-requests/access-request.dto.ts`
- `apps/api/test/openapi.test.ts`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato obligatorio

1. Leer SPEC 038, las decisiones 2026-09-28 y 2026-09-29, v54 y los archivos
   permitidos. Registrar START y ejecutar ambas compuertas SDD antes de editar.
2. En `AccessRequestForm`, sustituir la guarda basada solo en estado React por
   un bloqueo sincrónico por intento (por ejemplo `useRef`). Dos eventos submit
   en el mismo tick deben causar una sola llamada. Liberar el bloqueo en todo
   desenlace para permitir reintento; el aviso `disabled` sigue reflejando el
   estado visible. No cambiar el body ni introducir persistencia.
3. En el cliente, aceptar un 202 solo si tiene exactamente `reference`,
   `status: 'PENDING'` y `source: 'TEST_DATA'`, con la referencia vigente. Tipar
   esos dos literales. Un status/source diferente o una clave adicional devuelve
   `unavailable`. Añadir pruebas unitarias para ambos rechazos.
4. Aplicar la decisión de producto visible: `FIELD_PROFESSIONAL` se rotula
   «Visitador médico» en este formulario. El valor técnico no cambia. Paciente,
   Cuidador y Visitador médico deben permanecer como las tres opciones.
5. Corregir exclusivamente el ejemplo OpenAPI de `reference` para que cumpla
   `^AR-[0-9A-F]{24}$`; añadir una aserción focal en OpenAPI que impida volver a
   publicar un ejemplo imposible. No cambiar DTO, API ni generación real.
6. Crear una prueba Playwright focal, interceptando
   `**/api/v1/access-requests` sin API/DB/Keycloak reales. Debe verificar labels
   y recorrido por teclado, las tres opciones visibles, contacto obligatorio,
   dos submits sincrónicos con una sola petición, botón bloqueado mientras la
   respuesta está pendiente, referencia/PENDING tras 202 y reintento después de
   error. No guardar artefactos HTML en el repo.
7. Ejecutar unitarias focales de access, la prueba Playwright focal, OpenAPI
   focal, typecheck web, lint de archivos tocados y SDD estricto. No suite
   general, Docker, PostgreSQL, SQL, migraciones, seed, Keycloak, dependencias,
   Git, deploy, MP03 ni cambios fuera de allowlist. Reportar resultados y
   detenerse; el tiempo empleado se informa pero no sustituye la corrección.

## Precedencia

MP02-C2 queda `FAIL - CORRECCIÓN AUTORIZADA`: el flujo principal existe y sus
pruebas pasan, pero la guarda React no impide dos submits en el mismo tick, el
cliente admite status/source fuera del contrato y falta evidencia de interacción
real. El ejemplo OpenAPI y el rótulo visible también se corrigen aquí. MP03 sigue
cerrado hasta auditoría de MP02-C2-C1.

---

Handoff-Version: 52
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP02-C1-C1
Status: READY

# Handoff vigente a OpenCode - SPEC 038 / MP02-C1-C1

## Objetivo unico

Corregir el orden de barreras del endpoint público y actualizar la expectativa
OpenAPI que la nueva ruta obliga a cambiar. No ampliar funcionalidad.

## Defectos confirmados por Codex

1. El controlador solo declara `AccessRequestRateLimitGuard`; la comprobación de
   origen ocurre dentro del método, después de todos los guards. Un origen ajeno
   puede agotar el límite de una IP antes de recibir 403. Esto contradice el
   contrato de MP02-C1.
2. `apps/api/test/openapi.test.ts` compara la lista cerrada de rutas y falla
   porque falta `/api/v1/access-requests`, aunque la ruta nueva está aprobada y
   documentada por Nest Swagger.

## Allowlist exacta

- `apps/api/src/access-requests/**`
- `apps/api/test/access-requests*.test.ts`
- `apps/api/test/openapi.test.ts`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato obligatorio

1. Registrar START, leer gobernanza, SPEC 038, handoff v52 y la implementación
   MP02-C1. Ejecutar y reportar ambas compuertas SDD antes de editar.
2. Crear un guard de origen propio del módulo, reutilizando únicamente la
   comprobación existente de origen permitido. Debe devolver el código público
   `ACCESS_REQUEST_ORIGIN_REJECTED`, no un código de Hospital ni autenticación.
   Declararlo antes del rate-limit en `@UseGuards` para que un origen denegado,
   ausente u opaco no incremente el contador. Retirar la verificación duplicada
   del controlador y su inyección de configuración, sin alterar respuestas
   exitosas, validación, persistencia, auditoría ni contrato DTO.
3. Extender la prueba focal: tres peticiones de origen ajeno/ausente/opaco
   devuelven 403 y no consumen el cupo; las peticiones admitidas siguen 202/429
   según la ventana. No crear una segunda lógica de allowlist.
4. Actualizar exclusivamente `openapi.test.ts`: incluir la nueva ruta en la
   lista exacta y afirmar que solo documenta `POST`. No modificar OpenAPI,
   controladores externos ni rutas históricas.
5. Ejecutar solo pruebas focales de access requests, composición y OpenAPI,
   además de typecheck focal, `npx prisma validate` y `npx prisma format --check`.
   No Docker, base, SQL, migraciones, reset, seed, Keycloak, build/suite general,
   Git, UI, `.env*`, prototipo, `tasks/`, `reviews/`, MP03 o provisión. Hard stop
   absoluto de 15 minutos; si vence, detener y reportar.

## Precedencia

MP02-C1 no se acepta aún por el defecto de orden de seguridad, test OpenAPI
fallido y hard stop incumplido. MP02-C1-C1 sustituye únicamente esos puntos.
El texto posterior es histórico y no amplía allowlist.

---

Handoff-Version: 51
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP02-C1
Status: READY

# Handoff vigente a OpenCode - SPEC 038 / MP02-C1

## Objetivo unico

Implementar `POST /api/v1/access-requests`: crea o recupera idempotentemente
una `Person` ficticia y solicitud `PENDING` en el tenant del servidor. No crea
paciente, cuenta, sesion, perfil, relacion, asignacion ni usuario OIDC.

## Allowlist exacta

- `apps/api/src/access-requests/**`
- `apps/api/src/app.module.ts`
- `apps/api/src/audit/audit.service.ts`
- `apps/api/src/generated/prisma/**` solo si `npx prisma generate` modifica el cliente
- `apps/api/test/access-requests*.test.ts`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato obligatorio

1. Leer gobernanza, SPEC 038 §§6.3, 6.4, 8-11 y 17, decision 2026-09-28,
   contrato 038, handoff v51 y los servicios de tenant, Prisma, auditoria,
   limite de inscripción y origen. Ejecutar SDD primero; detener `BLOCKED` ante
   contradiccion.
2. Crear módulo y ruta publica. El body cerrado usa solo `requestedProfile`
   (`PATIENT`, `CAREGIVER`, `FIELD_PROFESSIONAL`), `documentType`,
   `documentNumber`, `givenNames`, `familyNames`, `birthDate` ISO,
   `sexGenderCode`, `phone` y `email`. Son datos FICTICIOS; documento, nombres,
   fecha, sexo y al menos un contacto son obligatorios. Rechazar claves extra,
   vacios, fecha futura y enums invalidos. Prohibir tenant, estado, origen,
   referencia, version, revisor, decision, provisioning, password, token,
   cookie, claim OIDC, `sub`, rol, permisos y texto libre.
3. Normalizar documento como la inscripción existente y obtener tenant solo de
   `TenantContextService`. En una `withTenant` transacción, reutilizar solo
   `Person` del mismo tenant por clave documental o crearla; crear la solicitud
   con `PENDING`, `NOT_STARTED`, `TEST_DATA`, referencia opaca y version 1;
   escribir `ACCESS_REQUEST_CREATED` append-only con recurso `AccessRequest`
   sin PII. Nunca actualizar una Person existente.
4. Misma Person, tenant y perfil con solicitud abierta: responder `202` con la
   misma referencia y estado. Manejar carreras de documento/índice parcial
   releyendo solo en tenant y responder igual; nunca revelar su causa. Respuesta
   exitosa: solo `reference`, `status: PENDING` y `source: TEST_DATA`.
5. Usar comprobación de origen permitida y límite en memoria con configuración
   existente de inscripción, sin registrar IP/origen/cuerpo. Errores neutrales:
   400 body, 403 origen, 429 límite y 503 runtime; no PII, SQL, tenant, detalle
   de constraint ni existencia.
6. Pruebas focales simuladas: body estricto, perfil inválido, creación+auditoría
   atómica, replay, carrera, tenant servidor y ausencia de password/PII en
   salida/auditoría. No pruebas DB mientras SPEC 025 esté diferida.
7. Generar Prisma solo si hace falta para tipos; ejecutar pruebas focales,
   typecheck focal, `npx prisma validate` y `npx prisma format --check`. No
   migraciones, Docker, SQL, reset, seed, Keycloak, build/suite general, Git,
   UI, `.env*`, prototipo, `tasks/`, `reviews/`, MP03 ni provisión. Hard stop
   de 15 minutos y reporte prependido.

## Precedencia

MP01-C1-C2 fue aceptado estáticamente; evidencia PostgreSQL sigue pendiente.
MP02-C1 no crea acceso autenticable ni reutiliza provisión 027 hasta MP04.
Texto posterior es histórico y no amplía allowlist.

---

Handoff-Version: 50
Updated-At: 2026-09-28
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP01-C1-C2
Status: READY

# Handoff vigente a OpenCode - SPEC 038 / MP01-C1-C2

## Objetivo unico

Corregir la unica restriccion SQL que contradice la maquina de estados aprobada
y dejar el schema Prisma formateado. No crear funcionalidad nueva ni modificar
la base de datos.

## Defecto confirmado por Codex

La constraint `access_request_open_has_no_decision` de la migracion bloquea
`APPROVED_PENDING_PROVISIONING` y `PROVISIONING_FAILED` si llevan la identidad
y fecha de quien ya decidió. Eso hace imposible la transicion obligatoria
`PENDING -> APPROVED_PENDING_PROVISIONING` de SPEC 038 §6.4, porque toda
aprobacion debe atribuirse y conservarse. El indice parcial de solicitudes
abiertas es correcto y se conserva: «abierta» no significa «sin decision».

## Allowlist exacta

- `prisma/migrations/20260928190000_access_request_foundation/migration.sql`
- `prisma/schema.prisma` solo para formato Prisma, sin cambio semantico
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato obligatorio

1. Leer `AGENTS.md`, SPEC 038 §6.4, el handoff v50, la decision vigente y los
   tres archivos de allowlist. Ejecutar y reportar antes del cambio
   `bash ./spec/scripts/check-sdd-gate.sh .` y
   `bash ./spec/scripts/validate-sdd.sh . --strict`. Si existe contradiccion,
   detener `BLOCKED`.
2. En `migration.sql`, sustituir exclusivamente la constraint
   `access_request_open_has_no_decision` por una que se llame
   `access_request_pending_has_no_decision` y exija que SOLO `PENDING` no tenga
   `decidedAt`, `reviewedByInstitutionalIdentityId` ni `decisionReasonCode`.
   No prohibir esos campos para `APPROVED_PENDING_PROVISIONING` ni
   `PROVISIONING_FAILED`: conservan la decision que inició la provisión. No
   cambiar enums, campos, FKs, RLS, grants, rollback, ni el indice parcial.
3. Ejecutar `npx prisma format` sobre el schema actual. El resultado permitido
   es exclusivamente formateo de `prisma/schema.prisma`; no añadir, quitar ni
   renombrar campos, valores, relaciones, índices, comentarios de contrato o
   configuracion. Revisar y reportar que el diff es solo de formato.
4. Ejecutar, y reportar con exit code, `npx prisma validate` y
   `npx prisma format --check`. Si cualquiera falla, detener `BLOCKED` sin
   intentar instalaciones, descargas, Docker, SQL ni cambios fuera de allowlist.
5. No aplicar migraciones, no abrir Docker, no ejecutar SQL, reset, seed,
   runner, build, suite general ni pruebas DB mientras SPEC 025 este diferida.
   No modificar API, frontend, Keycloak, `.env*`, dependencias,
   `prototype-claude/`, `tasks/`, `reviews/`, migraciones historicas, Git,
   commit, push, merge, despliegue ni MP02. Registrar START, detener por hard
   stop de 15 minutos y prependar el reporte para auditoria Codex.

## Precedencia para este paquete

MP01-C1-C2 sustituye MP01-C1-C1, que queda `FAIL` por una constraint de estados
contradictoria y un formato Prisma pendiente. El texto posterior es historico y
no amplía la allowlist.

---

Handoff-Version: 49
Updated-At: 2026-09-28
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP01-C1-C1
Status: READY

# Handoff vigente a OpenCode - SPEC 038 / MP01-C1-C1

## Objetivo unico

Completar la fundacion de datos ya iniciada en MP01-C1. `prisma/schema.prisma`
ya contiene el agregado valido `AccessRequest`; crear exclusivamente la
migracion aditiva y el rollback documental condicional que lo hacen aplicable.
No cambiar el esquema ni iniciar API, interfaz, datos, decisiones o provision.

## Allowlist exacta

- `prisma/migrations/20260928190000_access_request_foundation/migration.sql`
- `prisma/migrations/ROLLBACK-access_request_foundation.sql`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

`prisma/schema.prisma` es evidencia de entrada y queda solo lectura en esta
correccion. Si la migracion no puede representar el esquema actual de forma
segura, detener `BLOCKED`; no editar el schema ni abrir otro paquete.

## Contrato obligatorio

1. Leer `AGENTS.md`, SPEC 038, decision del 2026-09-28, handoff v49,
   `prisma/schema.prisma`, la migracion institucional mas reciente y los
   rollbacks analogos. Ejecutar y reportar primero
   `bash ./spec/scripts/check-sdd-gate.sh .` y
   `bash ./spec/scripts/validate-sdd.sh . --strict`. Si existe contradiccion,
   detener `BLOCKED`.
2. Crear `20260928190000_access_request_foundation/migration.sql` que refleje
   exactamente el schema ya validado: los cuatro enums de acceso, los valores
   nuevos de `AuditEventType` e `InstitutionalRole`, tabla `access_request`,
   sus defaults, índices, unicidades y FKs restrictivas, incluidas las FKs
   compuestas `(personId, tenantId)` y `(reviewedByInstitutionalIdentityId,
   tenantId)`. No alterar ni reescribir tablas o migraciones existentes.
3. Hacer cumplir «una solicitud abierta» mediante un índice único parcial sobre
   `(tenantId, personId, requestedProfile)` para estos estados incompletos:
   `PENDING`, `APPROVED_PENDING_PROVISIONING` y `PROVISIONING_FAILED`.
   `APPROVED`, `SUSPENDED`, `REJECTED` y `REVOKED` pertenecen a historia de
   acceso ya decidida, no a una solicitud pendiente. Documentar el predicado
   literal en SQL. Mantener también la unicidad `(tenantId, reference)` y
   `(id, tenantId)`.
4. Conceder al rol `merdn_runtime` únicamente `SELECT, INSERT, UPDATE` en
   `access_request`, sin `DELETE`. Activar y forzar RLS y crear una política
   `FOR ALL TO merdn_runtime` que compare `tenantId` con
   `merdn_current_tenant()` tanto en `USING` como `WITH CHECK`. Sin contexto
   debe fallar cerrado. No dar grants sobre auditoría ni modificar sus tablas:
   este paquete solo amplía el catálogo de eventos.
5. Crear `ROLLBACK-access_request_foundation.sql` puramente documental y
   condicional. Debe abortar si existe cualquier fila de `access_request` o
   evento `audit_event` con uno de los 15 tipos añadidos; si no hay dependencia,
   revocar grants, eliminar política, RLS/FORCE, índices, FKs y tabla en orden
   seguro. No intentar eliminar valores de enums existentes: PostgreSQL no
   permite revertir `ADD VALUE` limpiamente. No ejecutar el rollback.
6. Ejecutar solo `npx prisma validate` y `npx prisma format --check` al final.
   No aplicar migraciones, no abrir Docker, no ejecutar SQL, reset, seed,
   runner, build, suite general ni pruebas DB mientras SPEC 025 este diferida.
   Reportar comandos, exit codes, archivos y resultado sin valores de entorno,
   secretos, UUIDs, SQL de datos o PII.
7. No modificar API, frontend, Keycloak, `.env*`, dependencias,
   `prototype-claude/`, `tasks/`, `reviews/`, migraciones historicas, Git,
   commit, push, merge, despliegue ni MP02. Registrar START y detener por hard
   stop a los 15 minutos; prependar el reporte para auditoria Codex.

## Precedencia para este paquete

Este MP01-C1-C1 sustituye MP01-C1 porque este ultimo quedo incompleto por hard
stop. El texto historico posterior se conserva solo como trazabilidad y no
amplia el allowlist.

---

Handoff-Version: 48
Updated-At: 2026-09-28
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP01-C1
Status: READY

# Handoff vigente a OpenCode - SPEC 038 / MP01-C1

## Objetivo unico

Crear la fundación persistente de solicitudes de acceso para el entorno funcional
de pruebas: catálogos, capacidad revisora, agregado `AccessRequest`, claves de
tenant y migración aditiva. No crear aún API, UI, decisión hospitalaria ni datos.

## Allowlist exacta

- `prisma/schema.prisma`
- `prisma/migrations/20260928190000_access_request_foundation/migration.sql`
- `prisma/migrations/ROLLBACK-access_request_foundation.sql`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Instrucciones MP01-C1 que prevalecen

1. Leer la spec 038, su decisión del 2026-09-28, `AGENTS.md`, la migración más
   reciente y el modelo Prisma antes de editar. Ejecutar y reportar
   `check-sdd-gate.sh .` y `validate-sdd.sh . --strict` antes del cambio. Si hay una
   contradicción de spec o decisión, detener `BLOCKED`.
2. Añadir únicamente los catálogos ya decididos: perfiles `PATIENT`, `CAREGIVER`,
   `FIELD_PROFESSIONAL`; estados `PENDING`, `APPROVED_PENDING_PROVISIONING`,
   `APPROVED`, `REJECTED`, `PROVISIONING_FAILED`, `SUSPENDED`, `REVOKED`; estado
   técnico separado con `NOT_STARTED`, `PENDING`, `SUCCEEDED`, `FAILED`; y fuente
   `TEST_DATA`. Añadir `HOSPITAL_ACCESS_REVIEWER` como rol institucional disjunto y
   los eventos de auditoría obligatorios de la spec 038 que no contengan PII.
3. Añadir `AccessRequest` como agregado separado y persistente: UUID opaco, tenant,
   `Person` ficticia del mismo tenant requerida por OD-02, perfil, estado, estado de
   provisión, fuente, referencia opaca, versión, fechas del servidor y campos
   opcionales de revisión/provisión. Usar relaciones y FKs compuestas que impidan
   asociar `Person` o revisor de otro tenant. No guardar password, token, cookie,
   claim OIDC, nombre, documento, correo, teléfono, motivo libre ni datos clínicos.
4. Crear una migración aditiva y rollback documental condicional. La migración debe
   añadir RLS/FORCE RLS, política de tenant y grants mínimos consistentes con las
   migraciones existentes; no editar historial. El rollback se detiene si existen
   solicitudes o auditoría dependiente. El catálogo de razones de decisión y las
   transiciones se implementan en MP03, cuando exista comportamiento hospitalario;
   no inventar valores en este paquete.
5. Ejecutar solo `npx prisma validate` y `npx prisma format --check`. No aplicar
   migraciones, no abrir Docker, no ejecutar SQL, reset, seed, runner, build, suite
   general ni pruebas DB mientras SPEC 025 esté diferida. Reportar archivos, exit
   codes y resultado de validación sin valores de entorno ni secretos.
6. No modificar API, frontend, Keycloak, `.env*`, `prototype-claude/`, `tasks/`,
   `reviews/`, migraciones históricas, dependencias, Git, commit, push, merge,
   despliegue ni MP02. Registrar START y detener por hard stop a los 15 minutos.

## Precedencia para este paquete

Las instrucciones MP01-C1 y la decisión de producto del 2026-09-28 sustituyen
cualquier instrucción histórica de SPEC 025 que aparezca más abajo en este archivo.
El texto restante se conserva solo como trazabilidad y no amplía el allowlist.

## Contexto historico de correcciones MP13

1. Agregar una entrada CLI segura que lea solo `process.argv.slice(2)`, use el
parser cerrado, cargue el env-file solo cuando sea obligatorio, ejecute el plan
y emita evidencia sanitizada. `npm run test:baseline -- --stage ...` debe
invocar esa entrada, sin recursion ni dependencia nueva.
2. Implementar el ejecutor real con `spawn` o `execFile`, argv fijo, `shell:
false`, cwd fijo, timeout finito y captura sanitizada. Cablear provision a MP07
y preflight MP08, y cleanup a MP09. Ninguna llamada real se autoriza en este
paquete; las pruebas deben inyectar simulacros.
3. `provision` exige env-file pero genera internamente un run-id valido si no se
provee. `all` exige env-file y genera run-id si falta. Todo stage posterior a
provision, incluido typecheck cuando se ejecuta como etapa de baseline, exige
env-file y run-id. Rechazar run-id aportado en formato inseguro; conservar el
mismo run-id en toda evidencia.
4. `classifyStageOutcome` debe fallar solo ante skip/todo/disabled con conteo
positivo o marcador inequívoco. Salidas que indican `0 skipped`, `0 todo` o
`0 disabled` no pueden producir falso FAIL. Mantener fail-closed para formato
ausente, timeout, no tests found y matriz incompleta.
5. Conservar matriz exacta, 22 DB-gated, cleanup final, ausencia de shell/glob,
un intento, timeouts, allowlist y evidencia sin secretos. Corregir el formato de
`package.json` si fuese necesario, sin cambiar otros scripts.

## Correcciones MP13-C2 que prevalecen

1. El ejecutor de procesos no puede heredar `process.env`. Construir, despues de
cargar y validar el env-file, un entorno infantil minimo: solo las variables del
sistema necesarias para localizar y crear procesos en Windows y estas variables
de prueba derivadas exclusivamente del env-file validado:
`DATABASE_URL=TEST_DATABASE_ADMIN_URL`,
`RUNTIME_DATABASE_URL=TEST_DATABASE_RUNTIME_URL` y
`MERDN_RUNTIME_ROLE=enforce`. No pasar las claves crudas `TEST_DATABASE_*`,
`NODE_OPTIONS`, ni ningun valor heredado del proceso padre; la unica credencial
administrativa permitida al hijo queda contenida en ese `DATABASE_URL` derivado.
Los secretos de ambas URL y de contrasenas cargadas deben entregarse al
saneamiento de captura. Probar con un `spawn` simulado que un marcador sensible
del padre no llega al hijo y que las dos URL que recibe son las aisladas.
2. Toda excepcion de provision, preflight o ejecutor debe producir evidencia
sanitizada con el stage fallido, ejecutar mediante el adaptador MP09 una sola
limpieza y devolver `ok: false`; no puede escapar directo a `main` sin limpieza.
No debe quedar una limpieza duplicada entre el runner y el provisionador: ajustar
el cableado o demostrar con simulacros que se invoca una sola vez en cada fallo.
No imprimir errores, URL, SQL, tenant ni secretos.
3. Corregir `classifyStageOutcome` para reconocer como sanos los seis ceros:
`0 skipped`, `skipped 0`, `0 todo`, `todo 0`, `0 disabled`, `disabled 0`.
Cualquier conteo positivo en cualquiera de los dos ordenes, marcador sin conteo,
timeout, falta de resumen, `no tests found` o salida incompleta debe continuar
fallando cerrado.
4. Corregir el formato de `package.json`: `test:baseline` debe quedar como una
entrada JSON independiente y conservar exactamente los demas scripts. No agregar
dependencias ni modificar archivos fuera del allowlist.
5. Conservar la matriz exacta, sus 22 etapas DB-gated, cleanup final, argv fijo,
`shell: false`, un intento, timeouts, parser, run-id y evidencia minimizada.

## Correcciones MP13-C3 que prevalecen

1. Si la etapa final `cleanup` recibe `cleaned: false`, el resultado global debe
ser `ok: false`, `failedStage: "cleanup"` y evidencia con outcome `fail`. No
puede retornar exito ni ejecutar una segunda limpieza. Probarlo con un cleaner
simulado que devuelve `{ cleaned: false }` y verificar que se invoco una sola vez.
2. Reducir `SYSTEM_ENV_ALLOWLIST` al minimo necesario para lanzar los argv
absolutos actuales en Windows: `SystemRoot`/`SYSTEMROOT`, `COMSPEC`, `PATHEXT`,
`PATH`/`Path`, `TEMP` y `TMP`, usando una sola representacion por variable en el
hijo. Retirar `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `ProgramData`,
`SystemDrive`, datos de procesador y cualquier otra variable no necesaria. No se
permite heredar configuracion de usuario o de herramientas.
3. Mantener las garantias MP13-C2: solo las tres variables de prueba derivadas,
sin `NODE_OPTIONS` ni claves `TEST_DATABASE_*` crudas, secretos saneados, seis
ceros correctos, una limpieza ante fallo y sin dependencias nuevas.

## Validacion y limites

- Leer gobernanza/spec/decision/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- Registrar START y respetar hard stop de 10 minutos. Prependar reporte y
  detenerse para auditoria.
- MP16-MP42 y SPEC 038 permanecen cerrados.

---

Handoff-Version: 33
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP13
Status: READY

# Handoff vigente a OpenCode - SPEC 025 / MP13

## Objetivo unico

Crear el runner fail-closed de baseline y un unico script npm para invocarlo.
El paquete construye contratos y pruebas manuales puras; no ejecuta el runner,
Docker, PostgreSQL, Prisma, migraciones ni suites.

## Allowlist exacta

- `scripts/testing/run-baseline.mjs`
- `package.json` solo el nuevo script de baseline
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato obligatorio

1. Modulo ESM sin dependencias nuevas que reutilice guard MP02, provisioner
MP07, preflight MP08 y cleanup MP09. Exponer parser y plan puros, y una funcion
principal reutilizable. Importar no abre procesos ni registra senales.
2. Exigir `--env-file` explicito, `--stage` exacto y `--run-id` valido para todo
stage posterior a provision. Rechazar flags desconocidos, duplicados, valores
vacios, rutas implícitas, run-id con caracteres peligrosos, stage no permitido,
demo/staging/prod y cualquier comando no incluido en la matriz. Nunca imprimir
URLs, claves, UUIDs de tenant, filas ni SQL.
3. Congelar una matriz cerrada: provision+preflight; typecheck; API no DB/health;
web; OpenAPI; y los 22 archivos DB-gated exactos de SPEC 025 sec. 9, cada uno
como stage individual. Definir cleanup como stage final. No autorizar suites
generales, glob, rutas de usuario, `npm test`, Docker generico ni comandos shell.
4. Ejecutar comandos solo mediante argv fijo y sin shell cuando el runner sea
invocado posteriormente. Cada stage debe tener timeout finito, un intento,
codigo inequívoco y deteccion fail-closed de skip, todo, disabled, timeout o
matriz incompleta. Ante fallo de un stage operativo, invocar una sola limpieza
segura mediante MP09 y devolver evidencia sanitizada; en exito no limpiar hasta
el stage final. No ejecutar estas rutas en MP13.
5. Mantener run-id consistente en evidencia minimizada: commit disponible,
stage, resultado, duracion y conteos; no secretos ni datos. El runner no debe
persistir estado de dominio ni crear archivos versionados. El siguiente paquete
definira las pruebas permanentes.
6. Agregar solo un script npm descriptivo, por ejemplo `test:baseline`, que
invoque el runner y requiera pasar sus argumentos despues de `--`. No cambiar
scripts existentes ni dependencias.

## Validacion y limites

- Leer gobernanza/spec/decision/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo `node --check`, importacion Node, pruebas puras temporales sin
  procesos y lint focal. No ejecutar runner, Docker, PostgreSQL, Prisma,
  migraciones, pruebas DB, suites generales ni Git.
- Prependar reporte con matriz, parser negativo, cero ejecucion y el diff exacto.
  Detenerse para auditoria Codex.
- MP14-MP42 y SPEC 038 permanecen cerrados.

---

Handoff-Version: 32
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP12
Status: READY

# Handoff vigente a OpenCode - SPEC 025 / MP12

## Objetivo unico

Corregir solo la gobernanza stale de `branding.test.tsx` para que las pruebas
legitimas de Hospital que usan los nombres desde `branding` no se declaren como
duplicacion de marca. No modificar componentes ni branding productivo.

## Allowlist exacta

- `apps/web/src/config/branding.test.tsx`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Cambio permitido

1. Inspeccionar la prueba y los imports de branding usados por
`hospitalShell.test.tsx`. Si el escaneo de literales necesita exceptuar esa
prueba, agregar exclusivamente su ruta a la allowlist de pruebas permitidas,
con comentario que explique que obtiene el nombre de la fuente central
`branding`. No exceptuar archivos productivos ni ampliar excepciones por
comodidad.
2. Corregir solo expectativas o gobernanza de la prueba. Si la ruta exacta y
el comentario ya estan presentes y la prueba focal pasa, no reescribir ni
ampliar el diff: reportar no-op.
3. Ejecutar solo la prueba focal de branding web y lint focal. No ejecutar
Docker, PostgreSQL, Prisma, migraciones, pruebas DB, suite web completa ni Git.
Si falla por una causa fuera de allowlist, detenerse y reportar FAIL/BLOCKED.

## Validacion y limites

- Leer gobernanza/spec/decision/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- No tocar frontend productivo, Compose, env, packages, migraciones, schema,
  API, `prototype-claude`, `tasks` ni `reviews`.
- Prependar reporte con diff exacto, resultado focal, lint y confirmacion de no
  ejecucion de infraestructura. Detenerse para auditoria Codex.
- MP13-MP42 y SPEC 038 permanecen cerrados.

---

Handoff-Version: 31
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP11
Status: READY

# Handoff vigente a OpenCode - SPEC 025 / MP11

## Objetivo unico

Corregir solo las expectativas stale del cuarto rol institucional
`CAREGIVER_RELATIONSHIP_MANAGER` en la prueba unitaria existente.

## Allowlist exacta

- `apps/api/src/institutional-auth/institutional-auth.unit.test.ts`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Cambio permitido

1. Inspeccionar `INSTITUTIONAL_ROLES` y la configuracion ya implementada. En las
   listas y expectativas que todavia enumeren tres roles, incluir exactamente
   `CAREGIVER_RELATIONSHIP_MANAGER` en el orden real del contrato, sin cambiar
   codigo productivo ni comportamiento.
2. Ajustar solo expectativas/nombres/listas de la prueba que quedaron stale por
   el cuarto rol. No agregar roles, credenciales, codigos, flujos ni pruebas de
   producto. Si las expectativas ya estan corregidas en el arbol, no reescribir
   equivalentes ni ampliar el diff: ejecutar la validacion y reportar no-op.
3. Ejecutar solo la prueba focal de Vitest para este archivo y lint focal. No
   ejecutar Docker, PostgreSQL, Prisma, migraciones, pruebas DB, suites generales
   ni Git. Si el test focal necesita una correccion fuera del allowlist, detenerse
   y reportar FAIL/BLOCKED.

## Validacion y limites

- Leer gobernanza/spec/decision/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- No tocar migraciones, schema, Compose, env, packages, frontend, producto,
  `prototype-claude`, `tasks` ni `reviews`.
- Prependar reporte con diff exacto, prueba focal, lint y confirmacion de no
  ejecucion de infraestructura. Detenerse para auditoria Codex.
- MP12-MP42 y SPEC 038 permanecen cerrados.

---

Handoff-Version: 30
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP10
Status: READY

# Handoff vigente a OpenCode - SPEC 025 / MP10

## Objetivo unico

Crear pruebas permanentes y puras de los contratos de lifecycle de baseline.
No ejecutar Docker, PostgreSQL, Prisma, migraciones ni cleanup real.

## Allowlist exacta

- `tests/testing/test-db-lifecycle.test.mts`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Cobertura obligatoria

1. Importar los modulos MP02, MP07, MP08 y MP09 sin abrir procesos. Ejecutar
   solo exports puros con fixtures sinteticos y no secretos.
2. Probar el guard y provisioner: identidad valida, rechazo de env-file ausente
   antes de argv, `composeArgs` fijo, inventario de red/volumen ambiguo bloqueado
   y sanitizacion de URL/clave.
3. Probar preflight: baseline 27/26 valida, catalogo sin puerto interno,
   transaccion conductual con un `BEGIN` y un `ROLLBACK`, tres IDs de persona
   distintos, y evaluadores que rechazan una policy/flag/conducta alterada.
4. Probar cleanup: argv exacto de `down --volumes --remove-orphans`, postcheck
   detecta residuales y no adopta recurso ajeno, adapters intentan cleanup una
   vez, y las etapas env-file/guard/identity/down/postcheck se preservan y
   sanitizan. No invocar `cleanupIsolatedTestDatabase` con env valido ni
   `runRuntimeRlsPreflight`; no llamar runCommand ni Docker.
5. Las pruebas deben ser deterministas, sin archivos temporales, red, procesos,
   variables de entorno globales, esperas ni señales reales. No tocar scripts de
   produccion, Compose, env, migraciones, schema, packages, producto o pruebas
   existentes.

## Validacion y limites

- Leer gobernanza/spec/decision/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo `node --test tests/testing/test-db-lifecycle.test.mts`,
  sintaxis/importacion Node y lint focal. No ejecutar Docker, PostgreSQL,
  Prisma, migraciones, pruebas DB, suites generales ni Git.
- Prependar el reporte con conteo pass/fail, lista de invariantes y confirmacion
  de no ejecucion. Detenerse para auditoria Codex.
- MP11-MP42 y SPEC 038 permanecen cerrados.

---

Handoff-Version: 29
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP09-C2
Status: READY

# Handoff vigente a OpenCode - SPEC 025 / MP09-C2

## Objetivo unico

Unificar el manejo seguro de errores de env-file y guard en el cleanup. No
modificar la semantica de limpieza ni ejecutar infraestructura.

## Allowlist exacta

- `scripts/testing/test-db-cleanup.mjs`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Correccion obligatoria

1. Mantener la validacion de ruta explicita antes de cualquier proceso. Incluir
   `loadEnvFile` y `assertTestEnvironment` en un manejo que convierta sus fallos
   a `CleanupError` sanitizado. Un fallo de carga debe resultar en etapa
   `env-file`; un fallo del guard en etapa `guard`.
2. Mantener estrictamente el orden env-file -> guard -> identidad -> down ->
   postcheck y que no se abra ningun proceso antes de superar guard. Para errores
   `ProvisionError`, seguir priorizando su `stage`, despues `step`; para un error
   sin etapa, usar la etapa actual de la operacion, no `unknown` cuando se sabe
   que ocurrio en env-file o guard.
3. Cubrir con pruebas puras: env-file sintetico que falla se mapea a
   `CleanupError/env-file`, guard sintetico que falla se mapea a
   `CleanupError/guard`, y las etapas identity/down/postcheck preservan su
   prioridad. No requerir ni abrir procesos.
4. No modificar argv, limites, identidad, down, postcheck, adaptador de
   senales, contratos importados, Compose, env, migraciones, schema, packages,
   producto ni pruebas existentes.

## Validacion y limites

- Leer gobernanza/spec/decision/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo `node --check`, importacion Node, pruebas puras sin procesos y
  lint focal. No ejecutar Docker, PostgreSQL, Prisma, migraciones, pruebas DB,
  suites generales ni Git.
- Prependar reporte con pruebas de cinco etapas, confirmacion de no ejecucion y
  detenerse para auditoria Codex.
- MP10-MP42 y SPEC 038 permanecen cerrados.

---

Handoff-Version: 28
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP09-C1
Status: READY

# Handoff vigente a OpenCode - SPEC 025 / MP09-C1

## Objetivo unico

Conservar la etapa segura de un `ProvisionError` en el cleanup. No modificar la
logica de limpieza, identidad, postcheck ni senales.

## Allowlist exacta

- `scripts/testing/test-db-cleanup.mjs`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Correccion obligatoria

1. En el `catch` de `cleanupIsolatedTestDatabase`, elegir la etapa en este orden:
   `error.stage`, despues `error.step`, y finalmente `unknown`. Entregar esa
   etapa a `toSafeCleanupError`, sin exponer el mensaje crudo ni secretos.
2. Exportar o usar un helper puro comprobable sin procesos para demostrar que
   `new ProvisionError('identity', ...)`, `down` y `postcheck` se convierten en
   `CleanupError` con la misma etapa, y que un Error comun queda como `unknown`.
3. No modificar argv, limites, guard, identidad, down, postcheck, adaptador de
   senales, imports de contratos, Compose, env, migraciones, schema, packages,
   producto ni pruebas existentes.

## Validacion y limites

- Leer gobernanza/spec/decision/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo `node --check`, importacion Node, pruebas puras sin procesos y
  lint focal. No ejecutar Docker, PostgreSQL, Prisma, migraciones, pruebas DB,
  suites generales ni Git.
- Prependar reporte con la prueba de las cuatro etapas, confirmacion de no
  ejecucion y detenerse para auditoria Codex.
- MP10-MP42 y SPEC 038 permanecen cerrados.

---

Handoff-Version: 27
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP09
Status: READY

# Handoff vigente a OpenCode - SPEC 025 / MP09

## Objetivo unico

Crear el cleanup fail-closed de la baseline aislada. El paquete crea el
artefacto y pruebas puras; no ejecuta Docker, PostgreSQL ni una limpieza real.

## Allowlist exacta

- `scripts/testing/test-db-cleanup.mjs`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato obligatorio

1. Modulo ESM sin dependencias nuevas. Reutilizar guard MP02 y exportaciones de
   MP07 (`loadEnvFile`, `assertProjectIdentity`, `composeArgs`, `runCommand`,
   identidad, nombres aprobados, labels y errores); no duplicar topologia,
   nombres, labels ni comandos base. Toda funcion operativa exige env-file
   explicito y pasa guard antes de abrir proceso.
2. Exponer una funcion principal reutilizable para cleanup y helpers puros para
   construir/verificar comandos y postcheck. Importar el modulo no registra
   handlers, no abre procesos y no limpia nada. Un adaptador de `finally` y de
   senales puede registrarse solo cuando el runner lo invoque explicitamente.
3. Antes de cualquier `down`, exigir `assertProjectIdentity`. Si el inventario
   de contenedor, red o volumen es ambiguo, falta label, nombre o driver, fallar
   cerrado sin borrar. La unica limpieza permitida es `docker compose` con
   project, archivo y env-file explicitos, `down --volumes --remove-orphans`.
   Sin prune, glob, `down -v` generico, `rm`, `docker system`, ni targets fuera
   del proyecto aprobado.
4. Despues del down, comprobar ausencia de contenedores del proyecto y ausencia
   de la red y volumen exactos aprobados. La comprobacion debe identificar un
   recurso residual como FAIL sin intentar un segundo borrado. Los recursos de
   otros proyectos se ignoran y nunca se adoptan. Devolver solo evidencia
   minimizada: booleano de limpieza y conteos, nunca URLs, secretos, IDs o filas.
5. Los errores y stderr deben pasar por sanitizacion. Usar argv fijo, sin shell,
   interpolacion de entrada ni credenciales en argv; timeout finito y ningun
   reintento automatico. Si se pide cancelacion o hay senal, intentar cleanup
   una unica vez solo despues de que el guard e identidad hayan pasado y reportar
   resultado seguro.
6. No modificar provisioner, preflight, guard, Compose, env, migraciones,
   schema, packages, producto ni pruebas existentes. No crear archivos de test
   permanentes en este paquete.

## Validacion y limites

- Leer gobernanza/spec/decision/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo `node --check`, importacion Node, pruebas puras sin procesos y
  lint focal. No ejecutar Docker, PostgreSQL, Prisma, migraciones, pruebas DB,
  suites generales ni Git.
- Las pruebas puras deben cubrir: guard previo a comandos, identidad requerida
  antes de down, argv de cleanup fijo, recursos residuales detectados y recursos
  ajenos ignorados. Prependar reporte y detenerse para auditoria Codex.
- MP10-MP42 y SPEC 038 permanecen cerrados.

---

Handoff-Version: 26
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP08-C1
Status: READY

# Handoff vigente a OpenCode - SPEC 025 / MP08-C1

## Objetivo unico

Corregir dos fallos que impedirian ejecutar el preflight MP08 y remover un
caracter CJK accidental. No redisenar el preflight ni ejecutar infraestructura.

## Allowlist exacta

- `scripts/testing/test-db-preflight.mjs`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Correcciones obligatorias

1. Agregar un identificador efimero sintetico exclusivo para el INSERT
   cross-tenant. Debe ser distinto de los IDs de personas A y B ya insertadas.
   La sonda debe seguir esperando `insufficient_privilege` de RLS, nunca una
   colision de primary key.
2. No comparar `inet_server_port()` con el puerto host `55432`: `runSql` se
   ejecuta dentro del contenedor, por socket local o por el puerto interno.
   Importar y llamar `assertLoopbackPublication` del provisionador despues del
   guard y antes de catalogo para comprobar la publicacion externa efectiva.
   El catalogo debe comprobar solo base, administrador y version; ajustar su
   SQL, parser, evaluador y pruebas puras para no exigir un puerto interno.
3. Eliminar todos los caracteres CJK del archivo, incluido el comentario de
   secretos. No modificar mensajes, conducta, constantes, listas, timeout,
   rollback ni contratos ajenos a los dos defectos.

## Validacion y limites

- Leer gobernanza/spec/decision/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo `node --check`, importacion Node, pruebas puras sin procesos y
  lint focal. No ejecutar Docker, PostgreSQL, Prisma, migraciones, pruebas DB,
  suites generales ni Git.
- La prueba pura debe demostrar que los tres IDs de persona son distintos, que
  el SQL no usa `inet_server_port`, y que el catalogo conforme sin campo de
  puerto supera su evaluacion. Prependar reporte y detenerse para auditoria.
- MP09-MP42 y SPEC 038 permanecen cerrados.

---

Handoff-Version: 25
Updated-At: 2026-09-26
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP08
Status: READY

# Handoff vigente a OpenCode - SPEC 025 / MP08

## Objetivo unico

Crear el preflight fail-closed de runtime/RLS para la baseline aislada. El
paquete crea el artefacto y sus pruebas puras; no inicia Docker ni PostgreSQL,
no aplica migraciones y no ejecuta el preflight contra una base.

## Allowlist exacta

- `scripts/testing/test-db-preflight.mjs`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato obligatorio

1. Modulo ESM sin dependencias nuevas. Reutilizar el guard MP02 y los
   contratos/exportaciones de `test-db-provision.mjs`; no duplicar las listas
   de 14 migraciones, 26 tablas, 27 policies, roles, tenant ni topologia.
   Toda invocacion debe requerir un env-file explicito y pasar el guard antes de
   abrir un proceso o conexion.
2. Exponer una funcion principal reutilizable por el runner posterior. Debe
   devolver evidencia minimizada (conteos y booleanos); nunca URLs, passwords,
   UUIDs, filas, SQL, objetos de entorno ni datos de fixtures. Errores tambien
   deben estar sanitizados y tener etapa identificable.
3. Implementar preflight de catalogo, de solo lectura salvo la prueba
   transaccional descrita abajo: servidor/base/rol runtime esperados; runtime y
   owner sin superuser, bypass, createdb, createrole ni replication; runtime no
   owner, owner de las 26 tablas; sin CREATE para runtime en `public`; 26
   tablas con RLS+FORCE; 27 policies exactas; y exactamente un tenant ficticio
   `merdn-mvp` al inicio y al final.
4. Implementar la prueba conductual dentro de una unica transaccion que siempre
   termine en `ROLLBACK`, incluso ante error. Puede crear dos tenants y filas
   estrictamente ficticios, efimeros y no reportables dentro de esa transaccion
   para probar bajo `SET LOCAL ROLE merdn_runtime` y contexto transaccional:
   sin contexto no hay acceso; tenant A ve solo A; B es invisible; INSERT y
   UPDATE hacia B fallan o afectan cero filas conforme a la policy. Debe probar
   tambien que `merdn_test_migrator`, sujeto a FORCE y sin contexto/policy, no
   elude RLS. No usar superuser/BYPASSRLS como evidencia de comportamiento
   runtime; el administrador puede preparar los fixtures dentro de la misma
   transaccion antes de cambiar de rol.
5. No dejar fixtures, roles, grants, datos ni cambios de catalogo. Si no puede
   demostrar rollback, identidad, conteos o conducta, debe fallar cerrado.
   Usar timeout finito, sin shell, sin interpolacion de entradas y sin secretos
   en argv/logs. No llamar `docker` fuera de la funcion ejecutable; las pruebas
   puras no deben abrir procesos.
6. Exportar constructores/validadores puros suficientes para comprobar la forma
   de la consulta y el parseo de evidencia sin Docker. Mantener las pruebas
   futuras compatibles con el runner MP13. No modificar provisioner, guard,
   compose, env, migraciones, schema, packages, producto o pruebas existentes.

## Validacion y limites

- Leer gobernanza/spec/decision/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo `node --check`, importacion Node, pruebas puras sin procesos y
  lint focal. No ejecutar Docker, PostgreSQL, Prisma, migraciones, pruebas DB,
  suites generales ni Git.
- Prependar el reporte con archivos modificados, evidencia de pruebas puras,
  limitaciones y confirmacion de no ejecucion. Detenerse para auditoria Codex.
- MP09-MP42 y SPEC 038 permanecen cerrados.

---

Handoff-Version: 24
Updated-At: 2026-09-26
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Required-Base: develop
Required-Work-Branch: feat/038-demo-funcional-accesos-ficticios
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP07-C1
Status: READY

# Handoff vigente a OpenCode — SPEC 025 / MP07-C1

## Objetivo único

Cerrar la comprobación de identidad previa a borrado para redes y volúmenes.
No ejecutar la provisión ni cambiar su contrato de migraciones/roles.

## Allowlist exacta

- `scripts/testing/test-db-provision.mjs`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Corrección obligatoria

1. `assertProjectIdentity` debe inventariar contenedores, redes y volúmenes que
   tengan el label `com.merdn.project=merdn-baseline-test`, y también los
   recursos que coincidan exactamente con los nombres aprobados aunque carezcan
   de ese label.
2. Antes de cada `down --volumes --remove-orphans`, exigir para cada recurso
   existente: nombre exacto/familia aprobada, los tres labels aprobados y driver
   `bridge` para red o `local` para volumen. Recurso ambiguo, sin label, con
   label incompleto o driver distinto debe producir STOP sin borrar.
3. La verificación debe usar procesos sin shell, argv fijo y salidas
   sanitizadas. Debe cubrir tanto `preClean` como `cleanupAfterFailure`, que
   reutilizan `assertProjectIdentity`.
4. Mantener intactos guard, 14 migraciones, 26 tablas, roles, ownership,
   límites, comandos de provisión y allowlist original. Corregir en el reporte
   cualquier afirmación previa que dijera que solo contenedores bastaban.

## Validación y límites

- Leer gobernanza/spec/decisión/handoff, registrar START y respetar hard stop
  absoluto de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo sintaxis/importación Node, pruebas puras que no llamen Docker y
  lint focal. No ejecutar Docker, PostgreSQL, Prisma, migraciones, pruebas DB,
  suites generales o Git.
- No modificar Compose, env, guard, migraciones, schema, pruebas, packages,
  producto, dependencias ni archivos fuera del allowlist. Prependar reporte y
  detenerse para auditoría Codex. MP08 y spec 038 permanecen cerrados.

---

# Handoff vigente a OpenCode — SPEC 025 / MP07

## Objetivo único

Crear el provisionador fail-closed de PostgreSQL aislado. Este paquete crea el
script; no levanta contenedores ni aplica migraciones.

## Decisión Product Owner aplicable

`spec/bitacora/decisiones/2026-09-26-baseline-aislada-migraciones-y-owner-test.md`
autoriza las 14 migraciones actuales y el owner no privilegiado
`merdn_test_migrator` para las 26 tablas protegidas.

## Allowlist exacta

- `scripts/testing/test-db-provision.mjs`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato de provisión

1. Módulo ESM sin dependencias nuevas, reutilizable por el runner posterior.
   Debe importar el guard de MP02 y fallar antes de Docker o PostgreSQL si no
   recibe entorno y topología exactos. No imprimir objetos de entorno, URLs,
   claves, UUIDs ni datos de tablas.
2. Aceptar una ruta explícita de archivo de entorno local para Compose; no usar
   `.env` implícito. Construir procesos solo con `spawn`/`execFile` y argv
   estático, sin shell, interpolación ni comandos destructivos genéricos.
3. Antes de `up`, verificar que cualquier recurso con los nombres/labels del
   proyecto sea exactamente el cluster `merdn-baseline-test`; hacer pre-clean
   solo mediante Compose con proyecto, archivo y env-file explícitos. Si no se
   puede probar identidad/labels, detenerse sin borrar.
4. Levantar únicamente `postgres-test`, esperar healthcheck con timeout finito y
   verificar en servidor base `merdn_test`, host/puerto loopback y PostgreSQL.
5. Aplicar `prisma migrate deploy` una sola vez con URL administrativa en un
   child process con entorno mínimo, sin registrar credenciales. Exigir la lista
   exacta de estas 14 migraciones en `_prisma_migrations`:
   `20260821120000_core_01_init`, `20260821120100_core_01_reference_data`,
   `20260822120000_core_01_hardening`, `20260822130000_municipality_core_01`,
   `20260822140000_hospital_core_01`, `20260822160000_hospital_core_02`,
   `20260823120000_identity_relationships_core_01`,
   `20260824120000_visits_core_01`, `20260824180000_visits_core_02`,
   `20260824200000_visits_core_03`, `20260825120000_eloisa_admin_access_01_mp01`,
   `20260826120000_patient_self_audit_event_type`,
   `20260830160000_force_rls_core_institutional_hospital` y
   `20260919051156_add_audit_events_human_account_linked_enrollment_revoked`.
6. Mediante conexión administrativa exclusivamente dentro de test: habilitar
   password efímero para `merdn_runtime`; crear si falta `merdn_test_migrator`
   como NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS y
   NOREPLICATION; transferir solo las 26 tablas protegidas a ese owner. Usar
   nombres constantes y parámetros seguros; no cambiar policies, grants,
   schema, datos, migraciones ni roles fuera de esos dos roles aprobados.
7. Comprobar antes de devolver éxito: exactamente un tenant ficticio
   `merdn-mvp`; runtime y owner con flags seguros; runtime no owner; las 26
   tablas con owner `merdn_test_migrator`, RLS+FORCE y las 27 policies. Devolver
   solo resumen sanitizado con run-id, conteos y nombres no sensibles.
8. Ante cualquier fallo después de crear recursos, hacer cleanup únicamente del
   proyecto/labels aprobados y reportar error sanitizado; sin reintento
   automático. Diseñar límites y señales para que MP09/MP13 puedan reutilizarlos.

## Validación y límites

- Leer gobernanza, spec 025, decisión 2026-09-26 y este handoff; registrar START
  y respetar hard stop de 15 minutos. Al vencer, detenerse y reportar `BLOCKED`.
- Validar solo sintaxis/importación Node y lint focal. No ejecutar Docker,
  PostgreSQL, Prisma, migraciones, pruebas DB, suites generales o Git.
- No modificar Compose, env, guard, migraciones, schema, pruebas, packages,
  producto, dependencias ni archivos fuera del allowlist. Prependar reporte y
  detenerse para auditoría Codex. MP08 y spec 038 permanecen cerrados.

---

# Pausa anterior — decisión operativa requerida antes de SPEC 025 / MP07

La pausa se resolvió con la decisión Product Owner del 2026-09-26 registrada en
`spec/bitacora/decisiones/2026-09-26-baseline-aislada-migraciones-y-owner-test.md`.
No había paquete OpenCode activo mientras esa decisión estuvo pendiente.

---

# Handoff vigente a OpenCode — SPEC 025 / MP06

## Objetivo único

Crear el runbook operativo de remediación FORCE RLS. Es documentación: no
autoriza ejecutar comandos sobre Docker, PostgreSQL ni otro entorno.

## Allowlist exacta

- `docs/runbooks/FORCE_RLS_REMEDIATION.md`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contenido obligatorio

1. Propósito, alcance, autoridades, riesgos y precondiciones: migración forward
   MP04, ventana controlada, rol migrator/owner separado del runtime, runtime
   `merdn_runtime` sin privilegios de bypass, identidad confirmada y evidencia
   sanitizada. No presentar la guía como certificación regulatoria.
2. Preflight detallado: identidad de base/entorno, migraciones previas, 26
   tablas/27 policies, owners y flags de runtime/owner, locks/sesiones y la
   decisión STOP ante ambigüedad, timeout o contención.
3. Aplicación segura: usar la migración versionada una sola vez, transacción y
   timeouts de MP04; nunca SQL manual equivalente, retry automático, bypass,
   `disabled`, superuser para runtime ni edición de historia.
4. Postflight: verificar las 26 tablas con ENABLE+FORCE, 27 policies, owners
   sin superuser/BYPASSRLS, runtime sin privilegios inseguros, evidencia sin PII
   ni secretos y pruebas conductuales posteriores en entorno aislado.
5. Fallo/remediación: antes de commit revierte la transacción; después, solo
   migración forward aprobada. Incluir ruta de emergencia `NO FORCE` como
   excepción con aprobación explícita del Product Owner, tabla exacta, ventana,
   evidencia de aislamiento alternativo y registro de regresión; nunca un down
   improvisado.
6. Checklist de cierre y de auditoría. Debe cubrir lock conflict, owner bypass,
   migración parcial, ejecución contra entorno equivocado y cleanup test.

## Validación y límites

- Leer gobernanza/spec/handoff, registrar START y respetar hard stop de 15
  minutos; al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo comprobaciones estáticas de Markdown y `git diff --check`.
  No ejecutar Docker, PostgreSQL, Prisma, migraciones, pruebas, suites o Git.
- No modificar código, migraciones, Compose, env, guard, packages, producto,
  dependencias ni archivos fuera del allowlist. Prependar reporte y detenerse
  para auditoría Codex. MP07 y spec 038 permanecen cerrados.

---

# Handoff vigente a OpenCode — SPEC 025 / MP05-C1

## Objetivo único

Completar exclusivamente la aserción de catálogo que evita el bypass del dueño
de tabla. No ampliar cobertura, ejecutar DB ni modificar el test CORE-01.

## Allowlist exacta

- `apps/api/test/force-rls-catalog.db.test.ts`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Corrección obligatoria

1. Para las 26 tablas exactas ya congeladas, consultar su owner en `pg_roles`
   junto con `rolsuper` y `rolbypassrls`. Exigir por cada owner
   `rolsuper=false` y `rolbypassrls=false`, además de mantener que el runtime
   no es owner y que `relrowsecurity`/`relforcerowsecurity` son `true`.
2. La aserción debe fallar con mensajes por tabla/owner y no asumir que FORCE
   restringe a superusuarios o roles `BYPASSRLS`. FORCE solo evita el bypass
   implícito del propietario no privilegiado.
3. Mantener sin cambios los conjuntos de 26 tablas/27 policies, el patrón
   DB-gated, las consultas de solo lectura y la modificación previa de
   `core-01-hardening.db.test.ts`.
4. El reporte nuevo debe reconocer que las once tablas históricas sí tienen
   FORCE, con evidencia de sus migraciones; no reescribir el reporte MP05
   histórico.

## Validación y límites

- Leer gobernanza/spec/handoff, registrar START y respetar hard stop absoluto
  de 15 minutos; al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo typecheck focal de API y lint del archivo permitido. No ejecutar
  Docker, PostgreSQL, Prisma, migraciones, pruebas DB, suites generales o Git.
- No modificar migración, Compose, env, guard, packages, producto, dependencias
  ni archivos fuera del allowlist. Prependar reporte y detenerse para auditoría.
- MP06 y toda la spec 038 permanecen cerrados.

---

# Handoff vigente a OpenCode — SPEC 025 / MP05

## Objetivo único

Crear las aserciones DB-gated del catálogo FORCE RLS. Este paquete escribe
pruebas; no provisiona ni ejecuta PostgreSQL.

## Allowlist exacta

- `apps/api/test/force-rls-catalog.db.test.ts`
- `apps/api/test/core-01-hardening.db.test.ts` solo aserciones RLS/FORCE
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato de pruebas

1. La prueba nueva debe usar el patrón DB-gated ya existente (`database-availability`),
   Prisma real y consultas al catálogo PostgreSQL. No crear roles, tablas, datos,
   fixtures ni alterar estado de base.
2. Fijar conjuntos exactos y comprobar en `public` las 26 tablas protegidas:
   las 15 de MP04 más `human_account`, `external_auth_identity`,
   `human_session`, `human_auth_attempt`, `patient_caregiver_relationship`,
   `patient_caregiver_relationship_scope`, `home_visit`,
   `home_visit_transition`, `platform_support_capability`, `support_grant` y
   `support_context_session`. Cada una debe tener `relrowsecurity=true` y
   `relforcerowsecurity=true`, sin filas extra o ausentes.
3. Comprobar los 27 pares policy/tablas exactos congelados por spec 025, incluido
   `audit_event_tenant_read` y `audit_event_tenant_append`, sin extras ni
   ausencias en esas 26 tablas, y que las policies previstas aplican al runtime.
4. Comprobar `merdn_runtime`: existe, no es superusuario, no tiene BYPASSRLS,
   CREATEDB, CREATEROLE ni REPLICATION, no posee ninguna de las 26 tablas y no
   tiene CREATE en `public`. Las aserciones deben demostrar catalogadamente que
   el owner queda sujeto a RLS mediante FORCE; no suponer que una conexión admin
   superuser puede demostrarlo conductualmente.
5. En `core-01-hardening.db.test.ts`, sustituir solo la aserción de las nueve
   tablas para exigir también FORCE en esas mismas nueve. No cambiar fixtures,
   helpers, comportamiento ni otros tests.

## Validación y límites

- Leer gobernanza, spec 025, MP04-C1 y este handoff; registrar START y respetar
  hard stop absoluto de 15 minutos. Al vencer, detenerse y reportar `BLOCKED`.
- Ejecutar solo typecheck focal de API y lint focal de los archivos tocados. La
  ejecución DB real queda para MP21, después de provisionar el entorno aislado.
- No ejecutar Docker, PostgreSQL, Prisma migrate/db push, pruebas DB, suites
  generales ni Git. No modificar migración, Compose, env, guard, packages,
  producto, dependencias o archivos fuera del allowlist.
- Prependar el reporte MP05 en `FROM-CLAUDE.md` sin reescribir historia y
  detenerse para auditoría Codex. MP06 y toda la spec 038 permanecen cerrados.

---

# Handoff vigente a OpenCode — SPEC 025 / MP04-C1

## Objetivo único

Corregir exclusivamente los dos defectos de compilación SQL encontrados por
Codex en la migración MP04. No se amplía ni ejecuta su comportamiento.

## Allowlist exacta

- `prisma/migrations/20260830160000_force_rls_core_institutional_hospital/migration.sql`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Correcciones obligatorias

1. En el bloque que calcula `v_bad` para atributos de `merdn_runtime`, las cinco
   ramas de `UNION ALL` deben usar SQL válido en orden `SELECT ... FROM
   pg_roles WHERE rolname = 'merdn_runtime' AND <atributo>`. El actual orden
   `SELECT ... WHERE <atributo> FROM` no compila.
2. Reemplazar la referencia no declarada `r.rolsuper` por un booleano declarado
   y cargado junto con el OID de `current_user`, por ejemplo
   `v_current_is_superuser`; el preflight debe seguir exigiendo que un ejecutor
   no-superuser sea dueño de las quince tablas.
3. Mantener sin cambios el conjunto exacto de 15 tablas, 16 policies, timeouts,
   transacción, preflight/postflight, ausencia de DML/schema/policies/grants y
   todos los límites de MP04.

## Validación y límites

- Antes de escribir, leer gobernanza, spec 025, MP04 previo y este handoff;
  registrar START. Hard stop absoluto: 15 minutos; al vencer, detenerse y
  reportar `BLOCKED`, aunque falte evidencia.
- Validar solo estructura estática focal y `git diff --check`. No ejecutar
  Prisma, Docker, PostgreSQL, migraciones, pruebas DB o suites generales.
- No modificar Compose, env, guard, pruebas, packages, producto, dependencias,
  `.gitignore` ni archivos fuera del allowlist. No hacer acciones Git.
- Prependar el reporte MP04-C1 en `FROM-CLAUDE.md`, sin reescribir los reportes
  históricos, y detenerse para auditoría Codex. MP05 y spec 038 siguen cerrados.

---

# Handoff vigente a OpenCode — SPEC 025 / MP04

## Objetivo único

Crear exclusivamente la migración forward que fuerza RLS en el núcleo
institucional/hospitalario ya existente. Este paquete prepara SQL: no lo aplica.

## Inicio y tiempo

1. Leer `AGENTS.md`, `CLAUDE.md`, spec 025 completa, este handoff y las
   migraciones que introdujeron las tablas/policies afectadas.
2. Registrar START después de leer el paquete. Hard stop máximo: 15 minutos.
3. Confirmar rama/HEAD y preservar todo el árbol sucio; no hacer acciones Git.
4. Ejecutar las compuertas SDD antes de escribir.

## Allowlist exacta

- `prisma/migrations/20260830160000_force_rls_core_institutional_hospital/migration.sql`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato de la migración

1. Usar una transacción explícita con `lock_timeout` y `statement_timeout`
   locales, preflight fail-closed y postflight verificable.
2. El preflight debe comprobar existencia en `public`, RLS ya habilitado,
   policies esperadas, rol runtime seguro/no bypass, propietario distinto del
   runtime y ausencia de locks o sesiones incompatibles para estas tablas. Ante
   cualquier desviación debe abortar antes de todo `ALTER TABLE`.
3. Aplicar `FORCE ROW LEVEL SECURITY` exactamente una vez a estas 15 tablas:
   `tenant`, `territorial_unit`, `person`, `patient`,
   `patient_population_membership`, `patient_address`, `consent_record`,
   `enrollment_session`, `audit_event`, `institutional_identity`,
   `institutional_session`, `professional_profile`,
   `professional_affiliation`, `care_assignment` y `appointment`.
4. El preflight debe exigir estas policies actuales: `tenant_self`,
   `territorial_unit_scope`, `person_tenant`, `patient_tenant`,
   `patient_population_membership_tenant`, `patient_address_tenant`,
   `consent_record_tenant`, `enrollment_session_tenant`,
   `audit_event_tenant_read`, `audit_event_tenant_append`,
   `institutional_identity_tenant`, `institutional_session_tenant`,
   `professional_profile_tenant`, `professional_affiliation_tenant`,
   `care_assignment_tenant` y `appointment_tenant`, asociadas a sus tablas.
5. El postflight debe demostrar que las 15 tablas conservan RLS y tienen FORCE
   activo. Los errores no deben incluir secretos ni datos de aplicación.
6. No incluir DML, cambios de esquema, policies, grants, roles, datos,
   fixtures, schema Prisma ni migraciones históricas. No crear rollback en este
   paquete.

## Validación y límites

- Validar solo sintaxis/estructura estática focal de la migración. No ejecutar
  Prisma, Docker, PostgreSQL, migraciones, pruebas DB ni suites generales.
- No modificar Compose, env, guard, pruebas, packages, producto, dependencias,
  `.gitignore` ni archivos fuera de allowlist.
- Actualizar `FROM-CLAUDE.md` con archivos, SQL de control aplicado,
  validaciones, resultado, estado Git fiel y confirmación de no ejecución.
- Detenerse para auditoría Codex. MP05 y toda la spec 038 permanecen cerrados.

---

# Handoff vigente a OpenCode — SPEC 025 / MP03

## Objetivo único

Crear pruebas repetibles, puras y sin Docker para el guard anti-entorno.

## Allowlist exacta

- `tests/testing/test-environment-guard.test.mts`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Cobertura mínima requerida

1. Caso de ejecución válido con topología exacta y credenciales ficticias no
   placeholder: `validateTestEnvironment` devuelve `[]` y
   `assertTestEnvironment` devuelve solo el resumen seguro.
2. La plantilla `.env.test.example` pasa solo con `allowPlaceholders: true` y
   topología exacta; falla en modo de ejecución por placeholders.
3. Topología omitida, `null`, arreglo, campos faltantes/incorrectos y
   `containerPort` distinto de 5432 fallan cerrado.
4. URLs con protocolo, host, puerto, base, schema, parámetros, fragmento,
   usuario o clave incorrectos fallan sin incluir el valor recibido en el error.
5. Usuario/clave de cada URL distintos de sus variables fallan; admin/runtime
   iguales también fallan.
6. Credenciales vacías/cortas, rol distinto de `enforce`, marcadores prohibidos
   y placeholders en modo de ejecución fallan.
7. Porcentaje/codificación inválida produce errores y nunca una excepción.
8. Los mensajes de `assertTestEnvironment` no contienen URLs, usuarios ni claves
   ficticias usadas por las pruebas.

## Ejecución y límites

- Usar `node:test` y `node:assert/strict`, sin dependencias nuevas.
- Ejecutar solo `node --test tests/testing/test-environment-guard.test.mts` y
  ESLint focal. No ejecutar suites generales.
- No modificar guard, Compose, env, Git ignore, package, producto, migraciones,
  dependencias ni archivos fuera del allowlist.
- No usar Docker, red, base, migraciones ni Git. Hard stop 15 minutos.
- Actualizar `FROM-CLAUDE.md` y detenerse para auditoría Codex.

---

# Handoff anterior — SPEC 025 / MP02-C1

# Handoff vigente a OpenCode — SPEC 025 / MP02-C1

## Objetivo único

Corregir el guard anti-entorno para que la identidad Compose y las credenciales
de ambas URLs queden vinculadas y fallen cerrado.

## Allowlist exacta

- `scripts/testing/test-environment-guard.mjs`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Correcciones requeridas

1. La topología debe ser obligatoria en modo de ejecución. Omitirla, pasar
   `null` o un objeto incompleto debe producir errores. Debe validar también
   `containerPort=5432` además de los campos ya definidos.
2. La URL administrativa debe contener exactamente el usuario de
   `POSTGRES_USER`; la URL runtime, el de `MERDN_RUNTIME_DB_USER`.
3. La clave decodificada de cada URL debe coincidir exactamente con su variable
   correspondiente. Los mensajes de error solo nombran el campo/regla.
4. Mantener admin/runtime distintos y todas las restricciones previas.
5. Capturar de forma segura cualquier error al decodificar pathname, username o
   password. `validateTestDatabaseUrl` debe devolver errores sanitizados y no
   lanzar ante porcentajes inválidos u otra codificación defectuosa.
6. Mantener `allowPlaceholders: true` exclusivamente para inspección de
   plantilla, sin relajar identidad, topología ni correspondencia entre URL y
   variables.
7. Ejecutar únicamente `node --check`, importación y ESLint focal. Los casos de
   comportamiento siguen reservados para MP03.

## Inicio, límites y salida

- Leer gobernanza/spec/handoff, registrar START y respetar hard stop de 15 min.
- No modificar tests, Compose, env, Git ignore, package, producto, migraciones o
  dependencias; no ejecutar Docker, DB, suites ni acciones Git.
- Actualizar `FROM-CLAUDE.md` con diff, comandos, resultados y límites; detenerse
  para auditoría Codex.

---

# Handoff anterior — SPEC 025 / MP02

# Handoff vigente a OpenCode — SPEC 025 / MP02

## Objetivo único

Crear el guard estructural fail-closed que valida la identidad del entorno de
pruebas antes de cualquier comando Docker o acceso a PostgreSQL.

## Inicio y tiempo

1. Leer `AGENTS.md`, `CLAUDE.md`, spec 025 completa, `compose.test.yml`,
   `.env.test.example` y este handoff.
2. Registrar START después de leer el paquete. Hard stop máximo: 15 minutos.
3. Confirmar rama/HEAD, preservar el árbol sucio y ejecutar las compuertas SDD.

## Allowlist exacta

- `scripts/testing/test-environment-guard.mjs`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Contrato requerido

1. Implementar un módulo ESM sin dependencias nuevas, reutilizable por los
   scripts posteriores y con funciones exportadas comprobables en MP03.
2. Definir la identidad esperada: proyecto `merdn-baseline-test`, servicio
   `postgres-test`, base `merdn_test`, host `127.0.0.1`, puerto `55432`, red
   `merdn-baseline-test-net`, volumen `merdn-baseline-test-pgdata` y los tres
   labels exactos aprobados.
3. Validar mediante `URL` ambas direcciones PostgreSQL. Solo admitir protocolo
   `postgresql:`, base exacta `/merdn_test`, host loopback, puerto `55432` y
   `schema=public` sin parámetros inesperados.
4. Exigir admin `merdn_test_admin`, runtime `merdn_runtime`, identidades y URLs
   distintas, claves no vacías y distintas, y `MERDN_RUNTIME_ROLE=enforce`.
5. Rechazar marcadores `reemplazar-por-` cuando el guard se use para ejecutar
   infraestructura. La plantilla puede existir, pero no es una credencial de
   ejecución.
6. Rechazar case-insensitive `merdn_dev`, `demo`, `staging`, `prod` o
   `production` en proyecto, servicio, host, base, usuarios, red y volumen.
7. Los errores deben identificar el campo/regla sin imprimir URLs, usuarios
   completos, claves ni otros secretos. No registrar el objeto de entorno.
8. El módulo no debe ejecutar Docker, procesos, red, filesystem destructivo ni
   modificar `process.env`.
9. Ejecutar solo comprobación sintáctica/importación de Node. Las pruebas de
   casos positivos y negativos pertenecen a MP03.

## Prohibiciones

- No modificar Compose, `.env.test.example`, `.gitignore`, package scripts,
  código productivo, migraciones, esquema o dependencias.
- No ejecutar Docker, migraciones, bases ni suites existentes.
- No hacer acciones Git ni iniciar MP03 o paquetes de 038.

## Salida

Actualizar `FROM-CLAUDE.md` con duración, archivo creado, contrato exportado,
comando sintáctico/importación y resultado, estado Git fiel y confirmación de
límites. Detenerse para auditoría Codex.

---

# Handoff anterior — SPEC 025 / MP01-C2

# Handoff vigente a OpenCode — SPEC 025 / MP01-C2

## Objetivo único

Crear la topología declarativa de PostgreSQL de pruebas aislada aprobada en la
spec 025. Este paquete no levanta contenedores, no ejecuta migraciones y no abre
MP01 de la spec 038.

## Inicio y tiempo

1. Leer `AGENTS.md`, `CLAUDE.md`, la spec/plan/tasks/research/history de 025 y
   este handoff.
2. Registrar START después de leer este paquete. Hard stop máximo: 15 minutos.
3. Confirmar la rama actual y preservar todo el árbol sucio. No hacer acciones
   Git.
4. Ejecutar las compuertas SDD antes de escribir.

## Allowlist exacta

- `compose.test.yml`
- `.env.test.example`
- `spec/bitacora/handoffs/FROM-CLAUDE.md` solo para el reporte

## Requisitos

1. Proyecto Compose exacto `merdn-baseline-test`.
2. Servicio exacto `postgres-test`, imagen `postgres:17.6-alpine`, restart `no`.
3. Base exacta `merdn_test`; puerto host `127.0.0.1:55432` hacia `5432`.
4. Red y volumen exclusivos con nombres `merdn-baseline-test-net` y
   `merdn-baseline-test-pgdata`.
5. Labels en servicio, red y volumen:
   `com.merdn.project=merdn-baseline-test`, `com.merdn.scope=test` y
   `com.merdn.disposable=true`.
6. Healthcheck con `pg_isready`, data checksums y credenciales tomadas de
   `.env.test.example`.
7. `.env.test.example` solo contiene valores ficticios/placeholder. Debe definir
   identidades distintas para admin `merdn_test_admin` y runtime
   `merdn_runtime`, URLs distintas y `MERDN_RUNTIME_ROLE=enforce`.
8. Ninguna referencia a `merdn_dev`, demo, staging, prod o production.
9. Validar únicamente con:
   `docker compose -f compose.test.yml --env-file .env.test.example config`.
   Sanitizar cualquier valor de contraseña en el reporte.
10. Confirmar que no existe ningún recurso Docker con los nombres o labels del
    proyecto antes y después de la validación declarativa.

## Prohibiciones

- No ejecutar `up`, `down`, `start`, `stop`, `rm`, `prune`, migraciones ni
  suites.
- No modificar `.gitignore`, `package.json`, código, migraciones, esquema,
  Compose local/staging, `.env`, secretos, datos ni archivos fuera del allowlist.
- No hacer `git add`, commit, merge, rebase, push, PR, release o deploy.
- No iniciar MP02 ni ningún paquete de la spec 038.

## Salida

Actualizar `FROM-CLAUDE.md` con START/fin/duración, archivos creados, validación
exit 0, salida sanitizada, comprobación de recursos Docker en cero, estado de
tracking de `.env.test.example`, estado Git fiel y confirmación de hard stop.
Detenerse para auditoría Codex.

---

# Handoff anterior — SPEC 038 / MP00-C2

# Handoff vigente a OpenCode — SPEC 038 / MP00-C2

## Objetivo

Cerrar la línea base MP00. Las correcciones funcionales de C1 quedan aceptadas
provisionalmente; MP01 continúa cerrado hasta obtener línea base verde y
evidencia PostgreSQL real.

## Trabajo autorizado

1. Corregir los dos errores de tipo en
   `apps/api/test/application-composition.test.ts`: `moduleRef` debe representar
   el `TestingModule` compilado y poder cerrarse en `afterEach`.
2. Corregir los seis `noUnusedLocals` en
   `apps/api/test/identity-relationships-db.test.ts`. Eliminar imports y
   variables realmente innecesarios o reutilizar una sola identidad ficticia.
   No debilitar aserciones, aislamiento por tenant ni pruebas de grants.
3. Ejecutar build y typecheck web/API, suites web/API, compuerta SDD y
   validación estricta.
4. Levantar solo PostgreSQL local con credenciales ficticias no versionadas,
   esperar el healthcheck, aplicar migraciones y ejecutar las pruebas DB. Una
   suite omitida no cuenta como evidencia.
5. Actualizar `tasks.md` solo si T00.10 queda totalmente demostrada y reemplazar
   `FROM-CLAUDE.md` con resultados fieles.

## Límites MP00-C2

- Archivos de código permitidos: únicamente los dos archivos de prueba API
  indicados arriba.
- Se permiten documentos de la spec 038 y `FROM-CLAUDE.md` para evidencia.
- No iniciar MP01 ni modificar código productivo, migraciones, esquema Prisma,
  dependencias, `prototype-claude/**`, `tasks/**`, `reviews/**` o `main`.
- No hacer commit, merge, rebase, cherry-pick, push, PR, release ni deploy.
- No eliminar volúmenes, datos ni ejecutar rollbacks.

Registrar la evidencia y detenerse para auditoría Codex.

---

# Handoff anterior — SPEC 038 / MP00-C1

# Handoff a Claude Code / OpenCode — SPEC 038 MP00-C1

## Corrección autorizada

La auditoría Codex de MP00 terminó en `FAIL — CHANGES REQUIRED`. El Product
Owner autorizó los once commits demo existentes y la transición a la rama
`feat/038-demo-funcional-accesos-ficticios`; Codex creó la rama en el mismo HEAD
`530a722` sin perder los cambios locales. Se autoriza únicamente MP00-C1.

Hallazgos y correcciones: `spec/bitacora/handoffs/CODEX-REVIEW.md`.

La autorización explícita y el consentimiento SDD de la spec 038 sustituyen la
pausa antigua de este archivo únicamente para este alcance. Ninguna otra spec o
paquete queda reanudado por inferencia.

## Objetivo autorizado

Corregir exclusivamente los hallazgos de MP00 dentro de:

- `spec/specs/038-demo-funcional-accesos-ficticios/spec.md`
- `spec/specs/038-demo-funcional-accesos-ficticios/plan.md`
- `spec/specs/038-demo-funcional-accesos-ficticios/tasks.md`
- `spec/specs/038-demo-funcional-accesos-ficticios/research.md`
- `spec/specs/038-demo-funcional-accesos-ficticios/contracts/README.md`

## Inicio obligatorio

1. Leer `AGENTS.md`, `CLAUDE.md`, los documentos autoritativos de `docs/` y la
   spec 038 completa.
2. Ejecutar y reportar:
   - `./spec/scripts/check-sdd-gate.sh .`
   - `./spec/scripts/validate-sdd.sh . --strict`
3. Confirmar rama exacta `feat/038-demo-funcional-accesos-ficticios`, HEAD
   `530a722`, merge-base `develop` en `ad7a18c` y once commits por delante.
4. Preservar los cambios locales existentes. No cambiar de rama, limpiar,
   ocultar, revertir ni sobrescribir trabajo ajeno.
5. Preservar todo cambio ajeno y `prototype-claude/**`.

## Trabajo MP00-C1

1. Registrar T00.2 con la rama, HEAD, merge-base y once commits autorizados ya
   verificados; no ejecutar más acciones Git.
2. Corregir `spec/specs/INDEX.md` para que 027 refleje `Draft / Borrador`, sin
   consentimiento y con implementación parcial no aceptada. No aprobar código
   de 027 retroactivamente.
3. Conectar `/acceso` a una única composición aprobada que interprete
   `destino` y `accion`, incluya exploración demo señalizada y no conceda sesión
   ni permisos. Eliminar la afirmación falsa de que ya monta ambos componentes.
4. Mantener `/municipality` sin sesión inyectada. Cambiar `/hospital` para que
   la ruta normal resuelva sesión del servidor y el modo demo solo se habilite
   mediante configuración explícita server-side, cerrada por defecto. Ningún
   parámetro de URL puede activar el bypass.
5. Restaurar la prueba de branding: escanear archivos de prueba y usar una
   excepción cerrada mínima o retirar el literal duplicado. No excluir todas
   las pruebas.
6. Restaurar la frontera de red. Quitar falsos positivos de comentarios antes
   de evaluar, mantener separados los puntos reales de inyección y probar
   `hospitalDemoLocal.ts` como adaptador en memoria que nunca delega a red.
7. Retirar el reloj live no autorizado de Dashboard o alimentarlo desde un
   valor determinista aprobado. La frontera de la spec 010 debe volver a un solo
   `new Date()` sin argumentos en el default inyectable de Agenda.
8. Sustituir los conteos globales de botones/SVG por comprobaciones semánticas
   de navegación y controles móviles. Corregir Administración a ocho pestañas y
   comprobar explícitamente `Solicitudes de acceso`.
9. Registrar T00.9 como auditoría aplicable: poner el flujo de provisión 027 en
   cuarentena documental, prohibir su reutilización y ubicar la provisión nueva
   en MP04. No intentar rediseñar identidad dentro de MP00-C1.
10. Actualizar las cinco expectativas API obsoletas para
    `CAREGIVER_RELATIONSHIP_MANAGER` y `keycloakPatient`, sin relajar el
    fail-closed ni requerir una base activa para pruebas unitarias.
11. Actualizar `tasks.md` solo para tareas realmente demostradas y reemplazar
    `FROM-CLAUDE.md` con evidencia fiel al working tree.
12. Ejecutar build, typecheck, web, API y SDD. Si las pruebas DB requeridas para
    abrir MP01 no pueden ejecutarse, declararlo como bloqueo de MP01; no afirmar
    que no existen bloqueos técnicos.

## Límites

- Ejecutar solo MP00-C1. No iniciar MP01.
- Respetar el allowlist y las prohibiciones de la sección 15 de `spec.md`.
- No tocar `prototype-claude/**`, `tasks/**`, `reviews/**`, migraciones
  existentes, `.env`, secretos, datos reales ni `main`.
- No crear dependencias, migraciones ni modelos de `AccessRequest` en MP00.
- No hacer commit, merge, rebase, cherry-pick, push, PR, release ni deploy.
- No marcar como funcional algo que solo tenga estado de frontend.

## Evidencia de salida

Actualizar `spec/bitacora/handoffs/FROM-CLAUDE.md` con:

1. rama y HEAD observados;
2. archivos modificados;
3. tabla de los ocho fallos observados: causa, decisión y prueba final;
4. mapeo T00.2–T00.10 a evidencia;
5. comandos y resultados completos de build, typecheck, web y SDD;
6. cambios en rutas protegidas y `/acceso`;
7. disposición de cuarentena de provisión 027 y ubicación en MP04;
8. riesgos, tareas no completadas y bloqueos;
9. resultados de la suite API y estado comprobado de la evidencia DB;
10. confirmación de que MP01 no inició y que no hubo acciones Git prohibidas.

Detenerse después del reporte para auditoría de Codex.
