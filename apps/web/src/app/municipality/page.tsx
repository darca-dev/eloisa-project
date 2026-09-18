import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { MunicipalityShell } from '@/features/municipality/MunicipalityShell';
import type { SesionInstitucionalDto } from '@/features/auth/institutionalSessionClient';

/**
 * Superficie de la experiencia Alcaldía (TASK-ALCALDIA-A-01, FR-01).
 *
 * Se inyecta una sesión demostrativa con rol `MUNICIPAL_VIEWER` para que el shell
 * muestre el panel completo en entornos de desarrollo local sin backend activo,
 * reproduciendo fielmente el prototipo oficial `Eligeme-Alcaldia.dc.html`.
 *
 * NOTA: esta sesión ES FICTICIA — no otorga acceso al API real ni persiste entre
 * recargas. Los endpoints de datos siguen protegidos por sus propios guards.
 */
const SESION_DEMO: SesionInstitucionalDto = {
  role: 'MUNICIPAL_VIEWER',
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 horas
  institution: { name: 'Alcaldía de Soacha' },
  actorDisplay: 'Acceso institucional · Demo local',
};

export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Alcaldía`,
  description:
    'Experiencia municipal de gestión territorial, resultados y evidencia. Datos agregados y ficticios, sin backend, sin integraciones y sin acceso a información clínica individual.',
  robots: { index: false, follow: false },
};

export default function MunicipalityPage(): ReactNode {
  return <MunicipalityShell sesionInicial={SESION_DEMO} />;
}
