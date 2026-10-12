import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import {
  HOSPITAL_OPERATIONS_ERROR_CODES,
  HOSPITAL_OPERATIONS_RESOURCES,
  HOSPITAL_PATIENTS_SOURCE,
  buildHospitalOperationsAudit,
  type HospitalAssignedAppointment,
  type HospitalAppointmentModality,
} from './hospital.contract';
import { type HospitalAssignmentRequest } from './hospital-appointment-assignment.request';
import { profesionalMinimo } from './hospital-agenda.service';
import {
  pacienteMinimo,
  type HospitalOperationsContext,
} from './hospital-professionals.service';

/**
 * ÚNICA mutación funcional autorizada por TASK-HOSPITAL-CORE-02 (§4.2).
 *
 * Asigna una solicitud EXISTENTE a un profesional EXISTENTE, con fecha y hora,
 * en una sola transacción auditada. Lo que hace, exactamente y nada más:
 *
 *   1. valida cita, paciente, perfil y afiliación ACTIVA del MISMO tenant;
 *   2. crea o reutiliza la asignación primaria activa de ese par
 *      paciente-profesional;
 *   3. enlaza la cita a esa asignación;
 *   4. pasa la cita a `ASSIGNED`, fija `scheduledStart` e incrementa `version`;
 *   5. inserta `CARE_ASSIGNMENT_CREATED` SOLO cuando realmente creó el vínculo,
 *      y SIEMPRE `APPOINTMENT_ASSIGNED`;
 *   6. confirma todo o nada.
 *
 * LO QUE NO HACE, deliberadamente:
 *
 * - NO comprueba disponibilidad humana: la plataforma no modela turnos, jornada,
 *   ausencias ni carga máxima, y afirmar que alguien «puede» sería inventarlo;
 * - NO aplica ninguna regla clínica: no valora pertinencia, urgencia, perfil
 *   profesional adecuado ni riesgo;
 * - NO reprograma, NO rechaza, NO cancela, NO finaliza y NO desasigna;
 * - NO crea personas, pacientes, profesionales, afiliaciones ni citas;
 * - NO atribuye el acto a la profesional seleccionada. El actor auditado es la
 *   identidad institucional OPACA que operó, porque la identidad institucional
 *   mínima es COMPARTIDA y no identifica a ninguna persona trabajadora.
 *
 * La ÚNICA colisión mecánica bloqueada es que el mismo profesional tenga otra
 * cita no cancelada con el MISMO `scheduledStart`. No se modela duración y por
 * tanto no se detecta solapamiento: dos citas separadas por un minuto no
 * colisionan, y decir lo contrario exigiría una duración que nadie declaró.
 */

/** Desenlace de dominio con su código estable y su estado HTTP. */
export class HospitalAssignmentError extends Error {
  public readonly code: string;

  public readonly status: 404 | 409;

  constructor(code: string, status: 404 | 409, message: string) {
    super(message);
    this.name = 'HospitalAssignmentError';
    this.code = code;
    this.status = status;
  }
}

/** Violación de restricción única de PostgreSQL. */
const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class HospitalAppointmentAssignmentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async assign(
    context: HospitalOperationsContext,
    appointmentId: string,
    request: HospitalAssignmentRequest,
  ): Promise<HospitalAssignedAppointment> {
    const tenantId = context.principal.tenantId;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const cita = await tx.appointment.findFirst({
        // Filtro explícito por tenant ADEMÁS de Row Level Security.
        where: { id: appointmentId, tenantId },
        select: {
          id: true,
          status: true,
          version: true,
          modality: true,
          patientId: true,
          careAssignmentId: true,
          patient: {
            select: { id: true, person: { select: { givenNames: true, familyNames: true } } },
          },
        },
      });

      if (cita === null) {
        /*
         * `404` UNIFORME: no existe y pertenece a otra institución producen la
         * MISMA respuesta. Distinguirlas confirmaría la existencia de un
         * registro ajeno.
         */
        throw new HospitalAssignmentError(
          HOSPITAL_OPERATIONS_ERROR_CODES.appointmentNotFound,
          404,
          'No fue posible encontrar la solicitud indicada.',
        );
      }

      if (cita.version !== request.expectedVersion) {
        /*
         * Control OPTIMISTA. Reenviar la petición con la versión anterior NO
         * repite la operación: la rechaza. Es lo que impide que dos personas
         * asignen la misma solicitud creyendo cada una que fue la primera.
         */
        throw new HospitalAssignmentError(
          HOSPITAL_OPERATIONS_ERROR_CODES.versionConflict,
          409,
          'La solicitud cambió desde que se consultó. Vuelva a cargarla.',
        );
      }

      if (cita.status !== 'REQUESTED' || cita.careAssignmentId !== null) {
        throw new HospitalAssignmentError(
          HOSPITAL_OPERATIONS_ERROR_CODES.notAssignable,
          409,
          'La solicitud no admite esta operación en su estado actual.',
        );
      }

      const profesional = await tx.professionalProfile.findFirst({
        where: { id: request.professionalId, tenantId },
        select: {
          id: true,
          status: true,
          professionCode: true,
          professionNameControlled: true,
          person: { select: { givenNames: true, familyNames: true } },
          affiliations: {
            where: { tenantId, status: 'ACTIVE' },
            select: { id: true },
            take: 1,
          },
        },
      });

      /*
       * `404` UNIFORME para las TRES causas que §6.3 agrupa: profesional
       * inexistente, de otra institución, con perfil inactivo o sin vínculo
       * vigente. Separarlas permitiría deducir la plantilla de otra institución
       * probando identificadores.
       */
      if (
        profesional === null ||
        profesional.status !== 'ACTIVE' ||
        profesional.affiliations.length === 0
      ) {
        throw new HospitalAssignmentError(
          HOSPITAL_OPERATIONS_ERROR_CODES.professionalNotFound,
          404,
          'No fue posible encontrar el profesional indicado.',
        );
      }

      const colision = await tx.appointment.findFirst({
        where: {
          tenantId,
          id: { not: cita.id },
          status: { not: 'CANCELLED' },
          scheduledStart: request.scheduledStart,
          careAssignment: { tenantId, professionalId: profesional.id },
        },
        select: { id: true },
      });

      if (colision !== null) {
        /*
         * La respuesta NO revela cuál es la cita en conflicto ni de quién es:
         * hacerlo permitiría reconstruir la agenda ajena probando instantes.
         */
        throw new HospitalAssignmentError(
          HOSPITAL_OPERATIONS_ERROR_CODES.notAssignable,
          409,
          'La solicitud no admite esta operación con los datos indicados.',
        );
      }

      const vinculo = await this.vincular(tx, tenantId, context, cita.patientId, profesional.id);

      /*
       * La condición `version` viaja en el WHERE, no solo en la lectura previa:
       * dos peticiones simultáneas con la MISMA versión esperada compiten aquí y
       * exactamente una actualiza una fila. La otra recibe `count = 0` y termina
       * en conflicto, sin haber escrito nada.
       */
      const actualizada = await tx.appointment.updateMany({
        where: {
          id: cita.id,
          tenantId,
          version: request.expectedVersion,
          status: 'REQUESTED',
          careAssignmentId: null,
        },
        data: {
          careAssignmentId: vinculo.careAssignmentId,
          scheduledStart: request.scheduledStart,
          status: 'ASSIGNED',
          version: { increment: 1 },
        },
      });

      if (actualizada.count === 0) {
        throw new HospitalAssignmentError(
          HOSPITAL_OPERATIONS_ERROR_CODES.versionConflict,
          409,
          'La solicitud cambió desde que se consultó. Vuelva a cargarla.',
        );
      }

      /*
       * Auditoría dentro de la MISMA transacción. Si el evento no puede
       * persistirse, la transacción se aborta y la asignación no ocurre: no
       * puede existir una asignación sin su rastro (FAIL-CLOSED, §7.9).
       */
      if (vinculo.created) {
        await tx.auditEvent.create({
          data: buildHospitalOperationsAudit({
            tenantId,
            identityId: context.principal.identityId,

            ...(context.principal.humanAccountId === undefined ? {} : { humanAccountId: context.principal.humanAccountId }),
            role: context.principal.role,
            eventType: 'CARE_ASSIGNMENT_CREATED',
            resourceType: HOSPITAL_OPERATIONS_RESOURCES.careAssignment,
            resourceId: vinculo.careAssignmentId,
            endpoint: context.endpoint,
            correlationId: context.correlationId,
            occurredAt: context.now,
          }),
          select: { id: true },
        });
      }

      await tx.auditEvent.create({
        data: buildHospitalOperationsAudit({
          tenantId,
          identityId: context.principal.identityId,

          ...(context.principal.humanAccountId === undefined ? {} : { humanAccountId: context.principal.humanAccountId }),
          role: context.principal.role,
          eventType: 'APPOINTMENT_ASSIGNED',
          resourceType: HOSPITAL_OPERATIONS_RESOURCES.appointment,
          resourceId: cita.id,
          endpoint: context.endpoint,
          correlationId: context.correlationId,
          occurredAt: context.now,
        }),
        select: { id: true },
      });

      return {
        source: HOSPITAL_PATIENTS_SOURCE,
        generatedAt: context.now.toISOString(),
        appointmentId: cita.id,
        version: request.expectedVersion + 1,
        status: 'ASSIGNED',
        modality: cita.modality as HospitalAppointmentModality,
        scheduledStart: request.scheduledStart.toISOString(),
        patient: pacienteMinimo(cita.patient),
        professional: profesionalMinimo(profesional),
        careAssignmentCreated: vinculo.created,
      };
    });
  }

  /**
   * Reutiliza la asignación primaria activa del par, o la crea.
   *
   * Si el paciente YA tiene una asignación primaria activa con OTRO profesional,
   * la operación se rechaza: reasignar exige terminar la anterior, y terminar
   * una asignación está expresamente fuera del alcance de esta Task. No se
   * duplica el vínculo, no se sobrescribe el existente y no se inventa un
   * criterio de sustitución.
   */
  private async vincular(
    tx: Parameters<Parameters<PrismaService['withTenant']>[1]>[0],
    tenantId: string,
    context: HospitalOperationsContext,
    patientId: string,
    professionalId: string,
  ): Promise<{ readonly careAssignmentId: string; readonly created: boolean }> {
    const existente = await tx.careAssignment.findFirst({
      where: { tenantId, patientId, role: 'PRIMARY', status: 'ACTIVE' },
      select: { id: true, professionalId: true },
    });

    if (existente !== null) {
      if (existente.professionalId !== professionalId) {
        throw new HospitalAssignmentError(
          HOSPITAL_OPERATIONS_ERROR_CODES.notAssignable,
          409,
          'La solicitud no admite esta operación con los datos indicados.',
        );
      }

      return { careAssignmentId: existente.id, created: false };
    }

    try {
      const creada = await tx.careAssignment.create({
        data: {
          tenantId,
          patientId,
          professionalId,
          role: 'PRIMARY',
          status: 'ACTIVE',
          startsAt: context.now,
          // Identidad institucional OPACA, nunca la profesional seleccionada.
          createdByIdentityId: context.principal.identityId,
        },
        select: { id: true },
      });

      return { careAssignmentId: creada.id, created: true };
    } catch (error) {
      if (esViolacionUnica(error)) {
        /*
         * El índice único PARCIAL de la base ganó la carrera: otra transacción
         * creó la asignación primaria activa de este paciente entre la lectura y
         * la escritura. La operación se rechaza en lugar de sobrescribir un
         * vínculo que esta petición no leyó.
         */
        throw new HospitalAssignmentError(
          HOSPITAL_OPERATIONS_ERROR_CODES.notAssignable,
          409,
          'La solicitud no admite esta operación con los datos indicados.',
        );
      }

      throw error;
    }
  }
}

/** Reconoce la violación de unicidad sin depender de la clase de error. */
function esViolacionUnica(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = (error as { readonly code?: unknown }).code;

  return code === UNIQUE_VIOLATION;
}
