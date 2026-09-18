import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { branding } from '@/config/branding';

import { MunicipalityHome } from './MunicipalityHome';
import { MunicipalityShell } from './MunicipalityShell';
import { municipalityDemo } from './municipalityConfig';
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
 * Contenido de la pantalla Inicio de Alcaldía
 * (TASK-ALCALDIA-A-01, T-06, T-07, T-08, T-09, T-10 y T-16).
 *
 * Verifica que cada valor demostrativo aprobado esté presente y en su orden, y
 * que la pantalla se lea como demostrativa. La activación real de los accesos
 * rápidos por clic y por teclado se verifica manualmente en navegador.
 */

const { inicio, demo } = municipalityDemo;

function inicioHtml(): string {
  return renderToStaticMarkup(<MunicipalityHome />);
}

/** Índice de la primera aparición de cada texto, para comprobar el orden. */
function orden(visible: string, textos: readonly string[]): readonly number[] {
  return textos.map((valor) => visible.indexOf(valor));
}

describe('MunicipalityHome — orden de las secciones', () => {
  it('muestra las seis secciones aprobadas, en su orden', () => {
    const visible = texto(inicioHtml());
    const posiciones = orden(visible, [
      inicio.titularesTitulo,
      inicio.cadenaTitulo,
      inicio.cadenaAclaracion,
      inicio.pendientesTitulo,
      inicio.accesosTitulo,
      inicio.actividadesTitulo,
    ]);

    expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
    expect([...posiciones]).toStrictEqual([...posiciones].sort((a, b) => a - b));
  });

  it('nombra cada sección con un encabezado y una jerarquía coherente', () => {
    const html = inicioHtml();

    expect(apariciones(html, /<h1\b/gu)).toBe(1);
    expect(apariciones(html, /<h2\b/gu)).toBe(4);
    expect(apariciones(html, /<h3\b/gu)).toBe(0);
    expect(apariciones(html, /aria-labelledby=/gu)).toBe(5);
  });
});

describe('MunicipalityHome — titulares', () => {
  it('muestra los cinco titulares con valor, título y aclaración exactos', () => {
    const visible = texto(inicioHtml());

    expect(inicio.kpis).toHaveLength(5);

    for (const kpi of inicio.kpis) {
      expect(visible).toContain(kpi.valor);
      expect(visible).toContain(kpi.titulo);
      expect(visible).toContain(kpi.aclaracion);
    }

    expect(visible).toContain('3.050 Personas beneficiadas Beneficiarios únicos, sin doble conteo');
    expect(visible).toContain('55 % Presupuesto ejecutado $870 M de $1.580 M asignados');
  });

  it('identifica la pantalla como demostrativa, de forma visible y accesible', () => {
    const visible = texto(inicioHtml());

    expect(visible).toContain(demo.etiqueta);
    expect(visible).toContain(demo.aclaracion);
    /* La etiqueta es texto perceptible, no un atributo `title` ni metadata. */
    expect(inicioHtml()).not.toContain(`title="${demo.etiqueta}"`);
  });

  it('no presenta ningún valor como oficial o productivo', () => {
    const visible = texto(inicioHtml());

    expect(visible).not.toMatch(/dato[s]? oficial(es)?/iu);
    expect(visible).not.toMatch(/cifra[s]? oficial(es)?/iu);
    expect(visible).not.toMatch(/en tiempo real/iu);
    expect(visible).not.toMatch(/sincroniz/iu);
    expect(visible).not.toMatch(/conectad/iu);
  });
});

describe('MunicipalityHome — de la persona a la evidencia', () => {
  it('muestra las seis etapas en orden, con valores exactos', () => {
    const visible = texto(inicioHtml());

    expect(inicio.cadena.map((etapa) => etapa.etapa)).toStrictEqual([
      'PERSONAS',
      'ATENCIÓN',
      'DINERO',
      'EVIDENCIA',
      'RESULTADO',
      'PENDIENTE',
    ]);

    const posiciones = orden(
      visible,
      inicio.cadena.map((etapa) => `${etapa.etapa} ${etapa.valor} ${etapa.aclaracion}`),
    );

    expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
    expect([...posiciones]).toStrictEqual([...posiciones].sort((a, b) => a - b));
  });

  it('muestra la aclaración de deduplicación exacta', () => {
    expect(texto(inicioHtml())).toContain(
      'Los totales deduplican por persona. Alguien puede aparecer en tres poblaciones y sigue siendo un beneficiario único.',
    );
  });
});

describe('MunicipalityHome — alertas y pendientes de gestión', () => {
  it('muestra los seis pendientes con su nivel escrito', () => {
    const visible = texto(inicioHtml());

    expect(inicio.pendientes).toHaveLength(6);

    for (const pendiente of inicio.pendientes) {
      expect(visible).toContain(`${pendiente.texto} ${pendiente.nivel}`);
    }

    expect(visible).toContain('3 facturas pendientes de aprobación Alta');
    expect(visible).toContain('4 pendientes operativos sin cierre Seguimiento');
  });

  it('aclara que las alertas clínicas individuales se gestionan en el hospital', () => {
    expect(texto(inicioHtml())).toContain(
      'Son pendientes administrativos. Las alertas clínicas individuales se gestionan en el hospital.',
    );
  });

  it('los pendientes no son controles: no abren registro ni drill-down', () => {
    const html = inicioHtml();

    for (const pendiente of inicio.pendientes) {
      expect(etiquetasDeBotones(html)).not.toContain(`${pendiente.texto} ${pendiente.nivel}`);
    }
  });
});

describe('MunicipalityHome — accesos rápidos', () => {
  it('muestra las ocho acciones aprobadas, en orden', () => {
    const html = inicioHtml();

    expect(etiquetasDeBotones(html)).toStrictEqual([
      'Ver beneficiarios',
      'Ver programas',
      'Registrar programa',
      'Ver presupuesto',
      'Subir evidencia',
      'Ver FURAG',
      'Ver ADRES',
      'Generar informe',
    ]);
  });

  it('cada acceso apunta al módulo local especificado', () => {
    expect(
      Object.fromEntries(inicio.accesos.map((acceso) => [acceso.etiqueta, acceso.destino])),
    ).toStrictEqual({
      'Ver beneficiarios': 'poblacion',
      'Ver programas': 'programas',
      'Registrar programa': 'programas',
      'Ver presupuesto': 'presupuesto',
      'Subir evidencia': 'evidencias',
      'Ver FURAG': 'furag',
      'Ver ADRES': 'adres',
      'Generar informe': 'reportes',
    });
  });

  it('ningún acceso abre formulario ni afirma haber ejecutado la operación', () => {
    const html = inicioHtml();

    expect(html).not.toMatch(/<(form|input|select|textarea|dialog)\b/u);
    expect(apariciones(html, /type="button"/gu)).toBe(inicio.accesos.length);
    expect(texto(html)).not.toMatch(/se registr|se generó|se cargó|se envió/iu);
  });

  it('navegar desde un acceso monta su módulo y actualiza el elemento activo', () => {
    /*
     * La activación por clic no puede automatizarse sin DOM. Se verifica que el
     * destino declarado por cada acceso monta exactamente ese módulo dentro del
     * shell, que es el efecto que produce el controlador.
     */
    for (const acceso of inicio.accesos) {
      const html = renderToStaticMarkup(<MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={acceso.destino} />);
      const activo =
        /<button[^>]*aria-current="true"[^>]*>(?<c>[\s\S]*?)<\/button>/u.exec(html)?.groups?.c ?? '';

      expect(html).toContain(`data-municipality-content="${acceso.destino}"`);
      expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
      expect(texto(activo)).not.toBe('');
      expect(texto(main(html))).not.toBe('');
    }
  });
});

describe('MunicipalityHome — actividades recientes', () => {
  it('muestra las seis actividades agregadas exactas, con su origen', () => {
    const visible = texto(inicioHtml());

    expect(inicio.actividades).toHaveLength(6);

    for (const actividad of inicio.actividades) {
      expect(visible).toContain(`${actividad.texto} ${actividad.cuando}`);
    }

    expect(visible).toContain(
      `Nuevo beneficiario registrado en Cazucá Hoy 8:20 a. m. · fuente ${branding.platformDisplayName}`,
    );
    expect(visible).toContain('Resultado oficial FURAG 2025 importado 14 jul 2026 · Función Pública');
  });

  it('no enlaza a registros ni muestra actor nominal', () => {
    const html = inicioHtml();

    expect(apariciones(html, /<a\b/gu)).toBe(0);

    for (const actividad of inicio.actividades) {
      expect(etiquetasDeBotones(html)).not.toContain(actividad.texto);
    }
  });
});
