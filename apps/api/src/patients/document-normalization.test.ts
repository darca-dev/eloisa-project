import { describe, expect, it } from 'vitest';

import { DOCUMENT_TYPE_CODES } from './enrollment.contract';
import {
  DOCUMENT_NUMBER_MAX_LENGTH,
  normalizeDocumentNumber,
} from './document-normalization';

/**
 * Normalización de documento por tipo (TASK-MVP-CORE-01 §12, unidad 1).
 *
 * Todos los números usados son ficticios.
 */
describe('normalizeDocumentNumber', () => {
  it('cubre todos los tipos documentales soportados', () => {
    for (const type of DOCUMENT_TYPE_CODES) {
      const result = normalizeDocumentNumber(type, 'AB123456');
      expect(result.ok || result.reason === 'INVALID_CHARACTERS').toBe(true);
    }
  });

  describe('cédula de ciudadanía', () => {
    it('retira separadores de presentación y ceros iniciales', () => {
      const conPuntos = normalizeDocumentNumber('CEDULA_CIUDADANIA', ' 1.234.567 ');
      const conCeros = normalizeDocumentNumber('CEDULA_CIUDADANIA', '0001234567');

      expect(conPuntos).toStrictEqual({
        ok: true,
        declared: '1.234.567',
        normalized: '1234567',
      });
      expect(conCeros.ok && conCeros.normalized).toBe('1234567');
    });

    it('trata como el mismo documento las formas equivalentes', () => {
      const formas = ['1234567890', '1.234.567.890', ' 1 234 567 890 ', '0001234567890'];
      const normalizadas = new Set(
        formas.map((forma) => {
          const result = normalizeDocumentNumber('CEDULA_CIUDADANIA', forma);
          return result.ok ? result.normalized : 'ERROR';
        }),
      );

      expect(normalizadas).toStrictEqual(new Set(['1234567890']));
    });

    it('conserva un cero cuando el documento es únicamente ceros', () => {
      const result = normalizeDocumentNumber('CEDULA_CIUDADANIA', '000');
      expect(result.ok && result.normalized).toBe('0');
    });

    it('rechaza letras', () => {
      expect(normalizeDocumentNumber('CEDULA_CIUDADANIA', '12A4567')).toStrictEqual({
        ok: false,
        reason: 'INVALID_CHARACTERS',
      });
    });
  });

  describe('documentos alfanuméricos', () => {
    it('pasa a mayúsculas y compacta cédula de extranjería, pasaporte y PPT', () => {
      for (const type of [
        'CEDULA_EXTRANJERIA',
        'PASAPORTE',
        'PERMISO_PROTECCION_TEMPORAL',
      ] as const) {
        const result = normalizeDocumentNumber(type, ' ab-123 456 ');
        expect(result.ok && result.normalized).toBe('AB123456');
        expect(result.ok && result.declared).toBe('ab-123 456');
      }
    });

    it('conserva los ceros iniciales, que pueden ser significativos', () => {
      const result = normalizeDocumentNumber('PASAPORTE', 'AB0012');
      expect(result.ok && result.normalized).toBe('AB0012');
    });

    it('rechaza caracteres que no son letras ni dígitos', () => {
      expect(normalizeDocumentNumber('PASAPORTE', 'AB#123')).toStrictEqual({
        ok: false,
        reason: 'INVALID_CHARACTERS',
      });
    });
  });

  describe('tipo «Otro»', () => {
    it('aplica una transformación conservadora, sin compactar', () => {
      const result = normalizeDocumentNumber('OTRO', '  registro  civil-42  ');
      expect(result.ok && result.normalized).toBe('REGISTRO CIVIL-42');
    });

    it('admite letras con tilde y eñe', () => {
      const result = normalizeDocumentNumber('OTRO', 'niño áé');
      expect(result.ok && result.normalized).toBe('NIÑO ÁÉ');
    });
  });

  describe('límites comunes', () => {
    it('rechaza el documento vacío o compuesto solo por espacios', () => {
      expect(normalizeDocumentNumber('CEDULA_CIUDADANIA', '   ')).toStrictEqual({
        ok: false,
        reason: 'EMPTY',
      });
    });

    it('rechaza un documento más largo que el límite', () => {
      const largo = '1'.repeat(DOCUMENT_NUMBER_MAX_LENGTH + 1);
      expect(normalizeDocumentNumber('CEDULA_CIUDADANIA', largo)).toStrictEqual({
        ok: false,
        reason: 'TOO_LONG',
      });
    });

    it('conserva la forma declarada sin alterarla', () => {
      const result = normalizeDocumentNumber('CEDULA_CIUDADANIA', '  1.234  ');
      expect(result.ok && result.declared).toBe('1.234');
    });
  });
});
