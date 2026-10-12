'use client';
import { InstitutionalAccess } from '@/features/auth/InstitutionalAccess';
import { consultarAdministradorMunicipal, cerrarSesionAdministrador } from '@/features/auth/institutionalAdministratorClient';

import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';

import {
  abrirSesionInstitucional,
  cerrarSesionInstitucional,
  consultarSesionInstitucional,
  resolverCierre,
  resolverReconfirmacion,
  validarAcceso,
  MENSAJE_APERTURA,
  MENSAJE_CREDENCIAL,
  type SesionInstitucionalDto,
} from '@/features/auth/institutionalSessionClient';

import { MunicipalityAdres } from './MunicipalityAdres';
import { MunicipalityBudget } from './MunicipalityBudget';
import { MunicipalityCare } from './MunicipalityCare';
import { MunicipalityCaregivers } from './MunicipalityCaregivers';
import { MunicipalityComingSoon } from './MunicipalityComingSoon';
import { MunicipalityEvidence } from './MunicipalityEvidence';
import { MunicipalityFurag } from './MunicipalityFurag';
import { MunicipalityGaps } from './MunicipalityGaps';
import { MunicipalityHome } from './MunicipalityHome';
import { MunicipalityIndicators } from './MunicipalityIndicators';
import { MunicipalityPopulation } from './MunicipalityPopulation';
import { MunicipalityPrograms } from './MunicipalityPrograms';
import { MunicipalityReports } from './MunicipalityReports';
import { MunicipalitySidebar } from './MunicipalitySidebar';
import { MunicipalityTerritory } from './MunicipalityTerritory';
import { MunicipalityTopbar } from './MunicipalityTopbar';
import styles from './municipality.module.css';
import { municipalityDemo } from './municipalityConfig';
import type { MunicipalityConfig } from './municipalityConfig';
import {
  MUNICIPALITY_MENSAJE_CIERRE,
  MUNICIPALITY_MENSAJE_CIERRE_NO_CONFIRMADO,
  MUNICIPALITY_MENSAJE_ROL,
  MUNICIPALITY_MENSAJE_SIN_CONFIRMAR,
  MunicipalitySuperficieDenegada,
  contextoAutorizado,
  esRolMunicipal,
  identidadDeSesion,
  resolverEstadoMunicipal,
  type EstadoSesionMunicipal,
} from './municipalitySession';
import {
  MUNICIPALITY_PERIODO_INICIAL,
  MUNICIPALITY_VISTA_INICIAL,
  siguientePeriodo,
  siguienteVista,
  tieneContenidoPropio,
} from './municipalityViews';
import type { MunicipalityModuloId, MunicipalityPeriodoId } from './municipalityViews';

/**
 * Shell de la experiencia Alcaldía (TASK-ALCALDIA-A-01, FR-01, FR-02, FR-03).
 *
 * Composición persistente aprobada: sidebar, topbar y un único área de
 * contenido, según las líneas 20–169 de la referencia
 * `prototype-claude/Eligeme-Alcaldia.dc.html`. El área de contenido monta una
 * sola vista a la vez. Al abrir `/municipality` es `Inicio` con `Este mes`
 * seleccionado; el resto de los módulos monta el estado neutro «Próximamente».
 *
 * La navegación y el periodo son estado local del cliente: no crean rutas, no
 * cambian la URL, no viajan por query string, no persisten en almacenamiento,
 * cookie o sesión, no consultan red y no se comparten entre recargas. Este
 * estado representa un contexto de consulta demostrativo; no implementa ni
 * suplanta tenant, institución, afiliación ni autorización, que serán
 * server-side, contextuales y de denegación por defecto.
 *
 * Alcaldía vive dentro de la aplicación existente y no crea otra app, layout
 * raíz ni sistema visual: no comparte estado, copy ni configuración con
 * ninguna otra experiencia.
 *
 * `data-municipality-content` es solo un marcador técnico de auditoría: no es
 * visible ni se anuncia a tecnologías de asistencia.
 *
 * TASK-ALCALDIA-A-02, FR-01: `Población beneficiaria` y `Territorio` pasan a
 * montar contenido propio dentro de este mismo shell. El shell decide qué vista
 * monta y no acumula el marcado interno de ninguna de ellas.
 *
 * TASK-ALCALDIA-A-03, FR-01: `Programas` se suma a las vistas con contenido
 * propio. El shell solo la monta: el estado del alta local demostrativa vive
 * dentro de esa vista y no asciende aquí, no viaja por la URL y no persiste.
 *
 * TASK-ALCALDIA-DEMO-FINAL, §5.1 y §6.3: los siete módulos restantes —FURAG y
 * MIPG, ADRES, Derecho al cuidado, Brechas, Cuidadores y formación,
 * Indicadores y resultados y Reportes ejecutivos— pasan a montar contenido
 * propio. El shell solo los importa y los monta: no recibe su JSX, no conoce
 * sus datos, no acumula su marcado y sigue siendo composición. Con esto los
 * trece módulos del menú tienen contenido propio y ninguno queda en
 * «Próximamente»; `MunicipalityComingSoon` se conserva porque el rollback
 * conceptual de la tarea consiste en devolver esos módulos a ese estado.
 *
 * TASK-ALCALDIA-A-04, FR-01: `Presupuesto y ejecución` y `Evidencias` pasan a
 * montar contenido propio. El shell solo las monta: el estado del detalle local
 * «Ver evidencia» vive dentro de la vista de Evidencias, no asciende aquí, no
 * viaja por la URL y no persiste. El shell no incorpora dinero, movimientos,
 * evidencias ni configuración financiera: sigue siendo composición.
 */
/**
 * Vista de un módulo con contenido propio, según
 * `MUNICIPALITY_MODULOS_IMPLEMENTADOS`. Cada pantalla vive en su propio
 * componente y recibe la configuración por propiedades.
 */
function VistaPropia({
  vista,
  config,
  onNavegar,
  tituloRef,
}: {
  readonly vista: MunicipalityModuloId;
  readonly config: MunicipalityConfig;
  readonly onNavegar: (destino: string) => void;
  readonly tituloRef: Ref<HTMLHeadingElement>;
}): ReactNode {
  switch (vista) {
    case 'poblacion':
      return <MunicipalityPopulation config={config} tituloRef={tituloRef} />;
    case 'territorio':
      return <MunicipalityTerritory config={config} tituloRef={tituloRef} />;
    case 'programas':
      return <MunicipalityPrograms config={config} tituloRef={tituloRef} />;
    case 'presupuesto':
      return <MunicipalityBudget config={config} tituloRef={tituloRef} />;
    case 'evidencias':
      return <MunicipalityEvidence config={config} tituloRef={tituloRef} />;
    case 'furag':
      return <MunicipalityFurag config={config} tituloRef={tituloRef} />;
    case 'adres':
      return <MunicipalityAdres config={config} tituloRef={tituloRef} />;
    case 'cuidado':
      return <MunicipalityCare config={config} tituloRef={tituloRef} />;
    case 'brechas':
      return <MunicipalityGaps config={config} tituloRef={tituloRef} />;
    case 'cuidadores':
      return <MunicipalityCaregivers config={config} tituloRef={tituloRef} />;
    case 'indicadores':
      return <MunicipalityIndicators config={config} tituloRef={tituloRef} />;
    case 'reportes':
      return <MunicipalityReports config={config} tituloRef={tituloRef} />;
    default:
      return <MunicipalityHome config={config} onNavegar={onNavegar} tituloRef={tituloRef} />;
  }
}

/**
 * Barra de sesión institucional de Alcaldía (spec 022, FR-05).
 *
 * Vive en el shell y no en la topbar a propósito: la topbar es composición
 * demostrativa aprobada en TASK-ALCALDIA-A-01 y esta spec no la modifica.
 *
 * Muestra EXACTAMENTE lo que el servidor dijo de la sesión —entidad, etiqueta
 * impersonal del rol y caducidad— y el cierre real. No muestra tenant, ni
 * identificador, ni persona.
 */
function MunicipalitySesionBarra({
  sesion,
  ocupado,
  aviso,
  onCerrarSesion,
}: {
  readonly sesion: SesionInstitucionalDto;
  readonly ocupado: boolean;
  readonly aviso: string | null;
  readonly onCerrarSesion: () => void;
}): ReactNode {
  const identidad = identidadDeSesion(sesion);

  return (
    <div className={styles.sesionBarra}>
      <p className={styles.sesionBarraTexto}>
        <span className={styles.sesionBarraEntidad}>{identidad.entidad}</span>
        <span className={styles.sesionBarraRol}>{identidad.rol}</span>
        {identidad.caducidad === null ? null : (
          <span className={styles.sesionBarraVigencia}>{identidad.caducidad}</span>
        )}
      </p>
      <button
        className={styles.sesionBarraBoton}
        disabled={ocupado}
        onClick={onCerrarSesion}
        type="button"
      >
        {ocupado ? 'Cerrando…' : 'Cerrar sesión institucional'}
      </button>
      {/*
       * Región viva PERMANENTE: un cierre NO confirmado debe anunciarse, y un
       * nodo que aparece de golpe no siempre se anuncia.
       */}
      <p className={styles.sesionBarraAviso} role="alert">
        {aviso ?? ''}
      </p>
    </div>
  );
}

/**
 * Composición municipal AUTORIZADA (TASK-ALCALDIA-A-01 y siguientes).
 *
 * Es el shell que ya existía, sin un solo cambio en su composición: sidebar,
 * topbar, un único `<main>` y una vista a la vez. Lo único nuevo es que ya no
 * es la superficie de entrada: solo se monta cuando el servidor confirmó una
 * sesión institucional con el rol municipal EXACTO.
 *
 * Se exporta para que las pruebas puedan renderizar la superficie autorizada
 * con `renderToStaticMarkup`, que no ejecuta efectos. NO es un atajo de acceso:
 * montarlo no consulta la sesión, y `/municipality` monta `MunicipalityShell`,
 * que es la puerta. La prueba de privacidad comprueba que la ruta no monte esta
 * composición directamente.
 */
export function MunicipalityShellAutorizado({
  config = municipalityDemo,
  vistaInicial = MUNICIPALITY_VISTA_INICIAL,
  periodoInicial = MUNICIPALITY_PERIODO_INICIAL,
  sesion = null,
  cerrando = false,
  avisoSesion = null,
  onCerrarSesion,
}: {
  readonly config?: MunicipalityConfig;
  /** Vista mostrada al montar. No persiste entre recargas. */
  readonly vistaInicial?: MunicipalityModuloId;
  /** Periodo seleccionado al montar. Como la vista, es estado de montaje. */
  readonly periodoInicial?: MunicipalityPeriodoId;
  /** Contexto confirmado por el servidor. `null` solo en pruebas de composición. */
  readonly sesion?: SesionInstitucionalDto | null;
  readonly cerrando?: boolean;
  readonly avisoSesion?: string | null;
  readonly onCerrarSesion?: () => void;
}): ReactNode {
  const [vista, setVista] = useState<MunicipalityModuloId>(vistaInicial);
  const [periodo, setPeriodo] = useState<MunicipalityPeriodoId>(periodoInicial);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const montado = useRef(false);

  /*
   * Al cambiar de vista el foco pasa al encabezado principal del contenido: sin
   * ello, quien navega con teclado o lector de pantalla se quedaría en el menú
   * sin que nada anuncie el módulo montado. En el primer montaje no se mueve el
   * foco, para no robárselo a quien acaba de abrir la página.
   */
  useEffect(() => {
    if (!montado.current) {
      montado.current = true;

      return;
    }

    tituloRef.current?.focus();
  }, [vista]);

  /** Único punto de transición: sidebar y accesos rápidos pasan por aquí. */
  const navegar = (solicitada: string): void => {
    setVista((actual) => siguienteVista(actual, solicitada));
  };

  const seleccionarPeriodo = (solicitado: string): void => {
    setPeriodo((actual) => siguientePeriodo(actual, solicitado));
  };

  const itemActivo = config.navegacion.find((item) => item.id === vista);

  return (
    <div className={styles.shell}>
      <MunicipalitySidebar
        identidad={config.identidad}
        navegacion={config.navegacion}
        itemActivoId={vista}
        onSeleccionar={navegar}
      />
      <div className={styles.main}>
        {sesion === null || onCerrarSesion === undefined ? null : (
          <MunicipalitySesionBarra
            aviso={avisoSesion}
            ocupado={cerrando}
            onCerrarSesion={onCerrarSesion}
            sesion={sesion}
          />
        )}
        <MunicipalityTopbar
          encabezado={config.encabezado}
          avisoPrivacidad={config.avisoPrivacidad}
          periodos={config.periodos}
          periodoActivoId={periodo}
          perfil={config.perfil}
          demo={config.demo}
          onSeleccionarPeriodo={seleccionarPeriodo}
        />
        <main className={styles.content} data-municipality-content={vista}>
          {tieneContenidoPropio(vista) ? (
            <VistaPropia
              vista={vista}
              config={config}
              onNavegar={navegar}
              tituloRef={tituloRef}
            />
          ) : (
            <MunicipalityComingSoon
              moduloId={vista}
              etiqueta={itemActivo?.etiqueta ?? ''}
              tituloRef={tituloRef}
            />
          )}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Puerta: la superficie que `/municipality` monta                             */
/* -------------------------------------------------------------------------- */

/**
 * Superficie municipal de Alcaldía (spec 022, FR-04 y FR-05).
 *
 * Es la PUERTA, y es lo único que la ruta monta. Reutiliza ÍNTEGRAMENTE la
 * sesión institucional existente a través del cliente COMPARTIDO
 * `@/features/auth/institutionalSessionClient`: la misma cookie `HttpOnly`, los
 * mismos endpoints y el mismo backend que Hospital. No hay transporte propio,
 * no hay segundo mecanismo de acceso, no hay identidad en el navegador y no hay
 * repliegue a datos ficticios.
 *
 * LA REGLA, en una frase: la composición operativa —y con ella `Población` y
 * `Territorio`, que consultan agregados AL MONTARSE— no se monta hasta que el
 * servidor confirmó un contexto cuyo rol es EXACTAMENTE `MUNICIPAL_VIEWER`.
 * Por eso no puede existir una consulta agregada antes de la autorización: no
 * es que se oculte el resultado, es que el componente que la dispara no llega a
 * montarse. Los cinco estados denegados montan superficie neutra.
 *
 * Esto es una puerta de INTERFAZ, no un control de seguridad. Cada consulta
 * agregada vuelve a exigir en el servidor autorización, aislamiento por tenant,
 * RLS y supresión, y esa respuesta es la única que habilita un dato. Lo que
 * esta puerta añade es no pedir nada, y no montar nada, antes de tener derecho
 * a hacerlo.
 *
 * `sesionInicial` y `fetchImpl` existen para poder probar: `renderToStaticMarkup`
 * no ejecuta efectos y el repositorio no incluye jsdom. Inyectar el contexto no
 * concede acceso a nadie —el servidor sigue decidiendo cada consulta— y la ruta
 * no los pasa.
 */
export function MunicipalityShell({
  config = municipalityDemo,
  vistaInicial = MUNICIPALITY_VISTA_INICIAL,
  periodoInicial = MUNICIPALITY_PERIODO_INICIAL,
  sesionInicial = null,
  administracionHumana = false,
  fetchImpl,
}: {
  readonly config?: MunicipalityConfig;
  readonly vistaInicial?: MunicipalityModuloId;
  readonly periodoInicial?: MunicipalityPeriodoId;
  /**
   * Contexto ya resuelto, solo para pruebas.
   *
   * `null` es el comportamiento real: la sesión aún no se ha comprobado y el
   * efecto la consulta. Un `EstadoSesionMunicipal` fija un estado denegado
   * concreto, y un contexto fija la superficie autorizada.
   */
  readonly sesionInicial?: SesionInstitucionalDto | EstadoSesionMunicipal | null;
  readonly administracionHumana?: boolean;
  readonly fetchImpl?: typeof fetch;
}): ReactNode {
  const consultarContexto = administracionHumana ? consultarAdministradorMunicipal : consultarSesionInstitucional;
  const cerrarContexto = administracionHumana ? cerrarSesionAdministrador : cerrarSesionInstitucional;
  const resuelto = sesionInicial !== null && typeof sesionInicial !== 'string';
  const contextoInicial = resuelto ? sesionInicial : null;

  const [sesion, setSesion] = useState<SesionInstitucionalDto | null>(contextoInicial);
  const [estado, setEstado] = useState<EstadoSesionMunicipal>(() => {
    if (contextoInicial !== null) {
      /*
       * FALLA CERRADO también aquí: un contexto inyectado con otro rol NO abre
       * la superficie. La regla de rol es una sola y no se puede sortear por la
       * puerta de las pruebas.
       */
      return esRolMunicipal(contextoInicial.role) ? 'autorizada' : 'rol-no-autorizado';
    }

    return typeof sesionInicial === 'string' ? sesionInicial : 'comprobando';
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  /** Recuerda si esta pantalla llegó a estar autorizada, para distinguir la expiración. */
  const habiaSesion = useRef(estado === 'autorizada');
  /** Fuerza una comprobación nueva al reintentar, sin recargar la página. */
  const [intento, setIntento] = useState(0);

  /*
   * Recuperación de la sesión al entrar. No abre nada por su cuenta: solo
   * pregunta por el contexto vigente y traduce el desenlace con la función pura
   * de `municipalitySession`. La consulta se cancela al desmontar para que una
   * respuesta tardía no escriba sobre una pantalla que ya no está.
   */
  useEffect(() => {
    if (sesionInicial !== null) {
      return undefined;
    }

    const controller = new AbortController();
    let vigente = true;

    void consultarContexto(fetchImpl ?? fetch, controller.signal).then(
      (resultado) => {
        if (!vigente || resultado.kind === 'cancelado') {
          return;
        }

        const siguiente = resolverEstadoMunicipal(resultado, habiaSesion.current);

        habiaSesion.current = habiaSesion.current || siguiente === 'autorizada';
        setSesion(contextoAutorizado(resultado));
        setEstado(siguiente);
      },
    );

    return (): void => {
      vigente = false;
      controller.abort();
    };
  }, [fetchImpl, sesionInicial, intento, consultarContexto]);

  /** Reintento REAL: vuelve a preguntar al servidor, no cambia solo la pantalla. */
  const reintentar = useCallback((): void => {
    setAviso(null);
    setEstado('comprobando');
    setIntento((actual) => actual + 1);
  }, []);

  /**
   * Entrada institucional.
   *
   * La identidad mostrada se toma SIEMPRE del contexto que devuelve `current`,
   * nunca del cuerpo de la apertura: así existe una sola procedencia de lo que
   * se ve. Y la regla de rol se aplica DESPUÉS de abrir: abrir una sesión que
   * no es municipal no abre esta superficie, y el aviso es el mismo que el del
   * estado denegado por rol, para no permitir enumerar credenciales.
   */
  const entrar = useCallback(
    async (identityCode: string, accessSecret: string): Promise<void> => {
      const motivo = validarAcceso(identityCode, accessSecret);

      if (motivo !== null) {
        setAviso(MENSAJE_CREDENCIAL[motivo]);

        return;
      }

      const red = fetchImpl ?? fetch;

      setOcupado(true);
      setAviso(null);

      const apertura = await abrirSesionInstitucional(identityCode, accessSecret, red);

      if (apertura.kind === 'cancelado') {
        setOcupado(false);

        return;
      }

      if (apertura.kind !== 'ok') {
        setOcupado(false);
        setAviso(MENSAJE_APERTURA[apertura.kind]);

        return;
      }

      const contexto = await consultarContexto(red);

      setOcupado(false);

      if (contexto.kind !== 'ok') {
        setSesion(null);
        setEstado('sin-sesion');
        setAviso(MUNICIPALITY_MENSAJE_SIN_CONFIRMAR);

        return;
      }

      if (!esRolMunicipal(contexto.datos.role)) {
        /*
         * La sesión SÍ se abrió en el servidor: decir lo contrario sería falso.
         * Lo que no se abre es esta superficie, y desde el estado denegado por
         * rol se puede volver a comprobar o cerrar y entrar con otra credencial.
         */
        setSesion(null);
        setEstado('rol-no-autorizado');
        setAviso(MUNICIPALITY_MENSAJE_ROL);

        return;
      }

      habiaSesion.current = true;
      setSesion(contexto.datos);
      setEstado('autorizada');
      setAviso(null);
    },
    [fetchImpl],
  );

  /**
   * Cierre REAL de la sesión institucional.
   *
   * Usa el endpoint de cierre existente a través del cliente compartido, y la
   * decisión de qué hacer con la respuesta es la función PURA `resolverCierre`,
   * que Hospital ya usaba: SOLO `204` y `401` confirman que en el servidor ya
   * no hay sesión.
   *
   * Si el cierre no se confirma, la sesión NO se retira de la pantalla y se
   * dice por qué: esconder una sesión que el servidor conserva haría creer que
   * se cerró. Ante un cierre sin confirmar se RECONSULTA el contexto, y solo un
   * `sin-sesion` del servidor autoriza a retirarla.
   */
  const cerrarSesion = useCallback(async (): Promise<void> => {
    const red = fetchImpl ?? fetch;

    setOcupado(true);
    setAviso(null);

    const cierre = await cerrarContexto(red);
    const decision = resolverCierre(cierre.kind, 'cerrar');

    if (decision.retirarSesion) {
      habiaSesion.current = false;
      setOcupado(false);
      setSesion(null);
      setEstado('sin-sesion');
      setAviso(decision.aviso ?? MUNICIPALITY_MENSAJE_CIERRE);

      return;
    }

    const contexto = await consultarContexto(red);
    const tras = resolverReconfirmacion(contexto.kind, 'cerrar');

    setOcupado(false);

    if (tras.retirarSesion) {
      habiaSesion.current = false;
      setSesion(null);
      setEstado('sin-sesion');
      setAviso(tras.aviso ?? MUNICIPALITY_MENSAJE_CIERRE);

      return;
    }

    // La sesión sigue EN PIE: la superficie autorizada se conserva, y se dice.
    setAviso(MUNICIPALITY_MENSAJE_CIERRE_NO_CONFIRMADO);
  }, [fetchImpl, cerrarContexto]);

  if (estado !== 'autorizada' || sesion === null) {
    /*
     * `estado === 'autorizada'` con `sesion === null` no debería ocurrir: se
     * trata como error en vez de como acceso, porque ante un estado que no se
     * sabe explicar lo correcto es no abrir.
     */
    return (
      administracionHumana && estado === 'sin-sesion' ? <main><InstitutionalAccess experience="municipality" /></main> : <MunicipalitySuperficieDenegada
        aviso={aviso}
        estado={estado === 'autorizada' ? 'error' : estado}
        ocupado={ocupado}
        onEntrar={(identityCode, accessSecret) => {
          void entrar(identityCode, accessSecret);
        }}
        onReintentar={reintentar}
      />
    );
  }

  return (
    <MunicipalityShellAutorizado
      avisoSesion={aviso}
      cerrando={ocupado}
      config={config}
      onCerrarSesion={() => {
        void cerrarSesion();
      }}
      periodoInicial={periodoInicial}
      sesion={sesion}
      vistaInicial={vistaInicial}
    />
  );
}
