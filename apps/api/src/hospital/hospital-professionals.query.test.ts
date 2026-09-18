import { describe, expect, it } from 'vitest';

import {
  HOSPITAL_AGENDA_MAX_WINDOW_DAYS,
  HOSPITAL_PROFESSIONAL_DEFAULT_PAGE_SIZE,
  findProfessionByCode,
  inclusiveDaySpan,
  personFullName,
  personInitials,
  utcDatesOfWindow,
} from './hospital.contract';
import { parseAgendaQuery } from './hospital-agenda.query';
import {
  HospitalOperationsQueryError,
  normalizeProfessionalSearch,
  parseProfessionalDetailQuery,
  parseProfessionalsListQuery,
} from './hospital-professionals.query';

/**
 * Análisis de la consulta de operaciones hospitalarias
 * (TASK-HOSPITAL-CORE-02 §6.1, §6.2 y §11.2).
 *
 * Son funciones PURAS: se prueban sin base de datos, sin NestJS y sin red. Lo
 * que se comprueba aquí es exactamente lo que impide que el navegador amplíe la
 * consulta por su cuenta.
 */

const AHORA = new Date('2026-08-22T10:30:00.000Z');

describe('allowlist del directorio de profesionales', () => {
  it('acepta la consulta vacía con valores por defecto declarados', () => {
    const query = parseProfessionalsListQuery({});

    expect(query).toStrictEqual({
      page: 1,
      pageSize: HOSPITAL_PROFESSIONAL_DEFAULT_PAGE_SIZE,
      sort: 'name',
      direction: 'asc',
      filters: {
        search: null,
        professionCode: null,
        affiliationType: null,
        status: null,
      },
    });
  });

  it('rechaza cualquier parámetro fuera de la allowlist', () => {
    for (const nombre of [
      'tenantId',
      'identityId',
      'personId',
      'role',
      'actor',
      'select',
      'fields',
      'orderBy',
      'rating',
      'availability',
      'salary',
    ]) {
      expect(() => parseProfessionalsListQuery({ [nombre]: 'x' })).toThrow(
        HospitalOperationsQueryError,
      );
    }
  });

  it('rechaza un parámetro repetido en lugar de elegir uno', () => {
    expect(() => parseProfessionalsListQuery({ page: ['1', '2'] })).toThrow(
      /no admite valores repetidos/u,
    );
  });

  it('rechaza sintaxis de objeto anidado', () => {
    expect(() => parseProfessionalsListQuery({ search: { $ne: '' } })).toThrow(
      /valor simple/u,
    );
  });

  it('acota página, tamaño, orden y catálogo controlado', () => {
    expect(() => parseProfessionalsListQuery({ page: '0' })).toThrow(/mayor o igual que 1/u);
    expect(() => parseProfessionalsListQuery({ page: '-1' })).toThrow(/entero no negativo/u);
    expect(() => parseProfessionalsListQuery({ pageSize: '100' })).toThrow(/25, 50/u);
    expect(() => parseProfessionalsListQuery({ sort: 'rating' })).toThrow(/name, profession/u);
    expect(() => parseProfessionalsListQuery({ direction: 'random' })).toThrow(/asc, desc/u);
    expect(() => parseProfessionalsListQuery({ professionCode: 'INVENTADA' })).toThrow(
      /catálogo controlado/u,
    );
    expect(() => parseProfessionalsListQuery({ affiliationType: 'BECARIO' })).toThrow(
      /EMPLOYEE, INDEPENDENT, THIRD_PARTY/u,
    );
    expect(() => parseProfessionalsListQuery({ status: 'DELETED' })).toThrow(
      /ACTIVE, INACTIVE/u,
    );
    expect(() => parseProfessionalsListQuery({ search: 'x'.repeat(101) })).toThrow(
      /100 caracteres/u,
    );
  });

  it('normaliza el término de búsqueda de forma determinista', () => {
    expect(normalizeProfessionalSearch('  Ana   MARÍA  ')).toStrictEqual({
      raw: 'Ana MARÍA',
      tokens: ['ana', 'maría'],
    });

    expect(normalizeProfessionalSearch('   ')).toBeNull();
  });
});

describe('ventana de agenda', () => {
  it('la agenda EXIGE las dos fechas', () => {
    expect(() => parseAgendaQuery({}, AHORA)).toThrow(/obligatorio/u);
    expect(() => parseAgendaQuery({ from: '2026-08-01' }, AHORA)).toThrow(/obligatorio/u);
    expect(() => parseAgendaQuery({ to: '2026-08-31' }, AHORA)).toThrow(/obligatorio/u);
  });

  it('rechaza una fecha con forma válida que no existe en el calendario', () => {
    expect(() =>
      parseAgendaQuery({ from: '2026-02-31', to: '2026-03-01' }, AHORA),
    ).toThrow(/fecha real/u);
  });

  it('rechaza una ventana invertida o mayor que el máximo', () => {
    expect(() =>
      parseAgendaQuery({ from: '2026-08-31', to: '2026-08-01' }, AHORA),
    ).toThrow(/posterior/u);

    expect(() =>
      parseAgendaQuery({ from: '2026-08-01', to: '2026-09-02' }, AHORA),
    ).toThrow(new RegExp(`${HOSPITAL_AGENDA_MAX_WINDOW_DAYS} días`, 'u'));

    // El límite EXACTO sí se admite.
    expect(parseAgendaQuery({ from: '2026-08-01', to: '2026-08-31' }, AHORA)).toStrictEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('el detalle profesional usa el día del SERVIDOR cuando no se declara ventana', () => {
    expect(parseProfessionalDetailQuery({}, AHORA)).toStrictEqual({
      from: '2026-08-22',
      to: '2026-08-22',
    });
  });

  it('el detalle profesional no admite parámetros del directorio', () => {
    expect(() => parseProfessionalDetailQuery({ page: '1' }, AHORA)).toThrow(
      /no está admitido/u,
    );
  });

  it('una ventana a medias se rechaza en los dos sentidos', () => {
    expect(() => parseProfessionalDetailQuery({ from: '2026-08-01' }, AHORA)).toThrow(
      /«to»|to/u,
    );
    expect(() => parseProfessionalDetailQuery({ to: '2026-08-01' }, AHORA)).toThrow(
      /«from»|from/u,
    );
  });
});

describe('utilidades puras del contrato', () => {
  it('cuenta días inclusivos y enumera la ventana completa', () => {
    expect(inclusiveDaySpan('2026-08-01', '2026-08-01')).toBe(1);
    expect(inclusiveDaySpan('2026-08-01', '2026-08-31')).toBe(31);
    expect(utcDatesOfWindow('2026-08-30', '2026-09-01')).toStrictEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ]);
  });

  it('proyecta nombre e iniciales sin inventar nada', () => {
    expect(personFullName('  Ana   María ', ' Ejemplo Ficticio ')).toBe(
      'Ana María Ejemplo Ficticio',
    );
    expect(personInitials('Ana María', 'Ejemplo Ficticio')).toBe('AE');
    // Sin apellido no se rellena con un carácter inventado.
    expect(personInitials('Ana', '')).toBe('A');
  });

  it('el catálogo de profesiones es cerrado', () => {
    expect(findProfessionByCode('MEDICINA_GENERAL')?.name).toBe('Medicina general');
    expect(findProfessionByCode('CIRUGIA_ROBOTICA')).toBeUndefined();
  });
});
