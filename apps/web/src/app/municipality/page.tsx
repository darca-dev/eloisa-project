import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { MunicipalityShell } from '@/features/municipality/MunicipalityShell';
import type { SesionInstitucionalDto } from '@/features/auth/institutionalSessionClient';

/* La bandera demo se lee al atender la solicitud, no al construir la imagen. */
export const dynamic = 'force-dynamic';

/**
 * Superficie de la experiencia Alcaldía (TASK-ALCALDIA-A-01, FR-01).
 *
 * La ruta normal resuelve la sesión institucional antes de mostrar contenido.
 * Solo el modo demo local explícitamente configurado puede inyectar un contexto
 * FICTICIO para recorrer la experiencia sin escribir credenciales; no crea una
 * cookie, no habilita APIs reales y no existe en la URL.
 */
const SESION_DEMO_LOCAL: SesionInstitucionalDto = {
  role: 'MUNICIPAL_VIEWER',
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 horas
  institution: { name: 'Alcaldía de demostración local' },
  actorDisplay: 'Acceso institucional · Demo local',
};

function modoDemoLocal(): boolean {
  return process.env.MERDN_MUNICIPALITY_DEMO_LOCAL === 'true';
}
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Alcaldía`,
  description:
    'Experiencia municipal de gestión territorial, resultados y evidencia. Datos agregados y ficticios, sin backend, sin integraciones y sin acceso a información clínica individual.',
  robots: { index: false, follow: false },
};

export default function MunicipalityPage(): ReactNode {
  if (modoDemoLocal()) {
    return <MunicipalityShell sesionInicial={SESION_DEMO_LOCAL} />;
  }

  return <MunicipalityShell />;
}
