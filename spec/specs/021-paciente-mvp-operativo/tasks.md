# Tareas 021 - Paciente MVP operativo

> **Nada de esta lista está autorizado.** La spec sigue en `Pendiente` y sin
> consentimiento. La compuerta SDD **no abre** para ella.
>
> **Actualización del 2026-08-26.** **No queda ninguna decisión de producto
> abierta** ni **ningún asunto de arquitectura abierto**: se cerraron las nueve
> de §17.B, las dos de §17.C y los tres de §17.D, estos últimos resueltos por
> Codex el mismo día. Lo único que falta son los **dos actos del Product Owner**:
> aprobar la spec y registrar el consentimiento.
>
> Las tareas de implementación están agrupadas en los **cinco micro-paquetes**
> que fijó Codex, con el mismo orden y los mismos límites que `plan.md`.

## Bloqueadores previos — no los ejecuta Claude Code

### Cerrados el 2026-08-26 por el Product Owner

- [x] **T0.1** — §17.B-1 **Sesión canónica:** sesión humana OIDC. La cookie de
      autoinscripción **no** es la sesión permanente del portal.
- [x] **T0.2** — §17.B-2 **Inscripción → Paciente:** sin autorregistro nuevo;
      aprovisionamiento administrativo seguro existente para pruebas y piloto.
- [x] **T0.3** — §17.B-3 **Ruta:** se conserva `/`; no se crea `/paciente`; sin
      migración de return targets.
- [x] **T0.4** — §17.B-4 **Auditoría:** obligatoria; migración aditiva mínima y
      segura admitida y explícita en la spec; no se elimina para ahorrar tiempo.
- [x] **T0.5** — §17.B-5 y §17.B-6 **Contenido:** resumen mínimo —nombre o
      iniciales y contexto básico de orientación—; próximas citas propias y
      visitas propias recientes, con fecha y hora, modalidad, estado y datos
      mínimos; sin IDs técnicos ni terceros.
- [x] **T0.6** — §17.B-7 **Controles demo:** se **ocultan** de la experiencia
      operativa; su **código no se borra**.
- [x] **T0.7** — §17.B-8 **Cliente de sesión:** no es decisión de producto;
      la resuelven Codex y el agente 09 con mínimo cambio.
- [x] **T0.8** — §17.B-9 y §17.B-10 **Dependencias y terminación:** ninguna
      dependencia nueva por defecto, STOP y justificar antes si fuera
      imprescindible; definición de «Paciente MVP operativo» en §20.

- [x] **T0.9** — §17.C-1 **Experiencia post-inscripción:** la cookie de
      inscripción solo confirma y completa la inscripción; no es sesión de
      portal; no se entra automáticamente; `/` muestra «Inscripción completada»;
      hay entrada separada «Ingresar como Paciente»; el portal exige sesión
      humana OIDC; identidades de prueba y piloto por aprovisionamiento
      administrativo; **sin autorregistro nuevo**.
- [x] **T0.10** — §17.C-2 **Resumen, lista cerrada:** exactamente nombre de pila,
      iniciales y etiqueta fija `Paciente`. Nada más.

### Cerrados el 2026-08-26 por Codex — arquitectura, no producto

- [x] **T0.11** — §17.D-1 **Forma técnica de la auditoría:** **dos** valores del
      `enum AuditEventType` —`PATIENT_SELF_ACCESS_GRANTED` y
      `PATIENT_SELF_ACCESS_DENIED`—; resumen, citas y visitas diferenciados por
      **`resourceType`** y **`endpoint`**, no por más valores de enum; registro en
      el **`AuditService` existente**, no en uno propio del módulo; migración
      **aditiva mínima** con rollback **condicional**.
- [x] **T0.12** — §17.D-2 **Superficie HTTP:** exactamente tres endpoints —
      `GET /api/v1/patient-self/summary`,
      `GET /api/v1/patient-self/appointments`,
      `GET /api/v1/patient-self/visits`—, lista **cerrada**.
- [x] **T0.15** — §17.D-3 **Ubicación del cliente de sesión humana:**
      **`MOVE TO SHARED`** a `apps/web/src/features/auth/humanSessionClient.ts`,
      con **fachada compatible** en
      `apps/web/src/features/hospital/hospitalHumanSessionClient.ts`. Riesgo de
      regresión en Hospital: **BAJO**, y aun así su prueba de regresión es
      obligatoria.

### Pendientes — actos del Product Owner

- [ ] **T0.13** — El Product Owner aprueba la spec: `Estado / Status` a
      `Aprobado`, con fecha, aprobador y evidencia reales.
- [ ] **T0.14** — El Product Owner registra el consentimiento por spec:
      `./spec/scripts/confirm-user-consent.sh --spec 021-paciente-mvp-operativo "User approved implementation for spec 021-paciente-mvp-operativo"`

## Compuerta

- [ ] **T1.1** — Ejecutar y reportar `./spec/scripts/check-sdd-gate.sh .`
- [ ] **T1.2** — Ejecutar y reportar `./spec/scripts/validate-sdd.sh . --strict`
- [ ] **T1.3** — **Medir ejecutando** la línea base de pruebas de `apps/api` y de
      `apps/web`, y anotarla en `plan.md`. Contarla por lectura no vale.
- [ ] **T1.4** — Confirmar que una suite que no arranca **no** se cuenta como
      verde.

## Contrato de la API self-scope — antes del paquete 1

- [ ] **T2.1** — Escribir `contracts/paciente-self-scope.contract.md`: las tres
      rutas de §6.6-e, forma de respuesta, códigos, denegaciones uniformes y
      campos prohibidos.
- [ ] **T2.2** — Declarar explícitamente que **ninguna** ruta admite `patientId`,
      `personId`, `subject`, documento, tenant ni ningún selector de sujeto, en
      ruta, consulta, cuerpo ni cabecera.
- [ ] **T2.3** — Declarar la regla de minimización: si un campo no se pinta en la
      pantalla aprobada, no viaja en la respuesta.
- [ ] **T2.4** — Declarar que la lista de tres endpoints es **cerrada**: un
      cuarto endpoint, una ruta parametrizada o un método de escritura son STOP
      (§19.15).

---

# PACKET 1 — Auditoría mínima

*Máximo quince minutos. Archivos: `prisma/schema.prisma`, la migración, su
`ROLLBACK-*.sql`, `apps/api/src/audit/audit.service.ts` y su prueba.*

- [ ] **T4.1** — Añadir al `enum AuditEventType` **exactamente dos** valores:
      `PATIENT_SELF_ACCESS_GRANTED` y `PATIENT_SELF_ACCESS_DENIED`. Ninguno más,
      y ningún valor existente renombrado, reordenado ni eliminado.
- [ ] **T4.2** — Migración
      `prisma/migrations/<timestamp>_patient_self_audit_event_type/migration.sql`
      con **solo** los `ALTER TYPE ... ADD VALUE` de esos dos valores.
- [ ] **T4.3** — Rollback
      `prisma/migrations/ROLLBACK-patient_self_audit_event_type.sql`,
      **condicional**: comprueba primero si existen filas de `audit_event` con
      esos dos tipos y **aborta con error explícito** si hay alguna. No borra, no
      reasigna y no continúa.
- [ ] **T4.4** — Métodos de registro en el **`AuditService` existente**, no en
      uno propio del módulo.
- [ ] **T4.5** — Actor `HUMAN_ACCOUNT` con `actorUserId` = `HumanAccount.id`
      **opaco**, y `actorRole` **nulo** —la restricción
      `audit_event_actor_role_scope` solo admite rol institucional—.
- [ ] **T4.6** — Diferenciar las tres proyecciones por **`resourceType`**
      —`PatientSelfSummary`, `PatientSelfAppointments`, `PatientSelfVisits`— y
      por **`endpoint`**. **No** por más valores de enum.
- [ ] **T4.7** — Registrar `tenantId`, `outcome`, `endpoint`, `correlationId` y
      `occurredAt` en cada evento.
- [ ] **T4.8** — **Sin actor ficticio:** una petición sin principal humano
      resoluble **no** genera evento de esta familia y **no** recibe actor de
      relleno.
- [ ] **T4.9** — Confirmar que el evento **no** contiene documento, nombre,
      iniciales, dirección, territorio, EPS, fecha de nacimiento, sexo o género,
      ni contenido de cita o de visita.
- [ ] **T4.10** — **Fail-closed:** si el evento obligatorio no se persiste, la
      petición falla y no devuelve datos del paciente.

## Pruebas del paquete 1 — `apps/api/src/audit/audit.service.test.ts`

- [ ] **T4.11** — Migración **hacia adelante** aplicada, con los valores previos
      intactos.
- [ ] **T4.12** — **Rollback sin eventos dependientes:** se ejecuta y revierte.
- [ ] **T4.13** — **Rollback rechazado con eventos dependientes:** se detiene con
      error explícito, sin borrar ni alterar ninguna fila de `audit_event`.
- [ ] **T4.14** — Acceso **concedido**: `PATIENT_SELF_ACCESS_GRANTED` con
      `outcome = SUCCESS`.
- [ ] **T4.15** — Acceso **denegado**: `PATIENT_SELF_ACCESS_DENIED` con
      `outcome = DENIED`.
- [ ] **T4.16** — Actor `HUMAN_ACCOUNT` opaco y `actorRole` nulo.
- [ ] **T4.17** — **Ausencia de PII**, recorriendo los campos del evento y no
      solo uno.
- [ ] **T4.18** — Fail-closed de la auditoría.
- [ ] **T4.19** — **Inmutabilidad:** el evento no se actualiza ni se borra por la
      ruta de la aplicación.

**STOP del paquete 1:** cambio no aditivo del enum; otra tabla, columna, índice,
restricción o política RLS; rollback que borre o reasigne eventos; actor de
relleno; un valor de enum por endpoint; tocar `identity-audit.service.ts` o
`audit.module.ts`.

---

# PACKET 2 — API patient-self

*Máximo quince minutos. Archivos: `apps/api/src/patient-self/**`,
`app.module.ts` solo para registrar, y `apps/api/test/patient-self.api.test.ts`.*

- [ ] **T3.0** — Los **tres** endpoints de §6.6-e, y solo esos tres:
      `GET /api/v1/patient-self/summary`,
      `GET /api/v1/patient-self/appointments`,
      `GET /api/v1/patient-self/visits`.
- [ ] **T3.1** — Módulo nuevo, sin mezclar responsabilidades con `hospital/` ni
      con `visits/`.
- [ ] **T3.2** — Guard de sesión humana existente, **sin modificarlo**.
- [ ] **T3.3** — Sujeto resuelto con `resolvePatient`; el `patientId` **nunca**
      sale al cliente.
- [ ] **T3.4** — Consulta de citas: filtro por `tenantId` **y** por `patientId`,
      además de RLS.
- [ ] **T3.5** — Consulta de visitas: idéntica regla.
- [ ] **T3.6** — Ninguna firma de función acepta un identificador de sujeto.
- [ ] **T3.7** — Denegación uniforme `401`; denegación sin contexto `PATIENT` que
      no revela si existe paciente asociado; `503` fail-closed.
- [ ] **T3.8** — Sin escritura de ninguna clase.
- [ ] **T3.9** — Registro del módulo en `apps/api/src/app.module.ts`, y nada más
      de ese archivo.
- [ ] **T3.10** — Llamar al registro de auditoría del paquete 1 en cada uno de
      los tres endpoints, concedido y denegado.

## Pruebas del paquete 2 — `apps/api/test/patient-self.api.test.ts`

- [ ] **T5.1** — API: `200` con contexto `PATIENT` en **cada uno** de los tres
      endpoints —`summary`, `appointments`, `visits`—.
- [ ] **T5.2** — API: `401` **indistinguible** ante ausencia, caducidad absoluta,
      caducidad por inactividad, revocación y cuenta deshabilitada.
- [ ] **T5.3** — API: denegación con sesión humana y sin contexto `PATIENT`.
- [ ] **T5.4** — API: `503` fail-closed sin contexto de ejecución seguro.
- [ ] **T5.5** — **IDOR:** la respuesta con `patientId` ajeno en consulta, cuerpo
      o cabecera es **idéntica** a la respuesta sin él.
- [ ] **T5.6** — La respuesta no contiene `patientId`, `personId` ni
      `humanAccountId`.
- [ ] **T5.6-a** — **Cero selectores de sujeto en el contrato:** ninguna firma,
      DTO ni ruta de los tres endpoints declara `patientId`, `personId`,
      `subject`, documento, tenant ni institución. Se comprueba sobre el
      contrato, no solo sobre el comportamiento.
- [ ] **T5.6-b** — **Campos cerrados:** el conjunto de campos de cada una de las
      tres respuestas es exactamente el aprobado en §7, por **igualdad de
      conjunto**.

**STOP del paquete 2:** un cuarto endpoint, una ruta parametrizada o un método de
escritura; un selector de sujeto en cualquier firma, DTO o ruta; tocar
`human-auth/**`, `patients/**`, `identity-access/**`, `hospital/**` o
`visits/**`; tocar `app.module.ts` para algo que no sea el registro del módulo.

---

# PACKET 3 — DB / RLS / multitenant / IDOR

*Máximo quince minutos. Archivo: `apps/api/test/patient-self.db.test.ts`.*

- [ ] **T5.7** — **RLS:** con el rol de mínimo privilegio y el tenant activo,
      `appointment` y `home_visit` no devuelven filas de otro tenant.
- [ ] **T5.8** — **Doble control:** se demuestra que el filtro explícito por
      tenant está presente **además** de RLS.
- [ ] **T5.9** — **Multitenant:** sesión del tenant B no observa filas del tenant
      A por listado, detalle, orden, paginación ni mensaje de error.
- [ ] **T5.10** — **Mismo tenant, dos pacientes:** ninguno observa datos del otro.
- [ ] **T5.11** — Paciente no `ACTIVE`: no resuelve contexto y no devuelve filas.
- [ ] **T5.12** — Minimización: ningún campo prohibido en ninguna proyección.
- [ ] **T5.13** — Confirmar que **todos** los datos usados son ficticios.

**STOP del paquete 3:** que una prueba de aislamiento **no se pueda ejecutar**
—sin ella la tarea no se declara terminada (§19.7)—; cualquier necesidad de dato
real de paciente; modificar una prueba existente de `apps/api/test/` para que
pase.

---

# PACKET 4 — Cliente humano compartido + fachada Hospital + pacienteSelfClient

*Máximo quince minutos. Archivos: `features/auth/humanSessionClient.ts` y su
prueba (nuevos), `features/hospital/hospitalHumanSessionClient.ts` y su prueba
(fachada y regresión), `features/paciente/pacienteSelfClient.ts` y su prueba.*

- [ ] **T6.1** — `pacienteSelfClient.ts` con desenlaces explícitos y sin
      excepciones sin traducir.
- [ ] **T6.2** — **`MOVE TO SHARED` (§17.D-3):** extraer el cliente de sesión
      humana a `apps/web/src/features/auth/humanSessionClient.ts`, reutilizando
      la lógica existente **sin duplicar seguridad**.
- [ ] **T6.2-a** — Dejar
      `apps/web/src/features/hospital/hospitalHumanSessionClient.ts` como
      **fachada compatible** que reexporta la misma superficie. Ningún componente
      de Hospital cambia sus importaciones.
- [ ] **T6.2-b** — **Ningún otro archivo de `features/hospital/`** se toca
      (§19.16).

## Pruebas del paquete 4

- [ ] **T6.2-c** — Login en `/`, sin ampliar `HUMAN_AUTH_RETURN_TARGETS`.
- [ ] **T6.2-d** — Contexto `PATIENT` y contexto `PROFESSIONAL` interpretados, y
      **sin sumarse** entre sí.
- [ ] **T6.2-e** — `401` traducido a «sin sesión».
- [ ] **T6.2-f** — **Contexto ausente** traducido a «acceso no autorizado», y
      distinguible de `401`.
- [ ] **T6.2-g** — `503` traducido a «no disponible», fail-closed.
- [ ] **T6.2-h** — **Cuerpo inválido** tratado como fallo, nunca como sesión
      válida.
- [ ] **T6.2-i** — **Cancelación** con desenlace propio, sin error espurio.
- [ ] **T6.2-j** — Logout `204`, `401`, `403`, `429`, fallo de red o `5xx`, y
      cancelación: cada uno con su desenlace, sin afirmar un cierre no
      confirmado.
- [ ] **T6.2-k** — **Regresión de Hospital** en verde, ejecutando su suite **sin
      editarla**.
- [ ] **T6.2-l** — `npm run typecheck` en verde con la nueva ubicación y con la
      fachada.

**STOP del paquete 4:** tocar cualquier archivo de `features/hospital/` distinto
de la fachada y su prueba; que la fachada no pueda conservar la superficie que
Hospital ya importa; que la regresión de Hospital no se pueda ejecutar; duplicar
la lógica de sesión; ampliar `HUMAN_AUTH_RETURN_TARGETS`.

---

# PACKET 5 — Experiencia Paciente

*Máximo quince minutos. Archivos: `features/paciente/PacienteExperience.tsx`,
`InicioPaciente.tsx`, `paciente.module.css`, `paciente.test.tsx`,
`pacienteExperience.dom.test.tsx`, y `features/experiencia/ExperienciaMerdn.tsx`
solo para la conmutación de fase.*

- [ ] **T6.3** — Los seis estados: `loading`, `empty`, `error`, `retry`, sesión
      expirada y acceso no autorizado.
- [ ] **T6.3-a** — Confirmación «Inscripción completada» tras inscripción
      exitosa, **sin** abrir la experiencia autenticada (§17.C-1).
- [ ] **T6.3-b** — Entrada separada **«Ingresar como Paciente»**, distinta de la
      confirmación, que conduce al acceso autenticado OIDC (§17.C-1).
- [ ] **T6.3-c** — Resumen con **exactamente** nombre de pila, iniciales y
      etiqueta fija `Paciente`. Ningún cuarto campo (§17.C-2, §19.12).
- [ ] **T6.4** — `empty` y `error` visiblemente distintos.
- [ ] **T6.5** — Expiración: retira los datos ya cargados y ofrece volver a
      entrar.
- [ ] **T6.6** — Cierre confirmado: sin dato del paciente en pantalla.
- [ ] **T6.7** — Cierre **no** confirmado: aviso visible, sin afirmar el cierre,
      con reintento operable.
- [ ] **T6.8** — Sin `localStorage`, `sessionStorage`, IndexedDB ni identificador
      en la URL.
- [ ] **T6.9** — Región viva `polite` para sesión y carga; foco visible y
      manejable; ningún estado crítico comunicado solo por color.
- [ ] **T6.10** — Controles fuera del MVP **ocultos** —dejar de montarlos—, con
      su **código intacto** (§17.B-7). Borrarlos es STOP (§19.11).
- [ ] **T6.11** — Coherencia visual con ELOISA, reutilizando los componentes ya
      existentes.

**STOP del paquete 5:** **borrar** el código de una capacidad oculta en vez de
dejar de montarla (§19.11); añadir un **cuarto campo** al resumen (§19.12); que
la cookie de inscripción abra el portal (§19.13); crear
`apps/web/src/app/paciente/`; tocar `bitacoraFlow.ts`, `bitacoraFlow.test.ts` o
`BitacoraPaciente.tsx`.

## Pruebas del paquete 5 — interfaz

- [ ] **T7.1** — Cada uno de los seis estados, observable y distinguible.
- [ ] **T7.2** — `retry` vuelve a salir al servidor.
- [ ] **T7.3** — Recuperación tras recarga: sin sesión no hay datos; con sesión sí.
- [ ] **T7.4** — Cierre confirmado y cierre no confirmado.
- [ ] **T7.5** — Ausencia de persistencia en el cliente.
- [ ] **T7.6** — Accesibilidad: región viva, foco, nombres accesibles, no solo
      color.
- [ ] **T7.7** — Ningún control fuera del MVP aparece en la experiencia
      operativa, y `BitacoraPaciente.tsx`, `bitacoraFlow.ts` y sus pruebas siguen
      presentes en el repositorio y sin cambios.
- [ ] **T7.8** — Con **solo** la cookie de inscripción y sin sesión humana: no
      hay resumen, no hay citas y no hay visitas en pantalla (§17.C-1).
- [ ] **T7.9** — El conjunto de campos del resumen es **exactamente** tres. La
      aserción es de **igualdad de conjunto**, no de inclusión: un cuarto campo
      debe hacerla fallar (§17.C-2).
- [ ] **T7.10** — Ninguna ruta de la inscripción crea cuenta, vínculo de
      identidad ni sesión humana (§17.B-2).

## Verificación — cierre, fuera del reloj de los paquetes

- [ ] **T8.1** — `npm run typecheck` en verde.
- [ ] **T8.2** — Pruebas de API en verde, con la suite realmente arrancada.
- [ ] **T8.3** — Pruebas de web en verde, con la suite realmente arrancada.
- [ ] **T8.3-a** — **Regresión de Hospital** en verde, sin haber editado su
      suite.
- [ ] **T8.4** — ESLint acotado sin hallazgos.
- [ ] **T8.5** — `git diff --name-only` cae entero dentro de la allowlist de §12.
- [ ] **T8.6** — Cero dependencias nuevas; `package.json` y `package-lock.json`
      intactos.
- [ ] **T8.7** — Verificación en navegador, **o** declaración explícita de
      `BLOCKED_BROWSER_ACCESS` con su causa.
- [ ] **T8.8** — Toda prueba no ejecutada, reportada como tal.

## Cierre

- [ ] **T9.1** — Handoff a Codex conforme a `CLAUDE.md` §11 en
      `spec/bitacora/handoffs/`.
- [ ] **T9.2** — Registrar los commits en `history.md` leyéndolos de `git log`, no
      de memoria.
- [ ] **T9.3** — Actualizar `spec/specs/INDEX.md` y
      `spec/bitacora/global/PROJECT_LOG.md`.

## Fuera de alcance — no hacer

- [ ] ~~Ayuda urgente, bitácora clínica, pagos, mensajes, cuidador, consulta
      virtual, historia clínica y automatización clínica~~ — fuera del MVP.
- [ ] ~~Cualquier escritura por el Paciente: agendar, cancelar, reagendar,
      confirmar~~.
- [ ] ~~Acceso por relación paciente–cuidador~~ — capacidad distinta.
- [ ] ~~Modificar `human-auth`, `patients`, `identity-access`, `hospital` o
      `visits`~~ — denylist §13.
- [ ] ~~Crear `apps/web/src/app/paciente/`~~ — se conserva `/` (§17.B-3).
- [ ] ~~Que la cookie de inscripción abra el portal o dé acceso a citas o
      visitas~~ — §17.C-1 y §19.13.
- [ ] ~~Añadir un cuarto campo al resumen~~ — §17.C-2 y §19.12.
- [ ] ~~Construir cualquier forma de autorregistro o autovinculación de
      identidad~~ — §17.B-2.
- [ ] ~~Borrar el código de una capacidad oculta~~ — §17.B-7 y §19.11.
- [ ] ~~Tocar `prototype-claude/`~~ — `CLAUDE.md` §6.
- [ ] ~~Migración destructiva o sin `ROLLBACK-*.sql`~~.
- [ ] ~~Un cuarto endpoint, una ruta parametrizada o un método de escritura en
      `patient-self`~~ — §17.D-2 y §19.15.
- [ ] ~~Un valor de enum de auditoría por endpoint~~ — §17.D-1: se diferencia por
      `resourceType` y `endpoint`.
- [ ] ~~Borrar o reasignar eventos de auditoría para poder revertir~~ — §9.4 y
      §19.14.
- [ ] ~~Registrar un actor ficticio para una petición sin principal humano~~ —
      §9.2-2.
- [ ] ~~Tocar cualquier archivo de `features/hospital/` distinto de la fachada de
      sesión y su prueba~~ — §19.16.
- [ ] ~~Datos reales de pacientes~~ — hasta hardening y aceptación final.
- [ ] ~~Commit, push, merge, release o despliegue~~ — `CLAUDE.md` §12.

## Condición de terminación

- [ ] **T10.1** — Comprobar los **dieciséis** elementos de §20 de `spec.md`, uno
      a uno, con su prueba ejecutada. Un elemento sin prueba ejecutada **no**
      cuenta como cumplido, y una pantalla renderizada no demuestra nada
      (`CLAUDE.md` §10).
