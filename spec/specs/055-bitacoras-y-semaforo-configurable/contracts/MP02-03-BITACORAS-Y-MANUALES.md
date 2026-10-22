# 055 / MP02–MP03 — Bitácoras persistentes y alarmas manuales

Estado: contrato de integración bajo D01–D07 aprobadas. Se entrega a Claude solamente después de auditar MP01. No comienza automáticamente al terminar MP01. La entrega conserva aceptación separada de bitácora y alarma manual; el motor automático se incorpora después mediante MP04.

## Objetivo y datos

Conectar Paciente/Cuidador/Visitador a observaciones propias/delegadas/asignadas persistidas y permitir pedir ayuda manual sin regla automática. La información queda bajo PatientCareContext y las nuevas autorizaciones, no sobre HomeVisit ni sobre las credenciales institucionales antiguas. No usar campos clínicos estáticos del prototipo como catálogo aprobado.

Agregar migración aditiva y modelos con tenantId/organizationId/contextId/patientId y FK compuestas al contexto; nombres finales armonizados con MP01:

- `CareObservableDefinition`: id, contexto completo, code estable, version positiva, label, type BOOLEAN/NUMBER/CHOICE, unit opcional, opciones tipadas de catálogo, validatedByHumanAccountId, validatedAt, status ACTIVE/RETIRED, createdAt. Cada versión es inmutable; índice único parcial de versión activa por contexto/code. Solo MANAGE_RULES con competencia puede definir/retirar. Se registra que el profesional validó, no una aprobación médica automática del sistema.
- `CareRecord`: id, contexto, authorHumanAccountId, source PATIENT/CAREGIVER/PROFESSIONAL, occurredAt reportado, receivedAt servidor, note opcional, createdAt. Inmutable tras confirmación. Sin severidad derivada del texto.
- `CareObservation`: id, contexto, recordId, observableDefinitionId/version, occurrenceKey UUID, value tipado, referencia opcional explícita a observación canónica ya autorizada del mismo contexto/observable. Una ocurrencia canónica cuenta una vez; no se deduplica por parecido de síntoma/hora. Valor NUMBER se transporta como decimal normalizado y se conserva con precisión; BOOLEAN es boolean; CHOICE usa código válido. No ejecutar fórmulas.
- `CareRecordAmendment`: id, contexto, recordId/observationId, authorHumanAccountId, replacementValue opcional según tipo y/o nota correctora, reason, sequence positiva, createdAt. Append-only, unique(original,sequence); control de versión para evitar perder dos correcciones. Solo autor de la entrada puede enmendarla con permiso de contribución vigente; otros profesionales agregan observación propia referenciada, no editan autoría ajena.
- `CareAlarm`: id, contexto, origin MANUAL/AUTOMATIC (MP03 solo produce MANUAL), initiatedByHumanAccountId, reasonCode, note opcional, severity nullable ROJA/AMARILLA/ESTABLE (manual inicial NULL), state NUEVA/EN_GESTION/RESUELTA/CERRADA, assignedReviewerHumanAccountId?, version, createdAt/updatedAt, resolvedAt?/closedAt?, criterionId nullable reservado a MP04 o añadido entonces. No una alarma por paciente de por vida.
- `CareAlarmTransition`: id, contexto, alarmId, actorHumanAccountId, action, before/after mínimos, reason cuando proceda, createdAt; append-only.
- `CareRequestReceipt`: contexto, actor, action, idempotencyKey UUID, canonicalPayloadHash, responseResourceId, createdAt; unique(context,actor,action,key). Mismo intento/contenido retorna mismo recurso; contenido diferente con misma key devuelve 409. Nunca almacenar secretos ni respuestas con datos de terceros en la clave/hash.

Referencias opacas y notas clínicas se almacenan solo en negocio autorizado, no en auditoría/logs. Límite técnico: hasta 50 observaciones por envío, note/reason de hasta 2000 caracteres, labels hasta 120, codes/opciones hasta 48; máximo 100 opciones por definición. NUMBER debe aceptar decimal finito, no NaN/Infinity ni conversiones silenciosas de unidad. No son límites clínicos ni umbrales de alarma. Ocurrencia futura se rechaza. La recepción no se toma del navegador.

## Permisos y contexto

Usar la política MP01 y sus locks dentro de la transacción completa. Todos los endpoints humanos usan HumanSessionGuard; escrituras además SameOriginGuard existente, no caché y límites de abuso acotados con rechazo explícito. No privilegios desde body, headers, query ni claims.

Contextos/identificadores son recursos solicitados: el backend resuelve tenant/actor y verifica cada recurso. Paciente propio deriva su Patient y nunca puede seleccionar paciente ajeno. Caregiver/profesional usan grants expresos y relación/asignación. Revisor usa REVIEW_ALARMS/competencia sobre el contexto; manager no obtiene clínica.

Se requiere un directorio de contextos autorizados para que las personas no tengan que introducir UUIDs. Implementar únicamente descubrimiento de metadatos propios bajo un GUC transaccional de cuenta autenticada, fijado por servidor: políticas SELECT adicionales y acotadas a concesiones del propio humanAccountId y contextos del Patient propio resuelto. No abrir listados globales de organizaciones/pacientes ni quitar la restricción institucional de escrituras. La consulta candidata no autoriza nada: comprobar la política MP01 para cada contexto antes de proyectar nombre mínimo/permiso. El contexto de descubrimiento se limpia al terminar y no permite acceder a observaciones/alarma. Probar que sin ese contexto interno ni sin organización no se leen las tablas nuevas. No usar conexión administrativa, BYPASSRLS, SECURITY DEFINER ni campos de cuenta enviados por cliente para descubrir.

La ampliación SELECT anterior es una excepción explícita solo para metadatos de contextos propios, necesaria para integrar portales; no cambia los controles org/tenant de contenido, ni concede escritura ni competencias. Actualizar el catálogo baseline sin relajar guardas.

## HTTP mínimo

Nuevos módulos `care-records` y `care-alerts`, usando `care-context`:

- GET `/api/v1/care/contexts`: proyección paginada de contextos realmente autorizados (contextId, organizationId, nombre institucional, etiqueta mínima del paciente autorizada y acciones disponibles); sin total de pacientes ajenos. Cursor opaco de metadatos propios, máximo 50 por página. Contextos sin permisos no se devuelven.
- GET `/api/v1/care/contexts/:contextId/observables`: definiciones activas válidas para ese contexto.
- POST misma ruta `/observables`: crear versión validada por visitador con MANAGE_RULES; nunca por cuidador/admin sin competencia. Retirar la versión anterior dentro de transacción; no modificar lo que referencian registros previos.
- GET/POST `/api/v1/care/contexts/:contextId/records`: lista paginada de registros/observaciones autorizados y envío con idempotencyKey. Definición exacta de contexto se resuelve de metadatos propios; no confiar en organizationId enviado como autoridad.
- POST `/api/v1/care/contexts/:contextId/records/:recordId/amendments`: enmienda atribuida y versionada, sin UPDATE del registro original.
- GET/POST `/api/v1/care/contexts/:contextId/alarms`: lista autorizada y solicitud manual con idempotencyKey, reasonCode y nota opcional. No aceptar severity/state/actor/tenant/patientId del cliente al crear manual.
- GET `/api/v1/care/contexts/:contextId/alarms/:alarmId`: detalle/evidencia mínima, nunca filas de otro contexto.
- POST misma ruta `/transitions`: reconocer, clasificar, asignar, resolver/cerrar con version esperada, acción permitida y motivo cuando corresponda. REVIEW_ALARMS para decisiones clínicas/administrativas. Clasificación/severidad la decide el profesional autorizado, no texto libre.
- POST misma ruta `/resolution-reports`: iniciador propio autorizado puede informar resolución; crea evento, no cierra ni rebaja severidad automáticamente.

Las rutas exactas de retiro de observable y listado Hospital pueden ajustarse localmente solo conservando permisos/semántica y documentando contrato; ningún endpoint añade autoridad implícita. Si contextId no se resuelve dentro del directorio propio, devolver denegación uniforme sin revelar existencia. No buscar organización con credencial superior para resolver un ID ajeno.

Manual reasonCode inicial de software: `REQUEST_REVIEW` (solicitar revisión), no un diagnóstico. Texto de recepción aprobado por D03: «Solicitud registrada para revisión. Esto no confirma que un profesional ya la haya atendido ni sustituye los canales de urgencias». Solo petición persistida; sin afirmar aviso WhatsApp/correo ni monitorización permanente. No crear un catálogo médico a partir de ejemplos.

## Estados y transiciones

Revisor puede reconocer NUEVA→EN_GESTION; resolver NUEVA/EN_GESTION→RESUELTA; cerrar RESUELTA→CERRADA. Reabrir RESUELTA/CERRADA→EN_GESTION solo mediante acción explícita con motivo. Asignar no cambia por sí solo severidad ni estado clínico. Destinatario debe tener concesión REVIEW_ALARMS y competencia vigentes para ese contexto. Informar resolución por iniciador no cambia state; profesional confirma. Actualización requiere CAS(version), auditoría e historial en una transacción; 409 ante carrera. No borrar ni reducir severidad automáticamente al corregir observación.

## Interfaz

Crear componentes compartidos en `apps/web/src/features/care/` (cliente tipado, selector de contextos, bitácora, manual y bandeja/seguimiento). No duplicar lógica por perfil ni agregar dependencias.

- Paciente: montar sección de cuidado solo dentro del portal autenticado; recursos propios resueltos por servidor.
- Cuidador: sustituir el montaje operativo de liquidaciones demostrativas por contexto real/bitácora/solicitud manual; conservar archivos de referencia y alcance financiero futuro.
- Visitador: conservar worklist; detalle permite abrir el contexto autorizado de cuidado y registrar. No deducir permiso de un botón o de la lista de visitas. Gestión de observable solo si el servidor confirma capacidad.
- Hospital: reemplazar apartado pendiente de alarmas por bandeja nueva para la cuenta humana autorizada; no habilitar demo ni usar cookie institucional compartida como permiso. Una sesión administrativa sin concesión clínica ve denegación/estado correspondiente.

Contexto inexistente/configuración ausente/error muestran estado explícito, no pacientes de ejemplo. Formularios de observación salen de definiciones validadas; si no las hay, permitir nota operativa autorizada y solicitud manual sin fingir evaluación ni color verde. No localStorage/sessionStorage/offline de datos sensibles. Limpiar estado al salir/cambiar contexto; respuesta obsoleta de contexto anterior no se monta.

Recepción y revisión humana son estados distintos. Teclado, foco, mensajes aria-live, labels/unidades, validación asociada y severidad textual. No mostrar IDs/códigos técnicos como interfaz principal ni errores internos.

## Auditoría e integridad

Extender eventos CARE_* de AuditEvent para registro, enmienda, observable validado, manual creada, lectura/denegación y transiciones; organizationId obligatorio en nuevos eventos. Mutación, receipt, historial y auditoría atómicos. En retry no duplicar recursos ni registrar una segunda transición de creación. Append-only para registros/observaciones/enmiendas/transiciones. No desactivar protección por tests: conservarla también frente al owner cuando corresponda y limpiar retirando el cluster aislado, no borrando historia compartida.

Usar bloqueo advisory por tenant/organización/contexto para operaciones de negocio, DESPUÉS de los locks de autorización MP01 y ANTES de registros/reglas/alarmas; nunca upgrade del lock compartido del contexto. Clave hash determinista de los tres identificadores; colisiones solo serializan más, nunca amplían alcance. Orden consistente y pruebas con barreras. No nuevos worker ni dependencias.

## Allowlist propuesta a concretar tras auditar MP01

`apps/api/src/care-context/**` (descubrimiento mínimo), `apps/api/src/care-records/**`, `apps/api/src/care-alerts/**`, `apps/api/src/app.module.ts`; `prisma/schema.prisma` y NUEVA migración `20261021130000_care_records_manual_alarms`; `apps/api/test/care-records.api.test.ts`, `care-alarms.api.test.ts`, `care-context-fixtures.ts`; catálogos baseline/provision/preflight y expectativas necesarias; `apps/web/src/features/care/**` y puntos de montaje/tests de PacienteExperience, CaregiverAccessPortal, ProfesionalPortal y HospitalShell/HospitalPendingModule/hospitalOperationalHome; handoff MP02-03 específico. No archivos ajenos, migraciones previas, env/secretos, paquetes/dependencias, prototipo, Git ni despliegue.

## Aceptación y pruebas

Bitácora recuperable tras recarga, autorización de cada operación, inmutabilidad/enmienda, ocurrencia/recepción, typed values y versiones; sin clinical demo como dato real. Manual sin regla llega persistida a bandeja autorizada, severity null/pendiente, recepción sin promesa de atención. Duplicado idéntico recupera mismo recurso y otra carga con misma key devuelve 409. Transiciones/CAS/competencia/atribución completas.

DB real aislada: tenant/org/contexto/paciente/autor ajenos, revocación concurrente, sesión/binding inválidos, manager sin clínica, CSRF/origen, rollback/auditoría, idempotencia concurrente y descubrimiento mínimo sin fuga de contenido. Unitarias de validación/clientes; E2E ficticio de cada perfil y limpieza al logout; accesibilidad/teclado/responsive; tipos/build/lint/scanner y regresiones de los montajes afectados. Codex ejecuta DB sin compartir env privado; Claude reporta omisiones exactamente.

MP02–03 no se declara motor automático: ese comportamiento sigue pendiente hasta MP04 y sus pruebas de ventana/conteo/evidencia.
