import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HospitalTodayView, type HospitalTodayState } from './HospitalOperationalHome';
import { HospitalShell, nombreVisibleHospital } from './HospitalShell';
import { HOSPITAL_PENDING_MODULES } from './HospitalPendingModule';
import type { HospitalAgendaVistaDto } from './hospitalAgendaClient';
import type { HospitalSesionDto } from './hospitalInstitutionClient';

const sesion: HospitalSesionDto = { role: 'HOSPITAL_PATIENT_VIEWER', actorDisplay: 'Administrador institucional', administrator: true, institution: { name: 'MERDN — Tenant institucional MVP' }, expiresAt: '2026-10-15T23:00:00Z' };
const agenda: HospitalAgendaVistaDto = { source: 'TEST_DATA', generatedAt: '2026-10-15T12:00:00Z', window: { from: '2026-10-15', to: '2026-10-15' }, requests: [], assignableProfessionals: [], appointments: [], dailyCounts: [], modalityCounts: [], totalAppointments: 0 };
const render = (estado: HospitalTodayState) => renderToStaticMarkup(<HospitalTodayView estado={estado} fecha="2026-10-15" onReintentar={() => {}} />);

describe('052 — Hospital operativo', () => {
  it('conserva la razón social y sustituye solamente el nombre técnico o vacío', () => {
    expect(nombreVisibleHospital('MERDN — Tenant institucional MVP')).toBe('Hospital');
    expect(nombreVisibleHospital('  ')).toBe('Hospital');
    expect(nombreVisibleHospital('Hospital institucional Santa María')).toBe('Hospital institucional Santa María');
    const html = renderToStaticMarkup(<HospitalShell sesionInicial={sesion} administracionHumana />);
    expect(html).not.toContain('Tenant institucional MVP');
    expect(html).toContain('Panel de Hospital');
  });

  it('no publica ceros, cifras o pacientes mientras carga o falla la consulta', () => {
    for (const estado of [null, { kind: 'error' }, { kind: 'no-disponible' }, { kind: 'sin-permiso' }, { kind: 'sin-sesion' }] as const) {
      const html = render(estado);
      expect(html).not.toContain('<dd>');
      expect(html).not.toContain('<tbody>');
      expect(html).not.toContain('No hay citas asignadas registradas');
      if (estado !== null) expect(html).toContain('role="alert"');
    }
  });

  it('muestra vacío y cero únicamente cuando la agenda lo confirma', () => {
    const html = render({ kind: 'ok', datos: agenda });
    expect(html).toContain('<dd>0</dd>');
    expect(html).toContain('No hay citas asignadas registradas');
    expect(html).toContain('2026-10-15 · UTC');
    expect(html).toContain('Fuente: agenda institucional guardada');
  });

  it('representa las citas publicadas con sus nombres, modalidad y hora UTC', () => {
    const html = render({ kind: 'ok', datos: { ...agenda, totalAppointments: 1, appointments: [{ appointmentId: 'test-appointment', patient: { patientId: 'test-patient', fullName: 'Persona de prueba & control', initials: 'PC' }, professional: { professionalId: 'test-professional', fullName: 'Profesional de prueba', initials: 'PP', professionCode: 'TEST', professionName: 'Prueba' }, modality: 'HOME', status: 'ASSIGNED', scheduledStart: '2026-10-15T15:30:00Z' }] } });
    expect(html).toContain('<dd>1</dd>');
    expect(html).toContain('Persona de prueba &amp; control');
    expect(html).toContain('Profesional de prueba');
    expect(html).toContain('15:30');
    expect(html).toContain('Domiciliaria');
    expect(html).not.toContain('No hay citas asignadas registradas');
  });

  it('cada módulo sin servicio excluye tablas, indicadores y acciones de fixtures', () => {
    for (const modulo of Object.keys(HOSPITAL_PENDING_MODULES) as (keyof typeof HOSPITAL_PENDING_MODULES)[]) {
      if (modulo === 'administracion') continue;
      const html = renderToStaticMarkup(<HospitalShell sesionInicial={sesion} administracionHumana vistaInicial={modulo} />);
      const main = /<main[^>]*>([\s\S]*?)<\/main>/u.exec(html)![1]!;
      expect(main).toContain('Pendiente de implementación');
      expect(main).not.toContain('<table');
      expect(main).not.toContain('<dd>');
      expect(main).not.toContain('<button');
      expect(main).not.toContain('Demostración');
    }
    const html = renderToStaticMarkup(<HospitalShell sesionInicial={sesion} administracionHumana vistaInicial="administracion" pestanaAdministracionInicial="Membresías" />);
    expect(html).toContain('Solicitudes de acceso');
    expect(html).not.toContain('Planes de membresía');
    expect(html).not.toContain('data-hospital-admin="Membresías"');
    const sinCapacidad = renderToStaticMarkup(<HospitalShell sesionInicial={{ ...sesion, administrator: false }} vistaInicial="administracion" pestanaAdministracionInicial="Membresías" />);
    expect(sinCapacidad).toContain('Esta sesión no tiene habilitada la gestión de solicitudes');
    expect(sinCapacidad).not.toContain('Planes de membresía');
    expect(sinCapacidad).not.toContain('data-hospital-admin=');
  });
});
