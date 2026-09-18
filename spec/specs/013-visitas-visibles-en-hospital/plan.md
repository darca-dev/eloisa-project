# Plan 013 - Visitas domiciliarias visibles en el shell Hospital

## Resumen

**RETROSPECTIVO.** Este plan no propone trabajo: reconstruye, desde `git log` y
desde el código, cómo se ejecutó una capacidad que ya está en `develop`.

Cuatro commits en un solo día, 2026-08-24, en dos packets deliberadamente
pequeños: primero la frontera con la API, después la interfaz. Ningún archivo de
`apps/api`, `prisma/` ni `packages/` cambió: la capacidad es de frontend y se
apoya entera en MP04, expuesto quince minutos antes (`62e3147`, 15:49).

## Contexto técnico

La vista «Visitas domiciliarias» ya existía desde la spec 003 (`d465813`), pero
era una ilustración: cinco filas fijas con paciente, zona, profesional, filtros
que no filtraban y conteos literales. La spec 012 creó la capacidad real —una
visita que nace `SCHEDULED` por acto institucional y que solo la persona
profesional asignada puede iniciar o cerrar— y expuso tres rutas para ella.

El problema de diseño no era técnico sino de honestidad: publicar el estado real
de una visita junto a un paciente y una zona inventados haría pasar por
verificado lo que solo era una maqueta. La decisión que atraviesa toda la
capacidad es sustituir la FUENTE de la vista y borrar todo lo que MP04 no
devuelve, en lugar de mezclar ambas.

La segunda decisión estructural es la separación de identidades. Materializar es
un acto de la sesión INSTITUCIONAL; iniciar, completar o dar por no realizada es
un acto de la PERSONA profesional. El cliente no las mezcla, la vista no deduce
una de la otra y las acciones existen únicamente cuando el servidor devuelve
`ok` a la consulta profesional.

La tercera es la restricción de entorno: no hay jsdom en el repositorio y las
Tasks no autorizaban dependencias nuevas. De ahí que las pruebas rendericen con
`renderToStaticMarkup`, inyecten desenlaces por propiedad y verifiquen parte de
las garantías leyendo el archivo fuente. Es la limitación viva más importante de
esta capacidad (ver Riesgos).

## Fases de implementación (ejecutadas)

1. **Task del packet A** — `6aa1a3e` (2026-08-24),
   `docs(hospital): add visits client integration task`, 1 archivo:
   `tasks/HOSPITAL-VISITS-01-A-CLIENT.md`. Fija la allowlist de tres archivos,
   las tres operaciones exactas, el mapeo de códigos y la prohibición de
   repliegue demostrativo.
2. **Cliente tipado** — `0e5d183` (16:04),
   `feat(hospital): add visits api client`, 3 archivos, +935 líneas.
   `hospitalVisitsClient.ts` con `materializarVisita`,
   `consultarVisitaProfesional` y `cambiarEstadoVisita`; sus 32 pruebas de
   contrato; y la línea que amplía la lista cerrada de clientes autorizados en
   `hospitalAlcance.test.ts`.
3. **Task del packet B** — `ac83d13` (2026-08-24),
   `docs(hospital): add visible visits integration task`, 1 archivo:
   `tasks/HOSPITAL-VISITS-01-B-VISIBLE-UI.md`. Fija el flujo visible mínimo, las
   etiquetas exactas de estado, la separación de sesiones y la allowlist de
   siete archivos.
4. **Interfaz conectada** — `31cd54c` (20:37),
   `feat(hospital): connect home visits workflow`, 7 archivos, +1316 / -104.
   Acción «Preparar visita domiciliaria» en la Agenda sobre citas HOME +
   ASSIGNED; transporte efímero de la visita en `HospitalShell`; sustitución
   completa de la fuente de `HospitalHomeVisits`; y las pruebas T-A8, T-A9,
   T-10A a T-10F y T-H16.

Evolución posterior que hoy vive en los mismos archivos y **no** pertenece a
esta spec:

- `86505c1` (21:01, spec 014) añade el panel de sesión personal profesional
  dentro de `HospitalHomeVisits.tsx` y el bloque de pruebas T-10G;
- `3c738c9` (23:04, spec 015) recupera la estructura visual de la Agenda
  conservando la acción de preparar visita.

## Dependencias

- **Spec 012** — las tres rutas de MP04, la máquina de estados cerrada, el
  control optimista de versión y los guards. Es la capacidad que esta hace
  visible; sin ella no hay nada que conectar.
- **Spec 010** — la Agenda real y `HospitalCitaAgendaDto` con `modality` y
  `status`: de ahí sale el `appointmentId` que se materializa.
- **Spec 011** — sesión humana, perfil profesional y asignación de cuidado
  vigente: es lo que el servidor exige en la superficie profesional.
- **Spec 003** — el shell, la navegación, `HospitalViewPieces` y el hueco de la
  vista que se reconvierte.
- **Spec 009** — el patrón de cliente Hospital y la prueba de alcance que hubo
  que ampliar.
- **Spec 001** — monorepo, Next.js, Vitest y `resolvePublicApiBaseUrl()`.
- **Spec 014** — posterior en el tiempo, pero hoy `HospitalHomeVisits.tsx`
  importa `hospitalHumanSessionClient.ts`: el archivo actual no compila sin ella.
- Externas: PostgreSQL y Keycloak/OIDC tras la API, las migraciones de visitas
  de la spec 012 y un origen web configurado para los guards de mismo origen.

## Hitos

- **H1 — Frontera única con MP04.** `0e5d183`: tres operaciones, ningún campo de
  autoridad en los cuerpos, desenlaces tipados y cero repliegue demostrativo.
- **H2 — La cita correcta ofrece la acción correcta.** `31cd54c`: solo HOME +
  ASSIGNED, y solo si hay controlador que reciba el DTO.
- **H3 — La vista deja de mentir.** `31cd54c`: `hospitalVisitasDemo` desaparece
  de la vista; sin visita abierta se declara el vacío.
- **H4 — Fail-closed profesional.** `31cd54c`: sin `ok` del servidor no hay
  acciones, y el `Programada` de la materialización se conserva porque es un
  hecho real.
- **H5 — Alcance declarado.** `31cd54c`: `hospitalAlcance.test.ts` incorpora el
  quinto punto de inyección y el sexto cliente autorizado.

## Riesgos (vigentes hoy)

- **Una visita se vuelve inalcanzable al recargar.** El transporte es estado
  local del shell y `/hospital` monta `<HospitalShell />` sin propiedades.
  Recargada la página, no hay listado que permita volver a la visita y repetir
  la preparación responde `409` con un mensaje que no describe ese caso. Es el
  riesgo funcional más serio de la capacidad.
- **Datos demostrativos de visitas siguen visibles en el mismo shell.** El
  Inicio compone «Agenda próxima» desde `hospitalVisitasDemo`
  (`hospitalDashboardOperacion.ts:193`). La contradicción es visible para
  cualquier usuario que pase de Inicio a Visitas.
- **Las pruebas comprueban forma, no conducta.** Sin jsdom, el bloqueo de doble
  envío, el abort, el refresco tras conflicto y la navegación del shell se
  verifican con `expect(CODIGO).toContain(...)`. Una reescritura equivalente
  rompería la prueba sin defecto; un defecto que conservara el texto pasaría
  inadvertido.
- **Las mutaciones no se cancelan.** `cambiarEstadoVisita` y
  `materializarVisita` se invocan sin `AbortSignal`: al desmontar, la petición
  sigue viva y solo se evita escribir sobre la vista muerta.
- **El `fetchImpl` del shell no llega a Agenda ni a Visitas.** La inyección de
  red existe a nivel de componente, no de shell: cualquier trabajo futuro que
  suponga poder sustituir la red desde `HospitalShell` fallará.
- **Documentación desactualizada dentro del código.** La cabecera del cliente
  afirma que el servidor no ofrece listado; desde la spec 017 sí lo ofrece. El
  comentario induce a error a quien lea el archivo hoy.
- **CSS y fixture huérfanos.** `hospitalVisits.module.css` mantiene cinco clases
  sin uso y `hospitalVisitsConfig.ts` sigue publicando estados que el servidor
  no modela. Ninguno rompe nada, ambos invitan a reintroducir la maqueta.
