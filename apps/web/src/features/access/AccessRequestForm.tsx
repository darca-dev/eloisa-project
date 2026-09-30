'use client';

import { useRef, useState, type ReactNode } from 'react';

import {
  ACCESS_REQUEST_DOCUMENT_TYPES,
  ACCESS_REQUEST_PASSWORD_MAX_LENGTH,
  ACCESS_REQUEST_PASSWORD_MIN_LENGTH,
  ACCESS_REQUEST_PROFILES,
  ACCESS_REQUEST_SEX_GENDERS,
  accessRequestPasswordProblem,
  submitAccessRequest,
  type AccessRequestDocumentType,
  type AccessRequestOutcome,
  type AccessRequestPasswordProblem,
  type AccessRequestSexGender,
  type AccessRequestWithCredential,
  type RequestedProfile,
} from './accessRequestClient';
import { ACCESS_REQUEST_DEMOS, type AccessRequestDemoFixture } from './accessRequestDemoFixtures';
import styles from './centralAccess.module.css';

/**
 * Formulario de solicitud de acceso (SPEC 038, MP02-C2).
 *
 * QUÉ ES: un formulario que envía datos FICTICIOS de prueba a
 * `POST /api/v1/access-requests` y muestra la referencia opaca que el servidor
 * devuelve.
 *
 * QUÉ NO ES: no es una inscripción, no crea paciente, cuenta, sesión, perfil,
 * vínculo ni asignación, y no otorga acceso a ningún servicio. El Hospital
 * revisa la solicitud en un paquete posterior. Ningún texto de esta pantalla
 * afirma lo contrario.
 *
 * ACCESIBILIDAD: cada control tiene su `<label>` asociado por `htmlFor`, sin
 * marcadores de posición, porque el valor de un campo de texto no puede ser la
 * única etiqueta. El resultado —éxito o error— se anuncia por una región
 * `aria-live="polite"` y el error además por `role="alert"`. El envío se
 * deshabilita mientras está en curso para que un segundo toque no cree una
 * segunda solicitud, y se vuelve a habilitar en cuanto termina.
 *
 * DATOS: no se guarda nada en el navegador. Los datos permanecen en el estado
 * del componente mientras la persona corrige, y desaparecen al salir de la
 * pantalla. No hay cookie, ni token, ni `localStorage`, ni `sessionStorage`.
 */

type Campo = keyof AccessRequestWithCredential;

const CAMPOS: ReadonlyArray<Campo> = [
  'documentNumber',
  'givenNames',
  'familyNames',
  'birthDate',
  'phone',
  'email',
];

/**
 * Campos que la INTERFEZ sabe señalar por su nombre.
 *
 * Es `CAMPOS` más `password`: el resto —perfil, tipo de documento, sexo— se
 * pinta con su propio control y también puede ser rechazado por el servidor.
 * Sin esta lista aparte, un `fields: ['password']` no encontraría coincidencia y
 * el formulario terminaría marcando los seis campos de texto que no fallaron.
 */
const CAMPOS_SENALABLES: ReadonlyArray<Campo> = [...CAMPOS, 'password'];

const ETIQUETAS: Readonly<Record<Campo, string>> = {
  requestedProfile: 'Perfil que desea',
  documentType: 'Tipo de documento',
  documentNumber: 'Número de documento',
  givenNames: 'Nombres',
  familyNames: 'Apellidos',
  birthDate: 'Fecha de nacimiento',
  sexGenderCode: 'Sexo o género',
  phone: 'Teléfono',
  email: 'Correo electrónico',
  password: 'Contraseña de prueba',
};

/** Avisos de credencial por CATEGORÍA: nunca reproducen lo escrito. */
const PROBLEMAS_PASSWORD: Readonly<Record<AccessRequestPasswordProblem, string>> = {
  tooShort: `Use al menos ${ACCESS_REQUEST_PASSWORD_MIN_LENGTH} caracteres.`,
  tooLong: `Use como máximo ${ACCESS_REQUEST_PASSWORD_MAX_LENGTH} caracteres.`,
  missingLetter: 'Incluya al menos una letra.',
  missingDigit: 'Incluya al menos un número.',
  controlCharacter: 'No use caracteres de control.',
};

const AYUDA_PASSWORD = `Es una contraseña ficticia para esta prueba: debe tener entre ${ACCESS_REQUEST_PASSWORD_MIN_LENGTH} y ${ACCESS_REQUEST_PASSWORD_MAX_LENGTH} caracteres, al menos una letra y un número. Se usa solo para crear la cuenta de prueba y no se guarda en este navegador.`;

const MENSAJES: Readonly<
  Record<Exclude<AccessRequestOutcome['kind'], 'accepted' | 'invalid'>, string>
> = {
  forbidden:
    'La solicitud no se envió porque su navegador no está en un origen habilitado por la plataforma.',
  rateLimited:
    'Se recibieron demasiados intentos desde este dispositivo. Espere unos minutos y vuelva a intentarlo.',
  unavailable:
    'No fue posible registrar la solicitud en este momento. Revise su conexión y vuelva a intentarlo.',
};

const MENSAJE_400 =
  'Revise los campos marcados y vuelva a intentarlo. No repita el dato incorrecto en otro campo.';
const MENSAJE_SIN_CONTACTO =
  'Indique al menos un medio de contacto: teléfono o correo electrónico.';

function textoDeSalida(outcome: AccessRequestOutcome | null): string {
  if (outcome === null) {
    return '';
  }

  if (outcome.kind === 'invalid') {
    return MENSAJE_400;
  }

  if (outcome.kind === 'accepted') {
    return '';
  }

  return MENSAJES[outcome.kind];
}

/** Marca los campos señalados por el servidor, o todos si no los especificó. */
function camposConError(
  outcome: AccessRequestOutcome | null,
  submitted: boolean,
): ReadonlySet<Campo> {
  if (!submitted || outcome === null || outcome.kind !== 'invalid') {
    return new Set<Campo>();
  }

  const declarados = outcome.fields.filter((campo): campo is Campo =>
    (CAMPOS_SENALABLES as readonly string[]).includes(campo),
  );

  if (declarados.length > 0) {
    return new Set<Campo>(declarados);
  }

  return new Set<Campo>(CAMPOS_SENALABLES);
}

export function AccessRequestForm(): ReactNode {
  const [requestedProfile, setRequestedProfile] = useState<RequestedProfile>('PATIENT');
  const [documentType, setDocumentType] = useState<AccessRequestDocumentType>('CEDULA_CIUDADANIA');
  const [sexGenderCode, setSexGenderCode] = useState<AccessRequestSexGender>('FEMENINO');
  const [valores, setValores] = useState<Readonly<Record<string, string>>>({});
  /*
   * OD-11. La credencial vive en su PROPIO estado y jamás entra en `valores`:
   * así no se recarga con un perfil de demostración, no se refleja en ningún
   * listado de campos del formulario y no puede acabar en un objeto de
   * diagnóstico pensado para otros campos. Se vacía en `finally`, es decir, en
   * cuanto termina cada intento contra la API, haya salido bien o mal.
   */
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [passwordProblem, setPasswordProblem] = useState<AccessRequestPasswordProblem | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [outcome, setOutcome] = useState<AccessRequestOutcome | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [sinContacto, setSinContacto] = useState(false);
  /*
   * Bloqueo SINCRÓNICO por intento.
   *
   * El estado `enviando` no basta: dos eventos `submit` en el mismo tick leen
   * la misma instantánea de `false` porque React aún no ha renderizado, y ambos
   * proceden a llamar a la API. Eso crearía dos solicitudes —y consumiría dos
   * lugares del rate limit— por un solo gesto. Un `useRef` se escribe en el
   * momento exacto de la llamada y se lee sincrónicamente, de modo que el
   * segundo intento ve el bloqueo aunque todavía no exista un render nuevo.
   *
   * `enviando` se conserva porque describe lo que la persona VE: el aviso
   * `disabled` y el texto del botón.
   */
  const envioEnCurso = useRef(false);

  const marcar = (campo: Campo) => (event: { target: { value: string } }) =>
    setValores((previo) => ({ ...previo, [campo]: event.target.value }));

  const contacto = (valores['phone'] ?? '').trim() !== '' || (valores['email'] ?? '').trim() !== '';
  const conError = camposConError(outcome, enviado);
  const salida = textoDeSalida(outcome);
  const aceptada = outcome !== null && outcome.kind === 'accepted';

  function cargarDemo(fixture: AccessRequestDemoFixture): void {
    if (envioEnCurso.current) {
      return;
    }

    const datos = fixture.submission;
    setRequestedProfile(datos.requestedProfile);
    setDocumentType(datos.documentType);
    setSexGenderCode(datos.sexGenderCode);
    setValores({
      documentNumber: datos.documentNumber,
      givenNames: datos.givenNames,
      familyNames: datos.familyNames,
      birthDate: datos.birthDate,
      phone: datos.phone ?? '',
      email: datos.email ?? '',
    });
    setOutcome(null);
    setEnviado(false);
    setSinContacto(false);
  }

  async function enviar(event: { preventDefault: () => void }): Promise<void> {
    event.preventDefault();

    if (envioEnCurso.current) {
      return;
    }

    /*
     * La credencial se comprueba ANTES de salir. Un rechazo local no es un
     * intento contra la API —no hay llamada, no hay respuesta, no hay qué
     * limpiar— y la persona conserva lo escrito para corregirlo; vaciarlo aquí
     * obligaría a reescribir un secreto que todavía no ha viajado. Lo que sí se
     * vacía, sin excepción, es el `finally` de abajo: en cuanto hay una
     * petición en el aire, el valor deja de existir en React.
     */
    const passwordFallo = accessRequestPasswordProblem(password);

    if (passwordFallo !== null) {
      setEnviado(true);
      setSinContacto(false);
      setPasswordProblem(passwordFallo);
      setOutcome({ kind: 'invalid', fields: ['password'] });
      return;
    }

    setPasswordProblem(null);

    if (!contacto) {
      setEnviado(true);
      setSinContacto(true);
      setOutcome({ kind: 'invalid', fields: ['phone', 'email'] });
      return;
    }

    envioEnCurso.current = true;
    setEnviado(true);
    setSinContacto(false);
    setEnviando(true);
    setOutcome(null);

    const cuerpo: AccessRequestWithCredential = {
      requestedProfile,
      documentType,
      documentNumber: (valores['documentNumber'] ?? '').trim(),
      givenNames: (valores['givenNames'] ?? '').trim(),
      familyNames: (valores['familyNames'] ?? '').trim(),
      birthDate: (valores['birthDate'] ?? '').trim(),
      sexGenderCode,
      password,
      ...((valores['phone'] ?? '').trim() === ''
        ? {}
        : { phone: (valores['phone'] ?? '').trim() }),
      ...((valores['email'] ?? '').trim() === '' ? {} : { email: (valores['email'] ?? '').trim() }),
    };

    try {
      setOutcome(await submitAccessRequest(cuerpo));
    } finally {
      /*
       * El bloqueo se libera en TODO desenlace —aceptado, inválido, origen,
       * límite o indisponibilidad— para que la persona pueda reintentar. Quedar
       * bloqueado tras un fallo convertiría un error de red en un formulario
       * que ya no responde.
       *
       * Y la credencial se BORRA aquí, en el mismo `finally`: no existe ningún
       * desenlace en el que siga viva en el estado del componente. El resto de
       * los campos sí se conserva, que es lo que permite corregir y reenviar.
       */
      envioEnCurso.current = false;
      setEnviando(false);
      setPassword('');
      setVerPassword(false);
    }
  }

  const textoEntrada = (campo: Campo) => (
    <input
      className={styles.input}
      id={`solicitud-${campo}`}
      name={campo}
      type={campo === 'birthDate' ? 'date' : campo === 'email' ? 'email' : 'text'}
      value={valores[campo] ?? ''}
      onChange={marcar(campo)}
      required={campo !== 'phone' && campo !== 'email'}
      aria-invalid={conError.has(campo)}
      aria-describedby={conError.has(campo) ? `solicitud-${campo}-error` : undefined}
    />
  );
  return (
    <>
      <p className={styles.demoWarning}>
        <strong>Datos ficticios de prueba.</strong> No ingrese datos reales de ninguna persona.
      </p>

      <section className={styles.demoProfiles} aria-labelledby="solicitud-demo-title">
        <h2 id="solicitud-demo-title">Cargar datos de demostración</h2>
        <p>Elija un perfil ficticio. Revise los datos antes de enviar la solicitud al Hospital.</p>
        {ACCESS_REQUEST_PROFILES.map((perfil) => (
          <div className={styles.demoProfileGroup} key={perfil.code}>
            <h3>{perfil.label}</h3>
            <div className={styles.demoProfileActions}>
              {ACCESS_REQUEST_DEMOS.filter(
                (fixture) => fixture.submission.requestedProfile === perfil.code,
              ).map((fixture) => (
                <button
                  className={styles.demoProfileButton}
                  disabled={enviando}
                  key={fixture.id}
                  onClick={() => cargarDemo(fixture)}
                  type="button"
                >
                  {fixture.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <form className={styles.solicitud} onSubmit={enviar} noValidate>
        <div className={styles.campo}>
          <label htmlFor="solicitud-requestedProfile">{ETIQUETAS.requestedProfile}</label>
          <select
            className={styles.input}
            id="solicitud-requestedProfile"
            name="requestedProfile"
            value={requestedProfile}
            onChange={(event) => setRequestedProfile(event.target.value as RequestedProfile)}
          >
            {ACCESS_REQUEST_PROFILES.map((perfil) => (
              <option key={perfil.code} value={perfil.code}>
                {perfil.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.campo}>
          <label htmlFor="solicitud-documentType">{ETIQUETAS.documentType}</label>
          <select
            className={styles.input}
            id="solicitud-documentType"
            name="documentType"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value as AccessRequestDocumentType)}
          >
            {ACCESS_REQUEST_DOCUMENT_TYPES.map((tipo) => (
              <option key={tipo.code} value={tipo.code}>
                {tipo.label}
              </option>
            ))}
          </select>
        </div>

        {(['documentNumber', 'givenNames', 'familyNames', 'birthDate', 'phone', 'email'] as const).map(
          (campo) => (
            <div className={styles.campo} key={campo}>
              <label htmlFor={`solicitud-${campo}`}>
                {ETIQUETAS[campo]}
                {campo === 'phone' || campo === 'email' ? ' (opcional, al menos uno)' : ''}
              </label>
              {textoEntrada(campo)}
              {conError.has(campo) ? (
                <p className={styles.campoError} id={`solicitud-${campo}-error`}>
                  Revise este campo.
                </p>
              ) : null}
            </div>
          ),
        )}

        <div className={styles.campo}>
          <label htmlFor="solicitud-sexGenderCode">{ETIQUETAS.sexGenderCode}</label>
          <select
            className={styles.input}
            id="solicitud-sexGenderCode"
            name="sexGenderCode"
            value={sexGenderCode}
            onChange={(event) => setSexGenderCode(event.target.value as AccessRequestSexGender)}
          >
            {ACCESS_REQUEST_SEX_GENDERS.map((sexo) => (
              <option key={sexo.code} value={sexo.code}>
                {sexo.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.campo}>
          <label htmlFor="solicitud-password">{ETIQUETAS.password}</label>
          <div className={styles.passwordRow}>
            <input
              aria-describedby={`solicitud-password-ayuda${
                conError.has('password') || passwordProblem !== null
                  ? ' solicitud-password-error'
                  : ''
              }`}
              aria-invalid={conError.has('password') || passwordProblem !== null}
              autoComplete="new-password"
              className={styles.input}
              id="solicitud-password"
              name="password"
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordProblem(null);
              }}
              required
              spellCheck={false}
              type={verPassword ? 'text' : 'password'}
              value={password}
            />
            <button
              aria-controls="solicitud-password"
              aria-pressed={verPassword}
              className={styles.passwordToggle}
              disabled={enviando}
              onClick={() => {
                setVerPassword((anterior) => !anterior);
              }}
              type="button"
            >
              {verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            </button>
          </div>
          <p className={styles.campoAyuda} id="solicitud-password-ayuda">
            {AYUDA_PASSWORD}
          </p>
          {passwordProblem !== null ? (
            <p className={styles.campoError} id="solicitud-password-error" role="alert">
              {PROBLEMAS_PASSWORD[passwordProblem]}
            </p>
          ) : conError.has('password') ? (
            <p className={styles.campoError} id="solicitud-password-error">
              Revise este campo.
            </p>
          ) : null}
        </div>

        <button className={styles.primary} type="submit" disabled={enviando}>
          {enviando ? 'Enviando solicitud…' : 'Enviar solicitud'}
        </button>

        <div className={styles.liveRegion} aria-live="polite">
          {aceptada && outcome.kind === 'accepted' ? (
            <p className={styles.demoConfirmation} role="status">
              Solicitud registrada. Su referencia es{' '}
              <strong>{outcome.accepted.reference}</strong>, y esa misma referencia es el nombre de
              usuario que usará para entrar. Estado: <strong>{outcome.accepted.status}</strong>.
              Conserve esta referencia. Todavía NO puede iniciar sesión: la solicitud está pendiente
              de revisión y, hasta que el Hospital la apruebe, su cuenta sigue deshabilitada. Esta
              pantalla no crea sesión.
            </p>
          ) : null}
          {sinContacto ? (
            <p className={styles.campoError} role="alert">
              {MENSAJE_SIN_CONTACTO}
            </p>
          ) : null}
          {salida !== '' ? (
            <p className={styles.errorMessage} role="alert">
              {salida}
            </p>
          ) : null}
        </div>
      </form>
    </>
  );
}
