import { Nunito } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';

import './globals.css';

/**
 * Nunito es la tipografía común observada en el prototipo aprobado
 * (`Eligeme-Linea-Visual-B.dc.html`). Se integra con `next/font`, que la
 * autoaloja durante el build: la página no solicita fuentes a terceros en
 * tiempo de ejecución y conserva el fallback `system-ui, sans-serif`.
 */
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
  variable: '--font-nunito',
});

/**
 * Metadata raíz de Inscripción (TASK-BRAND-01, FR-09).
 *
 * El título se compone desde la fuente central de branding: el nombre técnico
 * interno del proyecto no puede aparecer en ninguna superficie visible.
 */
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Inscripción`,
  description:
    'Reconstrucción frontend del flujo de inscripción aprobado. Sin cuentas, sin backend y sin datos reales.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html lang="es" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
