# MERDN Task Specification

## 1. Identificación

- **Task ID:** TASK-ALCALDIA-A-03
- **Título:** Alcaldía — Programas
- **Estado:** READY FOR IMPLEMENTATION
- **Prioridad:** HIGH
- **Autor:** Codex, Lead Architect
- **Aprobación de alcance y diseño:** Product Owner, mediante el encargo A-03 y la referencia visual vinculante
- **Implementador previsto:** Claude Code
- **Ruta:** `/municipality`, vista local `programas`
- **Naturaleza:** slice frontend demostrativo, sin backend, persistencia, integraciones ni operaciones Git

## 2. Objetivo y valor

Implementar únicamente la vista **Programas** de Alcaldía sobre el shell aprobado en A-01 y los contratos agregados de población/territorio de A-02. La vista debe permitir supervisar programas mediante población, responsables, ejecutores, estado, avance físico, avance financiero y evidencia agregada, y debe incorporar un flujo frontend mínimo **+ Nuevo programa**.

El resultado debe conservar la jerarquía visual aprobada, demostrar que un programa puede atender una o varias poblaciones base y ser ejecutado por una o varias organizaciones, y evitar que los fixtures se conviertan en catálogos cerrados o reglas productivas. No implementa el modelo persistente definitivo.

## 3. Fuentes autoritativas inspeccionadas

### 3.1 Prototipo visual vinculante

- `prototype-claude/Eligeme-Alcaldia.dc.html`
- navegación **Programas**: líneas 42–45;
- vista **Programas**: líneas 271–315;
- fixtures demostrativos de programas: líneas 841–852.

La sección identificada contiene:

1. título `Programas`;
2. subtítulo `Beneficiarios, cobertura, ejecución y cumplimiento de meta por programa.`;
3. lista vertical de tarjetas blancas con borde lateral de estado;
4. nombre, objetivo, ejecutor, responsable y badge de estado por tarjeta;
5. cuadrícula de seis datos;
6. dos barras paralelas: ejecución presupuestal y cumplimiento de meta.

Son vinculantes la jerarquía, agrupación, orden relativo, densidad, estilo de tarjetas, badges y presentación conjunta de métricas. Los valores son fixtures ficticios y el runtime del prototipo no es reutilizable. No se copia `.dc.html`, `support.js`, estado inline ni reglas del prototipo.

El botón y diálogo **+ Nuevo programa** son una ampliación funcional expresamente aprobada por el Product Owner. Deben integrarse sin reordenar ni rediseñar la vista vinculante.

### 3.2 Implementación aprobada reutilizada

- `tasks/TASK-ALCALDIA-A-01.md` y `tasks/TASK-ALCALDIA-A-02.md`;
- `apps/web/src/features/municipality/MunicipalityShell.tsx`;
- `apps/web/src/features/municipality/municipalityViews.ts`;
- `apps/web/src/features/municipality/municipalityConfig.ts`;
- `apps/web/src/features/municipality/municipality.module.css`;
- componentes y pruebas existentes de Inicio, Población y Territorio.

A-03 reutiliza `/municipality`, sidebar, topbar, selector de periodo, aviso de privacidad, foco al cambiar de vista, branding, configuración demo y contratos de procedencia/territorio de A-01/A-02. No duplica shell ni crea ruta nueva.

### 3.3 Documentación de arquitectura y gobierno

Se aplican `AGENTS.md`, `docs/PRODUCT.md`, `docs/MODULES.md`, `docs/ROLES.md`, `docs/DATA.md`, `docs/ARCHITECTURE.md` y `docs/SECURITY.md`, especialmente:

- Alcaldía consulta información agregada por defecto;
- rol, institución, municipio, programa, finalidad y periodo son condiciones distintas;
- crear, aprobar, ejecutar, cerrar y auditar son permisos separables;
- Hospital y Alcaldía son experiencias diferenciadas sobre capacidades compartidas;
- los programas no pueden codificarse para un único municipio o tipo de institución;
- presupuesto, evidencia, indicadores, procedencia y trazabilidad conservan fronteras propias.

## 4. Agentes utilizados

Codex, como **MERDN Lead Architect and Agent-System Designer**, redactó y consolidó esta Task. Antes del gate de implementación se leyeron íntegramente los contratos pertinentes y participaron estos agentes con revisión limitada a su autoridad:

1. **01 — MERDN Orchestrator:** consistencia general, gate y protección del alcance MVP — PASS.
2. **02 — UX/UI Fidelity Guardian:** fidelidad al prototipo y UX sencilla — PASS, sin rediseño ni `REQUIERE CLAUDE DESIGN`.
3. **03 — Backend & Data Architect:** separación Programa/Población, múltiples poblaciones y ejecutores, fixtures no cerrados — PASS.
4. **04 — Security & Access Guardian:** privacidad agregada y límites de acceso — PASS.
5. **05 — Institutional & Regulatory Agent:** origen y atribuciones institucionales — PASS.
6. **06 — Integrations & Automation Agent:** preparación A-04/H-06B sin integración presente — PASS.
7. **07 — QA & Acceptance Agent:** suficiencia y trazabilidad de aceptación/pruebas — PASS.
8. **09 — Frontend Application Architect:** reutilización A-01/A-02, fronteras y allowlist — PASS después de incorporar la corrección mínima de `municipalityViews.test.ts` a §15.

Ningún agente escribió código ni amplió el producto. Claude Code será el agente de implementación después de este gate; Codex auditará su entrega.

## 5. Alcance

### 5.1 Dentro de alcance

1. Convertir `programas` de «Próximamente» a vista propia dentro del shell municipal.
2. Reproducir la estructura visual vinculante de las tarjetas.
3. Mostrar cinco fixtures iniciales fieles a los ejemplos del prototipo.
4. Representar las tres poblaciones base y la relación muchos-a-muchos programa–población.
5. Representar origen, entidad formuladora, entidad responsable y múltiples ejecutores.
6. Usar los cinco estados MVP aprobados.
7. Mostrar por programa avance físico absoluto + porcentaje y avance financiero en dinero + porcentaje.
8. Mostrar territorio/cobertura y resumen documental agregados sin datos nominales.
9. Incorporar **+ Nuevo programa** mediante diálogo accesible, local y no persistente.
10. Preparar, sin ejecutar, navegación futura hacia A-04 y el cierre demostrativo de un programa finalizado.
11. Mantener extensibilidad mínima para programas futuros de otras organizaciones sin ampliar la UI municipal.
12. Añadir pruebas automatizadas y verificación visual/manual proporcionadas al riesgo.

### 5.2 Fuera de alcance

- backend, API, base de datos, Prisma, migraciones o persistencia;
- autenticación o permisos productivos;
- activación/aprobación real, firmas o separación de funciones ejecutable;
- inscripción o gestión nominal de beneficiarios;
- sincronización automática con Hospital/ESE u operadores; corresponde a H-06B;
- motor financiero, movimientos, facturas, contratos, proveedores, pagos o documentos reales; corresponde a A-04;
- generar, descargar o almacenar informes de cierre;
- crear programas desde Hospital;
- FURAG/MIPG, ADRES, SENA o cumplimiento regulatorio productivo;
- reglas clínicas, elegibilidad, diagnóstico o inferencias sobre personas;
- comercialización privada, portal privado o flujos especiales para organizaciones privadas;
- filtros, búsqueda, ordenamiento, paginación, detalle navegable o exportación no presentes en el encargo;
- cambios a Paciente, Cuidador, Inscripción, Hospital, prototipo, backend o infraestructura;
- commits, pushes, merges, ramas, PR o despliegue.

## 6. Usuarios, instituciones, tenant y permisos

### 6.1 Contextos representados

- **Alcaldía/Secretaría de Salud:** consulta agregada; en el futuro puede crear/incorporar, definir o adoptar metas, asignar presupuesto, vincular ejecutores, aprobar activación y supervisar.
- **Gestor municipal de programas (R7):** rol funcional futuro sujeto a municipio, programa, afiliación, finalidad y vigencia.
- **Hospital/ESE, fundación, operador u otra entidad autorizada:** puede aparecer como ejecutor vinculado; no recibe por A-03 capacidad para crear programas municipales.
- **Planeación, finanzas municipal, control interno y liderazgo:** relaciones futuras; A-03 no les concede permisos.

### 6.2 Regla MVP frontend

La presencia de controles es solo UX demostrativa. No constituye autorización. A-03 no debe afirmar que el perfil visible posee permisos productivos ni simular seguridad mediante botones ocultos.

El formulario local inicia en `BORRADOR`. La transición a `APROBADO` o `ACTIVO` no se ejecuta en A-03. Los fixtures pueden exhibir otros estados para demostrar el catálogo, pero ninguna acción cambia su estado.

### 6.3 Regla futura obligatoria

El backend futuro debe denegar por defecto y evaluar al menos tenant, organización, municipio, afiliación, rol, acción, programa, finalidad, vigencia y separación entre creación/aprobación. Un ejecutor solo accede a programas y responsabilidades vinculados mediante relación autorizada. Esta regla es preparación contractual, no implementación en A-03.

## 7. Modelo frontend mínimo y extensible

Los nombres son orientativos para TypeScript frontend; no son DTO, esquema Prisma ni contrato API definitivo.

### 7.1 Poblaciones base

Catálogo inicial obligatorio, con identificadores estables y etiquetas de presentación:

1. `MAYORES_60` — Personas mayores de 60 años;
2. `DISCAPACIDAD` — Personas en situación de discapacidad;
3. `CUIDADO_EN_CASA` — Personas que requieren cuidados en casa.

Estas son poblaciones base, no programas. Un programa declara `poblacionIds` con uno o varios valores. No se derivan por edad, diagnóstico u otro dato individual; son fixtures declarativos. El tipo no debe convertir estas tres opciones en los únicos grupos que el producto podrá admitir: debe aislar el catálogo de la entidad Programa y permitir añadir opciones configuradas posteriormente sin reescribir las tarjetas o el formulario.

### 7.2 Entidad de presentación Programa

Cada fixture debe tener, como mínimo:

- `id` opaco y estable;
- `nombre`;
- `objetivo` breve para conservar la tarjeta aprobada;
- `poblacionIds` (uno o varios);
- `origen`;
- `entidadFormuladora`;
- `entidadResponsable`;
- `ejecutores` (uno o varios, cada uno con ID, nombre y tipo visible);
- `vigencia` (inicio y fin/etiqueta de periodo demostrativa);
- `presupuesto`;
- `metaFisica` y `resultadoFisico`;
- `estado`;
- `territorio` y `cobertura` agregados;
- `beneficiariosUnicos` y `poblacionAtendida` agregados;
- `avanceFinanciero`;
- `evidencias`;
- `cierre`, cuando corresponda;
- `procedencia` reutilizando el contrato demo de A-02.

`organizationId`/tenant y relaciones institucionales futuras deben poder añadirse o representarse sin codificar `Alcaldía` como único propietario posible. En este slice, todos los datos son `FIXTURE_DEMO`, sin integración y sin fecha productiva.

### 7.3 Origen y formulación

Catálogo MVP exacto:

- `NACIONAL` — Nacional;
- `DEPARTAMENTAL` — Departamental;
- `MUNICIPAL` — Municipal;
- `INSTITUCIONAL_OTRO` — Institucional/Otro.

`origen`, `entidadFormuladora` y `entidadResponsable` son campos distintos. Ningún valor debe inferirse de otro. Debe existir al menos un fixture no municipal que demuestre adopción/implementación por el municipio sin afirmar integración con Nación, Departamento o Secretaría.

### 7.4 Ejecutores

`ejecutores` es siempre una colección no vacía en los fixtures completos. Debe existir al menos un programa con múltiples ejecutores y deben mostrarse todos de forma comprensible. Tipos de presentación admitidos por el fixture: Hospital/ESE, fundación, operador y otra entidad autorizada. No codificar Hospital San Rafael como ejecutor único ni importar configuración de Hospital.

La relación futura programa–ejecutor debe conservar al menos identificadores de programa y organización, rol/tipo de participación, vigencia y estado; la asignación granular de «quién ejecuta qué» y su auditoría quedan como decisión productiva y H-06B.

### 7.5 Estados

Catálogo MVP cerrado para esta Task:

`BORRADOR → APROBADO → ACTIVO → SUSPENDIDO → FINALIZADO`

La flecha expresa el ciclo nominal, no autoriza una máquina de estados productiva ni define transiciones excepcionales. El componente presenta siempre texto además de color. Los antiguos textos del prototipo (`En ejecución`, `Requiere seguimiento`, `Ejecución baja`) no son estados canónicos; la fidelidad conserva la forma del badge y usa los estados aprobados. El seguimiento bajo puede expresarse solo mediante las métricas demostrativas, sin inferir eficiencia ni crear un sexto estado.

## 8. Requisitos funcionales

### FR-01 — Navegación y shell

1. Sidebar `Programas`, `Ver programas` y `Registrar programa` de Inicio navegan localmente a la vista `programas`.
2. `programas` se incorpora a `MUNICIPALITY_MODULOS_IMPLEMENTADOS`.
3. La vista se monta dentro del único shell, conserva sidebar/topbar/periodo/perfil y recibe foco en su `h1` tras navegar.
4. No crea ruta, query string, historial, almacenamiento ni solicitud de red.

### FR-02 — Encabezado y acción primaria

1. Mostrar exactamente título y subtítulo del prototipo.
2. Integrar **+ Nuevo programa** en el encabezado como acción primaria, sin alterar la jerarquía de tarjetas.
3. El botón abre un único diálogo titulado `Nuevo programa`.

### FR-03 — Fixtures y tarjetas

Mantener estos cinco ejemplos demostrativos, sin convertirlos en únicos programas permitidos:

1. Atención domiciliaria;
2. Adulto mayor;
3. Discapacidad;
4. Cuidado en casa;
5. Formación de cuidadores.

Cada tarjeta conserva el orden visual: identidad/objetivo/entidades + estado; datos agregados; avance financiero y físico. Debe añadir poblaciones, origen, vigencia, cobertura y evidencia de forma compacta dentro de esa estructura, sin crear un dashboard o tabla diferente.

Los valores numéricos del prototipo pueden conservarse como fixtures cuando sean coherentes. Toda cifra, entidad, fecha y fuente debe permanecer marcada globalmente como demostrativa, no oficial ni productiva.

### FR-04 — Población, territorio y deduplicación

Cada programa muestra:

- población o poblaciones objetivo;
- beneficiarios únicos;
- población atendida/resultado;
- territorio agregado;
- cobertura en valor absoluto y porcentaje cuando el denominador esté declarado;
- una aclaración accesible de que una persona puede estar en varios programas y solo cuenta una vez en el total municipal.

Las tarjetas no suman beneficiarios para producir el total municipal. No implementan matching, deduplicación, intersecciones productivas ni acceso individual. La configuración debe demostrar un programa con múltiples poblaciones. Las intersecciones detalladas permanecen en A-02; A-03 solo conserva la semántica y no duplica su diagrama.

### FR-05 — Avance físico obligatorio

Cada tarjeta muestra juntos, como textos explícitos:

- `Meta`: valor absoluto + unidad;
- `Resultado` o `Atendidas`: valor absoluto con la misma unidad;
- `Cumplimiento físico`: porcentaje;
- barra visual cuyo valor tiene equivalente textual y semántica accesible.

Para el ejemplo principal: `Meta: 540 personas`, `Atendidas: 412`, `Cumplimiento físico: 76 %`. Los porcentajes son fixtures declarados; el componente no inventa fórmula, redondeo ni evaluación de eficiencia. La coherencia aritmética se comprueba en pruebas, no se convierte en regla productiva.

### FR-06 — Avance financiero obligatorio

Cada tarjeta muestra juntos:

- `Presupuesto asignado`: dinero;
- `Ejecutado`: dinero;
- `Disponible`: dinero;
- `Ejecución financiera`: porcentaje;
- `Comprometido`: dinero cuando el fixture lo declare;
- barra visual con equivalente textual y semántica accesible.

Para el ejemplo principal: `Presupuesto: $680 M`, `Ejecutado: $402 M`, `Ejecución financiera: 59 %`. La vista debe mostrar simultáneamente dinero y porcentaje; nunca solo uno. No deriva `disponible` ni porcentaje, no confunde ejecutado con pagado y no califica eficiencia.

El contrato de presentación debe distinguir `asignado`, `comprometido` opcional, `ejecutado`, `disponible`, `porcentaje` y moneda/unidad. La cadena fuente → asignación → compromiso → causado/obligado → pago/ejecución → evidencia → saldo pertenece a A-04.

### FR-07 — Evidencias agregadas

Cada programa muestra un resumen agregado con:

- evidencias registradas;
- evidencias pendientes;
- actividades con soporte;
- estado documental textual.

No incluye documentos, enlaces a archivos, facturas, proveedores, identificadores personales ni carga real. Puede ofrecer una acción futura/deshabilitada `Ver presupuesto y evidencias` con explicación `Disponible en A-04`; no debe simular navegación o éxito. Si mantener fidelidad sin esa acción es más limpio, basta con preparar un destino tipado/comentado y no mostrar el control.

### FR-08 — Nuevo programa MVP

El diálogo contiene solo:

1. Nombre — texto requerido;
2. Población(es) — grupo multiselección requerido, mínimo una;
3. Origen — select requerido con cuatro opciones exactas;
4. Entidad formuladora — texto requerido;
5. Entidad responsable — texto requerido;
6. Ejecutor(es) — control local repetible o multiselección requerido, mínimo uno;
7. Vigencia — fecha/periodo inicial y final requeridos;
8. Presupuesto — monto no negativo requerido y moneda COP visible;
9. Meta — cantidad no negativa requerida y unidad visible;
10. Estado inicial — campo visible, fijado en `BORRADOR` y no escalable desde este flujo.

Acciones: `Cancelar` y `Crear borrador`. No añadir campos clínicos, contractuales, financieros profundos ni evidencias.

Comportamiento local:

- al abrir, enfoca el título o primer campo;
- mantiene el foco dentro mientras está abierto;
- `Escape`, Cancelar y cierre visible cierran y devuelven foco a **+ Nuevo programa**;
- etiquetas, instrucciones y errores se asocian programáticamente;
- al enviar inválido, no crea nada y enfoca/resume errores;
- al enviar válido, agrega un borrador solo al estado de memoria de la vista, cierra y anuncia `Programa borrador creado de forma demostrativa`;
- el borrador desaparece al recargar o desmontar; no usa red, storage, cookie, URL ni archivo;
- el mensaje aclara que no fue aprobado, activado ni guardado productivamente.

### FR-09 — Cierre preparado

El contrato `cierre` debe permitir, para un fixture `FINALIZADO`, presentar en conjunto:

- presupuesto asignado;
- ejecutado;
- saldo;
- porcentaje de ejecución financiera;
- meta;
- resultado;
- porcentaje de cumplimiento físico;
- beneficiarios únicos agregados;
- evidencias completas;
- evidencias faltantes;
- estado/referencia demostrativa de informe final.

A-03 debe incluir un fixture finalizado o una prueba unitaria del contrato que demuestre estos campos. No genera archivos ni permite cerrar programas. La ausencia de informe final debe mostrarse como pendiente, nunca como cumplimiento.

### FR-10 — Periodo

El selector temporal existente sigue siendo estado local. Cambiar periodo no recalcula fixtures, finanzas o metas. La nota global de datos demostrativos permanece visible.

## 9. Datos, propiedad, sensibilidad y procedencia

| Dato | Propietario futuro | Sensibilidad A-03 | Procedencia A-03 | Restricción |
| --- | --- | --- | --- | --- |
| Programa y vigencia | organización formuladora/administradora dentro del tenant | institucional | fixture demo | no afirmar adopción oficial |
| Poblaciones | organización responsable con gobernanza futura | agregado | catálogo demo | no inferir desde individuos |
| Ejecutor(es) | relación interinstitucional autorizada | institucional | fixture demo | no concede acceso ni contrato |
| Beneficiarios/cobertura | municipio/programa según fuente | agregado potencialmente sensible | fixture demo | sin nombres ni drill-down; deduplicación pendiente |
| Metas/resultados | programa/entidad responsable | institucional | fixture demo | fórmula, unidad, periodo y versión futuros |
| Presupuesto/ejecución | entidad administradora y fuente financiera | financiero agregado | fixture demo | no contabilidad oficial; sin movimientos |
| Evidencias | institución fuente/administradora | conteo agregado | fixture demo | sin archivo ni contenido documental |
| Cierre | programa/entidad responsable | institucional/financiero agregado | fixture demo | sin informe real ni declaración de cumplimiento |

Todas las entidades, montos, fechas, porcentajes y fuentes visibles son ficticios/controlados. No se usan datos reales ni se afirma sincronización. No existe retención porque no hay persistencia; el estado local dura solo la sesión de montaje.

## 10. Privacidad, seguridad y auditoría

### 10.1 Datos prohibidos

La UI visible, accesible, fixtures, pruebas y logs no deben contener:

- nombres de beneficiarios;
- documentos o identificadores personales;
- teléfonos o correos personales;
- direcciones exactas, coordenadas o geolocalización individual;
- HCE, diagnósticos, medicamentos o notas clínicas nominativas;
- salarios, honorarios o pagos individuales;
- datos reales, secretos, tokens o credenciales.

### 10.2 Aislamiento

A-03 no implementa aislamiento; tampoco debe debilitarlo mediante IDs globales, configuración compartida con Hospital o supuestos de un único municipio. El frontend no es autoridad. El modelo productivo futuro exigirá tenant y organización no nulos, relaciones entre organizaciones validadas y pruebas negativas de cruce.

### 10.3 Auditoría futura

No se emiten eventos reales. El diseño futuro debe contemplar, al menos: `PROGRAM_CREATED`, `PROGRAM_APPROVED`, `PROGRAM_ACTIVATED`, `PROGRAM_SUSPENDED`, `PROGRAM_FINALIZED`, `PROGRAM_EXECUTOR_LINKED`, `PROGRAM_BUDGET_ASSIGNED`, `PROGRAM_TARGET_CHANGED` y `PROGRAM_CLOSURE_RECORDED`, con actor, tenant, organización, municipio, programa, acción, valores anterior/nuevo minimizados, resultado, timestamp y correlación. La taxonomía definitiva es decisión abierta.

## 11. Relación con A-04, H-06B y alcance estratégico

- **A-04:** dueño del movimiento financiero profundo, documentos, facturas, evidencia y saldo. A-03 conserva únicamente resumen y un destino futuro no operativo.
- **H-06B:** dueño de la recepción automática en Hospital de programas vinculados. A-03 prepara IDs/relación de ejecutores, pero no toca Hospital ni sincroniza.
- **SENA:** `Formación de cuidadores` puede aparecer como fixture; no afirma convenio, certificación válida ni integración.
- **FURAG/MIPG, ADRES y T-319:** A-03 no calcula, evalúa ni declara cumplimiento; el Programa sigue siendo relacionable en el futuro con el Hub institucional y evidencia.
- **Indicadores:** porcentajes demo no son indicadores oficiales; fuente, fórmula, periodo, propietario, versión y linaje siguen pendientes.

## 12. Preparación futura privada sin ampliar el MVP

La entidad conceptual Programa debe pertenecer a una organización dentro de un tenant, no a una clase fija `Alcaldía`. `origen`, `formuladora`, `responsable` y `ejecutores` son relaciones/datos independientes. Esto permite que en el futuro una agencia domiciliaria, fundación, institución geriátrica u otra organización autorizada defina programas propios.

A-03 no muestra selector de tipo privado, ventas, precios, membresías, pagos, clientes ni portal nuevo. No añade copy comercial. La preparación se verifica por ausencia de discriminantes o condicionales que hagan obligatorio `municipal`/`alcaldía` en el tipo base de Programa; el contexto visual sigue siendo exclusivamente Alcaldía.

## 13. Accesibilidad y responsive

1. Un solo `h1` y jerarquía de encabezados coherente.
2. Listas y grupos semánticos para tarjetas, poblaciones, ejecutores y métricas.
3. Estado, evidencia y progreso nunca dependen solo del color.
4. Barras con nombre, valor textual y `aria-valuenow/min/max` solo cuando la semántica sea válida; los porcentajes siguen visibles como texto.
5. Botón **+ Nuevo programa** con nombre accesible; diálogo con título/descripción, modalidad, foco inicial, ciclo de foco, Escape y devolución de foco.
6. Todos los campos tienen `label`, requerimiento y error asociado; multiselecciones son operables por teclado.
7. Mensaje de creación local mediante región de estado no intrusiva.
8. Foco visible y orden lógico; objetivos táctiles adecuados.
9. Escritorio de referencia `1340×900`; tableta `768×1024`; móvil `375×812`.
10. Las tarjetas pasan a una columna y las métricas hacen wrap sin perder dinero/porcentaje; el diálogo es desplazable dentro del viewport.
11. Zoom/reflow 200 % sin overflow horizontal de página, contenido oculto ni controles inaccesibles.
12. Movimiento reducido: no se requiere animación; si se añade transición CSS, respetar `prefers-reduced-motion`.

## 14. Arquitectura frontend esperada

- `MunicipalityPrograms` contiene la pantalla y tarjetas, recibe configuración tipada y gestiona únicamente borradores efímeros.
- `MunicipalityProgramForm` contiene el diálogo/formulario y su accesibilidad; no mezcla tarjetas ni shell.
- configuración, fixtures, catálogos y textos viven centralizados en `municipalityConfig.ts`, no duplicados en componentes/pruebas.
- funciones puras de validación/normalización local pueden vivir junto al formulario o configuración si permanecen enfocadas y probables.
- `MunicipalityShell` solo monta la vista en el switch existente.
- `municipalityViews.ts` solo incorpora `programas` a implementados; no cambia navegación global.
- CSS extiende el módulo municipal existente y no crea otro sistema visual.
- no se añaden dependencias, contextos globales, providers, rutas ni imports desde `features/hospital`.

## 15. Archivos permitidos y previstos

Allowlist exacta para Claude Code:

1. `apps/web/src/features/municipality/MunicipalityPrograms.tsx` — **crear** vista y tarjetas.
2. `apps/web/src/features/municipality/MunicipalityProgramForm.tsx` — **crear** diálogo y formulario local.
3. `apps/web/src/features/municipality/municipalityPrograms.test.tsx` — **crear** pruebas de vista, datos, formulario, privacidad y límites.
4. `apps/web/src/features/municipality/municipalityConfig.ts` — **modificar** tipos, catálogos, textos y fixtures A-03.
5. `apps/web/src/features/municipality/municipalityViews.ts` — **modificar** lista de módulos implementados.
6. `apps/web/src/features/municipality/municipalityViews.test.ts` — **modificar** únicamente las expectativas que incorporan `programas` a los módulos con contenido propio y lo retiran de «Próximamente».
7. `apps/web/src/features/municipality/MunicipalityShell.tsx` — **modificar** montaje de Programas.
8. `apps/web/src/features/municipality/municipalityShell.test.tsx` — **modificar** navegación/regresión del shell.
9. `apps/web/src/features/municipality/municipality.module.css` — **modificar** estilos responsive/accesibles A-03.

No se prevé modificar `municipalityTestUtils.ts`; puede leerse y reutilizarse. Si una prueba exige cambiarlo, Claude Code debe justificar que es una extensión general y no una alteración de A-01/A-02; sin aprobación de Codex, se mantiene fuera de allowlist.

Toda ruta no listada está fuera de alcance. Si resulta necesario tocar otra ruta, el gate para esa ampliación es **READY FOR CLAUDE: NO** y se retorna a Codex/Product Owner.

## 16. Archivos y áreas prohibidos

- `prototype-claude/**`;
- `apps/web/src/features/hospital/**`;
- Paciente, Cuidador e Inscripción;
- `apps/api/**`, backend y APIs;
- `prisma/**`, esquemas y migraciones;
- infraestructura, despliegue y secretos;
- configuración global de branding, salvo nueva autorización expresa;
- `AGENTS.md`, `CLAUDE.md` y documentación autoritativa;
- dependencias y lockfiles;
- `.git/**`, commits, pushes, merges, ramas y PR.

## 17. Criterios de aceptación

- **AC-01 Prototipo:** Programas conserva título, subtítulo, tarjetas, badge, cuadrícula y dos progresos en la jerarquía vinculante.
- **AC-02 Navegación:** sidebar y dos accesos de Inicio abren `programas`; activo y foco son correctos; no hay ruta/red/storage.
- **AC-03 Fixtures:** aparecen los cinco programas iniciales y siguen siendo datos configurables, no enum de programas permitidos.
- **AC-04 Poblaciones:** se muestran las tres poblaciones base como catálogo separado; al menos un programa atiende varias.
- **AC-05 Deduplicación:** se declara beneficiario único y no se suman tarjetas para obtener el total municipal.
- **AC-06 Origen:** catálogo exacto de cuatro orígenes; formuladora y responsable independientes; fixture no municipal presente.
- **AC-07 Ejecutores:** al menos un programa muestra dos o más ejecutores; Hospital no adquiere capacidad de creación.
- **AC-08 Estados:** solo aparecen `BORRADOR`, `APROBADO`, `ACTIVO`, `SUSPENDIDO` y `FINALIZADO`; significado textual no depende del color.
- **AC-09 Nuevo programa:** botón abre/cierra el diálogo accesible y devuelve foco; contiene exactamente los diez grupos de campos mínimos.
- **AC-10 Validación:** requiere nombre, una población, origen, formuladora, responsable, un ejecutor, vigencia válida, presupuesto/meta no negativos; estado inicial fijo en BORRADOR.
- **AC-11 Memoria local:** envío válido crea solo un borrador efímero y lo anuncia; no aprueba, activa ni persiste.
- **AC-12 Avance físico:** cada tarjeta presenta meta absoluta, resultado absoluto y porcentaje juntos, con barra accesible.
- **AC-13 Avance financiero:** cada tarjeta presenta asignado, ejecutado, disponible y porcentaje juntos; comprometido solo cuando existe.
- **AC-14 Sin lógica financiera inventada:** no deriva saldos, pagos, causado/obligado, eficiencia o contabilidad; A-04 permanece fuera.
- **AC-15 Evidencia:** cada tarjeta presenta los cuatro agregados documentales y ningún archivo/documento real.
- **AC-16 Cierre:** un finalizado/contrato probado contiene los once datos exigidos; no genera informe ni cierra realmente.
- **AC-17 Privacidad:** no hay datos personales, clínicos, direcciones exactas, contacto ni compensación individual.
- **AC-18 Procedencia:** fixtures rotulados demo; no se afirma dato oficial, adopción, integración o sincronización.
- **AC-19 Marca:** UI visible/accesible usa ELÍGEME/Elígeme y no muestra `MERDN`.
- **AC-20 Futuro privado:** tipo base no exige Alcaldía/municipal, sin UI o función privada nueva.
- **AC-21 A-01/A-02:** Inicio, Población, Territorio, selector, shell y estados próximos restantes no regresan.
- **AC-22 Hospital:** archivos Hospital no cambian y su suite no regresa.
- **AC-23 Accesibilidad:** teclado, foco, diálogo, labels, errores, estados, progresos y anuncios cumplen §13.
- **AC-24 Responsive:** escritorio, tableta, móvil y zoom 200 % conservan estructura y uso sin overflow de página.
- **AC-25 Integridad:** diff limitado a la allowlist; prototipo/áreas prohibidas intactos; cero dependencias.
- **AC-26 Calidad:** lint, typecheck, build y suites relevantes pasan sin fallos introducidos.

## 18. Pruebas requeridas

| ID | Tipo | Verificación |
| --- | --- | --- |
| T-01 | Navegación | Sidebar, Ver programas y Registrar programa montan Programas; activo/foco/shell correctos. |
| T-02 | Visual/estructura | Encabezado, cinco tarjetas, orden interno, badges, métricas y barras corresponden al prototipo. |
| T-03 | Fixtures | Cinco nombres exactos; configuración separada de catálogo y sin lista cerrada productiva. |
| T-04 | Poblaciones | Tres bases exactas y programa con múltiples `poblacionIds`. |
| T-05 | Deduplicación | Beneficiarios únicos visibles; ausencia de suma/reduce de tarjetas para total municipal. |
| T-06 | Origen | Cuatro opciones exactas; formuladora/responsable separadas y fixture de origen no municipal. |
| T-07 | Ejecutores | Colección por programa, mínimo uno y fixture con múltiples tipos/entidades. |
| T-08 | Estados | Catálogo exacto, todos demostrables y BORRADOR fijo en alta. |
| T-09 | Formulario | Diez grupos mínimos, sin campos extra de alcance profundo. |
| T-10 | Validación | Requeridos, múltiples poblaciones/ejecutores, fechas, monto/meta y resumen de errores. |
| T-11 | Ciclo modal | Apertura, foco inicial, Tab/Shift+Tab, Escape, cierre, retorno de foco y scroll móvil. |
| T-12 | Alta local | Crea borrador efímero, anuncia carácter demo y no usa red/storage/URL. |
| T-13 | Física | Absolutos + porcentaje por tarjeta; fixture 540/412/76 % coherente. |
| T-14 | Financiera | Dinero + porcentaje por tarjeta; $680 M/$402 M/59 %; comprometido opcional. |
| T-15 | Límite financiero | Ausencia de causado, obligación, pago, factura, proveedor, derivación de saldo o eficiencia. |
| T-16 | Evidencia | Registradas, pendientes, actividades con soporte y estado documental agregados. |
| T-17 | Cierre | FINALIZADO/contrato incluye presupuesto, ejecución, saldo, metas, beneficiarios, evidencias e informe. |
| T-18 | Privacidad | Búsquedas negativas de identidad, contacto, dirección, clínica y pago individual. |
| T-19 | Branding/procedencia | ELÍGEME visible; `MERDN` ausente; fixture demo y sin oficialidad/integración. |
| T-20 | Extensibilidad | Otro programa/organización fixture se representa sin condicional municipal ni cambio estructural. |
| T-21 | A-01/A-02 | Suites municipales existentes pasan; resto de módulos mantiene Próximamente. |
| T-22 | Hospital | Suite web/Hospital existente pasa y diff confirma cero archivos Hospital modificados. |
| T-23 | Accesibilidad | Semántica, nombres, labels, errores, foco, progreso, estado y teclado. |
| T-24 | Responsive visual | Capturas 1340×900, 768×1024, 375×812 y prueba de zoom/reflow 200 %. |
| T-25 | Integridad | Sin red/storage/dependencias; allowlist exacta; prototipo y prohibidos intactos. |

Claude Code debe ejecutar y reportar como mínimo:

1. `npm.cmd run lint`;
2. `npm.cmd run typecheck`;
3. `npm.cmd run test --workspace @merdn/web`;
4. `npm.cmd run build:web`;
5. `npm.cmd run dev:web` y URL local exacta de `/municipality`;
6. revisión visual de Programas y diálogo en los tres viewports;
7. prueba manual de teclado, foco, Escape, retorno de foco y zoom 200 %;
8. búsqueda negativa de datos prohibidos, `MERDN`, red, storage y lógica financiera profunda;
9. regresión explícita de Inicio, Población, Territorio y Hospital;
10. `git status --short` y diff exacto de archivos autorizados.

Una prueba no ejecutada se reporta como no ejecutada, nunca como aprobada. No se añade una dependencia para suplir limitaciones del entorno de pruebas actual.

## 19. Evidencia requerida en el handoff

Claude Code debe devolver:

1. Task ID y estado real: implementada/verificada, parcial o bloqueada.
2. URL localhost exacta.
3. archivos creados/modificados y propósito; cero eliminaciones, dependencias y cambios prohibidos.
4. matriz AC-01 a AC-26 con evidencia concreta.
5. comandos, resultados completos, fallos y pruebas no ejecutadas.
6. capturas de Programas cerrada y con diálogo abierto en los tres viewports.
7. comparación visual trazable con líneas 271–315 y fixtures 841–852 del prototipo.
8. evidencia de los cinco fixtures, tres poblaciones, múltiples poblaciones/ejecutores y cuatro orígenes.
9. evidencia por tarjeta de dimensión física y financiera completa.
10. evidencia del formulario, validaciones, estado BORRADOR, memoria local y ausencia de persistencia.
11. evidencia de cierre preparado y límites A-04/H-06B.
12. evidencia de privacidad, procedencia demo, branding y extensibilidad institucional.
13. evidencia manual de accesibilidad, teclado, foco, diálogo y zoom.
14. resultados de regresión A-01, A-02 y Hospital.
15. `git status --short` y diff limitado a allowlist.
16. supuestos, desviaciones, riesgos residuales, decisiones abiertas y STOP CONDITIONS.

El handoff no equivale a aceptación. Codex audita y el Product Owner acepta o rechaza.

## 20. Condiciones de parada

Claude Code debe detener la parte afectada y retornar a Codex/Product Owner si:

1. necesita tocar cualquier archivo fuera de la allowlist;
2. necesita modificar el prototipo o usar `.dc.html`/`support.js` como runtime;
3. necesita tocar Hospital, Paciente, Cuidador, Inscripción, backend, Prisma, migraciones o infraestructura;
4. necesita añadir dependencia, ruta, provider, contexto global o sistema visual;
5. necesita backend, datos reales, permisos, persistencia, integración o documentos;
6. necesita definir transiciones productivas de estado o quién aprueba/activa/cierra;
7. necesita decidir identidad, deduplicación, elegibilidad o acceso nominal;
8. necesita decidir fórmula oficial de meta, cobertura, porcentaje o indicador;
9. necesita decidir semántica contable, comprometido, causado/obligado, pago o saldo;
10. necesita definir contrato productivo de programa–ejecutor o conexión H-06B;
11. necesita inventar contenido visual material que contradiga la jerarquía aprobada;
12. no puede implementar el diálogo accesible sin alterar Hospital u otra área prohibida;
13. una prueba crítica falla o cambios ajenos se solapan con la allowlist y no pueden preservarse.

Un defecto ordinario dentro del alcance no es condición de parada: se corrige y se vuelve a probar.

## 21. Compatibilidad, migración y rollback

- No hay migración, API ni compatibilidad de esquema productivo.
- Cambio aditivo en la feature municipal existente.
- Mantiene IDs/ruta/navegación de A-01/A-02 y activa únicamente `programas`.
- El estado creado es efímero y no requiere limpieza de datos.
- Rollback conceptual: retirar los dos componentes/prueba A-03, estilos/configuración A-03 y devolver `programas` a Próximamente. Claude Code no ejecuta borrados o rollback sin autorización.
- Hospital y demás experiencias permanecen intactos.

## 22. Decisiones, supuestos, riesgos y bloqueos

### 22.1 Decisiones aprobadas aplicadas

1. Diseño visual del prototipo sin rediseño.
2. Tres poblaciones base, separadas de programas y combinables.
3. Programas configurables; cinco fixtures no son catálogo cerrado.
4. Origen nacional, departamental, municipal o institucional/otro.
5. Formuladora, responsable y múltiples ejecutores separados.
6. Ciclo BORRADOR → APROBADO → ACTIVO → SUSPENDIDO → FINALIZADO.
7. Alcaldía crea/incorpora y aprueba en el futuro; Hospital solo ejecuta cuando está vinculado.
8. Avance físico absoluto + porcentaje y financiero dinero + porcentaje siempre juntos.
9. Resumen financiero/documental en A-03; profundidad en A-04.
10. Cierre completo preparado, sin archivo real.
11. Alcaldía solo ve agregados y no ve datos clínicos o personales.
12. Extensibilidad futura privada sin ampliar el MVP visual/funcional.

### 22.2 Supuestos controlados

- Entidades, programas, montos y métricas del prototipo son fixtures ficticios/controlados.
- `Ejecutado` y `disponible` se presentan como literales demo y no se interpretan como contabilidad oficial.
- Para satisfacer el cierre preparado sin añadir una sexta tarjeta, puede asignarse `FINALIZADO` a uno de los cinco fixtures siempre que conserve el ejemplo visual; alternativamente, probar un fixture de contrato no visible. Se recomienda que los cinco estados estén representados entre fixtures para hacer verificable el catálogo, sin inferir salud/eficiencia.
- El diálogo local es la mínima ampliación aprobada y no representa autorización productiva.

### 22.3 Decisiones materiales pendientes

No bloquean este slice porque usa fixtures y estado efímero:

1. modelo persistente, propietario y jerarquía exacta tenant–organización–municipio–programa;
2. matriz definitiva de crear, editar, aprobar, activar, suspender, finalizar y auditar;
3. flujo de adopción de programas nacionales/departamentales y evidencia de formulación;
4. catálogo/identidad de organizaciones y términos de vinculación de ejecutores;
5. contrato H-06B, sincronización, fallos, revocación y visibilidad para Hospital/ESE;
6. identidad, matching y deduplicación productiva entre programas/instituciones;
7. elegibilidad, inscripción, retiro, transferencias y reglas de población atendida;
8. fórmula, unidad, versión, corte, fuente y gobernanza de metas/cobertura/indicadores;
9. modelo financiero A-04 y significado de asignado, comprometido, obligado, pagado, ejecutado, disponible y saldo;
10. estándar, retención, integridad y completitud de evidencias/informe final;
11. reglas/transiciones y requisitos de cierre/reapertura;
12. umbral de grupos pequeños, supresión, generalización y exportación;
13. taxonomía y retención de auditoría;
14. modelo comercial/privado futuro.

### 22.4 Riesgos residuales

- Las cifras demo pueden parecer oficiales; se mitiga con rotulado global persistente y pruebas negativas.
- Porcentajes físicos/financieros pueden interpretarse como eficiencia; se mitiga con etiquetas descriptivas y prohibición de calificación.
- La suma de beneficiarios por tarjeta puede inducir doble conteo; se mitiga con texto de deduplicación y ausencia de total calculado.
- Montos del prototipo pueden no reconciliar bajo una fórmula contable; se mantienen declarativos y A-04 definirá semántica.
- Un diálogo con múltiples selecciones puede degradar en móvil/teclado; se exige QA manual y controles nativos/simples.
- Tipos frontend pueden confundirse con contrato productivo; comentarios deben señalar su carácter demo/preparatorio.

### 22.5 Bloqueos actuales

Ninguno para la implementación frontend demostrativa delimitada por esta Task.

## 23. Definition of Done y gate

A-03 se considera implementada únicamente cuando Programas es fiel, navegable, accesible y responsive; presenta cinco fixtures configurables, relaciones múltiples, métricas físicas/financieras completas, evidencia y cierre preparados; el alta crea solo un BORRADOR efímero; privacidad, procedencia y límites A-04/H-06B se cumplen; A-01, A-02 y Hospital no regresan; todas las pruebas ejecutadas pasan; y Claude Code entrega evidencia completa para auditoría.

**READY FOR CLAUDE: SÍ**

Este gate autoriza exclusivamente a Claude Code a implementar y probar el slice frontend demostrativo dentro de la allowlist de §15. No autoriza backend, datos reales, integraciones, permisos productivos, reglas financieras/indicadores, cambios al prototipo, operaciones Git de escritura ni despliegue.
