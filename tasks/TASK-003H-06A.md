# ELÍGEME Task Specification

## Identificación y gate

- **Task ID:** TASK-003H-06A
- **Título:** Hospital — Nómina, liquidaciones y convenios
- **Estado:** APPROVED — READY FOR CLAUDE CODE (FRONTEND DEMOSTRATIVO)
- **Prioridad:** HIGH
- **Autoridad:** solicitud expresa de la Product Owner del 20 de agosto de 2026
- **Agente implementador futuro:** Claude Code, solo después de aprobación y cambio de gate
- **Agentes utilizados:** 01 MERDN Orchestrator; 02 UX/UI Fidelity Guardian; 03 Backend & Data Architect; 04 Security & Access Guardian; 05 Institutional & Regulatory Agent; 06 Integrations & Automation Agent; 07 QA & Acceptance Agent; 09 Frontend Application Architect
- **Dependencia:** TASK-003H-06 y su implementación frontend en curso
- **Gate actual:** **READY FOR CLAUDE: SÍ**

> En toda interfaz visible se usa exclusivamente **ELÍGEME**. `MERDN` es terminología técnica interna y no puede aparecer en títulos, ayudas, estados accesibles, errores, fixtures ni evidencia visual.

## 1. Objetivo y valor

Completar el diseño funcional, técnico, de seguridad y de integración de la nómina del programa, las liquidaciones laborales, los prestadores independientes y los convenios institucionales, evitando doble gestión cuando el Hospital ya posee un sistema de nómina o ERP.

ELÍGEME debe permitir dos modos de nómina configurables por institución y categoría: utilizar el sistema actual del Hospital como fuente maestra, o administrar la nómina del programa en ELÍGEME. Una persona vinculada laboralmente, un prestador independiente y una persona vinculada mediante convenio son relaciones distintas y no comparten cálculo, flujo ni permisos por inferencia.

ELÍGEME no se presenta como sistema contable oficial, asesor jurídico o contable, autoridad laboral, certificador del cumplimiento laboral ni procesador productivo de pagos.

## 2. Resultado por fase

### 2.1 Frontend local autorizado ahora

- navegación y vistas con datos exclusivamente ficticios;
- tablas, filtros, fichas, paneles de detalle y estados definidos en esta Task;
- selector demostrativo de modo de nómina y procedencia;
- desglose demostrativo de conceptos con valores predefinidos, nunca calculados mediante porcentajes legales;
- simulador visual que acepte datos ficticios pero no calcule una liquidación legal hasta existir catálogo y motor validados;
- controles inertes o rotulados `Demostración` para crear, aprobar, pagar, sincronizar, exportar o adjuntar;
- estados de carga, vacío, error, denegación, desconexión y conflicto mediante fixtures.

### 2.2 Requiere backend

- persistencia, APIs, RLS, auditoría, almacenamiento documental y control de concurrencia;
- autorización contextual y separación de funciones;
- periodos, novedades, conceptos, acumulados, liquidaciones, aprobaciones, pagos e historial reales;
- motor parametrizado y versionado de conceptos y fórmulas;
- validación de campos administrables según fuente maestra;
- deduplicación, conciliación, exportación y retención.

### 2.3 Requiere integración con nómina/ERP

- proveedor y sistema fuente identificados;
- contrato, credenciales por referencia, scopes, mapeo versionado y campos disponibles;
- modalidad archivo/API, solo lectura, bidireccional o mixta expresamente aprobada;
- jobs, outbox, idempotencia, reintentos, cuarentena, conflictos y reconciliación;
- sandbox o datos ficticios antes de cualquier conexión con datos reales.

### 2.4 Requiere validación legal y contable

- aplicabilidad y definición de cada concepto por tipo de contrato y periodo;
- fórmulas, porcentajes, topes, bases, redondeos, vigencias y tratamiento tributario;
- causales y componentes de terminación, indemnizaciones cuando correspondan y documentos;
- reglas de retención, comprobantes, aprobación, pago, reverso y conciliación;
- tratamiento de independientes y convenios.

## 3. Alcance y exclusiones

### Incluye

1. Configuración de los dos modos de nómina.
2. Nómina de empleados.
3. Simulador y expediente de liquidación.
4. Prestadores independientes, separados de nómina.
5. Personas vinculadas mediante convenio.
6. Convenios con empresas o entidades.
7. Procedencia, sincronización, conflictos, documentos, pagos e historial conceptual.
8. UX, permisos, auditoría, aceptación y pruebas.

### No incluye

- porcentajes, topes o fórmulas legales inventados o hard-coded;
- interpretación jurídica o contable definitiva;
- nómina real, pagos reales, contabilidad, facturación o integración activa;
- datos reales laborales, personales, contractuales, bancarios o financieros;
- cambios en Cuidador/Prestador, otras experiencias, `apps/**` o `prototype-claude/**`;
- modificación de TASK-003H-06 u otra Task;
- implementación, commit, push o despliegue.

## 4. Arquitectura funcional y dos modos de nómina

### 4.1 Configuración por institución y categoría

La configuración se realiza una vez por tenant, institución, programa opcional, categoría y vigencia. Debe declarar:

| Campo | Regla |
| --- | --- |
| Fuente maestra | `Sistema del Hospital` o `ELÍGEME` |
| Modalidad | `Importación autorizada`, `Integración`, `Registro manual` o `Mixta por campos` |
| Dirección | `Solo importar`, `Bidireccional futura` o `Mixta` |
| Sistema fuente | Nombre institucional controlado; no texto libre por registro |
| Categorías | Empleados, periodos, novedades, conceptos, comprobantes y pagos, habilitadas individualmente |
| Campos permitidos | Lista explícita de lectura y, si se aprueba, escritura por categoría |
| Frecuencia | Manual o programación aprobada; no inventar frecuencia del proveedor |
| Vigencia | Inicio, fin opcional y versión de configuración |
| Estado | `No configurada`, `Configurada`, `Conectada`, `Desconectada`, `Error` |

No se obliga a registrar de nuevo en ELÍGEME lo que ya administra el Hospital. Un campo cuya fuente maestra es externa queda de solo lectura local; un dato complementario local se conserva separado y no sobrescribe el dato externo.

### 4.2 Procedencia obligatoria por registro y campo gobernado

Cada registro conserva: fuente maestra, origen, sistema e institución fuente, identificador externo opcional, método de captura, versión externa o fecha observada, fecha de ingestión, última sincronización, ejecución/mapeo, estado de sincronización y conflicto. Estados de sincronización: `Local`, `Importado`, `Sincronizado`, `Pendiente`, `Conflicto`, `Error`, `Desconectado`, `Archivado`.

El estado laboral/financiero, documental y de sincronización son dimensiones independientes.

### 4.3 Campos de intercambio

La configuración futura podrá habilitar, si el sistema fuente realmente los ofrece y la institución los autoriza:

- persona mediante identificador opaco y código de personal;
- vínculo, cargo, tipo de contrato y vigencia;
- salario o base contractual;
- periodo y días/novedades trabajadas;
- conceptos devengados y deducidos;
- aportes y prestaciones reportados por la fuente;
- neto, costo institucional, estado y fecha de pago;
- referencia de comprobante y versión documental;
- correcciones y anulaciones.

No se importan credenciales, cuentas bancarias completas, payloads indiscriminados ni información clínica. ELÍGEME solo administra localmente los campos definidos por la configuración vigente y autorizada.

## 5. Modelo funcional de nómina de empleados

### 5.1 Separación e identidad

`EmployeePayrollEntry` representa una liquidación periódica de una relación laboral vigente; referencia a la persona y al vínculo, pero no duplica su expediente. Independientes y vinculados por convenio usan entidades distintas.

### 5.2 Ficha mínima

- empleado y código de personal;
- cargo y vínculo/contrato aplicable;
- salario o base contractual;
- periodo y fechas de corte;
- días trabajados y novedades autorizadas;
- devengados, deducciones, aportes y prestaciones aplicables;
- prima, vacaciones, cesantías e intereses de cesantías cuando el catálogo validado determine que aplican;
- otros conceptos legales configurados y versionados;
- neto a pagar;
- costo total para la institución;
- estado financiero, documental y de sincronización;
- comprobante y soportes;
- procedencia, versión de reglas, historial y auditoría.

### 5.3 Modelo de conceptos

Cada línea de concepto contiene: código interno estable, nombre visible validado, categoría, naturaleza (`Devengado`, `Deducción`, `Aporte`, `Prestación`, `Otro`), aplicabilidad contractual, base, cantidad, tasa opcional, valor, moneda, periodo, regla/versiones, fuente, resultado y estado de validación.

Los valores `base`, `tasa` y `valor` no implican aprobación legal. Ningún porcentaje, tope, salario mínimo, UVT, calendario, fecha límite o fórmula se codifica como constante legal.

### 5.4 Estados

`Borrador`, `En cálculo`, `Pendiente de revisión`, `Con observaciones`, `Aprobada`, `Programada`, `Pagada / Registrada`, `Rechazada`, `Anulada`. Una corrección crea versión o ajuste trazable; no sobrescribe el periodo aprobado o pagado.

## 6. Simulador y liquidación por terminación

### 6.1 Propósito y límites

Herramienta administrativa de estimación controlada. Debe mostrar prominentemente `Estimación sujeta a validación legal y contable` hasta que exista motor validado. No decide causal, derecho, indemnización ni valor definitivo.

### 6.2 Entradas

- persona y vínculo autorizado;
- escenario: `Renuncia`, `Terminación/despido` u `Otro sujeto a revisión`;
- tipo de contrato configurado;
- fecha de ingreso y retiro;
- salario/base y moneda;
- conceptos acumulados y pendientes;
- novedades y valores ya pagados/importados;
- versión del catálogo y fecha de corte;
- observaciones y soportes.

### 6.3 Resultado

- valor estimado total;
- desglose por componente;
- base, periodo y versión de regla por componente;
- conceptos excluidos, faltantes o pendientes de validar;
- advertencias de datos incompletos o conflicto;
- estado de revisión y aprobaciones;
- procedencia y timestamp de la simulación.

En el frontend demostrativo previo al motor validado, el desglose usa un escenario ficticio predefinido o muestra `Cálculo no disponible`; nunca calcula desde porcentajes incorporados por Claude.

### 6.4 Flujo y estados

`Borrador → Simulada → Pendiente de revisión legal/contable → Revisada → Aprobada → Programada → Pagada / Registrada`. También: `Requiere corrección`, `Rechazada`, `Anulada`. Simular y aprobar son permisos incompatibles por defecto; pago es una tercera función.

## 7. Prestadores independientes

Se mantienen fuera de nómina. La ficha contiene persona, profesión/servicio, contrato, modalidad (`Por hora`, `Por consulta`, `Por servicio`, `Mensual`, `Otra`), tarifa/honorarios, periodo, actividades realizadas, cuenta de cobro o factura, soportes, retenciones/descuentos solo si están configurados y validados, estado, pagos, procedencia e historial.

Estados documentales/financieros: `Recibida`, `En revisión`, `Requiere corrección`, `Aprobada`, `Programada`, `Pagada`, `Rechazada`, `Anulada`. Una actividad no prueba por sí sola prestación, aprobación o pago.

## 8. Persona vinculada mediante convenio

Entidad conceptual `AgreementPersonEngagement`, distinta de empleo e independencia. Contiene:

- persona y entidad que la vincula;
- convenio relacionado;
- función o servicio;
- modalidad económica configurada;
- responsable del pago;
- valor y moneda;
- periodicidad;
- documentos y vigencia;
- soportes, pagos y estado;
- procedencia, sincronización e historial.

Estados: `Borrador`, `Pendiente de validación`, `Vigente`, `Suspendida`, `Vencida`, `Finalizada`, `Anulada`. El rol o función no concede permisos clínicos, laborales ni financieros.

Si el origen futuro es la interfaz Cuidador/Prestador, se conserva un identificador interno estable y un evento/puerto de sincronización hacia Hospital y Gestión financiera. Esta Task no modifica esa interfaz ni presupone aprobación automática del vínculo.

## 9. Convenio con empresa o entidad

### 9.1 Ficha

- entidad y tipo/identificación controlada;
- objeto;
- fechas de inicio y fin;
- valor total y moneda;
- aporte Hospital y aporte de la otra entidad;
- recursos financieros y no financieros diferenciados;
- profesionales/cuidadores vinculados mediante relación explícita;
- forma de pago y periodicidad;
- facturas/cuentas de cobro;
- pagos y referencias;
- documentos y evidencias versionadas;
- ejecución y saldo, únicamente con definiciones institucionales aprobadas;
- estado, procedencia, sincronización e historial.

### 9.2 Vistas internas

`Resumen`, `Personas vinculadas`, `Recursos y movimientos`, `Facturas/cuentas`, `Pagos`, `Documentos`, `Ejecución` e `Historial`. Ningún documento prueba por sí solo vigencia, cumplimiento, ejecución o pago.

### 9.3 Estados

`Borrador`, `En revisión`, `Aprobado`, `Vigente`, `Suspendido`, `Vencido`, `Finalizado`, `Anulado`. La validez jurídica y las transiciones definitivas requieren aprobación institucional.

## 10. UX/UI vinculante para el frontend demostrativo

El diseño visual queda aprobado por decisión expresa de la Product Owner. **NO REQUIERE CLAUDE DESIGN.** Claude Code debe implementar, no diseñar. Debe reutilizar estrictamente el lenguaje visual ya aprobado de Hospital y Gestión financiera H-06: composición compacta y clara, iconografía Hospital existente, poco scroll de página, filtros alineados, KPI pequeños, tablas/listados escalables, drawers o paneles laterales para detalle, formularios simples y acciones evidentes. No se crea un design system, shell, navegación o estilo alternativo.

### 10.1 Navegación decidida

Se conserva el shell y menú secundario de TASK-003H-06. Bajo `Personas y pagos`:

1. `Nómina` abre el tablero de nómina.
2. `Prestadores / Honorarios` conserva su separación.
3. Se añade acceso contextual `Liquidaciones` dentro de Nómina, no como mezcla con honorarios.
4. `Convenios` permanece en `Abastecimiento` y abre ficha institucional; sus personas vinculadas son una subvista.

### 10.2 Tablero de nómina

Orden funcional requerido:

1. breadcrumb y encabezado `Nómina`;
2. cinco KPI pequeños, en este orden: `Personal en nómina`, `Nómina del periodo`, `Pendiente de revisión`, `Pendiente de pago`, `Costo total del periodo`;
3. franja `Fuente de nómina` con selector visual `Sistema del Hospital / Elígeme / Mixta`, estado de conexión, última sincronización, categorías importadas, conflictos y registros pendientes; toda conexión se rotula `Demostrativa · no activa`;
4. controles alineados, en este orden: `Buscar persona`, `Periodo`, `Estado`, `Tipo de contrato`, `Fuente: Hospital / Elígeme`;
5. tabla principal compacta con columnas, en este orden: `Persona`, `Cargo`, `Tipo de contrato`, `Salario/base`, `Devengados`, `Deducciones`, `Prestaciones/costos`, `Neto`, `Estado`, `Acción`;
6. la acción de fila se rotula `Ver` y abre el panel lateral;
7. navegación contextual: `Nómina`, `Liquidaciones`, `Prestadores / Honorarios`, sin mezclar sus registros.

Los KPI se distribuyen en una sola fila adaptable en escritorio y hacen wrap a dos columnas y luego una en viewports angostos. La barra de controles hace wrap conservando `Buscar persona` como primer control y la tabla usa encabezado persistente dentro de su contenedor; en móvil cada fila refluye a tarjeta, sin scroll horizontal de página.

### 10.3 Panel lateral `Ver` y prestaciones

El drawer ocupa como máximo 520 px en escritorio, ancho completo en móvil, cierra con `Escape`, conserva focus trap y devuelve foco a `Ver`. Contiene cinco secciones en este orden:

1. `Resumen`;
2. `Conceptos de nómina`;
3. `Prestaciones y costos`;
4. `Comprobante / historial`;
5. `Procedencia`.

`Prestaciones y costos` reserva filas para `Prima`, `Cesantías`, `Intereses de cesantías`, `Vacaciones`, `Aportes/costos aplicables` y `Otros conceptos configurados`. Cada fila muestra etiqueta, valor ficticio o `No aplica / Pendiente de configuración`, fuente y versión cuando corresponda. No contiene porcentajes.

### 10.4 Tablas y acciones

- Empleados: las columnas exactas de 10.2 y acción `Ver`.
- Liquidaciones: empleado, escenario, ingreso, retiro, estimado, revisión, estado, origen y acción `Abrir`.
- Convenios: entidad, objeto, vigencia, valor, ejecución, saldo, personas, documentos, estado y origen.
- Personas por convenio: persona, entidad vinculante, función, modalidad, pagador, valor, periodicidad, vigencia, pago y estado.

### 10.5 Formularios y botones

- `Configurar fuente`: panel con fuente maestra, modalidad, categorías, campos, frecuencia y vigencia; guardar es futuro backend.
- `Nuevo periodo`: panel; no permite valores reales en demo.
- `Registrar novedad`: panel vinculado al periodo y empleado.
- `Simular liquidación`: botón primario secundario dentro de Nómina; abre panel lateral de tres pasos: `Datos del vínculo → Conceptos → Resultado y revisión`.
- `Aprobar`, `Programar pago`, `Registrar pago`, `Resolver conflicto` y `Exportar` permanecen inertes hasta backend/permisos.
- `Nuevo convenio` y `Vincular persona`: paneles separados.

El formulario de simulación contiene, en este orden: persona, tipo de contrato, fecha de ingreso, fecha de retiro, motivo (`Renuncia`, `Terminación`, `Otro autorizado`), salario/base, conceptos acumulados y conceptos pendientes. El resultado visual contiene: salario pendiente; prima proporcional cuando corresponda; cesantías cuando corresponda; intereses de cesantías cuando corresponda; vacaciones pendientes cuando corresponda; otros conceptos aplicables; deducciones aplicables; y total estimado. El resultado lleva badge y aviso persistente `Estimación demostrativa`; usa exclusivamente fixtures predefinidos y no calcula fórmulas legales.

Convenios presenta dos subpestañas: `Personas vinculadas` y `Empresas / entidades`. Ambas usan tabla compacta y panel lateral. `Personas vinculadas` muestra persona, entidad, convenio, servicio/función, modalidad de pago, valor, periodicidad, quién paga, vigencia, documentos, pagos, estado y origen. Cuando corresponda el origen visible es `Origen: solicitud del prestador`; no enlaza ni modifica Cuidador. `Empresas / entidades` muestra entidad, objeto, vigencia, valor total, aporte Hospital, aporte entidad, ejecución, saldo, forma de pago, periodicidad, personas vinculadas, documentos, facturas/cuentas y pagos.

### 10.6 Estados y accesibilidad

Cada superficie debe definir carga, vacío, sin resultados, denegación, datos desactualizados, desconexión, conflicto, error, éxito y confirmación. Tablas refluye a tarjetas en móvil; filtros se abren en panel; drawers conservan foco; totales no dependen solo del color; salarios y honorarios se enmascaran cuando falta permiso de detalle.

### 10.7 Decisión visual cerrada

`TASK-003H-06`, el shell Hospital y las reglas 10.1–10.6 constituyen la referencia vinculante suficiente. No se requiere una nueva pantalla en Claude Design. Ante una ambigüedad local, Claude Code reutiliza el componente/patrón H-06 equivalente y conserva el orden, texto, densidad y comportamiento descritos; no introduce variantes visuales nuevas.

## 11. Datos, propiedad y retención

Los datos pertenecen al tenant y a la institución/programa autorizado. Salarios, honorarios, liquidaciones, contratos, identificaciones, comprobantes y pagos son `FINANCIAL` y `SENSITIVE_PERSONAL`. Documentos heredan la mayor sensibilidad de su relación.

Entidades conceptuales: `PayrollConfiguration`, `PayrollPeriod`, `EmploymentEngagement`, `EmployeePayrollEntry`, `PayrollConceptDefinition`, `PayrollConceptVersion`, `PayrollEntryLine`, `TerminationSettlement`, `SettlementComponent`, `IndependentEngagement`, `IndependentFeeClaim`, `InstitutionalAgreement`, `AgreementContribution`, `AgreementPersonEngagement`, `AgreementMovement`, `PaymentReference`, `FinancialDocument`, `SourceRecord`, `SyncRun`, `SyncConflict`, `AuditEvent`.

Toda entidad aislada incluye `tenant_id`; las FKs impiden asociaciones cross-tenant. La política de retención y disposición exacta es una decisión pendiente; no se habilita borrado material ni se hard-codea un plazo.

## 12. Permisos y separación de funciones

| Acción | Finanzas nómina | Revisor/aprobador | Tesorería | Admin. Hospital | Auditor | Coordinador | Persona vinculada |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ver salarios individuales | Con permiso expreso y alcance institucional | Solo lo necesario | Solo lo necesario para pago | No por defecto | Según mandato | No | Solo propio autorizado |
| Simular liquidación | Sí, con permiso específico | No por defecto | No | No por defecto | No | No | No |
| Aprobar liquidación | No sobre propia simulación | Sí, con permiso específico | No | No por defecto | No | No | No |
| Ver honorarios | Con permiso expreso | Según alcance | Solo pago | No por defecto | Según mandato | No | Solo propios |
| Ver convenios | Según función y convenio | Sí | Solo componentes de pago | Según alcance institucional | Según mandato | Agregado/operativo autorizado | Solo vínculo propio autorizado |
| Registrar pago | No aprobar el propio | No | Sí | No por defecto | No | No | No |
| Aprobar pago | Separado de creación y registro | Sí, si se delega | No sobre registro propio | No por defecto | No | No | No |
| Activar/configurar integración | No por defecto | No | No | Permiso de integración separado | Solo lectura auditada | No | No |
| Resolver conflicto | Usuario autorizado de datos + integración | Según impacto | No por defecto | Permiso separado | Solo observar | No | No |

Toda autorización se aplica en servidor con rol, tenant, institución, programa, finalidad, vigencia y acción. La UI no concede permisos. Finanzas no obtiene acceso clínico.

## 13. Auditoría

Registrar de forma append-only y minimizada: creación/cierre de periodo; acceso individual a salario, honorarios o liquidación; simulación y versión usada; envío, revisión, aprobación, rechazo, anulación y pago; configuración de fuente/campos; importación; conflicto y resolución; carga/descarga documental; exportación; consulta/exportación de auditoría.

No registrar valores salariales completos, cuentas, documentos o payloads externos en logs ordinarios. Acciones materiales fallan cerradas si no puede registrarse la auditoría requerida.

## 14. Integración conceptual

Flujo: `sistema nómina/ERP → adaptador versionado → validación/cuarentena → importación idempotente → modelo canónico → reconciliación → auditoría`. El write-back futuro, si se aprueba, usa `outbox → worker → adaptador → resultado → reconciliación`; nunca bloquea la transacción local ni sobrescribe silenciosamente.

Claves conceptuales: tenant + sistema + tipo + identificador externo + versión/periodo. Conflictos: identidad no conciliada, campo maestro divergente, versión externa posterior, periodo cerrado, concepto desconocido, duplicado y estado incompatible. Resolver conserva ambos valores, actor, motivo y decisión.

No asumir API, campos, proveedor, webhooks, frecuencia ni bidireccionalidad. Archivo controlado es una modalidad distinta de integración API y debe rotularse.

## 15. Restricciones institucionales y regulatorias

Antes de producción, asesoría laboral y contable colombiana debe validar el catálogo aplicable a cada tipo de contrato y vigencia. Como categorías de diseño —no como afirmación de aplicabilidad ni fórmula— el sistema debe poder representar salario/base, días, devengados, deducciones, aportes, prestaciones sociales, prima, vacaciones, cesantías, intereses de cesantías y otros conceptos configurados.

La aplicabilidad por contrato, las bases, tasas, topes, fechas, redondeos, indemnizaciones, retenciones y documentos son parámetros versionables con fuente normativa/institucional, vigencia, responsable y estado de aprobación. Hasta su validación se muestran como `Pendiente de validación legal/contable` y no se calculan.

## 16. Criterios de aceptación

1. Se distinguen dos modos de nómina sin doble captura obligatoria.
2. Fuente maestra, origen, campos, sincronización y conflicto son visibles y separados.
3. Empleados, independientes y vinculados por convenio usan modelos y pantallas distintos.
4. La ficha de nómina contiene todos los campos solicitados sin porcentajes o fórmulas inventadas.
5. El simulador muestra escenario, entradas, desglose, versión, faltantes y advertencia; no afirma valor legal definitivo.
6. Convenio institucional y persona vinculada contienen todos los campos solicitados.
7. Ningún control real de aprobación, pago, integración o documento se simula como exitoso sin backend.
8. Matriz de permisos y SoD se aplica en servidor en la fase productiva.
9. Toda operación sensible es tenant-aware y auditable.
10. La UI visible usa ELÍGEME y nunca MERDN.
11. `prototype-claude/**`, `apps/**` y otras Tasks permanecen intactos.
12. Claude Code implementa únicamente el frontend demostrativo aprobado, sin backend, red, persistencia, integración activa ni cálculos legales.

## 17. Pruebas requeridas para una futura implementación

- componentes y navegación de todas las pestañas/estados;
- cálculos: rechazo de regla no aprobada, versionado, vigencia, denominador/base faltante y reproducibilidad;
- API/DTO, validación, concurrencia, periodo cerrado e idempotencia;
- permisos positivos/negativos y separación creador–aprobador–pagador;
- dos tenants, dos instituciones, RLS real y FKs cross-tenant;
- salarios/honorarios propios, ajenos, enmascarados y denegados;
- integración: éxito, timeout, duplicado, versión, conflicto, desconexión y reconciliación;
- documentos privados, versión, tipo falso, malware, descarga y reautorización;
- auditoría, minimización de logs y fallo cerrado;
- teclado, foco, lectores de pantalla, contraste, reflow y ausencia de dependencia exclusiva del color;
- regresión de TASK-003H-06 y del shell Hospital.

## 18. Archivos permitidos y prohibidos para Claude Code

Permitidos únicamente los archivos estrictamente necesarios bajo `apps/web/src/features/hospital/**`: composición financiera existente, contratos/fixtures locales, componentes, CSS Module y pruebas de Gestión financiera. `apps/web/src/app/hospital/page.tsx` solo si resulta imprescindible para montar la vista; preferir el punto de integración existente. No se autorizan dependencias nuevas.

Prohibidos: `prototype-claude/**`, `docs/**`, `agents/**`, `reviews/**`, `tasks/**`, `AGENTS.md`, `CLAUDE.md`, backend, base de datos, paquetes, lockfiles, otras experiencias, Git y despliegue.

## 19. Decisiones aprobadas

1. Existen dos modos de nómina y no se obliga doble gestión.
2. La fuente maestra se configura por categoría/campo y vigencia.
3. Empleados, independientes y convenios permanecen separados.
4. No se hard-codean porcentajes ni fórmulas legales.
5. Liquidación es estimación controlada hasta validación jurídica/contable.
6. La interfaz Cuidador/Prestador no cambia en esta Task.
7. ELÍGEME es el único nombre visible.

## 20. Decisiones futuras no bloqueantes para el frontend

**REQUIERE CLAUDE DESIGN: NO.**

Quedan para backend, integración o validación especializada posterior y no bloquean esta demostración:

- catálogo laboral y aplicabilidad por tipo de contrato;
- fórmulas, tasas, topes, vigencias, redondeos e indemnizaciones;
- roles institucionales concretos asignados a los permisos de nómina/pago;
- flujo definitivo de aprobación y pago;
- retención/disposición;
- sistema de nómina/ERP real, capacidades, campos, dirección y credenciales;
- criterio de matching de personas y resolución de conflictos;
- significado institucional de ejecución y saldo del convenio.

No existen decisiones frontend materiales pendientes ni bloqueos frontend. La implementación debe limitarse a fixtures/local state, marcar conexiones `Demostrativa · no activa`, resultados `Estimación demostrativa` y acciones sin efecto real.

## 21. Evidencia requerida en el futuro handoff

Claude Code deberá devolver archivos y propósito, trazabilidad requisito-prueba, URL local, capturas por viewport/estado, datos ficticios, contratos consumidos, resultados exactos de lint/typecheck/tests/build, pruebas de permisos/tenant/RLS/integración, ausencia de fórmulas hard-coded y datos sensibles, y confirmación de que no modificó rutas prohibidas.

**READY FOR CLAUDE: SÍ**
