'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { branding } from '@/config/branding';
import { EliFigure, eliAvatarAlt } from '@/components/ui/Eli';
import { EliBubble, type EliTopic } from '@/components/ui/EliBubble';
import {
  ACCESS_REQUEST_PASSWORD_MAX_LENGTH,
  ACCESS_REQUEST_PASSWORD_MIN_LENGTH,
  submitAccessRequest,
  type AccessRequestOutcome,
  type AccessRequestPasswordProblem,
} from './accessRequestClient';


import {
  cambiarPaso,
  construirCuerpo,
  crearBloqueoEnvio,
  elegirPerfil,
  ESTADO_INICIAL,
  idDeCampo,
  pasoDeCampo,
  validarPaso,
  validarPasoFinal,
  volverAlSelector,
  type BloqueoEnvio,
  type RegistrationProfile,
  type RegistrationState,
  type RegistrationStep,
} from './accessRegistrationFlow';
import {
  CamposBasePaso1,
  CamposCuidador,
  CamposPaciente,
  CamposVisitador,
  ResumenExpediente,
} from './accessRegistrationProfileFields';
import { RAMAS_INSCRIPCION, ramaDe } from './accessRegistrationProfileData';
import styles from './accessRegistration.module.css';

/**
 * Inscripción guiada de cinco pasos por perfil (SPEC 038, MP04-C3).
 *
 * SELECTOR y RAMA, nada más. Cada rama muestra sus cinco títulos exactos, su
 * barra `Paso N de 5`, sus cinco pasos navegables y la
 * iconografía de Elí de la referencia (guía en cabecera, escucha por paso,
 * agradece en el cierre y burbuja flotante con saludo).
 *
 * El envío reutiliza `submitAccessRequest`: un solo POST con las once claves
 * (diez vigentes más el expediente de la rama), bloqueo sincrónico contra
 * doble gesto y credencial vaciada en `finally` tras todo intento de red.
 * La contraseña se pide SOLO en el paso 5 y jamás aparece en el resumen.
 *
 * QUÉ NO HACE:
 *
 * - no captura nada fuera del contrato (sin diagnósticos validados, territorio
 *   preciso, vínculos, afiliaciones, asignaciones ni consentimientos clínicos):
 *   el endpoint no los admite;
 * - no guarda nada en el navegador: borrador y credencial viven en estado React
 *   y mueren al cambiar de perfil o salir de la pantalla;
 * - no transfiere datos entre perfiles y purga los condicionales ocultos;
 * - no ofrece entrada a ningún portal: la confirmación solo anuncia referencia,
 *   `PENDING` y espera de aprobación Hospital.
 *
 * REINTENTO (C2-C1, generalizado al paso 5): tras un fallo se vuelve al paso
 * donde vive la clave —el 5—, con la clave vacía, marcada y enfocada. Sin clave
 * válida no hay POST: la defensa corre inmediatamente antes del bloqueo y la
 * red.
 */

const AYUDA_PASSWORD = `Su contraseña debe tener entre ${ACCESS_REQUEST_PASSWORD_MIN_LENGTH} y ${ACCESS_REQUEST_PASSWORD_MAX_LENGTH} caracteres, al menos una letra y un número. La usará para iniciar sesión después de la aprobación del Hospital.`;

const PROBLEMAS_PASSWORD: Readonly<Record<AccessRequestPasswordProblem, string>> = {
  tooShort: `Use al menos ${ACCESS_REQUEST_PASSWORD_MIN_LENGTH} caracteres.`,
  tooLong: `Use como máximo ${ACCESS_REQUEST_PASSWORD_MAX_LENGTH} caracteres.`,
  missingLetter: 'Incluya al menos una letra.',
  missingDigit: 'Incluya al menos un número.',
  controlCharacter: 'No use caracteres de control.',
};

const MENSAJE_400 =
  'Revise los campos marcados y vuelva a intentarlo. No repita el dato incorrecto en otro campo.';
const MENSAJE_SIN_CONTACTO =
  'Indique al menos un medio de contacto: teléfono o correo electrónico.';
const MENSAJE_AUTORIZACION =
  'Marque la autorización de tratamiento de datos para terminar.';

const MENSAJES_SALIDA: Readonly<
  Record<Exclude<AccessRequestOutcome['kind'], 'accepted' | 'invalid'>, string>
> = {
  conflict: 'No se puede completar este registro. Si ya tiene una cuenta, inicie sesión o contacte al administrador. Para repetir una solicitud use el mismo navegador y los mismos datos.',
  forbidden:
    'La solicitud no se envió porque su navegador no está en un origen habilitado por la plataforma.',
  rateLimited:
    'Se recibieron demasiados intentos desde este dispositivo. Espere unos minutos y vuelva a intentarlo.',
  unavailable:
    'No fue posible registrar la solicitud en este momento. Revise su conexión y vuelva a intentarlo.',
};

const AUTORIZACION_POR_PERFIL: Readonly<Record<RegistrationProfile, string>> = {
  PATIENT: 'Autorizo el tratamiento de mis datos personales y de salud conforme a la Ley 1581 de 2012.',
  CAREGIVER: 'Autorizo el tratamiento de los datos personales conforme a la Ley 1581 de 2012.',
  FIELD_PROFESSIONAL: 'Autorizo el tratamiento de los datos personales conforme a la Ley 1581 de 2012.',
};

const TEMAS_AYUDA: readonly EliTopic[] = [
  {
    id: 'datos-registro',
    question: '¿Qué datos debo registrar?',
    answer: 'Complete sus propios datos. El Hospital revisará la solicitud antes de habilitar el acceso.',
  },
  {
    id: 'aprobacion-hospital',
    question: '¿Cuándo puedo entrar?',
    answer: 'Solo después de que el Hospital apruebe su solicitud. Registrarla no concede acceso.',
  },
  {
    id: 'clave-acceso',
    question: '¿Para qué es la contraseña?',
    answer: 'La usará para iniciar sesión cuando el Hospital apruebe su solicitud. Puede verla en el paso Confirmación antes de enviar; el formulario la borra después de cada intento.',
  },
];

function textoSalida(outcome: AccessRequestOutcome | null): string {
  if (outcome === null || outcome.kind === 'accepted' || outcome.kind === 'invalid') {
    return '';
  }

  return MENSAJES_SALIDA[outcome.kind];
}

export function AccessRegistrationWizard(): ReactNode {
  const [estado, setEstado] = useState<RegistrationState>(ESTADO_INICIAL);
  const [visitados, setVisitados] = useState<ReadonlyArray<RegistrationStep>>([1]);
  const [outcome, setOutcome] = useState<AccessRequestOutcome | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [passwordProblem, setPasswordProblem] = useState<AccessRequestPasswordProblem | null>(null);
  const [sinContacto, setSinContacto] = useState(false);
  const [sinAutorizacion, setSinAutorizacion] = useState(false);
  const [campoInvalido, setCampoInvalido] = useState<string | null>(null);


  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const bloqueoRef = useRef<BloqueoEnvio | null>(null);

  if (bloqueoRef.current === null) {
    bloqueoRef.current = crearBloqueoEnvio();
  }

  const rama = estado.pantalla === 'rama' ? estado : null;
  const aceptada = outcome !== null && outcome.kind === 'accepted';
  const salida = textoSalida(outcome);

  const pantalla = estado.pantalla;
  const pasoActual = rama === null ? null : rama.paso;
  const perfilActual = rama === null ? null : rama.perfil;

  useEffect(() => {
    if (pantalla === 'rama') {
      tituloRef.current?.focus();
    }
  }, [pantalla, pasoActual, perfilActual, aceptada]);

  function enfocarCampo(campo: string): void {
    document.getElementById(idDeCampo(campo))?.focus();
  }

  /*
   * Foco diferido: cuando el paso cambia, el campo aún no existe en el DOM en
   * el mismo tick. Se programa tras el pintado; si el paso no cambió, también
   * funciona porque el DOM ya está.
   */
  function enfocarDiferido(campo: string): void {
    requestAnimationFrame(() => {
      enfocarCampo(campo);
    });
  }

  function limpiarErrores(): void {

    setPasswordProblem(null);
    setSinContacto(false);
    setSinAutorizacion(false);
    setCampoInvalido(null);
  }

  function elegir(perfil: RegistrationProfile): void {
    setEstado(elegirPerfil(perfil));
    setVisitados([1]);
    setOutcome(null);
    setVerPassword(false);
    limpiarErrores();
  }

  function cambiarPerfil(): void {
    if (enviando) {
      return;
    }

    setEstado(volverAlSelector());
    setVisitados([1]);
    setOutcome(null);
    setVerPassword(false);
    limpiarErrores();
  }

  function irAPaso(paso: RegistrationStep): void {
    if (rama === null || enviando || rama.paso === paso || aceptada) {
      return;
    }

    if (!visitados.includes(paso)) {
      return;
    }

    limpiarErrores();
    setEstado(cambiarPaso(rama, paso));
  }

  function marcarBase(campo: string, valor: string): void {
    if (rama === null) {
      return;
    }

    setEstado({ ...rama, base: { ...rama.base, [campo]: valor } });

    if (campoInvalido === campo) {
      setCampoInvalido(null);

      if (campo === 'phone') {
        setSinContacto(false);
      }
    }
  }

  function ponerReg(campo: string, valor: string | boolean): void {
    if (rama === null) {
      return;
    }

    const parche: Record<string, unknown> = { [campo]: valor };

    // Ocultar implica eliminar: al cambiar un control se purgan sus dependientes.
    if (campo === 'necesitaApoyo' && valor !== 'SI') {
      parche['apoyos'] = [];
    }

    if (campo === 'tieneFormacion' && valor !== 'SI') {
      parche['institucionFormacion'] = 'SENA';
    }

    if (campo === 'eps' && valor !== 'OTRA_EPS') {
      parche['otraEps'] = '';
    }

    if (campo === 'vecinoAutorizado' && valor === false) {
      parche['vecinoNombre'] = '';
      parche['vecinoTelefono'] = '';
      parche['vecinoRelacion'] = 'VECINO';
      parche['vecinoDireccion'] = '';
    }

    if (campo === 'institucionDepartamento') {
      parche['institucionMunicipio'] = '';
    }

    if (campo === 'zonaDepartamento') {
      parche['zonaMunicipio'] = '';
    }

    setEstado({ ...rama, reg: { ...rama.reg, ...parche } });

    if (campoInvalido === campo) {
      setCampoInvalido(null);
    }

    if (campo === 'password') {
      setPasswordProblem(null);
    }
  }

  function alternarReg(campo: string, codigo: string): void {
    if (rama === null || enviando) {
      return;
    }

    const actuales = (rama.reg as unknown as Record<string, unknown>)[campo];

    if (!Array.isArray(actuales)) {
      return;
    }

    // `NINGUNA` es excluyente: al marcarla se desmarca todo lo demás.
    if (campo === 'condiciones' && codigo === 'NINGUNA') {
      setEstado({ ...rama, reg: { ...rama.reg, condiciones: ['NINGUNA'] } });
      return;
    }

    const sinNinguna = (actuales as string[]).filter((item) => item !== 'NINGUNA');

    setEstado({
      ...rama,
      reg: {
        ...rama.reg,
        [campo]: sinNinguna.includes(codigo)
          ? sinNinguna.filter((item) => item !== codigo)
          : [...sinNinguna, codigo],
      },
    });
  }

  function senalar(campo: string): void {
    if (campo === 'password') {
      const detalle = rama === null ? null : validarPasoFinal(rama.password, true);
      setPasswordProblem(detalle !== null && detalle.campo === 'password' ? detalle.problema : null);
      setSinContacto(false);
      setSinAutorizacion(false);
    } else if (campo === 'phone') {
      setPasswordProblem(null);
      setSinContacto(true);
      setSinAutorizacion(false);
    } else if (campo === 'autorizaDatos') {
      setPasswordProblem(null);
      setSinContacto(false);
      setSinAutorizacion(true);
    } else {
      setPasswordProblem(null);
      setSinContacto(false);
      setSinAutorizacion(false);
    }

    setCampoInvalido(campo);
    enfocarCampo(campo);
  }

  function continuar(): void {
    if (rama === null || enviando || aceptada) {
      return;
    }

    const faltante = validarPaso(rama.perfil, rama.paso, rama.base, rama.reg, rama.password);

    if (faltante !== null) {
      senalar(faltante);
      return;
    }

    limpiarErrores();
    const siguiente = (rama.paso + 1) as RegistrationStep;
    setVisitados((previos) => (previos.includes(siguiente) ? previos : [...previos, siguiente]));
    setEstado(cambiarPaso(rama, siguiente));
  }

  function atras(): void {
    if (rama === null || enviando || rama.paso === 1 || aceptada) {
      return;
    }

    const anterior = (rama.paso - 1) as RegistrationStep;
    limpiarErrores();
    setEstado(cambiarPaso(rama, anterior));
  }

  async function enviar(): Promise<void> {
    if (rama === null || enviando || rama.paso !== 5) {
      return;
    }

    /*
     * Defensa C2-C1, inmediatamente antes del bloqueo y la red: si el paso 5
     * ya no es válido (la clave pudo borrarse tras un intento previo), NO hay
     * llamada. Ningún POST sale sin clave válida.
     */
    const defensa = validarPaso(rama.perfil, 5, rama.base, rama.reg, rama.password);

    if (defensa !== null) {
      senalar(defensa);
      return;
    }

    const bloqueo = bloqueoRef.current;

    if (bloqueo === null || !bloqueo.intentar()) {
      return;
    }

    setEnviando(true);
    setOutcome(null);
    limpiarErrores();

    try {
      const desenlace = await submitAccessRequest(
        construirCuerpo(rama.perfil, rama.base, rama.password, rama.reg),
      );
      setOutcome(desenlace);

      if (desenlace.kind === 'invalid') {
        const primero = desenlace.fields
          .map((nombre) => pasoDeCampo(rama.perfil, nombre))
          .find((paso): paso is RegistrationStep => paso !== null);

        if (primero !== undefined) {
          const campo = desenlace.fields.find(
            (nombre) => pasoDeCampo(rama.perfil, nombre) === primero,
          ) ?? '';

          setEstado(cambiarPaso(rama, primero));
          setVisitados((previos) => (previos.includes(primero) ? previos : [...previos, primero]));
          setCampoInvalido(campo === '' ? null : campo);
          enfocarDiferido(campo === '' ? 'documentNumber' : campo);
        } else {
          /*
           * Sin campo conocido, el regreso seguro es la clave del paso 5: ya
           * se borró en el `finally` que sigue.
           */
          setCampoInvalido('password');
          enfocarDiferido('password');
        }
      } else if (desenlace.kind !== 'accepted') {
        /*
         * `forbidden`, `rateLimited` y `unavailable` conservan datos y mensaje
         * en el paso 5, con la clave vacía, marcada y enfocada.
         */
        setCampoInvalido('password');
        enfocarDiferido('password');
      }
    } finally {
      bloqueo.liberar();
      setEnviando(false);
      setEstado((actual) =>
        actual.pantalla === 'rama' ? { ...actual, password: '' } : actual,
      );
      setVerPassword(false);
    }
  }

  const encabezado = (
    <div className={styles.header} data-testid="encabezado-registro">
      <div className={styles.brand}>
        <EliFigure
          alt={eliAvatarAlt('guia')}
          className={styles.eliGuia}
          intencion="guia"
          size={48}
        />
        <div>
          <strong>{branding.platformDisplayName}</strong>
          <span>Panel de inscripción · Atención domiciliaria</span>
        </div>
      </div>
    </div>
  );

  const ayudaPaso =
    rama === null
      ? 'Elige cómo te vas a registrar. Te acompaño en cada paso.'
      : (ramaDe(rama.perfil).pasos[rama.paso - 1]?.ayudaEli ?? '');

  const burbuja = (
    <EliBubble
      anchor="viewport"
      stepHelp={ayudaPaso}
      topics={TEMAS_AYUDA}
      triggerIntencion="saluda"
      triggerLabel={`¡Hola! Soy ${branding.aiDisplayName}`}
    />
  );

  if (rama === null) {
    return (
      <main className={styles.page}>
        <div className={styles.panel}>
          {encabezado}
          <Link className={styles.back} href="/">
            ← Volver al Portal Central
          </Link>
          <section className={styles.selectorCard}>
            <h1 className={styles.title}>¿Cómo se va a registrar?</h1>
            <p className={styles.lead}>
              Elija una opción. Al completar el registro se enviará automáticamente una solicitud al Hospital, y no podrá entrar hasta que sea aprobada.
            </p>
            <div className={styles.profileGrid}>
              {RAMAS_INSCRIPCION.map((opcion) => (
                <button
                  className={styles.profileCard}
                  key={opcion.perfil}
                  onClick={() => elegir(opcion.perfil)}
                  type="button"
                >
                  <strong>{opcion.titulo}</strong>
                  <span>{opcion.bajada}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        {burbuja}
      </main>
    );
  }

  const meta = ramaDe(rama.perfil);
  const tituloPaso = meta.pasos[rama.paso - 1]?.titulo ?? '';

  const comunes = {
    campoInvalido,
    enviando,
    ponerBase: marcarBase,
    ponerReg,
    alternarReg,
  };

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        {encabezado}
        <Link className={styles.back} href="/">
          ← Volver al Portal Central
        </Link>
        <section className={styles.tarjetaProgreso} aria-label="Progreso de la inscripción" data-testid="tarjeta-progreso">
          <div className={styles.progresoFila}>
            <span className={styles.perfil}>{meta.tituloRama}</span>
            {aceptada ? null : (
              <span className={styles.pasoRosa}>Paso {rama.paso} de 5</span>
            )}
          </div>
          <h1 className={styles.title} ref={tituloRef} tabIndex={-1}>
            {aceptada ? 'Solicitud registrada' : tituloPaso}
          </h1>
          {aceptada ? null : (
            <>
              <div
                aria-label="Progreso de la inscripción"
                aria-valuemax={5}
                aria-valuemin={1}
                aria-valuenow={rama.paso}
                className={styles.progressTrack}
                role="progressbar"
              >
                <div
                  className={styles.progressFill}
                  style={{ width: `${(rama.paso / 5) * 100}%` }}
                />
              </div>
              <ol className={styles.steps}>
                {meta.pasos.map((info) => {
                  const visitado = visitados.includes(info.paso);
                  const actual = info.paso === rama.paso;

                  return (
                    <li key={info.paso}>
                      <button
                        aria-current={actual ? 'step' : undefined}
                        className={actual ? `${styles.stepButton} ${styles.pasoActivo}` : styles.stepButton}
                        disabled={enviando || aceptada || (!visitado && !actual)}
                        onClick={() => irAPaso(info.paso)}
                        type="button"
                      >
                        {info.paso}. {info.titulo}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>

        {aceptada && outcome.kind === 'accepted' ? (
          <div className={styles.liveRegion} aria-live="polite">
            <EliFigure
              alt={eliAvatarAlt('agradece')}
              className={styles.eliCierre}
              intencion="agradece"
              size={130}
            />
            <p className={styles.confirmation} role="status">
              Solicitud registrada. Su referencia es <strong>{outcome.accepted.reference}</strong>,
              y esa misma referencia es el nombre de usuario que usará para entrar. Estado:{' '}
              <strong>{outcome.accepted.status === 'PENDING' ? 'Pendiente de revisión' : outcome.accepted.status === 'APPROVED_PENDING_PROVISIONING' ? 'Aprobada; creación de acceso pendiente' : 'Creación de acceso no confirmada'}</strong>.
              {' '}Conserve esta referencia. Todavía no puede iniciar sesión. {outcome.accepted.status === 'PENDING'
                ? 'El Hospital debe aprobar la solicitud antes de que pueda entrar.'
                : 'El Hospital debe completar la creación del acceso antes de que pueda entrar.'}
            </p>
            <p className={styles.note}>
              Una solicitud no concede acceso hasta la revisión institucional.
            </p>
          </div>
        ) : (
          <section className={styles.tarjetaContenido} data-testid="tarjeta-contenido">
            <div className={styles.orientacion}>
              <EliFigure
                alt={eliAvatarAlt('escucha')}
                intencion="escucha"
                size={48}
              />
              <p className={styles.burbujaGris}>{meta.pasos[rama.paso - 1]?.ayudaEli ?? ''}</p>
            </div>
            <p className={styles.etiquetaSeccion}>{meta.pasos[rama.paso - 1]?.seccion ?? ''}</p>



            {rama.paso === 1 ? (
              <div className={styles.form}>
                <CamposBasePaso1 {...comunes} base={rama.base} />
                {sinContacto ? (
                  <p className={styles.fieldError} role="alert">
                    {MENSAJE_SIN_CONTACTO}
                  </p>
                ) : null}
                <div className={styles.actions}>
                  <button className={styles.primary} disabled={enviando} onClick={continuar} type="button">
                    Continuar
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            {rama.paso === 2 && rama.perfil === 'PATIENT' && 'condiciones' in rama.reg ? (
              <div className={styles.form}>
                <CamposPaciente {...comunes} paso={2} reg={rama.reg} />
                <div className={styles.actions}>
                  <button className={styles.secondary} disabled={enviando} onClick={atras} type="button">
                    Atrás
                  </button>
                  <button className={styles.primary} disabled={enviando} onClick={continuar} type="button">
                    Continuar
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            {rama.paso === 2 && rama.perfil === 'CAREGIVER' && 'horarios' in rama.reg ? (
              <div className={styles.form}>
                <CamposCuidador {...comunes} paso={2} reg={rama.reg} />
                <div className={styles.actions}>
                  <button className={styles.secondary} disabled={enviando} onClick={atras} type="button">
                    Atrás
                  </button>
                  <button className={styles.primary} disabled={enviando} onClick={continuar} type="button">
                    Continuar
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            {rama.paso === 2 && rama.perfil === 'FIELD_PROFESSIONAL' && 'zonas' in rama.reg ? (
              <div className={styles.form}>
                <CamposVisitador {...comunes} paso={2} reg={rama.reg} />
                <div className={styles.actions}>
                  <button className={styles.secondary} disabled={enviando} onClick={atras} type="button">
                    Atrás
                  </button>
                  <button className={styles.primary} disabled={enviando} onClick={continuar} type="button">
                    Continuar
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            {rama.paso === 3 && rama.perfil === 'PATIENT' && 'condiciones' in rama.reg ? (
              <div className={styles.form}>
                <CamposPaciente {...comunes} paso={3} reg={rama.reg} />
                <div className={styles.actions}>
                  <button className={styles.secondary} disabled={enviando} onClick={atras} type="button">
                    Atrás
                  </button>
                  <button className={styles.primary} disabled={enviando} onClick={continuar} type="button">
                    Continuar
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            {rama.paso === 3 && rama.perfil === 'CAREGIVER' && 'horarios' in rama.reg ? (
              <div className={styles.form}>
                <CamposCuidador {...comunes} paso={3} reg={rama.reg} />
                <div className={styles.actions}>
                  <button className={styles.secondary} disabled={enviando} onClick={atras} type="button">
                    Atrás
                  </button>
                  <button className={styles.primary} disabled={enviando} onClick={continuar} type="button">
                    Continuar
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            {rama.paso === 3 && rama.perfil === 'FIELD_PROFESSIONAL' && 'zonas' in rama.reg ? (
              <div className={styles.form}>
                <CamposVisitador {...comunes} paso={3} reg={rama.reg} />
                <div className={styles.actions}>
                  <button className={styles.secondary} disabled={enviando} onClick={atras} type="button">
                    Atrás
                  </button>
                  <button className={styles.primary} disabled={enviando} onClick={continuar} type="button">
                    Continuar
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            {rama.paso === 4 && rama.perfil === 'PATIENT' && 'condiciones' in rama.reg ? (
              <div className={styles.form}>
                <CamposPaciente {...comunes} paso={4} reg={rama.reg} />
                <div className={styles.actions}>
                  <button className={styles.secondary} disabled={enviando} onClick={atras} type="button">
                    Atrás
                  </button>
                  <button className={styles.primary} disabled={enviando} onClick={continuar} type="button">
                    Continuar
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            {rama.paso === 4 && rama.perfil === 'CAREGIVER' && 'horarios' in rama.reg ? (
              <div className={styles.form}>
                <CamposCuidador {...comunes} paso={4} reg={rama.reg} />
                <div className={styles.actions}>
                  <button className={styles.secondary} disabled={enviando} onClick={atras} type="button">
                    Atrás
                  </button>
                  <button className={styles.primary} disabled={enviando} onClick={continuar} type="button">
                    Continuar
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            {rama.paso === 4 && rama.perfil === 'FIELD_PROFESSIONAL' && 'zonas' in rama.reg ? (
              <div className={styles.form}>
                <CamposVisitador {...comunes} paso={4} reg={rama.reg} />
                <div className={styles.actions}>
                  <button className={styles.secondary} disabled={enviando} onClick={atras} type="button">
                    Atrás
                  </button>
                  <button className={styles.primary} disabled={enviando} onClick={continuar} type="button">
                    Continuar
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            {rama.paso === 5 ? (
              <div className={styles.form}>
                <ResumenExpediente base={rama.base} perfil={rama.perfil} reg={rama.reg} />

                <div className={styles.field}>
                  <label htmlFor={idDeCampo('password')}>Contraseña</label>
                  <div className={styles.passwordRow}>
                    <input
                      aria-describedby={`registro-password-ayuda${
                        campoInvalido === 'password' || passwordProblem !== null
                          ? ' registro-password-error'
                          : ''
                      }`}
                      aria-invalid={campoInvalido === 'password' || passwordProblem !== null}
                      autoComplete="new-password"
                      className={styles.input}
                      id={idDeCampo('password')}
                      name="password"
                      onChange={(event) => {
                        if (rama === null) {
                          return;
                        }

                        setEstado({ ...rama, password: event.target.value });
                        setPasswordProblem(null);

                        if (campoInvalido === 'password') {
                          setCampoInvalido(null);
                        }
                      }}
                      required
                      spellCheck={false}
                      type={verPassword ? 'text' : 'password'}
                      value={rama.password}
                    />
                    <button
                      aria-controls={idDeCampo('password')}
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
                  <p className={styles.fieldHelp} id="registro-password-ayuda">
                    {AYUDA_PASSWORD}
                  </p>
                  {passwordProblem !== null ? (
                    <p className={styles.fieldError} id="registro-password-error" role="alert">
                      {PROBLEMAS_PASSWORD[passwordProblem]}
                    </p>
                  ) : campoInvalido === 'password' ? (
                    <p className={styles.fieldError} id="registro-password-error">
                      Escriba una contraseña válida para continuar.
                    </p>
                  ) : null}
                </div>

                <div className={styles.field}>
                  <label className={styles.check} htmlFor={idDeCampo('autorizaDatos')}>
                    <input
                      checked={rama.reg.autorizaDatos}
                      id={idDeCampo('autorizaDatos')}
                      name="autorizaDatos"
                      onChange={(event) => ponerReg('autorizaDatos', event.target.checked)}
                      type="checkbox"
                    />
                    <span>{AUTORIZACION_POR_PERFIL[rama.perfil]}</span>
                  </label>
                  {sinAutorizacion || campoInvalido === 'autorizaDatos' ? (
                    <p className={styles.fieldError} role="alert">
                      {MENSAJE_AUTORIZACION}
                    </p>
                  ) : null}
                </div>

                <p className={styles.hospitalNotice}>
                  Al pulsar <strong>Registrarme</strong> se enviará esta solicitud al Hospital. No
                  podrá entrar hasta que sea aprobada.
                </p>

                <div className={styles.actions}>
                  <button className={styles.secondary} disabled={enviando} onClick={atras} type="button">
                    Atrás
                  </button>
                  <button
                    className={styles.primary}
                    disabled={enviando}
                    onClick={() => void enviar()}
                    type="button"
                  >
                    {enviando ? 'Enviando solicitud…' : 'Registrarme'}
                  </button>
                  <button className={styles.ghost} disabled={enviando} onClick={cambiarPerfil} type="button">
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : null}

            <div className={styles.liveRegion} aria-live="polite">
              {campoInvalido !== null &&
              campoInvalido !== 'password' &&
              campoInvalido !== 'phone' &&
              campoInvalido !== 'autorizaDatos' &&
              !sinContacto &&
              !sinAutorizacion ? (
                <p className={styles.errorMessage} role="alert">
                  {MENSAJE_400}
                </p>
              ) : null}
              {salida !== '' ? (
                <p className={styles.errorMessage} role="alert">
                  {salida}
                </p>
              ) : null}
            </div>
          </section>
        )}
      </div>
      {burbuja}
    </main>
  );
}
