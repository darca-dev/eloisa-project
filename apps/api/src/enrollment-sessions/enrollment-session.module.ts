import { Module } from '@nestjs/common';

import { EnrollmentSessionService } from './enrollment-session.service';

/**
 * Sesión de inscripción (TASK-MVP-CORE-01 §4).
 *
 * No es autenticación completa: es una credencial acotada que permite a la
 * persona recién inscrita recuperar únicamente su propio registro. La
 * autenticación permanente queda expresamente fuera de alcance.
 */
@Module({
  providers: [EnrollmentSessionService],
  exports: [EnrollmentSessionService],
})
export class EnrollmentSessionModule {}
