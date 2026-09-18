import type { ReactNode, Ref } from 'react';

import { fechaHoraLegible } from './hospitalAgendaConfig';
import styles from './hospitalProfessionals.module.css';
import type { HospitalProfessionalsCopy } from './hospitalProfessionalsConfig';
import type {
  HospitalCitaProfesionalDto,
  HospitalPacienteMinimoDto,
  HospitalProfesionalDetalleDto,
} from './hospitalProfessionalsClient';
import {
  estadoCita,
  estadoPerfil,
  etiquetaProfesion,
  modalidadCita,
  textoVentana,
} from './hospitalProfessionalsListado';
import { ProfessionalEngagementPanel } from './ProfessionalEngagementPanel';
import {
  HospitalBadge,
  HospitalCard,
  hospitalViewStyles as compartido,
} from './HospitalViewPieces';

/**
 * Panel de detalle del profesional, ya CONECTADO
 * (TASK-HOSPITAL-CORE-02 §3.1; paquete de continuación §3.1.2).
 *
 * QUÉ CAMBIÓ. El panel componía sus tres bloques derivando personas, agenda,
 * disponibilidad, conflictos y calificación de los fixtures de «Pacientes»,
 * «Visitas domiciliarias» y «Consultas virtuales». Ahora recibe el DTO de
 * `GET /api/v1/hospital/professionals/:id` y publica exclusivamente lo que ese
 * DTO contiene.
 *
 * En consecuencia han desaparecido de esta superficie:
 *
 * - la disponibilidad inferida y el aviso de conflicto de agenda, que la
 *   plataforma no calcula y que se leían como una afirmación operativa;
 * - la calificación, en cualquier forma;
 * - la muestra de personas derivada de otras vistas, sustituida por quienes
 *   tienen una asignación de cuidado ACTIVA según el servidor;
 * - las acciones con apariencia operativa, que ahora se muestran deshabilitadas
 *   y con su ayuda accesible declarada.
 *
 * RECUPERACIÓN VISUAL (HOSPITAL-VISUAL-RECOVERY-01-B). El panel conserva su
 * cabecera de identidad y su estructura de agenda —que existe únicamente porque
 * la respuesta trae la ventana consultada y sus citas—, y pierde la tira de
 * métricas que repetía las cifras de la referencia original: pacientes
 * asignados, citas de hoy, próxima cita y calificación. Ninguna de ellas
 * describe una capacidad que esta superficie ofrezca, y todas se leían como una
 * afirmación sobre el desempeño de una persona. Las personas a cargo y las
 * citas siguen publicándose una por una, tal y como llegan.
 *
 * Alcance: presentación. El panel no consulta nada por su cuenta —la vista le
 * entrega el DTO ya servido—, no muta, no navega y no abre expedientes.
 * Aparecer aquí NO acredita necesidad individual de conocer ni concede acceso a
 * información clínica.
 */

/** Identificador estable del panel; destino de `aria-controls`. */
export const HOSPITAL_DETALLE_PANEL_ID = 'hospital-profesionales-detalle';

const TITULO_ID = `${HOSPITAL_DETALLE_PANEL_ID}-titulo`;
const PACIENTES_ID = `${HOSPITAL_DETALLE_PANEL_ID}-pacientes`;
const AGENDA_ID = `${HOSPITAL_DETALLE_PANEL_ID}-agenda`;

/** Persona con asignación de cuidado ACTIVA. Sin acciones y sin datos clínicos. */
function PacienteFila({ paciente }: { readonly paciente: HospitalPacienteMinimoDto }): ReactNode {
  return (
    <li className={styles.pacienteFila}>
      <span className={styles.iniciales} aria-hidden="true">
        {paciente.initials}
      </span>
      <div className={styles.pacienteTextos}>
        <span className={styles.pacienteNombre}>{paciente.fullName}</span>
      </div>
    </li>
  );
}

/** Cita registrada en la ventana que consultó el SERVIDOR. */
function CitaFila({
  cita,
  sinHora,
}: {
  readonly cita: HospitalCitaProfesionalDto;
  readonly sinHora: string;
}): ReactNode {
  const modalidad = modalidadCita(cita.modality);
  const estado = estadoCita(cita.status);

  return (
    <li className={styles.atencion}>
      <span className={styles.atencionHora}>
        {cita.scheduledStart === null ? sinHora : fechaHoraLegible(cita.scheduledStart)}
      </span>
      <span className={styles.atencionTextos}>
        <span className={styles.atencionPaciente}>{cita.patient.fullName}</span>
        <span className={styles.atencionMeta}>{modalidad.etiqueta}</span>
      </span>
      <HospitalBadge tono={estado.tono} className={styles.atencionEstado}>
        {estado.etiqueta}
      </HospitalBadge>
    </li>
  );
}

export function ProfessionalDetailPanel({
  detalle,
  copy,
  onCerrar,
  referencia,
}: {
  readonly detalle: HospitalProfesionalDetalleDto;
  readonly copy: HospitalProfessionalsCopy;
  readonly onCerrar: () => void;
  readonly referencia?: Ref<HTMLElement>;
}): ReactNode {
  const perfil = estadoPerfil(detalle.status);
  const panel = copy.panel;

  return (
    <HospitalCard
      gap={16}
      id={HOSPITAL_DETALLE_PANEL_ID}
      className={styles.panel}
      aria-labelledby={TITULO_ID}
      ref={referencia}
      tabIndex={-1}
    >
      <div className={styles.panelCabecera}>
        <span className={styles.iniciales} aria-hidden="true">
          {detalle.initials}
        </span>
        <div className={styles.panelTextos}>
          <h2 className={styles.panelTitulo} id={TITULO_ID}>
            {detalle.fullName}
          </h2>
          <p className={styles.panelMeta}>
            {etiquetaProfesion(detalle.professionCode, detalle.professionName)}
          </p>
          <p className={styles.panelEtiquetas}>
            <HospitalBadge tono={perfil.tono} className={styles.pacienteBadge}>
              {perfil.etiqueta}
            </HospitalBadge>
          </p>
        </div>
        <button
          type="button"
          className={`${compartido.button} ${compartido.buttonNeutro} ${styles.panelCerrar}`}
          onClick={onCerrar}
        >
          {panel.cerrar}
        </button>
      </div>

      <section className={styles.bloque} aria-labelledby={PACIENTES_ID}>
        <div className={styles.bloqueCabecera}>
          <h3 className={styles.bloqueTitulo} id={PACIENTES_ID}>
            {panel.tituloPacientes}
          </h3>
        </div>

        {detalle.assignedPatients.length === 0 ? (
          <p className={styles.bloqueVacio}>{panel.vacioPacientes}</p>
        ) : (
          <ul className={styles.pacientes} aria-label={panel.tituloPacientes}>
            {detalle.assignedPatients.map((paciente) => (
              <PacienteFila key={paciente.patientId} paciente={paciente} />
            ))}
          </ul>
        )}

        <p className={styles.bloqueNota}>{panel.notaPacientes}</p>
      </section>

      <section className={styles.bloque} aria-labelledby={AGENDA_ID}>
        <div className={styles.bloqueCabecera}>
          <h3 className={styles.bloqueTitulo} id={AGENDA_ID}>
            {panel.tituloAgenda}
          </h3>
          {/*
           * Ventana que consultó el servidor, rotulada: sin ella, la lista de
           * citas no diría a qué periodo corresponde.
           */}
          <p className={styles.bloqueConteo}>
            {`${panel.etiquetaVentana}: ${textoVentana(detalle.window)}`}
          </p>
        </div>

        {detalle.appointments.length === 0 ? (
          <p className={styles.bloqueVacio}>{panel.vacioAgenda}</p>
        ) : (
          <ul className={styles.atenciones} aria-label={panel.tituloAgenda}>
            {detalle.appointments.map((cita) => (
              <CitaFila key={cita.appointmentId} cita={cita} sinHora={panel.sinHora} />
            ))}
          </ul>
        )}
      </section>

      <ProfessionalEngagementPanel vinculo={detalle.activeAffiliation} copy={panel} />
    </HospitalCard>
  );
}
