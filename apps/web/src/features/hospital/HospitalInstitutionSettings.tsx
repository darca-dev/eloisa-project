import { useState, type ReactNode } from 'react';

import { AdminAccion, AdminAviso, hospitalAdminStyles as styles } from './HospitalAdminPieces';
import type {
  HospitalAdminCampo,
  HospitalAgendaParametrosConfig,
  HospitalInstitucionDatosConfig,
  HospitalIntegracionesConfig,
} from './hospitalAdministrationConfig';
import {
  HospitalBadge,
  HospitalCard,
  HospitalCardHeader,
  HospitalNote,
} from './HospitalViewPieces';

/**
 * Configuración institucional e integraciones (TASK-003H-05, FR-07 y FR-08).
 *
 * Reproduce `Agenda y servicios` (prototipo, líneas 862–875 y 1285–1297),
 * `Datos de la institución` con su ranura de logo (líneas 905–921 y 1305–1313)
 * y el patrón de tarjetas de integración (líneas 922–935).
 *
 * Alcance: presentación. Los campos se editan solo en estado local efímero,
 * igual que el `campo(k, def)` del prototipo: nada se guarda, nada se publica,
 * nada cambia la Agenda y citas ya aprobada y todo vuelve al valor demostrativo
 * al recargar. `Cargar` no abre selector ni almacena archivo.
 *
 * Las reglas clínicas de `Semáforo y alertas` del prototipo (líneas 877–903)
 * quedan expresamente fuera: la experiencia aprobada es `Semáforo de alarmas`
 * (TASK-003H-03) y cualquier regla clínica futura requiere validación separada.
 *
 * Ninguna integración está conectada, configurada ni sincronizada. No hay
 * credenciales, tokens, endpoints, SDK, iframes, scripts, OAuth, enlaces de
 * conexión ni llamadas de red, y MERDN no afirma convenio, disponibilidad,
 * intercambio, aval institucional ni cumplimiento con ninguna entidad.
 */

const AGENDA_ID = 'hospital-admin-agenda';
const INSTITUCION_ID = 'hospital-admin-institucion';
const INTEGRACIONES_ID = 'hospital-admin-integraciones';

/**
 * Cuadrícula de campos editables en estado local efímero.
 *
 * El estado vive solo en esta pantalla montada: no se comparte con otra
 * pestaña, no muta el fixture, no se guarda y desaparece al recargar o al
 * cambiar de pestaña.
 */
function CamposEditables({
  campos,
  prefijo,
  etiquetaAccesible,
}: {
  readonly campos: readonly HospitalAdminCampo[];
  readonly prefijo: string;
  readonly etiquetaAccesible: string;
}): ReactNode {
  const [editados, setEditados] = useState<Readonly<Record<string, string>>>({});

  return (
    <div className={styles.formulario} role="group" aria-label={etiquetaAccesible}>
      {campos.map((campo) => {
        const id = `${prefijo}-${campo.id}`;

        return (
          <div className={styles.campo} key={campo.id}>
            <label className={styles.campoEtiqueta} htmlFor={id}>
              {campo.etiqueta}
            </label>
            <input
              className={styles.campoControl}
              id={id}
              type="text"
              value={editados[campo.id] ?? campo.valor}
              onChange={(evento) => {
                const valor = evento.target.value;

                setEditados((actual) => ({ ...actual, [campo.id]: valor }));
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Pestaña «Agenda y servicios»: parámetros operativos demostrativos. */
export function HospitalAgendaSettings({
  config,
}: {
  readonly config: HospitalAgendaParametrosConfig;
}): ReactNode {
  return (
    <div className={styles.panel}>
      <HospitalCard gap={16} aria-labelledby={AGENDA_ID}>
        <HospitalCardHeader
          titulo={config.titulo}
          tituloId={AGENDA_ID}
          nota={config.descripcion}
        />
        <CamposEditables
          campos={config.campos}
          prefijo={AGENDA_ID}
          etiquetaAccesible={config.titulo}
        />
        <HospitalNote>{config.nota}</HospitalNote>
      </HospitalCard>
    </div>
  );
}

/** Catálogo visual de integraciones futuras. Ninguna aparece como activa. */
export function HospitalIntegrations({
  config,
}: {
  readonly config: HospitalIntegracionesConfig;
}): ReactNode {
  return (
    <HospitalCard gap={16} aria-labelledby={INTEGRACIONES_ID}>
      <HospitalCardHeader
        titulo={config.titulo}
        tituloId={INTEGRACIONES_ID}
        nota={config.descripcion}
      />
      <AdminAviso atencion>{config.aviso}</AdminAviso>
      <ul className={styles.integraciones}>
        {config.items.map((integracion) => (
          <li
            className={styles.integracion}
            key={integracion.id}
            /* Marcador técnico de auditoría: no es visible ni se anuncia. */
            data-hospital-integracion={integracion.estado}
          >
            <span className={styles.integracionTextos}>
              <span className={styles.integracionNombre}>{integracion.nombre}</span>
              <span className={styles.integracionDetalle}>{integracion.detalle}</span>
            </span>
            <HospitalBadge tono={integracion.tono} className={styles.integracionEstado}>
              {integracion.estado}
            </HospitalBadge>
          </li>
        ))}
      </ul>
      <HospitalNote>{config.nota}</HospitalNote>
    </HospitalCard>
  );
}

/** Pestaña «Institución e integraciones». */
export function HospitalInstitutionSettings({
  config,
  integraciones,
}: {
  readonly config: HospitalInstitucionDatosConfig;
  readonly integraciones: HospitalIntegracionesConfig;
}): ReactNode {
  return (
    <div className={styles.panel}>
      <HospitalCard gap={16} aria-labelledby={INSTITUCION_ID}>
        <HospitalCardHeader
          titulo={config.titulo}
          tituloId={INSTITUCION_ID}
          nota={config.descripcion}
        />
        <CamposEditables
          campos={config.campos}
          prefijo={INSTITUCION_ID}
          etiquetaAccesible={config.titulo}
        />
        <div className={`${styles.marcoPunteado} ${styles.marcoNeutro}`}>
          <span className={styles.marcoTitulo}>{config.logo.etiqueta}</span>
          <AdminAccion accion={config.logo.accion} tamano="pildora" />
        </div>
        <HospitalNote>{config.nota}</HospitalNote>
      </HospitalCard>

      <HospitalIntegrations config={integraciones} />
    </div>
  );
}
