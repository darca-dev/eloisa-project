import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HospitalProfessionals, ProfesionalesEstado } from './HospitalProfessionals';
import {
  HOSPITAL_ESTADOS_PERFIL,
  HOSPITAL_PROFESIONALES_NO_DISPONIBLE,
  HOSPITAL_PROFESIONES,
  HOSPITAL_TIPOS_VINCULO,
  hospitalProfesionalesCore,
} from './hospitalProfessionalsConfig';
import {
  HOSPITAL_PROFESIONALES_FILTROS_VACIOS,
  serializarProfesionales,
  type HospitalProfesionalDetalleDto,
  type HospitalProfesionalListadoDto,
  type HospitalProfesionalesListaDto,
} from './hospitalProfessionalsClient';
import {
  estadoPerfil,
  etiquetaEstadoVinculo,
  etiquetaProfesion,
  etiquetaVinculo,
  ofreceReintento,
  rangoDePagina,
  textoDeEstado,
  textoFecha,
  textoInstante,
} from './hospitalProfessionalsListado';
import { ProfessionalDetailPanel } from './ProfessionalDetailPanel';
import { apariciones, texto } from './hospitalTestUtils';

/**
 * Vista «Profesionales» conectada a CORE-02
 * (TASK-HOSPITAL-CORE-02 §3.1; paquete de continuación §5).
 *
 * ESTRATEGIA. El repositorio no incluye jsdom y esta Task no autoriza
 * dependencias nuevas, de modo que `renderToStaticMarkup` no ejecuta efectos.
 * La verificación se reparte en tres planos, sin dejar hueco:
 *
 * 1. el CONTENEDOR se comprueba en su primer render —que es exactamente lo que
 *    ve el servidor—, con el DTO inyectado por propiedad, y por análisis de su
 *    código fuente;
 * 2. las PIEZAS y los helpers son puros: reciben DTO ya servidos o valores
 *    explícitos y se comprueba su salida;
 * 3. la SERIALIZACIÓN, la cancelación y el manejo de cada código de estado se
 *    prueban en `hospitalProfessionalsClient.test.ts`, contra un `fetch`
 *    inyectado.
 *
 * Lo que NO queda cubierto por falta de DOM real —eventos de teclado, retorno de
 * foco del panel, descarte efectivo de una respuesta tardía dentro del efecto y
 * verificación automática de accesibilidad— se reporta como no ejecutado en el
 * handoff, sin darlo por aprobado.
 *
 * Todos los datos de estas pruebas son FICTICIOS.
 */

const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));

/* ========================================================================== */
/* Respuestas ficticias                                                       */
/* ========================================================================== */

function profesional(
  overrides: Partial<HospitalProfesionalListadoDto> = {},
): HospitalProfesionalListadoDto {
  return {
    professionalId: '019218cd-0000-7000-8000-000000000001',
    fullName: 'Ana Ficticia Ejemplo',
    initials: 'AE',
    professionCode: 'MEDICINA_GENERAL',
    professionName: 'Medicina general',
    status: 'ACTIVE',
    activeAffiliation: {
      engagementType: 'EMPLOYEE',
      status: 'ACTIVE',
      startsOn: '2026-01-15',
      endsOn: null,
    },
    activePatientCount: 7,
    todayAppointmentCount: 3,
    nextAppointmentAt: '2026-08-22T14:30:00.000Z',
    ratingAvailability: HOSPITAL_PROFESIONALES_NO_DISPONIBLE,
    ...overrides,
  };
}

const LISTA: HospitalProfesionalesListaDto = {
  source: 'ELOISA_POSTGRESQL',
  generatedAt: '2026-08-22T15:04:05.000Z',
  page: 2,
  pageSize: 25,
  totalItems: 60,
  totalPages: 3,
  items: [
    profesional(),
    profesional({
      professionalId: '019218cd-0000-7000-8000-000000000002',
      fullName: 'Bruno Prueba Ficticia',
      initials: 'BP',
      professionCode: 'ENFERMERIA',
      professionName: 'Enfermería',
      status: 'INACTIVE',
      activeAffiliation: null,
      activePatientCount: 0,
      todayAppointmentCount: 0,
      nextAppointmentAt: null,
    }),
  ],
};

const VACIA: HospitalProfesionalesListaDto = {
  ...LISTA,
  page: 1,
  totalItems: 0,
  totalPages: 0,
  items: [],
};

const DETALLE: HospitalProfesionalDetalleDto = {
  ...profesional(),
  source: 'ELOISA_POSTGRESQL',
  generatedAt: '2026-08-22T15:04:05.000Z',
  window: { from: '2026-08-22', to: '2026-08-22' },
  assignedPatients: [
    {
      patientId: '019218ab-0000-7000-8000-000000000001',
      fullName: 'Carmen Paciente Ficticia',
      initials: 'CP',
    },
  ],
  appointments: [
    {
      appointmentId: '019218ef-0000-7000-8000-000000000001',
      patient: {
        patientId: '019218ab-0000-7000-8000-000000000001',
        fullName: 'Carmen Paciente Ficticia',
        initials: 'CP',
      },
      modality: 'HOME',
      status: 'ASSIGNED',
      scheduledStart: '2026-08-22T14:30:00.000Z',
    },
    {
      appointmentId: '019218ef-0000-7000-8000-000000000002',
      patient: {
        patientId: '019218ab-0000-7000-8000-000000000002',
        fullName: 'Diego Paciente Ficticio',
        initials: 'DP',
      },
      modality: 'VIRTUAL',
      status: 'REQUESTED',
      scheduledStart: null,
    },
  ],
};

const COPY = hospitalProfesionalesCore;

function vista(
  props: Parameters<typeof HospitalProfessionals>[0] = {},
): string {
  return renderToStaticMarkup(<HospitalProfessionals {...props} />);
}

/* ========================================================================== */
/* Plano 1 — El árbol runtime dejó de depender de los fixtures                */
/* ========================================================================== */

describe('T-P1 — Sin fixtures, sin repliegue y sin persistencia', () => {
  const ARBOL = [
    'HospitalProfessionals.tsx',
    'ProfessionalDetailPanel.tsx',
    'ProfessionalEngagementPanel.tsx',
    'hospitalProfessionalsListado.ts',
    'hospitalProfessionalsConfig.ts',
  ];

  const FUENTES = ARBOL.map((archivo) => ({
    archivo,
    codigo: readFileSync(`${DIRECTORIO}${archivo}`, 'utf8'),
  }));

  it('ningún módulo del árbol importa fixtures de otras vistas', () => {
    const infractores = FUENTES.filter(({ codigo }) =>
      /from '\.\/hospital(?:Population|Visits|Virtual|Financial|Alerts|Dashboard)\w*'/u.test(
        codigo,
      ),
    ).map(({ archivo }) => archivo);

    expect(infractores).toEqual([]);
  });

  it('no queda rastro de `hospitalProfesionalesDemo` ni de `config.fichas`', () => {
    for (const { archivo, codigo } of FUENTES) {
      /*
       * Se busca el USO, no la palabra: `hospitalProfessionalsConfig.ts`
       * documenta en prosa por qué se retiraron las fichas, y esa explicación
       * debe poder escribirse sin hacer fallar la comprobación.
       */
      expect(
        `${archivo}: ${String(/hospitalProfesionalesDemo|\.fichas\b|fichas:/u.test(codigo))}`,
      ).toBe(`${archivo}: false`);
    }
  });

  it('no persiste nada ni recurre a una caché del navegador', () => {
    for (const { archivo, codigo } of FUENTES) {
      expect(
        `${archivo}: ${String(/localStorage|sessionStorage|indexedDB|document\.cookie/u.test(codigo))}`,
      ).toBe(`${archivo}: false`);
    }
  });

  it('la vista consulta al cliente y NUNCA llama a la red por su cuenta', () => {
    const codigo = FUENTES[0]?.codigo ?? '';

    expect(codigo).toContain('consultarProfesionales(');
    expect(codigo).toContain('consultarProfesional(');
    expect(codigo).toContain('serializarProfesionales(');
    // Recibe la implementación y se la entrega al cliente; no la invoca.
    expect(/\bfetch\s*\(|\bfetchImpl\s*\(/u.test(codigo)).toBe(false);
  });

  it('cada consulta se cancela y descarta las respuestas que ya no son vigentes', () => {
    const codigo = FUENTES[0]?.codigo ?? '';

    expect(apariciones(codigo, /new AbortController\(\)/gu)).toBe(2);
    expect(apariciones(codigo, /controller\.abort\(\)/gu)).toBe(2);
    expect(apariciones(codigo, /if \(!vigente \|\| resultado\.kind === 'cancelado'\)/gu)).toBe(2);
  });

  it('ante fallo limpia el estado nominal en lugar de conservarlo', () => {
    const codigo = FUENTES[0]?.codigo ?? '';
    const fallo = /setLista\(null\);\s*setAbiertaId\(null\);\s*setDetalle\(null\);/u;

    expect(fallo.test(codigo)).toBe(true);
  });

  it('no construye fechas: la redacción es determinista por corte de cadena', () => {
    for (const { archivo, codigo } of FUENTES) {
      expect(`${archivo}: ${String(/new Date|Date\.now/u.test(codigo))}`).toBe(
        `${archivo}: false`,
      );
    }
  });
});

/* ========================================================================== */
/* Plano 2 — Primer render y estados                                          */
/* ========================================================================== */

describe('T-P2 — Primer render: consultando, nunca cifras inventadas', () => {
  const HTML = vista();
  const TEXTO = texto(HTML);

  it('monta un único encabezado principal con el título aprobado', () => {
    expect(apariciones(HTML, /<h1\b/gu)).toBe(1);
    expect(TEXTO).toContain(COPY.encabezado.titulo);
  });

  it('anuncia la consulta en curso sin publicar ninguna persona ni cifra', () => {
    expect(TEXTO).toContain(COPY.estados.cargando);
    expect(HTML).toContain('role="status"');
    expect(HTML).not.toContain('<table');
    expect(TEXTO).not.toMatch(/\d+ profesionales/u);
  });

  it('conserva la nota de alcance en todos los desenlaces', () => {
    expect(TEXTO).toContain(COPY.nota);
  });

  it('no incluye enlaces, formularios ni recursos remotos', () => {
    expect(HTML).not.toContain('<form');
    expect(HTML).not.toContain('href');
    expect(HTML).not.toContain('<script');
    expect(HTML).not.toContain('http');
  });
});

describe('T-P3 — Estados de fallo: 400, 401, 403, 503 y reintento', () => {
  it('cada desenlace tiene su texto propio y ninguno repite otro', () => {
    const textos = (
      [
        'sin-sesion',
        'sin-permiso',
        'no-encontrado',
        'consulta-invalida',
        'no-disponible',
        'error',
      ] as const
    ).map((estado) => textoDeEstado(COPY.estados, estado));

    expect(new Set(textos).size).toBe(textos.length);
    expect(textos.every((valor) => valor.length > 0)).toBe(true);
  });

  it('401 y 403 NO ofrecen reintento; 400, 503 y error sí', () => {
    expect(ofreceReintento('sin-sesion')).toBe(false);
    expect(ofreceReintento('sin-permiso')).toBe(false);
    expect(ofreceReintento('no-encontrado')).toBe(false);
    expect(ofreceReintento('consulta-invalida')).toBe(true);
    expect(ofreceReintento('no-disponible')).toBe(true);
    expect(ofreceReintento('error')).toBe(true);
  });

  it('el estado se anuncia como región viva y sin datos stale', () => {
    const html = renderToStaticMarkup(
      <ProfesionalesEstado texto={COPY.estados.noDisponible} />,
    );

    expect(html).toContain('role="status"');
    expect(texto(html)).toBe(COPY.estados.noDisponible);
    expect(html).not.toContain('<button');
  });

  it('el reintento es un botón real cuando el desenlace lo admite', () => {
    const html = renderToStaticMarkup(
      <ProfesionalesEstado
        texto={COPY.estados.error}
        reintentar={COPY.estados.reintentar}
        onReintentar={() => undefined}
      />,
    );

    expect(html).toContain('<button type="button"');
    expect(texto(html)).toContain(COPY.estados.reintentar);
  });
});

/* ========================================================================== */
/* Plano 2 — Listado servido                                                  */
/* ========================================================================== */

describe('T-P4 — Directorio de tarjetas servido por la API', () => {
  const HTML = vista({ listaInicial: LISTA });
  const TEXTO = texto(HTML);

  it('monta una tarjeta por profesional servido, sin tabla de columnas', () => {
    expect(HTML).not.toContain('<table');
    expect(apariciones(HTML, /<ul\b/gu)).toBe(1);
    expect(apariciones(HTML, /<li\b/gu)).toBe(LISTA.items.length);

    for (const item of LISTA.items) {
      expect(TEXTO).toContain(item.fullName);
    }
  });

  it('cada tarjeta encabeza con el nombre y lo acompaña de la profesión servida', () => {
    expect(apariciones(HTML, /<h3\b/gu)).toBe(LISTA.items.length);

    for (const item of LISTA.items) {
      expect(TEXTO).toContain(etiquetaProfesion(item.professionCode, item.professionName));
    }
  });

  it('publica el estado del PERFIL de cada persona, como texto y no solo color', () => {
    expect(TEXTO).toContain(estadoPerfil('ACTIVE').etiqueta);
    expect(TEXTO).toContain(estadoPerfil('INACTIVE').etiqueta);
  });

  it('el vínculo declarado se publica con su tipo, su estado y sus fechas', () => {
    const vinculo = LISTA.items[0]?.activeAffiliation;

    expect(TEXTO).toContain(COPY.panel.etiquetaTipo);
    expect(TEXTO).toContain(etiquetaVinculo('EMPLOYEE'));
    expect(TEXTO).toContain(COPY.panel.etiquetaEstadoVinculo);
    expect(TEXTO).toContain(etiquetaEstadoVinculo('ACTIVE'));
    expect(TEXTO).toContain(textoFecha(vinculo?.startsOn ?? null));
    expect(TEXTO).toContain(COPY.panel.etiquetaFin);
  });

  it('publica el total servido y el rango exacto de la página', () => {
    const rango = rangoDePagina(LISTA);

    expect(rango).toEqual({ desde: 26, hasta: 27 });
    expect(TEXTO).toContain(`${String(LISTA.totalItems)} ${COPY.resumen}`);
    expect(TEXTO).toContain('26–27 de 60 · página 2 de 3');
  });

  it('la paginación habilita ambos extremos según la página servida', () => {
    const primera = vista({ listaInicial: { ...LISTA, page: 1 } });
    const ultima = vista({ listaInicial: { ...LISTA, page: 3 } });

    expect(apariciones(primera, /<button type="button"[^>]*disabled/gu)).toBe(1);
    expect(apariciones(ultima, /<button type="button"[^>]*disabled/gu)).toBe(1);
    expect(apariciones(HTML, /<button type="button"[^>]*disabled/gu)).toBe(0);
  });

  it('ninguna métrica por persona llega al marcado, aunque venga servida', () => {
    /*
     * Los valores son deliberadamente irrepetibles: si alguno apareciera en el
     * marcado, procedería de la tarjeta y no de la paginación ni de una fecha.
     * Comprueba de una vez que pacientes, citas de hoy, próxima cita y
     * calificación NO se publican pese a viajar en la respuesta.
     */
    const MARCADO = texto(
      vista({
        listaInicial: {
          ...LISTA,
          items: [
            profesional({
              activePatientCount: 9917,
              todayAppointmentCount: 8823,
              nextAppointmentAt: '2026-12-31T23:45:00.000Z',
              ratingAvailability: 'CALIFICACION_QUE_NO_DEBE_VERSE',
            }),
          ],
        },
      }),
    );

    expect(MARCADO).not.toContain('9917');
    expect(MARCADO).not.toContain('8823');
    expect(MARCADO).not.toContain('31/12/2026');
    expect(MARCADO).not.toContain('CALIFICACION_QUE_NO_DEBE_VERSE');
  });

  it('no rotula calificación, pacientes asignados, citas de hoy ni próxima cita', () => {
    expect(TEXTO).not.toContain('Calificación');
    expect(TEXTO).not.toContain('Pacientes asignados');
    expect(TEXTO).not.toContain('Citas registradas hoy');
    expect(TEXTO).not.toContain('Próxima');
    expect(TEXTO).not.toContain(' de 5');
    expect(TEXTO).not.toMatch(/\b[0-5][.,]\d\b/u);
  });

  it('no ofrece abrir la agenda de una persona: esa capacidad no existe', () => {
    expect(TEXTO).not.toContain('Ver agenda del profesional');
    expect(TEXTO).not.toContain('agenda del profesional');
  });

  it('quien no tiene vínculo vigente lo declara en lugar de inventarlo', () => {
    expect(TEXTO).toContain(COPY.panel.sinVinculo);
  });

  it('un dato ausente se declara con copy de producto y no se convierte en cero', () => {
    expect(textoInstante(null)).toBe(HOSPITAL_PROFESIONALES_NO_DISPONIBLE);
    expect(textoFecha(null)).toBe(HOSPITAL_PROFESIONALES_NO_DISPONIBLE);
    expect(HOSPITAL_PROFESIONALES_NO_DISPONIBLE).toBe('Sin información registrada');
    // El vínculo sin fecha de fin lo declara así en la propia tarjeta.
    expect(TEXTO).toContain(HOSPITAL_PROFESIONALES_NO_DISPONIBLE);
  });

  it('no publica zona, disponibilidad ni conflicto de agenda', () => {
    expect(TEXTO).not.toContain('Zona');
    expect(TEXTO).not.toContain('Comuna');
    expect(TEXTO).not.toContain('Disponible');
    expect(TEXTO).not.toContain('En visita');
    expect(TEXTO).not.toContain('Fuera de turno');
    expect(TEXTO).not.toContain('conflicto');
  });
});

describe('T-P5 — Vacío inicial frente a sin resultados', () => {
  it('sin filtros y sin equipo, declara que la institución no registró a nadie', () => {
    const TEXTO = texto(vista({ listaInicial: VACIA }));

    expect(TEXTO).toContain(COPY.estados.vacio);
    expect(TEXTO).not.toContain(COPY.estados.sinResultados);
  });

  it('con filtros aplicados y sin coincidencias, lo dice de otra manera', () => {
    const TEXTO = texto(
      vista({ listaInicial: VACIA, filtrosIniciales: { professionCode: 'ENFERMERIA' } }),
    );

    expect(TEXTO).toContain(COPY.estados.sinResultados);
    expect(TEXTO).not.toContain(COPY.estados.vacio);
  });

  it('con filtros aplicados ofrece limpiarlos', () => {
    const TEXTO = texto(
      vista({ listaInicial: LISTA, filtrosIniciales: { status: 'ACTIVE' } }),
    );

    expect(TEXTO).toContain(COPY.busqueda.limpiar);
  });
});

/* ========================================================================== */
/* Plano 2 y 3 — Filtros server-side                                          */
/* ========================================================================== */

describe('T-P6 — Búsqueda y filtros resueltos en el servidor', () => {
  const HTML = vista({ listaInicial: LISTA });

  it('ofrece los tres filtros que la API admite y ninguno más', () => {
    expect(apariciones(HTML, /<select\b/gu)).toBe(3);
    expect(HTML).toContain('id="hospital-profesionales-filtro-profesion"');
    expect(HTML).toContain('id="hospital-profesionales-filtro-vinculo"');
    expect(HTML).toContain('id="hospital-profesionales-filtro-estado"');
    expect(HTML).not.toContain('filtro-zona');
  });

  it('las opciones proceden del catálogo controlado, no de los datos servidos', () => {
    const TEXTO = texto(HTML);

    for (const profesion of HOSPITAL_PROFESIONES) {
      expect(TEXTO).toContain(profesion.etiqueta);
    }

    for (const tipo of HOSPITAL_TIPOS_VINCULO) {
      expect(TEXTO).toContain(tipo.etiqueta);
    }

    for (const estado of HOSPITAL_ESTADOS_PERFIL) {
      expect(TEXTO).toContain(estado.etiqueta);
    }
  });

  it('el buscador está etiquetado y declara que la búsqueda es del servidor', () => {
    expect(HTML).toContain('aria-describedby="hospital-profesionales-buscador-ayuda"');
    expect(texto(HTML)).toContain(COPY.busqueda.ayuda);
  });

  it('la paginación y los filtros producen la consulta que la API espera', () => {
    const consulta = serializarProfesionales(
      { ...HOSPITAL_PROFESIONALES_FILTROS_VACIOS, professionCode: 'ENFERMERIA', status: 'ACTIVE' },
      2,
      25,
      'name',
      'asc',
    );

    expect(consulta.toString()).toBe(
      'professionCode=ENFERMERIA&status=ACTIVE&page=2&pageSize=25&sort=name&direction=asc',
    );
  });

  it('un filtro vacío se OMITE en lugar de viajar en blanco', () => {
    const consulta = serializarProfesionales(
      HOSPITAL_PROFESIONALES_FILTROS_VACIOS,
      1,
      25,
      'name',
      'asc',
    );

    expect(consulta.toString()).toBe('page=1&pageSize=25&sort=name&direction=asc');
  });

  it('la consulta serializada NUNCA contiene un parámetro fuera de la allowlist', () => {
    /*
     * Zona, disponibilidad y calificación no están modeladas: enviarlas
     * produciría un `400` además de sugerir un dominio inexistente. La
     * comprobación es sobre las CLAVES efectivamente serializadas, no sobre el
     * texto del archivo, que sí puede nombrarlas para explicar su ausencia.
     */
    const permitidas = new Set([
      'search',
      'professionCode',
      'affiliationType',
      'status',
      'page',
      'pageSize',
      'sort',
      'direction',
    ]);
    const consulta = serializarProfesionales(
      {
        ...HOSPITAL_PROFESIONALES_FILTROS_VACIOS,
        search: '  Ana   Ficticia  ',
        professionCode: 'ENFERMERIA',
        affiliationType: 'THIRD_PARTY',
        status: 'INACTIVE',
      },
      3,
      50,
      'profession',
      'desc',
    );

    expect([...consulta.keys()].filter((clave) => !permitidas.has(clave))).toEqual([]);
    // La búsqueda viaja normalizada: ni espacios dobles ni bordes.
    expect(consulta.get('search')).toBe('Ana Ficticia');
  });
});

/* ========================================================================== */
/* Plano 2 — Panel de detalle                                                 */
/* ========================================================================== */

describe('T-P7 — Panel de detalle remoto', () => {
  const HTML = renderToStaticMarkup(
    <ProfessionalDetailPanel detalle={DETALLE} copy={COPY} onCerrar={() => undefined} />,
  );
  const TEXTO = texto(HTML);

  it('es enfocable por programa y ofrece un cierre visible', () => {
    expect(HTML).toContain('id="hospital-profesionales-detalle"');
    expect(HTML).toContain('tabindex="-1"');
    expect(TEXTO).toContain(COPY.panel.cerrar);
  });

  it('publica, rotulada, la ventana que consultó el SERVIDOR', () => {
    expect(TEXTO).toContain(`${COPY.panel.etiquetaVentana}: 22/08/2026`);
  });

  it('tampoco el detalle publica métricas por persona ni calificación', () => {
    const html = renderToStaticMarkup(
      <ProfessionalDetailPanel
        detalle={{
          ...DETALLE,
          activePatientCount: 9917,
          todayAppointmentCount: 8823,
          nextAppointmentAt: '2026-12-31T23:45:00.000Z',
          ratingAvailability: 'CALIFICACION_QUE_NO_DEBE_VERSE',
        }}
        copy={COPY}
        onCerrar={() => undefined}
      />,
    );
    const marcado = texto(html);

    expect(marcado).not.toContain('9917');
    expect(marcado).not.toContain('8823');
    expect(marcado).not.toContain('31/12/2026');
    expect(marcado).not.toContain('CALIFICACION_QUE_NO_DEBE_VERSE');
    expect(marcado).not.toContain('Calificación');
  });

  it('las personas a cargo proceden del DTO y llevan su advertencia', () => {
    expect(TEXTO).toContain('Carmen Paciente Ficticia');
    expect(TEXTO).toContain(COPY.panel.notaPacientes);
  });

  it('la agenda del profesional publica cada cita servida y su estado', () => {
    expect(TEXTO).toContain('22/08/2026, 14:30 UTC');
    expect(TEXTO).toContain('En domicilio');
    expect(TEXTO).toContain('Asignada');
    expect(TEXTO).toContain('Virtual');
    expect(TEXTO).toContain('Solicitada');
    expect(TEXTO).toContain(COPY.panel.sinHora);
  });

  it('el vínculo declarado se publica sin afirmar contrato ni nómina', () => {
    expect(TEXTO).toContain(etiquetaVinculo('EMPLOYEE'));
    expect(TEXTO).toContain(etiquetaEstadoVinculo('ACTIVE'));
    expect(TEXTO).toContain('15/01/2026');
    expect(TEXTO).toContain(COPY.panel.etiquetaFin);
  });

  it('los campos no modelados se declaran neutrales, uno por uno', () => {
    for (const etiqueta of COPY.panel.noModelados) {
      expect(TEXTO).toContain(etiqueta);
    }

    expect(apariciones(HTML, new RegExp(HOSPITAL_PROFESIONALES_NO_DISPONIBLE, 'gu')).valueOf()
      >= COPY.panel.noModelados.length).toBe(true);
  });

  it('no publica documentos, salario, honorarios ni modalidad de cobro', () => {
    expect(TEXTO).not.toContain('Salario');
    expect(TEXTO).not.toContain('Honorarios');
    expect(TEXTO).not.toContain('Modalidad de cobro');
    expect(TEXTO).not.toContain('Próximamente');
    expect(TEXTO).not.toContain('Gestión financiera');
  });

  it('las acciones fuera de alcance están deshabilitadas y no llaman a la red', () => {
    for (const accion of COPY.panel.acciones) {
      expect(TEXTO).toContain(accion.etiqueta);
    }

    expect(apariciones(HTML, /<button type="button" disabled/gu)).toBe(
      COPY.panel.acciones.length,
    );
    expect(TEXTO).toContain(COPY.panel.acciones[0]?.ayuda ?? '');
  });

  it('sin vínculo vigente lo declara en lugar de dejar el bloque en blanco', () => {
    const html = renderToStaticMarkup(
      <ProfessionalDetailPanel
        detalle={{ ...DETALLE, activeAffiliation: null, assignedPatients: [], appointments: [] }}
        copy={COPY}
        onCerrar={() => undefined}
      />,
    );

    expect(texto(html)).toContain(COPY.panel.sinVinculo);
    expect(texto(html)).toContain(COPY.panel.vacioPacientes);
    expect(texto(html)).toContain(COPY.panel.vacioAgenda);
  });

  it('el listado sigue montado junto al panel', () => {
    const TEXTO_VISTA = texto(vista({ listaInicial: LISTA, detalleInicial: DETALLE }));

    expect(TEXTO_VISTA).toContain(COPY.listaTitulo);
    expect(TEXTO_VISTA).toContain('Carmen Paciente Ficticia');
  });
});

/* ========================================================================== */
/* Plano 2 — Catálogos y redacción determinista                               */
/* ========================================================================== */

describe('T-P8 — Catálogos controlados y redacción sin reloj', () => {
  it('traduce los códigos del catálogo del servidor', () => {
    expect(etiquetaProfesion('MEDICINA_GENERAL', 'Medicina general')).toBe('Medicina general');
    expect(estadoPerfil('ACTIVE').etiqueta).toBe('Perfil vigente');
    expect(estadoPerfil('INACTIVE').etiqueta).toBe('Perfil no vigente');
  });

  it('un código desconocido se muestra tal cual, sin inventarle nombre', () => {
    expect(etiquetaProfesion('CODIGO_NUEVO', '')).toBe('CODIGO_NUEVO');
    expect(etiquetaProfesion('CODIGO_NUEVO', 'Nombre servido')).toBe('Nombre servido');
  });

  it('la redacción de instantes es determinista y declara la zona', () => {
    expect(textoInstante('2026-08-22T14:30:00.000Z')).toBe('22/08/2026, 14:30 UTC');
    expect(textoFecha('2026-01-15')).toBe('15/01/2026');
  });

  it('una página sin filas no produce un rango falso', () => {
    expect(rangoDePagina(VACIA)).toEqual({ desde: 0, hasta: 0 });
  });
});

/* ========================================================================== */
/* Plano 2 — Accesibilidad estructural y alcance negativo                     */
/* ========================================================================== */

describe('T-P9 — Accesibilidad estructural y alcance negativo', () => {
  const HTML = vista({ listaInicial: LISTA, detalleInicial: DETALLE });

  it('todas las acciones son botones reales, sin formularios ni enlaces', () => {
    expect(apariciones(HTML, /<button\b/gu)).toBe(apariciones(HTML, /<button type="button"/gu));
    expect(HTML).not.toContain('<form');
    expect(HTML).not.toContain('<a ');
    expect(HTML).not.toContain('href');
  });

  it('cada control de filtro tiene etiqueta visible asociada', () => {
    expect(apariciones(HTML, /<label\b/gu)).toBeGreaterThanOrEqual(
      apariciones(HTML, /<select\b/gu),
    );
    expect(apariciones(HTML, /<label class="[^"]*" for="/gu)).toBeGreaterThan(0);
  });

  it('el directorio es una lista con nombre accesible y sin desplazamiento', () => {
    expect(HTML).toContain('aria-labelledby="hospital-profesionales-lista"');
    expect(HTML).not.toContain('tabindex="0"');
    expect(HTML).not.toContain('role="region"');
  });

  it('la acción de detalle declara a quién pertenece y qué controla', () => {
    expect(apariciones(HTML, /aria-expanded="true"/gu)).toBe(1);
    expect(HTML).toContain('aria-controls="hospital-profesionales-detalle"');

    for (const item of LISTA.items) {
      expect(texto(HTML)).toContain(`detalle de ${item.fullName}`);
    }
  });

  it('los iconos decorativos quedan ocultos y los estados se leen como texto', () => {
    expect(apariciones(HTML, /<svg\b/gu)).toBe(
      apariciones(HTML, /aria-hidden="true" focusable/gu),
    );
    expect(texto(HTML)).toContain(estadoPerfil('ACTIVE').etiqueta);
  });
});

/* ========================================================================== */
/* Plano 2 — Vocabulario visible                                              */
/* ========================================================================== */

describe('T-P10 — El copy visible no usa lenguaje interno del proyecto', () => {
  /*
   * Se comprueba sobre el TEXTO renderizado, no sobre el archivo: el código y
   * sus comentarios sí pueden nombrar la Task, la API o los fixtures para
   * explicar por qué algo está o no está. Lo que no puede hacerlo es la
   * interfaz que ve una persona trabajadora de la institución.
   *
   * `API` y `CORE` se buscan como palabra y respetando mayúsculas: `Terapia
   * ocupacional` contiene «api» y es una profesión del catálogo controlado.
   */
  const PROHIBIDOS: readonly (readonly [string, RegExp])[] = [
    ['CORE', /\bCORE\b/u],
    ['API', /\bAPI\b/u],
    ['backend', /backend/iu],
    ['demo', /\bdemo\b/iu],
    ['fixture', /fixture/iu],
    ['prototipo', /prototipo/iu],
  ];

  const SUPERFICIES: readonly (readonly [string, string])[] = [
    ['consultando', texto(vista())],
    ['directorio', texto(vista({ listaInicial: LISTA }))],
    ['directorio y detalle', texto(vista({ listaInicial: LISTA, detalleInicial: DETALLE }))],
    ['sin equipo registrado', texto(vista({ listaInicial: VACIA }))],
  ];

  it.each(PROHIBIDOS)('ninguna superficie visible dice %s', (termino, patron) => {
    for (const [superficie, contenido] of SUPERFICIES) {
      expect(`${superficie}/${termino}: ${String(patron.test(contenido))}`).toBe(
        `${superficie}/${termino}: false`,
      );
    }
  });

  it('cada desenlace de fallo se redacta como producto y no como diagnóstico', () => {
    for (const valor of Object.values(COPY.estados)) {
      for (const [termino, patron] of PROHIBIDOS) {
        expect(`${termino}: ${String(patron.test(valor))}`).toBe(`${termino}: false`);
      }
    }
  });
});
