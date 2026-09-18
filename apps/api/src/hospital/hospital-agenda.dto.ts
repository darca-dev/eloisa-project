import { ApiProperty } from '@nestjs/swagger';

import {
  HOSPITAL_APPOINTMENT_MODALITIES,
  HOSPITAL_PATIENTS_SOURCE,
} from './hospital.contract';
import {
  HospitalAgendaWindowDto,
  HospitalMinimalPatientDto,
  HospitalMinimalProfessionalDto,
  HospitalScheduledAppointmentDto,
} from './hospital-professionals.dto';

/**
 * DTOs de la Agenda hospitalaria (TASK-HOSPITAL-CORE-02 §6.2).
 *
 * La agenda publica EXACTAMENTE lo que hay persistido en la ventana solicitada.
 * No devuelve detalle clínico, dirección, solicitante, motivo, pago, alerta,
 * cuidador ni copy de demostración, y un día sin filas cuenta cero en lugar de
 * mostrar un calendario de ejemplo.
 */

export class HospitalAgendaRequestDto {
  @ApiProperty({ description: 'Identificador OPACO de la solicitud.', format: 'uuid' })
  public appointmentId!: string;

  @ApiProperty({
    description:
      'Versión vigente de la solicitud. La asignación la exige para el control optimista: ' +
      'reenviar una versión anterior NO repite la operación, la rechaza.',
    example: 1,
  })
  public version!: number;

  @ApiProperty({ type: HospitalMinimalPatientDto })
  public patient!: HospitalMinimalPatientDto;

  @ApiProperty({ enum: HOSPITAL_APPOINTMENT_MODALITIES })
  public modality!: string;

  @ApiProperty({
    description: 'Instante en que se registró la solicitud.',
    example: '2026-08-20T09:00:00.000Z',
  })
  public requestedAt!: string;
}

export class HospitalAgendaAppointmentDto extends HospitalScheduledAppointmentDto {
  @ApiProperty({ type: HospitalMinimalProfessionalDto })
  public professional!: HospitalMinimalProfessionalDto;
}

export class HospitalAgendaDayCountDto {
  @ApiProperty({ description: 'Día UTC de la ventana.', example: '2026-08-22' })
  public date!: string;

  @ApiProperty({
    description:
      'Citas asignadas registradas ese día. Un cero significa exactamente «ninguna cita ' +
      'registrada»: nunca se sustituye por un promedio ni por una estimación.',
    example: 0,
  })
  public total!: number;
}

export class HospitalAgendaModalityCountDto {
  @ApiProperty({ enum: HOSPITAL_APPOINTMENT_MODALITIES })
  public modality!: string;

  @ApiProperty({ example: 0 })
  public total!: number;
}

export class HospitalAgendaViewDto {
  @ApiProperty({ example: HOSPITAL_PATIENTS_SOURCE })
  public source!: string;

  @ApiProperty({ example: '2026-08-22T15:04:05.000Z' })
  public generatedAt!: string;

  @ApiProperty({
    description: 'Ventana solicitada, ya validada. Máximo 31 días inclusivos.',
    type: HospitalAgendaWindowDto,
  })
  public window!: HospitalAgendaWindowDto;

  @ApiProperty({
    description:
      'Solicitudes pendientes de asignación. NO se acotan por la ventana: una solicitud ' +
      'todavía no tiene fecha, y filtrarla por un periodo la haría desaparecer sin motivo.',
    type: [HospitalAgendaRequestDto],
  })
  public requests!: HospitalAgendaRequestDto[];

  @ApiProperty({
    description:
      'Profesionales con perfil ACTIVO y vínculo ACTIVO. «Asignable» significa exactamente ' +
      'eso: NO significa disponible, porque la plataforma no modela disponibilidad.',
    type: [HospitalMinimalProfessionalDto],
  })
  public assignableProfessionals!: HospitalMinimalProfessionalDto[];

  @ApiProperty({ type: [HospitalAgendaAppointmentDto] })
  public appointments!: HospitalAgendaAppointmentDto[];

  @ApiProperty({
    description:
      'Un conteo por CADA día de la ventana, incluidos los días sin citas: así un día ' +
      'ausente no puede confundirse con un día no consultado.',
    type: [HospitalAgendaDayCountDto],
  })
  public dailyCounts!: HospitalAgendaDayCountDto[];

  @ApiProperty({ type: [HospitalAgendaModalityCountDto] })
  public modalityCounts!: HospitalAgendaModalityCountDto[];

  @ApiProperty({
    description: 'Total de citas asignadas dentro de la ventana.',
    example: 0,
  })
  public totalAppointments!: number;
}
