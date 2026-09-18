import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DEPARTAMENTOS } from '@/data/divipola';

import { InscripcionExperience } from './InscripcionExperience';
import {
  DIAGNOSTICO_NINGUNA,
  DIAGNOSTICO_OTROS,
  ESTADO_INICIAL,
  TITULOS_PASO,
  TOTAL_PASOS,
  inscripcionReducer,
} from './inscripcionFlow';
import type { InscripcionAction, InscripcionState, PerfilId } from './inscripcionFlow';

const HOY = new Date('2026-08-19T00:00:00');

function estado(
  perfil: PerfilId,
  paso: number,
  extra: readonly InscripcionAction[] = [],
): InscripcionState {
  const base = [
    { type: 'elegirPerfil', perfil } as InscripcionAction,
    ...extra,
    { type: 'irAPaso', paso } as InscripcionAction,
  ];
  return base.reduce(inscripcionReducer, ESTADO_INICIAL);
}

function render(state: InscripcionState): string {
  return renderToStaticMarkup(
    <InscripcionExperience onEntrarComoPaciente={() => {}} hoy={HOY} estadoInicial={state} />,
  );
}

/** Títulos exclusivos de la bitácora completa, que no pertenece a la inscripción. */
const TITULOS_BITACORA = [
  'Signos vitales',
  'Comida y líquidos',
  'Higiene y cuidado',
  '¿Ocurrió algo importante?',
  'Paso 1 de 8',
];

describe('el rol no se vuelve a preguntar (FR-02)', () => {
  it('ninguna pantalla de rama repite la pregunta de perfil', () => {
    for (const perfil of ['paciente', 'cuidador', 'visitador'] as const) {
      for (let paso = 1; paso <= TOTAL_PASOS; paso += 1) {
        const html = render(estado(perfil, paso));
        expect(html).not.toContain('¿Cómo se va a registrar?');
        expect(html).not.toContain('Recibo o necesito atención en casa');
        expect(html).not.toContain('Profesional que realiza visitas domiciliarias');
      }
    }
  });

  it('cada rama muestra su etiqueta y su progreso «Paso X de 5»', () => {
    const etiquetas = {
      paciente: 'INSCRIPCIÓN COMO PACIENTE',
      cuidador: 'INSCRIPCIÓN COMO CUIDADOR',
      visitador: 'INSCRIPCIÓN COMO VISITADOR MÉDICO',
    } as const;

    for (const perfil of ['paciente', 'cuidador', 'visitador'] as const) {
      for (let paso = 1; paso <= TOTAL_PASOS; paso += 1) {
        const html = render(estado(perfil, paso));
        expect(html).toContain(etiquetas[perfil]);
        expect(html).toContain(`Paso ${paso} de ${TOTAL_PASOS}`);
        expect(html).toContain(TITULOS_PASO[perfil][paso - 1] as string);
      }
    }
  });

  it('el carril de pasos ofrece exactamente cinco destinos por rama', () => {
    for (const perfil of ['paciente', 'cuidador', 'visitador'] as const) {
      const html = render(estado(perfil, 1));
      const titulos = TITULOS_PASO[perfil];
      titulos.forEach((titulo, indice) => {
        expect(html).toContain(`${indice + 1}. ${titulo}`);
      });
      expect(html).not.toContain('6.');
    }
  });
});

describe('rama Paciente', () => {
  it('reúne clasificación y diagnósticos en el paso 2, sin crear un sexto paso', () => {
    const html = render(estado('paciente', 2));

    expect(html).toContain('Persona mayor de 60 años');
    expect(html).toContain('Persona con discapacidad');
    expect(html).toContain('Persona que requiere cuidados en casa');
    expect(html).toContain('Puede marcar una, dos o las tres. No son excluyentes.');
    expect(html).toContain('C · DIAGNÓSTICOS');
    expect(html).toContain(DIAGNOSTICO_OTROS);
    expect(html).toContain(DIAGNOSTICO_NINGUNA);
    expect(html).toContain('Hipertensión');
    expect(TITULOS_PASO.paciente).toHaveLength(TOTAL_PASOS);
  });

  it('muestra el campo de «Otros» solo cuando la opción está marcada', () => {
    const sinOtros = render(estado('paciente', 2));
    expect(sinOtros).not.toContain('Otro diagnóstico 1');
    expect(sinOtros).not.toContain('Añadir otro diagnóstico');

    const conOtros = render(
      estado('paciente', 2, [{ type: 'alternarDiagnostico', valor: DIAGNOSTICO_OTROS }]),
    );
    expect(conOtros).toContain('Otro diagnóstico 1');
    expect(conOtros).toContain('Añadir otro diagnóstico');
  });

  it('permite ver las tres clasificaciones marcadas a la vez', () => {
    const html = render(
      estado('paciente', 2, [
        { type: 'alternarClasificacion', clave: 'mayor60' },
        { type: 'alternarClasificacion', clave: 'discapacidad' },
        { type: 'alternarClasificacion', clave: 'requiereCuidadoCasa' },
      ]),
    );

    const marcados = html.match(/type="checkbox"[^>]*checked=""/gu) ?? [];
    expect(marcados.length).toBeGreaterThanOrEqual(3);
    // Los paneles dependientes de discapacidad y cuidado en casa aparecen juntos.
    expect(html).toContain('Tipo de discapacidad');
    expect(html).toContain('Tipo de apoyo que necesita');
  });

  it('no interpone la bitácora completa en ningún paso de la inscripción', () => {
    for (let paso = 1; paso <= TOTAL_PASOS; paso += 1) {
      const html = render(estado('paciente', paso));
      for (const titulo of TITULOS_BITACORA) {
        expect(html).not.toContain(titulo);
      }
    }
  });

  it('el paso 5 revisa y conduce al final demostrativo, no a la bitácora', () => {
    const html = render(estado('paciente', 5));

    expect(html).toContain('REVISE SU INFORMACIÓN');
    expect(html).toContain('Terminar mi inscripción');
    expect(html).not.toContain('Empezar la bitácora de hoy');
  });
});

describe('rama Cuidador', () => {
  it('recorre sus cinco pasos sin pantallas exclusivas del paciente', () => {
    for (let paso = 1; paso <= TOTAL_PASOS; paso += 1) {
      const html = render(estado('cuidador', paso));
      expect(html).not.toContain('C · DIAGNÓSTICOS');
      expect(html).not.toContain('Persona mayor de 60 años');
      expect(html).not.toContain('MIS CITAS');
      for (const titulo of TITULOS_BITACORA) {
        expect(html).not.toContain(titulo);
      }
    }
  });

  it('cierra con su propia acción final', () => {
    const html = render(estado('cuidador', 5));
    expect(html).toContain('Terminar la inscripción como cuidador');
  });
});

describe('rama Visitador médico', () => {
  it('recorre sus cinco pasos sin pantallas de las otras ramas', () => {
    for (let paso = 1; paso <= TOTAL_PASOS; paso += 1) {
      const html = render(estado('visitador', paso));
      expect(html).not.toContain('C · DIAGNÓSTICOS');
      expect(html).not.toContain('Persona con discapacidad');
      expect(html).not.toContain('D · PACIENTE AL QUE CUIDA');
    }
  });

  it('anuncia la verificación pendiente y cierra con su acción final', () => {
    expect(render(estado('visitador', 1))).toContain('Este registro requiere verificación.');
    expect(render(estado('visitador', 5))).toContain('Solicitar registro como visitador');
  });
});

describe('final demostrativo', () => {
  function terminada(perfil: PerfilId): InscripcionState {
    const enPaso5 = estado(perfil, 5);
    return { ...enPaso5, terminada: true };
  }

  it('la rama Paciente ofrece entrar al Inicio del Paciente sin exigir bitácora', () => {
    const html = render(terminada('paciente'));

    expect(html).toContain('Inscripción completada');
    expect(html).toContain('Inicio del Paciente');
    expect(html).not.toContain('Paso 1 de 8');
  });

  it('la rama Cuidador cierra en local y no vincula pacientes', () => {
    const html = render(terminada('cuidador'));

    expect(html).toContain('No se vinculó ningún paciente.');
    expect(html).not.toContain('Inicio del Paciente');
  });

  it('la rama Visitador queda pendiente de verificación', () => {
    const html = render(terminada('visitador'));

    expect(html).toContain('Registro recibido');
    expect(html).toContain('Pendiente de verificación');
  });

  it('los cierres sin persistencia siguen declarando que nada se guardó', () => {
    // Cuidador y Visitador continúan fuera del alcance de CORE-01: su cierre es
    // local y debe seguir diciéndolo con claridad.
    for (const perfil of ['cuidador', 'visitador'] as const) {
      const html = render(terminada(perfil));
      expect(html).toContain('no se creó ninguna cuenta');
      expect(html).toContain('no se guardó ni se envió información');
    }
  });

  it('el cierre del Paciente declara el registro real sin prometer más de lo que hay', () => {
    const html = render(terminada('paciente'));

    expect(html).toContain('quedó registrada en la institución');
    // No se afirma cuenta permanente ni verificación de identidad.
    expect(html).toContain('No se creó una contraseña ni una cuenta permanente');
    expect(html).toContain('no verifica su identidad ante ninguna autoridad');
  });
});

describe('ubicación territorial DIVIPOLA en las tres ramas (FR-04A)', () => {
  const PASOS_CON_UBICACION = {
    paciente: 3,
    cuidador: 1,
    visitador: 4,
  } as const;

  it('cada grupo usa Departamento, Municipio y Nombre del corregimiento, en ese orden', () => {
    for (const [perfil, paso] of Object.entries(PASOS_CON_UBICACION)) {
      const html = render(estado(perfil as PerfilId, paso));

      const departamento = html.indexOf('Departamento');
      const municipio = html.indexOf('Municipio');
      const corregimiento = html.indexOf('Nombre del corregimiento');

      expect(departamento).toBeGreaterThan(-1);
      expect(municipio).toBeGreaterThan(departamento);
      expect(corregimiento).toBeGreaterThan(municipio);
    }
  });

  it('ofrece los 33 departamentos oficiales y deja Municipio deshabilitado', () => {
    const html = render(estado('paciente', 3));

    for (const departamento of DEPARTAMENTOS) {
      expect(html).toContain(`value="${departamento.codigo}"`);
      expect(html).toContain(departamento.nombre);
    }
    expect(html).toContain('Elija primero el departamento');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Se activa cuando elija un departamento.');
  });

  it('al elegir departamento solo aparecen sus municipios', () => {
    const html = render(
      estado('paciente', 3, [
        { type: 'elegirDepartamento', grupo: 'principal', codigo: '25' },
      ]),
    );

    expect(html).toContain('SOACHA');
    expect(html).toContain('value="25754"');
    expect(html).not.toContain('value="05001"');
    expect(html).not.toContain('MEDELLÍN');
    expect(html).not.toContain('Elija primero el departamento');
  });

  it('no escribe listas territoriales propias del prototipo', () => {
    const html = render(estado('paciente', 3));

    expect(html).not.toContain('Cundinamarca');
    expect(html).not.toContain('Valle del Cauca');
  });
});

describe('obligatoriedad visible (FR-04)', () => {
  it('los pasos con campos explican la marca de obligatorio', () => {
    const html = render(estado('paciente', 1));

    expect(html).toContain('Los campos marcados con asterisco son obligatorios.');
    expect(html).toContain('(campo obligatorio)');
    expect(html).toContain('aria-required="true"');
  });

  it('el Paciente ya no marca ningún dato como opcional', () => {
    for (let paso = 1; paso <= TOTAL_PASOS; paso += 1) {
      expect(render(estado('paciente', paso))).not.toContain('· opcional');
    }
  });
});

describe('expresiones y tono de la IA en la inscripción (FR-08)', () => {
  it('usa expresiones distintas en el activador, el panel y el cierre', () => {
    const html = render(estado('paciente', 1));

    // La barra superior ya no muestra al personaje (TASK-002B, FR-01).
    expect(html).not.toContain('/eli/escucha.png');
    expect(html).toContain('/eli/saluda2.png');
    expect(html).toContain('/eli/guia.png');
    expect(html).not.toContain('/eli/pregunta.png');
  });

  it('el cierre usa la expresión de agradecimiento', () => {
    const enPaso5 = estado('paciente', 5);
    const html = render({ ...enPaso5, terminada: true });

    expect(html).toContain('/eli/agradece.png');
    expect(html).toContain('/eli/saluda2.png');
  });

  it('habla de tú y nunca se presenta como «Asistente virtual»', () => {
    for (const perfil of ['paciente', 'cuidador', 'visitador'] as const) {
      const html = render(estado(perfil, 1));
      expect(html.toLowerCase()).not.toContain('asistente virtual');
      expect(html).toContain('No soy médica, pero puedo ayudarte');
    }
  });
});

describe('demostración honesta y ausencia de red (FR-09)', () => {
  it('no muestra el aviso retirado ni la promesa offline futura', () => {
    for (const perfil of ['paciente', 'cuidador', 'visitador'] as const) {
      for (let paso = 1; paso <= TOTAL_PASOS; paso += 1) {
        const html = render(estado(perfil, paso));
        expect(html).not.toContain('Demostración visual local');
        expect(html).not.toContain('puede funcionar sin conexión a internet');
        expect(html).not.toContain('se actualizará automáticamente');
      }
    }
  });

  it('no declara formularios, envíos ni almacenamiento del navegador', () => {
    const html = render(estado('paciente', 3)).toLowerCase();

    expect(html).not.toContain('<form');
    expect(html).not.toContain('action=');
    expect(html).not.toContain('localstorage');
    expect(html).not.toContain('sessionstorage');
    expect(html).not.toContain('fetch(');
  });

  it('marca como inertes los controles demostrativos del diseño', () => {
    const html = render(estado('paciente', 3));

    expect(html).toContain('Usar mi ubicación');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('inscripcion-aviso-demostracion');
  });
});
