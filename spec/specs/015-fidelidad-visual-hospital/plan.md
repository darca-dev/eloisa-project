# Plan 015 - Recuperación de fidelidad visual del shell Hospital

## Resumen

**RETROSPECTIVO.** Once commits del 2026-08-24, en cinco pares
tarea → implementación (uno de ellos con una enmienda intermedia de allowlist).
Ninguna auditoría. Todo el trabajo es de presentación: cero cambios en API,
Prisma, migraciones, RLS, clientes de red, contratos DTO, sesión o permisos.

El plan real no fue «diseñar una interfaz» sino **desacoplar la composición
aprobada del origen de los datos** en cuatro superficies donde ambas cosas
habían quedado escritas en el mismo componente.

## Contexto técnico

Entre el 2026-08-22 y el 2026-08-24, tres specs conectaron Hospital a datos
reales: 009 (Pacientes, `30fb378`), 010 (Profesionales y Agenda, `3d63154`) y
013 (Visitas visibles, `31cd54c`). Cada una reescribió el componente de vista
completo, porque la composición aprobada en la spec 003 estaba entrelazada con
los fixtures que la alimentaban: no había forma de sustituir el origen sin
sustituir el marcado.

El resultado fue funcionalmente correcto y visualmente irreconocible. En
Profesionales, un directorio de tarjetas se había convertido en una tabla de
ocho columnas, cuatro de ellas rellenas con el literal
`No disponible en este módulo`. En Pacientes, la ficha había perdido cabecera,
cuadrícula e historial. En Agenda, las solicitudes habían perdido densidad y
agrupación de acciones.

La corrección tenía una restricción dura: **recuperar la forma sin recuperar los
datos**. El prototipo (`prototype-claude/Eligeme-Hospital.dc.html`) y el commit
histórico `2e1fe65` se declararon «referencias de composición, no fuentes de
datos ni código a restaurar literalmente». Donde la referencia esperaba una
cifra que la API no sirve, la respuesta correcta no era un cero ni un
placeholder, sino declarar la ausencia.

El instrumento de control fue la **allowlist cerrada**: cada tarea enumeró de
tres a seis archivos y obligó a detenerse antes que ampliarla. Eso protegió los
contratos, y a la vez produjo dos de los límites que hoy siguen vigentes
(duplicación del emisor de marca y configuración muerta en `hospitalConfig.ts`).

## Fases de implementación (ejecutadas)

### Fase 1 — Branding e identidad del shell (H-FID-B)

1. `08c9f47` — `Add H-FID-B fidelity task`: la Task Specification, con allowlist
   de cinco archivos.
2. `e5880ab` — `Expand H-FID-B navigation test allowlist`: enmienda quirúrgica
   que añade `hospitalNavegacion.test.tsx` como sexto archivo, **solo** para
   retirar la expectativa `Novedades: 7 sin leer`, con prohibición explícita de
   tocar orden, destinos, handlers, permisos o estados activos.
3. `fc9aa26` — `fix(hospital): restore branding and topbar fidelity`: corazón
   canónico junto a Eloisa en ranura de plataforma separada de la institucional,
   `metadatoInstitucional` sin restos, topbar compactado y campana + badge
   retirados sin sustituto. 6 archivos, +384 / −127.

### Fase 2 — Ficha de paciente

4. `9090b4b` — `docs(hospital): add patients visual recovery task`.
5. `c9a1195` — `fix(hospital): recover patients visual structure`: cabecera de
   ficha, clasificaciones declaradas, cuadrícula del expediente y bloque de
   historial sin eventos inventados. 4 archivos, +529 / −66. **Uno de esos
   archivos, `hospitalPatientsConfig.ts`, estaba fuera de la allowlist.**

### Fase 3 — Barra de filtros de Reportes

6. `cba4ecc` — `docs(hospital): add compact reports filters task`.
7. `82e6467` — `fix(hospital): compact reports filter bar`: clases propias
   `barraCampo*`, `position: sticky` con offset en variable, cinco breakpoints y
   restitución de 44 px en táctil. 3 archivos, +491 / −39.

### Fase 4 — Directorio de profesionales

8. `2335f5b` — `docs(hospital): add professionals visual recovery task`.
9. `4843612` — `fix(hospital): recover professionals visual structure`: tabla de
   ocho columnas sustituida por tarjetas; calificación, zona, disponibilidad y
   métricas por persona retiradas del contrato de copy, no ocultadas.
   5 archivos, +410 / −401.

### Fase 5 — Agenda y citas

10. `a309846` — `docs(hospital): add agenda visual recovery task`.
11. `3c738c9` — `fix(hospital): recover agenda visual structure`: solicitudes
    como tarjetas densas con distintivo de modalidad, citas como filas densas,
    tres acciones agrupadas, `Reprogramar` y `Rechazar` visibles y
    deshabilitadas. 4 archivos, +561 / −373, incluida la limpieza de las reglas
    CSS de los bloques retirados.

## Dependencias

- **Spec 003** — la composición aprobada que se recupera.
- **Spec 006** — `branding.ts`, de donde sale la etiqueta «Eloisa».
- **Spec 002** — el asset `public/brand/corazon-check.png` y `BrandLogo`.
- **Specs 009, 010 y 013** — a la vez causa de la degradación y única fuente
  factual autorizada de las superficies recuperadas.
- **Spec 014** — H-FID-A (`056e8e7`), el checkpoint anterior; H-FID-B no podía
  romper el shell neutral fail-closed.
- Externas: ninguna en tiempo de compilación. Para ver las superficies con datos
  hacen falta PostgreSQL y sesión institucional válida.

## Hitos

- **H1** — El shell Hospital lleva la marca Eloisa y no afirma ningún conteo sin
  fuente: fase 1, `fc9aa26`.
- **H2** — La ficha del paciente distingue «no tiene» de «no está modelado» con
  un texto asociado accesiblemente: fase 2, `c9a1195`.
- **H3** — La barra de Reportes es materialmente más baja, adherente y con
  objetivo táctil restituido: fase 3, `82e6467`.
- **H4** — Ninguna superficie publica métricas por persona ni calificación:
  fase 4, `4843612`.
- **H5** — Toda acción visible e inoperante está `disabled`, sin controlador y
  con su razón escrita: fase 5, `3c738c9`.

## Riesgos (vigentes hoy)

- **El acoplamiento que causó la degradación no se eliminó.** Las cinco tareas
  repararon el síntoma en cuatro componentes concretos; no se introdujo ninguna
  separación estructural entre presentación y origen de datos. La próxima
  conexión a API de una vista Hospital puede degradar su composición
  exactamente igual.
- **Nada de esto está protegido por una prueba que se ejecute.** La verificación
  visual es lectura de cadenas: HTML de `renderToStaticMarkup` y **texto del
  archivo CSS**. Renombrar una clase, mover una regla o cambiar el formateador
  puede romper las pruebas sin que nada visual cambie; y un cambio visual real
  puede pasar sin que ninguna prueba lo note. No hay golden, ni pixel diff, ni
  auditoría automática de accesibilidad.
- **`H-FID-C` sigue pendiente y bloquea a otros.** Nueve Task Specifications lo
  citan como fuera de alcance, así que el copy técnico residual de
  Administración y Consultas virtuales no tiene dueño asignado.
- **Ninguna de las cinco tareas fue auditada.** El directorio `reviews/` se
  cerró el 2026-08-25 y prohíbe auditorías nuevas. Las desviaciones detectadas
  aquí —el archivo fuera de allowlist en `c9a1195`, la duplicación del emisor de
  marca— nunca pasaron por revisión externa.
- **La marca de Eloisa se emite desde dos sitios.** `BrandLogo.tsx` afirma ser
  la fuente única y no lo es. Un cambio de asset o de tamaño hay que aplicarlo
  en dos lugares, y el segundo no lo sabe.
- **Objetivo táctil corto en las acciones de sesión.** `.sesionBoton` a 34 px sin
  restitución en `pointer: coarse`, a diferencia de la barra de Reportes que sí
  la tiene. Es el único punto del shell donde la compactación bajó de 36 px.
- **Reportes sigue siendo demostrativo.** Se compactó y se fijó la barra de una
  vista alimentada por fixtures. El riesgo es de lectura: una barra de filtros
  pulida y adherente sugiere una herramienta de análisis operativa que todavía
  no lo es.
