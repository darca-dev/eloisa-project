import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';

import { PrismaService } from './prisma.service';

/** Contexto institucional resuelto por el servidor para una operación. */
export interface TenantContext {
  readonly tenantId: string;
  readonly tenantCode: string;
}

/**
 * Error técnico: la pareja configurada `MERDN_ACTIVE_TENANT_ID` +
 * `MERDN_ACTIVE_TENANT_CODE` no corresponde a una fila visible de `tenant`.
 *
 * Indica configuración o carga de datos de referencia incompletas, no un error
 * del usuario, y nunca se devuelve su detalle al cliente.
 *
 * El mensaje NO revela cuál de las dos partes existía ni expone el UUID
 * configurado: un identificador inexistente, un código inexistente y una pareja
 * discordante producen exactamente el mismo texto, de modo que el error no
 * funciona como oráculo de existencia de otros tenants (Spec 024).
 */
export class ActiveTenantNotConfiguredError extends Error {
  /** Código configurado. Ya se registra hoy en el log de arranque. */
  public readonly tenantCode: string;

  constructor(tenantCode: string) {
    super(
      `No fue posible verificar el tenant institucional activo "${tenantCode}". ` +
        'Compruebe que MERDN_ACTIVE_TENANT_ID y MERDN_ACTIVE_TENANT_CODE describan ' +
        'la MISMA fila de tenant y que se hayan aplicado las migraciones de datos ' +
        'de referencia. El identificador configurado no se registra por seguridad.',
    );
    this.name = 'ActiveTenantNotConfiguredError';
    this.tenantCode = tenantCode;
  }
}

/**
 * Resolución del tenant institucional activo (TASK-MVP-CORE-01 §4, §9, §18.1;
 * corregida por la Spec 024).
 *
 * El tenant se resuelve EXCLUSIVAMENTE desde configuración del servidor. El
 * navegador nunca lo envía, ni en el cuerpo, ni en la URL, ni en una cabecera,
 * y no existe selector ni administración multiempresa.
 *
 * BOOTSTRAP BAJO RLS. Con `MERDN_RUNTIME_ROLE=enforce` la política `tenant_self`
 * exige `tenant.id = merdn_current_tenant()`, de modo que una lectura fuera de
 * una transacción de contexto no ve NINGUNA fila —tampoco la configurada— y el
 * arranque en frío fallaba en circularidad. La corrección abre
 * `PrismaService.withTenant(configuredTenantId)` con el identificador que ya
 * aporta la configuración confiable del despliegue y, dentro de esa única
 * transacción con rol runtime y GUC local, verifica la pareja EXACTA
 * `id + code`. No se usa conexión privilegiada, `SECURITY DEFINER` ni ninguna
 * relajación de RLS: el runtime sigue siendo `merdn_runtime` sin BYPASSRLS.
 *
 * FAIL-CLOSED. Identificador inexistente, código inexistente, pareja discordante
 * o imposibilidad de adoptar el rol abortan la resolución y NO pueblan la caché:
 * un arranque fallido nunca deja un contexto a medias para la siguiente
 * petición. Solo una verificación exitosa se publica y se cachea.
 *
 * ENUMERACIÓN. La consulta es siempre por la pareja configurada; no se lista
 * `tenant`, no se busca por código suelto bajo rol runtime y no existe
 * superficie que acepte un código o UUID de tenant desde una petición.
 */
@Injectable()
export class TenantContextService implements OnModuleInit {
  private readonly logger = new Logger(TenantContextService.name);

  private cached: TenantContext | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
  ) {}

  public async onModuleInit(): Promise<void> {
    try {
      const context = await this.resolveActiveTenant();
      this.logger.log(`Tenant institucional activo resuelto: ${context.tenantCode}.`);
    } catch (error) {
      // No impedir el arranque: `GET /health` debe seguir respondiendo aunque la
      // carga de datos de referencia todavía no se haya aplicado. La resolución
      // se reintenta en la primera petición de negocio, sin caché envenenada.
      this.logger.warn(
        error instanceof Error
          ? error.message
          : 'No fue posible resolver el tenant institucional activo.',
      );
    }
  }

  /** Código configurado del tenant institucional activo. */
  public get activeTenantCode(): string {
    return this.environment.activeTenantCode;
  }

  /**
   * Devuelve el contexto institucional activo verificado.
   *
   * Lanza `ActiveTenantNotConfiguredError` cuando la pareja configurada no
   * corresponde a una fila visible bajo RLS: nunca crea el tenant de forma
   * implícita, nunca prueba otro código y nunca cachea un resultado no
   * verificado.
   */
  public async resolveActiveTenant(): Promise<TenantContext> {
    if (this.cached !== null) {
      return this.cached;
    }

    const code = this.environment.activeTenantCode;
    const configuredId = this.environment.activeTenantId;

    if (configuredId === undefined) {
      if (this.environment.runtimeRoleMode === 'enforce') {
        /*
         * Defensa en profundidad: `loadApiEnvironment` ya impide arrancar en
         * modo `enforce` sin `MERDN_ACTIVE_TENANT_ID`. Si aun así faltara, se
         * falla cerrado en lugar de recurrir a una búsqueda por código, que bajo
         * RLS no vería ninguna fila y, sin RLS, aceptaría un tenant no
         * verificado.
         */
        throw new ActiveTenantNotConfiguredError(code);
      }

      /*
       * Modo degradado explícito (`MERDN_RUNTIME_ROLE=disabled`), reservado a
       * motores de desarrollo sin RLS y ya advertido en el arranque. Ahí no hay
       * política que ocultar y el identificador es opcional, de modo que se
       * conserva la resolución por código ya existente. Este camino NO se
       * alcanza en un despliegue con el rol runtime aplicado.
       */
      return this.publish(await this.findByCodeWithoutRowLevelSecurity(code), code);
    }

    return this.publish(await this.verifyConfiguredPair(configuredId, code), code);
  }

  /**
   * Verifica la pareja configurada DENTRO de una transacción de contexto.
   *
   * `withTenant()` adopta `merdn_runtime`, fija `merdn.tenant_id` con alcance
   * transaccional y comprueba que ambos quedaron aplicados antes de ejecutar
   * este trabajo. La consulta filtra por `id` Y por `code` a la vez: RLS ya
   * limita lo visible a la fila del contexto, y la igualdad de código impide
   * aceptar un identificador cuyo código configurado no corresponda.
   *
   * Al terminar la transacción, rol y GUC locales se revierten: el bootstrap no
   * deja estado en una conexión reutilizada del pool y toda operación posterior
   * abre su propia transacción `withTenant`.
   */
  private async verifyConfiguredPair(
    configuredId: string,
    configuredCode: string,
  ): Promise<{ readonly id: string; readonly code: string } | null> {
    try {
      return await this.prisma.withTenant(configuredId, async (tx) =>
        tx.tenant.findFirst({
          where: { id: configuredId, code: configuredCode },
          select: { id: true, code: true },
        }),
      );
    } catch (error) {
      /*
       * Un fallo de contexto o de transporte se convierte en el MISMO error
       * sanitizado que una pareja inexistente. El detalle técnico —que podría
       * describir la topología o el estado del rol— queda solo en el log del
       * servidor y jamás llega al cliente.
       */
      this.logger.warn(
        error instanceof Error
          ? `Bootstrap del tenant activo fallido: ${error.name}.`
          : 'Bootstrap del tenant activo fallido por un error desconocido.',
      );
      throw new ActiveTenantNotConfiguredError(configuredCode);
    }
  }

  /** Resolución por código, admisible únicamente sin rol runtime aplicado. */
  private async findByCodeWithoutRowLevelSecurity(
    code: string,
  ): Promise<{ readonly id: string; readonly code: string } | null> {
    return this.prisma.tenant.findUnique({
      where: { code },
      select: { id: true, code: true },
    });
  }

  /**
   * Publica y cachea el contexto SOLO tras una verificación exitosa.
   *
   * Cualquier resultado ausente o discordante lanza sin tocar la caché, de modo
   * que un bootstrap fallido no deja un contexto reutilizable.
   */
  private publish(
    tenant: { readonly id: string; readonly code: string } | null,
    configuredCode: string,
  ): TenantContext {
    if (tenant === null || tenant.code !== configuredCode) {
      throw new ActiveTenantNotConfiguredError(configuredCode);
    }

    this.cached = { tenantId: tenant.id, tenantCode: tenant.code };
    return this.cached;
  }
}
