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
   * Spec 038 (MP02-C1): registra la creación de una solicitud de acceso dentro de
   * su misma transacción.
   *
   * Se escribe SOLO cuando la fila se crea de verdad. Una repetición correcta
   * devuelve la referencia ya emitida sin generar un segundo evento, porque este
   * evento afirma una creación y en la repetición no se creó nada: un historial
   * con una entrada por reintento sobrerrepresentaría la demanda.
   *
   * NO copia documento, nombres, teléfono, correo ni referencia. `resourceId` es
   * el identificador interno de la fila y `correlationId` un UUID generado por el
   * servidor, nunca un valor recibido del cliente.
   */
  public async recordAccessRequestCreatedWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly accessRequestId: string;
      readonly endpoint: string;
      readonly correlationId: string;
    },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'ACCESS_REQUEST_CREATED',
        actorType: 'PUBLIC_SELF_ENROLLMENT',
        actorUserId: null,
        resourceType: 'AccessRequest',
        resourceId: input.accessRequestId,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /**
   * Spec 038 (MP04-C3-C1): reintento materialmente distinto sobre una solicitud
   * abierta, respondido con `409`, dentro de su misma transacción de detección.
   *
   * Representa UNICAMENTE el intento conflictivo: no reutiliza `CREATED`
   * (nada se creó), `REJECTED` (nada se decidió), `VIEWED` (exige revisor
   * institucional) ni `LIST_DENIED` (es otra superficie) con semántica falsa.
   * Si esta escritura falla, la transacción se aborta y la llamada falla
   * cerrada: nunca se devuelve un `409` falsamente auditado.
   *
   * NO copia documento, nombres, contacto, expediente, password, referencia
   * pública, tenant recibido del cliente ni diferencias del cuerpo. `resourceId`
   * es el identificador interno de la fila existente y `correlationId` un UUID
   * generado por el servidor.
   */
  public async recordAccessRequestReplayConflictWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly accessRequestId: string;
      readonly endpoint: string;
      readonly correlationId: string;
    },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'ACCESS_REQUEST_REPLAY_CONFLICT',
        actorType: 'PUBLIC_SELF_ENROLLMENT',
        actorUserId: null,
        resourceType: 'AccessRequest',
        resourceId: input.accessRequestId,
        outcome: 'DENIED',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /*
   * -------------------------------------------------------------------------
   * REVISIÓN HOSPITALARIA DE SOLICITUDES DE ACCESO — SPEC 038, MP03-C1.
   * -------------------------------------------------------------------------
   *
   * Los eventos se escriben SIEMPRE dentro de la transacción que sirve la
   * petición, y son FAIL-CLOSED: si el evento no puede persistirse, la
   * transacción se aborta y no se sirve ni se modifica nada. Aquí no existe el
   * criterio best-effort que otros guards aplican a la denegación, y es
   * deliberado: una denegación no entrega datos y registrarla no es un requisito
   * de integridad del recurso, mientras que una APROBACIÓN que no deja traza sí
   * es un defecto. La denegación de la lista, en cambio, se audita desde el
   * servicio que la produce, con la misma exigencia.
   *
   * SIN PII Y SIN FILTROS. Ninguno de estos eventos copia documento, nombre,
   * teléfono, correo, fecha de nacimiento, término de búsqueda, filtro aplicado,
   * límite, cursor, conteo de resultados ni motivo en texto. `endpoint` es la
   * RUTA LÓGICA con el identificador sustituido por un marcador, no la ruta
   * pedida, y `resourceId` es NULO en la lista porque una lista no nombra un
   * recurso concreto: nombrarlo cuando se deniega revelaría qué se intentó ver.
   */

  /**
   * Lista de solicitudes de acceso CONCEDIDA.
   *
   * `resourceId` queda NULO a propósito. La lista es una SUPERFICIE agregada: el
   * evento afirma que el rol pudo leer el backlog de su tenant, no que leyó una
   * solicitud concreta. Guardar aquí el primer identificador devuelto convertiría
   * la traza de un acceso en el inventario de lo que el cliente vio.
   */
  public async recordAccessRequestListGrantedWithin(
    tx: PrismaTransaction,
    input: AccessRequestReviewAuditInput,
    occurredAt: Date,
  ): Promise<string> {
    return this.escribirRevisionSolicitud(tx, input, {
      eventType: 'ACCESS_REQUEST_LIST_GRANTED',
      resourceId: null,
      outcome: 'SUCCESS',
    }, occurredAt);
  }

  /**
   * Lista de solicitudes de acceso DENEGADA por falta de rol.
   *
   * Es el ÚNICO evento de esta familia con `outcome: 'DENIED'`, y por eso no
   * registra recurso, filtros ni conteos: el valor de esta traza es saber que se
   * intentó una superficie que no correspondía, no qué se buscaba en ella.
   */
  public async recordAccessRequestListDeniedWithin(
    tx: PrismaTransaction,
    input: AccessRequestReviewAuditInput,
    occurredAt: Date,
  ): Promise<string> {
    return this.escribirRevisionSolicitud(tx, input, {
      eventType: 'ACCESS_REQUEST_LIST_DENIED',
      resourceId: null,
      outcome: 'DENIED',
    }, occurredAt);
  }

  /**
   * Lista de solicitudes de acceso DENEGADA por AUSENCIA de sesión institucional.
   *
   * Es un camino DISTINTO del anterior y no una variante con el actor vacío. Un
   * `401` no tiene identidad, rol ni tenant demostrados: no se sabe quién pidió
   * ni de qué institución, y rellenar esos campos con un valor por defecto —
   *el tenant configurado, una identidad de relleno— fabricaría una atribución
   * que ningún hecho respalda. Por eso el método no acepta actor y no reutiliza
   * el escritor común, y por eso los métodos autenticados siguen exigiendo
   * identidad y rol: volverlos opcionales para acomodar a este caso habría
   * habilitado en todas partes la fila sin atribución que se evita aquí.
   *
   * El tenant lo resuelve quien llama desde configuración del servidor
   * (`TenantContextService`), nunca desde la petición. La respuesta al cliente
   * no depende de que esta escritura tenga éxito: auditar es deseable, pero
   * hacer la denegación fail-closed convertiría un fallo de auditoría en una vía
   * de denegación de servicio.
   */
  public async recordAccessRequestUnauthenticatedDeniedWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly endpoint: string;
      readonly correlationId: string;
    },
    occurredAt: Date,
  ): Promise<string> {
    for (const campo of [input.tenantId, input.endpoint, input.correlationId] as const) {
      if (typeof campo !== 'string' || campo.trim() === '') {
        throw new Error(
          `Auditoria de revision de solicitudes: el campo obligatorio "${campo}" no es un valor utilizable. No se escribe un evento sin contexto (SPEC 038 MP03-C1).`,
        );
      }
    }

    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'ACCESS_REQUEST_LIST_DENIED',
        actorType: 'UNAUTHENTICATED',
        actorUserId: null,
        actorRole: null,
        resourceType: 'AccessRequest',
        resourceId: null,
        outcome: 'DENIED',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /**
   * Detalle de UNA solicitud consultado para revisión.
   *
   * Aquí SÍ hay `resourceId`, porque el detalle devuelve datos personales de una
   * persona concreta: saber quién consultó qué solicitud es el propósito del
   * evento. Se registra el identificador INTERNO de la fila y no la referencia
   * mostrada, que es un dato que el solicitante puede citar.
   */
  public async recordAccessRequestViewedWithin(
    tx: PrismaTransaction,
    input: AccessRequestReviewAuditInput & { readonly accessRequestId: string },
    occurredAt: Date,
  ): Promise<string> {
    return this.escribirRevisionSolicitud(tx, input, {
      eventType: 'ACCESS_REQUEST_VIEWED',
      resourceId: input.accessRequestId,
      outcome: 'SUCCESS',
    }, occurredAt);
  }

  /**
   * Decisión APLICADA sobre una solicitud.
   *
   * El `eventType` NO se recibe suelto. Se deriva de la ACCIÓN pedida mediante
   * una correspondencia cerrada, de modo que ningún punto de llamada pueda
   * registrar una aprobación sobre una escritura de rechazo, una reactivación
   * como si fuera una primera aprobación, o una suspensión sin traza. Esa
   * correspondencia es la MISMA que gobierna la transición en el servicio, y el
   * servicio la toma de `ACCESS_REQUEST_DECISION`: la auditoría y la escritura
   * no pueden divergir porque comparten la tabla de la que salen las dos.
   *
   * Se deriva de la ACCIÓN y no del estado destino porque `APPROVED_PENDING_PROVISIONING`
   * es destino de TRES acciones distintas —aprobación, reintento y
   * reactivación— y las tres producen un evento distinto.
   *
   * No registra el motivo. `decisionReasonCode` vive en la fila de la solicitud,
   * donde ya está escrito y ya es auditable por comparación de estado; duplicarlo
   * en el evento no añade información y sí crea un segundo sitio donde un valor
   * podría quedar desincronizado.
   */
  public async recordAccessRequestDecisionWithin(
    tx: PrismaTransaction,
    input: AccessRequestReviewAuditInput & {
      readonly accessRequestId: string;
      readonly action: AccessRequestDecisionAction;
    },
    occurredAt: Date,
  ): Promise<string> {
    const eventType = ACCESS_REQUEST_ACTION_EVENT[input.action];

    if (eventType === null) {
      /*
       * Invariante del contrato: hay acciones que no producen evento de
       * decisión. Pedirlo significaría que el servicio y este mapa divergieron,
       * y registrar un evento ELEGIDO AQUÍ para tapar la divergencia sería
       * exactamente lo que este mapa existe para impedir. Se aborta antes de
       * escribir, y el fallo revierte la transacción entera.
       */
      throw new Error(
        'Auditoria de decision de solicitud: la accion indicada no produce evento de decision (SPEC 038 MP04).',
      );
    }

    return this.escribirRevisionSolicitud(tx, input, {
      eventType,
      resourceId: input.accessRequestId,
      outcome: 'SUCCESS',
    }, occurredAt);
  }

  /**
   * Desactivación de la CUENTA humana al suspender o revocar (SPEC 038, MP04).
   *
   * Evento separado del de la solicitud porque nombra un recurso distinto: la
   * traza de la decisión dice QUÉ decidió la institución, esta dice QUÉ cuenta
   * dejó de autenticarse. Sin las dos, «suspender» y «revocar» serían
   * indistinguibles al reconstruir quién perdió acceso.
   *
   * `actorUserId` es `HumanAccount.id`, opaco. El evento NO contiene issuer,
   * subject, username, contraseña ni el número de sesiones revocadas.
   */
  public async recordHumanAccountDeactivatedWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly humanAccountId: string;
      readonly endpoint: string;
      readonly correlationId: string;
      /** `true` cuando además se desvinculó la identidad externa (REVOKE). */
      readonly identityUnlinked: boolean;
      /** `true` cuando al menos una sesión viva quedó revocada. */
      readonly sessionsRevoked: boolean;
    },
    occurredAt: Date,
  ): Promise<string> {
    const creado = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'HUMAN_ACCOUNT_DISABLED',
        actorType: 'SYSTEM',
        actorUserId: null,
        resourceType: 'HumanAccount',
        resourceId: input.humanAccountId,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    if (input.sessionsRevoked) {
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          eventType: 'HUMAN_SESSION_REVOKED',
          actorType: 'SYSTEM',
          actorUserId: null,
          resourceType: 'HumanSession',
          /*
           * `resourceId` queda NULO: el evento afirma que TODAS las sesiones
           * vivas de la cuenta fueron revocadas, no cuáles. Nomerar la primera
           * convertiría una invalidación de cuenta en un inventario parcial.
           */
          resourceId: null,
          outcome: 'SUCCESS',
          endpoint: input.endpoint,
          correlationId: input.correlationId,
          occurredAt,
        },
        select: { id: true },
      });
    }

    if (input.identityUnlinked) {
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          eventType: 'HUMAN_IDENTITY_UNLINKED',
          actorType: 'SYSTEM',
          actorUserId: null,
          resourceType: 'ExternalAuthIdentity',
          /*
           * NULO: la cuenta puede tener más de un vínculo y revocar no
           * selecciona a cuál se refiere este evento. Tampoco se registra el
           * emisor ni el `subject`, que es exactamente lo que §debe permanecer
           * fuera de la auditoría.
           */
          resourceId: null,
          outcome: 'SUCCESS',
          endpoint: input.endpoint,
          correlationId: input.correlationId,
          occurredAt,
        },
        select: { id: true },
      });
    }

    return creado.id;
  }

  /**
   * Provisión de una solicitud CONCLUIDA con éxito (SPEC 038, MP04).
   *
   * ActOR `SYSTEM`: la provisión es un proceso, no una persona ni una identidad
   * institucional. La decisión que la desencadenó ya dejó su propio evento.
   *
   * El evento NO contiene emisor, `subject`, username, contraseña, nombre de
   * host ni el estado HTTP que produjo el resultado: solo la solicitud, el
   * tenant y un código cerrado cuando el desenlace es de fallo.
   */
  public async recordAccessProvisioningSucceededWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly accessRequestId: string;
      readonly endpoint: string;
      readonly correlationId: string;
    },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'ACCESS_PROVISIONING_SUCCEEDED',
        actorType: 'SYSTEM',
        actorUserId: null,
        resourceType: 'AccessRequest',
        resourceId: input.accessRequestId,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /**
   * Provisión de una solicitud CONCLUIDA con fallo (SPEC 038, MP04).
   *
   * `outcome` es `DENIED`: la solicitud NO obtuvo acceso, que es el hecho que
   * este evento afirma. No es una denegación de autorización —el revisor estaba
   * autorizado— y por eso el CAUSA vive en `AccessRequest.provisioningErrorCode`,
   * en la propia fila y como código cerrado, no aquí.
   */
  public async recordAccessProvisioningFailedWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly accessRequestId: string;
      readonly endpoint: string;
      readonly correlationId: string;
    },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'ACCESS_PROVISIONING_FAILED',
        actorType: 'SYSTEM',
        actorUserId: null,
        resourceType: 'AccessRequest',
        resourceId: input.accessRequestId,
        outcome: 'DENIED',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /**
   * Identidad preparada en el proveedor durante el registro (SPEC 038, MP04).
   *
   * Es un evento SEPARADO de la provisión porque afirma algo distinto: aquí se
   * creó un usuario DESHABILITADO y se guardó su `sub`; allí se activó la cuenta
   * y se creó la participación. Confundirlos haría que una solicitud con la
   * identidad lista pareciera ya aprobada.
   */
  public async recordAccessIdentityPreparedWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly accessRequestId: string;
      readonly endpoint: string;
      readonly correlationId: string;
    },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'ACCESS_IDENTITY_PREPARED',
        actorType: 'SYSTEM',
        actorUserId: null,
        resourceType: 'AccessRequest',
        resourceId: input.accessRequestId,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /**
   * Preparación de identidad FALLIDA durante el registro (SPEC 038, MP04).
   *
   * Se escribe en SU PROPIA transacción, porque la que falló es precisamente la
   * de la solicitud: registrar el fallo dentro de una transacción abortada no
   * dejaría ninguna traza, y dejar traza es justamente lo que este evento existe
   * para hacer. La respuesta al cliente no depende de que este evento se
   * escriba —ya hubo fallo igualmente— pero su ausencia queda registrada en el
   * log técnico.
   */
  public async recordAccessIdentityPreparationFailedWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly accessRequestId: string;
      readonly endpoint: string;
      readonly correlationId: string;
    },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'ACCESS_IDENTITY_PREPARATION_FAILED',
        actorType: 'SYSTEM',
        actorUserId: null,
        resourceType: 'AccessRequest',
        resourceId: input.accessRequestId,
        outcome: 'DENIED',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /**
   * Acceso a las EXPERIENCIAS aprobadas de la cuenta (SPEC 038, MP04).
   *
   * ActOR la cuenta humana OPACA. `resourceId` es la propia cuenta: el evento
   * afirma QUÉ cuenta consultó sus experiencias, no cuáles eran ni cuáles
   * faltaban, porque el listado en sí es el resultado de la consulta y
   * duplicarlo en la traza añadiría un segundo sitio donde podría desincronizarse.
   *
   * El `endpoint` se DERIVA del desenlace y no lo suministra quien llama, de
   * modo que una concesión no pueda registrarse nunca con la ruta de una
   * denegación ni al revés.
   */
  public async recordExperienceAccessWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly humanAccountId: string;
      readonly granted: boolean;
      readonly correlationId: string;
    },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: input.granted ? 'EXPERIENCE_ACCESS_GRANTED' : 'EXPERIENCE_ACCESS_DENIED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: input.humanAccountId,
        actorRole: null,
        resourceType: 'HumanAccount',
        resourceId: input.humanAccountId,
        outcome: input.granted ? 'SUCCESS' : 'DENIED',
        endpoint: EXPERIENCE_ACCESS_ENDPOINT,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /**
   * Escritura común de la familia de revisión.
   *
   * Exige en ejecución que tenant, identidad y correlación sean utilizables. El
   * tipado no impide una cadena vacía, y un evento con el actor o el contexto en
   * blanco es un evento que no atribuye nada: se aborta ANTES de escribir en vez
   * de dejar una fila sin actor. El mensaje nombra el campo ausente y nada más.
   */
  private async escribirRevisionSolicitud(
    tx: PrismaTransaction,
    input: AccessRequestReviewAuditInput,
    evento: {
      readonly eventType:
        | 'ACCESS_REQUEST_LIST_GRANTED'
        | 'ACCESS_REQUEST_LIST_DENIED'
        | 'ACCESS_REQUEST_VIEWED'
        | 'ACCESS_REQUEST_APPROVED'
        | 'ACCESS_REQUEST_REJECTED'
        | 'ACCESS_REQUEST_SUSPENDED'
        | 'ACCESS_REQUEST_REVOKED'
        | 'ACCESS_REQUEST_REACTIVATED';
      readonly resourceId: string | null;
      readonly outcome: 'SUCCESS' | 'DENIED';
    },
    occurredAt: Date,
  ): Promise<string> {
    for (const campo of [
      input.tenantId,
      input.identityId,
      input.role,
      input.endpoint,
      input.correlationId,
    ] as const) {
      if (typeof campo !== 'string' || campo.trim() === '') {
        throw new Error(
          `Auditoria de revision de solicitudes: el campo obligatorio "${campo}" no es un valor utilizable. No se escribe un evento sin actor, rol, ruta o correlacion (SPEC 038 MP03-C1).`,
        );
      }
    }

    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: evento.eventType,
        actorType: 'INSTITUTIONAL_IDENTITY',
        actorUserId: input.identityId,
        actorRole: input.role,
        resourceType: 'AccessRequest',
        resourceId: evento.resourceId,
        outcome: evento.outcome,
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /** Spec 027: Registra la creación de una cuenta humana (Paciente). */
  public async recordHumanAccountCreatedWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly endpoint: string;
      readonly correlationId: string;
    },
    payload: { readonly humanAccountId: string; readonly personId: string },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'HUMAN_ACCOUNT_CREATED',
        actorType: 'PUBLIC_SELF_ENROLLMENT',
        actorUserId: null,
        resourceType: 'HumanAccount',
        resourceId: payload.humanAccountId,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /** Spec 027: Registra el vínculo de identidad externa (Keycloak) con la cuenta humana. */
  public async recordHumanIdentityLinkedWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly endpoint: string;
      readonly correlationId: string;
    },
    payload: {
      readonly extAuthIdentityId: string;
      readonly humanAccountId: string;
      readonly issuer: string;
      readonly subject: string;
    },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'HUMAN_IDENTITY_LINKED',
        actorType: 'SYSTEM',
        actorUserId: null,
        resourceType: 'ExternalAuthIdentity',
        resourceId: payload.extAuthIdentityId,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });

    return event.id;
  }

  /** Spec 027: Registra la revocación de la sesión de inscripción al migrar a sesión humana. */
  public async recordEnrollmentSessionRevokedWithin(
    tx: PrismaTransaction,
    input: {
      readonly tenantId: string;
      readonly endpoint: string;
      readonly correlationId: string;
    },
    payload: { readonly enrollmentSessionId: string; readonly patientId: string },
    occurredAt: Date,
  ): Promise<string> {
    const event = await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'ENROLLMENT_SESSION_REVOKED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: null,
        resourceType: 'EnrollmentSession',
        resourceId: payload.enrollmentSessionId,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
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

/**
 * ---------------------------------------------------------------------------
 * REVISIÓN DE SOLICITUDES DE ACCESO — SPEC 038, MP03-C1
 * ---------------------------------------------------------------------------
 */

/**
 * Contexto OBLIGATORIO y OPACO de un evento de la familia de revisión.
 *
 * Los cinco campos son obligatorios y ninguno admite `null`. `identityId` es el
 * identificador interno de la identidad institucional, nunca una persona: la
 * credencial institucional es compartida y no representa a nadie concreto.
 *
 * `endpoint` es la RUTA LÓGICA con el identificador sustituido por un
 * marcador, y `correlationId` es una correlación técnica. Ninguno de los dos
 * puede llevar parámetros, cadena de consulta, cuerpo ni filtros.
 */
export interface AccessRequestReviewAuditInput {
  readonly tenantId: string;
  /** Identificador OPACO de la identidad institucional revisora. */
  readonly identityId: string;
  /** Rol efectivo en el momento del evento. La revisión exige su rol exacto. */
  readonly role: InstitutionalRole;
  /** Ruta lógica accedida, sin identificadores concretos. */
  readonly endpoint: string;
  /** Correlación técnica de la petición. Opaca y sin datos personales. */
  readonly correlationId: string;
}

/**
 * Correspondencia CERRADA entre la acción de revisión y su evento.
 *
 * Es un `Record` completo del tipo: añadir una acción alcanzable sin su entrada
 * no compila, y no hay rama por defecto que pudiera registrar una aprobación
 * sobre una escritura de rechazo, ni una reactivación como si fuera una primera
 * aprobación.
 *
 * `RETRY_PROVISIONING` es la ÚNICA acción sin evento de decisión, y es
 * deliberado. Su traza son los `ACCESS_PROVISIONING_SUCCEEDED` /
 * `ACCESS_PROVISIONING_FAILED` que escribe la propia saga: reintentar no cambia
 * por sí solo nada visible —solo vuelve a abrir el mismo ciclo— y darle además
 * un evento de «aprobación» fabricaría una segunda aprobación que nadie tomó,
 * mientras que darle el de «reactivación» la haría indistinguible de una
 * reactivación desde `SUSPENDED`. El servicio comprueba este `null` antes de
 * pedir el evento.
 *
 * Se declara AQUÍ —y no se importa del contrato de revisión— porque esta capa
 * es previa a esa superficie y no debe depender de ella.
 */
export type AccessRequestDecisionAction =
  | 'APPROVE'
  | 'REJECT'
  | 'RETRY_PROVISIONING'
  | 'SUSPEND'
  | 'REACTIVATE'
  | 'REVOKE';

const ACCESS_REQUEST_ACTION_EVENT: Record<
  AccessRequestDecisionAction,
  | 'ACCESS_REQUEST_APPROVED'
  | 'ACCESS_REQUEST_REJECTED'
  | 'ACCESS_REQUEST_SUSPENDED'
  | 'ACCESS_REQUEST_REVOKED'
  | 'ACCESS_REQUEST_REACTIVATED'
  | null
> = {
  APPROVE: 'ACCESS_REQUEST_APPROVED',
  REJECT: 'ACCESS_REQUEST_REJECTED',
  RETRY_PROVISIONING: null,
  SUSPEND: 'ACCESS_REQUEST_SUSPENDED',
  REACTIVATE: 'ACCESS_REQUEST_REACTIVATED',
  REVOKE: 'ACCESS_REQUEST_REVOKED',
};

/**
 * Ruta LÓGICA de la superficie de experiencias.
 *
 * Fija AQUÍ y no suministrada por quien llama: una concesión no puede
 * registrarse nunca con la ruta de otra operación, y el identificador de la
 * cuenta ya está en `resourceId`. Los dos desenlaces comparten ruta porque son
 * la misma consulta; se diferencian por `eventType` y por `outcome`.
 */
const EXPERIENCE_ACCESS_ENDPOINT = '/api/v1/me/experiences';
