import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { ProfesionalPortal } from '@/features/profesional/ProfesionalPortal';

/**
 * Superficie del Profesional de la Salud en Terreno / Visitador.
 *
 * Muestra la hoja de ruta del día, asignaciones hospitalarias y conexión directa
 * con la bitácora del paciente.
 */
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Profesional en Salud`,
  description:
    'Portal para profesionales de la salud en terreno: médicos, enfermeros y terapeutas domiciliarios coordinados por el Hospital.',
  robots: { index: false, follow: false },
};

export default function ProfesionalPage(): ReactNode {
  return <ProfesionalPortal />;
}
