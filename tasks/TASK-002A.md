# MERDN Task Specification

## Identificación

- **Task ID:** TASK-002A
- **Título:** Correcciones visuales y funcionales aprobadas por Product Owner
- **Estado:** APPROVED — READY FOR CLAUDE CODE
- **Prioridad:** HIGH
- **Dependencia:** implementación existente de TASK-002
- **Autoridad:** decisiones expresas del Product Owner

## Objetivo

Corregir TASK-002 para que la entrada principal del registro sea «¿Cómo se va a registrar?» de `prototype-claude/Eligeme-Inscripcion.dc.html`, seguida exclusivamente por la rama de Paciente, Cuidador o Visitador médico. Completar además la bitácora del paciente, añadir «Otros» en Diagnósticos y corregir los iconos y la presentación flotante de Elí en Inicio del Paciente.

## Decisión visual definitiva

La pantalla de `prototype-claude/Eligeme-Inscripcion.dc.html` con el encabezado **«¿Cómo se va a registrar?»** y las opciones **Paciente**, **Cuidador** y **Visitador médico** es la pantalla oficial de inscripción y la entrada principal en `/`.

Debe conservar fielmente estructura, colores, tipografía, textos, cards, jerarquía, encabezado, personaje Elí y burbuja flotante inferior derecha. No se autoriza rediseñarla, mezclarla con otra propuesta ni anteponer pantallas de First Run.

Esta decisión reemplaza para TASK-002A cualquier instrucción anterior de TASK-002 que excluyera `Eligeme-Inscripcion.dc.html`, estableciera First Run 1a como entrada o exigiera conservar 16 pasos redundantes. El código útil ya implementado puede reutilizarse, pero no determina el flujo de producto.

## Referencias vinculantes

- **Inscripción y ramas:** `prototype-claude/Eligeme-Inscripcion.dc.html`, inspeccionado solo en lectura y reconstruido sin ejecutar/importar `.dc.html`, `support.js` o su estado inline.
- **Bitácora completa:** vista `bitStep` de `prototype-claude/Eligeme-Paciente.dc.html`; `Eligeme-Cuidador.dc.html` confirma la estructura. Usar copy dirigido al paciente.
- **Diagnósticos:** opciones y patrón ya implementados en TASK-002; reutilizar chips, campos, labels, errores y acciones existentes.
- **Iconos de Inicio:** tarjetas de `Eligeme-Paciente.dc.html` y `Eligeme-Cuidador.dc.html`.
- **Elí flotante:** patrón de composición de `Eligeme-Inscripcion.dc.html`: activador tipo píldora abajo a la derecha, sombra, panel expandible, encabezado con Elí y ayuda contextual. La pose del activador queda sustituida por la expresión aprobada **«PREGUNTA»** definida en esta tarea; no se conserva `saluda2.png` si contradice esa expresión.
- El nombre Elí sigue siendo provisional y debe consumirse desde branding central.
- **Ubicación territorial:** DANE DIVIPOLA es la fuente de autoridad para departamentos y municipios de Colombia. La implementación debe usar un catálogo frontend local, completo y versionado derivado de esa fuente.
- **Personalidad visual y logo:** `prototype-claude/ref/personaje3.png` es la lámina aprobada que documenta el logo corazón con tilde/check, los gestos de Elí y las expresiones «TE ESCUCHA», «PREGUNTA», atención, aclaración, tranquilidad y agradecimiento. Los assets individuales existentes en `prototype-claude/assets/eli/**` deben contrastarse con esa lámina antes de asignar una pose.

## Identidad visual de la inscripción

### Logo aprobado

Incorporar en al menos un punto coherente de la pantalla de inscripción el logo aprobado de **corazón con tilde/check integrado**, preferiblemente junto a la marca en el encabezado.

No sustituirlo por un corazón, check, icono médico o símbolo genérico. Debe reutilizarse la referencia exacta documentada en `prototype-claude/ref/personaje3.png` o un asset aprobado equivalente ya presente en el repositorio. Si la referencia no existe como archivo independiente, puede obtenerse un asset recortado fiel de la lámina aprobada, conservando forma, proporciones y colores, sin modificar el archivo fuente ni redibujar el símbolo.

El logo debe implementarse como asset/componente reutilizable, con una única fuente visual y sin quedar hard-coded dentro de una sola pantalla.

### Subtítulo de marca

En el encabezado de inscripción, sustituir el segmento **«Atención domiciliaria»** por exactamente:

> Evidencia · Local · Inteligente

Conservar la jerarquía, posición, tamaño, peso, color y relación visual del subtítulo existente. Si se conserva el prefijo de la referencia, la línea completa resultante será **«Panel de inscripción · Evidencia · Local · Inteligente»**. El cambio aplica al texto del encabezado de inscripción y no renombra módulos o conceptos de atención domiciliaria en otras partes del producto.

### Sistema expresivo de Elí

Elí es un personaje expresivo, no una imagen única encerrada siempre en una burbuja genérica. Puede aparecer como personaje visible, avatar, burbuja flotante o gesto contextual.

Las poses deben seleccionarse por intención y reutilizar las referencias aprobadas para: escucha, explica, guía, motiva, alerta, agradece, pregunta, dudas, éxito, recordatorio, preocupación y tranquilidad. No inventar otra personalidad, estilo, vestuario, rostro o personaje.

La implementación debe centralizar un mapeo tipado entre estado semántico y asset aprobado. Los componentes deben solicitar una intención —por ejemplo `escucha` o `pregunta`— en lugar de repetir rutas de imagen o decidir poses de forma aislada.

Para la pantalla inicial de inscripción:

1. **Primera aparición de Elí:** usar la expresión **«TE ESCUCHA»**, correspondiente a cercanía, atención y disposición para ayudar. La referencia individual existente `assets/eli/escucha.png` debe validarse contra la lámina aprobada.
2. **Burbuja flotante «¡Hola! Soy Elí»:** usar una expresión distinta, correspondiente a **«PREGUNTA»**, para invitar a conversar.

No reutilizar exactamente la misma expresión en estas dos apariciones ni usar una pose única para todos los contextos. El contenedor visual puede variar según el patrón aprobado; la personalidad se comunica mediante el gesto y la composición, no mediante una burbuja genérica obligatoria alrededor de cada aparición.

## Alcance

### Incluido

1. Usar la pantalla oficial como entrada de `/`.
2. Implementar una selección inicial y tres ramas independientes.
3. Reutilizar componentes válidos de First Run solo donde coincidan con la referencia y la rama.
4. Retirar del recorrido activo los pasos redundantes.
5. Incorporar la bitácora completa en la experiencia del paciente.
6. Añadir «Otros» y diagnósticos adicionales.
7. Corregir iconos y Elí en Inicio del Paciente.
8. Actualizar pruebas frontend relacionadas.

### Fuera de alcance

- Backend, API, Server Actions, base de datos o persistencia.
- Autenticación, autorización, tenant, institución o verificación real.
- Registro productivo, consultas de documentos/EPS/IPS/ESE o credenciales.
- Reglas clínicas, diagnósticos calculados, alertas, prescripción o semáforos.
- Chatbot, voz, audio o IA conectada.
- Rediseño, módulos ajenos o dependencias nuevas.

## Flujo aprobado

### Regla común

1. `/` abre directamente «¿Cómo se va a registrar?».
2. El usuario selecciona una sola vez Paciente, Cuidador o Visitador médico.
3. Solo se renderiza la rama seleccionada; no se vuelve a preguntar el rol.
4. Volver desde el primer paso o «Cambiar de rol» puede regresar a la selección inicial y debe limpiar el estado local de la rama anterior.

### Paciente — inscripción simple de cinco pasos

Reproducir los cinco pasos de `Eligeme-Inscripcion.dc.html`:

1. Datos personales.
2. Condición y necesidades, incluida la clasificación prioritaria y Diagnósticos.
3. Ubicación y EPS.
4. Contactos.
5. Confirmación.

La inscripción del paciente termina en el paso 5. Después de la confirmación local se muestra el final demostrativo y se permite entrar a Inicio del Paciente.

Diagnósticos forma parte del paso 2 «Condición y necesidades» y no constituye un sexto paso. La bitácora clínica/operativa completa no forma parte de la inscripción ni puede interponerse entre Confirmación e Inicio; se diligencia posteriormente desde la experiencia del paciente.

No repetir rol, documento, situación, ubicación u otros datos ya capturados. No conservar pantallas del First Run que resulten redundantes ni renumerar la inscripción por componentes reutilizados.

#### Clasificación prioritaria no excluyente

Dentro del paso 2, el paciente debe poder seleccionar simultáneamente cualquier combinación de:

- Persona mayor de 60 años.
- Persona con discapacidad.
- Persona que requiere cuidados en casa.

Las tres opciones son independientes y no excluyentes. Seleccionar o deseleccionar una no debe modificar las otras. Debe conservarse el texto de la referencia que indica que puede marcar una, dos o las tres.

### Cuidador

Reproducir únicamente:

1. Datos personales.
2. Perfil del cuidador.
3. Vincular paciente.
4. Contacto cercano.
5. Confirmación.

Finalizar con el estado local de cuenta de cuidador de la referencia. No buscar, crear o vincular pacientes realmente. No mostrar Diagnósticos, primera bitácora o Inicio del Paciente.

### Visitador médico

Reproducir únicamente:

1. Datos personales.
2. Información profesional.
3. EPS e institución.
4. Zona de atención.
5. Verificación.

Finalizar con «Registro recibido»/pendiente de verificación. No verificar credenciales ni habilitar permisos reales. No mostrar pantallas exclusivas de Paciente o Cuidador.

## Requisitos funcionales

### FR-01 — Entrada y fidelidad

`/` debe renderizar directamente la pantalla oficial y sus tres cards, preservando copy, estructura, orden, jerarquía, progreso, colores, tipografía y ayudas de Elí. Solo se permiten mejoras semánticas/accesibles que no alteren la presentación.

### FR-02 — Una selección de perfil

El perfil determina la rama y no vuelve a preguntarse. Componentes reutilizados de First Run deben recibir el perfil resuelto o eliminar su selector redundante.

### FR-03 — Estado efímero y aislado

Todo dato existe solo en memoria. Una rama no puede filtrar valores a otra. Cambiar de rol o reiniciar elimina los datos. No usar API, cookies, `localStorage`, `sessionStorage`, IndexedDB, URL, logs, consola o analytics.

### FR-04 — Validación local

Implementar únicamente validaciones de completitud y formato inequívocas. Los errores deben ser claros, asociados al control y enfocar el primer campo inválido. No inventar verificaciones institucionales, regulatorias o clínicas.

En la inscripción de **Paciente**, todos los datos solicitados son obligatorios. En la inscripción de **Cuidador**, todos los datos solicitados son obligatorios. Esto reemplaza cualquier indicación visual previa de que un dato de esas dos ramas es opcional.

Un campo condicional solo existe mientras su condición esté activa y, mientras esté visible, es obligatorio. Si la condición se desactiva, el campo se oculta, su error desaparece y su valor se elimina del estado local. Como caso vinculante, seleccionar «Otros» en Diagnósticos obliga a diligenciar cada campo de diagnóstico adicional visible.

Los labels deben identificar visualmente la obligatoriedad, y el intento de avanzar con información faltante debe mostrar un mensaje específico junto al campo o grupo, anunciarlo de forma accesible y mover el foco al primer error. La rama Visitador médico conserva la obligatoriedad definida por su flujo aprobado; esta decisión no autoriza a inventar requisitos de acreditación.

### FR-04A — Ubicación territorial con DIVIPOLA

En cualquier formulario de Paciente, Cuidador o Visitador médico donde se solicite ubicación, usar exactamente esta estructura y orden:

1. **Departamento \*** — selector con la lista completa oficial de departamentos de Colombia.
2. **Municipio \*** — selector con la lista oficial de municipios correspondiente al departamento seleccionado.
3. **Nombre del corregimiento** — campo de texto libre para que el usuario escriba el corregimiento.

Departamento y Municipio son obligatorios en las tres ramas siempre que aparezca el grupo de ubicación. En Paciente y Cuidador, «Nombre del corregimiento» también es obligatorio por la regla de que todos los datos solicitados lo son. En Visitador médico se aplica la obligatoriedad definida por su formulario aprobado.

La fuente de referencia debe ser **DANE DIVIPOLA**. Para este frontend MVP:

- usar un catálogo local/versionado dentro de `apps/web/**` para permitir la selección sin conexión y evitar una llamada externa por formulario;
- incluir códigos oficiales de departamento y municipio, nombres oficiales, versión o fecha de corte, fuente y fecha de obtención;
- filtrar Municipio por el código del Departamento seleccionado;
- al cambiar Departamento, limpiar cualquier Municipio previamente seleccionado que ya no pertenezca al nuevo departamento;
- mostrar Municipio deshabilitado hasta seleccionar Departamento;
- no escribir manualmente listas parciales, no inventar entidades territoriales y no usar datos demostrativos del prototipo como catálogo;
- ordenar las opciones de forma predecible y conservar caracteres, tildes y códigos oficiales;
- permitir actualizar el catálogo en una tarea posterior sin reescribir los componentes del formulario.

La incorporación del catálogo al repositorio debe preservar trazabilidad de la versión de DIVIPOLA usada. No se implementa una consulta online a DANE en tiempo de ejecución.

### FR-05 — Bitácora completa posterior a la inscripción

La bitácora clínica/operativa completa queda expresamente fuera de los cinco pasos de inscripción. Debe estar disponible posteriormente dentro de la experiencia del paciente, accesible desde Inicio o el acceso de bitácora aprobado, sin ser requisito para terminar el registro.

Debe reutilizar la versión completa Paciente/Cuidador y permitir diligenciar, en orden:

1. estado del día y comparación con ayer;
2. signos vitales mostrados por la referencia;
3. comida y líquidos;
4. medicamentos;
5. higiene y cuidado;
6. movilidad;
7. evento importante;
8. observaciones, revisión y confirmación.

Conservar progreso interno, anterior/siguiente, valores al retroceder y revisión final. Su progreso «Paso X de 8» es propio de la bitácora y no altera ni continúa el «Paso X de 5» de inscripción. No copiar historial, pacientes demostrativos, estados previos o accesos del portal completo. No calcular rangos, severidad, urgencia, alertas, diagnósticos o recomendaciones.

### FR-06 — Diagnósticos dentro de «Condición y necesidades»

Diagnósticos debe integrarse en el paso 2 de la rama Paciente sin crear un paso adicional. Conservar todas las opciones existentes y añadir exactamente **«Otros»** con el mismo patrón. Al seleccionarla, mostrar un campo etiquetado y permitir uno o más diagnósticos mediante una acción clara para añadir otro y acciones accesibles para quitar filas.

La lista de diagnósticos es independiente de las tres opciones de clasificación prioritaria y no debe alterar sus selecciones.

Al deseleccionar «Otros», ocultar y limpiar sus valores. «Ninguna» debe ser excluyente: seleccionarla desmarca las demás y limpia «Otros»; seleccionar otra opción desmarca «Ninguna».

No implementar catálogos clínicos, autocompletado, códigos CIE, normalización o validación médica.

### FR-07 — Iconos semánticos

Conservar las tarjetas y funciones aprobadas de Inicio, sustituyendo sus cuadrados de color por iconos semánticos reales:

- Mis citas: calendario/cita.
- Pedir ayuda: ayuda/emergencia.
- Mi salud: salud/corazón.
- Mi cuidador: cuidador/persona.
- Mis pagos: pago/recibo/comprobante.

Los iconos deben compartir estilo, respetar color y contenedor, ser reconocibles sin depender del color y ser decorativos cuando el texto ya comunica la función. Reutilizar recursos existentes o code-native; no añadir dependencias.

### FR-08 — Elí flotante

Eliminar a Elí de la cuadrícula de funciones. En Inscripción e Inicio del Paciente debe usar exactamente el patrón flotante de `Eligeme-Inscripcion.dc.html`:

- ubicación inferior derecha;
- activador blanco tipo píldora con sombra;
- expresión **«PREGUNTA»** en el activador, distinta de la primera aparición **«TE ESCUCHA»**;
- nombre provisional desde branding;
- panel superpuesto expandible/cerrable;
- encabezado azul, avatar y ayuda contextual.

Elí debe hablar siempre de **tú**, con tono cercano, sencillo y fácil de comprender. Eliminar en toda la experiencia cualquier texto que diga **«Asistente virtual»**.

Usar como presentación aprobada, respetando exactamente texto y puntuación:

> ¡Hola! Soy Elí. No soy médica, pero puedo ayudarte a resolver las inquietudes que tengas. Cuéntame, ¿qué necesitas?

Las demás ayudas de Elí deben mantener ese tratamiento de «tú» y evitar formalismos como «usted». En Inicio, el contenido puede adaptarse solo a las funciones visibles, conservando estilo y límites. No afirmar diagnóstico, prescripción, decisión de emergencia, voz funcional o IA conectada.

La pantalla inicial debe mostrar primero a Elí con la intención visual `escucha`; el activador flotante debe mostrar la intención `pregunta`. Las demás apariciones deben seleccionar una pose coherente con su contexto entre las referencias aprobadas. Una card, avatar o panel no debe forzar la misma pose por conveniencia técnica.

### FR-08A — Branding visual reutilizable

El nombre provisional de Elí permanece en la configuración central de branding. El logo corazón-check, el mapeo de expresiones y los componentes que renderizan a Elí deben quedar reutilizables dentro del frontend y no hard-coded únicamente en Inscripción.

El encabezado de Inscripción debe mostrar el logo aprobado asociado a la marca y el subtítulo exacto **«Evidencia · Local · Inteligente»** con la jerarquía visual existente.

### FR-09 — Estado actual y requisito posterior offline/sync

Eliminar completamente de la interfaz el texto:

> Demostración visual local: no se crean cuentas, no se envía ni se guarda información y nada se verifica.

Esta eliminación no autoriza a afirmar una capacidad inexistente. TASK-002A sigue siendo frontend visual: las finalizaciones son locales y ningún texto debe afirmar guardado, vinculación, verificación o sincronización real. Las tarjetas de Inicio y acciones de Elí no simulan módulos productivos.

La capacidad offline con sincronización posterior queda registrada como **requisito funcional para implementación inmediata posterior**, fuera del alcance de implementación de TASK-002A. Cuando esa capacidad esté efectivamente implementada y probada de extremo a extremo, el producto deberá mostrar exactamente:

> Esta aplicación puede funcionar sin conexión a internet. Cuando vuelvas a tener conexión o actives tus datos, la información pendiente se actualizará automáticamente.

Hasta entonces, ese texto aprobado no debe renderizarse ni debe presentarse la capacidad como operativa. El catálogo local DIVIPOLA sí debe funcionar sin red, pero eso por sí solo no demuestra almacenamiento offline ni sincronización de formularios.

## Datos y privacidad

| Dato | Rama | Sensibilidad | Retención | Restricción |
| --- | --- | --- | --- | --- |
| Datos personales ficticios | Todas | PII potencial | Solo memoria | No enviar, persistir o registrar |
| Condición, diagnósticos y bitácora ficticios | Paciente | Salud potencial | Solo memoria | Sin interpretación clínica ni telemetría |
| Perfil/formación y vínculo ficticio | Cuidador | Personal/relacional | Solo memoria | Sin búsqueda o vínculo real |
| Credenciales profesionales ficticias | Visitador | Profesional | Solo memoria | Sin verificación real |
| Estado del flujo y Elí | Todas | Técnico | Solo memoria | Reinicio determinista |
| Catálogo DIVIPOLA | Todas | Público/oficial | Archivo local versionado | Conservar versión y procedencia; no contiene datos personales |

Usar solo datos ficticios en pruebas y capturas.

## Autorización, seguridad y auditabilidad

1. No implementar autenticación, autorización, permisos, organizaciones, tenancy o RLS.
2. La selección visual no concede acceso productivo.
3. No implementar auditoría de negocio sin operación persistente.
4. No enviar ni exponer datos en URL, consola, logs o telemetría.
5. No incluir secretos o variables nuevas.
6. No trasladar reglas clínicas, legales o institucionales del prototipo.
7. Elí orienta; no diagnostica, prescribe o decide emergencias.

## Accesibilidad

1. `main`, encabezados y jerarquía coherentes.
2. Cards de perfil como botones nativos con nombres accesibles.
3. `fieldset`/`legend` y labels visibles asociados.
4. Progreso «Paso X de 5» por rama y «Paso X de 8» en bitácora, con estado programático.
5. Foco visible, orden visual y objetivos táctiles de al menos 44 × 44 CSS px.
6. Errores con texto, `aria-invalid` y `aria-describedby`; foco al primer error.
7. Manejo predecible del foco al mostrar/quitar «Otros».
8. Elí con `aria-expanded`, `aria-controls`; Escape cierra y devuelve foco.
9. El panel no oculta foco, navegación o acción principal.
10. Soportar teclado, zoom 200 %, reflow 400 % y `prefers-reduced-motion`.
11. Departamento y Municipio deben ser selects con labels visibles; el estado deshabilitado de Municipio debe comunicarse programáticamente y no solo por color.
12. Las marcas `*` deben acompañarse de una explicación accesible de que significan «campo obligatorio».

## Responsive y fidelidad

- Comparar Inscripción a 680 × 900 CSS px.
- Verificar móvil a 390 × 844 y un viewport estrecho adicional.
- Conservar contenedor centrado, scroll vertical y márgenes aprobados.
- No crear una composición desktop alternativa.
- Evitar overflow, clipping y solapamientos.
- Elí permanece abajo a la derecha con margen seguro.

## Archivos permitidos para implementación

Exclusivamente archivos frontend necesarios dentro de `apps/web/**`.

Puede copiarse a `apps/web/public/eli/**` solo un asset exacto existente en el prototipo necesario para Elí, sin modificar el original. Si una expresión o el logo aprobado solo existe dentro de `prototype-claude/ref/personaje3.png`, se permite crear dentro de `apps/web/public/**` un recorte fiel y optimizado de esa referencia, sin redibujar, reinterpretar o sobrescribir la fuente. Debe conservarse la procedencia del recorte en documentación técnica dentro del código permitido o metadata del asset.

El catálogo local derivado de DIVIPOLA y sus metadatos de versión/procedencia deben residir dentro de `apps/web/**`. No se autoriza escribir o generar archivos fuera de ese límite durante la implementación.

## Archivos prohibidos

- `prototype-claude/**`
- `docs/**`
- `agents/**`
- `AGENTS.md`
- `CLAUDE.md`
- `reviews/**`
- `tasks/TASK-002.md`
- cualquier archivo fuera de `apps/web/**`

## Restricciones

1. No backend ni persistencia.
2. No ejecutar/importar `.dc.html` o `support.js`.
3. No conservar 16 pasos redundantes por conveniencia técnica.
4. Reutilizar componentes útiles cuando corresponda.
5. No añadir dependencias ni refactorizar áreas ajenas.
6. No presentar capacidades demostrativas como productivas.
7. No introducir listas territoriales parciales, manuscritas o sin procedencia verificable.

## Criterios de aceptación

1. `/` abre «¿Cómo se va a registrar?» con tres opciones y fidelidad a la referencia.
2. Cada opción abre solo su rama; el rol no vuelve a preguntarse.
3. Cambiar de rol limpia el estado anterior.
4. Paciente recorre exactamente cinco pasos; Diagnósticos está dentro de «Condición y necesidades», y Confirmación conduce al final demostrativo e Inicio sin exigir bitácora.
5. Cuidador recorre cinco pasos y su final local, sin pantallas exclusivas del paciente.
6. Visitador recorre cinco pasos y su final pendiente, sin pantallas de otras ramas.
7. Las tres clasificaciones prioritarias pueden seleccionarse simultáneamente y ninguna modifica las otras.
8. La bitácora no aparece dentro de inscripción; posteriormente, desde la experiencia del paciente, permite diligenciar ocho etapas, retroceder, revisar y confirmar sin lógica clínica.
9. Diagnósticos añade «Otros», múltiples textos y exclusividad de «Ninguna», sin convertirse en un sexto paso.
10. Las cinco tarjetas de Inicio muestran iconos semánticos, sin placeholders.
11. Elí no es tarjeta y usa la burbuja inferior derecha de Inscripción.
12. El nombre de Elí proviene del branding central.
13. No hay requests, persistencia, datos reales, dependencias o capacidades inventadas.
14. El flujo es operable por teclado y cumple foco, labels, errores y reflow.
15. El diff de implementación se limita a `apps/web/**`.
16. Todo grupo de ubicación usa Departamento, Municipio dependiente y «Nombre del corregimiento»; las opciones proceden de un catálogo local completo y versionado derivado de DANE DIVIPOLA.
17. Paciente y Cuidador no pueden avanzar mientras falte cualquier dato solicitado o campo condicional activo.
18. Elí habla de tú, usa la presentación aprobada y no muestra «Asistente virtual».
19. El texto de demostración prohibido no aparece; tampoco aparece la promesa offline/sync hasta que esa capacidad exista y esté probada.
20. La primera aparición de Elí usa «TE ESCUCHA» y el activador flotante usa una expresión visual distinta, «PREGUNTA».
21. Las apariciones de Elí usan un mapeo reutilizable por intención y no una única pose genérica.
22. El encabezado de inscripción incorpora el logo corazón-check aprobado, sin icono sustituto.
23. El subtítulo de inscripción dice exactamente «Evidencia · Local · Inteligente» y mantiene la jerarquía visual aprobada.

## Pruebas obligatorias

### Automatizadas

1. **lint**;
2. **typecheck**;
3. **tests relacionados**:
   - `/` muestra la entrada oficial;
   - selección, aislamiento y pasos de las tres ramas;
   - ausencia de segunda pregunta de rol;
   - limpieza al cambiar/reiniciar;
   - inscripción Paciente limitada a cinco pasos;
   - selección simultánea e independiente de las tres clasificaciones prioritarias;
   - Diagnósticos integrado en el paso 2, sin crear un sexto paso;
   - ausencia de bitácora dentro de inscripción;
   - acceso posterior a la bitácora de ocho etapas y conservación local;
   - «Otros», múltiples diagnósticos y «Ninguna»;
   - cinco iconos semánticos;
   - ausencia de Elí en la cuadrícula;
   - apertura/cierre y atributos de Elí;
   - branding provisional;
   - ausencia de «Asistente virtual» y presencia exacta del saludo aprobado;
   - obligatoriedad de todos los datos de Paciente y Cuidador;
   - obligatoriedad y limpieza de cada campo condicional activo;
   - carga del catálogo DIVIPOLA local, cobertura completa de departamentos y filtrado de municipios por departamento;
   - limpieza de Municipio al cambiar Departamento;
   - ausencia del mensaje de demostración eliminado y de la promesa offline futura;
   - primera aparición con estado `escucha` y activador flotante con estado `pregunta`;
   - poses distintas entre esas dos apariciones;
   - mapeo tipado/reutilizable de intenciones visuales de Elí;
   - renderizado del logo aprobado desde un asset/componente reutilizable;
   - presencia exacta de «Evidencia · Local · Inteligente» y ausencia de «Atención domiciliaria» en el subtítulo de inscripción;
4. **build web**.

### Localhost

1. Arrancar con el script existente.
2. Comparar la entrada a 680 × 900.
3. Recorrer por separado las tres ramas con datos ficticios.
4. Confirmar que no se repite rol ni se mezclan pasos.
5. En Paciente, seleccionar simultáneamente las tres clasificaciones y confirmar que son independientes.
6. Confirmar que Diagnósticos está en el paso 2 y que la inscripción termina en el paso 5 sin mostrar bitácora.
7. Desde la experiencia posterior del paciente, probar la bitácora completa hacia adelante, atrás y reinicio.
8. Probar «Otros», múltiples entradas y «Ninguna».
9. Comparar Inicio, iconos y Elí a 390 × 844.
10. Verificar teclado, foco, Escape, zoom y reflow.
11. Confirmar ausencia de requests y almacenamiento.
12. Probar ubicación en las tres ramas: Departamento, municipios correspondientes y escritura de corregimiento, sin conexión de red.
13. Verificar todos los estados obligatorios de Paciente/Cuidador y los condicionales.
14. Revisar todo el copy de Elí para confirmar tono de tú, saludo exacto y ausencia de «Asistente virtual».
15. Confirmar que no se muestra ninguna promesa de sincronización offline.
16. Comparar visualmente «TE ESCUCHA», «PREGUNTA» y el logo contra `prototype-claude/ref/personaje3.png`.
17. Confirmar que la primera aparición y la burbuja flotante no reutilizan la misma expresión.
18. Confirmar que Elí puede renderizarse como personaje/avatar sin imponer una burbuja genérica en cada contexto.
19. Verificar el nuevo subtítulo en el encabezado y su jerarquía visual.

## Evidencia para auditoría Codex

1. Resumen por requisito y lista exacta de archivos.
2. Mapeo de componentes a referencias del prototipo.
3. Resultados de lint, typecheck, tests y build.
4. Comando y resultado de localhost.
5. Capturas de entrada, cada rama, Diagnósticos, bitácora e Inicio con Elí cerrado/abierto.
6. Confirmación de ausencia de backend, persistencia, requests, datos reales, dependencias y cambios fuera de `apps/web/**`.
7. Riesgos, diferencias residuales y pruebas no ejecutadas.
8. Identificación de la versión/fecha de corte de DIVIPOLA, fuente de obtención y evidencia de cobertura del catálogo.
9. Evidencia de que el catálogo funciona sin solicitudes de red.
10. Confirmación de que la capacidad offline/sync general quedó fuera de TASK-002A y no se presentó como implementada.
11. Mapeo de cada estado semántico de Elí utilizado a su asset y referencia visual aprobada.
12. Evidencia comparativa de «TE ESCUCHA», «PREGUNTA», logo y subtítulo.
13. Procedencia de cualquier recorte derivado de `prototype-claude/ref/personaje3.png`.

## Riesgos y supuestos

- La referencia es demostrativa y no prueba guardado, verificación o sincronización real.
- La bitácora contiene ejemplos clínicos no validados; se reutiliza la captura, nunca sus conclusiones.
- Elí debe verificarse para no ocultar controles en móvil.
- La reutilización de First Run está subordinada al flujo oficial y no justifica duplicación.
- El catálogo DIVIPOLA puede cambiar; su versión y procedencia deben quedar explícitas y su actualización debe ser controlada.
- El funcionamiento local del catálogo no equivale a persistencia offline ni sincronización de formularios.
- Algunas expresiones y el logo pueden existir solo dentro de la lámina `personaje3.png`; cualquier recorte debe ser exacto, trazable y revisado visualmente para evitar degradación o reinterpretación.

## Bloqueos y Claude Design

**No existe bloqueo para entregar TASK-002A a Claude Code.** La versión concreta de DIVIPOLA debe quedar identificada por Claude Code al obtener el catálogo oficial y será evidencia obligatoria de implementación, no una decisión de producto pendiente.

La posible necesidad de extraer fielmente «PREGUNTA» o el logo desde la lámina aprobada no constituye bloqueo ni requiere Claude Design: la referencia visual ya existe. Si durante la implementación se demuestra que la lámina disponible no permite obtener un asset con calidad suficiente, Claude Code debe detener solo ese elemento y reportarlo a Codex/Product Owner, continuando con las demás correcciones.

La capacidad general offline/sync es trabajo inmediato posterior y permanece fuera de TASK-002A hasta contar con arquitectura, persistencia, resolución de conflictos, seguridad, pruebas y aprobación específicas. Esto no bloquea las correcciones frontend aquí definidas.

**No requiere `REQUIERE CLAUDE DESIGN`.** La pantalla oficial, las tres ramas, la bitácora, Diagnósticos, los iconos y Elí flotante ya tienen referencias suficientes en `prototype-claude/`.

## Git y entrega

- No hacer commit, push, merge, rebase, pull request ni despliegue.
- La implementación posterior debe pasar por auditoría Codex y aceptación del Product Owner.
