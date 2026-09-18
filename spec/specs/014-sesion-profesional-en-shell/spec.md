# Especificación 014 - Acceso institucional y sesión profesional en el shell

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specifications: `tasks/H-FID-A.md` y
`tasks/HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI.md`. Congeladas.

**No existe auditoría registrada.** Comprobado con `ls reviews/` y con
`grep -rl "H-FID-A\|HUMAN-PROFESSIONAL-SESSION\|MP-TODAY" reviews/`: el
directorio contiene REVIEW-001, REVIEW-002, REVIEW-003H-01 a 07, las de Alcaldía,
marca, orquestador y MVP CORE, y ninguna de esta capacidad. La ausencia es un
dato del expediente, no un olvido de esta spec.

**Dos identificadores de tarea sin archivo.** El código y las pruebas citan
`MP-TODAY-01` (guards de sesión y de origen en la API) y `MP-TODAY-02` (acceso
institucional operable en el shell) —`institutional-auth.module.ts:28`,
`HospitalShell.tsx:108`, `hospital-institutional-auth.api.test.ts:350`,
`hospitalInstitutionClient.test.ts:168`—, pero `ls tasks/` no devuelve ningún
archivo con esos nombres. El commit fundacional de esta capacidad (`231f6b6`)
no tiene, por tanto, Task Specification archivada. Las dos que sí existen
—`H-FID-A` y `HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI`— corrigen y amplían lo que
`231f6b6` construyó.

Dos avisos de lectura, porque los archivos de hoy no son solo los de esta spec:

- `HospitalTopbar.tsx`, `HospitalSidebar.tsx` y `hospital.module.css` fueron
  modificados después por `fc9aa26` (2026-08-24, spec 015), que retiró la campana
  y su conteo demostrativo y compactó la zona de perfil. Esta spec documenta el
  perfil institucional y las acciones de sesión que ese commit conservó, no la
  fidelidad visual que introdujo;
- `HospitalHomeVisits.tsx` pertenece originalmente a la spec 013. Esta spec
  documenta únicamente la sección de **sesión personal profesional** que
  `86505c1` le añadió.

## Objetivo

Que el acceso institucional deje de ser una pantalla aparte y viva dentro de la
geometría del shell Hospital —comprobando, sin sesión y autenticado—, y que la
persona profesional pueda abrir, comprobar y cerrar su sesión **personal** desde
la misma interfaz, sin que ninguna de las dos identidades se confunda con la
otra ni sustituya a la otra.

## Historia de usuario principal

Como persona que trabaja en la institución, quiero entrar al shell Hospital con
la credencial institucional del despliegue y, cuando una visita exija la
actuación de la persona profesional asignada, poder abrir y cerrar mi sesión
personal sin salir de la pantalla, para que quede claro qué actos hace la
institución y cuáles hago yo.

## Qué hace hoy el sistema

### Identidad INSTITUCIONAL — servidor

| Capacidad | Dónde | Detalle medido |
|---|---|---|
| `POST /api/v1/institutional/sessions` | `institutional-auth.controller.ts:82` | Abre sesión. Guards: `InstitutionalSignInRateLimitGuard`, `InstitutionalSameOriginGuard`. Devuelve solo `role` y `expiresAt`; el token viaja en cookie |
| `GET /api/v1/institutional/sessions/current` | `institutional-auth.controller.ts:149` | Sin guard de rol: valida en línea con el mismo servicio y admite **cualquier** rol implementado. Devuelve `role`, `expiresAt`, `institution.name` y `actorDisplay` |
| `DELETE /api/v1/institutional/sessions/current` | `institutional-auth.controller.ts:214` | Guards: `InstitutionalSameOriginGuard` + `InstitutionalSessionGuard`. Revoca sin exigir rol y borra la cookie; la fila se conserva |
| Cookie de sesión | `institutional-session.cookie.ts:44-66` | `merdn_institutional_session`; `HttpOnly`, `Path=/`, `SameSite` y `Domain` de la topología, `Secure` fuera de desarrollo, `Max-Age` acotado. Contiene **solo** el token opaco |
| Guard de sesión sin rol | `institutional-session.guard.ts:52-101` | Autentica, no autoriza. `401` uniforme; nunca `403`. Publica el principal en la petición |
| Guard de origen | `institutional-same-origin.guard.ts:60-98` | `Origin`, y `Referer` reducido a origen como respaldo. Denegación por defecto: sin ninguna de las dos, `403` |
| Límite de intentos | `institutional-signin-rate-limit.guard.ts:27-38` | 10 intentos por 300 s, clave = IP remota, ventana fija **en memoria del proceso** |
| Derivación de la credencial | `institutional-secret.ts:8-99` | `scrypt` con `N=16384, r=8, p=1` (16 MiB), sal de 16 B y derivación de 64 B, comparación en tiempo constante. La cabecera explica por qué **no** SHA-256: el token de sesión tiene 256 bits de entropía uniforme y SHA-256 basta, pero la credencial institucional la elige una persona y `scrypt` encarece el ataque por diccionario |
| Señuelo de tiempo constante | `institutional-auth.service.ts:88-98,197-203` | Un código inexistente sigue derivando contra `SENUELO_HASH`/`SENUELO_SALT` para que «código desconocido» y «credencial incorrecta» cuesten lo mismo |
| Auditoría institucional | `institutional-audit.service.ts:96-141` | `INSTITUTIONAL_SESSION_CREATED` e `INSTITUTIONAL_SESSION_REVOKED`, con actor OPACO, rol efectivo, endpoint y `correlationId`, escritos **dentro** de la transacción |

### Identidad HUMANA — servidor

| Capacidad | Dónde | Detalle medido |
|---|---|---|
| `GET /api/v1/me/contexts` | `me-contexts.controller.ts:53-102` | Guard `HumanSessionGuard`. Devuelve solo `contexts`, derivados en el servidor. **Ningún cliente web lo consume hoy** |
| `GET /api/v1/human-auth/session` | `human-auth.controller.ts:174` | Es el endpoint que sí usa el shell. Devuelve `expiresAt`, `idleExpiresInSeconds` y `contexts` |
| `GET /api/v1/human-auth/login` / `callback` | `human-auth.controller.ts:85,112` | Flujo OIDC Authorization Code + PKCE. `@ApiExcludeEndpoint()`: no figuran en OpenAPI |
| `POST /api/v1/human-auth/logout` | `human-auth.controller.ts:233` | Guards: límite de intentos, `SameOriginGuard` y `HumanSessionGuard` |
| Destino de retorno | `human-auth.contract.ts:78` | `HUMAN_AUTH_RETURN_TARGETS = ['/']`. Allowlist literal, no una forma |

### Shell Hospital — navegador

| Capacidad | Dónde | Detalle medido |
|---|---|---|
| Tres estados observables | `HospitalShell.tsx:641,656,669` | `consultando` (marco neutral + `role="status"`), `sin-sesion` (marco neutral + formulario) y autenticado (sidebar, topbar y módulo) |
| Marco neutral | `HospitalShell.tsx:330-349`, `HospitalSidebar.tsx:227-264` | Sidebar con marca y menú **inerte** (`<li>` con `data-hospital-nav="bloqueado"`), `<main>` **sin** `data-hospital-content`, sin topbar, buscador, perfil, badges ni conteos |
| Formulario de acceso | `HospitalShell.tsx:233-320` | Dos campos con `<label>` asociada, `autocomplete="off"`, `type="password"`, `maxLength=512`, botón con estado ocupado y región viva `role="alert"` permanente. La credencial se borra del estado en el mismo gesto del envío |
| Apertura confirmada por `current` | `HospitalShell.tsx:532-572` | La identidad mostrada procede **siempre** del contexto; el cuerpo de la apertura no se propaga |
| Cierre fail-closed | `HospitalShell.tsx:587-627`, `hospitalInstitutionClient.ts:427-468` | Solo `204` o `401` retiran la sesión. Cualquier otro desenlace reconfirma contra `current` y, si sigue viva, la conserva y bloquea el cambio de credencial |
| Perfil institucional | `HospitalTopbar.tsx:62-81` | Actor impersonal, etiqueta del rol y caducidad **solo** para lectores de pantalla (`merdn-sr-only`). Avatar sin iniciales de persona |
| Acciones de la propia sesión | `HospitalTopbar.tsx:96-126` | `Cambiar sesión` y `Cerrar sesión` como botones reales, deshabilitados mientras se opera |
| Cliente institucional | `hospitalInstitutionClient.ts` | `consultarSesionInstitucional`, `abrirSesionInstitucional`, `cerrarSesionInstitucional`, `validarAcceso`, `resolverCierre`, `resolverReconfirmacion`. Nunca lanza; devuelve desenlaces tipados |

### Sesión profesional humana — navegador

| Capacidad | Dónde | Detalle medido |
|---|---|---|
| Cliente humano mínimo | `hospitalHumanSessionClient.ts:54-58,135,182,239,278` | Tres rutas y ninguna más. Cinco desenlaces de consulta, seis de cierre. `credentials: 'include'`, `cache: 'no-store'`, sin cabecera de identidad |
| Inicio OIDC como navegación | `HospitalHomeVisits.tsx:385-399` | `<a href>` a la URL absoluta del login, `target="_blank"`, `rel="noopener noreferrer"`, con ayuda accesible. **No** es un `fetch` |
| Comprobar sesión | `HospitalHomeVisits.tsx:582-618` | Solo `activa-profesional` incrementa el refresco que vuelve a leer la visita. Un contexto humano sin `PROFESSIONAL` no habilita nada |
| Cerrar sesión profesional | `HospitalHomeVisits.tsx:624-670` | Solo un cierre confirmado (`cierreHumanoConfirmado`) retira la sesión de la pantalla. No toca la sesión institucional |
| Separación de identidades | `hospitalOperaciones.test.tsx:502-509` | La prueba exige que el archivo **no** contenga `hospitalInstitutionClient`, `cerrarSesionInstitucional` ni `institutional` |
| Frontera de red acotada | `hospitalAlcance.test.ts:57-63,197-235` | Exactamente **seis** clientes autorizados llaman a la red en todo el módulo Hospital; `hospitalHumanSessionClient.ts` es el sexto |

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | Monorepo, Next.js, NestJS, Prisma, validación tipada de entorno | Sin `resolvePublicApiBaseUrl()` ni `API_WEB_ORIGINS` validados no hay cliente ni guard de origen |
| 003-experiencia-visual-hospital | Shell, sidebar, topbar, `hospital.module.css` y la navegación local | Esta spec envuelve esa geometría; el marco neutral la reproduce sin datos |
| 006-marca-eloisa-isa | Marca de plataforma y corazón canónico | El marco neutral y el sidebar sin sesión los usan como única identidad visible |
| 007-inscripcion-paciente-persistente | `Tenant`, `TenantContextService`, `withTenant()`, RLS, `AuditEvent` y `readCookie` | La sesión institucional se valida dentro del contexto seguro y se audita con ese modelo |
| 008-agregados-municipales-protegidos | `InstitutionalIdentity`, `InstitutionalSession`, cookie, `scrypt`, límite de intentos y el controlador base | Esta spec **no** crea el sistema de sesión institucional: le añade el guard sin rol, el guard de origen y la interfaz |
| 009-hospital-pacientes-api | Rol `HOSPITAL_PATIENT_VIEWER` y `GET current` con contexto (`institution.name`, `actorDisplay`) | Es el contrato que la topbar rotula |
| 010-hospital-profesionales-agenda-api | Rol `HOSPITAL_SCHEDULER`, fail-closed sin código y sin credencial | La topbar lo rotula como «Agenda hospitalaria» sin prometer Pacientes |
| 011-identidad-humana-y-relaciones | OIDC + PKCE, cookie `merdn_human_session`, `GET /human-auth/session`, `POST /logout`, `GET /me/contexts` y el contexto `PROFESSIONAL` | Los controles profesionales consumen ese contrato y ninguno propio |
| 012-visitas-domiciliarias | `GET /api/v1/professional/visits/{visitId}` y sus transiciones | El `ok` de esa consulta —y solo él— habilita acciones; la sesión humana no |
| 013-visitas-visibles-en-hospital | La vista `HospitalHomeVisits` y su cliente | Es el único lugar donde hoy se monta el panel de sesión profesional |

**Dependencias externas:**

- **PostgreSQL** con las migraciones aplicadas. Sin base de datos migrada,
  `hospital-institutional-auth.api.test.ts` se salta entero
  (`describe.skipIf(!puedeEjecutarse)`, líneas 102 y 371).
- **Proveedor OIDC** alcanzable —en local, Keycloak levantado con
  `docker compose --profile oidc-local up -d oidc-local`—. Sin
  `MERDN_HUMAN_AUTH_ISSUER`, `_CLIENT_ID`, `_CALLBACK_URI` y `_ATTEMPT_KEY`, la
  superficie humana queda deshabilitada, no degradada
  (`human-auth.service.ts:108-131`).
- **Migraciones concretas:** `20260822130000_municipality_core_01` (crea
  `institutional_identity` e `institutional_session`, activa RLS y crea las dos
  políticas de tenant), `20260822140000_hospital_core_01` y
  `20260822160000_hospital_core_02` (añaden los dos roles hospitalarios),
  `20260823120000_identity_relationships_core_01` (crea `human_account`,
  `human_session`, `human_auth_attempt`).
- **Variables sin valor por defecto:** `MERDN_HOSPITAL_PATIENT_VIEWER_SECRET` y
  `_CODE`, `MERDN_HOSPITAL_SCHEDULER_SECRET` y `_CODE`,
  `MERDN_MUNICIPAL_VIEWER_SECRET` y `_CODE`, `API_WEB_ORIGINS`,
  `NEXT_PUBLIC_MERDN_API_BASE_URL`. **Ninguna de las institucionales figura en
  `.env.example`** (ver límites).

**Specs que dependen de esta:** ninguna la declara formalmente, pero desde
`231f6b6` **todas** las vistas Hospital —003, 009, 010, 013 y 015— solo se montan
detrás de la puerta que esta spec instala: `HospitalShell.tsx:641,656` corta el
render antes de `HospitalContenido` mientras no haya sesión resuelta y vigente.
La spec 015 modificó después `HospitalTopbar.tsx` y `HospitalSidebar.tsx`
conservando el perfil institucional y las dos acciones de sesión.

## Escenarios de aceptación

1. Dada una pantalla `/hospital` recién abierta, cuando la consulta de contexto
   todavía no ha respondido, entonces se muestra el marco neutral de Hospital con
   el texto «Comprobando acceso institucional…» anunciado como estado, sin
   topbar, sin módulo, sin formulario y sin ningún dato demostrativo.
2. Dado que el servidor responde `401` en `GET current`, cuando se resuelve la
   consulta, entonces se muestra el mismo marco neutral con el formulario de
   acceso integrado en el área principal, con menú visible pero inerte.
3. Dados un código y una credencial con forma válida, cuando se envía el
   formulario, entonces se hace `POST` con **exactamente** `identityCode` y
   `accessSecret`, la credencial se borra del estado en el mismo gesto y la
   identidad mostrada se toma después de `GET current`.
4. Dada una credencial incorrecta, un código inexistente o una identidad
   deshabilitada, cuando se envía, entonces el aviso es idéntico en los tres
   casos y no dice cuál de ellos ocurrió.
5. Dada una sesión institucional vigente, cuando se monta el shell, entonces el
   sidebar muestra el nombre real del tenant sin tipo ni municipio inventados, y
   la topbar muestra el actor impersonal, la etiqueta del rol y la caducidad solo
   para lectores de pantalla.
6. Dada una sesión vigente, cuando se pulsa `Cerrar sesión` y el servidor
   responde `204`, entonces la sesión se retira de la pantalla y se confirma el
   cierre.
7. Dada una sesión vigente, cuando el `DELETE` **no** se confirma —red caída,
   origen rechazado o error—, entonces se reconsulta `current` y, si sigue
   vigente, la sesión se conserva, se avisa de que sigue abierta y el cambio de
   credencial queda bloqueado.
8. Dada una petición de apertura o de cierre que no declara `Origin` ni
   `Referer`, cuando llega a la API, entonces se responde `403` y, en el cierre,
   la sesión sigue viva.
9. Dada una visita abierta cuya consulta profesional responde `sin-sesion`,
   cuando se muestra la vista de visitas, entonces aparece el panel «Sesión
   profesional» con un **enlace** al inicio OIDC en pestaña nueva, no un
   formulario ni una petición en segundo plano.
10. Dada una sesión humana sin el contexto `PROFESSIONAL`, cuando se comprueba,
    entonces se explica que no habilita acciones y no se vuelve a leer la visita.
11. Dado un contexto `PROFESSIONAL` confirmado por el servidor, cuando se
    comprueba, entonces se relee la visita y las acciones aparecen **solo** si
    esa lectura responde `ok`.
12. Dado un cierre de sesión profesional confirmado, cuando termina, entonces se
    retiran las acciones, se vuelve al estado fail-closed y la sesión
    institucional de la pantalla no cambia.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO el shell se monte sin contexto resuelto, EL SISTEMA DEBERÁ mostrar el
  marco neutral y NO DEBERÁ montar `data-hospital-content`, topbar funcional,
  buscador, perfil ni módulo alguno.
- CUANDO no haya sesión institucional vigente, EL SISTEMA DEBERÁ mostrar el
  formulario de acceso dentro del área principal del shell y NO DEBERÁ mostrar
  institución, tipo, municipio, persona, iniciales, badge ni conteo procedentes
  de `hospitalShellDemo`.
- CUANDO el navegador abra una sesión institucional, EL SISTEMA DEBERÁ enviar
  únicamente `identityCode` y `accessSecret`, y NO DEBERÁ enviar tenant, rol,
  actor ni token.
- CUANDO la apertura sea correcta, EL SISTEMA DEBERÁ tomar la identidad visible
  exclusivamente de `GET /api/v1/institutional/sessions/current`.
- SI la apertura falla por credencial, por código o por identidad deshabilitada,
  ENTONCES EL SISTEMA DEBERÁ responder y mostrar un desenlace indistinguible
  entre esas causas.
- CUANDO se reciba un `POST` o un `DELETE` de sesión institucional, EL SISTEMA
  DEBERÁ exigir un origen declarado y presente en `API_WEB_ORIGINS`, y DEBERÁ
  responder `403` ante su ausencia.
- CUANDO se cierre la sesión institucional, EL SISTEMA DEBERÁ marcarla revocada
  conservando la fila y DEBERÁ registrar `INSTITUTIONAL_SESSION_REVOKED` dentro
  de la misma transacción.
- SI el `DELETE` no confirma la revocación, ENTONCES EL SISTEMA DEBERÁ conservar
  la sesión en pantalla, avisar de que sigue abierta y bloquear el cambio de
  credencial.
- CUANDO se derive la credencial institucional, EL SISTEMA DEBERÁ usar `scrypt`
  con sal aleatoria por identidad y comparación en tiempo constante, y NO DEBERÁ
  persistir, registrar ni devolver el secreto en claro.
- CUANDO la vista de visitas detecte que falta la sesión personal, EL SISTEMA
  DEBERÁ ofrecer el inicio OIDC existente como navegación en pestaña nueva y NO
  DEBERÁ crear un segundo mecanismo de acceso, contraseña local ni `dev-login`.
- SI la sesión humana no declara el contexto `PROFESSIONAL`, ENTONCES EL SISTEMA
  NO DEBERÁ habilitar ninguna acción sobre la visita.
- CUANDO exista contexto `PROFESSIONAL`, EL SISTEMA DEBERÁ volver a leer la
  visita y DEBERÁ habilitar acciones únicamente si esa lectura responde `ok`.
- EL SISTEMA NO DEBERÁ leer, escribir ni copiar desde JavaScript las cookies
  `merdn_institutional_session` ni `merdn_human_session`, y NO DEBERÁ usar
  `localStorage`, `sessionStorage` ni `indexedDB` para ninguna de las dos
  sesiones.
- EL SISTEMA NO DEBERÁ tratar la sesión institucional como humana ni a la
  inversa: cerrar una NO DEBERÁ cerrar la otra.

## Ámbito de archivos / File scope

- `apps/api/src/institutional-auth/institutional-auth.controller.ts` — las tres
  operaciones de sesión y sus guards
- `apps/api/src/institutional-auth/institutional-session.guard.ts` — autenticación
  sin rol (creado por esta capacidad)
- `apps/api/src/institutional-auth/institutional-same-origin.guard.ts` —
  comprobación de origen de `POST` y `DELETE` (creado por esta capacidad)
- `apps/api/src/institutional-auth/institutional-auth.module.ts` — registro de los
  dos guards nuevos
- `apps/api/src/institutional-auth/institutional-secret.ts` — derivación `scrypt`
  (heredado de la spec 008; documentado aquí por su papel en el acceso)
- `apps/api/src/institutional-auth/institutional-session.cookie.ts` — cookie
  `HttpOnly` de la sesión institucional
- `apps/api/src/institutional-auth/institutional-auth.service.ts` — apertura,
  validación, contexto y revocación
- `apps/api/src/institutional-auth/institutional-audit.service.ts` — eventos de
  sesión creada y revocada
- `apps/api/src/human-auth/me-contexts.controller.ts` — `GET /api/v1/me/contexts`
  (implementado, sin consumidor web)
- `apps/api/test/hospital-institutional-auth.api.test.ts` — cierre por cualquier
  rol y rechazo por origen
- `apps/api/src/institutional-auth/institutional-auth.unit.test.ts` — derivación,
  cookie y aprovisionamiento
- `apps/web/src/features/hospital/HospitalShell.tsx` — tres estados, marco
  neutral, formulario, apertura y cierre
- `apps/web/src/features/hospital/HospitalSidebar.tsx` — `HospitalSidebarNeutral`
- `apps/web/src/features/hospital/HospitalTopbar.tsx` — perfil institucional y
  acciones de sesión
- `apps/web/src/features/hospital/hospital.module.css` — clases `ingreso*`,
  `sesionAcciones`, `navNeutralLista`, `navItemBloqueado`
- `apps/web/src/features/hospital/hospitalInstitutionClient.ts` — cliente de la
  sesión institucional
- `apps/web/src/features/hospital/hospitalHumanSessionClient.ts` — cliente mínimo
  de la sesión humana
- `apps/web/src/features/hospital/HospitalHomeVisits.tsx` —
  `SesionProfesionalPanel` y sus dos operaciones
- `apps/web/src/features/hospital/hospitalShell.test.tsx` — T-H11 a T-H15 y
  regresión H-FID-A
- `apps/web/src/features/hospital/hospitalInstitutionClient.test.ts` — apertura,
  cierre, validación local y reconfirmación
- `apps/web/src/features/hospital/hospitalHumanSessionClient.test.ts` — URL OIDC,
  consulta, cierre y alcance negativo
- `apps/web/src/features/hospital/hospitalOperaciones.test.tsx` — T-10G, panel de
  sesión profesional
- `apps/web/src/features/hospital/hospitalAlcance.test.ts` — los seis clientes
  autorizados

## Estado real y límites conocidos

1. **El cierre de la sesión institucional está roto en un despliegue
   cross-origin.** `apps/api/src/main.ts:37-47` declara
   `methods: ['GET','POST','PATCH','OPTIONS']`; `DELETE` **no** está en la lista.
   La web se sirve en `http://127.0.0.1:3000` y la API en
   `http://127.0.0.1:3001` (`.env.example:62,85`,
   `apps/web/src/config/environment.ts:121`), sin ninguna reescritura de proxy en
   `apps/web/next.config.ts`. El preflight de
   `DELETE /api/v1/institutional/sessions/current` que emite
   `cerrarSesionInstitucional()` recibiría un `Access-Control-Allow-Methods` sin
   `DELETE` y el navegador lo bloquearía; el cliente devolvería `error` y la
   interfaz mostraría «No fue posible confirmar el cierre en el servidor». Las
   pruebas de API usan `supertest` contra `app.init()`, que **no** ejecuta CORS,
   y `enableCors` no tiene ninguna prueba (`grep -rn "enableCors" apps/api`
   devuelve solo `main.ts:37`). `apps/api/test/openapi.test.ts:73` sí documenta
   `delete` en esa ruta: el contrato publicado y el transporte permitido no
   coinciden. **No verificado en ejecución** (ver research.md, R14).
2. **`.env.example` no declara ninguna variable institucional.**
   `grep -n "VIEWER\|SCHEDULER\|INSTITUTIONAL" .env.example` devuelve una sola
   línea, y es un comentario. Quien configure el despliegue a partir de ese
   archivo no tendrá `MERDN_HOSPITAL_PATIENT_VIEWER_SECRET`/`_CODE` ni
   `MERDN_HOSPITAL_SCHEDULER_SECRET`/`_CODE`: ninguna identidad se aprovisiona y
   el formulario de acceso de esta spec **siempre** falla con «No fue posible
   abrir la sesión institucional». Es un límite heredado y ya reconocido por las
   specs 009 y 010, con consecuencia nueva aquí: la puerta existe y no se puede
   abrir con la configuración de ejemplo.
3. **`GET /api/v1/me/contexts` no tiene consumidor.**
   `grep -rn "me/contexts" apps/web/src` no devuelve nada. El shell resuelve el
   contexto profesional leyendo `contexts` de
   `GET /api/v1/human-auth/session`. El endpoint del foco de investigación existe
   y está probado en OpenAPI, pero hoy es superficie sin cliente.
4. **Los controles de sesión profesional NO viven en el shell.** Viven en
   `HospitalHomeVisits.tsx`. `HospitalHomeVisits.tsx:701-702` los monta solo si
   la consulta de la visita respondió `sin-sesion` **o** si ya se comprobó alguna
   vez; y `HospitalHomeVisits.tsx:493-496` no consulta nada si no hay visita
   abierta. En la práctica: hay que ir a Agenda, preparar una visita, navegar a
   Visitas y esperar el `sin-sesion` para que aparezca el panel. No existe
   ningún control global de sesión profesional en la topbar ni en el sidebar.
5. **El retorno del login OIDC no vuelve a Hospital.**
   `human-auth.contract.ts:78` fija `HUMAN_AUTH_RETURN_TARGETS = ['/']` y
   `hospitalHumanSessionClient.ts:68` usa exactamente ese destino. Tras
   autenticarse en la pestaña nueva, la persona aterriza en `/`, no en
   `/hospital`, y debe volver a la pestaña anterior y pulsar «Comprobar sesión
   profesional» a mano. No hay mensaje entre ventanas, no hay reconsulta
   automática y no hay `postMessage`: es una decisión declarada en la Task, no un
   descuido.
6. **No hay renovación ni aviso de caducidad de la sesión institucional.** La
   consulta de contexto se hace una sola vez, al montar
   (`HospitalShell.tsx:463-489`). La caducidad se anuncia únicamente a lectores
   de pantalla (`HospitalTopbar.tsx:78`). Una sesión caducada se descubre al
   fallar la siguiente operación, no antes.
7. **`HospitalUserProfile` es código sin uso efectivo.** El único llamador es
   `HospitalTopbar.tsx:160`, dentro de la rama `sesion === null`, y el único
   llamador de `HospitalTopbar` es `HospitalShell.tsx:684`, que solo se alcanza
   con `sesion !== null`. La persona demostrativa «Claudia Vargas»
   (`hospitalConfig.ts:116-120`) ya no llega a ninguna pantalla, pero sigue
   compilando y sigue en la configuración.
8. **La documentación de la ruta quedó desfasada.**
   `apps/web/src/app/hospital/page.tsx:7-21` sigue afirmando que `/hospital`
   «no consume entorno, no llama a la API y no crea sesión, cuenta ni dato
   persistente», y que su descripción es «sin datos reales, sin backend y sin
   permisos». Desde `231f6b6` eso es falso.
9. **El límite de intentos es de una sola instancia.**
   `institutional-signin-rate-limit.guard.ts:12-24` lo declara: ventana fija en
   memoria del proceso, clave = IP. No protege un despliegue con varias
   instancias y no sustituye un control anti-automatización en el borde. Además,
   **ninguna prueba ejercita el `429`**: `grep -rn "429" apps/api/test` solo
   aparece en `openapi.test.ts`, y ahí es sobre inscripciones.
10. **Un intento fallido de sesión institucional no se audita.**
    `establishSession` devuelve `null` sin escribir evento
    (`institutional-auth.service.ts:197-212`), y el enum `AuditEventType`
    (`prisma/schema.prisma:126-127`) solo tiene `INSTITUTIONAL_SESSION_CREATED` y
    `INSTITUTIONAL_SESSION_REVOKED`. No existe `INSTITUTIONAL_SESSION_DENIED`.
    Contrasta con la superficie humana, que sí persiste intentos en
    `human_auth_attempt`.
11. **El cuarto rol institucional no se rotula.**
    `institutional-auth.contract.ts:27-32` declara cuatro roles;
    `hospitalInstitutionClient.ts:33-36` solo tipa tres, y
    `CAREGIVER_RELATIONSHIP_MANAGER` cae en la etiqueta neutra «Acceso
    institucional» (`etiquetaDeRol`). Está documentado como decisión —no
    inventar un nombre— pero la topbar no distingue ese rol.
12. **«Institución e integraciones» no administra nada.**
    `HospitalInstitutionSettings.tsx:50-87` edita en estado local efímero: nada
    se guarda, nada se publica, `Cargar` no abre selector. No administra la
    identidad institucional, no rota la credencial y no toca esta sesión. Es
    presentación, y sigue siéndolo.
13. **Sin jsdom, los flujos interactivos no se ejecutan.**
    `apps/web/vitest.config.mts:14` lo declara. `hospitalShell.test.tsx:1-40`
    renderiza con `renderToStaticMarkup` e **inyecta** el contexto por
    propiedad. Se prueban: las funciones puras (`validarAcceso`,
    `resolverCierre`, `resolverReconfirmacion`, `cierreHumanoConfirmado`,
    `hayContextoProfesional`, `mensajeDeSesionHumana`), los clientes de red con
    `fetch` falso, y el marcado renderizado. **No** se prueban en un DOM real
    `entrar`, `terminar`, `comprobarSesionProfesional` ni
    `cerrarSesionProfesional`. Varias comprobaciones de
    `hospitalOperaciones.test.tsx:442-516` inspeccionan el **texto del archivo
    fuente** (`expect(EFECTIVO).toContain(...)`): es una aproximación útil, no
    una ejecución del comportamiento.
14. **Las pruebas de API se saltan sin base de datos.**
    `hospital-institutional-auth.api.test.ts:87,102,371` usa
    `describe.skipIf(!puedeEjecutarse)`. Sin PostgreSQL migrado el archivo entero
    se omite y la suite no falla.
15. **La sesión institucional no expira por inactividad.** Su TTL es absoluto:
    8 h por defecto, 24 h como máximo
    (`institutional-auth.contract.ts:62,65`). La humana sí tiene ventana de
    inactividad de 30 min (`human-auth.contract.ts:100`). Son dos políticas
    distintas conviviendo en la misma pantalla, y la interfaz no lo explica.
16. **No hay registro, recuperación de credencial ni administración de usuarios
    institucionales**, y no debe haberla: `institutional-auth.controller.ts:55-72`
    lo declara como alcance cerrado. Cambiar de identidad exige cerrar la actual
    y volver a escribir código y credencial.
17. **Sin auditoría de Codex archivada** para esta capacidad, ni Task
    Specification para `MP-TODAY-01`/`MP-TODAY-02` (ver «Naturaleza de esta
    spec»).

## Criterios de éxito

- Una persona con la credencial institucional del despliegue entra al shell
  Hospital desde la propia pantalla, ve el nombre real de su institución y el rol
  efectivo, y puede cerrar su sesión desde la topbar.
- Ningún estado no autenticado del shell muestra institución, persona, iniciales,
  badge, conteo ni módulo, y ninguno monta `data-hospital-content`.
- La sesión solo se retira de la pantalla cuando el servidor confirma que ya no
  existe.
- Las dos identidades conviven sin confundirse: cerrar la profesional no cierra
  la institucional, y tener sesión institucional no habilita ninguna acción
  profesional sobre una visita.
- `hospitalShell.test.tsx`, `hospitalInstitutionClient.test.ts`,
  `hospitalHumanSessionClient.test.ts`, `hospitalOperaciones.test.tsx`,
  `hospitalAlcance.test.ts`, `institutional-auth.unit.test.ts` y
  `hospital-institutional-auth.api.test.ts` pasan. **No ejecutadas el
  2026-08-25**: `node_modules` ausente y PostgreSQL sin levantar.
