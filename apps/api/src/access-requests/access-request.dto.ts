import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DOCUMENT_TYPE_CODES, SEX_GENDER_CODES } from '../patients/enrollment.contract';

import { ACCESS_REQUEST_ERROR_CODES, REQUESTED_PROFILE_CODES } from './access-request.contract';

/**
 * Representaciones OpenAPI de la solicitud de acceso (SPEC 038; MP02-C1, ampliado por MP04).
 *
 * Estas clases DOCUMENTAN el contrato cerrado. La validación efectiva NO ocurre
 * aquí: la aplica `access-request.validation.ts`, que rechaza cualquier clave no
 * declarada. Escribir un DTO sin ese filtro permitiría que la documentación
 * aceptara un campo que el servidor rechaza, o peor, que pareciera admitir
 * `tenantId`, `status` o cualquier otro valor que el cliente no debe elegir.
 *
 * `password` SÍ se documenta desde MP04 porque el servidor SÍ la acepta. Su
 * descripción declara exactamente qué se hace con ella y, sobre todo, qué NO se
 * hace: no se persiste, no se devuelve, no se audita y no aparece en errores.
 *
 * Los ejemplos son ficticios por decisión de entorno: un despliegue funcional no
 * debe poder presentar datos de ejemplo como si fueran de una persona real.
 */

/** Cuerpo cerrado de `POST /api/v1/access-requests`. */
export class AccessRequestSubmissionDto {
  @ApiProperty({
    description:
      'Perfil que la persona declara querer. Solo eligen el perfil: el servidor no ' +
      'crea ningún perfil, ni de paciente, ni de cuidador, ni de profesional.',
    enum: REQUESTED_PROFILE_CODES,
    example: 'PATIENT',
  })
  public readonly requestedProfile!: string;

  @ApiProperty({
    description: 'Tipo documental. Se reutiliza el catálogo ya cerrado de la inscripción.',
    enum: DOCUMENT_TYPE_CODES,
    example: 'CEDULA_CIUDADANIA',
  })
  public readonly documentType!: string;

  @ApiProperty({
    description:
      'Documento tal como lo declara la persona. El servidor lo normaliza según el ' +
      'tipo documental antes de buscar una persona existente. Si ya hay una solicitud ' +
      'abierta para esa persona y ese perfil, se devuelve la misma referencia y NO se ' +
      'crea una segunda fila.',
    example: '900000001',
  })
  public readonly documentNumber!: string;

  @ApiProperty({
    description: 'Nombres declarados. Dato personal: no aparece en logs ni en auditoría.',
    example: 'Ana María',
  })
  public readonly givenNames!: string;

  @ApiProperty({ example: 'Ejemplo Ficticio' })
  public readonly familyNames!: string;

  @ApiProperty({
    description:
      'Fecha de nacimiento en formato AAAA-MM-DD. No puede ser futura. No es una fecha ' +
      'clínica y no habilita ningún servicio.',
    example: '1958-04-12',
  })
  public readonly birthDate!: string;

  @ApiProperty({
    description: 'Sexo/género declarado. No es una categoría clínica ni un diagnóstico.',
    enum: SEX_GENDER_CODES,
    example: 'FEMENINO',
  })
  public readonly sexGenderCode!: string;

  @ApiPropertyOptional({
    description: 'Teléfono de contacto. Al menos uno de `phone` o `email` es obligatorio.',
    example: '311 220 3355',
  })
  public readonly phone?: string;

  @ApiPropertyOptional({
    description: 'Correo de contacto. Al menos uno de `phone` o `email` es obligatorio.',
    example: 'ana.ejemplo@correo.ficticio',
  })
  public readonly email?: string;

  @ApiProperty({
    description:
      'Contraseña FICTICIA con la que la persona iniciará sesión después, contra el realm ' +
      'local. Obligatoria, entre 8 y 72 caracteres, con al menos una letra y un dígito y sin ' +
      'caracteres de control. El servidor la conserva únicamente durante la llamada que ' +
      'crea el usuario deshabilitado en el proveedor: no la persiste, no la devuelve, no la ' +
      'registra en auditoría y no aparece en ningún mensaje de error.',
    minLength: 8,
    maxLength: 72,
    example: 'claveFicticia7',
  })
  public readonly password!: string;
}

/** Respuesta `202` de la creación idempotente. Contiene tres campos y nada más. */
export class AccessRequestAcceptedDto {
  @ApiProperty({
    description:
      'Referencia opaca emitida por el servidor. Es el único dato devuelto: no incluye ' +
      'documento, nombres, contacto, identificadores internos ni información de otro tenant. ' +
      'El ejemplo cumple el formato vigente `^AR-[0-9A-F]{24}$`, que es el mismo que acepta ' +
      'el cliente web: un ejemplo imposible enseñaría a consumir una referencia que el ' +
      'servidor nunca emite.',
    example: 'AR-3F9C1D0B7A6E5248C1B0D2E9',
  })
  public readonly reference!: string;

  @ApiProperty({
    description:
      'Estado vigente de la solicitud. Este paquete solo emite `PENDING`; los estados ' +
      'posteriores pertenecen a paquetes de decisión ya aprobados.',
    enum: ['PENDING'],
    example: 'PENDING',
  })
  public readonly status!: string;

  @ApiProperty({
    description:
      'Origen de la solicitud. Fijo en `TEST_DATA` por decisión de entorno: estos registros ' +
      'son ficticios y el servidor no puede presentarlos como producción.',
    enum: ['TEST_DATA'],
    example: 'TEST_DATA',
  })
  public readonly source!: string;
}

/** Error del endpoint. El `message` nunca contiene datos personales. */
export class AccessRequestErrorDto {
  @ApiProperty({ enum: Object.values(ACCESS_REQUEST_ERROR_CODES) })
  public readonly code!: string;

  @ApiProperty({ description: 'Mensaje seguro para el usuario. Nunca contiene datos personales.' })
  public readonly message!: string;

  @ApiPropertyOptional({
    description:
      'Nombres de los campos con problema. Nunca incluye los valores recibidos, y su ' +
      'presencia no permite distinguir «campo vacío» de «campo desconocido».',
    isArray: true,
    type: String,
  })
  public readonly fields?: string[];
}
