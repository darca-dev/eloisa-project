import styles from './hospitalOperational.module.css';

export const HOSPITAL_PENDING_MODULES = {
  virtuales: { title: 'Consultas virtuales', description: 'La consulta y coordinación de atenciones virtuales todavía no están habilitadas.' },
  calificaciones: { title: 'Calidad y experiencia', description: 'La consulta de evaluaciones y satisfacción todavía no está habilitada.' },
  novedades: { title: 'Novedades', description: 'La consulta de novedades institucionales todavía no está habilitada.' },
  financiera: { title: 'Gestión financiera', description: 'La consulta de presupuestos, movimientos y soportes todavía no está habilitada.' },
  reportes: { title: 'Reportes', description: 'La generación de informes institucionales todavía no está habilitada.' },
  administracion: { title: 'Configuración', description: 'Esta sesión no tiene habilitada la gestión de solicitudes de acceso.' },
} as const;

export function HospitalPendingModule({ modulo }: { readonly modulo: keyof typeof HOSPITAL_PENDING_MODULES }) {
  const contenido = HOSPITAL_PENDING_MODULES[modulo];
  return <section className={styles.home} aria-labelledby="hospital-pending-title">
    <header><h1 className={styles.title} id="hospital-pending-title">{contenido.title}</h1></header>
    <div className={styles.card}><p className={styles.eyebrow}>Pendiente de implementación</p><p>{contenido.description}</p><p role="status">No hay una consulta disponible para este apartado.</p></div>
  </section>;
}
