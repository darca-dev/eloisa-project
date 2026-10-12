'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { institutionalAdministratorUrl, type InstitutionalExperience } from './institutionalAdministratorClient';

/** The server remains authoritative; the portal hides a closed registration. */
export function InstitutionalRegistrationLink({ experience, className }: {
  readonly experience: InstitutionalExperience;
  readonly className?: string;
}) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(institutionalAdministratorUrl(experience, 'registration'), {
      credentials: 'include', cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) return;
      const body: unknown = await response.json();
      if (!controller.signal.aborted && body !== null && typeof body === 'object' && 'available' in body) {
        setAvailable(body.available === true);
      }
    }).catch(() => undefined);
    return () => controller.abort();
  }, [experience]);
  return available ? <Link href={`/${experience}/registro`} className={className}>Registrar primer administrador</Link> : null;
}
