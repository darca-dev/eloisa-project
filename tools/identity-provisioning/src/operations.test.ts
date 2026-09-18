import { describe, expect, it } from 'vitest';

import { AUDIT_ENDPOINT, AUDIT_RESOURCE } from './contract.ts';
import { type SqlRunner } from './database.ts';
import { runOperation } from './operations.ts';
import {
  type DisableAccountOperation,
  type LinkOperation,
  type ProvisioningOperation,
  type UnlinkOperation,
} from './parse.ts';

/**
 * Vinculación de una identidad externa con una `Person` que YA existe
 * (IDENTITY-RELATIONSHIPS-CORE-01 §9, continuación §4.2).
 *
 * QUÉ SE PRUEBA AQUÍ: que vincular sea idempotente, que un `subject` ajeno no
 * pueda reasignarse, que un conflicto no deje ni media escritura, que un tenant
 * no alcance el vínculo de otro y que la auditoría no publique el emisor, el
 * `subject` ni el documento de nadie; y que `UNLINK` y `DISABLE_ACCOUNT` cierren
 * el acceso EN EL ACTO —revocando toda sesión viva en la misma operación—, sean
 * idempotentes y no alcancen a otro tenant.
 *
 * CÓMO SE PRUEBA: con una base FICTICIA en memoria que interpreta exactamente
 * las sentencias que emite `operations.ts` y aplica las mismas barreras que
 * PostgreSQL aplicaría —filtro por tenant en toda lectura y escritura, unicidad
 * de `(tenantId, issuer, subject)` y claves foráneas dentro del mismo tenant—.
 * Lo que se verifica es la LÓGICA de la operación y el conjunto exacto de
 * escrituras que emite; las garantías del motor (RLS, CHECK, transacción) viven
 * en las pruebas de base de datos y no se suplantan desde aquí.
 *
 * Todos los emisores, `subject`, personas y documentos son FICTICIOS.
 */

const TENANT_A = '00000000-0000-0000-0000-00000000a001';
const TENANT_B = '00000000-0000-0000-0000-00000000b001';
const PERSONA_A = '00000000-0000-0000-0000-0000000000a1';
const OTRA_PERSONA_A = '00000000-0000-0000-0000-0000000000a2';
const PERSONA_B = '00000000-0000-0000-0000-0000000000b1';

/** Documentos FICTICIOS: existen solo para comprobar que NO se auditan. */
const DOCUMENTO_A = '99000000001';
const DOCUMENTO_OTRA_A = '99000000002';
const DOCUMENTO_B = '99000000003';

const EMISOR = 'http://host.docker.internal:8081/realms/merdn-local';
const SUJETO = 'sujeto-ficticio-de-pruebas-0001';
const CORRELACION = '00000000-0000-0000-0000-0000000000c1';

interface FilaPersona {
  readonly id: string;
  readonly tenantId: string;
  readonly documentNumber: string;
}

interface FilaCuenta {
  readonly id: string;
  readonly tenantId: string;
  readonly personId: string;
  status: string;
}

interface FilaVinculo {
  readonly id: string;
  readonly tenantId: string;
  readonly humanAccountId: string;
  readonly issuer: string;
  readonly subject: string;
  status: string;
  unlinkedAt: string | null;
}

interface FilaSesion {
  readonly id: string;
  readonly tenantId: string;
  readonly humanAccountId: string;
  revokedAt: string | null;
}

interface FilaAuditoria {
  readonly tenantId: string;
  readonly eventType: string;
  readonly actorType: string;
  readonly actorUserId: string | null;
  readonly actorRole: string | null;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly outcome: string;
  readonly endpoint: string;
  readonly correlationId: string;
}

/** Sentencia que MODIFICA estado. Las lecturas no se registran. */
interface Escritura {
  readonly tabla: string;
  readonly values: readonly unknown[];
}

/**
 * Base FICTICIA en memoria.
 *
 * Reconoce las sentencias por su tabla y su verbo, y falla ruidosamente ante
 * cualquier otra: si `operations.ts` empezara a emitir una consulta distinta,
 * estas pruebas dejarían de pasar en vez de aprobarla sin mirar.
 */
class BaseFicticia implements SqlRunner {
  public readonly personas: FilaPersona[] = [];
  public readonly cuentas: FilaCuenta[] = [];
  public readonly vinculos: FilaVinculo[] = [];
  public readonly sesiones: FilaSesion[] = [];
  public readonly auditoria: FilaAuditoria[] = [];
  /** Toda escritura emitida, en orden. Vacía = la operación no tocó nada. */
  public readonly escrituras: Escritura[] = [];

  public constructor(personas: readonly FilaPersona[]) {
    this.personas.push(...personas);
  }

  /** Retrato del estado persistido, para comparar antes y después. */
  public estado(): string {
    return JSON.stringify({
      cuentas: this.cuentas,
      vinculos: this.vinculos,
      sesiones: this.sesiones,
      auditoria: this.auditoria,
    });
  }

  public async query<T>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const sql = text.replace(/\s+/gu, ' ').trim();

    if (sql.startsWith('SELECT "id" FROM "person"')) {
      return this.personas.filter(
        (persona) => persona.id === values[0] && persona.tenantId === values[1],
      ) as unknown as readonly T[];
    }

    if (sql.includes('FROM "external_auth_identity" v')) {
      return this.buscarVinculo(values) as unknown as readonly T[];
    }

    if (sql.includes('FROM "human_account"') && sql.includes('FOR UPDATE')) {
      return this.cuentas
        .filter((cuenta) => cuenta.id === values[0] && cuenta.tenantId === values[1])
        .map((cuenta) => ({ status: cuenta.status })) as unknown as readonly T[];
    }

    if (sql.startsWith('UPDATE "external_auth_identity"')) {
      // Las dos sentencias tocan la misma tabla: se distinguen por el estado
      // al que llevan la fila, nunca por el orden en que llegan.
      return (
        sql.includes(`"status" = 'UNLINKED'`)
          ? this.desvincular(values)
          : this.reactivarVinculo(values)
      ) as unknown as readonly T[];
    }

    if (sql.startsWith('UPDATE "human_account"')) {
      return this.deshabilitarCuenta(values) as unknown as readonly T[];
    }

    if (sql.startsWith('UPDATE "human_session"')) {
      return this.revocarSesiones(values) as unknown as readonly T[];
    }

    if (sql.startsWith('INSERT INTO "human_account"')) {
      return this.insertarCuenta(values) as unknown as readonly T[];
    }

    if (sql.startsWith('INSERT INTO "external_auth_identity"')) {
      return this.insertarVinculo(values) as unknown as readonly T[];
    }

    if (sql.startsWith('INSERT INTO "audit_event"')) {
      return this.insertarAuditoria(values) as unknown as readonly T[];
    }

    throw new Error(`Sentencia no prevista por la base ficticia: ${sql}`);
  }

  private buscarVinculo(values: readonly unknown[]): readonly unknown[] {
    // El tenant forma parte de la clave de búsqueda: un vínculo de otro tenant
    // no es «el mismo vínculo», ni siquiera con el mismo emisor y `subject`.
    const vinculo = this.vinculos.find(
      (fila) =>
        fila.tenantId === values[0] &&
        fila.issuer === values[1] &&
        fila.subject === values[2],
    );

    if (vinculo === undefined) {
      return [];
    }

    const cuenta = this.cuentas.find(
      (fila) => fila.id === vinculo.humanAccountId && fila.tenantId === vinculo.tenantId,
    );

    if (cuenta === undefined) {
      throw new Error('vínculo sin cuenta en el mismo tenant: FK compuesta violada');
    }

    return [
      {
        id: vinculo.id,
        status: vinculo.status,
        humanAccountId: vinculo.humanAccountId,
        personId: cuenta.personId,
        accountStatus: cuenta.status,
      },
    ];
  }

  private reactivarVinculo(values: readonly unknown[]): readonly unknown[] {
    const vinculo = this.vinculos.find(
      (fila) =>
        fila.id === values[0] &&
        fila.tenantId === values[1] &&
        fila.status === 'UNLINKED',
    );

    if (vinculo !== undefined) {
      vinculo.status = 'ACTIVE';
      vinculo.unlinkedAt = null;
      this.escrituras.push({ tabla: 'external_auth_identity', values });
    }

    return [];
  }

  private desvincular(values: readonly unknown[]): readonly unknown[] {
    const vinculo = this.vinculos.find(
      (fila) =>
        fila.id === values[0] && fila.tenantId === values[1] && fila.status === 'ACTIVE',
    );

    if (vinculo !== undefined) {
      // La fila NO se borra: conserva su historia y su fecha de cierre.
      vinculo.status = 'UNLINKED';
      vinculo.unlinkedAt = 'now()';
      this.escrituras.push({ tabla: 'external_auth_identity', values });
    }

    return [];
  }

  private deshabilitarCuenta(values: readonly unknown[]): readonly unknown[] {
    const cuenta = this.cuentas.find(
      (fila) =>
        fila.id === values[0] && fila.tenantId === values[1] && fila.status === 'ACTIVE',
    );

    if (cuenta !== undefined) {
      cuenta.status = 'DISABLED';
      this.escrituras.push({ tabla: 'human_account', values });
    }

    return [];
  }

  private revocarSesiones(values: readonly unknown[]): readonly unknown[] {
    const vivas = this.sesiones.filter(
      (fila) =>
        fila.tenantId === values[0] &&
        fila.humanAccountId === values[1] &&
        fila.revokedAt === null,
    );

    for (const sesion of vivas) {
      sesion.revokedAt = 'now()';
    }

    if (vivas.length > 0) {
      this.escrituras.push({ tabla: 'human_session', values });
    }

    return vivas.map((sesion) => ({ id: sesion.id }));
  }

  private insertarCuenta(values: readonly unknown[]): readonly unknown[] {
    const [id, tenantId, personId] = values as [string, string, string];

    const persona = this.personas.find(
      (fila) => fila.id === personId && fila.tenantId === tenantId,
    );

    if (persona === undefined) {
      throw new Error('FK compuesta (personId, tenantId) violada');
    }

    this.cuentas.push({ id, tenantId, personId, status: 'ACTIVE' });
    this.escrituras.push({ tabla: 'human_account', values });

    return [];
  }

  private insertarVinculo(values: readonly unknown[]): readonly unknown[] {
    const [id, tenantId, humanAccountId, issuer, subject] = values as [
      string,
      string,
      string,
      string,
      string,
    ];

    const cuenta = this.cuentas.find(
      (fila) => fila.id === humanAccountId && fila.tenantId === tenantId,
    );

    if (cuenta === undefined) {
      throw new Error('FK compuesta (humanAccountId, tenantId) violada');
    }

    const duplicado = this.vinculos.some(
      (fila) =>
        fila.tenantId === tenantId && fila.issuer === issuer && fila.subject === subject,
    );

    if (duplicado) {
      // Barrera FINAL del índice único, igual que en PostgreSQL.
      throw new Error('índice único (tenantId, issuer, subject) violado');
    }

    this.vinculos.push({
      id,
      tenantId,
      humanAccountId,
      issuer,
      subject,
      status: 'ACTIVE',
      unlinkedAt: null,
    });
    this.escrituras.push({ tabla: 'external_auth_identity', values });

    return [];
  }

  private insertarAuditoria(values: readonly unknown[]): readonly unknown[] {
    const [, tenantId, eventType, resourceType, resourceId, endpoint, correlationId] =
      values as [string, string, string, string, string, string, string];

    this.auditoria.push({
      tenantId,
      eventType,
      actorType: 'SYSTEM',
      actorUserId: null,
      actorRole: null,
      resourceType,
      resourceId,
      outcome: 'SUCCESS',
      endpoint,
      correlationId,
    });
    this.escrituras.push({ tabla: 'audit_event', values });

    return [];
  }
}

function baseConPersonas(): BaseFicticia {
  return new BaseFicticia([
    { id: PERSONA_A, tenantId: TENANT_A, documentNumber: DOCUMENTO_A },
    { id: OTRA_PERSONA_A, tenantId: TENANT_A, documentNumber: DOCUMENTO_OTRA_A },
    { id: PERSONA_B, tenantId: TENANT_B, documentNumber: DOCUMENTO_B },
  ]);
}

function link(personId: string, subject = SUJETO): LinkOperation {
  return { action: 'LINK', tenantCode: 'merdn-mvp', personId, issuer: EMISOR, subject };
}

/** Ejecuta una operación y devuelve su resultado junto a lo que escribió. */
async function ejecutar(
  base: BaseFicticia,
  tenantId: string,
  operation: ProvisioningOperation,
): Promise<{
  readonly outcome: string;
  readonly humanAccountId: string | null;
  readonly identityFingerprint: string | null;
  readonly revokedSessions: number;
  readonly escrituras: readonly Escritura[];
}> {
  const antes = base.escrituras.length;
  const resultado = await runOperation(base, tenantId, operation, CORRELACION);

  return {
    outcome: resultado.outcome,
    humanAccountId: resultado.humanAccountId,
    identityFingerprint: resultado.identityFingerprint,
    revokedSessions: resultado.revokedSessions,
    escrituras: base.escrituras.slice(antes),
  };
}

function unlink(subject = SUJETO): UnlinkOperation {
  return { action: 'UNLINK', tenantCode: 'merdn-mvp', issuer: EMISOR, subject };
}

function disable(humanAccountId: string): DisableAccountOperation {
  return { action: 'DISABLE_ACCOUNT', tenantCode: 'merdn-mvp', humanAccountId };
}

/** Siembra sesiones de la cuenta: `vivas` sin revocar y `revocadas` ya cerradas. */
function sembrarSesiones(
  base: BaseFicticia,
  tenantId: string,
  humanAccountId: string,
  vivas: number,
  revocadas = 0,
): void {
  for (let indice = 0; indice < vivas + revocadas; indice += 1) {
    base.sesiones.push({
      id: `sesion-ficticia-${tenantId.slice(-4)}-${String(indice).padStart(2, '0')}`,
      tenantId,
      humanAccountId,
      revokedAt: indice < vivas ? null : 'revocada-antes',
    });
  }
}

/** Deja un tenant con su vínculo activo, su cuenta y `vivas` sesiones abiertas. */
async function conVinculoYSesiones(
  base: BaseFicticia,
  tenantId: string,
  personId: string,
  vivas: number,
  revocadas = 0,
): Promise<string> {
  const creado = await ejecutar(base, tenantId, link(personId));
  const cuenta = creado.humanAccountId ?? '';

  sembrarSesiones(base, tenantId, cuenta, vivas, revocadas);

  return cuenta;
}

describe('LINK de identidad externa a una Person existente', () => {
  it('crea cuenta y vínculo y devuelve APPLIED', async () => {
    const base = baseConPersonas();

    const resultado = await ejecutar(base, TENANT_A, link(PERSONA_A));

    expect(resultado.outcome).toBe('APPLIED');
    expect(base.cuentas).toHaveLength(1);
    expect(base.vinculos).toHaveLength(1);

    expect(base.cuentas[0]).toMatchObject({
      tenantId: TENANT_A,
      personId: PERSONA_A,
      status: 'ACTIVE',
    });
    expect(base.vinculos[0]).toMatchObject({
      tenantId: TENANT_A,
      humanAccountId: base.cuentas[0]?.id,
      issuer: EMISOR,
      subject: SUJETO,
      status: 'ACTIVE',
      unlinkedAt: null,
    });

    // Cuenta, vínculo y su traza: ni una escritura más.
    expect(resultado.escrituras.map((escritura) => escritura.tabla)).toEqual([
      'human_account',
      'external_auth_identity',
      'audit_event',
    ]);
    expect(base.auditoria).toEqual([
      {
        tenantId: TENANT_A,
        eventType: 'HUMAN_IDENTITY_LINKED',
        actorType: 'SYSTEM',
        actorUserId: null,
        actorRole: null,
        resourceType: AUDIT_RESOURCE.binding,
        resourceId: base.vinculos[0]?.id,
        outcome: 'SUCCESS',
        endpoint: AUDIT_ENDPOINT,
        correlationId: CORRELACION,
      },
    ]);
  });

  it('repetir el MISMO LINK devuelve UNCHANGED', async () => {
    const base = baseConPersonas();

    const primera = await ejecutar(base, TENANT_A, link(PERSONA_A));
    const segunda = await ejecutar(base, TENANT_A, link(PERSONA_A));

    expect(primera.outcome).toBe('APPLIED');
    expect(segunda.outcome).toBe('UNCHANGED');
    // La repetición resuelve la MISMA cuenta y la misma huella de correlación.
    expect(segunda.humanAccountId).toBe(primera.humanAccountId);
    expect(segunda.identityFingerprint).toBe(primera.identityFingerprint);
  });

  it('repetir NO crea una segunda cuenta ni un segundo vínculo', async () => {
    const base = baseConPersonas();

    await ejecutar(base, TENANT_A, link(PERSONA_A));
    const estadoTrasLaPrimera = base.estado();

    const segunda = await ejecutar(base, TENANT_A, link(PERSONA_A));
    const tercera = await ejecutar(base, TENANT_A, link(PERSONA_A));

    expect(base.cuentas).toHaveLength(1);
    expect(base.vinculos).toHaveLength(1);
    // Idempotencia VISIBLE: repetir no escribe, ni siquiera auditoría.
    expect(segunda.escrituras).toEqual([]);
    expect(tercera.escrituras).toEqual([]);
    expect(base.auditoria).toHaveLength(1);
    expect(base.estado()).toBe(estadoTrasLaPrimera);
  });

  it('el MISMO issuer/subject hacia OTRA persona devuelve CONFLICT', async () => {
    const base = baseConPersonas();

    await ejecutar(base, TENANT_A, link(PERSONA_A));
    const resultado = await ejecutar(base, TENANT_A, link(OTRA_PERSONA_A));

    expect(resultado.outcome).toBe('CONFLICT');
    // El resultado no revela a quién pertenece el `subject` ajeno.
    expect(resultado.humanAccountId).toBeNull();

    const serializado = JSON.stringify(resultado);
    expect(serializado).not.toContain(PERSONA_A);
    expect(serializado).not.toContain(SUJETO);
    expect(serializado).not.toContain(EMISOR);
  });

  it('el conflicto no deja NINGUNA escritura parcial', async () => {
    const base = baseConPersonas();

    await ejecutar(base, TENANT_A, link(PERSONA_A));
    const estadoAntes = base.estado();

    const resultado = await ejecutar(base, TENANT_A, link(OTRA_PERSONA_A));

    expect(resultado.outcome).toBe('CONFLICT');
    // Ni cuenta huérfana, ni vínculo reasignado, ni traza de algo que no pasó.
    expect(resultado.escrituras).toEqual([]);
    expect(base.cuentas).toHaveLength(1);
    expect(base.vinculos).toHaveLength(1);
    expect(base.vinculos[0]?.humanAccountId).toBe(base.cuentas[0]?.id);
    expect(base.cuentas[0]?.personId).toBe(PERSONA_A);
    expect(base.estado()).toBe(estadoAntes);
  });

  it('otro tenant no alcanza a la persona del primero: NOT_FOUND y cero escrituras', async () => {
    const base = baseConPersonas();

    await ejecutar(base, TENANT_A, link(PERSONA_A));
    const estadoAntes = base.estado();

    // Mismo identificador de persona, tenant equivocado: no existe para él.
    const resultado = await ejecutar(base, TENANT_B, link(PERSONA_A));

    expect(resultado.outcome).toBe('NOT_FOUND');
    expect(resultado.escrituras).toEqual([]);
    expect(base.estado()).toBe(estadoAntes);
  });

  it('otro tenant no resuelve ni modifica el vínculo ajeno con el mismo issuer/subject', async () => {
    const base = baseConPersonas();

    const primera = await ejecutar(base, TENANT_A, link(PERSONA_A));
    const segunda = await ejecutar(base, TENANT_B, link(PERSONA_B));

    // El vínculo del tenant B es NUEVO: no reutiliza ni reasigna el de A.
    expect(segunda.outcome).toBe('APPLIED');
    expect(segunda.humanAccountId).not.toBe(primera.humanAccountId);
    expect(base.vinculos).toHaveLength(2);

    const deA = base.vinculos.find((fila) => fila.tenantId === TENANT_A);
    const deB = base.vinculos.find((fila) => fila.tenantId === TENANT_B);

    expect(deA?.humanAccountId).toBe(primera.humanAccountId);
    expect(deB?.humanAccountId).toBe(segunda.humanAccountId);
    expect(deA?.status).toBe('ACTIVE');

    // Cada cuenta cuelga de la persona de SU tenant.
    expect(base.cuentas.find((cuenta) => cuenta.tenantId === TENANT_A)?.personId).toBe(
      PERSONA_A,
    );
    expect(base.cuentas.find((cuenta) => cuenta.tenantId === TENANT_B)?.personId).toBe(
      PERSONA_B,
    );

    // Cada traza queda en el tenant que la produjo.
    expect(base.auditoria.map((evento) => evento.tenantId)).toEqual([TENANT_A, TENANT_B]);
  });

  it('la auditoría no expone emisor, subject ni documento', async () => {
    const base = baseConPersonas();

    await ejecutar(base, TENANT_A, link(PERSONA_A));
    await ejecutar(base, TENANT_B, link(PERSONA_B));

    expect(base.auditoria).toHaveLength(2);

    const trazas = JSON.stringify(base.auditoria);

    for (const prohibido of [
      EMISOR,
      SUJETO,
      DOCUMENTO_A,
      DOCUMENTO_OTRA_A,
      DOCUMENTO_B,
      'realms',
      'sujeto-ficticio',
    ]) {
      expect(trazas).not.toContain(prohibido);
    }

    for (const evento of base.auditoria) {
      // El recurso es SIEMPRE un identificador opaco de vínculo.
      expect(evento.resourceType).toBe(AUDIT_RESOURCE.binding);
      expect(base.vinculos.map((vinculo) => vinculo.id)).toContain(evento.resourceId);
      // Proceso administrativo: sin actor y sin rol.
      expect(evento.actorType).toBe('SYSTEM');
      expect(evento.actorUserId).toBeNull();
      expect(evento.actorRole).toBeNull();
      expect(evento.endpoint).toBe(AUDIT_ENDPOINT);
    }

    // Tampoco los VALORES enviados a `audit_event` llevan el par de identidad.
    const valoresAuditados = JSON.stringify(
      base.escrituras
        .filter((escritura) => escritura.tabla === 'audit_event')
        .map((escritura) => escritura.values),
    );
    expect(valoresAuditados).not.toContain(EMISOR);
    expect(valoresAuditados).not.toContain(SUJETO);
  });
});

describe('UNLINK: cierre inmediato del acceso', () => {
  it('desvincula, revoca TODA sesión viva y lo audita en la misma operación', async () => {
    const base = baseConPersonas();
    const cuenta = await conVinculoYSesiones(base, TENANT_A, PERSONA_A, 2, 1);

    const resultado = await ejecutar(base, TENANT_A, unlink());

    expect(resultado.outcome).toBe('APPLIED');
    expect(resultado.humanAccountId).toBe(cuenta);
    // Las dos vivas, y solo esas: la ya revocada no se cuenta dos veces.
    expect(resultado.revokedSessions).toBe(2);
    expect(base.sesiones.every((sesion) => sesion.revokedAt !== null)).toBe(true);

    // La fila NO se borra: conserva su historia con la fecha de cierre.
    expect(base.vinculos).toHaveLength(1);
    expect(base.vinculos[0]).toMatchObject({ status: 'UNLINKED', unlinkedAt: 'now()' });

    // La cuenta sigue existiendo: desvincular no es deshabilitar.
    expect(base.cuentas[0]?.status).toBe('ACTIVE');

    const nuevos = base.auditoria.slice(1);
    expect(nuevos.map((evento) => evento.eventType)).toEqual([
      'HUMAN_IDENTITY_UNLINKED',
      'HUMAN_SESSION_REVOKED',
      'HUMAN_SESSION_REVOKED',
    ]);
    for (const evento of nuevos) {
      expect(evento.tenantId).toBe(TENANT_A);
      expect(evento.actorType).toBe('SYSTEM');
      expect(evento.actorUserId).toBeNull();
      expect(evento.actorRole).toBeNull();
    }
  });

  it('repetir UNLINK devuelve UNCHANGED y no revoca ni escribe nada', async () => {
    const base = baseConPersonas();
    await conVinculoYSesiones(base, TENANT_A, PERSONA_A, 1);

    await ejecutar(base, TENANT_A, unlink());
    const estadoAntes = base.estado();

    const repetida = await ejecutar(base, TENANT_A, unlink());

    expect(repetida.outcome).toBe('UNCHANGED');
    expect(repetida.revokedSessions).toBe(0);
    expect(repetida.escrituras).toEqual([]);
    expect(base.estado()).toBe(estadoAntes);
  });

  it('otro tenant no desvincula el vínculo ajeno: NOT_FOUND y cero escrituras', async () => {
    const base = baseConPersonas();
    await conVinculoYSesiones(base, TENANT_A, PERSONA_A, 1);
    const estadoAntes = base.estado();

    // Mismo emisor y mismo `subject`, tenant distinto: no existe para él.
    const resultado = await ejecutar(base, TENANT_B, unlink());

    expect(resultado.outcome).toBe('NOT_FOUND');
    expect(resultado.escrituras).toEqual([]);
    expect(base.vinculos[0]?.status).toBe('ACTIVE');
    expect(base.sesiones.every((sesion) => sesion.revokedAt === null)).toBe(true);
    expect(base.estado()).toBe(estadoAntes);
  });
});

describe('DISABLE_ACCOUNT: cierre inmediato del acceso', () => {
  it('deshabilita, revoca las sesiones vivas y CONSERVA los vínculos', async () => {
    const base = baseConPersonas();
    const cuenta = await conVinculoYSesiones(base, TENANT_A, PERSONA_A, 2);

    const resultado = await ejecutar(base, TENANT_A, disable(cuenta));

    expect(resultado.outcome).toBe('APPLIED');
    expect(resultado.revokedSessions).toBe(2);
    // La huella de identidad no aplica: esta operación no nombra ningún subject.
    expect(resultado.identityFingerprint).toBeNull();

    expect(base.cuentas[0]?.status).toBe('DISABLED');
    expect(base.sesiones.every((sesion) => sesion.revokedAt !== null)).toBe(true);
    // Deshabilitar NO desvincula: confundirlas haría irreversible lo que no debe serlo.
    expect(base.vinculos[0]?.status).toBe('ACTIVE');

    const nuevos = base.auditoria.slice(1);
    expect(nuevos.map((evento) => evento.eventType)).toEqual([
      'HUMAN_ACCOUNT_DISABLED',
      'HUMAN_SESSION_REVOKED',
      'HUMAN_SESSION_REVOKED',
    ]);
    expect(nuevos[0]?.resourceType).toBe(AUDIT_RESOURCE.account);
    expect(nuevos[0]?.resourceId).toBe(cuenta);
  });

  it('repetir sobre una cuenta ya deshabilitada y sin sesiones vivas: UNCHANGED', async () => {
    const base = baseConPersonas();
    const cuenta = await conVinculoYSesiones(base, TENANT_A, PERSONA_A, 1);

    await ejecutar(base, TENANT_A, disable(cuenta));
    const estadoAntes = base.estado();

    const repetida = await ejecutar(base, TENANT_A, disable(cuenta));

    expect(repetida.outcome).toBe('UNCHANGED');
    expect(repetida.revokedSessions).toBe(0);
    expect(repetida.escrituras).toEqual([]);
    expect(base.estado()).toBe(estadoAntes);
  });

  it('una sesión viva residual sobre cuenta ya deshabilitada SÍ se cierra', async () => {
    const base = baseConPersonas();
    const cuenta = await conVinculoYSesiones(base, TENANT_A, PERSONA_A, 1);

    await ejecutar(base, TENANT_A, disable(cuenta));
    // Sesión abierta DESPUÉS de deshabilitar: repetir el comando debe cerrarla.
    sembrarSesiones(base, TENANT_A, cuenta, 1);

    const residual = await ejecutar(base, TENANT_A, disable(cuenta));

    expect(residual.outcome).toBe('APPLIED');
    expect(residual.revokedSessions).toBe(1);
    expect(base.sesiones.every((sesion) => sesion.revokedAt !== null)).toBe(true);
  });

  it('otro tenant no deshabilita la cuenta ajena: NOT_FOUND y cero escrituras', async () => {
    const base = baseConPersonas();
    const cuenta = await conVinculoYSesiones(base, TENANT_A, PERSONA_A, 1);
    const estadoAntes = base.estado();

    const resultado = await ejecutar(base, TENANT_B, disable(cuenta));

    expect(resultado.outcome).toBe('NOT_FOUND');
    expect(resultado.humanAccountId).toBeNull();
    expect(resultado.escrituras).toEqual([]);
    expect(base.cuentas[0]?.status).toBe('ACTIVE');
    expect(base.sesiones.every((sesion) => sesion.revokedAt === null)).toBe(true);
    expect(base.estado()).toBe(estadoAntes);
  });
});
