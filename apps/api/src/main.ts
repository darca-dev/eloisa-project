import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { EnvironmentValidationError, loadApiEnvironment } from './config/environment';
import { MalformedJsonFilter } from './patients/malformed-json.filter';
import { setupOpenApi } from './openapi/openapi';

/**
 * Punto de entrada de la API MERDN.
 *
 * El arranque valida la configuración antes de crear la aplicación y registra
 * únicamente información técnica no sensible.
 *
 * TASK-MVP-CORE-01 añade CORS con credenciales, restringido a los orígenes web
 * declarados por configuración: la sesión de inscripción viaja en una cookie
 * `HttpOnly` y un origen arbitrario nunca debe poder usarla.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('bootstrap');
  const environment = loadApiEnvironment(process.env);

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    // Límite explícito del cuerpo: una inscripción es pequeña y no hay razón
    // para aceptar cargas grandes en un endpoint público.
    bodyParser: true,
  });

  // No revelar el framework HTTP subyacente en las respuestas.
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.enableShutdownHooks();
  app.useGlobalFilters(new MalformedJsonFilter());

  app.enableCors({
    origin: [...environment.webOrigins],
    credentials: true,
    /*
     * TASK-HOSPITAL-CORE-02 anade `PATCH`, y solo `PATCH`: es el metodo de la
     * UNICA mutacion autorizada del slice. `PUT` y `DELETE` siguen fuera.
     */
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  });

  setupOpenApi(app, environment.openApiPath);

  await app.listen(environment.port, '0.0.0.0');

  logger.log(
    `API MERDN escuchando en el puerto ${environment.port} ` +
      `(entorno ${environment.merdnEnvironment}); OpenAPI en /${environment.openApiPath}`,
  );
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('bootstrap');

  if (error instanceof EnvironmentValidationError) {
    logger.error(error.message);
  } else if (error instanceof Error) {
    logger.error(`La API no pudo arrancar: ${error.message}`);
  } else {
    logger.error('La API no pudo arrancar por un error desconocido.');
  }

  process.exitCode = 1;
  process.exit(1);
});
