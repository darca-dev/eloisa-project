# MERDN Task Specification

## Task Identification

- **Task ID:** TASK-DEPLOY-DEMO-01
- **Title:** Eloisa DEMO/STAGING en Hostinger con despliegue automático desde `develop`
- **Status:** PENDING APPROVAL
- **Priority:** HIGH
- **Created by:** Codex
- **Approved by:** Product Owner — pendiente

## Objective

Preparar una única instalación web DEMO/STAGING de Eloisa en el VPS Hostinger KVM 4 existente, actualizable automáticamente y exclusivamente después de un `push` a `develop`, con acceso a `/`, `/hospital` y `/municipality`, protección de acceso, health checks obligatorios, trazabilidad por commit y rollback a imágenes inmutables anteriores.

La tarea no crea producción, no autoriza datos reales, no compra dominio, no cambia DNS y no modifica el producto.

## Evidence and Current State

### Facts verified in the repository

1. La rama inspeccionada es `develop`.
2. El monorepo usa Node.js 24, npm workspaces, Next.js App Router, NestJS y Docker Compose.
3. `compose.yml` declara expresamente que es solo para desarrollo local; publica PostgreSQL, API y web únicamente en `127.0.0.1` y no incluye reverse proxy, TLS, backups, monitoreo ni hardening.
4. Existen imágenes multi-stage no-root en `apps/web/Dockerfile` y `apps/api/Dockerfile`.
5. La API ofrece `GET /health`; el contenedor web comprueba `/`.
6. Existen las rutas web `/`, `/hospital` y `/municipality` dentro de una sola aplicación Next.js.
7. No existen actualmente `infra/` ni `.github/` en el repositorio.
8. El root `package.json` ya ofrece `lint`, `typecheck`, `test`, `build`, `secrets:scan` y comandos Compose.
9. `docs/ARCHITECTURE.md` aprueba Hostinger KVM 4 Brasil, Docker Compose, imágenes construidas en CI, artefactos inmutables y usuario de despliegue sin root ordinario.
10. `docs/SECURITY.md` exige secretos fuera de Git, PostgreSQL no público, SSH por clave, firewall, TLS para exposición pública y datos ficticios/controlados en el MVP.

### Assumptions to verify before infrastructure access

- El VPS existe, está activo y permite un Linux soportado con acceso administrativo autorizado.
- La cuenta GitHub que publicará imágenes puede usar GitHub Container Registry (GHCR) sin costo adicional material para el volumen esperado.
- El VPS tiene recursos y disco suficientes; esto debe verificarse, no asumirse.
- El repositorio remoto `origin` y su propietario determinan el namespace real de GHCR durante implementación.

## Architecture Chosen

**Opción elegida: A. GitHub Actions → VPS**, con imágenes OCI inmutables en GHCR y despliegue remoto por SSH de mínimo privilegio.

```text
push a develop
  → GitHub Actions (checkout por SHA)
  → npm ci + controles mínimos
  → build de web y api
  → imágenes GHCR etiquetadas con git SHA
  → SSH autenticado al usuario deploy del VPS
  → lock de despliegue + pull del SHA
  → Docker Compose DEMO actualiza web/api
  → health checks de /, /hospital y /municipality
  → éxito: conservar SHA como current y previous
  → fallo: restaurar previous y repetir health checks
```

### Rationale

- Usa el proveedor Git ya aprobado y el VPS existente.
- No requiere webhook receptor público, runner autoalojado ni servicio de CI adicional.
- El VPS no recibe permisos para escribir en el repositorio.
- Cada versión desplegable se identifica por el SHA exacto; no se despliega desde un tag mutable como única referencia.
- El rollback no usa `git reset`, no recompila en el VPS y no altera el repositorio local.

### Rejected alternatives

1. **Webhook/runner en el VPS:** agrega un servicio público o un runner con mayor superficie de ataque y mantenimiento.
2. **`git pull` y build en el VPS:** mezcla código fuente, build y runtime; dificulta reproducibilidad, rollback y mínimo privilegio.

## Operational Topology

- Un solo proyecto Compose `eloisa-demo` en `/opt/eloisa-demo`.
- `reverse-proxy`: Caddy con versión fijada, único punto de entrada.
- `web`: imagen GHCR por SHA, sin puerto público.
- `api`: imagen GHCR por SHA, solo red interna; no se incorpora backend nuevo.
- `postgres`: red interna y volumen persistente propio de DEMO; `5432` nunca público. Puede permanecer disponible para la fundación existente, pero esta tarea no crea migraciones ni convierte fixtures frontend en datos backend.
- Red interna dedicada y solo los puertos estrictamente necesarios en el host.
- Reinicio `unless-stopped`, health checks reales y rotación de logs Docker.
- Estado operativo fuera del repositorio: versión actual, versión anterior, archivo de entorno root/deploy-only y credenciales.

## Staging Access Security

### Before a domain exists

- **Modo obligatorio:** acceso privado por túnel SSH; el reverse proxy escucha solamente en loopback del VPS.
- El navegador local accede, por ejemplo, a `http://127.0.0.1:<puerto-local>` después de abrir el túnel hacia el puerto loopback remoto documentado.
- No se publica `80`, `443`, `3000`, `3001` ni `5432` para DEMO mientras no exista dominio/TLS aprobado.
- Este mecanismo aloja Eloisa en el VPS y elimina la dependencia de ejecutar la aplicación en localhost, aunque cada revisor autorizado necesita el túnel.
- No se debe usar Basic Auth sobre HTTP público, porque no cifra la contraseña.

### After a domain is purchased and DNS is authorized

- DNS `demo.<dominio-aprobado>` apunta al VPS.
- Caddy expone exclusivamente `80/443`, redirige a HTTPS y obtiene/renueva TLS automáticamente.
- Caddy exige **Basic Auth** antes de enrutar a Eloisa; usuario y hash de contraseña se inyectan desde secretos del VPS.
- Se aplican headers seguros básicos compatibles con la aplicación. CSP/HSTS deben probarse antes de endurecerse para no romper assets; HSTS solo después de validar HTTPS y renovación.
- No se inventa ni versiona un dominio.

Una URL temporal pública de Hostinger no se asume. Solo podrá usarse si hPanel muestra una opción verificable, con HTTPS válido y control de acceso equivalente; de lo contrario se mantiene el túnel SSH.

## Functional Requirements

1. **FR-01:** el workflow se activa automáticamente solo por `push` a `develop`; `workflow_dispatch` se permite únicamente para reintento o rollback manual autorizado.
2. **FR-02:** ningún evento de otra rama despliega DEMO.
3. **FR-03:** usar `npm ci` con el lockfile versionado y Node.js 24 fijado.
4. **FR-04:** antes de publicar imágenes deben pasar `npm run secrets:scan`, `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`, o sus equivalentes sin duplicar builds innecesariamente. Todo recorte futuro requiere evidencia y aprobación.
5. **FR-05:** web y API se publican como imágenes GHCR identificadas por el mismo SHA de commit.
6. **FR-06:** el job de deploy usa un GitHub Environment llamado `demo`; el workflow no obtiene permisos sobre `main` ni realiza merge o push.
7. **FR-07:** el VPS serializa despliegues mediante lock para evitar carreras; la concurrencia de Actions cancela ejecuciones obsoletas aún no desplegadas, pero no interrumpe una actualización remota en curso.
8. **FR-08:** Compose espera health de dependencias y actualiza únicamente servicios de DEMO, conservando volúmenes.
9. **FR-09:** no ejecutar `prisma migrate`, migraciones destructivas, seeds ni limpieza de volúmenes en esta tarea.
10. **FR-10:** tras actualizar, comprobar `/`, `/hospital` y `/municipality`; cada ruta debe responder HTTP `200` y devolver contenido HTML no vacío a través del reverse proxy y su protección de staging.
11. **FR-11:** antes de autenticarse, una solicitud al acceso público futuro debe recibir `401`; con credenciales correctas puede alcanzar las rutas. En modo túnel, el puerto no debe ser accesible públicamente.
12. **FR-12:** si cualquier health check falla dentro de la ventana definida, el deploy es fallido y se activa rollback automático a la versión anterior conocida como saludable.
13. **FR-13:** el resultado registra entorno, SHA solicitado, SHA anterior, timestamps y resultado, sin secretos ni datos sensibles.
14. **FR-14:** `/patient`, `/caregiver` y `/professional` no se crean en esta tarea; la topología de una sola web debe permitir añadirlas después sin un nuevo sitio.

## GitHub Steps

1. Crear el Environment `demo`.
2. Configurar sus secretos de conexión SSH y, si se decide, reviewers obligatorios. El `push` inicia automáticamente el workflow; un reviewer de Environment puede conservar un gate humano adicional antes del job remoto.
3. Conceder al workflow solo `contents: read` y `packages: write`; el job de despliegue no necesita permisos de escritura al repositorio.
4. En checkout, fijar el SHA del evento.
5. Instalar Node 24 y ejecutar `npm ci`.
6. Ejecutar controles y build.
7. Construir y publicar `web` y `api` a GHCR con tag inmutable `${GITHUB_SHA}`; un tag `develop` puede existir solo como alias informativo y nunca como referencia exclusiva del deploy/rollback.
8. Verificar que ambos artefactos existen antes del acceso al VPS.
9. Conectar por SSH validando host key fijada, invocar el script de deploy con el SHA y recibir un código de salida fiable.
10. Publicar el resultado en GitHub Actions sin imprimir variables sensibles.

## Hostinger Steps

1. Confirmar plan, región, Linux instalado, CPU/RAM/disco, IP, responsable de cuenta y backup contratado.
2. Actualizar el sistema; activar MFA en hPanel.
3. Crear usuario administrativo individual y usuario `deploy` sin login root ordinario, con permisos mínimos sobre `/opt/eloisa-demo` y solo los comandos Docker estrictamente necesarios.
4. Habilitar SSH por clave; deshabilitar contraseña y root login ordinario cuando se confirme acceso alternativo; fijar allowlist si las direcciones administrativas lo permiten.
5. Instalar versiones soportadas de Docker Engine y Compose plugin.
6. Configurar firewall: SSH restringido; antes del dominio, ningún puerto web público; después del dominio, solo `80/443` además de SSH restringido.
7. Crear `/opt/eloisa-demo/{config,state}` con propietarios y permisos explícitos. Los secretos viven fuera del checkout y nunca se imprimen.
8. Instalar el Compose, Caddyfile y script aprobados.
9. Autenticar al usuario de despliegue contra GHCR con credencial read-only y scope mínimo; no usar credenciales personales amplias.
10. Configurar datos/volúmenes exclusivos de DEMO y confirmar que PostgreSQL no se publica.
11. Probar primer deploy, health checks, reinicio del host y rollback a una imagen anterior.
12. Configurar rotación de logs y verificación básica de disco/contenedores. El monitoreo externo y backups completos para datos reales quedan fuera; DEMO sigue limitado a fixtures ficticios/controlados.

## Secrets Required

### GitHub Environment `demo`

| Nombre lógico | Finalidad | Scope/owner |
| --- | --- | --- |
| `DEMO_VPS_HOST` | IP/host SSH del VPS | Environment `demo`; DevOps |
| `DEMO_VPS_PORT` | Puerto SSH | Environment `demo`; DevOps |
| `DEMO_VPS_USER` | Usuario de despliegue | Environment `demo`; DevOps |
| `DEMO_VPS_SSH_PRIVATE_KEY` | Autenticación de Actions al VPS | Environment `demo`; clave exclusiva y revocable |
| `DEMO_VPS_HOST_KEY` | Pin de host SSH/known_hosts | Environment variable o secret según política; obtenido por canal confiable |

El `GITHUB_TOKEN` efímero se usa para publicar paquetes con permisos mínimos; no se crea un PAT de escritura si no es necesario.

### VPS, fuera del repositorio

| Nombre lógico | Finalidad | Scope/owner |
| --- | --- | --- |
| `GHCR_PULL_TOKEN` | Pull de imágenes privadas | Solo `read:packages`; usuario/máquina de deploy |
| `GHCR_PULL_USER` | Identidad técnica para GHCR | Deploy |
| `POSTGRES_PASSWORD` | Base exclusiva DEMO | Archivo root/deploy-only |
| `STAGING_BASIC_AUTH_USER` | Usuario de staging futuro | Archivo root/deploy-only |
| `STAGING_BASIC_AUTH_HASH` | Hash compatible con Caddy; nunca contraseña plana en Compose | Archivo root/deploy-only |
| `DEMO_HOSTNAME` | Dominio aprobado futuro; configuración no secreta | Vacío/no usado en modo túnel |

No crear valores ahora. La contraseña de Basic Auth se entrega por canal autorizado y el hash se genera en el VPS sin registrar la contraseña en shell history. Las claves se rotan/revocan si se exponen.

## Deployment and Rollback Procedure

1. Adquirir un lock exclusivo.
2. Validar el SHA recibido (`40` caracteres hexadecimales) y la existencia de ambas imágenes.
3. Leer `current` y conservarlo como candidato `previous`; nunca aceptar un tag arbitrario aportado por entrada no validada.
4. Hacer pull de las imágenes del nuevo SHA.
5. Actualizar de forma atómica el archivo de estado/configuración que fija `ELOISA_IMAGE_TAG=<sha>` y ejecutar `docker compose up -d --no-build` sin eliminar volúmenes.
6. Esperar health de contenedores y ejecutar smoke checks a través del reverse proxy para `/`, `/hospital` y `/municipality`.
7. Si pasan, guardar el nuevo SHA como `current`, el anterior como `previous` y registrar éxito sanitizado.
8. Si fallan, volver a fijar el SHA anterior, hacer `docker compose up -d --no-build`, repetir los tres checks y registrar el deploy como fallido aunque el rollback sea exitoso.
9. Si también falla la versión anterior, detener automatización, conservar logs sanitizados y declarar `BLOCKED`; no limpiar volúmenes ni improvisar una migración.

### Manual rollback

Un `workflow_dispatch` autorizado recibe únicamente un SHA previamente desplegado y presente en el historial de estado permitido. Ejecuta el mismo procedimiento y checks. No usa `git reset`, `git checkout`, force-push, borrado de ramas ni reconstrucción desde código mutable.

Las imágenes de al menos la versión actual y anterior no deben eliminarse. La política exacta de retención de imágenes es una decisión operativa pendiente antes de habilitar limpieza automática.

## Health Checks

| ID | Verificación | Éxito | Falla |
| --- | --- | --- | --- |
| HC-01 | Estado Compose de `web` y `api` | `healthy` dentro del timeout aprobado | timeout, unhealthy o restart loop |
| HC-02 | `GET /` vía reverse proxy | HTTP 200, HTML no vacío | cualquier otro resultado |
| HC-03 | `GET /hospital` vía reverse proxy | HTTP 200, HTML no vacío | cualquier otro resultado |
| HC-04 | `GET /municipality` vía reverse proxy | HTTP 200, HTML no vacío | cualquier otro resultado |
| HC-05 | Protección staging | público futuro sin credenciales = 401; credenciales válidas permiten checks | bypass o secreto expuesto |
| HC-06 | Puertos | API/DB no accesibles externamente; pre-dominio tampoco web | puerto no autorizado accesible |

- Reintentos acotados con timeout total documentado; recomendación inicial: hasta 120 segundos.
- Los checks usan `--fail`, timeout por solicitud y no siguen redirecciones fuera del host esperado.
- Un contenedor `running` no equivale a deploy exitoso.
- Si falla HC-02, HC-03 o HC-04 se ejecuta rollback; si falla HC-05 o HC-06, se trata como hallazgo de seguridad bloqueante y el servicio público debe cerrarse.

## Data, Privacy, Audit and Regulatory Scope

- Solo fixtures ficticios/controlados; no autoriza datos clínicos, personales, financieros ni institucionales reales.
- No se cambia modelo, Prisma, retención ni reglas de negocio.
- Eventos técnicos mínimos: workflow/run ID, actor GitHub, commit SHA, entorno, timestamps, versión anterior/nueva, resultado de deploy/check/rollback y correlation ID. No registrar credenciales, cookies, payloads o datos de negocio.
- FURAG/MIPG, ADRES, Sentencia T-319 de 2025, SENA, indicadores, evidencia, presupuesto y movimiento financiero: **NO AFECTA** en comportamiento; deben permanecer visibles como fixtures existentes sin alterar significado ni afirmar oficialidad.
- Hospital, Alcaldía, Inscripción, Paciente, Cuidador, Profesional y `prototype-claude/`: sin cambios.

## Allowed Files

- `.github/workflows/deploy-demo.yml` — CI, publicación de imágenes y deploy exclusivo desde `develop`.
- `infra/demo/compose.yml` — topología exclusiva DEMO; no reutilizar ni convertir silenciosamente el Compose local.
- `infra/demo/Caddyfile` — reverse proxy, protección y TLS futuro.
- `infra/demo/.env.example` — nombres y valores ficticios/no sensibles únicamente.
- `infra/demo/scripts/deploy.sh` — deploy, lock, estado, health checks y rollback.
- `infra/demo/README.md` — runbook Hostinger/GitHub, túnel, dominio futuro, incidentes y evidencia sanitizada.
- `.dockerignore` — solo si hace falta reducir/asegurar contextos de build; sin excluir archivos requeridos.
- `apps/web/Dockerfile` y `apps/api/Dockerfile` — solo ajustes mínimos demostrablemente necesarios para imágenes CI/runtime; no cambiar código de producto.

Toda ruta no listada está fuera de alcance. Si la implementación demuestra que requiere otra ruta, debe detener esa parte y pedir ampliación.

## Forbidden Files and Actions

- `prototype-claude/**`
- `apps/web/src/**`
- `apps/api/src/**`
- `packages/**`
- `prisma/**` y toda migración, seed o cambio de esquema
- `docs/PRODUCT.md`, `docs/MODULES.md`, `docs/ROLES.md`, `docs/DATA.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`
- `AGENTS.md`, `CLAUDE.md`, `agents/**`
- `compose.yml` y `.env.example` locales existentes
- UI Hospital, Alcaldía, Inscripción, Paciente, Cuidador o Profesional
- `main`, su historial y sus protecciones
- Commit, push, merge, rebase, pull request, release, compra, DNS, creación de claves o despliegue real durante la implementación de archivos

## Required Tests

1. Validación sintáctica del workflow y comprobación de que solo `push.branches: [develop]` puede iniciar deploy automático.
2. `npm ci`, secret scan, lint, typecheck, tests y build desde checkout limpio.
3. Build local de ambas imágenes con un SHA ficticio válido.
4. `docker compose -f infra/demo/compose.yml config` usando valores ficticios, sin secretos impresos.
5. Prueba de que web/API/PostgreSQL no publican puertos fuera de lo aprobado.
6. Prueba de Basic Auth: `401` sin credenciales y acceso con credenciales correctas, cuando se pruebe el modo dominio.
7. Smoke test HTTP 200 y contenido no vacío para las tres rutas.
8. Simulación reproducible de fallo del nuevo SHA y rollback a una imagen anterior saludable.
9. Simulación de fallo de health tras rollback y salida no-cero/BLOCKED.
10. Prueba de lock/concurrencia: dos intentos no modifican estado simultáneamente.
11. Reinicio/recreación de contenedores sin pérdida del volumen de PostgreSQL.
12. Escaneo que confirme ausencia de secretos en Git, imágenes, logs y bundle frontend.

Las operaciones que requieren VPS, GHCR, GitHub Environment, DNS o TLS real se reportan `NOT RUN` hasta que el Product Owner autorice y suministre acceso. No se declaran pasadas por simulación local.

## Acceptance Criteria

1. **AC-01:** solo un push a `develop` inicia el pipeline automático de DEMO; ninguna otra rama despliega.
2. **AC-02:** los controles mínimos pasan antes de publicar/desplegar; un fallo detiene el pipeline.
3. **AC-03:** web y API se despliegan desde imágenes inmutables referenciadas por el mismo commit SHA.
4. **AC-04:** el VPS no hace build ni necesita acceso de escritura al repositorio.
5. **AC-05:** `/`, `/hospital` y `/municipality` responden correctamente a través del punto de entrada; cualquier fallo impide declarar éxito.
6. **AC-06:** el modo pre-dominio solo es accesible por túnel autorizado; el modo con dominio usa HTTPS y Basic Auth.
7. **AC-07:** API, PostgreSQL, métricas y paneles no son públicos.
8. **AC-08:** un deploy fallido restaura automáticamente la versión anterior saludable y vuelve a verificarla.
9. **AC-09:** un rollback manual autorizado puede seleccionar un SHA previamente desplegado sin acciones Git destructivas.
10. **AC-10:** secretos y valores reales no aparecen en repositorio, imagen, frontend, logs ni salida de Actions.
11. **AC-11:** volúmenes sobreviven deploy y rollback; no se ejecutan migraciones ni seeds.
12. **AC-12:** no hay cambios en producto, prototipo ni archivos prohibidos.
13. **AC-13:** el runbook permite cambiar de túnel privado a `demo.<dominio>` modificando configuración/secretos y DNS, sin separar aplicaciones ni rediseñar infraestructura.
14. **AC-14:** Claude Code devuelve archivos, comandos, resultados, pruebas no ejecutadas, riesgos y evidencia sanitizada para auditoría de Codex.

## Definition of Done

La implementación documental/configuracional estará terminada solo cuando:

1. la Product Owner apruebe esta Task y las decisiones materiales necesarias;
2. todos los archivos autorizados estén implementados y auditados;
3. pruebas locales/CI aplicables pasen;
4. el VPS autorizado complete deploy desde un commit de `develop`;
5. los tres health checks pasen;
6. el control de acceso y aislamiento de puertos sean verificados;
7. rollback real a la versión anterior sea ensayado y vuelva a pasar los checks;
8. no existan secretos ni datos reales expuestos;
9. Codex emita review técnico sin findings bloqueantes;
10. la Product Owner revise el navegador y acepte el resultado.

No se considera Done por crear archivos, obtener contenedores `running` o completar un workflow sin verificación de rutas y rollback.

## Material Decisions Pending

| ID | Decisión | Recomendación | ¿Bloquea READY FOR CLAUDE? |
| --- | --- | --- | --- |
| OD-01 | Aprobar esta arquitectura GitHub Actions + GHCR + SSH | Aprobar | Sí |
| OD-02 | Mantener gate manual de GitHub Environment después del push o desplegar inmediatamente | Mantener reviewer Product Owner para preservar el flujo “QA → aprobación → push → deploy”; si el push ya constituye aprobación formal, puede omitirse | Sí |
| OD-03 | Quién administra hPanel, VPS, GitHub Environment y credenciales | Nombrar responsables individuales | Sí para operación real; no para crear archivos |
| OD-04 | Acceso pre-dominio por túnel SSH para cada revisor | Aprobar como modo privado temporal | Sí para operación pre-dominio |
| OD-05 | Dominio y DNS futuros | Diferir; no bloquea pre-dominio | No |
| OD-06 | Retención mínima de imágenes GHCR | Conservar current + previous + últimas 5 exitosas hasta definir política | No para implementación inicial; sí antes de limpieza automática |
| OD-07 | Disponibilidad/ventana de despliegue | Aceptar breve reemplazo con rollback automático para DEMO | Sí |

## STOP CONDITIONS

Claude Code debe detener solo la parte afectada y reportar evidencia si ocurre cualquiera de estas condiciones:

1. La Task no está aprobada o una decisión marcada como bloqueante sigue abierta.
2. La rama no es `develop` o se requiere tocar `main`.
3. Se necesita modificar un archivo no permitido, producto o `prototype-claude/`.
4. Se encuentra un secreto, dato real o credencial en Git, logs, imagen o frontend; se presume comprometido y se exige rotación.
5. Se requiere abrir PostgreSQL/API públicamente o debilitar firewall/SSH/TLS.
6. Se requiere una migración, seed, limpieza de volumen o cambio destructivo.
7. No existe versión anterior saludable y verificable para rollback.
8. No se pueden fijar imágenes por SHA/digest o validar su procedencia.
9. Los health checks no prueban las tres rutas a través del punto de entrada real.
10. El rollback falla o la versión anterior no vuelve a quedar saludable.
11. Falta espacio, Docker/Compose compatible, acceso autorizado, GHCR, clave SSH o control del VPS.
12. Se pretende publicar HTTP con Basic Auth sin TLS.
13. Se necesita comprar dominio, servicio, backup o herramienta paga no aprobada.
14. Hay contradicción entre esta Task y fuentes autoritativas.
15. Se pretende declarar el entorno apto para datos reales o producción.

Usar **REQUIERE DECISIÓN PRODUCT OWNER** para decisiones materiales y **BLOCKED** para impedimentos externos verificables.

## Expected Handoff

Claude Code debe devolver el handoff de `CLAUDE.md`, además de:

- diff y propósito por archivo;
- permisos efectivos del workflow;
- nombres completos de imágenes y SHA/digests sanitizados;
- `docker compose config` sanitizado;
- tabla de puertos expuestos;
- evidencia de cada health check;
- evidencia de `401`/acceso autorizado o de inaccesibilidad pública en modo túnel;
- prueba de deploy fallido y rollback;
- estado current/previous sin secretos;
- pruebas pasadas, fallidas y `NOT RUN`;
- costos nuevos y riesgos residuales;
- confirmación de cero cambios en archivos prohibidos;
- confirmación de que no hizo commit, push ni despliegue sin autorización separada.

## Readiness Gate

**READY FOR CLAUDE: NO.**

Motivo: la especificación está en `PENDING APPROVAL` y OD-01, OD-02, OD-03, OD-04 y OD-07 requieren decisión de la Product Owner. Tras su aprobación, Claude Code podrá implementar únicamente los archivos permitidos; la creación/configuración de secretos, cambios en GitHub/Hostinger, push y primer despliegue seguirán requiriendo autorización operativa separada.
