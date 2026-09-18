import { Inject, Injectable } from '@nestjs/common';

import { AuditService, type HomeVisitProfessionalTargetStatus } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { type HomeVisitStatus, type Prisma } from '../generated/prisma/client';
import { type HumanPrincipal } from '../identity-access/human-principal';

/**
 * ÚNICA mutación de dominio autorizada por VISITS-CORE-01 MP03.
 *
 * Ejecuta la transición PROFESIONAL de una visita domiciliaria ya materializada,
 * escribiendo en la MISMA transacción —y por tanto todo o nada— exactamente
 * tres cosas:
 *
 *   1. la actualización CONDICIONAL de la visita: estado, versión y el instante
 *      que corresponda;
 *   2. su `HomeVisitTransition`, APPEND-ONLY, con la cuenta humana que la
 *      ejecutó;
 *   3. el evento de auditoría del estado destino.
 *
 * ACTOR. A diferencia de la materialización de MP02 —acto administrativo de una
 * identidad institucional OPACA—, iniciar, completar o dar por no realizada una
 * visita es el acto de una PERSONA concreta. El actor es por tanto la cuenta
 * humana autenticada, y la autorización se resuelve EXCLUSIVAMENTE desde
 * `principal.personId`.
 *
 * LO QUE ESTE SERVICIO NO ACEPTA JAMÁS DEL CLIENTE: `tenantId`, `patientId`,
 * `professionalId`, actor, rol ni marca de tiempo. `tenantId` y `humanAccountId`
 * vienen del principal, que produce el validador de sesión server-side; `now` lo
 * fija el servidor. Un `professionalId` recibido sería exactamente la vía por la
 * que una persona ejecutaría la visita de otra: aquí no existe ese parámetro, y
 * esa AUSENCIA es la garantía —ninguna comprobación podría sustituirla, porque
 * no hay valor que pudiera divergir—.
 *
 * LO QUE NO HACE, deliberadamente:
 *
 * - NO materializa visitas: eso es MP02 y no se repite aquí;
 * - NO crea ni modifica personas, pacientes, profesionales, afiliaciones,
 *   asignaciones ni citas, y NO cambia el estado ni la versión de la cita:
 *   `Appointment` sigue siendo la ÚNICA agenda;
 * - NO acepta ni persiste motivo, nota, diagnóstico, evidencia, GPS, firma ni
 *   archivo. En particular NO registra POR QUÉ una visita quedó como no
 *   realizada: MERDN no tiene aprobado ningún catálogo de causas;
 * - NO aplica ninguna regla clínica y NO reabre, revierte ni cancela nada: la
 *   cancelación pertenece a Agenda y no está aprobada;
 * - NO crea endpoint, guard HTTP, DTO, módulo Nest ni interfaz.
 */

/** Estados destino admitidos. `SCHEDULED` NO lo es: esa es la creación (MP02). */
export type HomeVisitTransitionTarget = HomeVisitProfessionalTargetStatus;

/**
 * Máquina CERRADA de transiciones, expresada por estado DESTINO.
 *
 * Es la MISMA máquina que `home_visit_transition_machine` impone en la base
 * desde MP01. Aquí se declara para poder devolver un desenlace legible ANTES de
 * escribir; la base sigue siendo la barrera final e independiente, de modo que
 * una divergencia futura entre ambas aborta la transacción en lugar de colar una
 * transición ilegal.
 *
 * De aquí se sigue, sin ninguna regla adicional, que los estados TERMINALES son
 * inmutables: `COMPLETED` y `NOT_COMPLETED` no aparecen como origen de ninguna
 * transición, y por tanto no hay reapertura, reversión ni salto posible.
 */
const ORIGENES_LEGALES: Record<HomeVisitTransitionTarget, readonly HomeVisitStatus[]> = {
  IN_PROGRESS: ['SCHEDULED'],
  COMPLETED: ['IN_PROGRESS'],
  NOT_COMPLETED: ['SCHEDULED', 'IN_PROGRESS'],
};

/** Códigos de desenlace estables y poco informativos. */
export const HOME_VISIT_TRANSITION_ERROR_CODES = {
  /**
   * La visita no existe, pertenece a otra institución o la persona autenticada
   * no es la profesional asignada y vigente. UNIFORME a propósito: distinguir
   * los tres casos confirmaría la existencia de un registro ajeno o describiría
   * el estado de una asignación que quien pregunta puede no tener por qué
   * conocer.
   */
  notFound: 'HOME_VISIT_NOT_FOUND',
  /** La versión enviada no es la vigente: otra escritura ganó la carrera. */
  versionConflict: 'HOME_VISIT_VERSION_CONFLICT',
  /** El estado actual no admite esa transición, o ya es terminal. */
  transitionNotAllowed: 'HOME_VISIT_TRANSITION_NOT_ALLOWED',
} as const;

export type HomeVisitTransitionErrorCode =
  (typeof HOME_VISIT_TRANSITION_ERROR_CODES)[keyof typeof HOME_VISIT_TRANSITION_ERROR_CODES];

/** Desenlace de dominio con su código estable y su estado HTTP previsto. */
export class HomeVisitTransitionError extends Error {
  public readonly code: HomeVisitTransitionErrorCode;

  public readonly status: 404 | 409;

  constructor(code: HomeVisitTransitionErrorCode, status: 404 | 409, message: string) {
    super(message);
    this.name = 'HomeVisitTransitionError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Resultado de la transición.
 *
 * Solo identificadores OPACOS y estado operativo. NO lleva paciente,
 * profesional, persona, horario ni dato clínico: nada de eso se persiste en la
 * visita y nada de eso debe deducirse de este resultado.
 */
export interface HomeVisitTransitionResult {
  readonly homeVisitId: string;
  readonly fromStatus: HomeVisitStatus;
  readonly toStatus: HomeVisitTransitionTarget;
  /** Versión YA incrementada. Es la que el siguiente intento debe enviar. */
  readonly version: number;
  /** Transición escrita en la misma transacción. */
  readonly transitionId: string;
  readonly occurredAt: string;
}

@Injectable()
export class HomeVisitTransitionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * Transiciona la visita indicada, todo o nada.
   *
   * ATOMICIDAD. Autorización y mutación viven en la MISMA transacción y bajo el
   * MISMO contexto de tenant: no hay una comprobación previa cuyo resultado
   * pudiera quedar obsoleto antes de escribir. La actualización repite ADEMÁS,
   * dentro de su propia condición, la autorización completa, de modo que aunque
   * la asignación, el perfil o la afiliación dejaran de ser válidos entre la
   * lectura y la escritura, la escritura no ocurriría.
   */
  public async transition(
    principal: HumanPrincipal,
    visitId: string,
    targetStatus: HomeVisitTransitionTarget,
    expectedVersion: number,
    now: Date,
  ): Promise<HomeVisitTransitionResult> {
    const { tenantId } = principal;

    /*
     * La versión es un entero POSITIVO. Una versión que no lo es no puede ser la
     * vigente —`home_visit_version_positive` lo garantiza desde MP01—, de modo
     * que se rechaza con el MISMO desenlace que cualquier otra versión obsoleta:
     * no hace falta un código nuevo para decir lo mismo.
     */
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      throw new HomeVisitTransitionError(
        HOME_VISIT_TRANSITION_ERROR_CODES.versionConflict,
        409,
        'La versión enviada no corresponde a la versión vigente de la visita.',
      );
    }

    return this.prisma.withTenant(tenantId, async (tx) => {
      const autorizacion = asignacionAutorizada(principal, now);

      /*
       * LECTURA AUTORIZADA. El filtro no es «esta visita» sino «esta visita, si
       * la persona autenticada es su profesional asignada y vigente». Una visita
       * ajena no se lee y por tanto no se distingue de una inexistente.
       *
       * Filtro explícito por tenant ADEMÁS de Row Level Security, que bajo
       * `withTenant` ya hace invisible cualquier fila de otra institución.
       */
      const visita = await tx.homeVisit.findFirst({
        where: { id: visitId, tenantId, careAssignment: autorizacion },
        select: { id: true, status: true, version: true },
      });

      if (visita === null) {
        throw new HomeVisitTransitionError(
          HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          404,
          'No fue posible encontrar la visita indicada.',
        );
      }

      const origen = visita.status;

      /*
       * ORDEN DELIBERADO: primero la legalidad de la transición, después la
       * versión. Una visita ya terminal no admite la operación con NINGUNA
       * versión, y responder «versión obsoleta» invitaría a reintentar con la
       * versión correcta una transición que nunca será legal.
       */
      if (!ORIGENES_LEGALES[targetStatus].includes(origen)) {
        throw new HomeVisitTransitionError(
          HOME_VISIT_TRANSITION_ERROR_CODES.transitionNotAllowed,
          409,
          'El estado actual de la visita no admite esa transición.',
        );
      }

      if (visita.version !== expectedVersion) {
        throw new HomeVisitTransitionError(
          HOME_VISIT_TRANSITION_ERROR_CODES.versionConflict,
          409,
          'La versión enviada no corresponde a la versión vigente de la visita.',
        );
      }

      /*
       * ACTUALIZACIÓN CONDICIONAL. La condición incluye las CINCO cosas a la
       * vez: visita, tenant, estado actual, versión esperada y autorización
       * completa. PostgreSQL reevalúa esta condición tras liberar el bloqueo de
       * fila, de modo que en una carrera solo la PRIMERA escritura encuentra
       * `version = expectedVersion`: hay exactamente un ganador y el resto ve
       * cero filas afectadas.
       */
      const { count } = await tx.homeVisit.updateMany({
        where: {
          id: visitId,
          tenantId,
          status: origen,
          version: expectedVersion,
          careAssignment: autorizacion,
        },
        data: {
          status: targetStatus,
          // Se incrementa EXACTAMENTE una vez, y lo hace la base, no la aplicación.
          version: { increment: 1 },
          ...instantesDe(targetStatus, now),
        },
      });

      if (count !== 1) {
        /*
         * Perdió la carrera: entre la lectura y la escritura otra transacción
         * confirmó su propia transición sobre esta misma visita. El desenlace es
         * el de versión obsoleta, que es exactamente lo ocurrido.
         */
        throw new HomeVisitTransitionError(
          HOME_VISIT_TRANSITION_ERROR_CODES.versionConflict,
          409,
          'La versión enviada no corresponde a la versión vigente de la visita.',
        );
      }

      /*
       * HISTORIAL APPEND-ONLY, en la MISMA transacción.
       * `performedByHumanAccountId` sale del principal y NUNCA de un
       * identificador recibido. El check `home_visit_transition_machine` de MP01
       * vuelve a validar aquí la transición y la exigencia de actor humano: si
       * el servicio se desviara de la máquina, la base abortaría la transacción
       * completa.
       */
      const transicion = await tx.homeVisitTransition.create({
        data: {
          tenantId,
          homeVisitId: visitId,
          fromStatus: origen,
          toStatus: targetStatus,
          performedByHumanAccountId: principal.humanAccountId,
          occurredAt: now,
        },
        select: { id: true },
      });

      /*
       * AUDITORÍA dentro de la MISMA transacción. Si el evento no puede
       * persistirse, la transacción se aborta completa y ni la actualización ni
       * la transición quedan: no puede existir un cambio de estado sin su rastro
       * (FAIL-CLOSED).
       */
      await this.audit.recordHomeVisitTransitionWithin(
        tx,
        {
          tenantId,
          humanAccountId: principal.humanAccountId,
          homeVisitId: visitId,
          toStatus: targetStatus,
        },
        now,
      );

      return {
        homeVisitId: visitId,
        fromStatus: origen,
        toStatus: targetStatus,
        version: expectedVersion + 1,
        transitionId: transicion.id,
        occurredAt: now.toISOString(),
      };
    });
  }
}

/**
 * Condición de AUTORIZACIÓN sobre la asignación de cuidado de la visita.
 *
 * Se construye desde `principal.personId` y de ningún otro sitio. Exige, todo a
 * la vez:
 *
 *   1. `CareAssignment` `ACTIVE` y VIGENTE en el instante del acto;
 *   2. que su `ProfessionalProfile` sea el de ESA persona y esté `ACTIVE`;
 *   3. que ese perfil tenga al menos una `ProfessionalAffiliation` `ACTIVE` y
 *      vigente: un perfil sin vínculo vigente no es profesional operativo.
 *
 * Ninguna de las tres es opcional y ninguna se comprueba por separado en otro
 * momento: van juntas en la MISMA condición SQL, tanto en la lectura como en la
 * actualización.
 *
 * El `tenantId` se repite en los tres niveles ADEMÁS de Row Level Security y de
 * las claves foráneas compuestas de MP01. Es redundante a propósito: el
 * aislamiento institucional no debe depender de una sola barrera.
 *
 * NOTA SOBRE LAS COMPROBACIONES DE FIN DE VIGENCIA. Hoy `endsAt` y `endsOn` son
 * necesariamente nulos mientras la fila está activa: HOSPITAL-CORE-02 lo impone
 * con `care_assignment_period_scope` y `professional_affiliation_end_date_scope`,
 * de modo que una vigencia vencida se expresa TERMINANDO el vínculo, y eso ya lo
 * detiene el filtro de estado. Las dos comprobaciones se escriben igualmente
 * —no son la barrera que hoy actúa, sino la que seguiría actuando si esa forma
 * cambiara—. Las de INICIO, en cambio, sí gobiernan hoy: una asignación o una
 * afiliación activas cuya vigencia todavía no ha empezado quedan rechazadas.
 */
function asignacionAutorizada(
  principal: HumanPrincipal,
  now: Date,
): Prisma.CareAssignmentWhereInput {
  const hoy = fechaSinHora(now);

  return {
    tenantId: principal.tenantId,
    status: 'ACTIVE',
    startsAt: { lte: now },
    // Vigencia abierta o todavía no vencida.
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    professional: {
      tenantId: principal.tenantId,
      // La persona AUTENTICADA, nunca un profesional recibido desde fuera.
      personId: principal.personId,
      status: 'ACTIVE',
      affiliations: {
        some: {
          tenantId: principal.tenantId,
          status: 'ACTIVE',
          startsOn: { lte: hoy },
          OR: [{ endsOn: null }, { endsOn: { gte: hoy } }],
        },
      },
    },
  };
}

/**
 * Instantes que corresponden al estado DESTINO. Los fija el SERVIDOR.
 *
 *   * `IN_PROGRESS`: `startedAt = now`. Su único origen legal es `SCHEDULED`,
 *     donde `home_visit_status_timestamps` garantiza que `startedAt` es nulo: no
 *     hay inicio previo que pudiera sobrescribirse.
 *   * `COMPLETED` y `NOT_COMPLETED`: `endedAt = now` y `startedAt` NO SE TOCA,
 *     de modo que un inicio ya registrado se PRESERVA intacto. Una visita no
 *     realizada desde `SCHEDULED` conserva su inicio nulo, que es justamente lo
 *     que el check de MP01 admite para ese estado.
 */
function instantesDe(
  targetStatus: HomeVisitTransitionTarget,
  now: Date,
): { readonly startedAt?: Date; readonly endedAt?: Date } {
  return targetStatus === 'IN_PROGRESS' ? { startedAt: now } : { endedAt: now };
}

/**
 * Fecha SIN componente horario, para comparar con columnas `DATE`.
 *
 * `ProfessionalAffiliation.startsOn` y `endsOn` son fechas puras precisamente
 * para evitar desplazamientos de zona horaria. Comparar un `timestamptz` con
 * ellas los reintroduciría, de modo que el instante se reduce primero a su día
 * en UTC, que es la zona en la que esas fechas se almacenan.
 */
function fechaSinHora(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
