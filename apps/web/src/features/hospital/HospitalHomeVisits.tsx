'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import styles from './hospitalVisits.module.css';
import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import type { HospitalTonoId } from './hospitalTonos';
import {
  cerrarSesionHumana,
  cierreHumanoConfirmado,
  consultarSesionHumana,
  urlDeLoginHumano,
  type EstadoSesionHumana,
} from './hospitalHumanSessionClient';
import {
  cambiarEstadoVisita,
  consultarVisitaProfesional,
  mensajeDeVisita,
  requiereRefrescoDeVisita,
  type HospitalVisitaDestino,
  type HospitalVisitaEstado,
  type HospitalVisitaMaterializadaDto,
  type HospitalVisitaProfesionalDto,
  type ResultadoVisita,
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
 * Vista «Visitas domiciliarias» conectada a VISITS-CORE-01 MP04
 * (HOSPITAL-VISITS-01, packet B).
 *
 * Sustituye la FUENTE de la vista aprobada en TASK-003H-04: fecha, paciente,
 * zona, profesional, filtros y conteos demostrativos DESAPARECEN. MP04 no
 * devuelve ninguno de esos datos, y publicarlos junto a un estado real haría
 * pasar por verificado lo que solo era una ilustración. Lo único que esta
 * pantalla muestra ahora es el ESTADO REAL de UNA visita.
 *
 * GARANTÍAS DE ESTA VISTA:
 *
 * - NO importa `hospitalVisitsConfig`: no hay repliegue demostrativo en ningún
 *   desenlace. Sin visita seleccionada se declara el vacío tal cual es;
 * - NO llama a la red: recibe `fetchImpl` y se lo entrega al cliente, que es la
 *   única frontera con la API;
 * - NO publica identificadores, versiones, códigos de estado, rutas ni ningún
 *   otro detalle técnico. Tampoco paciente, profesional, dirección, zona ni
 *   horario, porque el servidor no los devuelve;
 * - cada consulta viaja con su propio `AbortController`: desmontar o cambiar de
 *   visita la cancela, y una respuesta tardía no sustituye al estado actual;
 * - un envío en curso bloquea el resto: no hay doble transición posible.
 *
 * DOS IDENTIDADES DISJUNTAS. La visita llega aquí porque la identidad
 * INSTITUCIONAL la materializó desde la agenda; iniciarla, completarla o darla
 * por no realizada es el acto de la PERSONA profesional asignada. Esta vista NO
 * deduce una identidad de la otra y no tiene forma de hacerlo: las acciones
 * profesionales existen ÚNICA y EXCLUSIVAMENTE cuando la consulta profesional
 * responde `ok`, que es la respuesta que solo el servidor puede dar tras validar
 * la sesión personal, el perfil y la asignación de cuidado vigentes. Ante
 * `sin-sesion`, `sin-permiso` o `no-encontrado` se falla CERRADO: se conserva el
 * estado `Programada` que devolvió la materialización, se explica qué falta y no
 * se ofrece ninguna acción. Aquí no hay `professionalId` fabricado: el cliente
 * ni siquiera admite ese campo.
 *
 * SESIÓN PROFESIONAL (HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI). Cuando lo que
 * falta es precisamente esa sesión personal, la vista deja de ser un callejón
 * sin salida y ofrece el flujo humano YA EXISTENTE, sin crear ninguno nuevo:
 *
 * - «Abrir sesión profesional» es un ENLACE de navegación normal al inicio OIDC
 *   del servidor, abierto en pestaña nueva con `rel="noopener noreferrer"`. No
 *   es una petición en segundo plano —la respuesta es una redirección hacia el
 *   proveedor de identidad— y la pantalla Hospital queda intacta detrás;
 * - «Comprobar sesión profesional» consulta el contrato humano y NADA más. Solo
 *   un contexto `PROFESSIONAL` devuelto por el SERVIDOR vuelve a leer la visita;
 *   una sesión personal sin ese contexto no habilita absolutamente nada;
 * - «Cerrar sesión profesional» revoca esa sesión y devuelve la pantalla al
 *   estado fail-closed. NO toca la sesión institucional, que es otra entidad.
 *
 * TENER SESIÓN NO ES TENER PERMISO. Detectar el contexto profesional no habilita
 * ninguna acción por sí mismo: las acciones siguen dependiendo EXCLUSIVAMENTE
 * del `ok` de la consulta de la visita. La credencial humana viaja en una cookie
 * `HttpOnly` que este código no lee, no escribe y no copia; no hay clave local,
 * no hay `dev-login` y no hay bypass.
 *
 * El estado de una visita NO es un dato clínico: no describe la atención
 * prestada y no acredita que ninguna atención se haya prestado.
 */

const TITULO_ID = 'hospital-visitas-titulo';
const VISITA_ID = 'hospital-visitas-visita';
const AVISO_ID = 'hospital-visitas-aviso';
const SESION_ID = 'hospital-visitas-sesion';
const ENTRAR_AYUDA_ID = 'hospital-visitas-sesion-entrar';

/** Encabezado de la vista conectada. Describe lo que realmente muestra. */
export const HOSPITAL_VISITA_ENCABEZADO: HospitalVistaEncabezado = {
  titulo: 'Visitas domiciliarias',
  descripcion:
    'Estado real de la visita preparada desde la agenda institucional. Iniciarla o cerrarla corresponde a la persona profesional asignada.',
};

/**
 * Etiqueta visible de cada estado del contrato.
 *
 * Son las CUATRO del contrato y ninguna más: la vista no inventa «En camino»,
 * «Pendiente de asignación» ni «Cancelada», que el servidor no modela.
 */
export const HOSPITAL_VISITA_ETIQUETA: Record<HospitalVisitaEstado, string> = {
  SCHEDULED: 'Programada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  NOT_COMPLETED: 'No completada',
};

/**
 * Tono de cada estado.
 *
 * El color ACOMPAÑA a la etiqueta, nunca la sustituye: el estado siempre se lee
 * como texto. Ninguno usa el rojo de alarma, porque una visita no realizada es
 * un desenlace operativo y no una alerta clínica.
 */
const TONO_POR_ESTADO: Record<HospitalVisitaEstado, HospitalTonoId> = {
  SCHEDULED: 'azul',
  IN_PROGRESS: 'petroleo',
  COMPLETED: 'verde',
  NOT_COMPLETED: 'amarillo',
};

/** Textos de producto. Ninguno nombra un código, una ruta ni una capa técnica. */
export const HOSPITAL_VISITA_TEXTO = {
  tituloTarjeta: 'Visita domiciliaria',
  etiquetaEstado: 'Estado de la visita',
  vacio:
    'No hay ninguna visita abierta en esta pantalla. Prepare una visita desde «Agenda y citas» para verla aquí.',
  comprobando: 'Comprobando el estado de la visita…',
  sinSesionProfesional:
    'Para iniciar o cerrar esta visita hace falta una sesión personal profesional vigente.',
  actualizada: 'El estado de la visita se actualizó.',
  registrando: 'Registrando…',
  terminal: 'Esta visita ya está cerrada y no admite más cambios de estado.',
  nota: 'El estado de una visita describe su avance operativo. No es un dato clínico, no describe la atención prestada y no acredita que se haya prestado.',

  /* --- Sesión personal profesional (HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI) --- */

  sesionTitulo: 'Sesión profesional',
  sesionDescripcion:
    'Iniciar o cerrar una visita corresponde a la persona profesional asignada y exige su sesión personal. Es independiente de la sesión institucional de esta pantalla, que no cambia.',
  entrar: 'Abrir sesión profesional',
  entrarAyuda:
    'Se abre en una pestaña nueva. Al terminar, vuelva a esta pantalla y use «Comprobar sesión profesional».',
  comprobar: 'Comprobar sesión profesional',
  salir: 'Cerrar sesión profesional',
  humanaSinComprobar:
    'Todavía no se ha comprobado si hay una sesión profesional en este navegador.',
  humanaComprobando: 'Comprobando la sesión profesional…',
  humanaActiva:
    'Hay una sesión profesional vigente. Las acciones de la visita siguen dependiendo de la autorización del servidor.',
  humanaSinContexto:
    'La sesión personal vigente no corresponde a una persona profesional, y por eso no habilita acciones sobre la visita.',
  humanaSinSesion: 'No hay una sesión profesional vigente en este navegador.',
  humanaNoDisponible:
    'No fue posible comprobar la sesión profesional en este momento. Inténtelo de nuevo más tarde.',
  humanaCerrando: 'Cerrando la sesión profesional…',
  humanaCerrada:
    'Sesión profesional cerrada. Las acciones de la visita quedan retiradas. La sesión institucional de esta pantalla no cambió.',
  humanaCierreNoConfirmado:
    'No fue posible confirmar el cierre de la sesión profesional. Sigue abierta. Inténtelo de nuevo.',
} as const;

/**
 * `true` cuando el SERVIDOR confirmó el contexto profesional.
 *
 * FAIL-CLOSED: cualquier otro valor —incluido «aún sin comprobar»— es `false`.
 * Devolver `true` NO habilita ninguna acción por sí mismo: solo autoriza a
 * volver a preguntar por la visita, que es quien decide.
 */
export function hayContextoProfesional(estado: EstadoSesionHumana | null): boolean {
  return estado === 'activa-profesional';
}

/**
 * Mensaje visible del estado de la sesión humana.
 *
 * Ninguno nombra un código, una ruta, una caducidad ni un dato de persona: la
 * consulta del contrato humano devuelve caducidad y contextos, y nada de eso
 * llega a la pantalla. `cancelado` no anuncia nada, porque cambiar de pantalla
 * no es un error.
 */
export function mensajeDeSesionHumana(estado: EstadoSesionHumana | null): string {
  switch (estado) {
    case 'activa-profesional':
      return HOSPITAL_VISITA_TEXTO.humanaActiva;
    case 'activa-sin-contexto':
      return HOSPITAL_VISITA_TEXTO.humanaSinContexto;
    case 'sin-sesion':
      return HOSPITAL_VISITA_TEXTO.humanaSinSesion;
    case 'no-disponible':
      return HOSPITAL_VISITA_TEXTO.humanaNoDisponible;
    case 'cancelado':
      return '';
    case null:
    default:
      return HOSPITAL_VISITA_TEXTO.humanaSinComprobar;
  }
}

/** Acción profesional ofrecida para un estado concreto. */
export interface HospitalVisitaAccion {
  readonly destino: HospitalVisitaDestino;
  readonly etiqueta: string;
  /** Ayuda accesible: dice qué registra la acción, sin describir la atención. */
  readonly ayuda: string;
}

const ACCION_INICIAR: HospitalVisitaAccion = {
  destino: 'IN_PROGRESS',
  etiqueta: 'Iniciar',
  ayuda: 'Registra que la visita domiciliaria comenzó.',
};

const ACCION_COMPLETAR: HospitalVisitaAccion = {
  destino: 'COMPLETED',
  etiqueta: 'Completar',
  ayuda: 'Registra que la visita domiciliaria terminó.',
};

const ACCION_NO_COMPLETADA: HospitalVisitaAccion = {
  destino: 'NOT_COMPLETED',
  etiqueta: 'No completada',
  ayuda: 'Registra que la visita domiciliaria no llegó a realizarse.',
};

/**
 * Acciones que un estado admite.
 *
 * Es una función PURA de presentación, NO la máquina de transiciones: esa vive
 * ENTERA en el servidor y es él quien admite o rechaza cada cambio. Aquí solo se
 * decide qué botones tiene sentido MOSTRAR. `SCHEDULED` no aparece como destino
 * —crear la visita es el acto institucional— y los dos estados terminales no
 * ofrecen nada.
 */
export function accionesDeVisita(
  estado: HospitalVisitaEstado,
): readonly HospitalVisitaAccion[] {
  switch (estado) {
    case 'SCHEDULED':
      return [ACCION_INICIAR, ACCION_NO_COMPLETADA];
    case 'IN_PROGRESS':
      return [ACCION_COMPLETAR, ACCION_NO_COMPLETADA];
    case 'COMPLETED':
    case 'NOT_COMPLETED':
    default:
      return [];
  }
}

/**
 * Aviso visible de un desenlace.
 *
 * Solo `sin-sesion` recibe redacción propia, porque es el ÚNICO caso en que la
 * persona puede hacer algo al respecto y el mensaje genérico del cliente —«su
 * sesión no está activa»— sería ambiguo cuando la sesión institucional sí lo
 * está. Los demás desenlaces usan el texto centralizado del cliente, que no
 * expone código, ruta ni capa técnica alguna.
 */
export function avisoDeVisita(resultado: ResultadoVisita<unknown>): string | null {
  return resultado.kind === 'sin-sesion'
    ? HOSPITAL_VISITA_TEXTO.sinSesionProfesional
    : mensajeDeVisita(resultado);
}

/**
 * `true` cuando la consulta profesional autoriza mostrar acciones.
 *
 * FAIL-CLOSED por construcción: cualquier valor que no sea un `ok` confirmado
 * por el servidor —incluida la consulta todavía sin responder— devuelve `false`.
 */
export function hayAccionesProfesionales(
  consulta: ResultadoVisita<HospitalVisitaProfesionalDto> | null,
): boolean {
  return consulta !== null && consulta.kind === 'ok';
}

/** Tarjeta de estado con sus acciones. Sin estado local: todo llega tipado. */
export function VisitaTarjeta({
  estado,
  acciones,
  enviando,
  bloqueado,
  onTransicion,
}: {
  readonly estado: HospitalVisitaEstado;
  readonly acciones: readonly HospitalVisitaAccion[];
  /** Destino cuyo envío está en curso, si lo hay. */
  readonly enviando: HospitalVisitaDestino | null;
  readonly bloqueado: boolean;
  readonly onTransicion: (destino: HospitalVisitaDestino) => void;
}): ReactNode {
  return (
    <HospitalCard gap={16} className={compartido.listaCard} aria-labelledby={VISITA_ID}>
      <HospitalCardHeader
        titulo={HOSPITAL_VISITA_TEXTO.tituloTarjeta}
        tituloId={VISITA_ID}
        extra={
          <HospitalBadge tono={TONO_POR_ESTADO[estado]} className={styles.estado}>
            {`${HOSPITAL_VISITA_TEXTO.etiquetaEstado}: ${HOSPITAL_VISITA_ETIQUETA[estado]}`}
          </HospitalBadge>
        }
      />

      {acciones.length === 0 ? null : (
        <div className={compartido.cardHead}>
          {acciones.map((accion) => (
            <span key={accion.destino}>
              <button
                type="button"
                className={`${compartido.button} ${
                  accion.destino === 'NOT_COMPLETED'
                    ? compartido.buttonNeutro
                    : compartido.buttonPrimario
                }`}
                disabled={bloqueado}
                aria-describedby={`hospital-visitas-accion-${accion.destino}`}
                onClick={() => {
                  onTransicion(accion.destino);
                }}
              >
                {enviando === accion.destino
                  ? HOSPITAL_VISITA_TEXTO.registrando
                  : accion.etiqueta}
              </button>
              <span className="merdn-sr-only" id={`hospital-visitas-accion-${accion.destino}`}>
                {accion.ayuda}
              </span>
            </span>
          ))}
        </div>
      )}
    </HospitalCard>
  );
}

/**
 * Panel de la sesión personal profesional.
 *
 * Sin estado propio: recibe el estado ya resuelto y devuelve las intenciones al
 * contenedor. Solo se monta cuando hace falta, de modo que una pantalla ya
 * autorizada no invita a cerrar nada.
 *
 * El inicio de sesión es un ENLACE, no un botón: es una navegación real hacia
 * el flujo OIDC del servidor, y solo una navegación puede completarlo.
 */
export function SesionProfesionalPanel({
  estado,
  mensaje,
  ocupado,
  onComprobar,
  onCerrar,
}: {
  readonly estado: EstadoSesionHumana | null;
  readonly mensaje: string;
  /** `true` mientras una consulta o un cierre está en curso. */
  readonly ocupado: boolean;
  readonly onComprobar: () => void;
  readonly onCerrar: () => void;
}): ReactNode {
  const profesional = hayContextoProfesional(estado);

  return (
    <HospitalCard gap={12} aria-labelledby={SESION_ID}>
      <HospitalCardHeader
        titulo={HOSPITAL_VISITA_TEXTO.sesionTitulo}
        tituloId={SESION_ID}
      />

      <p className={compartido.note}>{HOSPITAL_VISITA_TEXTO.sesionDescripcion}</p>

      <div className={compartido.cardHead}>
        {profesional ? null : (
          <span>
            <a
              className={`${compartido.button} ${compartido.buttonPrimario}`}
              href={urlDeLoginHumano()}
              target="_blank"
              rel="noopener noreferrer"
              aria-describedby={ENTRAR_AYUDA_ID}
            >
              {HOSPITAL_VISITA_TEXTO.entrar}
            </a>
            <span className="merdn-sr-only" id={ENTRAR_AYUDA_ID}>
              {HOSPITAL_VISITA_TEXTO.entrarAyuda}
            </span>
          </span>
        )}

        <button
          type="button"
          className={`${compartido.button} ${compartido.buttonNeutro}`}
          disabled={ocupado}
          onClick={onComprobar}
        >
          {HOSPITAL_VISITA_TEXTO.comprobar}
        </button>

        {profesional ? (
          <button
            type="button"
            className={`${compartido.button} ${compartido.buttonNeutro}`}
            disabled={ocupado}
            onClick={onCerrar}
          >
            {HOSPITAL_VISITA_TEXTO.salir}
          </button>
        ) : null}
      </div>

      {/* Región viva del panel: anuncia el desenlace sin nombrar a nadie. */}
      <p className={compartido.note} role="status" aria-live="polite">
        {mensaje}
      </p>
    </HospitalCard>
  );
}

export function HospitalHomeVisits({
  visita = null,
  consultaInicial = null,
  sesionHumanaInicial = null,
  fetchImpl,
}: {
  /**
   * Visita materializada que el shell transporta desde la agenda.
   *
   * `null` cuando no hay ninguna abierta: la vista NO consulta nada y declara
   * el vacío. Es estado EFÍMERO del montaje: no persiste ni viaja por URL.
   */
  readonly visita?: HospitalVisitaMaterializadaDto | null;
  /**
   * Consulta profesional ya resuelta.
   *
   * Cuando se aporta, la vista NO consulta la red: permite probar cada
   * desenlace sin jsdom, igual que `agendaInicial` en Agenda. No es un fixture:
   * es el mismo desenlace tipado que devuelve el cliente.
   */
  readonly consultaInicial?: ResultadoVisita<HospitalVisitaProfesionalDto> | null;
  /**
   * Estado de la sesión humana ya resuelto.
   *
   * Mismo papel que `consultaInicial`: permite comprobar cada desenlace del
   * contrato humano sin jsdom. `null` es el estado real de partida —todavía no
   * se ha comprobado nada— y nunca habilita acciones.
   */
  readonly sesionHumanaInicial?: EstadoSesionHumana | null;
  /** Implementación de `fetch` que se entrega al cliente. La vista no la invoca. */
  readonly fetchImpl?: typeof fetch;
}): ReactNode {
  /** `null` mientras la consulta profesional no ha respondido. */
  const [consulta, setConsulta] = useState<ResultadoVisita<HospitalVisitaProfesionalDto> | null>(
    consultaInicial,
  );
  /** Destino cuyo `PATCH` está en curso. Es la guarda del doble envío. */
  const [enviando, setEnviando] = useState<HospitalVisitaDestino | null>(null);
  /** Contador de refrescos. Cada incremento vuelve a leer la visita del servidor. */
  const [refresco, setRefresco] = useState<number>(0);
  const [aviso, setAviso] = useState<string>('');
  /** Estado de la sesión humana. `null` mientras nadie la haya comprobado. */
  const [sesionHumana, setSesionHumana] = useState<EstadoSesionHumana | null>(
    sesionHumanaInicial,
  );
  /** Aviso propio del panel humano. Vacío deja hablar al estado derivado. */
  const [avisoHumano, setAvisoHumano] = useState<string>('');
  /** Guarda del doble envío de las operaciones humanas. */
  const [operandoHumana, setOperandoHumana] = useState<boolean>(false);

  /** Evita escribir sobre una vista ya desmontada tras una mutación en curso. */
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;

    return (): void => {
      montadoRef.current = false;
    };
  }, []);

  const homeVisitId = visita === null ? null : visita.homeVisitId;

  useEffect(() => {
    if (homeVisitId === null || consultaInicial !== null) {
      // Sin visita abierta, o desenlace inyectado: no se consulta la red.
      return undefined;
    }

    const controller = new AbortController();
    let vigente = true;

    // Volver a «comprobando» retira las acciones mientras no haya respuesta.
    setConsulta(null);

    void consultarVisitaProfesional(homeVisitId, fetchImpl ?? fetch, controller.signal).then(
      (resultado) => {
        /*
         * Una respuesta tardía —o cancelada— nunca sustituye al estado actual:
         * `vigente` la descarta aunque el `AbortSignal` no llegara a tiempo.
         */
        if (!vigente || resultado.kind === 'cancelado') {
          return;
        }

        setConsulta(resultado);
      },
    );

    return (): void => {
      vigente = false;
      controller.abort();
    };
  }, [homeVisitId, refresco, fetchImpl, consultaInicial]);

  /**
   * Cambio de estado pedido por la persona profesional.
   *
   * Tres guardas ANTES de tocar la red: no hay otro envío en curso, hay visita,
   * y la consulta profesional respondió `ok`. Esta última es la que impide que
   * una sesión institucional ejecute la visita de una persona: sin `ok` no hay
   * versión vigente que enviar y no se llega hasta aquí.
   *
   * Después de la respuesta se vuelve a LEER la visita del servidor —también
   * ante conflicto—: el estado visible nunca se compone con lo que la pantalla
   * creía saber. Mientras el refresco no responda, las acciones quedan retiradas.
   */
  function transicionar(destino: HospitalVisitaDestino): void {
    if (enviando !== null || visita === null || consulta === null || consulta.kind !== 'ok') {
      return;
    }

    setEnviando(destino);
    setAviso('');

    void cambiarEstadoVisita(
      visita.homeVisitId,
      destino,
      consulta.datos.version,
      fetchImpl ?? fetch,
    ).then((resultado) => {
      if (!montadoRef.current) {
        return;
      }

      setEnviando(null);

      if (resultado.kind === 'ok') {
        setAviso(HOSPITAL_VISITA_TEXTO.actualizada);
        setRefresco((actual) => actual + 1);

        return;
      }

      setAviso(avisoDeVisita(resultado) ?? '');

      if (requiereRefrescoDeVisita(resultado)) {
        // Conflicto: se relee antes de permitir cualquier reintento.
        setRefresco((actual) => actual + 1);
      }
    });
  }

  /**
   * Comprueba la sesión humana contra el contrato existente.
   *
   * Solo un `activa-profesional` —el contexto que devuelve el SERVIDOR— vuelve
   * a leer la visita. Ese refresco no concede nada: retira las acciones
   * mientras la relectura no responda, y es la respuesta de la visita la que
   * decide si vuelven a existir. Un contexto humano sin `PROFESSIONAL` no
   * refresca nada y no habilita nada.
   */
  function comprobarSesionProfesional(): void {
    if (operandoHumana) {
      return;
    }

    setOperandoHumana(true);
    setAvisoHumano(HOSPITAL_VISITA_TEXTO.humanaComprobando);

    void consultarSesionHumana(fetchImpl ?? fetch).then((estado) => {
      if (!montadoRef.current) {
        return;
      }

      setOperandoHumana(false);

      if (estado === 'cancelado') {
        setAvisoHumano('');

        return;
      }

      setSesionHumana(estado);
      // Vacío: el mensaje pasa a derivarse del estado recién confirmado.
      setAvisoHumano('');

      if (estado === 'activa-profesional') {
        setRefresco((actual) => actual + 1);
      }
    });
  }

  /**
   * Revoca la sesión humana profesional.
   *
   * Solo una revocación CONFIRMADA por el servidor retira la sesión de la
   * pantalla: ocultarla sin confirmación haría creer que se cerró cuando el
   * servidor la conserva. Confirmado el cierre se relee la visita, que volverá
   * a fallar cerrado y retirará las acciones.
   *
   * La sesión INSTITUCIONAL no se toca: es otra entidad y esta operación no la
   * nombra.
   */
  function cerrarSesionProfesional(): void {
    if (operandoHumana) {
      return;
    }

    setOperandoHumana(true);
    setAvisoHumano(HOSPITAL_VISITA_TEXTO.humanaCerrando);

    void cerrarSesionHumana(fetchImpl ?? fetch).then((cierre) => {
      if (!montadoRef.current) {
        return;
      }

      setOperandoHumana(false);

      if (cierre === 'cancelado') {
        setAvisoHumano('');

        return;
      }

      if (cierreHumanoConfirmado(cierre)) {
        setSesionHumana('sin-sesion');
        setAvisoHumano(HOSPITAL_VISITA_TEXTO.humanaCerrada);
        setAviso('');
        setRefresco((actual) => actual + 1);

        return;
      }

      setAvisoHumano(HOSPITAL_VISITA_TEXTO.humanaCierreNoConfirmado);
    });
  }

  const encabezado = (
    <HospitalViewHeader encabezado={HOSPITAL_VISITA_ENCABEZADO} tituloId={TITULO_ID} />
  );

  /*
   * Sin visita abierta NO se muestra ninguna lista: la anterior era
   * demostrativa y publicarla aquí afirmaría atenciones que nadie registró.
   */
  if (visita === null) {
    return (
      <div className={compartido.view}>
        {encabezado}
        <HospitalCard gap={16}>
          <p className={compartido.note} role="status">
            {HOSPITAL_VISITA_TEXTO.vacio}
          </p>
        </HospitalCard>
        <HospitalNote>{HOSPITAL_VISITA_TEXTO.nota}</HospitalNote>
      </div>
    );
  }

  /*
   * Estado visible. Procede de la consulta profesional cuando el servidor la
   * autorizó; en cualquier otro caso se CONSERVA el `SCHEDULED` que devolvió la
   * materialización institucional, que es un hecho igual de real. Lo que no se
   * conserva en ningún caso son las acciones.
   */
  const autorizada = hayAccionesProfesionales(consulta);
  const estadoVisible: HospitalVisitaEstado =
    consulta !== null && consulta.kind === 'ok' ? consulta.datos.status : visita.status;
  const acciones = autorizada ? accionesDeVisita(estadoVisible) : [];

  /*
   * Explicación permanente del porqué de la ausencia de acciones. Nunca es un
   * código ni una ruta: es lo que la persona necesita saber para poder actuar.
   */
  /*
   * El panel de sesión profesional aparece cuando lo que falta es EXACTAMENTE
   * esa sesión —lo dice la consulta de la visita, no la pantalla— o cuando ya
   * se comprobó alguna vez. Una pantalla ya autorizada no lo monta: no hay nada
   * que abrir ni motivo para invitar a cerrar.
   */
  const faltaSesionHumana = consulta !== null && consulta.kind === 'sin-sesion';
  const mostrarSesionHumana = faltaSesionHumana || sesionHumana !== null;
  const mensajeHumano =
    avisoHumano === '' ? mensajeDeSesionHumana(sesionHumana) : avisoHumano;

  let explicacion = '';

  if (consulta === null) {
    explicacion = HOSPITAL_VISITA_TEXTO.comprobando;
  } else if (autorizada) {
    explicacion = acciones.length === 0 ? HOSPITAL_VISITA_TEXTO.terminal : '';
  } else {
    explicacion = avisoDeVisita(consulta) ?? '';
  }

  return (
    <div className={compartido.view}>
      {encabezado}

      <VisitaTarjeta
        estado={estadoVisible}
        acciones={acciones}
        enviando={enviando}
        bloqueado={enviando !== null}
        onTransicion={transicionar}
      />

      {explicacion === '' ? null : <p className={compartido.note}>{explicacion}</p>}

      {mostrarSesionHumana ? (
        <SesionProfesionalPanel
          estado={sesionHumana}
          mensaje={mensajeHumano}
          ocupado={operandoHumana}
          onComprobar={comprobarSesionProfesional}
          onCerrar={cerrarSesionProfesional}
        />
      ) : null}

      {/*
       * Región viva de la visita. Anuncia el desenlace de la transición
       * —incluido el conflicto— sin describir la visita ni nombrar a nadie. El
       * panel de sesión profesional tiene la suya propia, porque anuncia otra
       * cosa y solo existe cuando ese panel se monta.
       */}
      <p className={compartido.note} id={AVISO_ID} role="status" aria-live="polite">
        {aviso}
      </p>

      <HospitalNote>{HOSPITAL_VISITA_TEXTO.nota}</HospitalNote>
    </div>
  );
}
