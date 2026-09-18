import { describe, expect, it } from 'vitest';

import { LOCAL_UNIT_PENDING_NORMALIZATION } from './enrollment.contract';
import { validateEnrollmentRequest } from './enrollment.validation';

/**
 * Validación del cuerpo de inscripción (TASK-MVP-CORE-01 §7, §12).
 *
 * Toda la información usada es ficticia.
 */

const HOY = new Date(Date.UTC(2026, 7, 21));

const TERRITORIO_VALIDO = {
  departmentCode: '05',
  municipalityCode: '05001',
  localUnitId: LOCAL_UNIT_PENDING_NORMALIZATION,
  localityDeclaredText: 'La Esperanza',
  areaType: 'URBAN',
  exactAddress: 'Cra 45 # 32-16',
};

function cuerpo(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    documentType: 'CEDULA_CIUDADANIA',
    documentNumber: '1234567890',
    givenNames: 'Ana María',
    familyNames: 'Ejemplo Ficticio',
    birthDate: '1958-04-12',
    sexGenderCode: 'FEMENINO',
    phone: '311 220 3355',
    epsCode: 'NUEVA_EPS',
    declaredPopulations: [],
    territory: { ...TERRITORIO_VALIDO },
    consentAccepted: true,
    ...overrides,
  };
}

describe('validateEnrollmentRequest', () => {
  it('acepta un cuerpo mínimo válido y normaliza los valores', () => {
    const result = validateEnrollmentRequest(cuerpo(), HOY);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.documentNumberNormalized).toBe('1234567890');
    expect(result.value.givenNames).toBe('Ana María');
    expect(result.value.email).toBeNull();
    expect(result.value.eps).toStrictEqual({ code: 'NUEVA_EPS', name: 'Nueva EPS' });
    expect(result.value.territory.localUnitId).toBeNull();
    expect(result.value.territory.localityDeclaredText).toBe('La Esperanza');
    expect(result.value.territory.areaType).toBe('URBAN');
  });

  describe('allowlist estricta', () => {
    it('rechaza una propiedad desconocida en la raíz como fallo de forma', () => {
      const result = validateEnrollmentRequest(cuerpo({ tenantId: 'otro' }), HOY);

      expect(result).toStrictEqual({ ok: false, kind: 'SHAPE', fields: ['tenantId'] });
    });

    it('rechaza los campos que solo puede fijar el servidor', () => {
      for (const campo of ['age', 'status', 'origin', 'createdBy', 'enrolledAt']) {
        const result = validateEnrollmentRequest(cuerpo({ [campo]: 'x' }), HOY);
        expect(result.ok).toBe(false);
        expect(!result.ok && result.kind).toBe('SHAPE');
        expect(!result.ok && result.fields).toContain(campo);
      }
    });

    it('rechaza una propiedad desconocida dentro de territory', () => {
      const result = validateEnrollmentRequest(
        cuerpo({ territory: { ...TERRITORIO_VALIDO, municipalityName: 'MEDELLÍN' } }),
        HOY,
      );

      expect(result.ok).toBe(false);
      expect(!result.ok && result.fields).toContain('territory.municipalityName');
    });

    it('rechaza un cuerpo que no es un objeto', () => {
      for (const value of [null, [], 'texto', 42]) {
        const result = validateEnrollmentRequest(value, HOY);
        expect(result).toStrictEqual({ ok: false, kind: 'SHAPE', fields: ['body'] });
      }
    });
  });

  describe('catálogos controlados', () => {
    it('rechaza un tipo documental inventado', () => {
      const result = validateEnrollmentRequest(
        cuerpo({ documentType: 'REGISTRO_SECRETO' }),
        HOY,
      );

      expect(!result.ok && result.kind).toBe('SEMANTIC');
      expect(!result.ok && result.fields).toContain('documentType');
    });

    it('rechaza un valor de sexo/género inventado', () => {
      const result = validateEnrollmentRequest(cuerpo({ sexGenderCode: 'NB' }), HOY);
      expect(!result.ok && result.fields).toContain('sexGenderCode');
    });

    it('rechaza una EPS que no está en el catálogo del servidor', () => {
      const result = validateEnrollmentRequest(cuerpo({ epsCode: 'EPS_FICTICIA' }), HOY);
      expect(!result.ok && result.fields).toContain('epsCode');
    });

    it('rechaza una población que el cliente no puede declarar', () => {
      const result = validateEnrollmentRequest(
        cuerpo({ declaredPopulations: ['OLDER_ADULT_60_PLUS'] }),
        HOY,
      );

      expect(!result.ok && result.kind).toBe('SEMANTIC');
      expect(!result.ok && result.fields).toContain('declaredPopulations');
    });
  });

  describe('fecha de nacimiento', () => {
    it('rechaza una fecha futura', () => {
      const result = validateEnrollmentRequest(cuerpo({ birthDate: '2027-01-01' }), HOY);
      expect(!result.ok && result.fields).toContain('birthDate');
    });

    it('rechaza una fecha inexistente', () => {
      const result = validateEnrollmentRequest(cuerpo({ birthDate: '2025-02-30' }), HOY);
      expect(!result.ok && result.fields).toContain('birthDate');
    });

    it('rechaza una edad implausible', () => {
      const result = validateEnrollmentRequest(cuerpo({ birthDate: '1800-01-01' }), HOY);
      expect(!result.ok && result.fields).toContain('birthDate');
    });

    it('acepta la fecha de hoy', () => {
      const result = validateEnrollmentRequest(cuerpo({ birthDate: '2026-08-21' }), HOY);
      expect(result.ok).toBe(true);
    });
  });

  describe('correo opcional', () => {
    it('acepta la ausencia, el nulo y la cadena vacía', () => {
      for (const email of [undefined, null, '', '   ']) {
        const result = validateEnrollmentRequest(cuerpo({ email }), HOY);
        expect(result.ok).toBe(true);
        expect(result.ok && result.value.email).toBeNull();
      }
    });

    it('normaliza a minúsculas un correo válido', () => {
      const result = validateEnrollmentRequest(
        cuerpo({ email: '  Ana.Ejemplo@Correo.Ficticio  ' }),
        HOY,
      );

      expect(result.ok && result.value.email).toBe('ana.ejemplo@correo.ficticio');
    });

    it('rechaza un correo con formato inválido', () => {
      const result = validateEnrollmentRequest(cuerpo({ email: 'ana.ejemplo' }), HOY);
      expect(!result.ok && result.fields).toContain('email');
    });
  });

  describe('consentimiento', () => {
    it('exige la aceptación explícita', () => {
      const result = validateEnrollmentRequest(cuerpo({ consentAccepted: false }), HOY);

      expect(!result.ok && result.kind).toBe('SEMANTIC');
      expect(!result.ok && result.fields).toContain('consentAccepted');
    });

    it('rechaza un valor que no es booleano', () => {
      const result = validateEnrollmentRequest(cuerpo({ consentAccepted: 'sí' }), HOY);
      expect(!result.ok && result.kind).toBe('SHAPE');
    });
  });

  describe('territorio', () => {
    it('rechaza un municipio que no pertenece al departamento', () => {
      const result = validateEnrollmentRequest(
        cuerpo({
          territory: { ...TERRITORIO_VALIDO, departmentCode: '05', municipalityCode: '25754' },
        }),
        HOY,
      );

      expect(!result.ok && result.fields).toContain('territory.municipalityCode');
    });

    it('rechaza códigos con formato inválido', () => {
      const result = validateEnrollmentRequest(
        cuerpo({
          territory: { ...TERRITORIO_VALIDO, departmentCode: '5', municipalityCode: '5001' },
        }),
        HOY,
      );

      expect(!result.ok && result.fields).toContain('territory.departmentCode');
      expect(!result.ok && result.fields).toContain('territory.municipalityCode');
    });

    it('exige el texto declarado cuando la localidad queda pendiente', () => {
      const result = validateEnrollmentRequest(
        cuerpo({
          territory: {
            departmentCode: '05',
            municipalityCode: '05001',
            localUnitId: LOCAL_UNIT_PENDING_NORMALIZATION,
            areaType: 'URBAN',
            exactAddress: 'Cra 45 # 32-16',
          },
        }),
        HOY,
      );

      expect(!result.ok && result.fields).toContain('territory.localityDeclaredText');
    });

    it('exige un identificador válido cuando no es la opción pendiente', () => {
      const result = validateEnrollmentRequest(
        cuerpo({
          territory: { ...TERRITORIO_VALIDO, localUnitId: 'La Esperanza' },
        }),
        HOY,
      );

      expect(!result.ok && result.fields).toContain('territory.localUnitId');
    });

    it('acepta un identificador de unidad local con forma UUID', () => {
      const result = validateEnrollmentRequest(
        cuerpo({
          territory: {
            ...TERRITORIO_VALIDO,
            localUnitId: '019287a1-0000-7000-8000-000000000001',
            localityDeclaredText: undefined,
          },
        }),
        HOY,
      );

      expect(result.ok).toBe(true);
      expect(result.ok && result.value.territory.localUnitId).toBe(
        '019287a1-0000-7000-8000-000000000001',
      );
    });

    it('exige dirección exacta no vacía', () => {
      const result = validateEnrollmentRequest(
        cuerpo({ territory: { ...TERRITORIO_VALIDO, exactAddress: '   ' } }),
        HOY,
      );

      expect(!result.ok && result.fields).toContain('territory.exactAddress');
    });

    it('rechaza un área que no está en el catálogo', () => {
      const result = validateEnrollmentRequest(
        cuerpo({ territory: { ...TERRITORIO_VALIDO, areaType: 'SEMIURBANA' } }),
        HOY,
      );

      expect(!result.ok && result.kind).toBe('SEMANTIC');
      expect(!result.ok && result.fields).toContain('territory.areaType');
    });

    it('exige la zona urbana o rural: su ausencia es un fallo de forma', () => {
      const sinZona: Record<string, unknown> = { ...TERRITORIO_VALIDO };
      delete sinZona['areaType'];

      const result = validateEnrollmentRequest(cuerpo({ territory: sinZona }), HOY);

      expect(!result.ok && result.kind).toBe('SHAPE');
      expect(!result.ok && result.fields).toContain('territory.areaType');
    });

    it('acepta tanto zona urbana como rural', () => {
      for (const areaType of ['URBAN', 'RURAL'] as const) {
        const result = validateEnrollmentRequest(
          cuerpo({ territory: { ...TERRITORIO_VALIDO, areaType } }),
          HOY,
        );

        expect(result.ok).toBe(true);
        expect(result.ok && result.value.territory.areaType).toBe(areaType);
      }
    });

    it('conserva el corregimiento declarado como texto no canónico', () => {
      const result = validateEnrollmentRequest(
        cuerpo({
          territory: { ...TERRITORIO_VALIDO, settlementDeclaredText: '  San Cristóbal  ' },
        }),
        HOY,
      );

      expect(result.ok && result.value.territory.settlementDeclaredText).toBe(
        'San Cristóbal',
      );
    });
  });

  describe('los mensajes de error no filtran datos personales', () => {
    it('devuelve solo nombres de campo', () => {
      const result = validateEnrollmentRequest(
        cuerpo({
          documentNumber: 'AB#1234',
          email: 'ana.ejemplo',
          birthDate: '2027-01-01',
        }),
        HOY,
      );

      expect(result.ok).toBe(false);
      const serializado = JSON.stringify(result);

      expect(serializado).not.toContain('AB#1234');
      expect(serializado).not.toContain('ana.ejemplo');
      expect(serializado).not.toContain('2027-01-01');
      expect(serializado).not.toContain('Ana María');
      expect(serializado).not.toContain('Cra 45');
    });
  });
});
