import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { humanAccessDemoLocalEnabled } from '@/features/access/humanAccessDemoLocal';
import { ProfesionalDemoPresentation } from '@/features/profesional/ProfesionalDemoPresentation';
import { ProfesionalPortalProtegido } from '@/features/profesional/ProfesionalPortal';

/* La bandera demo se lee al atender la solicitud, no al construir la imagen. */
export const dynamic = 'force-dynamic';

/**
 * Superficie protegida del Profesional en Salud / Visitador (SPEC 038, MP04 §12).
 *
 * `/profesional` es UNA de las tres portadas que el selector de `/acceso` solo
 * abre con la experiencia `FIELD_PROFESSIONAL` aprobada. La ruta no comprueba
 * nada ni inyecta nada: monta la PUERTA, que consulta experiencia, sesión y
 * worklist, y no acepta ningún parámetro de URL.
 *
 * Con asignación muestra la worklist del servidor. SIN asignación —o sin perfil
 * o sin afiliación vigente— el servidor devuelve `items: []` y la pantalla
 * muestra la lista vacía: nunca deniega por falta de trabajo, porque no tener
 * visitas asignadas no es una denegación de acceso.
 *
 * `MERDN_HUMAN_ACCESS_DEMO_LOCAL=true` habilita únicamente una presentación
 * local con visitas ficticias fijas; no crea sesión, ni consulta o escribe en
 * la API, y no puede activarse mediante la URL.
 */
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Profesional en Salud`,
  description:
    'Portal para profesionales de la salud en terreno: hoja de ruta de visitas domiciliarias asignadas por el Hospital.',
  robots: { index: false, follow: false },
};

export default function ProfesionalPage(): ReactNode {
  if (humanAccessDemoLocalEnabled()) {
    return <ProfesionalDemoPresentation />;
  }

  return <ProfesionalPortalProtegido />;
}
