import { useId, useState, type FormEvent, type ReactNode } from 'react';

import {
  type AccionRevisor,
  type AlarmaDto,
  type ContextoCuidadoDto,
  type DatoDto,
  type OpcionDto,
  type RegistroDto,
  type Severidad,
  TEXTO_ACCION,
  TEXTO_ESTADO,
  TEXTO_FUENTE,
  TEXTO_SEVERIDAD,
  type TipoDato,
  valorLegible,
} from './careClient';
import styles from './care.module.css';

/**
 * Vistas PRESENTACIONALES del espacio de cuidado (SPEC 055 / MP02–MP03).
 *
 * No consultan la API ni guardan nada: reciben datos ya autorizados por el
 * servidor y devuelven intenciones. Reglas visibles:
 *
 * - la severidad se escribe siempre con palabras; el color es refuerzo;
 * - una alarma sin clasificar se muestra «Pendiente de clasificación», nunca
 *   verde, y no hay evaluación ni semáforo inventado;
 * - recibir una solicitud NO es lo mismo que atenderla, y se dice;
 * - los identificadores técnicos no se muestran como contenido principal.
 */

const FECHA = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export function fechaLegible(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? 'Fecha no disponible' : FECHA.format(fecha);
}

/* -------------------------------------------------------------------------- */
/* Estados generales                                                           */
/* -------------------------------------------------------------------------- */

export type EstadoGeneral = 'cargando' | 'sin-sesion' | 'denegado' | 'indisponible' | 'vacio';

export const TEXTO_ESTADO_GENERAL: Readonly<Record<EstadoGeneral, string>> = {
  cargando: 'Buscando sus espacios de cuidado…',
  'sin-sesion': 'Su sesión no está abierta. Inicie sesión de nuevo para continuar.',
  denegado: 'Su cuenta no tiene autorización para este espacio de cuidado.',
  indisponible: 'No fue posible consultar la información en este momento. No se muestra ningún dato.',
  vacio:
    'Todavía no tiene ningún espacio de cuidado autorizado. La institución debe registrarlo y concederle acceso.',
};

export function VistaEstadoGeneral({ estado, onReintentar }: { readonly estado: EstadoGeneral; readonly onReintentar?: () => void }): ReactNode {
  return (
    <div className={estado === 'indisponible' || estado === 'denegado' ? styles.alertaError : styles.aviso} role="status">
      <p>{TEXTO_ESTADO_GENERAL[estado]}</p>
      {estado === 'indisponible' && onReintentar !== undefined ? (
        <button className={styles.secundario} type="button" onClick={onReintentar}>
          Volver a intentar
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Selector de contexto                                                        */
/* -------------------------------------------------------------------------- */

export function SelectorContexto({
  contextos,
  seleccionado,
  onSeleccionar,
}: {
  readonly contextos: readonly ContextoCuidadoDto[];
  readonly seleccionado: string | null;
  readonly onSeleccionar: (contextId: string) => void;
}): ReactNode {
  const id = useId();

  if (contextos.length === 1) {
    const unico = contextos[0];
    return unico === undefined ? null : (
      <p className={styles.contextoUnico}>
        <strong>{unico.patientLabel}</strong> · {unico.organizationName}
      </p>
    );
  }

  return (
    <div className={styles.campo}>
      <label htmlFor={id}>Persona y servicio</label>
      <select id={id} value={seleccionado ?? ''} onChange={(evento) => onSeleccionar(evento.target.value)}>
        <option value="" disabled>
          Elija un espacio de cuidado
        </option>
        {contextos.map((contexto) => (
          <option key={contexto.contextId} value={contexto.contextId}>
            {contexto.patientLabel} · {contexto.organizationName}
          </option>
        ))}
      </select>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Registro de bitácora                                                        */
/* -------------------------------------------------------------------------- */

export interface EnvioRegistro {
  readonly occurredAt: string;
  readonly note: string;
  readonly valores: Readonly<Record<string, boolean | string>>;
}

/** Valor local a `datetime-local` (sin segundos), para el campo por defecto. */
export function ahoraLocal(ahora: Date = new Date()): string {
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Convierte el campo local en instante con zona; `null` si es inválido o futuro. */
export function instanteDesdeLocal(valor: string, ahora: Date = new Date()): string | null {
  const fecha = new Date(valor);
  if (valor === '' || Number.isNaN(fecha.getTime()) || fecha.getTime() > ahora.getTime()) {
    return null;
  }
  return fecha.toISOString();
}

export function FormularioRegistro({
  datos,
  enviando,
  onEnviar,
}: {
  readonly datos: readonly DatoDto[];
  readonly enviando: boolean;
  readonly onEnviar: (envio: EnvioRegistro) => void;
}): ReactNode {
  const base = useId();
  const [ocurrencia, setOcurrencia] = useState(() => ahoraLocal());
  const [nota, setNota] = useState('');
  const [valores, setValores] = useState<Record<string, boolean | string>>({});

  const enviar = (evento: FormEvent): void => {
    evento.preventDefault();
    onEnviar({ occurredAt: ocurrencia, note: nota, valores });
  };

  return (
    <form className={styles.formulario} onSubmit={enviar} aria-labelledby={`${base}-titulo`}>
      <h3 id={`${base}-titulo`}>Nueva entrada de bitácora</h3>

      <div className={styles.campo}>
        <label htmlFor={`${base}-ocurrencia`}>¿Cuándo ocurrió?</label>
        <input
          id={`${base}-ocurrencia`}
          type="datetime-local"
          value={ocurrencia}
          max={ahoraLocal()}
          onChange={(evento) => setOcurrencia(evento.target.value)}
          required
        />
      </div>

      {datos.length === 0 ? (
        <p className={styles.ayuda}>
          Este espacio todavía no tiene datos validados por un profesional. Puede escribir una nota.
        </p>
      ) : (
        datos.map((dato) => (
          <CampoDato
            key={dato.id}
            dato={dato}
            valor={valores[dato.id]}
            onCambiar={(valor) =>
              setValores((previo) => {
                const siguiente = { ...previo };
                if (valor === undefined) delete siguiente[dato.id];
                else siguiente[dato.id] = valor;
                return siguiente;
              })
            }
          />
        ))
      )}

      <div className={styles.campo}>
        <label htmlFor={`${base}-nota`}>Nota (opcional)</label>
        <textarea id={`${base}-nota`} value={nota} maxLength={2000} rows={3} onChange={(evento) => setNota(evento.target.value)} />
      </div>

      <button className={styles.primario} type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar en la bitácora'}
      </button>
    </form>
  );
}

function CampoDato({
  dato,
  valor,
  onCambiar,
}: {
  readonly dato: DatoDto;
  readonly valor: boolean | string | undefined;
  readonly onCambiar: (valor: boolean | string | undefined) => void;
}): ReactNode {
  const id = useId();

  if (dato.valueType === 'BOOLEAN') {
    return (
      <fieldset className={styles.campo}>
        <legend>{dato.label}</legend>
        {(['si', 'no', 'sin'] as const).map((opcion) => (
          <label key={opcion} className={styles.opcion}>
            <input
              type="radio"
              name={id}
              checked={opcion === 'sin' ? valor === undefined : valor === (opcion === 'si')}
              onChange={() => onCambiar(opcion === 'sin' ? undefined : opcion === 'si')}
            />
            {opcion === 'si' ? 'Sí' : opcion === 'no' ? 'No' : 'Sin responder'}
          </label>
        ))}
      </fieldset>
    );
  }

  if (dato.valueType === 'CHOICE') {
    return (
      <div className={styles.campo}>
        <label htmlFor={id}>{dato.label}</label>
        <select id={id} value={typeof valor === 'string' ? valor : ''} onChange={(evento) => onCambiar(evento.target.value === '' ? undefined : evento.target.value)}>
          <option value="">Sin responder</option>
          {(dato.options ?? []).map((opcion) => (
            <option key={opcion.code} value={opcion.code}>
              {opcion.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={styles.campo}>
      <label htmlFor={id}>
        {dato.label}
        {dato.unit === null ? '' : ` (${dato.unit})`}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={typeof valor === 'string' ? valor : ''}
        onChange={(evento) => onCambiar(evento.target.value.trim() === '' ? undefined : evento.target.value.trim())}
        aria-describedby={`${id}-ayuda`}
      />
      <p className={styles.ayuda} id={`${id}-ayuda`}>
        Use punto para los decimales.
      </p>
    </div>
  );
}

export function ListaRegistros({
  registros,
  onEnmendar,
}: {
  readonly registros: readonly RegistroDto[];
  readonly onEnmendar?: (registro: RegistroDto, nota: string, motivo: string) => void;
}): ReactNode {
  if (registros.length === 0) {
    return <p className={styles.ayuda}>Todavía no hay entradas en esta bitácora.</p>;
  }

  return (
    <ol className={styles.lista} aria-label="Entradas de la bitácora">
      {registros.map((registro) => (
        <li key={registro.id} className={styles.item}>
          <p className={styles.meta}>
            {TEXTO_FUENTE[registro.source]}
            {registro.authoredByMe ? ' (usted)' : ''} · ocurrió {fechaLegible(registro.occurredAt)} · recibido{' '}
            {fechaLegible(registro.receivedAt)}
          </p>
          {registro.observations.length > 0 ? (
            <dl className={styles.valores}>
              {registro.observations.map((observacion) => (
                <div key={observacion.id}>
                  <dt>{observacion.label}</dt>
                  <dd>{valorLegible(observacion.value, observacion)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {registro.note === null ? null : <p>{registro.note}</p>}
          {registro.amendments.length > 0 ? (
            <ul className={styles.enmiendas} aria-label="Correcciones">
              {registro.amendments.map((enmienda) => (
                <li key={enmienda.id}>
                  Corrección {enmienda.sequence} · {fechaLegible(enmienda.createdAt)}: {enmienda.reason}
                  {enmienda.note === null ? '' : ` — ${enmienda.note}`}
                </li>
              ))}
            </ul>
          ) : null}
          {registro.authoredByMe && onEnmendar !== undefined ? <FormularioEnmienda registro={registro} onEnmendar={onEnmendar} /> : null}
        </li>
      ))}
    </ol>
  );
}

function FormularioEnmienda({
  registro,
  onEnmendar,
}: {
  readonly registro: RegistroDto;
  readonly onEnmendar: (registro: RegistroDto, nota: string, motivo: string) => void;
}): ReactNode {
  const id = useId();
  const [nota, setNota] = useState('');
  const [motivo, setMotivo] = useState('');

  return (
    <details className={styles.enmendar}>
      <summary>Agregar una corrección</summary>
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          onEnmendar(registro, nota, motivo);
        }}
      >
        <div className={styles.campo}>
          <label htmlFor={`${id}-nota`}>Corrección</label>
          <textarea id={`${id}-nota`} value={nota} maxLength={2000} rows={2} required onChange={(evento) => setNota(evento.target.value)} />
        </div>
        <div className={styles.campo}>
          <label htmlFor={`${id}-motivo`}>Motivo</label>
          <input id={`${id}-motivo`} value={motivo} maxLength={2000} required onChange={(evento) => setMotivo(evento.target.value)} />
        </div>
        <p className={styles.ayuda}>La entrada original se conserva; la corrección queda a su nombre.</p>
        <button className={styles.secundario} type="submit">
          Guardar corrección
        </button>
      </form>
    </details>
  );
}

/* -------------------------------------------------------------------------- */
/* Solicitud manual de revisión                                                */
/* -------------------------------------------------------------------------- */

export function SolicitudRevision({
  enviando,
  recibo,
  onEnviar,
}: {
  readonly enviando: boolean;
  readonly recibo: string | null;
  readonly onEnviar: (nota: string) => void;
}): ReactNode {
  const id = useId();
  const [nota, setNota] = useState('');

  return (
    <form
      className={styles.formulario}
      aria-labelledby={`${id}-titulo`}
      onSubmit={(evento) => {
        evento.preventDefault();
        onEnviar(nota);
      }}
    >
      <h3 id={`${id}-titulo`}>Pedir revisión</h3>
      <p className={styles.ayuda}>
        Envía una solicitud al equipo autorizado del servicio. Ante una urgencia, use los canales de urgencias.
      </p>
      <div className={styles.campo}>
        <label htmlFor={`${id}-nota`}>¿Qué está pasando? (opcional)</label>
        <textarea id={`${id}-nota`} value={nota} maxLength={2000} rows={3} onChange={(evento) => setNota(evento.target.value)} />
      </div>
      <button className={styles.primario} type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar solicitud de revisión'}
      </button>
      {recibo === null ? null : (
        <p className={styles.recibo} role="status">
          {recibo}
        </p>
      )}
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Alarmas                                                                     */
/* -------------------------------------------------------------------------- */

export function EtiquetaSeveridad({ severidad }: { readonly severidad: Severidad | null }): ReactNode {
  const clave = severidad ?? 'PENDIENTE';
  return <span className={`${styles.severidad} ${styles[`sev${clave}`] ?? ''}`}>Clasificación: {TEXTO_SEVERIDAD[clave]}</span>;
}

export interface IntencionRevisor {
  readonly alarma: AlarmaDto;
  readonly action: AccionRevisor;
  readonly reason: string;
  readonly severity?: Severidad;
}

/** Acciones ofrecidas según el estado. El servidor vuelve a decidir cada una. */
export function accionesPara(estado: AlarmaDto['state']): readonly AccionRevisor[] {
  switch (estado) {
    case 'NUEVA':
      return ['ACKNOWLEDGE', 'CLASSIFY', 'ASSIGN', 'RESOLVE'];
    case 'EN_GESTION':
      return ['CLASSIFY', 'ASSIGN', 'RESOLVE'];
    case 'RESUELTA':
      return ['CLASSIFY', 'CLOSE', 'REOPEN'];
    case 'CERRADA':
      return ['REOPEN'];
  }
}

const TEXTO_BOTON: Readonly<Record<AccionRevisor, string>> = {
  ACKNOWLEDGE: 'Iniciar revisión',
  CLASSIFY: 'Clasificar',
  ASSIGN: 'Asignármela',
  RESOLVE: 'Marcar resuelta',
  CLOSE: 'Cerrar',
  REOPEN: 'Reabrir',
};

export function BandejaAlarmas({
  alarmas,
  puedeRevisar,
  ocupado,
  onRevisar,
  onInformarResolucion,
  renderDetalle,
  onVerDetalle,
}: {
  readonly alarmas: readonly AlarmaDto[];
  readonly puedeRevisar: boolean;
  readonly ocupado: boolean;
  readonly onRevisar?: (intencion: IntencionRevisor) => void;
  readonly onInformarResolucion?: (alarma: AlarmaDto) => void;
  /** Detalle ya cargado (historia y evidencia), si la persona lo pidió. */
  readonly renderDetalle?: (alarma: AlarmaDto) => ReactNode;
  readonly onVerDetalle?: (alarma: AlarmaDto) => void;
}): ReactNode {
  if (alarmas.length === 0) {
    return <p className={styles.ayuda}>{puedeRevisar ? 'No hay solicitudes en este espacio.' : 'Usted no ha enviado solicitudes en este espacio.'}</p>;
  }

  return (
    <ol className={styles.lista} aria-label={puedeRevisar ? 'Bandeja de solicitudes' : 'Mis solicitudes'}>
      {alarmas.map((alarma) => (
        <li key={alarma.id} className={styles.item}>
          <p className={styles.meta}>
            {alarma.origin === 'MANUAL' ? 'Solicitud manual' : 'Alarma automática'} · {fechaLegible(alarma.createdAt)}
          </p>
          <p>
            <strong>Estado: {TEXTO_ESTADO[alarma.state]}</strong> · <EtiquetaSeveridad severidad={alarma.severity} />
            {alarma.assignedToMe ? ' · Asignada a usted' : alarma.assigned ? ' · Asignada' : ''}
          </p>
          {alarma.state === 'NUEVA' ? (
            <p className={styles.ayuda}>Recibida. Todavía no consta que un profesional la haya revisado.</p>
          ) : null}
          {alarma.note === null ? null : <p>{alarma.note}</p>}
          {alarma.transitions !== undefined && alarma.transitions.length > 0 ? (
            <ol className={styles.enmiendas} aria-label="Historia">
              {alarma.transitions.map((transicion) => (
                <li key={transicion.id}>
                  {TEXTO_ACCION[transicion.action]} · {fechaLegible(transicion.createdAt)}
                  {transicion.reason === null ? '' : ` — ${transicion.reason}`}
                </li>
              ))}
            </ol>
          ) : null}
          {onVerDetalle !== undefined ? (
            <button className={styles.secundario} type="button" onClick={() => onVerDetalle(alarma)}>
              Ver historia y evidencia
            </button>
          ) : null}
          {renderDetalle?.(alarma) ?? null}
          {puedeRevisar && onRevisar !== undefined ? (
            <ControlesRevisor alarma={alarma} ocupado={ocupado} onRevisar={onRevisar} />
          ) : null}
          {!puedeRevisar && alarma.initiatedByMe && onInformarResolucion !== undefined && alarma.state !== 'CERRADA' ? (
            <button className={styles.secundario} type="button" disabled={ocupado} onClick={() => onInformarResolucion(alarma)}>
              Informar que ya se resolvió
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ControlesRevisor({
  alarma,
  ocupado,
  onRevisar,
}: {
  readonly alarma: AlarmaDto;
  readonly ocupado: boolean;
  readonly onRevisar: (intencion: IntencionRevisor) => void;
}): ReactNode {
  const id = useId();
  const [motivo, setMotivo] = useState('');
  const [severidad, setSeveridad] = useState<Severidad | ''>('');

  return (
    <fieldset className={styles.revisor}>
      <legend>Gestión de la solicitud</legend>
      <div className={styles.campo}>
        <label htmlFor={`${id}-motivo`}>Motivo (obligatorio para clasificar, resolver, cerrar o reabrir)</label>
        <input id={`${id}-motivo`} value={motivo} maxLength={2000} onChange={(evento) => setMotivo(evento.target.value)} />
      </div>
      <div className={styles.campo}>
        <label htmlFor={`${id}-severidad`}>Clasificación</label>
        <select id={`${id}-severidad`} value={severidad} onChange={(evento) => setSeveridad(evento.target.value as Severidad | '')}>
          <option value="">Sin cambiar</option>
          <option value="ROJA">{TEXTO_SEVERIDAD.ROJA}</option>
          <option value="AMARILLA">{TEXTO_SEVERIDAD.AMARILLA}</option>
          <option value="ESTABLE">{TEXTO_SEVERIDAD.ESTABLE}</option>
        </select>
      </div>
      <div className={styles.acciones}>
        {accionesPara(alarma.state).map((accion) => (
          <button
            key={accion}
            className={styles.secundario}
            type="button"
            disabled={ocupado || (accion === 'CLASSIFY' && severidad === '')}
            onClick={() =>
              onRevisar({ alarma, action: accion, reason: motivo, ...(accion === 'CLASSIFY' && severidad !== '' ? { severity: severidad } : {}) })
            }
          >
            {TEXTO_BOTON[accion]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/* Datos validados por el profesional                                          */
/* -------------------------------------------------------------------------- */

export interface EnvioDato {
  readonly code: string;
  readonly label: string;
  readonly valueType: TipoDato;
  readonly unit: string;
  readonly options: readonly OpcionDto[];
}

/** Convierte «Opción A, Opción B» en opciones con código estable. */
export function opcionesDesdeTexto(texto: string): readonly OpcionDto[] {
  return texto
    .split(',')
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '')
    .map((label, indice) => ({ code: codigoDesde(label) || `opcion-${indice + 1}`, label }));
}

export function codigoDesde(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48);
}

export function GestorDatos({
  datos,
  enviando,
  onDefinir,
}: {
  readonly datos: readonly DatoDto[];
  readonly enviando: boolean;
  readonly onDefinir: (envio: EnvioDato) => void;
}): ReactNode {
  const id = useId();
  const [etiqueta, setEtiqueta] = useState('');
  const [tipo, setTipo] = useState<TipoDato>('BOOLEAN');
  const [unidad, setUnidad] = useState('');
  const [opciones, setOpciones] = useState('');

  return (
    <section className={styles.formulario} aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`}>Datos que se registran en este espacio</h3>
      <p className={styles.ayuda}>
        Usted valida qué se registra para esta persona. La plataforma no propone valores, umbrales ni
        diagnósticos.
      </p>
      {datos.length === 0 ? <p>No hay datos definidos.</p> : (
        <ul>
          {datos.map((dato) => (
            <li key={dato.id}>
              {dato.label} · versión {dato.version}
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          onDefinir({ code: codigoDesde(etiqueta), label: etiqueta.trim(), valueType: tipo, unit: unidad.trim(), options: opcionesDesdeTexto(opciones) });
        }}
      >
        <div className={styles.campo}>
          <label htmlFor={`${id}-etiqueta`}>Nombre del dato</label>
          <input id={`${id}-etiqueta`} value={etiqueta} maxLength={120} required onChange={(evento) => setEtiqueta(evento.target.value)} />
        </div>
        <div className={styles.campo}>
          <label htmlFor={`${id}-tipo`}>Tipo de respuesta</label>
          <select id={`${id}-tipo`} value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoDato)}>
            <option value="BOOLEAN">Sí o no</option>
            <option value="NUMBER">Número</option>
            <option value="CHOICE">Una opción de una lista</option>
          </select>
        </div>
        {tipo === 'NUMBER' ? (
          <div className={styles.campo}>
            <label htmlFor={`${id}-unidad`}>Unidad (opcional)</label>
            <input id={`${id}-unidad`} value={unidad} maxLength={48} onChange={(evento) => setUnidad(evento.target.value)} />
          </div>
        ) : null}
        {tipo === 'CHOICE' ? (
          <div className={styles.campo}>
            <label htmlFor={`${id}-opciones`}>Opciones, separadas por comas</label>
            <input id={`${id}-opciones`} value={opciones} required onChange={(evento) => setOpciones(evento.target.value)} />
          </div>
        ) : null}
        <p className={styles.ayuda}>Si el nombre ya existe, se crea una versión nueva y la anterior deja de ofrecerse.</p>
        <button className={styles.primario} type="submit" disabled={enviando}>
          Validar dato
        </button>
      </form>
    </section>
  );
}
