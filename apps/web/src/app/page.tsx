import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { HubAccessPortal } from '@/features/hub/HubAccessPortal';

/**
 * Entrada principal de la plataforma Eloísa / Elígeme.
 *
 * Portal Central de Acceso Multirrol:
 * - Alcaldía de Soacha (/municipality)
 * - Hospital ESE (/hospital)
 * - Profesionales de la Salud (/profesional)
 * - Pacientes y Cuidadores (/inscripcion)
 */
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Portal Central de Acceso`,
  description:
    'Portal de acceso multirrol para la Alcaldía de Soacha, Hospital, Profesionales de la Salud, Pacientes y Cuidadores.',
  robots: { index: false, follow: false },
};

export default function HomePage(): ReactNode {
  return <HubAccessPortal />;
}
