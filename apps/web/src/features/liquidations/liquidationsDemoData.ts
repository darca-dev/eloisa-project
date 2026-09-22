/**
 * Datos locales de demostración para «Mis pagos y liquidaciones».
 *
 * No provienen de una institución, una prestación real ni una fuente financiera.
 * Los montos son referencias visuales: no representan saldo, obligación de pago
 * ni una orden transferible.
 */

export type LiquidationDemoRole = 'cuidador' | 'visitador';

export type LiquidationDemoStatus = 'En revisión' | 'Aprobado para corte' | 'Pagado de muestra';

export interface LiquidationDemoRecord {
  readonly id: string;
  readonly activity: string;
  readonly period: string;
  readonly referenceAmount: string;
  readonly status: LiquidationDemoStatus;
}

export interface LiquidationsDemoData {
  readonly roleLabel: string;
  readonly heading: string;
  readonly summary: readonly {
    readonly label: string;
    readonly value: string;
    readonly description: string;
  }[];
  readonly records: readonly LiquidationDemoRecord[];
}

export const liquidationsDemoByRole: Record<LiquidationDemoRole, LiquidationsDemoData> = {
  cuidador: {
    roleLabel: 'Cuidador demo',
    heading: 'Mis pagos y liquidaciones',
    summary: [
      {
        label: 'Actividades de muestra',
        value: '4',
        description: 'Registradas solo para la demostración local.',
      },
      {
        label: 'Referencia del corte',
        value: '$ 342.000',
        description: 'Valor ficticio; no es dinero disponible.',
      },
      {
        label: 'En revisión',
        value: '1',
        description: 'Ejemplo de validación administrativa.',
      },
    ],
    records: [
      {
        id: 'CUI-DEMO-01',
        activity: 'Jornada de apoyo en cuidado',
        period: 'Semana de muestra · septiembre de 2026',
        referenceAmount: '$ 84.000',
        status: 'Pagado de muestra',
      },
      {
        id: 'CUI-DEMO-02',
        activity: 'Acompañamiento y registro de rutina',
        period: 'Semana de muestra · septiembre de 2026',
        referenceAmount: '$ 86.000',
        status: 'Aprobado para corte',
      },
      {
        id: 'CUI-DEMO-03',
        activity: 'Apoyo de movilidad no clínico',
        period: 'Semana de muestra · septiembre de 2026',
        referenceAmount: '$ 88.000',
        status: 'Aprobado para corte',
      },
      {
        id: 'CUI-DEMO-04',
        activity: 'Jornada de acompañamiento',
        period: 'Semana de muestra · septiembre de 2026',
        referenceAmount: '$ 84.000',
        status: 'En revisión',
      },
    ],
  },
  visitador: {
    roleLabel: 'Visitador médico demo',
    heading: 'Mis pagos y liquidaciones',
    summary: [
      {
        label: 'Actividades de muestra',
        value: '3',
        description: 'Sin relación con atenciones reales.',
      },
      {
        label: 'Referencia del corte',
        value: '$ 468.000',
        description: 'Valor ficticio; no es dinero disponible.',
      },
      {
        label: 'Aprobadas para corte',
        value: '2',
        description: 'Estado administrativo de demostración.',
      },
    ],
    records: [
      {
        id: 'VIS-DEMO-01',
        activity: 'Jornada de visita de muestra',
        period: 'Semana de muestra · septiembre de 2026',
        referenceAmount: '$ 156.000',
        status: 'Pagado de muestra',
      },
      {
        id: 'VIS-DEMO-02',
        activity: 'Actividad profesional de muestra',
        period: 'Semana de muestra · septiembre de 2026',
        referenceAmount: '$ 156.000',
        status: 'Aprobado para corte',
      },
      {
        id: 'VIS-DEMO-03',
        activity: 'Seguimiento administrativo de muestra',
        period: 'Semana de muestra · septiembre de 2026',
        referenceAmount: '$ 156.000',
        status: 'Aprobado para corte',
      },
    ],
  },
};
