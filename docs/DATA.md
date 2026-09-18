# MERDN — Modelo conceptual de información

## 1. Estado, propósito y límites

Este documento define el modelo conceptual de información de MERDN antes de seleccionar una tecnología o un modelo físico de persistencia. Es autoritativo junto con `AGENTS.md`, `CLAUDE.md`, `docs/PRODUCT.md`, `docs/MODULES.md` y `docs/ROLES.md`.

Este documento:

- define dominios, conceptos, propiedad, sensibilidad, procedencia, relaciones, cardinalidades, acceso, vigencia, archivo y alcance MVP;
- no prescribe tablas, colecciones, claves físicas, SQL, motor de base de datos, almacenamiento de archivos ni topología de despliegue;
- no convierte automáticamente cada concepto funcional en una entidad física independiente;
- no diseña una Historia Clínica Electrónica, contabilidad oficial, calificación oficial FURAG/MIPG, evaluación oficial ADRES ni procesamiento productivo de pagos;
- no inventa datos clínicos, fórmulas, periodos legales, fuentes oficiales, interpretaciones jurídicas ni reglas comerciales.

Convenciones:

- **APROBADO:** decisión establecida por el Product Owner o por los documentos autoritativos.
- **RECOMENDADO:** decisión conceptual propuesta para aprobación antes del diseño físico.
- **POR DEFINIR:** decisión que no puede ser inferida durante la implementación.
- **MVP ACTIVE DATA:** información necesaria para ejecutar el primer vertical slice de extremo a extremo.
- **MVP STRUCTURAL DATA:** estructura mínima que preserva una capacidad estratégica y permite gestión controlada, manual, documental o configurada, aunque su automatización no esté activa.
- **FUTURE:** concepto preservado, pero no requerido para operar el primer vertical slice.

### 1.1 Decisiones de datos aprobadas por el Product Owner

Las siguientes decisiones son **APROBADAS** y deben gobernar la arquitectura y el posterior diseño físico:

1. MERDN utiliza un tenant lógico por cliente o despliegue, con aislamiento de datos entre tenants.
2. Existe una persona única dentro de cada tenant, con múltiples perfiles posibles.
3. Toda operación institucional usa tenant, organización activa y programa cuando aplique.
4. La autorización se determina mediante rol, institución, relación, asignación, finalidad y vigencia, además de las restricciones aplicables al recurso y su sensibilidad.
5. MERDN almacena sus datos operativos propios; la información clínica formal proviene de manera autorizada del hospital y conserva procedencia.
6. Alcaldía accede por defecto a información agregada. El acceso nominal exige autorización y finalidad explícitas y auditoría.
7. MERDN registra presupuesto, asignación, gasto, soporte, proveedor, ejecución y fuente del recurso sin convertirse en contabilidad oficial.
8. El Hub normativo es genérico y extensible y soporta la cadena conceptual `Entidad/Marco → Norma → Requisito → Responsable → Indicador → Evidencia → Resultado/Brecha`.
9. La auditoría es conceptualmente append-only: los usuarios normales no pueden alterar ni borrar eventos históricos.
10. Las evidencias conservan origen, autor, fecha, versión, institución, relaciones y trazabilidad.

## 2. Principios rectores

1. **APROBADO — Persona única por tenant, participaciones múltiples.** Una persona no se duplica dentro del tenant por ser paciente, cuidadora, profesional o trabajadora institucional. Cuenta, perfil, rol, cargo, afiliación, relación, asignación y consentimiento son conceptos distintos.
2. **APROBADO — Contexto explícito.** Toda operación institucional utiliza tenant, organización activa y programa cuando aplique. Los registros relevantes conservan además, cuando corresponda, municipio, territorio, finalidad y contexto de creación.
3. **Separación de dominios.** Identidad, clínica autorizada, operación de cuidado, institución, finanzas, comercio hospitalario, regulación, evidencia, formación, indicadores y auditoría permanecen separados aunque se relacionen.
4. **APROBADO — Autorización contextual y denegación por defecto.** El acceso depende de acción, rol, institución, relación, asignación, finalidad y vigencia, junto con tenant, municipio, territorio, programa, autorización o consentimiento y sensibilidad cuando apliquen.
5. **Procedencia obligatoria.** Todo dato material conserva origen y no cambia silenciosamente de categoría de procedencia.
6. **Propiedad no equivale a acceso.** La institución responsable de un registro no obtiene por ello acceso universal a todos los datos relacionados.
7. **APROBADO — Alcaldía agregada por defecto.** El acceso nominal solo existe con autorización, finalidad explícita y auditoría. No se presume acceso clínico individual.
8. **Finanzas sin clínica.** Los datos financieros usan las referencias mínimas necesarias y no conceden acceso a información clínica.
9. **APROBADO — Historia y auditoría protegidas.** Revocación, corrección, cierre o baja impiden usos futuros cuando corresponda, pero no borran autoría, procedencia o evidencia. Los eventos de auditoría son conceptualmente append-only y no pueden ser alterados ni borrados por usuarios normales.
10. **Oficialidad explícita.** Un dato interno, calculado, controlado o demostrativo nunca se presenta como determinación oficial externa.
11. **Datos ficticios.** Ejemplos, pruebas y demostraciones usan únicamente personas ficticias o datos debidamente desidentificados.
12. **Minimización.** Cada dominio almacena y expone solo los atributos necesarios para la finalidad aprobada.
13. **APROBADO — Separación clínica.** MERDN almacena datos operativos propios. La información clínica formal procede autorizadamente del hospital, mantiene su procedencia y no es sobrescrita por registros operativos de MERDN.
14. **APROBADO — Trazabilidad financiera sin contabilidad oficial.** MERDN registra fuente del recurso, presupuesto, asignación, gasto, soporte, proveedor y ejecución, preservando sus relaciones y procedencia sin asumir funciones de contabilidad oficial.
15. **APROBADO — Evidencia trazable.** Toda evidencia conserva origen, autor, fecha, versión, institución, relaciones y trazabilidad.

## 3. Clasificación conceptual de sensibilidad

Un registro puede tener una clase primaria y marcas adicionales. La clasificación efectiva será la más restrictiva aplicable a su contenido, relaciones y finalidad.

| Clase | Uso conceptual | Ejemplos | Regla mínima |
| --- | --- | --- | --- |
| `PUBLIC` | Información aprobada para divulgación pública | Catálogo público de servicios; referencia pública de una norma | Publicación y versión controladas |
| `INTERNAL` | Operación ordinaria no pública de una institución | Catálogos internos, capacidad agregada | Institución y finalidad autorizadas |
| `CONFIDENTIAL` | Información de negocio o institucional restringida | Contratos, configuraciones, borradores de informe | Acceso por función y necesidad |
| `SENSITIVE_PERSONAL` | Datos personales sensibles o de alto riesgo | Identidad, contacto, ubicación exacta, relaciones personales | Acceso nominal explícito, minimización y auditoría |
| `CLINICAL` | Información clínica autorizada proveniente del hospital | Diagnóstico, alergia, medicamento, indicación | Fuente hospitalaria, relación/asignación y acceso auditado |
| `FINANCIAL` | Recursos, obligaciones, gastos, cobros o pagos | Presupuesto, factura, referencia de pago | Institución, periodo y separación de funciones |
| `REGULATORY` | Interpretaciones, obligaciones y evidencia regulatoria | Requisito, aplicabilidad, brecha | Fuente, versión, autoridad y estado explícitos |
| `AUDIT_RESTRICTED` | Trazas, accesos y contexto técnico protegido | Evento de auditoría, exportación sensible | Acceso especializado; no modificación ordinaria |

**RECOMENDADO:** añadir marcas conceptuales para `identificable`, `agregado`, `externo_oficial`, `secreto_técnico` y `sujeto_a_reidentificación`. Una referencia a credenciales o secretos nunca contiene el secreto en datos de negocio o auditoría ordinaria.

## 4. Procedencia y linaje

### 4.1 Categorías obligatorias de procedencia

| Categoría | Significado | Ejemplo ficticio o abstracto |
| --- | --- | --- |
| `USER_DECLARED` | Declarado directamente por una persona | Preferencia de contacto declarada por “Ana Ejemplo” |
| `PROFESSIONAL_RECORDED` | Registrado por un profesional dentro de una asignación | Resultado operativo de una visita, no una prescripción externa |
| `HOSPITAL_IMPORTED` | Suministrado por fuente hospitalaria autorizada | Resumen clínico de solo lectura |
| `INSTITUTIONAL` | Creado o aprobado por una institución | Programa, responsable o evidencia institucional |
| `FINANCIAL_SOURCE` | Procedente de gestión o fuente financiera identificada | Asignación o gasto controlado |
| `EXTERNAL_OFFICIAL` | Obtenido de fuente externa autorizada que se identifica como oficial | Valor oficial importado con referencia y periodo |
| `MERDN_CALCULATED` | Calculado por MERDN con definición y versión conocidas | Porcentaje de ejecución según fórmula aprobada |
| `DEMONSTRATION` | Dato ficticio o controlado para demostración | Presupuesto ilustrativo no oficial |

### 4.2 Sobre de procedencia

Todo dato externo y todo resultado material debe poder asociarse con:

1. categoría de procedencia;
2. fuente o sistema de origen;
3. institución de origen y, si difiere, institución responsable en MERDN;
4. identificador o referencia del registro fuente cuando esté permitido;
5. fecha original del dato o documento;
6. fecha de recepción, declaración, registro o cálculo;
7. método: usuario, profesional, carga manual controlada, archivo, integración o cálculo;
8. versión de fuente, documento, mapeo, fórmula o regla cuando corresponda;
9. ejecución de importación o cálculo y estado de validación/reconciliación;
10. actor humano o técnico que incorporó el dato;
11. limitaciones, vigencia y grado de oficialidad;
12. relaciones de linaje con insumos, resultados derivados y correcciones.

Reglas:

- El valor recibido se conserva separado de correcciones, interpretaciones y cálculos de MERDN.
- Una corrección no sobrescribe silenciosamente el original; crea historia y motivo.
- Una importación no implica validación, oficialidad, actualidad ni autorización de acceso.
- Los agregados conservan la definición de población, filtros, periodo, fórmula y referencias a insumos o ejecución.
- Los datos demostrativos se etiquetan en origen y no pueden mezclarse en indicadores o reportes productivos.

## 5. Multi-tenancy, propiedad y aislamiento

### 5.1 Frontera de tenant aprobada

**APROBADO:** MERDN utiliza un tenant lógico por cliente o despliegue. Todo dato de negocio pertenece a un tenant y queda aislado de los demás. Una relación interinstitucional, integración, rol de plataforma o vista agregada no autoriza por sí sola acceso entre tenants. Cualquier intercambio entre tenants debe tratarse como intercambio externo gobernado, con finalidad, autorización, procedencia y auditoría explícitas.

La persona es única dentro del tenant. Esta decisión no presupone una identidad global compartida entre tenants ni autoriza reconciliación de personas entre clientes o despliegues.

### 5.2 Contexto común aprobado

Cada registro contextual debe poder conocer, según aplique:

- tenant lógico;
- institución propietaria o responsable;
- municipio y territorio aplicables;
- unidad organizativa o sede;
- programa, servicio, marco, periodo o caso;
- finalidad y contexto activo;
- actor creador y procedencia;
- sensibilidad y estado de vigencia.

No todos los campos aplican a todos los conceptos. Su ausencia debe ser intencional, no consecuencia de pérdida de contexto.

Toda operación institucional utiliza obligatoriamente tenant y organización activa; utiliza programa cuando el recurso o flujo esté programáticamente delimitado.

### 5.3 Clases de aislamiento

| Clase | Conceptos | Regla |
| --- | --- | --- |
| Global gobernado | Tipos de institución, referencia de clases de sensibilidad, tipos base de fuente y marcos públicos de referencia | No contiene datos de negocio de un tenant; cambios versionados y administrados |
| Maestro humano protegido por tenant | Persona | Es única dentro del tenant y no pertenece en exclusiva a una institución; el acceso nace de afiliación, relación, asignación, programa o finalidad |
| Institucional aislado | Institución, unidad, sede, programa, agenda, finanzas, contratos, evidencia, Hub, comercio | Toda lectura/escritura se limita a institución y relaciones interinstitucionales autorizadas |
| Relacional contextual | Afiliación, relación paciente-cuidador, consentimiento, asignación, inscripción | Cada vínculo posee institución, programa, alcance, estado y vigencia propios |
| Territorial | Municipio, territorio, población agregada, indicadores municipales | Municipio y finalidad obligatorios; nominalidad restringida |
| Fuente externa contextualizada | Clínica importada, ADRES, FURAG/MIPG, SENA y otras fuentes | Fuente original más institución receptora, autorización, periodo, versión y limitaciones |
| Auditoría segregada | Eventos y accesos sensibles | Contexto institucional y dominio; acceso de auditoría no equivale a acceso al objeto original |

Una vista multiinstitucional dentro del mismo tenant requiere permiso específico, finalidad, nivel de agregación y reglas contra reidentificación. No habilita escritura cruzada por defecto. Una vista entre tenants queda prohibida salvo intercambio externo expresamente aprobado y gobernado.

## 6. Mapa conceptual de alto nivel

```text
Persona ──< Perfil
   ├──────< Cuenta
   ├──────< Afiliación >──── Institución ──< Unidad/Sede
   ├──────< Relación autorizada >──── Persona
   ├──────< Asignación profesional >──── Programa/Servicio/Paciente
   └──────< Inscripción en programa >──── Programa

Municipio ──< Institución ──< Programa >──< Fuente de recursos
Programa ──< Agenda/Cita ──0..1── Prestación/Visita/Consulta virtual ──< Evidencia
Programa ──< Presupuesto ──< Asignación financiera ──< Gasto ──< Evidencia

Marco/Entidad ──< Norma ──< Requisito >──< Evidencia
                                  └──────>──< Indicador ──< Resultado por periodo

Servicio ──< Cita
Plan/Membresía >──< Servicio
Prestación documentada ──0..*── Cobro ──0..*── Referencia de pago/ingreso

Todos los dominios materiales ──< Evento de auditoría
Todos los datos externos/derivados ──< Sobre de procedencia y linaje
```

## 7. Catálogo de entidades conceptuales

Las entidades siguientes son agregados conceptuales. Los conceptos incluidos entre paréntesis son candidatos evaluados que pueden terminar como atributos, componentes, catálogos o entidades físicas separadas según el diseño posterior.

Abreviaturas de acceso: `SELF` persona sobre sus datos autorizados; `R1`–`R15` roles técnicos de `docs/ROLES.md`; `SYSTEM` proceso técnico autorizado. “C/M/V” significa crear, modificar y ver. Toda acción continúa sujeta al contexto y a la denegación por defecto.

### 7.1 Identidad y acceso

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Persona | Maestro único dentro del tenant: identidad mínima, contacto, demografía y referencias territoriales permitidas; múltiples perfiles sin duplicar a la persona | La persona es titular; custodia contextual del tenant/institución; `SENSITIVE_PERSONAL`; declarada, verificada o externa autorizada | Tenant 1 → 0..* personas únicas; 1 persona → 0..* cuentas, perfiles, afiliaciones, relaciones, consentimientos e inscripciones | C: SELF/R6 autorizados; M: SELF campos permitidos/R6; V: SELF o contexto autorizado | Auditar alta, cambio, consulta sensible, exportación, verificación y fusión dentro del tenant; vigencia de datos; no borrado destructivo con relaciones; corrección/anonimización POR DEFINIR; depende de procedencia | ACTIVE |
| Cuenta | Medio de autenticación y ciclo de acceso; estado, métodos/referencias de autenticación, recuperación | Persona/plataforma; `CONFIDENTIAL`; registro, invitación o identidad externa | Persona 1 → 0..* cuentas (cardinalidad definitiva bloqueante); cuenta → sesiones/verificaciones | C: SELF/R13/R14; M: SELF/R13/R14 según alcance; V: titular y administración limitada | Auditar registro, acceso, fallo, recuperación, suspensión; activa/suspendida/cerrada; archivo preserva autoría; depende de Persona | ACTIVE |
| Perfil | Participación funcional: paciente, cuidador, profesional u otra; estado y atributos propios | Persona con custodia institucional; `SENSITIVE_PERSONAL`; institucional/declarada/verificada | Persona 1 → 0..* perfiles; perfil no concede permisos | C/M: SELF o R6/R13 autorizados; V: contexto permitido | Auditar alta, verificación, activación y cierre; vigencia independiente; archivar, no duplicar Persona; depende de Persona | ACTIVE |
| Rol y permiso | Rol técnico, permiso dominio/recurso/acción, condiciones y versión de política | Plataforma/institución delegada; `CONFIDENTIAL`; configuración gobernada | Rol >──< permisos; afiliación/contexto >──< roles; decisión usa condiciones | C/M: R13/R14 con separación; V: administradores/auditores y usuario sobre propios accesos | Auditar concesión, revocación, política y denegaciones sensibles; vigencia/versionado; nunca borrar historia; depende de afiliación/contexto | ACTIVE |
| Cargo | Denominación laboral, dependencia y vigencia; no concede acceso | Institución; `INTERNAL`; institucional | Afiliación 0..1 cargo vigente por contexto, con historia; cargo puede sugerir 0..* roles | C/M: R13; V: persona y gestión institucional | Auditar cambios; versionar catálogo; archivar; depende de Institución/Afiliación | STRUCTURAL |
| Afiliación institucional | Vínculo persona-institución: cargo, unidad, estado, vigencia y base | Institución; `SENSITIVE_PERSONAL`; institucional/verificada | Persona >──< institución; una persona puede tener múltiples afiliaciones simultáneas | C/M: R13 con aprobación; V: persona y roles institucionales autorizados | Auditar solicitud, aprobación, suspensión, fin; expiración impide operar pero conserva autoría; depende de Persona/Institución | ACTIVE |
| Sesión y contexto activo | Sesión, institución, municipio, programa, función, finalidad y eventos de contexto | Plataforma; `AUDIT_RESTRICTED`; sistema | Cuenta 1 → 0..* sesiones; sesión 1 → 1 contexto activo a la vez, con cambios históricos | C/M: SYSTEM/usuario para selección autorizada; V: titular y R14/R15 limitado | Auditar accesos privilegiados y cambios sensibles; expiración POR DEFINIR; retención POR DEFINIR; depende de Cuenta/Afiliación | ACTIVE |
| Preferencia | Idioma, accesibilidad, comunicación y opciones permitidas | Persona; `SENSITIVE_PERSONAL` o `INTERNAL`; usuario/institución | Persona/cuenta 1 → 0..* preferencias versionables | C/M/V: SELF; administración solo cuando esté autorizada | Auditar cambios con impacto de privacidad/comunicación; revocable; eliminación controlada POR DEFINIR | ACTIVE |
| Verificación | Aserción verificable sobre identidad, contacto, credencial, documento o certificado; método, estado, verificador | Institución/autoridad verificadora; `CONFIDENTIAL` y clase del objeto; fuente de verificación | Objeto 1 → 0..* verificaciones; una verificación no sustituye el objeto | C/M: verificador autorizado R6/R9/R13; V: titular y roles necesarios | Auditar solicitud, aprobación, rechazo, expiración; conservar historia; depende de fuente/evidencia | ACTIVE |

### 7.2 Instituciones, territorio y programas

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Territorio y municipio | Jerarquía territorial, cobertura, referencias geográficas y vigencia; incluye entidad territorial | Autoridad de catálogo/plataforma; `PUBLIC`/`INTERNAL`; fuente territorial autorizada | Municipio 1 → 0..* territorios e instituciones; territorio puede servir a 0..* programas | C/M: R14 o custodio autorizado; V: roles institucionales | Auditar fuente, límites y versión; no sobrescribir periodos históricos; archivar versiones | ACTIVE |
| Institución | Organización genérica con tipo: Alcaldía, secretaría, Hospital, ESE, IPS, proveedor u otra entidad | La propia institución/plataforma; `INTERNAL` con atributos públicos; institucional/oficial autorizada | Municipio 1 → 0..* instituciones; institución → unidades, sedes, afiliaciones, programas | C/M: R14/R13 delegados; V: según catálogo/contexto | Auditar alta, tipo, responsable, acuerdos y estado; cierre preserva registros; depende de Territorio | ACTIVE |
| Unidad organizativa y sede | Estructura interna, ubicación general, cobertura, capacidad y vigencia | Institución; `INTERNAL`; institucional | Institución 1 → 0..* unidades/sedes; unidad puede jerarquizarse y participar en programas | C/M: R13; V: personal autorizado | Auditar cambios estructurales/capacidad; versionar y archivar; depende de Institución | ACTIVE |
| Relación interinstitucional | Acuerdo autorizado de cooperación o intercambio: instituciones, finalidad, alcance, datos, vigencia | Instituciones participantes; `CONFIDENTIAL`; institucional/contractual | Institución >──< institución; cada vínculo independiente | C/M: autoridades institucionales; V: R11/R13 y responsables | Auditar aprobación, cambio, suspensión y revocación; conservar acuerdo e historia; depende de Evidencia | STRUCTURAL |
| Programa | Contexto público, institucional, asistencial o comercial: dueño, tipo, territorio, población, servicios, capacidad, estado y versión | Institución responsable; `INTERNAL`/`REGULATORY`; institucional | Institución 1 → 0..* programas; programa → 0..* beneficiarios, servicios, fuentes, actividades | C/M: R7 autorizados; V: roles por contexto y agregados municipales | Auditar creación, versión, capacidad, transferencia y cierre; vigencia; archivo preserva inscripciones; depende de Institución/Territorio | ACTIVE |
| Inscripción en programa y caso | Participación de persona/beneficiario: elegibilidad controlada, estado, responsable, entrada/salida y procedencia | Programa/institución; `SENSITIVE_PERSONAL`; institucional/fuente autorizada | Programa >──< personas; persona 1 → 0..* inscripciones; inscripción 0..1 caso coordinado | C/M: R6/R7; V: persona, relación/profesional y gestión autorizada | Auditar decisión, espera, traslado, suspensión y egreso; no borrar historia; depende de Persona/Programa | ACTIVE |
| Población y clasificación | Categoría, pertenencia, fuente, periodo, calidad, territorio y agregación; no duplica Persona | Institución/programa o fuente autorizada; nominal `SENSITIVE_PERSONAL`, agregado `INTERNAL` | Persona >──< categorías; categoría → 0..* programas/indicadores | C/M: R7/custodio; V nominal restringida, municipal agregada | Auditar clasificación, fuente, deduplicación, drill-down/exportación; vigencia por periodo; anonimización POR DEFINIR | ACTIVE |

### 7.3 Relaciones, autorización y asignaciones

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Relación entre personas | Vínculo paciente-cuidador, representación, contacto u otro tipo; partes, institución, programa, alcance, fundamento, estado, vigencia y evidencia | Personas e institución validadora; `SENSITIVE_PERSONAL`; declarada/institucional | Paciente >──< cuidador; paciente 1 → 0..* cuidadores y cuidador 1 → 0..* pacientes; cada vínculo independiente | C: SELF/R6; M: validador autorizado; V: partes y roles necesarios | Auditar solicitud, validación, alcance, suspensión, renovación, revocación; revocar futuro sin borrar historia; depende de Persona/Evidencia | ACTIVE |
| Consentimiento o autorización | Finalidad, categorías de datos/acciones, otorgante, receptor, base, evidencia, versión, vigencia y revocación | Titular/autoridad competente; `SENSITIVE_PERSONAL`; declarada/institucional | Persona/relación 1 → 0..* consentimientos; puede cubrir objetos delimitados, nunca acceso universal | C: titular/representante autorizado; M: solo corrección/revocación/renovación; V: partes/privacidad/auditor | Auditar otorgamiento, consulta sensible, cambio, revocación; textos versionados; retención POR DEFINIR | ACTIVE |
| Asignación profesional | Profesional, paciente/caso, institución, programa/servicio, función, competencia, alcance, estado y vigencia | Institución/programa; `SENSITIVE_PERSONAL`; institucional | Profesional >──< instituciones mediante afiliación; profesional >──< pacientes mediante asignaciones | C/M: R5/R6 autorizados; V: profesional, coordinación y paciente cuando corresponda | Auditar asignación/reasignación/suspensión/fin; expiración automática recomendada; conservar historia; depende de Afiliación/Programa | ACTIVE |
| Responsabilidad institucional | Encargo sobre programa, requisito, indicador, actividad, alerta o periodo | Institución; `INTERNAL`/`REGULATORY`; institucional | Persona/afiliación >──< objetos responsables; objeto → 0..* responsabilidades por función | C/M: dueño autorizado R5/R7/R9; V: equipos/auditores | Auditar asignación, vencimiento y sustitución; conservar historial; depende de Afiliación/objeto | ACTIVE |

### 7.4 Operación de cuidado y servicios

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Servicio | Catálogo compartido de servicio, modalidad, cobertura, duración, capacidad, elegibilidad, naturaleza financiada/comercial y versión | Institución prestadora; `INTERNAL` o `PUBLIC`; institucional | Servicio 1 → 0..* citas; >──< programas y planes; no confundir con prestación | C/M: R6/R13 y precio por R8 autorizado; V: usuarios según publicación | Auditar versión, activación, capacidad y naturaleza; vigencia; no alterar histórico | ACTIVE |
| Agenda y disponibilidad | Contenedor de franjas, recursos, profesional/sede, reglas controladas y estado | Institución; `INTERNAL`; institucional/profesional | Agenda 1 → 0..* disponibilidades y citas; profesional/sede 1 → 0..* agendas | C/M: R4/R6 según alcance; V: disponibilidad minimizada y gestión autorizada | Auditar bloqueos y cambios; vigencia temporal; purga operativa POR DEFINIR, conservar citas | ACTIVE |
| Cita | Solicitud o reserva: participantes, servicio, modalidad, fecha, lugar general, programa, profesional, estado y motivo | Institución prestadora; `SENSITIVE_PERSONAL`; usuario/institucional | Servicio 1 → 0..* citas; persona 1 → 0..* citas; cita 0..1 prestación principal | C/M: paciente/cuidador autorizado/R4-R6; V: participantes y gestión | Auditar creación, confirmación, reasignación, cancelación y estado; no borrar, cerrar/cancelar con motivo | ACTIVE |
| Prestación/encuentro | Hecho de servicio realizado o no realizado; participantes, servicio, autor, tiempos, resultado operativo y evidencia | Institución prestadora; `SENSITIVE_PERSONAL`; profesional/institucional | Cita 0..1 → prestación; prestación puede especializarse en visita o consulta virtual; 1 → 0..* actividades/evidencias | C/M: profesional/asistencia autorizada; V: participantes y supervisión | Auditar inicio, cierre, corrección, anulación y evidencia; cerrado se enmienda; retención POR DEFINIR | ACTIVE |
| Visita domiciliaria | Extensión de prestación: domicilio/territorio minimizado, desplazamiento, estados y evidencia de realización | Institución prestadora; `SENSITIVE_PERSONAL`; profesional/operación | Paciente 1 → 0..* visitas; visita 1 → 0..* evidencias; visita 0..1 cita | C/M: R4/R5/R6; V: paciente/cuidador y equipo asignado | Auditar transiciones, ubicación cuando se apruebe, cierre y enmienda; retención POR DEFINIR | ACTIVE |
| Consulta virtual | Extensión de prestación: modalidad remota, referencia de sesión, participantes, asistencia y evidencia | Institución prestadora; `SENSITIVE_PERSONAL`; institucional/integración autorizada | Persona 1 → 0..* consultas; consulta 0..1 cita y 0..* evidencias | C/M: R4-R6; V: participantes autorizados | Auditar creación, acceso, asistencia, cierre; no almacenar credenciales/enlaces secretos en logs; retención POR DEFINIR | ACTIVE |
| Bitácora y entrada | Registro longitudinal operativo; entrada, autor, tipo, momento, fuente, cierre, enmienda y referencias | Persona/caso bajo custodia institucional; `SENSITIVE_PERSONAL`, y `CLINICAL` si contiene clínica autorizada | Bitácora 1 → 0..* entradas; paciente/caso 1 → 0..* bitácoras según programa | C: paciente/cuidador/profesional según campos; M: autor antes de cierre o enmienda; V: relación/asignación | Auditar creación, firma/cierre, enmienda, acceso/exportación; no sobrescritura silenciosa; depende de Relación/Asignación | ACTIVE |
| Observación y novedad | Hecho reportado, dominio, autor, sujeto, fecha, fuente, estado y necesidad de revisión; no equivale a diagnóstico | Contexto que la origina; `SENSITIVE_PERSONAL`/`INTERNAL`; usuario/profesional/institución | Entrada/prestación 1 → 0..* observaciones; observación 0..* alertas/tareas | C: actores autorizados; M: corrección/revisión; V: equipos pertinentes | Auditar registro, clasificación y corrección; vigencia por caso; archivo con padre | ACTIVE |
| Alerta | Seguimiento de evento clínico autorizado, operativo, financiero o regulatorio: dominio, prioridad aprobada, origen/regla, responsable y estado | Institución/dominio; sensibilidad heredada; manual o regla aprobada | Sujeto 1 → 0..* alertas; alerta → 0..* acciones/evidencias | C: actores/reglas autorizados; M: responsable; V: por dominio | Auditar disparo, clasificación, asignación, escalamiento, cierre; conservar versión de regla; no inventar umbrales clínicos | ACTIVE |
| Tarea y seguimiento | Acción, responsable, fecha objetivo, estado, resultado y relación con caso/alerta/requisito | Institución/programa; sensibilidad heredada; institucional | Objeto 1 → 0..* tareas; tarea puede tener 0..* seguimientos/evidencias | C/M: responsable/coordinador; V: participantes autorizados | Auditar asignación, fecha, cierre, reapertura; archivar con historia | ACTIVE |

### 7.5 Información clínica autorizada

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Importación clínica y fuente clínica | Ejecución gobernada, institución/sistema origen, método, mapeo, versión, fechas, estado, errores y reconciliación | Hospital fuente y receptor autorizado; `CLINICAL`/`AUDIT_RESTRICTED`; `HOSPITAL_IMPORTED` | Fuente 1 → 0..* importaciones; importación 1 → 0..* registros clínicos | C/M: SYSTEM/R15 integración y custodio clínico; V: integración/auditoría, metadatos minimizados | Auditar configuración, carga, cuarentena, corrección y reconciliación; conservar linaje; depende de relación interinstitucional | ACTIVE |
| Resumen clínico autorizado | Vista mínima consolidada recibida del hospital: contenido permitido, autor/fecha original, versión, validez y limitaciones | Hospital fuente; MERDN custodio; `CLINICAL`; hospital importado | Paciente 1 → 0..* versiones; cada versión → fuente/importación | C: importación/carga hospitalaria; M: no editar origen, solo reconciliar/anotar; V: paciente, cuidador con alcance, profesional asignado | Auditar importación, vista, descarga/exportación y discrepancia; conservar versiones; retención POR DEFINIR | ACTIVE |
| Condición o diagnóstico autorizado | Elemento clínico externo, código/texto autorizado, estado, fechas, fuente y autor original | Hospital fuente; `CLINICAL`; hospital importado | Resumen/paciente 1 → 0..* condiciones/diagnósticos | Igual que resumen; MERDN no diagnostica ni altera fuente | Auditar acceso y reconciliación; vigencia clínica provista por fuente; archivo/versionado POR DEFINIR | STRUCTURAL |
| Alergia autorizada | Sustancia/reacción/severidad solo si provistas y aprobadas, estado, fuente y fecha | Hospital fuente; `CLINICAL`; hospital importado | Paciente 1 → 0..* alergias versionadas | Igual que resumen clínico | Auditar todo acceso material; no inferir ausencia; retención POR DEFINIR | STRUCTURAL |
| Medicamento e indicación autorizados | Medicamento, presentación/dosis/indicación solo según dataset aprobado, estado, fechas, fuente y prescriptor original cuando exista | Hospital fuente; `CLINICAL`; hospital importado | Paciente 1 → 0..* medicamentos; medicamento 1 → 0..* indicaciones/versiones | C por fuente; no modificación de prescripción externa; V por relación/asignación | Auditar vista, exportación y discrepancia; conservar historia; dataset/terminología POR DEFINIR | ACTIVE |
| Discrepancia clínica | Diferencia reportada entre fuente y percepción/otro dato, estado de revisión y resolución del hospital; no modifica el original | Hospital responsable; `CLINICAL`; usuario/profesional/institucional | Registro clínico 1 → 0..* discrepancias | C: paciente/cuidador/profesional autorizado; M: revisor clínico; V: partes autorizadas | Auditar reporte, asignación y resolución; conservar original y decisión | STRUCTURAL |

### 7.6 Formación y certificación

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Oferta de formación/curso | Contenido, proveedor/entidad formadora, modalidad, fuente, versión, vigencia y vínculo a SENA u otra entidad | Entidad formadora/institución; `PUBLIC`/`INTERNAL`; institucional/externa | Entidad formadora 1 → 0..* cursos; curso >──< programas/requisitos | C/M: R7/R9 custodios; V: usuarios autorizados/público si publicado | Auditar fuente, versión y publicación; archivar versiones; SENA es configuración, no estructura exclusiva | STRUCTURAL |
| Inscripción formativa | Participante, curso, programa, estado, progreso declarado/verificado y fechas | Participante/programa; `SENSITIVE_PERSONAL`; usuario/proveedor/institución | Persona >──< cursos mediante inscripciones | C/M: participante/proveedor autorizado; V: participante y gestores necesarios | Auditar inscripción, progreso, retiro y finalización; conservar historia | STRUCTURAL |
| Certificado y verificación formativa | Referencia documental, emisor, código, fechas, vigencia, estado, verificador y evidencia | Persona/emisor; `SENSITIVE_PERSONAL`; externa/institucional | Inscripción 0..* certificados; certificado 1 → 0..* verificaciones | C: participante/importación; M: verificador solo estado; V: titular y R7/R9 | Auditar carga, verificación, rechazo, vencimiento y renovación; no sobrescribir certificado; depende de Evidencia | STRUCTURAL |

### 7.7 Documentos y evidencias

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Documento y archivo | Documento lógico separado del objeto binario: nombre, tipo, tamaño, integridad, fuente, propietario, versión y estado | Propietario del contexto; sensibilidad heredada; cualquier categoría explícita | Documento 1 → 1..* versiones/archivos; archivo no concede significado probatorio | C: contribuyente autorizado; M: metadatos controlados/nueva versión; V/descarga: permiso específico | Auditar carga, vista, descarga, versión, cuarentena y disposición; conservación POR DEFINIR; archivo físico fuera de este diseño | ACTIVE |
| Categoría documental | Clasificación, campos requeridos, sensibilidad, vigencia, revisión y retención propuesta | Plataforma/institución; `INTERNAL`; configuración | Categoría 1 → 0..* documentos/evidencias | C/M: R13 y custodio de dominio; V: usuarios autorizados | Auditar versión/activación; no cambiar retroactivamente significado; depende de configuración | ACTIVE |
| Evidencia | Aserción de que uno o más documentos/datos soportan una actividad, visita, gasto, requisito, indicador o resultado; conserva obligatoriamente origen, autor, fecha, versión, institución, relaciones y trazabilidad, además de estado, periodo y alcance | Institución/objeto evidenciado; sensibilidad heredada; institucional/externa | Evidencia >──< documentos y >──< objetos; gasto/requisito/visita 1 → 0..* evidencias | C: contribuyentes por dominio; M: revisor/aprobador distinto cuando aplique; V: por objeto y sensibilidad | Auditar creación, enlace, revisión, aprobación, rechazo, reutilización, exportación, nueva versión y archivo; no sobrescribir origen o autor; vigencia y suficiencia POR DEFINIR | ACTIVE |
| Versión y revisión documental | Historial, autor, fecha, cambio, estado, verificación y relación con versión previa | Propietario del documento; sensibilidad heredada | Documento/evidencia 1 → 1..* versiones y 0..* revisiones | C: autor/revisor; M: estados controlados; V: roles con acceso al padre | Auditar todo cambio; inmutable tras cierre salvo nueva versión; conservar según política POR DEFINIR | ACTIVE |

### 7.8 Finanzas y recursos institucionales

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Fuente de recursos y periodo financiero | Origen, institución, referencia, restricciones, moneda/unidad, periodo y oficialidad | Institución responsable; `FINANCIAL`; financiera/institucional/externa oficial | Programa >──< fuentes; fuente 1 → 0..* presupuestos | C/M: R8; V: R7/R8/R11/R12 según alcance | Auditar alta, fuente, periodo y cierre; versionar; no declarar oficial sin fuente | STRUCTURAL |
| Presupuesto | Monto autorizado/controlado, periodo, institución, fuente, versión, estado y limitaciones | Institución; `FINANCIAL`; fuente financiera | Fuente/periodo 1 → 0..* presupuestos; presupuesto 1 → 0..* asignaciones | C/M: R8 con aprobación separable; V: finanzas, programa, auditoría, liderazgo | Auditar creación, aprobación, ajuste y cierre; correcciones trazables; no borrar | ACTIVE |
| Asignación financiera | Distribución a programa, actividad, población o recurso; monto, responsable, vigencia y estado | Institución; `FINANCIAL`; institucional/financiera | Presupuesto 1 → 0..* asignaciones; asignación 1 → 0..* compromisos/gastos | C/M: R8 con separación; V: R7/R8/R11/R12 | Auditar asignación, traslado, ajuste y cierre; conservar original | ACTIVE |
| Compromiso | Reserva u obligación controlada previa al gasto, referencia, contraparte, monto y estado; no asiento contable | Institución; `FINANCIAL`; financiera/institucional | Asignación 1 → 0..* compromisos; compromiso 0..* gastos/contrato | C/M: R8; V: finanzas/auditoría | Auditar aprobación, ajuste, cancelación; vigencia por periodo; alcance detallado POR DEFINIR | STRUCTURAL |
| Gasto | Egreso o referencia de ejecución: monto, fecha, fuente, programa, actividad, estado y procedencia | Institución; `FINANCIAL`; financiera/controlada | Asignación 1 → 0..* gastos; gasto 1 → 0..* evidencias; 0..1 proveedor/contrato y 0..* ajustes | C/M: R8 con creador/aprobador separables; V: R7/R8/R11/R12 | Auditar registro, importación, aprobación, rechazo, ajuste y exportación; nunca sobrescribir cerrado | ACTIVE |
| Proveedor | Contraparte institucional: identidad jurídica mínima, contacto de negocio, estado y fuente | Institución contratante; `CONFIDENTIAL`; institucional/externa autorizada | Proveedor 1 → 0..* contratos/facturas | C/M: R8 contratación; V: R8/R11 y responsables | Auditar alta, verificación y estado; archivar, no eliminar si tiene movimientos | ACTIVE |
| Contrato | Acuerdo, partes, objeto, periodo, valores/referencias, responsable, versión, estado y evidencia | Institución contratante; `FINANCIAL`/`CONFIDENTIAL`; contractual | Proveedor 1 → 0..* contratos; contrato 1 → 1..* versiones y 0..* gastos/evidencias | C/M: R8 con aprobación separada; V: contratación/auditoría y otros autorizados | Auditar versión, aprobación, cambio y cierre; retención exacta POR DEFINIR; no borrar historia | ACTIVE |
| Factura o referencia financiera | Documento/referencia externa, emisor, fecha, monto, estado y vínculo a contrato/gasto | Institución; `FINANCIAL`; externa/financiera | Contrato/gasto 1 → 0..* referencias; referencia → 0..* evidencias | C/M: R8; V: R8/R11 | Auditar carga, validación, duplicado, ajuste; conservar fuente; alcance fiscal POR DEFINIR | STRUCTURAL |
| Pago o referencia de pago institucional | Estado/referencia de pago aprobada, fecha, monto, fuente y reconciliación; no procesa fondos | Institución; `FINANCIAL`; financiera/externa | Gasto/factura 1 → 0..* referencias de pago | C/M: R8 autorizado; V: R8/R11/R12 agregado | Auditar estado, conciliación, reverso/referencia; datos permitidos POR DEFINIR; no almacenar credenciales | STRUCTURAL |
| Ejecución y ajuste | Resultado derivado o movimiento correctivo: fórmula/causa, periodo, insumos, versión y estado | Institución; `FINANCIAL`; `MERDN_CALCULATED` o fuente financiera | Presupuesto/asignación 1 → 0..* resultados/ajustes por periodo | C por cálculo/custodio; aprobación R8; V R7/R8/R11/R12 | Auditar fórmula, cálculo, validación, publicación y ajuste; preservar insumos y versión | ACTIVE |

### 7.9 Comercial hospitalario

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Oferta comercial y precio | Extensión versionada del servicio: precio de referencia, vigencia, cobertura y condiciones; separada del servicio financiado | Hospital; `FINANCIAL`/`PUBLIC` según publicación; institucional | Servicio 1 → 0..* ofertas/versiones; oferta puede pertenecer a 0..* planes | C/M: R8 y autoridad comercial; V: usuarios según publicación | Auditar precio, publicación y retiro; preservar términos históricos; reglas fiscales POR DEFINIR | STRUCTURAL |
| Plan | Catálogo versionado de beneficios, límites, precio de referencia, periodo y términos | Hospital; `FINANCIAL`/`PUBLIC`; institucional | Plan >──< servicios mediante derechos; plan 1 → 0..* membresías | C/M: autoridad comercial/R8; V: público/usuarios autorizados | Auditar versión, beneficio y precio; no alterar términos retroactivamente | STRUCTURAL |
| Membresía o afiliación comercial | Persona/cuenta, plan y versión, estado, vigencia, patrocinador y renovación | Hospital y miembro; `SENSITIVE_PERSONAL`/`FINANCIAL`; institucional/usuario | Persona 1 → 0..* membresías; membresía → 0..* derechos/usos; múltiples servicios cuando corresponda | C/M: R6/R8 y titular en acciones permitidas; V: titular/cuidador autorizado/gestores | Auditar alta, renovación, cancelación y cambio; conservar términos; no confundir con inscripción pública | STRUCTURAL |
| Derecho o entitlement | Beneficio disponible/usado, servicio, límite, periodo y origen plan/programa | Hospital/programa; `FINANCIAL`/`INTERNAL`; derivada de términos | Membresía/programa 1 → 0..* derechos; derecho 1 → 0..* usos | C por configuración/cálculo; M por ajuste autorizado; V titular/operación | Auditar consumo y override; vigencia según versión; conservar histórico | STRUCTURAL |
| Orden o solicitud comercial | Solicitud de servicio particular: solicitante, oferta, cantidad, estado y contexto | Hospital/solicitante; `SENSITIVE_PERSONAL`/`FINANCIAL`; usuario/institucional | Orden 1 → 1..* servicios solicitados; 0..* cobros/prestaciones | C/M: titular/cuidador/R6; V: partes/R8 | Auditar creación, aceptación, cancelación; archivo con historial; reglas POR DEFINIR | STRUCTURAL |
| Cobro | Referencia de cuenta por servicio/membresía: monto, moneda, estado, vencimiento, fuente y pagador | Hospital; `FINANCIAL`; institucional | Orden/membresía/prestación 1 → 0..* cobros; cobro 1 → 0..* pagos | C/M: R8 con controles; V: pagador autorizado/R8/R11 | Auditar creación, cambio, exención, cancelación y exportación; no equivale a factura oficial salvo aprobación | STRUCTURAL |
| Pago comercial controlado | Referencia externa/estado/evidencia y reconciliación; sin credenciales ni procesamiento productivo | Hospital/pagador; `FINANCIAL`; externa/controlada | Cobro 1 → 0..* pagos; pago 0..* evidencias | C/M: R8/integración autorizada; V: pagador/R8/R11 | Auditar carga, estado, conciliación, devolución de referencia; datos exactos POR DEFINIR | STRUCTURAL |
| Servicio prestado y evidencia de prestación | Enlace comercial/financiado a prestación operativa cerrada y prueba aprobada | Institución prestadora; sensibilidad heredada | Prestación 1 → 0..* evidencias y 0..* elegibilidades de cobro/ejecución | C por prestación; revisión por operación/evidencia; V finanzas solo metadatos mínimos | Auditar aprobación/rechazo; cita sola no basta; depende de Prestación/Evidencia | STRUCTURAL |
| Ingreso potencial | Resultado controlado de servicio soportado, cobro o pago: estado, periodo, fórmula y limitación; no reconocimiento contable oficial | Hospital; `FINANCIAL`; cálculo/controlado | Prestación/cobro/pago → 0..* referencias de ingreso por periodo | C por cálculo/R8; aprobación R8; V R8/R11/R12 | Auditar cálculo, reclasificación y reporte; conservar fórmula/insumos; oficialidad explícita | STRUCTURAL |

Regla de separación económica:

| Servicio institucional financiado | Servicio particular/comercial |
| --- | --- |
| La autorización nace de programa, contrato, fuente o asignación institucional | La autorización nace de oferta, orden, plan/membresía o acuerdo comercial aprobado |
| Se relaciona con presupuesto, asignación, gasto/ejecución y evidencia | Se relaciona con precio, cobro, pago controlado e ingreso potencial |
| No genera automáticamente cobro al paciente | No consume automáticamente recursos públicos |
| Puede compartir el catálogo y la prestación operativa | Mantiene contexto de financiación distinto y trazable |

### 7.10 Indicadores y reportes

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Definición de indicador | Nombre, propósito, fórmula, fuentes, dimensiones, unidad/porcentaje, dueño, método, versión, privacidad y estado | Institución/dueño de indicador; `INTERNAL`/`REGULATORY`; institucional/oficial autorizada | Indicador >──< fuentes/requisitos; 1 → 0..* versiones, periodos, metas y resultados | C/M: R7/R9/R10 autorizados; V: gestores/liderazgo/auditoría | Auditar fórmula, fuente, versión, aprobación y retiro; no editar versión publicada | ACTIVE |
| Periodo de medición | Intervalo, calendario, estado, cierre y relación con marco/programa | Institución/marco; `INTERNAL`; configuración/fuente | Periodo 1 → 0..* resultados, metas y requisitos | C/M: custodio; V: usuarios del dominio | Auditar apertura/cierre; conservar periodos históricos | ACTIVE |
| Resultado de indicador | Valor, numerador/denominador cuando aplique, dimensiones, periodo, ejecución, procedencia, validación y oficialidad | Institución; sensibilidad de insumos, agregado por defecto; calculada/importada | Indicador 1 → 0..* resultados, usualmente uno por combinación periodo/dimensiones/versión | C: SYSTEM/custodio; M: validación/corrección trazable; V: según agregación | Auditar cálculo/carga, validación, publicación, retiro y drill-down; conservar insumos/linaje | ACTIVE |
| Meta | Valor objetivo, periodo, responsable, fuente/aprobación y versión | Institución/programa; `INTERNAL`/`REGULATORY`; institucional | Indicador 1 → 0..* metas por periodo/dimensión | C/M: dueño autorizado; V: roles de gestión | Auditar aprobación/cambio; no sustituir resultado; versionar | STRUCTURAL |
| Reporte y exportación | Definición/ejecución de salida, audiencia, filtros, nivel de agregación, periodo, fuente y artefacto | Institución; sensibilidad derivada; cálculo institucional | Reporte >──< indicadores/fuentes; ejecución 1 → 0..1 artefacto | C: roles autorizados; V/exportar: permiso separado | Auditar generación, acceso, descarga, exportación y parámetros; retención POR DEFINIR | ACTIVE |

### 7.11 Hub institucional, normativo y de evidencias

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Entidad o marco | Raíz genérica y extensible de la cadena aprobada `Entidad/Marco → Norma → Requisito → Responsable → Indicador → Evidencia → Resultado/Brecha`; configura autoridad, entidad, política, FURAG, MIPG, ADRES, T-319, SENA u otro marco, con tipo, jurisdicción, fuente y versión | Autoridad fuente/institución custodia; `REGULATORY`; externa oficial/institucional | Marco 1 → 0..* normas, dimensiones, periodos y requisitos; los eslabones de la cadena pueden relacionarse muchos-a-muchos cuando la reutilización sea explícita y trazable | C/M: R9 autorizado; V: R9/R11/R12 | Auditar alta, fuente, versión y publicación; no codificar solo cinco marcos; archivar versiones | STRUCTURAL |
| Norma o instrumento | Ley, sentencia, resolución, decreto, política u otro instrumento; emisor, referencia, fecha, jurisdicción, versión y texto/documento fuente | Autoridad emisora; `REGULATORY` y fuente pública cuando aplique | Marco/entidad 1 → 0..* normas; norma 1 → 0..* requisitos/versiones | C/M: R9 con revisión autorizada; V: usuarios del Hub | Auditar fuente/versión; fuente inmutable, interpretación separada; vigencia legal POR DEFINIR por especialista | STRUCTURAL |
| Obligación o requisito | Unidad versionada de obligación, pregunta, criterio o compromiso; aplicabilidad, periodo y estado | Institución responsable bajo marco; `REGULATORY`; fuente + interpretación aprobada | Norma 1 → 0..* requisitos; requisito >──< evidencias, indicadores, actividades, poblaciones y recursos | C/M: R9; aprobación por autoridad POR DEFINIR; V R9/R11/R12 | Auditar interpretación, aplicabilidad, asignación y estado; no borrar; versionar | STRUCTURAL |
| Dimensión del marco | Eje jerárquico para organizar requisitos/indicadores; código, nombre, versión y fuente | Marco; `REGULATORY`; fuente autorizada | Marco 1 → 0..* dimensiones; dimensión >──< requisitos/indicadores | C/M: custodio R9; V: Hub | Auditar cambios; versionar por marco/periodo | STRUCTURAL |
| Aplicabilidad e interpretación | Decisión institucional separada del texto fuente: alcance, fundamento, aprobador, versión y limitaciones | Institución autorizada; `REGULATORY`/`CONFIDENTIAL`; institucional | Norma/requisito/institución 1 → 0..* decisiones históricas | C: revisor autorizado; M solo nueva versión/estado; V R9/R11 | Auditar aprobación/retiro; nunca presentar como fuente oficial; retención POR DEFINIR | STRUCTURAL |
| Actividad o acción del Hub | Acción preventiva, correctiva, documental, formativa, financiera o de reporte; responsable, fecha, estado y resultado | Institución/programa; `REGULATORY`/sensibilidad heredada | Requisito/brecha 1 → 0..* actividades; actividad >──< evidencia/recurso/programa | C/M: responsable R7/R9; V: equipo/auditor | Auditar asignación, avance, cierre y reapertura; conservar historia | STRUCTURAL |
| Brecha | Diferencia evaluada entre estado requerido y evidenciado; método, evaluador, fecha, severidad aprobada y estado | Institución; `REGULATORY`/`CONFIDENTIAL`; evaluación institucional | Requisito 1 → 0..* brechas por periodo; brecha → 0..* acciones/evidencias | C/M: R9/revisor; V R9/R11/R12 agregado | Auditar evaluación, base, cambio y cierre; una evidencia no cierra automáticamente; versionar | STRUCTURAL |
| Estado/resultado del Hub | Estado interno o resultado validado, periodo, fuente, limitaciones y aprobación; separado de determinación oficial | Institución; `REGULATORY`; institucional/calculada/externa oficial | Requisito/marco 1 → 0..* estados/resultados por periodo | C/M: R9; V R9/R11/R12 | Auditar validación/publicación; oficialidad explícita; conservar periodos | STRUCTURAL |

El Hub reutiliza, sin duplicarlos, Programa, Población, Responsabilidad, Fuente, Periodo, Indicador, Evidencia, Actividad y Recurso. FURAG, MIPG, ADRES, Sentencia T-319 de 2025 y SENA son configuraciones iniciales, no arquitecturas separadas.

### 7.12 Auditoría, integración y calidad

| Entidad conceptual | Propósito y datos principales | Propietario; sensibilidad; fuente | Relaciones y cardinalidad | C/M/V | Auditoría, vigencia, archivo, dependencias | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| Registro de fuente | Identifica persona, institución, sistema, documento, dataset o publicación de origen; tipo, autoridad, referencia, versión, fechas, método, oficialidad y limitaciones | Autor de origen y custodio del dominio; sensibilidad de la referencia/contenido; externa, institucional o declarada | Fuente 1 → 0..* registros, importaciones, documentos, indicadores o resultados; un objeto puede tener 0..* fuentes mediante linaje explícito | C: custodio/integración/autor autorizado; M: nueva versión o corrección trazable; V: usuarios del objeto y auditores autorizados | Auditar alta, cambio de referencia, validación y retiro; nunca cambiar silenciosamente oficialidad; conservar versiones; depende del sobre de procedencia | ACTIVE |
| Evento de auditoría | Registro conceptualmente append-only: actor real, tenant, institución/contexto, acción, recurso/tipo, identificador, fecha, resultado, correlación, fuente técnica y cambios minimizados | Plataforma e institución del evento; `AUDIT_RESTRICTED`; sistema | Cualquier recurso 1 → 0..* eventos; actor 1 → 0..* eventos | C: SYSTEM únicamente; M/borrado: prohibidos para usuarios normales; V: R11/R15 y responsables limitados | Acceso/exportación de auditoría se audita; cualquier mecanismo técnico excepcional de retención o disposición queda separado y altamente controlado; conservación/inmutabilidad exactas POR DEFINIR | ACTIVE |
| Acceso sensible | Especialización/evento para vista, descarga, impresión o exportación clínica/personal/financiera/regulatoria | Plataforma; `AUDIT_RESTRICTED`; sistema | Evento → actor, sujeto/recurso, institución, finalidad y decisión | C SYSTEM; M nadie; V auditoría/privacidad autorizada | Registrar permitido/denegado según riesgo, minimizar contenido; retención POR DEFINIR | ACTIVE |
| Exportación | Solicitud/ejecución: solicitante, propósito, filtros, ámbito, nivel de agregación, artefacto, resultado y expiración | Institución; `AUDIT_RESTRICTED` + clase de contenido; sistema/usuario | Exportación → 1..* fuentes/recursos y 0..1 archivo | C: roles con `EX`; M solo cancelar/expirar; V solicitante/auditor | Auditar solicitud, generación, descarga y fallo; expiración/retención POR DEFINIR | ACTIVE |
| Integración e intercambio | Sistema externo, institución, finalidad/base, datasets, campos autorizados, mapeo, versión, modo y estado | Institución/dueño funcional; `CONFIDENTIAL`; institucional | Integración 1 → 0..* ejecuciones; >──< dominios/fuentes | C/M: R14/R15 integración con aprobación funcional; V: metadatos para dueños/auditores | Auditar activación, alcance, importación/exportación, fallo y suspensión; secretos solo por referencia protegida | STRUCTURAL |
| Ejecución de intercambio | Lote/sincronización, fechas, fuente, conteos, errores, cuarentena, reconciliación y correlación | Institución; sensibilidad del dataset; sistema externo | Integración 1 → 0..* ejecuciones; ejecución 1 → 0..* registros fuente/errores | C/M: SYSTEM/R15; V: operadores/custodios con minimización | Auditar cada estado; retener para linaje POR DEFINIR; no validar automáticamente | STRUCTURAL |
| Problema de calidad y reconciliación | Duplicado, incompleto, inválido, desactualizado o discrepante; objeto, fuente, responsable, decisión y estado | Custodio del dominio; sensibilidad heredada; cálculo/revisión | Recurso 1 → 0..* problemas; problema → 0..* acciones | C: SYSTEM/custodio; M: responsable; V: calidad/auditoría | Auditar detección, fusión, corrección, descarte y resolución; conservar decisión | ACTIVE |

## 8. Cardinalidades explícitas

1. Tenant 1 → 0..* personas; cada persona es única dentro de ese tenant. Persona 1 → 0..* perfiles.
2. Persona 1 → 0..* afiliaciones institucionales.
3. Persona 1 → 0..* cuentas; si se restringe a una, debe decidirlo el Product Owner antes del diseño físico.
4. Municipio 1 → 0..* instituciones; una institución con cobertura en varios municipios requiere modelar sedes/coberturas o una relación explícita, no duplicarla.
5. Institución 1 → 0..* programas.
6. Programa >──< personas mediante inscripciones; por tanto, programa 1 → 0..* beneficiarios y persona 1 → 0..* programas.
7. Paciente >──< cuidador mediante relaciones independientes: ambos lados 0..*.
8. Profesional >──< instituciones mediante afiliaciones autorizadas: ambos lados 0..*.
9. Profesional >──< pacientes mediante asignaciones: ambos lados 0..*.
10. Programa >──< fuentes de recursos: ambos lados 0..*.
11. Presupuesto 1 → 0..* asignaciones financieras.
12. Asignación financiera 1 → 0..* gastos, directos o a través de compromisos según reglas futuras.
13. Gasto 1 → 0..* evidencias cuando corresponda; evidencia puede soportar varios objetos solo con relación explícita y acceso compatible.
14. Norma 1 → 0..* requisitos.
15. Requisito >──< evidencias: ambos lados 0..*.
16. Requisito >──< indicadores: ambos lados 0..*.
17. Indicador 1 → 0..* resultados distribuidos por periodo, versión y dimensiones.
18. Servicio 1 → 0..* citas.
19. Plan >──< servicios; membresía referencia una versión de plan y puede otorgar 0..* servicios/derechos.
20. Paciente 1 → 0..* visitas.
21. Visita 1 → 0..* evidencias.
22. Cita 0..1 → 0..1 prestación principal; una prestación no programada puede existir solo si una regla futura la autoriza.
23. Documento 1 → 1..* versiones; evidencia >──< documentos.
24. Marco 1 → 0..* normas/dimensiones/requisitos según configuración; no se crea un modelo separado por FURAG, MIPG, ADRES, T-319 o SENA.
25. Prestación 1 → 0..* cobros o referencias de ejecución, pero solo después de cumplir la evidencia aprobada; una cita sola no genera ingreso.

## 9. Reglas transversales de creación, modificación y consulta

1. Las columnas C/M/V del catálogo indican actores candidatos, no permisos automáticos.
2. El creador no puede aprobar su propio registro sensible cuando se apruebe separación de funciones para ese flujo.
3. Datos externos oficiales o clínicos se incorporan como registros de fuente; MERDN no edita el valor original.
4. Los usuarios corrigen datos propios únicamente en campos autogestionables; las correcciones verificadas conservan historial.
5. **APROBADO:** Alcaldía consulta agregados por defecto. El acceso nominal, dirección exacta, relaciones personales, evidencias identificables o detalle de atención requiere autorización, finalidad explícita y auditoría. Clínica individual permanece denegada por defecto.
6. Finanzas no consulta contenido clínico; usa identificadores mínimos de programa, servicio, prestación o beneficiario solo cuando la finalidad se apruebe.
7. Administración de plataforma y soporte no reciben acceso implícito a datos de negocio.
8. Ver, descargar, imprimir, exportar, crear, editar, aprobar, asignar, cerrar y auditar son acciones distintas.
9. Una evidencia hereda las restricciones del objeto más sensible que permita revelar.
10. Un indicador agregado no habilita acceso a sus registros nominales de origen.

## 10. Retención, corrección, revocación y disposición

No se establecen periodos legales en este documento. Todos los periodos exactos son **POR DEFINIR** con revisión jurídica, clínica, contractual, archivística, financiera, de privacidad y de seguridad según corresponda.

| Tipo de información | Tratamiento conceptual requerido | Periodo |
| --- | --- | --- |
| Persona, perfil y afiliación | Corrección versionada, restricción de acceso, posible anonimización; preservar vínculos y autoría | POR DEFINIR |
| Cuenta, sesión y verificación | Suspensión/cierre, revocación, archivo de eventos de seguridad; eliminación controlada de datos no necesarios | POR DEFINIR |
| Relación, consentimiento y asignación | Revocación o expiración impide uso futuro; preservar estado, alcance, evidencia y decisiones históricas | POR DEFINIR |
| Operación de cuidado | Cierre y enmienda; anulación justificada sin sobrescritura; archivo | POR DEFINIR |
| Clínica autorizada | Versionado por fuente, reconciliación y restricción; no alterar registro hospitalario | POR DEFINIR |
| Documentos y evidencia | Versionado, integridad, archivo, disposición autorizada y posible conservación legal | POR DEFINIR |
| Finanzas, contratos y comercio | Ajustes trazables, cierre de periodo, archivo y disposición controlada; no borrar movimientos cerrados | POR DEFINIR |
| Indicadores y reportes | Conservar definición, fórmula, insumos/linaje, versión, validación y publicación | POR DEFINIR |
| Hub regulatorio | Conservar fuente, versiones, interpretación, aplicabilidad, evidencia y estados históricos | POR DEFINIR |
| Formación y certificados | Expiración/renovación, verificación y archivo; no convertir declaración en certificación | POR DEFINIR |
| Auditoría y accesos sensibles | Protección contra modificación ordinaria, minimización, archivo y disposición excepcional controlada | POR DEFINIR |
| Datos demostrativos | Segregación estricta; eliminación segura al terminar su finalidad, sin mezclarlos con producción | POR DEFINIR |

Reglas recomendadas:

- “Eliminar” un objeto material normalmente significa cerrar, revocar, anonimizar o archivar de manera controlada, no destruir su historia.
- Una solicitud de eliminación debe evaluar obligaciones de conservación, derechos del titular, dependencias, evidencia y auditoría.
- La anonimización debe considerar relaciones y riesgo de reidentificación, no solo retirar nombres.
- Los archivos y sus metadatos/relaciones deben tener disposición coordinada; eliminar solo uno puede romper trazabilidad.
- Los eventos de auditoría minimizan valores sensibles y no funcionan como copia indiscriminada de datos de negocio.

## 11. Modelo de datos del MVP

### 11.1 MVP ACTIVE DATA

Conjunto mínimo recomendado para operar el primer vertical slice:

1. Territorio/municipio, institución, unidad/sede y programa configurables.
2. Persona, cuenta, perfil, afiliación, rol/permiso, sesión/contexto y verificación básica.
3. Relación paciente-cuidador, consentimiento/autorización aplicable y asignación profesional.
4. Inscripción en programa/caso y clasificación poblacional mínima con vista municipal agregada.
5. Servicio, agenda, cita, prestación, visita, consulta virtual visible, bitácora/entrada, observación/novedad, alerta, tarea y seguimiento.
6. Fuente/importación clínica, resumen clínico autorizado y medicamento/indicación autorizados, en solo lectura y con procedencia.
7. Documento/archivo, categoría, evidencia, versión y revisión.
8. Presupuesto, asignación financiera, gasto, proveedor, contrato, ejecución/ajuste y soporte de evidencia.
9. Definición de indicador, periodo, resultado y reporte/exportación con linaje.
10. Evento de auditoría, acceso sensible, exportación y problema de calidad/reconciliación.

La selección ACTIVE demuestra la cadena:

```text
institución/programa
→ persona y autorización contextual
→ cita/visita y actividad documentada
→ evidencia
→ recurso/gasto básico
→ indicador trazable
→ experiencia Hospital y Alcaldía agregada
→ auditoría y procedencia
```

### 11.2 MVP STRUCTURAL DATA

Debe existir con configuración, registros controlados, carga documental o referencias manuales, aunque no tenga automatización completa:

1. Relación interinstitucional.
2. Cargo y responsabilidad institucional ampliada.
3. Condición/diagnóstico, alergia y discrepancia clínica como extensiones autorizadas del dataset clínico, sin HCE.
4. Oferta de formación, curso, entidad formadora/SENA, inscripción, certificado, verificación y vigencia.
5. Fuente de recursos, periodo financiero, compromiso, factura/referencia y pago institucional controlado.
6. Oferta comercial/precio, plan, membresía, derecho, orden, cobro, pago comercial, servicio prestado soportado e ingreso potencial.
7. Meta de indicador.
8. Entidad/marco, norma, obligación/requisito, dimensión, aplicabilidad/interpretación, actividad, brecha y estado/resultado del Hub.
9. Configuraciones iniciales de FURAG, MIPG, ADRES, Sentencia T-319 de 2025 y SENA, claramente etiquetadas y extensibles.
10. Integración/intercambio y sus ejecuciones, aun cuando el modo inicial sea manual, documental o por archivo.

`MVP STRUCTURAL DATA` no significa pantalla vacía ni promesa ficticia: significa que el concepto, propiedad, fuente, acceso, auditoría y relaciones están representados y pueden demostrarse con datos controlados sin afirmar automatización u oficialidad.

## 12. Datos de mayor sensibilidad y controles conceptuales

1. **Clínica individual:** resumen, diagnósticos/condiciones, alergias, medicamentos, indicaciones y discrepancias. Requiere fuente hospitalaria, relación/asignación, finalidad y auditoría de acceso.
2. **Identidad y localización:** identificadores, contacto, domicilio/geolocalización y datos de población vulnerable. Requiere minimización y control contra reidentificación.
3. **Relaciones y autorizaciones:** paciente-cuidador, representación, consentimiento y revocación. Determinan acceso a terceros y deben evaluarse por vínculo.
4. **Bitácoras, observaciones y visitas:** pueden revelar salud, rutina, ubicación y vulnerabilidad aun sin etiqueta clínica.
5. **Documentos y evidencia:** la sensibilidad depende de su contenido y objeto; una categoría genérica no reduce el riesgo.
6. **Finanzas y pagos:** montos, proveedores, contratos, facturas y referencias de pago; separados de clínica y sujetos a funciones incompatibles.
7. **Auditoría:** revela conductas, accesos e identificadores; acceso restringido, minimizado y también auditado.
8. **Exportaciones y agregados de grupos pequeños:** pueden amplificar exposición o permitir reidentificación; umbrales POR DEFINIR.

## 13. Decisiones de datos que bloquean el diseño físico

Las decisiones aprobadas en la sección 1.1 eliminan los bloqueos conceptuales para comenzar la arquitectura. Antes de cerrar el esquema físico inicial todavía deben especificarse estos detalles:

1. **Identificación y reconciliación dentro del tenant:** identificadores mínimos, cantidad y vinculación de cuentas por persona, autoridad de fusión y tratamiento de posibles duplicados, sin identidad compartida implícita entre tenants.
2. **Autorización relacional mínima:** tipos y campos obligatorios de consentimiento, representación, relación paciente-cuidador y asignación profesional que materializarán la política contextual aprobada.
3. **Dataset clínico inicial:** campos exactos autorizados, unidad/versionado del registro fuente, terminologías si aplican, método de carga inicial y reglas de reconciliación; sin decidir todavía tecnología de integración.
4. **Acceso nominal municipal, si se incluye en el MVP:** casos autorizados, finalidades, categorías y nivel de detalle. Si no se aprueba un caso concreto, el esquema inicial implementará Alcaldía agregada por defecto.
5. **Modelo temporal y de corrección:** convención común para vigencia, versiones, cierre, enmiendas, revocaciones y ajustes en los dominios materiales.
6. **Clasificación y herencia de sensibilidad:** tratamiento de documentos mixtos y regla para que evidencia, exportaciones y derivados hereden restricciones.
7. **Granularidad de procedencia:** cuándo el linaje se registra a nivel de registro, versión, atributo o lote, especialmente para clínica, finanzas e indicadores.
8. **Integridad y disposición de documentos/evidencias:** mecanismo conceptual de integridad, relaciones admitidas y clases iniciales de retención, archivo, anonimización y eliminación controlada. Los periodos exactos siguen POR DEFINIR.
9. **Auditoría física:** eventos mínimos, granularidad, minimización de valores anteriores/nuevos, protección técnica append-only y procedimiento excepcional de retención o disposición fuera de usuarios normales.
10. **Detalle financiero del MVP:** significado y estados exactos de presupuesto, asignación, gasto y ejecución, fuentes controladas y cuáles conceptos estructurales —compromiso, factura o pago— estarán activos inicialmente.
11. **Unidad de prestación y financiación:** cómo una prestación se vincula a programa financiado, membresía o cobro particular para impedir doble conteo de ejecución e ingreso.
12. **Indicadores iniciales:** catálogo pequeño aprobado con fórmula, unidad, periodo, dimensiones, fuente y umbrales de privacidad.
13. **Configuración inicial del Hub:** versiones y fuentes autorizadas de FURAG/MIPG, ADRES, T-319 y SENA y granularidad de sus requisitos, manteniendo la cadena genérica ya aprobada.

## 14. Consistencia, supuestos y riesgos

### 14.1 Hechos consolidados

- MERDN es multi-municipio y multiinstitución desde el primer diseño.
- MERDN usa un tenant lógico aislado por cliente o despliegue y una persona única por tenant con múltiples perfiles.
- Hospital y Alcaldía son experiencias centrales sobre capacidades compartidas.
- La relación paciente-cuidador es muchos-a-muchos y cada vínculo es independiente.
- La clínica del MVP proviene de una fuente hospitalaria autorizada, conserva procedencia y no convierte MERDN en HCE.
- Finanzas, indicadores, evidencia, Hub regulatorio, formación/SENA y sostenibilidad hospitalaria permanecen estructuralmente presentes.
- Auditoría y trazabilidad comienzan en el primer vertical slice.

### 14.2 Supuestos conceptuales recomendados, no aprobación de implementación

- Documento, archivo y evidencia son conceptos separados.
- Prestación es el hecho operativo común para visita y consulta virtual.
- FURAG, MIPG, ADRES, T-319 y SENA usan el mismo metamodelo extensible del Hub.
- El catálogo de servicio es común, mientras la financiación institucional y la oferta comercial son contextos separados.

### 14.3 Riesgos principales

- Duplicar personas por rol o institución y producir identidades divergentes.
- Omitir el tenant o la organización activa en operaciones institucionales, o permitir intercambio entre tenants sin una frontera externa gobernada.
- Mezclar observaciones de usuario con clínica hospitalaria o cálculos internos con valores oficiales.
- Permitir que evidencia o exportaciones evadan las restricciones del objeto original.
- Vincular gasto o cobro directamente con datos clínicos innecesarios.
- Contar una cita como prestación, gasto ejecutado o ingreso sin evidencia de realización.
- Modelar cada marco regulatorio como un módulo físico aislado y perder extensibilidad.
- Guardar valores sensibles completos en auditoría o usar auditoría como acceso alterno al negocio.

### 14.4 Contradicciones documentales

No se identifican contradicciones materiales entre la solicitud, `AGENTS.md`, `CLAUDE.md`, `docs/PRODUCT.md`, `docs/MODULES.md` y `docs/ROLES.md`.

Hay decisiones abiertas coherentes entre los documentos —dataset clínico, acceso municipal nominal, consentimiento/representación, fórmulas, fuentes oficiales, retención, reglas financieras, comerciales e integraciones— que este modelo conserva como **POR DEFINIR** y no resuelve silenciosamente.
