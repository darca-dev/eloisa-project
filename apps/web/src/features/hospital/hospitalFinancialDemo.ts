import type { FinancialConfig, FinancialSeccionTabla } from './hospitalFinancialContracts';
import { FINANCIERA_PLATAFORMA, type FinancialSeccionId } from './hospitalFinancialConfig';
import {
  SECCION_COMPRAS,
  SECCION_CONVENIOS,
  SECCION_PROVEEDORES,
} from './hospitalFinancialAbastecimiento';
import {
  LINEAS_EJECUCION,
  LINEAS_PRESUPUESTO,
  SECCION_EJECUCION,
  SECCION_EVIDENCIAS,
  SECCION_PRESUPUESTO,
} from './hospitalFinancialControl';
import {
  SECCION_EGRESOS,
  SECCION_FACTURAS,
  SECCION_GASTOS,
  SECCION_INGRESOS,
} from './hospitalFinancialMovimientos';
import {
  SECCION_CUENTAS,
  SECCION_HONORARIOS,
  SECCION_NOMINA,
} from './hospitalFinancialPersonas';
import { CONEXION_HOSPITAL, RESUMEN_FINANCIERO } from './hospitalFinancialResumen';

/**
 * Configuración demostrativa completa de «Gestión financiera» (TASK-003H-06).
 *
 * Reúne las trece secciones de listado, el resumen financiero, las líneas de
 * presupuesto y ejecución y el panel de conexión. Todos los datos son ficticios
 * y están centralizados fuera del JSX de presentación.
 *
 * Esta configuración no es un sistema contable oficial, un ERP, un sistema de
 * nómina ni un procesador de pagos, y no declara cumplimiento de ninguna norma
 * ni la existencia de ninguna integración activa.
 */

/** Secciones de listado, indexadas por su identificador del menú. */
const SECCIONES: readonly FinancialSeccionTabla[] = [
  SECCION_INGRESOS,
  SECCION_EGRESOS,
  SECCION_GASTOS,
  SECCION_FACTURAS,
  SECCION_NOMINA,
  SECCION_HONORARIOS,
  SECCION_CUENTAS,
  SECCION_PROVEEDORES,
  SECCION_COMPRAS,
  SECCION_CONVENIOS,
  SECCION_PRESUPUESTO,
  SECCION_EJECUCION,
  SECCION_EVIDENCIAS,
];

/** Índice de secciones por identificador. */
export const FINANCIERA_SECCIONES_TABLA: Readonly<Record<string, FinancialSeccionTabla>> =
  Object.fromEntries(SECCIONES.map((seccion) => [seccion.id, seccion]));

/** Sección de listado de un identificador, cuando la tiene. */
export function seccionDeTabla(id: FinancialSeccionId): FinancialSeccionTabla | undefined {
  return FINANCIERA_SECCIONES_TABLA[id];
}

export const hospitalFinancieraDemo: FinancialConfig = {
  titulo: 'Gestión financiera',
  descripcion:
    'Consulta y organización de la información financiera de los programas administrados, con procedencia por registro.',
  badge: 'Demostración',
  periodoActivo: 'Agosto 2026',
  estadoDatos: `Última actualización demostrativa: 12 ago 2026 · 06:15. Procedencia: Sistema del Hospital y ${FINANCIERA_PLATAFORMA}.`,
  avisoPermisos:
    'Los perfiles, los permisos y los estados de esta pantalla son demostrativos. La interfaz no autoriza: crear, revisar, aprobar, programar, pagar, exportar, adjuntar y sincronizar permanecen inertes y no producen ningún resultado.',
  resumen: RESUMEN_FINANCIERO,
  secciones: FINANCIERA_SECCIONES_TABLA,
  presupuesto: LINEAS_PRESUPUESTO,
  ejecucion: LINEAS_EJECUCION,
  conexion: CONEXION_HOSPITAL,
  estados: {
    cargando: 'Cargando la información del periodo…',
    vacio: 'Sin registros para este periodo.',
    error: 'No fue posible mostrar esta información. Referencia de soporte: REF-DEMO-0001.',
    denegado: 'No tiene acceso a esta información con el perfil actual.',
    desactualizado:
      'Datos posiblemente desactualizados: se muestran los últimos confirmados y su fecha.',
    pendiente: 'Hay una operación pendiente de sincronizar con el sistema del Hospital.',
    conflicto: 'Hay un conflicto entre las dos fuentes que requiere resolución humana.',
    externoNoDisponible:
      'El sistema del Hospital no está disponible. Se muestran los últimos datos confirmados y su fecha.',
  },
};
