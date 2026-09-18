'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import styles from './hospitalAgenda.module.css';
import {
  asignarCita,
  consultarAgenda,
  esFechaCalendario,
  fechaCalendarioDe,
  ventanaDeEscala,
  type HospitalAgendaEscala,
  type HospitalAgendaVistaDto,
  type HospitalCitaAgendaDto,
  type HospitalSolicitudDto,
} from './hospitalAgendaClient';
import {
  HOSPITAL_AGENDA_SELECCION_VACIA,
  conservaSeleccion,
  diaDelMes,
  estadoDeDesenlaceAgenda,
  etiquetaEstadoCita,
  etiquetaModalidad,
  fechaHoraLegible,
  fechaLegible,
  hospitalAgendaCore,
  iconoDeModalidad,
  instanteDeSeleccion,
  ofreceReintentoAgenda,
  puedeAsignar,
  textoDeAsignacion,
  textoDeEstadoAgenda,
  ventanaLegible,
  type HospitalAgendaCopy,
  type HospitalAgendaEstado,
  type HospitalAgendaSeleccion,
} from './hospitalAgendaConfig';
import { HospitalIcon } from './HospitalIcon';
import {
  materializarVisita,
  mensajeDeVisita,
  type HospitalVisitaMaterializadaDto,
} from './hospitalVisitsClient';
import {
  HospitalBadge,
  HospitalCard,
  HospitalCardHeader,
  HospitalNote,
  HospitalViewHeader,
  hospitalViewStyles as compartido,
} from './HospitalViewPieces';

/**
 * Vista «Agenda y citas» conectada a CORE-02
 * (TASK-HOSPITAL-CORE-02 §3.2; paquete de continuación §3.2).
 *
 * Sustituye la FUENTE de la vista aprobada en TASK-003H-03: solicitudes,
 * calendario, totales y citas dejan de ser fixtures de agosto de 2026 y pasan a
 * servirse desde `GET /api/v1/hospital/agenda`, acotados al tenant institucional
 * que el servidor resuelve. La vista contiene además la ÚNICA mutación de todo
 * el módulo Hospital: `PATCH /api/v1/hospital/appointments/:id/assignment`.
 *
 * GARANTÍAS DE ESTA VISTA:
 *
 * - NO importa el fixture demostrativo de la agenda ni ningún otro: no hay repliegue
 *   a datos de demostración. Ante fallo se limpia el estado nominal en lugar de
 *   conservar una respuesta que podría corresponder a otra ventana o sesión;
 * - la vista NO llama a la red: recibe `fetchImpl` y se lo entrega al cliente,
 *   que es la única frontera con la API;
 * - EL RELOJ SE INYECTA. `now` es el ÚNICO punto de todo el módulo Hospital que
 *   lee la fecha actual, y su valor se convierte de inmediato a `AAAA-MM-DD`
 *   con el helper del cliente. A partir de ahí todo es determinista: la ventana
 *   consultada se deriva de esa fecha y de la escala, nunca del reloj;
 * - cada consulta viaja con su propio `AbortController`: cambiar de fecha o de
 *   escala cancela la anterior, y una respuesta tardía no sustituye al estado
 *   actual;
 * - la asignación envía EXACTAMENTE `professionalId`, `scheduledStart` y
 *   `expectedVersion`. El control es OPTIMISTA: un `409` conserva lo que la
 *   persona escribió, lo anuncia en una región viva y NO reintenta solo;
 * - un envío en curso bloquea el resto: no hay doble asignación posible;
 * - `Reprogramar` y `Rechazar con motivo` se muestran DESHABILITADAS con su
 *   ayuda accesible: no tienen controlador y no pueden llamar a la red.
 *
 * COMPOSICIÓN (HOSPITAL-VISUAL-RECOVERY-01-C). La disposición vuelve a ser la
 * reconocible del diseño original —tarjeta ámbar de solicitudes con su
 * contador, filas densas con distintivo de modalidad y jerarquía de textos,
 * acciones agrupadas al final de la fila y citas como filas compactas— SIN que
 * vuelva ninguno de sus datos: no hay pagos, ni personas demostrativas, ni
 * disponibilidad, ni conflictos, ni métricas. Todo lo que se publica procede
 * del DTO servido, y ninguna operación cambia.
 *
 * Esta vista no confirma pagos, no evalúa disponibilidad, no detecta conflictos
 * clínicos y no autoriza ninguna decisión clínica.
 */

const TITULO_ID = 'hospital-agenda-titulo';
const CONTROLES_ID = 'hospital-agenda-controles';
const SOLICITUDES_ID = 'hospital-agenda-solicitudes';
const CALENDARIO_ID = 'hospital-agenda-calendario';
const CITAS_ID = 'hospital-agenda-citas';
const AVISO_ID = 'hospital-agenda-aviso';
const FECHA_ID = 'hospital-agenda-fecha';
const AYUDA_FECHA_ID = 'hospital-agenda-fecha-ayuda';

/** Escala inicial del calendario. La ventana más estrecha es la más barata. */
const ESCALA_INICIAL: HospitalAgendaEscala = 'dia';

/**
 * Textos de la preparación de la visita domiciliaria
 * (HOSPITAL-VISITS-01, packet B).
 *
 * Ninguno afirma que la atención se haya prestado, y ninguno nombra un código,
 * una ruta ni un identificador.
 */
export const HOSPITAL_AGENDA_VISITA = {
  preparar: 'Preparar visita domiciliaria',
  ayuda:
    'Abre la visita domiciliaria de esta cita para que la persona profesional asignada pueda registrar su estado. No registra ninguna atención.',
  preparando: 'Preparando…',
  lista: 'La visita domiciliaria quedó programada.',
} as const;

/**
 * `true` solo para las citas que MP04 admite materializar.
 *
 * Es una función PURA y DELIBERADAMENTE estrecha: EN DOMICILIO y ya ASIGNADA.
 * Una cita presencial, una virtual, una solicitada sin profesional o una
 * cancelada no ofrecen la acción, porque el servidor las rechazaría y ofrecer
 * un botón que siempre falla no es una funcionalidad. La autoridad sigue siendo
 * el servidor: esta comprobación decide qué MOSTRAR, no qué se permite.
 */
export function esCitaMaterializable(cita: HospitalCitaAgendaDto): boolean {
  return cita.modality === 'HOME' && cita.status === 'ASSIGNED';
}

/**
 * Estado de la consulta, anunciado como región viva.
 *
 * Nunca acompaña a datos servidos: o hay agenda, o hay estado.
 */
export function AgendaEstado({
  texto,
  reintentar,
  onReintentar,
}: {
  readonly texto: string;
  readonly reintentar?: string;
  readonly onReintentar?: () => void;
}): ReactNode {
  return (
    <div className={styles.estado}>
      <p className={styles.estadoTexto} role="status">
        {texto}
      </p>
      {reintentar === undefined || onReintentar === undefined ? null : (
        <button
          type="button"
          className={`${compartido.button} ${compartido.buttonNeutro}`}
          onClick={onReintentar}
        >
          {reintentar}
        </button>
      )}
    </div>
  );
}

/**
 * Solicitud pendiente con su formulario de asignación.
 *
 * El selector de profesional usa el identificador OPACO que sirvió la API como
 * valor: el nombre solo se muestra. Fecha y hora son controles controlados y su
 * validez la decide el cliente, no esta pieza.
 */
export function AgendaSolicitud({
  solicitud,
  profesionales,
  copy,
  seleccion,
  enviando,
  onSeleccion,
  onAsignar,
}: {
  readonly solicitud: HospitalSolicitudDto;
  readonly profesionales: HospitalAgendaVistaDto['assignableProfessionals'];
  readonly copy: HospitalAgendaCopy;
  readonly seleccion: HospitalAgendaSeleccion;
  /** Identificador de la solicitud cuyo envío está en curso, si lo hay. */
  readonly enviando: string | null;
  readonly onSeleccion: (cambio: Partial<HospitalAgendaSeleccion>) => void;
  readonly onAsignar: () => void;
}): ReactNode {
  const base = `hospital-agenda-solicitud-${solicitud.appointmentId}`;
  const enCurso = enviando === solicitud.appointmentId;
  const habilitado = puedeAsignar(seleccion, enviando);

  return (
    <li className={styles.solicitud}>
      {/*
       * Composición de la referencia: distintivo de modalidad, bloque de textos
       * y pastilla a la derecha. Los tres proceden del DTO servido.
       */}
      <div className={styles.solicitudResumen}>
        <span className={styles.solicitudIcono} aria-hidden="true">
          <HospitalIcon name={iconoDeModalidad(solicitud.modality)} size={20} />
        </span>
        <div className={styles.solicitudTextos}>
          <h3 className={styles.solicitudTitulo}>{solicitud.patient.fullName}</h3>
          <p className={styles.solicitudLinea}>
            {`${copy.solicitudes.etiquetaSolicitada}: ${fechaHoraLegible(solicitud.requestedAt)}`}
          </p>
        </div>
        <HospitalBadge tono="petroleo" className={styles.solicitudEstado}>
          {etiquetaModalidad(solicitud.modality)}
        </HospitalBadge>
      </div>

      <div className={styles.solicitudControles}>
        <div className={styles.campoGrupo}>
          <label className={styles.campoEtiqueta} htmlFor={`${base}-profesional`}>
            {copy.solicitudes.etiquetaProfesional}
          </label>
          <select
            id={`${base}-profesional`}
            className={`${styles.campo} ${styles.campoProfesional}`}
            value={seleccion.professionalId}
            onChange={(evento) => {
              onSeleccion({ professionalId: evento.target.value });
            }}
          >
            <option value="">{copy.solicitudes.opcionProfesional}</option>
            {profesionales.map((profesional) => (
              <option key={profesional.professionalId} value={profesional.professionalId}>
                {`${profesional.fullName} · ${profesional.professionName}`}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.campoGrupo}>
          <label className={styles.campoEtiqueta} htmlFor={`${base}-fecha`}>
            {copy.solicitudes.etiquetaFecha}
          </label>
          <input
            id={`${base}-fecha`}
            type="date"
            className={`${styles.campo} ${styles.campoFecha}`}
            value={seleccion.fecha}
            onChange={(evento) => {
              onSeleccion({ fecha: evento.target.value });
            }}
          />
        </div>

        <div className={styles.campoGrupo}>
          <label className={styles.campoEtiqueta} htmlFor={`${base}-hora`}>
            {copy.solicitudes.etiquetaHora}
          </label>
          <input
            id={`${base}-hora`}
            type="time"
            className={`${styles.campo} ${styles.campoHora}`}
            value={seleccion.hora}
            onChange={(evento) => {
              onSeleccion({ hora: evento.target.value });
            }}
          />
        </div>

        {/*
         * Las tres acciones viajan juntas al final de la fila, como en la
         * composición original. Solo la primera opera.
         */}
        <div className={styles.acciones}>
          <button
            type="button"
            className={`${compartido.button} ${compartido.buttonPrimario} ${styles.accionPrimaria}`}
            disabled={!habilitado}
            aria-describedby={`${base}-ayuda`}
            onClick={onAsignar}
          >
            {enCurso ? copy.asignacion.enviando : copy.solicitudes.asignar}
          </button>
          <span className="merdn-sr-only" id={`${base}-ayuda`}>
            {copy.solicitudes.ayudaAsignar}
          </span>

          {/*
           * Acciones fuera del alcance de este slice: visibles para que la persona
           * administrativa sepa que existen, deshabilitadas porque todavía no
           * operan, y sin controlador para que no puedan llamar a la red. El
           * contorno rojo de `Rechazar con motivo` procede de la referencia y
           * convive con el atenuado que anuncia que la acción no está activa.
           */}
          {copy.solicitudes.acciones.map((accion) => (
            <span className={styles.accionFutura} key={accion.id}>
              <button
                type="button"
                disabled
                className={`${compartido.button} ${
                  accion.variante === 'rechazo'
                    ? styles.accionRechazar
                    : compartido.buttonNeutro
                } ${styles.accionSecundaria} ${styles.accionInactiva}`}
                aria-describedby={`${base}-${accion.id}`}
              >
                {accion.etiqueta}
              </button>
              <span className="merdn-sr-only" id={`${base}-${accion.id}`}>
                {accion.ayuda}
              </span>
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

/** Cuadrícula de conteos por día servidos. No inventa días sin registro. */
export function AgendaCalendario({
  agenda,
  copy,
}: {
  readonly agenda: HospitalAgendaVistaDto;
  readonly copy: HospitalAgendaCopy;
}): ReactNode {
  return (
    <HospitalCard gap={16} className={styles.calendarioCard} aria-labelledby={CALENDARIO_ID}>
      <HospitalCardHeader
        titulo={copy.calendario.titulo}
        tituloId={CALENDARIO_ID}
        nota={`${copy.controles.etiquetaVentana}: ${ventanaLegible(agenda.window.from, agenda.window.to)}`}
      />

      {agenda.dailyCounts.length === 0 ? (
        <p className={styles.estadoTexto}>{copy.calendario.vacio}</p>
      ) : (
        <div className={styles.calendarioScroll}>
          <ul className={styles.calendarioConteos} aria-label={copy.calendario.etiquetaCuadricula}>
            {agenda.dailyCounts.map((dia) => (
              <li className={styles.dia} key={dia.date}>
                <span className={styles.diaNumero} aria-hidden="true">
                  {diaDelMes(dia.date)}
                </span>
                <span className="merdn-sr-only">{fechaLegible(dia.date)}</span>
                <span className={styles.diaCitas}>
                  {`${String(dia.total)} ${dia.total === 1 ? copy.calendario.sufijoCita : copy.calendario.sufijoCitas}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className={styles.totales} aria-label={copy.calendario.tituloTotales}>
        <li className={styles.total}>
          <span className={styles.totalValor}>{String(agenda.totalAppointments)}</span>
          <span className={styles.totalEtiqueta}>{copy.calendario.etiquetaTotal}</span>
        </li>
        {agenda.modalityCounts.map((conteo) => (
          <li className={styles.total} key={conteo.modality}>
            <span className={styles.totalValor}>{String(conteo.total)}</span>
            <span className={styles.totalEtiqueta}>{etiquetaModalidad(conteo.modality)}</span>
          </li>
        ))}
      </ul>
    </HospitalCard>
  );
}

/**
 * Cita servida de la ventana consultada.
 *
 * Las citas EN DOMICILIO ya ASIGNADAS —y solo ellas— ofrecen además la acción
 * textual que prepara su visita domiciliaria. Es un acto ADMINISTRATIVO de la
 * sesión institucional: no inicia la visita, no la completa y no afirma que la
 * atención se haya prestado.
 */
function AgendaCitaFila({
  cita,
  copy,
  materializando,
  bloqueado,
  onMaterializar,
}: {
  readonly cita: HospitalCitaAgendaDto;
  readonly copy: HospitalAgendaCopy;
  /** Cita cuya materialización está en curso, si la hay. */
  readonly materializando: string | null;
  readonly bloqueado: boolean;
  readonly onMaterializar: ((cita: HospitalCitaAgendaDto) => void) | undefined;
}): ReactNode {
  const estado = etiquetaEstadoCita(cita.status);
  const ayudaId = `hospital-agenda-visita-${cita.appointmentId}`;
  const enCurso = materializando === cita.appointmentId;

  return (
    <li className={styles.cita}>
      <span className={styles.citaIcono} aria-hidden="true">
        <HospitalIcon name={iconoDeModalidad(cita.modality)} size={18} />
      </span>

      {/*
       * Jerarquía de la fila: cuándo, quién, con quién y en qué modalidad. Los
       * cuatro se leen como texto y ninguno se deduce: todos vienen servidos.
       */}
      <span className={styles.citaTextos}>
        <span className={styles.citaHora}>
          {cita.scheduledStart === null
            ? copy.citas.sinHora
            : fechaHoraLegible(cita.scheduledStart)}
        </span>
        <span className={styles.citaPaciente}>{cita.patient.fullName}</span>
        <span className={styles.citaMeta}>
          <span className={styles.citaProfesional}>{cita.professional.fullName}</span>
          <span className={styles.citaSeparador} aria-hidden="true">
            ·
          </span>
          <span className={styles.citaModalidad}>{etiquetaModalidad(cita.modality)}</span>
        </span>
      </span>

      <span className={styles.citaAcciones}>
        <HospitalBadge tono={estado.tono} className={styles.citaEstado}>
          {estado.etiqueta}
        </HospitalBadge>
        {!esCitaMaterializable(cita) || onMaterializar === undefined ? null : (
          <span className={styles.accionFutura}>
            <button
              type="button"
              className={`${compartido.button} ${compartido.buttonNeutro} ${styles.accionCita}`}
              disabled={bloqueado}
              aria-describedby={ayudaId}
              onClick={() => {
                onMaterializar(cita);
              }}
            >
              {enCurso ? HOSPITAL_AGENDA_VISITA.preparando : HOSPITAL_AGENDA_VISITA.preparar}
            </button>
            <span className="merdn-sr-only" id={ayudaId}>
              {HOSPITAL_AGENDA_VISITA.ayuda}
            </span>
          </span>
        )}
      </span>
    </li>
  );
}

/** Listado de citas servidas de la ventana. */
export function AgendaCitas({
  agenda,
  copy,
  materializando = null,
  bloqueado = false,
  onMaterializar,
}: {
  readonly agenda: HospitalAgendaVistaDto;
  readonly copy: HospitalAgendaCopy;
  readonly materializando?: string | null;
  readonly bloqueado?: boolean;
  /**
   * Sin controlador NO se dibuja ninguna acción: una superficie que no puede
   * materializar tampoco debe insinuar que sí.
   */
  readonly onMaterializar?: (cita: HospitalCitaAgendaDto) => void;
}): ReactNode {
  return (
    <HospitalCard className={styles.citasCard} aria-labelledby={CITAS_ID}>
      <HospitalCardHeader titulo={copy.citas.titulo} tituloId={CITAS_ID} />
      {agenda.appointments.length === 0 ? (
        <p className={styles.estadoTexto}>{copy.citas.vacio}</p>
      ) : (
        <ul className={styles.citas} aria-label={copy.citas.etiquetaLista}>
          {agenda.appointments.map((cita) => (
            <AgendaCitaFila
              key={cita.appointmentId}
              cita={cita}
              copy={copy}
              materializando={materializando}
              bloqueado={bloqueado}
              onMaterializar={onMaterializar}
            />
          ))}
        </ul>
      )}
    </HospitalCard>
  );
}

export function HospitalAgenda({
  copy = hospitalAgendaCore,
  fetchImpl,
  now,
  fechaInicial,
  escalaInicial = ESCALA_INICIAL,
  agendaInicial = null,
  onVisitaMaterializada,
}: {
  readonly copy?: HospitalAgendaCopy;
  /**
   * Implementación de `fetch` que consulta la API.
   *
   * Se inyecta para poder probar serialización, cancelación y cada código de
   * estado sin jsdom y sin red. La vista NO la invoca: se la entrega al cliente.
   */
  readonly fetchImpl?: typeof fetch;
  /**
   * Reloj inyectable.
   *
   * Su valor por defecto contiene el ÚNICO constructor `Date` sin argumentos de todo
   * el módulo Hospital, y solo se ejecuta si no se aporta `fechaInicial`. Se
   * lee UNA vez, al montar, y el resultado se convierte de inmediato a fecha
   * calendario: ninguna otra parte de la vista vuelve a consultar el reloj.
   */
  readonly now?: () => Date;
  /** Fecha de referencia al montar, en `AAAA-MM-DD`. Prevalece sobre el reloj. */
  readonly fechaInicial?: string;
  readonly escalaInicial?: HospitalAgendaEscala;
  /**
   * Agenda ya servida.
   *
   * Cuando se aporta, la vista NO consulta la red: permite probar la superficie
   * conectada sin jsdom, igual que `sesionInicial` en `HospitalShell`. No es un
   * fixture: es el mismo DTO que devuelve la API.
   */
  readonly agendaInicial?: HospitalAgendaVistaDto | null;
  /**
   * Aviso al shell de que una visita domiciliaria quedó materializada.
   *
   * La agenda NO navega y NO conserva la visita: entrega el DTO REAL —tal cual
   * lo devolvió el servidor— y el shell decide qué hacer con él. Sin este
   * controlador la acción ni siquiera se dibuja.
   */
  readonly onVisitaMaterializada?: (visita: HospitalVisitaMaterializadaDto) => void;
}): ReactNode {
  const [fecha, setFecha] = useState<string>(
    () => fechaInicial ?? fechaCalendarioDe((now ?? (() => new Date()))()),
  );
  const [escala, setEscala] = useState<HospitalAgendaEscala>(escalaInicial);
  const [reintento, setReintento] = useState<number>(0);

  const [estado, setEstado] = useState<HospitalAgendaEstado>(
    agendaInicial === null ? 'cargando' : 'listo',
  );
  const [agenda, setAgenda] = useState<HospitalAgendaVistaDto | null>(agendaInicial);

  /** Lo escrito en el formulario de cada solicitud. Nunca su versión ni su id. */
  const [selecciones, setSelecciones] = useState<
    Readonly<Record<string, HospitalAgendaSeleccion>>
  >({});
  /** Solicitud cuyo `PATCH` está en curso. Bloquea cualquier otro envío. */
  const [enviando, setEnviando] = useState<string | null>(null);
  /** Cita cuya materialización está en curso. Bloquea cualquier otra. */
  const [materializando, setMaterializando] = useState<string | null>(null);
  /** Desenlace de la última asignación, anunciado en la región viva. */
  const [aviso, setAviso] = useState<string>('');

  /** Evita escribir sobre una vista ya desmontada tras una mutación en curso. */
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;

    return (): void => {
      montadoRef.current = false;
    };
  }, []);

  /**
   * Ventana consultada.
   *
   * Función PURA de la fecha activa y de la escala: no lee el reloj. `null`
   * cuando la fecha del control no es una fecha de calendario real, en cuyo
   * caso no se consulta nada.
   */
  const ventana = useMemo(
    () => (esFechaCalendario(fecha) ? ventanaDeEscala(fecha, escala) : null),
    [fecha, escala],
  );

  useEffect(() => {
    if (agendaInicial !== null) {
      // Agenda inyectada: no se consulta la red.
      return undefined;
    }

    if (ventana === null) {
      setAgenda(null);
      setEstado('consulta-invalida');

      return undefined;
    }

    const controller = new AbortController();
    let vigente = true;

    setEstado('cargando');

    void consultarAgenda(ventana, fetchImpl ?? fetch, controller.signal).then((resultado) => {
      /*
       * Una respuesta tardía —o cancelada— nunca sustituye al estado actual:
       * `vigente` la descarta aunque el `AbortSignal` no llegara a tiempo.
       */
      if (!vigente || resultado.kind === 'cancelado') {
        return;
      }

      if (resultado.kind === 'ok') {
        setAgenda(resultado.datos);
        setEstado('listo');

        return;
      }

      // Ante fallo se limpia el estado nominal: no hay repliegue a nada previo.
      setAgenda(null);
      setEstado(estadoDeDesenlaceAgenda(resultado.kind));
    });

    return (): void => {
      vigente = false;
      controller.abort();
    };
  }, [ventana, reintento, fetchImpl, agendaInicial]);

  function seleccionDe(appointmentId: string): HospitalAgendaSeleccion {
    return selecciones[appointmentId] ?? HOSPITAL_AGENDA_SELECCION_VACIA;
  }

  function actualizarSeleccion(
    appointmentId: string,
    cambio: Partial<HospitalAgendaSeleccion>,
  ): void {
    setSelecciones((actual) => ({
      ...actual,
      [appointmentId]: { ...seleccionDe(appointmentId), ...cambio },
    }));
  }

  /**
   * ÚNICA mutación del módulo.
   *
   * No reintenta sola, no reprograma y no cancela. Un envío en curso bloquea
   * cualquier otro: `enviando` es la guarda del doble submit.
   */
  function asignar(solicitud: HospitalSolicitudDto): void {
    if (enviando !== null) {
      return;
    }

    const seleccion = seleccionDe(solicitud.appointmentId);
    const scheduledStart = instanteDeSeleccion(seleccion);

    if (scheduledStart === null) {
      setAviso(textoDeAsignacion(copy.asignacion, 'incompleta'));

      return;
    }

    setEnviando(solicitud.appointmentId);
    setAviso('');

    void asignarCita(
      solicitud.appointmentId,
      {
        professionalId: seleccion.professionalId,
        scheduledStart,
        expectedVersion: solicitud.version,
      },
      fetchImpl ?? fetch,
    ).then((resultado) => {
      if (!montadoRef.current) {
        return;
      }

      setEnviando(null);
      setAviso(textoDeAsignacion(copy.asignacion, resultado.kind));

      if (conservaSeleccion(resultado.kind)) {
        /*
         * Se CONSERVA lo escrito. Obligar a teclear de nuevo profesional, fecha
         * y hora tras un `409` castiga a quien no cometió ningún error.
         */
        return;
      }

      setSelecciones((actual) => {
        const { [solicitud.appointmentId]: _asignada, ...resto } = actual;

        return resto;
      });
      // El éxito refresca la agenda desde el servidor, no desde la respuesta.
      setReintento((actual) => actual + 1);
    });
  }

  /**
   * Prepara la visita domiciliaria de una cita EN DOMICILIO ya ASIGNADA.
   *
   * Acto ADMINISTRATIVO de la sesión INSTITUCIONAL. El cuerpo lleva
   * EXCLUSIVAMENTE el identificador de la cita —el cliente no admite ningún
   * otro campo—: ni profesional, ni paciente, ni institución, ni instante. La
   * identidad y el contexto los resuelve entero el servidor desde su cookie.
   *
   * Preparar una visita NO la inicia, NO la completa y NO afirma que ninguna
   * atención se haya prestado: solo la hace existir con estado `Programada`.
   *
   * Una materialización en curso —o una asignación— bloquea cualquier otra: la
   * guarda del doble envío es compartida a propósito.
   */
  function materializar(cita: HospitalCitaAgendaDto): void {
    if (materializando !== null || enviando !== null) {
      return;
    }

    setMaterializando(cita.appointmentId);
    setAviso('');

    void materializarVisita(cita.appointmentId, fetchImpl ?? fetch).then((resultado) => {
      if (!montadoRef.current) {
        return;
      }

      setMaterializando(null);

      if (resultado.kind === 'ok') {
        setAviso(HOSPITAL_AGENDA_VISITA.lista);
        onVisitaMaterializada?.(resultado.datos);

        return;
      }

      // Mensaje de producto del cliente: sin código, sin ruta y sin reintento solo.
      setAviso(mensajeDeVisita(resultado) ?? '');
    });
  }

  const encabezado = <HospitalViewHeader encabezado={copy.encabezado} tituloId={TITULO_ID} />;

  const controles = (
    <HospitalCard gap={16} className={styles.controlesCard} aria-labelledby={CONTROLES_ID}>
      <h2 className="merdn-sr-only" id={CONTROLES_ID}>
        {copy.controles.titulo}
      </h2>

      <div className={styles.controles}>
        <div className={styles.campoGrupo}>
          <label className={styles.campoEtiqueta} htmlFor={FECHA_ID}>
            {copy.controles.etiquetaFecha}
          </label>
          <input
            id={FECHA_ID}
            type="date"
            className={`${styles.campo} ${styles.campoFecha}`}
            value={fecha}
            aria-describedby={AYUDA_FECHA_ID}
            aria-invalid={ventana === null}
            onChange={(evento) => {
              setFecha(evento.target.value);
            }}
          />
          <p className={styles.campoAyuda} id={AYUDA_FECHA_ID}>
            {ventana === null ? copy.controles.fechaInvalida : copy.controles.ayudaFecha}
          </p>
        </div>

        <div className={styles.escalas} role="group" aria-label={copy.controles.etiquetaEscala}>
          {copy.escalas.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              aria-pressed={opcion.id === escala}
              className={
                opcion.id === escala ? `${styles.pill} ${styles.pillActiva}` : styles.pill
              }
              onClick={() => {
                setEscala(opcion.id);
              }}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>

        <p className={styles.ventana}>
          {`${copy.controles.etiquetaVentana}: ${
            ventana === null ? copy.controles.fechaInvalida : ventanaLegible(ventana.from, ventana.to)
          }`}
        </p>
      </div>

      {/*
       * Región viva ÚNICA de la vista. Anuncia el desenlace de la asignación
       * —incluido el conflicto de versión— sin describir la cita en conflicto.
       */}
      <p className={styles.aviso} id={AVISO_ID} role="status" aria-live="polite">
        {aviso}
      </p>
    </HospitalCard>
  );

  if (estado !== 'listo' || agenda === null) {
    return (
      <div className={compartido.view}>
        {encabezado}
        {controles}
        <HospitalCard gap={16}>
          <AgendaEstado
            texto={textoDeEstadoAgenda(copy.estados, estado)}
            {...(ofreceReintentoAgenda(estado)
              ? {
                  reintentar: copy.estados.reintentar,
                  onReintentar: (): void => {
                    setReintento((actual) => actual + 1);
                  },
                }
              : {})}
          />
        </HospitalCard>
        <HospitalNote>{copy.nota}</HospitalNote>
      </div>
    );
  }

  const vacia =
    agenda.requests.length === 0 &&
    agenda.appointments.length === 0 &&
    agenda.totalAppointments === 0;

  return (
    <div className={compartido.view}>
      {encabezado}
      {controles}

      {vacia ? (
        <HospitalCard gap={16}>
          <AgendaEstado texto={copy.estados.vacio} />
        </HospitalCard>
      ) : null}

      <HospitalCard className={styles.solicitudesCard} aria-labelledby={SOLICITUDES_ID}>
        <HospitalCardHeader
          titulo={copy.solicitudes.titulo}
          tituloId={SOLICITUDES_ID}
          extra={
            <HospitalBadge tono="amarillo" className={styles.contador}>
              {`${String(agenda.requests.length)} ${copy.solicitudes.resumen}`}
            </HospitalBadge>
          }
        />
        {agenda.requests.length === 0 ? (
          <p className={styles.estadoTexto}>{copy.solicitudes.vacio}</p>
        ) : (
          <ul className={styles.solicitudes}>
            {agenda.requests.map((solicitud) => (
              <AgendaSolicitud
                key={solicitud.appointmentId}
                solicitud={solicitud}
                profesionales={agenda.assignableProfessionals}
                copy={copy}
                seleccion={seleccionDe(solicitud.appointmentId)}
                enviando={enviando}
                onSeleccion={(cambio) => {
                  actualizarSeleccion(solicitud.appointmentId, cambio);
                }}
                onAsignar={() => {
                  asignar(solicitud);
                }}
              />
            ))}
          </ul>
        )}
      </HospitalCard>

      <div className={styles.columnas}>
        <AgendaCalendario agenda={agenda} copy={copy} />
        <AgendaCitas
          agenda={agenda}
          copy={copy}
          materializando={materializando}
          bloqueado={materializando !== null || enviando !== null}
          {...(onVisitaMaterializada === undefined ? {} : { onMaterializar: materializar })}
        />
      </div>

      <HospitalNote>{copy.nota}</HospitalNote>
    </div>
  );
}
