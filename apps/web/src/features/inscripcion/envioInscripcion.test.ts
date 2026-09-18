import { describe, expect, it } from 'vitest';

import {
  ESTADO_INICIAL,
  PACIENTE_VACIO,
  TOTAL_PASOS,
  inscripcionReducer,
} from './inscripcionFlow';
import type { DatosPaciente, InscripcionAction, InscripcionState } from './inscripcionFlow';

/**
 * Estado del envío de la rama Paciente (TASK-MVP-CORE-01 §8, §12).
 *
 * Comprueba en el reductor las garantías que la interfaz debe cumplir: no
 * declarar la inscripción terminada antes del `201`, impedir el doble envío y
 * permitir un reintento seguro tras un fallo.
 */

const PACIENTE_COMPLETO: DatosPaciente = {
  ...PACIENTE_VACIO,
  documento: '99990001',
  nombres: 'Ana María',
  apellidos: 'Ejemplo Ficticio',
  fechaNacimiento: '1958-04-12',
  edad: 68,
  telefono: '311 220 3355',
  telefonoAlterno: '604 444 5566',
  correo: '',
  mayor60: true,
  ubicacion: { departamento: '05', municipio: '05001', corregimiento: 'San Cristóbal' },
  zona: 'URBAN',
  barrio: 'La Esperanza',
  direccion: 'Cra 45 # 32-16',
  indicaciones: 'Casa azul detrás de la iglesia.',
  diagnosticos: ['Ninguna'],
  contactoNombre: 'Carlos Rodríguez',
  contactoParentesco: 'Hijo',
  contactoTelefono: '311 220 3355',
  vecinoNombre: 'Marta Vecina',
  vecinoTelefono: '311 111 2222',
  vecinoDireccion: 'Casa de al lado',
  autorizaVecino: true,
  autorizaDatos: true,
};

function reducir(
  acciones: readonly InscripcionAction[],
  inicial: InscripcionState = ESTADO_INICIAL,
): InscripcionState {
  return acciones.reduce(inscripcionReducer, inicial);
}

/** Estado en el último paso de la rama Paciente, con todo diligenciado. */
function enConfirmacion(): InscripcionState {
  return reducir([
    { type: 'elegirPerfil', perfil: 'paciente' },
    { type: 'actualizarPaciente', patch: PACIENTE_COMPLETO },
    { type: 'irAPaso', paso: TOTAL_PASOS },
  ]);
}

describe('envío de la rama Paciente', () => {
  it('parte de un estado de envío inactivo', () => {
    expect(ESTADO_INICIAL.envio).toStrictEqual({
      estado: 'inactivo',
      mensaje: null,
      nonce: 0,
    });
  });

  it('confirmar el último paso pasa a «enviando» y no termina la inscripción', () => {
    const state = inscripcionReducer(enConfirmacion(), { type: 'siguiente' });

    expect(state.envio.estado).toBe('enviando');
    expect(state.terminada).toBe(false);
    expect(state.paso).toBe(TOTAL_PASOS);
  });

  it('no envía mientras falte la autorización de datos', () => {
    const sinAutorizacion = reducir([
      { type: 'elegirPerfil', perfil: 'paciente' },
      {
        type: 'actualizarPaciente',
        patch: { ...PACIENTE_COMPLETO, autorizaDatos: false },
      },
      { type: 'irAPaso', paso: TOTAL_PASOS },
      { type: 'siguiente' },
    ]);

    expect(sinAutorizacion.envio.estado).toBe('inactivo');
    expect(sinAutorizacion.errores['autorizaDatos']).toBeDefined();
    expect(sinAutorizacion.terminada).toBe(false);
  });

  it('ignora un segundo intento mientras el envío está en curso', () => {
    const enviando = inscripcionReducer(enConfirmacion(), { type: 'siguiente' });
    const otraVez = inscripcionReducer(enviando, { type: 'siguiente' });

    expect(otraVez).toBe(enviando);
  });

  it('solo llega al cierre tras la confirmación del servidor', () => {
    const enviando = inscripcionReducer(enConfirmacion(), { type: 'siguiente' });
    const terminada = inscripcionReducer(enviando, { type: 'envioExitoso' });

    expect(terminada.terminada).toBe(true);
    expect(terminada.envio.estado).toBe('inactivo');
    expect(terminada.envio.mensaje).toBeNull();
  });

  it('un fallo deja un mensaje recuperable y no termina la inscripción', () => {
    const enviando = inscripcionReducer(enConfirmacion(), { type: 'siguiente' });
    const fallido = inscripcionReducer(enviando, {
      type: 'envioFallido',
      mensaje: 'No fue posible conectar con el servicio.',
    });

    expect(fallido.envio.estado).toBe('error');
    expect(fallido.envio.mensaje).toBe('No fue posible conectar con el servicio.');
    expect(fallido.envio.nonce).toBe(enviando.envio.nonce + 1);
    expect(fallido.terminada).toBe(false);
    expect(fallido.paso).toBe(TOTAL_PASOS);
  });

  it('un conflicto de documento se comunica sin terminar la inscripción', () => {
    const enviando = inscripcionReducer(enConfirmacion(), { type: 'siguiente' });
    const conflicto = inscripcionReducer(enviando, {
      type: 'envioConflicto',
      mensaje: 'Ese documento ya está inscrito.',
    });

    expect(conflicto.envio.estado).toBe('conflicto');
    expect(conflicto.envio.mensaje).toBe('Ese documento ya está inscrito.');
    expect(conflicto.terminada).toBe(false);
  });

  it('cada fallo repite el anuncio mediante un nuevo nonce', () => {
    const primero = inscripcionReducer(
      inscripcionReducer(enConfirmacion(), { type: 'siguiente' }),
      { type: 'envioFallido', mensaje: 'Error' },
    );
    const segundo = inscripcionReducer(
      inscripcionReducer(primero, { type: 'siguiente' }),
      { type: 'envioFallido', mensaje: 'Error' },
    );

    expect(segundo.envio.nonce).toBe(primero.envio.nonce + 1);
  });

  it('permite reintentar después de un fallo', () => {
    const fallido = inscripcionReducer(
      inscripcionReducer(enConfirmacion(), { type: 'siguiente' }),
      { type: 'envioFallido', mensaje: 'Error' },
    );
    const reintento = inscripcionReducer(fallido, { type: 'siguiente' });

    expect(reintento.envio.estado).toBe('enviando');
  });

  it('corregir un dato limpia el mensaje del intento anterior', () => {
    const conflicto = inscripcionReducer(
      inscripcionReducer(enConfirmacion(), { type: 'siguiente' }),
      { type: 'envioConflicto', mensaje: 'Ese documento ya está inscrito.' },
    );
    const corregido = inscripcionReducer(conflicto, {
      type: 'actualizarPaciente',
      patch: { documento: '99990002' },
    });

    expect(corregido.envio.estado).toBe('inactivo');
    expect(corregido.envio.mensaje).toBeNull();
  });

  it('reiniciar la inscripción descarta el estado de envío', () => {
    const conflicto = inscripcionReducer(
      inscripcionReducer(enConfirmacion(), { type: 'siguiente' }),
      { type: 'envioConflicto', mensaje: 'Ese documento ya está inscrito.' },
    );

    expect(inscripcionReducer(conflicto, { type: 'reiniciar' })).toStrictEqual(
      ESTADO_INICIAL,
    );
  });

  it('las ramas fuera de alcance conservan su cierre local inmediato', () => {
    for (const perfil of ['cuidador', 'visitador'] as const) {
      const state = reducir([
        { type: 'elegirPerfil', perfil },
        { type: 'irAPaso', paso: TOTAL_PASOS },
        perfil === 'cuidador'
          ? { type: 'actualizarCuidador', patch: { autorizaDatos: true } }
          : { type: 'actualizarVisitador', patch: { autorizaDatos: true } },
        { type: 'siguiente' },
      ]);

      expect(state.terminada).toBe(true);
      expect(state.envio.estado).toBe('inactivo');
    }
  });
});
