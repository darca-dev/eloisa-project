import { type PrismaClient } from '../src/generated/prisma/client';

import { nextTestDocument } from './enrollment-fixtures';

/**
 * Datos y utilidades de las pruebas de operaciones hospitalarias
 * (TASK-HOSPITAL-CORE-02 §11).
 *
 * TODAS las personas son FICTICIAS y reutilizan el prefijo documental reservado
 * de CORE-01, de modo que la limpieza las retira sin tocar ningún otro dato. Los
 * nombres, las profesiones y las citas son inventados y no corresponden a
 * ninguna persona real, a ningún profesional real ni a ninguna atención real.
 *
 * La credencial institucional de estas pruebas es ficticia, local y no coincide
 * con ninguna credencial real ni desplegada.
 *
 * NINGUNA de estas filas la crea una migración: la migración de esta Task no
 * inserta datos de demostración, y estas fixtures existen exclusivamente dentro
 * del aislamiento de las pruebas.
 */

/** Credencial institucional de AGENDA ficticia, solo para la suite. */
export const CREDENCIAL_SCHEDULER_FICTICIA =
  'credencial-ficticia-de-pruebas-agenda-0003';

/**
 * Código de la identidad institucional de agenda aprovisionada en pruebas.
 *
 * NO contiene la palabra «pruebas» a propósito: `limpiarIdentidadesInstitucionales`
 * borra por esa subcadena, y esta identidad debe retirarse junto con las filas
 * que la referencian —una asignación de cuidado apunta a ella—, en el orden
 * correcto y desde `limpiarOperacionesHospitalarias`.
 */
export const CODIGO_IDENTIDAD_SCHEDULER = 'hospital-scheduler-ficticio';

/** Profesión ficticia por defecto, tomada del catálogo controlado. */
export const PROFESION_FICTICIA = {
  code: 'MEDICINA_GENERAL',
  name: 'Medicina general',
} as const;

export interface ProfesionalOptions {
  readonly tenantId: string;
  readonly givenNames: string;
  readonly familyNames: string;
  readonly professionCode?: string;
  readonly professionName?: string;
  readonly status?: 'ACTIVE' | 'INACTIVE';
  /** Sin vínculo no se crea afiliación: el profesional no es asignable. */
  readonly affiliation?: {
    readonly engagementType?: 'EMPLOYEE' | 'INDEPENDENT' | 'THIRD_PARTY';
    readonly status?: 'ACTIVE' | 'INACTIVE' | 'ENDED';
    readonly startsOn?: Date;
    readonly endsOn?: Date;
  } | null;
}

export interface ProfesionalCreado {
  readonly professionalId: string;
  readonly personId: string;
  readonly documentNumber: string;
}

/**
 * Crea persona y participación profesional dentro del tenant.
 *
 * Reproduce lo que un alta de profesional persistiría, SIN pasar por la API:
 * este slice no autoriza crear profesionales desde ninguna ruta, y estas
 * pruebas verifican la lectura y la asignación, no un alta que no existe.
 */
export async function crearProfesional(
  prisma: PrismaClient,
  options: ProfesionalOptions,
): Promise<ProfesionalCreado> {
  const documento = nextTestDocument();
  const afiliacion = options.affiliation;

  return prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        tenantId: options.tenantId,
        documentType: 'CEDULA_CIUDADANIA',
        documentNumber: documento,
        documentNumberNormalized: documento,
        givenNames: options.givenNames,
        familyNames: options.familyNames,
        birthDate: new Date(Date.UTC(1985, 0, 1)),
        sexGenderCode: 'PREFIERE_NO_DECIRLO',
        // Contacto ficticio: existe en la base y NUNCA debe salir por la API.
        phone: '300 000 0000',
        email: 'contacto.ficticio@ejemplo.invalid',
      },
      select: { id: true },
    });

    const profile = await tx.professionalProfile.create({
      data: {
        tenantId: options.tenantId,
        personId: person.id,
        professionCode: options.professionCode ?? PROFESION_FICTICIA.code,
        professionNameControlled: options.professionName ?? PROFESION_FICTICIA.name,
        status: options.status ?? 'ACTIVE',
      },
      select: { id: true },
    });

    if (afiliacion !== null) {
      const estado = afiliacion?.status ?? 'ACTIVE';

      await tx.professionalAffiliation.create({
        data: {
          tenantId: options.tenantId,
          professionalId: profile.id,
          engagementType: afiliacion?.engagementType ?? 'EMPLOYEE',
          status: estado,
          startsOn: afiliacion?.startsOn ?? new Date(Date.UTC(2026, 0, 15)),
          // La base exige fecha de fin exactamente cuando el vínculo terminó.
          endsOn:
            estado === 'ENDED'
              ? (afiliacion?.endsOn ?? new Date(Date.UTC(2026, 5, 30)))
              : null,
        },
      });
    }

    return { professionalId: profile.id, personId: person.id, documentNumber: documento };
  });
}

export interface CitaOptions {
  readonly tenantId: string;
  readonly patientId: string;
  readonly modality?: 'ON_SITE' | 'HOME' | 'VIRTUAL';
  readonly requestedAt?: Date;
}

/** Crea una SOLICITUD (`REQUESTED`) sin asignación ni fecha, como exige la base. */
export async function crearSolicitud(
  prisma: PrismaClient,
  options: CitaOptions,
): Promise<string> {
  const cita = await prisma.appointment.create({
    data: {
      tenantId: options.tenantId,
      patientId: options.patientId,
      modality: options.modality ?? 'HOME',
      status: 'REQUESTED',
      requestedAt: options.requestedAt ?? new Date(Date.UTC(2026, 7, 20, 9, 0, 0)),
    },
    select: { id: true },
  });

  return cita.id;
}

/**
 * Crea una asignación primaria activa y una cita YA asignada.
 *
 * Se usa para preparar el estado que las lecturas deben reflejar. La API de este
 * slice no crea citas, de modo que sin esta preparación no habría nada que leer.
 */
export async function crearCitaAsignada(
  prisma: PrismaClient,
  options: CitaOptions & {
    readonly professionalId: string;
    readonly identityId: string;
    readonly scheduledStart: Date;
  },
): Promise<{ readonly appointmentId: string; readonly careAssignmentId: string }> {
  return prisma.$transaction(async (tx) => {
    const existente = await tx.careAssignment.findFirst({
      where: {
        tenantId: options.tenantId,
        patientId: options.patientId,
        role: 'PRIMARY',
        status: 'ACTIVE',
      },
      select: { id: true, professionalId: true },
    });

    const asignacion =
      existente !== null
        ? existente
        : await tx.careAssignment.create({
            data: {
              tenantId: options.tenantId,
              patientId: options.patientId,
              professionalId: options.professionalId,
              role: 'PRIMARY',
              status: 'ACTIVE',
              startsAt: new Date(Date.UTC(2026, 7, 1, 0, 0, 0)),
              createdByIdentityId: options.identityId,
            },
            select: { id: true, professionalId: true },
          });

    const cita = await tx.appointment.create({
      data: {
        tenantId: options.tenantId,
        patientId: options.patientId,
        careAssignmentId: asignacion.id,
        modality: options.modality ?? 'HOME',
        status: 'ASSIGNED',
        requestedAt: options.requestedAt ?? new Date(Date.UTC(2026, 7, 20, 9, 0, 0)),
        scheduledStart: options.scheduledStart,
      },
      select: { id: true },
    });

    return { appointmentId: cita.id, careAssignmentId: asignacion.id };
  });
}

/**
 * Retira TODO lo que esta Task persiste, en el orden que las claves foráneas
 * exigen: citas, asignaciones, vínculos, perfiles y, por último, la identidad
 * institucional de agenda.
 *
 * NO borra eventos de auditoría: `audit_event` es append-only y su acumulación
 * es, en sí misma, evidencia de la garantía.
 */
export async function limpiarOperacionesHospitalarias(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.appointment.deleteMany({});
  await prisma.careAssignment.deleteMany({});
  await prisma.professionalAffiliation.deleteMany({});
  await prisma.professionalProfile.deleteMany({});
}

/**
 * Retira la identidad institucional de agenda de las pruebas.
 *
 * Va SEPARADA de la limpieza de datos y solo debe ejecutarse al final de la
 * suite: la identidad autentica las peticiones y una asignacion de cuidado la
 * referencia, de modo que borrarla entre pruebas dejaria la sesion sin
 * identidad y rompería la clave foránea.
 */
export async function limpiarIdentidadAgenda(prisma: PrismaClient): Promise<void> {
  await prisma.institutionalIdentity.deleteMany({
    where: { code: CODIGO_IDENTIDAD_SCHEDULER },
  });
}

/**
 * Campos que JAMÁS pueden aparecer en una respuesta de operaciones.
 *
 * Se comprueban sobre el JSON serializado completo, de modo que la prueba falle
 * aunque el dato llegue anidado en un objeto nuevo que nadie previó.
 */
export const CAMPOS_PROHIBIDOS_OPERACIONES: readonly string[] = [
  'personId',
  'documentNumber',
  'documentNumberNormalized',
  'documentMasked',
  'birthDate',
  'phone',
  'email',
  'exactAddress',
  'directions',
  'localityUnverifiedText',
  'tenantId',
  'tokenHash',
  'accessSecret',
  'createdByIdentityId',
  'identityId',
  'epsCode',
  'careAssignmentId',
];

/**
 * Valores concretos que JAMÁS pueden aparecer en una respuesta de operaciones.
 *
 * Son los VALORES ficticios que las fixtures sí persisten, precisamente para
 * poder demostrar que la API no los devuelve.
 */
export const VALORES_PROHIBIDOS_OPERACIONES: readonly string[] = [
  '300 000 0000',
  'contacto.ficticio@ejemplo.invalid',
  'Calle Ficticia 00-00',
  'Indicación ficticia para llegar.',
];
