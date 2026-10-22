import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { type AlarmaDto, careClient, type DatoDto, describirCriterio, type RegistroDto, valorLegible } from './careClient';
import { BannerSemaforo, comparadoresPara, DetalleAlarma, GestorCriterios } from './careCriteriaViews';
import {
  accionesPara,
  BandejaAlarmas,
  codigoDesde,
  FormularioRegistro,
  instanteDesdeLocal,
  ListaRegistros,
  opcionesDesdeTexto,
  SolicitudRevision,
  TEXTO_ESTADO_GENERAL,
} from './careViews';
import { CareWorkspace } from './CareWorkspace';

const CONTEXTO = '00000000-0000-4000-8000-0000000000c1';

function fetchEspia(status: number, body: unknown) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { impl, llamadas };
}

const ALARMA: AlarmaDto = {
  id: '00000000-0000-4000-8000-0000000000a1',
  origin: 'MANUAL',
  note: null,
  severity: null,
  state: 'NUEVA',
  assigned: false,
  assignedToMe: false,
  initiatedByMe: true,
  version: 1,
  createdAt: '2026-10-21T12:00:00.000Z',
  resolvedAt: null,
  closedAt: null,
};

describe('careClient', () => {
  it('envía la sesión por cookie, sin caché, y NUNCA actor, tenant, paciente ni severidad', async () => {
    const espia = fetchEspia(201, { alarm: ALARMA, receiptMessage: 'ok' });
    await careClient.pedirRevision(CONTEXTO, { idempotencyKey: 'k', note: 'n' }, espia.impl);

    const [llamada] = espia.llamadas;
    expect(llamada?.url).toContain(`/api/v1/care/contexts/${CONTEXTO}/alarms`);
    expect(llamada?.init.credentials).toBe('include');
    expect(llamada?.init.cache).toBe('no-store');
    expect(JSON.parse(String(llamada?.init.body))).toEqual({ idempotencyKey: 'k', note: 'n', reasonCode: 'REQUEST_REVIEW' });
    for (const prohibido of ['tenantId', 'organizationId', 'patientId', 'severity', 'state', 'humanAccountId']) {
      expect(String(llamada?.init.body)).not.toContain(prohibido);
    }
  });

  it('reduce los desenlaces a un conjunto cerrado', async () => {
    const casos: readonly [number, string][] = [
      [401, 'sin-sesion'],
      [403, 'denegado'],
      [404, 'no-encontrado'],
      [409, 'conflicto'],
      [500, 'indisponible'],
      [503, 'indisponible'],
    ];
    for (const [status, kind] of casos) {
      const espia = fetchEspia(status, { message: 'detalle interno' });
      expect((await careClient.alarmas(CONTEXTO, espia.impl)).kind).toBe(kind);
    }
    const invalido = await careClient.registros(CONTEXTO, fetchEspia(400, { message: 'Indique una fecha.' }).impl);
    expect(invalido).toEqual({ kind: 'invalido', mensaje: 'Indique una fecha.' });
  });

  it('un fallo de red es indisponibilidad, nunca datos vacíos', async () => {
    const roto = (async () => {
      throw new TypeError('red');
    }) as unknown as typeof fetch;
    expect(await careClient.contextos(roto)).toEqual({ kind: 'indisponible' });
  });

  it('codifica el contexto en la ruta', async () => {
    const espia = fetchEspia(200, []);
    await careClient.datos('a/../b', espia.impl);
    expect(espia.llamadas[0]?.url).toContain('/contexts/a%2F..%2Fb/observables');
  });
});

describe('vistas', () => {
  it('una solicitud sin clasificar se muestra pendiente, nunca verde, y la recepción no es atención', () => {
    const html = renderToStaticMarkup(<BandejaAlarmas alarmas={[ALARMA]} puedeRevisar={false} ocupado={false} />);
    expect(html).toContain('Clasificación: Pendiente de clasificación');
    expect(html).toContain('Estado: Nueva, sin revisar');
    expect(html).toContain('Todavía no consta que un profesional la haya revisado');
    expect(html).not.toMatch(/verde/iu);
    expect(html).not.toContain(ALARMA.id);
  });

  it('la severidad se nombra con palabras', () => {
    const html = renderToStaticMarkup(
      <BandejaAlarmas alarmas={[{ ...ALARMA, severity: 'ROJA', state: 'EN_GESTION' }]} puedeRevisar ocupado={false} onRevisar={() => undefined} />,
    );
    expect(html).toContain('Clasificación: Roja');
    expect(html).toContain('Gestión de la solicitud');
  });

  it('ofrece solo las acciones coherentes con el estado', () => {
    expect(accionesPara('NUEVA')).toEqual(['ACKNOWLEDGE', 'CLASSIFY', 'ASSIGN', 'RESOLVE']);
    expect(accionesPara('RESUELTA')).toEqual(['CLASSIFY', 'CLOSE', 'REOPEN']);
    expect(accionesPara('CERRADA')).toEqual(['REOPEN']);
  });

  it('el formulario sale de los datos validados y, sin ellos, permite una nota sin fingir evaluación', () => {
    const datos: DatoDto[] = [
      { id: 'd1', code: 'si-no', version: 1, label: 'Dato sí/no ficticio', valueType: 'BOOLEAN', unit: null, options: null, validatedAt: '' },
      { id: 'd2', code: 'numero', version: 1, label: 'Dato numérico ficticio', valueType: 'NUMBER', unit: 'u', options: null, validatedAt: '' },
    ];
    const conDatos = renderToStaticMarkup(<FormularioRegistro datos={datos} enviando={false} onEnviar={() => undefined} />);
    expect(conDatos).toContain('<legend>Dato sí/no ficticio</legend>');
    expect(conDatos).toContain('Dato numérico ficticio (u)');
    expect(conDatos).toContain('inputMode="decimal"');

    const sinDatos = renderToStaticMarkup(<FormularioRegistro datos={[]} enviando={false} onEnviar={() => undefined} />);
    expect(sinDatos).toContain('todavía no tiene datos validados por un profesional');
    expect(sinDatos).toContain('Nota (opcional)');
  });

  it('la solicitud avisa de los canales de urgencias y muestra el recibo como estado', () => {
    const html = renderToStaticMarkup(<SolicitudRevision enviando={false} recibo="Solicitud registrada para revisión." onEnviar={() => undefined} />);
    expect(html).toContain('Ante una urgencia, use los canales de urgencias.');
    expect(html).toContain('role="status"');
  });

  it('las correcciones conservan la entrada original y solo el autor puede corregir', () => {
    const registro: RegistroDto = {
      id: 'r1',
      source: 'CAREGIVER',
      authoredByMe: false,
      occurredAt: '2026-10-21T10:00:00.000Z',
      receivedAt: '2026-10-21T10:05:00.000Z',
      note: 'Nota original',
      observations: [],
      amendments: [{ id: 'e1', sequence: 1, observationId: null, reason: 'Motivo', note: 'Corrección', replacement: null, createdAt: '2026-10-21T11:00:00.000Z', authoredByMe: false }],
    };
    const ajeno = renderToStaticMarkup(<ListaRegistros registros={[registro]} onEnmendar={() => undefined} />);
    expect(ajeno).toContain('Nota original');
    expect(ajeno).toContain('Corrección 1');
    expect(ajeno).not.toContain('Agregar una corrección');

    const propio = renderToStaticMarkup(<ListaRegistros registros={[{ ...registro, authoredByMe: true }]} onEnmendar={() => undefined} />);
    expect(propio).toContain('Agregar una corrección');
  });

  it('valores, fechas y códigos', () => {
    expect(valorLegible(true, { valueType: 'BOOLEAN', unit: null })).toBe('Sí');
    expect(valorLegible('12.50', { valueType: 'NUMBER', unit: 'u' })).toBe('12.50 u');
    expect(instanteDesdeLocal('2999-01-01T00:00')).toBeNull();
    expect(instanteDesdeLocal('')).toBeNull();
    expect(codigoDesde('Dolor en la Pierna')).toBe('dolor-en-la-pierna');
    expect(opcionesDesdeTexto('Leve, Moderado ,')).toEqual([
      { code: 'leve', label: 'Leve' },
      { code: 'moderado', label: 'Moderado' },
    ]);
  });
});

describe('criterios y semáforo (MP04–MP05)', () => {
  const vacio = { ROJA: 0, AMARILLA: 0, ESTABLE: 0, SIN: 0 };

  it('el semáforo siempre se escribe; sin criterios ni solicitudes nunca es verde', () => {
    const html = renderToStaticMarkup(
      <BannerSemaforo semaforo={{ level: 'SIN_CRITERIOS', label: 'Sin criterios ni solicitudes: no hay evaluación automática', openAlarms: vacio, activeCriteria: 0 }} />,
    );
    expect(html).toContain('Semáforo: Sin criterios ni solicitudes: no hay evaluación automática.');
    expect(html).toContain('role="status"');
    expect(html).not.toMatch(/verde/iu);
  });

  it('describe el criterio en palabras, con frecuencia y ventana', () => {
    expect(
      describirCriterio(
        { id: 'v', version: 1, observableCode: 'x', valueType: 'NUMBER', comparator: 'GTE', value: '38', requiredCount: 2, windowMinutes: 120, severity: 'AMARILLA', activatedAt: '', validUntil: null, status: 'ACTIVE' },
        'Dato ficticio',
      ),
    ).toBe('Dato ficticio mayor o igual que 38, 2 vez/veces en 2 hora(s) → alarma amarilla');
  });

  it('el formulario de criterios no trae valores sugeridos y ofrece comparaciones según el tipo', () => {
    const datos: DatoDto[] = [{ id: 'd1', code: 'dato', version: 1, label: 'Dato ficticio', valueType: 'NUMBER', unit: null, options: null, validatedAt: '' }];
    const html = renderToStaticMarkup(<GestorCriterios datos={datos} criterios={[]} enviando={false} onDefinir={() => undefined} onRetirar={() => undefined} />);
    expect(html).toContain('La plataforma no sugiere valores clínicos');
    expect(html).toContain('No hay criterios definidos.');
    expect(html).toContain('Validar criterio');
    expect(html).toContain('disabled=""');
    expect(comparadoresPara('BOOLEAN')).toEqual(['EQ']);
    expect(comparadoresPara('CHOICE')).toEqual(['IN']);
  });

  it('la evidencia corregida después se marca para revisar', () => {
    const html = renderToStaticMarkup(
      <DetalleAlarma
        detalle={{
          ...ALARMA,
          origin: 'AUTOMATIC',
          transitions: [],
          evidence: [{ label: 'Dato ficticio', unit: null, valueType: 'NUMBER', value: '40', occurredAt: '2026-10-21T10:00:00.000Z', correctedAfterwards: true }],
        }}
      />,
    );
    expect(html).toContain('Por qué se generó');
    expect(html).toContain('Corregida después: revisar');
  });
});

describe('CareWorkspace', () => {
  it('arranca consultando, sin datos de ejemplo', () => {
    const html = renderToStaticMarkup(<CareWorkspace perfil="cuidador" />);
    expect(html).toContain(TEXTO_ESTADO_GENERAL.cargando);
    expect(html).toContain('<h2');
  });

  it('en Hospital es la vista principal y explica que no hay evaluación automática', () => {
    const html = renderToStaticMarkup(<CareWorkspace perfil="hospital" titulo="Semáforo de alarmas" encabezado="h1" />);
    expect(html).toContain('<h1 id="cuidado-hospital-titulo">Semáforo de alarmas</h1>');
    expect(html).toContain('la evaluación automática por criterios individuales todavía no está habilitada');
  });

  it('no usa almacenamiento del navegador ni lee cookies', () => {
    const fuentes = ['CareWorkspace.tsx', 'careViews.tsx', 'careClient.ts'].map((archivo) =>
      readFileSync(fileURLToPath(new URL(`./${archivo}`, import.meta.url)), 'utf8'),
    );
    for (const fuente of fuentes) {
      for (const prohibido of ['localStorage', 'sessionStorage', 'document.cookie', 'indexedDB']) {
        expect(fuente).not.toContain(prohibido);
      }
    }
  });
});
