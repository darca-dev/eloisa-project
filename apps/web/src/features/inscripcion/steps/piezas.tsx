import type { Dispatch, ReactNode } from 'react';
import { useState, useEffect } from 'react';

import {
  Button
} from '@/components/ui/Button';
import {
  Field,
  FieldError,
  FieldHint,
  Input,
  Label,
  RequiredLegend,
  Select,
  Textarea,
} from '@/components/ui/Field';
import type { SelectOptions } from '@/components/ui/Field';
import { DEPARTAMENTOS, municipiosDe } from '@/data/divipola';

import { camposUbicacion } from '../inscripcionFlow';
import type { InscripcionAction, Ubicacion, UbicacionId } from '../inscripcionFlow';
import styles from '../inscripcion.module.css';

/**
 * Piezas compartidas por las tres ramas de inscripción (TASK-002A).
 *
 * Componen los primitivos accesibles ya aprobados en TASK-002 (`Field`,
 * `Label`, `Input`, `Textarea`, `Select`, `FieldError`) con la composición de
 * `Eligeme-Inscripcion.dc.html`. No introducen controles nuevos ni dependencias.
 *
 * Los campos son obligatorios por omisión: en Paciente y Cuidador todos los
 * datos solicitados lo son (FR-04). La rama Visitador marca explícitamente los
 * que su flujo aprobado no exige.
 */

/** Id estable del control de un campo: permite mover el foco al primer error. */
export function idCampo(campo: string): string {
  return `inscripcion-${campo}`;
}

/** Id estable del mensaje de error asociado a un campo. */
export function idError(campo: string): string {
  return `inscripcion-error-${campo}`;
}

export { RequiredLegend };

export function Seccion({
  eyebrow,
  acento = false,
  children,
}: {
  readonly eyebrow: string;
  readonly acento?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.block}>
      <p className={acento ? `${styles.eyebrow} ${styles.eyebrowAccent}` : styles.eyebrow}>
        {eyebrow}
      </p>
      {children}
    </div>
  );
}

export function Fila({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className={styles.row}>{children}</div>;
}

export function FilaItem({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className={styles.rowItem}>{children}</div>;
}

export function Separador(): ReactNode {
  return <div className={styles.divider} />;
}

interface CampoBase {
  readonly campo: string;
  readonly label: string;
  readonly value: string;
  readonly error?: string | undefined;
  readonly hint?: string;
  readonly placeholder?: string;
  /** `false` solo en la rama Visitador, donde su flujo aprobado no lo exige. */
  readonly obligatorio?: boolean;
}

function describedBy(
  campo: string,
  hint: string | undefined,
  error: string | undefined,
): string | undefined {
  const ids = [
    hint === undefined ? undefined : `${idCampo(campo)}-ayuda`,
    error === undefined ? undefined : idError(campo),
  ].filter((id): id is string => id !== undefined);
  return ids.length === 0 ? undefined : ids.join(' ');
}

export function CampoTexto({
  campo,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  obligatorio = true,
  tipo = 'text',
  inputMode,
}: CampoBase & {
  readonly onChange: (valor: string) => void;
  readonly tipo?: 'text' | 'date' | 'email';
  readonly inputMode?: 'text' | 'numeric' | 'tel' | 'email';
}): ReactNode {
  return (
    <Field>
      <Label htmlFor={idCampo(campo)} required={obligatorio}>
        {label}
      </Label>
      <Input
        id={idCampo(campo)}
        type={tipo}
        size="compact"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        invalid={error !== undefined}
        aria-required={obligatorio || undefined}
        aria-describedby={describedBy(campo, hint, error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint === undefined ? null : (
        <FieldHint id={`${idCampo(campo)}-ayuda`}>{hint}</FieldHint>
      )}
      {error === undefined ? null : <FieldError id={idError(campo)}>{error}</FieldError>}
    </Field>
  );
}

export function CampoTextoLargo({
  campo,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  obligatorio = true,
}: CampoBase & { readonly onChange: (valor: string) => void }): ReactNode {
  return (
    <Field>
      <Label htmlFor={idCampo(campo)} required={obligatorio}>
        {label}
      </Label>
      <Textarea
        id={idCampo(campo)}
        rows={3}
        value={value}
        placeholder={placeholder}
        invalid={error !== undefined}
        aria-required={obligatorio || undefined}
        aria-describedby={describedBy(campo, hint, error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint === undefined ? null : (
        <FieldHint id={`${idCampo(campo)}-ayuda`}>{hint}</FieldHint>
      )}
      {error === undefined ? null : <FieldError id={idError(campo)}>{error}</FieldError>}
    </Field>
  );
}

/**
 * Campo de contraseña con toggle mostrar/ocultar y barra de fortaleza visual.
 * Validación cliente: mínimo 8 caracteres, al menos 1 letra y 1 número.
 */
export function CampoContrasena({
  campo,
  label,
  value,
  onChange,
  error,
  obligatorio = true,
  placeholder,
}: CampoBase & {
  readonly onChange: (valor: string) => void;
  readonly placeholder?: string;
}): ReactNode {
  const [show, setShow] = useState(false);
  const [strength, setStrength] = useState(0);

  // Calcular fortaleza en tiempo real
  useEffect(() => {
    let s = 0;
    if (value.length >= 8) s++;
    if (/[a-zA-Z]/.test(value)) s++;
    if (/\d/.test(value)) s++;
    setStrength(s);
  }, [value]);

  const strengthLabels = ['Muy débil', 'Débil', 'Media', 'Fuerte'];
  const strengthColors = ['var(--b-rojo)', 'var(--b-naranja)', 'var(--b-amarillo)', 'var(--b-verde)'];

  return (
    <Field>
      <Label htmlFor={idCampo(campo)} required={obligatorio}>
        {label}
      </Label>
      <div className={styles.passwordWrapper}>
        <Input
          id={idCampo(campo)}
          type={show ? 'text' : 'password'}
          size="compact"
          inputMode="text"
          autoComplete="new-password"
          value={value}
          placeholder={placeholder}
          invalid={error !== undefined}
          aria-required={obligatorio || undefined}
          aria-describedby={describedBy(campo, undefined, error)}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className={styles.passwordToggle}>
          <Button
            variant="pill"
            type="button"
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setShow(!show)}
          >
            <span aria-hidden="true">{show ? '🙈' : '👁️'}</span>
          </Button>
        </div>
      </div>
      <div className={styles.strengthContainer} role="progressbar" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={3} aria-label="Fortaleza de contraseña">
        <div
          className={styles.strengthBar}
          style={{
            width: `${(strength / 3) * 100}%`,
            backgroundColor: strengthColors[strength] ?? 'transparent',
          }}
        />
      </div>
      <p className={styles.strengthLabel} aria-hidden="true">
        {strength > 0 ? strengthLabels[strength - 1] : ''}
      </p>
      <p className={styles.passwordHelp}>Mínimo 8 caracteres, al menos una letra y un número.</p>
      {error === undefined ? null : <FieldError id={idError(campo)}>{error}</FieldError>}
    </Field>
  );
}

export function CampoLista({
  campo,
  label,
  value,
  options,
  onChange,
  error,
  hint,
  placeholder,
  disabled = false,
  obligatorio = true,
}: {
  readonly campo: string;
  readonly label: string;
  readonly value: string;
  readonly options: SelectOptions;
  readonly onChange: (valor: string) => void;
  readonly error?: string | undefined;
  readonly hint?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly obligatorio?: boolean;
}): ReactNode {
  return (
    <Field>
      <Label htmlFor={idCampo(campo)} required={obligatorio}>
        {label}
      </Label>
      <Select
        id={idCampo(campo)}
        options={options}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        invalid={error !== undefined}
        aria-required={obligatorio || undefined}
        aria-describedby={describedBy(campo, hint, error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint === undefined ? null : (
        <FieldHint id={`${idCampo(campo)}-ayuda`}>{hint}</FieldHint>
      )}
      {error === undefined ? null : <FieldError id={idError(campo)}>{error}</FieldError>}
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* Ubicación territorial (FR-04A)                                              */
/* -------------------------------------------------------------------------- */

const OPCIONES_DEPARTAMENTO: SelectOptions = DEPARTAMENTOS.map((departamento) => ({
  value: departamento.codigo,
  label: departamento.nombre,
}));

interface GrupoUbicacionProps {
  /** Grupo de ubicación al que pertenece dentro de la rama. */
  readonly grupo: UbicacionId;
  /** Prefijo de los identificadores de campo y de error. */
  readonly prefijo: string;
  readonly ubicacion: Ubicacion;
  readonly errores: Readonly<Partial<Record<string, string>>>;
  readonly dispatch: Dispatch<InscripcionAction>;
  /** Etiqueta del municipio; algunas pantallas lo llaman «Municipio principal». */
  readonly etiquetaMunicipio?: string;
  /** El corregimiento no es obligatorio en la rama Visitador. */
  readonly corregimientoObligatorio?: boolean;
}

/**
 * Departamento, Municipio dependiente y Nombre del corregimiento, en ese orden
 * exacto (FR-04A).
 *
 * Las opciones proceden del catálogo local versionado derivado de DANE DIVIPOLA
 * (`@/data/divipola`): la selección funciona sin conexión y no se consulta a
 * DANE en tiempo de ejecución. Municipio permanece deshabilitado —de forma
 * programática, no solo por color— hasta que se elige Departamento, y al
 * cambiar de Departamento se descarta el municipio que ya no le pertenece.
 */
export function GrupoUbicacion({
  grupo,
  prefijo,
  ubicacion,
  errores,
  dispatch,
  etiquetaMunicipio = 'Municipio',
  corregimientoObligatorio = true,
}: GrupoUbicacionProps): ReactNode {
  const campos = camposUbicacion(prefijo);
  const sinDepartamento = ubicacion.departamento.length === 0;
  const municipios = municipiosDe(ubicacion.departamento);

  return (
    <>
      <Fila>
        <FilaItem>
          <CampoLista
            campo={campos.departamento}
            label="Departamento"
            value={ubicacion.departamento}
            options={OPCIONES_DEPARTAMENTO}
            placeholder="Elija el departamento"
            error={errores[campos.departamento]}
            onChange={(codigo) => dispatch({ type: 'elegirDepartamento', grupo, codigo })}
          />
        </FilaItem>
        <FilaItem>
          <CampoLista
            campo={campos.municipio}
            label={etiquetaMunicipio}
            value={ubicacion.municipio}
            options={municipios.map((municipio) => ({
              value: municipio.codigo,
              label: municipio.nombre,
            }))}
            placeholder={
              sinDepartamento ? 'Elija primero el departamento' : 'Elija el municipio'
            }
            disabled={sinDepartamento}
            hint={
              sinDepartamento
                ? 'Se activa cuando elija un departamento.'
                : undefined
            }
            error={errores[campos.municipio]}
            onChange={(codigo) => dispatch({ type: 'elegirMunicipio', grupo, codigo })}
          />
        </FilaItem>
      </Fila>
      <CampoTexto
        campo={campos.corregimiento}
        label="Nombre del corregimiento"
        placeholder="Ej. San Antonio"
        obligatorio={corregimientoObligatorio}
        value={ubicacion.corregimiento}
        error={errores[campos.corregimiento]}
        onChange={(texto) => dispatch({ type: 'escribirCorregimiento', grupo, texto })}
      />
    </>
  );
}

export function SubPanel({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className={styles.subPanel}>{children}</div>;
}

export function PanelObligatorio({
  eyebrow,
  titulo,
  descripcion,
  children,
}: {
  readonly eyebrow: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.requiredPanel}>
      <div className={styles.blockTight}>
        <p className={`${styles.eyebrow} ${styles.eyebrowAccent}`}>{eyebrow}</p>
        <p className={styles.blockTitle}>{titulo}</p>
        <p className={styles.blockBody}>{descripcion}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Error de un grupo de opciones (casillas, segmentos o chips), que no pertenece
 * a un único control. Recibe el foco mediante un ancla enfocable.
 */
export function ErrorGrupo({
  campo,
  mensaje,
}: {
  readonly campo: string;
  readonly mensaje: string | undefined;
}): ReactNode {
  if (mensaje === undefined) {
    return null;
  }
  return (
    <div>
      <span id={idCampo(campo)} tabIndex={-1} className={styles.groupAnchor} />
      <FieldError id={idError(campo)}>{mensaje}</FieldError>
    </div>
  );
}

/**
 * Acción presente en el diseño aprobado que en esta demostración no ejecuta
 * ninguna función: se marca como inerte y se explica con un texto compartido.
 */
export function AccionDemostrativa({
  children,
  avisoId,
  variant = 'outline',
}: {
  readonly children: ReactNode;
  readonly avisoId: string;
  readonly variant?: 'outline' | 'pill';
}): ReactNode {
  return (
    <Button variant={variant} aria-disabled="true" aria-describedby={avisoId}>
      {children}
    </Button>
  );
}
