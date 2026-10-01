import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { HospitalShell } from '@/features/hospital/HospitalShell';
import type { HospitalSesionDto } from '@/features/hospital/hospitalInstitutionClient';

/* La bandera demo se lee al atender la solicitud, no al construir la imagen. */
export const dynamic = 'force-dynamic';

/**
 * Superficie protegida de revisión del Shell Hospital (TASK-003H-01, FR-01).
 *
 * La ruta NORMAL de `/hospital` no inyecta ninguna sesión: la composición la
 * resuelve del lado del servidor a través de la sesión institucional compartida,
 * igual que la experiencia municipal. No consume datos ficticios para pintar un
 * panel que la sesión no respalda.
 *
 * El modo demo local SOLO se habilita mediante configuración explícita
 * server-side (`MERDN_HOSPITAL_DEMO_LOCAL=true`), cerrada por defecto. Ningún
 * parámetro de URL puede activarlo: el bypass no existe en el navegador.
 *
 * Con el modo demo activado se inyecta un contexto demostrativo para recorrer
 * Hospital sin escribir credenciales. Esa sesión ES FICTICIA, no crea cookie,
 * no otorga acceso al API real y no persiste entre recargas. Los endpoints de
 * datos conservan sus propios guards. Con el modo desactivado el formulario
 * institucional manual permanece intacto.
 */
const SESION_DEMO: HospitalSesionDto = {
  role: 'HOSPITAL_PATIENT_VIEWER',
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 horas
  institution: { name: 'Hospital San Rafael (ESE)' },
  actorDisplay: 'Acceso institucional · Demo local',
};

/** Modo demo local habilitado SOLO por configuración explícita server-side. */
function modoDemoLocal(): boolean {
  return process.env.MERDN_HOSPITAL_DEMO_LOCAL === 'true';
}

export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Hospital`,
  description:
    'Panel de gestión hospitalaria: agenda, pacientes, profesionales, visitas domiciliarias, telemedicina y administración.',
  robots: { index: false, follow: false },
};

export default function HospitalPage(): ReactNode {
  if (!modoDemoLocal()) {
    return <HospitalShell />;
  }

  return <HospitalShell sesionInicial={SESION_DEMO} modoDemoLocal />;
}
