import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';

/**
 * Pruebas de API del endpoint técnico de salud.
 *
 * TASK-001 verificaba además que no existiera ninguna otra ruta. Desde
 * TASK-MVP-CORE-01 existe la rama Paciente de la inscripción, de modo que la
 * comprobación pasa a ser la contraria: la superficie debe seguir siendo
 * exactamente la aprobada.
 *
 * TASK-HOSPITAL-CORE-01 aprobó UNA superficie hospitalaria: la consulta de
 * Pacientes. Su ruta ya NO puede comprobarse como inexistente. Lo que sí sigue
 * siendo invariante —y es lo que de verdad importa— es que EXISTA y DENIEGUE:
 * sin sesión institucional vigente debe responder `401`, no `404` y desde luego
 * no `200`. Un `404` en esa ruta significaría hoy que la superficie aprobada
 * desapareció; un `200` significaría que se puede leer sin autenticación.
 *
 * La consulta nominal de pacientes, la búsqueda por documento, la
 * administración de tenants y la superficie municipal nominal siguen sin
 * existir, y así se comprueba.
 */
describe('GET /health (API)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde HTTP 200 con Content-Type JSON', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  it('devuelve exactamente { "status": "ok" }', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.body).toStrictEqual({ status: 'ok' });
    expect(Object.keys(response.body as object)).toStrictEqual(['status']);
  });

  it('no expone entorno, versión, host, base de datos ni secretos', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    const body = JSON.stringify(response.body);

    for (const forbidden of [
      'DATABASE_URL',
      'postgres',
      'postgresql',
      'password',
      'secret',
      'token',
      'env',
      'version',
      'uptime',
      'hostname',
    ]) {
      expect(body.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('no expone endpoints de mutación sobre /health', async () => {
    const server = app.getHttpServer();

    for (const status of [
      (await request(server).post('/health')).status,
      (await request(server).put('/health')).status,
      (await request(server).patch('/health')).status,
      (await request(server).delete('/health')).status,
    ]) {
      expect(status).toBe(404);
    }
  });

  it('no expone rutas fuera del alcance aprobado', async () => {
    const server = app.getHttpServer();

    /*
     * Ninguna de estas superficies existe: consulta nominal de pacientes,
     * búsqueda por documento, administración de tenants, consulta municipal
     * NOMINAL —la aprobada es exclusivamente agregada— y dominios que ninguna
     * Task ha autorizado.
     */
    for (const route of [
      '/patients',
      '/api/v1/patients',
      '/api/v1/patients/by-document/1234567890',
      '/api/v1/tenants',
      '/api/v1/municipality/patients',
      '/users',
      '/indicators',
    ]) {
      const response = await request(server).get(route);
      expect(response.status).toBe(404);
    }
  });

  /*
   * TASK-HOSPITAL-CORE-01. La comprobación no necesita PostgreSQL: el guard
   * rechaza una petición SIN cookie antes de consultar nada, de modo que la
   * denegación es la misma con la base disponible y sin ella.
   *
   * La petición no envía cookie, no abre sesión y no usa ninguna credencial:
   * comprobar que se deniega no requiere ni inventar una.
   */
  it('la consulta hospitalaria de Pacientes existe y deniega sin sesión', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospital/patients');

    // Existe: no es `404`. Y está cerrada: no es `200`.
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'INSTITUTIONAL_SESSION_REQUIRED' });
  });

  it('la denegación hospitalaria no devuelve ningún dato ni describe la causa', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospital/patients');
    const body = JSON.stringify(response.body).toLowerCase();

    // Ni un solo registro, ni conteos, ni analítica.
    expect(response.body).not.toHaveProperty('items');
    expect(response.body).not.toHaveProperty('totalItems');
    expect(response.body).not.toHaveProperty('keyFigures');

    /*
     * La respuesta tampoco distingue POR QUÉ se denegó —ausente, expirada,
     * revocada o manipulada— ni describe la topología interna.
     */
    for (const forbidden of [
      'tenant',
      'identity',
      'expired',
      'revoked',
      'postgres',
      'prisma',
      'select',
      'stack',
    ]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it('no admite recuperar un paciente por identificador en la URL', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/patients/019287a1-0000-7000-8000-000000000001',
    );

    // La ruta no existe: solo `me` recupera, y lo hace por sesión.
    expect(response.status).toBe(404);
  });
});
