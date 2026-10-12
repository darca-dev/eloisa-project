import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { branding } from '@/config/branding';

import { MunicipalityProgramForm } from './MunicipalityProgramForm';
import {
  MUNICIPALITY_PROGRAMA_ENTRADA_VACIA,
  crearProgramaBorrador,
  formatearCantidadDemo,
  formatearMontoDemo,
  validarProgramaBorrador,
} from './MunicipalityProgramForm';
import type { MunicipalityProgramaEntrada } from './MunicipalityProgramForm';
import { MunicipalityPrograms } from './MunicipalityPrograms';
import { MunicipalityShell } from './MunicipalityShell';
import {
  MUNICIPALITY_POBLACIONES_BASE,
  MUNICIPALITY_PROGRAMA_ESTADOS,
  municipalityDemo,
  municipalityProgramasConfigDemo,
  municipalityProgramasDemo,
} from './municipalityConfig';
import type {
  MunicipalityProgramasConfig,
} from './municipalityConfig';
import { apariciones, etiquetasDeBotones, main, texto } from './municipalityTestUtils';

/**
 * Contexto institucional FICTICIO con el rol municipal (spec 022).
 *
 * Desde la spec 022, `MunicipalityShell` es una PUERTA: no monta ninguna vista
 * hasta que el servidor confirma una sesión institucional cuyo rol es
 * EXACTAMENTE `MUNICIPAL_VIEWER`. Estas pruebas verifican la composición
 * AUTORIZADA, y `renderToStaticMarkup` no ejecuta efectos, de modo que sin
 * inyectar el contexto se renderizaría siempre el estado «comprobando».
 *
 * Inyectarlo NO concede acceso a nadie ni relaja el fallo cerrado: la regla de
 * rol es la misma y sigue viviendo en `municipalitySession.tsx`, el servidor
 * sigue decidiendo cada consulta agregada, y la ruta `/municipality` no pasa
 * esta propiedad. La fixture es LOCAL a este archivo a propósito: no es código
 * de producción y no se comparte en tiempo de ejecución.
 *
 * Nada de lo que contiene es real. Lo que la puerta hace y deja de hacer se
 * prueba en `municipalitySession.test.tsx`.
 */
const SESION_MUNICIPAL_FICTICIA = {
  role: 'MUNICIPAL_VIEWER',
  expiresAt: '2026-08-27T20:00:00.000Z',
  institution: { name: 'Entidad institucional de pruebas' },
  actorDisplay: 'Acceso institucional',
} as const;


/**
 * Vista Programas de Alcaldía (TASK-ALCALDIA-A-03, T-01 a T-25).
 *
 * Las vistas se renderizan con `react-dom/server`: el repositorio no incluye
 * jsdom ni una librería de testing con DOM y esta tarea prohíbe añadir
 * dependencias para suplirlo. En consecuencia:
 *
 * - lo que se puede verificar sin DOM se verifica aquí: marcado renderizado,
 *   catálogos, fixtures y las funciones puras de validación y de alta local;
 * - el recorrido real de foco dentro del diálogo (Tab y Shift+Tab), el cierre
 *   con `Escape`, la devolución del foco a «+ Nuevo programa», el anuncio de la
 *   región viva y el zoom al 200 % se verifican manualmente en navegador y se
 *   reportan como pruebas manuales, nunca como automatizadas.
 */

const DIRECTORIO = dirname(fileURLToPath(import.meta.url));

/** Código fuente de los dos componentes de A-03, para pruebas estructurales. */
const FUENTE_VISTA = readFileSync(join(DIRECTORIO, 'MunicipalityPrograms.tsx'), 'utf8');
const FUENTE_FORMULARIO = readFileSync(join(DIRECTORIO, 'MunicipalityProgramForm.tsx'), 'utf8');

const CONFIG = municipalityProgramasConfigDemo;

/** Vista Programas montada dentro del shell aprobado. */
function shellProgramas(): string {
  return renderToStaticMarkup(<MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial="programas" />);
}

/** Vista Programas aislada. */
function vista(): string {
  return renderToStaticMarkup(<MunicipalityPrograms />);
}

/** Vista Programas con una configuración de programas distinta. */
function vistaCon(programas: MunicipalityProgramasConfig): string {
  return renderToStaticMarkup(
    <MunicipalityPrograms config={{ ...municipalityDemo, programas }} />,
  );
}

/** Diálogo «Nuevo programa» renderizado en su estado inicial. */
function dialogo(): string {
  return renderToStaticMarkup(
    <MunicipalityProgramForm
      config={CONFIG}
      onCancelar={() => {
        /* Sin controlador: el marcado se lee igual. */
      }}
      onCrear={() => {
        /* Sin controlador: el marcado se lee igual. */
      }}
    />,
  );
}

/**
 * Marcado de la tarjeta de un programa concreto.
 *
 * Las tarjetas contienen listas anidadas, así que no se recortan por `</li>`:
 * se corta por el marcador técnico de estado, que abre cada tarjeta y solo
 * aparece una vez por programa.
 */
function tarjeta(html: string, programaId: string): string {
  const partes = html.split(/data-municipality-programa-estado="[^"]*"/u);
  const indice = municipalityProgramasDemo.findIndex((programa) => programa.id === programaId);

  return partes[indice + 1] ?? '';
}

/** Entrada válida mínima del formulario, con varias poblaciones y ejecutores. */
const ENTRADA_VALIDA: MunicipalityProgramaEntrada = {
  nombre: 'Programa demostrativo de prueba',
  poblacionIds: ['MAYORES_60', 'CUIDADO_EN_CASA'],
  origen: 'MUNICIPAL',
  entidadFormuladora: 'Secretaría de prueba',
  entidadResponsable: 'Secretaría responsable de prueba',
  ejecutorIds: ['org-demo-ese', 'org-demo-fundacion'],
  vigenciaInicio: '2026-01-01',
  vigenciaFin: '2026-12-31',
  presupuesto: '150000000',
  meta: '120',
};

/* --------------------------------- T-01 ---------------------------------- */

describe('Programas — navegación y shell (T-01)', () => {
  it('se monta dentro del único shell, sin ruta, red ni almacenamiento', () => {
    const html = shellProgramas();

    expect(html).toContain('data-municipality-content="programas"');
    expect(apariciones(html, /<aside\b/gu)).toBe(1);
    expect(apariciones(html, /<header\b/gu)).toBe(1);
    expect(apariciones(html, /<main\b/gu)).toBe(1);
    expect(apariciones(html, /<h1\b/gu)).toBe(1);
    expect(html).not.toContain('href');
    expect(html).not.toMatch(/<(script|iframe|img|link|a)\b/u);
  });

  it('marca «Programas» como único elemento activo del menú', () => {
    const html = shellProgramas();
    const activo =
      /<button[^>]*aria-current="true"[^>]*>(?<contenido>[\s\S]*?)<\/button>/u.exec(html)?.groups
        ?.contenido ?? '';

    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
    expect(texto(activo)).toBe('Programas');
  });

  it('los dos accesos de Inicio apuntan a Programas', () => {
    const accesos = municipalityDemo.inicio.accesos
      .filter((acceso) => acceso.destino === 'programas')
      .map((acceso) => acceso.etiqueta);

    expect(accesos).toStrictEqual(['Ver programas', 'Registrar programa']);
  });

  it('el encabezado principal puede recibir el foco al cambiar de vista', () => {
    expect(shellProgramas()).toMatch(/<h1[^>]*tabindex="-1"/u);
  });

  it('el periodo no recalcula ningún fixture de la vista (FR-10)', () => {
    const conMes = texto(
      main(renderToStaticMarkup(<MunicipalityShell
            periodoInicial="mes"
            sesionInicial={SESION_MUNICIPAL_FICTICIA}
            vistaInicial="programas"
          />)),
    );
    const conAno = texto(
      main(renderToStaticMarkup(<MunicipalityShell
            periodoInicial="ano"
            sesionInicial={SESION_MUNICIPAL_FICTICIA}
            vistaInicial="programas"
          />)),
    );

    expect(conMes).toBe(conAno);
  });
});

/* --------------------------------- T-02 ---------------------------------- */

describe('Programas — encabezado y acción primaria (T-02, FR-02)', () => {

  it('integra «+ Nuevo programa» como única acción primaria del encabezado', () => {
    const html = vista();

    expect(etiquetasDeBotones(html)).toStrictEqual(['+ Nuevo programa']);
    expect(html).toContain('type="button"');
  });

  it('con el diálogo cerrado no hay formulario, campos ni modal en la vista', () => {
    const html = vista();

    expect(html).not.toMatch(/<(form|input|select|textarea|dialog)\b/u);
    expect(html).not.toContain('role="dialog"');
  });

  it('mantiene la etiqueta y la aclaración de datos demostrativos', () => {
    const visible = texto(vista());

    expect(visible).toContain(municipalityDemo.demo.etiqueta);
    expect(visible).toContain(municipalityDemo.demo.aclaracion);
  });
});

/* --------------------------------- T-04 ---------------------------------- */

describe('Programas — poblaciones base y relación múltiple (T-04, FR-04)', () => {

  it('al menos un programa atiende varias poblaciones y las muestra todas', () => {
    const multiples = municipalityProgramasDemo.filter(
      (programa) => programa.poblacionIds.length > 1,
    );

    expect(multiples.length).toBeGreaterThan(0);

    const domiciliaria = tarjeta(vista(), 'pro-demo-domiciliaria');
    const visible = texto(domiciliaria);

    expect(municipalityProgramasDemo[0]?.poblacionIds).toStrictEqual([
      'MAYORES_60',
      'DISCAPACIDAD',
      'CUIDADO_EN_CASA',
    ]);
    expect(visible).toContain('Personas mayores de 60 años');
    expect(visible).toContain('Personas en situación de discapacidad');
    expect(visible).toContain('Personas que requieren cuidados en casa');
  });

  it('admite una población configurada fuera del catálogo inicial', () => {
    const ampliado: MunicipalityProgramasConfig = {
      ...CONFIG,
      poblacionesBase: [
        ...MUNICIPALITY_POBLACIONES_BASE,
        { id: 'POBLACION_FUTURA', etiqueta: 'Población configurada más adelante' },
      ],
      programas: [
        {
          ...municipalityProgramasDemo[0]!,
          id: 'pro-futuro',
          poblacionIds: ['POBLACION_FUTURA'],
        },
      ],
    };

    expect(texto(vistaCon(ampliado))).toContain('Población configurada más adelante');
  });
});

/* --------------------------------- T-05 ---------------------------------- */

describe('Programas — deduplicación (T-05, FR-04)', () => {
  it('declara que una persona cuenta una sola vez en el total municipal', () => {
    expect(texto(vista())).toContain(CONFIG.deduplicacion);
  });

  it('muestra beneficiarios únicos por programa', () => {
    const visible = texto(vista());

    expect(visible).toContain(CONFIG.etiquetas.beneficiariosUnicos);

    for (const programa of municipalityProgramasDemo) {
      expect(programa.beneficiariosUnicos).not.toBe('');
    }
  });

  it('no suma las tarjetas para producir ningún total', () => {
    /* Sin agregación en el componente: no hay `reduce`, `Number(` ni suma. */
    expect(FUENTE_VISTA).not.toContain('.reduce(');
    expect(FUENTE_VISTA).not.toMatch(/\bNumber\(/u);

    /* La suma aritmética de los cinco fixtures no aparece en ninguna parte. */
    expect(texto(vista())).not.toContain('5.750');
  });
});

/* --------------------------------- T-06 ---------------------------------- */

describe('Programas — origen y entidades (T-06, FR-03)', () => {

  it('formuladora y responsable son datos independientes', () => {
    const distintos = municipalityProgramasDemo.filter(
      (programa) => programa.entidadFormuladora !== programa.entidadResponsable,
    );

    expect(distintos.length).toBeGreaterThan(0);

    const visible = texto(tarjeta(vista(), 'pro-demo-adulto-mayor'));

    expect(visible).toContain('Origen: Nacional');
    expect(visible).toContain('entidad formuladora: Entidad nacional formuladora (demostrativa)');
    expect(visible).toContain('entidad responsable: Secretaría de Integración Social');
  });
});

/* --------------------------------- T-07 ---------------------------------- */

describe('Programas — ejecutores múltiples (T-07, FR-03)', () => {

  it('al menos un programa muestra dos ejecutores de tipos distintos', () => {
    const multiples = municipalityProgramasDemo.filter(
      (programa) =>
        programa.ejecutores.length > 1 &&
        new Set(programa.ejecutores.map((ejecutor) => ejecutor.tipo)).size > 1,
    );

    expect(multiples.length).toBeGreaterThan(0);

    const visible = texto(tarjeta(vista(), 'pro-demo-adulto-mayor'));

    expect(visible).toContain('Hospital San Rafael (ESE) · Hospital/ESE');
    expect(visible).toContain('Fundación Raíces del Cuidado (demostrativa) · Fundación');
  });
});

/* --------------------------------- T-08 ---------------------------------- */

describe('Programas — estados (T-08, FR-03)', () => {

  it('los cinco estados son demostrables y siempre se escriben', () => {
    for (const estado of MUNICIPALITY_PROGRAMA_ESTADOS) {
      const configEstado: MunicipalityProgramasConfig = {
        ...CONFIG,
        programas: [{ ...municipalityProgramasDemo[0]!, id: `pro-${estado.id}`, estado: estado.id }],
      };
      const html = vistaCon(configEstado);

      expect(html).toContain(`data-municipality-programa-estado="${estado.id}"`);
      expect(texto(html)).toContain(estado.etiqueta);
    }
  });

  it('no aparece ningún texto de estado ajeno al catálogo aprobado', () => {
    const visible = texto(vista());

    for (const antiguo of ['En ejecución', 'Requiere seguimiento', 'Ejecución baja']) {
      expect(visible).not.toContain(antiguo);
    }
  });

  it('el alta local nace y permanece en BORRADOR', () => {
    expect(CONFIG.formulario.estadoInicial).toBe('BORRADOR');
    expect(crearProgramaBorrador(ENTRADA_VALIDA, CONFIG, 1).estado).toBe('BORRADOR');
  });
});

/* --------------------------------- T-09 ---------------------------------- */

describe('Nuevo programa — campos mínimos (T-09, FR-08)', () => {
  it('es un diálogo modal, nombrado y descrito', () => {
    const html = dialogo();

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-labelledby="[^"]+"/u);
    expect(html).toMatch(/aria-describedby="[^"]+"/u);
    expect(texto(html)).toContain('Nuevo programa');
    expect(texto(html)).toContain(CONFIG.formulario.descripcion);
  });

  it('no añade campos clínicos, contractuales, financieros profundos ni evidencias', () => {
    const visible = texto(dialogo());

    for (const patron of [
      /factura/iu,
      /proveedor/iu,
      /contrato/iu,
      /evidencia/iu,
      /causad/iu,
      /obligad/iu,
      /historia/iu,
      /riesgo clínico/iu,
    ]) {
      expect(visible).not.toMatch(patron);
    }
  });

  it('ofrece solo Cancelar y Crear borrador', () => {
    expect(etiquetasDeBotones(dialogo())).toStrictEqual(['Cancelar', 'Crear borrador']);
  });

  it('el estado inicial es visible y no editable desde este flujo', () => {
    const html = dialogo();

    expect(html).toMatch(/<input[^>]*readonly/iu);
    expect(texto(html)).toContain('Borrador');
    expect(texto(html)).toContain(CONFIG.formulario.estadoInicialAyuda);
    /* Ningún control permite elegir otro estado. */
    expect(texto(html)).not.toContain('Aprobado');
    expect(texto(html)).not.toContain('Activo');
  });
});

/* --------------------------------- T-10 ---------------------------------- */

describe('Nuevo programa — validación (T-10, AC-10)', () => {
  it('exige los diez campos cuando el formulario está vacío', () => {
    const errores = validarProgramaBorrador(MUNICIPALITY_PROGRAMA_ENTRADA_VACIA, CONFIG);

    expect(errores.map((error) => error.campo)).toStrictEqual([
      'nombre',
      'poblaciones',
      'origen',
      'entidadFormuladora',
      'entidadResponsable',
      'ejecutores',
      'vigenciaInicio',
      'vigenciaFin',
      'presupuesto',
      'meta',
    ]);
  });

  it('acepta una entrada válida con varias poblaciones y varios ejecutores', () => {
    expect(validarProgramaBorrador(ENTRADA_VALIDA, CONFIG)).toStrictEqual([]);
  });

  it('rechaza presupuesto y meta negativos o no numéricos', () => {
    const negativos = validarProgramaBorrador(
      { ...ENTRADA_VALIDA, presupuesto: '-10', meta: 'muchas' },
      CONFIG,
    );

    expect(negativos.map((error) => error.campo)).toStrictEqual(['presupuesto', 'meta']);
  });

  it('acepta cero como presupuesto y como meta', () => {
    expect(
      validarProgramaBorrador({ ...ENTRADA_VALIDA, presupuesto: '0', meta: '0' }, CONFIG),
    ).toStrictEqual([]);
  });

  it('rechaza una vigencia cuyo fin es anterior al inicio', () => {
    const errores = validarProgramaBorrador(
      { ...ENTRADA_VALIDA, vigenciaInicio: '2026-06-01', vigenciaFin: '2026-01-01' },
      CONFIG,
    );

    expect(errores).toStrictEqual([
      { campo: 'vigenciaFin', mensaje: CONFIG.formulario.errorVigenciaOrden },
    ]);
  });

  it('rechaza un origen ajeno al catálogo de cuatro valores', () => {
    const errores = validarProgramaBorrador({ ...ENTRADA_VALIDA, origen: 'REGIONAL' }, CONFIG);

    expect(errores.map((error) => error.campo)).toStrictEqual(['origen']);
  });

  it('cada campo del formulario tiene etiqueta asociada', () => {
    const html = dialogo();
    const controles = [...html.matchAll(/<(?:input|select)\b[^>]*id="(?<id>[^"]+)"/gu)].map(
      (coincidencia) => coincidencia.groups?.id ?? '',
    );

    expect(controles.length).toBeGreaterThan(0);

    for (const id of controles) {
      expect(html).toContain(`for="${id}"`);
    }
  });
});

/* --------------------------------- T-12 ---------------------------------- */

describe('Nuevo programa — alta local efímera (T-12, FR-08)', () => {
  it('crea un borrador con los datos declarados y nada más', () => {
    const borrador = crearProgramaBorrador(ENTRADA_VALIDA, CONFIG, 1);

    expect(borrador.id).toBe('pro-borrador-1');
    expect(borrador.nombre).toBe('Programa demostrativo de prueba');
    expect(borrador.poblacionIds).toStrictEqual(['MAYORES_60', 'CUIDADO_EN_CASA']);
    expect(borrador.origen).toBe('MUNICIPAL');
    expect(borrador.ejecutores.map((ejecutor) => ejecutor.id)).toStrictEqual([
      'org-demo-ese',
      'org-demo-fundacion',
    ]);
    expect(borrador.vigencia).toStrictEqual({
      inicio: '2026-01-01',
      fin: '2026-12-31',
      etiqueta: '01/01/2026 – 31/12/2026',
    });
    expect(borrador.presupuesto).toStrictEqual({ moneda: 'COP', asignado: '$150.000.000' });
    expect(borrador.avanceFisico.metaFisica).toBe(120);
  });

  it('no deriva disponible, porcentaje, cobertura, evidencia ni resultado', () => {
    const borrador = crearProgramaBorrador(ENTRADA_VALIDA, CONFIG, 1);

    expect(borrador.avanceFinanciero).toStrictEqual({
      comprometido: null,
      ejecutado: null,
      disponible: null,
      porcentaje: null,
      porcentajeTexto: null,
      tono: 'azul',
    });
    expect(borrador.avanceFisico.resultadoFisico).toBeNull();
    expect(borrador.avanceFisico.porcentaje).toBeNull();
    expect(borrador.cobertura.porcentajeTexto).toBeNull();
    expect(borrador.cierre).toBeNull();
  });

  it('el borrador se presenta con «Sin registro» en lo que no declara', () => {
    const borrador = crearProgramaBorrador(ENTRADA_VALIDA, CONFIG, 1);
    const conBorrador: MunicipalityProgramasConfig = { ...CONFIG, programas: [borrador] };
    const visible = texto(vistaCon(conBorrador));

    expect(visible).toContain('Programa demostrativo de prueba');
    expect(visible).toContain('Borrador');
    expect(visible).toContain('Presupuesto asignado: $150.000.000');
    expect(visible).toContain('Ejecutado: Sin registro');
    expect(visible).toContain('Disponible: Sin registro');
    expect(visible).toContain('Meta: 120 personas');
    expect(visible).toContain('Atendidas: Sin registro');
    /* Sin porcentaje declarado no se dibuja barra alguna. */
    expect(vistaCon(conBorrador)).not.toContain('role="progressbar"');
  });

  it('el mensaje de alta aclara que no aprueba, activa ni guarda', () => {
    expect(CONFIG.formulario.anuncioCreado).toBe(
      'Programa borrador creado de forma demostrativa. No fue aprobado, activado ni guardado: desaparece al recargar la página.',
    );
  });

  it('el alta no usa red, almacenamiento, URL ni archivo', () => {
    for (const fuente of [FUENTE_VISTA, FUENTE_FORMULARIO]) {
      for (const patron of [
        /\bfetch\s*\(/u,
        /localStorage/u,
        /sessionStorage/u,
        /document\.cookie/u,
        /history\.push/u,
        /window\.location/u,
        /FormData/u,
      ]) {
        expect(patron.test(fuente)).toBe(false);
      }
    }
  });

  it('el identificador del borrador es determinista, sin reloj ni azar', () => {
    expect(FUENTE_FORMULARIO).not.toContain('Date.now');
    expect(FUENTE_FORMULARIO).not.toContain('Math.random');
    expect(crearProgramaBorrador(ENTRADA_VALIDA, CONFIG, 3).id).toBe('pro-borrador-3');
  });

  it('agrupa el monto solo para presentarlo', () => {
    expect(formatearMontoDemo('0')).toBe('$0');
    expect(formatearMontoDemo('1500')).toBe('$1.500');
    expect(formatearMontoDemo('680000000')).toBe('$680.000.000');
  });
});

/* --------------------------------- T-13 ---------------------------------- */

describe('Programas — avance físico (T-13, FR-05)', () => {
  it('cada tarjeta presenta meta absoluta, resultado absoluto y porcentaje', () => {
    const html = vista();

    for (const programa of municipalityProgramasDemo) {
      const visible = texto(tarjeta(html, programa.id));

      expect(visible).toContain('Cumplimiento físico');
      expect(visible).toContain(
        `Meta: ${formatearCantidadDemo(programa.avanceFisico.metaFisica)} ${
          programa.avanceFisico.unidad
        }`,
      );
      expect(visible).toContain(
        `${programa.avanceFisico.resultadoEtiqueta}: ${formatearCantidadDemo(
          programa.avanceFisico.resultadoFisico ?? 0,
        )} ${programa.avanceFisico.unidad}`,
      );
      expect(visible).toContain(programa.avanceFisico.porcentajeTexto ?? '');
    }
  });

  it('la barra declara su valor y el porcentaje sigue escrito', () => {
    const html = vista();

    expect(apariciones(html, /role="progressbar"/gu)).toBe(
      municipalityProgramasDemo.length * 2,
    );
    expect(html).toContain('aria-valuenow="76"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
  });

  it('el componente no calcula el porcentaje: lo declara el fixture', () => {
    const inventado: MunicipalityProgramasConfig = {
      ...CONFIG,
      programas: [
        {
          ...municipalityProgramasDemo[0]!,
          id: 'pro-declarado',
          avanceFisico: {
            ...municipalityProgramasDemo[0]!.avanceFisico,
            porcentaje: 12,
            porcentajeTexto: '12 %',
          },
        },
      ],
    };

    /* Meta y resultado no cambian; el porcentaje mostrado es el declarado. */
    expect(vistaCon(inventado)).toContain('aria-valuenow="12"');
    expect(texto(vistaCon(inventado))).toContain('12 %');
  });
});

/* --------------------------------- T-14 ---------------------------------- */

describe('Programas — avance financiero (T-14, FR-06)', () => {
  it('cada tarjeta presenta asignado, ejecutado, disponible, moneda y porcentaje', () => {
    const html = vista();

    for (const programa of municipalityProgramasDemo) {
      const visible = texto(tarjeta(html, programa.id));

      expect(visible).toContain('Ejecución financiera');
      expect(visible).toContain(`Presupuesto asignado: ${programa.presupuesto.asignado}`);
      expect(visible).toContain(`Ejecutado: ${programa.avanceFinanciero.ejecutado ?? ''}`);
      expect(visible).toContain(`Disponible: ${programa.avanceFinanciero.disponible ?? ''}`);
      expect(visible).toContain(`Moneda: ${programa.presupuesto.moneda}`);
      expect(visible).toContain(programa.avanceFinanciero.porcentajeTexto ?? '');
    }
  });

  it('el comprometido aparece solo cuando el fixture lo declara', () => {
    const sinComprometido: MunicipalityProgramasConfig = {
      ...CONFIG,
      programas: [
        {
          ...municipalityProgramasDemo[0]!,
          id: 'pro-sin-comprometido',
          avanceFinanciero: {
            ...municipalityProgramasDemo[0]!.avanceFinanciero,
            comprometido: null,
          },
        },
      ],
    };
    const visible = texto(vistaCon(sinComprometido));

    expect(visible).not.toContain('Comprometido');
    expect(visible).toContain('Presupuesto asignado: $680 M');
    expect(visible).toContain('Ejecutado: $402 M');
    expect(visible).toContain('Disponible: $118 M');
  });
});

/* --------------------------------- T-15 ---------------------------------- */

describe('Programas — límite financiero frente a A-04 (T-15)', () => {
  it('no muestra causación, obligación, pago, factura, proveedor ni eficiencia', () => {
    const visible = texto(vista());

    for (const patron of [
      /causad/iu,
      /obligad/iu,
      /\bpagad/iu,
      /\bpago\b/iu,
      /factura/iu,
      /proveedor/iu,
      /eficien/iu,
      /rentab/iu,
    ]) {
      expect(visible).not.toMatch(patron);
    }
  });

  it('declara explícitamente que no registra movimientos ni califica la ejecución', () => {
    expect(texto(vista())).toContain(CONFIG.limiteFinanciero);
  });

  it('no ofrece ningún control hacia el detalle financiero todavía inexistente', () => {
    /* El destino queda tipado y preparado, pero sin botón inerte en pantalla. */
    expect(FUENTE_VISTA).toContain('MUNICIPALITY_PROGRAMAS_DESTINO_FINANCIERO');
    expect(etiquetasDeBotones(vista())).toStrictEqual(['+ Nuevo programa']);
  });

  it('el componente no deriva ningún importe', () => {
    expect(FUENTE_VISTA).not.toMatch(/[-+*/]\s*(?:asignado|ejecutado|disponible)/u);
    expect(FUENTE_VISTA).not.toContain('parseFloat');
    expect(FUENTE_VISTA).not.toContain('parseInt');
  });
});

/* --------------------------------- T-16 ---------------------------------- */

describe('Programas — evidencias agregadas (T-16, FR-07)', () => {
  it('cada tarjeta muestra los cuatro agregados documentales', () => {
    const html = vista();

    for (const programa of municipalityProgramasDemo) {
      const visible = texto(tarjeta(html, programa.id));

      expect(visible).toContain(`Evidencias registradas: ${programa.evidencias.registradas}`);
      expect(visible).toContain(`Evidencias pendientes: ${programa.evidencias.pendientes}`);
      expect(visible).toContain(
        `Actividades con soporte: ${programa.evidencias.actividadesConSoporte}`,
      );
      expect(visible).toContain(
        `Estado documental: ${programa.evidencias.estadoDocumental}`,
      );
    }
  });

  it('no incluye documentos, archivos ni enlaces reales', () => {
    const html = vista();

    expect(html).not.toMatch(/<(a|img|iframe|object|embed)\b/u);
    expect(html).not.toContain('download');
    expect(texto(html)).not.toMatch(/adjunt|\.pdf|archivo cargado/iu);
  });
});

/* --------------------------------- T-17 ---------------------------------- */

describe('Programas — cierre preparado (T-17, FR-09)', () => {
  it('el informe ausente se muestra como pendiente, nunca como cumplimiento', () => {
    const visible = texto(tarjeta(vista(), 'pro-demo-formacion-cuidadores'));

    expect(visible).toContain('Informe final Pendiente');
    expect(visible).toContain(
      'Un programa finalizado sin informe final no acredita cumplimiento.',
    );
    expect(visible).not.toMatch(/cumplimiento (verificado|certificado|garantizado|acreditado)/iu);
  });

  it('los programas sin cierre no muestran el bloque', () => {
    const activo = tarjeta(vista(), 'pro-demo-domiciliaria');

    expect(texto(activo)).not.toContain('Cierre del programa');
  });

  it('A-03 no cierra programas ni genera informes', () => {
    expect(etiquetasDeBotones(vista())).not.toContain('Cerrar programa');
    expect(etiquetasDeBotones(vista())).not.toContain('Generar informe');
  });
});

/* --------------------------------- T-18 ---------------------------------- */

describe('Programas — privacidad municipal (T-18, AC-17)', () => {
  it('no expone identidad, contacto, ubicación exacta ni información clínica', () => {
    const visible = texto(shellProgramas());

    for (const patron of [
      /cédula/iu,
      /documento de identidad/iu,
      /\bNUIP\b/u,
      /teléfono/iu,
      /correo electrónico/iu,
      /\bdirección\b/iu,
      /\bcalle\s+\d/iu,
      /\bcarrera\s+\d/iu,
      /diagnóstic/iu,
      /medicament/iu,
      /historia clínica de/iu,
      /nota clínica/iu,
    ]) {
      expect(visible).not.toMatch(patron);
    }
  });

  it('no expone compensación individual', () => {
    const visible = texto(shellProgramas());

    for (const patron of [/salario/iu, /honorari/iu, /nómina/iu, /remuneración/iu]) {
      expect(visible).not.toMatch(patron);
    }
  });

  it('no ofrece búsqueda de personas, drill-down ni exportación', () => {
    const html = vista();

    expect(html).not.toMatch(/<(a|table)\b/u);
    expect(texto(html)).not.toMatch(/buscar persona|ver beneficiario|descargar|exportar/iu);
  });
});

/* --------------------------------- T-19 ---------------------------------- */

describe('Programas — marca y procedencia (T-19, AC-18, AC-19)', () => {
  it('usa la marca pública y no expone la marca técnica interna', () => {
    const html = shellProgramas();

    expect(texto(html)).toContain(branding.platformDisplayName);
    expect(html.includes('MERDN')).toBe(false);
  });

  it('todos los fixtures declaran procedencia demostrativa sin integración', () => {
    for (const programa of municipalityProgramasDemo) {
      expect(programa.procedencia.categoria).toBe('FIXTURE_DEMO');
      expect(programa.procedencia.asOf).toBeNull();
      expect(programa.procedencia.sincronizacion).toBe('SIN_INTEGRACION');
    }

    expect(CONFIG.procedencia.categoria).toBe('FIXTURE_DEMO');
    expect(CONFIG.atribucion.metodologiaId).toBeNull();
  });

  it('no afirma oficialidad, adopción ni sincronización', () => {
    const visible = texto(vista());

    expect(visible).not.toMatch(/dato oficial|fuente oficial|adoptado oficialmente/iu);
    expect(visible).not.toMatch(/sincronizad|integración activa|\bAPI\b/iu);
  });
});

/* --------------------------------- T-20 ---------------------------------- */

describe('Programas — extensibilidad institucional (T-20, AC-20)', () => {
  it('representa un programa de otra organización, sin municipio, sin cambio estructural', () => {
    const privado: MunicipalityProgramasConfig = {
      ...CONFIG,
      programas: [
        {
          ...municipalityProgramasDemo[0]!,
          id: 'pro-otra-organizacion',
          organizacionId: 'org-demo-fundacion',
          municipioId: null,
          nombre: 'Programa de otra organización autorizada',
          origen: 'INSTITUCIONAL_OTRO',
          entidadFormuladora: 'Fundación formuladora (demostrativa)',
          entidadResponsable: 'Fundación formuladora (demostrativa)',
        },
      ],
    };
    const html = vistaCon(privado);

    expect(texto(html)).toContain('Programa de otra organización autorizada');
    expect(texto(html)).toContain('Origen: Institucional/Otro');
    expect(apariciones(html, /data-municipality-programa-estado="/gu)).toBe(1);
  });

  it('no introduce interfaz ni copy comercial', () => {
    const visible = texto(vista());

    for (const patron of [/membresía/iu, /\bprecio/iu, /\bplan(es)? de servicio/iu, /\bcliente/iu]) {
      expect(visible).not.toMatch(patron);
    }
  });
});

/* --------------------------------- T-23 ---------------------------------- */

describe('Programas — accesibilidad estructural (T-23)', () => {
  it('declara un solo encabezado principal y una jerarquía coherente', () => {
    const html = shellProgramas();

    expect(apariciones(html, /<h1\b/gu)).toBe(1);
    expect(apariciones(html, /<h2\b/gu)).toBe(municipalityProgramasDemo.length);
    expect(html).not.toMatch(/<h[456]\b/u);
  });

  it('poblaciones, ejecutores, evidencias y cierre son grupos nombrados', () => {
    const html = vista();
    const grupos = [...html.matchAll(/role="group"[^>]*aria-labelledby="(?<id>[^"]+)"/gu)];

    expect(grupos.length).toBeGreaterThan(0);

    for (const grupo of grupos) {
      expect(html).toContain(`id="${grupo.groups?.id ?? ''}"`);
    }
  });

  it('la lista de programas es una lista semántica con resumen anunciado', () => {
    const html = vista();

    expect(apariciones(html, /<ul\b/gu)).toBeGreaterThan(0);
    expect(texto(html)).toContain(CONFIG.listaResumen);
  });

  it('el estado, la evidencia y el progreso nunca dependen solo del color', () => {
    const visible = texto(vista());

    for (const programa of municipalityProgramasDemo) {
      const estado = MUNICIPALITY_PROGRAMA_ESTADOS.find(
        (opcion) => opcion.id === programa.estado,
      );

      expect(visible).toContain(estado?.etiqueta ?? '');
      expect(visible).toContain(programa.evidencias.estadoDocumental);
      expect(visible).toContain(programa.avanceFinanciero.porcentajeTexto ?? '');
    }
  });

  it('cada barra declara nombre, valor y equivalente textual', () => {
    const barras = [...vista().matchAll(/<span[^>]*role="progressbar"(?<atributos>[^>]*)>/gu)];

    expect(barras.length).toBeGreaterThan(0);

    for (const barra of barras) {
      const atributos = barra.groups?.atributos ?? '';

      expect(atributos).toMatch(/aria-labelledby="[^"]+"/u);
      expect(atributos).toMatch(/aria-valuenow="\d+"/u);
      expect(atributos).toMatch(/aria-valuetext="[^"]+"/u);
    }
  });

  it('el diálogo declara título enfocable y controles con nombre accesible', () => {
    const html = dialogo();

    expect(html).toMatch(/<h2[^>]*tabindex="-1"/u);
    expect(html).toContain('role="alert"');
    expect(apariciones(html, /<legend\b/gu)).toBe(3);
  });
});

/* --------------------------------- T-25 ---------------------------------- */

describe('Programas — integridad del slice (T-25)', () => {
  it('no importa nada fuera de la feature salvo React', () => {
    for (const fuente of [FUENTE_VISTA, FUENTE_FORMULARIO]) {
      const origenes = [...fuente.matchAll(/from '(?<origen>[^']+)'/gu)].map(
        (coincidencia) => coincidencia.groups?.origen ?? '',
      );
      const externos = origenes.filter((origen) => !origen.startsWith('.'));

      expect([...new Set(externos)]).toStrictEqual(['react']);
    }
  });

  it('no importa ningún módulo de Hospital ni de otra experiencia', () => {
    for (const fuente of [FUENTE_VISTA, FUENTE_FORMULARIO]) {
      expect(/features\/(hospital|paciente|inscripcion)/u.test(fuente)).toBe(false);
    }
  });
});
