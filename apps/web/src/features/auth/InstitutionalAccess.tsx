'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { urlDeLoginHumano } from './humanSessionClient';
import { institutionalAdministratorUrl, type InstitutionalExperience } from './institutionalAdministratorClient';
import styles from './institutionalAdministrator.module.css';

export function InstitutionalAccess({ experience }: { readonly experience: InstitutionalExperience }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(institutionalAdministratorUrl(experience, 'registration'), { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (response.ok) { const body = await response.json() as { available?: unknown }; if (typeof body.available === 'boolean') setAvailable(body.available); } })
      .catch(() => undefined);
    return () => controller.abort();
  }, [experience]);
  return <section className={styles.card} aria-labelledby={`access-${experience}`}>
    <h1 id={`access-${experience}`}>{experience === 'hospital' ? 'Acceso al Hospital' : 'Acceso a la Alcaldía'}</h1>
    <p>Ingrese con la cuenta del administrador de su institución.</p>
    <a className={styles.primary} href={urlDeLoginHumano()}>Iniciar sesión</a>
    {available === true ? <Link href={`/${experience}/registro`}>Registrar primer administrador</Link> : null}
    {available === false ? <p>El registro inicial ya está cerrado.</p> : null}
    <Link href="/">Volver al portal</Link>
  </section>;
}
