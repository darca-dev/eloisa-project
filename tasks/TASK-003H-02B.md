# MERDN Task Specification

## Identificación

- **Task ID:** TASK-003H-02B
- **Título:** Hospital Centro de Control Operativo
- **Estado:** APPROVED — READY FOR CLAUDE CODE
- **Prioridad:** HIGH
- **Autoridad:** instrucción expresa de la Product Owner Yohana
- **Agente implementador:** Claude Code
- **Revisión requerida:** Codex como MERDN Orchestrator, UX/UI Fidelity Guardian y Frontend Application Architect
- **Dependencias:** TASK-003H-01, TASK-003H-02, TASK-003H-03 y TASK-003H-04 implementadas y aprobadas. TASK-003H-05 puede coexistir si ya fue implementada al iniciar esta tarea, pero no es requisito para modificar Inicio.

## Objetivo y valor

Convertir únicamente la vista `Inicio` de Hospital en un centro operativo compacto que permita responder, desde la primera pantalla y con pocos clics:

1. **¿Qué necesita atención ahora?**
2. **¿A dónde debo entrar?**

La tarea debe reducir notablemente el tamaño de los siete KPI existentes, convertirlos en accesos operativos, incorporar atención prioritaria, acciones rápidas y resúmenes breves, y reutilizar la navegación local y los fixtures Hospital existentes. No debe rediseñar el lenguaje visual aprobado ni modificar el contenido o comportamiento interno de las demás vistas.

## Hechos, decisiones y límites

### Hechos verificados

- `/hospital` usa un único `HospitalShell` con sidebar, topbar y un único `<main>`.
- La navegación Hospital actual usa estado local; no crea rutas, no cambia la URL y se reinicia al recargar.
- Inicio ya contiene el encabezado y los siete KPI configurados en `hospitalDashboardConfig.ts`.
- Agenda, Pacientes, Semáforo de alarmas, Profesionales, Visitas domiciliarias, Consultas virtuales, Calificaciones y Novedades ya tienen vistas locales implementadas.
- Los fixtures existentes contienen alarmas rojas y amarillas, solicitudes/citas sin asignar, pacientes en espera virtual, agenda/atenciones y estados de profesionales suficientes para componer resúmenes demostrativos sin inventar reglas clínicas.
- En el estado actual revisado, `Membresías y servicios`, `Reportes` y `Configuración` aparecen en el sidebar pero no tienen vista montada. TASK-003H-05 autoriza Membresías y Configuración, pero no debe presumirse implementada sin verificarlo al comenzar.

### Decisiones aprobadas

1. Inicio es un acelerador de navegación y lectura; no duplica la lógica funcional de los módulos destino.
2. Toda interacción de esta fase es local y efímera. No hay backend, persistencia, llamadas de red ni filtros productivos.
3. La navegación contextual podrá transportar una intención local y tipada junto con la vista solicitada, por ejemplo `alarmas/rojas` o `agenda/pendientes-asignacion`.
4. La intención contextual no altera los fixtures, no persiste, no cambia la URL y no se anuncia como filtro aplicado si la vista destino aún no puede representarlo fielmente.
5. Los accesos a módulos sin vista implementada deben permanecer visibles en `Ir a`, con estado no disponible claro y no interactivo, siguiendo la misma verdad funcional del sidebar. No deben abrir contenido vacío ni simular éxito.
6. Los valores, personas, estados y antigüedades son demostrativos. Deben proceder de fixtures Hospital existentes o de una composición explícita y centralizada de estos; no son datos clínicos ni operativos reales.

## Usuarios, institución e impacto

- **Experiencia afectada:** Hospital, exclusivamente vista Inicio.
- **Usuario primario demostrativo:** coordinación u operación hospitalaria.
- **Institución demostrativa:** la ya configurada en el Shell Hospital; no duplicar ni alterar su identidad.
- **Tenant futuro:** institución Hospital propietaria de los registros y relaciones mostrados.
- **Impacto:** lectura operativa rápida y acceso local a módulos ya existentes.
- **No afectado:** experiencias Paciente, Cuidador, Profesional, Alcaldía y demás instituciones.
- **Aislamiento futuro:** las consultas reales que sustituyan los fixtures deberán aplicar autorización y tenant en servidor y capa de datos; esta tarea no implementa esos controles ni debe codificar una institución global fija.

## Restricción de fidelidad visual

El lenguaje visual Hospital ya aprobado es vinculante. Conservar sin rediseño:

- Shell, sidebar y topbar;
- paleta, tipografía, iconografía SVG local, radios, sombras y densidad general;
- jerarquía y personalidad visual de H-01/H-02/H-03/H-04;
- identidad institucional, buscador, campana, perfil, orden del menú y comportamiento responsive existentes.

La instrucción de la Product Owner para compactar y ampliar Inicio prevalece sobre la restricción anterior de TASK-003H-02 que exigía tarjetas grandes y una zona inferior vacía. Solo quedan reemplazadas esas dos condiciones de Inicio; el resto de H-02 continúa vigente.

`prototype-claude/Eligeme-Hospital.dc.html` puede consultarse únicamente para conservar el lenguaje Hospital. No existe una nueva composición visual vinculante para este centro operativo: Claude Code debe derivarla de los patrones aprobados, sin copiar runtime, estado, datos ni reglas del prototipo y sin modificar `prototype-claude/**`.

## Alcance funcional

### FR-01 — Composición y densidad de Inicio

1. Mantener el encabezado aprobado de Inicio, salvo ajustes mínimos de espaciado necesarios para reducir scroll.
2. Organizar el contenido para priorizar en este orden perceptual: KPI compactos, `Necesita atención ahora`, acciones rápidas y resúmenes operativos.
3. En escritorio de referencia `1320 × 900`, mostrar información operativa útil sin tarjetas gigantes y procurar que KPI, atención prioritaria y acciones rápidas sean visibles en la primera pantalla.
4. Las secciones inferiores deben usar una composición densa, ordenada y responsive; se permiten columnas que colapsen a una sola columna en viewports estrechos.
5. Evitar duplicar textos extensos, desgloses innecesarios y grandes zonas vacías.

### FR-02 — Siete KPI compactos y clicables

Mantener exactamente estos siete indicadores y sus valores/desgloses demostrativos de H-02, pero reducir notablemente altura, padding, icono, valor y separación frente a las tarjetas actuales. La tarjeta completa debe ser un único control accesible, con foco visible, área de activación clara y sin controles anidados.

| KPI | Destino local | Intención contextual |
| --- | --- | --- |
| Citas de hoy | Agenda y citas | ninguna |
| Visitas en casa hoy | Visitas domiciliarias | ninguna |
| Consultas virtuales hoy | Consultas virtuales | ninguna |
| Alarmas activas | Semáforo de alarmas | ninguna |
| Pacientes activos | Pacientes | ninguna |
| Profesionales en turno | Profesionales | ninguna |
| Citas pendientes de asignación | Agenda y citas | `pendientes-asignacion` |

Requisitos:

1. Reutilizar una única implementación genérica y configuración tipada; no crear siete variantes.
2. Conservar etiquetas textuales y desgloses suficientes para que el significado no dependa del color o icono.
3. El KPI de pendientes debe expresar también visualmente su intención de pendientes de asignación al abrir Agenda, sin afirmar que un filtro productivo está aplicado.
4. No recalcular ni reconciliar totales. Usar los fixtures existentes como contenido de presentación.

### FR-03 — `Necesita atención ahora`

Crear una zona prioritaria, compacta y claramente titulada `Necesita atención ahora`. Debe mostrar únicamente situaciones demostrativas presentes en fixtures Hospital existentes:

- alarmas rojas;
- alarmas amarillas;
- citas o solicitudes sin profesional;
- paciente(s) esperando consulta virtual; y
- otras situaciones operativas ya representadas en fixtures, solo cuando aporten prioridad inmediata sin introducir una regla nueva.

Cada fila debe incluir contexto mínimo útil, texto de prioridad/estado y una única acción rápida coherente:

| Situación | Acción | Destino/intención |
| --- | --- | --- |
| Alarma roja | `Ver` | Semáforo / `rojas` |
| Alarma amarilla | `Revisar` | Semáforo / `amarillas` |
| Cita o visita sin profesional | `Asignar` | Agenda / `pendientes-asignacion` |
| Paciente esperando consulta virtual | `Abrir cola` | Consultas virtuales / `en-espera` |

No inventar priorización clínica, umbrales, diagnósticos, recomendaciones, SLA ni ordenamiento clínico. El orden visual puede seguir severidad textual y antigüedad ya disponibles, documentándose como orden de presentación del fixture, no como motor clínico.

### FR-04 — Acciones rápidas

Mostrar controles compactos con icono SVG local y texto visible para:

- `Nueva cita`;
- `Buscar paciente`;
- `Asignar profesional`;
- `Programar visita`;
- `Crear novedad`.

Comportamiento autorizado:

| Acción | Comportamiento local mínimo |
| --- | --- |
| Nueva cita | abrir Agenda y citas |
| Buscar paciente | abrir Pacientes; si existe un control local de búsqueda reutilizable, enfocarlo sin introducir búsqueda nueva |
| Asignar profesional | abrir Agenda con intención `pendientes-asignacion` |
| Programar visita | abrir Visitas domiciliarias |
| Crear novedad | abrir Novedades |

No crear formularios, modales, registros, guardados ni mensajes de éxito falsos. Si el módulo destino no ofrece la acción concreta, el rótulo funciona como intención de acceso y no como afirmación de que la operación fue ejecutada.

### FR-05 — Agenda próxima

1. Crear un resumen titulado `Agenda próxima` con pocas filas; objetivo recomendado: entre 3 y 5.
2. Cada fila debe mostrar hora, paciente, modalidad y profesional.
3. Cuando el fixture no tenga profesional asignado, mostrar exactamente `Sin asignar` mediante texto, no solo color.
4. Añadir el control `Ver agenda completa`, que abre Agenda y citas.
5. Reutilizar o adaptar datos demostrativos ya existentes en Agenda, Visitas o Consultas virtuales. Si las estructuras actuales no contienen una agenda homogénea, crear un fixture de presentación de Inicio compuesto a partir de esos mismos datos ficticios, sin convertirlo en modelo de dominio definitivo.

### FR-06 — Alarmas recientes

1. Mostrar solo alarmas prioritarias o recientes ya presentes en `hospitalAlertsConfig.ts`; objetivo recomendado: entre 3 y 4 filas.
2. Cada fila debe incluir severidad, paciente, antigüedad, estado y una acción `Ver` o `Revisar`.
3. Añadir `Ver semáforo`, que abre Semáforo de alarmas.
4. Las alarmas rojas o amarillas pueden transportar su intención contextual correspondiente.
5. No incorporar Elí, WhatsApp, notificaciones, asignación, comentarios, cierre de alarmas ni reglas clínicas.

### FR-07 — Resumen de profesionales

Mostrar un bloque compacto con los valores demostrativos ya aprobados:

- disponibles: `4`;
- en visita: `3`;
- en consulta: `2`.

Añadir `Ver profesionales`, que abre Profesionales. El resumen no calcula disponibilidad real, no asigna turnos y no cambia estados.

### FR-08 — Sección `Ir a`

Crear un acelerador compacto de icono y etiqueta con este orden:

1. Agenda
2. Pacientes
3. Alarmas
4. Profesionales
5. Visitas domiciliarias
6. Consultas virtuales
7. Calificaciones
8. Novedades
9. Membresías y servicios
10. Reportes
11. Configuración

Requisitos:

1. Reutilizar los identificadores, etiquetas, iconos y transición de navegación del Shell; no mantener un segundo mapa divergente.
2. Los módulos implementados deben abrirse mediante el mismo estado local que usa el sidebar y actualizar coherentemente el item activo.
3. Antes de implementar, comprobar si TASK-003H-05 ya habilitó Membresías y Configuración. Si están implementados, enlazarlos al mismo contenedor y estado aprobados allí; si no, mostrarlos como no disponibles.
4. `Reportes` debe mostrarse como no disponible mientras no exista una vista aprobada e implementada.
5. Un acceso no disponible no recibe comportamiento engañoso, no deja Inicio, no abre contenido vacío y comunica visual y semánticamente su estado.
6. El sidebar se conserva; `Ir a` no lo reemplaza ni duplica arquitectura.

### FR-09 — Contexto de navegación efímero

1. Extender de forma mínima el contrato de navegación local para aceptar `vista` y una intención opcional tipada.
2. Soportar al menos:
   - `alarmas` + `rojas`;
   - `alarmas` + `amarillas`;
   - `agenda` + `pendientes-asignacion`;
   - `virtuales` + `en-espera`.
3. El destino puede representar la intención mediante énfasis, selección visual preexistente o un aviso compacto como `Mostrando intención: …`; no debe ocultar filas ni afirmar resultados filtrados si no existe filtrado local aprobado.
4. La intención debe limpiarse al navegar desde el sidebar o desde un acceso sin intención, para evitar contexto obsoleto.
5. No usar URL, query string, almacenamiento, contexto global de aplicación, backend ni persistencia.
6. No modificar la lógica de negocio ni los fixtures internos de Agenda, Semáforo, Virtuales u otra vista para implementar la intención.

### FR-10 — Contratos y preparación para datos reales

1. Centralizar la configuración de Inicio fuera del JSX de presentación.
2. Separar contratos de UI para KPI, atención prioritaria, acceso rápido, agenda próxima, alarmas recientes, resumen profesional e intención de navegación.
3. Preferir selectores/adaptadores puros que consuman fixtures existentes cuando eviten duplicación; no acoplar componentes a categorías clínicas concretas.
4. Mantener componentes de presentación independientes de red, fuente de datos y estado global, para que los fixtures puedan sustituirse posteriormente por consultas autorizadas.
5. No crear endpoints, repositorios, servicios de fetching, caché, polling, base de datos ni modelos definitivos.
6. No añadir dependencias mayores ni una nueva librería de iconos.

### FR-11 — Responsive y accesibilidad

1. Mantener un único `<main>` y un único `<h1>` en Inicio; las secciones siguientes deben respetar una jerarquía de encabezados coherente.
2. Todos los controles deben usar elementos semánticos (`button` en la navegación local actual), nombre accesible, foco visible y activación por teclado.
3. No usar contenedores con `onClick` como sustituto de controles semánticos ni crear controles anidados.
4. Iconos decorativos: `aria-hidden="true"` y no enfocables. No depender solo del icono o color.
5. Estados rojo, amarillo, sin asignar y no disponible deben comunicarse con texto visible.
6. Mantener contraste legible, objetivos táctiles adecuados, orden de tabulación lógico y ausencia de scroll horizontal.
7. En viewport estrecho, permitir wrap/columnas sin ocultar KPI, acciones esenciales o nombres de sección; las tablas/resúmenes deben adaptarse sin truncar información crítica.
8. Respetar preferencias de movimiento; esta tarea no requiere animaciones.

## Datos, privacidad, seguridad y auditoría

| Dato | Procedencia permitida | Uso | Sensibilidad en esta fase | Persistencia | Restricción |
| --- | --- | --- | --- | --- | --- |
| Totales y desgloses KPI | `hospitalDashboardConfig.ts` | resumen demostrativo | ficticio/no productivo | ninguna | no recalcular ni presentar como oficial |
| Alarmas, severidad, estado y antigüedad | `hospitalAlertsConfig.ts` | atención prioritaria y recientes | ficticio con forma de dato de salud | ninguna | no inferir lógica clínica ni copiar a logs |
| Solicitudes/citas y asignación | fixtures de Agenda/Visitas/Virtuales | atención y agenda próxima | ficticio con forma de dato personal/operativo | ninguna | minimizar campos visibles |
| Paciente en espera virtual | `hospitalVirtualConfig.ts` | atención inmediata | ficticio con forma de dato personal | ninguna | sin videollamada, mensajería o presencia real |
| Estados de profesionales | fixtures/KPI existentes | resumen operativo | ficticio/operativo | ninguna | no calcular disponibilidad real |
| Intención de navegación | interacción local | orientar vista destino | no sensible | memoria del montaje | limpiar al cambiar de navegación |

- Usar exclusivamente datos ficticios existentes o composiciones demostrativas coherentes; prohibidos datos reales.
- Esta tarea no autentica ni autoriza. La UI no constituye un control de acceso.
- La futura sustitución por consultas reales deberá aplicar autorización server-side, relación con el recurso, tenant, minimización, manejo seguro de errores y auditoría de accesos sensibles.
- En esta fase no se crean eventos de auditoría porque no hay lectura real, mutación, exportación ni persistencia. No simular trazas de auditoría.
- No incluir secretos, tokens, identificadores reales, llamadas remotas ni contenido sensible en atributos técnicos o logs.

## Restricciones clínicas, regulatorias e institucionales

| Área | Evaluación | Restricción |
| --- | --- | --- |
| Lógica clínica | AFECTA VISUALMENTE | Se muestran severidades ya existentes; no crear umbrales, recomendaciones, diagnósticos ni reglas. |
| FURAG/MIPG | NO AFECTA | No añadir indicadores, evidencia ni afirmaciones oficiales. |
| ADRES | NO AFECTA | No añadir consulta, validación ni evaluación. |
| Sentencia T-319 de 2025 | NO AFECTA | No interpretar ni afirmar cumplimiento. |
| SENA | NO AFECTA | No añadir formación o certificación. |
| Evidencia/indicadores institucionales | NO AFECTA | Los KPI son fixtures operativos, no indicadores oficiales ni evidencia. |
| Presupuesto/movimiento financiero | NO AFECTA | No añadir valores, pagos, ejecución ni trazabilidad financiera. |
| Membresías/servicios | ACCESO CONDICIONAL | Solo navegar si TASK-003H-05 está efectivamente implementada; no comprar, cobrar ni modificar planes. |

## Archivos permitidos para implementación

- `apps/web/src/features/hospital/HospitalDashboard.tsx` — nueva composición de Inicio.
- `apps/web/src/features/hospital/HospitalKpiCard.tsx` — compactación e interacción genérica.
- `apps/web/src/features/hospital/HospitalDashboardHeader.tsx` — solo ajustes mínimos de densidad si son necesarios.
- `apps/web/src/features/hospital/hospitalDashboardConfig.ts` — contratos y fixtures/configuración de Inicio.
- `apps/web/src/features/hospital/HospitalShell.tsx` — elevar navegación local e intención contextual.
- `apps/web/src/features/hospital/hospitalViews.ts` — contrato puro de navegación/intención y reutilización por `Ir a`.
- `apps/web/src/features/hospital/HospitalIcon.tsx` — solo si falta un icono requerido; conservar geometrías existentes.
- `apps/web/src/features/hospital/hospital.module.css` — estilos de Inicio y ajustes enfocados.
- `apps/web/src/features/hospital/hospitalDashboard.test.tsx` — pruebas de Inicio.
- `apps/web/src/features/hospital/hospitalNavegacion.test.tsx` — pruebas de navegación e intención.
- `apps/web/src/features/hospital/hospitalTestUtils.ts` — solo si una utilidad mínima reutilizable es necesaria.
- `apps/web/src/features/hospital/HospitalDashboard*.tsx`, `apps/web/src/features/hospital/hospitalDashboard*.ts` y sus CSS/tests nuevos — componentes enfocados cuando separar secciones mejore mantenibilidad.

Toda ruta no listada está fuera de alcance. Si la implementación de una intención exige modificar una vista destino o su stylesheet/test, Claude Code debe detener esa parte y reportar la necesidad; no queda autorizada a alterar Agenda, Pacientes, Semáforo, Profesionales, Visitas, Virtuales, Calificaciones, Novedades, Membresías, Reportes o Configuración.

## Archivos y superficies prohibidos

- `AGENTS.md`
- `CLAUDE.md`
- `prototype-claude/**`
- `docs/**`
- `tasks/**`
- `reviews/**`
- `apps/api/**`
- `prisma/**`
- archivos de otras experiencias
- contenido y estilos internos de las vistas Hospital distintas de Inicio
- rutas nuevas, backend, base de datos, servicios remotos y configuración de despliegue
- `main` y el historial Git

## Fuera de alcance

- Rediseñar Shell, sidebar, topbar o lenguaje visual Hospital.
- Modificar el contenido funcional o visual de Agenda, Pacientes, Semáforo, Profesionales, Visitas domiciliarias, Consultas virtuales, Calificaciones, Novedades, Membresías, Reportes o Configuración.
- Crear módulos que aún no estén implementados.
- Filtros reales, búsqueda real, formularios, modales de creación o asignación y mutaciones.
- Backend, persistencia, APIs, autenticación, autorización, tenant enforcement o auditoría productiva.
- Reloj en vivo, polling, WebSocket, notificaciones, WhatsApp, Elí, videollamada o integraciones.
- Reglas clínicas, priorización clínica nueva, SLA, diagnóstico o recomendación.
- Pagos, membresías productivas, reportes productivos, exportaciones o configuración real.
- Cambiar datos demostrativos aprobados salvo la composición mínima necesaria para resúmenes de Inicio.
- Commit, push, merge, rebase, PR, release o despliegue.

## Criterios de aceptación

1. **AC-01:** `/hospital` abre en Inicio y conserva sin regresión Shell, sidebar, topbar, identidad, buscador, campana, perfil, colores, tipografía e iconografía aprobados.
2. **AC-02:** Inicio mantiene los siete KPI y sus valores/desgloses H-02, con tarjetas notablemente más compactas que las actuales.
3. **AC-03:** cada KPI es un único control semántico clicable y navegable por teclado, con foco visible y el destino indicado en FR-02.
4. **AC-04:** el KPI `Citas pendientes de asignación` abre Agenda con intención efímera y perceptible de pendientes, sin persistir ni afirmar filtrado real.
5. **AC-05:** `Necesita atención ahora` muestra alarmas rojas, amarillas, casos sin profesional y paciente(s) esperando consulta virtual usando únicamente fixtures existentes.
6. **AC-06:** cada fila prioritaria tiene exactamente una acción coherente (`Ver`, `Revisar`, `Asignar` o `Abrir cola`) que abre el módulo correcto.
7. **AC-07:** no se incorpora lógica clínica, prioridad nueva, recomendación, Elí, WhatsApp ni capacidad remota.
8. **AC-08:** aparecen las cinco acciones rápidas y cada una ejecuta solo la navegación local autorizada, sin formularios, mutaciones ni mensajes de éxito.
9. **AC-09:** `Agenda próxima` muestra de 3 a 5 filas con hora, paciente, modalidad y profesional, incluido `Sin asignar` cuando corresponda, y `Ver agenda completa` abre Agenda.
10. **AC-10:** `Alarmas recientes` muestra de 3 a 4 alarmas existentes con severidad, paciente, antigüedad, estado y acción; `Ver semáforo` abre Alarmas.
11. **AC-11:** el resumen de profesionales muestra `4` disponibles, `3` en visita y `2` en consulta; `Ver profesionales` abre Profesionales.
12. **AC-12:** `Ir a` contiene los once accesos, reutiliza navegación/iconografía del Shell y abre todos los módulos efectivamente implementados.
13. **AC-13:** los accesos no implementados permanecen visibles pero claramente no disponibles, sin foco/acción engañosa, navegación, contenido vacío ni simulación de éxito.
14. **AC-14:** navegar desde el sidebar o un acceso sin intención limpia cualquier intención contextual previa.
15. **AC-15:** ninguna interacción cambia la URL, consulta red, escribe almacenamiento o persiste tras recarga.
16. **AC-16:** Inicio usa configuración tipada y componentes/selecciones reutilizables; no contiene siete tarjetas copiadas ni datos operativos dispersos en JSX.
17. **AC-17:** en `1320 × 900` KPI, atención prioritaria y acciones rápidas son legibles en la primera pantalla y no existen tarjetas gigantes ni espacio desperdiciado evidente.
18. **AC-18:** en un viewport angosto representativo no hay solapamiento ni overflow horizontal; controles, etiquetas y estados críticos siguen disponibles.
19. **AC-19:** Inicio conserva un único `<h1>`, jerarquía semántica coherente, nombres accesibles, foco visible, orden lógico y estados expresados también mediante texto.
20. **AC-20:** las demás vistas H-03/H-04 y, si están implementadas, H-05, renderizan el mismo contenido aprobado antes de esta tarea.
21. **AC-21:** lint, typecheck, pruebas relacionadas y build terminan exitosamente, sin errores conocidos ocultos.

## Pruebas requeridas

| Test ID | Tipo | Escenario | Resultado esperado |
| --- | --- | --- | --- |
| T-01 | Regresión UI | Cargar `/hospital` | Shell intacto e Inicio operativo como vista inicial. |
| T-02 | Componente | Render de KPI | Siete KPI, configuración única, datos H-02 y anatomía compacta. |
| T-03 | Interacción | Activar cada KPI por clic y teclado | Abre la vista correcta; pendientes lleva intención. |
| T-04 | Datos/alcance | Componer atención prioritaria | Solo usa casos presentes en fixtures y no deriva reglas clínicas. |
| T-05 | Interacción | Acciones de atención | Ver/Revisar/Asignar/Abrir cola abren destino e intención correctos. |
| T-06 | Interacción | Cinco acciones rápidas | Solo cambian vista/intención local; no crean ni guardan datos. |
| T-07 | Presentación | Agenda próxima | 3–5 filas, cuatro campos, `Sin asignar` y acceso a Agenda. |
| T-08 | Presentación | Alarmas recientes | 3–4 filas existentes, cinco campos y acceso a Semáforo. |
| T-09 | Presentación | Profesionales | Totales 4/3/2 y acceso correcto. |
| T-10 | Navegación | Once accesos `Ir a` | Implementados navegan; no implementados quedan inertes y explícitos. |
| T-11 | Estado | Navegar con y sin intención | La intención no persiste y se limpia al cambiar desde sidebar/acceso simple. |
| T-12 | Alcance negativo | Inspeccionar interacciones | Sin fetch, storage, URL nueva, formulario, mutación, Elí, WhatsApp o backend. |
| T-13 | Accesibilidad | Teclado y semántica | Controles alcanzables, foco visible, nombres claros, sin controles anidados; no disponibles no engañan. |
| T-14 | Accesibilidad | Estados y severidad | Rojo, amarillo, sin asignar y no disponible tienen texto visible. |
| T-15 | Responsive visual | `1320 × 900` | Primera pantalla densa, clara y sin tarjetas gigantes. |
| T-16 | Responsive visual | viewport angosto representativo | Sin overflow, cortes ni pérdida de acciones críticas. |
| T-17 | Regresión | Renderizar todas las vistas Hospital | Ninguna vista distinta de Inicio cambia su contenido aprobado. |
| T-18 | Verificación | lint, typecheck, tests y build | Todos finalizan con código de salida exitoso. |

Las pruebas de interacción deben usar un entorno DOM adecuado y comprobar comportamiento observable, no solo funciones puras. La revisión visual debe entregar capturas comparables de Inicio en `1320 × 900` y en un viewport angosto. Usar datos ficticios; no conectar servicios externos.

## Consideraciones de migración, compatibilidad y rollback

- No hay migración de base de datos, datos, API ni almacenamiento.
- Mantener compatibilidad con el estado local y los identificadores de vista existentes.
- El contrato de navegación ampliado debe aceptar las llamadas actuales sin intención para evitar regresiones.
- El cambio debe poder revertirse retirando la nueva composición de Inicio y la intención opcional, sin afectar los módulos destino.
- No agregar dependencias mayores. Cualquier dependencia nueva exige detenerse y pedir aprobación.

## Riesgos y mitigaciones

| Riesgo | Mitigación obligatoria |
| --- | --- |
| Sobrecargar Inicio | limitar filas, usar jerarquía clara y composición responsive compacta |
| Duplicar fixtures y generar divergencia | adaptar/importar fuentes existentes mediante selectores puros y configuración centralizada |
| Simular filtros inexistentes | denominar el estado como intención visual y no ocultar datos sin implementación aprobada |
| Convertir UI en autorización | conservar la advertencia arquitectónica: permisos futuros se aplican en servidor/datos |
| Introducir lógica clínica | mostrar solo severidad/estado ya escritos en fixtures |
| Romper módulos aprobados | elevar navegación sin modificar contenido interno y ejecutar regresión de todas las vistas |
| Enlaces a módulos inexistentes | estado no disponible explícito, coherente con el sidebar |
| Densidad que perjudique accesibilidad | validar teclado, foco, contraste, texto y viewport angosto |

## Condiciones de parada

Claude Code debe detener la parte afectada y reportarla, sin improvisar, si:

1. necesita modificar una vista Hospital distinta de Inicio para representar una intención;
2. necesita crear o implementar Membresías, Reportes, Configuración u otro módulo inexistente;
3. los fixtures existentes no permiten mostrar una situación solicitada sin inventar datos clínicos o reglas;
4. la navegación contextual exige URL, persistencia, backend o estado global no aprobado;
5. requiere una dependencia nueva significativa;
6. detecta conflicto con cambios no relacionados o con una implementación posterior de TASK-003H-05;
7. necesita tocar cualquier archivo fuera de la lista permitida.

Una condición de parada puede bloquear solo el subcomportamiento afectado; Claude Code debe identificar qué parte segura puede completar sin ampliar alcance.

## Evidencia de entrega requerida

Claude Code debe entregar a Codex:

1. estado de TASK-003H-02B y resumen del resultado;
2. lista exacta de archivos creados/modificados/eliminados y propósito;
3. matriz de cumplimiento AC-01 a AC-21 con evidencia concreta;
4. mapa final de cada KPI, acción rápida, fila prioritaria y acceso `Ir a` hacia vista/intención;
5. explicación del contrato tipado de navegación y de cómo se limpia la intención;
6. identificación de fixtures reutilizados y cualquier composición nueva;
7. confirmación de que no se modificó contenido interno de otras vistas;
8. comandos ejecutados y salidas de lint, typecheck, pruebas y build;
9. capturas de `1320 × 900` y viewport angosto;
10. evidencia de teclado, foco, semántica, texto de estados y ausencia de overflow;
11. módulos mostrados como no disponibles y razón basada en el código existente;
12. pruebas no ejecutadas, riesgos residuales, supuestos, desviaciones y STOP CONDITIONS.

El handoff no equivale a aceptación. Codex debe auditar fidelidad, arquitectura, pruebas, alcance y regresiones; la Product Owner conserva la aceptación final. No realizar commit ni push.
