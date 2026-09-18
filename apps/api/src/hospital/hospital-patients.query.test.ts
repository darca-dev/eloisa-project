import { describe, expect, it } from 'vitest';

import {
  HOSPITAL_DEFAULT_PAGE_SIZE,
  HOSPITAL_PAGE_SIZES,
  HOSPITAL_QUERY_PARAMETERS,
} from './hospital.contract';
import {
  HospitalQueryError,
  normalizeSearchTerm,
  parseAnalyticsQuery,
  parseListQuery,
} from './hospital-patients.query';

/**
 * Allowlist de la consulta hospitalaria (TASK-HOSPITAL-CORE-01 §8.1 y §12.1).
 *
 * La validación es una función pura: se prueba sin base de datos, sin NestJS y
 * sin red. Lo que se verifica no es «que funcione», sino que RECHACE de forma
 * explícita todo lo que no está autorizado, en lugar de ignorarlo en silencio.
 */

/** Comprueba que una consulta produce `400` nombrando el parámetro culpable. */
function rechaza(query: Record<string, unknown>, parametro: string): void {
  expect(() => parseListQuery(query)).toThrow(HospitalQueryError);

  try {
    parseListQuery(query);
    expect.unreachable('la consulta debía rechazarse');
  } catch (error) {
    expect(error).toBeInstanceOf(HospitalQueryError);
    expect((error as HospitalQueryError).parameter).toBe(parametro);
  }
}

describe('valores por defecto', () => {
  it('una consulta vacía pagina 1×50, ordena por nombre ascendente y filtra activos', () => {
    const query = parseListQuery({});

    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(HOSPITAL_DEFAULT_PAGE_SIZE);
    expect(query.sort).toBe('name');
    expect(query.direction).toBe('asc');
    expect(query.filters.patientStatus).toBe('ACTIVE');
    expect(query.filters.search).toBeNull();
    expect(query.filters.ageMin).toBeNull();
    expect(query.filters.ageMax).toBeNull();
    expect(query.filters.older60).toBeNull();
  });

  it('el contrato declara exactamente los trece parámetros autorizados', () => {
    expect([...HOSPITAL_QUERY_PARAMETERS]).toStrictEqual([
      'page',
      'pageSize',
      'search',
      'ageMin',
      'ageMax',
      'epsCode',
      'populationType',
      'older60',
      'municipalityOfficialCode',
      'areaType',
      'patientStatus',
      'sort',
      'direction',
    ]);
  });
});

describe('allowlist cerrada', () => {
  it('rechaza un parámetro desconocido en lugar de ignorarlo', () => {
    /*
     * Ignorarlo devolvería MÁS registros de los que la persona creyó pedir. Un
     * filtro que se cree aplicado y no lo está es un fallo de minimización.
     */
    rechaza({ tenantId: '019218ab-0000-7000-8000-000000000000' }, 'tenantId');
    rechaza({ personId: '019218ab-0000-7000-8000-000000000000' }, 'personId');
    rechaza({ select: 'phone,email' }, 'select');
    rechaza({ diagnosis: 'cualquier-cosa' }, 'diagnosis');
    rechaza({ orderBy: 'person.phone' }, 'orderBy');
    rechaza({ limit: '10000' }, 'limit');
  });

  it('rechaza un parámetro repetido en lugar de elegir uno de los valores', () => {
    rechaza({ page: ['1', '2'] }, 'page');
    rechaza({ search: ['ana', 'jose'] }, 'search');
  });

  it('rechaza un parámetro con sintaxis de objeto anidado', () => {
    rechaza({ ageMin: { gte: 60 } }, 'ageMin');
  });

  it('la analítica no admite paginación ni orden', () => {
    for (const parametro of ['page', 'pageSize', 'sort', 'direction']) {
      expect(() => parseAnalyticsQuery({ [parametro]: 'asc' })).toThrow(HospitalQueryError);
    }

    // Pero sí admite exactamente los mismos filtros que el listado.
    expect(parseAnalyticsQuery({ older60: 'true', areaType: 'RURAL' })).toMatchObject({
      older60: true,
      areaType: 'RURAL',
    });
  });
});

describe('paginación', () => {
  it('acepta los tres tamaños del contrato y rechaza cualquier otro', () => {
    for (const size of HOSPITAL_PAGE_SIZES) {
      expect(parseListQuery({ pageSize: String(size) }).pageSize).toBe(size);
    }

    rechaza({ pageSize: '10' }, 'pageSize');
    rechaza({ pageSize: '1000' }, 'pageSize');
    rechaza({ pageSize: '0' }, 'pageSize');
  });

  it('rechaza una página menor que 1 y una no numérica', () => {
    rechaza({ page: '0' }, 'page');
    rechaza({ page: '-1' }, 'page');
    rechaza({ page: '1.5' }, 'page');
    rechaza({ page: 'ultima' }, 'page');
  });

  it('acepta una página alta: la corrección al último rango es del servidor', () => {
    expect(parseListQuery({ page: '9999' }).page).toBe(9999);
  });
});

describe('rango de edad', () => {
  it('es inclusivo y acepta los extremos del contrato', () => {
    const query = parseListQuery({ ageMin: '0', ageMax: '130' });

    expect(query.filters.ageMin).toBe(0);
    expect(query.filters.ageMax).toBe(130);
  });

  it('rechaza valores fuera del rango admitido', () => {
    rechaza({ ageMin: '131' }, 'ageMin');
    rechaza({ ageMax: '999' }, 'ageMax');
  });

  it('rechaza un rango incoherente en lugar de intercambiar los extremos', () => {
    rechaza({ ageMin: '80', ageMax: '20' }, 'ageMin');
  });

  it('acepta un rango de un solo año', () => {
    expect(parseListQuery({ ageMin: '60', ageMax: '60' }).filters).toMatchObject({
      ageMin: 60,
      ageMax: 60,
    });
  });
});

describe('catálogos controlados', () => {
  it('acepta un código de EPS del catálogo y rechaza uno inventado', () => {
    expect(parseListQuery({ epsCode: 'NUEVA_EPS' }).filters.epsCode).toBe('NUEVA_EPS');
    rechaza({ epsCode: 'EPS_QUE_NO_EXISTE' }, 'epsCode');
  });

  it('solo admite las dos pertenencias declarables como filtro', () => {
    expect(parseListQuery({ populationType: 'DISABILITY' }).filters.populationType).toBe(
      'DISABILITY',
    );
    expect(
      parseListQuery({ populationType: 'HOME_CARE_REQUIRED' }).filters.populationType,
    ).toBe('HOME_CARE_REQUIRED');

    /*
     * `OLDER_ADULT_60_PLUS` NO es filtrable por pertenencia: la edad se deriva
     * siempre de la fecha de nacimiento, porque la pertenencia almacenada queda
     * obsoleta cuando alguien cumple 60 después de inscribirse.
     */
    rechaza({ populationType: 'OLDER_ADULT_60_PLUS' }, 'populationType');
  });

  it('admite únicamente los estados que CORE-01 modela', () => {
    expect(parseListQuery({ patientStatus: 'ACTIVE' }).filters.patientStatus).toBe('ACTIVE');
    rechaza({ patientStatus: 'ARCHIVED' }, 'patientStatus');
  });

  it('exige un código oficial de municipio de cinco dígitos', () => {
    expect(
      parseListQuery({ municipalityOfficialCode: '05001' }).filters.municipalityOfficialCode,
    ).toBe('05001');

    rechaza({ municipalityOfficialCode: 'MEDELLIN' }, 'municipalityOfficialCode');
    rechaza({ municipalityOfficialCode: '5001' }, 'municipalityOfficialCode');
  });

  it('admite solo las dos áreas declaradas', () => {
    expect(parseListQuery({ areaType: 'URBAN' }).filters.areaType).toBe('URBAN');
    expect(parseListQuery({ areaType: 'RURAL' }).filters.areaType).toBe('RURAL');
    rechaza({ areaType: 'MIXTA' }, 'areaType');
  });

  it('`older60` es un booleano explícito, no una cadena cualquiera', () => {
    expect(parseListQuery({ older60: 'true' }).filters.older60).toBe(true);
    expect(parseListQuery({ older60: 'false' }).filters.older60).toBe(false);
    rechaza({ older60: '1' }, 'older60');
    rechaza({ older60: 'si' }, 'older60');
  });
});

describe('orden', () => {
  it('admite exactamente los tres criterios sostenibles con CORE-01', () => {
    for (const sort of ['name', 'age', 'status'] as const) {
      expect(parseListQuery({ sort }).sort).toBe(sort);
    }

    /*
     * `proxima` (Próxima atención) NO es ordenable: la agenda no existe en
     * CORE-01 y ordenar por un dato no modelado produciría un orden inventado.
     */
    rechaza({ sort: 'proxima' }, 'sort');
    rechaza({ sort: 'semaforo' }, 'sort');
    rechaza({ sort: 'condicion' }, 'sort');
  });

  it('admite solo los dos sentidos del contrato', () => {
    expect(parseListQuery({ direction: 'desc' }).direction).toBe('desc');
    rechaza({ direction: 'descending' }, 'direction');
  });
});

describe('normalización de la búsqueda', () => {
  it('recorta, colapsa espacios y descompone en palabras', () => {
    const termino = normalizeSearchTerm('  Ana   María  ');

    expect(termino?.raw).toBe('Ana María');
    expect(termino?.tokens).toStrictEqual(['ana', 'maría']);
  });

  it('deriva la forma documental conservando solo caracteres alfanuméricos', () => {
    expect(normalizeSearchTerm('24.556.812')?.documentForm).toBe('24556812');
    expect(normalizeSearchTerm('ab-123 456')?.documentForm).toBe('AB123456');
  });

  it('un término sin caracteres alfanuméricos no produce forma documental', () => {
    expect(normalizeSearchTerm('...')?.documentForm).toBe('');
  });

  it('un término vacío o solo de espacios equivale a no buscar', () => {
    expect(normalizeSearchTerm('   ')).toBeNull();
    expect(parseListQuery({ search: '   ' }).filters.search).toBeNull();
  });

  it('rechaza un término más largo que el máximo del contrato', () => {
    expect(parseListQuery({ search: 'a'.repeat(100) }).filters.search?.raw).toHaveLength(100);
    rechaza({ search: 'a'.repeat(101) }, 'search');
  });
});

describe('combinaciones', () => {
  it('acepta todos los filtros a la vez y los combina con AND', () => {
    const query = parseListQuery({
      page: '2',
      pageSize: '25',
      search: 'Ejemplo',
      ageMin: '60',
      ageMax: '90',
      epsCode: 'SANITAS',
      populationType: 'DISABILITY',
      older60: 'true',
      municipalityOfficialCode: '05001',
      areaType: 'URBAN',
      patientStatus: 'ACTIVE',
      sort: 'age',
      direction: 'desc',
    });

    expect(query).toMatchObject({
      page: 2,
      pageSize: 25,
      sort: 'age',
      direction: 'desc',
      filters: {
        ageMin: 60,
        ageMax: 90,
        epsCode: 'SANITAS',
        populationType: 'DISABILITY',
        older60: true,
        municipalityOfficialCode: '05001',
        areaType: 'URBAN',
        patientStatus: 'ACTIVE',
      },
    });
    expect(query.filters.search?.tokens).toStrictEqual(['ejemplo']);
  });

  it('un parámetro válido acompañado de uno prohibido rechaza la consulta entera', () => {
    rechaza({ ageMin: '60', tenantId: 'otro-tenant' }, 'tenantId');
  });
});

describe('mensajes de error', () => {
  it('nombran el parámetro y la regla, nunca el valor recibido', () => {
    try {
      parseListQuery({ epsCode: 'EPS_SECRETA_INVENTADA' });
      expect.unreachable('la consulta debía rechazarse');
    } catch (error) {
      const mensaje = (error as HospitalQueryError).message;

      expect(mensaje).toContain('epsCode');
      expect(mensaje).not.toContain('EPS_SECRETA_INVENTADA');
    }
  });
});
