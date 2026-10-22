'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { branding } from '@/config/branding';
import {
  CONTEXTOS_HUMANOS,
  cerrarSesionHumana,
  cierreHumanoConfirmado,
  consultarExperienciasAprobadas,
  consultarSesionHumana,
  urlDeLoginHumano,
} from '@/features/auth/humanSessionClient';
import { CareWorkspace } from '@/features/care/CareWorkspace';
import styles from './caregiverAccessPortal.module.css';

/**
 * Portada protegida del Cuidador (SPEC 038, MP04 §12).
 *
 * `/cuidador` deja de ser una muestra visual y pasa a ser una de las tres
 * rutas cerradas por el selector de `/acceso`. Esta envoltura resuelve DOS
 * preguntas distintas, en este orden, y ninguna se contesta en el navegador:
 *
 * 1. ¿la institución APROBÓ la experiencia `CAREGIVER` para esta cuenta?
 *    Se pregunta a `GET /api/v1/me/experiences`. Sin ella no se abre nada;
 * 2. ¿la persona tiene una RELACIÓN de cuidado activa? Se pregunta a
 *    `GET /api/v1/me/contexts` exigiendo el contexto `CAREGIVER`, que el
 *    servidor solo emite cuando existe esa relación.
 *
 * La segunda pregunta es la que produce la portada NEUTRA: una cuenta aprobada
 * SIN relación ve la pantalla completa pero SIN ningún dato nominal —ni nombre,
 * ni liquidación, ni identificador— porque no hay nadie sobre quien cuidar. La
 * experiencia por sí sola no autoriza a mirar a nadie: eso es exactamente lo
 * que distingue «a qué portada se entra» de «sobre quién se cuida».
 *
 * QUÉ NO HACE: no guarda nada, no lee la cookie, no decide por el historial ni
 * por la URL, no ofrece un segundo inicio de sesión y no muestra motivos,
 * identificadores ni detalles técnicos en una denegación.
 *
 * ACCESIBILIDAD: los seis estados son mutuamente excluyentes y visibles; los
 * cambios se anuncian por una región `aria-live="polite"`, el bloque nuevo
 * recibe el foco con `tabIndex={-1}` y todas las acciones son enlaces o
 * botones reales, alcanzables con teclado y con texto discernible.
 */

/** Los SEIS estados de la portada. Mutuamente excluyentes. */
type Fase =
  | 'consultando'
  | 'sin-sesion'
  | 'sin-experiencia'
  | 'sin-relacion'
  | 'indisponible'
  | 'autorizado';

const AVISOS: Readonly<Record<Fase, string>> = {
  consultando: 'Comprobando su experiencia aprobada…',
  'sin-sesion': 'No hay una sesión abierta.',
  'sin-experiencia': 'Su cuenta no tiene acceso a esta experiencia.',
  'sin-relacion':
    'Su cuenta está aprobada como cuidador, pero no tiene ninguna relación de cuidado activa.',
  indisponible: 'No fue posible comprobar su acceso en este momento.',
  autorizado: 'Su sesión está abierta.',
};

/** Estado del cierre. `no-confirmado` deja la sesión EN PIE y lo dice. */
type EstadoCierre = 'inactivo' | 'en-curso' | 'no-confirmado';

const CIERRE_TEXTO: Readonly<Record<EstadoCierre, string>> = {
  inactivo: '',
  'en-curso': 'Cerrando su sesión.',
  'no-confirmado':
    'No se pudo cerrar la sesión: su sesión SIGUE ABIERTA. Inténtelo de nuevo antes de dejar el dispositivo.',
};

export function CaregiverAccessPortal(): ReactNode {
  const [fase, setFase] = useState<Fase>('consultando');
  const [cierre, setCierre] = useState<EstadoCierre>('inactivo');
  const bloqueRef = useRef<HTMLDivElement | null>(null);

  const consultar = useCallback(async (): Promise<void> => {
    setFase('consultando');

    const experiencias = await consultarExperienciasAprobadas();

    if (experiencias.kind === 'sin-sesion') {
      setFase('sin-sesion');
      return;
    }

    if (experiencias.kind !== 'ok') {
      setFase('indisponible');
      return;
    }

    if (!experiencias.experiencias.includes('CAREGIVER')) {
      setFase('sin-experiencia');
      return;
    }

    const sesion = await consultarSesionHumana(CONTEXTOS_HUMANOS.cuidador);

    switch (sesion) {
      case 'activa-con-contexto':
        setFase('autorizado');
        return;
      case 'activa-sin-contexto':
        setFase('sin-relacion');
        return;
      case 'sin-sesion':
        setFase('sin-sesion');
        return;
      default:
        setFase('indisponible');
    }
  }, []);

  useEffect(() => {
    void consultar();
  }, [consultar]);

  /*
   * CIERRE (§5.5). Dos comprobaciones y ninguna promesa: el estado pasa a
   * `en-curso` solo mientras la llamada está en vuelo, y `no-confirmado` se
   * queda en pantalla cuando el servidor no confirma —esconder una sesión que
   * sigue abierta haría creer que se cerró—. El desenlace confirmado retira la
   * portada por completo.
   */
  const cerrar = useCallback(async (): Promise<void> => {
    setCierre('en-curso');

    const desenlace = await cerrarSesionHumana();

    if (cierreHumanoConfirmado(desenlace)) {
      setCierre('inactivo');
      setFase('sin-sesion');
      return;
    }

    if (desenlace !== 'cancelado') {
      setCierre('no-confirmado');
    }
  }, []);

  /*
   * FOCO: al cambiar de estado el foco se mueve al bloque nuevo. Sin esto,
   * quien navega con teclado o con lector de pantalla se quedaría en el enlace
   * anterior y no se enteraría de que ahora hay una denegación o una lista.
   */
  useEffect(() => {
    if (fase === 'sin-sesion') {
      return;
    }

    bloqueRef.current?.focus();
  }, [fase]);

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="cuidador-portal-title">
        <div className={styles.brand}>
          <Image
            src="/brand/corazon-check.png"
            alt={`Símbolo de ${branding.platformDisplayName}`}
            width={42}
            height={42}
          />
          <div>
            <strong>{branding.platformDisplayName}</strong>
            <span>Portal del cuidador</span>
          </div>
        </div>

        <h1 className={styles.titulo} id="cuidador-portal-title">
          Portal del cuidador
        </h1>

        <div className={styles.liveRegion} aria-live="polite">
          <p className={fase === 'sin-experiencia' || fase === 'indisponible' ? styles.error : styles.aviso}>
            {AVISOS[fase]}
          </p>
        </div>

        {fase === 'sin-sesion' ? (
          <div ref={bloqueRef} tabIndex={-1}>
            <p className={styles.texto}>
              Entra con la referencia de tu solicitud. MERDN no guarda ni pide aquí ninguna
              contraseña: el inicio de sesión ocurre en el proveedor de identidad.
            </p>
            <div className={styles.acciones}>
              <a className={styles.primary} href={urlDeLoginHumano()}>
                Iniciar sesión
              </a>
              <Link className={styles.secondary} href="/acceso">
                Volver a experiencias
              </Link>
            </div>
          </div>
        ) : null}

        {fase === 'sin-experiencia' || fase === 'indisponible' ? (
          <div ref={bloqueRef} tabIndex={-1}>
            <p className={styles.texto}>
              {fase === 'sin-experiencia'
                ? 'Consulte con la institución que lo atiende si considera que debe tener acceso.'
                : 'No se muestra ningún espacio porque no hay una respuesta del servidor.'}
            </p>
            <div className={styles.acciones}>
              {fase === 'indisponible' ? (
                <button className={styles.secondary} onClick={() => void consultar()} type="button">
                  Volver a intentar
                </button>
              ) : null}
              <Link className={styles.secondary} href="/">
                Volver al Portal Central
              </Link>
            </div>
          </div>
        ) : null}

        {fase === 'sin-relacion' ? (
          <div ref={bloqueRef} tabIndex={-1}>
            <p className={styles.texto}>
              Todavía no hay ninguna persona a su cargo. Cuando la institución registre una
              relación de cuidado, aparecerá aquí su información.
            </p>
            <div className={styles.acciones}>
              <Link className={styles.secondary} href="/">
                Volver al Portal Central
              </Link>
            </div>
          </div>
        ) : null}

        {fase === 'autorizado' ? (
          <div className={styles.contenido} ref={bloqueRef} tabIndex={-1}>
            <div className={styles.acciones}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void cerrar()}
                disabled={cierre === 'en-curso'}
              >
                Cerrar sesión
              </button>
            </div>

            <p aria-live="polite" className={cierre === 'no-confirmado' ? styles.error : undefined}>
              {CIERRE_TEXTO[cierre]}
            </p>

            {/*
             * SPEC 055 / MP02–MP03: bitácora real, solicitud manual y seguimiento
             * del contexto autorizado. La demostración de liquidaciones se
             * conserva como archivo de referencia del alcance financiero futuro,
             * pero ya no es el contenido operativo de esta portada.
             */}
            <CareWorkspace perfil="cuidador" />
          </div>
        ) : null}
      </section>
    </main>
  );
}
