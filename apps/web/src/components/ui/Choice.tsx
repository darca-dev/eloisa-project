import type { ChangeEventHandler, ReactNode } from 'react';

import styles from './choice.module.css';

/**
 * Controles de elección de First Run 1a (TASK-002).
 *
 * Cada control envuelve un `input` nativo (radio o checkbox) visualmente
 * oculto: el teclado, el nombre accesible y el estado marcado provienen del
 * control nativo; el diseño aprobado se aplica al contenedor.
 */

interface BaseOptionProps {
  /** Id del control nativo; permite mover el foco al primer error del grupo. */
  readonly id?: string;
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
  readonly describedBy?: string;
}

function optionClasses(base: string, checked: boolean, extra?: string): string {
  const classes = [styles.option, base];
  if (extra !== undefined) {
    classes.push(extra);
  }
  if (checked) {
    classes.push(styles.optionSelected);
  }
  return classes.join(' ');
}

function NativeInput({
  id,
  type,
  name,
  value,
  checked,
  onChange,
  describedBy,
}: BaseOptionProps & { readonly type: 'radio' | 'checkbox' }): ReactNode {
  return (
    <input
      id={id}
      className={styles.nativeInput}
      type={type}
      name={name}
      value={value}
      checked={checked}
      onChange={onChange}
      aria-describedby={describedBy}
    />
  );
}

/* ------------------------------ Tarjeta de rol --------------------------- */

export function RoleCard({
  title,
  subtitle,
  ...option
}: BaseOptionProps & { readonly title: string; readonly subtitle: string }): ReactNode {
  return (
    <label className={optionClasses(styles.roleCard, option.checked)}>
      <NativeInput type="radio" {...option} />
      <span className={styles.roleTitle}>{title}</span>
      <span className={styles.roleSubtitle}>{subtitle}</span>
    </label>
  );
}

/* ------------------------------ Casilla en fila -------------------------- */

export function CheckOption({
  title,
  subtitle,
  ...option
}: BaseOptionProps & { readonly title: string; readonly subtitle: string }): ReactNode {
  return (
    <label className={optionClasses(styles.rowOption, option.checked)}>
      <NativeInput type="checkbox" {...option} />
      <span
        aria-hidden="true"
        className={
          option.checked ? `${styles.checkBox} ${styles.checkBoxOn}` : styles.checkBox
        }
      >
        {option.checked ? <span className={styles.checkBoxMark} /> : null}
      </span>
      <span className={styles.rowTexts}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowSubtitle}>{subtitle}</span>
      </span>
    </label>
  );
}

/* -------------------------------- Radio en fila -------------------------- */

export function RadioOption({
  title,
  subtitle,
  ...option
}: BaseOptionProps & { readonly title: string; readonly subtitle: string }): ReactNode {
  return (
    <label
      className={optionClasses(styles.rowOption, option.checked, styles.rowOptionCompact)}
    >
      <NativeInput type="radio" {...option} />
      <span
        aria-hidden="true"
        className={
          option.checked ? `${styles.radioDot} ${styles.radioDotOn}` : styles.radioDot
        }
      >
        {option.checked ? <span className={styles.radioDotMark} /> : null}
      </span>
      <span className={styles.rowTexts}>
        <span className={`${styles.rowTitle} ${styles.rowTitleCompact}`}>{title}</span>
        <span className={styles.rowSubtitle}>{subtitle}</span>
      </span>
    </label>
  );
}

/* ----------------------------- Consentimiento ---------------------------- */

export function ConsentOption({
  title,
  children,
  ...option
}: BaseOptionProps & { readonly title: string; readonly children: ReactNode }): ReactNode {
  return (
    <label className={optionClasses(styles.consentOption, option.checked)}>
      <NativeInput type="checkbox" {...option} />
      <span
        aria-hidden="true"
        className={
          option.checked
            ? `${styles.consentBox} ${styles.consentBoxOn}`
            : styles.consentBox
        }
      >
        {option.checked ? <span className={styles.checkBoxMark} /> : null}
      </span>
      <span className={styles.consentTexts}>
        <span className={styles.consentTitle}>{title}</span>
        {children}
      </span>
    </label>
  );
}

export function ConsentBody({ children }: { readonly children: ReactNode }): ReactNode {
  return <span className={styles.consentBody}>{children}</span>;
}

/* ----------------------------- Segmentado sí/no -------------------------- */

export function SegmentedGroup({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className={styles.segmented}>{children}</div>;
}

export function Segment({
  label,
  ...option
}: BaseOptionProps & { readonly label: string }): ReactNode {
  return (
    <label className={optionClasses(styles.segment, option.checked)}>
      <NativeInput type="radio" {...option} />
      <span>{label}</span>
    </label>
  );
}

/* ---------------------------------- Chips -------------------------------- */

export function ChipList({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className={styles.chipList}>{children}</div>;
}

export function Chip({
  label,
  ...option
}: BaseOptionProps & { readonly label: string }): ReactNode {
  return (
    <label className={optionClasses(styles.chip, option.checked)}>
      <NativeInput type="checkbox" {...option} />
      <span>{label}</span>
    </label>
  );
}

/* --------------------------- Muestra de tamaño --------------------------- */

export type TextSampleSize = 'normal' | 'medium' | 'large';

const TEXT_SAMPLE_CLASS: Record<TextSampleSize, string | undefined> = {
  normal: undefined,
  medium: styles.textSampleMedium,
  large: styles.textSampleLarge,
};

export function TextSampleOption({
  sample,
  accessibleLabel,
  size,
  ...option
}: BaseOptionProps & {
  readonly sample: string;
  readonly accessibleLabel: string;
  readonly size: TextSampleSize;
}): ReactNode {
  return (
    <label
      className={optionClasses(styles.textSample, option.checked, TEXT_SAMPLE_CLASS[size])}
    >
      <NativeInput type="radio" {...option} />
      <span className="merdn-sr-only">{accessibleLabel}</span>
      <span aria-hidden="true">{sample}</span>
    </label>
  );
}

/* --------------------------------- Toggle -------------------------------- */

export function ToggleOption({
  title,
  subtitle,
  name,
  checked,
  onChange,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly name: string;
  readonly checked: boolean;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
}): ReactNode {
  return (
    <label className={styles.toggleRow}>
      <input
        className={styles.nativeInput}
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
      />
      <span className={styles.toggleTexts}>
        <span className={styles.toggleTitle}>{title}</span>
        <span className={styles.toggleSubtitle}>{subtitle}</span>
      </span>
      <span
        aria-hidden="true"
        className={
          checked ? `${styles.toggleTrack} ${styles.toggleTrackOn}` : styles.toggleTrack
        }
      >
        <span className={styles.toggleKnob} />
      </span>
    </label>
  );
}

/* ------------------------------- Membresías ------------------------------ */

export function PlanOption({
  name: fieldName,
  planName,
  price,
  period,
  description,
  badge,
  ...option
}: BaseOptionProps & {
  readonly planName: string;
  readonly price: string;
  readonly period: string;
  readonly description: string;
  readonly badge?: string;
}): ReactNode {
  return (
    <label className={optionClasses(styles.planOption, option.checked)}>
      <NativeInput type="radio" name={fieldName} {...option} />
      {badge === undefined ? null : <span className={styles.planBadge}>{badge}</span>}
      <span className={styles.planHead}>
        <span className={styles.planName}>{planName}</span>
        <span className={styles.planPrice}>
          {price}
          <span className={styles.planPeriod}>{period}</span>
        </span>
      </span>
      <span className={styles.planBody}>{description}</span>
    </label>
  );
}

/* ----------------------------- Ánimo (semáforo) -------------------------- */

export type MoodTone = 'bien' | 'regular' | 'mal';

const MOOD_OPTION_CLASS: Record<MoodTone, string> = {
  bien: styles.moodOptionBien,
  regular: styles.moodOptionRegular,
  mal: styles.moodOptionMal,
};

const MOOD_DOT_CLASS: Record<MoodTone, string> = {
  bien: styles.moodDotBien,
  regular: styles.moodDotRegular,
  mal: styles.moodDotMal,
};

export function MoodOption({
  tone,
  title,
  subtitle,
  ...option
}: BaseOptionProps & {
  readonly tone: MoodTone;
  readonly title: string;
  readonly subtitle: string;
}): ReactNode {
  return (
    <label
      className={optionClasses(styles.moodOption, option.checked, MOOD_OPTION_CLASS[tone])}
    >
      <NativeInput type="radio" {...option} />
      <span aria-hidden="true" className={`${styles.moodDot} ${MOOD_DOT_CLASS[tone]}`} />
      <span className={styles.moodTexts}>
        <span className={styles.moodTitle}>{title}</span>
        <span className={styles.moodSubtitle}>{subtitle}</span>
      </span>
    </label>
  );
}
