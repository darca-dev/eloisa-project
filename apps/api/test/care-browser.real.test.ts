/*
 * Recorrido REAL de navegador del semáforo (SPEC 055 / MP06, MP07B).
 *
 * Solo corre si `CARE_BROWSER_WEB_URL` apunta a la web de desarrollo ya
 * arrancada contra esta API (NEXT_PUBLIC_MERDN_API_BASE_URL). Fuera de eso se
 * omite y lo dice: NO forma parte de la baseline y una omisión no es un pase.
 *
 * Aprovisionamiento FICTICIO, antes de importar la aplicación. Sin proveedor
 * OIDC: las sesiones humanas se siembran como haría el alta real, y el
 * navegador las presenta con la cookie HttpOnly de la API.
 *
 * MP07B: las carreras A→B se provocan con BARRERAS explícitas (`page.route`
 * retiene la petición de A hasta que la prueba la suelta), nunca con esperas
 * fijas. Tras soltarla se espera a que la respuesta TERMINE y a que el
 * navegador procese sus tareas pendientes antes de comprobar nada.
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
import { type Browser, chromium, type Page, type Request as PwRequest } from '@playwright/test';
import request from 'supertest';
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

/** Barrera de una petición: avisa cuando llega y la retiene hasta `soltar`. */
function barrera(): { readonly llegada: Promise<void>; readonly avisar: () => void; readonly liberada: Promise<void>; readonly soltar: () => void } {
  let avisar = (): void => undefined;
  let soltar = (): void => undefined;
  const llegada = new Promise<void>((resolve) => {
    avisar = resolve;
  });
  const liberada = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  return { llegada, avisar, liberada, soltar };
}

/**
 * Lo único del navegador que usan las evaluaciones de este archivo. El proyecto
 * del API no carga los tipos DOM, y no se amplían para el servidor: dentro de
 * `page.evaluate` se accede a `globalThis` con este tipo local.
 */
interface NavegadorEvaluado {
  readonly requestAnimationFrame: (callback: () => void) => number;
  readonly innerWidth: number;
  readonly document: { readonly documentElement: { readonly scrollWidth: number }; readonly activeElement: unknown };
}

/** Deja que el navegador procese las tareas y microtareas que la respuesta encadenó. */
async function vaciarTareas(page: Page): Promise<void> {
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    await page.evaluate(
      () => new Promise<void>((resolve) => (globalThis as unknown as NavegadorEvaluado).requestAnimationFrame(() => setTimeout(resolve, 0))),
    );
  }
}

/** Sin desplazamiento horizontal de la página. */
async function sinDesbordeHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const navegador = globalThis as unknown as NavegadorEvaluado;
    return navegador.document.documentElement.scrollWidth <= navegador.innerWidth + 1;
  });
}

describe.skipIf(!puedeEjecutarse)('Semáforo en navegador real (055/MP06, MP07B)', () => {
  let app: INestApplication;
  let owner: PrismaClient;
  let seed: CareSeed;
  let browser: Browser;
  let tenantId: string;
  let org: string;

  let paciente: CuentaFicticia;
  let cuidadora: CuentaFicticia;
  let profesional: CuentaFicticia;
  /** Gestora de la organización que emitió la concesión clínica de la revisora. */
  let fundadora: CuentaFicticia;
  /**
   * El ÚNICO administrador de Hospital del tenant (decisión PO 2026-10-23,
   * `institutional_administrator_tenant_experience_unique`). Primero revisa con
   * su concesión clínica; después se le revoca y se comprueba que la
   * administración, por sí sola, no muestra clínica (MP07B / B07).
   */
  let revisora: CuentaFicticia;
  let concesionClinicaRevisora: string;
  let revisorClinico: CuentaFicticia;
  let ajena: CuentaFicticia;

  /** A = Lucía, B = Marta. Ambos autorizados para el visitador y el revisor clínico. */
  let ctxA: string;
  let ctxB: string;
  const ETIQUETA_A = 'Lucía E. · Organización ficticia de pruebas';
  const ETIQUETA_B = 'Marta E. · Organización ficticia de pruebas';

  const axeViolaciones: { pagina: string; id: string; impacto: string | null | undefined }[] = [];

  /**
   * Administración institucional del Hospital, como la deja el alta real. Sin
   * efecto clínico. Se llama UNA sola vez: el modelo admite un único registro
   * HOSPITAL por tenant.
   */
  async function administracionHospital(cuenta: CuentaFicticia): Promise<void> {
    const registro = await owner.institutionalAdministratorRegistration.create({
      data: {
        id: randomUUID(),
        tenantId,
        experience: 'HOSPITAL',
        humanAccountId: cuenta.humanAccountId,
        externalAuthIdentityId: cuenta.bindingId,
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
  }

  beforeAll(async () => {
    owner = createTestPrismaClient();
    seed = new CareSeed(owner);
    const tenant = await owner.tenant.findUniqueOrThrow({
      where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
      select: { id: true },
    });
    tenantId = tenant.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new MalformedJsonFilter());
    app.enableCors({ origin: [new URL(WEB).origin], credentials: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type'] });
    await app.listen(API_PORT, '127.0.0.1');

    fundadora = await seed.cuenta(tenantId, 'Fundadora');
    revisora = await seed.cuenta(tenantId, 'Revisora');
    org = await seed.organizacion(tenantId, 'HOSPITAL');
    await seed.manager(tenantId, org, revisora.humanAccountId, fundadora.humanAccountId);
    await administracionHospital(revisora);

    paciente = await seed.cuenta(tenantId, 'Lucía');
    await seed.aprobar(paciente, 'PATIENT');
    const patientA = await seed.paciente(paciente);
    ctxA = await seed.contexto(tenantId, org, patientA, revisora.humanAccountId);

    const pacienteB = await seed.cuenta(tenantId, 'Marta');
    await seed.aprobar(pacienteB, 'PATIENT');
    const patientB = await seed.paciente(pacienteB);
    ctxB = await seed.contexto(tenantId, org, patientB, revisora.humanAccountId);

    cuidadora = await seed.cuenta(tenantId, 'Carmen');
    await seed.aprobar(cuidadora, 'CAREGIVER');
    const relacion = await seed.relacion(tenantId, patientA, cuidadora.personId);

    profesional = await seed.cuenta(tenantId, 'Visitador');
    await seed.aprobar(profesional, 'FIELD_PROFESSIONAL');
    const perfilProfesional = await seed.profesional(profesional);
    const asignacionA = await seed.asignacion(tenantId, patientA, perfilProfesional);
    const asignacionB = await seed.asignacion(tenantId, patientB, perfilProfesional);
    const compProf = await seed.competencia(tenantId, org, profesional.humanAccountId, revisora.humanAccountId);
    const compRev = await seed.competencia(tenantId, org, revisora.humanAccountId, fundadora.humanAccountId);

    const baseA = { tenantId, organizationId: org, contextId: ctxA, patientId: patientA };
    const baseB = { tenantId, organizationId: org, contextId: ctxB, patientId: patientB };
    for (const permission of ['CONTRIBUTE_RECORDS', 'REQUEST_ALARM'] as const) {
      await seed.concesion({ ...baseA, humanAccountId: cuidadora.humanAccountId, actorKind: 'CAREGIVER', permission, caregiverRelationshipId: relacion, grantedByHumanAccountId: revisora.humanAccountId });
    }
    for (const [base, asignacion] of [[baseA, asignacionA], [baseB, asignacionB]] as const) {
      for (const permission of ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS'] as const) {
        await seed.concesion({ ...base, humanAccountId: profesional.humanAccountId, actorKind: 'PROFESSIONAL', permission, careAssignmentId: asignacion, grantedByHumanAccountId: revisora.humanAccountId });
      }
    }
    await seed.concesion({ ...baseA, humanAccountId: profesional.humanAccountId, actorKind: 'PROFESSIONAL', permission: 'MANAGE_RULES', careAssignmentId: asignacionA, competenceAttestationId: compProf, grantedByHumanAccountId: revisora.humanAccountId });
    // La revisora es gestora: su concesión clínica la emite la fundadora, otra persona.
    await seed.manager(tenantId, org, fundadora.humanAccountId, revisora.humanAccountId);
    concesionClinicaRevisora = await seed.concesion({ ...baseA, humanAccountId: revisora.humanAccountId, actorKind: 'HOSPITAL_REVIEWER', permission: 'REVIEW_ALARMS', competenceAttestationId: compRev, grantedByHumanAccountId: fundadora.humanAccountId });

    // MP07B / A05: revisor clínico con REVIEW_ALARMS y competencia, SIN registro de administración.
    revisorClinico = await seed.cuenta(tenantId, 'Revisor clínico');
    const compClinico = await seed.competencia(tenantId, org, revisorClinico.humanAccountId, revisora.humanAccountId);
    for (const base of [baseA, baseB]) {
      await seed.concesion({ ...base, humanAccountId: revisorClinico.humanAccountId, actorKind: 'HOSPITAL_REVIEWER', permission: 'REVIEW_ALARMS', competenceAttestationId: compClinico, grantedByHumanAccountId: revisora.humanAccountId });
    }

    // Una cuenta sin relación alguna. La administración sin clínica es la MISMA revisora, más adelante.
    ajena = await seed.cuenta(tenantId, 'Ajena');
    expect(await owner.institutionalAdministratorRegistration.count({ where: { tenantId, experience: 'HOSPITAL' } })).toBe(1);

    browser = await chromium.launch({ headless: true });
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    await app?.close();
    await owner?.$disconnect();
    // eslint-disable-next-line no-console
    console.log(`AXE serias/críticas en el espacio de cuidado: ${JSON.stringify(axeViolaciones)}`);
  });

  async function como(cuenta: CuentaFicticia | null, ruta: string, viewport = { width: 1280, height: 900 }): Promise<Page> {
    const contexto = await browser.newContext({ viewport });
    if (cuenta !== null) {
      await contexto.addCookies([{ name: 'merdn_human_session', value: cuenta.sessionToken, url: `http://127.0.0.1:${API_PORT}`, httpOnly: true, sameSite: 'Lax' }]);
    }
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

  const rutaContexto = (contextId: string): string => `/api/v1/care/contexts/${contextId}/`;

  /** Escritura de preparación por la API real, con la sesión de la cuenta y el origen de la web. */
  const escribir = (cuenta: CuentaFicticia, ruta: string, body: object) =>
    request(app.getHttpServer())
      .post(ruta)
      .set('Cookie', `merdn_human_session=${cuenta.sessionToken}`)
      .set('Origin', new URL(WEB).origin)
      .send(body);

  /**
   * Pulsa «cargar más» y espera a que la página pedida TERMINE y el navegador
   * la procese. Sin esperas fijas.
   */
  async function cargarPagina(page: Page, boton: ReturnType<Page['getByRole']>, ruta: string): Promise<void> {
    const terminada = page.waitForResponse((r) => new URL(r.url()).pathname === ruta && r.request().method() === 'GET', { timeout: 60_000 });
    await boton.click();
    await (await terminada).finished();
    await vaciarTareas(page);
  }

  it('el visitador valida un dato y un criterio con su definición exacta, y lo ajusta como versión nueva', async () => {
    const page = await como(profesional, '/profesional');
    const espacio = page.locator('[aria-labelledby="cuidado-profesional-titulo"]');
    // Con dos pacientes no se elige ninguno por su cuenta.
    await espacio.getByLabel('Persona y servicio').selectOption({ label: ETIQUETA_A }, { timeout: 120_000 });
    const espacioA = espacio.locator(`[data-care-context="${ctxA}"]`);
    await espacioA.getByText('Datos que se registran en este espacio').waitFor({ timeout: 60_000 });

    await espacioA.getByLabel('Nombre del dato').fill('Dato ficticio de prueba');
    await espacioA.getByRole('button', { name: 'Validar dato' }).click();
    await espacioA.getByText('Dato validado. Ya se puede registrar.').waitFor({ timeout: 30_000 });

    const criterios = espacioA.locator('section', { hasText: 'Criterios de alarma de esta persona' });
    // La opción nombra la versión y la unidad EXACTAS que se validan (MP07A).
    await criterios.getByLabel('Dato').selectOption({ label: 'Dato ficticio de prueba, versión 1, sin unidad' });
    await criterios.getByLabel('Comparación').selectOption('EQ');
    await criterios.getByLabel('Respuesta').selectOption('si');
    await criterios.getByLabel('¿Cuántas veces debe ocurrir?').fill('1');
    await criterios.getByLabel('¿En qué ventana de tiempo?').fill('1');
    await criterios.getByLabel('Clasificación de la alarma').selectOption('AMARILLA');
    await criterios.getByRole('button', { name: 'Validar criterio' }).click();
    await espacioA.getByText('Criterio validado. Cuenta lo que ocurra a partir de ahora.').waitFor({ timeout: 30_000 });
    await criterios.getByText(/alarma amarilla/u).waitFor({ timeout: 30_000 });
    await criterios.getByText('Evalúa: Dato ficticio de prueba, versión 1, sin unidad.').waitFor({ timeout: 30_000 });

    const definicion = await owner.careObservableDefinition.findFirstOrThrow({ where: { contextId: ctxA, label: 'Dato ficticio de prueba', status: 'ACTIVE' } });
    const v1 = await owner.careAlarmCriterionVersion.findFirstOrThrow({ where: { contextId: ctxA }, orderBy: { createdAt: 'desc' } });
    expect(v1).toMatchObject({ version: 1, observableDefinitionId: definicion.id, validUntil: null });

    // A08: ajustar la MISMA definición parte de lo validado; se añade solo una vigencia.
    await criterios.getByRole('button', { name: 'Ajustar (nueva versión)' }).click();
    await criterios.getByText('Se crea una versión nueva de ESTE mismo criterio').waitFor({ timeout: 30_000 });
    expect(await criterios.getByLabel('¿Cuántas veces debe ocurrir?').inputValue()).toBe('1');
    expect(await criterios.getByLabel('Comparación').inputValue()).toBe('EQ');
    const fin = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const finLocal = new Date(fin.getTime() - fin.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    await criterios.getByLabel('Vigente hasta (opcional)').fill(finLocal);
    await criterios.getByRole('button', { name: 'Validar versión nueva' }).click();
    await espacioA.getByText('Versión nueva validada para el mismo criterio.', { exact: false }).waitFor({ timeout: 30_000 });
    await criterios.getByText(/versión 2/u).waitFor({ timeout: 30_000 });

    const versiones = await owner.careAlarmCriterionVersion.findMany({ where: { criterionId: v1.criterionId }, orderBy: { version: 'asc' } });
    expect(versiones.map((version) => [version.version, version.status])).toEqual([[1, 'SUPERSEDED'], [2, 'ACTIVE']]);
    expect(versiones[1]).toMatchObject({ observableDefinitionId: definicion.id, requiredCount: 1, comparator: 'EQ', booleanValue: true });
    const vigencia = versiones[1]?.validUntil ?? null;
    expect(vigencia).not.toBeNull();
    expect(await owner.careAlarmCriterion.count({ where: { contextId: ctxA } })).toBe(1);

    // El resumen de la versión persistida muestra ESA vigencia, con el mismo formato de la vista
    // y en el propio navegador; la etiqueta del formulario no coincide con este texto exacto.
    const vigenciaLegible = await page.evaluate(
      (iso) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)),
      (vigencia as Date).toISOString(),
    );
    const resumen = criterios.locator('ul[aria-label="Criterios"] > li').getByText(
      `Evalúa: Dato ficticio de prueba, versión 1, sin unidad. Vigente hasta ${vigenciaLegible}.`,
      { exact: true },
    );
    await resumen.waitFor({ timeout: 30_000 });
    expect(await resumen.count()).toBe(1);

    await auditar(page, '/profesional', '[aria-labelledby="cuidado-profesional-titulo"]');
    await page.context().close();
  }, 240_000);

  it('la cuidadora registra, el criterio dispara y pide revisión con el texto aprobado', async () => {
    /*
     * El campo de fecha tiene precisión de minuto y el criterio solo cuenta lo
     * ocurrido DESPUÉS de su activación, que fija la base. Se espera, por
     * condición, a que el minuto en curso empiece después de esa activación.
     */
    const version = await owner.careAlarmCriterionVersion.findFirstOrThrow({ where: { contextId: ctxA }, orderBy: { createdAt: 'desc' }, select: { activatedAt: true } });
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

  it('el Hospital administrador ve la cola paginada con semáforo en palabras y gestiona la solicitud', async () => {
    const page = await como(revisora, '/hospital');
    await page.getByRole('button', { name: /Semáforo de alarmas/u }).first().click({ timeout: 120_000 });
    const espacio = page.locator('[aria-labelledby="cuidado-hospital-titulo"]');
    await espacio.getByText('Cola de revisión').first().waitFor({ timeout: 60_000 });
    await espacio.getByText(/Semáforo: Amarillo/u).first().waitFor({ timeout: 30_000 });
    await espacio.getByText(/espacios en la cola cargados\. No hay más\./u).waitFor({ timeout: 30_000 });

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

  it('A02: el borrador de A no viaja a B y una escritura de A confirmada tarde no aparece bajo B', async () => {
    const page = await como(profesional, '/profesional');
    const espacio = page.locator('[aria-labelledby="cuidado-profesional-titulo"]');
    const selector = espacio.getByLabel('Persona y servicio');
    await selector.selectOption({ label: ETIQUETA_A }, { timeout: 120_000 });
    const espacioA = espacio.locator(`[data-care-context="${ctxA}"]`);
    await espacioA.getByText('Nueva entrada de bitácora').waitFor({ timeout: 60_000 });

    // 1) Borrador escrito en A; al elegir B el formulario es OTRO y está vacío.
    const BORRADOR = `Borrador de A ficticio ${randomUUID().slice(0, 8)}`;
    await espacioA.getByLabel('Nota (opcional)').fill(BORRADOR);
    await selector.selectOption({ label: ETIQUETA_B });
    const espacioB = espacio.locator(`[data-care-context="${ctxB}"]`);
    await espacioB.getByText('Nueva entrada de bitácora').waitFor({ timeout: 60_000 });
    expect(await espacio.locator(`[data-care-context="${ctxA}"]`).count()).toBe(0);
    expect(await espacioB.getByLabel('Nota (opcional)').inputValue()).toBe('');

    const NOTA_B = `Nota de B ficticia ${randomUUID().slice(0, 8)}`;
    await espacioB.getByLabel('Nota (opcional)').fill(NOTA_B);
    await espacioB.getByRole('button', { name: 'Guardar en la bitácora' }).click();
    await espacioB.getByText('Entrada guardada en la bitácora.').waitFor({ timeout: 30_000 });
    expect(await owner.careRecord.findMany({ where: { note: NOTA_B }, select: { contextId: true } })).toEqual([{ contextId: ctxB }]);
    expect(await owner.careRecord.count({ where: { note: BORRADOR } })).toBe(0);

    // 2) POST de A retenido por una barrera; se cambia a B y SOLO entonces se suelta.
    await selector.selectOption({ label: ETIQUETA_A });
    await espacioA.getByText('Nueva entrada de bitácora').waitFor({ timeout: 60_000 });
    const TARDIA = `Escritura tardía de A ficticia ${randomUUID().slice(0, 8)}`;
    const postA = barrera();
    await page.route(
      (url) => url.pathname === `${rutaContexto(ctxA)}records`,
      async (route) => {
        if (route.request().method() !== 'POST') {
          await route.continue();
          return;
        }
        postA.avisar();
        await postA.liberada;
        await route.continue();
      },
    );
    await espacioA.getByLabel('Nota (opcional)').fill(TARDIA);
    await espacioA.getByRole('button', { name: 'Guardar en la bitácora' }).click();
    await postA.llegada;

    await selector.selectOption({ label: ETIQUETA_B });
    await espacioB.getByText('Bitácora', { exact: true }).waitFor({ timeout: 60_000 });
    await espacioB.getByText(NOTA_B).waitFor({ timeout: 30_000 });

    const tardias: string[] = [];
    let soltada = false;
    const escuchar = (peticion: PwRequest): void => {
      if (soltada && peticion.url().includes(rutaContexto(ctxA))) tardias.push(`${peticion.method()} ${new URL(peticion.url()).pathname}`);
    };
    page.on('request', escuchar);
    const respuesta = page.waitForResponse((r) => r.url().endsWith(`${rutaContexto(ctxA)}records`) && r.request().method() === 'POST', { timeout: 30_000 });
    soltada = true;
    postA.soltar();
    const confirmada = await respuesta;
    expect(confirmada.status()).toBe(201);
    await confirmada.finished();
    await vaciarTareas(page);

    // El servidor SÍ confirmó la escritura en A…
    expect(await owner.careRecord.findMany({ where: { note: TARDIA }, select: { contextId: true } })).toEqual([{ contextId: ctxA }]);
    // …pero bajo B no se muestra nada de A, ni su recibo, ni se recargó A.
    expect(await espacio.locator(`[data-care-context="${ctxA}"]`).count()).toBe(0);
    expect(await espacio.locator(`[data-care-context="${ctxB}"]`).count()).toBe(1);
    expect(await espacio.getByText(TARDIA).count()).toBe(0);
    expect(await espacioB.getByText('Entrada guardada', { exact: false }).count()).toBe(0);
    expect(await espacioB.getByLabel('Nota (opcional)').inputValue()).toBe('');
    expect(await espacioB.getByRole('button', { name: 'Guardar en la bitácora' }).isEnabled()).toBe(true);
    expect(tardias).toEqual([]);
    page.off('request', escuchar);
    await page.unroute((url) => url.pathname === `${rutaContexto(ctxA)}records`);

    // Al volver a A (ciclo nuevo) la escritura confirmada aparece UNA vez, en A.
    await selector.selectOption({ label: ETIQUETA_A });
    await espacioA.getByText(TARDIA).waitFor({ timeout: 30_000 });
    expect(await owner.careRecord.count({ where: { note: TARDIA } })).toBe(1);

    await auditar(page, '/profesional (dos pacientes)', '[aria-labelledby="cuidado-profesional-titulo"]');
    await page.context().close();
  }, 240_000);

  it('B01/B02: la cuidadora envía de verdad, reintenta con la MISMA clave y conserva el borrador del otro formulario', async () => {
    const page = await como(cuidadora, '/cuidador');
    const espacio = page.locator('[aria-labelledby="cuidado-cuidador-titulo"]');
    const espacioA = espacio.locator(`[data-care-context="${ctxA}"]`);
    await espacioA.getByText('Nueva entrada de bitácora').waitFor({ timeout: 120_000 });
    const notaBitacora = espacioA.getByLabel('Nota (opcional)');
    const notaSolicitud = espacioA.getByLabel('¿Qué está pasando? (opcional)');

    // B02: un borrador de bitácora SIN enviar sobrevive a la solicitud confirmada desde el otro formulario.
    const BORRADOR = `Borrador de bitácora ficticio ${randomUUID().slice(0, 8)}`;
    const SOLICITUD = `Solicitud ficticia B02 ${randomUUID().slice(0, 8)}`;
    await notaBitacora.fill(BORRADOR);
    await notaSolicitud.fill(SOLICITUD);
    // Esperas instaladas ANTES del click: el POST real y la recarga de la bandeja que lo sigue.
    const rutaAlarmas = `${rutaContexto(ctxA)}alarms`;
    let solicitudRespondida = false;
    const envioSolicitud = page.waitForResponse(
      (r) => {
        const esPost = new URL(r.url()).pathname === rutaAlarmas && r.request().method() === 'POST';
        if (esPost) solicitudRespondida = true;
        return esPost;
      },
      { timeout: 30_000 },
    );
    const recargaBandeja = page.waitForResponse(
      (r) => solicitudRespondida && new URL(r.url()).pathname === rutaAlarmas && r.request().method() === 'GET',
      { timeout: 30_000 },
    );
    await espacioA.getByRole('button', { name: 'Enviar solicitud de revisión' }).click();
    const solicitudConfirmada = await envioSolicitud;
    expect(solicitudConfirmada.status()).toBe(201);
    await solicitudConfirmada.finished();
    const recargada = await recargaBandeja;
    expect(recargada.status()).toBe(200);
    await recargada.finished();
    // La nota aparece en la bandeja (fuera del formulario) tras esa recarga.
    const misSolicitudes = espacioA.locator('section[aria-label="Mis solicitudes"] ol[aria-label="Mis solicitudes"] > li');
    await misSolicitudes.getByText(SOLICITUD, { exact: true }).waitFor({ timeout: 30_000 });
    await vaciarTareas(page);
    expect(await misSolicitudes.getByText(SOLICITUD, { exact: true }).count()).toBe(1);
    expect(await owner.careAlarm.findMany({ where: { note: SOLICITUD }, select: { contextId: true } })).toEqual([{ contextId: ctxA }]);
    expect(await notaSolicitud.inputValue()).toBe('');
    expect(await notaBitacora.inputValue()).toBe(BORRADOR);
    expect(await owner.careRecord.count({ where: { note: BORRADOR } })).toBe(0);

    // B01: el servidor confirma el primer envío, pero la respuesta no llega al navegador.
    const esRegistros = (url: URL): boolean => url.pathname === `${rutaContexto(ctxA)}records`;
    const claves: string[] = [];
    let cortar = true;
    await page.route(esRegistros, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      claves.push(String((route.request().postDataJSON() as { idempotencyKey?: unknown }).idempotencyKey));
      if (cortar) {
        cortar = false;
        const confirmada = await route.fetch();
        expect(confirmada.status()).toBe(201);
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    const guardar = espacioA.getByRole('button', { name: 'Guardar en la bitácora' });
    await guardar.click();
    await espacioA.getByText('No se pudo confirmar la operación. Puede volver a intentarlo sin duplicarla.').waitFor({ timeout: 30_000 });
    expect(await owner.careRecord.findMany({ where: { note: BORRADOR }, select: { contextId: true } })).toEqual([{ contextId: ctxA }]);
    // Sin confirmación el formulario no se reinicia: el mismo intento sigue a la vista.
    expect(await notaBitacora.inputValue()).toBe(BORRADOR);

    await guardar.click();
    await espacioA.getByText('Entrada guardada', { exact: false }).first().waitFor({ timeout: 30_000 });
    await page.unroute(esRegistros);

    // Dos envíos reales con la MISMA clave válida; una sola entrada, en A.
    expect(claves).toHaveLength(2);
    expect(claves[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
    expect(claves[1]).toBe(claves[0]);
    expect(await owner.careRecord.findMany({ where: { note: BORRADOR }, select: { contextId: true } })).toEqual([{ contextId: ctxA }]);
    await espacioA.getByText(BORRADOR, { exact: true }).waitFor({ timeout: 30_000 });
    expect(await espacioA.getByText(BORRADOR, { exact: true }).count()).toBe(1);
    // Confirmado: ahora sí se reinicia la bitácora.
    expect(await notaBitacora.inputValue()).toBe('');

    await auditar(page, '/cuidador (reintento)', '[aria-labelledby="cuidado-cuidador-titulo"]');
    await page.context().close();
  }, 240_000);

  it('B02: el borrador de un criterio sobrevive a validar un dato del mismo paciente', async () => {
    const page = await como(profesional, '/profesional');
    const espacio = page.locator('[aria-labelledby="cuidado-profesional-titulo"]');
    await espacio.getByLabel('Persona y servicio').selectOption({ label: ETIQUETA_A }, { timeout: 120_000 });
    const espacioA = espacio.locator(`[data-care-context="${ctxA}"]`);
    await espacioA.getByText('Datos que se registran en este espacio').waitFor({ timeout: 60_000 });
    const criteriosPrevios = await owner.careAlarmCriterion.count({ where: { contextId: ctxA } });

    const criterios = espacioA.locator('section', { hasText: 'Criterios de alarma de esta persona' });
    await criterios.getByLabel('Dato').selectOption({ label: 'Dato ficticio de prueba, versión 1, sin unidad' });
    await criterios.getByLabel('Comparación').selectOption('EQ');
    await criterios.getByLabel('¿Cuántas veces debe ocurrir?').fill('3');
    await criterios.getByLabel('¿En qué ventana de tiempo?').fill('7');

    const DATO = `Dato ficticio B02 ${randomUUID().slice(0, 8)}`;
    await espacioA.getByLabel('Nombre del dato').fill(DATO);
    await espacioA.getByRole('button', { name: 'Validar dato' }).click();
    await espacioA.getByText('Dato validado. Ya se puede registrar.').waitFor({ timeout: 30_000 });
    await espacioA.getByText(DATO).first().waitFor({ timeout: 30_000 });

    // Solo se reinició el formulario de datos.
    expect(await espacioA.getByLabel('Nombre del dato').inputValue()).toBe('');
    expect(await criterios.getByRole('heading', { name: 'Nuevo criterio' }).count()).toBe(1);
    expect(await criterios.getByLabel('Comparación').inputValue()).toBe('EQ');
    expect(await criterios.getByLabel('¿Cuántas veces debe ocurrir?').inputValue()).toBe('3');
    expect(await criterios.getByLabel('¿En qué ventana de tiempo?').inputValue()).toBe('7');
    // Del borrador no se validó nada.
    expect(await owner.careAlarmCriterion.count({ where: { contextId: ctxA } })).toBe(criteriosPrevios);

    await page.context().close();
  }, 240_000);

  it('A05: el revisor sin administración entra desde el enlace visible y un detalle tardío de A no aparece bajo B', async () => {
    const page = await como(revisorClinico, '/hospital');
    // Sin registro administrativo, /hospital queda en el marco neutral: no monta ningún módulo.
    const enlace = page.getByRole('link', { name: 'Revisión clínica de cuidado' });
    await enlace.waitFor({ timeout: 120_000 });
    expect(await page.locator('[data-hospital-content]').count()).toBe(0);
    await enlace.click();
    await page.waitForURL(`${WEB}/hospital/cuidado`, { timeout: 60_000 });

    const espacio = page.locator('[aria-labelledby="cuidado-hospital-titulo"]');
    await espacio.getByRole('heading', { name: 'Revisión clínica de cuidado' }).waitFor({ timeout: 60_000 });
    await espacio.getByText('Cola de revisión').first().waitFor({ timeout: 60_000 });
    await espacio.getByText('2 espacios en la cola cargados. No hay más.').waitFor({ timeout: 30_000 });
    // Ninguna superficie administrativa por tener REVIEW_ALARMS.
    for (const administrativo of ['Administración institucional', 'Solicitudes de acceso', 'Concesiones']) {
      expect(await page.getByText(administrativo, { exact: false }).count()).toBe(0);
    }

    // Abrir A desde la cola, aunque no se haya elegido en el selector.
    await espacio.locator('li', { hasText: 'Lucía E.' }).getByRole('button', { name: 'Abrir este espacio' }).click();
    const espacioA = espacio.locator(`[data-care-context="${ctxA}"]`);
    await espacioA.getByText('Bandeja de revisión').first().waitFor({ timeout: 30_000 });
    await espacioA.getByText('Solicitud ficticia de prueba').first().waitFor({ timeout: 30_000 });

    // Detalle de A retenido; se cambia a B y se suelta.
    const detalleA = barrera();
    const esDetalleA = (url: URL): boolean => url.pathname.startsWith(`${rutaContexto(ctxA)}alarms/`);
    await page.route(esDetalleA, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      detalleA.avisar();
      await detalleA.liberada;
      // Al cambiar de contexto el navegador puede haber cancelado ya la lectura:
      // entonces no hay nada que continuar, y eso también es un desenlace válido.
      await route.continue().catch(() => undefined);
    });
    // Desenlace de la lectura retenida: termina o la cancela el navegador. No se exige respuesta.
    const desenlace = new Promise<void>((resolve) => {
      const fin = (peticion: PwRequest): void => {
        if (peticion.method() === 'GET' && esDetalleA(new URL(peticion.url()))) resolve();
      };
      page.on('requestfinished', fin);
      page.on('requestfailed', fin);
    });
    await espacioA.getByRole('button', { name: 'Ver historia y evidencia' }).first().click();
    await detalleA.llegada;

    await espacio.getByLabel('Persona y servicio').selectOption({ label: ETIQUETA_B });
    const espacioB = espacio.locator(`[data-care-context="${ctxB}"]`);
    await espacioB.getByText('No hay solicitudes en este espacio.').waitFor({ timeout: 30_000 });

    detalleA.soltar();
    await desenlace;
    await vaciarTareas(page);

    expect(await espacio.locator(`[data-care-context="${ctxA}"]`).count()).toBe(0);
    expect(await espacioB.getByRole('heading', { name: 'Historia' }).count()).toBe(0);
    expect(await espacioB.getByText('Por qué se generó').count()).toBe(0);
    expect(await espacio.getByText('Solicitud ficticia de prueba').count()).toBe(0);
    await page.unroute(esDetalleA);

    await auditar(page, '/hospital/cuidado', '[aria-labelledby="cuidado-hospital-titulo"]');
    await page.context().close();

    // Móvil: la misma entrada es operable y accesible en pantalla estrecha.
    const movil = await como(revisorClinico, '/hospital/cuidado', { width: 390, height: 844 });
    await movil.locator('[aria-labelledby="cuidado-hospital-titulo"]').getByText('Cola de revisión').first().waitFor({ timeout: 120_000 });
    expect(await sinDesbordeHorizontal(movil)).toBe(true);
    await auditar(movil, '/hospital/cuidado (móvil)', '[aria-labelledby="cuidado-hospital-titulo"]');
    await movil.context().close();
  }, 240_000);

  /** /hospital/cuidado sin ningún espacio autorizado: estado vacío y ningún dato de pacientes. */
  async function sinDatosClinicos(cuenta: CuentaFicticia, nombre: string): Promise<void> {
    const page = await como(cuenta, '/hospital/cuidado');
    const espacio = page.locator('[aria-labelledby="cuidado-hospital-titulo"]');
    await espacio.getByText('Todavía no tiene ningún espacio de cuidado autorizado', { exact: false }).waitFor({ timeout: 120_000 });
    for (const ajeno of ['Lucía', 'Marta', 'Solicitud ficticia de prueba', 'Cola de revisión', 'Bandeja de revisión']) {
      expect(await page.getByText(ajeno, { exact: false }).count()).toBe(0);
    }
    await auditar(page, `/hospital/cuidado (${nombre})`, '[aria-labelledby="cuidado-hospital-titulo"]');
    await page.context().close();
  }

  it('A05/B07: el único administrador de Hospital, tras revocarse su concesión clínica, sigue administrando y no ve clínica', async () => {
    // Sigue siendo el único registro HOSPITAL del tenant, y es el de la revisora.
    const registros = await owner.institutionalAdministratorRegistration.findMany({
      where: { tenantId, experience: 'HOSPITAL' },
      select: { humanAccountId: true, status: true },
    });
    expect(registros).toEqual([{ humanAccountId: revisora.humanAccountId, status: 'CONFIRMED' }]);

    // Revocación por la vía real: la gestora que la emitió, por la API de administración.
    const revocada = await escribir(fundadora, `/api/v1/care/admin/organizations/${org}/grants/${concesionClinicaRevisora}/revoke`, {});
    expect(revocada.status).toBe(200);
    expect(await owner.careAuthorization.findUniqueOrThrow({ where: { id: concesionClinicaRevisora }, select: { status: true } })).toEqual({ status: 'REVOKED' });
    // No queda ninguna concesión clínica vigente de la revisora.
    expect(await owner.careAuthorization.count({ where: { humanAccountId: revisora.humanAccountId, status: 'ACTIVE' } })).toBe(0);

    // La administración sigue montada en /hospital: la cuenta continúa siendo la administradora…
    const admin = await como(revisora, '/hospital');
    await admin.locator('[data-hospital-content]').first().waitFor({ timeout: 120_000 });
    await admin.context().close();
    expect(await owner.institutionalAdministratorRegistration.count({ where: { tenantId, experience: 'HOSPITAL' } })).toBe(1);

    // …pero sin concesión clínica no ve ningún dato de pacientes.
    await sinDatosClinicos(revisora, 'administración sin clínica');
  }, 240_000);

  it('A05: una cuenta ajena y un visitante sin sesión no ven datos de pacientes', async () => {
    await sinDatosClinicos(ajena, 'cuenta ajena');

    const anonima = await como(null, '/hospital/cuidado');
    const espacio = anonima.locator('[aria-labelledby="cuidado-hospital-titulo"]');
    await espacio.getByText('Su sesión no está abierta', { exact: false }).waitFor({ timeout: 120_000 });
    const iniciar = espacio.getByRole('link', { name: 'Iniciar sesión' });
    const destino = new URL((await iniciar.getAttribute('href')) ?? '');
    // Reutiliza la entrada humana existente: vuelve a /hospital, no se amplía la lista de destinos.
    expect(destino.pathname).toBe('/api/v1/human-auth/login');
    expect(destino.searchParams.get('returnTo')).toBe('/hospital');
    expect(await anonima.getByText('Lucía', { exact: false }).count()).toBe(0);
    await anonima.context().close();
  }, 240_000);

  it('B04/A06: desde la UI se recorren cola, directorio, bandeja y bitácora más allá de la primera página', async () => {
    /*
     * Preparación FICTICIA y aislada: cuentas y organizaciones nuevas, sin
     * tocar los demás casos. 205 candidatos descubribles que MP01 deniega
     * (competencia revocada) se ordenan ANTES del único espacio válido; ese
     * espacio tiene 56 abiertas con la ROJA como la más antigua, 2 cerradas
     * recientes y 23 entradas de bitácora.
     */
    const fundadoraP = await seed.cuenta(tenantId, 'Fundadora de páginas');
    const gestoraP = await seed.cuenta(tenantId, 'Gestora de páginas');
    const revisorP = await seed.cuenta(tenantId, 'Revisor de páginas');
    const orgFiltrada = await seed.organizacion(tenantId, 'HOSPITAL');
    const orgValida = await seed.organizacion(tenantId, 'HOSPITAL');
    for (const organizacion of [orgFiltrada, orgValida]) {
      await seed.manager(tenantId, organizacion, gestoraP.humanAccountId, fundadoraP.humanAccountId);
    }
    const competenciaFiltrada = await seed.competencia(tenantId, orgFiltrada, revisorP.humanAccountId, gestoraP.humanAccountId);
    const competenciaValida = await seed.competencia(tenantId, orgValida, revisorP.humanAccountId, gestoraP.humanAccountId);

    for (let indice = 0; indice < 205; indice += 1) {
      const patientId = await seed.pacienteFicticio(tenantId);
      const contextId = await seed.contexto(tenantId, orgFiltrada, patientId, gestoraP.humanAccountId, { id: `00${randomUUID().slice(2)}` });
      await seed.concesion({
        tenantId,
        organizationId: orgFiltrada,
        contextId,
        patientId,
        humanAccountId: revisorP.humanAccountId,
        actorKind: 'HOSPITAL_REVIEWER',
        permission: 'REVIEW_ALARMS',
        competenceAttestationId: competenciaFiltrada,
        grantedByHumanAccountId: gestoraP.humanAccountId,
      });
    }
    await owner.clinicalCompetenceAttestation.update({
      where: { id: competenciaFiltrada },
      data: { status: 'REVOKED', revokedAt: new Date(), version: { increment: 1 } },
    });

    const pacienteP = await seed.cuenta(tenantId, 'Paginada');
    await seed.aprobar(pacienteP, 'PATIENT');
    const patientP = await seed.paciente(pacienteP);
    const ctxP = await seed.contexto(tenantId, orgValida, patientP, gestoraP.humanAccountId, { id: `ff${randomUUID().slice(2)}` });
    for (const permission of ['REVIEW_ALARMS', 'VIEW_RECORDS'] as const) {
      await seed.concesion({
        tenantId,
        organizationId: orgValida,
        contextId: ctxP,
        patientId: patientP,
        humanAccountId: revisorP.humanAccountId,
        actorKind: 'HOSPITAL_REVIEWER',
        permission,
        competenceAttestationId: competenciaValida,
        grantedByHumanAccountId: gestoraP.humanAccountId,
      });
    }

    const base = rutaContexto(ctxP);
    const pedir = async (nota: string): Promise<{ id: string; version: number }> =>
      (await escribir(pacienteP, `${base}alarms`, { idempotencyKey: randomUUID(), reasonCode: 'REQUEST_REVIEW', note: nota }).expect(201)).body.alarm;
    const transicion = (alarmId: string, body: object) => escribir(revisorP, `${base}alarms/${alarmId}/transitions`, body).expect(200);
    const ROJA = 'Solicitud ficticia antigua de páginas';
    const roja = await pedir(ROJA);
    await transicion(roja.id, { action: 'CLASSIFY', expectedVersion: roja.version, reason: 'Clasificación ficticia', severity: 'ROJA' });
    for (let indice = 0; indice < 55; indice += 1) {
      await pedir(`Solicitud ficticia de páginas ${indice}`);
    }
    const CERRADA = 'Solicitud ficticia cerrada de páginas';
    for (let indice = 0; indice < 2; indice += 1) {
      const alarma = await pedir(`${CERRADA} ${indice}`);
      await transicion(alarma.id, { action: 'RESOLVE', expectedVersion: alarma.version, reason: 'Resuelta (ficticio)' });
      await transicion(alarma.id, { action: 'CLOSE', expectedVersion: alarma.version + 1, reason: 'Cerrada (ficticio)' });
    }
    const ENTRADA = (indice: number): string => `Entrada ficticia de páginas ${indice}`;
    for (let indice = 0; indice < 23; indice += 1) {
      await escribir(pacienteP, `${base}records`, {
        idempotencyKey: randomUUID(),
        occurredAt: new Date(Date.now() - 60_000).toISOString(),
        note: ENTRADA(indice),
      }).expect(201);
    }

    const page = await como(revisorP, '/hospital/cuidado');
    const espacio = page.locator('[aria-labelledby="cuidado-hospital-titulo"]');
    const cola = espacio.locator('section[aria-label="Cola de revisión"]');
    const directorio = espacio.locator('section[aria-label="Espacios de cuidado"]');
    await cola.getByText('Esta página no contiene espacios que usted pueda revisar, pero quedan más por consultar.').waitFor({ timeout: 120_000 });

    // Directorio: la primera página llega vacía CON continuación; no se declara ausencia.
    await directorio.getByText('Los espacios consultados hasta ahora no son de su cuenta, pero quedan más por consultar.').waitFor({ timeout: 30_000 });
    await directorio.getByText('0 espacios cargados. Hay más por cargar: esto no es el total.').waitFor({ timeout: 30_000 });
    expect(await espacio.getByText('Todavía no tiene ningún espacio de cuidado autorizado', { exact: false }).count()).toBe(0);

    // Cola: 20 candidatos por página → diez páginas vacías antes del espacio válido.
    const masCola = cola.getByRole('button', { name: 'Cargar más espacios de la cola', exact: true });
    const elementoP = cola.locator('li', { hasText: 'Paginada E.' });
    let paginasCola = 1;
    while ((await elementoP.count()) === 0) {
      expect(paginasCola).toBeLessThan(15);
      expect(await cola.getByText('No tiene espacios de cuidado para revisar.').count()).toBe(0);
      await cargarPagina(page, masCola, '/api/v1/care/review-queue');
      paginasCola += 1;
    }
    expect(paginasCola).toBe(11);
    await cola.getByText('1 espacios en la cola cargados. No hay más.').waitFor({ timeout: 30_000 });
    await elementoP.getByText(/Semáforo: Rojo/u).waitFor({ timeout: 30_000 });
    await elementoP.getByText('Se muestran las 10 más recientes de 56 abiertas.', { exact: false }).waitFor({ timeout: 30_000 });

    // Abrir desde la cola un espacio que el directorio aún no cargó, con la bandeja filtrada a abiertas.
    await elementoP.getByRole('button', { name: 'Ver todas las abiertas (56)' }).click();
    const espacioP = espacio.locator(`[data-care-context="${ctxP}"]`);
    const bandeja = espacioP.locator('section[aria-label="Bandeja de revisión"]');
    const itemsBandeja = bandeja.locator('ol[aria-label="Bandeja de solicitudes"] > li');
    await bandeja.getByText('50 solicitudes abiertas cargados. Hay más por cargar: esto no es el total.').waitFor({ timeout: 60_000 });
    expect(await bandeja.getByLabel('Solo abiertas').isChecked()).toBe(true);
    // La roja es la más antigua: no está en la primera página, pero no se perdió.
    expect(await bandeja.getByText(ROJA, { exact: true }).count()).toBe(0);
    await cargarPagina(page, bandeja.getByRole('button', { name: 'Cargar más solicitudes', exact: true }), `${base}alarms`);
    await bandeja.getByText('56 solicitudes abiertas cargados. No hay más.').waitFor({ timeout: 30_000 });
    const itemRoja = itemsBandeja.filter({ hasText: ROJA });
    expect(await itemRoja.count()).toBe(1);
    await itemRoja.getByText('Clasificación: Roja').waitFor({ timeout: 30_000 });
    // Acumuladas sin duplicados, el filtro se conservó y las cerradas no ocupan lugar.
    expect(await itemsBandeja.count()).toBe(56);
    expect(await bandeja.getByLabel('Solo abiertas').isChecked()).toBe(true);
    expect(await bandeja.getByText(CERRADA, { exact: false }).count()).toBe(0);

    // Bitácora: 20 por página; las tres más antiguas están en la segunda.
    const bitacora = espacioP.locator('section[aria-label="Bitácora"]');
    await bitacora.getByText('20 entradas cargados. Hay más por cargar: esto no es el total.').waitFor({ timeout: 30_000 });
    expect(await bitacora.getByText(ENTRADA(0), { exact: true }).count()).toBe(0);
    // Esta página se pide por TECLADO: el control recibe el foco y se activa con Enter.
    const anteriores = bitacora.getByRole('button', { name: 'Cargar entradas anteriores', exact: true });
    await anteriores.focus();
    expect(await anteriores.evaluate((boton) => boton === (globalThis as unknown as NavegadorEvaluado).document.activeElement)).toBe(true);
    const porTeclado = page.waitForResponse((r) => new URL(r.url()).pathname === `${base}records` && r.request().method() === 'GET', { timeout: 60_000 });
    await page.keyboard.press('Enter');
    const paginaTeclado = await porTeclado;
    expect(paginaTeclado.status()).toBe(200);
    await paginaTeclado.finished();
    await vaciarTareas(page);
    // Fin de la lista: el conteo y el estado final siguen anunciados; solo desaparece el botón.
    await bitacora.getByText('23 entradas cargados. No hay más.').waitFor({ timeout: 30_000 });
    expect(await anteriores.count()).toBe(0);
    for (let indice = 0; indice < 23; indice += 1) {
      expect(await bitacora.getByText(ENTRADA(indice), { exact: true }).count()).toBe(1);
    }

    // Directorio: se recorre hasta el final sin perder el espacio abierto ni duplicarlo.
    const masDirectorio = directorio.getByRole('button', { name: 'Cargar más espacios', exact: true });
    let paginasDirectorio = 1;
    while ((await masDirectorio.count()) > 0) {
      expect(paginasDirectorio).toBeLessThan(10);
      await cargarPagina(page, masDirectorio, '/api/v1/care/contexts');
      paginasDirectorio += 1;
    }
    expect(paginasDirectorio).toBe(5);
    const selector = directorio.getByLabel('Persona y servicio');
    expect(await selector.locator('option', { hasText: 'Paginada E.' }).count()).toBe(1);
    expect(await selector.inputValue()).toBe(ctxP);
    expect(await espacio.locator(`[data-care-context="${ctxP}"]`).count()).toBe(1);
    expect(await itemsBandeja.count()).toBe(56);
    expect(await bitacora.getByText(ENTRADA(0), { exact: true }).count()).toBe(1);

    // Cambiar a «Todas» reinicia la bandeja con el filtro nuevo: ahora sí aparecen las cerradas.
    await bandeja.getByLabel('Todas').check();
    await bandeja.getByText(`${CERRADA} 0`, { exact: true }).waitFor({ timeout: 30_000 });

    await auditar(page, '/hospital/cuidado (paginación)', '[aria-labelledby="cuidado-hospital-titulo"]');
    await page.context().close();
  }, 600_000);

  it('el espacio de cuidado no tiene violaciones de accesibilidad serias ni críticas', () => {
    expect(axeViolaciones).toEqual([]);
  });
});
