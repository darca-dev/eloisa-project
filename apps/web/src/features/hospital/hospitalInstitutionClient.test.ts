import { describe, expect, it } from 'vitest';

import * as compartido from '@/features/auth/institutionalSessionClient';

import * as fachada from './hospitalInstitutionClient';
import {
  HOSPITAL_ETIQUETA_ROL,
  HOSPITAL_MENSAJE_APERTURA,
  HOSPITAL_MENSAJE_CAMBIO,
  HOSPITAL_MENSAJE_CIERRE,
  HOSPITAL_MENSAJE_CIERRE_NO_CONFIRMADO,
  HOSPITAL_MENSAJE_CREDENCIAL,
  HOSPITAL_MENSAJE_SIN_CONFIRMAR,
  HOSPITAL_PATRON_CODIGO_IDENTIDAD,
  LONGITUD_MAXIMA_CREDENCIAL,
  RUTA_SESIONES_INSTITUCIONALES,
  RUTA_SESION_INSTITUCIONAL,
  abrirSesionInstitucional,
  cerrarSesionInstitucional,
  consultarSesionInstitucional,
  etiquetaDeRol,
  resolverCierre,
  resolverReconfirmacion,
  textoCaducidad,
  validarAcceso,
  type HospitalSesionDto,
} from './hospitalInstitutionClient';

/**
 * REGRESIÓN de la fachada de sesión INSTITUCIONAL de Hospital (spec 022,
 * «Decisión técnica cerrada: reutilización del cliente institucional»).
 *
 * El cliente se movió a `@/features/auth/institutionalSessionClient` y este
 * archivo dejó de implementarlo. Lo que estas pruebas demuestran es lo único
 * que importa para Hospital: que la extracción es un cambio de UBICACIÓN y no
 * de comportamiento.
 *
 * La fachada no traduce NADA —a diferencia de la de sesión humana, que renombra
 * un desenlace—: aquí la única operación es de NOMBRE de identificador, así que
 * cada símbolo puede compararse por IDENTIDAD DE REFERENCIA con el del módulo
 * compartido. Eso es más fuerte que reproducir el comportamiento: si algún día
 * volviera a implementarse aquí una copia, estas comparaciones caen antes de
 * que ninguna prueba de comportamiento llegue a ejecutarse.
 *
 * Las pruebas de COMPORTAMIENTO —ruta, método, credencial implícita, no-caché,
 * cada código de estado, cancelación, validación local, uniformidad de los
 * mensajes y la regla del cierre confirmado— viven ahora donde vive el código
 * que vigilan: `apps/web/src/features/auth/institutionalSessionClient.test.ts`.
 * Reproducirlas sobre una reexportación sería probar dos veces lo mismo.
 *
 * Todos los valores son FICTICIOS.
 */

/* ========================================================================== */
/* Superficie: ningún componente de Hospital cambia una importación            */
/* ========================================================================== */

describe('compatibilidad de la fachada institucional de Hospital', () => {
  it('conserva EXACTAMENTE la superficie de valores que Hospital importa', () => {
    /*
     * Igualdad de conjunto, no inclusión. Falla en los dos sentidos: si
     * desaparece un nombre que algún componente de Hospital importa, y si la
     * fachada estrena superficie nueva por su cuenta —que sería empezar a
     * decidir aquí en vez de reexportar—.
     *
     * Los tipos no aparecen: se borran al compilar. Su compatibilidad la
     * comprueba el typecheck, y más abajo se ancla con un valor tipado.
     */
    expect(Object.keys(fachada).sort()).toStrictEqual([
      'HOSPITAL_ETIQUETA_ROL',
      'HOSPITAL_MENSAJE_APERTURA',
      'HOSPITAL_MENSAJE_CAMBIO',
      'HOSPITAL_MENSAJE_CIERRE',
      'HOSPITAL_MENSAJE_CIERRE_NO_CONFIRMADO',
      'HOSPITAL_MENSAJE_CREDENCIAL',
      'HOSPITAL_MENSAJE_SIN_CONFIRMAR',
      'HOSPITAL_PATRON_CODIGO_IDENTIDAD',
      'LONGITUD_MAXIMA_CREDENCIAL',
      'RUTA_SESIONES_INSTITUCIONALES',
      'RUTA_SESION_INSTITUCIONAL',
      'abrirSesionInstitucional',
      'cerrarSesionInstitucional',
      'consultarSesionInstitucional',
      'etiquetaDeRol',
      'resolverCierre',
      'resolverReconfirmacion',
      'textoCaducidad',
      'validarAcceso',
    ]);
  });

  it('las TRES operaciones de red son las MISMAS del módulo compartido', () => {
    /*
     * Identidad de referencia: no hay copia, hay reexportación. Es la prueba
     * exacta de que no existe una segunda implementación del transporte.
     */
    expect(consultarSesionInstitucional).toBe(compartido.consultarSesionInstitucional);
    expect(abrirSesionInstitucional).toBe(compartido.abrirSesionInstitucional);
    expect(cerrarSesionInstitucional).toBe(compartido.cerrarSesionInstitucional);
  });

  it('las funciones puras son las MISMAS: presentación, validación y cierre', () => {
    expect(etiquetaDeRol).toBe(compartido.etiquetaDeRol);
    expect(textoCaducidad).toBe(compartido.textoCaducidad);
    expect(validarAcceso).toBe(compartido.validarAcceso);
    expect(resolverCierre).toBe(compartido.resolverCierre);
    expect(resolverReconfirmacion).toBe(compartido.resolverReconfirmacion);
  });

  it('las rutas y los límites del contrato conservan su valor previo', () => {
    expect(RUTA_SESION_INSTITUCIONAL).toBe('/api/v1/institutional/sessions/current');
    expect(RUTA_SESIONES_INSTITUCIONALES).toBe('/api/v1/institutional/sessions');
    expect(LONGITUD_MAXIMA_CREDENCIAL).toBe(512);

    expect(RUTA_SESION_INSTITUCIONAL).toBe(compartido.RUTA_SESION_INSTITUCIONAL);
    expect(RUTA_SESIONES_INSTITUCIONALES).toBe(compartido.RUTA_SESIONES_INSTITUCIONALES);
    expect(LONGITUD_MAXIMA_CREDENCIAL).toBe(compartido.LONGITUD_MAXIMA_CREDENCIAL);
  });

  it('los identificadores con prefijo `HOSPITAL_` apuntan al valor compartido', () => {
    /*
     * La única operación de la fachada. Se comprueba una por una, por
     * identidad, para que renombrar mal cualquiera de ellas falle aquí y no en
     * una pantalla.
     */
    expect(HOSPITAL_ETIQUETA_ROL).toBe(compartido.ETIQUETA_ROL_INSTITUCIONAL);
    expect(HOSPITAL_MENSAJE_APERTURA).toBe(compartido.MENSAJE_APERTURA);
    expect(HOSPITAL_MENSAJE_CREDENCIAL).toBe(compartido.MENSAJE_CREDENCIAL);
    expect(HOSPITAL_MENSAJE_SIN_CONFIRMAR).toBe(compartido.MENSAJE_SIN_CONFIRMAR);
    expect(HOSPITAL_MENSAJE_CAMBIO).toBe(compartido.MENSAJE_CAMBIO);
    expect(HOSPITAL_MENSAJE_CIERRE).toBe(compartido.MENSAJE_CIERRE);
    expect(HOSPITAL_MENSAJE_CIERRE_NO_CONFIRMADO).toBe(
      compartido.MENSAJE_CIERRE_NO_CONFIRMADO,
    );
    expect(HOSPITAL_PATRON_CODIGO_IDENTIDAD).toBe(compartido.PATRON_CODIGO_IDENTIDAD);
  });

  it('el tipo del contexto sigue admitiendo el cuerpo que Hospital ya recibía', () => {
    /*
     * Ancla de TIPO: `HospitalSesionDto` es el alias del tipo compartido. Si el
     * alias desapareciera o cambiara de forma, esto no compilaría, y
     * `HospitalShell`, `HospitalTopbar` y las utilidades de prueba lo importan.
     */
    const sesion: HospitalSesionDto = {
      role: 'HOSPITAL_PATIENT_VIEWER',
      expiresAt: '2026-08-22T20:00:00.000Z',
      institution: { name: 'Institución ficticia de pruebas' },
      actorDisplay: 'Acceso institucional',
    };

    expect(sesion.role).toBe('HOSPITAL_PATIENT_VIEWER');
    expect(etiquetaDeRol(sesion.role)).toBe('Consulta de pacientes');
  });
});

/* ========================================================================== */
/* Alcance: los cuatro roles siguen siendo disjuntos y Hospital no gana ninguno */
/* ========================================================================== */

describe('alcance de la fachada institucional', () => {
  it('rotula los cuatro roles institucionales sin concederlos', () => {
    /*
     * `MUNICIPAL_VIEWER` ya estaba rotulado aquí antes de la extracción: la
     * fachada no lo estrena. Rotular un rol NO lo concede —la autorización vive
     * en el guard de cada superficie, en el servidor— y compartir el cliente
     * con Alcaldía no cambia eso.
     */
    expect(HOSPITAL_ETIQUETA_ROL).toStrictEqual({
      HOSPITAL_ACCESS_REVIEWER: 'Revisión de solicitudes de acceso',
      HOSPITAL_PATIENT_VIEWER: 'Consulta de pacientes',
      HOSPITAL_SCHEDULER: 'Agenda hospitalaria',
      MUNICIPAL_VIEWER: 'Consulta municipal agregada',
    });
  });

  it('ninguna etiqueta ni mensaje nombra interioridades del sistema', () => {
    const textos = [
      ...Object.values(HOSPITAL_ETIQUETA_ROL),
      ...Object.values(HOSPITAL_MENSAJE_APERTURA),
      ...Object.values(HOSPITAL_MENSAJE_CREDENCIAL),
      HOSPITAL_MENSAJE_SIN_CONFIRMAR,
      HOSPITAL_MENSAJE_CAMBIO,
      HOSPITAL_MENSAJE_CIERRE,
      HOSPITAL_MENSAJE_CIERRE_NO_CONFIRMADO,
    ];

    for (const texto of textos) {
      expect(texto.length).toBeGreaterThan(0);
      expect(/tenant|token|cookie|SQL|null|undefined/iu.test(texto)).toBe(false);
    }
  });

  it('la decisión del cierre sigue exigiendo confirmación del servidor', () => {
    expect(resolverCierre('error', 'cerrar').retirarSesion).toBe(false);
    expect(resolverCierre('ok', 'cerrar').retirarSesion).toBe(true);
    expect(resolverReconfirmacion('ok', 'cerrar').retirarSesion).toBe(false);
    expect(resolverReconfirmacion('sin-sesion', 'cerrar').retirarSesion).toBe(true);
  });
});
