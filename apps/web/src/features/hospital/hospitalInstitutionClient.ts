/**
 * FACHADA COMPATIBLE de la sesión INSTITUCIONAL de Hospital (spec 022,
 * «Decisión técnica cerrada: reutilización del cliente institucional»).
 *
 * El cliente que antes vivía aquí se movió ÍNTEGRO a
 * `@/features/auth/institutionalSessionClient`. Este archivo ya no implementa
 * nada: solo conserva, sin cambiarla, la superficie que Hospital importa desde
 * TASK-HOSPITAL-CORE-01, para que ningún componente de Hospital tenga que
 * cambiar una sola importación.
 *
 * QUÉ SE CONSERVA, exactamente:
 *
 * - los mismos nombres exportados, con las mismas firmas y los mismos valores;
 * - los mismos desenlaces observables, con sus mismos literales;
 * - la misma regla de fallo cerrado y la misma decisión del cierre, porque son
 *   las del módulo compartido y aquí no se reimplementan.
 *
 * QUÉ NO SE DUPLICA: el transporte, la detección de cancelación, la lectura del
 * cuerpo, la validación local y los textos de seguridad. Duplicarlos habría
 * creado una segunda copia de la sesión institucional, que es exactamente lo
 * que la decisión de la spec 022 evita: Alcaldía consume el módulo compartido,
 * no importa desde Hospital, y las dos superficies comparten UNA sola
 * implementación.
 *
 * La ÚNICA operación de esta fachada es de NOMBRE: los identificadores que
 * Hospital ya importaba con prefijo `HOSPITAL_`/`Hospital` se reexportan con
 * ese prefijo, apuntando a los nombres neutros del módulo compartido. No hay
 * lógica propia, no hay red y no hay estado: por eso este archivo no necesita
 * siquiera nombrar el transporte, y la prueba de alcance de Hospital exige que
 * no lo nombre.
 *
 * COMPARTIR EL TRANSPORTE NO MEZCLA AUTORIZACIONES. Los roles institucionales
 * son DISJUNTOS y cada superficie exige el suyo en el servidor: que Alcaldía
 * use el mismo cliente no concede nada en Hospital, ni al revés.
 */

/* -------------------------------------------------------------------------- */
/* Superficie reexportada, sin cambios                                         */
/* -------------------------------------------------------------------------- */

export {
  LONGITUD_MAXIMA_CREDENCIAL,
  RUTA_SESIONES_INSTITUCIONALES,
  RUTA_SESION_INSTITUCIONAL,
  abrirSesionInstitucional,
  cerrarSesionInstitucional,
  consultarSesionInstitucional,
  etiquetaDeRol,
  resolverCierre,
  resolverReconfirmacion,
  textoCaducidad,
  validarAcceso,
  type FalloApertura,
  type IntencionCierre,
  type MotivoCredencialInvalida,
  type ResolucionCierre,
  type ResultadoApertura,
  type ResultadoCierre,
  type ResultadoSesion,
} from '@/features/auth/institutionalSessionClient';

/* -------------------------------------------------------------------------- */
/* Los mismos valores, con el nombre que Hospital ya importaba                 */
/* -------------------------------------------------------------------------- */

export {
  ETIQUETA_ROL_INSTITUCIONAL as HOSPITAL_ETIQUETA_ROL,
  MENSAJE_APERTURA as HOSPITAL_MENSAJE_APERTURA,
  MENSAJE_CAMBIO as HOSPITAL_MENSAJE_CAMBIO,
  MENSAJE_CIERRE as HOSPITAL_MENSAJE_CIERRE,
  MENSAJE_CIERRE_NO_CONFIRMADO as HOSPITAL_MENSAJE_CIERRE_NO_CONFIRMADO,
  MENSAJE_CREDENCIAL as HOSPITAL_MENSAJE_CREDENCIAL,
  MENSAJE_SIN_CONFIRMAR as HOSPITAL_MENSAJE_SIN_CONFIRMAR,
  PATRON_CODIGO_IDENTIDAD as HOSPITAL_PATRON_CODIGO_IDENTIDAD,
  type RolInstitucional as HospitalRolInstitucional,
  type SesionInstitucionalDto as HospitalSesionDto,
} from '@/features/auth/institutionalSessionClient';
