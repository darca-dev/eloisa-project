import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HospitalAlerts } from './HospitalAlerts';
import { hospitalAlertsDemo } from './hospitalAlertsConfig';
import { apariciones, texto } from './hospitalTestUtils';

/**
 * Vista «Semáforo de alarmas» (TASK-003H-03, T-08).
 *
 * Verifica la bandeja reutilizada de `Alarmas recientes`, el resumen de los
 * tres niveles, el detalle completo de la alerta roja, las seis acciones
 * visibles y las tres notas de continuidad.
 */

const HTML = renderToStaticMarkup(<HospitalAlerts />);
const TEXTO = texto(HTML);

describe('T-08 — Bandeja, resumen, detalle y continuidad', () => {
  it('reproduce el encabezado de la vista', () => {
    expect(TEXTO).toContain('Semáforo de alarmas');
    expect(TEXTO).toContain(
      'Las alarmas llegan solas desde la bitácora del paciente, la del cuidador, el registro del profesional o el motor de reglas. El hospital no las busca.',
    );
  });

  it('reproduce las cuatro alarmas de la bandeja con su acción Ver', () => {
    const { items, titulo, nota } = hospitalAlertsDemo.bandeja;

    expect(items).toHaveLength(4);
    expect(TEXTO).toContain(titulo);
    expect(TEXTO).toContain(nota);

    for (const alarma of items) {
      expect(TEXTO).toContain(
        `${alarma.paciente} ${alarma.motivo} ${alarma.nivel} ${alarma.cuando} Ver`,
      );
      expect(HTML).toContain(
        `aria-label="Ver el detalle de la alerta de ${alarma.paciente}"`,
      );
    }

    expect(apariciones(HTML, />Ver<\/button>/gu)).toBe(4);
  });

  it('reproduce las tres tarjetas de resumen', () => {
    expect(TEXTO).toContain('3 Rojas · requieren atención');
    expect(TEXTO).toContain('4 Amarillas · requieren seguimiento');
    expect(TEXTO).toContain('15 Estables o revisadas');
    expect(hospitalAlertsDemo.resumen.map((nivel) => nivel.tono)).toEqual([
      'rojo',
      'amarillo',
      'verde',
    ]);
  });

  it('reproduce el detalle completo de Sara Nieto Vargas', () => {
    const { detalle } = hospitalAlertsDemo;

    expect(TEXTO).toContain('DETALLE DE LA ALERTA');
    expect(TEXTO).toContain('Roja · sin atender');
    expect(TEXTO).toContain(
      'Sara Nieto Vargas · dificultad para respirar reportada en la bitácora',
    );
    expect(detalle.campos).toHaveLength(8);

    for (const campo of detalle.campos) {
      expect(TEXTO).toContain(`${campo.etiqueta} ${campo.valor}`);
    }

    expect(TEXTO).toContain(detalle.nota);
  });

  it('reproduce las seis acciones visibles en orden', () => {
    const etiquetas = hospitalAlertsDemo.detalle.acciones.map((accion) => accion.etiqueta);

    expect(etiquetas).toEqual([
      'Asignar a profesional',
      'Marcar en revisión',
      'Solicitar visita',
      'Solicitar consulta virtual',
      'Escalar',
      'Registrar acción y cerrar',
    ]);

    for (const etiqueta of etiquetas) {
      expect(apariciones(HTML, new RegExp(`>${etiqueta}</button>`, 'gu'))).toBe(1);
    }
  });

  it('reproduce las tres notas de continuidad y su nota explicativa', () => {
    const { items, titulo, nota } = hospitalAlertsDemo.continuidad;

    expect(items).toHaveLength(3);
    expect(TEXTO).toContain(titulo);

    for (const item of items) {
      expect(TEXTO).toContain(`${item.texto} ${item.meta} ${item.estado}`);
    }

    expect(items.map((item) => item.estado)).toEqual(['Pendiente', 'Pendiente', 'Atendida']);
    expect(TEXTO).toContain(nota);
  });

  it('no hay formularios, enlaces ni entradas de datos', () => {
    expect(HTML).not.toContain('<form');
    expect(HTML).not.toContain('<input');
    expect(HTML).not.toContain('<select');
    expect(HTML).not.toContain('<a ');
    expect(HTML).not.toContain('href');
    expect(apariciones(HTML, /<button\b/gu)).toBe(apariciones(HTML, /<button type="button"/gu));
  });

  it('mantiene un único encabezado principal y iconos decorativos', () => {
    expect(apariciones(HTML, /<h1\b/gu)).toBe(1);
    expect(apariciones(HTML, /<svg\b/gu)).toBe(apariciones(HTML, /aria-hidden="true" focusable/gu));
  });
});
