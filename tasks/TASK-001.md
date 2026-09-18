# MERDN Task Specification

## Task Identification

- **Task ID:** TASK-001
- **Title:** Crear fundación técnica de MERDN
- **Status:** APPROVED
- **Priority:** HIGH
- **Created by:** Codex — MERDN Lead Architect
- **Approved by:** Product Owner mediante la solicitud expresa de TASK-001

## Objective

Crear únicamente la estructura técnica inicial, ejecutable, reproducible y verificable de MERDN mediante un monorepo simple con frontend Next.js, API NestJS, REST/OpenAPI, PostgreSQL, Prisma y Docker Compose.

La entrega debe demostrar que web, API, conexión técnica a PostgreSQL, toolchain y contenedores funcionan. No debe implementar modelos de negocio, experiencias productivas, autenticación, autorización, tenant isolation, reglas clínicas, módulos institucionales ni integraciones.

## Business Context

### Hechos aprobados

- MERDN se encuentra en la transición desde arquitectura aprobada hacia implementación controlada.
- El stack activo del MVP es TypeScript, Node.js 24 LTS, Next.js App Router, NestJS, REST/OpenAPI, PostgreSQL, Prisma ORM, Docker Compose y Hostinger VPS KVM 4 Brasil.
- `prototype-claude/` es la referencia UX/UI oficial, aprobada y vinculante, pero no es base técnica ni código productivo.
- La aplicación futura será multi-tenant, contextual, auditable y modular; TASK-001 no simula ni implementa todavía esas capacidades.

### Valor de la tarea

Esta tarea establece una base común para que las siguientes Task Specifications puedan implementar seguridad y dominios de MERDN sin rehacer toolchain, estructura, contratos básicos, ejecución local o empaquetado Docker.

### Recomendación implementable

Usar npm workspaces sin Turborepo, Nx u otro orquestador adicional. Mantener solo dos aplicaciones y un paquete compartido inicial. No introducir abstracciones o paquetes sin uso verificable en TASK-001.

## Users Affected

- **Usuarios o roles:** ninguno de los roles funcionales R1–R15 recibe comportamiento nuevo. Los únicos consumidores directos son Claude Code, Codex y desarrolladores autorizados.
- **Instituciones:** no aplica; no se crean tenants, municipios, hospitales, Alcaldías ni instituciones.
- **Impacto esperado:** disponer de una fundación ejecutable y verificable para posteriores tareas aprobadas.

## Modules Affected

- **Módulos en alcance:** ninguno de los módulos funcionales de `docs/MODULES.md`; únicamente infraestructura transversal preparatoria.
- **Módulos relacionados:** identidad, autorización, auditoría, configuración, integración y todos los dominios futuros dependerán de esta fundación, pero no se implementan.
- **Módulos no afectados:** todos los módulos operativos, institucionales, financieros, regulatorios, comerciales, clínicos, documentales y de experiencia de usuario.

## Functional Requirements

1. **FR-01 — Monorepo:** crear un monorepo npm workspaces en la raíz, sin herramienta adicional de orquestación, que incluya `apps/web`, `apps/api` y `packages/shared`.
2. **FR-02 — Toolchain:** fijar Node.js 24 LTS como runtime esperado y TypeScript en modo estricto. Las versiones exactas compatibles de paquetes deben quedar fijadas en `package-lock.json`.
3. **FR-03 — Scripts raíz:** proporcionar scripts raíz para instalar/ejecutar, lint, typecheck, test y build de los workspaces, con salida no interactiva apta para CI.
4. **FR-04 — Frontend ejecutable:** crear una aplicación Next.js con App Router que pueda iniciar y compilar.
5. **FR-05 — Interfaz técnica mínima:** la ruta raíz del frontend debe mostrar únicamente una confirmación técnica sobria —por ejemplo, nombre del proyecto y estado de fundación— sin reconstruir, inventar o reinterpretar pantallas MERDN.
6. **FR-06 — Backend ejecutable:** crear una aplicación NestJS que pueda iniciar, use REST y mantenga una estructura modular mínima sin módulos de negocio.
7. **FR-07 — Health endpoint:** exponer exactamente `GET /health`, sin autenticación en esta tarea, y devolver HTTP 200 con un cuerpo JSON estable mínimo: `{ "status": "ok" }`.
8. **FR-08 — OpenAPI:** configurar Swagger/OpenAPI para documentar la API y el endpoint `/health`. La ruta de documentación debe estar documentada en el README técnico de la aplicación API o configuración equivalente permitida.
9. **FR-09 — Prisma:** instalar y configurar Prisma ORM para PostgreSQL mediante `DATABASE_URL`, con datasource, generator y cliente/servicio técnico cuando sea necesario para compilar y verificar conexión.
10. **FR-10 — Sin esquema de negocio:** `prisma/schema.prisma` no debe contener modelos MERDN, modelos provisionales, tablas de ejemplo ni entidades técnicas inventadas. No crear migraciones de negocio.
11. **FR-11 — Verificación DB:** proporcionar un comando reproducible que confirme que PostgreSQL está disponible y que la configuración Prisma puede conectarse, sin persistir entidades ni datos de negocio.
12. **FR-12 — Docker Compose:** crear Docker Compose de desarrollo para PostgreSQL, API y frontend, con red interna, volumen nombrado para PostgreSQL, health checks y orden de arranque apropiado.
13. **FR-13 — Dockerfiles:** crear imágenes reproducibles de desarrollo/ejecución para web y API compatibles con Docker Compose y con despliegue futuro en Hostinger KVM 4; no desplegar.
14. **FR-14 — Puertos:** exponer solo los puertos de desarrollo documentados. PostgreSQL puede publicarse únicamente en loopback o configuración local explícita para desarrollo; no diseñar una topología pública de producción.
15. **FR-15 — Entorno:** crear `.env.example` raíz o ejemplos equivalentes claramente documentados, con nombres de variables y valores ficticios seguros. Nunca crear/registrar `.env` con secretos reales.
16. **FR-16 — Git hygiene:** crear o actualizar `.gitignore` y `.dockerignore` para excluir `.env`, variantes locales no ejemplares, `node_modules`, builds, coverage, logs, secretos, temporales y datos/volúmenes locales de PostgreSQL.
17. **FR-17 — Calidad:** configurar lint, typecheck, build y pruebas básicas para web y API, evitando reglas duplicadas innecesarias.
18. **FR-18 — Errores de arranque:** web/API deben fallar con mensaje técnico claro y sin revelar secretos cuando falte una variable indispensable; la excepción es que el endpoint `/health` no debe inventar estado saludable de dependencias no comprobadas.
19. **FR-19 — Documentación técnica mínima:** documentar comandos de instalación, ejecución local, Docker Compose, lint, typecheck, test, build, verificación de PostgreSQL/Prisma y parada limpia dentro de archivos README permitidos en las áreas nuevas.
20. **FR-20 — Portabilidad Hostinger:** no usar dependencias de Azure, Kubernetes o servicios administrados para arrancar; Docker Compose debe ser portable a un VPS Linux KVM 4 mediante configuración posterior.

## Data Requirements

| Dato o entidad | Uso | Propietario institucional | Procedencia | Sensibilidad | Retención/linaje | Restricciones |
| --- | --- | --- | --- | --- | --- | --- |
| Configuración técnica no secreta | Arranque de web/API/Prisma/Docker | Proyecto MERDN | Repositorio/configuración aprobada | INTERNAL | Versionada en Git | No incluir valores reales ni datos de negocio |
| Variables secretas locales | Conexión de desarrollo | Operador local | Entorno local | CONFIDENTIAL | No se versionan | Solo valores ficticios locales; `.env.example` sin secretos |
| Respuesta `/health` | Confirmar que API responde | Plataforma técnica | API MERDN | PUBLIC técnico | No requiere persistencia | Solo `{ "status": "ok" }`; sin infraestructura, versión sensible o secretos |
| Datos PostgreSQL locales | Verificación técnica de conexión | Entorno de desarrollo | Docker local | INTERNAL técnico | Volumen local descartable | No crear tablas/modelos/datos MERDN |

- **Entradas:** configuración técnica y variables de entorno validadas; solicitud HTTP sin payload a `GET /health`.
- **Salidas:** build artifacts ignorados, logs técnicos seguros, OpenAPI generado en runtime y respuesta health mínima.
- **Datos prohibidos:** personas, cuentas, usuarios, pacientes, cuidadores, profesionales, instituciones, municipios, programas, clínica, finanzas, regulación, evidencia de negocio, pagos, credenciales reales o cualquier dato personal/sensible.
- **Datos reales en pruebas:** prohibidos. Usar solo valores ficticios y una base PostgreSQL local vacía.

## Permissions

No se implementa un modelo de permisos en TASK-001. Crear autorización simulada, roles hard-coded, middleware de tenant o controles visuales ficticios está prohibido.

| Acción | Roles autorizados | Recurso y alcance | Condiciones | Denegaciones explícitas |
| --- | --- | --- | --- | --- |
| VER | Público técnico local | `GET /health` | Solo respuesta mínima; entorno DEV | No exponer configuración, DB, secretos ni datos de host |
| CREAR | No aplica | No hay recursos de negocio | No aplica | Toda creación de datos MERDN está fuera de alcance |
| EDITAR | No aplica | No hay recursos de negocio | No aplica | No implementar endpoints de mutación |
| APROBAR | No aplica | No hay workflows | No aplica | No implementar |
| ASIGNAR | No aplica | No hay asignaciones | No aplica | No implementar |
| CERRAR | No aplica | No hay ciclos de negocio | No aplica | No implementar |
| EXPORTAR | No aplica | No hay datos exportables | No aplica | No implementar |
| ADMINISTRAR | No aplica | No hay consola de administración | No aplica | No implementar |

## Institutional Context

- **Tenant/institución:** no aplica; no crear tenant, organización ni contexto activo.
- **Municipio/territorio:** no aplica.
- **Programa/servicio:** no aplica.
- **Relaciones y asignaciones:** no aplica.
- **Regla de aislamiento:** TASK-001 debe evitar afirmar o simular aislamiento. La estructura de API debe permitir incorporar contexto y policy service en tareas posteriores sin depender de variables globales de negocio.

## Audit Requirements

No se implementa auditoría de negocio ni tabla de eventos en TASK-001.

| Evento | Actor | Recurso | Cuándo | Datos mínimos | Datos que deben minimizarse | Resultado esperado |
| --- | --- | --- | --- | --- | --- | --- |
| Arranque técnico | Proceso web/API | Aplicación | Inicio/fallo de proceso | servicio, entorno, resultado | variables, URL con credenciales, stack sensible | Log técnico seguro |
| Health request | Cliente técnico | `/health` | Solicitud | método, ruta, estado, correlación si existe | IP/headers innecesarios, secretos | HTTP 200 estable |

Los logs técnicos no deben presentarse como auditoría append-only de MERDN. La auditoría real será objeto de una Task Specification posterior.

## Security Requirements

1. No implementar autenticación en TASK-001.
2. No implementar autorización o tenant isolation ficticios.
3. No almacenar secretos, contraseñas o connection strings reales en el repositorio, imágenes o logs.
4. `.env.example` debe usar valores claramente ficticios y seguros; `.env` debe quedar ignorado.
5. El contenedor PostgreSQL debe usar credenciales locales configurables y no reutilizar valores de producción.
6. No exponer PostgreSQL, Swagger o herramientas administrativas como si fueran una configuración segura de producción. Documentar su finalidad local.
7. Validar variables requeridas en arranque y redactar errores/logs.
8. Ejecutar procesos de aplicación como usuario no-root dentro de imágenes finales cuando las imágenes elegidas lo permitan sin complejidad desproporcionada.
9. Usar imágenes base oficiales, versiones explícitas y dependencias mínimas.
10. No añadir SDKs de Azure, Hostinger, pagos, mensajería, identidad o integraciones.
11. Comprobar que archivos ignorados, artifacts y volúmenes locales no entren en Git ni en el contexto Docker innecesariamente.
12. No declarar cumplimiento, seguridad multi-tenant, auditoría, cifrado o aptitud clínica que aún no estén implementados.

## Regulatory and Evidence Requirements

| Área | Evaluación | Requisito aprobado, evidencia y restricción |
| --- | --- | --- |
| FURAG/MIPG | NO AFECTA | No crear modelos, rutas, datos, fórmulas ni pantallas |
| ADRES | NO AFECTA | No crear integración, datos, evaluación ni referencia funcional |
| Sentencia T-319 de 2025 | NO AFECTA | No crear interpretación, requisito ni flujo |
| SENA | NO AFECTA | No crear formación, certificado ni integración |
| Hub Institucional, Normativo y de Evidencias | NO AFECTA | No crear estructura de dominio en TASK-001 |
| Presupuesto y movimiento financiero | NO AFECTA | No crear entidades, cálculos ni endpoints |
| Evidencias | NO AFECTA | No implementar almacenamiento ni evidencia de negocio; el puerto documental queda para tarea posterior |
| Indicadores | NO AFECTA | No crear definiciones, resultados ni datos demostrativos |
| Otros requisitos institucionales | NO AFECTA | No afirmar cumplimiento ni automatización |

## Hospital Commercial Impact

| Área | Evaluación | Comportamiento aprobado y restricción |
| --- | --- | --- |
| Agenda | NO AFECTA | No implementar agenda productiva |
| Servicios | NO AFECTA | No implementar catálogo de servicios |
| Visitas | NO AFECTA | No implementar visitas |
| Consultas virtuales | NO AFECTA | No implementar consultas ni proveedor |
| Membresías | NO AFECTA | No implementar planes o afiliaciones comerciales |
| Pagos | NO AFECTA | No implementar referencias ni procesamiento |
| Ingresos | NO AFECTA | No implementar cálculos ni reportes |
| Evidencia de prestación | NO AFECTA | No implementar evidencia de negocio |

## Visual Reference

- **Referencia(s):** `prototype-claude/**`, solo como referencia UX/UI oficial y vinculante.
- **Elementos vinculantes:** identidad visual, navegación, lenguaje, dashboards, experiencias por portal, personaje Elí, accesibilidad visual y flujos aprobados; no se reconstruyen en esta tarea.
- **Elementos solo orientativos:** ninguno autoriza copiar estado, datos, reglas, permisos o implementación.
- **Interfaz temporal permitida:** página técnica mínima y neutral para comprobar que Next.js funciona. Debe identificarse como fundación técnica, no como propuesta visual MERDN.
- **Restricción:** `prototype-claude/` es de solo lectura y no constituye código, datos, permisos ni reglas clínicas de producción. No usar `.dc.html`, `support.js`, estado inline o datos demostrativos como base productiva.
- **Control de cambios:** si Claude Code considera necesario cambiar, agregar o eliminar una pantalla, flujo o componente, debe detener esa parte, documentar la necesidad exactamente como **REQUIERE CLAUDE DESIGN** y esperar aprobación del Product Owner.

## Allowed Files

Claude Code puede crear o modificar exclusivamente:

- `package.json` — workspaces, engines y scripts raíz.
- `package-lock.json` — versiones exactas resueltas por npm.
- `.npmrc` — solo configuración reproducible no secreta, si resulta necesaria.
- `.nvmrc` o `.node-version` — fijar Node.js 24 LTS; elegir solo uno.
- `tsconfig.base.json` — configuración TypeScript compartida.
- `eslint.config.*` — configuración lint raíz, si se centraliza.
- `.prettierignore`, `.prettierrc*` — únicamente si Prettier se incluye justificadamente.
- `.gitignore` — exclusiones seguras necesarias.
- `.dockerignore` — minimizar contexto y excluir secretos/artifacts.
- `.env.example` — variables ficticias de ejemplo sin secretos.
- `docker-compose.yml` o `compose.yml` — elegir un solo nombre para desarrollo local.
- `apps/web/**` — aplicación Next.js técnica mínima, configuración, pruebas, README y Dockerfile.
- `apps/api/**` — aplicación NestJS, `/health`, OpenAPI, configuración, pruebas, README y Dockerfile.
- `packages/shared/**` — únicamente tipos/esquemas técnicos efectivamente compartidos; puede permanecer mínimo.
- `prisma/schema.prisma` — datasource/generator PostgreSQL sin modelos.
- `prisma/README.md` — instrucciones de configuración/verificación, si se necesita.
- `prisma.config.ts` — configuración Prisma sin secretos, si la versión fijada lo requiere.
- `tests/**` — solo pruebas técnicas transversales de TASK-001 si no pertenecen a una app.

Toda ruta no listada se considera fuera de alcance. Si un generador intenta crear un archivo fuera de estas rutas, Claude Code debe impedirlo o detenerse antes de conservarlo.

## Forbidden Files

- `prototype-claude/**`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/**`
- `tasks/**`, incluido `tasks/TASK-001.md`
- `reviews/**`
- `.git/**`
- `main` y su historial
- cualquier archivo existente no enumerado en **Allowed Files**
- migraciones Prisma y SQL de negocio
- archivos `.env` reales, certificados, claves, tokens o credenciales
- datos locales de PostgreSQL o directorios de volúmenes

No eliminar, renombrar, reescribir ni convertir archivos protegidos.

## Dependencies

### Functional Dependencies

- Decisiones aprobadas en `docs/ARCHITECTURE.md` y `docs/SECURITY.md`.
- Esta tarea precede a identidad, multi-tenancy, autorización, auditoría y dominios de negocio.

### Technical Dependencies

- Node.js 24 LTS y npm compatible.
- Docker Engine y Docker Compose v2 para verificación completa.
- Imágenes oficiales de Node.js y PostgreSQL con versiones explícitas y compatibles.
- Dependencias mínimas de Next.js, React, NestJS, Swagger/OpenAPI, Prisma, TypeScript, lint y testing.
- npm workspaces es obligatorio para TASK-001; no añadir pnpm, yarn, Turborepo, Nx, Kubernetes, Redis, broker, MinIO, SDK cloud ni UI kit.

### Integration and Failure Behavior

- No hay integraciones externas.
- Si Docker no está disponible, Claude Code debe ejecutar y evidenciar todas las verificaciones no Docker, marcar las pruebas Docker como no ejecutadas y reportar el bloqueo; no debe simular resultados.
- Si no puede obtener dependencias por red, debe reportar el error y no sustituir el stack.
- Si Prisma exige crear un modelo para una operación concreta, no debe inventarlo: debe elegir una verificación de conexión soportada sin modelos o detenerse y reportar la incompatibilidad.
- Un fallo de PostgreSQL debe producir un error técnico claro en el comando de verificación; no debe hacer que `/health` afirme salud de DB si esta no se comprobó.

## Approved Decisions

1. **AD-01:** Stack activo: TypeScript, Node.js 24 LTS, Next.js App Router, NestJS, REST/OpenAPI, PostgreSQL, Prisma ORM y Docker Compose.
2. **AD-02:** Infraestructura objetivo del MVP: Hostinger VPS KVM 4 Brasil; TASK-001 no despliega.
3. **AD-03:** Monorepo mediante npm workspaces, sin orquestador adicional.
4. **AD-04:** Estructura inicial: `apps/web`, `apps/api`, `packages/shared` y `prisma`.
5. **AD-05:** Único endpoint de aplicación permitido: `GET /health` con HTTP 200 y `{ "status": "ok" }`.
6. **AD-06:** Prisma se prepara sin modelos ni migraciones de negocio.
7. **AD-07:** Docker Compose local contiene PostgreSQL, API y frontend.
8. **AD-08:** Solo configuración ficticia; ningún secreto real.
9. **AD-09:** No se implementan autenticación, autorización, tenant isolation ni auditoría de negocio en esta tarea.
10. **AD-10:** `prototype-claude/` es referencia UX/UI vinculante de solo lectura y no base productiva.

## Open Decisions

| ID | Decisión requerida | Autoridad | Impacto | ¿Bloquea? |
| --- | --- | --- | --- | --- |
| OD-01 | Seleccionar versiones patch/minor estables y mutuamente compatibles dentro del stack y majors aprobados, y fijarlas en lockfile | Claude Code, decisión local reportada | Reproducibilidad | No |
| OD-02 | Elegir `docker-compose.yml` o `compose.yml`, no ambos | Claude Code, decisión local reportada | Convención de archivo | No |
| OD-03 | Elegir Vitest o el runner mínimo compatible que generen los starters, evitando duplicación | Claude Code, decisión local reportada | Tests técnicos | No |

No existe una decisión material abierta que autorice ampliar el alcance. Claude Code debe aplicar las STOP CONDITIONS de `CLAUDE.md` ante cualquier incompatibilidad o decisión estructural nueva.

## Out of Scope

- Autenticación, recuperación, sesiones o proveedor OIDC.
- Roles, permisos, policy service o autorización.
- Tenant, aislamiento, RLS, organización activa o contexto institucional.
- Personas, cuentas MERDN, usuarios, pacientes, cuidadores o profesionales.
- Municipios, territorios, instituciones, hospitales, Alcaldías, sedes o programas.
- Bitácoras, agenda productiva, citas, visitas, consultas virtuales, alertas o seguimiento.
- Información clínica, importación hospitalaria, medicamentos o reglas clínicas.
- FURAG, MIPG, ADRES, Sentencia T-319 de 2025, SENA o Hub Normativo.
- Presupuesto, fuentes, asignaciones, gastos, ejecución, proveedores, contratos o finanzas.
- Documentos o evidencias de negocio y almacenamiento documental productivo.
- Indicadores, fórmulas, porcentajes, dashboards o reportes.
- Catálogo hospitalario, membresías, cobros, pagos o ingresos.
- Elí, notificaciones, comunicaciones o integraciones externas.
- Reconstrucción o rediseño de pantallas de `prototype-claude/`.
- Despliegue, dominio, SSL, firewall, backups o monitoreo en Hostinger.
- Azure, servicios cloud administrados, infraestructura como código o CI/CD remoto.
- Refactorización o modificación de documentación, prototipo, tasks o reviews.
- Git commit, push, merge, rebase, branch deletion, pull request, release o deployment.

## Acceptance Criteria

1. **AC-01:** existe un monorepo npm workspaces válido con `apps/web`, `apps/api` y `packages/shared`, sin Turborepo/Nx/pnpm/yarn.
2. **AC-02:** la configuración de runtime declara Node.js 24 LTS y TypeScript estricto; `npm install` produce/usa un `package-lock.json` reproducible.
3. **AC-03:** el frontend Next.js App Router inicia sin error y su ruta raíz muestra únicamente una interfaz técnica mínima, sin copiar ni rediseñar MERDN.
4. **AC-04:** el backend NestJS inicia sin error y expone REST.
5. **AC-05:** `GET /health` devuelve HTTP 200, `Content-Type` JSON y exactamente el contrato `{ "status": "ok" }` sin datos adicionales sensibles.
6. **AC-06:** OpenAPI inicia y documenta `/health`; no documenta endpoints de negocio inexistentes.
7. **AC-07:** Prisma 7 está configurado para PostgreSQL mediante `prisma.config.ts` y `DATABASE_URL`; `prisma db execute --stdin` puede ejecutar una sentencia no mutante de conexión contra PostgreSQL local sin modelos/tablas MERDN.
8. **AC-08:** `prisma/schema.prisma` no contiene ningún `model`; no existen migraciones SQL ni datos seed.
9. **AC-09:** Docker Compose valida su configuración y levanta PostgreSQL, API y frontend hasta estado healthy/ready según los checks definidos.
10. **AC-10:** desde un entorno limpio y siguiendo la documentación, una solicitud al health endpoint del stack Docker obtiene el resultado de AC-05.
11. **AC-11:** los builds de frontend y backend terminan exitosamente.
12. **AC-12:** el typecheck estricto termina exitosamente en todos los workspaces aplicables.
13. **AC-13:** lint termina exitosamente sin deshabilitaciones globales injustificadas.
14. **AC-14:** las pruebas básicas de frontend, API y `/health` terminan exitosamente.
15. **AC-15:** `.env`, `node_modules`, builds, coverage, logs, secretos y datos locales PostgreSQL quedan ignorados; `.env.example` contiene solo valores ficticios.
16. **AC-16:** una búsqueda de secretos no encuentra credenciales, tokens, claves privadas o connection strings reales en archivos versionables.
17. **AC-17:** ninguna dependencia o configuración activa requiere Azure, Hostinger API, Kubernetes, broker, pagos, autenticación o servicios externos.
18. **AC-18:** `prototype-claude/**`, `docs/**`, `tasks/**`, `reviews/**`, `AGENTS.md` y `CLAUDE.md` permanecen byte-for-byte sin cambios.
19. **AC-19:** no existen entidades, endpoints, pantallas ni fixtures de los dominios declarados fuera de alcance.
20. **AC-20:** la documentación técnica permitida reproduce instalación, ejecución, verificación, parada y limpieza no destructiva del entorno local.

## Required Tests

Los comandos exactos pueden adaptarse a los scripts finalmente definidos, pero Claude Code debe registrar los comandos reales y su salida.

| Test ID | Tipo | Escenario | Resultado esperado | Evidencia requerida |
| --- | --- | --- | --- | --- |
| T-01 | Toolchain | Verificar versión Node/npm y workspaces | Node 24 LTS; workspaces detectados | comandos y versiones |
| T-02 | Static | Ejecutar lint raíz | Exit 0 en web, API y shared aplicable | comando/salida |
| T-03 | Static | Ejecutar typecheck raíz | Exit 0 con strict TypeScript | comando/salida |
| T-04 | Unit | Ejecutar tests frontend | Página técnica/componente mínimo pasa | comando/salida |
| T-05 | Unit | Ejecutar tests API | Health controller/service pasa | comando/salida |
| T-06 | API | Probar `GET /health` | HTTP 200 y `{ "status": "ok" }` | test automatizado y salida |
| T-07 | OpenAPI | Inspeccionar documento generado | Incluye GET `/health`; sin rutas de negocio | assertion automatizada o evidencia reproducible |
| T-08 | Build | Compilar frontend | Exit 0 | comando/salida |
| T-09 | Build | Compilar backend | Exit 0 | comando/salida |
| T-10 | Prisma | Inspeccionar/configurar `schema.prisma` y `prisma.config.ts` sin modelos de negocio | Datasource PostgreSQL y generator presentes; cero bloques `model` | evidencia de archivos y comando de formato/validación solo si la versión lo soporta sin modelos |
| T-11 | Database integration | Ejecutar mediante Prisma 7 y `prisma.config.ts` una sentencia no mutante como `SELECT 1` contra PostgreSQL Docker usando `prisma db execute --stdin` | Exit 0, sin crear entidades/datos MERDN | comando/salida y verificación de ausencia de tablas de negocio |
| T-12 | Docker | Ejecutar `docker compose config` | Exit 0, sin secretos reales incrustados | comando/salida redactada |
| T-13 | Docker/E2E | Levantar stack desde limpio | PostgreSQL healthy, API y web disponibles | `docker compose ps` y logs seguros |
| T-14 | E2E | Solicitar health al stack Docker | Resultado de AC-05 | comando HTTP/salida |
| T-15 | E2E | Solicitar página raíz web | HTTP 200 y contenido técnico mínimo | comando/test/salida |
| T-16 | Security | Revisar archivos versionables por secretos y artifacts | Ningún secreto real ni artifact prohibido | comando/patrones y salida |
| T-17 | Scope | Comparar archivos cambiados con allowlist | Solo archivos permitidos; protegidos intactos | `git status`, `git diff --name-only`, hashes si aplica |
| T-18 | Regression | Ejecutar lint + typecheck + test + build tras Docker verification | Todo exit 0 | resumen consolidado |

- **Pruebas de regresión:** no existe código productivo previo; se exige que los nuevos scripts completos pasen juntos.
- **Pruebas negativas:** ausencia de `DATABASE_URL` en el comando que la requiere produce fallo claro sin imprimir credenciales; `/health` no expone entorno/DB; no hay endpoints de mutación ni negocio.
- **Entorno y datos:** Node.js 24 LTS, npm, Docker Compose v2 y datos exclusivamente ficticios. El volumen PostgreSQL de prueba debe tener nombre de proyecto específico y limpiarse solo mediante el comando documentado, sin afectar otros volúmenes.

## Expected Handoff

Claude Code debe entregar a Codex el handoff estructurado definido en `CLAUDE.md`, incluyendo:

1. Task ID, estado y resumen del resultado.
2. Lista completa de archivos creados, modificados o eliminados y propósito de cada uno.
3. Versiones exactas de Node, npm, Next.js, NestJS, PostgreSQL, Prisma, TypeScript, Docker images y dependencias principales.
4. Justificación de cualquier decisión local OD-01 a OD-03.
5. Confirmación explícita de que no creó modelos, migraciones, seeds ni datos de negocio.
6. Confirmación de que no implementó autenticación, autorización, tenant isolation o auditoría ficticios.
7. Cumplimiento de AC-01 a AC-20 con evidencia individual.
8. Comandos exactos y resultados de T-01 a T-18; fallos, omitidos o no ejecutados y motivo.
9. Salida de Docker Compose, health checks, Prisma/PostgreSQL y builds, sin secretos.
10. Evidencia de revisión de secretos y del alcance de archivos.
11. Confirmación de que `prototype-claude/**` y todos los archivos prohibidos permanecen intactos.
12. Riesgos residuales, supuestos, errores conocidos, desviaciones y STOP CONDITIONS.
13. Referencias concretas necesarias para la auditoría de Codex.

El handoff inicia la revisión de Codex y no equivale a aceptación del Product Owner. Claude Code no debe hacer commit, push, merge, pull request, release ni despliegue.
