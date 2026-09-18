# VISITADOR-CORE-01 · MP01 — Professional Worklist API

## 1. Objetivo

Añadir la lectura profesional mínima que falta para que una persona Visitadora
autenticada pueda descubrir su agenda HOME asignada y abrir después una visita
real. Reutilizar íntegramente Human Auth/OIDC, `HumanPrincipal`,
`ProfessionalProfile`, `ProfessionalAffiliation`, `CareAssignment`,
`Appointment`, `HomeVisit`, RLS y los servicios Visits existentes.

MP01 es exclusivamente backend read-only. No crea UI, no materializa visitas y
no modifica Hospital.

## 2. Problema real

Ya existen:

- sesión humana OIDC y resolución server-side de la persona;
- autorización profesional por perfil, afiliación y CareAssignment vigentes;
- `GET /api/v1/professional/visits/:visitId`;
- START, COMPLETE y NOT_COMPLETED con optimistic version;
- historial append-only y auditoría de transiciones.

Pero no existe una ruta profesional de listado/agenda. La única lectura exige un
`visitId` previamente conocido, por lo que una interfaz Visitador no puede
descubrir de forma legítima sus pacientes, citas o visitas. El frontend no debe
obtener esos IDs desde Hospital, fixtures ni datos inventados.

## 3. Ruta y contrato

Añadir:

```text
GET /api/v1/professional/visits?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Protección: `HumanSessionGuard`. Es una lectura; no requiere SameOrigin, pero sí
`private, no-store` y `Vary: Cookie` mediante el helper existente.

### Query

- `from` y `to` obligatorios, fechas calendario ISO reales;
- `from <= to`;
- ventana máxima inclusiva de 31 días;
- rechazar campos desconocidos;
- no aceptar `tenantId`, `professionalId`, `patientId`, `careAssignmentId`,
  estado, actor, rol ni afiliación desde el cliente.

### Respuesta

Orden estable por `scheduledStart ASC`, después `appointmentId ASC`:

```text
{
  window: { from, to },
  items: [
    {
      appointmentId,
      scheduledStart,
      modality: "HOME",
      patient: { displayName, initials },
      visit: null | {
        homeVisitId,
        status,
        version,
        startedAt,
        endedAt,
        updatedAt
      }
    }
  ]
}
```

`visit=null` representa honestamente una cita HOME + ASSIGNED que Hospital aún
no materializó. No autoriza al profesional a materializarla.

No devolver:

- tenant, profesional, CareAssignment o HumanAccount IDs;
- documento, fecha de nacimiento, teléfono, correo, dirección, contacto,
  diagnóstico, alerta, semáforo, nota, historia clínica o evidencia;
- rating, zona, disponibilidad, conflicto, pago o dato derivado/inventado;
- transiciones históricas en este packet.

El `appointmentId` y `homeVisitId` son identificadores opacos necesarios para
abrir el detalle/acción posterior. No deben presentarse como texto visible en
UI futura.

## 4. Autorización y consulta

Toda la consulta se ejecuta en una sola operación bajo
`PrismaService.withTenant(principal.tenantId)`.

Derivar el profesional exclusivamente desde `principal.personId` y exigir en la
misma barrera:

1. `ProfessionalProfile.status = ACTIVE`;
2. al menos una `ProfessionalAffiliation` `ACTIVE` y vigente en el día de la
   consulta;
3. `CareAssignment.status = ACTIVE` y vigente en el instante del servidor;
4. Appointment del mismo CareAssignment, `modality = HOME`,
   `status = ASSIGNED`, dentro de la ventana solicitada;
5. Patient del CareAssignment/Appointment dentro del mismo tenant;
6. HomeVisit opcional correspondiente a esa Appointment y CareAssignment.

No confiar en una relación solo porque comparte un ID. Mantener filtros
explícitos por tenant además de FKs compuestas y FORCE RLS.

Si la cuenta no tiene perfil, afiliación o asignaciones vigentes, devolver lista
vacía honesta. No revelar si otro profesional sí tiene citas. Una fila ajena o
cross-tenant nunca aparece.

La ventana usa fechas calendario. Definir de forma explícita y probar sus
límites UTC sin inventar zona institucional no modelada.

## 5. Auditoría y privacidad

MP01 no añade auditoría de lectura: el enum/modelo actual no tiene todavía un
evento aprobado para worklist profesional y una migración excedería este
packet. No fingir un evento existente ni atribuir la lectura a Hospital.

Registrar este residual para un packet posterior de history/evidence. No emitir
PII en logs, errores o OpenAPI examples.

## 6. Errores

- query inválida → `400` estable, sin repetir valores recibidos;
- HumanSession ausente/inválida → `401` existente;
- runtime/RLS no confirmados → `503` fail-closed existente;
- no usar `403`/`404` para perfil o agenda vacía: la respuesta vacía evita
  enumeración y es suficiente para la superficie propia.

No modificar contratos de `GET :visitId` ni `PATCH :visitId/status`.

## 7. Allowlist exacta

- `apps/api/src/visits/professional-visit-worklist.service.ts`
- `apps/api/src/visits/visits.dto.ts`
- `apps/api/src/visits/visits.controller.ts`
- `apps/api/src/visits/visits.module.ts`
- `apps/api/test/visits.api.test.ts`

Cualquier otro archivo bloquea el packet.

## 8. Fuera de alcance

- frontend, ruta `/visitador`, shell o estilos;
- cambios Hospital, Admin Support o H-FID-C;
- materialización profesional;
- cambios a START/COMPLETE/NOT_COMPLETED;
- historia/evidencia, notas, archivos, GPS, firma o reglas clínicas;
- notificaciones, alertas, rating, métricas o Reportes;
- schema, migraciones, fixtures globales o demo fallback;
- nuevo login, rol, sesión, cookie o arquitectura de identidad;
- dependencias, refactor, suites completas, commit o push.

## 9. Pruebas focales

Extender únicamente `visits.api.test.ts` y ejecutar solo esa suite:

1. `401` sin HumanSession;
2. query ausente, fecha imposible, inversión, ventana >31 días y campo
   desconocido → `400`;
3. principal sin ProfessionalProfile → lista vacía;
4. perfil inactive o afiliación ausente/inactive/futura/vencida → lista vacía;
5. solo aparecen CareAssignments ACTIVE y vigentes de la persona autenticada;
6. otro profesional, paciente, tenant o assignment no aparece;
7. solo Appointment HOME + ASSIGNED y dentro de ventana;
8. cita aún no materializada aparece con `visit=null`;
9. cita materializada devuelve estado/version reales;
10. orden estable y límites de fechas;
11. respuesta minimizada: ausencia de IDs/PII/campos prohibidos;
12. ningún input acepta identidad o tenant fabricados;
13. RLS/runtime unavailable → `503`;
14. regresión focal de GET detalle y tres transiciones permanece verde;
15. OpenAPI de la ruta y DTO sin campos prohibidos, dentro de la misma suite.

Comandos desde `apps/api`:

```text
npx vitest run --config vitest.config.mts test/visits.api.test.ts --fileParallelism=false
npx tsc --noEmit -p tsconfig.json
npx eslint src/visits/professional-visit-worklist.service.ts src/visits/visits.dto.ts src/visits/visits.controller.ts src/visits/visits.module.ts test/visits.api.test.ts
git diff --check
git status --short
```

No ejecutar suites completas ni tests Hospital.

## 10. Evidencia requerida

- exactamente cinco archivos cambiados;
- conteo focal PASS, cero skipped;
- evidencia de derivación desde HumanPrincipal y filtros
  Profile/Affiliation/CareAssignment;
- casos cross-professional/cross-patient/cross-tenant;
- cita no materializada y visita materializada;
- respuesta minimizada y ausencia de campos fabricables;
- typecheck/eslint scope;
- cero cambios Hospital/UI/schema/migrations.

## 11. Stop conditions

Detenerse si:

1. se requiere aceptar professionalId/patientId/tenantId como autoridad;
2. se requiere debilitar la lectura `GET :visitId` existente;
3. la consulta necesita datos clínicos, dirección o reglas no aprobadas;
4. se requiere schema/migración o cambio de autenticación;
5. aparece cualquier archivo fuera de allowlist;
6. la suite focal revela un defecto real de seguridad/integridad;
7. el packet excede 15 minutos: reportar el punto exacto sin ampliar alcance.

READY FOR CLAUDE: YES
ESTIMATED CLAUDE TIME: 15 minutes
