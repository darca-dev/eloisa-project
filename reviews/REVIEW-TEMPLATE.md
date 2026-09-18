# MERDN Implementation Review

> Plantilla oficial de Codex para auditar una implementación de Claude Code contra su Task Specification aprobada. Sustituir todo texto entre corchetes y sustentar cada conclusión con evidencia.

## Review Identification

- **Review ID:** [REV-000]
- **Task ID:** [TASK-000]
- **Reviewer:** [Codex / revisor autorizado]
- **Date:** [AAAA-MM-DD]
- **Result:** [PASS | PASS WITH CONDITIONS | FAIL | BLOCKED]

### Result Definitions

- **PASS:** cumple la especificación y no quedan hallazgos que impidan recomendar aprobación.
- **PASS WITH CONDITIONS:** cumple sustancialmente; quedan condiciones explícitas, acotadas y no bloqueantes.
- **FAIL:** existen incumplimientos o riesgos que requieren corrección antes de aprobar.
- **BLOCKED:** falta evidencia, acceso o una decisión autorizada indispensable para concluir la revisión.

## Scope Reviewed

- **Task Specification:** [Ruta y versión/revisión.]
- **Implementación:** [Commit, diff, rama o estado revisado; sin ejecutar operaciones Git no autorizadas.]
- **Archivos revisados:** [Lista.]
- **Pruebas y evidencia revisadas:** [Lista.]
- **Fuera de alcance de esta revisión:** [Lista y motivo.]

## Task Compliance

| Requirement ID | Requisito o criterio | Evidencia | Estado | Observación/Finding ID |
| --- | --- | --- | --- | --- |
| [FR-01/AC-01] | [Resumen] | [Archivo, prueba o salida] | [PASS | PARTIAL | FAIL | NOT VERIFIED] | [ID o ninguna] |

### Compliance Summary

- **Implementado y verificado:** [Resumen.]
- **Implementado pero no verificado:** [Resumen.]
- **Faltante:** [Resumen.]
- **Desviaciones:** [Resumen y autorización, si existe.]

## Architecture Review

| Área | Estado | Evidencia y evaluación |
| --- | --- | --- |
| Límites modulares | [PASS/FAIL/N/A] | [Separación y dependencias.] |
| Duplicación | [PASS/FAIL/N/A] | [Lógica o experiencias duplicadas.] |
| Acoplamiento | [PASS/FAIL/N/A] | [Acoplamiento y mantenibilidad.] |
| Decisiones arquitectónicas | [PASS/FAIL/N/A] | [Conformidad con decisiones aprobadas.] |
| Desviaciones | [PASS/FAIL/N/A] | [Cambio, impacto y autorización.] |

- **Conclusión arquitectónica:** [Conclusión sustentada.]

## Security Review

| Control | Estado | Evidencia y riesgo |
| --- | --- | --- |
| Autenticación | [PASS/FAIL/N/A] | [Evaluación.] |
| Autorización en servidor/datos | [PASS/FAIL/N/A] | [Evaluación.] |
| Mínimo privilegio y denegación por defecto | [PASS/FAIL/N/A] | [Evaluación.] |
| Aislamiento institucional/tenant | [PASS/FAIL/N/A] | [Evaluación y prueba negativa.] |
| Secretos y credenciales | [PASS/FAIL/N/A] | [Evaluación.] |
| Validación de entradas y errores | [PASS/FAIL/N/A] | [Evaluación.] |
| Exposición y minimización de datos | [PASS/FAIL/N/A] | [UI, API, logs y exportaciones.] |

- **Amenazas o casos no cubiertos:** [Detalle.]
- **Conclusión de seguridad:** [Conclusión sustentada.]

## Data Review

| Área | Estado | Evidencia y evaluación |
| --- | --- | --- |
| Modelo de datos | [PASS/FAIL/N/A] | [Entidades, límites y semántica.] |
| Procedencia y linaje | [PASS/FAIL/N/A] | [Fuente, fechas, versión y transformaciones.] |
| Sensibilidad y minimización | [PASS/FAIL/N/A] | [Clasificación y necesidad.] |
| Integridad y validación | [PASS/FAIL/N/A] | [Restricciones y consistencia.] |
| Propiedad y tenant | [PASS/FAIL/N/A] | [Institución propietaria y aislamiento.] |
| Relaciones y vigencia | [PASS/FAIL/N/A] | [Consentimiento, afiliación, asignación u otra.] |
| Migraciones y rollback | [PASS/FAIL/N/A] | [Seguridad, compatibilidad y reversibilidad.] |

- **Uso de datos reales o sensibles en desarrollo/pruebas:** [No detectado / hallazgo.]
- **Conclusión de datos:** [Conclusión sustentada.]

## Roles and Permissions Review

Comparar explícitamente contra `docs/ROLES.md` y la matriz aprobada en la Task Specification.

| Acción | Rol/contexto esperado | Implementación observada | Prueba positiva/negativa | Estado |
| --- | --- | --- | --- | --- |
| VER | [Rol y alcance] | [Control observado] | [Evidencia] | [PASS/FAIL/N/A] |
| CREAR | [Rol y alcance] | [Control observado] | [Evidencia] | [PASS/FAIL/N/A] |
| EDITAR | [Rol y alcance] | [Control observado] | [Evidencia] | [PASS/FAIL/N/A] |
| APROBAR | [Rol y alcance] | [Control observado] | [Evidencia] | [PASS/FAIL/N/A] |
| ASIGNAR | [Rol y alcance] | [Control observado] | [Evidencia] | [PASS/FAIL/N/A] |
| CERRAR | [Rol y alcance] | [Control observado] | [Evidencia] | [PASS/FAIL/N/A] |
| EXPORTAR | [Rol y alcance] | [Control observado] | [Evidencia] | [PASS/FAIL/N/A] |
| ADMINISTRAR | [Rol y alcance] | [Control observado] | [Evidencia] | [PASS/FAIL/N/A] |

- **Separación de funciones:** [Evaluación.]
- **Acceso privilegiado:** [Evaluación.]
- **Conclusión de roles y permisos:** [Conclusión sustentada.]

## Auditability Review

| Evento requerido | Implementado | Campos y minimización | Prueba/evidencia | Estado |
| --- | --- | --- | --- | --- |
| [EVENT_NAME] | [Sí/No] | [Actor, acción, recurso, institución, resultado] | [Referencia] | [PASS/FAIL] |

- **Inmutabilidad y control de acceso:** [Evaluación.]
- **Accesos/exportaciones sensibles auditados:** [Evaluación.]
- **Fallos auditados sin exponer secretos:** [Evaluación.]
- **Conclusión de auditabilidad:** [Conclusión sustentada.]

## Regulatory and Evidence Review

No atribuir a MERDN autoridad oficial, cumplimiento integral, puntuaciones, interpretaciones o datos que no provengan de fuentes y decisiones aprobadas.

| Área | Impacto | Evidencia revisada | Evaluación |
| --- | --- | --- | --- |
| FURAG/MIPG | [Aplica/No aplica] | [Referencia] | [Fuentes, fórmulas, periodos y carácter oficial.] |
| ADRES | [Aplica/No aplica] | [Referencia] | [Fuente, autorización y significado.] |
| Sentencia T-319 de 2025 | [Aplica/No aplica] | [Referencia] | [Interpretación aprobada y trazabilidad.] |
| SENA | [Aplica/No aplica] | [Referencia] | [Formación, certificación y verificación.] |
| Evidencia institucional | [Aplica/No aplica] | [Referencia] | [Procedencia, versión, relación y aprobación.] |
| Indicadores | [Aplica/No aplica] | [Referencia] | [Fuente, fórmula, periodo, propietario y linaje.] |
| Finanzas | [Aplica/No aplica] | [Referencia] | [Presupuesto, ejecución, soportes y segregación.] |
| Hub Institucional, Normativo y de Evidencias | [Aplica/No aplica] | [Referencia] | [Extensibilidad y separación de estados.] |

- **Conclusión regulatoria y de evidencia:** [Conclusión sustentada.]

## Hospital Commercial Review

Completar cuando aplique. MERDN no debe presentarse como sistema contable oficial ni procesador productivo de pagos sin aprobación separada.

| Área | Estado | Evidencia y evaluación |
| --- | --- | --- |
| Agenda | [PASS/FAIL/N/A] | [Evaluación.] |
| Servicios | [PASS/FAIL/N/A] | [Evaluación.] |
| Visitas | [PASS/FAIL/N/A] | [Evaluación.] |
| Consultas virtuales | [PASS/FAIL/N/A] | [Evaluación.] |
| Membresías | [PASS/FAIL/N/A] | [Evaluación.] |
| Pagos | [PASS/FAIL/N/A] | [Estados/referencias/procesamiento.] |
| Ingresos | [PASS/FAIL/N/A] | [Trazabilidad y límites.] |
| Evidencia de prestación | [PASS/FAIL/N/A] | [Relación entre servicio y evidencia.] |

- **Conclusión comercial hospitalaria:** [Conclusión sustentada.]

## Test Review

### Summary

- **Pruebas ejecutadas:** [Cantidad y tipos.]
- **Pruebas pasadas:** [Cantidad.]
- **Pruebas fallidas:** [Cantidad.]
- **Pruebas faltantes/no ejecutadas:** [Cantidad y motivo.]

| Test ID/Comando | Tipo | Resultado | Evidencia | Cobertura o brecha |
| --- | --- | --- | --- | --- |
| [T-01 / comando] | [Tipo] | [PASS/FAIL/NOT RUN] | [Salida/referencia] | [Qué demuestra o falta] |

- **Permisos y tenant isolation:** [Cobertura.]
- **Errores y validación:** [Cobertura.]
- **Accesibilidad:** [Cobertura.]
- **Seguridad:** [Cobertura.]
- **Regresión:** [Cobertura.]
- **Conclusión de pruebas:** [Suficiente/insuficiente y motivo.]

## Findings

Clasificaciones permitidas: **BLOCKER**, **CRITICAL**, **HIGH**, **MEDIUM**, **LOW**, **OBSERVATION**.

### [FINDING-001] — [Título]

- **Severity:** [BLOCKER | CRITICAL | HIGH | MEDIUM | LOW | OBSERVATION]
- **Description:** [Defecto, desviación o riesgo observado.]
- **File:** `[ruta:línea o componente]`
- **Evidence:** [Código, prueba, salida o reproducción.]
- **Risk:** [Impacto y escenario.]
- **Required correction:** [Cambio concreto requerido; no decidir asuntos reservados al Product Owner.]
- **Closure criterion:** [Evidencia objetiva necesaria para cerrar.]
- **Owner:** [Claude Code / Codex / Product Owner / otro.]
- **Status:** [OPEN | IN PROGRESS | RESOLVED | ACCEPTED RISK]

Repetir una sección por hallazgo. No ocultar hallazgos conocidos en el resumen.

## Required Corrections

| Order | Finding ID | Corrección concreta | Evidencia de cierre | Requiere nueva Task Specification/decisión |
| --- | --- | --- | --- | --- |
| 1 | [FINDING-001] | [Acción requerida] | [Prueba/diff/revisión] | [Sí/No; autoridad] |

Las correcciones materiales deben volver a Claude Code mediante una Task Specification aprobada o una revisión formalmente aprobada de la tarea existente.

## Residual Risks

| Risk ID | Riesgo restante | Probabilidad/impacto | Mitigación actual | Acción o propietario |
| --- | --- | --- | --- | --- |
| [RR-01] | [Riesgo] | [Evaluación] | [Control] | [Acción/responsable] |

## Final Recommendation

- **Recommendation:** [APPROVE | APPROVE WITH CONDITIONS | RETURN TO CLAUDE CODE | BLOCK]
- **Rationale:** [Justificación breve basada en cumplimiento, hallazgos y riesgos.]
- **Conditions:** [Condiciones, responsables y fecha/criterio; o ninguna.]
- **Required next step:** [Acción concreta.]

La recomendación de Codex no sustituye la decisión final del Product Owner y no autoriza commit, merge, push, release o deploy.

## Product Owner Decision

- **Decision:** [APPROVED | APPROVED WITH CONDITIONS | REJECTED | DEFERRED]
- **Decided by:** [Product Owner]
- **Date:** [AAAA-MM-DD]
- **Conditions or rationale:** [Detalle.]
- **Authorized next action:** [Corrección, integración Git, release, deploy u otra; especificar de forma expresa.]
- **Signature/reference:** [Referencia de aprobación.]
