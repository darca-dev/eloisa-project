# TASK-HOSPITAL-CORE-02 — Paquete mínimo de corrección de bloqueos

## 1. Estado y autorización

Este paquete autoriza únicamente las correcciones necesarias para desbloquear la implementación parcial de `TASK-HOSPITAL-CORE-02`. No cambia modelos, contratos funcionales, permisos, vistas, módulos ni criterios de seguridad ya aprobados.

No autoriza commit, push, merge, deploy, datos reales ni cambios fuera del allowlist siguiente.

## 2. Correcciones autorizadas

### C-01 — `hospitalAlcance.test.ts`: clientes de red

Actualizar la allowlist cerrada para reconocer exactamente estos cuatro clientes Hospital:

1. `hospitalInstitutionClient.ts`
2. `hospitalPatientsClient.ts`
3. `hospitalProfessionalsClient.ts`
4. `hospitalAgendaClient.ts`

Los dos clientes nuevos quedan autorizados solo para los endpoints de Profesionales, Agenda y asignación definidos en CORE-02. Ningún otro archivo puede invocar `fetch`, ningún transporte alternativo queda autorizado y las prohibiciones de almacenamiento, telemetría, secretos y dependencias permanecen intactas.

Actualizar nombres, descripciones y aserciones obsoletas que todavía dicen “dos clientes” o que Profesionales/Agenda carecen de conexión. No debilitar la igualdad exacta de la prueba.

### C-02 — Inyección de `fetch`

Autorizar la mención, pero no la invocación directa, de `fetch` en:

- `HospitalProfessionals.tsx`
- `HospitalAgenda.tsx`

Cada vista puede aceptar `fetchImpl?: typeof fetch` exclusivamente para pasarlo a su cliente y permitir pruebas sin red. Las llamadas efectivas permanecen encapsuladas en `hospitalProfessionalsClient.ts` y `hospitalAgendaClient.ts`.

La allowlist exacta de archivos que pueden mencionar `fetch` queda formada por:

- los cuatro clientes;
- `HospitalPatients.tsx`;
- `HospitalShell.tsx`;
- `HospitalProfessionals.tsx`;
- `HospitalAgenda.tsx`.

### C-03 — Excepción mínima de fecha actual para Agenda

Autorizar `new Date()` exclusivamente en `HospitalAgenda.tsx`, y solo para obtener la fecha calendario inicial que determina la primera ventana de Agenda.

Condiciones:

- aceptar una inyección de reloj acotada, por ejemplo `now?: () => Date`, para pruebas deterministas;
- el default de producción puede ser `() => new Date()`;
- convertir inmediatamente a `YYYY-MM-DD`; no persistir el instante ni usarlo para inferir disponibilidad, estados, prioridad o reglas de negocio;
- no autorizar `Date.now`, temporizadores, relojes en otros archivos Hospital ni fechas demo fijas como fallback;
- cambios posteriores de día/semana/mes deben derivarse de la fecha seleccionada/estado de la vista, no releer continuamente el reloj.

`hospitalAlcance.test.ts` debe mantener la prohibición global y aplicar una excepción exacta por archivo y patrón. Debe fallar si `new Date()` aparece en cualquier otro archivo Hospital o si Agenda contiene más usos que el mínimo autorizado.

### C-04 — CORS para la mutación aprobada

Autorizar la modificación de `apps/api/src/main.ts` para agregar `PATCH` a la lista existente:

```ts
methods: ['GET', 'POST', 'PATCH', 'OPTIONS']
```

No autorizar `PUT`, `DELETE`, wildcard de métodos/orígenes/cabeceras ni cambios a `credentials`, `allowedHeaders` o `maxAge`. Agregar o ajustar una prueba enfocada solo si ya existe un punto de prueba adecuado dentro del allowlist; no crear infraestructura nueva para inspeccionar `bootstrap`.

### C-05 — CSRF/origen

Se confirma el uso de `ApiEnvironment.webOrigins`, derivado de `API_WEB_ORIGINS`, como allowlist única para CORS y para validar el origen de la mutación con cookie.

El patrón implementado es aceptable siempre que conserve:

- normalización al origen `scheme://host[:port]` al cargar configuración;
- comparación por igualdad exacta, sensible a esquema, host y puerto;
- preferencia por `Origin`; `Referer` solo cuando `Origin` está ausente;
- rechazo de origen vacío, `null`, inválido, no listado o lista vacía;
- rechazo cuando faltan ambos encabezados;
- ninguna comparación por sufijo, regex permisiva, wildcard o origen enviado en body/query;
- misma respuesta externa `403` sin revelar configuración.

No se autoriza un segundo env var, token CSRF nuevo, cabecera propietaria ni cambio de cookie en esta corrección.

## 3. Decisión RLS

La ausencia local de un servidor PostgreSQL normal con `MERDN_RUNTIME_ROLE=enforce` **no bloquea la finalización del MVP controlado de desarrollo**, siempre que:

1. las pruebas no ejecutadas se reporten explícitamente como `UNVERIFIED`, nunca `PASS`;
2. se ejecuten todas las verificaciones DB compatibles disponibles, incluidas migración, constraints, FKs tenant-aware, policies, grants y lecturas RLS que soporte el entorno;
3. no se relajen, borren ni simulen las pruebas de escritura RLS pendientes;
4. el handoff declare el riesgo y los comandos exactos pendientes.

Sí constituye gate obligatorio antes de:

- declarar CORE-02 `VALIDATED` para preproducción/producción;
- usar información personal o de salud real;
- desplegar la mutación de asignación fuera del entorno controlado;
- aceptar el slice como evidencia definitiva de tenant isolation.

Antes de cualquiera de esos pasos deben pasar en PostgreSQL normal, con rol runtime non-owner y sin `BYPASSRLS`, las pruebas de `WITH CHECK`, mínimo privilegio, escrituras cross-tenant, reutilización del pool y atomicidad de mutación/auditoría.

## 4. Archivos autorizados

- `apps/web/src/features/hospital/hospitalAlcance.test.ts`
- `apps/web/src/features/hospital/HospitalProfessionals.tsx`
- `apps/web/src/features/hospital/HospitalAgenda.tsx`
- `apps/web/src/features/hospital/hospitalProfessionalsClient.ts`
- `apps/web/src/features/hospital/hospitalAgendaClient.ts`
- `apps/web/src/features/hospital/hospitalProfessionalsClient.test.ts`
- `apps/web/src/features/hospital/hospitalAgendaClient.test.ts`
- `apps/web/src/features/hospital/hospitalProfessionals.test.tsx`
- `apps/web/src/features/hospital/hospitalAgenda.test.tsx`
- `apps/api/src/main.ts`
- `apps/api/src/hospital/hospital-appointment-assignment.origin.ts`
- `apps/api/src/hospital/hospital-appointment-assignment.request.test.ts`
- `apps/api/test/hospital-agenda.api.test.ts`, solo pruebas de origen/CORS relacionadas con el PATCH ya aprobado

Lectura y ejecución de pruebas existentes están permitidas. Si un archivo adicional resulta necesario, STOP y solicitar autorización antes de editarlo.

## 5. Prohibiciones y STOP CONDITIONS

- No modificar modelos, migración, endpoints, DTO, servicio de asignación, roles ni permisos.
- No abrir Visitas, Virtuales ni otro módulo.
- No ampliar CORS más allá de `PATCH`.
- No reemplazar la validación exacta de origen ni aceptar solicitudes mutantes sin `Origin`/`Referer` válido.
- No convertir las excepciones de red/fecha en patrones generales.
- No ocultar, saltar, eliminar ni marcar como exitosas las pruebas RLS no ejecutadas.
- STOP si la corrección necesita otro archivo, dependencia, cambio de cookie, nuevo mecanismo CSRF o cambio funcional.

## 6. Evidencia requerida a Claude

1. Diff limitado al allowlist.
2. Resultado de `hospitalAlcance.test.ts` demostrando igualdad exacta de clientes, puntos de inyección y excepción única de fecha.
3. Pruebas de los dos clientes y de ambas vistas.
4. Evidencia de que preflight/CORS admite `PATCH` solo desde un origen permitido.
5. Pruebas de origen permitido, no permitido, `null`, inválido, ausente y fallback seguro a `Referer`.
6. Informe RLS separando `PASS` de `UNVERIFIED` y declarando el gate preproducción.
7. Suites de regresión afectadas.

---

HOSPITAL-CORE-02 REVIEW: CORRECTION REQUIRED

CLAUDE ACTION REQUIRED: YES

RLS DECISION: No bloquea el MVP local controlado; PostgreSQL normal con `MERDN_RUNTIME_ROLE=enforce` es gate obligatorio antes de VALIDATED preproductivo, datos reales o deploy.

CLAUDE CORRECTION PACKET: `tasks/TASK-HOSPITAL-CORE-02-CORRECTION.md`
