import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { MunicipalityShell } from '@/features/municipality/MunicipalityShell';

/**
 * Superficie de la experiencia Alcaldía (TASK-ALCALDIA-A-01, FR-01).
 *
 * La sesión institucional se resuelve exclusivamente del lado del servidor.
 * Este componente no inyecta ninguna sesión demostrativa: la composición
 * autorizada no depende de datos inyectados en el cliente.
 */
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Alcaldía`,
  description:
    'Experiencia municipal de gestión territorial, resultados y evidencia. Datos agregados y ficticios, sin backend, sin integraciones y sin acceso a información clínica individual.',
  robots: { index: false, follow: false },
};

export default function MunicipalityPage(): ReactNode {
  return <MunicipalityShell />;
}
