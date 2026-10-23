import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  acumular,
  type AlarmaDto,
  careClient,
  careCriteriosClient,
  type CriterioDto,
  type DatoDto,
  type DefinicionCriterioDto,
  describirCriterio,
  type EvidenciaDto,
  type RegistroDto,
  valorLegible,
  type VersionCriterioDto,
} from './careClient';
import {
  BannerSemaforo,
  BORRADOR_VACIO,
  borradorDesdeCriterio,
  ColaRevision,
  comparadoresPara,
  DetalleAlarma,
  envioDesdeBorrador,
  GestorCriterios,
  textoEvidencia,
  vigenciaDesdeLocal,
} from './careCriteriaViews';
import { CareHospitalEntry } from './CareHospitalEntry';
import {
  accionesPara,
  BandejaAlarmas,
  codigoDesde,
  ControlPagina,
  FormularioRegistro,
  instanteDesdeLocal,
  ListaRegistros,
  opcionesDesdeTexto,
  SelectorContexto,
  SolicitudRevision,
  TEXTO_ERROR_PAGINA,
  TEXTO_ESTADO_GENERAL,
} from './careViews';
import { CareWorkspace, TEXTO_MOTOR_HOSPITAL } from './CareWorkspace';

const CONTEXTO = '00000000-0000-4000-8000-0000000000c1';

/* Definiciones FICTICIAS: unidades y valores sin significado clínico. */
const DATO_V1: DatoDto = { id: '00000000-0000-4000-8000-0000000000d1', code: 'dato', version: 1, label: 'Dato ficticio', valueType: 'NUMBER', unit: 'u1', options: null, validatedAt: '' };
const DATO_V2: DatoDto = { ...DATO_V1, id: '00000000-0000-4000-8000-0000000000d2', version: 2, unit: 'u2' };
const DEFINICION_V1: DefinicionCriterioDto = { id: DATO_V1.id, version: 1, label: 'Dato ficticio', valueType: 'NUMBER', unit: 'u1', options: null, status: 'ACTIVE' };
const VERSION: VersionCriterioDto = {
  id: 'v',
  version: 1,
  observableDefinition: DEFINICION_V1,
  requiresRevalidation: false,
  observableCode: 'dato',
  valueType: 'NUMBER',
  comparator: 'GTE',
  value: '38',
  requiredCount: 2,
  windowMinutes: 120,
  severity: 'AMARILLA',
  activatedAt: '',
  validUntil: null,
  status: 'ACTIVE',
};
const CRITERIO: CriterioDto = { id: '00000000-0000-4000-8000-0000000000e1', status: 'ACTIVE', retiredReason: null, current: VERSION };
const EVIDENCIA: EvidenciaDto = {
  label: 'Dato ficticio',
  unit: 'u1',
  valueType: 'NUMBER',
  definitionVersion: 1,
  value: '40',
  occurredAt: '2026-10-21T10:00:00.000Z',
  snapshot: 'CAPTURED',
  evaluatedValue: '40',
  evaluatedAmendmentSequence: null,
  correctedAfterwards: false,
};

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
    const datos: readonly DatoDto[] = [
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
      <BannerSemaforo
        semaforo={{ level: 'SIN_CRITERIOS', label: 'Sin criterios ni solicitudes: no hay evaluación automática', openAlarms: vacio, activeCriteria: 0, criteriaRequiringRevalidation: 0 }}
      />,
    );
    expect(html).toContain('Semáforo: Sin criterios ni solicitudes: no hay evaluación automática.');
    expect(html).toContain('role="status"');
    expect(html).not.toMatch(/verde/iu);
  });

  it('MP07A: «sin evaluación» se escribe y dice cuántos criterios esperan revalidación', () => {
    const html = renderToStaticMarkup(
      <BannerSemaforo
        semaforo={{
          level: 'SIN_EVALUACION',
          label: 'Sin evaluación: hay criterios, pero ninguna clasificación autorizada; esto no indica estabilidad',
          openAlarms: vacio,
          activeCriteria: 1,
          criteriaRequiringRevalidation: 2,
        }}
      />,
    );
    expect(html).toContain('Semáforo: Sin evaluación');
    expect(html).toContain('esto no indica estabilidad');
    expect(html).toContain('Criterios vigentes que se evalúan: 1.');
    expect(html).toContain('no se evalúan hasta que un profesional los revalide: 2');
    expect(html).toContain('_nivelSIN_EVALUACION_');
    expect(html).not.toContain('_nivelESTABLE_');
  });

  it('describe el criterio en palabras, con frecuencia y ventana', () => {
    expect(describirCriterio(VERSION, 'Dato ficticio')).toBe('Dato ficticio mayor o igual que 38, 2 vez/veces en 2 hora(s) → alarma amarilla');
  });

  it('el formulario de criterios no trae valores sugeridos y ofrece comparaciones según el tipo', () => {
    const html = renderToStaticMarkup(<GestorCriterios datos={[DATO_V2]} criterios={[]} enviando={false} ronda={0} onDefinir={() => undefined} onRetirar={() => undefined} />);
    expect(html).toContain('La plataforma no sugiere valores clínicos');
    expect(html).toContain('No hay criterios definidos.');
    expect(html).toContain('Validar criterio');
    expect(html).toContain('disabled=""');
    // La vigencia es opcional y se explica; el dato ofrecido nombra versión y unidad exactas.
    expect(html).toContain('Vigente hasta (opcional)');
    expect(html).toContain('Al vencer deja de evaluarse; eso no indica estabilidad.');
    expect(html).toContain('Dato ficticio, versión 2, unidad u2');
    expect(comparadoresPara('BOOLEAN')).toEqual(['EQ']);
    expect(comparadoresPara('CHOICE')).toEqual(['IN']);
  });

  it('A08: cada criterio activo ofrece ajustarlo como versión nueva y muestra su definición exacta', () => {
    const html = renderToStaticMarkup(
      <GestorCriterios datos={[DATO_V1]} criterios={[CRITERIO]} enviando={false} ronda={0} onDefinir={() => undefined} onRetirar={() => undefined} />,
    );
    expect(html).toContain('Ajustar (nueva versión)');
    expect(html).toContain('Evalúa: Dato ficticio, versión 1, unidad u1.');
    expect(html).toContain('Sin fecha de fin.');
    expect(html).not.toContain('Pendiente de revalidar');

    const pendiente = renderToStaticMarkup(
      <GestorCriterios
        datos={[DATO_V2]}
        criterios={[{ ...CRITERIO, current: { ...VERSION, requiresRevalidation: true, observableDefinition: { ...DEFINICION_V1, status: 'RETIRED' } } }]}
        enviando={false}
        ronda={0}
        onDefinir={() => undefined}
        onRetirar={() => undefined}
      />,
    );
    expect(pendiente).toContain('Pendiente de revalidar');
    expect(pendiente).toContain('Revalidar (nueva versión)');
  });

  it('A08: con la MISMA definición el ajuste parte de lo validado y conserva la identidad del criterio', () => {
    const ahora = new Date('2026-10-22T10:00:00.000Z');
    const borrador = borradorDesdeCriterio({ ...CRITERIO, current: { ...VERSION, validUntil: '2026-12-01T00:00:00.000Z' } }, [DATO_V1], ahora);
    expect(borrador).toMatchObject({ definicionId: DATO_V1.id, comparador: 'GTE', valor: '38', veces: '2', ventana: '2', unidad: 'horas', severidad: 'AMARILLA' });
    expect(borrador.vigencia).not.toBe('');

    const envio = envioDesdeBorrador({ ...borrador, veces: '3' }, DATO_V1, CRITERIO.id, ahora);
    expect(envio).toMatchObject({ criterionId: CRITERIO.id, observableDefinitionId: DATO_V1.id, observableCode: 'dato', requiredCount: 3, windowMinutes: 120 });
    expect(envio?.validUntil).toBe(new Date(borrador.vigencia).toISOString());
  });

  it('A08: con OTRA definición no traslada ni convierte comparación ni valor y exige elegir la vigente', () => {
    const borrador = borradorDesdeCriterio(CRITERIO, [DATO_V2]);
    expect(borrador).toMatchObject({ definicionId: '', comparador: '', valor: '', opciones: [] });
    // Sin elegir la definición vigente no hay envío posible.
    expect(envioDesdeBorrador(borrador, DATO_V2, CRITERIO.id)).toBeNull();
    expect(envioDesdeBorrador({ ...borrador, definicionId: DATO_V2.id }, DATO_V2, CRITERIO.id)).toBeNull();
    // Con la vigente elegida y la comparación/valor escritos de nuevo, nombra la definición exacta.
    const listo = envioDesdeBorrador({ ...borrador, definicionId: DATO_V2.id, comparador: 'GT', valor: '0.04' }, DATO_V2, CRITERIO.id);
    expect(listo).toMatchObject({ criterionId: CRITERIO.id, observableDefinitionId: DATO_V2.id, comparator: 'GT', value: '0.04' });
    // El legado sin definición exacta también se revalida desde cero.
    expect(borradorDesdeCriterio({ ...CRITERIO, current: { ...VERSION, observableDefinition: null, requiresRevalidation: true } }, [DATO_V1]).comparador).toBe('');
  });

  it('A08: un criterio nuevo siempre nombra la definición exacta y no inventa vigencia', () => {
    const envio = envioDesdeBorrador(
      { ...BORRADOR_VACIO, definicionId: DATO_V2.id, comparador: 'LT', valor: '1', veces: '1', ventana: '30', unidad: 'minutos', severidad: 'ROJA' },
      DATO_V2,
      null,
    );
    expect(envio).toEqual({ observableDefinitionId: DATO_V2.id, observableCode: 'dato', comparator: 'LT', value: '1', requiredCount: 1, windowMinutes: 30, severity: 'ROJA' });
    expect(vigenciaDesdeLocal('2000-01-01T00:00')).toBeNull();
    expect(envioDesdeBorrador({ ...BORRADOR_VACIO, definicionId: DATO_V2.id, comparador: 'LT', valor: '1', veces: '1', ventana: '1', severidad: 'ROJA', vigencia: '2000-01-01T00:00' }, DATO_V2, null)).toBeNull();
  });

  it('A07: distingue el original del valor evaluado y la corrección vigente al evaluar', () => {
    const html = renderToStaticMarkup(
      <DetalleAlarma
        detalle={{
          ...ALARMA,
          origin: 'AUTOMATIC',
          transitions: [],
          evidence: [{ ...EVIDENCIA, value: '1', evaluatedValue: '11', evaluatedAmendmentSequence: 1, correctedAfterwards: true }],
        }}
      />,
    );
    expect(html).toContain('Por qué se generó');
    expect(html).toContain('Valor registrado (original): 1 u1');
    expect(html).toContain('Valor evaluado: 11 u1 (según la corrección 1, vigente al evaluar)');
    expect(html).toContain('Corregida después de la evaluación: revisar');
    expect(html).toContain('no es un diagnóstico');
  });

  it('A07: la evidencia legada es indeterminada; `null` no se presenta como «sin corrección»', () => {
    const legado = textoEvidencia({ ...EVIDENCIA, snapshot: 'LEGACY_UNDETERMINED', evaluatedValue: null, correctedAfterwards: null });
    expect(legado).toContain('Valor evaluado: no determinado (evidencia anterior al registro del valor evaluado)');
    expect(legado.join(' ')).toContain('no se puede saber si fueron anteriores o posteriores');
    expect(legado.join(' ')).not.toContain('Valor evaluado: 40');

    const sinCorreccion = textoEvidencia({ ...EVIDENCIA, correctedAfterwards: false });
    expect(sinCorreccion).toEqual(['Valor registrado (original): 40 u1', 'Valor evaluado: 40 u1 (el original)']);
  });

  it('A06: la cola dice cuántas abiertas hay, no trunca en silencio y abre la bandeja filtrada', () => {
    const abiertas: string[] = [];
    const html = renderToStaticMarkup(
      <ColaRevision
        cola={[
          {
            contextId: CONTEXTO,
            organizationId: CONTEXTO,
            organizationName: 'Organización ficticia',
            patientLabel: 'Paciente F.',
            actorKind: 'HOSPITAL_REVIEWER',
            actions: ['REVIEW_ALARMS'],
            semaphore: { level: 'ROJO', label: 'Rojo: hay alarmas rojas abiertas', openAlarms: { ...vacio, ROJA: 1, SIN: 54 }, activeCriteria: 0, criteriaRequiringRevalidation: 0 },
            openAlarmCount: 55,
            hasMoreOpenAlarms: true,
            alarms: [{ id: 'a1', origin: 'MANUAL', severity: null, state: 'NUEVA', createdAt: '2026-10-21T12:00:00.000Z', assignedToMe: false }],
          },
        ]}
        onAbrir={(_elemento, filtro) => abiertas.push(filtro)}
      />,
    );
    expect(html).toContain('Se muestran las 1 más recientes de 55 abiertas');
    expect(html).toContain('también las más antiguas');
    expect(html).toContain('Ver todas las abiertas (55)');
    expect(html).toContain('1 roja(s)');
  });
});

describe('paginación (MP07B / A06)', () => {
  it('acumula páginas sin duplicar y conserva el orden del servidor', () => {
    const clave = (item: { id: string }) => item.id;
    expect(acumular([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }, { id: 'c' }], clave)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('pide cada página con el cursor recibido y conserva el filtro de abiertas', async () => {
    const espia = fetchEspia(200, { items: [], nextCursor: null, canReview: true });
    await careClient.alarmas(CONTEXTO, espia.impl, undefined, 'cursor/opaco+1', 'abiertas');
    await careClient.contextos(espia.impl, undefined, 'c-1');
    await careClient.registros(CONTEXTO, espia.impl, undefined, 'r-1');
    await careCriteriosClient.cola(espia.impl, undefined, 'q-1');
    const [alarmas, contextos, registros, cola] = espia.llamadas.map((llamada) => new URL(llamada.url));
    expect(alarmas?.searchParams.get('state')).toBe('open');
    expect(alarmas?.searchParams.get('cursor')).toBe('cursor/opaco+1');
    expect(alarmas?.searchParams.get('limit')).toBe('50');
    expect(contextos?.searchParams.get('cursor')).toBe('c-1');
    expect(registros?.searchParams.get('cursor')).toBe('r-1');
    expect(registros?.searchParams.get('limit')).toBe('20');
    expect(cola?.pathname).toContain('/review-queue');
    expect(cola?.searchParams.get('cursor')).toBe('q-1');

    const primera = fetchEspia(200, { items: [], nextCursor: null });
    await careClient.alarmas(CONTEXTO, primera.impl);
    expect(new URL(primera.llamadas[0]?.url ?? '').searchParams.has('state')).toBe(false);
    expect(new URL(primera.llamadas[0]?.url ?? '').searchParams.has('cursor')).toBe(false);
  });

  it('el control distingue lo cargado de lo que queda y un fallo de página no es el final', () => {
    const conMas = renderToStaticMarkup(
      <ControlPagina cargados={50} nombre="solicitudes" hayMas cargando={false} error={null} textoBoton="Cargar más solicitudes" onMas={() => undefined} />,
    );
    expect(conMas).toContain('50 solicitudes cargados. Hay más por cargar: esto no es el total.');
    expect(conMas).toContain('Cargar más solicitudes');
    expect(conMas).toContain('aria-live="polite"');

    const fallo = renderToStaticMarkup(
      <ControlPagina cargados={20} nombre="entradas" hayMas cargando={false} error={TEXTO_ERROR_PAGINA} textoBoton="Cargar entradas anteriores" onMas={() => undefined} />,
    );
    expect(fallo).toContain('role="alert"');
    expect(fallo).toContain('esto no significa que no haya más');

    const fin = renderToStaticMarkup(
      <ControlPagina cargados={3} nombre="espacios" hayMas={false} cargando={false} error={null} textoBoton="x" onMas={() => undefined} />,
    );
    expect(fin).toContain('No hay más.');
    expect(fin).not.toContain('<button');
  });

  it('un único espacio cargado no se presenta como el único mientras quedan páginas', () => {
    const contexto = { contextId: CONTEXTO, organizationId: CONTEXTO, organizationName: 'Org', patientLabel: 'Paciente F.', actorKind: 'HOSPITAL_REVIEWER' as const, actions: ['REVIEW_ALARMS' as const] };
    expect(renderToStaticMarkup(<SelectorContexto contextos={[contexto]} seleccionado={null} onSeleccionar={() => undefined} />)).not.toContain('<select');
    expect(renderToStaticMarkup(<SelectorContexto contextos={[contexto]} seleccionado={null} onSeleccionar={() => undefined} definitivo={false} />)).toContain('<select');
  });

  it('la bandeja filtrada a abiertas lo dice al estar vacía', () => {
    expect(renderToStaticMarkup(<BandejaAlarmas alarmas={[]} puedeRevisar ocupado={false} soloAbiertas />)).toContain('No hay solicitudes abiertas en este espacio.');
  });
});

describe('CareWorkspace', () => {
  it('arranca consultando, sin datos de ejemplo', () => {
    const html = renderToStaticMarkup(<CareWorkspace perfil="cuidador" />);
    expect(html).toContain(TEXTO_ESTADO_GENERAL.cargando);
    expect(html).toContain('<h2');
  });

  it('A10: en Hospital describe el motor vigente, sus límites y que la clasificación manual es humana', () => {
    const html = renderToStaticMarkup(<CareWorkspace perfil="hospital" titulo="Semáforo de alarmas" encabezado="h1" />);
    expect(html).toContain('<h1 id="cuidado-hospital-titulo">Semáforo de alarmas</h1>');
    expect(html).toContain(TEXTO_MOTOR_HOSPITAL);
    expect(TEXTO_MOTOR_HOSPITAL).toContain('se genera al guardar una entrada, cuando se cumple un criterio individual');
    expect(TEXTO_MOTOR_HOSPITAL).toContain('no evalúa por reloj ni envía avisos fuera de esta bandeja');
    expect(TEXTO_MOTOR_HOSPITAL).toContain('la clasificación la decide un profesional autorizado');
    expect(html).not.toContain('todavía no está habilitada');
    expect(html).not.toMatch(/whatsapp|correo|sms/iu);
  });

  it('A10: la confirmación manual sigue siendo la aprobada por el Product Owner', () => {
    const fuente = readFileSync(fileURLToPath(new URL('../../../../api/src/care-alerts/care-alerts.contract.ts', import.meta.url)), 'utf8');
    expect(fuente).toContain(
      'Solicitud registrada para revisión. Esto no confirma que un profesional ya la haya atendido ni sustituye los canales de urgencias.',
    );
  });

  it('A02: todo el estado de un paciente vive en un subárbol con clave de contexto y ciclo', () => {
    const fuente = readFileSync(fileURLToPath(new URL('./CareWorkspace.tsx', import.meta.url)), 'utf8');
    expect(fuente).toContain('key={`${contexto.contextId}:${seleccion.ciclo}`}');
    // Las respuestas se comprueban contra la señal de la instancia que las pidió.
    expect(fuente).toContain('if (signal.aborted) return;');
    expect(fuente).not.toContain('generacion.current');
  });

  it('A05: la entrada de revisión clínica usa la sesión humana existente y no lee la URL', () => {
    const entrada = readFileSync(fileURLToPath(new URL('./CareHospitalEntry.tsx', import.meta.url)), 'utf8');
    expect(entrada).toContain("urlDeLoginAdministrador('hospital')");
    expect(entrada).toContain('perfil="hospital"');
    for (const prohibido of ['searchParams', 'useSearchParams', 'window.location', 'returnTo', 'HospitalAdministration', 'CareAdministration']) {
      expect(entrada).not.toContain(prohibido);
    }
    const html = renderToStaticMarkup(<CareHospitalEntry />);
    expect(html).toContain('<h1 id="cuidado-hospital-titulo">Revisión clínica de cuidado</h1>');
    expect(html).toContain('href="/hospital"');
    expect(html).toContain('no requiere ser administradora o administrador');
    expect(html).toContain(TEXTO_ESTADO_GENERAL.cargando);
  });

  it('no usa almacenamiento del navegador ni lee cookies', () => {
    const fuentes = ['CareWorkspace.tsx', 'careViews.tsx', 'careClient.ts', 'careCriteriaViews.tsx', 'CareHospitalEntry.tsx'].map((archivo) =>
      readFileSync(fileURLToPath(new URL(`./${archivo}`, import.meta.url)), 'utf8'),
    );
    for (const fuente of fuentes) {
      for (const prohibido of ['localStorage', 'sessionStorage', 'document.cookie', 'indexedDB']) {
        expect(fuente).not.toContain(prohibido);
      }
    }
  });
});
