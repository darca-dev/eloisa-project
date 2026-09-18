# MERDN Task Specification

> Plantilla oficial de Codex para entregar una tarea aprobada a Claude Code. Sustituir todo texto entre corchetes. No iniciar implementación mientras exista una decisión material bloqueante.

## Task Identification

- **Task ID:** [TASK-000]
- **Title:** [Título breve]
- **Status:** [DRAFT | PENDING APPROVAL | APPROVED | IN PROGRESS | BLOCKED | READY FOR REVIEW | CLOSED]
- **Priority:** [CRITICAL | HIGH | MEDIUM | LOW]
- **Created by:** [Codex / responsable]
- **Approved by:** [Product Owner / pendiente]

## Objective

[Resultado concreto, observable y acotado que debe producir la tarea.]

## Business Context

[Por qué existe la tarea, qué problema resuelve y qué valor aporta. Separar hechos, supuestos y recomendaciones.]

## Users Affected

- **Usuarios o roles:** [Referenciar roles de `docs/ROLES.md`.]
- **Instituciones:** [Hospital, prestador, Alcaldía, administrador u otra.]
- **Impacto esperado:** [Cómo cambia su experiencia o responsabilidad.]

## Modules Affected

- **Módulos en alcance:** [Nombres exactos de `docs/MODULES.md`.]
- **Módulos relacionados:** [Dependencias funcionales sin trabajo directo.]
- **Módulos no afectados:** [Límites relevantes.]

## Functional Requirements

1. [FR-01 — Requisito verificable.]
2. [FR-02 — Requisito verificable, incluido comportamiento de error.]

## Data Requirements

| Dato o entidad | Uso | Propietario institucional | Procedencia | Sensibilidad | Retención/linaje | Restricciones |
| --- | --- | --- | --- | --- | --- | --- |
| [Dato] | [Finalidad] | [Tenant/institución] | [Fuente] | [Clasificación] | [Regla aprobada] | [Minimización/validación] |

- **Entradas:** [Datos recibidos y validaciones.]
- **Salidas:** [Datos producidos o expuestos.]
- **Datos prohibidos:** [Datos que no deben recopilarse, persistirse o mostrarse.]
- **Datos reales en pruebas:** Prohibidos salvo autorización expresa para un entorno controlado; usar datos ficticios o desidentificados.

## Permissions

Referenciar y aplicar `docs/ROLES.md`. No inferir permisos de pantallas, cargos o perfiles visuales. Especificar acción, recurso y contexto; usar denegación por defecto.

| Acción | Roles autorizados | Recurso y alcance | Condiciones | Denegaciones explícitas |
| --- | --- | --- | --- | --- |
| VER | [Rol(es)] | [Recurso/contexto] | [Relación, finalidad, vigencia] | [Rol(es)/casos] |
| CREAR | [Rol(es)] | [Recurso/contexto] | [Condiciones] | [Casos] |
| EDITAR | [Rol(es)] | [Recurso/contexto] | [Condiciones] | [Casos] |
| APROBAR | [Rol(es)] | [Recurso/contexto] | [Separación de funciones] | [Casos] |
| ASIGNAR | [Rol(es)] | [Recurso/contexto] | [Condiciones] | [Casos] |
| CERRAR | [Rol(es)] | [Recurso/contexto] | [Condiciones] | [Casos] |
| EXPORTAR | [Rol(es)] | [Recurso/contexto] | [Minimización/auditoría] | [Casos] |
| ADMINISTRAR | [Rol(es)] | [Recurso/contexto] | [Delegación] | [Casos] |

## Institutional Context

- **Tenant/institución:** [Identificador o regla de alcance.]
- **Municipio/territorio:** [Alcance o no aplica.]
- **Programa/servicio:** [Alcance o no aplica.]
- **Relaciones y asignaciones:** [Paciente-cuidador, profesional, afiliación u otra.]
- **Regla de aislamiento:** [Cómo se impide acceso entre instituciones o contextos no autorizados.]

## Audit Requirements

| Evento | Actor | Recurso | Cuándo | Datos mínimos | Datos que deben minimizarse | Resultado esperado |
| --- | --- | --- | --- | --- | --- | --- |
| [EVENT_NAME] | [Usuario/servicio] | [Recurso] | [Disparador] | [ID, institución, acción, resultado] | [Datos sensibles] | [Éxito/fallo] |

- [Definir auditoría de accesos, cambios, aprobaciones, exportaciones y fallos sensibles cuando aplique.]

## Security Requirements

1. [Autenticación aprobada aplicable o no aplica.]
2. [Autorización en servidor y capa de datos.]
3. [Mínimo privilegio y denegación por defecto.]
4. [Aislamiento institucional y pruebas negativas.]
5. [Validación, manejo de errores y protección contra exposición.]
6. [Tratamiento de secretos; nunca incluirlos en código, UI o logs.]
7. [Controles adicionales derivados del riesgo.]

## Regulatory and Evidence Requirements

No inventar fuentes, fórmulas, puntuaciones, interpretaciones ni requisitos oficiales. Marcar cada área como **AFECTA**, **NO AFECTA** o **DECISIÓN ABIERTA** y explicar brevemente.

| Área | Evaluación | Requisito aprobado, evidencia y restricción |
| --- | --- | --- |
| FURAG/MIPG | [Estado] | [Detalle] |
| ADRES | [Estado] | [Detalle] |
| Sentencia T-319 de 2025 | [Estado] | [Detalle] |
| SENA | [Estado] | [Detalle] |
| Hub Institucional, Normativo y de Evidencias | [Estado] | [Detalle] |
| Presupuesto y movimiento financiero | [Estado] | [Detalle] |
| Evidencias | [Estado] | [Procedencia, versión, responsable y trazabilidad] |
| Indicadores | [Estado] | [Fuente, fórmula, periodo, propietario y linaje aprobados] |
| Otros requisitos institucionales | [Estado] | [Detalle] |

## Hospital Commercial Impact

Marcar cada área como **AFECTA**, **NO AFECTA** o **DECISIÓN ABIERTA**. No asumir procesamiento productivo de pagos ni contabilidad oficial.

| Área | Evaluación | Comportamiento aprobado y restricción |
| --- | --- | --- |
| Agenda | [Estado] | [Detalle] |
| Servicios | [Estado] | [Detalle] |
| Visitas | [Estado] | [Detalle] |
| Consultas virtuales | [Estado] | [Detalle] |
| Membresías | [Estado] | [Detalle] |
| Pagos | [Estado] | [Detalle] |
| Ingresos | [Estado] | [Detalle] |
| Evidencia de prestación | [Estado] | [Detalle] |

## Visual Reference

- **Referencia(s):** [`prototype-claude/[ruta]` o no aplica.]
- **Elementos vinculantes:** [Flujo, jerarquía o comportamiento aprobado.]
- **Elementos solo orientativos:** [Estilo, datos de demostración u otros.]
- **Restricción:** `prototype-claude/` es de solo lectura y no constituye código, datos, permisos ni reglas clínicas de producción.

## Allowed Files

- `[ruta o patrón autorizado]` — [Propósito.]

Toda ruta no listada se considera fuera de alcance salvo aclaración expresa.

## Forbidden Files

- `AGENTS.md`
- `CLAUDE.md`
- `prototype-claude/**`
- `main` y su historial
- [Otras rutas específicas.]

## Dependencies

### Functional Dependencies

- [Decisión, módulo o tarea previa.]

### Technical Dependencies

- [Componente o paquete existente. No añadir dependencias mayores sin aprobación.]

### Integration and Failure Behavior

- [Integración autorizada, timeout, indisponibilidad, reintento, idempotencia y degradación segura, o no aplica.]

## Approved Decisions

1. [AD-01 — Decisión expresa, autoridad y referencia.]

Solo estas decisiones pueden usarse como base de implementación. Una recomendación o capacidad estructural no equivale a aprobación de sus detalles.

## Open Decisions

| ID | Decisión requerida | Autoridad | Impacto | ¿Bloquea? |
| --- | --- | --- | --- | --- |
| [OD-01] | [Pregunta concreta] | [Product Owner/Codex] | [Impacto] | [Sí/No] |

Claude Code debe aplicar las STOP CONDITIONS de `CLAUDE.md` ante cualquier decisión material no aprobada.

## Out of Scope

- [Función, módulo, refactorización, integración o decisión que Claude Code no debe construir.]

## Acceptance Criteria

1. **AC-01:** [Condición objetiva, observable y verificable.]
2. **AC-02:** [Condición objetiva, incluido caso negativo o de error.]

## Required Tests

| Test ID | Tipo | Escenario | Resultado esperado | Evidencia requerida |
| --- | --- | --- | --- | --- |
| [T-01] | [Unit/Integration/API/Permission/Tenant/Accessibility/E2E/Security/Migration] | [Escenario] | [Resultado] | [Comando/salida] |

- **Pruebas de regresión:** [Alcance.]
- **Pruebas negativas:** [Accesos, aislamiento, validación y errores.]
- **Entorno y datos:** [Configuración y datos ficticios requeridos.]

## Expected Handoff

Claude Code debe entregar a Codex el handoff estructurado definido en `CLAUDE.md`, incluyendo:

1. Task ID, estado y resumen del resultado.
2. Archivos creados, modificados o eliminados y propósito de cada cambio.
3. Migraciones, configuración y dependencias afectadas.
4. Cumplimiento de cada criterio de aceptación con evidencia.
5. Comandos de prueba, resultados, fallos y pruebas no ejecutadas.
6. Evidencia de permisos, aislamiento institucional, seguridad, auditoría y accesibilidad aplicable.
7. Supuestos locales, riesgos residuales, errores conocidos y desviaciones.
8. STOP CONDITIONS o decisiones pendientes.
9. Referencias concretas para la auditoría de Codex.

El handoff no equivale a aprobación. Codex audita y el Product Owner conserva la aceptación final.
