# Contrato aprobado — solicitudes de acceso del demo

Este contrato forma parte de la spec 038 aprobada. No está implementado. Sus
nombres y garantías solo pueden cambiar mediante una decisión trazable del
Product Owner.

## Principios

1. El cliente nunca envía `tenantId`, `role`, permisos, estado de aprobación ni identificadores de cuenta autorizada.
2. El servidor obtiene el tenant del alcance institucional autenticado y valida la capacidad requerida.
3. La solicitud de acceso es un agregado persistente distinto de la persona, la cuenta, el perfil de paciente, la relación de cuidador y la asignación profesional.
4. Las transiciones usan control de concurrencia y son idempotentes.
5. `APPROVED` significa que el aprovisionamiento de identidad terminó y que se persistió el identificador real devuelto por el proveedor OIDC.
6. Una aprobación de cuidador no crea una relación con un paciente. Una aprobación de profesional no crea una asignación clínica.

## Crear solicitud pública

`POST /api/v1/access-requests`

Entrada mínima aprobada:

```json
{
  "requestedContext": "PATIENT",
  "givenName": "Lucía",
  "familyName": "Demo",
  "email": "lucia.demo@example.test",
  "phone": "+573000000001",
  "documentType": "CC",
  "documentNumber": "DEMO-038-001",
  "password": "valor-enviado-solo-al-proveedor-oidc",
  "acceptedPrivacyNoticeVersion": "demo-v1"
}
```

`requestedContext` acepta únicamente `PATIENT`, `CAREGIVER` o `PROFESSIONAL`. Los campos definitivos y su obligatoriedad dependen de las decisiones `OD-02`, `OD-03` y `OD-11`.

Respuesta esperada: `202 Accepted` con un identificador opaco de solicitud, estado `PENDING` y mensaje sin información que permita enumerar cuentas existentes.

Errores mínimos: `400 VALIDATION_ERROR`, `409 REQUEST_ALREADY_EXISTS`, `429 RATE_LIMITED`, `503 IDENTITY_PROVIDER_UNAVAILABLE` cuando la indisponibilidad impida aceptar la operación de forma segura.

## Listar solicitudes para revisión

`GET /api/v1/hospital/access-requests?status=PENDING&context=PATIENT`

Requiere sesión institucional, tenant resuelto por el servidor y capacidad `HOSPITAL_ACCESS_REVIEWER`. La respuesta solo contiene solicitudes del tenant actual y datos mínimos para decidir.

Errores mínimos: `401 AUTHENTICATION_REQUIRED`, `403 ACCESS_REVIEW_FORBIDDEN` y `400 INVALID_FILTER`.

## Consultar detalle

`GET /api/v1/hospital/access-requests/{requestId}`

Aplica las mismas reglas de autenticación, autorización y aislamiento. La respuesta incluye versión de concurrencia, estado, historial de decisiones visible y datos permitidos por minimización.

## Decidir una solicitud

`POST /api/v1/hospital/access-requests/{requestId}/decision`

```json
{
  "action": "APPROVE",
  "expectedVersion": 3,
  "reasonCode": "DEMO_ELIGIBLE",
  "comment": "Datos ficticios revisados"
}
```

`action` acepta `APPROVE` o `REJECT`. El servidor registra al actor institucional, valida la versión y controla la transición. Para `APPROVE`, la respuesta puede quedar temporalmente en `APPROVED_PENDING_PROVISIONING`; solo pasa a `APPROVED` cuando existe una cuenta OIDC confirmada y vinculada al sujeto real devuelto por el proveedor.

Errores mínimos: `404 ACCESS_REQUEST_NOT_FOUND`, `409 ACCESS_REQUEST_VERSION_CONFLICT`, `409 ACCESS_REQUEST_INVALID_STATE`, `422 PROVISIONING_FAILED`, además de los errores de autenticación y autorización.

## Reintentar aprovisionamiento

`POST /api/v1/hospital/access-requests/{requestId}/provisioning-retry`

Disponible únicamente para `PROVISIONING_FAILED`, con la misma capacidad institucional. Debe ser idempotente y no crear cuentas duplicadas. Cada intento genera auditoría y conserva la causa técnica de forma restringida, sin contraseñas ni secretos.

## Suspender o revocar acceso

`POST /api/v1/hospital/access-requests/{requestId}/access-state`

Entrada aprobada: `action` con `SUSPEND`, `REACTIVATE` o `REVOKE`, `expectedVersion`, `reasonCode` y comentario opcional. El comportamiento definido por `OD-04` exige revocación inmediata y denegación en la siguiente petición. La respuesta nunca debe indicar éxito hasta confirmar el resultado requerido en el proveedor de identidad o persistir un estado recuperable y visible.

## Contextos humanos existentes reutilizados

Tras aprobación y autenticación, el frontend debe usar los contratos ya existentes de sesión y selección de contexto humano. La navegación no puede inferir permisos desde el tipo solicitado. El backend decide los contextos disponibles y su alcance.

## Auditoría mínima

Las operaciones anteriores deben registrar los eventos definidos en `spec.md`, con actor, tenant, recurso, identificador, resultado, razón y correlación. Deben excluir contraseña, token, secreto y datos innecesarios de la persona.
