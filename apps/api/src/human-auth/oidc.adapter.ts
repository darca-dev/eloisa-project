import { Injectable, Logger } from '@nestjs/common';
import * as client from 'openid-client';

import {
  HUMAN_AUTH_ALLOWED_ALGORITHM,
  HUMAN_AUTH_SCOPE,
} from './human-auth.contract';
import { type HumanOidcConfig } from './human-auth.config';
import { FRESH_AUTHENTICATION_SECONDS, verifiedFreshAuthenticationTime } from './fresh-authentication';

/**
 * ÚNICO adapter de autenticación de MERDN (AD-01).
 *
 * Implementa OIDC / OAuth 2.0 Authorization Code con PKCE S256 contra UN solo
 * proveedor, identificado por su issuer exacto. El proveedor local aprobado es
 * Keycloak; Entra External ID será ESTE MISMO adapter con otro issuer, otro
 * cliente y otra configuración, sin cambiar dominio, sesión ni autorización.
 *
 * NO existe segundo adapter, `dev-login`, cabecera de identidad, JWT sin firma,
 * contraseña MERDN, sesión manual ni repliegue. Si discovery, JWKS o el
 * proveedor fallan, el acceso falla CERRADO: `null`, nunca una identidad
 * parcialmente verificada.
 *
 * LO QUE DEVUELVE, y nada más:
 *
 * ```ts
 * type VerifiedExternalIdentity = { issuer: string; subject: string }
 * ```
 *
 * NO devuelve ni confía correo, nombre, documento, teléfono, tenant, roles,
 * grupos ni ningún otro claim. Copiarlos crearía una segunda fuente de identidad
 * que competiría con `Person`, y aceptarlos convertiría al proveedor en
 * autoridad sobre la autorización de MERDN, que es precisamente lo que este
 * diseño impide.
 *
 * VALIDACIÓN DELEGADA, DELIBERADAMENTE: la verificación criptográfica la ejecuta
 * `openid-client`, que comprueba en el intercambio el `state`, el `nonce`, la
 * firma y el `kid` contra JWKS, el emisor exacto, la audiencia, `exp`, `nbf` y
 * el algoritmo fijado. Reimplementar a mano JWS y JWKS sería reescribir código
 * criptográfico sensible sin necesidad.
 */

/** Identidad externa verificada. Es lo ÚNICO que sale de este adapter. */
export interface VerifiedExternalIdentity {
  readonly issuer: string;
  readonly subject: string;
  readonly authenticatedAt?: Date;
}

/** Material de un intento en curso. El verifier NUNCA sale del servidor. */
export interface AuthorizationRequest {
  /** URL de autorización a la que redirigir el navegador. */
  readonly authorizationUrl: string;
  readonly state: string;
  readonly codeVerifier: string;
}

/** Comprobaciones que el callback debe satisfacer, recuperadas del intento. */
export interface CallbackChecks {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  /** From the persisted step-up attempt; never from request parameters. */
  readonly freshAuthenticationRequestedAt?: Date;
}

@Injectable()
export class OidcAdapter {
  private readonly logger = new Logger(OidcAdapter.name);

  /** Descubrimiento en curso o resuelto. Se reintenta si falló. */
  private discovered: Promise<client.Configuration> | null = null;

  constructor(private readonly config: HumanOidcConfig) {}

  /**
   * Resuelve la configuración del proveedor por discovery.
   *
   * `openid-client` comprueba que el `issuer` publicado por el documento de
   * descubrimiento coincide EXACTAMENTE con el solicitado: un proveedor que
   * anuncie otro emisor se rechaza en lugar de aceptarse.
   *
   * Un fallo NO queda memorizado: el siguiente intento vuelve a probarlo. Un
   * proveedor caído no debe convertirse en una caída permanente del módulo,
   * pero tampoco en un acceso concedido.
   */
  private async configuration(): Promise<client.Configuration> {
    if (this.discovered !== null) {
      return this.discovered;
    }

    const attempt = client
      .discovery(
        new URL(this.config.issuer),
        this.config.clientId,
        {
          /*
           * Cliente PÚBLICO: no hay secreto de cliente que custodiar en el
           * navegador ni en el servidor. La prueba de posesión la aporta PKCE.
           */
          token_endpoint_auth_method: 'none',
          /*
           * ALGORITMO FIJADO. Sin esto, el proveedor podría anunciar y usar
           * otro algoritmo —incluido uno simétrico— y la verificación seguiría
           * pareciendo correcta.
           */
          id_token_signed_response_alg: HUMAN_AUTH_ALLOWED_ALGORITHM,
        },
        client.None(),
        {
          // Falla CERRADO: un proveedor que no responde a tiempo no autentica.
          timeout: this.config.requestTimeoutMs / 1000,
          /*
           * `http://` SOLO cuando la configuración ya demostró que el entorno es
           * `development` o `test` y el host es bucle local o el nombre Docker
           * aprobado. Fuera de ahí el arranque ya habría fallado.
           */
          ...(this.config.insecureLocalIssuer
            ? { execute: [client.allowInsecureRequests] }
            : {}),
        },
      )
      .catch((error: unknown) => {
        this.discovered = null;
        // Solo el NOMBRE del error: el mensaje puede describir la topología.
        this.logger.error(
          error instanceof Error
            ? `No fue posible resolver el proveedor de identidad: ${error.name}.`
            : 'No fue posible resolver el proveedor de identidad.',
        );

        throw error;
      });

    this.discovered = attempt;

    return attempt;
  }

  /**
   * Construye la petición de autorización con PKCE S256, `state` y `nonce`.
   *
   * `state` y el verifier PKCE se generan aquí con el generador criptográfico
   * del propio cliente OIDC. El `nonce` lo aporta el llamador porque él es quien
   * puede RECALCULARLO en el callback: §4.3 exige guardarlo hasheado, y un hash
   * no se deshace.
   *
   * `state` se devuelve para persistirlo HASHEADO y el verifier para
   * persistirlo CIFRADO. Ninguno de los tres viaja al navegador.
   */
  public async buildAuthorizationRequest(nonce: string, requireFreshAuthentication = false): Promise<AuthorizationRequest> {
    const configuration = await this.configuration();

    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();

    const authorizationUrl = client.buildAuthorizationUrl(configuration, {
      // URI de retorno EXACTA de la configuración: nunca derivada de la
      // petición, cuyo `Host` puede ser hostil.
      redirect_uri: this.config.callbackUri,
      scope: HUMAN_AUTH_SCOPE,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
      ...(requireFreshAuthentication ? { max_age: '0', prompt: 'login' } : {}),
    });

    return {
      authorizationUrl: authorizationUrl.href,
      state,
      codeVerifier,
    };
  }

  /**
   * Intercambia el código y verifica el ID token.
   *
   * `currentUrl` se construye SIEMPRE sobre la URI de retorno configurada, a la
   * que solo se copian los parámetros recibidos. Derivarla del `Host` de la
   * petición permitiría que una cabecera hostil cambiara el `redirect_uri` que
   * se envía al token endpoint.
   *
   * Devuelve `null` ante CUALQUIER fallo —código ausente, reutilizado o
   * manipulado; `state` o `nonce` que no coinciden; verifier PKCE incorrecto;
   * firma, `kid`, emisor, audiencia, algoritmo, `exp` o `nbf` inválidos; JWKS
   * inalcanzable; error del proveedor—. El llamador no puede distinguir cuál
   * ocurrió, y esa indistinguibilidad es intencionada.
   *
   * Los tokens OIDC NO se devuelven, NO se persisten y NO se registran: en
   * cuanto se extraen `iss` y `sub`, se descartan con el resto de la respuesta.
   */
  public async exchangeAndVerify(
    receivedParameters: URLSearchParams,
    checks: CallbackChecks,
  ): Promise<VerifiedExternalIdentity | null> {
    let configuration: client.Configuration;

    try {
      configuration = await this.configuration();
    } catch {
      // Ya registrado en `configuration()`. Fail-closed.
      return null;
    }

    const currentUrl = new URL(this.config.callbackUri);
    currentUrl.search = receivedParameters.toString();

    try {
      const tokens = await client.authorizationCodeGrant(
        configuration,
        currentUrl,
        {
          expectedState: checks.state,
          expectedNonce: checks.nonce,
          pkceCodeVerifier: checks.codeVerifier,
          idTokenExpected: true,
          ...(checks.freshAuthenticationRequestedAt === undefined ? {} : { maxAge: FRESH_AUTHENTICATION_SECONDS }),
        },
        // `redirect_uri` explícito: el token endpoint debe recibir exactamente
        // el mismo valor que se envió en la autorización.
        { redirect_uri: this.config.callbackUri },
      );

      const claims = tokens.claims();

      if (claims === undefined) {
        return null;
      }

      const { iss, sub } = claims;

      if (typeof iss !== 'string' || typeof sub !== 'string') {
        return null;
      }

      /*
       * Comprobación REDUNDANTE del emisor, y deliberadamente conservada. La
       * biblioteca ya lo verifica; el aislamiento de identidad no debe depender
       * de una sola capa, y el valor comparado es el que se persistirá.
       */
      if (iss.replace(/\/+$/u, '') !== this.config.issuer) {
        return null;
      }

      if (sub.length === 0 || sub.length > 255) {
        return null;
      }

      if (checks.freshAuthenticationRequestedAt !== undefined) {
        const authenticatedAt = verifiedFreshAuthenticationTime(claims.auth_time, checks.freshAuthenticationRequestedAt, new Date());
        if (authenticatedAt === null) return null;
        return { issuer: this.config.issuer, subject: sub, authenticatedAt };
      }
      return { issuer: this.config.issuer, subject: sub };
    } catch (error) {
      /*
       * Solo el NOMBRE del error. El mensaje de un fallo OIDC puede contener el
       * código de autorización, el `state` o fragmentos del token, y ninguno de
       * los tres puede acabar en un registro.
       */
      this.logger.warn(
        error instanceof Error
          ? `El intercambio OIDC no se completó: ${error.name}.`
          : 'El intercambio OIDC no se completó.',
      );

      return null;
    }
  }
}
