import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Documento OpenAPI de la API MERDN (TASK-001 FR-08; ampliado por
 * TASK-MVP-CORE-01 §13.11, TASK-HOSPITAL-CORE-01 §15,
 * TASK-HOSPITAL-CORE-02 §6 y VISITS-CORE-01 MP04).
 *
 * El documento describe exactamente la superficie implementada. No declara
 * endpoints, esquemas ni mecanismos de seguridad que no existan, y sus ejemplos
 * usan únicamente datos ficticios.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('MERDN API')
    .setDescription(
      'API MERDN. Expone el endpoint técnico GET /health, la rama Paciente de la ' +
        'inscripción —creación transaccional y recuperación mediante la sesión de ' +
        'inscripción—, la superficie municipal AGREGADA de Alcaldía, la superficie ' +
        'Hospital de Pacientes —de solo lectura y minimizada— y la superficie Hospital de ' +
        'Operaciones: directorio de profesionales, agenda de una ventana declarada y UNA ' +
        'sola mutación, que asigna una solicitud existente a un profesional existente. Las ' +
        'superficies institucionales comparten UNA identidad y UNA sesión con TRES roles ' +
        'disjuntos: consulta municipal agregada, consulta hospitalaria de Pacientes y agenda ' +
        'hospitalaria. El tenant institucional se resuelve siempre en el servidor y nunca se ' +
        'acepta desde el cliente. No implementa autenticación completa, el sistema completo ' +
        'de usuarios y roles, identidad individual de personas trabajadoras, disponibilidad ' +
        'ni turnos, reprogramación, rechazo o cancelación de citas, alta de profesionales, ' +
        'consultas virtuales, cuidadores, programas, condiciones ' +
        'clínicas, alertas, semaforización, finanzas, membresías, reportes, exportación, ' +
        'acceso municipal a personas concretas ni el sistema completo de auditoría. ' +
        'Expone además el núcleo compartido de identidad HUMANA: un único flujo OIDC ' +
        'Authorization Code con PKCE S256 que autentica a una persona y resuelve en el ' +
        'servidor sus contextos disponibles, y la gestión de la relación Paciente–Cuidador ' +
        'con finalidad, vigencia y un alcance único de SOLO LECTURA sobre visitas. Esa ' +
        'relación es una autorización OPERATIVA declarada por un operador institucional en un ' +
        'MVP controlado: NO es representación legal, NO es tutela, NO es parentesco, NO ' +
        'acredita la identidad de la persona cuidadora y NO concede acceso clínico ni ' +
        'exportación. Expone además la superficie de VISITAS DOMICILIARIAS: la ' +
        'materialización institucional de una cita HOME ya ASSIGNED, la consulta de UNA visita ' +
        'por la profesional asignada y vigente, y las tres transiciones profesionales ' +
        '—iniciar, completar y dar por no realizada—, con control optimista de versión, ' +
        'historial append-only y auditoría atómica. Esa superficie NO ofrece listado de ' +
        'visitas, superficie de cuidador o de paciente, notas, evidencia, dirección, GPS, ' +
        'archivos, reapertura ni cancelación, y el permiso de lectura de la relación ' +
        'Paciente–Cuidador todavía NO tiene endpoint que lo consuma.',
    )
    .setVersion('0.5.0')
    .addCookieAuth(
      'merdn_enrollment_session',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'merdn_enrollment_session',
        description:
          'Sesión de inscripción emitida al crear la inscripción. Cookie HttpOnly con ' +
          'expiración limitada; el token en claro nunca se persiste ni se registra.',
      },
      'enrollmentSession',
    )
    .addCookieAuth(
      'merdn_institutional_session',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'merdn_institutional_session',
        description:
          'Sesión institucional emitida al abrirla con la credencial aprovisionada por ' +
          'configuración del servidor. Cookie HttpOnly con expiración limitada; el token ' +
          'en claro nunca se persiste ni se registra. Por sí sola NO concede acceso a ' +
          'ninguna superficie: cada dominio exige además su rol exacto, de modo que una ' +
          'sesión municipal recibe 403 en Hospital y una sesión hospitalaria recibe 403 en ' +
          'Municipality. Los roles hospitalarios también son disjuntos entre sí: la consulta ' +
          'de Pacientes es de SOLO LECTURA y no asigna, y la agenda no accede a Pacientes. ' +
          'La cookie de autoinscripción de paciente no la sustituye.',
      },
      'institutionalSession',
    )
    .addCookieAuth(
      'merdn_human_session',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'merdn_human_session',
        description:
          'Sesión HUMANA emitida al completar el flujo OIDC. Cookie HttpOnly con vigencia ' +
          'absoluta de 8 horas, inactividad máxima de 30 minutos y un máximo de UNA sesión ' +
          'activa por cuenta: un inicio de sesión nuevo revoca el anterior. El token en claro ' +
          'nunca se persiste ni se registra, y no se guarda ningún token OIDC. Es DISTINTA de ' +
          'la cookie de autoinscripción y de la institucional, y ninguna de las tres sustituye ' +
          'a las otras: presentarlas juntas no elige un principal ambiguo, porque cada ' +
          'superficie lee exclusivamente la suya. Por sí sola NO concede acceso a ningún ' +
          'recurso: cada operación vuelve a evaluar perfil, afiliación, asignación y relación.',
      },
      'humanSession',
    )
    .build();

  return SwaggerModule.createDocument(app, config);
}

/**
 * Publica la documentación OpenAPI en la ruta indicada.
 *
 * Uso previsto: desarrollo local. La exposición pública de la documentación en
 * un entorno accesible requiere una decisión y configuración separadas.
 */
export function setupOpenApi(app: INestApplication, path: string): OpenAPIObject {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup(path, app, document);
  return document;
}
