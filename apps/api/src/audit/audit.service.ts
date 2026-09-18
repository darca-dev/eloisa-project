import { Injectable } from '@nestjs/common';

import { type PrismaTransaction } from '../database/prisma-transaction';
import { type InstitutionalRole } from '../generated/prisma/client';

/**
 * Auditoría mínima de CORE-01 (TASK-MVP-CORE-01 §4).
 *
 * ALCANCE DECLARADO: este servicio escribe un único evento append-only por
 * inscripción creada. NO es el sistema completo de auditoría de MERDN descrito
 * en `docs/SECURITY.md`: no registra lecturas, no registra denegaciones, no
 * conserva valores anteriores y posteriores y no ofrece consulta de auditoría.
 *
 * El evento NO copia documento, nombre, dirección, teléfono, correo,
 * consentimiento ni token: solo referencia el recurso y su contexto
 * institucional.
 */
@Injectable()
export class AuditService {
  /** Registra la creación de una inscripción dentro de su misma transacción. */
  public async recordPatientEnrollmentCreatedWithin(
    tx: PrismaTransaction,
    input: { readonly tenantId: string; readonly patientId: string },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'PATIENT_ENROLLMENT_CREATED',
        actorType: 'PUBLIC_SELF_ENROLLMENT',
        actorUserId: null,
        resourceType: 'Patient',
        resourceId: input.patientId,
        outcome: 'SUCCESS',
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /**
   * Registra la materializacion de una visita domiciliaria dentro de su misma
   * transaccion (VISITS-CORE-01 MP02).
   *
   * El actor es la identidad institucional OPACA que opero, NUNCA la persona
   * visitadora: el profesional no autoriza ni firma la materializacion. Su
   * autorizacion y las transiciones posteriores pertenecen a otros paquetes.
   *
   * `endpoint` y `correlationId` quedan NULOS a proposito: MP02 no crea ningun
   * endpoint HTTP y no existe peticion que correlacionar. El paquete del
   * endpoint los suministrara; aqui NO se inventa un valor de relleno.
   *
   * El evento referencia el recurso y su contexto institucional. NO copia
   * nombre, documento, direccion, horario ni dato clinico alguno.
   */
  public async recordHomeVisitMaterializedWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      /** Identificador OPACO de la identidad institucional que opero. */
      readonly identityId: string;
      readonly role: InstitutionalRole;
      readonly homeVisitId: string;
    },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'HOME_VISIT_MATERIALIZED',
        actorType: 'INSTITUTIONAL_IDENTITY',
        actorUserId: input.identityId,
        actorRole: input.role,
        resourceType: 'HomeVisit',
        resourceId: input.homeVisitId,
        outcome: 'SUCCESS',
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /**
   * Registra una TRANSICION PROFESIONAL de la visita domiciliaria dentro de su
   * misma transaccion (VISITS-CORE-01 MP03).
   *
   * ACTOR. Es la CUENTA HUMANA OPACA autenticada, y no una identidad
   * institucional: iniciar, completar o dar por no realizada una visita es el
   * acto de una PERSONA concreta, a diferencia de la materializacion
   * administrativa de MP02. `actorRole` queda NULO a proposito y ademas la base
   * lo exige: `audit_event_actor_role_scope` solo admite rol junto a un actor
   * institucional, y `InstitutionalRole` no describe a una persona.
   *
   * `actorUserId` es `HumanAccount.id`, que es OPACO: no es un nombre, un
   * documento ni un `subject` del proveedor OIDC.
   *
   * El evento se deriva del estado DESTINO y no lo recibe suelto, de modo que
   * ningun punto de llamada pueda registrar un evento que no corresponda a la
   * transicion realmente escrita.
   *
   * `endpoint` y `correlationId` quedan NULOS: MP03 no crea ningun endpoint HTTP
   * y no existe peticion que correlacionar. El paquete del endpoint los
   * suministrara; aqui NO se inventa un valor de relleno.
   *
   * El evento referencia el recurso y su contexto institucional. NO copia
   * nombre, documento, direccion, horario, nota, motivo ni dato clinico alguno.
   * En particular NO registra POR QUE una visita quedo como no realizada: MERDN
   * no tiene aprobado ningun catalogo de causas y no lo inventa aqui.
   */
  public async recordHomeVisitTransitionWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      /** Identificador OPACO de la cuenta humana que ejecuto la transicion. */
      readonly humanAccountId: string;
      readonly homeVisitId: string;
      readonly toStatus: HomeVisitProfessionalTargetStatus;
    },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: EVENTO_POR_ESTADO_DESTINO[input.toStatus],
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: input.humanAccountId,
        actorRole: null,
        resourceType: 'HomeVisit',
        resourceId: input.homeVisitId,
        outcome: 'SUCCESS',
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /**
   * Registra el acceso propio del Paciente CONCEDIDO, dentro de la misma
   * transaccion que sirve los datos (spec 021 §9, §17.D-1).
   */
  public async recordPatientSelfAccessGrantedWithin(
    tx: PrismaTransaction,
    input: PatientSelfAccessAuditInput,
    occurredAt: Date,
  ): Promise<string> {
    return escribirAccesoPropioDelPaciente(tx, input, 'GRANTED', occurredAt);
  }

  /**
   * Registra el acceso propio del Paciente DENEGADO, dentro de la misma
   * transaccion que atiende la peticion (spec 021 §9, §17.D-1).
   *
   * Solo se llega aqui con principal humano RESOLUBLE. Una peticion sin
   * principal NO produce evento de esta familia y NO recibe actor de relleno.
   */
  public async recordPatientSelfAccessDeniedWithin(
    tx: PrismaTransaction,
    input: PatientSelfAccessAuditInput,
    occurredAt: Date,
  ): Promise<string> {
    return escribirAccesoPropioDelPaciente(tx, input, 'DENIED', occurredAt);
  }
}

/**
 * ---------------------------------------------------------------------------
 * ACCESO PROPIO DEL PACIENTE — spec 021 «Paciente MVP operativo» §9.
 * ---------------------------------------------------------------------------
 *
 * DOS eventos, y solo dos: `PATIENT_SELF_ACCESS_GRANTED` y
 * `PATIENT_SELF_ACCESS_DENIED` (§9.1, §17.D-1). NO existe un valor de enum por
 * endpoint: el resumen, las citas y las visitas se diferencian DENTRO del
 * evento, por `resourceType` y por `endpoint`.
 *
 * ACTOR. Es SIEMPRE la cuenta humana OPACA autenticada: `actorUserId` es
 * `HumanAccount.id`, que no es un nombre, ni un documento, ni el `subject` del
 * proveedor OIDC. `actorRole` queda NULO, y ademas la base lo exige: el check
 * `audit_event_actor_role_scope` solo admite rol junto a un actor
 * institucional, e `InstitutionalRole` no describe a una persona (§9.2-3).
 *
 * SIN ACTOR FICTICIO (§9.2-1, §9.2-2). Una peticion sin principal humano
 * resoluble NO genera evento de esta familia: no se inventa actor, no se usa
 * valor de relleno, no se registra `anonymous` y no se cae a
 * `PUBLIC_SELF_ENROLLMENT` ni a `UNAUTHENTICATED`. Esa peticion queda cubierta
 * por el 401 uniforme. La firma NO admite `null`, y ademas se comprueba en
 * ejecucion: un identificador vacio ABORTA en vez de escribir un evento
 * atribuido a nadie.
 *
 * SIN PII Y SIN CONTENIDO CLINICO (§9.2-5). El evento no copia documento,
 * nombre, iniciales, direccion, territorio, EPS, fecha de nacimiento, sexo o
 * genero, ni el contenido de la cita o de la visita —fecha, hora, modalidad,
 * estado—. Tampoco registra el motivo detallado de la denegacion, que
 * permitiria deducir si existe un paciente asociado. `resourceId` queda NULO:
 * un acceso a una superficie no crea recurso y no se sustituye por un
 * identificador inventado.
 *
 * FAIL-CLOSED (§9.2-6). Se escribe DENTRO de la misma transaccion que sirve los
 * datos: si el evento obligatorio no puede persistirse, la transaccion se
 * aborta y la respuesta falla. No existe lectura servida sin su traza.
 *
 * INMUTABLE (§9.2-7). Este archivo solo CREA eventos: ningun camino ejecuta
 * `update`, `delete`, `updateMany`, `deleteMany` ni `upsert`.
 */

/** Proyecciones self-scope auditables. Lista CERRADA (spec 021 §6.6-e, §9.1). */
export const PATIENT_SELF_RESOURCES = {
  summary: 'PatientSelfSummary',
  appointments: 'PatientSelfAppointments',
  visits: 'PatientSelfVisits',
} as const;

export type PatientSelfResource =
  (typeof PATIENT_SELF_RESOURCES)[keyof typeof PATIENT_SELF_RESOURCES];

/**
 * Ruta LOGICA de cada proyeccion. Correspondencia CERRADA y uno a uno con las
 * tres rutas de spec 021 §6.6-e.
 *
 * El `endpoint` se DERIVA aqui y no lo suministra quien llama: asi ninguna ruta
 * de llamada puede registrar una cadena arbitraria —con parametros, cadena de
 * consulta, filtros o conteos— en un campo que la spec exige limpio, y ninguna
 * puede emparejar una proyeccion con el endpoint de otra.
 *
 * Es un `Record` completo del tipo: anadir una proyeccion sin su ruta no
 * compila, y no hay rama por defecto que pudiera registrar una ruta equivocada
 * en silencio.
 */
const PATIENT_SELF_ENDPOINT: Record<PatientSelfResource, string> = {
  PatientSelfSummary: '/api/v1/patient-self/summary',
  PatientSelfAppointments: '/api/v1/patient-self/appointments',
  PatientSelfVisits: '/api/v1/patient-self/visits',
};

/** Desenlace del intento y su evento. Correspondencia CERRADA (spec 021 §9.1). */
type PatientSelfAccessOutcome = 'GRANTED' | 'DENIED';

const PATIENT_SELF_EVENT: Record<
  PatientSelfAccessOutcome,
  'PATIENT_SELF_ACCESS_GRANTED' | 'PATIENT_SELF_ACCESS_DENIED'
> = {
  GRANTED: 'PATIENT_SELF_ACCESS_GRANTED',
  DENIED: 'PATIENT_SELF_ACCESS_DENIED',
};

export interface PatientSelfAccessAuditInput {
  /** Tenant del principal autenticado. */
  readonly tenantId: string;
  /**
   * Identificador OPACO de la cuenta humana autenticada (`HumanAccount.id`).
   * NO admite `null`: sin principal humano resoluble NO se escribe evento.
   */
  readonly humanAccountId: string;
  /** Proyeccion leida. Determina `resourceType` y, con el, `endpoint`. */
  readonly resource: PatientSelfResource;
  /** Correlacion tecnica de la peticion. Opaca y sin datos personales. */
  readonly correlationId: string;
}

/**
 * Campos OBLIGATORIOS y opacos del evento (spec 021 §9.2-4). Se comprueban en
 * ejecucion porque el tipado no impide una cadena vacia, y un evento con un
 * campo obligatorio vacio es un evento que no atribuye nada.
 */
const CAMPOS_OPACOS_OBLIGATORIOS = ['tenantId', 'humanAccountId', 'correlationId'] as const;

function exigirCamposObligatorios(input: PatientSelfAccessAuditInput): void {
  for (const campo of CAMPOS_OPACOS_OBLIGATORIOS) {
    const valor = input[campo];

    if (typeof valor !== 'string' || valor.trim() === '') {
      /*
       * Se aborta ANTES de escribir. El mensaje nombra el campo ausente y NADA
       * mas: no incluye su valor, ningun otro campo del evento ni dato alguno
       * de la peticion.
       */
      throw new Error(
        `Auditoria de acceso propio del Paciente: el campo obligatorio "${campo}" no es un identificador utilizable. No se registra un evento con actor o contexto de relleno (spec 021 §9.2-2, §9.2-4).`,
      );
    }
  }
}

async function escribirAccesoPropioDelPaciente(
  tx: PrismaTransaction,
  input: PatientSelfAccessAuditInput,
  outcome: PatientSelfAccessOutcome,
  occurredAt: Date,
): Promise<string> {
  exigirCamposObligatorios(input);

  const event = await tx.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      eventType: PATIENT_SELF_EVENT[outcome],
      actorType: 'HUMAN_ACCOUNT',
      actorUserId: input.humanAccountId,
      actorRole: null,
      resourceType: input.resource,
      resourceId: null,
      outcome: outcome === 'GRANTED' ? 'SUCCESS' : 'DENIED',
      endpoint: PATIENT_SELF_ENDPOINT[input.resource],
      correlationId: input.correlationId,
      occurredAt,
    },
    select: { id: true },
  });

  return event.id;
}

/**
 * Estados DESTINO de las transiciones profesionales. `SCHEDULED` NO figura: esa
 * es la transicion de CREACION, cuyo actor es institucional y cuyo evento es
 * `HOME_VISIT_MATERIALIZED`.
 */
export type HomeVisitProfessionalTargetStatus = 'IN_PROGRESS' | 'COMPLETED' | 'NOT_COMPLETED';

/**
 * Correspondencia CERRADA entre el estado destino y su evento de auditoria.
 *
 * Es un `Record` completo del tipo, de modo que anadir un estado destino sin su
 * evento no compila. Esa es toda la garantia que hace falta: no hay ninguna rama
 * por defecto que pudiera registrar un evento equivocado en silencio.
 */
const EVENTO_POR_ESTADO_DESTINO: Record<
  HomeVisitProfessionalTargetStatus,
  'HOME_VISIT_STARTED' | 'HOME_VISIT_COMPLETED' | 'HOME_VISIT_NOT_COMPLETED'
> = {
  IN_PROGRESS: 'HOME_VISIT_STARTED',
  COMPLETED: 'HOME_VISIT_COMPLETED',
  NOT_COMPLETED: 'HOME_VISIT_NOT_COMPLETED',
};
