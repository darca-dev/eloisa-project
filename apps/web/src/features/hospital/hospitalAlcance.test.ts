import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Alcance de la experiencia Hospital (TASK-003H-03, T-06 y AC-09, AC-13;
 * reconciliado por TASK-HOSPITAL-CORE-01, TASK-HOSPITAL-CORE-02 y
 * HOSPITAL-VISITS-01).
 *
 * Revisa el código FUENTE del módulo, no solo el marcado.
 *
 * LA REGLA YA NO ES «Hospital sin red». TASK-HOSPITAL-CORE-01 aprobó dos
 * conexiones —contexto de sesión institucional y consulta Hospital →
 * Pacientes—, TASK-HOSPITAL-CORE-02 añadió otras dos —Profesionales y Agenda— y
 * HOSPITAL-VISITS-01 añadió la quinta —Visitas domiciliarias sobre MP04— y
 * HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI la sexta —la sesión HUMANA profesional
 * que esas visitas exigen—, todas encapsuladas en sus clientes. Los demás módulos Hospital siguen siendo
 * demostrativos y sin conexión.
 *
 * DOS de esas seis conexiones ya NO viven en Hospital. La spec 021 §17.D-3
 * (`MOVE TO SHARED`) movió la sesión HUMANA a
 * `@/features/auth/humanSessionClient`, y la spec 022 —«Decisión técnica
 * cerrada: reutilización del cliente institucional»— movió la sesión
 * INSTITUCIONAL a `@/features/auth/institutionalSessionClient`, para que
 * Alcaldía la REUTILICE en vez de duplicarla o de importar desde Hospital. En
 * Hospital quedan DOS fachadas compatibles que delegan en esos módulos. Ninguna
 * conexión desapareció ni se relajó; cambiaron de sitio, y su alcance lo
 * vigilan las pruebas de esos módulos. Aquí se comprueba lo que a Hospital le
 * corresponde: que sus fachadas NO se conectan por su cuenta y que SÍ delegan.
 *
 * Por tanto lo que se comprueba aquí es más estricto que antes, no más laxo:
 *
 * 1. WebSocket, XMLHttpRequest, axios, almacenamiento web, `document.cookie`,
 *    telemetría, entorno o secretos siguen PROHIBIDOS en TODO el directorio de
 *    producción de Hospital, sin excepción alguna;
 * 2. una llamada de red solo puede existir en los CUATRO clientes autorizados,
 *    y las dos fachadas autorizadas delegan sin conectarse;
 * 3. el conjunto autorizado es EXACTO: si aparece un cliente nuevo, o si uno de
 *    los cuatro deja de conectarse, esta prueba falla. Autorizar otro consumidor
 *    exige una Task posterior, no un cambio silencioso aquí;
 * 4. la fecha del sistema deja de estar prohibida en bloque y pasa a estar
 *    ACOTADA: no hay `Date.now`, hay UN único reloj actual —el default del
 *    reloj inyectable de Agenda— y las construcciones deterministas de fecha
 *    viven solo en el cliente de Agenda.
 *
 * Es una verificación de ALCANCE, no un control de seguridad: la ausencia de
 * estas llamadas no sustituye autorización, aislamiento institucional ni
 * auditoría, que viven en el servidor. Que un cliente pueda conectarse tampoco
 * concede permiso alguno: cada superficie lo exige en la API.
 */

const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));

/** Código de producción del módulo Hospital, sin las propias pruebas. */
const FUENTES = readdirSync(DIRECTORIO)
  .filter((archivo) => /\.(?:ts|tsx)$/u.test(archivo) && !archivo.includes('.test.'))
  .map((archivo) => ({ archivo, codigo: readFileSync(`${DIRECTORIO}${archivo}`, 'utf8') }));

/**
 * Quita los comentarios de bloque y de linea del codigo antes de evaluar
 * los patrones de alcance.
 *
 * Los patrones comprueban código FUENTE, no documentación: una mención de
 * `fetch` en un comentario explicativo no es una referencia de red, y un texto
 * que describe una fecha no es una lectura del reloj. Evaluar siempre sobre
 * código sin comentarios evita falsos positivos y mantiene el gate estable
 * ante cambios de redacción.
 */
function codigoSinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
}

/** Código de producción del módulo, sin comentarios. */
const CODIGO_SIN_COMENTARIOS = FUENTES.map(({ archivo, codigo }) => ({
  archivo,
  codigo: codigoSinComentarios(codigo),
}));

/**
 * Los CUATRO únicos archivos de Hospital que TASK-HOSPITAL-CORE-02 y
 * HOSPITAL-VISITS-01 autorizan a conectarse DIRECTAMENTE.
 *
 * La lista es cerrada y está ordenada para poder compararla exactamente. Añadir
 * una entrada aquí es declarar una conexión nueva: exige una Task que la
 * autorice.
 *
 * Eran seis. La spec 021 §17.D-3 (`MOVE TO SHARED`) movió el cliente de la
 * sesión HUMANA profesional a `@/features/auth/humanSessionClient`, y la spec
 * 022 movió el de la sesión INSTITUCIONAL —el de TASK-HOSPITAL-CORE-01— a
 * `@/features/auth/institutionalSessionClient`. Ninguna de las dos conexiones
 * desapareció ni se relajó: cambiaron de sitio, y su alcance lo vigilan ahora
 * las pruebas de esos módulos. Lo que queda en Hospital son fachadas, y las
 * fachadas tienen su propia lista cerrada, más abajo.
 */
const CLIENTES_AUTORIZADOS: readonly string[] = [
  'accessPasswordRecoveryClient.ts',
  'hospitalAccessRequestsClient.ts',
  'hospitalAgendaClient.ts',
  'hospitalPatientsClient.ts',
  'hospitalProfessionalsClient.ts',
  'hospitalVisitsClient.ts',
];

/**
 * Las fachadas Hospital autorizadas a DELEGAR en un cliente compartido
 * (spec 021 §17.D-3).
 *
 * Una fachada no se conecta: conserva la superficie que Hospital ya importaba y
 * traslada la llamada al módulo compartido. NUNCA puede invocar `fetch`, y esta
 * prueba lo comprueba junto con la otra mitad de la regla —que delega—, porque
 * una fachada que dejara de delegar en silencio superaría igual la primera.
 *
 * Cada entrada declara además si el archivo puede NOMBRAR `fetch`: la de sesión
 * humana lo recibe por parámetro y lo traslada, de modo que aparece en su
 * firma; la institucional REEXPORTA y por tanto no lo menciona, y no debe
 * empezar a hacerlo.
 *
 * La lista es CERRADA y tiene exactamente dos entradas —spec 021 §17.D-3 y
 * spec 022—. Añadir otra es declarar que un tercer archivo de Hospital delega
 * fuera del módulo: exige una spec que lo autorice, no una edición aquí.
 */
interface FachadaAutorizada {
  /** Archivo de Hospital que delega. */
  readonly archivo: string;
  /** Módulo compartido en el que delega. */
  readonly compartido: string;
  /**
   * Si puede NOMBRAR `fetch` sin llamarlo.
   *
   * Una fachada que traslada la implementación inyectada la declara en su
   * firma; una que solo REEXPORTA no tiene por qué mencionarla, y no debe. La
   * diferencia se declara aquí para que ninguna de las dos formas se relaje sin
   * que esta prueba lo note.
   */
  readonly nombraRed: boolean;
}

const FACHADAS_AUTORIZADAS: readonly FachadaAutorizada[] = [
  {
    archivo: 'hospitalHumanSessionClient.ts',
    compartido: '@/features/auth/humanSessionClient',
    nombraRed: true,
  },
  {
    archivo: 'hospitalInstitutionClient.ts',
    compartido: '@/features/auth/institutionalSessionClient',
    nombraRed: false,
  },
];

/** Nombres de las fachadas, en el orden estable que usan las comparaciones. */
const ARCHIVOS_FACHADA: readonly string[] = FACHADAS_AUTORIZADAS.map(
  ({ archivo }) => archivo,
);

/**
 * Capacidades prohibidas en TODO el directorio, también en los cuatro clientes.
 *
 * Las conexiones autorizadas usan `fetch` y nada más: ni un transporte
 * alternativo, ni persistencia en el navegador, ni telemetría, ni lectura del
 * entorno.
 */
const PROHIBIDO_SIEMPRE: readonly (readonly [string, RegExp])[] = [
  /*
   * Transportes NO autorizados. `fetch` se trata aparte, porque es el único
   * permitido y solo en los cuatro clientes y en la fachada que lo traslada.
   */
  ['transporte no autorizado', /XMLHttpRequest|WebSocket|axios|EventSource|sendBeacon/u],
  ['persistencia', /localStorage|sessionStorage|indexedDB|document\.cookie/u],
  /*
   * Telemetría. El patrón busca el USO de un SDK de telemetría, no la palabra
   * suelta: TASK-003H-03B nombra `PopulationAnalyticsSnapshotV1` al contrato
   * compartido de analítica poblacional, que es dominio del producto y no
   * envía nada a ningún servicio. Lo prohibido sigue siendo idéntico: cliente
   * de telemetría, envío de eventos o inicialización de un proveedor.
   */
  [
    'telemetría',
    /window\.analytics|\banalytics\s*\.\s*(?:track|page|identify|init)|gtag|datadog|sentry/iu,
  ],
  ['entorno o secretos', /process\.env|API_KEY|SECRET|TOKEN|PASSWORD/u],
];

/**
 * Llamada de red efectiva.
 *
 * Detecta la INVOCACIÓN, no la mención. Los cuatro clientes reciben la
 * implementación por parámetro (`fetchImpl`) para poder probarse sin red, de
 * modo que el patrón cubre esa forma además de la directa y de la global.
 *
 * Se distingue a propósito de una simple REFERENCIA al identificador: una vista
 * que declara `fetchImpl?: typeof fetch` para inyectárselo a un cliente no está
 * llamando a la red, y el conjunto de esas vistas se comprueba aparte.
 */
const LLAMADA_DE_RED =
  /\bfetch\s*\(|\bfetchImpl\s*\(|\b(?:window|globalThis)\s*\.\s*fetch\b/u;

/** Cualquier mención del identificador global `fetch`, se llame o no. */
const REFERENCIA_A_RED = /\bfetch\b/u;

/**
 * Archivos que pueden NOMBRAR `fetch` sin llamarlo.
 *
 * Son los puntos de inyección autorizados: cada vista conectada y el shell
 * declaran el parámetro y se lo pasan a su cliente, que es quien conecta.
 * La lista es cerrada: un consumidor nuevo debe fallar aquí.
 *
 * HOSPITAL-VISITS-01 packet B añade `HospitalHomeVisits.tsx`: la vista de
 * Visitas deja de ser demostrativa y pasa a consultar y transicionar la visita
 * REAL a través de `hospitalVisitsClient.ts`. Declararlo aquí NO concede
 * permiso alguno: cada acción sigue exigiendo en el servidor la sesión que le
 * corresponde, y la institucional no sustituye a la profesional.
 *
 * Las vistas demo locales (`HospitalAgendaDemo.tsx`, `HospitalHomeVisitsDemo.tsx`)
 * NO están aquí: solo mencionan `fetch` en comentarios explicativos, y el
 * escaneo se hace sobre código sin comentarios. `hospitalDemoLocal.ts` tampoco:
 * es un adaptador en memoria que nunca delega a la red y se comprueba aparte.
 */
const INYECCION_AUTORIZADA: readonly string[] = [
  'AccessPasswordRecovery.tsx',
  'HospitalAccessRequests.tsx',
  'HospitalAdministration.tsx',
  'HospitalAgenda.tsx',
  'HospitalHomeVisits.tsx',
  'HospitalPatients.tsx',
  'HospitalProfessionals.tsx',
  'HospitalShell.tsx',
];

/**
 * Adaptadores demo locales: clientes en memoria que nunca tocan la red.
 *
 * `hospitalDemoLocal.ts` expone un adaptador que replica la firma de `fetch`
 * (`typeof fetch`) para que las vistas demo reciban un cliente que nunca
 * consulta una URL real: todos sus `Response` se construyen en memoria sobre
 * fixtures ficticios. NOMBRA `fetch` por compatibilidad de tipo, pero NO lo
 * llama.
 *
 * La lista es cerrada: un adaptador nuevo debe declararse aquí con su propia
 * prueba de que nunca delega.
 */
const ADAPTADORES_DEMO: readonly string[] = ['hospitalDemoLocal.ts'];

/**
 * Reloj del sistema leído por atajo. Prohibido en todo el módulo: el único
 * instante «ahora» autorizado es el default del reloj inyectable de Agenda.
 */
const RELOJ_POR_ATAJO = /Date\.now/u;

/**
 * `new Date()` SIN argumentos: leer el instante actual.
 *
 * Se distingue explícitamente de `new Date(valor)`. El patrón exige el
 * paréntesis de cierre inmediato, de modo que ninguna construcción con
 * argumentos puede satisfacerlo.
 */
const RELOJ_ACTUAL = /new\s+Date\s*\(\s*\)/u;

/** La misma lectura del instante actual, con `g` para poder contarla. */
const RELOJ_ACTUAL_GLOBAL = /new\s+Date\s*\(\s*\)/gu;

/**
 * `new Date(...)` CON argumentos: transformación determinista de un valor
 * explícito, no lectura del reloj.
 *
 * El primer carácter significativo tras el paréntesis no puede ser el cierre
 * ni espacio, así que `new Date()` nunca cae aquí.
 */
const FECHA_DETERMINISTA = /new\s+Date\s*\(\s*[^)\s]/u;

/** Orígenes de importación autorizados: React, alias interno y rutas locales. */
const IMPORTS_AUTORIZADOS = /^(?:react|@\/[\w./-]+|\.{1,2}\/[\w./-]+)$/u;

/** Archivos del módulo que satisfacen un patrón, en orden estable. */
function infractores(patron: RegExp): readonly string[] {
  return CODIGO_SIN_COMENTARIOS.filter(({ codigo }) => patron.test(codigo))
    .map(({ archivo }) => archivo)
    .sort((a, b) => a.localeCompare(b, 'es-CO'));
}

/** Veces que un patrón global aparece en todo el código de producción. */
function ocurrencias(patron: RegExp): number {
  return CODIGO_SIN_COMENTARIOS.reduce(
    (total, { codigo }) => total + [...codigo.matchAll(patron)].length,
    0,
  );
}

describe('T-06 — Alcance del módulo Hospital', () => {
  it('encuentra las fuentes del módulo', () => {
    expect(FUENTES.length).toBeGreaterThan(10);
  });

  it.each(PROHIBIDO_SIEMPRE)('no usa %s en ningún archivo', (_capacidad, patron) => {
    expect(infractores(patron)).toEqual([]);
  });

  it('no importa dependencias nuevas', () => {
    const externos = FUENTES.flatMap(({ archivo, codigo }) =>
      [...codigo.matchAll(/from\s+'(?<origen>[^']+)'/gu)]
        .map((coincidencia) => coincidencia.groups?.origen ?? '')
        .filter((origen) => !IMPORTS_AUTORIZADOS.test(origen))
        .map((origen) => `${archivo}: ${origen}`),
    );

    expect(externos).toEqual([]);
  });
});

describe('T-06B — Conexión autorizada: sesión, Pacientes, Profesionales, Agenda, Visitas y sesión humana', () => {
  it('la red se llama EXACTAMENTE en los clientes autorizados, incluida recuperación 041', () => {
    /*
     * Igualdad exacta, no inclusión. Falla en los dos sentidos que importan:
     * si aparece un consumidor de red nuevo, y si uno de los clientes
     * deja de conectarse —lo que dejaría esta autorización obsoleta sin que
     * nadie se enterase—.
     */
    expect(infractores(LLAMADA_DE_RED)).toEqual([...CLIENTES_AUTORIZADOS]);
  });

  it('ningún otro archivo de producción Hospital llama a la red', () => {
    const otros = infractores(LLAMADA_DE_RED).filter(
      (archivo) => !CLIENTES_AUTORIZADOS.includes(archivo),
    );

    expect(otros).toEqual([]);
  });

  it('ninguna fachada autorizada llama a la red: solo delegan', () => {
    /*
     * El punto exacto de la spec 021 §17.D-3 y de la spec 022. Cada fachada
     * conserva la superficie que Hospital importa, pero la conexión ya no
     * ocurre aquí: si algún día volviera a invocarse `fetch` en una de ellas,
     * existirían DOS copias de esa sesión —la compartida y esta—, que es
     * precisamente lo que ambas decisiones evitan, y esta prueba cae antes.
     */
    for (const { archivo } of FACHADAS_AUTORIZADAS) {
      expect(infractores(LLAMADA_DE_RED)).not.toContain(archivo);
      expect(CLIENTES_AUTORIZADOS).not.toContain(archivo);
    }
  });

  it('cada fachada delega en SU módulo compartido, y no en el otro', () => {
    /*
     * La otra mitad de la regla: no basta con que no se conecten. Si una dejara
     * de delegar, Hospital se quedaría sin esa sesión en silencio y la prueba
     * anterior seguiría en verde.
     *
     * Se comprueba además que la sesión humana y la institucional NO se cruzan:
     * son entidades disjuntas, ni una autentica a la otra, y confundir los
     * módulos sería confundir las dos sesiones.
     */
    for (const { archivo, compartido } of FACHADAS_AUTORIZADAS) {
      const fuente = CODIGO_SIN_COMENTARIOS.find((entrada) => entrada.archivo === archivo);
      const otros = FACHADAS_AUTORIZADAS.filter(
        (fachada) => fachada.compartido !== compartido,
      );

      expect(fuente?.archivo).toBe(archivo);
      expect(fuente?.codigo).toContain(compartido);

      for (const { compartido: ajeno } of otros) {
        expect(fuente?.codigo).not.toContain(ajeno);
      }
    }
  });

  it('cada fachada nombra `fetch` solo si su forma lo exige', () => {
    /*
     * La fachada humana traslada la implementación inyectada y por eso la
     * declara; la institucional REEXPORTA y no tiene por qué mencionarla.
     * Comprobarlo en los dos sentidos impide que una reexportación empiece a
     * recibir `fetchImpl` —el primer paso hacia reimplementar el transporte—
     * sin que nadie lo note.
     */
    for (const { archivo, nombraRed } of FACHADAS_AUTORIZADAS) {
      const fuente = CODIGO_SIN_COMENTARIOS.find((entrada) => entrada.archivo === archivo);

      expect(`${archivo}: ${String(REFERENCIA_A_RED.test(fuente?.codigo ?? ''))}`).toBe(
        `${archivo}: ${String(nombraRed)}`,
      );
    }
  });

  it('solo las vistas conectadas, el shell, la fachada y los adaptadores demo pueden nombrar `fetch` sin llamarlo', () => {
    /*
     * Cierra la vía por la que un consumidor nuevo podría conectarse sin que el
     * patrón de invocación lo viera: recibir la implementación inyectada y
     * pasarla a otra parte. Los únicos autorizados a hacerlo son los cinco
     * puntos de inyección ya aprobados, la fachada de §17.D-3, que recibe
     * `fetchImpl` para trasladarlo al módulo compartido, y los adaptadores demo
     * que replican la firma para servirse desde una memoria local. El escaneo
     * ignora comentarios: las vistas demo que solo MENCIONAN `fetch` en un
     * comentario no entran aquí.
     */
    const esperado = [
      ...CLIENTES_AUTORIZADOS,
      ...FACHADAS_AUTORIZADAS.filter(({ nombraRed }) => nombraRed).map(
        ({ archivo }) => archivo,
      ),
      ...INYECCION_AUTORIZADA,
      ...ADAPTADORES_DEMO,
    ].sort((a, b) => a.localeCompare(b, 'es-CO'));

    expect(infractores(REFERENCIA_A_RED)).toEqual(esperado);
  });

  it('los clientes, las fachadas y los adaptadores demo autorizados existen realmente en el módulo', () => {
    const presentes = FUENTES.map(({ archivo }) => archivo);

    for (const archivo of [...CLIENTES_AUTORIZADOS, ...ARCHIVOS_FACHADA, ...ADAPTADORES_DEMO]) {
      expect(presentes).toContain(archivo);
    }
  });

  it('los adaptadores demo son clientes en memoria: NUNCA delegan a la red', () => {
    /*
     * `hospitalDemoLocal.ts` replica la firma de `fetch` para poder servirse en
     * modo demo, pero eso es solo la forma: su cuerpo construye `Response` en
     * memoria sobre fixtures ficticios y no invoca ninguna implementación real.
     * Cada adaptador de la lista cerrada debe:
     * 1. nombrar `fetch` únicamente como tipo de su firma (sin llamarlo), y
     * 2. construir todas sus respuestas con `new Response(...)` local.
     */
    for (const archivo of ADAPTADORES_DEMO) {
      const fuente = CODIGO_SIN_COMENTARIOS.find((entrada) => entrada.archivo === archivo);

      expect(fuente?.archivo).toBe(archivo);
      expect(fuente?.codigo).not.toMatch(/\bfetch\s*\(/u);
      expect(fuente?.codigo).not.toMatch(/\bwindow\s*\.\s*fetch\b/u);
      expect(fuente?.codigo).toContain('new Response(');
      expect(fuente?.codigo).toContain('typeof fetch');
    }
  });

  it('las dos listas son disjuntas: o se conecta, o delega', () => {
    const solapamiento = CLIENTES_AUTORIZADOS.filter((cliente) =>
      ARCHIVOS_FACHADA.includes(cliente),
    );

    expect(solapamiento).toEqual([]);
    // Ambas siguen siendo CERRADAS, con su cardinalidad declarada.
    expect(CLIENTES_AUTORIZADOS).toHaveLength(6);
    expect(FACHADAS_AUTORIZADAS).toHaveLength(2);
  });

  it('los demás módulos Hospital siguen siendo demostrativos y sin conexión', () => {
    /*
     * Consultas virtuales, Finanzas, Reportes, Alertas y Administración no
     * fueron conectados por ninguna Task: su ausencia de red se comprueba
     * explícitamente y no por descarte. Pacientes, Profesionales, Agenda y
     * —desde HOSPITAL-VISITS-01 packet B— Visitas domiciliarias quedan fuera de
     * este conjunto porque sí están conectados, y su alcance lo fijan las
     * allowlists exactas de arriba.
     */
    const modulos = FUENTES.filter(({ archivo }) =>
      /^Hospital(?:VirtualConsultations|FinancialManagement|Reports|Alerts)/u.test(
        archivo,
      ),
    );

    expect(modulos.length).toBeGreaterThan(0);

    for (const { archivo, codigo } of modulos) {
      expect(`${archivo}: ${String(REFERENCIA_A_RED.test(codigoSinComentarios(codigo)))}`).toBe(
        `${archivo}: false`,
      );
    }
  });
});

describe('T-06C — Fecha y reloj: un único instante actual, bajo control', () => {
  it('no lee el reloj del sistema con `Date.now` en ningún archivo', () => {
    expect(infractores(RELOJ_POR_ATAJO)).toEqual([]);
  });

  it('el patrón distingue `new Date()` de `new Date(valor)`', () => {
    /*
     * Guardia del propio gate: la regla anterior confundía ambas formas y por
     * eso prohibía la fecha en bloque. Si alguien relaja estos patrones, esta
     * prueba cae antes que las dos siguientes.
     */
    expect(RELOJ_ACTUAL.test('new Date()')).toBe(true);
    expect(RELOJ_ACTUAL.test("new Date('2026-01-01')")).toBe(false);
    expect(FECHA_DETERMINISTA.test("new Date('2026-01-01')")).toBe(true);
    expect(FECHA_DETERMINISTA.test('new Date()')).toBe(false);
  });

  it('el único reloj actual es el default del reloj inyectable de Agenda', () => {
    /*
     * `HospitalAgenda.tsx` recibe el reloj por parámetro para poder probarse
     * con un instante fijo; su default es la única lectura de «ahora» del
     * módulo. El Dashboard NO lee el reloj: su fecha es un valor de
     * presentación fijo de la configuración. Se comprueban archivo y CANTIDAD:
     * dos defaults en el mismo archivo también serían dos relojes.
     */
    expect(infractores(RELOJ_ACTUAL)).toEqual(['HospitalAgenda.tsx']);
    expect(ocurrencias(RELOJ_ACTUAL_GLOBAL)).toBe(1);
  });

  it('las construcciones deterministas de fecha solo transforman valores recibidos', () => {
    /*
     * `hospitalAgendaClient.ts` valida y transforma fechas ya explícitas
     * (ventana por escala, normalización ISO). No lee el reloj: parte siempre
     * de un valor recibido. Ningún otro archivo puede construir fechas.
     */
    expect(infractores(FECHA_DETERMINISTA)).toEqual([
      'HospitalAccessRequests.tsx',
      'hospitalAccessRequestsClient.ts',
      'hospitalAgendaClient.ts',
    ]);
  });
});
