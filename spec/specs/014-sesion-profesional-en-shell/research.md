# Investigación 014 - Acceso institucional y sesión profesional en el shell

Medido sobre `develop` el 2026-08-25. Cada hallazgo cita el comando o la ruta
que lo respalda. Nada aquí procede de memoria ni de suposición.

## R1. La superficie institucional son exactamente tres operaciones

```text
grep -nE "@(Controller|Get|Post|Patch|Delete|UseGuards)" \
  apps/api/src/institutional-auth/institutional-auth.controller.ts
```

Devuelve `@Controller('api/v1/institutional/sessions')` (línea 74), `@Post()` con
`@UseGuards(InstitutionalSignInRateLimitGuard, InstitutionalSameOriginGuard)`
(82-84), `@Get('current')` **sin ningún guard** (149) y `@Delete('current')` con
`@UseGuards(InstitutionalSameOriginGuard, InstitutionalSessionGuard)` (214-216).

`apps/api/test/openapi.test.ts:70-74` confirma la superficie publicada:
`/api/v1/institutional/sessions` solo `post`; `/current` exactamente
`['delete','get']`.

`GET current` no usa guard a propósito: la cabecera del método (177-182) explica
que admite **cualquier** rol institucional implementado y por eso no puede usar
ni el guard municipal ni el hospitalario; la comprobación se hace en línea con
`this.auth.validate(token, new Date())` y el mismo desenlace `401`.

## R2. Qué añadió esta capacidad al backend y qué heredó

```text
git log --diff-filter=A --format="%h %ad %s" --date=short -- <archivo>
```

- `institutional-secret.ts`, `institutional-auth.service.ts`,
  `institutional-auth.controller.ts`, `institutional-session.cookie.ts`,
  `institutional-audit.service.ts` e
  `institutional-signin-rate-limit.guard.ts` → creados en `4094e88`
  (2026-08-22, «Implement Municipality CORE-01»), es decir, **spec 008**.
- `institutional-session.guard.ts` e `institutional-same-origin.guard.ts` →
  creados en `231f6b6` (2026-08-23), que es el primer commit de esta spec.
  `git show --stat 231f6b6` los muestra con 102 y 105 líneas añadidas.
- `me-contexts.controller.ts` → creado en `03255de` (2026-08-24, spec 011).

Conclusión medida: esta spec **no** creó el sistema de sesión institucional. Le
añadió (a) autenticación sin exigencia de rol, para que cualquier identidad
pueda cerrar la suya, y (b) comprobación de origen en las dos operaciones que
cambian estado.

`institutional-session.guard.ts:39-50` documenta explícitamente lo que **no**
hace: no comprueba rol y no concede acceso a datos; produce `401` y nunca `403`.

## R3. Por qué `scrypt` y no SHA-256

`apps/api/src/institutional-auth/institutional-secret.ts:8-20` lo explica en su
propia cabecera, y el código lo respalda:

> A diferencia del token de sesión —256 bits de entropía uniforme, para el que
> SHA-256 basta—, la credencial institucional la elige una persona que administra
> el despliegue. Por eso se deriva con `scrypt`, que es lento a propósito y
> encarece un ataque por diccionario.

Parámetros medidos: `SECRET_SALT_BYTES = 16` (línea 48), `SECRET_HASH_BYTES = 64`
(51), `SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1 }` (57), con el comentario que
calcula el coste de memoria: `16384 * 8 * 128 = 16 MiB`, dentro del `maxmem` por
defecto de Node. `scrypt` viene con Node y no añade dependencia.

`verifySecret` (84-99) valida que sal y hash sean hexadecimales, compara
longitudes y termina en `timingSafeEqual`. Una fila corrupta devuelve `false` en
lugar de lanzar, para no convertir un almacenamiento inesperado en un error del
servidor que además distinga el caso.

En el servicio, `SENUELO_HASH = 'f'.repeat(128)` y `SENUELO_SALT = '0'.repeat(32)`
(`institutional-auth.service.ts:97-98`) se usan cuando el código no resuelve
ninguna identidad (198-203): se deriva igual para que «código desconocido» y
«credencial incorrecta» cuesten lo mismo en tiempo.

## R4. La cookie institucional lleva solo el token

`institutional-session.cookie.ts:44-66` compone
`merdn_institutional_session=<token>; Path=/; HttpOnly; SameSite=<...>;
Max-Age=<...>` y añade `Secure` y `Domain` según la topología. El nombre está en
`institutional-auth.contract.ts:59` y su comentario (52-58) declara que es
distinto del de la cookie de autoinscripción de paciente a propósito.

`institutional-auth.contract.ts:62,65`: TTL por defecto 8 h, máximo 24 h. No hay
ventana de inactividad.

## R5. El guard de origen deniega por defecto

`institutional-same-origin.guard.ts:60-72`: si el origen declarado es `null` o no
está en `this.environment.webOrigins`, lanza `403` con
`INSTITUTIONAL_ORIGIN_REJECTED`. `declaredOrigin` (84-98) prefiere `Origin` y cae
a `Referer` reducido a su origen; una cabecera mal formada devuelve el valor
literal —que jamás coincidirá— en lugar de `null`, para que un cliente hostil no
pueda convertir «origen ajeno» en «sin origen». El origen recibido no se
registra.

El código de error se declara en el propio archivo (línea 52) y no en el
contrato, con un comentario que explica el motivo: el contrato quedaba fuera de
los archivos autorizados de aquella tarea. Consolidarlo sigue pendiente.

## R6. El límite de intentos es de proceso único y no está probado

`institutional-signin-rate-limit.guard.ts:27-30`:
`INSTITUTIONAL_SIGNIN_MAX_ATTEMPTS = 10`,
`INSTITUTIONAL_SIGNIN_WINDOW_SECONDS = 300`. La clave es
`request.ip ?? request.socket.remoteAddress ?? 'unknown'` (38). La cabecera
(12-24) declara el alcance: ventana fija en memoria del proceso, proporcional a
un MVP de instancia única, sin proteger varias instancias y sin sustituir un
control en el borde. Riesgo residual reportado.

```text
grep -rn "429" apps/api/test/*.ts
```

Solo aparece en `apps/api/test/openapi.test.ts:159`, y ahí sobre inscripciones de
paciente. **Ninguna prueba ejercita el `429` institucional.**

## R7. Auditoría: creación y revocación, nunca el fallo

`institutional-audit.service.ts:96-141` escribe `INSTITUTIONAL_SESSION_CREATED` e
`INSTITUTIONAL_SESSION_REVOKED` con `actorType: 'INSTITUTIONAL_IDENTITY'`,
`actorUserId` = identidad opaca, `actorRole`, `resourceType:
'InstitutionalSession'`, `endpoint` y `correlationId`. Ambos se escriben con el
`tx` de la misma transacción (`institutional-auth.service.ts:229-240` y
`382-393`).

```text
grep -n "INSTITUTIONAL_SESSION" prisma/schema.prisma
```

Solo dos valores: `INSTITUTIONAL_SESSION_CREATED` (126) e
`INSTITUTIONAL_SESSION_REVOKED` (127). **No existe un evento de denegación.**
Un `POST` con credencial incorrecta devuelve `null` desde `establishSession`
(206, 212) sin escribir nada. La superficie humana sí persiste intentos, en la
tabla `human_auth_attempt` creada por
`20260823120000_identity_relationships_core_01`.

## R8. Modelos y migración que sostienen la sesión

```text
grep -nE "^(model|enum) (Institutional|Human)" prisma/schema.prisma
```

`enum InstitutionalRole` (205), `enum InstitutionalIdentityStatus` (214),
`model InstitutionalIdentity` (671), `model InstitutionalSession` (717),
`model HumanAccount` (1026), `model HumanSession` (1107),
`model HumanAuthAttempt` (1146).

```text
grep -oE 'CREATE TABLE "[a-z_]+"|ENABLE ROW LEVEL SECURITY|CREATE POLICY "[a-z_]+"' \
  prisma/migrations/20260822130000_municipality_core_01/migration.sql
```

Devuelve `institutional_identity`, `institutional_session`, dos
`ENABLE ROW LEVEL SECURITY` y las políticas `institutional_identity_tenant` e
`institutional_session_tenant`. Los roles hospitalarios se añaden con
`ALTER TYPE "InstitutionalRole" ADD VALUE IF NOT EXISTS` en
`20260822140000_hospital_core_01` y `20260822160000_hospital_core_02`.
`InstitutionalIdentity` guarda `accessSecretHash` y `accessSecretSalt`: nunca el
secreto en claro.

Esta spec **no introduce ninguna migración**.

## R9. Cuatro roles en el servidor, tres rotulados en la interfaz

`institutional-auth.contract.ts:27-32` declara
`['MUNICIPAL_VIEWER','HOSPITAL_PATIENT_VIEWER','HOSPITAL_SCHEDULER','CAREGIVER_RELATIONSHIP_MANAGER']`.

`apps/web/src/features/hospital/hospitalInstitutionClient.ts:33-36` tipa solo
tres, y `etiquetaDeRol` (67-71) devuelve `'Acceso institucional'` para cualquier
otro. Está documentado como decisión: un rol no rotulado cae en la etiqueta
neutra en vez de recibir un nombre inventado.

`INSTITUTIONAL_ACTOR_DISPLAY = 'Acceso institucional'`
(`institutional-auth.contract.ts:150`) es el mismo texto: la credencial
institucional es compartida y no identifica a ninguna persona trabajadora.

## R10. El shell tiene tres estados y solo el tercero monta módulos

`apps/web/src/features/hospital/HospitalShell.tsx`:

- 463-489 — `useEffect` que consulta el contexto al montar, con `AbortController`
  y guarda `vigente`. No se ejecuta si `sesionInicial !== null` (inyección de
  pruebas).
- 641-654 — `if (!sesionResuelta)`: marco neutral con
  `<p role="status">Comprobando acceso institucional…</p>`.
- 656-668 — `if (sesion === null)`: marco neutral con
  `HospitalAccesoInstitucional`.
- 669-732 — shell autenticado: `HospitalSidebar`, `HospitalTopbar` y `<main>` con
  `data-hospital-content={MARCADOR_CONTENIDO[vista]}`.

`HospitalMarcoNeutral` (330-349) monta `<main className={styles.ingreso}>`
**sin** `data-hospital-content`, con el comentario que lo justifica: afirmaría
que hay un módulo montado.

`HospitalSidebarNeutral` (`HospitalSidebar.tsx:227-264`) dibuja el menú como
`<li className={... navItemBloqueado} data-hospital-nav="bloqueado">`: sin
`onClick`, sin `href`, sin `<button>`. Incluye un texto solo para lectores de
pantalla: «Navegación disponible únicamente con una sesión institucional
vigente».

## R11. La credencial se borra en el mismo gesto que la envía

`HospitalShell.tsx:252-268` (dentro de `HospitalAccesoInstitucional`):

```text
setCredencial('');
onEntrar(identityCode, accessSecret);
```

El comentario adjunto lo declara: la credencial no sobrevive al intento, ni
cuando falla. Los dos campos llevan `autoComplete="off"` y el de credencial
`type="password"` con `maxLength={LONGITUD_MAXIMA_CREDENCIAL}` (512, replicado
del contrato del servidor en `hospitalInstitutionClient.ts:171`).

El cuerpo enviado es literalmente `JSON.stringify({ identityCode, accessSecret })`
(`hospitalInstitutionClient.ts:289`), con el comentario «EXACTAMENTE los dos
campos del contrato: ni rol, ni tenant, ni actor».

## R12. La identidad visible tiene una sola procedencia

`abrirSesionInstitucional` devuelve `{ kind: 'ok' }` y **no** propaga el cuerpo
de la respuesta (`hospitalInstitutionClient.ts:256-270,318`). `entrar`
(`HospitalShell.tsx:559-572`) vuelve a llamar a `consultarSesionInstitucional` y
solo con `kind === 'ok'` escribe `setSesion`. Si la apertura sale bien pero el
contexto no llega, se muestra `HOSPITAL_MENSAJE_SIN_CONFIRMAR` y no se compone
ninguna identidad.

## R13. El cierre es fail-closed y está extraído como función pura

`resolverCierre` (`hospitalInstitutionClient.ts:427-440`): solo `ok` (204) y
`sin-sesion` (401) devuelven `retirarSesion: true`. Cualquier otro desenlace
devuelve `reconfirmar: true` y `aviso: null`.

`resolverReconfirmacion` (451-468): tras reconsultar, solo `sin-sesion` retira;
en cualquier otro caso conserva la sesión y devuelve
`HOSPITAL_MENSAJE_CIERRE_NO_CONFIRMADO`, cuyo texto (345-346) dice que la sesión
sigue abierta y que no se puede cambiar todavía.

`terminar` (`HospitalShell.tsx:587-627`) consume ambas. Ser funciones puras es lo
que permite probar la regla sin navegador
(`hospitalInstitutionClient.test.ts:387-473`).

## R14. Contradicción medida: `DELETE` documentado y no permitido por CORS

`apps/api/src/main.ts:37-47`:

```text
app.enableCors({
  origin: [...environment.webOrigins],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 600,
});
```

El comentario del propio bloque dice: «`PUT` y `DELETE` siguen fuera».

Contexto medido que hace que esto importe:

- `apps/web/src/config/environment.ts:121` →
  `DEFAULT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001'`;
- `.env.example:62,85` → web en `:3000`, API en `:3001`, `API_WEB_ORIGINS` con
  los dos orígenes de la web;
- `apps/web/next.config.ts` → **no** declara `rewrites`, `redirects` ni proxy: la
  llamada es cross-origin real;
- `hospitalInstitutionClient.ts:363` → `cerrarSesionInstitucional` emite
  `method: 'DELETE'` con `credentials: 'include'`;
- `apps/api/test/openapi.test.ts:73` → el contrato publicado declara `delete`
  sobre `/api/v1/institutional/sessions/current`;
- `grep -rn "enableCors" apps/api` → una sola aparición, `main.ts:37`; **ninguna
  prueba de CORS**.

Las pruebas de API usan `supertest` contra una aplicación creada con
`Test.createTestingModule(...).createNestApplication()` y `app.init()`
(`hospital-institutional-auth.api.test.ts:395-399`): ese camino **no** ejecuta
`enableCors`, que solo vive en `bootstrap()`. Por eso las pruebas de cierre pasan
aunque un navegador no pudiera hacer esa petición.

**No verificado en ejecución**: no hay navegador, ni API levantada, ni
`node_modules`. Lo que está medido es la configuración y la topología, no el
comportamiento observado del navegador.

## R15. `.env.example` no permite abrir ninguna sesión institucional

```text
grep -n "VIEWER\|SCHEDULER\|INSTITUTIONAL" .env.example
```

Una única coincidencia, y es un comentario en prosa (línea 151). No están
`MERDN_HOSPITAL_PATIENT_VIEWER_SECRET`, `_CODE`,
`MERDN_HOSPITAL_SCHEDULER_SECRET`, `_CODE`, `MERDN_MUNICIPAL_VIEWER_SECRET`,
`_CODE` ni `MERDN_INSTITUTIONAL_SESSION_TTL_SECONDS`. Sí están las variables de
autenticación humana (120-141) y las de
`CAREGIVER_RELATIONSHIP_MANAGER` (158-159, comentadas).

`institutional-auth.config.ts` es fail-closed: sin credencial válida la identidad
no se aprovisiona. Por tanto, con `.env.example` tal cual, el formulario de
acceso de esta spec siempre responde «credenciales inválidas».

Es un límite ya reconocido por las specs 009 (`spec.md:262`) y 010
(`spec.md:82,233`) y por `tasks/TASK-HOSPITAL-CORE-01.md:197`, que prohibió
explícitamente añadir esos nombres a `.env.example` en aquella Task y pidió
reportarlos en el handoff. Nunca se añadieron.

## R16. Las dos identidades son disjuntas, y está probado

Cookies distintas: `merdn_institutional_session`
(`institutional-auth.contract.ts:59`) y `merdn_human_session`
(`human-auth`, citada en `HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI.md`). Tablas
distintas, validadores distintos, principales distintos
(`human-auth.module.ts:24-27` lo declara).

`hospitalHumanSessionClient.ts:34-35`: «NO toca la sesión INSTITUCIONAL. Son dos
entidades disjuntas con cookies distintas: ni una autentica a la otra, ni cerrar
una cierra la otra».

`hospitalOperaciones.test.tsx:502-509` lo comprueba sobre el archivo fuente:

```text
expect(EFECTIVO).not.toContain('hospitalInstitutionClient');
expect(EFECTIVO).not.toContain('cerrarSesionInstitucional');
expect(EFECTIVO).not.toContain('institutional');
```

Y `hospitalShell.test.tsx:989-1002` («la sesión institucional NO habilita ninguna
acción profesional») lo comprueba desde el otro lado.

## R17. La sesión profesional se consulta por `/human-auth/session`, no por `/me/contexts`

```text
grep -rn "me/contexts" apps/web/src apps/api/src packages/
```

Solo dos coincidencias, ambas en la API: `me-contexts.controller.ts:32` y
`people-relationships/caregiver-relationship.policy.ts:87`. **Ningún archivo web
lo nombra.**

```text
grep -rn "human-auth/login\|human-auth/session\|human-auth/logout" apps/web/src
```

Devuelve `hospitalHumanSessionClient.ts:55-57` y sus pruebas. El cuerpo que el
cliente sabe leer (`hospitalHumanSessionClient.ts:84-88`) tiene exactamente
`expiresAt`, `idleExpiresInSeconds` y `contexts`, que es la forma de
`HumanSessionDto` (`apps/api/src/human-auth/human-auth.dto.ts:20-47`).

`consultarSesionHumana` (182-227) reduce todo a cinco desenlaces y falla cerrado
en la lectura: `Array.isArray(datos.contexts) ? datos.contexts : []` (222).

## R18. El inicio de sesión humano es una navegación, no un `fetch`

`urlDeLoginHumano()` (`hospitalHumanSessionClient.ts:135-137`) compone
`${resolvePublicApiBaseUrl()}/api/v1/human-auth/login?returnTo=/`. La cabecera
(127-134) explica por qué no se pide por red: la respuesta es una redirección al
proveedor de identidad y además deja la cookie transitoria del intento.

`HospitalHomeVisits.tsx:385-399` lo renderiza como `<a href>` con
`target="_blank"` y `rel="noopener noreferrer"`.
`hospitalOperaciones.test.tsx:369-380` comprueba que el marcado no contiene
`<form` ni `type="submit"`.

`DESTINO_RETORNO_HUMANO = '/'` (68) es el único valor de la allowlist del
servidor: `human-auth.contract.ts:78` define
`HUMAN_AUTH_RETURN_TARGETS = ['/']` con el comentario de que la lista también
vive como CHECK en la base y ampliarla exige migración. Consecuencia medida: tras
autenticarse, la pestaña nueva aterriza en `/`, no en `/hospital`.

## R19. El panel profesional vive en una sola vista y bajo dos condiciones

`HospitalHomeVisits.tsx:701-702`:

```text
const faltaSesionHumana = consulta !== null && consulta.kind === 'sin-sesion';
const mostrarSesionHumana = faltaSesionHumana || sesionHumana !== null;
```

Y `493-496` corta la consulta cuando `homeVisitId === null`. Sin visita abierta,
`consulta` se queda en `null`, `faltaSesionHumana` es `false` y el panel **no se
monta**.

`comprobarSesionProfesional` (582-618): solo `estado === 'activa-profesional'`
ejecuta `setRefresco((actual) => actual + 1)`. `cerrarSesionProfesional`
(624-670): solo `cierreHumanoConfirmado(cierre)` retira la sesión.

`hayContextoProfesional` (182-184) devuelve `true` únicamente para
`'activa-profesional'`; cualquier otro valor, incluido «sin comprobar», es
`false`.

## R20. La frontera de red del módulo Hospital está cerrada en seis clientes

`apps/web/src/features/hospital/hospitalAlcance.test.ts:57-63` lista
`hospitalAgendaClient.ts`, `hospitalHumanSessionClient.ts`,
`hospitalInstitutionClient.ts`, `hospitalPatientsClient.ts`,
`hospitalProfessionalsClient.ts` y `hospitalVisitsClient.ts`. La comprobación
(197-205) es de **igualdad exacta**, no de inclusión: falla si aparece un
consumidor de red nuevo y también si uno de los seis deja de conectarse.

## R21. `HospitalUserProfile` ya no llega a ninguna pantalla

```text
grep -rn "HospitalTopbar\|HospitalUserProfile" apps/web/src
```

Cinco coincidencias. El único llamador de `HospitalUserProfile` es
`HospitalTopbar.tsx:160`, en la rama `sesion === null`. El único llamador de
`HospitalTopbar` es `HospitalShell.tsx:684`, alcanzable solo cuando
`sesion !== null` (los dos `return` anteriores cortan). La persona demostrativa
`{ nombre: 'Claudia Vargas', rol: 'Coordinación domiciliaria', iniciales: 'CV' }`
(`hospitalConfig.ts:116-120`) sigue en la configuración y sigue compilando, pero
no se renderiza.

## R22. La documentación de la ruta `/hospital` quedó desfasada

`apps/web/src/app/hospital/page.tsx:10-13` afirma que la pantalla «no consume
entorno, no llama a la API y no crea sesión, cuenta ni dato persistente», y la
`metadata.description` (19-20) dice «Sin datos reales, sin backend y sin
permisos». Desde `231f6b6` el shell consulta la API al montar
(`HospitalShell.tsx:463-489`) y abre y cierra sesión institucional.

## R23. `HospitalInstitutionSettings` no administra la identidad institucional

`HospitalInstitutionSettings.tsx:50-87` guarda las ediciones en
`useState<Readonly<Record<string,string>>>({})`. Su cabecera (24-27) lo declara:
«los campos se editan solo en estado local efímero […] nada se guarda, nada se
publica […] `Cargar` no abre selector ni almacena archivo». Ninguna integración
está conectada y no hay credenciales, tokens ni endpoints (33-36). No toca la
sesión institucional ni permite rotar su credencial.

## R24. Cobertura de pruebas: qué cubre cada archivo

- `apps/api/src/institutional-auth/institutional-auth.unit.test.ts` — derivación
  `scrypt` (66-104), atributos de la cookie (114-145), aprovisionamiento
  fail-closed por rol (147-420) y de la agenda (422-611). **No** prueba
  `InstitutionalSameOriginGuard`, `InstitutionalSessionGuard` ni
  `InstitutionalSignInRateLimitGuard`:
  `grep -rn "InstitutionalSameOriginGuard\|InstitutionalSessionGuard\|InstitutionalSignInRateLimitGuard" apps/api | grep -i test`
  no devuelve nada.
- `apps/api/test/hospital-institutional-auth.api.test.ts` — roles disjuntos
  (152-347) y el bloque `MP-TODAY-01` (371-610): cierre por Viewer y por
  Scheduler, `403` por origen ajeno, `403` sin `Origin` ni `Referer` con la
  sesión aún viva, y `401` por credencial incorrecta. Ambos `describe` llevan
  `skipIf(!puedeEjecutarse)` (102, 371).
- `apps/web/src/features/hospital/hospitalShell.test.tsx` — T-H11 (448-541),
  T-H12 (544-625), T-H13 (627-661), regresión H-FID-A (663-691), T-H14
  (693-706), T-H15 (708-742) y T-H16 (960-1023).
- `hospitalInstitutionClient.test.ts` — consulta (56-116), apertura (176-276),
  cierre (278-311), validación local (313-344), mensajes (346-385) y decisión de
  cierre y reconfirmación (387-477).
- `hospitalHumanSessionClient.test.ts` — URL OIDC (73-116), consulta (118-226),
  cierre (228-295) y alcance negativo (297-369).
- `hospitalOperaciones.test.tsx` — T-10G, panel profesional (360-516).
- `hospitalAlcance.test.ts` — T-06B, seis clientes (196-258).

## R25. Sin jsdom, la interactividad se prueba de forma indirecta

`apps/web/vitest.config.mts:13-14`: «Las pruebas renderizan los componentes de
servidor con `react-dom/server`, de modo que no se requiere jsdom ni una librería
de testing adicional».
`grep -rn "jsdom\|happy-dom\|@testing-library" package.json apps/web/package.json`
no devuelve nada.

`hospitalTestUtils.ts:1-9` y `hospitalShell.test.tsx:35-40` lo declaran: el
contexto de sesión se **inyecta por propiedad** porque `renderToStaticMarkup` no
ejecuta efectos.

Consecuencia medida: los manejadores `entrar`, `terminar`,
`comprobarSesionProfesional` y `cerrarSesionProfesional` no se ejecutan en ningún
DOM. Lo que sí se ejerce: las funciones puras, los clientes con `fetch` falso, y
el marcado. Y una técnica que conviene nombrar sin adornos: varias pruebas leen
el **texto del archivo fuente** y comprueban subcadenas —por ejemplo
`hospitalOperaciones.test.tsx:442-448`,
`expect(EFECTIVO).toContain("if (estado === 'activa-profesional')")`—. Eso ata la
prueba a la forma del código, no a su comportamiento.

## R26. Ni auditoría ni Task Specification para el commit fundacional

```text
ls reviews/
grep -rl "H-FID-A\|HUMAN-PROFESSIONAL-SESSION\|MP-TODAY" reviews/
ls tasks/ | grep -i "today"
```

El primero lista 21 archivos; el segundo no devuelve ninguno; el tercero tampoco.

```text
grep -rn "MP-TODAY" apps/
```

Once coincidencias en código y pruebas —`institutional-auth.module.ts:28`,
`HospitalShell.tsx:108`, `hospital.module.css:955`, `hospitalTestUtils.ts:46`,
`hospitalShell.test.tsx:66,533`, `hospitalInstitutionClient.test.ts:168,384`,
`hospital-institutional-auth.api.test.ts:16,350,371`— para dos identificadores de
tarea que no existen como archivo.

## R27. Los commits de esta capacidad

`git show --stat` sobre los cinco de `history.md`:

| Commit | Archivos | Qué toca |
|---|---|---|
| `231f6b6` | 21 | Crea los dos guards nuevos, amplía el controlador, y construye en la web el cliente institucional completo, el formulario y el perfil institucional (+2129/−70) |
| `3793284` | 1 | Solo `tasks/H-FID-A.md` |
| `056e8e7` | 4 | `HospitalShell.tsx`, `HospitalSidebar.tsx`, `hospital.module.css`, `hospitalShell.test.tsx`: marco neutral y `HospitalSidebarNeutral` |
| `822a86d` | 1 | Solo `tasks/HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI.md` |
| `86505c1` | 5 | Crea `hospitalHumanSessionClient.ts` y su prueba; amplía `HospitalHomeVisits.tsx`, `hospitalOperaciones.test.tsx` y `hospitalAlcance.test.ts` |

Dos de los cinco son solo documentación. Ninguno toca `prisma/`.

`056e8e7` respetó la allowlist cerrada de `H-FID-A` §5 exactamente: los cuatro
archivos declarados y ninguno más. `86505c1` respetó la de
`HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI`: cinco archivos, los cinco declarados.

## Verificación no ejecutada

Nada de lo siguiente se comprobó ejecutando, y no debe leerse como si se hubiera
comprobado:

1. **Ninguna prueba se ejecutó.** `node_modules` no está instalado y PostgreSQL
   no está levantado. No se puede afirmar que
   `hospitalShell.test.tsx`, `hospitalInstitutionClient.test.ts`,
   `hospitalHumanSessionClient.test.ts`, `hospitalOperaciones.test.tsx`,
   `hospitalAlcance.test.ts`, `institutional-auth.unit.test.ts` ni
   `hospital-institutional-auth.api.test.ts` pasen hoy. Lo que sí está medido es
   qué comprueban.
2. **Las pruebas de API se saltarían igualmente.**
   `hospital-institutional-auth.api.test.ts:87` calcula `puedeEjecutarse` con
   `availability.available && availability.migrated`; sin base de datos migrada,
   los dos `describe.skipIf` omiten el archivo entero sin fallar.
3. **El bloqueo de CORS sobre `DELETE` (R14) es una deducción de configuración,
   no una observación.** Está medido que `methods` no incluye `DELETE`, que la
   topología por defecto es cross-origin, que no hay proxy en `next.config.ts` y
   que ninguna prueba cubre `enableCors`. No se abrió un navegador ni se levantó
   la API para verlo fallar.
4. **El comportamiento del flujo OIDC no se observó.** No hay Keycloak levantado,
   así que no se comprobó la redirección, la cookie del intento, el `callback`
   ni el aterrizaje en `/`.
5. **El aprovisionamiento real de identidades no se comprobó.** No se ejecutó la
   API, así que no se vio ni el `onModuleInit` registrando roles aprovisionables
   ni la advertencia de «ninguna identidad institucional está configurada».
6. **No se midió el tiempo de `scrypt` ni el del señuelo.** La equivalencia de
   coste entre «código desconocido» y «credencial incorrecta» está razonada en el
   código y es plausible, pero no se cronometró.
7. **No se verificó la accesibilidad con tecnología de asistencia real.** Lo
   medido son roles y atributos en el marcado (`role="status"`, `role="alert"`,
   `aria-describedby`, `merdn-sr-only`), no cómo los anuncia un lector.
