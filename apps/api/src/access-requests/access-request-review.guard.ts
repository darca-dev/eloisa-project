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
import { TenantContextService } from '../database/tenant-context.service';
import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { AuditService } from '../audit/audit.service';
import { InstitutionalAuthService, type InstitutionalPrincipal } from '../institutional-auth/institutional-auth.service';
import { INSTITUTIONAL_SESSION_COOKIE_NAME } from '../institutional-auth/institutional-auth.contract';
import {
  INSTITUTIONAL_PRINCIPAL_KEY,
  type RequestWithInstitutionalPrincipal,
} from '../institutional-auth/municipal-viewer.guard';
import { readCookie } from '../enrollment-sessions/enrollment-session.cookie';

import { ACCESS_REQUEST_REVIEW_ERROR_CODES } from './access-request-review.contract';

/**
 * Autorización server-side de la bandeja de revisión hospitalaria de solicitudes
 * de acceso (SPEC 038 §6.4, paquete MP03-C1).
 *
 * DENEGACIÓN POR DEFECTO. Sin una sesión institucional vigente cuyo rol sea
 * EXACTAMENTE `HOSPITAL_ACCESS_REVIEWER`, el controlador no se ejecuta y
 * portanto no se lee ni se escribe ninguna solicitud. La comprobación no
 * depende de la ruta, de un menú, de un botón oculto ni de ningún valor que
 * envíe el navegador: el tenant, la identidad y el rol salen de la sesión
 * validada contra la identidad PERSISTIDA, y nunca de un parámetro.
 *
 * ROL EXACTO Y DISJUNTO. Este guard NO compone ni extiende
 * `HospitalPatientViewerGuard`, `HospitalSchedulerGuard`,
 * `MunicipalViewerGuard` ni el guard de relaciones. Un rol que autoriza a
 * revisar el acceso de una persona a los datos de otra no debe heredar ninguna
 * otra superficie: compartir una jerarquía permitiría que relajar un rol
 * relajase el otro.
 *
 * `401` cuando no hay sesión institucional válida —ausente, malformada,
 * expirada, revocada, manipulada, con identidad deshabilitada o de otra
 * institución—. La cookie de autoinscripción de paciente entra aquí, porque no
 * autentica a ninguna institución.
 *
 * `403` cuando la identidad autenticada existe pero no es el revisor. Una
 * respuesta `403` NO revela si existe alguna solicitud, cuántas hay ni cuál es
 * su estado: se responde antes de tocar la base de datos.
 *
 * AUDITORÍA DE LA DENEGACIÓN, BEST-EFFORT Y DELIBERADAMENTE, CON DOS CAMINOS.
 * Registrar una denegación es deseable, pero hacerla fail-closed convertiría un
 * fallo de escritura en una vía de denegación de servicio y permitiría distinguir
 * «denegado y auditado» de «denegado sin auditar», que es un oráculo. La
 * excepción original se relanza siempre y un fallo de auditoría NUNCA convierte
 * una denegación en un permiso.
 *
 * Los dos caminos no se mezclan porque no se sabe lo mismo de ellos. Con
 * identidad (`403`) la traza atribuye tenant, identidad y rol, tomados del
 * principal validado. Sin identidad (`401`) no hay nada que atribuir, así que la
 * traza registra `UNAUTHENTICATED` con actor y rol nulos y el tenant resuelto
 * desde la CONFIGURACIÓN del servidor. Un `401` sin registro sería un hueco de
 * trazabilidad justo en el intento que nadie ha acreditado; un `401` con actor
 * inventado sería una atribución falsa. Se elige la segunda opción solo porque
 * es la que se puede sostener.
 *
 * El evento de denegación NO registra credenciales, tokens, cookies, IP,
 * cabeceras, cuerpos, filtros, término de búsqueda, identificador solicitado ni
 * conteo de resultados. `resourceId` queda NULO.
 */
@Injectable()
export class HospitalAccessReviewerGuard implements CanActivate {
  private readonly logger = new Logger(HospitalAccessReviewerGuard.name);

  constructor(
    @Inject(InstitutionalAuthService) private readonly auth: InstitutionalAuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(TenantContextService) private readonly tenants: TenantContextService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithInstitutionalPrincipal>();

    /*
     * Las cabeceras de no-caché se fijan ANTES de decidir nada, para que las
     * lleven TODAS las respuestas de esta superficie: también el `401`, el `403`
     * y el `404` opaco. Una respuesta institucional —incluso una denegación— no
     * debe quedar en una caché compartida entre instituciones.
     */
    noStore(context.switchToHttp().getResponse<Response>());

    const token = readCookie(request.headers.cookie, INSTITUTIONAL_SESSION_COOKIE_NAME);

    let principal: InstitutionalPrincipal | null;

    try {
      principal = await this.auth.validate(token, new Date(), request.headers.cookie, 'HOSPITAL_ACCESS_REVIEWER');
    } catch (error) {
      if (error instanceof RuntimeContextUnavailableError) {
        /*
         * FAIL-CLOSED: si el contexto de ejecución seguro no puede confirmarse
         * —rol runtime de mínimo privilegio, tenant fijado en la transacción,
         * Row Level Security vigente— la petición termina en error controlado.
         * Nunca se concede el acceso «por si acaso».
         */
        this.logger.error(error.message);

        throw new ServiceUnavailableException({
          code: ACCESS_REQUEST_REVIEW_ERROR_CODES.unavailable,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      throw error;
    }

    if (principal === null) {
      await this.registrarDenegacionSinSesion(request);

      throw new UnauthorizedException({
        code: ACCESS_REQUEST_REVIEW_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión institucional vigente.',
      });
    }

    if (principal.role !== 'HOSPITAL_ACCESS_REVIEWER') {
      /*
       * El principal se adjunta ANTES de denegar para que la traza registre el
       * rol efectivo del intento. Adjuntarlo no concede nada: el controlador no
       * llega a ejecutarse.
       */
      request[INSTITUTIONAL_PRINCIPAL_KEY] = principal;

      await this.registrarDenegacionPorRol(request, principal);

      throw new ForbiddenException({
        code: ACCESS_REQUEST_REVIEW_ERROR_CODES.forbidden,
        message: 'La identidad institucional no tiene acceso a esta operación.',
      });
    }

    request[INSTITUTIONAL_PRINCIPAL_KEY] = principal;

    return true;
  }

  /**
   * Traza de la denegación por ROL: la identidad existe y se atribuye.
   *
   * Solo se llama con un principal no nulo, y ese principal es la ÚNICA fuente
   * de tenant, identidad y rol. No se admite un valor por defecto porque un
   * evento al que se le pone un actor de relleno es un evento que atribuye a
   * alguien que no hizo nada.
   */
  private async registrarDenegacionPorRol(
    request: RequestWithInstitutionalPrincipal,
    principal: InstitutionalPrincipal,
  ): Promise<void> {
    const now = new Date();

    try {
      await this.prisma.withTenant(principal.tenantId, async (tx) => {
        await this.audit.recordAccessRequestListDeniedWithin(
          tx,
          {
            tenantId: principal.tenantId,
            identityId: principal.identityId,

            ...(principal.humanAccountId === undefined ? {} : { humanAccountId: principal.humanAccountId }),
            role: principal.role,
            endpoint: endpointOf(request),
            correlationId: correlationOf(request),
          },
          now,
        );
      });
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `No fue posible registrar la denegación de revisión de solicitudes: ${error.name}.`
          : 'No fue posible registrar la denegación de revisión de solicitudes.',
      );
    }
  }

  /**
   * Traza de la denegación por AUSENCIA de sesión institucional (`401`).
   *
   * Lo que NO se hace, y es lo importante:
   *
   * - NO se atribuye identidad ni rol. No hay ninguno demostrado, y escribir el
   *   tenant configurado como si fuera el del actor convertiría un intento
   *   anónimo en una atribución inventada. `actorType` queda `UNAUTHENTICATED`
   *   con actor y rol NULOS, que es la única afirmación verdadera que la traza
   *   puede hacer sobre un intento que no se ha acreditado.
   * - NO se consulta ninguna solicitud. Ni una fila, ni un conteo, ni un filtro.
   *   Un `401` que consultara el backlog para poder auditarlo ya habría revelado
   *   existencia, y la respuesta al cliente es la misma exista o no: no hay
   *   ningún caso en que leer datos cambie lo que el cliente recibe.
   * - NO se registra el término buscado, los filtros, la cookie, el token ni la
   *   ruta pedida con sus identificadores. `endpoint` es la ruta lógica y la
   *   correlación viene saneada.
   *
   * El tenant sale de `TenantContextService`, es decir de CONFIGURACIÓN del
   * servidor verificada contra la fila institucional, y no de la petición: un
   * cliente anónimo no puede elegir a qué institución se atribuye su intento, ni
   * siquiera porque elija una cabecera.
   *
   * BEST-EFFORT, como la denegación por rol. Si el tenant no puede resolverse o
   * la escritura falla, se registra el fallo en el log del servidor y la
   * excepción original —el `401`— se relanza igual. Nunca se convierte un fallo de
   * auditoría en un permiso, ni en una respuesta distinta de la que el cliente
   * ya tenía derecho a recibir.
   */
  private async registrarDenegacionSinSesion(request: RequestWithInstitutionalPrincipal): Promise<void> {
    const now = new Date();

    try {
      const { tenantId } = await this.tenants.resolveActiveTenant();

      await this.prisma.withTenant(tenantId, async (tx) => {
        await this.audit.recordAccessRequestUnauthenticatedDeniedWithin(
          tx,
          {
            tenantId,
            endpoint: endpointOf(request),
            correlationId: correlationOf(request),
          },
          now,
        );
      });
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `No fue posible registrar el intento sin sesión institucional: ${error.name}.`
          : 'No fue posible registrar el intento sin sesión institucional.',
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

/**
 * Correlación técnica opaca, sin datos personales ni de red.
 *
 * El valor recibido NO se copia sin comprobar: una cabecera `X-Request-Id` la
 * escribe el cliente, y aceptar cualquier cadena sería un canal de inyección
 * libre en un campo de la traza. Un valor con forma inesperada se sustituye por
 * un marcador fijo en vez de rechazarse, porque el identificador de correlación
 * no es una condición de autorización.
 */
function correlationOf(request: Request): string {
  const header = request.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;

  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/u.test(value)
    ? value
    : 'sin-correlacion';
}

/**
 * Ruta lógica accedida, con los identificadores sustituidos por marcadores.
 *
 * NUNCA incluye la cadena de consulta, el cuerpo ni los filtros. Una traza de
 * denegación que incluyera el `requestId` pedido revelaría qué se intentó leer,
 * y una que incluyera los filtros revelaría qué se estaba buscando.
 */
function endpointOf(request: Request): string {
  const path = request.path
    .replace(
      /\/api\/v1\/hospital\/access-requests\/[^/]+\/decision$/u,
      '/api/v1/hospital/access-requests/:requestId/decision',
    )
    .replace(
      /\/api\/v1\/hospital\/access-requests\/.+$/u,
      '/api/v1/hospital/access-requests/:requestId',
    );

  return `${request.method} ${path}`;
}
