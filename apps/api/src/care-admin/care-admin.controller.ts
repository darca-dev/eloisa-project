import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { careRequestContext, toCareHttpError } from '../care-context/care-request';
import { HumanAuthRateLimitGuard } from '../human-auth/human-auth-rate-limit.guard';
import { HumanSessionGuard, type RequestWithHumanSession } from '../human-auth/human-session.guard';
import { SameOriginGuard } from '../human-auth/same-origin.guard';

import { type AdminOverviewView, CARE_ADMIN_BASE_PATH, type ManagedOrganizationView } from './care-admin.contract';
import { parseCompetenceInput, parseCreateContextInput, parseGrantInput } from './care-admin.request';
import { CareAdminService } from './care-admin.service';

/**
 * Administración de permisos de cuidado por el gestor (SPEC 055 / MP05b).
 * Sesión humana en todas las rutas; mismo origen y límite de abuso en las
 * escrituras. La capacidad de gestor la verifica el servidor en cada operación.
 */
@ApiTags('care-admin')
@Controller(CARE_ADMIN_BASE_PATH)
@UseGuards(HumanSessionGuard)
export class CareAdminController {
  constructor(@Inject(CareAdminService) private readonly admin: CareAdminService) {}

  @Get('organizations')
  @ApiOperation({ operationId: 'listManagedCareOrganizations', summary: 'Organizaciones que la cuenta gestiona' })
  public async organizations(@Req() request: RequestWithHumanSession): Promise<readonly ManagedOrganizationView[]> {
    return this.handle(() => this.admin.organizations(careRequestContext(request)));
  }

  @Get('organizations/:organizationId')
  @ApiOperation({ operationId: 'getCareAdministration', summary: 'Espacios de cuidado, accesos y competencias de la organización' })
  public async overview(
    @Req() request: RequestWithHumanSession,
    @Param('organizationId') organizationId: string,
  ): Promise<AdminOverviewView> {
    return this.handle(() => this.admin.overview(careRequestContext(request), organizationId));
  }

  @Post('organizations/:organizationId/contexts')
  @HttpCode(201)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'createAdminCareContext', summary: 'Crea el espacio de cuidado de un paciente' })
  public async createContext(
    @Req() request: RequestWithHumanSession,
    @Param('organizationId') organizationId: string,
    @Body() body: unknown,
  ): Promise<AdminOverviewView> {
    return this.handle(() => this.admin.createContext(careRequestContext(request), organizationId, parseCreateContextInput(body)));
  }

  @Post('organizations/:organizationId/contexts/:contextId/grants')
  @HttpCode(201)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'issueCareGrant', summary: 'Concede un acceso de cuidado con su soporte' })
  public async grant(
    @Req() request: RequestWithHumanSession,
    @Param('organizationId') organizationId: string,
    @Param('contextId') contextId: string,
    @Body() body: unknown,
  ): Promise<AdminOverviewView> {
    return this.handle(() => {
      const context = careRequestContext(request);
      return this.admin.grant(context, organizationId, normalizedId(contextId), parseGrantInput(body, context.now));
    });
  }

  @Post('organizations/:organizationId/grants/:grantId/revoke')
  @HttpCode(200)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'revokeCareGrant', summary: 'Revoca un acceso de cuidado; la historia se conserva' })
  public async revokeGrant(
    @Req() request: RequestWithHumanSession,
    @Param('organizationId') organizationId: string,
    @Param('grantId') grantId: string,
  ): Promise<AdminOverviewView> {
    return this.handle(() => this.admin.revokeGrant(careRequestContext(request), organizationId, normalizedId(grantId)));
  }

  @Post('organizations/:organizationId/competences')
  @HttpCode(201)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'attestCareCompetence', summary: 'Declara la competencia de una persona en la organización' })
  public async attest(
    @Req() request: RequestWithHumanSession,
    @Param('organizationId') organizationId: string,
    @Body() body: unknown,
  ): Promise<AdminOverviewView> {
    return this.handle(() => {
      const context = careRequestContext(request);
      return this.admin.attestCompetence(context, organizationId, parseCompetenceInput(body, context.now));
    });
  }

  @Post('organizations/:organizationId/competences/:competenceId/revoke')
  @HttpCode(200)
  @UseGuards(SameOriginGuard, HumanAuthRateLimitGuard)
  @ApiOperation({ operationId: 'revokeCareCompetence', summary: 'Revoca una competencia declarada' })
  public async revokeCompetence(
    @Req() request: RequestWithHumanSession,
    @Param('organizationId') organizationId: string,
    @Param('competenceId') competenceId: string,
  ): Promise<AdminOverviewView> {
    return this.handle(() => this.admin.revokeCompetence(careRequestContext(request), organizationId, normalizedId(competenceId)));
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
