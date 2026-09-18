# Proveedor OIDC local (desarrollo)

IDENTITY-RELATIONSHIPS-CORE-01 §4.1. Keycloak `26.7.1` como contenedor local
**desechable**, publicado únicamente en `127.0.0.1`, para poder implementar,
ejecutar y probar el flujo OIDC **sin Entra y sin red externa**.

Esto **no** es infraestructura de despliegue. No hay TLS, no hay respaldos, no
hay endurecimiento y no hay datos reales.

## Qué contiene

- `realm-merdn-local.json` — realm `merdn-local` con un cliente **público** con
  PKCE S256 obligatorio y dos personas **ficticias**.

Sin secretos versionados: el cliente es público y no tiene secreto, y la única
contraseña se sustituye en el arranque desde `.env`, que Git ignora.

## Arranque

El servicio es **opt-in**: no se levanta con `docker compose up` normal.

```bash
# 1. Defina en `.env` (ignorado por Git) los dos valores locales ficticios:
#      MERDN_OIDC_LOCAL_ADMIN_PASSWORD=...
#      MERDN_OIDC_LOCAL_TEST_PASSWORD=...
#    Ninguno es un secreto real y ninguno debe reutilizarse fuera de local.

# 2. Levante el proveedor con su perfil.
docker compose --profile oidc-local up -d oidc-local

# 3. Compruebe el descubrimiento desde las DOS redes (ver más abajo).
curl -s http://host.docker.internal:8081/realms/merdn-local/.well-known/openid-configuration
```

Para retirarlo: `docker compose --profile oidc-local down`.

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
| `persona.sin.vinculo`  | `00000000-0000-4000-8000-00000000f1c8` | Persona **no aprovisionada**: comprueba que un `subject` verificado sin vínculo no crea cuenta. |

Los dos `sub` son fijos para que el provisioning pueda vincularlos de forma
reproducible entre arranques.

**Ningún claim de estas personas llega al dominio de MERDN.** El adapter
devuelve exclusivamente `issuer` y `subject`. Cambiar aquí el correo, el nombre
o el usuario no cambia el vínculo ni la identidad en MERDN, que es exactamente
la propiedad que AD-02 busca.

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
  publica fuera de él. No hay ningún dato real que proteger en ella, pero
  tampoco hay razón para exponerla.
