import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { DemoNavigation } from '@/features/access/DemoNavigation';

export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Acceso central`,
  description:
    'Entrada segura para los espacios institucionales y para solicitudes de acceso ciudadano.',
  robots: { index: false, follow: false },
};

export default function AccessPage(): ReactNode {
  return <DemoNavigation />;
}
