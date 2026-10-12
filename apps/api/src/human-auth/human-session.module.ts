import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { HumanAuthService } from './human-auth.service';
import { HumanSessionGuard } from './human-session.guard';
import { HumanAuthRateLimitGuard } from './human-auth-rate-limit.guard';
import { SameOriginGuard } from './same-origin.guard';

/** Authentication primitives without a dependency on business participation modules. */
@Module({
  imports: [AuditModule],
  providers: [HumanAuthService, HumanSessionGuard, HumanAuthRateLimitGuard, SameOriginGuard],
  exports: [HumanAuthService, HumanSessionGuard, HumanAuthRateLimitGuard, SameOriginGuard],
})
export class HumanSessionModule {}
