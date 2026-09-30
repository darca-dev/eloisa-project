/**
 * Registro de solicitudes de acceso (SPEC 038; MP02-C1, ampliado por MP04).
 *
 * QUÉ HACE EXACTAMENTE: registra el INTERÉS de una persona en el entorno
 * funcional. Crea o recupera una `Person` ficticia del tenant resuelto en el
 * servidor y una fila `AccessRequest` en estado `PENDING`, devuelve una
 * referencia opaca y —MP04— prepara la identidad de esa solicitud en el
 * proveedor: una `HumanAccount` DESHABILITADA y un usuario externo también
 * deshabilitado, enlazados por el `sub` real.
 *
 * QUÉ NO HACE —y no debe crecer sin un paquete aprobado—:
 * - NO crea `Patient`, `ProfessionalProfile`, relación, sesión, token, cookie ni
 *   asignación, y NO activa la cuenta que prepara. La activación —y con ella el
 *   acceso— es exclusiva de la aprobación y de su saga.
 * - NO decide ni revisa. `status` y `provisioningStatus` los fija el servidor y
 *   solo nacen; ningún método de este servicio los transiciona.
 * - NO acepta tenant del cliente. `tenantId` sale siempre de
 *   `TenantContextService` y cada lectura y escritura ocurre dentro de
 *   `PrismaService.withTenant()`.
 * - NO consulta Row Level Security, roles, permisos ni Audit genérico.
 * - NO conserva la contraseña. Vive el tiempo de una llamada a la preparación y
 *   no se copia a este servicio, a un log, a una excepción ni a la respuesta.
 *
 * IDEMPOTENCIA: la clave natural es `(tenantId, persona, requestedProfile)`. Si
 * ya existe una solicitud ABIERTA, la respuesta repite la MISMA referencia en
 * lugar de crear una segunda fila. Esa no es una cortesía: la migración declara
 * un índice único parcial por persona y perfil, de modo que la carrera de dos
 * peticiones simultáneas con la misma persona se resuelve en la base de datos y
 * el perdedor debe releer, no reintentar a ciegas. La preparación de identidad
 * es idempotente por el mismo motivo: si la solicitud ya tiene cuenta, no vuelve
 * a crear usuario ni a llamar al proveedor.
 *
 * LA `Person` EXISTE SIN `Patient`. Es deliberado: el formulario del entorno
 * funcional es más corto que el de inscripción y una `Person` sin `Patient` no es
 * un paciente. Confundir ambos modelos convertiría este paquete en un alta
 * clínica, que es exactamente lo que la especificación prohíbe.
 */

import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';

/*
 * `AuditService`, `PrismaService` y `TenantContextService` se importan como
 * VALOR. Nest los resuelve por su clase en tiempo de ejecución, y esa clase solo
 * llega al contenedor a través de la metadata que emite el decorador del
 * constructor. Un `import type` se borra en la compilación, la metadata sale
 * como `Object` y el arranque falla con «can't resolve dependencies».
 * `PrismaTransaction`, en cambio, sí es un tipo y se importa como tal.
 */
/* eslint-disable @typescript-eslint/consistent-type-imports -- Ver la nota de arriba. */
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { TenantContextService } from '../database/tenant-context.service';

import {
  ACCESS_REQUEST_REFERENCE_PREFIX,
  OPEN_ACCESS_REQUEST_STATUSES,
  type AccessRequestResultDto,
} from './access-request.contract';
import { validateAccessRequestBody, type ValidatedAccessRequest } from './access-request.validation';
import { AccessProvisioningService } from './access-provisioning.service';

/**
 * Origen de toda solicitud creada por este paquete.
 *
 * Fijado por decisión OD-11 y NO configurable: un despliegue de demostración no
 * debe poder presentar datos ficticios como si fueran producción. Los paquetes
 * posteriores (MP05) introducirán los demás orígenes con su propio paquete.
 */
const ACCESS_REQUEST_SOURCE = 'TEST_DATA' as const;

/** Estado y aprovisionamiento iniciales. Los fija el servidor, no el cliente. */
const INITIAL_STATUS = 'PENDING' as const;
const INITIAL_PROVISIONING_STATUS = 'NOT_STARTED' as const;
const INITIAL_VERSION = 1;

/** Bytes de entropía de la referencia opaca. */
const REFERENCE_RANDOM_BYTES = 12;

/**
 * Intentos totales ante una violación de unicidad concurrente.
 *
 * Tres intentos cubren la carrera de dos peticiones simultáneas con un margen
 * amplio. Agotarlos NO se reintenta: se traduce a `503`, porque a partir de ahí
 * la hipótesis «otra vez gana el mismo vecino» ya no es defendible y seguir
 * insistir convertiría un defecto de concurrencia en una carga sobre la base de
 * datos.
 */
const MAX_UNIQUE_RACE_ATTEMPTS = 3;

/** Prisma etiqueta las violaciones de unicidad con este código. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/** Ruta del endpoint, para trazabilidad del evento de auditoría. */
const ENDPOINT = '/api/v1/access-requests';

export type AccessRequestFailureKind = 'INVALID_BODY' | 'UNAVAILABLE';

export interface AccessRequestFailure {
  readonly kind: AccessRequestFailureKind;
  /** Solo en `INVALID_BODY`. Nombres de campo; nunca valores. */
  readonly fields?: readonly string[];
}

export type AccessRequestSubmission =
  | { readonly ok: true; readonly created: boolean; readonly value: AccessRequestResultDto }
  | { readonly ok: false; readonly failure: AccessRequestFailure };

/**
 * Resultado de la transacción de registro, con lo que la preparación de
 * identidad necesita para continuar.
 *
 * `personId` y `accessRequestId` viajan juntos porque son los dos únicos datos
 * que `prepararIdentidad` necesita además de la contraseña, que NO viaja aquí:
 * permanece en el marco de `submit` y se pasa a la preparación como argumento
 * suelto, de modo que no quede ningún objeto intermedio que un día pueda
 * registrarse entero por error.
 */
interface AccessRequestPersistResult {
  readonly submission: AccessRequestSubmission;
  readonly tenantId: string;
  readonly personId: string;
  readonly accessRequestId: string;
  readonly reference: string;
}

/**
 * Genera una referencia opaca con generador criptográficamente seguro.
 *
 * No contiene documento, nombre, teléfono, correo ni fecha: es un identificador
 * de conversación, no un dato de negocio. 96 bits de entropía hacen inviable
 * adivinarla o enumerarla dentro del tenant.
 */
function generateAccessRequestReference(): string {
  return `${ACCESS_REQUEST_REFERENCE_PREFIX}-${randomBytes(REFERENCE_RANDOM_BYTES)
    .toString('hex')
    .toUpperCase()}`;
}

/**
 * Detecta una violación de unicidad de Prisma sin distinguir su causa.
 *
 * La SPEC exige resolver releyendo en el tenant las carreras de documento y del
 * índice parcial, y responder igual en ambos casos. NO se distingue el motivo:
 * no se propaga, no se registra y no se devuelve, y esta función solo decide
 * si conviene volver a intentarlo. Inspeccionar `meta.target` obligaría a
 * comparar nombres de restricción, y un nombre de restricción que llega a un
 * log o a un mensaje de error describe la estructura interna de la base de datos.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { readonly code?: unknown }).code === PRISMA_UNIQUE_VIOLATION
  );
}

@Injectable()
export class AccessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantContextService,
    private readonly audit: AuditService,
    private readonly provisioning: AccessProvisioningService,
  ) {}

  /**
   * Registra una solicitud de acceso de forma idempotente y prepara su
   * identidad en el proveedor (MP04).
   *
   * La preparación ocurre DESPUÉS de que la transacción haya confirmado, y
   * nunca dentro de ella: crear un usuario en el proveedor dentro de una
   * transacción que después puede abortar dejaría un usuario huérfano que nadie
   * puede volver a crear ni a borrar, porque su username es la referencia de una
   * solicitud que ya no existe.
   *
   * Si la preparación falla, la respuesta es `503 UNAVAILABLE`. La solicitud SÍ
   * quedó registrada —la referencia es válida— y repetir el mismo formulario
   * reanuda exactamente la preparación pendiente: no hay estado en el que el
   * cliente se quede sin saber qué hacer.
   *
   * @param body Cuerpo crudo, todavía sin validar.
   * @param now  Instante del servidor. Define qué fecha de nacimiento es futura
   *             y queda persistido como `submittedAt`.
   */
  public async submit(body: unknown, now: Date): Promise<AccessRequestSubmission> {
    const validation = validateAccessRequestBody(body, now);

    if (!validation.ok) {
      return { ok: false, failure: { kind: 'INVALID_BODY', fields: validation.fields } };
    }

    // El tenant se resuelve UNA vez, en el servidor, antes de abrir la
    // transacción. El cliente no puede elegirlo ni insistir con otro.
    const { tenantId } = await this.tenants.resolveActiveTenant();

    let persistido: AccessRequestPersistResult | null = null;

    for (let attempt = 1; attempt <= MAX_UNIQUE_RACE_ATTEMPTS; attempt += 1) {
      try {
        persistido = await this.prisma.withTenant(tenantId, (tx) =>
          this.persistWithin(tx, { tenantId, input: validation.value, now }),
        );
        break;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === MAX_UNIQUE_RACE_ATTEMPTS) {
          throw error;
        }

        /*
         * Carrera ganada por otra petición: la transacción se revirtió entera y
         * la siguiente iteración vuelve a leer el estado real del tenant. Ese
         * es el único camino correcto. Reintentar la escritura a ciegas volvería
         * a chocar con el índice único; y propagar el error de Prisma filtraría
         * el nombre de la restricción.
         */
      }
    }

    if (persistido === null) {
      /* Inalcanzable: el bucle retorna, asigna o lanza en cada iteración. */
      throw new Error('bucle de registro de solicitud de acceso agotado sin resultado');
    }

    if (!persistido.submission.ok) {
      return persistido.submission;
    }

    try {
      await this.provisioning.prepararIdentidad(
        {
          tenantId: persistido.tenantId,
          personId: persistido.personId,
          accessRequestId: persistido.accessRequestId,
          reference: persistido.reference,
          password: validation.value.password,
        },
        now,
      );
    } catch {
      /*
       * La causa ya quedó clasificada y auditada dentro de la preparación. Aquí
       * solo se decide la respuesta pública: un `400` diría que el formulario
       * está mal cuando el formulario está bien, y detallar el proveedor
       * convertiría un endpoint público en un sondeo de la infraestructura.
       */
      return { ok: false, failure: { kind: 'UNAVAILABLE' } };
    }

    return persistido.submission;
  }

  /**
   * Escritura completa dentro de UNA transacción con contexto de tenant.
   *
   * El orden importa: primero la `Person`, después la solicitud abierta, y solo
   * si no existe, la nueva fila y su auditoría. Así, una repetición nunca crea
   * un evento `ACCESS_REQUEST_CREATED` y una auditoría nunca queda huérfana de su
   * fila.
   */
  private async persistWithin(
    tx: PrismaTransaction,
    context: {
      readonly tenantId: string;
      readonly input: ValidatedAccessRequest;
      readonly now: Date;
    },
  ): Promise<AccessRequestPersistResult> {
    const { tenantId, input, now } = context;

    const person = await this.resolvePerson(tx, tenantId, input);

    const open = await tx.accessRequest.findFirst({
      where: {
        tenantId,
        personId: person.id,
        requestedProfile: input.requestedProfile,
        status: { in: [...OPEN_ACCESS_REQUEST_STATUSES] },
      },
      select: { id: true, reference: true, status: true, source: true },
    });

    if (open !== null) {
      return {
        submission: {
          ok: true,
          created: false,
          value: { reference: open.reference, status: open.status, source: open.source },
        },
        tenantId,
        personId: person.id,
        accessRequestId: open.id,
        reference: open.reference,
      };
    }

    const created = await tx.accessRequest.create({
      data: {
        tenantId,
        personId: person.id,
        requestedProfile: input.requestedProfile,
        status: INITIAL_STATUS,
        provisioningStatus: INITIAL_PROVISIONING_STATUS,
        source: ACCESS_REQUEST_SOURCE,
        reference: generateAccessRequestReference(),
        version: INITIAL_VERSION,
        submittedAt: now,
        reviewedByInstitutionalIdentityId: null,
        decidedAt: null,
        decisionReasonCode: null,
        provisioningReference: null,
      },
      select: { id: true, reference: true, status: true, source: true },
    });

    /*
     * Auditoría atómica y sin PII. Se escribe SOLO en la rama de creación: un
     * reintento correcto no produce un segundo `ACCESS_REQUEST_CREATED`, porque
     * ese evento afirma que algo se creó y en la repetición no se creó nada.
     *
     * `resourceId` es el identificador interno de la fila, no la referencia ni
     * ningún dato de la persona. El cuerpo recibido —documento, nombres,
     * teléfono, correo— no se copia al evento ni a ningún log.
     *
     * `correlationId` es un UUID generado AQUÍ. No se toma del cuerpo ni de una
     * cabecera: un identificador de correlación elegido por el cliente es un
     * canal de inyección en la trazabilidad, y aquí no aporta nada que el UUID
     * del servidor no dé.
     */
    await this.audit.recordAccessRequestCreatedWithin(
      tx,
      {
        tenantId,
        accessRequestId: created.id,
        endpoint: ENDPOINT,
        correlationId: randomUUID(),
      },
      now,
    );

    return {
      submission: {
        ok: true,
        created: true,
        value: { reference: created.reference, status: created.status, source: created.source },
      },
      tenantId,
      personId: person.id,
      accessRequestId: created.id,
      reference: created.reference,
    };
  }

  /**
   * Devuelve la `Person` del tenant para ese documento, o la crea.
   *
   * NUNCA actualiza una `Person` existente. Una segunda envío con el mismo
   * documento pero otros nombres no corrige los nombres anteriores ni pisa el
   * teléfono declarado en el primer envío: este paquete registra interés, no
   * mantiene datos personales. La eventual actualización de identidad pertenece
   * al módulo de relaciones ya aprobado, no a este endpoint público.
   */
  private async resolvePerson(
    tx: PrismaTransaction,
    tenantId: string,
    input: ValidatedAccessRequest,
  ): Promise<{ readonly id: string }> {
    const existing = await tx.person.findFirst({
      where: {
        tenantId,
        documentType: input.documentType,
        documentNumberNormalized: input.documentNumberNormalized,
      },
      select: { id: true },
    });

    if (existing !== null) {
      return existing;
    }

    return tx.person.create({
      data: {
        tenantId,
        documentType: input.documentType,
        documentNumber: input.documentNumberDeclared,
        documentNumberNormalized: input.documentNumberNormalized,
        givenNames: input.givenNames,
        familyNames: input.familyNames,
        birthDate: input.birthDate,
        sexGenderCode: input.sexGenderCode,
        phone: input.phone,
        email: input.email,
      },
      select: { id: true },
    });
  }
}
