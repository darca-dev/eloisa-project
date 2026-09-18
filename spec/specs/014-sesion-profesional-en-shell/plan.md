# Plan 014 - Acceso institucional y sesión profesional en el shell

## Resumen

**RETROSPECTIVO.** Este plan no propone trabajo: reconstruye, desde `git log` y
desde el código, cómo se construyó una capacidad que ya está en `develop`. Las
fases están escritas en pasado porque ya se ejecutaron, y cada una nombra su
commit real.

La capacidad se construyó en tres movimientos y en dos días:

1. **Abrir la puerta** (`231f6b6`, 2026-08-23). El backend institucional ya
   existía desde la spec 008, pero cerrar la sesión exigía el rol municipal: una
   identidad hospitalaria con sesión perfectamente válida recibía `403` y su
   sesión seguía viva. Se añadieron dos guards —autenticación sin rol y
   comprobación de origen— y, en la web, el cliente completo de apertura y
   cierre, el formulario y el perfil institucional en la topbar.
2. **Devolver la puerta al shell** (`056e8e7`, 2026-08-24, sobre
   `tasks/H-FID-A.md`). El acceso funcionaba, pero parecía otra aplicación. Se
   introdujo el marco neutral —sidebar con menú inerte y área principal— para
   que los dos estados no autenticados conserven la geometría de Hospital sin
   mostrar un solo dato institucional.
3. **Distinguir las dos identidades en la interfaz** (`86505c1`, 2026-08-24,
   sobre `tasks/HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI.md`). La sesión
   institucional no puede ejecutar la visita de una persona. Se añadió un cliente
   mínimo de la sesión humana y un panel que abre, comprueba y cierra esa sesión
   personal sin tocar la institucional y sin crear un segundo mecanismo de
   acceso.

Lo que **no** se hizo, y es tan importante como lo anterior: no se creó un
segundo sistema de sesión, no se añadió migración, no se tocó Prisma, no se
inventó un `dev-login`, no se guardó nada en el navegador y no se leyó ninguna
cookie desde JavaScript.

## Contexto técnico

- **Monorepo npm workspaces**: `apps/api` (NestJS + Prisma), `apps/web`
  (Next.js App Router), `packages/shared`.
- **Dos identidades disjuntas y simultáneas** en la misma pantalla:
  - la **institucional**: una credencial de despliegue, compartida por la
    institución, aprovisionada por variables de entorno, con cookie
    `merdn_institutional_session` y TTL absoluto de 8 h. Es **opaca**: no
    identifica a ninguna persona trabajadora y su actor visible es el literal
    `Acceso institucional`;
  - la **humana**: OIDC Authorization Code + PKCE contra un único proveedor,
    cookie `merdn_human_session`, TTL absoluto de 8 h e inactividad de 30 min.
    Identifica a una persona y es la única que puede atribuirle un acto.
- **Regla que gobierna toda la capacidad**: tener contexto no es tener permiso.
  Ni `GET /institutional/sessions/current` ni `GET /human-auth/session` conceden
  acceso a nada; cada superficie conserva su guard y cada acción vuelve a
  evaluarse en el servidor.
- **Restricciones de prueba heredadas**: el repositorio no incluye jsdom
  (`apps/web/vitest.config.mts:13-14`), así que los componentes se prueban con
  `react-dom/server` y el contexto de sesión se inyecta por propiedad. Las
  pruebas de API exigen PostgreSQL migrado y se saltan sin él.
- **Restricción de proceso**: las dos Task Specifications de esta capacidad
  llevan allowlist **cerrada** de archivos y tiempo máximo de 15 minutos, con
  condiciones de parada explícitas.

## Fases de implementación (ejecutadas)

### Fase 1 — Cierre de sesión para cualquier rol y acceso operable (`231f6b6`)

*2026-08-23, «feat(hospital): add secure institutional access UI», 21 archivos,
+2129/−70.*

En la API:

- se creó `institutional-session.guard.ts`: autentica la sesión **sin** exigir
  rol, publica el principal en la petición, devuelve `401` uniforme y nunca
  `403`. Su cabecera declara lo que no hace y enumera los guards de rol que
  siguen siendo la única autorización de datos;
- se creó `institutional-same-origin.guard.ts`: exige un origen declarado y
  presente en `API_WEB_ORIGINS` para `POST` y `DELETE`, con denegación por
  defecto cuando faltan `Origin` y `Referer`;
- se cambió `institutional-auth.controller.ts` para que `DELETE current` use los
  dos guards nuevos en lugar del guard municipal, y para que `POST` sume el de
  origen al de límite de intentos;
- se registraron ambos en `institutional-auth.module.ts` como providers, sin
  exportarlos: no son autorización de datos.

En la web:

- `hospitalInstitutionClient.ts` pasó de consultar contexto a cubrir el ciclo
  completo: `abrirSesionInstitucional`, `cerrarSesionInstitucional`,
  `validarAcceso` y los mensajes de cada desenlace, todos tipados y sin lanzar;
- `HospitalShell.tsx` ganó los tres estados observables, el formulario de acceso
  y las transiciones `entrar` y `terminar`;
- `HospitalTopbar.tsx` ganó `HospitalInstitutionalProfile` y
  `HospitalSessionActions`;
- `hospital.module.css` ganó las clases `ingreso*` y `sesionAcciones`.

Pruebas de la fase: `hospital-institutional-auth.api.test.ts` sumó el bloque
`MP-TODAY-01` (cierre por Viewer y por Scheduler, `403` por origen ajeno, `403`
sin cabeceras con la sesión aún viva); `hospitalInstitutionClient.test.ts` y
`hospitalShell.test.tsx` sumaron 342 y 281 líneas.

**Sin Task Specification archivada.** El commit cita `MP-TODAY-01` y
`MP-TODAY-02`, y ninguno de los dos existe como archivo en `tasks/`.

### Fase 2 — Documentación del checkpoint de fidelidad (`3793284`)

*2026-08-24, «Add H-FID-A fidelity task», 1 archivo.*

Se archivó `tasks/H-FID-A.md`: allowlist de cuatro archivos, diez criterios de
aceptación, seis condiciones de parada y 15 minutos de tiempo máximo. Fijó lo
que **no** podía relajarse: fail-closed, cookie `HttpOnly`, same-origin,
revocación, reconfirmación, envío exclusivo de `identityCode` y `accessSecret`, y
borrado de la credencial en el gesto de envío.

### Fase 3 — Marco neutral del shell (`056e8e7`)

*2026-08-24, «fix(hospital): restore institutional access shell fidelity», 4
archivos, +357/−148.*

Exactamente los cuatro de la allowlist de `H-FID-A` §5:

- `HospitalShell.tsx` — se extrajo `HospitalMarcoNeutral`, que envuelve los dos
  estados no autenticados en la geometría Hospital: sidebar neutral y `<main>`
  **sin** `data-hospital-content`;
- `HospitalSidebar.tsx` — se añadió `HospitalSidebarNeutral`: marca de
  plataforma y las doce etiquetas del menú en el orden aprobado, dibujadas como
  `<li>` con `data-hospital-nav="bloqueado"`, sin handler ni destino, más un
  texto solo para lectores de pantalla que explica que la navegación exige
  sesión;
- `hospital.module.css` — `.ingreso` dejó de ser una tarjeta aislada y pasó a
  ser el área principal del marco;
- `hospitalShell.test.tsx` — T-H15 («estado neutral mientras se comprueba») y la
  regresión explícita de que el shell autenticado no cambió.

### Fase 4 — Documentación de la puerta de sesión humana (`822a86d`)

*2026-08-24, «docs(identity): add professional session UI gate», 1 archivo.*

Se archivó `tasks/HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI.md`. Fijó los contratos
existentes que había que reutilizar y prohibió expresamente: crear otro login,
tocar el backend de Identity o de Visitas, inventar callback, mensaje entre
ventanas, token o almacenamiento local, y tratar la sesión institucional como
humana.

### Fase 5 — Controles de sesión profesional (`86505c1`)

*2026-08-24, «feat(hospital): add professional human session controls», 5
archivos, +1149/−20.*

Exactamente los cinco de la allowlist:

- `hospitalHumanSessionClient.ts` (nuevo) — sexta y última frontera de red
  autorizada del módulo Hospital. Tres rutas, cinco desenlaces de consulta, seis
  de cierre, DTO de tres campos y la función pura `cierreHumanoConfirmado`;
- `hospitalHumanSessionClient.test.ts` (nuevo) — 370 líneas: URL OIDC exacta,
  cookie implícita, sesión con y sin `PROFESSIONAL`, `401`/`503`/red/aborto,
  cierre, y alcance negativo (ni storage, ni cookie, ni identificador de
  autoridad);
- `HospitalHomeVisits.tsx` — `SesionProfesionalPanel`, sus dos operaciones y sus
  mensajes de producto;
- `hospitalOperaciones.test.tsx` — bloque T-10G;
- `hospitalAlcance.test.ts` — el sexto cliente autorizado y el ajuste del conteo
  textual.

## Dependencias

**Internas (specs).** Ver la tabla completa en `spec.md`. En resumen: 001 aporta
el monorepo y la validación de entorno; 003 y 006, la geometría y la marca que el
marco neutral reproduce; 007, el tenant resuelto en servidor, RLS y auditoría;
**008** aporta el sistema de sesión institucional entero, que esta spec extiende
sin duplicar; 009 y 010, los dos roles hospitalarios y el contrato de `current`;
**011**, la identidad humana OIDC y el contexto `PROFESSIONAL`; 012 y 013, la
visita y la vista donde vive el panel profesional.

**Externas.** PostgreSQL con las migraciones aplicadas; un proveedor OIDC
alcanzable (Keycloak local con el perfil `oidc-local`); las variables sin valor
por defecto de ambas identidades. Ninguna variable institucional figura en
`.env.example`.

**Migraciones.** Esta capacidad **no introduce ninguna**. Reutiliza
`20260822130000_municipality_core_01` (tablas, RLS y políticas institucionales),
`20260822140000_hospital_core_01` y `20260822160000_hospital_core_02` (roles), y
`20260823120000_identity_relationships_core_01` (identidad humana).

## Hitos

| Hito | Commit | Fecha | Estado |
|---|---|---|---|
| Cualquier rol institucional puede cerrar su propia sesión | `231f6b6` | 2026-08-23 | Cumplido |
| `POST` y `DELETE` de sesión exigen origen autorizado | `231f6b6` | 2026-08-23 | Cumplido |
| El acceso institucional es operable desde el propio shell | `231f6b6` | 2026-08-23 | Cumplido |
| La sesión solo se retira con confirmación del servidor | `231f6b6` | 2026-08-23 | Cumplido |
| Los dos estados no autenticados conservan la geometría Hospital | `056e8e7` | 2026-08-24 | Cumplido |
| El menú neutral es visible e inerte, sin conceder nada | `056e8e7` | 2026-08-24 | Cumplido |
| La sesión profesional se abre, comprueba y cierra desde la interfaz | `86505c1` | 2026-08-24 | Cumplido |
| Cerrar la sesión profesional no toca la institucional | `86505c1` | 2026-08-24 | Cumplido |
| La frontera de red del módulo queda en seis clientes exactos | `86505c1` | 2026-08-24 | Cumplido |

## Riesgos (vigentes hoy)

1. **`DELETE` no está en la allowlist de CORS.** `main.ts:37-47` declara
   `methods: ['GET','POST','PATCH','OPTIONS']` y la topología por defecto es
   cross-origin (web `:3000`, API `:3001`, sin proxy en `next.config.ts`). El
   cierre de la sesión institucional que emite `cerrarSesionInstitucional()`
   quedaría bloqueado en el preflight, y la interfaz mostraría «No fue posible
   confirmar el cierre en el servidor». Ninguna prueba cubre `enableCors`, y las
   de API no lo ejecutan. **Riesgo alto y deducido de la configuración, no
   observado.**
2. **La configuración de ejemplo no permite entrar.** Sin las variables
   institucionales en `.env.example`, ninguna identidad se aprovisiona y el
   formulario siempre falla. El impacto es de puesta en marcha, no de seguridad,
   pero convierte la capacidad en inalcanzable para quien siga la documentación.
3. **Límite de intentos de una sola instancia y sin prueba.** 10 intentos por
   300 s en memoria del proceso, clave = IP. No protege un despliegue con varias
   réplicas y el `429` no está ejercitado por ninguna prueba.
4. **Los intentos fallidos no dejan rastro.** No existe
   `INSTITUTIONAL_SESSION_DENIED`. Un ataque por diccionario contra la credencial
   institucional no produce ningún evento de auditoría, aunque `scrypt` lo
   encarezca.
5. **La interactividad no se prueba en un DOM.** Sin jsdom, `entrar`, `terminar`,
   `comprobarSesionProfesional` y `cerrarSesionProfesional` no se ejecutan en
   ninguna prueba. Varias comprobaciones inspeccionan el **texto del archivo
   fuente**: atan la prueba a la forma del código y se romperán ante un refactor
   inocuo, sin cubrir el comportamiento.
6. **El retorno del login humano rompe la continuidad.** `returnTo` solo admite
   `/`. La persona debe volver a mano a la pestaña de Hospital y pulsar
   «Comprobar sesión profesional». Es una decisión declarada, pero sigue siendo
   una fricción real en cada sesión.
7. **El panel profesional es difícil de alcanzar.** Solo aparece con una visita
   abierta y tras un `sin-sesion` de la consulta de visita. Quien necesite abrir
   su sesión personal por adelantado no tiene dónde hacerlo.
8. **Caducidad silenciosa.** El contexto institucional se consulta una sola vez
   al montar y su caducidad solo se anuncia a lectores de pantalla. Una sesión
   expirada se descubre al fallar la siguiente operación.
9. **Documentación desfasada de la ruta.** `apps/web/src/app/hospital/page.tsx`
   sigue afirmando que la pantalla no llama a la API ni crea sesión. Quien lea el
   archivo antes que el shell se llevará una idea falsa del alcance.
10. **Código muerto con nombre de persona.** `HospitalUserProfile` y la persona
    demostrativa de `hospitalShellDemo` ya no se renderizan, pero siguen
    compilando. Un cambio futuro que vuelva a llamar a la topbar sin sesión los
    devolvería a pantalla sin que nadie lo pretenda.
11. **Sin auditoría de Codex y sin Task para el commit fundacional.** El cambio
    más grande de la capacidad —el que tocó guards, controlador y toda la
    superficie de acceso— no tiene Task Specification archivada ni revisión
    registrada.
