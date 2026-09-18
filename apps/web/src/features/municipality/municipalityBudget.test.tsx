import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MunicipalityBudget } from './MunicipalityBudget';
import { MunicipalityShell } from './MunicipalityShell';
import {
  MUNICIPALITY_FUENTES_FINANCIACION,
  MUNICIPALITY_POBLACIONES_BASE,
  MUNICIPALITY_REDISTRIBUCION_CONTRATO,
  municipalityDemo,
  municipalityProgramasDemo,
  municipalityProgramasPresupuestoDemo,
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
 * Presupuesto y ejecución de Alcaldía (TASK-ALCALDIA-A-04, T-01 a T-08, T-12 a
 * T-15, T-22 y T-24 a T-27).
 *
 * La vista se renderiza con `react-dom/server`, igual que el resto del
 * frontend: el repositorio no incluye jsdom ni una librería de testing con DOM,
 * y esta tarea no autoriza añadir dependencias. La activación real por clic, el
 * recorrido de teclado, el movimiento de foco y los tres viewports se verifican
 * manualmente en navegador y se reportan como no automatizados.
 */

const CONFIG = municipalityDemo.presupuesto;

/** Marcado de la vista aislada. */
function vista(): string {
  return renderToStaticMarkup(<MunicipalityBudget />);
}

/** Marcado del shell con Presupuesto montado. */
function shellPresupuesto(): string {
  return renderToStaticMarkup(<MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial="presupuesto" />);
}

/** Código fuente del componente, para las comprobaciones estructurales. */
const DIRECTORIO = dirname(fileURLToPath(import.meta.url));
const FUENTE_VISTA = readFileSync(join(DIRECTORIO, 'MunicipalityBudget.tsx'), 'utf8');
const FUENTE_CONFIG = readFileSync(join(DIRECTORIO, 'municipalityConfig.ts'), 'utf8');

/* --------------------------------- T-01 ---------------------------------- */

describe('Presupuesto — navegación y montaje (T-01)', () => {
  it('el shell monta la vista propia y no el estado «Próximamente»', () => {
    const html = shellPresupuesto();
    const contenido = texto(main(html));

    expect(html).toContain('data-municipality-content="presupuesto"');
    expect(contenido).toContain(CONFIG.titulo);
    expect(contenido).toContain(CONFIG.descripcion);
    expect(contenido).not.toContain('Este módulo se implementará en una tarea posterior.');
  });

  it('conserva sidebar, topbar, selector y perfil, con un solo módulo activo', () => {
    const html = shellPresupuesto();

    expect(apariciones(html, /<aside\b/gu)).toBe(1);
    expect(apariciones(html, /<header\b/gu)).toBe(1);
    expect(apariciones(html, /<main\b/gu)).toBe(1);
    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
    expect(texto(html)).toContain('Perfil de consulta agregada');
  });

  it('el encabezado principal puede recibir el foco al cambiar de vista', () => {
    expect(shellPresupuesto()).toMatch(/<h1[^>]*tabindex="-1"/u);
  });
});

/* --------------------------------- T-02 ---------------------------------- */

describe('Presupuesto — fidelidad con la referencia aprobada (T-02)', () => {
  it('conserva el título y el subtítulo vinculantes', () => {
    const visible = texto(vista());

    expect(visible).toContain('Presupuesto y ejecución');
    expect(visible).toContain(
      'De la asignación al soporte documental, con costo promedio por beneficiario.',
    );
  });

  it('conserva la barra de ejecución con su leyenda escrita', () => {
    const visible = texto(vista());

    expect(visible).toContain('Ejecución total del periodo');

    for (const item of CONFIG.leyenda) {
      expect(visible).toContain(`${item.etiqueta} ${item.valor}`);
    }
  });

  it('conserva el desglose «Por población» y su aclaración de no duplicación', () => {
    const visible = texto(vista());

    expect(visible).toContain('Por población');
    expect(visible).toContain(
      'Cuando una persona pertenece a varias poblaciones el gasto no se duplica',
    );
  });

  it('la barra de la ejecución es decorativa y no aporta significado propio', () => {
    expect(FUENTE_VISTA).toContain('splitBar');
    expect(FUENTE_VISTA).toMatch(/className=\{styles\.splitBar\} aria-hidden="true"/u);
  });
});

/* --------------------------------- T-03 ---------------------------------- */

describe('Presupuesto — resumen general (T-03, FR-03)', () => {
  it('muestra las cinco métricas en el orden conceptual aprobado', () => {
    expect(CONFIG.metricas.map((metrica) => metrica.id)).toStrictEqual([
      'asignado',
      'ejecutado',
      'comprometido',
      'disponible',
      'ejecucion',
    ]);
  });

  it('escribe el valor y la aclaración de cada métrica', () => {
    const visible = texto(vista());

    for (const metrica of CONFIG.metricas) {
      expect(visible).toContain(`${metrica.valor} ${metrica.titulo}`);
      expect(visible).toContain(metrica.aclaracion);
    }
  });

  it('muestra el porcentaje de ejecución como texto y no solo como barra', () => {
    expect(texto(vista())).toContain('55 %');
  });
});

/* --------------------------------- T-04 ---------------------------------- */

describe('Presupuesto — coherencia declarada del fixture (T-04, AC-05)', () => {
  const { resumen } = CONFIG;

  it('satisface la única identidad que el fixture declara', () => {
    expect(resumen.comprometido.millones + resumen.ejecutado.millones + resumen.disponible.millones)
      .toBe(resumen.asignado.millones);
  });

  it('declara explícitamente esa identidad en pantalla, sin generalizarla', () => {
    const visible = texto(vista());

    expect(visible).toContain(resumen.identidadContable);
    expect(visible).toContain('no una fórmula contable universal ni una regla oficial');
  });

  it('la suma de los programas reproduce cada total general', () => {
    const suma = (
      clave: 'asignado' | 'comprometido' | 'ejecutado' | 'disponible',
    ): number =>
      municipalityProgramasPresupuestoDemo.reduce(
        (total, programa) => total + programa.montos[clave],
        0,
      );

    expect(suma('asignado')).toBe(resumen.asignado.millones);
    expect(suma('comprometido')).toBe(resumen.comprometido.millones);
    expect(suma('ejecutado')).toBe(resumen.ejecutado.millones);
    expect(suma('disponible')).toBe(resumen.disponible.millones);
  });

  it('el porcentaje declarado coincide con el redondeo del fixture', () => {
    const calculado = Math.round(
      (resumen.ejecutado.millones / resumen.asignado.millones) * 100,
    );

    expect(calculado).toBe(resumen.porcentajeEjecucion);
  });

  it('la composición por fuente suma el asignado general', () => {
    const total = CONFIG.fuentesAgregadas.reduce(
      (suma, agregada) => suma + agregada.monto.millones,
      0,
    );

    expect(total).toBe(resumen.asignado.millones);
  });

  it('el componente no deriva ningún importe ni parsea texto monetario', () => {
    expect(FUENTE_VISTA).not.toContain('parseFloat');
    expect(FUENTE_VISTA).not.toContain('parseInt');
    expect(FUENTE_VISTA).not.toContain('Number(');
    expect(FUENTE_VISTA).not.toMatch(/[-+*/]\s*(?:asignado|ejecutado|disponible|comprometido)/u);
  });
});

/* --------------------------------- T-05 ---------------------------------- */

describe('Presupuesto — desglose por programa (T-05, FR-04)', () => {
  it('todo programaId resuelve contra la configuración de A-03', () => {
    const idsA03 = municipalityProgramasDemo.map((programa) => programa.id);

    for (const presupuesto of municipalityProgramasPresupuestoDemo) {
      expect(idsA03).toContain(presupuesto.programaId);
    }
  });

  it('cubre los cinco programas sin duplicar la entidad Programa', () => {
    const ids = municipalityProgramasPresupuestoDemo.map((item) => item.programaId);

    expect(ids).toHaveLength(municipalityProgramasDemo.length);
    expect(new Set(ids).size).toBe(ids.length);
    /* El presupuesto por programa no repite nombre, objetivo ni estado. */
    for (const presupuesto of municipalityProgramasPresupuestoDemo) {
      expect(Object.keys(presupuesto).sort()).toStrictEqual([
        'costoPromedio',
        'fuentes',
        'montos',
        'programaId',
      ]);
    }
  });

  it('cada programa muestra dinero, meta física y cumplimiento', () => {
    const visible = texto(vista());
    const { etiquetas } = CONFIG;

    for (const programa of municipalityProgramasDemo) {
      expect(visible).toContain(programa.nombre);
      expect(visible).toContain(`${etiquetas.asignado} ${programa.presupuesto.asignado}`);
      expect(visible).toContain(
        `${etiquetas.comprometido} ${programa.avanceFinanciero.comprometido ?? ''}`,
      );
      expect(visible).toContain(
        `${etiquetas.ejecutado} ${programa.avanceFinanciero.ejecutado ?? ''}`,
      );
      expect(visible).toContain(
        `${etiquetas.disponible} ${programa.avanceFinanciero.disponible ?? ''}`,
      );
      expect(visible).toContain(
        `${etiquetas.ejecucionFinanciera} ${programa.avanceFinanciero.porcentajeTexto ?? ''}`,
      );
      expect(visible).toContain(
        `${etiquetas.cumplimientoFisico} ${programa.avanceFisico.porcentajeTexto ?? ''}`,
      );
      expect(visible).toContain(etiquetas.metaFisica);
    }
  });

  it('mantiene visible la cadena programa, dinero, actividad, evidencia y resultado', () => {
    const visible = texto(vista());
    const { etiquetas } = CONFIG;

    for (const programa of municipalityProgramasDemo) {
      expect(visible).toContain(
        `${etiquetas.evidencias} ${programa.evidencias.actividadesConSoporte}`,
      );
      expect(visible).toContain(`${etiquetas.beneficiariosUnicos} ${programa.beneficiariosUnicos}`);
    }

    expect(visible).toContain(CONFIG.cadenaNota);
    expect(visible).toContain('exige una metodología aprobada');
  });

  it('no recalcula las métricas de A-03: los textos son los del programa', () => {
    expect(FUENTE_VISTA).toContain('programaMunicipal(');
    expect(FUENTE_VISTA).toContain('const { avanceFinanciero, avanceFisico, evidencias } = programa;');
    expect(FUENTE_VISTA).toContain('programa.presupuesto.asignado');
    expect(FUENTE_VISTA).not.toMatch(/montos\.(?:asignado|ejecutado|comprometido|disponible)/u);
  });
});

/* --------------------------------- T-06 ---------------------------------- */

describe('Presupuesto — fuentes de financiación (T-06, FR-05)', () => {
  it('declara exactamente las siete fuentes base aprobadas', () => {
    expect(MUNICIPALITY_FUENTES_FINANCIACION.map((fuente) => fuente.etiqueta)).toStrictEqual([
      'SGP Salud Pública',
      'Recursos propios',
      'Recursos Nación',
      'Recursos Departamento',
      'ADRES / recurso administrado o girado mediante ADRES',
      'Convenios',
      'Otra fuente',
    ]);
  });

  it('todas las fuentes están marcadas como demostrativas', () => {
    for (const fuente of MUNICIPALITY_FUENTES_FINANCIACION) {
      expect(fuente.demo).toBe(true);
    }
  });

  it('muestra las siete fuentes con su monto y su participación', () => {
    const visible = texto(vista());

    for (const agregada of CONFIG.fuentesAgregadas) {
      const fuente = MUNICIPALITY_FUENTES_FINANCIACION.find(
        (item) => item.id === agregada.fuenteId,
      );

      expect(fuente).toBeDefined();
      expect(visible).toContain(
        `${fuente?.etiqueta ?? ''} ${agregada.monto.texto} ${agregada.porcentajeTexto}`,
      );
    }
  });

  it('cada asignación por programa conserva una fuente válida y suma su asignado', () => {
    const ids = MUNICIPALITY_FUENTES_FINANCIACION.map((fuente) => fuente.id);

    for (const presupuesto of municipalityProgramasPresupuestoDemo) {
      expect(presupuesto.fuentes.length).toBeGreaterThan(0);

      let total = 0;

      for (const asignacion of presupuesto.fuentes) {
        expect(ids).toContain(asignacion.fuenteId);
        total += asignacion.monto.millones;
      }

      expect(total).toBe(presupuesto.montos.asignado);
    }
  });

  it('las siete fuentes se usan al menos una vez en los programas', () => {
    const usadas = new Set(
      municipalityProgramasPresupuestoDemo.flatMap((presupuesto) =>
        presupuesto.fuentes.map((asignacion) => asignacion.fuenteId),
      ),
    );

    expect(usadas.size).toBe(MUNICIPALITY_FUENTES_FINANCIACION.length);
  });
});

/* --------------------------- T-06 (caso ADRES) ---------------------------- */

describe('Presupuesto — ADRES delimitado (T-06, AC-09)', () => {
  it('marca como relacionada con ADRES únicamente la fuente correspondiente', () => {
    const relacionadas = MUNICIPALITY_FUENTES_FINANCIACION.filter(
      (fuente) => fuente.isAdresRelated,
    );

    expect(relacionadas.map((fuente) => fuente.id)).toStrictEqual(['fue-adres']);
  });

  it('ADRES es una fracción menor del presupuesto y nunca el total', () => {
    const adres = CONFIG.fuentesAgregadas.find((item) => item.fuenteId === 'fue-adres');

    expect(adres?.monto.millones).toBe(60);
    expect(adres?.monto.millones).toBeLessThan(CONFIG.resumen.asignado.millones / 2);
  });

  it('escribe el límite institucional de ADRES sin atribuirle autoridad', () => {
    const visible = texto(vista());

    expect(visible).toContain(CONFIG.adresNota);
    expect(visible).not.toMatch(/ADRES (regula|evalúa|certifica|audita|aprueba)/iu);
  });

  it('no consulta ninguna fuente de ADRES ni activa su módulo', () => {
    expect(FUENTE_VISTA).not.toMatch(/BDUA|\bLMA\b/u);
    expect(texto(vista())).not.toMatch(/BDUA/u);
  });
});

/* ------------------------------ T-07 y T-08 ------------------------------- */

describe('Presupuesto — semántica financiera (T-07, T-08, FR-06)', () => {
  it('escribe las cuatro definiciones demostrativas aprobadas', () => {
    const visible = texto(vista());

    expect(CONFIG.semantica.map((definicion) => definicion.id)).toStrictEqual([
      'asignado',
      'comprometido',
      'ejecutado',
      'disponible',
    ]);

    for (const definicion of CONFIG.semantica) {
      expect(visible).toContain(`${definicion.termino} ${definicion.definicion}`);
    }
  });

  it('enuncia la secuencia conceptual futura sin implementarla', () => {
    const visible = texto(vista());

    expect(CONFIG.secuencia).toStrictEqual([
      'Asignado',
      'Comprometido',
      'Causado/Obligado',
      'Pagado',
    ]);
    expect(visible).toContain(CONFIG.secuenciaNota);
    expect(visible).toContain('no cierra periodos y no registra asientos');
  });

  it('deja escrito que una factura no equivale a pago ni a ejecución', () => {
    const visible = texto(vista());

    expect(visible).toContain(CONFIG.facturaNota);
    expect(visible).toContain(
      'Solo los movimientos marcados como pagados y validados alimentan el ejecutado',
    );
  });

  it('no afirma oficialidad, cumplimiento contable ni pago real', () => {
    const visible = texto(vista());

    for (const patron of [
      /cifras oficiales/iu,
      /contabilidad oficial/iu,
      /pago realizado en el banco/iu,
      /cumplimiento (verificado|certificado|garantizado)/iu,
      /conciliad/iu,
    ]) {
      expect(visible).not.toMatch(patron);
    }
  });
});

/* ------------------------------ T-12 a T-15 ------------------------------- */

describe('Presupuesto — redistribución diferida (T-12, T-13, T-14, T-15)', () => {
  it('el contrato conserva los campos aprobados', () => {
    expect(Object.keys(MUNICIPALITY_REDISTRIBUCION_CONTRATO).sort()).toStrictEqual([
      'aprobacion',
      'fecha',
      'moneda',
      'motivo',
      'programaDestinoId',
      'programaOrigenId',
      'responsableRol',
      'valorPesos',
    ]);
  });

  it('la aprobación futura es configurable y no fija ningún umbral', () => {
    const { aprobacion } = MUNICIPALITY_REDISTRIBUCION_CONTRATO;

    expect(aprobacion.requiereSegundaAprobacion).toBeNull();
    expect(aprobacion.politicaId).toBeNull();
    expect(aprobacion.politicaVersion).toBeNull();
    expect(aprobacion.aprobadores).toStrictEqual([]);
    /* Ningún monto ni porcentaje se declara como umbral de segunda aprobación. */
    expect(FUENTE_CONFIG).not.toMatch(/umbral\s*[:=]/iu);
    expect(FUENTE_CONFIG).not.toMatch(/segundaAprobacionDesde|montoMinimoAprobacion/u);
  });

  it('no existe ningún control ni operación de redistribución en la vista', () => {
    const html = vista();

    expect(etiquetasDeBotones(html)).toStrictEqual([]);
    expect(html).not.toMatch(/<(form|input|select|textarea|dialog)\b/u);
    expect(html).not.toMatch(/role="dialog"/u);
    /* La vista no tiene estado local: nada puede iniciar ni guardar un borrador. */
    expect(FUENTE_VISTA).not.toContain('useState');
    expect(FUENTE_VISTA).not.toContain('useReducer');
    expect(FUENTE_VISTA).not.toContain('onClick');
  });

  it('la vista declara que no redistribuye y no simula la operación', () => {
    const visible = texto(vista());

    expect(visible).toContain(CONFIG.redistribucionNota);
    expect(visible).not.toMatch(/redistribuir ahora|mover recursos|trasladar saldo/iu);
  });
});

/* --------------------------------- T-22 ---------------------------------- */

describe('Presupuesto — población y costo promedio (T-22, FR-14)', () => {
  it('las tres filas son poblaciones base del catálogo, no programas', () => {
    const ids = MUNICIPALITY_POBLACIONES_BASE.map((poblacion) => poblacion.id);

    for (const fila of CONFIG.poblacion) {
      expect(ids).toContain(fila.poblacionId);
    }
  });

  it('muestra asignado, ejecutado, beneficiarios y costo promedio por población', () => {
    const visible = texto(vista());

    for (const fila of CONFIG.poblacion) {
      expect(visible).toContain(
        `${fila.etiqueta} ${fila.asignado.texto} ${fila.ejecutado.texto} ${fila.beneficiariosUnicos} ${fila.costoPromedio?.texto ?? ''}`,
      );
    }
  });

  it('todo costo promedio declara numerador, denominador y metodología', () => {
    const visible = texto(vista());
    const costos = [
      ...CONFIG.poblacion.map((fila) => fila.costoPromedio),
      ...municipalityProgramasPresupuestoDemo.map((programa) => programa.costoPromedio),
    ].filter((costo) => costo !== null);

    expect(costos.length).toBeGreaterThan(0);

    for (const costo of costos) {
      expect(costo.numerador).not.toBe('');
      expect(costo.denominador).not.toBe('');
      expect(costo.metodologia).not.toBe('');
      expect(visible).toContain(costo.metodologia);
    }
  });

  it('un programa sin metodología declarada no muestra costo promedio', () => {
    const formacion = municipalityProgramasPresupuestoDemo.find(
      (programa) => programa.programaId === 'pro-demo-formacion-cuidadores',
    );

    expect(formacion?.costoPromedio).toBeNull();
    expect(texto(vista())).toContain(
      `${CONFIG.etiquetas.costoPromedio}: ${CONFIG.etiquetas.sinRegistro}`,
    );
  });

  it('no atribuye gasto a personas por pertenecer a una población', () => {
    const visible = texto(vista());

    expect(visible).toContain(CONFIG.poblacionAtribucionNota);
    expect(visible).toContain(CONFIG.poblacionNota);
  });

  it('la atribución financiera por población sigue sin metodología aprobada', () => {
    for (const fila of CONFIG.poblacion) {
      expect(fila.atribucion.metodologiaId).toBeNull();
      expect(fila.atribucion.metodologiaVersion).toBeNull();
    }
  });

  it('los beneficiarios de las poblaciones no se suman para obtener el total', () => {
    const visible = texto(vista());
    /* 2.196 + 1.050 + 928 = 4.174 no aparece como total municipal. */
    expect(visible).not.toContain('4.174');
    expect(visible).not.toContain('Total de beneficiarios');
  });
});

/* --------------------------------- T-24 ---------------------------------- */

describe('Presupuesto — rotulado demostrativo y marca (T-24)', () => {
  it('muestra la etiqueta de datos demostrativos y su aclaración', () => {
    const visible = texto(vista());

    expect(visible).toContain(municipalityDemo.demo.etiqueta);
    expect(visible).toContain(municipalityDemo.demo.aclaracion);
  });

  it('no expone la marca técnica interna', () => {
    expect(vista().includes('MERDN')).toBe(false);
  });

  it('todos los datos declaran procedencia de fixture, sin integración', () => {
    expect(CONFIG.procedencia.categoria).toBe('FIXTURE_DEMO');
    expect(CONFIG.procedencia.asOf).toBeNull();
    expect(CONFIG.procedencia.sincronizacion).toBe('SIN_INTEGRACION');
  });
});

/* --------------------------------- T-23 ---------------------------------- */

describe('Presupuesto — privacidad y ausencia de red (T-23, T-21)', () => {
  it('no expone datos clínicos, personales ni compensación individual', () => {
    const visible = texto(vista());

    for (const patron of [
      /diagnóstic/iu,
      /historia clínica/iu,
      /cédula/iu,
      /salario/iu,
      /honorari/iu,
      /nómina/iu,
      /teléfono/iu,
      /\bcarrera\s+\d/iu,
      /\bcalle\s+\d/iu,
    ]) {
      expect(visible).not.toMatch(patron);
    }
  });

  it('no consulta red, almacenamiento ni recursos remotos', () => {
    for (const patron of [
      /\bfetch\s*\(/u,
      /XMLHttpRequest/u,
      /localStorage/u,
      /sessionStorage/u,
      /document\.cookie/u,
      /setInterval/u,
      /https?:\/\//u,
      /dangerouslySetInnerHTML/u,
    ]) {
      expect(FUENTE_VISTA).not.toMatch(patron);
    }
  });

  it('no ofrece obtener ni enviar archivos', () => {
    const visible = texto(vista());

    expect(visible).not.toMatch(/adjuntar|subir archivo|repositorio de documentos/iu);
    expect(vista()).not.toMatch(/<(a|img|iframe|script)\b/u);
  });
});

/* --------------------------------- T-25 ---------------------------------- */

describe('Presupuesto — accesibilidad estructural (T-25)', () => {
  it('declara un solo encabezado principal y una jerarquía coherente', () => {
    const html = shellPresupuesto();

    expect(apariciones(html, /<h1\b/gu)).toBe(1);
    expect(apariciones(vista(), /<h2\b/gu)).toBe(5);
    expect(apariciones(vista(), /<h3\b/gu)).toBe(municipalityProgramasDemo.length);
    expect(vista()).not.toMatch(/<h[456]\b/u);
  });

  it('cada sección y cada tabla tienen nombre accesible', () => {
    const html = vista();
    const secciones = [...html.matchAll(/<section[^>]*aria-labelledby="(?<id>[^"]+)"/gu)];

    expect(secciones.length).toBe(5);

    for (const seccion of secciones) {
      expect(html).toContain(`id="${seccion.groups?.id ?? ''}"`);
    }

    expect(apariciones(html, /<caption\b/gu)).toBe(2);
  });

  it('las tablas se desplazan dentro de una región enfocable y nombrada', () => {
    const regiones = [...vista().matchAll(/role="group"[^>]*tabindex="0"/gu)];

    expect(regiones.length).toBe(2);
    expect(vista()).toMatch(/<table\b/u);
  });

  it('cada fila conserva su encabezado de fila', () => {
    expect(apariciones(vista(), /<th[^>]*scope="row"/gu)).toBe(
      CONFIG.fuentesAgregadas.length + CONFIG.poblacion.length,
    );
  });
});

/* --------------------------------- T-27 ---------------------------------- */

describe('Presupuesto — no regresión de A-01, A-02 y A-03 (T-27)', () => {
  it('las vistas anteriores siguen montando su contenido propio', () => {
    for (const [modulo, titulo] of [
      ['inicio', municipalityDemo.inicio.titularesTitulo],
      ['poblacion', municipalityDemo.poblacion.titulo],
      ['territorio', municipalityDemo.territorio.titulo],
      ['programas', municipalityDemo.programas.titulo],
    ] as const) {
      const html = renderToStaticMarkup(<MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={modulo} />);

      expect(texto(main(html))).toContain(titulo);
    }
  });

  it('el selector temporal no recalcula ninguna cifra de Presupuesto', () => {
    const conMes = texto(
      main(renderToStaticMarkup(<MunicipalityShell
            periodoInicial="mes"
            sesionInicial={SESION_MUNICIPAL_FICTICIA}
            vistaInicial="presupuesto"
          />)),
    );
    const conAno = texto(
      main(renderToStaticMarkup(<MunicipalityShell
            periodoInicial="ano"
            sesionInicial={SESION_MUNICIPAL_FICTICIA}
            vistaInicial="presupuesto"
          />)),
    );

    expect(conMes).toBe(conAno);
  });
});
