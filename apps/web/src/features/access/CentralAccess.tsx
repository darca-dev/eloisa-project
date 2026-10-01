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
  urlDeLoginHumano,
  type ExperienciaAprobada,
} from "@/features/auth/humanSessionClient";
import { AccessRegistrationWizard } from "./AccessRegistrationWizard";
import styles from "./centralAccessRedesign.module.css";

/**
 * Acceso de pacientes, cuidadores y visitadores médicos (SPEC 038, MP04).
 *
 * DOS RAMAS y ninguna más:
 *
 * - `accion=registro` monta `AccessRegistrationWizard`: inscripcion guiada por
 *   perfil (selector, tres pasos, confirmacion) que envia la solicitud de datos
 *   ficticios al endpoint persistente y muestra la referencia opaca que el
 *   servidor devuelve;
 * - el resto es el SELECTOR de experiencias que MP04 exige. Al volver del flujo
 *   OIDC consulta `GET /api/v1/me/experiences` en el servidor —nunca en el
 *   navegador— y decide: una experiencia redirige, varias muestran un selector y
 *   ninguna muestra una denegación neutral.
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

const EXPERIENCIAS_LABEL: Readonly<Record<ExperienciaAprobada, string>> = {
  PATIENT: "Paciente",
  CAREGIVER: "Cuidador",
  FIELD_PROFESSIONAL: "Visitador médico",
};

const AVISOS: Readonly<Record<Fase, string>> = {
  consultando: "Comprobando sus experiencias aprobadas…",
  "sin-sesion": "",
  indisponible: "No fue posible comprobar sus experiencias en este momento.",
  denegado: "Su cuenta no tiene ninguna experiencia aprobada.",
  selector: "Varias experiencias están aprobadas. Elija cuál desea abrir.",
  redirigiendo: "Abriendo su espacio…",
};

export interface CentralAccessProps {
  /** Recorrido de presentación fijo, habilitado únicamente por el servidor local. */
  readonly modoDemoLocal?: boolean;
}

export function CentralAccess({ modoDemoLocal = false }: CentralAccessProps): ReactNode {
  const search = useSearchParams();
  const registration = search.get("accion") === "registro";
  const router = useRouter();

  const [fase, setFase] = useState<Fase>("consultando");
  const [experiencias, setExperiencias] = useState<
    readonly ExperienciaAprobada[]
  >([]);
  const [perfilDemo, setPerfilDemo] = useState<ExperienciaAprobada | null>(null);
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
      case "ok":
        if (desenlace.experiencias.length === 0) {
          // Hay persona y ninguna aprobación: denegación neutral, sin motivo.
          setFase("denegado");
          return;
        }

        setExperiencias(desenlace.experiencias);
        setFase(
          desenlace.experiencias.length === 1 ? "redirigiendo" : "selector",
        );
        return;
      default:
        setFase("indisponible");
    }
  }, []);

  useEffect(() => {
    if (registration || modoDemoLocal) {
      return;
    }

    void consultar();
  }, [consultar, modoDemoLocal, registration]);

  /*
   * La redirección va en un EFECTO aparte y no dentro del `switch`: hacer
   * `router.replace` mientras se está renderizando el cambio de estado acopla la
   * navegación al render y deja la pantalla en un estado que ya no existe.
   */
  useEffect(() => {
    if (modoDemoLocal || fase !== "redirigiendo" || experiencias.length !== 1) {
      return;
    }

    const unica = experiencias[0];

    if (unica !== undefined) {
      router.replace(RUTAS_EXPERIENCIA[unica]);
    }
  }, [fase, experiencias, modoDemoLocal, router]);

  /* El Portal Central ya separa iniciar sesión de registrarse. */
  useEffect(() => {
    if (!modoDemoLocal && fase === "sin-sesion") {
      window.location.assign(urlDeLoginHumano());
    }
  }, [fase, modoDemoLocal]);

  /*
   * FOCO: cuando el selector cambia de una pantalla a otra, el foco se mueve al
   * bloque nuevo. Sin esto, quien navega con teclado o con lector de pantalla se
   * queda en el enlace «Volver» de la tarjeta anterior y no se entera de que
   * ahora hay una lista que elegir.
   */
  useEffect(() => {
    if (modoDemoLocal || fase === "sin-sesion" || registration) {
      return;
    }

    bloqueRef.current?.focus();
  }, [fase, modoDemoLocal, registration]);

  if (registration) {
    return <AccessRegistrationWizard />;
  }

  const iniciarDemo = (): void => {
    if (perfilDemo !== null) {
      router.push(RUTAS_EXPERIENCIA[perfilDemo]);
    }
  };

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
              <button
                aria-pressed={perfilDemo === "PATIENT"}
                className={`${styles.roleChip} ${styles.patientChip} ${perfilDemo === "PATIENT" ? styles.roleChipSelected : ""}`}
                disabled={!modoDemoLocal}
                onClick={() => setPerfilDemo("PATIENT")}
                type="button"
              >
                <span aria-hidden="true">P</span>
                <strong>Paciente</strong>
              </button>
              <button
                aria-pressed={perfilDemo === "CAREGIVER"}
                className={`${styles.roleChip} ${styles.caregiverChip} ${perfilDemo === "CAREGIVER" ? styles.roleChipSelected : ""}`}
                disabled={!modoDemoLocal}
                onClick={() => setPerfilDemo("CAREGIVER")}
                type="button"
              >
                <span aria-hidden="true">C</span>
                <strong>Cuidador</strong>
              </button>
              <button
                aria-pressed={perfilDemo === "FIELD_PROFESSIONAL"}
                className={`${styles.roleChip} ${styles.visitorChip} ${perfilDemo === "FIELD_PROFESSIONAL" ? styles.roleChipSelected : ""}`}
                disabled={!modoDemoLocal}
                onClick={() => setPerfilDemo("FIELD_PROFESSIONAL")}
                type="button"
              >
                <span aria-hidden="true">V</span>
                <strong>Visitador médico</strong>
              </button>
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

            {modoDemoLocal ? (
              <>
                <div className={styles.approvalNotice} role="status">
                  <span aria-hidden="true" className={styles.approvalIcon}>i</span>
                  <p>
                    Seleccione un perfil para recorrer una demostración con información ficticia.
                  </p>
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.primary}
                    disabled={perfilDemo === null}
                    onClick={iniciarDemo}
                    type="button"
                  >
                    Iniciar sesión <span aria-hidden="true">→</span>
                  </button>
                </div>
                <p className={styles.securityNote}>
                  <span aria-hidden="true">◆</span>
                  Esta demostración no consulta ni guarda información real.
                </p>
              </>
            ) : null}

            {modoDemoLocal ? null : (
              <div className={styles.liveRegion} aria-live="polite">
                {AVISOS[fase] === "" ? null : <p>{AVISOS[fase]}</p>}
              </div>
            )}

            {!modoDemoLocal && fase === "sin-sesion" ? (
              <div className={styles.statusPanel} ref={bloqueRef} tabIndex={-1}>
                Abriendo el formulario seguro de correo y contraseña…
              </div>
            ) : null}

            {!modoDemoLocal && fase === "consultando" ? (
              <div className={styles.statusPanel} ref={bloqueRef} tabIndex={-1}>
                Comprobando sus experiencias aprobadas…
              </div>
            ) : null}

            {!modoDemoLocal && fase === "redirigiendo" ? (
              <div className={styles.statusPanel} ref={bloqueRef} tabIndex={-1}>
                Abriendo su espacio… Si la página no cambia,{" "}
                <a href={RUTAS_EXPERIENCIA[experiencias[0] ?? "PATIENT"]}>
                  continúe aquí
                </a>
                .
              </div>
            ) : null}

            {!modoDemoLocal && fase === "selector" ? (
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

            {!modoDemoLocal && fase === "denegado" ? (
              <div ref={bloqueRef} tabIndex={-1}>
                <p className={styles.errorMessage}>
                  Su cuenta no tiene ninguna experiencia aprobada. Puede revisar
                  el estado de su solicitud o registrar una nueva.
                </p>
                <Link
                  className={styles.textLink}
                  href="/acceso?accion=registro"
                >
                  Regístrate
                </Link>
              </div>
            ) : null}

            {!modoDemoLocal && fase === "indisponible" ? (
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
