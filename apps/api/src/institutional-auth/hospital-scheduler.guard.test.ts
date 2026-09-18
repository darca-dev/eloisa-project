import {
  ForbiddenException,
  type ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { type PrismaService } from '../database/prisma.service';
import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { type TenantContextService } from '../database/tenant-context.service';

import { HospitalSchedulerGuard } from './hospital-scheduler.guard';
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
 * Autorización server-side de la superficie hospitalaria de OPERACIONES
 * (TASK-HOSPITAL-CORE-02 §3.1, §7.2, §7.3 y §11.2).
 *
 * Se verifica con un principal fabricado, sin base de datos: lo que se prueba es
 * la DECISIÓN de autorización, no la persistencia. La matriz completa contra
 * PostgreSQL vive en `test/hospital-professionals.api.test.ts`.
 *
 * Los identificadores de estas pruebas son ficticios y opacos.
 */

interface Contexto {
  readonly context: ExecutionContext;
  readonly request: RequestWithInstitutionalPrincipal;
  readonly headers: Record<string, string>;
}

function contexto(cookie?: string): Contexto {
  const headers: Record<string, string> = {};
  const request = {
    method: 'GET',
    path: '/api/v1/hospital/professionals',
    headers: cookie === undefined ? {} : { cookie },
  } as unknown as RequestWithInstitutionalPrincipal;

  const response = {
    setHeader: (nombre: string, valor: string): void => {
      headers[nombre] = valor;
    },
  };

  return {
    request,
    headers,
    context: {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ExecutionContext,
  };
}

function servicio(
  validate: (token: string | null, now: Date) => Promise<InstitutionalPrincipal | null>,
): InstitutionalAuthService {
  return { validate } as unknown as InstitutionalAuthService;
}

/**
 * Registro de auditoría que SIEMPRE falla.
 *
 * Es deliberado: comprueba que un fallo al auditar la denegación NUNCA altera el
 * resultado de la autorización. Convertirlo en fail-closed abriría una vía de
 * denegación de servicio y un oráculo de «denegado y auditado».
 */
const PRISMA_QUE_FALLA = {
  withTenant: async (): Promise<never> => {
    throw new Error('auditoría no disponible');
  },
} as unknown as PrismaService;

const TENANTS = {
  resolveActiveTenant: async () => ({
    tenantId: '00000000-0000-0000-0000-000000000003',
    tenantCode: 'merdn-mvp',
  }),
} as unknown as TenantContextService;

const AGENDA: InstitutionalPrincipal = {
  sessionId: '00000000-0000-0000-0000-000000000001',
  identityId: '00000000-0000-0000-0000-000000000002',
  tenantId: '00000000-0000-0000-0000-000000000003',
  role: 'HOSPITAL_SCHEDULER',
};

const VIEWER: InstitutionalPrincipal = { ...AGENDA, role: 'HOSPITAL_PATIENT_VIEWER' };
const MUNICIPAL: InstitutionalPrincipal = { ...AGENDA, role: 'MUNICIPAL_VIEWER' };

function guard(
  validate: (token: string | null, now: Date) => Promise<InstitutionalPrincipal | null>,
): HospitalSchedulerGuard {
  return new HospitalSchedulerGuard(servicio(validate), PRISMA_QUE_FALLA, TENANTS);
}

describe('HospitalSchedulerGuard', () => {
  it('admite una sesión con el rol de agenda y publica el principal', async () => {
    const { context, request } = contexto('merdn_institutional_session=token-ficticio');

    await expect(guard(async () => AGENDA).canActivate(context)).resolves.toBe(true);
    expect(institutionalPrincipalOf(request)).toStrictEqual(AGENDA);
  });

  it('deniega con 401 cuando no hay sesión válida', async () => {
    const { context, request } = contexto();

    await expect(guard(async () => null).canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // Sin principal: no se adjunta nada al que el controlador pudiera confiar.
    expect(request[INSTITUTIONAL_PRINCIPAL_KEY]).toBeUndefined();
  });

  /*
   * El punto EXACTO que TASK-HOSPITAL-CORE-02 §3.1 protege:
   * `HOSPITAL_PATIENT_VIEWER` conserva su carácter de solo lectura sobre
   * Pacientes y NO gana esta superficie ni ninguna escritura.
   */
  it('deniega con 403 a cualquier otro rol institucional', async () => {
    for (const principal of [VIEWER, MUNICIPAL]) {
      const { context, request } = contexto('merdn_institutional_session=token-ficticio');

      await expect(
        guard(async () => principal).canActivate(context),
      ).rejects.toBeInstanceOf(ForbiddenException);

      /*
       * El principal se adjunta para que la traza registre el rol efectivo del
       * intento. Adjuntarlo no concede nada: el controlador no se ejecuta.
       */
      expect(institutionalPrincipalOf(request)?.role).toBe(principal.role);
    }
  });

  it('fija las cabeceras de no-caché también en la denegación', async () => {
    const { context, headers } = contexto();

    await expect(guard(async () => null).canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(headers['Cache-Control']).toBe('private, no-store');
    expect(headers['Pragma']).toBe('no-cache');
    expect(headers['Vary']).toBe('Cookie');
  });

  it('FAIL-CLOSED: un contexto de ejecución no confirmado termina en 503', async () => {
    const { context } = contexto('merdn_institutional_session=token-ficticio');

    await expect(
      guard(async () => {
        throw new RuntimeContextUnavailableError('el rol efectivo no es merdn_runtime');
      }).canActivate(context),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('un fallo al auditar la denegación NO la convierte en permiso', async () => {
    const { context } = contexto('merdn_institutional_session=token-ficticio');

    /*
     * `PRISMA_QUE_FALLA` lanza en cada intento de registro. La denegación debe
     * mantenerse EXACTAMENTE igual: la excepción original se relanza siempre.
     */
    await expect(guard(async () => VIEWER).canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('propaga un error inesperado en lugar de conceder acceso', async () => {
    const { context } = contexto('merdn_institutional_session=token-ficticio');

    await expect(
      guard(async () => {
        throw new Error('fallo inesperado');
      }).canActivate(context),
    ).rejects.toThrow('fallo inesperado');
  });
});
