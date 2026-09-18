import { ApiProperty } from '@nestjs/swagger';

import {
  HOSPITAL_APPOINTMENT_MODALITIES,
  HOSPITAL_APPOINTMENT_STATUSES,
  HOSPITAL_PATIENTS_SOURCE,
} from './hospital.contract';
import {
  HospitalMinimalPatientDto,
  HospitalMinimalProfessionalDto,
} from './hospital-professionals.dto';

/**
 * DTOs de la ÚNICA mutación autorizada (TASK-HOSPITAL-CORE-02 §4.2 y §6.3).
 *
 * El cuerpo admitido tiene EXACTAMENTE tres campos. `tenantId`, `identityId`,
 * `personId`, `patientId`, actor, rol, estado y versión resultante NO figuran y
 * son rechazados: el contexto institucional y el estado los resuelve el
 * servidor, y el navegador no es autoridad sobre ninguno.
 */
export class HospitalAssignmentRequestDto {
  @ApiProperty({
    description:
      'Identificador OPACO del profesional al que se asigna la solicitud. Debe pertenecer a ' +
      'la MISMA institución de la sesión, tener perfil ACTIVO y un vínculo ACTIVO.',
    format: 'uuid',
  })
  public professionalId!: string;

  @ApiProperty({
    description:
      'Instante de inicio en ISO-8601 con desplazamiento horario EXPLÍCITO. Un instante sin ' +
      'desplazamiento se interpretaría con la zona del servidor, y la hora de una cita no ' +
      'puede depender de dónde esté desplegada la aplicación. No se modela duración.',
    example: '2026-08-22T15:00:00.000Z',
  })
  public scheduledStart!: string;

  @ApiProperty({
    description:
      'Versión que la interfaz leyó. Es OBLIGATORIA: sin ella la asignación sería una ' +
      'escritura ciega y dos personas podrían asignar la misma solicitud creyendo cada una ' +
      'que fue la primera.',
    example: 1,
    minimum: 1,
  })
  public expectedVersion!: number;
}

export class HospitalAssignedAppointmentDto {
  @ApiProperty({ example: HOSPITAL_PATIENTS_SOURCE })
  public source!: string;

  @ApiProperty({ example: '2026-08-22T15:04:05.000Z' })
  public generatedAt!: string;

  @ApiProperty({ description: 'Identificador OPACO de la cita.', format: 'uuid' })
  public appointmentId!: string;

  @ApiProperty({
    description: 'Versión ya incrementada. La siguiente operación debe usar esta.',
    example: 2,
  })
  public version!: number;

  @ApiProperty({ enum: HOSPITAL_APPOINTMENT_STATUSES, example: 'ASSIGNED' })
  public status!: string;

  @ApiProperty({ enum: HOSPITAL_APPOINTMENT_MODALITIES })
  public modality!: string;

  @ApiProperty({ example: '2026-08-22T15:00:00.000Z' })
  public scheduledStart!: string;

  @ApiProperty({ type: HospitalMinimalPatientDto })
  public patient!: HospitalMinimalPatientDto;

  @ApiProperty({ type: HospitalMinimalProfessionalDto })
  public professional!: HospitalMinimalProfessionalDto;

  @ApiProperty({
    description:
      'Verdadero SOLO cuando esta operación creó el vínculo paciente-profesional. Cuando el ' +
      'vínculo ya existía se reutiliza y no se duplica: la historia no se reescribe.',
    example: true,
  })
  public careAssignmentCreated!: boolean;
}
