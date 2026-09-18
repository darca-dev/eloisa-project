# ALCALDÍA — TASK A-04

## Presupuesto, movimientos financieros y evidencias

## 1. Identificación y gate

- **Task ID:** `TASK-ALCALDIA-A-04`
- **Título:** Presupuesto, movimientos financieros y evidencias de Alcaldía
- **Estado:** READY FOR IMPLEMENTATION
- **Prioridad:** Alta
- **Autoridad funcional y visual:** Product Owner
- **Preparada por:** Codex, MERDN Lead Architect
- **Rama inspeccionada:** `develop`
- **Naturaleza:** incremento frontend demostrativo, con fixtures ficticios/configurables y estado exclusivamente local cuando se requiera interacción
- **Gate:** **READY FOR CLAUDE: SÍ**, limitado estrictamente a la allowlist de §18. El diseño aprobado de **Presupuesto y ejecución** y **Evidencias de ejecución** es suficiente. No se crean nuevas pantallas ni subsecciones visuales de Movimientos, Redistribución o Conciliación.

## 2. Objetivo y valor

Implementar exclusivamente la experiencia municipal A-04 para que una Alcaldía pueda comprender, mediante datos demostrativos claramente rotulados:

1. de qué fuente procede cada recurso;
2. cuál es el presupuesto asignado;
3. cuánto se asignó por programa;
4. cuánto está comprometido;
5. cuánto se declara pagado/ejecutado en el fixture;
6. cuánto queda disponible;
7. qué movimientos explican las cifras;
8. qué evidencias administrativas soportan los movimientos; y
9. qué diferencias quedarían sujetas a conciliación cuando exista una integración autorizada.

A-04 no construye un ERP, sistema contable gubernamental, procesador de pagos, repositorio documental productivo, integración activa ni auditoría backend. Tampoco valida cifras como oficiales.

## 3. Hechos, decisiones, supuestos y recomendaciones

### 3.1 Hechos verificados

1. A-01, A-02 y A-03 están implementadas en `apps/web/src/features/municipality/**`.
2. `presupuesto` y `evidencias` existen en la navegación de Alcaldía, pero todavía montan «Próximamente».
3. A-03 ya centraliza Programas y declara que el detalle financiero/documental corresponde a A-04.
4. La referencia visual aprobada contiene las vistas **Presupuesto y ejecución** y **Evidencias de ejecución** en `prototype-claude/Eligeme-Alcaldia.dc.html`.
5. Los importes, porcentajes, proveedores, actividades y soportes del prototipo son referencias demostrativas, no datos oficiales ni reglas contables.

### 3.2 Decisiones aprobadas del Product Owner

1. A-04 es solo frontend demostrativo.
2. Se conserva el diseño visual aprobado sin rediseñarlo ni copiar su código/runtime.
3. Cada recurso conserva fuente; ADRES no es sinónimo de presupuesto municipal.
4. Un único movimiento compartido debe poder ser visible para Hospital y Alcaldía según permisos, sin doble registro.
5. A-04 no modifica Hospital; la conexión futura corresponde a H-06B.
6. Subir o declarar una factura no convierte automáticamente un movimiento en pagado/ejecutado.
7. Los registros incompletos pueden mostrarse como pendientes, sin afectar una ejecución validada futura.
8. No se define un monto fijo para doble aprobación de redistribuciones.
9. Se reutiliza la entidad/configuración Programa de A-03; no se duplica.

### 3.3 Supuestos controlados para este slice

1. Todos los datos visibles son ficticios y se cargan desde configuración TypeScript local.
2. Los saldos y porcentajes se presentan como literales coherentes del fixture, no como fórmula contable universal.
3. `Ver evidencia` puede mostrar metadatos ficticios dentro del patrón visual existente; no descarga ni previsualiza archivos reales.
4. Redistribución queda exclusivamente como contrato frontend futuro, sin botón, formulario, modal, borrador ni operación.
5. Conciliación queda exclusivamente como metadatos de procedencia/sincronización futura, sin panel ni operación; cualquier mención visible usa «Conexión no habilitada».

## 4. Usuarios, instituciones y alcance de datos

- **Experiencia afectada:** Alcaldía/gobierno municipal.
- **Contexto visual:** perfil municipal del shell A-01.
- **Instituciones relacionadas:** Alcaldía, programas municipales y entidades/proveedores ficticios; Hospital solo como posible sistema/entidad relacionada en metadatos demostrativos.
- **Tenant:** la UI demo no implementa tenant ni concede permisos. El futuro acceso se limitará por tenant, organización, municipio, programa, finalidad, periodo y relación autorizada.
- **Datos permitidos:** montos agregados, programas, fuentes, proveedores/entidades cuando corresponda, metadatos administrativos y evidencias autorizadas.
- **Datos prohibidos:** HCE, diagnóstico individual, datos clínicos nominativos, documentos/direcciones de pacientes, salarios individuales, honorarios individuales sensibles, PAN/CVV/credenciales bancarias, secretos y documentos reales.

La visibilidad de una pantalla no implica autorización productiva. La matriz definitiva de permisos se mantiene como decisión futura y no bloquea este slice sin red ni datos reales.

## 5. Alcance funcional

### FR-01 — Navegación y vistas

1. Activar contenido propio para `presupuesto` y `evidencias` dentro del shell municipal existente.
2. Sidebar y accesos rápidos existentes deben abrir la vista correcta, conservar estado activo y trasladar el foco al `h1`.
3. No crear rutas, layouts, providers, contexto global, acceso de red ni persistencia.

### FR-02 — Rotulado demostrativo y fidelidad

1. Ambas vistas mostrarán `municipalityDemo.etiqueta` y aclaración inequívoca de que cifras, movimientos, fuentes y evidencias son demostrativos/no oficiales.
2. Preservar jerarquía, lenguaje visual, tarjetas, métricas, tabla/listas, colores, densidad y responsive del prototipo y del shell implementado.
3. Toda extensión solicitada que no aparece en la referencia debe usar el sistema visual municipal existente, sin rediseñar las secciones vinculantes.
4. La marca visible es **ELÍGEME/Elígeme**; `MERDN` no aparece en copy visible o accesible.

### FR-03 — Resumen presupuestal general

Mostrar juntos y en este orden conceptual:

- Asignado;
- Ejecutado/Pagado;
- Comprometido;
- Disponible; y
- porcentaje de ejecución financiera.

Los valores deben proceder de un fixture central y ser internamente coherentes. Para A-04 demo se aplican estas definiciones aprobadas:

- **ASIGNADO:** presupuesto aprobado/asignado al programa.
- **COMPROMETIDO:** recurso reservado o comprometido que todavía no está pagado.
- **EJECUTADO:** dinero pagado y validado para efectos exclusivos de la demo.
- **DISPONIBLE:** saldo demostrativo restante según fixtures coherentes.

Solo los movimientos marcados explícitamente como pagados y validados alimentan `EJECUTADO`. Una factura o soporte cargado no cambia por sí solo el estado ni las métricas. No derivar una regla contable productiva ni presentar la validación demo como oficial.

### FR-04 — Presupuesto por programa

1. Reutilizar los IDs y relaciones de `municipalityProgramasDemo`/configuración A-03; no crear otra entidad Programa. `MunicipalityPrograma.origen` describe origen/formulación del programa y no debe reutilizarse como fuente financiera.
2. Por programa mostrar:
   - presupuesto asignado;
   - comprometido;
   - ejecutado/pagado;
   - disponible;
   - porcentaje de ejecución financiera;
   - meta física;
   - porcentaje de cumplimiento físico; y
   - fuente o desglose de fuentes aplicable.
3. Mantener visible la cadena **Programa → dinero → actividad → evidencia → resultado**, acompañada de una nota que limite la relación a casos metodológicamente válidos.
4. No recalcular ni reinterpretar las métricas A-03; si se comparten datos, debe existir una única configuración fuente.

### FR-05 — Fuentes de financiación

El catálogo demo configurable debe incluir exactamente estas opciones base, sin convertirlas en lista productiva cerrada:

1. `SGP Salud Pública`;
2. `Recursos propios`;
3. `Recursos Nación`;
4. `Recursos Departamento`;
5. `ADRES / recurso administrado o girado mediante ADRES`;
6. `Convenios`; y
7. `Otra fuente`.

Cada asignación/movimiento/evidencia aplicable conserva un `fuenteId`. La opción ADRES solo se usa en fixtures donde corresponda y nunca domina todo el presupuesto.

### FR-06 — Semántica financiera MVP

1. Preparar y explicar la secuencia conceptual futura: **ASIGNADO → COMPROMETIDO → CAUSADO/OBLIGADO → PAGADO**; para la demo, `EJECUTADO` equivale exclusivamente a dinero **PAGADO Y VALIDADO**.
2. Distinguir el estado de procesamiento/soporte (`PENDIENTE`, `EN REVISIÓN`, `FALTA SOPORTE`, `VALIDADA`) de los estados financieros.
3. Ningún estado se comunicará solo por color.
4. Una factura o evidencia por sí sola no cambia el estado financiero ni las métricas.
5. Solo un estado financiero válido podrá afectar saldos en la futura lógica productiva; A-04 no implementa esa lógica.
6. No inventar reglas de transición, asientos, causación, cierre, aprobadores o metodología contable.

### FR-07 — Historial demostrativo de movimientos en «Facturas y soportes»

No crear una sección visual «Movimientos». Reutilizar la tabla aprobada **Facturas y soportes** de **Evidencias de ejecución** como historial demostrativo de movimientos financieros. Cada fila debe mostrar:

- fecha;
- factura/cuenta;
- proveedor/entidad;
- programa;
- fuente;
- valor;
- estado del soporte/validación;
- soporte;
- origen del dato; y
- acción `Ver evidencia`.

La fila puede conservar en su contrato campos no visibles como concepto, tipo y responsable institucional. Debe existir al menos un fixture pendiente, en revisión o sin soporte que no esté presentado como pagado/ejecutado. La tabla demuestra **Programa → Movimiento → Pago/Gasto → Evidencia** sin crear navegación nueva.

### FR-08 — Detalle y procedencia del movimiento

El detalle local debe poder presentar, cuando aplique:

- ID interno demo;
- `source/origen`;
- `external_id` opcional;
- sistema maestro;
- estado de sincronización;
- fecha de última sincronización opcional;
- quién/rol registró;
- fecha/hora de registro;
- quién/rol revisó y fecha de revisión, ambos opcionales;
- programa;
- fuente;
- entidad;
- movimiento/evidencias relacionadas;
- estado financiero y estado de validación.

Orígenes visibles permitidos: `Elígeme`, `Sistema del Hospital`, `Sistema de Alcaldía`, `Importado`, `Fuente oficial externa cuando corresponda`. Un origen no prueba que exista conexión activa.

### FR-09 — Registro financiero único Hospital–Alcaldía

1. El tipo frontend de movimiento representará un solo registro canónico con uno o varios contextos de visibilidad, no copias por experiencia.
2. Conservar `id`, una colección opcional de referencias externas (`sourceSystem`, `institutionId` demo, `externalId`), `masterSystem`, `syncStatus` y `lastSyncedAt` como metadatos preparatorios. Un `externalId` no es identidad global.
3. Los fixtures demostrarán procedencia y posible relación con Hospital sin importar código, estado o configuración desde `features/hospital`.
4. No implementar matching, deduplicación productiva, idempotencia, intercambio, permisos compartidos o sincronización.
5. H-06B definirá el contrato e integración posterior.

### FR-10 — Redistribución diferida

1. No implementar botón, formulario, modal, previsualización, borrador ni operación de redistribución en A-04.
2. Mantener únicamente un contrato/tipo frontend preparatorio, sin instancia visible ni estado ejecutable, con: programa origen, programa destino, valor, motivo, responsable, fecha y aprobación futura.
3. El contrato debe admitir una política futura configurable de segunda aprobación sin definir umbral, aprobador ni monto fijo.
4. La validación, persistencia, trazabilidad operativa y efectos sobre saldos corresponden a una Task posterior.

### FR-11 — Evidencias de ejecución

Preservar y completar la vista aprobada con:

- nivel de evidencia porcentual;
- actividades con soporte;
- pendientes;
- factura/cuenta o referencia del soporte;
- proveedor/entidad;
- programa;
- fuente;
- valor;
- estado del soporte; y
- acción `Ver evidencia`.

Tipos demo autorizados: factura, cuenta de cobro, recibo, comprobante de pago, contrato, convenio, orden, fotografía, constancia y otro soporte autorizado.

Estados demo de evidencia: `COMPLETA`, `PENDIENTE`, `FALTA SOPORTE`, `EN REVISIÓN`, `VALIDADA`, `REQUIERE CORRECCIÓN`. No deben interpretarse como estados financieros.

### FR-12 — Relación evidencia–movimiento

1. Una evidencia referencia el movimiento mediante `movimientoId` cuando corresponda; no se embebe un movimiento duplicado.
2. Una evidencia faltante obligatoria permite que el movimiento permanezca pendiente, pero nunca que aparezca como pagado/ejecutado validado.
3. `Ver evidencia` abre solo metadatos y una indicación de que el archivo demo no es descargable; no debe existir blob, URL pública, upload, input de archivo o descarga.
4. Los metadatos preparados incluyen origen, autor/rol, fecha, revisión, estado, institución, programa, fuente, movimiento asociado y tipo.
5. No implementar checksum, versión, antimalware, retención, almacenamiento ni ACL documental; se registran como requisitos futuros.

### FR-13 — Conciliación operativa diferida

1. No implementar subsección, pantalla, contadores, controles ni flujo operativo de conciliación.
2. Mantener en el contrato del movimiento los campos preparatorios `source`, `externalId`, `masterSystem`, `syncStatus` y `lastSync` opcional.
3. Si alguno de esos metadatos se muestra dentro de `Ver evidencia`, una conexión inexistente debe indicarse como **Conexión no habilitada** y `lastSync` como no aplicable/sin sincronización.
4. La conciliación operativa se difiere a una Task posterior junto con la integración Hospital/Alcaldía.

### FR-14 — Relación con población y resultados

1. Conservar visible el desglose aprobado **Por población**. Adulto mayor, Discapacidad y Cuidado en casa son poblaciones base, distintas de Programa.
2. Relacionar Programa solo dentro de las estructuras existentes, cuando sea metodológicamente válido y sin crear navegación compleja. Cuando el fixture lo permita, mostrar Programa → beneficiarios únicos → presupuesto → ejecutado → costo promedio.
3. Los beneficiarios son agregados deduplicados y no se obtienen sumando poblaciones/programas.
4. No asignar gasto a personas por pertenecer a 60+, discapacidad o cuidado en casa.
5. No mostrar drill-down nominal ni derivar el costo promedio cuando el fixture no declare numerador, denominador y metodología.

### FR-15 — Preparación para reportes

La configuración tipada debe permitir consolidar posteriormente: asignado, comprometido, ejecutado, disponible, porcentaje, programa, fuente, evidencia, beneficiarios y resultado. A-04 no crea exportaciones, informes ni nueva vista Reportes.

## 6. Modelo frontend demostrativo

Los nombres son orientativos para TypeScript local, no contratos productivos ni esquema de base de datos.

| Concepto | Campos mínimos preparados | Relación |
| --- | --- | --- |
| `FundingSourceDemo` | `id`, `label`, `kind`, `isAdresRelated`, `demo` | Programa/asignación/movimiento/evidencia referencian por ID |
| `ProgramBudgetDemo` | `programId`, importes declarados, porcentaje declarado, meta/cumplimiento, `sourceAllocations` | `programId` debe resolver contra A-03 |
| `FinancialMovementDemo` | `id`, fecha, concepto, `programId`, tipo, `sourceId`, entidad, valor/moneda, estado financiero, estado de validación, evidencias, origen, responsable y metadatos sync | Registro único; no copia Hospital/Alcaldía |
| `FinancialEvidenceDemo` | `id`, referencia, tipo, proveedor/entidad, `programId`, `sourceId`, valor/moneda, estado, `movementId`, procedencia y revisión | Relación explícita con movimiento |
| `BudgetRedistributionContract` | origen, destino, valor, motivo, responsable, fecha y aprobación futura | Solo tipo/contrato para una Task posterior; sin instancia ni estado UI |

Reglas de integridad del fixture:

1. Todo `programId` resuelve contra la configuración de A-03.
2. Todo `sourceId` resuelve contra el catálogo de fuentes.
3. Todo `movementId` de evidencia resuelve a un movimiento existente.
4. `externalId` es opcional y no se usa como identidad interna.
5. Una clave conceptual futura de deduplicación debe incluir tenant/institución, sistema fuente y external ID o estrategia gobernada; A-04 no la decide ni ejecuta.
6. Los importes numéricos para validación local se separan de sus etiquetas formateadas; no parsear strings monetarios de UI.
7. El fixture global documenta explícitamente su identidad contable local si usa `asignado = comprometido + ejecutado + disponible`; no generalizarla.

## 7. Propiedad, sensibilidad, procedencia y retención

| Dato | Propietario futuro | Sensibilidad | Procedencia A-04 | Retención/linaje |
| --- | --- | --- | --- | --- |
| Presupuesto/asignación | Institución/tenant autorizado | Confidencial institucional | Fixture ficticio | No persistido; regla productiva por definir |
| Movimiento | Institución dueña/sistema maestro | Financiera confidencial | Fixture ficticio con origen declarado | No persistido; corrección/ajuste trazable futuro |
| Fuente | Dueño funcional/institucional | Institucional | Catálogo demo | Conservar versión/procedencia en producción |
| Evidencia | Institución del objeto soportado | Hereda la mayor sensibilidad relacionada | Solo metadatos ficticios | Retención, versión e integridad por definir |
| Proveedor/entidad | Institución | Confidencial institucional | Nombres ficticios/no personales | Por definir |
| Trazabilidad | Institución/plataforma | Audit restricted | Campos demo | Auditoría append-only futura; no implementada |

## 8. Permisos y separación de funciones

A-04 no implementa autenticación ni autorización. La producción deberá separar como acciones distintas: ver, crear/importar, editar/corregir, comprometer/causar, aprobar, pagar/marcar ejecutado, redistribuir, revisar evidencia, conciliar, exportar y auditar.

Requisitos futuros no negociables:

1. denegación por defecto y autorización server-side;
2. scope por tenant, organización, municipio, programa, finalidad, periodo y relación;
3. Finanzas no obtiene acceso clínico;
4. creador, aprobador, pagador/conciliador y auditor deben poder separarse;
5. segunda aprobación depende de una política configurable aprobada, no de un monto hardcodeado;
6. Hospital solo ve un movimiento municipal relacionado cuando permisos, programa y relación institucional lo autoricen, y viceversa;
7. exportar/descargar evidencia son permisos independientes.

La matriz exacta de roles y permisos productivos es decisión abierta y bloquea cualquier backend, no este demo aislado.

## 9. Auditoría y trazabilidad futura

A-04 solo representa metadatos. La futura implementación productiva debe emitir eventos conceptualmente append-only, como mínimo:

| Evento | Datos mínimos |
| --- | --- |
| `FINANCIAL_MOVEMENT_CREATED/IMPORTED` | actor/sistema, tenant, organización, movimiento, fuente, programa, origen, resultado, UTC/correlación |
| `FINANCIAL_MOVEMENT_STATUS_CHANGED` | estado anterior/nuevo minimizados, razón, actor, resultado |
| `BUDGET_REDISTRIBUTION_REQUESTED/APPROVED/REJECTED` | origen, destino, importe, motivo, actor(es), política/resultado |
| `EVIDENCE_LINKED/REVIEWED/CORRECTED` | evidencia, movimiento, versión, estado, actor, resultado |
| `RECONCILIATION_RUN/CONFLICT_RECORDED` | sistemas, lote/correlación, conteos, conflicto, resultado |
| `SENSITIVE_FINANCIAL_ACCESS/EXPORT` | actor, finalidad, alcance, recurso, resultado |

No guardar secretos, blobs, documentos completos, datos clínicos ni valores anteriores/nuevos innecesarios en auditoría.

## 10. Seguridad y privacidad

1. No hay red, storage, cookies, query strings, uploads, descargas ni URLs externas.
2. Los detalles se resuelven desde fixtures locales por ID; entradas del formulario se validan y no se interpretan como HTML.
3. No usar `dangerouslySetInnerHTML`.
4. No incluir datos reales ni identificadores de pacientes.
5. No revelar clínica, direcciones o compensación individual.
6. Proveedores y responsables son entidades/roles ficticios y minimizados.
7. No exponer secretos o credenciales de sistemas externos.
8. No afirmar sincronización, conciliación, validación oficial, pago real ni cumplimiento contable.
9. Evidencia y movimiento permanecen dominios relacionados pero distintos.
10. La futura versión productiva requerirá controles de archivos, integridad, malware, acceso actual, URLs cortas/privadas, versionado y auditoría; están fuera de A-04.

## 11. Contexto institucional y regulatorio

| Área | Evaluación | Límite de A-04 |
| --- | --- | --- |
| Presupuesto/movimiento | AFECTA | Trazabilidad demostrativa; no contabilidad oficial ni motor productivo |
| Evidencia institucional | AFECTA | Metadatos demo y relaciones; no archivo real, validación legal ni cumplimiento automático |
| ADRES | AFECTA LIMITADAMENTE | Solo una fuente posible cuando sea verdadera; A-05 implementará el módulo específico |
| FURAG/MIPG | RELACIONADO, NO MODIFICADO | A-04 prepara evidencia financiera; no puntúa ni declara cumplimiento |
| Sentencia T-319 de 2025 | NO AFECTA FUNCIONALMENTE | No interpretar obligaciones ni afirmar cumplimiento |
| SENA | RELACIONADO, NO MODIFICADO | Puede existir un programa/entidad demo; no certificar ni validar formación |
| Indicadores | AFECTA ESTRUCTURALMENTE | Porcentajes demo con fuente/metodología declarada; no indicador oficial |
| Reportes | FUTURO | Preparar estructura, no implementar reportes/exportaciones |

## 12. ADRES correctamente delimitado

1. La etiqueta aprobada es **ADRES / recurso administrado o girado mediante ADRES**.
2. `isAdresRelated` no significa que ADRES sea dueño, financiador universal, aprobador o fuente de todo el presupuesto municipal.
3. Ninguna suma global se clasificará completamente como ADRES salvo una futura fuente autorizada que lo demuestre.
4. No consumir API, BDUA, LMA ni otra fuente ADRES en A-04.
5. No modificar ni activar la vista `adres`; A-05 mantiene ese alcance.

## 13. Integraciones, deduplicación y fallas

No existe integración activa. La configuración solo prepara:

- `source`;
- `externalId`;
- `masterSystem`;
- `syncStatus` (`NOT_CONNECTED`, `NOT_APPLICABLE`, `PENDING`, `MATCHED`, `DIFFERENCE`, `CONFLICT`, solo como semántica demo); y
- `lastSyncedAt` opcional.

Contrato futuro pendiente:

1. identidad/idempotencia del registro;
2. autoridad del sistema maestro por campo/estado;
3. mapeo, versionado y correcciones;
4. permisos bilaterales y tenant boundaries;
5. reintentos, cuarentena, conflictos y resolución;
6. webhooks/importaciones, credenciales y observabilidad;
7. qué evento financiero puede afectar saldo; y
8. H-06B como tarea de conexión con Hospital.

Ante ausencia de conexión, la UI degrada a lectura demo y muestra **Conexión no habilitada**; nunca fabrica fecha actual, éxito o datos externos.

## 14. Accesibilidad y responsive

1. Un `h1` por vista y jerarquía de encabezados coherente.
2. Tablas/listas con nombres accesibles; en móvil deben conservar etiquetas de columna o transformarse en tarjetas semánticas comprensibles.
3. Dinero, porcentajes, fuentes, estados y alertas siempre visibles como texto; no depender del color.
4. Diálogos de detalle/redistribución con nombre, descripción, foco inicial, ciclo de foco, Escape y retorno al activador.
5. Campos con `label`, requerido, ayuda y errores asociados; resumen de errores cuando aplique.
6. Regiones `role=status` para confirmar borrador demo; los errores relevantes usan anuncio adecuado sin repetición invasiva.
7. Acciones y filas operables por teclado, foco visible y objetivos táctiles suficientes.
8. Barras de progreso con valor textual y semántica ARIA válida.
9. Verificar `1340×900`, `768×1024`, `375×812` y zoom/reflow 200 %, sin overflow horizontal de página.
10. Respetar `prefers-reduced-motion`; no se requiere animación.

## 15. Arquitectura frontend esperada

1. `MunicipalityBudget` contiene exclusivamente la vista aprobada de Presupuesto y ejecución, sus métricas, composición, desglose por población y relaciones simples con Programa.
2. `MunicipalityEvidence` contiene la vista aprobada de Evidencias, incluido el historial demostrativo en **Facturas y soportes**, el detalle local de metadatos y la cadena presupuesto–actividad–resultado.
3. No crear componente, UI ni estado ejecutable de redistribución o conciliación.
4. Tipos, catálogos, copy y fixtures viven centralizados en `municipalityConfig.ts`; no duplicar Programas.
5. Validaciones locales puras pueden vivir junto al componente de redistribución y deben probarse.
6. `MunicipalityShell` solo monta las nuevas vistas.
7. `municipalityViews.ts` solo incorpora `presupuesto` y `evidencias` a implementados.
8. Extender `municipality.module.css`; no crear otro sistema visual ni dependencia.
9. No importar desde Hospital, backend o prototipo.

## 16. Referencia visual vinculante

- **Archivo:** `prototype-claude/Eligeme-Alcaldia.dc.html` (solo lectura).
- **Presupuesto:** líneas aproximadas 316–370; vinculantes título/subtítulo, cinco métricas, desglose y explicación de no duplicación.
- **Evidencias:** líneas aproximadas 373–435; vinculantes encabezado, panel de nivel de evidencia, listado, acción y cadena de relación.
- **Fixtures de referencia:** líneas aproximadas 854–875; solo orientativos y demostrativos.
- **Adaptación funcional aprobada:** la tabla vinculante **Facturas y soportes** actúa como historial demostrativo de movimientos. La redistribución y la conciliación operativa no tienen UI en A-04.
- **Desglose:** se conserva **Por población**. Programa se relaciona solo dentro de estructuras existentes y sin navegación compleja.

No copiar `.dc.html`, `support.js`, estilos inline, runtime ni estado del prototipo. El Product Owner determinó que no se requiere diseño adicional para este alcance simplificado.

## 17. Fuera de alcance

- backend, API, base de datos, Prisma y migraciones;
- uploads, almacenamiento, preview o descarga de archivos;
- autenticación, autorización, RLS y auditoría reales;
- motor contable, asientos, cierres, causación o cálculo productivo de saldos;
- pagos, gateway o movimiento bancario;
- integración/sincronización/importación real;
- deduplicación productiva y resolución de conflictos;
- cambios a Hospital/H-06B;
- módulo ADRES/A-05;
- FURAG/MIPG, SENA, T-319, Reportes o Indicadores como funcionalidad nueva;
- datos personales, clínicos o financieros reales;
- persistencia de redistribución;
- umbral o regla definitiva de doble aprobación;
- reportes, exportaciones, impresión, notificaciones y correo;
- nuevas dependencias, rutas o sistema de diseño.

## 18. Archivos previstos y allowlist exacta

Claude Code puede crear o modificar exclusivamente:

1. `apps/web/src/features/municipality/MunicipalityBudget.tsx` — **crear** vista aprobada Presupuesto y ejecución.
2. `apps/web/src/features/municipality/MunicipalityEvidence.tsx` — **crear** vista Evidencias.
3. `apps/web/src/features/municipality/MunicipalityFinancialDetails.tsx` — **crear solo si resulta necesario** para el detalle local accesible de `Ver evidencia`; no incluir redistribución ni conciliación.
4. `apps/web/src/features/municipality/municipalityBudget.test.tsx` — **crear** pruebas A-04 de presupuesto, semántica y relaciones.
5. `apps/web/src/features/municipality/municipalityEvidence.test.tsx` — **crear** pruebas A-04 de evidencias.
6. `apps/web/src/features/municipality/municipalityConfig.ts` — **modificar** tipos, catálogos, textos y fixtures A-04, reutilizando Programas A-03.
7. `apps/web/src/features/municipality/municipalityViews.ts` — **modificar** solo módulos implementados/documentación A-04.
8. `apps/web/src/features/municipality/municipalityViews.test.ts` — **modificar** expectativas de vistas implementadas.
9. `apps/web/src/features/municipality/MunicipalityShell.tsx` — **modificar** montaje de las dos vistas y documentación local.
10. `apps/web/src/features/municipality/municipalityShell.test.tsx` — **modificar** navegación/regresión del shell.
11. `apps/web/src/features/municipality/municipality.module.css` — **modificar** estilos A-04 accesibles/responsive.
12. `apps/web/src/features/municipality/municipalityPrograms.test.tsx` — **modificar solo si es imprescindible** para ajustar la expectativa A-03 que declara A-04 como futura, sin cambiar comportamiento A-03.

`municipalityTestUtils.ts` es reutilizable en lectura. Si resulta imprescindible modificarlo, o tocar cualquier ruta adicional, Claude Code debe detenerse con **READY FOR CLAUDE: NO** para esa ampliación y solicitar revisión de Codex/Product Owner.

## 19. Archivos y áreas prohibidos

- `prototype-claude/**`;
- `apps/web/src/features/hospital/**`;
- Paciente, Cuidador, Profesional e Inscripción;
- `apps/api/**`, backend y APIs;
- `prisma/**`, esquemas y migraciones;
- infraestructura, despliegue, secretos y variables de entorno;
- dependencias, manifests y lockfiles;
- `AGENTS.md`, `CLAUDE.md`, `docs/**`, `agents/**` y otras Tasks;
- `.git/**`, commits, pushes, merges, rebases, ramas y PRs.

## 20. Criterios de aceptación

1. **AC-01 Navegación:** Presupuesto y Evidencias montan contenido propio en el shell, con activo/foco correcto.
2. **AC-02 Fidelidad:** se preservan las jerarquías vinculantes de ambas vistas y el sistema visual municipal.
3. **AC-03 Demo:** cifras, fuentes, movimientos y evidencias están rotulados como ficticios/no oficiales.
4. **AC-04 Resumen:** aparecen Asignado, Ejecutado/Pagado, Comprometido, Disponible y porcentaje.
5. **AC-05 Coherencia:** fixture general y desgloses son coherentes bajo su metodología declarada, sin fórmula universal.
6. **AC-06 Programas:** el desglose usa los programas A-03 por ID y no duplica la entidad/configuración base.
7. **AC-07 Programa completo:** cada desglose muestra dinero, meta física y cumplimiento requeridos.
8. **AC-08 Fuentes:** están las siete fuentes base y cada registro aplicable conserva procedencia.
9. **AC-09 ADRES:** aparece solo como fuente posible; no se afirma que sea todo el presupuesto ni se activa A-05.
10. **AC-10 Estados:** la UI aplica las definiciones demo aprobadas y solo suma a Ejecutado movimientos pagados y validados; separa estado financiero de soporte/validación.
11. **AC-11 Factura:** existe caso verificable donde factura/evidencia no equivale a pago/ejecución validada.
12. **AC-12 Movimientos:** la tabla aprobada Facturas y soportes funciona como historial demo y contiene los campos visibles requeridos, con detalle accesible.
13. **AC-13 Origen:** se representan los cinco orígenes aprobados sin afirmar integración activa.
14. **AC-14 Registro único:** movimiento usa un ID interno y metadatos de fuente/external ID/sistema maestro/sync, sin copia por Hospital y Alcaldía.
15. **AC-15 Redistribución:** no existe botón, formulario, modal ni operación; solo contrato frontend futuro con los campos aprobados.
16. **AC-16 Doble aprobación:** el contrato admite aprobación futura configurable, sin monto fijo, UI ni aprobación simulada.
17. **AC-17 Evidencias:** nivel, actividades, pendientes y listado contienen todos los campos requeridos.
18. **AC-18 Tipos/estados de evidencia:** catálogos solicitados representados; estados escritos y distintos de estado financiero.
19. **AC-19 Evidencia faltante:** movimiento puede quedar pendiente y no aparece pagado/ejecutado validado.
20. **AC-20 Sin archivo:** Ver evidencia presenta metadatos demo; no upload, blob, descarga ni URL pública.
21. **AC-21 Trazabilidad:** quién/cuándo/revisión/programa/fuente/movimiento/origen/estado están preparados.
22. **AC-22 Conciliación:** no existe UI operativa; el contrato conserva metadatos de sincronización y cualquier mención visible indica Conexión no habilitada.
23. **AC-23 Sin integración falsa:** no existe llamada de red, sincronización o CTA que prometa operación real.
24. **AC-24 Población:** costo promedio solo cuando fixture/metodología lo permite; no duplica gasto/personas.
25. **AC-25 Privacidad:** no hay datos clínicos/personales/direcciones/compensación individual ni secretos.
26. **AC-26 Branding:** ELÍGEME/Elígeme visible y `MERDN` ausente de UI accesible.
27. **AC-27 Accesibilidad:** semántica, teclado, foco, diálogos, labels, estados y progresos cumplen §14.
28. **AC-28 Responsive:** tres viewports y 200 % conservan uso sin overflow horizontal de página.
29. **AC-29 No regresión:** A-01/A-02/A-03 y Hospital conservan comportamiento/pruebas.
30. **AC-30 Integridad:** diff limitado a allowlist; cero cambios a prohibidos, dependencias o prototipo.
31. **AC-31 Calidad:** lint, typecheck, build y suites relevantes pasan sin fallos introducidos.

## 21. Pruebas requeridas

| ID | Tipo | Verificación |
| --- | --- | --- |
| T-01 | Navegación | Sidebar/accesos abren presupuesto y evidencias; activo, foco y shell correctos |
| T-02 | Visual | Comparación estructural con las dos secciones del prototipo |
| T-03 | Resumen | Cinco métricas globales, formatos y textos correctos |
| T-04 | Coherencia | Identidad del fixture declarada satisfecha y porcentajes/importes esperados |
| T-05 | Programas | IDs resuelven contra A-03 y todos los campos financieros/físicos aparecen |
| T-06 | Fuentes | Siete fuentes exactas, relaciones válidas y caso ADRES limitado |
| T-07 | Estados | Secuencia financiera y estado pendiente diferenciados por texto/semántica |
| T-08 | Factura negativa | Factura existente no cambia movimiento a pagado/ejecutado validado |
| T-09 | Movimientos | Facturas y soportes contiene campos visibles requeridos y Ver evidencia |
| T-10 | Procedencia | Cinco orígenes y metadatos external ID/master/sync preparados |
| T-11 | Registro único | No hay duplicado por audiencia; evidencia referencia `movementId` |
| T-12 | Redistribución diferida | Contrato contiene origen, destino, valor, motivo, responsable, fecha y aprobación futura |
| T-13 | Redistribución negativa | Ausencia de botón, formulario, modal, borrador, persistencia y mutación de saldos |
| T-14 | Trazabilidad preparada | Contrato futuro conserva los campos de trazabilidad requeridos |
| T-15 | Doble aprobación | Contrato configurable; ausencia de umbral hardcodeado y de UI simulada |
| T-16 | Evidencias | Nivel, actividades, pendientes, columnas y tipos requeridos |
| T-17 | Estados evidencia | Seis estados exactos, visibles y no confundidos con finanzas |
| T-18 | Evidencia pendiente | Falta soporte mantiene movimiento pendiente/no ejecutado validado |
| T-19 | Ver evidencia | Metadatos locales; ausencia de upload/download/blob/URL externa |
| T-20 | Conciliación diferida | Campos source/externalId/master/sync/lastSync; ausencia de panel/CTA y conexión no habilitada cuando se muestre |
| T-21 | Integración negativa | ausencia de `fetch`, cliente API, storage, timers de sync o red |
| T-22 | Población | beneficiarios únicos; costo promedio declarado; no suma/atribución personal |
| T-23 | Privacidad | búsquedas negativas de HCE, diagnóstico, identidad/dirección de paciente, salario/honorario y secretos |
| T-24 | Branding/demo | ELÍGEME visible; MERDN ausente; rotulado demo/no oficial |
| T-25 | Accesibilidad | encabezados, tabla/lista, foco, teclado, Escape, retorno, labels, errores y estados |
| T-26 | Responsive | 1340×900, 768×1024, 375×812 y zoom/reflow 200 % |
| T-27 | Regresión municipal | suites A-01/A-02/A-03 y vistas restantes sin cambios indebidos |
| T-28 | Regresión Hospital | suite web/Hospital pasa y diff de Hospital es cero |
| T-29 | Integridad | allowlist exacta, prototipo/prohibidos intactos, cero dependencias |

Claude Code debe ejecutar y reportar como mínimo:

1. `npm.cmd run lint`;
2. `npm.cmd run typecheck`;
3. `npm.cmd run test --workspace @merdn/web`;
4. `npm.cmd run build:web`;
5. `npm.cmd run dev:web` y URL local exacta de `/municipality`;
6. revisión visual de ambas vistas y diálogos en los tres viewports;
7. prueba manual de teclado, foco, Escape, retorno y zoom 200 %;
8. búsquedas negativas de privacidad, `MERDN`, red, storage, archivos y umbral fijo;
9. regresión explícita A-01/A-02/A-03 y Hospital;
10. `git status --short` y diff exacto contra allowlist.

Una prueba no ejecutada debe declararse **no ejecutada**, nunca aprobada.

## 22. Evidencia requerida en el handoff

Claude Code debe entregar:

1. Task ID y estado real;
2. URL localhost exacta;
3. archivos creados/modificados y propósito, con cero eliminaciones/dependencias/prohibidos;
4. matriz AC-01–AC-31 con evidencia concreta;
5. comandos/resultados completos, fallos y pruebas no ejecutadas;
6. capturas de Presupuesto y Evidencias en tres viewports, y de los diálogos relevantes;
7. comparación trazable con las secciones vinculantes del prototipo;
8. evidencia de fuentes, estados, movimientos, factura pendiente, redistribución y conciliación desconectada;
9. evidencia de registro único y metadatos preparatorios sin tocar Hospital;
10. evidencia de relaciones Programa/fuente/movimiento/evidencia íntegras;
11. evidencia de privacidad, branding, rotulado demo y límite ADRES;
12. evidencia manual de accesibilidad/responsive;
13. resultados de regresión;
14. `git status --short` y diff limitado;
15. supuestos, desviaciones, riesgos y STOP CONDITIONS.

El handoff inicia la auditoría de Codex; no equivale a aceptación del Product Owner ni autoriza Git.

## 23. Compatibilidad, migración y rollback

- Cambio aditivo dentro de la feature municipal.
- Sin migración, API, esquema, documentos ni compatibilidad de datos productivos.
- Conserva IDs/navegación de A-01–A-03 y activa solo `presupuesto`/`evidencias`.
- Estado de redistribución exclusivamente efímero.
- Rollback conceptual: desmontar los dos componentes, retirar fixtures/estilos A-04 y devolver ambos IDs a «Próximamente». No ejecutar borrados o rollback sin autorización.

## 24. Decisiones materiales pendientes

No bloquean el demo frontend; sí bloquean el flujo productivo correspondiente:

1. para producción, significado y fórmula oficial de asignado, comprometido, causado/obligado, pagado/ejecutado, disponible y ajustes; la semántica demo ya está cerrada en FR-03/FR-06;
2. estados, transiciones, periodos, cierres, correcciones y autoridad del sistema maestro;
3. matriz de roles/permisos y separación de funciones;
4. política y umbral configurable de segunda aprobación;
5. propietario/tenant y alcance bilateral Hospital–Alcaldía;
6. identidad, idempotencia, matching y deduplicación productiva de movimientos;
7. contrato H-06B, mapeo, sincronización, fallas y reconciliación;
8. fuentes oficiales autorizadas, conectores y frecuencia de actualización;
9. requisitos obligatorios de evidencia por tipo/estado/movimiento;
10. retención, versión, integridad, firma/checksum, antimalware y disposición documental;
11. taxonomía exacta de auditoría y minimización de valores;
12. metodología de beneficiarios únicos, atribución y costo promedio;
13. fórmulas, fuentes, periodos, versiones y dueños de indicadores/reportes;
14. semántica jurídica/financiera de recursos relacionados con ADRES;
15. umbrales de agregación/reidentificación y permisos de exportación.

## 25. Riesgos y mitigaciones

1. **Cifras demo percibidas como oficiales:** rotulado persistente y pruebas de copy.
2. **Factura interpretada como pago:** estados separados y caso negativo obligatorio.
3. **Doble conteo Hospital–Alcaldía:** registro único por ID y audiencias/contextos preparados, sin copias.
4. **ADRES sobrerrepresentado:** fuente específica y pruebas negativas.
5. **Conciliación falsa:** no existe panel ni operación; metadatos opcionales indican «Conexión no habilitada» y no usan red/CTA.
6. **Redistribución tomada como real:** solo existe el contrato futuro, sin UI, instancia ni mutación.
7. **Tipos demo confundidos con modelo productivo:** documentación local explícita y decisiones pendientes.
8. **Exposición sensible:** solo agregados/metadatos ficticios y pruebas negativas.
9. **Tablas inusables en móvil:** estrategia responsive semántica y QA visual/manual.
10. **Duplicación de Programa/configuración:** referencias por ID y test de integridad.

## 26. Condiciones de parada

Claude Code debe detener la parte afectada y retornar a Codex/Product Owner si:

1. necesita tocar un archivo fuera de la allowlist;
2. necesita modificar/copiar el prototipo o usar su runtime;
3. necesita tocar Hospital, backend, Prisma, migraciones o infraestructura;
4. necesita agregar dependencia, ruta, provider o sistema visual;
5. necesita red, storage, upload/download, documento real o datos reales;
6. necesita decidir una fórmula/estado/transición contable productiva;
7. necesita decidir permisos, tenant, sistema maestro, deduplicación o separación de funciones;
8. necesita fijar umbral de doble aprobación;
9. necesita interpretar ADRES/FURAG/MIPG/T-319/SENA o afirmar oficialidad/cumplimiento;
10. necesita alterar materialmente la jerarquía visual aprobada;
11. una prueba crítica falla o cambios ajenos se solapan con la allowlist y no pueden preservarse.

Un defecto ordinario dentro del alcance no es bloqueo: debe corregirse y volver a probarse.

## 27. Agentes especializados realmente utilizados

La especificación fue sometida a las funciones obligatorias de:

1. **01 — MERDN Orchestrator:** contexto, scope, gate, Task Specification y handoff.
2. **02 — UX/UI Fidelity Guardian:** referencia vinculante, extensiones visuales, accesibilidad y responsive.
3. **03 — Backend & Data Architect:** relaciones conceptuales, procedencia, registro único e integridad sin backend.
4. **04 — Security & Access Guardian:** privacidad, separación de funciones, tenant futuro, auditoría y pruebas negativas.
5. **05 — Institutional & Regulatory Agent:** delimitación institucional, evidencia, ADRES y no oficialidad.
6. **06 — Integrations & Automation Agent:** metadatos de origen/sync, conciliación, fallas y límite H-06B.
7. **07 — QA & Acceptance Agent:** criterios, matriz de pruebas, regresión y evidencia de handoff.
8. **09 — Frontend Application Architect:** componentes, configuración, allowlist y límites del shell.

## 28. Bloqueos y conclusión

- **Bloqueos actuales para el slice frontend demostrativo:** ninguno.
- **Bloqueos para producción/backend/integraciones:** las decisiones de §24.
- **REQUIERE CLAUDE DESIGN:** **NO**.
- **READY FOR CLAUDE:** **SÍ**, exclusivamente para implementar y probar el alcance frontend demostrativo simplificado dentro de §18.

No autoriza commit, push, merge, PR, despliegue ni cambios fuera del alcance.
