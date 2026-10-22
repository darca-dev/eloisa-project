'use client';

import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';

import {
  type AdministracionDto,
  careAdminClient,
  type DocumentoPersona,
  type OrganizacionGestionadaDto,
  PERMISOS_POR_PARTICIPANTE,
  type PermisoCuidado,
  TEXTO_DOCUMENTO,
  TEXTO_PARTICIPANTE,
  TEXTO_PERMISO,
  type TipoDocumento,
  type TipoParticipante,
} from './careAdminClient';
import { type Resultado } from './careClient';
import styles from './care.module.css';

/**
 * Hospital › Configuración › Espacios de cuidado (SPEC 055 / MP05b).
 *
 * Solo para la cuenta humana que el servidor confirma como gestora de una
 * organización. Crea el espacio de cuidado de un paciente, declara competencias
 * y concede o revoca accesos con la referencia del soporte institucional. Ser
 * gestor NO abre la bitácora ni las alarmas: eso exige su propia concesión.
 *
 * Las personas se buscan por documento exacto; la pantalla no descarga listas
 * de pacientes ni de cuentas.
 */

type Fetch = typeof fetch;

const TIPOS_DOCUMENTO = Object.keys(TEXTO_DOCUMENTO) as TipoDocumento[];

function mensajeDe<T>(resultado: Resultado<T>, exito: string): string {
  switch (resultado.kind) {
    case 'ok':
      return exito;
    case 'invalido':
      return resultado.mensaje;
    case 'conflicto':
      return 'Ya existe un elemento activo igual.';
    case 'denegado':
      return 'Su cuenta no es gestora vigente de esta organización.';
    case 'sin-sesion':
      return 'Su sesión terminó. Inicie sesión de nuevo.';
    case 'no-encontrado':
      return 'No se encontró el elemento en esta organización.';
    default:
      return 'No se pudo confirmar la operación. Recargue para comprobar su estado.';
  }
}

function CamposDocumento({
  prefijo,
  valor,
  onCambiar,
}: {
  readonly prefijo: string;
  readonly valor: DocumentoPersona;
  readonly onCambiar: (valor: DocumentoPersona) => void;
}): ReactNode {
  return (
    <>
      <div className={styles.campo}>
        <label htmlFor={`${prefijo}-tipo`}>Tipo de documento</label>
        <select id={`${prefijo}-tipo`} value={valor.documentType} onChange={(evento) => onCambiar({ ...valor, documentType: evento.target.value as TipoDocumento })}>
          {TIPOS_DOCUMENTO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {TEXTO_DOCUMENTO[tipo]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.campo}>
        <label htmlFor={`${prefijo}-numero`}>Número de documento</label>
        <input id={`${prefijo}-numero`} value={valor.documentNumber} autoComplete="off" required onChange={(evento) => onCambiar({ ...valor, documentNumber: evento.target.value })} />
      </div>
    </>
  );
}

const DOCUMENTO_VACIO: DocumentoPersona = { documentType: 'CEDULA_CIUDADANIA', documentNumber: '' };

export function CareAdministration({ fetchImpl }: { readonly fetchImpl?: Fetch }): ReactNode {
  const f = fetchImpl ?? fetch;
  const base = useId();
  const [organizaciones, setOrganizaciones] = useState<readonly OrganizacionGestionadaDto[] | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [org, setOrg] = useState<string | null>(null);
  const [resumen, setResumen] = useState<AdministracionDto | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const [paciente, setPaciente] = useState<DocumentoPersona>(DOCUMENTO_VACIO);
  const [refEspacio, setRefEspacio] = useState('');
  const [persona, setPersona] = useState<DocumentoPersona>(DOCUMENTO_VACIO);
  const [refCompetencia, setRefCompetencia] = useState('');
  const [espacio, setEspacio] = useState('');
  const [participante, setParticipante] = useState<TipoParticipante>('CAREGIVER');
  const [permiso, setPermiso] = useState<PermisoCuidado>('CONTRIBUTE_RECORDS');
  const [personaAcceso, setPersonaAcceso] = useState<DocumentoPersona>(DOCUMENTO_VACIO);
  const [refAcceso, setRefAcceso] = useState('');

  useEffect(() => {
    void (async () => {
      const resultado = await careAdminClient.organizaciones(f);
      if (resultado.kind !== 'ok') {
        setEstado('error');
        return;
      }
      setOrganizaciones(resultado.data);
      setOrg(resultado.data[0]?.organizationId ?? null);
      setEstado('listo');
    })();
  }, [f]);

  const cargarResumen = useCallback(
    async (organizationId: string): Promise<void> => {
      const resultado = await careAdminClient.resumen(organizationId, f);
      if (resultado.kind === 'ok') setResumen(resultado.data);
      else setMensaje(mensajeDe(resultado, ''));
    },
    [f],
  );

  useEffect(() => {
    setResumen(null);
    if (org !== null) void cargarResumen(org);
  }, [org, cargarResumen]);

  const ejecutar = async (operacion: () => Promise<Resultado<AdministracionDto>>, exito: string): Promise<void> => {
    setOcupado(true);
    const resultado = await operacion();
    setOcupado(false);
    setMensaje(mensajeDe(resultado, exito));
    if (resultado.kind === 'ok') setResumen(resultado.data);
  };

  if (estado === 'cargando') return <p role="status">Consultando las organizaciones que usted gestiona…</p>;
  if (estado === 'error') return <p role="status">No fue posible consultar la administración de cuidado en este momento.</p>;
  if (organizaciones === null || organizaciones.length === 0 || org === null) {
    return (
      <p role="status">
        Su cuenta no es gestora de ninguna organización. El primer gestor lo designa soporte de plataforma con la provisión
        controlada.
      </p>
    );
  }

  const enviar = (evento: FormEvent, accion: () => Promise<void>): void => {
    evento.preventDefault();
    void accion();
  };

  return (
    <section className={styles.espacio} aria-labelledby={`${base}-titulo`}>
      <h2 id={`${base}-titulo`}>Espacios de cuidado</h2>
      <p className={styles.ayuda}>
        Usted administra quién puede registrar, pedir revisión, definir criterios o revisar alarmas. Ser gestor no le da
        acceso a la bitácora ni a las alarmas.
      </p>

      <div aria-live="polite" className={styles.vivo}>
        {mensaje === '' ? null : <p role="status">{mensaje}</p>}
      </div>

      {organizaciones.length > 1 ? (
        <div className={styles.campo}>
          <label htmlFor={`${base}-org`}>Organización</label>
          <select id={`${base}-org`} value={org} onChange={(evento) => setOrg(evento.target.value)}>
            {organizaciones.map((item) => (
              <option key={item.organizationId} value={item.organizationId}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p>
          <strong>{organizaciones[0]?.name}</strong>
        </p>
      )}

      <form
        className={styles.formulario}
        aria-labelledby={`${base}-espacio`}
        onSubmit={(evento) =>
          enviar(evento, () =>
            ejecutar(() => careAdminClient.crearEspacio(org, { patient: paciente, authorizationReference: refEspacio }, f), 'Espacio de cuidado creado.'),
          )
        }
      >
        <h3 id={`${base}-espacio`}>Crear el espacio de cuidado de un paciente</h3>
        <CamposDocumento prefijo={`${base}-paciente`} valor={paciente} onCambiar={setPaciente} />
        <div className={styles.campo}>
          <label htmlFor={`${base}-ref-espacio`}>Referencia del soporte de custodia</label>
          <input id={`${base}-ref-espacio`} value={refEspacio} required onChange={(evento) => setRefEspacio(evento.target.value)} />
        </div>
        <button className={styles.primario} type="submit" disabled={ocupado}>
          Crear espacio
        </button>
      </form>

      <form
        className={styles.formulario}
        aria-labelledby={`${base}-competencia`}
        onSubmit={(evento) =>
          enviar(evento, () =>
            ejecutar(
              () => careAdminClient.declararCompetencia(org, { person: persona, evidenceReference: refCompetencia }, f),
              'Competencia registrada. No acredita título ni sustituye validaciones externas.',
            ),
          )
        }
      >
        <h3 id={`${base}-competencia`}>Registrar competencia clínica declarada</h3>
        <p className={styles.ayuda}>Necesaria para definir criterios o revisar alarmas. Usted la valida; no puede registrarse a sí mismo.</p>
        <CamposDocumento prefijo={`${base}-persona`} valor={persona} onCambiar={setPersona} />
        <div className={styles.campo}>
          <label htmlFor={`${base}-ref-competencia`}>Referencia del soporte de competencia</label>
          <input id={`${base}-ref-competencia`} value={refCompetencia} required onChange={(evento) => setRefCompetencia(evento.target.value)} />
        </div>
        <button className={styles.primario} type="submit" disabled={ocupado}>
          Registrar competencia
        </button>
      </form>

      {resumen === null ? (
        <p role="status">Cargando espacios…</p>
      ) : (
        <>
          <form
            className={styles.formulario}
            aria-labelledby={`${base}-acceso`}
            onSubmit={(evento) =>
              enviar(evento, () =>
                ejecutar(
                  () =>
                    careAdminClient.conceder(
                      org,
                      espacio,
                      { actorKind: participante, permission: permiso, person: personaAcceso, authorizationReference: refAcceso },
                      f,
                    ),
                  'Acceso concedido. Es efectivo de inmediato.',
                ),
              )
            }
          >
            <h3 id={`${base}-acceso`}>Conceder un acceso</h3>
            <div className={styles.campo}>
              <label htmlFor={`${base}-espacio-sel`}>Espacio de cuidado</label>
              <select id={`${base}-espacio-sel`} value={espacio} required onChange={(evento) => setEspacio(evento.target.value)}>
                <option value="">Elija un espacio</option>
                {resumen.contexts
                  .filter((contexto) => contexto.status === 'ACTIVE')
                  .map((contexto) => (
                    <option key={contexto.contextId} value={contexto.contextId}>
                      {contexto.patientLabel}
                    </option>
                  ))}
              </select>
            </div>
            <div className={styles.campo}>
              <label htmlFor={`${base}-participante`}>Participante</label>
              <select
                id={`${base}-participante`}
                value={participante}
                onChange={(evento) => {
                  const siguiente = evento.target.value as TipoParticipante;
                  setParticipante(siguiente);
                  setPermiso(PERMISOS_POR_PARTICIPANTE[siguiente][0] ?? 'VIEW_RECORDS');
                }}
              >
                {(Object.keys(TEXTO_PARTICIPANTE) as TipoParticipante[]).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TEXTO_PARTICIPANTE[tipo]}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.campo}>
              <label htmlFor={`${base}-permiso`}>Permiso</label>
              <select id={`${base}-permiso`} value={permiso} onChange={(evento) => setPermiso(evento.target.value as PermisoCuidado)}>
                {PERMISOS_POR_PARTICIPANTE[participante].map((item) => (
                  <option key={item} value={item}>
                    {TEXTO_PERMISO[item]}
                  </option>
                ))}
              </select>
            </div>
            <CamposDocumento prefijo={`${base}-persona-acceso`} valor={personaAcceso} onCambiar={setPersonaAcceso} />
            <div className={styles.campo}>
              <label htmlFor={`${base}-ref-acceso`}>Referencia del soporte de autorización</label>
              <input id={`${base}-ref-acceso`} value={refAcceso} required onChange={(evento) => setRefAcceso(evento.target.value)} />
            </div>
            <p className={styles.ayuda}>
              El cuidador necesita una relación de cuidado activa; el profesional, una asignación activa; definir criterios o
              revisar exige competencia registrada.
            </p>
            <button className={styles.primario} type="submit" disabled={ocupado || espacio === ''}>
              Conceder acceso
            </button>
          </form>

          <section aria-labelledby={`${base}-lista`}>
            <h3 id={`${base}-lista`}>Espacios y accesos</h3>
            {resumen.contexts.length === 0 ? (
              <p className={styles.ayuda}>Todavía no hay espacios de cuidado en esta organización.</p>
            ) : (
              <ol className={styles.lista}>
                {resumen.contexts.map((contexto) => (
                  <li key={contexto.contextId} className={styles.item}>
                    <p>
                      <strong>{contexto.patientLabel}</strong> · Soporte {contexto.authorizationReference}
                    </p>
                    {contexto.grants.length === 0 ? (
                      <p className={styles.ayuda}>Sin accesos concedidos.</p>
                    ) : (
                      <ul>
                        {contexto.grants.map((concesion) => (
                          <li key={concesion.id}>
                            {concesion.personLabel} · {TEXTO_PARTICIPANTE[concesion.actorKind]} · {TEXTO_PERMISO[concesion.permission]} ·{' '}
                            {concesion.status === 'ACTIVE' ? 'Vigente' : 'Revocado'}
                            {concesion.status === 'ACTIVE' ? (
                              <button
                                className={styles.secundario}
                                type="button"
                                disabled={ocupado}
                                onClick={() => void ejecutar(() => careAdminClient.revocar(org, concesion.id, f), 'Acceso revocado. La historia se conserva.')}
                              >
                                Revocar
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby={`${base}-competencias`}>
            <h3 id={`${base}-competencias`}>Competencias registradas</h3>
            {resumen.competences.length === 0 ? (
              <p className={styles.ayuda}>No hay competencias registradas.</p>
            ) : (
              <ul>
                {resumen.competences.map((competencia) => (
                  <li key={competencia.id}>
                    {competencia.personLabel} · Soporte {competencia.evidenceReference} · {competencia.status === 'ACTIVE' ? 'Vigente' : 'Revocada'}
                    {competencia.status === 'ACTIVE' ? (
                      <button
                        className={styles.secundario}
                        type="button"
                        disabled={ocupado}
                        onClick={() => void ejecutar(() => careAdminClient.revocarCompetencia(org, competencia.id, f), 'Competencia revocada.')}
                      >
                        Revocar
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
