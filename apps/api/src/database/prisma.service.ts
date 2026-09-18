import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { PrismaClient } from '../generated/prisma/client';
import { type PrismaTransaction } from './prisma-transaction';
import { RuntimeContextUnavailableError } from './runtime-context.error';

/**
 * Rol de ejecución de mínimo privilegio creado por la migración de
 * endurecimiento. Debe coincidir exactamente con el nombre allí declarado.
 */
export const RUNTIME_ROLE_NAME = 'merdn_runtime';

/**
 * Único punto de acceso a PostgreSQL de la API MERDN (TASK-MVP-CORE-01).
 *
 * Reglas aplicadas:
 * - la cadena de conexión se lee directamente del entorno del proceso y NUNCA
 *   se copia a la configuración de la aplicación, a un log ni a una respuesta;
 * - Prisma 7 requiere un adaptador de controlador: se usa `@prisma/adapter-pg`
 *   sobre PostgreSQL, coherente con `prisma/schema.prisma` y `compose.yml`;
 * - el registro de Prisma se limita a advertencias y errores para no volcar
 *   parámetros de consulta —que contendrían datos personales— en los logs.
 *
 * AISLAMIENTO POR TENANT: todo acceso a datos de negocio debe pasar por
 * `withTenant()`. Los filtros por `tenantId` de la aplicación se conservan como
 * primera barrera, pero NO son la única: dentro de `withTenant()` la sesión
 * adopta el rol `merdn_runtime` —sin BYPASSRLS— y fija el tenant activo, de
 * modo que PostgreSQL rechaza por Row Level Security cualquier fila ajena.
 *
 * FAIL-CLOSED: en modo `enforce`, si el rol no puede adoptarse o el contexto no
 * puede confirmarse, la transacción se aborta ANTES de ejecutar ninguna consulta
 * de negocio. No existe repliegue a privilegios superiores.
 *
 * SEPARACIÓN DE CREDENCIALES: la conexión de ejecución usa
 * `RUNTIME_DATABASE_URL`, distinta de la `DATABASE_URL` administrativa con la
 * que se aplican las migraciones.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
  ) {
    /*
     * La API se conecta con la credencial de EJECUCIÓN. Solo cuando el rol
     * runtime está desactivado —motores de desarrollo que no sostienen RLS— se
     * admite la credencial administrativa, y ese modo se anuncia al arrancar.
     *
     * `loadApiEnvironment` ya impidió arrancar en modo `enforce` sin
     * `RUNTIME_DATABASE_URL`: aquí no puede producirse un repliegue silencioso.
     */
    const runtimeUrl = process.env['RUNTIME_DATABASE_URL'];
    const adminUrl = process.env['DATABASE_URL'];
    const connectionString =
      runtimeUrl !== undefined && runtimeUrl.trim().length > 0 ? runtimeUrl : adminUrl;

    if (connectionString === undefined || connectionString.trim().length === 0) {
      // El mensaje nombra la variable, nunca su valor.
      throw new Error(
        'No hay cadena de conexión disponible: defina RUNTIME_DATABASE_URL para la ' +
          'ejecución de la API, o DATABASE_URL si el rol runtime está desactivado.',
      );
    }

    super({
      adapter: new PrismaPg({ connectionString }),
      log: ['warn', 'error'],
    });
  }

  public async onModuleInit(): Promise<void> {
    if (this.environment.runtimeRoleMode === 'enforce') {
      this.logger.log(
        this.environment.hasSeparateRuntimeConnection
          ? 'Rol runtime aplicado con credencial de ejecución separada.'
          : 'Rol runtime aplicado.',
      );
    }

    if (this.environment.runtimeRoleMode === 'disabled') {
      this.logger.warn(
        'MERDN_RUNTIME_ROLE=disabled: la API NO adopta el rol merdn_runtime y ' +
          'PostgreSQL no aplica Row Level Security. El aislamiento por tenant queda ' +
          'a cargo únicamente de los filtros de la aplicación. Este modo existe solo ' +
          'para motores de desarrollo que no sostienen RLS y no debe usarse con datos reales.',
      );
    }

    try {
      await this.$connect();
      this.logger.log('Acceso a PostgreSQL inicializado.');
    } catch {
      // No impedir el arranque: `GET /health` informa del proceso y declara
      // expresamente que NO afirma el estado de PostgreSQL. Un endpoint de
      // negocio que necesite la base fallará con su propio error controlado.
      // El mensaje no incluye la causa para no arrastrar la cadena de conexión.
      this.logger.warn(
        'No fue posible abrir la conexión con PostgreSQL durante el arranque. ' +
          'Los endpoints que dependen de la base de datos responderán con error ' +
          'hasta que la conexión esté disponible.',
      );
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Ejecuta trabajo de negocio bajo el rol runtime y el tenant indicado.
   *
   * Dentro de la transacción:
   * 1. `SET LOCAL ROLE merdn_runtime` retira los privilegios administrativos y,
   *    al no ser superusuario ni tener BYPASSRLS, activa Row Level Security;
   * 2. `set_config('merdn.tenant_id', …, true)` fija el tenant con alcance
   *    transaccional, de modo que una conexión reutilizada del pool jamás
   *    hereda el contexto de la petición anterior.
   *
   * Ambas instrucciones se revierten al terminar la transacción.
   */
  public async withTenant<T>(
    tenantId: string,
    work: (tx: PrismaTransaction) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await this.enterRuntimeContext(tx, tenantId);
      return work(tx);
    });
  }

  /**
   * Adopta el rol runtime y fija el tenant activo dentro de una transacción ya
   * abierta, y COMPRUEBA que ambos quedaron aplicados.
   *
   * En modo `enforce` cualquier fallo lanza `RuntimeContextUnavailableError` y
   * aborta la transacción: no se ejecuta ninguna consulta de negocio y no se
   * continúa con la credencial de la conexión.
   */
  public async enterRuntimeContext(
    tx: PrismaTransaction,
    tenantId: string,
  ): Promise<void> {
    if (this.environment.runtimeRoleMode !== 'enforce') {
      // Modo degradado explícito y ya advertido en el arranque.
      await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${tenantId}, true)`;
      return;
    }

    try {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${RUNTIME_ROLE_NAME}"`);
    } catch {
      // El motivo exacto no se propaga: podría describir la topología interna.
      throw new RuntimeContextUnavailableError(
        `no fue posible adoptar el rol ${RUNTIME_ROLE_NAME}`,
      );
    }

    // Parametrizado: el identificador nunca se interpola en el texto SQL.
    await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${tenantId}, true)`;

    /*
     * Confirmación explícita. Adoptar el rol y fijar el tenant no basta: hay que
     * comprobar que ambos quedaron efectivamente aplicados en ESTA transacción.
     * Sin esta lectura, un fallo silencioso dejaría la consulta de negocio
     * ejecutándose con la credencial de la conexión.
     */
    const [contexto] = await tx.$queryRaw<
      { readonly rol: string | null; readonly tenant: string | null }[]
    >`SELECT current_user::text AS rol, current_setting('merdn.tenant_id', true) AS tenant`;

    if (contexto === undefined || contexto.rol !== RUNTIME_ROLE_NAME) {
      throw new RuntimeContextUnavailableError(
        `el rol efectivo no es ${RUNTIME_ROLE_NAME}`,
      );
    }

    if (contexto.tenant !== tenantId) {
      throw new RuntimeContextUnavailableError(
        'el tenant activo no quedó fijado en la transacción',
      );
    }
  }

}
