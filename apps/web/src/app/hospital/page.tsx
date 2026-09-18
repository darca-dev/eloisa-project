import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { HospitalShell } from '@/features/hospital/HospitalShell';
import type { HospitalSesionDto } from '@/features/hospital/hospitalInstitutionClient';

/**
 * Superficie de revisión del Shell Hospital (TASK-003H-01, FR-01).
 *
 * `/hospital` existe para que el Product Owner reconozca en localhost la
 * envolvente visual aprobada. No reemplaza ni degrada `/` ni ninguna otra
 * experiencia, no consume entorno y no crea sesión, cuenta ni dato persistente.
 *
 * Se inyecta una sesión demostrativa para que el shell muestre el panel completo
 * en entornos de desarrollo local sin backend activo, reproduciendo fielmente
 * el prototipo oficial `Eligeme-Hospital.dc.html`.
 *
 * NOTA: esta sesión ES FICTICIA — no otorga acceso al API real, no tiene
 * cookie HttpOnly válida y no persiste entre recargas. Los endpoints de datos
 * siguen protegidos por sus propios guards en el servidor.
 */
const SESION_DEMO: HospitalSesionDto = {
  role: 'HOSPITAL_PATIENT_VIEWER',
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 horas
  institution: { name: 'Hospital San Rafael (ESE)' },
  actorDisplay: 'Acceso institucional · Demo local',
};

export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Hospital`,
  description:
    'Panel de gestión hospitalaria: agenda, pacientes, profesionales, visitas domiciliarias, telemedicina y administración.',
  robots: { index: false, follow: false },
};

export default function HospitalPage(): ReactNode {
  return <HospitalShell sesionInicial={SESION_DEMO} />;
}
