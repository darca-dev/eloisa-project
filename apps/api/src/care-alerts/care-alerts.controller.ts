import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { alarmStateFilter, careRequestContext, decodeCursor, pageLimit, toCareHttpError } from '../care-context/care-request';
import { HumanAuthRateLimitGuard } from '../human-auth/human-auth-rate-limit.guard';
import { HumanSessionGuard, type RequestWithHumanSession } from '../human-auth/human-session.guard';
import { SameOriginGuard } from '../human-auth/same-origin.guard';
import { CARE_BASE_PATH } from '../care-records/care-records.contract';

import {
  type CareAlarmDetailView,
  type CareAlarmPage,
  type ManualAlarmCreatedView,
} from './care-alerts.contract';
import { parseManualAlarmInput, parseResolutionReportInput, parseTransitionInput } from './care-alerts.request';
import { CareAlertsService } from './care-alerts.service';

/**
 * Alarmas de cuidado (SPEC 055 / MP03). Sesión humana en todas las rutas;
 * mismo origen y límite de abuso en las escrituras. El servidor decide cada
 * acción sobre el contexto solicitado; nada se autoriza desde la petición.
 */
@ApiTags('care-alerts')
@Controller(CARE_BASE_PATH)
@UseGuards(HumanSessionGuard)
export class CareAlertsController {
  constructor(@Inject(CareAlertsService) private readonly alerts: CareAlertsService) {}

  @Get('contexts/:contextId/alarms')
  @ApiOperation({ operationId: 'listCareAlarms', summary: 'Alarmas autorizadas del contexto' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor opaco devuelto por la página anterior' })
  @ApiQuery({ name: 'limit', required: false, description: 'Alarmas por página (1 a 50)' })
  @ApiQuery({ name: 'state', required: false, enum: ['all', 'open'], description: '`open` excluye las cerradas en cada página' })
  public async list(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('state') state?: string,
  ): Promise<CareAlarmPage> {
    return this.handle(() =>
      this.alerts.list(careRequestContext(request), contextId, decodeCursor(cursor), pageLimit(limit), alarmStateFilter(state)),
    );
  }

  @Post('contexts/:contextId/alarms')
  @HttpCode(201)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'createManualCareAlarm', summary: 'Solicita revisión de forma manual' })
  public async create(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Body() body: unknown,
  ): Promise<ManualAlarmCreatedView> {
    return this.handle(() => this.alerts.createManual(careRequestContext(request), contextId, parseManualAlarmInput(body)));
  }

  @Get('contexts/:contextId/alarms/:alarmId')
  @ApiOperation({ operationId: 'getCareAlarm', summary: 'Detalle e historia de una alarma' })
  public async detail(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Param('alarmId') alarmId: string,
  ): Promise<CareAlarmDetailView> {
    return this.handle(() => this.alerts.detail(careRequestContext(request), contextId, normalizedId(alarmId)));
  }

  @Post('contexts/:contextId/alarms/:alarmId/transitions')
  @HttpCode(200)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'transitionCareAlarm', summary: 'Reconoce, clasifica, asigna, resuelve, cierra o reabre' })
  public async transition(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Param('alarmId') alarmId: string,
    @Body() body: unknown,
  ): Promise<CareAlarmDetailView> {
    return this.handle(() =>
      this.alerts.transition(careRequestContext(request), contextId, normalizedId(alarmId), parseTransitionInput(body)),
    );
  }

  @Post('contexts/:contextId/alarms/:alarmId/resolution-reports')
  @HttpCode(201)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'reportCareAlarmResolution', summary: 'El solicitante informa que se resolvió' })
  public async report(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Param('alarmId') alarmId: string,
    @Body() body: unknown,
  ): Promise<CareAlarmDetailView> {
    return this.handle(() =>
      this.alerts.reportResolution(careRequestContext(request), contextId, normalizedId(alarmId), parseResolutionReportInput(body)),
    );
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
