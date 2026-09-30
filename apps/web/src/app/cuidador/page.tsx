import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { CaregiverAccessPortal } from '@/features/caregiver/CaregiverAccessPortal';

/**
 * Superficie protegida del Cuidador (SPEC 038, MP04 §12).
 *
 * `/cuidador` deja de ser una muestra visual: es UNA de las tres rutas que el
 * selector de `/acceso` solo abre con la experiencia `CAREGIVER` aprobada. La
 * ruta no comprueba nada ni inyecta nada —lo hacen la experiencia y los
 * contextos en `CaregiverAccessPortal`—, y no acepta ningún parámetro de URL:
 * ningún query string puede activar un modo demostrativo ni saltear la
 * comprobación.
 *
 * Con relación activa monta la demostración de liquidaciones; SIN relación
 * muestra una portada neutra sin ningún dato nominal.
 */
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Portal del cuidador`,
  description:
    'Portal del cuidador: liquidaciones de demostración para la relación de cuidado aprobada. Sin pagos ni datos reales.',
  robots: { index: false, follow: false },
};

export default function CaregiverPage(): ReactNode {
  return <CaregiverAccessPortal />;
}
