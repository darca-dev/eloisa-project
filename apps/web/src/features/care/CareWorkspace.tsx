'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  type AlarmaDto,
  type BandejaDto,
  careClient,
  careCriteriosClient,
  type ContextoCuidadoDto,
  type CriterioDto,
  type DatoDto,
  type DetalleAlarmaDto,
  type ElementoColaDto,
  nuevaClaveEnvio,
  type RegistroDto,
  type Resultado,
  type SemaforoDto,
} from './careClient';
import { BannerSemaforo, ColaRevision, DetalleAlarma, type EnvioCriterio, GestorCriterios } from './careCriteriaViews';
import {
  BandejaAlarmas,
  type EnvioDato,
  type EnvioRegistro,
  type EstadoGeneral,
  FormularioRegistro,
  GestorDatos,
  instanteDesdeLocal,
  type IntencionRevisor,
  ListaRegistros,
  SelectorContexto,
  SolicitudRevision,
  VistaEstadoGeneral,
} from './careViews';
import styles from './care.module.css';

/**
 * Espacio de cuidado compartido por los cuatro portales (SPEC 055 / MP02–MP03).
 *
 * UNA sola implementación para paciente, cuidador, profesional y hospital: lo
 * que cada uno ve lo decide el SERVIDOR con las acciones que concede en cada
 * contexto, no el perfil de la página. El perfil solo elige el título y el
 * orden de los apartados.
 *
 * - Nada se guarda en el almacenamiento del navegador ni en caché offline.
 * - Cambiar de contexto limpia el estado y descarta respuestas en vuelo del
 *   contexto anterior (`AbortController` + número de generación).
 * - Cada envío conserva su `idempotencyKey` hasta que el servidor confirma, de
 *   modo que «Volver a intentar» no duplica.
 * - Los mensajes se anuncian en una región `aria-live`.
 */

export type PerfilCuidado = 'paciente' | 'cuidador' | 'profesional' | 'hospital';

const TITULOS: Readonly<Record<PerfilCuidado, string>> = {
  paciente: 'Mi cuidado',
  cuidador: 'Bitácora de cuidado',
  profesional: 'Bitácora y datos de mis pacientes',
  hospital: 'Solicitudes de revisión y alarmas',
};

type Fetch = typeof fetch;

interface Datos {
  readonly datos: readonly DatoDto[];
  readonly registros: readonly RegistroDto[] | null;
  readonly bandeja: BandejaDto | null;
  readonly criterios: readonly CriterioDto[] | null;
  readonly semaforo: SemaforoDto | null;
}

const DATOS_VACIOS: Datos = { datos: [], registros: null, bandeja: null, criterios: null, semaforo: null };

function estadoDe<T>(resultado: Resultado<T>): EstadoGeneral {
  if (resultado.kind === 'sin-sesion') return 'sin-sesion';
  if (resultado.kind === 'denegado') return 'denegado';
  return 'indisponible';
}

export function CareWorkspace({
  perfil,
  fetchImpl,
  titulo,
  encabezado = 'h2',
}: {
  readonly perfil: PerfilCuidado;
  readonly fetchImpl?: Fetch;
  /** Título visible; por defecto el del perfil. */
  readonly titulo?: string;
  /** `h1` cuando el espacio ES la vista principal de la página. */
  readonly encabezado?: 'h1' | 'h2';
}): ReactNode {
  const Encabezado = encabezado;
  const f = fetchImpl ?? fetch;
  const [estado, setEstado] = useState<EstadoGeneral | 'listo'>('cargando');
  const [contextos, setContextos] = useState<readonly ContextoCuidadoDto[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS);
  const [mensaje, setMensaje] = useState<string>('');
  const [recibo, setRecibo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [detalles, setDetalles] = useState<Readonly<Record<string, DetalleAlarmaDto>>>({});
  const [cola, setCola] = useState<readonly ElementoColaDto[] | null>(null);
  const generacion = useRef(0);
  const claves = useRef(new Map<string, string>());

  const contexto = contextos.find((item) => item.contextId === seleccionado) ?? null;
  const puede = (accion: ContextoCuidadoDto['actions'][number]): boolean => contexto?.actions.includes(accion) ?? false;

  const cargarDirectorio = useCallback(async (): Promise<void> => {
    setEstado('cargando');
    const resultado = await careClient.contextos(f);
    if (resultado.kind !== 'ok') {
      setEstado(estadoDe(resultado));
      return;
    }
    setContextos(resultado.data.items);
    setSeleccionado(resultado.data.items.length === 1 ? (resultado.data.items[0]?.contextId ?? null) : null);
    setEstado(resultado.data.items.length === 0 ? 'vacio' : 'listo');
  }, [f]);

  const cargarCola = useCallback(async (): Promise<void> => {
    if (perfil !== 'hospital') return;
    const resultado = await careCriteriosClient.cola(f);
    setCola(resultado.kind === 'ok' ? resultado.data : null);
  }, [f, perfil]);

  useEffect(() => {
    void cargarDirectorio();
    void cargarCola();
  }, [cargarDirectorio, cargarCola]);

  const cargarContexto = useCallback(
    async (actual: ContextoCuidadoDto, signal: AbortSignal, propia: number): Promise<void> => {
      const acciones = actual.actions;
      const verRegistros = acciones.includes('VIEW_RECORDS') || acciones.includes('CONTRIBUTE_RECORDS');
      const verAlarmas = acciones.includes('REVIEW_ALARMS') || acciones.includes('REQUEST_ALARM');
      const verDatos = verRegistros || acciones.includes('MANAGE_RULES');
      const verCriterios = acciones.includes('MANAGE_RULES') || acciones.includes('REVIEW_ALARMS') || acciones.includes('VIEW_RECORDS');

      const [datosR, registrosR, bandejaR, criteriosR, semaforoR] = await Promise.all([
        verDatos ? careClient.datos(actual.contextId, f, signal) : null,
        verRegistros ? careClient.registros(actual.contextId, f, signal) : null,
        verAlarmas ? careClient.alarmas(actual.contextId, f, signal) : null,
        verCriterios ? careCriteriosClient.criterios(actual.contextId, f, signal) : null,
        verCriterios ? careCriteriosClient.semaforo(actual.contextId, f, signal) : null,
      ]);

      // Una respuesta del contexto anterior no se monta nunca.
      if (signal.aborted || propia !== generacion.current) return;

      const fallidos = [datosR, registrosR, bandejaR, criteriosR, semaforoR].filter((r) => r !== null && r.kind !== 'ok' && r.kind !== 'cancelado');
      const primero = fallidos[0];
      if (primero !== undefined && primero !== null) {
        setMensaje(estadoDe(primero) === 'sin-sesion' ? 'Su sesión terminó. Inicie sesión de nuevo.' : 'Parte de la información no está disponible en este momento.');
      }

      setDatos({
        datos: datosR?.kind === 'ok' ? datosR.data : [],
        registros: registrosR?.kind === 'ok' ? registrosR.data.items : null,
        bandeja: bandejaR?.kind === 'ok' ? bandejaR.data : null,
        criterios: criteriosR?.kind === 'ok' ? criteriosR.data : null,
        semaforo: semaforoR?.kind === 'ok' ? semaforoR.data : null,
      });
    },
    [f],
  );

  useEffect(() => {
    generacion.current += 1;
    const propia = generacion.current;
    setDatos(DATOS_VACIOS);
    setDetalles({});
    setMensaje('');
    setRecibo(null);

    if (contexto === null) return undefined;

    const control = new AbortController();
    void cargarContexto(contexto, control.signal, propia);
    return () => control.abort();
    // `contexto` cambia de identidad solo cuando cambia la selección o el directorio.
  }, [contexto, cargarContexto]);

  const recargar = useCallback(async (): Promise<void> => {
    if (contexto === null) return;
    const control = new AbortController();
    await cargarContexto(contexto, control.signal, generacion.current);
  }, [contexto, cargarContexto]);

  /** Clave estable por intento: se libera solo cuando el servidor confirma. */
  const claveDe = (intento: string): string => {
    const existente = claves.current.get(intento);
    if (existente !== undefined) return existente;
    const nueva = nuevaClaveEnvio();
    claves.current.set(intento, nueva);
    return nueva;
  };

  const tras = async <T,>(intento: string | null, resultado: Resultado<T>, exito: string): Promise<boolean> => {
    if (resultado.kind === 'ok') {
      if (intento !== null) claves.current.delete(intento);
      setMensaje(exito);
      setDetalles({});
      await recargar();
      await cargarCola();
      return true;
    }
    setMensaje(
      resultado.kind === 'invalido'
        ? resultado.mensaje
        : resultado.kind === 'conflicto'
          ? 'La información cambió mientras trabajaba. Se actualizó; revise y vuelva a intentarlo.'
          : resultado.kind === 'denegado'
            ? 'Su cuenta no tiene autorización para esta acción.'
            : resultado.kind === 'sin-sesion'
              ? 'Su sesión terminó. Inicie sesión de nuevo.'
              : 'No se pudo confirmar la operación. Puede volver a intentarlo sin duplicarla.',
    );
    if (resultado.kind === 'conflicto') await recargar();
    return false;
  };

  const registrar = async (envio: EnvioRegistro): Promise<void> => {
    if (contexto === null) return;
    const occurredAt = instanteDesdeLocal(envio.occurredAt);
    if (occurredAt === null) {
      setMensaje('Indique una fecha y hora que no sean futuras.');
      return;
    }
    const intento = `registro:${contexto.contextId}:${JSON.stringify(envio)}`;
    setOcupado(true);
    const resultado = await careClient.registrar(
      contexto.contextId,
      {
        idempotencyKey: claveDe(intento),
        occurredAt,
        ...(envio.note.trim() === '' ? {} : { note: envio.note.trim() }),
        observations: Object.entries(envio.valores).map(([definitionId, value]) => ({ definitionId, value })),
      },
      f,
    );
    setOcupado(false);
    const abiertas = resultado.kind === 'ok' ? (resultado.data.evaluation?.alarmsOpened ?? 0) : 0;
    await tras(
      intento,
      resultado,
      abiertas > 0
        ? 'Entrada guardada. Se cumplió un criterio definido por el profesional y se generó una alarma para revisión.'
        : 'Entrada guardada en la bitácora.',
    );
  };

  const enmendar = async (registro: RegistroDto, nota: string, motivo: string): Promise<void> => {
    if (contexto === null) return;
    const intento = `enmienda:${registro.id}:${registro.amendments.length}:${nota}:${motivo}`;
    setOcupado(true);
    const resultado = await careClient.enmendar(
      contexto.contextId,
      registro.id,
      { idempotencyKey: claveDe(intento), expectedSequence: registro.amendments.length, note: nota.trim(), reason: motivo.trim() },
      f,
    );
    setOcupado(false);
    await tras(intento, resultado, 'Corrección guardada. La entrada original se conserva.');
  };

  const pedirRevision = async (nota: string): Promise<void> => {
    if (contexto === null) return;
    const intento = `revision:${contexto.contextId}:${nota}`;
    setOcupado(true);
    const resultado = await careClient.pedirRevision(
      contexto.contextId,
      { idempotencyKey: claveDe(intento), ...(nota.trim() === '' ? {} : { note: nota.trim() }) },
      f,
    );
    setOcupado(false);
    if (resultado.kind === 'ok') setRecibo(resultado.data.receiptMessage);
    await tras(intento, resultado, resultado.kind === 'ok' ? resultado.data.receiptMessage : '');
  };

  const revisar = async (intencion: IntencionRevisor): Promise<void> => {
    if (contexto === null) return;
    setOcupado(true);
    const resultado = await careClient.transicion(
      contexto.contextId,
      intencion.alarma.id,
      {
        action: intencion.action,
        expectedVersion: intencion.alarma.version,
        ...(intencion.reason.trim() === '' ? {} : { reason: intencion.reason.trim() }),
        ...(intencion.severity === undefined ? {} : { severity: intencion.severity }),
        ...(intencion.action === 'ASSIGN' ? { assignee: 'self' as const } : {}),
      },
      f,
    );
    setOcupado(false);
    await tras(null, resultado, 'Solicitud actualizada.');
  };

  const informar = async (alarma: AlarmaDto): Promise<void> => {
    if (contexto === null) return;
    const intento = `informe:${alarma.id}`;
    setOcupado(true);
    const resultado = await careClient.informarResolucion(contexto.contextId, alarma.id, { idempotencyKey: claveDe(intento) }, f);
    setOcupado(false);
    await tras(intento, resultado, 'Se informó que se resolvió. Un profesional autorizado lo confirmará.');
  };

  const verDetalle = async (alarma: AlarmaDto): Promise<void> => {
    if (contexto === null) return;
    const resultado = await careCriteriosClient.detalle(contexto.contextId, alarma.id, f);
    if (resultado.kind === 'ok') setDetalles((previo) => ({ ...previo, [alarma.id]: resultado.data }));
    else setMensaje('No fue posible consultar la historia de esta solicitud.');
  };

  const definirCriterio = async (envio: EnvioCriterio): Promise<void> => {
    if (contexto === null) return;
    const intento = `criterio:${contexto.contextId}:${JSON.stringify(envio)}`;
    setOcupado(true);
    const resultado = await careCriteriosClient.definir(contexto.contextId, { idempotencyKey: claveDe(intento), ...envio }, f);
    setOcupado(false);
    await tras(intento, resultado, 'Criterio validado. Cuenta lo que ocurra a partir de ahora.');
  };

  const retirarCriterio = async (criterio: CriterioDto, motivo: string): Promise<void> => {
    if (contexto === null) return;
    setOcupado(true);
    const resultado = await careCriteriosClient.retirar(contexto.contextId, criterio.id, motivo.trim(), f);
    setOcupado(false);
    await tras(null, resultado, 'Criterio retirado. Las alarmas abiertas siguen en seguimiento.');
  };

  const definir = async (envio: EnvioDato): Promise<void> => {
    if (contexto === null) return;
    const intento = `dato:${contexto.contextId}:${JSON.stringify(envio)}`;
    setOcupado(true);
    const resultado = await careClient.definirDato(
      contexto.contextId,
      {
        idempotencyKey: claveDe(intento),
        code: envio.code,
        label: envio.label,
        valueType: envio.valueType,
        ...(envio.valueType === 'NUMBER' && envio.unit !== '' ? { unit: envio.unit } : {}),
        ...(envio.valueType === 'CHOICE' ? { options: envio.options } : {}),
      },
      f,
    );
    setOcupado(false);
    await tras(intento, resultado, 'Dato validado. Ya se puede registrar.');
  };

  return (
    <section className={styles.espacio} aria-labelledby={`cuidado-${perfil}-titulo`}>
      <Encabezado id={`cuidado-${perfil}-titulo`}>{titulo ?? TITULOS[perfil]}</Encabezado>

      {perfil === 'hospital' ? (
        <p className={styles.ayuda}>
          Aquí llegan las solicitudes de revisión de los espacios de cuidado que usted puede revisar. La
          clasificación la decide un profesional autorizado; la evaluación automática por criterios
          individuales todavía no está habilitada.
        </p>
      ) : null}

      <div aria-live="polite" className={styles.vivo}>
        {mensaje === '' ? null : <p role="status">{mensaje}</p>}
      </div>

      {estado !== 'listo' ? (
        <VistaEstadoGeneral estado={estado} onReintentar={() => void cargarDirectorio()} />
      ) : (
        <>
          {perfil === 'hospital' && cola !== null ? (
            <section aria-label="Cola de revisión">
              <h3>Cola de revisión</h3>
              <ColaRevision cola={cola} onAbrir={setSeleccionado} />
            </section>
          ) : null}

          <SelectorContexto contextos={contextos} seleccionado={seleccionado} onSeleccionar={setSeleccionado} />

          {contexto === null ? null : (
            <div className={styles.apartados}>
              {datos.semaforo === null ? null : <BannerSemaforo semaforo={datos.semaforo} />}

              {puede('REQUEST_ALARM') && perfil !== 'hospital' ? (
                <SolicitudRevision enviando={ocupado} recibo={recibo} onEnviar={(nota) => void pedirRevision(nota)} />
              ) : null}

              {datos.bandeja === null ? null : (
                <section aria-label={datos.bandeja.canReview ? 'Bandeja de revisión' : 'Mis solicitudes'}>
                  <h3>{datos.bandeja.canReview ? 'Bandeja de revisión' : 'Mis solicitudes de revisión'}</h3>
                  <BandejaAlarmas
                    alarmas={datos.bandeja.items}
                    puedeRevisar={datos.bandeja.canReview}
                    ocupado={ocupado}
                    onRevisar={(intencion) => void revisar(intencion)}
                    onInformarResolucion={(alarma) => void informar(alarma)}
                    onVerDetalle={(alarma) => void verDetalle(alarma)}
                    renderDetalle={(alarma) => {
                      const detalle = detalles[alarma.id];
                      return detalle === undefined ? null : <DetalleAlarma detalle={detalle} />;
                    }}
                  />
                </section>
              )}

              {puede('CONTRIBUTE_RECORDS') ? (
                <FormularioRegistro datos={datos.datos} enviando={ocupado} onEnviar={(envio) => void registrar(envio)} />
              ) : null}

              {datos.registros === null ? null : (
                <section aria-label="Bitácora">
                  <h3>Bitácora</h3>
                  <ListaRegistros
                    registros={datos.registros}
                    {...(puede('CONTRIBUTE_RECORDS') ? { onEnmendar: (registro, nota, motivo) => void enmendar(registro, nota, motivo) } : {})}
                  />
                </section>
              )}

              {puede('MANAGE_RULES') ? (
                <GestorDatos datos={datos.datos} enviando={ocupado} onDefinir={(envio) => void definir(envio)} />
              ) : null}

              {puede('MANAGE_RULES') && datos.criterios !== null ? (
                <GestorCriterios
                  datos={datos.datos}
                  criterios={datos.criterios}
                  enviando={ocupado}
                  onDefinir={(envio) => void definirCriterio(envio)}
                  onRetirar={(criterio, motivo) => void retirarCriterio(criterio, motivo)}
                />
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}
