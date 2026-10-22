/*
 * Recorrido REAL de navegador del semáforo (SPEC 055 / MP06).
 *
 * Solo corre si `CARE_BROWSER_WEB_URL` apunta a la web de desarrollo ya
 * arrancada contra esta API (NEXT_PUBLIC_MERDN_API_BASE_URL). Fuera de eso se
 * omite y lo dice: NO forma parte de la baseline.
 *
 * Aprovisionamiento FICTICIO, antes de importar la aplicación. Sin proveedor
 * OIDC: las sesiones humanas se siembran como haría el alta real, y el
 * navegador las presenta con la cookie HttpOnly de la API.
 */
const WEB = process.env['CARE_BROWSER_WEB_URL'] ?? '';
const API_PORT = Number(process.env['CARE_BROWSER_API_PORT'] ?? '3101');
process.env['MERDN_HUMAN_AUTH_ISSUER'] = 'http://host.docker.internal:8081/realms/merdn-local';
process.env['MERDN_HUMAN_AUTH_CLIENT_ID'] = 'merdn-human-web';
process.env['MERDN_HUMAN_AUTH_CALLBACK_URI'] = `http://127.0.0.1:${API_PORT}/api/v1/human-auth/callback`;
process.env['MERDN_HUMAN_AUTH_ATTEMPT_KEY'] = 'd'.repeat(64);
process.env['MERDN_HUMAN_AUTH_RATE_LIMIT_MAX'] = '10000';
if (WEB !== '') process.env['API_WEB_ORIGINS'] = new URL(WEB).origin;

import { randomUUID } from 'node:crypto';

import AxeBuilder from '@axe-core/playwright';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Browser, chromium, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { generateSessionToken, hashSessionToken } from '../src/enrollment-sessions/enrollment-session.tokens';
import { type PrismaClient } from '../src/generated/prisma/client';
import { ADMINISTRATOR_CAPABILITIES } from '../src/institutional-auth/institutional-administrator.contract';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';

import { CareSeed, type CuentaFicticia } from './care-context-fixtures';
import { createTestPrismaClient } from './database-availability';

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated && WEB !== '';

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn('\nRECORRIDO DE NAVEGADOR NO EJECUTADO: falta CARE_BROWSER_WEB_URL o PostgreSQL de pruebas.\n');
}

describe.skipIf(!puedeEjecutarse)('Semáforo en navegador real (055/MP06)', () => {
  let app: INestApplication;
  let owner: PrismaClient;
  let seed: CareSeed;
  let browser: Browser;

  let paciente: CuentaFicticia;
  let cuidadora: CuentaFicticia;
  let profesional: CuentaFicticia;
  let revisora: CuentaFicticia;

  const axeViolaciones: { pagina: string; id: string; impacto: string | null | undefined }[] = [];

  beforeAll(async () => {
    owner = createTestPrismaClient();
    seed = new CareSeed(owner);
    const tenant = await owner.tenant.findUniqueOrThrow({
      where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
      select: { id: true },
    });
    const tenantId = tenant.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new MalformedJsonFilter());
    app.enableCors({ origin: [new URL(WEB).origin], credentials: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type'] });
    await app.listen(API_PORT, '127.0.0.1');

    const fundadora = await seed.cuenta(tenantId, 'Fundadora');
    revisora = await seed.cuenta(tenantId, 'Revisora');
    const org = await seed.organizacion(tenantId, 'HOSPITAL');
    await seed.manager(tenantId, org, revisora.humanAccountId, fundadora.humanAccountId);

    // Administración institucional del Hospital para la revisora, como la deja el alta real.
    const registro = await owner.institutionalAdministratorRegistration.create({
      data: {
        id: randomUUID(),
        tenantId,
        experience: 'HOSPITAL',
        humanAccountId: revisora.humanAccountId,
        externalAuthIdentityId: revisora.bindingId,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        attemptTokenHash: hashSessionToken(generateSessionToken()),
      },
    });
    for (const role of ADMINISTRATOR_CAPABILITIES.HOSPITAL) {
      await owner.institutionalIdentity.create({
        data: { id: randomUUID(), tenantId, code: `admin-${registro.id}-${role.toLowerCase()}`, role, administratorRegistrationId: registro.id },
      });
    }

    paciente = await seed.cuenta(tenantId, 'Lucía');
    await seed.aprobar(paciente, 'PATIENT');
    const patientId = await seed.paciente(paciente);
    const ctx = await seed.contexto(tenantId, org, patientId, revisora.humanAccountId);

    cuidadora = await seed.cuenta(tenantId, 'Carmen');
    await seed.aprobar(cuidadora, 'CAREGIVER');
    const relacion = await seed.relacion(tenantId, patientId, cuidadora.personId);

    profesional = await seed.cuenta(tenantId, 'Visitador');
    await seed.aprobar(profesional, 'FIELD_PROFESSIONAL');
    const asignacion = await seed.asignacion(tenantId, patientId, await seed.profesional(profesional));
    const compProf = await seed.competencia(tenantId, org, profesional.humanAccountId, revisora.humanAccountId);
    const compRev = await seed.competencia(tenantId, org, revisora.humanAccountId, fundadora.humanAccountId);

    const base = { tenantId, organizationId: org, contextId: ctx, patientId };
    for (const permission of ['CONTRIBUTE_RECORDS', 'REQUEST_ALARM'] as const) {
      await seed.concesion({ ...base, humanAccountId: cuidadora.humanAccountId, actorKind: 'CAREGIVER', permission, caregiverRelationshipId: relacion, grantedByHumanAccountId: revisora.humanAccountId });
    }
    for (const permission of ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS'] as const) {
      await seed.concesion({ ...base, humanAccountId: profesional.humanAccountId, actorKind: 'PROFESSIONAL', permission, careAssignmentId: asignacion, grantedByHumanAccountId: revisora.humanAccountId });
    }
    await seed.concesion({ ...base, humanAccountId: profesional.humanAccountId, actorKind: 'PROFESSIONAL', permission: 'MANAGE_RULES', careAssignmentId: asignacion, competenceAttestationId: compProf, grantedByHumanAccountId: revisora.humanAccountId });
    // La revisora es gestora: su concesión clínica la emite la fundadora, otra persona.
    await seed.manager(tenantId, org, fundadora.humanAccountId, revisora.humanAccountId);
    await seed.concesion({ ...base, humanAccountId: revisora.humanAccountId, actorKind: 'HOSPITAL_REVIEWER', permission: 'REVIEW_ALARMS', competenceAttestationId: compRev, grantedByHumanAccountId: fundadora.humanAccountId });

    browser = await chromium.launch({ headless: true });
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await app?.close();
    await owner?.$disconnect();
    // eslint-disable-next-line no-console
    console.log(`AXE serias/críticas en el espacio de cuidado: ${JSON.stringify(axeViolaciones)}`);
  });

  async function como(cuenta: CuentaFicticia, ruta: string): Promise<Page> {
    const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await contexto.addCookies([{ name: 'merdn_human_session', value: cuenta.sessionToken, url: `http://127.0.0.1:${API_PORT}`, httpOnly: true, sameSite: 'Lax' }]);
    const page = await contexto.newPage();
    await page.goto(`${WEB}${ruta}`, { timeout: 120_000 });
    return page;
  }

  async function auditar(page: Page, nombre: string, selector: string): Promise<void> {
    const resultado = await new AxeBuilder({ page }).include(selector).analyze();
    for (const violacion of resultado.violations) {
      if (violacion.impact === 'serious' || violacion.impact === 'critical') {
        axeViolaciones.push({ pagina: nombre, id: violacion.id, impacto: violacion.impact });
      }
    }
  }

  it('el visitador valida un dato y un criterio sin valores sugeridos', async () => {
    const page = await como(profesional, '/profesional');
    const espacio = page.locator('[aria-labelledby="cuidado-profesional-titulo"]');
    await espacio.getByText('Datos que se registran en este espacio').waitFor({ timeout: 120_000 });

    await espacio.getByLabel('Nombre del dato').fill('Dato ficticio de prueba');
    await espacio.getByRole('button', { name: 'Validar dato' }).click();
    await espacio.getByText('Dato validado. Ya se puede registrar.').waitFor({ timeout: 30_000 });

    const criterios = espacio.locator('section', { hasText: 'Criterios de alarma de esta persona' });
    await criterios.getByLabel('Dato').selectOption({ label: 'Dato ficticio de prueba' });
    await criterios.getByLabel('Comparación').selectOption('EQ');
    await criterios.getByLabel('Respuesta').selectOption('si');
    await criterios.getByLabel('¿Cuántas veces debe ocurrir?').fill('1');
    await criterios.getByLabel('¿En qué ventana de tiempo?').fill('1');
    await criterios.getByLabel('Clasificación de la alarma').selectOption('AMARILLA');
    await criterios.getByRole('button', { name: 'Validar criterio' }).click();
    await espacio.getByText('Criterio validado. Cuenta lo que ocurra a partir de ahora.').waitFor({ timeout: 30_000 });
    await criterios.getByText(/alarma amarilla/u).waitFor({ timeout: 30_000 });

    await auditar(page, '/profesional', '[aria-labelledby="cuidado-profesional-titulo"]');
    await page.context().close();
  }, 240_000);

  it('la cuidadora registra, el criterio dispara y pide revisión con el texto aprobado', async () => {
    /*
     * El campo de fecha tiene precisión de minuto y el criterio solo cuenta lo
     * ocurrido DESPUÉS de su activación, que fija la base. Se espera, por
     * condición, a que el minuto en curso empiece después de esa activación.
     */
    const version = await owner.careAlarmCriterionVersion.findFirstOrThrow({ orderBy: { createdAt: 'desc' }, select: { activatedAt: true } });
    while (Math.floor(Date.now() / 60_000) * 60_000 <= version.activatedAt.getTime() + 2_000) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const page = await como(cuidadora, '/cuidador');
    const espacio = page.locator('[aria-labelledby="cuidado-cuidador-titulo"]');
    await espacio.getByText('Nueva entrada de bitácora').waitFor({ timeout: 120_000 });

    await espacio.getByRole('group', { name: 'Dato ficticio de prueba' }).getByLabel('Sí').check();
    await espacio.getByRole('button', { name: 'Guardar en la bitácora' }).click();
    await espacio.getByText('Entrada guardada. Se cumplió un criterio definido por el profesional y se generó una alarma para revisión.').waitFor({ timeout: 30_000 });

    await espacio.getByLabel('¿Qué está pasando? (opcional)').fill('Solicitud ficticia de prueba');
    await espacio.getByRole('button', { name: 'Enviar solicitud de revisión' }).click();
    await espacio.getByText('Solicitud registrada para revisión. Esto no confirma que un profesional ya la haya atendido ni sustituye los canales de urgencias.').first().waitFor({ timeout: 30_000 });
    await espacio.getByText('Clasificación: Pendiente de clasificación').first().waitFor({ timeout: 30_000 });

    await auditar(page, '/cuidador', '[aria-labelledby="cuidado-cuidador-titulo"]');
    await page.context().close();
  }, 240_000);

  it('el Hospital ve la cola con semáforo en palabras y gestiona la solicitud', async () => {
    const page = await como(revisora, '/hospital');
    await page.getByRole('button', { name: /Semáforo de alarmas/u }).first().click({ timeout: 120_000 });
    const espacio = page.locator('[aria-labelledby="cuidado-hospital-titulo"]');
    await espacio.getByText('Cola de revisión').first().waitFor({ timeout: 60_000 });
    await espacio.getByText(/Semáforo: Amarillo/u).first().waitFor({ timeout: 30_000 });

    await espacio.getByRole('button', { name: 'Abrir este espacio' }).first().click();
    await espacio.getByText('Bandeja de revisión').first().waitFor({ timeout: 30_000 });
    await espacio.getByRole('button', { name: 'Iniciar revisión' }).first().click();
    await espacio.getByText('Solicitud actualizada.').waitFor({ timeout: 30_000 });

    await auditar(page, '/hospital', '[aria-labelledby="cuidado-hospital-titulo"]');
    await page.context().close();
  }, 240_000);

  it('el paciente ve su espacio propio y no ve el gestor de criterios', async () => {
    const page = await como(paciente, '/paciente');
    const espacio = page.locator('[aria-labelledby="cuidado-paciente-titulo"]');
    await espacio.getByText('Nueva entrada de bitácora').waitFor({ timeout: 120_000 });
    expect(await espacio.getByText('Criterios de alarma de esta persona').count()).toBe(0);
    await auditar(page, '/paciente', '[aria-labelledby="cuidado-paciente-titulo"]');
    await page.context().close();
  }, 240_000);

  it('el espacio de cuidado no tiene violaciones de accesibilidad serias ni críticas', () => {
    expect(axeViolaciones).toEqual([]);
  });
});
