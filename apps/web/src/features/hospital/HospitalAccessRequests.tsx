'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import styles from './hospitalAccessRequests.module.css';
import {
  APOYOS_OPCIONES,
  CONDICIONES_OPCIONES,
  EPS_PACIENTE_OPCIONES,
  EPS_VISITADOR_OPCIONES,
  HORARIOS_OPCIONES,
  INSTITUCION_FORMACION_OPCIONES,
  NECESITA_APOYO_OPCIONES,
  PACIENTE_REGISTRADO_OPCIONES,
  PROFESION_OPCIONES,
  RELACION_PACIENTE_OPCIONES,
  TIPO_CUIDADOR_OPCIONES,
  TIPOS_ATENCION_OPCIONES,
  VECINO_RELACION_OPCIONES,
  ZONAS_COBERTURA_OPCIONES,
  ZONA_OPCIONES,
  etiquetaDe,
  type CatalogOption,
} from '@/features/access/accessRegistrationProfileData';
import {
  ACCESS_PROVISIONING_MAX_ATTEMPTS,
  ACCESS_REQUEST_LIST_FILTER_STATUSES,
  ACCESS_REQUEST_PROFILES,
  decideHospitalAccessRequest,
  getHospitalAccessRequest,
  listHospitalAccessRequests,
  validActionsFor,
  type AccessRequestAction,
  type AccessRequestClientFailure,
  type AccessRequestDetail,
  type AccessRequestListFilterStatus,
  type AccessRequestListFilters,
  type AccessRequestListItem,
  type AccessRequestProfile,
  type AccessRequestProvisioningStatus,
  type AccessRequestStatus,
} from './hospitalAccessRequestsClient';

const PROFILE_LABEL: Record<AccessRequestProfile, string> = {
  PATIENT: 'Paciente',
  CAREGIVER: 'Cuidador',
  FIELD_PROFESSIONAL: 'Visitador médico',
};

/**
 * Estados en español, para las columnas. CERRADO: la tabla pinta el estado que
 * el servidor devolvió, no la constante «Pendiente» que la bandeja anterior
 * escribía sin mirar la fila.
 */
const STATUS_LABEL: Record<AccessRequestStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED_PENDING_PROVISIONING: 'Aprobada — creando acceso',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  PROVISIONING_FAILED: 'Provisión fallida',
  SUSPENDED: 'Suspendida',
  REVOKED: 'Revocada',
};

const FILTER_STATUS_LABEL: Record<AccessRequestListFilterStatus, string> = {
  PENDING: 'Solo pendientes',
};

/** Etiqueta del estado de la creación de acceso. CERRADO. */
const PROVISIONING_LABEL: Record<AccessRequestProvisioningStatus, string> = {
  NOT_STARTED: 'Sin iniciar',
  PENDING: 'En curso',
  SUCCEEDED: 'Confirmada',
  FAILED: 'Fallida',
};

/** Etiqueta de cada acción. Catálogo CERRADO, en español. */
const ACTION_LABEL: Record<AccessRequestAction, string> = {
  APPROVE: 'Aprobar',
  REJECT: 'Rechazar',
  RETRY_PROVISIONING: 'Reintentar provisión',
  SUSPEND: 'Suspender',
  REACTIVATE: 'Reactivar',
  REVOKE: 'Revocar',
};

/** Título del paso de confirmación, por acción. */
const ACTION_CONFIRM_TITLE: Record<AccessRequestAction, string> = {
  APPROVE: 'Confirmar aprobación',
  REJECT: 'Confirmar rechazo',
  RETRY_PROVISIONING: 'Confirmar reintento de provisión',
  SUSPEND: 'Confirmar suspensión',
  REACTIVATE: 'Confirmar reactivación',
  REVOKE: 'Confirmar revocación',
};

/**
 * Qué le va a pasar a la cuenta, por acción.
 *
 * Cada texto nombra el EFECTO técnico y nada sobre la persona ni sobre su
 * situación: es lo que el revisor debe saber antes de confirmar, y el mismo
 * criterio que motivó el catálogo cerrado de motivos en el servidor.
 */
const ACTION_CONFIRM_TEXT: Record<AccessRequestAction, string> = {
  APPROVE:
    'La solicitud quedará pendiente de creación de acceso y se ejecutará la provisión; la persona podrá iniciar sesión solo si esa provisión confirma.',
  REJECT:
    'La solicitud quedará rechazada y no continuará a creación de acceso.',
  RETRY_PROVISIONING:
    'Se ejecutará de nuevo la provisión sobre esta misma solicitud con su contador de intentos.',
  SUSPEND:
    'La cuenta humana quedará deshabilitada y sus sesiones revocadas de inmediato; la solicitud quedará suspendida.',
  REACTIVATE:
    'La solicitud volverá a provisión y la cuenta se reactivará solo si esa provisión confirma.',
  REVOKE:
    'La cuenta humana quedará deshabilitada, sus sesiones revocadas y el vínculo externo desvinculado. Esta acción es terminal.',
};

/** Anuncio tras una decisión aplicada, por acción. */
const ACTION_ANNOUNCEMENT: Record<AccessRequestAction, (reference: string) => string> = {
  APPROVE: (reference) =>
    `Solicitud ${reference} aprobada y pendiente de creación de acceso.`,
  REJECT: (reference) => `Solicitud ${reference} rechazada.`,
  RETRY_PROVISIONING: (reference) =>
    `Reintento de provisión lanzado para la solicitud ${reference}.`,
  SUSPEND: (reference) => `Solicitud ${reference} suspendida; la cuenta quedó deshabilitada.`,
  REACTIVATE: (reference) =>
    `Solicitud ${reference} reactivada y pendiente de creación de acceso.`,
  REVOKE: (reference) => `Solicitud ${reference} revocada; la cuenta quedó deshabilitada.`,
};

/**
 * Expediente ficticio por secciones (SPEC 038, MP04-C3).
 *
 * Cada rama declara sus secciones con las etiquetas visibles del flujo. Los
 * valores se muestran TRADUCIDOS por catálogo y nunca como JSON crudo: un
 * código sin traducir sería un dato sin contexto para quien revisa. Lo
 * ausente se lee como «Sin indicar», nunca como cadena vacía.
 */
interface ExpedienteFila {
  readonly clave: string;
  readonly etiqueta: string;
  readonly catalogo?: readonly CatalogOption[];
}

interface ExpedienteSeccion {
  readonly titulo: string;
  readonly filas: readonly ExpedienteFila[];
}

const SI_NO_ETIQUETA: Readonly<Record<string, string>> = {
  SI: 'Sí',
  NO: 'No',
  NO_SABE: 'No sabe',
};

const EXPEDIENTE_SECCIONES: Record<AccessRequestProfile, readonly ExpedienteSeccion[]> = {
  PATIENT: [
    {
      titulo: 'Condición y necesidades declaradas',
      filas: [
        { clave: 'necesitaApoyo', etiqueta: 'Necesita apoyo', catalogo: NECESITA_APOYO_OPCIONES },
        { clave: 'apoyos', etiqueta: 'Apoyos', catalogo: APOYOS_OPCIONES },
        { clave: 'condiciones', etiqueta: 'Condiciones', catalogo: CONDICIONES_OPCIONES },
      ],
    },
    {
      titulo: 'Ubicación y EPS declaradas',
      filas: [
        { clave: 'zona', etiqueta: 'Zona', catalogo: ZONA_OPCIONES },
        { clave: 'eps', etiqueta: 'EPS', catalogo: EPS_PACIENTE_OPCIONES },
        { clave: 'direccion', etiqueta: 'Dirección' },
      ],
    },
    {
      titulo: 'Contactos declarados',
      filas: [
        { clave: 'contactoNombre', etiqueta: 'Contacto familiar' },
        { clave: 'contactoParentesco', etiqueta: 'Parentesco' },
        { clave: 'contactoTelefono', etiqueta: 'Teléfono familiar' },
        { clave: 'vecinoNombre', etiqueta: 'Contacto cercano' },
        { clave: 'vecinoTelefono', etiqueta: 'Teléfono cercano' },
      ],
    },
    {
      titulo: 'Consentimientos registrados',
      filas: [
        { clave: 'vecinoAutorizado', etiqueta: 'Autorización del contacto' },
        { clave: 'autorizaDatos', etiqueta: 'Tratamiento de datos' },
      ],
    },
  ],
  CAREGIVER: [
    {
      titulo: 'Perfil del cuidador declarado',
      filas: [
        { clave: 'tipoCuidador', etiqueta: 'Tipo', catalogo: TIPO_CUIDADOR_OPCIONES },
        { clave: 'tieneFormacion', etiqueta: 'Formación' },
        { clave: 'institucionFormacion', etiqueta: 'Institución', catalogo: INSTITUCION_FORMACION_OPCIONES },
        { clave: 'viveConPaciente', etiqueta: 'Vive con el paciente' },
        { clave: 'horarios', etiqueta: 'Horarios', catalogo: HORARIOS_OPCIONES },
      ],
    },
    {
      titulo: 'Paciente declarado',
      filas: [
        { clave: 'pacienteRegistrado', etiqueta: 'Registrado', catalogo: PACIENTE_REGISTRADO_OPCIONES },
        { clave: 'relacionPaciente', etiqueta: 'Relación', catalogo: RELACION_PACIENTE_OPCIONES },
      ],
    },
    {
      titulo: 'Contacto cercano declarado',
      filas: [
        { clave: 'vecinoNombre', etiqueta: 'Nombre' },
        { clave: 'vecinoTelefono', etiqueta: 'Teléfono' },
        { clave: 'vecinoRelacion', etiqueta: 'Relación', catalogo: VECINO_RELACION_OPCIONES },
        { clave: 'vecinoDireccion', etiqueta: 'Dirección o referencia' },
      ],
    },
    {
      titulo: 'Consentimientos registrados',
      filas: [
        { clave: 'vecinoAutorizado', etiqueta: 'Autorización del contacto' },
        { clave: 'autorizaDatos', etiqueta: 'Tratamiento de datos' },
      ],
    },
  ],
  FIELD_PROFESSIONAL: [
    {
      titulo: 'Información profesional declarada',
      filas: [
        { clave: 'profesion', etiqueta: 'Profesión', catalogo: PROFESION_OPCIONES },
        { clave: 'tiposAtencion', etiqueta: 'Atención', catalogo: TIPOS_ATENCION_OPCIONES },
      ],
    },
    {
      titulo: 'EPS e institución declaradas',
      filas: [
        { clave: 'eps', etiqueta: 'EPS', catalogo: EPS_VISITADOR_OPCIONES },
        { clave: 'otraEps', etiqueta: 'Otra EPS' },
        { clave: 'institucion', etiqueta: 'Institución' },
        { clave: 'institucionDepartamento', etiqueta: 'Departamento' },
        { clave: 'institucionMunicipio', etiqueta: 'Municipio' },
        { clave: 'cargo', etiqueta: 'Cargo' },
      ],
    },
    {
      titulo: 'Zona de atención declarada',
      filas: [
        { clave: 'zonaDepartamento', etiqueta: 'Departamento' },
        { clave: 'zonaMunicipio', etiqueta: 'Municipio principal' },
        { clave: 'zonas', etiqueta: 'Cobertura', catalogo: ZONAS_COBERTURA_OPCIONES },
        { clave: 'sector', etiqueta: 'Sector' },
      ],
    },
    {
      titulo: 'Consentimientos registrados',
      filas: [{ clave: 'autorizaDatos', etiqueta: 'Tratamiento de datos' }],
    },
  ],
};

function valorExpediente(
  registro: Record<string, unknown>,
  fila: ExpedienteFila,
): string {
  const crudo = registro[fila.clave];

  if (typeof crudo === 'boolean') {
    return crudo ? 'Sí' : 'No';
  }

  if (Array.isArray(crudo)) {
    if (crudo.length === 0) {
      return 'Ninguno';
    }

    return crudo
      .map((item) =>
        typeof item === 'string' && fila.catalogo !== undefined
          ? etiquetaDe(fila.catalogo, item)
          : String(item),
      )
      .join(' · ');
  }

  if (typeof crudo === 'string') {
    if (crudo === '') {
      return 'Sin indicar';
    }

    if (fila.catalogo !== undefined) {
      return etiquetaDe(fila.catalogo, crudo);
    }

    if (crudo === 'SI' || crudo === 'NO' || crudo === 'NO_SABE') {
      return SI_NO_ETIQUETA[crudo] ?? crudo;
    }

    return crudo;
  }

  return 'Sin indicar';
}

const EMPTY_FILTERS: AccessRequestListFilters = {};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function failureMessage(kind: AccessRequestClientFailure): string {
  switch (kind) {
    case 'invalid-request':
      return 'Revise los filtros e inténtelo nuevamente.';
    case 'session-required':
      return 'La sesión institucional terminó. Ingrese nuevamente.';
    case 'forbidden':
      return 'Esta sesión no tiene permiso para revisar solicitudes de acceso.';
    case 'not-found':
      return 'La solicitud ya no está disponible.';
    case 'conflict':
      return 'Otra revisión cambió esta solicitud. La bandeja se actualizará.';
    case 'cancelled':
      return '';
    case 'unavailable':
    default:
      return 'No fue posible consultar las solicitudes. Puede intentarlo nuevamente.';
  }
}

export function HospitalAccessRequests({
  fetchImpl = fetch,
  onSessionInvalid,
}: {
  readonly fetchImpl?: typeof fetch;
  readonly onSessionInvalid?: () => void;
}): ReactNode {
  const [items, setItems] = useState<readonly AccessRequestListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [queryDraft, setQueryDraft] = useState('');
  const [profileDraft, setProfileDraft] = useState<AccessRequestProfile | ''>('');
  const [statusDraft, setStatusDraft] = useState<AccessRequestListFilterStatus | ''>('');
  const [appliedFilters, setAppliedFilters] = useState<AccessRequestListFilters>(EMPTY_FILTERS);
  const [detail, setDetail] = useState<AccessRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<AccessRequestAction | null>(null);
  const [deciding, setDeciding] = useState(false);

  const listSequence = useRef(0);
  const detailSequence = useRef(0);
  const listAbort = useRef<AbortController | null>(null);
  const detailAbort = useRef<AbortController | null>(null);
  const decisionAbort = useRef<AbortController | null>(null);
  const decisionLock = useRef(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const sessionInvalid = useRef(onSessionInvalid);
  const appliedRef = useRef<AccessRequestListFilters>(EMPTY_FILTERS);

  useEffect(() => {
    sessionInvalid.current = onSessionInvalid;
  }, [onSessionInvalid]);

  const clearSensitiveState = useCallback((): void => {
    setItems([]);
    setNextCursor(null);
    setDetail(null);
    setConfirmation(null);
  }, []);

  const handleFailure = useCallback((kind: AccessRequestClientFailure): void => {
    if (kind === 'cancelled') return;
    if (kind === 'session-required' || kind === 'forbidden') clearSensitiveState();
    setError(failureMessage(kind));
    if (kind === 'session-required') sessionInvalid.current?.();
  }, [clearSensitiveState]);

  const load = useCallback(async (
    filters: AccessRequestListFilters,
    append: boolean,
  ): Promise<void> => {
    listAbort.current?.abort();
    const controller = new AbortController();
    listAbort.current = controller;
    const sequence = ++listSequence.current;

    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
      appliedRef.current = filters;
      setAppliedFilters(filters);
    }

    const result = await listHospitalAccessRequests(filters, fetchImpl, controller.signal);
    if (sequence !== listSequence.current || controller.signal.aborted) return;

    setLoading(false);
    setLoadingMore(false);
    if (result.kind !== 'ok') {
      handleFailure(result.kind);
      return;
    }

    setError(null);
    setNextCursor(result.data.nextCursor);
    setItems((current) => {
      if (!append) return result.data.items;
      const seen = new Set(current.map((item) => item.requestId));
      return [...current, ...result.data.items.filter((item) => !seen.has(item.requestId))];
    });
  }, [fetchImpl, handleFailure]);

  useEffect(() => {
    void load(EMPTY_FILTERS, false);
    return () => {
      listAbort.current?.abort();
      detailAbort.current?.abort();
      decisionAbort.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    if (detail !== null) closeButton.current?.focus();
  }, [detail]);

  const closeDetail = useCallback((): void => {
    detailAbort.current?.abort();
    setDetail(null);
    setDetailError(null);
    setConfirmation(null);
    queueMicrotask(() => opener.current?.focus());
  }, []);

  useEffect(() => {
    if (detail === null && !detailLoading) return undefined;
    const escape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (confirmation !== null) setConfirmation(null);
      else closeDetail();
    };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); };
  }, [closeDetail, confirmation, detail, detailLoading]);

  const openDetail = async (item: AccessRequestListItem, button: HTMLButtonElement): Promise<void> => {
    opener.current = button;
    detailAbort.current?.abort();
    const controller = new AbortController();
    detailAbort.current = controller;
    const sequence = ++detailSequence.current;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setConfirmation(null);

    const result = await getHospitalAccessRequest(item.requestId, fetchImpl, controller.signal);
    if (sequence !== detailSequence.current || controller.signal.aborted) return;
    setDetailLoading(false);
    if (result.kind === 'ok') {
      setDetail(result.data);
      return;
    }
    if (result.kind === 'session-required') {
      clearSensitiveState();
      sessionInvalid.current?.();
    }
    setDetailError(failureMessage(result.kind));
  };

  const decide = async (action: AccessRequestAction): Promise<void> => {
    if (detail === null || decisionLock.current) return;
    decisionLock.current = true;
    setDeciding(true);
    decisionAbort.current?.abort();
    const controller = new AbortController();
    decisionAbort.current = controller;
    const result = await decideHospitalAccessRequest(
      detail.requestId,
      action,
      detail.version,
      fetchImpl,
      controller.signal,
    );
    decisionLock.current = false;
    setDeciding(false);
    if (controller.signal.aborted || result.kind === 'cancelled') return;

    if (result.kind === 'ok') {
      setAnnouncement(ACTION_ANNOUNCEMENT[action](result.data.reference));
      closeDetail();
      await load(appliedRef.current, false);
      return;
    }

    if (result.kind === 'conflict') {
      setAnnouncement(failureMessage(result.kind));
      closeDetail();
      await load(appliedRef.current, false);
      return;
    }

    if (result.kind === 'session-required') {
      clearSensitiveState();
      sessionInvalid.current?.();
    }
    if (result.kind === 'forbidden') clearSensitiveState();
    setDetailError(failureMessage(result.kind));
    setConfirmation(null);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const filters: AccessRequestListFilters = {
      ...(queryDraft.trim() === '' ? {} : { q: queryDraft.trim() }),
      ...(profileDraft === '' ? {} : { profile: profileDraft }),
      ...(statusDraft === '' ? {} : { status: statusDraft }),
    };
    closeDetail();
    void load(filters, false);
  };

  return (
    <section className={styles.section} aria-labelledby="access-requests-title">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Administración institucional</p>
          <h2 id="access-requests-title">Solicitudes de acceso</h2>
          <p>Revise solicitudes persistentes de Pacientes, Cuidadores y Visitadores médicos.</p>
        </div>
        <span className={styles.count}>{items.length} solicitudes visibles</span>
      </header>

      <p className={styles.notice}>
        <strong>Revisión institucional.</strong> Cada acción exige confirmación y la
        versión vigente de la solicitud. La aprobación ejecuta la creación de acceso y
        solo esa creación confirmada permite iniciar sesión.
      </p>

      <form className={styles.filters} onSubmit={submitSearch}>
        <label>
          <span>Buscar por referencia, nombre o documento</span>
          <input
            type="search"
            value={queryDraft}
            maxLength={80}
            onChange={(event) => { setQueryDraft(event.target.value); }}
          />
        </label>
        <label>
          <span>Perfil solicitado</span>
          <select
            value={profileDraft}
            onChange={(event) => { setProfileDraft(event.target.value as AccessRequestProfile | ''); }}
          >
            <option value="">Todos los perfiles</option>
            {ACCESS_REQUEST_PROFILES.map((profile) => (
              <option key={profile} value={profile}>{PROFILE_LABEL[profile]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select
            value={statusDraft}
            onChange={(event) => { setStatusDraft(event.target.value as AccessRequestListFilterStatus | ''); }}
          >
            <option value="">Todos los estados</option>
            {ACCESS_REQUEST_LIST_FILTER_STATUSES.map((value) => (
              <option key={value} value={value}>{FILTER_STATUS_LABEL[value]}</option>
            ))}
          </select>
        </label>
        <div className={styles.filterActions}>
          <button type="submit" disabled={loading}>Buscar</button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setQueryDraft('');
              setProfileDraft('');
              setStatusDraft('');
              closeDetail();
              void load(EMPTY_FILTERS, false);
            }}
          >
            Limpiar
          </button>
          <button type="button" disabled={loading} onClick={() => { void load(appliedFilters, false); }}>
            Recargar
          </button>
        </div>
      </form>

      <p className={styles.live} aria-live="polite" role="status">{announcement}</p>
      {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
      {loading ? <p className={styles.state} role="status">Cargando solicitudes…</p> : null}

      {!loading && error === null && items.length === 0 ? (
        <p className={styles.state}>No hay solicitudes para estos filtros.</p>
      ) : null}

      {items.length > 0 ? (
        <div className={styles.tableWrap}>
          <table>
            <caption>Solicitudes del Hospital</caption>
            <thead>
              <tr><th scope="col">Solicitud</th><th scope="col">Perfil</th><th scope="col">Recibida</th><th scope="col">Estado</th><th scope="col">Acción</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.requestId}>
                  <td data-label="Solicitud"><strong>{`${item.givenNames} ${item.familyNames}`}</strong><span>{item.reference}</span></td>
                  <td data-label="Perfil">{PROFILE_LABEL[item.requestedProfile]}</td>
                  <td data-label="Recibida">{formatDate(item.submittedAt)}</td>
                  <td data-label="Estado"><span className={styles.status}>{STATUS_LABEL[item.status]}</span></td>
                  <td data-label="Acción">
                    <button
                      type="button"
                      onClick={(event) => { void openDetail(item, event.currentTarget); }}
                      aria-label={`Revisar ${item.reference}`}
                    >
                      Revisar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {nextCursor === null ? null : (
        <button
          className={styles.loadMore}
          type="button"
          disabled={loadingMore}
          onClick={() => { void load({ ...appliedRef.current, cursor: nextCursor }, true); }}
        >
          {loadingMore ? 'Cargando más…' : 'Cargar más'}
        </button>
      )}

      {detailLoading ? <p className={styles.state} role="status">Cargando detalle…</p> : null}
      {detailError === null ? null : <p className={styles.error} role="alert">{detailError}</p>}

      {detail === null ? null : (
        <aside className={styles.detail} role="region" aria-labelledby="access-request-detail-title">
          <div className={styles.detailHeading}>
            <div><p className={styles.eyebrow}>{detail.reference}</p><h3 id="access-request-detail-title">{`${detail.givenNames} ${detail.familyNames}`}</h3></div>
            <button ref={closeButton} type="button" onClick={closeDetail}>Cerrar detalle</button>
          </div>
          <h4 className={styles.expedienteSubtitulo} id="access-request-datos-title">Datos personales</h4>
          <dl className={styles.detailGrid} aria-labelledby="access-request-datos-title">
            <div><dt>Perfil</dt><dd>{PROFILE_LABEL[detail.requestedProfile]}</dd></div>
            <div><dt>Estado</dt><dd>{STATUS_LABEL[detail.status]}</dd></div>
            <div><dt>Documento</dt><dd>{`${detail.documentType}: ${detail.documentNumber}`}</dd></div>
            <div><dt>Fecha de nacimiento</dt><dd>{detail.birthDate}</dd></div>
            <div><dt>Sexo o género declarado</dt><dd>{detail.sexGenderCode}</dd></div>
            <div><dt>Teléfono</dt><dd>{detail.phone ?? 'No proporcionado'}</dd></div>
            <div><dt>Correo</dt><dd>{detail.email ?? 'No proporcionado'}</dd></div>
            <div><dt>Creación de acceso</dt><dd>{PROVISIONING_LABEL[detail.provisioningStatus]}</dd></div>
            <div><dt>Intentos de creación</dt>
              <dd>{`${String(detail.provisioningAttempts)} de ${String(ACCESS_PROVISIONING_MAX_ATTEMPTS)}`}</dd>
            </div>
            <div><dt>Código de fallo</dt>
              <dd>{detail.provisioningErrorCode ?? 'Sin fallo registrado'}</dd>
            </div>
            <div><dt>Decidida</dt><dd>{detail.decidedAt === null ? 'Sin decisión' : formatDate(detail.decidedAt)}</dd></div>
            <div><dt>Motivo de la decisión</dt><dd>{detail.decisionReasonCode ?? 'Sin motivo'}</dd></div>
          </dl>

          {detail.registrationSchemaVersion === null || detail.registration === null ? (
            <p className={styles.state}>
              Sin expediente: solicitud registrada antes del flujo guiado.
            </p>
          ) : (
            <section className={styles.expediente} aria-label="Expediente de solicitud">
              <h4 className={styles.expedienteTitulo}>
                {`Expediente de solicitud · versión ${String(detail.registrationSchemaVersion)}`}
              </h4>
              <p className={styles.expedienteNota}>
                Son declaraciones de la persona solicitante, no diagnósticos validados ni
                decisiones. El expediente no crea relaciones, asignaciones ni permisos.
              </p>
              {EXPEDIENTE_SECCIONES[detail.requestedProfile].map((seccion) => (
                <section className={styles.expedienteSeccion} key={seccion.titulo}>
                  <h5 className={styles.expedienteSubtitulo}>{seccion.titulo}</h5>
                  <dl className={styles.detailGrid}>
                    {seccion.filas.map((fila) => (
                      <div key={fila.clave}>
                        <dt>{fila.etiqueta}</dt>
                        <dd>{valorExpediente(detail.registration as Record<string, unknown>, fila)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </section>
          )}

          {(() => {
            const acciones = validActionsFor(detail.status, detail.provisioningAttempts);
            const reintentosAgotados =
              detail.status === 'PROVISIONING_FAILED' &&
              detail.provisioningAttempts >= ACCESS_PROVISIONING_MAX_ATTEMPTS;

            if (confirmation !== null) {
              return (
                <div className={styles.confirmation} role="group" aria-labelledby="access-request-confirm-title">
                  <h4 id="access-request-confirm-title">{ACTION_CONFIRM_TITLE[confirmation]}</h4>
                  <p>{ACTION_CONFIRM_TEXT[confirmation]}</p>
                  <div className={styles.decisionActions}>
                    <button type="button" disabled={deciding} onClick={() => { void decide(confirmation); }}>
                      {deciding ? 'Guardando…' : ACTION_CONFIRM_TITLE[confirmation]}
                    </button>
                    <button type="button" disabled={deciding} onClick={() => { setConfirmation(null); }}>Cancelar</button>
                  </div>
                </div>
              );
            }

            return (
              <>
                <div className={styles.decisionActions}>
                  {acciones.map((action) => (
                    <button
                      key={action}
                      type="button"
                      disabled={deciding}
                      onClick={() => { setConfirmation(action); }}
                    >
                      {`${ACTION_LABEL[action]} ${detail.reference}`}
                    </button>
                  ))}
                </div>

                {acciones.length === 0 ? (
                  <p className={styles.state}>
                    Esta solicitud está en un estado final: solo puede consultarse.
                  </p>
                ) : null}

                {reintentosAgotados ? (
                  <p className={styles.error} role="alert">
                    Se agotaron los intentos de creación de acceso. Solo queda rechazar la
                    solicitud.
                  </p>
                ) : null}
              </>
            );
          })()}
        </aside>
      )}
    </section>
  );
}
