import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HospitalAccessRequests } from './HospitalAccessRequests';

const DIRECTORY = fileURLToPath(new URL('.', import.meta.url));

describe('HospitalAccessRequests', () => {
  it('parte de un estado de carga accesible, sin filas o datos personales inventados', () => {
    const html = renderToStaticMarkup(<HospitalAccessRequests />);
    expect(html).toContain('Solicitudes de acceso');
    expect(html).toContain('Revisión institucional');
    expect(html).toContain('Cargando solicitudes');
    expect(html).toContain('Buscar por referencia, nombre o documento');
    expect(html).toContain('Visitador médico');
    expect(html).not.toContain('María Fernanda Ríos');
    expect(html).not.toContain('SOL-DEMO');
  });

  it('mantiene una sola región viva y no persiste datos en el navegador', () => {
    const source = readFileSync(`${DIRECTORY}HospitalAccessRequests.tsx`, 'utf8');
    expect(source.match(/aria-live=/gu)).toHaveLength(1);
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/gu);
    expect(source).toContain('decisionLock.current');
    expect(source).toContain('AbortController');
  });

  it('ofrece las seis acciones institucionales, y solo cuando el estado las admite', () => {
    const source = readFileSync(`${DIRECTORY}HospitalAccessRequests.tsx`, 'utf8');

    // Las seis, por su clave de catálogo y no por un texto escrito a mano.
    for (const action of [
      'APPROVE',
      'REJECT',
      'RETRY_PROVISIONING',
      'SUSPEND',
      'REACTIVATE',
      'REVOKE',
    ]) {
      expect(source).toContain(`${action}:`);
    }

    // La oferta sale del ESTADO de la fila, nunca de una lista fija.
    expect(source).toContain('validActionsFor(');
    expect(source).toContain('ACCESS_PROVISIONING_MAX_ATTEMPTS');
    expect(source).not.toContain('confirmation === ');
    expect(source).not.toContain(">Aprobar {detail.reference}<");
  });

  it('pinta el estado real de la fila y la provisión fallida, no «Pendiente» a ciegas', () => {
    const source = readFileSync(`${DIRECTORY}HospitalAccessRequests.tsx`, 'utf8');

    expect(source).toContain('STATUS_LABEL[item.status]');
    expect(source).toContain('STATUS_LABEL[detail.status]');
    expect(source).not.toContain('>Pendiente</span>');
    expect(source).toContain('PROVISIONING_LABEL[detail.provisioningStatus]');
    expect(source).toContain('detail.provisioningAttempts');
    expect(source).toContain('detail.provisioningErrorCode');

    // El filtro por estado solo admite lo que el servidor acepta.
    expect(source).toContain('ACCESS_REQUEST_LIST_FILTER_STATUSES');
    expect(source).toContain('status: statusDraft');
  });

  it('el detalle pinta el expediente por secciones traducidas, nunca como JSON crudo', () => {
    const source = readFileSync(`${DIRECTORY}HospitalAccessRequests.tsx`, 'utf8');

    // Cinco encabezados reconocibles: datos personales + cuatro del expediente.
    expect(source).toContain('id="access-request-datos-title">Datos personales</h4>');
    expect(source).toContain('aria-labelledby="access-request-datos-title"');
    expect(source).toContain('EXPEDIENTE_SECCIONES[detail.requestedProfile]');
    expect(source).toContain('Expediente de solicitud · versión');
    expect(source).toContain('Son declaraciones de la persona solicitante');
    expect(source).toContain('valorExpediente(');
    expect(source).toContain('etiquetaDe(fila.catalogo, item)');
    expect(source).toContain('Sin expediente: solicitud registrada antes del flujo guiado.');

    // Cinco encabezados por rama: título + nota + cuatro secciones.
    for (const seccion of [
      'Condición y necesidades declaradas',
      'Perfil del cuidador declarado',
      'Información profesional declarada',
      'Consentimientos registrados',
    ]) {
      expect(source).toContain(seccion);
    }

    // Sin volcado crudo del objeto en el marcado.
    expect(source).not.toContain('JSON.stringify(detail.registration');
  });

  it('cada confirmación nombra un efecto técnico y nunca a la persona', () => {
    const source = readFileSync(`${DIRECTORY}HospitalAccessRequests.tsx`, 'utf8');
    const confirmaciones = source.slice(
      source.indexOf('ACTION_CONFIRM_TEXT'),
      source.indexOf('ACTION_ANNOUNCEMENT'),
    );

    expect((confirmaciones.match(/^\s{2}[A-Z_]+:/gmu) ?? [])).toHaveLength(6);
    for (const prohibido of ['DOCUMENTO', 'SALUD', 'DIAGNÓSTICO', 'EDAD']) {
      expect(confirmaciones).not.toContain(prohibido);
    }
  });
});
