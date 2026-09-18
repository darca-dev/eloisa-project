# Eloisa — Task Specification

## 1. Identificación y gate

- **Task ID:** `TASK-ALCALDIA-DEMO-FINAL` / `A-05-DEMO-FINAL`
- **Título:** Alcaldía — cierre consolidado de demo
- **Tipo:** frontend demostrativo, sin backend ni integraciones
- **Implementador:** Claude Code
- **Auditor posterior:** Codex
- **Autoridad de producto y aceptación:** Product Owner
- **Rama inspeccionada:** `develop`
- **Gate:** **READY FOR CLAUDE: SÍ**, exclusivamente dentro de la allowlist de §20.

Esta especificación autoriza una sola ejecución coherente para completar las siete vistas pendientes de Alcaldía. No autoriza commit, push, merge, release ni despliegue.

## 2. Objetivo y valor

Completar la experiencia navegable de Alcaldía para que una persona pueda recorrer y comprender la cadena:

**POBLACIÓN → TERRITORIO → PROGRAMAS → PRESUPUESTO → EVIDENCIA → GESTIÓN INSTITUCIONAL → BRECHAS → RESULTADOS → REPORTES**.

El resultado es una demo frontend sólida con datos ficticios, agregados y claramente rotulados. No crea capacidades gubernamentales, clínicas, documentales o financieras productivas.

## 3. Fuentes autoritativas y agentes utilizados

Claude Code debe leer antes de implementar:

1. `AGENTS.md` y `CLAUDE.md`.
2. `prototype-claude/Eligeme-Alcaldia.dc.html`, solo como referencia visual y de flujo:
   - navegación de las siete vistas: líneas aproximadas 54–80;
   - FURAG/MIPG: 438–500 y fixtures 883–903;
   - ADRES: 502–541 y fixtures 905–921;
   - Derecho al cuidado: 543–583 y fixtures 923–941;
   - Brechas: 585–602 y fixtures 943–953;
   - Cuidadores/formación: 604–634 y fixtures 955–972;
   - Indicadores/resultados: 636–674 y fixtures 974–991;
   - Reportes ejecutivos: 676–709 y fixtures 993–1009.
3. `tasks/TASK-ALCALDIA-A-01.md` a `TASK-ALCALDIA-A-04.md` y `tasks/TASK-BRAND-01-ELOISA-ISA.md`.
4. La implementación vigente en `apps/web/src/features/municipality/**`.
5. Documentos aplicables de `docs/`, especialmente producto, módulos, datos, arquitectura y seguridad.

Se utilizaron realmente estos contratos de agente:

1. `01-MERDN-ORCHESTRATOR`: consolidación, alcance, gate y handoff.
2. `02-UX-UI-FIDELITY-GUARDIAN`: fidelidad visual, responsive y accesibilidad.
3. `03-BACKEND-DATA-ARCHITECT`: modelo conceptual, procedencia y no duplicación.
4. `04-SECURITY-ACCESS-GUARDIAN`: privacidad, acceso agregado y límites futuros.
5. `05-INSTITUTIONAL-REGULATORY-AGENT`: FURAG/MIPG, ADRES, SENA y T-319.
6. `06-INTEGRATIONS-AUTOMATION-AGENT`: estados no conectados y fallas futuras.
7. `07-QA-ACCEPTANCE-AGENT`: criterios, pruebas negativas y regresión.
8. `09-FRONTEND-APPLICATION-ARCHITECT`: componentes, estado y fronteras de archivos.

## 4. Decisiones aprobadas que prevalecen sobre el prototipo

El `.dc.html` es vinculante en composición, jerarquía, navegación, densidad, paleta y patrones visuales. No es vinculante cuando su copy o estado inline contradice esta Task.

Por tanto:

- sustituir `ELÍGEME` visible por **Eloisa**;
- usar **Isa** solo cuando el asistente aparezca conforme a BRAND-01;
- no mostrar `Elígeme`, `Evidencia Local Inteligente` ni `MERDN`;
- todos los valores nuevos son `FIXTURE_DEMO`, incluso 71,4 y los valores atribuidos conceptualmente a fuentes oficiales;
- no usar como estado real “importado”, “consultado”, “sincronizado”, “generado” o “verificado”;
- mostrar `Conexión no habilitada`, `Dato oficial no disponible` o equivalente aplicable;
- conservar la estructura visual de reportes, pero sus controles de formato no realizan descargas;
- reemplazar detalles que puedan parecer severidad clínica por lenguaje administrativo sin alterar la composición.

No copiar código, estado inline, `.dc.html` ni `support.js` a producción.

## 5. Alcance

### 5.1 Dentro de alcance

1. Activar contenido propio para `furag`, `adres`, `cuidado`, `brechas`, `cuidadores`, `indicadores` y `reportes` dentro del shell existente.
2. Una pantalla enfocada por módulo, fiel a la referencia aprobada.
3. Configuración local tipada, fixtures agregados y procedencia visible.
4. Reutilización de A-01–A-04 y sus patrones de estilos, navegación, configuración y pruebas.
5. Responsive mediante los patrones existentes de Municipality.
6. Accesibilidad proporcional y pruebas especificadas en §23.

### 5.2 Fuera de alcance

- backend, API, PostgreSQL, Prisma, migraciones o nueva autenticación;
- autorización productiva, RLS o auditoría persistente;
- conexiones FURAG/Función Pública, MIPG, BDUA/ADRES o SENA;
- uploads, sincronización, conciliación o verificación real;
- cálculo de puntajes oficiales, fórmulas institucionales o reglas clínicas;
- generación o descarga real PDF, Excel o CSV;
- rutas nuevas, query parameters, persistencia o dependencias nuevas;
- datos reales, nominales o sensibles;
- cambios a Hospital, Paciente, Cuidador, Inscripción, backend, infraestructura o prototipo.

## 6. Arquitectura frontend y reutilización

1. Mantener `/municipality`, `MunicipalityShell`, `MunicipalitySidebar` y `MunicipalityTopbar` como única composición.
2. Ampliar `MUNICIPALITY_MODULOS_IMPLEMENTADOS` para incluir los trece módulos existentes; no crear nuevas rutas.
3. Añadir un componente enfocado por cada vista pendiente. El shell solo importa y monta; no recibe JSX, datos ni lógica interna de los siete módulos.
4. Mantener `municipalityConfig.ts` como fuente central tipada. Se permite separar fixtures/tipos nuevos en archivos locales bajo la misma feature si es necesario para mantener foco y legibilidad; no crear una segunda configuración contradictoria.
5. Reutilizar clases o patrones actuales equivalentes a vista, encabezado, tarjetas, tabla desplazable, píldoras de estado y progreso. Añadir solo variantes necesarias.
6. No duplicar `Programa`, población, territorio, presupuesto, movimientos, fuentes financieras o evidencias de A-01–A-04. Cuando un resumen represente el mismo concepto, referenciar el dato/configuración existente o declarar explícitamente un fixture independiente con procedencia; nunca recalcularlo en JSX.
7. No importar componentes `Hospital*` ni modificar Hospital.
8. No añadir paquetes. Mantener React, Next.js, TypeScript, CSS Modules y Vitest existentes.

## 7. Contrato transversal de datos demo y procedencia

Todo valor nuevo visible debe:

- estar cerca de una etiqueta visible y accesible `Datos demostrativos` o `Fixture de demostración`;
- clasificarse como `FIXTURE_DEMO`;
- usar como origen técnico `Fixture local de diseño`;
- mantener `asOf: null` mientras no exista fuente conectada;
- mantener estado `SIN_INTEGRACION` o equivalente ya aprobado;
- incluir periodo declarativo cuando corresponda;
- usar IDs opacos terminados o identificados como demo;
- no alimentar ni aparentar un reporte productivo.

Reutilizar `MunicipalityProcedenciaRef` y categorías existentes. No clasificar como `FUENTE_OFICIAL_EXTERNA` un valor porque su concepto mencione FURAG, ADRES o SENA. Si se muestra una “fuente de referencia”, distinguirla del origen técnico real del valor.

Preparar conceptualmente, sin DTO, API ni persistencia: `source/fuente`, `asOf/fecha de actualización`, `procedencia`, `periodo`, `versión` y, para indicadores, definición/unidad/fórmula futura.

El selector temporal continúa siendo local y no recalcula ni consulta los fixtures.

## 8. FURAG y MIPG

Implementar la composición aprobada:

1. Encabezado `FURAG y MIPG` y explicación institucional.
2. Dos tarjetas superiores: resultado/histórico y evidencia disponible.
3. Mapa o tabla de evidencia por política/tema MIPG con evidencia, responsable, periodo y estado.
4. Nota institucional final.

Contenido mínimo:

- explicar que FURAG es el **Formulario Único de Reporte y Avance de Gestión** y que sus datos alimentan la Medición del Desempeño Institucional;
- Eloisa no calcula el puntaje FURAG, no declara cumplimiento, no certifica mejora y no crea ranking oficial;
- el valor `71,4` y el histórico pueden conservarse solo como fixtures inequívocos, nunca como resultado conectado o importado;
- mostrar `Conexión no habilitada` o `Dato oficial no disponible`;
- mostrar documentos, indicadores estructurados, programas documentados, actividades con evidencia, brechas y mapa de evidencia;
- usar “evidencia disponible para soporte de gestión”, nunca “cumple FURAG”.

La configuración debe anticipar, sin implementar integración: resultado oficial, vigencia, fecha de actualización, dimensión/política, evidencia relacionada, brecha, responsable y acción de mejora.

## 9. ADRES

Implementar:

1. Encabezado y delimitación institucional.
2. Grid de agregados demostrativos: afiliación, régimen subsidiado, régimen contributivo, EPS reportadas, LMA cuando corresponda, información financiera disponible, fuentes y fecha.
3. Comparación con columnas exactas **EN ELOISA / OFICIAL / DIFERENCIA**.
4. Nota de revisión administrativa.

Reglas:

- ADRES no es regulador, no tiene “puntaje municipal” y no equivale a todo el presupuesto municipal;
- Eloisa no determina giros, no modifica ni corrige la fuente oficial;
- ambas columnas y la diferencia son fixtures mientras no exista fuente conectada;
- las diferencias sirven solo para revisión administrativa;
- mostrar conexión no habilitada/dato oficial no disponible;
- no afirmar BDUA o ADRES importada, consultada o sincronizada.

No duplicar ni contradecir los montos o fuentes financieras de A-04.

## 10. Seguimiento al derecho al cuidado

Implementar:

1. Título exacto `Seguimiento al derecho al cuidado`.
2. Doce agregados: mayores registrados, necesidad de cuidado, con/sin cuidador, atención domiciliaria, valoración profesional, seguimiento, visitas, consultas virtuales, valoraciones interdisciplinarias, cuidadores con educación y alertas atendidas.
3. Matriz para `Mayores de 60`, `Discapacidad` y `Cuidado en casa` con columnas **IDENTIFICADA / ATENDIDA / EN SEGUIMIENTO / PENDIENTE**.
4. Referencia escrita exactamente como **Sentencia T-319 de 2025**.

Eloisa documenta acciones, cobertura, evidencia, pendientes y seguimiento. No certifica cumplimiento de derechos. La cadena `Ley 319` está prohibida.

## 11. Brechas

Implementar la pantalla `¿Qué nos falta atender?` con las nueve categorías aprobadas:

1. población identificada sin vincular;
2. necesidad de cuidado sin cuidador;
3. personas sin seguimiento reciente;
4. alertas abiertas sin cierre documentado;
5. zonas con baja cobertura;
6. cuidadores sin formación;
7. programa con baja ejecución;
8. presupuesto sin ejecutar;
9. actividades sin soporte.

Cada elemento muestra valor, título, detalle y estado textual **PRIORITARIO** o **SEGUIMIENTO**, además del color. Son brechas administrativas; no son riesgo clínico individual, diagnóstico, triage ni decisión médica. Sustituir cualquier detalle tipo “rojas/amarillas” por prioridad o estado administrativo/documental.

## 12. Cuidadores y formación

Implementar:

1. Nueve agregados: identificados, familiares, remunerados, con/sin formación, en capacitación, certificados, certificados por SENA y por otras instituciones.
2. Ruta visual y textual: orientados → inscritos → en formación → certificación cargada → certificación verificada.
3. Barras con valor textual; el color no es el único portador de información.

SENA es una posible entidad/fuente formadora. No existe integración técnica. Una certificación cargada no prueba autenticidad; “verificada” es un estado fixture y su verificación productiva futura requerirá autoridad, método, fecha, responsable y trazabilidad. Ningún certificado prueba automáticamente cumplimiento institucional o FURAG.

## 13. Indicadores y resultados

Implementar:

1. Tabla con **PERIODO ANTERIOR / PERIODO ACTUAL / VARIACIÓN**.
2. Los ocho indicadores aprobados: cobertura, visitas, consultas virtuales, seguimiento vigente, tiempo promedio de respuesta, cuidadores identificados, cuidadores certificados y actividades con evidencia.
3. Frase exacta `Variación observada durante el periodo` y aclaración de que no se atribuye causalidad automática a Eloisa.
4. Satisfacción agregada: general, evaluaciones, puntualidad, comunicación, empatía y orientación al cuidador.

No mostrar comentarios individuales, calificación nominal ni ranking de profesionales. No inventar fórmulas. La configuración solo anticipa definición, unidad, periodos, variación, fuente, owner, versión, método, fecha y linaje futuros.

## 14. Reportes ejecutivos

Implementar:

1. Encabezado y aviso `Vista demostrativa · generación no habilitada` o equivalente inequívoco.
2. Portada azul con municipio, periodo, población objetivo, beneficiarios, presupuesto, ejecución, nivel de evidencia y brechas abiertas.
3. Nueve tarjetas:
   - Informe de gestión;
   - Informe de población beneficiada;
   - Informe de ejecución presupuestal;
   - Informe de evidencias;
   - Informe de atención domiciliaria;
   - Informe de cuidadores;
   - Informe de indicadores;
   - Carpeta de evidencias para FURAG/MIPG;
   - Reporte de seguimiento al derecho al cuidado.
4. Controles visuales PDF, Excel y CSV como `button type="button" disabled` o semántica equivalente verdaderamente inactiva, con estado visible `Disponible en una fase futura`.

No usar enlaces, atributo `download`, Blob, red, handler que simule éxito ni mensaje de archivo generado. Cada reporte prepara en configuración `source`, `asOf`, `procedencia` y estado `NO_DISPONIBLE_DEMO` o equivalente.

## 15. Privacidad, seguridad y acceso

Alcaldía mantiene exclusivamente datos agregados/anónimos. Prohibido mostrar o inferir:

- nombres, documentos, teléfonos o dirección exacta;
- HCE, diagnóstico, medición, comentario o alerta clínica individual;
- salarios u honorarios individuales;
- comentarios individuales o evaluaciones nominales de profesionales;
- listados de personas, búsqueda, drill-down nominal o exportación.

No inventar un umbral de grupos pequeños. No introducir desagregaciones que faciliten reidentificación. Los fixtures representan un único contexto municipal ficticio y no implementan seguridad backend.

El futuro acceso será server-side, deny-by-default y contextual por cuenta, afiliación, rol, permiso, tenant, institución, municipio/territorio/programa, finalidad, vigencia y sensibilidad. Ver agregados no concede permiso nominal, clínico, de descarga o exportación. Estas reglas futuras no se implementan en esta Task.

## 16. Auditoría, propiedad y aislamiento futuros

No implementar auditoría ni tenant enforcement. La arquitectura futura deberá conservar:

- tenant, institución/municipio, programa/territorio y periodo donde apliquen;
- contexto derivado por servidor, repositorios scoped y RLS deny-by-default;
- separación entre original oficial, corrección interna y cálculo derivado;
- auditoría append-only para incorporación, reconciliación, brechas, evidencias, certificados, fórmulas y reportes/exportaciones;
- actor, tenant, institución, acción, recurso, resultado, timestamp, correlación, finalidad y cambios minimizados.

Una relación interinstitucional o vista agregada no autoriza cruce de tenants.

## 17. Integraciones y estados de falla

No implementar conectores. La demo presenta:

- FURAG/Función Pública: `Conexión no habilitada`;
- ADRES/BDUA/LMA: `Conexión no habilitada` o `Dato oficial no disponible`;
- SENA: `Sin integración técnica`;
- reportes: `Generación no habilitada`.

La futura arquitectura podrá usar puertos/adaptadores con fuente autorizada, configuración institucional, finalidad, campos permitidos, versión de mapeo, ejecución, procedencia y reconciliación. Fallas futuras deben ser visibles, reintentables o quedar en cuarentena según contrato; nunca convierten silenciosamente datos en oficiales. Esto es preparación conceptual, no código de integración.

## 18. Branding

En toda UI nueva y modificada:

- nombre visible: **Eloisa**;
- asistente, cuando corresponda: **Isa**;
- prohibidos visibles: `Elígeme`, `Evidencia Local Inteligente`, `MERDN`.

No renombrar identificadores técnicos internos salvo que sea necesario para cumplir el branding visible y esté dentro de la allowlist.

## 19. Responsive y accesibilidad

1. Reutilizar reflow y breakpoints existentes de Municipality; no pedir nuevo diseño ni crear drawer.
2. Escritorio preserva tarjetas, grids, tablas y jerarquía del prototipo.
3. Tablet y móvil reordenan sin solapamiento; tablas usan el patrón desplazable existente cuando sea necesario.
4. Un solo `<h1>` por vista; navegación mantiene `aria-current` y foco del título al cambiar.
5. Tablas conservan encabezados semánticos o estructura accesible equivalente.
6. Estados críticos incluyen texto, no solo color.
7. Los controles deshabilitados de reportes comunican nombre, estado y ausencia de descarga.
8. Foco visible, teclado, nombres accesibles y contraste deben conservarse.

La comprobación manual exacta de todos los viewports y zoom es una limitación visual no bloqueante para esta demo; sí se exige una revisión razonable de escritorio, tablet y móvil.

## 20. Archivos previstos y allowlist exacta

Claude Code puede crear o modificar exclusivamente archivos bajo `apps/web/src/features/municipality/**` que correspondan a esta lista:

### Crear, un componente enfocado por vista

- `MunicipalityFurag.tsx`
- `MunicipalityAdres.tsx`
- `MunicipalityCare.tsx`
- `MunicipalityGaps.tsx`
- `MunicipalityCaregivers.tsx`
- `MunicipalityIndicators.tsx`
- `MunicipalityReports.tsx`

Se aceptan nombres equivalentes coherentes dentro de la misma feature. No se acepta un megacomponente con las siete vistas.

### Modificar mínimamente

- `municipalityConfig.ts`
- `municipalityViews.ts`
- `MunicipalityShell.tsx`
- `municipality.module.css`
- `municipalityViews.test.ts`
- `municipalityShell.test.tsx`
- `municipalityPrivacidad.test.tsx`

### Pruebas nuevas permitidas

- un test enfocado por módulo; o
- un conjunto pequeño de tests temáticos/transversales con trazabilidad clara.

`municipalityTestUtils.ts` es reutilizable en lectura. Solo puede modificarse si una extensión genuinamente general resulta imprescindible y se explica en el handoff. Si hace falta tocar cualquier ruta adicional, Claude Code debe detener esa ampliación y devolver **READY FOR CLAUDE: NO** para revisión.

## 21. Archivos y áreas prohibidos

- `prototype-claude/**`, incluido `.dc.html` y `support.js`;
- `apps/web/src/features/hospital/**`;
- Paciente, Cuidador e Inscripción;
- páginas App Router, salvo autorización posterior explícita;
- backend/API, `prisma/**`, migraciones, infraestructura y Docker;
- manifests, lockfiles y dependencias;
- documentación o tareas fuera de esta especificación.

No commit, push, merge, rebase, release ni deploy.

## 22. Criterios de aceptación

1. Los siete módulos muestran contenido propio dentro del shell y ninguno conserva `Próximamente`.
2. Los trece items del menú permanecen en el orden aprobado y navegan a una sola vista cada vez.
3. Cada pantalla conserva composición, jerarquía y contenido esencial de la referencia, con las correcciones semánticas de §4.
4. Todos los valores nuevos son inequívocamente demo/fixture y no conectados.
5. FURAG/MIPG cumple íntegramente §8; 71,4 no aparece como oficial conectado.
6. ADRES cumple §9 y conserva EN ELOISA/OFICIAL/DIFERENCIA sin sugerir corrección ni presupuesto municipal total.
7. Derecho al cuidado contiene `Sentencia T-319 de 2025`, nunca `Ley 319`, y no certifica cumplimiento.
8. Brechas son administrativas, con estado textual, sin lenguaje clínico individual.
9. SENA queda delimitado como entidad/fuente y sin integración o cumplimiento automático.
10. Indicadores usan `Variación observada durante el periodo`, sin causalidad; satisfacción permanece agregada.
11. Reportes muestran nueve tarjetas y formatos inactivos sin descarga o éxito falso.
12. No aparece PII, HCE, diagnóstico, dato financiero individual, comentario clínico ni evaluación nominal.
13. Solo `Eloisa` e `Isa` aparecen como branding visible aprobado.
14. A-01–A-04 siguen funcionando y sus modelos/datos no se duplican.
15. Hospital no cambia ni se importa en Municipality.
16. No hay red, persistencia, secretos, uploads, descargas, API o integración.
17. Responsive y accesibilidad cumplen §19 de forma proporcional.
18. El diff se limita a §20 y el prototipo permanece intacto.

## 23. Pruebas requeridas

### 23.1 Automatizadas focalizadas

1. Navegación y render de los siete H1/contenidos esenciales; ausencia de `Próximamente`.
2. Los trece IDs están implementados y una sola vista se monta por vez.
3. Shell, `<main>`, un H1, `aria-current` y foco preparado no regresan.
4. Cada pantalla expone etiqueta demo y procedencia `FIXTURE_DEMO`, `asOf: null`, `SIN_INTEGRACION` o equivalentes aprobados.
5. FURAG: disclaimer, 71,4 demo si existe, sin cálculo, cumplimiento, ranking o importación activa.
6. ADRES: no regulador, no puntaje, no presupuesto municipal total, no corrección y no conexión activa.
7. Derecho: presencia exacta de `Sentencia T-319 de 2025`; ausencia de `Ley 319`.
8. Brechas: estados administrativos y ausencia de diagnóstico, triage o decisión médica.
9. SENA: sin integración ni equivalencia automática con FURAG/cumplimiento.
10. Indicadores: frase de variación y no causalidad; satisfacción agregada, sin profesionales nominales.
11. Reportes: PDF/Excel/CSV deshabilitados; ausencia de enlace, descarga, red y éxito falso.
12. Privacidad: ausencia de campos/acciones nominales, PII, HCE, clínica individual, drill-down y exportación.
13. Branding visible: ausencia de `Elígeme`, `Evidencia Local Inteligente` y `MERDN`; presencia de Eloisa donde corresponda.
14. Consistencia/no regresión de Inicio, Población, Territorio, Programas, Presupuesto y Evidencias.
15. No imports de Hospital y diff limitado a la feature.

Actualizar `municipalityPrivacidad.test.tsx`: hoy prohíbe toda coincidencia con “puntaje FURAG”, pero la nueva vista debe poder decir negativamente que Eloisa **no calcula** ese puntaje. La prueba debe prohibir afirmaciones positivas de cálculo, cumplimiento, ranking u oficialidad, no el uso institucionalmente correcto del término.

No añadir jsdom ni dependencias. Con el harness actual, clic real, foco, viewports y zoom se verifican manualmente.

### 23.2 Comandos obligatorios

Ejecutar y reportar resultado exacto:

```text
npm.cmd run test --workspace @merdn/web
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Se permiten primero tests focalizados de Municipality. Una prueba no ejecutada debe reportarse como no ejecutada, nunca como aprobada.

### 23.3 Revisión manual mínima

- recorrer los siete módulos desde sidebar y accesos existentes aplicables;
- comprobar teclado, foco, lectura de estados y controles disabled;
- inspeccionar escritorio, tablet y móvil razonables;
- confirmar ausencia de descargas, solicitudes externas y mensajes de éxito;
- comparar cada vista con el bloque correspondiente del `.dc.html`.

## 24. Evidencia requerida en el handoff

Claude Code debe devolver:

1. archivos creados/modificados y propósito;
2. trazabilidad de cada uno de los siete módulos contra esta Task;
3. explicación de reutilización A-01–A-04;
4. fixtures y nodos de procedencia incorporados;
5. evidencia de estados no conectados e inactividad de reportes;
6. comandos y resultados exactos, incluidos fallos/no ejecutados;
7. resultados de revisión manual y limitaciones de viewport/zoom;
8. confirmación de privacidad y branding;
9. `git status --short`, resumen del diff y `git diff --check`;
10. desviaciones, riesgos y decisiones pendientes;
11. confirmación expresa de que no tocó prototipo, Hospital, backend, Prisma, migraciones, infraestructura ni dependencias;
12. confirmación de no commit y no push.

## 25. Compatibilidad y rollback

- Sin migración ni compatibilidad de API.
- Estado únicamente local y efímero.
- El rollback conceptual consiste en retirar los siete componentes/configuraciones y restaurar su estado `Próximamente`, sin tocar A-01–A-04.
- No ejecutar rollback ni acciones destructivas como parte de esta Task.

## 26. Decisiones materiales pendientes

No bloquean esta demo, pero bloquean una pasada funcional/productiva:

1. fuentes, datasets, contratos y versiones oficiales autorizados;
2. catálogo, fórmulas, owners y validación de indicadores;
3. base jurídica/aplicabilidad y evidencia de T-319;
4. autoridad, acuerdo y método de verificación SENA;
5. permisos/roles exactos, publicación y exportación;
6. umbral de grupos pequeños y mitigación de reidentificación;
7. retención, corrección, reconciliación y linaje;
8. generación real de archivos, auditoría y separación de funciones;
9. integraciones y comportamiento operativo de fallas.

Claude Code no debe resolverlas con fixtures ni supuestos.

## 27. Riesgos y condiciones de parada

Riesgos principales: presentar fixtures como oficiales; contradecir A-04; convertir diferencias ADRES en “errores”; sugerir triage; equiparar SENA con cumplimiento; atribuir causalidad; fingir descargas; introducir branding anterior; o facilitar reidentificación.

Detener solo la parte afectada y devolver a Codex/Product Owner si:

- se necesita una pantalla o rediseño no cubierto por el prototipo;
- se necesita un archivo fuera de §20;
- se necesita backend, integración, dato real o exportación;
- se requiere inventar fórmula, fuente oficial, regla clínica, interpretación jurídica o permiso;
- una corrección obliga a tocar Hospital u otra experiencia;
- existe contradicción no resuelta con A-01–A-04.

## 28. Definition of Done

La Task está implementada, pero todavía no aceptada, cuando:

1. los siete módulos cumplen §§8–14;
2. se satisfacen los criterios de §22;
3. pasan las pruebas y comandos de §23 o se reporta con precisión cualquier bloqueo;
4. el handoff contiene toda la evidencia de §24;
5. el diff permanece dentro de §20;
6. no quedan decisiones materiales ocultas;
7. Codex recibe el resultado para auditoría posterior;
8. no se realizó commit ni push.

**READY FOR CLAUDE: SÍ**
