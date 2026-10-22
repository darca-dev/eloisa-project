import { Module } from '@nestjs/common';

import { CareContextModule } from '../care-context/care-context.module';
import { HumanSessionModule } from '../human-auth/human-session.module';

import { CareAlarmEngine } from './care-alarm-engine';
import { CareCriteriaController } from './care-criteria.controller';
import { CareCriteriaService } from './care-criteria.service';

/**
 * Criterios individuales y motor de alarmas automáticas (SPEC 055 / MP04–MP05).
 * Exporta el motor para que `care-records` evalúe en la misma transacción del
 * registro.
 */
@Module({
  imports: [CareContextModule, HumanSessionModule],
  controllers: [CareCriteriaController],
  providers: [CareCriteriaService, CareAlarmEngine],
  exports: [CareAlarmEngine],
})
export class CareCriteriaModule {}
