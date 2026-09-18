# Bitácora del proyecto / Project log

Una entrada por sesión: qué se decidió, qué se hizo, qué queda.
One entry per session: what was decided, what was done, what is left.

| Fecha / Date | Sesión / Session | Resumen / Summary |
|---|---|---|
| 2026-08-25 | Protección de Visitador MP02 | Se preserva en rama WIP y en GitHub el código de MP02 que vivía sin control de versiones en una sola máquina. `develop` se actualiza por fast-forward. Sin merge, sin pruebas, sin aprobación. Detalle abajo. |
| 2026-08-25 | Auditoría de MP02 y spec 018 | Codex audita MP02: `PASS WITH CORRECTIONS`. Se registran las seis correcciones en la spec 017, el Product Owner aprueba el alcance de B1 y B2, y se crea y aprueba la spec 018 acotada a esas dos. Sin código, sin consentimiento, sin merge. Detalle abajo. |

---

## 2026-08-25 — Protección de Visitador MP02

**Autorización:** expresa del Product Owner, para proteger el trabajo antes de
cualquier otra operación Git.

### Qué se hizo

1. **Visitador MP02 quedó protegido en la rama `wip/visitador-mp02-20260825`**,
   creada desde el estado local de `develop` en `6a54de9`.
2. **Commit `cffbf6bd7b5e19a4fb712467e928f92698b18b99`** —
   `wip(visitador): preserve mp02 implementation`. Seis archivos, 2.763 líneas
   añadidas, todos `create mode 100644`; ninguna modificación a archivo
   existente:

   | Archivo | Líneas |
   |---|---|
   | `apps/web/src/app/visitador/page.tsx` | 32 |
   | `apps/web/src/features/visitador/VisitadorExperience.tsx` | 931 |
   | `apps/web/src/features/visitador/visitador.module.css` | 357 |
   | `apps/web/src/features/visitador/visitadorExperience.test.tsx` | 491 |
   | `apps/web/src/features/visitador/visitadorWorklistClient.test.ts` | 466 |
   | `apps/web/src/features/visitador/visitadorWorklistClient.ts` | 486 |

3. **La rama se subió a GitHub.** `origin/wip/visitador-mp02-20260825` apunta al
   mismo SHA que la rama local (`cffbf6b`), verificado con `git rev-parse`.
4. **El riesgo de pérdida en una única máquina queda cerrado.** La decisión
   `2026-08-25-auditoria-git-y-estado-de-ramas.md` clasificaba este trabajo como
   riesgo CRÍTICO y registraba que existía solo en la copia de trabajo del
   auditor. Esa condición dejó de cumplirse: el trabajo existe ahora también en
   el remoto. Esa misma decisión preveía esta revisión («Si el trabajo de
   Visitador se commitea o se pierde: en ambos casos cambia el riesgo
   principal»).
5. **`develop` se actualizó por fast-forward** de `6a54de9` a `fdc1d03`
   (`docs(sdd): record adoption, git audit and board decisions`), con
   `git pull --ff-only`. Fast-forward puro: `git log --merges` sobre el rango
   incorporado devuelve vacío, no se creó commit de merge y no se reescribió
   historial. Con él entraron el sidecar SDD (`spec/`), `CLAUDE.md` §14,
   `AGENTS.md` §22, `AI_START_HERE.md`, `INSTRUCTIONS.md` y los `README.md` que
   congelan `tasks/` y `reviews/`.
6. **El working tree de `develop` quedó limpio.**
   `git status --porcelain -uall` no devuelve nada: sin archivos sin
   seguimiento, sin modificaciones, sin staging y sin stashes. Local y
   `origin/develop` sincronizados (`behind=0 ahead=0`).
7. **No se hizo merge de Visitador hacia `develop`.** La rama WIP permanece
   separada. No se tocaron las otras dos ramas WIP ni `main`.

### Qué NO se hizo, y sigue pendiente

- **La implementación de MP02 no está aprobada.** Preservarla no la valida.
- **No se ha leído ni revisado el contenido de los seis archivos.** Lo único
  verificado es que sus nombres coinciden con la allowlist de seis archivos de
  `tasks/VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md`.
- **No se ejecutó ninguna prueba.** Dos de los seis archivos son suites
  (`visitadorExperience.test.tsx`, `visitadorWorklistClient.test.ts`) y no se
  corrieron. Sigue vigente la advertencia general de `TRAZABILIDAD.md`: sin
  `node_modules/` y sin PostgreSQL no se ha ejecutado ninguna suite del
  repositorio.
- **No hay auditoría de Codex** para esta capacidad, como para las otras nueve
  specs posteriores al 2026-08-22.
- **La spec 017 sigue en estado de aprobación `Pendiente`.**

### Documentación actualizada en esta sesión

`spec/specs/017-worklist-del-visitador/spec.md`, `plan.md`, `tasks.md` e
`history.md`, para corregir las afirmaciones que este cambio volvió falsas —
sobre todo «no tiene implementación posterior en ninguna rama». No se modificó
código de aplicación, no se cambió el estado de aprobación de la spec y no se
tocaron `tasks/` ni `reviews/`.

---

## 2026-08-25 — Auditoría de Visitador MP02 y creación de la spec 018

**Autorización:** expresa del Product Owner, en tres pasos dentro de la misma
sesión: registrar las correcciones, aprobar el alcance de B1 y B2, y crear y
aprobar una spec acotada a ellas.

### Qué se hizo

1. **Codex auditó MP02** sobre `wip/visitador-mp02-20260825` (`cffbf6b`) y
   devolvió `PASS WITH CORRECTIONS`, `SAFE TO INTEGRATE INTO DEVELOP: NO` y
   `SPEC 017 READY FOR APPROVAL: NO`.
2. **Las seis correcciones B1–B6 quedaron registradas** en la spec 017,
   separando lo bloqueante del hardening posterior y listando las decisiones de
   producto que faltan para B3, B4 y B5. Se corrigieron de paso las afirmaciones
   que la auditoría volvió falsas: «no se ha leído ni revisado el contenido» y
   «no existe auditoría de Codex», hoy ciertas solo para MP01.
3. **B1 y B2 se midieron sobre el código preservado**, en solo lectura:
   `normalizarVisita` colapsa `undefined` con `null`
   (`visitadorWorklistClient.ts:281-284`), y `normalizarWorklist` nunca compara
   la ventana devuelta con la solicitada (`:361-364`, llamada en `:468`).
4. **El Product Owner aprobó el alcance de B1 y B2**, y solo de esas dos.
   Registro:
   `spec/bitacora/decisiones/2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md`.
5. **Se comprobó que SDD no admite aprobación parcial**: el gate lee el
   `Estado / Status` de una `spec.md` entera y exige consentimiento por spec. Por
   eso la spec 017 **no** se aprobó.
6. **El Product Owner eligió la vía B** y se creó
   `spec/specs/018-correcciones-visitador-mp02/` con
   `./spec/scripts/new-spec.sh`: los cinco archivos del modelo SDD más un
   contrato de aceptación de la respuesta, cubriendo los 18 campos de
   `CLAUDE.md` §8, con allowlist de **dos** archivos.
7. **La spec 018 se aprobó** el mismo día, con alcance limitado a B1 y B2.

### Qué NO se hizo, y sigue pendiente

- **No se escribió ninguna línea de código.** Ni en `develop`, ni en la rama WIP.
- **No se ejecutó `confirm-user-consent.sh`.** El consentimiento es un acto del
  Product Owner (`CLAUDE.md` §14.4). Sin él, el gate reporta error para la 018:
  una spec aprobada sin consentimiento no es una compuerta abierta.
- **No se resolvió la decisión de rama.** Los dos archivos de la allowlist de la
  018 no existen en `develop`, y tanto modificar la rama WIP como integrarla
  están fuera de alcance. Es una STOP CONDITION declarada, con tres alternativas
  y una recomendación, sin elegir.
- **No se ejecutó ninguna prueba.** Las 78 pruebas focales de MP02 están
  contadas por lectura, no corridas.
- **B3, B4 y B5 siguen pendientes**, bloqueadas por decisiones sobre dependencia
  DOM, ampliación de allowlist y entorno de ejecución.
- **La spec 017 sigue en `Pendiente`** y MP02 sigue sin integrarse.
- **No hubo commit, push ni merge**, y no se tocaron `main` ni las tres ramas WIP.

## 2026-08-26 — Paciente MVP: rama aislada y spec 021, sin código

### Qué se hizo

1. **Se protegió el checkpoint de Visitador.** `feat/visitador-mp02-corrections`
   quedó intacta en `048ba94`, con worktree rastreado limpio, staging limpio y
   sincronizada con `origin` (`git rev-list --left-right --count` → `0 0`). La
   spec 019 sigue en `BLOCKED_BROWSER_ACCESS` y MP02 **no** se integró en
   `develop`.
2. **Se verificó `develop`.** `git pull --ff-only origin develop` → `Already up
   to date`; local e `origin/develop` idénticas en `ad25520`.
3. **Se creó la rama `feat/paciente-mvp-20260826`** desde esa `develop`, sin
   mergear la feature de Visitador. No existía antes.
4. **El Product Owner aprobó el alcance de producto del Paciente MVP** para el
   hito del 2 de septiembre. Registro:
   `spec/bitacora/decisiones/2026-08-26-alcance-paciente-mvp.md`.
5. **Se creó `spec/specs/021-paciente-mvp-operativo/`** con los cinco archivos
   del modelo SDD más `contracts/README.md`, cubriendo los 18 campos de
   `CLAUDE.md` §8, con allowlist propuesta por capas, denylist explícita y STOP
   CONDITIONS propias.
6. **Se eligió el identificador 021 y no el 019.** Los identificadores 019 y 020
   están ocupados en `feat/visitador-mp02-corrections` y no existen en `develop`,
   de modo que `new-spec.sh` habría asignado 019 y provocado una colisión de
   directorios al integrar Visitador. El directorio se creó a mano con la misma
   estructura que produce el script.

### Qué se midió, y no se supuso

- La experiencia de Paciente que existe hoy es **demostrativa**: de sus catorce
  superficies visibles, trece son inertes y la única viva —la bitácora de ocho
  etapas— está **fuera del MVP**.
- Coexisten **dos sesiones distintas** y solo la humana es revocable: la cookie
  de autoinscripción no tiene endpoint de cierre.
- `resolvePatient` ya resuelve el sujeto en el servidor, con filtro por tenant
  **además** de RLS, exigiendo paciente `ACTIVE`, y el `patientId` nunca sale al
  cliente.
- **No existe** ninguna API de lectura para el sujeto del dato: las de citas y
  visitas son de profesional o de institución.
- **No existe** camino aprobado de la inscripción a una cuenta autenticable: el
  aprovisionamiento de identidad es exclusivamente administrativo.
- **No existe** ningún valor de `AuditEventType` para un paciente leyendo lo
  suyo; auditarlo exige una migración aditiva.
- La RLS por tenant ya está puesta en `appointment` y **forzada** en `home_visit`.
- El modelo de datos sostiene el MVP **sin ninguna tabla, columna ni índice
  nuevos**.

### Qué NO se hizo, y sigue pendiente

- **No se escribió ninguna línea de código**, ni se añadió dependencia, ni se
  tocó el esquema, ni se creó migración, ni se tocó CSS.
- **No se ejecutó `confirm-user-consent.sh`.** El consentimiento es un acto del
  Product Owner (`CLAUDE.md` §14.4).
- **La spec 021 sigue en `Pendiente`.** La decisión del Product Owner registrada
  es de **alcance de producto**, no aprobación de la spec.
- **Diez decisiones de producto quedaron abiertas** (§17.B de la spec). Las tres
  primeras —mecanismo de sesión, camino post-inscripción y ruta con su destino
  de retorno— **bloquean toda la implementación**.
- **No hubo commit, push ni merge**, y no se tocaron `main`, `develop` ni las
  ramas `wip/*`.

## 2026-08-26 — Paciente MVP: cierre de decisiones de producto, sin código

### Qué se hizo

1. **El Product Owner cerró las nueve decisiones de producto abiertas** de la
   spec 021 y añadió una definición de terminación. Registro:
   `spec/bitacora/decisiones/2026-08-26-decisiones-paciente-mvp.md`.
2. **Se aplicaron a la documentación de la spec**, sin escribir código.

### Las decisiones

1. **Sesión canónica:** sesión humana **OIDC**. La cookie de autoinscripción
   **no** será la sesión permanente del portal.
2. **Inscripción → Paciente:** **sin autorregistro nuevo** de identidad; las
   identidades de pruebas y piloto se aprovisionan con el mecanismo
   administrativo seguro existente. La automatización queda fuera del MVP.
3. **Ruta:** se conserva **`/`**; no se crea `/paciente`; **sin migración de
   return targets**.
4. **Auditoría:** **obligatoria**. La forma técnica la define Codex. Si requiere
   migración **aditiva mínima y segura** de `AuditEventType`, debe quedar
   explícita en la spec. **No se elimina para ahorrar tiempo.**
5. **Resumen:** solo **nombre o iniciales** y **contexto básico de orientación**.
   **Sin** documento, territorio, diagnósticos, información clínica, EPS ni otros
   datos sensibles innecesarios.
6. **Citas y visitas:** **solo las propias**. Próximas citas y visitas recientes,
   con fecha y hora, modalidad, estado y datos mínimos. **Sin** identificadores
   técnicos ni información de terceros.
7. **Controles demo fuera del MVP:** se **ocultan** de la experiencia operativa;
   **su código no se borra**.
8. **Cliente de sesión:** **no es decisión de producto**; la resuelven Codex y el
   agente 09 dentro de la arquitectura existente y con mínimo cambio.
9. **Dependencias:** **ninguna nueva** por defecto; si alguna fuera
   imprescindible, **STOP y justificar antes**.
10. **Definición de «Paciente MVP operativo»:** dieciséis elementos, recogidos en
    la §20 de la spec. Todo lo demás queda después del 2 de septiembre.

### Qué cambió en la documentación

- `spec.md`: §6.1, §6.7, §6.8, §6.9, §6.15, §6.16, §7, §9, §12, §13, §14, §19; la
  §17 quedó reestructurada en **17.A** alcance, **17.B** decisiones cerradas,
  **17.C** concreciones pendientes, **17.D** asuntos delegados a Codex y **17.E**
  heredadas; y se añadió la **§20** con la definición de terminación.
- Se **retiró** `apps/web/src/app/paciente/page.tsx` de la allowlist, por la
  decisión 3.
- `plan.md`, `tasks.md`, `research.md`, `history.md`, `spec/specs/INDEX.md`.

### Qué queda pendiente

- **§17.C-1** — qué muestra `/` justo después de inscribirse. Es consecuencia
  directa de las decisiones 1 y 2 combinadas: inscribirse ya no desemboca en la
  experiencia de Paciente. Bloquea solo la conmutación de fase.
- **§17.C-2** — lista cerrada de campos del «contexto básico de orientación».
  Bloquea solo la proyección de resumen.
- **§17.D-1** — forma técnica de la auditoría, delegada a Codex.
- **§17.D-2** — ubicación del cliente de sesión humana, delegada a Codex.
- **Aprobación de la spec** y **consentimiento por spec**, ambos actos del
  Product Owner.

### Qué NO se hizo

- **Ninguna línea de código**, ninguna dependencia, ningún cambio de esquema,
  ninguna migración, ningún CSS.
- **No se cambió el estado de la spec a `Aprobado`** y **no se ejecutó
  `confirm-user-consent.sh`.**
- **No hubo commit, push ni merge**, y no se tocaron `main`, `develop` ni las
  ramas `wip/*`. Visitador sigue intacto en `048ba94`.

## 2026-08-26 — Paciente MVP: cierre de las dos decisiones finales, sin código

### Qué se hizo

El Product Owner cerró las **dos concreciones** que quedaban de la spec 021.
Registro: `spec/bitacora/decisiones/2026-08-26-decisiones-finales-paciente-mvp.md`.

**Con esto, la spec 021 no tiene ninguna decisión de producto abierta.**

### Las decisiones

**1. Experiencia post-inscripción en `/`.** Tras una inscripción exitosa: la
cookie de inscripción sirve **únicamente** para confirmar y completar la
inscripción; **no** es sesión permanente del portal; **no** se entra
automáticamente a la experiencia autenticada; `/` muestra una **confirmación
clara de «Inscripción completada»**; existe una **entrada separada «Ingresar como
Paciente»**; el acceso al portal exige la **sesión humana OIDC canónica**; y las
identidades de prueba y piloto se aprovisionan con el **mecanismo administrativo
seguro existente**. **No se crea autorregistro nuevo de identidad.**

**2. Campos cerrados del resumen.** El resumen del Paciente queda limitado
**exactamente** a **nombre de pila**, **iniciales** y **etiqueta fija
«Paciente»**. **No** se muestran documento, fecha de nacimiento, sexo o género,
EPS, territorio, diagnósticos, información clínica, identificadores técnicos,
información de terceros ni cualquier otro dato no incluido.

### Por qué importan

La primera **cierra un modo de fallo real**: hoy `ExperienciaMerdn.tsx:80-92`
consulta `GET /api/v1/patients/me` en cada carga y, si hay paciente, abre la
experiencia. Es decir, la cookie de inscripción —sin logout y sin revocación— es
hoy lo que da acceso. La decisión le retira ese papel de forma expresa.

La segunda **hace verificable la minimización**: una lista cerrada de tres campos
se prueba por **igualdad de conjunto**, de modo que un cuarto campo añadido más
tarde falla en vez de pasar desapercibido. Una descripción en prosa no lo
permite.

### Qué cambió en la documentación

- `spec.md`: nueva subsección de requisitos **«Entrada post-inscripción»**
  (§6.6-a a §6.6-d); **§6.7 reescrito** como lista cerrada de tres campos con su
  denylist expresa; §7; §12; escenarios 12, 13 y 14; cuatro criterios EARS
  nuevos; Requisito 2-bis; dos propiedades nuevas; §16 con dos bloques de prueba
  nuevos; **§17.C pasa de «pendientes» a «cerradas»**; §19.1 reescrita y
  **§19.12 y §19.13 nuevas**; §20 fila 4 exige prueba de igualdad de conjunto.
- `plan.md`, `tasks.md`, `research.md` —HA1 y HA2 cerrados con su consecuencia
  medida—, `history.md`, `spec/specs/INDEX.md`.

### Qué queda pendiente

- **Cero decisiones de producto.**
- **§17.D-1** — forma técnica de la auditoría, delegada a Codex. Límite: aditiva,
  mínima y segura.
- **§17.D-2** — ubicación del cliente de sesión humana, delegada a Codex. Límite:
  arquitectura existente y mínimo cambio.
- **Aprobación de la spec** y **consentimiento por spec**, ambos actos del
  Product Owner.

### Qué NO se hizo

- **Ninguna línea de código**, ninguna dependencia, ningún cambio de esquema,
  ninguna migración, ningún CSS.
- **No se cambió el estado a `Aprobado`** y **no se ejecutó
  `confirm-user-consent.sh`.**
- **No hubo commit, push ni merge.** Visitador sigue intacto en `048ba94`.

## 2026-08-27 — Spec 022: sesión institucional Alcaldía MVP

Después de integrar Paciente en `develop`, Codex verificó que no existe una spec
aprobada que autorice exactamente el flujo UI de sesión institucional municipal.
Las specs as-built 005 y 008 permanecen pendientes; la 008 documenta como brecha
principal que `/municipality` no puede abrir una sesión.

Se creó el borrador focal `022-sesion-institucional-alcaldia-mvp`, limitado a
entrada, recuperación y logout `MUNICIPAL_VIEWER` para Población y Territorio.
Reutiliza la autenticación, cookie HttpOnly, guards, tenant/RLS, auditoría y
supresión existentes; mantiene las otras once vistas explícitamente demo. No
autoriza implementación, no añade dependencias, API, esquema ni migraciones.
Estado `Pendiente`; aprobación y consentimiento no registrados.

### Aprobación y consentimiento

El Product Owner declaró expresamente el 2026-08-27: «APRUEBO Y DOY
CONSENTIMIENTO PARA SPEC 022 ALCALDÍA MVP». Codex registró la aprobación y cerró
la ejecución en dos paquetes materiales: cliente institucional compartido con
fachada Hospital, y gate/entrada/logout municipal. La validación consolidada
queda a cargo de Codex. No se implementó código de producto.
El consentimiento quedó registrado mediante el mecanismo canónico
`confirm-user-consent.sh` para `022-sesion-institucional-alcaldia-mvp`.


## 2026-08-26 — Paciente MVP: Codex resuelve la arquitectura, sin código

### Qué se hizo

Codex auditó la spec 021 y devolvió **`PASS WITH CORRECTIONS`**, resolviendo de
paso los asuntos de arquitectura que el Product Owner le había delegado en
§17.D. **Ninguno era decisión de producto**, y ninguno la aprueba. Claude Code se
limitó a **transcribirlos a la documentación**: cero archivos de código tocados.

**Con esto, la spec 021 no tiene ninguna decisión de producto abierta ni ningún
asunto de arquitectura abierto.**

### Las resoluciones de Codex

**1. Forma técnica de la auditoría (§17.D-1).**

- **Dos** valores nuevos del `enum AuditEventType`, y solo dos:
  `PATIENT_SELF_ACCESS_GRANTED` y `PATIENT_SELF_ACCESS_DENIED`.
- Resumen, citas y visitas se diferencian por **`resourceType`** y **`endpoint`**,
  **no** por un valor de enum por endpoint.
- El registro vive en el **`AuditService` existente**, no en uno propio del
  módulo.
- Solo se registra el intento con **principal humano resoluble**; actor
  `HUMAN_ACCOUNT` **opaco**; **prohibido el actor ficticio** para una petición sin
  principal.
- Sin PII y sin contenido clínico; con `tenant`, `outcome`, `resourceType`,
  `endpoint` y `correlationId`.
- Si la auditoría obligatoria no se puede persistir: **fail-closed**.
- Migración **aditiva mínima**; rollback **permitido solo sin eventos
  dependientes** y **rechazado** si existen, sin pérdida de eventos.

**2. Superficie HTTP de la lectura self-scope (§17.D-2).** Exactamente tres
endpoints, lista cerrada:

```
GET /api/v1/patient-self/summary
GET /api/v1/patient-self/appointments
GET /api/v1/patient-self/visits
```

Sin selector de `patientId`, `personId` ni `subject` desde el cliente; sujeto
derivado exclusivamente del principal autenticado; self-scope; tenant/RLS;
protección IDOR; paciente inactivo **fail-closed**.

**3. Ubicación del cliente de sesión humana (§17.D-3): `MOVE TO SHARED`.** Pasa a
`apps/web/src/features/auth/humanSessionClient.ts`, y
`features/hospital/hospitalHumanSessionClient.ts` queda como **fachada
compatible**. Objetivo: reutilizar lógica existente, **no duplicar seguridad** y
**no romper a los consumidores de Hospital**. Riesgo de regresión en Hospital:
**BAJO**, con prueba de regresión obligatoria.

**4. Ejecución en cinco micro-paquetes**, quince minutos como máximo cada uno y
con sus propias STOP CONDITIONS: (1) auditoría mínima; (2) API patient-self;
(3) DB / RLS / multitenant / IDOR; (4) cliente humano compartido más fachada de
Hospital más `pacienteSelfClient`; (5) experiencia Paciente.

### Qué cambió en la documentación

- `spec.md`: nueva subsección **«Superficie HTTP»** (§6.6-e y §6.6-f); **§9
  reescrito** en §9.1 forma técnica, §9.2 reglas del evento, §9.3 migración y
  §9.4 rollback condicional; §12 allowlist con **capa 1-bis** de pruebas de
  servidor y las capas 2 y 3 concretadas; §13 denylist con la **excepción
  expresa** de los dos archivos de la fachada de Hospital y la de
  `apps/api/test/`; §14 con la tabla de los cinco paquetes; §16 con los bloques
  de auditoría, API por endpoint y cliente de sesión; **§17.D pasa de
  «delegados» a «RESUELTOS»**; §19.1 reescrita y **§19.14 a §19.18 nuevas**; §4,
  §5 y el ámbito de archivos con el matiz de la fachada.
- `plan.md`: reorganizado en los cinco paquetes, cada uno con sus archivos, su
  condición de terminación y sus STOP; comandos de verificación ampliados con la
  regresión de Hospital; hitos y riesgos actualizados.
- `tasks.md`: reagrupado en los cinco paquetes; **T0.11, T0.12 y T0.15 marcados
  como cerrados por Codex**.
- `research.md`: **H9 cerrado** con su consecuencia medida —las cuatro
  exportaciones cambian de archivo, no de forma—; decisión 6 completada con la
  forma técnica de la auditoría.
- `history.md`, `spec/specs/INDEX.md`.

### Añadido por convención del repositorio, no por ampliación de alcance

La allowlist incluye `prisma/migrations/ROLLBACK-patient_self_audit_event_type.sql`.
El rollback ya lo exigía §9.3; lo que se fijó aquí es su **ubicación**, junto a
los nueve `ROLLBACK-*.sql` que ya viven al lado de los directorios de migración y
no dentro de ellos.

### Qué queda pendiente

- **Cero decisiones de producto.**
- **Cero asuntos de arquitectura.**
- **Aprobación de la spec** y **consentimiento por spec**, ambos actos del
  Product Owner. Sin ellos la compuerta **no abre**.

### Qué NO se hizo

- **Ninguna línea de código**, ninguna dependencia, ningún cambio de
  `schema.prisma`, ninguna migración, ningún archivo de `apps/`.
- **No se cambió el estado a `Aprobado`** y **no se ejecutó
  `confirm-user-consent.sh`.**
- **No hubo commit, push ni merge.** Visitador sigue intacto en `048ba94`.


## 2026-08-26 — Paciente MVP: aprobación formal de la spec 021, sin consentimiento

### Qué se hizo

El **Product Owner aprobó formalmente** la spec `021-paciente-mvp-operativo`, con
declaración explícita en sesión: «APRUEBO FORMALMENTE LA SPEC 021 — PACIENTE MVP
OPERATIVO».

Se registró **únicamente** eso:

| Campo | Valor |
|---|---|
| Estado / Status | **`Aprobado`** (antes `Pendiente`) |
| Fecha de aprobación | **2026-08-26** |
| Aprobado por | **Product Owner** |
| Evidencia | aprobación formal explícita del Product Owner en la sesión del 2026-08-26 |

### En qué condiciones llegó la aprobación

- **Cero decisiones de producto abiertas.** Las once cerradas el 2026-08-26:
  nueve en §17.B y dos en §17.C.
- **Cero asuntos de arquitectura abiertos.** Los tres delegados los resolvió
  Codex en §17.D.
- **`PASS WITH CORRECTIONS` de Codex ya aplicado** a la documentación, incluida
  la corrección final del desfase de `contracts/README.md`.

### Qué cambió en la documentación

- `spec.md`: bloque de **Estado de aprobación** completo, y el aviso de cabecera
  reescrito de «Ni aprobada ni consentida» a «**Aprobada, y todavía NO
  ejecutable**», con lo que la aprobación **no** hace.
- `history.md`: fila nueva de tipo **Approval / Aprobación**, y «Qué falta para
  poder implementar» reducido a **un solo acto pendiente**.
- `spec/specs/INDEX.md`: la 021 pasa a **`Approved / Aprobada · sin
  consentimiento`**.

### Qué queda pendiente — un solo acto, y es del Product Owner

**Registrar el consentimiento por spec.** Claude Code **no** lo ejecuta por
iniciativa propia (`CLAUDE.md` §14.4, `AGENTS.md` §22.4). El comando exacto, que
debe correr el Product Owner:

```
./spec/scripts/confirm-user-consent.sh --spec 021-paciente-mvp-operativo "User approved implementation for spec 021-paciente-mvp-operativo"
```

Verificado tras la aprobación: `check-sdd-gate.sh` sigue informando
`021-paciente-mvp-operativo` **sin consentimiento registrado**. La compuerta
**permanece cerrada** para esta spec.

### Qué NO se hizo

- **No se ejecutó `confirm-user-consent.sh`.** El consentimiento sigue **sin
  registrar**.
- **Ninguna línea de código**, ninguna dependencia, ningún cambio de
  `schema.prisma`, ninguna migración, ningún archivo de `apps/`.
- **No se escribió el contrato** de `contracts/`: es la tarea T2.1 y está detrás
  del consentimiento.
- **No hubo commit, push ni merge.** Visitador sigue intacto en `048ba94`.
# 2026-08-27 — Spec 023 aprobada y consentida

El Product Owner aprobó y dio consentimiento explícito para la spec
`023-staging-controlado-hostinger`. La autorización cubre únicamente los dos
paquetes versionables y sus allowlists ya cerradas. No autoriza despliegue,
Hostinger, DNS, emisión de TLS, credenciales ni datos reales.

# 2026-08-28 — Spec 024 aprobada y consentida

El Product Owner aprobó y dio consentimiento explícito para
`024-bootstrap-tenant-enforce`. La autorización cubre únicamente tres paquetes
secuenciales, de hasta quince minutos y sin escrituras solapadas: contrato de
configuración, bootstrap transaccional y evidencia PostgreSQL/cold-start.

El patrón autorizado configura UUID+código por despliegue, establece el UUID
dentro de `PrismaService.withTenant()` y verifica la pareja exacta bajo
`merdn_runtime` y RLS antes de cachear. Permanecen prohibidos `SECURITY DEFINER`,
owner/migrador, fallback privilegiado, `disabled`, enumeración, selección desde
petición, cambios SQL y alteración de valores demo municipales.

Consentimiento registrado por spec en `.sdd/user-consent.log`. No se implementó
código en este acto y Claude no queda autorizado a commit, push, merge o deploy.
