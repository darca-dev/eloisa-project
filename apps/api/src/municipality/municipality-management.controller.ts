import { BadRequestException, Body, Controller, Get, HttpException, Inject, Param, Put, Req, Res, ServiceUnavailableException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HumanSessionGuard } from '../human-auth/human-session.guard';
import { SameOriginGuard } from '../human-auth/same-origin.guard';
import { humanPrincipalOf, type RequestWithHumanPrincipal } from '../identity-access/human-principal';
import { MunicipalityManagementService } from './municipality-management.service';

@ApiTags('municipality-management')
@Controller('api/v1/municipality/management')
@UseGuards(HumanSessionGuard)
export class MunicipalityManagementController {
  constructor(@Inject(MunicipalityManagementService) private readonly management: MunicipalityManagementService) {}
  @Get(':section')
  @ApiOperation({ operationId: 'getMunicipalManagementSection', summary: 'Consulta registros administrativos de Alcaldía' })
  read(@Param('section') section: string, @Req() request: RequestWithHumanPrincipal, @Res({ passthrough: true }) response: Response) { return this.execute(request, response, section); }
  @Put(':section')
  @UseGuards(SameOriginGuard)
  @ApiOperation({ operationId: 'saveMunicipalManagementSection', summary: 'Guarda una revisión administrativa con control de versión' })
  write(@Param('section') section: string, @Body() body: unknown, @Req() request: RequestWithHumanPrincipal, @Res({ passthrough: true }) response: Response) {
    if (body === undefined) throw new BadRequestException({ code: 'MUNICIPAL_INPUT_REQUIRED', message: 'Complete el formulario.' });
    return this.execute(request, response, section, body);
  }
  private async execute(request: RequestWithHumanPrincipal, response: Response, section: string, body?: unknown) {
    response.setHeader('Cache-Control', 'private, no-store');
    const principal = humanPrincipalOf(request);
    if (principal === null) throw new UnauthorizedException();
    try { return await this.management.document(principal, section, body); }
    catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({ code: 'MUNICIPAL_MANAGEMENT_UNAVAILABLE', message: 'No se confirmó la operación. Recargue el apartado para comprobar su estado antes de volver a guardar.' });
    }
  }
}
