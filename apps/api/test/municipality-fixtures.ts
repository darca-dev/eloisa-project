import { type PrismaClient } from '../src/generated/prisma/client';

import { nextTestDocument } from './enrollment-fixtures';

/**
 * Datos y utilidades de las pruebas municipales
 * (TASK-MUNICIPALITY-CORE-01, §Required Tests).
 *
 * TODAS las personas son FICTICIAS y reutilizan el prefijo documental reservado
 * de CORE-01, de modo que `cleanupTestData` las retira sin tocar ningún otro
 * dato. Los territorios locales son ficticios y nunca se presentan como
 * catálogo oficial.
 *
 * La credencial institucional de estas pruebas es ficticia, local y no coincide
 * con ninguna credencial real ni desplegada.
 */

/** Credencial institucional ficticia, solo para la suite de pruebas. */
export const CREDENCIAL_INSTITUCIONAL_FICTICIA =
  'credencial-ficticia-de-pruebas-alcaldia-0001';

/** Código de la identidad institucional aprovisionada en pruebas. */
export const CODIGO_IDENTIDAD_PRUEBAS = 'municipal-viewer-pruebas';

/** Condiciones declarables de una persona sintética. */
export interface CondicionesSinteticas {
  readonly mayor: boolean;
  readonly discapacidad: boolean;
  readonly cuidadoEnCasa: boolean;
}

export interface PacienteSinteticoOptions {
  readonly tenantId: string;
  readonly departmentUnitId: string;
  readonly municipalityUnitId: string;
  readonly condiciones: CondicionesSinteticas;
  readonly areaType?: 'URBAN' | 'RURAL';
  /** `null` deja la localidad pendiente de normalización. */
  readonly localUnitId?: string | null;
  /** Fecha de nacimiento explícita; por defecto se deriva de `condiciones`. */
  readonly birthDate?: Date;
  /** Si es `false`, no se crea dirección. Por defecto se crea. */
  readonly conDireccion?: boolean;
  /**
   * Persiste la pertenencia histórica `OLDER_ADULT_60_PLUS`.
   *
   * Por defecto NO se persiste: así queda demostrado que el resumen municipal
   * deriva la edad de la fecha de nacimiento y no de la pertenencia guardada.
   */
  readonly persistirMembresiaMayor?: boolean;
}

/** Nacimiento ficticio que produce la edad indicada en 2026. */
export function nacimientoConEdadAproximada(anios: number): Date {
  return new Date(Date.UTC(2026 - anios, 0, 15));
}

/**
 * Crea una persona, su paciente, sus pertenencias declaradas y su dirección.
 *
 * Reproduce lo que persiste la inscripción de CORE-01, sin pasar por la API:
 * estas pruebas verifican la AGREGACIÓN, no el formulario.
 *
 * `OLDER_ADULT_60_PLUS` se persiste solo cuando la persona ya era mayor al
 * inscribirse. El resumen municipal NO debe leer esa pertenencia: debe derivar
 * la edad de la fecha de nacimiento.
 */
export async function crearPacienteSintetico(
  prisma: PrismaClient,
  options: PacienteSinteticoOptions,
): Promise<{ readonly patientId: string; readonly personId: string }> {
  const documento = nextTestDocument();
  const birthDate =
    options.birthDate ?? nacimientoConEdadAproximada(options.condiciones.mayor ? 72 : 41);

  return prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        tenantId: options.tenantId,
        documentType: 'CEDULA_CIUDADANIA',
        documentNumber: documento,
        documentNumberNormalized: documento,
        givenNames: 'Persona',
        familyNames: 'Ejemplo Ficticio',
        birthDate,
        sexGenderCode: 'PREFIERE_NO_DECIRLO',
      },
      select: { id: true },
    });

    const patient = await tx.patient.create({
      data: {
        tenantId: options.tenantId,
        personId: person.id,
        epsCode: 'NUEVA_EPS',
        epsNameControlled: 'Nueva EPS',
        origin: 'PUBLIC_SELF_ENROLLMENT',
      },
      select: { id: true },
    });

    if (options.persistirMembresiaMayor === true) {
      await tx.patientPopulationMembership.create({
        data: {
          patientId: patient.id,
          tenantId: options.tenantId,
          populationType: 'OLDER_ADULT_60_PLUS',
          source: 'DERIVED_BIRTH_DATE',
        },
      });
    }

    if (options.condiciones.discapacidad) {
      await tx.patientPopulationMembership.create({
        data: {
          patientId: patient.id,
          tenantId: options.tenantId,
          populationType: 'DISABILITY',
          source: 'DECLARED',
        },
      });
    }

    if (options.condiciones.cuidadoEnCasa) {
      await tx.patientPopulationMembership.create({
        data: {
          patientId: patient.id,
          tenantId: options.tenantId,
          populationType: 'HOME_CARE_REQUIRED',
          source: 'DECLARED',
        },
      });
    }

    if (options.conDireccion !== false) {
      const localUnitId = options.localUnitId ?? null;

      await tx.patientAddress.create({
        data: {
          tenantId: options.tenantId,
          patientId: patient.id,
          departmentUnitId: options.departmentUnitId,
          municipalityUnitId: options.municipalityUnitId,
          localUnitId,
          areaType: options.areaType ?? 'URBAN',
          localityPendingNormalization: localUnitId === null,
          localityUnverifiedText: localUnitId === null ? 'Localidad Ficticia' : null,
          exactAddress: 'Calle Ficticia 00-00',
        },
      });
    }

    return { patientId: patient.id, personId: person.id };
  });
}

/** Las siete combinaciones exclusivas, en el orden del contrato. */
export const COMBINACIONES_EXCLUSIVAS: readonly {
  readonly clave: string;
  readonly condiciones: CondicionesSinteticas;
}[] = [
  { clave: 'olderOnly', condiciones: { mayor: true, discapacidad: false, cuidadoEnCasa: false } },
  {
    clave: 'disabilityOnly',
    condiciones: { mayor: false, discapacidad: true, cuidadoEnCasa: false },
  },
  {
    clave: 'homeCareOnly',
    condiciones: { mayor: false, discapacidad: false, cuidadoEnCasa: true },
  },
  {
    clave: 'olderAndDisabilityOnly',
    condiciones: { mayor: true, discapacidad: true, cuidadoEnCasa: false },
  },
  {
    clave: 'olderAndHomeCareOnly',
    condiciones: { mayor: true, discapacidad: false, cuidadoEnCasa: true },
  },
  {
    clave: 'disabilityAndHomeCareOnly',
    condiciones: { mayor: false, discapacidad: true, cuidadoEnCasa: true },
  },
  {
    clave: 'allThree',
    condiciones: { mayor: true, discapacidad: true, cuidadoEnCasa: true },
  },
];

/**
 * Retira identidades y sesiones institucionales de pruebas.
 *
 * NO borra eventos de auditoría: `audit_event` es append-only y su acumulación
 * es, en sí misma, evidencia de la garantía.
 */
export async function limpiarIdentidadesInstitucionales(
  prisma: PrismaClient,
): Promise<void> {
  // Las sesiones caen en cascada con su identidad.
  await prisma.institutionalIdentity.deleteMany({
    where: { code: { contains: 'pruebas' } },
  });
}

/** Extrae el valor de la cookie institucional de una cabecera `Set-Cookie`. */
export function cookieInstitucionalDe(
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
