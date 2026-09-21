import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';

describe('application composition', () => {
  let moduleRef: Awaited<ReturnType<typeof Test.createTestingModule>> | undefined;

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('compiles AppModule with every registered provider', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef).toBeDefined();
  });
});
