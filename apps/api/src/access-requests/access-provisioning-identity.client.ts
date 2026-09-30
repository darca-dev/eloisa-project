/**
 * Cliente administrativo de identidad para la provisión de cuentas
 * (SPEC 038, paquete MP04).
 *
 * RESPONSABILIDAD ÚNICA: hablar con la API administrativa del realm humano
 * local para preparar, activar y desactivar USUARIOS. No conoce Prisma, no
 * conoce la solicitud de acceso, no conoce el tenant y no decide nada: recibe
 * valores ya resueltos y devuelve resultados ya clasificados.
 *
 * QUÉ NO ES —y no debe crecer sin un paquete aprobado—:
 * - NO es el cliente de 027. `patients/keycloak-admin.client.ts` quedó en
 *   cuarentena documental y NO se importa, NO se extiende y NO se adapta aquí:
 *   este archivo lo reescribe desde cero con un alcance distinto, un realm
 *   distinto y sin PII en ningún mensaje.
 * - NO recibe nombre, documento, teléfono, correo, tenant ni perfil. El
 *   proveedor solo ve un username opaco, una contraseña, un estado `enabled` y
 *   un marcador de idempotencia: seis campos y ninguno personal.
 * - NO persiste, NO audita y NO decide estados. Toda escritura contra la base
 *   pertenece al servicio.
 *
 * SECRETO. La contraseña se recibe como argumento, se serializa EXACTAMENTE una
 * vez dentro del cuerpo enviado al proveedor y se descarta. No se copia a un
 * log, a una excepción, a un objeto de error, a una traza ni a un mensaje de
 * diagnóstico. Los mensajes de error de este módulo nombran una CAUSA y nunca
 * un cuerpo.
 *
 * REINTENTO. Máximo DOS intentos totales por operación, en un bucle y sin
 * recursión. Solo la red, el tiempo de espera y un `5xx` justifican el segundo
 * intento: un `4xx` es una respuesta, no un accidente, y repetirlo produce el
 * mismo rechazo con el doble de tráfico.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';

import {
  API_ENVIRONMENT,
  type ApiEnvironmentProvider,
} from '../config/api-environment.provider';
import { type AccessProvisioningConfig } from '../config/environment';

import {
  ACCESS_PROVISIONING_ERROR_CODES,
  ACCESS_PROVISIONING_MARKER_ATTRIBUTE,
  ACCESS_PROVISIONING_REQUEST_MAX_ATTEMPTS,
  ACCESS_PROVISIONING_REQUEST_TIMEOUT_MS,
  ACCESS_PROVISIONING_RETRY_BASE_BACKOFF_MS,
  ACCESS_PROVISIONING_USERNAME_SEARCH_MAX,
  type AccessProvisioningErrorCode,
} from './access-provisioning.contract';

/* -------------------------------------------------------------------------- */
/* Punto de inyección del backoff                                              */
/* -------------------------------------------------------------------------- */

/**
 * Espera entre intentos.
 *
 * Se declara como dependencia —y no como una llamada directa a `setTimeout`—
 * porque el backoff es exactamente lo que una prueba no debe ejecutar: dormir
 * medio segundo en cada caso de error multiplica la duración de la suite sin
 * añadir ninguna observación. Inyectar el tiempo hace que la prueba verifique
 * EL RETRASO pedido, no que lo sufra.
 */
export interface AccessProvisioningBackoff {
  wait(milliseconds: number): Promise<void>;
}

/** Token de inyección del backoff. Los tests lo sustituyen por un nulo. */
export const ACCESS_PROVISIONING_BACKOFF = Symbol('ACCESS_PROVISIONING_BACKOFF');

/** Implementación real: espera el tiempo indicado. */
@Injectable()
export class SystemAccessProvisioningBackoff implements AccessProvisioningBackoff {
  public async wait(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Error                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Fallo clasificado del proveedor.
 *
 * El `code` sale SIEMPRE del catálogo cerrado del contrato. El `message` es una
 * frase fija escrita aquí y jamás deriva de una respuesta: ni estado HTTP, ni
 * cuerpo, ni cabecera. Quien reciba este error sabe QUÉ clase de fallo fue, no
 * qué dijo el proveedor.
 */
export class AccessProvisioningIdentityError extends Error {
  public readonly code: AccessProvisioningErrorCode;

  constructor(code: AccessProvisioningErrorCode, message: string) {
    super(message);
    this.name = 'AccessProvisioningIdentityError';
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/* Resultados                                                                  */
/* -------------------------------------------------------------------------- */

/** Usuario localizado por username exacto. Solo trae lo que el vínculo necesita. */
export interface AccessProvisioningRemoteUser {
  /** ID real del usuario. Es el `sub` que se persiste. */
  readonly id: string;
  /** Marcador opaco declarado en la creación, o `null` si no lo lleva. */
  readonly marker: string | null;
}

/** Respuesta de la creación, ya despojada de todo lo demás. */
export interface AccessProvisioningCreatedUser {
  readonly id: string;
}

/* -------------------------------------------------------------------------- */
/* Cliente                                                                     */
/* -------------------------------------------------------------------------- */

/** Cuerpo del intercambio de token. Ningún campo se registra jamás. */
interface TokenResponse {
  readonly access_token?: unknown;
  readonly expires_in?: unknown;
}

@Injectable()
export class AccessProvisioningIdentityClient {
  private readonly config: AccessProvisioningConfig | undefined;
  private readonly backoff: AccessProvisioningBackoff;
  private cachedToken: { readonly value: string; readonly expiresAtMs: number } | null = null;

  constructor(
    @Inject(API_ENVIRONMENT) environment: ApiEnvironmentProvider,
    @Optional() @Inject(ACCESS_PROVISIONING_BACKOFF)
    backoff?: AccessProvisioningBackoff,
  ) {
    this.config = environment.accessProvisioning;
    this.backoff = backoff ?? new SystemAccessProvisioningBackoff();
  }

  /* ---------------------------------------------------------------------- */
  /* API pública                                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * Busca un usuario por username EXACTO.
   *
   * Devuelve `null` si no existe. Devuelve un error `identityNotFound` si la
   * búsqueda encuentra más de un usuario: con `max = 2`, dos filas significan
   * que el proveedor devolvió algo que la unicidad de username debería impedir,
   * y elegir una de las dos sería decidir a ciegas cuál de ellas es la que
   * corresponde.
   */
  public async findUserByUsername(username: string): Promise<AccessProvisioningRemoteUser | null> {
    const query = new URLSearchParams({
      username,
      exact: 'true',
      max: String(ACCESS_PROVISIONING_USERNAME_SEARCH_MAX),
    });

    const ruta = `/users?${query.toString()}`;
    const registros = await this.requestJson<readonly unknown[]>('GET', ruta);

    if (!Array.isArray(registros)) {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.unavailable,
        'La administración de identidad devolvió una respuesta inesperada.',
      );
    }

    if (registros.length === 0) {
      return null;
    }

    if (registros.length > 1) {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.identityCollision,
        'La búsqueda de identidad devolvió más de un usuario.',
      );
    }

    const unico = registros[0];
    const id = extraerId(unico);
    const marker = extraerMarcador(unico);

    if (id === null) {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.unavailable,
        'La administración de identidad devolvió un usuario sin identificador.',
      );
    }

    return { id, marker };
  }

  /**
   * Crea un usuario DESHABILITADO con su contraseña y su marcador de idempotencia.
   *
   * IDEMPOTENCIA DE UN `409`: un username ya existente NO se trata como éxito
   * por el mero hecho de existir. Se vuelve a buscar por username exacto y solo
   * se acepta si devuelve UN usuario y ese usuario declara el marcador de ESTA
   * solicitud. Cualquier otra colisión —marcador distinto, marcador ausente,
   * varios usuarios— falla cerrada con `identityCollision`: convertir en
   * éxito una colisión que no se puede atribuir sería aprovisionar una cuenta
   * sobre una identidad que quizá pertenece a otra solicitud.
   *
   * @param marker Identificador interno de la solicitud. Opaco y sin PII.
   * @param password Contraseña ficticia. Se serializa UNA vez y se descarta.
   */
  public async createDisabledUser(input: {
    readonly username: string;
    readonly marker: string;
    readonly password: string;
  }): Promise<AccessProvisioningCreatedUser> {
    const cuerpo = JSON.stringify({
      username: input.username,
      enabled: false,
      credentials: [{ type: 'password', value: input.password, temporary: false }],
      attributes: { [ACCESS_PROVISIONING_MARKER_ATTRIBUTE]: [input.marker] },
    });

    const estado = await this.requestStatus('POST', '/users', cuerpo);

    if (estado === 201) {
      // El `Location` identifica al usuario creado. Se busca por username en
      // lugar de confiar en la cabecera: la cabecera es optativa en el
      // proveedor y una creación sin ella no debe ser un fallo.
      const creado = await this.findUserByUsername(input.username);

      if (creado === null) {
        throw new AccessProvisioningIdentityError(
          ACCESS_PROVISIONING_ERROR_CODES.unavailable,
          'La creación de identidad no pudo confirmarse.',
        );
      }

      return { id: creado.id };
    }

    if (estado !== 409) {
      throw this.fromStatus(estado);
    }

    const existente = await this.findUserByUsername(input.username);

    if (existente === null || existente.marker !== input.marker) {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.identityCollision,
        'El identificador solicitado ya existe y no corresponde a esta solicitud.',
      );
    }

    return { id: existente.id };
  }

  /**
   * Fija la contraseña de un usuario existente.
   *
   * Se usa cuando la identidad ya fue creada en un intento anterior pero su
   * credencial no llegó a establecerse. El valor se serializa una sola vez.
   */
  public async setPassword(userId: string, password: string): Promise<void> {
    const cuerpo = JSON.stringify({ type: 'password', value: password, temporary: false });
    const estado = await this.requestStatus(
      'PUT',
      `/users/${encodeURIComponent(userId)}/reset-password`,
      cuerpo,
    );

    if (estado !== 204) {
      throw this.fromStatus(estado);
    }
  }

  /**
   * Habilita o deshabilita un usuario.
   *
   * Se LEE el usuario y se ESCRIBE la representación completa con un único
   * campo cambiado. Enviar solo `{"enabled": …}` borraría el resto de campos en
   * los proveedores que interpretan la actualización como reemplazo, y perder el
   * marcador de idempotencia en un `SUSPEND` dejaría a la solicitud sin la prueba
   * que su propia colisión exige.
   */
  public async setEnabled(userId: string, enabled: boolean): Promise<void> {
    const ruta = `/users/${encodeURIComponent(userId)}`;
    const actual = await this.requestJson<Record<string, unknown>>('GET', ruta);

    if (actual === null || typeof actual !== 'object') {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.unavailable,
        'La administración de identidad devolvió una respuesta inesperada.',
      );
    }

    const cuerpo = JSON.stringify({ ...actual, enabled });
    const estado = await this.requestStatus('PUT', ruta, cuerpo);

    if (estado !== 204) {
      throw this.fromStatus(estado);
    }
  }

  /**
   * Lee el `id` real de un usuario.
   *
   * Existe porque la saga debe poder confirmar, después de una relectura, que
   * la identidad sigue existiendo antes de escribir el vínculo. Un usuario
   * ausente es `identityNotFound`, no un `null` silencioso.
   */
  public async getUser(userId: string): Promise<AccessProvisioningRemoteUser> {
    const ruta = `/users/${encodeURIComponent(userId)}`;
    const registro = await this.requestJson<Record<string, unknown>>('GET', ruta);
    const id = extraerId(registro);

    if (id === null) {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.identityNotFound,
        'La identidad esperada no existe en el proveedor.',
      );
    }

    return { id, marker: extraerMarcador(registro) };
  }

  /* ---------------------------------------------------------------------- */
  /* Transporte                                                              */
  /* ---------------------------------------------------------------------- */

  /** URL administrativa base para el realm configurado. */
  private adminBase(): string {
    if (this.config === undefined) {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.notConfigured,
        'La provisión de identidad no está configurada en este despliegue.',
      );
    }

    return `${this.config.adminUrl}/admin/realms/${this.config.realm}`;
  }

  /** Lee y cachea el token administrativo del PROPIO realm. */
  private async adminToken(): Promise<string> {
    if (this.config === undefined) {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.notConfigured,
        'La provisión de identidad no está configurada en este despliegue.',
      );
    }

    const ahora = Date.now();

    if (this.cachedToken !== null && this.cachedToken.expiresAtMs > ahora) {
      return this.cachedToken.value;
    }

    const url = new URL(
      `/realms/${this.config.realm}/protocol/openid-connect/token`,
      this.config.adminUrl,
    );

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    }).toString();

    const respuesta = await this.requestRaw('POST', url, body, false);

    if (respuesta.status !== 200) {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.unauthorized,
        'No fue posible obtener la autorización administrativa.',
      );
    }

    let datos: TokenResponse;
    try {
      datos = (await respuesta.json()) as TokenResponse;
    } catch {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.unavailable,
        'La administración de identidad devolvió una respuesta inesperada.',
      );
    }

    if (typeof datos.access_token !== 'string') {
      throw new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.unauthorized,
        'No fue posible obtener la autorización administrativa.',
      );
    }

    /*
     * El token se cachea con un margen de 30 s. El margen existe porque el
     * token se usa al empezar una operación, no a mitad de ella: una caducidad
     * justo entre dos llamadas de la misma saga produciría un `401` clasificado
     * como `unauthorized` cuando el problema fue solo de tiempo.
     */
    const ttl =
      typeof datos.expires_in === 'number' && Number.isFinite(datos.expires_in)
        ? datos.expires_in
        : 60;

    this.cachedToken = {
      value: datos.access_token,
      expiresAtMs: ahora + Math.max(0, ttl - 30) * 1_000,
    };

    return datos.access_token;
  }

  /** GET/POST/PUT contra la API administrativa, con `token` por defecto. */
  private async requestJson<T>(method: 'GET' | 'POST' | 'PUT', ruta: string): Promise<T> {
    const respuesta = await this.requestWithAuth(method, ruta, undefined);
    return (await respuesta.json()) as T;
  }

  /** Como `requestJson`, pero devolviendo solo el estado. */
  private async requestStatus(
    method: 'GET' | 'POST' | 'PUT',
    ruta: string,
    cuerpo: string | undefined,
  ): Promise<number> {
    const respuesta = await this.requestWithAuth(method, ruta, cuerpo);
    return respuesta.status;
  }

  private async requestWithAuth(
    method: 'GET' | 'POST' | 'PUT',
    ruta: string,
    cuerpo: string | undefined,
  ): Promise<Response> {
    const token = await this.adminToken();
    /*
     * Concatenación y NO `new URL(ruta, base)`: `ruta` empieza por `/` y una
     * referencia de ese tipo descarta el camino de la base, con lo que
     * `/admin/realms/<realm>` se perdería entero y la petición terminaría en la
     * raíz del proveedor. Con la concatenación el camino es siempre el esperado
     * y `ruta` ya llega codificada desde `URLSearchParams`.
     */
    const url = new URL(`${this.adminBase()}${ruta}`);

    return this.requestRaw(method, url, cuerpo, true, token);
  }

  /**
   * Petición con timeout, reintento acotado y sin recursión.
   *
   * `retryable` se desactiva para el intercambio de token porque ese intercambio
   * YA tiene su propia clasificación: reintentarlo aquí convertiría un
   * `401` de credenciales en dos llamadas y en un código menos preciso.
   */
  private async requestRaw(
    method: 'GET' | 'POST' | 'PUT',
    url: URL,
    cuerpo: string | undefined,
    retryable: boolean,
    token?: string,
  ): Promise<Response> {
    let ultimoNoRecuperable: AccessProvisioningIdentityError | null = null;

    for (let intento = 1; intento <= ACCESS_PROVISIONING_REQUEST_MAX_ATTEMPTS; intento += 1) {
      try {
        const respuesta = await this.dispatch(method, url, cuerpo, token);

        if (!retryable || respuesta.status < 500 || intento === ACCESS_PROVISIONING_REQUEST_MAX_ATTEMPTS) {
          return respuesta;
        }

        ultimoNoRecuperable = null;
      } catch {
        // Timeout, DNS, TLS, conexión rechazada: siempre red. El objeto del
        // error no aporta nada recuperable: sólo su EXISTENCIA importa aquí.
        const fallo = new AccessProvisioningIdentityError(
          ACCESS_PROVISIONING_ERROR_CODES.unavailable,
          'No fue posible contactar con la administración de identidad.',
        );

        if (!retryable || intento === ACCESS_PROVISIONING_REQUEST_MAX_ATTEMPTS) {
          throw fallo;
        }

        ultimoNoRecuperable = fallo;
      }

      await this.backoff.wait(
        ACCESS_PROVISIONING_RETRY_BASE_BACKOFF_MS * 2 ** (intento - 1),
      );
    }

    /* Inalcanzable: el bucle retorna o lanza en cada iteración. */
    throw ultimoNoRecuperable ?? new Error('bucle de provisión de identidad agotado');
  }

  private async dispatch(
    method: 'GET' | 'POST' | 'PUT',
    url: URL,
    cuerpo: string | undefined,
    token?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {};

    if (token !== undefined) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (cuerpo !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(url, {
      method,
      headers,
      ...(cuerpo === undefined ? {} : { body: cuerpo }),
      signal: AbortSignal.timeout(ACCESS_PROVISIONING_REQUEST_TIMEOUT_MS),
      redirect: 'error',
    });
  }

  /**
   * Clasifica un estado HTTP inesperado.
   *
   * El mensaje es FRASE FIJA. Ni el estado, ni el cuerpo, ni la cabecera
   * viajan: un error que citara lo que el proveedor respondió acabaría en un
   * log, y una respuesta del proveedor puede contener el username, el realm y
   * los identificadores de la petición.
   */
  private fromStatus(status: number): AccessProvisioningIdentityError {
    if (status === 401 || status === 403) {
      return new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.unauthorized,
        'La autorización administrativa fue rechazada.',
      );
    }

    if (status === 404) {
      return new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.identityNotFound,
        'La identidad esperada no existe en el proveedor.',
      );
    }

    if (status === 409) {
      return new AccessProvisioningIdentityError(
        ACCESS_PROVISIONING_ERROR_CODES.identityCollision,
        'El identificador solicitado ya existe.',
      );
    }

    return new AccessProvisioningIdentityError(
      ACCESS_PROVISIONING_ERROR_CODES.unavailable,
      'La administración de identidad no pudo procesar la operación.',
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Lectura defensiva de la respuesta                                           */
/* -------------------------------------------------------------------------- */

function extraerId(registro: unknown): string | null {
  if (typeof registro !== 'object' || registro === null) {
    return null;
  }

  const id = (registro as { readonly id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Lee el marcador de idempotencia.
 *
 * El proveedor devuelve los atributos como un mapa de arrays de texto. Un
 * marcador con más de un elemento NO se interpreta: se devuelve `null`, que es
 * «no hay marcador utilizable», y una creación posterior chocará en su propia
 * comprobación de colisión en lugar de elegir uno de los valores.
 */
function extraerMarcador(registro: unknown): string | null {
  if (typeof registro !== 'object' || registro === null) {
    return null;
  }

  const attributes = (registro as { readonly attributes?: unknown }).attributes;

  if (typeof attributes !== 'object' || attributes === null) {
    return null;
  }

  const valor = (attributes as Record<string, unknown>)[ACCESS_PROVISIONING_MARKER_ATTRIBUTE];

  if (!Array.isArray(valor) || valor.length !== 1 || typeof valor[0] !== 'string') {
    return null;
  }

  return valor[0];
}
