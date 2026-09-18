import { describe, expect, it } from 'vitest';

import {
  CaregiverBodyError,
  parseActivateBody,
  parseCreateBody,
  parseRelationshipId,
  parseRevokeBody,
} from './caregiver-relationship.request';

/**
 * Análisis estricto de la superficie de relaciones (continuación §6.1).
 *
 * La comprobación central es la ALLOWLIST CERRADA: el navegador no es autoridad
 * sobre tenant, estado, tipo, finalidad, fuente de validación, alcance, versión,
 * validador, revocador, actor ni rol. Todos los fija el servidor, y enviarlos
 * debe producir un rechazo explícito en lugar de un descarte silencioso: un
 * filtrado silencioso haría creer a quien opera que su valor se aplicó.
 */

const IDENTIFICADOR_FICTICIO = '00000000-0000-4000-8000-000000000001';
const OTRO_IDENTIFICADOR_FICTICIO = '00000000-0000-4000-8000-000000000002';

function cuerpoValido(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    patientId: IDENTIFICADOR_FICTICIO,
    caregiverPersonId: OTRO_IDENTIFICADOR_FICTICIO,
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: null,
    authorizationReference: 'SOPORTE.FICTICIO-0001',
    ...overrides,
  };
}

describe('Análisis de la superficie de relaciones', () => {
  describe('creación', () => {
    it('acepta el cuerpo mínimo con vigencia abierta', () => {
      const request = parseCreateBody(cuerpoValido());

      expect(request.patientId).toBe(IDENTIFICADOR_FICTICIO);
      expect(request.caregiverPersonId).toBe(OTRO_IDENTIFICADOR_FICTICIO);
      expect(request.endsAt).toBeNull();
      expect(request.startsAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('RECHAZA todo campo de autoridad que el servidor fija', () => {
      const prohibidos = [
        'tenantId',
        'status',
        'relationshipType',
        'purpose',
        'validationSource',
        'scope',
        'scopes',
        'version',
        'validatedBy',
        'validatedByInstitutionalIdentityId',
        'revokedBy',
        'revokedByInstitutionalIdentityId',
        'actor',
        'role',
        'createdAt',
      ];

      for (const campo of prohibidos) {
        expect(() => parseCreateBody(cuerpoValido({ [campo]: 'lo-que-sea' }))).toThrow(
          CaregiverBodyError,
        );
      }
    });

    it('exige `endsAt` presente y distingue null de ausente', () => {
      const sinEndsAt = cuerpoValido();
      delete sinEndsAt['endsAt'];

      expect(() => parseCreateBody(sinEndsAt)).toThrow(CaregiverBodyError);
      expect(parseCreateBody(cuerpoValido({ endsAt: null })).endsAt).toBeNull();
    });

    it('exige desplazamiento horario explícito en los instantes', () => {
      const sinZona = ['2026-01-01T00:00:00', '2026-01-01', '01/01/2026'];

      for (const valor of sinZona) {
        expect(() => parseCreateBody(cuerpoValido({ startsAt: valor }))).toThrow(
          CaregiverBodyError,
        );
      }

      expect(
        parseCreateBody(cuerpoValido({ startsAt: '2026-01-01T00:00:00-05:00' })).startsAt,
      ).toBeInstanceOf(Date);
    });

    it('exige que la vigencia termine después de empezar', () => {
      expect(() =>
        parseCreateBody(
          cuerpoValido({
            startsAt: '2026-01-02T00:00:00Z',
            endsAt: '2026-01-01T00:00:00Z',
          }),
        ),
      ).toThrow(CaregiverBodyError);
    });

    it('la referencia de autorización es opaca y no admite texto libre', () => {
      const invalidas = [
        'texto libre con espacios',
        'minusculas-no-admitidas',
        'ACENTOS-ÁÉÍ',
        '',
        `A${'B'.repeat(100)}`,
      ];

      for (const referencia of invalidas) {
        expect(() =>
          parseCreateBody(cuerpoValido({ authorizationReference: referencia })),
        ).toThrow(CaregiverBodyError);
      }
    });

    it('el mensaje de error nombra el campo y NUNCA repite el valor', () => {
      try {
        parseCreateBody(
          cuerpoValido({ authorizationReference: 'Ana María Ejemplo Ficticio' }),
        );
        expect.unreachable('debía lanzar');
      } catch (error) {
        expect(error).toBeInstanceOf(CaregiverBodyError);
        expect((error as Error).message).toContain('authorizationReference');
        expect((error as Error).message).not.toContain('Ana María');
      }
    });

    it('rechaza cuerpos que no son objetos', () => {
      for (const cuerpo of [null, [], 'texto', 42]) {
        expect(() => parseCreateBody(cuerpo)).toThrow(CaregiverBodyError);
      }
    });
  });

  describe('activación y revocación', () => {
    it('exigen `expectedVersion` y no le dan valor por defecto', () => {
      expect(() => parseActivateBody({})).toThrow(CaregiverBodyError);
      expect(() => parseRevokeBody({ reason: 'RELATIONSHIP_ENDED' })).toThrow(
        CaregiverBodyError,
      );

      expect(parseActivateBody({ expectedVersion: 1 }).expectedVersion).toBe(1);
    });

    it('rechazan versiones no enteras, negativas o de otro tipo', () => {
      for (const version of [0, -1, 1.5, '1', null, Number.NaN]) {
        expect(() => parseActivateBody({ expectedVersion: version })).toThrow(
          CaregiverBodyError,
        );
      }
    });

    it('el motivo de revocación pertenece al catálogo cerrado', () => {
      expect(
        parseRevokeBody({ expectedVersion: 2, reason: 'AUTHORIZATION_WITHDRAWN' }).reason,
      ).toBe('AUTHORIZATION_WITHDRAWN');

      for (const motivo of ['OTRO', 'la persona ya no vive allí', null, 1]) {
        expect(() => parseRevokeBody({ expectedVersion: 2, reason: motivo })).toThrow(
          CaregiverBodyError,
        );
      }
    });

    it('no admiten campos ajenos a su operación', () => {
      expect(() => parseActivateBody({ expectedVersion: 1, status: 'ACTIVE' })).toThrow(
        CaregiverBodyError,
      );

      expect(() =>
        parseRevokeBody({
          expectedVersion: 1,
          reason: 'CREATED_IN_ERROR',
          revokedByInstitutionalIdentityId: IDENTIFICADOR_FICTICIO,
        }),
      ).toThrow(CaregiverBodyError);
    });
  });

  describe('identificador de ruta', () => {
    it('acepta solo la forma de identificador opaco', () => {
      expect(parseRelationshipId(IDENTIFICADOR_FICTICIO)).toBe(IDENTIFICADOR_FICTICIO);

      for (const valor of ['', 'no-es-un-uuid', 42, null, `${IDENTIFICADOR_FICTICIO} `]) {
        expect(() => parseRelationshipId(valor)).toThrow(CaregiverBodyError);
      }
    });
  });
});
