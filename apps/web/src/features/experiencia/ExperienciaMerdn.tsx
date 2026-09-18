'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { DeviceStatusBar, PhoneFrame, Screen } from '@/components/ui/PhoneShell';
import {
  CONTEXTOS_HUMANOS,
  consultarSesionHumana,
  urlDeLoginHumano,
} from '@/features/auth/humanSessionClient';
import type { EstadoSesionHumana } from '@/features/auth/humanSessionClient';
import { InscripcionExperience } from '@/features/inscripcion/InscripcionExperience';
import { fetchCurrentPatient } from '@/features/inscripcion/patientEnrollmentClient';
import type { PatientSummary } from '@/features/inscripcion/patientEnrollmentClient';
import {
  PORTAL_INICIAL,
  PacienteExperience,
  conSesionPaciente,
} from '@/features/paciente/PacienteExperience';

import styles from '@/features/paciente/paciente.module.css';

/**
 * Raíz de la aplicación web y ÚNICA conmutación de fase de `/`
 * (TASK-002A; spec 021 §17.C-1, micro-paquete 5).
 *
 * `/` tiene TRES fases, y la frontera entre la segunda y la tercera es la
 * decisión de producto que esta spec cerró:
 *
 * 1. INSCRIPCIÓN — la pantalla aprobada «¿Cómo se va a registrar?». No cambia.
 * 2. INSCRIPCIÓN COMPLETADA — confirmación de que la inscripción quedó
 *    registrada, MÁS una entrada SEPARADA «Ingresar como Paciente». Aquí no hay
 *    resumen, no hay citas y no hay visitas.
 * 3. PORTAL PACIENTE — la experiencia autenticada, y solo cuando el SERVIDOR
 *    confirma sesión humana OIDC vigente CON contexto `PATIENT`.
 *
 * LA COOKIE DE INSCRIPCIÓN NO ABRE EL PORTAL. Confirma y completa la
 * inscripción, y nada más: no es sesión permanente, no otorga acceso a ninguna
 * cita ni visita, y llevar a la fase 2 es TODO lo que puede hacer (§6.6-a a
 * §6.6-c, §17.C-1). Pretender lo contrario es una STOP CONDITION (§19.13). Por
 * eso las dos comprobaciones son INDEPENDIENTES y se leen por separado: la de
 * inscripción decide entre la fase 1 y la 2, y solo la sesión humana abre la 3.
 *
 * NO SE CREA `/paciente`. Se conserva `/` precisamente para no ampliar la
 * allowlist de retornos del servidor (§17.B-3, §19.4).
 *
 * No se guarda paciente, token ni dato personal en `localStorage`,
 * `sessionStorage`, IndexedDB ni en la URL. Un identificador en la URL no
 * concede acceso a ningún registro.
 */

/** Las tres fases de `/`. La tercera NO se alcanza sin sesión humana. */
type Fase = 'inscripcion' | 'inscripcion-completada' | 'portal';

/** Texto visible de la fase 2. No contiene ningún dato de la persona. */
export const TEXTO_ENTRADA_PACIENTE = {
  titulo: 'Inscripción completada',
  cuerpo:
    'Su inscripción quedó registrada en la institución. Terminar la inscripción no abre su espacio de paciente.',
  aclaracion:
    'Para ver sus citas y sus visitas debe ingresar con su cuenta. Es un acceso distinto del formulario de inscripción.',
  entrar: 'Ingresar como Paciente',
  entrarAyuda:
    'Abre el acceso seguro con su cuenta. Le pedirá identificarse antes de mostrar cualquier información suya.',
  volver: 'Volver a la inscripción',
} as const;

const ENTRAR_AYUDA_ID = 'entrada-paciente-ayuda';

/**
 * Pantalla de la fase 2: confirmación Y entrada separada.
 *
 * Son dos cosas distintas a propósito (§17.C-1). La confirmación cierra la
 * inscripción; la entrada abre —y solo abre— el acceso autenticado. Aquí no se
 * pinta ningún dato de la persona: la minimización empieza por no traer a la
 * pantalla lo que no hace falta para decidir.
 *
 * El acceso es un ENLACE, no un botón: el flujo OIDC responde con una
 * redirección hacia el proveedor de identidad, y solo una navegación real puede
 * completarlo.
 */
export function EntradaPaciente({
  urlLogin,
  onVolver,
}: {
  readonly urlLogin: string;
  readonly onVolver: () => void;
}): ReactNode {
  return (
    <main className={styles.stage}>
      <div>
        <PhoneFrame>
          <Screen tone="lienzo">
            <DeviceStatusBar tone="marca" />

            <div className={styles.portalScroll}>
              <section className={styles.portalCard} aria-labelledby="entrada-paciente">
                <h1 id="entrada-paciente" className={styles.portalTitulo}>
                  {TEXTO_ENTRADA_PACIENTE.titulo}
                </h1>
                <p className={styles.portalNota}>{TEXTO_ENTRADA_PACIENTE.cuerpo}</p>
                <p className={styles.portalNota}>{TEXTO_ENTRADA_PACIENTE.aclaracion}</p>
              </section>

              <div className={styles.portalAcciones}>
                <a
                  className={styles.portalEnlace}
                  href={urlLogin}
                  aria-describedby={ENTRAR_AYUDA_ID}
                >
                  {TEXTO_ENTRADA_PACIENTE.entrar}
                </a>
                <span className="merdn-sr-only" id={ENTRAR_AYUDA_ID}>
                  {TEXTO_ENTRADA_PACIENTE.entrarAyuda}
                </span>

                <Button variant="quietMuted" onClick={onVolver}>
                  {TEXTO_ENTRADA_PACIENTE.volver}
                </Button>
              </div>
            </div>
          </Screen>
        </PhoneFrame>
      </div>
    </main>
  );
}

/**
 * Fase que corresponde a un desenlace de la comprobación de sesión HUMANA.
 *
 * Función PURA. Distingue DOS cosas que no son la misma:
 *
 * - quién ve DATOS: solo `activa-con-contexto`, y la experiencia autenticada
 *   se lo dice al servidor otra vez antes de pintar nada;
 * - quién merece una RESPUESTA: también `activa-sin-contexto` y
 *   `no-disponible`. Hay sesión humana, el servidor contestó algo concreto, y
 *   devolver a esa persona a la inscripción sería contestarle otra cosa. Se
 *   monta la experiencia en su estado aprobado —«acceso no autorizado» o «no
 *   disponible»—, sin un solo dato del paciente en pantalla (§6.12).
 *
 * `sin-sesion` deja a la persona FUERA del portal autenticado, en la
 * inscripción o en su confirmación con la entrada «Ingresar como Paciente»
 * (§17.C-1). `cancelado` no fabrica estado: cambiar de pantalla no es un
 * desenlace que anunciar.
 *
 * Ninguna cookie de inscripción entra en esta decisión: el único parámetro es
 * lo que respondió la superficie de sesión humana.
 */
export function faseDeSesionHumana(sesion: EstadoSesionHumana): Fase | null {
  switch (sesion) {
    case 'activa-con-contexto':
    case 'activa-sin-contexto':
    case 'no-disponible':
      return 'portal';
    case 'sin-sesion':
    case 'cancelado':
    default:
      return null;
  }
}

interface ExperienciaMerdnProps {
  /** Recuperación de la INSCRIPCIÓN; en producción, `GET /patients/me`. */
  readonly recuperarPaciente?: () => Promise<PatientSummary | null>;
  /** Comprobación de la SESIÓN HUMANA; en producción, `GET /human-auth/session`. */
  readonly comprobarSesionHumana?: () => Promise<EstadoSesionHumana>;
  /** URL del inicio OIDC. Inyectable para que las pruebas no dependan del entorno. */
  readonly urlLogin?: string;
  /**
   * Fase inicial alternativa. Solo la usan las pruebas de render, del mismo
   * modo que `InscripcionExperience` admite un estado inicial. En producción
   * siempre es `undefined` y la fase inicial es la Inscripción.
   */
  readonly faseInicial?: Fase;
  /**
   * Desenlace de sesión con el que arranca la experiencia autenticada. Lo fija
   * la comprobación real; las pruebas de render lo inyectan porque
   * `renderToStaticMarkup` no ejecuta efectos.
   */
  readonly sesionInicial?: EstadoSesionHumana;
}

export function ExperienciaMerdn({
  recuperarPaciente = fetchCurrentPatient,
  comprobarSesionHumana,
  urlLogin,
  faseInicial = 'inscripcion',
  sesionInicial = 'activa-con-contexto',
}: ExperienciaMerdnProps = {}): ReactNode {
  const [fase, setFase] = useState<Fase>(faseInicial);
  /*
   * Desenlace de la comprobación inicial. Se conserva para que la experiencia
   * arranque YA en su estado aprobado y no parpadee «comprobando» antes de
   * decir lo que el servidor acaba de contestar.
   */
  const [sesionHumana, setSesionHumana] = useState<EstadoSesionHumana>(sesionInicial);
  const vigente = useRef(true);

  const destinoLogin = urlLogin ?? urlDeLoginHumano();

  useEffect(() => {
    vigente.current = true;
    return () => {
      vigente.current = false;
    };
  }, []);

  /*
   * Comprobación de la SESIÓN HUMANA. Es la única que puede abrir el portal, y
   * pregunta EXPRESAMENTE por el contexto `PATIENT`: los contextos no se suman
   * y una sesión profesional no vale aquí.
   */
  const comprobarSesion = useCallback(async (): Promise<void> => {
    const consulta =
      comprobarSesionHumana ??
      (async (): Promise<EstadoSesionHumana> =>
        consultarSesionHumana(CONTEXTOS_HUMANOS.paciente));

    const sesion = await consulta();
    const destino = faseDeSesionHumana(sesion);

    if (vigente.current && destino !== null) {
      setSesionHumana(sesion);
      setFase(destino);
    }
  }, [comprobarSesionHumana]);

  /*
   * Al cargar la página se preguntan las DOS cosas, por separado:
   *
   * - la sesión humana, que puede abrir el portal;
   * - la inscripción vigente, que como MUCHO lleva a la confirmación.
   *
   * El orden importa: si la sesión humana ya abrió el portal, la comprobación
   * de inscripción NO lo cierra ni lo degrada.
   */
  useEffect(() => {
    void comprobarSesion();

    void recuperarPaciente().then((paciente) => {
      if (vigente.current && paciente !== null) {
        setFase((previa) => (previa === 'inscripcion' ? 'inscripcion-completada' : previa));
      }
    });
  }, [comprobarSesion, recuperarPaciente]);

  if (fase === 'portal') {
    return (
      <PacienteExperience
        urlLogin={destinoLogin}
        estadoInicial={conSesionPaciente(PORTAL_INICIAL, sesionHumana)}
      />
    );
  }

  if (fase === 'inscripcion-completada') {
    return (
      <EntradaPaciente
        urlLogin={destinoLogin}
        onVolver={() => {
          setFase('inscripcion');
        }}
      />
    );
  }

  /*
   * `onEntrarComoPaciente` es el control que la pantalla de cierre de la
   * inscripción ya ofrecía. Ahora lleva a la CONFIRMACIÓN con su entrada
   * separada, y NO al portal: terminar la inscripción no autentica a nadie.
   */
  return (
    <InscripcionExperience
      onEntrarComoPaciente={() => {
        setFase('inscripcion-completada');
      }}
    />
  );
}
