import { BadRequestException } from '@nestjs/common';

import { validateAccessRequestBody, type ValidatedAccessRequest } from '../access-requests/access-request.validation';
import { type InstitutionalRoleCode } from './institutional-auth.contract';

export const INSTITUTIONAL_EXPERIENCES = ['HOSPITAL', 'MUNICIPALITY'] as const;
export type InstitutionalExperienceCode = (typeof INSTITUTIONAL_EXPERIENCES)[number];
export const ADMINISTRATOR_CAPABILITIES: Readonly<Record<InstitutionalExperienceCode, readonly InstitutionalRoleCode[]>> = {
  HOSPITAL: ['HOSPITAL_PATIENT_VIEWER', 'HOSPITAL_SCHEDULER', 'CAREGIVER_RELATIONSHIP_MANAGER', 'HOSPITAL_ACCESS_REVIEWER'],
  MUNICIPALITY: ['MUNICIPAL_VIEWER'],
};
export const administratorAttemptCookieName = (experience: InstitutionalExperienceCode): string =>
  `merdn_administrator_attempt_${experience.toLowerCase()}`;
export function institutionalExperience(value: string): InstitutionalExperienceCode {
  if (value === 'hospital') return 'HOSPITAL';
  if (value === 'municipality') return 'MUNICIPALITY';
  throw new BadRequestException({ code: 'INSTITUTIONAL_REGISTRATION_INVALID', message: 'La experiencia solicitada no es válida.' });
}
export function experienceForRole(role: InstitutionalRoleCode): InstitutionalExperienceCode {
  return role === 'MUNICIPAL_VIEWER' ? 'MUNICIPALITY' : 'HOSPITAL';
}

const FIELDS = ['documentType', 'documentNumber', 'givenNames', 'familyNames', 'birthDate', 'sexGenderCode', 'email', 'password', 'confirmPassword'] as const;
export function validateAdministratorBody(body: unknown, now: Date): ValidatedAccessRequest {
  const invalid = (): never => { throw new BadRequestException({ code: 'INSTITUTIONAL_REGISTRATION_INVALID', message: 'Revise los datos del formulario y la confirmación de contraseña.' }); };
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return invalid();
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !(FIELDS as readonly string[]).includes(key)) ||
      FIELDS.some(key => typeof input[key] !== 'string') ||
      input.password !== input.confirmPassword || typeof input.email !== 'string' || input.email.trim() === '') return invalid();
  // Reuse identity normalization, not the access-request profile or its persistence.
  const { confirmPassword: _confirmation, ...personInput } = input;
  void _confirmation;
  const result = validateAccessRequestBody({ ...personInput, requestedProfile: 'CAREGIVER' }, now);
  if (!result.ok) return invalid();
  return result.value;
}
