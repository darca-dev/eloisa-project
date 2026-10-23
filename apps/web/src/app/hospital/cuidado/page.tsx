import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { CareHospitalEntry } from '@/features/care/CareHospitalEntry';

export const dynamic = 'force-dynamic';

/**
 * Revisión clínica de cuidado en Hospital (SPEC 055 / MP07B, A05).
 *
 * Entrada enfocada para la persona revisora con cuenta personal: sesión humana
 * y API de cuidado. No monta la administración institucional, no inyecta
 * sesión y no lee parámetros de URL; el servidor decide qué se muestra.
 */
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Revisión clínica de cuidado`,
  robots: { index: false, follow: false },
};

export default function HospitalCuidadoPage(): ReactNode {
  return <CareHospitalEntry />;
}
