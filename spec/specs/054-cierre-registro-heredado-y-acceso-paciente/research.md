# Investigación 054

## Evidencia del repositorio

- El controlador heredado llamaba a `PatientEnrollmentService.enroll` y emitía una cookie de inscripción. El cambio sustituye esa escritura pública por una respuesta `410 Gone` con código `PATIENT_ENROLLMENT_RETIRED`.
- `PatientSelfService` resolvía la participación del paciente antes de abrir la transacción de lectura. El cambio usa `resolveApprovedPatientWithin` dentro de la misma transacción tenant-scoped que la lectura y su auditoría.
- La resolución aprobada exige cuenta activa de la persona y tenant del principal, sin bloqueo de recuperación; vínculo externo exacto activo; solicitud `PATIENT` aprobada de esos mismos identificadores; y participación `Patient` activa.
- El catálogo de experiencias aprobadas también filtra persona y vínculo externo exactos. `resolvePatient` mantiene su comportamiento de resolución de participación para otros consumidores.
- Las fixtures de API conservan pruebas de separación de cookies históricas sin reabrir la inscripción pública.
- `next.config.ts` define la redirección permanente de `/inscripcion` a `/acceso?accion=registro`.

## Decisiones y límites

Se documenta la implementación existente y el alcance aprobado. No se introducen reglas clínicas, indicadores oficiales, roles, migraciones ni integraciones externas. No se consulta ni usa información real de pacientes para verificar el cambio. Las pruebas con escritura se ejecutan mediante la baseline aislada y sus guardas; la base local de la aplicación no es una base de pruebas.

La revisión estática y las pruebas focales no sustituyen la aceptación del Product Owner ni certifican cumplimiento normativo completo.
