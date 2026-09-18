# Especificación 018 - Correcciones B1 y B2 de Visitador MP02

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `2026-08-25`
- Aprobado por / Approved by: `Product Owner`
- Evidencia de aprobación / Approval evidence: Aprobación explícita del Product Owner en la sesión del 2026-08-25 para implementar exclusivamente B1 (fail-closed de `visit`) y B2 (validación exacta de ventana) de esta spec, sobre la auditoría de Codex de Visitador MP02 (`PASS WITH CORRECTIONS`) y la decisión de alcance `spec/bitacora/decisiones/2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md`. B3, B4 y B5 quedan fuera de alcance y pendientes.

> **Aprobada, y todavía no ejecutable.** Faltan dos cosas, ninguna de ellas de
> Claude Code: el **consentimiento por spec**, que es un acto del Product Owner
> (`CLAUDE.md` §14.4, `AGENTS.md` §22.4), y la **decisión de rama**, que sigue
> abierta porque los dos archivos de la allowlist no existen en `develop`. Ambas
> en «Qué falta para poder implementar».
>
> Aprobar esta spec **no** aprueba la spec 017 ni autoriza integrar MP02 en
> `develop`: `SAFE TO INTEGRATE INTO DEVELOP` sigue en `NO` y la §12 de
> `CLAUDE.md` sigue vigente sin excepción.

## Naturaleza de esta spec

**Correctiva y acotada. No es as-built.** Las 17 specs anteriores documentan
capacidad ya construida; esta define trabajo **no ejecutado**, exactamente dos
correcciones, y existe por una sola razón: cerrar **B1** y **B2** de la auditoría
de Visitador MP02 sin abrir la compuerta de implementación sobre la spec 017
completa.

Nace de la decisión del Product Owner del 2026-08-25, registrada en
`spec/bitacora/decisiones/2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md`,
que eligió esta vía precisamente porque el modelo SDD no admite aprobación
parcial de una spec: el gate lee el `Estado / Status` de una `spec.md` entera y
no conoce tranches. Una spec acotada hace que el permiso registrado coincida con
el alcance aprobado, y con nada más.

## 1. Task ID

**018-correcciones-visitador-mp02** — Correcciones B1 (fail-closed de `visit`) y
B2 (validación de ventana) sobre el cliente de worklist de Visitador MP02.

Capacidad de origen: `VISITADOR-CORE-01 · MP02 — Visible Worklist + Agenda`
(`tasks/VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md`, congelada).

## 2. Objetivo

Que la interfaz `/visitador` **nunca afirme algo que el servidor no dijo**.

Hoy, en el código preservado de MP02, dos respuestas mal formadas producen
pantallas que parecen correctas:

1. una respuesta a la que le falte el campo `visit` se muestra como
   `Pendiente de preparación por la institución`, es decir, como una afirmación
   sobre el estado institucional de una cita que nadie hizo;
2. una respuesta cuya ventana no sea la solicitada se muestra como si fuera la
   agenda del periodo pedido.

Valor para el usuario y la institución: una profesional que planifica su día no
recibe una afirmación falsa sobre qué visitas están preparadas ni sobre qué
periodo está viendo. Ante duda, la pantalla falla cerrado y lo dice.

## 3. Contexto

| Hecho | Fuente |
|---|---|
| MP01 entregó `GET /api/v1/professional/visits` en `develop` (`15a9ae1`) | spec 017 |
| MP02 —la interfaz `/visitador`— se especificó en `6a54de9` y **no está en `develop`** | spec 017 |
| Su implementación se preservó en `wip/visitador-mp02-20260825`, commit `cffbf6bd7b5e19a4fb712467e928f92698b18b99`: seis archivos, 2.763 líneas | `spec/bitacora/global/PROJECT_LOG.md` |
| Codex auditó ese código y devolvió `PASS WITH CORRECTIONS`, `SAFE TO INTEGRATE INTO DEVELOP: NO`, `SPEC 017 READY FOR APPROVAL: NO` | spec 017 §«Auditoría de MP02 (2026-08-25)» |
| La auditoría exige seis correcciones, B1 a B6 | spec 017 `tasks.md` |
| El Product Owner aprobó el alcance de **B1 y B2 solamente** el 2026-08-25 | `spec/bitacora/decisiones/2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md` |
| B3, B4 y B5 quedaron pendientes por falta de decisiones sobre dependencias DOM, allowlist y entorno de ejecución | misma decisión |
| El Product Owner eligió la vía «spec nueva acotada» el 2026-08-25 | misma sesión; esta spec es su resultado |

Estado medido de los dos defectos, sobre `cffbf6b`, en
`apps/web/src/features/visitador/visitadorWorklistClient.ts`:

- **B1**: `normalizarVisita` devuelve `null` tanto para `visit: null` como para
  `visit` ausente (`:281-284`). `null` significa «no materializada» en el
  contrato; `undefined` significa «esta respuesta no cumple el contrato». Hoy se
  confunden y el segundo se muestra como el primero.
- **B2**: la ventana **de salida** sí se valida antes de la red
  (`esVentanaValida:240`, invocada en `:428`): rechaza la invertida y la mayor de
  31 días. La ventana **de entrada** no: `normalizarWorklist` solo comprueba la
  forma de día de `window.from` y `window.to` (`:361-364`) y nunca la compara con
  la solicitada (`:468`).

Detalle completo y comandos en `research.md`.

## Historia de usuario principal

Como profesional que realiza visitas domiciliarias, quiero que la agenda me
diga «no puedo mostrarte esto» en vez de mostrarme un estado inventado, para no
planificar mi día sobre una afirmación que el servidor nunca hizo.

## 4. Usuarios afectados

- **Rol:** persona profesional con sesión humana `PROFESSIONAL` confirmada por el
  servidor, que es la única que ve `/visitador`.
- **Institución y tenant:** sin cambio. Esta spec no toca autorización: el
  servidor sigue derivando perfil, afiliación y asignación de
  `principal.personId` y `principal.tenantId` (spec 017).
- **Relaciones:** sin cambio. Ninguna corrección altera qué citas ve nadie.
- **No afectados:** Hospital, Alcaldía, Admin Support, Paciente, Cuidador,
  Reportes y cualquier superficie de `develop`. El código que se corrige no está
  en la rama de integración.

## 5. Módulos afectados

**Dentro de alcance:** la frontera de red de Visitador, es decir el cliente
tipado del worklist y su suite focal.

**Fuera de alcance:** backend, API, esquema, migraciones, dominio, autorización,
auditoría, `VisitadorExperience.tsx`, la hoja de estilos, la ruta
`app/visitador/page.tsx`, los clientes de Hospital reutilizados por importación,
y toda otra superficie del repositorio.

Que la experiencia no cambie es una **consecuencia buscada**: el cliente ya
traduce «cuerpo que no cumple el contrato» a `no-disponible`, y la experiencia ya
sabe pintar ese desenlace con copy de producto y sin datos alternativos. Las dos
correcciones consisten en que más casos entren correctamente por ese camino que
ya existe, no en abrir uno nuevo.

## 6. Requisitos funcionales

### B1 — Fail-closed de `visit`

1. `visit: null` explícito **debe** seguir significando «cita todavía no
   materializada por la institución», y debe seguir mostrándose como
   `Pendiente de preparación por la institución`.
2. Una fila en la que la propiedad `visit` **falte** debe invalidar la respuesta.
3. Una fila en la que `visit` esté presente pero **mal formado** —no es objeto,
   o le falta un campo obligatorio, o un campo tiene tipo o valor fuera del
   contrato— debe invalidar la respuesta. Esto ya ocurre y no debe regresar.
4. Invalidar la respuesta significa el desenlace seguro que ya existe: la lectura
   completa se descarta, no se muestra ninguna fila, la persona recibe el copy de
   servicio no disponible y se le ofrece reintentar. No se omite la fila
   defectuosa y se muestran las demás: una lista parcial silenciosa sería otra
   afirmación no respaldada.

### B2 — Validación de ventana

5. Una ventana **invertida** (`from` posterior a `to`) debe rechazarse antes de
   salir a la red. Ya implementado (`esVentanaValida:240`); debe seguir cubierto
   por prueba y no regresar.
6. Una ventana **mayor de 31 días** debe rechazarse antes de salir a la red. Ya
   implementado, con 31 días inclusive; debe seguir cubierto por prueba y no
   regresar.
7. La ventana **devuelta por el servidor** debe coincidir **exactamente** —`from`
   y `to`, comparación literal de los dos días `AAAA-MM-DD`— con la solicitada.
   Cualquier discrepancia invalida la respuesta, con el mismo desenlace seguro
   del requisito 4. **Este es el único requisito de B2 que hoy no está
   implementado.**

### Límite explícito

8. Ninguna corrección puede cambiar el texto de producto, la disposición visual,
   el orden recibido del servidor, la minimización de datos ni el conjunto de
   desenlaces que la interfaz sabe explicar. Si una corrección exigiera tocar la
   experiencia, es una STOP CONDITION y no un cambio permitido por esta spec.

## 7. Requisitos de datos

- **Entradas:** el cuerpo JSON de `GET /api/v1/professional/visits?from&to` y la
  ventana solicitada, que ya vive en memoria del cliente.
- **Salidas:** las mismas de hoy. Un `VisitadorWorklist` normalizado, o un
  desenlace de fallo. No se añade ningún campo.
- **Modelo:** sin cambios. Cero migraciones, cero modelos, cero campos nuevos.
- **Propietario y sensibilidad:** sin cambios. El servidor sigue minimizando el
  paciente a `displayName` e `initials`; esta spec no amplía lo que viaja ni lo
  que se muestra.
- **Procedencia y linaje:** el cambio **refuerza** la procedencia: el objetivo
  literal es que ningún estado mostrado carezca de origen en la respuesta del
  servidor.
- **Retención y minimización:** sin cambios. El cliente no persiste nada, sigue
  pidiendo `cache: 'no-store'` y no escribe en el navegador.

## 8. Permisos

Sin cambios, y ninguna corrección puede introducirlos.

- La autenticación sigue siendo la cookie `HttpOnly` de sesión humana, que el
  cliente nunca lee ni escribe, enviada con `credentials: 'include'`.
- La autorización sigue resolviéndose entera en el servidor desde
  `principal.personId` y `principal.tenantId`.
- La consulta sigue admitiendo exactamente `from` y `to`. Ningún identificador de
  autoridad puede aparecer en la petición.
- Una respuesta invalidada **no** degrada permisos ni muestra datos de reserva:
  no muestra nada.

## 9. Auditoría

Esta spec **no** introduce eventos de auditoría, y no puede hacerlo: el catálogo
`AuditEventType` no tiene ningún valor aprobado para esta superficie, y crear uno
sería una decisión de dominio fuera de alcance (spec 017, límite conocido 4).

La corrección es de cliente y no escribe nada. La ausencia de auditoría de
lectura del worklist sigue siendo un residual declarado de MP01, no un efecto de
esta spec.

## 10. Seguridad

**Amenaza que cierra:** una respuesta manipulada, truncada o servida por un
intermediario puede hoy hacer que la interfaz afirme que una visita está
pendiente de preparación institucional, o que una agenda de otro periodo es la
del periodo pedido. Ninguna de las dos afirmaciones tiene origen en el servidor.

**Controles aplicados:** denegación por defecto en la lectura del cuerpo; ningún
repliegue a datos demostrativos; ningún dato parcial; el desenlace de fallo no
revela código HTTP, ruta ni capa técnica.

**Privacidad:** sin cambios. No se añade ningún dato al contenido visible.

**Secretos:** ninguno. Esta spec no toca configuración, entorno ni credenciales.

**Amenaza que NO cierra:** esta corrección no autentica la respuesta. Un canal
comprometido que devuelva un cuerpo bien formado y coherente con la ventana
solicitada seguiría siendo indistinguible de uno legítimo. La defensa de esa
amenaza es el transporte, no el normalizador.

## 11. Referencia visual

**Ninguna, y es deliberado.** `prototype-claude/Eligeme-Profesional.dc.html`
sigue siendo la referencia de composición de MP02, pero esta spec **no cambia
nada visible** cuando la respuesta es correcta. El único efecto observable es que
más respuestas incorrectas terminan en el estado de fallo que MP02 ya diseñó y
que ya tiene copy de producto.

El prototipo es de solo lectura (`CLAUDE.md` §6). Esta spec no lo toca.

## 12. Archivos permitidos

Exactamente dos:

- `apps/web/src/features/visitador/visitadorWorklistClient.ts`
- `apps/web/src/features/visitador/visitadorWorklistClient.test.ts`

Tocar un tercero bloquea el paquete y obliga a detenerse.

## 13. Archivos prohibidos

Todo lo demás. En particular, y sin que la lista sea exhaustiva:

- `apps/web/src/features/visitador/VisitadorExperience.tsx`,
  `visitador.module.css`, `visitadorExperience.test.tsx` y
  `apps/web/src/app/visitador/page.tsx` — los otros cuatro archivos de MP02;
- `apps/web/src/features/hospital/**` — los clientes reutilizados por
  importación;
- `apps/web/vitest.config.mts`, `apps/web/package.json`, `package.json` y
  `package-lock.json` — tocarlos sería introducir la dependencia DOM que B3 y B4
  necesitan y que **no** está aprobada;
- `apps/api/**`, `prisma/**`, `infra/**`, `tools/**`;
- `prototype-claude/**` (`CLAUDE.md` §6);
- `tasks/**` y `reviews/**`, congelados (`CLAUDE.md` §14.1);
- `spec/specs/017-worklist-del-visitador/**`, salvo la anotación de cierre que
  esta spec deje cuando se complete, y que es documentación, no código.

## 14. Dependencias

**Internas:** spec 017 (la ruta y su contrato de respuesta), spec 013
(`hospitalVisitsClient.ts`, del que este cliente delega el detalle) y spec 014
(`hospitalHumanSessionClient.ts`). Ninguna se modifica.

**De paquetes:** ninguna nueva. La suite focal corre con el `vitest` ya instalado
y con `environment: 'node'`, que es suficiente porque estas dos correcciones son
funciones puras de normalización y una función de transporte con `fetch`
inyectado.

**De datos o migraciones:** ninguna.

**Orden de ejecución:** B1 y B2 son independientes entre sí; ambas preceden a la
verificación.

**Dependencia abierta y bloqueante — dónde se implementa.** Los dos archivos
permitidos **no existen en `develop`**: viven solo en
`wip/visitador-mp02-20260825`. Esta spec **no** decide sobre qué rama se
corrigen, porque modificar la rama WIP y integrar MP02 en `develop` están ambos
fuera de su alcance por decisión expresa del Product Owner. Ver «Qué falta para
poder implementar».

## Escenarios de aceptación

1. Dada una respuesta correcta con `visit: null` en una fila, cuando el cliente
   la normaliza, entonces la fila se conserva y la interfaz la muestra como
   `Pendiente de preparación por la institución`, igual que hoy.
2. Dada una respuesta en la que una fila **no trae** la propiedad `visit`, cuando
   el cliente la normaliza, entonces la lectura completa se descarta, no se
   muestra ninguna fila y la persona recibe el desenlace de servicio no
   disponible con opción de reintentar.
3. Dada una respuesta en la que `visit` viene mal formado —sin `homeVisitId`, con
   `status` fuera de los cuatro del contrato, con `version` no numérica, con
   instante inválido o como valor no-objeto—, cuando el cliente la normaliza,
   entonces ocurre lo mismo que en el escenario 2.
4. Dada una ventana invertida, cuando se solicita la agenda, entonces el cliente
   la rechaza **sin llamar al servidor** y devuelve solicitud inválida.
5. Dada una ventana de más de 31 días, cuando se solicita la agenda, entonces el
   cliente la rechaza sin llamar al servidor; y dada una de exactamente 31 días,
   la acepta.
6. Dada una respuesta cuya `window` no coincide exactamente con la solicitada
   —en `from`, en `to` o en ambos—, cuando el cliente la normaliza, entonces la
   lectura se descarta con el desenlace seguro y **no** se muestra la agenda
   recibida.
7. Dada una respuesta correcta cuya ventana coincide con la pedida, cuando el
   cliente la normaliza, entonces el resultado es idéntico al de hoy: mismo
   orden, mismos campos, misma minimización, ningún campo nuevo.
8. Dadas las 78 pruebas focales existentes de MP02, cuando se ejecutan tras las
   correcciones, entonces todas pasan sin modificar ninguna aserción salvo las
   que estas correcciones vuelvan obsoletas, y toda modificación así queda
   justificada en el handoff.

## 15. Criterios de aceptación (formato EARS recomendado)

- CUANDO una fila traiga `visit: null` explícito, EL SISTEMA DEBERÁ conservarla y
  tratarla como cita no materializada.
- SI una fila no trae la propiedad `visit`, ENTONCES EL SISTEMA DEBERÁ tratar la
  respuesta completa como inválida y NO DEBERÁ mostrar esa fila como pendiente de
  preparación institucional.
- SI `visit` está presente pero no cumple el contrato, ENTONCES EL SISTEMA DEBERÁ
  tratar la respuesta completa como inválida.
- CUANDO una respuesta resulte inválida, EL SISTEMA DEBERÁ descartar la lectura
  entera, NO DEBERÁ mostrar filas parciales y NO DEBERÁ recurrir a datos
  demostrativos.
- CUANDO se solicite una ventana invertida o mayor de 31 días, EL SISTEMA DEBERÁ
  rechazarla sin emitir petición de red.
- CUANDO el servidor devuelva una ventana distinta de la solicitada, EL SISTEMA
  DEBERÁ tratar la respuesta como inválida.
- EL SISTEMA NO DEBERÁ, por efecto de esta spec, cambiar texto visible,
  disposición, orden, minimización ni conjunto de desenlaces.
- EL SISTEMA NO DEBERÁ añadir dependencias, tocar backend, tocar la experiencia
  ni tocar archivos fuera de los dos permitidos.

## Requisitos

- Los ocho requisitos funcionales de la sección 6.
- El límite de dos archivos de la sección 12.
- Las pruebas de la sección 16.

## 16. Pruebas requeridas

Unitarias y de contrato de cliente, en
`apps/web/src/features/visitador/visitadorWorklistClient.test.ts`:

1. `visit: null` explícito produce fila conservada con `visit === null`.
2. `visit` **ausente** invalida la respuesta completa. Es la prueba que hoy no
   existe y que distingue B1 de lo ya cubierto.
3. Los cuerpos mal formados que hoy ya se rechazan siguen rechazándose
   (regresión de los once casos existentes).
4. Ventana invertida rechazada sin llamada de red (regresión).
5. Ventana de 32 días rechazada sin llamada de red; ventana de 31 días aceptada
   (regresión).
6. Ventana devuelta distinta de la pedida en `from`, en `to`, y en ambos:
   tres casos, los tres invalidan la respuesta.
7. Ventana devuelta idéntica a la pedida: la respuesta se acepta y el resultado
   es el de hoy.

**No requeridas y explícitamente no autorizadas por esta spec:** pruebas de DOM,
interacción, foco, teclado, accesibilidad automática, navegador, visual y
end-to-end. Son B3, B4 y B5, y siguen pendientes.

**Verificación de cierre**, con salida reportada:

```
npx vitest run --root apps/web src/features/visitador/visitadorWorklistClient.test.ts src/features/visitador/visitadorExperience.test.tsx
npm run typecheck --workspace @merdn/web
npx eslint apps/web/src/features/visitador/visitadorWorklistClient.ts apps/web/src/features/visitador/visitadorWorklistClient.test.ts
git diff --check
git status --short
./spec/scripts/check-sdd-gate.sh .
./spec/scripts/validate-sdd.sh . --strict
```

Las dos suites de MP02 se ejecutan juntas a propósito: la de experiencia no se
modifica, y sirve para demostrar que la corrección no la rompió.

## 17. Decisiones aprobadas

1. **Alcance limitado a B1 y B2.** Product Owner, 2026-08-25,
   `spec/bitacora/decisiones/2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md`.
2. **Vía B: spec nueva y acotada** en vez de aprobar la spec 017 completa.
   Product Owner, 2026-08-25, misma sesión.
3. **Fail-closed sobre respuesta completa**, no omisión de la fila defectuosa.
   Heredada del diseño de MP02, que ya lo aplica en `normalizarWorklist:370-374`
   con el comentario «una fila ilegible invalida la respuesta; no se omite».
4. **Sin dependencias nuevas.** Product Owner, 2026-08-25: la decisión sobre
   entorno DOM quedó explícitamente pendiente.
5. **Sin cambios de backend, API, base de datos ni diseño.** Product Owner,
   2026-08-25.

## 18. Decisiones fuera de alcance

No deben inferirse, ni implementarse, ni prepararse «para después»:

- **B3** pruebas de DOM e interacción real;
- **B4** foco y accesibilidad;
- **B5** verificación de navegador, ejecución y visual;
- la dependencia de entorno DOM y la ampliación de allowlist que B3 y B4
  requieren;
- la **integración de `wip/visitador-mp02-20260825` en `develop`**, que sigue con
  `SAFE TO INTEGRATE INTO DEVELOP: NO`;
- la aprobación de la spec 017;
- todo el hardening recomendado de la spec 017: evento de auditoría de lectura,
  paginación, límite de tasa, zona institucional, desambiguación de `visit: null`
  en el servidor y unificación de la condición de autorización duplicada;
- MP03 y cualquier transición profesional;
- cualquier cambio de diseño, texto de producto o dirección visual.

## Ámbito de archivos / File scope

- `apps/web/src/features/visitador/visitadorWorklistClient.ts` — normalización y
  transporte del worklist
- `apps/web/src/features/visitador/visitadorWorklistClient.test.ts` — suite focal
  del cliente

## Qué falta para poder implementar

Tres cosas, en este orden. Ninguna la puede ejecutar Claude Code.

**1. Aprobación de esta spec. — HECHO el 2026-08-25.** `Estado / Status` está en
`Aprobado`, con fecha real, aprobador y evidencia. El gate falla si una spec
aprobada conserva los marcadores de la plantilla en fecha, aprobador o evidencia;
aquí los tres están sustituidos.

**2. Consentimiento por spec. — PENDIENTE.** Ejecutado por el Product Owner:

```
./spec/scripts/confirm-user-consent.sh --spec 018-correcciones-visitador-mp02 "User approved implementation for spec 018-correcciones-visitador-mp02"
```

Hasta que ese comando se ejecute, el gate **falla** con
`018-correcciones-visitador-mp02 approved but no user consent recorded for it`:
una spec aprobada sin consentimiento es un error, no una compuerta abierta. Con
el consentimiento registrado, la compuerta abre para esta spec y solo para esta
spec.

**3. Decisión de rama — STOP CONDITION abierta.** Los dos archivos permitidos no
existen en `develop`. Modificar `wip/visitador-mp02-20260825` e integrarla en
`develop` están ambos fuera de alcance por decisión expresa. Sin una tercera
respuesta, la spec queda aprobada y sin lugar donde ejecutarse. Alternativas, con
su tradeoff, sin que ninguna esté elegida:

| Alternativa | Qué implica | Coste |
|---|---|---|
| Rama de trabajo nueva derivada de `wip/visitador-mp02-20260825` | Se corrige donde el código vive; la rama WIP original queda intacta | Añade una cuarta rama WIP; la corrección sigue fuera de `develop` |
| Rama derivada de `develop` que primero traiga los seis archivos de MP02 | Deja la corrección en la línea de integración | Es integrar MP02 de facto, hoy prohibido por el veredicto y fuera de alcance |
| Commit directo sobre `wip/visitador-mp02-20260825` | Es lo más simple | Modifica la rama WIP, hoy prohibido |

**Recomendación técnica de Claude Code, marcada como recomendación:** la primera.
Es la única que corrige donde el código existe sin tocar la rama preservada ni
adelantar una integración que el veredicto bloquea. La decisión es del Product
Owner.

## Criterios de éxito

- Una respuesta sin `visit` deja de mostrarse como pendiente de preparación
  institucional y pasa al desenlace de servicio no disponible.
- Una ventana devuelta distinta de la pedida deja de mostrarse como la agenda del
  periodo solicitado.
- `visit: null` explícito sigue comportándose exactamente igual que hoy.
- Las 78 pruebas focales existentes siguen pasando.
- Las pruebas nuevas de la sección 16 pasan.
- Typecheck y ESLint acotado pasan.
- El diff toca exactamente dos archivos.
- Cero dependencias nuevas, cero cambios de backend, cero cambios visuales y cero
  archivos fuera de la allowlist.
- B3, B4 y B5 siguen abiertas y sin tocar al terminar.
