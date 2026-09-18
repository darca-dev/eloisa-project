import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import * as compartido from '@/features/auth/institutionalSessionClient';
import type {
  ResultadoSesion,
  SesionInstitucionalDto,
} from '@/features/auth/institutionalSessionClient';

import { MunicipalityShell } from './MunicipalityShell';
import {
  MUNICIPALITY_ESTADO_SESION,
  MUNICIPALITY_MENSAJE_CIERRE,
  MUNICIPALITY_MENSAJE_CIERRE_NO_CONFIRMADO,
  MUNICIPALITY_MENSAJE_ROL,
  MUNICIPALITY_MENSAJE_SIN_CONFIRMAR,
  MUNICIPALITY_ROL_REQUERIDO,
  contextoAutorizado,
  esRolMunicipal,
  identidadDeSesion,
  resolverEstadoMunicipal,
  type EstadoDenegado,
} from './municipalitySession';
import { apariciones, etiquetasDeBotones, texto } from './municipalityTestUtils';

/**
 * Frontera de sesión INSTITUCIONAL de Alcaldía (spec 022, FR-04 y FR-05;
 * escenarios de aceptación 1 a 8).
 *
 * La superficie se renderiza con `react-dom/server`, igual que el resto del
 * frontend: el repositorio no incluye jsdom ni una librería de testing con DOM,
 * y esta spec no autoriza añadir dependencias. Por eso la DECISIÓN de acceso
 * está extraída como funciones PURAS —`esRolMunicipal`, `resolverEstadoMunicipal`
 * y `contextoAutorizado`— y se prueba camino por camino sin navegador y sin
 * red, y el CONTEXTO se inyecta por propiedad para verificar qué monta cada
 * estado.
 *
 * Lo que NO se prueba aquí, porque se prueba donde vive: el transporte, los
 * códigos de estado, la cancelación y la regla del cierre confirmado están en
 * `apps/web/src/features/auth/institutionalSessionClient.test.ts`. Alcaldía
 * reutiliza ese cliente y no lo reimplementa.
 *
 * Todos los valores son FICTICIOS.
 */

/* -------------------------------------------------------------------------- */
/* Contextos ficticios                                                         */
/* -------------------------------------------------------------------------- */

function sesionFicticia(role: string): SesionInstitucionalDto {
  return {
    role,
    expiresAt: '2026-08-27T20:00:00.000Z',
    institution: { name: 'Alcaldía ficticia de pruebas' },
    actorDisplay: 'Acceso institucional',
  } as SesionInstitucionalDto;
}

const SESION_MUNICIPAL = sesionFicticia(MUNICIPALITY_ROL_REQUERIDO);

/** Los DOS roles del contrato que NO son municipales. Ninguno abre Alcaldía. */
const ROLES_AJENOS = ['HOSPITAL_PATIENT_VIEWER', 'HOSPITAL_SCHEDULER'] as const;

function contexto(datos: SesionInstitucionalDto): ResultadoSesion {
  return { kind: 'ok', datos };
}

/** Marcado de la superficie municipal con un contexto o un estado inyectado. */
function superficie(
  sesionInicial: SesionInstitucionalDto | EstadoDenegado | 'autorizada',
): string {
  return renderToStaticMarkup(<MunicipalityShell sesionInicial={sesionInicial} />);
}

/* ========================================================================== */
/* La regla de rol                                                             */
/* ========================================================================== */

describe('Alcaldía — la regla de rol es de igualdad EXACTA', () => {
  it('solo `MUNICIPAL_VIEWER` es el rol municipal', () => {
    expect(MUNICIPALITY_ROL_REQUERIDO).toBe('MUNICIPAL_VIEWER');
    expect(esRolMunicipal('MUNICIPAL_VIEWER')).toBe(true);
  });

  it('los roles hospitalarios NO son municipales: son otros, no menos', () => {
    for (const role of ROLES_AJENOS) {
      expect(esRolMunicipal(role)).toBe(false);
    }
  });

  it('no acepta prefijos, sufijos, otra caja ni valores vacíos', () => {
    /*
     * Cierra las relajaciones que un `includes`, un `startsWith` o una
     * comparación sin distinguir caja habrían dejado pasar. Un rol implementado
     * en el servidor pero desconocido aquí NO entra: se falla cerrado.
     */
    for (const role of [
      '',
      ' ',
      'municipal_viewer',
      'Municipal_Viewer',
      'MUNICIPAL_VIEWER ',
      ' MUNICIPAL_VIEWER',
      'MUNICIPAL_VIEWER_ADMIN',
      'SUPER_MUNICIPAL_VIEWER',
      'MUNICIPAL',
      'VIEWER',
      'MUNICIPAL_EDITOR',
      'ROL_FUTURO_DESCONOCIDO',
    ]) {
      expect(`${role}: ${String(esRolMunicipal(role))}`).toBe(`${role}: false`);
    }
  });

  it('el rol municipal ya estaba rotulado en el cliente compartido', () => {
    // Alcaldía no estrena un rol: reutiliza el que el contrato ya declaraba.
    expect(compartido.ETIQUETA_ROL_INSTITUCIONAL[MUNICIPALITY_ROL_REQUERIDO]).toBe(
      'Consulta municipal agregada',
    );
  });
});

/* ========================================================================== */
/* La traducción del desenlace: falla CERRADO en todos los caminos             */
/* ========================================================================== */

describe('Alcaldía — resolución del estado de sesión', () => {
  it('un contexto con el rol municipal autoriza', () => {
    expect(resolverEstadoMunicipal(contexto(SESION_MUNICIPAL), false)).toBe('autorizada');
    expect(contextoAutorizado(contexto(SESION_MUNICIPAL))).toBe(SESION_MUNICIPAL);
  });

  it('un contexto con otro rol NO autoriza y no deja resto del contexto', () => {
    for (const role of ROLES_AJENOS) {
      const resultado = contexto(sesionFicticia(role));

      expect(resolverEstadoMunicipal(resultado, false)).toBe('rol-no-autorizado');
      // Ni siquiera se conserva para mostrarlo: la superficie denegada no lo ve.
      expect(contextoAutorizado(resultado)).toBeNull();
    }
  });

  it('sin sesión previa, un 401 es «sin sesión»; con sesión previa, es expiración', () => {
    /*
     * El servidor responde IGUAL en los dos casos y el cliente compartido no
     * los distingue. La diferencia la conoce esta interfaz porque recuerda si
     * llegó a estar autorizada, no porque deduzca nada del servidor.
     */
    expect(resolverEstadoMunicipal({ kind: 'sin-sesion' }, false)).toBe('sin-sesion');
    expect(resolverEstadoMunicipal({ kind: 'sin-sesion' }, true)).toBe('expirada');
  });

  it('un fallo o una cancelación NO conservan el acceso: fallan cerrado', () => {
    for (const kind of ['error', 'cancelado'] as const) {
      for (const habiaSesion of [false, true]) {
        expect(resolverEstadoMunicipal({ kind }, habiaSesion)).toBe('error');
      }
    }
  });

  it('ningún desenlace distinto de `ok` con rol municipal produce contexto', () => {
    for (const resultado of [
      { kind: 'sin-sesion' },
      { kind: 'error' },
      { kind: 'cancelado' },
      contexto(sesionFicticia('HOSPITAL_SCHEDULER')),
    ] as ResultadoSesion[]) {
      expect(contextoAutorizado(resultado)).toBeNull();
    }
  });

  it('la identidad visible se toma del servidor y no añade nada', () => {
    const identidad = identidadDeSesion(SESION_MUNICIPAL);

    expect(identidad.entidad).toBe('Alcaldía ficticia de pruebas');
    expect(identidad.rol).toBe('Consulta municipal agregada');
    // La caducidad la redacta el cliente compartido desde la cadena ISO.
    expect(identidad.caducidad).toBe(compartido.textoCaducidad(SESION_MUNICIPAL.expiresAt));
  });
});

/* ========================================================================== */
/* Qué monta cada estado                                                       */
/* ========================================================================== */

/** Contenido visible y accesible de un módulo operativo de spec 008. */
const RASTROS_OPERATIVOS: readonly string[] = [
  'data-municipality-content',
  'Población beneficiaria',
  'Territorio',
  'Presupuesto',
  'FURAG',
];

describe('Alcaldía — solo el rol municipal monta el slice operativo', () => {
  it('con el rol municipal se monta la composición operativa completa', () => {
    const html = superficie(SESION_MUNICIPAL);

    expect(html).toContain('data-municipality-content="inicio"');
    expect(apariciones(html, /<main\b/gu)).toBe(1);
    expect(apariciones(html, /<nav\b/gu)).toBe(1);
    expect(html).not.toContain('<form');
  });

  it('con otro rol institucional NO se monta nada operativo', () => {
    for (const role of ROLES_AJENOS) {
      const html = renderToStaticMarkup(
        <MunicipalityShell sesionInicial={sesionFicticia(role)} />,
      );

      for (const rastro of RASTROS_OPERATIVOS) {
        expect(`${role}/${rastro}: ${String(html.includes(rastro))}`).toBe(
          `${role}/${rastro}: false`,
        );
      }

      expect(texto(html)).toContain(
        MUNICIPALITY_ESTADO_SESION['rol-no-autorizado'].titulo,
      );
    }
  });

  it.each<[EstadoDenegado]>([
    ['comprobando'],
    ['sin-sesion'],
    ['expirada'],
    ['rol-no-autorizado'],
    ['error'],
  ])('el estado «%s» no monta ninguna vista ni ningún agregado', (estado) => {
    const html = superficie(estado);

    for (const rastro of RASTROS_OPERATIVOS) {
      expect(`${estado}/${rastro}: ${String(html.includes(rastro))}`).toBe(
        `${estado}/${rastro}: false`,
      );
    }

    // El menú municipal tampoco existe: no hay navegación operable sin sesión.
    expect(apariciones(html, /<nav\b/gu)).toBe(0);
    expect(texto(html)).toContain(MUNICIPALITY_ESTADO_SESION[estado].titulo);
  });

  it('cada estado denegado conserva la geometría de Alcaldía y un solo `h1`', () => {
    for (const estado of [
      'comprobando',
      'sin-sesion',
      'expirada',
      'rol-no-autorizado',
      'error',
    ] as const) {
      const html = superficie(estado);

      expect(apariciones(html, /<aside\b/gu)).toBe(1);
      expect(apariciones(html, /<main\b/gu)).toBe(1);
      expect(apariciones(html, /<h1\b/gu)).toBe(1);
      // Sin topbar: no hay periodo, ni perfil, ni encabezado de panel.
      expect(apariciones(html, /<header\b/gu)).toBe(0);
    }
  });

  it('los cinco estados denegados tienen títulos distintos entre sí', () => {
    const titulos = Object.values(MUNICIPALITY_ESTADO_SESION).map(({ titulo }) => titulo);

    expect(new Set(titulos).size).toBe(5);
  });
});

/* ========================================================================== */
/* Entrada institucional                                                       */
/* ========================================================================== */

describe('Alcaldía — entrada institucional legítima', () => {
  const html = superficie('sin-sesion');

  it('muestra el formulario con los dos campos del contrato y ninguno más', () => {
    expect(html).toContain('<form');
    expect(html).toContain('Código de identidad institucional');
    expect(html).toContain('Credencial de acceso');
    expect(apariciones(html, /<input\b/gu)).toBe(2);
    expect(html).toContain('type="text"');
    expect(html).toContain('type="password"');
    expect(html).toContain('type="submit"');
  });

  it('la credencial no viaja por la URL ni queda escrita en el marcado', () => {
    /*
     * Sin `action` ni `method` el envío lo gobierna el manejador del cliente y
     * el navegador no puede componer una URL con lo escrito. Los campos nacen
     * vacíos y el autocompletado queda desactivado.
     */
    expect(html).not.toContain('action=');
    expect(html).not.toContain('method=');
    expect(html).not.toContain('href');
    expect(html).not.toMatch(/autocomplete="on"/iu);
    expect(html.match(/autocomplete="off"/giu) ?? []).toHaveLength(2);
    expect(html.match(/value=""/gu) ?? []).toHaveLength(2);
  });

  it('no ofrece acceso de ejemplo, credencial sugerida ni entrada de demostración', () => {
    const visible = texto(html);

    for (const patron of [
      /credencial de ejemplo/iu,
      /usuario de prueba/iu,
      /demostraci[oó]n/iu,
      /\bdemo\b/iu,
      /entrar sin/iu,
      /omitir/iu,
      /continuar sin sesi[oó]n/iu,
    ]) {
      expect(visible).not.toMatch(patron);
    }

    // Un único botón: entrar. No hay una segunda vía de acceso.
    expect(etiquetasDeBotones(html)).toStrictEqual(['Entrar']);
  });

  it('dice que la credencial es de la entidad y no de una persona', () => {
    expect(texto(html)).toContain('es de la ENTIDAD y es compartida');
  });

  it('los estados que sí pueden reintentar ofrecen un reintento real', () => {
    for (const estado of ['expirada', 'rol-no-autorizado', 'error'] as const) {
      expect(etiquetasDeBotones(superficie(estado))).toStrictEqual([
        'Volver a comprobar la sesión',
      ]);
    }

    // Mientras se comprueba no hay nada que reintentar todavía.
    expect(etiquetasDeBotones(superficie('comprobando'))).toStrictEqual([]);
  });
});

/* ========================================================================== */
/* Cierre real y superficie autorizada                                         */
/* ========================================================================== */

describe('Alcaldía — sesión autorizada y cierre', () => {
  const html = superficie(SESION_MUNICIPAL);

  it('ofrece un cierre de sesión institucional real', () => {
    expect(etiquetasDeBotones(html)).toContain('Cerrar sesión institucional');
  });

  it('muestra entidad, rol y vigencia, y nada más de la sesión', () => {
    const visible = texto(html);

    expect(visible).toContain('Alcaldía ficticia de pruebas');
    expect(visible).toContain('Consulta municipal agregada');
    expect(visible).toContain('Sesión vigente hasta 27/08/2026 20:00 UTC');
  });

  it('no expone tenant, identificador, credencial ni persona', () => {
    for (const prohibido of [
      'tenant',
      'tenantId',
      'identityId',
      'accessSecret',
      'identityCode',
      'Bearer',
      'HOSPITAL_PATIENT_VIEWER',
      MUNICIPALITY_ROL_REQUERIDO,
    ]) {
      expect(html).not.toContain(prohibido);
    }
  });

  it('el cierre no confirmado NO afirma que la sesión terminó', () => {
    /*
     * El texto es la mitad visible de la regla; la otra mitad —que la sesión no
     * se retira— la decide `resolverCierre`, del cliente compartido, y se
     * comprueba justo debajo.
     */
    expect(MUNICIPALITY_MENSAJE_CIERRE_NO_CONFIRMADO).toContain('La sesión sigue abierta');
    expect(MUNICIPALITY_MENSAJE_CIERRE_NO_CONFIRMADO).not.toMatch(/cerrada|cerró|se cerr/iu);
  });

  it('solo una revocación CONFIRMADA por el servidor retira la sesión', () => {
    expect(compartido.resolverCierre('ok', 'cerrar').retirarSesion).toBe(true);
    expect(compartido.resolverCierre('sin-sesion', 'cerrar').retirarSesion).toBe(true);

    for (const cierre of ['origen-rechazado', 'error', 'cancelado'] as const) {
      expect(compartido.resolverCierre(cierre, 'cerrar').retirarSesion).toBe(false);
      expect(compartido.resolverCierre(cierre, 'cerrar').reconfirmar).toBe(true);
    }
  });

  it('tras un cierre sin confirmar, solo un `sin-sesion` autoriza a retirarla', () => {
    expect(compartido.resolverReconfirmacion('sin-sesion', 'cerrar').retirarSesion).toBe(true);

    for (const kind of ['ok', 'error', 'cancelado'] as const) {
      expect(compartido.resolverReconfirmacion(kind, 'cerrar').retirarSesion).toBe(false);
    }
  });

  it('los avisos de la frontera no nombran interioridades del sistema', () => {
    for (const mensaje of [
      MUNICIPALITY_MENSAJE_CIERRE,
      MUNICIPALITY_MENSAJE_CIERRE_NO_CONFIRMADO,
      MUNICIPALITY_MENSAJE_ROL,
      MUNICIPALITY_MENSAJE_SIN_CONFIRMAR,
      ...Object.values(MUNICIPALITY_ESTADO_SESION).flatMap(({ titulo, detalle }) => [
        titulo,
        detalle,
      ]),
    ]) {
      expect(mensaje.length).toBeGreaterThan(0);
      expect(/tenant|token|cookie|SQL|RLS|null|undefined|401|403/iu.test(mensaje)).toBe(false);
    }
  });

  it('el aviso por rol ajeno es el MISMO que el del estado denegado por rol', () => {
    /*
     * Entrar con una credencial de otra experiencia no puede producir un
     * mensaje distinto del de encontrarse ya dentro con ella: la diferencia
     * solo serviría para enumerar qué credenciales existen.
     */
    expect(MUNICIPALITY_MENSAJE_ROL).toBe(
      MUNICIPALITY_ESTADO_SESION['rol-no-autorizado'].detalle,
    );
  });
});

/* ========================================================================== */
/* Alcance estructural de la frontera                                          */
/* ========================================================================== */

const DIRECTORIO = dirname(fileURLToPath(import.meta.url));

const FUENTES = readdirSync(DIRECTORIO)
  .filter((archivo) => /\.tsx?$/u.test(archivo) && !archivo.includes('.test.'))
  .map((archivo) => ({ archivo, codigo: readFileSync(join(DIRECTORIO, archivo), 'utf8') }));

/** Módulo compartido, única procedencia de la sesión institucional. */
const CLIENTE_COMPARTIDO = '@/features/auth/institutionalSessionClient';

describe('Alcaldía — la frontera no duplica ni fabrica autenticación', () => {
  it('la sesión institucional se consume del módulo COMPARTIDO', () => {
    const shell = FUENTES.find(({ archivo }) => archivo === 'MunicipalityShell.tsx');

    expect(shell?.codigo).toContain(CLIENTE_COMPARTIDO);
    // Y NO desde Hospital: Alcaldía no importa de otra experiencia.
    expect(shell?.codigo).not.toContain('features/hospital');
    expect(shell?.codigo).not.toContain('hospitalInstitutionClient');
  });

  it('ningún archivo municipal reimplementa el transporte de la sesión', () => {
    /*
     * Las rutas institucionales solo pueden aparecer dentro del cliente
     * compartido. Si un archivo de Alcaldía las nombrase, existiría una segunda
     * copia de la autenticación.
     */
    for (const { archivo, codigo } of FUENTES) {
      expect(`${archivo}: ${String(codigo.includes('/api/v1/institutional'))}`).toBe(
        `${archivo}: false`,
      );
    }
  });

  it('no hay identidad en el navegador ni repliegue a datos ficticios', () => {
    const frontera = FUENTES.filter(({ archivo }) =>
      ['MunicipalityShell.tsx', 'municipalitySession.tsx'].includes(archivo),
    );

    expect(frontera).toHaveLength(2);

    for (const { archivo, codigo } of frontera) {
      for (const prohibido of [
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'document.cookie',
        'process.env',
        'dev-login',
      ]) {
        expect(`${archivo}/${prohibido}: ${String(codigo.includes(prohibido))}`).toBe(
          `${archivo}/${prohibido}: false`,
        );
      }
    }
  });

  it('la puerta decide con la regla de rol y no con otra comprobación', () => {
    const shell = FUENTES.find(({ archivo }) => archivo === 'MunicipalityShell.tsx');
    const sesion = FUENTES.find(({ archivo }) => archivo === 'municipalitySession.tsx');

    /*
     * El literal del rol vive en UN solo sitio EJECUTABLE: la constante de
     * `municipalitySession.tsx`. El shell solo puede nombrarlo en prosa, y esa
     * distinción se comprueba sobre el código sin comentarios.
     */
    const shellEfectivo = (shell?.codigo ?? '')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '');

    expect([...shellEfectivo.matchAll(/MUNICIPAL_VIEWER/gu)]).toHaveLength(0);
    expect([...(sesion?.codigo ?? '').matchAll(/'MUNICIPAL_VIEWER'/gu)]).toHaveLength(1);
    // Y la comparación es de igualdad, no de pertenencia ni de prefijo.
    expect(sesion?.codigo).toContain('role === MUNICIPALITY_ROL_REQUERIDO');
    expect(/\.includes\(role\)|role\.startsWith|role\.toUpperCase/u.test(sesion?.codigo ?? '')).toBe(
      false,
    );
  });
});
