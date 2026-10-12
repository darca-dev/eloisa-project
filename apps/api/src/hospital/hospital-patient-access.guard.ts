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
import { HospitalPatientViewerGuard } from '../institutional-auth/hospital-patient-viewer.guard';
import {
  HOSPITAL_PATIENT_RESOURCES,
  InstitutionalAuditService,
  type HospitalPatientResource,
} from '../institutional-auth/institutional-audit.service';
import {
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from '../institutional-auth/municipal-viewer.guard';

/**
 * Autorización y auditoría del acceso hospitalario a Pacientes
 * (TASK-HOSPITAL-CORE-01 §9.4, §9.5 y §9.8).
 *
 * Compone `HospitalPatientViewerGuard` en lugar de duplicar su lógica: la
 * decisión de autorización sigue viviendo en un solo sitio. Este guard añade
 * únicamente el rastro de auditoría de las DENEGACIONES, que el controlador no
 * puede registrar porque nunca llega a ejecutarse.
 *
 * El acceso CONCEDIDO lo audita `HospitalPatientsService` dentro de la misma
 * transacción que sirve los datos, de modo que no pueda existir una lectura
 * nominal servida sin su evento.
 *
 * AUDITORÍA DE LA DENEGACIÓN, BEST-EFFORT Y DELIBERADAMENTE: TASK-HOSPITAL-CORE-01
 * §9.8 admite esta excepción y aquí se ejerce. Hacerla fail-closed convertiría
 * un fallo de escritura en una vía de denegación de servicio —bastaría con
 * saturar la auditoría para tumbar la superficie— y, peor, permitiría distinguir
 * «denegado y auditado» de «denegado sin auditar», que es un oráculo. Por eso un
 * fallo al auditar NUNCA altera el resultado: la excepción original se relanza
 * siempre y jamás se convierte una denegación en un permiso.
 *
 * El evento de denegación NO registra credenciales, tokens, cookies, IP,
 * cabeceras, cuerpos, filtros, término de búsqueda ni recurso concreto.
 */
@Injectable()
export class HospitalPatientAccessGuard implements CanActivate {
  private readonly logger = new Logger(HospitalPatientAccessGuard.name);

  constructor(
    @Inject(HospitalPatientViewerGuard)
    private readonly viewer: HospitalPatientViewerGuard,
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
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
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
        await this.audit.recordHospitalPatientDenialWithin(
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
          now,
        );
      });
    } catch (error) {
      // Registrar la denegación es deseable, pero jamás debe alterar el
      // resultado de la autorización ni filtrar detalle al cliente.
      this.logger.warn(
        error instanceof Error
          ? `No fue posible registrar la denegación de acceso hospitalario: ${error.name}.`
          : 'No fue posible registrar la denegación de acceso hospitalario.',
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

/**
 * Ruta lógica accedida.
 *
 * NUNCA incluye la cadena de consulta, el cuerpo ni los filtros. En el detalle
 * se sustituye el identificador concreto por un marcador, para que la traza de
 * una DENEGACIÓN no revele qué identificador se intentó leer.
 */
function endpointOf(request: Request): string {
  const path = request.path.replace(
    /\/api\/v1\/hospital\/patients\/(?!analytics$).+$/u,
    '/api/v1/hospital/patients/:patientId',
  );

  return `${request.method} ${path}`;
}

function resourceOf(request: Request): HospitalPatientResource {
  if (request.path.endsWith('/analytics')) {
    return HOSPITAL_PATIENT_RESOURCES.analytics;
  }

  return request.path.replace(/\/+$/u, '').endsWith('/patients')
    ? HOSPITAL_PATIENT_RESOURCES.list
    : HOSPITAL_PATIENT_RESOURCES.detail;
}
