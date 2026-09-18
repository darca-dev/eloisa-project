'use client';

import { useState, type ReactNode } from 'react';

import {
  AdminAccion,
  AdminAviso,
  AdminTabla,
  hospitalAdminStyles as styles,
} from './HospitalAdminPieces';
import type {
  HospitalAdminCampoVacio,
  HospitalMembresiasConfig,
  HospitalPlanMembresia,
} from './hospitalAdministrationConfig';
import { valoresDelPlan } from './hospitalAdministrationConfig';
import {
  HospitalBadge,
  HospitalCard,
  HospitalCardHeader,
  HospitalNote,
  hospitalViewStyles as compartido,
  tonoVars,
} from './HospitalViewPieces';

/**
 * Bloque «Membresías y servicios» (TASK-003H-05, FR-02; corrección final
 * aprobada por la Product Owner, apartados G, H, I y J).
 *
 * Reproduce los planes y servicios del prototipo oficial (líneas 660–727 y
 * fixtures 1241–1252) con la presentación que la corrección aprueba:
 *
 * - los tres planes dejan de ser filas largas y pasan a tarjetas comparables,
 *   varias por fila en escritorio, cada una con nombre, precio, periodicidad,
 *   estado, visitas incluidas, consultas virtuales incluidas, beneficios,
 *   descuento cuando existe, vigencia/versión y `Editar plan`;
 * - `Editar plan` abre un formulario visual con los campos aprobados y los
 *   botones `Guardar cambios` y `Cancelar`;
 * - los seis servicios configurables se conservan tal como estaban.
 *
 * «Gestión financiera» no aparece en esta pestaña, ni siquiera como acceso:
 * por decisión final de la Product Owner es un módulo principal e
 * independiente del menú del Hospital y su contenido pertenece a TASK-003H-06.
 *
 * Alcance: presentación. Precios, beneficios y coberturas son datos ficticios
 * del prototipo, no tarifas ni reglas comerciales. Abrir y cerrar el formulario
 * de edición es estado local efímero: escribir en un campo no guarda nada, no
 * cambia el fixture, no versiona, no cobra y no simula éxito. `Guardar cambios`
 * y `Guardar plan` están deshabilitados. Qué ofrece el hospital y qué podrá
 * adquirir un paciente sigue siendo una decisión pendiente de aprobación.
 */

const PLANES_ID = 'hospital-admin-planes';
const FORMULARIO_ID = 'hospital-admin-crear-membresia';
const EDICION_ID = 'hospital-admin-editar-plan';
const SERVICIOS_ID = 'hospital-admin-servicios';

/** Dato con rótulo dentro de una tarjeta de plan. */
function PlanDato({
  etiqueta,
  children,
}: {
  readonly etiqueta: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.planDato}>
      <dt className={styles.planDatoEtiqueta}>{etiqueta}</dt>
      <dd className={styles.planDatoValor}>{children}</dd>
    </div>
  );
}

/**
 * Tarjeta de un plan.
 *
 * `Editar plan` es el único control activo y solo abre el formulario visual
 * dentro de esta misma pestaña: no guarda, no cobra y no consulta nada.
 */
function Plan({
  plan,
  editando,
  etiquetas,
  onEditar,
}: {
  readonly plan: HospitalPlanMembresia;
  readonly editando: boolean;
  readonly etiquetas: HospitalMembresiasConfig['etiquetasPlan'];
  readonly onEditar: () => void;
}): ReactNode {
  return (
    <li className={editando ? `${styles.plan} ${styles.planActivo}` : styles.plan}>
      <div className={styles.planCabecera}>
        <span className={styles.planNombre}>{plan.nombre}</span>
        <HospitalBadge tono={plan.tono} className={styles.planBadge}>
          {plan.estado}
        </HospitalBadge>
      </div>

      <div className={styles.planPrecio}>
        <span className={styles.planValor}>{plan.precio}</span>
        <span className={styles.planPeriodo}>
          {plan.renovacion === null
            ? plan.periodicidad
            : `${plan.periodicidad} · ${plan.renovacion}`}
        </span>
      </div>

      <dl className={styles.planDatos}>
        <PlanDato etiqueta={etiquetas.visitas}>{plan.visitas}</PlanDato>
        <PlanDato etiqueta={etiquetas.virtuales}>{plan.virtuales}</PlanDato>
        <PlanDato etiqueta={etiquetas.beneficios}>
          <ul className={styles.planBeneficios}>
            {plan.beneficios.map((beneficio) => (
              <li key={beneficio}>{beneficio}</li>
            ))}
          </ul>
        </PlanDato>
        {plan.descuento === null ? null : (
          <PlanDato etiqueta={etiquetas.descuento}>{plan.descuento}</PlanDato>
        )}
        <PlanDato etiqueta={etiquetas.vigencia}>{plan.version.etiqueta}</PlanDato>
      </dl>

      <button
        type="button"
        className={`${compartido.button} ${compartido.buttonNeutro} ${styles.accionPildora}`}
        aria-expanded={editando}
        aria-controls={editando ? EDICION_ID : undefined}
        onClick={onEditar}
      >
        {plan.accion.etiqueta}
        <span className="merdn-sr-only">{` — ${plan.nombre}`}</span>
      </button>
    </li>
  );
}

/**
 * Formulario visual de edición de un plan.
 *
 * Parte de los valores del plan y vive solo mientras está abierto: React lo
 * remonta al cambiar de plan, de modo que nunca arrastra lo escrito para otro.
 * `Guardar cambios` está deshabilitado; `Cancelar` únicamente lo cierra.
 */
function EdicionPlan({
  plan,
  edicion,
  onCancelar,
}: {
  readonly plan: HospitalPlanMembresia;
  readonly edicion: HospitalMembresiasConfig['edicion'];
  readonly onCancelar: () => void;
}): ReactNode {
  const valores = valoresDelPlan(plan);

  return (
    <HospitalCard gap={16} id={EDICION_ID} aria-labelledby={`${EDICION_ID}-titulo`}>
      <HospitalCardHeader
        titulo={`${edicion.titulo}: ${plan.nombre}`}
        tituloId={`${EDICION_ID}-titulo`}
        nota={edicion.nota}
      />
      <div className={styles.formulario}>
        {edicion.campos.map((campo) => {
          const id = `${EDICION_ID}-${campo.id}`;
          const valor = valores[campo.id];

          return (
            <div
              className={
                campo.tipo === 'parrafo' ? `${styles.campo} ${styles.campoAncho}` : styles.campo
              }
              key={campo.id}
            >
              <label className={styles.campoEtiqueta} htmlFor={id}>
                {campo.etiqueta}
              </label>
              {campo.tipo === 'lista' ? (
                <select className={styles.campoControl} id={id} defaultValue={valor}>
                  {(campo.opciones ?? []).map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {opcion}
                    </option>
                  ))}
                </select>
              ) : null}
              {campo.tipo === 'parrafo' ? (
                <textarea
                  className={`${styles.campoControl} ${styles.campoParrafo}`}
                  id={id}
                  rows={3}
                  defaultValue={valor}
                />
              ) : null}
              {campo.tipo === 'texto' ? (
                <input
                  className={styles.campoControl}
                  id={id}
                  type="text"
                  defaultValue={valor}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className={styles.acciones}>
        <AdminAccion accion={edicion.guardar} tamano="grande" />
        <button
          type="button"
          className={`${compartido.button} ${compartido.buttonNeutro} ${styles.accionGrande}`}
          onClick={onCancelar}
        >
          {edicion.cancelar}
        </button>
      </div>
    </HospitalCard>
  );
}

/**
 * Campo del formulario `Crear membresía`. Cada control lleva su etiqueta
 * asociada y no está conectado a ningún estado: escribir no guarda ni valida.
 */
function CampoVacio({ campo }: { readonly campo: HospitalAdminCampoVacio }): ReactNode {
  const id = `${FORMULARIO_ID}-${campo.id}`;

  return (
    <div
      className={campo.tipo === 'parrafo' ? `${styles.campo} ${styles.campoAncho}` : styles.campo}
    >
      <label className={styles.campoEtiqueta} htmlFor={id}>
        {campo.etiqueta}
      </label>
      {campo.tipo === 'lista' ? (
        <select className={styles.campoControl} id={id} defaultValue="">
          <option value="" disabled>
            Sin seleccionar
          </option>
          {(campo.opciones ?? []).map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      ) : null}
      {campo.tipo === 'parrafo' ? (
        <textarea
          className={`${styles.campoControl} ${styles.campoParrafo}`}
          id={id}
          rows={2}
          placeholder={campo.ejemplo}
        />
      ) : null}
      {campo.tipo === 'texto' || campo.tipo === 'fecha' ? (
        <input
          className={styles.campoControl}
          id={id}
          type={campo.tipo === 'fecha' ? 'date' : 'text'}
          placeholder={campo.ejemplo}
        />
      ) : null}
    </div>
  );
}

export function HospitalMemberships({
  config,
  planEnEdicionInicial,
}: {
  readonly config: HospitalMembresiasConfig;
  /**
   * Plan cuyo formulario de edición se muestra al montar. Sirve para probar el
   * formulario; no persiste y no procede de la URL.
   */
  readonly planEnEdicionInicial?: string;
}): ReactNode {
  const [planEnEdicion, setPlanEnEdicion] = useState<string | undefined>(planEnEdicionInicial);
  const editando = config.planes.find((plan) => plan.id === planEnEdicion);

  return (
    <div className={styles.panel}>
      <AdminAviso>{config.avisoAcciones}</AdminAviso>

      <HospitalCard gap={16} aria-labelledby={PLANES_ID}>
        <HospitalCardHeader titulo={config.titulo} tituloId={PLANES_ID} nota={config.nota} />
        <ul className={styles.planes}>
          {config.planes.map((plan) => (
            <Plan
              key={plan.id}
              plan={plan}
              editando={plan.id === planEnEdicion}
              etiquetas={config.etiquetasPlan}
              onEditar={() => {
                setPlanEnEdicion((actual) => (actual === plan.id ? undefined : plan.id));
              }}
            />
          ))}
        </ul>
        <HospitalNote>{config.notaVersiones}</HospitalNote>
      </HospitalCard>

      {editando === undefined ? null : (
        <EdicionPlan
          key={editando.id}
          plan={editando}
          edicion={config.edicion}
          onCancelar={() => {
            setPlanEnEdicion(undefined);
          }}
        />
      )}

      <HospitalCard gap={16} aria-labelledby={FORMULARIO_ID}>
        <HospitalCardHeader titulo={config.formulario.titulo} tituloId={FORMULARIO_ID} />
        <div className={styles.formulario}>
          {config.formulario.campos.map((campo) => (
            <CampoVacio campo={campo} key={campo.id} />
          ))}
        </div>
        <span className={styles.acciones}>
          <AdminAccion accion={config.formulario.accion} tamano="grande" />
        </span>
      </HospitalCard>

      <HospitalCard gap={16} aria-labelledby={SERVICIOS_ID}>
        <HospitalCardHeader titulo={config.servicios.titulo} tituloId={SERVICIOS_ID} />
        <AdminTabla columnas={config.servicios.columnas} etiquetaId={SERVICIOS_ID}>
          {config.servicios.items.map((servicio) => (
            <tr className={styles.tablaFila} key={servicio.id}>
              <th scope="row" className={`${styles.tablaCelda} ${styles.celdaFuerte}`}>
                {servicio.nombre}
              </th>
              <td className={`${styles.tablaCelda} ${styles.celdaValor}`}>{servicio.precio}</td>
              <td className={styles.tablaCelda}>{servicio.duracion}</td>
              <td className={styles.tablaCelda}>{servicio.profesional}</td>
              <td className={styles.tablaCelda}>
                <span className={styles.celdaCobertura} style={tonoVars(servicio.tono)}>
                  {servicio.cobertura}
                </span>
              </td>
            </tr>
          ))}
        </AdminTabla>
        <HospitalNote>{config.servicios.nota}</HospitalNote>
      </HospitalCard>
    </div>
  );
}
