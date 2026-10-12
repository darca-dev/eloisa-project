import { type InstitutionalRoleCode } from './institutional-auth.contract';

/** Authority fields come only from the validated server principal. */
export function institutionalAuditActor(input: {
  readonly identityId: string | null;
  readonly role: InstitutionalRoleCode | null;
  readonly humanAccountId?: string | undefined;
}) {
  if (input.humanAccountId !== undefined) return { actorType: 'HUMAN_ACCOUNT' as const, actorUserId: input.humanAccountId, actorRole: null };
  return { actorType: input.identityId === null ? 'UNAUTHENTICATED' as const : 'INSTITUTIONAL_IDENTITY' as const, actorUserId: input.identityId, actorRole: input.identityId === null ? null : input.role };
}
