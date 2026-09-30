/**
 * Saga de provisión de cuentas (SPEC 038, paquete MP04).
 *
 * QUÉ HACE EXACTAMENTE: tres operaciones y ninguna más.
 *
 * 1. `prepararIdentidad` — durante el REGISTRO. Reserva la cuenta humana de la
 *    persona, crea en el proveedor un usuario DESHABILITADO cuyo username es la
 *    referencia de la solicitud, y persiste el `sub` real en
 *    `ExternalAuthIdentity`. NO activa nada y NO crea participación.
 * 2. `aprovisionar` — la SAGA que sigue a una aprobación, a un reintento o a una
 *    reactivación. Activa el usuario en el proveedor, crea la participación
 *    mínima, activa la cuenta y solo entonces escribe `APPROVED`. Cualquier fallo
 *    deja `PROVISIONING_FAILED`, cuenta deshabilitada y acción reintentable.
 * 3. `desactivarCuentaWithin` — al suspender o revocar. Deshabilita la cuenta,
 *    revoca todas sus sesiones y, si procede, desvincula la identidad externa,
 *    TODO dentro de la transacción de la decisión.
 *
 * ARQUITECTURA DE TRANSACCIONES. La llamada externa NUNCA ocurre dentro de una
 * transacción de base de datos: abrir una, salir a la red y volver a escribir
 * deja bloqueadas las filas durante toda la espera y convierte un proveedor
 * lento en un bloqueo sostenido sobre la bandeja. El orden es siempre
 * transacción → llamada → transacción, y la transacción final relee con una
 * condición (`status = APPROVED_PENDING_PROVISIONING`) de modo que dos sagas
 * concurrentes no puedan escribir dos veces el mismo resultado.
 *
 * QUÉ NO HACE —y no debe crecer sin un paquete aprobado—:
 * - NO crea relaciones Cuidador-Paciente, asignaciones profesionales, visitas,
 *   permisos clínicos ni pagos.
 * - NO recibe ni conserva la contraseña. Sólo `prepararIdentidad` la ve, y la
 *   consume dentro de UNA llamada al cliente.
 * - NO decide: el estado de la solicitud lo escribe la banda de revisión o la
 *   propia saga, nunca este servicio de forma autónoma.
 * - NO acepta tenant del cliente: todo ocurre dentro de `withTenant` con un
 *   `tenantId` que llega de la sesión institucional o del servidor.
 */

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  API_ENVIRONMENT,
  type ApiEnvironmentProvider,
} from '../config/api-environment.provider';

/*
 * `AuditService`, `PrismaService` y `TenantContextService` se importan como
 * VALOR: Nest los resuelve por su clase y esa clase sólo llega al contenedor a
 * través de la metadata del decorador del constructor. Un `import type` se borra
 * en la compilación y la inyección falla en el arranque. `PrismaTransaction` sí
 * es un tipo y se importa como tal.
 */
/* eslint-disable @typescript-eslint/consistent-type-imports -- Ver la nota de arriba. */
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { findProfessionByCode } from '../hospital/hospital.contract';
import { findEpsByCode } from '../patients/enrollment.catalogs';

import {
  ACCESS_PROVISIONING_ERROR_CODES,
  ACCESS_PROVISIONING_MAX_ATTEMPTS,
  type AccessProvisioningErrorCode,
  type AccessProvisioningOutcome,
} from './access-provisioning.contract';
import {
  AccessProvisioningIdentityError,
  AccessProvisioningIdentityClient,
} from './access-provisioning-identity.client';

/** Estado que la saga exige en su PRIMERA transacción. */
const SAGA_ENTRY_STATUS = 'APPROVED_PENDING_PROVISIONING' as const;

/** Rutas lógicas, para la traza. Sin identificadores ni datos personales. */
const ENDPOINT_REGISTRO = 'POST /api/v1/access-requests';

/** Participación mínima de un solicitante PATIENT. Catálogos del SERVIDOR. */
const EPS_NO_SABE = 'NO_SABE';

/** Participación mínima de un solicitante FIELD_PROFESSIONAL. */
const PROFESSION_MEDICINA_GENERAL = 'MEDICINA_GENERAL';

/**
 * Resultado de la desactivación, para que quien decidió pueda construir su
 * traza sin volver a leer la base.
 */
export interface AccessProvisioningDeactivationResult {
  /** `true` si había al menos una sesión viva que revocar. */
  readonly sessionsRevoked: boolean;
  /** Vínculos externos que había que deshabilitar en el proveedor. */
  readonly externalSubjects: readonly string[];
}

@Injectable()
export class AccessProvisioningService {
  /**
   * Emisor del vínculo, ya resuelto desde la configuración.
   *
   * La configuración garantiza que es el MISMO emisor que autentica. `null`
   * significa que no hay provisión configurada en este despliegue y, por tanto,
   * que no hay vínculo posible: enlazar contra un emisor distinto del que
   * verifica el login dejaría la cuenta permanentemente inaccesible.
   */
  private readonly emisorConfigurado: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly identity: AccessProvisioningIdentityClient,
    @Inject(API_ENVIRONMENT) environment: ApiEnvironmentProvider,
  ) {
    this.emisorConfigurado = environment.accessProvisioning?.issuer ?? null;
  }

  /** Emisor exigido. Si falta, la operación se niega con causa cerrada. */
  private emisor(): string {
    if (this.emisorConfigurado === null) {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.notConfigured,
        'La provisión de identidad no está configurada en este despliegue.',
      );
    }

    return this.emisorConfigurado;
  }

  /* ---------------------------------------------------------------------- */
  /* 1. Preparación de identidad (registro)                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Prepara la identidad de una solicitud recién registrada.
   *
   * Tres pasos en tres transacciones separadas, con la llamada externa ENTRE
   * ellas:
   *
   * 1. reserva la `HumanAccount` de la `Person` bajo bloqueo de fila;
   * 2. crea el usuario DESHABILITADO en el proveedor;
   * 3. persiste el vínculo, enlaza la solicitud y audita.
   *
   * IDEMPOTENCIA. Si la solicitud ya tiene cuenta, se devuelve sin tocar nada:
   * un segundo registro de la misma persona con el mismo perfil devuelve la
   * misma referencia y no vuelve a llamar al proveedor. Si el proveedor
   * responde `409` por un username ya existente, el CLIENTE resuelve la
   * colisión con su marcador y devuelve el usuario de ESTA solicitud; dos
   * solicitudes distintas tienen dos referencias distintas y por tanto dos
   * usernames distintos, de modo que una colisión entre ellas no puede pasar
   * por una repetición.
   *
   * BLOQUEO DE LA `Person`. `HumanAccount` no tiene unicidad por persona —sería
   * un cambio de modelo fuera del alcance de MP04—, así que la exclusión entre
   * dos registros concurrentes de la MISMA persona se consigue bloqueando su fila
   * de `Person`. La segunda transacción espera, relee y encuentra la cuenta que
   * la primera acabó de crear, en lugar de crear una segunda.
   *
   * SIEMPRE SE ESCRIBE LA CUENTA ANTES QUE EL VÍNCULO: si el proveedor falla,
   * queda una cuenta sin identidad —visible, deshabilitada y reintentable— y no
   * una identidad apuntando a una cuenta que quizá no exista.
   *
   * @param password Contraseña ficticia. Se consume en la llamada al proveedor y
   *                 NO se copia a este método, a un log, a una excepción ni a la
   *                 respuesta. El llamante es responsable de no conservarla.
   */
  public async prepararIdentidad(
    contexto: {
      readonly tenantId: string;
      readonly personId: string;
      readonly accessRequestId: string;
      readonly reference: string;
      readonly password: string;
    },
    now: Date,
  ): Promise<void> {
    const { tenantId, personId, accessRequestId, reference, password } = contexto;

    const vinculada = await this.prisma.withTenant(tenantId, async (tx) => {
      const previa = await tx.accessRequest.findFirst({
        where: { id: accessRequestId, tenantId },
        select: { humanAccountId: true },
      });

      if (previa === null) {
        throw new Error('la solicitud a preparar no existe en el tenant');
      }

      if (previa.humanAccountId !== null) {
        return true;
      }

      const cuenta = await this.reservarCuenta(tx, tenantId, personId);
      return { humanAccountId: cuenta.id };
    });

    if (vinculada === true) {
      return;
    }

    const humanAccountId =
      typeof vinculada === 'object' ? vinculada.humanAccountId : (vinculada as never);

    let subject: string;

    try {
      const creado = await this.identity.createDisabledUser({
        username: reference,
        marker: accessRequestId,
        password,
      });
      subject = creado.id;
    } catch (error) {
      await this.auditarPreparacionFallida(tenantId, accessRequestId, now);
      throw error;
    }

    await this.prisma.withTenant(tenantId, async (tx) => {
      await this.vincularIdentidad(tx, tenantId, humanAccountId, subject);
      await this.enlazarSolicitud(tx, tenantId, accessRequestId, humanAccountId);

      await this.audit.recordAccessIdentityPreparedWithin(
        tx,
        {
          tenantId,
          accessRequestId,
          endpoint: ENDPOINT_REGISTRO,
          correlationId: randomUUID(),
        },
        now,
      );
    });
  }

  /**
   * Reserva la cuenta humana de una persona dentro de la transacción abierta.
   *
   * BLOQUEO `FOR UPDATE` sobre la fila de `Person`: es lo que convierte
   * «buscar o crear la cuenta» en una operación exclusiva por persona. Sin él,
   * dos registros concurrentes de la misma persona con perfiles distintos leen
   * a la vez «no hay cuenta», y las dos crean una: el resultado sería una
   * persona con dos cuentas y dos inicios de sesión que no se corresponden con
   * nada que el producto haya decidido.
   *
   * El identificador viaja PARAMETRIZADO, nunca interpolado en el texto SQL.
   */
  private async reservarCuenta(
    tx: PrismaTransaction,
    tenantId: string,
    personId: string,
  ): Promise<{ readonly id: string }> {
    const bloqueadas = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "person"
       WHERE "id" = ${personId}::uuid
         AND "tenantId" = ${tenantId}::uuid
       FOR UPDATE
    `;

    if (bloqueadas.length !== 1) {
      throw new Error('la persona de la solicitud no existe en el tenant');
    }

    const existente = await tx.humanAccount.findFirst({
      where: { tenantId, personId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (existente !== null) {
      return existente;
    }

    const creada = await tx.humanAccount.create({
      data: {
        tenantId,
        personId,
        /*
         * Nace DESHABILITADA. Una cuenta activa sin aprobación sería exactamente
         * el acceso que este paquete existe para impedir: la aprobación es lo que
         * la activa, y sólo ella.
         */
        status: 'DISABLED',
      },
      select: { id: true },
    });

    return creada;
  }

  /** Persiste el `sub` real, reutilizando el vínculo si ya existe. */
  private async vincularIdentidad(
    tx: PrismaTransaction,
    tenantId: string,
    humanAccountId: string,
    subject: string,
  ): Promise<void> {
    const issuer = this.emisor();

    const previo = await tx.externalAuthIdentity.findFirst({
      where: { tenantId, issuer, subject },
      select: { id: true },
    });

    if (previo !== null) {
      return;
    }

    await tx.externalAuthIdentity.create({
      data: {
        tenantId,
        humanAccountId,
        issuer,
        subject,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
  }

  /** Apunta la solicitud a su cuenta. Condicional: una carrera no reescribe. */
  private async enlazarSolicitud(
    tx: PrismaTransaction,
    tenantId: string,
    accessRequestId: string,
    humanAccountId: string,
  ): Promise<void> {
    const enlazada = await tx.accessRequest.updateMany({
      where: { id: accessRequestId, tenantId, humanAccountId: null },
      data: { humanAccountId },
    });

    if (enlazada.count === 0) {
      // Otra carrera ya la enlazó a la MISMA cuenta. Si apuntara a otra, la
      // condición `humanAccountId: null` la habría dejado intacta y aquí
      // habría que abortar; se comprueba explícitamente.
      const actual = await tx.accessRequest.findFirst({
        where: { id: accessRequestId, tenantId },
        select: { humanAccountId: true },
      });

      if (actual === null || actual.humanAccountId !== humanAccountId) {
        throw new Error('la solicitud quedo enlazada a una cuenta distinta');
      }
    }
  }

  /** Audita el fallo de preparación en SU PROPIA transacción. */
  private async auditarPreparacionFallida(
    tenantId: string,
    accessRequestId: string,
    now: Date,
  ): Promise<void> {
    try {
      await this.prisma.withTenant(tenantId, (tx) =>
        this.audit.recordAccessIdentityPreparationFailedWithin(
          tx,
          {
            tenantId,
            accessRequestId,
            endpoint: ENDPOINT_REGISTRO,
            correlationId: randomUUID(),
          },
          now,
        ),
      );
    } catch {
      /*
       * La preparación YA falló: el error original es el que debe propagarse.
       * Un fallo al registrar el fallo no puede sustituirlo por un error de
       * auditoría, que describiría una causa distinta de la que ocurrió.
       */
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 2. Saga de provisión                                                    */
  /* ---------------------------------------------------------------------- */

  /**
   * Ejecuta la saga completa sobre una solicitud ya en
   * `APPROVED_PENDING_PROVISIONING`.
   *
   * FASES, cada una en su propia transacción:
   *
   * A. contabiliza el intento y marca `provisioningStatus = PENDING`;
   * B. llamada EXTERNA: confirma que el usuario existe y lo habilita;
   * C. escritura final: participación mínima + cuenta `ACTIVE` + `APPROVED`.
   *
   * El desenlace se fija con `updateMany` CONDICIONADO a
   * `status = APPROVED_PENDING_PROVISIONING`. Dos sagas concurrentes sobre la
   * misma solicitud no pueden ambas escribir el resultado: la segunda encuentra
   * cero filas y devuelve el resultado vigente sin repetir la participación.
   *
   * NUNCA deja acceso utilizable en un fallo: la cuenta se (re)escribe como
   * `DISABLED` en el mismo movimiento que `PROVISIONING_FAILED`.
   */
  public async aprovisionar(
    contexto: {
      readonly tenantId: string;
      readonly accessRequestId: string;
      readonly endpoint: string;
    },
    now: Date,
  ): Promise<AccessProvisioningOutcome> {
    const { tenantId, accessRequestId, endpoint } = contexto;

    const previo = await this.prisma.withTenant(tenantId, (tx) =>
      tx.accessRequest.findFirst({
        where: { id: accessRequestId, tenantId },
        select: {
          status: true,
          personId: true,
          requestedProfile: true,
          humanAccountId: true,
          provisioningAttempts: true,
        },
      }),
    );

    if (previo === null || previo.status !== SAGA_ENTRY_STATUS) {
      return this.fallar(
        tenantId,
        accessRequestId,
        endpoint,
        now,
        ACCESS_PROVISIONING_ERROR_CODES.identityNotFound,
      );
    }

    if (previo.humanAccountId === null) {
      /*
       * No hay cuenta porque la preparación nunca concluyó. Este servicio NO
       * tiene la contraseña —nunca la guarda— y crear un usuario sin ella
       * produciría una cuenta inaccesible. Se falla con un código que dice
       * exactamente eso, y la solicitud queda reintentable.
       */
      return this.fallar(
        tenantId,
        accessRequestId,
        endpoint,
        now,
        ACCESS_PROVISIONING_ERROR_CODES.passwordUnavailable,
      );
    }

    if (previo.provisioningAttempts >= ACCESS_PROVISIONING_MAX_ATTEMPTS) {
      return this.fallar(
        tenantId,
        accessRequestId,
        endpoint,
        now,
        ACCESS_PROVISIONING_ERROR_CODES.retryLimitReached,
      );
    }

    /*
     * Se fija en una `const` LOCAL. El estrechamiento de un campo sobre una
     * variable que un cierre vuelve a leer no sobrevive al cuerpo del cierre, y
     * aquí el identificador es exactamente lo que no puede ser `null` dentro de
     * las tres fases siguientes: sin esta copia, TypeScript o no lo sabe, o lo
     * sabe y lo olvida en cuanto empieza el callback.
     */
    const humanAccountId = previo.humanAccountId;

    // --- Fase A: contabilizar el intento -----------------------------------
    const inicio = await this.prisma.withTenant(tenantId, async (tx) => {
      const contado = await tx.accessRequest.updateMany({
        where: {
          id: accessRequestId,
          tenantId,
          status: SAGA_ENTRY_STATUS,
          provisioningAttempts: { lt: ACCESS_PROVISIONING_MAX_ATTEMPTS },
        },
        data: {
          provisioningAttempts: { increment: 1 },
          provisioningStartedAt: now,
          provisioningStatus: 'PENDING',
        },
      });

      if (contado.count === 0) {
        return false;
      }

      const vinculo = await tx.externalAuthIdentity.findFirst({
        where: {
          tenantId,
          humanAccountId,
          status: 'ACTIVE',
        },
        select: { subject: true },
        orderBy: { createdAt: 'asc' },
      });

      return vinculo === null ? null : vinculo.subject;
    });

    if (inicio === false) {
      // Otra saga corrió por delante: se devuelve su resultado vigente.
      return this.leerResultado(tenantId, accessRequestId);
    }

    if (inicio === null) {
      return this.fallar(
        tenantId,
        accessRequestId,
        endpoint,
        now,
        ACCESS_PROVISIONING_ERROR_CODES.identityNotFound,
      );
    }

    // --- Fase B: llamada EXTERNA, fuera de cualquier transacción ------------
    try {
      await this.identity.getUser(inicio);
      await this.identity.setEnabled(inicio, true);
    } catch (error) {
      return this.fallar(
        tenantId,
        accessRequestId,
        endpoint,
        now,
        error instanceof AccessProvisioningIdentityError
          ? error.code
          : ACCESS_PROVISIONING_ERROR_CODES.unavailable,
      );
    }

    // --- Fase C: escritura final -------------------------------------------
    try {
      await this.prisma.withTenant(tenantId, async (tx) => {
        await this.crearParticipacionMinima(
          tx,
          tenantId,
          previo.personId,
          previo.requestedProfile,
          now,
        );

        await tx.humanAccount.updateMany({
          where: { id: humanAccountId, tenantId },
          data: { status: 'ACTIVE' },
        });

        const cerrada = await tx.accessRequest.updateMany({
          where: { id: accessRequestId, tenantId, status: SAGA_ENTRY_STATUS },
          data: {
            status: 'APPROVED',
            provisioningStatus: 'SUCCEEDED',
            provisioningErrorCode: null,
            provisioningLastErrorAt: null,
            version: { increment: 1 },
          },
        });

        if (cerrada.count === 0) {
          throw new Error('la solicitud dejo de esperar provision durante la saga');
        }

        await this.audit.recordAccessProvisioningSucceededWithin(
          tx,
          { tenantId, accessRequestId, endpoint, correlationId: randomUUID() },
          now,
        );
      });
    } catch (error) {
      return this.fallar(
        tenantId,
        accessRequestId,
        endpoint,
        now,
        error instanceof AccessProvisioningIdentityError
          ? error.code
          : ACCESS_PROVISIONING_ERROR_CODES.participationFailed,
      );
    }

    return { ok: true, status: 'APPROVED' };
  }

  /**
   * Escribe el desenlace FRACASADO de la saga.
   *
   * Todo en UNA transacción: estado `PROVISIONING_FAILED`, provisión `FAILED`,
   * código cerrado, Cuenta `DISABLED` y auditoría. Si la auditoría no puede
   * escribirse, la transacción se revierte entera y la solicitud sigue esperando
   * en `APPROVED_PENDING_PROVISIONING`, que es un estado también reintentable:
   * no existe un fallo de provisión sin su traza.
   *
   * `version` se incrementa porque la fila CAMBIÓ: un cliente que reenviara la
   * versión anterior debe recibir `409`, no una aprobación aparente.
   */
  private async fallar(
    tenantId: string,
    accessRequestId: string,
    endpoint: string,
    now: Date,
    code: AccessProvisioningErrorCode,
  ): Promise<AccessProvisioningOutcome> {
    await this.prisma.withTenant(tenantId, async (tx) => {
      const cuenta = await tx.accessRequest.findFirst({
        where: { id: accessRequestId, tenantId },
        select: { humanAccountId: true },
      });

      if (cuenta !== null && cuenta.humanAccountId !== null) {
        await tx.humanAccount.updateMany({
          where: { id: cuenta.humanAccountId, tenantId },
          data: { status: 'DISABLED' },
        });
      }

      const fallida = await tx.accessRequest.updateMany({
        where: { id: accessRequestId, tenantId, status: SAGA_ENTRY_STATUS },
        data: {
          status: 'PROVISIONING_FAILED',
          provisioningStatus: 'FAILED',
          provisioningErrorCode: code,
          provisioningLastErrorAt: now,
          version: { increment: 1 },
        },
      });

      if (fallida.count === 0) {
        // Otra saga ya cerró esta solicitud. No hay nada que registrar aquí:
        // el resultado vigente es el de esa otra saga.
        return;
      }

      await this.audit.recordAccessProvisioningFailedWithin(
        tx,
        { tenantId, accessRequestId, endpoint, correlationId: randomUUID() },
        now,
      );
    });

    return { ok: false, status: 'PROVISIONING_FAILED', code };
  }

  /** Lee el resultado vigente cuando otra saga ganó la carrera. */
  private async leerResultado(
    tenantId: string,
    accessRequestId: string,
  ): Promise<AccessProvisioningOutcome> {
    const actual = await this.prisma.withTenant(tenantId, (tx) =>
      tx.accessRequest.findFirst({
        where: { id: accessRequestId, tenantId },
        select: { status: true, provisioningErrorCode: true },
      }),
    );

    if (actual?.status === 'APPROVED') {
      return { ok: true, status: 'APPROVED' };
    }

    return {
      ok: false,
      status: 'PROVISIONING_FAILED',
      code:
        (actual?.provisioningErrorCode as AccessProvisioningErrorCode | null) ??
        ACCESS_PROVISIONING_ERROR_CODES.unavailable,
    };
  }

  /**
   * Participación mínima del perfil APROBADO.
   *
   * CREADA O REUTILIZADA, nunca duplicada: las tablas tienen unicidad
   * `(personId, tenantId)` y la relectura previa hace que una segunda saga no
   * cree un segundo paciente ni un segundo perfil.
   *
   * PATIENT: `Patient` con `NO_SABE` / `No sabe` y origen
   * `PUBLIC_SELF_ENROLLMENT`. NO se inventan poblaciones, dirección,
   * consentimiento ni relación: eso pertenece a la inscripción completa, que
   * exige territorio y consentimiento que este formulario no recoge.
   *
   * CAREGIVER: NO se crea nada. Una cuenta cuidadora aprobada recibe la
   * experiencia neutra; sin relación declarada no hay contexto, no hay datos
   * nominales y no hay visitas que mostrar.
   *
   * FIELD_PROFESSIONAL: perfil `MEDICINA_GENERAL` y afiliación ficticia
   * `THIRD_PARTY` vigente desde la fecha UTC de hoy. NO se crea asignación,
   * paciente, visita ni permiso clínico: cada recurso profesional sigue
   * exigiendo su propia asignación.
   */
  private async crearParticipacionMinima(
    tx: PrismaTransaction,
    tenantId: string,
    personId: string,
    requestedProfile: string,
    now: Date,
  ): Promise<void> {
    if (requestedProfile === 'CAREGIVER') {
      return;
    }

    if (requestedProfile === 'PATIENT') {
      const previo = await tx.patient.findFirst({
        where: { tenantId, personId },
        select: { id: true },
      });

      if (previo !== null) {
        return;
      }

      const eps = findEpsByCode(EPS_NO_SABE);

      if (eps === undefined) {
        // Catálogo del servidor: si desapareciera, no se aprueba con un valor
        // inventado. El fallo queda como `participationFailed`.
        throw new Error('el catalogo controlado de EPS no contiene NO_SABE');
      }

      await tx.patient.create({
        data: {
          tenantId,
          personId,
          epsCode: eps.code,
          epsNameControlled: eps.name,
          status: 'ACTIVE',
          origin: 'PUBLIC_SELF_ENROLLMENT',
          enrolledAt: now,
          createdByUserId: null,
        },
        select: { id: true },
      });

      return;
    }

    if (requestedProfile === 'FIELD_PROFESSIONAL') {
      const profesion = findProfessionByCode(PROFESSION_MEDICINA_GENERAL);

      if (profesion === undefined) {
        // Mismo criterio que con la EPS: si el catálogo controlado desapareciera,
        // no se alta con un nombre inventado.
        throw new Error('el catalogo controlado de profesiones no contiene MEDICINA_GENERAL');
      }

      let perfil = await tx.professionalProfile.findFirst({
        where: { tenantId, personId },
        select: { id: true },
      });

      if (perfil === null) {
        perfil = await tx.professionalProfile.create({
          data: {
            tenantId,
            personId,
            professionCode: profesion.code,
            professionNameControlled: profesion.name,
            status: 'ACTIVE',
          },
          select: { id: true },
        });
      }

      const previa = await tx.professionalAffiliation.findFirst({
        where: {
          tenantId,
          professionalId: perfil.id,
          engagementType: 'THIRD_PARTY',
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (previa !== null) {
        return;
      }

      await tx.professionalAffiliation.create({
        data: {
          tenantId,
          professionalId: perfil.id,
          engagementType: 'THIRD_PARTY',
          status: 'ACTIVE',
          startsOn: aFechaUtc(now),
          endsOn: null,
        },
        select: { id: true },
      });

      return;
    }

    throw new Error(`perfil solicitado fuera de catalogo: ${requestedProfile}`);
  }

  /* ---------------------------------------------------------------------- */
  /* 3. Desactivación (suspender / revocar)                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Desactiva la cuenta DENTRO de la transacción de la decisión.
   *
   * Es la mitad AUTORITATIVA del bloqueo. `HumanAccount.status = DISABLED` hace
   * que el validador de sesión rechace cualquier petición siguiente —incluida
   * la de una cookie todavía no caducada— y la revocación de sesiones impide que
   * una cookie antigua vuelva a emitir una. Ambas cosas ocurren en la MISMA
   * transacción que el cambio de estado de la solicitud: si la decisión se
   * confirma, el acceso ya estaba bloqueado en ese mismo instante.
   *
   * La sincronización con el proveedor NO está aquí a propósito. Es externa,
   * puede fallar y su fallo NO debe debilitar el bloqueo: por eso se ejecuta
   * DESPUÉS, por quien tomó la decisión, y su resultado se registra aparte.
   *
   * @param unlinkIdentity `true` sólo en `REVOKE`: el vínculo pasa a `UNLINKED`
   *                       y se conserva como historia, no se borra.
   */
  public async desactivarCuentaWithin(
    tx: PrismaTransaction,
    contexto: {
      readonly tenantId: string;
      readonly humanAccountId: string;
      readonly unlinkIdentity: boolean;
    },
    now: Date,
  ): Promise<AccessProvisioningDeactivationResult> {
    const { tenantId, humanAccountId, unlinkIdentity } = contexto;

    await tx.humanAccount.updateMany({
      where: { id: humanAccountId, tenantId },
      data: { status: 'DISABLED' },
    });

    const vivas = await tx.humanSession.findMany({
      where: { tenantId, humanAccountId, revokedAt: null },
      select: { id: true },
    });

    if (vivas.length > 0) {
      await tx.humanSession.updateMany({
        where: { tenantId, humanAccountId, revokedAt: null },
        data: { revokedAt: now },
      });
    }

    const vinculos = await tx.externalAuthIdentity.findMany({
      where: { tenantId, humanAccountId },
      select: { subject: true, status: true },
    });

    if (unlinkIdentity) {
      await tx.externalAuthIdentity.updateMany({
        where: { tenantId, humanAccountId, status: 'ACTIVE' },
        data: { status: 'UNLINKED', unlinkedAt: now },
      });
    }

    return {
      sessionsRevoked: vivas.length > 0,
      externalSubjects: vinculos
        .filter((vinculo) => vinculo.status === 'ACTIVE')
        .map((vinculo) => vinculo.subject),
    };
  }

  /**
   * Sincroniza `enabled = false` con el proveedor. BEST-EFFORT y SIEMPRE
   * después de que el bloqueo MERDN ya esté confirmado.
   *
   * Su fallo se REGISTRA pero no cambia nada: la cuenta ya está deshabilitada y
   * las sesiones ya revocadas dentro de la transacción. Devuelve `true` sólo
   * cuando el proveedor confirmó, para que el llamante pueda dejar constancia
   * del desenlace sin que esa constancia sea lo que decide el resultado.
   */
  public async sincronizarDeshabilitacion(
    subjects: readonly string[],
  ): Promise<boolean> {
    let conforme = true;

    for (const subject of subjects) {
      try {
        await this.identity.setEnabled(subject, false);
      } catch {
        conforme = false;
      }
    }

    return conforme;
  }

  /* ---------------------------------------------------------------------- */
  /* Utilidades                                                              */
  /* ---------------------------------------------------------------------- */
}

/** Fecha UTC SIN componente horario, para `ProfessionalAffiliation.startsOn`. */
function aFechaUtc(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
