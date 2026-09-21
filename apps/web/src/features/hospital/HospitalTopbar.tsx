import type { ReactNode } from 'react';

import styles from './hospital.module.css';
import { HospitalIcon } from './HospitalIcon';
import type { HospitalUser } from './hospitalConfig';
import { etiquetaDeRol, textoCaducidad, type HospitalSesionDto } from './hospitalInstitutionClient';

/**
 * Topbar del Shell Hospital (TASK-003H-01, FR-01, FR-04; conectada al contexto
 * de sesión por TASK-HOSPITAL-CORE-01 §4.1.11 y §10.10).
 *
 * Reproduce las líneas 84–101 del prototipo oficial: buscador y perfil. Las
 * zonas, el orden y el comportamiento de foco no cambian.
 *
 * H-FID-B (§4.3) compacta la zona de perfil y acciones —solo medidas en CSS— y
 * RETIRA la campana con su badge: el conteo procedía de la configuración
 * demostrativa y no tiene ninguna fuente real. No se sustituye por cero, por un
 * badge neutro ni por un fixture; simplemente no se afirma nada (§4.3.4, §4.3.5).
 * Los handlers de sesión, el buscador, el actor institucional, el rol efectivo,
 * la caducidad accesible y el estado de ocupado quedan exactamente igual.
 *
 * Lo que cambia es de dónde sale la identidad mostrada:
 *
 * - SIN sesión institucional resuelta, el perfil muestra la persona
 *   demostrativa de la configuración, exactamente como hasta ahora: es la
 *   superficie de demostración no autenticada;
 * - CON sesión institucional válida, el perfil deja de mostrar cualquier persona
 *   y muestra el actor IMPERSONAL y la etiqueta de rol que devuelve el servidor.
 *   La credencial institucional es COMPARTIDA por la institución y no
 *   corresponde a ninguna persona trabajadora concreta: presentarla como un
 *   nombre propio —aunque fuera ficticio— afirmaría una atribución que el
 *   sistema no puede sostener, y haría creer que el acceso queda imputado a
 *   alguien.
 *
 * El buscador no consulta, filtra ni almacena; el perfil no ofrece menú,
 * autenticación ni administración de cuenta. Por eso ninguno se implementa como
 * control interactivo: su semántica no debe sugerir funcionalidad disponible.
 */

/** Perfil visible: iniciales, nombre y rol. */
export function HospitalUserProfile({ usuario }: { readonly usuario: HospitalUser }): ReactNode {
  return (
    <div className={styles.profile}>
      <span className={styles.profileAvatar} aria-hidden="true">
        {usuario.iniciales}
      </span>
      <span className={styles.profileText}>
        <span className={styles.profileName}>{usuario.nombre}</span>
        <span className={styles.profileRole}>{usuario.rol}</span>
      </span>
    </div>
  );
}

/**
 * Perfil de una sesión institucional vigente.
 *
 * Conserva la estructura del perfil —avatar, nombre, rol— y sustituye su
 * contenido por lo único que el servidor afirma: un actor impersonal y la
 * etiqueta del rol efectivo. El avatar deja de llevar iniciales de persona.
 */
export function HospitalInstitutionalProfile({
  sesion,
}: {
  readonly sesion: HospitalSesionDto;
}): ReactNode {
  const caducidad = textoCaducidad(sesion.expiresAt);

  return (
    <div className={styles.profile} data-hospital-sesion="institucional">
      <span className={styles.profileAvatar} aria-hidden="true">
        <HospitalIcon name="configuracion" size={18} />
      </span>
      <span className={styles.profileText}>
        <span className={styles.profileName}>{sesion.actorDisplay}</span>
        <span className={styles.profileRole}>{etiquetaDeRol(sesion.role)}</span>
      </span>
      {caducidad === null ? null : <span className="merdn-sr-only">{caducidad}</span>}
    </div>
  );
}

/**
 * Acciones sobre la PROPIA sesión: cambiarla y cerrarla.
 *
 * Solo aparecen cuando hay una sesión institucional vigente. No administran
 * cuenta, no editan identidad y no conceden nada: la única capacidad que
 * ofrecen es terminar la sesión que ya existe, que es lo único que pertenece a
 * la sesión misma y no a una superficie de datos.
 *
 * `Cambiar sesión` y `Cerrar sesión` revocan igual en el servidor; se
 * distinguen únicamente en lo que la interfaz hace después: la primera deja el
 * formulario de acceso listo para otra credencial y la segunda confirma la
 * salida. Ninguna de las dos deja identidad en pantalla.
 */
export function HospitalSessionActions({
  onCambiarSesion,
  onCerrarSesion,
  ocupado = false,
}: {
  readonly onCambiarSesion: () => void;
  readonly onCerrarSesion: () => void;
  /** `true` mientras una operación de sesión está en curso. */
  readonly ocupado?: boolean;
}): ReactNode {
  return (
    <div className={styles.sesionAcciones}>
      <button
        type="button"
        className={styles.sesionBoton}
        onClick={onCambiarSesion}
        disabled={ocupado}
      >
        Cambiar sesión
      </button>
      <button
        type="button"
        className={styles.sesionBoton}
        onClick={onCerrarSesion}
        disabled={ocupado}
      >
        Cerrar sesión
      </button>
    </div>
  );
}

export function HospitalTopbar({
  usuario,
  textoBuscador,
  sesion = null,
  onCambiarSesion,
  onCerrarSesion,
  ocupado = false,
  menuAbierto = false,
  onToggleMenu,
}: {
  readonly usuario: HospitalUser;
  readonly textoBuscador: string;
  /**
   * Contexto de la sesión institucional vigente.
   *
   * `null` mientras no se ha resuelto o cuando no hay sesión: en ese caso la
   * topbar conserva el perfil demostrativo de la configuración.
   */
  readonly sesion?: HospitalSesionDto | null;
  /** Revoca la sesión y deja el acceso listo para otra credencial. */
  readonly onCambiarSesion?: () => void;
  /** Revoca la sesión y confirma la salida. */
  readonly onCerrarSesion?: () => void;
  /** `true` mientras una operación de sesión está en curso. */
  readonly ocupado?: boolean;
  /** Estado de apertura del menú lateral en pantallas móviles. */
  readonly menuAbierto?: boolean;
  /** Alterna la apertura del menú lateral en pantallas móviles. */
  readonly onToggleMenu?: () => void;
}): ReactNode {
  return (
    <header className={styles.topbar}>
      {onToggleMenu !== undefined ? (
        <button
          type="button"
          className={styles.menuHamburguesa}
          onClick={onToggleMenu}
          aria-label={menuAbierto ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          aria-expanded={menuAbierto}
          aria-controls="hospital-sidebar"
        >
          <HospitalIcon name={menuAbierto ? 'cerrar' : 'menu'} size={22} />
        </button>
      ) : null}
      <div className={styles.search}>
        <HospitalIcon name="buscar" />
        <span className={styles.searchText}>{textoBuscador}</span>
      </div>
      <div className={styles.actions}>
        {sesion === null ? (
          <HospitalUserProfile usuario={usuario} />
        ) : (
          <HospitalInstitutionalProfile sesion={sesion} />
        )}
        {sesion === null || onCambiarSesion === undefined || onCerrarSesion === undefined ? null : (
          <HospitalSessionActions
            onCambiarSesion={onCambiarSesion}
            onCerrarSesion={onCerrarSesion}
            ocupado={ocupado}
          />
        )}
      </div>
    </header>
  );
}
