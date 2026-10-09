import { ACCESS_REGISTRATION_DEMOS } from './accessRequestDemoFixtures';
import { registroVacio, type RegistrationState } from './accessRegistrationFlow';

type RegistrationBranch = Extract<RegistrationState, { pantalla: 'rama' }>;

/** Credencial nueva por precarga, solo en memoria; nunca forma parte del fixture. */
function generarContrasenaTest(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return 'Tt9-' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Precarga explícita: no realiza peticiones, crea cuentas ni concede permisos. */
export function precargarUsuarioTest(rama: RegistrationBranch, id: string): RegistrationBranch | null {
  const fixture = ACCESS_REGISTRATION_DEMOS.find(
    (candidato) => candidato.id === id && candidato.perfil === rama.perfil,
  );
  if (fixture === undefined) {
    return null;
  }
  return {
    ...rama,
    base: {
      documentType: fixture.base.documentType,
      documentNumber: fixture.base.documentNumber,
      givenNames: fixture.base.givenNames,
      familyNames: fixture.base.familyNames,
      birthDate: fixture.base.birthDate,
      sexGenderCode: fixture.base.sexGenderCode,
      phone: fixture.base.phone ?? '',
      email: fixture.base.email ?? '',
    },
    reg: { ...registroVacio(rama.perfil), ...structuredClone(fixture.registro) },
    password: generarContrasenaTest(),
  };
}
