# Proveedor OIDC local (desarrollo)

Presentación vigente (049, 2026-10-14): login Eloisa profesional en escritorio y
móvil, base `keycloak.v2` y parche mínimo de etiqueta accesible para el usuario
de reautenticación (procedencia/licencia en THEME-PROVENANCE.md), estilos base y recurso
`css/eloisa.css?v=046`. Se aplica con `node scripts/identity/apply-local-login-theme.mjs`
desde la raíz, sin reiniciar ni recrear IdP y sin cambiar autenticación/cuentas.
Detalle, rollback y verificaciones: `docs/ACCESO-ELOISA.md`.

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

### Presentación Eloisa en contenedor existente (043, 2026-10-14)

El archivo de importación no actualiza un realm ya creado. Para aplicar el tema
versionado al proveedor local activo, sin recrear usuarios ni contenedor:

```powershell
node scripts/identity/apply-local-login-theme.mjs
```

La operación conserva cuentas, contraseñas, issuer y controles de acceso. Solo
instala el tema y cambia presentación/locales, con backup privado, mutex y
rollback verificado. El script no recrea el servicio. El mount de temas de
Compose sirve en nuevas instalaciones; no recrear el IdP existente para añadirlo.
Véase [acceso aplicado y límites](../../docs/ACCESO-ELOISA.md).

### Corrección de integración 040 (2026-10-12)

El emisor humano vigente es `http://merdn.localhost:8081/realms/merdn-local`.
El navegador resuelve el sufijo `.localhost` a loopback; la API dentro de Compose
usa el mapeo exacto `merdn.localhost:host-gateway`. Keycloak considera este origen
local adecuado para sus cookies. La configuración anterior con
`host.docker.internal` por HTTP descartaba cookies en Chromium y el login fallaba.
No se requiere modificar hosts del sistema ni activar opciones del navegador.
Las referencias anteriores a host.docker.internal que siguen abajo documentan
la topología heredada; ya no son el emisor recomendado del realm humano.

Después de crear o importar el realm, ejecutar desde la raíz del proyecto:

```powershell
node scripts/identity/configure-local-oidc.mjs
```

El script comprueba los labels y el puerto loopback del contenedor local, utiliza
sus credenciales de operador sin imprimirlas y respalda el perfil/realm/clientes
anteriores en `.secrets/backups/`. Crea el cliente de servicio si falta, conserva
su secreto si existe, asigna manage-users y declara `merdnAccessRequest` como
atributo gestionado visible/editable solo por administración. Elimina la política
permisiva de atributos no gestionados (el valor deshabilitado se expresa por
omisión, no por el literal DISABLED). Nombre y correo permanecen en Person;
no son campos obligatorios duplicados en el IdP.

También fija frontendUrl del realm humano y comprueba el issuer publicado.
Produce `.secrets/admin040-runtime-provisioning.json` con las cuatro variables
de issuer/provisión que debe recibir la API. Ese archivo contiene un secreto:
no se debe imprimir, versionar ni copiar a documentación. Ejecutarlo de nuevo
no recrea cuentas humanas ni contraseñas y conserva el secreto del cliente.

Antes de cambiar el issuer en una instalación con cuentas vinculadas, conciliar
sus vínculos mediante un alcance específico: este script no los migra ni les
concede acceso automáticamente. En el entorno local de esta entrega no existen
cuentas administrativas registradas; sí existen cuatro vínculos humanos previos.
Los cuatro se verificaron en el mismo realm por subject exacto. Su conciliación
conserva IDs/cuentas/estados y revoca sesiones anteriores con auditoría SYSTEM.

Comprobar discovery desde el anfitrión mediante `127.0.0.1:8081` (el documento
debe anunciar merdn.localhost), y desde el contenedor API mediante
`merdn.localhost:8081`. El issuer y los endpoints de autorización deben coincidir.
No usar la resolución DNS de Node en Windows como sustituto del recorrido del
navegador: el mapeo `.localhost` lo realiza el navegador.

El modo start-dev sigue siendo exclusivamente local. No aplicar estas
instrucciones como configuración de producción ni recrear el contenedor activo
sin respaldo de sus usuarios y credenciales.

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
aprovisiona las cuentas de las personas que se registran. Los datos ficticios
pertenecen exclusivamente a pruebas aisladas, no a identidades del producto.

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
  publica fuera de ella. Las cuentas y sus secretos se tratan como datos reales,
  también durante desarrollo.

## Recuperación administrada real (041)

El administrador inicial de Hospital entra en Configuración → Solicitudes de
acceso → Revisar una solicitud aprobada → Recuperar acceso personal. Verificar
mi identidad fuerza un nuevo login OIDC del mismo administrador; la autorización
reciente dura cinco minutos. Tras comprobar la identidad de la persona fuera
del sistema, registrar una referencia de soporte opaca, introducir y confirmar
la contraseña temporal y confirmar la verificación. El sistema revoca sesiones
MERDN/IdP, audita y exige cambiar la contraseña en el siguiente ingreso. Entregar
la contraseña por el canal privado institucional acordado. MERDN no la conserva,
no la devuelve y no envía correo. Administradores institucionales y cuentas de
soporte quedan excluidos de esta recuperación personal.

PENDING no significa éxito. Consultar estado lee el resultado persistido;
Registrar resultado incierto solo clasifica una operación abandonada tras 15
minutos y mantiene la cuenta bloqueada. Repetir operationId no repite el PUT.
UNCERTAIN necesita conciliación del operador: ni un temporizador ni otra
respuesta HTTP ni editar ACTIVE directamente resuelven la incertidumbre remota.

### Conciliación excepcional del operador local

`scripts/identity/local-password-recovery.mjs` exige la última operación personal
PENDING/UNCERTAIN elegible y las credenciales del operador Keycloak configuradas
en el contenedor local. Solo admite Docker local verificado (pipe Desktop o
socket Unix), una API y puertos de bucle local. Rechaza contextos Docker remotos.
La invocación implica una interrupción breve: detiene la API, reinicia el MISMO
contenedor IdP conservando su almacenamiento, reautentica al operador, verifica
realm/subject/marcador, fija UNA contraseña temporal nueva y revoca SSO. Revalida
aprobación/vínculos/generación con RLS/runtime y locks antes de liberar la cuenta;
la auditoría SYSTEM conserva el resultado incierto anterior. No concede roles,
no revierte suspensiones y no modifica reservas de primer administrador.

Preparar un archivo de contraseña bajo `.secrets/` con ACL efectiva restringida
al propietario, SYSTEM y Administradores. `mode:0600` por sí solo no basta en
Windows; el script comprueba la ACL y rechaza archivos expuestos. El auxiliar
`securePrivateDirectory` de `local-maintenance-lock.mjs` prepara un directorio
privado antes de escribir el archivo. No introducir la contraseña como argumento,
en el historial de shell ni en documentos versionados.

```powershell
node scripts/identity/local-password-recovery.mjs --operation-id UUID_OPERACION --support-reference CASO_123456 --password-file .secrets/recuperacion/temporal.txt
```

El resultado contiene estado, correlación y ruta de evidencia privada bajo
`~/.merdn-maintenance/`. Conserva identificación del operador, referencia de
soporte, contenedores y resolución; no contiene contraseña ni tokens. Tras
confirmar y entregar la NUEVA contraseña del operador, eliminar el archivo
temporal privado. SUCCEEDED de conciliación no confirma la contraseña del HTTP
original. Volver a ingresar exige cambio obligatorio.

La exclusión se conserva en un contenedor mutex `merdn-identity-maintenance-*`
del mismo daemon, compartido por todos los usuarios y checkouts. Nunca se inicia,
no tiene red y no caduca. Si el proceso se interrumpe, mantener ese recurso y la
cuenta bloqueada: el operador confirma que el proceso anterior terminó,
identifica el mutex por su scope/token y la evidencia, y lo retira explícitamente
antes de repetir el procedimiento completo. Nunca retirar un bloqueo por edad
ni iniciar el contenedor mutex. No recrear ni borrar el contenedor o almacenamiento
de Keycloak. Un propietario antiguo no puede liberar un bloqueo reemplazado.

### Pérdida de contraseña del único administrador

Se atiende por el operador autenticado del IdP, verificando al titular y el
subject exacto de la reserva CONFIRMED y ExternalAuthIdentity. Reset temporal y
logout se realizan en la consola administrativa de Keycloak sobre ese subject;
no crear otra cuenta, no borrar la reserva y no reabrir el registro. La revocación
de sesiones MERDN y el avance de authenticationNotBefore necesitan mantenimiento
tenant-scoped auditado con la API detenida. Esta excepción requiere intervención
técnica; el endpoint personal y el CLI anterior la rechazan deliberadamente.
Una cuenta suspendida permanece suspendida. El administrador vuelve por OIDC
y cambia la contraseña temporal; conserva su reserva y capacidades.

### Verificación reproducible

Las pruebas usan exclusivamente stack, tenant y PostgreSQL desechables con
labels verificadas, puertos 3002/3003/8083 e imágenes access041. No ejecutarlas
contra la instalación activa ni usar sus datos como seed.

```powershell
node tests/e2e/prepare-institutional-administrator.real.mjs --personal-access
node tests/e2e/personal-access.real.mjs
node tests/e2e/operator-recovery.real.mjs
node --test tests/testing/local-password-recovery.test.mts
```

El último E2E introduce explícitamente un fallo UNCERTAIN SOLO en el tenant
aislado para comprobar conciliación, mutex y generación. El cambio de contraseña,
reinicio persistente del IdP, logout, auditoría y login son reales. La E2E normal
anterior usa formularios y HTTP reales sin respuestas simuladas.
