# ELÍGEME Task Specification

## Identificación y gate

- **Task ID:** TASK-003H-03C
- **Título:** Hospital — Agenda conectada, manual y contingencia
- **Estado:** APPROVED — READY FOR CLAUDE CODE (FRONTEND DEMOSTRATIVO)
- **Prioridad:** HIGH
- **Autoridad:** solicitud expresa de la Product Owner del 20 de agosto de 2026
- **Agente implementador futuro:** Claude Code, solo después de aprobación y cambio de gate
- **Agentes utilizados:** 01 MERDN Orchestrator; 02 UX/UI Fidelity Guardian; 03 Backend & Data Architect; 04 Security & Access Guardian; 05 Institutional & Regulatory Agent; 06 Integrations & Automation Agent; 07 QA & Acceptance Agent; 09 Frontend Application Architect
- **Dependencia:** TASK-003H-03 y vista actual `Agenda y citas`
- **Gate actual:** **READY FOR CLAUDE: SÍ**

> En toda interfaz visible se usa exclusivamente **ELÍGEME**. `MERDN` es terminología técnica interna y no puede aparecer en títulos, ayudas, estados accesibles, errores, fixtures ni evidencia visual.

## 1. Objetivo y valor

Definir una agenda Hospital que evite doble gestión y soporte tres modos por institución y tipo de cita: sistema del Hospital como fuente maestra, agenda administrada en ELÍGEME y modo combinado. Debe conservar operación segura durante desconexiones autorizadas, reconciliar sin sobrescritura silenciosa y convertir las acciones visuales actuales en futuros flujos especificados.

Una cita no prueba atención, prestación, gasto, pago o ingreso. La agenda no concede acceso clínico. No se asume que el sistema Hospital posee API ni capacidad de escritura.

## 2. Cambio de decisión arquitectónica y regla de precedencia

La documentación anterior declaraba a la entidad interna `Cita` como fuente maestra operativa. Esta Task incorpora una decisión posterior de la Product Owner: la fuente maestra se define por tipo de cita y puede ser el sistema Hospital o ELÍGEME.

Para preservar identidad, auditoría y relaciones internas, ELÍGEME mantiene un registro canónico/proyección local de toda cita visible, pero ese registro no se convierte por ello en autoridad del horario o estado. La autoridad de cada campo y transición deriva de `AppointmentSourcePolicy`, vigente para institución + programa opcional + tipo de cita. Esta distinción debe reflejarse posteriormente en `docs/ARCHITECTURE.md` y `docs/DATA.md` mediante cambio autorizado; esta Task no modifica esos documentos.

## 3. Resultado por fase

### 3.1 Frontend local autorizado ahora

- selector demostrativo de modo y tipo de cita;
- navegación, búsqueda, filtros, apertura de cita y selección Día/Semana/Mes con fixtures ficticios;
- formularios y paneles con acciones inertes o `Demostración`;
- estados de sincronización, desconexión, contingencia y conflicto mediante fixtures;
- representación de disponibilidad y conflicto predefinidos, sin motor real;
- ninguna red, persistencia, integración, notificación o cambio productivo.

### 3.2 Requiere backend

- APIs, persistencia, RLS, auditoría y autorización;
- CRUD/transiciones de cita, disponibilidad, bloqueo de agenda y control de concurrencia;
- historial, motivos, idempotencia y resolución de conflictos;
- política de fuente maestra por tipo y campo;
- modo contingencia, cola local de operaciones y reconciliación;
- búsqueda, filtros, paginación y alto volumen reales.

### 3.3 Requiere API/integración externa

- descubrimiento del sistema institucional y contrato disponible;
- autenticación, scopes, mapeo, versionado y límites;
- importación de citas, horarios, profesionales, disponibilidad, modalidad, reprogramaciones, cancelaciones y estados cuando la fuente lo permita;
- write-back solo si la API lo soporta y se aprueba;
- Google Calendar como proyección secundaria cuando corresponda;
- jobs, webhooks, outbox, reintentos, observabilidad y reconciliación.

### 3.4 Requiere sincronización real

- credenciales por referencia y entorno;
- sandbox o entorno de prueba;
- validación de idempotencia, orden, duplicados, timeout y conflictos;
- runbook de desconexión, contingencia y recuperación;
- monitoreo y responsables institucionales.

## 4. Modos de agenda

### 4.1 Modo A — Sistema del Hospital

El sistema institucional es fuente maestra para los tipos configurados. ELÍGEME importa o consulta, según capacidad real autorizada: citas, horarios, profesionales, disponibilidad, modalidad, reprogramaciones, cancelaciones y estados.

Reglas:

- por defecto es solo lectura en ELÍGEME;
- un botón de edición no aparece habilitado si la fuente no permite write-back;
- si permite escritura, ELÍGEME registra primero una intención pendiente y la envía asíncronamente; no muestra éxito final hasta confirmación/reconciliación;
- una divergencia no sobrescribe ningún lado silenciosamente;
- si no existe API, se puede definir carga/importación controlada o acceso manual, claramente rotulados y sin afirmar integración activa.

### 4.2 Modo B — Agenda ELÍGEME

ELÍGEME es fuente maestra para los tipos autorizados y permite:

- crear cita;
- asignar profesional;
- seleccionar fecha y hora;
- cambiar modalidad;
- reprogramar;
- cancelar o rechazar con motivo;
- consultar disponibilidad;
- detectar conflicto;
- registrar estado;
- conservar historial y auditoría.

Canales externos, incluido Google Calendar, son proyecciones y no sustituyen la autoridad de la cita ELÍGEME.

### 4.3 Modo C — Combinado

La fuente maestra se define explícitamente por tipo de cita, nunca por heurística. Configuración inicial solicitada como ejemplo, no como valor universal:

| Tipo | Fuente maestra propuesta | Regla |
| --- | --- | --- |
| Consulta institucional | Sistema del Hospital | Solo lectura por defecto; write-back si se aprueba y existe |
| Agenda médica general | Sistema del Hospital | Igual regla |
| Visita domiciliaria del programa | ELÍGEME | Puede proyectarse a sistema Hospital/Google si se aprueba |
| Consulta virtual del programa | ELÍGEME | Proveedor de sesión separado de la cita |
| Actividad propia del programa | ELÍGEME | No se presenta automáticamente como atención clínica |

La institución debe aprobar el catálogo real, fuente, campos y vigencia. Un cambio de fuente no migra ni sobrescribe automáticamente citas existentes.

## 5. Política de fuente maestra

Entidad conceptual `AppointmentSourcePolicy`:

- tenant, institución y programa opcional;
- tipo de cita;
- fuente maestra;
- modalidad (`Solo lectura`, `Bidireccional futura`, `Mixta por campos`);
- sistema/adaptador;
- campos legibles y escribibles;
- estados/transiciones permitidos;
- contingencia permitida;
- prioridad de conflicto;
- inicio, fin y versión;
- aprobador y auditoría.

Fuente maestra, origen, método de captura y estado de sincronización son atributos distintos. La modalidad mixta debe declarar autoridad campo a campo; no se permite un genérico “gana el último cambio”.

## 6. Modelo conceptual de cita

`Appointment` conserva como mínimo:

- ID interno opaco;
- ID externo opcional y sistema externo;
- origen y método de captura;
- fuente maestra y versión de política;
- paciente/beneficiario mediante relación autorizada;
- profesional y asignación;
- institución, programa y tenant;
- servicio/tipo de cita;
- inicio, fin, zona horaria y duración;
- modalidad;
- estado y motivo cuando aplica;
- referencia de pago cuando corresponda, separada del estado de cita;
- ubicación minimizada y gobernada;
- estado de sincronización y última sincronización;
- versión interna/externa, etag opcional y conflicto;
- historial y auditoría.

Entidades relacionadas: `ProfessionalAvailability`, `AppointmentAssignment`, `AppointmentStatusHistory`, `AppointmentSourcePolicy`, `ExternalAppointmentLink`, `SyncRun`, `SyncOperation`, `SyncConflict`, `ContingencySession`, `AuditEvent`, `OutboxEvent`.

No se confunde disponibilidad con cita, cita con servicio prestado ni estado externo con estado interno. Catálogo definitivo de estados/transiciones requiere aprobación; el prototipo conserva sus estados como presentación demostrativa, no como reglas productivas.

## 7. Disponibilidad, conflicto y concurrencia

Antes de asignar o reprogramar, el backend futuro valida institución, programa, profesional, vigencia, disponibilidad, bloqueos, superposición, modalidad, duración y versión actual de la cita. El cliente no determina la validez.

Tipos de conflicto conceptual:

- profesional ocupado o no disponible;
- paciente con superposición;
- recurso/ubicación no disponible;
- versión externa más reciente;
- cambio simultáneo;
- fuente maestra no escribible;
- operación de contingencia contra cambio externo;
- identidad profesional/paciente no conciliada.

La respuesta indica conflicto sin revelar agenda ajena. Resolver requiere acción explícita, motivo, versión y auditoría. No se hard-codean tiempos de desplazamiento, capacidad, duración ni reglas clínicas.

## 8. Comportamiento futuro exacto de controles existentes

| Control | Comportamiento futuro | Validación/resultado |
| --- | --- | --- |
| `Asignar profesional` | Abre Agenda filtrada en `Pendientes de asignación` o panel de asignación de la cita seleccionada | Lista solo profesionales autorizados/disponibles; confirmar crea comando idempotente; conflicto conserva formulario |
| Selector de profesional | Selecciona candidato, no asigna por sí solo | Reconsulta disponibilidad y muestra origen/última actualización |
| Fecha | Selecciona día en zona horaria institucional | Recalcula franjas disponibles; no permite fecha inválida según contrato |
| Hora | Selecciona franja disponible | La disponibilidad visual no reserva; se valida al confirmar |
| `Asignar` | Confirma profesional, fecha, hora y modalidad | Requiere permiso, versión y fuente escribible; éxito confirmado o `Pendiente de sincronización` |
| `Reprogramar` | Abre formulario con fecha/hora actuales, motivo obligatorio y procedencia | Valida disponibilidad/concurrencia; conserva antes/después e historial |
| `Rechazar con motivo` | Abre confirmación con catálogo/motivo y observación autorizada | No borra solicitud; registra transición e historial |
| `Cancelar` | Disponible en ficha según estado y permiso; motivo obligatorio | No equivale a borrar; propaga si corresponde y muestra sincronización |
| `Cambiar modalidad` | Selector desde ficha/reprogramación | Valida modalidades del servicio, fuente y dependencias; no crea enlace virtual automáticamente |
| `Día / Semana / Mes` | Cambia escala real de consulta y conserva fecha/filtros en URL o estado aprobado | Carga rango correspondiente; anuncia escala activa y resultados |
| Selección de día | Actualiza fecha activa y listado del día; doble activación no crea cita | Teclado, estado seleccionado y conteo textual |
| Apertura de cita | Abre drawer de detalle desde calendario/lista | Reautoriza; muestra resumen, procedencia, sincronización, historial y acciones permitidas |
| Búsqueda | Busca por referencia y datos mínimos autorizados | Debounce/paginación futura; no enumera pacientes ajenos |
| Filtros | Tipo, modalidad, profesional, estado, origen, fuente, sincronización, programa y rango | Chips activos, limpiar, URL compartible solo si no expone datos sensibles |

Los botones deshabilitados explican la causa accesiblemente: permiso, solo lectura, desconexión, estado incompatible o dato pendiente. La visibilidad no reemplaza autorización servidor.

## 9. Contingencia

### 9.1 Activación

Solo un rol con permiso `agenda.contingency.activate`, dentro de institución/tipo habilitado, puede activar una `ContingencySession`. Debe registrar motivo, alcance, inicio, expiración, responsable y aprobador si la política lo exige. No es un fallback automático ante cualquier error.

### 9.2 Experiencia durante desconexión

- banner persistente `Sistema del Hospital desconectado` con última sincronización;
- datos sincronizados mostrados como potencialmente desactualizados;
- si contingencia no está autorizada, operaciones externas quedan bloqueadas;
- si está autorizada, nuevas operaciones se marcan `Pendiente de sincronización` y conservan su fuente/versión;
- no se muestra confirmación externa ni se envían notificaciones basadas en un estado no confirmado;
- el usuario puede consultar la cola de operaciones propias de su alcance.

### 9.3 Recuperación

Al volver la conexión: importar cambios externos, comparar versiones, aplicar operaciones no conflictivas de forma idempotente y poner divergencias en `Requiere conciliación`. Nunca usar “último cambio gana”. La resolución muestra ambos valores, fuente, timestamps, impacto y acciones permitidas; conserva decisión y motivo.

Estados de sincronización: `Local`, `Importado`, `Sincronizado`, `Pendiente`, `Reintentando`, `Conflicto`, `Requiere conciliación`, `Error`, `Desconectado`, `Archivado`.

## 10. Arquitectura de sincronización e integraciones

### 10.1 Patrón

`Appointment/intent → outbox transaccional → worker → puerto de agenda → adaptador del sistema → resultado/webhook → reconciliación → auditoría`.

Importación: `sistema externo → consulta/webhook/archivo → validación y cuarentena → mapeo versionado → upsert idempotente de proyección → conflicto/reconciliación → auditoría`.

El dominio no depende del proveedor. Cada job y clave de idempotencia incluye tenant, institución, sistema, tipo, ID interno/externo y versión/operación.

### 10.2 Sistema institucional/API

Modalidades: `Solo lectura`, `Bidireccional futura`, `Mixta por campos`. No asumir API, webhooks, estados, códigos, frecuencia, scopes ni write-back. La carga controlada no se presenta como conexión viva.

### 10.3 Google Calendar

Google Calendar solo se conecta cuando corresponda a un tipo y profesional autorizados. Es proyección secundaria, no nueva fuente maestra. Conserva ID externo, calendario por referencia, etag, zona horaria, contenido mínimo y estado. Una falla no invalida la cita maestra; queda pendiente/reintento/conflicto. Cambios originados en Google no sobrescriben silenciosamente y por defecto requieren reconciliación o se consideran no autoritativos.

### 10.4 Seguridad externa

Credenciales separadas por proveedor/entorno, scopes mínimos, secretos fuera del repositorio, TLS, webhooks verificados, anti-replay, validación de esquema/tamaño, logs minimizados, reintentos acotados, rate limits y revocación al desconectar.

## 11. UX/UI vinculante para el frontend demostrativo

El diseño visual queda aprobado por decisión expresa de la Product Owner. **NO REQUIERE CLAUDE DESIGN.** Claude Code debe implementar, no diseñar, y reutilizar exactamente el shell, tipografía, color, radios, sombras, iconografía, densidad, controles y patrones de la Agenda Hospital actual.

### 11.1 Referencia vinculante existente

- `prototype-claude/Eligeme-Hospital.dc.html`, vista `Agenda y citas` y shell Hospital;
- implementación actual `HospitalAgenda` y TASK-003H-03 como baseline funcional/visual de presentación;
- conservar lenguaje rápido, compacto, visual, práctico, accesible y apto para alto volumen.

### 11.2 Composición funcional requerida

1. encabezado `Agenda y citas`, descripción, botón `Nueva cita` y selector `Fuente de agenda: Sistema del Hospital / Elígeme / Combinada`; junto al selector se muestra `Fuente maestra` para el tipo activo;
2. franja de conexión con modo activo, fuente por tipo, estado, última sincronización, pendientes y conflictos;
3. barra de búsqueda y filtros;
4. selector Día/Semana/Mes + navegación de fecha + `Hoy`;
5. calendario principal y panel/lista contextual del rango seleccionado;
6. solicitudes pendientes con flujo de asignación existente;
7. drawer de cita con `Resumen`, `Participantes`, `Sincronización`, `Historial`;
8. panel de contingencia/cola solo cuando aplica;
9. centro de conflictos accesible desde badge/contador.

### 11.3 Vistas Día, Semana y Mes

- **Día:** lista cronológica compacta; cada fila muestra hora, paciente, profesional, modalidad, estado y origen. La columna horaria permanece a la izquierda y las acciones se agrupan en `Abrir`.
- **Semana:** siete columnas de igual jerarquía desde el inicio de semana institucional; cada cita es un bloque compacto con hora, paciente/referencia minimizada, modalidad y profesional. Un conflicto usa icono + texto `Conflicto`, nunca solo color. En viewport angosto se convierte en selector horizontal accesible de día + lista del día, no en siete columnas ilegibles.
- **Mes:** conserva el calendario actual, muestra número de citas por día y marca el día seleccionado. Seleccionar un día abre debajo/en panel contextual el listado cronológico del día; no crea una cita.

El selector anuncia `aria-pressed`/estado activo, conserva fecha y filtros durante el cambio y usa fixtures distintos por escala. Claude Code no decide otros layouts.

### 11.4 KPI

KPI compactos, filtrados por rango y tipo: citas programadas, pendientes de asignación, por confirmar, canceladas/rechazadas, conflictos de horario, pendientes de sincronización y sistema desconectado. Son indicadores operativos internos, no métricas clínicas ni financieras. Cada KPI enlaza a filtro equivalente y muestra texto además de color.

### 11.5 Tablas/listas

Columnas: hora, paciente/referencia minimizada, servicio/tipo, modalidad, profesional, estado, fuente, sincronización y acción `Abrir`. Orden por hora; paginación/virtualización solo con necesidad medida. En móvil refluye a tarjetas sin perder estado o acción.

### 11.6 Formularios, asignación y acciones

- `Nueva cita` abre panel lateral con: paciente, modalidad, servicio, profesional, fecha, hora, duración, ubicación cuando corresponda, observaciones y fuente/origen;
- `Asignar profesional` abre el mismo patrón enfocado y lista profesionales compatibles con disponibilidad (`Disponible`, `Ocupado`, `Fuera de turno`, `Conflicto`), carga del día y detalle textual del conflicto;
- reprogramar: valores actuales, nuevos valores y motivo;
- cancelar/rechazar: motivo, observación y confirmación;
- conflicto: comparación, fuente, timestamps, impacto, decisión y motivo;
- contingencia: alcance, motivo, expiración y confirmación.

Cada formulario define validación, primer error, pending, conflicto, éxito confirmado, pendiente de sincronización, cancelación y retorno de foco.

`Reprogramar` abre panel lateral con fecha actual de solo lectura, nueva fecha, nueva hora, profesional, motivo obligatorio y `Confirmar`. `Cancelar` y `Rechazar con motivo` abren confirmación con motivo obligatorio y no borran la cita. `Cambiar modalidad` ofrece `Presencial`, `Virtual`, `Domiciliaria` según fixture y muestra advertencia textual si hay conflicto o requisito adicional. Todas las confirmaciones actualizan solo local state y añaden una entrada visible al historial ficticio.

### 11.7 Contingencia y conflictos

Cuando el fixture desconecta el sistema externo, aparece banner `Sistema institucional no disponible`, última sincronización y control `Modo contingencia`. Las operaciones locales autorizadas muestran `Pendiente de sincronización`. Al simular reconexión aparecen `Sincronizar` y `Revisar conflicto`; no se sobrescribe automáticamente.

`Conflictos de agenda` es un panel/listado compacto con cita, `Versión Hospital`, `Versión Elígeme`, diferencia, responsable y acciones demostrativas `Conservar Hospital`, `Conservar Elígeme`, `Revisar manualmente`. Cada acción exige confirmación local, conserva ambos valores en el historial ficticio y se rotula como demostrativa.

### 11.8 Decisión visual cerrada

La Agenda Hospital actual y las reglas 11.1–11.7 constituyen diseño vinculante suficiente para escritorio, tableta y móvil, incluidos loading, vacío, sin resultados, error, denegación, desconexión, conflicto, pendiente y éxito local. No requiere Claude Design. Ante una ambigüedad local, Claude Code reutiliza el patrón Hospital equivalente; no crea otra navegación, shell o estilo.

## 12. Permisos

| Acción | Coordinador de agenda | Profesional | Admin. Hospital | Integraciones | Auditor | Paciente/cuidador |
| --- | --- | --- | --- | --- | --- | --- |
| Ver agenda | Institución/programa asignado | Agenda propia/asignada | No por defecto salvo delegación | Metadatos técnicos mínimos | Según mandato | Citas propias/autorizadas |
| Crear | Sí, tipos autorizados | Solo si se aprueba | No por defecto | No | No | Solicitud, no creación institucional, si se aprueba |
| Asignar | Sí | No autoasignación salvo regla aprobada | No por defecto | No | No | No |
| Reprogramar | Sí | Propia/asignada si se aprueba | No por defecto | No | No | Solicitar, según política |
| Cancelar/rechazar | Sí, con motivo | Alcance aprobado | No por defecto | No | No | Solicitar/cancelar propia según política |
| Cambiar modalidad | Sí, si el servicio lo permite | Según alcance | No por defecto | No | No | Solicitar según política |
| Activar contingencia | Permiso específico y aprobación | No | Permiso específico, no implícito | Operación técnica sin autoridad de negocio | No | No |
| Resolver conflicto | Permiso funcional específico | Solo aportar contexto, no por defecto | No por defecto | Resolver técnico sin decidir negocio | Solo observar | No |
| Configurar fuente/integración | No | No | Permiso separado | Permiso técnico conjunto, sin ampliar datos | Auditar | No |

La decisión efectiva usa rol + tenant + institución + programa + relación/asignación + finalidad + vigencia + acción. Un usuario financiero no adquiere acceso clínico o de agenda por manejar pagos. Los detalles de otras agendas se minimizan en mensajes de conflicto.

## 13. Auditoría y privacidad

Auditar: creación, apertura sensible cuando aplique, asignación, reprogramación, modalidad, cancelación/rechazo, cambio de estado, configuración de fuente, activación/cierre de contingencia, operaciones pendientes, sincronización, conflicto/resolución, exportación y acciones de integración.

Eventos minimizados: actor, UTC, tenant/institución/programa, acción, recurso opaco, resultado, motivo, antes/después necesarios, fuente, correlación y versión. No registrar contenido clínico, dirección completa, payload externo, tokens o datos personales innecesarios.

## 14. Estados y transiciones

Esta Task no convierte los 13 estados visuales del prototipo en catálogo productivo. Antes de backend, la Product Owner debe aprobar catálogo y transiciones por tipo/fuente, incluyendo al menos solicitudes, asignación, confirmación, atención, cancelación/rechazo y cierre. Toda transición material exige autoridad, motivo cuando corresponda, versión e historial.

Pago, prestación, visita, consulta virtual y sincronización son dimensiones/recursos separados; ningún estado cambia otro automáticamente.

## 15. Criterios de aceptación

1. La configuración soporta tres modos y fuente maestra por tipo/campo.
2. El registro canónico local no se presenta como fuente maestra cuando manda el Hospital.
3. Todos los campos mínimos del modelo de cita están representados.
4. Cada botón existente tiene el comportamiento definido en la sección 8.
5. Disponibilidad/conflicto se validan en backend y no solo en UI.
6. La contingencia requiere autorización, muestra última sincronización y marca operaciones pendientes.
7. La recuperación nunca sobrescribe silenciosamente ni usa último cambio gana.
8. Google Calendar permanece proyección secundaria.
9. No se afirma que exista API o integración activa.
10. Permisos se aplican en servidor y conflictos minimizan datos ajenos.
11. La UI visible usa ELÍGEME y nunca MERDN.
12. No se modifica `prototype-claude/**`, `apps/**` ni otra Task.
13. Claude Code implementa únicamente el frontend demostrativo aprobado con fixtures/local state, sin backend, red, persistencia o integración real.

## 16. Pruebas requeridas para futura implementación

- creación, asignación, reprogramación, modalidad, cancelación/rechazo e historial;
- disponibilidad, superposición, versión obsoleta y concurrencia;
- modos Hospital, ELÍGEME y combinado por tipos distintos;
- fuente/field ownership y rechazo de escritura en solo lectura;
- permisos positivos/negativos por acción, relación y asignación;
- dos tenants, dos instituciones, RLS real, IDs externos coincidentes y FKs cross-tenant;
- búsqueda/filtros sin enumeración ni fuga;
- desconexión sin contingencia y con contingencia autorizada;
- cola, duplicados, reinicio, reintento, conflicto y reconciliación;
- API externa: timeout, rate limit, respuesta inválida, credencial/scope, webhook, replay y eventos fuera de orden;
- Google Calendar: alta/cambio/cancelación, fallo, etag, idempotencia y reconciliación;
- auditoría append-only, minimización de logs y fallo cerrado;
- teclado, foco, lector de pantalla, Día/Semana/Mes, reflow, alto volumen y estados no basados solo en color;
- regresión del shell y TASK-003H-03.

## 17. Archivos permitidos y prohibidos para Claude Code

Permitidos únicamente los archivos estrictamente necesarios bajo `apps/web/src/features/hospital/**`: `HospitalAgenda`, configuración/fixtures, componentes Hospital reutilizados, CSS Module y pruebas relacionadas; `HospitalShell` solo para conectar acciones o estado sin alterar su diseño. `apps/web/src/app/hospital/page.tsx` solo si es imprescindible. No se autorizan dependencias nuevas.

Prohibidos: `prototype-claude/**`, `docs/**`, `agents/**`, `reviews/**`, `tasks/**`, `AGENTS.md`, `CLAUDE.md`, backend, base de datos, paquetes, lockfiles, otras experiencias, Git y despliegue.

## 18. Decisiones aprobadas

1. Existen tres modos de agenda.
2. La fuente maestra se define por tipo de cita y puede ser Hospital o ELÍGEME.
3. No se asume API ni write-back.
4. La contingencia es explícita, autorizada, temporal y auditable.
5. Nunca se sobrescribe silenciosamente.
6. Google Calendar es una proyección secundaria cuando corresponda.
7. Los botones actuales deben evolucionar según la sección 8.
8. ELÍGEME es el único nombre visible.

## 19. Decisiones futuras no bloqueantes para el frontend

**REQUIERE CLAUDE DESIGN: NO.**

Quedan para backend, integración o configuración institucional posterior y no bloquean esta demostración:

- catálogo real de tipos de cita y fuente maestra inicial por institución;
- autoridad campo a campo en modalidad mixta;
- catálogo definitivo de estados y transiciones por tipo/fuente;
- roles concretos para crear, asignar, reprogramar, cancelar, contingencia y conflictos;
- política y duración de contingencia, aprobación y límites;
- reglas aprobadas de disponibilidad, duración, capacidad, ubicación y conflictos;
- tratamiento de cambios existentes al migrar fuente maestra;
- sistema institucional real, API/campos, dirección, frecuencia, scopes y credenciales;
- política para cambios originados en Google Calendar;
- notificaciones posteriores a operaciones pendientes o confirmadas.

Además, la nueva decisión de fuente maestra requiere actualización documental autorizada de arquitectura/datos antes de una implementación productiva, pero no para fixtures/local state.

No existen decisiones frontend materiales pendientes ni bloqueos frontend. La API real es desconocida y no se simula como activa; el agente 06 la evaluará por institución. La bidireccionalidad solo podrá implementarse posteriormente si la API lo permite. Google Calendar permanece integración futura/secundaria y nunca fuente clínica maestra por defecto.

## 20. Evidencia requerida en el futuro handoff

Claude Code deberá entregar archivos y propósito, trazabilidad requisito-prueba, URL local, capturas por viewport/estado, datos ficticios, contratos consumidos, resultados de lint/typecheck/tests/build, pruebas de permisos/tenant/RLS/integración/contingencia, evidencia de ausencia de datos sensibles y confirmación de que no modificó rutas prohibidas.

**READY FOR CLAUDE: SÍ**
