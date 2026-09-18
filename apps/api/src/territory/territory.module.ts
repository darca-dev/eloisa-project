import { Module } from '@nestjs/common';

import { TerritoryService } from './territory.service';

/**
 * Territorio canónico (TASK-MVP-CORE-01 §4).
 *
 * CORE-01 solo necesita resolver y validar unidades existentes. No expone API
 * de administración territorial ni permite crear unidades desde una inscripción.
 */
@Module({
  providers: [TerritoryService],
  exports: [TerritoryService],
})
export class TerritoryModule {}
