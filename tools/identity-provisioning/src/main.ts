import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import process from 'node:process';

import { PROVISIONING_ISSUERS_ENV } from './contract.ts';
import {
  openClient,
  resolveTenantId,
  withRuntimeTransaction,
} from './database.ts';
import { type OperationResult, runOperation } from './operations.ts';
import {
  parseIssuerAllowlist,
  parseOperationsFile,
  type ProvisioningOperation,
} from './parse.ts';

/**
 * Comando administrativo de aprovisionamiento de identidad
 * (IDENTITY-RELATIONSHIPS-CORE-01 §9, continuación §4).
 *
 * Uso:
 *   npm run identity:provision -- --file <ruta-json-absoluta> --dry-run
 *   npm run identity:provision -- --file <ruta-json-absoluta> --apply
 *
 * DRY-RUN POR DEFECTO. Sin `--apply` el comando ejecuta exactamente el mismo
 * trabajo dentro de la transacción y termina con `ROLLBACK`. Es deliberado: un
 * ensayo que solo «mirase» no comprobaría claves foráneas compuestas, CHECK ni
 * políticas de Row Level Security, y podría anunciar un resultado que la
 * aplicación real no alcanzaría.
 *
 * UNA TRANSACCIÓN POR OPERACIÓN. Cada operación es atómica con su auditoría; un
 * archivo con varias no es una transacción única, y la salida dice exactamente
 * cuáles se aplicaron. Una operación que falla no impide evaluar las demás,
 * pero el comando termina con código distinto de cero.
 *
 * LO QUE ESTE COMANDO NUNCA IMPRIME: emisor, `subject`, nombres, documentos,
 * contacto, cadenas de conexión, tokens ni secretos. La correlación visible es
 * una huella corta e irreversible del par emisor/`subject`.
 */

interface CommandOptions {
  readonly file: string;
  readonly apply: boolean;
}

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

const USAGE =
  'Uso: npm run identity:provision -- --file <ruta-json-absoluta> [--dry-run | --apply]';

function out(text: string): void {
  process.stdout.write(`${text}\n`);
}

function parseArguments(argv: readonly string[]): CommandOptions {
  let file: string | null = null;
  let apply = false;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--file') {
      const value = argv[index + 1];

      if (value === undefined || value.startsWith('--')) {
        throw new UsageError('«--file» exige una ruta.');
      }

      file = value;
      index += 1;
      continue;
    }

    if (argument === '--apply') {
      apply = true;
      continue;
    }

    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }

    // Allowlist CERRADA de argumentos: una opción desconocida no se ignora.
    throw new UsageError(`Argumento no admitido: «${String(argument)}».`);
  }

  if (file === null) {
    throw new UsageError('Falta «--file».');
  }

  if (apply && dryRun) {
    throw new UsageError('«--apply» y «--dry-run» son excluyentes.');
  }

  if (!isAbsolute(file)) {
    /*
     * Se exige ruta ABSOLUTA para que el archivo aplicado no dependa del
     * directorio desde el que se invoque el comando: aprovisionar identidades
     * con el archivo equivocado no es un error recuperable.
     */
    throw new UsageError('«--file» debe ser una ruta absoluta.');
  }

  return { file, apply };
}

async function main(): Promise<number> {
  let options: CommandOptions;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    out(error instanceof Error ? error.message : 'Argumentos inválidos.');
    out(USAGE);

    return 1;
  }

  const allowedIssuers = parseIssuerAllowlist(process.env[PROVISIONING_ISSUERS_ENV]);

  if (allowedIssuers.length === 0) {
    out(
      `${PROVISIONING_ISSUERS_ENV} no declara ningún emisor admitido. ` +
        'El comando termina sin tocar la base de datos.',
    );

    return 1;
  }

  let operations: readonly ProvisioningOperation[];

  try {
    const content = await readFile(options.file, 'utf8');
    operations = parseOperationsFile(content, allowedIssuers);
  } catch (error) {
    // El motivo nombra la operación y el campo, nunca su valor ni la ruta.
    out(
      error instanceof Error && error.name === 'ProvisioningFileError'
        ? error.message
        : 'No fue posible leer el archivo de operaciones indicado.',
    );

    return 1;
  }

  out(
    `Modo: ${options.apply ? 'APPLY (escribe)' : 'DRY-RUN (no escribe)'}. ` +
      `Operaciones declaradas: ${operations.length}.`,
  );

  const client = await openClient(process.env);
  const tenants = new Map<string, string | null>();
  let fallidas = 0;

  try {
    for (const [index, operation] of operations.entries()) {
      const etiqueta = `#${index + 1} ${operation.action}`;

      if (!tenants.has(operation.tenantCode)) {
        tenants.set(
          operation.tenantCode,
          await resolveTenantId(client, operation.tenantCode),
        );
      }

      const tenantId = tenants.get(operation.tenantCode) ?? null;

      if (tenantId === null) {
        fallidas += 1;
        out(`${etiqueta} -> NOT_FOUND: el tenant indicado no existe.`);
        continue;
      }

      let resultado: OperationResult;

      try {
        resultado = await withRuntimeTransaction(
          client,
          tenantId,
          options.apply,
          async (sql) => runOperation(sql, tenantId, operation, randomUUID()),
        );
      } catch (error) {
        fallidas += 1;
        out(
          `${etiqueta} -> REJECTED: ${
            error instanceof Error ? error.name : 'error desconocido'
          }. La transacción se revirtió completa.`,
        );
        continue;
      }

      if (resultado.outcome === 'CONFLICT' || resultado.outcome === 'NOT_FOUND') {
        fallidas += 1;
      }

      out(describe(etiqueta, resultado, options.apply));
    }
  } finally {
    await client.end().catch(() => undefined);
  }

  if (!options.apply) {
    out(
      'DRY-RUN terminado: la base de datos NO se modificó. ' +
        'Repita con «--apply» para escribir.',
    );
  }

  return fallidas === 0 ? 0 : 1;
}

function describe(
  etiqueta: string,
  resultado: OperationResult,
  apply: boolean,
): string {
  const partes = [`${etiqueta} -> ${resultado.outcome}`];

  if (resultado.identityFingerprint !== null) {
    partes.push(`identidad=${resultado.identityFingerprint}`);
  }

  if (resultado.humanAccountId !== null) {
    partes.push(`humanAccountId=${resultado.humanAccountId}`);
  }

  if (resultado.revokedSessions > 0) {
    partes.push(
      `${apply ? 'sesiones revocadas' : 'sesiones que se revocarían'}=${resultado.revokedSessions}`,
    );
  }

  partes.push(`(${resultado.detail})`);

  return partes.join(' ');
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // Nunca se imprime la causa completa: podría contener la cadena de conexión.
    out(
      `El comando terminó con un error no controlado: ${
        error instanceof Error ? error.name : 'desconocido'
      }.`,
    );
    process.exitCode = 1;
  });
