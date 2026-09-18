import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { ExperienciaMerdn } from '@/features/experiencia/ExperienciaMerdn';

/**
 * Superficie oficial de inscripción y registro ciudadano (TASK-002A).
 *
 * Flujo paso a paso para Pacientes, Cuidadores y Visitadores guiados por Isa / Elí.
 */
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Inscripción`,
  description:
    'Flujo guiado de inscripción ciudadana para pacientes y cuidadores del programa de atención domiciliaria.',
  robots: { index: false, follow: false },
};

export default function InscripcionPage(): ReactNode {
  return <ExperienciaMerdn />;
}
