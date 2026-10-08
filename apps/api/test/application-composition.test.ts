import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/database/tenant-context.service';
import { ExpireRelationshipsJob } from '../src/people-relationships/expire-relationships.job';

describe('application composition', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it('compiles AppModule with every registered provider', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef).toBeDefined();
  });

  it('injects the expiration job dependencies and performs work through the tenant context', async () => {
    const tenantId = '00000000-0000-4000-8000-000000000001';
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const tx = { patientCaregiverRelationship: { updateMany } };
    const withTenant = vi.fn((_tenantId: string, work: (context: typeof tx) => Promise<number>) => work(tx));
    const resolveActiveTenant = vi.fn().mockResolvedValue({ tenantId });

    moduleRef = await Test.createTestingModule({
      providers: [
        ExpireRelationshipsJob,
        { provide: PrismaService, useValue: { withTenant } },
        { provide: TenantContextService, useValue: { resolveActiveTenant } },
      ],
    }).compile();

    const count = await moduleRef.get(ExpireRelationshipsJob).runManual();

    expect(count).toBe(2);
    expect(resolveActiveTenant).toHaveBeenCalledOnce();
    expect(withTenant).toHaveBeenCalledExactlyOnceWith(tenantId, expect.any(Function));
    expect(updateMany).toHaveBeenCalledOnce();
  });
});
