import { describe, expect, it } from 'vitest';

import { type PrismaTransaction } from '../database/prisma-transaction';
import { type PrismaService } from '../database/prisma.service';

import { type HumanPrincipal } from './human-principal';
import { IdentityAccessService } from './identity-access.service';

const PRINCIPAL: HumanPrincipal = {
  sessionId: '00000000-0000-0000-0000-000000000001',
  humanAccountId: '00000000-0000-0000-0000-000000000002',
  personId: '00000000-0000-0000-0000-000000000003',
  tenantId: '00000000-0000-0000-0000-000000000004',
  externalAuthIdentityId: '00000000-0000-0000-0000-000000000005',
};

const PATIENT_ID = '00000000-0000-0000-0000-000000000006';

interface DoubleOptions {
  readonly account?: boolean;
  readonly approved?: boolean;
  readonly patient?: boolean;
}

function double(options: DoubleOptions = {}): {
  readonly tx: PrismaTransaction;
  readonly operations: string[];
  readonly sql: string[];
  readonly accessWhere: Record<string, unknown>[];
  readonly patientWhere: Record<string, unknown>[];
} {
  const operations: string[] = [];
  const sql: string[] = [];
  const accessWhere: Record<string, unknown>[] = [];
  const patientWhere: Record<string, unknown>[] = [];

  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      operations.push('humanAccount:FOR SHARE');
      sql.push(strings.join('?'));
      return options.account === false ? [] : [{ id: PRINCIPAL.humanAccountId }];
    },
    accessRequest: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        operations.push('accessRequest');
        accessWhere.push(args.where);
        return options.approved === false ? null : { id: 'approved-request' };
      },
    },
    patient: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        operations.push('patient');
        patientWhere.push(args.where);
        return options.patient === false ? null : { id: PATIENT_ID };
      },
    },
  } as unknown as PrismaTransaction;

  return { tx, operations, sql, accessWhere, patientWhere };
}

describe('IdentityAccessService.resolveApprovedPatientWithin', () => {
  const service = new IdentityAccessService({} as PrismaService);

  it('exige el vínculo exacto de la sesión antes de consultar', async () => {
    const spy = double();
    const historical = { ...PRINCIPAL, externalAuthIdentityId: undefined };

    await expect(service.resolveApprovedPatientWithin(spy.tx, historical)).resolves.toBeNull();
    expect(spy.operations).toEqual([]);
  });

  it('bloquea primero la cuenta y corta si no está activa o disponible', async () => {
    const spy = double({ account: false });

    await expect(service.resolveApprovedPatientWithin(spy.tx, PRINCIPAL)).resolves.toBeNull();
    expect(spy.operations).toEqual(['humanAccount:FOR SHARE']);
    expect(spy.sql[0]).toMatch(/FROM "human_account"/);
    expect(spy.sql[0]).toMatch(/"id" = \?::uuid/);
    expect(spy.sql[0]).toMatch(/"tenantId" = \?::uuid/);
    expect(spy.sql[0]).toMatch(/"personId" = \?::uuid/);
    expect(spy.sql[0]).toContain('"status" = \'ACTIVE\'');
    expect(spy.sql[0]).toContain('NOT "passwordRecoveryBlocked"');
    expect(spy.sql[0]).toMatch(/FOR SHARE\s*$/);
  });

  it('exige aprobación PATIENT de la cuenta, persona, vínculo y tenant exactos', async () => {
    const spy = double({ approved: false });

    await expect(service.resolveApprovedPatientWithin(spy.tx, PRINCIPAL)).resolves.toBeNull();
    expect(spy.operations).toEqual(['humanAccount:FOR SHARE', 'accessRequest']);
    expect(spy.accessWhere[0]).toEqual({
      tenantId: PRINCIPAL.tenantId,
      personId: PRINCIPAL.personId,
      humanAccountId: PRINCIPAL.humanAccountId,
      externalAuthIdentityId: PRINCIPAL.externalAuthIdentityId,
      requestedProfile: 'PATIENT',
      status: 'APPROVED',
      externalIdentity: {
        id: PRINCIPAL.externalAuthIdentityId,
        tenantId: PRINCIPAL.tenantId,
        humanAccountId: PRINCIPAL.humanAccountId,
        status: 'ACTIVE',
      },
    });
  });

  it('solo devuelve la participación activa de la misma persona y tenant', async () => {
    const spy = double();

    await expect(service.resolveApprovedPatientWithin(spy.tx, PRINCIPAL)).resolves.toEqual({
      patientId: PATIENT_ID,
    });
    expect(spy.operations).toEqual([
      'humanAccount:FOR SHARE',
      'accessRequest',
      'patient',
    ]);
    expect(spy.patientWhere[0]).toEqual({
      tenantId: PRINCIPAL.tenantId,
      personId: PRINCIPAL.personId,
      status: 'ACTIVE',
    });
  });

  it('deniega si la solicitud fue aprobada pero ya no existe participación activa', async () => {
    const spy = double({ patient: false });

    await expect(service.resolveApprovedPatientWithin(spy.tx, PRINCIPAL)).resolves.toBeNull();
  });
});
