import { ApiProperty } from '@nestjs/swagger';

import {
  MUNICIPALITY_AGGREGATE_SOURCE,
  OFFICIAL_METRIC_KEYS,
  type OfficialMetricKey,
} from './municipality.contract';
import { SUPPRESSED_DISPLAY } from './suppression';

/**
 * DTOs de los agregados municipales (TASK-MUNICIPALITY-CORE-01, sección
 * «API and DTO Contract»).
 *
 * Son clases explícitas y NO exponen modelos Prisma. Ninguna propiedad contiene
 * identificador de paciente o de persona, nombre, documento, teléfono, correo,
 * fecha de nacimiento, edad individual, dirección exacta, indicaciones, texto
 * territorial declarado sin verificar, historia clínica ni consentimiento.
 *
 * Estos DTOs describen el contrato en OpenAPI; la construcción real de la
 * respuesta vive en `population-summary.ts` y `territory-summary.ts`, que son
 * funciones puras y verificables.
 */

export class SuppressedCountDto {
  @ApiProperty({
    description:
      'Estado del conteo. `EXACT` publica el número; `SUPPRESSED` protege un grupo pequeño. ' +
      'La regla se aplica en el servidor: 0 exacto, de 1 a 4 suprimido y 5 o más exacto.',
    enum: ['EXACT', 'SUPPRESSED'],
    example: 'EXACT',
  })
  public status!: 'EXACT' | 'SUPPRESSED';

  @ApiProperty({
    description:
      'Conteo exacto, o nulo cuando está suprimido. El valor real de un grupo pequeño ' +
      'no se serializa en ningún otro campo, porcentaje, total complementario ni mensaje.',
    type: Number,
    nullable: true,
    example: 12,
  })
  public value!: number | null;

  @ApiProperty({
    description: 'Representación visible ya formateada.',
    example: SUPPRESSED_DISPLAY,
  })
  public display!: string;
}

export class PopulationCountsDto {
  @ApiProperty({
    description:
      'Personas de 60 años o más, derivadas de la fecha de nacimiento contra la fecha de corte.',
    type: SuppressedCountDto,
  })
  public olderAdult60Plus!: SuppressedCountDto;

  @ApiProperty({
    description:
      'Personas con discapacidad DECLARADA en la inscripción. No es una certificación oficial.',
    type: SuppressedCountDto,
  })
  public disabilityDeclared!: SuppressedCountDto;

  @ApiProperty({
    description:
      'Personas que declararon requerir cuidado en casa. Es una declaración, no una valoración.',
    type: SuppressedCountDto,
  })
  public homeCareRequiredDeclared!: SuppressedCountDto;
}

export class ExclusiveIntersectionsDto {
  @ApiProperty({ type: SuppressedCountDto })
  public olderOnly!: SuppressedCountDto;

  @ApiProperty({ type: SuppressedCountDto })
  public disabilityOnly!: SuppressedCountDto;

  @ApiProperty({ type: SuppressedCountDto })
  public homeCareOnly!: SuppressedCountDto;

  @ApiProperty({ type: SuppressedCountDto })
  public olderAndDisabilityOnly!: SuppressedCountDto;

  @ApiProperty({ type: SuppressedCountDto })
  public olderAndHomeCareOnly!: SuppressedCountDto;

  @ApiProperty({ type: SuppressedCountDto })
  public disabilityAndHomeCareOnly!: SuppressedCountDto;

  @ApiProperty({ type: SuppressedCountDto })
  public allThree!: SuppressedCountDto;
}

export class OfficialMetricDto {
  @ApiProperty({
    description: 'Métrica que exigiría una fuente oficial externa.',
    enum: OFFICIAL_METRIC_KEYS,
    example: 'municipalTotalPopulation',
  })
  public metric!: OfficialMetricKey;

  @ApiProperty({
    description:
      'Siempre `UNAVAILABLE`: la plataforma no dispone de la fuente y no la sustituye ' +
      'por un dato de ejemplo, una estimación ni un cero.',
    enum: ['UNAVAILABLE'],
    example: 'UNAVAILABLE',
  })
  public status!: 'UNAVAILABLE';

  @ApiProperty({
    description: 'Siempre nulo mientras no exista fuente oficial conectada.',
    type: Number,
    nullable: true,
    example: null,
  })
  public value!: null;
}

export class PopulationQualityDto {
  @ApiProperty({
    description:
      'Personas registradas cuya localidad declarada todavía no corresponde a una unidad ' +
      'territorial canónica. Es una métrica administrativa del registro.',
    type: SuppressedCountDto,
  })
  public territoryPendingNormalization!: SuppressedCountDto;
}

export class PopulationSummaryDto {
  @ApiProperty({
    description:
      'Procedencia de la cifra: registros persistidos de la propia plataforma. ' +
      'No es una estadística oficial municipal, departamental ni nacional.',
    enum: [MUNICIPALITY_AGGREGATE_SOURCE],
    example: MUNICIPALITY_AGGREGATE_SOURCE,
  })
  public source!: string;

  @ApiProperty({
    description: 'Fecha de corte en UTC con la que se derivó la edad cumplida.',
    example: '2026-08-22',
  })
  public asOfDate!: string;

  @ApiProperty({
    description: 'Momento en el que se calculó la respuesta.',
    example: '2026-08-22T14:05:00.000Z',
  })
  public generatedAt!: string;

  @ApiProperty({
    description:
      'Beneficiarios únicos registrados. Quien cumple varias condiciones cuenta una sola vez.',
    type: SuppressedCountDto,
  })
  public uniqueRegistered!: SuppressedCountDto;

  @ApiProperty({ type: PopulationCountsDto })
  public populations!: PopulationCountsDto;

  @ApiProperty({
    description:
      'Las siete combinaciones EXCLUSIVAS: cada persona cae exactamente en una región.',
    type: ExclusiveIntersectionsDto,
  })
  public exclusiveIntersections!: ExclusiveIntersectionsDto;

  @ApiProperty({ type: OfficialMetricDto, isArray: true })
  public officialMetrics!: OfficialMetricDto[];

  @ApiProperty({ type: PopulationQualityDto })
  public quality!: PopulationQualityDto;
}

/* -------------------------------------------------------------------------- */
/* Territorio                                                                  */
/* -------------------------------------------------------------------------- */

export class TerritoryMetricsDto {
  @ApiProperty({ type: SuppressedCountDto })
  public uniquePeople!: SuppressedCountDto;

  @ApiProperty({ type: SuppressedCountDto })
  public olderAdult60Plus!: SuppressedCountDto;

  @ApiProperty({ type: SuppressedCountDto })
  public disabilityDeclared!: SuppressedCountDto;

  @ApiProperty({ type: SuppressedCountDto })
  public homeCareRequiredDeclared!: SuppressedCountDto;

  @ApiProperty({
    description:
      'Personas cuya localidad declarada todavía no corresponde a una unidad canónica.',
    type: SuppressedCountDto,
  })
  public pendingNormalization!: SuppressedCountDto;
}

export class TerritoryLocalUnitDto {
  @ApiProperty({
    description:
      'Identificador OPACO de la unidad territorial canónica. Describe territorio, ' +
      'nunca a una persona. Es nulo en el nodo de registros pendientes.',
    type: String,
    nullable: true,
    example: null,
  })
  public localUnitId!: string | null;

  @ApiProperty({
    description:
      'Naturaleza del nodo. `PENDING_NORMALIZATION` agrupa los registros sin unidad ' +
      'canónica; su texto declarado no se devuelve y no se convierte en territorio oficial.',
    enum: ['CANONICAL', 'PENDING_NORMALIZATION'],
    example: 'PENDING_NORMALIZATION',
  })
  public kind!: 'CANONICAL' | 'PENDING_NORMALIZATION';

  @ApiProperty({
    description: 'Nombre normalizado de exhibición.',
    example: 'Pendiente de normalización territorial',
  })
  public displayName!: string;

  @ApiProperty({ type: TerritoryMetricsDto })
  public metrics!: TerritoryMetricsDto;
}

export class TerritoryAreaDto {
  @ApiProperty({ enum: ['URBAN', 'RURAL'], example: 'URBAN' })
  public areaType!: 'URBAN' | 'RURAL';

  @ApiProperty({ type: TerritoryMetricsDto })
  public metrics!: TerritoryMetricsDto;

  @ApiProperty({ type: TerritoryLocalUnitDto, isArray: true })
  public localUnits!: TerritoryLocalUnitDto[];
}

export class TerritoryMunicipalityDto {
  @ApiProperty({
    description: 'Código oficial del municipio tomado del catálogo territorial.',
    type: String,
    nullable: true,
    example: '05001',
  })
  public officialCode!: string | null;

  @ApiProperty({ example: 'Medellín' })
  public displayName!: string;

  @ApiProperty({ type: TerritoryMetricsDto })
  public metrics!: TerritoryMetricsDto;

  @ApiProperty({ type: TerritoryAreaDto, isArray: true })
  public areas!: TerritoryAreaDto[];
}

export class TerritorySummaryDto {
  @ApiProperty({
    enum: [MUNICIPALITY_AGGREGATE_SOURCE],
    example: MUNICIPALITY_AGGREGATE_SOURCE,
  })
  public source!: string;

  @ApiProperty({ example: '2026-08-22' })
  public asOfDate!: string;

  @ApiProperty({ example: '2026-08-22T14:05:00.000Z' })
  public generatedAt!: string;

  @ApiProperty({
    description: 'Jerarquía Municipio → Urbana/Rural → Barrio o vereda canónico.',
    type: TerritoryMunicipalityDto,
    isArray: true,
  })
  public municipalities!: TerritoryMunicipalityDto[];
}

export class MunicipalityErrorDto {
  @ApiProperty({
    description: 'Código estable del desenlace. No confirma la existencia de datos.',
    example: 'INSTITUTIONAL_SESSION_REQUIRED',
  })
  public code!: string;

  @ApiProperty({
    description: 'Mensaje para la persona usuaria. No revela detalle técnico.',
    example: 'No hay una sesión institucional vigente.',
  })
  public message!: string;
}
