# Contratos — spec 021 Paciente MVP operativo

Esta carpeta fija reglas de comportamiento **verificables**. Un contrato aquí no
crea decisiones: transcribe las ya cerradas y las deja en forma comprobable por
prueba.

## Estado, al 2026-08-26

- `spec.md` — **Aprobada** el 2026-08-26 por el Product Owner.
- Consentimiento por spec — **registrado** (`.sdd/user-consent.log`).
- Compuerta SDD — **ABIERTA** para la 021.
- Decisiones de producto abiertas — **ninguna** (§17.B, §17.C).
- Asuntos de arquitectura abiertos — **ninguno** (§17.D, resueltos por Codex).

Una compuerta abierta autoriza **implementar**. No autoriza integrar, hacer
commit, publicar ni desplegar (`CLAUDE.md` §12, §14.4).

## Índice de contratos

| Contrato | Paquete | Estado |
|---|---|---|
| **Auditoría del acceso propio del Paciente** — abajo, en este archivo | **Micro-packet 1** | **Cerrado** |
| `paciente-self-scope.contract.md` — rutas, forma de respuesta, códigos, denegaciones uniformes y campos prohibidos de la API de lectura (**T2.1–T2.4**) | Micro-packet 2 | **No escrito** |

El segundo pertenece a la superficie HTTP (§6.6-e, §6.6-f, §17.D-2) y **no** es
prerrequisito del Micro-packet 1: el paquete 1 no crea ningún endpoint. Se
escribe antes del paquete 2.

---

# Contrato de auditoría — acceso propio del Paciente

**Fuente cerrada y única:** `spec.md` §9 (§9.1 a §9.4), resuelto por Codex en
§17.D-1 bajo el límite del Product Owner de §17.B-4 —auditoría **obligatoria**,
migración **aditiva, mínima y segura**—. Este contrato **no** añade, relaja ni
reinterpreta nada de esas secciones.

## 1. Valores nuevos del `enum AuditEventType`

**Exactamente dos, y solo dos:**

```
PATIENT_SELF_ACCESS_GRANTED
PATIENT_SELF_ACCESS_DENIED
```

- Un **tercer** valor de esta familia, o un valor **por endpoint**, es STOP
  (§19.3, §19.1): rompe el límite «aditiva y mínima».
- **Ningún** valor preexistente se renombra, se reordena ni se elimina.

## 2. Semántica mínima del evento

Un evento de esta familia describe **un intento de lectura self-scope del
Paciente**, atribuible a un principal humano, con su desenlace. Nada más.

### 2.1 Campos obligatorios (§9.2-4)

| Campo | Valor exigido |
|---|---|
| `tenantId` | tenant del principal autenticado |
| `eventType` | `PATIENT_SELF_ACCESS_GRANTED` o `PATIENT_SELF_ACCESS_DENIED` |
| `actorType` | `HUMAN_ACCOUNT`, **siempre** |
| `actorUserId` | `HumanAccount.id`, **opaco** |
| `actorRole` | **nulo**, siempre |
| `resourceType` | `PatientSelfSummary`, `PatientSelfAppointments` o `PatientSelfVisits` |
| `outcome` | `SUCCESS` en el concedido, `DENIED` en el denegado |
| `endpoint` | la ruta exacta de §6.6-e que atendió la petición |
| `correlationId` | correlación técnica opaca de la petición |
| `occurredAt` | momento del intento |

`resourceId` queda **nulo**: un acceso a una superficie no crea ni modifica un
recurso identificable y **no** se sustituye por un identificador inventado. El
check `audit_event_resource_required` vigente lo admite sin cambio alguno: su
lista **obligatoria** nombra solo `PATIENT_ENROLLMENT_CREATED`,
`INSTITUTIONAL_SESSION_CREATED` e `INSTITUTIONAL_SESSION_REVOKED`.

`actorRole` nulo **no es una elección de estilo**: el check
`audit_event_actor_role_scope` solo admite rol junto a un actor institucional, y
`InstitutionalRole` no describe a una persona (§9.2-3).

### 2.2 Actor — principal humano resoluble, o ningún evento

1. **Solo se registra el intento con principal humano resoluble** (§9.2-1). Una
   petición sin cookie, con cookie inválida o con sesión ya revocada **no**
   genera evento de esta familia.
2. **Prohibido el actor ficticio** (§9.2-2). No se inventa actor, no se usa valor
   de relleno, no se registra `anonymous` y **no** se cae a
   `PUBLIC_SELF_ENROLLMENT` ni a `UNAUTHENTICATED`. Esa petición ya queda
   cubierta por el `401` uniforme de §8.
3. Por tanto `actorUserId` **nunca** es nulo en esta familia, y la ausencia de
   principal se expresa **no escribiendo el evento**, no escribiéndolo vacío.

### 2.3 Diferenciación de las tres proyecciones (§9.1)

Resumen, citas y visitas se distinguen **dentro del evento**, por dos campos que
la tabla ya tiene, y **nunca** por más valores de enum:

| `resourceType` | `endpoint` |
|---|---|
| `PatientSelfSummary` | `/api/v1/patient-self/summary` |
| `PatientSelfAppointments` | `/api/v1/patient-self/appointments` |
| `PatientSelfVisits` | `/api/v1/patient-self/visits` |

La correspondencia es **uno a uno y cerrada**. El `endpoint` es la **ruta
lógica**: sin parámetros, sin cadena de consulta, sin cuerpo, sin filtros y sin
conteos.

### 2.4 Cero PII y cero contenido clínico (§9.2-5)

El evento **no** registra, en ningún campo:

- documento, nombre, iniciales, dirección, territorio, EPS, fecha de nacimiento,
  sexo o género;
- el contenido de la cita o de la visita: fecha, hora, modalidad, estado;
- nota, motivo, diagnóstico ni dato clínico de ninguna clase;
- credenciales, tokens, hashes, cookies, cabeceras ni IP;
- `personId`, `patientId` ni ningún identificador de tercero;
- conteos, filtros, términos de búsqueda, paginación ni cuerpo de la respuesta;
- el **motivo detallado** de la denegación: la traza no debe permitir deducir si
  existe un paciente asociado (§8, `CLAUDE.md` §7 cierre).

La comprobación de ausencia recorre **el conjunto de campos** del evento, por
igualdad, y no se limita a mirar uno (§16, T4.17).

### 2.5 Fail-closed de la auditoría obligatoria (§9.2-6)

Si el evento **obligatorio** no se puede persistir, **la petición falla**. No se
devuelven datos del paciente con la traza perdida. Auditoría obligatoria que no
se escribe es acceso **no auditado**, y no existe variante sin auditoría de este
MVP (§17.B-4).

Forma técnica: el evento se escribe **dentro de la misma transacción** que sirve
los datos —el patrón `...Within(tx, ...)` que ya usan Hospital, Municipio,
Visitas y Soporte—, de modo que un fallo del evento aborta la transacción y no
puede existir una lectura servida sin su traza.

### 2.6 Inmutabilidad (§9.2-7)

Append-only. La ruta de la aplicación **solo** crea eventos: **ningún** camino
del código de esta spec ejecuta `UPDATE`, `DELETE`, `updateMany`, `deleteMany`
ni `upsert` sobre `audit_event`. Los eventos no son modificables por roles
ordinarios.

### 2.7 Lo que este contrato NO autoriza

- Un evento nuevo fuera de los dos declarados.
- Un servicio de auditoría propio del módulo: el registro vive en el
  **`AuditService` existente**, `apps/api/src/audit/audit.service.ts` (§17.D-1).
- Tocar `identity-audit.service.ts` o `audit.module.ts` (§13, STOP del paquete 1).
- Cualquier cambio en la auditoría **ya existente** que no sea el estrictamente
  necesario para estos dos eventos.

## 3. Migración — aditiva y mínima (§9.3)

- Una sola migración:
  `prisma/migrations/<timestamp>_patient_self_audit_event_type/migration.sql`.
- Su contenido es **solo** los `ALTER TYPE "AuditEventType" ADD VALUE` de los dos
  valores. **Nada más.**
- **Ninguna** otra tabla, columna, índice, restricción, política RLS, privilegio
  ni valor de ningún otro enum.
- **Ninguna** fila insertada ni actualizada. En particular la migración **no**
  escribe ningún evento: PostgreSQL prohíbe **usar** en la misma transacción un
  valor de enum añadido en esa misma transacción.
- Sin pérdida de datos y sin romper compatibilidad.

Cualquier cosa que exceda eso es STOP (§19.3).

## 4. Rollback — condicional, verificable y protegido (§9.4)

Ubicación, por la convención ya establecida en el repositorio —los
`ROLLBACK-*.sql` viven **junto** a los directorios de migración, no dentro—:

```
prisma/migrations/ROLLBACK-patient_self_audit_event_type.sql
```

### 4.1 Las cuatro reglas duras

1. **Permitido únicamente si NO existe ningún evento dependiente**: ninguna fila
   de `audit_event` con `eventType` en {`PATIENT_SELF_ACCESS_GRANTED`,
   `PATIENT_SELF_ACCESS_DENIED`}.
2. **Debe detenerse y rechazar la operación si existe al menos uno.** El script
   **comprueba primero** y **aborta con error explícito**. No borra eventos, no
   los reasigna a otro tipo y no continúa «porque son pocos».
3. **Cero pérdida de eventos.** Ningún camino del rollback puede eliminar,
   sobrescribir ni alterar una fila de `audit_event`.
4. Un rollback **rechazado** por eventos dependientes **no** es un fallo del
   paquete: es el comportamiento correcto, y así se prueba (§16, T4.13).

Borrar o reasignar eventos para poder revertir es STOP (§19.14): perder eventos
de auditoría es pérdida de traza material.

### 4.2 Límite declarado de PostgreSQL

PostgreSQL **no** ofrece `ALTER TYPE ... DROP VALUE`. Retirar un valor exigiría
crear un tipo nuevo y **reescribir** `audit_event."eventType"`, lo que es
inadmisible sobre una tabla append-only cuyo contenido es evidencia
institucional, y chocaría de frente con la regla 3.

Por tanto, y **exactamente igual que los nueve `ROLLBACK-*.sql` ya existentes en
este repositorio**, el rollback **declara** el límite en vez de simular una
reversión limpia:

- los dos valores del enum **permanecen** en PostgreSQL;
- un valor de enum sin uso es **inerte**: no concede acceso, no dispara escritura
  y no obliga a nadie a emitirlo;
- la reversión **efectiva** consiste en retirar el código que los emite, y eso
  ocurre **fuera** de la base de datos.

### 4.3 Los dos desenlaces verificables

| Precondición | Desenlace exigido |
|---|---|
| **Cero** filas con esos dos `eventType` | El script **procede**: confirma que no hay nada que destruir en la base de datos y declara los pasos seguros fuera de ella. Sale sin error |
| **Al menos una** fila con esos `eventType` | El script **aborta con error explícito**, no toca ninguna fila y no modifica el esquema |

Ambos desenlaces son **prueba obligatoria** del paquete 1 (T4.12, T4.13).

### 4.4 Reversión fuera de la base de datos — no la ejecuta el script

Solo con decisión expresa, y **únicamente** cuando ninguna fila use los valores:

1. retirar los dos valores de `prisma/schema.prisma` y regenerar el cliente
   (`npx prisma generate`). **Atención:** si alguna fila los usara, el cliente
   dejaría de reconocer un valor que **sigue** existiendo en PostgreSQL y leer
   ese evento pasaría a ser un error de deserialización;
2. retirar de `apps/api/src/audit/audit.service.ts` los métodos de registro del
   acceso propio, que son los **únicos** puntos que emiten estos eventos;
3. retirar la fila de `_prisma_migrations` correspondiente a la migración.

Ninguna de las tres la ejecuta el archivo de rollback.

---

## Trazabilidad

| Regla de este contrato | Origen cerrado |
|---|---|
| Dos valores de enum, y solo dos | `spec.md` §9.1, §9.3, §17.D-1 |
| Diferenciación por `resourceType` y `endpoint` | §9.1, §17.D-1 |
| Actor `HUMAN_ACCOUNT` opaco, `actorRole` nulo | §9.2-3 |
| Campos obligatorios | §9.2-4 |
| Solo intentos con principal humano; sin actor ficticio | §9.2-1, §9.2-2 |
| Cero PII y cero contenido clínico | §9.2-5, §7 |
| Fail-closed de la auditoría | §9.2-6, §17.B-4 |
| Inmutabilidad | §9.2-7 |
| Migración aditiva y mínima | §9.3, §17.B-4 |
| Rollback condicional y protegido | §9.4, §19.14 |
| Registro en el `AuditService` existente | §9.1, §17.D-1 |
