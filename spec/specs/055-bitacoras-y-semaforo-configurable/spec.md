# SPEC 055 — Bitácoras conectadas y semáforo individual con alarma manual

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`.
- Fecha de propuesta: 2026-10-21.
- Fecha de aprobación: 2026-10-21.
- Aprobado por: Product Owner; aprobación expresa de las recomendaciones D01–D07.
- Aceptación funcional: Product Owner, 2026-10-26, tras auditoría, B11 y explicación del cálculo; decisión `2026-10-26-055-aceptacion-funcional.md`. Se mantienen los límites técnicos, clínicos y operativos documentados; no autoriza Git ni despliegue.
- Evidencia de objetivo autorizado: el Product Owner solicitó conectar las bitácoras de cuidadores y los registros de visitadores al semáforo; las alarmas automáticas deben depender de parámetros individuales definidos por el visitador, incluida la frecuencia. Confirmó que también puede existir alarma manual y pidió trabajar con Claude para implementarlo.
- Evidencia de aprobación: tras revisar la propuesta y el documento DECISIONES-PRODUCT-OWNER.md, el Product Owner declaró «apruebo recomendaciones D01-D07». Se registra ese acto explícito; no se ejecuta confirm-user-consent.sh por iniciativa del agente. No autoriza datos reales, Git ni despliegue.
- Estado de ejecución al 2026-10-26: MP01–MP07 y B10 verificados por Codex sobre `e94e400`: baseline34/34 etapas y2690 pruebas, Chromium12/12 con móvil/teclado/axe, sin fallos/omisiones y con limpieza correcta. Después, el PO aprobó el texto SIN_CRITERIOS; Claude implementó B11 y Codex verificó API PostgreSQL43/43, criterios17/17 y web/care48/48, sin modificar el cálculo. La baseline completa y Chromium corresponden al candidato previo a ese ajuste textual; no se repitieron íntegros para B11. Dictamen técnico con observaciones en `contracts/055-CIERRE-AUDITORIA-CODEX-2026-10-26.md`. Aceptación funcional del PO registrada el 2026-10-26; no implica validación clínica, autorización Git ni despliegue.

## 1. Task ID y objetivo

`055-bitacoras-y-semaforo-configurable`. Registrar observaciones atribuibles, permitir pedir ayuda manualmente y generar alarmas automáticas exclusivamente con una regla individual vigente y validada. Hospital debe poder gestionar esas alarmas y consultar su procedencia dentro de su autorización.

El producto conserva las experiencias Hospital/Alcaldía y todos los dominios estratégicos de AGENTS.md. Esta entrega es una capacidad compartida de continuidad del cuidado; no sustituye una historia clínica, no diagnostica y no certifica cumplimiento normativo.

## 2. Contexto y hechos comprobados al inicio de la spec

- `HospitalShell` monta `HospitalPendingModule` para alarmas en el flujo normal; `HospitalAlerts` y su configuración contienen presentación demostrativa.
- `bitacoraFlow.ts` conserva respuestas en memoria. El cierre visual de `BitacoraPaciente` indica que no se enviaron ni guardaron.
- `CaregiverAccessPortal` verifica experiencia y relación, pero no implementa captura de bitácora. `CaregiverScope` solo contiene `VISITS_VIEW`; no autoriza escritura clínica.
- La finalidad vigente `HOME_CARE_COORDINATION` excluye uso clínico y la validación de relación del MVP no acredita representación. Añadir un scope no sustituye una autorización/finalidad y fundamento válidos.
- `ProfesionalPortal` consulta visitas reales; su detalle no registra notas clínicas ni evidencia. La condición profesional existente no acredita por sí sola autoridad para definir reglas clínicas.
- `HomeVisit` registra operación y transiciones, no observaciones clínicas. No debe transformarse en una historia clínica por conveniencia.
- `docs/WORKFLOW-ALERTAS-ELI.md` conserva como objetivo alarmas manuales, reglas gobernadas, escalamiento y seguimiento. La propuesta no convierte la automatización futura en comportamiento existente.

## 3. Usuarios, institución y tenencia

Paciente propio aprobado; cuidador aprobado con relación/delegación específica vigente; profesional afiliado y asignado al paciente; revisor Hospital expresamente autorizado. Cuenta, sesión y vínculo externo exactos se verifican en cada operación.

Cada registro tendrá tenant y custodia institucional explícitos, paciente y procedencia. No se asume que tenant e institución sean equivalentes ni que una institución pueda consultar información de otra por compartir tenant. Alcaldía, finanzas, soporte, administrador técnico y cuentas institucionales compartidas no reciben clínica por este cambio.

La representación exacta de la institución y sus concesiones es bloqueante en D01. El esquema actual no tiene una entidad general de organización; `InstitutionalAdministratorRegistration` identifica una reserva administrativa y no se reutilizará como institución clínica.

## 4. Módulos y alcance

Dentro de alcance propuesto: persistencia de bitácoras/observaciones y enmiendas; autorización de captura; criterios individuales versionados; evaluación determinista; alarma manual; evidencia y deduplicación; bandeja Hospital, asignación/seguimiento y auditoría; integración de portales; pruebas y documentación.

Fuera del primer incremento: WhatsApp, correo/SMS, IA diagnóstica o generativa, prescripción, importaciones de historia clínica, adjuntos, pagos, geolocalización y escalamiento automático por reloj. Se conservan como dependencias/fases futuras del flujo existente; no se eliminan del alcance estratégico. No se ofrecerán botones ni éxitos simulados para ellas.

## 5. Requisitos funcionales propuestos

### 5.1 Captura y continuidad

FR01. Una bitácora enviada se persiste y se recupera desde otra sesión autorizada. Se distingue borrador local, envío pendiente, envío fallido y registro confirmado; jamás se confirma guardado antes del commit.

FR02. Autor, tenant, institución, paciente autorizado y fecha de recepción los deriva el backend. Se conserva aparte la fecha de ocurrencia reportada, procedencia paciente/cuidador/profesional y relación/asignación que habilitó la operación.

La observación reportada por paciente/cuidador se etiqueta como tal; no se presenta como dato hospitalario verificado, diagnóstico ni historia clínica importada.

FR03. Las entradas confirmadas no se sobrescriben. Una corrección crea una enmienda con referencia al original, motivo y autor; no borra evidencia que originó una alarma. El tratamiento de correcciones frente al motor está incluido en D04.

FR04. El formulario y su catálogo son versionados. Los campos visuales del prototipo no constituyen aprobación clínica para persistirlos ni interpretarlos. Formularios, unidades y campos requeridos se resuelven en D03; pueden usarse únicamente valores sintéticos para demostrar el mecanismo técnico.

### 5.2 Criterios individuales

FR05. Solo el profesional autorizado, con afiliación y asignación vigentes sobre ese paciente y competencia institucional explícita, puede proponer/activar una regla según D02–D03. Ni ser administrador ni tener perfil FIELD_PROFESSIONAL concede esa capacidad automáticamente. Se conserva la decisión del Product Owner de que el visitador define los parámetros; no se impone por defecto una segunda aprobación humana distinta del propio visitador competente. La validación clínica debe ser explícita y atribuible, no una inferencia de la aplicación.

FR06. Cada regla conserva paciente, institución, autor/validador, versión de formulario/observable, condición estructurada, unidad cuando aplique, número de observaciones requerido, ventana temporal, severidad aprobada, vigencia y estado. Ningún número clínico se precarga desde prototipo, código o IA.

FR07. El primer motor propuesto admite condiciones estructuradas tipadas y conteo de coincidencias, sin JavaScript, SQL, expresiones libres ni ejecución de fórmulas aportadas por usuarios. La gramática exacta y el catálogo clínico deben quedar cerrados en D03 antes de MP04.

FR08. Una regla ausente, borrador, vencida, revocada o pendiente de validación NO produce alarma automática y NO clasifica al paciente como verde/estable. La pantalla muestra que no existe evaluación aplicable. Una regla nueva no altera retroactivamente el significado de evidencia histórica.

### 5.3 Evaluación y alarma automática

FR09. Una observación confirmada se evalúa en servidor contra las versiones vigentes que le correspondan. Observación, evaluación, evidencia, alarma/transición y auditoría material se confirman consistentemente; un fallo obligatorio impide afirmar que hubo evaluación completa.

FR10. Se genera alarma automática cuando se cumple la condición y el número de observaciones distintas dentro de la ventana acordada. Las reglas de tiempo, límite de ventana, duplicados entre fuentes, enmiendas y registros tardíos son decisiones explícitas D04; no se inventan durante implementación.

FR11. La evaluación conserva versión exacta de regla, entradas contadas y resultado. Los síntomas/mediciones fuera del criterio no se descartan: permanecen en la bitácora autorizada sin activar por sí solos una alarma.

FR12. Reintentos no agregan observaciones ni alarmas duplicadas. La concurrencia no puede omitir el cruce del umbral ni crear dos alarmas para un mismo episodio. Se serializa por contexto del paciente/criterio con orden de bloqueo documentado y restricción de unicidad en base, según D05. El criterio conserva identidad estable entre versiones; cambiar de versión no permite duplicar ni reemplazar una alarma abierta de ese episodio.

### 5.4 Alarma manual

FR13. Paciente propio, cuidador delegado y profesional asignado pueden activar una alarma manual con un motivo permitido, aunque no exista ninguna regla automática vigente. La identidad y alcance se validan en backend y se audita el origen manual.

FR14. El texto libre no determina severidad clínica. Se propone una bandeja visible de revisión pendiente para solicitudes manuales sin clasificación profesional, con acceso inmediato de los responsables autorizados. No se ocultan ni se supeditan a cumplir repeticiones del motor automático. D03 define quién puede asignar severidad y cómo se comunica una posible urgencia.

La confirmación distingue recepción de atención humana. Texto propuesto pendiente de aprobación: «Solicitud registrada para revisión. Esto no confirma que un profesional ya la haya atendido ni sustituye los canales de urgencias». No afirmar notificación o guardia que no existan. Antes de uso real debe existir responsable y política de vigilancia/contingencia aprobada por la institución.

FR15. Una clave de idempotencia identifica el intento, no toda la vida del paciente. Repetir la petición idéntica recupera el resultado; reutilizarla con otro contenido produce conflicto. Otra situación puede producir otra alarma: no existe un límite de una alarma por paciente.

### 5.5 Semáforo, seguimiento y cierre

FR16. La bandeja Hospital consulta datos persistidos con conteos y listas paginadas coherentes con el mismo alcance. Distingue origen manual/automático, clasificación pendiente, severidad asignada, estado operativo, responsable, fechas y evidencia mínima autorizada. Color siempre acompañado de texto.

FR17. No observar alarmas no significa estabilidad clínica. Los conteos estables solo proceden de una clasificación vigente autorizada. Error, carga, acceso denegado y falta de configuración no se presentan como cero o verde.

FR18. Reconocer, asignar, reclasificar, resolver y cerrar son acciones diferentes con concurrencia/versiones e historia. El paciente/cuidador puede informar resolución conforme a su alcance; esa declaración no borra el caso, no rebaja por sí sola una severidad ni equivale a cierre administrativo. D06 cierra la matriz de transiciones.

FR19. Una alarma clasificada como posible urgencia se muestra inmediatamente al Hospital autorizado; no espera Elí, WhatsApp ni una ventana de contacto. La recurrencia automática de una regla no reemplaza el canal manual.

## 6. Datos y modelo conceptual propuesto

Separar identidades del dominio actual de los siguientes conceptos; nombres finales sujetos al plan aprobado:

| Concepto | Contenido y procedencia | Integridad y tratamiento |
|---|---|---|
| Contexto institucional de cuidado | Institución propietaria, tenant, paciente/contexto y concesiones explícitas | Resolver D01; no inferir custodia de una etiqueta visual ni de una cuenta administradora |
| Versión de formulario/observable | Campos permitidos, tipo, unidad, vigencia y validador | Contrato D03; sin reglas clínicas por defecto |
| Entrada y enmienda | Respuestas/observaciones, autor, fuente, recepción, ocurrencia reportada, versión, referencia original | Append-only para confirmadas; FK compuestas tenant/institución/paciente; sin borrado en cascada |
| Regla individual y versión | Observable, condición tipada, conteo, ventana, severidad, vigencia, responsable/validación | Historial inmutable; una configuración efectiva inequívoca; sin mutación retroactiva |
| Evaluación y evidencia | Versión usada, entradas distintas consideradas, resultado y correlación | Reproducible; unicidad/idempotencia; sin copia clínica a logs |
| Alarma y evidencia causal | Origen, paciente, clasificación, estado, responsable, episodio, timestamps y versión | Consistencia transaccional; reglas D05; evidencia no se sustituye al corregir entrada |
| Historial de transición | Actor real, acción, anterior/nuevo minimizados, motivo, fecha y correlación | Append-only; control de versión; auditoría separada |

Sensibilidad: observaciones y criterios de salud `CLINICAL`/`SENSITIVE_PERSONAL`; auditoría `AUDIT_RESTRICTED`. Hospital/institución custodia el contexto bajo el fundamento aprobado; los participantes conservan su autoría. Exportación, adjuntos y acceso municipal nominal permanecen denegados.

Retención: no se inventan plazos legales. Sin endpoints de eliminación ordinaria ni TTL destructivo. Antes de usar datos reales deben definirse fundamento de tratamiento, información al titular, retención y disposición con responsables competentes. El desarrollo y aceptación técnica usan solamente datos ficticios en entorno aislado.

## 7. Permisos y alcance contextual propuestos

| Actor | Permisos propuestos, nunca implícitos | Denegaciones necesarias |
|---|---|---|
| Paciente propio | Crear/ver su bitácora, pedir alarma manual y reportar resolución propia | Sin otros pacientes, reglas, clasificación clínica o cierre administrativo |
| Cuidador delegado | Nuevos alcances separados para contribuir bitácora, consultar el seguimiento autorizado y solicitar alarma manual | `VISITS_VIEW` solo no basta; sin relación activa/finalidad/consentimiento no hay acceso; sin reglas o clínica ajena |
| Visitador competente asignado | Registrar observaciones, ver evidencia autorizada y gestionar criterios del paciente dentro de su competencia explícita | Perfil/afiliación sin asignación o sin competencia no habilitan; no puede operar pacientes ajenos |
| Revisor Hospital identificado | Bandeja, reconocimiento, asignación y transiciones expresamente concedidas según D02/D06 | HOSPITAL_SCHEDULER/PATIENT_VIEWER/ADMINISTRATOR no ganan acceso clínico ni cierre por inferencia |
| Sistema | Evaluar exclusivamente entradas y reglas confirmadas, como actor de servicio y bajo contexto fijado | Sin privilegios globales, BYPASSRLS ni decisión clínica propia |
| Alcaldía/finanzas/soporte | Ningún permiso individual nuevo por esta spec | Sin cuerpo de bitácoras, parámetros individuales ni alarmas nominales |

Revalidar cuenta aprobada, vínculo exacto, contexto institucional, finalidad, consentimientos aplicables y relación/asignación DENTRO de la misma transacción de lectura/escritura. Las políticas actuales que abren su propio `withTenant` no se reutilizan como comprobación previa independiente: crear variantes que reciban `PrismaTransaction` y serialicen frente a revocación. Revocar un alcance impide el siguiente acceso y no borra historia. Las concesiones antiguas no se amplían mediante migración masiva.

La nueva contribución del cuidador necesita finalidad y autorización adicionales, no reinterpretar `HOME_CARE_COORDINATION` como permiso clínico. D02 debe fijar quién concede esa autorización y la evidencia válida. El nuevo revisor clínico Hospital debe ser una cuenta humana individual con concesión específica; no se activará mediante una credencial compartida. Esto no afirma que hoy toda auditoría Hospital sea anónima: la ruta del administrador identificado ya puede atribuir acciones humanas, pero no concede por ello el nuevo permiso clínico.

## 8. Auditoría

Eventos requeridos: acceso sensible permitido/denegado; entrada confirmada; enmienda; configuración propuesta/validada/activada/revocada; evaluación completada/no evaluable; alarma manual/automática creada; evidencia agregada; reconocimiento/asignación/reclasificación/resolución/cierre y conflicto idempotente relevante.

Registrar tenant, institución, cuenta humana o sistema, recurso opaco, acción, instante servidor, resultado, correlación y referencia de versión/motivo. Nunca registrar respuestas clínicas completas, síntomas en mensajes de error, tokens o secretos. Auditoría material y cambio de negocio comparten atomicidad; una denegación conserva su evento al devolver el rechazo tras commit.

## 9. Seguridad y fallos

- Validación estricta de campos, tipos, tamaños, unidades, enumeraciones y claves idempotentes; sin asignación masiva ni consultas arbitrarias.
- OIDC/cookies y controles de origen existentes; rate limits para captura y solicitudes manuales sin informar falsamente entrega si se rechaza.
- Backend policy más FK/constraints más RLS/FORCE RLS; runtime sin ownership/BYPASSRLS. Fijar contexto transaccional, nunca global al pool.
- IDOR, enumeración, relación/asignación caducada, solicitud suspendida, institución cruzada, abuso de alarmas y caché tras logout deben fallar cerrados.
- Transacciones y orden de locks consistentes entre captura, regla, revocación y cierre; conflictos versionados producen `409`, no sobrescritura.
- Formularios sin regla y fallos de evaluación deben ser visibles y recuperables, sin estado clínico inferido. No enviar datos sensibles a servicios externos.
- Corte de red no equivale a alarma recibida. Conservar el intento local solo bajo una política aprobada; no habilitar almacenamiento sensible offline por inferencia.

## 10. Referencia visual y accesibilidad

`prototype-claude/` es referencia de navegación, composición y controles; solo lectura. Reutilizar estilos/componentes existentes en portales y Hospital, pero reemplazar los mensajes de guardado simulado al conectar captura real. No importar sus pacientes, cifras, umbrales o clasificación.

Teclado, foco al error, labels/unidades claras, error asociado al campo, estado de guardado por aria-live, contraste y estados que no dependan del color. La alarma manual debe ser fácil de encontrar y dar confirmación verificable del servidor.

## 11. Archivos permitidos propuestos por paquete

Documentación MP00: `spec/specs/055-bitacoras-y-semaforo-configurable/**`, su entrada en `spec/specs/INDEX.md` y el handoff específico de 055 en `spec/bitacora/handoffs/`. No sobrescribir handoffs de otras tareas ni documentos autoritativos para ocultar decisiones abiertas.

Tras aprobación y contrato completo: módulos nuevos enfocados en `apps/api/src/care-records/` y `apps/api/src/care-alerts/`; integración mínima en `app.module.ts`, políticas de identidad/relación/institución y auditoría; `prisma/schema.prisma` y migraciones NUEVAS; pruebas en `apps/api/src/**`, `apps/api/test/**`, `tests/e2e/**`; formularios/clientes nuevos y componentes de integración dentro de `apps/web/src/features/{paciente,caregiver,profesional,hospital}/`; contrato compartido si existe necesidad real; catálogo/runner de baseline solo para incorporar etapas aprobadas.

Las variantes transaccionales de `identity-access/identity-access.service.ts`, `people-relationships/caregiver-relationship.policy.ts` y `people-relationships/caregiver-relationship.contract.ts` deben figurar expresamente en la allowlist del paquete que incorpore las nuevas autorizaciones. No basta ampliar el enum Prisma: la finalidad/política/catálogos y sus pruebas deben coincidir.

Cada paquete fijará su allowlist exacta antes de entregarse a Claude. Una dependencia o ruta adicional vuelve a revisión; no hay permiso abierto para refactorizar esos directorios.

## 12. Archivos y acciones prohibidos

`prototype-claude/**`, `tasks/**`, `reviews/**`, migraciones históricas, `AGENTS.md`, `CLAUDE.md`, secretos/env reales, lockfiles/dependencias sin decisión, módulos financieros/municipales ajenos, datos existentes, `.git/**` mediante edición directa y `main`. No commits, push, PR, merge, publicación ni despliegue por esta instrucción de implementación. No ejecutar `confirm-user-consent.sh` por iniciativa del agente.

## 13. Dependencias e integraciones

Reutilizar NestJS, Prisma, PostgreSQL, Next.js, identidad OIDC, `withTenant`, auditoría y baseline aislada existentes. Sin proveedor externo ni nuevo stack. Resolver D01–D06, contrato de campos y política clínica antes de sus paquetes dependientes.

Se propone evaluar síncronamente al guardar y consultar el Hospital mediante API paginada. El worker/outbox y los canales externos siguen previstos para ampliaciones; no se afirma entrega asíncrona ni vigilancia por reloj en este primer mecanismo.

## 14. Criterios de aceptación

AC01. Una entrada confirmada se recupera tras recarga/otra sesión autorizada con autor, versión y fechas correctos; un envío fallido nunca confirma guardado.

AC02. Sin relación/delegación, competencia o asignación exigidas se devuelve denegación uniforme sin revelar datos; el permiso previo `VISITS_VIEW` no permite escribir.

AC03. Una regla individual validada afecta únicamente su paciente/institución y conserva versión. No se precargan umbrales ni se deriva severidad de texto libre.

AC04. Casos sintéticos justo por debajo, en y por encima del conteo/ventana producen el resultado aprobado; repetir un evento no cuenta dos veces. Fijar antes D04 para fechas y correcciones.

AC05. Sin regla válida se registra la observación sin generar alarma automática ni verde ficticio. La solicitud manual sigue disponible cuando el actor tiene permiso.

AC06. Una alarma manual queda persistida y visible al Hospital autorizado aun sin criterios automáticos; origen y clasificación pendiente no se ocultan.

AC07. Reintentos y dos escrituras concurrentes no duplican alarma/observación ni pierden el cruce del criterio; un evento distinto no se suprime como si fuera reintento.

AC08. La evidencia permite reproducir regla/versión/entradas; una enmienda o cambio de regla conserva la causalidad histórica y no cierra una alarma silenciosamente.

AC09. Conteos/listas/acciones respetan tenant, institución y paciente; pruebas incluyen dos instituciones del mismo tenant y otro tenant. Los roles no clínicos no acceden por estar dentro de Hospital.

AC10. Reconocimiento, asignación y cierre generan historia/auditoría y respetan versión; informar resolución no elimina evidencia ni suprime urgencia por inferencia.

AC11. Runtime RLS, rollback ante auditoría fallida, revocación concurrente, límites, seguridad y accesibilidad pasan con evidencia verificable.

AC12. No existen fixtures en el flujo operativo ni mensajes de éxito de WhatsApp/IA/escalamiento no implementados. La prueba técnica no se presenta como validación médica ni autorización para pacientes reales.

## 15. Pruebas requeridas

- Unitarias del evaluador puro: tipos, unidades, condiciones, conteo, límites temporales D04, idempotencia, enmiendas, reglas ausentes/revocadas y versiones.
- API/DB reales en baseline aislada: captura/consulta/enmienda, regla/validación, manual/automática, seguimiento, auditoría y rollback.
- Permisos positivos y negativos por cada acción; cuenta/vínculo exacto/experiencia, consentimiento/relación/asignación y expiraciones; no herencia de VISITS_VIEW ni de roles administrativos.
- PostgreSQL RLS/FORCE RLS, rol runtime sin ownership, FK contra cruces, dos instituciones en un tenant y otro tenant; aislamiento de consultas/conteos/errores.
- Concurrencia real de eventos que completan el criterio, reintentos, cambio de regla, revocación y cierre; orden de locks sin inversión ni pérdida de evidencia.
- E2E ficticio cuidador y visitador → entradas persistidas → criterio individual → alarma automática; paciente/cuidador → alarma manual sin regla → bandeja/seguimiento Hospital; recarga, logout y denegación.
- Accesibilidad automatizada y teclado; responsive; escaneo de secretos; lint, tipos, builds y regresión focal de visitas/accesos existentes.

## 16. Migraciones, compatibilidad y operación

Migraciones aditivas y auditables, sin borrar datos ni reescribir historia. No convertir relaciones antiguas en nuevos permisos ni inferir autoridad clínica de un cargo. Contenido clínico real, activación de reglas y la base de aplicación quedan fuera de las pruebas.

Ensayar esquema y rollback en base aislada; generar Prisma, comprobar grants, RLS y constraints. Publicar código detrás de activación por institución solo tras aprobación del paquete; sin flag de cliente que salte autorización. Si falla la evaluación o política, no anunciar recepción/evaluación completada ni estabilidad.

La reversión operativa deshabilita nuevas operaciones y restaura imagen/configuración previa con historial intacto; no usa DROP ni elimina alarmas. Las reglas ya existentes se mantienen consultables por quien conserve permiso y no se recalculan con una versión diferente.

## 17. Decisiones aprobadas y decisiones pendientes

Opciones y semántica aprobadas el 2026-10-21: [contracts/DECISIONES-PRODUCT-OWNER.md](contracts/DECISIONES-PRODUCT-OWNER.md). Los contratos por paquete concretan su implementación; no sustituyen la validación clínica ni autorizan datos reales.

Aprobado por el Product Owner en conversación: conectar fuentes de cuidador/visitador; parámetros individualizados decididos por el visitador; frecuencia relevante para alarma automática; permitir también alarma manual; colaboración Codex–Claude. No se inventarán valores médicos.

| ID | Decisión aprobada D01–D07 | Recomendación aprobada, conservada para trazabilidad |
|---|---|---|
| D01 | Custodia e institución responsable dentro del tenant y procedencia del acceso | Identificador institucional explícito y concesiones por paciente/contexto; no usar cuenta administradora como institución ni compartir registros por tenant solamente. Resolver mapeo/provisión en contrato MP01 antes de migrar |
| D02 | Nuevas capacidades y quién revisa en Hospital | Cuidador con alcances de bitácora/alarma expresos; visitador competente con asignación; revisor Hospital humano con concesión específica; sin permisos clínicos automáticos para administración/agenda. La institución habilita las concesiones de forma controlada |
| D03 | Formulario, observables, competencia, validación de regla y clasificación manual | Catálogo/gramática tipados y versionados, sin valores por defecto; el visitador clínicamente competente y habilitado define y valida la regla antes de activación, sin doble aprobador obligatorio por defecto. El formulario requiere validación clínica institucional. Ratificar taxonomía ROJA/AMARILLA/ESTABLE del flujo objetivo, catálogo de motivos y mensaje de recepción/urgencias. Solicitudes manuales sin valoración profesional quedan pendientes de clasificación, visibles inmediatamente |
| D04 | Qué cuenta como ocurrencia y cuándo, registros tardíos y correcciones | Contar observaciones distintas, nunca envíos/reintentos; conservar ocurrencia y recepción; contrato explícito de límites y corrección sin retroactividad silenciosa. No elegir clínicamente recepción vs ocurrencia en código sin aprobación |
| D05 | Qué significa una sola alarma y cuándo hay un episodio nuevo | Una alarma abierta por paciente/contexto/criterio; acumular evidencia sin duplicar y conservar alertas distintas. Eventos posteriores al cierre forman episodio nuevo enlazado; no deduplicar manuales distintos por paciente solamente |
| D06 | Seguimiento, resolución/cierre y uso permitido de datos | Paciente/cuidador reportan resolución; profesional/revisor autorizado realiza acciones de cierre según matriz; pruebas solo ficticias. Fundamento, retención y validación clínica deben cerrarse antes de cualquier uso con datos reales |
| D07 | Secuencia frente al plan general y mecanismo de evaluación | Priorizar un incremento de S06/S12 con evaluación síncrona, bandeja interna y sin worker/canales externos aún; mantener S03/S08/S09/S11 y outbox/Elí/WhatsApp como dependencias futuras, sin declarar S12 completo ni eliminar capacidades |

Las recomendaciones del documento de decisiones quedaron aprobadas el 2026-10-21. D02 incluye expresamente una nueva finalidad/autorización para cuidador y su autoridad concedente; D03 incluye fuente de competencia, taxonomía y mensajes, no solo valores del motor. Los contratos de MP01–MP07 concretan esas decisiones. Ningún agente puede generar consentimiento por iniciativa propia.

**Decisión de presentación aprobada por el Product Owner el 2026-10-26:**
conservar `SIN_CRITERIOS` y mostrar exactamente «Sin criterios vigentes ni
solicitudes abiertas: no hay evaluación automática». No se adopta la alternativa
de cambiar el estado del caso vencido a `SIN_EVALUACION`. El cálculo y los demás
estados permanecen iguales. Implementación y pruebas acotadas en
`contracts/MP07B-B11-TEXTO-SIN-CRITERIOS.md`; la decisión canónica está en
`spec/bitacora/decisiones/2026-10-26-055-texto-sin-criterios-vigentes.md`.

El comportamiento aprobado A01 conserva una clasificación ESTABLE de una alarma
abierta aunque venza la regla que la originó; el reloj no cierra ni reclasifica
alarmas. Es una clasificación histórica autorizada aún abierta, no una nueva
evaluación del estado de salud ni una validación clínica de MERDN.

## 18. Evidencia y handoff de Claude

Claude debe retornar por paquete: Task ID; estado real; archivos creados/modificados y propósito; migración y compatibilidad; criterios cumplidos/pendientes; decisiones aplicadas; comandos/resultados exactos y omisiones; evidencias de RLS/tenant/institución/paciente, concurrencia, auditoría, accesibilidad y E2E; riesgos y desviaciones. Codex audita antes de avanzar al siguiente paquete sensible o presentar aceptación al Product Owner.

Una pantalla renderizada, gate global abierto, respuesta de un modelo o prueba con mocks no demuestra implementación de este flujo ni validación clínica.
