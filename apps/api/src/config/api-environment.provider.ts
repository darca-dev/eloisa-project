import { type Provider } from '@nestjs/common';

import { type ApiEnvironment, loadApiEnvironment } from './environment';

/**
 * Token de inyección de la configuración de la API.
 *
 * Se declara como token explícito —y no como clase— porque la configuración es
 * un valor inmutable derivado del entorno, no un servicio con comportamiento.
 * La inyección explícita evita depender de `emitDecoratorMetadata` en pruebas.
 */
export const API_ENVIRONMENT = Symbol('API_ENVIRONMENT');

export type ApiEnvironmentProvider = ApiEnvironment;

/**
 * Proveedor global de configuración. Valida el entorno una sola vez por
 * proceso; un valor inválido detiene el arranque con un error que nombra la
 * variable pero nunca su valor.
 */
export const apiEnvironmentProvider: Provider = {
  provide: API_ENVIRONMENT,
  useFactory: (): ApiEnvironment => loadApiEnvironment(process.env),
};
