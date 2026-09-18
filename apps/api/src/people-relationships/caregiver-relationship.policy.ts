import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { type HumanPrincipal } from '../identity-access/human-principal';

import {
  CAREGIVER_RELATIONSHIP_PURPOSE,
  CAREGIVER_RELATIONSHIP_TYPE,
  CAREGIVER_SCOPE_VISITS_VIEW,
} from './caregiver-relationship.contract';

/**
 * Política de autorización de la persona CUIDADORA
 * (IDENTITY-RELATIONSHIPS-CORE-01 §7.2).
 *
 * Responde a UNA sola pregunta: ¿puede esta persona autenticada VER las visitas
 * de este paciente concreto, ahora?
 *
 * Exige TODAS estas condiciones a la vez, y ninguna es prescindible:
 *
 *   1. la relación pertenece al MISMO tenant que el principal;
 *   2. su `caregiverPersonId` es la persona del principal —nunca un
 *      identificador enviado por el cliente—;
 *   3. su estado almacenado es `ACTIVE`;
 *   4. su vigencia incluye el instante evaluado: `startsAt <= now` y
 *      (`endsAt` nulo o `endsAt > now`);
 *   5. su tipo y su finalidad son EXACTAMENTE los del catálogo cerrado;
 *   6. entre sus alcances está `VISITS_VIEW`.
 *
 * LA VIGENCIA MANDA SOBRE EL ESTADO. Una fila que todavía diga `ACTIVE` pero
 * cuyo `endsAt` ya pasó NO autoriza: la caducidad no depende de que ningún
 * proceso haya pasado a marcarla. Esta Task no añade worker ni job, y por eso la
 * comprobación de vigencia es parte de la consulta y no una tarea diferida.
 *
 * LO QUE ESTA POLÍTICA NO CONCEDE, en ningún caso: ejecutar o registrar
 * visitas, contribuir contenido, acceder a información clínica, exportar datos
 * ni operar sobre ningún otro paciente. `VISITS_VIEW` es de SOLO LECTURA y no
 * existe ningún otro alcance para una persona cuidadora.
 *
 * Se exporta para `VISITS-CORE-01`. Esta Task NO crea endpoints ni modelos de
 * Visitas: aquí solo vive la decisión de autorización.
 */
@Injectable()
export class CaregiverRelationshipPolicy {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * ¿Puede la persona autenticada ver las visitas de `patientId`?
   *
   * `patientId` SÍ llega como parámetro, y eso es correcto: identifica el
   * recurso solicitado. Lo que nunca llega del cliente es la RELACIÓN ni la
   * identidad de la persona cuidadora, que se toman del principal.
   */
  public async canCaregiverViewVisits(
    principal: HumanPrincipal,
    patientId: string,
    now: Date,
  ): Promise<boolean> {
    const relationship = await this.prisma.withTenant(principal.tenantId, async (tx) =>
      tx.patientCaregiverRelationship.findFirst({
        where: {
          // Filtro explícito por tenant ADEMÁS de Row Level Security.
          tenantId: principal.tenantId,
          patientId,
          caregiverPersonId: principal.personId,
          status: 'ACTIVE',
          // Tipo y finalidad EXACTOS: otra finalidad no autoriza esta lectura.
          relationshipType: CAREGIVER_RELATIONSHIP_TYPE,
          purpose: CAREGIVER_RELATIONSHIP_PURPOSE,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          scopes: {
            some: { tenantId: principal.tenantId, scope: CAREGIVER_SCOPE_VISITS_VIEW },
          },
        },
        select: { id: true },
      }),
    );

    return relationship !== null;
  }

  /**
   * ¿Tiene esta persona ALGUNA relación de cuidado vigente?
   *
   * Solo sirve para declarar el contexto `CAREGIVER` como disponible en
   * `GET /api/v1/me/contexts`. Que un contexto esté disponible NO concede
   * acceso a ningún paciente: eso lo decide `canCaregiverViewVisits` para cada
   * paciente concreto y en cada operación.
   */
  public async hasAnyActiveCaregiverRelationship(
    principal: HumanPrincipal,
    now: Date,
  ): Promise<boolean> {
    const relationship = await this.prisma.withTenant(principal.tenantId, async (tx) =>
      tx.patientCaregiverRelationship.findFirst({
        where: {
          tenantId: principal.tenantId,
          caregiverPersonId: principal.personId,
          status: 'ACTIVE',
          relationshipType: CAREGIVER_RELATIONSHIP_TYPE,
          purpose: CAREGIVER_RELATIONSHIP_PURPOSE,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          scopes: {
            some: { tenantId: principal.tenantId, scope: CAREGIVER_SCOPE_VISITS_VIEW },
          },
        },
        select: { id: true },
      }),
    );

    return relationship !== null;
  }
}
