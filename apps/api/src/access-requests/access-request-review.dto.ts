import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  ACCESS_REQUEST_DECISION_REASON_CODES,
  ACCESS_REQUEST_REVIEW_ACTIONS,
  ACCESS_REQUEST_REVIEW_DEFAULT_LIMIT,
  ACCESS_REQUEST_REVIEW_FILTER_PROFILES,
  ACCESS_REQUEST_REVIEW_FILTER_STATUSES,
  ACCESS_REQUEST_REVIEW_MAX_LIMIT,
  ACCESS_REQUEST_REVIEW_MAX_QUERY_LENGTH,
  ACCESS_REQUEST_REVIEW_MIN_LIMIT,
  type AccessRequestDecisionReasonCode,
  type AccessRequestReviewAction,
} from './access-request-review.contract';

/**
 * DTOs de la bandeja de revisión hospitalaria (SPEC 038, MP03-C1).
 *
 * Son clases explícitas y NO exponen modelos Prisma. Cada campo declara su
 * descripción, su ejemplo y su forma: la OpenAPI es la documentación de lo que
 * el servidor REALMENTE acepta, y un ejemplo que el servidor rechazaría convertiría
 * la documentación en una promesa falsa.
 *
 * Los ejemplos son FICTICIOS y se parecen lo bastante a la forma real como para
 * que un integrador pueda copiar y pegar, y lo bastante de lejos como para que no
 * describan a ninguna persona.
 */

/** Item del listado. Es la proyección MÍNIMA: no incluye documento ni contacto. */
export class AccessRequestReviewListItemDto {
  @ApiProperty({
    description:
      'Identificador OPACO de la solicitud. Es el que se usa en el detalle y en la ' +
      'decisión. No es un documento, un correo ni un nombre.',
    format: 'uuid',
    example: '0f3a5c62-9b1d-4a7e-8c10-2d5b7e9f4a13',
  })
  public requestId!: string;

  @ApiProperty({
    description:
      'Referencia OPACA mostrada al solicitante. Es un identificador de la solicitud, ' +
      'no un dato de la persona.',
    example: 'AR-9C4E1D77B0A3F5E2C8D61B40',
  })
  public reference!: string;

  @ApiProperty({
    description: 'Perfil solicitado. Catálogo cerrado; por sí solo no habilita nada.',
    enum: [...ACCESS_REQUEST_REVIEW_FILTER_PROFILES],
    example: 'CAREGIVER',
  })
  public requestedProfile!: string;

  @ApiProperty({
    description: 'Estado de negocio de la solicitud.',
    example: 'PENDING',
  })
  public status!: string;

  @ApiProperty({
    description:
      'Versión de la fila para control de concurrencia. Se reenvía como ' +
      '`expectedVersion` en la decisión; una versión vencida produce `409`.',
    example: 1,
  })
  public version!: number;

  @ApiProperty({
    description: 'Fecha de envío, fijada por el SERVIDOR. No es un valor del cliente.',
    format: 'date-time',
    example: '2026-09-20T14:05:00.000Z',
  })
  public submittedAt!: string;

  @ApiProperty({
    description: 'Nombres de la persona solicitante, tal como los declaró.',
    example: 'Ana María',
  })
  public givenNames!: string;

  @ApiProperty({
    description: 'Apellidos de la persona solicitante, tal como los declaró.',
    example: 'Restrepo-fiction',
  })
  public familyNames!: string;
}

/** Página del listado. */
export class AccessRequestReviewListDto {
  @ApiProperty({
    description: 'Solicitudes de esta página, ordenadas por `submittedAt` descendente.',
    type: [AccessRequestReviewListItemDto],
  })
  public readonly items!: readonly AccessRequestReviewListItemDto[];

  @ApiPropertyOptional({
    description:
      'Cursor opaco para pedir la página siguiente. `null` significa que NO hay ' +
      'más páginas; nunca es una cadena vacía. El servidor no acepta `offset`.',
    nullable: true,
    example: 'MjAyNi0wOS0yMFQxNDowNTowMC4wMDBafDRmM2E1YzYy',
  })
  public nextCursor!: string | null;
}

/** Detalle de una solicitud. */
export class AccessRequestReviewDetailDto extends AccessRequestReviewListItemDto {
  @ApiProperty({
    description: 'Tipo de documento declarado por la persona.',
    example: 'CC',
  })
  public documentType!: string;

  @ApiProperty({
    description:
      'Documento TAL COMO LO DECLARÓ la persona, no su forma normalizada: quien ' +
      'revisa necesita ver lo que la persona escribió para poder verificarlo.',
    example: 'CC 1.234.567',
  })
  public documentNumber!: string;

  @ApiProperty({
    description:
      'Fecha de nacimiento sin componente horario. No tiene hora, y por eso no se ' +
      'publica como marca de tiempo.',
    example: '1985-04-12',
  })
  public birthDate!: string;

  @ApiProperty({
    description: 'Sexo-género declarado por la persona.',
    example: 'F',
  })
  public sexGenderCode!: string;

  @ApiPropertyOptional({
    description: 'Teléfono declarado. `null` cuando la persona no lo proporcionó.',
    nullable: true,
    example: '+57 300 000 0000',
  })
  public phone!: string | null;

  @ApiPropertyOptional({
    description: 'Correo declarado. `null` cuando la persona no lo proporcionó.',
    nullable: true,
    example: 'ana.restrepo@example.invalid',
  })
  public email!: string | null;

  @ApiProperty({
    description:
      'Estado técnico de la PROVISIÓN, separado del estado de negocio. La saga lo ' +
      'actualiza: `NOT_STARTED` sin intento, `PENDING` durante uno, `SUCCEEDED` cuando el ' +
      'proveedor confirmó y `FAILED` cuando no.',
    enum: ['NOT_STARTED', 'PENDING', 'SUCCEEDED', 'FAILED'],
    example: 'NOT_STARTED',
  })
  public provisioningStatus!: string;

  @ApiProperty({
    description:
      'Intentos de provisión YA ejecutados. Cero si nunca se intentó. Existe para que la ' +
      'bandeja pueda ofrecer SÓLO las acciones todavía disponibles: sin él, un reintento ' +
      'agotado se ofrecería igual que uno utilizable.',
    minimum: 0,
    example: 0,
  })
  public provisioningAttempts!: number;

  @ApiPropertyOptional({
    description:
      'CÓDIGO CERRADO del último fallo de provisión, o `null` sin fallo. Nunca es un ' +
      'texto libre ni un cuerpo del proveedor: nombra una clase de fallo, no su detalle.',
    nullable: true,
    example: null,
  })
  public provisioningErrorCode!: string | null;

  @ApiPropertyOptional({
    description: 'Fecha de la decisión, fijada por el SERVIDOR. `null` si no hay decisión.',
    nullable: true,
    format: 'date-time',
    example: '2026-09-21T09:00:00.000Z',
  })
  public decidedAt!: string | null;

  @ApiPropertyOptional({
    description:
      'CÓDIGO del motivo de la decisión, del catálogo cerrado. NUNCA es un texto ' +
      'libre. `null` mientras la solicitud no tenga decisión.',
    nullable: true,
    enum: [...ACCESS_REQUEST_DECISION_REASON_CODES],
    example: 'DEMO_ELIGIBLE',
  })
  public decisionReasonCode!: string | null;
}

/** Cuerpo de la decisión. Exactamente estas claves, sin texto libre. */
export class AccessRequestReviewDecisionRequestDto {
  @ApiProperty({
    description:
      'Acción solicitada. `APPROVE` ejecuta la saga: deja `APPROVED_PENDING_PROVISIONING`, ' +
      'provisiona en el proveedor y solo entonces pasa a `APPROVED`. `RETRY_PROVISIONING` ' +
      'reintenta una provisión fallida. `SUSPEND`, `REACTIVATE` y `REVOKE` deshabilitan y ' +
      'revocan sesiones EN LA MISMA transacción de la decisión. `REJECT` cierra.',
    enum: [...ACCESS_REQUEST_REVIEW_ACTIONS],
    example: 'APPROVE',
  })
  public action!: AccessRequestReviewAction;

  @ApiProperty({
    description:
      'Versión que el cliente cree tener. Control de concurrencia optimista: si otra ' +
      'decisión ya la cambió, la respuesta es `409` y no se escribe nada.',
    example: 1,
  })
  public expectedVersion!: number;

  @ApiProperty({
    description:
      'Código del motivo. NO es libre y NO es independiente de la acción: cada acción ' +
      'exige exactamente el motivo de su catálogo, salvo `REACTIVATE` y `RETRY_PROVISIONING`, ' +
      'que no lo admiten.',
    enum: [...ACCESS_REQUEST_DECISION_REASON_CODES],
    example: 'DEMO_ELIGIBLE',
  })
  public reasonCode!: AccessRequestDecisionReasonCode;
}

/** Respuesta de la decisión, con el estado vigente resultante. */
export class AccessRequestReviewDecisionResponseDto {
  @ApiProperty({ format: 'uuid', example: '0f3a5c62-9b1d-4a7e-8c10-2d5b7e9f4a13' })
  public requestId!: string;

  @ApiProperty({ example: 'AR-9C4E1D77B0A3F5E2C8D61B40' })
  public reference!: string;

  @ApiProperty({
    description:
      'Estado resultante, releído DESPUÉS de que la saga haya terminado. Por eso ' +
      '`APPROVE` responde `APPROVED` (o `PROVISIONING_FAILED`) y no ' +
      '`APPROVED_PENDING_PROVISIONING`: ese estado intermedio solo se observa si el ' +
      'proveedor no responde.',
    example: 'APPROVED',
  })
  public status!: string;

  @ApiProperty({
    description:
      'Versión ya incrementada. La saga la incrementa DOS veces —transición y cierre—, ' +
      'de modo que una repetición acepta `version >= expectedVersion + 1`.',
    example: 2,
  })
  public version!: number;

  @ApiProperty({ enum: [...ACCESS_REQUEST_DECISION_REASON_CODES], example: 'DEMO_ELIGIBLE' })
  public decisionReasonCode!: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-21T09:00:00.000Z' })
  public decidedAt!: string;
}

/** Error cerrado de la superficie. Nunca describe la causa interna. */
export class AccessRequestReviewErrorDto {
  @ApiProperty({
    description: 'Código estable del desenlace. No describe la causa concreta.',
    example: 'ACCESS_REQUEST_REVIEW_CONFLICT',
  })
  public code!: string;

  @ApiProperty({
    description:
      'Mensaje para la persona usuaria. No revela si el recurso existe, de qué tenant ' +
      'es ni por qué se denegó.',
    example: 'La solicitud ya no puede decidirse.',
  })
  public message!: string;
}

/** Parámetros de consulta del listado, para documentarlos como allowlist. */
export const ACCESS_REQUEST_REVIEW_QUERY_API = {
  status: {
    name: 'status',
    required: false,
    enum: [...ACCESS_REQUEST_REVIEW_FILTER_STATUSES],
    example: 'PENDING' as const,
  },
  profile: {
    name: 'profile',
    required: false,
    enum: [...ACCESS_REQUEST_REVIEW_FILTER_PROFILES],
    example: 'CAREGIVER' as const,
  },
  q: {
    name: 'q',
    required: false,
    schema: { type: 'string', maxLength: ACCESS_REQUEST_REVIEW_MAX_QUERY_LENGTH },
    example: 'Restrepo',
  },
  limit: {
    name: 'limit',
    required: false,
    schema: {
      type: 'integer',
      minimum: ACCESS_REQUEST_REVIEW_MIN_LIMIT,
      maximum: ACCESS_REQUEST_REVIEW_MAX_LIMIT,
      default: ACCESS_REQUEST_REVIEW_DEFAULT_LIMIT,
    },
  },
  cursor: {
    name: 'cursor',
    required: false,
    schema: { type: 'string', maxLength: 256 },
  },
} as const;
