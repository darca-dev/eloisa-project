# History — Spec 024

## 2026-08-28 — v0.1

### Changed

- Creada especificación focal de diagnóstico y corrección de bootstrap.
- Estado cerrado como `Pendiente`; sin aprobación ni consentimiento.

### Why

Un reinicio de API expuso que la resolución por código ocurre antes del contexto
RLS y devuelve un falso “tenant inexistente”.

### Impact

Solo documentación SDD. Cero cambios de producción, base de datos o demo local.

## 2026-08-28 — v0.2

### Changed

- Product Owner aprobó y consintió explícitamente la implementación.
- Plan cerrado en tres paquetes materiales de hasta quince minutos, sin
  escrituras solapadas y con STOP CONDITIONS propios.
- Reconciliado el solapamiento con Spec 023 completa en `c030e48`.

### Why

Autorizar la corrección durable ya diagnosticada sin ampliar autoridad ni
regresar los controles de staging existentes.

### Impact

La compuerta de implementación puede abrir para Spec 024 después de validación
SDD. Claude no recibe autorización de commit, push, merge o despliegue.
