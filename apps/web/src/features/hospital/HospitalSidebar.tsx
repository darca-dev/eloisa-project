import { Fragment, type ReactNode } from 'react';

import styles from './hospital.module.css';
import { HospitalIcon } from './HospitalIcon';
import { HOSPITAL_NAV_ITEMS } from './hospitalConfig';
import type { HospitalInstitution, HospitalNavItemConfig } from './hospitalConfig';

/**
 * Sidebar del Shell Hospital (TASK-003H-01, FR-01, FR-02, FR-03).
 *
 * Reproduce las líneas 22–81 del prototipo oficial: identidad institucional,
 * menú completo en su orden vinculante y separador.
 *
 * H-FID-B (§4.1, §4.2 y §4.3.4) integra el corazón canónico junto a Eloisa,
 * mantiene el logo institucional en una ranura separada y retira el conteo
 * demostrativo de «Novedades», que no tiene ninguna fuente real.
 *
 * TASK-003H-03 (FR-01) convierte en funcionales únicamente los cuatro botones
 * cuyas vistas existen: `Inicio`, `Agenda y citas`, `Pacientes` y
 * `Semáforo de alarmas`. Los demás siguen siendo botones `type="button"` sin
 * controlador, sin ruta, sin `href="#"` y sin cambio de sección: permanecen
 * visibles e intactos y no abren módulo alguno.
 *
 * La navegación cambia una vista local dentro del shell. No crea rutas, no
 * cambia la URL, no persiste y no concede permisos: que una opción del menú sea
 * visible no indica que su módulo exista ni que el usuario pueda usarlo.
 */

/**
 * Corazón canónico de Eloisa (H-FID-B, §3.4 y §4.1.2).
 *
 * Se REUTILIZA el asset que ya existe en `public/brand/`: no se copia, no se
 * edita, no se renombra y no se crea una variante.
 */
const ELOISA_CORAZON_SRC = '/brand/corazon-check.png';

/**
 * Marca de plataforma: el corazón canónico junto al nombre Eloisa.
 *
 * La imagen es DECORATIVA —`alt=""` y `aria-hidden`— porque el nombre ya está
 * escrito a su lado: darle un texto alternativo haría que un lector de pantalla
 * anunciara la marca dos veces (§4.1.3). El nombre accesible de la marca es,
 * por tanto, exactamente el texto visible.
 *
 * Esta es la identidad de PLATAFORMA. No es, ni sustituye, al logo de ninguna
 * institución: son identidades distintas y ocupan ranuras distintas (§3.5).
 *
 * `loading="lazy"` evita que React inserte un `<link rel="preload">` durante el
 * render de servidor. Ese enlace añadiría un `href` al marcado del shell, y la
 * regresión aprobada exige que Hospital no emita ninguno: la navegación es
 * local, no crea rutas y no enlaza a nada.
 */
export function HospitalPlatformBrand({
  etiquetaPlataforma,
}: {
  readonly etiquetaPlataforma: string;
}): ReactNode {
  return (
    <div className={styles.identityMarca}>
      <img
        className={styles.identityMarcaLogo}
        src={ELOISA_CORAZON_SRC}
        alt=""
        aria-hidden="true"
        loading="lazy"
      />
      <span className={styles.identityEyebrow}>{etiquetaPlataforma}</span>
    </div>
  );
}

/**
 * Compone `tipo · municipio` sin dejar restos cuando falta alguno (§4.2.4).
 *
 * Devuelve `null` cuando no hay NADA que afirmar: en ese caso el metadato no se
 * renderiza en absoluto, de modo que no queda un `·` suelto, un espacio ni un
 * nodo vacío en el marcado. Con un solo valor se muestra ese valor y nada más.
 *
 * No hay valor por defecto: un tipo o un municipio que la institución no aporta
 * no se inventa (§4.2.3).
 */
export function metadatoInstitucional(institucion: HospitalInstitution): string | null {
  const partes = [institucion.tipo, institucion.municipio]
    .map((valor) => valor.trim())
    .filter((valor) => valor !== '');

  return partes.length === 0 ? null : partes.join(' · ');
}

/**
 * Identidad del sidebar: marca de plataforma y, debajo, la institución.
 *
 * El logo institucional es una ranura PROPIA que solo se dibuja cuando la
 * institución lo aporta. Sin fuente autorizada no se dibuja nada: ni un logo
 * genérico, ni el corazón de Eloisa haciendo de sustituto.
 */
export function HospitalInstitutionIdentity({
  institucion,
  etiquetaPlataforma,
}: {
  readonly institucion: HospitalInstitution;
  readonly etiquetaPlataforma: string;
}): ReactNode {
  const metadato = metadatoInstitucional(institucion);

  return (
    <div className={styles.identity}>
      <HospitalPlatformBrand etiquetaPlataforma={etiquetaPlataforma} />
      {institucion.logo === null ? null : (
        <img
          className={styles.identityLogo}
          src={institucion.logo.src}
          alt={institucion.logo.alt}
        />
      )}
      <div className={styles.identityName}>{institucion.nombre}</div>
      {metadato === null ? null : <div className={styles.identityMeta}>{metadato}</div>}
    </div>
  );
}

/**
 * Elemento de menú: icono, etiqueta y estado activo/inactivo.
 *
 * H-FID-B (§4.3.4 y §4.3.5) retira el conteo demostrativo: no existe ninguna
 * fuente real de novedades, y un badge sin fuente afirma un dato que el sistema
 * no puede sostener. No se sustituye por cero ni por un badge neutro.
 */
export function HospitalNavItem({
  item,
  activo,
  navegable = false,
  onSeleccionar,
}: {
  readonly item: HospitalNavItemConfig;
  readonly activo: boolean;
  /** `true` solo para las opciones cuya vista está implementada. */
  readonly navegable?: boolean;
  readonly onSeleccionar?: (id: string) => void;
}): ReactNode {
  return (
    <button
      type="button"
      className={activo ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
      aria-current={activo ? true : undefined}
      /* Marcador técnico de auditoría: no es visible ni se anuncia. */
      data-hospital-nav={navegable ? 'navegable' : 'sin-modulo'}
      onClick={
        navegable && onSeleccionar !== undefined
          ? () => {
              onSeleccionar(item.id);
            }
          : undefined
      }
    >
      <HospitalIcon name={item.icono} />
      {item.etiqueta}
    </button>
  );
}

export function HospitalSidebar({
  institucion,
  etiquetaPlataforma,
  navegacion,
  itemActivoId,
  idsNavegables = [],
  onSeleccionar,
}: {
  readonly institucion: HospitalInstitution;
  readonly etiquetaPlataforma: string;
  readonly navegacion: readonly HospitalNavItemConfig[];
  readonly itemActivoId: string;
  /** Identificadores cuyas vistas existen; el resto queda inerte. */
  readonly idsNavegables?: readonly string[];
  readonly onSeleccionar?: (id: string) => void;
}): ReactNode {
  return (
    <aside className={styles.sidebar} aria-label={`Panel de ${institucion.nombre}`}>
      <HospitalInstitutionIdentity
        institucion={institucion}
        etiquetaPlataforma={etiquetaPlataforma}
      />
      <nav className={styles.nav} aria-label="Secciones de la experiencia Hospital">
        {navegacion.map((item) => (
          <Fragment key={item.id}>
            {item.separadorAntes === true ? (
              <div className={styles.navSeparator} aria-hidden="true" />
            ) : null}
            <HospitalNavItem
              item={item}
              activo={item.id === itemActivoId}
              navegable={idsNavegables.includes(item.id)}
              onSeleccionar={onSeleccionar}
            />
          </Fragment>
        ))}
      </nav>
    </aside>
  );
}

/**
 * Sidebar NEUTRAL del shell Hospital (H-FID-A, §3.1 y §3.2).
 *
 * Conserva la envolvente reconocible de Hospital cuando la sesión está en
 * comprobación o ausente, y NADA más: solo la marca de plataforma y las
 * etiquetas del menú en su orden aprobado.
 *
 * La marca de plataforma es la MISMA que en el estado autenticado: el corazón
 * canónico junto a Eloisa. Es identidad de PLATAFORMA, no de institución, y no
 * afirma nada sobre quién mira ni sobre si hay sesión.
 *
 * Lo que deliberadamente NO hay aquí:
 *
 * - institución, tipo, municipio, logo institucional, persona, iniciales,
 *   badges ni conteos:
 *   sin sesión vigente esta superficie no puede afirmar nada de eso, y los
 *   literales demostrativos de `hospitalShellDemo` lo afirmarían;
 * - controles. Las etiquetas se dibujan como texto, no como botones: sin
 *   `type="button"`, sin manejador, sin `href`, sin `aria-current` y sin
 *   estado activo. No navegan, no cambian de vista y no montan módulo alguno.
 *
 * Que el menú se vea NO significa que se conceda nada: la autoridad sigue
 * siendo el servidor. El estado bloqueado se anuncia con texto, no con color.
 */
export function HospitalSidebarNeutral({
  etiquetaPlataforma,
}: {
  readonly etiquetaPlataforma: string;
}): ReactNode {
  return (
    <aside className={styles.sidebar} aria-label="Panel institucional">
      <div className={styles.identity}>
        <HospitalPlatformBrand etiquetaPlataforma={etiquetaPlataforma} />
      </div>
      <nav className={styles.nav} aria-label="Secciones de la experiencia Hospital">
        <p className="merdn-sr-only">
          Navegación disponible únicamente con una sesión institucional vigente.
        </p>
        <ul className={styles.navNeutralLista}>
          {HOSPITAL_NAV_ITEMS.map((item) => (
            <Fragment key={item.id}>
              {item.separadorAntes === true ? (
                <li className={styles.navSeparator} aria-hidden="true" />
              ) : null}
              {/*
               * Marcador técnico de auditoría: no es visible ni se anuncia. El
               * badge de la configuración demostrativa se omite a propósito.
               */}
              <li
                className={`${styles.navItem} ${styles.navItemBloqueado}`}
                data-hospital-nav="bloqueado"
              >
                <HospitalIcon name={item.icono} />
                {item.etiqueta}
              </li>
            </Fragment>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
