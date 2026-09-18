import { Client, type QueryResultRow } from 'pg';

import { DATABASE_URL_ENV, RUNTIME_ROLE_NAME } from './contract.ts';

/**
 * Acceso a PostgreSQL del comando de aprovisionamiento.
 *
 * MISMAS GARANTÍAS QUE LA API, y por las mismas razones:
 *
 * - la conexión se abre con la credencial ADMINISTRATIVA porque hay que
 *   resolver el tenant antes de tener contexto, y la política `tenant_self`
 *   solo deja verlo a quien ya declaró cuál es;
 * - dentro de la transacción se adopta SIEMPRE el rol `merdn_runtime` y se fija
 *   `merdn.tenant_id`. No es opcional ni configurable: las seis tablas de esta
 *   Task llevan `FORCE ROW LEVEL SECURITY`, de modo que ni el propietario
 *   escapa a la política, y sin el rol y el contexto NINGUNA fila es visible;
 * - la adopción se COMPRUEBA leyendo el usuario efectivo y el tenant activo. Un
 *   fallo silencioso dejaría el comando escribiendo con privilegios de
 *   propietario, que es exactamente lo que este rodeo evita;
 * - el rol carece de DELETE en todas las tablas: este comando no puede borrar
 *   historia aunque se le pidiera.
 *
 * La cadena de conexión NUNCA se imprime, ni siquiera al fallar: los mensajes
 * nombran la variable y no su valor.
 */

/** El contexto de ejecución seguro no pudo confirmarse. Falla CERRADO. */
export class RuntimeContextUnavailableError extends Error {
  constructor(reason: string) {
    super(
      `No fue posible operar bajo el rol ${RUNTIME_ROLE_NAME} con el tenant activo: ${reason}. ` +
        'El comando termina sin escribir nada.',
    );
    this.name = 'RuntimeContextUnavailableError';
  }
}

/** No hay cadena de conexión administrativa. */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      `${DATABASE_URL_ENV} no está definida. El comando de aprovisionamiento no ` +
        'infiere ninguna conexión y termina sin tocar la base.',
    );
    this.name = 'DatabaseNotConfiguredError';
  }
}

/** Consulta parametrizada. El texto SQL nunca se construye con valores. */
export interface SqlRunner {
  query<T extends QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<readonly T[]>;
}

export async function openClient(source: NodeJS.ProcessEnv): Promise<Client> {
  const connectionString = source[DATABASE_URL_ENV]?.trim();

  if (connectionString === undefined || connectionString.length === 0) {
    throw new DatabaseNotConfiguredError();
  }

  const client = new Client({ connectionString });
  await client.connect();

  return client;
}

/**
 * Resuelve el tenant por su código ANTES de adoptar el rol runtime.
 *
 * Devuelve `null` cuando el código no existe: el comando responde `NOT_FOUND`
 * sin abrir ninguna transacción de escritura.
 */
export async function resolveTenantId(
  client: Client,
  tenantCode: string,
): Promise<string | null> {
  const result = await client.query<{ id: string }>(
    'SELECT "id" FROM "tenant" WHERE "code" = $1',
    [tenantCode],
  );

  return result.rows[0]?.id ?? null;
}

/**
 * Ejecuta trabajo dentro de UNA transacción, bajo el rol runtime y el tenant
 * indicado.
 *
 * `commit` decide el desenlace: en dry-run se ejecuta exactamente el mismo
 * trabajo y se termina con `ROLLBACK`. Esa simetría es deliberada: un dry-run
 * que solo «mirase» no comprobaría las claves foráneas compuestas, los CHECK ni
 * las políticas de RLS, y podría anunciar un resultado que la aplicación real
 * no alcanzaría.
 */
export async function withRuntimeTransaction<T>(
  client: Client,
  tenantId: string,
  commit: boolean,
  work: (sql: SqlRunner) => Promise<T>,
): Promise<T> {
  const runner: SqlRunner = {
    async query<R extends QueryResultRow>(
      text: string,
      values: readonly unknown[] = [],
    ): Promise<readonly R[]> {
      const result = await client.query<R>(text, [...values]);
      return result.rows;
    },
  };

  await client.query('BEGIN');

  try {
    await enterRuntimeContext(client, tenantId);
    const outcome = await work(runner);
    await client.query(commit ? 'COMMIT' : 'ROLLBACK');

    return outcome;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function enterRuntimeContext(client: Client, tenantId: string): Promise<void> {
  try {
    // El nombre del rol es una constante del repositorio, nunca una entrada.
    await client.query(`SET LOCAL ROLE "${RUNTIME_ROLE_NAME}"`);
  } catch {
    // El motivo exacto no se propaga: describiría la topología de la base.
    throw new RuntimeContextUnavailableError('el rol no pudo adoptarse');
  }

  await client.query('SELECT set_config($1, $2, true)', ['merdn.tenant_id', tenantId]);

  const confirmation = await client.query<{ rol: string; tenant: string | null }>(
    `SELECT current_user::text AS rol,
            current_setting('merdn.tenant_id', true) AS tenant`,
  );

  const row = confirmation.rows[0];

  if (row === undefined || row.rol !== RUNTIME_ROLE_NAME) {
    throw new RuntimeContextUnavailableError('el rol efectivo no es el esperado');
  }

  if (row.tenant !== tenantId) {
    throw new RuntimeContextUnavailableError('el tenant activo no quedó fijado');
  }
}
