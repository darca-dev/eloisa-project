# Plan 018 - Correcciones B1 y B2 de Visitador MP02

## Resumen

> **PROSPECTIVO.** A diferencia de las 17 specs anteriores, este plan describe
> trabajo **no ejecutado**. Nada de lo que sigue está implementado y nada puede
> implementarse hasta que se cumplan las tres condiciones de la sección
> «Qué falta para poder implementar» de `spec.md`.

Dos correcciones sobre un solo archivo de producto y su suite focal. No hay
arquitectura que decidir, no hay dominio que crear y no hay superficie nueva: el
camino de fallo que estas correcciones alimentan ya existe y ya tiene copy de
producto.

El plan es deliberadamente pequeño porque el riesgo de esta spec no está en la
dificultad técnica, sino en el desbordamiento de alcance. Cinco de las seis
correcciones de la auditoría de MP02 quedan fuera; el trabajo consiste tanto en
hacer B1 y B2 como en **no** hacer B3, B4 ni B5 de pasada.

## Contexto técnico

- **Runtime**: Next.js en `apps/web`, TypeScript, npm workspaces (spec 001).
- **Pruebas**: `vitest` 4.1.11 ya instalado en la raíz.
  `apps/web/vitest.config.mts:28` fija `environment: 'node'` y no hay `jsdom`,
  `happy-dom` ni `@testing-library/*`. **Es suficiente** para esta spec: B1 y B2
  viven en funciones puras de normalización y en una función de transporte que
  recibe `fetch` por parámetro, de modo que la suite existente ya las ejercita
  sin DOM. Esa misma ausencia es lo que bloquea B3 y B4, y por eso no se toca.
- **Punto de partida**: `wip/visitador-mp02-20260825` (`cffbf6b`). Los dos
  archivos permitidos existen ahí y **no** en `develop`.
- **Contrato de servidor**: sin cambios. `GET /api/v1/professional/visits`
  devuelve `{ window, items }` con la ventana exactamente como se pidió
  (spec 017, `professional-visit-worklist.service.ts:166-170`). B2 exige del
  cliente que verifique esa propiedad en vez de suponerla.
- **Restricción de método**: allowlist exacta de dos archivos. Tocar un tercero
  bloquea el paquete.

## Fases de implementación

### Fase 0 — Habilitación (no es trabajo de código)

1. Aprobación de esta spec por el Product Owner.
2. Consentimiento por spec, ejecutado por el Product Owner.
3. Decisión de rama: dónde se corrige, dado que los archivos no están en
   `develop`. **STOP CONDITION abierta**; alternativas y tradeoffs en `spec.md`.

Sin las tres, la fase 1 no empieza.

### Fase 1 — B1, fail-closed de `visit`

`normalizarVisita` debe dejar de tratar `undefined` como `null`. Solo la
presencia explícita del valor `null` significa «no materializada»; la ausencia de
la propiedad pasa al mismo desenlace que una forma inválida, que la función ya
sabe expresar devolviendo `undefined` y que `normalizarCita` ya convierte en
descarte de la respuesta completa.

Cambio esperado: una condición, en `visitadorWorklistClient.ts:281-284`. La
distinción entre «ausente» y «`null` explícito» exige comprobar la propiedad en
el objeto, no solo su valor, porque `valor.visit` es `undefined` en ambos casos.

### Fase 2 — B2, ventana devuelta

`normalizarWorklist` debe recibir la ventana solicitada y exigir igualdad literal
con la devuelta, además de la comprobación de forma que ya hace. Es un parámetro
nuevo en una función exportada; la llamada de `consultarWorklistProfesional`
(`:468`) ya tiene la ventana a mano.

Las otras dos reglas de B2 —invertida y mayor de 31 días— **ya están
implementadas** en `esVentanaValida:240` y cubiertas por prueba. No se
reimplementan: se protegen contra regresión.

### Fase 3 — Pruebas

Ampliar `visitadorWorklistClient.test.ts` con los casos de la sección 16 de
`spec.md`: `visit` ausente, y ventana devuelta distinta en `from`, en `to` y en
ambos. Los casos existentes de forma inválida y de ventana de salida se conservan
como regresión.

### Fase 4 — Verificación y handoff

Ejecutar las dos suites de MP02 juntas, typecheck, ESLint acotado,
`git diff --check` y la validación SDD. Entregar el handoff de `CLAUDE.md` §11 en
`spec/bitacora/handoffs/`, con la salida exacta de cada comando y con la
distinción entre lo verificado y lo no verificado.

## Dependencias

**Internas:** spec 017 (contrato de la ruta), spec 013 (`hospitalVisitsClient.ts`,
del que este cliente delega el detalle) y spec 014
(`hospitalHumanSessionClient.ts`). Ninguna se modifica.

**Externas:** ninguna. Ni base de datos, ni OIDC, ni servidor en marcha: la suite
focal inyecta `fetch`.

**De paquetes:** ninguna nueva. Introducir una sería una STOP CONDITION.

**Migraciones:** ninguna.

**Bloqueante:** la decisión de rama de la fase 0.

## Hitos

| Hito | Estado |
|---|---|
| Spec 018 redactada y lista para aprobación | Cumplido |
| Spec 018 aprobada por el Product Owner | **No alcanzado** |
| Consentimiento registrado para 018 | **No alcanzado** |
| Decisión de rama tomada | **No alcanzado** |
| B1 implementada y probada | **No alcanzado** |
| B2 implementada y probada | **No alcanzado** |
| 78 pruebas focales existentes + nuevas en verde | **No alcanzado** |
| Handoff entregado a Codex | **No alcanzado** |
| B3, B4 y B5 | Fuera de alcance, siguen abiertas |
| Integración de MP02 en `develop` | Fuera de alcance, sigue bloqueada |

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Sin lugar donde implementar.** Los dos archivos permitidos no existen en `develop`, y tanto modificar la rama WIP como integrarla están fuera de alcance | La spec puede quedar aprobada y sin ejecución posible | Declarado como STOP CONDITION abierta en `spec.md`, con tres alternativas y una recomendación. Decide el Product Owner |
| **Desbordamiento hacia B3/B4/B5.** Al tocar el cliente es tentador «ya que estamos» añadir pruebas de interacción | Introduciría una dependencia DOM no aprobada y rompería la allowlist | Allowlist de dos archivos y prohibición expresa de `vitest.config.mts`, `package.json` y el lockfile |
| **Corregir B1 rompiendo la semántica de `null`.** Confundir «ausente» con «inválido» en el sentido contrario dejaría de mostrar citas legítimamente no materializadas | Regresión visible: filas correctas desaparecerían | Escenario de aceptación 1 y prueba 1, que fijan que `visit: null` se comporta igual que hoy |
| **La igualdad de ventana rompe casos legítimos** si el servidor normalizara la ventana de alguna forma | Falsos fallos en pantalla | Medido: `professional-visit-worklist.service.ts:166-170` devuelve la ventana exactamente como se pidió. Si eso dejara de ser cierto, es una STOP CONDITION, no un ajuste de tolerancia en el cliente |
| **Las 78 pruebas existentes nunca se han ejecutado** en este repositorio | Un fallo previo podría atribuirse a esta corrección | La fase 4 las ejecuta junto con las nuevas y reporta la salida. Si algo falla ya en la línea base, se reporta como hallazgo separado, no se arregla de paso |
| **Cinco correcciones de la auditoría siguen abiertas** al terminar esta spec | Cerrar 018 puede leerse como «MP02 corregido» | `spec.md` y `tasks.md` declaran B3, B4 y B5 fuera de alcance; el criterio de éxito exige que sigan abiertas y sin tocar |
