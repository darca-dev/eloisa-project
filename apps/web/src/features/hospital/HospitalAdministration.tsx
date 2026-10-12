import type { ReactNode } from 'react';

import { hospitalAdminStyles as styles } from './HospitalAdminPieces';
import { hospitalAdministracionDemo } from './hospitalAdministrationConfig';
import type {
  HospitalAdminPestanaId,
  HospitalAdministrationConfig,
} from './hospitalAdministrationConfig';
import { HospitalAudit } from './HospitalAudit';
import { HospitalAccessRequests } from './HospitalAccessRequests';
import { HospitalClinicalImport } from './HospitalClinicalImport';
import {
  HospitalAgendaSettings,
  HospitalInstitutionSettings,
} from './HospitalInstitutionSettings';
import { HospitalMemberships } from './HospitalMemberships';
import { HospitalPersonnelAccess } from './HospitalPersonnelAccess';
import { HospitalRolesPermissions } from './HospitalRolesPermissions';
import { HospitalViewHeader, hospitalViewStyles as compartido } from './HospitalViewPieces';

/**
 * Vista «Administración institucional» (TASK-003H-05, FR-01).
 *
 * Contenedor administrativo del prototipo oficial (`vConfig`, líneas 648–658).
 * Reúne las ocho vistas autorizadas en ocho pestañas locales: `Solicitudes de
 * acceso`, `Membresías`, `Historia clínica`, `Personal y accesos`, `Roles y
 * permisos`, `Agenda y servicios`, `Institución e integraciones` —que incluye
 * `Integraciones`— y `Auditoría`.
 *
 * La corrección final aprobada por la Product Owner separa `Roles y permisos`
 * de `Personal y accesos`: la primera queda como la pantalla operativa
 * cotidiana y la segunda como la lectura comprensible de cada rol. Siguen
 * siendo dos bloques del mismo contenedor; no hay ruta nueva.
 *
 * `Novedades` y `Semáforo y alertas` del prototipo quedan fuera: sus
 * experiencias aprobadas ya existen en TASK-003H-04 y TASK-003H-03 y no se
 * duplican aquí.
 *
 * Las pestañas son botones reales con su estado anunciado por `aria-pressed` y
 * el panel enlazado por `aria-controls`. Cambiar de pestaña solo monta otro
 * bloque dentro del mismo `<main>` del shell: no crea rutas, no cambia la URL,
 * no filtra, no consulta y no persiste. La pestaña activa la controla el shell,
 * de modo que se conserva mientras dura el montaje actual y se reinicia al
 * recargar.
 *
 * Alcance: presentación. Sin backend, red, persistencia, autenticación,
 * permisos reales, pagos, interoperabilidad, integraciones activas, nómina,
 * honorarios ni auditoría real.
 */

const TITULO_ID = 'hospital-administracion-titulo';
const PANEL_ID = 'hospital-administracion-panel';

/** Bloque montado dentro del contenedor. Solo uno a la vez. */
function ContenidoAdministracion({
  pestana,
  config,
  canReviewAccessRequests,
  fetchImpl,
  onSessionInvalid,
}: {
  readonly pestana: HospitalAdminPestanaId;
  readonly config: HospitalAdministrationConfig;
  readonly canReviewAccessRequests: boolean;
  readonly fetchImpl?: typeof fetch;
  readonly onSessionInvalid?: () => void;
}): ReactNode {
  switch (pestana) {
    case 'Solicitudes de acceso':
      return canReviewAccessRequests
        ? <HospitalAccessRequests fetchImpl={fetchImpl} onSessionInvalid={onSessionInvalid} />
        : <p>Esta sesión no tiene la capacidad de revisar solicitudes de acceso.</p>;
    case 'Historia clínica':
      return <HospitalClinicalImport config={config.clinica} />;
    case 'Personal y accesos':
      return <HospitalPersonnelAccess config={config.personal} />;
    case 'Roles y permisos':
      return <HospitalRolesPermissions config={config.roles} />;
    case 'Agenda y servicios':
      return <HospitalAgendaSettings config={config.agenda} />;
    case 'Institución e integraciones':
      return (
        <HospitalInstitutionSettings
          config={config.institucion}
          integraciones={config.integraciones}
        />
      );
    case 'Auditoría':
      return <HospitalAudit config={config.auditoria} />;
    case 'Membresías':
    default:
      return <HospitalMemberships config={config.membresias} />;
  }
}

export function HospitalAdministration({
  config = hospitalAdministracionDemo,
  pestana,
  onSeleccionarPestana,
  canReviewAccessRequests = false,
  fetchImpl,
  onSessionInvalid,
}: {
  readonly config?: HospitalAdministrationConfig;
  readonly pestana: HospitalAdminPestanaId;
  readonly onSeleccionarPestana: (pestana: HospitalAdminPestanaId) => void;
  readonly canReviewAccessRequests?: boolean;
  readonly fetchImpl?: typeof fetch;
  readonly onSessionInvalid?: () => void;
}): ReactNode {
  const pestanas = canReviewAccessRequests
    ? (['Solicitudes de acceso'] as const)
    : config.pestanas.filter((opcion) => opcion !== 'Solicitudes de acceso');
  const pestanaVisible = pestanas.includes(pestana as never) ? pestana : pestanas[0]!;

  return (
    <div className={compartido.view}>
      <HospitalViewHeader encabezado={canReviewAccessRequests ? {
        titulo: 'Configuración',
        descripcion: 'Gestione las solicitudes de acceso y la recuperación de cuentas personales. Las decisiones se guardan y auditan; cada operación exige autorización institucional.',
      } : config.encabezado} tituloId={TITULO_ID} />

      <div className={compartido.pills} role="group" aria-label={config.etiquetaPestanas}>
        {pestanas.map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={opcion === pestanaVisible}
            aria-controls={PANEL_ID}
            className={
              opcion === pestanaVisible
                ? `${compartido.pill} ${compartido.pillActiva} ${styles.pestana}`
                : `${compartido.pill} ${styles.pestana}`
            }
            /* Marcador técnico de auditoría: no es visible ni se anuncia. */
            data-hospital-pestana={opcion === pestanaVisible ? 'activa' : 'inactiva'}
            onClick={() => {
              onSeleccionarPestana(opcion);
            }}
          >
            {opcion}
          </button>
        ))}
      </div>

      <div id={PANEL_ID} aria-label={pestanaVisible} role="group" data-hospital-admin={pestanaVisible}>
        <ContenidoAdministracion
          pestana={pestanaVisible}
          config={config}
          canReviewAccessRequests={canReviewAccessRequests}
          fetchImpl={fetchImpl}
          onSessionInvalid={onSessionInvalid}
        />
      </div>
    </div>
  );
}
