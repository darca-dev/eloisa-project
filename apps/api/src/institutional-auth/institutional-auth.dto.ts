import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  INSTITUTIONAL_ACTOR_DISPLAY,
  INSTITUTIONAL_ROLES,
  type InstitutionalRoleCode,
} from './institutional-auth.contract';

/**
 * DTOs del acceso institucional (TASK-MUNICIPALITY-CORE-01, FR-13 y FR-14;
 * ampliados por TASK-HOSPITAL-CORE-01 §8.0).
 *
 * Son clases explícitas y NO exponen modelos Prisma. Ninguna respuesta incluye
 * el token, su hash, la credencial, el tenant, el identificador de la identidad
 * ni ningún dato personal.
 */

export class InstitutionalSignInRequestDto {
  @ApiProperty({
    description:
      'Credencial de acceso institucional aprovisionada por configuración del servidor. ' +
      'Nunca se almacena en claro, no se registra y no se devuelve en ninguna respuesta.',
    example: 'clave-ficticia-de-desarrollo-0001',
    minLength: 16,
    maxLength: 512,
  })
  public accessSecret!: string;

  @ApiPropertyOptional({
    description:
      'Código OPACO de la identidad institucional cuya credencial debe verificarse dentro del ' +
      'tenant que el servidor ya resolvió. NO transporta rol ni institución: enviarlo no ' +
      'concede ningún permiso, solo elige contra qué credencial compararse, y el rol efectivo ' +
      'se lee siempre de la identidad persistida. Omitirlo resuelve la identidad municipal ' +
      'configurada, para conservar la compatibilidad del cliente ya existente.',
    example: 'hospital-patient-viewer',
    pattern: '^[a-z0-9][a-z0-9._-]{0,63}$',
  })
  public identityCode?: string;
}

export class InstitutionalSessionDto {
  @ApiProperty({
    description:
      'Rol efectivo de la sesión institucional. El servidor no acepta un rol enviado por el cliente.',
    enum: INSTITUTIONAL_ROLES,
    example: 'MUNICIPAL_VIEWER',
  })
  public role!: InstitutionalRoleCode;

  @ApiProperty({
    description: 'Momento en el que caduca la sesión institucional.',
    example: '2026-08-22T20:00:00.000Z',
  })
  public expiresAt!: string;
}

/** Institución de la sesión vigente. Solo su nombre real está modelado. */
export class InstitutionalSessionInstitutionDto {
  @ApiProperty({
    description:
      'Nombre real del tenant institucional resuelto por el servidor. No se devuelve su ' +
      'identificador, su código, su tipo, su municipio ni su logo: nada de eso está modelado.',
    example: 'MERDN MVP',
  })
  public name!: string;
}

/**
 * Contexto de la sesión institucional vigente (TASK-HOSPITAL-CORE-01 §8.0).
 *
 * `actorDisplay` es un texto institucional FIJO e impersonal. La identidad
 * mínima es una credencial COMPARTIDA: no representa a ninguna persona
 * trabajadora concreta y este contrato no la convierte en una.
 */
export class InstitutionalSessionContextDto {
  @ApiProperty({
    description:
      'Rol efectivo de la sesión. Este endpoint NO concede acceso a ninguna superficie: ' +
      'cada dominio mantiene su propio guard con su rol exacto.',
    enum: INSTITUTIONAL_ROLES,
    example: 'HOSPITAL_PATIENT_VIEWER',
  })
  public role!: InstitutionalRoleCode;

  @ApiProperty({
    description: 'Momento en el que caduca la sesión institucional.',
    example: '2026-08-22T20:00:00.000Z',
  })
  public expiresAt!: string;

  @ApiProperty({
    description: 'Institución del tenant activo.',
    type: InstitutionalSessionInstitutionDto,
  })
  public institution!: InstitutionalSessionInstitutionDto;

  @ApiProperty({
    description:
      'Texto impersonal del actor. La credencial institucional es compartida y no identifica ' +
      'a ninguna persona trabajadora: no se devuelve un nombre propio, real ni ficticio.',
    example: INSTITUTIONAL_ACTOR_DISPLAY,
  })
  public actorDisplay!: string;
}

export class InstitutionalErrorDto {
  @ApiProperty({
    description: 'Código estable del desenlace. No describe la causa concreta.',
    example: 'INSTITUTIONAL_SESSION_REQUIRED',
  })
  public code!: string;

  @ApiProperty({
    description: 'Mensaje para la persona usuaria. No revela detalle técnico.',
    example: 'No hay una sesión institucional vigente.',
  })
  public message!: string;
}
