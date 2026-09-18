'use client';

import { useState, type ReactNode } from 'react';

import { branding } from '@/config/branding';
import {
  LONGITUD_MAXIMA_CREDENCIAL,
  etiquetaDeRol,
  textoCaducidad,
  type ResultadoSesion,
  type SesionInstitucionalDto,
} from '@/features/auth/institutionalSessionClient';

import styles from './municipality.module.css';

/**
 * Frontera de sesión INSTITUCIONAL de Alcaldía (spec 022, FR-04 y FR-05;
 * escenarios de aceptación 1 a 8).
 *
 * Alcaldía no tiene sesión propia. Reutiliza ÍNTEGRAMENTE la sesión
 * institucional que ya existe —la misma cookie `HttpOnly`, el mismo backend,
 * los mismos endpoints— a través del cliente COMPARTIDO
 * `@/features/auth/institutionalSessionClient`, movido allí por el paquete A de
 * esta misma spec. Este módulo NO habla con la red: recibe desenlaces ya
 * resueltos por ese cliente y decide qué significan para Alcaldía. Duplicar
 * aquí el transporte sería crear una segunda copia de la autenticación, que es
 * exactamente lo que la decisión técnica de la spec 022 evita.
 *
 * Lo que este módulo aporta, y es lo único suyo:
 *
 * 1. la REGLA DE ROL de Alcaldía, que es de igualdad EXACTA con
 *    `MUNICIPAL_VIEWER` y falla CERRADO ante cualquier otra cosa;
 * 2. la traducción de un desenlace del cliente al estado que la superficie
 *    municipal debe mostrar;
 * 3. las superficies neutras: entrada institucional y estados denegados.
 *
 * TENER SESIÓN NO ES TENER PERMISO. Que el servidor devuelva un contexto solo
 * dice que hay una sesión institucional viva; que su rol sea el municipal solo
 * abre esta superficie. Cada consulta agregada vuelve a exigir autorización,
 * aislamiento por tenant, RLS y supresión EN EL SERVIDOR, y esa respuesta es la
 * única que habilita un dato. Esta frontera es una puerta de interfaz, no un
 * control de seguridad: su valor está en no montar ni pedir nada antes de que
 * el servidor haya confirmado el rol.
 *
 * NO HAY IDENTIDAD EN EL NAVEGADOR. No se escribe ni se lee almacenamiento web,
 * ni cookie desde JavaScript, ni URL, ni ningún repliegue a datos ficticios: si
 * el servidor no confirma, aquí no se entra.
 */

/* -------------------------------------------------------------------------- */
/* La regla de rol                                                             */
/* -------------------------------------------------------------------------- */

/**
 * El ÚNICO rol institucional que abre el slice operativo de Alcaldía.
 *
 * Los roles del contrato son DISJUNTOS: `HOSPITAL_PATIENT_VIEWER` y
 * `HOSPITAL_SCHEDULER` no son «menos» que este, son OTROS, y ninguna jerarquía
 * los convierte en municipales. Por eso la comprobación es de igualdad exacta y
 * no una pertenencia a un conjunto, un prefijo o una jerarquía.
 */
export const MUNICIPALITY_ROL_REQUERIDO = 'MUNICIPAL_VIEWER';

/**
 * `true` solo si el rol es EXACTAMENTE el municipal.
 *
 * Función pura y deliberadamente trivial: es el punto único donde se decide el
 * acceso, de modo que relajarla —un `includes`, un `startsWith`, una
 * comparación sin distinguir caja— es un cambio visible en un solo sitio y con
 * su propia prueba.
 */
export function esRolMunicipal(role: string): boolean {
  return role === MUNICIPALITY_ROL_REQUERIDO;
}

/* -------------------------------------------------------------------------- */
/* El estado de la superficie                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Los SEIS estados que la superficie municipal sabe representar.
 *
 * `autorizada` es el único que monta el slice operativo. Los otros cinco son
 * superficies neutras: ninguna muestra agregados, ninguna revela si existen y
 * ninguna distingue entre instituciones.
 */
export type EstadoSesionMunicipal =
  | 'comprobando'
  | 'sin-sesion'
  | 'expirada'
  | 'rol-no-autorizado'
  | 'error'
  | 'autorizada';

/** Estados en los que NO se monta ni se consulta nada operativo. */
export type EstadoDenegado = Exclude<EstadoSesionMunicipal, 'autorizada'>;

/**
 * Traduce el desenlace del cliente compartido al estado de esta superficie.
 *
 * Es la puerta ENTERA, y es una función PURA para poder probar cada camino sin
 * navegador y sin red.
 *
 * `habiaSesion` distingue dos situaciones que el servidor responde IGUAL —con
 * `401`— y que para quien usa la pantalla no son lo mismo: no haber entrado
 * todavía, y haber estado dentro y haber dejado de estarlo. El cliente
 * compartido no puede distinguirlas, y no se le pide que lo haga: la diferencia
 * la conoce esta interfaz porque recuerda si llegó a estar autorizada, y no
 * porque deduzca nada del servidor. En ningún caso se afirma POR QUÉ terminó
 * —caducidad, revocación, manipulación—: el servidor no lo dice.
 *
 * FALLA CERRADO en todos los caminos: `error` y `cancelado` NO conservan el
 * acceso, y un contexto `ok` con cualquier otro rol es denegación, no un estado
 * intermedio.
 */
export function resolverEstadoMunicipal(
  resultado: ResultadoSesion,
  habiaSesion: boolean,
): EstadoSesionMunicipal {
  if (resultado.kind === 'ok') {
    return esRolMunicipal(resultado.datos.role) ? 'autorizada' : 'rol-no-autorizado';
  }

  if (resultado.kind === 'sin-sesion') {
    return habiaSesion ? 'expirada' : 'sin-sesion';
  }

  /*
   * `error` y `cancelado` no saben nada del acceso. Conservarlo «mientras se
   * comprueba» sería mantener abierta una puerta que nadie confirmó, así que se
   * niega y se ofrece reintentar.
   */
  return 'error';
}

/**
 * Contexto de sesión que la superficie autorizada puede mostrar.
 *
 * `null` en todo estado denegado: no queda ningún resto del contexto anterior
 * cuando la sesión deja de estar autorizada.
 */
export function contextoAutorizado(
  resultado: ResultadoSesion,
): SesionInstitucionalDto | null {
  return resultado.kind === 'ok' && esRolMunicipal(resultado.datos.role)
    ? resultado.datos
    : null;
}

/* -------------------------------------------------------------------------- */
/* Textos de las superficies neutras                                           */
/* -------------------------------------------------------------------------- */

/**
 * Título y explicación de cada estado denegado.
 *
 * Los cinco textos son UNIFORMES en lo que importa: ninguno nombra una
 * institución, un municipio, un tenant, un rol concreto de otra experiencia ni
 * una persona, y ninguno dice si existen datos al otro lado. Quien no debe
 * entrar no puede deducir, leyendo la pantalla, si la institución existe, si
 * tiene agregados o si su credencial es de otra experiencia.
 */
export const MUNICIPALITY_ESTADO_SESION: Record<
  EstadoDenegado,
  { readonly titulo: string; readonly detalle: string }
> = {
  comprobando: {
    titulo: 'Comprobando la sesión institucional',
    detalle:
      'Se está confirmando con el servidor si hay una sesión institucional vigente para esta pantalla.',
  },
  'sin-sesion': {
    titulo: 'Acceso institucional',
    detalle:
      'La credencial de acceso es de la ENTIDAD y es compartida: no identifica a ninguna persona. Sin una sesión institucional vigente esta pantalla no muestra información municipal.',
  },
  expirada: {
    titulo: 'La sesión institucional ya no está vigente',
    detalle:
      'El servidor dejó de reconocer la sesión de esta pantalla. La información municipal se retiró y hay que volver a entrar.',
  },
  'rol-no-autorizado': {
    titulo: 'Esta sesión no da acceso a la experiencia municipal',
    detalle:
      'La sesión institucional vigente corresponde a otra experiencia. Para consultar información municipal se necesita una credencial habilitada para ello.',
  },
  error: {
    titulo: 'No fue posible comprobar la sesión institucional',
    detalle:
      'El servicio de acceso institucional no respondió. No se muestra información municipal mientras la sesión no pueda confirmarse.',
  },
};

/** Aviso cuando la apertura tuvo éxito pero el contexto no pudo confirmarse. */
export const MUNICIPALITY_MENSAJE_SIN_CONFIRMAR =
  'No fue posible confirmar la sesión institucional. Vuelva a intentarlo.';

/**
 * Aviso cuando la sesión abierta NO es municipal.
 *
 * Es deliberadamente el mismo texto que el estado denegado por rol: entrar con
 * una credencial de otra experiencia no debe producir un mensaje distinto del
 * de encontrarse ya dentro con ella, porque la diferencia solo serviría para
 * enumerar qué credenciales existen.
 */
export const MUNICIPALITY_MENSAJE_ROL =
  MUNICIPALITY_ESTADO_SESION['rol-no-autorizado'].detalle;

/** Confirmación tras un cierre CONFIRMADO por el servidor. */
export const MUNICIPALITY_MENSAJE_CIERRE =
  'Sesión cerrada. Ya no hay información municipal en esta pantalla.';

/**
 * Aviso cuando el servidor NO confirmó la revocación.
 *
 * La sesión NO se retira de la interfaz en ese caso: si el servidor la
 * conserva, esconderla en pantalla no la cierra y haría creer que sí.
 */
export const MUNICIPALITY_MENSAJE_CIERRE_NO_CONFIRMADO =
  'No fue posible confirmar el cierre en el servidor. La sesión sigue abierta. Inténtelo de nuevo.';

/* -------------------------------------------------------------------------- */
/* Marco neutral: la geometría de Alcaldía sin nada que dependa de la sesión   */
/* -------------------------------------------------------------------------- */

/**
 * Envolvente reconocible de Alcaldía SIN sesión.
 *
 * Conserva la geometría —barra lateral y área principal— para que el acceso no
 * parezca otra aplicación, y no monta NADA que dependa de una sesión: sin menú
 * operable, sin topbar, sin periodo, sin perfil, sin identidad de la entidad y
 * sin `data-municipality-content`, que afirmaría que hay un módulo montado.
 *
 * Que el marco se vea no concede nada: no hay navegación, no hay consulta y la
 * autoridad sigue siendo el servidor.
 */
function MunicipalityMarcoNeutral({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebarNeutral}>
        <p className={styles.sesionMarca}>{branding.platformDisplayName}</p>
        <p className={styles.sesionMarcaBajada}>Experiencia municipal</p>
      </aside>
      <div className={styles.main}>
        <main className={styles.sesionArea}>{children}</main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Entrada institucional                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Formulario de entrada institucional de Alcaldía.
 *
 * Envía el código y la credencial al endpoint de apertura YA EXISTENTE a través
 * del cliente compartido. No hay acceso de desarrollo, no hay credencial de
 * ejemplo, no hay repliegue a datos ficticios y no hay identidad en el
 * navegador.
 *
 * La credencial vive en el estado del componente el tiempo mínimo y se retira
 * en el MISMO gesto que la envía, también cuando el intento falla: quien
 * reintente vuelve a escribirla. No se guarda, no se registra y no viaja por la
 * URL —el formulario no declara `action` ni `method`, de modo que el navegador
 * no puede componer una con lo escrito—.
 */
export function MunicipalityAccesoInstitucional({
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
  const copia = MUNICIPALITY_ESTADO_SESION['sin-sesion'];

  return (
    <section className={styles.sesionPanel} aria-labelledby="municipality-acceso-titulo">
      <h1 className={styles.sesionTitulo} id="municipality-acceso-titulo">
        {copia.titulo}
      </h1>
      <p className={styles.sesionTexto}>{copia.detalle}</p>
      <form
        className={styles.sesionForm}
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();

          const identityCode = codigo.trim();
          const accessSecret = credencial;

          setCredencial('');
          onEntrar(identityCode, accessSecret);
        }}
      >
        <label className={styles.sesionCampo} htmlFor="municipality-acceso-codigo">
          <span className={styles.sesionEtiqueta}>Código de identidad institucional</span>
          <input
            autoComplete="off"
            className={styles.sesionInput}
            disabled={ocupado}
            id="municipality-acceso-codigo"
            inputMode="text"
            onChange={(evento) => {
              setCodigo(evento.target.value);
            }}
            spellCheck={false}
            type="text"
            value={codigo}
          />
        </label>
        <label className={styles.sesionCampo} htmlFor="municipality-acceso-credencial">
          <span className={styles.sesionEtiqueta}>Credencial de acceso</span>
          <input
            autoComplete="off"
            className={styles.sesionInput}
            disabled={ocupado}
            id="municipality-acceso-credencial"
            maxLength={LONGITUD_MAXIMA_CREDENCIAL}
            onChange={(evento) => {
              setCredencial(evento.target.value);
            }}
            spellCheck={false}
            type="password"
            value={credencial}
          />
        </label>
        <button className={styles.sesionBoton} disabled={ocupado} type="submit">
          {ocupado ? 'Comprobando…' : 'Entrar'}
        </button>
        {/*
         * Región viva PERMANENTE: existe desde el primer render para que un
         * lector de pantalla anuncie el aviso cuando aparezca, en lugar de
         * tener que descubrir un nodo nuevo. Vacía no anuncia nada.
         */}
        <p className={styles.sesionAviso} role="alert">
          {aviso ?? ''}
        </p>
      </form>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Estados denegados                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Superficie neutra de un estado que NO autoriza.
 *
 * Ninguno de estos estados monta información municipal, y la diferencia entre
 * ellos está en qué puede hacer quien la ve —esperar, reintentar o volver a
 * entrar—, nunca en revelar más sobre la sesión, la institución o los datos.
 *
 * El estado se comunica por TEXTO, con un encabezado real y una región viva; no
 * por color ni por un icono solo. `comprobando` además lo anuncia como
 * ocupado, para que no se lea como una pantalla vacía.
 */
export function MunicipalityEstadoSesion({
  estado,
  aviso = null,
  onReintentar,
}: {
  readonly estado: Exclude<EstadoDenegado, 'sin-sesion'>;
  /** Aviso adicional, por ejemplo el resultado de un cierre. */
  readonly aviso?: string | null;
  /** Reintento real. Ausente cuando no hay nada que reintentar todavía. */
  readonly onReintentar?: () => void;
}): ReactNode {
  const copia = MUNICIPALITY_ESTADO_SESION[estado];

  return (
    <section
      className={styles.sesionPanel}
      aria-busy={estado === 'comprobando' ? true : undefined}
      aria-labelledby="municipality-sesion-titulo"
    >
      <h1 className={styles.sesionTitulo} id="municipality-sesion-titulo">
        {copia.titulo}
      </h1>
      <p className={styles.sesionTexto}>{copia.detalle}</p>
      {onReintentar === undefined ? null : (
        <button className={styles.sesionBoton} onClick={onReintentar} type="button">
          Volver a comprobar la sesión
        </button>
      )}
      <p className={styles.sesionAviso} role="alert">
        {aviso ?? ''}
      </p>
    </section>
  );
}

/**
 * Superficie municipal NO autorizada, con su marco.
 *
 * Punto único de composición de los cinco estados denegados: el marco neutro es
 * el mismo en todos, de modo que ninguno puede montar por descuido algo que los
 * demás no montan.
 */
export function MunicipalitySuperficieDenegada({
  estado,
  aviso = null,
  ocupado = false,
  onEntrar,
  onReintentar,
}: {
  readonly estado: EstadoDenegado;
  readonly aviso?: string | null;
  readonly ocupado?: boolean;
  readonly onEntrar: (identityCode: string, accessSecret: string) => void;
  readonly onReintentar: () => void;
}): ReactNode {
  return (
    <MunicipalityMarcoNeutral>
      {estado === 'sin-sesion' ? (
        <MunicipalityAccesoInstitucional
          aviso={aviso}
          ocupado={ocupado}
          onEntrar={onEntrar}
        />
      ) : (
        <MunicipalityEstadoSesion
          aviso={aviso}
          estado={estado}
          {...(estado === 'comprobando' ? {} : { onReintentar })}
        />
      )}
    </MunicipalityMarcoNeutral>
  );
}

/* -------------------------------------------------------------------------- */
/* Identidad visible de la sesión autorizada                                   */
/* -------------------------------------------------------------------------- */

/**
 * Lo que la superficie autorizada puede decir de la sesión.
 *
 * EXACTAMENTE tres cosas, todas procedentes del servidor: el nombre real de la
 * entidad, la etiqueta impersonal del rol y la caducidad redactada por el
 * cliente compartido a partir de la cadena ISO. Ni tenant, ni identificador, ni
 * persona: la credencial institucional es compartida y convertirla en un nombre
 * propio afirmaría una atribución que el sistema no puede sostener.
 */
export function identidadDeSesion(sesion: SesionInstitucionalDto): {
  readonly entidad: string;
  readonly rol: string;
  readonly caducidad: string | null;
} {
  return {
    entidad: sesion.institution.name,
    rol: etiquetaDeRol(sesion.role),
    caducidad: textoCaducidad(sesion.expiresAt),
  };
}
