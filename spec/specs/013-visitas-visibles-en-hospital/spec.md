# Especificación 013 - Visitas domiciliarias visibles en el shell Hospital

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specifications: `tasks/HOSPITAL-VISITS-01-A-CLIENT.md` y
`tasks/HOSPITAL-VISITS-01-B-VISIBLE-UI.md`. Congeladas.

**No existe auditoría registrada.** Comprobado con `ls reviews/`: el directorio
contiene REVIEW-001, REVIEW-002, REVIEW-003H-01 a 07, las de Alcaldía, marca,
orquestador y MVP CORE, y ninguna de `HOSPITAL-VISITS-01`. Esta capacidad se
implementó en dos packets sin auditoría de Codex archivada. La ausencia es un
dato del expediente, no un olvido de esta spec.

Capacidad **exclusivamente de frontend**: no crea ni modifica ningún endpoint,
modelo, migración ni guard. Consume las tres rutas que la spec 012 ya expuso.

Dos avisos de lectura, porque los archivos de hoy no son solo los de esta spec:

- `HospitalHomeVisits.tsx` fue ampliado después por `86505c1` (2026-08-24 21:01,
  spec 014), que añadió el panel de sesión personal profesional. Esta spec
  documenta esa sección como **contexto heredado**, no como trabajo propio;
- `HospitalAgenda.tsx` fue tocado después por `3c738c9` (2026-08-24 23:04, spec
  015), recuperación de estructura visual, que conservó la acción de preparar
  visita.

## Objetivo

Que una cita EN DOMICILIO ya ASIGNADA pueda prepararse desde la Agenda del
Hospital y que el estado REAL de la visita resultante quede visible y operable
en la vista «Visitas domiciliarias», retirando de esa vista todo repliegue a
datos demostrativos: si el servidor no responde, la pantalla lo dice en vez de
pintar una bandeja ficticia.

## Historia de usuario principal

Como persona que coordina la agenda institucional del hospital, quiero preparar
la visita domiciliaria de una cita ya asignada y ver su estado real, para que la
persona profesional asignada pueda registrar su inicio y su cierre desde su
propia sesión, sin que la pantalla invente pacientes, zonas ni horarios.

## Qué hace hoy el sistema

| Capacidad | Dónde | Qué hace exactamente |
|---|---|---|
| Cliente tipado de visitas | `apps/web/src/features/hospital/hospitalVisitsClient.ts` | Frontera única con MP04. Tres funciones: `materializarVisita` (`hospitalVisitsClient.ts:330`), `consultarVisitaProfesional` (`:351`) y `cambiarEstadoVisita` (`:376`). |
| Rutas exactas | `hospitalVisitsClient.ts:124-130` | `POST /api/v1/visits/materialize`, `GET /api/v1/professional/visits/:visitId`, `PATCH /api/v1/professional/visits/:visitId/status`. El identificador se codifica con `encodeURIComponent`. |
| Cuerpos minimizados | `hospitalVisitsClient.ts:338` y `:385` | Materializar envía `{ appointmentId }` y nada más. Transicionar envía `{ status, expectedVersion }` y nada más. No viaja tenant, paciente, profesional, actor, rol ni instante. |
| Transporte | `hospitalVisitsClient.ts:252-269` | `credentials: 'include'`, `cache: 'no-store'`, `Accept: application/json`, `Content-Type` solo cuando hay cuerpo. No escribe ni lee cookies. |
| Desenlaces tipados | `hospitalVisitsClient.ts:151-159`, `:234-249` | `ok`, `solicitud-invalida` (400), `sin-sesion` (401), `sin-permiso` (403), `no-encontrado` (404), `conflicto` (409), `no-disponible` (503, otros, red y JSON ilegible) y `cancelado` (abort). El cliente nunca lanza. |
| Textos de producto | `hospitalVisitsClient.ts:176-198` | Un mensaje por fallo, centralizado. Ninguno nombra código HTTP, código estable, ruta ni capa técnica. `ok` y `cancelado` devuelven `null`. |
| Regla de refresco | `hospitalVisitsClient.ts:206-208` | Solo `conflicto` obliga a releer antes de reintentar. |
| Acción en Agenda | `HospitalAgenda.tsx:132`, `:428` | `esCitaMaterializable` es verdadera solo para `modality === 'HOME'` y `status === 'ASSIGNED'`. Cualquier otra cita no dibuja la acción. |
| Materializar | `HospitalAgenda.tsx:714-733` | Un envío en curso —de materialización o de asignación— bloquea cualquier otro. Al éxito entrega el DTO real al shell (`:730`); al fallo publica el mensaje del cliente. |
| Transporte de la visita | `HospitalShell.tsx:434`, `:716-726` | La visita materializada vive en `useState` del shell y la navegación salta a la vista `visitas`. Sin ruta, sin URL, sin persistencia. |
| Vista conectada | `HospitalHomeVisits.tsx:666-678`, `:686-689` | Sin visita abierta declara el vacío. Con visita abierta muestra el estado real; si la consulta profesional no autorizó, conserva el `SCHEDULED` de la materialización y retira las acciones. |
| Etiquetas de estado | `HospitalHomeVisits.tsx:113-118` | `Programada`, `En curso`, `Completada`, `No completada`. Las cuatro del contrato y ninguna más. |
| Acciones por estado | `HospitalHomeVisits.tsx:247-260` | `SCHEDULED` → Iniciar / No completada. `IN_PROGRESS` → Completar / No completada. Terminales → ninguna. `SCHEDULED` nunca es destino. |
| Fail-closed profesional | `HospitalHomeVisits.tsx:283-287`, `:538` | Solo un `ok` confirmado por el servidor habilita acciones. `null`, `sin-sesion`, `sin-permiso`, `no-encontrado`, `conflicto`, `no-disponible` y `cancelado` devuelven `false`. |
| Relectura tras mutación | `HospitalHomeVisits.tsx:557-569` | Tras cualquier transición —éxito o conflicto— se vuelve a leer la visita del servidor. El estado visible nunca se compone con la respuesta del `PATCH`. |
| Cancelación de la consulta | `HospitalHomeVisits.tsx:499-522` | Cada consulta lleva su `AbortController`; desmontar o cambiar de visita la cancela y una respuesta tardía se descarta. |
| Accesibilidad | `HospitalHomeVisits.tsx:746-748`, `:337-339` | Región `role="status" aria-live="polite"` para el desenlace; cada botón con texto visible y ayuda accesible asociada por `aria-describedby`. |
| Alcance declarado | `hospitalAlcance.test.ts:57-64`, `:125-131` | `hospitalVisitsClient.ts` entra en la lista cerrada de clientes autorizados y `HospitalHomeVisits.tsx` en la de puntos de inyección. |
| Panel de sesión profesional *(heredado de la spec 014)* | `HospitalHomeVisits.tsx:358-428`, `:582-656` | Enlace OIDC en pestaña nueva, comprobación y cierre de la sesión humana. Detectarla no habilita nada: las acciones siguen dependiendo del `ok` de la visita. |

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | Monorepo, Next.js, Vitest y `resolvePublicApiBaseUrl()` (`apps/web/src/config/environment.ts:133`) | Sin el resolutor de origen el cliente no sabe a qué host llamar; sin Vitest no hay suite focal. |
| 003-experiencia-visual-hospital | Shell, navegación (`hospitalConfig.ts:85`), `HospitalViewPieces`, `hospitalVisits.module.css` y la vista demostrativa original (`hospitalVisitsConfig.ts`) | Esta spec **sustituye la fuente** de una vista que ya existía; reutiliza su tarjeta, su insignia y su hueco de navegación sin rediseñar nada. |
| 009-hospital-pacientes-api | Patrón de cliente Hospital (`hospitalPatientsClient.ts`) y la prueba de alcance `hospitalAlcance.test.ts` | El cliente de visitas copia forma, no código: mismos desenlaces tipados, misma inyección de `fetchImpl`, misma lista cerrada de clientes autorizados que hubo que ampliar. |
| 010-hospital-profesionales-agenda-api | `hospitalAgendaClient.ts` y el DTO `HospitalCitaAgendaDto` con `modality` y `status` (`:51-52`) | Sin la agenda REAL no hay `appointmentId` que materializar: la acción se dibuja sobre las citas servidas por la API, nunca sobre un fixture. |
| 011-identidad-humana-y-relaciones | Sesión humana, perfil profesional y asignación de cuidado vigente | Es lo que el servidor valida en `GET`/`PATCH` de la superficie profesional; sin ello la consulta responde `401`/`404` y la vista falla cerrado. |
| 012-visitas-domiciliarias | Las TRES rutas de MP04 (`apps/api/src/visits/visits.controller.ts:149`, `:352`, `:404`), su máquina de estados y sus guards | Es la capacidad que esta spec hace visible. Sin ella no hay nada que conectar. |
| 014-sesion-profesional-en-shell | `hospitalHumanSessionClient.ts` y el panel de sesión personal | **Dependencia posterior en el tiempo:** hoy el archivo la importa (`HospitalHomeVisits.tsx:8-14`), de modo que la vista no compila sin ella. |

Dependencias externas:

- **PostgreSQL** y **Keycloak/OIDC**, a través de la API: la interfaz no habla
  con ninguno de los dos, pero sin ambos todas las operaciones responden fallo.
- **Migraciones de visitas** de la spec 012 (`prisma/migrations/`): sin las
  tablas de visita y transición, `POST /api/v1/visits/materialize` no persiste.
- **Origen web configurado**: `InstitutionalSameOriginGuard` y `SameOriginGuard`
  (`visits.controller.ts:140`, `:411`) rechazan las mutaciones que no procedan de
  un origen declarado; un despliegue mal configurado deja la interfaz sin
  materializar y sin transicionar.

Specs que dependen de esta: **014-sesion-profesional-en-shell** (añade el panel
de sesión personal dentro de esta misma vista y reutiliza su regla fail-closed)
y **015-fidelidad-visual-hospital** (la recuperación visual de la Agenda debía
preservar la acción de preparar visita).

## Escenarios de aceptación

1. Dada una cita EN DOMICILIO con estado ASIGNADA en la lista real de la Agenda,
   cuando la persona coordinadora abre esa lista, entonces esa fila —y solo
   esa— ofrece la acción textual «Preparar visita domiciliaria».
2. Dada una cita presencial, virtual, solicitada sin profesional o cancelada,
   cuando aparece en la misma lista, entonces no ofrece ninguna acción de visita.
3. Dada la acción de preparar, cuando se pulsa, entonces se envía únicamente el
   identificador de la cita y, al éxito, la pantalla navega a «Visitas
   domiciliarias» mostrando `Estado de la visita: Programada`.
4. Dado que no hay ninguna visita abierta en el montaje, cuando se entra a
   «Visitas domiciliarias», entonces se declara el vacío y no aparece ninguna
   fila, filtro ni conteo demostrativo.
5. Dada una visita abierta y una consulta profesional que responde `sin-sesion`,
   cuando se muestra la vista, entonces se conserva el estado `Programada`, se
   explica que hace falta una sesión personal profesional vigente y no se ofrece
   ninguna acción.
6. Dada una visita autorizada en estado `SCHEDULED`, cuando la vista se dibuja,
   entonces ofrece «Iniciar» y «No completada», y nunca un destino `SCHEDULED`.
7. Dada una visita en estado terminal, cuando la vista se dibuja, entonces no
   ofrece ninguna acción y explica que ya está cerrada.
8. Dado un `409` al transicionar, cuando llega la respuesta, entonces se anuncia
   que la visita cambió de estado, se relee la visita del servidor y las
   acciones quedan retiradas hasta que la relectura responda.
9. Dado un fallo de red o un `503`, cuando se materializa o se consulta,
   entonces se publica un mensaje de producto y **no** se muestra ningún dato
   demostrativo en su lugar.
10. Dada una transición en curso, cuando se pulsa otro botón, entonces no se
    envía una segunda petición.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se materialice una visita, EL SISTEMA DEBERÁ enviar exclusivamente
  `appointmentId` en el cuerpo (`hospitalVisitsClient.ts:338`).
- CUANDO se cambie el estado de una visita, EL SISTEMA DEBERÁ enviar
  exclusivamente `status` y `expectedVersion` (`hospitalVisitsClient.ts:385`).
- EL SISTEMA NO DEBERÁ aceptar ni enviar `tenantId`, `patientId`,
  `professionalId`, actor, rol, instante, nota ni dato clínico en ninguna de las
  tres operaciones.
- CUANDO cualquier operación falle, EL SISTEMA DEBERÁ devolver un desenlace
  tipado y NO DEBERÁ lanzar una excepción hacia el componente
  (`hospitalVisitsClient.ts:279-314`).
- SI una operación falla, ENTONCES EL SISTEMA NO DEBERÁ mostrar datos de
  `hospitalVisitsConfig.ts` ni ningún otro fixture en la vista conectada
  (`HospitalHomeVisits.tsx` no lo importa; verificado en
  `hospitalOperaciones.test.tsx:155-158`).
- CUANDO la consulta profesional no responda `ok`, EL SISTEMA DEBERÁ ocultar
  todas las acciones profesionales (`HospitalHomeVisits.tsx:283-287`, `:689`).
- SI la consulta profesional responde `sin-sesion`, ENTONCES EL SISTEMA DEBERÁ
  mostrar el texto «Para iniciar o cerrar esta visita hace falta una sesión
  personal profesional vigente.» y conservar el estado `Programada`
  (`HospitalHomeVisits.tsx:141-142`, `:271-275`, `:688`).
- CUANDO una transición responda, EL SISTEMA DEBERÁ releer la visita del
  servidor antes de volver a ofrecer acciones, también ante conflicto
  (`HospitalHomeVisits.tsx:557-569`).
- CUANDO haya un envío en curso, EL SISTEMA DEBERÁ bloquear cualquier otro
  (`HospitalHomeVisits.tsx:538`, `:724`; `HospitalAgenda.tsx:714`, `:883`).
- CUANDO la vista se desmonte o cambie de visita, EL SISTEMA DEBERÁ cancelar la
  consulta en curso y descartar su respuesta (`HospitalHomeVisits.tsx:499-522`).
- EL SISTEMA NO DEBERÁ publicar identificadores, versiones, marcas de tiempo,
  códigos HTTP, rutas, paciente, profesional, dirección, zona ni horario en la
  vista de visitas (`hospitalOperaciones.test.tsx:573-620`).
- EL SISTEMA DEBERÁ anunciar cada desenlace en una región `aria-live`
  (`HospitalHomeVisits.tsx:746-748`).
- EL SISTEMA NO DEBERÁ persistir la visita en el navegador ni exponerla en la
  URL (`HospitalShell.tsx:434`; sin `localStorage`, `useRouter` ni
  `window.location`, verificado en `hospitalShell.test.tsx`).

## Ámbito de archivos / File scope

- `apps/web/src/features/hospital/hospitalVisitsClient.ts` — cliente tipado, tres operaciones, textos y desenlaces
- `apps/web/src/features/hospital/hospitalVisitsClient.test.ts` — 32 pruebas de contrato del cliente
- `apps/web/src/features/hospital/HospitalHomeVisits.tsx` — vista conectada, tarjeta de estado y acciones
- `apps/web/src/features/hospital/HospitalAgenda.tsx` — acción «Preparar visita domiciliaria» sobre citas HOME + ASSIGNED
- `apps/web/src/features/hospital/HospitalShell.tsx` — transporte efímero de la visita y navegación a la vista
- `apps/web/src/features/hospital/hospitalOperaciones.test.tsx` — bloques T-10A a T-10G de la vista conectada
- `apps/web/src/features/hospital/hospitalAgenda.test.tsx` — bloques T-A8 y T-A9 de la preparación
- `apps/web/src/features/hospital/hospitalShell.test.tsx` — bloque T-H16 del transporte efímero
- `apps/web/src/features/hospital/hospitalAlcance.test.ts` — lista cerrada de clientes y de puntos de inyección
- `apps/web/src/features/hospital/hospitalVisitsConfig.ts` — fixture demostrativo **que la vista conectada ya no usa** y que sigue vivo para el Inicio
- `apps/web/src/features/hospital/hospitalVisits.module.css` — estilos de la vista; hoy solo se aplica `.estado`

## Estado real y límites conocidos

- **Solo hay UNA visita a la vez, y no hay bandeja.** La vista muestra la última
  visita materializada en ese montaje (`HospitalShell.tsx:434`). Materializar
  otra la reemplaza. No existe listado, búsqueda ni histórico en Hospital, y
  esto es deliberado en MP04.
- **La visita se pierde al recargar.** `apps/web/src/app/hospital/page.tsx:25`
  monta `<HospitalShell />` sin propiedades, así que `visitaInicial` es `null`.
  El estado es efímero: no viaja por URL y no se persiste.
- **Una visita perdida es irrecuperable desde Hospital.** Tras recargar, volver
  a pulsar «Preparar visita domiciliaria» sobre la misma cita responde `409`
  (`home-visit-materialization.service.ts:242-244`,
  `HOME_VISIT_ALREADY_MATERIALIZED`) y la pantalla muestra «La visita cambió de
  estado. Actualice la información antes de volver a intentarlo.», que en ese
  contexto no describe lo que pasó y no ofrece salida. Es la brecha funcional
  más grande de esta capacidad.
- **No hay control de reintento.** El packet B pedía «carga, vacío, éxito, error
  y reintento». Los cuatro primeros existen; el quinto no: si la consulta
  profesional falla con `no-disponible`, la vista no ofrece ningún botón para
  volver a intentarlo. Solo se relee tras una transición, tras un conflicto o
  tras detectar contexto profesional (`HospitalHomeVisits.tsx:607-609`).
- **El `fetchImpl` del shell no llega a estas superficies.**
  `HospitalShell.tsx:183` y `:191` montan Agenda y Visitas sin pasárselo; el
  `fetchImpl` del shell solo alimenta a sus propios clientes de sesión (`:472`,
  `:541`, `:588`). En producción ambas usan el `fetch` global. La inyección
  existe a nivel de componente y sirve a las pruebas, no al shell.
- **El repliegue demostrativo desapareció de la vista, no del shell Hospital.**
  `hospitalDashboardOperacion.ts:15` y `:193` siguen componiendo «Agenda
  próxima» del Inicio a partir de `hospitalVisitasDemo.visitas`, con pacientes,
  zonas y profesionales ficticios. Un usuario ve datos demostrativos de visitas
  en Inicio y estado real en Visitas, en el mismo shell.
- **`hospitalVisitsConfig.ts` sigue publicando estados que el servidor no
  modela**: en `visitas[]`, «En camino» (`hospitalVisitsConfig.ts:78`, `:87`),
  «Pendiente de asignación» (`:96`) y «Cancelada» (`:105`); más los conteos
  «En camino» y «Canceladas» del arreglo `estados` (`:57`, `:60`). MP04 solo
  conoce cuatro.
- **CSS muerto.** `hospitalVisits.module.css` conserva `.fecha`, `.textos`,
  `.paciente`, `.zona` y `.profesional`; la vista conectada solo aplica `.estado`
  (`HospitalHomeVisits.tsx:310`). El packet B prohibía tocar CSS, así que quedó.
- **Las mutaciones no se abortan.** `cambiarEstadoVisita`
  (`HospitalHomeVisits.tsx:545-549`) y `materializarVisita`
  (`HospitalAgenda.tsx:721`) se invocan sin `AbortSignal`. Solo la consulta
  `GET` se cancela. Al desmontar, la petición sigue viva en la red; lo único que
  se evita es escribir sobre una vista muerta (`montadoRef`).
- **El comentario del cliente quedó desactualizado.**
  `hospitalVisitsClient.ts:6-11` afirma que el servidor no ofrece listado. Desde
  `15a9ae1` (2026-08-25, spec 017) sí lo ofrece: `GET /api/v1/professional/visits`
  (`visits.controller.ts:283`). El cliente Hospital no lo consume —y la spec 017
  construye su propia superficie fuera de Hospital—, pero el texto ya no
  describe el servidor de hoy.
- **La vista no muestra nada más que el estado.** Sin fecha, sin paciente, sin
  profesional, sin dirección, sin zona, sin horario, sin filtros y sin conteos,
  porque MP04 no los devuelve. Tampoco hay mapas, rutas, geolocalización,
  check-in, notas, evidencia, cancelación ni archivo.
- **Las pruebas no ejercitan el DOM.** El repositorio no incluye jsdom y estas
  Tasks no autorizaron dependencias nuevas
  (`hospitalOperaciones.test.tsx:46-55`). Se usa `renderToStaticMarkup`, que no
  ejecuta efectos, más helpers puros y aserciones sobre el TEXTO del archivo
  fuente. Garantías como el bloqueo de doble envío, el abort, el refresco tras
  conflicto o la navegación del shell se comprueban leyendo el código
  (`hospitalOperaciones.test.tsx:552-567`, `hospitalShell.test.tsx:1003-1007`),
  no ejecutando la conducta. Clic efectivo, foco, teclado y verificación
  automática de accesibilidad quedan sin cubrir, y así se declaró en el handoff
  original.
- **Contraste con la spec 003.** Alarmas, Consultas virtuales, Calificaciones,
  Novedades, Inicio, Gestión financiera y Administración siguen componiéndose de
  `hospital*Config.ts` estáticos. Visitas es, junto a Agenda, Pacientes y
  Profesionales, una de las cuatro vistas Hospital cuya fuente es la API. La
  diferencia visible es que las estáticas no pueden fallar y las conectadas sí:
  esta muestra un mensaje de producto donde las otras muestran siempre lo mismo.
- **Nada de esto se ejecutó.** `node_modules` no está instalado y PostgreSQL no
  está levantado: ninguna prueba de esta spec se corrió durante la verificación
  del 2026-08-25.

## Criterios de éxito

- Una cita EN DOMICILIO ya ASIGNADA puede materializarse desde la Agenda y su
  estado real aparece en «Visitas domiciliarias» sin recargar.
- Ningún dato de `hospitalVisitasDemo` llega a la vista conectada, en ningún
  desenlace.
- Ninguna acción profesional aparece sin un `ok` confirmado por el servidor.
- Ningún identificador, versión, marca de tiempo ni código técnico llega al
  marcado.
- `hospitalVisitsClient.test.ts` (32 casos), `hospitalOperaciones.test.tsx`
  (T-10A a T-10G), `hospitalAgenda.test.tsx` (T-A8, T-A9),
  `hospitalShell.test.tsx` (T-H16, 7 casos) y `hospitalAlcance.test.ts` pasan.
  **No ejecutadas el 2026-08-25**: `node_modules` no está instalado, de modo que
  el criterio queda declarado y no comprobado.
