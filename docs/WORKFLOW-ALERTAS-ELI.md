# Flujo futuro de Semáforo de Alarmas, Elí, WhatsApp y escalamiento al Hospital

## 1. Estado y alcance de la decisión

**Estado:** decisión oficial de producto aprobada por el Product Owner para especificaciones e implementaciones futuras.

Este documento define el comportamiento objetivo del flujo de alarmas de cuidado que conecta el Semáforo de Alarmas, la asistencia no clínica de Elí, un futuro canal de WhatsApp y la operación del Hospital. Es referencia obligatoria para futuras Tasks de backend, datos, autorización, auditoría, integraciones, Elí, WhatsApp y experiencia Hospital.

Esta decisión no valida reglas clínicas, umbrales, diagnósticos ni recomendaciones médicas. Tampoco autoriza todavía una integración productiva con WhatsApp o una IA generativa. Cada implementación requerirá una Task Specification aprobada, controles de riesgo y pruebas acordes con su alcance.

## A. Objetivo

Permitir que MERDN reciba, priorice, siga, asigne, escale y cierre alarmas de pacientes de forma oportuna, trazable y segura, con capacidad inicial superior a 3.000 pacientes y crecimiento a miles adicionales, sin obligar al equipo Hospital a revisar una lista indiscriminada.

El flujo debe:

1. destacar primero el trabajo accionable;
2. hacer visibles de inmediato las posibles urgencias;
3. permitir asignar un profesional desde la alarma activa;
4. usar Elí y WhatsApp solo cuando la configuración y autorización lo permitan;
5. recopilar información estructurada sin convertir a Elí en un sistema diagnóstico;
6. conservar historia, responsabilidad y evidencia de cada cambio;
7. permitir que paciente o cuidador autorizado informen que la situación fue resuelta.

## B. Principios

1. **Urgencia sin espera artificial.** Una alarma roja o posible urgencia se presenta al Hospital inmediatamente. El contacto de Elí nunca bloquea ni retrasa su escalamiento.
2. **Trabajo priorizado, no listado masivo.** La entrada del Semáforo muestra indicadores agregados accionables; las listas se abren filtradas y paginadas al seleccionar un indicador.
3. **Separación de conceptos.** Severidad, estado de ciclo de vida, origen, estado de contacto, estado de escalamiento y asignación son dimensiones distintas.
4. **Configuración gobernada.** Ventanas, reglas de enrutamiento, plantillas y habilitación de canales se configuran por alcance autorizado y con versión; no se codifican como constantes de negocio.
5. **Intervención humana.** El Hospital conserva la capacidad y responsabilidad de revisar, asignar, atender, reclasificar y cerrar dentro de sus permisos.
6. **Mínimo privilegio y mínimo dato.** Cada actor, interfaz e integración recibe solo lo necesario para la finalidad autorizada.
7. **Trazabilidad inalterable para usuarios ordinarios.** Resolver o cerrar no elimina la alarma ni su historia.
8. **Idempotencia y tolerancia a fallos.** Reintentos de tareas o webhooks no deben duplicar alarmas, contactos, escalaciones ni transiciones.
9. **No inferencia clínica no validada.** Ningún texto libre, prototipo o salida de IA se convierte automáticamente en diagnóstico, orden médica o regla clínica.
10. **Accesibilidad.** Severidad y estado no se comunican solo mediante color; las operaciones deben ser utilizables con teclado, lector de pantalla y lenguaje claro.

## C. Actores y responsabilidades

| Actor | Responsabilidad en este flujo | Restricciones principales |
| --- | --- | --- |
| Paciente | Activar una alarma desde una interfaz autorizada, responder a Elí, consultar su situación y marcarla resuelta cuando corresponda | Solo sobre su propio contexto; no clasifica clínicamente ni asigna profesionales |
| Cuidador autorizado | Activar y seguir una alarma del paciente relacionado, responder dentro del alcance de su delegación y marcarla resuelta cuando corresponda | Relación, alcance, institución y vigencia deben verificarse en cada operación |
| Elí | Iniciar contacto configurado, verificar el contexto autorizado, explicar, hacer preguntas aprobadas, estructurar respuestas y facilitar cierre o transferencia | No diagnostica, prescribe, ordena, determina urgencias autónomamente ni demora atención |
| Coordinación Hospital | Vigilar bandejas, priorizar, asignar profesional, escalar, revisar seguimiento y gestionar excepciones | Acceso limitado por tenant, institución, programa, territorio, finalidad y permiso |
| Profesional de salud | Aceptar asignación, revisar información autorizada, atender y resolver profesionalmente | Requiere afiliación/credencial, asignación y finalidad vigentes; sus actos no se sustituyen por Elí |
| Administrador de configuración autorizado | Gestionar ventanas, rutas, plantillas, calendarios, canales y versiones aprobadas | No obtiene por ello acceso al contenido sensible de alarmas |
| Servicios backend/worker | Ejecutar transiciones, temporizadores, outbox, entrega, reintentos y auditoría | No confían en identificadores o permisos enviados por el cliente; operaciones idempotentes |
| Proveedor de WhatsApp | Transportar mensajes aprobados y devolver estados/webhooks | Procesador externo sujeto a contrato, minimización, seguridad y retención aprobados |

## D. Flujo completo futuro

### D.1 Activación

1. Paciente o cuidador usa una interfaz autorizada para activar la alarma.
2. El backend valida identidad, tenant, institución, relación paciente-cuidador, programa, consentimiento o base autorizante, y permiso de creación.
3. Se registra la alarma con paciente, actor activador, fecha/hora, motivo, origen/canal, severidad inicial autorizada, estado y versión de la regla o decisión que originó la clasificación.
4. La creación y su evento de auditoría se confirman de forma consistente; los efectos asíncronos se publican mediante outbox.
5. La alarma aparece en el indicador y bandeja que correspondan. Si es roja o posible urgencia, es visible al Hospital inmediatamente.

La severidad inicial solo podrá provenir de una selección explícita aprobada, de personal autorizado o de una regla previamente especificada, validada y versionada. Este documento no define esas reglas.

### D.2 Semáforo operativo Hospital

La vista inicial presenta al menos tres indicadores accionables:

- **Rojas recientes:** alarmas rojas activas, destacadas inmediatamente.
- **Amarillas que requieren seguimiento:** alarmas amarillas abiertas cuyo seguimiento está pendiente, próximo o vencido conforme a configuración.
- **Estables:** alarmas o situaciones activas clasificadas con severidad estable, sin ocultar vencimientos o excepciones.

Seleccionar un indicador abre una lista ya filtrada, paginada y con conteos coherentes. Dentro de cada bandeja, el orden operativo considera, como mínimo:

1. severidad;
2. antigüedad o vencimiento operativo;
3. estado;
4. ausencia o existencia de profesional asignado.

La lista permite filtros posteriores por paciente, municipio/zona, programa, profesional, fecha y estado. Los filtros y conteos siempre respetan el alcance autorizado; no deben revelar mediante agregados la existencia de registros fuera del tenant o institución permitidos.

### D.3 Contacto de Elí por WhatsApp

Cuando la política configurada, el canal habilitado y la autorización vigente lo permitan:

1. un evento de alarma solicita el contacto sin bloquear la transacción principal;
2. el worker evalúa elegibilidad, preferencias, destinatario autorizado, plantilla y datos mínimos;
3. el adaptador de WhatsApp envía el mensaje aprobado con clave de idempotencia;
4. se registran intentos, entrega, fallo, respuesta y correlación, sin copiar contenido sensible innecesario a logs;
5. Elí identifica de forma proporcionada al paciente o cuidador autorizado antes de exponer contexto;
6. Elí pregunta si necesita ayuda o tiene dudas y recopila respuestas estructuradas aprobadas;
7. Elí ayuda a comprender el flujo y ofrece orientación no médica autorizada;
8. las respuestas actualizan el seguimiento, pero no sustituyen evaluación profesional ni rebajan automáticamente una severidad urgente.

Si el canal falla, no hay consentimiento, no se logra verificar al destinatario o el usuario no responde, la alarma permanece visible y continúa por su ruta operativa. El fallo de WhatsApp nunca equivale a resolución.

### D.4 Seguimiento y escalamiento

- **Rojo / posible urgencia:** visibilidad inmediata en Hospital, posibilidad de asignación inmediata y escalamiento sin esperar respuesta de Elí. Los mensajes autorizados deben indicar que Elí no sustituye los canales de urgencia aplicables; el contenido exacto queda por aprobar.
- **Amarillo / seguimiento:** puede iniciar contacto y una ventana configurable. La referencia inicial de producto es una hora, pero el valor efectivo debe residir en configuración versionada, con alcance y vigencia. Si sigue abierta al vencer, se escala a la bandeja operativa del Hospital.
- **Estable:** sigue la política de seguimiento aprobada. No queda excluida de supervisión, vencimientos o escalamiento por excepciones.

El temporizador se calcula desde un evento definido y auditable. Reinicios, cambios de configuración, indisponibilidad del worker y reintentos no deben perder ni duplicar el escalamiento. Debe definirse en una Task futura qué evento inicia, pausa, reinicia o cancela cada plazo.

### D.5 Asignación y atención

1. Un usuario Hospital autorizado selecciona **Asignar profesional** desde la alarma activa, sin navegar a otro módulo.
2. El backend valida alcance institucional, permiso, disponibilidad o elegibilidad definida y conflicto de concurrencia.
3. La asignación conserva actor, profesional, fecha/hora, motivo, origen y, si corresponde, asignación previa.
4. El profesional acepta o inicia la atención según el futuro modelo operativo.
5. Reasignación, rechazo, falta de aceptación y desasignación se registran sin borrar historia.

### D.6 Resolución y cierre

Paciente, cuidador autorizado o profesional autorizado pueden resolver de acuerdo con su alcance. Resolver detiene efectos futuros solo cuando las reglas aprobadas lo indiquen y conserva toda la historia. El cierre administrativo posterior confirma que no quedan acciones abiertas; no elimina el registro.

## E. Matriz de severidad y escalamiento

| Severidad | Significado operativo | Visibilidad Hospital | Contacto de Elí | Plazo inicial | Escalamiento mínimo |
| --- | --- | --- | --- | --- | --- |
| Roja / posible urgencia | Requiere atención operativa inmediata; no constituye por sí sola diagnóstico | Inmediata y destacada | Puede acompañar si está autorizado; nunca bloquea | Sin espera previa | Inmediato; asignación disponible desde la alarma |
| Amarilla / seguimiento | Requiere verificación dentro de una ventana controlada | Visible desde su creación; destacada al aproximarse/vencer | Puede iniciar automáticamente si corresponde | Configurable; referencia inicial: 1 hora | A bandeja operativa si continúa sin resolverse al vencer |
| Estable | Sin señal operativa de urgencia bajo la clasificación aprobada | Visible en indicador/lista filtrada | Según configuración y autorización | Por definir/configurable | Según reglas aprobadas, vencimiento o cambio de situación |

La taxonomía definitiva de severidad, quién puede asignarla o modificarla y las reglas que la determinan requieren validación clínica y operativa independiente. Elí no decide autónomamente que una situación deja de ser urgente.

## F. Propuesta de estados y dimensiones

### F.1 Estado principal del ciclo de vida

Se propone una taxonomía principal pequeña y estable:

| Estado | Definición | Transiciones ordinarias |
| --- | --- | --- |
| `NUEVA` | Creada y aún no reconocida operativamente | `EN_GESTION`, `RESUELTA` |
| `EN_GESTION` | Existe seguimiento, escalamiento, asignación o atención activa | `RESUELTA` |
| `RESUELTA` | El actor autorizado declaró el resultado y no se esperan acciones activas ordinarias | `EN_GESTION` por reapertura; `CERRADA` |
| `CERRADA` | Cierre administrativo final conforme a política; permanece consultable y auditable | `EN_GESTION` solo mediante reapertura excepcional autorizada |

El modo de resolución se conserva aparte como `USUARIO`, `CUIDADOR`, `PROFESIONAL` u otro valor futuro aprobado. Así se evita multiplicar estados como `resuelta_usuario` y `resuelta_profesional` y se preserva la misma información de forma consultable.

### F.2 Dimensiones ortogonales

| Dimensión | Valores conceptuales iniciales | Propósito |
| --- | --- | --- |
| Severidad | `ROJA`, `AMARILLA`, `ESTABLE` | Prioridad operativa; no es estado de avance |
| Origen/canal | Paciente web/app, cuidador web/app, Hospital, integración u otro origen aprobado | Procedencia de la activación |
| Contacto Elí | `NO_APLICA`, `PENDIENTE`, `EN_CURSO`, `COMPLETADO`, `SIN_RESPUESTA`, `FALLIDO`, `CANCELADO` | Seguimiento del contacto sin controlar el ciclo de vida de la alarma |
| Escalamiento | `NO_REQUERIDO`, `PROGRAMADO`, `ESCALADO`, `RECONOCIDO` | Evidencia de ruta y temporización operativa |
| Asignación | `SIN_ASIGNAR`, `ASIGNADA`, `ACEPTADA`, `RECHAZADA`, `REASIGNACION_REQUERIDA`, `FINALIZADA` | Responsabilidad profesional sin confundirla con resolución |
| Atención | `NO_INICIADA`, `EN_ATENCION`, `FINALIZADA` | Progreso de la intervención profesional cuando aplique |

`contacto_elí`, `en_seguimiento`, `escalada`, `profesional_asignado` y `en_atención` no se recomiendan como estados principales porque pueden coexistir. Cada cambio de dimensión debe validarse mediante una máquina de estados o reglas de transición explícitas en la futura especificación.

## G. Eventos y auditoría

Como mínimo deben auditarse:

- alarma creada, reconocida, reclasificada, resuelta, cerrada y reabierta;
- cambio de severidad, con valor anterior/nuevo, motivo y autoridad o versión de regla;
- contacto de Elí solicitado, iniciado, completado, fallido, cancelado o sin respuesta;
- mensaje solicitado, aceptado por proveedor, entregado, fallido y respondido;
- escalamiento programado, vencido, ejecutado, reconocido, cancelado o reprogramado;
- profesional asignado, aceptación, rechazo, reasignación y finalización;
- acceso sensible, consulta de conversación y exportación;
- consentimiento/autorización verificado, revocado o no disponible;
- calificación de Elí creada o corregida conforme a política;
- cambio y publicación de configuraciones, plantillas o reglas.

Cada evento debe incluir, según aplique: identificador, tenant, organización, actor humano o servicio, acción, recurso, paciente referenciado de forma controlada, fecha/hora confiable, valores anterior/nuevo minimizados, motivo, resultado, origen, correlación/causación, versión de regla o configuración y contexto técnico seguro. Los usuarios ordinarios no pueden modificar ni borrar eventos históricos.

Logs operativos, estados del proveedor, transcriptos y auditoría son registros distintos. No se deben copiar mensajes completos ni datos clínicos a logs o eventos si basta una referencia protegida.

## H. Papel exacto de Elí

Elí puede:

- identificar de manera proporcionada al paciente o cuidador autorizado;
- preguntar si necesita ayuda o tiene dudas;
- formular preguntas aprobadas y recopilar respuestas estructuradas;
- explicar el proceso y ayudar a comprender la situación en lenguaje claro;
- ofrecer orientación no médica previamente aprobada y versionada;
- preguntar si la situación continúa abierta;
- apoyar el filtrado operativo mediante datos declarados, sin presentar inferencias como hechos clínicos;
- indicar cómo marcar **Situación resuelta**, confirmar la intención y ofrecer una calificación de su asistencia;
- facilitar transferencia o escalamiento humano.

Elí no puede:

- diagnosticar, prescribir, cambiar tratamientos ni emitir órdenes médicas;
- sustituir una valoración profesional;
- determinar autónomamente que no existe urgencia;
- cerrar una alarma sin confirmación atribuible a un actor autorizado o una regla futura expresamente aprobada;
- bloquear, rebajar o retrasar el escalamiento urgente;
- presentar contenido generado como instrucción clínica validada;
- revelar contexto antes de verificar identidad y autorización en la medida requerida.

Toda futura capacidad de IA exige evaluación de riesgo, contenido aprobado, control de versiones, supervisión humana, pruebas de seguridad, criterios de derivación y manejo seguro de incertidumbre. Para el primer alcance se prefiere orientación determinista y curada.

## I. Resolución, cierre y reapertura

Paciente o cuidador autorizado debe poder seleccionar **Situación resuelta**. Antes de confirmar, la interfaz o Elí muestra claramente el efecto y solicita confirmación. Se registra:

- actor y relación con el paciente;
- fecha/hora;
- motivo o categoría de resolución;
- estado y severidad anteriores;
- interacción previa con Elí;
- escalamiento ocurrido o pendiente;
- profesional asignado, si existió;
- configuración/regla vigente;
- correlación con acciones pendientes canceladas o conservadas.

Resolución y cierre son distintos. La resolución expresa el resultado de la situación; el cierre es la finalización administrativa conforme a política. Ninguno elimina la alarma. Una reapertura genera una nueva transición con actor, motivo y contexto, preservando el episodio anterior. Una Task futura debe decidir si una situación posterior crea una nueva alarma relacionada o reabre la existente.

## J. Calificación de Elí

Tras una resolución confirmada, Elí puede ofrecer una calificación opcional de su asistencia. Debe:

- almacenarse en un registro o dominio separado de la calificación de profesionales de salud;
- identificar la interacción de Elí, versión de contenido/modelo cuando aplique, canal, fecha y alcance autorizado;
- permitir una escala y comentario definidos posteriormente, con minimización y moderación de datos sensibles;
- no afectar la atención, prioridad, acceso o calificación del profesional;
- no interpretarse como validación clínica ni prueba de seguridad del sistema;
- limitar acceso y reportes según finalidad, preferiblemente de forma agregada.

## K. Requisitos de privacidad y seguridad

Las futuras Tasks deben incluir, como mínimo:

1. consentimiento, autorización o base aplicable para contacto, tratamiento y canal, con alcance, vigencia y revocación;
2. verificación de identidad y de la relación paciente-cuidador antes de revelar información;
3. autorización server-side por tenant, institución, programa, territorio, rol, asignación, relación, finalidad y sensibilidad;
4. minimización del contenido enviado a WhatsApp; mensajes iniciales neutros cuando sea posible;
5. cifrado en tránsito y reposo, gestión externa de secretos, rotación y verificación de firmas de webhooks;
6. protección contra IDOR, enumeración, suplantación, replay, duplicados, abuso, spam e inyección de instrucciones;
7. rate limits, idempotencia, correlación y manejo seguro de errores sin filtración;
8. políticas aprobadas de retención, acceso, rectificación, archivo y disposición para alarma, mensajes, transcriptos, adjuntos, auditoría y metadatos del proveedor;
9. evaluación contractual del proveedor, subencargados, residencia/transferencia de datos, disponibilidad, eliminación y respuesta a incidentes;
10. redacción de logs y monitoreo de accesos, fallos, colas, retrasos y posibles incidentes;
11. datos ficticios o desidentificados en desarrollo, prueba y demostración;
12. accesibilidad y alternativas de contacto para quien no pueda o no desee usar WhatsApp.

Una cuenta o número compartido, reciclado, perdido o comprometido debe tener un procedimiento de verificación y suspensión del canal. La revocación impide contactos futuros cuando corresponda, pero no borra evidencia histórica que deba conservarse.

## L. Datos mínimos que deberá almacenar el backend

### Alarma

- identificador estable, tenant e institución propietaria/responsable;
- paciente y contexto de programa, municipio/zona o territorio cuando corresponda;
- actor activador, tipo de actor, origen, canal y fecha/hora;
- motivo estructurado y texto libre solo si está autorizado;
- severidad, estado principal y fechas relevantes;
- procedencia, versión de regla/configuración y clasificación de sensibilidad;
- responsable operativo y referencias a escalamiento, asignación y resolución;
- control de versión/concurrencia y correlación.

### Historial y transiciones

- dimensión modificada, valor anterior/nuevo, actor, fecha/hora, motivo y resultado;
- identidad de servicio cuando la acción sea automática;
- regla/configuración aplicada y relación de causación;
- referencias minimizadas a evidencia o interacción.

### Contacto e integración

- destinatario mediante referencia protegida; canal, autorización verificada y plantilla/versiones;
- estado de conversación/contacto, intentos, timestamps, proveedor y referencias externas no secretas;
- estados de entrega, errores normalizados, próximo reintento e idempotency key;
- respuestas estructuradas y transcriptos solo en la medida aprobada, separados de logs;
- consentimiento/preferencia vigente y prueba de la verificación realizada.

### Escalamiento, asignación y resolución

- plazo calculado, zona horaria, evento base, fecha objetivo y política versionada;
- escalamiento, bandeja/destino, ejecución, reconocimiento y excepciones;
- profesional, asignador, aceptación, reasignaciones y fechas;
- resolutor, tipo/motivo, fecha, confirmación, cierre y reapertura;
- calificación de Elí en entidad separada.

No se almacenan secretos del proveedor, credenciales ni información clínica innecesaria en registros de negocio, URLs, logs o auditoría ordinaria.

## M. Requisitos futuros de WhatsApp

Antes de habilitar el canal deben definirse y aprobarse:

- proveedor y modalidad oficial, contrato, subencargados, países de tratamiento y responsabilidades;
- número/remitente verificado, propiedad de la cuenta y separación por entorno;
- plantillas aprobadas, idioma, variables permitidas y proceso de versionado;
- opt-in/opt-out, preferencias, horarios, quiet hours y alternativa de canal;
- mecanismo de verificación del destinatario y tratamiento de números compartidos o reciclados;
- límites de datos y adjuntos; por defecto no enviar diagnósticos, medicamentos ni detalles clínicos innecesarios;
- firma y anti-replay de webhooks, allowlisting cuando aplique y secretos fuera del repositorio;
- contrato de estados, deduplicación, orden de eventos, reintentos, backoff y dead-letter/reconciliación;
- indisponibilidad, degradación, contingencia y alertamiento operacional;
- costos, límites, capacidad y pruebas de carga para miles de pacientes;
- retención, exportación, supresión gobernada y evidencia de entrega;
- pruebas en sandbox con datos ficticios antes de cualquier piloto controlado.

La integración debe implementarse detrás de un puerto/adaptador; el proveedor no escribe directamente en tablas de dominio. La solicitud de envío debe nacer de outbox transaccional y procesarse de forma idempotente.

## N. Criterios de aceptación para una futura implementación

Una futura implementación solo podrá considerarse candidata a aceptación si demuestra, al menos, que:

1. el dashboard no carga una lista masiva por defecto y presenta los tres indicadores con conteos autorizados;
2. seleccionar un indicador abre la lista filtrada, paginada y ordenada por los criterios aprobados;
3. los filtros por paciente, municipio/zona, programa, profesional, fecha y estado funcionan sin fuga entre tenants o instituciones;
4. una alarma roja aparece inmediatamente en Hospital y ningún contacto, fallo o espera de Elí retrasa su escalamiento;
5. una alarma amarilla abierta se escala al vencer la ventana configurable; cambiar la ventana no exige cambio de código y conserva versión;
6. Hospital puede asignar un profesional desde la alarma y concurrencias/reasignaciones quedan controladas y auditadas;
7. paciente y cuidador solo pueden activar, consultar o resolver dentro de una relación vigente y autorizada;
8. resolver o cerrar conserva historial, actor, fecha, motivo, interacción con Elí, escalamiento y asignación;
9. Elí se limita al contenido y preguntas aprobados, permite transferencia humana y no emite diagnósticos, órdenes ni recomendaciones clínicas no autorizadas;
10. WhatsApp recibe solo datos mínimos, valida elegibilidad/autorización y registra entrega/fallo sin exponer contenido sensible en logs;
11. reintentos, webhooks duplicados, eventos desordenados y reinicios no duplican contactos, alarmas, asignaciones ni escalaciones;
12. la calificación de Elí se almacena separada de cualquier calificación profesional;
13. todas las transiciones materiales producen auditoría protegida y correlacionable;
14. se cubren errores de proveedor, usuario no verificado, sin respuesta, autorización revocada, profesional no disponible y worker indisponible;
15. la UI comunica severidad además de color y cumple teclado, foco, semántica, lector de pantalla, contraste y mensajes claros;
16. pruebas con al menos dos tenants ficticios demuestran aislamiento en API, consultas, conteos, jobs, integración y auditoría;
17. pruebas de unidad, integración con PostgreSQL/RLS, permisos, contrato de adaptador, seguridad, accesibilidad, E2E y carga pasan conforme a la Task aprobada;
18. existen observabilidad, alertas operativas, reconciliación y procedimiento de contingencia sin usar logs como sustituto de auditoría.

## O. Funcionalidades expresamente no implementadas hoy

Actualmente **H-03 es una interfaz visual de prototipo/referencia**. Este documento no afirma ni demuestra implementación productiva.

A la fecha de esta decisión no se debe afirmar que existen:

- automatización de WhatsApp;
- proveedor de WhatsApp integrado;
- motor productivo de alarmas;
- IA de Elí conectada al flujo;
- temporizadores o ventanas automáticas;
- escalamiento real al Hospital;
- backend o API de este flujo;
- persistencia productiva de alarmas, conversaciones o calificaciones;
- asignación real de profesionales;
- reglas clínicas, umbrales o clasificación automática validados;
- cierre, reapertura, auditoría o notificaciones productivas de este flujo.

## Decisiones futuras que requieren Product Owner y validación especializada

1. Definición clínica y operativa de severidades, criterios, autoridad para reclasificar y mensajes de urgencia.
2. Evento exacto que inicia cada plazo; pausas, horarios, calendarios, vencimientos y comportamiento fuera de horario.
3. Reglas de resolución, cierre, reapertura y cuándo crear una alarma nueva relacionada.
4. Roles exactos y matriz de permisos para crear, ver, asignar, reclasificar, escalar, resolver, cerrar, reabrir y exportar.
5. Propiedad institucional, enrutamiento entre instituciones/programas y responsabilidad de atención.
6. Proveedor WhatsApp, base autorizante, opt-in/opt-out, identidad, contenido, retención, residencia y contrato.
7. Alcance técnico de Elí: determinista versus IA, modelo, datos permitidos, retención, evaluación, supervisión y fallback humano.
8. Preguntas estructuradas, orientación no médica y plantillas aprobadas por idioma y accesibilidad.
9. Escala, texto libre, anonimato y retención de la calificación de Elí.
10. SLA/SLO, capacidad, recuperación, contingencia y responsables operativos para más de 3.000 pacientes.
11. Políticas exactas de retención y disposición por tipo de dato y obligación aplicable.
12. Alcance del primer slice/piloto, institución participante, datos permitidos y criterios de suspensión segura.
