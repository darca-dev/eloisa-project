# MERDN — Modelo funcional de identidad, roles y autorización

## 1. Estado y propósito

Este documento define el modelo funcional de identidad, roles, permisos, relaciones, contexto institucional y acceso a información de MERDN. No selecciona tecnologías ni implementa autorización.

Convenciones de estado:

- **APROBADO:** decisión establecida por el Product Owner, `AGENTS.md` o `docs/PRODUCT.md`.
- **RECOMENDADO:** propuesta del Lead Architect para aprobación o posterior especificación técnica.
- **POR DEFINIR:** decisión que no debe ser asumida por implementación.

`docs/PRODUCT.md` conserva la definición estratégica; `docs/MODULES.md`, los límites funcionales; este documento determina cómo deben conceptualizarse los sujetos y decisiones de acceso.

## 2. Principios de autorización

1. **APROBADO — Denegación por defecto:** todo acceso no expresamente autorizado se considera denegado.
2. **APROBADO — El rol no basta:** una decisión debe considerar rol, institución, municipio, territorio, programa, relación, asignación profesional, consentimiento o autorización, finalidad, vigencia, acción solicitada y sensibilidad del dato.
3. **APROBADO — Separación institucional:** pertenecer a una institución no concede acceso a otra. Todo acceso interinstitucional requiere relación y finalidad autorizadas.
4. **APROBADO — Contexto activo:** cada operación institucional se realiza dentro de un contexto explícito; no se mezclan permisos de afiliaciones diferentes.
5. **APROBADO — Relaciones independientes:** cada vínculo paciente-cuidador y cada asignación profesional tiene alcance, institución, programa, estado y vigencia propios.
6. **APROBADO — Acceso clínico restringido:** Alcaldía, Finanzas, Administración y soporte técnico no reciben acceso clínico implícito.
7. **APROBADO — Procedencia clínica:** la información clínica del MVP proviene de una fuente hospitalaria autorizada y conserva procedencia.
8. **APROBADO — Auditoría:** toda acción sensible debe producir un evento auditable; los auditores no alteran los eventos ni los registros auditados mediante su rol de auditoría.
9. **APROBADO — Separación de funciones:** crear, aprobar, ejecutar, auditar y administrar son permisos distintos.
10. **RECOMENDADO — Permisos granulares:** modelar permisos como `dominio.recurso.acción` acompañados de condiciones contextuales.
11. **RECOMENDADO — Sin permisos por interfaz:** ver un botón, portal o pantalla nunca constituye autorización.
12. **RECOMENDADO — Sin privilegios acumulados ocultos:** al cambiar de contexto activo se recalculan permisos y se invalida cualquier selección de registros del contexto anterior.

## 3. Modelo de identidad

| Concepto | Definición funcional | Regla principal | Estado |
| --- | --- | --- | --- |
| Persona | Ser humano identificado en MERDN | Una persona puede tener varios perfiles, cuentas vinculadas bajo reglas futuras y afiliaciones | APROBADO |
| Cuenta | Medio de autenticación y ciclo de acceso | No equivale a persona, rol ni afiliación; puede suspenderse sin eliminar historia | RECOMENDADO |
| Perfil | Forma en que la persona participa: paciente, cuidador, profesional u otro | Una persona puede tener varios perfiles simultáneos | APROBADO |
| Rol técnico | Paquete reutilizable de permisos base | No concede acceso sin contexto y condiciones | RECOMENDADO |
| Cargo | Denominación laboral o institucional | Es metadato; puede sugerir una asignación de roles, pero no concede permisos por sí solo | RECOMENDADO |
| Institución | Alcaldía, secretaría, hospital, ESE, IPS, proveedor u otra entidad | Define un límite de propiedad y administración, no acceso universal | APROBADO |
| Municipio/territorio | Ámbito territorial autorizado | Restringe datos, programas, reportes y administración | APROBADO |
| Programa | Contexto público, institucional o comercial | Puede restringir casos, población, recursos, evidencia y acciones | APROBADO |
| Afiliación | Vínculo persona-institución con cargo, estado y vigencia | Es condición necesaria para roles institucionales | RECOMENDADO |
| Relación | Vínculo autorizado entre personas o entidades | Controla acceso delegado y debe conservar alcance y vigencia | APROBADO |
| Permiso | Autorización para una acción sobre un dominio o recurso | Se evalúa junto con condiciones, no de manera aislada | RECOMENDADO |
| Asignación | Encargo operativo, profesional, programático o de responsabilidad | Limita registros y acciones concretas | APROBADO |
| Consentimiento/autorización | Evidencia de una autorización o fundamento aprobado | No reemplaza rol, institución, asignación ni otras condiciones necesarias | APROBADO |
| Finalidad | Propósito declarado y permitido del acceso | Debe ser compatible con el dato y la función del usuario | APROBADO |
| Contexto activo | Combinación elegida de institución, municipio, programa y función | Determina el conjunto efectivo de permisos de la sesión operativa | RECOMENDADO |

### 3.1 Decisión conceptual de acceso

**RECOMENDADO:** una solicitud se autoriza únicamente cuando se cumplen todas las condiciones aplicables:

```text
cuenta activa
AND perfil vigente
AND afiliación institucional vigente cuando aplique
AND rol técnico permitido en el contexto activo
AND permiso para dominio + acción
AND municipio/territorio permitido
AND programa permitido cuando aplique
AND relación o asignación válida cuando el recurso sea individual
AND consentimiento/autorización o fundamento aprobado cuando aplique
AND finalidad compatible
AND vigencia válida
AND sensibilidad permitida
AND ausencia de una prohibición explícita
```

El resultado debe ser **permitir** o **denegar** y generar auditoría cuando la acción o el dato sean sensibles. La forma técnica de implementar esta evaluación queda **POR DEFINIR**.

## 4. Roles funcionales recomendados

Se recomiendan **15 roles técnicos base**. Los 34 nombres propuestos por el Product Owner se representan mediante estos roles, cargos, atributos, relaciones, asignaciones y contextos.

### 4.1 Roles técnicos base

| ID | Rol técnico base | Propósito | Contexto obligatorio | Estado |
| --- | --- | --- | --- | --- |
| R1 | Autogestión de persona | Gestionar cuenta y datos propios autorizados | Persona autenticada | RECOMENDADO |
| R2 | Paciente | Usar servicios y consultar información propia autorizada | Persona/paciente e institución o programa cuando aplique | RECOMENDADO |
| R3 | Cuidador autorizado | Actuar para pacientes vinculados dentro del alcance concedido | Relación paciente-cuidador válida | RECOMENDADO |
| R4 | Profesional asistencial | Atender pacientes y registrar actividad autorizada | Institución + programa/servicio + asignación profesional | RECOMENDADO |
| R5 | Coordinación asistencial | Coordinar casos, asignaciones, continuidad y alertas | Institución + programa/servicio | RECOMENDADO |
| R6 | Operación institucional | Administrar agenda, admisión, personas operativas y servicios no clínicos | Institución + unidad o programa | RECOMENDADO |
| R7 | Gestión de programas | Gestionar programas, población, responsables, actividades y resultados | Institución/municipio + programa | RECOMENDADO |
| R8 | Finanzas y contratación | Gestionar presupuesto, gastos, proveedores, contratos, cobros o ingresos según subpermisos | Institución + periodo/programa | RECOMENDADO |
| R9 | Cumplimiento y evidencia | Gestionar Hub, FURAG/MIPG, ADRES, T-319, SENA, evidencias y responsables | Institución + marco + periodo/programa | RECOMENDADO |
| R10 | Calidad y supervisión | Revisar calidad, indicadores, casos y acciones dentro del detalle autorizado | Institución + programa/servicio | RECOMENDADO |
| R11 | Auditor institucional | Consultar trazabilidad y evidencia sin modificar los registros auditados | Institución + alcance de auditoría | RECOMENDADO |
| R12 | Liderazgo ejecutivo | Consultar indicadores, resultados y reportes autorizados | Institución/municipio + nivel de agregación | RECOMENDADO |
| R13 | Administración institucional | Administrar afiliaciones, roles locales, catálogos y configuración delegada | Institución | RECOMENDADO |
| R14 | Administración de plataforma | Administrar plataforma, tenants y configuración global sin acceso de negocio implícito | Plataforma + autorización privilegiada | RECOMENDADO |
| R15 | Operaciones técnicas controladas | Soporte, auditoría de plataforma o integraciones mediante subfunciones incompatibles | Plataforma/institución + orden o asignación explícita | RECOMENDADO |

R15 no debe asignarse como un paquete omnipotente. Sus subfunciones —soporte, auditoría de plataforma e integraciones— deben separarse mediante permisos incompatibles y restricciones adicionales.

### 4.2 Clasificación de las 34 denominaciones evaluadas

| Denominación | Clasificación recomendada | Representación |
| --- | --- | --- |
| Paciente | Perfil + R2 | Persona con perfil de paciente |
| Cuidador | Perfil + R3 | Persona con relación válida por paciente |
| Representante legal o autorizado | Tipo de relación, no rol global | R3 solo si el alcance autorizado permite actuar |
| Contacto cercano | Relación/contacto sin acceso por defecto | No requiere cuenta ni rol salvo decisión posterior |
| Contacto de emergencia | Relación/contacto sin acceso por defecto | No concede acceso a MERDN |
| Profesional de salud | Perfil profesional + R4 | Profesión, credenciales y afiliación como atributos |
| Visitador domiciliario | Función/asignación de R4 | Modalidad o servicio asignado, no rol técnico separado |
| Coordinador asistencial | Cargo + R5 | Alcance por institución/programa |
| Supervisor clínico | Cargo + R10 y permisos clínicos específicos | No acceso clínico universal |
| Administrador institucional | R13 | Administración delegada de una institución |
| Coordinador de agenda | Cargo + R6 | Permisos de agenda, no clínicos por defecto |
| Gestor de pacientes | Cargo + R6 o R5 | Según sea admisión operativa o coordinación asistencial |
| Gestor de programas | R7 | Programa e institución obligatorios |
| Finanzas | R8 con subpermisos financieros | Sin acceso clínico |
| Contratación/proveedores | R8 con subpermisos de contratación | Separar aprobación cuando corresponda |
| Calidad | R10 | Detalle clínico solo si está aprobado y es necesario |
| Auditor institucional | R11 | Lectura y auditoría; sin edición del objeto auditado |
| Dirección/liderazgo ejecutivo hospitalario | R12 | Información agregada por defecto |
| Alcaldía | Contexto institucional, no rol de persona | Roles R7–R13 según función |
| Secretaría de Salud | Unidad/institución o cargo, no rol universal | Contexto municipal con permisos explícitos |
| Gestor municipal de programas | R7 | Municipio + programa |
| Planeación | Cargo + R7/R12 | Indicadores, programas y Hub según permisos |
| Finanzas municipal | R8 | Municipio + periodo/programa; sin clínica |
| Control interno/auditoría | R11 | Alcance municipal definido |
| Liderazgo ejecutivo municipal | R12 | Agregados y reportes autorizados |
| Responsable FURAG/MIPG | Función + R9 | Marco, periodo e institución |
| Responsable ADRES | Función + R9 | Fuente, periodo e institución |
| Responsable normativo | Función + R9 | Marco y requisitos asignados |
| Responsable de evidencias | Función + R9 | Categorías y objetos asignados |
| Responsable de formación/certificaciones | Función + R9 o R7 | Programa/marco; verificación mediante permiso separado |
| Administrador MERDN | R14 | Sin acceso clínico implícito |
| Soporte técnico | Subfunción restringida de R15 | Sin datos de negocio por defecto |
| Auditor de plataforma | Subfunción de R15 | Solo trazabilidad técnica autorizada |
| Integraciones | Subfunción de R15 | Ejecución/monitoreo por integración e institución |

## 5. Cargos frente a permisos

1. **RECOMENDADO:** cargo, dependencia y título profesional son atributos administrativos.
2. Un cargo puede activar una solicitud de asignación de roles, pero no debe concederlos automáticamente sin un flujo autorizado.
3. Dos personas con el mismo cargo pueden necesitar permisos diferentes por programa, territorio, vigencia o responsabilidad.
4. Los permisos de aprobación deben asignarse separadamente de los de creación cuando exista riesgo financiero, contractual, normativo o de evidencia.
5. Un responsable de FURAG, ADRES, T-319, SENA o evidencia se modela como asignación a un marco, requisito, periodo o conjunto de objetos, no como acceso global al Hub.
6. **POR DEFINIR:** catálogo institucional de cargos, mecanismo de aprobación de roles y reglas de incompatibilidad.

## 6. Contexto institucional activo

### 6.1 Composición

**RECOMENDADO:** antes de una operación institucional, el usuario debe actuar dentro de un contexto activo compuesto por:

- institución;
- municipio o territorio, cuando aplique;
- unidad o sede, cuando aplique;
- programa o servicio, cuando aplique;
- rol o función activa;
- finalidad de trabajo.

Ejemplo:

```text
Profesional X
→ Hospital A
→ Programa 1
→ Profesional asistencial
→ Finalidad: atención asignada
```

Ese contexto no concede acceso a Hospital B ni Programa 2. Para operar allí, la persona necesita otra afiliación y asignación vigentes y debe cambiar expresamente de contexto.

### 6.2 Reglas

1. El contexto debe mostrarse de forma clara en la interfaz.
2. Cambiar de institución o programa debe recalcular permisos.
3. Los registros creados conservan contexto, institución, programa, finalidad y actor.
4. Una vista agregada multiinstitucional requiere permiso específico y no permite escritura cruzada por defecto.
5. Enlaces, búsquedas, exportaciones y notificaciones deben reevaluar el contexto; no pueden confiar en una pantalla previa.
6. La selección de contexto y sus cambios son auditables para funciones privilegiadas o sensibles.
7. **POR DEFINIR:** duración de sesión, contexto predeterminado y controles para usuarios con muchas afiliaciones.

## 7. Relaciones entre personas

### 7.1 Modelo paciente-cuidador

**APROBADO:** la relación es muchos-a-muchos.

Cada vínculo debe almacenar como mínimo:

1. Paciente
2. Cuidador
3. Tipo de relación
4. Institución
5. Programa, cuando aplique
6. Alcance de datos y acciones
7. Autorización o fundamento aprobado
8. Fecha de inicio
9. Fecha de fin
10. Estado
11. Evidencia
12. Responsable de validación
13. Fecha, motivo y actor de revocación
14. Procedencia y auditoría

Estados recomendados: solicitada, pendiente de validación, activa, suspendida, vencida, revocada y rechazada.

### 7.2 Alcances posibles

**RECOMENDADO:** el alcance se compone de permisos específicos, por ejemplo: consultar agenda, registrar bitácora, reportar novedad, ver instrucciones autorizadas, ver medicamentos autorizados, cargar evidencia o gestionar citas. “Cuidador total” no debe usarse como permiso implícito.

### 7.3 Otras relaciones

- Representante legal o autorizado: relación con evidencia y alcance propio.
- Contacto cercano: dato de localización; sin acceso al sistema por defecto.
- Contacto de emergencia: canal de contacto; sin acceso al sistema por defecto.
- Profesional-paciente: asignación institucional, no relación personal permanente.
- Institución-paciente: inscripción, caso, programa o fuente autorizada; no propiedad absoluta de la persona.

**POR DEFINIR:** tipos jurídicos de representación, autoridad de validación, consentimientos, conflictos entre cuidadores, menores o personas sin capacidad plena y acceso excepcional.

## 8. Matriz de permisos

### 8.1 Acciones normalizadas

| Código | Acción | Alcance funcional |
| --- | --- | --- |
| V | Ver | Consultar datos o metadatos autorizados |
| C | Crear | Registrar un nuevo objeto o solicitud |
| E | Editar | Modificar un objeto abierto o mediante corrección permitida |
| AP | Aprobar | Validar, aprobar o rechazar formalmente |
| AS | Asignar | Vincular responsable, profesional, persona, programa o recurso |
| CL | Cerrar | Completar, resolver, archivar o cerrar con motivo |
| EX | Exportar | Generar extracción o reporte descargable |
| D | Descargar | Obtener un archivo o evidencia individual |
| AUD | Auditar | Consultar trazabilidad, accesos, cambios y aprobaciones |
| ADM | Administrar | Configurar catálogo, política, roles o ámbito delegado |

La ausencia de un código significa denegación por defecto. Cada código sigue sujeto a contexto y condiciones.

### 8.2 Grupos de dominios

Para mantener una matriz legible, los 33 dominios se agrupan sin fusionar sus controles:

- **ID:** cuenta e identidad.
- **PER:** personas, pacientes, cuidadores, profesionales, relaciones y consentimientos.
- **CARE:** agenda, bitácora, visitas, consultas virtuales, novedades y alertas.
- **CLIN:** información clínica autorizada y medicamentos.
- **PROG:** programas y población beneficiaria.
- **EVID:** documentos y evidencias.
- **TRAIN:** formación y SENA.
- **METRIC:** indicadores y reportes.
- **HUB:** FURAG/MIPG, ADRES y T-319/Hub Normativo.
- **FIN:** presupuesto, gastos, proveedores y contratos.
- **COMM:** servicios comerciales, membresías, pagos e ingresos hospitalarios.
- **AUDIT:** auditoría.
- **CFG:** configuración.
- **INT:** integraciones.

### 8.3 Matriz por rol técnico

| Rol | Dominios y acciones máximas posibles | Condiciones obligatorias |
| --- | --- | --- |
| R1 Autogestión | ID: V,E; PER: V,E; EVID: C,V,D | Solo datos propios y campos autogestionables; sin aprobar verificaciones propias |
| R2 Paciente | PER: V,E; CARE: V,C,E,CL; CLIN: V; EVID: C,V,D; TRAIN: V; COMM: V; METRIC: V | Solo datos propios; edición limitada; CLIN de fuente autorizada; COMM de su cuenta |
| R3 Cuidador autorizado | PER: V; CARE: V,C,E,CL; CLIN: V; EVID: C,V,D; TRAIN: V,C,E; COMM: V | Relación activa, alcance, institución, programa, finalidad y vigencia por paciente |
| R4 Profesional asistencial | PER: V; CARE: V,C,E,CL; CLIN: V; EVID: C,V,D; PROG: V; METRIC: V | Afiliación y asignación; competencia; solo pacientes y servicios autorizados; escritura clínica externa no asumida |
| R5 Coordinación asistencial | PER: V; CARE: V,C,E,AP,AS,CL; CLIN: V; PROG: V; EVID: V,D; METRIC: V,EX; AUDIT: AUD | Institución/programa; clínica solo cuando sea necesaria y autorizada; no alterar logs |
| R6 Operación institucional | PER: V,C,E; CARE: V,C,E,AS,CL; PROG: V; EVID: C,V,D; COMM: V | Institución/unidad; CLIN denegado por defecto; no aprobar su propia gestión sensible |
| R7 Gestión de programas | PER: V; PROG: V,C,E,AP,AS,CL; CARE: V; EVID: C,V,D; TRAIN: V; METRIC: V,C,E,EX; FIN: V; HUB: V | Institución/municipio/programa; detalle individual minimizado según finalidad |
| R8 Finanzas y contratación | FIN: V,C,E,AP,AS,CL,EX,D; COMM: V,C,E,AP,CL,EX; EVID: C,V,D; PROG: V; METRIC: V,EX; AUDIT: AUD | Sin CLIN; separación entre creación y aprobación; periodo e institución |
| R9 Cumplimiento y evidencia | HUB: V,C,E,AP,AS,CL,EX; EVID: V,C,E,AP,D,EX; TRAIN: V,AP; METRIC: V,C,E,AP,EX; FIN: V; PROG: V; AUDIT: AUD | Marco/requisito/periodo asignado; sin declarar oficial lo no oficial; sin alterar logs |
| R10 Calidad y supervisión | CARE: V; CLIN: V; EVID: V,D; PROG: V; METRIC: V,C,E,AP,EX; AUDIT: AUD | Detalle clínico solo aprobado y necesario; institución/programa; hallazgos separados del registro fuente |
| R11 Auditor institucional | EVID: V,D,EX; METRIC: V,EX; HUB: V; FIN: V; COMM: V; AUDIT: V,AUD,EX; CFG: V | Solo lectura del objeto auditado; alcance y periodo de auditoría; exportación separada |
| R12 Liderazgo ejecutivo | PROG: V; METRIC: V,EX; HUB: V; FIN: V; COMM: V; EVID: V | Agregados por defecto; sin CLIN; drill-down nominal requiere permiso adicional |
| R13 Administración institucional | ID: V,C,E,AP,AS,CL,ADM; PER: V; CFG: V,C,E,AP,ADM; INT: V; AUDIT: AUD | Solo institución delegada; sin CLIN/FIN por defecto; no asignarse privilegios propios sin aprobación |
| R14 Administración de plataforma | ID: V,C,E,AS,CL,ADM; CFG: V,C,E,AP,ADM; INT: V,ADM; AUDIT: AUD | Sin acceso implícito a contenido clínico, financiero, normativo o documental de negocio |
| R15 Operaciones técnicas controladas | AUDIT: V,AUD; INT: V,C,E,AP,CL,ADM; CFG: V; ID: V limitado | Permisos por subfunción; orden explícita; acceso temporal; sin contenido de negocio por defecto |

### 8.4 Matriz de cobertura de los 33 dominios

| Dominio solicitado | Grupo | Roles candidatos principales | Restricción crítica |
| --- | --- | --- | --- |
| Cuenta e identidad | ID | R1, R13, R14, R15 limitado | Una persona gestiona lo propio; administración por ámbito |
| Personas | PER | R1–R7, R13 | Minimización y contexto |
| Pacientes | PER | R2–R7 | Propio, relación o asignación |
| Cuidadores | PER | R3, R5–R7 | Relación y programa |
| Profesionales | PER | R4–R7, R13 | Afiliación y credenciales |
| Relaciones y consentimientos | PER | R1–R3 solicitud; R5/R6 validación | Aprobación, alcance y vigencia separados |
| Programas | PROG | R5–R7, R9, R12 | Institución/municipio/programa |
| Agenda | CARE | R2–R6 | Relación/asignación y servicio |
| Bitácora | CARE | R2–R5 | Autoría; corrección, no sobrescritura silenciosa |
| Visitas | CARE | R2–R6 | Asignación y evidencia |
| Consultas virtuales | CARE | R2–R6 | Participación autorizada |
| Información clínica autorizada | CLIN | R2–R5; R10 condicionado | Fuente hospitalaria y necesidad |
| Medicamentos | CLIN | R2–R5 | Lectura autorizada; no modificar prescripción externa |
| Novedades y alertas | CARE | R2–R7, R10 | Dominio, responsable y prioridad autorizada |
| Documentos y evidencias | EVID | R1–R13 según objeto | Categoría, sensibilidad y recurso padre |
| Formación y SENA | TRAIN | R3, R7, R9 | Verificación separada de declaración |
| Población beneficiaria | PROG | R7, R9, R12 | Agregada por defecto para municipio |
| Indicadores | METRIC | R5, R7–R12 | Fuente, fórmula, periodo y publicación |
| FURAG/MIPG | HUB | R9, R11, R12 | Sin puntuación oficial inventada |
| ADRES | HUB | R9, R11, R12 | Fuente y base autorizadas |
| T-319 y Hub Normativo | HUB | R9, R11, R12 | Interpretación aprobada; no prueba total automática |
| Presupuesto | FIN | R7, R8, R11, R12 | Sin clínica; fuente y periodo |
| Gastos | FIN | R8, R11, R12 | Separación crear/aprobar |
| Proveedores | FIN | R8, R11 | Institución y contratación |
| Contratos | FIN | R8, R11 | Versionado y separación de funciones |
| Servicios comerciales | COMM | R6, R8, R12, R13 configuración | Reglas comerciales aprobadas |
| Membresías | COMM | R2/R3 consulta; R6/R8 gestión | Cuenta autorizada y términos vigentes |
| Pagos | COMM | R2/R3 consulta; R8 gestión | Referencias controladas; datos sensibles separados |
| Ingresos hospitalarios | COMM | R8, R11, R12 | No equivale a contabilidad oficial |
| Reportes | METRIC | R5, R7–R12 | Nivel de agregación y exportación |
| Auditoría | AUDIT | R5/R8/R9/R10 limitado; R11; R14/R15 técnico | Solo lectura y ámbito explícito |
| Configuración | CFG | R13, R14; R15 limitado | Delegación y versionado |
| Integraciones | INT | R14, R15 integración; dueños funcionales consultan | Finalidad, institución, fuente y secretos protegidos |

## 9. Permisos sobre información clínica

1. **APROBADO:** MERDN no reemplaza inicialmente la Historia Clínica Electrónica.
2. La información clínica visible debe conservar fuente hospitalaria, institución, fecha original, fecha de recepción y procedencia disponible.
3. Paciente: puede ver su información autorizada.
4. Cuidador: puede verla solo si la relación específica lo permite.
5. Profesional: puede verla solo por afiliación, asignación, programa/servicio, finalidad y vigencia.
6. Coordinación/supervisión: acceso solo cuando sea necesario y expresamente concedido.
7. Alcaldía, Finanzas, liderazgo, administración y soporte: denegado por defecto.
8. Ningún rol MERDN modifica automáticamente una prescripción o registro clínico externo.
9. Ver, descargar, exportar e imprimir son permisos distintos.
10. Todo acceso clínico individual debe ser auditable.
11. **POR DEFINIR:** campos exactos, escritura o devolución al hospital, emergencia, retención, terminologías y reconciliación.

## 10. Permisos municipales

### 10.1 Agregado por defecto — RECOMENDADO

Alcaldía puede consultar, dentro de su municipio y finalidad autorizada:

- población beneficiaria y cobertura;
- territorio y brechas;
- programas, actividades y capacidad;
- agenda y prestación agregadas;
- indicadores y porcentajes;
- presupuesto, asignación, gastos y ejecución;
- proveedores, contratos y soportes autorizados;
- evidencia institucional;
- FURAG/MIPG, ADRES, T-319, SENA y otros marcos del Hub;
- responsables, acciones, estados y reportes ejecutivos.

### 10.2 Nominal — POR DEFINIR por finalidad

El acceso nominal municipal puede considerarse únicamente para funciones operativas o institucionales expresamente aprobadas, con base, finalidad, campos, programa, vigencia y auditoría definidos. La pertenencia a Alcaldía o Secretaría no lo concede.

### 10.3 Requiere autorización adicional

- Datos de contacto individual.
- Dirección o geolocalización exacta.
- Evidencia que identifique beneficiarios.
- Listados nominales y exportaciones.
- Detalle de atención individual.
- Información de cuidador o relaciones personales.
- Cualquier dato clínico individual.

### 10.4 Prohibido por defecto

- Historia o resumen clínico individual.
- Medicamentos, diagnósticos, alergias u observaciones clínicas nominales.
- Bitácoras individuales completas.
- Acceso masivo nominal sin finalidad y permiso específicos.
- Acceso a personas de otro municipio o institución sin relación autorizada.
- Uso de datos para una finalidad distinta de la aprobada.

## 11. Permisos financieros

1. R8 opera datos financieros y comerciales según subpermisos, no información clínica.
2. Puede usar identificadores mínimos de programa, actividad, servicio, población o beneficiario solo cuando la finalidad aprobada lo requiera.
3. Los soportes financieros no deben incorporar información clínica innecesaria.
4. Crear presupuesto, registrar gasto, aprobar, pagar o conciliar, y auditar son funciones separables.
5. Un usuario no debe aprobar su propio gasto o ajuste cuando se apruebe separación de funciones.
6. Los reportes financieros nominales requieren permiso independiente de los agregados.
7. MERDN no se considera sistema contable oficial ni procesador productivo de pagos por registrar referencias o estados.
8. **POR DEFINIR:** segregación obligatoria exacta, fuentes oficiales, flujos de aprobación, conciliación y datos de pago permitidos.

## 12. Permisos de cumplimiento y evidencia

1. R9 se restringe por institución, marco, requisito, periodo y responsabilidad.
2. FURAG/MIPG, ADRES, T-319, SENA y futuros marcos comparten capacidades, pero no permisos universales.
3. Crear evidencia, verificarla, aprobarla, cerrar una brecha y publicar un indicador son acciones distintas.
4. Solo roles autorizados pueden aprobar interpretaciones o aplicabilidad institucional.
5. Valores oficiales importados deben conservar fuente y no ser editables como cálculos internos.
6. Un responsable de evidencia no obtiene acceso automático a toda evidencia clínica, contractual o financiera.
7. La evidencia puede reutilizarse entre requisitos solo con relación trazable y autorización compatible.
8. R11 puede auditar la cadena sin modificar requisitos, evidencia fuente, indicadores ni logs.
9. **POR DEFINIR:** autoridades de aprobación, fuentes, periodos, marcos, evidencia válida y reglas de publicación.

## 13. Permisos comerciales hospitalarios

1. Catálogo, precio, capacidad, agenda, prestación, membresía, cobro, pago e ingreso son objetos distintos.
2. R6 puede gestionar agenda y prestación no clínica; R8 gestiona cobros, pagos e ingresos; R12 consulta resultados.
3. Paciente o cuidador consulta únicamente servicios, membresías y pagos propios o autorizados.
4. La prestación debe contar con evidencia antes de ser elegible para cobro o referencia de ingreso según reglas futuras.
5. Administrar servicios comerciales no concede clínica.
6. Gestionar pagos no concede edición de prestación ni evidencia.
7. **POR DEFINIR:** reglas, precios, aprobación, reembolsos, proveedores de pagos, datos financieros sensibles y protección al consumidor.

## 14. Auditoría

### 14.1 Sujetos autorizados

- R11: auditoría institucional dentro de alcance y periodo.
- R15-auditoría: auditoría técnica de plataforma dentro de orden autorizada.
- R5, R8, R9 y R10: trazabilidad limitada de los objetos que gestionan, sin acceso general a logs.
- R14: administración técnica de políticas, sin lectura universal del contenido auditado.

### 14.2 Información consultable según permiso

- logs de acciones;
- historial de versiones y estados;
- exportaciones y descargas sensibles;
- accesos a información clínica u otra información sensible;
- cambios anteriores y nuevos cuando sea apropiado;
- aprobaciones, rechazos y responsables;
- contexto institucional, resultado y procedencia.

### 14.3 Controles

1. Los eventos no pueden modificarse ni eliminarse mediante roles ordinarios.
2. Consultar o exportar auditoría también se audita.
3. El auditor no usa su rol para editar el registro auditado.
4. La exportación de logs es un permiso adicional.
5. Los valores sensibles se minimizan en la auditoría.
6. **POR DEFINIR:** retención, inmutabilidad, acceso cruzado, investigación y tratamiento de incidentes.

## 15. Acceso privilegiado

### 15.1 Administración de plataforma

R14 administra tenants, configuración global, referencias de roles e integraciones, pero no obtiene acceso implícito a contenido clínico, financiero, contractual, normativo o documental.

### 15.2 Soporte técnico

**RECOMENDADO:** soporte opera con metadatos técnicos y diagnósticos no sensibles por defecto. Cualquier acceso a contenido de negocio debe ser excepcional, temporal, solicitado, aprobado, limitado, justificado y auditado.

### 15.3 Acceso excepcional

**POR DEFINIR — no aprobado:** debe definirse si MERDN permitirá acceso de emergencia o soporte excepcional. Si se aprueba, requiere como mínimo motivo, solicitante, aprobador independiente, alcance, expiración, aviso cuando corresponda, registro completo y revisión posterior.

### 15.4 Suplantación o impersonation

**POR DEFINIR — alto riesgo y no aprobada:** no debe existir en el MVP salvo decisión expresa. Una futura función no debe reutilizar credenciales, debe mostrar claramente el modo de suplantación, impedir acciones no necesarias, registrar actor real y usuario representado, expirar automáticamente y requerir revisión.

### 15.5 Integraciones

El operador configura o ejecuta una integración específica dentro de una institución y finalidad. Acceder a credenciales no concede derecho a consultar los datos intercambiados, y los secretos no deben aparecer en código, UI ordinaria ni logs.

## 16. Conflictos de rol y separación de funciones

1. Una persona puede tener varios perfiles, roles y afiliaciones; los permisos se calculan por contexto, no por suma global.
2. R8 creador y R8 aprobador deben poder separarse.
3. R9 autor de evidencia y R9 aprobador deben poder separarse.
4. R13 no debe aprobarse a sí mismo roles privilegiados.
5. R11 no debe editar los objetos que audita dentro del mismo encargo.
6. R14 y R15 no deben combinarse automáticamente con roles de negocio.
7. Un profesional que también es cuidador debe cambiar de contexto y conservar distinta autoría y finalidad.
8. Un empleado municipal que también es paciente accede a su información personal mediante su contexto de paciente, no mediante su cargo.
9. **RECOMENDADO:** definir políticas de incompatibilidad y revisión periódica de privilegios.
10. **POR DEFINIR:** combinaciones prohibidas, excepciones para instituciones pequeñas y aprobación compensatoria.

## 17. Revocación y vigencia

1. Cuenta, perfil, afiliación, rol, permiso, relación, asignación, consentimiento y acceso excepcional tienen ciclos de vida independientes.
2. La revocación impide uso futuro, pero no elimina historia ni evidencia.
3. Los cambios deben surtir efecto en sesiones activas según una política de riesgo **POR DEFINIR**.
4. Vencimientos deben evaluarse en cada operación sensible.
5. La baja de un trabajador conserva autoría de registros y auditoría.
6. La suspensión de una relación cuidador-paciente afecta solo esa relación, no otras relaciones válidas.
7. La finalización de una afiliación institucional impide operar en esa institución, sin afectar afiliaciones diferentes.
8. Asignaciones temporales y accesos privilegiados deben expirar automáticamente.
9. Revocación, suspensión, reactivación y extensión son auditables.
10. **POR DEFINIR:** periodos, renovación, notificaciones, sesiones, revisiones de acceso y conservación.

## 18. Alcance MVP

### 18.1 Incluido — RECOMENDADO

- Persona, cuenta y múltiples perfiles.
- Afiliaciones a múltiples instituciones.
- Los 15 roles técnicos base con permisos limitados al alcance MVP.
- Contexto activo de institución, municipio, programa y función.
- Relación muchos-a-muchos paciente-cuidador con estado y vigencia.
- Asignación profesional por institución/programa/servicio.
- Denegación por defecto y evaluación contextual.
- Separación clínica, municipal, financiera, cumplimiento, comercial y técnica.
- Acciones diferenciadas: ver, crear, editar, aprobar, asignar, cerrar, exportar, descargar, auditar y administrar.
- Eventos de auditoría para accesos y acciones sensibles.
- Roles de Hospital y Alcaldía sobre capacidades compartidas.
- Administración institucional delegada.
- Administración y operación técnica sin acceso de negocio implícito.

### 18.2 Excluido o pendiente

- Suplantación.
- Acceso de emergencia.
- Permisos clínicos de escritura sobre el sistema hospitalario.
- Automatización jurídica o regulatoria.
- Matriz por campo definitiva.
- Delegación compleja y acceso multiinstitucional agregado.
- Integraciones productivas de identidad o directorios.

## 19. Decisiones abiertas

El Product Owner, con revisión especializada cuando corresponda, todavía debe decidir:

1. Métodos de autenticación, verificación de identidad y recuperación.
2. Si una persona puede tener más de una cuenta y cómo se reconcilian.
3. Catálogo definitivo de roles base y posibilidad de roles personalizados por institución.
4. Matriz definitiva de permisos por dominio, recurso, acción y sensibilidad.
5. Quién asigna, aprueba, revisa y revoca cada rol.
6. Catálogo de cargos y su relación con roles sugeridos.
7. Reglas de consentimiento, delegación y representación legal.
8. Validadores y evidencia para relaciones paciente-cuidador.
9. Acceso nominal municipal permitido y sus finalidades.
10. Datos clínicos exactos, acceso supervisor y política de emergencia.
11. Reglas exactas de separación financiera y contractual.
12. Autoridades de FURAG/MIPG, ADRES, T-319, SENA, evidencia e indicadores.
13. Reglas comerciales, de membresías, pagos, precios y reembolsos.
14. Permisos de exportación, descarga e impresión por dominio.
15. Políticas de incompatibilidad y doble aprobación.
16. Acceso excepcional de soporte y emergencia.
17. Si se permitirá suplantación; se recomienda no aprobarla para el MVP.
18. Duración de sesiones, efecto inmediato de revocación y revisión periódica de accesos.
19. Retención y protección de eventos de auditoría.
20. Requisitos de acceso en integraciones y administración de secretos.
21. Umbrales de anonimización y riesgo de reidentificación en reportes.
22. Proceso de acceso temporal y respuesta a incidentes.

## 20. Riesgos de mayor impacto

1. Acceso clínico individual por Alcaldía, Finanzas, Administración o soporte sin finalidad aprobada.
2. Cruce accidental entre municipios, instituciones, programas o afiliaciones.
3. Cuidador accediendo después del vencimiento o revocación de una relación.
4. Profesional consultando pacientes no asignados o fuera de su institución.
5. Exportaciones nominales masivas o descarga de evidencias sensibles.
6. Acumulación de creación, aprobación y auditoría en una misma persona.
7. Suplantación o acceso excepcional sin aprobación independiente y expiración.
8. Administrador de plataforma con acceso universal a contenido de negocio.
9. Integración que amplía acceso o trata datos fuera de su finalidad.
10. Presentación de datos internos como oficiales de FURAG/MIPG, ADRES, SENA o cumplimiento normativo.

## 21. Consistencia documental

No se identifican contradicciones materiales con `AGENTS.md`, `docs/PRODUCT.md` o `docs/MODULES.md`.

Este documento concreta el principio ya aprobado de autorización contextual y menor privilegio. Las matrices son recomendaciones funcionales, no una aprobación silenciosa de fundamentos jurídicos, datos clínicos, accesos municipales nominales, roles regulatorios oficiales, acceso excepcional o arquitectura técnica.
