import { Inject, Injectable } from '@nestjs/common';

import { CaregiverRelationshipPolicy } from '../people-relationships/caregiver-relationship.policy';

import { type HumanPrincipal } from './human-principal';
import { IdentityAccessService } from './identity-access.service';

/**
 * Contextos DISPONIBLES de la persona autenticada
 * (IDENTITY-RELATIONSHIPS-CORE-01 §8.1).
 *
 * Deriva server-side qué participaciones tiene vivas una persona: paciente,
 * profesional y cuidadora. Cada una se evalúa por separado y contra la base, sin
 * aceptar nada del cliente.
 *
 * QUÉ SIGNIFICA UN CONTEXTO DISPONIBLE, y qué NO significa:
 *
 * - significa que la persona TIENE esa participación viva ahora mismo;
 * - NO concede acceso a ningún recurso concreto. `PROFESSIONAL` no dice sobre
 *   qué pacientes, y `CAREGIVER` no dice sobre cuál. Esas preguntas las responde
 *   la política correspondiente, por recurso y en cada operación.
 *
 * SIN SUMA IMPLÍCITA: una persona con varias participaciones NO acumula los
 * permisos de todas sobre un mismo recurso. Ser profesional no permite ver como
 * cuidadora, ni al revés: cada capacidad conserva su propia comprobación, su
 * propio alcance y su propia vigencia.
 */

/** Contextos derivados. El orden es estable para que la respuesta lo sea. */
export interface AvailableContexts {
  readonly patient: boolean;
  readonly professional: boolean;
  readonly caregiver: boolean;
}

@Injectable()
export class HumanContextsService {
  constructor(
    @Inject(IdentityAccessService) private readonly identity: IdentityAccessService,
    @Inject(CaregiverRelationshipPolicy)
    private readonly caregiver: CaregiverRelationshipPolicy,
  ) {}

  /** Resuelve los tres contextos. Se reevalúan en cada llamada. */
  public async resolve(
    principal: HumanPrincipal,
    now: Date,
  ): Promise<AvailableContexts> {
    const [patient, professional, caregiver] = await Promise.all([
      this.identity.resolvePatient(principal),
      this.identity.resolveProfessional(principal, now),
      this.caregiver.hasAnyActiveCaregiverRelationship(principal, now),
    ]);

    return {
      patient: patient !== null,
      professional: professional !== null,
      caregiver,
    };
  }

  /**
   * Contextos en la forma que devuelve la API.
   *
   * Se devuelven los NOMBRES de los contextos y NUNCA los identificadores que
   * los sostienen: `patientId` y `professionalId` se quedan en el servidor, de
   * modo que la interfaz no pueda usarlos como autoridad en una petición
   * posterior.
   */
  public async resolveNames(
    principal: HumanPrincipal,
    now: Date,
  ): Promise<('PATIENT' | 'PROFESSIONAL' | 'CAREGIVER')[]> {
    const contexts = await this.resolve(principal, now);
    const names: ('PATIENT' | 'PROFESSIONAL' | 'CAREGIVER')[] = [];

    if (contexts.patient) {
      names.push('PATIENT');
    }

    if (contexts.professional) {
      names.push('PROFESSIONAL');
    }

    if (contexts.caregiver) {
      names.push('CAREGIVER');
    }

    return names;
  }
}
