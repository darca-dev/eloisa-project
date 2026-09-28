import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { CaregiverLiquidationsDemo } from '@/features/caregiver/CaregiverLiquidationsDemo';

export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Portal demo del cuidador`,
  description: 'Demostración local de consultas de liquidaciones para cuidador. Sin pagos ni datos reales.',
  robots: { index: false, follow: false },
};

export default function CaregiverPage(): ReactNode {
  return <CaregiverLiquidationsDemo />;
}
