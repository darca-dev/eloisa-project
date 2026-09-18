import { ApiProperty } from '@nestjs/swagger';

import {
  CAREGIVER_RELATIONSHIP_PURPOSE,
  CAREGIVER_RELATIONSHIP_STATUSES,
  CAREGIVER_RELATIONSHIP_TYPE,
  CAREGIVER_REVOCATION_REASONS,
  CAREGIVER_SCOPE_VISITS_VIEW,
  CAREGIVER_VALIDATION_SOURCE,
  type CaregiverRelationshipStatus,
  type CaregiverRevocationReason,
} from './caregiver-relationship.contract';

/**
 * DTOs de la superficie de relaciones Paciente–Cuidador
 * (IDENTITY-RELATIONSHIPS-CORE-01 §8.2).
 *
 * Son clases explícitas y NO exponen modelos Prisma.
 *
 * LO QUE NINGUNA RESPUESTA DEVUELVE, deliberadamente: `tenantId`,
 * `authorizationReference`, identidad institucional validadora o revocadora,
 * nombre, documento, contacto o fecha de nacimiento de ninguna de las dos
 * personas. La referencia de autorización es un soporte documental que no
 * pertenece a la respuesta, y los identificadores de identidad institucional
 * describirían la estructura interna del aprovisionamiento.
 */

export class CaregiverRelationshipCreateRequestDto {
  @ApiProperty({
    description:
      'Identificador OPACO del paciente. Debe pertenecer al tenant que el servidor ya ' +
      'resolvió; un identificador de otra institución produce el mismo 404 que uno inexistente.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000001',
  })
  public patientId!: string;

  @ApiProperty({
    description:
      'Identificador OPACO de la PERSONA cuidadora. No es una cuenta ni un paciente: la ' +
      'relación se declara contra la persona. No puede ser la propia persona del paciente.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000002',
  })
  public caregiverPersonId!: string;

  @ApiProperty({
    description:
      'Inicio de la vigencia, como instante ISO-8601 con desplazamiento horario EXPLÍCITO. ' +
      'Sin desplazamiento, la hora dependería de dónde esté desplegada la aplicación.',
    example: '2026-08-23T12:00:00.000Z',
  })
  public startsAt!: string;

  @ApiProperty({
    description:
      'Fin de la vigencia, o null para declarar una vigencia abierta. El campo es OBLIGATORIO: ' +
      'omitirlo dejaría al servidor decidiendo la duración de una autorización sobre datos de ' +
      'otra persona. Una vigencia terminada deniega el acceso aunque el estado siga siendo ACTIVE.',
    nullable: true,
    example: '2026-12-31T23:59:59.000Z',
  })
  public endsAt!: string | null;

  @ApiProperty({
    description:
      'Referencia OPACA del soporte de la autorización. Forma cerrada de 1 a 100 caracteres en ' +
      'mayúsculas, dígitos y separadores. NUNCA texto libre y NUNCA datos personales: no se ' +
      'devuelve en ninguna respuesta y no se registra en la auditoría.',
    pattern: '^[A-Z0-9][A-Z0-9._:-]{0,99}$',
    example: 'SOPORTE-2026-000123',
  })
  public authorizationReference!: string;
}

export class CaregiverRelationshipActivateRequestDto {
  @ApiProperty({
    description:
      'Versión que quien opera cree vigente. Es OBLIGATORIA y no tiene valor por defecto: sin ' +
      'ella la escritura sería ciega y el control optimista dejaría de proteger nada.',
    minimum: 1,
    example: 1,
  })
  public expectedVersion!: number;
}

export class CaregiverRelationshipRevokeRequestDto {
  @ApiProperty({
    description: 'Versión que quien opera cree vigente. Obligatoria.',
    minimum: 1,
    example: 2,
  })
  public expectedVersion!: number;

  @ApiProperty({
    description:
      'Motivo de la revocación, del catálogo CERRADO. No admite texto libre: un motivo escrito ' +
      'por una persona acabaría conteniendo datos personales.',
    enum: CAREGIVER_REVOCATION_REASONS,
    example: 'AUTHORIZATION_WITHDRAWN',
  })
  public reason!: CaregiverRevocationReason;
}

export class CaregiverRelationshipDto {
  @ApiProperty({
    description: 'Identificador OPACO de la relación.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000010',
  })
  public relationshipId!: string;

  @ApiProperty({
    description: 'Identificador OPACO del paciente.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000001',
  })
  public patientId!: string;

  @ApiProperty({
    description: 'Identificador OPACO de la persona cuidadora.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000002',
  })
  public caregiverPersonId!: string;

  @ApiProperty({
    description:
      'Tipo de relación, fijado por el servidor. El catálogo es CERRADO y esta relación NO ' +
      'representa representación legal, tutela ni parentesco.',
    enum: [CAREGIVER_RELATIONSHIP_TYPE],
    example: CAREGIVER_RELATIONSHIP_TYPE,
  })
  public relationshipType!: typeof CAREGIVER_RELATIONSHIP_TYPE;

  @ApiProperty({
    description:
      'Finalidad, fijada por el servidor. Es la única autorizada y no habilita uso clínico, ' +
      'financiero, jurídico ni de exportación.',
    enum: [CAREGIVER_RELATIONSHIP_PURPOSE],
    example: CAREGIVER_RELATIONSHIP_PURPOSE,
  })
  public purpose!: typeof CAREGIVER_RELATIONSHIP_PURPOSE;

  @ApiProperty({
    description:
      'Estado de la relación. REVOKED y EXPIRED son TERMINALES: reautorizar crea un episodio ' +
      'nuevo y no reabre la historia.',
    enum: CAREGIVER_RELATIONSHIP_STATUSES,
    example: 'PENDING_VALIDATION',
  })
  public status!: CaregiverRelationshipStatus;

  @ApiProperty({ description: 'Inicio de la vigencia.', example: '2026-08-23T12:00:00.000Z' })
  public startsAt!: string;

  @ApiProperty({
    description: 'Fin de la vigencia, o null si es abierta.',
    nullable: true,
    example: null,
  })
  public endsAt!: string | null;

  @ApiProperty({
    description:
      'Procedencia de la validación. Declara EXPLÍCITAMENTE que es una aserción de operador en ' +
      'un MVP controlado: no es verificación de identidad, no es autorización legal y no ' +
      'acredita representación de la persona paciente.',
    enum: [CAREGIVER_VALIDATION_SOURCE],
    example: CAREGIVER_VALIDATION_SOURCE,
  })
  public validationSource!: typeof CAREGIVER_VALIDATION_SOURCE;

  @ApiProperty({
    description: 'Momento de la validación, o null si aún no se validó.',
    nullable: true,
    example: null,
  })
  public validatedAt!: string | null;

  @ApiProperty({
    description: 'Momento de la revocación, o null si no se revocó.',
    nullable: true,
    example: null,
  })
  public revokedAt!: string | null;

  @ApiProperty({
    description: 'Motivo de la revocación, o null si no se revocó.',
    enum: CAREGIVER_REVOCATION_REASONS,
    nullable: true,
    example: null,
  })
  public revocationReason!: CaregiverRevocationReason | null;

  @ApiProperty({
    description:
      'Versión del control optimista. Debe reenviarse como expectedVersion en la siguiente ' +
      'mutación.',
    minimum: 1,
    example: 1,
  })
  public version!: number;

  @ApiProperty({
    description:
      'Alcances concedidos. En este slice es EXACTAMENTE VISITS_VIEW, de SOLO LECTURA. No ' +
      'existe comodín, VISITS_CONTRIBUTE ni VISITS_EXECUTE para una persona cuidadora, y no ' +
      'hay ningún endpoint que permita conceder otro.',
    enum: [CAREGIVER_SCOPE_VISITS_VIEW],
    isArray: true,
    example: [CAREGIVER_SCOPE_VISITS_VIEW],
  })
  public scopes!: (typeof CAREGIVER_SCOPE_VISITS_VIEW)[];
}

/** Error uniforme de la superficie de relaciones. */
export class CaregiverRelationshipErrorDto {
  @ApiProperty({
    description:
      'Código estable del desenlace. El 404 es IDÉNTICO para inexistente y para pertenencia a ' +
      'otra institución: distinguirlos confirmaría la existencia de un registro ajeno.',
    example: 'CAREGIVER_RELATIONSHIP_NOT_FOUND',
  })
  public code!: string;

  @ApiProperty({
    description: 'Mensaje breve y no descriptivo de la causa interna.',
    example: 'No fue posible encontrar la relación indicada.',
  })
  public message!: string;
}
