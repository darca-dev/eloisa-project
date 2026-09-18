import {
  CONTEXTOS_HUMANOS,
  consultarSesionHumana as consultarSesionHumanaCompartida,
  type EstadoSesionHumana as EstadoSesionHumanaCompartida,
  type SesionHumanaDto,
} from '@/features/auth/humanSessionClient';

/**
 * FACHADA COMPATIBLE de la sesión HUMANA profesional (spec 021 §17.D-3,
 * `MOVE TO SHARED`).
 *
 * El cliente que antes vivía aquí se movió ÍNTEGRO a
 * `@/features/auth/humanSessionClient`. Este archivo ya no implementa nada: solo
 * conserva, sin cambiarla, la superficie que Hospital importa desde
 * HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI, para que ningún componente de Hospital
 * tenga que cambiar una sola importación.
 *
 * QUÉ SE CONSERVA, exactamente:
 *
 * - los mismos nombres exportados, con las mismas firmas;
 * - los mismos desenlaces observables, incluido el literal
 *   `activa-profesional`, que es específico de esta superficie;
 * - la misma regla de fallo cerrado, porque es la del módulo compartido y aquí
 *   no se reimplementa.
 *
 * QUÉ NO SE DUPLICA: el transporte, la detección de cancelación, la lectura del
 * cuerpo y la traducción de estados. Duplicarlos habría creado una segunda
 * copia de la seguridad, que es exactamente lo que la decisión §17.D-3 evita.
 *
 * La ÚNICA lógica propia de esta fachada es nombrar el contexto que Hospital
 * exige —`PROFESSIONAL`— y traducir el desenlace genérico del módulo compartido
 * al literal que Hospital ya observaba. Los contextos NO se suman: una sesión
 * con `PATIENT` y sin `PROFESSIONAL` sigue sin ser profesional aquí.
 */

/* -------------------------------------------------------------------------- */
/* Superficie reexportada, sin cambios                                         */
/* -------------------------------------------------------------------------- */

export {
  RUTAS_SESION_HUMANA,
  DESTINO_RETORNO_HUMANO,
  urlDeLoginHumano,
  cerrarSesionHumana,
  cierreHumanoConfirmado,
  type CierreSesionHumana,
} from '@/features/auth/humanSessionClient';

/** Nombre del contexto que esta superficie exige. Los demás no habilitan nada. */
export const CONTEXTO_PROFESIONAL = CONTEXTOS_HUMANOS.profesional;

/**
 * Cuerpo de la consulta de sesión, EXACTAMENTE como el servidor lo declara.
 *
 * Alias del tipo compartido: mismos tres campos y ninguno más.
 */
export type HospitalSesionHumanaDto = SesionHumanaDto;

/**
 * Desenlace de la consulta, con el literal que Hospital ya observaba.
 *
 * Es el tipo compartido con `activa-con-contexto` nombrado como
 * `activa-profesional`: siguen siendo CINCO desenlaces y significan lo mismo.
 */
export type EstadoSesionHumana =
  | 'activa-profesional'
  | 'activa-sin-contexto'
  | 'sin-sesion'
  | 'cancelado'
  | 'no-disponible';

/* -------------------------------------------------------------------------- */
/* Operación con el literal propio de Hospital                                 */
/* -------------------------------------------------------------------------- */

/**
 * Consulta la sesión humana vigente y devuelve solo su ESTADO.
 *
 * Delega ÍNTEGRAMENTE en el módulo compartido, exigiéndole el contexto
 * `PROFESSIONAL`, y se limita a renombrar el desenlace afirmativo. Ni consulta
 * la red por su cuenta, ni interpreta el cuerpo, ni decide nada más.
 */
export async function consultarSesionHumana(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<EstadoSesionHumana> {
  const estado: EstadoSesionHumanaCompartida = await consultarSesionHumanaCompartida(
    CONTEXTO_PROFESIONAL,
    fetchImpl,
    signal,
  );

  return estado === 'activa-con-contexto' ? 'activa-profesional' : estado;
}
