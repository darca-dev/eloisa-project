import type { ReactNode } from 'react';

import styles from './hospitalVisits.module.css';
import { hospitalVisitasDemoLocal } from './hospitalVisitsDemoLocal';
import {
  HospitalBadge,
  HospitalCard,
  HospitalCardHeader,
  HospitalChips,
  HospitalEstadoResumen,
  HospitalNote,
  HospitalViewHeader,
  hospitalViewStyles as compartido,
} from './HospitalViewPieces';

const TITULO_ID = 'hospital-visitas-demo-titulo';
const LISTA_ID = 'hospital-visitas-demo-lista';

/**
 * Bandeja visual exclusiva del modo demo local.
 *
 * No recibe una visita materializada, no consulta `fetch`, no monta sesión
 * humana y no expone transiciones. La pantalla operativa permanece en
 * `HospitalHomeVisits` para cualquier montaje fuera de demo.
 */
export function HospitalHomeVisitsDemo(): ReactNode {
  const config = hospitalVisitasDemoLocal;

  return (
    <div className={compartido.view} data-hospital-visitas-demo-local="true">
      <HospitalViewHeader encabezado={config.encabezado} tituloId={TITULO_ID} />

      <HospitalChips
        items={config.filtros}
        etiquetaAccesible="Criterios informativos de la muestra local de visitas"
      />

      <HospitalEstadoResumen
        items={config.estados}
        etiquetaAccesible="Resumen operativo de las cinco visitas ficticias"
      />

      <HospitalCard className={compartido.listaCard} aria-labelledby={LISTA_ID}>
        <HospitalCardHeader
          titulo="Agenda de visitas de muestra"
          tituloId={LISTA_ID}
          nota="5 registros ficticios"
        />
        <ul className={compartido.lista} aria-label="Cinco visitas domiciliarias ficticias">
          {config.visitas.map((visita) => (
            <li className={compartido.fila} key={visita.id}>
              <span className={styles.fecha}>{visita.fecha}</span>
              <span className={styles.textos}>
                <span className={styles.paciente}>{visita.persona}</span>
                <span className={styles.zona}>{visita.zona}</span>
              </span>
              <span className={styles.profesional}>{visita.profesional}</span>
              <HospitalBadge tono={visita.tono} className={styles.estado}>
                {visita.estado}
              </HospitalBadge>
            </li>
          ))}
        </ul>
      </HospitalCard>

      <HospitalNote>
        Datos ficticios de demostración local. No se guardan cambios ni se acredita atención
        domiciliaria.
      </HospitalNote>
    </div>
  );
}
