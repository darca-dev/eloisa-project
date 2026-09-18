import {
  ForbiddenException,
  type ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';

import { HospitalPatientViewerGuard } from './hospital-patient-viewer.guard';
import {
  type InstitutionalAuthService,
  type InstitutionalPrincipal,
} from './institutional-auth.service';
import {
  INSTITUTIONAL_PRINCIPAL_KEY,
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from './municipal-viewer.guard';

/**
 * Autorización server-side de la superficie hospitalaria de Pacientes
 * (TASK-HOSPITAL-CORE-01 §9.4, §9.5 y prueba §12.1 «Guard Hospital»).
 *
 * Se verifica con un principal fabricado, sin base de datos: lo que se prueba es
 * la DECISIÓN de autorización, no la persistencia. La matriz completa contra
 * PostgreSQL vive en `test/hospital-patients.api.test.ts`.
 *
 * Los identificadores de estas pruebas son ficticios y opacos.
 */

function contexto(cookie?: string): {
  readonly context: ExecutionContext;
  readonly request: RequestWithInstitutionalPrincipal;
} {
  const request = {
    headers: cookie === undefined ? {} : { cookie },
  } as unknown as RequestWithInstitutionalPrincipal;

  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  };
}

function servicio(
  validate: (token: string | null, now: Date) => Promise<InstitutionalPrincipal | null>,
): InstitutionalAuthService {
  return { validate } as unknown as InstitutionalAuthService;
}

const HOSPITALARIO: InstitutionalPrincipal = {
  sessionId: '00000000-0000-0000-0000-000000000001',
  identityId: '00000000-0000-0000-0000-000000000002',
  tenantId: '00000000-0000-0000-0000-000000000003',
  role: 'HOSPITAL_PATIENT_VIEWER',
};

const COOKIE_INSTITUCIONAL = 'merdn_institutional_session=token-ficticio';

describe('HospitalPatientViewerGuard', () => {
  it('deniega con 401 cuando no hay sesión institucional válida', async () => {
    const guard = new HospitalPatientViewerGuard(servicio(async () => null));
    const { context, request } = contexto();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    // Sin principal no se adjunta nada a la petición.
    expect(institutionalPrincipalOf(request)).toBeNull();
  });

  it('deniega con 401 cuando llega la cookie de autoinscripción de paciente', async () => {
    const guard = new HospitalPatientViewerGuard(
      servicio(async (token) => {
        // El guard solo lee la cookie institucional: la de paciente no llega aquí.
        expect(token).toBeNull();

        return null;
      }),
    );
    const { context } = contexto('merdn_enrollment_session=token-ficticio-de-paciente');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  /*
   * Compatibilidad municipal, §9.4: una sesión municipal VÁLIDA no se degrada a
   * `401` —existe— pero tampoco accede a Hospital. Es exactamente un `403`.
   */
  it('deniega con 403 una sesión municipal válida', async () => {
    const guard = new HospitalPatientViewerGuard(
      servicio(async () => ({ ...HOSPITALARIO, role: 'MUNICIPAL_VIEWER' })),
    );
    const { context } = contexto(COOKIE_INSTITUCIONAL);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deniega con 403 cualquier rol futuro que no sea el hospitalario', async () => {
    const guard = new HospitalPatientViewerGuard(
      servicio(async () => ({
        ...HOSPITALARIO,
        role: 'OTRO_ROL_FUTURO' as InstitutionalPrincipal['role'],
      })),
    );
    const { context } = contexto(COOKIE_INSTITUCIONAL);

    // Denegación por DEFECTO: un rol desconocido no hereda ningún permiso.
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('adjunta el principal al denegar, para que la denegación pueda auditarse', async () => {
    const guard = new HospitalPatientViewerGuard(
      servicio(async () => ({ ...HOSPITALARIO, role: 'MUNICIPAL_VIEWER' })),
    );
    const { context, request } = contexto(COOKIE_INSTITUCIONAL);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);

    // Adjuntarlo no concede nada: el controlador no llega a ejecutarse.
    expect(institutionalPrincipalOf(request)?.role).toBe('MUNICIPAL_VIEWER');
  });

  it('autoriza y adjunta el principal cuando el rol es el hospitalario', async () => {
    const guard = new HospitalPatientViewerGuard(servicio(async () => HOSPITALARIO));
    const { context, request } = contexto(COOKIE_INSTITUCIONAL);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(institutionalPrincipalOf(request)).toStrictEqual(HOSPITALARIO);
    expect(request[INSTITUTIONAL_PRINCIPAL_KEY]?.tenantId).toBe(HOSPITALARIO.tenantId);
  });

  it('falla cerrado si el contexto de ejecución seguro no puede confirmarse', async () => {
    const guard = new HospitalPatientViewerGuard(
      servicio(async () => {
        throw new RuntimeContextUnavailableError('motivo técnico de prueba');
      }),
    );
    const { context } = contexto(COOKIE_INSTITUCIONAL);

    const error = await guard.canActivate(context).catch((causa: unknown) => causa);

    // Fail-closed: nunca se concede el acceso «por si acaso».
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify(error)).not.toContain('motivo técnico de prueba');
  });

  it('no acepta un rol enviado por el cliente en cabeceras ni en la cookie', async () => {
    const guard = new HospitalPatientViewerGuard(
      servicio(async () => ({ ...HOSPITALARIO, role: 'MUNICIPAL_VIEWER' })),
    );
    const request = {
      headers: {
        cookie: `${COOKIE_INSTITUCIONAL}; role=HOSPITAL_PATIENT_VIEWER`,
        'x-institutional-role': 'HOSPITAL_PATIENT_VIEWER',
      },
    } as unknown as RequestWithInstitutionalPrincipal;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    // El rol se lee de la identidad persistida, nunca de la petición.
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
