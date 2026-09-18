import { randomBytes } from 'node:crypto';

import { type PrismaClient } from '../src/generated/prisma/client';
import {
  generateSessionToken,
  hashSessionToken,
} from '../src/enrollment-sessions/enrollment-session.tokens';

import { nextTestDocument, TEST_DOCUMENT_PREFIX } from './enrollment-fixtures';

/**
 * Datos y utilidades de las pruebas de identidad humana y relación
 * Paciente–Cuidador (IDENTITY-RELATIONSHIPS-CORE-01 §11, continuación §6).
 *
 * TODAS las personas son FICTICIAS y reutilizan el prefijo documental reservado
 * de CORE-01, de modo que la limpieza las retira sin tocar ningún otro dato.
 * Los `subject` son inventados y NO corresponden a ninguna persona real de
 * ningún proveedor de identidad.
 *
 * SEMBRAR VÍNCULOS DIRECTAMENTE ES DELIBERADO: no existe —ni debe existir— una
 * API pública de vinculación. Las fixtures escriben lo que escribiría el
 * comando administrativo de aprovisionamiento, que tiene sus propias pruebas.
 */

/** Emisor FICTICIO local. Coincide con el emisor canónico de desarrollo. */
export const EMISOR_FICTICIO = 'http://host.docker.internal:8081/realms/merdn-local';

/** Emisor FICTICIO distinto, para comprobar que el emisor forma parte de la clave. */
export const OTRO_EMISOR_FICTICIO = 'http://host.docker.internal:8081/realms/otro-local';

let secuenciaSubject = 0;

/** `subject` ficticio único dentro de la ejecución. */
export function nextTestSubject(): string {
  secuenciaSubject += 1;

  return `sujeto-ficticio-de-pruebas-${String(secuenciaSubject).padStart(4, '0')}`;
}

export interface PersonaCreada {
  readonly personId: string;
  readonly documentNumber: string;
}

/** Crea una `Person` ficticia del tenant indicado. Sin paciente ni dirección. */
export async function crearPersona(
  prisma: PrismaClient,
  tenantId: string,
  nombres = 'Persona',
): Promise<PersonaCreada> {
  const documento = nextTestDocument();

  const person = await prisma.person.create({
    data: {
      tenantId,
      documentType: 'CEDULA_CIUDADANIA',
      documentNumber: documento,
      documentNumberNormalized: documento,
      givenNames: nombres,
      familyNames: 'Ejemplo Ficticio',
      birthDate: new Date(Date.UTC(1960, 5, 15)),
      sexGenderCode: 'PREFIERE_NO_DECIRLO',
    },
    select: { id: true },
  });

  return { personId: person.id, documentNumber: documento };
}

/** Crea una `Person` ficticia y su participación de `Patient` activa. */
export async function crearPacienteFicticio(
  prisma: PrismaClient,
  tenantId: string,
): Promise<{ readonly patientId: string; readonly personId: string }> {
  const { personId } = await crearPersona(prisma, tenantId, 'Paciente');

  const patient = await prisma.patient.create({
    data: {
      tenantId,
      personId,
      epsCode: 'NUEVA_EPS',
      epsNameControlled: 'Nueva EPS',
      origin: 'PUBLIC_SELF_ENROLLMENT',
    },
    select: { id: true },
  });

  return { patientId: patient.id, personId };
}

/**
 * Profesión FICTICIA del catálogo controlado por el SERVIDOR.
 *
 * El código respeta la forma exigida por `professional_profile_profession_code_shape`
 * y NO acredita título, habilitación, tarjeta profesional ni RETHUS: nada de eso
 * está modelado y nada de eso debe deducirse de esta fixture.
 */
export const PROFESION_FICTICIA = {
  code: 'MEDICINA_GENERAL',
  name: 'Medicina general',
} as const;

export interface ProfesionalCreado {
  readonly personId: string;
  readonly professionalId: string;
}

/**
 * Crea una `Person` ficticia con perfil profesional ACTIVO y afiliación VIGENTE.
 *
 * Las DOS piezas son necesarias: un perfil sin vínculo vigente no es
 * profesional operativo, y la resolución de participaciones lo comprueba en cada
 * operación. `startsOn` queda en el pasado y `endsOn` en nulo para que la
 * vigencia incluya el instante de la prueba sin depender de la zona horaria.
 */
export async function crearProfesionalFicticio(
  prisma: PrismaClient,
  tenantId: string,
): Promise<ProfesionalCreado> {
  const { personId } = await crearPersona(prisma, tenantId, 'Profesional');

  const profile = await prisma.professionalProfile.create({
    data: {
      tenantId,
      personId,
      professionCode: PROFESION_FICTICIA.code,
      professionNameControlled: PROFESION_FICTICIA.name,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await prisma.professionalAffiliation.create({
    data: {
      tenantId,
      professionalId: profile.id,
      engagementType: 'EMPLOYEE',
      status: 'ACTIVE',
      startsOn: new Date(
        Date.UTC(ayer.getUTCFullYear(), ayer.getUTCMonth(), ayer.getUTCDate()),
      ),
      endsOn: null,
    },
    select: { id: true },
  });

  return { personId, professionalId: profile.id };
}

export interface CuentaHumanaOptions {
  readonly tenantId: string;
  readonly personId: string;
  readonly issuer?: string;
  readonly subject?: string;
  readonly accountStatus?: 'ACTIVE' | 'DISABLED';
  readonly bindingStatus?: 'ACTIVE' | 'UNLINKED';
}

export interface CuentaHumanaCreada {
  readonly humanAccountId: string;
  readonly bindingId: string;
  readonly issuer: string;
  readonly subject: string;
}

/**
 * Siembra la cuenta humana y su vínculo con la identidad externa.
 *
 * Es exactamente lo que persistiría el aprovisionamiento administrativo: NO
 * existe autorregistro, ni autovinculación por claims, ni creación implícita de
 * cuenta en el callback.
 */
export async function crearCuentaHumana(
  prisma: PrismaClient,
  options: CuentaHumanaOptions,
): Promise<CuentaHumanaCreada> {
  const issuer = options.issuer ?? EMISOR_FICTICIO;
  const subject = options.subject ?? nextTestSubject();
  const bindingStatus = options.bindingStatus ?? 'ACTIVE';

  const account = await prisma.humanAccount.create({
    data: {
      tenantId: options.tenantId,
      personId: options.personId,
      status: options.accountStatus ?? 'ACTIVE',
    },
    select: { id: true },
  });

  const binding = await prisma.externalAuthIdentity.create({
    data: {
      tenantId: options.tenantId,
      humanAccountId: account.id,
      issuer,
      subject,
      status: bindingStatus,
      // El CHECK de la migración exige fecha de desvinculación si no está activo.
      unlinkedAt: bindingStatus === 'UNLINKED' ? new Date() : null,
    },
    select: { id: true },
  });

  return { humanAccountId: account.id, bindingId: binding.id, issuer, subject };
}

export interface SesionHumanaOptions {
  readonly tenantId: string;
  readonly humanAccountId: string;
  /** Caducidad ABSOLUTA. Por defecto, dentro de la vigencia contratada. */
  readonly expiresAt?: Date;
  readonly createdAt?: Date;
  readonly lastUsedAt?: Date | null;
  readonly revokedAt?: Date | null;
}

export interface SesionHumanaCreada {
  readonly sessionId: string;
  /** Token en claro. Solo existe aquí y en la cookie: nunca se persiste. */
  readonly token: string;
}

/** Siembra una sesión humana y devuelve su token en claro. */
export async function crearSesionHumana(
  prisma: PrismaClient,
  options: SesionHumanaOptions,
): Promise<SesionHumanaCreada> {
  const token = generateSessionToken();
  const createdAt = options.createdAt ?? new Date();

  const session = await prisma.humanSession.create({
    data: {
      tenantId: options.tenantId,
      humanAccountId: options.humanAccountId,
      tokenHash: hashSessionToken(token),
      expiresAt: options.expiresAt ?? new Date(createdAt.getTime() + 8 * 60 * 60 * 1000),
      createdAt,
      lastUsedAt: options.lastUsedAt ?? null,
      revokedAt: options.revokedAt ?? null,
    },
    select: { id: true },
  });

  return { sessionId: session.id, token };
}

/**
 * Código de la identidad institucional FICTICIA que valida las relaciones
 * sembradas. Contiene «pruebas» a propósito: así la retira la limpieza común de
 * identidades institucionales.
 */
export const CODIGO_IDENTIDAD_VALIDADORA = 'caregiver-relationship-validator-pruebas';

/**
 * Identidad institucional OPACA que figura como validadora de las relaciones
 * sembradas, creada una sola vez por tenant.
 *
 * La derivación almacenada es ALEATORIA y no corresponde a ninguna credencial:
 * nadie —tampoco las pruebas— puede autenticarse con esta identidad. Existe
 * únicamente para que exista un actor institucional al que atribuir la
 * validación, que es lo que exige el CHECK
 * `patient_caregiver_relationship_validation_scope`.
 */
export async function identidadValidadoraFicticia(
  prisma: PrismaClient,
  tenantId: string,
): Promise<string> {
  const existente = await prisma.institutionalIdentity.findFirst({
    where: { tenantId, code: CODIGO_IDENTIDAD_VALIDADORA },
    select: { id: true },
  });

  if (existente !== null) {
    return existente.id;
  }

  const creada = await prisma.institutionalIdentity.create({
    data: {
      tenantId,
      code: CODIGO_IDENTIDAD_VALIDADORA,
      role: 'CAREGIVER_RELATIONSHIP_MANAGER',
      status: 'ACTIVE',
      // Forma exigida por `institutional_identity_secret_shape`: 128 y 32
      // caracteres hexadecimales. El contenido es aleatorio y sin preimagen.
      accessSecretHash: randomBytes(64).toString('hex'),
      accessSecretSalt: randomBytes(16).toString('hex'),
    },
    select: { id: true },
  });

  return creada.id;
}

export interface RelacionOptions {
  readonly tenantId: string;
  readonly patientId: string;
  readonly caregiverPersonId: string;
  readonly status?: 'PENDING_VALIDATION' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly startsAt?: Date;
  readonly endsAt?: Date | null;
  readonly conAlcance?: boolean;
  readonly authorizationReference?: string;
  /** Identidad validadora concreta. Por defecto, la ficticia del tenant. */
  readonly validatedByInstitutionalIdentityId?: string;
  readonly validatedAt?: Date;
}

/**
 * Siembra una relación Paciente–Cuidador con su alcance `VISITS_VIEW`.
 *
 * Una relación `ACTIVE` SIEMPRE se siembra con validador y fecha de validación:
 * el estado activo es el que autoriza el acceso, y una relación que autoriza sin
 * dejar constancia de QUIÉN la validó y CUÁNDO no es trazable. La base lo exige
 * además por CHECK; la fixture no lo deja al azar de cada prueba.
 */
export async function crearRelacion(
  prisma: PrismaClient,
  options: RelacionOptions,
): Promise<string> {
  const status = options.status ?? 'ACTIVE';

  /*
   * Solo `ACTIVE` lleva validación. Sembrarla en los demás estados violaría el
   * mismo CHECK por el otro lado: una relación pendiente no está validada.
   */
  const validadoPor =
    status === 'ACTIVE'
      ? (options.validatedByInstitutionalIdentityId ??
        (await identidadValidadoraFicticia(prisma, options.tenantId)))
      : null;

  const relationship = await prisma.patientCaregiverRelationship.create({
    data: {
      tenantId: options.tenantId,
      patientId: options.patientId,
      caregiverPersonId: options.caregiverPersonId,
      relationshipType: 'DECLARED_CARE_SUPPORT',
      purpose: 'HOME_CARE_COORDINATION',
      status,
      validationSource: 'CONTROLLED_MVP_OPERATOR_ASSERTION',
      startsAt: options.startsAt ?? new Date(Date.now() - 60 * 60 * 1000),
      endsAt: options.endsAt ?? null,
      authorizationReference:
        options.authorizationReference ?? 'SOPORTE.FICTICIO-PRUEBAS',
      validatedByInstitutionalIdentityId: validadoPor,
      validatedAt: validadoPor === null ? null : (options.validatedAt ?? new Date()),
    },
    select: { id: true },
  });

  if (options.conAlcance !== false) {
    await prisma.patientCaregiverRelationshipScope.create({
      data: {
        tenantId: options.tenantId,
        relationshipId: relationship.id,
        scope: 'VISITS_VIEW',
      },
      select: { id: true },
    });
  }

  return relationship.id;
}

/**
 * Retira las filas de identidad y relación creadas por las pruebas.
 *
 * ORDEN OBLIGATORIO: las claves foráneas son `RESTRICT`, de modo que las
 * sesiones y los vínculos deben irse antes que su cuenta, y las cuentas antes
 * que su persona. `cleanupTestData` no puede hacerlo por sí sola.
 *
 * NO borra eventos de auditoría: `audit_event` es append-only y su acumulación
 * es, en sí misma, evidencia de la garantía.
 */
export async function limpiarIdentidadYRelaciones(prisma: PrismaClient): Promise<void> {
  const personas = await prisma.person.findMany({
    where: { documentNumberNormalized: { startsWith: TEST_DOCUMENT_PREFIX } },
    select: { id: true },
  });

  const personIds = personas.map((persona) => persona.id);

  if (personIds.length === 0) {
    await prisma.humanAuthAttempt.deleteMany({});

    return;
  }

  const cuentas = await prisma.humanAccount.findMany({
    where: { personId: { in: personIds } },
    select: { id: true },
  });

  const accountIds = cuentas.map((cuenta) => cuenta.id);

  await prisma.patientCaregiverRelationship.deleteMany({
    where: {
      OR: [
        { caregiverPersonId: { in: personIds } },
        { patient: { personId: { in: personIds } } },
      ],
    },
  });

  if (accountIds.length > 0) {
    await prisma.humanSession.deleteMany({ where: { humanAccountId: { in: accountIds } } });
    await prisma.externalAuthIdentity.deleteMany({
      where: { humanAccountId: { in: accountIds } },
    });
    await prisma.humanAccount.deleteMany({ where: { id: { in: accountIds } } });
  }

  // Los intentos no referencian a ninguna persona: se retiran completos.
  await prisma.humanAuthAttempt.deleteMany({});
}

/** Extrae el valor de una cookie concreta de una cabecera `Set-Cookie`. */
export function cookieDe(
  setCookie: string | readonly string[] | undefined,
  nombre: string,
): string | null {
  const cabeceras = Array.isArray(setCookie)
    ? setCookie
    : typeof setCookie === 'string'
      ? [setCookie]
      : [];

  for (const cabecera of cabeceras) {
    const coincidencia = new RegExp(`${nombre}=([^;]*)`, 'u').exec(cabecera);

    if (coincidencia !== null && (coincidencia[1] ?? '').length > 0) {
      return coincidencia[1] ?? null;
    }
  }

  return null;
}
