# MERDN Task Specification

## 1. Identificación

- **Task ID:** TASK-ALCALDIA-A-01
- **Título:** Alcaldía — shell, navegación e Inicio
- **Estado de la especificación:** lista para implementación por Claude Code
- **Responsable de implementación:** Claude Code
- **Responsable de auditoría posterior:** Codex
- **Autoridad de producto y aceptación final:** Product Owner
- **Rama inspeccionada al especificar:** `develop`

## 2. Objetivo y valor

Implementar la primera superficie funcional y demostrativa de la experiencia **Alcaldía** de Elígeme: shell institucional persistente, navegación completa, encabezado superior, selector temporal, perfil agregado y pantalla Inicio completa.

El resultado debe permitir que el Product Owner revise en navegador la experiencia municipal aprobada, con datos ficticios agregados, sin crear backend, persistencia, integraciones ni acceso a información clínica individual.

## 3. Contexto autoritativo inspeccionado

Claude Code debe leer antes de implementar: `AGENTS.md`, `CLAUDE.md`, esta Task y los documentos aplicables de `docs/`, especialmente `PRODUCT.md`, `MODULES.md`, `ROLES.md`, `DATA.md`, `SECURITY.md` y `ARCHITECTURE.md`.

### 3.1 Referencia visual principal y vinculante

- `prototype-claude/Eligeme-Alcaldia.dc.html`
  - shell y sidebar: líneas 20–83;
  - topbar, selector temporal y perfil: líneas 85–101;
  - pantalla Inicio: líneas 103–169;
  - estado inicial y periodos: líneas 719 y 757–761;
  - KPIs, cadena, pendientes, accesos y actividades: líneas 763–802.

Este archivo contiene exactamente el diseño y contenido aprobados para A-01. Debe inspeccionarse en modo de solo lectura. Se reconstruirá con React/TypeScript y CSS mantenible; está prohibido copiar o usar como runtime el `.dc.html`, `support.js`, su estado inline o componentes de Claude Design.

### 3.2 Referencia visual secundaria

- `prototype-claude/ref/interfaz-alcaldia.png`

La imagen confirma la identidad general de una experiencia institucional de Alcaldía y su relación visual con Hospital, pero muestra una composición anterior distinta. No sustituye ni contradice para A-01 el diseño más reciente y coincidente con la decisión expresa del Product Owner en `Eligeme-Alcaldia.dc.html`. Ante una diferencia, prevalecen esta Task y el `.dc.html` citado.

### 3.3 Pantalla identificada como Inicio

Es el bloque condicionado por `vInicio`, visible como estado inicial `view: 'inicio'`, que contiene en este orden:

1. `ASÍ ESTAMOS CUIDANDO NUESTRA POBLACIÓN` y cinco KPIs;
2. `De la persona a la evidencia` y la cadena de seis elementos;
3. aclaración de deduplicación;
4. `Alertas y pendientes de gestión` y aclaración administrativa;
5. `Accesos rápidos`;
6. `Actividades recientes`.

### 3.4 Ruta aprobada

La experiencia se expondrá en la ruta estable **`/municipality`**, conforme a `docs/ARCHITECTURE.md`. El texto visible continuará íntegramente en español y usará “Alcaldía”; el slug técnico no debe mostrarse al usuario.

## 4. Agentes cuyos contratos gobiernan esta Task

Se aplicaron los archivos reales:

1. `agents/01-MERDN-ORCHESTRATOR.md`: alcance, gate, handoff y protección del prototipo.
2. `agents/02-UX-UI-FIDELITY-GUARDIAN.md`: referencia principal, fidelidad, navegación, responsive, accesibilidad y evidencia visual.
3. `agents/03-BACKEND-DATA-ARCHITECT.md`: frontera frontend-only, datos agregados y separación de procedencias.
4. `agents/04-SECURITY-ACCESS-GUARDIAN.md`: minimización, ausencia de clínica municipal y no confundir UI con autorización.
5. `agents/05-INSTITUTIONAL-REGULATORY-AGENT.md`: significado de FURAG/MIPG, ADRES y Sentencia T-319 de 2025.
6. `agents/06-INTEGRATIONS-AUTOMATION-AGENT.md`: ninguna integración activa o simulada en A-01.
7. `agents/07-QA-ACCEPTANCE-AGENT.md`: trazabilidad de requisitos, pruebas negativas, accesibilidad y regresión.
8. `agents/09-FRONTEND-APPLICATION-ARCHITECT.md`: App Router, límites de componentes, estado local, responsive y reutilización segura.

## 5. Alcance

### 5.1 Dentro de alcance

1. Ruta `/municipality`.
2. Shell principal de Alcaldía.
3. Sidebar con los trece elementos aprobados, en orden exacto.
4. Encabezado superior con mensaje de privacidad.
5. Selector local de periodo con cinco opciones.
6. Perfil institucional agregado visible.
7. Pantalla Inicio completa con los valores demostrativos exactos del prototipo.
8. Navegación local hacia estados “Próximamente” para módulos posteriores.
9. Accesos rápidos conectados a esos mismos destinos locales.
10. Responsive de escritorio, tablet y móvil basado en reflow y en los patrones existentes de Hospital.
11. Accesibilidad, pruebas y evidencia visual.
12. No regresión de Hospital y demás experiencias existentes.

### 5.2 Fuera de alcance

- contenido interno real o completo de los otros doce módulos;
- rutas URL independientes por módulo;
- deep links, query parameters o persistencia del módulo/periodo seleccionado;
- autenticación, autorización o modelo definitivo de permisos;
- contexto de tenant o institución resuelto por servidor;
- backend, API, Prisma, PostgreSQL, migraciones o auditoría persistente;
- carga o descarga de evidencias;
- registro de programas, beneficiarios, facturas o actividades;
- generación o exportación real de informes;
- cálculos productivos de KPIs, deduplicación, cobertura, ejecución o indicadores;
- datos reales o nominales;
- HCE, diagnósticos, alertas clínicas o recomendaciones clínicas;
- integraciones con Hospital, ADRES, Función Pública, FURAG/MIPG, SENA u otros proveedores;
- cambios visuales al prototipo;
- refactors generales de Hospital o del sistema UI.

## 6. Usuarios, institución, tenant y permisos

- **Experiencia:** Alcaldía / gobierno municipal.
- **Contexto demostrativo visible:** `Alcaldía de Soacha` y `Secretaría de Salud`.
- **Perfil visible:** `Perfil de consulta agregada`.
- **Datos:** agregados, anonimizados y ficticios.
- **Tenant e institución:** la configuración local representa un contexto, pero no implementa ni suplanta el tenant o la afiliación verificados en servidor.
- **Permisos:** fuera de alcance productivo. Ver una entrada o botón no concede permiso. La futura autorización será server-side, contextual y de denegación por defecto.
- **Acceso nominal municipal:** prohibido en esta Task.

## 7. Arquitectura frontend y reutilización

### 7.1 Fronteras

Crear una feature aislada bajo `apps/web/src/features/municipality/**`. La página App Router debe limitarse a metadata y montaje del shell. La configuración demo, los tipos, la navegación, el estado local, los componentes y los estilos deben permanecer separados por responsabilidad sin fragmentación innecesaria.

Solo el selector temporal y la navegación local requieren estado cliente. Mantener el Client Component en el límite más pequeño razonable; no convertir toda la página en estado global ni introducir context, store o persistencia.

### 7.2 Patrones de Hospital que deben reutilizarse

Reutilización obligatoria de conceptos y comportamiento ya probados, sin importar componentes con semántica `Hospital*` ni modificar Hospital:

- composición `shell → sidebar + main → topbar + main content` de `HospitalShell`;
- configuración tipada y centralizada semejante a `hospitalConfig.ts`;
- navegación local pura y testeable semejante a `hospitalViews.ts`;
- sidebar y nav items accesibles semejantes a `HospitalSidebar`;
- perfil institucional semejante a `HospitalTopbar`;
- iconos SVG locales, decorativos y con `currentColor`, siguiendo `HospitalIcon`;
- CSS Module y tokens existentes;
- reflow responsive ya validado: debajo del breakpoint institucional, sidebar apilado y navegación desplazable/reorganizada sin crear un drawer nuevo;
- utilidades de prueba solo si son verdaderamente genéricas y pueden reutilizarse sin acoplamiento entre experiencias.

No importar `HospitalShell`, `HospitalSidebar`, `HospitalTopbar`, `HospitalIcon` ni configuración Hospital directamente en Alcaldía. Sus nombres, contratos y semántica pertenecen a Hospital. Tampoco extraerlos o modificarlos en A-01: una futura generalización compartida requiere una Task separada si llega a ser necesaria.

Sí reutilizar los componentes compartidos existentes cuando coincidan exactamente, en particular `branding` para el nombre público `ELÍGEME`. `BrandLogo` solo se usará si el `.dc.html` lo exige; la referencia principal muestra la marca como texto, por lo que no se añadirá un símbolo no presente.

### 7.3 Dependencias

Usar únicamente Next.js, React, TypeScript, CSS Modules y utilidades ya instaladas. No agregar paquetes, no cambiar manifests ni lockfiles y no realizar llamadas de red.

## 8. Requisitos visuales vinculantes

### 8.1 Identidad general

- Tipografía Nunito con pesos equivalentes a `400`, `600`, `700`, `800` y `900`, usando el mecanismo ya existente y fallback seguro.
- Fondo general `#F7F9FA`; texto principal `#0F2E3D`.
- Paleta principal: azul `#075985`, teal `#0A6873`, turquesa `#32B4A8`, verde `#157F3B`, amarillo/marrón `#96450A`, rojo `#B91C1C` y superficies claras observadas en el prototipo.
- Tarjetas blancas, radios, sombras, bordes, espaciado, densidad y jerarquía deben seguir el `.dc.html` sin reinterpretación.
- La única marca pública visible es `ELÍGEME`/`Elígeme`. La cadena `MERDN` no puede aparecer en UI, metadata visible, títulos, ayudas, estados próximos ni mensajes accesibles.

### 8.2 Sidebar

Ancho de referencia de escritorio `244px`, fondo `#075985`, padding `20px 16px`. Identidad superior:

- `ELÍGEME`;
- `Alcaldía de Soacha`;
- `Gestión territorial y evidencia`.

Menú exacto, sin omisiones ni reordenamiento:

1. Inicio
2. Población beneficiaria
3. Territorio
4. Programas
5. Presupuesto y ejecución
6. Evidencias
7. FURAG y MIPG
8. ADRES
9. Derecho al cuidado
10. Brechas
11. Cuidadores y formación
12. Indicadores y resultados
13. Reportes ejecutivos

Cada item tendrá icono SVG con geometría tomada como referencia del `.dc.html`, texto, estado activo y foco visible. No usar emojis, Unicode ni una librería de iconos. El estado actual se comunica con estilo y `aria-current`, no solo con color.

### 8.3 Topbar

Fondo blanco, borde inferior `#E4EBEE`, padding de referencia `14px 26px`, distribución flexible y este contenido:

- encabezado: `PANEL DE GESTIÓN TERRITORIAL, RESULTADOS Y EVIDENCIA`;
- aclaración: `Datos agregados y anonimizados · sin acceso a historias clínicas individuales`;
- selector temporal con `Este mes`, `Trimestre`, `Semestre`, `Año`, `Personalizado`;
- perfil en cápsula: avatar `SS`, `Secretaría de Salud`, `Perfil de consulta agregada`.

No añadir buscador, campana, usuario nominal, menú de cuenta ni controles que no aparecen en la referencia principal.

### 8.4 Inicio — bloque principal

Tarjeta azul de referencia con encabezado `ASÍ ESTAMOS CUIDANDO NUESTRA POBLACIÓN` y cinco KPIs, en este orden y con el contenido demo exacto:

| Valor | KPI | Aclaración |
| --- | --- | --- |
| `3.050` | Personas beneficiadas | Beneficiarios únicos, sin doble conteo |
| `37,5 %` | Cobertura de la población objetivo | De 8.142 personas, unión deduplicada de las tres poblaciones |
| `1.284` | Visitas domiciliarias realizadas | En lo corrido del año |
| `92,8 %` | Actividades con evidencia | 232 de 250 con soporte cargado |
| `55 %` | Presupuesto ejecutado | $870 M de $1.580 M asignados |

Debe existir una etiqueta visible y accesible cercana que identifique la pantalla completa como **datos demostrativos/ficticios**, sin alterar los textos vinculantes anteriores. No presentar ningún valor como oficial o productivo.

### 8.5 De la persona a la evidencia

Título exacto `De la persona a la evidencia`. Cadena, en orden:

| Etapa | Valor demo | Texto demo |
| --- | --- | --- |
| PERSONAS | `3.050` | Identificadas y vinculadas |
| ATENCIÓN | `1.670` | Visitas y consultas realizadas |
| DINERO | `$870 M` | Ejecutado en el periodo |
| EVIDENCIA | `232` | Actividades con soporte |
| RESULTADO | `94 %` | Alertas atendidas a tiempo |
| PENDIENTE | `18` | Soportes por cargar |

Aclaración exacta: `Los totales deduplican por persona. Alguien puede aparecer en tres poblaciones y sigue siendo un beneficiario único.`

La cadena es una representación visual demo; A-01 no implementa una regla, consulta o algoritmo de deduplicación.

### 8.6 Alertas y pendientes de gestión

Mostrar los seis ejemplos exactos del prototipo, con texto y nivel además del color:

1. `3 facturas pendientes de aprobación` — `Alta`.
2. `5 evidencias pendientes de carga` — `Alta`.
3. `Programa de discapacidad con ejecución por debajo de la meta` — `Seguimiento`.
4. `27 personas identificadas sin seguimiento reciente` — `Seguimiento`.
5. `12 cuidadores requieren capacitación` — `Seguimiento`.
6. `4 pendientes operativos sin cierre` — `Seguimiento`.

Aclaración exacta: `Son pendientes administrativos. Las alertas clínicas individuales se gestionan en el hospital.`

No representar nombres, documentos, diagnósticos, mediciones, medicamentos, direcciones, HCE ni alertas clínicas individuales. El texto “personas sin seguimiento” es un conteo institucional demo y no habilita drill-down nominal.

### 8.7 Accesos rápidos

Mostrar y hacer navegables localmente:

- Ver beneficiarios → Población beneficiaria;
- Ver programas → Programas;
- Registrar programa → Programas;
- Ver presupuesto → Presupuesto y ejecución;
- Subir evidencia → Evidencias;
- Ver FURAG → FURAG y MIPG;
- Ver ADRES → ADRES;
- Generar informe → Reportes ejecutivos.

Cada acción cambia dentro del shell al mismo estado “Próximamente” que el item correspondiente y actualiza el item activo. No abre formulario, no muta datos y no afirma que la operación se realizó.

### 8.8 Actividades recientes

Mostrar la actividad institucional agregada exacta del prototipo:

1. `Nuevo beneficiario registrado en Cazucá` — `Hoy 8:20 a. m. · fuente ELÍGEME`.
2. `Evidencia cargada para la factura FAC-2026-140` — `Ayer 4:10 p. m. · Secretaría de Salud`.
3. `Programa de cuidadores actualizó su meta anual` — `15 ago 2026 · Secretaría de Salud`.
4. `Informe de ejecución presupuestal generado` — `14 ago 2026 · Hacienda`.
5. `Resultado oficial FURAG 2025 importado` — `14 jul 2026 · Función Pública`.
6. `38 certificados de cuidadores cargados` — `10 ago 2026 · fuente hospital`.

Todos son fixtures ficticios de diseño. No enlazar a registros, no mostrar actor nominal y no afirmar que existe una importación o integración activa.

## 9. Requisitos funcionales

### FR-01 — Carga inicial

`/municipality` monta el shell, activa `Inicio`, selecciona `Este mes` y muestra una sola pantalla Inicio completa.

### FR-02 — Selector temporal local

1. Los cinco periodos son controles `type="button"` agrupados y con nombre accesible.
2. Solo uno puede estar seleccionado.
3. Al seleccionar otro, cambia el estado visual y semántico (`aria-pressed` o patrón equivalente).
4. En A-01 el periodo no recalcula valores: debe mostrarse una aclaración accesible y discreta de que los datos permanecen demostrativos, o anunciar el cambio sin afirmar que se consultó una fuente.
5. `Personalizado` no abre calendario, formulario ni modal. Solo puede quedar seleccionado.
6. Estado efímero: no URL, localStorage, cookie, sesión ni red.

### FR-03 — Navegación local preparada

1. Todos los items del sidebar son botones funcionales de navegación local.
2. `Inicio` monta Inicio; cualquier otro item monta un único estado neutro “Próximamente” dentro de `<main>`.
3. El estado “Próximamente” conserva shell, topbar, selector y perfil; muestra únicamente el nombre exacto del módulo y una frase clara como `Este módulo se implementará en una tarea posterior.`
4. No mostrar adelantos, formularios, tablas, KPIs o datos del contenido interno de esos módulos.
5. Solo un item tiene `aria-current` a la vez.
6. Volver a Inicio restaura Inicio sin recargar.
7. No usar `href="#"`, no crear doce nuevas rutas, no cambiar la URL y no dejar el contenido vacío.

### FR-04 — Configuración demo centralizada

Centralizar en configuración tipada:

- identidad municipal;
- perfil agregado;
- periodos;
- navegación e iconos;
- KPIs;
- cadena de evidencia;
- pendientes;
- accesos rápidos;
- actividades recientes;
- etiqueta explícita de fixture/demo.

Los componentes reciben datos por propiedades. No crear modelo definitivo, DTO, API client, fixtures compartidos con Hospital, contexto global ni configuración por entorno.

### FR-05 — Una sola experiencia modular

Alcaldía vive en la aplicación Next.js existente y no crea otra app, layout raíz, design system o arquitectura duplicada. No mezclar su estado, copy ni configuración con Hospital.

## 10. Datos, propiedad, sensibilidad y procedencia

| Categoría | Ejemplos en A-01 | Procedencia A-01 | Uso futuro | Restricción |
| --- | --- | --- | --- | --- |
| A. Fixture/demo | Todos los valores, fechas, nombres institucionales, facturas y conteos visibles | Prototipo aprobado; ficticio y local | Ninguno por sí mismo | Etiquetar como demostrativo; sin persistencia ni oficialidad |
| B. Futuro dato agregado Elígeme/Hospital | Beneficiarios únicos, visitas, seguimiento, cobertura, evidencia y resultados | Futuras capacidades internas autorizadas, con fuente, periodo, agregación y linaje | Sustituirá fixtures mediante contrato aprobado | No implementar ni simular conexión; sin datos clínicos individuales |
| C. Fuente externa oficial | Resultado oficial FURAG, información ADRES, certificación/formación cuando aplique | Fuente externa autorizada, importada/consultada con procedencia | Se mostrará solo con fuente, versión, periodo, fecha y modalidad | No integrar; la actividad visible es fixture y no prueba conexión |

- Propietario/custodio productivo: por definir según dominio, tenant, institución, programa y fuente; A-01 no decide propiedad real.
- Retención: ninguna; todo estado desaparece al recargar.
- Telemetría/logs: no registrar interacción, contenido o identificadores.
- No usar datos reales de pacientes, cuidadores, profesionales, funcionarios, proveedores o instituciones.

## 11. Privacidad y seguridad

1. Alcaldía opera por defecto con información agregada y anonimizada.
2. Prohibido mostrar o inferir HCE individual, diagnóstico nominativo, medicamentos, mediciones clínicas, notas clínicas, alertas clínicas individuales o direcciones exactas.
3. Prohibido mostrar salarios u honorarios individuales.
4. Prohibido habilitar drill-down nominal, búsqueda de personas, exportación o enlaces a registros.
5. La UI no implementa ni representa autorización real. La futura autorización debe ocurrir en API/datos y aplicar tenant, municipio, institución, programa, finalidad, rol, relación y vigencia.
6. No secretos, credenciales, tokens, cookies, localStorage, llamadas HTTP, analytics o logs de datos.
7. Ningún texto de error debe revelar IDs internos, existencia de registros o información sensible.
8. Los conteos pequeños son demo; A-01 no fija umbrales de privacidad productivos.
9. No se genera auditoría persistente porque no existen operaciones ni persistencia. La futura navegación no reemplaza eventos de auditoría requeridos para acciones sensibles.

## 12. Reglas institucionales y regulatorias

1. **FURAG/MIPG:** Elígeme no calcula FURAG, no asigna puntuaciones oficiales y no declara cumplimiento. Solo organiza evidencia. Un resultado se llama oficial únicamente cuando proviene de la autoridad competente y conserva procedencia.
2. **ADRES:** representar a ADRES como administrador/fuente autorizada de información y recursos, no como regulador, evaluador ni autoridad de cumplimiento.
3. **Sentencia:** cuando corresponda en futuras tareas, usar exactamente `Sentencia T-319 de 2025`. Está prohibido `Ley 319`. A-01 solo conserva la entrada `Derecho al cuidado` y no añade interpretación jurídica.
4. **Evidencia:** un archivo o actividad no prueba por sí solo cumplimiento, ejecución, aprobación u oficialidad.
5. **Finanzas:** Elígeme no se presenta como sistema contable gubernamental; los importes son fixtures.
6. **Marca:** ninguna interfaz visible o texto accesible puede exponer `MERDN`; usar Elígeme.
7. **Integraciones:** ningún fixture, timestamp o etiqueta de fuente puede presentarse como conexión activa.

El estado “Próximamente” de `FURAG y MIPG` debe añadir: `Elígeme organizará evidencia; no calcula el resultado FURAG ni declara cumplimiento.` El de `ADRES` debe añadir: `La información futura conservará su fuente oficial; Elígeme no actúa como regulador.` Estas frases no implementan contenido interno del módulo.

## 13. Responsive

### Escritorio — referencia primaria

- Validar `1340 × 900`, viewport declarado por el `.dc.html`.
- Sidebar fijo visualmente a la izquierda con `244px`; topbar y contenido a la derecha.
- Cinco KPIs distribuidos sin pérdida de legibilidad.
- Cadena con seis tarjetas flexibles.
- Pendientes a la izquierda; accesos y actividades en columna derecha.

### Tablet

- Validar al menos `768 × 1024`.
- Aplicar el patrón institucional existente de Hospital: shell apilado cuando el ancho no admita la composición lateral; identidad y navegación permanecen visibles.
- El menú puede reflow o desplazarse horizontalmente dentro de su propia región. No crear drawer, hamburguesa ni interacción nueva.
- KPIs, cadena y bloques inferiores reflow sin overflow de página.

### Móvil

- Validar al menos `375 × 812`.
- Sidebar/identidad y navegación se apilan antes del contenido; navegación accesible por scroll controlado si no cabe.
- Topbar se apila conservando encabezado, aclaración, selector y perfil.
- KPIs y cadena pasan a una columna o a la mínima composición que mantenga cada valor, etiqueta y aclaración legibles.
- Accesos rápidos pasan a una columna cuando dos columnas no sean legibles.
- No ocultar texto, KPIs, etapas, pendientes, accesos o actividades.
- No debe existir overflow horizontal de la página, solapamiento, corte de foco ni targets inaccesibles.

### Reflow y zoom

Validar además zoom/reflow equivalente a `200 %`. La fidelidad se evalúa por preservación de jerarquía, orden, identidad, contenido y estilo; no por mantener una grilla de escritorio ilegible.

## 14. Accesibilidad

1. Una sola región `<main>` y encabezado principal `<h1>` para Inicio o el módulo próximo.
2. `<aside>`, `<nav>` y `<header>` con nombres accesibles apropiados.
3. Jerarquía de encabezados coherente para todas las secciones.
4. Botones con `type="button"`, nombre accesible, foco visible y target táctil suficiente.
5. SVG decorativos con `aria-hidden="true"` y `focusable="false"`.
6. Estado activo y prioridad no dependen solo del color; conservar texto/nivel y semántica.
7. Selector temporal con estado seleccionado anunciado.
8. Orden de foco: navegación, selector, accesos y contenido interactivo de forma predecible.
9. El cambio de vista local mueve el foco al encabezado principal o anuncia el nuevo módulo sin pérdida de contexto.
10. Texto legible, contraste suficiente y reflow sin pérdida a `200 %`.
11. La etiqueta demo y las aclaraciones de privacidad/institucionales deben ser perceptibles, no solo metadata o `title`.

## 15. Archivos permitidos

Claude Code puede crear o modificar únicamente:

- `apps/web/src/app/municipality/page.tsx`;
- `apps/web/src/features/municipality/**` para componentes, configuración, navegación, estilos y pruebas de A-01.

Puede modificar `apps/web/src/config/branding.ts` **solo** si es indispensable para consumir el nombre público ya centralizado sin cambiar ningún valor o consumidor. La opción preferida es importarlo sin modificarlo.

Si considera imprescindible tocar otro archivo, debe detenerse antes del cambio y reportar el motivo; no ampliar el alcance por cuenta propia.

### Archivos previstos

Los nombres pueden ajustarse localmente sin cambiar responsabilidades:

- `apps/web/src/app/municipality/page.tsx`;
- `apps/web/src/features/municipality/MunicipalityShell.tsx`;
- `apps/web/src/features/municipality/MunicipalitySidebar.tsx`;
- `apps/web/src/features/municipality/MunicipalityTopbar.tsx`;
- `apps/web/src/features/municipality/MunicipalityHome.tsx`;
- `apps/web/src/features/municipality/MunicipalityComingSoon.tsx`;
- `apps/web/src/features/municipality/MunicipalityIcon.tsx`;
- `apps/web/src/features/municipality/municipalityConfig.ts`;
- `apps/web/src/features/municipality/municipalityViews.ts`;
- `apps/web/src/features/municipality/municipality.module.css`;
- pruebas `*.test.ts`/`*.test.tsx` dentro de la misma feature.

No es obligatorio crear un archivo por responsabilidad si la unión sigue siendo enfocada y testeable.

## 16. Archivos prohibidos

- `prototype-claude/**`, incluidos `.dc.html`, `support.js`, assets y referencias;
- `apps/web/src/features/hospital/**` y `apps/web/src/app/hospital/**`;
- otras experiencias (`paciente`, `inscripcion`, etc.);
- `apps/api/**`, `prisma/**`, `packages/**`, infraestructura y herramientas;
- `docs/**`, `agents/**`, `reviews/**` y cualquier otra Task;
- `AGENTS.md`, `CLAUDE.md`, `README.md`;
- `package.json`, manifests y lockfiles;
- secretos y archivos `.env*`.

No eliminar ni renombrar archivos. No commit, push, merge, rebase, pull request, release ni despliegue.

## 17. Criterios de aceptación

- **AC-01 Ruta:** `/municipality` renderiza sin reemplazar `/`, `/hospital` u otra experiencia.
- **AC-02 Shell:** existen sidebar, topbar y main con la composición, identidad y paleta del `.dc.html`.
- **AC-03 Sidebar:** aparecen los trece items, en orden exacto, con iconos, foco y un solo activo.
- **AC-04 Inicio:** la carga inicial activa Inicio y muestra exactamente las seis secciones en el orden aprobado.
- **AC-05 Selector:** aparecen las cinco opciones; `Este mes` inicia seleccionado y el cambio es local, exclusivo y accesible.
- **AC-06 Perfil:** aparecen `SS`, `Secretaría de Salud` y `Perfil de consulta agregada`.
- **AC-07 Privacidad visible:** aparece exactamente `Datos agregados y anonimizados · sin acceso a historias clínicas individuales`.
- **AC-08 KPIs:** aparecen los cinco KPIs, valores y aclaraciones exactos, identificados como demo.
- **AC-09 Cadena:** aparecen PERSONAS, ATENCIÓN, DINERO, EVIDENCIA, RESULTADO y PENDIENTE, en orden, con valores y aclaración de deduplicación.
- **AC-10 Pendientes:** aparecen los seis pendientes administrativos y la aclaración de que las alertas clínicas individuales se gestionan en Hospital.
- **AC-11 Accesos:** aparecen los ocho accesos y cada uno navega al destino local especificado sin ejecutar operaciones.
- **AC-12 Actividad:** aparecen las seis actividades agregadas exactas, sin información clínica individual ni actor nominal.
- **AC-13 Próximamente:** cada módulo no implementado monta el estado neutro, mantiene shell, actualiza el activo y no presenta contenido interno inventado.
- **AC-14 FURAG:** la UI no afirma que Elígeme calcule FURAG o determine cumplimiento; el estado próximo contiene la aclaración exigida.
- **AC-15 ADRES:** la UI no presenta ADRES como regulador; el estado próximo contiene la aclaración exigida.
- **AC-16 Terminología:** no aparece `Ley 319`; si aparece la sentencia, solo puede ser `Sentencia T-319 de 2025`.
- **AC-17 Ausencia de MERDN:** búsqueda sensible a mayúsculas/minúsculas sobre el HTML visible/accesible de `/municipality` no encuentra `MERDN`.
- **AC-18 Datos negativos:** no aparecen nombres de personas, documentos, direcciones exactas, diagnósticos, medicamentos, mediciones, HCE, salarios u honorarios individuales.
- **AC-19 Sin backend:** no hay fetch, red, API, persistencia, cookies, localStorage, integraciones ni auditoría simulada.
- **AC-20 Responsive:** `1340×900`, `768×1024` y `375×812` conservan contenido, orden, legibilidad y acceso sin overflow horizontal de página ni solapamientos.
- **AC-21 Accesibilidad:** regiones, headings, botones, foco, estado temporal, anuncio/foco de vista, iconos y contraste cumplen la sección 14.
- **AC-22 Arquitectura:** configuración demo centralizada; navegación pura/testeable; componentes enfocados; sin dependencia de módulos Hospital.
- **AC-23 No regresión Hospital:** `/hospital` conserva su render, navegación y pruebas existentes.
- **AC-24 Integridad:** ningún archivo prohibido cambia y no se agregan dependencias.
- **AC-25 Calidad:** lint, typecheck, build y pruebas relevantes pasan sin errores introducidos.

## 18. Pruebas requeridas

| ID | Tipo | Verificación |
| --- | --- | --- |
| T-01 | Ruta/render | `/municipality` monta el shell y la pantalla Inicio. |
| T-02 | Contenido | Identidad, topbar, perfil y copy de privacidad exactos. |
| T-03 | Sidebar | Trece etiquetas en orden, iconos SVG, Inicio activo y un solo `aria-current`. |
| T-04 | Navegación | Cada item cambia a su estado local; Inicio restaura Inicio; URL no cambia. |
| T-05 | Selector | Cinco periodos, exclusividad, estado inicial y `Personalizado` sin modal. |
| T-06 | KPIs | Cinco valores, títulos, subtítulos y etiqueta demo exactos. |
| T-07 | Cadena | Seis etapas en orden y aclaración de deduplicación. |
| T-08 | Pendientes | Seis pendientes y niveles; aclaración administrativa exacta. |
| T-09 | Accesos | Ocho acciones y mapeos; ninguna mutación/formulario. |
| T-10 | Actividad | Seis actividades agregadas exactas y fuentes mostradas como fixture. |
| T-11 | Privacidad negativa | Ausencia de clínica individual, HCE, diagnósticos, salarios/honorarios y datos nominales. |
| T-12 | Marca negativa | Ausencia visible/accesible de `MERDN` y uso de Elígeme. |
| T-13 | Institucional | FURAG y ADRES descritos con los límites exactos; ausencia de `Ley 319`. |
| T-14 | Sin integración | HTML/código de la feature sin fetch, URL remota, storage, cookies o scripts. |
| T-15 | Configuración | Otra institución/perfil ficticios se renderizan mediante props/config sin alterar estructura. |
| T-16 | Accesibilidad | Regiones, h1 único, jerarquía, botones, SVG decorativos, foco y estado seleccionado. |
| T-17 | Teclado | Recorrido completo; navegación, selector y accesos operables; foco/announcement al cambiar vista. |
| T-18 | Responsive visual | Capturas y revisión en `1340×900`, `768×1024`, `375×812` y reflow/zoom 200 %. |
| T-19 | Regresión Hospital | Suite Hospital existente y revisión de `/hospital`. |
| T-20 | Integridad | Diff limitado a archivos permitidos; prototipo intacto; sin dependencias nuevas. |

Claude Code debe ejecutar y reportar como mínimo:

1. `npm.cmd run lint`;
2. `npm.cmd run typecheck`;
3. `npm.cmd run test --workspace @merdn/web`;
4. `npm.cmd run build:web`;
5. `npm.cmd run dev:web` y URL local exacta;
6. revisión visual en los viewports de T-18;
7. prueba manual de teclado y foco;
8. `git status --short` y diff de los archivos autorizados.

Si la infraestructura actual no permite automatizar clics o accesibilidad DOM sin agregar dependencias, no se agrega ninguna: se prueban funciones puras y markup estático, y la activación real, foco, responsive y accesibilidad se verifican manualmente en navegador con evidencia explícita. Una prueba no ejecutada debe declararse como tal, nunca como aprobada.

## 19. Condiciones de parada

Claude Code debe detener solo la parte afectada y devolver evidencia a Codex/Product Owner si:

1. necesita modificar `prototype-claude/**` o usar su runtime/código en producción;
2. necesita tocar Hospital u otro archivo prohibido;
3. necesita agregar una dependencia o cambiar configuración global material;
4. `/municipality` entra en conflicto con una ruta existente o requiere cambiar la arquitectura aprobada;
5. la fidelidad exige inventar un componente, estado o interacción material no cubierto por el `.dc.html` y esta Task;
6. no puede lograr el responsive mediante el reflow autorizado sin inventar drawer/hamburguesa u otra navegación;
7. detecta que un fixture contiene datos reales o sensibles;
8. considera necesario backend, API, persistencia, autenticación, autorización, tenant o integración;
9. necesita decidir una regla clínica, fórmula, umbral de privacidad, deduplicación productiva, indicador oficial o interpretación jurídica;
10. cualquier texto presenta FURAG/MIPG, ADRES, evidencia o finanzas con un significado contrario a esta Task;
11. los criterios críticos no pueden verificarse o existen pruebas relevantes fallando por el cambio;
12. el árbol contiene cambios ajenos que se solapan con los archivos autorizados y no puede preservarlos con seguridad.

No es condición de parada un defecto ordinario dentro del alcance: debe corregirse y volverse a probar.

## 20. Compatibilidad, migración y rollback

- No hay migración de datos ni esquema.
- No hay compatibilidad API que preservar.
- El cambio debe ser aditivo: nueva ruta y feature aislada.
- Rollback conceptual: retirar únicamente los archivos nuevos de A-01. Claude Code no ejecutará borrado ni rollback sin autorización.
- Hospital, raíz, Paciente e Inscripción deben permanecer intactos.

## 21. Evidencia requerida en el handoff

Claude Code debe devolver a Codex:

1. Task ID y estado real: implementada/verificada, parcial o bloqueada.
2. URL localhost exacta de `/municipality`.
3. lista exacta de archivos creados/modificados y propósito.
4. confirmación de que no hubo archivos eliminados, dependencias ni cambios prohibidos.
5. matriz AC-01 a AC-25 con evidencia concreta.
6. comandos ejecutados y resultados completos; pruebas fallidas/no ejecutadas por separado.
7. capturas de Inicio en `1340×900`, `768×1024` y `375×812`.
8. capturas de al menos un estado “Próximamente”, incluyendo FURAG o ADRES.
9. comparación visual trazable con `prototype-claude/Eligeme-Alcaldia.dc.html`.
10. evidencia de navegación por teclado, foco y selector temporal.
11. evidencia de ausencia visible/accesible de `MERDN` y datos clínicos individuales.
12. evidencia de que toda información es configuración fixture local y no existe red/persistencia.
13. evidencia de regresión de Hospital.
14. `git status --short` y diff limitado a archivos permitidos.
15. supuestos locales, desviaciones, riesgos residuales y STOP CONDITIONS.

El handoff no equivale a aceptación. Codex audita la implementación y el Product Owner acepta o rechaza.

## 22. Definition of Done

TASK-ALCALDIA-A-01 se considera terminada únicamente cuando:

1. `/municipality` presenta el shell y Inicio aprobados con fidelidad verificable;
2. navegación, selector temporal y accesos funcionan dentro del alcance local/demo;
3. todos los módulos futuros tienen un estado próximo seguro y no inventan contenido;
4. los datos están explícitamente identificados como ficticios y separados conceptualmente de futuros datos internos y fuentes oficiales;
5. privacidad municipal, FURAG/MIPG, ADRES, sentencia, marca y límites institucionales se cumplen;
6. desktop, tablet, móvil, zoom y teclado han sido verificados con evidencia;
7. pruebas de contenido, negativas, arquitectura, accesibilidad y regresión pasan;
8. lint, typecheck, build y tests no presentan fallos introducidos;
9. Hospital y las demás experiencias no se degradan;
10. prototipo y todos los archivos prohibidos permanecen intactos;
11. Claude Code entrega la evidencia completa para auditoría;
12. Codex aún debe auditar y el Product Owner conserva la aceptación final; y
13. no se realiza commit, push, merge, release o despliegue.

## 23. Decisiones, supuestos, riesgos y bloqueos

### Decisiones aprobadas aplicadas

- diseño visual del `.dc.html` sin rediseño;
- ruta `/municipality` de la arquitectura vigente;
- A-01 frontend demostrativo sin backend;
- navegación local a “Próximamente”;
- datos municipales agregados/anonimizados;
- reflow responsive reutilizando el patrón institucional existente, sin navegación móvil nueva;
- marca visible Elígeme y prototipo protegido.

### Supuestos controlados

- `Alcaldía de Soacha`, `Secretaría de Salud`, fechas, facturas, valores y fuentes son fixtures ficticios porque así se clasifican expresamente en A-01; no identifican producción.
- El selector cambia únicamente presentación/estado seleccionado porque A-01 prohíbe inventar cálculo o backend.
- El estado “Próximamente” es suficiente para preparar módulos A-02…A-08 sin implementar su interior.

### Riesgos residuales

- El `.dc.html` declara un viewport de escritorio y no una maqueta móvil separada. La instrucción expresa del Product Owner autoriza responsive; esta Task limita la adaptación a reflow, apilado y scroll de navegación con el patrón existente de Hospital, sin inventar una arquitectura móvil.
- Los valores demo podrían confundirse con datos oficiales; se mitiga con una etiqueta visible de demostración y pruebas negativas de oficialidad/integración.
- La autorización municipal productiva sigue pendiente; A-01 no la simula ni se presenta como control de acceso.

### Decisiones materiales pendientes para A-01

Ninguna. Las decisiones productivas de permisos, fuentes, fórmulas, umbrales, integraciones y módulos posteriores permanecen fuera de alcance y no bloquean este slice demostrativo.

### Bloqueos actuales

Ninguno identificado al emitir esta especificación.

## 24. Gate

**READY FOR CLAUDE: SÍ**

Este gate autoriza exclusivamente que Claude Code implemente y pruebe el alcance delimitado en esta Task. No autoriza modificar el prototipo, ampliar alcance, tomar decisiones materiales, hacer operaciones Git de escritura ni desplegar.
