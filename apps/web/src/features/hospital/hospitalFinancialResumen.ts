import type {
  FinancialConexionConfig,
  FinancialResumenConfig,
} from './hospitalFinancialContracts';
import { HOSPITAL, PLATAFORMA, PROGRAMAS, movimiento } from './hospitalFinancialFixtures';
import { LINEAS_PRESUPUESTO } from './hospitalFinancialControl';

/**
 * Fixtures del «Resumen financiero» y del panel «Conexión con sistema del
 * Hospital» (TASK-003H-06, apartados 7 y 13).
 *
 * Los diez KPI, sus deep links internos, la bandeja «Necesita atención
 * financiera», el presupuesto por programa, el flujo del periodo y la actividad
 * reciente son datos ficticios predefinidos. Ninguna cifra se calcula, se suma
 * ni se deriva, y ninguna alerta es oficial, regulatoria o clínica: son avisos
 * internos de organización del trabajo.
 *
 * El panel de conexión prepara una integración futura. No hay conexión activa,
 * no se realiza ninguna llamada de red y marcar una categoría no activa ni
 * programa nada.
 */

/* ========================================================================== */
/* Resumen financiero                                                         */
/* ========================================================================== */

/** Procedencia agregada que se escribe bajo cada KPI. */
const AMBAS_FUENTES = `Sistema del Hospital y ${PLATAFORMA}`;

export const RESUMEN_FINANCIERO: FinancialResumenConfig = {
  avisoUmbral:
    'El umbral de presupuesto cercano al agotamiento es un ejemplo configurable de esta demostración. No es una regla productiva, no es un límite legal y no se aplica automáticamente a ningún programa.',
  kpis: [
    {
      id: 'kpi-asignado',
      etiqueta: 'Presupuesto asignado',
      valor: '1.400.000.000 COP',
      periodo: 'Agosto 2026',
      origen: 'Sistema del Hospital',
      icono: 'saldo',
      destino: { seccion: 'presupuesto' },
    },
    {
      id: 'kpi-ingresos',
      etiqueta: 'Ingresos',
      valor: '70.250.000 COP',
      periodo: 'Agosto 2026',
      origen: AMBAS_FUENTES,
      icono: 'ingreso',
      destino: { seccion: 'ingresos' },
    },
    {
      id: 'kpi-egresos',
      etiqueta: 'Egresos',
      valor: '91.580.000 COP',
      periodo: 'Agosto 2026',
      origen: AMBAS_FUENTES,
      icono: 'egreso',
      destino: { seccion: 'egresos' },
    },
    {
      id: 'kpi-comprometido',
      etiqueta: 'Comprometido',
      valor: '434.000.000 COP',
      periodo: 'Agosto 2026',
      origen: 'Sistema del Hospital',
      icono: 'candado',
      destino: { seccion: 'presupuesto' },
    },
    {
      id: 'kpi-disponible',
      etiqueta: 'Disponible',
      valor: '264.000.000 COP',
      periodo: 'Agosto 2026',
      origen: 'Sistema del Hospital',
      icono: 'saldo',
      destino: { seccion: 'presupuesto' },
    },
    {
      id: 'kpi-ejecucion',
      etiqueta: 'Ejecución %',
      valor: '50 %',
      periodo: 'Agosto 2026',
      origen: 'Sistema del Hospital',
      icono: 'reportes',
      destino: { seccion: 'ejecucion' },
      barra: '50%',
    },
    {
      id: 'kpi-nomina',
      etiqueta: 'Nómina del periodo',
      valor: '64.200.000 COP',
      periodo: 'Agosto 2026',
      origen: 'Sistema del Hospital',
      icono: 'usuarios',
      destino: { seccion: 'nomina' },
    },
    {
      id: 'kpi-honorarios',
      etiqueta: 'Honorarios pendientes',
      valor: '6.950.000 COP',
      periodo: 'Agosto 2026',
      origen: PLATAFORMA,
      icono: 'credencial',
      destino: { seccion: 'honorarios', bandeja: 'Pendientes' },
    },
    {
      id: 'kpi-cuentas',
      etiqueta: 'Cuentas de cobro pendientes',
      valor: '3 cuentas',
      periodo: 'Agosto 2026',
      origen: PLATAFORMA,
      icono: 'membresias',
      destino: { seccion: 'cuentas', bandeja: 'Pendientes' },
    },
    {
      id: 'kpi-gastos',
      etiqueta: 'Gastos pendientes de soporte',
      valor: '860.000 COP',
      periodo: 'Agosto 2026',
      origen: PLATAFORMA,
      icono: 'caja',
      destino: { seccion: 'gastos', filtros: { evidencia: 'Pendiente' } },
    },
  ],
  atencion: [
    {
      id: 'at-cuentas',
      categoria: 'Cuentas por revisar',
      asunto: '3 cuentas de cobro esperan revisión',
      programa: 'Varios programas',
      antiguedad: 'La más antigua: 9 días',
      origen: PLATAFORMA,
      destino: { seccion: 'cuentas', bandeja: 'Pendientes' },
    },
    {
      id: 'at-pagos',
      categoria: 'Pagos pendientes',
      asunto: 'Honorarios aprobados sin programación de pago',
      programa: PROGRAMAS.telesalud,
      antiguedad: '5 días',
      origen: PLATAFORMA,
      destino: { seccion: 'honorarios', filtros: { estado: 'Aprobada' } },
    },
    {
      id: 'at-gastos',
      categoria: 'Gastos sin evidencia',
      asunto: 'Un gasto operativo no tiene soporte cargado',
      programa: PROGRAMAS.domiciliaria,
      antiguedad: '1 día',
      origen: PLATAFORMA,
      destino: { seccion: 'gastos', filtros: { evidencia: 'Pendiente' } },
    },
    {
      id: 'at-facturas',
      categoria: 'Facturas pendientes',
      asunto: 'Una factura importada espera revisión y es candidata de duplicado',
      programa: PROGRAMAS.domiciliaria,
      antiguedad: '2 días',
      origen: HOSPITAL,
      destino: { seccion: 'facturas', bandeja: 'Pendientes' },
    },
    {
      id: 'at-presupuesto',
      categoria: 'Presupuesto cercano al umbral interno configurable',
      asunto: 'Formación de cuidadores llega al 80 % de ejecución del fixture',
      programa: PROGRAMAS.cuidadores,
      antiguedad: 'Periodo en curso',
      origen: PLATAFORMA,
      destino: { seccion: 'presupuesto', filtros: { programa: PROGRAMAS.cuidadores } },
    },
    {
      id: 'at-conflictos',
      categoria: 'Conflictos de sincronización',
      asunto: '2 conflictos esperan resolución humana',
      programa: 'Varios programas',
      antiguedad: '8 días',
      origen: HOSPITAL,
      destino: { seccion: 'conexion' },
    },
  ],
  programas: LINEAS_PRESUPUESTO,
  flujo: [
    {
      id: 'flujo-jun',
      etiqueta: 'Junio 2026',
      ingresos: '58.400.000 COP',
      egresos: '77.900.000 COP',
      barraIngresos: '58%',
      barraEgresos: '78%',
    },
    {
      id: 'flujo-jul',
      etiqueta: 'Julio 2026',
      ingresos: '64.100.000 COP',
      egresos: '83.200.000 COP',
      barraIngresos: '64%',
      barraEgresos: '83%',
    },
    {
      id: 'flujo-ago',
      etiqueta: 'Agosto 2026',
      ingresos: '70.250.000 COP',
      egresos: '91.580.000 COP',
      barraIngresos: '70%',
      barraEgresos: '92%',
    },
  ],
  actividad: [
    movimiento(
      'act-1',
      '14 ago 2026',
      'Cámaras para consulta virtual · solicitud de compra',
      '4.740.000 COP',
      'Solicitada',
      PLATAFORMA,
    ),
    movimiento(
      'act-2',
      '13 ago 2026',
      'Combustible de rutas domiciliarias',
      '860.000 COP',
      'Pendiente de revisión',
      PLATAFORMA,
    ),
    movimiento(
      'act-3',
      '12 ago 2026',
      'Transporte de visitas domiciliarias',
      '2.340.000 COP',
      'Pendiente de revisión',
      PLATAFORMA,
    ),
    movimiento(
      'act-4',
      '11 ago 2026',
      'Servicios de telesalud facturados',
      '9.800.000 COP',
      'Programado',
      HOSPITAL,
    ),
    movimiento(
      'act-5',
      '09 ago 2026',
      'Insumos de atención domiciliaria',
      '5.980.000 COP',
      'Programado',
      PLATAFORMA,
    ),
  ],
};

/* ========================================================================== */
/* Conexión con sistema del Hospital                                          */
/* ========================================================================== */

export const CONEXION_HOSPITAL: FinancialConexionConfig = {
  aviso: 'Esta pantalla prepara una conexión; no hay sincronización activa.',
  sistema: {
    nombre: 'Sistema por definir',
    modalidad: 'Solo importar',
    estado: 'Pendiente',
    ultimaSincronizacion: 'Nunca',
    responsable: 'Sin responsable asignado',
  },
  notaModalidades:
    'Solo lectura o importación es la modalidad inicial preferida y deja al Hospital como fuente maestra. La modalidad mixta declara explícitamente qué categoría o campo pertenece a cada fuente. La modalidad bidireccional queda bloqueada hasta confirmar API, contrato, campos, autoridad, idempotencia y una aprobación institucional específica.',
  categorias: [
    {
      id: 'cat-ingresos',
      etiqueta: 'Ingresos',
      seleccionada: true,
      direccion: 'Solo importar',
      fuenteMaestra: HOSPITAL,
      frecuencia: 'Por definir',
      campos: 'Fecha, concepto, valor, entidad, documento y estado',
      estado: 'Pendiente',
      bloqueada: false,
      motivoBloqueo: '',
    },
    {
      id: 'cat-egresos',
      etiqueta: 'Egresos',
      seleccionada: true,
      direccion: 'Solo importar',
      fuenteMaestra: HOSPITAL,
      frecuencia: 'Por definir',
      campos: 'Fecha, categoría, valor, tercero, soporte y estado',
      estado: 'Pendiente',
      bloqueada: false,
      motivoBloqueo: '',
    },
    {
      id: 'cat-nomina',
      etiqueta: 'Nómina',
      seleccionada: true,
      direccion: 'Solo importar',
      fuenteMaestra: HOSPITAL,
      frecuencia: 'Por definir',
      campos: 'Persona, código, periodo, neto y estado de pago',
      estado: 'Pendiente',
      bloqueada: false,
      motivoBloqueo: '',
    },
    {
      id: 'cat-proveedores',
      etiqueta: 'Proveedores',
      seleccionada: false,
      direccion: 'Mixta',
      fuenteMaestra: HOSPITAL,
      frecuencia: 'Por definir',
      campos: 'Identificación y documentos del Hospital; contacto operativo local',
      estado: 'Local',
      bloqueada: false,
      motivoBloqueo: '',
    },
    {
      id: 'cat-facturas',
      etiqueta: 'Facturas',
      seleccionada: true,
      direccion: 'Solo importar',
      fuenteMaestra: HOSPITAL,
      frecuencia: 'Por definir',
      campos: 'Tipo, número, emisor, receptor, fecha y valor',
      estado: 'Conflicto',
      bloqueada: false,
      motivoBloqueo: '',
    },
    {
      id: 'cat-presupuesto',
      etiqueta: 'Presupuesto',
      seleccionada: true,
      direccion: 'Solo importar',
      fuenteMaestra: HOSPITAL,
      frecuencia: 'Por definir',
      campos: 'Programa, rubro, periodo, asignado, comprometido y ejecutado',
      estado: 'Pendiente',
      bloqueada: false,
      motivoBloqueo: '',
    },
    {
      id: 'cat-compras',
      etiqueta: 'Compras',
      seleccionada: false,
      direccion: 'Solo importar',
      fuenteMaestra: PLATAFORMA,
      frecuencia: 'Por definir',
      campos: 'Producto, cantidad, costo, proveedor y recepción',
      estado: 'Local',
      bloqueada: false,
      motivoBloqueo: '',
    },
    {
      id: 'cat-pagos',
      etiqueta: 'Pagos',
      seleccionada: false,
      direccion: 'Bidireccional',
      fuenteMaestra: HOSPITAL,
      frecuencia: 'Por definir',
      campos: 'Por definir',
      estado: 'Pendiente',
      bloqueada: true,
      motivoBloqueo:
        'La modalidad bidireccional requiere API confirmada, contrato, campos, autoridad, idempotencia y aprobación institucional específica. No se habilita en esta fase.',
    },
  ],
  resumen: [
    {
      id: 'sync-importadas',
      etiqueta: 'Operaciones importadas',
      valor: '146',
      pie: 'Conteo demostrativo; no corresponde a una ejecución real',
    },
    {
      id: 'sync-pendientes',
      etiqueta: 'Pendientes',
      valor: '12',
      pie: 'Conteo demostrativo; no corresponde a una ejecución real',
    },
    {
      id: 'sync-rechazadas',
      etiqueta: 'Rechazadas',
      valor: '4',
      pie: 'Conteo demostrativo; no corresponde a una ejecución real',
    },
    {
      id: 'sync-conflictos',
      etiqueta: 'Conflictos',
      valor: '2',
      pie: 'Conteo demostrativo; no corresponde a una ejecución real',
    },
  ],
  historial: [
    {
      id: 'run-1',
      fecha: '12 ago 2026 · 06:15',
      categoria: 'Ingresos, Egresos, Nómina, Facturas',
      resultado: 'Ejecución demostrativa con conflictos',
      importadas: '58',
      pendientes: '6',
      rechazadas: '2',
      conflictos: '2',
    },
    {
      id: 'run-2',
      fecha: '05 ago 2026 · 06:15',
      categoria: 'Ingresos, Egresos, Nómina',
      resultado: 'Ejecución demostrativa parcial',
      importadas: '47',
      pendientes: '6',
      rechazadas: '1',
      conflictos: '0',
    },
    {
      id: 'run-3',
      fecha: '22 jul 2026 · 06:15',
      categoria: 'Ingresos, Egresos, Facturas',
      resultado: 'Ejecución demostrativa completa',
      importadas: '41',
      pendientes: '0',
      rechazadas: '1',
      conflictos: '0',
    },
  ],
  conflictos: [
    {
      id: 'conf-1',
      registro: 'Factura FE-2026-0443',
      categoria: 'Facturas',
      detectadoEn: '12 ago 2026 · 06:15',
      campo: 'Número de documento y valor',
      valorHospital: 'FE-2026-0443 · 5.980.000 COP',
      valorPlataforma: 'FE-2026-0442 · 5.980.000 COP',
      opciones: ['Conservar Hospital', `Conservar ${PLATAFORMA}`, 'Combinar campos permitidos', 'Posponer'],
      nota:
        'Candidato de duplicado detectado por coincidencia probabilística. Requiere revisión humana con actor y motivo: no se aplica la última escritura, no se fusiona y no se descarta automáticamente.',
    },
    {
      id: 'conf-2',
      registro: 'Egreso EGR-2026-0812 · Transporte',
      categoria: 'Egresos',
      detectadoEn: '12 ago 2026 · 06:15',
      campo: 'Valor',
      valorHospital: '2.480.000 COP',
      valorPlataforma: '2.340.000 COP',
      opciones: ['Conservar Hospital', `Conservar ${PLATAFORMA}`, 'Combinar campos permitidos', 'Posponer'],
      nota:
        'El registro cambió en las dos fuentes desde la última sincronización. Se conserva la versión previa y se registra el conflicto: no se aplica la última escritura.',
    },
  ],
};
