import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { careRequestContext, decodeContextCursor, pageLimit, toCareHttpError } from '../care-context/care-request';
import { CARE_BASE_PATH } from '../care-records/care-records.contract';
import { HumanAuthRateLimitGuard } from '../human-auth/human-auth-rate-limit.guard';
import { HumanSessionGuard, type RequestWithHumanSession } from '../human-auth/human-session.guard';
import { SameOriginGuard } from '../human-auth/same-origin.guard';

import { type CriterionView, type ReviewQueuePage, type SemaphoreView } from './care-criteria.contract';
import { parseCriterionInput, parseRetireInput } from './care-criteria.request';
import { CareCriteriaService } from './care-criteria.service';

/**
 * Criterios individuales, semáforo y cola de revisión (SPEC 055 / MP04–MP05).
 * Sesión humana en todas las rutas; mismo origen y límite de abuso en las
 * escrituras. El servidor decide cada acción sobre el contexto solicitado.
 */
@ApiTags('care-criteria')
@Controller(CARE_BASE_PATH)
@UseGuards(HumanSessionGuard)
export class CareCriteriaController {
  constructor(@Inject(CareCriteriaService) private readonly criteria: CareCriteriaService) {}

  @Get('review-queue')
  @ApiOperation({ operationId: 'getCareReviewQueue', summary: 'Página de contextos que la cuenta revisa, con sus alarmas abiertas' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor opaco devuelto por la página anterior' })
  @ApiQuery({ name: 'limit', required: false, description: 'Contextos candidatos por página (1 a 50)' })
  public async reviewQueue(
    @Req() request: RequestWithHumanSession,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<ReviewQueuePage> {
    return this.handle(() => this.criteria.reviewQueue(careRequestContext(request), decodeContextCursor(cursor), pageLimit(limit)));
  }

  @Get('contexts/:contextId/criteria')
  @ApiOperation({ operationId: 'listCareCriteria', summary: 'Criterios individuales del contexto' })
  public async list(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
  ): Promise<readonly CriterionView[]> {
    return this.handle(() => this.criteria.list(careRequestContext(request), contextId));
  }

  @Post('contexts/:contextId/criteria')
  @HttpCode(201)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'createCareCriterion', summary: 'Valida un criterio individual o una versión nueva' })
  public async create(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Body() body: unknown,
  ): Promise<CriterionView> {
    return this.handle(() => {
      const context = careRequestContext(request);
      return this.criteria.createVersion(context, contextId, parseCriterionInput(body, context.now));
    });
  }

  @Post('contexts/:contextId/criteria/:criterionId/retire')
  @HttpCode(200)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'retireCareCriterion', summary: 'Retira un criterio sin cerrar sus alarmas abiertas' })
  public async retire(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Param('criterionId') criterionId: string,
    @Body() body: unknown,
  ): Promise<CriterionView> {
    return this.handle(() =>
      this.criteria.retire(careRequestContext(request), contextId, normalizedId(criterionId), parseRetireInput(body).reason),
    );
  }

  @Get('contexts/:contextId/semaphore')
  @ApiOperation({ operationId: 'getCareSemaphore', summary: 'Semáforo y conteos autorizados del contexto' })
  public async semaphore(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
  ): Promise<SemaphoreView> {
    return this.handle(() => this.criteria.semaphore(careRequestContext(request), contextId));
  }

  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw toCareHttpError(error);
    }
  }
}

function normalizedId(value: string): string {
  const lowered = value.toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(lowered)
    ? lowered
    : '00000000-0000-0000-0000-000000000000';
}
