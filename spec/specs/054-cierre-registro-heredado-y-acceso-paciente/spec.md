# SPEC 054 — Cierre del registro heredado y acceso aprobado del Paciente

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para implementación y aplicación local`.
- Fecha: 2026-10-15.
- Aprobado por: Product Owner, conversación vigente.
- Evidencia: el Product Owner ordenó ejecutar el plan de revisión preentrega mediante ramas y commits limpios y después indicó «continué».

## Objetivo

Cerrar la vía pública heredada que crea pacientes activos sin revisión institucional y exigir, en cada lectura propia del Paciente, que la cuenta y el vínculo exactos de la sesión tengan una solicitud `PATIENT` en estado `APPROVED`.

## Alcance

- `POST /api/v1/patients/enrollments` deja de crear datos y responde `410 Gone` con un código estable y sin datos personales.
- `/inscripcion` redirige de forma permanente al registro vigente `/acceso?accion=registro`.
- Las lecturas `summary`, `appointments` y `visits` de `patient-self` verifican en la misma transacción:
  - cuenta activa, no bloqueada y de la persona del principal;
  - vínculo externo exacto y activo de la sesión;
  - solicitud `PATIENT` exacta, `APPROVED`, de esa cuenta, persona y vínculo;
  - participación `Patient` activa de la misma persona y tenant.
- La denegación se audita dentro de la transacción y se comunica después del commit para conservar la traza.
- `resolvePatient` conserva su semántica de participación para contextos que no son una autorización de acceso.

## Fuera de alcance

- Cambiar el proceso de aprobación del Hospital.
- Crear roles adicionales.
- Borrar personas o pacientes históricos.
- Cambiar Keycloak, cookies o credenciales existentes.

## Seguridad y concurrencia

- El navegador no aporta tenant, cuenta, vínculo, solicitud ni paciente.
- La cuenta se bloquea con `FOR SHARE` antes de leer la aprobación. Los flujos de revocación y recuperación que requieren modificarla se serializan contra esa lectura.
- No se bloquea `AccessRequest`: así se evita invertir el orden de bloqueos usado por revisión y recuperación.
- La consulta exige el `externalAuthIdentityId` exacto de la sesión; una sesión histórica sin vínculo exacto no obtiene acceso propio.
- Una auditoría fallida impide servir datos.

## Criterios de aceptación

1. Ninguna petición al endpoint heredado crea `Person`, `Patient`, cuenta, vínculo, sesión ni auditoría de alta.
2. `/inscripcion` no monta el formulario heredado y redirige al flujo vigente.
3. Una participación `Patient` activa sin solicitud aprobada obtiene `403` en las tres lecturas propias.
4. Una solicitud aprobada de otra cuenta, persona, vínculo o tenant no concede acceso.
5. Una solicitud `PENDING`, `REJECTED`, `SUSPENDED` o `REVOKED` no concede acceso.
6. La solicitud aprobada exacta permite las proyecciones mínimas existentes.
7. Las denegaciones quedan auditadas aun cuando el servicio lanza `403` después de la transacción.
8. RLS, aislamiento entre tenants y respuestas `401/403/503` permanecen cerradas.

## Evidencia requerida

- Pruebas unitarias de la resolución exacta y de commit de auditoría denegada.
- Pruebas API/DB de endpoint retirado, solicitud ausente/no aprobada/ajena y aprobación exacta.
- Typecheck, lint, escaneo de secretos y gates SDD.
