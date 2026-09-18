# Plan 010 - Hospital · Profesionales y Agenda (API y vistas conectadas)

## Resumen

**RETROSPECTIVO.** Este plan no propone trabajo: reconstruye, desde los commits
reales de `history.md` y desde las seis Task Specifications de `tasks/`, cómo se
construyó la capacidad que hoy existe.

Seis commits, **todos el 2026-08-22 entre las 15:35 y las 20:29** —cuatro horas
y cincuenta y cuatro minutos—. Cinco de ellos añaden documentos de tarea y uno
solo, `3d63154`, contiene toda la implementación: 49 archivos, 13 531
inserciones. El ciclo completo de trabajo y corrección quedó aplastado en ese
único commit, de modo que `git log` no permite reconstruir qué falló en cada
iteración: la historia vive en `tasks/`.

## Contexto técnico

Es el primer punto del repositorio en que una superficie **hospitalaria
escribe**. Las specs 007, 008 y 009 habían establecido, por ese orden: tenant
resuelto en servidor con RLS desde el primer dato; identidad y sesión
institucional compartida en cookie `HttpOnly`; y lectura hospitalaria de
pacientes con guard por rol y auditoría de acceso. La spec 010 reutiliza las
tres sin duplicar ninguna: no crea segunda `Person`, ni segundo `Patient`, ni
segunda identidad, ni segunda cookie, ni segundo mecanismo de auditoría.

Lo que sí introduce, y por eso resultó cara:

1. **Un rol institucional nuevo y disjunto**, `HOSPITAL_SCHEDULER`, que no
   compone ni hereda del rol de lectura de Pacientes.
2. **La única mutación con cookie del módulo Hospital**, que obligó a resolver
   CSRF/origen y a ampliar CORS con `PATCH`.
3. **Control optimista de concurrencia** resuelto dentro de la base, no en la
   aplicación.
4. **Dos vistas ya aprobadas visualmente** cuya fuente de datos había que
   sustituir sin tocar su composición.

El coste real no estuvo en el modelo ni en los endpoints: estuvo en el punto 4 y
en el **gate estático de alcance** `hospitalAlcance.test.ts`, que impone
igualdad exacta de conjuntos de clientes de red, puntos de inyección de `fetch`
y usos del reloj. Conectar dos vistas nuevas rompía ese gate por diseño, y tres
de los cinco paquetes de corrección existen para reconciliarlo.

## Fases de implementación (ejecutadas)

Orden **cronológico real**, tomado de `git log --date=format` sobre los commits
de `history.md`. No coincide con el orden en que los nombres de los paquetes lo
sugieren.

1. **15:35 — Tarea original.** `861e643`, «Add Hospital CORE-02 task»
   (390 líneas). Modelo mínimo, cuatro endpoints, rol nuevo, RLS, auditoría y
   conexión de las dos vistas. 15 STOP CONDITIONS.

2. **Sin commit propio — Paquete `-CORRECTION`.**
   `tasks/TASK-HOSPITAL-CORE-02-CORRECTION.md` es el único de los cinco que no
   tiene commit de tarea: se versionó **dentro** del commit de implementación
   `3d63154`. Cinco desbloqueos: allowlist de clientes del gate, autorización de
   la *mención* de `fetch` en dos vistas, excepción mínima de reloj para Agenda,
   `PATCH` en CORS y confirmación del patrón CSRF sobre `API_WEB_ORIGINS`. Aquí
   se decide que la ausencia de PostgreSQL con `MERDN_RUNTIME_ROLE=enforce`
   **no bloquea** el MVP local pero **sí** es gate antes de preproducción.

3. **17:22 — Corrección final de allowlist.** `1386c7f`,
   `-FINAL-CORRECTION` (211 líneas). Fija una lista cerrada de 18 archivos que
   «sustituye cualquier allowlist parcial o ambigua de los paquetes anteriores»
   (§1). Es la admisión explícita de que las allowlists previas eran ambiguas.

4. **18:29 — Continuación tras interrupción.** `c879c52`, `-CONTINUATION`
   (211 líneas). La ejecución se cortó a mitad:
   `hospitalProfessionalsConfig.ts` ya había adoptado los contratos nuevos y
   cinco consumidores seguían importando los antiguos. Estado registrado en §6:
   clientes **36 PASS**, gate **4 FAIL**, typecheck Web **FAIL con 43 errores**.
   El paquete prohíbe rehacer clientes, CORS, CSRF, backend y RLS, y aclara
   definitivamente la regla de fecha: `new Date(valor)` es transformación
   determinista, no lectura de reloj.

5. **19:38 — Cierre mínimo.** `9947c8e`, `-MINIMAL-CLOSE` (165 líneas). La
   capacidad ya funcionaba —135 pruebas focales PASS, 64 de regresión PASS— y
   solo quedaban «5 aserciones de `hospitalAlcance.test.ts` que todavía describen
   CORE-01» (§2). Allowlist de **un** archivo.

6. **19:50 — Corrección fail-closed.** `c2ba692`, `-FINAL-FAIL-CLOSED`
   (151 líneas). Llega **después** del paquete que pretendía cerrar la capacidad,
   y no es cosmético: había un código de identidad Scheduler por defecto en
   fuente, y «solo SECRET» aprovisionaba la identidad. §3.3 lo dice sin rodeos:
   «esa expectativa es el defecto y debe invertirse». Allowlist de tres archivos.
   `HOSPITAL_SCHEDULER` queda como el único rol institucional del repositorio
   **sin** código por defecto.

7. **20:29 — Implementación.** `3d63154`, «Implement Hospital CORE-02».
   Contiene el resultado de las seis fases anteriores: migración, cuatro
   modelos, tres controladores, tres servicios, guard, dos clientes web, dos
   vistas reconectadas, dos paneles, el gate actualizado y once archivos de
   prueba.

**Lo que esta cronología enseña:** el cierre se declaró antes de que se
descubriera el defecto de seguridad. Un paquete llamado «minimal close» precedió
en doce minutos a uno que corregía un fallo fail-closed real. Ninguna auditoría
de tercero revisó el resultado.

## Dependencias

- **Spec 001** — monorepo, NestJS, Next.js, Prisma, Vitest.
- **Spec 003** — las dos vistas `HospitalProfessionals` y `HospitalAgenda` que
  esta capacidad reconecta sin rediseñar.
- **Spec 007** — `Tenant`, `Person`, `Patient`, `AuditEvent`, `merdn_runtime`,
  `merdn_current_tenant()`, `withTenant()`, RLS.
- **Spec 008** — `InstitutionalIdentity`, `InstitutionalSession`, enum
  `InstitutionalRole`, cookie `merdn_institutional_session`.
- **Spec 009** — `hospital.module.ts`, `hospital.contract.ts`, patrón de guard
  institucional por rol y de auditoría de acceso concedido.
- **Externas** — PostgreSQL con rol no propietario sin `BYPASSRLS`; migraciones
  `core_01_init` → `core_01_hardening` → `municipality_core_01` →
  `hospital_core_01` → `hospital_core_02`; variables
  `MERDN_HOSPITAL_SCHEDULER_CODE`, `MERDN_HOSPITAL_SCHEDULER_SECRET` y
  `API_WEB_ORIGINS`. **No** depende de Keycloak/OIDC.

## Hitos

- **H1 — Modelo y aislamiento.** Cuatro tablas con FK compuestas, RLS con
  `USING` y `WITH CHECK`, privilegio mínimo sin `DELETE`. Fase 7.
- **H2 — Rol disjunto y fail-closed.** `HospitalSchedulerGuard` con `401`/`403`/
  `503`, y aprovisionamiento que exige código **y** credencial. Fases 6 y 7.
- **H3 — Mutación atómica con control optimista.** Asignación, vínculo y
  auditoría en una transacción; versión en el `WHERE`. Fase 7.
- **H4 — Vistas conectadas sin repliegue a fixtures.** Fases 4 y 7.
- **H5 — Gate de alcance reconciliado.** Fase 5.
- **H6 — RLS de escritura verificada en PostgreSQL con `enforce`.**
  **NO ALCANZADO.** Sigue siendo el gate pendiente antes de preproducción.

## Riesgos (vigentes hoy)

1. **RLS de escritura sin verificar.** `hospital-core-02.db.test.ts:57`
   condiciona las pruebas de escritura a un servidor PostgreSQL normal; el motor
   WebAssembly del entorno de desarrollo aborta ante cualquier escritura bajo
   `SET LOCAL ROLE merdn_runtime`. `WITH CHECK`, la denegación de
   `DELETE`/`INSERT`/`UPDATE` en ejecución y la reutilización del pool quedan
   `UNVERIFIED`. Es gate obligatorio antes de datos reales o despliegue.

2. **La capacidad no puede ejercerse en un despliegue real.** No existe ninguna
   vía autorizada para crear profesionales, afiliaciones ni citas: el rol de
   ejecución no tiene `INSERT` sobre `professional_profile`,
   `professional_affiliation` ni `appointment`. Sin solicitudes `REQUESTED`, la
   única mutación autorizada nunca se activa. La alta productiva se difirió
   deliberadamente y esa Task nunca se escribió.

3. **Invariante de auditoría no impuesto por la base.**
   `audit_event_resource_required` no incluye `CARE_ASSIGNMENT_CREATED` ni
   `APPOINTMENT_ASSIGNED`; la aplicación sí escribe el recurso, pero un cambio
   futuro podría dejar de hacerlo sin que nada falle. Exige una migración
   posterior que no existe.

4. **Ninguna auditoría de tercero.** `ls reviews/` no contiene
   `REVIEW-HOSPITAL-CORE-02` ni `REVIEW-HOSPITAL-CORE-01`, y `reviews/README.md`
   declara el directorio cerrado el 2026-08-25. La capacidad con la única
   mutación del módulo, con RLS de escritura sin verificar y con un defecto
   fail-closed corregido a mitad de camino, nunca fue revisada por nadie más.

5. **Ampliación silenciosa del rol.** `HOSPITAL_SCHEDULER` protege hoy también
   `POST /api/v1/visits/materialize` (`visits.controller.ts:140`), contra el
   límite que la Task original declaró. Cualquier trabajo futuro sobre este rol
   debe partir de que ya no está confinado a Hospital.

6. **Desajuste de zona horaria.** Todas las ventanas se calculan sobre el día
   UTC y el formulario de asignación usa la hora del dispositivo. En Colombia
   (UTC-05) una cita de las 19:00 cae en el día UTC siguiente y desaparece de la
   ventana seleccionada. Ninguna Task lo aborda.

7. **Identidad institucional compartida.** La auditoría atribuye el acto a una
   identidad opaca, nunca a la persona que opera. `TASK-HOSPITAL-CORE-02` §3.2
   limitó por eso el uso a desarrollo/MVP con datos ficticios o controlados. Ese
   límite sigue vigente y no ha sido levantado por ninguna spec posterior.

8. **Deuda de gate acumulada.** El gate `hospitalAlcance.test.ts` es de igualdad
   exacta y ya fue reescrito por las specs 012 y 014. Cualquier conexión nueva en
   el módulo Hospital lo romperá y requerirá una modificación explícita: es
   deliberado, pero conviene presupuestarlo antes de planear trabajo en Hospital.
