import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HOSPITAL_NAV_ITEMS } from './hospitalConfig';
import { HospitalShell } from './HospitalShell';
import { SESION_INSTITUCIONAL_FICTICIA, apariciones, main, texto } from './hospitalTestUtils';
import {
  HOSPITAL_ETIQUETA_INTENCION,
  HOSPITAL_INTENCIONES,
  HOSPITAL_ITEMS_NAVEGABLES,
  HOSPITAL_ITEM_ACTIVO_POR_VISTA,
  HOSPITAL_NAVEGACION_INICIAL,
  HOSPITAL_VISTAS_IMPLEMENTADAS,
  HOSPITAL_VISTA_INICIAL,
  destinoDeItem,
  esIntencionSoportada,
  esVistaImplementada,
  siguienteNavegacion,
  siguienteVista,
} from './hospitalViews';
import type { HospitalIntencionId, HospitalVistaId } from './hospitalViews';

/**
 * Navegación local del Shell Hospital (TASK-003H-03, T-01, T-02, T-03;
 * TASK-003H-04, T-01, T-02, T-03; TASK-003H-02B, T-01, T-11, T-12 y T-17;
 * TASK-003H-05, T-01, T-02 y T-03).
 *
 * La transición de vista e intención está extraída como función pura
 * (`siguienteVista`, `siguienteNavegacion`), de modo que el comportamiento de
 * los controles autorizados y la inercia de los demás se verifica sin DOM. El
 * resultado visible de cada vista se comprueba montando el shell en esa vista.
 *
 * El repositorio no incluye jsdom ni una librería de testing con DOM y esta
 * tarea no autoriza añadir dependencias: la activación real por clic y por
 * teclado queda pendiente y se reporta como no ejecutada.
 */

function shell(vistaInicial?: HospitalVistaId, intencionInicial?: HospitalIntencionId): string {
  if (vistaInicial === undefined) {
    return renderToStaticMarkup(<HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} />);
  }

  return renderToStaticMarkup(
    intencionInicial === undefined ? (
      <HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} vistaInicial={vistaInicial} />
    ) : (
      <HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} vistaInicial={vistaInicial} intencionInicial={intencionInicial} />
    ),
  );
}

/** Título visible que cada vista debe montar como encabezado principal. */
const TITULO_DE_LA_VISTA: Record<HospitalVistaId, string> = {
  inicio: 'Atención domiciliaria de hoy',
  agenda: 'Agenda y citas',
  pacientes: 'Pacientes',
  alarmas: 'Semáforo de alarmas',
  profesionales: 'Profesionales en salud',
  visitas: 'Visitas domiciliarias',
  virtuales: 'Consultas virtuales',
  calificaciones: 'Calidad y experiencia',
  novedades: 'Novedades',
  financiera: 'Gestión financiera',
  reportes: 'Reportes',
  administracion: 'Configuración',
};

/** Marcador técnico que el shell escribe en el área de contenido. */
const MARCADOR_DE_LA_VISTA: Record<HospitalVistaId, string> = {
  inicio: 'dashboard',
  agenda: 'agenda',
  pacientes: 'pacientes',
  alarmas: 'alarmas',
  profesionales: 'profesionales',
  visitas: 'visitas',
  virtuales: 'virtuales',
  calificaciones: 'calificaciones',
  novedades: 'novedades',
  financiera: 'financiera',
  reportes: 'reportes',
  administracion: 'administracion',
};

/** Texto del único encabezado de nivel 1 del área de contenido. */
function tituloPrincipal(html: string): string {
  return texto(/<h1[^>]*>(?<cuerpo>[\s\S]*?)<\/h1>/u.exec(main(html))?.groups?.cuerpo ?? '');
}

describe('T-01 — Carga inicial de /hospital', () => {
  it('abre en Inicio con el Dashboard y los KPIs de TASK-003H-02', () => {
    const html = shell();
    const contenido = main(html);

    expect(HOSPITAL_VISTA_INICIAL).toBe('inicio');
    expect(html).toContain('data-hospital-content="dashboard"');
    expect(contenido).toContain('CENTRO DE CONTROL OPERATIVO');
    expect(contenido).toContain('Atención domiciliaria de hoy');
    expect(contenido).toContain('CITAS PENDIENTES DE ASIGNACIÓN');
    expect(contenido).toContain('Necesita atención ahora');
    expect(contenido).toContain('Acciones rápidas');
    expect(contenido).toContain('Ir a');
  });

  it('conserva sidebar, topbar, buscador y perfil', () => {
    const envolvente = shell().split('<main')[0] ?? '';

    /*
     * La composición no cambia —sidebar, topbar, buscador y perfil—; la
     * identidad la aporta el contexto de sesión inyectado, que es la única
     * procedencia autorizada desde TASK-HOSPITAL-CORE-01.
     *
     * H-FID-B (§4.3.4) retiró la campana y su conteo demostrativo, que no
     * tenían ninguna fuente real: la expectativa heredada que los exigía queda
     * eliminada. Nada más de esta suite cambia.
     */
    expect(envolvente).toContain('Institución ficticia de pruebas');
    expect(envolvente).toContain(
      'Buscar paciente, documento, profesional, cita, atención o municipio',
    );
    expect(envolvente).toContain('Acceso institucional');
    expect(envolvente).toContain('Consulta de pacientes');
  });
});

describe('T-02 — Las doce vistas autorizadas', () => {
  it('la transición local acepta exactamente los doce identificadores', () => {
    expect([...HOSPITAL_VISTAS_IMPLEMENTADAS]).toEqual([
      'inicio',
      'agenda',
      'pacientes',
      'alarmas',
      'profesionales',
      'visitas',
      'virtuales',
      'calificaciones',
      'novedades',
      'financiera',
      'reportes',
      'administracion',
    ]);

    for (const id of HOSPITAL_VISTAS_IMPLEMENTADAS) {
      expect(esVistaImplementada(id)).toBe(true);
      expect(siguienteVista('inicio', id)).toBe(id);
    }
  });

  it.each(HOSPITAL_VISTAS_IMPLEMENTADAS)('%s monta una sola vista, la suya', (vista) => {
    const html = shell(vista);

    expect(html).toContain(`data-hospital-content="${MARCADOR_DE_LA_VISTA[vista]}"`);
    expect(tituloPrincipal(html)).toBe(TITULO_DE_LA_VISTA[vista]);
    expect(apariciones(html, /data-hospital-content=/gu)).toBe(1);
  });

  it.each(HOSPITAL_VISTAS_IMPLEMENTADAS)('%s marca su item activo en el sidebar', (vista) => {
    const html = shell(vista);
    const etiqueta =
      HOSPITAL_NAV_ITEMS.find((item) => item.id === HOSPITAL_ITEM_ACTIVO_POR_VISTA[vista])
        ?.etiqueta ?? '(sin etiqueta)';
    const activo = /<button[^>]*aria-current="true"[^>]*>(?<cuerpo>[\s\S]*?)<\/button>/u.exec(html)
      ?.groups?.cuerpo;

    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
    expect(texto(activo ?? '')).toContain(etiqueta);
  });

  it('cada vista monta un único encabezado principal', () => {
    for (const vista of HOSPITAL_VISTAS_IMPLEMENTADAS) {
      expect(apariciones(main(shell(vista)), /<h1\b/gu)).toBe(1);
      expect(apariciones(shell(vista), /<main\b/gu)).toBe(1);
    }
  });

  it('la navegación no crea rutas ni enlaces: solo botones', () => {
    const sidebar = shell().split('</aside>')[0] ?? '';

    expect(sidebar).not.toContain('<a ');
    expect(sidebar).not.toContain('href');
    expect(apariciones(sidebar, /<button type="button"/gu)).toBe(HOSPITAL_NAV_ITEMS.length);
  });
});

describe('T-03 — Alcance negativo del menú', () => {
  const noAutorizados = HOSPITAL_NAV_ITEMS.filter((item) => destinoDeItem(item.id) === null);

  /*
   * TASK-003H-07 activa «Reportes», que era el último item del menú sin
   * módulo. Desde entonces no queda ninguno: la regla negativa se conserva
   * intacta y se comprueba sobre identificadores inexistentes, que siguen sin
   * navegar y sin vaciar el contenido.
   */
  it('ya no queda ningún item del menú sin módulo', () => {
    const html = shell();

    expect(noAutorizados).toEqual([]);
    expect(apariciones(html, /data-hospital-nav="navegable"/gu)).toBe(
      HOSPITAL_ITEMS_NAVEGABLES.length,
    );
    expect(apariciones(html, /data-hospital-nav="sin-modulo"/gu)).toBe(0);

    for (const item of HOSPITAL_NAV_ITEMS) {
      expect(html).toContain(item.etiqueta);
    }
  });

  it('activar un item sin vista conserva la vista actual', () => {
    for (const id of [...noAutorizados.map((item) => item.id), 'inexistente']) {
      for (const vista of HOSPITAL_VISTAS_IMPLEMENTADAS) {
        expect(siguienteVista(vista, id)).toBe(vista);
      }
    }

    expect(siguienteVista('agenda', 'inexistente')).toBe('agenda');
  });

  it('«Configuración» es el único acceso del menú al contenedor administrativo', () => {
    expect(destinoDeItem('configuracion')).toEqual({ vista: 'administracion' });
    expect(destinoDeItem('membresias')).toBeNull();
    expect(destinoDeItem('reportes')).toEqual({ vista: 'reportes' });
    expect(destinoDeItem('inexistente')).toBeNull();

    for (const vista of HOSPITAL_VISTAS_IMPLEMENTADAS) {
      expect(destinoDeItem(vista)).toEqual({ vista });
    }
  });

  it('la vista administrativa resalta «Configuración» y nunca «Membresías y servicios»', () => {
    const html = shell('administracion');
    const activo = /<button[^>]*aria-current="true"[^>]*>(?<cuerpo>[\s\S]*?)<\/button>/u.exec(html)
      ?.groups?.cuerpo;

    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
    expect(texto(activo ?? '')).toContain('Configuración');
    expect(html).not.toContain('Membresías y servicios');
  });

  /*
   * TASK-003H-06 sustituye el destino provisional por el módulo financiero; la
   * posición en el menú y el destino de navegación no cambian.
   */
  it('«Gestión financiera» navega a su propio módulo, encima de «Reportes»', () => {
    const ids = HOSPITAL_NAV_ITEMS.map((item) => item.id);
    const visible = texto(main(shell('financiera')));

    expect(ids.slice(-3)).toEqual(['financiera', 'reportes', 'configuracion']);
    expect(destinoDeItem('financiera')).toEqual({ vista: 'financiera' });
    expect(visible).toContain('Gestión financiera');
    expect(visible).not.toContain('Módulo en preparación.');
  });
});

/* ------------------ Intención de navegación (TASK-003H-02B) --------------- */

/** Estado de partida de cualquier transición evaluada como función pura. */
const INICIO = HOSPITAL_NAVEGACION_INICIAL;

describe('T-11 — Contrato de navegación con intención', () => {
  it('acepta las llamadas actuales sin intención y no introduce ninguna', () => {
    for (const vista of HOSPITAL_VISTAS_IMPLEMENTADAS) {
      expect(siguienteNavegacion(INICIO, vista)).toEqual({ vista, intencion: null });
      expect(siguienteNavegacion(INICIO, { vista })).toEqual({ vista, intencion: null });
    }
  });

  it('transporta las cuatro intenciones aprobadas hacia su vista', () => {
    expect(siguienteNavegacion(INICIO, { vista: 'alarmas', intencion: 'rojas' })).toEqual({
      vista: 'alarmas',
      intencion: 'rojas',
    });
    expect(siguienteNavegacion(INICIO, { vista: 'alarmas', intencion: 'amarillas' })).toEqual({
      vista: 'alarmas',
      intencion: 'amarillas',
    });
    expect(
      siguienteNavegacion(INICIO, { vista: 'agenda', intencion: 'pendientes-asignacion' }),
    ).toEqual({ vista: 'agenda', intencion: 'pendientes-asignacion' });
    expect(siguienteNavegacion(INICIO, { vista: 'virtuales', intencion: 'en-espera' })).toEqual({
      vista: 'virtuales',
      intencion: 'en-espera',
    });
  });

  it('descarta una intención que la vista destino no declara', () => {
    expect(siguienteNavegacion(INICIO, { vista: 'pacientes', intencion: 'rojas' })).toEqual({
      vista: 'pacientes',
      intencion: null,
    });
    expect(esIntencionSoportada('pacientes', 'rojas')).toBe(false);
    expect(esIntencionSoportada('alarmas', 'en-espera')).toBe(false);
  });

  it('limpia la intención al navegar desde el sidebar o un acceso sin intención', () => {
    const conIntencion = siguienteNavegacion(INICIO, { vista: 'alarmas', intencion: 'rojas' });

    // Sidebar: identificador suelto, sin intención.
    expect(siguienteNavegacion(conIntencion, 'pacientes')).toEqual({
      vista: 'pacientes',
      intencion: null,
    });
    // Acceso de `Ir a`, KPI o acción rápida sin intención.
    expect(siguienteNavegacion(conIntencion, { vista: 'alarmas' })).toEqual({
      vista: 'alarmas',
      intencion: null,
    });
  });

  it('un identificador sin vista implementada conserva el estado tal cual', () => {
    const conIntencion = siguienteNavegacion(INICIO, {
      vista: 'agenda',
      intencion: 'pendientes-asignacion',
    });

    for (const id of ['membresias', 'inexistente']) {
      expect(siguienteNavegacion(conIntencion, id)).toEqual(conIntencion);
    }
  });

  it('declara exactamente las cuatro intenciones aprobadas, todas con texto', () => {
    expect([...HOSPITAL_INTENCIONES]).toEqual([
      'rojas',
      'amarillas',
      'pendientes-asignacion',
      'en-espera',
    ]);
    for (const intencion of HOSPITAL_INTENCIONES) {
      expect(HOSPITAL_ETIQUETA_INTENCION[intencion].trim().length).toBeGreaterThan(0);
    }
  });
});

describe('T-11 — Aviso visible de intención', () => {
  it('anuncia la intención sin afirmar que se aplicó un filtro', () => {
    const contenido = texto(main(shell('alarmas', 'rojas')));

    expect(contenido).toContain('Mostrando intención: alarmas rojas');
    expect(contenido).toContain('La vista no aplica ningún filtro');
  });

  it('sin intención el área de contenido no muestra ningún aviso', () => {
    for (const vista of HOSPITAL_VISTAS_IMPLEMENTADAS) {
      expect(texto(main(shell(vista)))).not.toContain('Mostrando intención');
    }
  });
});

describe('T-17 — Regresión de las demás vistas', () => {
  it('la intención no cambia el contenido aprobado de la vista destino', () => {
    const casos: readonly (readonly [HospitalVistaId, HospitalIntencionId])[] = [
      ['alarmas', 'rojas'],
      ['alarmas', 'amarillas'],
      ['agenda', 'pendientes-asignacion'],
      ['virtuales', 'en-espera'],
    ];
    const aviso = /<p class="[^"]*_intencion_[^"]*">[\s\S]*?<\/p>/u;

    for (const [vista, intencion] of casos) {
      expect(main(shell(vista, intencion)).replace(aviso, '')).toBe(main(shell(vista)));
    }
  });
});

describe('T-12 — Alcance negativo de la navegación', () => {
  it('ninguna vista crea rutas, formularios, scripts ni recursos remotos', () => {
    for (const vista of HOSPITAL_VISTAS_IMPLEMENTADAS) {
      const html = shell(vista);

      expect(html).not.toContain('href');
      expect(html).not.toContain('<script');
      expect(html).not.toContain('http://');
      expect(html).not.toContain('https://');
    }
  });
});
