import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

import styles from './ui.module.css';

/**
 * Campos de formulario accesibles (TASK-002).
 *
 * - Label visible siempre asociado al control.
 * - Error asociado con `aria-describedby` + `aria-invalid`, con marca textual
 *   además del color (no se comunica el estado solo por color).
 */

interface FieldProps {
  readonly children: ReactNode;
}

export function Field({ children }: FieldProps): ReactNode {
  return <div className={styles.field}>{children}</div>;
}

interface LabelProps {
  readonly htmlFor: string;
  readonly large?: boolean;
  /** Añade la marca `*` con su equivalente accesible «obligatorio». */
  readonly required?: boolean;
  readonly children: ReactNode;
}

export function Label({
  htmlFor,
  large = false,
  required = false,
  children,
}: LabelProps): ReactNode {
  const classes = [styles.fieldLabel];
  if (large) {
    classes.push(styles.fieldLabelLarge);
  }
  return (
    <label htmlFor={htmlFor} className={classes.join(' ')}>
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  );
}

/**
 * Marca de campo obligatorio. El asterisco es visual; la tecnología asistiva
 * lee la palabra, de modo que la obligatoriedad no depende de un símbolo.
 */
export function RequiredMark(): ReactNode {
  return (
    <>
      <span aria-hidden="true" className={styles.fieldRequired}>
        {' *'}
      </span>
      <span className="merdn-sr-only"> (campo obligatorio)</span>
    </>
  );
}

/** Aviso visible que explica el significado de la marca `*` en un formulario. */
export function RequiredLegend(): ReactNode {
  return (
    <p className={styles.fieldRequiredLegend}>
      <span aria-hidden="true" className={styles.fieldRequired}>
        *
      </span>{' '}
      Los campos marcados con asterisco son obligatorios.
    </p>
  );
}

export function FieldHint({
  id,
  children,
}: {
  readonly id: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <p id={id} className={styles.fieldHint}>
      {children}
    </p>
  );
}

export function FieldError({
  id,
  children,
}: {
  readonly id: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <p id={id} role="alert" className={styles.fieldError}>
      <span aria-hidden="true" className={styles.fieldErrorMark}>
        !
      </span>
      <span>
        <span className="merdn-sr-only">Error: </span>
        {children}
      </span>
    </p>
  );
}

export type ControlSize = 'default' | 'large' | 'compact';

const SIZE_CLASS: Record<ControlSize, string | undefined> = {
  default: undefined,
  large: styles.controlLarge,
  compact: styles.controlCompact,
};

function controlClassName(
  size: ControlSize,
  options: { readonly invalid: boolean; readonly filled: boolean; readonly extra?: string },
): string {
  const classes = [styles.control];
  const sizeClass = SIZE_CLASS[size];
  if (sizeClass !== undefined) {
    classes.push(sizeClass);
  }
  if (options.extra !== undefined) {
    classes.push(options.extra);
  }
  if (options.invalid) {
    classes.push(styles.controlInvalid);
  } else if (options.filled) {
    classes.push(styles.controlFilled);
  }
  return classes.join(' ');
}

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {
  readonly size?: ControlSize;
  readonly invalid?: boolean;
  /** Marca visual del prototipo para un campo con contenido. */
  readonly filled?: boolean;
}

export function Input({
  size = 'default',
  invalid = false,
  filled = false,
  ...rest
}: InputProps): ReactNode {
  return (
    <input
      className={controlClassName(size, { invalid, filled })}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  readonly invalid?: boolean;
  readonly filled?: boolean;
}

export function Textarea({
  invalid = false,
  filled = false,
  ...rest
}: TextareaProps): ReactNode {
  return (
    <textarea
      className={controlClassName('default', {
        invalid,
        filled,
        extra: styles.controlText,
      })}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

/** Opción con valor propio, para catálogos con código oficial. */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/** Una opción es su propio valor visible, o un par código/nombre. */
export type SelectOptions = readonly (string | SelectOption)[];

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'> {
  /** Opciones en el orden exacto del diseño aprobado o del catálogo oficial. */
  readonly options: SelectOptions;
  /** Texto de la opción vacía inicial; se omite cuando ya hay valor obligado. */
  readonly placeholder?: string;
  readonly invalid?: boolean;
}

/**
 * Lista desplegable nativa (TASK-002A). Se usa el `select` del navegador para
 * conservar teclado, lectura por tecnología asistiva y comportamiento móvil.
 *
 * El estado deshabilitado se comunica programáticamente con `disabled`, no solo
 * con color.
 */
export function Select({
  options,
  placeholder,
  invalid = false,
  ...rest
}: SelectProps): ReactNode {
  const classes = [styles.control, styles.controlSelect];
  if (invalid) {
    classes.push(styles.controlInvalid);
  }

  return (
    <select
      className={classes.join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {placeholder === undefined ? null : <option value="">{placeholder}</option>}
      {options.map((option) => {
        const value = typeof option === 'string' ? option : option.value;
        const label = typeof option === 'string' ? option : option.label;
        return (
          <option key={value} value={value}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

interface FieldGroupProps {
  readonly legend: string;
  readonly hiddenLegend?: boolean;
  readonly describedBy?: string;
  readonly children: ReactNode;
}

/** Agrupación semántica de opciones relacionadas (`fieldset` + `legend`). */
export function FieldGroup({
  legend,
  hiddenLegend = false,
  describedBy,
  children,
}: FieldGroupProps): ReactNode {
  return (
    <fieldset className={styles.group} aria-describedby={describedBy}>
      <legend
        className={
          hiddenLegend
            ? `${styles.groupLegend} ${styles.groupLegendHidden}`
            : styles.groupLegend
        }
      >
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}
