import { describe, expect, it } from 'vitest';

import { hospitalDemoFetch } from './hospitalDemoLocal';

describe('API demo local de Hospital', () => {
  it('sirve DTOs ficticios de las tres tablas sin delegar a red', async () => {
    const agenda = await hospitalDemoFetch('/api/v1/hospital/agenda');
    const pacientes = await hospitalDemoFetch('/api/v1/hospital/patients');
    const profesionales = await hospitalDemoFetch('/api/v1/hospital/professionals');

    expect((await agenda.json() as { source: string }).source).toBe('DEMO_LOCAL_FICTICIA');
    expect((await pacientes.json() as { items: readonly unknown[] }).items).toHaveLength(2);
    expect((await profesionales.json() as { items: readonly unknown[] }).items).toHaveLength(2);
  });

  it('rechaza una escritura sin emitir una petición institucional', async () => {
    const response = await hospitalDemoFetch('/api/v1/hospital/agenda/demo-cita-001/assignment', {
      method: 'PATCH',
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: 'El modo demo no guarda cambios.' });
  });
});
