import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { type HomeVisitStatus, type Prisma } from '../generated/prisma/client';
import { type HumanPrincipal } from '../identity-access/human-principal';

import {
  endOfUtcDayExclusive,
  startOfUtcDay,
  type ProfessionalWorklistWindow,
} from './visits.dto';

/**
 * WORKLIST PROFESIONAL de solo lectura (VISITADOR-CORE-01 MP01).
 *
 * Responde a UNA sola pregunta: «¿qué citas domiciliarias asignadas tengo yo en
 * esta ventana, y cuáles de ellas ya están materializadas?». Es la lectura que
 * faltaba para que una interfaz Visitador pueda DESCUBRIR sus recursos de forma
 * legítima, en lugar de recibir identificadores desde Hospital, desde fixtures o
 * desde datos inventados.
 *
 * NO ES UNA AGENDA INSTITUCIONAL Y NO ES UN DIRECTORIO. No enumera pacientes,
 * no enumera profesionales, no busca, no pagina por cursor ajeno y no admite
 * ningún filtro que permita preguntar por el trabajo de otra persona. Lo único
 * que el cliente aporta es la VENTANA DE CALENDARIO.
 *
 * AUTORIZACIÓN. La cadena es EXACTAMENTE la misma que MP03 exige para
 * transicionar y MP04 para leer el detalle, y se evalúa ENTERA dentro de la
 * propia consulta SQL, bajo el contexto de tenant:
 *
 *   principal.personId
 *     → `ProfessionalProfile` `ACTIVE` de ESA persona
 *     → al menos una `ProfessionalAffiliation` `ACTIVE` y vigente HOY
 *     → `CareAssignment` `ACTIVE` y vigente en el instante del SERVIDOR
 *     → `Appointment` HOME + ASSIGNED de ESA asignación, dentro de la ventana
 *     → `HomeVisit` de ESA misma cita y ESA misma asignación, si existe.
 *
 * El filtro no es «las citas de la ventana» sino «las citas de la ventana que
 * pertenecen a las asignaciones vigentes de quien pregunta». Una cita ajena no
 * se lee y por tanto no aparece.
 *
 * NO ACEPTA JAMÁS DEL CLIENTE: `tenantId`, `professionalId`, `patientId`,
 * `careAssignmentId`, estado, actor, rol, afiliación ni marca de tiempo.
 * `tenantId` y `personId` vienen del principal, que produce el validador de
 * sesión server-side; `now` lo fija el servidor.
 *
 * POR QUÉ LA CONDICIÓN SE ESCRIBE AQUÍ Y NO SE IMPORTA DE MP03 NI DE MP04: la
 * condición de esos paquetes es privada de sus servicios y la allowlist de MP01
 * prohíbe modificarlos. Lo que se comparte, y lo que de verdad importa, es la
 * BARRERA: las tres condiciones se evalúan contra las mismas filas, bajo el
 * mismo `withTenant()` y con Row Level Security vigente. Esta lectura NO
 * reimplementa la máquina de transiciones ni ninguna mutación.
 *
 * RESPUESTA VACÍA Y NO `403`/`404`. Una persona sin perfil, sin afiliación
 * vigente, sin asignaciones o sin citas en la ventana recibe una lista VACÍA.
 * Distinguir esos casos con un código propio permitiría enumerar quién es
 * profesional operativo y quién tiene agenda, y la superficie es la PROPIA: no
 * hay nada que ocultar salvo la existencia de trabajo ajeno.
 *
 * LO QUE NO HACE, deliberadamente: NO materializa —una cita con `visit: null`
 * sigue siendo un acto pendiente de la agenda hospitalaria—, NO transiciona, NO
 * escribe nada —tampoco auditoría de lectura, que MP01 no aprueba, porque el
 * catálogo de eventos vigente no tiene ninguno para esta superficie—, NO
 * devuelve dirección, contacto, documento, diagnóstico, alerta ni dato clínico,
 * y NO aplica ninguna regla clínica.
 */

/** Estado operativo de la visita ya materializada. Proyección MINIMIZADA. */
export interface ProfessionalWorklistVisitView {
  readonly homeVisitId: string;
  readonly status: HomeVisitStatus;
  readonly version: number;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly updatedAt: string;
}

/** Persona atendida, reducida a lo que permite reconocerla en la propia agenda. */
export interface ProfessionalWorklistPatientView {
  readonly displayName: string;
  readonly initials: string;
}

/** Una cita HOME asignada, con su visita cuando ya existe. */
export interface ProfessionalWorklistItemView {
  readonly appointmentId: string;
  readonly scheduledStart: string;
  readonly modality: 'HOME';
  readonly patient: ProfessionalWorklistPatientView;
  readonly visit: ProfessionalWorklistVisitView | null;
}

export interface ProfessionalWorklistView {
  readonly window: ProfessionalWorklistWindow;
  readonly items: readonly ProfessionalWorklistItemView[];
}

@Injectable()
export class ProfessionalVisitWorklistService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async listAuthorized(
    principal: HumanPrincipal,
    window: ProfessionalWorklistWindow,
    now: Date,
  ): Promise<ProfessionalWorklistView> {
    const { tenantId } = principal;

    const items = await this.prisma.withTenant(tenantId, async (tx) => {
      const citas = await tx.appointment.findMany({
        /*
         * Filtro explícito por tenant en la cita, en el paciente, en la
         * asignación, en el perfil, en la afiliación y en la visita, ADEMÁS de
         * Row Level Security, que bajo `withTenant` ya hace invisible cualquier
         * fila de otra institución, y ADEMÁS de las claves foráneas COMPUESTAS
         * `(id, tenantId)` que la base impone. El aislamiento institucional no
         * debe depender de una sola barrera.
         */
        where: {
          tenantId,
          modality: 'HOME',
          status: 'ASSIGNED',
          /*
           * Ventana de CALENDARIO resuelta en UTC, con cota superior EXCLUSIVA:
           * una cita programada en el último milisegundo del día `to` entra, y
           * una del primer milisegundo del día siguiente no. Una cita sin
           * `scheduledStart` queda fuera por construcción: no está programada.
           */
          scheduledStart: {
            gte: startOfUtcDay(window.from),
            lt: endOfUtcDayExclusive(window.to),
          },
          patient: { tenantId },
          careAssignment: asignacionAutorizada(principal, now),
        },
        select: {
          id: true,
          scheduledStart: true,
          careAssignmentId: true,
          patient: {
            select: { person: { select: { givenNames: true, familyNames: true } } },
          },
          homeVisit: {
            select: {
              id: true,
              tenantId: true,
              careAssignmentId: true,
              status: true,
              version: true,
              startedAt: true,
              endedAt: true,
              updatedAt: true,
            },
          },
        },
        /*
         * Orden ESTABLE y totalmente determinista: dos citas del mismo instante
         * no pueden alternar su posición entre dos lecturas idénticas.
         */
        orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
      });

      return citas.map((cita) => proyectar(cita));
    });

    return {
      // La ventana se devuelve EXACTAMENTE como se pidió: ni se amplía ni se recorta.
      window,
      items,
    };
  }
}

/** Fila tal como la selecciona la consulta. No se expone fuera de este archivo. */
interface FilaCita {
  readonly id: string;
  readonly scheduledStart: Date | null;
  readonly careAssignmentId: string | null;
  readonly patient: {
    readonly person: { readonly givenNames: string; readonly familyNames: string };
  };
  readonly homeVisit: {
    readonly id: string;
    readonly tenantId: string;
    readonly careAssignmentId: string;
    readonly status: HomeVisitStatus;
    readonly version: number;
    readonly startedAt: Date | null;
    readonly endedAt: Date | null;
    readonly updatedAt: Date;
  } | null;
}

/**
 * Proyecta UNA fila al contrato minimizado.
 *
 * `scheduledStart` no puede ser nulo aquí —el filtro de ventana ya lo exige—,
 * pero el tipo lo admite porque la columna es opcional mientras la cita es una
 * solicitud. La aserción se escribe igualmente para que el contrato no dependa
 * de una inferencia.
 */
function proyectar(fila: FilaCita): ProfessionalWorklistItemView {
  if (fila.scheduledStart === null) {
    // Inalcanzable con el filtro de ventana activo; defensa explícita.
    throw new Error('Una cita de la worklist llegó sin instante programado.');
  }

  return {
    appointmentId: fila.id,
    scheduledStart: fila.scheduledStart.toISOString(),
    // Constante del contrato, NO un reflejo del almacenamiento: el filtro ya la fijó.
    modality: 'HOME',
    patient: {
      displayName: nombreMostrable(
        fila.patient.person.givenNames,
        fila.patient.person.familyNames,
      ),
      initials: iniciales(fila.patient.person.givenNames, fila.patient.person.familyNames),
    },
    visit: proyectarVisita(fila),
  };
}

/**
 * Visita de la cita, SOLO si es coherente con la asignación autorizada.
 *
 * La relación `Appointment.homeVisit` es única por `(appointmentId, tenantId)` y
 * el disparador `home_visit_guard` de VISITS-CORE-01 MP01 ya impide una fila
 * incoherente. Aun así se vuelve a comprobar aquí que la visita pertenece al
 * MISMO tenant y a la MISMA asignación de cuidado por la que la cita quedó
 * autorizada: no se confía en una relación solo porque comparte un
 * identificador. Una incoherencia —hoy inalcanzable— se resuelve CERRADO, sin
 * exponer el estado ni la versión de una fila cuya procedencia no se confirma.
 */
function proyectarVisita(fila: FilaCita): ProfessionalWorklistVisitView | null {
  const visita = fila.homeVisit;

  if (visita === null) {
    return null;
  }

  if (
    fila.careAssignmentId === null ||
    visita.careAssignmentId !== fila.careAssignmentId
  ) {
    return null;
  }

  return {
    homeVisitId: visita.id,
    status: visita.status,
    version: visita.version,
    startedAt: visita.startedAt?.toISOString() ?? null,
    endedAt: visita.endedAt?.toISOString() ?? null,
    updatedAt: visita.updatedAt.toISOString(),
  };
}

/**
 * Nombre mostrable de la persona atendida.
 *
 * Proyección de PRESENTACIÓN y nada más: no incluye documento, contacto ni
 * ningún otro dato, y no es un identificador con el que se pueda buscar.
 */
function nombreMostrable(givenNames: string, familyNames: string): string {
  return `${givenNames} ${familyNames}`.replace(/\s+/gu, ' ').trim();
}

/**
 * Iniciales del primer nombre y del primer apellido.
 *
 * Es una abreviatura de PRESENTACIÓN, no un identificador ni una clave.
 */
function iniciales(givenNames: string, familyNames: string): string {
  const primera = (valor: string): string =>
    (valor.trim().split(/\s+/u)[0] ?? '').slice(0, 1).toLocaleUpperCase('es-CO');

  return `${primera(givenNames)}${primera(familyNames)}`;
}

/**
 * Condición de AUTORIZACIÓN sobre la asignación de cuidado de la cita.
 *
 * Se construye desde `principal.personId` y de ningún otro sitio. Exige, todo a
 * la vez:
 *
 *   1. `CareAssignment` `ACTIVE` y VIGENTE en el instante de la consulta;
 *   2. que su `ProfessionalProfile` sea el de ESA persona y esté `ACTIVE`;
 *   3. que ese perfil tenga al menos una `ProfessionalAffiliation` `ACTIVE` y
 *      vigente: un perfil sin vínculo vigente no es profesional operativo.
 *
 * Ninguna de las tres es opcional y ninguna se comprueba por separado: van
 * juntas en la MISMA condición SQL. Es la MISMA barrera que aplican MP03 y MP04
 * sobre las mismas filas.
 *
 * `Appointment.careAssignmentId` es opcional mientras la cita es una solicitud;
 * declarar esta condición sobre la relación excluye por construcción cualquier
 * cita sin asignación, que además nunca está `ASSIGNED`.
 *
 * El `tenantId` se repite en los tres niveles ADEMÁS de Row Level Security y de
 * las claves foráneas compuestas. Es redundante a propósito.
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
