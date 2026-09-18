import { ApiProperty } from '@nestjs/swagger';

import {
  HOSPITAL_AFFILIATION_STATUSES,
  HOSPITAL_APPOINTMENT_MODALITIES,
  HOSPITAL_APPOINTMENT_STATUSES,
  HOSPITAL_ENGAGEMENT_TYPES,
  HOSPITAL_OPERATIONS_UNAVAILABLE,
  HOSPITAL_PATIENTS_SOURCE,
  HOSPITAL_PROFESSIONAL_STATUSES,
  HOSPITAL_PROFESSION_CODES,
} from './hospital.contract';

/**
 * DTOs del directorio hospitalario de Profesionales
 * (TASK-HOSPITAL-CORE-02 §6.1).
 *
 * Son clases EXPLÍCITAS y no exponen modelos Prisma. Lo que no está declarado
 * aquí no se devuelve: `personId`, documento —tampoco enmascarado—, teléfono,
 * correo, dirección, fecha de nacimiento, `tenantId`, calificación numérica,
 * disponibilidad, salario, honorarios y documentos están ausentes por
 * construcción, no por filtrado posterior.
 */

export class HospitalMinimalPatientDto {
  @ApiProperty({
    description: 'Identificador OPACO del paciente. NUNCA es `personId`.',
    format: 'uuid',
  })
  public patientId!: string;

  @ApiProperty({ description: 'Nombre completo mostrable.' })
  public fullName!: string;

  @ApiProperty({
    description: 'Iniciales de presentación. No son un identificador.',
    example: 'AE',
  })
  public initials!: string;
}

export class HospitalMinimalProfessionalDto {
  @ApiProperty({
    description: 'Identificador OPACO del profesional. NUNCA es `personId`.',
    format: 'uuid',
  })
  public professionalId!: string;

  @ApiProperty({ description: 'Nombre completo mostrable.' })
  public fullName!: string;

  @ApiProperty({ description: 'Iniciales de presentación.', example: 'MC' })
  public initials!: string;

  @ApiProperty({
    description:
      'Código de profesión del catálogo controlado por el servidor. No procede de RETHUS ' +
      'ni de ninguna autoridad sanitaria y no acredita habilitación.',
    enum: HOSPITAL_PROFESSION_CODES,
  })
  public professionCode!: string;

  @ApiProperty({ description: 'Nombre controlado de la profesión.' })
  public professionName!: string;
}

export class HospitalAffiliationDto {
  @ApiProperty({
    description:
      'Tipo de vínculo operativo DECLARADO. No acredita relación laboral, contrato, nómina, ' +
      'honorarios, habilitación ni documento verificado.',
    enum: HOSPITAL_ENGAGEMENT_TYPES,
  })
  public engagementType!: string;

  @ApiProperty({
    description: 'Estado del vínculo declarado.',
    enum: HOSPITAL_AFFILIATION_STATUSES,
  })
  public status!: string;

  @ApiProperty({ description: 'Inicio declarado del vínculo.', example: '2026-01-15' })
  public startsOn!: string;

  @ApiProperty({
    description: 'Fin declarado del vínculo, cuando lo tiene.',
    example: '2026-12-31',
    nullable: true,
  })
  public endsOn!: string | null;
}

export class HospitalProfessionalListItemDto extends HospitalMinimalProfessionalDto {
  @ApiProperty({
    description:
      'Estado del PERFIL en la institución. NO es disponibilidad, NO es turno y NO es ' +
      'habilitación: solo dice si el perfil sigue vigente.',
    enum: HOSPITAL_PROFESSIONAL_STATUSES,
  })
  public status!: string;

  @ApiProperty({
    description: 'Vínculo ACTIVO vigente, o nulo cuando no hay ninguno registrado.',
    type: HospitalAffiliationDto,
    nullable: true,
  })
  public activeAffiliation!: HospitalAffiliationDto | null;

  @ApiProperty({
    description:
      'Personas con asignación de cuidado ACTIVA. Es un conteo de lo REGISTRADO: no es ' +
      'capacidad, no es carga máxima y no mide desempeño.',
    example: 4,
  })
  public activePatientCount!: number;

  @ApiProperty({
    description:
      'Citas no canceladas cuyo inicio cae en el día UTC de la consulta. Es actividad ' +
      'REGISTRADA, no ocupación ni jornada.',
    example: 2,
  })
  public todayAppointmentCount!: number;

  @ApiProperty({
    description:
      'Primera cita asignada a partir del instante de la consulta. Es la siguiente cita ' +
      'REGISTRADA, NO la siguiente hora disponible: la plataforma no modela disponibilidad.',
    example: '2026-08-22T15:00:00.000Z',
    nullable: true,
  })
  public nextAppointmentAt!: string | null;

  @ApiProperty({
    description:
      'Texto FIJO de indisponibilidad. La plataforma no modela calificaciones y una cifra ' +
      'aquí sería inventada; un cero se leería, además, como una mala calificación.',
    example: HOSPITAL_OPERATIONS_UNAVAILABLE.rating,
  })
  public ratingAvailability!: string;
}

class HospitalOperationsProvenanceDto {
  @ApiProperty({
    description:
      'Procedencia del dato. Identifica los registros persistidos de la propia plataforma. ' +
      'No es estadística oficial y no procede de ninguna EPS, de ADRES ni de ninguna ' +
      'historia clínica.',
    example: HOSPITAL_PATIENTS_SOURCE,
  })
  public source!: string;

  @ApiProperty({
    description: 'Instante de generación de la respuesta.',
    example: '2026-08-22T15:04:05.000Z',
  })
  public generatedAt!: string;
}

export class HospitalProfessionalListDto extends HospitalOperationsProvenanceDto {
  @ApiProperty({ description: 'Página efectivamente servida.', example: 1 })
  public page!: number;

  @ApiProperty({ description: 'Tamaño de página aplicado.', example: 25 })
  public pageSize!: number;

  @ApiProperty({ description: 'Total de profesionales del conjunto filtrado.', example: 12 })
  public totalItems!: number;

  @ApiProperty({ description: 'Total de páginas del conjunto filtrado.', example: 1 })
  public totalPages!: number;

  @ApiProperty({ type: [HospitalProfessionalListItemDto] })
  public items!: HospitalProfessionalListItemDto[];
}

export class HospitalAgendaWindowDto {
  @ApiProperty({ description: 'Primer día UTC de la ventana.', example: '2026-08-01' })
  public from!: string;

  @ApiProperty({ description: 'Último día UTC de la ventana, inclusive.', example: '2026-08-31' })
  public to!: string;
}

export class HospitalScheduledAppointmentDto {
  @ApiProperty({ description: 'Identificador OPACO de la cita.', format: 'uuid' })
  public appointmentId!: string;

  @ApiProperty({ type: HospitalMinimalPatientDto })
  public patient!: HospitalMinimalPatientDto;

  @ApiProperty({
    description:
      'Clasificación de AGENDA. No abre Visitas domiciliarias ni Consultas virtuales, no ' +
      'habilita videollamada y no describe desplazamiento.',
    enum: HOSPITAL_APPOINTMENT_MODALITIES,
  })
  public modality!: string;

  @ApiProperty({ enum: HOSPITAL_APPOINTMENT_STATUSES })
  public status!: string;

  @ApiProperty({
    description: 'Instante de inicio. NO se modela duración ni solapamiento.',
    example: '2026-08-22T15:00:00.000Z',
    nullable: true,
  })
  public scheduledStart!: string | null;
}

export class HospitalProfessionalDetailDto extends HospitalProfessionalListItemDto {
  @ApiProperty({
    description: 'Procedencia del dato.',
    example: HOSPITAL_PATIENTS_SOURCE,
  })
  public source!: string;

  @ApiProperty({ example: '2026-08-22T15:04:05.000Z' })
  public generatedAt!: string;

  @ApiProperty({
    description:
      'Ventana efectivamente consultada, ya normalizada por el servidor. Por defecto es el ' +
      'día actual del SERVIDOR: el reloj del navegador no decide qué registros se leen.',
    type: HospitalAgendaWindowDto,
  })
  public window!: HospitalAgendaWindowDto;

  @ApiProperty({
    description:
      'Pacientes de las asignaciones ACTIVAS. Aparecer aquí NO acredita necesidad ' +
      'individual de conocer ni concede acceso a información clínica.',
    type: [HospitalMinimalPatientDto],
  })
  public assignedPatients!: HospitalMinimalPatientDto[];

  @ApiProperty({ type: [HospitalScheduledAppointmentDto] })
  public appointments!: HospitalScheduledAppointmentDto[];
}

export class HospitalOperationsErrorDto {
  @ApiProperty({
    description: 'Código estable del desenlace. No describe la causa concreta.',
    example: 'HOSPITAL_PROFESSIONAL_NOT_FOUND',
  })
  public code!: string;

  @ApiProperty({
    description: 'Mensaje para la persona usuaria. No revela detalle técnico.',
    example: 'No fue posible encontrar el profesional indicado.',
  })
  public message!: string;
}
