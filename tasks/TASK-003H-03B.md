# ELÍGEME Task Specification

## Identificación y gate

- **ID:** TASK-003H-03B
- **Título:** Pacientes, segmentación y analítica poblacional
- **Estado:** APPROVED — READY FOR CLAUDE CODE (FRONTEND DEMOSTRATIVO)
- **Precedencia:** amplía y sustituye únicamente la sección Pacientes de `TASK-003H-03`; no altera Agenda ni Alarmas.
- **Marca visible:** exclusivamente **ELÍGEME**. La palabra interna del proyecto no puede aparecer en UI, fixtures visibles, títulos, ayudas, errores ni capturas.
- **Gate:** **REQUIERE CLAUDE DESIGN: NO** / **READY FOR CLAUDE: SÍ**.

## 1. Objetivo y valor

Convertir Pacientes en una superficie operativa compacta, comprensible y preparada para 3.000 o más registros, que permita localizar, segmentar y revisar pacientes sin duplicar personas ni convertir condiciones registradas en diagnóstico automático. La misma definición versionada de métricas alimentará posteriormente Reportes H-07.

## 2. Resultado por fase

### A. Frontend local autorizado ahora

Listado compacto, filtros combinables, paginación, panel lateral, KPI y visualizaciones con fixtures ficticios compartidos; interacciones locales reales; estados de carga, vacío, error y sin resultados; responsive y accesibilidad. Los KPI y gráficos se calculan desde el mismo módulo puro de métricas usado por H-07.

### B. Backend posterior

Persistencia, APIs, paginación/ordenamiento/filtrado server-side, autorización contextual, RLS, auditoría, contratos de métricas, read models y cálculo reproducible. El frontend actual no simula que estos controles existen.

### C. Integración posterior

HCE/EPS/sistemas hospitalarios, importaciones y reconciliación. Hasta entonces, toda procedencia es ficticia/controlada y se rotula `Datos demostrativos`; no se inventan endpoints ni sincronizaciones.

### D. Permisos reales posteriores

Autenticación, permisos nominales, finalidad, asignación, relación, vigencia y tenant. Los perfiles visuales locales solo demuestran vistas; no son autorización.

## 3. Alcance y exclusiones

Incluye solo Pacientes Hospital y el contrato compartido de analítica requerido por H-07. No incluye CRUD, exportación, descarga, edición clínica, reglas clínicas, alertas automatizadas, backend, integración, cambios a otras vistas ni acceso nominal de Alcaldía.

## 4. Diseño vinculante exacto

Referencia visual: shell, tipografía Nunito, paleta, sidebar, header, densidad institucional, iconografía, radios y jerarquía de `prototype-claude/Eligeme-Hospital.dc.html` y líneas visuales existentes. Esta Task decide la composición nueva aplicando esos patrones; no se requiere una nueva pieza de Claude Design.

### 4.1 Escritorio (≥1280 px)

Dentro del contenido del Hospital, en este orden:

1. Encabezado en una fila: título `Pacientes`, texto breve `Gestión y segmentación de población atendida`, badge `Datos demostrativos` y fecha de corte del fixture.
2. Seis KPI compactos en una cuadrícula 6×1: `Pacientes activos`, `Mayores de 60`, `Con discapacidad`, `Cuidados en casa`, `Sin cuidador`, `Sin profesional`. Cada tarjeta contiene etiqueta, valor y porcentaje del universo activo; nunca es clic oculto.
3. Zona única de filtros sobre fondo suave. Primera fila: búsqueda flexible (nombre o documento ficticio), rango de edad y selects Condición, EPS, Patología, Profesional, Cuidador, Programa, Municipio/zona y Estado. Segunda fila: chips toggle `60+`, `Discapacidad`, `Cuidados en casa`, contador `N pacientes encontrados` y botón secundario `Limpiar filtros`.
4. Cuerpo a 12 columnas: listado en 8 columnas y analítica compacta en 4. El listado ocupa todo el ancho por debajo de 1100 px.
5. Barra del listado: contador, selector `25 / 50 / 100 por página` (50 por defecto), orden `Nombre / Edad / Próxima atención / Estado` y sentido.
6. Tabla lineal, sin tarjetas por paciente, con encabezado sticky: Paciente, Edad, EPS, Prioridades, Condición principal, Profesional, Cuidador, Programa, Zona/municipio, Estado, Semáforo y `Ver`. Nombre y documento ficticio abreviado comparten la primera celda; múltiples prioridades son chips compactos. Falta de asignación se muestra como `Sin asignar`, no guion ambiguo.
7. Paginación inferior con anterior/siguiente, página actual, total de páginas y rango visible.
8. Columna analítica con, en orden: barras horizontales `Rangos de edad`; barras `Patologías más frecuentes`; dona `EPS`; barras `Municipio/zona`; barras `Programas`; dos barras apiladas 100% `Cuidador asignado` y `Profesional asignado`; matriz de intersecciones. Cada gráfico tiene leyenda/tabla textual accesible y acción local `Ver detalle` que expande la tabla de valores, sin drill-down nominal para Alcaldía.

### 4.2 Panel lateral `Ver`

Drawer derecho de 520 px (máximo 45 vw), overlay, cierre visible, Escape y retorno de foco al botón originario. Header sticky con nombre, estado y semáforo textual. Secciones plegables, abiertas por defecto en este orden:

- `Identificación`: nombre, documento enmascarado en demostración, edad, nacimiento, contacto, ubicación.
- `Salud / información autorizada`: EPS, lista de patologías/condiciones, información disponible y por cada dato fuente/procedencia, fecha y estado. Mostrar aviso: `Información autorizada; ELÍGEME no reemplaza la historia clínica`.
- `Atención`: profesional responsable, otros profesionales autorizados, cuidadores, programa, modalidad, próxima cita/visita, últimas atenciones y alertas/semaforización con texto.
- `Clasificación`: tres indicadores independientes `Mayor de 60`, `Discapacidad`, `Cuidados en casa`, cada uno Sí/No y procedencia. Pueden estar activos simultáneamente.

No hay editar, eliminar, descargar ni exportar. Una ruta/selección inexistente muestra estado seguro y permite cerrar.

### 4.3 Responsive

- 768–1279 px: KPI 3×2; filtros en dos columnas; tabla con scroll horizontal, primera columna y acción `Ver` sticky; analítica debajo en 2 columnas; drawer 70 vw.
- <768 px: KPI 2 columnas; filtros dentro de panel `Filtros (N)` con búsqueda y chips siempre visibles; resultados como filas compactas apiladas (no tarjetas gigantes) mostrando nombre, edad, EPS, prioridades, estado/semaforo y `Ver`, con detalles secundarios desplegables; analítica en una columna; drawer a pantalla completa. No se oculta información sin alternativa.
- Viewports obligatorios: 1440×900, 1024×768, 390×844. Zoom 200% sin pérdida de acción.

### 4.4 Estados

Skeleton de KPI/listado/gráficos; vacío inicial explicativo; `Sin resultados` conserva filtros y ofrece `Limpiar filtros`; error local con `Reintentar`; selección/paginación se restablece de forma determinista cuando un filtro invalida la página. Ningún estado crítico depende solo de color.

## 5. Semántica de filtros

Todos los filtros activos se combinan con **AND**. Dentro de un selector multivalor, los valores se combinan con **OR**. Búsqueda ignora mayúsculas, tildes y espacios extremos. Edad es inclusiva y se deriva de fecha de nacimiento respecto de la fecha de corte del dataset, nunca de un valor manual contradictorio. Patología coincide si existe al menos una relación activa. Profesional y cuidador admiten `Sin asignar`. `Limpiar filtros` vuelve a defaults, página 1 y orden por nombre. Los tres chips rápidos son independientes y combinables; `60+ + Discapacidad + EPS X` exige las tres condiciones. El contador se calcula después de filtros y antes de paginación.

## 6. Definiciones métricas compartidas v1

Universo de H-03B: personas paciente únicas con inscripción/participación `active` en el contexto y fecha de corte seleccionados. Deduplicación por `patientId` estable dentro del tenant. Todos los resultados son `MERDN_CALCULATED` en arquitectura futura y `DATO DEMOSTRATIVO` ahora.

- `activePatients`: cardinalidad del conjunto universo.
- `age60Plus`: edad derivada ≥60.
- `withDisability`: clasificación activa `DISABILITY`.
- `homeCareRequired`: clasificación activa `HOME_CARE_REQUIRED`.
- `withoutCaregiver`: ninguna relación paciente-cuidador activa y vigente.
- `withoutResponsibleProfessional`: ninguna asignación principal activa y vigente.
- Porcentaje: subconjunto/universo ×100; si denominador 0 se muestra `Sin datos`, no 0%.
- Rangos: `0–17`, `18–39`, `40–59`, `60–74`, `75–84`, `85+`; mutuamente excluyentes.
- Frecuencia de patología: número de pacientes únicos vinculados, no número de registros; una persona cuenta una vez por patología y puede contar en varias patologías.

Intersecciones exactas y disjuntas: `Solo 60+` = A∧¬B∧¬C; `60+ + discapacidad` = A∧B∧¬C; `60+ + cuidados en casa` = A∧¬B∧C; `Discapacidad + cuidados en casa` = ¬A∧B∧C; `Las tres` = A∧B∧C. La matriz añade `Solo discapacidad`, `Solo cuidados en casa` y `Ninguna` para reconciliar el universo. La suma de las ocho celdas debe ser igual a pacientes activos. No sumar KPI solapados para obtener población total.

El contrato lógico compartido es `PopulationAnalyticsSnapshotV1` con: contexto/tenant, fecha de corte, filtros normalizados, versión de definición `population-v1`, universo, KPI, distribuciones, intersecciones, procedencia y `calculatedAt`. H-03B y H-07 deben importar el mismo selector/servicio y el mismo fixture fuente; queda prohibido copiar fórmulas o totales en componentes.

## 7. Modelo conceptual futuro

`Person 1—0..1 PatientProfile`; `PatientProfile >—< PriorityClassification` mediante relación con tipo, fuente, inicio, fin, estado y vigencia; `Patient >—< Caregiver` mediante vínculo autorizado; `Patient 1—0..* ProfessionalAssignment`, exactamente 0..1 principal vigente por contexto; `Patient >—< Professional` para otros autorizados; `Patient → EPSAffiliation` versionada; `Patient >—< ProgramEnrollment`; `Patient >—< Condition` mediante registro con principal booleano, fuente, estado y fechas; `Patient → Alert`; `Patient → CareEvent/Appointment/Visit/VirtualConsultation`. Todas las entidades de negocio incorporan tenant y relaciones tenant-aware. Las patologías son información registrada/autorizada, no inferida.

Patología principal: máximo una relación activa marcada principal por paciente/contexto; si no existe, mostrar `Sin condición principal registrada`. No elegir automáticamente por frecuencia.

## 8. Seguridad, privacidad y permisos

Frontend local: solo datos ficticios; documento y contacto se enmascaran fuera del drawer. Hospital demuestra detalle nominal, sujeto en producción a rol + institución + asignación/relación + finalidad + vigencia + tenant. Alcaldía no consume este listado ni drawer: solo snapshots agregados autorizados. Quedan prohibidos diagnósticos nominales, HCE, dirección exacta, exportación o drill-down municipal por defecto. No se inventa umbral de grupos pequeños; el backend futuro deberá aplicar una política aprobada antes de publicación municipal.

Permisos futuros separados: `patients:list`, `patients:view_identity`, `patients:view_authorized_health`, `patients:view_assignments`, `population_metrics:view_aggregate`, `population_metrics:export`. Autorización server-side, RLS, reautorización y auditoría; la UI no constituye control.

Auditar en backend futuro: búsqueda/listado nominal cuando la política lo exija, apertura de ficha, acceso clínico autorizado, cambios de clasificación/relaciones/asignaciones, consulta agregada, intento denegado y exportación. Minimizar valores; no guardar búsquedas o contenido clínico indiscriminado.

## 9. Integraciones y fallas

No hay integración en este slice. Los fixtures usan sobre de procedencia ficticio. La futura HCE/EPS será adapter de solo lectura por defecto, con fuente, versión, fecha original/ingestión, mapeo, discrepancia y reconciliación; una caída no borra datos previos y se muestra `Fuente no disponible`/`Actualización pendiente`, nunca dato actualizado ficticio.

## 10. Archivos

Claude Code podrá modificar únicamente archivos de frontend Hospital Pacientes, componentes/pruebas compartidos estrictamente necesarios y un módulo único de fixtures/selectores analíticos consumible por H-07. Debe enumerar rutas exactas antes de editar. Prohibidos: `prototype-claude/**`, otras vistas H-01–H-06, Configuración, Gestión financiera, backend, migraciones, infraestructura, documentos y estas Task Specifications. No commit, push, merge ni despliegue.

## 11. Criterios de aceptación

1. Se renderiza el layout exacto y no hay tarjetas gigantes por paciente.
2. 3.000+ fixtures se filtran, ordenan y paginan sin bloqueo perceptible; interacción objetivo ≤100 ms en equipo de prueba documentado.
3. Todos los filtros funcionan con la semántica AND/OR definida; chips rápidos se combinan.
4. Contador y paginación reflejan el conjunto filtrado.
5. Drawer contiene todas las secciones, múltiples cuidadores/condiciones y procedencia.
6. KPI, gráficos y listado se derivan de una sola fuente y versión.
7. Las ocho intersecciones son disjuntas y reconcilian exactamente el universo.
8. Patologías cuentan pacientes únicos y no se presentan como diagnóstico automático.
9. Alcaldía no recibe datos nominales/clínicos desde este módulo.
10. Estados, responsive, teclado, foco, lector, contraste y alternativa textual son conformes.
11. Toda UI visible usa ELÍGEME y cero apariciones de la terminología confidencial.
12. No se modifican superficies prohibidas ni se aparenta backend/integración/permisos reales.

## 12. Pruebas y evidencia

- Unitarias: edad en fecha de corte, normalización de búsqueda, AND/OR, `Sin asignar`, deduplicación, KPI, porcentajes/denominador cero, patologías y ocho intersecciones/reconciliación.
- Componentes: filtros, limpiar, contador, orden, paginación, drawer/foco/Escape, estados y tablas textuales de gráficos.
- Dataset: ≥3.000 personas ficticias deterministas, IDs únicos y casos con 0/1/2/3 clasificaciones, múltiples cuidadores/patologías y ausencias.
- Seguridad visual: no Alcaldía nominal, no acciones no autorizadas, enmascarado y cero datos reales.
- Accesibilidad: axe sin violaciones graves/críticas, recorrido completo por teclado, nombres accesibles y no color-only.
- Responsive/visual: capturas 1440×900, 1024×768 y 390×844 comparadas con referencias Hospital.
- Regresión: shell, Inicio, Agenda y Alarmas sin cambios funcionales; `prototype-claude/**` intacto; búsqueda automática de terminología confidencial en strings visibles.
- Handoff: archivos/propósito, comandos/resultados, URL local, fixtures, capturas, métricas de rendimiento, pruebas fallidas/no ejecutadas, desviaciones y riesgos.

## 13. Decisiones y riesgos

Decisiones frontend pendientes: **ninguna**. Son futuras no bloqueantes: contratos físicos/API, política de grupos pequeños, dataset clínico autorizado, retención, permisos definitivos e integraciones. Riesgos: reidentificación en agregados pequeños, doble conteo, fixtures divergentes y semáforo interpretado como regla clínica; los controles anteriores son obligatorios.

**REQUIERE CLAUDE DESIGN: NO**

**READY FOR CLAUDE: SÍ**
