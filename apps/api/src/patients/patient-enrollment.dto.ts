import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  AREA_TYPE_CODES,
  DECLARABLE_POPULATION_CODES,
  DOCUMENT_TYPE_CODES,
  ENROLLMENT_ERROR_CODES,
  LOCAL_UNIT_PENDING_NORMALIZATION,
  POPULATION_CODES,
  SEX_GENDER_CODES,
} from './enrollment.contract';
import { EPS_CATALOG } from './enrollment.catalogs';

/**
 * Representaciones OpenAPI de la inscripción (TASK-MVP-CORE-01 §6).
 *
 * Estas clases DOCUMENTAN el contrato. La validación efectiva la realiza
 * `enrollment.validation.ts`, que aplica allowlist estricta y distingue fallo de
 * forma (`400`) de fallo semántico (`422`).
 *
 * Los ejemplos usan únicamente datos ficticios.
 */

export class EnrollmentTerritoryDto {
  @ApiProperty({
    description: 'Código oficial DIVIPOLA del departamento, de dos dígitos.',
    example: '05',
  })
  public readonly departmentCode!: string;

  @ApiProperty({
    description:
      'Código oficial DIVIPOLA del municipio, de cinco dígitos. Sus dos primeros dígitos deben corresponder al departamento.',
    example: '05001',
  })
  public readonly municipalityCode!: string;

  @ApiProperty({
    description:
      'Identificador de la unidad local (barrio o vereda) del catálogo controlado del tenant, o la constante que declara la localidad pendiente de normalización. Un texto libre nunca crea una unidad territorial.',
    example: LOCAL_UNIT_PENDING_NORMALIZATION,
  })
  public readonly localUnitId!: string;

  @ApiPropertyOptional({
    description:
      'Barrio o vereda declarado por la persona. Obligatorio cuando la localidad queda pendiente de normalización. No es territorio oficial.',
    example: 'La Esperanza',
  })
  public readonly localityDeclaredText?: string;

  @ApiPropertyOptional({
    description:
      'Corregimiento declarado por la persona. Texto no canónico y pendiente de validación administrativa posterior.',
    example: 'San Cristóbal',
  })
  public readonly settlementDeclaredText?: string;

  @ApiProperty({
    description:
      'Área urbana o rural declarada por la persona. Obligatoria: el servidor no la infiere. Si además se indica una unidad local canónica, ambas deben concordar.',
    enum: AREA_TYPE_CODES,
  })
  public readonly areaType!: string;

  @ApiProperty({
    description:
      'Dirección exacta. Dato personal sensible: no aparece en logs, en agregados municipales ni en las respuestas generales de la API.',
    example: 'Cra 45 # 32-16',
  })
  public readonly exactAddress!: string;

  @ApiPropertyOptional({
    description: 'Indicaciones para llegar. Opcional y minimizado.',
    example: 'Casa azul detrás de la iglesia.',
  })
  public readonly directions?: string;
}

export class PatientEnrollmentRequestDto {
  @ApiProperty({ enum: DOCUMENT_TYPE_CODES })
  public readonly documentType!: string;

  @ApiProperty({
    description:
      'Número de documento tal como lo declara la persona. El servidor lo normaliza según el tipo documental antes de comprobar la unicidad.',
    example: '1234567890',
  })
  public readonly documentNumber!: string;

  @ApiProperty({ example: 'Ana María' })
  public readonly givenNames!: string;

  @ApiProperty({ example: 'Ejemplo Ficticio' })
  public readonly familyNames!: string;

  @ApiProperty({
    description:
      'Fecha de nacimiento en formato AAAA-MM-DD. No puede ser futura. La edad no se envía ni se persiste: el servidor la deriva.',
    example: '1958-04-12',
  })
  public readonly birthDate!: string;

  @ApiProperty({ enum: SEX_GENDER_CODES })
  public readonly sexGenderCode!: string;

  @ApiProperty({ example: '311 220 3355' })
  public readonly phone!: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico. Opcional.',
    example: 'ana.ejemplo@correo.ficticio',
  })
  public readonly email?: string;

  @ApiProperty({
    description: 'Código del catálogo de EPS controlado por el servidor.',
    enum: EPS_CATALOG.map((entry) => entry.code),
  })
  public readonly epsCode!: string;

  @ApiProperty({
    description:
      'Poblaciones declaradas. La pertenencia de 60 años o más no se declara: la deriva el servidor desde la fecha de nacimiento. Son datos declarados, no diagnósticos ni certificaciones oficiales.',
    isArray: true,
    enum: DECLARABLE_POPULATION_CODES,
  })
  public readonly declaredPopulations!: string[];

  @ApiProperty({ type: EnrollmentTerritoryDto })
  public readonly territory!: EnrollmentTerritoryDto;

  @ApiProperty({
    description:
      'Aceptación de la versión vigente del consentimiento mostrado por la interfaz. El servidor asigna versión, finalidad y fecha de aceptación.',
    example: true,
  })
  public readonly consentAccepted!: boolean;
}

export class PatientPopulationDto {
  @ApiProperty({ enum: POPULATION_CODES })
  public readonly populationType!: string;

  @ApiProperty({ enum: ['DECLARED', 'DERIVED_BIRTH_DATE'] })
  public readonly source!: string;
}

export class PatientTerritoryDto {
  @ApiProperty({ example: '05' })
  public readonly departmentCode!: string;

  @ApiProperty({ example: 'ANTIOQUIA' })
  public readonly departmentName!: string;

  @ApiProperty({ example: '05001' })
  public readonly municipalityCode!: string;

  @ApiProperty({ example: 'MEDELLÍN' })
  public readonly municipalityName!: string;

  @ApiProperty({
    nullable: true,
    description: 'Nombre de la unidad local canónica; nulo si no hay ninguna.',
    example: null,
  })
  public readonly localityName!: string | null;

  @ApiProperty({
    description:
      'Indica que la localidad declarada no corresponde a una unidad canónica y queda pendiente de normalización administrativa.',
    example: true,
  })
  public readonly localityPendingNormalization!: boolean;

  @ApiProperty({ enum: AREA_TYPE_CODES, example: 'URBAN' })
  public readonly areaType!: string;
}

export class PatientSummaryDto {
  @ApiProperty({ enum: ['ACTIVE'] })
  public readonly status!: string;

  @ApiProperty({ example: '2026-08-21T15:04:05.000Z' })
  public readonly enrolledAt!: string;

  @ApiProperty({ example: 'Ana María' })
  public readonly givenNames!: string;

  @ApiProperty({ example: 'Ejemplo Ficticio' })
  public readonly familyNames!: string;

  @ApiProperty({
    description:
      'Edad derivada de la fecha de nacimiento en la fecha de consulta. No se persiste.',
    example: 68,
  })
  public readonly age!: number;

  @ApiProperty({ type: PatientPopulationDto, isArray: true })
  public readonly populations!: PatientPopulationDto[];

  @ApiProperty({ type: PatientTerritoryDto })
  public readonly territory!: PatientTerritoryDto;

  @ApiProperty({ example: 'NUEVA_EPS' })
  public readonly epsCode!: string;

  @ApiProperty({ example: 'Nueva EPS' })
  public readonly epsName!: string;
}

export class ApiErrorDto {
  @ApiProperty({ enum: Object.values(ENROLLMENT_ERROR_CODES) })
  public readonly code!: string;

  @ApiProperty({
    description: 'Mensaje seguro para el usuario. Nunca contiene datos personales.',
  })
  public readonly message!: string;

  @ApiPropertyOptional({
    description:
      'Nombres de los campos con problema. Nunca incluye los valores recibidos.',
    isArray: true,
    type: String,
  })
  public readonly fields?: string[];
}
