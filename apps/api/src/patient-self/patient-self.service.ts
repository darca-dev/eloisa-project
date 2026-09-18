import { Inject, Injectable } from '@nestjs/common';

import {
  AuditService,
  PATIENT_SELF_RESOURCES,
  type PatientSelfResource,
} from '../audit/audit.service';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { PrismaService } from '../database/prisma.service';
import { type HumanPrincipal } from '../identity-access/human-principal';
import { IdentityAccessService } from '../identity-access/identity-access.service';

import {
  PATIENT_SELF_LABEL,
  PATIENT_SELF_MAX_ITEMS,
  type PatientSelfAppointmentView,
  type PatientSelfListView,
  type PatientSelfSummaryView,
  type PatientSelfVisitView,
} from './patient-self.contract';

/**
 * Lectura SELF-SCOPE del Paciente (spec 021 §6.6-e a §6.11, §8, §9;
 * `contracts/paciente-self-scope.contract.md`).
 *
 * Responde a UNA sola pregunta, tres veces: «¿qué tengo YO?». No es un listado
 * institucional, no es un directorio y no es una búsqueda.
 *
 * EL SUJETO NO ENTRA, SALE. Ninguna función pública de este servicio recibe
 * `patientId`, `personId`, documento, tenant ni institución: todas parten del
 * `HumanPrincipal`, que solo puede haber construido el validador de sesión, y
 * derivan el paciente con `resolvePatient` del módulo de identidad, que se
 * reutiliza TAL CUAL y no se duplica aquí (§13 lo prohíbe modificar, y además
 * duplicar la resolución duplicaría la superficie de seguridad).
 *
 * DOS BARRERAS DE AISLAMIENTO, NO UNA. Toda consulta va dentro de
 * `withTenant()` —rol `merdn_runtime` de mínimo privilegio, tenant activo fijado
 * en la transacción y Row Level Security vigente— Y ADEMÁS repite el filtro
 * explícito por `tenantId` en la cita, en el paciente y en la visita. La
 * redundancia es deliberada.
 *
 * FAIL-CLOSED EN CINCO CAMINOS (§3.5 del contrato): sin principal no se llega
 * aquí; sin participación de paciente ACTIVE se deniega; un contexto de
 * ejecución no seguro propaga `RuntimeContextUnavailableError` y NUNCA se
 * traduce a una lista vacía; un fallo de la auditoría obligatoria aborta la
 * transacción; y una fila cuya procedencia no se confirma no se proyecta.
 *
 * AUDITORÍA DENTRO DE LA MISMA TRANSACCIÓN que sirve los datos (§9.2-6): si el
 * evento obligatorio no se persiste, la transacción se aborta y no existe
 * lectura servida sin su traza. La auditoría se escribe con el `AuditService`
 * EXISTENTE: este módulo no crea uno propio (§17.D-1).
 *
 * SOLO LECTURA. Ningún camino de este archivo ejecuta `create`, `update`,
 * `delete` ni `upsert` sobre dato de negocio alguno. La única escritura es el
 * evento de auditoría, que es append-only.
 */

/** Desenlace de la resolución del sujeto. Cerrado y sin variantes intermedias. */
export type PatientSelfDenialReason = 'NO_PATIENT_CONTEXT';

/**
 * Denegación con principal humano RESOLUBLE.
 *
 * Se distingue en el tipo, y no por una cadena suelta, para que el controlador
 * no pueda confundirla con un fallo de sesión —que NO produce evento— ni con un
 * fallo de contexto runtime —que produce `503`—.
 */
export class PatientSelfAccessDeniedError extends Error {
  public readonly reason: PatientSelfDenialReason;

  public constructor(reason: PatientSelfDenialReason) {
    /*
     * El mensaje es OPACO a propósito: no nombra a la persona, no nombra al
     * paciente y no dice si existe alguno asociado. Un mensaje detallado en un
     * log ya permitiría deducirlo (§3.4).
     */
    super('Acceso propio del Paciente denegado.');
    this.name = 'PatientSelfAccessDeniedError';
    this.reason = reason;
  }
}

@Injectable()
export class PatientSelfService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityAccessService) private readonly identity: IdentityAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * Resumen del Paciente: TRES campos y ninguno más (§4.2, spec 021 §17.C-2).
   *
   * `label` NO se lee de la base: es la constante del contrato. Derivarla de un
   * dato la convertiría en un canal por el que comunicar un estado, y el
   * Product Owner decidió que es fija.
   */
  public async readSummary(
    principal: HumanPrincipal,
    correlationId: string,
    now: Date,
  ): Promise<PatientSelfSummaryView> {
    const { patientId } = await this.exigirPacientePropio(
      principal,
      correlationId,
      PATIENT_SELF_RESOURCES.summary,
      now,
    );

    return this.prisma.withTenant(principal.tenantId, async (tx) => {
      const persona = await tx.patient.findFirst({
        where: pacientePropio(principal, patientId),
        // Se seleccionan DOS columnas de nombre y ninguna más: ni documento, ni
        // fecha de nacimiento, ni sexo, ni EPS, ni territorio, ni contacto.
        select: { person: { select: { givenNames: true, familyNames: true } } },
      });

      if (persona === null) {
        /*
         * Inalcanzable con `resolvePatient` recién resuelto, salvo cambio
         * concurrente. Se resuelve CERRADO y con el MISMO desenlace que la
         * ausencia de contexto: no se inventa un resumen y no se distingue el
         * caso hacia fuera.
         */
        await this.registrarDenegacion(
          tx,
          principal,
          correlationId,
          PATIENT_SELF_RESOURCES.summary,
          now,
        );

        throw new PatientSelfAccessDeniedError('NO_PATIENT_CONTEXT');
      }

      // La traza se escribe ANTES de devolver y DENTRO de esta transacción.
      await this.audit.recordPatientSelfAccessGrantedWithin(
        tx,
        {
          tenantId: principal.tenantId,
          humanAccountId: principal.humanAccountId,
          resource: PATIENT_SELF_RESOURCES.summary,
          correlationId,
        },
        now,
      );

      return {
        givenName: primerNombre(persona.person.givenNames),
        initials: iniciales(persona.person.givenNames, persona.person.familyNames),
        label: PATIENT_SELF_LABEL,
      };
    });
  }

  /**
   * PRÓXIMAS citas propias (§4.3, spec 021 §6.8, §17.B-6).
   *
   * «Próximas» lo resuelve el SERVIDOR contra su propio instante: el cliente no
   * aporta ventana, orden, filtro ni paginación. Una cita sin `scheduledStart`
   * no está programada y queda fuera por construcción del filtro.
   */
  public async readAppointments(
    principal: HumanPrincipal,
    correlationId: string,
    now: Date,
  ): Promise<PatientSelfListView<PatientSelfAppointmentView>> {
    const { patientId } = await this.exigirPacientePropio(
      principal,
      correlationId,
      PATIENT_SELF_RESOURCES.appointments,
      now,
    );

    return this.prisma.withTenant(principal.tenantId, async (tx) => {
      const citas = await tx.appointment.findMany({
        where: {
          // Filtro explícito por tenant ADEMÁS de Row Level Security.
          tenantId: principal.tenantId,
          patientId,
          // Self-scope reafirmado en el lado del paciente: la fila debe ser del
          // MISMO tenant y de la MISMA persona autenticada.
          patient: pacientePropio(principal, patientId),
          scheduledStart: { gte: now },
        },
        // Ni un campo más de los tres del contrato. `id` se selecciona SOLO para
        // desempatar el orden y NO se proyecta.
        select: { id: true, scheduledStart: true, modality: true, status: true },
        // Orden ESTABLE: dos citas del mismo instante no pueden alternar.
        orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
        take: PATIENT_SELF_MAX_ITEMS,
      });

      await this.audit.recordPatientSelfAccessGrantedWithin(
        tx,
        {
          tenantId: principal.tenantId,
          humanAccountId: principal.humanAccountId,
          resource: PATIENT_SELF_RESOURCES.appointments,
          correlationId,
        },
        now,
      );

      return {
        items: citas.flatMap((cita) =>
          cita.scheduledStart === null
            ? // Inalcanzable con el filtro activo; defensa explícita que se
              // resuelve CERRADO: se descarta la fila en vez de inventar fecha.
              []
            : [
                {
                  scheduledStart: cita.scheduledStart.toISOString(),
                  modality: cita.modality,
                  status: cita.status,
                },
              ],
        ),
      };
    });
  }

  /**
   * Visitas propias RECIENTES (§4.4, spec 021 §6.9, §17.B-6).
   *
   * El horario se lee de `Appointment.scheduledStart`, que es la ÚNICA agenda
   * del sistema: `HomeVisit` no persiste fecha de programación propia. La
   * modalidad es la constante `HOME` del contrato, fijada por el propio filtro y
   * no reflejada de una columna.
   *
   * NO se proyecta la identidad institucional que materializó la visita, ni el
   * historial de transiciones, ni su actor: son datos de TERCEROS (§4.4).
   */
  public async readVisits(
    principal: HumanPrincipal,
    correlationId: string,
    now: Date,
  ): Promise<PatientSelfListView<PatientSelfVisitView>> {
    const { patientId } = await this.exigirPacientePropio(
      principal,
      correlationId,
      PATIENT_SELF_RESOURCES.visits,
      now,
    );

    return this.prisma.withTenant(principal.tenantId, async (tx) => {
      const visitas = await tx.homeVisit.findMany({
        where: {
          tenantId: principal.tenantId,
          patientId,
          patient: pacientePropio(principal, patientId),
          appointment: {
            tenantId: principal.tenantId,
            // «Recientes»: ya ocurridas o en curso según el instante del servidor.
            scheduledStart: { lte: now },
          },
        },
        select: {
          id: true,
          status: true,
          appointment: { select: { scheduledStart: true } },
        },
        orderBy: [{ appointment: { scheduledStart: 'desc' } }, { id: 'desc' }],
        take: PATIENT_SELF_MAX_ITEMS,
      });

      await this.audit.recordPatientSelfAccessGrantedWithin(
        tx,
        {
          tenantId: principal.tenantId,
          humanAccountId: principal.humanAccountId,
          resource: PATIENT_SELF_RESOURCES.visits,
          correlationId,
        },
        now,
      );

      return {
        items: visitas.flatMap((visita) => {
          const inicio = visita.appointment.scheduledStart;

          return inicio === null
            ? []
            : [
                {
                  scheduledStart: inicio.toISOString(),
                  // Constante del contrato, no reflejo de una columna.
                  modality: 'HOME' as const,
                  status: visita.status,
                },
              ];
        }),
      };
    });
  }

  /**
   * Deriva el paciente propio o DENIEGA, registrando el intento.
   *
   * Se llama al principio de las tres lecturas y es el ÚNICO origen del
   * `patientId` del módulo. `resolvePatient` ya exige `status = 'ACTIVE'` y la
   * `personId` del principal: un paciente inexistente, ajeno o no `ACTIVE`
   * devuelve `null`, y aquí eso es una denegación, no una lista vacía.
   *
   * La denegación SÍ produce evento —hay principal humano resoluble— y por eso
   * se registra antes de lanzar. Una petición SIN principal nunca llega hasta
   * aquí: la corta el guard con un `401` uniforme y sin evento (§9.2-1, §9.2-2).
   */
  private async exigirPacientePropio(
    principal: HumanPrincipal,
    correlationId: string,
    resource: PatientSelfResource,
    now: Date,
  ): Promise<{ readonly patientId: string }> {
    const resuelto = await this.identity.resolvePatient(principal);

    if (resuelto !== null) {
      return resuelto;
    }

    /*
     * ATRIBUCIÓN DEL INTENTO DENEGADO. El evento registra la proyección que se
     * SOLICITÓ —`resource`, que cada lectura pasa desde su propia ruta—, y no
     * una fija. Registrar siempre el resumen atribuiría a `/summary` un intento
     * hecho contra `/appointments` o `/visits`: la traza describiría un acceso
     * que nunca se intentó y perdería el que sí ocurrió. La correspondencia
     * `resourceType` ↔ `endpoint` es CERRADA y uno a uno (§9.1, §17.D-1), de
     * modo que atribuir mal el recurso atribuye mal también el endpoint.
     *
     * Esto NO revela nada de más: el `resourceType` describe la RUTA que atendió
     * la petición, que el cliente ya conoce porque es la que llamó. Lo que la
     * spec prohíbe registrar es el MOTIVO detallado de la denegación (§9.2-5),
     * y ese sigue sin escribirse: el evento no dice si existe un paciente
     * asociado ni por qué no resolvió.
     *
     * La denegación se audita en su propia transacción porque no hay lectura de
     * datos que proteger: no se sirve ninguna fila. Si el evento obligatorio no
     * se persiste, el error se propaga y la respuesta NO es un `403` limpio sin
     * traza: falla, que es el desenlace fail-closed correcto (§9.2-6).
     */
    await this.prisma.withTenant(principal.tenantId, async (tx) => {
      await this.registrarDenegacion(tx, principal, correlationId, resource, now);
    });

    throw new PatientSelfAccessDeniedError('NO_PATIENT_CONTEXT');
  }

  /** Registro del intento DENEGADO. Solo con principal humano resoluble. */
  private async registrarDenegacion(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    correlationId: string,
    resource: PatientSelfResource,
    now: Date,
  ): Promise<void> {
    await this.audit.recordPatientSelfAccessDeniedWithin(
      tx,
      {
        tenantId: principal.tenantId,
        humanAccountId: principal.humanAccountId,
        resource,
        correlationId,
      },
      now,
    );
  }
}

/**
 * Condición de SELF-SCOPE sobre la fila de paciente.
 *
 * Repite las tres condiciones a la vez —tenant, identificador ya resuelto y
 * persona autenticada— además de exigir `ACTIVE`. `patientId` NO viene del
 * cliente: lo produjo `resolvePatient` unas líneas antes, desde el principal.
 */
function pacientePropio(
  principal: HumanPrincipal,
  patientId: string,
): {
  readonly id: string;
  readonly tenantId: string;
  readonly personId: string;
  readonly status: 'ACTIVE';
} {
  return {
    id: patientId,
    tenantId: principal.tenantId,
    personId: principal.personId,
    status: 'ACTIVE',
  };
}

/**
 * Nombre de PILA: el primero de los nombres declarados.
 *
 * Es una proyección de PRESENTACIÓN. No es el nombre completo, no incluye
 * apellidos y no es un identificador con el que se pueda buscar.
 */
function primerNombre(givenNames: string): string {
  return givenNames.trim().split(/\s+/u)[0] ?? '';
}

/**
 * Iniciales del primer nombre y del primer apellido.
 *
 * Abreviatura de presentación, no clave ni identificador. Misma forma que ya usa
 * la worklist profesional, para que la misma persona se vea igual en las dos
 * superficies.
 */
function iniciales(givenNames: string, familyNames: string): string {
  const primera = (valor: string): string =>
    (valor.trim().split(/\s+/u)[0] ?? '').slice(0, 1).toLocaleUpperCase('es-CO');

  return `${primera(givenNames)}${primera(familyNames)}`;
}
