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

  it('opens Hospital and Alcaldia without an intermediate login; home entry goes through /acceso', () => {
    const hub = readFileSync(`${directory}../hub/HubAccessPortal.tsx`, 'utf8');

    expect(hub).toContain('href="/hospital"');
    expect(hub).toContain('href="/municipality"');
    // MP04-C1: la entrada de Atencion Domiciliaria ofrece exactamente dos CTA.
    expect(hub).toContain('href={urlDeLoginHumano()}');
    expect(hub).toContain('href="/acceso?accion=registro"');
    expect(hub).toContain('>Iniciar sesión<');
    expect(hub).toContain('>Regístrate<');
    // Sin tercer acceso ni vocabulario retirado en esta superficie.
    expect(hub).not.toContain('href="/inscripcion"');
    expect(hub).not.toContain('Solicitar acceso');
    expect(hub).not.toContain('Registro guiado');
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
 * La rama `accion=registro` es una inscripcion guiada por perfil (MP04-C2).
 *
 * Este repositorio no tiene biblioteca de renderizado en las pruebas, así que la
 * forma del wizard se comprueba sobre la fuente, que es la misma convención
 * que ya usa el bloque anterior. Lo que importa comprobar aquí es que el
 * wizard reutiliza el contrato persistente y NO reintroduce ninguna de las
 * rutas que este paquete cierra.
 */
describe('inscripcion guiada por perfil', () => {
  const form = readFileSync(`${directory}AccessRegistrationWizard.tsx`, 'utf8');
  const flujo = readFileSync(`${directory}accessRegistrationFlow.ts`, 'utf8');
  const datos = readFileSync(`${directory}accessRegistrationProfileData.ts`, 'utf8');
  const campos = readFileSync(`${directory}accessRegistrationProfileFields.tsx`, 'utf8');
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

  it('la rama de registro monta el wizard guiado, no el formulario unico', () => {
    expect(access).toContain('<AccessRegistrationWizard />');
    expect(access).not.toContain('<AccessRequestForm');
    expect(form).not.toContain('Solicitud ficticia de');
  });

  it('el selector ofrece las tres ramas con su bajada aprobada', () => {
    expect(form).toContain('¿Cómo se va a registrar?');
    expect(form).toContain('RAMAS_INSCRIPCION.map');

    for (const bajada of [
      'Recibo o necesito atención en casa',
      'Cuido a una o más personas',
      'Profesional que realiza visitas domiciliarias',
    ]) {
      expect(datos).toContain(bajada);
    }
  });

  it('cada rama muestra su rotulo, sus cinco pasos y su progreso', () => {
    expect(form).toContain('meta.tituloRama');
    expect(datos).toContain('INSCRIPCIÓN COMO PACIENTE');
    expect(datos).toContain('INSCRIPCIÓN COMO CUIDADOR');
    expect(datos).toContain('INSCRIPCIÓN COMO VISITADOR MÉDICO');

    for (const paso of [
      'Condición y necesidades',
      'Ubicación y EPS',
      'Contactos',
      'Perfil del cuidador',
      'Vincular paciente',
      'Contacto cercano',
      'Información profesional',
      'EPS e institución',
      'Zona de atención',
      'Verificación',
      'Confirmación',
    ]) {
      expect(datos).toContain(paso);
    }

    expect(form).toContain('role="progressbar"');
    expect(form).toContain('aria-valuemax={5}');
    expect(form).toContain('Paso {rama.paso} de 5');
    expect(form).toContain('aria-valuenow={rama.paso}');
    expect(form).toContain("aria-current={actual ? 'step' : undefined}");
  });

  it('la composicion separa tarjeta de progreso y tarjeta de contenido', () => {
    // Cabecera de marca con punto medio, como la referencia.
    expect(form).toContain('Panel de inscripción · Atención domiciliaria');

    // Progreso independiente: perfil, paso rosa, barra y cinco botones.
    expect(form).toContain('tarjetaProgreso');
    expect(form).toContain('pasoRosa');
    expect(form).toContain('pasoActivo');
    expect(form).toContain('aria-label="Progreso de la inscripción"');

    // Contenido separado: orientación con escucha, burbuja gris y etiqueta.
    expect(form).toContain('tarjetaContenido');
    expect(form).toContain('burbujaGris');
    expect(form).toContain('etiquetaSeccion');
    expect(form).toContain('meta.pasos[rama.paso - 1]?.seccion');

    // Retorno y cambio de perfil como acciones secundarias, sin fila suelta.
    expect(form).toContain('Volver al Portal Central');
    expect(form).toContain('Cambiar perfil');
    expect(form).not.toContain('branchLabel');
  });

  it('el paso 1 muestra la edad derivada sin enviarla', () => {
    expect(campos).toContain('filaEdad');
    expect(campos).toContain('Edad ${String(edad)} años');
    expect(campos).toContain('edadEnAnios(base.birthDate');
    expect(flujo).toContain('SOLO UI');
  });

  it('cada rama muestra solo sus tres fixtures completos', () => {
    expect(form).toContain('ACCESS_REGISTRATION_DEMOS.filter');
    expect(form).toContain('fixture.perfil === rama.perfil');
    expect(form).toContain('Cargar datos de demostración');
  });

  it('cambiar de perfil borra todo y atras conserva la rama', () => {
    expect(form).toContain('volverAlSelector()');
    expect(flujo).toContain("return { pantalla: 'selector' }");
    expect(form).toContain('cambiarPaso(rama, anterior)');
  });

  it('la iconografia es de Eli y no el corazon', () => {
    expect(form).toContain('intencion="guia"');
    expect(form).toContain('intencion="escucha"');
    expect(form).toContain('intencion="agradece"');
    expect(form).toContain('triggerIntencion="saluda"');
    expect(form).toContain('eliGuia');
    expect(form).not.toContain('corazon-check.png');
    expect(form).not.toContain('ELIGEME');
  });

  it('declara los campos del contrato y de cada rama con etiqueta asociada', () => {
    /*
     * El perfil sale de la tarjeta elegida y no tiene selector: `requestedProfile`
     * viaja por `construirCuerpo`, no por un control. Los campos viven en el
     * archivo de campos por rama; lo que importa es que cada `htmlFor` apunte
     * al `id` de su control.
     */
    expect(flujo).toContain('requestedProfile: perfil');
    expect(campos).toContain('const id = idDeCampo(campo)');
    expect(campos).toContain('htmlFor={id}');
    expect(campos).toContain('id={id}');

    for (const etiqueta of [
      'Tipo de documento',
      'Número de documento',
      'Nombres',
      'Apellidos',
      'Fecha de nacimiento',
      'Sexo o género',
      'Teléfono (opcional, al menos uno)',
      'Correo electrónico (opcional, al menos uno)',
      '¿Necesita apoyo en casa?',
      'Zona',
      'EPS a la que pertenece',
      'Dirección completa',
      '¿Qué tipo de cuidador es?',
      '¿Vive con el paciente?',
      '¿El paciente ya está registrado?',
      'Relación con el paciente',
      'Profesión',
      'Zona o sector asignado (opcional)',
    ]) {
      expect(campos).toContain(etiqueta);
    }

    // Sin selector de perfil: la tarjeta elegida es la unica fuente.
    expect(campos).not.toContain('Perfil que desea');
    expect(form).not.toContain('Perfil que desea');

    // La credencial se pide solo en el paso 5 del wizard.
    expect(form).toContain('Contraseña de prueba');
  });

  it('los ejemplos complementan la etiqueta y nunca la sustituyen', () => {
    // Los ejemplos viajan por prop dedicada y las etiquetas siguen siendo reales.
    expect(campos).toContain('placeholder={ejemplo}');
    expect(campos).toContain('ejemplo="Ej.');
    expect(campos).not.toContain('placeholder="');
    expect(form).not.toContain('placeholder=');
  });

  it('exige al menos un medio de contacto antes de enviar', () => {
    expect(form).toContain('MENSAJE_SIN_CONTACTO');
    expect(form).toContain('setSinContacto(true)');
  });

  it('anuncia el desenlace por region viva y bloquea el envio en curso', () => {
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain('role="alert"');
    expect(form).toContain('disabled={enviando}');
    /*
     * El bloqueo del envío NO puede descansar solo en el estado: dos gestos en
     * el mismo tick leerían la misma instantánea de `enviando` y ambos
     * llamarían a la API, consumiendo dos lugares del rate limit. La guarda
     * vive en el flujo puro y se opera de forma sincrónica en el intento.
     */
    expect(form).toContain('useRef');
    expect(form).toContain('crearBloqueoEnvio()');
    expect(form).toContain('bloqueo.intentar()');
    expect(form).toContain('bloqueo.liberar()');
    expect(flujo).toContain('enCurso = true;');

    // El intento pasa por la guarda SINCRONICA antes de tocar la red.
    expect(codigo.indexOf('bloqueo.intentar()')).toBeLessThan(
      codigo.indexOf('submitAccessRequest('),
    );
  });

  it('el boton de envio se presenta como Registrarme y conserva el bloqueo (MP04-C1)', () => {
    expect(form).toContain("'Registrarme'");
    expect(form).not.toContain("'Enviar solicitud'");
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

  it('conserva la rama tras el error para que la persona pueda corregir', () => {
    // El desenlace vive en un estado aparte; la rama solo se retira al aceptar.
    expect(form).toContain('cambiarPaso(rama, primero)');
    expect(form).toContain('className={styles.form}');
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
    expect(form).toContain("htmlFor={idDeCampo('password')}");
    expect(form).toContain("id={idDeCampo('password')}");
    expect(form).toContain('autoComplete="new-password"');
    expect(form).toContain('id="registro-password-ayuda"');
    expect(form).toContain('aria-describedby=');

    // El boton de mostrar/ocultar es accesible: tipo, estado y alcance.
    expect(form).toContain('type="button"');
    expect(form).toContain('aria-pressed={verPassword}');
    expect(form).toContain("aria-controls={idDeCampo('password')}");
    expect(form).toContain('Ocultar contraseña');
    expect(form).toContain('Mostrar contraseña');

    // Sin marcadores de posicion y sin autocorreccion que altere el secreto.
    expect(form).not.toContain('placeholder');
    expect(form).toContain('spellCheck={false}');
  });

  it('la credencial se pide solo en el paso 5 y jamas sale en el resumen', () => {
    // El vaciado esta dentro del `finally`, es decir, tras CADA intento.
    const finallyBlock = codigo.slice(codigo.indexOf('} finally {'));
    expect(finallyBlock).toContain("password: ''");
    expect(finallyBlock).toContain('setVerPassword(false)');

    // El valor solo puede llegar al control como `value`; jamás como contenido.
    expect(form).toContain('value={rama.password}');
    expect(form).not.toContain('>{rama.password}<');

    // El resumen de confirmacion no nombra la credencial.
    const resumen = campos.slice(campos.indexOf('<dl'), campos.indexOf('</dl>'));
    expect(resumen).not.toContain('password');
    expect(resumen).not.toContain('Password');
  });

  it('valida la clave y la autorizacion en el paso 5 sin prometer acceso', () => {
    expect(form).toContain('validarPaso(rama.perfil, 5, rama.base, rama.reg, rama.password)');
    expect(form).toContain('setPasswordProblem(null)');

    const enMinusculas = form.toLowerCase();
    expect(enMinusculas).toContain('todavía no puede iniciar sesión');
    expect(enMinusculas).not.toContain('acceso concedido');
  });

  it('tras un fallo vuelve al paso de la clave y defiende el envio (MP04-C2-C1)', () => {
    // Defensa inmediatamente antes del bloqueo y la red: sin paso 5 valido no
    // hay POST y ningun POST sale con la clave vacia.
    const defensa = codigo.indexOf('validarPaso(rama.perfil, 5, rama.base, rama.reg, rama.password)');
    expect(defensa).toBeGreaterThan(-1);
    expect(defensa).toBeLessThan(codigo.indexOf('bloqueo.intentar()'));
    expect(defensa).toBeLessThan(codigo.indexOf('submitAccessRequest('));

    // `invalid` sin campo conocido y cualquier otro fallo regresan a la clave
    // del paso 5 con enfoque diferido.
    expect(codigo).toContain("setCampoInvalido('password')");
    expect(codigo).toContain('enfocarDiferido(');
    expect(codigo).not.toContain('reponer');
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
      expect(codigo).toMatch(new RegExp(`["']${fase}["']`, 'u'));
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
    expect(codigo).toMatch(/fase === ["']sin-sesion["']/u);
  });

  it('la rama de registro monta el wizard guiado', () => {
    expect(codigo).toMatch(/search\.get\(["']accion["']\) === ["']registro["']/u);
    expect(codigo).toContain('<AccessRegistrationWizard />');
  });

  it('sin sesión abre directamente el proveedor OIDC sin repetir las acciones del portal', () => {
    expect(codigo).toContain('window.location.assign(urlDeLoginHumano())');
    expect(codigo).toContain('Abriendo el formulario seguro de correo y contraseña');
  });
});

/* -------------------------------------------------------------------------- */
/* Dos acciones de Atencion Domiciliaria (SPEC 038, MP04-C1)                    */
/* -------------------------------------------------------------------------- */

/**
 * MP04-C1 reduce la entrada a `Iniciar sesión` y `Regístrate`. Registrarse
 * equivale a enviar la solicitud persistente al Hospital; no existe tercer
 * acceso a `Solicitar acceso` ni a `Registro guiado` en estas superficies.
 * Se comprueba sobre la fuente con la misma convención del resto del archivo.
 */
describe('dos acciones de Atencion Domiciliaria', () => {
  const access = readFileSync(`${directory}CentralAccess.tsx`, 'utf8');

  it('el estado denegado conserva Regístrate sin duplicarlo en el acceso sin sesión', () => {
    expect(access).toContain('href="/acceso?accion=registro"');
    expect(access).toContain('Regístrate');
    expect(access).toContain('window.location.assign(urlDeLoginHumano())');

    for (const retirado of [
      'Registrarme / solicitar acceso',
      'Ver o registrar una solicitud',
      'Abrir registro guiado',
      'Ver el registro guiado por perfil',
      'Solicitar acceso',
      'Registro guiado',
      'registro guiado',
    ]) {
      expect(access).not.toContain(retirado);
    }
  });

  it('la rama de registro es guiada y explica la solicitud automatica', () => {
    const wizard = readFileSync(`${directory}AccessRegistrationWizard.tsx`, 'utf8');

    expect(wizard).toContain('¿Cómo se va a registrar?');
    expect(wizard).toContain('se enviará automáticamente una solicitud al Hospital');
    expect(wizard).toContain('no podrá entrar hasta que sea aprobada');
  });
});

describe('presentación local de perfiles ficticios', () => {
  const access = readFileSync(`${directory}CentralAccess.tsx`, 'utf8');

  it('recibe el modo demo del servidor y no crea una credencial propia', () => {
    expect(access).toContain('modoDemoLocal?: boolean');
    expect(access).toContain('disabled={!modoDemoLocal}');
    expect(access).toContain('router.push(RUTAS_EXPERIENCIA[perfilDemo])');
    expect(access).toContain('no consulta ni guarda información real');
  });

  it('conserva el registro guiado fuera de la presentación', () => {
    expect(access).toContain('<AccessRegistrationWizard />');
    expect(access).toContain('href="/acceso?accion=registro"');
  });
});
