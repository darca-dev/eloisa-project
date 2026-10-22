import { asObject, CareValidationError, onlyFields } from '../care-context/care-request';
import { normalizeDocumentNumber } from '../patients/document-normalization';
import { DOCUMENT_TYPE_CODES } from '../patients/enrollment.contract';

import {
  type AdminActorKind,
  type AdminPermission,
  type CompetenceInput,
  type CreateContextInput,
  type DocumentTypeCode,
  type GrantInput,
  type PersonReference,
} from './care-admin.contract';

/**
 * Lectura estricta de la administración de permisos (SPEC 055 / MP05b). El
 * documento se normaliza con la MISMA regla que la inscripción, de modo que la
 * búsqueda sea exacta. Las referencias de autorización son códigos opacos en
 * mayúsculas, no texto libre ni datos personales.
 */

const REFERENCE_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{2,99}$/u;
const ACTOR_KINDS: readonly AdminActorKind[] = ['CAREGIVER', 'PROFESSIONAL', 'HOSPITAL_REVIEWER'];
const PERMISSIONS: readonly AdminPermission[] = ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS', 'REQUEST_ALARM', 'MANAGE_RULES', 'REVIEW_ALARMS'];

function reference(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!REFERENCE_PATTERN.test(upper)) {
    throw new CareValidationError(field, 'Escriba la referencia del soporte (letras, números, punto, guion; 3 a 100).');
  }
  return upper;
}

function person(raw: unknown, field: string): PersonReference {
  const body = asObject(raw);
  onlyFields(body, ['documentType', 'documentNumber']);
  const type = body['documentType'];
  const number = body['documentNumber'];
  if (typeof type !== 'string' || !(DOCUMENT_TYPE_CODES as readonly string[]).includes(type) || typeof number !== 'string') {
    throw new CareValidationError(field, 'Indique el tipo y número de documento.');
  }
  const normalized = normalizeDocumentNumber(type as DocumentTypeCode, number);
  if (!normalized.ok) {
    throw new CareValidationError(field, 'El número de documento no es válido.');
  }
  return { documentType: type as DocumentTypeCode, documentNumber: normalized.normalized };
}

function futureInstant(body: Record<string, unknown>, field: string, now: Date): Date | null {
  const raw = body[field];
  if (raw === undefined || raw === null || raw === '') return null;
  const parsed = typeof raw === 'string' && /T.*(Z|[+-]\d{2}:\d{2})$/u.test(raw) ? new Date(raw) : null;
  if (parsed === null || Number.isNaN(parsed.getTime()) || parsed.getTime() <= now.getTime()) {
    throw new CareValidationError(field, 'La fecha de fin debe ser futura.');
  }
  return parsed;
}

export function parseCreateContextInput(body: unknown): CreateContextInput {
  const input = asObject(body);
  onlyFields(input, ['patient', 'authorizationReference']);
  return { patient: person(input['patient'], 'patient'), authorizationReference: reference(input, 'authorizationReference') };
}

export function parseGrantInput(body: unknown, now: Date): GrantInput {
  const input = asObject(body);
  onlyFields(input, ['actorKind', 'permission', 'person', 'authorizationReference', 'endsAt']);
  const actorKind = input['actorKind'];
  const permission = input['permission'];
  if (typeof actorKind !== 'string' || !ACTOR_KINDS.includes(actorKind as AdminActorKind)) {
    throw new CareValidationError('actorKind', 'Elija el tipo de participante.');
  }
  if (typeof permission !== 'string' || !PERMISSIONS.includes(permission as AdminPermission)) {
    throw new CareValidationError('permission', 'Elija el permiso.');
  }
  return {
    actorKind: actorKind as AdminActorKind,
    permission: permission as AdminPermission,
    person: person(input['person'], 'person'),
    authorizationReference: reference(input, 'authorizationReference'),
    endsAt: futureInstant(input, 'endsAt', now),
  };
}

export function parseCompetenceInput(body: unknown, now: Date): CompetenceInput {
  const input = asObject(body);
  onlyFields(input, ['person', 'evidenceReference', 'endsAt']);
  return {
    person: person(input['person'], 'person'),
    evidenceReference: reference(input, 'evidenceReference'),
    endsAt: futureInstant(input, 'endsAt', now),
  };
}
