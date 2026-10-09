import { describe, expect, it, vi } from 'vitest';
import { ACCESS_REGISTRATION_DEMOS } from './accessRequestDemoFixtures';
import { accessRequestPasswordProblem } from './accessRequestClient';
import { elegirPerfil, validarPaso, type RegistrationState } from './accessRegistrationFlow';
import { precargarUsuarioTest } from './accessRegistrationTestUser';

type Branch = Extract<RegistrationState, { pantalla: 'rama' }>;

describe('precarga explícita de usuarios test', () => {
  for (const fixture of ACCESS_REGISTRATION_DEMOS) {
    it(fixture.label + ': completa los cinco pasos y una contraseña válida', () => {
      const branch = elegirPerfil(fixture.perfil) as Branch;
      const loaded = precargarUsuarioTest(branch, fixture.id);
      expect(loaded).not.toBeNull();
      if (loaded === null) throw new Error('Precarga ausente');
      for (const step of [1, 2, 3, 4, 5] as const) {
        expect(validarPaso(loaded.perfil, step, loaded.base, loaded.reg, loaded.password)).toBeNull();
      }
      expect(accessRequestPasswordProblem(loaded.password)).toBeNull();
      expect(loaded.password.length).toBeGreaterThanOrEqual(32);
      expect(fixture).not.toHaveProperty('password');
      expect(fixture.registro).not.toHaveProperty('password');
      expect(branch.password).toBe('');
    });
  }

  it('genera una nueva credencial al repetir la precarga sin mutar los datos test', () => {
    const branch = elegirPerfil('PATIENT') as Branch;
    const first = precargarUsuarioTest(branch, 'paciente-1');
    const second = precargarUsuarioTest(branch, 'paciente-1');
    expect(first?.password).not.toBe(second?.password);
    expect(first?.base).toEqual(second?.base);
    expect(first?.reg).not.toBe(second?.reg);
    if (first === null || second === null || !('condiciones' in first.reg) || !('condiciones' in second.reg)) throw new Error('Precarga inválida');
    expect(first.reg.condiciones).not.toBe(second.reg.condiciones);
  });

  it('rechaza un id ajeno al perfil o inexistente sin cambiar el borrador', () => {
    const branch = elegirPerfil('CAREGIVER') as Branch;
    expect(precargarUsuarioTest(branch, 'paciente-1')).toBeNull();
    expect(precargarUsuarioTest(branch, 'desconocido')).toBeNull();
    expect(branch).toEqual(elegirPerfil('CAREGIVER'));
  });

  it('reemplaza el expediente anterior sin conservar campos ocultos ni otra contraseña', () => {
    const branch = elegirPerfil('FIELD_PROFESSIONAL') as Branch;
    const first = precargarUsuarioTest(branch, 'visitador-2');
    if (first === null) throw new Error('Precarga ausente');
    const second = precargarUsuarioTest(first, 'visitador-1');
    expect(second?.reg).toHaveProperty('otraEps', '');
    expect(second?.password).not.toBe(first.password);
  });

  it('no usa una contraseña fija si no hay aleatoriedad criptográfica', () => {
    const random = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => { throw new Error('CSPRNG unavailable'); });
    try {
      const branch = elegirPerfil('PATIENT') as Branch;
      expect(() => precargarUsuarioTest(branch, 'paciente-1')).toThrow('CSPRNG unavailable');
      expect(branch.password).toBe('');
    } finally {
      random.mockRestore();
    }
  });
});
