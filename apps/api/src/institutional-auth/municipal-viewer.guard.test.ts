import {
  ForbiddenException,
  type ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';

import {
  type InstitutionalAuthService,
  type InstitutionalPrincipal,
} from './institutional-auth.service';
import {
  INSTITUTIONAL_PRINCIPAL_KEY,
  MunicipalViewerGuard,
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from './municipal-viewer.guard';

/**
 * Autorización server-side de la superficie municipal
 * (TASK-MUNICIPALITY-CORE-01, FR-14 y prueba T-05).
 *
 * El caso `403` no puede provocarse hoy contra la base de datos, porque el enum
 * `InstitutionalRole` solo declara `MUNICIPAL_VIEWER`. Se verifica aquí, con un
 * principal fabricado, para que el contrato quede cubierto y siga cubierto
 * cuando se añadan más roles.
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

const PRINCIPAL: InstitutionalPrincipal = {
  sessionId: '00000000-0000-0000-0000-000000000001',
  identityId: '00000000-0000-0000-0000-000000000002',
  tenantId: '00000000-0000-0000-0000-000000000003',
  role: 'MUNICIPAL_VIEWER',
};

describe('MunicipalViewerGuard', () => {
  it('deniega con 401 cuando no hay sesión institucional válida', async () => {
    const guard = new MunicipalViewerGuard(servicio(async () => null));
    const { context } = contexto();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deniega con 401 cuando llega la cookie de autoinscripción de paciente', async () => {
    const guard = new MunicipalViewerGuard(
      servicio(async (token) => {
        // El guard solo lee la cookie institucional: la de paciente no llega aquí.
        expect(token).toBeNull();

        return null;
      }),
    );
    const { context } = contexto('merdn_enrollment_session=token-ficticio-de-paciente');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deniega con 403 cuando la identidad no tiene el rol municipal', async () => {
    const guard = new MunicipalViewerGuard(
      servicio(async () => ({
        ...PRINCIPAL,
        role: 'OTRO_ROL_FUTURO' as InstitutionalPrincipal['role'],
      })),
    );
    const { context } = contexto('merdn_institutional_session=token-ficticio');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('autoriza y adjunta el principal cuando el rol es el municipal', async () => {
    const guard = new MunicipalViewerGuard(servicio(async () => PRINCIPAL));
    const { context, request } = contexto('merdn_institutional_session=token-ficticio');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(institutionalPrincipalOf(request)).toStrictEqual(PRINCIPAL);
    expect(request[INSTITUTIONAL_PRINCIPAL_KEY]?.tenantId).toBe(PRINCIPAL.tenantId);
  });

  it('falla cerrado si el contexto de ejecución seguro no puede confirmarse', async () => {
    const guard = new MunicipalViewerGuard(
      servicio(async () => {
        throw new RuntimeContextUnavailableError('motivo técnico de prueba');
      }),
    );
    const { context } = contexto('merdn_institutional_session=token-ficticio');

    const error = await guard.canActivate(context).catch((causa: unknown) => causa);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify(error)).not.toContain('motivo técnico de prueba');
  });
});
