import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const directory = fileURLToPath(new URL('.', import.meta.url));
const source = readFileSync(`${directory}DemoNavigation.tsx`, 'utf8');
const effectiveSource = source
  .replace(/\/\*[\s\S]*?\*\//gu, '')
  .replace(/\/\/.*$/gmu, '');

describe('Navegación demo local', () => {
  it('declares that all profiles and data are fictional', () => {
    expect(source).toContain('Todos los perfiles y datos son ficticios.');
    expect(source).toContain('No solicita credenciales ni crea sesiones, usuarios, solicitudes o datos.');
  });

  it('does not call the API or create browser persistence', () => {
    for (const prohibited of [
      'fetch(',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
      'urlDeLoginHumano',
      'abrirSesionInstitucional',
    ]) {
      expect(effectiveSource).not.toContain(prohibited);
    }
  });

  it('opens Hospital, Alcaldía and la inscripción without an intermediate login', () => {
    const hub = readFileSync(`${directory}../hub/HubAccessPortal.tsx`, 'utf8');

    expect(hub).toContain('href="/hospital"');
    expect(hub).toContain('href="/municipality"');
    expect(hub).toContain('href="/inscripcion"');
    expect(hub).not.toContain('href="/acceso?destino=');
  });

  it('keeps the Hospital approval tray local and non-persistent', () => {
    const approvals = readFileSync(`${directory}../hospital/HospitalAccessApprovalsDemo.tsx`, 'utf8');

    expect(approvals).toContain('Demostración local');
    expect(approvals).toContain('No se guardó ningún cambio.');
    expect(approvals).not.toContain('fetch(');
    expect(approvals).not.toContain('localStorage');
  });
});
