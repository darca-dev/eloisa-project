import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { branding } from '@/config/branding';

import { HospitalShell } from './HospitalShell';
import { HospitalInstitutionIdentity, metadatoInstitucional } from './HospitalSidebar';
import { HospitalSessionActions } from './HospitalTopbar';
import { HOSPITAL_NAV_ITEMS, hospitalShellDemo } from './hospitalConfig';
import type { HospitalInstitution, HospitalShellConfig } from './hospitalConfig';
import type { HospitalSesionDto } from './hospitalInstitutionClient';
import { SESION_INSTITUCIONAL_FICTICIA, apariciones, texto } from './hospitalTestUtils';
import type { HospitalVisitaMaterializadaDto } from './hospitalVisitsClient';

const DIRECTORIO_SHELL = fileURLToPath(new URL('.', import.meta.url));

/**
 * Pruebas del Shell Hospital (TASK-003H-01, T-01 a T-05).
 *
 * Se renderiza con `react-dom/server`, igual que el resto del frontend: el
 * shell es un componente de servidor sin estado ni interactividad.
 *
 * TASK-003H-02 monta el bloque superior del Dashboard dentro de `<main>`. Estas
 * pruebas se conservan como regresión del shell: sidebar, topbar, buscador,
 * perfil, menú completo e Inicio activo deben seguir exactamente iguales.
 *
 * H-FID-B retira la campana y el conteo demostrativo de novedades —no tienen
 * fuente real— e integra el corazón canónico junto a Eloisa. Las expectativas
 * que exigían el badge quedan invertidas: ahora se verifica su AUSENCIA. La fidelidad del Dashboard se prueba aparte, en
 * `hospitalDashboard.test.tsx`.
 *
 * TASK-HOSPITAL-CORE-01 (§4.1.11, §10.10 y §12.3) añade la superficie
 * AUTENTICADA. El contexto de sesión se INYECTA por propiedad porque
 * `renderToStaticMarkup` no ejecuta efectos y el repositorio no incluye jsdom:
 * lo que se verifica aquí es qué se muestra con y sin sesión, no cómo se
 * consulta, que se prueba en `hospitalInstitutionClient.test.ts`.
 */

/** Contenido del área principal, sin sidebar ni topbar. */
function mainDe(html: string): string {
  return /<main[^>]*>(?<contenido>[\s\S]*)<\/main>/u.exec(html)?.groups?.contenido ?? '';
}

/** Todo lo que precede al área principal: sidebar y topbar. */
function envolventeDe(html: string): string {
  return html.slice(0, html.indexOf('<main'));
}

/**
 * Solo el menú del sidebar.
 *
 * TASK-003H-02 y TASK-003H-02B montaron el Centro de control dentro de
 * `<main>`, de modo que contar los botones de todo el documento ya no mide el
 * menú. Estas pruebas son regresión del sidebar: acotan el conteo a su `<nav>`.
 */
function navDe(html: string): string {
  return /<nav[^>]*>(?<contenido>[\s\S]*?)<\/nav>/u.exec(html)?.groups?.contenido ?? '';
}

/**
 * Shell con la sesión institucional ficticia ya resuelta.
 *
 * Desde MP-TODAY-02 el shell no monta Hospital sin sesión resuelta, de modo que
 * verificar su composición exige inyectar el contexto. La estructura, el menú,
 * los badges y la accesibilidad son las mismas que antes: lo único que cambia
 * es de dónde sale la identidad mostrada.
 */
function shell(config?: HospitalShellConfig): string {
  return renderToStaticMarkup(
    config === undefined ? (
      <HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} />
    ) : (
      <HospitalShell config={config} sesionInicial={SESION_INSTITUCIONAL_FICTICIA} />
    ),
  );
}

/** Shell en el estado neutral: la sesión todavía no se ha resuelto. */
function shellComprobando(): string {
  return renderToStaticMarkup(<HospitalShell />);
}

/**
 * Literales demostrativos que NO pueden aparecer sin una sesión confirmada.
 *
 * Las etiquetas del menú no entran en esta lista: H-FID-A las conserva porque
 * son la estructura aprobada de Hospital, no un dato de `hospitalShellDemo`.
 */
const DATOS_DEMOSTRATIVOS: readonly string[] = [
  'Hospital San Rafael',
  'ESE · Soacha',
  'Claudia Vargas',
  'Coordinación domiciliaria',
  'Novedades: 7 sin leer',
  '7 sin leer',
  'CENTRO DE CONTROL OPERATIVO',
  'Atención domiciliaria de hoy',
  'Buscar paciente, documento, profesional, cita, atención o municipio',
];

const SESION_REVISORA: HospitalSesionDto = {
  role: 'HOSPITAL_ACCESS_REVIEWER',
  expiresAt: '2026-09-30T20:00:00.000Z',
  institution: { name: 'Hospital ficticio de revisión' },
  actorDisplay: 'Acceso institucional',
};

/**
 * Comprobaciones comunes del MARCO NEUTRAL (H-FID-A).
 *
 * Los dos estados no autenticados —`consultando` y `sin-sesion`— conservan la
 * envolvente reconocible de Hospital: sidebar y área principal. Lo que NO
 * conservan es nada que dependa de una sesión.
 */
function verificarMarcoNeutral(html: string): void {
  // Geometría de Hospital: sidebar y área principal.
  expect(html).toContain('<aside');
  expect(html).toContain('<nav');
  expect(html).toContain('<main');
  expect(html).toContain('aria-label="Panel institucional"');

  // Sin topbar funcional, sin módulo y sin marcador de contenido.
  expect(html).not.toContain('<header');
  expect(html).not.toContain('data-hospital-content');
  expect(html).not.toContain('_bellBadge_');
  expect(html).not.toContain('_navBadge_');
  expect(html).not.toContain('data-hospital-sesion');

  // Menú presente, en su orden aprobado y SIN badge alguno.
  const menu = navDe(html);
  const posiciones = HOSPITAL_NAV_ITEMS.map((item) => menu.indexOf(item.etiqueta));

  expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
  expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  /*
   * El conteo demostrativo no viaja al menú neutral, ni como badge visual ni
   * como alternativa textual. No se busca el dígito suelto porque los trazados
   * SVG de los iconos también lo contienen.
   */
  expect(menu).not.toContain('sin leer');
  expect(menu).not.toContain(`>${String(hospitalShellDemo.novedades)}<`);

  // Menú INERTE: ni botones, ni enlaces, ni estado activo.
  expect(menu).not.toContain('<button');
  expect(menu).not.toContain('href');
  expect(menu).not.toContain('onclick');
  expect(html).not.toContain('aria-current');
  expect(html).not.toContain('_navItemActive_');
  expect(html.match(/data-hospital-nav="bloqueado"/gu) ?? []).toHaveLength(
    HOSPITAL_NAV_ITEMS.length,
  );
  expect(html).not.toContain('data-hospital-nav="navegable"');

  // Marca de plataforma sí; identidad institucional o personal, no.
  expect(html).toContain(branding.platformDisplayName);
  expect(html).not.toContain('_identityName_');
  expect(html).not.toContain('_identityMeta_');

  for (const demo of DATOS_DEMOSTRATIVOS) {
    expect(html).not.toContain(demo);
  }
}

describe('T-01 — Estructura del shell', () => {
  it('renderiza sidebar, topbar y área principal', () => {
    const html = shell();

    expect(html).toContain('<aside');
    expect(html).toContain('<nav');
    expect(html).toContain('<header');
    expect(html).toContain('<main');
    expect(html).toContain('data-hospital-content="dashboard"');
  });

  it('el área principal contiene únicamente el bloque superior del Dashboard', () => {
    const html = shell();
    const contenido = mainDe(html);

    expect(contenido).toContain('CENTRO DE CONTROL OPERATIVO');
    expect(contenido).toContain('Atención domiciliaria de hoy');
    expect(contenido).toContain('CITAS PENDIENTES DE ASIGNACIÓN');

    // Nada por debajo de la cuadrícula: la sección del Dashboard la cierra.
    const despuesDeLaSeccion = contenido.slice(contenido.lastIndexOf('</section>') + 10);
    expect(despuesDeLaSeccion.trim()).toBe('');
  });
});

describe('SPEC 038 MP03-C2 — acceso por rol a la bandeja', () => {
  it('el revisor entra directo a solicitudes y solo recibe Configuración en el menú', () => {
    const html = renderToStaticMarkup(<HospitalShell sesionInicial={SESION_REVISORA} />);
    const navigation = navDe(html);
    expect(html).toContain('data-hospital-content="administracion"');
    expect(html).toContain('data-hospital-admin="Solicitudes de acceso"');
    expect(html).toContain('Revisión de solicitudes de acceso');
    expect(navigation).toContain('Configuración');
    expect(navigation).not.toContain('Pacientes');
    expect(navigation).not.toContain('Agenda y citas');
  });

  it('el visor de pacientes no monta ni ofrece la bandeja de revisión', () => {
    const html = shell();
    expect(html).not.toContain('data-hospital-admin="Solicitudes de acceso"');
    expect(html).not.toContain('Datos ficticios de prueba');
  });
});

describe('T-02 — Menú completo', () => {
  const etiquetas = HOSPITAL_NAV_ITEMS.map((item) => item.etiqueta);

  it('conserva los doce elementos en el orden aprobado', () => {
    // Decisión final de la Product Owner: «Membresías y servicios» deja de ser
    // una opción principal y permanece dentro de «Configuración»; la zona
    // inferior queda «Gestión financiera», «Reportes» y «Configuración».
    expect(etiquetas).toEqual([
      'Inicio',
      'Agenda y citas',
      'Pacientes',
      'Semáforo de alarmas',
      'Profesionales',
      'Visitas domiciliarias',
      'Consultas virtuales',
      'Calificaciones',
      'Novedades',
      'Gestión financiera',
      'Reportes',
      'Configuración',
    ]);
    expect(etiquetas.slice(-3)).toEqual(['Gestión financiera', 'Reportes', 'Configuración']);
    expect(etiquetas).not.toContain('Membresías y servicios');
  });

  it('las etiquetas aparecen en pantalla en ese mismo orden', () => {
    const html = shell();
    const posiciones = etiquetas.map((etiqueta) => html.indexOf(etiqueta));

    expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  it('cada elemento del menú es un botón real, sin enlaces ni acciones en línea', () => {
    const html = shell();
    const botones = navDe(html).match(/<button[^>]*type="button"/gu) ?? [];

    expect(botones.length).toBe(HOSPITAL_NAV_ITEMS.length);
    expect(html).not.toContain('href');
    expect(html).not.toContain('onclick');
  });

  it('dibuja un separador antes de las opciones institucionales', () => {
    const html = shell();
    const separadores = html.match(/class="[^"]*_navSeparator_[^"]*"/gu) ?? [];

    expect(separadores.length).toBe(1);
    expect(html.indexOf('_navSeparator_')).toBeGreaterThan(html.indexOf('Novedades'));
    expect(html.indexOf('_navSeparator_')).toBeLessThan(html.indexOf('Gestión financiera'));
  });

  it('H-FID-B: «Novedades» no lleva badge ni conteo sin fuente real', () => {
    /*
     * El conteo procedía de `hospitalShellDemo`, no de ninguna fuente. Se
     * retira sin sustituto: ni cero, ni placeholder, ni badge neutro (§4.3.5).
     */
    const html = shell();
    const menu = navDe(html);

    expect(html).not.toContain('_navBadge_');
    expect(menu).toContain('Novedades');
    expect(menu).not.toContain('sin leer');
    expect(menu).not.toContain(`>${String(hospitalShellDemo.novedades)}<`);
  });

  it('cada elemento dibuja su icono SVG de trazo, no un emoji', () => {
    const html = envolventeDe(shell());

    /*
     * Sin conteo global: cada opción del menú es un botón real dentro del
     * `<nav>` con exactamente un icono SVG de trazo, en el mismo sistema visual
     * aprobado (§4.3, FR-05). El trazo (`fill="none"` + `stroke="currentColor"`)
     * es la garantía semántica de que no se sustituye por emoji ni relleno.
     */
    const botonesNav =
      navDe(html).match(/<button[^>]*type="button"[^>]*>[\s\S]*?<\/button>/gu) ?? [];

    expect(botonesNav).toHaveLength(HOSPITAL_NAV_ITEMS.length);
    for (const boton of botonesNav) {
      expect(apariciones(boton, /<svg\b/gu)).toBe(1);
      expect(boton).toMatch(
        /<svg[^>]*viewBox="0 0 24 24"[^>]*fill="none"[^>]*stroke="currentColor"/u,
      );
    }

    /*
     * Los controles de la envolvente —hamburguesa de la topbar y cierre del
     * menú móvil del sidebar— dibujan del mismo modo y quedan enlazados con el
     * panel lateral (H-FID-A). No dependen de un conteo externo.
     */
    const hamburguesa =
      /<button[^>]*aria-label="Abrir menú de navegación"[^>]*>[\s\S]*?<\/button>/u.exec(html)?.[0] ?? '';
    const cierre =
      /<button[^>]*aria-label="Cerrar menú de navegación"[^>]*>[\s\S]*?<\/button>/u.exec(html)?.[0] ?? '';

    expect(hamburguesa).not.toBe('');
    expect(cierre).not.toBe('');
    expect(hamburguesa).toContain('aria-controls="hospital-sidebar"');
    expect(hamburguesa).toContain('aria-expanded="false"');
    expect(hamburguesa).toMatch(
      /<svg[^>]*viewBox="0 0 24 24"[^>]*fill="none"[^>]*stroke="currentColor"/u,
    );
    expect(cierre).toMatch(
      /<svg[^>]*viewBox="0 0 24 24"[^>]*fill="none"[^>]*stroke="currentColor"/u,
    );
  });
});

describe('T-02/T-05 — Estado visual de Inicio', () => {
  it('marca Inicio como activo y deja el resto inactivo', () => {
    const html = shell();
    const activos = html.match(/class="[^"]*_navItemActive_[^"]*"/gu) ?? [];
    const actuales = html.match(/aria-current="true"/gu) ?? [];

    expect(activos.length).toBe(1);
    expect(actuales.length).toBe(1);
  });

  it('el estado activo no se comunica solo con color', () => {
    const html = shell();
    const activo = /<button[^>]*_navItemActive_[^>]*>/u.exec(html)?.[0] ?? '';

    expect(activo).toContain('aria-current="true"');
  });
});

describe('T-01/T-04 — Buscador y perfil', () => {
  it('reproduce el texto exacto del buscador sin campo de búsqueda', () => {
    const html = shell();

    expect(html).toContain('Buscar paciente, documento, profesional, cita, atención o municipio');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('role="search"');
  });

  it('H-FID-B: no dibuja campana, badge ni conteo de novedades', () => {
    const html = shell();

    expect(html).not.toContain('_bellBadge_');
    expect(html).not.toContain('_bell_');
    expect(html).not.toContain('Novedades: 7 sin leer');
    expect(html).not.toContain('sin leer');
    expect(html).not.toContain('dialog');
  });

  it('muestra el perfil del contexto institucional, no una persona demostrativa', () => {
    /*
     * La composición del perfil —avatar, nombre, rol— es la misma que aprobó
     * TASK-003H-01; lo que cambia es su procedencia: el actor IMPERSONAL y el
     * rol efectivo que devuelve el servidor.
     */
    const html = shell();

    expect(html).toContain('data-hospital-sesion="institucional"');
    expect(html).toContain('Acceso institucional');
    expect(html).toContain('Consulta de pacientes');
    expect(html).not.toContain('Claudia Vargas');
    expect(html).not.toContain('Coordinación domiciliaria');
  });
});

describe('T-03 — Identidad desde configuración tipada', () => {
  it('muestra la plataforma y el nombre REAL del tenant de la sesión', () => {
    const html = shell();

    expect(html).toContain(branding.platformDisplayName);
    expect(html).toContain('Institución ficticia de pruebas');
    expect(html).not.toContain('Hospital San Rafael');
    expect(html).not.toContain('ESE · Soacha');
  });

  it('con sesión vigente la identidad NO sale de la configuración demostrativa', () => {
    const otra: HospitalShellConfig = {
      ...hospitalShellDemo,
      institucion: {
        nombre: 'Hospital Demostrativo Dos',
        tipo: 'IPS',
        municipio: 'Sibaté',
        logo: null,
      },
      usuario: { nombre: 'Ana Ficticia', rol: 'Gestión de agenda', iniciales: 'AF' },
      novedades: 3,
    };
    const html = shell(otra);

    /*
     * La configuración sigue gobernando la estructura y los conteos, pero la
     * identidad la fija el contexto de sesión: mostrar la institución o la
     * persona de la configuración junto a una sesión real afirmaría una
     * atribución que el servidor no respalda.
     */
    expect(html).toContain('Institución ficticia de pruebas');
    expect(html).not.toContain('Hospital Demostrativo Dos');
    expect(html).not.toContain('IPS · Sibaté');
    expect(html).not.toContain('Ana Ficticia');
    expect(html).not.toContain('Gestión de agenda');
    expect(html).not.toContain('Hospital San Rafael');
    expect(html).not.toContain('Claudia Vargas');

    const botones = navDe(html).match(/<button[^>]*type="button"/gu) ?? [];
    expect(botones.length).toBe(HOSPITAL_NAV_ITEMS.length);
  });

  it('H-FID-B: ningún conteo de la configuración llega a la pantalla', () => {
    /*
     * Aunque la configuración siga transportando un número, la topbar ya no lo
     * afirma: no hay fuente real de novedades y no se inventa ninguna.
     */
    const html = shell({ ...hospitalShellDemo, novedades: 3 });

    expect(html).not.toContain('_bellBadge_');
    expect(html).not.toContain('_navBadge_');
    expect(html).not.toContain('sin leer');
  });
});

describe('T-04 — Alcance negativo', () => {
  it('Inicio no monta el contenido de otro módulo del menú', () => {
    /*
     * TASK-003H-02 y TASK-003H-02B aprobaron el Centro de control operativo
     * dentro de `<main>`, de modo que la expectativa original —«ningún
     * contenido funcional»— quedó obsoleta. Lo que sigue siendo regresión es
     * que Inicio no reimplemente otra vista: la composición del propio Centro
     * de control se prueba en `hospitalDashboard.test.tsx`.
     */
    const html = mainDe(shell());

    for (const prohibido of [
      'Calendario de agosto de 2026',
      'Ficha del paciente',
      'Vinculación y documentos',
      'Planes de membresía',
      'Auditoría del sistema',
      'FURAG',
      'ADRES',
    ]) {
      expect(html).not.toContain(prohibido);
    }
    expect(html).toContain('CENTRO DE CONTROL OPERATIVO');
  });

  it('no incluye formularios, recursos remotos ni scripts', () => {
    const html = shell();

    expect(html).not.toContain('<form');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('<script');
  });
});

describe('T-05 — Accesibilidad', () => {
  it('expone regiones semánticas con nombre accesible', () => {
    const html = shell();

    expect(html).toContain('aria-label="Panel de Institución ficticia de pruebas"');
    expect(html).toContain('aria-label="Secciones de la experiencia Hospital"');
  });

  it('los SVG son decorativos y no duplican el texto anunciado', () => {
    const html = shell();
    const svgs = html.match(/<svg/gu) ?? [];
    const ocultos = html.match(/<svg[^>]*aria-hidden="true"/gu) ?? [];

    expect(svgs.length).toBe(ocultos.length);
    expect(html).not.toContain('<title>');
  });

  it('H-FID-B: no queda ningún anuncio accesible de un conteo sin fuente', () => {
    const html = shell();

    expect(html).not.toContain('Novedades: 7 sin leer');
    expect(html).not.toContain('7 sin leer');
  });
});

/* -------------------------------------------------------------------------- */
/* TASK-HOSPITAL-CORE-01 — Superficie autenticada                              */
/* -------------------------------------------------------------------------- */

/*
 * El contexto de sesión ficticio es ÚNICO en el repositorio y vive en
 * `hospitalTestUtils.ts`: las suites heredadas inyectan exactamente el mismo.
 */
const SESION_HOSPITAL = SESION_INSTITUCIONAL_FICTICIA;

function shellConSesion(
  sesion: HospitalSesionDto | 'sin-sesion' | null = SESION_HOSPITAL,
): string {
  return renderToStaticMarkup(<HospitalShell sesionInicial={sesion} />);
}

describe('T-H11 — Contexto de sesión institucional en el shell', () => {
  const html = shellConSesion();
  const envolvente = envolventeDe(html);

  it('muestra el nombre REAL del tenant que devuelve el servidor', () => {
    expect(envolvente).toContain('Institución ficticia de pruebas');
    expect(html).toContain('aria-label="Panel de Institución ficticia de pruebas"');
  });

  it('el topbar autenticado NO muestra ninguna persona demostrativa', () => {
    /*
     * La credencial institucional es COMPARTIDA por la institución: no
     * corresponde a ninguna persona trabajadora y presentarla como un nombre
     * propio afirmaría una atribución que el sistema no puede sostener.
     */
    expect(envolvente).not.toContain('Claudia Vargas');
    expect(envolvente).not.toContain('Coordinación domiciliaria');
    expect(envolvente).not.toContain('CV');
  });

  it('no muestra institución, tipo, municipio ni logo demostrativos', () => {
    for (const demo of ['Hospital San Rafael', 'ESE · Soacha', 'ESE', 'Soacha']) {
      expect(envolvente).not.toContain(demo);
    }
  });

  it('muestra el actor impersonal y la etiqueta del rol efectivo', () => {
    expect(envolvente).toContain('Acceso institucional');
    expect(envolvente).toContain('Consulta de pacientes');
    expect(html).toContain('data-hospital-sesion="institucional"');
  });

  it('la caducidad se anuncia a lectores de pantalla, no como dato visual', () => {
    expect(envolvente).toContain('Sesión vigente hasta 22/08/2026 20:00 UTC');
  });

  it('no expone tenant, identidad, código ni credencial', () => {
    for (const prohibido of ['tenantId', 'identityId', 'accessSecret', 'token', 'HOSPITAL_PATIENT_VIEWER']) {
      expect(envolvente).not.toContain(prohibido);
    }
  });

  it('conserva la composición del shell: sidebar, topbar, menú y área principal', () => {
    expect(html).toContain('<aside');
    expect(html).toContain('<header');
    expect(html).toContain('<main');
    expect(navDe(html).match(/<button[^>]*type="button"/gu) ?? []).toHaveLength(
      HOSPITAL_NAV_ITEMS.length,
    );
    // El buscador sigue exactamente igual; la campana ya no existe (H-FID-B).
    expect(envolvente).toContain('Buscar paciente, documento, profesional, cita, atención o municipio');
    expect(envolvente).not.toContain('Novedades: 7 sin leer');
  });

  it('una sesión municipal se rotula con SU rol, sin prometer Hospital', () => {
    const municipal = envolventeDe(
      shellConSesion({ ...SESION_HOSPITAL, role: 'MUNICIPAL_VIEWER' }),
    );

    expect(municipal).toContain('Consulta municipal agregada');
    expect(municipal).not.toContain('Consulta de pacientes');
    expect(municipal).not.toContain('Claudia Vargas');
  });

  it('sin sesión resuelta no se monta esta superficie', () => {
    /*
     * Es el primer render y también el render de servidor: la consulta todavía
     * no ha respondido, de modo que no hay identidad que mostrar.
     */
    const comprobando = shellComprobando();

    expect(comprobando).not.toContain('Acceso institucional');
    expect(comprobando).not.toContain('Institución ficticia de pruebas');
  });

  it('no introduce enlaces, formularios ni recursos remotos', () => {
    expect(html).not.toContain('<form');
    expect(html).not.toContain('href');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('<script');
  });
});

/* -------------------------------------------------------------------------- */
/* MP-TODAY-02 — Acceso institucional operable                                 */
/* -------------------------------------------------------------------------- */

/**
 * Estas pruebas verifican las TRES superficies estáticas del shell —sin
 * resolver, sin sesión y con sesión— con `renderToStaticMarkup`, que es como se
 * prueba el resto del frontend. Los gestos (escribir, enviar, cerrar) no se
 * ejercitan aquí porque el repositorio no incluye jsdom: el comportamiento de
 * red que disparan se prueba en `hospitalInstitutionClient.test.ts`.
 */

describe('T-H12 — Sin sesión resuelta se muestra el acceso, no la demostración', () => {
  const html = shellConSesion('sin-sesion');

  it('muestra el formulario de acceso institucional con sus dos campos', () => {
    expect(html).toContain('<form');
    expect(html).toContain('Acceso institucional');
    expect(html).toContain('Código de identidad institucional');
    expect(html).toContain('Credencial de acceso');
    expect(html).toContain('type="text"');
    expect(html).toContain('type="password"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('Entrar');
  });

  it('NO muestra ningún dato demostrativo: ni institución, ni persona, ni conteos', () => {
    for (const demo of [...DATOS_DEMOSTRATIVOS, 'CV']) {
      expect(html).not.toContain(demo);
    }
  });

  it('conserva la envolvente Hospital: sidebar neutral y área principal', () => {
    /*
     * H-FID-A: el acceso vive DENTRO de la geometría de Hospital. Que el marco
     * se vea no concede nada: no hay topbar funcional, ni módulo, ni
     * navegación operable, y la autoridad sigue siendo el servidor.
     */
    verificarMarcoNeutral(html);
  });

  it('el formulario está integrado en el área principal, no en una pantalla aparte', () => {
    const contenido = mainDe(html);

    expect(contenido).toContain('<form');
    expect(contenido).toContain('Acceso institucional');
    expect(contenido).toContain('id="hospital-acceso-codigo"');
    expect(contenido).toContain('id="hospital-acceso-credencial"');
  });

  it('la credencial no viaja por la URL ni queda escrita en el marcado', () => {
    /*
     * Sin `action` ni `method`, el envío lo gobierna el manejador del cliente y
     * el navegador no puede componer una URL con lo escrito. Los campos nacen
     * vacíos y el autocompletado queda desactivado.
     */
    expect(html).not.toContain('action=');
    expect(html).not.toContain('method=');
    expect(html).not.toContain('href');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
    expect(html).not.toMatch(/autocomplete="on"/iu);
    // React conserva el nombre camelCase; el atributo HTML no distingue caja.
    expect(html.match(/autocomplete="off"/giu) ?? []).toHaveLength(2);
    expect(html.match(/value=""/gu) ?? []).toHaveLength(2);
  });

  it('no expone identidad, tenant ni credencial en el marcado', () => {
    for (const prohibido of [
      'tenantId',
      'identityId',
      'accessSecret',
      'identityCode',
      'HOSPITAL_PATIENT_VIEWER',
      'merdn_institutional_session',
    ]) {
      expect(html).not.toContain(prohibido);
    }
  });

  it('cada campo tiene etiqueta asociada y los avisos tienen región viva', () => {
    expect(html).toContain('for="hospital-acceso-codigo"');
    expect(html).toContain('id="hospital-acceso-codigo"');
    expect(html).toContain('for="hospital-acceso-credencial"');
    expect(html).toContain('id="hospital-acceso-credencial"');
    expect(html).toContain('aria-labelledby="hospital-acceso-titulo"');
    expect(html).toContain('role="alert"');
  });

  it('declara que la credencial es institucional y compartida', () => {
    // No debe hacerse pasar por una cuenta personal de quien la escribe.
    expect(html).toContain('no identifica a ninguna persona trabajadora');
  });
});

describe('T-H13 — Acción sobre la propia sesión', () => {
  it('con sesión vigente la topbar ofrece solo cerrar sesión', () => {
    const envolvente = envolventeDe(shellConSesion());

    expect(envolvente).toContain('Cerrar sesión');
    expect(envolvente).not.toContain('Cambiar sesión');
    expect(envolvente).toContain('data-hospital-sesion="institucional"');
  });

  it('la acción es un botón real, sin enlace', () => {
    const envolvente = envolventeDe(shellConSesion());
    const acciones = /<div class="[^"]*_sesionAcciones_[^"]*">(?<contenido>[\s\S]*?)<\/div>/u
      .exec(envolvente)
      ?.groups?.contenido ?? '';

    expect(acciones.match(/<button[^>]*type="button"/gu) ?? []).toHaveLength(1);
    expect(envolvente).not.toContain('href');
  });

  it('mientras la sesión no se ha resuelto no se ofrece cerrar sesión', () => {
    /*
     * Es el render de servidor y el primer render del cliente: ofrecer «Cerrar
     * sesión» ahí sugeriría una sesión que nadie ha confirmado todavía.
     */
    const sinResolver = shellComprobando();

    expect(sinResolver).not.toContain('Cerrar sesión');
  });

  it('la superficie autenticada sigue sin formulario', () => {
    // El acceso ya se resolvió: aquí no hay nada que escribir.
    expect(shellConSesion()).not.toContain('<form');
  });
});

describe('H-FID-A — El shell autenticado no sufre regresión', () => {
  const html = shellConSesion();

  it('sigue montando sidebar identificado, topbar y contenido del módulo', () => {
    expect(html).toContain('<aside');
    expect(html).toContain('<header');
    expect(html).toContain('data-hospital-content="dashboard"');
    expect(html).toContain('aria-label="Panel de Institución ficticia de pruebas"');
    expect(html).toContain('CENTRO DE CONTROL OPERATIVO');
  });

  it('el menú autenticado sigue siendo operable, ya sin badge demostrativo', () => {
    const menu = navDe(html);

    expect(menu.match(/<button[^>]*type="button"/gu) ?? []).toHaveLength(
      HOSPITAL_NAV_ITEMS.length,
    );
    expect(html).toContain('data-hospital-nav="navegable"');
    expect(html).not.toContain('data-hospital-nav="bloqueado"');
    expect(html).not.toContain('Novedades: 7 sin leer');
    expect(html.match(/aria-current="true"/gu) ?? []).toHaveLength(1);
  });

  it('no cae en el marco neutral ni muestra el acceso', () => {
    expect(html).not.toContain('aria-label="Panel institucional"');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Comprobando acceso institucional…');
  });
});

describe('T-H14 — Rol de agenda hospitalaria en el topbar', () => {
  it('una sesión de agenda se rotula con SU rol, sin prometer Pacientes', () => {
    /*
     * `HOSPITAL_SCHEDULER` es DISJUNTO de `HOSPITAL_PATIENT_VIEWER`: rotularlo
     * como consulta de pacientes afirmaría un acceso que ese rol no tiene.
     */
    const agenda = envolventeDe(shellConSesion({ ...SESION_HOSPITAL, role: 'HOSPITAL_SCHEDULER' }));

    expect(agenda).toContain('Agenda hospitalaria');
    expect(agenda).not.toContain('Consulta de pacientes');
    expect(agenda).not.toContain('Consulta municipal agregada');
    expect(agenda).not.toContain('HOSPITAL_SCHEDULER');
  });
});

describe('T-H15 — Estado neutral mientras se comprueba el acceso', () => {
  const html = shellComprobando();

  it('muestra únicamente el texto de comprobación, anunciado como estado', () => {
    expect(html).toContain('Comprobando acceso institucional…');
    expect(html).toContain('role="status"');
  });

  it('conserva la envolvente Hospital sin montar topbar, navegación ni módulo', () => {
    verificarMarcoNeutral(html);
  });

  it('no muestra NINGÚN dato demostrativo mientras no hay respuesta del servidor', () => {
    for (const demo of DATOS_DEMOSTRATIVOS) {
      expect(html).not.toContain(demo);
    }
  });

  it('el estado de comprobación vive en el área principal', () => {
    const contenido = mainDe(html);

    expect(contenido).toContain('Comprobando acceso institucional…');
    expect(contenido).toContain('role="status"');
  });

  it('tampoco ofrece el acceso: todavía no se sabe si hay sesión', () => {
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('href');
  });
});

/* -------------------------------------------------------------------------- */
/* H-FID-B — Marca Eloisa, identidad institucional y topbar compacto           */
/* -------------------------------------------------------------------------- */

describe('H-FID-B — Marca Eloisa y logo institucional', () => {
  /** Institución sin metadato ni logo: nada que afirmar más allá del nombre. */
  const INSTITUCION_MINIMA: HospitalInstitution = {
    nombre: 'Institución ficticia de pruebas',
    tipo: '',
    municipio: '',
    logo: null,
  };

  function identidad(institucion: HospitalInstitution): string {
    return renderToStaticMarkup(
      <HospitalInstitutionIdentity
        institucion={institucion}
        etiquetaPlataforma={branding.platformDisplayName}
      />,
    );
  }

  it('el sidebar muestra el corazón canónico existente junto a Eloisa', () => {
    const envolvente = envolventeDe(shell());

    expect(envolvente).toContain('src="/brand/corazon-check.png"');
    expect(envolvente).toContain('_identityMarca_');
    expect(envolvente).toContain(branding.platformDisplayName);
  });

  it('el corazón es decorativo y no duplica el nombre anunciado', () => {
    const marca = /<img[^>]*_identityMarcaLogo_[^>]*>/u.exec(shell())?.[0] ?? '';

    expect(marca).toContain('alt=""');
    expect(marca).toContain('aria-hidden="true"');
  });

  it('la marca de plataforma y el logo institucional son ranuras separadas', () => {
    const html = identidad({
      ...INSTITUCION_MINIMA,
      logo: { src: '/brand/institucion-ficticia.png', alt: 'Logotipo institucional ficticio' },
    });

    expect(html).toContain('_identityMarcaLogo_');
    expect(html).toContain('src="/brand/corazon-check.png"');
    expect(html).toContain('_identityLogo_');
    expect(html).toContain('src="/brand/institucion-ficticia.png"');
    expect(html).toContain('alt="Logotipo institucional ficticio"');
  });

  it('sin fuente autorizada no se dibuja ningún logo institucional', () => {
    /*
     * Ni un logo genérico ni el corazón de Eloisa haciendo de sustituto: son
     * identidades distintas y una no puede ocupar la ranura de la otra (§3.5).
     */
    const html = identidad(INSTITUCION_MINIMA);

    expect(html).toContain('_identityMarcaLogo_');
    expect(html).not.toContain('_identityLogo_');
  });

  it('compone tipo y municipio en las cuatro combinaciones', () => {
    expect(metadatoInstitucional(INSTITUCION_MINIMA)).toBeNull();
    expect(metadatoInstitucional({ ...INSTITUCION_MINIMA, tipo: 'ESE' })).toBe('ESE');
    expect(metadatoInstitucional({ ...INSTITUCION_MINIMA, municipio: 'Soacha' })).toBe('Soacha');
    expect(
      metadatoInstitucional({ ...INSTITUCION_MINIMA, tipo: 'ESE', municipio: 'Soacha' }),
    ).toBe('ESE · Soacha');
    // Un valor en blanco no es un valor: tampoco produce metadato.
    expect(metadatoInstitucional({ ...INSTITUCION_MINIMA, tipo: '   ', municipio: ' ' })).toBeNull();
  });

  it('no deja separador, espacio ni nodo de metadato vacío en el marcado', () => {
    const textoMeta = (html: string): string | undefined =>
      /_identityMeta_[^"]*">(?<meta>[^<]*)</u.exec(html)?.groups?.meta;

    const vacio = identidad(INSTITUCION_MINIMA);
    const soloTipo = identidad({ ...INSTITUCION_MINIMA, tipo: 'ESE' });
    const soloMunicipio = identidad({ ...INSTITUCION_MINIMA, municipio: 'Soacha' });
    const ambos = identidad({ ...INSTITUCION_MINIMA, tipo: 'ESE', municipio: 'Soacha' });

    // Ambos vacíos: no hay nodo de metadato y no queda un «·» huérfano.
    expect(vacio).not.toContain('_identityMeta_');
    expect(vacio).not.toContain('·');

    expect(textoMeta(soloTipo)).toBe('ESE');
    expect(soloTipo).not.toContain('·');

    expect(textoMeta(soloMunicipio)).toBe('Soacha');
    expect(soloMunicipio).not.toContain('·');

    expect(textoMeta(ambos)).toBe('ESE · Soacha');
  });

  it('con sesión vigente el sidebar no inventa tipo ni municipio', () => {
    /*
     * El tenant real aporta nombre, no tipo ni municipio: el metadato
     * simplemente no se renderiza.
     */
    const envolvente = envolventeDe(shellConSesion());

    expect(envolvente).toContain('Institución ficticia de pruebas');
    expect(envolvente).not.toContain('_identityMeta_');
    expect(envolvente).not.toContain('ESE');
    expect(envolvente).not.toContain('Soacha');
  });
});

describe('H-FID-B — Topbar compacto y acción de sesión', () => {
  it('conserva buscador, perfil institucional y cerrar sesión', () => {
    const envolvente = envolventeDe(shellConSesion());

    expect(envolvente).toContain('Buscar paciente, documento, profesional, cita, atención o municipio');
    expect(envolvente).toContain('data-hospital-sesion="institucional"');
    expect(envolvente).toContain('Acceso institucional');
    expect(envolvente).toContain('Consulta de pacientes');
    expect(envolvente).toContain('Sesión vigente hasta 22/08/2026 20:00 UTC');
    expect(envolvente).toContain('Cerrar sesión');
    expect(envolvente).not.toContain('Cambiar sesión');
  });

  it('cerrar sesión es un botón y se deshabilita mientras opera', () => {
    const acciones = (ocupado: boolean): string =>
      renderToStaticMarkup(
        <HospitalSessionActions
          onCerrarSesion={() => undefined}
          ocupado={ocupado}
        />,
      );

    const libre = acciones(false);
    const operando = acciones(true);

    expect(libre.match(/<button[^>]*type="button"/gu) ?? []).toHaveLength(1);
    expect(libre).toContain('Cerrar sesión');
    expect(libre).not.toContain('Cambiar sesión');
    expect(libre).not.toContain('disabled');
    expect(operando.match(/disabled/gu) ?? []).toHaveLength(1);
  });

  it('el corazón de Eloisa acompaña a la marca también sin sesión', () => {
    /*
     * La marca de PLATAFORMA es la misma en los tres estados: comprobando, sin
     * sesión y autenticado. No afirma institución, persona ni sesión, de modo
     * que mostrarla antes de autenticar no concede ni promete nada.
     */
    const comprobando = shellComprobando();
    const sinSesion = shellConSesion('sin-sesion');

    for (const html of [comprobando, sinSesion]) {
      expect(html).toContain('src="/brand/corazon-check.png"');
      expect(html).toContain('_identityMarcaLogo_');
      expect(html).toContain(branding.platformDisplayName);
    }
  });

  it('la marca neutral no arrastra institución, logo institucional ni datos', () => {
    /*
     * Que el corazón se vea NO relaja el fail-closed de H-FID-A: junto a la
     * marca no puede aparecer nada que dependa de una sesión.
     */
    for (const html of [shellComprobando(), shellConSesion('sin-sesion')]) {
      // Ni institución, ni tipo, ni municipio, ni logo institucional.
      expect(html).not.toContain('_identityName_');
      expect(html).not.toContain('_identityMeta_');
      expect(html).not.toContain('_identityLogo_');
      // Ni badges, ni conteos, ni perfil, ni acciones de sesión.
      expect(html).not.toContain('_navBadge_');
      expect(html).not.toContain('_bellBadge_');
      expect(html).not.toContain('_profile_');
      expect(html).not.toContain('data-hospital-sesion');
      // Ni topbar funcional, ni módulo montado.
      expect(html).not.toContain('<header');
      expect(html).not.toContain('data-hospital-content');
      // Ni un solo dato demostrativo.
      for (const demo of DATOS_DEMOSTRATIVOS) {
        expect(html).not.toContain(demo);
      }
    }
  });

  it('no aparece Isa en ninguna superficie de Hospital', () => {
    for (const html of [shell(), shellConSesion('sin-sesion'), shellComprobando()]) {
      expect(html).not.toContain(branding.aiDisplayName);
      expect(html).not.toContain('/eli/');
    }
  });
});

/* ========================================================================== */
/* HOSPITAL-VISITS-01 packet B — Transporte efímero de la visita              */
/* ========================================================================== */

/**
 * Visita materializada FICTICIA.
 *
 * Es el DTO REAL de la materialización institucional, con valores inventados.
 * El shell no lo compone ni lo modifica: solo lo transporta.
 */
const VISITA_MATERIALIZADA: HospitalVisitaMaterializadaDto = {
  homeVisitId: '01930000-0000-7000-8000-0000000000a1',
  appointmentId: '01930000-0000-7000-8000-0000000000b2',
  status: 'SCHEDULED',
  version: 1,
  creationTransitionId: '01930000-0000-7000-8000-0000000000c3',
  createdAt: '2026-08-24T13:00:00.000Z',
};

/** Shell autenticado montado en una vista concreta, con o sin visita abierta. */
function shellEnVisitas(visitaInicial: HospitalVisitaMaterializadaDto | null): string {
  return renderToStaticMarkup(
    <HospitalShell
      sesionInicial={SESION_HOSPITAL}
      vistaInicial="visitas"
      visitaInicial={visitaInicial}
    />,
  );
}

describe('T-H16 — La visita viaja en estado efímero del shell, sin conceder permisos', () => {
  const CODIGO = readFileSync(`${DIRECTORIO_SHELL}HospitalShell.tsx`, 'utf8');

  it('sin visita abierta la vista declara el vacío y no publica la demostración', () => {
    const contenido = texto(mainDe(shellEnVisitas(null)));

    expect(contenido).toContain('No hay ninguna visita abierta en esta pantalla.');
    expect(contenido).not.toContain('Dra. Laura Gómez');
    expect(contenido).not.toContain('La Esperanza, Soacha');
  });

  it('con visita abierta muestra su estado REAL como «Programada»', () => {
    const contenido = texto(mainDe(shellEnVisitas(VISITA_MATERIALIZADA)));

    expect(contenido).toContain('Estado de la visita: Programada');
  });

  it('no publica ningún identificador de la visita transportada', () => {
    const html = shellEnVisitas(VISITA_MATERIALIZADA);

    for (const identificador of [
      VISITA_MATERIALIZADA.homeVisitId,
      VISITA_MATERIALIZADA.appointmentId,
      VISITA_MATERIALIZADA.creationTransitionId,
    ]) {
      expect(html).not.toContain(identificador);
    }
  });

  it('la sesión institucional NO habilita ninguna acción profesional', () => {
    /*
     * El shell está autenticado con la credencial INSTITUCIONAL y la visita ya
     * está abierta. Aun así no aparece «Iniciar» ni «Completar»: esas acciones
     * exigen que el servidor confirme una sesión personal profesional, y el
     * shell no puede sustituirla ni deducirla.
     */
    const principal = mainDe(shellEnVisitas(VISITA_MATERIALIZADA));

    // Ningún control operable en toda el área de contenido.
    expect(principal).not.toContain('<button');
    expect(texto(principal)).toContain('Comprobando el estado de la visita…');
  });

  it('la agenda entrega el DTO real y el shell navega a la vista de visitas', () => {
    expect(CODIGO).toContain('onVisitaMaterializada={(materializada)');
    expect(CODIGO).toContain('setVisita(materializada)');
    expect(CODIGO).toContain("navegar({ vista: 'visitas' })");
    expect(CODIGO).toContain('<HospitalHomeVisits visita={visita} />');
  });

  it('el transporte es estado local: ni ruta, ni URL, ni persistencia', () => {
    expect(CODIGO).toContain('useState<HospitalVisitaMaterializadaDto | null>(visitaInicial)');
    expect(/localStorage|sessionStorage|indexedDB|document\.cookie/u.test(CODIGO)).toBe(false);
    expect(CODIGO).not.toContain('useRouter');
    expect(CODIGO).not.toContain('window.location');
  });

  it('el shell no compone el DTO ni fabrica identidad profesional', () => {
    const efectivo = CODIGO.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/\/\/.*/gu, ' ');

    expect(efectivo).not.toContain('professionalId');
    expect(efectivo).not.toContain('homeVisitId');
    expect(efectivo).not.toContain('cambiarEstadoVisita');
    expect(efectivo).not.toContain('materializarVisita');
  });
});
