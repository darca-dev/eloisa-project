import { describe, expect, it } from 'vitest';

import { isUniqueDocumentViolation } from './patient-enrollment.service';

/**
 * Detección precisa del conflicto de documento (corrección final de CORE-01).
 *
 * SOLO la violación de `person_tenant_document_unique` puede traducirse a
 * `409 PATIENT_DOCUMENT_CONFLICT`. Cualquier otra violación de unicidad es un
 * defecto distinto y debe propagarse como error interno, no comunicarse a la
 * persona como un duplicado que no puede resolver.
 */

/** Forma real que produce Prisma 7 con el adaptador de PostgreSQL. */
function errorDelAdaptador(constraintName: string, fields: readonly string[]): unknown {
  return {
    code: 'P2002',
    meta: {
      modelName: 'Person',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          originalCode: '23505',
          originalMessage: `duplicate key value violates unique constraint "${constraintName}"`,
          kind: 'UniqueConstraintViolation',
          constraint: { fields: fields.map((field) => `"${field}"`) },
        },
      },
    },
  };
}

describe('isUniqueDocumentViolation', () => {
  it('reconoce el conflicto de documento en la forma del adaptador', () => {
    const error = errorDelAdaptador('person_tenant_document_unique', [
      'tenantId',
      'documentType',
      'documentNumberNormalized',
    ]);

    expect(isUniqueDocumentViolation(error)).toBe(true);
  });

  it('reconoce el conflicto por el nombre de la restricción en `target`', () => {
    expect(
      isUniqueDocumentViolation({
        code: 'P2002',
        meta: { target: 'person_tenant_document_unique' },
      }),
    ).toBe(true);
  });

  it('reconoce el conflicto por el conjunto completo de columnas en `target`', () => {
    expect(
      isUniqueDocumentViolation({
        code: 'P2002',
        meta: {
          target: ['tenantId', 'documentType', 'documentNumberNormalized'],
        },
      }),
    ).toBe(true);
  });

  it('NO confunde el conflicto de hash de sesión con un documento duplicado', () => {
    const error = errorDelAdaptador('enrollment_session_tokenHash_key', ['tokenHash']);

    expect(isUniqueDocumentViolation(error)).toBe(false);
  });

  it('NO confunde otras restricciones únicas del modelo', () => {
    for (const [nombre, columnas] of [
      ['tenant_code_key', ['code']],
      ['patient_person_tenant_unique', ['personId', 'tenantId']],
      ['patient_address_patient_unique', ['patientId', 'tenantId']],
      ['territorial_unit_type_official_code_unique', ['type', 'officialCode']],
    ] as const) {
      expect(isUniqueDocumentViolation(errorDelAdaptador(nombre, columnas))).toBe(false);
    }
  });

  it('NO acepta un subconjunto parcial de las columnas del documento', () => {
    expect(
      isUniqueDocumentViolation({
        code: 'P2002',
        meta: { target: ['tenantId', 'documentType'] },
      }),
    ).toBe(false);
  });

  it('NO acepta un P2002 sin metadatos reconocibles', () => {
    expect(isUniqueDocumentViolation({ code: 'P2002' })).toBe(false);
    expect(isUniqueDocumentViolation({ code: 'P2002', meta: {} })).toBe(false);
    expect(isUniqueDocumentViolation({ code: 'P2002', meta: { target: 42 } })).toBe(false);
  });

  it('NO acepta códigos de error distintos de P2002', () => {
    expect(
      isUniqueDocumentViolation({
        code: 'P2003',
        meta: { target: 'person_tenant_document_unique' },
      }),
    ).toBe(false);
  });

  it('tolera valores que no son objetos', () => {
    for (const value of [null, undefined, 'error', 42, []]) {
      expect(isUniqueDocumentViolation(value)).toBe(false);
    }
  });
});
