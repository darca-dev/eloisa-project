import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { branding } from '@/config/branding';

import { HospitalPatients } from './HospitalPatients';
import {
  HOSPITAL_POBLACION_AYUDA_DESHABILITADO,
  HOSPITAL_POBLACION_ESTADOS,
  HOSPITAL_POBLACION_NO_DISPONIBLE,
  HOSPITAL_POBLACION_PROCEDENCIA,
  hospitalPoblacionCore,
} from './hospitalPatientsConfig';
import {
  PoblacionBarraListado,
  PoblacionEncabezado,
  PoblacionEstadoFallo,
  PoblacionFiltrosZona,
  PoblacionGrafico,
  PoblacionGraficoNoDisponible,
  PoblacionKpiGrid,
  PoblacionMatriz,
  PoblacionPaginacion,
  PoblacionPanel,
  PoblacionTabla,
  opcionesDesdeAnalitica,
  textoTerritorio,
} from './HospitalPatientsPieces';
import {
  HOSPITAL_FILTROS_VACIOS,
  type HospitalAnaliticaDto,
  type HospitalDetalleDto,
  type HospitalListadoDto,
  type HospitalPacienteListadoDto,
} from './hospitalPatientsClient';
import { textoFechaCorte } from './hospitalPopulationTypes';
import { apariciones, texto } from './hospitalTestUtils';

/**
 * Vista «Pacientes» conectada a CORE-01 (TASK-HOSPITAL-CORE-01 §12.3).
 *
 * ESTRATEGIA. El repositorio no incluye jsdom y esta Task no autoriza
 * dependencias nuevas, de modo que `renderToStaticMarkup` no ejecuta efectos y
 * la vista conectada no puede montarse «ya cargada». La verificación se reparte
 * en tres planos, sin dejar hueco:
 *
 * 1. el CONTENEDOR se comprueba en su primer render —que es exactamente lo que
 *    ve el servidor— y por análisis de su código fuente;
 * 2. las PIEZAS son componentes puros que reciben DTO ya servidos: se montan con
 *    respuestas ficticias y se comprueba el marcado resultante;
 * 3. la SERIALIZACIÓN, la cancelación y el manejo de cada código de estado se
 *    prueban en `hospitalPatientsClient.test.ts`, contra un `fetch` inyectado.
 *
 * Lo que NO queda cubierto por falta de DOM real —eventos de teclado, retorno de
 * foco del panel y verificación automática de accesibilidad— se reporta como no
 * ejecutado en el handoff, sin darlo por aprobado.
 *
 * Todos los datos de estas pruebas son FICTICIOS.
 */

const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));

/* ========================================================================== */
/* Respuestas ficticias                                                       */
/* ========================================================================== */

function paciente(
  overrides: Partial<HospitalPacienteListadoDto> = {},
): HospitalPacienteListadoDto {
  return {
    patientId: '019218ab-0000-7000-8000-000000000001',
    fullName: 'Ana María Ejemplo Ficticio',
    initials: 'AE',
    documentMasked: 'Cédula de ciudadanía ···345',
    age: 76,
    epsCode: 'NUEVA_EPS',
    epsName: 'Nueva EPS',
    priorities: {
      older60: true,
      disabilityDeclared: true,
      homeCareRequiredDeclared: false,
    },
    territory: {
      municipalityOfficialCode: '05001',
      municipalityName: 'Medellín',
      areaType: 'URBAN',
      localUnitName: 'Barrio Ficticio',
      pendingNormalization: false,
    },
    status: 'ACTIVE',
    statusLabel: 'Registro activo',
    ...overrides,
  };
}

const LISTADO: HospitalListadoDto = {
  source: 'ELOISA_POSTGRESQL',
  asOfDate: '2026-08-22',
  generatedAt: '2026-08-22T15:04:05.000Z',
  page: 1,
  pageSize: 50,
  totalItems: 120,
  totalPages: 3,
  items: [
    paciente(),
    paciente({
      patientId: '019218ab-0000-7000-8000-000000000002',
      fullName: 'Bruno Prueba Ficticia',
      initials: 'BP',
      documentMasked: 'Pasaporte ···456',
      age: 30,
      epsName: 'Sanitas',
      priorities: {
        older60: false,
        disabilityDeclared: false,
        homeCareRequiredDeclared: true,
      },
      territory: {
        municipalityOfficialCode: '05001',
        municipalityName: 'Medellín',
        areaType: 'RURAL',
        localUnitName: null,
        pendingNormalization: true,
      },
    }),
    paciente({
      patientId: '019218ab-0000-7000-8000-000000000003',
      fullName: 'Carmen Tercera Ficticia',
      initials: 'CT',
      age: 41,
      priorities: {
        older60: false,
        disabilityDeclared: false,
        homeCareRequiredDeclared: false,
      },
      territory: {
        municipalityOfficialCode: null,
        municipalityName: null,
        areaType: null,
        localUnitName: null,
        pendingNormalization: true,
      },
    }),
  ],
};

const ANALITICA: HospitalAnaliticaDto = {
  source: 'ELOISA_POSTGRESQL',
  asOfDate: '2026-08-22',
  generatedAt: '2026-08-22T15:04:05.000Z',
  definitionVersion: 'population-v1',
  activeUniverse: 120,
  filteredUniverse: 120,
  keyFigures: [
    { key: 'activePatients', label: 'Pacientes activos', value: 120, percentage: 100 },
    { key: 'age60Plus', label: 'Mayores de 60', value: 48, percentage: 40 },
    {
      key: 'withDisability',
      label: 'Con discapacidad declarada',
      value: 24,
      percentage: 20,
    },
    {
      key: 'homeCareRequired',
      label: 'Cuidados en casa declarados',
      value: 12,
      percentage: 10,
    },
  ],
  distributions: [
    {
      id: 'age-ranges',
      label: 'Rangos de edad',
      cells: [
        { key: '0-17', label: '0–17', value: 0, percentage: 0 },
        { key: '60-74', label: '60–74', value: 60, percentage: 50 },
        { key: '75-84', label: '75–84', value: 60, percentage: 50 },
      ],
    },
    {
      id: 'eps',
      label: 'EPS',
      cells: [
        { key: 'NUEVA_EPS', label: 'Nueva EPS', value: 80, percentage: 66.7 },
        { key: 'SANITAS', label: 'Sanitas', value: 40, percentage: 33.3 },
      ],
    },
    {
      id: 'municipality',
      label: 'Municipio',
      cells: [
        { key: '05001', label: 'Medellín', value: 110, percentage: 91.7 },
        {
          key: 'sin-territorio',
          label: 'Sin territorio registrado',
          value: 10,
          percentage: 8.3,
        },
      ],
    },
    {
      id: 'area-type',
      label: 'Área',
      cells: [
        { key: 'URBAN', label: 'Urbana', value: 100, percentage: 83.3 },
        { key: 'RURAL', label: 'Rural', value: 10, percentage: 8.3 },
        {
          key: 'sin-area',
          label: 'Sin territorio registrado',
          value: 10,
          percentage: 8.3,
        },
      ],
    },
  ],
  intersections: [
    { key: 'solo-60', label: 'Solo 60+', value: 30, percentage: 25, older60: true, disabilityDeclared: false, homeCareRequiredDeclared: false },
    { key: '60-discapacidad', label: '60+ y discapacidad', value: 10, percentage: 8.3, older60: true, disabilityDeclared: true, homeCareRequiredDeclared: false },
    { key: '60-cuidados', label: '60+ y cuidados en casa', value: 5, percentage: 4.2, older60: true, disabilityDeclared: false, homeCareRequiredDeclared: true },
    { key: 'discapacidad-cuidados', label: 'Discapacidad y cuidados en casa', value: 5, percentage: 4.2, older60: false, disabilityDeclared: true, homeCareRequiredDeclared: true },
    { key: 'las-tres', label: 'Las tres condiciones', value: 3, percentage: 2.5, older60: true, disabilityDeclared: true, homeCareRequiredDeclared: true },
    { key: 'solo-discapacidad', label: 'Solo discapacidad', value: 6, percentage: 5, older60: false, disabilityDeclared: true, homeCareRequiredDeclared: false },
    { key: 'solo-cuidados', label: 'Solo cuidados en casa', value: 4, percentage: 3.3, older60: false, disabilityDeclared: false, homeCareRequiredDeclared: true },
    { key: 'ninguna', label: 'Ninguna de las tres', value: 57, percentage: 47.5, older60: false, disabilityDeclared: false, homeCareRequiredDeclared: false },
  ],
};

const DETALLE: HospitalDetalleDto = {
  source: 'ELOISA_POSTGRESQL',
  asOfDate: '2026-08-22',
  generatedAt: '2026-08-22T15:04:05.000Z',
  patientId: '019218ab-0000-7000-8000-000000000001',
  fullName: 'Ana María Ejemplo Ficticio',
  initials: 'AE',
  documentType: 'CEDULA_CIUDADANIA',
  documentTypeLabel: 'Cédula de ciudadanía',
  documentMasked: 'Cédula de ciudadanía ···345',
  birthDate: '1950-04-12',
  age: 76,
  epsCode: 'NUEVA_EPS',
  epsName: 'Nueva EPS',
  priorities: { older60: true, disabilityDeclared: true, homeCareRequiredDeclared: false },
  territory: {
    municipalityOfficialCode: '05001',
    municipalityName: 'Medellín',
    areaType: 'URBAN',
    localUnitName: 'Barrio Ficticio',
    pendingNormalization: false,
  },
  status: 'ACTIVE',
  statusLabel: 'Registro activo',
  contactAvailability: 'No disponible con el permiso actual',
};

/* ========================================================================== */
/* T-H1 — Retirada localizada del fixture                                     */
/* ========================================================================== */

describe('T-H1 — La vista deja de depender del conjunto demostrativo', () => {
  /** Módulos del árbol renderizado de Hospital → Pacientes. */
  const ARBOL = [
    'HospitalPatients.tsx',
    'HospitalPatientsPieces.tsx',
    'hospitalPatientsClient.ts',
    'hospitalPatientsConfig.ts',
    'hospitalPopulationTypes.ts',
  ];

  const FUENTES = ARBOL.map((archivo) => ({
    archivo,
    codigo: readFileSync(`${DIRECTORIO}${archivo}`, 'utf8'),
  }));

  it('ningún módulo del árbol importa el fixture de población', () => {
    const infractores = FUENTES.filter(({ codigo }) =>
      /from '\.\/hospitalPopulationFixtures'/u.test(codigo),
    ).map(({ archivo }) => archivo);

    expect(infractores).toStrictEqual([]);
  });

  it('ningún módulo del árbol alcanza el fixture a través de los selectores', () => {
    /*
     * `hospitalPopulationAnalytics.ts` SÍ importa el fixture, de modo que
     * importarlo desde la vista lo arrastraría al paquete del navegador.
     */
    const infractores = FUENTES.filter(({ codigo }) =>
      /from '\.\/hospitalPopulationAnalytics'/u.test(codigo),
    ).map(({ archivo }) => archivo);

    expect(infractores).toStrictEqual([]);
  });

  it('no usa `pacientesPoblacionDemo`, `POBLACION_FECHA_CORTE` ni totales demo', () => {
    for (const { archivo, codigo } of FUENTES) {
      for (const prohibido of [
        'pacientesPoblacionDemo',
        'POBLACION_FECHA_CORTE',
        'POBLACION_TOTAL_GENERADO',
        'POBLACION_TENANT_DEMO',
        'POBLACION_INSTITUCION_DEMO',
        'POBLACION_CALCULATED_AT',
        'snapshotDePoblacion',
      ]) {
        expect(`${archivo}: ${codigo}`).not.toContain(prohibido);
      }
    }
  });

  it('el fixture permanece intacto para las demás vistas ya aprobadas', () => {
    const fixture = readFileSync(`${DIRECTORIO}hospitalPopulationFixtures.ts`, 'utf8');

    // No se borró ni se vació: otras vistas aprobadas lo siguen consumiendo.
    expect(fixture).toContain('export function pacientesPoblacionDemo');
    expect(fixture).toContain('POBLACION_TOTAL_GENERADO = 3240');
  });

  it('no persiste nada ni recurre a una caché del navegador', () => {
    for (const { archivo, codigo } of FUENTES) {
      for (const prohibido of ['localStorage', 'sessionStorage', 'indexedDB', 'caches.']) {
        expect(`${archivo}`).toBe(archivo);
        expect(codigo).not.toContain(prohibido);
      }
    }
  });
});

/* ========================================================================== */
/* T-H2 — Primer render del contenedor                                        */
/* ========================================================================== */

describe('T-H2 — Primer render: consultando, nunca cifras inventadas', () => {
  const HTML = renderToStaticMarkup(<HospitalPatients />);
  const TEXTO = texto(HTML);

  it('monta un único encabezado principal con el título aprobado', () => {
    expect(apariciones(HTML, /<h1\b/gu)).toBe(1);
    expect(TEXTO).toContain('Pacientes');
    expect(TEXTO).toContain('Gestión y segmentación de población atendida');
  });

  it('declara la procedencia REAL y no el badge demostrativo', () => {
    expect(TEXTO).toContain(HOSPITAL_POBLACION_PROCEDENCIA);
    expect(TEXTO).not.toContain('Datos demostrativos');
  });

  it('anuncia la consulta en curso sin publicar ninguna cifra', () => {
    expect(TEXTO).toContain(HOSPITAL_POBLACION_ESTADOS.cargando);
    expect(HTML).toContain('role="status"');

    // Ni totales, ni porcentajes, ni fecha de corte antes de tenerlos.
    expect(TEXTO).not.toContain('pacientes encontrados');
    expect(TEXTO).not.toContain('%');
    expect(TEXTO).not.toContain('Corte ');
  });

  it('no incluye enlaces, formularios, scripts ni recursos remotos', () => {
    expect(HTML).not.toContain('<form');
    expect(HTML).not.toContain('<a ');
    expect(HTML).not.toContain('href');
    expect(HTML).not.toContain('http');
    expect(HTML).not.toContain('<script');
  });

  it('la fecha de corte se redacta desde el valor del servidor', () => {
    expect(textoFechaCorte('2026-08-22')).toBe('Corte 22 de agosto de 2026');
    // Una cadena con forma inesperada no produce una fecha inventada.
    expect(textoFechaCorte('ayer')).toBeNull();
  });
});

/* ========================================================================== */
/* T-H3 — Encabezado y cifras                                                 */
/* ========================================================================== */

describe('T-H3 — Encabezado y cifras disponibles', () => {
  const encabezado = renderToStaticMarkup(
    <PoblacionEncabezado
      titulo="Pacientes"
      descripcion="Gestión y segmentación de población atendida"
      badge={HOSPITAL_POBLACION_PROCEDENCIA}
      corte={textoFechaCorte(LISTADO.asOfDate)}
      tituloId="t"
    />,
  );

  const kpi = renderToStaticMarkup(
    <PoblacionKpiGrid cifras={ANALITICA.keyFigures} etiquetaAccesible="Indicadores" />,
  );

  it('publica la procedencia y la fecha de corte del servidor', () => {
    expect(texto(encabezado)).toContain(HOSPITAL_POBLACION_PROCEDENCIA);
    expect(texto(encabezado)).toContain('Corte 22 de agosto de 2026');
  });

  it('muestra las cuatro cifras que CORE-01 sostiene', () => {
    const contenido = texto(kpi);

    for (const etiqueta of [
      'Pacientes activos',
      'Mayores de 60',
      'Con discapacidad declarada',
      'Cuidados en casa declarados',
    ]) {
      expect(contenido).toContain(etiqueta);
    }

    expect(contenido).toContain('del conjunto filtrado');
  });

  it('«Sin cuidador» y «Sin profesional» conservan su espacio SIN cifra', () => {
    const contenido = texto(kpi);

    expect(contenido).toContain('Sin cuidador');
    expect(contenido).toContain('Sin profesional');

    /*
     * Lo esencial: no se publica un cero ni un porcentaje. Un cero afirmaría que
     * se midió y no hay nadie sin cuidador; CORE-01 no puede distinguir «no
     * tiene» de «no está modelado».
     */
    expect(kpi).toContain('data-no-disponible="true"');
    expect(contenido).toContain(HOSPITAL_POBLACION_NO_DISPONIBLE);
    expect(apariciones(kpi, /data-no-disponible="true"/gu)).toBe(2);
  });
});

/* ========================================================================== */
/* T-H4 — Filtros soportados y no disponibles                                 */
/* ========================================================================== */

describe('T-H4 — Zona de filtros', () => {
  const opciones = opcionesDesdeAnalitica(ANALITICA);
  const zona = (filtros = HOSPITAL_FILTROS_VACIOS, encontrados: number | null = 120): string =>
    renderToStaticMarkup(
      <PoblacionFiltrosZona
        filtros={filtros}
        opciones={opciones}
        opcionesAbiertas={false}
        encontrados={encontrados}
        hayFiltros={false}
        onFiltro={() => undefined}
        onLimpiar={() => undefined}
        onAlternarPanel={() => undefined}
      />,
    );

  const HTML = zona();
  const TEXTO = texto(HTML);

  it('ofrece la búsqueda, el rango de edad y los selectores soportados', () => {
    for (const etiqueta of ['Búsqueda', 'Edad desde', 'Edad hasta', 'Condición', 'EPS', 'Municipio', 'Zona']) {
      expect(TEXTO).toContain(etiqueta);
    }

    expect(apariciones(HTML, /type="number"/gu)).toBe(2);
  });

  it('conserva los selectores no soportados VISIBLES y deshabilitados', () => {
    for (const etiqueta of ['Patología', 'Profesional', 'Cuidador', 'Programa', 'Estado']) {
      expect(TEXTO).toContain(etiqueta);
    }

    // Cinco selectores inertes, cada uno con su ayuda accesible asociada.
    expect(apariciones(HTML, /disabled/gu)).toBeGreaterThanOrEqual(5);
    expect(apariciones(HTML, /data-no-disponible="true"/gu)).toBe(5);
    expect(HTML).toContain('aria-describedby="hospital-poblacion-ayuda-no-disponible"');
    expect(TEXTO).toContain(HOSPITAL_POBLACION_AYUDA_DESHABILITADO);
  });

  it('las opciones de EPS y municipio proceden de la analítica servida', () => {
    expect(opciones.eps).toStrictEqual([
      { valor: 'NUEVA_EPS', etiqueta: 'Nueva EPS' },
      { valor: 'SANITAS', etiqueta: 'Sanitas' },
    ]);

    // `sin-territorio` NO es un municipio y la API no lo admite como filtro.
    expect(opciones.municipio).toStrictEqual([{ valor: '05001', etiqueta: 'Medellín' }]);
  });

  it('ofrece los tres chips rápidos como controles de dos estados', () => {
    expect(HTML).toContain('aria-pressed="false"');
    expect(TEXTO).toContain('60+');
    expect(TEXTO).toContain('Discapacidad');
    expect(TEXTO).toContain('Cuidados en casa');
  });

  it('marca como activo cada chip seleccionado', () => {
    const activos = zona({
      ...HOSPITAL_FILTROS_VACIOS,
      older60: true,
      populationType: 'DISABILITY',
    });

    expect(apariciones(activos, /aria-pressed="true"/gu)).toBe(2);
    expect(texto(activos)).toContain('Filtros (2)');
  });

  it('publica el número de resultados servido por la API', () => {
    expect(TEXTO).toContain('120 pacientes encontrados');
  });

  it('mientras no hay respuesta no muestra un cero, sino la consulta en curso', () => {
    expect(texto(zona(HOSPITAL_FILTROS_VACIOS, null))).toContain('Consultando…');
    expect(texto(zona(HOSPITAL_FILTROS_VACIOS, null))).not.toContain('0 pacientes encontrados');
  });
});

/* ========================================================================== */
/* T-H5 — Listado                                                             */
/* ========================================================================== */

describe('T-H5 — Listado servido', () => {
  const HTML = renderToStaticMarkup(
    <PoblacionTabla
      columnas={hospitalPoblacionCore.columnas}
      filas={LISTADO.items}
      abiertaId={null}
      etiquetaAccesible="Pacientes del conjunto filtrado"
      onVer={() => undefined}
    />,
  );
  const TEXTO = texto(HTML);

  it('conserva las doce columnas aprobadas', () => {
    for (const columna of hospitalPoblacionCore.columnas) {
      expect(TEXTO).toContain(columna.etiqueta);
    }
  });

  it('mantiene una fila por persona, sin tarjetas', () => {
    expect(HTML).not.toContain('<article');
    expect(apariciones(HTML, / la ficha de /gu)).toBe(LISTADO.items.length);
  });

  it('muestra el documento tal como el servidor lo enmascara', () => {
    expect(TEXTO).toContain('Cédula de ciudadanía ···345');
    expect(TEXTO).toContain('Pasaporte ···456');
    // El valor completo no existe en el cliente: no llega del servidor.
    expect(HTML).not.toContain('9999');
  });

  it('las cinco columnas sin dominio en CORE-01 se declaran no disponibles', () => {
    // Cinco por fila: condición, profesional, cuidador, programa y semáforo.
    expect(apariciones(HTML, /data-no-disponible="true"/gu)).toBe(5 * LISTADO.items.length);
    expect(TEXTO).toContain(HOSPITAL_POBLACION_NO_DISPONIBLE);
  });

  it('NUNCA escribe «Sin asignar», un cero ni un semáforo en esas columnas', () => {
    expect(TEXTO).not.toContain('Sin asignar');

    for (const clinico of ['Amarillo', 'Verde', 'Rojo', 'requiere seguimiento']) {
      expect(TEXTO).not.toContain(clinico);
    }
  });

  it('publica el territorio canónico y declara lo pendiente de normalizar', () => {
    expect(TEXTO).toContain('Medellín · Urbana · Barrio Ficticio');
    expect(TEXTO).toContain('Medellín · Rural · Pendiente de normalización');
    expect(TEXTO).toContain('Sin territorio registrado');

    // El texto libre declarado no llega al cliente y no se muestra.
    expect(TEXTO).not.toContain('Localidad Ficticia');
  });

  it('el territorio se redacta de forma determinista', () => {
    expect(textoTerritorio(LISTADO.items[0]!.territory)).toBe(
      'Medellín · Urbana · Barrio Ficticio',
    );
    expect(textoTerritorio(LISTADO.items[2]!.territory)).toBe('Sin territorio registrado');
  });

  it('anuncia el listado con nombre accesible y permite desplazarlo con teclado', () => {
    expect(HTML).toContain('aria-label="Pacientes del conjunto filtrado"');
    expect(HTML).toContain('role="region"');
    expect(HTML).toContain('tabindex="0"');
  });
});

/* ========================================================================== */
/* T-H6 — Orden y paginación                                                  */
/* ========================================================================== */

describe('T-H6 — Orden y paginación server-side', () => {
  const barra = renderToStaticMarkup(
    <PoblacionBarraListado
      total={LISTADO.totalItems}
      tamano={50}
      orden="name"
      sentido="asc"
      onTamano={() => undefined}
      onOrden={() => undefined}
      onSentido={() => undefined}
    />,
  );

  const paginacion = renderToStaticMarkup(
    <PoblacionPaginacion listado={LISTADO} onPagina={() => undefined} />,
  );

  it('ofrece los tres criterios de orden soportados', () => {
    const contenido = texto(barra);

    expect(contenido).toContain('Nombre');
    expect(contenido).toContain('Edad');
    expect(contenido).toContain('Estado');
  });

  it('«Próxima atención» permanece visible y DESHABILITADO', () => {
    // La agenda no existe en CORE-01: ordenar por ella sería un orden inventado.
    expect(barra).toContain('disabled');
    expect(texto(barra)).toContain(`Próxima atención · ${HOSPITAL_POBLACION_NO_DISPONIBLE}`);
  });

  it('publica la página y el rango exactos que devolvió el servidor', () => {
    const contenido = texto(paginacion);

    expect(contenido).toContain('Página 1 de 3');
    expect(contenido).toContain('1–3 de 120');
    expect(contenido).toContain('Anterior');
    expect(contenido).toContain('Siguiente');
  });

  it('inhabilita «Anterior» en la primera página y «Siguiente» en la última', () => {
    expect(apariciones(paginacion, /disabled/gu)).toBe(1);

    const ultima = renderToStaticMarkup(
      <PoblacionPaginacion
        listado={{ ...LISTADO, page: 3, items: LISTADO.items.slice(0, 1) }}
        onPagina={() => undefined}
      />,
    );

    expect(apariciones(ultima, /disabled/gu)).toBe(1);
    expect(texto(ultima)).toContain('Página 3 de 3');
  });

  it('un conjunto vacío publica un rango cero sin fingir resultados', () => {
    const vacio = renderToStaticMarkup(
      <PoblacionPaginacion
        listado={{ ...LISTADO, totalItems: 0, totalPages: 1, items: [] }}
        onPagina={() => undefined}
      />,
    );

    expect(texto(vacio)).toContain('0–0 de 0');
  });
});

/* ========================================================================== */
/* T-H7 — Analítica                                                           */
/* ========================================================================== */

describe('T-H7 — Analítica servida', () => {
  const graficos = ANALITICA.distributions.map((distribucion) =>
    renderToStaticMarkup(
      <PoblacionGrafico
        distribucion={distribucion}
        forma="barras"
        encabezado="Valor"
        nota="Nota de lectura"
        detalle={false}
        onDetalle={() => undefined}
      />,
    ),
  );

  const matriz = renderToStaticMarkup(
    <PoblacionMatriz
      intersecciones={ANALITICA.intersections}
      universo={ANALITICA.filteredUniverse}
    />,
  );

  it('dibuja las cuatro distribuciones que CORE-01 sostiene', () => {
    const contenido = graficos.map((html) => texto(html)).join(' ');

    for (const titulo of ['Rangos de edad', 'EPS', 'Municipio', 'Área']) {
      expect(contenido).toContain(titulo);
    }
  });

  it('acompaña cada valor de su porcentaje como texto, no solo por color', () => {
    expect(texto(graficos[1] ?? '')).toContain('80 · 66,7 %');
    expect(graficos[1]).toContain('aria-hidden="true"');
  });

  it('ofrece la tabla de valores como alternativa accesible', () => {
    const conDetalle = renderToStaticMarkup(
      <PoblacionGrafico
        distribucion={ANALITICA.distributions[0]!}
        forma="barras"
        encabezado="Rango de edad"
        nota="Nota"
        detalle
        onDetalle={() => undefined}
      />,
    );

    expect(conDetalle).toContain('aria-expanded="true"');
    expect(texto(conDetalle)).toContain('Rango de edad Pacientes Porcentaje');
  });

  it('los gráficos sin dominio en CORE-01 declaran su ausencia sin dibujar ceros', () => {
    const noDisponible = renderToStaticMarkup(
      <PoblacionGraficoNoDisponible titulo="Cuidador asignado" />,
    );
    const contenido = texto(noDisponible);

    expect(contenido).toContain('Cuidador asignado');
    expect(contenido).toContain(HOSPITAL_POBLACION_NO_DISPONIBLE);
    expect(contenido).toContain(HOSPITAL_POBLACION_AYUDA_DESHABILITADO);
    expect(noDisponible).toContain('data-no-disponible="true"');

    // Ni barras, ni porcentajes, ni `Ver detalle`: no hay nada que detallar.
    expect(contenido).not.toContain('%');
    expect(contenido).not.toContain('Ver detalle');
  });

  it('publica las ocho intersecciones y su reconciliación con el universo', () => {
    const contenido = texto(matriz);

    for (const etiqueta of ANALITICA.intersections.map((celda) => celda.label)) {
      expect(contenido).toContain(etiqueta);
    }

    expect(contenido).toContain('Universo: 120');
    expect(contenido).toContain('Reconcilia');
  });

  it('lee la pertenencia como texto y no solo por color', () => {
    expect(texto(matriz)).toContain('Sí');
    expect(texto(matriz)).toContain('No');
  });

  it('advierte que los indicadores solapados no se suman', () => {
    expect(texto(matriz)).toContain(
      'Los indicadores solapados no deben sumarse para obtener la población total',
    );
  });

  it('un denominador cero se escribe «Sin datos», nunca «0 %»', () => {
    const sinUniverso = renderToStaticMarkup(
      <PoblacionMatriz
        intersecciones={ANALITICA.intersections.map((celda) => ({
          ...celda,
          value: 0,
          percentage: null,
        }))}
        universo={0}
      />,
    );

    expect(texto(sinUniverso)).toContain('Sin datos');
    expect(texto(sinUniverso)).not.toContain('0,0 %');
  });
});

/* ========================================================================== */
/* T-H8 — Ficha del paciente: composición recuperada, datos reales            */
/* ========================================================================== */

describe('T-H8 — Panel de detalle', () => {
  const HTML = renderToStaticMarkup(
    <PoblacionPanel
      detalle={DETALLE}
      avisoHistoria={hospitalPoblacionCore.avisoHistoria}
      referencia={null}
      onCerrar={() => undefined}
    />,
  );
  const TEXTO = texto(HTML);

  it('se abre como diálogo modal enfocable y con cierre visible', () => {
    expect(HTML).toContain('role="dialog"');
    expect(HTML).toContain('aria-modal="true"');
    expect(HTML).toMatch(/role="dialog"[^>]*tabindex="-1"|tabindex="-1"[^>]*role="dialog"/u);
    expect(TEXTO).toContain('Cerrar');
  });

  /* ---- Jerarquía visual recuperada (HOSPITAL-VISUAL-RECOVERY-01-A) ------- */

  it('recupera la cabecera de ficha: iniciales, nombre y línea de resumen', () => {
    // Las iniciales son las que sirvió el servidor, no unas derivadas aquí.
    expect(TEXTO).toContain(DETALLE.initials);

    // El nombre es el único encabezado de la ficha y titula el diálogo.
    expect(HTML).toContain('id="hospital-poblacion-panel-titulo"');
    expect(HTML).toContain('aria-labelledby="hospital-poblacion-panel-titulo"');
    expect(apariciones(HTML, /<h2\b/gu)).toBe(1);

    // Línea única de la referencia: edad · documento · EPS · municipio.
    expect(TEXTO).toContain('76 años · Cédula de ciudadanía ···345 · Nueva EPS · Medellín');
  });

  it('el lugar del semáforo lo ocupa la procedencia servida, no un estado', () => {
    expect(TEXTO).toContain(HOSPITAL_POBLACION_PROCEDENCIA);
    expect(TEXTO).toContain(textoFechaCorte(DETALLE.asOfDate) ?? 'corte ausente');

    /*
     * Ninguna palabra de semáforo reaparece: la ficha no clasifica el riesgo de
     * la persona y no comunica nada por color.
     */
    for (const tono of ['Amarillo', 'Verde', 'Rojo', 'requiere seguimiento']) {
      expect(TEXTO).not.toContain(tono);
    }
  });

  it('recupera la cuadrícula densa del expediente con valores del DTO', () => {
    for (const etiqueta of [
      'Tipo de documento',
      'Documento (enmascarado)',
      'Fecha de nacimiento',
      'Edad',
      'EPS',
      'Ubicación',
      'Estado del registro',
      'Contacto',
    ]) {
      expect(TEXTO).toContain(etiqueta);
    }

    // Cada valor procede del detalle servido, ninguno se compone aquí.
    expect(TEXTO).toContain(DETALLE.documentTypeLabel);
    expect(TEXTO).toContain(DETALLE.documentMasked);
    expect(TEXTO).toContain(DETALLE.birthDate);
    expect(TEXTO).toContain(DETALLE.epsName);
    expect(TEXTO).toContain(DETALLE.statusLabel);
    expect(TEXTO).toContain('Medellín · Urbana · Barrio Ficticio');
  });

  it('presenta como clasificaciones ÚNICAMENTE las prioridades declaradas', () => {
    expect(HTML).toContain('aria-label="Clasificaciones prioritarias declaradas"');
    expect(TEXTO).toContain('Mayor de 60');
    expect(TEXTO).toContain('Discapacidad');

    // `homeCareRequiredDeclared` es `false` en este detalle: no se dibuja chip.
    expect(apariciones(HTML, /Cuidados en casa/gu)).toBe(1);
  });

  it('sin ninguna prioridad declarada no inventa una condición ni una tarjeta', () => {
    const html = renderToStaticMarkup(
      <PoblacionPanel
        detalle={{
          ...DETALLE,
          priorities: {
            older60: false,
            disabilityDeclared: false,
            homeCareRequiredDeclared: false,
          },
        }}
        avisoHistoria={hospitalPoblacionCore.avisoHistoria}
        referencia={null}
        onCerrar={() => undefined}
      />,
    );

    expect(texto(html)).toContain('Sin clasificación prioritaria declarada');
    expect(html).not.toContain('aria-label="Clasificaciones prioritarias declaradas"');
  });

  it('recupera el bloque de historial SIN ningún evento ni fecha inventada', () => {
    expect(HTML).toContain('id="hospital-poblacion-panel-historial"');
    expect(TEXTO).toContain('Historial');

    /*
     * El bloque conserva su lugar y declara la ausencia de capacidad. No hay
     * hora, ni origen, ni estado: una fila vacía se leería como un hecho.
     */
    expect(TEXTO).toContain(HOSPITAL_POBLACION_NO_DISPONIBLE);
    expect(TEXTO).toContain(HOSPITAL_POBLACION_AYUDA_DESHABILITADO);
    for (const inventado of [
      '15 de agosto',
      '16 de agosto',
      '17 de agosto',
      'Bitácora registrada',
      'Alerta amarilla',
      'Visita domiciliaria realizada',
      'Medicamento ajustado',
      '7:42',
      '10:06',
    ]) {
      expect(TEXTO).not.toContain(inventado);
    }
  });

  it('no reaparece ningún dato del prototipo', () => {
    for (const ficcion of [
      'María Gómez Osorio',
      'CC 24.556.812',
      'Soacha',
      'Nueva EPS · Soacha',
      'Ana López',
      'Rosa Marín',
      'Laura Gómez',
      'Cra 45',
      '310 445 8821',
      '155/90',
      'CUIDADORA',
      'PROFESIONAL ASIGNADO',
      'CÓMO LLEGAR',
    ]) {
      expect(TEXTO).not.toContain(ficcion);
    }
  });

  /* ---- Verdad de los datos, ya verificada antes de la recuperación ------- */

  it('muestra la identificación minimizada que sirvió el servidor', () => {
    expect(TEXTO).toContain('Ana María Ejemplo Ficticio');
    expect(TEXTO).toContain('Cédula de ciudadanía ···345');
    expect(TEXTO).toContain('76 años');
    expect(TEXTO).toContain('1950-04-12');
    expect(TEXTO).toContain('Medellín · Urbana · Barrio Ficticio');
  });

  it('declara el contacto NO DISPONIBLE con el permiso actual', () => {
    expect(TEXTO).toContain('No disponible con el permiso actual');
    expect(HTML).toContain('data-no-disponible="true"');
  });

  it('declara no disponibles los dominios que CORE-01 no modela', () => {
    for (const etiqueta of [
      'Condición principal',
      'Patologías registradas',
      'Profesional responsable',
      'Cuidador',
      'Programa',
      'Próxima atención',
      'Últimas atenciones',
      'Alertas y semaforización',
    ]) {
      expect(TEXTO).toContain(etiqueta);
    }

    // Ninguno se rellena con un dato, un cero ni un semáforo.
    expect(TEXTO).toContain(HOSPITAL_POBLACION_NO_DISPONIBLE);
    expect(TEXTO).not.toContain('Sin asignar');
    expect(TEXTO).not.toContain('Amarillo');
  });

  it('cada campo no disponible explica por qué DENTRO del diálogo modal', () => {
    /*
     * El panel es `aria-modal`: una ayuda situada en la zona de filtros quedaría
     * fuera del subárbol expuesto. La explicación se repite dentro del diálogo.
     */
    expect(HTML).toContain('id="hospital-poblacion-panel-ayuda"');
    expect(HTML).toContain('aria-describedby="hospital-poblacion-panel-ayuda"');
  });

  it('presenta las clasificaciones declaradas con su procedencia real', () => {
    expect(TEXTO).toContain('Declarada por la persona en su inscripción');
    expect(TEXTO).toContain('Derivada de la fecha de nacimiento a la fecha de corte 2026-08-22');
    expect(TEXTO).toContain('no son diagnósticos ni certificaciones oficiales');
  });

  it('usa la marca visible centralizada y no la terminología interna', () => {
    expect(TEXTO).toContain(`${branding.platformDisplayName} no reemplaza la historia clínica`);
    expect(TEXTO.toLocaleUpperCase('es-CO')).not.toContain('MERDN');
  });

  it('no ofrece editar, eliminar, descargar ni exportar', () => {
    for (const prohibido of ['Editar', 'Eliminar', 'Descargar', 'Exportar', 'download', 'href']) {
      expect(HTML).not.toContain(prohibido);
    }
  });
});

/* ========================================================================== */
/* T-H9 — Estados de fallo                                                    */
/* ========================================================================== */

describe('T-H9 — Estados de fallo', () => {
  it('401 pide sesión institucional y NO ofrece reintento', () => {
    const html = renderToStaticMarkup(
      <PoblacionEstadoFallo
        titulo={HOSPITAL_POBLACION_ESTADOS.sinSesion}
        detalle={HOSPITAL_POBLACION_ESTADOS.sinSesionDetalle}
      />,
    );

    expect(texto(html)).toContain('Sesión institucional requerida');
    expect(html).toContain('role="alert"');
    // Repetir la consulta no cambiaría el desenlace.
    expect(texto(html)).not.toContain('Reintentar');
  });

  it('403 declara la falta de permiso y NO ofrece reintento', () => {
    const html = renderToStaticMarkup(
      <PoblacionEstadoFallo
        titulo={HOSPITAL_POBLACION_ESTADOS.sinPermiso}
        detalle={HOSPITAL_POBLACION_ESTADOS.sinPermisoDetalle}
      />,
    );

    expect(texto(html)).toContain('Sin permiso para consultar pacientes');
    expect(texto(html)).not.toContain('Reintentar');
  });

  it('un error recuperable sí ofrece reintentar y no muestra cifras previas', () => {
    const html = renderToStaticMarkup(
      <PoblacionEstadoFallo
        titulo={HOSPITAL_POBLACION_ESTADOS.error}
        detalle={HOSPITAL_POBLACION_ESTADOS.errorDetalle}
        onReintentar={() => undefined}
      />,
    );
    const contenido = texto(html);

    expect(contenido).toContain('No fue posible consultar los pacientes');
    expect(contenido).toContain('Reintentar');
    expect(contenido).toContain('No se muestran cifras anteriores ni datos de demostración');
    expect(contenido).not.toContain('%');
  });

  it('ningún estado de fallo publica un dato nominal', () => {
    for (const estado of ['sinSesion', 'sinPermiso', 'error'] as const) {
      const html = renderToStaticMarkup(
        <PoblacionEstadoFallo
          titulo={HOSPITAL_POBLACION_ESTADOS[estado]}
          detalle={HOSPITAL_POBLACION_ESTADOS[`${estado}Detalle`]}
        />,
      );

      expect(texto(html)).not.toContain('Ana María');
      expect(texto(html)).not.toContain('···');
    }
  });
});

/* ========================================================================== */
/* T-H10 — Alcance y seguridad visual                                         */
/* ========================================================================== */

describe('T-H10 — Alcance y seguridad visual', () => {
  it('la nota declara qué es dato declarado y qué módulos no están conectados', () => {
    expect(hospitalPoblacionCore.nota).toContain('DECLARADOS');
    expect(hospitalPoblacionCore.nota).toContain('no son diagnósticos');
    expect(hospitalPoblacionCore.nota).toContain('no están conectados');
  });

  it('mantiene la declaración sobre la salida autorizada a la Alcaldía', () => {
    expect(hospitalPoblacionCore.avisoAlcaldia).toContain(
      'su salida autorizada es únicamente información agregada',
    );
  });

  it('el texto de no disponible es único y distinto de una ausencia real', () => {
    expect(HOSPITAL_POBLACION_NO_DISPONIBLE).toBe('Información no disponible');

    /*
     * No se confunde con «Sin asignar» —que afirmaría que se comprobó— ni con
     * una cifra medida: el texto no contiene ningún número suelto ni porcentaje.
     */
    expect(HOSPITAL_POBLACION_NO_DISPONIBLE).not.toContain('Sin asignar');
    expect(HOSPITAL_POBLACION_NO_DISPONIBLE).not.toContain('%');
    expect(/(?:^|\s)\d+(?:\s|$)/u.test(HOSPITAL_POBLACION_NO_DISPONIBLE)).toBe(false);
  });
});
