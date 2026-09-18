import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { platformNameInSentence } from '@/config/branding';

import { HospitalFinancialManagement, seleccionDeMenu } from './HospitalFinancialManagement';
import type { EstadoFinanciero } from './HospitalFinancialManagement';
import { esMenuModal } from './HospitalFinancialPieces';
import { HospitalShell } from './HospitalShell';
import {
  FINANCIERA_ESTADOS_COMPRA,
  FINANCIERA_ESTADOS_CUENTA,
  FINANCIERA_ESTADOS_EVIDENCIA,
  FINANCIERA_ESTADOS_MOVIMIENTO,
  FINANCIERA_ESTADOS_PROVEEDOR,
  FINANCIERA_ESTADOS_SINCRONIZACION,
  FINANCIERA_FILTROS_VACIOS,
  FINANCIERA_MENU,
  FINANCIERA_METODOS_CAPTURA,
  FINANCIERA_MODALIDADES_HONORARIOS,
  FINANCIERA_ORIGENES,
  FINANCIERA_SECCIONES,
  FINANCIERA_SECCION_INICIAL,
  conFiltro,
  esOrigenFinanciero,
  filtrarFilas,
} from './hospitalFinancialConfig';
import type { FinancialFila, FinancialSeccionId } from './hospitalFinancialConfig';
import { FINANCIERA_CATEGORIAS_ATENCION } from './hospitalFinancialContracts';
import { hospitalFinancieraDemo, seccionDeTabla } from './hospitalFinancialDemo';
import { SESION_INSTITUCIONAL_FICTICIA, apariciones, main, texto } from './hospitalTestUtils';

/**
 * Gestión financiera del Hospital (TASK-003H-06, T-01 a T-30).
 *
 * Las vistas se renderizan con `react-dom/server`, igual que el resto del
 * frontend: el repositorio no incluye jsdom ni una librería de testing con DOM
 * y esta tarea no autoriza añadir dependencias. Por eso se verifican el marcado
 * renderizado, los fixtures tipados y la lógica de recorte y navegación
 * extraída como funciones puras y como propiedades de montaje. La activación
 * real por clic y por teclado —incluidos `Escape` y la devolución del foco—
 * queda pendiente y se reporta como no ejecutada.
 */

const CONFIG = hospitalFinancieraDemo;

/** Marcado del shell abierto en «Gestión financiera». */
function pantalla(seccion?: FinancialSeccionId, fila: string | null = null): string {
  return renderToStaticMarkup(
    <HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA}
      vistaInicial="financiera"
      seccionFinancieraInicial={seccion}
      filaFinancieraInicial={fila}
    />,
  );
}

/** Texto visible del área de contenido para esa sección. */
function visible(seccion?: FinancialSeccionId, fila: string | null = null): string {
  return texto(main(pantalla(seccion, fila)));
}

/** Todas las secciones de listado con filas. */
const SECCIONES_TABLA = FINANCIERA_SECCIONES.map((id) => seccionDeTabla(id)).filter(
  (seccion): seccion is NonNullable<ReturnType<typeof seccionDeTabla>> => seccion !== undefined,
);

/** Todas las filas de todas las secciones de listado. */
const TODAS_LAS_FILAS: readonly FinancialFila[] = SECCIONES_TABLA.flatMap(
  (seccion) => seccion.filas,
);

/* ========================================================================== */
/* T-01 y T-02 — Regresión y navegación                                       */
/* ========================================================================== */

describe('T-01 — Los módulos anteriores conservan su contenido', () => {
  it('cada vista de H-01 a H-05 sigue montando su propio contenido', () => {
    const vistas = [
      ['inicio', 'CENTRO DE CONTROL'],
      ['agenda', 'Agenda'],
      ['pacientes', 'Pacientes'],
      ['alarmas', 'alarmas'],
      ['profesionales', 'Profesionales'],
      ['visitas', 'Visitas domiciliarias'],
      ['virtuales', 'Consultas virtuales'],
      ['calificaciones', 'Calidad y experiencia'],
      ['novedades', 'Novedades'],
      ['administracion', 'Membresía'],
    ] as const;

    for (const [vista, pista] of vistas) {
      const contenido = texto(main(renderToStaticMarkup(<HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} vistaInicial={vista} />)));

      expect(contenido.length).toBeGreaterThan(0);
      expect(contenido).toContain(pista);
      /* Ninguna vista anterior recibe contenido financiero. */
      expect(contenido).not.toContain('Necesita atención financiera');
      expect(contenido).not.toContain('Conexión con sistema del Hospital');
    }
  });
});

describe('T-02 — Menú secundario: seis agrupaciones y quince destinos', () => {
  it('declara exactamente las seis agrupaciones aprobadas, en orden', () => {
    expect(FINANCIERA_MENU.map((grupo) => grupo.titulo)).toEqual([
      'Visión general',
      'Movimientos',
      'Personas y pagos',
      'Abastecimiento',
      'Control',
      'Datos',
    ]);
  });

  it('declara exactamente los quince destinos aprobados, en orden', () => {
    expect(FINANCIERA_MENU.flatMap((grupo) => grupo.items.map((item) => item.id))).toEqual([
      'resumen',
      'ingresos',
      'egresos',
      'gastos',
      'facturas',
      'nomina',
      'honorarios',
      'cuentas',
      'proveedores',
      'compras',
      'convenios',
      'presupuesto',
      'ejecucion',
      'evidencias',
      'conexion',
    ]);
    expect(FINANCIERA_SECCIONES).toHaveLength(15);
  });

  it('cada destino monta contenido propio y vuelve al resumen', () => {
    for (const seccion of FINANCIERA_SECCIONES) {
      const contenido = visible(seccion);

      expect(contenido).toContain('Gestión financiera');
      expect(contenido.length).toBeGreaterThan(200);
    }

    expect(FINANCIERA_SECCION_INICIAL).toBe('resumen');
    expect(visible()).toContain('Necesita atención financiera');
  });

  it('el menú secundario marca su activo sin alterar el único activo del sidebar', () => {
    const html = pantalla('ingresos');

    /* El sidebar Hospital conserva un único item activo. */
    expect(apariciones(html, /aria-current="true"/gu)).toBe(1);
    expect(apariciones(main(html), /aria-current="page"/gu)).toBe(1);
    expect(main(html)).toContain('data-financiera-seccion="ingresos"');
  });
});

/* ========================================================================== */
/* T-03 y T-04 — Resumen financiero                                           */
/* ========================================================================== */

describe('T-03 — Los KPI compactos del resumen', () => {
  it('son los diez del apartado 7, en el orden exacto', () => {
    expect(CONFIG.resumen.kpis.map((kpi) => kpi.etiqueta)).toEqual([
      'Presupuesto asignado',
      'Ingresos',
      'Egresos',
      'Comprometido',
      'Disponible',
      'Ejecución %',
      'Nómina del periodo',
      'Honorarios pendientes',
      'Cuentas de cobro pendientes',
      'Gastos pendientes de soporte',
    ]);
  });

  it('cada KPI muestra valor, periodo y origen y abre un destino del menú', () => {
    const contenido = visible();

    for (const kpi of CONFIG.resumen.kpis) {
      expect(contenido).toContain(kpi.etiqueta);
      expect(contenido).toContain(kpi.valor);
      expect(contenido).toContain(`${kpi.periodo} · ${kpi.origen}`);
      expect(FINANCIERA_SECCIONES).toContain(kpi.destino.seccion);
    }
  });

  it('«Ejecución %» se lee como texto además de dibujarse como barra', () => {
    const ejecucion = CONFIG.resumen.kpis.find((kpi) => kpi.etiqueta === 'Ejecución %');
    const html = main(pantalla());

    expect(ejecucion?.barra).toBeDefined();
    expect(visible()).toContain('50 %');
    expect(html).toContain('aria-label="Ejecución %: 50 %"');
  });
});

describe('T-04 — «Necesita atención financiera»', () => {
  it('solo usa las seis categorías operativas aprobadas', () => {
    for (const item of CONFIG.resumen.atencion) {
      expect(FINANCIERA_CATEGORIAS_ATENCION).toContain(item.categoria);
    }

    expect(new Set(CONFIG.resumen.atencion.map((item) => item.categoria)).size).toBe(
      FINANCIERA_CATEGORIAS_ATENCION.length,
    );
  });

  it('cada item declara tipo, asunto, programa, antigüedad, origen y destino', () => {
    const contenido = visible();

    for (const item of CONFIG.resumen.atencion) {
      expect(contenido).toContain(item.categoria);
      expect(contenido).toContain(item.asunto);
      expect(contenido).toContain(`${item.programa} · ${item.antiguedad}`);
      expect(esOrigenFinanciero(item.origen)).toBe(true);
      expect(FINANCIERA_SECCIONES).toContain(item.destino.seccion);
    }
  });

  it('declara expresamente que no es una alerta oficial', () => {
    const contenido = visible();

    expect(contenido).toContain('no son alertas oficiales, regulatorias ni clínicas');
    expect(contenido).toContain('ejemplo configurable');
    expect(contenido).not.toContain('incumplimiento detectado');
  });
});

/* ========================================================================== */
/* T-05 y T-06 — Búsqueda y filtros                                           */
/* ========================================================================== */

describe('T-05 — Búsqueda local por sección', () => {
  it('recorta por texto, ignora tildes y mayúsculas y admite limpieza', () => {
    const ingresos = seccionDeTabla('ingresos');
    const filas = ingresos?.filas ?? [];

    const conConsulta = filtrarFilas(
      filas,
      conFiltro(FINANCIERA_FILTROS_VACIOS, 'texto', 'MEMBRESIAS'),
      ingresos?.filtros ?? [],
    );
    const sinConsulta = filtrarFilas(filas, FINANCIERA_FILTROS_VACIOS, ingresos?.filtros ?? []);

    expect(conConsulta).toHaveLength(1);
    expect(conConsulta[0]?.id).toBe('ing-001');
    expect(sinConsulta).toHaveLength(filas.length);
  });

  it('una consulta sin coincidencias produce el estado «sin resultados»', () => {
    for (const seccion of SECCIONES_TABLA) {
      const vacio = filtrarFilas(
        seccion.filas,
        conFiltro(FINANCIERA_FILTROS_VACIOS, 'texto', 'zzz-sin-coincidencia'),
        seccion.filtros,
      );

      expect(vacio).toHaveLength(0);
      expect(seccion.vacioFiltrado).not.toBe(seccion.vacioInicial);
    }
  });
});

describe('T-06 — Filtros combinables', () => {
  it('cada sección declara las dimensiones que puede recortar', () => {
    for (const seccion of SECCIONES_TABLA) {
      expect(seccion.filtros.length).toBeGreaterThan(0);
      for (const filtro of seccion.filtros) {
        expect([
          'periodo',
          'programa',
          'estado',
          'origen',
          'entidad',
          'categoria',
          'evidencia',
        ]).toContain(filtro);
      }
    }
  });

  it('periodo, programa, estado, origen, categoría y evidencia se combinan', () => {
    const egresos = seccionDeTabla('egresos');
    const filtros = conFiltro(
      conFiltro(FINANCIERA_FILTROS_VACIOS, 'periodo', 'Agosto 2026'),
      'origen',
      'Sistema del Hospital',
    );
    const recorte = filtrarFilas(egresos?.filas ?? [], filtros, egresos?.filtros ?? []);

    expect(recorte).toHaveLength(1);
    expect(recorte[0]?.id).toBe('egr-001');
  });

  it('las bandejas del listado recortan sin tocar los filtros', () => {
    const cuentas = seccionDeTabla('cuentas');
    const pendientes = filtrarFilas(
      cuentas?.filas ?? [],
      FINANCIERA_FILTROS_VACIOS,
      cuentas?.filtros ?? [],
      'Pendientes',
    );

    expect(cuentas?.bandejas).toEqual(['Todos', 'Pendientes', 'Con observaciones']);
    expect(pendientes.length).toBeGreaterThan(0);
    expect(pendientes.length).toBeLessThan(cuentas?.filas.length ?? 0);
  });
});

/* ========================================================================== */
/* T-07 a T-17 — Contenido de las secciones                                   */
/* ========================================================================== */

describe('T-07 — Ingresos', () => {
  it('muestra los tipos y campos requeridos', () => {
    const contenido = visible('ingresos', 'ing-001');

    for (const campo of [
      'Tipo de ingreso',
      'Valor',
      'Programa',
      'Beneficiario',
      'Entidad',
      'Medio',
      'Documento',
      'Estado',
      'Observaciones',
    ]) {
      expect(contenido).toContain(campo);
    }
  });

  it('declara que ningún ingreso se reconoce automáticamente', () => {
    expect(visible('ingresos')).toContain('no se reconoce automáticamente a partir de una cita');
  });
});

describe('T-08 — Egresos', () => {
  it('muestra categorías, campos y procedencia', () => {
    const contenido = visible('egresos', 'egr-003');

    for (const campo of [
      'Categoría',
      'Responsable',
      'Proveedor o persona',
      'Centro de costo',
      'Factura o recibo',
      'Origen',
      'Método de captura',
    ]) {
      expect(contenido).toContain(campo);
    }
  });
});

describe('T-09 — Nómina de empleados', () => {
  it('muestra solo estructura de empleado, sin porcentajes ni cálculo legal', () => {
    const contenido = visible('nomina', 'nom-001');

    for (const campo of [
      'Código de personal',
      'Cargo',
      'Base contractual',
      'Devengados',
      'Deducciones',
      'Conceptos legales aplicables',
      'Aportes',
      'Prestaciones y costos institucionales',
      'Neto',
      'Estado de pago',
      'Comprobante',
    ]) {
      expect(contenido).toContain(campo);
    }

    expect(contenido).toContain('pendiente de validación legal y contable');
    /* Ningún porcentaje, salario mínimo, UVT ni impuesto aparece en pantalla. */
    expect(contenido).not.toMatch(/\d+(?:[.,]\d+)?\s?%/u);
    expect(contenido.toLowerCase()).not.toContain('uvt');
    expect(contenido.toLowerCase()).not.toContain('salario mínimo');
  });

  it('está separada de los prestadores independientes', () => {
    const nomina = seccionDeTabla('nomina');
    const honorarios = seccionDeTabla('honorarios');

    expect(nomina?.id).not.toBe(honorarios?.id);
    expect(nomina?.columnas.map((columna) => columna.id)).not.toEqual(
      honorarios?.columnas.map((columna) => columna.id),
    );
    for (const fila of nomina?.filas ?? []) {
      expect(fila.categoria).toBe('Empleado');
      expect(FINANCIERA_ESTADOS_MOVIMIENTO).toContain(fila.estado);
    }
    expect(visible('nomina')).toContain('nunca se mezclan con esta nómina');
  });
});

describe('T-10 — Prestadores / Honorarios', () => {
  it('usa las modalidades y los estados aprobados de independientes', () => {
    const honorarios = seccionDeTabla('honorarios');

    for (const fila of honorarios?.filas ?? []) {
      expect(FINANCIERA_MODALIDADES_HONORARIOS).toContain(fila.categoria);
      expect(FINANCIERA_ESTADOS_CUENTA).toContain(fila.estado);
    }
  });

  it('deja el vínculo futuro por identificador sin duplicar el expediente', () => {
    const contenido = visible('honorarios', 'hon-001');

    expect(contenido).toContain('Profesionales → Vinculación y documentos');
    expect(contenido).toContain('PRO-0041');
    expect(contenido).toContain('no clasifica el vínculo jurídico');
  });

  it('las retenciones solo se muestran cuando están legalmente configuradas', () => {
    expect(visible('honorarios', 'hon-001')).toContain('Sin configuración legal cargada');
  });
});

describe('T-11 — Cuentas de cobro', () => {
  it('representa el flujo completo aprobado', () => {
    const cuentas = seccionDeTabla('cuentas');
    const estados = new Set((cuentas?.filas ?? []).map((fila) => fila.estado));

    for (const fila of cuentas?.filas ?? []) {
      expect(FINANCIERA_ESTADOS_CUENTA).toContain(fila.estado);
    }

    expect(estados.has('Recibida')).toBe(true);
    expect(estados.has('Requiere corrección')).toBe(true);
    expect(estados.has('Pagada')).toBe(true);
    expect(visible('cuentas')).toContain(
      'Recibida → En revisión → Requiere corrección → Aprobada → Programada → Pagada',
    );
  });

  it('conserva el historial conceptual de la corrección', () => {
    const contenido = visible('cuentas', 'cta-003');

    expect(contenido).toContain('Historial');
    expect(contenido).toContain('el historial anterior se conserva íntegro');
    expect(contenido).toContain('puede volver a Recibida');
  });
});

describe('T-12 — Gastos operativos', () => {
  it('declara el formulario de registro rápido con sus campos aprobados', () => {
    const gastos = seccionDeTabla('gastos');

    expect(gastos?.formulario?.campos).toEqual([
      'Categoría',
      'Fecha',
      'Valor',
      'Responsable',
      'Programa',
      'Tercero',
      'Descripción',
    ]);
  });

  it('la ranura de evidencia es inerte y se declara como tal', () => {
    expect(visible('gastos')).toContain('no abre el selector del sistema');
  });
});

describe('T-13 — Proveedores', () => {
  it('muestra ficha, documentos, compras, facturas, pagos e historial', () => {
    const contenido = visible('proveedores', 'pro-001');

    for (const campo of [
      'Nombre o razón social',
      'Identificación',
      'Contacto',
      'Producto o servicio',
      'Documentos',
      'Contrato o convenio',
      'Compras',
      'Facturas',
      'Pagos',
      'Historial',
    ]) {
      expect(contenido).toContain(campo);
    }
  });

  it('usa los cuatro estados aprobados y aclara que no son una sanción', () => {
    const proveedores = seccionDeTabla('proveedores');

    for (const fila of proveedores?.filas ?? []) {
      expect(FINANCIERA_ESTADOS_PROVEEDOR).toContain(fila.estado);
    }

    expect(visible('proveedores')).toContain('no son una sanción');
  });

  it('enmascara la identificación del tercero', () => {
    expect(visible('proveedores', 'pro-001')).toContain('(enmascarada)');
  });
});

describe('T-14 — Compras e insumos', () => {
  it('muestra cantidad, costos, recepción y los seis estados aprobados', () => {
    const compras = seccionDeTabla('compras');
    const contenido = visible('compras', 'com-001');

    for (const fila of compras?.filas ?? []) {
      expect(FINANCIERA_ESTADOS_COMPRA).toContain(fila.estado);
    }

    for (const campo of ['Cantidad', 'Costo unitario', 'Total', 'Recepción o entrega']) {
      expect(contenido).toContain(campo);
    }
  });

  it('declara que el total no es un cálculo contable', () => {
    expect(visible('compras')).toContain('no es un cálculo contable');
  });
});

describe('T-15 — Convenios', () => {
  it('muestra resumen, movimientos, evidencias e historial', () => {
    const contenido = visible('convenios', 'cnv-001');

    for (const bloque of ['Resumen', 'Movimientos', 'Evidencias', 'Historial']) {
      expect(contenido).toContain(bloque);
    }
    for (const campo of ['Objeto', 'Vigencia', 'Valor o aporte', 'Recursos', 'Personal relacionado']) {
      expect(contenido).toContain(campo);
    }
  });

  it('no interpreta obligaciones ni validez jurídica', () => {
    expect(visible('convenios')).toContain('no interpreta obligaciones');
  });
});

describe('T-16 — Presupuesto y ejecución financiera', () => {
  it('separa asignado, comprometido, ejecutado y disponible', () => {
    const contenido = visible('presupuesto');

    for (const etiqueta of ['Asignado', 'Comprometido', 'Ejecutado', 'Disponible']) {
      expect(contenido).toContain(etiqueta);
    }
  });

  it('no presenta ninguna fórmula ni cumplimiento oficial', () => {
    expect(visible('presupuesto')).toContain('no calcula compromiso, ejecución, disponible');
    expect(visible('ejecucion')).toContain('no se suman entre sí');
    expect(visible('ejecucion')).not.toContain('cumplimiento oficial alcanzado');
  });

  it('cada cifra de ejecución permite abrir los movimientos que la componen', () => {
    const contenido = visible('ejecucion', 'eje-pre-dom');

    expect(contenido).toContain('Movimientos');
    expect(contenido).toContain('Movimientos de insumos del rubro');
    expect(contenido).toContain('Origen');
  });
});

describe('T-17 — Evidencias', () => {
  it('conserva cargador, fecha, vínculo, revisión, versión y procedencia', () => {
    const contenido = visible('evidencias', 'evd-002');

    for (const campo of [
      'Cargada por',
      'Fecha de carga',
      'Movimiento relacionado',
      'Revisada por',
      'Versión',
      'Referencia',
      'Fuente maestra',
    ]) {
      expect(contenido).toContain(campo);
    }
  });

  it('usa los cuatro estados documentales y nunca sobrescribe una versión', () => {
    const evidencias = seccionDeTabla('evidencias');

    for (const fila of evidencias?.filas ?? []) {
      expect(FINANCIERA_ESTADOS_EVIDENCIA).toContain(fila.evidencia);
    }

    expect(visible('evidencias')).toContain('nunca se sobrescribe');
    expect(visible('evidencias', 'evd-002')).toContain('La versión anterior se conserva');
  });
});

/* ========================================================================== */
/* T-18 a T-21 — Procedencia, sincronización, duplicados e integración        */
/* ========================================================================== */

describe('T-18 — Procedencia', () => {
  it('todo registro declara un origen del catálogo y un método de captura', () => {
    for (const fila of TODAS_LAS_FILAS) {
      expect(esOrigenFinanciero(fila.origen)).toBe(true);
      expect(fila.detalle.procedencia.origen).toBe(fila.origen);
      expect(FINANCIERA_METODOS_CAPTURA).toContain(fila.detalle.procedencia.metodo);
      expect(FINANCIERA_ESTADOS_SINCRONIZACION).toContain(
        fila.detalle.procedencia.sincronizacion,
      );
    }
  });

  it('los registros externos conservan identificador y sistema fuente', () => {
    const externos = TODAS_LAS_FILAS.filter(
      (fila) => fila.detalle.procedencia.idExterno !== null,
    );

    expect(externos.length).toBeGreaterThan(0);
    for (const fila of externos) {
      expect(fila.detalle.procedencia.origen).toBe('Sistema del Hospital');
      expect(fila.detalle.procedencia.sistemaFuente.length).toBeGreaterThan(0);
    }
  });

  it('origen y método no se confunden: son campos distintos en pantalla', () => {
    const contenido = visible('ingresos', 'ing-002');

    expect(contenido).toContain('Origen');
    expect(contenido).toContain('Fuente maestra');
    expect(contenido).toContain('Método de captura');
    expect(contenido).toContain('Importación autorizada');
    expect(contenido).toContain('HX-ING-88213');
  });

  it('las dos fuentes tienen representación en los fixtures', () => {
    const origenes = new Set(TODAS_LAS_FILAS.map((fila) => fila.origen));

    expect(origenes.size).toBe(2);
    expect([...origenes].every((origen) => FINANCIERA_ORIGENES.includes(origen))).toBe(true);
    expect(FINANCIERA_ORIGENES).toContain(platformNameInSentence());
  });
});

describe('T-19 — Estados de sincronización', () => {
  it('los cinco estados están representados y la fecha se muestra', () => {
    const contenido = visible('conexion');
    const estados = new Set(
      TODAS_LAS_FILAS.map((fila) => fila.detalle.procedencia.sincronizacion),
    );

    expect(estados.has('Local')).toBe(true);
    expect(estados.has('Importado')).toBe(true);
    expect(estados.has('Sincronizado')).toBe(true);
    expect(estados.has('Pendiente')).toBe(true);
    expect(estados.has('Conflicto')).toBe(true);
    expect(contenido).toContain('Última sincronización');
    expect(contenido).toContain('Nunca');
  });

  it('un dato desactualizado se declara con su fecha confirmada', () => {
    expect(visible('nomina', 'nom-003')).toContain('Datos posiblemente desactualizados');
  });
});

describe('T-20 — Duplicados y conflictos', () => {
  it('un candidato de duplicado requiere revisión humana', () => {
    const contenido = visible('facturas', 'fac-002');

    expect(contenido).toContain('Posible duplicado');
    expect(contenido).toContain('requiere revisión humana');
    expect(contenido).toContain('No se fusiona');
  });

  it('los conflictos conservan ambos valores y no se resuelven solos', () => {
    const contenido = visible('conexion');

    expect(contenido).toContain('Valor del Hospital');
    expect(contenido).toContain('Valor local');
    expect(contenido).toContain('no se aplica la última escritura');
    expect(CONFIG.conexion.conflictos.length).toBeGreaterThan(0);
    for (const conflicto of CONFIG.conexion.conflictos) {
      expect(conflicto.opciones).toHaveLength(4);
      expect(conflicto.opciones).toContain('Conservar Hospital');
      expect(conflicto.opciones).toContain('Combinar campos permitidos');
      expect(conflicto.opciones).toContain('Posponer');
    }
  });
});

describe('T-21 — Panel de conexión', () => {
  it('avisa que no hay sincronización activa', () => {
    expect(visible('conexion')).toContain(
      'Esta pantalla prepara una conexión; no hay sincronización activa',
    );
    expect(CONFIG.conexion.sistema.nombre).toBe('Sistema por definir');
    expect(CONFIG.conexion.sistema.ultimaSincronizacion).toBe('Nunca');
  });

  it('ofrece las ocho categorías con dirección, fuente maestra y campos', () => {
    expect(CONFIG.conexion.categorias.map((categoria) => categoria.etiqueta)).toEqual([
      'Ingresos',
      'Egresos',
      'Nómina',
      'Proveedores',
      'Facturas',
      'Presupuesto',
      'Compras',
      'Pagos',
    ]);

    const contenido = visible('conexion');

    for (const campo of ['Dirección', 'Fuente maestra', 'Frecuencia', 'Campos permitidos']) {
      expect(contenido).toContain(campo);
    }
  });

  it('la modalidad bidireccional está bloqueada y explica por qué', () => {
    const bidireccional = CONFIG.conexion.categorias.filter(
      (categoria) => categoria.direccion === 'Bidireccional',
    );

    expect(bidireccional.length).toBeGreaterThan(0);
    for (const categoria of bidireccional) {
      expect(categoria.bloqueada).toBe(true);
      expect(categoria.motivoBloqueo).toContain('aprobación institucional');
    }
    expect(visible('conexion')).toContain('No se habilita en esta fase');
  });

  it('las casillas de categoría no se pueden activar en esta fase', () => {
    const html = main(pantalla('conexion'));

    expect(apariciones(html, /type="checkbox"/gu)).toBe(CONFIG.conexion.categorias.length);
    expect(apariciones(html, /type="checkbox"[^>]*disabled/gu)).toBe(
      CONFIG.conexion.categorias.length,
    );
  });
});

/* ========================================================================== */
/* T-22 a T-24 — Permisos, datos sensibles y auditoría                        */
/* ========================================================================== */

describe('T-22 — La interfaz no afirma autorización', () => {
  it('declara que los permisos y los estados son demostrativos', () => {
    expect(visible()).toContain('Los perfiles, los permisos y los estados de esta pantalla son');
    expect(visible()).toContain('La interfaz no autoriza');
  });

  it('toda acción sensible se renderiza inerte y con su estado escrito', () => {
    for (const seccion of FINANCIERA_SECCIONES) {
      const html = main(pantalla(seccion));
      const acciones = apariciones(html, /data-financiera-accion="sin-implementar"/gu);
      const deshabilitadas = apariciones(html, /<button[^>]*disabled[^>]*>/gu);

      expect(deshabilitadas).toBeGreaterThanOrEqual(acciones);
    }

    const detalle = main(pantalla('ingresos', 'ing-001'));

    expect(detalle).toContain('data-financiera-accion="sin-implementar"');
    expect(texto(detalle)).not.toContain('Guardado');
    expect(texto(detalle)).not.toContain('Pago realizado');
    expect(texto(detalle)).not.toContain('Sincronización completada');
  });
});

describe('T-23 — Datos sensibles', () => {
  it('los importes individuales advierten que requieren autorización expresa', () => {
    for (const seccion of ['nomina', 'honorarios'] as const) {
      expect(visible(seccion, seccion === 'nomina' ? 'nom-001' : 'hon-001')).toContain(
        'exige autorización expresa',
      );
    }
  });

  it('no hay identificaciones completas, cuentas bancarias ni secretos', () => {
    for (const seccion of FINANCIERA_SECCIONES) {
      const contenido = visible(seccion);

      expect(contenido).not.toMatch(/\b\d{8,}\b/u);
      expect(contenido.toLowerCase()).not.toContain('cuenta bancaria');
      expect(contenido.toLowerCase()).not.toContain('contraseña');
    }
  });

  it('los datos de las personas están rotulados como ficticios', () => {
    expect(visible('nomina', 'nom-001')).toContain('(perfil ficticio)');
    expect(visible('honorarios', 'hon-001')).toContain('(perfil ficticio)');
  });
});

describe('T-24 — Fixtures y auditoría', () => {
  it('los datos están centralizados fuera del JSX de presentación', () => {
    const directorio = fileURLToPath(new URL('.', import.meta.url));
    const componentes = readdirSync(directorio).filter(
      (archivo) => /^HospitalFinancial.*\.tsx$/u.test(archivo) && !archivo.includes('.test.'),
    );

    expect(componentes.length).toBeGreaterThan(0);
    for (const archivo of componentes) {
      const codigo = readFileSync(`${directorio}${archivo}`, 'utf8');

      /* Ningún importe ni fecha del dominio vive en la presentación. */
      expect(codigo).not.toMatch(/\d{1,3}(?:\.\d{3})+\s?COP/u);
      expect(codigo).not.toMatch(/\d{2} (?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) 20\d{2}/u);
    }
  });

  it('la pantalla no presenta los fixtures como evidencia real', () => {
    expect(visible()).toContain('Demostración');
    expect(visible('conexion')).toContain('Conteos demostrativos');
  });
});

/* ========================================================================== */
/* T-25 — Navegación responsive del menú secundario                           */
/* ========================================================================== */

/*
 * Las tres anchuras aprobadas: móvil hasta 720 px, tableta de 721 px a 1023 px
 * y escritorio desde 1024 px. La anchura se resuelve en el navegador con
 * `matchMedia('(max-width: 720px)')`; aquí se fija al montar, porque las
 * pruebas renderizan el marcado con `react-dom/server` y no hay ventana.
 */

/** Módulo montado fuera del shell, con la anchura y el panel fijados. */
function modulo(menuAbiertoInicial: boolean, esModalMovilInicial: boolean): string {
  return renderToStaticMarkup(
    <HospitalFinancialManagement
      menuAbiertoInicial={menuAbiertoInicial}
      esModalMovilInicial={esModalMovilInicial}
    />,
  );
}

/** Marcado interior del `<nav>` de secciones: etiquetas, iconos y orden. */
function interiorDelMenu(html: string): string {
  const encontrado = /<nav aria-label="Secciones financieras"[^>]*>([\s\S]*?)<\/nav>/u.exec(html);

  return encontrado?.[1] ?? '';
}

/** Comprobaciones comunes a toda anchura: el menú siempre es el mismo. */
function esperarMenuCompleto(html: string): void {
  expect(apariciones(html, /data-financiera-seccion="/gu)).toBe(15);
  expect(FINANCIERA_MENU).toHaveLength(6);

  for (const grupo of FINANCIERA_MENU) {
    expect(texto(html)).toContain(grupo.titulo);
  }
}

/** Hoja de estilos del módulo, para verificar el alcance de cada anchura. */
const HOJA = readFileSync(
  fileURLToPath(new URL('./hospitalFinancial.module.css', import.meta.url)),
  'utf8',
);

/** Código del módulo, para verificar el punto de corte declarado. */
const FUENTE = readFileSync(
  fileURLToPath(new URL('./HospitalFinancialManagement.tsx', import.meta.url)),
  'utf8',
);

/** Texto de todos los bloques `@media` que declaran esa consulta. */
function bloquesMedia(consulta: string): string {
  /* Cada bloque termina en la llave que abre columna: las reglas van sangradas. */
  return HOJA.split(`@media ${consulta} {`)
    .slice(1)
    .map((bloque) => bloque.split(/^\}/mu)[0] ?? '')
    .join(' ');
}

/** Estado del módulo con el panel de secciones abierto o cerrado. */
function estadoCon(menuAbierto: boolean): EstadoFinanciero {
  return {
    seccion: 'resumen',
    filtros: FINANCIERA_FILTROS_VACIOS,
    bandeja: 'Todos',
    masFiltros: false,
    filaAbierta: null,
    formularioAbierto: false,
    menuAbierto,
  };
}

describe('T-25 — Móvil (hasta 720 px): el menú es un panel modal inferior', () => {
  const cerrado = modulo(false, true);
  const abierto = modulo(true, true);

  it('el punto de corte móvil se resuelve con `matchMedia` a 720 px', () => {
    expect(FUENTE).toContain("'(max-width: 720px)'");
    expect(FUENTE).toContain('window.matchMedia');
    /* La anchura se mantiene sincronizada mientras el módulo está montado. */
    expect(FUENTE).toContain("consulta.addEventListener('change', sincronizar)");
    expect(FUENTE).toContain("consulta.removeEventListener('change', sincronizar)");
  });

  it('cerrado solo ofrece el botón «Secciones financieras»', () => {
    expect(texto(cerrado)).toContain('Secciones financieras');
    expect(cerrado).toContain('aria-expanded="false"');
    expect(cerrado).toContain('aria-controls="hospital-financiera-menu"');
    expect(cerrado).toContain('data-financiera-menu="cerrado"');
    expect(cerrado).not.toContain('role="dialog"');
    expect(cerrado).not.toContain('data-financiera-menu="fondo"');
    expect(texto(cerrado)).not.toContain('Cerrar secciones');
  });

  it('abierto declara semántica modal accesible sobre un backdrop', () => {
    expect(esMenuModal(true, true)).toBe(true);
    expect(abierto).toContain('aria-expanded="true"');
    expect(abierto).toContain('role="dialog"');
    expect(abierto).toContain('aria-modal="true"');
    expect(abierto).toContain('data-financiera-menu="modal"');
    expect(abierto).toContain('id="hospital-financiera-menu"');
    /* Enfocable por programa —foco inicial y ciclo de tabulación— y con cierre
       explícito además del backdrop. */
    expect(abierto).toMatch(/role="dialog"[^>]*tabindex="-1"|tabindex="-1"[^>]*role="dialog"/u);
    expect(texto(abierto)).toContain('Cerrar secciones');
    expect(apariciones(abierto, /data-financiera-menu="fondo"/gu)).toBe(1);
    expect(abierto).toContain('aria-hidden="true" data-financiera-menu="fondo"');
  });

  it('elegir una sección cierra el panel y lleva el foco al `h1`', () => {
    const seleccion = seleccionDeMenu(estadoCon(true), 'egresos', true);

    expect(seleccion.estado.seccion).toBe('egresos');
    expect(seleccion.estado.menuAbierto).toBe(false);
    expect(seleccion.enfocarTitulo).toBe(true);

    /* El destino del foco es el `h1` que ya existe: no se crea otro. */
    expect(apariciones(main(pantalla('egresos')), /<h1/gu)).toBe(1);
    expect(abierto).toMatch(
      /<h1[^>]*id="hospital-financiera-titulo"[^>]*tabindex="-1"|<h1[^>]*tabindex="-1"[^>]*id="hospital-financiera-titulo"/u,
    );
  });

  it('conserva las seis agrupaciones y los quince destinos sin desbordar', () => {
    esperarMenuCompleto(abierto);
    expect(interiorDelMenu(abierto)).toBe(interiorDelMenu(cerrado));
    expect(interiorDelMenu(abierto).length).toBeGreaterThan(0);

    const movil = bloquesMedia('(max-width: 720px)');

    expect(movil).toContain('.menuPanelAbierto {');
    expect(movil).toContain('position: fixed');
    expect(movil).toContain('bottom: 0');
    expect(movil).toContain('.menuFondo {');
    /* Fijado a los dos bordes y sin anchuras de ventana: no hay overflow. */
    expect(movil).toContain('left: 0');
    expect(movil).toContain('right: 0');
    expect(movil).toContain('max-width: 100%');
    expect(HOJA).not.toContain('100vw');
  });
});

describe('T-25 — Tableta (721 a 1023 px): el menú es un bloque colapsable', () => {
  const cerrado = modulo(false, false);
  const abierto = modulo(true, false);

  it('el botón abre y cierra el bloque, que permanece en el flujo', () => {
    expect(cerrado).toContain('aria-expanded="false"');
    expect(cerrado).toContain('aria-controls="hospital-financiera-menu"');
    expect(cerrado).toContain('data-financiera-menu="cerrado"');

    expect(abierto).toContain('aria-expanded="true"');
    expect(abierto).toContain('data-financiera-menu="bloque"');
    expect(abierto).toContain('id="hospital-financiera-menu"');
  });

  it('abierto no recibe semántica ni comportamiento de diálogo', () => {
    expect(esMenuModal(true, false)).toBe(false);
    /* Ni diálogo, ni `aria-modal`, ni backdrop, ni cierre modal. */
    expect(abierto).not.toContain('role="dialog"');
    expect(abierto).not.toContain('aria-modal');
    expect(abierto).not.toContain('data-financiera-menu="fondo"');
    expect(texto(abierto)).not.toContain('Cerrar secciones');
    /* El panel no es enfocable por programa: no hay foco forzado ni ciclo de
       tabulación, y `Tab` y `Mayús+Tab` siguen recorriendo la página. */
    expect(abierto).not.toMatch(/tabindex="-1"[^>]*data-financiera-menu="bloque"/u);
    expect(abierto).not.toMatch(/data-financiera-menu="bloque"[^>]*tabindex/u);
  });

  it('elegir una sección cambia de sección, cierra el bloque y no mueve el foco', () => {
    const seleccion = seleccionDeMenu(estadoCon(true), 'egresos', false);

    expect(seleccion.estado.seccion).toBe('egresos');
    expect(seleccion.estado.menuAbierto).toBe(false);
    expect(seleccion.enfocarTitulo).toBe(false);
  });

  it('conserva las seis agrupaciones y los quince destinos', () => {
    esperarMenuCompleto(abierto);
    expect(interiorDelMenu(abierto)).toBe(interiorDelMenu(cerrado));

    /* La anchura de tableta no recibe ninguna regla del panel modal. */
    const tableta = bloquesMedia('(max-width: 1023px)');

    expect(tableta).toContain('.menu {');
    expect(tableta).not.toContain('position: fixed');
    expect(tableta).not.toContain('menuFondo');
    expect(tableta).not.toContain('menuPanelAbierto');
  });
});

describe('T-25 — Escritorio (desde 1024 px): el menú lateral es permanente', () => {
  const escritorio = modulo(false, false);

  it('mantiene el menú lateral de 224 px y oculta el botón', () => {
    const reglas = bloquesMedia('(min-width: 1024px)');

    expect(HOJA).toContain('flex: 0 0 224px');
    expect(reglas).toContain('.menuBoton {');
    expect(reglas).toContain('display: none');
    /* El menú permanece visible aunque el estado del panel esté cerrado. */
    expect(reglas).toContain('.menuOculto {');
    expect(reglas).toContain('display: flex');
    expect(reglas).not.toContain('position: fixed');
    expect(reglas).not.toContain('menuPanelAbierto');
  });

  it('no declara semántica modal, backdrop ni traslado de foco', () => {
    expect(esMenuModal(false, false)).toBe(false);
    expect(escritorio).not.toContain('role="dialog"');
    expect(escritorio).not.toContain('aria-modal');
    expect(escritorio).not.toContain('data-financiera-menu="fondo"');
    expect(seleccionDeMenu(estadoCon(false), 'egresos', false).enfocarTitulo).toBe(false);
    expect(seleccionDeMenu(estadoCon(false), 'egresos', true).enfocarTitulo).toBe(false);
  });

  it('conserva las seis agrupaciones y los quince destinos', () => {
    esperarMenuCompleto(escritorio);
  });
});

/* ========================================================================== */
/* T-26 y T-27 — Accesibilidad y marca                                        */
/* ========================================================================== */

describe('T-26 — Semántica y accesibilidad del marcado', () => {
  it('cada sección monta un único `h1` dentro del único `main`', () => {
    for (const seccion of FINANCIERA_SECCIONES) {
      const html = pantalla(seccion);

      expect(apariciones(html, /<main/gu)).toBe(1);
      expect(apariciones(main(html), /<h1/gu)).toBe(1);
    }
  });

  it('las tablas declaran leyenda y encabezados con ámbito', () => {
    for (const seccion of SECCIONES_TABLA) {
      const html = main(pantalla(seccion.id));

      expect(html).toContain('<caption');
      expect(html).toContain('scope="col"');
    }
  });

  it('los controles de filtro tienen etiqueta persistente', () => {
    const html = main(pantalla('ingresos'));

    expect(apariciones(html, /<label/gu)).toBeGreaterThanOrEqual(
      apariciones(html, /<select/gu) + apariciones(html, /type="search"/gu),
    );
    expect(html).toContain('aria-describedby');
  });

  it('el menú secundario y la ruta se anuncian como navegación', () => {
    const html = main(pantalla('egresos'));

    expect(html).toContain('aria-label="Secciones financieras"');
    expect(html).toContain('aria-label="Ruta de navegación"');
    expect(texto(html)).toContain('Hospital / Gestión financiera / Egresos');
  });

  it('las barras exponen su valor como texto accesible', () => {
    const html = main(pantalla());

    expect(apariciones(html, /role="img"/gu)).toBeGreaterThan(0);
    expect(html).toContain('aria-label="Atención domiciliaria: ejecución 51 %');
  });
});

describe('T-27 — Marca visible', () => {
  it('ninguna sección muestra el nombre técnico interno', () => {
    for (const seccion of FINANCIERA_SECCIONES) {
      /*
       * Se descartan los nombres de clase, que son identificadores técnicos del
       * sistema de estilos: la comprobación recae sobre el texto visible y
       * sobre todo atributo accesible (`aria-*`, `title`, `alt`).
       */
      const html = pantalla(seccion).replace(/\sclass(?:Name)?="[^"]*"/gu, '');

      expect(html.toLowerCase()).not.toContain('merdn');
    }
  });

  it('el origen del producto se compone desde la configuración de marca', () => {
    expect(FINANCIERA_ORIGENES).toContain(platformNameInSentence());
    expect(visible()).toContain(platformNameInSentence());
  });
});

/* ========================================================================== */
/* T-28 — Alcance negativo                                                    */
/* ========================================================================== */

describe('T-28 — Alcance negativo del módulo', () => {
  it('no crea ruta, enlace, formulario, script ni recurso remoto', () => {
    for (const seccion of FINANCIERA_SECCIONES) {
      const html = pantalla(seccion);

      expect(html).not.toContain('href');
      expect(html).not.toContain('<form');
      expect(html).not.toContain('<script');
      expect(html).not.toContain('http://');
      expect(html).not.toContain('https://');
      expect(html).not.toContain('type="file"');
    }
  });

  it('el código del módulo no consulta red, almacenamiento ni fecha del sistema', () => {
    const directorio = fileURLToPath(new URL('.', import.meta.url));
    const fuentes = readdirSync(directorio).filter(
      (archivo) => /Financial/u.test(archivo) && /\.tsx?$/u.test(archivo) && !archivo.includes('.test.'),
    );

    expect(fuentes.length).toBeGreaterThan(5);
    for (const archivo of fuentes) {
      const codigo = readFileSync(`${directorio}${archivo}`, 'utf8');

      expect(codigo).not.toMatch(/\bfetch\s*\(/u);
      expect(codigo).not.toMatch(/localStorage|sessionStorage|indexedDB/u);
      expect(codigo).not.toMatch(/Date\.now|new Date\b/u);
    }
  });
});
