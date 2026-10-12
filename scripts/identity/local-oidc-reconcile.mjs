import { randomUUID } from 'node:crypto';

const OLD_ISSUER = 'http://host.docker.internal:8081/realms/merdn-local';
const NEW_ISSUER = 'http://merdn.localhost:8081/realms/merdn-local';

/** Caller must verify each subject in the same local realm and back up first. */
export async function reconcileLocalIssuer({ client, tenantId, bindings, verifySubject }) {
  if (!Array.isArray(bindings) || typeof verifySubject !== 'function') throw new Error('Verified reconciliation plan required');
  for (const binding of bindings) {
    if (binding.tenantId !== tenantId || binding.issuer !== OLD_ISSUER || !(await verifySubject(binding.subject))) throw new Error('Identity reconciliation precondition failed');
  }
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE merdn_runtime');
    await client.query("SELECT set_config('merdn.tenant_id', $1, true)", [tenantId]);
    let changed = 0, revoked = 0;
    const correlation = randomUUID();
    for (const binding of bindings) {
      const locked = await client.query('SELECT a.id FROM human_account a JOIN external_auth_identity e ON e."humanAccountId"=a.id AND e."tenantId"=a."tenantId" WHERE e.id=$1::uuid AND a."tenantId"=$2::uuid FOR UPDATE OF a,e', [binding.id, tenantId]);
      if (locked.rowCount !== 1 || locked.rows[0].id !== binding.humanAccountId) throw new Error('Identity reconciliation account changed');
      const already = await client.query('SELECT issuer,subject,status FROM external_auth_identity WHERE id=$1::uuid AND "tenantId"=$2::uuid', [binding.id, tenantId]);
      if (already.rows[0].issuer === NEW_ISSUER && already.rows[0].subject === binding.subject && already.rows[0].status === binding.status) continue;
      const updated = await client.query('UPDATE external_auth_identity SET issuer=$1,"updatedAt"=now() WHERE id=$2::uuid AND "tenantId"=$3::uuid AND "humanAccountId"=$4::uuid AND issuer=$5 AND subject=$6 AND status::text=$7 RETURNING id', [NEW_ISSUER, binding.id, tenantId, binding.humanAccountId, OLD_ISSUER, binding.subject, binding.status]);
      if (updated.rowCount !== 1) throw new Error('Identity reconciliation plan is stale or conflicts');
      const sessions = await client.query('UPDATE human_session SET "revokedAt"=now() WHERE "humanAccountId"=$1::uuid AND "tenantId"=$2::uuid AND "revokedAt" IS NULL RETURNING id', [binding.humanAccountId, tenantId]);
      const audit = async (event, resource, id) => client.query('INSERT INTO audit_event (id,"tenantId","eventType","actorType","resourceType","resourceId",outcome,endpoint,"correlationId","occurredAt") VALUES ($1::uuid,$2::uuid,$3::"AuditEventType",\'SYSTEM\',$4,$5::uuid,\'SUCCESS\',\'cli local-oidc-issuer-reconciliation\',$6,now())', [randomUUID(), tenantId, event, resource, id, correlation]);
      await audit('HUMAN_IDENTITY_LINKED', 'ExternalAuthIdentity', binding.id);
      for (const session of sessions.rows) await audit('HUMAN_SESSION_REVOKED', 'HumanSession', session.id);
      changed++; revoked += sessions.rowCount;
    }
    await client.query('COMMIT');
    return { changed, revoked };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
