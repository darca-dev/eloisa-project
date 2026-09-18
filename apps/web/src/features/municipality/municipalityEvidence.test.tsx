import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { platformNameInSentence } from '@/config/branding';

import { MunicipalityEvidence } from './MunicipalityEvidence';
import { MunicipalityFinancialDetails } from './MunicipalityFinancialDetails';
import { MunicipalityShell } from './MunicipalityShell';
import {
  MUNICIPALITY_ESTADOS_EVIDENCIA,
  MUNICIPALITY_ESTADOS_FINANCIEROS,
  MUNICIPALITY_ESTADOS_VALIDACION,
  MUNICIPALITY_FUENTES_FINANCIACION,
  MUNICIPALITY_ORIGENES_MOVIMIENTO,
  MUNICIPALITY_SYNC_ETIQUETAS,
  MUNICIPALITY_TIPOS_EVIDENCIA,
  evidenciasDeMovimiento,
  movimientoAlimentaEjecutado,
  municipalityDemo,
  municipalityEvidenciasDemo,
  municipalityMovimientosDemo,
  municipalityProgramasDemo,
} from './municipalityConfig';
import type { MunicipalityMovimientoFinanciero } from './municipalityConfig';
import { apariciones, etiquetasDeBotones, main, texto } from './municipalityTestUtils';

/**
 * Contexto institucional FICTICIO con el rol municipal (spec 022).
 *
 * Desde la spec 022, `MunicipalityShell` es una PUERTA: no monta ninguna vista
 * hasta que el servidor confirma una sesión institucional cuyo rol es
 * EXACTAMENTE `MUNICIPAL_VIEWER`. Estas pruebas verifican la composición
 * AUTORIZADA, y `renderToStaticMarkup` no ejecuta efectos, de modo que sin
 * inyectar el contexto se renderizaría siempre el estado «comprobando».
 *
 * Inyectarlo NO concede acceso a nadie ni relaja el fallo cerrado: la regla de
 * rol es la misma y sigue viviendo en `municipalitySession.tsx`, el servidor
 * sigue decidiendo cada consulta agregada, y la ruta `/municipality` no pasa
 * esta propiedad. La fixture es LOCAL a este archivo a propósito: no es código
 * de producción y no se comparte en tiempo de ejecución.
 *
 * Nada de lo que contiene es real. Lo que la puerta hace y deja de hacer se
 * prueba en `municipalitySession.test.tsx`.
 */
const SESION_MUNICIPAL_FICTICIA = {
  role: 'MUNICIPAL_VIEWER',
  expiresAt: '2026-08-27T20:00:00.000Z',
  institution: { name: 'Entidad institucional de pruebas' },
  actorDisplay: 'Acceso institucional',
} as const;


/**
 * Evidencias de ejecución de Alcaldía (TASK-ALCALDIA-A-04, T-01, T-02, T-07 a
 * T-11, T-16 a T-21 y T-23 a T-27).
 *
 * La vista se renderiza con `react-dom/server`, igual que el resto del
 * frontend: el repositorio no incluye jsdom ni una librería de testing con DOM,
 * y esta tarea no autoriza añadir dependencias. El detalle modal se monta
 * directamente para verificar su marcado; la apertura por clic, el ciclo de
 * foco, `Escape` y el retorno del foco al activador se verifican manualmente en
 * navegador y se reportan como no automatizados.
 */

const CONFIG = municipalityDemo.evidencias;

/** Marcado de la vista aislada. */
function vista(): string {
  return renderToStaticMarkup(<MunicipalityEvidence />);
}

/** Marcado del shell con Evidencias montado. */
function shellEvidencias(): string {
  return renderToStaticMarkup(<MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial="evidencias" />);
}

/** Marcado del detalle local de un movimiento concreto. */
function detalle(movimientoId: string): string {
  const movimiento = municipalityMovimientosDemo.find((item) => item.id === movimientoId);

  if (movimiento === undefined) {
    throw new Error(`Movimiento inexistente en el fixture: ${movimientoId}`);
  }

  return renderToStaticMarkup(
    <MunicipalityFinancialDetails
      config={CONFIG}
      movimiento={movimiento}
      onCerrar={() => undefined}
      programas={municipalityProgramasDemo}
    />,
  );
}

/** Código fuente de los componentes, para las comprobaciones estructurales. */
const DIRECTORIO = dirname(fileURLToPath(import.meta.url));
const FUENTE_VISTA = readFileSync(join(DIRECTORIO, 'MunicipalityEvidence.tsx'), 'utf8');
const FUENTE_DETALLE = readFileSync(
  join(DIRECTORIO, 'MunicipalityFinancialDetails.tsx'),
  'utf8',
);

/* ------------------------------ T-01 y T-02 ------------------------------- */

describe('Evidencias — navegación y fidelidad (T-01, T-02)', () => {
  it('el shell monta la vista propia y no el estado «Próximamente»', () => {
    const html = shellEvidencias();
    const contenido = texto(main(html));

    expect(html).toContain('data-municipality-content="evidencias"');
    expect(contenido).toContain(CONFIG.titulo);
    expect(contenido).toContain(CONFIG.descripcion);
    expect(contenido).not.toContain('Este módulo se implementará en una tarea posterior.');
  });

  it('conserva el título y el subtítulo vinculantes de la referencia', () => {
    const visible = texto(vista());

    expect(visible).toContain('Evidencias de ejecución');
    expect(visible).toContain(
      'Qué se hizo, para quién, cuándo, quién lo hizo, cuánto costó, de qué presupuesto salió, quién recibió el pago, cuál es el soporte y qué resultado produjo.',
    );
  });

  it('conserva la tabla aprobada «Facturas y soportes» y el bloque «Al abrir una evidencia»', () => {
    const visible = texto(vista());

    expect(visible).toContain('Facturas y soportes');
    expect(visible).toContain(CONFIG.alAbrirTitulo);
    expect(visible).toContain(CONFIG.alAbrirTexto);
  });

  it('no crea una pantalla ni una subsección «Movimientos»', () => {
    const visible = texto(vista());

    expect(visible).not.toMatch(/^Movimientos$/mu);
    expect(visible).not.toMatch(/Ver movimientos|Ir a movimientos/iu);
    /* El menú aprobado tampoco gana ninguna opción nueva. */
    expect(municipalityDemo.navegacion.map((item) => item.id)).not.toContain('movimientos');
  });
});

/* --------------------------------- T-16 ---------------------------------- */

describe('Evidencias — nivel de evidencia (T-16, FR-11)', () => {
  it('muestra porcentaje, actividades con soporte y pendientes como texto', () => {
    const visible = texto(vista());

    expect(visible).toContain(CONFIG.nivel.porcentajeTexto);
    expect(visible).toContain(CONFIG.nivel.detalle);
    expect(CONFIG.nivel.actividadesConSoporte + CONFIG.nivel.pendientes).toBe(
      CONFIG.nivel.actividadesEjecutadas,
    );
  });

  it('la barra declara semántica de progreso con su valor textual', () => {
    const html = vista();

    expect(html).toMatch(/role="progressbar"/u);
    expect(html).toContain(`aria-valuenow="${String(CONFIG.nivel.porcentaje)}"`);
    expect(html).toContain(`aria-valuetext="${CONFIG.nivel.porcentajeTexto}"`);
  });
});

/* ------------------------------ T-09 y T-17 ------------------------------- */

describe('Evidencias — historial de movimientos (T-09, FR-07)', () => {
  it('declara las diez columnas visibles exigidas, en su orden', () => {
    expect(Object.values(CONFIG.movimientosColumnas)).toStrictEqual([
      'FECHA',
      'FACTURA O CUENTA',
      'PROVEEDOR O ENTIDAD',
      'PROGRAMA',
      'FUENTE',
      'VALOR',
      'ESTADO FINANCIERO',
      'ESTADO DEL SOPORTE',
      'ORIGEN DEL DATO',
      'DETALLE',
    ]);

    const visible = texto(vista());

    for (const columna of Object.values(CONFIG.movimientosColumnas)) {
      expect(visible).toContain(columna);
    }
  });

  it('cada fila muestra fecha, referencia, entidad, programa, fuente y valor', () => {
    const visible = texto(vista());

    for (const movimiento of municipalityMovimientosDemo) {
      const programa = municipalityProgramasDemo.find(
        (item) => item.id === movimiento.programaId,
      );
      const fuente = MUNICIPALITY_FUENTES_FINANCIACION.find(
        (item) => item.id === movimiento.fuenteId,
      );

      expect(visible).toContain(movimiento.fecha);
      expect(visible).toContain(movimiento.referencia);
      expect(visible).toContain(movimiento.entidad);
      expect(visible).toContain(programa?.nombre ?? '');
      expect(visible).toContain(fuente?.etiqueta ?? '');
      expect(visible).toContain(movimiento.valorTexto);
    }
  });

  it('cada fila escribe estado financiero, estado de validación y origen', () => {
    const visible = texto(vista());

    for (const movimiento of municipalityMovimientosDemo) {
      expect(visible).toContain(MUNICIPALITY_ESTADOS_FINANCIEROS[movimiento.estadoFinanciero]);
      expect(visible).toContain(MUNICIPALITY_ESTADOS_VALIDACION[movimiento.estadoValidacion]);
      expect(visible).toContain(MUNICIPALITY_ORIGENES_MOVIMIENTO[movimiento.origen]);
    }
  });

  it('cada fila ofrece «Ver evidencia» con nombre accesible propio', () => {
    const html = vista();

    expect(etiquetasDeBotones(html)).toStrictEqual(
      municipalityMovimientosDemo.map(() => 'Ver evidencia'),
    );

    for (const movimiento of municipalityMovimientosDemo) {
      expect(html).toContain(`aria-label="DETALLE de ${movimiento.referencia}"`);
    }
  });

  it('declara que es una selección demostrativa y no el libro completo', () => {
    const visible = texto(vista());

    expect(visible).toContain(CONFIG.movimientosNota);
    expect(visible).toContain('no reproduce el ejecutado de ningún programa');
  });
});

/* ------------------------- T-07, T-08, T-17 y T-18 ------------------------ */

describe('Evidencias — estados financieros y de soporte (T-07, T-17)', () => {
  it('los cuatro estados financieros y los cuatro de validación están escritos', () => {
    expect(Object.values(MUNICIPALITY_ESTADOS_FINANCIEROS)).toStrictEqual([
      'Asignado',
      'Comprometido',
      'Causado/Obligado',
      'Pagado',
    ]);
    expect(Object.values(MUNICIPALITY_ESTADOS_VALIDACION)).toStrictEqual([
      'Pendiente',
      'En revisión',
      'Falta soporte',
      'Validada',
    ]);
  });

  it('los seis estados de evidencia existen y aparecen escritos en la vista', () => {
    expect(Object.values(MUNICIPALITY_ESTADOS_EVIDENCIA)).toStrictEqual([
      'Completa',
      'Pendiente',
      'Falta soporte',
      'En revisión',
      'Validada',
      'Requiere corrección',
    ]);

    const visible = texto(vista());

    for (const etiqueta of Object.values(MUNICIPALITY_ESTADOS_EVIDENCIA)) {
      expect(visible).toContain(etiqueta);
    }
  });

  it('los seis estados de evidencia están representados por los fixtures', () => {
    const estados = new Set(municipalityEvidenciasDemo.map((evidencia) => evidencia.estado));

    expect(estados.size).toBe(Object.keys(MUNICIPALITY_ESTADOS_EVIDENCIA).length);
  });

  it('separa por escrito el estado de soporte del estado financiero', () => {
    const visible = texto(vista());

    expect(visible).toContain(CONFIG.estadosNota);
    expect(visible).toContain('nunca son estados financieros');
  });

  it('los diez tipos de soporte autorizados están representados', () => {
    expect(Object.values(MUNICIPALITY_TIPOS_EVIDENCIA)).toStrictEqual([
      'Factura',
      'Cuenta de cobro',
      'Recibo',
      'Comprobante de pago',
      'Contrato',
      'Convenio',
      'Orden',
      'Fotografía',
      'Constancia',
      'Otro soporte autorizado',
    ]);

    const visible = texto(vista());

    for (const etiqueta of Object.values(MUNICIPALITY_TIPOS_EVIDENCIA)) {
      expect(visible).toContain(etiqueta);
    }
  });
});

/* ------------------------------ T-08 y T-18 ------------------------------- */

describe('Evidencias — una factura no es una ejecución (T-08, T-18)', () => {
  it('solo alimenta el ejecutado un movimiento pagado y validado', () => {
    const ejecutados = municipalityMovimientosDemo.filter((movimiento) =>
      movimientoAlimentaEjecutado(movimiento),
    );

    expect(ejecutados.length).toBeGreaterThan(0);

    for (const movimiento of ejecutados) {
      expect(movimiento.estadoFinanciero).toBe('PAGADO');
      expect(movimiento.estadoValidacion).toBe('VALIDADA');
    }
  });

  it('existe una factura registrada que no está pagada ni validada', () => {
    const factura = municipalityMovimientosDemo.find(
      (movimiento) => movimiento.id === 'mov-demo-004',
    );

    expect(factura?.tipoSoporte).toBe('FACTURA');
    expect(factura?.estadoFinanciero).not.toBe('PAGADO');
    expect(factura?.estadoValidacion).toBe('FALTA_SOPORTE');
    expect(movimientoAlimentaEjecutado(factura as MunicipalityMovimientoFinanciero)).toBe(false);
  });

  it('la evidencia faltante deja el movimiento pendiente y nunca ejecutado', () => {
    const pendientes = municipalityMovimientosDemo.filter(
      (movimiento) => !movimientoAlimentaEjecutado(movimiento),
    );

    expect(pendientes.length).toBeGreaterThan(0);

    for (const movimiento of pendientes) {
      const relacionadas = evidenciasDeMovimiento(movimiento.id, municipalityEvidenciasDemo);

      expect(relacionadas.length).toBeGreaterThan(0);

      for (const evidencia of relacionadas) {
        expect(evidencia.estado).not.toBe('VALIDADA');
      }
    }
  });

  it('ninguna evidencia por sí sola declara un estado financiero', () => {
    for (const evidencia of municipalityEvidenciasDemo) {
      expect(Object.keys(evidencia)).not.toContain('estadoFinanciero');
      expect(Object.values(MUNICIPALITY_ESTADOS_FINANCIEROS)).not.toContain(
        MUNICIPALITY_ESTADOS_EVIDENCIA[evidencia.estado],
      );
    }
  });
});

/* ------------------------------ T-10 y T-11 ------------------------------- */

describe('Evidencias — procedencia y registro único (T-10, T-11, FR-08, FR-09)', () => {
  it('declara los cinco orígenes aprobados y todos aparecen en el fixture', () => {
    expect(Object.values(MUNICIPALITY_ORIGENES_MOVIMIENTO)).toStrictEqual([
      platformNameInSentence(),
      'Sistema del Hospital',
      'Sistema de Alcaldía',
      'Importado',
      'Fuente oficial externa',
    ]);

    const usados = new Set(municipalityMovimientosDemo.map((movimiento) => movimiento.origen));

    expect(usados.size).toBe(Object.keys(MUNICIPALITY_ORIGENES_MOVIMIENTO).length);
  });

  it('cada movimiento conserva identificador interno propio y metadatos de sync', () => {
    const ids = new Set<string>();

    for (const movimiento of municipalityMovimientosDemo) {
      expect(movimiento.id).toMatch(/^mov-demo-\d{3}$/u);
      expect(ids.has(movimiento.id)).toBe(false);
      ids.add(movimiento.id);

      expect(movimiento.sync.masterSystem).not.toBe('');
      expect(movimiento.sync.lastSyncedAt).toBeNull();

      for (const referencia of movimiento.sync.referencias) {
        /* Un identificador externo nunca sustituye al identificador interno. */
        expect(referencia.externalId).not.toBe(movimiento.id);
      }
    }
  });

  it('no hay copias del mismo registro por audiencia', () => {
    const compartido = municipalityMovimientosDemo.filter(
      (movimiento) => movimiento.audiencias.length > 1,
    );

    expect(compartido.length).toBeGreaterThan(0);

    /* Ninguna referencia externa se repite en dos movimientos distintos. */
    const externos = municipalityMovimientosDemo.flatMap((movimiento) =>
      movimiento.sync.referencias
        .map((referencia) => referencia.externalId)
        .filter((externalId): externalId is string => externalId !== null),
    );

    expect(new Set(externos).size).toBe(externos.length);
  });

  it('toda evidencia referencia un movimiento existente y no lo duplica', () => {
    const ids = municipalityMovimientosDemo.map((movimiento) => movimiento.id);

    for (const evidencia of municipalityEvidenciasDemo) {
      expect(ids).toContain(evidencia.movimientoId);
      expect(Object.keys(evidencia)).not.toContain('movimiento');
    }
  });

  it('un movimiento puede tener varias evidencias sin duplicarse', () => {
    const relacionadas = evidenciasDeMovimiento('mov-demo-001', municipalityEvidenciasDemo);

    expect(relacionadas).toHaveLength(2);
    expect(
      municipalityMovimientosDemo.filter((movimiento) => movimiento.id === 'mov-demo-001'),
    ).toHaveLength(1);
  });

  it('no importa nada del código, del estado ni de la configuración de Hospital', () => {
    for (const fuente of [FUENTE_VISTA, FUENTE_DETALLE]) {
      expect(fuente).not.toMatch(/features\/hospital/u);
      expect(fuente).not.toMatch(/\bHospital[A-Z]/u);
    }
  });
});

/* --------------------------- T-19, T-20 y T-21 ---------------------------- */

describe('Evidencias — detalle local sin archivo ni integración (T-19, T-20, T-21)', () => {
  it('el detalle presenta los metadatos del movimiento exigidos', () => {
    const visible = texto(detalle('mov-demo-003'));
    const { detalle: etiquetas } = CONFIG;

    for (const etiqueta of [
      etiquetas.idInterno,
      etiquetas.referencia,
      etiquetas.fecha,
      etiquetas.concepto,
      etiquetas.programa,
      etiquetas.fuente,
      etiquetas.entidad,
      etiquetas.valor,
      etiquetas.estadoFinanciero,
      etiquetas.estadoValidacion,
      etiquetas.origen,
      etiquetas.sistemaMaestro,
      etiquetas.referenciaExterna,
      etiquetas.sincronizacion,
      etiquetas.ultimaSincronizacion,
      etiquetas.registradoPor,
      etiquetas.revisadoPor,
      etiquetas.audiencias,
      etiquetas.evidencias,
    ]) {
      expect(visible).toContain(etiqueta);
    }

    expect(visible).toContain('mov-demo-003');
    expect(visible).toContain('HOS-CC-2026-088');
    expect(visible).toContain('Alcaldía · Hospital');
  });

  it('sin conexión escribe «Conexión no habilitada» y no fabrica ninguna fecha', () => {
    const visible = texto(detalle('mov-demo-003'));

    expect(visible).toContain('Conexión no habilitada');
    expect(visible).toContain(CONFIG.detalle.sinSincronizacion);
  });

  it('ningún fixture declara un resultado de conciliación inexistente', () => {
    for (const movimiento of municipalityMovimientosDemo) {
      expect(['NOT_CONNECTED', 'NOT_APPLICABLE']).toContain(movimiento.sync.syncStatus);
    }

    /* Los seis estados existen como semántica preparada, sin usarse aquí. */
    expect(Object.keys(MUNICIPALITY_SYNC_ETIQUETAS)).toStrictEqual([
      'NOT_CONNECTED',
      'NOT_APPLICABLE',
      'PENDING',
      'MATCHED',
      'DIFFERENCE',
      'CONFLICT',
    ]);
  });

  it('muestra las evidencias relacionadas con su tipo, estado y actividad', () => {
    const visible = texto(detalle('mov-demo-001'));

    for (const evidencia of evidenciasDeMovimiento('mov-demo-001', municipalityEvidenciasDemo)) {
      expect(visible).toContain(evidencia.referencia);
      expect(visible).toContain(MUNICIPALITY_TIPOS_EVIDENCIA[evidencia.tipo]);
      expect(visible).toContain(MUNICIPALITY_ESTADOS_EVIDENCIA[evidencia.estado]);
      expect(visible).toContain(evidencia.actividad);
    }
  });

  it('no ofrece archivo, adjunto, enlace ni recurso remoto', () => {
    const html = detalle('mov-demo-004');

    expect(html).not.toMatch(/<(a|img|iframe|script|form|input|select|textarea)\b/u);
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('blob:');
    expect(texto(html)).toContain(CONFIG.sinArchivoNota);
  });

  it('el detalle no consulta red, almacenamiento ni temporizadores', () => {
    for (const patron of [
      /\bfetch\s*\(/u,
      /XMLHttpRequest/u,
      /WebSocket/u,
      /localStorage/u,
      /sessionStorage/u,
      /document\.cookie/u,
      /setInterval/u,
      /setTimeout/u,
      /https?:\/\//u,
      /dangerouslySetInnerHTML/u,
    ]) {
      expect(FUENTE_DETALLE).not.toMatch(patron);
      expect(FUENTE_VISTA).not.toMatch(patron);
    }
  });

  it('no existe panel, contador ni acción de conciliación', () => {
    const visible = texto(vista());

    expect(visible).toContain(CONFIG.conciliacionNota);
    expect(visible).not.toMatch(/conciliar ahora|ejecutar conciliación|sincronizar ahora/iu);
    expect(etiquetasDeBotones(detalle('mov-demo-001'))).toStrictEqual(['Cerrar']);
  });
});

/* --------------------------------- T-05 ---------------------------------- */

describe('Evidencias — integridad de las relaciones (T-05, T-06, §6)', () => {
  it('todo programaId de movimientos y evidencias resuelve contra A-03', () => {
    const ids = municipalityProgramasDemo.map((programa) => programa.id);

    for (const movimiento of municipalityMovimientosDemo) {
      expect(ids).toContain(movimiento.programaId);
    }

    for (const evidencia of municipalityEvidenciasDemo) {
      expect(ids).toContain(evidencia.programaId);
    }
  });

  it('todo fuenteId resuelve contra el catálogo de fuentes', () => {
    const ids = MUNICIPALITY_FUENTES_FINANCIACION.map((fuente) => fuente.id);

    for (const movimiento of municipalityMovimientosDemo) {
      expect(ids).toContain(movimiento.fuenteId);
    }

    for (const evidencia of municipalityEvidenciasDemo) {
      expect(ids).toContain(evidencia.fuenteId);
    }
  });

  it('el importe numérico y su etiqueta se declaran por separado', () => {
    for (const movimiento of municipalityMovimientosDemo) {
      expect(Number.isInteger(movimiento.valorPesos)).toBe(true);
      expect(movimiento.valorTexto).toMatch(/^\$[\d.]+$/u);
    }

    expect(FUENTE_VISTA).not.toContain('parseFloat');
    expect(FUENTE_VISTA).not.toContain('parseInt');
  });

  it('ADRES aparece solo en el movimiento que corresponde', () => {
    const conAdres = municipalityMovimientosDemo.filter(
      (movimiento) => movimiento.fuenteId === 'fue-adres',
    );

    expect(conAdres).toHaveLength(1);
    expect(conAdres.length).toBeLessThan(municipalityMovimientosDemo.length / 2);
  });
});

/* --------------------------- T-22, T-23 y T-24 ---------------------------- */

describe('Evidencias — privacidad, marca y rotulado (T-22, T-23, T-24)', () => {
  it('no expone datos clínicos, identidad ni compensación individual', () => {
    const visible = `${texto(vista())} ${municipalityMovimientosDemo
      .map((movimiento) => texto(detalle(movimiento.id)))
      .join(' ')}`;

    for (const patron of [
      /diagnóstic/iu,
      /historia clínica/iu,
      /medicament/iu,
      /cédula/iu,
      /documento de identidad/iu,
      /\bdirección\b/iu,
      /teléfono/iu,
      /salario/iu,
      /honorari/iu,
      /nómina/iu,
      /paciente/iu,
    ]) {
      expect(visible).not.toMatch(patron);
    }
  });

  it('los responsables son roles institucionales, no personas', () => {
    for (const movimiento of municipalityMovimientosDemo) {
      expect(movimiento.registro.rol).toMatch(/Secretaría|Hospital/u);
    }
  });

  it('no expone secretos ni credenciales de ningún sistema externo', () => {
    const visible = texto(vista());

    for (const patron of [/\btoken\b/iu, /\bapi key\b/iu, /contraseña/iu, /credencial/iu]) {
      expect(visible).not.toMatch(patron);
      expect(FUENTE_DETALLE).not.toMatch(patron);
    }
  });

  it('muestra el rotulado demostrativo y la marca pública aprobada', () => {
    const visible = texto(vista());

    expect(visible).toContain(municipalityDemo.demo.etiqueta);
    expect(visible).toContain(municipalityDemo.demo.aclaracion);
    /* La marca pública se compone desde la configuración centralizada. */
    expect(visible).toContain(platformNameInSentence());
    expect(vista().includes('MERDN')).toBe(false);
  });

  it('todo el fixture declara procedencia demostrativa y sin integración', () => {
    for (const registro of [...municipalityMovimientosDemo, ...municipalityEvidenciasDemo]) {
      expect(registro.procedencia.categoria).toBe('FIXTURE_DEMO');
      expect(registro.procedencia.asOf).toBeNull();
      expect(registro.procedencia.sincronizacion).toBe('SIN_INTEGRACION');
    }
  });
});

/* --------------------------------- T-25 ---------------------------------- */

describe('Evidencias — accesibilidad estructural (T-25)', () => {
  it('declara un solo encabezado principal y una jerarquía coherente', () => {
    const html = shellEvidencias();

    expect(apariciones(html, /<h1\b/gu)).toBe(1);
    expect(apariciones(vista(), /<h2\b/gu)).toBe(5);
    expect(vista()).not.toMatch(/<h[3456]\b/u);
  });

  it('la tabla se desplaza dentro de una región enfocable y nombrada', () => {
    const html = vista();

    expect(html).toMatch(/role="group"[^>]*tabindex="0"/u);
    expect(apariciones(html, /<caption\b/gu)).toBe(1);
    expect(apariciones(html, /<th[^>]*scope="col"/gu)).toBe(10);
    expect(apariciones(html, /<th[^>]*scope="row"/gu)).toBe(municipalityMovimientosDemo.length);
  });

  it('todos los controles son botones con tipo declarado', () => {
    for (const html of [vista(), detalle('mov-demo-001')]) {
      for (const boton of [...html.matchAll(/<button(?<atributos>[^>]*)>/gu)]) {
        expect(boton.groups?.atributos ?? '').toContain('type="button"');
      }
    }
  });

  it('el diálogo declara nombre, descripción y foco inicial', () => {
    const html = detalle('mov-demo-001');

    expect(html).toMatch(/role="dialog"/u);
    expect(html).toMatch(/aria-modal="true"/u);
    expect(html).toMatch(/aria-labelledby="[^"]+"/u);
    expect(html).toMatch(/aria-describedby="[^"]+"/u);
    expect(html).toMatch(/<h2[^>]*tabindex="-1"/u);
  });

  it('el diálogo cierra con Escape y devuelve el foco al activador', () => {
    expect(FUENTE_DETALLE).toContain("evento.key === 'Escape'");
    expect(FUENTE_DETALLE).toContain("evento.key !== 'Tab'");
    expect(FUENTE_VISTA).toContain('activador?.focus()');
  });

  it('el estado nunca se comunica solo por color', () => {
    const visible = texto(vista());

    for (const movimiento of municipalityMovimientosDemo) {
      expect(visible).toContain(MUNICIPALITY_ESTADOS_FINANCIEROS[movimiento.estadoFinanciero]);
    }
  });
});

/* --------------------------------- T-27 ---------------------------------- */

describe('Evidencias — no regresión y cadena declarada (T-27, FR-04.3)', () => {
  it('la cadena reproduce valores declarados del programa de A-03', () => {
    const programa = municipalityProgramasDemo.find(
      (item) => item.id === CONFIG.cadenaProgramaId,
    );

    expect(programa).toBeDefined();

    const visible = texto(vista());

    expect(visible).toContain(programa?.presupuesto.asignado ?? '');
    expect(visible).toContain(programa?.nombre ?? '');
    expect(visible).toContain(programa?.beneficiariosUnicos ?? '');
    expect(visible).toContain(programa?.evidencias.actividadesConSoporte ?? '');
    expect(visible).toContain(programa?.avanceFisico.porcentajeTexto ?? '');
    expect(visible).toContain(CONFIG.cadenaNota);
  });

  it('el selector temporal no recalcula ninguna cifra de Evidencias', () => {
    const conMes = texto(
      main(renderToStaticMarkup(<MunicipalityShell
            periodoInicial="mes"
            sesionInicial={SESION_MUNICIPAL_FICTICIA}
            vistaInicial="evidencias"
          />)),
    );
    const conAno = texto(
      main(renderToStaticMarkup(<MunicipalityShell
            periodoInicial="ano"
            sesionInicial={SESION_MUNICIPAL_FICTICIA}
            vistaInicial="evidencias"
          />)),
    );

    expect(conMes).toBe(conAno);
  });

  it('las vistas anteriores siguen montando su contenido propio', () => {
    for (const [modulo, titulo] of [
      ['inicio', municipalityDemo.inicio.titularesTitulo],
      ['poblacion', municipalityDemo.poblacion.titulo],
      ['territorio', municipalityDemo.territorio.titulo],
      ['programas', municipalityDemo.programas.titulo],
      ['presupuesto', municipalityDemo.presupuesto.titulo],
    ] as const) {
      const html = renderToStaticMarkup(<MunicipalityShell sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={modulo} />);

      expect(texto(main(html))).toContain(titulo);
    }
  });
});
