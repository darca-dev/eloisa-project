import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  HOSPITAL_VISITA_ETIQUETA,
  HOSPITAL_VISITA_TEXTO,
  HospitalHomeVisits,
  accionesDeVisita,
  avisoDeVisita,
  hayAccionesProfesionales,
  hayContextoProfesional,
  mensajeDeSesionHumana,
} from './HospitalHomeVisits';
import { HospitalRatings } from './HospitalRatings';
import { hospitalCalificacionesDemo } from './hospitalRatingsConfig';
import { apariciones, texto } from './hospitalTestUtils';
import { HospitalUpdates } from './HospitalUpdates';
import { hospitalNovedadesDemo } from './hospitalUpdatesConfig';
import { HospitalVirtualConsultations } from './HospitalVirtualConsultations';
import { hospitalVirtualesDemo } from './hospitalVirtualConfig';
import { urlDeLoginHumano, type EstadoSesionHumana } from './hospitalHumanSessionClient';
import { hospitalVisitasDemo } from './hospitalVisitsConfig';
import type {
  HospitalVisitaEstado,
  HospitalVisitaMaterializadaDto,
  HospitalVisitaProfesionalDto,
  ResultadoVisita,
} from './hospitalVisitsClient';

/**
 * Vistas «Visitas domiciliarias», «Consultas virtuales», «Calificaciones» y
 * «Novedades» (TASK-003H-04, T-10 a T-16; «Visitas» reconciliada por
 * HOSPITAL-VISITS-01 packet B).
 *
 * «Consultas virtuales», «Calificaciones» y «Novedades» siguen siendo
 * composiciones sin estado local, de modo que basta con comprobar el marcado
 * renderizado frente a los fixtures que reproducen la referencia.
 *
 * «Visitas domiciliarias» YA NO. Desde HOSPITAL-VISITS-01 packet B muestra el
 * estado REAL de una visita servida por MP04, y sus fixtures dejan de ser su
 * fuente: `hospitalVisitasDemo` solo se importa aquí para comprobar que NINGUNO
 * de sus datos llega a la pantalla conectada.
 *
 * ESTRATEGIA. Igual que en Agenda: el repositorio no incluye jsdom y esta Task
 * no autoriza dependencias nuevas, de modo que `renderToStaticMarkup` no
 * ejecuta efectos. La visita y el desenlace profesional se INYECTAN por
 * propiedad —son los DTO reales del cliente, no fixtures— y las decisiones
 * puras se comprueban sobre los helpers exportados. Lo que NO queda cubierto
 * por falta de DOM real —clic efectivo, foco, teclado y verificación automática
 * de accesibilidad— se reporta como no ejecutado en el handoff.
 *
 * Todos los datos de estas pruebas son FICTICIOS.
 */

const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));

const VISITAS = renderToStaticMarkup(<HospitalHomeVisits />);
const VIRTUALES = renderToStaticMarkup(<HospitalVirtualConsultations />);
const CALIFICACIONES = renderToStaticMarkup(<HospitalRatings />);
const NOVEDADES = renderToStaticMarkup(<HospitalUpdates />);

/*
 * Nombre del asistente, compuesto en tiempo de ejecución. El literal de marca
 * solo puede declararse en `src/config/branding.ts` (TASK-002, T-17), y esta
 * prueba necesita comprobar precisamente que no aparece en la vista.
 */
const ASISTENTE = `El${String.fromCharCode(237)}`;

/* ========================================================================== */
/* «Visitas domiciliarias» conectada a MP04 (HOSPITAL-VISITS-01, packet B)     */
/* ========================================================================== */

/**
 * Visita materializada FICTICIA.
 *
 * Es el DTO REAL que devuelve la materialización institucional, con valores
 * inventados. Sus identificadores son deliberadamente reconocibles para poder
 * comprobar que NINGUNO llega al marcado.
 */
const VISITA: HospitalVisitaMaterializadaDto = {
  homeVisitId: '01930000-0000-7000-8000-0000000000a1',
  appointmentId: '01930000-0000-7000-8000-0000000000b2',
  status: 'SCHEDULED',
  version: 1,
  creationTransitionId: '01930000-0000-7000-8000-0000000000c3',
  createdAt: '2026-08-24T13:00:00.000Z',
};

/** Visita autorizada de la persona profesional, en el estado que se pida. */
function visitaProfesional(
  status: HospitalVisitaEstado,
  version = 4,
): HospitalVisitaProfesionalDto {
  return {
    homeVisitId: VISITA.homeVisitId,
    appointmentId: VISITA.appointmentId,
    status,
    version,
    startedAt: status === 'SCHEDULED' ? null : '2026-08-24T13:20:00.000Z',
    endedAt:
      status === 'COMPLETED' || status === 'NOT_COMPLETED'
        ? '2026-08-24T14:05:00.000Z'
        : null,
    createdAt: '2026-08-24T13:00:00.000Z',
    updatedAt: '2026-08-24T13:20:00.000Z',
  };
}

/**
 * Código de la vista SIN comentarios.
 *
 * Las prohibiciones de esta suite son sobre lo que el código HACE, no sobre lo
 * que su documentación NOMBRA: el propio comentario que explica por qué no se
 * fabrica un `professionalId` contiene esa palabra.
 */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/\/\/.*/gu, ' ');
}

/** Marcado de la vista con la visita, el desenlace y la sesión humana inyectados. */
function vistaVisitas(
  visita: HospitalVisitaMaterializadaDto | null,
  consultaInicial: ResultadoVisita<HospitalVisitaProfesionalDto> | null = null,
  sesionHumanaInicial: EstadoSesionHumana | null = null,
): string {
  return renderToStaticMarkup(
    <HospitalHomeVisits
      visita={visita}
      consultaInicial={consultaInicial}
      sesionHumanaInicial={sesionHumanaInicial}
    />,
  );
}

/** Botones de TRANSICIÓN de la visita, que son los únicos que autoriza Visits. */
function botonesDeAccion(html: string): number {
  return apariciones(html, /aria-describedby="hospital-visitas-accion-/gu);
}

/** Desenlace `ok` de la consulta profesional para un estado concreto. */
function autorizada(
  status: HospitalVisitaEstado,
  version = 4,
): ResultadoVisita<HospitalVisitaProfesionalDto> {
  return { kind: 'ok', datos: visitaProfesional(status, version) };
}

describe('T-10A — Sin fixture, sin repliegue demostrativo y sin dato inventado', () => {
  const CODIGO = readFileSync(`${DIRECTORIO}HospitalHomeVisits.tsx`, 'utf8');
  const EFECTIVO = sinComentarios(CODIGO);

  it('la vista NO importa `hospitalVisitsConfig` ni ningún otro fixture', () => {
    expect(EFECTIVO).not.toContain('hospitalVisitsConfig');
    expect(EFECTIVO).not.toContain('hospitalVisitasDemo');
    expect(EFECTIVO).not.toContain('HospitalVisitsConfig');
  });

  it('sin visita abierta declara el vacío en lugar de publicar la demostración', () => {
    const TEXTO_VACIO = texto(VISITAS);

    expect(TEXTO_VACIO).toContain('No hay ninguna visita abierta en esta pantalla.');

    for (const visita of hospitalVisitasDemo.visitas) {
      expect(TEXTO_VACIO).not.toContain(visita.paciente);
      expect(TEXTO_VACIO).not.toContain(visita.zona);
      expect(TEXTO_VACIO).not.toContain(visita.profesional);
      expect(TEXTO_VACIO).not.toContain(visita.fecha);
    }

    for (const estado of hospitalVisitasDemo.estados) {
      expect(TEXTO_VACIO).not.toContain(`${estado.valor} ${estado.etiqueta}`);
    }

    for (const filtro of hospitalVisitasDemo.filtros) {
      expect(TEXTO_VACIO).not.toContain(filtro);
    }
  });

  it('con visita abierta tampoco aparece ningún dato demostrativo', () => {
    const TEXTO_REAL = texto(vistaVisitas(VISITA, autorizada('SCHEDULED')));

    for (const visita of hospitalVisitasDemo.visitas) {
      expect(TEXTO_REAL).not.toContain(visita.paciente);
      expect(TEXTO_REAL).not.toContain(visita.profesional);
    }
  });

  it('consulta y transiciona a través del cliente, sin llamar a la red por su cuenta', () => {
    expect(CODIGO).toContain('consultarVisitaProfesional(');
    expect(CODIGO).toContain('cambiarEstadoVisita(');
    expect(/\bfetch\s*\(|\bfetchImpl\s*\(/u.test(CODIGO)).toBe(false);
  });

  it('no persiste nada, no lee el reloj y no inventa geolocalización', () => {
    expect(/localStorage|sessionStorage|indexedDB|document\.cookie/u.test(CODIGO)).toBe(false);
    expect(CODIGO).not.toContain('Date.now');
    expect(/new\s+Date\s*\(/u.test(CODIGO)).toBe(false);
    expect(EFECTIVO).not.toMatch(/mapa|geoloc|latitud|longitud|tracking/iu);
  });
});

describe('T-10B — Estado REAL con las cuatro etiquetas del contrato', () => {
  const ESPERADO: readonly (readonly [HospitalVisitaEstado, string])[] = [
    ['SCHEDULED', 'Programada'],
    ['IN_PROGRESS', 'En curso'],
    ['COMPLETED', 'Completada'],
    ['NOT_COMPLETED', 'No completada'],
  ];

  it.each(ESPERADO)('%s se lee como «%s»', (status, etiqueta) => {
    expect(HOSPITAL_VISITA_ETIQUETA[status]).toBe(etiqueta);
    expect(texto(vistaVisitas(VISITA, autorizada(status)))).toContain(
      `Estado de la visita: ${etiqueta}`,
    );
  });

  it('el estado recién materializado se muestra como «Programada»', () => {
    // Consulta profesional aún sin responder: se conserva el hecho real de la
    // materialización institucional, que es `SCHEDULED`.
    expect(texto(vistaVisitas(VISITA))).toContain('Estado de la visita: Programada');
  });

  it('no publica ninguna etiqueta que el servidor no modele', () => {
    const TEXTO_REAL = texto(vistaVisitas(VISITA, autorizada('IN_PROGRESS')));

    for (const inventada of [
      'En camino',
      'Pendiente de asignación',
      'Cancelada',
      'Finalizada',
      'Iniciada',
    ]) {
      expect(TEXTO_REAL).not.toContain(inventada);
    }
  });

  it('el estado se lee como texto y el color solo lo acompaña', () => {
    const HTML = vistaVisitas(VISITA, autorizada('NOT_COMPLETED'));

    expect(texto(HTML)).toContain('Estado de la visita: No completada');
    expect(HTML).toContain('--h-tono-texto');
  });
});

describe('T-10C — Acciones profesionales por estado', () => {
  it('`SCHEDULED` ofrece iniciar y no completada', () => {
    expect(accionesDeVisita('SCHEDULED').map((accion) => accion.destino)).toEqual([
      'IN_PROGRESS',
      'NOT_COMPLETED',
    ]);
  });

  it('`IN_PROGRESS` ofrece completar y no completada', () => {
    expect(accionesDeVisita('IN_PROGRESS').map((accion) => accion.destino)).toEqual([
      'COMPLETED',
      'NOT_COMPLETED',
    ]);
  });

  it('los dos estados terminales no ofrecen ninguna acción', () => {
    expect(accionesDeVisita('COMPLETED')).toEqual([]);
    expect(accionesDeVisita('NOT_COMPLETED')).toEqual([]);

    for (const terminal of ['COMPLETED', 'NOT_COMPLETED'] as const) {
      const HTML = vistaVisitas(VISITA, autorizada(terminal));

      expect(HTML).not.toContain('<button');
      expect(texto(HTML)).toContain('Esta visita ya está cerrada');
    }
  });

  it('ninguna acción puede pedir `SCHEDULED`: crear la visita es institucional', () => {
    const destinos = (
      ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NOT_COMPLETED'] as const
    ).flatMap((estado) => accionesDeVisita(estado).map((accion) => accion.destino));

    expect(destinos).not.toContain('SCHEDULED');
  });

  it('cada acción se dibuja con texto visible y ayuda accesible asociada', () => {
    const HTML = vistaVisitas(VISITA, autorizada('SCHEDULED'));

    expect(texto(HTML)).toContain('Iniciar');
    expect(texto(HTML)).toContain('No completada');
    expect(HTML).toContain('aria-describedby="hospital-visitas-accion-IN_PROGRESS"');
    expect(HTML).toContain('id="hospital-visitas-accion-IN_PROGRESS"');
    expect(HTML).toContain('Registra que la visita domiciliaria comenzó.');
    expect(apariciones(HTML, /<button\b/gu)).toBe(apariciones(HTML, /<button type="button"/gu));
  });
});

describe('T-10D — Separación de sesiones: institucional NO es profesional', () => {
  const CODIGO = readFileSync(`${DIRECTORIO}HospitalHomeVisits.tsx`, 'utf8');
  const EFECTIVO = sinComentarios(CODIGO);

  it('sin sesión profesional NO hay acciones y se explica exactamente qué falta', () => {
    const HTML = vistaVisitas(VISITA, { kind: 'sin-sesion' });

    /*
     * Desde HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI este desenlace SÍ monta los
     * controles de la sesión humana. Lo que sigue sin existir —y es lo que esta
     * prueba protege— son los botones de TRANSICIÓN de la visita.
     */
    expect(botonesDeAccion(HTML)).toBe(0);
    expect(HTML).not.toContain('>Iniciar</button>');
    expect(texto(HTML)).toContain(
      'Para iniciar o cerrar esta visita hace falta una sesión personal profesional vigente.',
    );
    // El estado recibido al materializar SÍ se conserva.
    expect(texto(HTML)).toContain('Estado de la visita: Programada');
  });

  it('`sin-permiso` y `no-encontrado` tampoco muestran acciones', () => {
    for (const fallo of ['sin-permiso', 'no-encontrado'] as const) {
      const HTML = vistaVisitas(VISITA, { kind: fallo });

      expect(HTML).not.toContain('<button');
      expect(texto(HTML)).toContain('Estado de la visita: Programada');
    }
  });

  it('mientras la consulta profesional no responde no hay ninguna acción', () => {
    const HTML = vistaVisitas(VISITA);

    expect(HTML).not.toContain('<button');
    expect(texto(HTML)).toContain('Comprobando el estado de la visita…');
  });

  it('solo un `ok` confirmado por el servidor habilita acciones', () => {
    expect(hayAccionesProfesionales(null)).toBe(false);
    expect(hayAccionesProfesionales(autorizada('SCHEDULED'))).toBe(true);

    for (const fallo of [
      'solicitud-invalida',
      'sin-sesion',
      'sin-permiso',
      'no-encontrado',
      'conflicto',
      'no-disponible',
      'cancelado',
    ] as const) {
      expect(hayAccionesProfesionales({ kind: fallo })).toBe(false);
    }
  });

  it('la vista no fabrica identidad profesional ni abre sesión alguna', () => {
    expect(EFECTIVO).not.toContain('professionalId');
    expect(EFECTIVO).not.toContain('identityId');
    expect(EFECTIVO).not.toContain('tenantId');
    expect(EFECTIVO).not.toContain('abrirSesion');
    expect(EFECTIVO).not.toContain('hospitalInstitutionClient');
    // La guarda de fail-closed es explícita antes de tocar la red.
    expect(EFECTIVO).toContain("consulta.kind !== 'ok'");
  });
});

describe('T-10G — Sesión personal profesional sobre el flujo humano existente', () => {
  const CODIGO = readFileSync(`${DIRECTORIO}HospitalHomeVisits.tsx`, 'utf8');
  const EFECTIVO = sinComentarios(CODIGO);

  /** Marcado con la visita pidiendo sesión humana y el estado humano dado. */
  function panel(estado: EstadoSesionHumana | null): string {
    return vistaVisitas(VISITA, { kind: 'sin-sesion' }, estado);
  }

  it('ofrece el inicio OIDC EXISTENTE como enlace en pestaña nueva', () => {
    const HTML = panel(null);

    expect(HTML).toContain(`href="${urlDeLoginHumano()}"`);
    expect(HTML).toContain('target="_blank"');
    expect(HTML).toContain('rel="noopener noreferrer"');
    expect(texto(HTML)).toContain('Abrir sesión profesional');
    // Es una NAVEGACIÓN: ni formulario, ni envío, ni petición en segundo plano.
    expect(HTML).not.toContain('<form');
    expect(HTML).not.toContain('type="submit"');
  });

  it('la URL del enlace es la del contrato humano y ningún otro destino', () => {
    const url = new URL(urlDeLoginHumano());

    expect(url.pathname).toBe('/api/v1/human-auth/login');
    expect(url.searchParams.get('returnTo')).toBe('/');
    expect(panel(null)).toContain('/api/v1/human-auth/login?returnTo=/');
  });

  it('ofrece comprobar la sesión y explica que hay que volver a esta pantalla', () => {
    const HTML = panel(null);

    expect(texto(HTML)).toContain('Comprobar sesión profesional');
    expect(texto(HTML)).toContain(HOSPITAL_VISITA_TEXTO.entrarAyuda);
    expect(HTML).toContain('aria-describedby="hospital-visitas-sesion-entrar"');
    expect(HTML).toContain('id="hospital-visitas-sesion-entrar"');
  });

  it('el panel NO se monta cuando la visita ya está autorizada', () => {
    const HTML = vistaVisitas(VISITA, autorizada('IN_PROGRESS'));

    expect(texto(HTML)).not.toContain('Abrir sesión profesional');
    expect(texto(HTML)).not.toContain('Comprobar sesión profesional');
    expect(texto(HTML)).not.toContain('Cerrar sesión profesional');
    expect(HTML).not.toContain('href');
  });

  it('un contexto humano SIN `PROFESSIONAL` no habilita ninguna acción', () => {
    const HTML = panel('activa-sin-contexto');

    expect(hayContextoProfesional('activa-sin-contexto')).toBe(false);
    expect(botonesDeAccion(HTML)).toBe(0);
    expect(texto(HTML)).toContain(HOSPITAL_VISITA_TEXTO.humanaSinContexto);
    // Sigue ofreciendo abrir la sesión correcta, no cerrarla.
    expect(texto(HTML)).toContain('Abrir sesión profesional');
    expect(texto(HTML)).not.toContain('Cerrar sesión profesional');
  });

  it('detectar la sesión profesional TAMPOCO habilita acciones por sí solo', () => {
    /*
     * FAIL-CLOSED: aunque el contrato humano confirme el contexto, mientras la
     * consulta de la visita siga negando, no hay ni una sola acción. El único
     * habilitador es el `ok` del endpoint de Visitas.
     */
    const HTML = panel('activa-profesional');

    expect(hayContextoProfesional('activa-profesional')).toBe(true);
    expect(botonesDeAccion(HTML)).toBe(0);
    expect(texto(HTML)).toContain(HOSPITAL_VISITA_TEXTO.humanaActiva);
    // Con sesión detectada se ofrece cerrarla, y ya no abrirla.
    expect(texto(HTML)).toContain('Cerrar sesión profesional');
    expect(texto(HTML)).not.toContain('Abrir sesión profesional');
  });

  it('con sesión detectada Y autorización de Visitas sí hay acciones', () => {
    const HTML = vistaVisitas(VISITA, autorizada('SCHEDULED'), 'activa-profesional');

    expect(botonesDeAccion(HTML)).toBe(2);
    expect(texto(HTML)).toContain('Iniciar');
    expect(texto(HTML)).toContain('Cerrar sesión profesional');
  });

  it('solo un contexto `PROFESSIONAL` del servidor vuelve a consultar la visita', () => {
    expect(EFECTIVO).toContain("if (estado === 'activa-profesional')");
    expect(EFECTIVO).toContain('consultarSesionHumana(fetchImpl ?? fetch)');
    // La reconsulta es un refresco de la VISITA, no una concesión de permiso.
    expect(EFECTIVO).toContain('setRefresco((actual) => actual + 1)');
  });

  it('solo un cierre CONFIRMADO retira la sesión y vuelve al estado fail-closed', () => {
    expect(EFECTIVO).toContain('cierreHumanoConfirmado(cierre)');
    expect(EFECTIVO).toContain("setSesionHumana('sin-sesion')");
    expect(EFECTIVO).toContain('HOSPITAL_VISITA_TEXTO.humanaCierreNoConfirmado');
    expect(texto(panel('sin-sesion'))).toContain(HOSPITAL_VISITA_TEXTO.humanaSinSesion);
  });

  it('cada estado humano tiene su mensaje y ninguno nombra un código técnico', () => {
    const estados: readonly (EstadoSesionHumana | null)[] = [
      null,
      'activa-profesional',
      'activa-sin-contexto',
      'sin-sesion',
      'no-disponible',
    ];
    const mensajes = estados.map((estado) => mensajeDeSesionHumana(estado));

    expect(new Set(mensajes).size).toBe(mensajes.length);

    for (const mensaje of mensajes) {
      expect(mensaje.length).toBeGreaterThan(0);
      expect(mensaje).not.toMatch(/40[0-9]|503|HTTP|api\/v1|PROFESSIONAL|cookie|OIDC/iu);
    }

    // Cambiar de pantalla no es un error: no se anuncia nada.
    expect(mensajeDeSesionHumana('cancelado')).toBe('');
  });

  it('el panel no publica identificadores, caducidades ni datos de persona', () => {
    for (const estado of [null, 'activa-profesional', 'sin-sesion'] as const) {
      const HTML = panel(estado);
      const TEXTO_PANEL = texto(HTML);

      for (const identificador of [VISITA.homeVisitId, VISITA.appointmentId]) {
        expect(HTML).not.toContain(identificador);
      }

      expect(TEXTO_PANEL).not.toContain('2026-08-24');
      expect(TEXTO_PANEL).not.toMatch(/expiresAt|idleExpires|1800|\bUTC\b/u);
      expect(TEXTO_PANEL).not.toMatch(/PROFESSIONAL|PATIENT|CAREGIVER/u);
    }
  });

  it('la vista no crea otro login ni toca la credencial de sesión', () => {
    expect(EFECTIVO).not.toContain('professionalId');
    expect(EFECTIVO).not.toContain('tenantId');
    expect(EFECTIVO).not.toContain('patientId');
    expect(/document\s*\.\s*cookie/u.test(CODIGO)).toBe(false);
    expect(/localStorage|sessionStorage|indexedDB/u.test(CODIGO)).toBe(false);
    expect(/dev-login|devLogin|<input/u.test(EFECTIVO)).toBe(false);
    expect(EFECTIVO).not.toContain('merdn_human_session');
  });

  it('NUNCA toca la sesión institucional', () => {
    expect(EFECTIVO).not.toContain('hospitalInstitutionClient');
    expect(EFECTIVO).not.toContain('cerrarSesionInstitucional');
    expect(EFECTIVO).not.toContain('institutional');
    expect(texto(panel('activa-profesional'))).toContain(
      'Es independiente de la sesión institucional de esta pantalla, que no cambia.',
    );
  });

  it('bloquea el doble envío de las operaciones humanas', () => {
    expect(EFECTIVO).toContain('if (operandoHumana)');
    expect(EFECTIVO).toContain('ocupado={operandoHumana}');
  });
});

describe('T-10E — Mensajes de producto, refresco y doble envío', () => {
  const CODIGO = sinComentarios(readFileSync(`${DIRECTORIO}HospitalHomeVisits.tsx`, 'utf8'));

  it('cada desenlace tiene un mensaje propio y ninguno nombra un código técnico', () => {
    const mensajes = (
      [
        'solicitud-invalida',
        'sin-sesion',
        'sin-permiso',
        'no-encontrado',
        'conflicto',
        'no-disponible',
      ] as const
    ).map((fallo) => avisoDeVisita({ kind: fallo }) ?? '');

    expect(new Set(mensajes).size).toBe(mensajes.length);
    expect(mensajes.every((mensaje) => mensaje.length > 0)).toBe(true);

    for (const mensaje of mensajes) {
      expect(mensaje).not.toMatch(/40[0-9]|409|503|HTTP|fetch|api\/v1|token|cookie/iu);
    }
  });

  it('el éxito y la cancelación no anuncian ningún error', () => {
    expect(avisoDeVisita({ kind: 'ok', datos: visitaProfesional('IN_PROGRESS') })).toBeNull();
    expect(avisoDeVisita({ kind: 'cancelado' })).toBeNull();
  });

  it('el conflicto pide actualizar antes de reintentar, sin describir la visita', () => {
    const mensaje = avisoDeVisita({ kind: 'conflicto' }) ?? '';

    expect(mensaje).toContain('Actualice la información antes de volver a intentarlo.');
    expect(mensaje).not.toContain('paciente');
  });

  it('tras una transición vuelve a leer la visita del servidor, también en conflicto', () => {
    expect(CODIGO).toContain('setRefresco((actual) => actual + 1)');
    expect(CODIGO).toContain('requiereRefrescoDeVisita(resultado)');
    // El estado visible procede de la relectura, no de la respuesta del PATCH.
    expect(CODIGO).not.toContain('resultado.datos.toStatus');
  });

  it('bloquea el doble envío y cancela la consulta al desmontar o cambiar de visita', () => {
    expect(CODIGO).toContain('if (enviando !== null');
    expect(CODIGO).toContain('bloqueado={enviando !== null}');
    expect(CODIGO).toContain('new AbortController()');
    expect(CODIGO).toContain('controller.abort()');
    expect(CODIGO).toContain("if (!vigente || resultado.kind === 'cancelado')");
    expect(CODIGO).toContain('montadoRef.current');
  });

  it('la versión enviada es la de la última lectura autorizada', () => {
    expect(CODIGO).toContain('consulta.datos.version');
  });
});

describe('T-10F — Nada técnico ni ajeno llega al marcado', () => {
  const HTML = vistaVisitas(VISITA, autorizada('IN_PROGRESS', 7));
  const TEXTO_REAL = texto(HTML);

  it('no publica identificadores internos', () => {
    for (const identificador of [
      VISITA.homeVisitId,
      VISITA.appointmentId,
      VISITA.creationTransitionId,
    ]) {
      expect(HTML).not.toContain(identificador);
    }
  });

  it('no publica versión, marcas de tiempo ni códigos de estado', () => {
    expect(TEXTO_REAL).not.toContain('2026-08-24');
    expect(TEXTO_REAL).not.toContain('13:20');
    expect(TEXTO_REAL).not.toMatch(/\bversión\b/iu);
    expect(TEXTO_REAL).not.toMatch(/\bIN_PROGRESS\b|\bSCHEDULED\b/u);
    expect(TEXTO_REAL).not.toMatch(/\b(?:401|403|404|409|503)\b/u);
  });

  it('no publica NINGÚN dato de persona, dirección, zona ni horario', () => {
    /*
     * MP04 no devuelve ninguno de esos datos, de modo que la comprobación se
     * hace sobre lo único capaz de filtrarlos: los valores de los DTO servidos
     * y los del antiguo fixture demostrativo. La copia de la vista sí puede
     * NOMBRAR a la persona profesional para explicar a quién corresponde
     * actuar; lo prohibido es publicar QUIÉN es.
     */
    const profesional = visitaProfesional('IN_PROGRESS', 7);

    for (const valor of [
      profesional.startedAt ?? '',
      profesional.createdAt,
      profesional.updatedAt,
    ]) {
      expect(HTML).not.toContain(valor);
    }

    for (const demo of hospitalVisitasDemo.visitas) {
      expect(TEXTO_REAL).not.toContain(demo.paciente);
      expect(TEXTO_REAL).not.toContain(demo.zona);
      expect(TEXTO_REAL).not.toContain(demo.profesional);
    }

    expect(TEXTO_REAL).not.toMatch(/Soacha|dirección|barrio|vereda|\d{1,2}:\d{2}/iu);
  });

  it('declara UNA región viva y un único encabezado principal', () => {
    expect(apariciones(HTML, /aria-live="polite"/gu)).toBe(1);
    expect(apariciones(HTML, /<h1\b/gu)).toBe(1);
  });

  it('no monta formularios, enlaces ni envíos', () => {
    expect(HTML).not.toContain('<form');
    expect(HTML).not.toContain('<a ');
    expect(HTML).not.toContain('href');
    expect(HTML).not.toContain('type="submit"');
  });

  it('conserva la nota que separa avance operativo de dato clínico', () => {
    expect(TEXTO_REAL).toContain('No es un dato clínico');
    expect(texto(VISITAS)).toContain('No es un dato clínico');
  });
});

describe('T-11 — Fidelidad de «Consultas virtuales»', () => {
  const contenido = texto(VIRTUALES);

  it('reproduce el encabezado', () => {
    expect(contenido).toContain('Consultas virtuales');
    expect(contenido).toContain(
      'Integradas a la agenda maestra. La estructura queda lista para conectar el proveedor de videollamada cuando se defina.',
    );
  });

  it('muestra los seis conteos de estado', () => {
    expect(hospitalVirtualesDemo.estados).toHaveLength(6);

    for (const estado of hospitalVirtualesDemo.estados) {
      expect(contenido).toContain(`${estado.valor} ${estado.etiqueta}`);
    }

    expect(contenido).toContain('Paciente esperando');
    expect(contenido).toContain('Profesional conectado');
    expect(contenido).toContain('En curso');
    expect(contenido).toContain('Finalizadas');
  });

  it('muestra el bloque «En curso y en espera» con sus cuatro consultas', () => {
    expect(contenido).toContain('En curso y en espera');
    expect(hospitalVirtualesDemo.consultas).toHaveLength(4);

    for (const consulta of hospitalVirtualesDemo.consultas) {
      expect(contenido).toContain(consulta.hora);
      expect(contenido).toContain(consulta.paciente);
      expect(contenido).toContain(consulta.profesional);
      expect(contenido).toContain(consulta.estado);
    }
  });

  it('conserva la nota de integración futura sin habilitar ningún envío', () => {
    expect(contenido).toContain(hospitalVirtualesDemo.notaIntegracion);
    expect(VIRTUALES).not.toContain('<video');
    expect(VIRTUALES).not.toContain('<iframe');
    expect(VIRTUALES).not.toContain('href');
    expect(VIRTUALES).not.toMatch(/wa\.me|whatsapp\.com|api\.whatsapp/iu);
  });
});

describe('T-12 y T-13 — Fidelidad y semántica de «Calificaciones»', () => {
  const contenido = texto(CALIFICACIONES);

  it('reproduce el encabezado que separa experiencia de calidad clínica', () => {
    expect(contenido).toContain('Calidad y experiencia');
    expect(contenido).toContain(
      'Una calificación de estrellas nunca determina si un diagnóstico o un medicamento fue correcto.',
    );
  });

  it('muestra la experiencia de los cuatro profesionales con su tendencia', () => {
    expect(hospitalCalificacionesDemo.experiencia.items).toHaveLength(4);

    for (const profesional of hospitalCalificacionesDemo.experiencia.items) {
      expect(contenido).toContain(profesional.nombre);
      expect(contenido).toContain(
        `${profesional.profesion} · ${profesional.evaluaciones} evaluaciones`,
      );
      expect(contenido).toContain(profesional.calificacion);
      expect(contenido).toContain(profesional.tendencia);
      expect(CALIFICACIONES).toContain(
        `Experiencia de ${profesional.nombre}: ${profesional.calificacion} de 5`,
      );
    }
  });

  it('muestra los nueve factores y la advertencia del prototipo', () => {
    expect(hospitalCalificacionesDemo.factores.items).toHaveLength(9);

    for (const factor of hospitalCalificacionesDemo.factores.items) {
      expect(contenido).toContain(factor.etiqueta);
      expect(CALIFICACIONES).toContain(`${factor.etiqueta}: ${factor.valor} de 5`);
    }

    expect(contenido).toContain('Estas métricas miden experiencia, no calidad clínica.');
  });

  it('muestra el bloque demostrativo de indicadores clínicos separado', () => {
    expect(hospitalCalificacionesDemo.indicadores.items).toHaveLength(6);
    expect(contenido).toContain('Indicadores clínicos');
    expect(contenido).toContain(hospitalCalificacionesDemo.indicadores.descripcion);

    for (const indicador of hospitalCalificacionesDemo.indicadores.items) {
      expect(contenido).toContain(indicador.valor);
      expect(contenido).toContain(indicador.etiqueta);
    }
  });

  it('muestra los filtros visuales y los cuatro comentarios completos', () => {
    expect(hospitalCalificacionesDemo.comentarios.filtros).toHaveLength(5);
    expect(hospitalCalificacionesDemo.comentarios.items).toHaveLength(4);

    for (const filtro of hospitalCalificacionesDemo.comentarios.filtros) {
      expect(contenido).toContain(filtro);
    }

    for (const comentario of hospitalCalificacionesDemo.comentarios.items) {
      expect(contenido).toContain(`${comentario.autor} · ${comentario.profesional}`);
      expect(contenido).toContain(comentario.calificacion);
      expect(contenido).toContain(comentario.texto);
      expect(contenido).toContain(comentario.meta);
    }
  });

  it('no presenta la calificación como indicador oficial ni menciona al asistente', () => {
    expect(contenido).not.toContain(ASISTENTE);
    expect(contenido).not.toMatch(/oficial|certificad|acredita/iu);
    expect(CALIFICACIONES).not.toContain('<form');
    expect(CALIFICACIONES).not.toContain('<input');
  });
});

describe('T-14 — Fidelidad de «Novedades»', () => {
  const contenido = texto(NOVEDADES);

  it('reproduce el encabezado y la explicación del indicador fucsia', () => {
    expect(contenido).toContain('Novedades');
    expect(contenido).toContain('El fucsia solo significa «hay algo nuevo».');
  });

  it('muestra las siete novedades con título, metadatos, tipo y antigüedad', () => {
    expect(hospitalNovedadesDemo.novedades).toHaveLength(7);

    for (const novedad of hospitalNovedadesDemo.novedades) {
      expect(contenido).toContain(novedad.titulo);
      expect(contenido).toContain(novedad.meta);
      expect(contenido).toContain(novedad.tipo);
      expect(contenido).toContain(novedad.cuando);
    }
  });

  it('el indicador de novedad se anuncia como texto, no solo por color', () => {
    const sinLeer = hospitalNovedadesDemo.novedades.filter((novedad) => novedad.sinLeer);

    expect(sinLeer).toHaveLength(4);
    expect(apariciones(NOVEDADES, /Sin leer/gu)).toBe(sinLeer.length);
  });

  it('cada novedad dibuja su icono y ninguna es interactiva', () => {
    expect(apariciones(NOVEDADES, /<svg/gu)).toBe(hospitalNovedadesDemo.novedades.length);
    expect(NOVEDADES).not.toContain('<button');
    expect(NOVEDADES).not.toContain('<a ');
    expect(NOVEDADES).not.toContain('href');
  });
});

describe('T-15 y T-16 — Alcance negativo y accesibilidad de las cuatro vistas', () => {
  const vistas = [
    ['visitas', VISITAS],
    ['virtuales', VIRTUALES],
    ['calificaciones', CALIFICACIONES],
    ['novedades', NOVEDADES],
  ] as const;

  it.each(vistas)('%s monta un único encabezado principal', (_nombre, html) => {
    expect(apariciones(html, /<h1\b/gu)).toBe(1);
  });

  it.each(vistas)('%s oculta sus iconos decorativos', (_nombre, html) => {
    expect(apariciones(html, /<svg/gu)).toBe(apariciones(html, /aria-hidden="true" focusable/gu));
  });
});
