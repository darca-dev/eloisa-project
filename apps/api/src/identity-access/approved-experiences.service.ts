import { Inject, Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

import { type HumanPrincipal } from './human-principal';
import { IdentityAccessService } from './identity-access.service';

/**
 * Experiencias APROBADAS de la cuenta autenticada (SPEC 038, MP04).
 *
 * QUÉ ES: el conjunto exacto de experiencias que una cuenta humana puede abrir
 * —`PATIENT`, `CAREGIVER` y `FIELD_PROFESSIONAL`— derivado SIEMPRE en el
 * servidor a partir de tres condiciones acumulativas:
 *
 * 1. la cuenta está `ACTIVE`;
 * 2. existe una `AccessRequest` de ESA cuenta con `status = APPROVED` y con el
 *    perfil correspondiente;
 * 3. para `PATIENT` existe Patient activo. CAREGIVER y FIELD_PROFESSIONAL
 *    abren su portal neutro sin inventar relaciones, profesiones o contratos.
 *    La aprobación del portal no concede acceso a recursos clínicos.
 *
 * POR QUÉ EXISTE SEPARADO DE `HumanContextsService`: son dos preguntas
 * distintas. `contexts` responde «¿qué participaciones tiene vivas esta
 * persona?», y por eso un cuidador sin relación NO obtiene contexto `CAREGIVER`
 * y un profesional sin asignación puede tener perfil sin ver nada. `experiences`
 * responde «¿qué espacios aprobó la institución para ESTA cuenta?», y por eso
 * una persona cuya solicitud sigue `PENDING`, `REJECTED` o `REVOKED` no obtiene
 * experiencia aunque su `Person` tenga participaciones de otra procedencia.
 * Fundirlas haría que aprobar una solicitud abriera recursos que nadie revisó,
 * o que una inscripción antigua cerrara la puerta a una cuenta aprobada.
 *
 * LO QUE NO CONCEDE: una experiencia no es un permiso. Que figure aquí no
 * autoriza a ver un paciente, una visita ni una liquidación concretos: cada
 * operación posterior vuelve a evaluar autenticación, participación, afiliación,
 * asignación, relación y tenant. La lista solo decide A QUÉ portada se puede
 * entrar, nunca QUÉ se puede hacer dentro.
 *
 * AUDITORÍA: cada consulta escribe `EXPERIENCE_ACCESS_GRANTED` o
 * `EXPERIENCE_ACCESS_DENIED`, con la cuenta como actor y la propia cuenta como
 * recurso. El evento NO copia cuáles experiencias había ni cuáles faltaban: el
 * listado es el resultado de la consulta y duplicarlo en la traza crearía un
 * segundo sitio donde pudiera desincronizarse. El desenlace —concedido o
 * denegado— se escribe en la MISMA transacción que la lectura, de modo que una
 * auditoría que no se pueda registrar no deja una consulta silenciosa.
 */

/**
 * Experiencias aprobadas, en el orden CERRADO en que se devuelven.
 *
 * El orden es parte del contrato: es el que la interfaz usa para decidir a qué
 * portada redirige cuando hay UNA sola experiencia, y por eso está escrito como
 * lista literal y no derivado de la base.
 */
export const APPROVED_EXPERIENCE_ORDER = [
  'PATIENT',
  'CAREGIVER',
  'FIELD_PROFESSIONAL',
  'HOSPITAL',
  'MUNICIPALITY',
] as const;
const REQUESTABLE_PROFILES = ['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL'] as const;

export type ApprovedExperience = (typeof APPROVED_EXPERIENCE_ORDER)[number];

@Injectable()
export class ApprovedExperiencesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityAccessService) private readonly identity: IdentityAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * Resuelve y audita las experiencias aprobadas de la cuenta de la sesión.
   *
   * @param principal Principal resuelto POR EL GUARD a partir de la cookie. Nunca
   *                  llega del cuerpo ni de la ruta.
   * @param now       Instante del servidor para la auditoría.
   * @param correlationId Correlación opaca de la petición, para el evento de auditoría.
   */
  public async resolve(
    principal: HumanPrincipal,
    now: Date,
    correlationId: string,
  ): Promise<readonly ApprovedExperience[]> {
    /*
     * La participación del paciente se resuelve FUERA de la transacción de auditoría:
     * `IdentityAccessService` abre su propia transacción tenant-scoped y anidar
     * `$transaction` dentro de otra sería una segunda conexión con su propio
     * rol y su propio `set_config`. La consulta de participación no escribe.
     */
    const patientVivo = await this.identity.resolvePatient(principal);

    return this.prisma.withTenant(principal.tenantId, async (tx) => {
      const cuentaActiva = await tx.humanAccount.findFirst({
        where: {
          id: principal.humanAccountId,
          tenantId: principal.tenantId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      /*
       * La cuenta se consulta ANTES que las solicitudes y no se recorren estas
       * últimas si la cuenta no está activa: una cuenta deshabilitada no tiene
       * experiencias, aunque sus solicitudes sigan diciendo `APPROVED`. Es la
       * misma regla que aplica el resto de la plataforma —suspendida o
       * revocada, fuera—, repetida aquí porque esta es la superficie que decide
       * a qué portada se entra.
       */
      const perfiles =
        cuentaActiva === null
          ? []
          : await tx.accessRequest.findMany({
              where: {
                tenantId: principal.tenantId,
                humanAccountId: principal.humanAccountId,
                status: 'APPROVED',
                requestedProfile: { in: [...REQUESTABLE_PROFILES] },
              },
              select: { requestedProfile: true },
              distinct: ['requestedProfile'],
            });

      const aprobados = new Set(perfiles.map((fila) => fila.requestedProfile));

      const experiences: ApprovedExperience[] = [];

      if (aprobados.has('PATIENT') && patientVivo !== null) {
        experiences.push('PATIENT');
      }

      if (aprobados.has('CAREGIVER')) {
        experiences.push('CAREGIVER');
      }

      if (aprobados.has('FIELD_PROFESSIONAL')) {
        experiences.push('FIELD_PROFESSIONAL');
      }

      if (cuentaActiva !== null && principal.externalAuthIdentityId !== undefined) {
        const registrations = await tx.institutionalAdministratorRegistration.findMany({ where: {
          tenantId: principal.tenantId, humanAccountId: principal.humanAccountId, status: 'CONFIRMED',
          externalAuthIdentityId: principal.externalAuthIdentityId,
          externalIdentity: { tenantId: principal.tenantId, humanAccountId: principal.humanAccountId, status: 'ACTIVE' },
        }, select: { experience: true } });
        for (const experience of ['HOSPITAL', 'MUNICIPALITY'] as const) {
          if (registrations.some(registration => registration.experience === experience)) experiences.push(experience);
        }
      }

      await this.audit.recordExperienceAccessWithin(
        tx,
        {
          tenantId: principal.tenantId,
          humanAccountId: principal.humanAccountId,
          granted: experiences.length > 0,
          correlationId,
        },
        now,
      );

      return experiences;
    });
  }
}
