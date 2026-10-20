import { type PrismaClient } from '../src/generated/prisma/client';
import {
  generateSessionToken,
  hashSessionToken,
} from '../src/enrollment-sessions/enrollment-session.tokens';
import { LOCAL_UNIT_PENDING_NORMALIZATION } from '../src/patients/enrollment.contract';

/**
 * Datos y utilidades de las pruebas de inscripción (TASK-MVP-CORE-01 §12).
 *
 * TODAS las personas de estas pruebas son FICTICIAS. Los documentos usan un
 * prefijo reservado que no corresponde a ninguna cédula real, y la limpieza se
 * limita exactamente a ese prefijo para no tocar ningún otro dato.
 */

/** Prefijo reservado para los documentos ficticios de las pruebas. */
export const TEST_DOCUMENT_PREFIX = '99990';

/** Código del tenant secundario usado en las pruebas de aislamiento. */
export const OTHER_TENANT_CODE = 'merdn-test-aislamiento';

/** Municipio ficticiamente elegido del catálogo oficial: MEDELLÍN (Antioquia). */
export const MUNICIPALITY_CODE = '05001';
export const DEPARTMENT_CODE = '05';

/** Segundo municipio, de otro departamento: SOACHA (Cundinamarca). */
export const OTHER_MUNICIPALITY_CODE = '25754';
export const OTHER_DEPARTMENT_CODE = '25';

let secuencia = 0;

/** Documento ficticio único dentro de la ejecución. */
export function nextTestDocument(): string {
  secuencia += 1;
  return `${TEST_DOCUMENT_PREFIX}${String(secuencia).padStart(5, '0')}`;
}

/**
 * Siembra una sesión de inscripción histórica VÁLIDA para probar que su cookie
 * sigue siendo incapaz de autenticar superficies institucionales. No crea una
 * persona ni reabre el endpoint público retirado.
 */
export async function crearSesionInscripcionHistorica(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string,
): Promise<string> {
  const token = generateSessionToken();
  await prisma.enrollmentSession.create({
    data: {
      tenantId,
      patientId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
}

export interface EnrollmentBodyOverrides {
  readonly documentNumber?: string;
  readonly birthDate?: string;
  readonly declaredPopulations?: readonly string[];
  readonly email?: string | null;
  readonly territory?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

/** Cuerpo válido de inscripción con datos ficticios. */
export function enrollmentBody(
  overrides: EnrollmentBodyOverrides = {},
): Record<string, unknown> {
  const { territory, ...rest } = overrides;

  return {
    documentType: 'CEDULA_CIUDADANIA',
    documentNumber: nextTestDocument(),
    givenNames: 'Ana María',
    familyNames: 'Ejemplo Ficticio',
    birthDate: '1958-04-12',
    sexGenderCode: 'FEMENINO',
    phone: '311 220 3355',
    epsCode: 'NUEVA_EPS',
    declaredPopulations: [],
    consentAccepted: true,
    ...rest,
    territory: {
      departmentCode: DEPARTMENT_CODE,
      municipalityCode: MUNICIPALITY_CODE,
      localUnitId: LOCAL_UNIT_PENDING_NORMALIZATION,
      localityDeclaredText: 'La Esperanza',
      settlementDeclaredText: 'San Cristóbal',
      areaType: 'URBAN',
      exactAddress: 'Cra 45 # 32-16',
      directions: 'Casa azul detrás de la iglesia.',
      ...(territory ?? {}),
    },
  };
}

/**
 * Elimina exclusivamente los datos creados por las pruebas.
 *
 * El borrado se acota al prefijo de documento reservado: no puede alcanzar el
 * tenant MVP ni el catálogo territorial oficial.
 *
 * NO borra eventos de auditoría: `audit_event` es append-only y su trigger
 * rechaza cualquier UPDATE, DELETE o TRUNCATE, incluso ejecutado por el
 * propietario de la tabla. Que los eventos se acumulen es el comportamiento
 * correcto y es, en sí mismo, evidencia de la garantía.
 *
 * Tampoco borra el tenant secundario ni sus unidades locales: se reutilizan
 * entre ejecuciones, porque los eventos de auditoría que los referencian no
 * pueden eliminarse.
 */
export async function cleanupTestData(prisma: PrismaClient): Promise<void> {
  const patients = await prisma.patient.findMany({
    where: { person: { documentNumberNormalized: { startsWith: TEST_DOCUMENT_PREFIX } } },
    select: { id: true },
  });
  const patientIds = patients.map((patient) => patient.id);

  if (patientIds.length > 0) {
    // Direcciones, consentimientos, sesiones y pertenencias caen en cascada.
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  }

  await prisma.person.deleteMany({
    where: { documentNumberNormalized: { startsWith: TEST_DOCUMENT_PREFIX } },
  });

  // Las migraciones no cargan barrios ni veredas: cualquier unidad local que
  // exista la creó una prueba, y se retira para no contaminar los recuentos.
  await prisma.territorialUnit.deleteMany({
    where: { type: { in: ['NEIGHBORHOOD', 'RURAL_SETTLEMENT'] } },
  });
}

/** Crea (o reutiliza) el tenant secundario de las pruebas de aislamiento. */
export async function ensureOtherTenant(prisma: PrismaClient): Promise<string> {
  const existing = await prisma.tenant.findUnique({
    where: { code: OTHER_TENANT_CODE },
    select: { id: true },
  });

  if (existing !== null) {
    return existing.id;
  }

  const created = await prisma.tenant.create({
    data: { code: OTHER_TENANT_CODE, name: 'Institución ficticia de pruebas' },
    select: { id: true },
  });

  return created.id;
}

/**
 * Crea (o reutiliza) una unidad local del tenant indicado, colgada del
 * municipio oficial dado. Es territorio ficticio de pruebas, nunca oficial.
 */
export async function ensureLocalUnit(
  prisma: PrismaClient,
  tenantId: string,
  municipalityUnitId: string,
  displayName: string,
  type: 'NEIGHBORHOOD' | 'RURAL_SETTLEMENT' = 'NEIGHBORHOOD',
): Promise<string> {
  const normalizedName = displayName.toUpperCase();

  const existing = await prisma.territorialUnit.findFirst({
    where: { tenantId, parentId: municipalityUnitId, type, normalizedName },
    select: { id: true },
  });

  if (existing !== null) {
    return existing.id;
  }

  const created = await prisma.territorialUnit.create({
    data: { tenantId, parentId: municipalityUnitId, type, normalizedName, displayName },
    select: { id: true },
  });

  return created.id;
}

/** Identificador de la unidad territorial oficial indicada por su código. */
export async function territorialUnitId(
  prisma: PrismaClient,
  type: 'DEPARTMENT' | 'MUNICIPALITY',
  officialCode: string,
): Promise<string> {
  const unit = await prisma.territorialUnit.findFirst({
    where: { type, officialCode },
    select: { id: true },
  });

  if (unit === null) {
    throw new Error(
      `El catálogo territorial no contiene ${type} ${officialCode}. ` +
        'Aplique la migración de datos de referencia de CORE-01.',
    );
  }

  return unit.id;
}

/** Extrae el valor de la cookie de sesión de una cabecera `Set-Cookie`. */
export function sessionTokenFromSetCookie(
  setCookie: string | readonly string[] | undefined,
  cookieName = 'merdn_enrollment_session',
): string | null {
  const headers = Array.isArray(setCookie)
    ? setCookie
    : typeof setCookie === 'string'
      ? [setCookie]
      : [];

  for (const header of headers) {
    const match = new RegExp(`${cookieName}=([^;]+)`).exec(header);
    if (match !== null && match[1] !== undefined && match[1].length > 0) {
      return match[1];
    }
  }

  return null;
}
