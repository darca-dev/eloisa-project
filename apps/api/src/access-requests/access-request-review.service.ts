/**
 * Revisión hospitalaria de solicitudes de acceso (SPEC 038; MP03-C1, ampliado por MP04).
 *
 * QUÉ HACE EXACTAMENTE: lee el backlog de solicitudes de acceso del tenant del
 * revisor, devuelve el detalle de una de ellas y aplica una decisión del
 * catálogo cerrado —aprobar, rechazar, reintentar provisión, suspender,
 * reactivar, revocar— con control de concurrencia optimista y auditoría atómica.
 *
 * QUÉ NO HACE —y no debe crecer sin un paquete aprobado—:
 * - NO decide en solitario el estado final de una aprobación. Las acciones de
 *   SAGA solo abren `APPROVED_PENDING_PROVISIONING`; `APPROVED` y
 *   `PROVISIONING_FAILED` los escribe `AccessProvisioningService` en su propia
 *   transacción, después de que el proveedor haya respondido. Afirmar `APPROVED`
 *   aquí sería mentir mientras la red no ha dicho nada.
 * - NO crea perfiles, relaciones, sesiones, tokens ni asignaciones. La
 *   participación mínima que la saga crea es una fila de participación, no una
 *   relación Cuidador-Paciente ni una asignación profesional.
 * - NO acepta tenant del cliente. `tenantId` sale del principal de la sesión, y
 *   toda lectura y toda escritura ocurre dentro de `PrismaService.withTenant()`.
 *   Una solicitud de otro tenant es indistinguible de una que no existe.
 * - NO introduce texto libre. El motivo es un código del catálogo cerrado, y cada
 *   acción exige EXACTAMENTE el suyo.
 * - NO toca `reviewedAt` fuera de la decisión ni corrige datos de la `Person`: la
 *   revisión registra una decisión, no mantiene datos personales.
 *
 * AISLAMIENTO EN LA CONSULTA. El `where` incluye SIEMPRE `tenantId`, además del
 * RLS de PostgreSQL. La Defense in Depth no es decorativa: el RLS protege la
 * fila y la cláusula `tenantId` hace que el criterio de aislamiento sea legible
 * en la propia consulta, sobreviva a un cambio de sesión de base de datos y no
 * dependa de que la migración sigue aplicada.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/*
 * `AuditService` y `PrismaService` se importan como VALOR y no como tipo: Nest
 * los resuelve por su clase en tiempo de ejecución para construir el proveedor.
 * Un `import type` compila igual y rompe la inyección en el arranque, así que
 * la corrección automática de `consistent-type-imports` no puede aplicarse aquí
 * sin distinguir un caso del otro a mano.
 */
/* eslint-disable @typescript-eslint/consistent-type-imports -- Ver la nota de arriba. */
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { type Prisma } from '../generated/prisma/client';
import { type InstitutionalPrincipal } from '../institutional-auth/institutional-auth.service';

import {
  ACCESS_REQUEST_DECISION,
  isDeactivatingAction,
  type AccessRequestReviewAction,
  type AccessRequestReviewDecisionDto,
  type AccessRequestReviewDetailDto,
  type AccessRequestReviewListDto,
  type AccessRequestReviewListItem,
} from './access-request-review.contract';
import {
  encodeAccessRequestReviewCursor,
  validateAccessRequestDecisionBody,
  validateAccessRequestReviewQuery,
  type ValidatedAccessRequestReviewQuery,
} from './access-request-review.validation';
import {
  AccessProvisioningService,
  type AccessProvisioningDeactivationResult,
} from './access-provisioning.service';
import { readAccessRequestSnapshot } from './access-request.service';

/** Rutas lógicas de la superficie, para la traza. Sin identificadores. */
const ENDPOINT_LISTA = 'GET /api/v1/hospital/access-requests';
const ENDPOINT_DETALLE = 'GET /api/v1/hospital/access-requests/:requestId';
const ENDPOINT_DECISION =
  'POST /api/v1/hospital/access-requests/:requestId/decision';

/**
 * Denominación de los desenlaces de esta superficie.
 *
 * Son NOMBRES INTERNOS que el controlador traduce a un código de error HTTP. Se
 * separan del contrato público para que el servicio nunca dependa de las clases
 * de excepción de HTTP y para que cada camino de fallo tenga UN origen: si el
 * servicio fabricara la respuesta, un nuevo fallo elegiría su propio código y
 * el catálogo público dejaría de estar cerrado.
 */
export type AccessRequestReviewFailureKind =
  | 'INVALID_QUERY'
  | 'INVALID_REQUEST_ID'
  | 'INVALID_BODY'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAVAILABLE';

export interface AccessRequestReviewFailure {
  readonly kind: AccessRequestReviewFailureKind;
  /** Solo en los fallos de validación. Nombres de campo; nunca valores. */
  readonly fields?: readonly string[];
}

export type AccessRequestReviewListResult =
  | { readonly ok: true; readonly value: AccessRequestReviewListDto }
  | { readonly ok: false; readonly failure: AccessRequestReviewFailure };

export type AccessRequestReviewDetailResult =
  | { readonly ok: true; readonly value: AccessRequestReviewDetailDto }
  | { readonly ok: false; readonly failure: AccessRequestReviewFailure };

export type AccessRequestReviewDecisionResult =
  | { readonly ok: true; readonly value: AccessRequestReviewDecisionDto }
  | { readonly ok: false; readonly failure: AccessRequestReviewFailure };

/**
 * Resultado de la transacción 1 cuando NO escribió nada.
 *
 * Es el fallo más el caso de repetición, y deliberadamente NO incluye la rama
 * `{ ok: true, value }` del resultado público: esa rama solo la produce la
 * relectura final, y mezclarla aquí haría que TypeScript ofreciera un `value`
 * inexistente en el camino de repetición.
 */
type AccessRequestReviewStepResult =
  | { readonly ok: false; readonly failure: AccessRequestReviewFailure }
  | {
      readonly ok: true;
      /** Estado de la fila DESPUÉS de la transacción. */
      readonly status: string;
      /** Vínculos externos que aún queda que deshabilitar en el proveedor. */
      readonly subjects: readonly string[];
      /** `true` cuando procede sincronizar `enabled = false` tras confirmar. */
      readonly sincronizar: boolean;
    };

/**
 * Columnas de la `Person` que la superficie puede devolver.
 *
 * Es una `select` EXPLÍCITA y no un `include` completo. La diferencia importa:
 * `include` trae también el `tenantId` de la persona, y añadir un campo al
 * modelo en el futuro lo publicaría en la bandeja sin que nadie lo decidiera.
 * Con una lista explícita, un campo nuevo exige una decisión conscious.
 */
const PERSONA_REVISABLE = {
  givenNames: true,
  familyNames: true,
  documentType: true,
  documentNumber: true,
  birthDate: true,
  sexGenderCode: true,
  phone: true,
  email: true,
} as const;

/** Proyección común de listado y detalle, en columnas y no en modelos. */
const SOLICITUD_REVISABLE = {
  id: true,
  reference: true,
  requestedProfile: true,
  status: true,
  version: true,
  submittedAt: true,
  decidedAt: true,
  decisionReasonCode: true,
  provisioningStatus: true,
  provisioningAttempts: true,
  provisioningErrorCode: true,
  person: { select: PERSONA_REVISABLE },
} as const;

@Injectable()
export class AccessRequestReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly provisioning: AccessProvisioningService,
  ) {}

  /**
   * Listado paginado del backlog del tenant del revisor.
   *
   * El orden es `submittedAt DESC, id DESC`, que es el ÚNICO orden estable
   * compatible con el cursor: el desempate por `id` garantiza que una fila no
   * cambie de página entre dos lecturas y que ninguna se pierda al insertarse una
   * solicitud nueva mientras se pagina. Ordenar solo por fecha dejaría filas con
   * la misma marca de tiempo en un orden arbitrario, y el cursor las repetiría o
   * las saltaría.
   */
  public async list(
    principal: InstitutionalPrincipal,
    rawQuery: unknown,
    now: Date,
  ): Promise<AccessRequestReviewListResult> {
    const validation = validateAccessRequestReviewQuery(rawQuery);

    if (!validation.ok) {
      return { ok: false, failure: { kind: 'INVALID_QUERY', fields: validation.fields } };
    }

    const { tenantId } = principal;
    const { limit, ...filtros } = validation.value;

    return this.prisma.withTenant(tenantId, async (tx) => {
      /*
       * Se piden `limit + 1` filas para poder afirmar que no hay página
       * siguiente SIN un segundo COUNT: si llegan menos de `limit + 1`, la
       * respuesta es la última página y `nextCursor` es `null`. Una consulta de
       * conteo aparte costaría lo mismo que la página entera y abriría una
       * ventana de inconsistencia entre el número contado y el devuelto.
       */
      const rows = await tx.accessRequest.findMany({
        where: whereDelListado(tenantId, filtros),
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: SOLICITUD_REVISABLE,
      });

      const haySiguiente = rows.length > limit;
      const pagina = haySiguiente ? rows.slice(0, limit) : rows;
      const ultimo = pagina.at(-1);

      /*
       * La concesión se audita con el MISMO contexto de tenant y en la misma
       * transacción que la lectura que autoriza. Se escribe DESPUÉS de leer: si
       * la lectura falla, no hay concesión que registrar, y una traza de
       * «concedido» sin lectura detrás sería un registro de algo que no ocurrió.
       *
       * `resourceId` es NULO: el evento afirma que el rol pudo leer el backlog,
       * no qué solicitudes leyó. Guardar la primera fila convertiría la traza en
       * un inventario de lo que el cliente vio.
       */
      await this.audit.recordAccessRequestListGrantedWithin(
        tx,
        {
          tenantId,
          identityId: principal.identityId,
          role: principal.role,
          endpoint: ENDPOINT_LISTA,
          correlationId: randomUUID(),
        },
        now,
      );

      return {
        ok: true,
        value: {
          items: pagina.map((row) => aListItem(row)),
          nextCursor:
            haySiguiente && ultimo !== undefined
              ? encodeAccessRequestReviewCursor(ultimo)
              : null,
        },
      };
    });
  }

  /**
   * Detalle de UNA solicitud del tenant del revisor.
   *
   * Un identificador ajeno y uno inexistente producen EXACTAMENTE la misma
   * respuesta `404`, con el mismo cuerpo. Distinguirlos convertiría la bandeja en
   * un oráculo de existencia: quien probara identificadores sabría cuáles
   * pertenecen a otra institución, y con ellos cuántas solicitudes tiene y en
   * qué estado. La opacidad se aplica en el servidor, no en el cliente.
   */
  public async detail(
    principal: InstitutionalPrincipal,
    requestId: string,
    now: Date,
  ): Promise<AccessRequestReviewDetailResult> {
    const { tenantId } = principal;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const fila = await tx.accessRequest.findFirst({
        where: { id: requestId, tenantId },
        select: SOLICITUD_REVISABLE,
      });

      if (fila === null) {
        return { ok: false, failure: { kind: 'NOT_FOUND' } };
      }

      await this.audit.recordAccessRequestViewedWithin(
        tx,
        {
          tenantId,
          identityId: principal.identityId,
          role: principal.role,
          accessRequestId: fila.id,
          endpoint: ENDPOINT_DETALLE,
          correlationId: randomUUID(),
        },
        now,
      );

      /*
       * El expediente sale SOLO aquí: lectura acotada a sus dos columnas, en
       * la misma transacción con tenant y bajo la misma auditoría de consulta.
       * El listado no lo toca y una fila sin expediente devuelve nulos.
       */
      const expediente = await readAccessRequestSnapshot(tx, tenantId, fila.id);

      return { ok: true, value: aDetailDto(fila, expediente) };
    });
  }

  /**
   * Aplica una decisión sobre UNA solicitud del catálogo cerrado.
   *
   * DOS FASES, y su orden no es un detalle:
   *
   * 1. UNA transacción que escribe la transición, la auditoría de decisión y —en
   *    `SUSPEND` y `REVOKE`— la desactivación de la cuenta con todas sus
   *    sesiones. Todo o nada: si el evento no puede persistirse, no hay
   *    decisión; si la cuenta no puede deshabilitarse, no hay decisión.
   * 2. FUERA de esa transacción, y solo si la acción lo pide, la saga de
   *    provisión o la sincronización externa `enabled = false`. Una llamada de
   *    red dentro de una transacción dejaría filas bloqueadas durante toda la
   *    espera, de modo que un proveedor lento se convertiría en un bloqueo
   *    sostenido sobre la bandeja del hospital.
   *
   * CONCURRENCIA OPTIMISTA. La escritura se condiciona a
   * `(tenantId, requestId, estado origen, version)`, de modo que la base de
   * datos —y no una comprobación previa en TypeScript— decide quién gana. Leer
   * el estado y después escribir sería una condición de carrera: dos revisores
   * que leyeron la misma versión escribirían ambos y el segundo sobrescribiría
   * la decisión del primero. Con `updateMany` condicionado, el segundo encuentra
   * cero filas y el resultado es un `409` honesto.
   *
   * REPETICIÓN IDEMPOTENTE. Una repetición exacta —mismo actor, misma acción,
   * mismo motivo, misma `expectedVersion`— devuelve el resultado vigente sin
   * escribir de nuevo y sin un segundo evento. Y si la repetición de una acción
   * de saga encuentra la fila todavía en `APPROVED_PENDING_PROVISIONING` —la
   * saga anterior no llegó a concluir—, vuelve a ejecutarla: la decisión ya
   * estaba registrada, lo que faltaba era terminar de aplicarla.
   *
   * ATOMICIDAD. `version` se incrementa en la transición y OTRA vez en la saga,
   * porque la fila cambia dos veces. Quien reenvía una versión vencida recibe
   * `409`, no una aprobación aparente.
   */
  public async decide(
    principal: InstitutionalPrincipal,
    requestId: string,
    rawBody: unknown,
    now: Date,
  ): Promise<AccessRequestReviewDecisionResult> {
    const validation = validateAccessRequestDecisionBody(rawBody);

    if (!validation.ok) {
      return { ok: false, failure: { kind: 'INVALID_BODY', fields: validation.fields } };
    }

    const { tenantId } = principal;
    const { action, expectedVersion, reasonCode } = validation.value;
    const decision = ACCESS_REQUEST_DECISION[action];
    const desactivante = isDeactivatingAction(action);

    const paso = await this.prisma.withTenant(tenantId, async (tx) => {
      const actualizada = await tx.accessRequest.updateMany({
        where: {
          id: requestId,
          tenantId,
          status: { in: [...decision.sourceStatuses] },
          version: expectedVersion,
        },
        data: {
          status: decision.targetStatus,
          version: { increment: 1 },
          decidedAt: now,
          decisionReasonCode: decision.reasonCode,
          reviewedByInstitutionalIdentityId: principal.identityId,
          /*
           * `provisioningStatus` NO se toca aquí. Aprobar deja la solicitud
           * ESPERANDO provisión: afirmar que la provisión empezó sería mentir
           * mientras el proveedor no ha respondido. Lo escribe la saga, que es
           * quien realmente la ejecuta.
           */
        },
      });

      if (actualizada.count === 0) {
        return this.resolverSinCambio(tx, principal, requestId, action, reasonCode, expectedVersion);
      }

      let desactivacion: AccessProvisioningDeactivationResult | null = null;

      if (desactivante) {
        const fila = await tx.accessRequest.findFirst({
          where: { id: requestId, tenantId },
          select: { humanAccountId: true },
        });

        if (fila !== null && fila.humanAccountId !== null) {
          /*
           * MISMA transacción que el cambio de estado. Si la solicitud queda
           * `SUSPENDED` o `REVOKED`, la cuenta ya está deshabilitada y sus
           * sesiones ya revocadas en ese mismo instante: no hay una ventana en
           * la que la fila diga «suspendido» pero el cookie de antes siga
           * sirviendo peticiones.
           */
          desactivacion = await this.provisioning.desactivarCuentaWithin(
            tx,
            {
              tenantId,
              humanAccountId: fila.humanAccountId,
              unlinkIdentity: action === 'REVOKE',
            },
            now,
          );

          await this.audit.recordHumanAccountDeactivatedWithin(
            tx,
            {
              tenantId,
              humanAccountId: fila.humanAccountId,
              endpoint: ENDPOINT_DECISION,
              correlationId: randomUUID(),
              identityUnlinked: action === 'REVOKE',
              sessionsRevoked: desactivacion.sessionsRevoked,
            },
            now,
          );
        }
      }

      if (decision.eventType !== null) {
        await this.audit.recordAccessRequestDecisionWithin(
          tx,
          {
            tenantId,
            identityId: principal.identityId,
            role: principal.role,
            accessRequestId: requestId,
            action,
            endpoint: ENDPOINT_DECISION,
            correlationId: randomUUID(),
          },
          now,
        );
      }

      const emitida = await tx.accessRequest.findFirst({
        where: { id: requestId, tenantId },
        select: { status: true },
      });

      if (emitida === null) {
        // Inalcanzable con `tenantId` en la condición de la propia escritura.
        throw new Error('la solicitud decidida no es legible tras su propia escritura');
      }

      return {
        ok: true as const,
        status: emitida.status,
        subjects: desactivacion?.externalSubjects ?? [],
        sincronizar: desactivante && desactivacion !== null,
      };
    });

    if (!paso.ok) {
      return paso;
    }

    /*
     * Fase 2, FUERA de la transacción. La condición es el ESTADO DE LA FILA, no
     * la acción pedida: así, una repetición cuya saga anterior quedó a medias
     * vuelve a ejecutarla, mientras que una repetición de una decisión ya
     * concluida no repite ni la provisión ni la sincronización.
     */
    if (decision.runsSaga && paso.status === 'APPROVED_PENDING_PROVISIONING') {
      await this.provisioning.aprovisionar(
        { tenantId, accessRequestId: requestId, endpoint: ENDPOINT_DECISION },
        now,
      );
    } else if (paso.sincronizar) {
      /*
       * BEST-EFFORT y DESPUÉS del bloqueo MERDN, que ya está confirmado dentro
       * de la transacción. Un proveedor caído no desbloquea nada: la cuenta
       * sigue deshabilitada y las sesiones siguen revocadas en la base.
       */
      await this.provisioning.sincronizarDeshabilitacion(paso.subjects);
    }

    return this.leerDecision(tenantId, requestId, reasonCode);
  }

  /**
   * Relee la decisión ya aplicada y la proyecta.
   *
   * Se relee DESPUÉS de la fase 2 porque la saga incrementa `version` y puede
   * cambiar el estado: la respuesta a la cliente debe describir la fila FINAL,
   * no la que dejó la primera transacción.
   */
  private async leerDecision(
    tenantId: string,
    requestId: string,
    reasonCode: string,
  ): Promise<AccessRequestReviewDecisionResult> {
    const fila = await this.prisma.withTenant(tenantId, (tx) =>
      tx.accessRequest.findFirst({
        where: { id: requestId, tenantId },
        select: {
          id: true,
          reference: true,
          status: true,
          version: true,
          decidedAt: true,
          decisionReasonCode: true,
        },
      }),
    );

    if (fila === null || fila.decidedAt === null) {
      // O no existe, o nunca fue decidida: en ambos casos no hay decisión que
      // devolver, y el `404` opaco es la respuesta honesta.
      return { ok: false, failure: { kind: 'NOT_FOUND' } };
    }

    return {
      ok: true,
      value: {
        requestId: fila.id,
        reference: fila.reference,
        status: fila.status,
        version: fila.version,
        decisionReasonCode: fila.decisionReasonCode ?? reasonCode,
        decidedAt: fila.decidedAt.toISOString(),
      },
    };
  }

  /**
   * Desenlace de un `updateMany` que no escribió nada.
   *
   * Hay tres razones posibles y NO se distinguen entre sí en la respuesta:
   *
   * 1. La decisión es una REPETICIÓN EXACTA de la que ya se aplicó. Se relee la
   *    fila y, si el estado, la versión, el motivo y el revisor coinciden con lo
   *    pedido, se devuelve el resultado vigente sin escribir ni auditar de nuevo.
   *    Un reintento del mismo cliente tras perder la respuesta debe poder conocer
   *    el resultado, no recibir un conflicto que le exija reintentar otra vez
   *    para siempre.
   * 2. La solicitud no existe, o es de otro tenant. Se responde con el MISMO
   *    `404` opaco que el detalle, por la misma razón: un `409` aquí confirmaría
   *    que el identificador existe.
   * 3. El estado ya no es uno de los de origen o la versión está vencida. Se
   *    responde `409`, sin decir cuál de las dos cosas ocurrió: distinguir «ya
   *    lo decidió otro» de «cambió el contenido» informa a un cliente que no
   *    debería saber nada del estado interno de la fila.
   *
   * PARA UNA ACCIÓN DE SAGA, `APPROVED_PENDING_PROVISIONING` también cuenta como
   * repetición. No es un estado concluido —por eso no está en `settledStatuses`—
   * pero sí es el resultado EXACTO de la transacción que esta misma acción
   * escribió, y devolver `409` dejaría una solicitud huérfana sin ninguna acción
   * capaz de terminar lo que empezó. Quien repite la reabre y la saga continúa.
   */
  private async resolverSinCambio(
    tx: PrismaTransaction,
    principal: InstitutionalPrincipal,
    requestId: string,
    action: AccessRequestReviewAction,
    reasonCode: string,
    expectedVersion: number,
  ): Promise<AccessRequestReviewStepResult> {
    const actual = await tx.accessRequest.findFirst({
      where: { id: requestId, tenantId: principal.tenantId },
      select: {
        status: true,
        version: true,
        decidedAt: true,
        decisionReasonCode: true,
        reviewedByInstitutionalIdentityId: true,
      },
    });

    if (actual === null) {
      return { ok: false, failure: { kind: 'NOT_FOUND' } };
    }

    const decision = ACCESS_REQUEST_DECISION[action];

    /*
     * En una saga la fila se incrementa DOS veces —transición y cierre—, de modo
     * que su versión es `expected + 1` o `expected + 2`. Exigir `+ 1` exacto
     * haría que una repetición tras una provisión concluida se leyera como
     * conflicto, que es justo lo contrario de idempotente.
     */
    const versionCoincide = decision.runsSaga
      ? actual.version >= expectedVersion + 1
      : actual.version === expectedVersion + 1;

    const estadosRepeticion: readonly string[] = decision.runsSaga
      ? [...decision.settledStatuses, 'APPROVED_PENDING_PROVISIONING']
      : decision.settledStatuses;

    const esRepeticionExacta =
      versionCoincide &&
      estadosRepeticion.includes(actual.status) &&
      actual.decisionReasonCode === reasonCode &&
      actual.reviewedByInstitutionalIdentityId === principal.identityId;

    if (esRepeticionExacta && actual.decidedAt !== null) {
      return {
        ok: true,
        status: actual.status,
        subjects: [],
        sincronizar: false,
      };
    }

    return { ok: false, failure: { kind: 'CONFLICT' } };
  }
}

/**
 * Criterio de búsqueda del listado.
 *
 * Las condiciones se acumulan en `AND` en lugar de repartirse entre varias claves
 * del nivel superior. Escribir `where.q` y `where.cursor` en dos claves distintas
 * del mismo objeto haría que la segunda SOBREESCRIBIERA a la primera, y `?q=ana&cursor=…`
 * devolvería el backlog completo a partir del cursor en vez de la búsqueda del
 * cliente: un fallo silencioso que devuelve más datos de los que se pidieron.
 *
 * `q` se aplica con `contains` e insensibilidad a mayúsculas sobre la
 * REFERENCIA, los NOMBRES y el `documentNumber` DECLARADO de la misma `Person`
 * del tenant, y además sobre su `documentNumberNormalized` usando la variante
 * documental derivada por el servidor.
 *
 * Se buscan LAS DOS FORMAS porque el mismo documento se escribe y se dicta de
 * varias maneras. La forma declarada cubre el término completo tal como lo
 * escribió la persona —`CC 44.556.677`—, y la normalizada cubre el término sin
 * los separadores de formato —`44.556.677` o `44556677`—, que es la única forma
 * comparable con la que se guarda. Con una sola de las dos, una de las dos
 * formas de escribir el mismo documento no encuentra nada y la bandeja parece
 * vacía donde hay una solicitud.
 *
 * La búsqueda NUNCA sale del tenant. La relación `person` se alcanza por la FK
 * compuesta `(personId, tenantId)`, así que no existe camino desde una solicitud
 * a una `Person` de otra institución, ni siquiera escribiendo un `personId`
 * ajeno: la fila no se encuentra.
 */
function whereDelListado(
  tenantId: string,
  filtros: Omit<ValidatedAccessRequestReviewQuery, 'limit'>,
): Prisma.AccessRequestWhereInput {
  const and: Prisma.AccessRequestWhereInput[] = [];

  if (filtros.status !== undefined) {
    and.push({ status: filtros.status });
  }

  if (filtros.profile !== undefined) {
    and.push({ requestedProfile: filtros.profile });
  }

  if (filtros.q !== undefined) {
    /*
     * El término se compara contra la REFERENCIA, los NOMBRES y el documento
     * DECLARADO tal cual lo escribió la persona. Se compara además contra la
     * forma NORMALIZADA del documento, usando la variante que el servidor derivó
     * quitando espacios, puntos y guiones: sin ella, buscar `44.556.677` —que
     * es como se dicta o se teclea un documento— no encontraría `44556677`, que
     * es como se guarda, y la bandeja parecería vacía ante un documento que sí
     * existe. Un fallo de búsqueda presentándose como ausencia de datos es peor
     * que no buscar: induce al revisor a concluir algo que el sistema no sabe.
     */
    const criterios: Prisma.AccessRequestWhereInput[] = [
      { reference: { contains: filtros.q, mode: 'insensitive' } },
      { person: { givenNames: { contains: filtros.q, mode: 'insensitive' } } },
      { person: { familyNames: { contains: filtros.q, mode: 'insensitive' } } },
      { person: { documentNumber: { contains: filtros.q, mode: 'insensitive' } } },
    ];

    if (filtros.qDocumento !== undefined) {
      criterios.push({
        person: {
          documentNumberNormalized: { contains: filtros.qDocumento, mode: 'insensitive' },
        },
      });
    }

    and.push({ OR: criterios });
  }

  if (filtros.cursor !== undefined) {
    /*
     * Keyset pagination, no OFFSET. `OFFSET` recounts las filas omitidas en cada
     * página: es O(n) acumulativo y, sobre todo, es INESTABLE —una solicitud
     * nueva que entra entre dos páginas desplaza todas las siguientes y una fila
     * ya entregada aparece dos veces. La condición se compara contra el último
     * par de la página anterior, y como el orden es `(submittedAt, id)`
     * descendente, la continuación es estrictamente «anterior que ese par».
     *
     * El par es una tupla ORDENADA, y por eso la comparación NO puede aplicarse a
     * `id` en la rama de fecha anterior. Si el UUID de una fila más antigua
     * llega a ordenar DESPUÉS del UUID de la última fila de la página —y en
     * UUID v4 el orden es arbitrario—, exigir `id < cursor.id` en esa rama la
     * perdería para siempre, sin ningún error visible: la siguiente página
     * simplemente no la trae. Solo la segunda rama, la del empate exacto de
     * fecha, puede comparar `id`.
     */
    and.push({
      OR: [
        { submittedAt: { lt: filtros.cursor.submittedAt } },
        {
          AND: [
            { submittedAt: filtros.cursor.submittedAt },
            { id: { lt: filtros.cursor.id } },
          ],
        },
      ],
    });
  }

  return { tenantId, AND: and };
}

/** Proyección del listado. Es la MISMA que el contrato declara, campo a campo. */
function aListItem(fila: {
  readonly id: string;
  readonly reference: string;
  readonly requestedProfile: string;
  readonly status: string;
  readonly version: number;
  readonly submittedAt: Date;
  readonly person: { readonly givenNames: string; readonly familyNames: string };
}): AccessRequestReviewListItem {
  return {
    requestId: fila.id,
    reference: fila.reference,
    requestedProfile: fila.requestedProfile,
    status: fila.status,
    version: fila.version,
    submittedAt: fila.submittedAt.toISOString(),
    givenNames: fila.person.givenNames,
    familyNames: fila.person.familyNames,
  };
}

/**
 * Proyección del detalle.
 *
 * `birthDate` se devuelve como `YYYY-MM-DD`, no como marca de tiempo: la fecha de
 * nacimiento no tiene hora, y un ISO completo con `T00:00:00.000Z` sugeriría una
 * precisión que el dato no tiene y que además dependería de la zona del lector.
 *
 * `documentNumber` es el declarado por la persona, no el normalizado: quien
 * revisa necesita ver lo que la persona escribió para poder verificarla, y el
 * normalizado es un artefacto técnico de comparación.
 */
function aDetailDto(fila: {
  readonly id: string;
  readonly reference: string;
  readonly requestedProfile: string;
  readonly status: string;
  readonly version: number;
  readonly submittedAt: Date;
  readonly decidedAt: Date | null;
  readonly decisionReasonCode: string | null;
  readonly provisioningStatus: string;
  readonly provisioningAttempts: number;
  readonly provisioningErrorCode: string | null;
  readonly person: {
    readonly givenNames: string;
    readonly familyNames: string;
    readonly documentType: string;
    readonly documentNumber: string;
    readonly birthDate: Date;
    readonly sexGenderCode: string;
    readonly phone: string | null;
    readonly email: string | null;
  };
}, expediente: {
  readonly registrationSchemaVersion: number | null;
  readonly registrationData: unknown;
} | null): AccessRequestReviewDetailDto {
  /*
   * Defensa residual: el CHECK de la columna solo admite objetos, pero un
   * lector no debe confiar en que la base cumpla lo que el lector no verifica.
   * Lo que no sea un objeto plano se sirve como `null`, igual que la ausencia.
   */
  const expedientePlano =
    expediente !== null &&
    typeof expediente.registrationData === 'object' &&
    expediente.registrationData !== null &&
    !Array.isArray(expediente.registrationData)
      ? (expediente.registrationData as Record<string, unknown>)
      : null;

  return {
    ...aListItem(fila),
    documentType: fila.person.documentType,
    documentNumber: fila.person.documentNumber,
    birthDate: fila.person.birthDate.toISOString().slice(0, 10),
    sexGenderCode: fila.person.sexGenderCode,
    phone: fila.person.phone,
    email: fila.person.email,
    provisioningStatus: fila.provisioningStatus,
    provisioningAttempts: fila.provisioningAttempts,
    provisioningErrorCode: fila.provisioningErrorCode,
    decidedAt: fila.decidedAt === null ? null : fila.decidedAt.toISOString(),
    decisionReasonCode: fila.decisionReasonCode,
    registrationSchemaVersion:
      expedientePlano === null ? null : (expediente?.registrationSchemaVersion ?? null),
    registration: expedientePlano,
  };
}
