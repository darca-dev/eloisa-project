# MERDN Orchestrator V1 Runtime — arquitectura aprobada

## 1. Estado del documento

- **Estado:** APROBADO PARA IMPLEMENTACIÓN CON MOCKS.
- **Fecha:** 2026-08-21.
- **Primera prueba prevista:** Interfaz Alcaldía.
- **READY FOR CLAUDE:** **SÍ**, para construir el Runtime con mocks.
- **Gate de prueba Alcaldía:** la ausencia de Claude Code CLI no bloquea la construcción, pero sí bloquea la prueba end-to-end real.

Este documento diseña una herramienta operativa local. No autoriza su implementación, no modifica el producto MERDN y no autoriza commit, push, despliegue, gasto ni manejo de secretos.

## 2. Objetivo y límites

La V1 reduce el traslado manual de mensajes entre Product Owner, Codex y Claude Code sin sustituir sus autoridades:

1. el Product Owner expresa una necesidad y conserva todas las decisiones materiales;
2. Codex y los especialistas analizan, especifican y revisan;
3. Claude Code implementa solamente una Task aprobada y con `READY FOR CLAUDE = SÍ`;
4. el Orchestrator registra, valida gates, ejecuta adaptadores autorizados y conserva trazabilidad;
5. el Product Owner acepta o rechaza el resultado y autoriza por separado cualquier operación Git.

Fuera de alcance de V1: controlar la interfaz actual de ChatGPT o Claude, APIs pagas, ejecución remota, Hostinger, despliegue, multiusuario, datos de pacientes, secretos, migraciones del producto, push a `main` y cambios en `prototype-claude/`.

## 3. Alternativas evaluadas

| Alternativa | Ventaja | Desventaja | Decisión propuesta |
| --- | --- | --- | --- |
| Solo script CLI | Menor código | Mala experiencia para Product Owner y poca visibilidad | No elegida |
| Panel web local + proceso Node | Interfaz simple, control de estado y evolución gradual | Requiere un pequeño runtime | **Elegida** |
| Aplicación dentro de MERDN | Reutiliza stack | Mezcla herramienta de desarrollo con producto y su threat model | Rechazada |
| Servicio remoto/microservicios | Acceso remoto | Infraestructura, autenticación, secretos y costo innecesarios | Rechazada |
| JSON mutable como fuente maestra | Simple al inicio | Transiciones, concurrencia y recuperación frágiles | No recomendado |
| SQLite local + journal/artifacts | Atomicidad, consultas, métricas y recuperación sin servidor | API experimental/estable según versión exacta de Node 24; debe verificarse en preflight | **Aprobada mediante `node:sqlite`, sin dependencia externa** |

## 4. Arquitectura V1 elegida

Un único proceso TypeScript/Node, aislado en `tools/merdn-orchestrator/`, sirve un panel web mínimo únicamente en `127.0.0.1`. El mismo proceso contiene:

```text
Panel local accesible
        |
        v
Application service / comandos predefinidos
        |
        +--> Máquina de estados + policy gates
        +--> SQLite local + journal de eventos
        +--> Workspace guard (scope, diff, hashes, locks)
        +--> Context builder (Task y evidencia mínima)
        +--> Adapter Codex CLI
        +--> Adapter Claude Code CLI
        +--> Métricas y export de handoffs
```

No habrá base de datos de red, cola, microservicios, Docker, integración con el API de MERDN ni despliegue. Una sola Task puede estar activa y una sola invocación mutante puede ejecutarse a la vez.

### 4.1 Componentes

- **Local UI:** formulario de necesidad, estado, resumen y acciones grandes y accesibles.
- **Workflow engine:** allowlist de transiciones, precondiciones, idempotencia y gates.
- **Policy/gate engine:** decisiones materiales, presupuesto, scope, branch, pruebas y Git.
- **Runtime store:** `node:sqlite` bajo `.merdn/orchestrator.db`; artefactos limitados y redactados bajo `.merdn/artifacts/`.
- **Agent adapters:** procesos hijos con `cwd` fijo, timeout, salida capturada y sin shell arbitrario.
- **Workspace guard:** baseline antes de cada invocación, allowlist de rutas, detección de escape y cambios ajenos.
- **Recovery manager:** checkpoints, leases, reconciliación tras cierre o error y reanudación segura.
- **Metrics recorder:** tiempos, intervenciones, ciclos, errores, reintentos, tests y archivos fuera de alcance.

`.merdn/` debe ignorarse en Git. Tasks y Reviews en Git son el historial duradero; la base operativa, journal, logs y sesiones no se versionan. El journal local se conserva 30 días y solo se purga manualmente.

## 5. Conexión con agentes y proveedores

### 5.1 Codex

**Verificado localmente:** `codex.exe` está disponible y reporta `codex-cli 0.149.0-alpha.4`.

La V1 invocará Codex mediante un adapter de proceso para análisis, generación/actualización de Task y review. Usará salida estructurada cuando el CLI la soporte, conservará el ID exacto de sesión por Task y podrá reanudarlo. Nunca seleccionará implícitamente “la última” sesión. El preflight valida binario, versión y estado de autenticación sin leer ni copiar tokens.

Codex recibe rutas autoritativas, Task vigente, decisiones y evidencia; no conversaciones completas. Codex y sus especialistas no escriben código productivo.

### 5.2 Claude Code

La V1 prevé un adapter de proceso no interactivo equivalente, con `cwd` fijo, timeout, captura redactada, identificador de ejecución y cancelación del árbol de procesos.

El adapter aprobado usa Claude Code CLI local con autenticación Claude Max, nunca `ANTHROPIC_API_KEY` ni API paga. Su preflight ejecuta `claude --version`; si no existe, el workflow pasa a `PAUSED`. La ausencia del CLI no bloquea construir y probar el Runtime con mocks, pero sí bloquea la prueba end-to-end Alcaldía.

Claude se ejecuta en modo no interactivo, con JSON estructurado, `cwd` fijado al repositorio, timeout, cancelación segura, máximo de turnos y herramientas explícitamente permitidas. Está prohibido `dangerously-skip-permissions` y cualquier flag equivalente de bypass.

Claude recibe únicamente una Task cuyo hash está aprobado y cuyo gate técnico dice `READY FOR CLAUDE = SÍ`. Nunca se le envía a investigar decisiones materiales. Sus cambios vuelven obligatoriamente a Codex/QA.

### 5.3 OpenAI/ChatGPT y Anthropic

| Capacidad | V1 | ¿API? | Costo adicional esperado |
| --- | --- | --- | --- |
| Codex local con sesión existente | Sí, tras preflight | No | $0 adicional esperado, sujeto a límites del plan |
| Claude Code local con sesión Max | Sí; requisito para E2E Alcaldía | No | $0 adicional esperado, sujeto a límites de Claude Max |
| Control de esta UI de ChatGPT | No | No es una capacidad asumible | N/A |
| OpenAI Product Owner Assistant remoto | Futuro detrás de un puerto | Sí, OpenAI API/SDK | Facturación separada |
| Claude por Anthropic API | Futuro detrás de un puerto | Sí, Anthropic API/SDK | Facturación separada |

La capa “OpenAI/Product Owner Assistant” de V1 es el adapter local de Codex más el panel; no controla esta ventana de ChatGPT. Se prepara un puerto `OpenAIProductAssistantAdapter` futuro, deshabilitado y sin implementación de llamadas. No se crean claves, no se activan servicios y no se genera gasto.

## 6. Modos operativos

- **AUTOMÁTICO:** avanza solo transiciones reversibles y ya aprobadas. Puede entregar a Claude y devolver correcciones no materiales únicamente si todos los gates pasan.
- **ASISTIDO — modo inicial de la prueba Alcaldía:** el Product Owner aprueba la Task antes de Claude, confirma cada entrega a Claude y aprueba visualmente el resultado.
- **MANUAL:** conserva estado, prepara/exporta prompts y handoffs, pero no invoca agentes.

El cambio de modo es un evento persistente; no reinicia la Task. Un kill switch siempre disponible mueve a `PAUSED`. El sistema nunca cambia por sí solo de MANUAL o ASISTIDO a AUTOMÁTICO.

## 7. Máquina de estados

### 7.1 Flujo principal

```text
IDEA -> ANALISIS -> ESPERANDO_PRODUCT_OWNER -> ANALISIS
                 \-> TASK_READY -> IMPLEMENTANDO -> QA
                                             QA -> CHANGES_REQUIRED -> IMPLEMENTANDO
                                             QA -> ESPERANDO_APROBACION_VISUAL
ESPERANDO_APROBACION_VISUAL -> APROBADO -> READY_FOR_COMMIT -> COMMITTED
                            -> CHANGES_REQUIRED
                            -> RECHAZADO
IDEA | ANALISIS | ESPERANDO_PRODUCT_OWNER | TASK_READY | PAUSED -> CANCELADO
```

`RECHAZADO` y `CANCELADO` son estados terminales aprobados. Ambos preservan íntegramente el journal: `RECHAZADO` registra el rechazo del resultado o propuesta; `CANCELADO`, el cierre voluntario de una ejecución antes de aceptación.

### 7.2 Estados de interrupción

`PAUSED`, `API_ERROR`, `LOOP_DETECTED`, `BUDGET_LIMIT` y `STOP_CONDITION` conservan `resume_state`, motivo, evidencia y actor. Ninguno relanza trabajo automáticamente. `API_ERROR` es recuperable; los otros requieren decisión o cambio de modo.

### 7.3 Autoridad de transición

| Actor | Transiciones autorizadas |
| --- | --- |
| Product Owner | crear IDEA; responder decisión; aprobar/cambiar/rechazar; pausar; autorizar Task; autorizar Git por separado |
| Orchestrator | iniciar análisis; validar gates; coordinar invocaciones; mover a estados de error; proponer siguiente estado |
| Codex/especialistas | producir Task, decisiones, review y recomendación; no autoaprobar gates materiales |
| Claude Code | reportar implementación, pruebas y handoff; no autorizar su propia ejecución ni aceptación |
| Git executor | `READY_FOR_COMMIT -> COMMITTED` solo con autorización ligada al diff/hash exacto |

Toda transición usa allowlist, precondiciones persistidas e `idempotency_key`. Cambiar una Task después de aprobada invalida `task_hash_approved` y devuelve el flujo a análisis/aprobación.

## 8. Registro persistente y minimización

Entidades mínimas: `workflow_run`, `task_run`, `state_transition`, `decision`, `approval`, `agent_invocation`, `attempt`, `artifact`, `file_change`, `test_run`, `review`, `finding`, `error_event`, `budget_counter` y `lease`.

Cada evento incluye ID opaco, timestamp UTC, actor, estado previo/nuevo, Task/revisión y resultado. Tasks y decisiones conservan ruta, versión, SHA-256, procedencia y aprobación.

No se guardan secretos, tokens, cookies, variables de entorno, headers, credenciales, datos de pacientes ni stdout completo sin redacción. Los prompts/respuestas completos no se conservan por defecto: se guarda resumen mínimo y referencia al artefacto necesario. El intake advierte o bloquea posibles secretos/datos sensibles. Los archivos locales usan permisos del usuario del sistema operativo. El journal se conserva 30 días; la purga es manual y nunca elimina Tasks/Reviews versionadas.

## 9. Gates de aprobación

### 9.1 READY FOR CLAUDE

La invocación se prohíbe técnicamente salvo que:

- Task completa, aprobada y con hash vigente;
- `READY FOR CLAUDE = SÍ` explícito;
- ninguna decisión material bloqueante;
- allowlist/denylist de archivos definida;
- criterios, pruebas y recuperación definidos;
- branch/workspace permitido y baseline registrado;
- preflight de CLI/autenticación aprobado;
- sin indicios de secretos;
- presupuesto e iteraciones disponibles;
- lock exclusivo de Task adquirido.

### 9.2 Corrección automática

Solo findings concretos, no materiales, dentro de la Task, los archivos permitidos y el presupuesto. Cambios de arquitectura, producto, permisos, datos, integración, dependencia o diseño regresan al Product Owner.

### 9.3 Gates obligatorios

- decisión material;
- aprobación de Task;
- `READY FOR CLAUDE`;
- divergencia visual o `REQUIERE CLAUDE DESIGN`;
- dependencia nueva;
- archivo fuera de alcance;
- gasto o secreto;
- acción destructiva;
- permisos sensibles;
- `READY_FOR_COMMIT`;
- deploy.

“APROBAR” el resultado mueve como máximo a `READY_FOR_COMMIT`. V1 no ejecuta commit ni push automáticamente. El Product Owner conserva el gate final y nunca existe push automático a `main`.

## 10. Anti-loop y control de costo

Límites aprobados para la prueba:

- máximo 3 invocaciones Claude por Task: implementación + 2 correcciones;
- máximo 2 reintentos transitorios por invocación;
- máximo 2 ciclos consecutivos sin progreso;
- máximo 6 invocaciones AI totales antes de intervención del Product Owner;
- una Task activa y un proceso mutante simultáneo;
- umbral blando de contexto construido: 80.000 caracteres;
- umbral duro: 120.000 caracteres, que fuerza checkpoint y contexto limpio;
- timeout y máximo de turnos configurables por invocación, visibles antes de iniciar.

Cada ciclo debe demostrar al menos uno de estos avances: archivo esperado creado/modificado, test nuevo pasando, bloqueo eliminado, avance de estado o Review avanzando hacia `PASS`. Dos ciclos consecutivos sin progreso producen `LOOP_DETECTED`. También se detiene ante repetición u oscilación A↔B de la huella normalizada: hash de Task + findings + diff/archivos + resultados de pruebas + clase de error. Alcanzar límites de consumo produce `BUDGET_LIMIT`.

No se reenvían conversaciones completas. Al exceder contexto se crea una sesión limpia con un context pack firmado: Task aprobada, decisiones, findings abiertos, archivos relevantes, checkpoint y evidencia. Los contadores no se reinician por abrir sesión nueva.

## 11. Recuperación ante API/CLI Error

Antes de cada invocación se registra checkpoint: estado, hash de Task, commit base, estado/diff del workspace, cambios preexistentes, intento, presupuesto y archivos permitidos.

Ante error:

1. detener la invocación y conservar el working tree;
2. clasificar `preflight`, `auth`, `rate_limit`, `network`, `timeout`, `process_exit` o `schema_invalid`;
3. inspeccionar en solo lectura diff, tests y archivos fuera de alcance;
4. no ejecutar reset, checkout, stash, delete ni rehacer ciegamente;
5. reintentar solo errores transitorios conocidos, hasta el límite y sin mutación concurrente;
6. si hay cambios parciales válidos, enviarlos a Codex/QA para una instrucción incremental;
7. reanudar por ID exacto si el contexto es sano; si no, usar contexto limpio desde checkpoint;
8. al reiniciar el runtime, detectar leases vencidos, pasar a `PAUSED` con razón y reconciliar antes de ofrecer reanudación.

Errores de autenticación, permisos, cuota, petición inválida o schema inválido no se reintentan automáticamente.

## 12. Protección del workspace

- Resolver y fijar el root del repositorio; rechazar rutas absolutas externas, `..`, symlinks o junctions que escapen.
- V1 no usa Git worktrees y solo opera sobre un working tree limpio.
- Si aparecen cambios no reconocidos, pasar a `PAUSED` antes de invocar agentes.
- Nunca ejecutar automáticamente reset, clean, stash, rebase o checkout destructivo.
- Comparar estado y archivos antes/después de cada agente.
- Detener ante cualquier cambio fuera de allowlist.
- Permitir únicamente comandos predefinidos por fase; ninguna salida del modelo se convierte en shell arbitrario.
- Filtrar entorno, limitar/redactar stdout/stderr y terminar el árbol de procesos al cancelar.
- Mantener `prototype-claude/**`, `.env`, gobernanza, infraestructura y `main` fuera de alcance.

El working tree limpio, el lock exclusivo y el baseline antes/después son precondiciones obligatorias. Los cambios producidos dentro de una ejecución se reconocen mediante el journal y los hashes de la Task; cualquier cambio ajeno o ambiguo pausa el flujo.

## 13. Interfaz del Product Owner

Pantalla única para un solo usuario en su computadora local, en español, responsive y navegable por teclado. Escucha solo en `127.0.0.1`, sin LAN, Internet ni autenticación multiusuario:

```text
¿Qué quieres lograr?
[ Quiero que en Alcaldía se vea la población atendida por programa. ]
[ PREPARAR PROPUESTA ]

PROPUESTA PREPARADA
[ VER ] [ APROBAR ] [ CAMBIAR ] [ RECHAZAR ]

IMPLEMENTANDO
[ PAUSAR ] [ CAMBIAR A MODO ASISTIDO ]

REVISIÓN COMPLETADA
[ VER RESULTADO ] [ APROBAR ] [ CAMBIAR ] [ RECHAZAR ]
```

Siempre muestra modo actual, estado, siguiente acción y una explicación breve en lenguaje natural. Los detalles técnicos están bajo “Ver detalles”. Botones tienen texto, no solo color/icono; foco visible; regiones de estado usan anuncios accesibles; errores explican qué se conservó y qué puede hacer la persona.

## 14. Prueba Manual vs Orchestrator — Alcaldía

La prueba Alcaldía comienza en MODO ASISTIDO y mide una unidad de trabajo equivalente con los mismos criterios y alcance:

| Métrica | Manual | Orchestrator |
| --- | --- | --- |
| Intervenciones Product Owner | conteo | conteo |
| Mensajes copiados manualmente | conteo | objetivo 0 |
| Tiempo total y tiempo activo PO | duración | duración |
| Invocaciones y ciclos Codex/Claude | conteo | conteo |
| Errores y reintentos por clase | conteo | conteo |
| Ciclos sin progreso | conteo | conteo |
| Archivos fuera de alcance | conteo | objetivo 0 |
| Tests pass/fail/not run | evidencia | evidencia |
| Fidelidad visual y divergencias | revisión | revisión |
| Contexto/tokens/costo | solo si se reporta | solo si se reporta |
| Recuperaciones exitosas | N/A/registro | conteo |

Umbrales obligatorios: 0 mensajes copiados manualmente entre Codex y Claude; máximo 3 intervenciones del Product Owner; máximo 3 invocaciones Claude; 0 archivos fuera de alcance; 0 decisiones inventadas por Claude; $0 en APIs. No se inventan tokens ni costos si el CLI no los expone. Si el Orchestrator es más lento, costoso, consume más intervención, pierde fidelidad o es menos confiable, la recomendación obligatoria será volver a MODO MANUAL.

## 15. Archivos permitidos para una implementación aprobada

- `tools/merdn-orchestrator/**` — runtime, UI local, adapters, persistencia y pruebas.
- `tests/orchestrator/**` — pruebas de integración/E2E si no caben dentro del paquete.
- `.gitignore` — ignorar exclusivamente `.merdn/`.
- `package.json` — scripts/workspace mínimos.
- `package-lock.json` — solo si es estrictamente necesario; `node:sqlite` no requiere dependencia.

Toda otra ruta queda prohibida. En particular: `prototype-claude/**`, `apps/web/**`, `apps/api/**`, `packages/**`, `prisma/**`, `.env*`, `AGENTS.md`, `CLAUDE.md`, `agents/**`, `compose.yml`, archivos de deploy y `.git/**`.

## 16. Decisiones finales aprobadas

La arquitectura, SQLite mediante `node:sqlite`, ubicación, modos, límites, retención, working tree limpio, ausencia de worktrees, política Git, usuario local, estados, gates, adapters y archivos permitidos quedan cerrados según este documento. No quedan decisiones materiales pendientes para construir el Runtime con mocks.

## 17. Bloqueos y condición de salida

- **Construcción con mocks:** sin bloqueos materiales; no requiere Claude CLI instalado.
- **Prueba end-to-end Alcaldía:** requiere que `claude --version` pase y que la sesión local Claude Max esté disponible; de lo contrario queda `PAUSED`.
- No se autorizan claves, APIs pagas, commit, push ni deploy.

**READY FOR CLAUDE: SÍ**, exclusivamente para implementar el Runtime con mocks dentro de los archivos permitidos. La prueba end-to-end Alcaldía conserva su gate de Claude CLI.
