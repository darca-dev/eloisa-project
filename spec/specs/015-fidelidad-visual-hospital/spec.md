# Especificación 015 - Recuperación de fidelidad visual del shell Hospital

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Cinco Task Specifications, todas congeladas:

- `tasks/H-FID-B.md` — branding Eloisa, identidad institucional y topbar.
- `tasks/HOSPITAL-VISUAL-RECOVERY-01-A-PATIENTS.md`
- `tasks/HOSPITAL-VISUAL-RECOVERY-01-B-PROFESSIONALS.md`
- `tasks/HOSPITAL-VISUAL-RECOVERY-01-C-AGENDA.md`
- `tasks/HOSPITAL-REPORTS-UX-01-COMPACT-STICKY-FILTERS.md`

**Auditoría: ninguna.** `ls reviews/` devuelve 22 entradas: 20 veredictos de
auditoría de Codex más `REVIEW-TEMPLATE.md` y `README.md` (este último declara
21, contando la plantilla). La última auditoría
que entró al repositorio es `REVIEW-MVP-CORE-01-FINAL.md` (commit `efc4656`,
2026-08-22). Las cinco tareas de esta spec se implementaron el 2026-08-24, dos
días después de que la práctica de auditoría dejara de registrarse, y
`reviews/README.md` declara el directorio cerrado el 2026-08-25. **Ninguna de
las cinco tareas tiene veredicto de auditoría.** Toda la evidencia disponible es
el código y sus pruebas; no hay revisión externa que confirme que lo entregado
coincide con lo pedido.

Dos precisiones de trazabilidad:

- `tasks/H-FID-A.md` («Fidelity checkpoint 1 de 3») **no pertenece a esta
  spec**: su implementación es `056e8e7` y está registrada en el historial de
  `014-sesion-profesional-en-shell`. Esta spec empieza en el checkpoint 2.
- `H-FID-C` («Fidelity checkpoint 3 de 3», purga general de copy técnico) se
  anunció en `H-FID-A` §6 y `H-FID-B` §8, y seis Task Specifications posteriores lo declaran
  fuera de su alcance, pero **nunca se escribió como Task Specification y nunca
  se implementó**. Ver «Estado real y límites conocidos».

## Objetivo

Recuperar la estructura visual reconocible de cuatro superficies del shell
Hospital que se degradó al conectarlas a la API real —Pacientes (spec 009),
Profesionales y Agenda (spec 010), Visitas visibles (spec 013)—, y compactar la
barra de filtros de Reportes; todo ello sin devolver ni un solo dato del
prototipo, sin tocar clientes, contratos, permisos ni sesión, y dejando escrito
qué información el sistema no tiene.

La lección que documenta esta spec es de acoplamiento: la composición aprobada y
el origen de los datos estaban entrelazados en el mismo componente, de modo que
cambiar el origen destruyó la composición. Las cinco tareas correctivas
separaron ambas cosas.

## Historia de usuario principal

Como coordinadora de atención domiciliaria de una institución, quiero que
Hospital vuelva a verse como la herramienta que se aprobó —fichas, tarjetas y
agrupaciones reconocibles— para poder leer de un vistazo lo que el sistema sí
sabe, sin que la interfaz me afirme cifras, estados o eventos que no existen.

## Qué hace hoy el sistema

| Superficie | Qué se recuperó | Archivos reales |
|---|---|---|
| Sidebar y topbar | Corazón canónico junto a «Eloisa» en una ranura de plataforma separada del logo institucional; `tipo · municipio` compuesto sin restos; topbar compacto; campana y conteo `7` retirados sin sustituto | `HospitalSidebar.tsx:35-120`, `HospitalTopbar.tsx:41-173`, `hospital.module.css:50-74`, `:169-226` |
| Pacientes → ficha | Cabecera de ficha (iniciales, nombre, resumen), fila de clasificaciones declaradas, cuadrícula densa del expediente y bloque de historial; lo no modelado ocupa su sitio y se declara ausente | `HospitalPatientsPieces.tsx:1124-1440`, `hospitalPatients.module.css` |
| Profesionales | Directorio de **tarjetas** (iniciales → nombre → profesión → estado del perfil) en vez de la tabla de columnas que introdujo la conexión a la API; afiliación real compacta | `HospitalProfessionals.tsx:180-271`, `:633`, `ProfessionalDetailPanel.tsx`, `hospitalProfessionalsConfig.ts` |
| Agenda y citas | Solicitudes como tarjetas densas con distintivo de modalidad, citas como filas densas, y las tres acciones agrupadas al final de la fila | `HospitalAgenda.tsx:175-451`, `hospitalAgendaConfig.ts:371-382`, `:714-731`, `hospitalAgenda.module.css:250-288` |
| Reportes → filtros | Barra de seis grupos compacta y `sticky`, con offset explícito, capa propia y adaptación por breakpoint; tabs inmediatamente debajo | `HospitalReportsPieces.tsx:119-300`, `hospitalReports.module.css:164-350`, `:409-414`, `:865-983` |

Invariantes que **no** cambiaron en ninguna de las cinco tareas: clientes de
red, contratos DTO, endpoints, filtros, paginación, cancelación de respuestas
tardías, `expectedVersion` de Agenda, materialización de visita domiciliaria,
handlers de sesión, roles, guards, API, Prisma, migraciones y RLS.

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 003-experiencia-visual-hospital | El shell Hospital, su sidebar, su topbar, la agenda, el directorio de profesionales, la ficha de pacientes y la vista de Reportes | Es la composición aprobada que esta spec recupera; sin ella no hay «fidelidad» que restaurar |
| 006-marca-eloisa-isa | `branding.ts` con `platformDisplayName: 'Eloisa'` y la decisión de retirar el nombre técnico de toda superficie visible | La etiqueta de plataforma del sidebar la lee de allí (`hospitalConfig.ts:HOSPITAL_ETIQUETA_PLATAFORMA`); esta spec no redefine la marca |
| 002-experiencia-inscripcion-visual | El asset canónico `apps/web/public/brand/corazon-check.png` (commit `06a76c3`) y el componente `BrandLogo` | H-FID-B reutiliza ese asset sin copiarlo, editarlo ni crear variante |
| 009-hospital-pacientes-api | `HospitalDetalleDto`, `hospitalPatientsClient.ts` y la conexión real de Pacientes (`30fb378`) | Es a la vez la causa de la degradación y la única fuente factual autorizada de la ficha recuperada |
| 010-hospital-profesionales-agenda-api | `ProfessionalProfile`, `ProfessionalAffiliation`, `Appointment`, `CareAssignment` y los clientes de Profesionales y Agenda (`3d63154`) | Misma doble condición: degradó la composición de ambas vistas y hoy sostiene cada dato visible |
| 013-visitas-visibles-en-hospital | `hospitalVisitsClient.ts` y el flujo `Preparar visita domiciliaria` (`31cd54c`) | La recuperación de Agenda debía conservar intacta esa acción y su materialización |
| 014-sesion-profesional-en-shell | H-FID-A (`056e8e7`): shell neutral fail-closed en `consultando` y `sin-sesion`, con sidebar neutral | H-FID-B es el checkpoint siguiente y debe no romperlo; `HospitalSidebarNeutral` consume la misma marca de plataforma |

**Dependencias externas:** ninguna en tiempo de ejecución para el trabajo de
esta spec (es presentación). Para ver las superficies con datos reales hacen
falta PostgreSQL en marcha y una sesión institucional válida, que aportan las
specs 007, 009, 010 y 014. Ninguna migración se introduce ni se modifica aquí.

**Specs que dependen de esta:** ninguna registrada. Las dos capacidades
posteriores (016 y 017) declaran Hospital fuera de su alcance de forma explícita
(`tasks/VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md` §«Ningún otro archivo
puede cambiar»). Esta spec es terminal en el registro actual.

## Escenarios de aceptación

1. Dada la sesión institucional vigente, cuando se carga el shell Hospital,
   entonces el sidebar muestra el corazón canónico junto a «Eloisa» y ese
   corazón no se anuncia a lectores de pantalla, porque el nombre ya está
   escrito al lado.
2. Dada una institución que no aporta logo, cuando se dibuja la identidad,
   entonces no se dibuja ningún logo institucional y el corazón de Eloisa no lo
   sustituye.
3. Dada una institución con `tipo` vacío y `municipio` presente, cuando se
   compone el metadato, entonces se muestra solo el municipio, sin `·` suelto,
   sin espacio y sin nodo vacío en el marcado.
4. Dado el topbar autenticado, cuando se renderiza, entonces conserva buscador,
   perfil institucional y los dos botones de sesión con sus handlers, y no
   aparece campana, badge ni el conteo `7`.
5. Dado el menú, cuando se renderiza en cualquiera de los tres estados,
   entonces mantiene sus doce elementos en el orden vinculante y el elemento
   activo lleva `aria-current="true"`, no solo un color de fondo.
6. Dado un paciente seleccionado, cuando se abre su ficha, entonces se recupera
   la jerarquía cabecera → clasificaciones → cuadrícula del expediente →
   historial, cada valor procede del `HospitalDetalleDto` servido y el bloque de
   historial no inventa ningún evento ni fecha.
7. Dado un campo que la API no modela, cuando aparece en la ficha, entonces
   lleva el texto `Información no disponible` asociado por `aria-describedby` a
   una explicación dentro del propio diálogo, en vez de un cero o un vacío.
8. Dado el directorio de profesionales, cuando se listan, entonces cada persona
   es una tarjeta con `<h3>` de nombre y estado de perfil escrito como texto
   dentro de un badge, y no aparece calificación, zona, disponibilidad,
   pacientes asignados, citas de hoy ni próxima cita.
9. Dada una solicitud de la agenda, cuando se renderiza, entonces `Asignar`
   conserva su payload y su bloqueo de doble envío, mientras `Reprogramar` y
   `Rechazar con motivo` permanecen `disabled`, sin controlador y con su ayuda
   accesible asociada por `aria-describedby`.
10. Dada una cita `HOME` ya asignada, cuando se muestra, entonces conserva
    `Preparar visita domiciliaria` y el flujo real hacia Visitas.
11. Dada la vista de Reportes, cuando se desplaza el contenido, entonces la
    barra de filtros permanece fija con offset explícito, fondo opaco y una capa
    que queda por encima de las cabeceras de tabla y por debajo del panel modal.
12. Dado un dispositivo táctil, cuando se usa la barra de filtros, entonces sus
    controles recuperan el objetivo de 44 px aunque la densidad de escritorio
    los haya bajado a 32 px.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO el sidebar dibuje la marca de plataforma, EL SISTEMA DEBERÁ emitir la
  imagen `/brand/corazon-check.png` con `alt=""` y `aria-hidden="true"`, de modo
  que el nombre accesible de la marca sea exactamente el texto visible
  (`HospitalSidebar.tsx:58-68`).
- EL SISTEMA NO DEBERÁ usar el corazón de Eloisa como logo institucional: son
  ranuras distintas y la institucional solo se dibuja si la institución aporta
  fuente (`HospitalSidebar.tsx:109-115`).
- SI `tipo` y `municipio` están ambos vacíos, ENTONCES EL SISTEMA NO DEBERÁ
  renderizar el nodo de metadato (`HospitalSidebar.tsx:82-88`, `:117`).
- EL SISTEMA NO DEBERÁ renderizar campana, badge ni conteo de novedades en
  ninguna superficie de Hospital, ni sustituirlos por cero o placeholder
  (`HospitalTopbar.tsx:152-173`; ausencia de `.navBadge` y `.bell` en
  `hospital.module.css`).
- CUANDO un elemento del menú esté activo, EL SISTEMA DEBERÁ marcarlo con
  `aria-current="true"` además del color (`HospitalSidebar.tsx:145`).
- CUANDO el menú se muestre sin sesión, EL SISTEMA DEBERÁ dibujarlo como lista
  de texto sin `type="button"`, sin controlador y sin `href`, y DEBERÁ anunciar
  el bloqueo con texto, no solo con opacidad
  (`HospitalSidebar.tsx:238-257`, `hospital.module.css:148-153`).
- CUANDO la ficha del paciente muestre un campo no modelado, EL SISTEMA DEBERÁ
  escribir `Información no disponible` y asociarlo por `aria-describedby` a la
  explicación del diálogo (`HospitalPatientsPieces.tsx:1150-1166`, `:1313-1315`).
- EL SISTEMA NO DEBERÁ crear filas de historial, eventos, fechas ni semáforo
  clínico que la API no sirva (`HospitalPatientsPieces.tsx:1218-1238`).
- CUANDO se abra la ficha, EL SISTEMA DEBERÁ mover el foco al diálogo y
  devolverlo al botón que lo abrió al cerrarse, y DEBERÁ cerrarse con `Escape`
  (`HospitalPatients.tsx:322-326`, `:556-560`; `HospitalPatientsPieces.tsx:1293-1299`).
- CUANDO se publique el estado del perfil de un profesional, EL SISTEMA DEBERÁ
  escribirlo como texto dentro del badge; el color acompaña y nunca sustituye
  (`HospitalProfessionals.tsx:233-236`).
- EL SISTEMA NO DEBERÁ publicar calificación, zona, disponibilidad, pacientes
  asignados, citas de hoy ni próxima cita por persona, ni siquiera como ranura
  vacía (`hospitalProfessionalsConfig.ts`: `columnas` y `etiquetaCalificacion`
  retiradas en `4843612`).
- CUANDO una acción esté visible pero inoperante, EL SISTEMA DEBERÁ marcarla
  `disabled`, dejarla sin controlador y asociarle por `aria-describedby` un
  texto que declare por qué (`HospitalAgenda.tsx:295-313`).
- CUANDO la agenda muestre la modalidad de una solicitud, EL SISTEMA DEBERÁ
  acompañar el icono con el texto de la modalidad, de modo que ningún estado se
  comunique solo por icono ni solo por color (`hospitalAgendaConfig.ts:714-731`).
- EL SISTEMA NO DEBERÁ renderizar identificadores internos, `expectedVersion`
  ni copy técnico (`CORE`, `API`, `backend`, `demo`, `fixture`) en las cuatro
  superficies recuperadas (probado en `hospitalAgenda.test.tsx` T-A10 y
  `hospitalProfessionals.test.tsx` T-P10).
- CUANDO la vista de Reportes se desplace, EL SISTEMA DEBERÁ mantener la barra
  con `position: sticky`, offset declarado en una variable única, `z-index: 20`
  y fondo opaco (`hospitalReports.module.css:164-179`).
- SI el dispositivo apuntador es grueso, ENTONCES EL SISTEMA DEBERÁ restituir
  `min-height: 44px` en controles, chips y acciones de la barra
  (`hospitalReports.module.css:975-983`).
- EL SISTEMA NO DEBERÁ recortar, solapar ni perder etiquetas de la barra en
  móvil: hasta 767 px la franja se desplaza horizontalmente y desde 768 px pasa
  a rejilla de tres columnas (`hospitalReports.module.css:187-194`, `:865-885`).

## Ámbito de archivos / File scope

- `apps/web/src/features/hospital/HospitalSidebar.tsx` — marca de plataforma, ranura institucional, metadato, item de menú y sidebar neutral
- `apps/web/src/features/hospital/HospitalTopbar.tsx` — topbar sin campana, perfil institucional y acciones de sesión
- `apps/web/src/features/hospital/HospitalShell.tsx` — deja de pasar `novedades` a la topbar
- `apps/web/src/features/hospital/hospital.module.css` — `identityMarca`, `identityLogo`, densidad de topbar y perfil; `navBadge` y `bell` eliminados
- `apps/web/src/features/hospital/HospitalPatientsPieces.tsx` — ficha, cuadrícula del expediente e historial
- `apps/web/src/features/hospital/hospitalPatients.module.css` — composición de la ficha recuperada
- `apps/web/src/features/hospital/hospitalPatientsConfig.ts` — copy `Información no disponible` (fuera de la allowlist declarada; ver límites)
- `apps/web/src/features/hospital/HospitalProfessionals.tsx` — directorio de tarjetas
- `apps/web/src/features/hospital/ProfessionalDetailPanel.tsx` — detalle con ventana y citas servidas
- `apps/web/src/features/hospital/hospitalProfessionalsConfig.ts` — copy y catálogos; columnas y calificación retiradas
- `apps/web/src/features/hospital/hospitalProfessionals.module.css` — tarjetas
- `apps/web/src/features/hospital/HospitalAgenda.tsx` — solicitudes, calendario, citas y acciones agrupadas
- `apps/web/src/features/hospital/hospitalAgendaConfig.ts` — `variante` de acción e `iconoDeModalidad`
- `apps/web/src/features/hospital/hospitalAgenda.module.css` — densidad de solicitudes y citas
- `apps/web/src/features/hospital/HospitalReportsPieces.tsx` — barra de filtros compacta
- `apps/web/src/features/hospital/hospitalReports.module.css` — `sticky`, breakpoints y objetivos táctiles
- `apps/web/src/features/hospital/hospitalShell.test.tsx` — regresión de marca, topbar y menú
- `apps/web/src/features/hospital/hospitalNavegacion.test.tsx` — expectativa del conteo retirada; el contrato de navegación intacto
- `apps/web/src/features/hospital/hospitalPatients.test.tsx`, `hospitalProfessionals.test.tsx`, `hospitalAgenda.test.tsx`, `hospitalReportsVista.test.tsx` — pruebas de composición recuperada
- `apps/web/public/brand/corazon-check.png` — **solo lectura**; ningún commit de esta spec lo modifica

## Estado real y límites conocidos

**La sección más importante de esta spec.**

1. **`H-FID-C` nunca existió.** `H-FID-B` se identifica a sí mismo como
   «Fidelity checkpoint 2 de 3» y seis Task Specifications posteriores declaran
   `H-FID-C` fuera de su alcance, pero no hay archivo `tasks/H-FID-C.md`, no hay
   commit y no hay implementación. La purga general de copy técnico quedó a
   medias: solo se hizo dentro de Pacientes, Profesionales y Agenda.

2. **Copy técnico residual fuera de las superficies recuperadas.**
   `hospitalAdministrationConfig.ts` conserva textos visibles como
   `Ejemplo del prototipo` (`:981`),
   `Lo generará el backend en una tarea aprobada posterior` (`:1388`) y
   `CSV · Excel · JSON · API` (`:971`); `hospitalVirtualConfig.ts:101` menciona
   `API`. `hospitalProfessionalsConfig.ts:56` conserva
   `No disponible en el prototipo` y lo documenta: lo consume Administración,
   que quedó fuera del alcance.

3. **Datos muertos en `hospitalConfig.ts`.** H-FID-B retiró la campana y el
   badge, pero su configuración quedó (`hospitalConfig.ts:58` `novedades`,
   `:64` `HOSPITAL_NOVEDADES_DEMO = 7`, `:46` el campo `badge` del item de menú y
   `:88` su asignación a «Novedades»). Nada de eso se renderiza hoy —ningún
   componente lee `item.badge`—, pero sigue en el contrato porque `H-FID-B` §8
   puso `hospitalConfig.ts` fuera de alcance. Es basura estructural, no un
   riesgo de datos.

4. **El shell Hospital no usa el componente compartido `BrandLogo`.**
   `apps/web/src/components/ui/BrandLogo.tsx:9-11` afirma ser la «fuente visual
   única del símbolo en todo el frontend» y que «ninguna incrusta la ruta del
   asset por su cuenta». `HospitalSidebar.tsx:35` incrusta la ruta literal. La
   contradicción es consecuencia directa de la allowlist cerrada de `H-FID-B`,
   que no autorizaba tocar componentes compartidos de marca. Hoy hay dos
   emisores del mismo símbolo: `BrandLogo` (usado solo por Inscripción) y el
   `<img>` propio del sidebar.

5. **`c9a1195` modificó un archivo fuera de su allowlist.** La allowlist de
   `HOSPITAL-VISUAL-RECOVERY-01-A` es `HospitalPatients.tsx`,
   `HospitalPatientsPieces.tsx`, `hospitalPatients.module.css` y
   `hospitalPatients.test.tsx`. El commit cambió además
   `hospitalPatientsConfig.ts:253` (`'No disponible en CORE-01'` →
   `'Información no disponible'`) y no tocó `HospitalPatients.tsx`. El cambio es
   coherente con la prohibición de copy técnico, pero es una desviación de
   alcance que ninguna auditoría revisó.

6. **Reportes no es una recuperación: es una compactación.**
   `HOSPITAL-REPORTS-UX-01` bajó y fijó la barra de filtros de una vista que
   **nunca se conectó a la API**. `HospitalReports.tsx:5`, `:13` y `:36`
   importan `hospitalPopulationFixtures`, `hospitalReportsSnapshot` y
   `hospitalReportsOperationalFixtures`. Todas sus cifras siguen siendo
   demostrativas. Compactar los filtros no acercó la vista a datos reales.

7. **La marca en Hospital es nueva, no restaurada.** Antes de `fc9aa26` el
   sidebar Hospital solo mostraba la etiqueta de texto; el corazón canónico
   existía desde `06a76c3` (spec 002) pero solo lo usaba Inscripción. H-FID-B lo
   integró por primera vez en Hospital. La tarea lo llama «recuperar la
   identidad visual aprobada» y esa es la intención de producto, pero el
   marcado no volvió a un estado anterior.

8. **`<table>` → `<ul>` en Profesionales.** La recuperación sustituyó una tabla
   semántica con `<th scope="row">` por una lista de tarjetas con `<h3>`. Es
   coherente porque las columnas comparables (calificación, pacientes, citas de
   hoy, próxima cita) se retiraron junto con ella, pero es un cambio de
   semántica de tabla a lista que nadie auditó y que reduce la capacidad de
   comparar personas entre sí.

9. **Objetivo táctil de las acciones de sesión.**
   `hospital.module.css:1099` fija `min-height: 34px` en `.sesionBoton` (antes
   36 px). Cumple el mínimo de 24×24 px, pero queda por debajo de 44 px y —a
   diferencia de la barra de Reportes— no hay `@media (pointer: coarse)` que lo
   restituya en táctil. `grep 'pointer: coarse'` solo lo encuentra en
   `hospitalReports.module.css` (`:157` y `:911`, comentarios; `:975`, la regla
   `@media`) y en la prueba que lo asevera, `hospitalReportsVista.test.tsx:257`:
   ninguna hoja de Hospital lo restituye.

10. **Ningún criterio de esta spec está verificado por ejecución real.**
    `apps/web/vitest.config.mts:26-31` fija `environment: 'node'` y documenta
    que «no se requiere jsdom ni una librería de testing adicional». Las pruebas
    renderizan con `renderToStaticMarkup` y comparan **cadenas**: el HTML
    resultante y, en el caso de la barra de Reportes y la agenda, el **texto del
    propio archivo CSS** (`hospitalReportsVista.test.tsx:177-190`,
    `hospitalAgenda.test.tsx:886-901`). Eso demuestra que la regla existe, no
    que la barra se adhiera, que el foco se mueva, que `Escape` cierre ni que la
    rejilla no desborde. No hay pixel diff, no hay golden y no hay auditoría
    automática de accesibilidad (`axe` no aparece en el repositorio); `H-FID-B`
    §8 excluyó explícitamente las pruebas visuales.

11. **Sin trampa de foco en el diálogo de la ficha.** `PoblacionPanel` declara
    `role="dialog"` y `aria-modal="true"` (`HospitalPatientsPieces.tsx:1289-1290`)
    y el contenedor mueve y devuelve el foco, pero no hay focus trap ni `inert`
    sobre el fondo: con `Tab` el foco puede salir del diálogo hacia el listado
    que queda detrás.

12. **Contraste no medido.** `.navItemBloqueado` combina `opacity: 0.72` con
    `color: var(--b-celeste-borde)` sobre el fondo oscuro del sidebar
    (`hospital.module.css:148-153`). No existe ninguna prueba ni herramienta de
    contraste en el repositorio; la relación resultante no se comprobó.

13. **`prototype-claude/` sigue siendo la referencia de composición.** Las tres
    tareas de recuperación citan rangos de línea de
    `prototype-claude/Eligeme-Hospital.dc.html`. Ningún commit lo modificó, pero
    la fidelidad visual del producto depende hoy de un archivo de prototipo que
    no es un contrato versionado.

## Criterios de éxito

- Las cuatro superficies recuperadas presentan la jerarquía aprobada y cada dato
  visible procede del DTO servido; ninguna importa fixtures.
- Ni la campana, ni el badge, ni el conteo `7`, ni la calificación, ni el
  semáforo clínico, ni un evento de historial inventado aparecen en Hospital.
- Los doce elementos del menú conservan su orden vinculante y el estado activo
  se comunica con `aria-current`, no solo con color.
- Toda acción visible e inoperante está `disabled`, sin controlador, y explica
  su razón por texto asociado.
- La barra de Reportes es materialmente más baja, se adhiere al desplazamiento y
  restituye 44 px en táctil.
- Los clientes, contratos, endpoints, permisos, sesión, migraciones y RLS son
  bit a bit los mismos que antes de las cinco tareas.
