'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import { branding } from '@/config/branding';
import { MunicipalityPopulation } from './MunicipalityPopulation';
import { MunicipalitySidebar } from './MunicipalitySidebar';
import { MunicipalityProfileBadge } from './MunicipalityTopbar';
import { MunicipalityTerritory } from './MunicipalityTerritory';
import { MunicipalityModuleLayout } from './MunicipalityModuleLayout';
import { MUNICIPALITY_NAV_ITEMS } from './municipalityConfig';
import { ETIQUETAS_POBLACION, TEXTOS_AGREGADOS, textoDeCorte, type EstadoAgregado, type PopulationSummary } from './municipalityAggregates';
import { fetchPopulationSummary } from './municipalityAggregatesClient';
import { useMunicipalityAggregate } from './useMunicipalityAggregate';
import { siguienteVista, type MunicipalityModuloId } from './municipalityViews';
import layout from './municipality.module.css';
import styles from './municipalityOperational.module.css';

const consultarPoblacion = (signal: AbortSignal) => fetchPopulationSummary(fetch, signal);

const ACCESOS = [
  ['Consultar población', 'poblacion'], ['Consultar territorio', 'territorio'],
  ['Ver programas', 'programas'], ['Ver presupuesto', 'presupuesto'],
  ['Ver evidencias', 'evidencias'], ['Ver FURAG', 'furag'],
  ['Ver ADRES', 'adres'], ['Ver reportes', 'reportes'],
] as const;

export function MunicipalityOperationalHomeView({ estado, tituloRef, onNavegar, onReintentar }: {
  readonly estado: EstadoAgregado<PopulationSummary>;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
  readonly onNavegar: (vista: MunicipalityModuloId) => void;
  readonly onReintentar: () => void;
}) {
  return <div className={layout.home}>
    <section className={layout.hero} aria-labelledby="municipality-live-title">
    <h1 className={layout.heroTitle} id="municipality-live-title" ref={tituloRef} tabIndex={-1}>ASÍ ESTAMOS CUIDANDO NUESTRA POBLACIÓN</h1>
    {estado.estado === 'listo' ? <>
      {estado.datos.uniqueRegistered.status === 'EXACT' && estado.datos.uniqueRegistered.value === 0 ? <p className={styles.heroNote} role="status">{TEXTOS_AGREGADOS.vacio}</p> : null}
      <div className={styles.stats}>
      <dl className={styles.counts}>
        {([
          ['uniqueRegistered', estado.datos.uniqueRegistered],
          ['olderAdult60Plus', estado.datos.populations.olderAdult60Plus],
          ['disabilityDeclared', estado.datos.populations.disabilityDeclared],
          ['homeCareRequiredDeclared', estado.datos.populations.homeCareRequiredDeclared],
        ] as const).map(([key, count]) => <div className={styles.stat} key={key}><dt>{ETIQUETAS_POBLACION[key]}</dt><dd>{count.display}</dd></div>)}
      </dl>
      <div className={styles.stat}><strong className={styles.unavailable}>Sin dato oficial</strong><p className={styles.statLabel}>Cobertura de la población objetivo</p><p>Fuente oficial pendiente</p></div>
      </div>
      <p className={styles.heroNote}>Según los registros de la plataforma · <time dateTime={estado.datos.asOfDate}>{textoDeCorte(estado.datos.asOfDate)}</time> · {TEXTOS_AGREGADOS.supresion}</p>
    </> : <div className={styles.heroState} role={estado.estado === 'cargando' ? 'status' : 'alert'}>
      <p>{estado.estado === 'cargando' ? TEXTOS_AGREGADOS.cargando : estado.estado === 'no-autorizado' ? TEXTOS_AGREGADOS.noAutorizado : TEXTOS_AGREGADOS.error}</p>
      {estado.estado === 'error' ? <button className={styles.secondary} onClick={onReintentar} type="button">Reintentar consulta</button> : null}
    </div>}
    </section>
    <section className={layout.card} aria-labelledby="municipality-chain-title">
      <h2 className={layout.cardTitle} id="municipality-chain-title">De la persona a la evidencia</h2>
      <ol className={`${layout.chain} ${styles.chain}`}>
        <li className={`${layout.chainItem} ${layout.tonoAzul}`}><span className={layout.chainStage}>PERSONAS</span><strong className={layout.chainValue}>{estado.estado === 'listo' ? estado.datos.uniqueRegistered.display : 'Sin consulta'}</strong><span className={layout.chainNote}>Beneficiarios únicos registrados</span></li>
        {([
          ['ATENCIÓN', 'Resumen de visitas y consultas', layout.tonoTeal],
          ['DINERO', 'Ejecución presupuestal', layout.tonoTeal],
          ['EVIDENCIA', 'Soportes institucionales', layout.tonoVerde],
          ['RESULTADO', 'Indicadores de gestión', layout.tonoVerde],
          ['PENDIENTES', 'Seguimiento administrativo', layout.tonoAmarillo],
        ] as const).map(([etapa, detalle, tono]) => <li className={`${layout.chainItem} ${tono}`} key={etapa}><span className={layout.chainStage}>{etapa}</span><strong className={layout.chainValue}>Pendiente</strong><span className={layout.chainNote}>{detalle} aún no disponible</span></li>)}
      </ol>
      <p className={layout.chainCaption}>Los totales deduplican por persona. Una persona puede pertenecer a varias poblaciones y sigue siendo un beneficiario único.</p>
    </section>
    <div className={layout.homeColumns}>
      <section className={`${layout.card} ${layout.pendingCard}`} aria-labelledby="municipality-pending-home-title">
        <h2 className={layout.cardTitle} id="municipality-pending-home-title">Alertas y pendientes de gestión</h2>
        <div className={styles.empty}><strong>Consulta aún no disponible</strong><p>El seguimiento de pendientes administrativos todavía no está habilitado en este panel.</p></div>
        <p className={layout.pendingCaption}>Esta sección corresponde a gestión administrativa. Las alertas clínicas individuales se gestionan en el hospital.</p>
      </section>
      <div className={layout.homeAside}>
        <section className={layout.card} aria-labelledby="municipality-shortcuts-title">
          <h2 className={layout.cardTitle} id="municipality-shortcuts-title">Accesos rápidos</h2>
          <div className={layout.shortcuts}>{ACCESOS.map(([label, destino]) => <button className={layout.shortcut} type="button" key={destino} onClick={() => onNavegar(destino)}>{label}</button>)}</div>
        </section>
        <section className={layout.card} aria-labelledby="municipality-activity-title">
          <h2 className={layout.cardTitle} id="municipality-activity-title">Actividades recientes</h2>
          <div className={styles.empty}><strong>Actividad aún no disponible</strong><p>El historial de actividad institucional todavía no está habilitado en este panel.</p></div>
        </section>
      </div>
    </div>
    <p className={styles.sourceNote}>{TEXTOS_AGREGADOS.sinFuenteOficial}</p>
  </div>;
}

function MunicipalityOperationalHome(props: Omit<Parameters<typeof MunicipalityOperationalHomeView>[0], 'estado'>) {
  const estado = useMunicipalityAggregate(consultarPoblacion);
  return <MunicipalityOperationalHomeView {...props} estado={estado} />;
}

export function MunicipalityOperationalPanel({ vistaInicial = 'inicio', institutionName = 'Alcaldía', cerrando, avisoSesion, onCerrarSesion }: {
  readonly vistaInicial?: MunicipalityModuloId;
  readonly institutionName?: string;
  readonly cerrando: boolean;
  readonly avisoSesion: string | null;
  readonly onCerrarSesion: () => void;
}) {
  const [vista, setVista] = useState<MunicipalityModuloId>(vistaInicial);
  const [intento, setIntento] = useState(0);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuBoton = useRef<HTMLButtonElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const montado = useRef(false);
  useEffect(() => { if (montado.current) tituloRef.current?.focus(); else montado.current = true; }, [vista]);
  useEffect(() => {
    if (!menuAbierto) return;
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMenuAbierto(false); menuBoton.current?.focus(); }
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => document.removeEventListener('keydown', cerrarConEscape);
  }, [menuAbierto]);
  const navegar = (solicitada: MunicipalityModuloId) => {
    setMenuAbierto(false);
    if (solicitada === vista) tituloRef.current?.focus();
    setVista(actual => siguienteVista(actual, solicitada));
  };
  const nombreInstitucion = /\bmerdn\b/iu.test(institutionName) ? 'Alcaldía' : institutionName;
  return <div className={`${layout.shell} ${styles.frame}`}>
    <a className={styles.skip} href="#municipality-main">Saltar al contenido</a>
    <div className={styles.mobileBar}><strong>{branding.platformDisplayName} · Alcaldía</strong><button ref={menuBoton} className={styles.secondary} type="button" aria-expanded={menuAbierto} aria-controls="municipality-navigation" onClick={() => setMenuAbierto(actual => !actual)}>{menuAbierto ? 'Cerrar menú' : 'Abrir menú'}</button></div>
    <div className={styles.navigation} id="municipality-navigation" data-open={menuAbierto}>
      <MunicipalitySidebar identidad={{ plataforma: branding.platformDisplayName, entidad: nombreInstitucion, bajada: 'Gestión territorial y evidencia' }} navegacion={MUNICIPALITY_NAV_ITEMS} itemActivoId={vista} onSeleccionar={navegar} />
    </div>
    <div className={layout.main}>
      <header className={`${layout.topbar} ${styles.header}`} aria-label="Encabezado del panel municipal">
        <div className={layout.topbarHeadings}><p className={layout.topbarEyebrow}>PANEL DE GESTIÓN TERRITORIAL, RESULTADOS Y EVIDENCIA</p><p className={layout.topbarPrivacy}>Datos agregados y anonimizados · sin acceso a historias clínicas individuales</p></div>
        <span className={styles.periodStatus}>Consulta actual</span>
        <div className={styles.sessionControls}>
          <MunicipalityProfileBadge perfil={{ iniciales: 'AM', nombre: 'Administrador municipal', perfil: 'Perfil de consulta agregada' }} />
          <button className={styles.logout} disabled={cerrando} type="button" aria-label="Cerrar sesión institucional" onClick={onCerrarSesion}>{cerrando ? 'Cerrando…' : 'Cerrar sesión'}</button>
        </div>
        <p role="alert" className={styles.sessionNotice}>{avisoSesion ?? ''}</p>
      </header>
      <main className={layout.content} id="municipality-main" tabIndex={-1} data-municipality-content={vista}>
        {vista === 'inicio' ? <MunicipalityOperationalHome key={intento} tituloRef={tituloRef} onNavegar={navegar} onReintentar={() => setIntento(value => value + 1)} />
          : vista === 'poblacion' ? <MunicipalityPopulation tituloRef={tituloRef} />
          : vista === 'territorio' ? <MunicipalityTerritory tituloRef={tituloRef} />
          : <MunicipalityModuleLayout vista={vista} tituloRef={tituloRef} onVolver={() => navegar('inicio')} />}
      </main>
    </div>
  </div>;
}
