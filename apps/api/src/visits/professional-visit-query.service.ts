import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { type HomeVisitStatus, type Prisma } from '../generated/prisma/client';
import { type HumanPrincipal } from '../identity-access/human-principal';

import {
  HOME_VISIT_TRANSITION_ERROR_CODES,
  HomeVisitTransitionError,
} from './home-visit-transition.service';

/**
 * ÚNICA lectura profesional autorizada por VISITS-CORE-01 MP04.
 *
 * Devuelve UNA visita domiciliaria conocida por su identificador, y solo si la
 * persona autenticada es su profesional asignada y vigente. NO existe listado,
 * búsqueda, agenda propia ni recorrido: enumerar visitas revelaría a quién
 * atiende quién sin que ninguna Task lo haya autorizado.
 *
 * AUTORIZACIÓN. La cadena es la MISMA que MP03 exige para transicionar y se
 * evalúa ENTERA dentro de la propia consulta SQL, bajo el contexto de tenant:
 *
 *   principal.personId
 *     → `ProfessionalProfile` `ACTIVE` de ESA persona
 *     → al menos una `ProfessionalAffiliation` `ACTIVE` y vigente
 *     → `CareAssignment` `ACTIVE` y vigente
 *     → la visita de esa asignación.
 *
 * El filtro no es «esta visita» sino «esta visita, si quien pregunta es su
 * profesional asignada y vigente». Una visita ajena no se lee y por tanto no se
 * distingue de una inexistente.
 *
 * NO ACEPTA JAMÁS DEL CLIENTE: `tenantId`, `patientId`, `professionalId`, actor,
 * rol ni marca de tiempo. `tenantId` y `personId` vienen del principal, que
 * produce el validador de sesión server-side; `now` lo fija el servidor.
 *
 * POR QUÉ LA CONDICIÓN SE ESCRIBE AQUÍ Y NO SE IMPORTA DE MP03: la condición de
 * MP03 es privada de su servicio y la allowlist de MP04 prohíbe modificar los
 * servicios de MP02 y MP03. Lo que se comparte, y lo que de verdad importa, es
 * la BARRERA: las dos condiciones se evalúan contra las mismas filas, bajo el
 * mismo `withTenant()` y con Row Level Security vigente. Esta lectura NO
 * reimplementa la máquina de transiciones ni ninguna mutación.
 *
 * LO QUE NO HACE, deliberadamente: NO materializa, NO transiciona, NO escribe
 * nada —tampoco auditoría de lectura, que MP04 no aprueba—, NO devuelve
 * paciente, profesional, persona, horario, dirección ni dato clínico, y NO
 * aplica ninguna regla clínica.
 */

/**
 * Proyección MINIMIZADA de la visita.
 *
 * Solo identificadores OPACOS y estado operativo. Es exactamente lo que el
 * contrato de MP04 admite devolver, y ni un campo más.
 */
export interface ProfessionalHomeVisitView {
  readonly homeVisitId: string;
  readonly appointmentId: string;
  readonly status: HomeVisitStatus;
  readonly version: number;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

@Injectable()
export class ProfessionalVisitQueryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async findAuthorized(
    principal: HumanPrincipal,
    visitId: string,
    now: Date,
  ): Promise<ProfessionalHomeVisitView> {
    const { tenantId } = principal;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const visita = await tx.homeVisit.findFirst({
        /*
         * Filtro explícito por tenant ADEMÁS de Row Level Security, que bajo
         * `withTenant` ya hace invisible cualquier fila de otra institución. El
         * aislamiento institucional no debe depender de una sola barrera.
         */
        where: {
          id: visitId,
          tenantId,
          careAssignment: asignacionAutorizada(principal, now),
        },
        select: {
          id: true,
          appointmentId: true,
          status: true,
          version: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (visita === null) {
        /*
         * `404` UNIFORME ante visita inexistente, visita de otra institución y
         * persona sin asignación vigente. Distinguir los tres casos confirmaría
         * la existencia de un registro ajeno o describiría el estado de una
         * asignación que quien pregunta puede no tener por qué conocer.
         *
         * Se reutiliza el desenlace ya aprobado en MP03 en lugar de acuñar un
         * código nuevo: las dos superficies deben ser indistinguibles.
         */
        throw new HomeVisitTransitionError(
          HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          404,
          'No fue posible encontrar la visita indicada.',
        );
      }

      return {
        homeVisitId: visita.id,
        appointmentId: visita.appointmentId,
        status: visita.status,
        version: visita.version,
        startedAt: visita.startedAt?.toISOString() ?? null,
        endedAt: visita.endedAt?.toISOString() ?? null,
        createdAt: visita.createdAt.toISOString(),
        updatedAt: visita.updatedAt.toISOString(),
      };
    });
  }
}

function asignacionAutorizada(
  principal: HumanPrincipal,
  now: Date,
): Prisma.CareAssignmentWhereInput {
  const today = fechaSinHora(now);

  return {
    tenantId: principal.tenantId,
    status: 'ACTIVE',
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    professional: {
      tenantId: principal.tenantId,
      personId: principal.personId,
      status: 'ACTIVE',
      affiliations: {
        some: {
          tenantId: principal.tenantId,
          status: 'ACTIVE',
          startsOn: { lte: today },
          OR: [{ endsOn: null }, { endsOn: { gte: today } }],
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
