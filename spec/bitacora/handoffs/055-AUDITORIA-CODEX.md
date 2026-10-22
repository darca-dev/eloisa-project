# SPEC 055 — Auditoría de Codex de la entrega MP01–MP06

Fecha: 2026-10-21. Rama examinada: `feat/preentrega-access-hardening`, árbol de trabajo sin commit. Dictamen: **requiere correcciones; no aceptada para cierre funcional**. Esta auditoría no cambia la aprobación de D01–D07 ni autoriza Git, despliegue o datos reales.

## Alcance y fuentes

Revisión de `spec/specs/055-bitacoras-y-semaforo-configurable/`, D01–D07, decisión adicional de administración/D04.5 y entrega consolidada `055-MP01-MP06-FROM-CLAUDE.md`; implementación de custodia, administración, bitácoras, criterios, alarmas y montajes web. Se realizaron revisiones especializadas independientes de seguridad/permisos, motor y API/UI, todas de solo lectura. Codex consolidó los hallazgos y comprobó sus rutas de código. No modificó producción.

El árbol actual incluye paquetes posteriores a la revisión histórica `MP01-REVISION-CODEX.md`. Por ello, aquella conclusión de que bitácoras y alarmas estaban ausentes describe el estado anterior; hoy están implementadas, con los defectos siguientes. Los resultados del implementador se distinguen de la verificación independiente.

La decisión canónica adicional registra autorización del PO para continuar y para una pantalla del gestor. No se considera la autoría de un contrato por Claude, por sí sola, un defecto de producto. Sí se auditan sus decisiones contra los requisitos aprobados: el contrato MP04–MP05 contradice FR17 al inferir ESTABLE por tener criterios sin alarmas, y no fija la definición/unidad exigida por FR06.

## Hallazgos

### A01 — P1: ESTABLE sin datos ni clasificación

- Evidencia: `apps/api/src/care-criteria/criterion-evaluator.ts:141`; `care-criteria.service.ts:272`; `care-criteria.contract.ts:58`; contrato MP04–MP05 §5.
- Escenario: crear un criterio vigente, incluso de severidad ROJA, sin registrar observación alguna; consultar el semáforo. Devuelve ESTABLE porque `activeCriteria > 0`.
- Impacto: representa ausencia de alarma como estabilidad clínica. Contradice FR17. `criterion-evaluator.test.ts:111` incorpora la misma expectativa equivocada: una prueba verde no valida ese requisito.
- Cierre: conservar estados explícitos de falta de evaluación y reservar ESTABLE para clasificación vigente autorizada. Corregir contrato, implementación y pruebas sin inventar una duración clínica de estabilidad.
- Pruebas requeridas: criterio activo sin registros, registros insuficientes, criterio vencido, ausencia de regla y clasificación autorizada; ninguno de los casos sin clasificación debe producir ESTABLE.

### A02 — P1: contaminación entre pacientes al cambiar de contexto

- Evidencia: `apps/web/src/features/care/CareWorkspace.tsx:150`, `:185`, `:200`, `:388`, `:410`; `careViews.tsx:144`, `:369`.
- Escenario 1: redactar una nota o solicitud en A y elegir B. Los formularios mantienen su `useState`, sin remontarse por contexto; el nuevo callback puede enviar a B la nota escrita para A.
- Escenario 2: enviar una mutación en A, cambiar a B mientras responde y completar A. El handler conserva la recarga de A, pero consulta la generación actual después del `await`; `cargarContexto` acepta datos de A bajo el selector B. Los handlers de detalle y recibos tampoco aplican el mismo descarte de respuestas antiguas.
- Impacto: posible atribución de información clínica al paciente incorrecto y presentación de su bitácora/semáforo bajo otro paciente. Ambos pacientes pueden estar autorizados: no es necesario un bypass del backend para sufrir el defecto.
- Cierre: separar el ciclo completo por contexto, limpiar borradores/claves y capturar identidad/generación antes de cada petición. Descartar toda actualización tardía y cancelar cargas de ese ciclo.
- Pruebas requeridas: interacción con dos pacientes, borrador A→B y POST/detalle demorado A→B; verificar el destino de cada escritura y que jamás se muestre A bajo B. Las pruebas de render estático y un recorrido con un solo contexto no cubren esta carrera.

### A03 — P1: reglas sin definición y unidad fijadas

- Evidencia: `apps/api/src/care-criteria/care-criteria.service.ts:70`, `:118`; `apps/api/src/care-records/care-records.service.ts:127`; `apps/api/src/care-criteria/care-alarm-engine.ts:235`.
- Escenario: definir NUMBER `x` en `mg`, validar regla `>10`, reemplazar `x` por otra versión en `g` y registrar `11 g`. La regla conserva código/tipo, pero no definición exacta/unidad; el motor consulta por código/tipo y aplica el umbral de la unidad anterior.
- Impacto: interpretación incompatible del valor y alarma bajo una configuración que el profesional no validó. Cambiar el tipo puede dejar un criterio nominalmente activo que ya no se evalúa. FR06 exige versión de observable y unidad.
- Cierre: fijar procedencia exacta de definición, versión y unidad en la regla; no aplicar una regla antigua a una definición incompatible. Exigir revalidación explícita para esa evolución, sin conversión clínica implícita.
- Pruebas requeridas: nueva definición compatible, cambio de unidad, tipo y catálogo CHOICE; preservar reglas/evidencias históricas y demostrar que no hay reinterpretación silenciosa.

### A04 — P1: episodios nuevos pueden reutilizar eventos antiguos

- Evidencia: `prisma/migrations/20261021130000_care_records_manual_alarms/migration.sql:198`; `care-alarm-engine.ts:125`, `:214`, `:235`; `criterion-evaluator.ts:110`.
- Escenario 1: N=1; una observación con occurrenceKey K abre una alarma; cerrarla; renovar la definición del mismo código y volver a registrar K aún dentro de ventana. La unicidad depende de definitionId y el consumo depende de observationId: puede abrir otra alarma con el mismo evento.
- Escenario 2: tras cerrar, recibir otro evento ocurrido antes del cierre, pero dentro de ventana y posterior a activación. Los candidatos no se restringen por el cierre del episodio anterior; este solo se consulta para enlazar previousAlarmId.
- Impacto: se vulnera el conteo de ocurrencias distintas y la frontera de episodio de D04/D05/FR12. El caso de prueba que usa activación+300/400 tras cerrar no garantiza una ocurrencia posterior al cierre.
- Cierre: mantener identidad de ocurrencia y consumo entre versiones y aplicar la frontera aprobada del episodio. No deduplicar por parecido de síntomas ni reutilizar evidencia consumida.
- Pruebas requeridas: mismo K entre versiones, consumido y no consumido, episodio abierto/cerrado, evento tardío anterior al cierre, evento nuevo posterior y concurrencia. Acumular evidencia en el episodio abierto sin exigir completar N de nuevo debe mantenerse.

### A05 — P1: revisor clínico autorizado sin acceso a la bandeja web

- Evidencia: `apps/web/src/app/hospital/page.tsx:12`; `HospitalShell.tsx:494`, `:764`; `apps/api/src/institutional-auth/institutional-administrator.service.ts:118`.
- Escenario: humano HOSPITAL_REVIEWER con concesión REVIEW_ALARMS y competencia vigentes, sin registro del administrador institucional inicial. La API de cuidado lo autoriza, pero `/hospital` exige primero la sesión administrativa y no monta el espacio de cuidado.
- Impacto: el revisor definido en D02 no puede operar su bandeja salvo que también sea administrador. El E2E siembra precisamente una revisora administradora y no cubre esta separación.
- Cierre: entrada humana basada en capacidades de cuidado, conservando las capacidades administrativas separadas. No resolverlo otorgando administración a los revisores ni clínica a los administradores.
- Pruebas requeridas: revisor sin administración entra a su bandeja; administrador sin concesión clínica no ve contenido; cuenta no relacionada recibe denegación.

### A06 — P1: truncamiento silencioso de la cola y paginación descartada

- Evidencia: `care-context-directory.service.ts:114`, `:158`, `:180`; `care-criteria.service.ts:223`; `apps/web/src/features/care/careClient.ts:202`, `:214`, `:235`; `CareWorkspace.tsx:117`, `:160`.
- Escenario: superar 200 contextos descubribles o 50 alarmas abiertas en uno. La cola omite el resto sin cursor ni aviso; 200 candidatos sin REVIEW_ALARMS pueden ocultar el siguiente que sí lo tiene. Una alarma roja antigua puede quedar detrás de 50 solicitudes recientes. Además la UI descarta los cursores de contextos, registros y alarmas; una página vacía filtrada con nextCursor se presenta como ausencia total de espacios.
- Impacto: recepción incompleta y alarmas inaccesibles en la interfaz. Incumple FR16/FR19 y el contrato de bandeja de todos los contextos autorizados.
- Cierre: paginación completa y coherente con conteos y filtros, navegación en UI y estado explícito de página/incompletitud. No suprimir alarmas por un límite técnico silencioso.
- Pruebas requeridas: más de 200 contextos, primera página sin autorizaciones efectivas y páginas posteriores válidas, más de 50 alarmas con roja antigua y navegación de historial de más de 20 registros.

### A07 — P2: evidencia causal no fija el valor efectivo evaluado

- Evidencia: `care-alarm-engine.ts:208`; `apps/api/src/care-alerts/care-alerts.service.ts:355`, `:373`, `:376`.
- Escenario: regla >=10, N=1; registrar 1; corregir a 11; registrar otro 1. La evaluación futura usa el 11 corregido, pero la evidencia solo enlaza observación/regla y el detalle muestra el 1 original. Cualquier enmienda se etiqueta como posterior aunque existiera antes de la alarma.
- Impacto: no se puede reconstruir con precisión qué versión efectiva provocó la evaluación; la explicación visual es falsa. FR11/AC08 y el contrato MP04 §6 exigen causalidad y valor efectivo.
- Cierre: fijar versión/secuencia efectiva usada en evidencia/evaluación y distinguir valor evaluado, original y correcciones posteriores; no reevaluar ni retirar evidencia al enmendar (D04.5).
- Pruebas requeridas: enmiendas anteriores y posteriores a alarma, múltiples reemplazos y lectura de evidencia histórica después de nuevas correcciones.

### A08 — P2: falta ajustar criterios existentes desde la interfaz

- Evidencia: `apps/web/src/features/care/careCriteriaViews.tsx:180`, `:217`; `careClient.ts:304`.
- Escenario: profesional necesita ajustar N o ventana del criterio existente. La API admite criterionId/validUntil, pero la UI solo crea otra identidad o retira; no crea nueva versión del mismo criterio ni permite fijar vigencia.
- Impacto: se dificulta el ajuste individual solicitado y crear otro criterio puede originar una alarma distinta mientras la anterior sigue abierta, perdiendo continuidad de FR06/FR12.
- Cierre: edición mediante nueva versión del criterio estable, selección de vigencia y explicación prospectiva. No mutar versiones anteriores.
- Pruebas requeridas: ajustar con episodio abierto, misma identidad y nueva versión, sin duplicación; retiro y vencimiento.

### A09 — P2: asignación a un responsable sin elegibilidad vigente

- Evidencia: `apps/api/src/care-alerts/care-alerts.service.ts:204`, `:398`.
- Escenario: deshabilitar una cuenta o revocar asignación/perfil/afiliación de un profesional, conservando su grant y competencia. reviewerHolds solo verifica esas dos últimas fuentes y todavía permite asignarle una alarma.
- Impacto: la bandeja señala como responsable a una persona que no puede abrir el caso. Contradice la exigencia de destinatario autorizado de MP02–MP03.
- Cierre: comprobar elegibilidad completa del destinatario dentro de la transacción, con orden de bloqueos consistente; no exigir una sesión interactiva al destinatario por el mero hecho de asignarlo.
- Pruebas requeridas: cuenta deshabilitada, asignación/afiliación/competencia/concesión revocadas o vencidas y revocación concurrente; destinatario válido conserva asignación.

### A10 — P3: mensaje de Hospital desactualizado

- Evidencia: `CareWorkspace.tsx:356`; `apps/web/src/features/care/care.test.tsx:226`.
- La interfaz afirma que la evaluación automática no está habilitada y una prueba lo exige, aunque MP04 está integrado. Corregir texto y expectativa para describir el mecanismo y sus límites reales.

## Implementado y límites de aceptación

Se identifican modelos persistentes, migraciones aditivas, bitácoras/enmiendas, solicitud manual, motor síncrono, concesiones/competencia, transiciones versionadas, auditoría y componentes compartidos. No se encontró un IDOR directo ni un bypass tenant/organización comprobable en las superficies examinadas. La autorización clínica revalida cuenta/sesión/vínculo y sus fuentes dentro de una transacción, con locks; ser gestor no habilita clínica.

Esto no equivale a ausencia garantizada de vulnerabilidades. A02 afecta la atribución entre pacientes autorizados, A09 la elegibilidad del responsable y A05/A06 el acceso operativo a revisión. No se realizó validación clínica ni autorización legal para datos reales.

AC01–AC04 y AC06–AC11 están implementados con cumplimiento parcial por los hallazgos anteriores; FR17/AC05 no pueden aceptarse con la inferencia de estabilidad actual. AC12 conserva ausencia de canales simulados, pero A10 deja un mensaje contradictorio. No marcar MP01–MP06 como aceptados por tener archivos o una baseline verde.

## Verificación independiente

- `npm.cmd run test --workspace @merdn/api -- src/care-context src/care-alerts src/care-criteria`: **66/66**.
- `node --test tests/testing/baseline-catalog.test.mjs tests/testing/run-baseline.test.mts tests/care/provision-care-manager.test.mjs`: **49/49**.
- `npm.cmd run build:api`: exit 0.
- ESLint focal sobre módulos de cuidado API/web y sus pruebas: exit 0.
- Escaneo de secretos: OK, 1381 archivos versionables.
- SDD: gate abierto, 0 errores/19 avisos históricos; validación estricta 0 errores/0 avisos. El gate advierte expresamente que no comprueba correspondencia entre código y spec.
- Baseline completa independiente: **34/34 etapas aprobadas, 2643 pruebas aprobadas, 0 fallidas y 0 omitidas**, run-id `codex055-audit`, exit 0. Incluye typecheck shared/API/web, web 1883/1883, OpenAPI 56/56 y las 28 etapas PostgreSQL (653 pruebas). Provision y cleanup aprobados; no se aplicó la migración a la base de aplicación.
- La revisión histórica de MP01 ya tiene correcciones verificadas en el árbol actual: su suite PostgreSQL pasa **28/28**, incluida la conservación de permisos emitidos antes de revocar al manager; el catálogo FORCE RLS pasa **6/6** y está incorporado a la baseline. Aquel resultado anterior 25/26 no es el resultado vigente.
- Navegador/axe: **no reejecutados por Codex**. La entrega de Claude reporta 5/5 y cero violaciones serias/críticas sobre cuatro espacios; su escenario solo usa un contexto y una revisora administradora. No demuestra A02/A05.

Los escenarios adversos A01–A10 se sustentan en trazado del código y del contrato; no se presentan como nuevas pruebas de integración ejecutadas. La batería actual no contiene todos esos escenarios y algunas expectativas fijan la conducta incorrecta.

## Recomendación de continuación

Corregir primero A01–A06; después A07–A10. Claude debe implementar las correcciones con el alcance y criterios anteriores, devolver evidencia de regresión adversa y someterse a nueva auditoría. Los ajustes no autorizan inventar reglas médicas ni cambiar D04.5. Mantener Git y despliegue sin cambios hasta autorización expresa y aceptación del PO.

Sin commit, push, PR, despliegue, migración a la base de aplicación ni modificación del prototipo por esta auditoría.
