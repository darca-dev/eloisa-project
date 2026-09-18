import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import { type HumanPrincipal } from './human-principal';

/**
 * Resolutores de PARTICIPACIÓN de la persona autenticada
 * (IDENTITY-RELATIONSHIPS-CORE-01 §7.2).
 *
 * Traducen un principal humano —que solo sabe QUIÉN es— en las participaciones
 * que esa persona tiene vivas dentro del tenant: paciente y profesional. La
 * participación de CUIDADORA vive en su propio módulo, porque depende de una
 * relación con vigencia y alcance propios.
 *
 * REGLA CENTRAL, y la razón de que estos servicios existan: NINGUNO recibe
 * `patientId` ni `professionalId` como autoridad. Todos parten de
 * `principal.personId`, que solo puede haber salido del validador de sesión. Si
 * un endpoint aceptara el identificador del cliente, cualquiera podría leer el
 * expediente de otra persona enviando su identificador.
 *
 * Se reevalúan EN CADA OPERACIÓN (AD-06): un perfil desactivado, un vínculo
 * terminado o un paciente dado de baja cierran el acceso de inmediato, sin
 * esperar a que caduque la sesión.
 *
 * Estos servicios se exportan para `VISITS-CORE-01`. Esta Task NO crea
 * endpoints ni modelos de Visitas.
 */

/** Participación de PACIENTE resuelta server-side. */
export interface ResolvedPatient {
  readonly patientId: string;
}

/** Participación PROFESIONAL resuelta server-side. */
export interface ResolvedProfessional {
  readonly professionalId: string;
}

@Injectable()
export class IdentityAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Paciente PROPIO de la persona autenticada.
   *
   * Devuelve `null` cuando la persona no tiene participación de paciente o esta
   * no está activa. Nunca acepta un `patientId` del cliente: el identificador
   * SALE de aquí, no entra.
   */
  public async resolvePatient(principal: HumanPrincipal): Promise<ResolvedPatient | null> {
    const patient = await this.prisma.withTenant(principal.tenantId, async (tx) =>
      tx.patient.findFirst({
        // Filtro explícito por tenant ADEMÁS de Row Level Security.
        where: { tenantId: principal.tenantId, personId: principal.personId, status: 'ACTIVE' },
        select: { id: true },
      }),
    );

    return patient === null ? null : { patientId: patient.id };
  }

  /**
   * Participación PROFESIONAL vigente de la persona autenticada.
   *
   * Exige DOS condiciones acumulativas, y no una:
   * 1. un `ProfessionalProfile` en estado `ACTIVE`;
   * 2. al menos una `ProfessionalAffiliation` `ACTIVE` cuya vigencia incluya el
   *    instante evaluado.
   *
   * Un perfil activo SIN vínculo vigente NO es profesional operativo: la persona
   * conserva su perfil histórico pero ya no está vinculada a la institución.
   * Aceptar solo el perfil convertiría a quien terminó su vínculo en profesional
   * indefinido.
   *
   * NO acredita título, habilitación, tarjeta profesional, RETHUS, contrato ni
   * pago: nada de eso está modelado y nada de eso debe deducirse de aquí.
   */
  public async resolveProfessional(
    principal: HumanPrincipal,
    now: Date,
  ): Promise<ResolvedProfessional | null> {
    const hoy = toUtcDate(now);

    const profile = await this.prisma.withTenant(principal.tenantId, async (tx) =>
      tx.professionalProfile.findFirst({
        where: {
          tenantId: principal.tenantId,
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
        select: { id: true },
      }),
    );

    return profile === null ? null : { professionalId: profile.id };
  }

  /**
   * Helper para consumidores futuros: profesional vigente CON asignación activa
   * sobre el paciente indicado.
   *
   * Combina en UNA SOLA operación —y por tanto en una sola transacción, bajo un
   * único contexto de rol runtime y tenant— las condiciones que
   * `VISITS-CORE-01` necesitará antes de mostrar o registrar nada sobre una
   * persona concreta:
   * 1. la asignación es del MISMO tenant del principal y del MISMO `patientId`;
   * 2. la asignación está `ACTIVE` y su vigencia está viva: ya empezó
   *    (`startsAt <= now`) y no ha terminado (`endsAt` nulo o posterior a
   *    `now`);
   * 3. el `ProfessionalProfile` al que apunta la asignación es el de
   *    `principal.personId` —no uno enviado por el cliente— y está `ACTIVE`;
   * 4. ese perfil tiene una `ProfessionalAffiliation` `ACTIVE` ya iniciada y no
   *    finalizada en el instante evaluado.
   *
   * Se evalúa TODO junto a propósito. Resolver antes el profesional y consultar
   * después la asignación abriría dos transacciones distintas: entre una y otra
   * el perfil, el vínculo o la asignación pueden cambiar, y la decisión se
   * tomaría con una foto que ya no existe. Además, el identificador del
   * profesional dejaría de ser un dato interno de la consulta para viajar entre
   * dos operaciones.
   *
   * `patientId` SÍ llega como parámetro, y eso es correcto: identifica el
   * recurso solicitado. `professionalId` NUNCA llega del cliente ni se acepta
   * como argumento: se deriva del principal dentro de esta misma consulta.
   *
   * FAIL-CLOSED: si `withTenant` no puede confirmar el rol runtime ni el tenant
   * activo, lanza `RuntimeContextUnavailableError` y esta función NO devuelve
   * `false` ni `true`: propaga el error. Traducir un fallo de contexto a un
   * `false` silencioso escondería que Row Level Security no estaba aplicada.
   *
   * NO es una autorización clínica: una asignación de cuidado es un vínculo
   * OPERATIVO de agenda. No concede acceso a historia clínica, no acredita
   * necesidad individual de conocer y no habilita ninguna decisión asistencial.
   */
  public async hasActiveAssignmentOverPatient(
    principal: HumanPrincipal,
    patientId: string,
    now: Date,
  ): Promise<boolean> {
    const hoy = toUtcDate(now);

    const assignment = await this.prisma.withTenant(principal.tenantId, async (tx) =>
      tx.careAssignment.findFirst({
        where: {
          // Filtro explícito por tenant ADEMÁS de Row Level Security.
          tenantId: principal.tenantId,
          patientId,
          status: 'ACTIVE',
          // Vigencia de la asignación: ya iniciada y aún no terminada.
          // `gt` y no `gte`: una asignación que termina EXACTAMENTE en el
          // instante evaluado ya no autoriza. El borde se cierra, no se abre.
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          professional: {
            // El tenant se repite en el lado profesional: la FK compuesta ya lo
            // impide, pero la consulta no debe depender solo de esa garantía.
            tenantId: principal.tenantId,
            // Origen ÚNICO del profesional: la persona autenticada.
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
        },
        select: { id: true },
      }),
    );

    return assignment !== null;
  }
}

/**
 * Fecha sin componente horario, en UTC.
 *
 * Las columnas de vigencia del vínculo son de tipo `DATE`. Compararlas contra un
 * instante con hora arrastraría el desplazamiento de zona del servidor y haría
 * que un vínculo pareciera vigente —o no— según dónde esté desplegada la API.
 */
function toUtcDate(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
