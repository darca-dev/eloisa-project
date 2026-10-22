# 055 — Propuesta concreta para decisión del Product Owner

Estado: **RECOMENDACIONES APROBADAS** por el Product Owner el 2026-10-21, tras revisión con Claude y auditoría Codex. Se conserva el texto de las recomendaciones para trazabilidad. No contiene umbrales médicos; la implementación requiere contrato y gates por paquete.

Ya confirmado: bitácoras de cuidador y registros de visitador conectados; criterio individual definido por el visitador; frecuencia como parte del criterio; también hay alarma manual. La autorización para compartir documentación/código con Claude ya fue recibida.

## D01 — Custodia institucional

**Recomendación:** incorporar primero el contexto institucional compartido que falta, con identidad estable de organización dentro del tenant y custodia explícita por paciente/registro. Las cuentas humanas reciben concesiones para esa institución; una sesión o un tenant no implican acceso a todas sus instituciones. Probar dos instituciones dentro de un tenant y otro tenant. No renombrar reservas administrativas como si fueran organizaciones.

Alternativa: piloto técnicamente restringido a un custodio por tenant. Requiere restricción explícita, adaptar AC09 y conservar la ampliación institucional como deuda. Es más rápido, pero aplaza el aislamiento entre instituciones del mismo tenant. No se recomienda como arquitectura definitiva ni se adopta sin aprobación.

## D02 — Quién puede actuar

**Recomendación:**

- Paciente: entradas propias y solicitud manual propia, mediante experiencia aprobada exacta.
- Cuidador: autorización nueva y específica para contribuir bitácora/solicitar alarma del paciente delegado. VISITS_VIEW y HOME_CARE_COORDINATION existentes siguen con su alcance previo y no se convierten en permiso clínico.
- Visitador: observaciones y criterios solo del paciente al que esté asignado, con afiliación vigente y competencia clínica habilitada de forma expresa por la institución.
- Hospital: revisor como cuenta humana individual, con concesión específica de revisión/seguimiento, sin acceso clínico por ser administrador o gestor de agenda.
- Concesiones: administración institucional humana identificada registra y revoca permisos con evidencia de la decisión institucional. No acredita competencias por inferencia del perfil ni se concede a sí misma autoridad clínica automáticamente. La fuente de habilitación y evidencia exigible debe concretarse en MP01; sin ella se prueba con fixtures ficticias y no se habilita clínica real.

Todas las comprobaciones, escritura y auditoría deben usar la misma transacción y serializar frente a revocación.

## D03 — Qué define el visitador y cómo se clasifica

**Recomendación:** el visitador clínicamente competente define y valida las reglas de su paciente, sin segundo aprobador obligatorio por defecto. El formulario/observables requiere validación institucional antes de uso clínico.

Primer motor propuesto: un observable tipado por criterio (número/unidad, respuesta sí/no u opción de catálogo), una comparación estructurada y un número de coincidencias dentro de una ventana. El visitador aporta comparación, valores, repeticiones, ventana, vigencia y severidad; la aplicación no precarga ninguno como estándar médico. No ejecutar texto libre ni código como regla. Condiciones clínicas compuestas quedan para ampliación especificada.

Ratificar, tras validación clínica, ROJA/AMARILLA/ESTABLE como taxonomía del flujo objetivo. Una manual sin clasificación profesional se muestra como **pendiente de clasificación**, sin inventar rojo/amarillo/verde ni ocultarla a la revisión. No regla/no datos nunca equivale a verde.

Catálogo de motivos y campos clínicos reales: pendientes de aportar/validar por responsable clínico. El mecanismo se puede probar con observables y motivos expresamente sintéticos; esos fixtures no se activan como catálogo productivo.

Texto propuesto para recepción manual: «Solicitud registrada para revisión. Esto no confirma que un profesional ya la haya atendido ni sustituye los canales de urgencias». No inventar tiempos de atención, guardia ni entrega por canales no implementados.

## D04 — Repeticiones, fechas y correcciones

**Recomendación para cerrar el contrato temporal:**

1. Cada ocurrencia identificada cuenta una vez. Reintentos, versiones/enmiendas y otro registro que se vincule expresamente al mismo evento no aumentan el conteo. No inferir identidad de evento por tener el mismo síntoma/hora aproximada.
2. Conservar fecha de ocurrencia reportada y recepción del servidor. Propuesta: comparar la ocurrencia contra una ventana móvil que termina en la recepción actual, con ambos límites inclusivos. Una ocurrencia futura se rechaza; N y duración de ventana los define el visitador.
3. Contar solo eventos admitidos por la versión de regla activa, ocurridos después de su activación y dentro de su vigencia. La activación/cambio de regla es prospectiva: no reinterpreta automáticamente el historial anterior.
4. Una observación tardía dentro de esa ventana puede completar el criterio actual. Fuera de ella queda guardada y señalada para revisión, sin generar retroactivamente una alarma de una ventana pasada; la vía manual sigue disponible.
5. Una corrección conserva causalidad e informa discrepancia para revisión. No elimina ni cierra una alarma ya emitida; la política exacta de reevaluación de entradas corregidas se fija antes de MP04 y no cambia sin versionado.

Estas son propuestas de semántica, no conclusiones médicas. Deben ser aceptadas expresamente o sustituidas antes del motor. El riesgo a considerar es que una ventana por recepción y el tratamiento de registros tardíos afecten qué situaciones se detectan automáticamente; por eso no se eligen silenciosamente en código.

## D05 — Una alarma por episodio

**Recomendación:** un criterio conserva identidad estable entre versiones. Mientras su episodio siga abierto, nuevas coincidencias agregan evidencia a esa alarma; no crean otra por cada envío. Criterios o situaciones distintas conservan alarmas distintas.

Tras cierre, un evento nuevo permite un episodio nuevo enlazado al anterior; la evidencia consumida del episodio cerrado no vuelve a dispararlo. La regla debe cumplir nuevamente el conteo con eventos admisibles del nuevo episodio. Las manuales diferentes no se fusionan por compartir paciente; su vinculación a un episodio existente requiere referencia explícita y autorización.

## D06 — Seguimiento y uso permitido

**Recomendación:** usar estados NUEVA, EN_GESTION, RESUELTA y CERRADA, separados de severidad y asignación. Revisor/profesional autorizado reconoce y gestiona; el paciente/cuidador puede reportar que se resolvió sin borrar la alarma ni rebajar severidad. El revisor autorizado confirma resolución/cierre con motivo y versión. Una reapertura excepcional exige nueva transición atribuida; un evento posterior distinto sigue D05.

Todo el desarrollo y aceptación inicial con datos ficticios en entorno aislado. Antes de pacientes reales deben estar aprobados fundamento de tratamiento, retención, campos/motivos/mensajes, competencia de actores, reglas y política de vigilancia/contingencia con personal responsable. No asumir que una solicitud recibida ya fue vista.

## D07 — Entrega incremental

**Recomendación:** prerrequisitos de custodia/permisos → bitácoras persistentes → manual/bandeja Hospital → reglas individuales y alarmas automáticas → seguimiento y E2E. La entrega manual no sustituye la automática solicitada; permite verificar el circuito antes del motor.

Primer mecanismo síncrono y transaccional, con consulta interna paginada. Diferir worker/outbox, WhatsApp, notificaciones externas, Elí y escalamiento por reloj a sus paquetes aprobados, conservando el flujo futuro documentado. Autorizar expresamente este adelanto parcial de S06/S12 sin declarar sus demás dependencias terminadas.

## Gate posterior a la decisión

La aprobación de estas recomendaciones permite cerrar los contratos y preparar la primera tarea para Claude. No certifica datos clínicos reales ni sustituye el consentimiento SDD específico, la suficiencia de CLAUDE.md §8, las pruebas y auditoría. Cualquier opción no aceptada debe quedar resuelta antes del paquete que la utiliza. No se solicitan commit, push, PR ni despliegue en esta hoja.
