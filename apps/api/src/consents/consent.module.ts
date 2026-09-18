import { Module } from '@nestjs/common';

import { ConsentService } from './consent.service';

/** Consentimiento versionado de la inscripción (TASK-MVP-CORE-01 §4). */
@Module({
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
