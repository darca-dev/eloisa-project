import { ApiProperty } from '@nestjs/swagger';

import { HUMAN_CONTEXTS, type HumanContext } from './human-auth.contract';

/**
 * DTOs de la superficie HUMANA (IDENTITY-RELATIONSHIPS-CORE-01 §8.1).
 *
 * Son clases explícitas y NO exponen modelos Prisma.
 *
 * LO QUE NINGUNA RESPUESTA DEVUELVE, deliberadamente: token de sesión o su
 * hash, `tenantId`, `humanAccountId`, `personId`, `patientId`,
 * `professionalId`, `issuer`, `subject`, claims del proveedor, nombre,
 * documento, fecha de nacimiento ni datos de contacto.
 *
 * Lo único que la interfaz necesita saber es cuánto le queda de sesión y qué
 * contextos tiene disponibles. Todo lo demás lo resuelve el servidor en cada
 * operación.
 */

export class HumanSessionDto {
  @ApiProperty({
    description:
      'Momento en el que caduca la sesión de forma ABSOLUTA. No se renueva usando la ' +
      'sesión: la actividad solo desplaza la ventana de inactividad, nunca esta fecha.',
    example: '2026-08-23T20:00:00.000Z',
  })
  public expiresAt!: string;

  @ApiProperty({
    description:
      'Segundos que restan antes de que la INACTIVIDAD cierre la sesión, acotados por la ' +
      'caducidad absoluta. La sesión termina en lo que ocurra primero.',
    example: 1800,
  })
  public idleExpiresInSeconds!: number;

  @ApiProperty({
    description:
      'Contextos que la persona tiene disponibles, derivados en el SERVIDOR a partir de sus ' +
      'participaciones vivas. Un contexto disponible NO concede acceso a ningún recurso: ' +
      'cada operación posterior vuelve a evaluar perfil, afiliación, asignación y relación.',
    enum: HUMAN_CONTEXTS,
    isArray: true,
    example: ['PATIENT'],
  })
  public contexts!: HumanContext[];
}

export class HumanContextsDto {
  @ApiProperty({
    description:
      'Contextos disponibles de la persona autenticada. Se derivan server-side y el cliente ' +
      'no puede pedirlos, ampliarlos ni enviarlos. Tener el contexto CAREGIVER no dice sobre ' +
      'QUÉ paciente: eso se decide por paciente y por operación.',
    enum: HUMAN_CONTEXTS,
    isArray: true,
    example: ['PATIENT', 'CAREGIVER'],
  })
  public contexts!: HumanContext[];
}

/** Error uniforme de la superficie humana. */
export class HumanAuthErrorDto {
  @ApiProperty({
    description:
      'Código estable del desenlace. Es deliberadamente pobre en información: una denegación ' +
      'no revela si la sesión faltaba, expiró, fue revocada, si la cuenta está deshabilitada ' +
      'o si la identidad externa está siquiera aprovisionada.',
    example: 'HUMAN_SESSION_REQUIRED',
  })
  public code!: string;

  @ApiProperty({
    description: 'Mensaje breve y no descriptivo de la causa interna.',
    example: 'No hay una sesión vigente.',
  })
  public message!: string;
}
