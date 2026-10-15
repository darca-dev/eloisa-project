"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { branding } from "@/config/branding";
import { EliFigure, eliAvatarAlt } from "@/components/ui/Eli";
import {
  RUTAS_EXPERIENCIA,
  consultarExperienciasAprobadas,
  filtrarExperienciasPersonales,
  urlDeLoginHumano,
  type ExperienciaPersonal,
} from "@/features/auth/humanSessionClient";
import { AccessRegistrationWizard } from "./AccessRegistrationWizard";
import styles from "./centralAccessRedesign.module.css";

/**
 * Acceso de pacientes, cuidadores y visitadores médicos (SPEC 038, MP04).
 *
 * DOS RAMAS y ninguna más:
 *
 * - `accion=registro` monta `AccessRegistrationWizard`: inscripcion guiada por
 *   perfil (selector, cinco pasos, confirmación) que envía los datos declarados
 *   al endpoint persistente y muestra la referencia opaca que el
 *   servidor devuelve;
 * - el resto es el SELECTOR de experiencias que MP04 exige. Al volver del flujo
 *   OIDC consulta `GET /api/v1/me/experiences` en el servidor —nunca en el
 *   navegador— y conserva solo perfiles personales: uno redirige, varios
 *   muestran un selector y ninguno muestra una denegación neutral (050).
 *
 * QUÉ NO HACE:
 *
 * - NO decide perfiles mirando claims, tokens ni el historial del navegador. La
 *   lista de experiencias viene del servidor y el navegador solo la pinta;
 * - NO abre `/cuidador` ni `/profesional` como muestras visuales: esas rutas
 *   quedan protegidas y el único camino hacia ellas es una sesión con la
 *   experiencia aprobada correspondiente;
 * - NO ofrece un segundo inicio de sesión ni una credencial propia. Hay UNA URL
 *   OIDC, la misma para todos, y no existe reemplazo;
 * - NO persiste nada. La experiencia elegida no se guarda: si se recarga, se
 *   vuelve a preguntar al servidor.
 *
 * ACCESIBILIDAD: la consulta es asíncrona y sus cinco desenlaces son mutuamente
 * excluyentes y visibles. El cambio de estado se anuncia por una región
 * `aria-live="polite"`, el bloque que recibe el foco es enfocable con
 * `tabIndex={-1}` para que un lector de pantalla no se quede en el título
 * anterior, y todas las acciones son enlaces o botones reales, alcanzables con
 * teclado y con texto discernible.
 */

/** Los CINCO estados del selector. Mutuamente excluyentes. */
type Fase =
  | "consultando"
  | "sin-sesion"
  | "indisponible"
  | "denegado"
  | "selector"
  | "redirigiendo";

const EXPERIENCIAS_LABEL: Readonly<Record<ExperienciaPersonal, string>> = {
  PATIENT: "Paciente",
  CAREGIVER: "Cuidador",
  FIELD_PROFESSIONAL: "Visitador médico",
};

const AVISOS: Readonly<Record<Fase, string>> = {
  consultando: "Comprobando sus experiencias aprobadas…",
  "sin-sesion": "",
  indisponible: "No fue posible comprobar sus experiencias en este momento.",
  denegado: "Su cuenta no tiene un perfil personal aprobado.",
  selector: "Varias experiencias están aprobadas. Elija cuál desea abrir.",
  redirigiendo: "Abriendo su espacio…",
};

export function CentralAccess(): ReactNode {
  const search = useSearchParams();
  const registration = search.get("accion") === "registro";
  const router = useRouter();

  const [fase, setFase] = useState<Fase>("consultando");
  const [experiencias, setExperiencias] = useState<
    readonly ExperienciaPersonal[]
  >([]);
  const bloqueRef = useRef<HTMLDivElement | null>(null);

  const consultar = useCallback(async (): Promise<void> => {
    setFase("consultando");
    setExperiencias([]);

    const desenlace = await consultarExperienciasAprobadas();

    switch (desenlace.kind) {
      case "sin-sesion":
        // Primera visita o sesión caducada: se muestra el acceso normal.
        setFase("sin-sesion");
        return;
      case "ok": {
        const personales = filtrarExperienciasPersonales(desenlace.experiencias);
        if (personales.length === 0) {
          // Hay persona y ninguna aprobación: denegación neutral, sin motivo.
          setFase("denegado");
          return;
        }

        setExperiencias(personales);
        setFase(
          personales.length === 1 ? "redirigiendo" : "selector",
        );
        return;
      }
      default:
        setFase("indisponible");
    }
  }, []);

  useEffect(() => {
    if (registration) {
      return;
    }

    void consultar();
  }, [consultar, registration]);

  /*
   * La redirección va en un EFECTO aparte y no dentro del `switch`: hacer
   * `router.replace` mientras se está renderizando el cambio de estado acopla la
   * navegación al render y deja la pantalla en un estado que ya no existe.
   */
  useEffect(() => {
    if (fase !== "redirigiendo" || experiencias.length !== 1) {
      return;
    }

    const unica = experiencias[0];

    if (unica !== undefined) {
      router.replace(RUTAS_EXPERIENCIA[unica]);
    }
  }, [fase, experiencias, router]);

  /* El Portal Central ya separa iniciar sesión de registrarse. */
  useEffect(() => {
    if (fase === "sin-sesion") {
      window.location.assign(urlDeLoginHumano());
    }
  }, [fase]);

  /*
   * FOCO: cuando el selector cambia de una pantalla a otra, el foco se mueve al
   * bloque nuevo. Sin esto, quien navega con teclado o con lector de pantalla se
   * queda en el enlace «Volver» de la tarjeta anterior y no se entera de que
   * ahora hay una lista que elegir.
   */
  useEffect(() => {
    if (fase === "sin-sesion" || registration) {
      return;
    }

    bloqueRef.current?.focus();
  }, [fase, registration]);

  if (registration) {
    return <AccessRegistrationWizard />;
  }


  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="central-access-title">
        <header className={styles.brandHeader}>
          <div className={styles.brand}>
            <Image
              src="/brand/corazon-check.png"
              alt={`Símbolo de ${branding.platformDisplayName}`}
              width={54}
              height={54}
            />
            <div>
              <strong>{branding.platformDisplayName}</strong>
              <span>Atención Domiciliaria</span>
            </div>
          </div>
          <span className={styles.headerAccent} aria-hidden="true" />
        </header>

        <div className={styles.accessGrid}>
          <aside
            className={styles.eliPanel}
            aria-label="Perfiles de Atención Domiciliaria"
          >
            <Link className={styles.back} href="/">
              ← Volver al Portal Central
            </Link>

            <div className={styles.eliHalo}>
              <EliFigure
                alt={eliAvatarAlt("saluda")}
                className={styles.eliSaluda}
                intencion="saluda"
                size={260}
              />
            </div>

            <div className={styles.roleList} aria-label="Perfiles disponibles">
              <div className={`${styles.roleChip} ${styles.patientChip}`}><span aria-hidden="true">P</span><strong>Paciente</strong></div>
              <div className={`${styles.roleChip} ${styles.caregiverChip}`}><span aria-hidden="true">C</span><strong>Cuidador</strong></div>
              <div className={`${styles.roleChip} ${styles.visitorChip}`}><span aria-hidden="true">V</span><strong>Visitador médico</strong></div>
            </div>
          </aside>

          <section
            className={styles.loginPanel}
            aria-labelledby="human-access-title"
          >
            <p className={styles.eyebrow}>ATENCIÓN DOMICILIARIA</p>
            <h1 id="central-access-title">Bienvenido</h1>
            <h2 id="human-access-title">Inicia sesión para continuar</h2>
            <p className={styles.lead}>
              Acceso para pacientes, cuidadores y visitadores médicos.
            </p>

              <div className={styles.liveRegion} aria-live="polite">
                {AVISOS[fase] === "" ? null : <p>{AVISOS[fase]}</p>}
              </div>


            {fase === "sin-sesion" ? (
              <div className={styles.statusPanel} ref={bloqueRef} tabIndex={-1}>
                Abriendo el formulario seguro de correo y contraseña…
              </div>
            ) : null}

            {fase === "consultando" ? (
              <div className={styles.statusPanel} ref={bloqueRef} tabIndex={-1}>
                Comprobando sus experiencias aprobadas…
              </div>
            ) : null}

            {fase === "redirigiendo" ? (
              <div className={styles.statusPanel} ref={bloqueRef} tabIndex={-1}>
                Abriendo su espacio… Si la página no cambia,{" "}
                <a href={RUTAS_EXPERIENCIA[experiencias[0] ?? "PATIENT"]}>
                  continúe aquí
                </a>
                .
              </div>
            ) : null}

            {fase === "selector" ? (
              <div className={styles.choices} ref={bloqueRef} tabIndex={-1}>
                {experiencias.map((experiencia) => (
                  <Link
                    className={styles.roleCard}
                    href={RUTAS_EXPERIENCIA[experiencia]}
                    key={experiencia}
                  >
                    <strong>{EXPERIENCIAS_LABEL[experiencia]}</strong>
                    <span>
                      Abrir el espacio{" "}
                      {EXPERIENCIAS_LABEL[experiencia].toLowerCase()}.
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}

            {fase === "denegado" ? (
              <div ref={bloqueRef} tabIndex={-1}>
                <p className={styles.errorMessage}>
                  Su cuenta no tiene un perfil personal aprobado. Ingrese con
                  otra cuenta o registre una solicitud para Atención Domiciliaria.
                </p>
                <a className={styles.textLink} href={urlDeLoginHumano()}>
                  Ingresar con otra cuenta
                </a>{" "}
                <Link
                  className={styles.textLink}
                  href="/acceso?accion=registro"
                >
                  Regístrate
                </Link>
              </div>
            ) : null}

            {fase === "indisponible" ? (
              <div ref={bloqueRef} tabIndex={-1}>
                <p className={styles.errorMessage}>
                  No fue posible comprobar sus experiencias aprobadas. No se
                  muestra ningún espacio porque no hay una respuesta del
                  servidor.
                </p>
                <button
                  className={styles.secondary}
                  onClick={() => void consultar()}
                  type="button"
                >
                  Volver a intentar
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
