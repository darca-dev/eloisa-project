'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { platformNameInSentence } from '@/config/branding';
import { urlDeLoginAdministrador } from '@/features/auth/institutionalAdministratorClient';

import { CareWorkspace } from './CareWorkspace';
import styles from './care.module.css';

/**
 * Entrada de revisión clínica de Hospital (SPEC 055 / MP07B, A05).
 *
 * Para la persona revisora con cuenta PERSONAL: usa su sesión humana y la API
 * de cuidado, y muestra únicamente los espacios y acciones que el servidor le
 * confirma. No exige ser administradora institucional ni concede nada por
 * serlo: la administración no da acceso clínico y REVIEW_ALARMS no da
 * administración. No acepta parámetros de URL.
 *
 * Sin sesión ofrece la MISMA entrada humana que ya existe para Hospital; su
 * destino de vuelta es `/hospital` —no se amplía la lista cerrada del
 * servidor—, y desde ahí el enlace visible trae de nuevo aquí.
 */
export function CareHospitalEntry(): ReactNode {
  return (
    <main className={styles.pagina}>
      <nav aria-label="Navegación de Hospital">
        <Link href="/hospital">Volver a Hospital</Link>
      </nav>
      <CareWorkspace
        perfil="hospital"
        titulo="Revisión clínica de cuidado"
        encabezado="h1"
        accesoSinSesion={
          <>
            <p>
              Ingrese con su cuenta personal de {platformNameInSentence()}. Después de iniciar sesión volverá a Hospital;
              allí use el enlace «Revisión clínica de cuidado» para regresar a esta bandeja.
            </p>
            <a className={styles.primario} href={urlDeLoginAdministrador('hospital')}>
              Iniciar sesión
            </a>
          </>
        }
      />
      <p className={styles.ayuda}>
        Esta entrada no requiere ser administradora o administrador de la institución. Solo muestra lo que su cuenta
        tiene concedido para revisar; una cuenta sin concesión no ve datos de ningún paciente.
      </p>
    </main>
  );
}
