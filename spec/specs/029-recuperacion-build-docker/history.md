# Historial — Spec 029

## 2026-09-21 — Creación y aprobación

- Se registró el diagnóstico de compilación y Docker.
- El Product Owner autorizó expresamente a Codex a realizar la implementación y verificación.
- Pendiente: ejecución de tareas y evidencia de validación.

## 2026-09-21 — Recuperación verificada

- Se restauró `IdentityAccessService` desde el comportamiento versionado previo a `ffef693`, conservando resolución de paciente/profesional y autorización de asignación con tenant y vigencias.
- Se devolvió la consulta profesional de una visita a su condición de autorización versionada previa, sin ampliar permisos.
- `KeycloakAdminClient` ahora rechaza de forma controlada una configuración ausente; la prueba confirma que no se hace ninguna llamada de red.
- Se añadió una prueba de composición de `AppModule`.
- Validaciones superadas: build API; 11 pruebas focalizadas en 3 archivos; build raíz; `docker compose up -d --build`; API y Web saludables; `GET /health` respondió `200 {"status":"ok"}`.
- No se modificaron migraciones, esquema, datos, endpoints, reglas clínicas ni integraciones externas.

## Riesgo residual

- La suite completa, E2E y las pruebas PostgreSQL de alcance amplio no se ejecutaron en este P0; deben realizarse en una tarea de calidad separada antes de declarar completadas las capacidades de negocio.
