'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { urlDeLoginHumano } from './humanSessionClient';
import { institutionalAdministratorUrl, type InstitutionalExperience } from './institutionalAdministratorClient';
import styles from './institutionalAdministrator.module.css';

const DOCUMENT_TYPES = [['CEDULA_CIUDADANIA', 'Cédula de ciudadanía'], ['CEDULA_EXTRANJERIA', 'Cédula de extranjería'], ['PASAPORTE', 'Pasaporte'], ['PERMISO_PROTECCION_TEMPORAL', 'Permiso de protección temporal']] as const;
export function InstitutionalRegistration({ experience }: { readonly experience: InstitutionalExperience }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [institution, setInstitution] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState<string | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(institutionalAdministratorUrl(experience, 'registration'), { credentials: 'include', cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('unavailable');
      const body: unknown = await response.json();
      if (body === null || typeof body !== 'object' || !('available' in body) || typeof body.available !== 'boolean' || !('institution' in body) || body.institution === null || typeof body.institution !== 'object' || !('name' in body.institution) || typeof body.institution.name !== 'string') throw new Error('invalid');
      setAvailable(body.available); setInstitution(body.institution.name);
      if ('completed' in body && body.completed === true && 'username' in body && typeof body.username === 'string') {
        setUsername(body.username); setMessage('Registro completado. Inicie sesión con su usuario y la contraseña inicial.');
      }
    }).catch(() => { if (!controller.signal.aborted) setMessage('No se puede comprobar el registro. Reintente más tarde.'); });
    return () => controller.abort();
  }, [experience]);
  const notify = (text: string) => { setMessage(text); queueMicrotask(() => status.current?.focus()); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (data.password !== data.confirmPassword) { notify('Las contraseñas deben coincidir.'); return; }
    setBusy(true); setMessage('');
    try {
      const attempt = await fetch(institutionalAdministratorUrl(experience, 'registration-attempt'), { method: 'POST', credentials: 'include', cache: 'no-store' });
      if (attempt.status !== 204) throw new Error('attempt');
      const response = await fetch(institutionalAdministratorUrl(experience, 'registration'), { method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json() as { code?: unknown; completed?: unknown; username?: unknown };
      if (response.ok && result.completed === true && typeof result.username === 'string') {
        setUsername(result.username); setAvailable(false); form.reset(); notify('Registro completado. Guarde su usuario e inicie sesión con su contraseña.');
      } else if (result.code === 'INSTITUTIONAL_REGISTRATION_CLOSED') { setAvailable(false); notify('El registro de administrador ya está cerrado.'); }
      else if (result.code === 'INSTITUTIONAL_REGISTRATION_INTENT_MISMATCH') notify('Reintente con los mismos datos del registro inicial.');
      else if (result.code === 'INSTITUTIONAL_REGISTRATION_EXISTING_ACCOUNT') notify('No se puede completar esta alta. Inicie sesión con su cuenta existente y utilice la opción para el primer administrador.');
      else notify(response.status === 400 ? 'Revise los datos y la contraseña: de 8 a 72 caracteres, con letra y número.' : 'El registro no se ha completado. Reintente en este navegador con la contraseña inicial.');
    } catch { notify('No se pudo confirmar el registro. Reintente desde este navegador con la contraseña inicial.'); }
    finally { setBusy(false); }
  };
  const claim = async () => {
    setBusy(true);
    try {
      const response = await fetch(institutionalAdministratorUrl(experience, 'claim'), { method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (response.ok) { setAvailable(false); notify('Su cuenta es ahora la administradora de esta institución. Puede ingresar.'); }
      else notify(response.status === 401 ? 'Primero inicie sesión con su cuenta existente.' : response.status === 409 ? 'El registro inicial ya está cerrado.' : 'No se pudo completar la solicitud. Reintente más tarde.');
    } catch { notify('No se pudo confirmar la solicitud.'); } finally { setBusy(false); }
  };
  return <main className={styles.page}><section className={styles.card} aria-labelledby="registration-title">
    <Link href="/">← Portal de servicios</Link>
    <h1 id="registration-title">Primer administrador de {experience === 'hospital' ? 'Hospital' : 'Alcaldía'}</h1>
    {institution ? <p>Institución: <strong>{institution}</strong></p> : null}
    <p ref={status} tabIndex={-1} role={message ? 'status' : undefined}>{message}</p>
    {username !== null ? <p>Usuario para ingresar: <strong className={styles.username}>{username}</strong></p> : null}
    {available === null && !message ? <p role="status">Comprobando disponibilidad…</p> : null}
    {available === false && username === null ? <p>El registro inicial está cerrado. Solo su administrador puede ingresar.</p> : null}
    {available === true ? <><p>Este registro se cierra después de la primera cuenta. Los datos son declarados por el responsable.</p>
      <form onSubmit={event => { void submit(event); }} className={styles.form}>
        <label>Tipo de documento<select name="documentType" required>{DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Número de documento<input name="documentNumber" required maxLength={32} autoComplete="off" /></label>
        <label>Nombres<input name="givenNames" required maxLength={120} autoComplete="given-name" /></label>
        <label>Apellidos<input name="familyNames" required maxLength={120} autoComplete="family-name" /></label>
        <label>Fecha de nacimiento<input name="birthDate" type="date" required autoComplete="bday" max={new Date().toISOString().slice(0, 10)} /></label>
        <label>Sexo/género<select name="sexGenderCode" required><option value="">Seleccione</option><option value="FEMENINO">Femenino</option><option value="MASCULINO">Masculino</option><option value="OTRO">Otro</option><option value="PREFIERE_NO_DECIRLO">Prefiero no declarar</option></select></label>
        <label>Correo de contacto<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
        <label>Contraseña<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
        <label>Confirmar contraseña<input name="confirmPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
        <p>La contraseña requiere al menos una letra y un número. Conserve la contraseña inicial si necesita reintentar.</p>
        <button type="submit" disabled={busy}>{busy ? 'Registrando…' : 'Crear primer administrador'}</button>
      </form>
      <button type="button" disabled={busy} onClick={() => { void claim(); }}>Usar mi cuenta actual como primer administrador</button>
    </> : null}
    <a className={styles.primary} href={urlDeLoginHumano()}>Iniciar sesión</a>
    <Link href={`/${experience}`}>Volver a {experience === 'hospital' ? 'Hospital' : 'Alcaldía'}</Link>
  </section></main>;
}
