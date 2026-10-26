import { useId, useState, type ReactNode } from 'react';

import {
  type Comparador,
  type CriterioDto,
  type DatoDto,
  type DetalleAlarmaDto,
  describirCriterio,
  type ElementoColaDto,
  type EvidenciaDto,
  type FiltroAlarmas,
  type SemaforoDto,
  type Severidad,
  TEXTO_ACCION,
  TEXTO_COMPARADOR,
  TEXTO_ESTADO,
  TEXTO_SEVERIDAD,
  valorLegible,
} from './careClient';
import { ahoraLocal, fechaLegible } from './careViews';
import styles from './care.module.css';

/**
 * Vistas de criterios individuales, semáforo, evidencia y cola de revisión
 * (SPEC 055 / MP04–MP05, MP07B). Presentacionales: no consultan ni guardan nada.
 *
 * - El semáforo SIEMPRE se escribe con palabras; el color es refuerzo.
 * - «Sin criterios vigentes ni solicitudes abiertas» y «sin evaluación» nunca se muestran verdes.
 * - El formulario de criterios no trae valores sugeridos: el visitador escribe
 *   cada valor, la ventana y la clasificación. Al AJUSTAR la misma definición
 *   parte de lo que él mismo validó; con otra definición vuelve a escribir la
 *   comparación y el valor (MP07B / A08).
 */

export function BannerSemaforo({ semaforo }: { readonly semaforo: SemaforoDto }): ReactNode {
  const abiertas = semaforo.openAlarms.ROJA + semaforo.openAlarms.AMARILLA + semaforo.openAlarms.ESTABLE + semaforo.openAlarms.SIN;
  return (
    <div className={`${styles.semaforo} ${styles[`nivel${semaforo.level}`] ?? ''}`} role="status">
      <strong>Semáforo: {semaforo.label}.</strong>{' '}
      <span>
        {abiertas} abierta(s): {semaforo.openAlarms.ROJA} roja(s), {semaforo.openAlarms.AMARILLA} amarilla(s),{' '}
        {semaforo.openAlarms.ESTABLE} estable(s), {semaforo.openAlarms.SIN} pendiente(s) de clasificación. Criterios
        vigentes que se evalúan: {semaforo.activeCriteria}.
        {semaforo.criteriaRequiringRevalidation > 0
          ? ` Criterios que no se evalúan hasta que un profesional los revalide: ${semaforo.criteriaRequiringRevalidation}.`
          : ''}
      </span>
    </div>
  );
}

/**
 * Texto de una evidencia (MP07A / A07). Distingue el valor ORIGINAL del valor
 * EVALUADO y no afirma lo que no se sabe: la evidencia legada no fijó lo
 * evaluado y `correctedAfterwards: null` no es «sin corrección».
 */
export function textoEvidencia(item: EvidenciaDto): readonly string[] {
  const partes = [`Valor registrado (original): ${valorLegible(item.value, item)}`];

  if (item.snapshot === 'LEGACY_UNDETERMINED') {
    partes.push('Valor evaluado: no determinado (evidencia anterior al registro del valor evaluado)');
  } else {
    partes.push(
      `Valor evaluado: ${valorLegible(item.evaluatedValue, item)}${
        item.evaluatedAmendmentSequence === null ? ' (el original)' : ` (según la corrección ${item.evaluatedAmendmentSequence}, vigente al evaluar)`
      }`,
    );
  }

  if (item.correctedAfterwards === true) {
    partes.push('Corregida después de la evaluación: revisar. La alarma no cambia por la corrección');
  } else if (item.correctedAfterwards === null) {
    partes.push('Tiene correcciones y no se puede saber si fueron anteriores o posteriores a la evaluación: revisar');
  }

  return partes;
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
                {item.label} (versión {item.definitionVersion} del dato) · ocurrió {fechaLegible(item.occurredAt)} —{' '}
                {textoEvidencia(item).join('. ')}.
              </li>
            ))}
          </ul>
          <p className={styles.ayuda}>La evidencia muestra lo que cumplió el criterio; no es un diagnóstico.</p>
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

/**
 * Una página ya cargada de la cola. El anticipo de alarmas NO es la bandeja:
 * se dice cuántas abiertas hay y se ofrece recorrerlas todas.
 */
export function ColaRevision({
  cola,
  onAbrir,
}: {
  readonly cola: readonly ElementoColaDto[];
  readonly onAbrir: (elemento: ElementoColaDto, filtro: FiltroAlarmas) => void;
}): ReactNode {
  return (
    <ol className={styles.lista} aria-label="Cola de revisión">
      {cola.map((elemento) => (
        <li key={elemento.contextId} className={styles.item}>
          <p>
            <strong>{elemento.patientLabel}</strong> · {elemento.organizationName}
          </p>
          <BannerSemaforo semaforo={elemento.semaphore} />
          {elemento.openAlarmCount === 0 ? (
            <p className={styles.ayuda}>Sin solicitudes abiertas.</p>
          ) : (
            <>
              <p className={styles.ayuda}>
                {elemento.hasMoreOpenAlarms
                  ? `Se muestran las ${elemento.alarms.length} más recientes de ${elemento.openAlarmCount} abiertas. Abra la bandeja para verlas todas, también las más antiguas.`
                  : `${elemento.openAlarmCount} abierta(s).`}
              </p>
              <ul>
                {elemento.alarms.map((alarma) => (
                  <li key={alarma.id}>
                    {alarma.origin === 'MANUAL' ? 'Solicitud manual' : 'Alarma automática'} · {TEXTO_ESTADO[alarma.state]} ·
                    Clasificación: {TEXTO_SEVERIDAD[alarma.severity ?? 'PENDIENTE']} · {fechaLegible(alarma.createdAt)}
                    {alarma.assignedToMe ? ' · Asignada a usted' : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className={styles.acciones}>
            {elemento.openAlarmCount > 0 ? (
              <button className={styles.secundario} type="button" onClick={() => onAbrir(elemento, 'abiertas')}>
                Ver todas las abiertas ({elemento.openAlarmCount})
              </button>
            ) : null}
            <button className={styles.secundario} type="button" onClick={() => onAbrir(elemento, 'todas')}>
              Abrir este espacio
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface EnvioCriterio {
  /** Solo al AJUSTAR: versión nueva de ESTE criterio, no otra identidad. */
  readonly criterionId?: string;
  /** Definición exacta que el profesional ve y valida (MP07A / A03). */
  readonly observableDefinitionId: string;
  readonly observableCode: string;
  readonly comparator: Comparador;
  readonly value: boolean | string | readonly string[];
  readonly requiredCount: number;
  readonly windowMinutes: number;
  readonly severity: Severidad;
  /** Instante con zona; ausente = sin fecha de fin. */
  readonly validUntil?: string;
}

const UNIDAD_VENTANA = { minutos: 1, horas: 60, dias: 1440 } as const;
type UnidadVentana = keyof typeof UNIDAD_VENTANA;

/** Comparaciones posibles según el tipo del dato. */
export function comparadoresPara(tipo: DatoDto['valueType']): readonly Comparador[] {
  if (tipo === 'BOOLEAN') return ['EQ'];
  if (tipo === 'CHOICE') return ['IN'];
  return ['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ'];
}

/** Borrador del formulario de criterio. Todo texto: nada se inventa. */
export interface BorradorCriterio {
  readonly definicionId: string;
  readonly comparador: Comparador | '';
  readonly valor: string;
  readonly opciones: readonly string[];
  readonly veces: string;
  readonly ventana: string;
  readonly unidad: UnidadVentana;
  readonly severidad: Severidad | '';
  readonly vigencia: string;
}

export const BORRADOR_VACIO: BorradorCriterio = {
  definicionId: '',
  comparador: '',
  valor: '',
  opciones: [],
  veces: '',
  ventana: '',
  unidad: 'horas',
  severidad: '',
  vigencia: '',
};

/** Definición VIGENTE del mismo código que evalúa un criterio, si la hay. */
export function definicionVigenteDe(criterio: CriterioDto, datos: readonly DatoDto[]): DatoDto | null {
  return criterio.current === null ? null : (datos.find((dato) => dato.code === criterio.current?.observableCode) ?? null);
}

/** `true` si la versión vigente evalúa EXACTAMENTE la definición vigente del dato. */
export function mismaDefinicion(criterio: CriterioDto, datos: readonly DatoDto[]): boolean {
  const vigente = definicionVigenteDe(criterio, datos);
  return vigente !== null && criterio.current?.observableDefinition?.id === vigente.id && criterio.current.requiresRevalidation === false;
}

/**
 * Borrador para AJUSTAR un criterio (MP07B / A08).
 *
 * - Misma definición exacta: parte de los parámetros que el profesional ya
 *   validó en la versión vigente, para cambiar solo lo que quiera.
 * - Otra definición (unidad, tipo u opciones distintos, o legado sin
 *   definición): la comparación y el valor se VACÍAN y hay que elegir la
 *   definición vigente a mano. Un umbral no se traslada de una unidad, tipo o
 *   catálogo a otro, ni se convierte. Conteo, ventana y clasificación quedan
 *   visibles y editables: no dependen de la unidad.
 */
export function borradorDesdeCriterio(criterio: CriterioDto, datos: readonly DatoDto[], ahora: Date = new Date()): BorradorCriterio {
  const version = criterio.current;
  if (version === null) return BORRADOR_VACIO;

  const ventana =
    version.windowMinutes % UNIDAD_VENTANA.dias === 0
      ? { ventana: String(version.windowMinutes / UNIDAD_VENTANA.dias), unidad: 'dias' as const }
      : version.windowMinutes % UNIDAD_VENTANA.horas === 0
        ? { ventana: String(version.windowMinutes / UNIDAD_VENTANA.horas), unidad: 'horas' as const }
        : { ventana: String(version.windowMinutes), unidad: 'minutos' as const };
  const comunes = { ...BORRADOR_VACIO, veces: String(version.requiredCount), ...ventana, severidad: version.severity };

  if (!mismaDefinicion(criterio, datos)) {
    return comunes;
  }

  const fin = version.validUntil === null ? null : new Date(version.validUntil);
  return {
    ...comunes,
    definicionId: version.observableDefinition?.id ?? '',
    comparador: version.comparator,
    valor: typeof version.value === 'boolean' ? (version.value ? 'si' : 'no') : Array.isArray(version.value) ? '' : String(version.value),
    opciones: Array.isArray(version.value) ? [...version.value] : [],
    vigencia: fin !== null && fin.getTime() > ahora.getTime() ? ahoraLocal(fin) : '',
  };
}

/** Campo local de vigencia a instante con zona; `null` si vacío/ inválido/ pasado. */
export function vigenciaDesdeLocal(valor: string, ahora: Date = new Date()): string | null {
  const fecha = new Date(valor);
  if (valor === '' || Number.isNaN(fecha.getTime()) || fecha.getTime() <= ahora.getTime()) return null;
  return fecha.toISOString();
}

/** Envío listo, o `null` si falta algo. No completa ningún valor por su cuenta. */
export function envioDesdeBorrador(
  borrador: BorradorCriterio,
  dato: DatoDto | null,
  criterionId: string | null,
  ahora: Date = new Date(),
): EnvioCriterio | null {
  if (dato === null || borrador.definicionId !== dato.id || borrador.comparador === '' || borrador.severidad === '') return null;
  const veces = Number(borrador.veces);
  const ventana = Number(borrador.ventana);
  if (!Number.isInteger(veces) || veces < 1 || !Number.isInteger(ventana) || ventana < 1) return null;
  if (!comparadoresPara(dato.valueType).includes(borrador.comparador)) return null;
  if (dato.valueType === 'CHOICE' ? borrador.opciones.length === 0 : borrador.valor.trim() === '') return null;
  const vigencia = borrador.vigencia === '' ? null : vigenciaDesdeLocal(borrador.vigencia, ahora);
  if (borrador.vigencia !== '' && vigencia === null) return null;

  return {
    ...(criterionId === null ? {} : { criterionId }),
    observableDefinitionId: dato.id,
    observableCode: dato.code,
    comparator: borrador.comparador,
    value: dato.valueType === 'CHOICE' ? borrador.opciones : dato.valueType === 'BOOLEAN' ? borrador.valor === 'si' : borrador.valor.trim(),
    requiredCount: veces,
    windowMinutes: ventana * UNIDAD_VENTANA[borrador.unidad],
    severity: borrador.severidad,
    ...(vigencia === null ? {} : { validUntil: vigencia }),
  };
}

function textoDefinicion(definicion: { readonly label: string; readonly version: number; readonly unit: string | null }): string {
  return `${definicion.label}, versión ${definicion.version}${definicion.unit === null ? ', sin unidad' : `, unidad ${definicion.unit}`}`;
}

export function GestorCriterios({
  datos,
  criterios,
  enviando,
  ronda,
  onDefinir,
  onRetirar,
}: {
  readonly datos: readonly DatoDto[];
  readonly criterios: readonly CriterioDto[];
  readonly enviando: boolean;
  /** Cambia solo cuando el servidor confirmó un criterio de ESTE formulario. */
  readonly ronda: number;
  readonly onDefinir: (envio: EnvioCriterio) => void;
  readonly onRetirar: (criterio: CriterioDto, motivo: string) => void;
}): ReactNode {
  const id = useId();
  const [ajuste, setAjuste] = useState<CriterioDto | null>(null);
  const [borrador, setBorrador] = useState<BorradorCriterio>(BORRADOR_VACIO);
  const [motivos, setMotivos] = useState<Readonly<Record<string, string>>>({});
  const [rondaVista, setRondaVista] = useState(ronda);

  // Criterio confirmado: se vacía su borrador; los motivos de retiro siguen.
  if (rondaVista !== ronda) {
    setRondaVista(ronda);
    setAjuste(null);
    setBorrador(BORRADOR_VACIO);
  }

  const cambiar = (parcial: Partial<BorradorCriterio>): void => setBorrador((previo) => ({ ...previo, ...parcial }));
  const etiqueta = (code: string): string => datos.find((item) => item.code === code)?.label ?? code;

  // Al ajustar, solo se ofrece la definición VIGENTE del mismo dato.
  const vigenteAjuste = ajuste === null ? null : definicionVigenteDe(ajuste, datos);
  const ofrecidos = ajuste === null ? datos : vigenteAjuste === null ? [] : [vigenteAjuste];
  const dato = ofrecidos.find((item) => item.id === borrador.definicionId) ?? null;
  const envio = envioDesdeBorrador(borrador, dato, ajuste?.id ?? null);
  const otraDefinicion = ajuste !== null && !mismaDefinicion(ajuste, datos);
  const definicionAjuste = ajuste?.current?.observableDefinition ?? null;

  const empezarAjuste = (criterio: CriterioDto): void => {
    setAjuste(criterio);
    setBorrador(borradorDesdeCriterio(criterio, datos));
  };
  const cancelarAjuste = (): void => {
    setAjuste(null);
    setBorrador(BORRADOR_VACIO);
  };

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
          {criterios.map((criterio) => {
            const version = criterio.current;
            return (
              <li key={criterio.id} className={styles.item}>
                <p>
                  {version === null
                    ? 'Sin versión'
                    : describirCriterio(version, version.observableDefinition?.label ?? etiqueta(version.observableCode))}
                  {criterio.status === 'RETIRED' ? ` · Retirado: ${criterio.retiredReason ?? ''}` : ` · versión ${version?.version ?? ''}`}
                </p>
                {version === null ? null : (
                  <p className={styles.ayuda}>
                    {version.observableDefinition === null
                      ? 'Evalúa: versión anterior sin definición exacta del dato.'
                      : `Evalúa: ${textoDefinicion(version.observableDefinition)}.`}{' '}
                    {version.validUntil === null ? 'Sin fecha de fin.' : `Vigente hasta ${fechaLegible(version.validUntil)}.`}
                  </p>
                )}
                {criterio.status === 'ACTIVE' && version?.requiresRevalidation === true ? (
                  <p className={styles.aviso}>
                    Pendiente de revalidar: el dato cambió o esta versión es anterior a la definición exacta. No se evalúa
                    hasta que usted valide una versión nueva.
                  </p>
                ) : null}
                {criterio.status === 'ACTIVE' ? (
                  <div className={styles.acciones}>
                    <button className={styles.secundario} type="button" disabled={enviando} onClick={() => empezarAjuste(criterio)}>
                      {version?.requiresRevalidation === true ? 'Revalidar (nueva versión)' : 'Ajustar (nueva versión)'}
                    </button>
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
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {datos.length === 0 && ajuste === null ? (
        <p className={styles.ayuda}>Primero valide al menos un dato a registrar.</p>
      ) : (
        <form
          aria-labelledby={`${id}-form`}
          onSubmit={(evento) => {
            evento.preventDefault();
            if (envio === null) return;
            onDefinir(envio);
          }}
        >
          <h4 id={`${id}-form`}>
            {ajuste === null ? 'Nuevo criterio' : `Ajustar el criterio: versión ${(ajuste.current?.version ?? 0) + 1}`}
          </h4>

          {ajuste === null ? null : (
            <div className={styles.aviso}>
              <p>
                Se crea una versión nueva de ESTE mismo criterio; no es un criterio distinto. Cuenta solo lo que ocurra a
                partir de ahora. La versión anterior se conserva en el historial y, si hay una alarma abierta de este
                criterio, sigue abierta con su evidencia: las coincidencias nuevas se agregan a ella.
              </p>
              <p>
                Ahora evalúa:{' '}
                {definicionAjuste === null
                  ? 'una versión anterior sin definición exacta del dato'
                  : textoDefinicion(definicionAjuste)}
                .
              </p>
              {otraDefinicion ? (
                <p>
                  {vigenteAjuste === null
                    ? 'Este dato ya no tiene una versión vigente: valide primero el dato.'
                    : `La versión vigente del dato es otra (${textoDefinicion(vigenteAjuste)}). Elíjala y vuelva a escribir la comparación y el valor: no se trasladan ni se convierten desde la versión anterior.`}
                </p>
              ) : null}
            </div>
          )}

          <div className={styles.campo}>
            <label htmlFor={`${id}-dato`}>{ajuste === null ? 'Dato' : 'Versión del dato que se evaluará'}</label>
            <select
              id={`${id}-dato`}
              value={borrador.definicionId}
              onChange={(evento) => cambiar({ definicionId: evento.target.value, comparador: '', valor: '', opciones: [] })}
              required
            >
              <option value="">{ajuste === null ? 'Elija un dato' : 'Elija la versión vigente'}</option>
              {ofrecidos.map((item) => (
                <option key={item.id} value={item.id}>
                  {textoDefinicion(item)}
                </option>
              ))}
            </select>
          </div>

          {dato === null ? null : (
            <>
              <div className={styles.campo}>
                <label htmlFor={`${id}-comparador`}>Comparación</label>
                <select
                  id={`${id}-comparador`}
                  value={borrador.comparador}
                  onChange={(evento) => cambiar({ comparador: evento.target.value as Comparador | '' })}
                  required
                >
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
                  <select id={`${id}-valor`} value={borrador.valor} onChange={(evento) => cambiar({ valor: evento.target.value })} required>
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
                        checked={borrador.opciones.includes(opcion.code)}
                        onChange={(evento) =>
                          cambiar({
                            opciones: evento.target.checked
                              ? [...borrador.opciones, opcion.code]
                              : borrador.opciones.filter((code) => code !== opcion.code),
                          })
                        }
                      />
                      {opcion.label}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <div className={styles.campo}>
                  <label htmlFor={`${id}-valor`}>Valor{dato.unit === null ? '' : ` (${dato.unit})`}</label>
                  <input
                    id={`${id}-valor`}
                    inputMode="decimal"
                    value={borrador.valor}
                    onChange={(evento) => cambiar({ valor: evento.target.value })}
                    required
                  />
                </div>
              )}
            </>
          )}

          <div className={styles.campo}>
            <label htmlFor={`${id}-veces`}>¿Cuántas veces debe ocurrir?</label>
            <input id={`${id}-veces`} inputMode="numeric" value={borrador.veces} onChange={(evento) => cambiar({ veces: evento.target.value })} required />
          </div>

          <div className={styles.campo}>
            <label htmlFor={`${id}-ventana`}>¿En qué ventana de tiempo?</label>
            <input
              id={`${id}-ventana`}
              inputMode="numeric"
              value={borrador.ventana}
              onChange={(evento) => cambiar({ ventana: evento.target.value })}
              required
            />
            <label htmlFor={`${id}-unidad`} className={styles.oculto}>
              Unidad de la ventana
            </label>
            <select id={`${id}-unidad`} value={borrador.unidad} onChange={(evento) => cambiar({ unidad: evento.target.value as UnidadVentana })}>
              <option value="minutos">minutos</option>
              <option value="horas">horas</option>
              <option value="dias">días</option>
            </select>
          </div>

          <div className={styles.campo}>
            <label htmlFor={`${id}-severidad`}>Clasificación de la alarma</label>
            <select
              id={`${id}-severidad`}
              value={borrador.severidad}
              onChange={(evento) => cambiar({ severidad: evento.target.value as Severidad | '' })}
              required
            >
              <option value="">Elija la clasificación</option>
              <option value="ROJA">{TEXTO_SEVERIDAD.ROJA}</option>
              <option value="AMARILLA">{TEXTO_SEVERIDAD.AMARILLA}</option>
              <option value="ESTABLE">{TEXTO_SEVERIDAD.ESTABLE}</option>
            </select>
          </div>

          <div className={styles.campo}>
            <label htmlFor={`${id}-vigencia`}>Vigente hasta (opcional)</label>
            <input
              id={`${id}-vigencia`}
              type="datetime-local"
              value={borrador.vigencia}
              min={ahoraLocal()}
              onChange={(evento) => cambiar({ vigencia: evento.target.value })}
              aria-describedby={`${id}-vigencia-ayuda`}
            />
            <p className={styles.ayuda} id={`${id}-vigencia-ayuda`}>
              Si lo deja vacío, el criterio no tiene fecha de fin. Al vencer deja de evaluarse; eso no indica estabilidad.
            </p>
          </div>

          <p className={styles.ayuda}>El criterio cuenta solo lo que ocurra a partir de ahora.</p>
          <div className={styles.acciones}>
            <button className={styles.primario} type="submit" disabled={enviando || envio === null}>
              {ajuste === null ? 'Validar criterio' : 'Validar versión nueva'}
            </button>
            {ajuste === null ? null : (
              <button className={styles.secundario} type="button" onClick={cancelarAjuste}>
                Cancelar el ajuste
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
