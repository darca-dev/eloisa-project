# Especificación 038 — Demo funcional de registros y aprobaciones ficticias

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: `2026-09-24`.
- Aprobado por / Approved by: Product Owner.
- Evidencia de aprobación / Approval evidence: declaración explícita del
  Product Owner en la sesión del 2026-09-24: «Apruebo formalmente la spec 038 y
  las recomendaciones OD-01 a OD-12 como decisiones de producto».
- Consentimiento SDD / SDD consent: registrado personalmente por el Product
  Owner el `2026-09-24 22:34:29 -0600` para
  `038-demo-funcional-accesos-ficticios`.

> Esta especificación y las decisiones OD-01 a OD-12 están aprobadas y cuentan
> con consentimiento SDD. La implementación queda autorizada únicamente dentro
> de esta spec y por paquetes sujetos a revisión de Codex. No se autorizan
> commit, merge, push, pull request, release ni despliegue.

## 1. Task ID y título

`038-demo-funcional-accesos-ficticios` — Registro persistente, aprobación
hospitalaria y acceso controlado a experiencias de demostración con datos
exclusivamente ficticios.

## 2. Objetivo y valor de producto

Entregar un demo local, repetible y verificable en el que una persona ficticia
pueda registrarse como Paciente, Cuidador o Personal de terreno; el Hospital
pueda revisar y decidir la solicitud dentro de su propio tenant; y una persona
aprobada pueda autenticarse y abrir la experiencia demostrativa correspondiente
sin obtener por ello acceso clínico, financiero o institucional no autorizado.

La clienta debe poder comprobar qué acciones persisten, cuáles son solamente
visuales y cuáles requieren una relación o asignación adicional. El demo debe
reiniciarse de forma segura a un conjunto conocido de datos ficticios.

## 3. Contexto autoritativo y estado actual

1. `AGENTS.md`, `CLAUDE.md`, `docs/PRODUCT.md`, `docs/MODULES.md`,
   `docs/ROLES.md`, `docs/DATA.md`, `docs/ARCHITECTURE.md` y
   `docs/SECURITY.md` gobiernan esta tarea.
2. La spec 035 aprobó un acceso central y después limitó su implementación a
   una demostración en memoria. Esta spec 038 propone una evolución persistente
   y solo la sustituirá en ese punto si la Product Owner la aprueba.
3. La spec 027 contiene código de cuenta persistente de Paciente, pero su
   `spec.md` declara `Borrador` mientras `INDEX.md` la presenta como aprobada.
   Esta contradicción debe resolverse antes de modificar ese flujo.
4. La spec 037 registra descubrimiento OIDC `200` e inicio `302` hacia Keycloak.
   No certifica callback, vínculo con el `sub` real, sesión ni portal completo.
5. La rama observada al redactar esta spec es
   `feat/041-central-access-approvals`, limpia y 11 commits por delante de
   `develop`. `/acceso` monta `DemoNavigation`; `CentralAccess` existe pero no
   está conectado.
6. El build completo pasa. La suite web observada tiene 1.693 pruebas exitosas
   de 1.700 y siete fallos en seis archivos. No existe una línea base verde para
   aceptar nuevo comportamiento.
7. Hospital y Alcaldía inyectan contexto ficticio en sus rutas actuales. Una
   pantalla demo no es evidencia de autenticación, autorización, persistencia
   ni auditoría.
8. El aprovisionamiento atribuido a la spec 027 no puede reutilizarse sin
   correcciones: el frontend no envía la contraseña, se persiste un subject
   pregenerado en lugar del `sub` real de Keycloak, un fallo externo puede dejar
   una cuenta parcial y los logs pueden incluir el nombre de usuario.

## 4. Decisiones de producto incorporadas

La especificación incorpora la dirección aprobada por el Product Owner:

1. El entorno es local o de demostración controlada y utiliza exclusivamente
   personas, instituciones, relaciones, documentos y valores ficticios.
2. Paciente, Cuidador y Personal de terreno deben poder completar un registro
   que sobreviva recargas y reinicios normales del navegador.
3. El Hospital debe poder revisar, aprobar o rechazar solicitudes persistidas.
4. Una aprobación puede habilitar una cuenta o experiencia demo, pero nunca
   crea por sí sola una relación Cuidador–Paciente, una asignación profesional,
   acceso clínico, capacidad financiera ni autoridad institucional.
5. Todas las superficies deben indicar de forma visible y accesible que son un
   demo con datos ficticios.
6. El demo debe incluir carga inicial, reinicio seguro, instrucciones de
   operación, recuperación y un guion ensayado.

Las decisiones OD-01 a OD-12 quedaron cerradas por el Product Owner en la
sección 20. Ningún implementador puede modificarlas por inferencia.

## 5. Usuarios, roles, instituciones y tenants afectados

| Actor | Alcance en esta spec | Límite obligatorio |
|---|---|---|
| Solicitante Paciente | Registrar datos ficticios y consultar su resultado | Sin sesión de negocio ni acceso self-scope mientras no exista aprobación vigente |
| Solicitante Cuidador | Registrar una solicitud ficticia persistente | La aprobación de cuenta no concede relación con ningún Paciente |
| Solicitante Personal de terreno | Registrar una solicitud ficticia persistente | La aprobación no concede asignaciones, pacientes ni capacidad clínica |
| Revisor de acceso del Hospital | Listar y decidir solicitudes de su tenant | Permiso dedicado, sesión válida y sin acceso cross-tenant |
| Paciente aprobado | Autenticarse y consultar únicamente su superficie self-scope ficticia | Sujeto y tenant derivados del servidor; sin selector de paciente |
| Cuidador aprobado | Autenticarse y abrir una experiencia demo neutra | Sin datos de pacientes hasta existir una relación activa y separada |
| Personal de terreno aprobado | Autenticarse y abrir su experiencia demo | Sin worklist nominal hasta existir afiliación y asignación vigentes |
| Alcaldía | Sin cambio funcional | Continúa con información agregada y sin acceso nominal |

El alcance corto recomendado usa un tenant y un Hospital ficticio verificador.
El esquema actual no tiene una entidad física `Institution`; por tanto, esta
spec no puede afirmar varios Hospitales dentro del mismo tenant sin una decisión
arquitectónica adicional. El navegador nunca decide ni envía el tenant como
fuente de autoridad.

## 6. Alcance funcional incluido

### 6.1 Línea base y reconciliación

- Resolver formalmente el estado documental de la spec 027 y declarar la spec
  035 como antecedente visual sustituido únicamente en los puntos persistentes
  que esta spec apruebe.
- Clasificar los siete fallos web actuales contra las specs que gobiernan cada
  área. Corregir código cuando exista una desviación y corregir pruebas solo
  cuando el comportamiento nuevo ya esté aprobado.
- Restablecer build, typecheck y suites aplicables en verde antes de añadir el
  flujo persistente.
- Separar las rutas normales protegidas de un modo demo controlado por
  configuración del servidor. Un parámetro de URL no habilita un bypass.

### 6.2 Entrada central

- `/acceso` debe montar una sola implementación autorizada y distinguir:
  `Iniciar sesión`, `Registrarme / solicitar acceso` y `Explorar demo`.
- Los parámetros de URL son orientación y nunca autoridad.
- El Portal Central debe enlazar a la entrada aprobada sin saltarse la sesión
  cuando se intente realizar una operación persistente o protegida.
- Las rutas visuales públicas solo pueden mantenerse si no consultan datos
  sensibles y muestran señalización inequívoca de demo.

### 6.3 Registro persistente

- Permitir solicitudes para `PATIENT`, `CAREGIVER` y `FIELD_PROFESSIONAL`.
- Recoger solo datos ficticios mínimos y advertir: «No ingrese datos reales».
- Persistir una solicitud `PENDING` con referencia opaca y control de versión.
- Evitar dos solicitudes abiertas para la misma persona, tenant y perfil.
- Una solicitud no crea una sesión, contexto de negocio, relación de cuidado,
  asignación profesional ni permiso institucional.
- Los secretos o contraseñas nunca se guardan en MERDN, fixtures, logs,
  auditoría ni documentación.

### 6.4 Revisión hospitalaria y provisión

- Añadir una capacidad institucional dedicada `HOSPITAL_ACCESS_REVIEWER`,
  separada de las capacidades institucionales existentes.
- El revisor puede listar y decidir solo solicitudes del tenant de su sesión.
- Estados permitidos:
  `PENDING`, `APPROVED_PENDING_PROVISIONING`, `APPROVED`, `REJECTED`,
  `PROVISIONING_FAILED`, `SUSPENDED` y `REVOKED`.
- Transiciones:
  `PENDING -> APPROVED_PENDING_PROVISIONING | REJECTED`;
  `APPROVED_PENDING_PROVISIONING -> APPROVED | PROVISIONING_FAILED`;
  `PROVISIONING_FAILED -> APPROVED_PENDING_PROVISIONING | REJECTED`;
  `APPROVED -> SUSPENDED | REVOKED`;
  `SUSPENDED -> APPROVED_PENDING_PROVISIONING | REVOKED`.
- `REJECTED` y `REVOKED` son terminales. Una nueva solicitud crea un episodio
  nuevo y no reabre historia.
- `APPROVED` solo significa que la cuenta, vínculo OIDC y participación mínima
  requerida fueron confirmados. Una llamada externa no se presenta como parte
  atómica de una transacción PostgreSQL.
- La provisión usa una saga/outbox o estado explícito reintentable e idempotente
  que persiste el identificador real devuelto por Keycloak.
- Toda decisión usa control optimista de versión y motivos cerrados, sin texto
  libre con datos personales.

### 6.5 Identidad y acceso posterior

- La autenticación utiliza la sesión humana OIDC existente y el proveedor local
  ficticio. No se crea un mecanismo de login paralelo.
- Antes de aprobación, cualquier cuenta preparada permanece deshabilitada y no
  puede crear una sesión válida.
- Al aprobar, el servidor activa únicamente la capacidad correspondiente:
  - `PATIENT`: crea/activa `Patient` y permite self-scope de la misma `Person`.
  - `CAREGIVER`: permite una portada neutra; el contexto y datos de Paciente
    requieren una relación activa y separada.
  - `FIELD_PROFESSIONAL`: crea/activa perfil y afiliación ficticia si se aprueba
    OD-06; las asignaciones siguen siendo independientes.
- Suspender o revocar invalida acceso futuro y sesiones según OD-04. Nunca
  borra historia.
- Los claims OIDC no crean tenant, perfil, relación, asignación o rol.

### 6.6 Datos de demostración y operación

- Crear un dataset determinista y exclusivamente ficticio, con dos tenants para
  pruebas de aislamiento y un tenant operativo para el guion.
- Proveer un comando idempotente `demo:reset` o equivalente que restablezca
  solo recursos marcados como demo después de verificar ambiente, tenant, realm
  y confirmación explícita.
- El reset no usa `drop`, truncado global ni limpieza de volúmenes.
- Documentar arranque, salud, credenciales locales fuera del repo, recorrido,
  fallos comunes, recuperación y limpieza.

## 7. Fuera de alcance

- Datos reales, importaciones reales, biometría, consulta de cédulas,
  matrículas, EPS o entidades externas.
- Autorización legal de representación, parentesco o consentimiento clínico.
- Dar acceso a un Paciente por aprobar una cuenta Cuidador.
- Dar una worklist o permiso clínico por aprobar una cuenta profesional.
- Pagos, nómina, liquidación real o datos bancarios.
- Reglas clínicas, diagnósticos, recomendaciones o umbrales.
- Producción, despliegue, `main` o integración Git.
- Modificar `prototype-claude/`, `tasks/` o `reviews/`.
- Resolver todos los gaps de la spec 028.

## 8. Requisitos de datos

### 8.1 Agregado de solicitud

La implementación debe introducir un agregado persistente equivalente a
`AccessRequest`, separado de `Person`, cuenta, perfil, relación y asignación.

| Campo conceptual | Regla |
|---|---|
| `id` | UUID opaco |
| `tenantId` | Derivado del servidor; FK y RLS obligatorias |
| `personId` | Nulo hasta reconciliar/crear `Person`, o `Person` ficticia del mismo tenant según OD-03 |
| `requestedProfile` | `PATIENT`, `CAREGIVER`, `FIELD_PROFESSIONAL` |
| `status` | Catálogo cerrado de la sección 6.4 |
| `provisioningStatus` | Estado técnico separado o derivado explícitamente del estado de aprobación |
| `source` | Categoría canónica `DEMONSTRATION`; UI `DEMO_LOCAL_FICTICIA` |
| `reference` | Opaca, sin documento, correo ni nombre |
| `version` | Control optimista de concurrencia |
| `submittedAt` | Fecha del servidor |
| `reviewedByInstitutionalIdentityId` | Nulo hasta decisión; mismo tenant |
| `decidedAt` | Fecha del servidor |
| `decisionReasonCode` | Catálogo cerrado |
| `provisioningReference` | Opaca; nunca token, issuer o subject en salida pública |
| `createdAt`, `updatedAt` | Fechas del servidor |

### 8.2 Propiedad, sensibilidad y procedencia

- Titular: persona ficticia; custodio: tenant demo y Hospital revisor.
- Sensibilidad: `SENSITIVE_PERSONAL` para identidad/contacto, `INTERNAL` para
  estado y `AUDIT_RESTRICTED` para auditoría.
- Procedencia: `DEMONSTRATION`, declarada o generada por el seed.
- No se guarda contraseña, token, cookie, claim OIDC, historia clínica, dato
  bancario, diagnóstico, evidencia legal ni motivo libre.
- La forma de reconciliar una solicitud con `Person` existente se decide en
  OD-03 y debe ser idempotente dentro del tenant.

### 8.3 Retención y reset

- Esta spec no fija retención legal productiva.
- Las solicitudes y decisiones permanecen hasta reset local explícito.
- El reset elimina/recrea solo datos y usuarios identificados como demo.
- La conservación o reinicio de auditoría demo requiere OD-07.
- Fuera del reset, los estados se corrigen con transiciones y no se borra
  historia material.

## 9. Autenticación, autorización y aislamiento

1. Crear solicitudes públicas requiere rate limit, validación estricta, origen
   permitido y mensajes que no enumeren personas.
2. Listar o decidir exige sesión institucional y capacidad exacta
   `HOSPITAL_ACCESS_REVIEWER`.
3. Tenant y actor se derivan de la sesión; campos equivalentes del cliente se
   rechazan o ignoran.
4. RLS, filtros y FKs compuestas impiden acceso cross-tenant.
5. Una cuenta humana solicitante no llama la API institucional de decisión.
6. Si se exige atribución individual y no autoaprobación, la credencial
   institucional opaca actual no basta; OD-10 debe cerrarse antes de código.
7. El navegador no concede roles, contextos, relaciones ni asignaciones.
8. La aprobación se comprueba server-side en cada entrada protegida.
9. Alcaldía conserva acceso agregado y no lista solicitudes nominales.
10. Un ID de otro tenant responde igual que uno inexistente.

## 10. Auditoría

Eventos obligatorios, sin PII ni secretos:

- `ACCESS_REQUEST_CREATED`
- `ACCESS_REQUEST_LIST_GRANTED` / `ACCESS_REQUEST_LIST_DENIED`
- `ACCESS_REQUEST_VIEWED`
- `ACCESS_REQUEST_APPROVED`
- `ACCESS_REQUEST_REJECTED`
- `ACCESS_REQUEST_SUSPENDED`
- `ACCESS_REQUEST_REVOKED`
- `ACCESS_PROVISIONING_SUCCEEDED` / `ACCESS_PROVISIONING_FAILED`
- `DEMO_CONTEXT_ACCESS_GRANTED` / `DEMO_CONTEXT_ACCESS_DENIED`
- `DEMO_DATASET_RESET_STARTED` / `COMPLETED` / `FAILED`

Cada evento incluye tenant, actor opaco, rol/capacidad, recurso, ID opaco,
perfil, resultado, UTC, endpoint lógico, correlación y versión. Nunca incluye
contraseña, token, cookie, issuer, subject, nombre, documento, correo, teléfono,
cuerpo completo ni motivo libre. Si una auditoría transaccional obligatoria no
puede persistirse, la operación falla cerrada.

## 11. Seguridad, privacidad y amenazas

| Amenaza | Control obligatorio |
|---|---|
| Acceso cross-tenant | RLS, tenant de sesión, FK compuesta y pruebas con dos tenants |
| Elevación desde navegador | Permiso y estado resueltos en servidor; deny-by-default |
| Autoaprobación | Sesiones separadas y decisión OD-10 sobre atribución individual |
| Repetición/doble provisión | `version`, idempotencia y estado de provisión |
| `APPROVED` sin identidad válida | Persistir `sub` real y confirmar provisión antes de `APPROVED` |
| Enumeración | Respuestas neutrales, referencias opacas y rate limit |
| Acceso Cuidador/Visitador indebido | Relación, afiliación y asignación separadas |
| Secretos/PII en logs | Redacción, auditoría minimizada y escaneo de secretos |
| Datos reales en demo | Tenant/realm/base demo, advertencia y fixtures controlados |
| Reset destructivo | Allowlist exacta, ambiente demo y confirmación explícita |

## 12. Integraciones y comportamiento de falla

- Keycloak local es la única integración externa de esta tarea.
- Si OIDC falla, la solicitud no se marca `APPROVED`; queda en estado de
  provisión reintentable o fallida.
- Si PostgreSQL falla, no se simula persistencia en memoria.
- La provisión usa el identificador real devuelto por Keycloak. No se inventa
  un `sub` ni se registra username/contacto en logs.
- Reintentos tienen límite, backoff e idempotency key; no reinician el contador
  recursivamente.
- Si BD y Keycloak quedan desalineados, el estado explícito permite compensar o
  reintentar sin duplicar cuentas.
- No se añaden correo, SMS ni proveedores adicionales.

## 13. Accesibilidad

- Etiquetas programáticas, instrucciones y errores asociados.
- Navegación completa por teclado y foco visible.
- Estados mediante texto e icono además de color.
- `aria-live` para envío y decisiones.
- Tabla/lista hospitalaria semántica, acciones con referencia accesible y
  alternativa móvil.
- Sin truncamiento a 320 px y sin violaciones críticas/serias de axe.

## 14. Referencia visual

- `prototype-claude/` es referencia de composición y lenguaje visual, solo
  lectura.
- `apps/web/src/features/access/`, `HubAccessPortal`, la inscripción existente y
  `HospitalAccessApprovalsDemo` son referencias del estado actual.
- La fidelidad visual no autoriza copiar estado en memoria, datos estáticos,
  permisos visuales ni reglas del prototipo como lógica de servidor.

## 15. Ámbito de archivos

### 15.1 Permitidos después de aprobación

- `apps/web/src/app/acceso/**`
- `apps/web/src/app/inscripcion/**`
- `apps/web/src/app/cuidador/**`
- `apps/web/src/app/profesional/**`
- `apps/web/src/app/hospital/page.tsx` y `apps/web/src/app/municipality/page.tsx`
  solo para separar modo demo de rutas protegidas
- `apps/web/src/features/access/**`
- `apps/web/src/features/auth/**`
- `apps/web/src/features/hub/HubAccessPortal.tsx`
- `apps/web/src/features/hub/hub.module.css`
- `apps/web/src/features/inscripcion/**`
- `apps/web/src/features/hospital/HospitalAdministration.tsx`
- `apps/web/src/features/hospital/HospitalAccessApprovalsDemo.tsx`
- `apps/web/src/features/hospital/hospitalAccessApprovalsDemo.module.css`
- archivos exactos que gobiernan los siete fallos, solo en MP00
- `apps/web/src/features/caregiver/**`
- `apps/web/src/features/profesional/**`
- `apps/api/src/access-requests/**`
- `apps/api/src/audit/**`
- `apps/api/src/config/**`
- `apps/api/src/human-auth/**` solo para aprobación/revocación
- `apps/api/src/institutional-auth/**` para capacidad revisora
- `apps/api/src/patients/**` solo para reconciliar el flujo Paciente
- `apps/api/src/app.module.ts`
- pruebas API/web/DB/E2E correspondientes
- `prisma/schema.prisma`
- una migración aditiva nueva bajo `prisma/migrations/`
- `infra/local-oidc/**` solo si se requieren usuarios ficticios y sin secretos
- `scripts/demo/**`
- `.env.example` solo con nombres y placeholders
- `package.json` solo para scripts demo; sin dependencias nuevas
- `docs/runbooks/demo.md`
- `spec/specs/038-demo-funcional-accesos-ficticios/**`
- `spec/specs/INDEX.md`
- `spec/bitacora/**` según el flujo SDD

### 15.2 Prohibidos

- `prototype-claude/**`, `tasks/**`, `reviews/**`
- `main` y cualquier acción Git no autorizada
- migraciones existentes
- `.env`, secretos, credenciales o datos reales versionados
- módulos clínicos, pagos, finanzas, FURAG, MIPG, ADRES o SENA
- refactors generales fuera de esta spec
- relajación de RLS, guards, auditoría o aislamiento para facilitar el demo

## 16. Criterios de aceptación observables

1. CUANDO una persona ficticia envía una solicitud válida, EL SISTEMA DEBERÁ
   persistir una sola solicitud `PENDING`, devolver referencia opaca y
   conservarla después de recargar y reiniciar web/API.
2. CUANDO se repite una solicitud abierta para la misma identidad, tenant y
   perfil, EL SISTEMA DEBERÁ responder de forma neutral e idempotente.
3. CUANDO no existe aprobación vigente, EL SISTEMA NO DEBERÁ crear sesión
   utilizable ni montar una superficie protegida para ese perfil.
4. CUANDO el revisor autorizado lista solicitudes, EL SISTEMA DEBERÁ devolver
   únicamente las de su tenant y campos mínimos.
5. CUANDO otro rol, Alcaldía, otro tenant o una cuenta humana intenta listar o
   decidir, EL SISTEMA DEBERÁ denegar sin revelar existencia ni conteos.
6. CUANDO el revisor decide con versión vigente, EL SISTEMA DEBERÁ aplicar una
   transición válida, auditarla y conservarla tras recarga.
7. CUANDO dos decisiones compiten, EL SISTEMA DEBERÁ aceptar como máximo una.
8. CUANDO Keycloak falla, EL SISTEMA NO DEBERÁ dejar una solicitud `APPROVED`
   utilizable ni una cuenta falsamente activa.
9. CUANDO se aprueba Cuidador sin relación vigente, EL SISTEMA NO DEBERÁ
   devolver contexto `CAREGIVER` ni datos de pacientes.
10. CUANDO se aprueba Personal de terreno sin afiliación/asignación vigente, EL
    SISTEMA NO DEBERÁ mostrar pacientes ni visitas nominales.
11. CUANDO se suspende o revoca, EL SISTEMA DEBERÁ impedir nuevo acceso y
    aplicar OD-04 a sesiones existentes.
12. CUANDO se abre cualquier ruta demo, EL SISTEMA DEBERÁ distinguir datos
    ficticios, acciones persistentes y acciones visuales.
13. CUANDO se ejecuta reset fuera del entorno/tenant/realm demo, EL SISTEMA
    DEBERÁ detenerse antes de escribir; dos resets autorizados producirán la
    misma línea base.
14. Build, typecheck, Prisma, secretos, SDD, suites unitarias/integración/DB/E2E
    y accesibilidad DEBERÁN pasar sin fallos ni omisiones críticas.

## 17. Pruebas requeridas

| Tipo | Cobertura mínima |
|---|---|
| Unitarias | Validación, máquina de estados, motivos, idempotencia, versión y reintentos limitados |
| API | Crear, listar, decidir, conflicto, provisión, suspensión y revocación |
| Base de datos | RLS con dos tenants, FK compuesta, unicidad, grants y rollback |
| Permisos | Solo capacidad revisora; denegación a Alcaldía, otros roles y cuenta humana |
| Identidad | `sub` real; login denegado antes, permitido después y bloqueado tras revocación |
| Relaciones | Cuidador aprobado sin relación no ve pacientes |
| Profesional | Sin afiliación/asignación no ve pacientes ni visitas |
| Frontend | `/acceso`, persistencia, estados de error y señalización demo |
| E2E | Cada prueba crea su fixture: tres perfiles, decisiones, login, revocación y reset |
| Accesibilidad | Axe real, teclado, foco, etiquetas, tabla y responsive |
| Regresión | Siete fallos actuales resueltos con trazabilidad |
| Seguridad | secretos, enumeración, CSRF/origen, rate limit, IDOR y cross-tenant |

Las pruebas E2E no pueden depender entre sí, usar `|| true`, omitir axe o tomar
una sesión creada por otra prueba.

## 18. Migración, compatibilidad, rollback y operación

- Migración aditiva para estados, capacidad revisora, solicitud, índices, FKs,
  RLS y auditoría.
- No modificar migraciones existentes ni eliminar tablas/columnas.
- Rollback solo sin solicitudes o eventos dependientes; de lo contrario se
  rechaza y conserva historia.
- La demo en memoria puede mantenerse bajo modo visual explícito durante la
  transición, sin confundirse con el flujo persistente.
- La funcionalidad se activa solo en tenant/entorno demo hasta una futura spec.
- El runbook incluye healthchecks de PostgreSQL, API, web y OIDC.

## 19. Dependencias, supuestos y riesgos

### Dependencias

- Specs 007, 011, 021, 022, 024, 029, 035 y 037.
- Resolución documental y auditoría de la implementación atribuida a 027.
- PostgreSQL/RLS, sesiones, auditoría y provisioning existentes.

### Riesgos

- Convertir el demo en IAM productivo: limitar a tenant/realm/base demo.
- Confundir aprobación con relación/asignación: decisiones y pruebas separadas.
- Estado parcial OIDC/DB: provisión explícita, idempotente y compensable.
- Credencial institucional compartida sin actor humano: cerrar OD-10.
- Reset destructivo: allowlist de ambiente, tenant, realm y datos marcados.

## 20. Decisiones de producto aprobadas

El Product Owner aprobó explícitamente las doce recomendaciones como decisiones
de producto el 2026-09-24.

| ID | Materia | Decisión aprobada | Estado |
|---|---|---|---|
| OD-01 | Rama base | Nueva rama desde `develop`, integrando solo commits demo aceptados | Cerrada |
| OD-02 | ¿Paciente se crea al solicitar o al aprobar? | Crear `Person`/solicitud al registrar y `Patient` solo al aprobar | Cerrada |
| OD-03 | Datos provisionales y credenciales | Datos mínimos ficticios; Keycloak maneja contraseña; persistir `sub` real; nunca password en MERDN | Cerrada |
| OD-04 | Sesiones al suspender/revocar | Revocación inmediata y denegación en la siguiente petición | Cerrada |
| OD-05 | Cuidador aprobado sin relación | Portada neutra sin contexto `CAREGIVER` ni pacientes | Cerrada |
| OD-06 | Personal de terreno aprobado | Crear perfil/afiliación ficticia; ninguna asignación automática | Cerrada |
| OD-07 | Reset de auditoría demo | Conservar por defecto; reiniciar solo mediante opción explícita local y auditada | Cerrada |
| OD-08 | Copy final | Aprobar textos de demo, aprobación y no-pago antes de UI | Cerrada |
| OD-09 | Límite institucional | Un tenant equivale a un Hospital ficticio verificador en esta spec | Cerrada |
| OD-10 | Actor aprobador | Para demo, identidad revisora dedicada y no compartida con solicitantes; producción requerirá identidad humana atribuible | Cerrada |
| OD-11 | Activación sin correo/SMS | Contraseña ficticia elegida en registro y enviada directamente al OIDC local mediante flujo aprobado; no persiste en MERDN | Cerrada |
| OD-12 | Alcance histórico | 038 sustituye el modo en memoria de 035 y no aprueba retroactivamente 027 sin auditoría | Cerrada |

## 21. Evidencia que Claude Code debe devolver

1. Task ID y lista exacta de archivos cambiados.
2. Mapeo de criterios a pruebas y resultados.
3. Migración/rollback y dos tenants ficticios.
4. Build, typecheck, pruebas web/API/DB/E2E, axe, secretos y SDD.
5. `sub` real, registro, recarga, decisión, conflicto, denegación y revocación.
6. Dos resets con conteos idénticos y prueba de denegación fuera de demo.
7. Healthchecks sin revelar secretos.
8. Capturas con señalización demo.
9. Riesgos, desviaciones y pruebas omitidas.
10. Confirmación de que no se tocó `prototype-claude/`, archivos históricos
    protegidos, `main` ni datos reales.

## 22. Condiciones de parada y aprobación

Claude Code debe detener el paquete afectado si:

- una implementación requiere cambiar OD-01 a OD-12 sin una nueva decisión del Product Owner;
- 027/035 conservan contradicciones sin decisión registrada;
- la compuerta SDD o validación estricta no pasan;
- se requiere un archivo prohibido, dato real o dependencia nueva no aprobada;
- no puede garantizarse tenant, auditoría, `sub` real o reversibilidad;
- las pruebas base siguen fallando sin clasificación aprobada.

La versión y sus decisiones están aprobadas. Solo el Product Owner registra
consentimiento SDD. Ese consentimiento habilita implementación dentro de esta
spec y no autoriza commit, merge, push, PR, release ni despliegue.
