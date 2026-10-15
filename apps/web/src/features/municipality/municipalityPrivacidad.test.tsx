import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MunicipalityPage from '@/app/municipality/page';
import { branding, platformNameInSentence } from '@/config/branding';

import { MunicipalityShell } from './MunicipalityShell';
import { apariciones, texto } from './municipalityTestUtils';
import { MUNICIPALITY_MODULOS } from './municipalityViews';

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * Pruebas negativas de Alcaldía (TASK-ALCALDIA-A-01, T-11, T-12, T-13 y T-14).
 *
 * Comprueban lo que la experiencia municipal NO debe contener: información
 * clínica individual o nominal, marca técnica interna, terminología jurídica
 * incorrecta, red, persistencia e integraciones simuladas.
 *
 * La spec 022 añade una FRONTERA DE SESIÓN delante de estas vistas. Para seguir
 * inspeccionando su contenido hay que montarlas AUTORIZADAS, y por eso se
 * inyecta un contexto ficticio con el rol `MUNICIPAL_VIEWER`:
 * `renderToStaticMarkup` no ejecuta efectos. Al final de este archivo se añade
 * lo que la frontera obliga a comprobar aquí —que la ruta monta la puerta y no
 * la composición autorizada, y que ninguna vista se salta la sesión—.
 */

/** Contexto institucional FICTICIO con el rol municipal. */
const SESION_MUNICIPAL_FICTICIA = {
  role: 'MUNICIPAL_VIEWER',
  expiresAt: '2026-08-27T20:00:00.000Z',
  institution: { name: 'Entidad institucional de pruebas' },
  actorDisplay: 'Acceso institucional',
} as const;

/** Marcado de todas las vistas de la experiencia, concatenado. */
const TODAS_LAS_VISTAS = MUNICIPALITY_MODULOS.map((modulo) =>
  renderToStaticMarkup(
    <MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={modulo} />,
  ),
).join('\n');

/** Texto visible y accesible de todas las vistas. */
const TEXTO_VISIBLE = texto(TODAS_LAS_VISTAS);

/** Los siete módulos que activa TASK-ALCALDIA-DEMO-FINAL. */
const MODULOS_NUEVOS = [
  'furag',
  'adres',
  'cuidado',
  'brechas',
  'cuidadores',
  'indicadores',
  'reportes',
] as const;

/** Texto visible y accesible solo de las siete vistas nuevas. */
const TEXTO_VISIBLE_NUEVAS = texto(
  MODULOS_NUEVOS.map((modulo) =>
    renderToStaticMarkup(
    <MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={modulo} />,
  ),
  ).join('\n'),
);

/** Código fuente de la feature, para las comprobaciones estructurales. */
const DIRECTORIO = dirname(fileURLToPath(import.meta.url));

const FUENTES = readdirSync(DIRECTORIO)
  .filter((archivo) => /\.(ts|tsx|css)$/u.test(archivo) && !archivo.includes('.test.'))
  .map((archivo) => ({ archivo, contenido: readFileSync(join(DIRECTORIO, archivo), 'utf8') }));

describe('Alcaldía — privacidad municipal', () => {
  it('no expone información clínica individual', () => {
    for (const patron of [
      /historia clínica de/iu,
      /diagnóstic/iu,
      /medicament/iu,
      /dosis/iu,
      /tensión arterial/iu,
      /glucem/iu,
      /saturación/iu,
      /signos vitales/iu,
      /nota clínica/iu,
    ]) {
      expect(TEXTO_VISIBLE).not.toMatch(patron);
    }
  });

  it('no expone identificación nominal ni ubicación exacta de personas', () => {
    for (const patron of [
      /cédula/iu,
      /documento de identidad/iu,
      /\bNUIP\b/u,
      /\bcarrera\s+\d/iu,
      /\bcalle\s+\d/iu,
      /\bdirección\b/iu,
      /teléfono/iu,
      /correo electrónico/iu,
    ]) {
      expect(TEXTO_VISIBLE).not.toMatch(patron);
    }
  });

  it('no expone salarios ni honorarios individuales', () => {
    for (const patron of [/salario/iu, /honorari/iu, /nómina/iu, /remuneración/iu]) {
      expect(TEXTO_VISIBLE).not.toMatch(patron);
    }
  });

  it('no ofrece búsqueda de personas, exportación ni enlaces a registros', () => {
    expect(TODAS_LAS_VISTAS).not.toMatch(/<(a|form|input|select|textarea)\b/u);
    expect(TEXTO_VISIBLE).not.toMatch(/buscar persona/iu);
    expect(TEXTO_VISIBLE).not.toMatch(/descargar|exportar/iu);
  });

  it('mantiene visible el aviso de datos agregados en todas las vistas', () => {
    for (const modulo of MUNICIPALITY_MODULOS) {
      const visible = texto(renderToStaticMarkup(
    <MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={modulo} />,
  ));

      expect(visible).toContain(
        'Datos agregados y anonimizados · sin acceso a historias clínicas individuales',
      );
    }
  });
});

describe('Alcaldía — marca pública', () => {
  it('no expone la marca técnica interna en el marcado visible ni accesible', () => {
    /* Búsqueda sensible a mayúsculas, según el criterio de aceptación AC-17. */
    expect(TODAS_LAS_VISTAS.includes('MERDN')).toBe(false);
    expect(TEXTO_VISIBLE.includes('Merdn')).toBe(false);
  });

  it('usa la marca pública aprobada', () => {
    expect(TEXTO_VISIBLE).toContain(branding.platformDisplayName);
    expect(TEXTO_VISIBLE).toContain(platformNameInSentence());
  });
});

describe('Alcaldía — límites institucionales', () => {
  it('no usa la denominación incorrecta de la sentencia', () => {
    expect(TEXTO_VISIBLE).not.toMatch(/Ley\s*319/iu);
  });

  /*
   * TASK-ALCALDIA-DEMO-FINAL, §23.1: la vista de FURAG debe poder decir
   * NEGATIVAMENTE que la plataforma no calcula ese puntaje. Lo que queda
   * prohibido es la afirmación POSITIVA de cálculo, cumplimiento, clasificación
   * u oficialidad, no el uso institucionalmente correcto del término.
   */
  it('no afirma que la plataforma calcule FURAG ni determine cumplimiento', () => {
    expect(TEXTO_VISIBLE).toContain(
      `${platformNameInSentence()} no calcula el puntaje FURAG`,
    );

    expect(TEXTO_VISIBLE).toContain(
      'no produce ninguna clasificación oficial entre municipios',
    );

    for (const patron of [
      /(?<!no )calcula el puntaje FURAG/iu,
      /(?<!no )declara cumplimiento/iu,
      /(?<!no )certifica (mejora|cumplimiento)/iu,
      /(?<!nunca «)cumple (con )?FURAG/iu,
      /cumplimiento (verificado|certificado|garantizado)/iu,
      /(puntaje|resultado) FURAG (oficial|calculado|verificado|importado)/iu,
      /(?<!no )(produce|genera|calcula|publica) (un |una |ningún |ninguna )?(ranking|clasificación|posición) oficial/iu,
    ]) {
      expect(TEXTO_VISIBLE).not.toMatch(patron);
    }
  });

  it('no presenta a ADRES como regulador ni evaluador', () => {
    expect(TEXTO_VISIBLE).toContain(
      'ADRES administra recursos e información del aseguramiento en salud. No es un regulador',
    );
    expect(TEXTO_VISIBLE).not.toMatch(/ADRES (regula|evalúa|certifica|audita)/iu);
    expect(TEXTO_VISIBLE).not.toMatch(/puntaje municipal/iu);
  });

  /*
   * TASK-ALCALDIA-DEMO-FINAL, §17 y §23.1: ninguna de las siete pantallas
   * nuevas presenta una fuente como conectada. La comprobación se acota a esas
   * vistas porque Inicio conserva la bitácora demostrativa aprobada en A-01,
   * que ya declara sus propios orígenes como fixture.
   */
  it('las siete vistas nuevas declaran ausencia de conexión, nunca una fuente activa', () => {
    for (const patron of [
      /\b(importad[ao]s?|consultad[ao]s?|sincronizad[ao]s?)\b/iu,
      /\bBDUA\b/iu,
      /fuente conectada/iu,
      /integración activa/iu,
      /archivo generado/iu,
    ]) {
      expect(TEXTO_VISIBLE_NUEVAS).not.toMatch(patron);
    }

    expect(TEXTO_VISIBLE_NUEVAS).toContain('Conexión no habilitada');
    expect(TEXTO_VISIBLE_NUEVAS).toContain('Dato oficial no disponible');
    expect(TEXTO_VISIBLE_NUEVAS).toContain('Sin integración técnica');
    expect(TEXTO_VISIBLE_NUEVAS).toContain('Generación no habilitada');
  });

  /* TASK-ALCALDIA-DEMO-FINAL, §11 y §23.1: las brechas son administrativas. */
  it('no usa lenguaje de valoración individual en las brechas', () => {
    for (const patron of [/triaje/iu, /\btriage\b/iu, /decisión médica/iu, /urgencia clínica/iu]) {
      expect(TEXTO_VISIBLE).not.toMatch(patron);
    }
  });
});

describe('Alcaldía — sin red, persistencia ni integraciones', () => {
  it('el código de la feature no consulta red ni almacenamiento', () => {
    for (const { archivo, contenido } of FUENTES) {
      for (const patron of [
        /\bfetch\s*\(/u,
        /XMLHttpRequest/u,
        /WebSocket/u,
        /localStorage/u,
        /sessionStorage/u,
        /document\.cookie/u,
        /navigator\.sendBeacon/u,
        /https?:\/\//u,
      ]) {
        expect(`${archivo}: ${patron.source} ${String(patron.test(contenido))}`).toBe(
          `${archivo}: ${patron.source} false`,
        );
      }
    }
  });

  it('el marcado no incluye scripts, iframes ni recursos remotos', () => {
    expect(TODAS_LAS_VISTAS).not.toMatch(/<(script|iframe|img|link)\b/u);
    expect(TODAS_LAS_VISTAS).not.toContain('http://');
    expect(TODAS_LAS_VISTAS).not.toContain('https://');
  });

  /*
   * TASK-MUNICIPALITY-CORE-01, FR-01 y FR-11: Población beneficiaria y
   * Territorio pasan a consumir la API municipal agregada, de modo que la
   * feature necesita la URL base de la API. La lista sigue siendo ESTRICTA: la
   * única entrada nueva es `@/config/environment`, y la prueba siguiente acota
   * su uso a la frontera de red declarada.
   *
   * Spec 022: se añade `@/features/auth/institutionalSessionClient`, el cliente
   * COMPARTIDO de la sesión institucional. Es una entrada que RESTA
   * duplicación en vez de sumarla: Alcaldía reutiliza la sesión que ya existe
   * en lugar de fabricarse una propia, y no importa desde Hospital —lo que
   * comprueba `municipalitySession.test.tsx`—. La lista sigue siendo ESTRICTA.
   */
  it('no declara ninguna importación fuera de la feature salvo las aprobadas', () => {
    const importaciones = FUENTES.flatMap(({ contenido }) =>
      [...contenido.matchAll(/from '(?<origen>[^']+)'/gu)].map(
        (coincidencia) => coincidencia.groups?.origen ?? '',
      ),
    );
    const externas = importaciones.filter((origen) => !origen.startsWith('.'));

    expect([...new Set(externas)].sort()).toStrictEqual([
      '@/config/branding',
      '@/config/environment',
      '@/features/auth/InstitutionalAccess',
      '@/features/auth/institutionalAdministratorClient',
      '@/features/auth/institutionalSessionClient',
      'react',
    ]);
  });

  /*
   * La URL base de la API entra por un ÚNICO archivo. Si otra vista importara
   * `@/config/environment` estaría abriendo una segunda frontera de red fuera
   * del cliente municipal, y esta prueba lo impide.
   */
  it('la configuración de entorno solo entra por el cliente municipal', () => {
    const importadores = FUENTES.filter(({ contenido }) =>
      contenido.includes("from '@/config/environment'"),
    ).map(({ archivo }) => archivo);

    expect(importadores).toStrictEqual(['municipalityAggregatesClient.ts']);
  });

  it('no importa ningún módulo de otra experiencia', () => {
    for (const { archivo, contenido } of FUENTES) {
      expect(`${archivo}: ${String(/features\/(hospital|paciente|inscripcion)/u.test(contenido))}`)
        .toBe(`${archivo}: false`);
      expect(`${archivo}: ${String(/\bHospital[A-Z]/u.test(contenido))}`).toBe(`${archivo}: false`);
    }
  });

  it('las actividades con origen declarado no prueban ninguna conexión activa', () => {
    expect(TEXTO_VISIBLE).toContain(`fuente ${branding.platformDisplayName}`);
    expect(TEXTO_VISIBLE).toContain('Función Pública');
    /* Ninguna etiqueta de estado de integración acompaña a esos orígenes. */
    expect(TEXTO_VISIBLE).not.toMatch(
      /integración activa|conexión establecida|\bAPI\b|\btoken\b/iu,
    );
  });
});

describe('Alcaldía — accesibilidad estructural', () => {
  it('cada vista declara regiones nombradas y un solo encabezado principal', () => {
    for (const modulo of MUNICIPALITY_MODULOS) {
      const html = renderToStaticMarkup(
    <MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={modulo} />,
  );

      expect(apariciones(html, /<main\b/gu)).toBe(1);
      expect(apariciones(html, /<h1\b/gu)).toBe(1);
      expect(html).toMatch(/<aside[^>]*aria-label="[^"]+"/u);
      expect(html).toMatch(/<nav[^>]*aria-label="[^"]+"/u);
      expect(html).toMatch(/<header[^>]*aria-label="[^"]+"/u);
    }
  });

  it('todos los controles son botones con nombre accesible', () => {
    const botones = [...TODAS_LAS_VISTAS.matchAll(/<button(?<atributos>[^>]*)>/gu)];

    expect(botones.length).toBeGreaterThan(0);

    for (const boton of botones) {
      expect(boton.groups?.atributos ?? '').toContain('type="button"');
    }
  });

  it('todos los SVG son decorativos', () => {
    const svgs = [...TODAS_LAS_VISTAS.matchAll(/<svg(?<atributos>[^>]*)>/gu)];

    expect(svgs.length).toBeGreaterThan(0);

    for (const svg of svgs) {
      const atributos = svg.groups?.atributos ?? '';

      expect(atributos).toContain('aria-hidden="true"');
      expect(atributos).toContain('focusable="false"');
    }
  });

  it('el encabezado principal puede recibir el foco al cambiar de vista', () => {
    for (const modulo of MUNICIPALITY_MODULOS) {
      const html = renderToStaticMarkup(
    <MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={modulo} />,
  );

      expect(html).toMatch(/<h1[^>]*tabindex="-1"/u);
    }
  });
});

/* ========================================================================== */
/* Spec 022 — la frontera de sesión, vista desde la privacidad                 */
/* ========================================================================== */

/**
 * Lo que la frontera añade a estas pruebas negativas.
 *
 * No basta con que las vistas no digan de más: desde la spec 022 tampoco pueden
 * MOSTRARSE sin una sesión institucional municipal confirmada por el servidor.
 * Un agregado real, aunque sea agregado, es información municipal, y sin
 * autorización no se pide ni se monta.
 */
describe('Alcaldía — frontera de sesión institucional (spec 022)', () => {
  it.each(['true', 'false'])('la bandera heredada %s no habilita contenido sin sesión', (valor) => {
    vi.stubEnv('MERDN_MUNICIPALITY_DEMO_LOCAL', valor);
    const html = renderToStaticMarkup(<MunicipalityPage />);

    expect(html).not.toContain('data-municipality-content');
    expect(apariciones(html, /<nav\b/gu)).toBe(0);
  });

  it('la ruta monta la PUERTA, no la composición autorizada', () => {
    /*
     * `MunicipalityShellAutorizado` se exporta para poder probar la composición
     * con `renderToStaticMarkup`. Si la ruta lo montara directamente, la puerta
     * quedaría sorteada y ninguna otra prueba lo notaría.
     */
    const ruta = readFileSync(
      join(DIRECTORIO, '..', '..', 'app', 'municipality', 'page.tsx'),
      'utf8',
    );

    expect(ruta).toContain('MunicipalityShell');
    expect(ruta).not.toContain('MunicipalityShellAutorizado');
    // Y no le inyecta contexto ni red: la sesión la resuelve el servidor.
    expect(ruta).not.toContain('sesionInicial');
    expect(ruta).not.toContain('fetchImpl');
  });

  it('sin sesión confirmada no se monta ninguna vista municipal', () => {
    /*
     * El primer render real —el que ve quien abre `/municipality`— es el estado
     * «comprobando»: `renderToStaticMarkup` no ejecuta el efecto que consulta la
     * sesión, de modo que esto es exactamente lo que el servidor entrega antes
     * de que ninguna respuesta haya llegado.
     */
    const html = renderToStaticMarkup(<MunicipalityShell />);

    expect(html).not.toContain('data-municipality-content');
    expect(apariciones(html, /<nav\b/gu)).toBe(0);

    for (const modulo of MUNICIPALITY_MODULOS) {
      expect(`${modulo}: ${String(html.includes(`"${modulo}"`))}`).toBe(`${modulo}: false`);
    }
  });

  it('las once vistas demostrativas siguen detrás de la sesión y siguen siendo demostrativas', () => {
    /*
     * La spec 022 declara operativas EXACTAMENTE dos vistas —Población y
     * Territorio— y deja las once restantes como estaban. Esta prueba fija las
     * dos mitades: que las once no consultan nada, y que no desaparecieron.
     */
    const OPERATIVAS = ['poblacion', 'territorio'] as const;
    const DEMOSTRATIVAS = MUNICIPALITY_MODULOS.filter(
      (modulo) => !OPERATIVAS.includes(modulo as (typeof OPERATIVAS)[number]),
    );

    expect(DEMOSTRATIVAS).toHaveLength(11);

    for (const modulo of DEMOSTRATIVAS) {
      const fuente = FUENTES.find(({ archivo }) =>
        archivo.toLowerCase().startsWith(`municipality${modulo.slice(0, 5)}`),
      );

      if (fuente !== undefined) {
        expect(`${fuente.archivo}: ${String(/useMunicipalityAggregate/u.test(fuente.contenido))}`).toBe(
          `${fuente.archivo}: false`,
        );
      }

      // Y sigue montándose: la spec no autoriza borrarlas.
      expect(
        renderToStaticMarkup(
          <MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={modulo} />,
        ),
      ).toContain(`data-municipality-content="${modulo}"`);
    }
  });

  it('solo Inicio operativo, Población y Territorio consultan agregados dentro de la sesión', () => {
    const consumidores = FUENTES.filter(
      ({ archivo, contenido }) =>
        // El propio hook no es un consumidor: es la pieza que consultan.
        archivo !== 'useMunicipalityAggregate.ts' &&
        /useMunicipalityAggregate/u.test(contenido),
    )
      .map(({ archivo }) => archivo)
      .sort((a, b) => a.localeCompare(b, 'es-CO'));

    expect(consumidores).toStrictEqual([
      'MunicipalityOperationalPanel.tsx',
      'MunicipalityPopulation.tsx',
      'MunicipalityTerritory.tsx',
    ]);
  });
});
