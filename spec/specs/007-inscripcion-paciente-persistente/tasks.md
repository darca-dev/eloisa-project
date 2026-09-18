# Tareas 007 - Inscripción a paciente persistente

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

- [x] `POST /api/v1/patients/enrollments` con persistencia transaccional
- [x] `GET /api/v1/patients/me`
- [x] Tenant resuelto exclusivamente en servidor, sin selector
- [x] Row Level Security y políticas sobre `tenant`, `person`, `patient`
- [x] Sesión de inscripción en cookie `HttpOnly` con TTL configurable
- [x] Normalización de documento y rechazo de duplicado sin filtrar datos
- [x] Derivación de tipo de población a partir de datos declarados
- [x] Consentimiento con versión y finalidad
- [x] Resolución territorial contra unidades persistidas
- [x] Evento de auditoría de la operación
- [x] Límite de tasa en el punto de entrada
- [x] Filtro de JSON malformado
- [x] Comportamiento fail-closed probado

## Límites conocidos (no autorizados como trabajo)

- [ ] `features/paciente` consumiendo `GET /api/v1/patients/me`
- [ ] Persistencia de la bitácora del paciente
- [ ] Cambio de tenant sin reinicio

## Verificación pendiente

- [ ] Levantar PostgreSQL y ejecutar `patient-enrollment.db.test.ts`,
      `patient-enrollment.api.test.ts`, `core-01-hardening.db.test.ts`,
      `runtime-fail-closed.db.test.ts`
