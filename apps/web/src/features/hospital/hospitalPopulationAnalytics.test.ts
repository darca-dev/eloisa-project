import { describe, expect, it } from 'vitest';

import {
  POBLACION_FECHA_CORTE,
  POBLACION_TOTAL_GENERADO,
  pacientesPoblacionDemo,
} from './hospitalPopulationFixtures';
import {
  POBLACION_FILTROS_VACIOS,
  condicionPrincipal,
  cuidadoresVigentes,
  documentoEnmascarado,
  edadEnCorte,
  filtrarPacientes,
  filtrosVacios,
  formatearNumero,
  interseccionesDe,
  kpiDe,
  normalizar,
  opcionesDeFiltro,
  ordenarPacientes,
  paginar,
  porcentaje,
  rangoDeEdad,
  snapshotDePoblacion,
  textoCuidador,
  textoPorcentaje,
  textoProfesional,
  universoDe,
} from './hospitalPopulationAnalytics';
import {
  POBLACION_RANGOS_EDAD,
  POBLACION_SIN_ASIGNAR,
  POBLACION_SIN_CONDICION_PRINCIPAL,
  POBLACION_SIN_DATOS,
  type PoblacionPaciente,
} from './hospitalPopulationTypes';

/**
 * Definiciones métricas compartidas `population-v1` (TASK-003H-03B, T-12).
 *
 * Comprueba la aritmética que sostiene la vista y que Reportes (H-07) deberá
 * reutilizar: edad en la fecha de corte, normalización de la búsqueda,
 * combinación AND/OR de filtros, `Sin asignar`, deduplicación del universo,
 * KPI, porcentajes con denominador cero, frecuencia de patologías por paciente
 * único y las ocho intersecciones disjuntas que reconcilian el universo.
 */

const CORTE = '2026-08-20';

/** Persona mínima; cada prueba sobrescribe únicamente lo que necesita. */
function paciente(parcial: Partial<PoblacionPaciente> & { readonly id: string }): PoblacionPaciente {
  return {
    tenantId: 'tenant-prueba',
    nombre: 'Persona de prueba',
    iniciales: 'PP',
    documento: 'CC 11.111.111',
    nacimiento: '1990-01-01',
    contacto: '300 000 0000',
    municipio: 'Soacha',
    zona: 'Comuna 1',
    participacion: 'active',
    estado: 'Activo',
    semaforo: { etiqueta: 'Verde', texto: 'Verde · sin novedades', tono: 'verde' },
    afiliacion: { eps: 'Nueva EPS', desde: '2020-01-01', estado: 'Vigente' },
    clasificaciones: [],
    condiciones: [],
    asignaciones: [],
    cuidadores: [],
    programas: [],
    proximaAtencion: null,
    ultimasAtenciones: [],
    ...parcial,
  };
}

describe('T-12.1 — Edad derivada de la fecha de corte', () => {
  it('cuenta el año solo cuando la persona ya cumplió', () => {
    /* Cumple justo el día del corte: la edad ya está cumplida. */
    expect(edadEnCorte('1950-08-20', CORTE)).toBe(76);
    /* Cumple un día después del corte: todavía tiene un año menos. */
    expect(edadEnCorte('1950-08-21', CORTE)).toBe(75);
    /* Cumple un día antes del corte. */
    expect(edadEnCorte('1950-08-19', CORTE)).toBe(76);
    /* Mes anterior y mes posterior. */
    expect(edadEnCorte('1966-07-31', CORTE)).toBe(60);
    expect(edadEnCorte('1966-09-01', CORTE)).toBe(59);
  });

  it('usa la fecha de corte del fixture cuando no se indica otra', () => {
    expect(edadEnCorte('1950-03-11')).toBe(edadEnCorte('1950-03-11', POBLACION_FECHA_CORTE));
  });

  it('asigna cada edad a un único rango excluyente', () => {
    expect(rangoDeEdad(0)).toBe('0-17');
    expect(rangoDeEdad(17)).toBe('0-17');
    expect(rangoDeEdad(18)).toBe('18-39');
    expect(rangoDeEdad(59)).toBe('40-59');
    expect(rangoDeEdad(60)).toBe('60-74');
    expect(rangoDeEdad(84)).toBe('75-84');
    expect(rangoDeEdad(85)).toBe('85+');
    expect(rangoDeEdad(103)).toBe('85+');
    expect(POBLACION_RANGOS_EDAD).toHaveLength(6);
  });
});

describe('T-12.2 — Normalización de la búsqueda', () => {
  it('ignora mayúsculas, tildes y espacios extremos', () => {
    expect(normalizar('  MARÍA Gómez  ')).toBe('maria gomez');
    expect(normalizar('Pérez')).toBe(normalizar('perez'));
  });

  it('encuentra por nombre y por documento ficticio', () => {
    const conjunto = [
      paciente({ id: 'a', nombre: 'María Gómez Osorio', documento: 'CC 24.556.812' }),
      paciente({ id: 'b', nombre: 'Juan Pérez Díaz', documento: 'CC 99.111.222' }),
    ];

    expect(
      filtrarPacientes(conjunto, { ...POBLACION_FILTROS_VACIOS, texto: 'maria gomez' }, CORTE).map(
        (persona) => persona.id,
      ),
    ).toEqual(['a']);
    expect(
      filtrarPacientes(conjunto, { ...POBLACION_FILTROS_VACIOS, texto: '99.111' }, CORTE).map(
        (persona) => persona.id,
      ),
    ).toEqual(['b']);
  });
});

describe('T-12.3 — Semántica AND/OR de los filtros', () => {
  const mayor = paciente({
    id: 'mayor',
    nacimiento: '1950-01-01',
    clasificaciones: [
      {
        tipo: 'DISABILITY',
        activa: true,
        desde: '2020-01-01',
        hasta: null,
        procedencia: { fuente: 'f', fecha: '2020-01-01', estado: 'Vigente' },
      },
    ],
  });
  const joven = paciente({
    id: 'joven',
    nacimiento: '2000-01-01',
    clasificaciones: [
      {
        tipo: 'DISABILITY',
        activa: true,
        desde: '2020-01-01',
        hasta: null,
        procedencia: { fuente: 'f', fecha: '2020-01-01', estado: 'Vigente' },
      },
    ],
  });
  const soloMayor = paciente({ id: 'solo-mayor', nacimiento: '1940-01-01' });
  const conjunto = [mayor, joven, soloMayor];

  it('combina los tres chips rápidos con AND', () => {
    const soloSesenta = filtrarPacientes(
      conjunto,
      { ...POBLACION_FILTROS_VACIOS, rapidos: { ...POBLACION_FILTROS_VACIOS.rapidos, mayor60: true } },
      CORTE,
    );

    expect(soloSesenta.map((persona) => persona.id)).toEqual(['mayor', 'solo-mayor']);

    const ambos = filtrarPacientes(
      conjunto,
      {
        ...POBLACION_FILTROS_VACIOS,
        rapidos: { mayor60: true, discapacidad: true, cuidadosCasa: false },
      },
      CORTE,
    );

    expect(ambos.map((persona) => persona.id)).toEqual(['mayor']);
  });

  it('exige a la vez chips y selectores', () => {
    const resultado = filtrarPacientes(
      conjunto,
      {
        ...POBLACION_FILTROS_VACIOS,
        eps: 'EPS Salud Andina',
        rapidos: { mayor60: true, discapacidad: true, cuidadosCasa: false },
      },
      CORTE,
    );

    expect(resultado).toEqual([]);
  });

  it('aplica el rango de edad de forma inclusiva', () => {
    const resultado = filtrarPacientes(
      conjunto,
      { ...POBLACION_FILTROS_VACIOS, edadMin: '76', edadMax: '76' },
      CORTE,
    );

    expect(resultado.map((persona) => persona.id)).toEqual(['mayor']);
  });

  it('coincide con una patología si existe al menos una relación activa', () => {
    const varias = paciente({
      id: 'varias',
      condiciones: [
        {
          nombre: 'Diabetes tipo 2',
          activa: true,
          principal: false,
          procedencia: { fuente: 'f', fecha: '2026-01-01', estado: 'Vigente' },
        },
        {
          nombre: 'Artrosis',
          activa: true,
          principal: true,
          procedencia: { fuente: 'f', fecha: '2026-01-01', estado: 'Vigente' },
        },
      ],
    });

    expect(
      filtrarPacientes([varias, soloMayor], { ...POBLACION_FILTROS_VACIOS, patologia: 'Artrosis' }, CORTE),
    ).toHaveLength(1);
    expect(
      filtrarPacientes(
        [varias, soloMayor],
        { ...POBLACION_FILTROS_VACIOS, patologia: 'Diabetes tipo 2' },
        CORTE,
      ),
    ).toHaveLength(1);
  });

  it('reconoce la consulta vacía', () => {
    expect(filtrosVacios(POBLACION_FILTROS_VACIOS)).toBe(true);
    expect(filtrosVacios({ ...POBLACION_FILTROS_VACIOS, eps: 'Nueva EPS' })).toBe(false);
    expect(
      filtrosVacios({
        ...POBLACION_FILTROS_VACIOS,
        rapidos: { mayor60: true, discapacidad: false, cuidadosCasa: false },
      }),
    ).toBe(false);
  });
});

describe('T-12.4 — `Sin asignar` y condición principal', () => {
  const asignado = paciente({
    id: 'asignado',
    asignaciones: [
      {
        nombre: 'Dra. Laura Gómez',
        profesion: 'Medicina general',
        principal: true,
        activa: true,
        vigente: true,
      },
    ],
    cuidadores: [
      { nombre: 'Ana López', relacion: 'hija', contacto: '300', activo: true, vigente: true },
      { nombre: 'Rosa Marín', relacion: 'vecina', contacto: '301', activo: true, vigente: true },
    ],
    programas: ['Crónicos'],
  });
  const vencido = paciente({
    id: 'vencido',
    asignaciones: [
      {
        nombre: 'Dr. Juan Pérez',
        profesion: 'Medicina general',
        principal: true,
        activa: true,
        vigente: false,
      },
    ],
    cuidadores: [
      { nombre: 'Luz Rojas', relacion: 'hija', contacto: '302', activo: true, vigente: false },
    ],
  });

  it('no cuenta asignaciones ni vínculos no vigentes', () => {
    expect(textoProfesional(asignado)).toBe('Dra. Laura Gómez');
    expect(textoProfesional(vencido)).toBe(POBLACION_SIN_ASIGNAR);
    expect(cuidadoresVigentes(vencido)).toEqual([]);
    expect(textoCuidador(asignado)).toBe('Ana López +1');
    expect(textoCuidador(vencido)).toBe(POBLACION_SIN_ASIGNAR);
  });

  it('permite filtrar por ausencia de asignación', () => {
    const conjunto = [asignado, vencido];

    expect(
      filtrarPacientes(
        conjunto,
        { ...POBLACION_FILTROS_VACIOS, profesional: POBLACION_SIN_ASIGNAR },
        CORTE,
      ).map((persona) => persona.id),
    ).toEqual(['vencido']);
    expect(
      filtrarPacientes(
        conjunto,
        { ...POBLACION_FILTROS_VACIOS, cuidador: POBLACION_SIN_ASIGNAR },
        CORTE,
      ).map((persona) => persona.id),
    ).toEqual(['vencido']);
    expect(
      filtrarPacientes(
        conjunto,
        { ...POBLACION_FILTROS_VACIOS, programa: POBLACION_SIN_ASIGNAR },
        CORTE,
      ).map((persona) => persona.id),
    ).toEqual(['vencido']);
  });

  it('nunca elige la condición principal por frecuencia', () => {
    const sinPrincipal = paciente({
      id: 'sin-principal',
      condiciones: [
        {
          nombre: 'Asma',
          activa: true,
          principal: false,
          procedencia: { fuente: 'f', fecha: '2026-01-01', estado: 'Vigente' },
        },
      ],
    });

    expect(condicionPrincipal(sinPrincipal)).toBe(POBLACION_SIN_CONDICION_PRINCIPAL);
    expect(condicionPrincipal(asignado)).toBe(POBLACION_SIN_CONDICION_PRINCIPAL);
  });

  it('enmascara el documento fuera del panel', () => {
    expect(documentoEnmascarado('CC 24.556.812')).toBe('Doc. ···812');
    expect(documentoEnmascarado('sin dígitos')).toBe('Documento reservado');
  });
});

describe('T-12.5 — Universo y deduplicación', () => {
  it('excluye participaciones no activas y repeticiones del mismo identificador', () => {
    const conjunto = [
      paciente({ id: 'uno' }),
      paciente({ id: 'uno' }),
      paciente({ id: 'dos', participacion: 'inactive', estado: 'Inactivo' }),
      paciente({ id: 'tres' }),
    ];

    expect(universoDe(conjunto).map((persona) => persona.id)).toEqual(['uno', 'tres']);
  });
});

describe('T-12.6 — KPI y porcentajes', () => {
  it('calcula los seis indicadores en el orden aprobado', () => {
    const conjunto = [
      paciente({ id: 'a', nacimiento: '1940-01-01' }),
      paciente({
        id: 'b',
        nacimiento: '1990-01-01',
        clasificaciones: [
          {
            tipo: 'HOME_CARE_REQUIRED',
            activa: true,
            desde: '2024-01-01',
            hasta: null,
            procedencia: { fuente: 'f', fecha: '2024-01-01', estado: 'Vigente' },
          },
        ],
        cuidadores: [
          { nombre: 'C', relacion: 'hija', contacto: '300', activo: true, vigente: true },
        ],
        asignaciones: [
          { nombre: 'P', profesion: 'Medicina', principal: true, activa: true, vigente: true },
        ],
      }),
    ];
    const kpi = kpiDe(conjunto, CORTE);

    expect(kpi.map((tarjeta) => tarjeta.id)).toEqual([
      'activePatients',
      'age60Plus',
      'withDisability',
      'homeCareRequired',
      'withoutCaregiver',
      'withoutResponsibleProfessional',
    ]);
    expect(kpi.map((tarjeta) => tarjeta.valor)).toEqual([2, 1, 0, 1, 1, 1]);
  });

  it('devuelve `Sin datos` cuando el denominador es cero', () => {
    expect(porcentaje(0, 0)).toBeNull();
    expect(textoPorcentaje(null)).toBe(POBLACION_SIN_DATOS);
    expect(textoPorcentaje(35.56)).toBe('35,6 %');
    expect(textoPorcentaje(100)).toBe('100,0 %');
    expect(kpiDe([], CORTE).every((tarjeta) => tarjeta.porcentaje === null)).toBe(true);
  });

  it('agrupa los miles sin depender de la configuración regional', () => {
    expect(formatearNumero(3142)).toBe('3.142');
    expect(formatearNumero(7)).toBe('7');
  });
});

describe('T-12.7 — Patologías por paciente único', () => {
  it('cuenta personas, no registros, y admite varias condiciones por persona', () => {
    const procedencia = { fuente: 'f', fecha: '2026-01-01', estado: 'Vigente' };
    const conjunto = [
      paciente({
        id: 'a',
        condiciones: [
          { nombre: 'Artrosis', activa: true, principal: true, procedencia },
          { nombre: 'Artrosis', activa: true, principal: false, procedencia },
          { nombre: 'Asma', activa: true, principal: false, procedencia },
        ],
      }),
      paciente({
        id: 'b',
        condiciones: [{ nombre: 'Artrosis', activa: true, principal: false, procedencia }],
      }),
    ];
    const distribucion = snapshotDePoblacion(conjunto, POBLACION_FILTROS_VACIOS, CORTE)
      .distribuciones.find((item) => item.id === 'patologias');

    expect(distribucion?.celdas.find((celda) => celda.id === 'Artrosis')?.valor).toBe(2);
    expect(distribucion?.celdas.find((celda) => celda.id === 'Asma')?.valor).toBe(1);
  });
});

describe('T-12.8 — Intersecciones disjuntas', () => {
  const conjunto = universoDe(pacientesPoblacionDemo());

  it('define exactamente las ocho combinaciones aprobadas', () => {
    expect(interseccionesDe(conjunto).map((celda) => celda.id)).toEqual([
      'solo-60',
      '60-discapacidad',
      '60-cuidados',
      'discapacidad-cuidados',
      'las-tres',
      'solo-discapacidad',
      'solo-cuidados',
      'ninguna',
    ]);
  });

  it('reconcilia exactamente el universo sin duplicar a nadie', () => {
    const celdas = interseccionesDe(conjunto);
    const suma = celdas.reduce((total, celda) => total + celda.valor, 0);

    expect(suma).toBe(conjunto.length);
  });

  it('coincide con el resultado de combinar los chips rápidos', () => {
    const celdas = interseccionesDe(conjunto);
    const valorDe = (id: string): number =>
      celdas.find((celda) => celda.id === id)?.valor ?? -1;

    const sesentaYDiscapacidad = filtrarPacientes(conjunto, {
      ...POBLACION_FILTROS_VACIOS,
      rapidos: { mayor60: true, discapacidad: true, cuidadosCasa: false },
    });
    const lasTres = filtrarPacientes(conjunto, {
      ...POBLACION_FILTROS_VACIOS,
      rapidos: { mayor60: true, discapacidad: true, cuidadosCasa: true },
    });

    /* `60+ y discapacidad` con y sin cuidados en casa cubre el chip combinado. */
    expect(sesentaYDiscapacidad).toHaveLength(valorDe('60-discapacidad') + valorDe('las-tres'));
    expect(lasTres).toHaveLength(valorDe('las-tres'));
    expect(lasTres.length).toBeGreaterThan(0);
  });

  it('no suma indicadores solapados para obtener la población total', () => {
    const kpi = kpiDe(conjunto);
    const activos = kpi.find((tarjeta) => tarjeta.id === 'activePatients')?.valor ?? 0;
    const solapados = ['age60Plus', 'withDisability', 'homeCareRequired'].reduce(
      (total, id) => total + (kpi.find((tarjeta) => tarjeta.id === id)?.valor ?? 0),
      0,
    );

    expect(solapados).not.toBe(activos);
  });
});

describe('T-12.9 — Conjunto demostrativo, orden y paginación', () => {
  const conjunto = pacientesPoblacionDemo();
  const universo = universoDe(conjunto);

  it('genera más de 3.000 personas con identificadores únicos', () => {
    expect(conjunto).toHaveLength(POBLACION_TOTAL_GENERADO);
    expect(new Set(conjunto.map((persona) => persona.id)).size).toBe(conjunto.length);
    expect(universo.length).toBeGreaterThanOrEqual(3000);
  });

  it('es determinista entre llamadas', () => {
    expect(pacientesPoblacionDemo()).toBe(conjunto);
    expect(kpiDe(universo)).toEqual(kpiDe(universoDe(pacientesPoblacionDemo())));
  });

  it('cubre 0, 1, 2 y 3 clasificaciones prioritarias', () => {
    const celdas = interseccionesDe(universo);

    for (const celda of celdas) {
      expect(celda.valor).toBeGreaterThan(0);
    }
  });

  it('incluye personas con varios cuidadores, varias patologías y ausencias', () => {
    expect(universo.some((persona) => cuidadoresVigentes(persona).length > 1)).toBe(true);
    expect(universo.some((persona) => cuidadoresVigentes(persona).length === 0)).toBe(true);
    expect(universo.some((persona) => persona.condiciones.length > 1)).toBe(true);
    expect(universo.some((persona) => persona.asignaciones.length === 0)).toBe(true);
    expect(universo.some((persona) => persona.proximaAtencion === null)).toBe(true);
  });

  it('ordena de forma total y reversible', () => {
    const ascendente = ordenarPacientes(universo, 'edad', 'asc');
    const descendente = ordenarPacientes(universo, 'edad', 'desc');
    const primera = ascendente[0];
    const ultima = descendente[0];

    expect(primera).toBeDefined();
    expect(ultima).toBeDefined();
    expect(edadEnCorte(primera?.nacimiento ?? '')).toBeLessThanOrEqual(
      edadEnCorte(ultima?.nacimiento ?? ''),
    );
    expect(ascendente).toHaveLength(universo.length);
  });

  it('corrige de forma determinista una página fuera de rango', () => {
    const pagina = paginar(universo, 9999, 50);

    expect(pagina.pagina).toBe(pagina.paginas);
    expect(pagina.hasta).toBe(universo.length);
    expect(paginar([], 1, 50)).toMatchObject({ pagina: 1, paginas: 1, desde: 0, hasta: 0, total: 0 });
  });

  it('deriva las opciones de los selectores del propio universo', () => {
    const opciones = opcionesDeFiltro(universo);

    expect(opciones.condicion).toEqual(['Mayor de 60', 'Discapacidad', 'Cuidados en casa']);
    expect(opciones.profesional.at(-1)).toBe(POBLACION_SIN_ASIGNAR);
    expect(opciones.cuidador.at(-1)).toBe(POBLACION_SIN_ASIGNAR);
    expect(opciones.programa.at(-1)).toBe(POBLACION_SIN_ASIGNAR);
    /* El universo no contiene estados de participación cerrada. */
    expect(opciones.estado).not.toContain('Inactivo');
  });

  it('filtra, ordena y pagina 3.000 registros en menos de 100 ms', () => {
    const inicio = performance.now();
    const filtrados = filtrarPacientes(universo, {
      ...POBLACION_FILTROS_VACIOS,
      rapidos: { mayor60: true, discapacidad: true, cuidadosCasa: false },
    });
    const ordenados = ordenarPacientes(filtrados, 'nombre', 'asc');

    paginar(ordenados, 1, 50);

    expect(performance.now() - inicio).toBeLessThan(100);
  });
});

describe('T-12.10 — Snapshot compartido con Reportes', () => {
  const universo = universoDe(pacientesPoblacionDemo());
  const snapshot = snapshotDePoblacion(universo);

  it('declara versión, corte, contexto y procedencia demostrativa', () => {
    expect(snapshot.version).toBe('population-v1');
    expect(snapshot.fechaCorte).toBe(POBLACION_FECHA_CORTE);
    expect(snapshot.contexto.tenantId).toBe('demo-hospital-san-rafael');
    expect(snapshot.procedencia.clase).toBe('DATO DEMOSTRATIVO');
    expect(snapshot.calculatedAt).toBe('2026-08-20T06:00:00-05:00');
  });

  it('expone universo, KPI, distribuciones e intersecciones coherentes', () => {
    expect(snapshot.universo).toBe(universo.length);
    expect(snapshot.kpi[0]?.valor).toBe(universo.length);
    expect(snapshot.distribuciones.map((distribucion) => distribucion.id)).toEqual([
      'rangos-edad',
      'patologias',
      'eps',
      'municipio',
      'programas',
      'cuidador',
      'profesional',
    ]);
    expect(snapshot.intersecciones).toHaveLength(8);
  });

  it('reconcilia los rangos de edad con el universo', () => {
    const edades = snapshot.distribuciones.find((item) => item.id === 'rangos-edad');
    const suma = (edades?.celdas ?? []).reduce((total, celda) => total + celda.valor, 0);

    expect(suma).toBe(universo.length);
  });

  it('reconcilia con y sin cuidador, y con y sin profesional', () => {
    for (const id of ['cuidador', 'profesional']) {
      const distribucion = snapshot.distribuciones.find((item) => item.id === id);
      const suma = (distribucion?.celdas ?? []).reduce((total, celda) => total + celda.valor, 0);

      expect(suma).toBe(universo.length);
    }
  });
});
