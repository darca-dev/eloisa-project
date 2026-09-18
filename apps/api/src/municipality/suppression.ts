/**
 * Protección de grupos pequeños en los agregados municipales
 * (TASK-MUNICIPALITY-CORE-01, FR-15, OD-02, AC-7 y prueba T-08).
 *
 * Regla primaria aprobada, aplicada SIEMPRE en el servidor:
 * - `0`      se publica como conteo exacto;
 * - `1` a `4` NO se publica: se representa como `<5` con estado `SUPPRESSED`;
 * - `5` o más se publica como conteo exacto.
 *
 * La regla primaria por sí sola es insuficiente. Si un total exacto se publica
 * junto a sus partes y solo una de ellas queda suprimida, esa parte se
 * reconstruye restando. Por eso se aplica además una SUPRESIÓN COMPLEMENTARIA:
 * mientras exista un conteo sensible —de 1 a 4— que el sistema de ecuaciones
 * publicado determine de forma única, se suprime una celda agregada más.
 *
 * La comprobación es exacta, no heurística: cada celda publicada es la suma de
 * un conjunto de átomos, de modo que el conjunto de celdas exactas forma un
 * sistema lineal. Un átomo desconocido queda revelado exactamente cuando su
 * vector indicador pertenece al espacio de filas del sistema restringido a las
 * columnas desconocidas. La aritmética es racional exacta con `bigint`: no se
 * usa coma flotante, que podría declarar segura una celda que no lo es.
 *
 * ALCANCE DECLARADO: esta es una salvaguarda de PRODUCTO. No es un umbral legal
 * oficial colombiano y queda sujeta a la validación jurídica diferida en OD-05.
 * Protege una respuesta considerada en sí misma; no modela lo que un observador
 * podría deducir combinando respuestas tomadas en momentos distintos, riesgo
 * que se reporta como residual.
 */

/** Umbral aprobado: por debajo de este valor no se publica el conteo exacto. */
export const SUPPRESSION_THRESHOLD = 5;

/** Representación visible de un conteo suprimido. */
export const SUPPRESSED_DISPLAY = '<5';

/** Conteo publicado. Unión discriminada: el valor real 1–4 nunca se serializa. */
export type SuppressedCount =
  | { readonly status: 'EXACT'; readonly value: number; readonly display: string }
  | { readonly status: 'SUPPRESSED'; readonly value: null; readonly display: string };

/** Celda publicada: la suma de un conjunto de átomos disjuntos. */
export interface DisclosureCell {
  /** Clave estable de la celda dentro del sistema. */
  readonly key: string;
  /** Átomos que componen la celda. Un solo átomo describe una celda hoja. */
  readonly atoms: readonly string[];
}

/**
 * Sistema aditivo de una respuesta: los átomos con su conteo real y las celdas
 * que efectivamente se publican.
 *
 * Un átomo puede no publicarse en ninguna celda: entonces es una incógnita
 * permanente y, por tanto, una protección adicional.
 */
export interface DisclosureSystem {
  readonly atoms: ReadonlyMap<string, number>;
  readonly cells: readonly DisclosureCell[];
}

/**
 * Límite de tamaño del análisis exacto.
 *
 * Por encima de él se aplica un modo conservador que suprime toda celda
 * agregada que contenga un átomo sensible. Ese modo publica MENOS información,
 * nunca más: degradar hacia la prudencia es la única degradación admisible.
 */
const EXACT_ANALYSIS_MAX_UNKNOWN_ATOMS = 96;

const NUMBER_FORMAT = createNumberFormat();

function createNumberFormat(): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat('es-CO', { useGrouping: true });
  } catch {
    // Un entorno sin datos de idioma no debe impedir responder.
    return null;
  }
}

/** Formato visible de un conteo exacto. */
export function formatExactCount(value: number): string {
  return NUMBER_FORMAT === null ? String(value) : NUMBER_FORMAT.format(value);
}

/** Conteo exacto ya formateado. Solo para valores 0 o mayores o iguales a 5. */
export function exactCount(value: number): SuppressedCount {
  return { status: 'EXACT', value, display: formatExactCount(value) };
}

/** Conteo suprimido. El valor real NUNCA acompaña a esta representación. */
export function suppressedCount(): SuppressedCount {
  return { status: 'SUPPRESSED', value: null, display: SUPPRESSED_DISPLAY };
}

/**
 * Regla primaria aplicada a un conteo aislado.
 *
 * Un conteo negativo es imposible por construcción; si llegara, se trata como
 * sensible en lugar de publicarse.
 */
export function applyPrimarySuppression(value: number): SuppressedCount {
  if (value === 0) {
    return exactCount(0);
  }

  if (value >= SUPPRESSION_THRESHOLD) {
    return exactCount(value);
  }

  return suppressedCount();
}

/** `true` cuando el conteo real cae en la franja sensible 1–4. */
function esSensible(value: number): boolean {
  return value > 0 && value < SUPPRESSION_THRESHOLD;
}

/**
 * Aplica supresión primaria y complementaria a todas las celdas del sistema.
 *
 * Devuelve una representación por clave de celda. Una clave repetida con el
 * mismo conjunto de átomos comparte estado, de modo que la misma cifra no puede
 * aparecer suprimida en un sitio y exacta en otro.
 */
export function protectDisclosure(
  system: DisclosureSystem,
): ReadonlyMap<string, SuppressedCount> {
  const valores = new Map<string, number>();
  for (const cell of system.cells) {
    valores.set(cell.key, sumaDeAtomos(cell, system.atoms));
  }

  const suprimidas = new Set<string>();
  for (const cell of system.cells) {
    if (esSensible(valores.get(cell.key) ?? 0)) {
      suprimidas.add(cell.key);
    }
  }

  aplicarSupresionComplementaria(system, valores, suprimidas);

  const resultado = new Map<string, SuppressedCount>();
  for (const cell of system.cells) {
    resultado.set(
      cell.key,
      suprimidas.has(cell.key) ? suppressedCount() : exactCount(valores.get(cell.key) ?? 0),
    );
  }

  return resultado;
}

function sumaDeAtomos(
  cell: DisclosureCell,
  atoms: ReadonlyMap<string, number>,
): number {
  let total = 0;
  for (const atom of cell.atoms) {
    total += atoms.get(atom) ?? 0;
  }

  return total;
}

/**
 * Suprime celdas adicionales hasta que ningún átomo sensible quede determinado
 * por el sistema publicado.
 *
 * El bucle termina: cada iteración suprime una celda más y el número de celdas
 * es finito. Cuando ya no queda ninguna celda candidata, el átomo no puede
 * estar determinado, porque determinarlo exige al menos una ecuación publicada
 * que lo contenga.
 */
function aplicarSupresionComplementaria(
  system: DisclosureSystem,
  valores: ReadonlyMap<string, number>,
  suprimidas: Set<string>,
): void {
  for (let iteracion = 0; iteracion <= system.cells.length; iteracion += 1) {
    const desconocidos = atomosDesconocidos(system, suprimidas);

    const sensibles = [...desconocidos].filter((atom) =>
      esSensible(system.atoms.get(atom) ?? 0),
    );

    if (sensibles.length === 0) {
      return;
    }

    const revelado = modoConservador(desconocidos)
      ? sensibles.find((atom) => celdasQueContienen(system, atom, suprimidas).length > 0)
      : primerAtomoRevelado(system, suprimidas, desconocidos, sensibles);

    if (revelado === undefined) {
      return;
    }

    const candidatas = celdasQueContienen(system, revelado, suprimidas);
    if (candidatas.length === 0) {
      return;
    }

    // Se suprime la celda de menor valor: es la que menos información aporta.
    // El desempate por clave mantiene la respuesta determinista.
    const elegida = candidatas.reduce((mejor, actual) => {
      const valorMejor = valores.get(mejor.key) ?? 0;
      const valorActual = valores.get(actual.key) ?? 0;

      if (valorActual !== valorMejor) {
        return valorActual < valorMejor ? actual : mejor;
      }

      return actual.key < mejor.key ? actual : mejor;
    });

    suprimidas.add(elegida.key);
  }
}

/** Un átomo es conocido solo si se publica como celda hoja exacta. */
function atomosDesconocidos(
  system: DisclosureSystem,
  suprimidas: ReadonlySet<string>,
): ReadonlySet<string> {
  const conocidos = new Set<string>();

  for (const cell of system.cells) {
    if (cell.atoms.length === 1 && !suprimidas.has(cell.key)) {
      conocidos.add(cell.atoms[0]!);
    }
  }

  const desconocidos = new Set<string>();
  for (const atom of system.atoms.keys()) {
    if (!conocidos.has(atom)) {
      desconocidos.add(atom);
    }
  }

  return desconocidos;
}

function modoConservador(desconocidos: ReadonlySet<string>): boolean {
  return desconocidos.size > EXACT_ANALYSIS_MAX_UNKNOWN_ATOMS;
}

/** Celdas publicadas, aún exactas y con más de un átomo, que contienen el átomo. */
function celdasQueContienen(
  system: DisclosureSystem,
  atom: string,
  suprimidas: ReadonlySet<string>,
): readonly DisclosureCell[] {
  return system.cells.filter(
    (cell) =>
      !suprimidas.has(cell.key) && cell.atoms.length > 1 && cell.atoms.includes(atom),
  );
}

/**
 * Primer átomo sensible determinado por el sistema publicado, o `undefined`.
 *
 * Se construye la matriz de las celdas exactas restringida a las columnas
 * desconocidas —descartando las filas que no contienen ninguna— y se comprueba,
 * para cada átomo sensible, si su vector indicador pertenece al espacio de
 * filas. La reducción es racional exacta.
 */
function primerAtomoRevelado(
  system: DisclosureSystem,
  suprimidas: ReadonlySet<string>,
  desconocidos: ReadonlySet<string>,
  sensibles: readonly string[],
): string | undefined {
  const columnas = [...desconocidos];
  const indicePorAtomo = new Map(columnas.map((atom, indice) => [atom, indice]));

  const filas: Fraccion[][] = [];
  for (const cell of system.cells) {
    if (suprimidas.has(cell.key)) {
      continue;
    }

    const fila = nuevaFila(columnas.length);
    let contieneDesconocido = false;

    for (const atom of cell.atoms) {
      const indice = indicePorAtomo.get(atom);
      if (indice !== undefined) {
        fila[indice] = FRACCION_UNO;
        contieneDesconocido = true;
      }
    }

    if (contieneDesconocido) {
      filas.push(fila);
    }
  }

  const escalonada = reducirPorFilas(filas, columnas.length);

  return sensibles.find((atom) => {
    const indice = indicePorAtomo.get(atom);

    return indice !== undefined && perteneceAlEspacioDeFilas(escalonada, indice, columnas.length);
  });
}

/* -------------------------------------------------------------------------- */
/* Aritmética racional exacta                                                  */
/* -------------------------------------------------------------------------- */

interface Fraccion {
  readonly n: bigint;
  readonly d: bigint;
}

const FRACCION_CERO: Fraccion = { n: 0n, d: 1n };
const FRACCION_UNO: Fraccion = { n: 1n, d: 1n };

function nuevaFila(longitud: number): Fraccion[] {
  return Array.from({ length: longitud }, () => FRACCION_CERO);
}

function mcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;

  while (y !== 0n) {
    const resto = x % y;
    x = y;
    y = resto;
  }

  return x === 0n ? 1n : x;
}

function normalizar(n: bigint, d: bigint): Fraccion {
  if (n === 0n) {
    return FRACCION_CERO;
  }

  const signo = d < 0n ? -1n : 1n;
  const numerador = n * signo;
  const denominador = d * signo;
  const divisor = mcd(numerador, denominador);

  return { n: numerador / divisor, d: denominador / divisor };
}

function restarProducto(a: Fraccion, factor: Fraccion, b: Fraccion): Fraccion {
  // a - factor * b
  const productoN = factor.n * b.n;
  const productoD = factor.d * b.d;

  return normalizar(a.n * productoD - productoN * a.d, a.d * productoD);
}

function dividir(a: Fraccion, b: Fraccion): Fraccion {
  return normalizar(a.n * b.d, a.d * b.n);
}

/** Forma escalonada reducida por filas. Devuelve las filas no nulas. */
function reducirPorFilas(filas: Fraccion[][], columnas: number): Fraccion[][] {
  const matriz = filas.map((fila) => [...fila]);
  let filaPivote = 0;

  for (let columna = 0; columna < columnas && filaPivote < matriz.length; columna += 1) {
    const indice = matriz.findIndex(
      (fila, posicion) => posicion >= filaPivote && fila[columna]!.n !== 0n,
    );

    if (indice === -1) {
      continue;
    }

    const intercambio = matriz[filaPivote]!;
    matriz[filaPivote] = matriz[indice]!;
    matriz[indice] = intercambio;

    const pivote = matriz[filaPivote]![columna]!;
    matriz[filaPivote] = matriz[filaPivote]!.map((valor) => dividir(valor, pivote));

    for (let fila = 0; fila < matriz.length; fila += 1) {
      if (fila === filaPivote || matriz[fila]![columna]!.n === 0n) {
        continue;
      }

      const factor = matriz[fila]![columna]!;
      matriz[fila] = matriz[fila]!.map((valor, posicion) =>
        restarProducto(valor, factor, matriz[filaPivote]![posicion]!),
      );
    }

    filaPivote += 1;
  }

  return matriz.slice(0, filaPivote);
}

/**
 * `true` si el vector indicador de la columna pertenece al espacio de filas de
 * la matriz ya escalonada: eliminando contra los pivotes queda el vector nulo.
 */
function perteneceAlEspacioDeFilas(
  escalonada: readonly Fraccion[][],
  columnaObjetivo: number,
  columnas: number,
): boolean {
  let vector = nuevaFila(columnas);
  vector[columnaObjetivo] = FRACCION_UNO;

  for (const fila of escalonada) {
    const pivote = fila.findIndex((valor) => valor.n !== 0n);
    if (pivote === -1) {
      continue;
    }

    const coeficiente = vector[pivote]!;
    if (coeficiente.n === 0n) {
      continue;
    }

    vector = vector.map((valor, posicion) =>
      restarProducto(valor, coeficiente, fila[posicion]!),
    );
  }

  return vector.every((valor) => valor.n === 0n);
}
