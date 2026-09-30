import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { urlDeLoginHumano } from '@/features/auth/humanSessionClient';
import { PacienteExperience } from '@/features/paciente/PacienteExperience';

/**
 * Superficie protegida del Paciente (SPEC 038, MP04 §12).
 *
 * `/paciente` es UNA de las tres portadas que MP04 cierra: el selector de
 * `/acceso` solo puede llegar hasta aquí cuando el servidor devolvió la
 * experiencia `PATIENT` aprobada para la cuenta de la sesión. La ruta NO
 * comprueba nada por su cuenta ni decide nada en el navegador —lo hacen las
 * APIs—, pero tampoco inyecta ninguna sesión ni ningún dato:
 *
 * - monta `PacienteExperience`, que vuelve a consultar `GET /me/contexts` y las
 *   tres rutas self-scope por su cuenta al montarse. Fallar cerrado dos veces es
 *   más barato que confiar una;
 * - pasa la URL OIDC calculada aquí, no desde el navegador, para que la ruta no
 *   componga ni deduzca ningún destino;
 * - no acepta parámetros de URL: ningún query string puede activar un modo
 *   demostrativo, inyectar una sesión o saltear la comprobación;
 * - no declara datos: el resumen propio sale EXACTAMENTE de `patient-self`,
 *   limitado a nombre de pila, iniciales y la etiqueta fija `Paciente`.
 *
 * `metadata.robots` queda cerrado: una portada autenticada no se indexa.
 */
export const metadata: Metadata = {
  title: `${platformNameInSentence()} — Mi espacio`,
  description:
    'Espacio del paciente: resumen propio, próximas citas y visitas recientes a partir de la sesión humana aprobada.',
  robots: { index: false, follow: false },
};

export default function PacientePage(): ReactNode {
  return <PacienteExperience urlLogin={urlDeLoginHumano()} />;
}
