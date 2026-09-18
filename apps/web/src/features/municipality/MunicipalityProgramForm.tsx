'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import styles from './municipality.module.css';
import type {
  MunicipalityEjecutor,
  MunicipalityPrograma,
  MunicipalityProgramaCampo,
  MunicipalityProgramasConfig,
} from './municipalityConfig';

/**
 * Diálogo «Nuevo programa» de la experiencia Alcaldía
 * (TASK-ALCALDIA-A-03, FR-08).
 *
 * Ampliación funcional expresamente aprobada por el Product Owner sobre la
 * vista vinculante. Contiene solo los diez grupos de campos mínimos: no añade
 * campos clínicos, contractuales, financieros profundos ni evidencias.
 *
 * Naturaleza del alta: local y demostrativa. Al enviar un formulario válido se
 * agrega un borrador únicamente al estado en memoria de la vista. NO aprueba,
 * NO activa, NO persiste, NO consulta red, NO usa almacenamiento, cookie, URL
 * ni archivo, y el borrador desaparece al recargar o desmontar. La presencia de
 * este control es UX demostrativa y no constituye autorización: el backend
 * futuro deberá denegar por defecto y evaluar tenant, organización, municipio,
 * afiliación, rol, acción, programa, finalidad, vigencia y la separación entre
 * quien crea y quien aprueba.
 *
 * El estado inicial es siempre `BORRADOR` y no es escalable desde este flujo.
 */

/** Datos crudos del formulario, tal como los escribe quien lo usa. */
export interface MunicipalityProgramaEntrada {
  readonly nombre: string;
  readonly poblacionIds: readonly string[];
  readonly origen: string;
  readonly entidadFormuladora: string;
  readonly entidadResponsable: string;
  readonly ejecutorIds: readonly string[];
  readonly vigenciaInicio: string;
  readonly vigenciaFin: string;
  readonly presupuesto: string;
  readonly meta: string;
}

/** Error de validación asociado programáticamente a su campo. */
export interface MunicipalityProgramaError {
  readonly campo: MunicipalityProgramaCampo;
  readonly mensaje: string;
}

/** Entrada vacía con la que abre el formulario. */
export const MUNICIPALITY_PROGRAMA_ENTRADA_VACIA: MunicipalityProgramaEntrada = {
  nombre: '',
  poblacionIds: [],
  origen: '',
  entidadFormuladora: '',
  entidadResponsable: '',
  ejecutorIds: [],
  vigenciaInicio: '',
  vigenciaFin: '',
  presupuesto: '',
  meta: '',
};

/** `true` cuando el texto contiene solo dígitos y representa un entero ≥ 0. */
function esCantidadNoNegativa(valor: string): boolean {
  return /^\d+$/u.test(valor.trim());
}

/** `true` cuando la fecha tiene el formato `AAAA-MM-DD` que emite el control. */
function esFechaDeclarada(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(valor.trim());
}

/**
 * Validación pura del alta local (FR-08, AC-10).
 *
 * Devuelve los errores en el orden de los campos del formulario, de modo que el
 * resumen de errores y el orden de foco coincidan. No transforma la entrada, no
 * consulta nada y no depende del DOM.
 */
export function validarProgramaBorrador(
  entrada: MunicipalityProgramaEntrada,
  config: MunicipalityProgramasConfig,
): readonly MunicipalityProgramaError[] {
  const { errores, errorVigenciaOrden } = config.formulario;
  const encontrados: MunicipalityProgramaError[] = [];

  if (entrada.nombre.trim() === '') {
    encontrados.push({ campo: 'nombre', mensaje: errores.nombre });
  }

  if (entrada.poblacionIds.length === 0) {
    encontrados.push({ campo: 'poblaciones', mensaje: errores.poblaciones });
  }

  if (!config.origenes.some((origen) => origen.id === entrada.origen)) {
    encontrados.push({ campo: 'origen', mensaje: errores.origen });
  }

  if (entrada.entidadFormuladora.trim() === '') {
    encontrados.push({ campo: 'entidadFormuladora', mensaje: errores.entidadFormuladora });
  }

  if (entrada.entidadResponsable.trim() === '') {
    encontrados.push({ campo: 'entidadResponsable', mensaje: errores.entidadResponsable });
  }

  if (entrada.ejecutorIds.length === 0) {
    encontrados.push({ campo: 'ejecutores', mensaje: errores.ejecutores });
  }

  if (!esFechaDeclarada(entrada.vigenciaInicio)) {
    encontrados.push({ campo: 'vigenciaInicio', mensaje: errores.vigenciaInicio });
  }

  if (!esFechaDeclarada(entrada.vigenciaFin)) {
    encontrados.push({ campo: 'vigenciaFin', mensaje: errores.vigenciaFin });
  } else if (
    esFechaDeclarada(entrada.vigenciaInicio) &&
    entrada.vigenciaFin.trim() < entrada.vigenciaInicio.trim()
  ) {
    /* Comparación textual: `AAAA-MM-DD` ordena igual como texto que como fecha. */
    encontrados.push({ campo: 'vigenciaFin', mensaje: errorVigenciaOrden });
  }

  if (!esCantidadNoNegativa(entrada.presupuesto)) {
    encontrados.push({ campo: 'presupuesto', mensaje: errores.presupuesto });
  }

  if (!esCantidadNoNegativa(entrada.meta)) {
    encontrados.push({ campo: 'meta', mensaje: errores.meta });
  }

  return encontrados;
}

/**
 * Agrupa dígitos en miles con punto, solo para presentarlos.
 *
 * Es formato de presentación, no aritmética: no convierte unidades, no redondea,
 * no calcula y no interpreta el valor recibido.
 */
export function agruparMiles(digitos: string): string {
  const limpio = digitos.trim().replace(/^0+(?=\d)/u, '');
  const grupos = [...limpio].reverse().reduce<string[]>((acumulado, caracter, indice) => {
    if (indice > 0 && indice % 3 === 0) {
      acumulado.push('.');
    }

    acumulado.push(caracter);

    return acumulado;
  }, []);

  return grupos.reverse().join('');
}

/** Presenta un monto declarado con su separador de miles. */
export function formatearMontoDemo(digitos: string): string {
  return `$${agruparMiles(digitos)}`;
}

/** Presenta una cantidad declarada (meta, resultado) con separador de miles. */
export function formatearCantidadDemo(cantidad: number): string {
  return agruparMiles(String(cantidad));
}

/** Presenta `AAAA-MM-DD` como `DD/MM/AAAA` sin usar reloj ni zona horaria. */
export function formatearFechaDemo(fecha: string): string {
  const [anio = '', mes = '', dia = ''] = fecha.trim().split('-');

  return `${dia}/${mes}/${anio}`;
}

/**
 * Construye el borrador efímero a partir de una entrada ya validada (FR-08).
 *
 * Es una función pura: el identificador procede del índice recibido, no de un
 * reloj ni de un generador aleatorio, de modo que el resultado sea verificable.
 * Los datos que el alta no declara quedan explícitamente «sin registro»: esta
 * función NO deriva disponible, porcentaje, cobertura, evidencia ni resultado.
 */
export function crearProgramaBorrador(
  entrada: MunicipalityProgramaEntrada,
  config: MunicipalityProgramasConfig,
  indice: number,
): MunicipalityPrograma {
  const { etiquetas, formulario } = config;
  const ejecutores = config.ejecutoresDisponibles.filter((ejecutor) =>
    entrada.ejecutorIds.includes(ejecutor.id),
  );
  const origen =
    config.origenes.find((opcion) => opcion.id === entrada.origen)?.id ?? 'INSTITUCIONAL_OTRO';

  return {
    id: `pro-borrador-${String(indice)}`,
    /* El borrador nace en la misma organización demostrativa de la consulta. */
    organizacionId: config.programas[0]?.organizacionId ?? 'org-demo',
    municipioId: config.programas[0]?.municipioId ?? null,
    nombre: entrada.nombre.trim(),
    objetivo: '',
    poblacionIds: [...entrada.poblacionIds],
    origen,
    entidadFormuladora: entrada.entidadFormuladora.trim(),
    entidadResponsable: entrada.entidadResponsable.trim(),
    ejecutores,
    vigencia: {
      inicio: entrada.vigenciaInicio.trim(),
      fin: entrada.vigenciaFin.trim(),
      etiqueta: `${formatearFechaDemo(entrada.vigenciaInicio)} – ${formatearFechaDemo(
        entrada.vigenciaFin,
      )}`,
    },
    presupuesto: {
      moneda: formulario.moneda,
      asignado: formatearMontoDemo(entrada.presupuesto),
    },
    avanceFisico: {
      metaFisica: Number(entrada.meta.trim()),
      resultadoFisico: null,
      unidad: formulario.unidadMeta,
      resultadoEtiqueta: formulario.resultadoEtiqueta,
      porcentaje: null,
      porcentajeTexto: null,
      tono: 'azul',
    },
    avanceFinanciero: {
      comprometido: null,
      ejecutado: null,
      disponible: null,
      porcentaje: null,
      porcentajeTexto: null,
      tono: 'azul',
    },
    territorio: { ambitoIds: [], resumen: etiquetas.sinRegistro },
    cobertura: { valor: etiquetas.sinRegistro, denominador: null, porcentajeTexto: null },
    beneficiariosUnicos: etiquetas.sinRegistro,
    poblacionAtendida: etiquetas.sinRegistro,
    actividad: { etiqueta: formulario.actividadEtiqueta, valor: etiquetas.sinRegistro },
    evidencias: {
      registradas: '0',
      pendientes: '0',
      actividadesConSoporte: etiquetas.sinRegistro,
      estadoDocumental: etiquetas.sinRegistro,
      tono: 'azul',
    },
    estado: formulario.estadoInicial,
    cierre: null,
    procedencia: config.procedencia,
  };
}

/** Selector de elementos que pueden recibir el foco dentro del diálogo. */
const FOCUSABLES =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Alterna la pertenencia de un identificador en una selección múltiple. */
function alternar(seleccion: readonly string[], id: string): readonly string[] {
  return seleccion.includes(id)
    ? seleccion.filter((actual) => actual !== id)
    : [...seleccion, id];
}

/** Campo de texto con etiqueta, requerimiento y error asociados. */
function CampoTexto({
  id,
  etiqueta,
  requerido,
  valor,
  error,
  tipo = 'text',
  sufijo,
  onCambiar,
}: {
  readonly id: string;
  readonly etiqueta: string;
  readonly requerido: string;
  readonly valor: string;
  readonly error: string | undefined;
  readonly tipo?: 'text' | 'date' | 'number';
  readonly sufijo?: string;
  readonly onCambiar: (valor: string) => void;
}): ReactNode {
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {etiqueta} <span className={styles.fieldRequired}>({requerido})</span>
      </label>
      <div className={styles.fieldControl}>
        <input
          className={styles.input}
          id={id}
          type={tipo}
          value={valor}
          required
          min={tipo === 'number' ? 0 : undefined}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={error === undefined ? undefined : errorId}
          onChange={(evento) => {
            onCambiar(evento.target.value);
          }}
        />
        {sufijo === undefined ? null : <span className={styles.fieldSuffix}>{sufijo}</span>}
      </div>
      {error === undefined ? null : (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Grupo de selección múltiple operable por teclado con controles nativos. */
function CampoMultiple({
  id,
  etiqueta,
  requerido,
  opciones,
  seleccion,
  error,
  onAlternar,
}: {
  readonly id: string;
  readonly etiqueta: string;
  readonly requerido: string;
  readonly opciones: readonly { readonly id: string; readonly etiqueta: string }[];
  readonly seleccion: readonly string[];
  readonly error: string | undefined;
  readonly onAlternar: (opcionId: string) => void;
}): ReactNode {
  const errorId = `${id}-error`;

  return (
    <fieldset
      className={styles.fieldset}
      id={id}
      aria-invalid={error === undefined ? undefined : true}
      aria-describedby={error === undefined ? undefined : errorId}
    >
      <legend className={styles.fieldLabel}>
        {etiqueta} <span className={styles.fieldRequired}>({requerido})</span>
      </legend>
      <div className={styles.checkGroup}>
        {opciones.map((opcion) => (
          <label className={styles.checkItem} htmlFor={`${id}-${opcion.id}`} key={opcion.id}>
            <input
              checked={seleccion.includes(opcion.id)}
              id={`${id}-${opcion.id}`}
              type="checkbox"
              onChange={() => {
                onAlternar(opcion.id);
              }}
            />
            <span>{opcion.etiqueta}</span>
          </label>
        ))}
      </div>
      {error === undefined ? null : (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Nombre visible de un ejecutor con su tipo de participación. */
function etiquetaEjecutor(
  ejecutor: MunicipalityEjecutor,
  config: MunicipalityProgramasConfig,
): string {
  const tipo = config.tiposEjecutor.find((opcion) => opcion.id === ejecutor.tipo);

  return `${ejecutor.nombre} · ${tipo?.etiqueta ?? ejecutor.tipo}`;
}

export function MunicipalityProgramForm({
  config,
  onCancelar,
  onCrear,
}: {
  readonly config: MunicipalityProgramasConfig;
  readonly onCancelar: () => void;
  readonly onCrear: (entrada: MunicipalityProgramaEntrada) => void;
}): ReactNode {
  const base = useId();
  const [entrada, setEntrada] = useState<MunicipalityProgramaEntrada>(
    MUNICIPALITY_PROGRAMA_ENTRADA_VACIA,
  );
  const [errores, setErrores] = useState<readonly MunicipalityProgramaError[]>([]);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const resumenRef = useRef<HTMLDivElement>(null);

  const { formulario } = config;
  const idDe = (sufijo: string): string => `${base}-${sufijo}`;
  const errorDe = (campo: MunicipalityProgramaCampo): string | undefined =>
    errores.find((error) => error.campo === campo)?.mensaje;

  /*
   * Al abrir, el foco entra en el título del diálogo: sin ello quien navega con
   * teclado o lector de pantalla seguiría en la página de fondo sin que nada
   * anuncie que se abrió un formulario modal.
   */
  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  /**
   * Ciclo de foco dentro del diálogo y cierre con `Escape`.
   *
   * El recorrido se calcula sobre los controles reales del diálogo, de modo que
   * el foco nunca salga al contenido de fondo mientras el modal está abierto.
   */
  const alPulsarTecla = (evento: KeyboardEvent<HTMLDivElement>): void => {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      onCancelar();

      return;
    }

    if (evento.key !== 'Tab') {
      return;
    }

    const contenedor = dialogoRef.current;

    if (contenedor === null) {
      return;
    }

    const focusables = [...contenedor.querySelectorAll<HTMLElement>(FOCUSABLES)];
    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];

    if (primero === undefined || ultimo === undefined) {
      return;
    }

    const activo = contenedor.ownerDocument.activeElement;

    if (evento.shiftKey && (activo === primero || activo === tituloRef.current)) {
      evento.preventDefault();
      ultimo.focus();

      return;
    }

    if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  };

  const enviar = (): void => {
    const encontrados = validarProgramaBorrador(entrada, config);

    setErrores(encontrados);

    if (encontrados.length > 0) {
      /* Envío inválido: no crea nada y lleva el foco al resumen de errores. */
      resumenRef.current?.focus();

      return;
    }

    onCrear(entrada);
  };

  const tituloId = idDe('titulo');
  const descripcionId = idDe('descripcion');

  return (
    /*
     * El fondo oscurece la página pero no cierra al pulsar: cerrar es siempre
     * una acción explícita, con `Cancelar` o con `Escape`.
     */
    <div className={styles.dialogBackdrop}>
      <div
        className={styles.dialog}
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descripcionId}
        onKeyDown={alPulsarTecla}
      >
        <h2 className={styles.dialogTitle} id={tituloId} ref={tituloRef} tabIndex={-1}>
          {formulario.titulo}
        </h2>
        <p className={styles.dialogDescription} id={descripcionId}>
          {formulario.descripcion}
        </p>

        {/*
         * Región de errores siempre presente: aparece vacía y se rellena al
         * enviar, de modo que el anuncio llegue como cambio de una región viva
         * ya existente y no como un nodo nuevo que el lector podría perderse.
         */}
        <div
          className={errores.length > 0 ? styles.errorSummary : 'merdn-sr-only'}
          ref={resumenRef}
          role="alert"
          tabIndex={-1}
        >
          {errores.length > 0 ? (
            <>
              <p className={styles.errorSummaryTitle}>{formulario.resumenErroresTitulo}</p>
              <ul className={styles.errorSummaryList}>
                {errores.map((error) => (
                  <li key={error.campo}>{error.mensaje}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <form
          className={styles.form}
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            enviar();
          }}
        >
          <CampoTexto
            error={errorDe('nombre')}
            etiqueta={formulario.campos.nombre}
            id={idDe('nombre')}
            requerido={formulario.requerido}
            valor={entrada.nombre}
            onCambiar={(nombre) => {
              setEntrada((actual) => ({ ...actual, nombre }));
            }}
          />

          <CampoMultiple
            error={errorDe('poblaciones')}
            etiqueta={formulario.campos.poblaciones}
            id={idDe('poblaciones')}
            opciones={config.poblacionesBase}
            requerido={formulario.requerido}
            seleccion={entrada.poblacionIds}
            onAlternar={(poblacionId) => {
              setEntrada((actual) => ({
                ...actual,
                poblacionIds: alternar(actual.poblacionIds, poblacionId),
              }));
            }}
          />

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={idDe('origen')}>
              {formulario.campos.origen}{' '}
              <span className={styles.fieldRequired}>({formulario.requerido})</span>
            </label>
            <select
              className={styles.select}
              id={idDe('origen')}
              required
              value={entrada.origen}
              aria-invalid={errorDe('origen') === undefined ? undefined : true}
              aria-describedby={
                errorDe('origen') === undefined ? undefined : `${idDe('origen')}-error`
              }
              onChange={(evento) => {
                setEntrada((actual) => ({ ...actual, origen: evento.target.value }));
              }}
            >
              <option value="">{formulario.campos.origen}</option>
              {config.origenes.map((origen) => (
                <option key={origen.id} value={origen.id}>
                  {origen.etiqueta}
                </option>
              ))}
            </select>
            {errorDe('origen') === undefined ? null : (
              <p className={styles.fieldError} id={`${idDe('origen')}-error`}>
                {errorDe('origen')}
              </p>
            )}
          </div>

          <CampoTexto
            error={errorDe('entidadFormuladora')}
            etiqueta={formulario.campos.entidadFormuladora}
            id={idDe('formuladora')}
            requerido={formulario.requerido}
            valor={entrada.entidadFormuladora}
            onCambiar={(entidadFormuladora) => {
              setEntrada((actual) => ({ ...actual, entidadFormuladora }));
            }}
          />

          <CampoTexto
            error={errorDe('entidadResponsable')}
            etiqueta={formulario.campos.entidadResponsable}
            id={idDe('responsable')}
            requerido={formulario.requerido}
            valor={entrada.entidadResponsable}
            onCambiar={(entidadResponsable) => {
              setEntrada((actual) => ({ ...actual, entidadResponsable }));
            }}
          />

          <CampoMultiple
            error={errorDe('ejecutores')}
            etiqueta={formulario.campos.ejecutores}
            id={idDe('ejecutores')}
            opciones={config.ejecutoresDisponibles.map((ejecutor) => ({
              id: ejecutor.id,
              etiqueta: etiquetaEjecutor(ejecutor, config),
            }))}
            requerido={formulario.requerido}
            seleccion={entrada.ejecutorIds}
            onAlternar={(ejecutorId) => {
              setEntrada((actual) => ({
                ...actual,
                ejecutorIds: alternar(actual.ejecutorIds, ejecutorId),
              }));
            }}
          />

          <fieldset className={styles.fieldset}>
            <legend className={styles.fieldLabel}>{formulario.grupoVigencia}</legend>
            <div className={styles.fieldRow}>
              <CampoTexto
                error={errorDe('vigenciaInicio')}
                etiqueta={formulario.campos.vigenciaInicio}
                id={idDe('vigencia-inicio')}
                requerido={formulario.requerido}
                tipo="date"
                valor={entrada.vigenciaInicio}
                onCambiar={(vigenciaInicio) => {
                  setEntrada((actual) => ({ ...actual, vigenciaInicio }));
                }}
              />
              <CampoTexto
                error={errorDe('vigenciaFin')}
                etiqueta={formulario.campos.vigenciaFin}
                id={idDe('vigencia-fin')}
                requerido={formulario.requerido}
                tipo="date"
                valor={entrada.vigenciaFin}
                onCambiar={(vigenciaFin) => {
                  setEntrada((actual) => ({ ...actual, vigenciaFin }));
                }}
              />
            </div>
          </fieldset>

          <CampoTexto
            error={errorDe('presupuesto')}
            etiqueta={formulario.campos.presupuesto}
            id={idDe('presupuesto')}
            requerido={formulario.requerido}
            sufijo={formulario.moneda}
            tipo="number"
            valor={entrada.presupuesto}
            onCambiar={(presupuesto) => {
              setEntrada((actual) => ({ ...actual, presupuesto }));
            }}
          />

          <CampoTexto
            error={errorDe('meta')}
            etiqueta={formulario.campos.meta}
            id={idDe('meta')}
            requerido={formulario.requerido}
            sufijo={formulario.unidadMeta}
            tipo="number"
            valor={entrada.meta}
            onCambiar={(meta) => {
              setEntrada((actual) => ({ ...actual, meta }));
            }}
          />

          {/*
           * Estado inicial: visible, anunciado y no editable. No es un control
           * deshabilitado por estética, es el único estado que este flujo puede
           * producir.
           */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={idDe('estado')}>
              {formulario.estadoInicialEtiqueta}
            </label>
            <input
              className={styles.input}
              id={idDe('estado')}
              readOnly
              type="text"
              value={
                config.estados.find((estado) => estado.id === formulario.estadoInicial)?.etiqueta ??
                formulario.estadoInicial
              }
              aria-describedby={idDe('estado-ayuda')}
            />
            <p className={styles.fieldHelp} id={idDe('estado-ayuda')}>
              {formulario.estadoInicialAyuda}
            </p>
          </div>

          <div className={styles.dialogActions}>
            <button className={styles.buttonGhost} type="button" onClick={onCancelar}>
              {formulario.cancelar}
            </button>
            <button className={styles.buttonPrimary} type="submit">
              {formulario.crear}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
