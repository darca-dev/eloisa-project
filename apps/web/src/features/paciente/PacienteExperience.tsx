'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { CareWorkspace } from '@/features/care/CareWorkspace';
import { Button } from '@/components/ui/Button';
import { DeviceStatusBar, PhoneFrame, Screen } from '@/components/ui/PhoneShell';
import {
  CONTEXTOS_HUMANOS,
  cerrarSesionHumana,
  cierreHumanoConfirmado,
  consultarSesionHumana,
} from '@/features/auth/humanSessionClient';
import type { CierreSesionHumana, EstadoSesionHumana } from '@/features/auth/humanSessionClient';

import {
  ETIQUETA_PACIENTE,
  consultarCitasPaciente,
  consultarResumenPaciente,
  consultarVisitasPaciente,
} from './pacienteSelfClient';
import type {
  CitaPacienteView,
  FalloPacienteSelf,
  ResultadoPacienteSelf,
  ResumenPacienteView,
  VisitaPacienteView,
} from './pacienteSelfClient';
import styles from './paciente.module.css';

/**
 * PORTAL OPERATIVO DEL PACIENTE (spec 021 §6.1 a §6.17, micro-paquete 5).
 *
 * Esta pantalla es la experiencia AUTENTICADA. Solo se monta cuando el
 * SERVIDOR confirma sesión humana OIDC vigente con contexto `PATIENT`: la
 * cookie de autoinscripción NO la abre y NO la puede abrir (§17.C-1, §19.13).
 * Quien decide la conmutación de fase es `ExperienciaMerdn`, y esta pantalla
 * vuelve a comprobar la sesión por su cuenta al montarse: fallar CERRADO dos
 * veces es más barato que confiar una.
 *
 * QUÉ MUESTRA, y nada más:
 *
 * - el resumen propio, limitado EXACTAMENTE a nombre de pila, iniciales y la
 *   etiqueta fija `Paciente` (§6.7, §17.C-2). Un cuarto campo es STOP (§19.12);
 * - las citas propias y las visitas propias que devuelven las tres rutas
 *   self-scope, sin identificador técnico y sin dato de terceros (§6.8, §6.9).
 *
 * QUÉ NO MONTA. Ayuda urgente, bitácora clínica, pagos, mensajes, cuidador,
 * consulta virtual e historia clínica NO aparecen (§6.15). No se «marcan» como
 * inertes: dejan de montarse. Su código sigue INTACTO en el repositorio
 * —`InicioPaciente.tsx`, `BitacoraPaciente.tsx`, `bitacoraFlow.ts`— porque
 * borrarlo es STOP (§6.16, §19.11). Un control visible pero inerte seguiría
 * prometiendo una capacidad que no existe.
 *
 * NO GUARDA NADA. No hay `localStorage`, `sessionStorage`, IndexedDB ni
 * identificador en la URL: el estado vive en memoria de la vista y se descarta
 * cuando la sesión termina, que es lo que hace seguro un dispositivo
 * compartido (§6.3, §6.5).
 *
 * SEPARACIÓN VISTA / ORQUESTACIÓN. Las transiciones son funciones PURAS y las
 * consultas son funciones async sin React. El componente es una envoltura
 * delgada sobre ambas, de modo que cada estado, cada reintento y cada desenlace
 * de cierre se prueban sin navegador —el runner de `apps/web` es `node`, sin
 * jsdom y sin librería de testing, y esta spec no autoriza dependencias nuevas
 * (§17.B-9)—.
 */

/* -------------------------------------------------------------------------- */
/* Textos                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Todo el texto visible, en un solo sitio.
 *
 * Ninguno nombra un código HTTP, una ruta, una caducidad, un identificador ni
 * un dato de persona: un mensaje de error no debe enseñar lo que la pantalla se
 * niega a mostrar (`CLAUDE.md` §7.5, spec §10).
 */
export const TEXTO_PORTAL_PACIENTE = {
  titulo: 'Mi espacio',
  comprobando: 'Comprobando su sesión…',
  activa: 'Su sesión está abierta.',
  sinSesion: 'No hay una sesión abierta. Vuelva a entrar para ver su información.',
  sinContexto:
    'Su sesión está abierta, pero no tiene acceso a esta experiencia. Consulte con la institución que lo atiende.',
  noDisponible:
    'No fue posible comprobar su sesión en este momento. Puede intentarlo de nuevo.',
  expirada:
    'Su sesión terminó. Se retiró la información de la pantalla. Vuelva a entrar para verla otra vez.',
  volverAEntrar: 'Volver a entrar',
  reintentarSesion: 'Comprobar de nuevo',
  salir: 'Cerrar sesión',
  cerrando: 'Cerrando su sesión…',
  cierreNoConfirmado:
    'No se pudo cerrar la sesión: su sesión SIGUE ABIERTA. Inténtelo de nuevo antes de dejar el dispositivo.',
  reintentarCierre: 'Intentar cerrar de nuevo',
  resumenTitulo: 'Mis datos',
  citasTitulo: 'Mis próximas citas',
  visitasTitulo: 'Mis visitas recientes',
  cargando: 'Cargando…',
  citasVacio: 'No tiene citas próximas registradas.',
  visitasVacio: 'No tiene visitas recientes registradas.',
  errorDatos: 'No se pudo cargar esta información.',
  errorInvalida: 'La información recibida no se pudo mostrar.',
  errorIntentos: 'Se hicieron demasiadas consultas seguidas. Espere un momento.',
  reintentar: 'Reintentar',
  cargandoResumen: 'sus datos',
  cargandoCitas: 'sus citas',
  cargandoVisitas: 'sus visitas',
  aviso: 'Aviso',
} as const;

/**
 * Marca visible de un aviso, y su equivalente para lectores de pantalla.
 *
 * El símbolo es decoración: quien no ve el color ni el glifo sigue leyendo la
 * palabra «Aviso» antes del mensaje. Ningún estado crítico se comunica solo por
 * color (§6.12, §6.17).
 */
const SIMBOLO_AVISO = '⚠ ';
const PREFIJO_AVISO = `${TEXTO_PORTAL_PACIENTE.aviso}: `;

/** Modalidad de una cita, en palabras. Nunca un código del catálogo. */
const MODALIDAD_TEXTO: Readonly<Record<string, string>> = {
  ON_SITE: 'Presencial',
  HOME: 'En casa',
  VIRTUAL: 'Virtual',
};

/** Estado de una cita o de una visita, en palabras y sin color como único canal. */
const ESTADO_TEXTO: Readonly<Record<string, string>> = {
  REQUESTED: 'Solicitada',
  ASSIGNED: 'Asignada',
  CANCELLED: 'Cancelada',
  SCHEDULED: 'Programada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Realizada',
  NOT_COMPLETED: 'No realizada',
};

/**
 * Fecha y hora legibles, en la zona horaria del país.
 *
 * Fija y explícita: sin `timeZone` el mismo dato se leería distinto según el
 * reloj del dispositivo, y una cita mostrada un día antes es un dato erróneo,
 * no un detalle de formato.
 */
export function fechaLegible(iso: string): string {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(fecha);
}

/* -------------------------------------------------------------------------- */
/* Estado observable                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Fase del portal, derivada SIEMPRE de una respuesta del servidor.
 *
 * `comprobando` es el estado inicial y no muestra dato alguno: aún no se sabe
 * si hay sesión, y suponer que sí sería fallar ABIERTO.
 */
export type FasePortalPaciente =
  | 'comprobando'
  | 'activa'
  | 'sin-sesion'
  | 'sin-contexto'
  | 'expirada'
  | 'no-disponible';

/** Estado de una de las tres secciones de datos. */
export type SeccionPaciente<TDatos> =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'ok'; readonly datos: TDatos }
  | { readonly fase: 'error'; readonly fallo: FalloPacienteSelf };

/** Estado del cierre de sesión. `no-confirmado` deja la sesión EN PIE. */
export type FaseCierrePaciente = 'inactivo' | 'en-curso' | 'no-confirmado';

export interface EstadoPortalPaciente {
  readonly fase: FasePortalPaciente;
  readonly resumen: SeccionPaciente<ResumenPacienteView>;
  readonly citas: SeccionPaciente<readonly CitaPacienteView[]>;
  readonly visitas: SeccionPaciente<readonly VisitaPacienteView[]>;
  readonly cierre: FaseCierrePaciente;
}

const CARGANDO = { fase: 'cargando' } as const;

/** Estado inicial: comprobando, sin ningún dato en memoria. */
export const PORTAL_INICIAL: EstadoPortalPaciente = {
  fase: 'comprobando',
  resumen: CARGANDO,
  citas: CARGANDO,
  visitas: CARGANDO,
  cierre: 'inactivo',
};

/**
 * Descarta TODO dato del paciente y fija la fase.
 *
 * Es la operación que hace seguro el dispositivo compartido: sin sesión, sin
 * contexto, expirada o cerrada, en la vista no queda nada que volver a pintar.
 */
export function portalSinDatos(fase: FasePortalPaciente): EstadoPortalPaciente {
  return {
    fase,
    resumen: CARGANDO,
    citas: CARGANDO,
    visitas: CARGANDO,
    cierre: 'inactivo',
  };
}

/**
 * Aplica el desenlace de la consulta de sesión.
 *
 * `cancelado` no cambia nada: cambiar de pantalla no es un estado que anunciar.
 * Cualquier otro desenlace distinto de `activa-con-contexto` borra los datos.
 */
export function conSesionPaciente(
  estado: EstadoPortalPaciente,
  sesion: EstadoSesionHumana,
): EstadoPortalPaciente {
  switch (sesion) {
    case 'activa-con-contexto':
      return { ...estado, fase: 'activa', cierre: 'inactivo' };
    case 'activa-sin-contexto':
      return portalSinDatos('sin-contexto');
    case 'sin-sesion':
      return portalSinDatos('sin-sesion');
    case 'no-disponible':
      return portalSinDatos('no-disponible');
    case 'cancelado':
    default:
      return estado;
  }
}

/**
 * `true` cuando el fallo de una consulta significa que la sesión dejó de valer.
 *
 * La expiración NO se presenta como error de datos (§6.14): la acción de la
 * persona es volver a entrar, no reintentar la consulta.
 */
export function esExpiracion(fallo: FalloPacienteSelf): boolean {
  return fallo === 'sin-sesion';
}

/** Traduce un desenlace del cliente a la sección correspondiente. */
export function seccionDesde<TDatos>(
  resultado: ResultadoPacienteSelf<TDatos>,
): SeccionPaciente<TDatos> {
  return resultado.estado === 'ok'
    ? { fase: 'ok', datos: resultado.datos }
    : { fase: 'error', fallo: resultado.estado };
}

/** Claves de las tres secciones de datos. */
export type ClaveSeccionPaciente = 'resumen' | 'citas' | 'visitas';

/**
 * Aplica el desenlace de UNA sección.
 *
 * Si el desenlace es expiración, la sesión manda sobre el dato: se retira todo
 * lo ya cargado y la fase pasa a `expirada`. `cancelado` no altera nada.
 */
export function conSeccionPaciente(
  estado: EstadoPortalPaciente,
  clave: ClaveSeccionPaciente,
  seccion: SeccionPaciente<unknown>,
): EstadoPortalPaciente {
  if (seccion.fase === 'error') {
    if (esExpiracion(seccion.fallo)) {
      return portalSinDatos('expirada');
    }

    if (seccion.fallo === 'sin-contexto') {
      return portalSinDatos('sin-contexto');
    }

    if (seccion.fallo === 'cancelado') {
      return estado;
    }
  }

  return { ...estado, [clave]: seccion } as EstadoPortalPaciente;
}

/**
 * Aplica el desenlace del cierre.
 *
 * SIN FALSO ÉXITO: solo las dos respuestas que el servidor confirma vacían la
 * pantalla. Cualquier otra deja la sesión abierta y lo DICE (§6.6).
 */
export function conCierrePaciente(
  estado: EstadoPortalPaciente,
  cierre: CierreSesionHumana,
): EstadoPortalPaciente {
  if (cierreHumanoConfirmado(cierre)) {
    return portalSinDatos('sin-sesion');
  }

  if (cierre === 'cancelado') {
    return { ...estado, cierre: 'inactivo' };
  }

  return { ...estado, cierre: 'no-confirmado' };
}

/** Mensaje visible de la fase de sesión. */
export function mensajeDeFase(estado: EstadoPortalPaciente): string {
  if (estado.cierre === 'en-curso') {
    return TEXTO_PORTAL_PACIENTE.cerrando;
  }

  if (estado.cierre === 'no-confirmado') {
    return TEXTO_PORTAL_PACIENTE.cierreNoConfirmado;
  }

  switch (estado.fase) {
    case 'comprobando':
      return TEXTO_PORTAL_PACIENTE.comprobando;
    case 'activa':
      return TEXTO_PORTAL_PACIENTE.activa;
    case 'sin-sesion':
      return TEXTO_PORTAL_PACIENTE.sinSesion;
    case 'sin-contexto':
      return TEXTO_PORTAL_PACIENTE.sinContexto;
    case 'expirada':
      return TEXTO_PORTAL_PACIENTE.expirada;
    case 'no-disponible':
    default:
      return TEXTO_PORTAL_PACIENTE.noDisponible;
  }
}

/**
 * Anuncio de la CARGA de datos, para la región viva.
 *
 * Nombra qué se está cargando, no solo que «algo» carga: quien no ve la
 * pantalla necesita saber si falta el resumen, las citas o las visitas. Se
 * emite por la MISMA región viva que el estado de sesión —no se duplica— y
 * queda vacío cuando no hay nada en curso, para no anunciar silencio.
 */
export function mensajeDeCarga(estado: EstadoPortalPaciente): string {
  if (estado.fase !== 'activa') {
    return '';
  }

  const pendientes = [
    estado.resumen.fase === 'cargando' ? TEXTO_PORTAL_PACIENTE.cargandoResumen : null,
    estado.citas.fase === 'cargando' ? TEXTO_PORTAL_PACIENTE.cargandoCitas : null,
    estado.visitas.fase === 'cargando' ? TEXTO_PORTAL_PACIENTE.cargandoVisitas : null,
  ].filter((pendiente) => pendiente !== null);

  if (pendientes.length === 0) {
    return '';
  }

  const ultimo = pendientes[pendientes.length - 1] ?? '';
  const previos = pendientes.slice(0, -1);
  const lista = previos.length === 0 ? ultimo : `${previos.join(', ')} y ${ultimo}`;

  return `Cargando ${lista}.`;
}

/** Mensaje visible del fallo de una sección. Nunca nombra el código. */
export function mensajeDeFallo(fallo: FalloPacienteSelf): string {
  switch (fallo) {
    case 'respuesta-invalida':
      return TEXTO_PORTAL_PACIENTE.errorInvalida;
    case 'demasiados-intentos':
      return TEXTO_PORTAL_PACIENTE.errorIntentos;
    default:
      return TEXTO_PORTAL_PACIENTE.errorDatos;
  }
}

/* -------------------------------------------------------------------------- */
/* Consultas                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Las cinco operaciones de red que el portal usa, inyectables.
 *
 * Ninguna recibe selector de sujeto, porque ninguna lo tiene en su firma: el
 * servidor deriva el paciente de la sesión y esta capa no puede proponerle otro.
 */
export interface DependenciasPortalPaciente {
  readonly consultarSesion: typeof consultarSesionHumana;
  readonly consultarResumen: typeof consultarResumenPaciente;
  readonly consultarCitas: typeof consultarCitasPaciente;
  readonly consultarVisitas: typeof consultarVisitasPaciente;
  readonly cerrarSesion: typeof cerrarSesionHumana;
}

export const DEPENDENCIAS_REALES: DependenciasPortalPaciente = {
  consultarSesion: consultarSesionHumana,
  consultarResumen: consultarResumenPaciente,
  consultarCitas: consultarCitasPaciente,
  consultarVisitas: consultarVisitasPaciente,
  cerrarSesion: cerrarSesionHumana,
};

/** Comprueba la sesión humana exigiendo el contexto `PATIENT`, y ninguno más. */
export async function comprobarSesionPaciente(
  deps: DependenciasPortalPaciente,
  fetchImpl?: typeof fetch,
  signal?: AbortSignal,
): Promise<EstadoSesionHumana> {
  return deps.consultarSesion(CONTEXTOS_HUMANOS.paciente, fetchImpl ?? fetch, signal);
}

/**
 * Carga las TRES proyecciones propias.
 *
 * Cada llamada sale de verdad al servidor: no hay caché, no hay memoria de
 * resultados y no hay deduplicación, y por eso un reintento es una consulta
 * nueva y no la repetición de una respuesta guardada.
 */
export async function cargarDatosPaciente(
  deps: DependenciasPortalPaciente,
  fetchImpl?: typeof fetch,
  signal?: AbortSignal,
): Promise<{
  readonly resumen: ResultadoPacienteSelf<ResumenPacienteView>;
  readonly citas: ResultadoPacienteSelf<readonly CitaPacienteView[]>;
  readonly visitas: ResultadoPacienteSelf<readonly VisitaPacienteView[]>;
}> {
  const efectivo = fetchImpl ?? fetch;

  const [resumen, citas, visitas] = await Promise.all([
    deps.consultarResumen(efectivo, signal),
    deps.consultarCitas(efectivo, signal),
    deps.consultarVisitas(efectivo, signal),
  ]);

  return { resumen, citas, visitas };
}

/* -------------------------------------------------------------------------- */
/* Vista                                                                       */
/* -------------------------------------------------------------------------- */

const AVISO_SESION_ID = 'paciente-portal-sesion';

/**
 * Resumen propio: EXACTAMENTE tres campos.
 *
 * Los tres se pintan aquí y ninguno más se pinta en ninguna otra parte de la
 * experiencia. Añadir un cuarto es STOP (§19.12), no una mejora.
 */
export function ResumenPacienteCard({
  resumen,
  onReintentar,
}: {
  readonly resumen: SeccionPaciente<ResumenPacienteView>;
  readonly onReintentar: () => void;
}): ReactNode {
  return (
    <section className={styles.portalCard} aria-labelledby="paciente-portal-resumen">
      <h2 id="paciente-portal-resumen" className={styles.portalCardTitulo}>
        {TEXTO_PORTAL_PACIENTE.resumenTitulo}
      </h2>

      {resumen.fase === 'cargando' ? (
        <p className={styles.portalNota}>{TEXTO_PORTAL_PACIENTE.cargando}</p>
      ) : null}

      {resumen.fase === 'error' ? (
        /*
         * El resumen se recupera igual de claramente que las listas: mensaje
         * seguro, símbolo, texto y un reintento operable. Un fallo del resumen
         * no es un estado sin salida.
         */
        <>
          <p className={styles.portalError}>
            <span aria-hidden="true">{SIMBOLO_AVISO}</span>
            <span className="merdn-sr-only">{PREFIJO_AVISO}</span>
            {mensajeDeFallo(resumen.fallo)}
          </p>
          <Button variant="outline" onClick={onReintentar}>
            {TEXTO_PORTAL_PACIENTE.reintentar}
          </Button>
        </>
      ) : null}

      {resumen.fase === 'ok' ? (
        <div className={styles.portalResumen}>
          <span aria-hidden="true" className={styles.portalIniciales}>
            {resumen.datos.initials}
          </span>
          <div>
            <p className={styles.portalNombre}>{`¡Hola, ${resumen.datos.givenName}!`}</p>
            <p className={styles.portalInicialesTexto}>
              {`Iniciales: ${resumen.datos.initials}`}
            </p>
            <p className={styles.portalRol}>{resumen.datos.label}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Fila legible de una cita o de una visita. */
interface FilaPaciente {
  readonly cuando: string;
  readonly detalle: string;
}

/** Una sección de lista —citas o visitas— con sus cuatro estados. */
function ListaSeccion<TItem>({
  titulo,
  tituloId,
  seccion,
  vacio,
  onReintentar,
  fila,
}: {
  readonly titulo: string;
  readonly tituloId: string;
  readonly seccion: SeccionPaciente<readonly TItem[]>;
  readonly vacio: string;
  readonly onReintentar: () => void;
  readonly fila: (item: TItem) => FilaPaciente;
}): ReactNode {
  return (
    <section className={styles.portalCard} aria-labelledby={tituloId}>
      <h2 id={tituloId} className={styles.portalCardTitulo}>
        {titulo}
      </h2>

      {seccion.fase === 'cargando' ? (
        <p className={styles.portalNota}>{TEXTO_PORTAL_PACIENTE.cargando}</p>
      ) : null}

      {seccion.fase === 'ok' && seccion.datos.length === 0 ? (
        <p className={styles.portalVacio}>{vacio}</p>
      ) : null}

      {seccion.fase === 'ok' && seccion.datos.length > 0 ? (
        <ul className={styles.portalLista}>
          {seccion.datos.map((item, indice) => {
            const { cuando, detalle } = fila(item);
            return (
              <li
                key={`${cuando}-${detalle}-${String(indice)}`}
                className={styles.portalItem}
              >
                <span className={styles.portalCuando}>{cuando}</span>
                <span className={styles.portalEtiqueta}>{detalle}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {seccion.fase === 'error' ? (
        <>
          <p className={styles.portalError}>
            <span aria-hidden="true">{SIMBOLO_AVISO}</span>
            <span className="merdn-sr-only">{PREFIJO_AVISO}</span>
            {mensajeDeFallo(seccion.fallo)}
          </p>
          <Button variant="outline" onClick={onReintentar}>
            {TEXTO_PORTAL_PACIENTE.reintentar}
          </Button>
        </>
      ) : null}
    </section>
  );
}

/** Texto de una cita: modalidad y estado, en palabras y nunca solo por color. */
export function filaDeCita(cita: CitaPacienteView): FilaPaciente {
  return {
    cuando: fechaLegible(cita.scheduledStart),
    detalle: `${MODALIDAD_TEXTO[cita.modality] ?? cita.modality} · ${
      ESTADO_TEXTO[cita.status] ?? cita.status
    }`,
  };
}

/** Texto de una visita. Misma regla que la cita. */
export function filaDeVisita(visita: VisitaPacienteView): FilaPaciente {
  return {
    cuando: fechaLegible(visita.scheduledStart),
    detalle: `${MODALIDAD_TEXTO[visita.modality] ?? visita.modality} · ${
      ESTADO_TEXTO[visita.status] ?? visita.status
    }`,
  };
}

/**
 * Vista PURA del portal.
 *
 * No tiene estado, no consulta y no decide: recibe el estado observable y las
 * acciones. Eso es lo que permite comprobar cada uno de los seis estados y cada
 * desenlace de cierre sin navegador.
 */
export function PortalPacienteVista({
  estado,
  urlLogin,
  onComprobar,
  onReintentarResumen,
  onReintentarCitas,
  onReintentarVisitas,
  onCerrar,
}: {
  readonly estado: EstadoPortalPaciente;
  readonly urlLogin: string;
  readonly onComprobar: () => void;
  readonly onReintentarResumen: () => void;
  readonly onReintentarCitas: () => void;
  readonly onReintentarVisitas: () => void;
  readonly onCerrar: () => void;
}): ReactNode {
  const activa = estado.fase === 'activa';
  const ocupado = estado.cierre === 'en-curso';
  const alerta = estado.cierre === 'no-confirmado';
  const carga = mensajeDeCarga(estado);

  return (
    <main className={styles.stage}>
      <div>
        <PhoneFrame>
          <Screen tone="lienzo">
            <DeviceStatusBar tone="marca" />

            <header className={styles.portalHeader}>
              <h1 className={styles.portalTitulo}>{TEXTO_PORTAL_PACIENTE.titulo}</h1>
            </header>

            <div className={styles.portalScroll}>
              {/*
               * Región viva única de sesión y de carga. `polite` porque ninguno
               * de estos cambios interrumpe una tarea en curso.
               */}
              <p
                id={AVISO_SESION_ID}
                className={alerta ? styles.portalAvisoFuerte : styles.portalAviso}
                role="status"
                aria-live="polite"
              >
                {alerta ? <span aria-hidden="true">{SIMBOLO_AVISO}</span> : null}
                {alerta ? (
                  <span className="merdn-sr-only">{PREFIJO_AVISO}</span>
                ) : null}
                {mensajeDeFase(estado)}
                {carga === '' ? null : ` ${carga}`}
              </p>

              {activa ? (
                <>
                  <ResumenPacienteCard
                    resumen={estado.resumen}
                    onReintentar={onReintentarResumen}
                  />

                  <ListaSeccion
                    titulo={TEXTO_PORTAL_PACIENTE.citasTitulo}
                    tituloId="paciente-portal-citas"
                    seccion={estado.citas}
                    vacio={TEXTO_PORTAL_PACIENTE.citasVacio}
                    onReintentar={onReintentarCitas}
                    fila={filaDeCita}
                  />

                  <ListaSeccion
                    titulo={TEXTO_PORTAL_PACIENTE.visitasTitulo}
                    tituloId="paciente-portal-visitas"
                    seccion={estado.visitas}
                    vacio={TEXTO_PORTAL_PACIENTE.visitasVacio}
                    onReintentar={onReintentarVisitas}
                    fila={filaDeVisita}
                  />

                  {/* SPEC 055 / MP02–MP03: bitácora propia y solicitud manual. */}
                  <CareWorkspace perfil="paciente" />
                </>
              ) : null}

              <div className={styles.portalAcciones}>
                {activa ? (
                  <Button variant="outline" disabled={ocupado} onClick={onCerrar}>
                    {alerta
                      ? TEXTO_PORTAL_PACIENTE.reintentarCierre
                      : TEXTO_PORTAL_PACIENTE.salir}
                  </Button>
                ) : null}

                {estado.fase === 'no-disponible' ? (
                  <Button variant="outline" onClick={onComprobar}>
                    {TEXTO_PORTAL_PACIENTE.reintentarSesion}
                  </Button>
                ) : null}

                {estado.fase === 'sin-sesion' || estado.fase === 'expirada' ? (
                  /*
                   * El acceso es un ENLACE, no un botón: el flujo OIDC responde
                   * con una redirección hacia un tercero, y solo una navegación
                   * real puede completarlo.
                   */
                  <a
                    className={styles.portalEnlace}
                    href={urlLogin}
                    aria-describedby={AVISO_SESION_ID}
                  >
                    {TEXTO_PORTAL_PACIENTE.volverAEntrar}
                  </a>
                ) : null}
              </div>
            </div>
          </Screen>
        </PhoneFrame>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Contenedor                                                                  */
/* -------------------------------------------------------------------------- */

export interface PacienteExperienceProps {
  /** URL absoluta del inicio OIDC. La compone quien monta la experiencia. */
  readonly urlLogin: string;
  /** Operaciones de red; en producción, las reales. */
  readonly dependencias?: DependenciasPortalPaciente;
  readonly fetchImpl?: typeof fetch;
  /** Estado inicial alternativo. Solo lo usan las pruebas de render. */
  readonly estadoInicial?: EstadoPortalPaciente;
}

export function PacienteExperience({
  urlLogin,
  dependencias = DEPENDENCIAS_REALES,
  fetchImpl,
  estadoInicial = PORTAL_INICIAL,
}: PacienteExperienceProps): ReactNode {
  const [estado, setEstado] = useState<EstadoPortalPaciente>(estadoInicial);
  const vigente = useRef(true);

  useEffect(() => {
    vigente.current = true;
    return () => {
      vigente.current = false;
    };
  }, []);

  const cargarDatos = useCallback((): void => {
    setEstado((previo) => ({
      ...previo,
      resumen: CARGANDO,
      citas: CARGANDO,
      visitas: CARGANDO,
    }));

    void cargarDatosPaciente(dependencias, fetchImpl).then((datos) => {
      if (!vigente.current) {
        return;
      }

      setEstado((previo) =>
        conSeccionPaciente(
          conSeccionPaciente(
            conSeccionPaciente(previo, 'resumen', seccionDesde(datos.resumen)),
            'citas',
            seccionDesde(datos.citas),
          ),
          'visitas',
          seccionDesde(datos.visitas),
        ),
      );
    });
  }, [dependencias, fetchImpl]);

  const comprobar = useCallback((): void => {
    void comprobarSesionPaciente(dependencias, fetchImpl).then((sesion) => {
      if (!vigente.current) {
        return;
      }

      setEstado((previo) => conSesionPaciente(previo, sesion));

      if (sesion === 'activa-con-contexto') {
        cargarDatos();
      }
    });
  }, [cargarDatos, dependencias, fetchImpl]);

  useEffect(() => {
    comprobar();
  }, [comprobar]);

  /*
   * Reintento del resumen. Vuelve a SALIR al servidor —no hay caché ni memoria
   * de resultados—, pasa por `cargando` mientras consulta y aplica el desenlace
   * con la misma transición que las listas: un `401` expira la sesión y retira
   * TODO, y un `403` deja la experiencia sin contexto y también retira todo.
   */
  const reintentarResumen = useCallback((): void => {
    setEstado((previo) => ({ ...previo, resumen: CARGANDO }));

    void dependencias.consultarResumen(fetchImpl ?? fetch).then((resultado) => {
      if (vigente.current) {
        setEstado((previo) =>
          conSeccionPaciente(previo, 'resumen', seccionDesde(resultado)),
        );
      }
    });
  }, [dependencias, fetchImpl]);

  const reintentarCitas = useCallback((): void => {
    setEstado((previo) => ({ ...previo, citas: CARGANDO }));

    void dependencias.consultarCitas(fetchImpl ?? fetch).then((resultado) => {
      if (vigente.current) {
        setEstado((previo) =>
          conSeccionPaciente(previo, 'citas', seccionDesde(resultado)),
        );
      }
    });
  }, [dependencias, fetchImpl]);

  const reintentarVisitas = useCallback((): void => {
    setEstado((previo) => ({ ...previo, visitas: CARGANDO }));

    void dependencias.consultarVisitas(fetchImpl ?? fetch).then((resultado) => {
      if (vigente.current) {
        setEstado((previo) =>
          conSeccionPaciente(previo, 'visitas', seccionDesde(resultado)),
        );
      }
    });
  }, [dependencias, fetchImpl]);

  const cerrar = useCallback((): void => {
    setEstado((previo) => ({ ...previo, cierre: 'en-curso' }));

    void dependencias.cerrarSesion(fetchImpl ?? fetch).then((cierre) => {
      if (vigente.current) {
        setEstado((previo) => conCierrePaciente(previo, cierre));
      }
    });
  }, [dependencias, fetchImpl]);

  return (
    <PortalPacienteVista
      estado={estado}
      urlLogin={urlLogin}
      onComprobar={comprobar}
      onReintentarResumen={reintentarResumen}
      onReintentarCitas={reintentarCitas}
      onReintentarVisitas={reintentarVisitas}
      onCerrar={cerrar}
    />
  );
}

/** Reexportada para que la vista y sus pruebas nombren la etiqueta fija. */
export { ETIQUETA_PACIENTE };
