import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/openapi/openapi';

/**
 * El documento OpenAPI debe describir exactamente la superficie implementada
 * (TASK-001 AC-06; TASK-MVP-CORE-01 §13.11; TASK-MUNICIPALITY-CORE-01 AC-12;
 * TASK-HOSPITAL-CORE-01 §12.2 y §15; TASK-HOSPITAL-CORE-02 §11.2) y no debe
 * filtrar datos personales ni anunciar dominios fuera de alcance.
 */
describe('documento OpenAPI', () => {
  let app: INestApplication;
  let document: ReturnType<typeof buildOpenApiDocument>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    document = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('documenta exactamente las rutas aprobadas', () => {
    expect(Object.keys(document.paths).sort()).toStrictEqual([
      '/api/v1/access-requests',
      '/api/v1/access-requests/registration-attempt',
      '/api/v1/care/admin/organizations',
      '/api/v1/care/admin/organizations/{organizationId}',
      '/api/v1/care/admin/organizations/{organizationId}/competences',
      '/api/v1/care/admin/organizations/{organizationId}/competences/{competenceId}/revoke',
      '/api/v1/care/admin/organizations/{organizationId}/contexts',
      '/api/v1/care/admin/organizations/{organizationId}/contexts/{contextId}/grants',
      '/api/v1/care/admin/organizations/{organizationId}/grants/{grantId}/revoke',
      '/api/v1/care/contexts',
      '/api/v1/care/contexts/{contextId}/alarms',
      '/api/v1/care/contexts/{contextId}/alarms/{alarmId}',
      '/api/v1/care/contexts/{contextId}/alarms/{alarmId}/resolution-reports',
      '/api/v1/care/contexts/{contextId}/alarms/{alarmId}/transitions',
      '/api/v1/care/contexts/{contextId}/criteria',
      '/api/v1/care/contexts/{contextId}/criteria/{criterionId}/retire',
      '/api/v1/care/contexts/{contextId}/observables',
      '/api/v1/care/contexts/{contextId}/records',
      '/api/v1/care/contexts/{contextId}/records/{recordId}/amendments',
      '/api/v1/care/contexts/{contextId}/semaphore',
      '/api/v1/care/review-queue',
      '/api/v1/caregiver-relationships',
      '/api/v1/caregiver-relationships/{relationshipId}',
      '/api/v1/caregiver-relationships/{relationshipId}/activate',
      '/api/v1/caregiver-relationships/{relationshipId}/revoke',
      '/api/v1/hospital/access-requests',
      '/api/v1/hospital/access-requests/{requestId}',
      '/api/v1/hospital/access-requests/{requestId}/decision',
      '/api/v1/hospital/access-requests/{requestId}/password-recovery',
      '/api/v1/hospital/access-requests/{requestId}/password-recovery/reconcile',
      '/api/v1/hospital/agenda',
      '/api/v1/hospital/appointments/{appointmentId}/assignment',
      '/api/v1/hospital/patients',
      '/api/v1/hospital/patients/analytics',
      '/api/v1/hospital/patients/{patientId}',
      '/api/v1/hospital/professionals',
      '/api/v1/hospital/professionals/{professionalId}',
      '/api/v1/human-auth/logout',
      '/api/v1/human-auth/reauthenticate',
      '/api/v1/human-auth/session',
      '/api/v1/institutional/sessions',
      '/api/v1/institutional/sessions/current',
      '/api/v1/institutional/{experience}/administrator/current',
      '/api/v1/institutional/{experience}/claim',
      '/api/v1/institutional/{experience}/registration',
      '/api/v1/institutional/{experience}/registration-attempt',
      '/api/v1/me/contexts',
      '/api/v1/me/experiences',
      '/api/v1/municipality/management/{section}',
      '/api/v1/municipality/population-summary',
      '/api/v1/municipality/territory-summary',
      '/api/v1/patient-self/appointments',
      '/api/v1/patient-self/summary',
      '/api/v1/patient-self/visits',
      '/api/v1/patients/enrollments',
      '/api/v1/patients/me',
      '/api/v1/professional/visits',
      '/api/v1/professional/visits/{visitId}',
      '/api/v1/professional/visits/{visitId}/status',
      '/api/v1/visits/materialize',
      '/health',
    ]);
  });

  it('el registro institucional documenta cuerpo cerrado y credenciales solo de escritura', () => {
    const operation = document.paths['/api/v1/institutional/{experience}/registration']?.post;
    const body = operation?.requestBody as { content?: Record<string, { schema?: { additionalProperties?: unknown; properties?: Record<string, { writeOnly?: boolean }> } }> };
    const schema = body.content?.['application/json']?.schema;
    expect(schema?.additionalProperties).toBe(false);
    expect(Object.keys(schema?.properties ?? {}).sort()).toStrictEqual(['birthDate', 'confirmPassword', 'documentNumber', 'documentType', 'email', 'familyNames', 'givenNames', 'password', 'sexGenderCode']);
    expect(schema?.properties?.password?.writeOnly).toBe(true);
    expect(schema?.properties?.confirmPassword?.writeOnly).toBe(true);
    expect(Object.keys(operation?.responses ?? {}).sort()).toStrictEqual(['201', '409', '503']);
    expect(Object.keys(document.paths['/api/v1/institutional/{experience}/registration'] ?? {}).sort()).toStrictEqual(['get', 'post']);
  });

  it('documenta solo los métodos aprobados en cada ruta', () => {
    expect(Object.keys(document.paths['/health'] ?? {})).toStrictEqual(['get']);
    expect(
      Object.keys(document.paths['/api/v1/patients/enrollments'] ?? {}),
    ).toStrictEqual(['post']);
    /*
     * La superficie de solicitudes de acceso (SPEC 038, MP02-C1) es una única
     * operación de registro de interés: `POST` y nada más. No existe lectura,
     * ni actualización, ni borrado de una solicitud en este paquete, y su
     * ausencia es lo que impide que se confunda un registro de interés con un
     * recurso consultable o con un acceso concedible.
     */
    expect(Object.keys(document.paths['/api/v1/access-requests'] ?? {})).toStrictEqual([
      'post',
    ]);
    expect(Object.keys(document.paths['/api/v1/patients/me'] ?? {})).toStrictEqual([
      'get',
    ]);
    expect(
      Object.keys(document.paths['/api/v1/institutional/sessions'] ?? {}),
    ).toStrictEqual(['post']);
    expect(
      Object.keys(document.paths['/api/v1/institutional/sessions/current'] ?? {}).sort(),
    ).toStrictEqual(['delete', 'get']);
    /*
     * La superficie Hospital es de SOLO LECTURA salvo UNA excepción declarada:
     * TASK-HOSPITAL-CORE-02 autoriza exactamente una mutación, y es un `PATCH`
     * sobre la asignación de una cita. En ninguna otra ruta hay POST, PUT,
     * PATCH ni DELETE, y en esa tampoco hay ningún otro método.
     */
    for (const ruta of [
      '/api/v1/hospital/patients',
      '/api/v1/hospital/patients/analytics',
      '/api/v1/hospital/patients/{patientId}',
      '/api/v1/hospital/professionals',
      '/api/v1/hospital/professionals/{professionalId}',
      '/api/v1/hospital/agenda',
    ]) {
      expect(Object.keys(document.paths[ruta] ?? {})).toStrictEqual(['get']);
    }
    /*
     * La revisión de solicitudes de acceso (SPEC 038, MP03-C1) es la segunda
     * excepción declarada a la superficie Hospital de solo lectura: el revisor
     * DECIDE, y sin ese `POST` la superficie documentaría una operación que el
     * contrato exige y que el hospital no podría ejecutar. Las dos rutas de
     * lectura siguen siendo `GET` y no admiten ningún otro método.
     */
    expect(
      Object.keys(document.paths['/api/v1/hospital/access-requests'] ?? {}),
    ).toStrictEqual(['get']);
    expect(
      Object.keys(document.paths['/api/v1/hospital/access-requests/{requestId}'] ?? {}),
    ).toStrictEqual(['get']);
    expect(
      Object.keys(document.paths['/api/v1/hospital/access-requests/{requestId}/decision'] ?? {}),
    ).toStrictEqual(['post']);
    expect(
      Object.keys(
        document.paths['/api/v1/hospital/appointments/{appointmentId}/assignment'] ?? {},
      ),
    ).toStrictEqual(['patch']);
    expect(
      Object.keys(document.paths['/api/v1/municipality/population-summary'] ?? {}),
    ).toStrictEqual(['get']);
    expect(
      Object.keys(document.paths['/api/v1/municipality/territory-summary'] ?? {}),
    ).toStrictEqual(['get']);
  });

  /* TASK-MUNICIPALITY-CORE-01, FR-01, FR-14 y AC-12. */
  it('describe la denegación de los agregados municipales', () => {
    for (const ruta of [
      '/api/v1/municipality/population-summary',
      '/api/v1/municipality/territory-summary',
    ]) {
      const operation = document.paths[ruta]?.get;

      expect(operation?.responses['200']).toBeDefined();
      expect(operation?.responses['401']).toBeDefined();
      expect(operation?.responses['403']).toBeDefined();
    }
  });

  it('los agregados municipales no declaran parámetros de consulta', () => {
    for (const ruta of [
      '/api/v1/municipality/population-summary',
      '/api/v1/municipality/territory-summary',
    ]) {
      // El tenant, el municipio y cualquier filtro los resuelve el servidor.
      expect(document.paths[ruta]?.get?.parameters ?? []).toStrictEqual([]);
    }
  });

  /*
   * SPEC 055 / MP07B (A06). Directorio, cola, bitácora y bandeja son páginas
   * con cursor opaco OPCIONAL: ninguna exige recorrer desde un valor fabricado
   * por el cliente y la bandeja declara su filtro de abiertas. Ningún parámetro
   * nombra tenant, organización, paciente ni cuenta.
   */
  it('las listas de cuidado declaran cursor, tamaño y filtro opcionales, y nada de identidad', () => {
    const esperados: Readonly<Record<string, readonly string[]>> = {
      '/api/v1/care/contexts': ['cursor', 'limit'],
      '/api/v1/care/review-queue': ['cursor', 'limit'],
      '/api/v1/care/contexts/{contextId}/records': ['contextId', 'cursor', 'limit'],
      '/api/v1/care/contexts/{contextId}/alarms': ['contextId', 'cursor', 'limit', 'state'],
    };

    for (const [ruta, nombres] of Object.entries(esperados)) {
      const parametros = (document.paths[ruta]?.get?.parameters ?? []) as readonly {
        readonly name?: string;
        readonly in?: string;
        readonly required?: boolean;
        readonly schema?: { readonly enum?: readonly string[] };
      }[];

      expect(parametros.map((parametro) => parametro.name).sort()).toStrictEqual([...nombres].sort());
      for (const parametro of parametros.filter((item) => item.in === 'query')) {
        expect(parametro.required ?? false).toBe(false);
      }
      for (const prohibido of ['tenantId', 'organizationId', 'patientId', 'humanAccountId']) {
        expect(parametros.map((parametro) => parametro.name)).not.toContain(prohibido);
      }
    }

    const estado = (
      (document.paths['/api/v1/care/contexts/{contextId}/alarms']?.get?.parameters ?? []) as readonly {
        readonly name?: string;
        readonly schema?: { readonly enum?: readonly string[] };
      }[]
    ).find((parametro) => parametro.name === 'state');
    expect(estado?.schema?.enum).toStrictEqual(['all', 'open']);
  });

  it('el contrato municipal no declara ningún campo individual', () => {
    const municipales = JSON.stringify([
      document.components?.schemas?.['PopulationSummaryDto'],
      document.components?.schemas?.['TerritorySummaryDto'],
      document.components?.schemas?.['TerritoryMetricsDto'],
      document.components?.schemas?.['TerritoryLocalUnitDto'],
    ]);

    for (const prohibido of [
      'patientId',
      'personId',
      'birthDate',
      'documentNumber',
      'givenNames',
      'familyNames',
      'phone',
      'email',
      'exactAddress',
      'directions',
      'localityUnverifiedText',
      'tenantId',
      'tokenHash',
    ]) {
      expect(municipales).not.toContain(prohibido);
    }
  });

  /*
   * SPEC 038, MP02-C2-C1. El ejemplo de `reference` DEBE cumplir el mismo patrón
   * que el servidor emite y que el cliente web acepta. Un ejemplo con un carácter
   * de más no rompe la API —es documentación—, pero sí enseña a cualquier consumidor
   * a esperar una referencia que nunca llegará, y la interfaz rechazaría ese mismo
   * ejemplo como `unavailable`. Se fija aquí el formato para que no vuelva a
   * publicarse uno imposible.
   */
  it('el ejemplo de referencia publicado es un valor realmente aceptable', () => {
    const aceptada = document.components?.schemas?.['AccessRequestAcceptedDto'] as
      | { readonly properties?: Record<string, { readonly example?: unknown }> }
      | undefined;

    const ejemplo = aceptada?.properties?.['reference']?.example;

    expect(typeof ejemplo).toBe('string');
    expect(String(ejemplo)).toMatch(/^AR-[0-9A-F]{24}$/u);
  });

  it('declara exactamente el estado y la fuente que este endpoint emite', () => {
    const aceptada = document.components?.schemas?.['AccessRequestAcceptedDto'] as
      | {
          readonly properties?: Record<
            string,
            { readonly enum?: readonly string[]; readonly example?: unknown }
          >;
        }
      | undefined;

    // No es documentación: un consumidor que lea otra cosa creería que este
    // endpoint emite estados o procedencias que no emite.
    expect(aceptada?.properties?.['status']?.enum).toStrictEqual(['PENDING', 'APPROVED_PENDING_PROVISIONING', 'PROVISIONING_FAILED']);
    expect(aceptada?.properties?.['status']?.example).toBe('PENDING');
    expect(aceptada?.properties?.['source']?.enum).toStrictEqual(['TEST_DATA', 'SELF_REGISTRATION']);
    expect(aceptada?.properties?.['source']?.example).toBe('SELF_REGISTRATION');
  });

  it('declara la inscripción heredada como retirada', () => {
    const operation = document.paths['/api/v1/patients/enrollments']?.post;

    expect(operation?.operationId).toBe('createPatientEnrollment');
    expect(Object.keys(operation?.responses ?? {})).toEqual(['410']);
  });

  it('describe la denegación de la recuperación sin sesión', () => {
    const operation = document.paths['/api/v1/patients/me']?.get;

    expect(operation?.operationId).toBe('getCurrentPatient');
    expect(operation?.responses['200']).toBeDefined();
    expect(operation?.responses['401']).toBeDefined();
  });

  /*
   * Dominios fuera de alcance.
   *
   * La comprobación se hace sobre la superficie MÁQUINA del documento —rutas,
   * identificadores de operación, etiquetas, nombres de esquema y nombres de
   * propiedad—, no sobre la prosa de las descripciones.
   *
   * El motivo es exacto: TASK-HOSPITAL-CORE-01 §4.3 obliga a DECLARAR que
   * cuidadores, profesionales, patologías, programas, atenciones, alertas e
   * indicadores oficiales NO están disponibles. Cumplir esa obligación exige
   * nombrarlos en una frase que dice justamente que no existen. Prohibir la
   * palabra en la prosa castigaría la declaración honesta y premiaría el
   * silencio, que es peor: una superficie que calla sobre lo que no tiene se
   * lee como una superficie completa.
   *
   * Lo que sigue prohibido, y es lo que importa, es OFRECER esos dominios: que
   * exista una ruta, una operación, un esquema o un campo que los implemente.
   */
  it('no ofrece dominios fuera del alcance de CORE-01', () => {
    const schemas = document.components?.schemas ?? {};
    const superficie: string[] = [
      ...Object.keys(document.paths),
      ...Object.keys(schemas),
      ...Object.values(document.paths).flatMap((item) =>
        Object.values(item ?? {}).flatMap((operation) => {
          const typed = operation as {
            readonly operationId?: string;
            readonly tags?: readonly string[];
            readonly parameters?: readonly { readonly name?: string }[];
          };

          return [
            typed.operationId ?? '',
            ...(typed.tags ?? []),
            ...(typed.parameters ?? []).map((parameter) => parameter.name ?? ''),
          ];
        }),
      ),
      ...Object.values(schemas).flatMap((schema) =>
        Object.keys((schema as { readonly properties?: object }).properties ?? {}),
      ),
    ];

    const serialized = superficie.join(' ').toLowerCase();

    /*
     * TASK-HOSPITAL-CORE-02 aprueba EXPRESAMENTE profesionales, agenda y citas,
     * de modo que esas palabras dejan de estar prohibidas en la superficie
     * máquina: prohibirlas ahora obligaría a esconder una capacidad autorizada.
     * Todo lo demás sigue fuera de alcance y sigue sin poder OFRECERSE, y las
     * pruebas de la superficie de operaciones comprueban que la ampliación no
     * arrastró consigo ningún dominio vecino.
     */
    for (const forbidden of [
      /*
       * `caregiver` deja de estar prohibido: IDENTITY-RELATIONSHIPS-CORE-01
       * aprueba EXPRESAMENTE la gestion de la relacion Paciente-Cuidador, y
       * seguir prohibiendola obligaria a esconder una capacidad autorizada.
       *
       * `visit` deja de estar prohibido en VISITS-CORE-01 MP04, que aprueba
       * EXPRESAMENTE la materializacion institucional, la consulta autorizada y
       * las tres transiciones profesionales de la visita domiciliaria. La
       * prueba dedicada de MP04 comprueba que esa apertura es EXACTAMENTE de
       * tres operaciones y que no arrastro consigo ningun dominio vecino.
       *
       * `alert` deja de estar prohibido en SPEC 055 / MP03, que aprueba
       * EXPRESAMENTE la solicitud manual de revision y su seguimiento por un
       * revisor autorizado (modulo `care-alerts`). `semaforo` y `triage`
       * siguen prohibidos: MP03 no clasifica automaticamente ni ofrece un
       * semaforo; la clasificacion la decide un profesional.
       */
      'cuidador',
      'furag',
      'mipg',
      'adres',
      'sena',
      'payment',
      'presupuesto',
      'budget',
      'indicator',
      'diagnos',
      'pathology',
      'patolog',
      'triage',
      'semaforo',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  /*
   * Contrapartida positiva de la prueba anterior: la superficie Hospital debe
   * DECIR que esos dominios no están disponibles, en lugar de callarlo.
   */
  it('declara expresamente que los dominios ausentes no están modelados', () => {
    const analitica = JSON.stringify(
      document.components?.schemas?.['HospitalPatientAnalyticsDto'],
    );

    expect(analitica).toContain('no están modelados');
    expect(analitica).toContain('cuidadores');
    expect(analitica).toContain('profesionales');
    // Y la cifra disponible NO se publica como «indicador» institucional.
    expect(analitica).toContain('keyFigures');
    expect(analitica).toContain('no acreditan cumplimiento');
  });

  it('no expone la dirección exacta ni el documento en la representación devuelta', () => {
    const summary = JSON.stringify(document.components?.schemas?.['PatientSummaryDto']);

    expect(summary).not.toContain('exactAddress');
    expect(summary).not.toContain('documentNumber');
    expect(summary).not.toContain('tokenHash');
    expect(summary).not.toContain('phone');
  });

  it('declara únicamente el esquema de seguridad realmente implementado', () => {
    const schemes = document.components?.securitySchemes ?? {};

    expect(Object.keys(schemes).sort()).toStrictEqual([
      'enrollmentSession',
      'humanSession',
      'institutionalSession',
    ]);

    for (const scheme of Object.values(schemes)) {
      expect(scheme).toMatchObject({ type: 'apiKey', in: 'cookie' });
    }
  });

  it('no incluye datos personales reales en los ejemplos', () => {
    const serialized = JSON.stringify(document);

    // Los ejemplos usan personas ficticias declaradas como tales.
    expect(serialized).toContain('Ejemplo Ficticio');
    expect(serialized).toContain('correo.ficticio');
  });
});

/* -------------------------------------------------------------------------- */
/* Superficie Hospital (TASK-HOSPITAL-CORE-01)                                 */
/* -------------------------------------------------------------------------- */

describe('documento OpenAPI de la superficie Hospital', () => {
  let app: INestApplication;
  let document: ReturnType<typeof buildOpenApiDocument>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    document = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Las tres rutas hospitalarias declaradas. */
  const RUTAS = [
    '/api/v1/hospital/patients',
    '/api/v1/hospital/patients/analytics',
    '/api/v1/hospital/patients/{patientId}',
  ] as const;

  it('describe la denegación de cada lectura hospitalaria', () => {
    for (const ruta of RUTAS) {
      const operation = document.paths[ruta]?.get;

      expect(operation?.responses['200']).toBeDefined();
      expect(operation?.responses['401']).toBeDefined();
      expect(operation?.responses['403']).toBeDefined();
    }

    // El detalle además describe el 404 uniforme.
    expect(
      document.paths['/api/v1/hospital/patients/{patientId}']?.get?.responses['404'],
    ).toBeDefined();
  });

  it('declara exactamente la allowlist de parámetros del listado', () => {
    const parametros = (document.paths['/api/v1/hospital/patients']?.get?.parameters ?? [])
      .map((parameter) => (parameter as { readonly name: string }).name)
      .sort();

    expect(parametros).toStrictEqual([
      'ageMax',
      'ageMin',
      'areaType',
      'direction',
      'epsCode',
      'municipalityOfficialCode',
      'older60',
      'page',
      'pageSize',
      'patientStatus',
      'populationType',
      'search',
      'sort',
    ]);
  });

  it('la analítica no declara paginación ni orden', () => {
    const parametros = (
      document.paths['/api/v1/hospital/patients/analytics']?.get?.parameters ?? []
    ).map((parameter) => (parameter as { readonly name: string }).name);

    for (const excluido of ['page', 'pageSize', 'sort', 'direction']) {
      expect(parametros).not.toContain(excluido);
    }
  });

  it('ninguna ruta hospitalaria declara tenant, persona ni selección de columnas', () => {
    for (const ruta of RUTAS) {
      const parametros = (document.paths[ruta]?.get?.parameters ?? []).map(
        (parameter) => (parameter as { readonly name: string }).name,
      );

      for (const prohibido of ['tenantId', 'personId', 'select', 'fields', 'orderBy']) {
        expect(parametros).not.toContain(prohibido);
      }
    }
  });

  it('el contrato hospitalario no declara ningún campo prohibido', () => {
    const hospitalarios = JSON.stringify([
      document.components?.schemas?.['HospitalPatientListDto'],
      document.components?.schemas?.['HospitalPatientListItemDto'],
      document.components?.schemas?.['HospitalPatientDetailDto'],
      document.components?.schemas?.['HospitalPatientAnalyticsDto'],
      document.components?.schemas?.['HospitalTerritoryDto'],
      document.components?.schemas?.['HospitalPrioritiesDto'],
    ]);

    for (const prohibido of [
      'personId',
      'documentNumber"',
      'documentNumberNormalized',
      'phone',
      'email',
      'exactAddress',
      'directions',
      'localityUnverifiedText',
      'settlementUnverifiedText',
      'tenantId',
      'tokenHash',
      'consent',
      'identityId',
    ]) {
      expect(hospitalarios).not.toContain(prohibido);
    }
  });

  it('el contrato hospitalario no declara dominios ausentes de CORE-01', () => {
    const hospitalarios = JSON.stringify([
      document.components?.schemas?.['HospitalPatientListItemDto'],
      document.components?.schemas?.['HospitalPatientDetailDto'],
    ]).toLowerCase();

    for (const ausente of [
      'caregiver',
      'professional',
      'appointment',
      'visit',
      'program',
      'condition',
      'pathology',
      'triage',
      'alert',
    ]) {
      expect(hospitalarios).not.toContain(ausente);
    }
  });

  it('el contexto de sesión no devuelve tenant, identidad ni persona demostrativa', () => {
    const contexto = JSON.stringify(
      document.components?.schemas?.['InstitutionalSessionContextDto'],
    );

    expect(contexto).toContain('actorDisplay');
    expect(contexto).not.toContain('tenantId');
    expect(contexto).not.toContain('identityId');
    expect(contexto).not.toContain('Claudia Vargas');
    expect(contexto).not.toContain('Hospital San Rafael');
  });

  it('declara los cinco roles institucionales implementados y ninguno más', () => {
    const sesion = document.components?.schemas?.['InstitutionalSessionDto'] as
      | { readonly properties?: { readonly role?: { readonly enum?: string[] } } }
      | undefined;

    /*
     * IDENTITY-RELATIONSHIPS-CORE-01 (AD-03) añade el cuarto rol, DISJUNTO de
     * los tres anteriores. Que figure aquí no le concede ninguna superficie:
     * cada dominio conserva su guard con su rol exacto.
     *
     * SPEC 038 MP03-C1 añade el quinto, el revisor de acceso, con la misma
     * consecuencia: aparecer en el enum de la sesión NO le concede ninguna
     * superficie. La revisión exige `HOSPITAL_ACCESS_REVIEWER` en un guard
     * propio, y ningún otro rol la obtiene por herencia.
     */
    expect(sesion?.properties?.role?.enum).toStrictEqual([
      'MUNICIPAL_VIEWER',
      'HOSPITAL_PATIENT_VIEWER',
      'HOSPITAL_SCHEDULER',
      'CAREGIVER_RELATIONSHIP_MANAGER',
      'HOSPITAL_ACCESS_REVIEWER',
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* Superficie Hospital de Operaciones (TASK-HOSPITAL-CORE-02 §11.2)            */
/* -------------------------------------------------------------------------- */

describe('documento OpenAPI de la superficie Hospital de Operaciones', () => {
  let app: INestApplication;
  let document: ReturnType<typeof buildOpenApiDocument>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    document = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const LECTURAS = [
    '/api/v1/hospital/professionals',
    '/api/v1/hospital/professionals/{professionalId}',
    '/api/v1/hospital/agenda',
  ] as const;

  const ASIGNACION = '/api/v1/hospital/appointments/{appointmentId}/assignment';

  it('describe la denegación de cada lectura de operaciones', () => {
    for (const ruta of LECTURAS) {
      const operation = document.paths[ruta]?.get;

      expect(operation?.responses['200']).toBeDefined();
      expect(operation?.responses['400']).toBeDefined();
      expect(operation?.responses['401']).toBeDefined();
      expect(operation?.responses['403']).toBeDefined();
    }

    // El detalle profesional además describe el 404 uniforme.
    expect(
      document.paths['/api/v1/hospital/professionals/{professionalId}']?.get
        ?.responses['404'],
    ).toBeDefined();
  });

  it('la asignación describe todos sus desenlaces', () => {
    const operation = document.paths[ASIGNACION]?.patch;

    expect(operation?.operationId).toBe('assignHospitalAppointment');

    for (const status of ['200', '400', '401', '403', '404', '409']) {
      expect(operation?.responses[status]).toBeDefined();
    }
  });

  it('declara exactamente la allowlist de parámetros del directorio', () => {
    const parametros = (
      document.paths['/api/v1/hospital/professionals']?.get?.parameters ?? []
    )
      .map((parameter) => (parameter as { readonly name: string }).name)
      .sort();

    expect(parametros).toStrictEqual([
      'affiliationType',
      'direction',
      'page',
      'pageSize',
      'professionCode',
      'search',
      'sort',
      'status',
    ]);
  });

  it('la agenda declara exactamente su ventana y nada más', () => {
    const parametros = (document.paths['/api/v1/hospital/agenda']?.get?.parameters ?? [])
      .map((parameter) => (parameter as { readonly name: string }).name)
      .sort();

    expect(parametros).toStrictEqual(['from', 'to']);
  });

  it('ninguna ruta de operaciones declara tenant, persona ni actor', () => {
    for (const ruta of [...LECTURAS, ASIGNACION]) {
      const item = document.paths[ruta] ?? {};

      for (const operation of Object.values(item)) {
        const parametros = (
          (operation as { readonly parameters?: readonly { readonly name?: string }[] })
            .parameters ?? []
        ).map((parameter) => parameter.name ?? '');

        for (const prohibido of [
          'tenantId',
          'identityId',
          'personId',
          'actor',
          'role',
          'select',
          'fields',
          'orderBy',
        ]) {
          expect(parametros).not.toContain(prohibido);
        }
      }
    }
  });

  it('el cuerpo de la asignación admite exactamente tres campos', () => {
    const cuerpo = document.components?.schemas?.['HospitalAssignmentRequestDto'] as
      | { readonly properties?: Record<string, unknown> }
      | undefined;

    expect(Object.keys(cuerpo?.properties ?? {}).sort()).toStrictEqual([
      'expectedVersion',
      'professionalId',
      'scheduledStart',
    ]);
  });

  it('el contrato de operaciones no declara ningún campo prohibido', () => {
    /*
     * La comprobación recorre los NOMBRES de propiedad, no la prosa: igual que
     * en la prueba de dominios fuera de alcance, el contrato está OBLIGADO a
     * decir «NUNCA es `personId`» o «no acredita relación laboral», y castigar
     * esa frase premiaría el silencio. Lo que no puede existir es el CAMPO.
     */
    const propiedades = [
      'HospitalProfessionalListDto',
      'HospitalProfessionalListItemDto',
      'HospitalProfessionalDetailDto',
      'HospitalMinimalPatientDto',
      'HospitalMinimalProfessionalDto',
      'HospitalAffiliationDto',
      'HospitalAgendaViewDto',
      'HospitalAgendaRequestDto',
      'HospitalAgendaAppointmentDto',
      'HospitalScheduledAppointmentDto',
      'HospitalAssignedAppointmentDto',
      'HospitalAssignmentRequestDto',
    ].flatMap((nombre) =>
      Object.keys(
        (
          document.components?.schemas?.[nombre] as
            | { readonly properties?: object }
            | undefined
        )?.properties ?? {},
      ),
    );

    for (const prohibido of [
      'personId',
      'documentMasked',
      'documentNumber',
      'documentType',
      'phone',
      'email',
      'exactAddress',
      'directions',
      'birthDate',
      'age',
      'epsCode',
      'tenantId',
      'identityId',
      'actorUserId',
      'tokenHash',
      'consentVersion',
      'salary',
      'rating',
      'availability',
      'diagnosis',
      'caregiverId',
      'reason',
      'address',
      'price',
      'amount',
    ]) {
      expect(propiedades).not.toContain(prohibido);
    }
  });

  it('el contrato de operaciones declara que no afirma disponibilidad ni calificación', () => {
    const ficha = JSON.stringify(
      document.components?.schemas?.['HospitalProfessionalListItemDto'],
    );
    const vinculo = JSON.stringify(document.components?.schemas?.['HospitalAffiliationDto']);
    const agenda = JSON.stringify(document.components?.schemas?.['HospitalAgendaViewDto']);

    // Lo que se publica es lo REGISTRADO, y el documento lo dice explícitamente.
    expect(ficha).toContain('no modela disponibilidad');
    expect(ficha).toContain('no modela calificaciones');
    expect(ficha).toContain('no mide desempeño');
    expect(vinculo).toContain('No acredita relación laboral');
    expect(agenda).toContain('NO significa disponible');
  });
});

/* -------------------------------------------------------------------------- */
/* Núcleo de identidad humana y relación (IDENTITY-RELATIONSHIPS-CORE-01 §16)  */
/* -------------------------------------------------------------------------- */

describe('documento OpenAPI del núcleo de identidad humana', () => {
  let app: INestApplication;
  let document: ReturnType<typeof buildOpenApiDocument>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    document = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /*
   * `login` y `callback` NO se documentan en el contrato de máquina: su
   * respuesta es una redirección hacia un tercero, no un cuerpo JSON, y
   * describirlas como si devolvieran datos sería inexacto. Lo que sí debe
   * comprobarse es que NO aparecen, para que nadie las tome por endpoints de
   * datos.
   */
  it('no publica login ni callback como endpoints de datos', () => {
    expect(document.paths['/api/v1/human-auth/login']).toBeUndefined();
    expect(document.paths['/api/v1/human-auth/callback']).toBeUndefined();
  });

  it('documenta solo los métodos aprobados de la superficie humana', () => {
    expect(Object.keys(document.paths['/api/v1/human-auth/session'] ?? {})).toStrictEqual([
      'get',
    ]);
    expect(Object.keys(document.paths['/api/v1/me/contexts'] ?? {})).toStrictEqual(['get']);
    expect(Object.keys(document.paths['/api/v1/me/experiences'] ?? {})).toStrictEqual(['get']);
    expect(
      Object.keys(document.paths['/api/v1/caregiver-relationships'] ?? {}),
    ).toStrictEqual(['post']);
    expect(
      Object.keys(document.paths['/api/v1/caregiver-relationships/{relationshipId}'] ?? {}),
    ).toStrictEqual(['get']);

    // Activar y revocar son PATCH y solo PATCH. No hay PUT ni DELETE.
    for (const ruta of [
      '/api/v1/caregiver-relationships/{relationshipId}/activate',
      '/api/v1/caregiver-relationships/{relationshipId}/revoke',
    ]) {
      expect(Object.keys(document.paths[ruta] ?? {})).toStrictEqual(['patch']);
    }
  });

  it('describe la denegación de cada operación de relaciones', () => {
    const operaciones = [
      document.paths['/api/v1/caregiver-relationships']?.post,
      document.paths['/api/v1/caregiver-relationships/{relationshipId}']?.get,
      document.paths['/api/v1/caregiver-relationships/{relationshipId}/activate']?.patch,
      document.paths['/api/v1/caregiver-relationships/{relationshipId}/revoke']?.patch,
    ];

    for (const operation of operaciones) {
      expect(operation?.responses['401']).toBeDefined();
      expect(operation?.responses['403']).toBeDefined();
      expect(operation?.responses['404']).toBeDefined();
    }

    // Las tres mutaciones declaran además su conflicto de versión o transición.
    for (const operation of operaciones.slice(0, 1).concat(operaciones.slice(2))) {
      expect(operation?.responses['409']).toBeDefined();
    }
  });

  it('la sesión humana no declara ningún identificador interno', () => {
    const sesion = JSON.stringify(document.components?.schemas?.['HumanSessionDto']);
    const contextos = JSON.stringify(document.components?.schemas?.['HumanContextsDto']);

    for (const prohibido of [
      'tenantId',
      'humanAccountId',
      'personId',
      'patientId',
      'professionalId',
      'sessionId',
      'tokenHash',
      'issuer',
      'subject',
      'documentNumber',
      'birthDate',
      'phone',
      'email',
    ]) {
      expect(sesion).not.toContain(prohibido);
      expect(contextos).not.toContain(prohibido);
    }
  });

  it('el cuerpo de creación admite exactamente cinco campos', () => {
    const cuerpo = document.components?.schemas?.[
      'CaregiverRelationshipCreateRequestDto'
    ] as { readonly properties?: Record<string, unknown> } | undefined;

    expect(Object.keys(cuerpo?.properties ?? {}).sort()).toStrictEqual([
      'authorizationReference',
      'caregiverPersonId',
      'endsAt',
      'patientId',
      'startsAt',
    ]);
  });

  it('el cuerpo de activación y el de revocación son mínimos', () => {
    const activar = document.components?.schemas?.[
      'CaregiverRelationshipActivateRequestDto'
    ] as { readonly properties?: Record<string, unknown> } | undefined;
    const revocar = document.components?.schemas?.[
      'CaregiverRelationshipRevokeRequestDto'
    ] as { readonly properties?: Record<string, unknown> } | undefined;

    expect(Object.keys(activar?.properties ?? {}).sort()).toStrictEqual([
      'expectedVersion',
    ]);
    expect(Object.keys(revocar?.properties ?? {}).sort()).toStrictEqual([
      'expectedVersion',
      'reason',
    ]);
  });

  it('ningún cuerpo admite tenant, estado, actor, alcance ni fuente', () => {
    const cuerpos = [
      'CaregiverRelationshipCreateRequestDto',
      'CaregiverRelationshipActivateRequestDto',
      'CaregiverRelationshipRevokeRequestDto',
    ].flatMap((nombre) =>
      Object.keys(
        (document.components?.schemas?.[nombre] as
          | { readonly properties?: Record<string, unknown> }
          | undefined)?.properties ?? {},
      ),
    );

    /*
     * TODOS estos los fija el SERVIDOR. Que el cliente pudiera enviarlos
     * convertiría al navegador en autoridad sobre el estado, el alcance y la
     * procedencia de una autorización que afecta a los datos de otra persona.
     */
    for (const prohibido of [
      'tenantId',
      'status',
      'relationshipType',
      'purpose',
      'validationSource',
      'scope',
      'scopes',
      'version',
      'validatedAt',
      'validatedBy',
      'revokedAt',
      'revokedBy',
      'actor',
      'role',
      'identityId',
    ]) {
      expect(cuerpos).not.toContain(prohibido);
    }
  });

  it('la respuesta de relación no devuelve referencia ni identidad institucional', () => {
    const relacion = JSON.stringify(
      document.components?.schemas?.['CaregiverRelationshipDto'],
    );

    // La referencia de autorización es un soporte documental: no se devuelve.
    const propiedades = Object.keys(
      (document.components?.schemas?.['CaregiverRelationshipDto'] as
        | { readonly properties?: Record<string, unknown> }
        | undefined)?.properties ?? {},
    );

    expect(propiedades).not.toContain('authorizationReference');
    expect(propiedades).not.toContain('tenantId');
    expect(propiedades).not.toContain('validatedByInstitutionalIdentityId');
    expect(propiedades).not.toContain('revokedByInstitutionalIdentityId');

    // Y ningún dato personal de ninguna de las dos personas.
    for (const prohibido of ['givenNames', 'familyNames', 'documentNumber', 'birthDate']) {
      expect(relacion).not.toContain(prohibido);
    }
  });

  it('el alcance publicado es exactamente VISITS_VIEW y de solo lectura', () => {
    const relacion = document.components?.schemas?.['CaregiverRelationshipDto'] as
      | {
          readonly properties?: {
            readonly scopes?: { readonly items?: { readonly enum?: string[] } };
          };
        }
      | undefined;

    const concedibles = relacion?.properties?.scopes?.items?.enum ?? [];

    expect(concedibles).toStrictEqual(['VISITS_VIEW']);

    /*
     * La comprobación va contra el ENUM y no contra el JSON serializado: la
     * descripción del campo NOMBRA los alcances de escritura precisamente para
     * declarar que no existen, y buscarlos como texto se dispararía con esa
     * misma declaración. Lo que debe ser imposible es que sean CONCEDIBLES.
     */
    for (const escritura of ['VISITS_CONTRIBUTE', 'VISITS_EXECUTE', 'VISITS_MANAGE']) {
      expect(concedibles).not.toContain(escritura);
    }
  });

  /*
   * Contrapartida positiva: el documento debe DECIR lo que la relación no es,
   * en lugar de callarlo. Un contrato que solo dice «relación cuidador» invita
   * a leerla como representación legal.
   */
  it('declara expresamente que la relación no es representación legal', () => {
    const creacion = JSON.stringify(
      document.paths['/api/v1/caregiver-relationships']?.post,
    );

    expect(creacion).toContain('NO es representación legal');
    expect(creacion).toContain('NO es tutela');
    expect(creacion).toContain('NO es parentesco');
    expect(creacion).toContain('NO concede acceso clínico');

    const relacion = JSON.stringify(
      document.components?.schemas?.['CaregiverRelationshipDto'],
    );

    // La fuente de validación declara su propio carácter no probatorio.
    expect(relacion).toContain('aserción de operador');
    expect(relacion).toContain('no es verificación de identidad');
  });

  it('declara el esquema de la cookie humana y su separación de las otras dos', () => {
    const humana = document.components?.securitySchemes?.['humanSession'];

    expect(humana).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'merdn_human_session',
    });

    const descripcion = JSON.stringify(humana);

    expect(descripcion).toContain('DISTINTA');
    expect(descripcion).toContain('8 horas');
    expect(descripcion).toContain('30 minutos');
    expect(descripcion).toContain('UNA sesión activa');
  });
});

/* -------------------------------------------------------------------------- */
/* Superficie de Visitas domiciliarias (VISITS-CORE-01 MP04)                   */
/* -------------------------------------------------------------------------- */

describe('documento OpenAPI de la superficie de Visitas', () => {
  let app: INestApplication;
  let document: ReturnType<typeof buildOpenApiDocument>;

  const MATERIALIZAR = '/api/v1/visits/materialize';
  const VISITA = '/api/v1/professional/visits/{visitId}';
  const ESTADO = '/api/v1/professional/visits/{visitId}/status';
  const PACIENTE_VISITAS = '/api/v1/patient-self/visits';
  /*
   * El LISTADO de la persona visitadora lo aprueba la spec 017
   * (worklist-del-visitador), no MP04. Es una ruta de Visitas real y por eso
   * figura en la igualdad exacta de abajo, pero su alcance es SOLO LECTURA:
   * una única operación `GET` y ninguna otra.
   */
  const WORKLIST = '/api/v1/professional/visits';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    document = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('publica EXACTAMENTE las tres operaciones aprobadas por MP04', () => {
    expect(Object.keys(document.paths[MATERIALIZAR] ?? {})).toStrictEqual(['post']);
    expect(Object.keys(document.paths[VISITA] ?? {})).toStrictEqual(['get']);
    expect(Object.keys(document.paths[ESTADO] ?? {})).toStrictEqual(['patch']);

    expect(document.paths[MATERIALIZAR]?.post?.operationId).toBe('materializeHomeVisit');
    expect(document.paths[VISITA]?.get?.operationId).toBe('getProfessionalHomeVisit');
    expect(document.paths[ESTADO]?.patch?.operationId).toBe(
      'changeProfessionalHomeVisitStatus',
    );
  });

  it('no publica ninguna otra ruta de Visitas', () => {
    /*
     * `GET /api/v1/patient-self/visits` NO pertenece a esta superficie: es la
     * lectura de SU PROPIA visita que la spec 021 aprueba para la persona
     * paciente, y la lista cerrada de rutas aprobadas ya la verifica una sola
     * vez. Se excluye por su ESPACIO DE NOMBRES exacto, no por coincidencia
     * parcial: cualquier otra ruta que contenga `visits` sigue siendo una ruta
     * de MP04 y debe figurar abajo en igualdad exacta.
     */
    const rutasDeVisitas = Object.keys(document.paths).filter(
      (ruta) => ruta.includes('visits') && !ruta.startsWith(PACIENTE_VISITAS),
    );

    expect(rutasDeVisitas.sort()).toStrictEqual(
      [VISITA, ESTADO, MATERIALIZAR, WORKLIST].sort(),
    );

    // La ruta Patient Self existe, es EXACTAMENTE una y es de SOLO LECTURA.
    expect(Object.keys(document.paths[PACIENTE_VISITAS] ?? {})).toStrictEqual(['get']);

    /*
     * El listado de la spec 017 NO abre mutación alguna: un `GET` y nada más.
     * Que no haya `POST`, `PATCH` ni `DELETE` sobre la colección es la garantía
     * de que crear o cambiar una visita sigue siendo potestad de la
     * materialización institucional y de la transición por `:visitId`.
     */
    expect(Object.keys(document.paths[WORKLIST] ?? {})).toStrictEqual(['get']);
    expect(document.paths[WORKLIST]?.get?.operationId).toBe(
      'listProfessionalVisitWorklist',
    );

    /*
     * MP04 NO abre cuidador, paciente, notas, evidencia, dirección, GPS,
     * archivos ni cancelación. Lo que no debe existir es la RUTA.
     */
    for (const ausente of [
      '/api/v1/visits',
      '/api/v1/caregiver/visits',
      '/api/v1/patient/visits',
      '/api/v1/professional/visits/{visitId}/notes',
      '/api/v1/professional/visits/{visitId}/evidence',
      '/api/v1/professional/visits/{visitId}/cancel',
    ]) {
      expect(document.paths[ausente]).toBeUndefined();
    }
  });

  it('describe todos los desenlaces de cada operación', () => {
    // Materializar es una mutación institucional con origen comprobado.
    for (const status of ['201', '400', '401', '403', '404', '409', '503']) {
      expect(document.paths[MATERIALIZAR]?.post?.responses[status]).toBeDefined();
    }

    // La lectura profesional no cambia estado: no declara 403 ni 409.
    for (const status of ['200', '400', '401', '404', '503']) {
      expect(document.paths[VISITA]?.get?.responses[status]).toBeDefined();
    }
    expect(document.paths[VISITA]?.get?.responses['409']).toBeUndefined();

    for (const status of ['200', '400', '401', '403', '404', '409', '503']) {
      expect(document.paths[ESTADO]?.patch?.responses[status]).toBeDefined();
    }
  });

  it('los cuerpos admiten exactamente los campos aprobados', () => {
    const materializar = document.components?.schemas?.[
      'MaterializeHomeVisitRequestDto'
    ] as { readonly properties?: Record<string, unknown> } | undefined;

    expect(Object.keys(materializar?.properties ?? {})).toStrictEqual(['appointmentId']);

    const cambio = document.components?.schemas?.['HomeVisitStatusChangeRequestDto'] as
      | { readonly properties?: Record<string, { readonly enum?: readonly string[] }> }
      | undefined;

    expect(Object.keys(cambio?.properties ?? {}).sort()).toStrictEqual([
      'expectedVersion',
      'status',
    ]);

    /*
     * `SCHEDULED` NO es un destino admitido: ese estado es la CREACIÓN, que
     * pertenece a la materialización institucional y no a la persona
     * profesional. Que no figure en el enum es la garantía.
     */
    expect(cambio?.properties?.['status']?.enum).toStrictEqual([
      'IN_PROGRESS',
      'COMPLETED',
      'NOT_COMPLETED',
    ]);
  });

  it('ningún cuerpo ni ninguna ruta de Visitas admite campos de autoridad', () => {
    const cuerpos = [
      'MaterializeHomeVisitRequestDto',
      'HomeVisitStatusChangeRequestDto',
    ].flatMap((nombre) =>
      Object.keys(
        (
          document.components?.schemas?.[nombre] as
            | { readonly properties?: object }
            | undefined
        )?.properties ?? {},
      ),
    );

    const parametros = [MATERIALIZAR, VISITA, ESTADO].flatMap((ruta) =>
      Object.values(document.paths[ruta] ?? {}).flatMap((operation) =>
        (
          (operation as { readonly parameters?: readonly { readonly name?: string }[] })
            .parameters ?? []
        ).map((parameter) => parameter.name ?? ''),
      ),
    );

    /*
     * El tenant, la identidad, la persona y el instante los resuelve el
     * SERVIDOR. Un `professionalId` recibido sería exactamente la vía por la
     * que una persona ejecutaría la visita de otra: su AUSENCIA es la garantía.
     */
    for (const prohibido of [
      'tenantId',
      'identityId',
      'personId',
      'patientId',
      'professionalId',
      'careAssignmentId',
      'humanAccountId',
      'actor',
      'role',
      'occurredAt',
      'startedAt',
      'endedAt',
      'now',
    ]) {
      expect(cuerpos).not.toContain(prohibido);
      expect(parametros).not.toContain(prohibido);
    }
  });

  it('las respuestas de Visitas no declaran ningún campo personal ni clínico', () => {
    const propiedades = [
      'MaterializedHomeVisitDto',
      'ProfessionalHomeVisitDto',
      'HomeVisitTransitionResultDto',
      'VisitsErrorDto',
    ].flatMap((nombre) =>
      Object.keys(
        (
          document.components?.schemas?.[nombre] as
            | { readonly properties?: object }
            | undefined
        )?.properties ?? {},
      ),
    );

    for (const prohibido of [
      'tenantId',
      'patientId',
      'professionalId',
      'personId',
      'careAssignmentId',
      'humanAccountId',
      'createdByInstitutionalIdentityId',
      'givenNames',
      'familyNames',
      'documentNumber',
      'phone',
      'email',
      'address',
      'exactAddress',
      'directions',
      'latitude',
      'longitude',
      'notes',
      'reason',
      'diagnosis',
      'evidence',
      'attachment',
      'signature',
    ]) {
      expect(propiedades).not.toContain(prohibido);
    }
  });

  it('declara expresamente lo que la superficie de Visitas NO afirma', () => {
    const materializar = JSON.stringify(document.paths[MATERIALIZAR]?.post);
    const cambio = JSON.stringify(document.paths[ESTADO]?.patch);
    const visita = JSON.stringify(
      document.components?.schemas?.['ProfessionalHomeVisitDto'],
    );

    // Materializar es un acto ADMINISTRATIVO y no prueba ninguna atención.
    expect(materializar).toContain('NO afirma que la atención se haya prestado');
    expect(materializar).toContain('NUNCA a la persona visitadora');
    expect(materializar).toContain('NO aplica ninguna regla clínica');

    // La transición no registra causas ni evidencia, y lo dice.
    expect(cambio).toContain('NO registra motivo');
    expect(cambio).toContain('no tiene aprobado ningún catálogo de causas');
    expect(cambio).toContain('no hay reapertura');

    // El estado operativo no es un dato clínico, y el contrato lo declara.
    expect(visita).toContain('NO es un dato clínico');
  });

  it('la lectura profesional declara que la autorización se resuelve en el servidor', () => {
    const lectura = JSON.stringify(document.paths[VISITA]?.get);

    expect(lectura).toContain('El cliente NO envía profesional, paciente ni institución');
    expect(lectura).toContain('NO existe listado ni búsqueda');
  });
});

/* -------------------------------------------------------------------------- */
/* Superficie Hospital de revisión de solicitudes (SPEC 038 MP03-C1)           */
/* -------------------------------------------------------------------------- */

describe('documento OpenAPI de la revisión institucional de solicitudes', () => {
  const LISTADO = '/api/v1/hospital/access-requests';
  const DETALLE = '/api/v1/hospital/access-requests/{requestId}';
  const DECISION = '/api/v1/hospital/access-requests/{requestId}/decision';

  let app: INestApplication;
  let document: ReturnType<typeof buildOpenApiDocument>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    document = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('el listado declara los cinco filtros y una respuesta paginada', () => {
    const parametros = (document.paths[LISTADO]?.get?.parameters ?? []) as readonly {
      readonly name?: string;
    }[];

    expect(parametros.map((parametro) => parametro.name).sort()).toStrictEqual([
      'cursor',
      'limit',
      'profile',
      'q',
      'status',
    ]);

    /*
     * La respuesta se documenta por `$ref`, no en línea: el contrato de esta
     * superficie son los ESQUEMAS, y un documento que los duplicara en cada
     * operación podría divergir de ellos sin que nada lo notara.
     */
    const respuestas = document.paths[LISTADO]?.get?.responses as
      | Record<string, { readonly content?: Record<string, { readonly schema?: unknown }> }>
      | undefined;

    expect(
      respuestas?.['200']?.content?.['application/json']?.schema,
    ).toStrictEqual({ $ref: '#/components/schemas/AccessRequestReviewListDto' });
  });

  it('el item de listado NO declara ningún campo del detalle', () => {
    const item = document.components?.schemas?.['AccessRequestReviewListItemDto'] as
      | { readonly properties?: Record<string, unknown> }
      | undefined;

    expect(Object.keys(item?.properties ?? {}).sort()).toStrictEqual([
      'familyNames',
      'givenNames',
      'reference',
      'requestId',
      'requestedProfile',
      'status',
      'submittedAt',
      'version',
    ]);

    // El expediente no se filtra al listado ni por accidente de esquema.
    expect('registration' in (item?.properties ?? {})).toBe(false);
    expect('registrationSchemaVersion' in (item?.properties ?? {})).toBe(false);
  });

  it('el detalle y el envio declaran el expediente opcional (MP04-C3)', () => {
    const detalle = document.components?.schemas?.['AccessRequestReviewDetailDto'] as
      | { readonly properties?: Record<string, unknown> }
      | undefined;

    expect('registration' in (detalle?.properties ?? {})).toBe(true);
    expect('registrationSchemaVersion' in (detalle?.properties ?? {})).toBe(true);

    const envio = document.components?.schemas?.['AccessRequestSubmissionDto'] as
      | { readonly properties?: Record<string, unknown> }
      | undefined;

    expect('registration' in (envio?.properties ?? {})).toBe(true);
  });

  it('el detalle declara los campos personales y el 404 opaco', () => {
    const respuestas = document.paths[DETALLE]?.get?.responses as
      | Record<string, { readonly content?: Record<string, { readonly schema?: unknown }> }>
      | undefined;

    expect(
      respuestas?.['200']?.content?.['application/json']?.schema,
    ).toStrictEqual({ $ref: '#/components/schemas/AccessRequestReviewDetailDto' });
    expect(
      respuestas?.['404']?.content?.['application/json']?.schema,
    ).toStrictEqual({ $ref: '#/components/schemas/AccessRequestReviewErrorDto' });

    /*
     * El `404` es OPACO: idéntico para un identificador inexistente y para uno de
     * otra institución. Si las dos respuestas declararan motivos distintos, la
     * propia documentación enseñaría a un atacante a distinguir tenants.
     */
    const detalle = JSON.stringify(document.paths[DETALLE]?.get?.responses?.['404']);

    expect(detalle).toContain('idéntica para un identificador inexistente');
    expect(detalle).toContain('otra institución');
  });

  it('la decisión declara cuerpo cerrado, respuesta 200 y los conflictos', () => {
    const decision = JSON.stringify(document.paths[DECISION]?.post);

    // El cuerpo se documenta por referencia al DTO cerrado, no como un objeto libre.
    expect(decision).toContain('AccessRequestReviewDecisionRequestDto');
    expect(decision).toContain('AccessRequestReviewDecisionResponseDto');
    expect(decision).toContain('409');
    expect(decision).toContain('404');
    expect(decision).toContain('503');

    // Y los motivos vivían en un catálogo, nunca en texto libre.
    const cuerpo = JSON.stringify(
      document.components?.schemas?.['AccessRequestReviewDecisionRequestDto'],
    );
    expect(cuerpo).toContain('ACCESS_APPROVED');
    expect(cuerpo).toContain('ACCESS_REJECTED');
    expect(cuerpo).toContain('expectedVersion');
  });

  it('la provisión se documenta como SAGA y nunca como alta automática', () => {
    const decision = JSON.stringify(document.paths[DECISION]?.post);

    /*
     * MP03-C1 dejaba la aprobación PENDIENTE de provisión. MP04 ejecuta esa
     * provisión dentro de la misma decisión, en dos fases y con salida posible
     * a `PROVISIONING_FAILED`. Documentar «aprobar» como un alta instantánea
     * convertiría una saga —que puede no terminar— en una promesa de acceso ya
     * vigente.
     */
    expect(decision).toContain('APPROVED_PENDING_PROVISIONING');
    expect(decision).toContain('No se crea perfil, relación ni asignación');
    expect(decision).toContain('PROVISIONING_FAILED');
    expect(decision).not.toContain('alta automática');
    expect(decision).not.toContain('acceso concedido');
  });
});
