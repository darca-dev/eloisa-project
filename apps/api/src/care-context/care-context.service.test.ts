import { describe, expect, it } from 'vitest';

import { type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { type PrismaService } from '../database/prisma.service';
import { type HumanPrincipal } from '../identity-access/human-principal';

import { type CareContextAuditService } from './care-context-audit.service';
import {
  type AuthorizedCareContext,
  CareContextAccessDeniedError,
  type CareContextPermission,
  CareContextUnavailableError,
} from './care-context.contract';
import { type CareContextDecision, type CareContextPolicy } from './care-context.policy';
import { CareContextService } from './care-context.service';

const PRINCIPAL: HumanPrincipal = {
  sessionId: '00000000-0000-4000-8000-000000000001',
  humanAccountId: '00000000-0000-4000-8000-000000000002',
  personId: '00000000-0000-4000-8000-000000000003',
  tenantId: '00000000-0000-4000-8000-000000000004',
  externalAuthIdentityId: '00000000-0000-4000-8000-000000000005',
};

const ORG = '00000000-0000-4000-8000-0000000000a1';
const CONTEXT = '00000000-0000-4000-8000-0000000000c1';
const NOW = new Date('2026-10-21T12:00:00.000Z');

const AUTHORIZED: AuthorizedCareContext = {
  tenantId: PRINCIPAL.tenantId,
  organizationId: ORG,
  contextId: CONTEXT,
  patientId: '00000000-0000-4000-8000-0000000000d1',
  humanAccountId: PRINCIPAL.humanAccountId,
  actorKind: 'PATIENT',
  permission: 'VIEW_RECORDS',
  careAuthorizationId: null,
  caregiverRelationshipId: null,
  careAssignmentId: null,
  competenceAttestationId: null,
};

interface HarnessOptions {
  readonly decision?: CareContextDecision;
  readonly failAudit?: boolean;
  readonly organizationGuc?: string | null;
  readonly role?: string;
  readonly mode?: 'enforce' | 'disabled';
}

function harness(options: HarnessOptions = {}) {
  const log: string[] = [];
  const gucValues: unknown[] = [];

  const tx = {
    $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      log.push('set_config');
      gucValues.push(...values);
      return 1;
    },
    $queryRaw: async () => [
      {
        rol: options.role ?? 'merdn_runtime',
        tenant: PRINCIPAL.tenantId,
        organization: options.organizationGuc === undefined ? ORG : options.organizationGuc,
      },
    ],
  } as unknown as PrismaTransaction;

  const prisma = {
    withTenant: async <T>(tenantId: string, work: (tx: PrismaTransaction) => Promise<T>): Promise<T> => {
      log.push(`begin:${tenantId}`);
      try {
        const value = await work(tx);
        log.push('commit');
        return value;
      } catch (error) {
        log.push('rollback');
        throw error;
      }
    },
  } as unknown as PrismaService;

  const policy = {
    decideWithin: async () => {
      log.push('policy');
      return options.decision ?? { kind: 'granted', authorized: AUTHORIZED };
    },
  } as unknown as CareContextPolicy;

  const auditCalls: { readonly kind: string; readonly input: Record<string, unknown> }[] = [];
  const record = (kind: string) => async (_tx: PrismaTransaction, input: Record<string, unknown>) => {
    log.push(`audit:${kind}`);
    auditCalls.push({ kind, input });
    if (options.failAudit === true) {
      throw new Error('fallo simulado de auditoría');
    }
  };
  const audit = {
    recordGrantedWithin: record('granted'),
    recordDeniedWithin: record('denied'),
    recordUnresolvedOrganizationDeniedWithin: record('unresolved'),
  } as unknown as CareContextAuditService;

  const environment = { runtimeRoleMode: options.mode ?? 'enforce' } as ApiEnvironmentProvider;
  const service = new CareContextService(prisma, environment, policy, audit);

  return { service, log, auditCalls, gucValues };
}

function run(
  service: CareContextService,
  log: string[],
  overrides: { resource?: { organizationId: string; contextId: string }; principal?: HumanPrincipal; permission?: string } = {},
) {
  return service.withAuthorizedContext(
    overrides.principal ?? PRINCIPAL,
    overrides.resource ?? { organizationId: ORG, contextId: CONTEXT },
    (overrides.permission ?? 'VIEW_RECORDS') as CareContextPermission,
    'corr-0001',
    NOW,
    async (_tx, authorized) => {
      log.push('work');
      return authorized;
    },
  );
}

describe('CareContextService.withAuthorizedContext', () => {
  it('concede: fija la organización, decide, audita ANTES del trabajo y confirma una sola vez', async () => {
    const { service, log, auditCalls, gucValues } = harness();

    await expect(run(service, log)).resolves.toEqual(AUTHORIZED);
    expect(log).toEqual([`begin:${PRINCIPAL.tenantId}`, 'set_config', 'policy', 'audit:granted', 'work', 'commit']);
    expect(gucValues).toEqual([ORG]);
    expect(auditCalls[0]?.input).toEqual({
      tenantId: PRINCIPAL.tenantId,
      organizationId: ORG,
      contextId: CONTEXT,
      humanAccountId: PRINCIPAL.humanAccountId,
      correlationId: 'corr-0001',
    });
  });

  it('deniega: persiste el evento con organización resuelta, confirma y SOLO DESPUÉS lanza; work no se invoca', async () => {
    const { service, log, auditCalls } = harness({ decision: { kind: 'denied', organizationId: ORG } });

    await expect(run(service, log)).rejects.toBeInstanceOf(CareContextAccessDeniedError);
    expect(log).toEqual([`begin:${PRINCIPAL.tenantId}`, 'set_config', 'policy', 'audit:denied', 'commit']);
    expect(auditCalls[0]?.input).toEqual({
      tenantId: PRINCIPAL.tenantId,
      organizationId: ORG,
      humanAccountId: PRINCIPAL.humanAccountId,
      correlationId: 'corr-0001',
    });
  });

  it('deniega sin organización resuelta con el evento genérico y sin revelar nada', async () => {
    const { service, log } = harness({ decision: { kind: 'denied', organizationId: null } });

    await expect(run(service, log)).rejects.toBeInstanceOf(CareContextAccessDeniedError);
    expect(log).toEqual([`begin:${PRINCIPAL.tenantId}`, 'set_config', 'policy', 'audit:unresolved', 'commit']);
  });

  it('un UUID de recurso mal formado deniega sin fijar GUC ni consultar la política', async () => {
    const { service, log } = harness();

    await expect(
      run(service, log, { resource: { organizationId: 'no-es-uuid', contextId: CONTEXT } }),
    ).rejects.toBeInstanceOf(CareContextAccessDeniedError);
    expect(log).toEqual([`begin:${PRINCIPAL.tenantId}`, 'audit:unresolved', 'commit']);
  });

  it('normaliza a minúsculas un UUID válido antes de fijarlo', async () => {
    const { service, log, gucValues } = harness();

    await run(service, log, { resource: { organizationId: ORG.toUpperCase(), contextId: CONTEXT.toUpperCase() } });
    expect(gucValues).toEqual([ORG]);
  });

  it('si la auditoría falla no hay trabajo ni commit y el error es indisponibilidad, no permiso', async () => {
    const { service, log } = harness({ failAudit: true });

    await expect(run(service, log)).rejects.toBeInstanceOf(CareContextUnavailableError);
    expect(log).not.toContain('work');
    expect(log).not.toContain('commit');
    expect(log.at(-1)).toBe('rollback');
  });

  it('si la auditoría de denegación falla no se presenta como denegación confirmada', async () => {
    const { service, log } = harness({ decision: { kind: 'denied', organizationId: ORG }, failAudit: true });

    await expect(run(service, log)).rejects.toBeInstanceOf(CareContextUnavailableError);
    expect(log.at(-1)).toBe('rollback');
  });

  it('un fallo del trabajo se propaga tal cual y revierte la transacción con su auditoría', async () => {
    const { service, log } = harness();
    const fallo = new Error('fallo del trabajo');

    await expect(
      service.withAuthorizedContext(PRINCIPAL, { organizationId: ORG, contextId: CONTEXT }, 'VIEW_RECORDS', 'c', NOW, async () => {
        log.push('work');
        throw fallo;
      }),
    ).rejects.toBe(fallo);
    expect(log).toEqual([`begin:${PRINCIPAL.tenantId}`, 'set_config', 'policy', 'audit:granted', 'work', 'rollback']);
  });

  it('falla cerrado si la organización no quedó fijada en la transacción', async () => {
    const { service, log } = harness({ organizationGuc: '' });

    await expect(run(service, log)).rejects.toBeInstanceOf(CareContextUnavailableError);
    expect(log).not.toContain('policy');
    expect(log).not.toContain('work');
  });

  it('en enforce falla cerrado si el rol efectivo no es el runtime', async () => {
    const { service, log } = harness({ role: 'merdn_owner' });

    await expect(run(service, log)).rejects.toBeInstanceOf(CareContextUnavailableError);
    expect(log).not.toContain('policy');
  });

  it('un principal no confiable no abre transacción', async () => {
    const { service, log } = harness();

    await expect(
      run(service, log, { principal: { ...PRINCIPAL, tenantId: 'tenant-del-cliente' } }),
    ).rejects.toBeInstanceOf(CareContextUnavailableError);
    expect(log).toEqual([]);
  });

  it('una acción fuera del catálogo cerrado no abre transacción', async () => {
    const { service, log } = harness();

    await expect(run(service, log, { permission: 'ADMINISTER' })).rejects.toBeInstanceOf(
      CareContextUnavailableError,
    );
    expect(log).toEqual([]);
  });

  it('la correlación no acotada no se persiste', async () => {
    const { service, log, auditCalls } = harness();

    await service.withAuthorizedContext(
      PRINCIPAL,
      { organizationId: ORG, contextId: CONTEXT },
      'VIEW_RECORDS',
      'correlación con espacios y datos',
      NOW,
      async () => 'ok',
    );
    expect(log).toContain('audit:granted');
    expect(auditCalls[0]?.input['correlationId']).toBeNull();
  });
});
