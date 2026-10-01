# Proveedor OIDC local (desarrollo)

IDENTITY-RELATIONSHIPS-CORE-01 §4.1. Keycloak `26.7.1` como contenedor local
**desechable**, publicado únicamente en `127.0.0.1`, para poder implementar,
ejecutar y probar el flujo OIDC **sin Entra y sin red externa**.

Esto **no** es infraestructura de despliegue. No hay TLS, no hay respaldos, no
hay endurecimiento y no hay datos reales.

## Qué contiene

- `realm-merdn-local.json` — realm `merdn-local` con:

  - el cliente **público** `merdn-human-web`, con PKCE S256 obligatorio, sin
    comodines en redirect ni en origen web, y con Direct Access Grants
    desactivados: el único camino de una persona es Authorization Code;
  - el cliente **confidencial** `merdn-access-provisioning` (SPEC 038, MP04),
    con service account y rol `manage-users` de `realm-management`;
  - dos personas **ficticias** con `sub` estable.

- `realm-merdn-patient.json` — realm `merdn-patient` separado (Spec 027).

Sin secretos versionados: el cliente humano es público y no tiene secreto, y
las contraseñas se sustituyen en el arranque desde `.env`, que Git ignora. El
único secreto del cliente de provision **también** vive en `.env` y se entrega
por interpolación, igual que las contraseñas.

## Arranque

El servicio es **opt-in**: no se levanta con `docker compose up` normal.

```bash
# 1. Defina en `.env` (ignorado por Git) los TRES valores locales ficticios:
#      MERDN_OIDC_LOCAL_ADMIN_PASSWORD=...
#      MERDN_OIDC_LOCAL_TEST_PASSWORD=...
#      MERDN_ACCESS_PROVISIONING_CLIENT_SECRET=...
#    Ninguno es un secreto real y ninguno debe reutilizarse fuera de local.
#    El tercero lo exigen a la vez el perfil `oidc-local` y el servicio `api`:
#    deben recibir el MISMO valor.

# 2. Levante el proveedor con su perfil.
docker compose --profile oidc-local up -d oidc-local

# 3. Compruebe el descubrimiento desde las DOS redes (ver más abajo).
curl -s http://host.docker.internal:8081/realms/merdn-local/.well-known/openid-configuration
```

Para retirarlo: `docker compose --profile oidc-local down`.

> El realm se importa **solo en la primera creación** del contenedor. Si edita
> `realm-merdn-local.json`, haga `docker compose --profile oidc-local up -d
> --force-recreate oidc-local` para que vuelva a importar: el arranque usa la
> base efímera de `start-dev`, de modo que recrear el contenedor no conserva
> nada.

## Topología y emisor canónico

El emisor canónico es:

```
http://host.docker.internal:8081/realms/merdn-local
```

`KC_HOSTNAME` fija ese valor, de modo que Keycloak lo anuncia siempre igual
independientemente de por dónde se le llegue. Eso importa porque el navegador y
la API deben resolver **el mismo** emisor: si cada uno viera uno distinto, la
comparación exacta del `iss` del ID token fallaría.

**Topología soportada: la API se ejecuta DENTRO de Compose.** Es la razón de que
el emisor no sea `127.0.0.1`: dentro del contenedor de la API, `127.0.0.1`
apunta a la propia API y no al proveedor, de modo que un emisor de bucle local
sería inalcanzable justo donde se verifica el ID token.

`host.docker.internal` resuelve a la máquina anfitriona desde el contenedor y
también desde el navegador del anfitrión, así que las dos partes alcanzan el
mismo emisor. El servicio `api` declara además

```yaml
extra_hosts:
  - 'host.docker.internal:host-gateway'
```

para los motores de Docker que no proveen ese nombre por sí mismos.

El puerto se sigue publicando **solo en `127.0.0.1`**, la URI de retorno sigue
siendo exacta —`http://127.0.0.1:3001/api/v1/human-auth/callback`— y el origen
web sigue siendo exacto —`http://127.0.0.1:3000`—. La API sigue **rechazando al
arrancar** este emisor, y cualquier emisor HTTP, fuera de `development` y
`test`.

Ejecutar la API en el **anfitrión** (`npm run dev:api`, o la suite de pruebas)
funciona con el mismo emisor sin cambiar nada: `host.docker.internal` también
resuelve allí.

### Las dos comprobaciones canónicas de descubrimiento

Ambas deben responder `200` y anunciar **el mismo** `issuer`. Comprobar solo una
de las dos es exactamente el error que esta topología corrige.

Sea `DISCOVERY` el documento de descubrimiento del emisor canónico:

```
http://host.docker.internal:8081/realms/merdn-local/.well-known/openid-configuration
```

```bash
# 1. Desde el ANFITRIÓN, igual que lo hará el navegador.
curl -s "$DISCOVERY" | node -e "let b='';process.stdin.on('data',c=>b+=c).on('end',()=>process.stdout.write(JSON.parse(b).issuer))"

# 2. Desde DENTRO del contenedor de la API, que es quien verifica el ID token.
docker compose exec -T api node -e "fetch(process.argv[1]).then(async(r)=>{const d=await r.json();process.stdout.write(r.status+' '+d.issuer)})" "$DISCOVERY"

# 3. JWKS, alcanzable desde las dos redes.
curl -s -o /dev/null -w '%{http_code}' http://host.docker.internal:8081/realms/merdn-local/protocol/openid-connect/certs
```

## Personas ficticias

| Usuario                | `sub` (estable)                        | Para qué |
| ---------------------- | -------------------------------------- | -------- |
| `persona.ficticia`     | `00000000-0000-4000-8000-00000000f1c7` | Persona **vinculada** por el provisioning. |
| `persona.sin.vinculo`  | `00000000-0000-4000-8000-00000000f1c8` | Persona **no aprovisionada**: comprueba que un `sub` verificado sin vínculo no crea cuenta. |

Los dos `sub` son fijos para que el provisioning pueda vincularlos de forma
reproducible entre arranques.

**Ningún claim de estas personas llega al dominio de MERDN.** El adapter
devuelve exclusivamente `issuer` y `subject`. Cambiar aquí el correo, el nombre
o el usuario no cambia el vínculo ni la identidad en MERDN, que es exactamente
la propiedad que AD-02 busca.

## Cliente de provision (SPEC 038, MP04)

`merdn-access-provisioning` es un cliente **confidencial de servicio**: la API
pide un token administrativo con `client_credentials` y con él prepara y
aprovisiona cuentas ficticias de personas.

| Propiedad | Valor | Por qué |
| --- | --- | --- |
| `publicClient` | `false` | Lleva secreto. |
| `serviceAccountsEnabled` | `true` | Es la única fuente de token. |
| `standardFlowEnabled` | `false` | No inicia sesión ninguna persona. |
| `directAccessGrantsEnabled` | `false` | Prohibido por contrato. |
| `redirectUris` / `webOrigins` | `[]` | No es una aplicación con navegador. |
| `secret` | `${MERDN_ACCESS_PROVISIONING_CLIENT_SECRET}` | Mismo valor que recibe el servicio `api`. |

El rol `manage-users` de `realm-management` se declara de forma **imperativa** en
el bloque `users` del realm:

```json
{
  "username": "service-account-merdn-access-provisioning",
  "serviceAccountClientId": "merdn-access-provisioning",
  "clientRoles": { "realm-management": ["manage-users"] }
}
```

Keycloak crea la cuenta de servicio al crear el cliente y aplica el rol sobre
esa misma cuenta: el `id` declarado es el que queda en base. **Verificado sobre
Keycloak 26.7.1**: el import crea el cliente, enlaza el rol y el token de
`client_credentials` resultante administra el realm (búsqueda, creación,
`reset-password`, actualización de `enabled`).

Los límites que este archivo debe respetar:

- `description` de un cliente admite **255 caracteres** como máximo. Un texto
  más largo rompe el import con `Value too long for column "DESCRIPTION"`.
- Keycloak **no** sustituye un marcador `VAR` que no llega en el entorno: deja
  el texto literal `${VAR}` como secreto. Por eso `compose.yml` exige
  `MERDN_ACCESS_PROVISIONING_CLIENT_SECRET` con `:?` en vez de dejarla ausente.

Comprobación de que el rol quedó asignado (reproduce la verificación hecha):

```bash
docker compose --profile oidc-local up -d oidc-local
# Con el token de admin de .env:
#   GET /admin/realms/merdn-local/clients?clientId=merdn-access-provisioning
#   GET /admin/realms/merdn-local/clients/{id}/service-account-user
#   GET /admin/realms/merdn-local/users/{saId}/role-mappings/clients/{realmManagementId}
```

## Límites declarados

- Solo `development` y `test`. La API **rechaza al arrancar** un emisor
  `merdn-local`, o un emisor HTTP, en `mvp`. No es una advertencia: el proceso
  no arranca.
- La allowlist de host local admite **exactamente** `host.docker.internal` y el
  bucle local. No es una forma ni un sufijo: se compara por igualdad.
- Entra External ID **no** forma parte de esta Task. Será **el mismo** adapter
  con otro emisor, otro cliente y otra configuración, sin cambiar dominio,
  sesión ni autorización.
- La consola administrativa queda en el mismo puerto de bucle local y no se
  publica fuera de ella. No hay ningún dato real que proteger en ella, pero
  tampoco hay razón para exponerla.
