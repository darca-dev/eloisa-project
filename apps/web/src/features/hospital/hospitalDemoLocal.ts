/** Fuente local exclusiva de `/hospital` para la demostración visual. */
const PROCEDENCIA = {
  source: 'DEMO_LOCAL_FICTICIA',
  asOfDate: '2026-09-21',
  generatedAt: '2026-09-21T12:00:00.000Z',
} as const;

const PACIENTES = [
  {
    patientId: 'demo-paciente-001', fullName: 'Elena Prado Demo', initials: 'EP',
    documentMasked: 'DEMO-•••-001', age: 72, epsCode: 'DEMO-01', epsName: 'Cobertura ficticia',
    priorities: { older60: true, disabilityDeclared: false, homeCareRequiredDeclared: true },
    territory: { municipalityOfficialCode: null, municipalityName: 'Territorio demo', areaType: 'URBAN', localUnitName: 'Zona demostrativa', pendingNormalization: false },
    status: 'ACTIVE', statusLabel: 'Activa',
  },
  {
    patientId: 'demo-paciente-002', fullName: 'Mateo Ríos Demo', initials: 'MR',
    documentMasked: 'DEMO-•••-002', age: 66, epsCode: 'DEMO-02', epsName: 'Cobertura ficticia',
    priorities: { older60: true, disabilityDeclared: true, homeCareRequiredDeclared: false },
    territory: { municipalityOfficialCode: null, municipalityName: 'Territorio demo', areaType: 'RURAL', localUnitName: 'Zona demostrativa', pendingNormalization: false },
    status: 'ACTIVE', statusLabel: 'Activa',
  },
] as const;

const PROFESIONALES = [
  {
    professionalId: 'demo-profesional-001', fullName: 'Andrea Salas Demo', initials: 'AS',
    professionCode: 'MEDICINA_GENERAL', professionName: 'Medicina general', status: 'ACTIVE',
    activeAffiliation: { engagementType: 'EMPLOYEE', status: 'ACTIVE', startsOn: '2026-01-01', endsOn: null },
    activePatientCount: 12, todayAppointmentCount: 4, nextAppointmentAt: '2026-09-21T14:00:00.000Z',
    ratingAvailability: 'No disponible en demostración local',
  },
  {
    professionalId: 'demo-profesional-002', fullName: 'Julián Vega Demo', initials: 'JV',
    professionCode: 'NURSING', professionName: 'Enfermería', status: 'ACTIVE',
    activeAffiliation: { engagementType: 'INDEPENDENT', status: 'ACTIVE', startsOn: '2026-02-01', endsOn: null },
    activePatientCount: 9, todayAppointmentCount: 3, nextAppointmentAt: '2026-09-21T15:30:00.000Z',
    ratingAvailability: 'No disponible en demostración local',
  },
] as const;

const AGENDA = {
  source: PROCEDENCIA.source,
  generatedAt: PROCEDENCIA.generatedAt,
  window: { from: '2026-09-21', to: '2026-09-21' },
  requests: [{ appointmentId: 'demo-cita-001', version: 1, patient: PACIENTES[0], modality: 'HOME', requestedAt: '2026-09-21T08:00:00.000Z' }],
  assignableProfessionals: PROFESIONALES.map(({ status: _status, activeAffiliation: _affiliation, activePatientCount: _patients, todayAppointmentCount: _today, nextAppointmentAt: _next, ratingAvailability: _rating, ...persona }) => persona),
  appointments: [{ appointmentId: 'demo-cita-002', patient: PACIENTES[1], professional: PROFESIONALES[0], modality: 'VIRTUAL', status: 'ASSIGNED', scheduledStart: '2026-09-21T14:00:00.000Z' }],
  dailyCounts: [{ date: '2026-09-21', total: 1 }], modalityCounts: [{ modality: 'HOME', total: 0 }, { modality: 'VIRTUAL', total: 1 }], totalAppointments: 1,
};

function respuesta(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Cliente en memoria: nunca delega al `fetch` del navegador ni a una URL real. */
export const hospitalDemoFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  if ((init?.method ?? 'GET') !== 'GET') return respuesta({ message: 'El modo demo no guarda cambios.' }, 403);
  if (url.includes('/agenda')) return respuesta(AGENDA);
  if (url.includes('/patients/analytics')) return respuesta({ ...PROCEDENCIA, definitionVersion: 'demo-local-1', activeUniverse: 2, filteredUniverse: 2, keyFigures: [{ key: 'total', label: 'Personas ficticias', value: 2, percentage: null }], distributions: [], intersections: [] });
  if (url.includes('/patients/')) {
    const paciente = PACIENTES.find((item) => url.includes(item.patientId)) ?? PACIENTES[0];
    return respuesta({ ...PROCEDENCIA, ...paciente, documentType: 'DEMO', documentTypeLabel: 'Identificador ficticio', birthDate: '1954-01-01', contactAvailability: 'No aplica en demostración local' });
  }
  if (url.includes('/patients')) return respuesta({ ...PROCEDENCIA, page: 1, pageSize: 25, totalItems: PACIENTES.length, totalPages: 1, items: PACIENTES });
  if (url.includes('/professionals/')) {
    const profesional = PROFESIONALES.find((item) => url.includes(item.professionalId)) ?? PROFESIONALES[0];
    return respuesta({ ...PROCEDENCIA, ...profesional, window: AGENDA.window, assignedPatients: PACIENTES.map(({ patientId, fullName, initials }) => ({ patientId, fullName, initials })), appointments: [] });
  }
  if (url.includes('/professionals')) return respuesta({ source: PROCEDENCIA.source, generatedAt: PROCEDENCIA.generatedAt, page: 1, pageSize: 25, totalItems: PROFESIONALES.length, totalPages: 1, items: PROFESIONALES });
  return respuesta({ message: 'Recurso demo no disponible.' }, 404);
};
