# MERDN — Arquitectura técnica de referencia

## 1. Estado y propósito

Este documento define la arquitectura técnica recomendada para iniciar la implementación de MERDN. Debe leerse junto con `AGENTS.md`, `CLAUDE.md`, `docs/PRODUCT.md`, `docs/MODULES.md`, `docs/ROLES.md`, `docs/DATA.md` y `docs/SECURITY.md`.

La arquitectura es concreta, pero no autoriza por sí sola implementar todos los dominios. Cada cambio significativo requiere una Task Specification aprobada, criterios de aceptación, pruebas y posterior auditoría de Codex.

Decisiones de estado:

- **APROBADO:** proviene del Product Owner o de documentación autoritativa.
- **RECOMENDADO:** decisión arquitectónica propuesta como línea base ejecutable.
- **POR DEFINIR:** detalle que debe resolverse antes del flujo específico, pero que no impide crear la base técnica.

## 2. Objetivos y restricciones

La arquitectura debe:

1. aislar tenants desde el primer dato persistido;
2. soportar múltiples municipios, instituciones, sedes y programas sin valores de piloto codificados;
3. servir portales diferenciados de Paciente, Cuidador, Profesional, Hospital y Alcaldía mediante capacidades compartidas;
4. evaluar autorización por rol, institución, relación, asignación, finalidad, vigencia y sensibilidad;
5. separar datos operativos, clínicos autorizados, financieros, institucionales, regulatorios, documentales y de auditoría;
6. registrar auditoría conceptualmente append-only y procedencia;
7. preservar FURAG/MIPG, ADRES, Sentencia T-319 de 2025, SENA, Hub Normativo, presupuesto, ejecución, indicadores, agenda, visitas, consultas virtuales, membresías, pagos controlados, servicios e ingresos hospitalarios;
8. permitir una primera entrega rápida sin microservicios ni infraestructura prematura;
9. mantener `prototype-claude/` como referencia visual y funcional de solo lectura, nunca como runtime, persistencia o base técnica.

### 2.1 Decisión final de infraestructura y stack del MVP

**APROBADO — Infraestructura activa:** Hostinger VPS KVM 4 en Brasil, desplegado mediante Docker Compose.

**APROBADO — Stack activo:** TypeScript, Node.js 24 LTS, Next.js App Router, NestJS, REST/OpenAPI, PostgreSQL, Prisma ORM, Docker Compose y Hostinger KVM 4.

**APROBADO — Almacenamiento documental:** la aplicación usa una abstracción de almacenamiento. El proveedor activo del MVP persiste archivos de forma controlada en un volumen privado del VPS. La semántica, autorización, procedencia, versiones y relaciones permanecen en PostgreSQL. La aplicación no depende de Azure Blob ni de una API propietaria de almacenamiento.

**FUTURO CONDICIONADO:** Azure puede evaluarse para producción únicamente si requisitos aprobados de seguridad, cumplimiento, disponibilidad o escalabilidad lo justifican. Azure Container Apps, Azure Blob, Azure Database for PostgreSQL y Azure Monitor no forman parte de la infraestructura activa del MVP.

## 3. Estilo arquitectónico

### 3.1 Decisión principal

**RECOMENDACIÓN:** monorepo TypeScript con un frontend Next.js, una API NestJS, un worker NestJS y paquetes compartidos; backend organizado como monolito modular con una sola base PostgreSQL y almacenamiento documental externo.

**RAZÓN:** un monolito modular entrega rápido, permite transacciones consistentes entre operación, evidencia y auditoría, reduce despliegues y conserva límites de dominio que pueden extraerse solo cuando exista una necesidad demostrada.

**ALTERNATIVA:** microservicios por dominio o backend completo dentro de Next.js.

**RIESGO:** un monolito sin reglas de dependencia puede convertirse en una masa acoplada. Se mitiga con módulos, interfaces públicas, ownership claro, pruebas de arquitectura y prohibición de consultas cruzadas informales.

### 3.2 Vista de contenedores

```text
Navegador
  └─ HTTPS ─> Web Next.js
                └─ HTTPS/OIDC ─> API NestJS
                                  ├─ PostgreSQL
                                  ├─ almacenamiento documental por adapter
                                  ├─ Proveedor OIDC
                                  ├─ Worker / outbox
                                  └─ Adaptadores externos
                                      ├─ hospital
                                      ├─ mensajería
                                      ├─ videoconferencia
                                      ├─ pagos futuros
                                      └─ fuentes institucionales futuras

API y Worker
  └─ telemetría estructurada ─> collector/servicio de observabilidad
```

El navegador nunca accede directamente a PostgreSQL ni usa credenciales permanentes de almacenamiento. Todo acceso de negocio pasa por la API y su política contextual.

## 4. Organización del repositorio recomendada

```text
apps/
  web/                 portal Next.js y experiencias por contexto
  api/                 API NestJS
  worker/              procesamiento de outbox, importaciones y notificaciones
packages/
  contracts/           contratos API y esquemas de validación compartidos
  ui/                  componentes accesibles y design tokens
  config/              configuración tipada sin secretos
  testing/             factories ficticias y utilidades de pruebas
docs/                  arquitectura y especificaciones
prototype-claude/      referencia protegida, fuera del build productivo
```

Los módulos de negocio viven dentro de `apps/api/src/modules/` y se alinean inicialmente con:

- identity-access;
- tenancy-organizations;
- people-relationships;
- programs-population;
- scheduling-care-operations;
- authorized-clinical;
- documents-evidence;
- finance-resources;
- indicators-reporting;
- institutional-hub;
- training-certification;
- hospital-commercial;
- audit;
- integrations;
- notifications;
- shared-configuration.

Un módulo expone servicios de aplicación o puertos explícitos. No se permite que otro módulo consulte directamente sus repositorios o escriba sus tablas conceptuales para evitar sus invariantes.

## 5. Decisiones tecnológicas

| Área | RECOMENDACIÓN | RAZÓN | ALTERNATIVA | RIESGO y mitigación |
| --- | --- | --- | --- | --- |
| Lenguaje y runtime | TypeScript estricto sobre Node.js 24 LTS; versiones exactas fijadas en toolchain y lockfile | Un lenguaje compartido reduce fricción; LTS mejora estabilidad | .NET 10/C# | Ecosistema npm y supply chain; lockfile, actualización controlada, escaneo y dependencias mínimas |
| Monorepo | pnpm workspaces; Turborepo solo si aporta caché y orquestación desde el inicio | Workspaces bastan para compartir contratos y UI; bajo coste | Nx o repos separados | Configuración compleja si se añade tooling innecesario; iniciar con pnpm y scripts simples |
| Frontend | Next.js estable con App Router, React y TypeScript; renderizado servidor cuando aporte seguridad/rendimiento y componentes cliente solo donde sean necesarios | Routing, layouts por portal, accesibilidad y ecosistema maduro | React + Vite SPA | Next.js puede mezclar lógica web y negocio; toda regla y acceso permanecen en API |
| UI | Componentes propios accesibles sobre primitivas sin estilo como Radix UI; CSS mediante Tailwind CSS; tokens derivados y aprobados desde el prototipo | Rapidez sin copiar runtime del prototipo; consistencia y accesibilidad | MUI | Riesgo de dependencia visual y HTML complejo; envolver primitivas en `packages/ui` |
| Backend | NestJS estable con adaptador HTTP estándar y módulos por dominio | Guards, pipes, módulos, inyección y testing facilitan una API mantenible | Fastify puro o .NET modular monolith | Decoradores pueden ocultar dependencias; mantener capas explícitas y módulos pequeños |
| API | REST JSON versionada bajo `/api/v1`; OpenAPI generado y contratos validados | Simple para web, integraciones y pruebas; buen soporte de autorización por recurso | GraphQL | Over/under-fetching moderado; endpoints orientados a casos de uso, paginación y sparse fields solo si se justifican |
| Validación | Esquemas Zod compartidos en límites externos y validación explícita en API | Contratos ejecutables y tipados entre web/API | class-validator | Duplicación con tipos ORM; los contratos nunca se generan desde modelos de persistencia |
| Base de datos | PostgreSQL en contenedor privado del Hostinger KVM 4 para el MVP; una base por entorno y esquema lógico compartido por tenants | Relaciones, integridad, transacciones, JSON limitado y Row-Level Security encajan con MERDN | Servicio PostgreSQL administrado futuro si seguridad/disponibilidad/escalabilidad lo justifican | En VPS MERDN asume parcheo, tuning y recuperación; doble control repositorio + RLS, claves compuestas, backups y pruebas de aislamiento |
| ORM y migraciones | Prisma ORM 7 con Prisma Migrate; repositorios de dominio ocultan Prisma; SQL revisado para RLS, constraints y características no expresables | Tipado, productividad y migraciones versionadas; permite personalizar migraciones | Drizzle ORM | Prisma no expresa toda política PostgreSQL; revisar SQL generado y mantener pruebas directas de RLS |
| Autenticación | Microsoft Entra External ID mediante OIDC/OAuth 2.0 para usuarios externos y federación institucional cuando se apruebe; API valida tokens | Evita almacenar contraseñas; soporta clientes y federación empresarial | Auth0 o Keycloak | Coste, disponibilidad y configuración del proveedor; encapsular OIDC y mantener autorización de negocio fuera del token |
| Autorización | Motor de política interno en la API: RBAC contextual más relaciones, asignaciones, finalidad, vigencia y sensibilidad; guard global + policy service + consultas con scope obligatorio | Implementa exactamente `ROLES.md` y permite decisiones explicables | OPA/Cedar externo desde el inicio | Política dispersa o bypass; punto único de decisión, deny-by-default y tests matriciales. Externalizar solo si la complejidad lo exige |
| Multi-tenancy | Tenant resuelto desde afiliación y contexto activo, nunca desde un identificador confiado del cliente; scope explícito en servicios/repositorios y PostgreSQL RLS como defensa adicional | Aislamiento en API y datos; compatible con persona única por tenant | Base/esquema por tenant | RLS con pool exige contexto transaccional correcto; `SET LOCAL`, rol runtime sin BYPASSRLS y pruebas de conexiones reutilizadas |
| Documentos | Puerto de almacenamiento con proveedor activo `VPS persistent storage`: volumen privado y persistente del Hostinger KVM 4; proveedores futuros S3-compatible, Azure Blob u otros se conectan por adapter | Mantiene portable la aplicación; PostgreSQL conserva semántica, autorización y trazabilidad | Guardar binarios en PostgreSQL o acoplarse directamente a un proveedor cloud | El volumen comparte el punto de falla del VPS; cuarentena, checksum, copia cifrada externa y restauración probada |
| Auditoría | Tabla/event store append-only en PostgreSQL, escrita dentro de la transacción material cuando sea posible; rol runtime sin UPDATE/DELETE; eventos de acceso complementarios | Consistencia entre cambio y evidencia; baja complejidad inicial | Servicio/event store separado | Administrador DB aún puede alterar; controles privilegiados, backups, alertas y futura exportación WORM si el riesgo lo exige |
| Asincronía | Outbox transaccional en PostgreSQL y worker separado; sin broker en el MVP | Entrega confiable y menos infraestructura | Broker administrado futuro si el volumen lo justifica | Polling/carga y duplicados; consumidores idempotentes, locks, backoff y métricas |
| Notificaciones | Bandeja interna activa; puertos para proveedores externos aprobados posteriormente | Cumple MVP sin exponer datos por canales externos no aprobados | Email/SMS/WhatsApp directos desde API | Información sensible en mensajes; plantillas aprobadas, minimización, preferencias y outbox |
| Pagos | En MVP solo cobros y referencias/estados controlados; puerto de pagos sin proveedor productivo. Stripe o proveedor local se evalúa después de aprobación | Respeta el alcance: MERDN no procesa pagos todavía | Integrar gateway inmediatamente | Riesgo PCI, fraude y conciliación; no almacenar PAN/CVV/tokens sensibles y no activar hasta especificación independiente |
| Testing | Vitest para unidades; Supertest para API; PostgreSQL real en integración; Playwright para E2E/accesibilidad; axe-core; contract tests para adaptadores | Cubre reglas, persistencia, permisos, tenant y portales | Jest/Cypress | Suite lenta o falsos mocks; pirámide de pruebas, datos ficticios y DB efímera en CI |
| Entornos | DEV local, TEST efímero y MVP activo en Hostinger; cualquier PROD futuro permanece separado | Permite iniciar a bajo costo sin convertir el MVP en producción clínica | Plataforma administrada futura si los requisitos lo justifican | Fuga de datos/configuración y drift; usar solo datos ficticios/controlados en MVP, no copiar PROD y promover artefactos inmutables |
| Hosting | **APROBADO:** Hostinger VPS KVM 4 en Brasil como infraestructura activa del MVP mediante Docker Compose | Recursos suficientes para web, API, worker, PostgreSQL y almacenamiento controlado con operación simple | Plataforma administrada futura, incluido Azure, solo por necesidad aprobada | VPS único autogestionado es punto único de falla y exige hardening, backup, restauración y monitoreo |
| Backups | En Hostinger MVP: backups diarios contratados, backup lógico PostgreSQL y copia cifrada fuera del VPS; snapshots solo para cambios puntuales | Los backups nativos del VPS tienen retención corta y restauran el servidor completo; una copia independiente reduce fallo común | Servicio administrado futuro con PITR si seguridad/disponibilidad lo justifican | Backup no exportable, inconsistente o comprometido junto al VPS; usar copia offsite cifrada, checks de integridad y simulacros |
| Logging y monitoreo | Logs JSON redactados y OpenTelemetry; métricas hPanel más collector liviano, alertas y uptime externos | hPanel muestra recursos del VPS, pero no sustituye observabilidad de aplicación, seguridad ni alertamiento independiente | Servicio SaaS o cloud futuro compatible con OpenTelemetry | Consumo de recursos, ruido o filtración; límites, retención, redacción y separación log/auditoría/incidente |

## 6. Frontend y portales

Una sola aplicación web sirve experiencias diferenciadas. No se crean cinco aplicaciones ni copias de componentes.

### 6.1 Autoridad del diseño Claude Design

**APROBADO:** el diseño existente en `prototype-claude/` es la referencia UX/UI aprobada por el Product Owner. Es vinculante para reconstruir técnicamente las experiencias, aunque sus archivos, runtime, datos estáticos y reglas demostrativas no formen parte de la arquitectura productiva.

La implementación debe preservar:

- identidad visual, composición, color, tipografía, iconografía y jerarquía aprobadas;
- estructura de navegación y arquitectura de información;
- lenguaje, tono, etiquetas y contenido aprobado;
- organización de dashboards y prioridad visual de la información;
- experiencias diferenciadas de Paciente, Cuidador, Profesional, Hospital y Alcaldía;
- personaje Elí, su presencia visual y su papel de guía no clínica;
- accesibilidad visual, legibilidad y ayudas de interacción;
- flujos, pasos, estados y transiciones ya aprobados.

La reconstrucción puede sustituir la implementación técnica del prototipo por componentes productivos accesibles, responsivos, tipados y conectados a la API. Esa sustitución técnica no autoriza cambiar el concepto, contenido, orden, propósito o comportamiento visible de una pantalla por conveniencia de desarrollo.

`prototype-claude/` permanece protegido y fuera del build productivo. No se copia su estado inline, `support.js`, `.dc.html`, datos demostrativos, permisos visuales ni reglas clínicas como lógica productiva.

### 6.2 Sistema de diseño reconstruido

**RECOMENDACIÓN:** extraer de la referencia aprobada un sistema de diseño implementable en `packages/ui`, sin modificar el prototipo, que documente:

- tokens de color, tipografía, espaciado, radios, sombras, tamaños y breakpoints;
- componentes compartidos y sus estados;
- patrones de navegación por portal;
- plantillas de dashboard, detalle, formulario, agenda, tabla, evidencia y reporte;
- assets aprobados del personaje Elí y reglas de uso;
- comportamiento responsive;
- estados loading, vacío, error, denegado, vencido y sin conexión cuando apliquen;
- requisitos de teclado, foco, lector de pantalla, contraste y texto ampliado.

La fidelidad se verificará mediante comparación visual, pruebas responsive y revisión del Product Owner. La reutilización técnica debe preservar las diferencias legítimas entre portales; no debe homogeneizar experiencias que el diseño distingue intencionalmente.

### 6.3 Control de cambios de experiencia

Si arquitectura, seguridad, accesibilidad, datos o implementación identifican que una pantalla, flujo o componente necesita modificarse, agregarse o eliminarse:

1. detener el cambio visual o funcional afectado;
2. no modificar automáticamente `prototype-claude/` ni la experiencia productiva;
3. documentar la necesidad y la evidencia que la origina;
4. explicar el motivo técnico, de seguridad, accesibilidad, datos o producto;
5. indicar exactamente la pantalla, flujo, componente, estado y contenido que deben rediseñarse;
6. describir el impacto de mantener el diseño actual y las alternativas compatibles;
7. marcar el asunto exactamente como **REQUIERE CLAUDE DESIGN**;
8. esperar aprobación del Product Owner y un diseño actualizado antes de implementar la desviación.

Registro mínimo:

| Campo | Contenido requerido |
| --- | --- |
| Estado | `REQUIERE CLAUDE DESIGN` |
| Referencia | Archivo/pantalla/flujo exacto del prototipo |
| Necesidad | Qué debe modificarse, agregarse o eliminarse |
| Motivo | Restricción o hallazgo verificable |
| Impacto actual | Riesgo de no resolverlo |
| Alcance del rediseño | Elementos, estados, copy y portales afectados |
| Restricciones | Seguridad, datos, roles, accesibilidad y arquitectura que deben respetarse |
| Alternativas | Opciones para decisión, sin elegir silenciosamente |
| Decisión | Aprobación o rechazo del Product Owner y referencia al diseño resultante |

Un hallazgo de seguridad o accesibilidad no se ignora para preservar fidelidad visual: bloquea la parte afectada y activa `REQUIERE CLAUDE DESIGN`. Tampoco autoriza a Claude Code a rediseñar libremente. Claude Code implementa exclusivamente la experiencia aprobada dentro de una Task Specification.

### 6.4 Trazabilidad diseño–implementación

Cada Task Specification de frontend debe identificar:

- portal y usuarios afectados;
- archivos, pantallas o estados de `prototype-claude/` usados como referencia;
- componentes/tokens reutilizados;
- contenido y flujo que deben conservarse;
- adaptaciones técnicas permitidas que no cambian el concepto;
- resoluciones `REQUIERE CLAUDE DESIGN` aprobadas, si existen;
- criterios de fidelidad visual, responsive y accesibilidad;
- evidencia visual que Claude Code debe devolver para auditoría.

| Experiencia | Ruta conceptual | Capacidades compartidas | Frontera |
| --- | --- | --- | --- |
| Paciente | `/patient` | perfil, agenda, visitas, clínica autorizada, evidencias propias, membresía/pago controlado | datos propios y compartidos explícitamente |
| Cuidador | `/caregiver` | relaciones, pacientes autorizados, agenda, bitácora, formación | relación, alcance, institución, finalidad y vigencia por paciente |
| Profesional | `/professional` | asignaciones, agenda, visitas, continuidad, clínica autorizada | afiliación, asignación, servicio/programa y competencia |
| Hospital | `/hospital` | personas, programas, agenda, servicios, evidencia, finanzas, Hub, comercial | organización hospitalaria activa y función |
| Alcaldía | `/municipality` | población agregada, programas, recursos, indicadores, Hub y reportes | tenant, municipio, finalidad y agregación; nominal solo explícito |

El frontend solicita una decisión autorizada a la API; ocultar botones es solo UX. El contexto activo se muestra siempre en experiencias institucionales. Cambiar de organización o programa invalida caché, selección y navegación dependientes del contexto.

## 7. Backend y capas

Cada módulo mantiene cuatro responsabilidades distinguibles:

1. **API:** controladores, autenticación, validación y representación HTTP.
2. **Aplicación:** casos de uso, transacciones, autorización contextual y orquestación.
3. **Dominio:** entidades, valores, reglas e invariantes que no dependen de NestJS ni Prisma.
4. **Infraestructura:** repositorios Prisma, almacenamiento, OIDC, outbox e integraciones.

Reglas:

- controladores no acceden al ORM;
- repositorios requieren `RequestContext` con tenant y actor;
- casos de uso sensibles llaman al servicio de autorización antes de cargar o mutar recursos;
- toda escritura material produce procedencia y evento de auditoría en la misma transacción cuando sea viable;
- integraciones entran por adaptadores y nunca escriben tablas de dominio directamente;
- no existe repositorio genérico CRUD que permita omitir tenant o autorización.

## 8. API y contratos

### 8.1 Convenciones

- REST bajo `/api/v1`.
- OpenAPI como contrato publicable, sin exponer ejemplos sensibles.
- JSON con identificadores opacos; fechas ISO 8601 UTC y zona de negocio separada cuando aplique.
- Paginación por cursor para colecciones grandes; límites máximos.
- Idempotency key para importaciones, altas externas, cobros futuros y operaciones repetibles de riesgo.
- Errores con código estable, mensaje seguro, correlación y detalles de validación; sin stack ni existencia de recursos ajenos.
- Concurrencia optimista/versionado en registros materiales.

### 8.2 Contexto de solicitud

La API construye un contexto autenticado con:

- actor y cuenta externa;
- tenant permitido;
- persona y perfiles vigentes;
- organización activa y afiliación;
- programa/finalidad cuando apliquen;
- roles/permisos efectivos;
- identificador de sesión, solicitud y correlación.

Los valores enviados por headers o ruta son solicitudes de contexto, no autoridad. La API los valida contra afiliaciones y políticas vigentes.

## 9. Datos y multi-tenancy

### 9.1 Estrategia

- Base compartida por entorno y esquema compartido.
- `tenant_id` no nulo en toda entidad de negocio aislada.
- `organization_id`, `program_id`, municipio, periodo y finalidad se incluyen cuando `DATA.md` los exige.
- Identidad de persona única dentro del tenant; no hay identidad global entre tenants.
- Claves/constraints de negocio incluyen `tenant_id` cuando corresponda.
- Relaciones deben impedir referencias cruzadas entre tenants.
- Catálogos globales no contienen información de negocio y se administran separadamente.

### 9.2 Defensa en profundidad

1. El token identifica cuenta, no selecciona libremente tenant.
2. El servicio de contexto resuelve tenant/organización válidos.
3. El policy service autoriza acción, recurso y finalidad.
4. El repositorio aplica scope obligatorio.
5. PostgreSQL RLS verifica tenant como segunda barrera.
6. La respuesta se minimiza según sensibilidad y acción.
7. La decisión y accesos sensibles se auditan.

La conexión runtime no será propietaria de tablas, superusuario ni tendrá `BYPASSRLS`. El contexto RLS se fija localmente dentro de una transacción para evitar fuga entre conexiones del pool. Las migraciones usan una identidad separada y nunca atienden solicitudes.

## 10. Separación de dominios y procedencia

La separación es lógica y de autorización dentro de PostgreSQL; no se recomiendan bases distintas en el MVP.

- **Operativo:** personas contextualizadas, programas, agenda, bitácora, visitas y seguimiento.
- **Clínico autorizado:** copias de solo lectura o snapshots de fuente hospitalaria, importaciones y reconciliación.
- **Financiero:** fuente, presupuesto, asignación, gasto, proveedor, contrato, soporte y ejecución.
- **Institucional/regulatorio:** Hub genérico, requisitos, responsables, indicadores, evidencia, resultados y brechas.
- **Comercial hospitalario:** catálogo, planes, membresías, cobros, pagos controlados e ingreso potencial.
- **Documental:** metadatos, versiones, relaciones y objetos en el almacenamiento configurado.
- **Auditoría:** eventos protegidos y accesos sensibles.

Todo registro externo o calculado porta la categoría y el sobre de procedencia establecidos en `DATA.md`. Un dato declarado, importado, institucional, oficial, calculado o demostrativo no cambia de categoría de manera silenciosa.

## 11. Documentos y evidencias

Flujo recomendado:

1. API autoriza intención y crea carga pendiente con tenant, institución, categoría y propietario.
2. Archivo se carga a ubicación de cuarentena mediante autorización temporal y restringida.
3. Worker valida tamaño, tipo real, checksum y resultado de análisis antimalware.
4. API/worker promueve el archivo a estado disponible y registra versión/procedencia.
5. La evidencia vincula documento con actividad, visita, gasto, requisito, indicador u otro objeto.
6. Descargar requiere nueva autorización y genera URL de corta duración o streaming controlado.
7. Versionar crea un nuevo objeto/version; no reemplaza silenciosamente el anterior.

No se usa el nombre original como ruta ni frontera de seguridad. Metadatos y blob deben reconciliarse y su disposición debe ejecutarse mediante un flujo auditado.

## 12. Auditoría y outbox

Eventos mínimos desde el primer slice:

- autenticación y cambios de contexto sensibles;
- concesión/revocación de acceso;
- creación/cambio/cierre de relaciones y asignaciones;
- lectura/exportación de datos clínicos o sensibles;
- escrituras de operación, evidencia, finanzas, Hub e indicadores;
- carga, descarga, versión y archivo documental;
- importación, reconciliación y error de integración;
- acciones administrativas y acceso a auditoría.

Cada evento incluye actor, tenant, organización, acción, recurso, identificador, resultado, fecha, correlación y valores minimizados cuando correspondan. Usuarios normales no actualizan ni borran eventos.

El outbox se escribe en la misma transacción que el cambio de negocio. El worker procesa mensajes de forma idempotente y registra intentos, resultado y próximo reintento. El outbox no sustituye el audit log.

## 13. Integraciones

Todas las integraciones implementan puertos internos y conservan configuración, institución, finalidad, campos permitidos, versión de mapeo, ejecución y reconciliación.

| Familia | MVP | Evolución controlada |
| --- | --- | --- |
| Hospital clínico | archivo/carga controlada de solo lectura con procedencia | API/interoperabilidad aprobada y reconciliación |
| FURAG/MIPG | configuración y evidencia manual con fuentes referenciadas | actualización oficial autorizada; nunca puntuación inventada |
| ADRES | documentos/datasets autorizados y limitaciones explícitas | integración autorizada y reconciliación |
| T-319 y normas | fuente, requisitos e interpretación institucional separadas | monitoreo regulatorio revisado por especialistas |
| SENA/formación | oferta/referencia, inscripción y certificado controlados | verificación o intercambio autorizado |
| Consulta virtual | referencia manual/controlada | proveedor aprobado sin secretos en URL/logs |
| Notificaciones | bandeja interna | email/SMS/WhatsApp aprobados y minimizados |
| Pagos | referencias y estados manuales/controlados | gateway aprobado mediante tokenización y webhooks verificados |

Los fallos quedan en cuarentena o estado reintentable; no se incorporan silenciosamente como datos válidos u oficiales.

## 14. Entornos y entrega

| Entorno | Propósito | Datos | Acceso |
| --- | --- | --- | --- |
| DEV local | desarrollo rápido | exclusivamente ficticios; PostgreSQL y almacenamiento local/emulado | desarrolladores autorizados |
| TEST | CI, integración y E2E efímeros | factories ficticias, reiniciables; sin copias de PROD | CI y equipo de prueba |
| MVP Hostinger | demostración y aceptación del producto | exclusivamente ficticios o controlados; nunca información clínica real | Product Owner, equipo y demostradores autorizados |
| PROD | operación real aprobada | datos reales autorizados | mínimo privilegio y acceso operativo controlado |

Cada entorno tiene identidades, bases, storage, secretos, dominios y telemetría separados. No se copia PROD a DEV/TEST/MVP. El VPS de demo no se convierte in-place en producción. La infraestructura se describe como código en una fase aprobada; no se configura producción manualmente como práctica ordinaria.

Pipeline recomendado:

1. formato, lint y typecheck;
2. unit tests y pruebas de arquitectura;
3. dependency/secret scan;
4. build reproducible;
5. integración con PostgreSQL real y pruebas de RLS;
6. API/contract tests;
7. Playwright y accesibilidad;
8. revisión de migración y despliegue a TEST;
9. smoke tests;
10. aprobación explícita para PROD, migración controlada y verificación.

## 15. Hosting, red y escalado

### 15.1 Hostinger como infraestructura activa del MVP

**APROBADO:** Hostinger VPS **KVM 4** en el centro de datos de Brasil es la infraestructura activa del MVP. La capacidad publicada al redactar esta decisión es 4 vCPU, 16 GB RAM, 200 GB NVMe y 16 TB de transferencia. Debe confirmarse nuevamente en hPanel antes de contratar porque planes y parámetros pueden cambiar.

**RAZÓN:** ofrece margen razonable para ejecutar el stack mediante Docker Compose, desplegar imágenes y operar PostgreSQL, archivos controlados y monitoreo básico en un único VPS sin el costo y la complejidad inicial de varios servicios administrados. Brasil es la ubicación VPS sudamericana publicada y reduce distancia frente a Norteamérica o Europa, sin resolver por sí misma residencia o tratamiento de datos.

**ALTERNATIVA FUTURA:** una plataforma administrada, incluido Azure, solo si producción requiere controles de seguridad, cumplimiento, disponibilidad o escalabilidad que la modalidad Hostinger evaluada no pueda satisfacer. KVM 2 no forma parte del stack activo.

**RIESGO:** el VPS es autogestionado y constituye un punto único de falla. MERDN sería responsable de sistema operativo, parches, Docker, PostgreSQL, firewall, cifrado adicional, secretos, backups, restauración, monitoreo y respuesta a incidentes. KVM 1 no se recomienda y KVM 2 no es la modalidad objetivo porque deja poco margen para DB, worker, análisis documental y observabilidad simultáneos.

### 15.2 Componentes concretos en Hostinger MVP

| Componente | Ubicación/modalidad | Decisión operativa |
| --- | --- | --- |
| Dominio y DNS | Dominio administrado en Hostinger o registrador aprobado; DNS apunta al VPS | Cuenta protegida con MFA; cambios DNS controlados |
| SSL y entrada | Traefik o Caddy en Docker, puertos públicos 80/443, certificados Let's Encrypt y renovación automática | 80 solo para redirección/ACME; paneles administrativos no públicos |
| Frontend | Contenedor `web` Next.js | Solo recibe tráfico mediante reverse proxy |
| Backend | Contenedor `api` NestJS | Sin puerto público directo; secretos inyectados en runtime |
| Worker | Contenedor `worker` | Sin entrada pública; procesa outbox, cargas y notificaciones |
| Base de datos | PostgreSQL en contenedor y volumen persistente dedicado | Sin exposición pública; rol runtime, migrator separado, RLS y backup lógico |
| Almacenamiento MVP | Proveedor `VPS persistent storage` detrás del puerto documental, sobre volumen privado y persistente dedicado, solo con archivos ficticios/controlados | No acoplar a Azure Blob; checksum, cuarentena y copia cifrada externa; sustituible por S3-compatible, Azure Blob u otro adapter |
| Auditoría | PostgreSQL protegido y backup conforme al alcance MVP | Append-only para roles normales; monitorear intentos de alteración |
| Variables/secretos | Archivo root-only fuera del repositorio o Docker secrets compatibles; valores separados por entorno | hPanel no sustituye un secret manager; rotación manual gobernada en MVP |
| Monitoreo | Métricas hPanel más health checks, uptime externo y collector OpenTelemetry liviano | Alertas fuera del VPS para detectar caída total |
| Backups | Backup diario Hostinger contratado + backup lógico cifrado de DB y archivos enviado a destino externo independiente | Probar restauración; snapshot manual no es estrategia de backup |

El despliegue usa Docker Compose versionado, imágenes construidas en CI y un usuario de despliegue sin login root ordinario. Solo el reverse proxy expone puertos públicos. PostgreSQL, almacenamiento, métricas y paneles usan red Docker interna y, para administración excepcional, túnel SSH/VPN con allowlist.

El MVP en esta topología utiliza exclusivamente datos ficticios o controlados. No se presenta como entorno apto para datos clínicos reales.

### 15.3 Hostinger para producción con datos reales

Hostinger no se descarta. Antes de aprobarlo para datos reales debe realizarse una evaluación documentada del plan, contrato, ubicación y arquitectura exactos. Como mínimo debe demostrar:

1. aislamiento de tenant, organización, red, host, contenedores, DB y storage;
2. cifrado en tránsito y cifrado en reposo verificable para discos, DB, documentos y backups;
3. backups diarios independientes, consistentes, con retención aprobada y protección frente a compromiso del VPS;
4. restauración probada, RPO/RTO aprobados y procedimiento para pérdida total del VPS;
5. logging, métricas, alertas y registro de incidentes fuera del punto único de falla;
6. MFA, mínimo privilegio, SSH por claves, firewall, parcheo, escaneo y accesos administrativos auditables;
7. ubicación real seleccionada, residencia, transferencias y tratamiento contractual de datos aprobados;
8. controles específicos para información clínica, documentos, exportaciones y auditoría;
9. capacidad de preservar auditoría histórica y detectar intentos de alteración;
10. capacidad, concurrencia, disco, IOPS, red y crecimiento medidos;
11. mantenimiento, ventanas, disponibilidad, soporte y responsabilidades operativas aceptados;
12. separación suficiente de componentes críticos o una justificación/riesgo aceptado para colocalizarlos.

**Modalidad candidata mínima, no aprobada automáticamente para PROD:** KVM 8 para aplicación/worker o dos VPS KVM 4 separados por responsabilidad, más PostgreSQL y almacenamiento en servicios administrados externos si no pueden asegurarse adecuadamente en el VPS. Solo es válida después de comprobar conectividad privada o controles equivalentes; no se debe exponer PostgreSQL públicamente. La selección definitiva requiere pruebas de carga, threat model, revisión contractual y aceptación del Product Owner.

### 15.4 Comparación justificada con Azure

| Criterio | Hostinger KVM 4 MVP | Azure administrado | Cuándo justifica cambiar |
| --- | --- | --- | --- |
| Velocidad/costo inicial | Más simple y económico; un VPS | Más servicios y configuración | Hostinger es la infraestructura activa del MVP |
| Operación | Autogestionada | DB, storage, secretos y plataforma administrados | El equipo no puede asumir guardias, parcheo y recuperación |
| Disponibilidad | VPS único salvo diseño adicional | Redundancia y escalado administrables | SLA/RTO exige eliminar punto único de falla |
| Backups DB | Backup de VPS + estrategia propia | PITR administrado y opciones de redundancia | RPO/retención/restauración no alcanzables en VPS |
| Documentos | Volumen privado mediante adapter y copia externa | Blob/S3 administrado, versionado y políticas administradas | Evidencia real exige mayor durabilidad/controles |
| Secretos | Gestión propia | Key Vault/managed identity | Producción exige rotación y acceso más robustos |
| Observabilidad | Stack propio + externo | Monitor/Application Insights | Operación institucional exige correlación/alertas administradas |
| Residencia | Ubicaciones disponibles; Brasil publicado para VPS | Regiones disponibles según servicio | La decisión institucional favorece una ubicación/contrato |

No se compara por preferencia de marca: Azure permanece como alternativa únicamente cuando los requisitos técnicos, de seguridad, escalabilidad, disponibilidad, residencia o tratamiento de datos no queden satisfechos por la modalidad Hostinger evaluada.

### 15.5 Escalado

Web/API/worker permanecen stateless y escalan horizontalmente. PostgreSQL es la fuente transaccional. Antes de añadir caché distribuida, broker o réplicas se observan métricas reales. Los reportes pesados y exportaciones se procesan en worker. No se añaden Kubernetes, Kafka, Elasticsearch ni data warehouse al MVP sin necesidad demostrada y aprobación.

## 16. Backups, continuidad y recuperación

- Backups automáticos y point-in-time recovery de PostgreSQL.
- Redundancia de backup seleccionada por entorno/riesgo.
- Versionado/soft delete del almacenamiento documental cuando se apruebe, más estrategia contra eliminación maliciosa.
- Configuración e infraestructura versionadas; secretos respaldados según capacidades del gestor, nunca en Git.
- Restauración probada periódicamente en un entorno aislado.
- RPO, RTO, retención y redundancia geográfica exactos: **POR DEFINIR antes de PROD**.
- Restaurar no basta: se verifican RLS, identidades, documentos, auditoría, outbox e integridad referencial.

## 17. Logging y monitoreo

Logs JSON estructurados con timestamp, servicio, entorno, severidad, operación, resultado, duración, request/correlation ID y tenant/organización seudonimizados cuando sea posible.

No registrar tokens, cookies, contraseñas, secretos, contenido clínico, documentos, cuerpos completos, datos de pago ni PII innecesaria.

Métricas iniciales:

- disponibilidad, latencia y errores por endpoint;
- pool/consultas PostgreSQL y fallos RLS;
- autenticación y denegaciones anómalas;
- cargas, análisis y descargas documentales;
- outbox pendiente, reintentos y dead letters lógicas;
- importaciones, cuarentenas y reconciliación;
- eventos de auditoría fallidos;
- backups y pruebas de restauración.

Alertas se envían a responsables operativos definidos; un log de aplicación no sustituye un evento de auditoría ni un registro de incidente.

## 18. Estrategia de pruebas

Pruebas obligatorias por riesgo:

1. **Unidad:** reglas de dominio, vigencia, estados, cálculos aprobados y policy service.
2. **Autorización:** matriz rol/acción/recurso, relaciones, asignaciones, finalidad, revocación y deny-by-default.
3. **Tenant isolation:** consultas, mutaciones, relaciones, búsquedas, exports, jobs e integraciones entre al menos dos tenants ficticios.
4. **Integración:** PostgreSQL real, RLS, transacciones, auditoría, outbox y adapter de almacenamiento.
5. **API:** validación, paginación, concurrencia, idempotencia y errores sin filtración.
6. **E2E:** flujos por portal y cambio de contexto.
7. **Accesibilidad:** teclado, lector/semántica, foco, contraste, labels y errores; axe complementa revisión manual.
8. **Seguridad:** abuso de identificadores, elevación de privilegio, archivos, exportaciones, rate limits y secretos.
9. **Migración:** aplicar desde cero, actualizar estado previo aprobado y rollback/forward fix documentado.
10. **Recuperación:** restauración de DB/documentos y validación posterior antes de PROD.

## 19. Secuencia inmediata de implementación

Cada etapa requiere Task Specification y aprobación aplicables.

1. Monorepo, toolchain, CI, configuración tipada y health checks.
2. PostgreSQL/Prisma, migración inicial, tenant, organización, persona/cuenta externa y audit event.
3. Autenticación OIDC, contexto activo, policy service y RLS con pruebas de aislamiento.
4. Documentos/evidencias en cuarentena mediante el provider `VPS persistent storage` y contrato para adapters futuros.
5. Primer vertical slice: programa → relación/asignación → cita/visita → evidencia → indicador, con Hospital y Alcaldía agregada.
6. Clínica hospitalaria autorizada de solo lectura con importación/procedencia.
7. Presupuesto → asignación → gasto → soporte → ejecución.
8. Hub genérico con configuraciones estructurales iniciales.
9. Catálogo hospitalario, membresía, prestación y referencias controladas de cobro/pago/ingreso.

## 20. Cinco decisiones arquitectónicas principales

1. Monolito modular TypeScript en monorepo, con web, API y worker; sin microservicios iniciales.
2. PostgreSQL compartido por entorno con `tenant_id`, constraints y RLS como defensa en profundidad.
3. Autenticación OIDC externa y autorización de negocio contextual centralizada en MERDN.
4. Almacenamiento privado abstraído para archivos y PostgreSQL para metadatos, relaciones, evidencia, procedencia y auditoría.
5. Hostinger KVM 4 Brasil y Docker Compose como infraestructura activa del MVP; Azure únicamente como alternativa futura condicionada.

## 21. Bloqueos y decisiones posteriores

**No existen bloqueos arquitectónicos que impidan comenzar a programar la base técnica y el primer slice preparatorio.**

Antes de activar flujos específicos o desplegar datos reales deben resolverse mediante Task Specifications:

- dataset clínico exacto y método hospitalario;
- catálogo inicial de indicadores y fórmulas;
- reglas/estados financieros y comerciales detallados;
- fuentes/versiones y contenido aprobado del Hub;
- casos nominales de Alcaldía, si alguno;
- región/residencia, RPO/RTO y retención para PROD;
- configuración final de Entra External ID y canales externos.

Estas decisiones no bloquean scaffolding, aislamiento multi-tenant, autenticación adaptable, autorización, auditoría, procedencia, evidencias ni módulos base. Ninguna debe ser inventada por Claude Code.

## 22. Fuentes técnicas primarias consultadas

- [Next.js App Router](https://nextjs.org/docs/app)
- [NestJS documentation](https://docs.nestjs.com/)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
- [Prisma ORM](https://docs.prisma.io/docs/orm)
- [Prisma migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)
- [Microsoft Entra External ID](https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam)
- [Hostinger VPS KVM: planes, Docker, firewall y backups](https://www.hostinger.com/vps-hosting)
- [Hostinger: parámetros y límites de VPS](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/)
- [Hostinger: ubicaciones de centros de datos VPS](https://www.hostinger.com/support/1583267-where-are-hostinger-servers-located/)
- [Hostinger: backups y restauración de VPS](https://www.hostinger.com/support/1583232-how-to-back-up-or-restore-a-vps-at-hostinger/)
- [Hostinger: monitoreo de recursos VPS](https://www.hostinger.com/support/4725768-how-to-check-vps-resources-usage-at-hostinger/)
- [Azure Database for PostgreSQL backup and restore](https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore)
- [Playwright](https://playwright.dev/docs/intro)
