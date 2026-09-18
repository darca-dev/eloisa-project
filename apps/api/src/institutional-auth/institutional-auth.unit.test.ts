import { describe, expect, it } from 'vitest';

import { type ApiEnvironment } from '../config/environment';

import { loadInstitutionalAuthConfig } from './institutional-auth.config';
import {
  HOSPITAL_PATIENT_VIEWER_IDENTITY_CODE,
  INSTITUTIONAL_ENV,
  INSTITUTIONAL_IDENTITY_CODE_PATTERN,
  INSTITUTIONAL_ROLES,
  INSTITUTIONAL_SESSION_COOKIE_NAME,
  INSTITUTIONAL_SESSION_DEFAULT_TTL_SECONDS,
  MUNICIPAL_VIEWER_IDENTITY_CODE,
} from './institutional-auth.contract';
import {
  buildInstitutionalSessionClearCookie,
  buildInstitutionalSessionCookie,
} from './institutional-session.cookie';
import { deriveSecret, hashWithSalt, verifySecret } from './institutional-secret';

/**
 * Identidad y sesión institucional: piezas verificables sin base de datos
 * (TASK-MUNICIPALITY-CORE-01, FR-13 y §Permisos 5; generalización de roles
 * verificada por TASK-HOSPITAL-CORE-01 §12.1 y ampliada con el rol de agenda
 * por TASK-HOSPITAL-CORE-02 §7.1).
 *
 * Todas las credenciales de estas pruebas son FICTICIAS y de uso exclusivamente
 * local.
 */

const SECRETO_FICTICIO = 'clave-ficticia-de-pruebas-0001';

/**
 * Código de identidad con forma NO admitida.
 *
 * Se compone en tiempo de ejecución para que el literal no aparezca en el
 * código fuente: el objetivo es comprobar que un valor hostil se descarta antes
 * de llegar a ninguna consulta, no dejar una cadena con apariencia de inyección
 * escrita en el repositorio.
 */
const CODIGO_NO_ADMITIDO = `Hospital${String.fromCharCode(39)}; DROP TABLE person; --`;

function entorno(overrides: Partial<ApiEnvironment> = {}): ApiEnvironment {
  return {
    merdnEnvironment: 'development',
    port: 3001,
    openApiPath: 'docs',
    runtimeRoleMode: 'disabled',
    hasSeparateRuntimeConnection: false,
    activeTenantCode: 'merdn-mvp',
    // Spec 024: sin rol runtime aplicado el identificador es opcional; se declara
    // de forma explicita para que el fixture no dependa de un campo ausente.
    activeTenantId: undefined,
    consent: { version: 'v1', purpose: 'PRUEBA' },
    enrollmentSession: {
      cookieName: 'merdn_enrollment_session',
      sameSite: 'lax',
      secure: false,
      domain: undefined,
      ttlSeconds: 3600,
    },
    webOrigins: ['http://127.0.0.1:3000'],
    enrollmentRateLimit: { maxRequests: 10, windowSeconds: 900 },
    ...overrides,
  };
}

describe('derivación de la credencial institucional', () => {
  it('deriva con sal aleatoria y verifica la credencial correcta', async () => {
    const derivada = await deriveSecret(SECRETO_FICTICIO);

    expect(derivada.salt).toMatch(/^[0-9a-f]{32}$/u);
    expect(derivada.hash).toMatch(/^[0-9a-f]{128}$/u);
    expect(derivada.hash).not.toContain(SECRETO_FICTICIO);

    await expect(verifySecret(SECRETO_FICTICIO, derivada)).resolves.toBe(true);
  });

  it('rechaza una credencial distinta, aunque se parezca', async () => {
    const derivada = await deriveSecret(SECRETO_FICTICIO);

    await expect(verifySecret(`${SECRETO_FICTICIO}x`, derivada)).resolves.toBe(false);
    await expect(verifySecret('', derivada)).resolves.toBe(false);
  });

  it('usa una sal distinta en cada derivación', async () => {
    const primera = await deriveSecret(SECRETO_FICTICIO);
    const segunda = await deriveSecret(SECRETO_FICTICIO);

    expect(primera.salt).not.toBe(segunda.salt);
    expect(primera.hash).not.toBe(segunda.hash);
  });

  it('es determinista con la misma sal', async () => {
    const derivada = await deriveSecret(SECRETO_FICTICIO);

    await expect(hashWithSalt(SECRETO_FICTICIO, derivada.salt)).resolves.toBe(
      derivada.hash,
    );
  });

  it('rechaza sin lanzar un almacenamiento con forma inesperada', async () => {
    await expect(
      verifySecret(SECRETO_FICTICIO, { hash: 'no-hexadecimal', salt: 'tampoco' }),
    ).resolves.toBe(false);
  });
});

describe('cookie institucional', () => {
  const opciones = {
    sameSite: 'lax' as const,
    secure: true,
    domain: undefined,
    ttlSeconds: 3600,
  };

  it('es HttpOnly, acotada y solo lleva el token', () => {
    const cookie = buildInstitutionalSessionCookie('token-ficticio', opciones);

    expect(cookie).toContain(`${INSTITUTIONAL_SESSION_COOKIE_NAME}=token-ficticio`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=3600');
    expect(cookie).toContain('Path=/');
  });

  it('no comparte nombre con la cookie de autoinscripción de paciente', () => {
    expect(INSTITUTIONAL_SESSION_COOKIE_NAME).not.toBe('merdn_enrollment_session');
  });

  it('la cookie de borrado caduca de inmediato y no lleva valor', () => {
    const cookie = buildInstitutionalSessionClearCookie(opciones);

    expect(cookie).toContain(`${INSTITUTIONAL_SESSION_COOKIE_NAME}=;`);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
  });

  it('omite Secure solo cuando el despliegue lo indica', () => {
    const cookie = buildInstitutionalSessionCookie('token-ficticio', {
      ...opciones,
      secure: false,
    });

    expect(cookie).not.toContain('Secure');
  });
});

describe('configuración del aprovisionamiento institucional', () => {
  const SECRETO_HOSPITAL = 'clave-ficticia-de-pruebas-hospital-0002';
  const SECRETO_AGENDA = 'clave-ficticia-de-pruebas-agenda-0003';

  /**
   * Código de agenda CONFIGURADO POR ESTA PRUEBA.
   *
   * No es un valor por defecto ni un fallback: la agenda no tiene ninguno. Este
   * literal existe solo para poder declarar el escenario válido, exactamente
   * como lo haría un despliegue al definir `MERDN_HOSPITAL_SCHEDULER_CODE`.
   */
  const CODIGO_AGENDA_CONFIGURADO = 'agenda-hospitalaria-ficticia';

  /** Roles efectivamente aprovisionables por una configuración dada. */
  function roles(source: Record<string, string>): readonly string[] {
    return loadInstitutionalAuthConfig(source, entorno()).provisioning.identities.map(
      (identity) => identity.role,
    );
  }

  /*
   * TASK-HOSPITAL-CORE-01 §12.1 y TASK-HOSPITAL-CORE-02 §7.1: configuración
   * municipal-only, hospital-only, agenda-only, combinadas y ninguna. Cada rol
   * es INDEPENDIENTE y FAIL-CLOSED.
   */
  it('sin ninguna credencial no aprovisiona ninguna identidad', () => {
    const config = loadInstitutionalAuthConfig({}, entorno());

    expect(config.provisioning.identities).toStrictEqual([]);
    expect(config.provisioning.compatibilityIdentityCode).toBeNull();
    expect(config.sessionTtlSeconds).toBe(INSTITUTIONAL_SESSION_DEFAULT_TTL_SECONDS);
    expect(config.provisioning.skipped.map((omitida) => omitida.role)).toStrictEqual([
      'MUNICIPAL_VIEWER',
      'HOSPITAL_PATIENT_VIEWER',
      'HOSPITAL_SCHEDULER',
    ]);
  });

  it('configurar Pacientes NO habilita la agenda, ni al revés', () => {
    expect(
      roles({ [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL }),
    ).toStrictEqual(['HOSPITAL_PATIENT_VIEWER']);

    expect(
      roles({
        [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
        [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO,
      }),
    ).toStrictEqual(['HOSPITAL_SCHEDULER']);

    expect(
      roles({
        [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL,
        [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
        [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO,
      }),
    ).toStrictEqual(['HOSPITAL_PATIENT_VIEWER', 'HOSPITAL_SCHEDULER']);
  });

  it('los dos roles hospitalarios no pueden compartir código', () => {
    const config = loadInstitutionalAuthConfig(
      {
        [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL,
        [INSTITUTIONAL_ENV.hospitalPatientViewerCode]: 'hospital-unico',
        [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
        [INSTITUTIONAL_ENV.hospitalSchedulerCode]: 'hospital-unico',
      },
      entorno(),
    );

    expect(config.provisioning.identities.map((identity) => identity.role)).toStrictEqual([
      'HOSPITAL_PATIENT_VIEWER',
    ]);
    expect(
      config.provisioning.skipped.some((omitida) => omitida.role === 'HOSPITAL_SCHEDULER'),
    ).toBe(true);
  });

  it('con solo la credencial municipal no aprovisiona la hospitalaria', () => {
    expect(
      roles({ [INSTITUTIONAL_ENV.municipalViewerSecret]: SECRETO_FICTICIO }),
    ).toStrictEqual(['MUNICIPAL_VIEWER']);
  });

  it('con solo la credencial hospitalaria no aprovisiona la municipal', () => {
    const config = loadInstitutionalAuthConfig(
      { [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL },
      entorno(),
    );

    expect(config.provisioning.identities.map((identity) => identity.role)).toStrictEqual([
      'HOSPITAL_PATIENT_VIEWER',
    ]);
    /*
     * Sin Alcaldía no hay identidad de compatibilidad: una petición sin
     * `identityCode` no puede resolver ninguna credencial.
     */
    expect(config.provisioning.compatibilityIdentityCode).toBeNull();
  });

  it('con ambas credenciales aprovisiona los dos roles con códigos distintos', () => {
    const config = loadInstitutionalAuthConfig(
      {
        [INSTITUTIONAL_ENV.municipalViewerSecret]: SECRETO_FICTICIO,
        [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL,
      },
      entorno(),
    );

    const codigos = config.provisioning.identities.map((identity) => identity.identityCode);

    expect(config.provisioning.identities).toHaveLength(2);
    expect(new Set(codigos).size).toBe(2);
    expect(config.provisioning.compatibilityIdentityCode).toBe(
      MUNICIPAL_VIEWER_IDENTITY_CODE,
    );
  });

  it('rechaza una credencial demasiado corta y no la registra', () => {
    const config = loadInstitutionalAuthConfig(
      {
        [INSTITUTIONAL_ENV.municipalViewerSecret]: 'abc123',
        [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: 'xyz789',
        [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: 'qwe456',
      },
      entorno(),
    );

    expect(config.provisioning.identities).toStrictEqual([]);

    for (const omitida of config.provisioning.skipped) {
      expect(omitida.reason).toContain('caracteres');
      expect(omitida.reason).not.toContain('abc123');
      expect(omitida.reason).not.toContain('xyz789');
      expect(omitida.reason).not.toContain('qwe456');
    }
  });

  it('el motivo nombra la variable y jamás su valor', () => {
    const config = loadInstitutionalAuthConfig({}, entorno());
    const motivos = config.provisioning.skipped.map((omitida) => omitida.reason).join(' ');

    expect(motivos).toContain(INSTITUTIONAL_ENV.municipalViewerSecret);
    expect(motivos).toContain(INSTITUTIONAL_ENV.hospitalPatientViewerSecret);
    expect(motivos).toContain(INSTITUTIONAL_ENV.hospitalSchedulerSecret);
    expect(motivos).not.toContain(SECRETO_FICTICIO);
    expect(motivos).not.toContain(SECRETO_AGENDA);
  });

  it('acepta un código de identidad declarado y descarta uno mal formado', () => {
    const declarado = loadInstitutionalAuthConfig(
      {
        [INSTITUTIONAL_ENV.municipalViewerSecret]: SECRETO_FICTICIO,
        [INSTITUTIONAL_ENV.municipalViewerCode]: 'alcaldia-consulta',
        [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL,
        [INSTITUTIONAL_ENV.hospitalPatientViewerCode]: 'hospital-consulta',
      },
      entorno(),
    );

    expect(declarado.provisioning.identities[0]?.identityCode).toBe('alcaldia-consulta');
    expect(declarado.provisioning.identities[0]?.accessSecret).toBe(SECRETO_FICTICIO);
    expect(declarado.provisioning.identities[1]?.identityCode).toBe('hospital-consulta');
    expect(declarado.provisioning.compatibilityIdentityCode).toBe('alcaldia-consulta');

    /*
     * Un código con forma inesperada NO se propaga a la consulta: se sustituye
     * por el código por defecto del rol.
     */
    const malFormado = loadInstitutionalAuthConfig(
      {
        [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL,
        [INSTITUTIONAL_ENV.hospitalPatientViewerCode]: CODIGO_NO_ADMITIDO,
      },
      entorno(),
    );

    expect(malFormado.provisioning.identities[0]?.identityCode).toBe(
      HOSPITAL_PATIENT_VIEWER_IDENTITY_CODE,
    );
  });

  it('no aprovisiona dos roles con el mismo código', () => {
    const config = loadInstitutionalAuthConfig(
      {
        [INSTITUTIONAL_ENV.municipalViewerSecret]: SECRETO_FICTICIO,
        [INSTITUTIONAL_ENV.municipalViewerCode]: 'identidad-compartida',
        [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL,
        [INSTITUTIONAL_ENV.hospitalPatientViewerCode]: 'identidad-compartida',
      },
      entorno(),
    );

    // Se conserva el primero declarado; el segundo se omite con motivo.
    expect(config.provisioning.identities.map((identity) => identity.role)).toStrictEqual([
      'MUNICIPAL_VIEWER',
    ]);
    expect(config.provisioning.skipped[0]?.role).toBe('HOSPITAL_PATIENT_VIEWER');
    expect(config.provisioning.skipped[0]?.reason).toContain('MUNICIPAL_VIEWER');
  });

  it('los tres roles del contrato son exactamente los implementados', () => {
    expect([...INSTITUTIONAL_ROLES]).toStrictEqual([
      'MUNICIPAL_VIEWER',
      'HOSPITAL_PATIENT_VIEWER',
      'HOSPITAL_SCHEDULER',
    ]);
  });

  it('exige transporte cifrado fuera de desarrollo local', () => {
    const desarrollo = loadInstitutionalAuthConfig({}, entorno());
    const mvp = loadInstitutionalAuthConfig({}, entorno({ merdnEnvironment: 'mvp' }));

    expect(desarrollo.cookie.secure).toBe(false);
    expect(mvp.cookie.secure).toBe(true);
  });

  it('SameSite=None obliga a Secure incluso en desarrollo', () => {
    const config = loadInstitutionalAuthConfig(
      {},
      entorno({
        enrollmentSession: {
          cookieName: 'merdn_enrollment_session',
          sameSite: 'none',
          secure: true,
          domain: undefined,
          ttlSeconds: 3600,
        },
      }),
    );

    expect(config.cookie.sameSite).toBe('none');
    expect(config.cookie.secure).toBe(true);
  });

  it('acota la vigencia declarada y recurre al valor por defecto si es absurda', () => {
    const corta = loadInstitutionalAuthConfig(
      { [INSTITUTIONAL_ENV.sessionTtlSeconds]: '10' },
      entorno(),
    );
    const larga = loadInstitutionalAuthConfig(
      { [INSTITUTIONAL_ENV.sessionTtlSeconds]: '999999' },
      entorno(),
    );
    const valida = loadInstitutionalAuthConfig(
      { [INSTITUTIONAL_ENV.sessionTtlSeconds]: '1800' },
      entorno(),
    );

    expect(corta.sessionTtlSeconds).toBe(INSTITUTIONAL_SESSION_DEFAULT_TTL_SECONDS);
    expect(larga.sessionTtlSeconds).toBe(INSTITUTIONAL_SESSION_DEFAULT_TTL_SECONDS);
    expect(valida.sessionTtlSeconds).toBe(1800);
  });

  it('el código de identidad admitido acota su forma', () => {
    expect(INSTITUTIONAL_IDENTITY_CODE_PATTERN.test('hospital-patient-viewer')).toBe(true);
    expect(INSTITUTIONAL_IDENTITY_CODE_PATTERN.test('MUNICIPAL')).toBe(false);
    expect(INSTITUTIONAL_IDENTITY_CODE_PATTERN.test(CODIGO_NO_ADMITIDO)).toBe(false);
    expect(INSTITUTIONAL_IDENTITY_CODE_PATTERN.test('')).toBe(false);
    expect(INSTITUTIONAL_IDENTITY_CODE_PATTERN.test('a'.repeat(65))).toBe(false);
  });
});

/**
 * Agenda hospitalaria: CÓDIGO y CREDENCIAL exigidos, sin valor por defecto
 * (TASK-HOSPITAL-CORE-02, corrección final fail-closed).
 *
 * A diferencia de los dos roles de consulta —que conservan su código histórico
 * por compatibilidad—, `HOSPITAL_SCHEDULER` no tiene código por defecto. La
 * identidad solo existe cuando `MERDN_HOSPITAL_SCHEDULER_CODE` y
 * `MERDN_HOSPITAL_SCHEDULER_SECRET` están AMBAS presentes y son válidas en la
 * misma carga. Cualquier otra combinación omite EXCLUSIVAMENTE esa identidad.
 *
 * Todas las credenciales y códigos de estas pruebas son FICTICIOS.
 */
describe('aprovisionamiento fail-closed de la agenda hospitalaria', () => {
  const SECRETO_HOSPITAL = 'clave-ficticia-de-pruebas-hospital-0002';
  const SECRETO_AGENDA = 'clave-ficticia-de-pruebas-agenda-0003';
  const CODIGO_AGENDA_CONFIGURADO = 'agenda-hospitalaria-ficticia';

  function cargar(source: Record<string, string>) {
    return loadInstitutionalAuthConfig(source, entorno()).provisioning;
  }

  /** Motivo de omisión declarado para la agenda, si lo hay. */
  function motivoAgenda(source: Record<string, string>): string | undefined {
    return cargar(source).skipped.find((omitida) => omitida.role === 'HOSPITAL_SCHEDULER')
      ?.reason;
  }

  /** La agenda NO figura entre las identidades aprovisionadas. */
  function agendaOmitida(source: Record<string, string>): boolean {
    const provisioning = cargar(source);

    return (
      !provisioning.identities.some((identity) => identity.role === 'HOSPITAL_SCHEDULER') &&
      provisioning.skipped.some((omitida) => omitida.role === 'HOSPITAL_SCHEDULER')
    );
  }

  it('con solo la credencial válida NO aprovisiona la agenda', () => {
    expect(agendaOmitida({ [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA })).toBe(
      true,
    );
    expect(motivoAgenda({ [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA })).toContain(
      INSTITUTIONAL_ENV.hospitalSchedulerCode,
    );
  });

  it('con solo el código válido NO aprovisiona la agenda', () => {
    const source = { [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO };

    expect(agendaOmitida(source)).toBe(true);
    expect(motivoAgenda(source)).toContain(INSTITUTIONAL_ENV.hospitalSchedulerSecret);
  });

  it('con código y credencial válidos aprovisiona la agenda con el código configurado', () => {
    const provisioning = cargar({
      [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
      [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO,
    });

    expect(provisioning.identities.map((identity) => identity.role)).toStrictEqual([
      'HOSPITAL_SCHEDULER',
    ]);
    expect(provisioning.identities[0]?.identityCode).toBe(CODIGO_AGENDA_CONFIGURADO);
    expect(provisioning.identities[0]?.accessSecret).toBe(SECRETO_AGENDA);
    expect(
      provisioning.skipped.some((omitida) => omitida.role === 'HOSPITAL_SCHEDULER'),
    ).toBe(false);
  });

  it('credencial válida con código vacío o en blanco NO aprovisiona la agenda', () => {
    expect(
      agendaOmitida({
        [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
        [INSTITUTIONAL_ENV.hospitalSchedulerCode]: '',
      }),
    ).toBe(true);

    expect(
      agendaOmitida({
        [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
        [INSTITUTIONAL_ENV.hospitalSchedulerCode]: '   ',
      }),
    ).toBe(true);
  });

  it('credencial válida con código mal formado NO recurre a ningún valor por defecto', () => {
    const source = {
      [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
      [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_NO_ADMITIDO,
    };

    expect(agendaOmitida(source)).toBe(true);
    /*
     * Lo esencial de la corrección: un código inválido NO se sustituye por un
     * literal del rol. Ninguna identidad aparece con un código derivado.
     */
    expect(cargar(source).identities).toStrictEqual([]);
  });

  it('código válido con credencial vacía o en blanco NO aprovisiona la agenda', () => {
    expect(
      agendaOmitida({
        [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO,
        [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: '',
      }),
    ).toBe(true);

    expect(
      agendaOmitida({
        [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO,
        [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: '   ',
      }),
    ).toBe(true);
  });

  it('código válido con credencial demasiado corta NO aprovisiona la agenda', () => {
    const source = {
      [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO,
      [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: 'qwe456',
    };

    expect(agendaOmitida(source)).toBe(true);
    expect(motivoAgenda(source)).toContain(INSTITUTIONAL_ENV.hospitalSchedulerSecret);
  });

  it('las variables válidas de agenda no aprovisionan ningún otro rol', () => {
    const provisioning = cargar({
      [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
      [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO,
    });

    expect(provisioning.identities.map((identity) => identity.role)).toStrictEqual([
      'HOSPITAL_SCHEDULER',
    ]);
    expect(provisioning.skipped.map((omitida) => omitida.role)).toStrictEqual([
      'MUNICIPAL_VIEWER',
      'HOSPITAL_PATIENT_VIEWER',
    ]);
    expect(provisioning.compatibilityIdentityCode).toBeNull();
  });

  it('configurar Pacientes sin las dos variables de agenda no habilita la agenda', () => {
    const provisioning = cargar({
      [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL,
    });

    expect(provisioning.identities.map((identity) => identity.role)).toStrictEqual([
      'HOSPITAL_PATIENT_VIEWER',
    ]);
    expect(provisioning.identities[0]?.identityCode).toBe(
      HOSPITAL_PATIENT_VIEWER_IDENTITY_CODE,
    );
  });

  it('Pacientes y agenda válidas conviven con roles y códigos separados', () => {
    const provisioning = cargar({
      [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL,
      [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
      [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO,
    });

    expect(provisioning.identities.map((identity) => identity.role)).toStrictEqual([
      'HOSPITAL_PATIENT_VIEWER',
      'HOSPITAL_SCHEDULER',
    ]);
    expect(provisioning.identities.map((identity) => identity.identityCode)).toStrictEqual([
      HOSPITAL_PATIENT_VIEWER_IDENTITY_CODE,
      CODIGO_AGENDA_CONFIGURADO,
    ]);
    expect(provisioning.identities[0]?.accessSecret).toBe(SECRETO_HOSPITAL);
    expect(provisioning.identities[1]?.accessSecret).toBe(SECRETO_AGENDA);
  });

  it('una colisión explícita de códigos válidos sigue cerrando la agenda', () => {
    const provisioning = cargar({
      [INSTITUTIONAL_ENV.hospitalPatientViewerSecret]: SECRETO_HOSPITAL,
      [INSTITUTIONAL_ENV.hospitalPatientViewerCode]: CODIGO_AGENDA_CONFIGURADO,
      [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
      [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO,
    });

    expect(provisioning.identities.map((identity) => identity.role)).toStrictEqual([
      'HOSPITAL_PATIENT_VIEWER',
    ]);
    expect(
      provisioning.skipped.find((omitida) => omitida.role === 'HOSPITAL_SCHEDULER')?.reason,
    ).toContain('HOSPITAL_PATIENT_VIEWER');
  });

  it('ningún motivo de omisión revela el código recibido ni la credencial', () => {
    const motivos = [
      motivoAgenda({
        [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA,
        [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_NO_ADMITIDO,
      }),
      motivoAgenda({
        [INSTITUTIONAL_ENV.hospitalSchedulerCode]: CODIGO_AGENDA_CONFIGURADO,
        [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: 'qwe456',
      }),
      motivoAgenda({ [INSTITUTIONAL_ENV.hospitalSchedulerSecret]: SECRETO_AGENDA }),
    ].join(' ');

    expect(motivos).not.toContain(CODIGO_NO_ADMITIDO);
    expect(motivos).not.toContain(SECRETO_AGENDA);
    expect(motivos).not.toContain('qwe456');
    expect(motivos).not.toContain(CODIGO_AGENDA_CONFIGURADO);
  });
});
