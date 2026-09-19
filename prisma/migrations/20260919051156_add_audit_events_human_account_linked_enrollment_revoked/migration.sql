-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'HUMAN_ACCOUNT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'ENROLLMENT_SESSION_REVOKED';

-- DropForeignKey
ALTER TABLE "patient_address" DROP CONSTRAINT "patient_address_local_unit_tenant_fkey";

-- DropIndex
DROP INDEX "territorial_unit_id_tenant_unique";

-- RenameForeignKey
ALTER TABLE "appointment" RENAME CONSTRAINT "appointment_care_assignment_fkey" TO "appointment_careAssignmentId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "appointment" RENAME CONSTRAINT "appointment_patient_fkey" TO "appointment_patientId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "audit_event" RENAME CONSTRAINT "audit_event_actor_home_tenant_fkey" TO "audit_event_actorHomeTenantId_fkey";

-- RenameForeignKey
ALTER TABLE "audit_event" RENAME CONSTRAINT "audit_event_support_context_session_fkey" TO "audit_event_supportContextSessionId_fkey";

-- RenameForeignKey
ALTER TABLE "audit_event" RENAME CONSTRAINT "audit_event_support_grant_fkey" TO "audit_event_supportGrantId_fkey";

-- RenameForeignKey
ALTER TABLE "care_assignment" RENAME CONSTRAINT "care_assignment_created_by_identity_fkey" TO "care_assignment_createdByIdentityId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "care_assignment" RENAME CONSTRAINT "care_assignment_patient_fkey" TO "care_assignment_patientId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "care_assignment" RENAME CONSTRAINT "care_assignment_professional_fkey" TO "care_assignment_professionalId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "external_auth_identity" RENAME CONSTRAINT "external_auth_identity_account_fkey" TO "external_auth_identity_humanAccountId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "home_visit" RENAME CONSTRAINT "home_visit_appointment_fkey" TO "home_visit_appointmentId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "home_visit" RENAME CONSTRAINT "home_visit_care_assignment_fkey" TO "home_visit_careAssignmentId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "home_visit" RENAME CONSTRAINT "home_visit_created_by_identity_fkey" TO "home_visit_createdByInstitutionalIdentityId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "home_visit" RENAME CONSTRAINT "home_visit_patient_fkey" TO "home_visit_patientId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "home_visit_transition" RENAME CONSTRAINT "home_visit_transition_performed_by_fkey" TO "home_visit_transition_performedByHumanAccountId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "home_visit_transition" RENAME CONSTRAINT "home_visit_transition_visit_fkey" TO "home_visit_transition_homeVisitId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "human_account" RENAME CONSTRAINT "human_account_person_fkey" TO "human_account_personId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "human_session" RENAME CONSTRAINT "human_session_account_fkey" TO "human_session_humanAccountId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "institutional_session" RENAME CONSTRAINT "institutional_session_identity_fkey" TO "institutional_session_identityId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "patient_caregiver_relationship" RENAME CONSTRAINT "patient_caregiver_relationship_caregiver_person_fkey" TO "patient_caregiver_relationship_caregiverPersonId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "patient_caregiver_relationship" RENAME CONSTRAINT "patient_caregiver_relationship_patient_fkey" TO "patient_caregiver_relationship_patientId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "patient_caregiver_relationship" RENAME CONSTRAINT "patient_caregiver_relationship_revoked_by_fkey" TO "patient_caregiver_relationship_revokedByInstitutionalIdent_fkey";

-- RenameForeignKey
ALTER TABLE "patient_caregiver_relationship" RENAME CONSTRAINT "patient_caregiver_relationship_validated_by_fkey" TO "patient_caregiver_relationship_validatedByInstitutionalIde_fkey";

-- RenameForeignKey
ALTER TABLE "patient_caregiver_relationship_scope" RENAME CONSTRAINT "patient_caregiver_relationship_scope_relationship_fkey" TO "patient_caregiver_relationship_scope_relationshipId_tenant_fkey";

-- RenameForeignKey
ALTER TABLE "platform_support_capability" RENAME CONSTRAINT "platform_support_capability_account_fkey" TO "platform_support_capability_humanAccountId_homeTenantId_fkey";

-- RenameForeignKey
ALTER TABLE "platform_support_capability" RENAME CONSTRAINT "platform_support_capability_home_tenant_fkey" TO "platform_support_capability_homeTenantId_fkey";

-- RenameForeignKey
ALTER TABLE "professional_affiliation" RENAME CONSTRAINT "professional_affiliation_professional_fkey" TO "professional_affiliation_professionalId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "professional_profile" RENAME CONSTRAINT "professional_profile_person_fkey" TO "professional_profile_personId_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "support_context_session" RENAME CONSTRAINT "support_context_session_account_fkey" TO "support_context_session_humanAccountId_homeTenantId_fkey";

-- RenameForeignKey
ALTER TABLE "support_context_session" RENAME CONSTRAINT "support_context_session_grant_fkey" TO "support_context_session_supportGrantId_homeTenantId_target_fkey";

-- RenameForeignKey
ALTER TABLE "support_context_session" RENAME CONSTRAINT "support_context_session_home_tenant_fkey" TO "support_context_session_homeTenantId_fkey";

-- RenameForeignKey
ALTER TABLE "support_context_session" RENAME CONSTRAINT "support_context_session_human_session_fkey" TO "support_context_session_humanSessionId_humanAccountId_home_fkey";

-- RenameForeignKey
ALTER TABLE "support_grant" RENAME CONSTRAINT "support_grant_capability_fkey" TO "support_grant_platformSupportCapabilityId_homeTenantId_fkey";

-- RenameForeignKey
ALTER TABLE "support_grant" RENAME CONSTRAINT "support_grant_home_tenant_fkey" TO "support_grant_homeTenantId_fkey";

-- RenameForeignKey
ALTER TABLE "support_grant" RENAME CONSTRAINT "support_grant_target_tenant_fkey" TO "support_grant_targetTenantId_fkey";

-- RenameIndex
ALTER INDEX "appointment_tenant_scheduled_start_idx" RENAME TO "appointment_tenantId_scheduledStart_idx";

-- RenameIndex
ALTER INDEX "appointment_tenant_status_requested_idx" RENAME TO "appointment_tenantId_status_requestedAt_idx";

-- RenameIndex
ALTER INDEX "care_assignment_tenant_patient_status_idx" RENAME TO "care_assignment_tenantId_patientId_status_idx";

-- RenameIndex
ALTER INDEX "care_assignment_tenant_professional_status_idx" RENAME TO "care_assignment_tenantId_professionalId_status_idx";

-- RenameIndex
ALTER INDEX "external_auth_identity_tenant_account_status_idx" RENAME TO "external_auth_identity_tenantId_humanAccountId_status_idx";

-- RenameIndex
ALTER INDEX "home_visit_tenant_care_assignment_idx" RENAME TO "home_visit_tenantId_careAssignmentId_idx";

-- RenameIndex
ALTER INDEX "home_visit_tenant_patient_idx" RENAME TO "home_visit_tenantId_patientId_idx";

-- RenameIndex
ALTER INDEX "home_visit_tenant_status_idx" RENAME TO "home_visit_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "home_visit_transition_tenant_visit_occurred_idx" RENAME TO "home_visit_transition_tenantId_homeVisitId_occurredAt_idx";

-- RenameIndex
ALTER INDEX "human_account_tenant_person_status_idx" RENAME TO "human_account_tenantId_personId_status_idx";

-- RenameIndex
ALTER INDEX "human_auth_attempt_tenant_expires_idx" RENAME TO "human_auth_attempt_tenantId_expiresAt_idx";

-- RenameIndex
ALTER INDEX "human_session_expires_at_idx" RENAME TO "human_session_expiresAt_idx";

-- RenameIndex
ALTER INDEX "human_session_tenant_account_idx" RENAME TO "human_session_tenantId_humanAccountId_idx";

-- RenameIndex
ALTER INDEX "patient_caregiver_relationship_tenant_caregiver_status_idx" RENAME TO "patient_caregiver_relationship_tenantId_caregiverPersonId_s_idx";

-- RenameIndex
ALTER INDEX "patient_caregiver_relationship_tenant_patient_status_idx" RENAME TO "patient_caregiver_relationship_tenantId_patientId_status_idx";

-- RenameIndex
ALTER INDEX "patient_caregiver_relationship_tenant_validity_idx" RENAME TO "patient_caregiver_relationship_tenantId_status_startsAt_end_idx";

-- RenameIndex
ALTER INDEX "patient_caregiver_relationship_scope_tenant_rel_idx" RENAME TO "patient_caregiver_relationship_scope_tenantId_relationshipI_idx";

-- RenameIndex
ALTER INDEX "platform_support_capability_home_tenant_status_idx" RENAME TO "platform_support_capability_homeTenantId_status_idx";

-- RenameIndex
ALTER INDEX "professional_affiliation_tenant_professional_status_idx" RENAME TO "professional_affiliation_tenantId_professionalId_status_idx";

-- RenameIndex
ALTER INDEX "support_context_session_expires_idx" RENAME TO "support_context_session_expiresAt_idx";

-- RenameIndex
ALTER INDEX "support_context_session_home_grant_idx" RENAME TO "support_context_session_homeTenantId_supportGrantId_idx";

-- RenameIndex
ALTER INDEX "support_context_session_home_token_idx" RENAME TO "support_context_session_homeTenantId_tokenHash_idx";

-- RenameIndex
ALTER INDEX "support_grant_home_capability_status_idx" RENAME TO "support_grant_homeTenantId_platformSupportCapabilityId_stat_idx";

-- RenameIndex
ALTER INDEX "support_grant_home_target_status_idx" RENAME TO "support_grant_homeTenantId_targetTenantId_status_idx";
