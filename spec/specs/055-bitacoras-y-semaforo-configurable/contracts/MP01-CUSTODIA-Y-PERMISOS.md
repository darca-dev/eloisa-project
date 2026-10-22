# 055 / MP01 — Base de custodia institucional y autorización de cuidado

Estado: contrato técnico dentro de D01–D07 aprobadas por el Product Owner el 2026-10-21. Implementador: Claude Code. Codex especifica y audita. Solo se autoriza este paquete al iniciar; MP02–MP06 siguen secuenciales. No requiere valores médicos para sus pruebas.

## 1. Objetivo y límites

Crear el modelo compartido de organizaciones, custodia de paciente, concesiones humanas y competencia declarada, y una política transaccional utilizable por bitácoras y alarmas. No registrar observaciones ni generar alarmas aún. No endpoints ni UI en este paquete. No atribuir organización al tenant o a una reserva administrativa.

Nueva organización es una entidad genérica compartida (Hospital, Alcaldía o Prestador), no una segunda arquitectura de producto. El piloto técnico usa datos ficticios; crear una fila de competencia no acredita título ni consulta RETHUS.

## 2. Modelo concreto

UUIDs y timestamps siguen las convenciones Prisma actuales; todas las entidades llevan tenantId y FK compuestas. Usar nombres Prisma siguientes y tablas snake_case:

- `Organization`: id, tenantId, code (estable y único por tenant), displayName, kind HOSPITAL/MUNICIPALITY/PROVIDER, status ACTIVE/DISABLED, createdAt/updatedAt. Unique(id,tenantId).
- `OrganizationCareManager`: id, tenantId, organizationId, humanAccountId, status ACTIVE/REVOKED, startsAt, endsAt?, authorizationReference opaca, grantedByHumanAccountId, createdAt, revokedAt?, version. Unique(id,tenantId,organizationId), unique(organizationId,humanAccountId). Fuente de capacidad administrativa expresa; no acceso clínico por ser manager. El primer manager se provisiona de forma controlada, nunca inferido de una cuenta antigua ni por migración automática.
- `PatientCareContext`: id, tenantId, organizationId, patientId, status ACTIVE/REVOKED, authorizationReference, createdByHumanAccountId, createdAt, revokedAt?, version. Unique(tenantId,organizationId,patientId); unique(id,tenantId,organizationId,patientId). Fuente explícita de custodia. Un paciente puede tener contextos de organizaciones distintas sin compartir contenido.
- `ClinicalCompetenceAttestation`: id, tenantId, organizationId, humanAccountId, status ACTIVE/REVOKED, evidenceReference opaca, validatedByHumanAccountId, startsAt, endsAt?, createdAt, revokedAt?, version. Unique(id,tenantId,organizationId,humanAccountId). Validador humano distinto del sujeto; no validación externa automática. No deducir competencia de ProfessionalProfile ni de asignación.
- `CareAuthorization`: id, tenantId, organizationId, contextId, patientId, humanAccountId, actorKind CAREGIVER/PROFESSIONAL/HOSPITAL_REVIEWER; permission VIEW_RECORDS/CONTRIBUTE_RECORDS/REQUEST_ALARM/MANAGE_RULES/REVIEW_ALARMS; purpose CARE_RECORDING_AND_ALERTS; status ACTIVE/REVOKED; startsAt/endsAt?; caregiverRelationshipId?; careAssignmentId?; competenceAttestationId?; authorizationReference; grantedByHumanAccountId; createdAt/revokedAt?; version. FK de contexto por los cuatro campos, cuentas por id/tenant, referencias clínicas por id/tenant/organización/cuenta y relaciones/asignaciones por id/tenant. UNIQUE por id/tenant/organización. Un índice único parcial impide concesiones ACTIVE duplicadas para contexto/cuenta/actorKind/permission; revocar conserva filas para historia.

Requerir coherencia de tiempo (fin posterior a inicio), versión positiva y revocación con timestamp. No DELETE/CASCADE en entidades nuevas. Las referencias son códigos técnicos opacos acotados, no texto libre ni datos personales. Check actorKind: CAREGIVER exige relación y no asignación/competencia; PROFESSIONAL exige asignación y competencia para MANAGE_RULES; HOSPITAL_REVIEWER exige competencia para REVIEW_ALARMS y no relación de cuidador. No permitir MANAGE_RULES/REVIEW_ALARMS a CAREGIVER. La política reafirma sujeto y paciente de cada relación/afiliación/asignación, no basta una FK del tenant.

La finalidad adicional vive en CareAuthorization; NO modificar el enum ni ampliar HOME_CARE_COORDINATION o VISITS_VIEW antiguos. La concesión adicional exige referencia de autorización propia y un emisor humano manager vigente en esa organización. Un emisor no se autoconcede MANAGE_RULES/REVIEW_ALARMS ni valida su propia competencia. Registrar no equivale a validar legalmente el soporte.

No implementar provisión pública en MP01. Fixtures/provisión controlada posterior deben crear explícitamente organizaciones/managers y concesiones; los datos heredados permanecen sin nuevos accesos.

## 3. Contexto y RLS

Todas las tablas nuevas: ENABLE y FORCE RLS, rol runtime sin ownership/BYPASSRLS, políticas tenant + organizationId usando `merdn.tenant_id` y `merdn.organization_id`; Organization usa su id como ámbito institucional. Contexto ausente o UUID mal formado debe fallar cerrado sin exposición ni fallback. No aplicar políticas institucionales nuevas a tablas antiguas de otras funciones.

Implementar módulo interno `apps/api/src/care-context/`. La operación `withAuthorizedContext(principal, resource, permission, correlationId, now, work)` recibe organización y contextId como identificadores del recurso solicitado, NO como autoridad; nunca recibe identidad/tenant/rol desde cliente. Principal procede de HumanSessionGuard. Validar UUIDs antes de fijar GUC.

Abrir UNA `prisma.withTenant` y, dentro, fijar organización con SET LOCAL/set_config(...,true); verificar GUC y rol cuando enforce. Resolver contexto, cuenta y concesión contra ese ámbito. No devolver filas ni ejecutar work antes de autorización. RLS restringe al tenant/organización fijados; la política restringe adicionalmente paciente/actor/acción. Aún no hay endpoint que exponga identificadores o listas.

Los grants necesarios para locks FOR SHARE deben existir sin convertir al runtime en owner; especificar columnas mínimas si requiere UPDATE para row locking. Ninguna concesión de privilegios puede modificar políticas históricas. Las pruebas deben demostrar fail-closed y ausencia de fuga por pool. Organización de tipo MUNICIPALITY nunca habilita estas acciones clínicas/nominales en MP01, aunque se invente una concesión; su entidad queda estructuralmente representada.

## 4. Política exacta y concurrencia

Primero bloquear cuenta humana exacta FOR SHARE y verificar tenant/persona/status ACTIVE/no passwordRecoveryBlocked, vínculo externo exacto activo de la sesión y la sesión vigente (siempre verificar id/account/binding, revocación, límites de autenticación/vigencia). Sin binding exacto se deniega. Bloquear fuentes de autorización que se usan, siempre en orden cuenta → organización → contexto → concesión → relación/asignación → perfil/afiliación → competencia; ordenar UUID si hay varias filas. Conservar locks hasta terminar work y su auditoría. No prevalidar en otra transacción.

- Paciente propio: reutilizar `resolveApprovedPatientWithin(tx,principal)`; el patientId resuelto debe coincidir con el contexto. Solo VIEW_RECORDS, CONTRIBUTE_RECORDS y REQUEST_ALARM. No crear concesión implícita clínica de administración.
- Cuidador: experiencia CAREGIVER APPROVED exacta para cuenta/persona/binding vigente, CareAuthorization explícita de nueva finalidad/acción; relación ACTIVE vigente del mismo paciente/persona/tenant. VISITS_VIEW no basta. La relación antigua es prueba de vínculo, no fundamento clínico: la nueva authorizationReference/purpose es obligatoria.
- Profesional: experiencia FIELD_PROFESSIONAL APPROVED exacta; concesión para contexto/acción; asignación ACTIVE vigente al mismo paciente y perfil/persona, perfil ACTIVE, afiliación vigente. MANAGE_RULES además competencia activa vigente de la misma cuenta/organización. VIEW/CONTRIBUTE/REQUEST pueden concederse sin competencia clínica de reglas; nunca se deduce severidad de sus notas.
- Revisor: concesión explícita REVIEW_ALARMS o VIEW_RECORDS para ese contexto, cuenta individual, competencia vigente para ambas cuando implique clínica. No se exige perfil de paciente/solicitante FIELD_PROFESSIONAL a un revisor institucional; sí competencia y concesión humana. Un perfil o capacidad administrativa antigua no reemplaza la concesión.
- Manager no obtiene acceso a bitácora/alarma por su condición de manager. MP01 no entrega API de gestión de grants, pero la política verifica que el emisor de la concesión corresponde a una capacidad manager activa al crearla; no cancelar retroactivamente concesiones porque el emisor deje el cargo después. Sujeto, referencia y fecha de emisión deben conservarse; validar emisor en fixture/constraints o helper de emisión interno, no suponerlo desde body.

La resolución para futuras escrituras devuelve referencias autorizadas mínimas a work; ninguna entidad personal completa. Guardar auditoría concedida dentro de tx antes de commit de work; si work falla, rollback completo. En denegación, escribir evento y retornar etiqueta dentro de tx; lanzar error uniforme fuera tras commit. No revelar qué referencia faltó. Fallo de runtime/auditoría se propaga como indisponibilidad, nunca permiso.

## 5. Auditoría

Reutilizar AuditEvent. Agregar columna nullable `organizationId` con FK compuesta a Organization y nuevo índice de tenant/organización/fecha; filas viejas conservan NULL. Añadir eventos CARE_CONTEXT_ACCESS_GRANTED, CARE_CONTEXT_ACCESS_DENIED (extensible en paquetes siguientes). Actor HUMAN_ACCOUNT/principal, actorRole null, organizationId y tenant de servidor, resourceType CareContext, resourceId opaco cuando autorizado o null al denegar sin revelar existencia, endpoint lógico constante y correlationId; sin cuerpo ni referencias clínicas.

Agregar política RLS RESTRICTIVE sobre audit_event para rol runtime: filas con organizationId no nulo solo bajo el mismo merdn.organization_id; filas históricas null conservan sus políticas actuales. Mantener intacta la protección append-only existente. No convertir auditoría en almacenamiento de respuestas ni usar actor institucional compartido.

Una organización solicitada inexistente o de otro tenant no puede convertirse en FK de auditoría: en ese caso usar el evento genérico existente EXPERIENCE_ACCESS_DENIED con organizationId/resourceId null, resourceType CareContext y el actor/tenant autenticados; confirmar la denegación sin revelar existencia. CARE_CONTEXT_ACCESS_DENIED se usa cuando la organización del tenant sí se resolvió de forma confiable. No referenciar una organización ajena en el evento. El CHECK de organización obligatoria debe enumerar los eventos nuevos o comparar el prefijo literal `CARE_`; no usar LIKE 'CARE_%' sin escapar porque también incluiría eventos históricos CAREGIVER y rompería compatibilidad.

## 6. Allowlist exacta

- `prisma/schema.prisma` y NUEVA `prisma/migrations/20261021120000_care_context_foundation/migration.sql` (si hay conflicto de nombre parar; no tocar migraciones previas).
- `apps/api/src/care-context/**` (módulo, contratos, policy/context service, audit y pruebas unitarias; sin controlador/endpoints).
- `apps/api/test/care-context-foundation.db.test.ts`, `apps/api/test/care-context-fixtures.ts`.
- `scripts/testing/run-baseline.mjs` solo para añadir `db/care-context-foundation.db.test.ts` a catálogo.
- `scripts/testing/test-db-provision.mjs` solo para ampliar migraciones/tablas/conteo de políticas de la baseline con los objetos nuevos; `scripts/testing/test-db-preflight.mjs` solo catálogo policy/tabla. No relajar identidad, guards, topología, RLS, ownership ni comprobaciones.
- `tests/testing/test-db-provision.test.mts` y `tests/testing/test-db-preflight.test.mts` solo expectativas exactas de los nuevos catálogos, manteniendo negativos. El catálogo estricto existente exige esta ampliación antes de poder ejecutar la suite DB.
- `tests/testing/run-baseline.test.mts` solo si hay una expectativa exacta del catálogo que necesite extenderse, conservando guardas y casos.
- `spec/specs/055-bitacoras-y-semaforo-configurable/contracts/MP01-FROM-CLAUDE.md` para entrega del implementador.
- Cliente Prisma generado es artefacto local ignorado; regenerarlo no autoriza versionarlo.

No modificar app.module hasta que exista endpoint en MP02; el módulo nuevo puede ser importado por tests. No tocar web, paquetes compartidos, relaciones/identidad previas, env/secretos, prototipo, migraciones históricas, gobernanza, tareas/reviews antiguas, Git ni Docker activo. Si la integración exige otra ruta, reportar la necesidad a Codex antes de modificarla.

## 7. Aceptación y pruebas de MP01

P01: Prisma valida/genera y API typecheck/build; lint focal y scanner.

P02: migración aislada aditiva; tablas nuevas y auditoría con FK/RLS/FORCE correctos; owner distinto del runtime. No filas ni permisos heredados nuevos por migración.

P03: runtime con tenant/org A no lee/escribe contexto/concesión de org B del mismo tenant ni de tenant C; IDs cruzados no se pueden asociar por FK. Contexto ausente no lee tablas nuevas; auditoría institucional no se filtra con otro org. Filas de auditoría antiguas no cambian.

P04: positivos/negativos para paciente propio, cuidador con autorización nueva, profesional asignado y revisor humano; viejos permisos solos deniegan. Cubrir binding/sesión/cuenta no válidos, expiración exacta, finalidad ausente, municipio, manager sin concesión, vínculo/paciente/cuenta/org cruzados y competencia ausente/expirada.

P05: con PostgreSQL real, bloquear autorización en misma tx de work y demostrar que revocar concurrentemente espera o gana antes de la decisión; tras revocación siguiente petición denegada. No test solo con sleeps: sincronizar transacciones con barreras y comprobar desenlace.

P06: denegación conserva auditoría tras retorno; falla de auditoría impide work/commit. Fallo de work revierte su escritura y auditoría concedida. Eventos no contienen datos clínicos.

Ejecución de DB solamente por runner/provisioner aislado aprobado de 025, no merdn_dev. Codex prepara/ejerce la ejecución con env privado sin compartirlo con Claude. Claude puede ejecutar pruebas unitarias/tipos/lint/generate con DSN ficticio inutilizable; no leer .env ni .secrets. La prueba DB debe ser añadida al catálogo y retornar counts sin skips bajo baseline real. No declarar DB aprobada si no se ejecutó.

## 8. Evidencia y reversión

Antes de editar código: reportar gate SDD, validación estricta y lectura de este contrato y AGENTS/CLAUDE. Registrar implementación, archivos, tests/errores/omisiones en MP01-FROM-CLAUDE.md y detenerse para auditoría Codex del paquete; no comenzar MP02 por cuenta propia. No afirmar semáforo terminado.

Reversión operativa de este paquete no requiere DROP: no está conectado a rutas existentes. Conservar tablas/historia y retirar integración futura si falla. No se aplica migración a base de aplicación ni se crea institución real por esta tarea.
