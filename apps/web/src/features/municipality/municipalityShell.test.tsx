import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { branding, platformNameInSentence } from '@/config/branding';

import { MunicipalityShell } from './MunicipalityShell';
import {
  MUNICIPALITY_NAV_ITEMS,
  MUNICIPALITY_NOTA_PROXIMAMENTE,
  MUNICIPALITY_TEXTO_PROXIMAMENTE,
  municipalityDemo,
} from './municipalityConfig';
import type { MunicipalityConfig } from './municipalityConfig';
import { apariciones, etiquetasDeBotones, main, texto } from './municipalityTestUtils';
import { MUNICIPALITY_MODULOS, tieneContenidoPropio } from './municipalityViews';
import type { MunicipalityModuloId, MunicipalityPeriodoId } from './municipalityViews';

/**
 * Shell, sidebar, topbar y estados «Próximamente» de Alcaldía
 * (TASK-ALCALDIA-A-01, T-01, T-02, T-03, T-04, T-05, T-13, T-15 y T-16;
 * TASK-ALCALDIA-A-02, T-01, T-13 y T-15).
 *
 * El shell se monta con `react-dom/server`: el repositorio no incluye jsdom ni
 * una librería de testing con DOM y esta tarea no autoriza añadir dependencias.
 * El resultado de cada vista se comprueba montándola; la activación real por
 * clic, el recorrido de teclado y el movimiento de foco al cambiar de vista se
 * verifican manualmente en navegador y se reportan como no automatizados.
 *
 * La spec 022 pone una FRONTERA DE SESIÓN delante de esta composición: desde
 * ella, `/municipality` no monta ninguna vista hasta que el servidor confirma
 * una sesión institucional con el rol `MUNICIPAL_VIEWER` EXACTO. Estas pruebas
 * son regresión de la composición AUTORIZADA y por eso inyectan un contexto
 * ficticio con ese rol: `renderToStaticMarkup` no ejecuta efectos, de modo que
 * sin inyectarlo se renderizaría siempre el estado «comprobando».
 *
 * Inyectar el contexto no concede acceso a nadie —el servidor sigue decidiendo
 * cada consulta— y la ruta no lo pasa. Lo que la frontera hace y deja de hacer
 * se prueba aparte, en `municipalitySession.test.tsx`.
 */

/**
 * Contexto institucional FICTICIO con el rol municipal.
 *
 * Es el único que abre esta composición. Nada de lo que contiene es real y
 * ninguna prueba de este archivo depende de sus valores.
 */
const SESION_MUNICIPAL_FICTICIA = {
  role: 'MUNICIPAL_VIEWER',
  expiresAt: '2026-08-27T20:00:00.000Z',
  institution: { name: 'Entidad institucional de pruebas' },
  actorDisplay: 'Acceso institucional',
} as const;

function shell(vista?: MunicipalityModuloId, periodo?: MunicipalityPeriodoId): string {
  if (vista === undefined) {
    return renderToStaticMarkup(
      <MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} />,
    );
  }

  return renderToStaticMarkup(
    periodo === undefined ? (
      <MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={vista} />
    ) : (
      <MunicipalityShell
        periodoInicial={periodo}
        sesionInicial={SESION_MUNICIPAL_FICTICIA}
        vistaInicial={vista}
      />
    ),
  );
}

describe('MunicipalityShell — composición y carga inicial', () => {
  it('monta sidebar, topbar y una sola región principal', () => {
    const html = shell();

    expect(apariciones(html, /<aside\b/gu)).toBe(1);
    expect(apariciones(html, /<header\b/gu)).toBe(1);
    expect(apariciones(html, /<nav\b/gu)).toBe(1);
    expect(apariciones(html, /<main\b/gu)).toBe(1);
  });

  it('activa Inicio y monta la pantalla Inicio completa', () => {
    const html = shell();

    expect(html).toContain('data-municipality-content="inicio"');
    expect(texto(main(html))).toContain(municipalityDemo.inicio.titularesTitulo);
    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
  });

  it('declara un único encabezado principal', () => {
    for (const modulo of MUNICIPALITY_MODULOS) {
      expect(apariciones(shell(modulo), /<h1\b/gu)).toBe(1);
    }
  });
});

describe('MunicipalityShell — identidad, topbar y perfil', () => {
  it('muestra la identidad institucional aprobada', () => {
    const visible = texto(shell());

    expect(visible).toContain(branding.platformDisplayName);
    expect(visible).toContain('Alcaldía de Soacha');
    expect(visible).toContain('Gestión territorial y evidencia');
  });

  it('muestra el encabezado del panel y el aviso de privacidad exactos', () => {
    const visible = texto(shell());

    expect(visible).toContain('PANEL DE GESTIÓN TERRITORIAL, RESULTADOS Y EVIDENCIA');
    expect(visible).toContain(
      'Datos agregados y anonimizados · sin acceso a historias clínicas individuales',
    );
  });

  it('muestra el perfil institucional agregado, sin control de cuenta', () => {
    const html = shell();
    const visible = texto(html);

    expect(visible).toContain('SS');
    expect(visible).toContain('Secretaría de Salud');
    expect(visible).toContain('Perfil de consulta agregada');
    /* El perfil es identidad, no acción: no es botón ni enlace. */
    expect(etiquetasDeBotones(html)).not.toContain('Secretaría de Salud');
    expect(apariciones(html, /<a\b/gu)).toBe(0);
  });

  it('conserva la estructura con otra institución y otro perfil ficticios', () => {
    const otra: MunicipalityConfig = {
      ...municipalityDemo,
      identidad: {
        ...municipalityDemo.identidad,
        entidad: 'Alcaldía de Villa Ficticia',
        bajada: 'Gestión territorial de prueba',
      },
      perfil: { iniciales: 'DP', nombre: 'Despacho de Prueba', perfil: 'Perfil de ejemplo' },
    };
    const html = renderToStaticMarkup(
      <MunicipalityShell config={otra} sesionInicial={SESION_MUNICIPAL_FICTICIA} />,
    );
    const visible = texto(html);

    expect(visible).toContain('Alcaldía de Villa Ficticia');
    expect(visible).toContain('Despacho de Prueba');
    expect(visible).toContain('Perfil de ejemplo');
    expect(visible).not.toContain('Alcaldía de Soacha');
    expect(apariciones(html, /<main\b/gu)).toBe(1);
    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
  });
});

describe('MunicipalityShell — sidebar', () => {
  it('muestra los trece elementos del menú, en orden exacto', () => {
    const html = shell();
    const nav = /<nav\b[^>]*>(?<contenido>[\s\S]*?)<\/nav>/u.exec(html)?.groups?.contenido ?? '';

    expect(etiquetasDeBotones(nav)).toStrictEqual([
      'Inicio',
      'Población beneficiaria',
      'Territorio',
      'Programas',
      'Presupuesto y ejecución',
      'Evidencias',
      'FURAG y MIPG',
      'ADRES',
      'Derecho al cuidado',
      'Brechas',
      'Cuidadores y formación',
      'Indicadores y resultados',
      'Reportes ejecutivos',
    ]);
  });

  it('dibuja un icono SVG decorativo por elemento del menú, sin emojis', () => {
    const html = shell();
    const nav = /<nav\b[^>]*>(?<contenido>[\s\S]*?)<\/nav>/u.exec(html)?.groups?.contenido ?? '';

    expect(apariciones(nav, /<svg\b/gu)).toBe(MUNICIPALITY_NAV_ITEMS.length);
    expect(apariciones(nav, /aria-hidden="true"/gu)).toBe(MUNICIPALITY_NAV_ITEMS.length);
    expect(apariciones(nav, /focusable="false"/gu)).toBe(MUNICIPALITY_NAV_ITEMS.length);
    expect(nav).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('todos los elementos del menú son botones de navegación local', () => {
    const html = shell();
    const nav = /<nav\b[^>]*>(?<contenido>[\s\S]*?)<\/nav>/u.exec(html)?.groups?.contenido ?? '';

    expect(apariciones(nav, /<button type="button"/gu)).toBe(MUNICIPALITY_NAV_ITEMS.length);
    /* Ni enlaces muertos ni rutas nuevas: la navegación es estado local. */
    expect(nav).not.toContain('href');
  });

  it('marca un solo elemento activo por vista, y es el módulo montado', () => {
    for (const modulo of MUNICIPALITY_MODULOS) {
      const html = shell(modulo);
      const etiqueta = MUNICIPALITY_NAV_ITEMS.find((item) => item.id === modulo)?.etiqueta ?? '';
      const activo =
        /<button[^>]*aria-current="true"[^>]*>(?<contenido>[\s\S]*?)<\/button>/u.exec(html)?.groups
          ?.contenido ?? '';

      expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
      expect(texto(activo)).toBe(etiqueta);
    }
  });
});

describe('MunicipalityShell — selector temporal', () => {
  it('muestra los cinco periodos como botones agrupados y anunciados', () => {
    const html = shell();
    const grupo = /<div[^>]*role="group"[^>]*>(?<contenido>[\s\S]*?)<\/div>/u.exec(html)?.groups
      ?.contenido ?? '';

    expect(etiquetasDeBotones(grupo)).toStrictEqual([
      'Este mes',
      'Trimestre',
      'Semestre',
      'Año',
      'Personalizado',
    ]);
    expect(apariciones(grupo, /aria-pressed="true"/gu)).toBe(1);
    expect(apariciones(grupo, /aria-pressed="false"/gu)).toBe(4);
    expect(grupo).toContain('Periodo de consulta');
  });

  it('inicia con «Este mes» seleccionado y la selección es exclusiva', () => {
    const inicial = /<button[^>]*aria-pressed="true"[^>]*>(?<c>[\s\S]*?)<\/button>/u.exec(shell())
      ?.groups?.c;

    expect(texto(inicial ?? '')).toBe('Este mes');

    const personalizado = shell('inicio', 'personalizado');
    const activo = /<button[^>]*aria-pressed="true"[^>]*>(?<c>[\s\S]*?)<\/button>/u.exec(
      personalizado,
    )?.groups?.c;

    expect(texto(activo ?? '')).toBe('Personalizado');
    expect(apariciones(personalizado, /aria-pressed="true"/gu)).toBe(1);
  });

  it('aclara que el periodo no recalcula los datos demostrativos', () => {
    const visible = texto(shell());

    expect(visible).toContain(municipalityDemo.demo.notaPeriodo);
  });

  it('«Personalizado» no abre calendario, formulario ni modal', () => {
    const html = shell('inicio', 'personalizado');

    expect(html).not.toMatch(/<(dialog|form|input|select|textarea)\b/u);
    expect(html).not.toContain('role="dialog"');
  });
});

describe('MunicipalityShell — vistas con contenido propio', () => {
  /* TASK-ALCALDIA-A-02, T-01: el shell monta la vista del módulo seleccionado. */
  it('Población beneficiaria monta su propia vista dentro del shell', () => {
    const html = shell('poblacion');
    const contenido = texto(main(html));

    expect(html).toContain('data-municipality-content="poblacion"');
    expect(contenido).toContain(municipalityDemo.poblacion.titulo);
    expect(contenido).toContain(municipalityDemo.poblacion.objetivoTitulo);
    expect(contenido).not.toContain(MUNICIPALITY_TEXTO_PROXIMAMENTE);
    /* Un solo item activo, y es el del módulo montado. */
    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
  });

  it('Territorio monta su propia vista dentro del shell', () => {
    const html = shell('territorio');
    const contenido = texto(main(html));

    expect(html).toContain('data-municipality-content="territorio"');
    expect(contenido).toContain(municipalityDemo.territorio.titulo);
    expect(contenido).toContain(municipalityDemo.territorio.columnas.zona);
    expect(contenido).not.toContain(MUNICIPALITY_TEXTO_PROXIMAMENTE);
    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
  });

  /* TASK-ALCALDIA-A-03, T-01: Programas pasa a montar contenido propio. */
  it('Programas monta su propia vista dentro del shell', () => {
    const html = shell('programas');
    const contenido = texto(main(html));

    expect(html).toContain('data-municipality-content="programas"');
    expect(contenido).toContain(municipalityDemo.programas.titulo);
    expect(contenido).toContain(municipalityDemo.programas.descripcion);
    expect(contenido).not.toContain(MUNICIPALITY_TEXTO_PROXIMAMENTE);
    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
  });

  /*
   * TASK-ALCALDIA-A-04, T-01: Presupuesto y ejecución y Evidencias pasan a
   * montar contenido propio. El shell solo las monta.
   */
  it('Presupuesto y ejecución monta su propia vista dentro del shell', () => {
    const html = shell('presupuesto');
    const contenido = texto(main(html));

    expect(html).toContain('data-municipality-content="presupuesto"');
    expect(contenido).toContain(municipalityDemo.presupuesto.titulo);
    expect(contenido).toContain(municipalityDemo.presupuesto.descripcion);
    expect(contenido).toContain(municipalityDemo.presupuesto.resumen.porcentajeEjecucionTexto);
    expect(contenido).not.toContain(MUNICIPALITY_TEXTO_PROXIMAMENTE);
    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
  });

  it('Evidencias monta su propia vista dentro del shell', () => {
    const html = shell('evidencias');
    const contenido = texto(main(html));

    expect(html).toContain('data-municipality-content="evidencias"');
    expect(contenido).toContain(municipalityDemo.evidencias.titulo);
    expect(contenido).toContain(municipalityDemo.evidencias.movimientosTitulo);
    expect(contenido).toContain(municipalityDemo.evidencias.nivel.porcentajeTexto);
    expect(contenido).not.toContain(MUNICIPALITY_TEXTO_PROXIMAMENTE);
    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
  });

  it('el shell no acumula el marcado de dos vistas propias a la vez', () => {
    const presupuesto = texto(main(shell('presupuesto')));
    const evidencias = texto(main(shell('evidencias')));

    expect(presupuesto).not.toContain(municipalityDemo.evidencias.movimientosTitulo);
    expect(evidencias).not.toContain(municipalityDemo.presupuesto.resumenTitulo);
  });

  it('el detalle «Ver evidencia» no está abierto al montar Evidencias', () => {
    expect(shell('evidencias')).not.toMatch(/role="dialog"/u);
  });

  it('cada vista propia conserva sidebar, topbar, selector y perfil', () => {
    for (const modulo of MUNICIPALITY_MODULOS.filter((id) => tieneContenidoPropio(id))) {
      const html = shell(modulo);

      expect(apariciones(html, /<aside\b/gu)).toBe(1);
      expect(apariciones(html, /<header\b/gu)).toBe(1);
      expect(apariciones(html, /<main\b/gu)).toBe(1);
      expect(apariciones(html, /<h1\b/gu)).toBe(1);
      expect(texto(html)).toContain('Perfil de consulta agregada');
      expect(texto(html)).toContain(municipalityDemo.demo.notaPeriodo);
      expect(apariciones(html, /aria-pressed="true"/gu)).toBe(1);
    }
  });

  it('los accesos rápidos de Programas apuntan al módulo Programas', () => {
    const destinos = municipalityDemo.inicio.accesos
      .filter((acceso) => acceso.destino === 'programas')
      .map((acceso) => acceso.etiqueta);

    expect(destinos).toStrictEqual(['Ver programas', 'Registrar programa']);

    const botones = etiquetasDeBotones(main(shell()));

    expect(botones).toContain('Ver programas');
    expect(botones).toContain('Registrar programa');
  });

  it('el acceso rápido «Ver beneficiarios» apunta a Población beneficiaria', () => {
    const acceso = municipalityDemo.inicio.accesos.find((item) => item.destino === 'poblacion');

    expect(acceso?.etiqueta).toBe('Ver beneficiarios');
    expect(etiquetasDeBotones(main(shell()))).toContain('Ver beneficiarios');
  });

  it('el selector temporal no recalcula los fixtures de las vistas propias', () => {
    for (const modulo of MUNICIPALITY_MODULOS) {
      const conMes = texto(main(shell(modulo, 'mes')));
      const conAno = texto(main(shell(modulo, 'ano')));

      expect(conMes).toBe(conAno);
    }
  });
});

/*
 * TASK-ALCALDIA-DEMO-FINAL, T-01 y T-02: los siete módulos restantes pasan a
 * montar contenido propio y ninguno conserva «Próximamente». El estado neutro
 * y su copy se conservan en el código porque el rollback conceptual de la Task
 * consiste en devolver esos módulos a ese estado.
 */
describe('MunicipalityShell — cierre de la demostración de Alcaldía', () => {
  const finales = [
    'furag',
    'adres',
    'cuidado',
    'brechas',
    'cuidadores',
    'indicadores',
    'reportes',
  ] as const;

  it('los trece módulos montan contenido propio y ninguno queda pendiente', () => {
    for (const modulo of MUNICIPALITY_MODULOS) {
      const html = shell(modulo);
      const contenido = texto(main(html));

      expect(tieneContenidoPropio(modulo)).toBe(true);
      expect(html).toContain(`data-municipality-content="${modulo}"`);
      expect(contenido).not.toContain(MUNICIPALITY_TEXTO_PROXIMAMENTE);
      /* El shell, la topbar, el selector y el perfil siguen presentes. */
      expect(texto(html)).toContain('Perfil de consulta agregada');
      expect(apariciones(html, /aria-pressed="true"/gu)).toBe(1);
      expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
      expect(apariciones(html, /<main\b/gu)).toBe(1);
      expect(apariciones(html, /<h1\b/gu)).toBe(1);
    }
  });

  it('cada uno de los siete módulos monta su propio encabezado', () => {
    const titulos: Record<(typeof finales)[number], string> = {
      furag: municipalityDemo.furag.titulo,
      adres: municipalityDemo.adres.titulo,
      cuidado: municipalityDemo.cuidado.titulo,
      brechas: municipalityDemo.brechas.titulo,
      cuidadores: municipalityDemo.cuidadores.titulo,
      indicadores: municipalityDemo.indicadores.titulo,
      reportes: municipalityDemo.reportes.titulo,
    };

    for (const modulo of finales) {
      const contenido = texto(main(shell(modulo)));

      expect(contenido).toContain(titulos[modulo]);
      expect(contenido).toContain(municipalityDemo.demo.etiqueta);
    }
  });

  it('el shell no acumula el marcado de dos vistas nuevas a la vez', () => {
    const furag = texto(main(shell('furag')));
    const reportes = texto(main(shell('reportes')));

    expect(furag).not.toContain(municipalityDemo.reportes.portadaEtiqueta);
    expect(reportes).not.toContain(municipalityDemo.furag.matrizTitulo);
  });

  it('el estado neutro sigue disponible para el rollback conceptual', () => {
    /*
     * Ningún módulo del menú lo monta hoy, pero el copy se conserva: retirar
     * los siete módulos debe poder devolverlos a «Próximamente» sin tocar
     * A-01–A-04.
     */
    expect(MUNICIPALITY_TEXTO_PROXIMAMENTE).toBe(
      'Este módulo se implementará en una tarea posterior.',
    );
    expect(MUNICIPALITY_NOTA_PROXIMAMENTE.furag).toContain(platformNameInSentence());
    expect(MUNICIPALITY_NOTA_PROXIMAMENTE.adres).toContain(platformNameInSentence());
  });
});
