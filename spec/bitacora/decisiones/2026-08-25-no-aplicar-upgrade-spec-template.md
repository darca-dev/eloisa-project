# Decisión importante — No aplicar `sdd-mcp upgrade` sobre `spec/specs/_template/spec.md`

## Fecha

2026-08-25

## Contexto

El mismo día de instalar el sidecar SDD se ejecutó su diagnóstico de
actualización, que reportó un archivo de MERDN como divergente:

```
TUYO, intacto / yours, untouched  specs/_template/spec.md
Estos archivos son TUYOS y difieren de la versión nueva. No se tocaron.
Para adoptar la versión nueva de alguno (perderás tus cambios en él):
  sdd-mcp upgrade --apply specs/_template/spec.md
```

El mensaje sugiere que alguien editó ese archivo en este repositorio. **No es
cierto.** Verificado el 2026-08-25: `spec/specs/_template/spec.md` es byte a byte
idéntico al que dejó el instalador. Nadie en MERDN lo tocó.

Comprobado también el contenido de la diferencia. El archivo que MERDN tiene
conserva la sección de evidencia de aprobación **con sus instrucciones** —qué se
aprobó, con qué alcance, contra qué documento, y la indicación explícita de no
transcribir el chat—. Lo que la herramienta ofrece como «versión nueva» es una
variante anterior, de una sola línea y sin guía.

De los archivos de plantilla instalados bajo `spec/`, este es el único que el
diagnóstico reporta como divergente.

## Decisión

**No se aplica. El archivo se conserva tal cual.**

Aplicarlo sería un retroceso: dejaría la plantilla de MERDN sin la guía de
evidencia de aprobación, justo en el campo que `spec/scripts/check-sdd-gate.sh`
exige no vacío para abrir la compuerta (`CLAUDE.md` §14.4). Sin esa guía, el
campo es fácil de rellenar transcribiendo una conversación, que es exactamente
lo que `CLAUDE.md` §14.3 no admite como evidencia suficiente.

## Alternativas consideradas

**Ejecutar `--apply`.** Rechazada por lo anterior: pierde contenido útil y
debilita el control de aprobación de este repositorio.

**Editar el archivo para silenciar el aviso.** Rechazada. Convertiría en real la
premisa falsa del mensaje —que MERDN editó la plantilla— y haría que futuros
diagnósticos ya no puedan distinguir una edición nuestra de una deriva de la
herramienta.

## Consecuencias

La plantilla de MERDN conserva la versión más completa y la compuerta sigue
exigiendo evidencia de aprobación con criterio claro.

Trade-off aceptado: el diagnóstico seguirá listando este archivo en cada
ejecución. Es ruido conocido y benigno, pero recurrente, y quien lo vea sin este
registro puede aplicarlo por error. De ahí este archivo.

No afecta a ninguna spec de MERDN ni a ningún código de producto. Solo a
`spec/specs/_template/spec.md`.

## Cuándo revisar esta decisión

- Cuando se instale una versión posterior del sidecar: repetir el diagnóstico y
  comprobar si la divergencia desapareció. Si desapareció, este registro queda
  cerrado.
- Si un diagnóstico futuro reporta archivos distintos de
  `spec/specs/_template/spec.md`: son casos nuevos, hay que analizarlos por
  separado y no asumir que aplica esta decisión.
- Si alguien edita deliberadamente `spec/specs/_template/spec.md` en MERDN:
  entonces sí será un archivo nuestro de verdad y este registro debe actualizarse
  para decirlo.

## Registros relacionados

Extiende `2026-08-25-adopcion-sdd-sidecar.md`, que instaló el sidecar cuyo
diagnóstico produjo este hallazgo.
