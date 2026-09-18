import { describe, expect, it } from 'vitest';

import { isAllowedWebOrigin } from './hospital-appointment-assignment.origin';
import {
  HospitalAssignmentBodyError,
  parseAssignmentBody,
} from './hospital-appointment-assignment.request';

/**
 * Cuerpo y origen de la ÚNICA mutación autorizada
 * (TASK-HOSPITAL-CORE-02 §4.2, §6.3 y §11.2).
 *
 * Son funciones PURAS y se prueban sin base de datos, sin NestJS y sin red.
 */

const VALIDO = {
  professionalId: '019287a1-0000-7000-8000-000000000001',
  scheduledStart: '2026-08-22T15:00:00.000Z',
  expectedVersion: 1,
} as const;

describe('cuerpo de la asignación', () => {
  it('acepta exactamente los tres campos del contrato', () => {
    const parsed = parseAssignmentBody({ ...VALIDO });

    expect(parsed.professionalId).toBe(VALIDO.professionalId);
    expect(parsed.expectedVersion).toBe(1);
    expect(parsed.scheduledStart.toISOString()).toBe('2026-08-22T15:00:00.000Z');
  });

  it('rechaza cualquier campo que el navegador no es autoridad para enviar', () => {
    for (const campo of [
      'tenantId',
      'identityId',
      'personId',
      'patientId',
      'actor',
      'role',
      'status',
      'version',
      'careAssignmentId',
      'createdByIdentityId',
    ]) {
      expect(() => parseAssignmentBody({ ...VALIDO, [campo]: 'x' })).toThrow(
        HospitalAssignmentBodyError,
      );
    }
  });

  it('exige los tres campos: no hay valores por defecto', () => {
    expect(() => parseAssignmentBody({})).toThrow(/professionalId/u);
    expect(() =>
      parseAssignmentBody({
        professionalId: VALIDO.professionalId,
        scheduledStart: VALIDO.scheduledStart,
      }),
    ).toThrow(/expectedVersion/u);
    expect(() =>
      parseAssignmentBody({
        professionalId: VALIDO.professionalId,
        expectedVersion: 1,
      }),
    ).toThrow(/scheduledStart/u);
  });

  it('rechaza un cuerpo que no es un objeto JSON', () => {
    for (const cuerpo of [null, undefined, 'texto', 7, [VALIDO]]) {
      expect(() => parseAssignmentBody(cuerpo)).toThrow(HospitalAssignmentBodyError);
    }
  });

  it('exige desplazamiento horario EXPLÍCITO en el instante', () => {
    for (const instante of [
      '2026-08-22T15:00:00',
      '2026-08-22 15:00:00Z',
      '2026-08-22',
      'ayer',
      '',
    ]) {
      expect(() => parseAssignmentBody({ ...VALIDO, scheduledStart: instante })).toThrow(
        /desplazamiento horario/u,
      );
    }

    // `Z` y `±HH:MM` son las dos formas admitidas.
    expect(
      parseAssignmentBody({
        ...VALIDO,
        scheduledStart: '2026-08-22T10:00:00-05:00',
      }).scheduledStart.toISOString(),
    ).toBe('2026-08-22T15:00:00.000Z');
  });

  it('rechaza una versión que no es un entero positivo', () => {
    for (const version of [0, -1, 1.5, '1', null, Number.NaN]) {
      expect(() => parseAssignmentBody({ ...VALIDO, expectedVersion: version })).toThrow(
        /expectedVersion/u,
      );
    }
  });

  it('rechaza un identificador de profesional mal formado', () => {
    for (const id of ['no-es-uuid', '', 42, null, VALIDO.professionalId.slice(0, -1)]) {
      expect(() => parseAssignmentBody({ ...VALIDO, professionalId: id })).toThrow(
        /professionalId/u,
      );
    }
  });

  it('el mensaje nombra el campo pero NUNCA el valor recibido', () => {
    try {
      parseAssignmentBody({ ...VALIDO, professionalId: 'valor-secreto-recibido' });
      expect.unreachable('debía rechazar el identificador');
    } catch (error) {
      expect(error).toBeInstanceOf(HospitalAssignmentBodyError);
      expect((error as Error).message).toContain('professionalId');
      expect((error as Error).message).not.toContain('valor-secreto-recibido');
    }
  });
});

describe('comprobación de origen', () => {
  const PERMITIDOS = ['http://127.0.0.1:3000', 'https://merdn.example'];

  it('acepta un origen exactamente configurado', () => {
    expect(isAllowedWebOrigin({ origin: 'http://127.0.0.1:3000' }, PERMITIDOS)).toBe(true);
    expect(isAllowedWebOrigin({ origin: 'https://merdn.example' }, PERMITIDOS)).toBe(true);
  });

  it('usa `Referer` solo cuando no hay `Origin`, y compara su ORIGEN', () => {
    expect(
      isAllowedWebOrigin({ referer: 'http://127.0.0.1:3000/hospital/agenda' }, PERMITIDOS),
    ).toBe(true);
  });

  it('deniega por defecto cuando no hay origen determinable', () => {
    expect(isAllowedWebOrigin({}, PERMITIDOS)).toBe(false);
    expect(isAllowedWebOrigin({ origin: '' }, PERMITIDOS)).toBe(false);
    // `Origin: null` es lo que envía un contexto opaco. No es un origen válido.
    expect(isAllowedWebOrigin({ origin: 'null' }, PERMITIDOS)).toBe(false);
    expect(isAllowedWebOrigin({ origin: 'no-es-una-url' }, PERMITIDOS)).toBe(false);
    expect(isAllowedWebOrigin({ origin: 42 }, PERMITIDOS)).toBe(false);
  });

  it('no admite un sufijo, otro puerto ni otro esquema', () => {
    for (const origen of [
      'https://merdn.example.atacante.invalid',
      'https://atacante.invalid/?x=https://merdn.example',
      'http://merdn.example',
      'http://127.0.0.1:3001',
      'http://localhost:3000',
    ]) {
      expect(isAllowedWebOrigin({ origin: origen }, PERMITIDOS)).toBe(false);
    }
  });

  it('sin orígenes configurados no acepta ninguno', () => {
    expect(isAllowedWebOrigin({ origin: 'http://127.0.0.1:3000' }, [])).toBe(false);
  });
});
