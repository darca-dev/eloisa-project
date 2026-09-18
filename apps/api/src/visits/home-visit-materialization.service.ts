import { Inject, Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { type InstitutionalRole } from '../generated/prisma/client';

/**
 * ÚNICA mutación de dominio autorizada por VISITS-CORE-01 MP02.
 *
 * Materializa la visita domiciliaria a partir de una cita `HOME` ya `ASSIGNED`,
 * escribiendo en la MISMA transacción —y por tanto todo o nada— exactamente
 * tres cosas:
 *
 *   1. la `HomeVisit` en estado `SCHEDULED`, sin inicio ni fin y con versión 1;
 *   2. su transición de CREACIÓN (`null → SCHEDULED`, sin actor humano);
 *   3. el evento `HOME_VISIT_MATERIALIZED` sobre el recurso `HomeVisit`.
 *
 * ACTOR. El acto se atribuye a la identidad institucional OPACA que opera, y
 * NUNCA a la persona visitadora. El profesional NO autoriza ni firma la
 * materialización: su autorización pertenece al paquete del endpoint y a las
 * transiciones posteriores, que están FUERA de MP02.
 *
 * LO QUE ESTE SERVICIO NO HACE, deliberadamente:
 *
 * - NO inicia, NO completa y NO da por no realizada la visita; no escribe
 *   `startedAt` ni `endedAt`;
 * - NO acepta ni persiste profesional, horario, dirección, zona, motivo, nota,
 *   diagnóstico, GPS, firma ni archivo: `Appointment` sigue siendo la ÚNICA
 *   agenda y `CareAssignment` la ÚNICA fuente del profesional asignado;
 * - NO crea personas, pacientes, profesionales, asignaciones ni citas;
 * - NO cambia el estado ni la versión de la cita;
 * - NO aplica ninguna regla clínica;
 * - NO decide disponibilidad humana: la plataforma no modela turnos ni jornada.
 *
 * COHERENCIA. Las reglas que MP01 ya impone en la BASE —modalidad `HOME`,
 * estado `ASSIGNED`, coincidencia de paciente y asignación, asignación `ACTIVE`
 * y tenant— NO se reimplementan aquí como reglas de negocio duplicadas. El
 * servicio se apoya en el trigger `home_visit_guard` y TRADUCE su fallo a un
 * desenlace de dominio legible. Comprobar en el servicio lo que ya garantiza el
 * trigger sería duplicación, no defensa.
 */

/** Contexto institucional mínimo de la operación. Ningún dato personal. */
export interface HomeVisitMaterializationContext {
  readonly tenantId: string;
  /** Identificador OPACO de la identidad institucional que opera. */
  readonly identityId: string;
  /** Rol efectivo de esa identidad en el momento del acto. */
  readonly role: InstitutionalRole;
  /** Instante del acto, fijado por el SERVIDOR. */
  readonly now: Date;
}

/** Códigos de desenlace estables y poco informativos. */
export const HOME_VISIT_MATERIALIZATION_ERROR_CODES = {
  /**
   * La cita no existe o pertenece a otra institución. UNIFORME a propósito:
   * distinguirlas confirmaría la existencia de un registro ajeno.
   */
  appointmentNotFound: 'HOME_VISIT_APPOINTMENT_NOT_FOUND',
  /** La cita existe pero su modalidad, su estado o su asignación no la admiten. */
  notMaterializable: 'HOME_VISIT_APPOINTMENT_NOT_MATERIALIZABLE',
  /** Esa cita ya materializó su visita. Una cita materializa como mucho una. */
  alreadyMaterialized: 'HOME_VISIT_ALREADY_MATERIALIZED',
} as const;

export type HomeVisitMaterializationErrorCode =
  (typeof HOME_VISIT_MATERIALIZATION_ERROR_CODES)[keyof typeof HOME_VISIT_MATERIALIZATION_ERROR_CODES];

/** Desenlace de dominio con su código estable y su estado HTTP previsto. */
export class HomeVisitMaterializationError extends Error {
  public readonly code: HomeVisitMaterializationErrorCode;

  public readonly status: 404 | 409;

  constructor(code: HomeVisitMaterializationErrorCode, status: 404 | 409, message: string) {
    super(message);
    this.name = 'HomeVisitMaterializationError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Resultado de la materialización.
 *
 * Solo identificadores OPACOS y estado operativo. NO lleva nombre, documento,
 * dirección, horario, profesional ni dato clínico: nada de eso se persiste en
 * la visita y nada de eso debe deducirse de este resultado.
 */
export interface MaterializedHomeVisit {
  readonly homeVisitId: string;
  readonly appointmentId: string;
  readonly status: 'SCHEDULED';
  readonly version: number;
  /** Transición de CREACIÓN escrita en la misma transacción. */
  readonly creationTransitionId: string;
  readonly createdAt: string;
}

/** Violación de restricción única de PostgreSQL, tal como Prisma la expone. */
const UNIQUE_VIOLATION = 'P2002';

/** SQLSTATE de violación de `CHECK`, que es como el trigger de MP01 rechaza. */
const CHECK_VIOLATION_SQLSTATE = '23514';

@Injectable()
export class HomeVisitMaterializationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async materialize(
    context: HomeVisitMaterializationContext,
    appointmentId: string,
  ): Promise<MaterializedHomeVisit> {
    const { tenantId } = context;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const cita = await tx.appointment.findFirst({
        // Filtro explícito por tenant ADEMÁS de Row Level Security.
        where: { id: appointmentId, tenantId },
        select: { id: true, patientId: true, careAssignmentId: true },
      });

      if (cita === null) {
        /*
         * `404` UNIFORME: no existe y pertenece a otra institución producen el
         * MISMO desenlace. Bajo `withTenant` la cita ajena es además invisible
         * para PostgreSQL, de modo que la uniformidad no depende de esta rama.
         */
        throw new HomeVisitMaterializationError(
          HOME_VISIT_MATERIALIZATION_ERROR_CODES.appointmentNotFound,
          404,
          'No fue posible encontrar la cita indicada.',
        );
      }

      if (cita.careAssignmentId === null) {
        /*
         * ÚNICA comprobación previa, y no es duplicación: sin asignación no hay
         * fila que construir —la columna es obligatoria— y el trigger no llega
         * a evaluarse. Una cita sin asignación es además, por construcción de
         * Agenda, una cita que todavía no está `ASSIGNED`.
         */
        throw new HomeVisitMaterializationError(
          HOME_VISIT_MATERIALIZATION_ERROR_CODES.notMaterializable,
          409,
          'La cita no admite esta operación en su estado actual.',
        );
      }

      const visita = await this.crearVisita(tx, {
        tenantId,
        appointmentId: cita.id,
        patientId: cita.patientId,
        careAssignmentId: cita.careAssignmentId,
        identityId: context.identityId,
      });

      /*
       * Transición de CREACIÓN, en la MISMA transacción. `fromStatus` nulo y
       * `performedByHumanAccountId` nulo: quien materializó es la identidad
       * institucional opaca que vive en la propia visita, no una persona.
       */
      const transicion = await tx.homeVisitTransition.create({
        data: {
          tenantId,
          homeVisitId: visita.id,
          fromStatus: null,
          toStatus: 'SCHEDULED',
          performedByHumanAccountId: null,
          occurredAt: context.now,
        },
        select: { id: true },
      });

      /*
       * Auditoría dentro de la MISMA transacción. Si el evento no puede
       * persistirse, la transacción se aborta completa y la visita NO queda:
       * no puede existir una materialización sin su rastro (FAIL-CLOSED).
       */
      await this.audit.recordHomeVisitMaterializedWithin(
        tx,
        {
          tenantId,
          identityId: context.identityId,
          role: context.role,
          homeVisitId: visita.id,
        },
        context.now,
      );

      return {
        homeVisitId: visita.id,
        appointmentId: cita.id,
        status: 'SCHEDULED',
        version: visita.version,
        creationTransitionId: transicion.id,
        createdAt: visita.createdAt.toISOString(),
      };
    });
  }

  /**
   * Inserta la visita y TRADUCE el rechazo de la base a un desenlace de dominio.
   *
   * `SCHEDULED`, sin `startedAt` ni `endedAt` y con la versión inicial que la
   * base fija por defecto: MP02 no anticipa ninguna transición posterior.
   */
  private async crearVisita(
    tx: Parameters<Parameters<PrismaService['withTenant']>[1]>[0],
    input: {
      readonly tenantId: string;
      readonly appointmentId: string;
      readonly patientId: string;
      readonly careAssignmentId: string;
      readonly identityId: string;
    },
  ): Promise<{ readonly id: string; readonly version: number; readonly createdAt: Date }> {
    try {
      return await tx.homeVisit.create({
        data: {
          tenantId: input.tenantId,
          appointmentId: input.appointmentId,
          patientId: input.patientId,
          careAssignmentId: input.careAssignmentId,
          status: 'SCHEDULED',
          createdByInstitutionalIdentityId: input.identityId,
        },
        select: { id: true, version: true, createdAt: true },
      });
    } catch (error) {
      if (esViolacionUnica(error)) {
        /*
         * `home_visit_appointment_tenant_unique`: esa cita YA materializó su
         * visita. La segunda petición se rechaza en lugar de crear una segunda
         * visita o de sobrescribir la existente.
         */
        throw new HomeVisitMaterializationError(
          HOME_VISIT_MATERIALIZATION_ERROR_CODES.alreadyMaterialized,
          409,
          'La cita ya materializó su visita domiciliaria.',
        );
      }

      if (esRechazoDelGuard(error)) {
        /*
         * `home_visit_guard` rechazó por modalidad, estado, paciente o
         * asignación. El desenlace NO detalla cuál de las reglas falló: hacerlo
         * describiría el estado de un registro que quien pregunta puede no
         * tener por qué conocer.
         */
        throw new HomeVisitMaterializationError(
          HOME_VISIT_MATERIALIZATION_ERROR_CODES.notMaterializable,
          409,
          'La cita no admite esta operación en su estado actual.',
        );
      }

      /*
       * Cualquier otro fallo se PROPAGA sin traducir y aborta la transacción.
       * En particular no se convierte una violación de clave foránea en un
       * desenlace de dominio: no sería atribuible a la cita y afirmarlo sería
       * inventar una causa.
       */
      throw error;
    }
  }
}

/** Reconoce la violación de unicidad sin depender de la clase de error. */
function esViolacionUnica(error: unknown): boolean {
  return codigoPrisma(error) === UNIQUE_VIOLATION;
}

/**
 * Reconoce el rechazo del trigger `home_visit_guard`.
 *
 * El guard emite `RAISE ... USING ERRCODE = '23514'`, que el adaptador conserva
 * como código original de PostgreSQL. Se comprueba el SQLSTATE y NO el texto
 * del mensaje: el mensaje es humano y podría cambiar sin aviso.
 */
function esRechazoDelGuard(error: unknown): boolean {
  return sqlstateOriginal(error) === CHECK_VIOLATION_SQLSTATE;
}

function codigoPrisma(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const code = (error as { readonly code?: unknown }).code;

  return typeof code === 'string' ? code : null;
}

/** Extrae el SQLSTATE que el adaptador conserva bajo `meta.driverAdapterError`. */
function sqlstateOriginal(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const meta = (error as { readonly meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null) {
    return null;
  }

  const adapterError = (meta as { readonly driverAdapterError?: unknown }).driverAdapterError;
  if (typeof adapterError !== 'object' || adapterError === null) {
    return null;
  }

  const cause = (adapterError as { readonly cause?: unknown }).cause;
  if (typeof cause !== 'object' || cause === null) {
    return null;
  }

  const original = (cause as { readonly originalCode?: unknown }).originalCode;

  return typeof original === 'string' ? original : null;
}
