/**
 * Lectura estricta de argumentos del script de provisión del primer gestor
 * (SPEC 055 / MP05b). Pura: no abre conexiones ni toca ninguna base.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseProvisionArgs, ProvisionArgumentError } from '../../scripts/care/provision-care-manager.mjs';

const BASE = [
  '--tenant-code', 'merdn-mvp',
  '--organization-code', 'hospital-ficticio',
  '--organization-name', 'Hospital ficticio',
  '--organization-kind', 'HOSPITAL',
  '--manager-document', 'CEDULA_CIUDADANIA:1001',
  '--grantor-document', 'CEDULA_CIUDADANIA:2002',
  '--authorization-reference', 'acta.001',
];

test('acepta los argumentos completos y normaliza la referencia', () => {
  const args = parseProvisionArgs(BASE);
  assert.equal(args.authorizationReference, 'ACTA.001');
  assert.deepEqual(args.manager, { documentType: 'CEDULA_CIUDADANIA', documentNumber: '1001' });
  assert.equal(args.dryRun, false);
  assert.equal(parseProvisionArgs([...BASE, '--dry-run']).dryRun, true);
});

test('el emisor y el gestor deben ser personas distintas', () => {
  const mismo = BASE.map((value) => (value === 'CEDULA_CIUDADANIA:2002' ? 'CEDULA_CIUDADANIA:1001' : value));
  assert.throws(() => parseProvisionArgs(mismo), ProvisionArgumentError);
});

test('rechaza argumentos desconocidos, repetidos o incompletos', () => {
  assert.throws(() => parseProvisionArgs([...BASE, '--database-url', 'x']), ProvisionArgumentError);
  assert.throws(() => parseProvisionArgs([...BASE, '--tenant-code', 'otro']), ProvisionArgumentError);
  assert.throws(() => parseProvisionArgs(BASE.slice(0, -2)), ProvisionArgumentError);
});

test('no administra organizaciones municipales ni códigos o documentos mal formados', () => {
  const con = (flag, value) => {
    const copia = [...BASE];
    copia[copia.indexOf(flag) + 1] = value;
    return copia;
  };
  assert.throws(() => parseProvisionArgs(con('--organization-kind', 'MUNICIPALITY')), ProvisionArgumentError);
  assert.throws(() => parseProvisionArgs(con('--organization-code', 'Con Espacios')), ProvisionArgumentError);
  assert.throws(() => parseProvisionArgs(con('--manager-document', '1001')), ProvisionArgumentError);
  assert.throws(() => parseProvisionArgs(con('--authorization-reference', 'x')), ProvisionArgumentError);
});
