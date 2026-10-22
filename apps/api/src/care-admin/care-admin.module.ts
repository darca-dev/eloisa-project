import { Module } from '@nestjs/common';

import { CareContextModule } from '../care-context/care-context.module';
import { HumanSessionModule } from '../human-auth/human-session.module';

import { CareAdminController } from './care-admin.controller';
import { CareAdminService } from './care-admin.service';

/** Administración de permisos de cuidado por el gestor (SPEC 055 / MP05b). */
@Module({
  imports: [CareContextModule, HumanSessionModule],
  controllers: [CareAdminController],
  providers: [CareAdminService],
})
export class CareAdminModule {}
