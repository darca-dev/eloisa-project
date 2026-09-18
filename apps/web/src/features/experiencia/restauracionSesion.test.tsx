import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  buildPatientEnrollmentRequest,
  fetchCurrentPatient,
  submitPatientEnrollment,
} from '@/features/inscripcion/patientEnrollmentClient';
import type { PatientSummary } from '@/features/inscripcion/patientEnrollmentClient';
import { PACIENTE_VACIO } from '@/features/inscripcion/inscripcionFlow';
import type { DatosPaciente } from '@/features/inscripcion/inscripcionFlow';

import { TEXTO_PORTAL_PACIENTE } from '@/features/paciente/PacienteExperience';

import { ExperienciaMerdn } from './ExperienciaMerdn';

/**
 * Restauración del paciente tras recargar el navegador
 * (corrección final de CORE-01, bloqueante 3).
 *
 * Recorre la cadena completa: inscripción correcta → cookie de sesión emitida
 * por el backend → nueva inicialización equivalente a un refresh →
 * `GET /api/v1/patients/me` → paciente restaurado en pantalla.
 *
 * La restauración depende EXCLUSIVAMENTE del backend y de la cookie `HttpOnly`.
 * Estas pruebas comprueban además que no se lee ni se escribe `localStorage`,
 * `sessionStorage` ni la URL.
 *
 * Todos los datos son ficticios.
 */

const PACIENTE_FORMULARIO: DatosPaciente = {
  ...PACIENTE_VACIO,
  tipoDocumento: 'Cédula de ciudadanía',
  documento: '99990123',
  nombres: 'Ana María',
  apellidos: 'Ejemplo Ficticio',
  fechaNacimiento: '1958-04-12',
  edad: 68,
  sexo: 'Femenino',
  telefono: '311 220 3355',
  telefonoAlterno: '604 444 5566',
  ubicacion: { departamento: '05', municipio: '05001', corregimiento: 'San Cristóbal' },
  zona: 'URBAN',
  barrio: 'La Esperanza',
  direccion: 'Cra 45 # 32-16',
  indicaciones: 'Casa azul detrás de la iglesia.',
  eps: 'Nueva EPS',
  autorizaDatos: true,
};

const PACIENTE_API: PatientSummary = {
  status: 'ACTIVE',
  enrolledAt: '2026-08-22T10:15:00.000Z',
  givenNames: 'Ana María',
  familyNames: 'Ejemplo Ficticio',
  age: 68,
  populations: [{ populationType: 'OLDER_ADULT_60_PLUS', source: 'DERIVED_BIRTH_DATE' }],
  territory: {
    departmentCode: '05',
    departmentName: 'ANTIOQUIA',
    municipalityCode: '05001',
    municipalityName: 'MEDELLÍN',
    localityName: null,
    localityPendingNormalization: true,
    areaType: 'URBAN',
  },
  epsCode: 'NUEVA_EPS',
  epsName: 'Nueva EPS',
};

const COOKIE = 'merdn_enrollment_session=token-ficticio-de-prueba';

/**
 * Navegador simulado: guarda la cookie que emite el backend y la reenvía en las
 * peticiones siguientes, exactamente como haría `credentials: 'include'`.
 *
 * El código de la aplicación NO puede leer esta cookie, igual que no puede leer
 * una cookie `HttpOnly` real.
 */
function navegadorFicticio(): {
  readonly fetch: typeof fetch;
  readonly peticiones: { url: string; cookieEnviada: string | undefined }[];
} {
  let cookieAlmacenada: string | undefined;
  const peticiones: { url: string; cookieEnviada: string | undefined }[] = [];

  const impl = async (url: string, init?: RequestInit): Promise<Response> => {
    const enviaCredenciales = init?.credentials === 'include';
    const cookieEnviada = enviaCredenciales ? cookieAlmacenada : undefined;
    peticiones.push({ url, cookieEnviada });

    if (url.endsWith('/api/v1/patients/enrollments')) {
      // El backend emite la sesión; el navegador la retiene.
      cookieAlmacenada = COOKIE;
      return new Response(JSON.stringify(PACIENTE_API), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.endsWith('/api/v1/patients/me')) {
      if (cookieEnviada === undefined) {
        return new Response(JSON.stringify({ code: 'ENROLLMENT_SESSION_REQUIRED' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(PACIENTE_API), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('no encontrado', { status: 404 });
  };

  return { fetch: impl as unknown as typeof fetch, peticiones };
}

describe('restauración del paciente tras recargar', () => {
  it('la inscripción emite sesión y una carga posterior recupera el paciente', async () => {
    const navegador = navegadorFicticio();

    // 1. Inscripción correcta.
    const alta = await submitPatientEnrollment(
      buildPatientEnrollmentRequest(PACIENTE_FORMULARIO),
      navegador.fetch,
    );
    expect(alta.kind).toBe('created');

    // 2. Recarga: una inicialización nueva pregunta al backend por la sesión.
    const restaurado = await fetchCurrentPatient(navegador.fetch);

    expect(restaurado).not.toBeNull();
    expect(restaurado?.givenNames).toBe('Ana María');
    expect(restaurado?.familyNames).toBe('Ejemplo Ficticio');

    // La segunda petición fue a /me y viajó con la cookie emitida por el backend.
    const peticionMe = navegador.peticiones.find((peticion) =>
      peticion.url.endsWith('/api/v1/patients/me'),
    );
    expect(peticionMe?.cookieEnviada).toBe(COOKIE);
  });

  it('sin la cookie de sesión no se restaura ningún paciente', async () => {
    // Navegador nuevo: no hay inscripción previa y por tanto no hay cookie.
    const navegador = navegadorFicticio();

    expect(await fetchCurrentPatient(navegador.fetch)).toBeNull();
  });

  it('la primera pantalla es la Inscripción y no consulta almacenamiento local', () => {
    const html = renderToStaticMarkup(
      <ExperienciaMerdn recuperarPaciente={async () => null} />,
    );

    expect(html).toContain('¿Cómo se va a registrar?');
    expect(html).not.toContain('localStorage');
    expect(html).not.toContain('sessionStorage');
  });

  /*
   * Render posterior al refresh, una vez `GET /me` respondió.
   *
   * DECISIÓN DE PRODUCTO CERRADA (spec 021 §17.C-1). La cookie de inscripción
   * sirve ÚNICAMENTE para confirmar y completar la inscripción: no es sesión
   * permanente del portal, no abre la experiencia autenticada de Paciente y no
   * concede acceso a ninguna cita ni visita. Por eso la fase a la que puede
   * llegar por sí sola es la CONFIRMACIÓN, y el portal exige además sesión
   * humana OIDC con contexto `PATIENT`.
   */
  const trasRecarga = (): string =>
    renderToStaticMarkup(
      <ExperienciaMerdn
        recuperarPaciente={async () => PACIENTE_API}
        comprobarSesionHumana={async () => 'sin-sesion'}
        urlLogin="https://api.ejemplo.test/api/v1/human-auth/login?returnTo=/"
        faseInicial="inscripcion-completada"
      />,
    );

  it('con inscripción vigente la carga confirma «Inscripción completada»', () => {
    const html = trasRecarga();

    expect(html).toContain('Inscripción completada');
    expect(html).not.toContain('¿Cómo se va a registrar?');
  });

  it('ofrece una entrada SEPARADA «Ingresar como Paciente» hacia el acceso OIDC', () => {
    const html = trasRecarga();

    expect(html).toContain('Ingresar como Paciente');
    expect(html).toContain(
      'href="https://api.ejemplo.test/api/v1/human-auth/login?returnTo=/"',
    );
  });

  it('sin sesión humana no hay resumen, ni citas, ni visitas, ni portal demostrativo', () => {
    const html = trasRecarga();

    for (const fuera of [
      TEXTO_PORTAL_PACIENTE.resumenTitulo,
      TEXTO_PORTAL_PACIENTE.citasTitulo,
      TEXTO_PORTAL_PACIENTE.visitasTitulo,
      'Mi bitácora',
    ]) {
      expect(html).not.toContain(fuera);
    }
  });

  it('la confirmación no pinta ningún dato de la persona', () => {
    const html = trasRecarga();

    // Ni siquiera el nombre de pila: la fase 2 no necesita ninguno para decidir.
    expect(html).not.toContain('Ana');
    expect(html).not.toContain('AE');
    expect(html).not.toContain('Ejemplo Ficticio');
  });

  it('la restauración no depende de almacenamiento del navegador', async () => {
    const navegador = navegadorFicticio();
    const accesos: string[] = [];

    // Cualquier lectura o escritura de almacenamiento quedaría registrada.
    const espia = new Proxy(
      {},
      {
        get: (_objetivo, propiedad) => {
          accesos.push(String(propiedad));
          return undefined;
        },
        set: (_objetivo, propiedad) => {
          accesos.push(String(propiedad));
          return true;
        },
      },
    );

    const global = globalThis as unknown as Record<string, unknown>;
    const previoLocal = global['localStorage'];
    const previoSession = global['sessionStorage'];
    global['localStorage'] = espia;
    global['sessionStorage'] = espia;

    try {
      await submitPatientEnrollment(
        buildPatientEnrollmentRequest(PACIENTE_FORMULARIO),
        navegador.fetch,
      );
      const restaurado = await fetchCurrentPatient(navegador.fetch);
      expect(restaurado?.givenNames).toBe('Ana María');
    } finally {
      global['localStorage'] = previoLocal;
      global['sessionStorage'] = previoSession;
    }

    expect(accesos).toStrictEqual([]);
  });

  it('el paciente restaurado no expone documento, dirección ni token', async () => {
    const navegador = navegadorFicticio();
    await submitPatientEnrollment(
      buildPatientEnrollmentRequest(PACIENTE_FORMULARIO),
      navegador.fetch,
    );
    const restaurado = await fetchCurrentPatient(navegador.fetch);

    const serializado = JSON.stringify(restaurado);
    expect(serializado).not.toContain('99990123');
    expect(serializado).not.toContain('Cra 45');
    expect(serializado).not.toContain('token-ficticio');
    expect(serializado).not.toContain('311 220 3355');
  });
});
