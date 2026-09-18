import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { type Response } from 'express';

import { ENROLLMENT_ERROR_CODES } from './enrollment.contract';

/**
 * Sanea la respuesta ante un cuerpo JSON mal formado (TASK-MVP-CORE-01 §7).
 *
 * El analizador de cuerpo por defecto incluye en su mensaje un fragmento del
 * texto recibido. En un endpoint que transporta datos personales eso equivale a
 * devolver parte del cuerpo al cliente y a exponerlo en las trazas. Este filtro
 * lo sustituye por un mensaje estable y sin contenido.
 *
 * Solo intercepta el fallo de análisis: el resto de excepciones conserva su
 * comportamiento, incluidas las respuestas de error ya estructuradas de la API.
 */
@Catch(SyntaxError, BadRequestException)
export class MalformedJsonFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();

      // Los errores propios ya llevan código estable y mensaje seguro.
      if (typeof body === 'object' && body !== null && 'code' in body) {
        response.status(exception.getStatus()).json(body);
        return;
      }

      // Un `BadRequestException` sin código estable procede del análisis del
      // cuerpo: su mensaje puede contener fragmentos de la carga recibida.
      response.status(HttpStatus.BAD_REQUEST).json(malformedBody());
      return;
    }

    response.status(HttpStatus.BAD_REQUEST).json(malformedBody());
  }
}

function malformedBody(): Record<string, string> {
  return {
    code: ENROLLMENT_ERROR_CODES.invalidRequestBody,
    message: 'El cuerpo de la petición no es JSON válido.',
  };
}
