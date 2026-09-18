import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { branding } from '@/config/branding';

import { EliBubble, presentacionAprobada } from './EliBubble';
import type { EliTopic } from './EliBubble';

const TEMAS: readonly EliTopic[] = [
  { id: 'uno', question: '¿Qué pongo aquí?', answer: 'Un ejemplo del campo.' },
];

const html = renderToStaticMarkup(
  <EliBubble stepHelp="Ayuda del paso." topics={TEMAS} />,
);

describe('burbuja flotante de la IA (TASK-002A, FR-08)', () => {
  it('usa el activador tipo píldora con la expresión «PREGUNTA»', () => {
    expect(html).toContain('/eli/pregunta.png');
    expect(html).toContain(`¡Hola, soy ${branding.aiDisplayName}!`);
  });

  it('no reutiliza en el activador la expresión de la primera aparición', () => {
    expect(html).not.toContain('/eli/escucha.png');
    expect(html).not.toContain('/eli/saluda2.png');
  });

  it('admite la expresión y el rótulo del activador de inscripción (TASK-002B)', () => {
    const inscripcion = renderToStaticMarkup(
      <EliBubble
        stepHelp="Ayuda del paso."
        topics={TEMAS}
        triggerIntencion="saluda"
        triggerLabel={`¡Hola! Soy ${branding.aiDisplayName}`}
      />,
    );

    expect(inscripcion).toContain('/eli/saluda2.png');
    expect(inscripcion).toContain(`¡Hola! Soy ${branding.aiDisplayName}`);
    expect(inscripcion).not.toContain('/eli/pregunta.png');
    // El resto de la composición aprobada no cambia con la parametrización.
    expect(inscripcion).toContain('/eli/guia.png');
    expect(inscripcion).toContain('aria-expanded="false"');
    expect(inscripcion).toContain('EN ESTE PASO');
  });

  it('nace cerrada y declara la relación con su panel', () => {
    expect(html).toContain('aria-expanded="false"');

    const controls = /aria-controls="([^"]+)"/u.exec(html);
    expect(controls).not.toBeNull();

    const panelId = controls?.[1] as string;
    // El panel existe aunque esté oculto: `aria-controls` apunta a un elemento real.
    expect(html).toContain(`id="${panelId}"`);
    expect(html).toContain('hidden=""');
  });

  it('lleva el encabezado y la ayuda contextual del patrón aprobado', () => {
    expect(html).toContain('/eli/guia.png');
    expect(html).toContain('EN ESTE PASO');
    expect(html).toContain('Ayuda del paso.');
    expect(html).toContain('PUEDES PREGUNTARME');
    expect(html).toContain('¿Qué pongo aquí?');
  });

  it('muestra la presentación aprobada con su texto y puntuación exactos', () => {
    // El nombre proviene del branding central; el resto del texto es literal.
    expect(presentacionAprobada()).toBe(
      `¡Hola! Soy ${branding.aiDisplayName}. No soy médica, pero puedo ayudarte a ` +
        'resolver las inquietudes que tengas. Cuéntame, ¿qué necesitas?',
    );
    expect(html).toContain('No soy médica, pero puedo ayudarte a resolver las inquietudes');
    expect(html).toContain('Cuéntame, ¿qué necesitas?');
  });

  it('no muestra en ninguna parte la etiqueta «Asistente virtual»', () => {
    expect(html.toLowerCase()).not.toContain('asistente virtual');
  });

  it('no muestra la respuesta hasta que se elige un tema', () => {
    expect(html).not.toContain('Un ejemplo del campo.');
  });

  it('no ofrece voz, dictado ni conversación con una IA conectada', () => {
    const plano = html.toLowerCase();

    expect(plano).not.toContain('escribe o habla');
    expect(plano).not.toContain('<input');
    expect(plano).not.toContain('<textarea');
  });
});
