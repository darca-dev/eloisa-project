import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import {
  HOSPITAL_APPOINTMENT_MODALITIES,
  HOSPITAL_OPERATIONS_RESOURCES,
  HOSPITAL_PATIENTS_SOURCE,
  buildHospitalOperationsAudit,
  endOfUtcDayExclusive,
  personFullName,
  personInitials,
  startOfUtcDay,
  toUtcDate,
  utcDatesOfWindow,
  type HospitalAgendaAppointment,
  type HospitalAgendaRequest,
  type HospitalAgendaView,
  type HospitalAgendaWindow,
  type HospitalAppointmentModality,
  type HospitalMinimalProfessional,
} from './hospital.contract';
import {
  pacienteMinimo,
  type HospitalOperationsContext,
} from './hospital-professionals.service';

/**
 * Lectura hospitalaria de Agenda (TASK-HOSPITAL-CORE-02 §6.2).
 *
 * La agenda NO es un calendario de disponibilidad: es la proyección de las
 * CITAS PERSISTIDAS dentro de la ventana que la petición declaró. Un día sin
 * filas cuenta cero, y ese cero significa exactamente «ninguna cita
 * registrada»: nunca se sustituye por un mes de demostración, por un promedio
 * ni por una estimación.
 *
 * Reglas aplicadas:
 * - el tenant llega del principal institucional resuelto en el SERVIDOR;
 * - toda consulta corre dentro de `withTenant()`, con filtro explícito por
 *   `tenantId` ADEMÁS de Row Level Security;
 * - la lectura y su evento de auditoría comparten transacción;
 * - los conteos diarios y por modalidad se derivan de las MISMAS citas que la
 *   respuesta publica, de modo que la interfaz siempre puede reconciliarlos.
 *
 * LO QUE ESTE SERVICIO NO CALCULA: disponibilidad, hueco libre, solapamiento,
 * duración, desplazamiento, ruta, prioridad clínica y urgencia. Nada de eso
 * está modelado.
 */
@Injectable()
export class HospitalAgendaService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async view(
    context: HospitalOperationsContext,
    window: HospitalAgendaWindow,
  ): Promise<HospitalAgendaView> {
    const tenantId = context.principal.tenantId;

    return this.prisma.withTenant(tenantId, async (tx) => {
      /*
       * Las solicitudes NO se acotan por la ventana: una solicitud pendiente
       * todavía no tiene fecha, de modo que filtrarla por un periodo la haría
       * desaparecer sin motivo. Se ordenan por antigüedad, que es el único
       * criterio que los datos sostienen —no es una prioridad clínica—.
       */
      const solicitudes = await tx.appointment.findMany({
        where: { tenantId, status: 'REQUESTED' },
        select: {
          id: true,
          version: true,
          modality: true,
          requestedAt: true,
          patient: {
            select: { id: true, person: { select: { givenNames: true, familyNames: true } } },
          },
        },
        orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
      });

      /*
       * Profesional ASIGNABLE = perfil ACTIVO con vínculo ACTIVO. No es
       * «disponible»: significa exactamente que el perfil y su vínculo declarado
       * siguen vigentes en la institución.
       */
      const asignables = await tx.professionalProfile.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          affiliations: { some: { tenantId, status: 'ACTIVE' } },
        },
        select: {
          id: true,
          professionCode: true,
          professionNameControlled: true,
          person: { select: { givenNames: true, familyNames: true } },
        },
        orderBy: [
          { person: { familyNames: 'asc' } },
          { person: { givenNames: 'asc' } },
          { id: 'asc' },
        ],
      });

      const citas = await tx.appointment.findMany({
        where: {
          tenantId,
          status: 'ASSIGNED',
          scheduledStart: {
            gte: startOfUtcDay(window.from),
            lt: endOfUtcDayExclusive(window.to),
          },
        },
        select: {
          id: true,
          modality: true,
          status: true,
          scheduledStart: true,
          patient: {
            select: { id: true, person: { select: { givenNames: true, familyNames: true } } },
          },
          careAssignment: {
            select: {
              professional: {
                select: {
                  id: true,
                  professionCode: true,
                  professionNameControlled: true,
                  person: { select: { givenNames: true, familyNames: true } },
                },
              },
            },
          },
        },
        orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
      });

      await tx.auditEvent.create({
        data: buildHospitalOperationsAudit({
          tenantId,
          identityId: context.principal.identityId,
          role: context.principal.role,
          eventType: 'HOSPITAL_AGENDA_ACCESS_GRANTED',
          resourceType: HOSPITAL_OPERATIONS_RESOURCES.agenda,
          // Un acceso a una superficie no crea recurso: no se inventa uno.
          resourceId: null,
          endpoint: context.endpoint,
          correlationId: context.correlationId,
          occurredAt: context.now,
        }),
        select: { id: true },
      });

      const publicadas: HospitalAgendaAppointment[] = [];

      for (const cita of citas) {
        const profesional = cita.careAssignment?.professional ?? null;

        if (profesional === null || cita.scheduledStart === null) {
          /*
           * Inalcanzable: la base exige asignación y fecha en toda cita
           * `ASSIGNED`. Se conserva como defensa explícita para no publicar una
           * cita a la que le faltara su profesional.
           */
          continue;
        }

        publicadas.push({
          appointmentId: cita.id,
          patient: pacienteMinimo(cita.patient),
          modality: cita.modality as HospitalAppointmentModality,
          status: cita.status as HospitalAgendaAppointment['status'],
          scheduledStart: cita.scheduledStart.toISOString(),
          professional: profesionalMinimo(profesional),
        });
      }

      return {
        source: HOSPITAL_PATIENTS_SOURCE,
        generatedAt: context.now.toISOString(),
        window,
        requests: solicitudes.map(
          (solicitud): HospitalAgendaRequest => ({
            appointmentId: solicitud.id,
            version: solicitud.version,
            patient: pacienteMinimo(solicitud.patient),
            modality: solicitud.modality as HospitalAppointmentModality,
            requestedAt: solicitud.requestedAt.toISOString(),
          }),
        ),
        assignableProfessionals: asignables.map(profesionalMinimo),
        appointments: publicadas,
        dailyCounts: this.conteosDiarios(window, publicadas),
        modalityCounts: this.conteosPorModalidad(publicadas),
        totalAppointments: publicadas.length,
      };
    });
  }

  /**
   * Un conteo por CADA día de la ventana, incluidos los días sin citas.
   *
   * Omitir los días vacíos obligaría a la interfaz a decidir si un día ausente
   * significa cero o «no consultado». Publicar el cero elimina la ambigüedad.
   */
  private conteosDiarios(
    window: HospitalAgendaWindow,
    citas: readonly HospitalAgendaAppointment[],
  ): readonly { readonly date: string; readonly total: number }[] {
    const porDia = new Map<string, number>();

    for (const cita of citas) {
      if (cita.scheduledStart === null) {
        continue;
      }

      const dia = toUtcDate(new Date(cita.scheduledStart));
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    }

    return utcDatesOfWindow(window.from, window.to).map((date) => ({
      date,
      total: porDia.get(date) ?? 0,
    }));
  }

  /** Un conteo por CADA modalidad representada, también las que valen cero. */
  private conteosPorModalidad(
    citas: readonly HospitalAgendaAppointment[],
  ): readonly { readonly modality: HospitalAppointmentModality; readonly total: number }[] {
    return HOSPITAL_APPOINTMENT_MODALITIES.map((modality) => ({
      modality,
      total: citas.filter((cita) => cita.modality === modality).length,
    }));
  }
}

/** Proyección minimizada del profesional. Nunca incluye documento ni contacto. */
export function profesionalMinimo(profesional: {
  readonly id: string;
  readonly professionCode: string;
  readonly professionNameControlled: string;
  readonly person: { readonly givenNames: string; readonly familyNames: string };
}): HospitalMinimalProfessional {
  return {
    professionalId: profesional.id,
    fullName: personFullName(profesional.person.givenNames, profesional.person.familyNames),
    initials: personInitials(profesional.person.givenNames, profesional.person.familyNames),
    professionCode: profesional.professionCode,
    professionName: profesional.professionNameControlled,
  };
}
