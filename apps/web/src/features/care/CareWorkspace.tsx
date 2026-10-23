'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  acumular,
  type AlarmaDto,
  careClient,
  careCriteriosClient,
  type ContextoCuidadoDto,
  type CriterioDto,
  type DatoDto,
  type DetalleAlarmaDto,
  type ElementoColaDto,
  type FiltroAlarmas,
  nuevaClaveEnvio,
  type RegistroDto,
  type Resultado,
  type SemaforoDto,
} from './careClient';
import { BannerSemaforo, ColaRevision, DetalleAlarma, type EnvioCriterio, GestorCriterios } from './careCriteriaViews';
import {
  BandejaAlarmas,
  ControlPagina,
  type EnvioDato,
  type EnvioRegistro,
  type EstadoGeneral,
  FormularioRegistro,
  GestorDatos,
  instanteDesdeLocal,
  type IntencionRevisor,
  ListaRegistros,
  SelectorContexto,
  SolicitudRevision,
  TEXTO_ERROR_PAGINA,
  VistaEstadoGeneral,
} from './careViews';
import styles from './care.module.css';

/**
 * Espacio de cuidado compartido por los cuatro portales (SPEC 055 / MP02–MP03,
 * MP07B).
 *
 * UNA sola implementación para paciente, cuidador, profesional y hospital: lo
 * que cada uno ve lo decide el SERVIDOR con las acciones que concede en cada
 * contexto, no el perfil de la página. El perfil solo elige el título y el
 * orden de los apartados.
 *
 * Ciclo por contexto (MP07B / A02). `CareWorkspace` solo administra la sesión,
 * el directorio y la cola. TODO lo de un paciente —formularios y borradores,
 * claves idempotentes, datos, detalle, recibo, mensajes y mutaciones— vive en
 * `EspacioContexto`, que se monta con `key` = contexto + ciclo de selección.
 * Cambiar de paciente DESMONTA ese subárbol: los borradores desaparecen, sus
 * cargas se abortan y cada respuesta tardía —aunque el servidor ya haya
 * confirmado la escritura en el paciente anterior— se descarta porque se
 * comprueba contra la instancia que la pidió, nunca contra la actual.
 *
 * - Nada se guarda en el almacenamiento del navegador ni en caché offline.
 * - Cada envío conserva su `idempotencyKey` hasta que el servidor confirma, de
 *   modo que «Volver a intentar» no duplica DENTRO del mismo ciclo.
 * - Las listas se paginan con el cursor del servidor y se distinguen lo
 *   cargado del total; un fallo de página no es el final (A06).
 * - Sin sesión se limpia todo lo mostrado.
 * - Los mensajes se anuncian en regiones `aria-live`.
 */

export type PerfilCuidado = 'paciente' | 'cuidador' | 'profesional' | 'hospital';

const TITULOS: Readonly<Record<PerfilCuidado, string>> = {
  paciente: 'Mi cuidado',
  cuidador: 'Bitácora de cuidado',
  profesional: 'Bitácora y datos de mis pacientes',
  hospital: 'Solicitudes de revisión y alarmas',
};

/** Texto de Hospital sobre el motor VIGENTE y sus límites (MP07B / A10). */
export const TEXTO_MOTOR_HOSPITAL =
  'Aquí llegan las solicitudes de revisión y las alarmas de los espacios de cuidado que usted puede revisar. ' +
  'Una alarma automática se genera al guardar una entrada, cuando se cumple un criterio individual que un profesional ' +
  'validó para esa persona; sin criterio vigente no hay alarma automática. La plataforma no evalúa por reloj ni ' +
  'envía avisos fuera de esta bandeja. Las solicitudes manuales llegan sin clasificar: la clasificación la decide ' +
  'un profesional autorizado.';

type Fetch = typeof fetch;

function estadoDe<T>(resultado: Resultado<T>): EstadoGeneral {
  if (resultado.kind === 'sin-sesion') return 'sin-sesion';
  if (resultado.kind === 'denegado') return 'denegado';
  return 'indisponible';
}

const claveContexto = (contexto: ContextoCuidadoDto): string => contexto.contextId;
const claveId = (item: { readonly id: string }): string => item.id;

interface Lista<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly cargando: boolean;
  readonly error: string | null;
}

function listaDe<T>(items: readonly T[], nextCursor: string | null): Lista<T> {
  return { items, nextCursor, cargando: false, error: null };
}

interface Seleccion {
  readonly contextId: string;
  /** Ciclo de selección: cada elección monta un `EspacioContexto` nuevo. */
  readonly ciclo: number;
  readonly filtro: FiltroAlarmas;
}

export function CareWorkspace({
  perfil,
  fetchImpl,
  titulo,
  encabezado = 'h2',
  accesoSinSesion,
}: {
  readonly perfil: PerfilCuidado;
  readonly fetchImpl?: Fetch;
  /** Título visible; por defecto el del perfil. */
  readonly titulo?: string;
  /** `h1` cuando el espacio ES la vista principal de la página. */
  readonly encabezado?: 'h1' | 'h2';
  /** Entrada humana existente que se ofrece cuando no hay sesión. */
  readonly accesoSinSesion?: ReactNode;
}): ReactNode {
  const Encabezado = encabezado;
  const f = fetchImpl ?? fetch;
  const [estado, setEstado] = useState<EstadoGeneral | 'listo'>('cargando');
  const [directorio, setDirectorio] = useState<Lista<ContextoCuidadoDto>>(listaDe([], null));
  /** Contextos abiertos desde la cola que no están en las páginas cargadas del directorio. */
  const [desdeCola, setDesdeCola] = useState<readonly ContextoCuidadoDto[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [cola, setCola] = useState<(Lista<ElementoColaDto> & { readonly estado: 'cargando' | 'lista' | 'error' }) | null>(null);
  /**
   * Ciclo de la sesión y del directorio. Cualquier respuesta de directorio o
   * cola pedida en un ciclo anterior se descarta.
   */
  const sesion = useRef(0);
  const control = useRef<AbortController | null>(null);
  const ciclo = useRef(0);

  const nuevoCicloDeSesion = useCallback((): { readonly propio: number; readonly signal: AbortSignal } => {
    control.current?.abort();
    const nuevo = new AbortController();
    control.current = nuevo;
    sesion.current += 1;
    return { propio: sesion.current, signal: nuevo.signal };
  }, []);

  const vigente = useCallback((propio: number, signal: AbortSignal): boolean => propio === sesion.current && !signal.aborted, []);

  /** Sin sesión NO queda nada a la vista: ni paciente, ni cola, ni selección. */
  const perderSesion = useCallback((): void => {
    nuevoCicloDeSesion();
    setDirectorio(listaDe([], null));
    setDesdeCola([]);
    setSeleccion(null);
    setCola(null);
    setEstado('sin-sesion');
  }, [nuevoCicloDeSesion]);

  const cargarCola = useCallback(
    async (propio: number, signal: AbortSignal): Promise<void> => {
      if (perfil !== 'hospital') return;
      setCola({ ...listaDe([], null), cargando: true, estado: 'cargando' });
      const resultado = await careCriteriosClient.cola(f, signal);
      if (!vigente(propio, signal) || resultado.kind === 'cancelado') return;
      if (resultado.kind === 'sin-sesion') {
        perderSesion();
        return;
      }
      setCola(
        resultado.kind === 'ok'
          ? { ...listaDe(resultado.data.items, resultado.data.nextCursor), estado: 'lista' }
          : { ...listaDe([], null), estado: 'error' },
      );
    },
    [f, perfil, perderSesion, vigente],
  );

  const cargarDirectorio = useCallback(async (): Promise<void> => {
    const { propio, signal } = nuevoCicloDeSesion();
    setDirectorio(listaDe([], null));
    setDesdeCola([]);
    setSeleccion(null);
    setCola(null);
    setEstado('cargando');

    const resultado = await careClient.contextos(f, signal);
    if (!vigente(propio, signal) || resultado.kind === 'cancelado') return;
    if (resultado.kind !== 'ok') {
      if (resultado.kind === 'sin-sesion') perderSesion();
      else setEstado(estadoDe(resultado));
      return;
    }

    const { items, nextCursor } = resultado.data;
    setDirectorio(listaDe(items, nextCursor));
    const unico = items.length === 1 && nextCursor === null ? items[0] : undefined;
    if (unico !== undefined) {
      ciclo.current += 1;
      setSeleccion({ contextId: unico.contextId, ciclo: ciclo.current, filtro: 'todas' });
    }
    // Una página vacía CON cursor no es «sin espacios»: quedan por revisar.
    setEstado(items.length === 0 && nextCursor === null ? 'vacio' : 'listo');
    void cargarCola(propio, signal);
  }, [f, cargarCola, nuevoCicloDeSesion, perderSesion, vigente]);

  useEffect(() => {
    void cargarDirectorio();
    return () => {
      // Al desmontar, ninguna respuesta de directorio o cola llega a la vista.
      sesion.current += 1;
      control.current?.abort();
    };
  }, [cargarDirectorio]);

  const masDirectorio = async (): Promise<void> => {
    const signal = control.current?.signal;
    const cursor = directorio.nextCursor;
    if (signal === undefined || cursor === null) return;
    const propio = sesion.current;
    setDirectorio((previo) => ({ ...previo, cargando: true, error: null }));

    const resultado = await careClient.contextos(f, signal, cursor);
    if (!vigente(propio, signal) || resultado.kind === 'cancelado') return;
    if (resultado.kind === 'sin-sesion') {
      perderSesion();
      return;
    }
    if (resultado.kind !== 'ok') {
      setDirectorio((previo) => ({ ...previo, cargando: false, error: TEXTO_ERROR_PAGINA }));
      return;
    }
    setDirectorio((previo) => listaDe(acumular(previo.items, resultado.data.items, claveContexto), resultado.data.nextCursor));
    if (directorio.items.length === 0 && resultado.data.items.length === 0 && resultado.data.nextCursor === null && desdeCola.length === 0) {
      setEstado('vacio');
    }
  };

  const masCola = async (): Promise<void> => {
    const signal = control.current?.signal;
    const cursor = cola?.nextCursor ?? null;
    if (signal === undefined || cursor === null) return;
    const propio = sesion.current;
    setCola((previo) => (previo === null ? previo : { ...previo, cargando: true, error: null }));

    const resultado = await careCriteriosClient.cola(f, signal, cursor);
    if (!vigente(propio, signal) || resultado.kind === 'cancelado') return;
    if (resultado.kind === 'sin-sesion') {
      perderSesion();
      return;
    }
    setCola((previo) =>
      previo === null
        ? previo
        : resultado.kind === 'ok'
          ? { ...listaDe(acumular(previo.items, resultado.data.items, claveContexto), resultado.data.nextCursor), estado: 'lista' }
          : { ...previo, cargando: false, error: TEXTO_ERROR_PAGINA },
    );
  };

  /** Tras una mutación confirmada la cola vuelve a pedirse desde el principio. */
  const alMutar = useCallback((): void => {
    const signal = control.current?.signal;
    if (signal !== undefined) void cargarCola(sesion.current, signal);
  }, [cargarCola]);

  const conocidos = acumular(directorio.items, desdeCola, claveContexto);
  const contexto = seleccion === null ? null : (conocidos.find((item) => item.contextId === seleccion.contextId) ?? null);

  const seleccionar = (contextId: string, filtro: FiltroAlarmas = 'todas'): void => {
    ciclo.current += 1;
    setSeleccion(contextId === '' ? null : { contextId, ciclo: ciclo.current, filtro });
  };

  /**
   * Abre un contexto de la cola. Sus acciones las confirmó el servidor en la
   * MISMA página de la cola; no se deducen del perfil.
   */
  const abrirDesdeCola = (elemento: ElementoColaDto, filtro: FiltroAlarmas): void => {
    const { contextId, organizationId, organizationName, patientLabel, actorKind, actions } = elemento;
    const entrada: ContextoCuidadoDto = { contextId, organizationId, organizationName, patientLabel, actorKind, actions };
    setDesdeCola((previo) => [...previo.filter((item) => item.contextId !== contextId), entrada]);
    seleccionar(contextId, filtro);
  };

  return (
    <section className={styles.espacio} aria-labelledby={`cuidado-${perfil}-titulo`}>
      <Encabezado id={`cuidado-${perfil}-titulo`}>{titulo ?? TITULOS[perfil]}</Encabezado>

      {perfil === 'hospital' ? <p className={styles.ayuda}>{TEXTO_MOTOR_HOSPITAL}</p> : null}

      {estado !== 'listo' ? (
        <VistaEstadoGeneral
          estado={estado}
          onReintentar={() => void cargarDirectorio()}
          {...(accesoSinSesion === undefined ? {} : { accesoSinSesion })}
        />
      ) : (
        <>
          {perfil === 'hospital' && cola !== null ? (
            <section aria-label="Cola de revisión">
              <h3>Cola de revisión</h3>
              {cola.estado === 'cargando' ? (
                <p className={styles.ayuda} role="status">
                  Consultando la cola de revisión…
                </p>
              ) : cola.estado === 'error' ? (
                <p className={styles.alertaError} role="alert">
                  No fue posible consultar la cola de revisión. No se muestra ningún dato; esto no significa que esté vacía.
                </p>
              ) : (
                <>
                  {cola.items.length === 0 ? (
                    <p className={styles.ayuda}>
                      {cola.nextCursor === null
                        ? 'No tiene espacios de cuidado para revisar.'
                        : 'Esta página no contiene espacios que usted pueda revisar, pero quedan más por consultar.'}
                    </p>
                  ) : (
                    <ColaRevision cola={cola.items} onAbrir={abrirDesdeCola} />
                  )}
                  <ControlPagina
                    cargados={cola.items.length}
                    nombre="espacios en la cola"
                    hayMas={cola.nextCursor !== null}
                    cargando={cola.cargando}
                    error={cola.error}
                    textoBoton="Cargar más espacios de la cola"
                    onMas={() => void masCola()}
                  />
                </>
              )}
            </section>
          ) : null}

          <section aria-label="Espacios de cuidado">
            {conocidos.length === 0 && directorio.nextCursor !== null ? (
              <p className={styles.ayuda}>
                Los espacios consultados hasta ahora no son de su cuenta, pero quedan más por consultar.
              </p>
            ) : null}
            <SelectorContexto
              contextos={conocidos}
              seleccionado={seleccion?.contextId ?? null}
              onSeleccionar={(contextId) => seleccionar(contextId)}
              definitivo={directorio.nextCursor === null && desdeCola.length === 0}
            />
            {directorio.nextCursor !== null || directorio.error !== null ? (
              <ControlPagina
                cargados={directorio.items.length}
                nombre="espacios"
                hayMas={directorio.nextCursor !== null}
                cargando={directorio.cargando}
                error={directorio.error}
                textoBoton="Cargar más espacios"
                onMas={() => void masDirectorio()}
              />
            ) : null}
          </section>

          {contexto === null || seleccion === null ? null : (
            <EspacioContexto
              key={`${contexto.contextId}:${seleccion.ciclo}`}
              contexto={contexto}
              perfil={perfil}
              fetchImpl={f}
              filtroInicial={seleccion.filtro}
              onSinSesion={perderSesion}
              onMutado={alMutar}
            />
          )}
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Un contexto, un ciclo                                                       */
/* -------------------------------------------------------------------------- */

/** Formularios que se reinician al confirmar su propio envío. */
type Formulario = 'solicitud' | 'registro' | 'datos' | 'criterios';

const RONDAS_INICIALES: Readonly<Record<Formulario, number>> = { solicitud: 0, registro: 0, datos: 0, criterios: 0 };

type Carga<T> = { readonly kind: 'ok'; readonly data: T } | { readonly kind: 'error' } | null;

interface Bandeja extends Lista<AlarmaDto> {
  readonly canReview: boolean;
  readonly filtro: FiltroAlarmas;
}

function cargaDe<T>(resultado: Resultado<T> | null): Carga<T> {
  if (resultado === null) return null;
  return resultado.kind === 'ok' ? { kind: 'ok', data: resultado.data } : { kind: 'error' };
}

/**
 * Todo lo de UN paciente durante UN ciclo de selección. Ninguna respuesta se
 * aplica si esta instancia ya no está montada o su controlador se abortó: el
 * contexto y la señal se capturan ANTES de cada `await` y se comprueban
 * después, antes de cualquier `setState`, recarga o aviso al padre.
 */
function EspacioContexto({
  contexto,
  perfil,
  fetchImpl: f,
  filtroInicial,
  onSinSesion,
  onMutado,
}: {
  readonly contexto: ContextoCuidadoDto;
  readonly perfil: PerfilCuidado;
  readonly fetchImpl: Fetch;
  readonly filtroInicial: FiltroAlarmas;
  readonly onSinSesion: () => void;
  readonly onMutado: () => void;
}): ReactNode {
  const contextId = contexto.contextId;
  const acciones = contexto.actions;
  const puede = (accion: ContextoCuidadoDto['actions'][number]): boolean => acciones.includes(accion);

  const [cargado, setCargado] = useState(false);
  const [datos, setDatos] = useState<readonly DatoDto[]>([]);
  const [registros, setRegistros] = useState<Lista<RegistroDto> | 'error' | null>(null);
  const [bandeja, setBandeja] = useState<Bandeja | 'error' | null>(null);
  const [criterios, setCriterios] = useState<Carga<readonly CriterioDto[]>>(null);
  const [semaforo, setSemaforo] = useState<Carga<SemaforoDto>>(null);
  const [detalles, setDetalles] = useState<Readonly<Record<string, DetalleAlarmaDto>>>({});
  const [mensaje, setMensaje] = useState('');
  const [recibo, setRecibo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  /**
   * Ronda POR formulario: al confirmar, solo se reinicia el formulario que
   * envió; los borradores de los demás sobreviven (MP07B / B02).
   */
  const [rondas, setRondas] = useState<Readonly<Record<Formulario, number>>>(RONDAS_INICIALES);

  const control = useRef<AbortController | null>(null);
  const claves = useRef(new Map<string, string>());
  const filtro = useRef<FiltroAlarmas>(filtroInicial);
  /** Generación de la bandeja: cambiar el filtro descarta páginas del anterior. */
  const generacionBandeja = useRef(0);

  /** Señal de ESTA instancia, capturada antes de cada petición. */
  const senal = (): AbortSignal | null => {
    const actual = control.current;
    return actual === null || actual.signal.aborted ? null : actual.signal;
  };

  const verRegistros = puede('VIEW_RECORDS') || puede('CONTRIBUTE_RECORDS');
  const verAlarmas = puede('REVIEW_ALARMS') || puede('REQUEST_ALARM');
  const verDatos = verRegistros || puede('MANAGE_RULES');
  const verCriterios = puede('MANAGE_RULES') || puede('REVIEW_ALARMS') || puede('VIEW_RECORDS');

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      const propiaBandeja = generacionBandeja.current;
      const [datosR, registrosR, bandejaR, criteriosR, semaforoR] = await Promise.all([
        verDatos ? careClient.datos(contextId, f, signal) : null,
        verRegistros ? careClient.registros(contextId, f, signal) : null,
        verAlarmas ? careClient.alarmas(contextId, f, signal, null, filtro.current) : null,
        verCriterios ? careCriteriosClient.criterios(contextId, f, signal) : null,
        verCriterios ? careCriteriosClient.semaforo(contextId, f, signal) : null,
      ]);

      // Una respuesta de un ciclo anterior —u otro paciente— no se monta nunca.
      if (signal.aborted) return;

      const todos = [datosR, registrosR, bandejaR, criteriosR, semaforoR];
      if (todos.some((r) => r?.kind === 'cancelado')) return;
      if (todos.some((r) => r?.kind === 'sin-sesion')) {
        onSinSesion();
        return;
      }
      if (todos.some((r) => r !== null && r.kind !== 'ok')) {
        setMensaje('Parte de la información no está disponible en este momento. Lo que no se pudo consultar se indica en su apartado.');
      }

      setDatos(datosR?.kind === 'ok' ? datosR.data : []);
      setRegistros(registrosR === null ? null : registrosR.kind === 'ok' ? listaDe(registrosR.data.items, registrosR.data.nextCursor) : 'error');
      if (propiaBandeja === generacionBandeja.current) {
        setBandeja(
          bandejaR === null
            ? null
            : bandejaR.kind === 'ok'
              ? { ...listaDe(bandejaR.data.items, bandejaR.data.nextCursor), canReview: bandejaR.data.canReview, filtro: filtro.current }
              : 'error',
        );
      }
      setCriterios(cargaDe(criteriosR));
      setSemaforo(cargaDe(semaforoR));
      setCargado(true);
    },
    [contextId, f, onSinSesion, verAlarmas, verCriterios, verDatos, verRegistros],
  );

  useEffect(() => {
    const propio = new AbortController();
    const intentos = claves.current;
    control.current = propio;
    void cargar(propio.signal);
    return () => {
      // Al cambiar de paciente, de cuenta o de página: nada de este ciclo sigue.
      propio.abort();
      intentos.clear();
    };
  }, [cargar]);

  /** Recarga de ESTA instancia con SU señal; tras desmontar no hace nada. */
  const recargar = async (signal: AbortSignal): Promise<void> => {
    generacionBandeja.current += 1;
    await cargar(signal);
  };

  /** Clave estable por intento: se libera solo cuando el servidor confirma. */
  const claveDe = (intento: string): string => {
    const existente = claves.current.get(intento);
    if (existente !== undefined) return existente;
    const nueva = nuevaClaveEnvio();
    claves.current.set(intento, nueva);
    return nueva;
  };

  /**
   * Desenlace de una mutación de ESTE contexto. Devuelve `false` si la
   * respuesta llegó tarde (otro ciclo) o falló; en el primer caso no toca nada.
   */
  const tras = async <T,>(
    signal: AbortSignal,
    formulario: Formulario | null,
    intento: string | null,
    resultado: Resultado<T>,
    exito: string,
  ): Promise<boolean> => {
    if (signal.aborted || resultado.kind === 'cancelado') return false;
    setOcupado(false);

    if (resultado.kind === 'sin-sesion') {
      onSinSesion();
      return false;
    }
    if (resultado.kind === 'ok') {
      if (intento !== null) claves.current.delete(intento);
      setMensaje(exito);
      setDetalles({});
      if (formulario !== null) setRondas((previo) => ({ ...previo, [formulario]: previo[formulario] + 1 }));
      await recargar(signal);
      if (!signal.aborted) onMutado();
      return true;
    }
    setMensaje(
      resultado.kind === 'invalido'
        ? resultado.mensaje
        : resultado.kind === 'conflicto'
          ? 'La información cambió mientras trabajaba. Se actualizó; revise y vuelva a intentarlo.'
          : resultado.kind === 'denegado'
            ? 'Su cuenta no tiene autorización para esta acción.'
            : 'No se pudo confirmar la operación. Puede volver a intentarlo sin duplicarla.',
    );
    if (resultado.kind === 'conflicto') await recargar(signal);
    return false;
  };

  /**
   * Ejecuta una mutación de ESTE ciclo. La señal se captura ANTES del envío,
   * pero no cancela la escritura: una vez enviada, el servidor puede
   * confirmarla, y abortarla solo ocultaría ese desenlace. Si al responder el
   * ciclo ya terminó, la respuesta se DESCARTA entera: ni recibo, ni mensaje,
   * ni recarga, ni aviso al padre.
   */
  const mutar = async <T,>(
    formulario: Formulario | null,
    intento: string | null,
    exito: string | ((data: T) => string),
    enviar: (clave: string | null) => Promise<Resultado<T>>,
    alConfirmar?: (data: T) => void,
  ): Promise<void> => {
    const signal = senal();
    if (signal === null) return;
    const clave = intento === null ? null : claveDe(intento);
    setOcupado(true);
    const resultado = await enviar(clave);
    if (signal.aborted) return;
    if (resultado.kind === 'ok') alConfirmar?.(resultado.data);
    await tras(signal, formulario, intento, resultado, resultado.kind === 'ok' && typeof exito === 'function' ? exito(resultado.data) : typeof exito === 'string' ? exito : '');
  };

  const registrar = async (envio: EnvioRegistro): Promise<void> => {
    const occurredAt = instanteDesdeLocal(envio.occurredAt);
    if (occurredAt === null) {
      setMensaje('Indique una fecha y hora que no sean futuras.');
      return;
    }
    await mutar(
      'registro',
      `registro:${JSON.stringify(envio)}`,
      (data: { evaluation: { alarmsOpened: number } | null }) =>
        (data.evaluation?.alarmsOpened ?? 0) > 0
          ? 'Entrada guardada. Se cumplió un criterio definido por el profesional y se generó una alarma para revisión.'
          : 'Entrada guardada en la bitácora.',
      (clave) =>
        careClient.registrar(
          contextId,
          {
            idempotencyKey: clave ?? '',
            occurredAt,
            ...(envio.note.trim() === '' ? {} : { note: envio.note.trim() }),
            observations: Object.entries(envio.valores).map(([definitionId, value]) => ({ definitionId, value })),
          },
          f,
        ),
    );
  };

  const enmendar = async (registro: RegistroDto, nota: string, motivo: string): Promise<void> => {
    await mutar(null, `enmienda:${registro.id}:${registro.amendments.length}:${nota}:${motivo}`, 'Corrección guardada. La entrada original se conserva.', (clave) =>
      careClient.enmendar(
        contextId,
        registro.id,
        { idempotencyKey: clave ?? '', expectedSequence: registro.amendments.length, note: nota.trim(), reason: motivo.trim() },
        f,
      ),
    );
  };

  const pedirRevision = async (nota: string): Promise<void> => {
    await mutar(
      'solicitud',
      `revision:${nota}`,
      (data: { receiptMessage: string }) => data.receiptMessage,
      (clave) => careClient.pedirRevision(contextId, { idempotencyKey: clave ?? '', ...(nota.trim() === '' ? {} : { note: nota.trim() }) }, f),
      (data) => setRecibo(data.receiptMessage),
    );
  };

  const revisar = async (intencion: IntencionRevisor): Promise<void> => {
    await mutar(null, null, 'Solicitud actualizada.', () =>
      careClient.transicion(
        contextId,
        intencion.alarma.id,
        {
          action: intencion.action,
          expectedVersion: intencion.alarma.version,
          ...(intencion.reason.trim() === '' ? {} : { reason: intencion.reason.trim() }),
          ...(intencion.severity === undefined ? {} : { severity: intencion.severity }),
          ...(intencion.action === 'ASSIGN' ? { assignee: 'self' as const } : {}),
        },
        f,
      ),
    );
  };

  const informar = async (alarma: AlarmaDto): Promise<void> => {
    await mutar(null, `informe:${alarma.id}`, 'Se informó que se resolvió. Un profesional autorizado lo confirmará.', (clave) =>
      careClient.informarResolucion(contextId, alarma.id, { idempotencyKey: clave ?? '' }, f),
    );
  };

  const verDetalle = async (alarma: AlarmaDto): Promise<void> => {
    const signal = senal();
    if (signal === null) return;
    const resultado = await careCriteriosClient.detalle(contextId, alarma.id, f, signal);
    if (signal.aborted || resultado.kind === 'cancelado') return;
    if (resultado.kind === 'sin-sesion') onSinSesion();
    else if (resultado.kind === 'ok') setDetalles((previo) => ({ ...previo, [alarma.id]: resultado.data }));
    else setMensaje('No fue posible consultar la historia de esta solicitud.');
  };

  const definirCriterio = async (envio: EnvioCriterio): Promise<void> => {
    await mutar(
      'criterios',
      `criterio:${JSON.stringify(envio)}`,
      envio.criterionId === undefined
        ? 'Criterio validado. Cuenta lo que ocurra a partir de ahora.'
        : 'Versión nueva validada para el mismo criterio. Cuenta lo que ocurra a partir de ahora; lo abierto sigue en seguimiento.',
      (clave) => careCriteriosClient.definir(contextId, { idempotencyKey: clave ?? '', ...envio }, f),
    );
  };

  const retirarCriterio = async (criterio: CriterioDto, motivo: string): Promise<void> => {
    await mutar(null, null, 'Criterio retirado. Las alarmas abiertas siguen en seguimiento.', () =>
      careCriteriosClient.retirar(contextId, criterio.id, motivo.trim(), f),
    );
  };

  const definir = async (envio: EnvioDato): Promise<void> => {
    await mutar('datos', `dato:${JSON.stringify(envio)}`, 'Dato validado. Ya se puede registrar.', (clave) =>
      careClient.definirDato(
        contextId,
        {
          idempotencyKey: clave ?? '',
          code: envio.code,
          label: envio.label,
          valueType: envio.valueType,
          ...(envio.valueType === 'NUMBER' && envio.unit !== '' ? { unit: envio.unit } : {}),
          ...(envio.valueType === 'CHOICE' ? { options: envio.options } : {}),
        },
        f,
      ),
    );
  };

  const masRegistros = async (): Promise<void> => {
    const signal = senal();
    if (signal === null || registros === null || registros === 'error' || registros.nextCursor === null) return;
    const cursor = registros.nextCursor;
    setRegistros({ ...registros, cargando: true, error: null });
    const resultado = await careClient.registros(contextId, f, signal, cursor);
    if (signal.aborted || resultado.kind === 'cancelado') return;
    if (resultado.kind === 'sin-sesion') {
      onSinSesion();
      return;
    }
    setRegistros((previo) =>
      previo === null || previo === 'error'
        ? previo
        : resultado.kind === 'ok'
          ? listaDe(acumular(previo.items, resultado.data.items, claveId), resultado.data.nextCursor)
          : { ...previo, cargando: false, error: TEXTO_ERROR_PAGINA },
    );
  };

  const paginaBandeja = async (nuevoFiltro: FiltroAlarmas | null): Promise<void> => {
    const signal = senal();
    if (signal === null) return;
    const reinicio = nuevoFiltro !== null;
    if (reinicio) {
      filtro.current = nuevoFiltro;
      generacionBandeja.current += 1;
    }
    const propia = generacionBandeja.current;
    const previa = bandeja === null || bandeja === 'error' ? null : bandeja;
    const cursor = reinicio ? null : (previa?.nextCursor ?? null);
    if (!reinicio && cursor === null) return;

    setBandeja(
      reinicio
        ? { ...listaDe([], null), cargando: true, canReview: previa?.canReview ?? false, filtro: filtro.current }
        : previa === null
          ? null
          : { ...previa, cargando: true, error: null },
    );
    const resultado = await careClient.alarmas(contextId, f, signal, cursor, filtro.current);
    if (signal.aborted || propia !== generacionBandeja.current || resultado.kind === 'cancelado') return;
    if (resultado.kind === 'sin-sesion') {
      onSinSesion();
      return;
    }
    setBandeja((actual) => {
      if (resultado.kind !== 'ok') {
        return reinicio || actual === null || actual === 'error' ? 'error' : { ...actual, cargando: false, error: TEXTO_ERROR_PAGINA };
      }
      const base: readonly AlarmaDto[] = reinicio || actual === null || actual === 'error' ? [] : actual.items;
      return {
        ...listaDe(acumular(base, resultado.data.items, claveId), resultado.data.nextCursor),
        canReview: resultado.data.canReview,
        filtro: filtro.current,
      };
    });
  };

  return (
    <div className={styles.apartados} data-care-context={contextId}>
      <p className={styles.contextoUnico}>
        Espacio abierto: <strong>{contexto.patientLabel}</strong> · {contexto.organizationName}
      </p>

      <div aria-live="polite" className={styles.vivo}>
        {mensaje === '' ? null : <p role="status">{mensaje}</p>}
      </div>

      {!cargado ? (
        <p className={styles.ayuda} role="status">
          Consultando este espacio…
        </p>
      ) : null}

      {semaforo?.kind === 'ok' ? <BannerSemaforo semaforo={semaforo.data} /> : null}
      {semaforo?.kind === 'error' ? (
        <p className={styles.alertaError} role="alert">
          No fue posible consultar el semáforo. Esto no indica que no haya alarmas.
        </p>
      ) : null}

      {puede('REQUEST_ALARM') && perfil !== 'hospital' ? (
        <SolicitudRevision key={`solicitud-${rondas.solicitud}`} enviando={ocupado} recibo={recibo} onEnviar={(nota) => void pedirRevision(nota)} />
      ) : null}

      {bandeja === 'error' ? (
        <p className={styles.alertaError} role="alert">
          No fue posible consultar las solicitudes de este espacio. No se muestra ninguna; esto no significa que no existan.
        </p>
      ) : bandeja === null ? null : (
        <BandejaSeccion
          bandeja={bandeja}
          ocupado={ocupado}
          detalles={detalles}
          onFiltro={(nuevo) => void paginaBandeja(nuevo)}
          onMas={() => void paginaBandeja(null)}
          onRevisar={(intencion) => void revisar(intencion)}
          onInformar={(alarma) => void informar(alarma)}
          onVerDetalle={(alarma) => void verDetalle(alarma)}
        />
      )}

      {puede('CONTRIBUTE_RECORDS') && cargado ? (
        <FormularioRegistro key={`registro-${rondas.registro}`} datos={datos} enviando={ocupado} onEnviar={(envio) => void registrar(envio)} />
      ) : null}

      {registros === 'error' ? (
        <p className={styles.alertaError} role="alert">
          No fue posible consultar la bitácora. No se muestra ninguna entrada; esto no significa que no existan.
        </p>
      ) : registros === null ? null : (
        <section aria-label="Bitácora">
          <h3>Bitácora</h3>
          <ListaRegistros
            registros={registros.items}
            {...(puede('CONTRIBUTE_RECORDS') ? { onEnmendar: (registro: RegistroDto, nota: string, motivo: string) => void enmendar(registro, nota, motivo) } : {})}
          />
          {/* Siempre montado: al llegar al final conserva conteo y «No hay más»; el botón lo oculta el propio control. */}
          <ControlPagina
            cargados={registros.items.length}
            nombre="entradas"
            hayMas={registros.nextCursor !== null}
            cargando={registros.cargando}
            error={registros.error}
            textoBoton="Cargar entradas anteriores"
            onMas={() => void masRegistros()}
          />
        </section>
      )}

      {puede('MANAGE_RULES') && cargado ? (
        <GestorDatos key={`datos-${rondas.datos}`} datos={datos} enviando={ocupado} onDefinir={(envio) => void definir(envio)} />
      ) : null}

      {puede('MANAGE_RULES') && criterios?.kind === 'ok' ? (
        <GestorCriterios
          ronda={rondas.criterios}
          datos={datos}
          criterios={criterios.data}
          enviando={ocupado}
          onDefinir={(envio) => void definirCriterio(envio)}
          onRetirar={(criterio, motivo) => void retirarCriterio(criterio, motivo)}
        />
      ) : null}
      {puede('MANAGE_RULES') && criterios?.kind === 'error' ? (
        <p className={styles.alertaError} role="alert">
          No fue posible consultar los criterios de este espacio.
        </p>
      ) : null}
    </div>
  );
}

function BandejaSeccion({
  bandeja,
  ocupado,
  detalles,
  onFiltro,
  onMas,
  onRevisar,
  onInformar,
  onVerDetalle,
}: {
  readonly bandeja: Bandeja;
  readonly ocupado: boolean;
  readonly detalles: Readonly<Record<string, DetalleAlarmaDto>>;
  readonly onFiltro: (filtro: FiltroAlarmas) => void;
  readonly onMas: () => void;
  readonly onRevisar: (intencion: IntencionRevisor) => void;
  readonly onInformar: (alarma: AlarmaDto) => void;
  readonly onVerDetalle: (alarma: AlarmaDto) => void;
}): ReactNode {
  const titulo = bandeja.canReview ? 'Bandeja de revisión' : 'Mis solicitudes de revisión';
  const soloAbiertas = bandeja.filtro === 'abiertas';

  return (
    <section aria-label={bandeja.canReview ? 'Bandeja de revisión' : 'Mis solicitudes'}>
      <h3>{titulo}</h3>
      <fieldset className={styles.campo}>
        <legend>Mostrar</legend>
        <label className={styles.opcion}>
          <input type="radio" name="filtro-bandeja" checked={!soloAbiertas} disabled={bandeja.cargando} onChange={() => onFiltro('todas')} />
          Todas
        </label>
        <label className={styles.opcion}>
          <input type="radio" name="filtro-bandeja" checked={soloAbiertas} disabled={bandeja.cargando} onChange={() => onFiltro('abiertas')} />
          Solo abiertas
        </label>
      </fieldset>
      {bandeja.cargando && bandeja.items.length === 0 ? (
        <p className={styles.ayuda} role="status">
          Consultando solicitudes…
        </p>
      ) : (
        <BandejaAlarmas
          alarmas={bandeja.items}
          puedeRevisar={bandeja.canReview}
          ocupado={ocupado}
          soloAbiertas={soloAbiertas}
          onRevisar={onRevisar}
          onInformarResolucion={onInformar}
          onVerDetalle={onVerDetalle}
          renderDetalle={(alarma) => {
            const detalle = detalles[alarma.id];
            return detalle === undefined ? null : <DetalleAlarma detalle={detalle} />;
          }}
        />
      )}
      {/* Montado salvo en la primera consulta, que ya anuncia «Consultando solicitudes…»: el fin conserva conteo y estado. */}
      {bandeja.cargando && bandeja.items.length === 0 ? null : (
        <ControlPagina
          cargados={bandeja.items.length}
          nombre={soloAbiertas ? 'solicitudes abiertas' : 'solicitudes'}
          hayMas={bandeja.nextCursor !== null}
          cargando={bandeja.cargando}
          error={bandeja.error}
          textoBoton="Cargar más solicitudes"
          onMas={onMas}
        />
      )}
    </section>
  );
}
