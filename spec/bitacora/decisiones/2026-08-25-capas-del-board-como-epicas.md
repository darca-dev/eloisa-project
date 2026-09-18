# Decisión importante — Las capas del board son épicas, no grupos de JSON Canvas

## Fecha

2026-08-25

## Contexto

El board (`spec/specs/board.canvas`) se construyó con las 17 specs as-built
dispuestas por capas de dependencia. Las capas se modelaron como nodos
`{"type": "group", "label": "Capa N · Nombre"}`, que es la forma que define el
estándar JSON Canvas para un contenedor con título.

Al abrir el builder, las nueve capas aparecieron como tarjetas **`IDEA (vacío)`**,
sin título.

Diagnóstico medido el 2026-08-25 creando una tarjeta desde el propio builder y
leyendo lo que escribió en disco:

```json
{ "id": "note-6a31791a", "type": "text", "text": "Idea nueva", "color": "#eab308" }
```

Y así habían quedado los nodos de capa tras cargarlos:

```json
{ "id": "grupo-fundacion", "type": "text", "text": "" }
```

**El builder no soporta `type: "group"`.** Al leer el canvas normaliza ese tipo a
`text` y descarta `label`, porque el texto de una tarjeta lo toma del campo
`text`. El título no se perdió al escribirlo: se perdió al cargarlo.

Los nodos `type: "file"` de las specs nunca tuvieron el problema: su título sale
del primer encabezado `# Especificación NNN - Título` del `spec.md`, no del nodo.

## Decisión

**Las capas se modelan como nodos `type: "text"` con su nombre en el campo
`text`, dispuestos como rótulo a la izquierda de cada carril.**

El builder las clasifica automáticamente como **Épica**, que es la semántica
correcta: agrupan specs relacionadas sin ser una spec en sí mismas.

Consecuencias de forma que se derivan de esto:

1. El texto de una tarjeta **no admite markdown**: un `##` inicial se muestra
   literal. Los rótulos van en texto plano.
2. Un nodo `text` no es un contenedor. Las capas dejan de envolver a sus specs y
   pasan a rotular carriles horizontales, con las specs de cada capa en fila.
3. Las 27 aristas de dependencia se conservan, con `fromSide: bottom` y
   `toSide: top`, coherente con el flujo vertical entre capas.

## Alternativas consideradas

**Conservar `type: "group"` y añadir además `text`.** Rechazada. El builder
reescribe el nodo como `text` en cuanto guarda, de modo que el `group` no
sobrevive a la primera edición desde la interfaz y quedaría un formato que solo
es correcto mientras nadie toque el board.

**Quitar las capas y dejar solo las 17 specs.** Rechazada. El orden por capas de
dependencia es la información más útil del board: sin él, 17 tarjetas y 27
aristas no se leen.

## Consecuencias

Las nueve capas muestran título y recuento de specs. Verificado en el builder el
2026-08-25: nueve rótulos con texto, cero vacíos, cero almohadillas literales, y
las 17 tarjetas de spec con su título extraído del `spec.md`.

Trade-off aceptado: al no ser contenedores, nada impide que alguien mueva una
tarjeta de spec fuera de su carril y el rótulo deje de describir lo que tiene al
lado. La disposición es convención, no restricción.

## Cuándo revisar esta decisión

- Si una versión futura del builder soporta `type: "group"`: entonces las capas
  pueden volver a ser contenedores reales y esta decisión queda superada.
- Si el builder pasa a renderizar markdown en el texto de una tarjeta: el punto 1
  deja de aplicar.
- Si se añaden specs nuevas: hay que colocarlas en el carril de su capa, o el
  board deja de reflejar las dependencias.

## Registros relacionados

Extiende `2026-08-25-adopcion-sdd-sidecar.md`.
