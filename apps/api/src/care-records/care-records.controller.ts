import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { type CareDirectoryPage } from '../care-context/care-context-directory.service';
import { careRequestContext, decodeContextCursor, decodeCursor, pageLimit, toCareHttpError } from '../care-context/care-request';
import { HumanAuthRateLimitGuard } from '../human-auth/human-auth-rate-limit.guard';
import { HumanSessionGuard, type RequestWithHumanSession } from '../human-auth/human-session.guard';
import { SameOriginGuard } from '../human-auth/same-origin.guard';

import {
  CARE_BASE_PATH,
  type CareObservableView,
  type CareRecordCreatedView,
  type CareRecordPage,
  type CareRecordView,
} from './care-records.contract';
import { parseAmendmentInput, parseObservableInput, parseRecordInput } from './care-records.request';
import { CareRecordsService } from './care-records.service';

/**
 * Bitácoras de cuidado (SPEC 055 / MP02).
 *
 * Toda ruta exige sesión humana; las escrituras además mismo origen y límite de
 * abuso. Actor, tenant, organización y paciente NUNCA se leen de la petición:
 * `:contextId` es el recurso solicitado y el servidor decide si la cuenta puede
 * actuar sobre él. Las respuestas no se guardan en cachés compartidas.
 */
@ApiTags('care-records')
@Controller(CARE_BASE_PATH)
@UseGuards(HumanSessionGuard)
export class CareRecordsController {
  constructor(@Inject(CareRecordsService) private readonly records: CareRecordsService) {}

  @Get('contexts')
  @ApiOperation({ operationId: 'listCareContexts', summary: 'Página de contextos de cuidado autorizados para la cuenta' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor opaco devuelto por la página anterior' })
  @ApiQuery({ name: 'limit', required: false, description: 'Contextos candidatos por página (1 a 50)' })
  public async contexts(
    @Req() request: RequestWithHumanSession,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CareDirectoryPage> {
    return this.handle(() => this.records.directory(careRequestContext(request), decodeContextCursor(cursor), pageLimit(limit)));
  }

  @Get('contexts/:contextId/observables')
  @ApiOperation({ operationId: 'listCareObservables', summary: 'Datos validados que se pueden registrar' })
  public async observables(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
  ): Promise<readonly CareObservableView[]> {
    return this.handle(() => this.records.listObservables(careRequestContext(request), contextId));
  }

  @Post('contexts/:contextId/observables')
  @HttpCode(201)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'createCareObservable', summary: 'Valida una nueva versión de un dato a registrar' })
  public async createObservable(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Body() body: unknown,
  ): Promise<CareObservableView> {
    return this.handle(() => this.records.createObservable(careRequestContext(request), contextId, parseObservableInput(body)));
  }

  @Get('contexts/:contextId/records')
  @ApiOperation({ operationId: 'listCareRecords', summary: 'Bitácora autorizada del contexto' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor opaco devuelto por la página anterior' })
  @ApiQuery({ name: 'limit', required: false, description: 'Entradas por página (1 a 50)' })
  public async listRecords(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CareRecordPage> {
    return this.handle(() =>
      this.records.listRecords(careRequestContext(request), contextId, decodeCursor(cursor), pageLimit(limit)),
    );
  }

  @Post('contexts/:contextId/records')
  @HttpCode(201)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'createCareRecord', summary: 'Registra una entrada atribuida de bitácora' })
  public async createRecord(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Body() body: unknown,
  ): Promise<CareRecordCreatedView> {
    return this.handle(() => {
      const context = careRequestContext(request);
      return this.records.createRecord(context, contextId, parseRecordInput(body, context.now));
    });
  }

  @Post('contexts/:contextId/records/:recordId/amendments')
  @HttpCode(201)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'createCareRecordAmendment', summary: 'Corrige una entrada propia sin reescribirla' })
  public async createAmendment(
    @Req() request: RequestWithHumanSession,
    @Param('contextId') contextId: string,
    @Param('recordId') recordId: string,
    @Body() body: unknown,
  ): Promise<CareRecordView> {
    return this.handle(() =>
      this.records.createAmendment(careRequestContext(request), contextId, normalizedId(recordId), parseAmendmentInput(body)),
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

/** Un identificador de ruta mal formado no llega a ninguna consulta. */
function normalizedId(value: string): string {
  const lowered = value.toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(lowered)
    ? lowered
    : '00000000-0000-0000-0000-000000000000';
}
