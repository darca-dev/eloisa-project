import { useId, useState, type ReactNode } from 'react';

import {
  type Comparador,
  type CriterioDto,
  type DatoDto,
  type DetalleAlarmaDto,
  describirCriterio,
  type ElementoColaDto,
  type SemaforoDto,
  type Severidad,
  TEXTO_ACCION,
  TEXTO_COMPARADOR,
  TEXTO_ESTADO,
  TEXTO_SEVERIDAD,
  valorLegible,
} from './careClient';
import { fechaLegible } from './careViews';
import styles from './care.module.css';

/**
 * Vistas de criterios individuales, semáforo, evidencia y cola de revisión
 * (SPEC 055 / MP04–MP05). Presentacionales: no consultan ni guardan nada.
 *
 * - El semáforo SIEMPRE se escribe con palabras; el color es refuerzo.
 * - «Sin criterios ni solicitudes» nunca se muestra como verde.
 * - El formulario de criterios no trae valores sugeridos: el visitador escribe
 *   cada valor, la ventana y la clasificación.
 */

export function BannerSemaforo({ semaforo }: { readonly semaforo: SemaforoDto }): ReactNode {
  const abiertas = semaforo.openAlarms.ROJA + semaforo.openAlarms.AMARILLA + semaforo.openAlarms.ESTABLE + semaforo.openAlarms.SIN;
  return (
    <div className={`${styles.semaforo} ${styles[`nivel${semaforo.level}`] ?? ''}`} role="status">
      <strong>Semáforo: {semaforo.label}.</strong>{' '}
      <span>
        {abiertas} abierta(s): {semaforo.openAlarms.ROJA} roja(s), {semaforo.openAlarms.AMARILLA} amarilla(s),{' '}
        {semaforo.openAlarms.ESTABLE} estable(s), {semaforo.openAlarms.SIN} pendiente(s) de clasificación. Criterios
        vigentes: {semaforo.activeCriteria}.
      </span>
    </div>
  );
}

export function DetalleAlarma({ detalle }: { readonly detalle: DetalleAlarmaDto }): ReactNode {
  return (
    <div className={styles.detalle}>
      {detalle.evidence.length === 0 ? null : (
        <>
          <h4>Por qué se generó</h4>
          <ul aria-label="Evidencia del criterio">
            {detalle.evidence.map((item, indice) => (
              <li key={`${item.occurredAt}-${indice}`}>
                {item.label}: {valorLegible(item.value, item)} · {fechaLegible(item.occurredAt)}
                {item.correctedAfterwards ? ' · Corregida después: revisar' : ''}
              </li>
            ))}
          </ul>
        </>
      )}
      <h4>Historia</h4>
      <ol>
        {detalle.transitions.map((transicion) => (
          <li key={transicion.id}>
            {TEXTO_ACCION[transicion.action]} · {fechaLegible(transicion.createdAt)}
            {transicion.reason === null ? '' : ` — ${transicion.reason}`}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ColaRevision({
  cola,
  onAbrir,
}: {
  readonly cola: readonly ElementoColaDto[];
  readonly onAbrir: (contextId: string) => void;
}): ReactNode {
  if (cola.length === 0) {
    return <p className={styles.ayuda}>No tiene espacios de cuidado para revisar.</p>;
  }

  return (
    <ol className={styles.lista} aria-label="Cola de revisión">
      {cola.map((elemento) => (
        <li key={elemento.contextId} className={styles.item}>
          <p>
            <strong>{elemento.patientLabel}</strong> · {elemento.organizationName}
          </p>
          <BannerSemaforo semaforo={elemento.semaphore} />
          {elemento.alarms.length === 0 ? (
            <p className={styles.ayuda}>Sin solicitudes abiertas.</p>
          ) : (
            <ul>
              {elemento.alarms.map((alarma) => (
                <li key={alarma.id}>
                  {alarma.origin === 'MANUAL' ? 'Solicitud manual' : 'Alarma automática'} · {TEXTO_ESTADO[alarma.state]} ·
                  Clasificación: {TEXTO_SEVERIDAD[alarma.severity ?? 'PENDIENTE']} · {fechaLegible(alarma.createdAt)}
                  {alarma.assignedToMe ? ' · Asignada a usted' : ''}
                </li>
              ))}
            </ul>
          )}
          <button className={styles.secundario} type="button" onClick={() => onAbrir(elemento.contextId)}>
            Abrir este espacio
          </button>
        </li>
      ))}
    </ol>
  );
}

export interface EnvioCriterio {
  readonly criterionId?: string;
  readonly observableCode: string;
  readonly comparator: Comparador;
  readonly value: boolean | string | readonly string[];
  readonly requiredCount: number;
  readonly windowMinutes: number;
  readonly severity: Severidad;
}

const UNIDAD_VENTANA = { minutos: 1, horas: 60, dias: 1440 } as const;

/** Comparaciones posibles según el tipo del dato. */
export function comparadoresPara(tipo: DatoDto['valueType']): readonly Comparador[] {
  if (tipo === 'BOOLEAN') return ['EQ'];
  if (tipo === 'CHOICE') return ['IN'];
  return ['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ'];
}

export function GestorCriterios({
  datos,
  criterios,
  enviando,
  onDefinir,
  onRetirar,
}: {
  readonly datos: readonly DatoDto[];
  readonly criterios: readonly CriterioDto[];
  readonly enviando: boolean;
  readonly onDefinir: (envio: EnvioCriterio) => void;
  readonly onRetirar: (criterio: CriterioDto, motivo: string) => void;
}): ReactNode {
  const id = useId();
  const [codigo, setCodigo] = useState('');
  const [comparador, setComparador] = useState<Comparador | ''>('');
  const [valor, setValor] = useState('');
  const [opciones, setOpciones] = useState<readonly string[]>([]);
  const [veces, setVeces] = useState('');
  const [ventana, setVentana] = useState('');
  const [unidad, setUnidad] = useState<keyof typeof UNIDAD_VENTANA>('horas');
  const [severidad, setSeveridad] = useState<Severidad | ''>('');
  const [motivos, setMotivos] = useState<Readonly<Record<string, string>>>({});

  const dato = datos.find((item) => item.code === codigo) ?? null;
  const etiqueta = (code: string): string => datos.find((item) => item.code === code)?.label ?? code;

  const listo =
    dato !== null &&
    comparador !== '' &&
    severidad !== '' &&
    Number.isInteger(Number(veces)) &&
    Number(veces) >= 1 &&
    Number.isInteger(Number(ventana)) &&
    Number(ventana) >= 1 &&
    (dato.valueType === 'CHOICE' ? opciones.length > 0 : valor !== '');

  return (
    <section className={styles.formulario} aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`}>Criterios de alarma de esta persona</h3>
      <p className={styles.ayuda}>
        Usted define cuándo se genera una alarma automática: qué dato, con qué comparación, cuántas veces y en qué
        ventana. La plataforma no sugiere valores clínicos. Sin criterio no hay alarma automática.
      </p>

      {criterios.length === 0 ? (
        <p>No hay criterios definidos.</p>
      ) : (
        <ul aria-label="Criterios">
          {criterios.map((criterio) => (
            <li key={criterio.id}>
              {criterio.current === null ? 'Sin versión' : describirCriterio(criterio.current, etiqueta(criterio.current.observableCode))}
              {criterio.status === 'RETIRED' ? ` · Retirado: ${criterio.retiredReason ?? ''}` : ` · versión ${criterio.current?.version ?? ''}`}
              {criterio.status === 'ACTIVE' ? (
                <span className={styles.acciones}>
                  <label htmlFor={`${id}-retiro-${criterio.id}`} className={styles.oculto}>
                    Motivo del retiro
                  </label>
                  <input
                    id={`${id}-retiro-${criterio.id}`}
                    placeholder="Motivo del retiro"
                    value={motivos[criterio.id] ?? ''}
                    onChange={(evento) => setMotivos((previo) => ({ ...previo, [criterio.id]: evento.target.value }))}
                  />
                  <button
                    className={styles.secundario}
                    type="button"
                    disabled={enviando || (motivos[criterio.id] ?? '').trim() === ''}
                    onClick={() => onRetirar(criterio, motivos[criterio.id] ?? '')}
                  >
                    Retirar
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {datos.length === 0 ? (
        <p className={styles.ayuda}>Primero valide al menos un dato a registrar.</p>
      ) : (
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            // `listo` ya garantiza dato, comparación y clasificación elegidos.
            if (!listo) return;
            onDefinir({
              observableCode: dato.code,
              comparator: comparador,
              value: dato.valueType === 'CHOICE' ? opciones : dato.valueType === 'BOOLEAN' ? valor === 'si' : valor.trim(),
              requiredCount: Number(veces),
              windowMinutes: Number(ventana) * UNIDAD_VENTANA[unidad],
              severity: severidad,
            });
          }}
        >
          <div className={styles.campo}>
            <label htmlFor={`${id}-dato`}>Dato</label>
            <select
              id={`${id}-dato`}
              value={codigo}
              onChange={(evento) => {
                setCodigo(evento.target.value);
                setComparador('');
                setValor('');
                setOpciones([]);
              }}
              required
            >
              <option value="">Elija un dato</option>
              {datos.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {dato === null ? null : (
            <>
              <div className={styles.campo}>
                <label htmlFor={`${id}-comparador`}>Comparación</label>
                <select id={`${id}-comparador`} value={comparador} onChange={(evento) => setComparador(evento.target.value as Comparador)} required>
                  <option value="">Elija la comparación</option>
                  {comparadoresPara(dato.valueType).map((item) => (
                    <option key={item} value={item}>
                      {TEXTO_COMPARADOR[item]}
                    </option>
                  ))}
                </select>
              </div>

              {dato.valueType === 'BOOLEAN' ? (
                <div className={styles.campo}>
                  <label htmlFor={`${id}-valor`}>Respuesta</label>
                  <select id={`${id}-valor`} value={valor} onChange={(evento) => setValor(evento.target.value)} required>
                    <option value="">Elija</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </div>
              ) : dato.valueType === 'CHOICE' ? (
                <fieldset className={styles.campo}>
                  <legend>Opciones que generan la alarma</legend>
                  {(dato.options ?? []).map((opcion) => (
                    <label key={opcion.code} className={styles.opcion}>
                      <input
                        type="checkbox"
                        checked={opciones.includes(opcion.code)}
                        onChange={(evento) =>
                          setOpciones((previo) =>
                            evento.target.checked ? [...previo, opcion.code] : previo.filter((code) => code !== opcion.code),
                          )
                        }
                      />
                      {opcion.label}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <div className={styles.campo}>
                  <label htmlFor={`${id}-valor`}>Valor{dato.unit === null ? '' : ` (${dato.unit})`}</label>
                  <input id={`${id}-valor`} inputMode="decimal" value={valor} onChange={(evento) => setValor(evento.target.value)} required />
                </div>
              )}

              <div className={styles.campo}>
                <label htmlFor={`${id}-veces`}>¿Cuántas veces debe ocurrir?</label>
                <input id={`${id}-veces`} inputMode="numeric" value={veces} onChange={(evento) => setVeces(evento.target.value)} required />
              </div>

              <div className={styles.campo}>
                <label htmlFor={`${id}-ventana`}>¿En qué ventana de tiempo?</label>
                <input id={`${id}-ventana`} inputMode="numeric" value={ventana} onChange={(evento) => setVentana(evento.target.value)} required />
                <label htmlFor={`${id}-unidad`} className={styles.oculto}>
                  Unidad de la ventana
                </label>
                <select id={`${id}-unidad`} value={unidad} onChange={(evento) => setUnidad(evento.target.value as keyof typeof UNIDAD_VENTANA)}>
                  <option value="minutos">minutos</option>
                  <option value="horas">horas</option>
                  <option value="dias">días</option>
                </select>
              </div>

              <div className={styles.campo}>
                <label htmlFor={`${id}-severidad`}>Clasificación de la alarma</label>
                <select id={`${id}-severidad`} value={severidad} onChange={(evento) => setSeveridad(evento.target.value as Severidad)} required>
                  <option value="">Elija la clasificación</option>
                  <option value="ROJA">{TEXTO_SEVERIDAD.ROJA}</option>
                  <option value="AMARILLA">{TEXTO_SEVERIDAD.AMARILLA}</option>
                  <option value="ESTABLE">{TEXTO_SEVERIDAD.ESTABLE}</option>
                </select>
              </div>
            </>
          )}

          <p className={styles.ayuda}>El criterio cuenta solo lo que ocurra a partir de ahora.</p>
          <button className={styles.primario} type="submit" disabled={enviando || !listo}>
            Validar criterio
          </button>
        </form>
      )}
    </section>
  );
}
