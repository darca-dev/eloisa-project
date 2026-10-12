import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { type InstitutionalPrincipal } from '../institutional-auth/institutional-auth.service';

import {
  HOSPITAL_OPERATIONS_RESOURCES,
  HOSPITAL_OPERATIONS_UNAVAILABLE,
  HOSPITAL_PATIENTS_SOURCE,
  buildHospitalOperationsAudit,
  endOfUtcDayExclusive,
  personFullName,
  personInitials,
  startOfUtcDay,
  toUtcDate,
  type HospitalAffiliationSummary,
  type HospitalAgendaWindow,
  type HospitalMinimalPatient,
  type HospitalOperationsEventType,
  type HospitalOperationsResource,
  type HospitalProfessionalDetail,
  type HospitalProfessionalList,
  type HospitalProfessionalListItem,
  type HospitalScheduledAppointment,
} from './hospital.contract';
import { type HospitalProfessionalsListQuery } from './hospital-professionals.query';

/**
 * Lectura hospitalaria del directorio de Profesionales
 * (TASK-HOSPITAL-CORE-02 §6.1).
 *
 * Reglas aplicadas, idénticas a las que ya rigen Hospital Pacientes:
 *
 * - el tenant llega del principal institucional resuelto en el SERVIDOR; el
 *   navegador nunca lo envía y no puede enviarlo, porque no está en la
 *   allowlist de la consulta;
 * - toda consulta se ejecuta dentro de `PrismaService.withTenant()`, de modo que
 *   la sesión adopta el rol `merdn_runtime` y PostgreSQL aplica Row Level
 *   Security ADEMÁS del filtro explícito por `tenantId` que se conserva aquí;
 * - la lectura y su evento de auditoría comparten transacción: no puede quedar
 *   una lectura servida sin su rastro (FAIL-CLOSED);
 * - solo se seleccionan las columnas imprescindibles. Documento, teléfono,
 *   correo, dirección y fecha de nacimiento NO se seleccionan siquiera: agendar
 *   no requiere conocerlos.
 *
 * REUTILIZACIÓN, NO DUPLICACIÓN: un profesional es una PARTICIPACIÓN de la
 * única `Person` del tenant. No existe una persona profesional paralela, no se
 * copia su identidad y no hay un segundo directorio de personas.
 *
 * LO QUE ESTE SERVICIO NO CALCULA: disponibilidad, capacidad, calificación,
 * rendimiento, productividad y conflicto clínico. Ninguno está modelado y
 * derivar una cifra que los sugiriera sería inventarlos.
 */

/** Contexto mínimo de auditoría de una petición de operaciones. */
export interface HospitalOperationsContext {
  readonly principal: InstitutionalPrincipal;
  readonly correlationId: string;
  readonly endpoint: string;
  readonly now: Date;
}

/** Columnas EXACTAS que la proyección del directorio necesita. */
const SELECCION_PROFESIONAL = {
  id: true,
  professionCode: true,
  professionNameControlled: true,
  status: true,
  person: { select: { givenNames: true, familyNames: true } },
} as const;

interface FilaProfesional {
  readonly id: string;
  readonly professionCode: string;
  readonly professionNameControlled: string;
  readonly status: string;
  readonly person: { readonly givenNames: string; readonly familyNames: string };
}

interface FilaAfiliacion {
  readonly professionalId: string;
  readonly engagementType: string;
  readonly status: string;
  readonly startsOn: Date;
  readonly endsOn: Date | null;
}

/** Cifras derivadas de los registros persistidos de un profesional. */
interface CifrasDerivadas {
  readonly activePatientCount: number;
  readonly todayAppointmentCount: number;
  readonly nextAppointmentAt: string | null;
}

const SIN_CIFRAS: CifrasDerivadas = {
  activePatientCount: 0,
  todayAppointmentCount: 0,
  nextAppointmentAt: null,
};

@Injectable()
export class HospitalProfessionalsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Directorio paginado, filtrado y ordenado ENTERAMENTE en PostgreSQL. */
  public async list(
    context: HospitalOperationsContext,
    query: HospitalProfessionalsListQuery,
  ): Promise<HospitalProfessionalList> {
    const tenantId = context.principal.tenantId;
    const where = this.buildWhere(tenantId, query);

    return this.prisma.withTenant(tenantId, async (tx) => {
      const totalItems = await tx.professionalProfile.count({ where });
      const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
      /*
       * Página corregida de forma DETERMINISTA: una página fuera de rango
       * devuelve la última existente en lugar de una lista vacía sin
       * explicación. La corrección se publica en la respuesta.
       */
      const page = Math.min(Math.max(1, query.page), totalPages);

      const rows = (await tx.professionalProfile.findMany({
        where,
        select: SELECCION_PROFESIONAL,
        orderBy: this.buildOrderBy(query),
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
      })) as unknown as readonly FilaProfesional[];

      const ids = rows.map((row) => row.id);
      const afiliaciones = await this.afiliacionesActivas(tx, tenantId, ids);
      const cifras = await this.cifrasDerivadas(tx, tenantId, ids, context.now);

      await this.auditar(
        tx,
        context,
        'HOSPITAL_PROFESSIONAL_LIST_ACCESS_GRANTED',
        HOSPITAL_OPERATIONS_RESOURCES.professionalList,
        null,
      );

      return {
        source: HOSPITAL_PATIENTS_SOURCE,
        generatedAt: context.now.toISOString(),
        page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
        items: rows.map((row) =>
          this.toListItem(
            row,
            afiliaciones.get(row.id) ?? null,
            cifras.get(row.id) ?? SIN_CIFRAS,
          ),
        ),
      };
    });
  }

  /**
   * Detalle de un profesional del tenant activo.
   *
   * Devuelve `null` de forma UNIFORME cuando el identificador no existe y cuando
   * existe pero pertenece a otra institución: el controlador traduce ambos casos
   * al mismo `404`, de modo que la respuesta jamás confirma la existencia de un
   * registro ajeno.
   */
  public async detail(
    context: HospitalOperationsContext,
    professionalId: string,
    window: HospitalAgendaWindow,
  ): Promise<HospitalProfessionalDetail | null> {
    const tenantId = context.principal.tenantId;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const row = (await tx.professionalProfile.findFirst({
        // El filtro explícito por tenant se conserva junto a Row Level Security.
        where: { id: professionalId, tenantId },
        select: SELECCION_PROFESIONAL,
      })) as unknown as FilaProfesional | null;

      if (row === null) {
        /*
         * Una lectura que no devuelve nada NO se audita como acceso concedido:
         * no hubo acceso a ningún dato. Tampoco se audita con el recurso, para
         * no convertir la traza en un oráculo de existencia.
         */
        return null;
      }

      const afiliaciones = await this.afiliacionesActivas(tx, tenantId, [row.id]);
      const cifras = await this.cifrasDerivadas(tx, tenantId, [row.id], context.now);

      const asignaciones = await tx.careAssignment.findMany({
        where: { tenantId, professionalId: row.id, status: 'ACTIVE' },
        select: {
          patient: { select: { id: true, person: { select: { givenNames: true, familyNames: true } } } },
        },
        orderBy: { startsAt: 'asc' },
      });

      const citas = await tx.appointment.findMany({
        where: {
          tenantId,
          status: 'ASSIGNED',
          scheduledStart: {
            gte: startOfUtcDay(window.from),
            lt: endOfUtcDayExclusive(window.to),
          },
          careAssignment: { tenantId, professionalId: row.id },
        },
        select: {
          id: true,
          modality: true,
          status: true,
          scheduledStart: true,
          patient: { select: { id: true, person: { select: { givenNames: true, familyNames: true } } } },
        },
        orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
      });

      await this.auditar(
        tx,
        context,
        'HOSPITAL_PROFESSIONAL_DETAIL_ACCESS_GRANTED',
        HOSPITAL_OPERATIONS_RESOURCES.professionalDetail,
        row.id,
      );

      const base = this.toListItem(
        row,
        afiliaciones.get(row.id) ?? null,
        cifras.get(row.id) ?? SIN_CIFRAS,
      );

      return {
        ...base,
        source: HOSPITAL_PATIENTS_SOURCE,
        generatedAt: context.now.toISOString(),
        window,
        assignedPatients: asignaciones.map((asignacion) =>
          pacienteMinimo(asignacion.patient),
        ),
        appointments: citas.map(
          (cita): HospitalScheduledAppointment => ({
            appointmentId: cita.id,
            patient: pacienteMinimo(cita.patient),
            modality: cita.modality as HospitalScheduledAppointment['modality'],
            status: cita.status as HospitalScheduledAppointment['status'],
            scheduledStart: cita.scheduledStart?.toISOString() ?? null,
          }),
        ),
      };
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Consulta                                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Condiciones del directorio, combinadas con AND.
   *
   * Todo valor procede de `parseProfessionalsListQuery`, que ya rechazó
   * cualquier parámetro fuera de la allowlist. Nada se interpola en SQL: Prisma
   * parametriza la consulta completa.
   */
  private buildWhere(
    tenantId: string,
    query: HospitalProfessionalsListQuery,
  ): Record<string, unknown> {
    const { filters } = query;
    const where: Record<string, unknown> = { tenantId };

    if (filters.status !== null) {
      where['status'] = filters.status;
    }

    if (filters.professionCode !== null) {
      where['professionCode'] = filters.professionCode;
    }

    if (filters.affiliationType !== null) {
      // Vínculo VIGENTE del tipo indicado. Un vínculo terminado no cuenta: ya no
      // está declarado y presentarlo como vigente afirmaría lo que no es.
      where['affiliations'] = {
        some: { tenantId, status: 'ACTIVE', engagementType: filters.affiliationType },
      };
    }

    if (filters.search !== null) {
      /*
       * Coincide por NOMBRE exclusivamente. Se exigen TODAS las palabras del
       * término, cada una en el nombre o en los apellidos, de modo que «Ana
       * Ejemplo» encuentre a «Ana María Ejemplo Ficticio». No se busca por
       * documento: agendar no requiere conocerlo.
       */
      where['person'] = {
        tenantId,
        AND: filters.search.tokens.map((token) => ({
          OR: [
            { givenNames: { contains: token, mode: 'insensitive' } },
            { familyNames: { contains: token, mode: 'insensitive' } },
          ],
        })),
      };
    }

    return where;
  }

  /**
   * Orden TOTAL y estable.
   *
   * El identificador desempata siempre: sin él, dos personas con el mismo
   * apellido podrían aparecer dos veces —o desaparecer— al pasar de página,
   * porque PostgreSQL no garantiza un orden estable ante empates.
   */
  private buildOrderBy(query: HospitalProfessionalsListQuery): Record<string, unknown>[] {
    const dir = query.direction;

    if (query.sort === 'profession') {
      return [{ professionNameControlled: dir }, { id: 'asc' }];
    }

    return [
      { person: { familyNames: dir } },
      { person: { givenNames: dir } },
      { id: 'asc' },
    ];
  }

  /**
   * Vínculo ACTIVO vigente de cada profesional de la página.
   *
   * Cuando existiera más de uno se conserva el de inicio más reciente, con el
   * identificador como desempate: la elección es DETERMINISTA y no depende del
   * orden en que PostgreSQL devuelva las filas.
   */
  private async afiliacionesActivas(
    tx: PrismaTransaction,
    tenantId: string,
    professionalIds: readonly string[],
  ): Promise<ReadonlyMap<string, HospitalAffiliationSummary>> {
    const resultado = new Map<string, HospitalAffiliationSummary>();

    if (professionalIds.length === 0) {
      return resultado;
    }

    const filas = (await tx.professionalAffiliation.findMany({
      where: { tenantId, professionalId: { in: [...professionalIds] }, status: 'ACTIVE' },
      select: {
        professionalId: true,
        engagementType: true,
        status: true,
        startsOn: true,
        endsOn: true,
      },
      orderBy: [{ startsOn: 'desc' }, { id: 'asc' }],
    })) as unknown as readonly FilaAfiliacion[];

    for (const fila of filas) {
      if (resultado.has(fila.professionalId)) {
        continue;
      }

      resultado.set(fila.professionalId, {
        engagementType: fila.engagementType as HospitalAffiliationSummary['engagementType'],
        status: fila.status as HospitalAffiliationSummary['status'],
        startsOn: toUtcDate(fila.startsOn),
        endsOn: fila.endsOn === null ? null : toUtcDate(fila.endsOn),
      });
    }

    return resultado;
  }

  /**
   * Cifras derivadas de los registros persistidos.
   *
   * - `activePatientCount`: asignaciones de cuidado ACTIVAS. Como la base impone
   *   una sola asignación primaria activa por paciente, contar asignaciones
   *   equivale a contar personas y nadie se cuenta dos veces.
   * - `todayAppointmentCount`: citas no canceladas cuyo inicio cae en el día UTC
   *   de la consulta. Es actividad REGISTRADA, no carga ni ocupación.
   * - `nextAppointmentAt`: primera cita asignada a partir del instante de la
   *   consulta. Es la siguiente cita REGISTRADA, no la siguiente disponible.
   *
   * Se resuelven con tres consultas agregadas para la página completa, y no una
   * por fila: el coste no crece con el tamaño de la página.
   */
  private async cifrasDerivadas(
    tx: PrismaTransaction,
    tenantId: string,
    professionalIds: readonly string[],
    now: Date,
  ): Promise<ReadonlyMap<string, CifrasDerivadas>> {
    const resultado = new Map<string, CifrasDerivadas>();

    if (professionalIds.length === 0) {
      return resultado;
    }

    const ids = [...professionalIds];

    const asignaciones = await tx.careAssignment.findMany({
      where: { tenantId, professionalId: { in: ids } },
      select: { id: true, professionalId: true, status: true },
    });

    const profesionalDeAsignacion = new Map<string, string>();
    const activasPorProfesional = new Map<string, number>();

    for (const asignacion of asignaciones) {
      profesionalDeAsignacion.set(asignacion.id, asignacion.professionalId);

      if (asignacion.status === 'ACTIVE') {
        activasPorProfesional.set(
          asignacion.professionalId,
          (activasPorProfesional.get(asignacion.professionalId) ?? 0) + 1,
        );
      }
    }

    const assignmentIds = [...profesionalDeAsignacion.keys()];
    const hoy = toUtcDate(now);

    const citasDeHoy =
      assignmentIds.length === 0
        ? []
        : await tx.appointment.findMany({
            where: {
              tenantId,
              careAssignmentId: { in: assignmentIds },
              status: { not: 'CANCELLED' },
              scheduledStart: {
                gte: startOfUtcDay(hoy),
                lt: endOfUtcDayExclusive(hoy),
              },
            },
            select: { careAssignmentId: true },
          });

    const hoyPorProfesional = new Map<string, number>();

    for (const cita of citasDeHoy) {
      const profesional =
        cita.careAssignmentId === null
          ? undefined
          : profesionalDeAsignacion.get(cita.careAssignmentId);

      if (profesional !== undefined) {
        hoyPorProfesional.set(profesional, (hoyPorProfesional.get(profesional) ?? 0) + 1);
      }
    }

    const proximas =
      assignmentIds.length === 0
        ? []
        : await tx.appointment.groupBy({
            by: ['careAssignmentId'],
            where: {
              tenantId,
              careAssignmentId: { in: assignmentIds },
              status: 'ASSIGNED',
              scheduledStart: { gte: now },
            },
            _min: { scheduledStart: true },
          });

    const proximaPorProfesional = new Map<string, Date>();

    for (const grupo of proximas) {
      const profesional =
        grupo.careAssignmentId === null
          ? undefined
          : profesionalDeAsignacion.get(grupo.careAssignmentId);
      const instante = grupo._min.scheduledStart;

      if (profesional === undefined || instante === null || instante === undefined) {
        continue;
      }

      const actual = proximaPorProfesional.get(profesional);

      if (actual === undefined || instante.getTime() < actual.getTime()) {
        proximaPorProfesional.set(profesional, instante);
      }
    }

    for (const id of ids) {
      resultado.set(id, {
        activePatientCount: activasPorProfesional.get(id) ?? 0,
        todayAppointmentCount: hoyPorProfesional.get(id) ?? 0,
        nextAppointmentAt: proximaPorProfesional.get(id)?.toISOString() ?? null,
      });
    }

    return resultado;
  }

  private toListItem(
    row: FilaProfesional,
    affiliation: HospitalAffiliationSummary | null,
    cifras: CifrasDerivadas,
  ): HospitalProfessionalListItem {
    return {
      professionalId: row.id,
      fullName: personFullName(row.person.givenNames, row.person.familyNames),
      initials: personInitials(row.person.givenNames, row.person.familyNames),
      professionCode: row.professionCode,
      professionName: row.professionNameControlled,
      status: row.status as HospitalProfessionalListItem['status'],
      activeAffiliation: affiliation,
      activePatientCount: cifras.activePatientCount,
      todayAppointmentCount: cifras.todayAppointmentCount,
      nextAppointmentAt: cifras.nextAppointmentAt,
      /*
       * La plataforma NO modela calificaciones. El texto es fijo y no un cero:
       * un cero se leería como «mal calificado», que es una afirmación.
       */
      ratingAvailability: HOSPITAL_OPERATIONS_UNAVAILABLE.rating,
    };
  }

  private async auditar(
    tx: PrismaTransaction,
    context: HospitalOperationsContext,
    eventType: HospitalOperationsEventType,
    resourceType: HospitalOperationsResource,
    resourceId: string | null,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: buildHospitalOperationsAudit({
        tenantId: context.principal.tenantId,
        identityId: context.principal.identityId,

        ...(context.principal.humanAccountId === undefined ? {} : { humanAccountId: context.principal.humanAccountId }),
        role: context.principal.role,
        eventType,
        resourceType,
        resourceId,
        endpoint: context.endpoint,
        correlationId: context.correlationId,
        occurredAt: context.now,
      }),
      select: { id: true },
    });
  }
}

/** Proyección minimizada del paciente. Nunca incluye documento ni contacto. */
export function pacienteMinimo(patient: {
  readonly id: string;
  readonly person: { readonly givenNames: string; readonly familyNames: string };
}): HospitalMinimalPatient {
  return {
    patientId: patient.id,
    fullName: personFullName(patient.person.givenNames, patient.person.familyNames),
    initials: personInitials(patient.person.givenNames, patient.person.familyNames),
  };
}
