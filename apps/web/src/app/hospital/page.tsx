import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { HospitalShell } from '@/features/hospital/HospitalShell';

export const dynamic = 'force-dynamic';

/** Entrada institucional autenticada mediante la cuenta humana del administrador. */
export const metadata: Metadata = { title: platformNameInSentence() + ' — Hospital', robots: { index: false, follow: false } };
export default function HospitalPage(): ReactNode { return <HospitalShell administracionHumana />; }
