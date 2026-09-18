import { type PrismaClient } from '../src/generated/prisma/client';

import { nextTestDocument } from './enrollment-fixtures';

/**
 * Datos y utilidades de las pruebas hospitalarias
 * (TASK-HOSPITAL-CORE-01 §12.2).
 *
 * TODAS las personas son FICTICIAS y reutilizan el prefijo documental reservado
 * de CORE-01, de modo que `cleanupTestData` las retira sin tocar ningún otro
 * dato. Los nombres, documentos y territorios son inventados y no corresponden a
 * ninguna persona real, a ninguna EPS ni a ninguna historia clínica.
 *
 * Las credenciales institucionales de estas pruebas son ficticias, locales y no
 * coinciden con ninguna credencial real ni desplegada.
 */

/** Credencial institucional HOSPITALARIA ficticia, solo para la suite. */
export const CREDENCIAL_HOSPITAL_FICTICIA =
  'credencial-ficticia-de-pruebas-hospital-0002';

/** Código de la identidad institucional hospitalaria aprovisionada en pruebas. */
export const CODIGO_IDENTIDAD_HOSPITAL = 'hospital-patient-viewer-pruebas';

/** Persona sintética con nombre y condiciones controladas. */
export interface PacienteHospitalOptions {
  readonly tenantId: string;
  readonly givenNames: string;
  readonly familyNames: string;
  /** Fecha de nacimiento en UTC. La edad NUNCA se persiste. */
  readonly birthDate: Date;
  readonly epsCode?: string;
  readonly epsNameControlled?: string;
  readonly disabilityDeclared?: boolean;
  readonly homeCareRequiredDeclared?: boolean;
  /** Sin territorio no se crea dirección: el registro queda sin municipio. */
  readonly territorio?: {
    readonly departmentUnitId: string;
    readonly municipalityUnitId: string;
    readonly areaType?: 'URBAN' | 'RURAL';
    readonly localUnitId?: string | null;
  };
  /** Documento explícito; por defecto se toma del prefijo reservado. */
  readonly documentNumber?: string;
  readonly documentType?: 'CEDULA_CIUDADANIA' | 'PASAPORTE';
}

export interface PacienteHospitalCreado {
  readonly patientId: string;
  readonly personId: string;
  readonly documentNumber: string;
}

/**
 * Crea persona, paciente, pertenencias declaradas y, si procede, dirección.
 *
 * Reproduce lo que persiste la inscripción de CORE-01 sin pasar por la API:
 * estas pruebas verifican la LECTURA hospitalaria, no el formulario.
 *
 * `OLDER_ADULT_60_PLUS` NO se persiste nunca aquí, a propósito: así queda
 * demostrado que la superficie Hospital deriva la edad de la fecha de nacimiento
 * y no de una pertenencia almacenada que pudiera haber quedado obsoleta.
 */
export async function crearPacienteHospital(
  prisma: PrismaClient,
  options: PacienteHospitalOptions,
): Promise<PacienteHospitalCreado> {
  const documento = options.documentNumber ?? nextTestDocument();

  return prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        tenantId: options.tenantId,
        documentType: options.documentType ?? 'CEDULA_CIUDADANIA',
        documentNumber: documento,
        documentNumberNormalized: documento,
        givenNames: options.givenNames,
        familyNames: options.familyNames,
        birthDate: options.birthDate,
        sexGenderCode: 'PREFIERE_NO_DECIRLO',
        // Contacto ficticio: existe en la base y NUNCA debe salir por la API.
        phone: '300 000 0000',
        email: 'contacto.ficticio@ejemplo.invalid',
      },
      select: { id: true },
    });

    const patient = await tx.patient.create({
      data: {
        tenantId: options.tenantId,
        personId: person.id,
        epsCode: options.epsCode ?? 'NUEVA_EPS',
        epsNameControlled: options.epsNameControlled ?? 'Nueva EPS',
        origin: 'PUBLIC_SELF_ENROLLMENT',
      },
      select: { id: true },
    });

    if (options.disabilityDeclared === true) {
      await tx.patientPopulationMembership.create({
        data: {
          patientId: patient.id,
          tenantId: options.tenantId,
          populationType: 'DISABILITY',
          source: 'DECLARED',
        },
      });
    }

    if (options.homeCareRequiredDeclared === true) {
      await tx.patientPopulationMembership.create({
        data: {
          patientId: patient.id,
          tenantId: options.tenantId,
          populationType: 'HOME_CARE_REQUIRED',
          source: 'DECLARED',
        },
      });
    }

    if (options.territorio !== undefined) {
      const localUnitId = options.territorio.localUnitId ?? null;

      await tx.patientAddress.create({
        data: {
          tenantId: options.tenantId,
          patientId: patient.id,
          departmentUnitId: options.territorio.departmentUnitId,
          municipalityUnitId: options.territorio.municipalityUnitId,
          localUnitId,
          areaType: options.territorio.areaType ?? 'URBAN',
          localityPendingNormalization: localUnitId === null,
          /*
           * Texto libre declarado. Existe en la base para poder comprobar que la
           * API NUNCA lo devuelve: publicarlo lo convertiría en territorio
           * oficial sin haberlo verificado.
           */
          localityUnverifiedText: localUnitId === null ? 'Localidad Ficticia' : null,
          exactAddress: 'Calle Ficticia 00-00',
          directions: 'Indicación ficticia para llegar.',
        },
      });
    }

    return { patientId: patient.id, personId: person.id, documentNumber: documento };
  });
}

/** Nacimiento ficticio en UTC que produce la edad indicada a la fecha de corte. */
export function nacimientoParaEdad(edad: number, corte: Date): Date {
  return new Date(
    Date.UTC(corte.getUTCFullYear() - edad, corte.getUTCMonth(), corte.getUTCDate()),
  );
}

/** Extrae el valor de la cookie institucional de una cabecera `Set-Cookie`. */
export function cookieDe(
  setCookie: string | readonly string[] | undefined,
): string | null {
  const cabeceras = Array.isArray(setCookie)
    ? setCookie
    : typeof setCookie === 'string'
      ? [setCookie]
      : [];

  for (const cabecera of cabeceras) {
    const coincidencia = /merdn_institutional_session=([^;]+)/u.exec(cabecera);

    if (coincidencia !== null && (coincidencia[1] ?? '').length > 0) {
      return coincidencia[1]!;
    }
  }

  return null;
}

/**
 * Campos que JAMÁS pueden aparecer en una respuesta hospitalaria.
 *
 * Se comprueban sobre el JSON serializado completo, de modo que la prueba falle
 * aunque el dato llegue anidado en un objeto nuevo que nadie previó.
 */
export const CAMPOS_PROHIBIDOS: readonly string[] = [
  'personId',
  'documentNumberNormalized',
  'phone',
  'email',
  'exactAddress',
  'directions',
  'localityUnverifiedText',
  'settlementUnverifiedText',
  'tenantId',
  'tokenHash',
  'accessSecret',
  'consentVersion',
  'createdByUserId',
  'identityId',
];

/**
 * Valores concretos que JAMÁS pueden aparecer en una respuesta hospitalaria.
 *
 * Son los VALORES ficticios que las fixtures sí persisten, precisamente para
 * poder demostrar que la API no los devuelve.
 */
export const VALORES_PROHIBIDOS: readonly string[] = [
  '300 000 0000',
  'contacto.ficticio@ejemplo.invalid',
  'Calle Ficticia 00-00',
  'Indicación ficticia para llegar.',
  'Localidad Ficticia',
];
