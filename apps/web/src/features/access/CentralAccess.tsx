'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { branding } from '@/config/branding';
import styles from './centralAccess.module.css';

type InstitutionalDestination = 'hospital' | 'alcaldia';

function destinationFrom(value: string | null): InstitutionalDestination | null {
  return value === 'hospital' || value === 'alcaldia' ? value : null;
}

function destinationLabel(destination: InstitutionalDestination | null): string {
  if (destination === 'hospital') return 'Hospital';
  if (destination === 'alcaldia') return 'Alcaldía';
  return 'la plataforma';
}

/**
 * Entrada común de la demostración local de MERDN. Todos sus datos son
 * ficticios y viven únicamente en la interfaz: no llama APIs, no crea cookies,
 * no guarda solicitudes y no representa autenticación o autorización real.
 * La URL `destino` solo elige qué canvas demostrativo abrir.
 */
export function CentralAccess(): ReactNode {
  const search = useSearchParams();
  const destination = destinationFrom(search.get('destino'));
  const registration = search.get('accion') === 'registro';
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  if (registration) {
    return (
      <main className={styles.page}>
        <section className={styles.card} aria-labelledby="solicitud-title">
          <Link className={styles.back} href="/">← Volver al Portal Central</Link>
          <div className={styles.brand}>
            <Image src="/brand/corazon-check.png" alt={`Símbolo de ${branding.platformDisplayName}`} width={42} height={42} />
            <div><strong>{branding.platformDisplayName}</strong><span>Solicitud de acceso</span></div>
          </div>
          <h1 id="solicitud-title">Registre su solicitud, no una sesión</h1>
          <p>
            Pacientes, cuidadores y personal de terreno solicitan acceso primero. El Hospital valida y aprueba
            la solicitud antes de habilitar cualquier espacio de trabajo.
          </p>
          <div className={styles.roleGrid}>
            {['Paciente', 'Cuidador', 'Personal de terreno'].map((profile) => (
              <button className={styles.roleCard} type="button" key={profile} onClick={() => setSelectedRequest(profile)}>
                <strong>{profile}</strong>
                <span>{profile === 'Paciente' ? 'Solicitud ficticia de atención y acceso personal.' : 'Solicitud ficticia pendiente de validación del Hospital.'}</span>
              </button>
            ))}
          </div>
          {selectedRequest !== null ? (
            <p className={styles.demoConfirmation} role="status">
              Solicitud ficticia de {selectedRequest.toLowerCase()} creada solo para la demostración. No se envió ni se guardó ningún dato.
            </p>
          ) : null}
          <aside className={styles.note}>
            En producción, una solicitud no concederá acceso hasta la revisión institucional. Esta pantalla no representa un registro real.
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="central-access-title">
        <Link className={styles.back} href="/">← Volver al Portal Central</Link>
        <div className={styles.brand}>
          <Image src="/brand/corazon-check.png" alt={`Símbolo de ${branding.platformDisplayName}`} width={42} height={42} />
          <div><strong>{branding.platformDisplayName}</strong><span>Portal central de acceso</span></div>
        </div>
        <h1 id="central-access-title">Iniciar sesión</h1>
        <p className={styles.lead}>
          {destination === null
            ? 'Elija cómo desea ingresar. Cada espacio confirma su autorización antes de mostrar información.'
            : `Acceso solicitado para ${destinationLabel(destination)}. La autorización se comprueba antes de abrir el panel.`}
        </p>

        {destination !== null ? (
          <section className={styles.form} aria-labelledby="institutional-demo-title">
            <h2 id="institutional-demo-title">Demostración de empleados institucionales</h2>
            <p>En el producto, Hospital y Alcaldía entregarán el acceso a sus empleados. Para esta presentación no se piden ni se crean credenciales.</p>
            <Link className={styles.primary} href={destination === 'hospital' ? '/hospital' : '/municipality'}>
              Abrir demostración de {destinationLabel(destination)}
            </Link>
          </section>
        ) : (
          <div className={styles.choices}>
            <Link className={styles.roleCard} href="/acceso?destino=hospital"><strong>Empleado de Hospital</strong><span>Use la credencial entregada por su institución.</span></Link>
            <Link className={styles.roleCard} href="/acceso?destino=alcaldia"><strong>Empleado de Alcaldía</strong><span>Use la credencial entregada por su institución.</span></Link>
          </div>
        )}

        <section className={styles.human} aria-labelledby="human-access-title">
          <h2 id="human-access-title">Pacientes, cuidadores y personal de terreno</h2>
          <p>En esta etapa las identidades son ficticias. Los portales se abren únicamente como muestras visuales aisladas.</p>
          <Link className={styles.secondary} href="/cuidador">Abrir muestra de cuidador</Link>
          <Link className={styles.secondary} href="/profesional">Abrir muestra de personal de terreno</Link>
          <Link className={styles.textLink} href="/acceso?accion=registro">Registrarme / solicitar acceso</Link>
        </section>
      </section>
    </main>
  );
}
