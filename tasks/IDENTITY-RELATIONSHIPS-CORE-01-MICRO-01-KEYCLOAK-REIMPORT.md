# IDENTITY-RELATIONSHIPS-CORE-01 — MICRO-PACKET 01

## Objective

Reimportar el realm local corregido recreando exclusivamente el contenedor
desechable `oidc-local`, y confirmar que el discovery canónico queda operativo.

Tiempo máximo: **10 minutos**.

## Allowlist

- Operaciones Docker únicamente sobre el servicio Compose `oidc-local`.
- Lectura HTTP del discovery OIDC desde el host y desde el contenedor `api`.
- Lectura de logs de `oidc-local`, sin secretos.

**Archivos permitidos para modificar: ninguno.**

## Exact change

Desde la raíz del repositorio, ejecutar exactamente en este orden:

```powershell
docker compose --profile oidc-local rm -s -f oidc-local
docker compose --profile oidc-local up -d --force-recreate oidc-local
docker compose --profile oidc-local ps oidc-local
docker compose --profile oidc-local logs --no-color --tail 120 oidc-local
```

No usar `restart`: Keycloak omite la importación cuando el realm ya existe en
el contenedor conservado.

## Focused checks only

Cuando `docker compose ... ps oidc-local` muestre `healthy`, ejecutar:

```powershell
$discovery = Invoke-RestMethod 'http://host.docker.internal:8081/realms/merdn-local/.well-known/openid-configuration'
$discovery.issuer
docker compose exec -T api node -e "fetch(process.argv[1]).then(async(r)=>{const d=await r.json();process.stdout.write(r.status+' '+d.issuer)})" "http://host.docker.internal:8081/realms/merdn-local/.well-known/openid-configuration"
```

Ambas comprobaciones deben anunciar exactamente:

```text
http://host.docker.internal:8081/realms/merdn-local
```

La segunda debe comenzar con `200 `.

Entregar solamente:

- salida de `ps` del servicio;
- línea de log que confirma la importación del realm (sin credenciales);
- resultado de las dos comprobaciones de issuer;
- `git status --short` para demostrar que este micro-packet no cambió archivos.

## STOP CONDITIONS

Detenerse inmediatamente, sin diagnosticar ni corregir nada más, si ocurre
cualquiera de estos casos:

- faltan en el entorno local las variables exigidas por Compose;
- el contenedor no llega a `healthy` dentro de 5 minutos;
- los logs informan error de importación o campos desconocidos;
- cualquiera de los dos discovery no responde `200` o anuncia otro issuer;
- el comando requeriría recrear, detener o modificar un servicio distinto de
  `oidc-local`;
- se detecta que sería necesario cambiar código, fixture, Compose, `.env`, base
  de datos, cookies o controles OIDC.

Ante STOP, reportar únicamente el comando fallido, código/estado y mensaje
sanitizado. No investigar, no aplicar alternativas y no ejecutar suites.

## Explicit exclusions

- No modificar archivos.
- No tocar API, adapter OIDC, esquema, migraciones, provisioning ni Keycloak
  mediante consola administrativa.
- No ejecutar unit, integration, e2e ni suite completa.
- No hacer benchmarking, arquitectura, diagnóstico o investigación.
- No commit, push o deploy.

