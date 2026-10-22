import { Module } from '@nestjs/common';

import { CareContextModule } from '../care-context/care-context.module';
import { HumanSessionModule } from '../human-auth/human-session.module';

import { CareAlertsController } from './care-alerts.controller';
import { CareAlertsService } from './care-alerts.service';

/** Alarmas manuales y su seguimiento (SPEC 055 / MP03) sobre la custodia de MP01. */
@Module({
  imports: [CareContextModule, HumanSessionModule],
  controllers: [CareAlertsController],
  providers: [CareAlertsService],
})
export class CareAlertsModule {}
