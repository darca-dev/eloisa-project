import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request, type Response } from 'express';

import { PrismaService } from '../database/prisma.service';
import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { TenantContextService } from '../database/tenant-context.service';
import { readCookie } from '../enrollment-sessions/enrollment-session.cookie';

import {
  INSTITUTIONAL_ERROR_CODES,
  INSTITUTIONAL_SESSION_COOKIE_NAME,
} from './institutional-auth.contract';
import {
  InstitutionalAuthService,
  type InstitutionalPrincipal,
} from './institutional-auth.service';
import {
  INSTITUTIONAL_PRINCIPAL_KEY,
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from './municipal-viewer.guard';

/**
 * Autorización server-side de la superficie hospitalaria de OPERACIONES
 * —Profesionales, Agenda y la única asignación autorizada—
 * (TASK-HOSPITAL-CORE-02 §3.1, §7.2 y §7.3).
 *
 * Denegación por defecto: sin sesión institucional vigente CON el rol
 * `HOSPITAL_SCHEDULER` no se ejecuta el controlador y, por tanto, no se toca
 * ningún dato. La comprobación NO depende de la ruta, del menú lateral, de un
 * botón oculto ni de ningún valor enviado por el navegador: el tenant se
 * resuelve en el servidor y el rol se lee de la identidad persistida.
 *
 * Contrato de estados:
 * - `401` cuando no hay sesión institucional válida —ausente, malformada,
 *   expirada, revocada, manipulada, con identidad deshabilitada o de otra
 *   institución—; la cookie de autoinscripción de paciente entra aquí, porque
 *   NO autentica a ninguna institución;
 * - `403` cuando la identidad autenticada carece de `HOSPITAL_SCHEDULER`. Una
 *   sesión municipal y una sesión `HOSPITAL_PATIENT_VIEWER` caen exactamente en
 *   este caso.
 *
 * ROLES DISJUNTOS, DELIBERADAMENTE: este guard NO extiende ni compone
 * `HospitalPatientViewerGuard`. `HOSPITAL_PATIENT_VIEWER` conserva su carácter
 * de SOLO LECTURA y no gana ninguna escritura; `HOSPITAL_SCHEDULER` no gana
 * acceso a Hospital Pacientes ni a los agregados municipales. Compartir una
 * jerarquía de permisos abriría la puerta a que relajar uno relajase el otro.
 *
 * AUDITORÍA DE LA DENEGACIÓN, BEST-EFFORT Y DELIBERADAMENTE: se sigue el mismo
 * criterio ya aprobado para Hospital Pacientes. Hacerla fail-closed convertiría
 * un fallo de escritura en una vía de denegación de servicio y permitiría
 * distinguir «denegado y auditado» de «denegado sin auditar», que es un oráculo.
 * Un fallo al auditar NUNCA altera el resultado: la excepción original se
 * relanza siempre y jamás se convierte una denegación en un permiso.
 *
 * El evento de denegación NO registra credenciales, tokens, cookies, IP,
 * cabeceras, cuerpos, filtros, término de búsqueda ni recurso concreto.
 */
@Injectable()
export class HospitalSchedulerGuard implements CanActivate {
  private readonly logger = new Logger(HospitalSchedulerGuard.name);

  constructor(
    @Inject(InstitutionalAuthService) private readonly auth: InstitutionalAuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantContextService) private readonly tenants: TenantContextService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithInstitutionalPrincipal>();

    /*
     * Las cabeceras de no-caché se fijan ANTES de decidir nada, de modo que las
     * lleven TODAS las respuestas de esta superficie: también el `401`, el `403`
     * y cualquier error posterior. Una respuesta institucional —incluso una
     * denegación— no debe quedar en una caché compartida entre instituciones ni
     * entre personas usuarias.
     */
    noStore(context.switchToHttp().getResponse<Response>());

    const token = readCookie(request.headers.cookie, INSTITUTIONAL_SESSION_COOKIE_NAME);

    let principal: InstitutionalPrincipal | null;

    try {
      principal = await this.auth.validate(token, new Date());
    } catch (error) {
      if (error instanceof RuntimeContextUnavailableError) {
        /*
         * FAIL-CLOSED: si el contexto de ejecución seguro no puede confirmarse
         * —rol runtime de mínimo privilegio, tenant activo fijado en la
         * transacción, Row Level Security vigente—, la petición termina en error
         * controlado. Nunca se concede el acceso «por si acaso» ni se reintenta
         * con privilegios superiores.
         */
        this.logger.error(error.message);

        throw new ServiceUnavailableException({
          code: INSTITUTIONAL_ERROR_CODES.internal,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      throw error;
    }

    if (principal === null) {
      await this.registrarDenegacion(request, null);

      throw new UnauthorizedException({
        code: INSTITUTIONAL_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión institucional vigente.',
      });
    }

    if (principal.role !== 'HOSPITAL_SCHEDULER') {
      /*
       * El principal se adjunta ANTES de denegar para que la traza registre el
       * rol efectivo del intento. Adjuntarlo no concede nada: el controlador no
       * llega a ejecutarse.
       */
      request[INSTITUTIONAL_PRINCIPAL_KEY] = principal;

      await this.registrarDenegacion(request, principal);

      throw new ForbiddenException({
        code: INSTITUTIONAL_ERROR_CODES.forbidden,
        message: 'La identidad institucional no tiene acceso a esta operación.',
      });
    }

    request[INSTITUTIONAL_PRINCIPAL_KEY] = principal;

    return true;
  }

  private async registrarDenegacion(
    request: RequestWithInstitutionalPrincipal,
    principal: InstitutionalPrincipal | null,
  ): Promise<void> {
    const efectivo = principal ?? institutionalPrincipalOf(request);
    const now = new Date();

    try {
      const tenantId =
        efectivo?.tenantId ?? (await this.tenants.resolveActiveTenant()).tenantId;

      await this.prisma.withTenant(tenantId, async (tx) => {
        await tx.auditEvent.create({
          data: {
            tenantId,
            eventType: 'HOSPITAL_OPERATIONS_ACCESS_DENIED',
            actorType:
              efectivo === null ? 'UNAUTHENTICATED' : 'INSTITUTIONAL_IDENTITY',
            actorUserId: efectivo?.identityId ?? null,
            actorRole: efectivo?.role ?? null,
            resourceType: resourceOf(request),
            // Una denegación nunca nombra el recurso concreto.
            resourceId: null,
            outcome: 'DENIED',
            endpoint: endpointOf(request),
            correlationId: correlationOf(request),
            occurredAt: now,
          },
          select: { id: true },
        });
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

/** Ninguna respuesta de esta superficie puede quedar en una caché compartida. */
function noStore(response: Response): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Vary', 'Cookie');
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
 * NUNCA incluye la cadena de consulta, el cuerpo ni los filtros. Los
 * identificadores concretos se sustituyen por un marcador, para que la traza de
 * una DENEGACIÓN no revele qué identificador se intentó leer o asignar.
 */
function endpointOf(request: Request): string {
  const path = request.path
    .replace(
      /\/api\/v1\/hospital\/appointments\/[^/]+\/assignment$/u,
      '/api/v1/hospital/appointments/:appointmentId/assignment',
    )
    .replace(
      /\/api\/v1\/hospital\/professionals\/.+$/u,
      '/api/v1/hospital/professionals/:professionalId',
    );

  return `${request.method} ${path}`;
}

/** Superficie lógica del intento. Nunca el recurso concreto. */
function resourceOf(request: Request): string {
  if (request.path.includes('/appointments/')) {
    return 'Appointment';
  }

  if (request.path.includes('/agenda')) {
    return 'HospitalAgenda';
  }

  return request.path.replace(/\/+$/u, '').endsWith('/professionals')
    ? 'HospitalProfessionalList'
    : 'HospitalProfessionalDetail';
}
