'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { getRecoveryStatus, resetAccessPassword, reconcileAccessPassword, startRecoveryReauthentication, type RecoveryResult, type RecoveryStatus } from './accessPasswordRecoveryClient';
import styles from './hospitalAccessRequests.module.css';

interface Props { requestId: string; version: number; fetchImpl?: typeof fetch; onChanged: () => Promise<void>; onSessionInvalid?: () => void }
const ERROR = {
  'session-required': 'La sesión terminó. Inicie sesión nuevamente.',
  reauthenticate: 'Verifique nuevamente su identidad antes de continuar.',
  forbidden: 'Solo el administrador institucional puede recuperar este acceso.',
  conflict: 'La cuenta cambió. Consulte el estado y revise la solicitud.',
  invalid: 'Revise la referencia de soporte, la identidad verificada y las contraseñas.',
  unavailable: 'No se pudo confirmar el resultado. Consulte el estado antes de volver a actuar.',
};
export function AccessPasswordRecovery({ requestId, version, fetchImpl = fetch, onChanged, onSessionInvalid }: Props) {
  const [state, setState] = useState<RecoveryStatus | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false); const [reference, setReference] = useState('');
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [unknown, setUnknown] = useState(false); const lock = useRef(false); const mounted = useRef(true);
  const invalidSession = useRef(onSessionInvalid);
  useEffect(() => { invalidSession.current = onSessionInvalid; }, [onSessionInvalid]);
  const fail = useCallback((result: Exclude<RecoveryResult<unknown>, { kind: 'ok' }>) => {
    setError(ERROR[result.kind]);
    if (result.kind === 'reauthenticate') setState(current => current === null ? null : { ...current, requiresReauthentication: true });
    if (result.kind === 'session-required') invalidSession.current?.();
  }, []);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    const result = await getRecoveryStatus(requestId, fetchImpl);
    if (mounted.current) {
      if (result.kind === 'ok') { setState(result.data); setUnknown(false); }
      else fail(result);
      setBusy(false);
    }
    lock.current = false;
  }, [requestId, fetchImpl, fail]);
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; }; }, [refresh]);
  const reauthenticate = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setPassword(''); setConfirmation('');
    const result = await startRecoveryReauthentication(fetchImpl);
    if (!mounted.current) return;
    if (result.kind === 'ok') window.location.assign(result.data.authorizationUrl);
    else { fail(result); lock.current = false; setBusy(false); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current || unknown || state === null || !state.canRecover || state.requiresReauthentication || state.operation?.state === 'UNCERTAIN') return;
    if (!verified || !/^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/u.test(reference) || password !== confirmation) {
      setError(ERROR.invalid); return;
    }
    lock.current = true; setBusy(true); setError(null);
    const input = { operationId: crypto.randomUUID(), expectedVersion: version, identityVerified: true as const,
      supportReference: reference, password, confirmPassword: confirmation, predecessorId: null };
    setPassword(''); setConfirmation(''); setVerified(false);
    const result = await resetAccessPassword(requestId, input, fetchImpl);
    if (!mounted.current) return;
    if (result.kind === 'ok') setState(current => current === null ? null : { ...current, operation: result.data, canRecover: false });
    else { fail(result); setUnknown(true); }
    await onChanged();
    if (mounted.current) { lock.current = false; setBusy(false); }
  };
  const reconcile = async () => {
    if (lock.current || !state?.canReconcile || state.requiresReauthentication || state.operation === null) return;
    lock.current = true; setBusy(true); setError(null);
    const result = await reconcileAccessPassword(requestId, state.operation.operationId, fetchImpl);
    if (!mounted.current) return;
    if (result.kind === 'ok') setState(current => current === null ? null : { ...current, operation: result.data, canReconcile: false, canRecover: false });
    else fail(result);
    lock.current = false; setBusy(false);
  };
  return <section className={styles.recovery} aria-labelledby="access-recovery-title">
    <h4 id="access-recovery-title">Recuperar acceso personal</h4>
    <p>Verifique la identidad de la persona y entregue la contraseña temporal por el canal acordado. Tendrá que cambiarla al iniciar sesión. Las sesiones anteriores se revocarán.</p>
    {error !== null && <p className={styles.error} role="alert">{error}</p>}
    <div role="status" aria-live="polite">
      {state?.operation?.state === 'SUCCEEDED' && <p>Restablecimiento confirmado. Se exige cambiar la contraseña temporal al iniciar sesión; el acceso sigue sujeto al estado vigente de la cuenta.</p>}
      {state?.operation?.state === 'PENDING' && <p>Operación pendiente. La cuenta permanece bloqueada; consulte el estado antes de actuar.</p>}
      {(state?.operation?.state === 'UNCERTAIN' || state?.operation?.state === 'SUPERSEDED') && <p>No se pudo confirmar el cambio. La cuenta sigue bloqueada y requiere conciliación del operador de identidad. Consultar el estado no la desbloquea.</p>}
    </div>
    <div className={styles.decisionActions}>
      <button type="button" disabled={busy} onClick={() => { void refresh().then(onChanged); }}>Consultar estado de recuperación</button>
      {state?.requiresReauthentication && <button type="button" disabled={busy} onClick={() => { void reauthenticate(); }}>Verificar mi identidad</button>}
      {state?.canReconcile && !state.requiresReauthentication && <button type="button" disabled={busy} onClick={() => { void reconcile(); }}>Registrar resultado incierto</button>}
    </div>
    {state !== null && !state.canRecover && state.operation === null && <p>Esta cuenta no cumple las condiciones para recuperación personal.</p>}
    {state?.canRecover && !state.requiresReauthentication && state.operation?.state !== 'UNCERTAIN' && state.operation?.state !== 'SUPERSEDED' && <form className={styles.recoveryForm} onSubmit={event => { void submit(event); }}>
      <label>Referencia de soporte<input value={reference} onChange={event => { setReference(event.target.value); }} required pattern="[A-Za-z0-9][A-Za-z0-9_-]{5,63}" maxLength={64} aria-describedby="recovery-reference-help" disabled={busy || unknown} /></label>
      <p id="recovery-reference-help">Código interno de 6 a 64 caracteres. Use letras, números, guion o guion bajo. No incluya documentos ni datos personales.</p>
      <label>Contraseña temporal<input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={event => { setPassword(event.target.value); }} disabled={busy || unknown} aria-describedby="recovery-password-help" /></label>
      <p id="recovery-password-help">De 8 a 72 caracteres, con letras y números.</p>
      <label>Confirmar contraseña temporal<input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmation} onChange={event => { setConfirmation(event.target.value); }} disabled={busy || unknown} /></label>
      <label className={styles.recoveryCheck}><input type="checkbox" checked={verified} onChange={event => { setVerified(event.target.checked); }} required disabled={busy || unknown} />Verifiqué la identidad de la persona mediante el procedimiento institucional.</label>
      <button type="submit" disabled={busy || unknown || !verified}>{busy ? 'Procesando recuperación…' : 'Restablecer y revocar sesiones'}</button>
    </form>}
  </section>;
}
