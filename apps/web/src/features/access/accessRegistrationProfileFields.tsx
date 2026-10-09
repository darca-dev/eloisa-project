import { DEPARTAMENTOS, municipiosDe } from '@/data/divipola';

import type { ReactNode } from 'react';

import type {
  BaseDraft,
  CaregiverRegDraft,
  PatientRegDraft,
  ProfessionalRegDraft,
} from './accessRegistrationFlow';
import { edadEnAnios, idDeCampo } from './accessRegistrationFlow';
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
  SI_NO_OPCIONES,
  TIPO_CUIDADOR_OPCIONES,
  TIPOS_ATENCION_OPCIONES,
  VECINO_RELACION_OPCIONES,
  ZONAS_COBERTURA_OPCIONES,
  ZONA_OPCIONES,
  etiquetaDe,
  type CatalogOption,
} from './accessRegistrationProfileData';
import type { AccessRequestDocumentType, AccessRequestSexGender } from './accessRequestClient';
import { ACCESS_REQUEST_DOCUMENT_TYPES, ACCESS_REQUEST_SEX_GENDERS } from './accessRequestClient';
import styles from './accessRegistration.module.css';

/**
 * Campos por rama y paso de la inscripción guiada (SPEC 038, MP04-C3).
 *
 * Componentes de PRESENTACIÓN sin estado propio: reciben el borrador, pintan
 * controles nativos con etiquetas persistentes y reportan cada cambio. La
 * validación, la purga de condicionales y el cuerpo viven en
 * `accessRegistrationFlow.ts`, no aquí.
 */

export interface CamposComunes {
  readonly campoInvalido: string | null;
  readonly enviando: boolean;
  readonly ponerBase: (campo: string, valor: string) => void;
  readonly ponerReg: (campo: string, valor: string | boolean) => void;
  readonly alternarReg: (campo: string, codigo: string) => void;
}

function ErrorCampo({ campo, invalido }: { campo: string; invalido: string | null }): ReactNode {
  if (invalido !== campo) {
    return null;
  }

  return (
    <p className={styles.fieldError} id={`${idDeCampo(campo)}-error`}>
      Complete este campo para continuar.
    </p>
  );
}

interface TextoProps extends CamposComunes {
  readonly campo: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly tipo?: string;
  readonly ayuda?: string;
  /** Ejemplo que complementa la etiqueta; nunca la sustituye. */
  readonly ejemplo?: string;
}

function CampoTexto({ campo, etiqueta, valor, tipo, ayuda, ejemplo, ...comunes }: TextoProps): ReactNode {
  const id = idDeCampo(campo);
  const invalido = comunes.campoInvalido === campo;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{etiqueta}</label>
      <input
        aria-describedby={`${id}-ayuda${invalido ? ` ${id}-error` : ''}`}
        aria-invalid={invalido}
        className={styles.input}
        id={id}
        name={campo}
        onChange={(event) => comunes.ponerReg(campo, event.target.value)}
        placeholder={ejemplo}
        required
        type={tipo ?? 'text'}
        value={valor}
      />
      {ayuda === undefined ? null : (
        <p className={styles.fieldHelp} id={`${id}-ayuda`}>
          {ayuda}
        </p>
      )}
      <ErrorCampo campo={campo} invalido={comunes.campoInvalido} />
    </div>
  );
}

interface SelectProps extends CamposComunes {
  readonly campo: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly opciones: ReadonlyArray<CatalogOption>;
  readonly opcionVacia?: string;
}

function CampoSelect({ campo, etiqueta, valor, opciones, opcionVacia, ...comunes }: SelectProps): ReactNode {
  const id = idDeCampo(campo);

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{etiqueta}</label>
      <select
        aria-invalid={comunes.campoInvalido === campo}
        className={styles.input}
        id={id}
        name={campo}
        onChange={(event) => comunes.ponerReg(campo, event.target.value)}
        value={valor}
      >
        {opcionVacia === undefined ? null : <option value="">{opcionVacia}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.code} value={opcion.code}>
            {opcion.label}
          </option>
        ))}
      </select>
      <ErrorCampo campo={campo} invalido={comunes.campoInvalido} />
    </div>
  );
}

interface ChipsProps extends CamposComunes {
  readonly campo: string;
  readonly leyenda: string;
  readonly opciones: ReadonlyArray<CatalogOption>;
  readonly valores: ReadonlyArray<string>;
  readonly nota?: string;
}

function CampoChips({ campo, leyenda, opciones, valores, nota, ...comunes }: ChipsProps): ReactNode {
  return (
    <div className={styles.field}>
      <span className={styles.legend} id={idDeCampo(campo)}>{leyenda}</span>
      {nota === undefined ? null : <p className={styles.fieldHelp}>{nota}</p>}
      <div className={styles.chips} role="group" aria-labelledby={idDeCampo(campo)}>
        {opciones.map((opcion) => {
          const activo = valores.includes(opcion.code);

          return (
            <button
              aria-pressed={activo}
              className={activo ? `${styles.chip} ${styles.chipActivo}` : styles.chip}
              disabled={comunes.enviando}
              key={opcion.code}
              onClick={() => comunes.alternarReg(campo, opcion.code)}
              type="button"
            >
              {opcion.label}
            </button>
          );
        })}
      </div>
      <ErrorCampo campo={campo} invalido={comunes.campoInvalido} />
    </div>
  );
}

interface RadiosProps extends CamposComunes {
  readonly campo: string;
  readonly leyenda: string;
  readonly opciones: ReadonlyArray<CatalogOption>;
  readonly valor: string;
}

function CampoRadios({ campo, leyenda, opciones, valor, ...comunes }: RadiosProps): ReactNode {
  return (
    <fieldset className={styles.field}>
      <legend className={styles.legend}>{leyenda}</legend>
      <div className={styles.radios}>
        {opciones.map((opcion) => (
          <label className={styles.radio} key={opcion.code}>
            <input
              checked={valor === opcion.code}
              name={idDeCampo(campo)}
              onChange={() => comunes.ponerReg(campo, opcion.code)}
              type="radio"
              value={opcion.code}
            />
            {opcion.label}
          </label>
        ))}
      </div>
      <ErrorCampo campo={campo} invalido={comunes.campoInvalido} />
    </fieldset>
  );
}

interface GeoProps extends CamposComunes {
  readonly prefijo: 'institucion' | 'zona';
  readonly departamento: string;
  readonly municipio: string;
  readonly etiquetaMunicipio?: string;
}

function CampoGeo({ prefijo, departamento, municipio, etiquetaMunicipio, ...comunes }: GeoProps): ReactNode {
  const campoDepto = `${prefijo}Departamento`;
  const campoMun = `${prefijo}Municipio`;
  const opcionesMun = departamento === '' ? [] : municipiosDe(departamento);

  return (
    <>
      <div className={styles.field}>
        <label htmlFor={idDeCampo(campoDepto)}>Departamento</label>
        <select
          aria-invalid={comunes.campoInvalido === campoDepto}
          className={styles.input}
          id={idDeCampo(campoDepto)}
          name={campoDepto}
          onChange={(event) => {
            comunes.ponerReg(campoDepto, event.target.value);
            comunes.ponerReg(campoMun, '');
          }}
          value={departamento}
        >
          <option value="">Elija el departamento</option>
          {DEPARTAMENTOS.map((item) => (
            <option key={item.codigo} value={item.codigo}>
              {item.nombre}
            </option>
          ))}
        </select>
        <ErrorCampo campo={campoDepto} invalido={comunes.campoInvalido} />
      </div>
      <div className={styles.field}>
        <label htmlFor={idDeCampo(campoMun)}>{etiquetaMunicipio ?? 'Municipio'}</label>
        <select
          aria-invalid={comunes.campoInvalido === campoMun}
          className={styles.input}
          disabled={departamento === ''}
          id={idDeCampo(campoMun)}
          name={campoMun}
          onChange={(event) => comunes.ponerReg(campoMun, event.target.value)}
          value={municipio}
        >
          <option value="">
            {departamento === '' ? 'Elija primero el departamento' : 'Elija el municipio'}
          </option>
          {opcionesMun.map((item) => (
            <option key={item.codigo} value={item.codigo}>
              {item.nombre}
            </option>
          ))}
        </select>
        {departamento === '' ? (
          <p className={styles.fieldHelp}>Se activa cuando elija un departamento.</p>
        ) : null}
        <ErrorCampo campo={campoMun} invalido={comunes.campoInvalido} />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Paso 1 compartido: identidad y contacto                                     */
/* -------------------------------------------------------------------------- */

export function CamposBasePaso1(
  props: CamposComunes & { readonly base: BaseDraft },
): ReactNode {
  const { base, campoInvalido, enviando, ponerBase } = props;
  const edad = edadEnAnios(base.birthDate, new Date().toISOString().slice(0, 10));

  const texto = (
    campo: 'documentNumber' | 'givenNames' | 'familyNames' | 'birthDate' | 'phone' | 'email',
    etiqueta: string,
    tipo?: string,
    ejemplo?: string,
  ): ReactNode => {
    const id = idDeCampo(campo);
    const invalido = campoInvalido === campo;

    return (
      <div className={styles.field} key={campo}>
        <label htmlFor={id}>{etiqueta}</label>
        <input
          aria-describedby={invalido ? `${id}-error` : undefined}
          aria-invalid={invalido}
          className={styles.input}
          disabled={enviando}
          id={id}
          name={campo}
          onChange={(event) => ponerBase(campo, event.target.value)}
          placeholder={ejemplo}
          required={campo !== 'phone' && campo !== 'email'}
          type={tipo ?? 'text'}
          value={base[campo]}
        />
        {invalido ? (
          <p className={styles.fieldError} id={`${id}-error`}>
            Complete este campo para continuar.
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className={styles.field}>
        <label htmlFor={idDeCampo('documentType')}>Tipo de documento</label>
        <select
          className={styles.input}
          disabled={enviando}
          id={idDeCampo('documentType')}
          name="documentType"
          onChange={(event) => ponerBase('documentType', event.target.value as AccessRequestDocumentType)}
          value={base.documentType}
        >
          {ACCESS_REQUEST_DOCUMENT_TYPES.map((tipo) => (
            <option key={tipo.code} value={tipo.code}>
              {tipo.label}
            </option>
          ))}
        </select>
      </div>
      {texto('documentNumber', 'Número de documento', 'text', 'Ej. 1032455789')}
      <div className={styles.filaGrid}>
        {texto('givenNames', 'Nombres', 'text', 'Ej. María')}
        {texto('familyNames', 'Apellidos', 'text', 'Ej. Rodríguez')}
      </div>
      <div className={styles.filaEdad}>
        {texto('birthDate', 'Fecha de nacimiento', 'date')}
        <span className={styles.edad} aria-label={edad === null ? 'Edad sin calcular' : `Edad ${String(edad)} años`}>
          {edad === null ? 'Edad —' : `Edad ${String(edad)} años`}
        </span>
      </div>
      <div className={styles.field}>
        <label htmlFor={idDeCampo('sexGenderCode')}>Sexo o género</label>
        <select
          className={styles.input}
          disabled={enviando}
          id={idDeCampo('sexGenderCode')}
          name="sexGenderCode"
          onChange={(event) => ponerBase('sexGenderCode', event.target.value as AccessRequestSexGender)}
          value={base.sexGenderCode}
        >
          {ACCESS_REQUEST_SEX_GENDERS.map((opcion) => (
            <option key={opcion.code} value={opcion.code}>
              {opcion.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.filaGrid}>
        {texto('phone', 'Teléfono (opcional, al menos uno)', 'text', 'Ej. 300 456 7890')}
        {texto('email', 'Correo electrónico (opcional, al menos uno)', 'email', 'Ej. nombre@correo.com')}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Paciente                                                                    */
/* -------------------------------------------------------------------------- */

export function CamposPaciente(
  props: CamposComunes & { readonly paso: 2 | 3 | 4; readonly reg: PatientRegDraft },
): ReactNode {
  const { paso, reg, ...comunes } = props;

  if (paso === 2) {
    return (
      <>
        <CampoRadios
          {...comunes}
          campo="necesitaApoyo"
          leyenda="¿Necesita apoyo en casa?"
          opciones={NECESITA_APOYO_OPCIONES}
          valor={reg.necesitaApoyo}
        />
        {reg.necesitaApoyo === 'SI' ? (
          <CampoChips
            {...comunes}
            campo="apoyos"
            leyenda="Tipo de apoyo que necesita · puede marcar varios"
            nota="Marque al menos uno."
            opciones={APOYOS_OPCIONES}
            valores={reg.apoyos}
          />
        ) : null}
        <CampoChips
          {...comunes}
          campo="condiciones"
          leyenda="¿Tiene alguna de estas condiciones?"
          nota="Son declaraciones suyas, no diagnósticos validados. Si no tiene ninguna, marque «Ninguna»."
          opciones={CONDICIONES_OPCIONES}
          valores={reg.condiciones}
        />
      </>
    );
  }

  if (paso === 3) {
    return (
      <>
        <CampoSelect
          {...comunes}
          campo="zona"
          etiqueta="Zona"
          opciones={ZONA_OPCIONES}
          opcionVacia="Elija una opción"
          valor={reg.zona}
        />
        <CampoSelect
          {...comunes}
          campo="eps"
          etiqueta="EPS a la que pertenece"
          opciones={EPS_PACIENTE_OPCIONES}
          valor={reg.eps}
        />
        <CampoTexto
          {...comunes}
          campo="direccion"
          etiqueta="Dirección completa"
          ejemplo="Ej. Cra 45 # 32-16"
          valor={reg.direccion}
        />
      </>
    );
  }

  return (
    <>
      <CampoTexto
        {...comunes}
        campo="contactoNombre"
        etiqueta="Nombre completo del contacto familiar"
          ejemplo="Ej. Carlos Rodríguez"
        valor={reg.contactoNombre}
      />
      <CampoTexto
        {...comunes}
        campo="contactoParentesco"
        etiqueta="Parentesco"
          ejemplo="Ej. Hijo"
        valor={reg.contactoParentesco}
      />
      <CampoTexto
        {...comunes}
        campo="contactoTelefono"
        etiqueta="Teléfono del contacto familiar"
          ejemplo="Ej. 311 220 3355"
        valor={reg.contactoTelefono}
      />
      <CampoTexto
        {...comunes}
        campo="vecinoNombre"
        etiqueta="Nombre del vecino o contacto cercano"
          ejemplo="Ej. Rosa Delgado"
        valor={reg.vecinoNombre}
      />
      <CampoTexto
        {...comunes}
        campo="vecinoTelefono"
        etiqueta="Teléfono del vecino o contacto cercano"
          ejemplo="Ej. 312 778 4410"
        valor={reg.vecinoTelefono}
      />
      <div className={styles.field}>
        <label className={styles.check} htmlFor={idDeCampo('vecinoAutorizado')}>
          <input
            checked={reg.vecinoAutorizado}
            id={idDeCampo('vecinoAutorizado')}
            name="vecinoAutorizado"
            onChange={(event) => comunes.ponerReg('vecinoAutorizado', event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Autorización del contacto cercano.</strong> Confirmo que esta persona puede
            ser contactada únicamente cuando sea necesario localizarme o apoyarme en una
            situación relacionada con mi atención.
          </span>
        </label>
        <ErrorCampo campo="vecinoAutorizado" invalido={comunes.campoInvalido} />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Cuidador                                                                    */
/* -------------------------------------------------------------------------- */

export function CamposCuidador(
  props: CamposComunes & { readonly paso: 2 | 3 | 4; readonly reg: CaregiverRegDraft },
): ReactNode {
  const { paso, reg, ...comunes } = props;

  if (paso === 2) {
    return (
      <>
        <CampoSelect
          {...comunes}
          campo="tipoCuidador"
          etiqueta="¿Qué tipo de cuidador es?"
          opciones={TIPO_CUIDADOR_OPCIONES}
          valor={reg.tipoCuidador}
        />
        <CampoRadios
          {...comunes}
          campo="tieneFormacion"
          leyenda="¿Cuenta con formación o certificación como cuidador?"
          opciones={SI_NO_OPCIONES}
          valor={reg.tieneFormacion}
        />
        {reg.tieneFormacion === 'SI' ? (
          <>
            <CampoSelect
              {...comunes}
              campo="institucionFormacion"
              etiqueta="Institución"
              opciones={INSTITUCION_FORMACION_OPCIONES}
              valor={reg.institucionFormacion}
            />
            <p className={styles.fieldHelp}>El soporte se puede cargar más adelante desde su perfil.</p>
          </>
        ) : null}
        <CampoRadios
          {...comunes}
          campo="viveConPaciente"
          leyenda="¿Vive con el paciente?"
          opciones={SI_NO_OPCIONES}
          valor={reg.viveConPaciente}
        />
        <CampoChips
          {...comunes}
          campo="horarios"
          leyenda="Horario habitual de cuidado · puede marcar varios"
          opciones={HORARIOS_OPCIONES}
          valores={reg.horarios}
        />
      </>
    );
  }

  if (paso === 3) {
    return (
      <>
        <CampoRadios
          {...comunes}
          campo="pacienteRegistrado"
          leyenda="¿El paciente ya está registrado?"
          opciones={PACIENTE_REGISTRADO_OPCIONES}
          valor={reg.pacienteRegistrado}
        />
        {reg.pacienteRegistrado === 'SI' ? (
          <p className={styles.fieldHelp}>
            La búsqueda del paciente no está disponible en este registro: no se consulta
            ningún registro y no se crea ningún vínculo.
          </p>
        ) : null}
        {reg.pacienteRegistrado === 'NO' ? (
          <p className={styles.fieldHelp}>
            Podrá iniciar el registro básico del paciente más adelante. Aquí no se crea
            ninguna ficha.
          </p>
        ) : null}
        <CampoSelect
          {...comunes}
          campo="relacionPaciente"
          etiqueta="Relación con el paciente"
          opciones={RELACION_PACIENTE_OPCIONES}
          valor={reg.relacionPaciente}
        />
      </>
    );
  }

  return (
    <>
      <CampoTexto
        {...comunes}
        campo="vecinoNombre"
        etiqueta="Nombre del contacto cercano"
          ejemplo="Ej. Rosa Delgado"
        valor={reg.vecinoNombre}
      />
      <CampoTexto
        {...comunes}
        campo="vecinoTelefono"
        etiqueta="Teléfono del contacto cercano"
          ejemplo="Ej. 312 778 4410"
        valor={reg.vecinoTelefono}
      />
      <CampoSelect
        {...comunes}
        campo="vecinoRelacion"
        etiqueta="Relación con el paciente"
        opciones={VECINO_RELACION_OPCIONES}
        valor={reg.vecinoRelacion}
      />
      <CampoTexto
        {...comunes}
        campo="vecinoDireccion"
        etiqueta="Dirección o referencia"
          ejemplo="Ej. Casa de al lado"
        valor={reg.vecinoDireccion}
      />
      <div className={styles.field}>
        <label className={styles.check} htmlFor={idDeCampo('vecinoAutorizado')}>
          <input
            checked={reg.vecinoAutorizado}
            id={idDeCampo('vecinoAutorizado')}
            name="vecinoAutorizado"
            onChange={(event) => comunes.ponerReg('vecinoAutorizado', event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Autorización del contacto cercano.</strong> Autorizo el uso de este contacto
            exclusivamente para localizar al paciente y apoyar su atención.
          </span>
        </label>
        <ErrorCampo campo="vecinoAutorizado" invalido={comunes.campoInvalido} />
      </div>
    </>
  );
}



/* -------------------------------------------------------------------------- */
/* Visitador médico                                                            */
/* -------------------------------------------------------------------------- */

export function CamposVisitador(
  props: CamposComunes & { readonly paso: 2 | 3 | 4; readonly reg: ProfessionalRegDraft },
): ReactNode {
  const { paso, reg, ...comunes } = props;

  if (paso === 2) {
    return (
      <>
        <CampoSelect
          {...comunes}
          campo="profesion"
          etiqueta="Profesión"
          opciones={PROFESION_OPCIONES}
          valor={reg.profesion}
        />
        <CampoChips
          {...comunes}
          campo="tiposAtencion"
          leyenda="Tipo de atención que realiza · puede marcar varios"
          opciones={TIPOS_ATENCION_OPCIONES}
          valores={reg.tiposAtencion}
        />
      </>
    );
  }

  if (paso === 3) {
    return (
      <>
        <CampoSelect
          {...comunes}
          campo="eps"
          etiqueta="EPS a la que pertenece o para la cual presta servicios"
          opciones={EPS_VISITADOR_OPCIONES}
          valor={reg.eps}
        />
        {reg.eps === 'OTRA_EPS' ? (
          <CampoTexto
            {...comunes}
            campo="otraEps"
            etiqueta="Escriba el nombre de la EPS"
          ejemplo="Ej. Nombre de la EPS"
            valor={reg.otraEps}
          />
        ) : null}
        <p className={styles.fieldHelp}>
          La institución se registra aparte de la EPS: una IPS o ESE puede atender pacientes
          afiliados a varias EPS.
        </p>
        <CampoTexto
          {...comunes}
          campo="institucion"
          etiqueta="Hospital, ESE, IPS o institución (opcional)"
          ejemplo="Ej. ESE Hospital municipal"
          valor={reg.institucion}
        />
        <CampoGeo
          {...comunes}
          departamento={reg.institucionDepartamento}
          municipio={reg.institucionMunicipio}
          prefijo="institucion"
        />
        <CampoTexto
          {...comunes}
          campo="cargo"
          etiqueta="Cargo (opcional)"
          ejemplo="Ej. Médico domiciliario"
          valor={reg.cargo}
        />
      </>
    );
  }

  return (
    <>
      <CampoGeo
        {...comunes}
        departamento={reg.zonaDepartamento}
        etiquetaMunicipio="Municipio principal"
        municipio={reg.zonaMunicipio}
        prefijo="zona"
      />
      <CampoChips
        {...comunes}
        campo="zonas"
        leyenda="Tipo de zona que cubre · puede marcar varios"
        opciones={ZONAS_COBERTURA_OPCIONES}
        valores={reg.zonas}
      />
      <CampoTexto
        {...comunes}
        campo="sector"
        etiqueta="Zona o sector asignado (opcional)"
          ejemplo="Ej. Sector nororiental"
        valor={reg.sector}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Resumen de confirmación (paso 5): jamás incluye la credencial               */
/* -------------------------------------------------------------------------- */

function Fila({ titulo, valor }: { titulo: string; valor: string }): ReactNode {
  return (
    <div>
      <dt>{titulo}</dt>
      <dd>{valor === '' ? 'Sin indicar' : valor}</dd>
    </div>
  );
}

function listaDe(opciones: ReadonlyArray<CatalogOption>, codigos: ReadonlyArray<string>): string {
  if (codigos.length === 0) {
    return 'Ninguno';
  }

  return codigos.map((codigo) => etiquetaDe(opciones, codigo)).join(' · ');
}

export function ResumenExpediente(props: {
  readonly perfil: 'PATIENT' | 'CAREGIVER' | 'FIELD_PROFESSIONAL';
  readonly base: BaseDraft;
  readonly reg: PatientRegDraft | CaregiverRegDraft | ProfessionalRegDraft;
}): ReactNode {
  const { perfil, base, reg } = props;

  return (
    <dl className={styles.summary}>
      <Fila titulo="Perfil" valor={perfil === 'PATIENT' ? 'Paciente' : perfil === 'CAREGIVER' ? 'Cuidador' : 'Visitador médico'} />
      <Fila titulo="Documento" valor={`${base.documentNumber}`} />
      <Fila titulo="Nombre" valor={`${base.givenNames} ${base.familyNames}`} />
      <Fila titulo="Contacto" valor={[base.phone, base.email].filter((v) => v !== '').join(' · ')} />
      {perfil === 'PATIENT' && 'condiciones' in reg ? (
        <>
          <Fila titulo="Apoyo declarado" valor={reg.necesitaApoyo === 'SI' ? listaDe(APOYOS_OPCIONES, reg.apoyos) : etiquetaDe(NECESITA_APOYO_OPCIONES, reg.necesitaApoyo)} />
          <Fila titulo="Condiciones declaradas" valor={listaDe(CONDICIONES_OPCIONES, reg.condiciones)} />
          <Fila titulo="Zona y EPS" valor={`${etiquetaDe(ZONA_OPCIONES, reg.zona)} · ${etiquetaDe(EPS_PACIENTE_OPCIONES, reg.eps)}`} />
          <Fila titulo="Dirección" valor={reg.direccion} />
          <Fila titulo="Contacto familiar" valor={`${reg.contactoNombre} (${reg.contactoParentesco}) · ${reg.contactoTelefono}`} />
          <Fila titulo="Contacto cercano" valor={`${reg.vecinoNombre} · ${reg.vecinoTelefono}`} />
        </>
      ) : null}
      {perfil === 'CAREGIVER' && 'horarios' in reg ? (
        <>
          <Fila titulo="Tipo de cuidador" valor={etiquetaDe(TIPO_CUIDADOR_OPCIONES, reg.tipoCuidador)} />
          <Fila titulo="Formación" valor={reg.tieneFormacion === 'SI' ? etiquetaDe(INSTITUCION_FORMACION_OPCIONES, reg.institucionFormacion) : 'No'} />
          <Fila titulo="Horarios" valor={listaDe(HORARIOS_OPCIONES, reg.horarios)} />
          <Fila titulo="Paciente" valor={`${etiquetaDe(RELACION_PACIENTE_OPCIONES, reg.relacionPaciente)} · Registro: ${etiquetaDe(PACIENTE_REGISTRADO_OPCIONES, reg.pacienteRegistrado)}`} />
          <Fila titulo="Contacto cercano" valor={`${reg.vecinoNombre} · ${reg.vecinoTelefono} · ${reg.vecinoDireccion}`} />
        </>
      ) : null}
      {perfil === 'FIELD_PROFESSIONAL' && 'zonas' in reg ? (
        <>
          <Fila titulo="Profesión" valor={etiquetaDe(PROFESION_OPCIONES, reg.profesion)} />
          <Fila titulo="Atención" valor={listaDe(TIPOS_ATENCION_OPCIONES, reg.tiposAtencion)} />
          <Fila titulo="EPS" valor={etiquetaDe(EPS_VISITADOR_OPCIONES, reg.eps)} />
          <Fila titulo="Institución" valor={`${reg.institucion} · ${reg.institucionMunicipio}`} />
          <Fila titulo="Zona" valor={`${reg.zonaMunicipio} · ${listaDe(ZONAS_COBERTURA_OPCIONES, reg.zonas)}`} />
        </>
      ) : null}
    </dl>
  );
}
