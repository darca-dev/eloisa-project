import { describe, expect, it } from 'vitest';

import { HOSPITAL_INTERSECTIONS } from './hospital.contract';
import {
  ageAt,
  ageRangeIdOf,
  distributionsOf,
  fullNameOf,
  keyFiguresOf,
  initialsOf,
  intersectionsOf,
  maskDocument,
  percentageOf,
  prioritiesOf,
  statusLabel,
  territoryOf,
  type HospitalPatientRow,
} from './hospital-patients.projection';

/**
 * Proyección y analítica hospitalaria (TASK-HOSPITAL-CORE-01 §12.1).
 *
 * Todas las personas de estas pruebas son FICTICIAS y sus documentos usan un
 * prefijo reservado que no corresponde a ninguna cédula real.
 *
 * Se comprueban cuatro invariantes que no pueden romperse sin consecuencia:
 * 1. la edad es calendario UTC y el cumpleaños ya cuenta;
 * 2. el documento completo NUNCA aparece en la salida;
 * 3. las ocho intersecciones son disjuntas y reconcilian el universo;
 * 4. un denominador cero produce `null`, jamás un cero.
 */

/** Fecha de corte fija: la proyección nunca lee la fecha del sistema. */
const CORTE = new Date(Date.UTC(2026, 7, 22));

function fila(overrides: Partial<HospitalPatientRow> = {}): HospitalPatientRow {
  return {
    patientId: '019218ab-0000-7000-8000-000000000001',
    givenNames: 'Ana María',
    familyNames: 'Ejemplo Ficticio',
    birthDate: new Date(Date.UTC(1958, 3, 12)),
    documentType: 'CEDULA_CIUDADANIA',
    documentNumberNormalized: '9999012345',
    epsCode: 'NUEVA_EPS',
    epsNameControlled: 'Nueva EPS',
    status: 'ACTIVE',
    disabilityDeclared: false,
    homeCareRequiredDeclared: false,
    municipalityOfficialCode: '05001',
    municipalityName: 'Medellín',
    areaType: 'URBAN',
    localUnitName: 'Barrio Ficticio',
    localityPendingNormalization: false,
    ...overrides,
  };
}

describe('edad derivada en UTC', () => {
  it('el día del cumpleaños ya cuenta como año cumplido', () => {
    const corte = new Date(Date.UTC(2026, 3, 12));

    expect(ageAt(new Date(Date.UTC(1966, 3, 12)), corte)).toBe(60);
    // La víspera todavía no.
    expect(ageAt(new Date(Date.UTC(1966, 3, 13)), corte)).toBe(59);
  });

  it('no depende de la zona horaria del proceso', () => {
    // Nacimiento a medianoche UTC del 1 de enero: el caso más sensible a un
    // desplazamiento de zona.
    expect(ageAt(new Date(Date.UTC(2000, 0, 1)), new Date(Date.UTC(2026, 0, 1)))).toBe(26);
    expect(ageAt(new Date(Date.UTC(2000, 0, 1)), new Date(Date.UTC(2025, 11, 31)))).toBe(25);
  });

  it('sitúa cada edad en su rango excluyente', () => {
    expect(ageRangeIdOf(0)).toBe('0-17');
    expect(ageRangeIdOf(17)).toBe('0-17');
    expect(ageRangeIdOf(18)).toBe('18-39');
    expect(ageRangeIdOf(59)).toBe('40-59');
    expect(ageRangeIdOf(60)).toBe('60-74');
    expect(ageRangeIdOf(84)).toBe('75-84');
    expect(ageRangeIdOf(85)).toBe('85+');
    expect(ageRangeIdOf(120)).toBe('85+');
  });

  it('una edad imposible no se fuerza al primer rango: se declara fuera de rango', () => {
    expect(ageRangeIdOf(-1)).toBe('fuera-de-rango');
  });
});

describe('identidad minimizada', () => {
  it('compone el nombre y las iniciales sin persistirlas', () => {
    expect(fullNameOf(fila())).toBe('Ana María Ejemplo Ficticio');
    expect(initialsOf(fila())).toBe('AE');
  });

  it('enmascara el documento por tipo y no filtra el valor completo', () => {
    const enmascarado = maskDocument('CEDULA_CIUDADANIA', '9999012345');

    expect(enmascarado).toBe('Cédula de ciudadanía ···345');
    expect(enmascarado).not.toContain('9999012345');
    expect(enmascarado).not.toContain('999901');
  });

  it('usa la etiqueta de cada tipo documental del catálogo', () => {
    expect(maskDocument('PASAPORTE', 'AB123456')).toBe('Pasaporte ···456');
    expect(maskDocument('CEDULA_EXTRANJERIA', '1234567')).toBe('Cédula de extranjería ···567');
    expect(maskDocument('PERMISO_PROTECCION_TEMPORAL', '7654321')).toBe(
      'Permiso por Protección Temporal ···321',
    );
    expect(maskDocument('OTRO', '5551234')).toBe('Otro ···234');
  });

  it('declara reservado un documento demasiado corto para enmascararse', () => {
    // Publicar «123» entero sería publicar el documento completo.
    expect(maskDocument('CEDULA_CIUDADANIA', '123')).toBe('Cédula de ciudadanía ···reservado');
    expect(maskDocument('CEDULA_CIUDADANIA', '')).toBe('Cédula de ciudadanía ···reservado');
  });

  it('un tipo documental desconocido no rompe el enmascarado', () => {
    expect(maskDocument('TIPO_NO_MODELADO', '9999012345')).toBe('Documento ···345');
  });

  it('la etiqueta de estado es administrativa y no clínica', () => {
    const etiqueta = statusLabel('ACTIVE');

    expect(etiqueta).toBe('Registro activo');
    for (const clinico of ['verde', 'amarillo', 'rojo', 'estable', 'riesgo', 'alerta']) {
      expect(etiqueta.toLocaleLowerCase('es-CO')).not.toContain(clinico);
    }
  });
});

describe('prioridades', () => {
  it('deriva 60+ de la fecha de nacimiento y no de una pertenencia almacenada', () => {
    const mayor = prioritiesOf(fila({ birthDate: new Date(Date.UTC(1958, 3, 12)) }), CORTE);
    const menor = prioritiesOf(fila({ birthDate: new Date(Date.UTC(1990, 3, 12)) }), CORTE);

    expect(mayor.older60).toBe(true);
    expect(menor.older60).toBe(false);
  });

  it('las tres condiciones son independientes y pueden coexistir', () => {
    const todas = prioritiesOf(
      fila({ disabilityDeclared: true, homeCareRequiredDeclared: true }),
      CORTE,
    );

    expect(todas).toStrictEqual({
      older60: true,
      disabilityDeclared: true,
      homeCareRequiredDeclared: true,
    });
  });
});

describe('territorio', () => {
  it('publica el barrio canónico cuando existe', () => {
    expect(territoryOf(fila())).toStrictEqual({
      municipalityOfficialCode: '05001',
      municipalityName: 'Medellín',
      areaType: 'URBAN',
      localUnitName: 'Barrio Ficticio',
      pendingNormalization: false,
    });
  });

  it('nunca devuelve el texto libre declarado: solo el hecho de estar pendiente', () => {
    const pendiente = territoryOf(
      fila({ localUnitName: null, localityPendingNormalization: true }),
    );

    expect(pendiente.localUnitName).toBeNull();
    expect(pendiente.pendingNormalization).toBe(true);
    expect(JSON.stringify(pendiente)).not.toContain('Localidad');
  });

  it('ante incoherencia NO atribuye el registro a un territorio canónico', () => {
    // Marcado como pendiente pese a tener unidad: se elige no atribuirlo.
    const incoherente = territoryOf(
      fila({ localUnitName: 'Barrio Ficticio', localityPendingNormalization: true }),
    );

    expect(incoherente.localUnitName).toBeNull();
    expect(incoherente.pendingNormalization).toBe(true);
  });
});

describe('porcentajes', () => {
  it('un denominador cero produce null, jamás un cero', () => {
    expect(percentageOf(0, 0)).toBeNull();
    expect(percentageOf(5, 0)).toBeNull();
    expect(percentageOf(0, 10)).toBe(0);
    expect(percentageOf(1, 4)).toBe(25);
  });

  it('con universo vacío todos los indicadores publican null', () => {
    for (const indicador of keyFiguresOf([], CORTE)) {
      expect(indicador.value).toBe(0);
      expect(indicador.percentage).toBeNull();
    }
  });

  it('con universo vacío todas las intersecciones publican null', () => {
    for (const celda of intersectionsOf([], CORTE)) {
      expect(celda.value).toBe(0);
      expect(celda.percentage).toBeNull();
    }
  });
});

describe('cifras disponibles', () => {
  const filas = [
    fila({ patientId: 'a', birthDate: new Date(Date.UTC(1950, 0, 1)) }),
    fila({ patientId: 'b', birthDate: new Date(Date.UTC(1990, 0, 1)), disabilityDeclared: true }),
    fila({
      patientId: 'c',
      birthDate: new Date(Date.UTC(1990, 0, 1)),
      homeCareRequiredDeclared: true,
    }),
    fila({ patientId: 'd', birthDate: new Date(Date.UTC(2010, 0, 1)) }),
  ];

  it('publica exactamente los cuatro que CORE-01 sostiene', () => {
    expect(keyFiguresOf(filas, CORTE).map((indicador) => indicador.key)).toStrictEqual([
      'activePatients',
      'age60Plus',
      'withDisability',
      'homeCareRequired',
    ]);
  });

  it('no publica indicadores de dominios que CORE-01 no modela', () => {
    const serializado = JSON.stringify(keyFiguresOf(filas, CORTE));

    for (const ausente of [
      'Caregiver',
      'withoutCaregiver',
      'Sin cuidador',
      'Sin profesional',
      'withoutResponsibleProfessional',
      'Patolog',
      'Programa',
      'Semáforo',
      'Alerta',
    ]) {
      expect(serializado).not.toContain(ausente);
    }
  });

  it('cuenta personas únicas y no suma condiciones solapadas', () => {
    const indicadores = keyFiguresOf(filas, CORTE);
    const porClave = new Map(indicadores.map((celda) => [celda.key, celda.value]));

    expect(porClave.get('activePatients')).toBe(4);
    expect(porClave.get('age60Plus')).toBe(1);
    expect(porClave.get('withDisability')).toBe(1);
    expect(porClave.get('homeCareRequired')).toBe(1);
  });
});

describe('ocho intersecciones disjuntas', () => {
  /** Una fila por cada combinación posible de las tres condiciones. */
  const universo: readonly HospitalPatientRow[] = [
    // 60+ solo
    fila({ patientId: '1', birthDate: new Date(Date.UTC(1950, 0, 1)) }),
    // 60+ y discapacidad
    fila({ patientId: '2', birthDate: new Date(Date.UTC(1950, 0, 1)), disabilityDeclared: true }),
    // 60+ y cuidados
    fila({
      patientId: '3',
      birthDate: new Date(Date.UTC(1950, 0, 1)),
      homeCareRequiredDeclared: true,
    }),
    // discapacidad y cuidados
    fila({
      patientId: '4',
      birthDate: new Date(Date.UTC(1990, 0, 1)),
      disabilityDeclared: true,
      homeCareRequiredDeclared: true,
    }),
    // las tres
    fila({
      patientId: '5',
      birthDate: new Date(Date.UTC(1950, 0, 1)),
      disabilityDeclared: true,
      homeCareRequiredDeclared: true,
    }),
    // discapacidad sola
    fila({ patientId: '6', birthDate: new Date(Date.UTC(1990, 0, 1)), disabilityDeclared: true }),
    // cuidados solos
    fila({
      patientId: '7',
      birthDate: new Date(Date.UTC(1990, 0, 1)),
      homeCareRequiredDeclared: true,
    }),
    // ninguna
    fila({ patientId: '8', birthDate: new Date(Date.UTC(1990, 0, 1)) }),
  ];

  it('declara las ocho combinaciones, incluida «ninguna»', () => {
    expect(HOSPITAL_INTERSECTIONS).toHaveLength(8);
    expect(HOSPITAL_INTERSECTIONS.map((celda) => celda.id)).toContain('ninguna');
  });

  it('cada persona cae en exactamente una celda', () => {
    for (const celda of intersectionsOf(universo, CORTE)) {
      expect(celda.value).toBe(1);
    }
  });

  it('la suma de las ocho reconcilia EXACTAMENTE el universo filtrado', () => {
    for (const conjunto of [universo, universo.slice(0, 3), universo.slice(5), []]) {
      const celdas = intersectionsOf(conjunto, CORTE);
      const suma = celdas.reduce((total, celda) => total + celda.value, 0);

      expect(suma).toBe(conjunto.length);
    }
  });

  it('los porcentajes de las ocho celdas suman 100 cuando hay universo', () => {
    const suma = intersectionsOf(universo, CORTE).reduce(
      (total, celda) => total + (celda.percentage ?? 0),
      0,
    );

    expect(suma).toBeCloseTo(100, 6);
  });
});

describe('distribuciones', () => {
  const universo: readonly HospitalPatientRow[] = [
    fila({ patientId: '1', birthDate: new Date(Date.UTC(1950, 0, 1)) }),
    fila({
      patientId: '2',
      birthDate: new Date(Date.UTC(1990, 0, 1)),
      epsCode: 'SANITAS',
      epsNameControlled: 'Sanitas',
      areaType: 'RURAL',
    }),
    fila({
      patientId: '3',
      birthDate: new Date(Date.UTC(1990, 0, 1)),
      municipalityOfficialCode: null,
      municipalityName: null,
      areaType: null,
      localUnitName: null,
      localityPendingNormalization: true,
    }),
  ];

  it('publica las cuatro distribuciones que CORE-01 sostiene', () => {
    expect(distributionsOf(universo, CORTE).map((d) => d.id)).toStrictEqual([
      'age-ranges',
      'eps',
      'municipality',
      'area-type',
    ]);
  });

  it('cada distribución reconcilia el universo filtrado', () => {
    for (const distribucion of distributionsOf(universo, CORTE)) {
      const suma = distribucion.cells.reduce((total, celda) => total + celda.value, 0);

      expect(suma).toBe(universo.length);
    }
  });

  it('un registro sin territorio no se atribuye a un municipio inventado', () => {
    const municipios = distributionsOf(universo, CORTE).find((d) => d.id === 'municipality');
    const sinTerritorio = municipios?.cells.find((celda) => celda.key === 'sin-territorio');

    expect(sinTerritorio?.value).toBe(1);
    expect(sinTerritorio?.label).toBe('Sin territorio registrado');
  });

  it('no publica distribuciones de dominios que CORE-01 no modela', () => {
    const serializado = JSON.stringify(distributionsOf(universo, CORTE));

    for (const ausente of ['patolog', 'programa', 'cuidador', 'profesional', 'semáforo']) {
      expect(serializado.toLocaleLowerCase('es-CO')).not.toContain(ausente);
    }
  });
});
