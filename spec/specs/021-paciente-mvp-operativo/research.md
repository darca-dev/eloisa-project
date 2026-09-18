# Investigación 021 - Paciente MVP operativo

Todo lo de aquí se **midió** sobre `ad25520`, rama `develop`, el 2026-08-26. Nada
se infirió del prototipo, de la documentación ni de memoria.

## Hallazgos

### H1 — La experiencia de Paciente que existe es demostrativa, no operativa

`apps/web/src/features/paciente/PacienteExperience.tsx:22-27` lo dice en su
propio encabezado: «Estado efímero en memoria: sin red, sin Server Actions y sin
almacenamiento del navegador».

Superficie medida en `InicioPaciente.tsx`:

| Elemento | Cuántos | Estado |
|---|---|---|
| Tarjetas (`MIS CITAS`, `PEDIR AYUDA`, `MI SALUD`, `MI CUIDADOR`, `MIS PAGOS`) | 5 | inertes, `aria-disabled="true"` (`:161-167`) |
| Accesos rápidos (`Consulta Virtual`, `Visita en Casa`, `Ir al Hospital`, `Mensajes`) | 4 | inertes (`:191-197`) |
| Pestañas inferiores | 5 | inertes (`:226-248`) |
| Acciones con efecto real | 1 | abrir la bitácora de ocho etapas, en memoria (`:145`) |

**De las catorce superficies visibles, trece son inertes y la única viva está
fuera del MVP.** El aviso `merdn-sr-only` que las marca como demostrativas ya
existe (`PacienteExperience.tsx:47-50`), de modo que la honestidad de la
demostración está resuelta; lo que falta es la capacidad real.

### H2 — Coexisten dos sesiones distintas, y solo una es revocable

| | Cookie de autoinscripción | Sesión humana |
|---|---|---|
| Nombre | configurable, `environment.enrollmentSession.cookieName` | `merdn_human_session` (`human-auth.contract.ts:28`) |
| Cómo nace | al inscribirse, `POST /api/v1/patients/enrollments` | callback OIDC con PKCE S256 |
| Endpoint de cierre | **ninguno** — el controlador solo expone `POST /enrollments` (`:73`) y `GET /me` (`:149`) | `POST /api/v1/human-auth/logout` (`:233`) |
| Revocación | no modelada | sí, y conserva la fila para trazabilidad (`:224-232`) |
| Contexto de rol | ninguno | `PATIENT`, `PROFESSIONAL`, `CAREGIVER` |
| Vigencia | propia de la inscripción | absoluta 8 h, inactividad 30 min |
| Protección del cierre | no aplica | mismo origen + límite de intentos (`:239`) |

El alcance aprobado pide «logout real y revocable». La cookie de inscripción
**no lo ofrece**, y hoy es la que abre la experiencia de Paciente
(`ExperienciaMerdn.tsx:80-92`).

### H3 — El servidor ya sabe quién es el paciente, y no lo dice al cliente

`identity-access.service.ts:51-61`:

```ts
const patient = await this.prisma.withTenant(principal.tenantId, async (tx) =>
  tx.patient.findFirst({
    // Filtro explícito por tenant ADEMÁS de Row Level Security.
    where: { tenantId: principal.tenantId, personId: principal.personId, status: 'ACTIVE' },
    select: { id: true },
  }),
);
```

Tres propiedades regaladas para esta spec: **doble control** —RLS más filtro
explícito—, **exigencia de `ACTIVE`**, y **`patientId` que no sale al cliente**
(`human-contexts.service.ts:63-70`: «se quedan en el servidor, de modo que la
interfaz no pueda usarlos como autoridad en una petición posterior»).

Es la base exacta del self-scope, y no hay que inventarla.

### H4 — No existe ninguna API de lectura para el sujeto del dato

Inventario de rutas que tocan citas y visitas:

| Ruta | Alcance | Archivo |
|---|---|---|
| `GET /api/v1/hospital/agenda` | institucional / profesional | `hospital-agenda.controller.ts:63-70` |
| `GET`/`PATCH` de visitas profesionales | profesional asignado | `visits.controller.ts:255-404` |
| `POST /api/v1/.../materialize` | institucional | `visits.controller.ts:127-149` |

**Ninguna sirve al paciente.** El módulo `patient-self` de la spec es capacidad
nueva, no una generalización de las existentes: generalizar una ruta profesional
para que también sirva al sujeto mezclaría dos alcances de autorización en un
mismo camino de código, que es justo lo que `CLAUDE.md` §7.3 prohíbe.

### H5 — Inscribirse no crea cuenta autenticable. Es el hueco más grave

`prisma/schema.prisma:1069-1078`, sobre `ExternalAuthIdentity`:

> «El vínculo lo crea EXCLUSIVAMENTE el provisioning administrativo (AD-02): no
> existe autorregistro, ni autovinculación por claims, ni creación implícita de
> cuenta en el callback.»

Consecuencia directa: **el punto «entrada post-inscripción hacia Paciente» del
alcance aprobado no tiene hoy camino técnico aprobado**, si el acceso ha de ser
por sesión humana. Una persona que se inscribe queda con `Patient` y con
`Person`, pero sin `HumanAccount` y sin `ExternalAuthIdentity`, de modo que no
puede autenticarse.

No es un detalle de implementación: cualquier mecanismo que cerrara ese hueco
por su cuenta sería un **autorregistro de identidad**, con riesgo directo de
suplantación, y `CLAUDE.md` §4 lo pone entre las decisiones que Claude Code no
puede tomar.

### H6 — El destino de retorno tras login es una allowlist cerrada con un valor

`human-auth.contract.ts:70-84`:

```ts
export const HUMAN_AUTH_RETURN_TARGETS = ['/'] as const;
```

Y su comentario advierte que «la lista también vive como CHECK en la base, de
modo que ampliarla exige una migración». Una ruta `/paciente` como destino
post-login **arrastra migración**. Conservar la conmutación de fase dentro de `/`
la evita entera.

### H7 — La auditoría no tiene ningún evento para la lectura propia

`prisma/schema.prisma:124-171`: el `enum AuditEventType` tiene 47 valores. Están
cubiertos el acceso hospitalario, el municipal, el de soporte, las sesiones
humanas e institucionales, las visitas y las relaciones. **No hay ninguno para un
paciente leyendo lo suyo.**

Auditarlo exige valores nuevos, es decir una migración. Es **aditiva** y por
tanto reversible con un `ROLLBACK-*.sql`, pero sigue siendo un cambio de esquema
y no lo decide Claude Code.

Dato colateral útil: el actor `HUMAN_ACCOUNT` ya existe y ya está documentado
como **opaco** (`schema.prisma:183-190`), de modo que auditar sin exponer datos
sensibles es alcanzable sin inventar nada.

### H8 — La RLS necesaria ya está puesta, y en visitas está forzada

| Tabla | RLS | Evidencia |
|---|---|---|
| `appointment` | `ENABLE` + política `appointment_tenant` | `20260822160000_hospital_core_02/migration.sql:353`, `:372` |
| `home_visit` | `ENABLE` + `FORCE` + política `home_visit_tenant` | `20260824120000_visits_core_01/migration.sql:380-394` |
| `home_visit_transition` | `ENABLE` + `FORCE` | mismo archivo |

`FORCE` importa: aplica la política **también al propietario de la tabla**, de
modo que el aislamiento no depende de con qué rol se conecte el proceso.

El aislamiento **por paciente**, en cambio, **no** está en RLS: es alcance de
consulta, igual que en el worklist profesional. Por eso la spec exige demostrar
los dos controles por separado.

### H9 — El cliente de sesión humana existe y es reutilizable, pero está mal colocado

`apps/web/src/features/hospital/hospitalHumanSessionClient.ts` expone
`consultarSesionHumana` (`:182`), `cerrarSesionHumana` (`:239`) y
`cierreHumanoConfirmado` (`:278`), más `CONTEXTO_PROFESIONAL` (`:75`). Nada de su
lógica es hospitalaria: es el cliente de la sesión humana genérica.

Reutilizarlo desde Paciente por importación cruzada mete a `features/paciente/`
una dependencia de `features/hospital/` sin razón de dominio. Extraerlo es
refactor de un área ajena y exige autorización (`CLAUDE.md` §7.16).

**Cerrado el 2026-08-26 por Codex (§17.D-3): `MOVE TO SHARED`.** La lógica pasa a
`apps/web/src/features/auth/humanSessionClient.ts` y
`features/hospital/hospitalHumanSessionClient.ts` queda como **fachada
compatible** que reexporta la misma superficie. *Consecuencia medible:* las
cuatro exportaciones que este hallazgo midió —`consultarSesionHumana`,
`cerrarSesionHumana`, `cierreHumanoConfirmado` y `CONTEXTO_PROFESIONAL`— cambian
de archivo de origen pero **no** de nombre ni de forma, de modo que ningún
consumidor de Hospital toca sus importaciones. Riesgo de regresión evaluado por
Codex: **BAJO**, y aun así la prueba de regresión de la fachada es obligatoria.

### H10 — El modelo de datos sostiene el MVP sin cambios

`Appointment` (`schema.prisma:913-944`) y `HomeVisit` (`:1305-1348`) llevan
`tenantId` y `patientId`, con claves foráneas **compuestas** contra
`[id, tenantId]`, que hacen imposible por construcción asociar filas de tenants
distintos. `HomeVisit` además no borra en cascada por ninguna de sus relaciones,
que es lo que exige `CLAUDE.md` §7 para un registro material.

**No hace falta ninguna tabla nueva, ninguna columna nueva y ningún índice nuevo**
para leer citas y visitas propias.

### H11 — Estado de Visitador en el momento de crear esta spec

`feat/visitador-mp02-corrections` en `048ba94`, worktree rastreado limpio,
sincronizada con `origin` (`0 0`), con la spec 019 en `BLOCKED_BROWSER_ACCESS` y
sin integrar en `develop`. Esta spec **no la toca** y no depende de ella.

Colateral relevante: las specs **019** y **020** existen solo en esa rama. En
`develop` la última es la **018**. Por eso esta toma el **021** y no el 019, que
es lo que `new-spec.sh` habría asignado al mirar únicamente el disco.

## Decisiones derivadas de los hallazgos

1. **El self-scope se construye sobre `resolvePatient`, no sobre nada nuevo**
   (H3). Es la única fuente del sujeto y ya trae doble control.
2. **La API de Paciente es un módulo propio**, no una generalización de las rutas
   profesionales (H4), para no mezclar alcances de autorización.
3. **No se toca `human-auth`** (H2, H6). Se usa tal cual; cualquier necesidad de
   cambiarlo es STOP.
4. **El aislamiento se demuestra en dos capas separadas** (H8): RLS por tenant y
   filtro por paciente en la consulta, cada una con su prueba.
5. **El sujeto no viaja nunca en la petición** (H3, H4). Ninguna firma lo acepta:
   lo que no existe no se puede pasar por descuido.
6. **Los huecos H5, H6 y H7 se declararon como decisiones abiertas**, no se
   resolvieron por inferencia. Son identidad, migración y auditoría: las tres
   están en la lista de `CLAUDE.md` §4.
   **Cerrados por el Product Owner el 2026-08-26:** H5 → sin autorregistro nuevo,
   aprovisionamiento administrativo existente; H6 → se conserva `/`, sin migrar
   `HUMAN_AUTH_RETURN_TARGETS`; H7 → auditoría **obligatoria**, con migración
   aditiva mínima admitida y su forma técnica delegada a Codex.
   **Forma técnica cerrada por Codex el mismo día (§17.D-1):** **dos** valores del
   enum —`PATIENT_SELF_ACCESS_GRANTED` y `PATIENT_SELF_ACCESS_DENIED`—, con
   `resourceType` y `endpoint` diferenciando las tres proyecciones, registro en el
   `AuditService` **existente** y rollback **condicional** que se rechaza si hay
   eventos dependientes.
7. **No hacen falta cambios de modelo** (H10), lo que mantiene el MVP dentro de
   una superficie pequeña y reversible.
8. **La numeración salta a 021** (H11) para no colisionar con Visitador.

## Hallazgos derivados, ya cerrados

**HA1 — Qué muestra `/` justo después de inscribirse.** Era consecuencia directa,
y no prevista en la redacción inicial, de dos decisiones combinadas: la cookie de
inscripción deja de ser sesión de portal (decisión 1) y no hay autorregistro
(decisión 2). Por tanto **inscribirse ya no desemboca en la experiencia de
Paciente**, que es justo lo que `ExperienciaMerdn.tsx:80-92` hace hoy.

**Cerrado el 2026-08-26 (§17.C-1):** `/` muestra una confirmación de «Inscripción
completada» y ofrece una **entrada separada** «Ingresar como Paciente»; la cookie
de inscripción se queda **solo** con su papel de confirmar y completar la
inscripción; y el portal exige la sesión humana OIDC. *Consecuencia medible:* la
conmutación de fase de `ExperienciaMerdn.tsx:94-105` deja de tener dos fases y
pasa a tener tres —inscripción, confirmación, portal autenticado—, y la llamada a
`GET /api/v1/patients/me` deja de ser la que decide el acceso.

**HA2 — «Contexto básico de orientación» no era una lista de campos.** La
decisión 5 enumeraba con precisión lo prohibido pero dejaba lo incluido en una
frase, y sin lista cerrada la regla dura de minimización de §7 no se podía
verificar por prueba.

**Cerrado el 2026-08-26 (§17.C-2):** el resumen es **exactamente** nombre de
pila, iniciales y etiqueta fija `Paciente`. *Consecuencia medible:* de los diez
campos que hoy devuelve `PatientSummary` (`patientEnrollmentClient.ts:76-97`)
—estado, fecha de inscripción, nombres, apellidos, edad, poblaciones, territorio
con siete subcampos, código y nombre de EPS—, la proyección del resumen usa
**dos** y añade una etiqueta constante. La prueba se escribe como **igualdad de
conjunto**, no como inclusión: es la única forma de que un campo añadido más
tarde falle en vez de pasar desapercibido.

## Observaciones anotadas, fuera del alcance de esta spec

- ~~El cliente de sesión humana colocado dentro de `features/hospital/` (H9) es
  deuda de ubicación, no de comportamiento. Se anota; no se corrige aquí sin
  decisión.~~ **Ya no es observación fuera de alcance:** Codex decidió el
  2026-08-26 corregirla dentro de esta spec, con `MOVE TO SHARED` y fachada
  compatible (§17.D-3). Entra en el **paquete 4**.
- El modo de fallo del pool `forks` de vitest, medido en el paquete de Visitador,
  sigue sin diagnosticar. Afecta a cómo se lee un resultado de pruebas y por eso
  se repite como regla en `plan.md`, pero su causa no se investiga aquí.
