import { Module } from '@nestjs/common';

import { CareContextModule } from '../care-context/care-context.module';
import { CareCriteriaModule } from '../care-criteria/care-criteria.module';
import { HumanSessionModule } from '../human-auth/human-session.module';

import { CareRecordsController } from './care-records.controller';
import { CareRecordsService } from './care-records.service';

/** Bitácoras persistentes de cuidado (SPEC 055 / MP02) sobre la custodia de MP01. */
@Module({
  imports: [CareContextModule, HumanSessionModule, CareCriteriaModule],
  controllers: [CareRecordsController],
  providers: [CareRecordsService],
})
export class CareRecordsModule {}
