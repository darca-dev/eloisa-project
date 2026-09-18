'use client';

import { useEffect, useState, type ReactNode } from 'react';

import styles from './hospital.module.css';
import { HospitalAdministration } from './HospitalAdministration';
import { HOSPITAL_ADMIN_PESTANA_INICIAL } from './hospitalAdministrationConfig';
import type { HospitalAdminPestanaId } from './hospitalAdministrationConfig';
import { HospitalAgenda } from './HospitalAgenda';
import { HospitalAlerts } from './HospitalAlerts';
import { HospitalDashboard } from './HospitalDashboard';
import { HospitalFinancialManagement } from './HospitalFinancialManagement';
import type { FinancialSeccionId } from './hospitalFinancialConfig';
import { HOSPITAL_ETIQUETA_PLATAFORMA, hospitalShellDemo } from './hospitalConfig';
import type { HospitalShellConfig } from './hospitalConfig';
import { HospitalHomeVisits } from './HospitalHomeVisits';
import {
  HOSPITAL_MENSAJE_APERTURA,
  HOSPITAL_MENSAJE_CREDENCIAL,
  HOSPITAL_MENSAJE_SIN_CONFIRMAR,
  LONGITUD_MAXIMA_CREDENCIAL,
  abrirSesionInstitucional,
  cerrarSesionInstitucional,
  consultarSesionInstitucional,
  resolverCierre,
  resolverReconfirmacion,
  validarAcceso,
  type HospitalSesionDto,
  type IntencionCierre,
} from './hospitalInstitutionClient';
import { HospitalPatients } from './HospitalPatients';
import { HospitalProfessionals } from './HospitalProfessionals';
import { HospitalRatings } from './HospitalRatings';
import { HospitalReports } from './HospitalReports';
import { HospitalSidebar, HospitalSidebarNeutral } from './HospitalSidebar';
import { HospitalTopbar } from './HospitalTopbar';
import { HospitalUpdates } from './HospitalUpdates';
import { HospitalVirtualConsultations } from './HospitalVirtualConsultations';
import type { HospitalVisitaMaterializadaDto } from './hospitalVisitsClient';
import {
  HOSPITAL_ETIQUETA_INTENCION,
  HOSPITAL_ITEMS_NAVEGABLES,
  HOSPITAL_ITEM_ACTIVO_POR_VISTA,
  HOSPITAL_NAVEGACION_INICIAL,
  destinoDeItem,
  esVistaImplementada,
  siguienteNavegacion,
} from './hospitalViews';
import type {
  HospitalDestino,
  HospitalIntencionId,
  HospitalNavegacion,
  HospitalVistaId,
} from './hospitalViews';

/**
 * Shell Hospital (TASK-003H-01, FR-01; TASK-003H-03, FR-01;
 * TASK-003H-05, FR-01).
 *
 * Composición persistente de la experiencia Hospital: sidebar, topbar y área de
 * contenido, según las líneas 20–103 del prototipo oficial. Sidebar, topbar,
 * buscador, campana, perfil, identidad institucional, orden del menú y badges
 * se conservan sin cambios.
 *
 * El área de contenido monta una sola vista a la vez. Al cargar `/hospital` es
 * `Inicio`. TASK-003H-03 añade `Agenda y citas`, `Pacientes` y
 * `Semáforo de alarmas`, y TASK-003H-04 añade `Profesionales`,
 * `Visitas domiciliarias`, `Consultas virtuales`, `Calificaciones` y
 * `Novedades`, todas seleccionables desde el menú. TASK-003H-05 añade
 * `Administración institucional`, a la que llega `Configuración` —«Membresías y
 * servicios» ya no es una opción del menú y permanece como pestaña dentro del
 * contenedor—, y el destino provisional de `Gestión financiera`, que solo
 * declara que el módulo está en preparación. TASK-003H-07 añade `Reportes`, el
 * dashboard ejecutivo con vista Hospital y vista institucional / Alcaldía. La
 * pestaña administrativa vive en este estado local: dura lo que dura el montaje
 * y se reinicia al recargar.
 *
 * TASK-003H-02B (FR-09) eleva aquí la navegación: el estado local pasa a ser
 * `vista` más una intención de lectura opcional que los controles de Inicio
 * pueden transportar. La intención es efímera y solo orienta: no filtra, no
 * recorta, no reordena y no modifica el contenido de la vista destino, que
 * sigue siendo exactamente el aprobado. Se muestra como un aviso compacto
 * dentro del área de contenido y se limpia sola en cuanto se navega desde el
 * sidebar o desde cualquier acceso sin intención.
 *
 * La navegación es estado local del cliente: no crea rutas, no cambia la URL,
 * no persiste y no se comparte entre recargas. Las opciones del menú sin vista
 * implementada quedan inertes y no dejan el contenido principal vacío.
 *
 * `data-hospital-content` es solo un marcador técnico: no es visible ni se
 * anuncia a tecnologías de asistencia.
 *
 * TASK-HOSPITAL-CORE-01 (§4.1.11 y §10.10) conecta el shell al CONTEXTO de la
 * sesión institucional. Es lo único que el shell consulta:
 *
 * - con sesión válida, el topbar deja de mostrar la persona demostrativa y
 *   muestra el actor IMPERSONAL y el rol efectivo que devuelve el servidor, y el
 *   sidebar muestra el nombre REAL del tenant. La credencial institucional es
 *   compartida por la institución: no corresponde a ninguna persona trabajadora
 *   y no debe presentarse como si lo hiciera;
 * - ante `401`, `403`, revocación o error, la identidad se limpia de INMEDIATO y
 *   el shell NO vuelve a los literales demostrativos, y la vista Pacientes
 *   limpia por su cuenta toda la información nominal que hubiera servido;
 * - mientras la consulta no ha respondido —y en el render de servidor, donde no
 *   se ejecuta— el shell conserva la configuración demostrativa, que es la
 *   superficie no autenticada ya aprobada.
 *
 * MP-TODAY-02 hace operable el «Acceso institucional» desde esta misma
 * interfaz. La sesión pasa a tener TRES estados observables:
 *
 * - `consultando`: la consulta de contexto todavía no respondió, y es también
 *   el render de servidor. Se muestra el marco NEUTRAL de Hospital y, dentro
 *   del área principal, el estado de comprobación. Todavía no hay formulario;
 * - `sin-sesion`: el servidor respondió que no hay sesión vigente, o acaba de
 *   cerrarse una. Se muestra el mismo marco NEUTRAL, con el formulario de
 *   acceso integrado en el área principal y sin institución, persona, badge ni
 *   ningún otro dato demostrativo;
 * - sesión vigente: la identidad mostrada procede SIEMPRE de `current`, nunca
 *   del cuerpo de la apertura, y la topbar ofrece cambiar y cerrar sesión.
 *
 * Sobre la credencial: se escribe, se envía una sola vez y se borra del estado
 * en el mismo gesto que la envía. No se guarda en el navegador, no viaja por la
 * URL y no se registra. El token de sesión nunca pasa por este código: vive en
 * una cookie `HttpOnly`. El cliente no declara tenant ni rol: los resuelve el
 * servidor y esta interfaz solo muestra lo que él devuelve.
 *
 * H-FID-A recupera la continuidad visual de Hospital en los dos estados no
 * autenticados: el acceso deja de parecer una aplicación aislada y vive dentro
 * de la geometría del shell —sidebar neutral y área principal—. Es continuidad
 * ESTRUCTURAL, no de contenido: no se monta topbar funcional, ni buscador, ni
 * campana, ni perfil, ni módulo, ni `data-hospital-content`, y no se muestra
 * institución, tipo, municipio, persona, iniciales, badge ni conteo alguno.
 * Visibilidad estructural NO es autorización: los guards y el servidor siguen
 * siendo la autoridad.
 *
 * La navegación sigue siendo estado local: sin rutas, sin URL, sin persistencia
 * y sin permisos. El shell no concede acceso a nada: cada superficie lo exige en
 * el servidor.
 */

/**
 * Marcador técnico del área de contenido. `inicio` conserva el valor
 * `dashboard` aprobado en TASK-003H-02 para no alterar el shell existente.
 */
const MARCADOR_CONTENIDO: Record<HospitalVistaId, string> = {
  inicio: 'dashboard',
  agenda: 'agenda',
  pacientes: 'pacientes',
  alarmas: 'alarmas',
  profesionales: 'profesionales',
  visitas: 'visitas',
  virtuales: 'virtuales',
  calificaciones: 'calificaciones',
  novedades: 'novedades',
  financiera: 'financiera',
  reportes: 'reportes',
  administracion: 'administracion',
};

/** Vista montada dentro del único `<main>` del shell. */
function HospitalContenido({
  vista,
  pestanaAdministracion,
  seccionFinanciera,
  filaFinanciera,
  visita,
  onNavegar,
  onSeleccionarPestana,
  onVisitaMaterializada,
}: {
  readonly vista: HospitalVistaId;
  readonly pestanaAdministracion: HospitalAdminPestanaId;
  readonly seccionFinanciera: FinancialSeccionId | undefined;
  readonly filaFinanciera: string | null;
  /** Visita domiciliaria abierta en este montaje. `null` cuando no hay ninguna. */
  readonly visita: HospitalVisitaMaterializadaDto | null;
  readonly onNavegar: (destino: HospitalDestino) => void;
  readonly onSeleccionarPestana: (pestana: HospitalAdminPestanaId) => void;
  readonly onVisitaMaterializada: (visita: HospitalVisitaMaterializadaDto) => void;
}): ReactNode {
  switch (vista) {
    case 'agenda':
      return <HospitalAgenda onVisitaMaterializada={onVisitaMaterializada} />;
    case 'pacientes':
      return <HospitalPatients />;
    case 'alarmas':
      return <HospitalAlerts />;
    case 'profesionales':
      return <HospitalProfessionals />;
    case 'visitas':
      return <HospitalHomeVisits visita={visita} />;
    case 'virtuales':
      return <HospitalVirtualConsultations />;
    case 'calificaciones':
      return <HospitalRatings />;
    case 'novedades':
      return <HospitalUpdates />;
    case 'reportes':
      return <HospitalReports />;
    case 'financiera':
      return (
        <HospitalFinancialManagement
          seccionInicial={seccionFinanciera}
          filaInicial={filaFinanciera}
        />
      );
    case 'administracion':
      return (
        <HospitalAdministration
          pestana={pestanaAdministracion}
          onSeleccionarPestana={onSeleccionarPestana}
        />
      );
    case 'inicio':
    default:
      return <HospitalDashboard onNavegar={onNavegar} />;
  }
}

/**
 * Superficie de acceso institucional.
 *
 * Vive DENTRO del área principal del marco neutral: conserva la geometría de
 * Hospital sin montar topbar, módulo, institución, persona ni conteos. Una
 * pantalla sin sesión no puede afirmar nada sobre una institución, y los
 * literales demostrativos lo afirmarían.
 *
 * La credencial vive en el estado de ESTE componente durante lo que dura la
 * escritura y se borra en el mismo gesto que la envía. No se guarda en el
 * navegador, no viaja por la URL y no se envía a ningún sitio distinto del
 * endpoint de apertura.
 */
function HospitalAccesoInstitucional({
  aviso,
  ocupado,
  onEntrar,
}: {
  /** Aviso de validación, de fallo o de confirmación. `null` cuando no hay. */
  readonly aviso: string | null;
  readonly ocupado: boolean;
  readonly onEntrar: (identityCode: string, accessSecret: string) => void;
}): ReactNode {
  const [codigo, setCodigo] = useState('');
  const [credencial, setCredencial] = useState('');

  return (
    <section className={styles.ingresoPanel} aria-labelledby="hospital-acceso-titulo">
      <h1 className={styles.ingresoTitulo} id="hospital-acceso-titulo">
        Acceso institucional
      </h1>
      <p className={styles.ingresoTexto}>
        La credencial de acceso es de la INSTITUCIÓN y es compartida: no identifica a ninguna
        persona trabajadora. Sin una sesión vigente esta pantalla no muestra información
        institucional.
      </p>
      <form
        className={styles.ingresoForm}
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();

          const identityCode = codigo.trim();
          const accessSecret = credencial;

          /*
           * La credencial se retira del estado en el MISMO gesto que la
           * envía: no sobrevive al intento, ni cuando falla. Quien reintente
           * vuelve a escribirla.
           */
          setCredencial('');
          onEntrar(identityCode, accessSecret);
        }}
      >
        <label className={styles.ingresoCampo} htmlFor="hospital-acceso-codigo">
          <span className={styles.ingresoEtiqueta}>Código de identidad institucional</span>
          <input
            autoComplete="off"
            className={styles.ingresoInput}
            disabled={ocupado}
            id="hospital-acceso-codigo"
            inputMode="text"
            onChange={(evento) => {
              setCodigo(evento.target.value);
            }}
            spellCheck={false}
            type="text"
            value={codigo}
          />
        </label>
        <label className={styles.ingresoCampo} htmlFor="hospital-acceso-credencial">
          <span className={styles.ingresoEtiqueta}>Credencial de acceso</span>
          <input
            autoComplete="off"
            className={styles.ingresoInput}
            disabled={ocupado}
            id="hospital-acceso-credencial"
            maxLength={LONGITUD_MAXIMA_CREDENCIAL}
            onChange={(evento) => {
              setCredencial(evento.target.value);
            }}
            spellCheck={false}
            type="password"
            value={credencial}
          />
        </label>
        <button className={styles.ingresoBoton} disabled={ocupado} type="submit">
          {ocupado ? 'Comprobando…' : 'Entrar'}
        </button>
        {/*
         * Región viva PERMANENTE: existe desde el primer render para que un
         * lector de pantalla anuncie el aviso cuando aparezca, en lugar de
         * tener que descubrir un nodo nuevo. Vacía no anuncia nada.
         */}
        <p className={styles.ingresoAviso} role="alert">
          {aviso ?? ''}
        </p>
      </form>
    </section>
  );
}

/**
 * Marco NEUTRAL del shell Hospital (H-FID-A, §3.1 y §3.2).
 *
 * Es la envolvente reconocible de Hospital —sidebar y área principal— sin nada
 * que dependa de una sesión: sin topbar funcional, sin buscador, sin campana,
 * sin perfil, sin módulo y sin `data-hospital-content`. Lo comparten los dos
 * estados no autenticados para que el acceso no parezca otra aplicación.
 */
function HospitalMarcoNeutral({
  etiquetaPlataforma,
  children,
}: {
  readonly etiquetaPlataforma: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.shell}>
      <HospitalSidebarNeutral etiquetaPlataforma={etiquetaPlataforma} />
      <div className={styles.main}>
        {/*
         * `<main>` SIN marcador de contenido: no hay módulo montado y
         * `data-hospital-content` afirmaría que sí lo hay.
         */}
        <main className={styles.ingreso}>{children}</main>
      </div>
    </div>
  );
}

export function HospitalShell({
  config = hospitalShellDemo,
  etiquetaPlataforma = HOSPITAL_ETIQUETA_PLATAFORMA,
  vistaInicial,
  intencionInicial,
  pestanaAdministracionInicial = HOSPITAL_ADMIN_PESTANA_INICIAL,
  seccionFinancieraInicial,
  filaFinancieraInicial = null,
  visitaInicial = null,
  sesionInicial = null,
  fetchImpl,
}: {
  readonly config?: HospitalShellConfig;
  readonly etiquetaPlataforma?: string;
  /**
   * Vista mostrada al montar. Sin valor se usa la opción activa de la
   * configuración, que es `Inicio`. No persiste entre recargas.
   */
  readonly vistaInicial?: HospitalVistaId;
  /**
   * Intención mostrada al montar. Como `vistaInicial`, es estado de montaje:
   * no persiste, no viaja por URL y se limpia en cuanto se navega sin ella.
   */
  readonly intencionInicial?: HospitalIntencionId;
  /**
   * Pestaña administrativa mostrada al montar. Como las anteriores, es estado
   * de montaje: no persiste, no viaja por URL y se reinicia al recargar.
   */
  readonly pestanaAdministracionInicial?: HospitalAdminPestanaId;
  /**
   * Sección financiera mostrada al montar. Como las anteriores, es estado de
   * montaje: no persiste, no viaja por URL y se reinicia al recargar.
   */
  readonly seccionFinancieraInicial?: FinancialSeccionId;
  /** Registro financiero cuyo panel de detalle se muestra al montar. */
  readonly filaFinancieraInicial?: string | null;
  /**
   * Visita domiciliaria abierta al montar.
   *
   * Como las anteriores, es estado de montaje: no persiste, no viaja por URL y
   * se reinicia al recargar. No es un fixture: es el DTO REAL que devolvió la
   * materialización.
   */
  readonly visitaInicial?: HospitalVisitaMaterializadaDto | null;
  /**
   * Contexto de sesión inyectado.
   *
   * Cuando se aporta, el shell NO consulta la red: permite probar las tres
   * superficies sin jsdom, que es como se prueba el resto del frontend.
   *
   * - un contexto: sesión vigente ya resuelta;
   * - `'sin-sesion'`: el servidor ya respondió que no hay sesión, de modo que
   *   se muestra el formulario de acceso;
   * - `null`: nada resuelto todavía. Es el valor por defecto y el del render de
   *   servidor, y es el único que dispara la consulta al montar.
   */
  readonly sesionInicial?: HospitalSesionDto | 'sin-sesion' | null;
  /** Implementación de `fetch` usada para consultar el contexto de sesión. */
  readonly fetchImpl?: typeof fetch;
}): ReactNode {
  const inicial =
    vistaInicial ?? (esVistaImplementada(config.itemActivoId) ? config.itemActivoId : 'inicio');
  const [navegacion, setNavegacion] = useState<HospitalNavegacion>(() =>
    siguienteNavegacion(HOSPITAL_NAVEGACION_INICIAL, {
      vista: inicial,
      intencion: intencionInicial,
    }),
  );
  const [pestanaAdministracion, setPestanaAdministracion] = useState<HospitalAdminPestanaId>(
    pestanaAdministracionInicial,
  );
  /**
   * Visita domiciliaria abierta, transportada desde la agenda.
   *
   * Estado EFÍMERO del montaje, exactamente como la vista, la intención y la
   * pestaña administrativa: no crea ruta, no cambia la URL, no persiste y no se
   * comparte entre recargas. Guarda el DTO REAL de la materialización —jamás un
   * dato compuesto aquí— para que la vista de visitas sepa QUÉ visita mostrar.
   *
   * Transportarlo NO concede permiso alguno: iniciar o cerrar esa visita exige
   * una sesión personal profesional que el servidor valida por su cuenta, y
   * esta sesión institucional no la sustituye.
   */
  const [visita, setVisita] = useState<HospitalVisitaMaterializadaDto | null>(visitaInicial);
  /**
   * Contexto de la sesión institucional. `null` cuando no hay sesión vigente.
   *
   * Nunca se rellena con el cuerpo de la apertura: la identidad mostrada tiene
   * UNA sola procedencia, que es `current`.
   */
  const [sesion, setSesion] = useState<HospitalSesionDto | null>(
    sesionInicial === null || sesionInicial === 'sin-sesion' ? null : sesionInicial,
  );
  /**
   * `true` cuando el servidor ya dijo si hay sesión o no.
   *
   * Distingue «todavía no sé» de «no hay»: sin esta distinción, el primer
   * render mostraría el formulario de acceso a quien SÍ tiene sesión vigente.
   */
  const [sesionResuelta, setSesionResuelta] = useState<boolean>(sesionInicial !== null);
  /** Aviso de validación, de fallo o de confirmación del acceso. */
  const [aviso, setAviso] = useState<string | null>(null);
  /** `true` mientras una operación de sesión está en curso. */
  const [ocupado, setOcupado] = useState(false);
  const { vista, intencion } = navegacion;

  /*
   * Consulta del contexto de sesión.
   *
   * Se cancela al desmontar para que una respuesta tardía no escriba sobre un
   * shell que ya no está en pantalla. No se ejecuta en el render de servidor.
   */
  useEffect(() => {
    if (sesionInicial !== null) {
      // Contexto inyectado: no se consulta la red.
      return undefined;
    }

    const controller = new AbortController();
    let vigente = true;

    void consultarSesionInstitucional(fetchImpl ?? fetch, controller.signal).then(
      (resultado) => {
        if (!vigente || resultado.kind === 'cancelado') {
          return;
        }

        /*
         * Cualquier desenlace que no sea una sesión vigente limpia la identidad.
         * No se recurre a los literales demostrativos: mostrarlos tras un 401
         * afirmaría una institución y una persona que la sesión no respalda.
         */
        setSesion(resultado.kind === 'ok' ? resultado.datos : null);
        setSesionResuelta(true);

        if (resultado.kind === 'error') {
          setAviso(HOSPITAL_MENSAJE_APERTURA.error);
        }
      },
    );

    return (): void => {
      vigente = false;
      controller.abort();
    };
  }, [fetchImpl, sesionInicial]);

  /**
   * Identidad institucional del sidebar.
   *
   * Con sesión válida se usa el nombre REAL del tenant y se vacían el tipo y el
   * municipio, que NO están modelados: mantener «ESE · Soacha» junto a un nombre
   * real mezclaría un dato verificado con dos inventados.
   */
  const institucion =
    sesion === null
      ? config.institucion
      : { nombre: sesion.institution.name, tipo: '', municipio: '', logo: null };

  /**
   * Único punto de transición: sidebar, KPI, acciones y accesos pasan por aquí.
   *
   * La pestaña administrativa no viaja en el destino: se conserva durante el
   * montaje actual, de modo que `Configuración` reabre el contenedor donde
   * estaba. Nada de esto persiste ni cambia la URL.
   */
  const navegar = (solicitado: string | HospitalDestino): void => {
    setNavegacion((actual) => siguienteNavegacion(actual, solicitado));
  };

  /**
   * Abre la sesión y CONFIRMA el resultado con `current`.
   *
   * La apertura por sí sola no basta para mostrar identidad: quien decide qué
   * se muestra es el contexto que devuelve el servidor. Si la apertura sale bien
   * pero el contexto no llega, no se muestra nada: no se compone una identidad
   * a partir de lo que se escribió.
   *
   * La interfaz NO envía tenant ni rol, y el servidor no aceptaría que lo
   * hiciera: el código de identidad solo selecciona qué credencial se verifica.
   */
  const entrar = async (identityCode: string, accessSecret: string): Promise<void> => {
    const motivo = validarAcceso(identityCode, accessSecret);

    if (motivo !== null) {
      setAviso(HOSPITAL_MENSAJE_CREDENCIAL[motivo]);

      return;
    }

    const red = fetchImpl ?? fetch;

    setOcupado(true);
    setAviso(null);

    const apertura = await abrirSesionInstitucional(identityCode, accessSecret, red);

    if (apertura.kind !== 'ok') {
      setOcupado(false);
      setAviso(
        apertura.kind === 'cancelado'
          ? HOSPITAL_MENSAJE_APERTURA.error
          : HOSPITAL_MENSAJE_APERTURA[apertura.kind],
      );

      return;
    }

    const contexto = await consultarSesionInstitucional(red);

    setOcupado(false);
    setSesionResuelta(true);

    if (contexto.kind === 'ok') {
      setSesion(contexto.datos);
      setAviso(null);

      return;
    }

    setSesion(null);
    setAviso(HOSPITAL_MENSAJE_SIN_CONFIRMAR);
  };

  /**
   * Cierra la sesión vigente.
   *
   * `cambiar` y `cerrar` revocan igual: solo cambia el aviso posterior. Lo que
   * NO cambia en ninguno de los dos es la regla: la sesión se retira de la
   * interfaz ÚNICAMENTE cuando el servidor confirma que ya no existe —`204` o
   * `401`—. Ante cualquier otro desenlace se reconfirma el contexto y, si sigue
   * habiendo sesión o no puede saberse, se CONSERVA: esconder en pantalla una
   * sesión que el servidor mantiene abierta no la cierra, y dejar entrar con
   * otra credencial encima de ella sería afirmar un cambio que no ocurrió. Por
   * eso el cambio de sesión queda bloqueado hasta que la revocación se confirme.
   */
  const terminar = async (intencion: IntencionCierre): Promise<void> => {
    const red = fetchImpl ?? fetch;

    setOcupado(true);
    setAviso(null);

    const cierre = await cerrarSesionInstitucional(red);
    const decision = resolverCierre(cierre.kind, intencion);

    if (decision.retirarSesion) {
      setSesion(null);
      setSesionResuelta(true);
      setOcupado(false);
      setAviso(decision.aviso);

      return;
    }

    /*
     * Revocación NO confirmada: se vuelve a preguntar al servidor antes de
     * decidir nada. La identidad mostrada sigue teniendo una sola procedencia.
     */
    const contexto = await consultarSesionInstitucional(red);
    const tras = resolverReconfirmacion(contexto.kind, intencion);

    setOcupado(false);

    if (tras.retirarSesion) {
      setSesion(null);
      setSesionResuelta(true);
      setAviso(tras.aviso);

      return;
    }

    if (contexto.kind === 'ok') {
      // La sesión sigue viva: se refresca con lo que el servidor acaba de decir.
      setSesion(contexto.datos);
    }

    setAviso(tras.aviso);
  };

  /*
   * Mientras la sesión NO se ha resuelto se muestra el marco neutral con el
   * estado de comprobación: ni topbar funcional, ni navegación operable, ni
   * módulo, ni dato demostrativo alguno. Tampoco el formulario todavía, porque
   * aún no se sabe si hace falta.
   *
   * Es el render de servidor y el primer render del cliente. Mostrar ahí la
   * superficie demostrativa enseñaría una institución, una persona y unos
   * conteos que nadie ha autorizado todavía, y que desaparecerían en cuanto el
   * servidor respondiera. Un estado neutral dice exactamente lo que ocurre.
   */
  if (!sesionResuelta) {
    return (
      <HospitalMarcoNeutral etiquetaPlataforma={etiquetaPlataforma}>
        <p className={styles.ingresoTexto} role="status">
          Comprobando acceso institucional…
        </p>
      </HospitalMarcoNeutral>
    );
  }

  /*
   * Sin sesión vigente el marco es el mismo: la envolvente de Hospital con el
   * acceso integrado en el área principal. Sigue sin haber topbar funcional,
   * módulo ni dato demostrativo.
   */
  if (sesion === null) {
    return (
      <HospitalMarcoNeutral etiquetaPlataforma={etiquetaPlataforma}>
        <HospitalAccesoInstitucional
          aviso={aviso}
          ocupado={ocupado}
          onEntrar={(identityCode, accessSecret) => {
            void entrar(identityCode, accessSecret);
          }}
        />
      </HospitalMarcoNeutral>
    );
  }

  return (
    <div className={styles.shell}>
      <HospitalSidebar
        institucion={institucion}
        etiquetaPlataforma={etiquetaPlataforma}
        navegacion={config.navegacion}
        itemActivoId={HOSPITAL_ITEM_ACTIVO_POR_VISTA[vista]}
        idsNavegables={HOSPITAL_ITEMS_NAVEGABLES}
        onSeleccionar={(id) => {
          /* El sidebar navega siempre sin intención, así que la limpia. */
          navegar(destinoDeItem(id) ?? id);
        }}
      />
      <div className={styles.main}>
        <HospitalTopbar
          usuario={config.usuario}
          textoBuscador={config.textoBuscador}
          sesion={sesion}
          ocupado={ocupado}
          onCambiarSesion={() => {
            void terminar('cambiar');
          }}
          onCerrarSesion={() => {
            void terminar('cerrar');
          }}
        />
        <main className={styles.content} data-hospital-content={MARCADOR_CONTENIDO[vista]}>
          {aviso === null ? null : (
            /*
             * Avisos de la propia sesión —por ejemplo, una revocación que el
             * servidor no confirmó—. Solo existe cuando hay algo que decir.
             */
            <p className={styles.ingresoAviso} role="alert">
              {aviso}
            </p>
          )}
          {intencion === null ? null : (
            <p className={styles.intencion}>
              {`Mostrando intención: ${HOSPITAL_ETIQUETA_INTENCION[intencion]}. La vista no aplica ningún filtro.`}
            </p>
          )}
          <HospitalContenido
            vista={vista}
            pestanaAdministracion={pestanaAdministracion}
            seccionFinanciera={seccionFinancieraInicial}
            filaFinanciera={filaFinancieraInicial}
            visita={visita}
            onNavegar={navegar}
            onSeleccionarPestana={setPestanaAdministracion}
            onVisitaMaterializada={(materializada) => {
              /*
               * La visita recién materializada pasa a ser la visita abierta y
               * la navegación va a la vista ya aprobada de Visitas, que es
               * donde su estado real se muestra y se opera.
               */
              setVisita(materializada);
              navegar({ vista: 'visitas' });
            }}
          />
        </main>
      </div>
    </div>
  );
}
