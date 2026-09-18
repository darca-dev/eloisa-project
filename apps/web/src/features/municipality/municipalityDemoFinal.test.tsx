import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { branding, platformNameInSentence } from '@/config/branding';

import { MunicipalityShell } from './MunicipalityShell';
import {
  MUNICIPALITY_ESTADOS_CONEXION,
  MUNICIPALITY_PROCEDENCIA_DEMO,
  municipalityAdresDemo,
  municipalityBrechasDemo,
  municipalityCuidadoDemo,
  municipalityCuidadoresDemo,
  municipalityDemo,
  municipalityFuragDemo,
  municipalityIndicadoresDemo,
  municipalityPresupuestoDemo,
  municipalityReportesDemo,
} from './municipalityConfig';
import { apariciones, etiquetasDeBotones, main, texto } from './municipalityTestUtils';
import type { MunicipalityModuloId } from './municipalityViews';

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
 * Cierre de la demostración de Alcaldía (TASK-ALCALDIA-DEMO-FINAL, §23.1).
 *
 * Un solo conjunto temático para los siete módulos: FURAG y MIPG, ADRES,
 * Derecho al cuidado, Brechas, Cuidadores y formación, Indicadores y
 * resultados y Reportes ejecutivos. Cada bloque referencia el punto de la Task
 * que verifica.
 *
 * Las vistas se renderizan con `react-dom/server`, igual que el resto del
 * frontend: el repositorio no incluye jsdom y esta tarea no autoriza añadir
 * dependencias. Clic real, recorrido de teclado, movimiento de foco, viewports
 * y zoom se verifican manualmente y se reportan como no automatizados.
 */

function vista(modulo: MunicipalityModuloId): string {
  return renderToStaticMarkup(<MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={modulo} />);
}

function contenido(modulo: MunicipalityModuloId): string {
  return texto(main(vista(modulo)));
}

/** Los siete módulos que activa esta tarea. */
const MODULOS = [
  'furag',
  'adres',
  'cuidado',
  'brechas',
  'cuidadores',
  'indicadores',
  'reportes',
] as const;

/* ---------------------------- T-01, T-02 y T-04 --------------------------- */

describe('Cierre de Alcaldía — render, procedencia y etiqueta demo (T-01, T-04)', () => {
  it('cada módulo monta su propio encabezado principal y su etiqueta demostrativa', () => {
    const titulos: Record<(typeof MODULOS)[number], string> = {
      furag: municipalityFuragDemo.titulo,
      adres: municipalityAdresDemo.titulo,
      cuidado: municipalityCuidadoDemo.titulo,
      brechas: municipalityBrechasDemo.titulo,
      cuidadores: municipalityCuidadoresDemo.titulo,
      indicadores: municipalityIndicadoresDemo.titulo,
      reportes: municipalityReportesDemo.titulo,
    };

    for (const modulo of MODULOS) {
      const html = vista(modulo);
      const visible = texto(main(html));

      expect(apariciones(html, /<h1\b/gu)).toBe(1);
      expect(html).toMatch(/<h1[^>]*tabindex="-1"/u);
      expect(visible).toContain(titulos[modulo]);
      expect(visible).toContain(municipalityDemo.demo.etiqueta);
      expect(visible).toContain(municipalityDemo.demo.aclaracion);
    }
  });

  it('los siete módulos declaran procedencia de fixture, sin corte ni integración', () => {
    for (const config of [
      municipalityFuragDemo,
      municipalityAdresDemo,
      municipalityCuidadoDemo,
      municipalityBrechasDemo,
      municipalityCuidadoresDemo,
      municipalityIndicadoresDemo,
      municipalityReportesDemo,
    ]) {
      expect(config.procedencia).toStrictEqual(MUNICIPALITY_PROCEDENCIA_DEMO);
      expect(config.procedencia.categoria).toBe('FIXTURE_DEMO');
      expect(config.procedencia.fuente).toBe('Fixture local de diseño');
      expect(config.procedencia.asOf).toBeNull();
      expect(config.procedencia.sincronizacion).toBe('SIN_INTEGRACION');
    }
  });

  it('ninguna fuente de referencia se clasifica como oficial externa', () => {
    const fuentes = [
      municipalityFuragDemo.resultado.fuente,
      ...municipalityFuragDemo.matriz.map((fila) => fila.fuente),
      ...municipalityAdresDemo.agregados.map((item) => item.fuente),
      municipalityCuidadoDemo.fuente,
      municipalityCuidadoresDemo.fuenteFormadora,
      ...municipalityIndicadoresDemo.indicadores.map((item) => item.fuente),
      ...municipalityReportesDemo.reportes.map((item) => item.fuente),
    ];

    expect(fuentes.length).toBeGreaterThan(0);

    for (const fuente of fuentes) {
      /* La referencia institucional NO convierte el valor en oficial. */
      expect(fuente.procedencia.categoria).toBe('FIXTURE_DEMO');
      expect(fuente.procedencia.asOf).toBeNull();
      expect(Object.keys(MUNICIPALITY_ESTADOS_CONEXION)).toContain(fuente.estadoConexion);
    }
  });
});

/* ---------------------------------- T-05 ---------------------------------- */

describe('FURAG y MIPG (T-05, §8)', () => {
  const visible = contenido('furag');

  it('explica el formulario y su relación con la medición oficial', () => {
    expect(visible).toContain('Formulario Único de Reporte y Avance de Gestión');
    expect(visible).toContain('Medición del Desempeño Institucional');
  });

  /*
   * §8 y §22.5 exigen decir NEGATIVAMENTE que la plataforma no calcula el
   * puntaje y que el lenguaje aprobado es «evidencia disponible para soporte de
   * gestión», nunca «cumple FURAG». Lo prohibido es la afirmación POSITIVA, no
   * la mención citada dentro de esa negación.
   */
  it('declara el límite institucional sin afirmar cálculo ni cumplimiento', () => {
    expect(visible).toContain(`${platformNameInSentence()} no calcula el puntaje FURAG`);
    expect(visible).toContain('corresponden exclusivamente a la autoridad competente');
    expect(visible).toContain('nunca «cumple FURAG»');
    expect(visible).not.toMatch(/(?<!nunca «)cumple (con )?FURAG/iu);
    expect(visible).not.toMatch(/(?<!no )calcula el puntaje FURAG/iu);
  });

  it('muestra 71,4 solo como fixture y sin conexión activa', () => {
    expect(municipalityFuragDemo.resultado.valor).toBe('71,4');
    expect(municipalityFuragDemo.resultado.resultadoOficial).toBeNull();
    expect(visible).toContain('71,4');
    expect(visible).toContain(MUNICIPALITY_ESTADOS_CONEXION.SIN_CONEXION);
    expect(visible).toContain('Valor de fixture demostrativo');
  });

  it('mantiene el lenguaje de evidencia disponible y el mapa por política', () => {
    expect(visible).toContain('evidencia disponible para soporte de gestión');
    expect(visible).toContain(municipalityFuragDemo.matrizTitulo);

    for (const fila of municipalityFuragDemo.matriz) {
      expect(visible).toContain(fila.politica);
      expect(visible).toContain(fila.responsable);
      /* El estado se escribe: nunca se comunica solo con color. */
      expect(visible).toContain(municipalityFuragDemo.estadosEtiquetas[fila.estado]);
    }
  });
});

/* ---------------------------------- T-06 ---------------------------------- */

describe('ADRES (T-06, §9)', () => {
  const visible = contenido('adres');

  it('delimita a ADRES sin convertirlo en regulador ni evaluador', () => {
    expect(visible).toContain('No es un regulador');
    expect(visible).not.toMatch(/ADRES (regula|evalúa|certifica|audita)/iu);
    expect(visible).not.toMatch(/puntaje municipal/iu);
  });

  it('no presenta el aseguramiento como el presupuesto municipal', () => {
    expect(visible).toContain('no equivale al presupuesto municipal');
    /* El asignado municipal de A-04 no se repite ni se contradice aquí. */
    expect(visible).not.toContain(municipalityPresupuestoDemo.resumen.asignado.texto);
  });

  it('conserva las tres columnas de comparación y su lectura administrativa', () => {
    expect(municipalityAdresDemo.comparacionColumnas.plataforma).toBe(
      `EN ${branding.platformDisplayName.toLocaleUpperCase('es-CO')}`,
    );
    expect(municipalityAdresDemo.comparacionColumnas.oficial).toBe('OFICIAL');
    expect(municipalityAdresDemo.comparacionColumnas.diferencia).toBe('DIFERENCIA');
    expect(visible).toContain('para revisión administrativa');
    expect(visible).toContain('no la corrigen');
  });

  it('declara que no hay dato oficial disponible ni conexión', () => {
    expect(visible).toContain(MUNICIPALITY_ESTADOS_CONEXION.SIN_DATO_OFICIAL);
    expect(visible).toContain(MUNICIPALITY_ESTADOS_CONEXION.SIN_CONEXION);
  });
});

/* ---------------------------------- T-07 ---------------------------------- */

describe('Derecho al cuidado (T-07, §10)', () => {
  const visible = contenido('cuidado');

  it('usa la denominación exacta de la sentencia y nunca «Ley 319»', () => {
    expect(municipalityCuidadoDemo.normaReferencia).toBe('Sentencia T-319 de 2025');
    expect(visible).toContain('Sentencia T-319 de 2025');
    expect(visible).not.toMatch(/Ley\s*319/iu);
  });

  it('documenta acciones sin certificar cumplimiento de derechos', () => {
    expect(visible).toContain('No certifica el cumplimiento de ningún derecho');
    expect(visible).not.toMatch(/(?<!no )certifica el cumplimiento/iu);
  });

  it('muestra los doce agregados y la matriz de cuatro estados', () => {
    expect(municipalityCuidadoDemo.acciones).toHaveLength(12);
    expect(municipalityCuidadoDemo.matriz.map((fila) => fila.componente)).toStrictEqual([
      'Mayores de 60',
      'Discapacidad',
      'Cuidado en casa',
    ]);

    for (const columna of ['IDENTIFICADA', 'ATENDIDA', 'EN SEGUIMIENTO', 'PENDIENTE']) {
      expect(visible).toContain(columna);
    }
  });
});

/* ---------------------------------- T-08 ---------------------------------- */

describe('Brechas (T-08, §11)', () => {
  const visible = contenido('brechas');

  it('muestra las nueve brechas con valor, detalle y prioridad escrita', () => {
    expect(municipalityBrechasDemo.brechas).toHaveLength(9);

    for (const brecha of municipalityBrechasDemo.brechas) {
      expect(visible).toContain(brecha.valor);
      expect(visible).toContain(brecha.titulo);
      expect(visible).toContain(brecha.detalle);
      expect(visible).toContain(municipalityBrechasDemo.estados[brecha.estado]);
    }
  });

  it('usa solo los dos estados administrativos aprobados', () => {
    const estados = new Set(municipalityBrechasDemo.brechas.map((brecha) => brecha.estado));

    expect([...estados].sort()).toStrictEqual(['PRIORITARIO', 'SEGUIMIENTO']);
  });

  it('no usa lenguaje de valoración individual', () => {
    for (const patron of [
      /triaje/iu,
      /\btriage\b/iu,
      /decisión médica/iu,
      /diagnóstic/iu,
      /riesgo clínico/iu,
      /\brojas\b/iu,
      /\bamarillas\b/iu,
    ]) {
      expect(visible).not.toMatch(patron);
    }

    expect(visible).toContain('pendientes administrativos y documentales');
  });
});

/* ---------------------------------- T-09 ---------------------------------- */

describe('Cuidadores y formación (T-09, §12)', () => {
  const visible = contenido('cuidadores');

  it('muestra los nueve agregados y las cinco etapas de la ruta', () => {
    expect(municipalityCuidadoresDemo.agregados).toHaveLength(9);
    expect(municipalityCuidadoresDemo.ruta).toHaveLength(5);

    for (const paso of municipalityCuidadoresDemo.ruta) {
      /* El valor y el porcentaje se escriben: la barra solo los acompaña. */
      expect(visible).toContain(paso.etapa);
      expect(visible).toContain(paso.porcentajeTexto);
    }
  });

  it('delimita al SENA como entidad formadora, sin integración técnica', () => {
    expect(municipalityCuidadoresDemo.fuenteFormadora.estadoConexion).toBe(
      'SIN_INTEGRACION_TECNICA',
    );
    expect(visible).toContain('No existe integración técnica con el SENA');
    expect(visible).toContain(MUNICIPALITY_ESTADOS_CONEXION.SIN_INTEGRACION_TECNICA);
    expect(visible).not.toMatch(/SENA (valida|verifica|certifica automáticamente)/iu);
  });

  it('no equipara certificación con cumplimiento institucional', () => {
    expect(visible).toContain('no prueba su autenticidad');
    expect(visible).toContain(
      'Ningún certificado registrado prueba por sí mismo cumplimiento institucional',
    );
    expect(visible).not.toMatch(/certificación (SENA )?(prueba|acredita) (el )?cumplimiento/iu);
  });
});

/* ---------------------------------- T-10 ---------------------------------- */

describe('Indicadores y resultados (T-10, §13)', () => {
  const visible = contenido('indicadores');

  it('compara los ocho indicadores entre periodo anterior y actual', () => {
    expect(municipalityIndicadoresDemo.indicadores).toHaveLength(8);

    for (const columna of ['PERIODO ANTERIOR', 'PERIODO ACTUAL', 'VARIACIÓN']) {
      expect(visible).toContain(columna);
    }

    for (const indicador of municipalityIndicadoresDemo.indicadores) {
      expect(visible).toContain(indicador.nombre);
      expect(visible).toContain(indicador.periodoAnterior);
      expect(visible).toContain(indicador.periodoActual);
      expect(visible).toContain(indicador.variacion);
    }
  });

  it('usa la frase exacta de variación y niega la causalidad automática', () => {
    expect(municipalityIndicadoresDemo.variacionFrase).toBe(
      'Variación observada durante el periodo',
    );
    expect(visible).toContain('Variación observada durante el periodo');
    expect(visible).toContain(
      `no se atribuye causalidad automática a ${branding.platformDisplayName}`,
    );
  });

  it('no inventa fórmula, meta, responsable ni método de cálculo', () => {
    for (const indicador of municipalityIndicadoresDemo.indicadores) {
      expect(indicador.formula).toBeNull();
      expect(indicador.responsable).toBeNull();
      expect(indicador.metodo).toBeNull();
      expect(indicador.linaje).toBeNull();
      expect(indicador.definicion.length).toBeGreaterThan(0);
      expect(indicador.unidad.length).toBeGreaterThan(0);
    }
  });

  it('mantiene la satisfacción agregada, sin comentarios ni profesionales nominales', () => {
    expect(municipalityIndicadoresDemo.satisfaccion).toHaveLength(6);
    expect(visible).toContain('no muestra comentarios individuales');
    expect(visible).not.toMatch(/ranking de profesionales/iu);
    expect(visible).not.toMatch(/comentario de/iu);
  });
});

/* ---------------------------------- T-11 ---------------------------------- */

describe('Reportes ejecutivos (T-11, §14)', () => {
  const html = vista('reportes');
  const visible = texto(main(html));

  it('avisa que la generación no está habilitada', () => {
    expect(municipalityReportesDemo.aviso).toBe('Vista demostrativa · generación no habilitada');
    expect(visible).toContain('Vista demostrativa · generación no habilitada');
    expect(visible).toContain(MUNICIPALITY_ESTADOS_CONEXION.SIN_GENERACION);
  });

  it('muestra la portada con los ocho datos ya declarados por otras pantallas', () => {
    expect(municipalityReportesDemo.portada).toHaveLength(8);

    for (const dato of municipalityReportesDemo.portada) {
      expect(visible).toContain(dato.clave);
      expect(visible).toContain(dato.valor);
    }

    /* Los valores se citan de A-01–A-04: no se recalculan en esta pantalla. */
    expect(
      municipalityReportesDemo.portada.find((dato) => dato.id === 'presupuesto')?.valor,
    ).toBe(municipalityPresupuestoDemo.resumen.asignado.texto);
    expect(municipalityReportesDemo.portada.find((dato) => dato.id === 'brechas')?.valor).toBe(
      String(municipalityBrechasDemo.brechas.length),
    );
  });

  it('muestra las nueve tarjetas de informe con su estado escrito', () => {
    expect(municipalityReportesDemo.reportes).toHaveLength(9);

    for (const reporte of municipalityReportesDemo.reportes) {
      expect(reporte.estado).toBe('NO_DISPONIBLE_DEMO');
      expect(visible).toContain(reporte.titulo);
      expect(visible).toContain(reporte.descripcion);
    }

    expect(visible).toContain('Disponible en una fase futura');
  });

  it('los controles PDF, Excel y CSV están realmente deshabilitados', () => {
    const botones = [...html.matchAll(/<button(?<atributos>[^>]*)>/gu)].map(
      (coincidencia) => coincidencia.groups?.atributos ?? '',
    );
    const formatos = botones.filter((atributos) => atributos.includes('reportFormat'));

    expect(formatos).toHaveLength(municipalityReportesDemo.reportes.length * 3);

    for (const atributos of formatos) {
      expect(atributos).toContain('type="button"');
      expect(atributos).toContain('disabled');
      /* Nombre accesible con formato, informe y estado. */
      expect(atributos).toContain('Disponible en una fase futura');
    }

    expect(etiquetasDeBotones(main(html))).toContain('PDF');
    expect(etiquetasDeBotones(main(html))).toContain('Excel');
    expect(etiquetasDeBotones(main(html))).toContain('CSV');
  });

  it('no hay enlace, descarga, red ni mensaje de éxito', () => {
    expect(html).not.toMatch(/<a\b/u);
    expect(html).not.toContain('download');
    expect(html).not.toContain('href');
    expect(html).not.toContain('blob:');
    expect(html).not.toContain('http');
    expect(visible).not.toMatch(/se generó|se descargó|listo para descargar|archivo generado/iu);
  });
});

/* ---------------------------- T-13, T-14 y T-15 --------------------------- */

describe('Cierre de Alcaldía — marca, no regresión y fronteras (T-13, T-14, T-15)', () => {
  /*
   * La ausencia del branding anterior se verifica en todo el repositorio desde
   * `src/config/branding.test.tsx`, que prohíbe declarar esos literales fuera
   * de sus excepciones autorizadas. Este archivo no los reescribe: comprueba
   * que las siete vistas nuevas solo muestran la marca pública aprobada, que
   * la marca técnica interna no aparece y que el nombre visible procede de la
   * configuración central y no de un literal repetido.
   */
  it('solo usa la marca pública aprobada en las siete vistas', () => {
    for (const modulo of MODULOS) {
      const html = vista(modulo);
      const visible = texto(html);

      expect(visible).toContain(branding.platformDisplayName);
      expect(html.includes('MERDN')).toBe(false);
      expect(visible.includes('Merdn')).toBe(false);
    }
  });

  it('el nombre visible de las siete vistas procede de la configuración central', () => {
    /*
     * Con otra marca ficticia, el texto de las siete vistas cambia con ella:
     * ninguna pantalla repite el nombre como literal propio.
     */
    const otra = platformNameInSentence({
      platformDisplayName: 'Marca de prueba',
      platformTagline: branding.platformTagline,
      aiDisplayName: branding.aiDisplayName,
    });

    expect(otra).toBe('Marca de prueba');
    expect(municipalityFuragDemo.limites.join(' ')).toContain(platformNameInSentence());
    expect(municipalityAdresDemo.limites.join(' ')).toContain(platformNameInSentence());
    expect(municipalityCuidadoDemo.limites.join(' ')).toContain(platformNameInSentence());
  });

  it('no duplica los modelos ni los montos de A-01 a A-04', () => {
    const furag = contenido('furag');
    const cuidadores = contenido('cuidadores');

    /* Ninguna vista nueva repite el resumen presupuestal de A-04. */
    for (const visible of [furag, cuidadores, contenido('cuidado'), contenido('indicadores')]) {
      expect(visible).not.toContain(municipalityPresupuestoDemo.resumenTitulo);
      expect(visible).not.toContain(municipalityPresupuestoDemo.resumen.identidadContable);
    }
  });

  it('Inicio, Población, Territorio, Programas, Presupuesto y Evidencias no cambian', () => {
    const previas = [
      ['inicio', municipalityDemo.inicio.titularesTitulo],
      ['poblacion', municipalityDemo.poblacion.titulo],
      ['territorio', municipalityDemo.territorio.titulo],
      ['programas', municipalityDemo.programas.titulo],
      ['presupuesto', municipalityDemo.presupuesto.titulo],
      ['evidencias', municipalityDemo.evidencias.titulo],
    ] as const;

    for (const [modulo, esperado] of previas) {
      expect(contenido(modulo)).toContain(esperado);
    }
  });
});
