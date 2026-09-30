import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const directory = fileURLToPath(new URL('.', import.meta.url));
const source = readFileSync(`${directory}DemoNavigation.tsx`, 'utf8');
const effectiveSource = source
  .replace(/\/\*[\s\S]*?\*\//gu, '')
  .replace(/\/\/.*$/gmu, '');

describe('Navegación demo local', () => {
  it('declares that all profiles and data are fictional', () => {
    expect(source).toContain('Todos los perfiles y datos son ficticios.');
    expect(source).toContain('No solicita credenciales ni crea sesiones, usuarios, solicitudes o datos.');
  });

  it('does not call the API or create browser persistence', () => {
    for (const prohibited of [
      'fetch(',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
      'urlDeLoginHumano',
      'abrirSesionInstitucional',
    ]) {
      expect(effectiveSource).not.toContain(prohibited);
    }
  });

  it('opens Hospital, Alcaldía and la inscripción without an intermediate login', () => {
    const hub = readFileSync(`${directory}../hub/HubAccessPortal.tsx`, 'utf8');

    expect(hub).toContain('href="/hospital"');
    expect(hub).toContain('href="/municipality"');
    expect(hub).toContain('href="/inscripcion"');
    expect(hub).not.toContain('href="/acceso?destino=');
  });

  it('retira la bandeja de aprobacion ficticia en memoria', () => {
    /*
     * MP03-C2 sustituyo `HospitalAccessApprovalsDemo` por la bandeja conectada
     * a la API. Este bloque comprobaba que el archivo viejo no llamaba a `fetch`;
     * hoy lo que hay que comprobar es que el archivo viejo NO EXISTE y que la
     * navegacion no lo nombra: una demostracion en memoria que sobreviviera a un
     * fichero borrado seguira siendo una demostracion en memoria.
     */
    expect(source).not.toContain('HospitalAccessApprovalsDemo');

    expect(() => readFileSync(`${directory}../hospital/HospitalAccessApprovalsDemo.tsx`, 'utf8')).toThrow();

    const bandeja = readFileSync(`${directory}../hospital/HospitalAccessRequests.tsx`, 'utf8');
    expect(bandeja).toContain('listHospitalAccessRequests');
    expect(bandeja).toContain('decideHospitalAccessRequest');
  });
});

/* -------------------------------------------------------------------------- */
/* Solicitud de acceso persistente (SPEC 038, MP02-C2)                          */
/* -------------------------------------------------------------------------- */

/**
 * La rama `accion=registro` ya no es una tarjeta de confirmación en memoria.
 *
 * Este repositorio no tiene biblioteca de renderizado en las pruebas, así que la
 * forma del formulario se comprueba sobre la fuente, que es la misma convención
 * que ya usa el bloque anterior. Lo que importa comprobar aquí es que el
 * formulario NO reintroduce ninguna de las rutas que este paquete cierra.
 */
describe('formulario de solicitud de acceso', () => {
  const form = readFileSync(`${directory}AccessRequestForm.tsx`, 'utf8');
  const access = readFileSync(`${directory}CentralAccess.tsx`, 'utf8');
  /*
   * Los comentarios PROHIBEN précisément estas Constructiones por nombre —por eso
   * nombran `localStorage`, `sessionStorage` y `credentials` para decir que no
   * se usan—. Se eliminan antes de comprobar, igual que ya hace el bloque
   * anterior: lo que no puede existir es el CÓDIGO, no la advertencia sobre él.
   */
  const codigo = form
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/.*$/gmu, '');

  it('sustituye la confirmación ficticia en memoria por el formulario persistente', () => {
    expect(access).toContain('<AccessRequestForm />');
    expect(access).not.toContain('setSelectedRequest');
    expect(access).not.toContain('Solicitud ficticia de');
    expect(access).not.toContain('No se envió ni se guardó ningún dato');
  });

  it('declara los diez campos del contrato con etiqueta asociada', () => {
    /*
     * Los tres select usan el identificador literal; los seis campos de texto se
     * generan desde la misma clave; la decima, `password`, es OD-11 y tiene su
     * propio control porque su tipo, su ayuda y su ciclo de vida difieren del
     * resto. Se comprueban las dos formas porque lo que importa es que `htmlFor`
     * apunte al `id` del control, no la sintaxis.
     */
    for (const campo of [
      'requestedProfile',
      'documentType',
      'sexGenderCode',
      'documentNumber',
      'givenNames',
      'familyNames',
      'birthDate',
      'phone',
      'email',
      'password',
    ]) {
      expect(form).toContain(`${campo}:`);
    }

    for (const campo of ['requestedProfile', 'documentType', 'sexGenderCode']) {
      expect(form).toContain(`id="solicitud-${campo}"`);
      expect(form).toContain(`htmlFor="solicitud-${campo}"`);
    }

    // Los seis campos de texto se generan desde la misma clave del catálogo.
    expect(form).toContain('htmlFor={`solicitud-${campo}`}');
    expect(form).toContain('id={`solicitud-${campo}`}');
    for (const campo of ['documentNumber', 'givenNames', 'familyNames', 'birthDate', 'phone', 'email']) {
      expect(form).toContain(`${campo}:`);
    }
  });

  it('no usa marcadores de posicion como unica etiqueta', () => {
    expect(form).not.toContain('placeholder');
  });

  it('exige al menos un medio de contacto antes de enviar', () => {
    expect(form).toContain('MENSAJE_SIN_CONTACTO');
    expect(form).toContain("fields: ['phone', 'email']");
  });

  it('anuncia el desenlace por region viva y bloquea el envio en curso', () => {
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain('role="alert"');
    expect(form).toContain('disabled={enviando}');
    /*
     * El bloqueo del envío NO puede descansar solo en el estado: dos eventos
     * `submit` en el mismo tick leerían la misma instantánea de `enviando` y
     * ambos llamarían a la API, consumiendo dos lugares del rate limit. La
     * guarda por tanto se apoya en un `useRef`, que se escribe de forma
     * sincrónica en el momento de la llamada y se libera en todo desenlace.
     */
    expect(form).toContain('useRef');
    expect(form).toContain('if (envioEnCurso.current) {');
    expect(form).toContain('envioEnCurso.current = true;');
    expect(form).toContain('envioEnCurso.current = false;');
    expect(form).not.toContain('if (enviando) {');
  });

  it('ofrece los tres perfiles con el rotulo aprobado y su valor tecnico', () => {
    const cliente = readFileSync(`${directory}accessRequestClient.ts`, 'utf8');

    for (const perfil of [
      "{ code: 'PATIENT', label: 'Paciente' }",
      "{ code: 'CAREGIVER', label: 'Cuidador' }",
      "{ code: 'FIELD_PROFESSIONAL', label: 'Visitador médico' }",
    ]) {
      expect(cliente).toContain(perfil);
    }

    // El rótulo visible cambia; el valor técnico que viaja al servidor no.
    expect(cliente).not.toContain("{ code: 'FIELD_PROFESSIONAL', label: 'Personal de terreno' }");
  });

  it('muestra permanentemente el aviso de datos ficticios', () => {
    expect(form).toContain('Datos ficticios de prueba.');
    expect(form).toContain('No ingrese datos reales');
  });

  it('conserva el formulario tras el error para que la persona pueda corregir', () => {
    // El desenlace vive en un estado aparte; el <form> no se desmonta nunca.
    expect(form).toContain('className={styles.solicitud}');
    expect(form).not.toContain('return null');
  });

  it('no afirma que se creo sesion, paciente, perfil, relacion ni permiso', () => {
    for (const afirmacion of [
      'sesión creada',
      'paciente creado',
      'perfil creado',
      'acceso concedido',
      'ya está registrado',
    ]) {
      expect(form.toLowerCase()).not.toContain(afirmacion);
    }
  });

  it('no persiste nada en el navegador ni admite datos ficticios como fallback', () => {
    for (const prohibido of [
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
      'credentials:',
    ]) {
      expect(codigo).not.toContain(prohibido);
    }
  });

  it('no contiene ningun campo de autoridad en el cuerpo que envia', () => {
    /*
     * `password` NO esta en esta lista desde MP04: es la decima clave del cuerpo
     * y viaja a proposito. Los demas siguen prohibidos, incluidos los que la
     * saga de provision escribie en la base de datos.
     */
    for (const prohibido of [
      'token',
      'tenantId',
      'reviewedBy',
      'decisionReasonCode',
      'provisioningStatus',
      'consentAccepted',
      'declaredPopulations',
    ]) {
      expect(form).not.toContain(`${prohibido}:`);
    }
  });

  it('la credencial ficticia es un campo de contrasena real, etiquetado y con ayuda', () => {
    expect(form).toContain('type={verPassword ? \'text\' : \'password\'}');
    expect(form).toContain('htmlFor="solicitud-password"');
    expect(form).toContain('id="solicitud-password"');
    expect(form).toContain('autoComplete="new-password"');
    expect(form).toContain('id="solicitud-password-ayuda"');
    expect(form).toContain('aria-describedby=');

    // El boton de mostrar/ocultar es accesible: tipo, estado y alcance.
    expect(form).toContain('type="button"');
    expect(form).toContain('aria-pressed={verPassword}');
    expect(form).toContain('aria-controls="solicitud-password"');
    expect(form).toContain('Ocultar contraseña');
    expect(form).toContain('Mostrar contraseña');

    // Sin marcadores de posicion y sin autocorreccion que altere el secreto.
    expect(form).not.toContain('placeholder');
    expect(form).toContain('spellCheck={false}');
  });

  it('la credencial vive en su propio estado y se vacia en todo desenlace de la API', () => {
    // Estado aparte: no puede recargarse con un perfil de demostracion.
    expect(form).toContain("const [password, setPassword] = useState('')");
    expect(form).toContain('password,');

    // El vaciado esta dentro del `finally`, es decir, tras CADA intento.
    const finallyBlock = codigo.slice(codigo.indexOf('} finally {'));
    expect(finallyBlock).toContain("setPassword('')");
    expect(finallyBlock).toContain('setVerPassword(false)');

    // El cuerpo que sale lleva el valor, y solo esa vez.
    expect(codigo).toContain('password,');

    // El valor solo puede llegar al control como `value`; jamás como contenido.
    expect(form).toContain('value={password}');
    expect(form).not.toContain('>{password}<');
    expect(form).not.toContain('{valores.password}');
  });

  it('valida la credencial antes de salir y no afirma que ya se puede entrar', () => {
    expect(form).toContain('accessRequestPasswordProblem(password)');
    expect(form).toContain("fields: ['password']");
    expect(form).toContain('setPasswordProblem(null)');

    const enMinusculas = form.toLowerCase();
    expect(enMinusculas).toContain('todavía no puede iniciar sesión');
    expect(enMinusculas).not.toContain('acceso concedido');
  });
});

/* -------------------------------------------------------------------------- */
/* Selector de experiencias de /acceso (SPEC 038, MP04)                         */
/* -------------------------------------------------------------------------- */

/**
 * MP04 §11 convierte `/acceso` en el selector de experiencias. `/acceso` no
 * está en la allowlist, así que este archivo —sí permitido— es el único lugar
 * donde puede vivir la lógica. Aquí se comprueba sobre la fuente, con la misma
 * convención que el resto del archivo, que el selector:
 *
 * 1. tiene UNA sola puerta de inicio de sesión y ningún secreto propio;
 * 2. no reabre `/cuidador` ni `/profesional` como muestras visuales;
 * 3. consulta al servidor y no lee el navegador;
 * 4. anuncia y enfoca cada desenlace.
 */
describe('selector de experiencias de /acceso', () => {
  const access = readFileSync(`${directory}CentralAccess.tsx`, 'utf8');
  const codigo = access.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');

  it('tiene UNA sola puerta de inicio de sesion y ninguna credencial propia', () => {
    expect(codigo).toContain('urlDeLoginHumano()');

    /*
     * No hay segundo camino: ni campo de contraseña, ni formulario de sesión, ni
     * nada que se parezca a una credencial. Si alguna vez apareciera un campo de
     * contraseña aquí, la regla OD-11 del formulario de solicitud se estaría
     * diluyendo en la portada.
     */
    for (const prohibido of [
      'type="password"',
      'autoComplete="current-password"',
      'localStorage',
      'sessionStorage',
      'document.cookie',
      'window.location',
      'atob(',
      'jwt',
    ]) {
      expect(codigo).not.toContain(prohibido);
    }
  });

  it('no reabre /cuidador ni /profesional como muestras visuales', () => {
    /*
     * El paquete cierra el acceso directo a esas rutas. Cualquier enlace hacia
     * ellas debe salir del MAPA `RUTAS_EXPERIENCIA`, es decir, de una
     * experiencia aprobada que vino del servidor — nunca de un literal.
     */
    expect(codigo).not.toContain('href="/cuidador"');
    expect(codigo).not.toContain('href="/profesional"');
    expect(codigo).not.toContain('Abrir muestra de cuidador');
    expect(codigo).not.toContain('Abrir muestra de personal de terreno');

    expect(codigo).toContain('RUTAS_EXPERIENCIA[');
    expect(codigo).toContain('consultarExperienciasAprobadas(');
  });

  it('cubre los cinco desenlaces del selector, mutuamente excluyentes', () => {
    for (const fase of ['consultando', 'sin-sesion', 'indisponible', 'denegado', 'selector', 'redirigiendo']) {
      expect(codigo).toContain(`'${fase}'`);
    }

    // La denegación es neutral: no dice POR QUÉ la cuenta no tiene aprobaciones.
    expect(codigo).toContain('Su cuenta no tiene ninguna experiencia aprobada.');
    expect(codigo.toLowerCase()).not.toContain('motivo');
  });

  it('anuncia los cambios por region viva y mueve el foco al bloque nuevo', () => {
    expect(codigo).toContain('aria-live="polite"');
    expect(codigo).toContain('tabIndex={-1}');
    expect(codigo).toContain('bloqueRef.current?.focus()');

    // En la primera visita no se roba el foco: la tarjeta de acceso es lo normal.
    expect(codigo).toContain("fase === 'sin-sesion'");
  });

  it('la rama de registro sigue montando el formulario persistente', () => {
    expect(codigo).toContain("search.get('accion') === 'registro'");
    expect(codigo).toContain('<AccessRequestForm />');
  });
});