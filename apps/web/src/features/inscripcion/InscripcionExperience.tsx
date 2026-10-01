'use client';

import Link from 'next/link';
import { useEffect, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';

import { BrandLogo } from '@/components/ui/BrandLogo';
import { EliFigure } from '@/components/ui/Eli';
import { EliBubble } from '@/components/ui/EliBubble';
import type { EliTopic } from '@/components/ui/EliBubble';
import { FieldError } from '@/components/ui/Field';
import { branding, platformNameInSentence } from '@/config/branding';

import {
  ACCION_FINAL,
  ESTADO_INICIAL,
  ETIQUETA_RAMA,
  PERFILES,
  TITULOS_PASO,
  TOTAL_PASOS,
  inscripcionReducer,
  nombreCompleto,
  textoClasificacion,
} from './inscripcionFlow';
import type { InscripcionState, PerfilId } from './inscripcionFlow';
import styles from './inscripcion.module.css';
import {
  buildPatientEnrollmentRequest,
  submitPatientEnrollment,
} from './patientEnrollmentClient';
import type { EnrollmentOutcome, PatientEnrollmentRequest } from './patientEnrollmentClient';
import { PasosCuidador } from './steps/PasosCuidador';
import { PasosPaciente } from './steps/PasosPaciente';
import { PasosVisitador } from './steps/PasosVisitador';
import { idCampo } from './steps/piezas';

/**
 * Flujo oficial de inscripción (TASK-002A).
 *
 * Única frontera cliente de esta superficie. Reconstruye
 * `prototype-claude/Eligeme-Inscripcion.dc.html`: la entrada es «¿Cómo se va a
 * registrar?» y, tras elegir perfil, solo se renderiza la rama elegida.
 *
 * Elí aparece con dos expresiones distintas y ninguna se repite: `saluda` en el
 * activador flotante, tal como en la referencia original, y `agradece` en el
 * cierre. La barra superior no la muestra (TASK-002B). Todo su copy habla de tú.
 *
 * TASK-MVP-CORE-01 conecta ÚNICAMENTE la rama Paciente con la API real: al
 * confirmar el último paso se envía la inscripción y la pantalla de cierre solo
 * aparece tras un `201`. La sesión viaja en una cookie `HttpOnly` administrada
 * por el backend: este componente no guarda paciente, token ni datos personales
 * en `localStorage`, `sessionStorage` ni en la URL.
 *
 * Las ramas Cuidador y Visitador conservan su cierre local aprobado, porque su
 * persistencia está expresamente fuera del alcance de CORE-01.
 */

const AVISO_DEMO_ID = 'inscripcion-aviso-demostracion';

/**
 * Activador flotante de la inscripción (TASK-002B, FR-02): expresión y rótulo
 * de la referencia original `prototype-claude/Eligeme-Inscripcion.dc.html`. Solo
 * afecta a esta superficie; el resto de la burbuja conserva su comportamiento.
 */
const ELI_ACTIVADOR = {
  triggerIntencion: 'saluda',
  triggerLabel: `¡Hola! Soy ${branding.aiDisplayName}`,
} as const;

const AYUDA_PASO: Record<PerfilId, readonly string[]> = {
  paciente: [
    'Escribe tu documento, tu nombre y un teléfono donde podamos llamarte. En esta inscripción todos los datos que te pido son obligatorios.',
    'Marca todas las casillas que se parezcan a tu situación. Puedes marcar una, dos o las tres. Los diagnósticos van en este mismo paso.',
    'Elige tu departamento y tu municipio, y escribe el corregimiento. La dirección y las indicaciones para llegar son lo más importante: escribe algo como «casa azul detrás de la iglesia».',
    'Registra un familiar y un vecino cercano. Nos sirven para ubicarte si no logramos comunicarnos contigo.',
    'Revisa que todo esté bien. Si algo cambió, toca Editar antes de terminar.',
  ],
  cuidador: [
    'Estos son tus datos, no los del paciente. Más adelante registramos a la persona que cuidas.',
    'Cuéntame qué tipo de cuidador eres y si tienes formación. Si no la tienes, no hay problema.',
    'Indica si el paciente ya está registrado y cuál es tu relación con él. Aquí no se busca ni se vincula a nadie.',
    'Este vecino debe vivir cerca del paciente, no cerca de ti. Sirve para ubicarlo si ninguno de los dos responde.',
    'Revisa la información antes de terminar la inscripción.',
  ],
  visitador: [
    'Usa preferiblemente tu correo institucional. Con eso se agiliza la verificación.',
    'Indica tu profesión y el número de tu tarjeta profesional cuando corresponda.',
    'La EPS y la institución donde trabajas son datos separados. Puedes atender afiliados de una EPS desde una IPS o ESE distinta.',
    'Elige el departamento y el municipio principal que cubres, y marca el tipo de atención que realizas.',
    'Tu registro quedaría pendiente de verificación.',
  ],
};

const TEMAS_SELECCION: readonly EliTopic[] = [
  {
    id: 'roles',
    question: '¿Cuál rol me corresponde?',
    answer:
      'Si la plataforma es para tu propia salud, eres paciente. Si registras información de otra persona a la que cuidas, eres cuidador. Si eres personal de salud que hace visitas, eres visitador médico.',
  },
  {
    id: 'datos',
    question: '¿Qué hacen con mis datos?',
    answer:
      'Si te inscribes como paciente, tus datos se guardan en la institución para poder atenderte, y autorizas ese tratamiento en el último paso. Las otras dos opciones todavía no guardan nada.',
  },
];

const TEMAS_RAMA: readonly EliTopic[] = [
  {
    id: 'campos',
    question: '¿Qué pongo en este campo?',
    answer:
      'Cada campo trae un ejemplo debajo del título. Los que llevan asterisco son obligatorios: si te falta alguno, te lo señalo antes de continuar.',
  },
  {
    id: 'ubicacion',
    question: '¿Cómo elijo mi municipio?',
    answer:
      'Primero elige el departamento y así se activa la lista de municipios que le corresponden. La lista es la oficial del DANE y funciona sin conexión. El corregimiento lo escribes tú.',
  },
  {
    id: 'vecino',
    question: '¿Por qué piden un vecino?',
    answer:
      'Muchos pacientes viven en zonas de difícil acceso. Ese contacto solo se usa para ubicar al paciente cuando no responde llamadas o cuando hay que llegar a su casa.',
  },
  {
    id: 'limites',
    question: '¿Puedes resolver dudas médicas?',
    answer:
      'Puedo explicarte la pantalla y los campos, pero no soy médica: no diagnostico, no receto y no decido urgencias. Para eso está tu equipo de atención.',
  },
];

/** Identifica la pantalla visible: rama, paso y cierre. */
function clavePantalla(state: InscripcionState): string {
  return `${state.perfil ?? 'seleccion'}|${state.paso}|${state.terminada}`;
}

/** Identificador del anuncio del desenlace del envío. */
const ENVIO_ERROR_ID = 'inscripcion-envio-error';

interface InscripcionExperienceProps {
  /**
   * Abre la experiencia posterior del paciente. Solo se invoca después de que
   * el servidor confirme la inscripción: no transporta datos del paciente,
   * porque esa experiencia los recupera con su propia sesión.
   */
  readonly onEntrarComoPaciente: () => void;
  /** Fecha usada para calcular la edad. Se inyecta para poder probarla. */
  readonly hoy?: Date;
  /** Estado inicial alternativo; solo lo usan las pruebas de composición. */
  readonly estadoInicial?: InscripcionState;
  /** Envío inyectable; en producción llama a la API real. */
  readonly enviarInscripcion?: (
    request: PatientEnrollmentRequest,
  ) => Promise<EnrollmentOutcome>;
}

export function InscripcionExperience({
  onEntrarComoPaciente,
  hoy = new Date(),
  estadoInicial = ESTADO_INICIAL,
  enviarInscripcion = submitPatientEnrollment,
}: InscripcionExperienceProps): ReactNode {
  const [state, dispatch] = useReducer(inscripcionReducer, estadoInicial);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  // Pantalla ya anunciada. Se inicializa con la primera para no robar el foco
  // al cargar, y para no depender de cuántas veces se ejecute un efecto.
  const pantallaAnunciada = useRef(clavePantalla(estadoInicial));

  // Al fallar la validación, el foco va al primer control con error.
  useEffect(() => {
    if (state.campoFoco === null) {
      return;
    }
    document.getElementById(idCampo(state.campoFoco))?.focus();
  }, [state.campoFoco, state.focoNonce]);

  // Al cambiar de paso o de rama, el foco va al encabezado para anunciar el cambio.
  const clave = clavePantalla(state);
  useEffect(() => {
    if (pantallaAnunciada.current === clave) {
      return;
    }
    pantallaAnunciada.current = clave;
    tituloRef.current?.focus();
  }, [clave]);

  /*
   * Envío real de la rama Paciente (TASK-MVP-CORE-01 §8).
   *
   * Se dispara una sola vez por transición a «enviando»: el reductor ignora un
   * segundo intento mientras el envío está en curso y el botón queda
   * deshabilitado, de modo que no puede producirse un doble registro.
   */
  const enviando = state.envio.estado === 'enviando';
  const valoresPaciente =
    state.rama !== null && state.rama.perfil === 'paciente' ? state.rama.valores : null;

  // Los valores confirmados se leen por referencia: el envío debe usar
  // exactamente lo que había al confirmar y no volver a dispararse si algo
  // cambia mientras la petición está en curso.
  const valoresRef = useRef(valoresPaciente);
  valoresRef.current = valoresPaciente;

  useEffect(() => {
    const valores = valoresRef.current;
    if (!enviando || valores === null) {
      return;
    }

    let vigente = true;

    void enviarInscripcion(buildPatientEnrollmentRequest(valores)).then(
      (resultado) => {
        if (!vigente) {
          return;
        }
        if (resultado.kind === 'created') {
          dispatch({ type: 'envioExitoso' });
          return;
        }
        if (resultado.kind === 'conflict') {
          dispatch({ type: 'envioConflicto', mensaje: resultado.message });
          return;
        }
        dispatch({ type: 'envioFallido', mensaje: resultado.message });
      },
    );

    return () => {
      vigente = false;
    };
  }, [enviando, enviarInscripcion]);

  // Un desenlace fallido lleva el foco a su explicación para que se anuncie.
  const envioNonce = state.envio.nonce;
  const envioFallido = state.envio.estado === 'error' || state.envio.estado === 'conflicto';
  useEffect(() => {
    if (!envioFallido) {
      return;
    }
    document.getElementById(ENVIO_ERROR_ID)?.focus();
  }, [envioFallido, envioNonce]);

  const avisoDemostracion = (
    <p id={AVISO_DEMO_ID} className="merdn-sr-only">
      Control presente en el diseño aprobado que en esta demostración no ejecuta ninguna
      función.
    </p>
  );

  /*
   * Encabezado aprobado: logo corazón-check junto a la marca, con la jerarquía
   * original. Por decisión del Product Owner (TASK-002B, FR-01) la barra no
   * muestra al personaje: el símbolo aprobado es el único elemento gráfico que
   * acompaña a la marca. Por decisión del Product Owner (TASK-BRAND-01, FR-03)
   * el renglón inferior conserva su jerarquía pero ya no lleva subtítulo de
   * marca: dice únicamente «Panel de inscripción», sin separador residual.
   */
  const cabecera = (
    <div className={styles.brandBar}>
      <div className={styles.brandNames}>
        <p className={styles.brandWordmark}>
          <BrandLogo size={30} chip />
          <span>{branding.platformDisplayName}</span>
        </p>
        <p className={styles.brandTagline}>Panel de inscripción</p>
      </div>
    </div>
  );

  /* ------------------------- Entrada: elegir perfil ----------------------- */

  if (state.perfil === null || state.rama === null) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          {cabecera}
          {avisoDemostracion}

          <div className={styles.card}>
            <div className={styles.intro}>
              <h1 ref={tituloRef} tabIndex={-1} className={styles.title}>
                ¿Cómo se va a registrar?
              </h1>
              <p className={styles.lead}>
                Elija una opción. El formulario le mostrará solo lo que usted necesita llenar.
              </p>
            </div>

            <ul className={styles.profileList}>
              {PERFILES.map((perfil) => (
                <li key={perfil.id}>
                  <button
                    type="button"
                    className={styles.profileCard}
                    onClick={() => dispatch({ type: 'elegirPerfil', perfil: perfil.id })}
                  >
                    <span className={styles.profileTitle}>{perfil.titulo}</span>
                    <span className={styles.profileBody}>{perfil.descripcion}</span>
                  </button>
                </li>
              ))}
            </ul>

            <p className={styles.note}>
              La inscripción sirve para identificarlo, clasificarlo y ubicarlo. Los datos
              médicos detallados se registran después, en la bitácora y la historia clínica.
            </p>
          </div>
        </div>

        <EliBubble
          stepHelp="Elige si eres paciente, cuidador o visitador médico. Si cuidas a otra persona, eres cuidador."
          topics={TEMAS_SELECCION}
          {...ELI_ACTIVADOR}
        />
      </main>
    );
  }

  /* ------------------------------- Final ---------------------------------- */

  if (state.terminada) {
    const esVisitador = state.rama.perfil === 'visitador';
    const nombre = nombreCompleto(state.rama.valores);

    return (
      <main className={styles.page}>
        <div className={styles.container}>
          {cabecera}
          {avisoDemostracion}

          <div className={styles.doneCard}>
            <EliFigure intencion="agradece" size={130} className={styles.doneAvatar} />

            <h1 ref={tituloRef} tabIndex={-1} className={styles.doneTitle}>
              {esVisitador ? 'Registro recibido' : 'Inscripción completada'}
            </h1>

            {state.rama.perfil === 'visitador' ? (
              <>
                <p className={styles.doneBody}>
                  {`${nombre}, así se vería el cierre del registro de un visitador médico. En la aplicación real la información quedaría en verificación.`}
                </p>
                <p className={`${styles.doneBadge} ${styles.doneBadgePending}`}>
                  Pendiente de verificación
                </p>
              </>
            ) : null}

            {state.rama.perfil === 'paciente' ? (
              <>
                <p className={styles.doneBody}>
                  {`${nombre}, así termina la inscripción del paciente. Desde aquí puede ver el Inicio del Paciente.`}
                </p>
                <p className={styles.doneBadge}>{textoClasificacion(state.rama.valores)}</p>
              </>
            ) : null}

            {state.rama.perfil === 'cuidador' ? (
              <p className={styles.doneBody}>
                {`${nombre}, así termina la inscripción de un cuidador. No se vinculó ningún paciente.`}
              </p>
            ) : null}

            <p className={styles.demoNote}>
              {state.rama.perfil === 'paciente'
                ? 'Su inscripción quedó registrada en la institución. No se creó una contraseña ni una cuenta permanente: esta sesión caduca y no verifica su identidad ante ninguna autoridad.'
                : 'Cierre local de la demostración: no se creó ninguna cuenta, no se guardó ni se envió información y no se verificó ningún dato.'}
            </p>

            <div className={styles.doneActions}>
              {state.rama.perfil !== 'paciente' ? (
                <Link className={styles.actionNext} href="/acceso?accion=registro">
                  Enviar solicitud de acceso al Hospital
                </Link>
              ) : null}
              {state.rama.perfil === 'paciente' ? (
                <button
                  type="button"
                  className={styles.actionNext}
                  onClick={() => onEntrarComoPaciente()}
                >
                  {`Ver el Inicio del Paciente en ${platformNameInSentence()}`}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.actionSwitch}
                onClick={() => dispatch({ type: 'reiniciar' })}
              >
                Volver a empezar la inscripción
              </button>
            </div>
          </div>
        </div>

        <EliBubble
          stepHelp="Puedo explicarte qué pasaría después del registro en la aplicación real."
          topics={TEMAS_RAMA}
          {...ELI_ACTIVADOR}
        />
      </main>
    );
  }

  /* ------------------------------ Rama activa ------------------------------ */

  const { perfil, paso, rama } = state;
  const titulos = TITULOS_PASO[perfil];
  const tituloPaso = titulos[paso - 1] ?? '';
  const porcentaje = Math.round((paso / TOTAL_PASOS) * 100);
  const ayuda = AYUDA_PASO[perfil][paso - 1] ?? '';

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {cabecera}
        {avisoDemostracion}

        <div className={styles.stepCard}>
          <div className={styles.stepHead}>
            <div>
              <p className={styles.stepBranch}>{ETIQUETA_RAMA[perfil]}</p>
              <h1 ref={tituloRef} tabIndex={-1} className={styles.stepTitle}>
                {tituloPaso}
              </h1>
            </div>
            <p className={styles.stepCounter}>{`Paso ${paso} de ${TOTAL_PASOS}`}</p>
          </div>

          <div
            className={styles.stepTrack}
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL_PASOS}
            aria-valuenow={paso}
            aria-valuetext={`Paso ${paso} de ${TOTAL_PASOS}`}
          >
            <div className={styles.stepFill} style={{ width: `${porcentaje}%` }} />
          </div>

          <ul className={styles.stepDots} aria-label="Ir a un paso de la inscripción">
            {titulos.map((titulo, indice) => {
              const numero = indice + 1;
              const activo = numero === paso;
              return (
                <li key={titulo}>
                  <button
                    type="button"
                    className={
                      activo ? `${styles.stepDot} ${styles.stepDotActive}` : styles.stepDot
                    }
                    aria-current={activo ? 'step' : undefined}
                    onClick={() => dispatch({ type: 'irAPaso', paso: numero })}
                  >
                    {`${numero}. ${titulo}`}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {rama.perfil === 'paciente' ? (
          <PasosPaciente
            paso={paso}
            valores={rama.valores}
            errores={state.errores}
            dispatch={dispatch}
            avisoId={AVISO_DEMO_ID}
            hoy={hoy}
          />
        ) : null}

        {rama.perfil === 'cuidador' ? (
          <PasosCuidador
            paso={paso}
            valores={rama.valores}
            errores={state.errores}
            dispatch={dispatch}
            avisoId={AVISO_DEMO_ID}
            hoy={hoy}
          />
        ) : null}

        {rama.perfil === 'visitador' ? (
          <PasosVisitador
            paso={paso}
            valores={rama.valores}
            errores={state.errores}
            dispatch={dispatch}
            avisoId={AVISO_DEMO_ID}
            hoy={hoy}
          />
        ) : null}

        {state.envio.mensaje === null ? null : (
          <div tabIndex={-1} id={ENVIO_ERROR_ID}>
            <FieldError id={`${ENVIO_ERROR_ID}-texto`}>{state.envio.mensaje}</FieldError>
          </div>
        )}

        <p className="merdn-sr-only" role="status" aria-live="polite">
          {enviando ? 'Enviando la inscripción. Espere un momento.' : ''}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionBack}
            disabled={enviando}
            onClick={() => dispatch({ type: 'atras' })}
          >
            Atrás
          </button>
          <button
            type="button"
            className={styles.actionNext}
            disabled={enviando}
            aria-busy={enviando || undefined}
            onClick={() => dispatch({ type: 'siguiente' })}
          >
            {paso >= TOTAL_PASOS
              ? enviando
                ? 'Enviando su inscripción…'
                : ACCION_FINAL[perfil]
              : 'Continuar'}
          </button>
        </div>

        <button
          type="button"
          className={styles.actionSwitch}
          onClick={() => dispatch({ type: 'reiniciar' })}
        >
          Cambiar de rol
        </button>
      </div>

      <EliBubble stepHelp={ayuda} topics={TEMAS_RAMA} {...ELI_ACTIVADOR} />
    </main>
  );
}
