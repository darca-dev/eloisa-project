# Decisión importante — Aprobación de alcance de B1 y B2 de Visitador MP02, y por qué la compuerta SDD sigue cerrada

## Fecha

2026-08-25

## Contexto

Codex auditó el código de VISITADOR-CORE-01 MP02 preservado en
`wip/visitador-mp02-20260825` (`cffbf6bd7b5e19a4fb712467e928f92698b18b99`) y
devolvió:

| Campo del veredicto | Valor |
|---|---|
| `MP02 CODEX VERDICT` | `PASS WITH CORRECTIONS` |
| `SAFE TO INTEGRATE INTO DEVELOP` | `NO` |
| `SPEC 017 READY FOR APPROVAL` | `NO` |

Las seis correcciones exigidas se registraron ese mismo día en
`spec/specs/017-worklist-del-visitador/` (`spec.md` §«Auditoría de MP02
(2026-08-25)», `plan.md` Fase 4, `tasks.md`, `history.md`), separando lo
bloqueante del hardening posterior.

De las seis, dos son defectos de código medidos sobre `cffbf6b` y caben dentro de
la allowlist congelada de seis archivos de MP02:

- **B1** — `normalizarVisita` colapsa `undefined` con `null`
  (`apps/web/src/features/visitador/visitadorWorklistClient.ts:281-284`): a una
  respuesta a la que le falte `visit` la interfaz le pone hoy «Pendiente de
  preparación por la institución», que es una afirmación que el servidor no hizo.
- **B2** — la ventana de salida sí se valida antes de la red
  (`esVentanaValida:240`, invocada en `:428`), pero la de entrada no:
  `normalizarWorklist` solo comprueba la forma de día de `window.from` y
  `window.to` (`:361-364`) y nunca la compara con la pedida (`:468`), de modo que
  una agenda de otro periodo se mostraría como si fuera la solicitada.

Las otras tres (**B3** pruebas de interacción real, **B4** foco y accesibilidad,
**B5** verificación visual y de ejecución) no son ejecutables con el repositorio
tal como está: `apps/web/vitest.config.mts:28` fija `environment: 'node'` y no
existen `jsdom`, `happy-dom` ni `@testing-library/*`.

## Decisión

**El Product Owner aprueba el alcance de B1 y B2, y solo de B1 y B2.** B3, B4 y
B5 quedan registradas y **pendientes**, no aprobadas como implementación.

Con esa aprobación de alcance, el trabajo autorizable se limita a:

1. **B1 — fail-closed de `visit`.** Solo `visit: null` explícito significa «cita
   no materializada»; si `visit` falta o llega mal formado, la respuesta es
   inválida.
2. **B2 — validación de ventana.** Rechazar la ventana invertida; rechazar la
   ventana mayor de 31 días; exigir que la ventana devuelta por el servidor
   coincida exactamente con la solicitada.

**La compuerta SDD sigue CERRADA y ninguna línea de código puede escribirse
todavía.** Esto no contradice la aprobación: es que el mecanismo SDD de este
repositorio **no admite aprobación parcial**. Medido sobre
`spec/scripts/check-sdd-gate.sh`:

- la unidad de aprobación es la spec completa: el gate lee
  `- Estado / Status:` de `spec.md` y solo acepta el valor entrecomillado
  `Aprobado`/`Approved`, sin ninguna noción de tranche, fase ni subconjunto de
  tareas;
- además exige consentimiento **por spec**, una línea
  `[spec:017-worklist-del-visitador]` en `.sdd/user-consent.log`. Ese archivo
  **no existe** hoy: ninguna spec del repositorio ha sido consentida nunca;
- el consentimiento es un acto del Product Owner. `CLAUDE.md` §14.4 y
  `AGENTS.md` §22.4 prohíben expresamente que un agente ejecute
  `confirm-user-consent.sh` por iniciativa propia.

Poner `Aprobado` en `spec.md` abriría la compuerta para **toda** la spec 017 —una
spec as-built que cubre también MP01 y sus límites conocidos—, no solo para B1 y
B2. El Product Owner instruyó no declarar la spec 017 completamente aprobada si
SDD no permite aprobar parcialmente este tranche. No lo permite. Por eso el
estado de aprobación de `spec/specs/017-worklist-del-visitador/spec.md`
permanece en `Pendiente`.

Esta decisión, por tanto, **autoriza el alcance y no autoriza la ejecución.**
Tampoco autoriza integrar: `SAFE TO INTEGRATE INTO DEVELOP` sigue en `NO` y la
§12 de `CLAUDE.md` sigue vigente sin excepción.

## Alternativas consideradas

**Marcar `spec.md` como `Aprobado` para abrir la compuerta y ejecutar B1 y B2.**
Rechazada. Abriría la compuerta para toda la spec 017, incluida la parte cuya
auditoría dice `SPEC 017 READY FOR APPROVAL: NO`, y convertiría una aprobación de
dos correcciones en una aprobación de la capacidad entera. Es exactamente lo que
el Product Owner instruyó no hacer.

**Crear una spec nueva —018— que contenga solo B1 y B2, aprobarla y consentirla.**
No rechazada: es la vía que el modelo SDD sí permite, y queda como opción abierta
para el Product Owner. No se ejecuta aquí porque crear y aprobar una spec nueva es
una decisión de gobernanza suya, no de Claude Code, y porque parte de MP02 —una
implementación as-built que vive fuera de `develop`— tendría entonces dos specs
describiéndola. El tradeoff está sobre la mesa; la elección no es de un agente.

**Ejecutar B1 y B2 con la compuerta cerrada, amparándose en la aprobación de
alcance.** Rechazada sin discusión. `CLAUDE.md` §14.4 condiciona toda
modificación de código de producto a la compuerta, y una aprobación de alcance no
es consentimiento registrado.

**Registrar la aprobación solo en la conversación.** Rechazada. Una aprobación de
alcance que no queda escrita no existe para la auditoría siguiente, y el mismo
problema ya obligó a corregir la spec 017 dos veces en un día.

## Consecuencias

Queda escrito qué está aprobado (B1, B2), qué no (B3, B4, B5), por qué no puede
ejecutarse todavía y qué mecanismo exacto falta. Cualquier sesión posterior parte
de este registro en vez de volver a deducirlo.

Trade-off aceptado: dos defectos confirmados —una fila sin `visit` anunciada como
pendiente de la institución, y una ventana ajena mostrada como la pedida— siguen
vivos en `wip/visitador-mp02-20260825` mientras no se resuelva el mecanismo de
aprobación. Ninguno afecta a `develop`, porque MP02 no está integrado.

Efecto sobre las specs: `spec/specs/017-worklist-del-visitador/` registra la
aprobación de alcance de B1 y B2 sin cambiar su estado de aprobación, sin marcar
ninguna casilla como completada y sin declarar pruebas ejecutadas.

Efecto sobre la compuerta: sigue **CERRADA**.
`./spec/scripts/check-sdd-gate.sh .` devuelve
`Compuerta / Gate: CERRADA / closed — todavia no hay ninguna spec aprobada`, con
0 errores. `./spec/scripts/validate-sdd.sh . --strict` devuelve 0 errores y 0
advertencias.

## Cuándo revisar esta decisión

- Cuando el Product Owner elija la vía formal para ejecutar B1 y B2: aprobar y
  consentir la spec 017 completa, o abrir una spec nueva acotada a estas dos
  correcciones.
- Cuando existan las decisiones de dependencia DOM, ampliación de allowlist y
  entorno de ejecución: entonces B3, B4 y B5 dejan de estar bloqueadas.
- Si el código de `wip/visitador-mp02-20260825` cambia: los `file:line` de B1 y
  B2 dejan de describirlo y hay que volver a medirlos antes de corregir.
- Si se decide integrar MP02 sin las correcciones: contradiría el veredicto y
  reabriría esta decisión.

## Registros relacionados

Extiende `2026-08-25-auditoria-git-y-estado-de-ramas.md`, que registró el trabajo
de Visitador fuera de `develop` y previó esta revisión. No reemplaza a ninguno.
