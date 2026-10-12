import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request } from 'express';

import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import {
  InstitutionalAuditService,
  MUNICIPAL_AGGREGATE_RESOURCES,
  type MunicipalAggregateResource,
} from '../institutional-auth/institutional-audit.service';
import {
  MunicipalViewerGuard,
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from '../institutional-auth/municipal-viewer.guard';

/**
 * Autorización y auditoría del acceso municipal agregado
 * (TASK-MUNICIPALITY-CORE-01, FR-14 y §Audit).
 *
 * Compone el guard institucional reutilizable en lugar de duplicar su lógica:
 * la decisión de autorización sigue viviendo en un solo sitio. Este guard añade
 * únicamente el rastro de auditoría de las DENEGACIONES, que el controlador no
 * puede registrar porque nunca llega a ejecutarse.
 *
 * El acceso concedido lo audita `MunicipalityService` dentro de la misma
 * transacción que sirve los datos, de modo que no pueda existir una respuesta
 * servida sin su evento.
 *
 * El evento de denegación NO registra credenciales, tokens, cookies, IP,
 * cabeceras, cuerpos ni conteos: solo el endpoint lógico, el resultado y la
 * correlación. Un fallo al auditar no convierte una denegación en un permiso:
 * la excepción original se relanza siempre.
 */
@Injectable()
export class MunicipalAggregateAccessGuard implements CanActivate {
  private readonly logger = new Logger(MunicipalAggregateAccessGuard.name);

  constructor(
    @Inject(MunicipalViewerGuard) private readonly viewer: MunicipalViewerGuard,
    @Inject(InstitutionalAuditService) private readonly audit: InstitutionalAuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantContextService) private readonly tenants: TenantContextService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithInstitutionalPrincipal>();

    try {
      return await this.viewer.canActivate(context);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        await this.registrarDenegacion(request);
      }

      throw error;
    }
  }

  private async registrarDenegacion(
    request: RequestWithInstitutionalPrincipal,
  ): Promise<void> {
    const principal = institutionalPrincipalOf(request);
    const correlationId = correlationOf(request);
    const now = new Date();

    try {
      const tenantId =
        principal?.tenantId ?? (await this.tenants.resolveActiveTenant()).tenantId;

      await this.prisma.withTenant(tenantId, async (tx) => {
        await this.audit.recordMunicipalAccessWithin(
          tx,
          {
            tenantId,
            identityId: principal?.identityId ?? null,

            ...(principal?.humanAccountId === undefined ? {} : { humanAccountId: principal?.humanAccountId }),
            role: principal?.role ?? null,
            resource: resourceOf(request),
            endpoint: endpointOf(request),
            correlationId,
          },
          false,
          now,
        );
      });
    } catch (error) {
      // Registrar la denegación es deseable, pero jamás debe alterar el
      // resultado de la autorización ni filtrar detalle al cliente.
      this.logger.warn(
        error instanceof Error
          ? `No fue posible registrar la denegación de acceso municipal: ${error.name}.`
          : 'No fue posible registrar la denegación de acceso municipal.',
      );
    }
  }
}

/** Correlación técnica opaca, sin datos personales ni de red. */
function correlationOf(request: Request): string {
  const header = request.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;

  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/u.test(value)
    ? value
    : 'sin-correlacion';
}

/** Ruta lógica accedida. Nunca incluye parámetros, filtros ni cuerpo. */
function endpointOf(request: Request): string {
  return `${request.method} ${request.path}`;
}

function resourceOf(request: Request): MunicipalAggregateResource {
  return request.path.endsWith('/territory-summary')
    ? MUNICIPAL_AGGREGATE_RESOURCES.territorySummary
    : MUNICIPAL_AGGREGATE_RESOURCES.populationSummary;
}
