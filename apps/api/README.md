# @merdn/api — API MERDN (NestJS)

Fundación técnica del backend de MERDN (TASK-001).

Este documento también contiene la **guía de operación local del monorepo**,
porque `apps/api` concentra la API, Prisma y la orquestación Docker.

---

## 1. Alcance implementado

| Implementado | No implementado en TASK-001 |
| --- | --- |
| Aplicación NestJS ejecutable con estructura modular | Módulos de dominio (identidad, tenancy, personas, operaciones, evidencias, finanzas, indicadores, Hub institucional) |
| `GET /health` → HTTP 200 `{ "status": "ok" }` | Cualquier otro endpoint, incluidos endpoints de mutación |
| Documento OpenAPI que describe únicamente `/health` | Esquemas de seguridad, ejemplos con datos personales |
| Validación tipada de variables de entorno con fail-fast | Autenticación, autorización, aislamiento institucional, auditoría de negocio |
| Prisma 7 configurado para PostgreSQL, sin modelos | Modelos, migraciones, seeds, repositorios, cliente generado |

`GET /health` confirma **solo** que el proceso de la API responde. No comprueba
ni afirma el estado de PostgreSQL, del almacenamiento documental ni de ninguna
integración.

---

## 2. Requisitos

- Node.js **24 LTS** (ver `.nvmrc`; verificado con 24.19.0)
- npm 10 o superior (verificado con 11.17.0)
- Docker Engine + Docker Compose v2 — necesario únicamente para PostgreSQL y
  para la verificación del stack en contenedores

---

## 3. Configuración de entorno

```bash
cp .env.example .env      # desde la raíz del repositorio
```

`.env` está ignorado por Git y por el contexto Docker. Contiene únicamente
valores **ficticios** de desarrollo local. Nunca coloque credenciales reales.

Variables leídas por la API:

| Variable | Obligatoria | Valor por defecto | Uso |
| --- | --- | --- | --- |
| `DATABASE_URL` | Sí | — | Se valida en el arranque (presencia y esquema `postgresql://`). TASK-001 no abre conexiones desde la API: el valor **no** se conserva en memoria ni se registra. |
| `API_PORT` | No | `3001` | Puerto de escucha |
| `API_OPENAPI_PATH` | No | `docs` | Ruta local de la documentación OpenAPI |
| `MERDN_ENVIRONMENT` | No | `development` | `development` \| `test` \| `mvp` |

Si falta o es inválida una variable indispensable, el proceso termina con
código 1 y un mensaje que nombra la variable pero **nunca** imprime su valor.

---

## 4. Comandos del monorepo

Todos se ejecutan desde la **raíz** del repositorio.

| Propósito | Comando |
| --- | --- |
| Instalar dependencias | `npm install` |
| Lint (todo el monorepo) | `npm run lint` |
| Typecheck estricto (todos los workspaces) | `npm run typecheck` |
| Pruebas (todos los workspaces) | `npm test` |
| Build (shared → api → web) | `npm run build` |
| Compilar solo el paquete compartido | `npm run build:shared` |
| API en desarrollo (watch) | `npm run dev:api` |
| Web en desarrollo (watch) | `npm run dev:web` |
| Validar el esquema Prisma | `npm run prisma:validate` |
| Formatear el esquema Prisma | `npm run prisma:format` |
| Verificar conexión a PostgreSQL | `npm run db:check` |
| Escaneo de secretos en archivos versionables | `npm run secrets:scan` |

`typecheck`, `test` y `build` compilan primero `packages/shared`, porque
`apps/api` consume su salida en `dist/`.

### Scripts de instalación de dependencias (`allowScripts`)

npm ejecuta scripts de instalación (`preinstall`/`install`/`postinstall`) solo si
el paquete aparece en el campo `allowScripts` del `package.json` de la raíz. La
política vigente es explícita y por tanto reproducible: `npm ci` no deja scripts
"pendientes de revisión".

| Paquete | Política | Motivo |
| --- | --- | --- |
| `prisma@7.9.1` | permitido (`true`) | Su `postinstall` prepara el CLI de Prisma, necesario para `prisma validate` y `db execute` (FR-09, FR-11). |
| `@prisma/engines@7.9.1` | permitido (`true`) | Descarga/coloca los motores de Prisma requeridos por el CLI. |
| `@scarf/scarf` | **denegado** (`false`) | Dependencia transitiva de `swagger-ui-dist` (a su vez requerida por `@nestjs/swagger`, FR-08). Su `postinstall` solo envía telemetría de instalación al servicio Scarf; no aporta ninguna funcionalidad a MERDN. Se mantiene la dependencia porque no puede eliminarse sin renunciar a la UI de OpenAPI, y su script queda bloqueado de forma deliberada. |

Comprobación de que no queda ninguna decisión implícita:

```bash
npm approve-scripts --allow-scripts-pending
# -> No packages with unreviewed install scripts.
```

Aprobar o denegar un script transitivo nuevo es una decisión deliberada; no debe
resolverse ejecutando `npm approve-scripts --all`.

### Ejecución local sin Docker

```bash
npm run build            # o: npm run build:shared && npm run build:api
npm run start --workspace @merdn/api
curl http://127.0.0.1:3001/health          # -> {"status":"ok"}
curl http://127.0.0.1:3001/docs-json       # documento OpenAPI
```

La documentación OpenAPI navegable queda en `http://127.0.0.1:3001/docs`.
Está pensada **exclusivamente para desarrollo local**; exponerla en un entorno
accesible requiere una decisión y una configuración separadas.

Los scripts `start` y `dev` cargan el `.env` de la raíz mediante
`node --env-file-if-exists=../../.env`, sin dependencias adicionales.

---

## 5. Docker Compose (desarrollo local)

`compose.yml` (raíz) levanta PostgreSQL, la API y el frontend. **No** es una
topología de producción: no incluye reverse proxy, TLS, backups, monitoreo ni
hardening, y publica los puertos únicamente en `127.0.0.1`.

| Propósito | Comando |
| --- | --- |
| Validar la configuración | `npm run docker:config` |
| Levantar el stack (build incluido) | `npm run docker:up` |
| Ver el estado y los health checks | `npm run docker:ps` |
| Ver logs recientes | `npm run docker:logs` |
| Parada limpia conservando datos | `npm run docker:down` |
| Parada + borrado del volumen del proyecto | `npm run docker:clean` |

Puertos publicados (solo loopback):

| Servicio | Host | Contenedor |
| --- | --- | --- |
| `web` | `127.0.0.1:3000` | `3000` |
| `api` | `127.0.0.1:3001` | `3001` |
| `postgres` | `127.0.0.1:5432` | `5432` |

Verificación extremo a extremo con el stack en ejecución:

```bash
curl http://127.0.0.1:3001/health   # -> {"status":"ok"}
curl -I http://127.0.0.1:3000/      # -> HTTP/1.1 200 OK
```

`npm run docker:clean` ejecuta `docker compose down --volumes` y elimina
únicamente el volumen `merdn-postgres-data` del proyecto `merdn`. No afecta a
otros volúmenes de Docker.

---

## 6. Estructura

```text
apps/api/
  Dockerfile              imagen multi-stage; proceso final como usuario `node`
  nest-cli.json           configuración de `nest build`
  vitest.config.mts       runner de pruebas
  src/
    main.ts               arranque, validación de entorno y OpenAPI
    app.module.ts         raíz modular (solo HealthModule)
    config/environment.ts configuración tipada con fail-fast y redacción
    health/               controlador, servicio, DTO y módulo de salud
    openapi/openapi.ts    construcción y publicación del documento OpenAPI
  test/
    health.api.test.ts    pruebas de API con Supertest
    openapi.test.ts       verificación del documento OpenAPI
```

### Inyección de dependencias explícita

Los constructores declaran sus dependencias con `@Inject(...)`. Así las pruebas
no dependen de `emitDecoratorMetadata` y no fue necesario añadir un
transformador adicional (SWC) al conjunto de dependencias de TASK-001.

---

## 7. Pruebas

```bash
npm run test --workspace @merdn/api
```

Cubren: contrato exacto de `/health`, `Content-Type`, ausencia de campos
adicionales o sensibles, ausencia de endpoints de mutación y de rutas de
negocio, contenido del documento OpenAPI, y validación de entorno incluida la
no divulgación de valores en los mensajes de error.
