import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { MunicipalityShell } from '@/features/municipality/MunicipalityShell';

export const dynamic = 'force-dynamic';

/**
 * Superficie de la experiencia Alcaldía (TASK-ALCALDIA-A-01, FR-01).
 *
 * La puerta resuelve la sesión institucional antes de mostrar contenido.
 */
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Alcaldía`,
  description:
    'Experiencia municipal de gestión territorial y evidencia institucional con acceso autorizado.',
  robots: { index: false, follow: false },
};

export default function MunicipalityPage(): ReactNode {
  return <MunicipalityShell />;
}
