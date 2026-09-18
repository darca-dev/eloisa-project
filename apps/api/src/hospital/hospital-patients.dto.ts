import { ApiProperty } from '@nestjs/swagger';

import {
  HOSPITAL_AREA_TYPES,
  HOSPITAL_PATIENTS_SOURCE,
  HOSPITAL_PATIENT_STATUSES,
  HOSPITAL_POPULATION_DEFINITION_VERSION,
} from './hospital.contract';

/**
 * DTOs de la superficie hospitalaria de Pacientes
 * (TASK-HOSPITAL-CORE-01 §8).
 *
 * Son clases EXPLÍCITAS y no exponen modelos Prisma. Lo que no está declarado
 * aquí no se devuelve: `personId`, documento completo, teléfono, correo,
 * dirección exacta, indicaciones, texto libre territorial, consentimiento,
 * `tenantId`, identificadores internos y cualquier dominio clínico están
 * ausentes por construcción, no por filtrado posterior.
 */

class HospitalProvenanceDto {
  @ApiProperty({
    description:
      'Procedencia del dato. Identifica los registros persistidos de la propia plataforma. ' +
      'No es estadística oficial y no procede de ninguna EPS, de ADRES ni de ninguna historia clínica.',
    example: HOSPITAL_PATIENTS_SOURCE,
  })
  public source!: string;

  @ApiProperty({
    description:
      'Fecha de corte en UTC con la que se derivó toda edad. La fija el servidor: la interfaz ' +
      'no la calcula ni la recibe de ningún dato de demostración.',
    example: '2026-08-22',
  })
  public asOfDate!: string;

  @ApiProperty({
    description: 'Instante de generación de la respuesta.',
    example: '2026-08-22T15:04:05.000Z',
  })
  public generatedAt!: string;
}

export class HospitalPrioritiesDto {
  @ApiProperty({
    description:
      'Sesenta años o más. Se DERIVA de la fecha de nacimiento contra la fecha de corte: no ' +
      'procede de una pertenencia almacenada que pudiera haber quedado obsoleta.',
    example: true,
  })
  public older60!: boolean;

  @ApiProperty({
    description:
      'Discapacidad DECLARADA por la persona en su inscripción. No es un diagnóstico, no es una ' +
      'certificación oficial de discapacidad y no procede de ningún registro nacional.',
    example: false,
  })
  public disabilityDeclared!: boolean;

  @ApiProperty({
    description:
      'Necesidad de cuidados en casa DECLARADA por la persona. No es una valoración de ' +
      'dependencia ni una indicación clínica.',
    example: false,
  })
  public homeCareRequiredDeclared!: boolean;
}

export class HospitalTerritoryDto {
  @ApiProperty({
    description: 'Código oficial del municipio cuando el catálogo territorial lo aporta.',
    example: '05001',
    nullable: true,
  })
  public municipalityOfficialCode!: string | null;

  @ApiProperty({ description: 'Nombre del municipio canónico.', nullable: true })
  public municipalityName!: string | null;

  @ApiProperty({
    description: 'Área declarada de la dirección.',
    enum: HOSPITAL_AREA_TYPES,
    nullable: true,
  })
  public areaType!: string | null;

  @ApiProperty({
    description:
      'Barrio o vereda CANÓNICO. Es nulo cuando la localidad declarada todavía no corresponde ' +
      'a una unidad del catálogo: el texto libre declarado NUNCA se devuelve, porque publicarlo ' +
      'lo convertiría en territorio oficial.',
    nullable: true,
  })
  public localUnitName!: string | null;

  @ApiProperty({
    description:
      'La localidad declarada está pendiente de normalización. Es una métrica ADMINISTRATIVA ' +
      'del registro, no una valoración de la persona.',
    example: false,
  })
  public pendingNormalization!: boolean;
}

export class HospitalPatientListItemDto {
  @ApiProperty({
    description:
      'Identificador OPACO del paciente dentro del tenant. NUNCA es el identificador de la persona.',
    example: '019218ab-0000-7000-8000-000000000000',
  })
  public patientId!: string;

  @ApiProperty({ description: 'Nombre completo tal como debe mostrarse.' })
  public fullName!: string;

  @ApiProperty({ description: 'Iniciales derivadas del nombre.', example: 'AE' })
  public initials!: string;

  @ApiProperty({
    description:
      'Documento SIEMPRE enmascarado: tipo y últimos tres caracteres. El valor completo no sale ' +
      'del servidor en ninguna respuesta de esta superficie.',
    example: 'Cédula de ciudadanía ···812',
  })
  public documentMasked!: string;

  @ApiProperty({ description: 'Edad cumplida a la fecha de corte.', example: 76 })
  public age!: number;

  @ApiProperty({ description: 'Código de EPS del catálogo controlado.', example: 'NUEVA_EPS' })
  public epsCode!: string;

  @ApiProperty({ description: 'Nombre controlado de la EPS.', example: 'Nueva EPS' })
  public epsName!: string;

  @ApiProperty({ type: HospitalPrioritiesDto })
  public priorities!: HospitalPrioritiesDto;

  @ApiProperty({ type: HospitalTerritoryDto })
  public territory!: HospitalTerritoryDto;

  @ApiProperty({
    description: 'Estado del registro modelado por CORE-01.',
    enum: HOSPITAL_PATIENT_STATUSES,
  })
  public status!: string;

  @ApiProperty({
    description:
      'Etiqueta NO clínica del estado. Describe la situación administrativa del registro en la ' +
      'plataforma: no es un estado de salud, un triaje ni un semáforo.',
    example: 'Registro activo',
  })
  public statusLabel!: string;
}

export class HospitalPatientListDto extends HospitalProvenanceDto {
  @ApiProperty({ description: 'Página servida, ya corregida al rango existente.', example: 1 })
  public page!: number;

  @ApiProperty({ description: 'Tamaño de página aplicado.', example: 50 })
  public pageSize!: number;

  @ApiProperty({ description: 'Total de registros del conjunto filtrado.', example: 3240 })
  public totalItems!: number;

  @ApiProperty({ description: 'Total de páginas del conjunto filtrado.', example: 65 })
  public totalPages!: number;

  @ApiProperty({ type: [HospitalPatientListItemDto] })
  public items!: HospitalPatientListItemDto[];
}

export class HospitalPatientDetailDto extends HospitalProvenanceDto {
  @ApiProperty({ description: 'Identificador OPACO del paciente.' })
  public patientId!: string;

  @ApiProperty({ description: 'Nombre completo.' })
  public fullName!: string;

  @ApiProperty({ description: 'Iniciales derivadas del nombre.' })
  public initials!: string;

  @ApiProperty({ description: 'Código del tipo documental.', example: 'CEDULA_CIUDADANIA' })
  public documentType!: string;

  @ApiProperty({ description: 'Etiqueta visible del tipo documental.' })
  public documentTypeLabel!: string;

  @ApiProperty({
    description: 'Documento enmascarado. También en el detalle: el valor completo no se devuelve.',
  })
  public documentMasked!: string;

  @ApiProperty({ description: 'Fecha de nacimiento en UTC.', example: '1958-04-12' })
  public birthDate!: string;

  @ApiProperty({ description: 'Edad cumplida a la fecha de corte.' })
  public age!: number;

  @ApiProperty({ description: 'Código de EPS del catálogo controlado.' })
  public epsCode!: string;

  @ApiProperty({ description: 'Nombre controlado de la EPS.' })
  public epsName!: string;

  @ApiProperty({ type: HospitalPrioritiesDto })
  public priorities!: HospitalPrioritiesDto;

  @ApiProperty({ type: HospitalTerritoryDto })
  public territory!: HospitalTerritoryDto;

  @ApiProperty({ enum: HOSPITAL_PATIENT_STATUSES })
  public status!: string;

  @ApiProperty({ description: 'Etiqueta NO clínica del estado.' })
  public statusLabel!: string;

  @ApiProperty({
    description:
      'Disponibilidad del contacto con el permiso actual. Es un TEXTO FIJO, no un dato vacío: ' +
      'la identidad institucional compartida de este slice no demuestra necesidad individual de ' +
      'conocer teléfono ni correo, y el servidor ni siquiera los selecciona de la base.',
    example: 'No disponible con el permiso actual',
  })
  public contactAvailability!: string;
}

export class HospitalAnalyticsCellDto {
  @ApiProperty({ description: 'Clave estable de la celda.' })
  public key!: string;

  @ApiProperty({ description: 'Etiqueta visible de la celda.' })
  public label!: string;

  @ApiProperty({ description: 'Personas únicas de la celda.', example: 128 })
  public value!: number;

  @ApiProperty({
    description:
      'Porcentaje sobre el universo filtrado. Es NULO cuando el denominador es cero: no se ' +
      'escribe un cero, que se leería como un hecho.',
    example: 12.5,
    nullable: true,
  })
  public percentage!: number | null;
}

export class HospitalAnalyticsDistributionDto {
  @ApiProperty({ description: 'Identificador estable de la distribución.' })
  public id!: string;

  @ApiProperty({ description: 'Etiqueta visible de la distribución.' })
  public label!: string;

  @ApiProperty({ type: [HospitalAnalyticsCellDto] })
  public cells!: HospitalAnalyticsCellDto[];
}

export class HospitalAnalyticsIntersectionDto extends HospitalAnalyticsCellDto {
  @ApiProperty() public older60!: boolean;
  @ApiProperty() public disabilityDeclared!: boolean;
  @ApiProperty() public homeCareRequiredDeclared!: boolean;
}

export class HospitalPatientAnalyticsDto extends HospitalProvenanceDto {
  @ApiProperty({
    description: 'Versión de las definiciones métricas aplicadas.',
    example: HOSPITAL_POPULATION_DEFINITION_VERSION,
  })
  public definitionVersion!: string;

  @ApiProperty({
    description: 'Universo del tenant con el estado seleccionado, ANTES de aplicar filtros.',
    example: 3240,
  })
  public activeUniverse!: number;

  @ApiProperty({
    description: 'Universo del conjunto filtrado. Es el denominador de todo porcentaje.',
    example: 812,
  })
  public filteredUniverse!: number;

  @ApiProperty({
    description:
      'Las cuatro cifras que CORE-01 permite calcular honestamente. Son CONTEOS de los registros ' +
      'persistidos, no una medición oficial: no tienen fuente externa y no acreditan cumplimiento. ' +
      'NO incluye cuidadores, profesionales, patologías, programas, atenciones ni alertas: esos ' +
      'dominios no están modelados y su cifra no distinguiría «no tiene» de «no registrado».',
    type: [HospitalAnalyticsCellDto],
  })
  public keyFigures!: HospitalAnalyticsCellDto[];

  @ApiProperty({ type: [HospitalAnalyticsDistributionDto] })
  public distributions!: HospitalAnalyticsDistributionDto[];

  @ApiProperty({
    description:
      'Las ocho combinaciones DISJUNTAS de las tres condiciones, incluida «ninguna». Cada persona ' +
      'cae en exactamente una, de modo que su suma reconcilia el universo filtrado.',
    type: [HospitalAnalyticsIntersectionDto],
  })
  public intersections!: HospitalAnalyticsIntersectionDto[];
}

export class HospitalErrorDto {
  @ApiProperty({
    description: 'Código estable del desenlace. No describe la causa concreta.',
    example: 'HOSPITAL_PATIENT_NOT_FOUND',
  })
  public code!: string;

  @ApiProperty({
    description: 'Mensaje para la persona usuaria. No revela detalle técnico.',
    example: 'No fue posible encontrar el registro solicitado.',
  })
  public message!: string;
}
