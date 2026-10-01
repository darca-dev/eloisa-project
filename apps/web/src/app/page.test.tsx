import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { branding, platformNameInSentence } from '@/config/branding';
import { TEXTO_PORTAL_PACIENTE } from '@/features/paciente/PacienteExperience';

import InscripcionPage from './inscripcion/page';
import HomePage from './page';

const markupHub = (): string => renderToStaticMarkup(<HomePage />);
const markupInscripcion = (): string => renderToStaticMarkup(<InscripcionPage />);

describe('Portal Central de Acceso (Página Raíz /)', () => {
  it('presenta las tres puertas de acceso sin montar sus paneles', () => {
    const html = markupHub();

    expect(html).toContain('Portal Eloisa');
    expect(html).toContain('Atención Domiciliaria');
    expect(html).toContain('/acceso');
    expect(html).toContain('Hospital');
    expect(html).toContain('/hospital');
    expect(html).toContain('Alcaldía');
    expect(html).toContain('/municipality');
    expect(html).toContain('Paciente');
    expect(html).toContain('Cuidador');
    expect(html).toContain('Visitador médico');
    expect(html).toContain('Iniciar sesión');
    expect(html).not.toContain('data-hospital-content');
    expect(html).not.toContain('data-municipality-content');
  });

  it('la tarjeta de Atencion Domiciliaria ofrece exactamente Iniciar sesion y Registrate (MP04-C1)', () => {
    const html = markupHub();

    // Destinos exactos de las dos unicas acciones.
    expect(html).toContain('href="/acceso"');
    expect(html).toContain('href="/acceso?accion=registro"');
    expect(html).toContain('>Iniciar sesión<');
    expect(html).toContain('>Regístrate<');

    // Inicio y Registro pasan por /acceso; el primero abre el selector demo
    // cuando está habilitado y el segundo abre el registro guiado.
    const enlacesAcceso = html.match(/href="\/acceso[^"]*"/gu) ?? [];
    expect(enlacesAcceso).toHaveLength(2);

    // Vocabulario retirado de esta superficie (MP04-C1).
    for (const retirado of [
      'Solicitar acceso',
      'Registro guiado',
      'registro guiado',
      'Registrarme / solicitar acceso',
      'Ver o registrar una solicitud',
      'Abrir registro guiado',
    ]) {
      expect(html).not.toContain(retirado);
    }

    // Hospital y Alcaldia conservan su unico acceso.
    expect(html).toContain('href="/hospital"');
    expect(html).toContain('href="/municipality"');
  });

  it('conserva el branding institucional y el logotipo', () => {
    const html = markupHub();

    expect(html).toContain(branding.platformDisplayName);
    expect(html).toContain('corazon-check.png');
  });
});

describe('superficie de inscripción ciudadana (TASK-002A, FR-01)', () => {
  it('abre «¿Cómo se va a registrar?» con las tres opciones aprobadas', () => {
    const html = markupInscripcion();

    expect(html).toContain('<main');
    expect(html).toContain('¿Cómo se va a registrar?');
    expect(html).toContain(
      'Elija una opción. El formulario le mostrará solo lo que usted necesita llenar.',
    );
    expect(html).toContain('Paciente');
    expect(html).toContain('Recibo o necesito atención en casa');
    expect(html).toContain('Cuidador');
    expect(html).toContain('Cuido a una o más personas');
    expect(html).toContain('Visitador médico');
    expect(html).toContain('Profesional que realiza visitas domiciliarias');
  });

  it('conserva el nombre visible y la bajada desde el branding central', () => {
    const html = markupInscripcion();

    expect(branding.platformDisplayName).toBe('Eloisa');
    expect(branding.aiDisplayName).toBe('Isa');
    expect(html).toContain('Eloisa');
    expect(html).toContain('¡Hola! Soy Isa');
  });

  it('el encabezado ya no lleva subtítulo de marca ni separador residual', () => {
    const html = markupInscripcion();

    expect(html).toContain('>Panel de inscripción</p>');
    expect(html).not.toContain('Panel de inscripción · ');
    expect(html).not.toContain('Evidencia · Local · Inteligente');
    expect(html).not.toContain('Evidencia Local Inteligente');
    expect(html.toLowerCase()).not.toContain('atención domiciliaria');
  });

  it('incorpora el logo corazón-check aprobado junto a la marca', () => {
    const html = markupInscripcion();

    expect(html).toContain('/brand/corazon-check.png');
  });

  it('la barra superior ya no muestra al personaje de la asistente (TASK-002B, FR-01)', () => {
    const html = markupInscripcion();

    expect(html).not.toContain('/eli/escucha.png');

    // El símbolo aprobado precede al nombre de la plataforma en la barra.
    const logo = html.indexOf('/brand/corazon-check.png');
    const marca = html.indexOf(branding.platformDisplayName);
    expect(logo).toBeGreaterThan(-1);
    expect(marca).toBeGreaterThan(logo);
  });

  it('no antepone ninguna pantalla del recorrido First Run 1a', () => {
    const html = markupInscripcion();

    for (const etiqueta of [
      '1a-01 Bienvenida',
      '1a-02 Rol',
      '1a-16 Inicio',
      'PASO 1 DE 12',
      'Paso a paso con',
    ]) {
      expect(html).not.toContain(etiqueta);
    }
  });

  it('no muestra ningún paso de rama antes de elegir el perfil', () => {
    const html = markupInscripcion();

    expect(html).not.toContain('Paso 1 de 5');
    expect(html).not.toContain('INSCRIPCIÓN COMO PACIENTE');
    expect(html).not.toContain('Número de documento');
  });

  it('monta la burbuja flotante de la IA, cerrada y con panel controlado', () => {
    const html = markupInscripcion();

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls=');
    expect(html).toContain('/eli/saluda2.png');
    // El panel existe siempre para que `aria-controls` apunte a un elemento real.
    expect(html).toContain('hidden=""');
  });

  it('el activador flotante restaura la expresión y el rótulo originales', () => {
    const html = markupInscripcion();

    expect(html).toContain('/eli/saluda2.png');
    expect(html).toContain(`¡Hola! Soy ${branding.aiDisplayName}`);
    expect(html).not.toContain(`¡Hola, soy ${branding.aiDisplayName}!`);
    // El encabezado del panel conserva su propia expresión.
    expect(html).toContain('/eli/guia.png');
  });

  it('no ejecuta ni referencia el runtime del prototipo', () => {
    const html = markupInscripcion().toLowerCase();

    expect(html).not.toContain('.dc.html');
    expect(html).not.toContain('support.js');
    expect(html).not.toContain('prototype-claude');
  });

  it('no declara formularios que envíen datos a un servidor', () => {
    const html = markupInscripcion().toLowerCase();

    expect(html).not.toContain('<form');
    expect(html).not.toContain('action=');
  });

  it('no muestra el aviso de demostración retirado (FR-09)', () => {
    const html = markupInscripcion();

    expect(html).not.toContain(
      'Demostración visual local: no se crean cuentas, no se envía ni se guarda información y nada se verifica.',
    );
    expect(html).not.toContain('Demostración visual local');
  });

  it('no promete funcionamiento sin conexión ni sincronización posterior (FR-09)', () => {
    const html = markupInscripcion();

    expect(html).not.toContain('Esta aplicación puede funcionar sin conexión a internet');
    expect(html).not.toContain('la información pendiente se actualizará automáticamente');
  });

  it('no muestra la etiqueta «Asistente virtual» en ninguna superficie', () => {
    expect(markupInscripcion().toLowerCase()).not.toContain('asistente virtual');
  });

  it('no renderiza ninguna cadena de marca prohibida (TASK-BRAND-01, AC-03)', () => {
    const html = markupInscripcion();

    expect(platformNameInSentence()).toBe('Eloisa');
    for (const prohibida of [
      'Elígeme',
      'ELÍGEME',
      'Elí',
      'Evidencia Local Inteligente',
      'Evidencia · Local · Inteligente',
      'MERDN',
    ]) {
      expect(html).not.toContain(prohibida);
    }
  });
});

describe('Inscripción no expone el antiguo portal demostrativo del Paciente (spec 021)', () => {
  it('la ruta inicia en la Inscripción y en ninguna otra pantalla', () => {
    const html = markupInscripcion();

    expect(html).toContain('¿Cómo se va a registrar?');
  });

  it('no monta el portal demostrativo ni sus capacidades fuera del MVP', () => {
    const html = markupInscripcion();

    for (const fuera of [
      'Mi bitácora',
      'MIS CITAS',
      'PEDIR AYUDA',
      'MI SALUD',
      'MI CUIDADOR',
      'MIS PAGOS',
      'Ver mi historia clínica',
    ]) {
      expect(html).not.toContain(fuera);
    }
  });

  it('no monta la experiencia autenticada: sin resumen, sin citas y sin visitas', () => {
    const html = markupInscripcion();

    for (const fuera of [
      TEXTO_PORTAL_PACIENTE.resumenTitulo,
      TEXTO_PORTAL_PACIENTE.citasTitulo,
      TEXTO_PORTAL_PACIENTE.visitasTitulo,
      TEXTO_PORTAL_PACIENTE.salir,
    ]) {
      expect(html).not.toContain(fuera);
    }
  });
});
