import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { validarPaso } from './inscripcionFlow';
import { PACIENTES_DEMO } from './patientDemoFixtures';
import { PasosPaciente } from './steps/PasosPaciente';

describe('Pacientes demo de inscripción', () => {
  it('expone exactamente tres perfiles ficticios con identificadores distintos', () => {
    expect(PACIENTES_DEMO).toHaveLength(3);
    expect(new Set(PACIENTES_DEMO.map((paciente) => paciente.id)).size).toBe(3);
    expect(PACIENTES_DEMO.every((paciente) => paciente.etiqueta.startsWith('Paciente demo'))).toBe(true);
  });

  it.each(PACIENTES_DEMO)('$etiqueta supera los cinco pasos sin campos requeridos vacíos', (paciente) => {
    for (const paso of [1, 2, 3, 4, 5]) {
      expect(validarPaso({ perfil: 'paciente', valores: paciente.valores }, paso)).toStrictEqual({});
    }
  });

  it('no contiene contraseñas ni datos de identidad reales', () => {
    for (const paciente of PACIENTES_DEMO) {
      expect(paciente.valores.password).toBeUndefined();
      expect(paciente.valores.correo).toContain('@example.test');
      expect(paciente.valores.apellidos).toContain('Demo');
    }
  });

  it('muestra los tres botones en Datos personales', () => {
    const html = renderToStaticMarkup(createElement(PasosPaciente, {
      paso: 1,
      valores: PACIENTES_DEMO[0]!.valores,
      errores: {},
      dispatch: () => {},
      avisoId: 'aviso-demo',
      hoy: new Date('2026-09-23T12:00:00'),
    }));

    for (const paciente of PACIENTES_DEMO) {
      expect(html).toContain(paciente.etiqueta);
    }
  });
});
