import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { CentralAccess } from '@/features/access/CentralAccess';
import { humanAccessDemoLocalEnabled } from '@/features/access/humanAccessDemoLocal';

/* La bandera demo se evalúa al atender la solicitud, no al construir la imagen. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Atención Domiciliaria`,
  description:
    'Acceso y solicitudes para pacientes, cuidadores y visitadores médicos.',
  robots: { index: false, follow: false },
};

export default function AccessPage(): ReactNode {
  return (
    <Suspense fallback={null}>
      <CentralAccess modoDemoLocal={humanAccessDemoLocalEnabled()} />
    </Suspense>
  );
}
