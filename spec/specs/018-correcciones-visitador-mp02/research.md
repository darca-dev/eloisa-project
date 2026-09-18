# Investigación 018 - Correcciones B1 y B2 de Visitador MP02

Medido el 2026-08-25 sobre `wip/visitador-mp02-20260825`
(`cffbf6bd7b5e19a4fb712467e928f92698b18b99`), **en solo lectura**: todo lo que
sigue se obtuvo con `git show <rama>:<ruta>`, sin `checkout`, sin modificar la
rama y sin integrarla. Cada hallazgo indica cómo se comprobó.

## Hallazgos

### R1. `normalizarVisita` confunde «ausente» con «`null` explícito»

`git show wip/visitador-mp02-20260825:apps/web/src/features/visitador/visitadorWorklistClient.ts`

Líneas 281-284:

```ts
function normalizarVisita(valor: unknown): VisitadorVisita | null | undefined {
  if (valor === null || valor === undefined) {
    return null;
  }
```

El comentario inmediatamente anterior (`:273-280`) declara la intención
correcta —«Devuelve `undefined` —y NO `null`— cuando la forma es inválida:
`null` es un valor con significado propio en este contrato»— y el código no la
cumple para el caso de la propiedad ausente.

`normalizarCita:320` desestructura `const { ..., visit } = valor`, de modo que
una fila sin la propiedad produce `visit === undefined` y entra por la primera
rama. Resultado: una respuesta a la que le falte `visit` se normaliza a
`visit: null`, y `VisitadorExperience` la pinta como
`Pendiente de preparación por la institución`.

**El caso mal formado sí funciona.** `:286-301` rechaza el no-objeto y valida
`homeVisitId`, `status` contra los cuatro del contrato, `version` numérica
finita, `startedAt`/`endedAt` opcionales y `updatedAt`. Solo falla la ausencia.

### R2. La ventana de salida se valida; la de entrada no

`esVentanaValida:240-249` rechaza forma inválida, fecha inexistente, ventana
invertida (`ventana.from > ventana.to`) y ventana mayor de 31 días
(`Math.floor(diferencia / MS_POR_DIA) + 1 <= 31`, es decir 31 inclusive).
`consultarWorklistProfesional:428` la invoca **antes** de salir a la red y
devuelve `solicitud-invalida` sin llamar al servidor.

En la entrada, `normalizarWorklist:356-380` solo comprueba
`esDiaValido(from) && esDiaValido(to)` (`:361-364`). No compara con la ventana
solicitada, y no puede: no la recibe. La llamada de `:468` es
`normalizarWorklist(cuerpo)`, sin segundo argumento.

Consecuencia: una respuesta bien formada pero de otro periodo se acepta y se
muestra como la agenda del periodo pedido.

### R3. El servidor sí devuelve la ventana pedida, así que la igualdad es exigible

`apps/api/src/visits/professional-visit-worklist.service.ts:166-170` (spec 017)
devuelve `{ window, items }` con la ventana **exactamente como se pidió, sin
ampliarla ni recortarla**. Es el escenario de aceptación 1 de la spec 017.

Por tanto la igualdad literal es la comprobación correcta: no hace falta
tolerancia ni normalización en el cliente. Si algún día el servidor normalizara
la ventana, sería un cambio de contrato y una STOP CONDITION, no un motivo para
relajar el cliente.

### R4. El camino de fallo ya existe y ya tiene copy de producto

`normalizarWorklist:370-374` ya aplica fail-closed sobre la fila ilegible, con el
comentario «una fila ilegible invalida la respuesta; no se omite».
`consultarWorklistProfesional:470` traduce `null` a `{ kind: 'no-disponible' }`, y
`MENSAJES` (`:158-170`) tiene el texto de producto correspondiente, sin código
HTTP, sin ruta y sin lenguaje técnico.

Las dos correcciones alimentan ese camino existente. No hay que diseñar estado,
texto ni pantalla nuevos, y por eso `VisitadorExperience.tsx` no está en la
allowlist.

### R5. Las 78 pruebas focales, contadas

```
git show wip/visitador-mp02-20260825:<suite> | grep -cE "^\s*(it|test)\("
```

| Suite | Bloques `it` | Expansión paramétrica | Casos |
|---|---|---|---|
| `visitadorWorklistClient.test.ts` | 23 | 5 ventanas inválidas, 7 desenlaces de estado, 11 cuerpos inválidos | 43 |
| `visitadorExperience.test.tsx` | 30 | 6 desenlaces de fallo | 35 |
| **Total** | 53 | | **78** |

Las cinco ventanas inválidas incluyen la invertida (`2026-08-25` → `2026-08-24`)
y una de 32 días (`2026-08-01` → `2026-09-01`), y hay una prueba dedicada a que
la ventana máxima de 31 días se admita. **B2 ya está probada en su parte de
salida.**

Ninguna prueba cubre `visit` ausente ni ventana devuelta distinta de la pedida.
Ese es exactamente el hueco de esta spec.

**Contadas, no ejecutadas.** En este repositorio no se ha corrido ninguna suite
de MP02.

### R6. El entorno de pruebas actual basta para B1 y B2, y no para B3 ni B4

`apps/web/vitest.config.mts:28` fija `environment: 'node'`, y su propio
comentario explica por qué: «Las pruebas renderizan los componentes de servidor
con `react-dom/server`, de modo que no se requiere jsdom ni una librería de
testing adicional». No hay `jsdom`, `happy-dom` ni `@testing-library/*` en
`node_modules` ni en ningún `package.json`.

B1 y B2 son funciones puras más una función de transporte con `fetch` inyectado:
la suite existente ya las ejercita sin DOM. B3 y B4 necesitan DOM real y por eso
siguen bloqueadas por una decisión de dependencia.

### R7. Los archivos permitidos no existen en `develop`

```
git ls-tree -r develop --name-only | grep -i visitador
```

Devuelve nueve rutas: `apps/web/src/features/inscripcion/steps/PasosVisitador.tsx`,
los cinco archivos de la spec 017 más su `contracts/README.md`, y las dos Task
Specifications de `tasks/`. **Ninguna es `apps/web/src/app/visitador/` ni
`apps/web/src/features/visitador/`.**

`PasosVisitador.tsx` pertenece al perfil «visitador médico» del flujo de
inscripción —specs 002 y 007— y no tiene relación con esta superficie
(spec 017, límite conocido 14).

Los seis archivos de MP02, incluidos los dos de la allowlist de esta spec, viven
solo en `wip/visitador-mp02-20260825`. Es el hallazgo que convierte «dónde se
implementa» en una decisión previa y no en un detalle de ejecución.

## Decisiones derivadas de los hallazgos

1. **La allowlist es de dos archivos, no de seis** (R1, R2, R4). El defecto está
   en el cliente y el camino de fallo ya existe: la experiencia, la hoja de
   estilos y la ruta no necesitan cambiar, así que se prohíben expresamente.
2. **Igualdad literal de ventana, sin tolerancia** (R3). El contrato del servidor
   la garantiza; relajarla en el cliente ocultaría precisamente el fallo que se
   quiere detectar.
3. **Fail-closed sobre la respuesta completa, no omisión de la fila** (R4). Se
   sigue el criterio que MP02 ya aplica, para no introducir un segundo
   comportamiento ante datos ilegibles.
4. **Sin dependencias nuevas** (R6). El entorno actual basta; introducir una sería
   ejecutar de contrabando la habilitación de B3 y B4, que no están aprobadas.
5. **Dos de las tres reglas de B2 son regresión, no implementación** (R5). Se
   documenta así para que el handoff no presente como trabajo nuevo lo que ya
   estaba hecho.
6. **La rama de trabajo es una decisión previa del Product Owner** (R7). Esta
   spec no la toma y declara la STOP CONDITION en vez de elegir en silencio.
