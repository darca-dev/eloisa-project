# IDENTITY-RELATIONSHIPS-CORE-01 — MP03-B

## Identificación

- **Paquete:** `MP03-B`
- **Objetivo:** cerrar con evidencia PostgreSQL el gate Profesional autenticado → paciente asignado requerido por `VISITS-CORE-01`.
- **Estado:** `READY FOR CLAUDE`
- **Tiempo máximo:** 15 minutos.
- **Tipo:** verificación focal; no implementación de runtime.

## Baseline ya implementado — no repetir

Preservar `HumanSessionGuard`, `IdentityAccessService.resolveProfessional()` y
`IdentityAccessService.hasActiveAssignmentOverPatient()`. La última operación ya
deriva el profesional desde `HumanPrincipal.personId` y consulta en una sola
transacción tenant-scoped el perfil, afiliación y `CareAssignment`.

Este paquete no reabre arquitectura ni autoriza cambios a esos servicios.

## Trabajo único

Crear una prueba PostgreSQL focal que, usando únicamente datos ficticios y el
rol runtime real, demuestre la cadena completa:

1. una sesión humana válida resuelve server-side un `HumanPrincipal`;
2. `resolveProfessional(principal, now)` devuelve el `ProfessionalProfile`
   activo de la misma `Person`, sin aceptar `professionalId` del cliente;
3. `hasActiveAssignmentOverPatient(principal, patientId, now)` permite solo
   cuando existe en el mismo tenant un perfil activo, una afiliación activa y
   vigente, y un `CareAssignment` activo y vigente para ese paciente;
4. deniega focalmente al menos: otro profesional, otro paciente, otro tenant,
   asignación inactiva y asignación vencida (`endsAt <= now`);
5. contexto tenant ausente o incorrecto falla cerrado; no se convierte en
   autorización ni en un resultado ambiguo.

Reutilizar los helpers y harness PostgreSQL existentes. No crear otro harness.
Si la prueba revela un defecto de runtime, detenerse y devolver evidencia; no
corregirlo dentro de MP03-B.

## Allowlist mínima

Claude puede crear o modificar exclusivamente:

- `apps/api/test/identity-professional-assignment.db.test.ts`.

No modificar ningún otro archivo. En particular quedan prohibidos:

- `apps/api/src/**`;
- `prisma/**`;
- `apps/web/**`;
- `prototype-claude/**`;
- Hospital visual, Reportes, Visits runtime, configuración, dependencias y
  limpieza opcional.

## Pruebas focales

Ejecutar únicamente:

```text
npx vitest run --config apps/api/vitest.config.mts apps/api/test/identity-professional-assignment.db.test.ts
```

No ejecutar suites completas, build completo, lint global ni pruebas ajenas.

## Criterio de cierre

MP03-B queda `COMPLETE` solo si la prueba focal pasa con PostgreSQL y rol
runtime real, cubriendo la autorización positiva y todas las denegaciones
enumeradas. Si el entorno DB no está disponible o aparece un defecto, reportar
`BLOCKED` con el fallo exacto; no declarar el gate cerrado.

## Handoff requerido

Claude devuelve solamente:

- archivo cambiado;
- comando exacto y resultado;
- evidencia concisa de los casos allow/deny;
- `MP03-B: COMPLETE` o `MP03-B: BLOCKED`;
- confirmación de que runtime, Prisma, web, prototype, Visits y Reportes no se
  tocaron.

