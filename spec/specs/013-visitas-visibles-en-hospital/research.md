# Investigación 013 - Visitas domiciliarias visibles en el shell Hospital

Medido sobre `develop` el 2026-08-25. Cada hallazgo lleva el comando o la ruta
que lo respalda. Lo que no se pudo comprobar está en R14.

## R1. La capacidad son cuatro commits, y solo dos escriben código

`cat spec/specs/013-visitas-visibles-en-hospital/history.md` y
`git show --stat`:

- `6aa1a3e` y `ac83d13` añaden las dos Task Specifications (1 archivo cada uno);
- `0e5d183` (2026-08-24 16:04) crea el cliente: 3 archivos, 935 líneas añadidas,
  0 borradas — `hospitalVisitsClient.ts` (389), su prueba (545) y una línea en
  `hospitalAlcance.test.ts`;
- `31cd54c` (2026-08-24 20:37) conecta la interfaz: 7 archivos, 1316 añadidas y
  104 borradas.

No hay ningún archivo de `apps/api`, `prisma/` ni `packages/` en ninguno de los
cuatro. La capacidad es enteramente de frontend.

## R2. No existe auditoría de esta capacidad

`ls reviews/` devuelve 22 archivos: README, plantilla, REVIEW-001, REVIEW-001-FINAL,
REVIEW-002-FINAL, REVIEW-003H-01 a 07, cuatro de Alcaldía más la demo,
REVIEW-BRAND-01-FINAL, REVIEW-MERDN-ORCHESTRATOR-V1-FINAL y
REVIEW-MVP-CORE-01-FINAL. Ninguno nombra `HOSPITAL-VISITS`. Es una capacidad
implementada sin auditoría archivada.

## R3. El servidor que se consume ya existía

`grep -E "@(Controller|Get|Post|Patch|UseGuards)" apps/api/src/visits/visits.controller.ts`:

```
127  @Controller(VISITS_MATERIALIZE_PATH)          -> 'api/v1/visits'
140  @UseGuards(HospitalSchedulerGuard, InstitutionalSameOriginGuard)
149  @Post('materialize')
255  @Controller(PROFESSIONAL_VISITS_PATH)         -> 'api/v1/professional/visits'
265  @UseGuards(HumanSessionGuard)
283  @Get()                                        <- worklist, spec 017
352  @Get(':visitId')
404  @Patch(':visitId/status')
411  @UseGuards(SameOriginGuard)
```

`git show -s 62e3147` fecha la exposición de MP04 el 2026-08-24 15:49, quince
minutos antes del cliente. La cronología del expediente encaja.

## R4. Las tres rutas del cliente coinciden exactamente con el servidor

`hospitalVisitsClient.ts:120-130` declara `/api/v1/visits/materialize`,
`/api/v1/professional/visits/:visitId` y `.../status`, con
`encodeURIComponent` sobre el identificador (`:127`, `:129`). No hay una cuarta.

## R5. Los cuerpos no llevan ningún campo de autoridad

`hospitalVisitsClient.ts:338`: `JSON.stringify({ appointmentId })`.
`hospitalVisitsClient.ts:385`: `JSON.stringify({ status, expectedVersion })`.
`grep -n "tenantId\|professionalId\|patientId" apps/web/src/features/hospital/hospitalVisitsClient.ts`
no devuelve ninguna línea de código: los nombres solo aparecen en los
comentarios que explican por qué no viajan (`:15-19`, `:327-328`, `:371-374`).

## R6. Reglas declaradas en la cabecera del cliente, comprobadas en el código

La cabecera (`hospitalVisitsClient.ts:3-38`) enumera cinco reglas. Las cinco se
verifican en el propio archivo:

| Regla | Dónde se cumple |
|---|---|
| No envía tenant, institución, paciente, profesional, actor, rol ni instante | `:338`, `:385` (cuerpos literales) |
| No contiene credenciales; `credentials: 'include'` | `:260` |
| No guarda nada y pide `cache: 'no-store'` | `:265` |
| Nunca lanza: devuelve desenlace tipado | `:279-314`, `try/catch` en `:287` y `:309` |
| Sin repliegue a `hospitalVisitsConfig.ts` | el archivo no lo importa; comprobado por `hospitalVisitsClient.test.ts:533-544` |

## R7. Traducción de estados: cinco explícitos, el resto colapsa

`hospitalVisitsClient.ts:234-249` mapea 400, 401, 403, 404 y 409. Todo lo demás
devuelve `null` y `operar()` lo resuelve: `!response.ok` → `no-disponible`
(`:305`), excepción de red → `no-disponible` salvo aborto (`:289-293`), JSON
ilegible → `no-disponible` (`:311`). `503` no aparece nombrado: cae por el
camino genérico, que es lo que la Task pedía.

## R8. La condición de la Agenda es exactamente la que MP04 admite

`HospitalAgenda.tsx:132`:

```ts
export function esCitaMaterializable(cita: HospitalCitaAgendaDto): boolean {
  return cita.modality === 'HOME' && cita.status === 'ASSIGNED';
}
```

El DTO viene de la API real (`hospitalAgendaClient.ts:51-52`, `status` es
`'REQUESTED' | 'ASSIGNED' | 'CANCELLED'`). El botón además exige controlador:
`HospitalAgenda.tsx:428` no dibuja nada si `onMaterializar === undefined`, de
modo que una Agenda montada suelta no insinúa la acción.

## R9. El transporte de la visita es estado local del shell, y nada más

`HospitalShell.tsx:434` — `useState<HospitalVisitaMaterializadaDto | null>(visitaInicial)`.
`:716-726` — el shell guarda el DTO real y navega a `{ vista: 'visitas' }`.
`:191` — `<HospitalHomeVisits visita={visita} />`.

`grep -n "fetchImpl" apps/web/src/features/hospital/HospitalShell.tsx` devuelve
361, 409, 472, 496, 541, 588: **ninguna** de esas líneas está en
`HospitalContenido`. El `fetchImpl` del shell alimenta solo a sus clientes de
sesión; Agenda y Visitas usan el `fetch` global en producción.

`apps/web/src/app/hospital/page.tsx:25` monta `<HospitalShell />` sin
propiedades: en la aplicación real `visitaInicial` es siempre `null`.

## R10. La vista falla cerrado y conserva el hecho real

`HospitalHomeVisits.tsx:686-689`:

```ts
const autorizada = hayAccionesProfesionales(consulta);
const estadoVisible = consulta !== null && consulta.kind === 'ok' ? consulta.datos.status : visita.status;
const acciones = autorizada ? accionesDeVisita(estadoVisible) : [];
```

`hayAccionesProfesionales` (`:283-287`) devuelve `true` solo con `kind === 'ok'`;
`null` —consulta aún sin responder— también es `false`. La guarda se repite
antes de tocar la red en `transicionar` (`:538`).

`accionesDeVisita` (`:247-260`) nunca ofrece `SCHEDULED` como destino y devuelve
lista vacía en los dos estados terminales.

## R11. Lo que NO se conectó, medido

- **Inicio sigue siendo demostrativo con datos de visitas.**
  `grep -rn "hospitalVisitasDemo" apps/web/src` devuelve, además de las pruebas:
  `hospitalDashboardOperacion.ts:15` (import) y `:193`
  (`hospitalVisitasDemo.visitas.find(...)`), dentro de `componerAgendaProxima()`
  (`:189`), que alimenta `hospitalInicioDemo.agenda.items`. Nombres, zonas y
  profesionales ficticios siguen visibles en el Inicio del Hospital.
- **CSS huérfano.** `hospitalVisits.module.css` define `.fecha`, `.textos`,
  `.paciente`, `.zona`, `.profesional` y `.estado`;
  `grep -n "styles\." apps/web/src/features/hospital/HospitalHomeVisits.tsx`
  devuelve una sola línea, la 310, con `styles.estado`.
- **Sin reintento.** `grep -n "reintent\|Reintent\|Actualizar\|Refrescar"` sobre
  `HospitalHomeVisits.tsx` devuelve solo el comentario de la línea 567. No hay
  ningún control que permita repetir la consulta tras un `no-disponible`.
- **Mutaciones sin abort.** `HospitalHomeVisits.tsx:545-549` y
  `HospitalAgenda.tsx:721` llaman al cliente con `fetchImpl ?? fetch` y sin
  cuarto argumento: el `AbortSignal` opcional no se pasa. Solo la consulta `GET`
  (`:505`) lo lleva.
- **Repetir la preparación no reabre la visita.**
  `home-visit-materialization.service.ts:242-244` responde `409` con
  `HOME_VISIT_ALREADY_MATERIALIZED`. La Agenda lo traduce con
  `mensajeDeVisita` a «La visita cambió de estado…», que no describe ese caso y
  no ofrece salida.

## R12. El comentario del cliente ya no describe el servidor de hoy

`hospitalVisitsClient.ts:6-11` afirma: no hay listado, «el servidor no ofrece
esa operación». `git log --format="%h %ad %s" -- apps/api/src/visits/professional-visit-worklist.service.ts`
devuelve `15a9ae1 2026-08-25 feat(visitador): add professional worklist api`, y
`visits.controller.ts:283` declara `@Get()` sobre
`api/v1/professional/visits`. El listado existe desde el día siguiente al de
esta capacidad. `grep -rln "professional/visits" apps/web/src` solo devuelve
`hospitalVisitsClient.ts` y su prueba: Hospital no lo consume, y la Task
`VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md` prohíbe expresamente tocar
Hospital (líneas 100, 114, 149). El comentario es cierto en su intención —esta
superficie no enumera— pero falso sobre el servidor.

## R13. Cobertura: 94 pruebas del ámbito, ninguna con DOM real

- `hospitalVisitsClient.test.ts`: 32 `it(`. Cubre rutas exactas, cuerpos,
  `credentials`/`no-store`, los cinco códigos mapeados, red, aborto, JSON
  ilegible, ausencia de campos de autoridad y cero repliegue.
- `hospitalOperaciones.test.tsx`, bloques T-10A a T-10G (líneas 151-639): 44
  `it(`.
- `hospitalAgenda.test.tsx`, bloques T-A8 y T-A9 (líneas 640-767): 11 `it(`.
- `hospitalShell.test.tsx`, bloque T-H16 (líneas 960-1032): 7 `it(`.

La estrategia está declarada en `hospitalOperaciones.test.tsx:46-55`: el
repositorio **no incluye jsdom** y estas Tasks no autorizaban dependencias
nuevas, de modo que se usa `renderToStaticMarkup`, que **no ejecuta efectos**.
Consecuencia medible: una parte de las garantías se comprueba leyendo el TEXTO
del archivo fuente. Ejemplos literales:

```ts
// hospitalOperaciones.test.tsx:559-566
expect(CODIGO).toContain('if (enviando !== null');
expect(CODIGO).toContain('new AbortController()');
// hospitalShell.test.tsx:1003-1007
expect(CODIGO).toContain('setVisita(materializada)');
expect(CODIGO).toContain("navegar({ vista: 'visitas' })");
```

Es una comprobación de forma, no de conducta: si el código se reescribiera de
manera equivalente pero distinta, la prueba fallaría sin haber un defecto; y si
la conducta fallara conservando el texto, la prueba pasaría. Clic efectivo,
foco, teclado y verificación automática de accesibilidad no están cubiertos.

Detalle adicional: `HospitalHomeVisits.tsx:494` corta el efecto cuando
`consultaInicial !== null`, que es precisamente el modo en que las pruebas
inyectan desenlaces. El camino de relectura tras `setRefresco` solo se ejecuta
con la red real, y por eso se verifica leyendo el código.

## R14. Verificación no ejecutada

- **Ninguna prueba se corrió.** `ls node_modules` y `ls apps/web/node_modules`
  devuelven «No such file or directory». Los comandos focales de las dos Tasks
  (`npx vitest run --config apps/web/vitest.config.mts …` y
  `npx vitest run --root apps/web …`) no se pudieron ejecutar. No se afirma que
  ninguna prueba pase: se afirma que existen y qué comprueban por lectura.
- **No se ejecutó ninguna llamada real a la API.** PostgreSQL no está levantado
  y la API no está en marcha, de modo que la correspondencia entre los DTO
  declarados en `hospitalVisitsClient.ts:78-114` y las respuestas reales de
  `visits.controller.ts` se verificó comparando código, no tráfico.
- **No se verificó el render en navegador.** Sin jsdom ni entorno gráfico no se
  comprobó foco, orden de tabulación, contraste de la insignia de estado ni el
  anuncio efectivo de la región `aria-live`.
- **No se auditó `SameOriginGuard` en despliegue.** Que las mutaciones exijan un
  origen configurado se leyó en `visits.controller.ts:140` y `:411`; no se
  comprobó la configuración de ningún entorno real.
- **No se revisó el prototipo visual.** `prototype-claude/` está fuera del
  ámbito de esta spec y no se abrió.
