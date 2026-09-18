# MERDN Task Specification

## 1. Identificación

- **Task ID:** TASK-ALCALDIA-A-02
- **Título:** Alcaldía — Población beneficiaria + Territorio
- **Estado:** lista para implementación por Claude Code
- **Prioridad:** HIGH
- **Responsable de implementación:** Claude Code
- **Responsable de auditoría posterior:** Codex
- **Autoridad de producto y aceptación final:** Product Owner
- **Dependencia aprobada:** TASK-ALCALDIA-A-01 implementada, aprobada y committed

## 2. Objetivo y valor

Implementar, dentro del shell existente de `/municipality`, las dos vistas demostrativas aprobadas de **Población beneficiaria** y **Territorio**. El slice permite comprender población objetivo, cobertura, solapamientos, calidad administrativa de datos y distribución territorial agregada, sin exponer personas, direcciones ni información clínica individual.

A-02 es frontend demostrativo. No crea backend, persistencia, integraciones, reglas clínicas, fórmulas oficiales, modelo financiero productivo ni autorización definitiva.

## 3. Fuentes autoritativas inspeccionadas

Claude Code debe leer antes de implementar `AGENTS.md`, `CLAUDE.md`, esta Task, `tasks/TASK-ALCALDIA-A-01.md` y los documentos aplicables de `docs/`, especialmente `PRODUCT.md`, `MODULES.md`, `ROLES.md`, `DATA.md`, `SECURITY.md` y `ARCHITECTURE.md`.

### 3.1 Referencia visual vinculante

- `prototype-claude/Eligeme-Alcaldia.dc.html`
  - navegación a las vistas: líneas 34–40;
  - Población beneficiaria: líneas 172–235;
  - Territorio: líneas 237–268;
  - estado y transiciones locales: líneas 719–761;
  - fixtures de población, intersecciones, calidad y zonas: líneas 803–840 aproximadamente.

Las pantallas corresponden conceptualmente a las páginas 4–7 del PDF aprobado: población objetivo y cobertura, intersecciones, calidad de información y distribución territorial agregada.

El archivo se inspecciona en modo de solo lectura. Se reconstruye con React, TypeScript y CSS mantenible; está prohibido copiar o usar como runtime el `.dc.html`, `support.js`, su estado inline o sus datos como reglas productivas. No se diseña una alternativa y no se añade mapa geográfico.

### 3.2 Implementación A-01 reutilizada

Se inspeccionaron los archivos existentes bajo `apps/web/src/features/municipality/**` y `apps/web/src/app/municipality/page.tsx`.

Hechos relevantes:

1. `/municipality` ya monta `MunicipalityShell`.
2. `poblacion` y `territorio` ya existen como IDs de navegación local y hoy muestran `MunicipalityComingSoon`.
3. El shell, sidebar, topbar, selector temporal, perfil, configuración demo, branding, foco al cambiar de vista y reflow responsive ya existen.
4. A-02 debe sustituir únicamente los estados próximos de esos dos IDs por contenido propio; no debe duplicar ni rediseñar A-01.

## 4. Agentes aplicados

Se leyeron y aplicaron realmente estos contratos locales:

1. `agents/01-MERDN-ORCHESTRATOR.md`: delimitación, gate, handoff, decisiones y protección del prototipo.
2. `agents/02-UX-UI-FIDELITY-GUARDIAN.md`: fidelidad vinculante, ausencia de rediseño, responsive, accesibilidad y evidencia visual.
3. `agents/03-BACKEND-DATA-ARCHITECT.md`: separación entre fixture y modelo productivo, deduplicación, procedencia, territorialidad y fronteras frontend-only.
4. `agents/04-SECURITY-ACCESS-GUARDIAN.md`: minimización municipal, prohibición nominal/clínica, aislamiento futuro y riesgo de reidentificación.
5. `agents/05-INSTITUTIONAL-REGULATORY-AGENT.md`: clasificación de procedencia, límites de oficialidad, brechas administrativas, indicadores y finanzas.
6. `agents/06-INTEGRATIONS-AUTOMATION-AGENT.md`: ninguna integración activa o simulada; estados de fuente y sincronización solo como contrato futuro.
7. `agents/07-QA-ACCEPTANCE-AGENT.md`: trazabilidad, pruebas positivas, negativas, visuales, accesibles y de regresión.
8. `agents/09-FRONTEND-APPLICATION-ARCHITECT.md`: composición en la feature existente, límites de componentes, configuración tipada, estado local y pruebas frontend.

## 5. Alcance

### 5.1 Dentro de alcance

1. Habilitar contenido propio para los IDs locales `poblacion` y `territorio` dentro del shell A-01.
2. Reproducir las dos vistas vinculantes y sus fixtures exactos.
3. Representar cobertura, deduplicación e intersecciones como datos demo explícitos y consistentes.
4. Representar indicadores administrativos de calidad de información.
5. Representar territorio agregado por zona con personas, visitas, alertas administrativas y cobertura.
6. Preparar tipos/configuración frontend para jerarquía territorial normalizada y filtros agregados futuros, sin añadir controles no diseñados.
7. Preparar una referencia opcional futura entre población, territorio, programa, presupuesto, ejecución y evidencia, sin mostrar ni calcular dinero en A-02.
8. Preparar brechas administrativas agregadas, manteniendo el texto/insight territorial aprobado como fixture.
9. Mantener privacidad, procedencia, marca, accesibilidad, responsive y no regresión.
10. Documentar la dependencia futura de datos territoriales estructurados de Paciente y Cuidador, sin modificar sus formularios.

### 5.2 Fuera de alcance

- tabla, listado, búsqueda, ficha o drill-down individual de pacientes o cuidadores;
- nombres, documentos, teléfonos, direcciones exactas, HCE, diagnósticos, comentarios o detalle clínico;
- edición de información individual o clínica desde Alcaldía;
- filtros visibles nuevos, mapa, geocodificación, coordenadas o navegación territorial nueva;
- cálculo productivo de población objetivo, identidad única, deduplicación, cobertura, intersecciones o calidad;
- reglas productivas, umbrales configurables o motor de brechas;
- API, backend, Prisma, migraciones, base de datos, RLS, autenticación, permisos o auditoría persistente;
- integración con Hospital, EPS, RLCPD, ADRES u otra fuente oficial;
- presupuestos, prorrateo, costos, ejecución financiera o A-04;
- exportación, descarga, impresión o persistencia de selección/filtros;
- cambios a Inscripción, Paciente, Cuidador, Profesional u Hospital;
- cambios visuales a A-01 salvo el montaje técnico compatible de las dos vistas;
- cambios al prototipo, dependencias, infraestructura, Git o despliegue.

## 6. Usuarios, institución, tenant y permisos

- **Experiencia:** Alcaldía / gobierno municipal.
- **Contexto demo:** Alcaldía de Soacha, Secretaría de Salud, perfil de consulta agregada.
- **Acción A-02:** consulta local de fixtures agregados.
- **Tenant/municipio:** el shell representa un contexto ficticio; no implementa ni suplanta tenant, afiliación o alcance municipal verificados por servidor.
- **Permiso futuro:** lectura agregada de población y territorio, condicionada por tenant, municipio, institución, finalidad, periodo, agregación y mínimo necesario.
- **Denegaciones expresas:** acceso nominal, ficha individual, clínica individual, dirección exacta, exportación nominal y acceso cross-tenant/cross-municipio.
- **Regla crítica:** la visibilidad de una pantalla o control no concede autorización. La autorización productiva se aplicará server-side y en la capa de datos con denegación por defecto.

## 7. Requisitos funcionales

### FR-01 — Navegación

1. Seleccionar `Población beneficiaria` monta la vista Población dentro del shell existente y activa únicamente ese item con `aria-current`.
2. Seleccionar `Territorio` monta la vista Territorio dentro del mismo shell y activa únicamente ese item.
3. Volver a Inicio u otro módulo conserva la navegación local de A-01, sin recarga ni cambio de URL.
4. El foco se mueve al `h1` de la nueva vista usando el mecanismo existente.
5. `poblacion` y `territorio` pasan a `MUNICIPALITY_MODULOS_IMPLEMENTADOS`; los demás estados futuros conservan su comportamiento A-01.

### FR-02 — Población objetivo y cobertura

La vista conserva orden, copy, jerarquía y composición del prototipo:

1. `Población beneficiaria`.
2. Texto: `3.050 personas identificadas y vinculadas a programas. Las categorías se cruzan: los totales no suman categorías, deduplican personas.`
3. Sección `Población objetivo identificada y cobertura`.
4. Tarjetas demo exactas:

| Indicador | Valor | Fuente/aclaración visible |
| --- | ---: | --- |
| Población total del municipio | `812.400` | `Proyección oficial` |
| Personas de 60 años o más | `6.117` | `Población objetivo priorizada` |
| Personas con discapacidad | `2.845` | `1.912 en el RLCPD` |
| Requieren cuidado domiciliario | `1.640` | `Identificadas por el municipio y la red` |
| Población objetivo deduplicada | `8.142` | `Unión de las tres poblaciones, sin doble conteo` |
| Registradas en ELÍGEME | `3.050` | `Beneficiarios únicos` |
| Aún no vinculadas | `5.092` | `Brecha de vinculación` |

5. Cobertura visible: `Cobertura ELÍGEME sobre población objetivo` y `37,5 %`, con barra equivalente a 37,5 % y alternativa textual.
6. Todos los valores son `DATO DEMOSTRATIVO`. Los textos de fuente son literales del fixture visual y no prueban fuente oficial, consulta, validación o integración activa.

### FR-03 — Intersecciones y deduplicación

Mostrar `Intersección de poblaciones`, el diagrama aprobado como visualización no interactiva y una lista textual completa:

| Segmento exclusivo | Valor demo |
| --- | ---: |
| Solo persona mayor de 60 | `1.284` |
| Solo discapacidad | `452` |
| Solo cuidados en casa | `268` |
| Mayor de 60 y discapacidad | `386` |
| Mayor de 60 y cuidados en casa | `448` |
| Discapacidad y cuidados en casa | `134` |
| Las tres condiciones | `78` |
| Total de beneficiarios únicos | `3.050` |

Reglas del fixture:

1. Los siete segmentos exclusivos suman `3.050`.
2. Una persona pertenece a exactamente un segmento exclusivo para el conteo de esta representación.
3. Una persona que cumple las tres condiciones cuenta una vez en el total único.
4. Debe conservarse la aclaración aprobada sobre la persona de 76 años como ejemplo ficticio y no identificable.
5. No se diagnostican ni infieren condiciones. Los valores son configuración estática, no un algoritmo aplicado a personas.
6. La lógica productiva de identidad, matching, fuentes autoritativas y deduplicación queda pendiente y no puede inferirse del fixture.

### FR-04 — Calidad de la información

Mostrar `Calidad de la información` con estos indicadores administrativos demo:

| Indicador | Valor demo |
| --- | ---: |
| Personas sin EPS identificada | `64` |
| Documentos pendientes | `112` |
| Afiliaciones por verificar | `87` |
| Duplicados potenciales | `19` |
| Registros completos | `94,2 %` |

No se ofrece edición, corrección, identificación de personas ni acceso al registro subyacente. `Duplicados potenciales` no afirma duplicidad confirmada. Ningún indicador representa diagnóstico o calidad clínica.

### FR-05 — Territorio agregado

La vista conserva:

1. Título `¿Dónde están nuestros beneficiarios?`.
2. Texto: `Información agregada por zona. No se muestran direcciones individuales. Sirve para detectar concentración, baja cobertura y zonas sin servicio.`
3. Encabezados visibles `ZONA`, `PERSONAS`, `VISITAS`, `ALERTAS`, `COBERTURA`.
4. Filas demo exactas:

| Zona | Personas | Visitas | Alertas administrativas | Cobertura |
| --- | ---: | ---: | ---: | ---: |
| Comuna 1 · Compartir | `742` | `318` | `12` | `82 %` |
| Comuna 2 · Soacha centro | `688` | `286` | `9` | `76 %` |
| Comuna 3 · La Despensa | `596` | `241` | `14` | `61 %` |
| Comuna 4 · Cazucá | `604` | `198` | `31` | `44 %` |
| Comuna 6 · San Humberto | `284` | `142` | `7` | `58 %` |
| Zona rural · El Charquito | `136` | `99` | `18` | `31 %` |

5. Las barras de cobertura tienen valor textual; alertas y estado no dependen solo del color.
6. Mantener el insight demo aprobado: `Cazucá y la zona rural concentran la mayor necesidad con la menor cobertura. Son las dos zonas donde el municipio debería enfocar la vinculación.`
7. El insight se rotula/trata como demostrativo y administrativo, no como recomendación clínica ni conclusión oficial.
8. No hay links, selección, drill-down, direcciones, coordenadas ni mapa en A-02.

### FR-06 — Selector temporal

El selector A-01 permanece visible y funcional como estado local, pero A-02 no recalcula ni filtra valores. La nota existente debe seguir aclarando que los datos son demostrativos. No se simula consulta por periodo.

### FR-07 — Procedencia

La configuración debe conservar conceptualmente tres categorías separadas:

1. **Fixture actual:** `DATO DEMOSTRATIVO`, local, ficticio, sin valor oficial.
2. **Futuro agregado Elígeme/Hospital:** dato interno autorizado, agregado, con tenant, municipio, periodo, fuente, fecha de actualización y linaje.
3. **Fuente oficial externa:** dato con entidad publicadora, dataset/documento, versión, periodo, fecha de consulta, modalidad y limitaciones.

Los contratos frontend futuros deben poder representar como mínimo `source`, `asOf`/fecha de actualización, `provenanceCategory` y `syncStatus` cuando corresponda. A-02 no muestra un estado de sincronización ni crea una integración porque el diseño no lo contiene.

## 8. Modelo frontend y escalabilidad

### 8.1 Configuración tipada del slice

Extender la configuración municipal, sin crear DTO de API ni modelo Prisma, con contratos enfocados para:

- resumen de población objetivo;
- cobertura;
- segmento de intersección;
- calidad administrativa;
- fila territorial;
- procedencia demo;
- referencia territorial normalizada futura;
- referencia financiera opcional futura sin montos.

Los componentes reciben configuración por props. No repetir literales en componentes ni introducir store/context global.

### 8.2 Filtros futuros

La arquitectura frontend debe permitir que un contrato posterior incorpore filtros agregados combinables por:

- periodo;
- edad/rango;
- condición/población;
- programa;
- EPS;
- municipio;
- zona urbana/rural;
- barrio/vereda;
- estado de atención;
- con/sin cuidador;
- con/sin profesional cuando corresponda.

A-02 **no renderiza estos filtros** porque no existen en el diseño aprobado. Tampoco define catálogos, opciones, semántica de combinación, URL, consulta ni autorización. Añadir controles visibles requeriría diseño/tarea aprobados posteriores.

### 8.3 Modelo territorial futuro

Preparar el frontend para una referencia territorial normalizada con, como mínimo:

- identificador opaco estable;
- nivel: `MUNICIPIO`, `URBANO_RURAL`, `BARRIO` o `VEREDA`;
- nombre de presentación;
- identificador del padre;
- municipio/tenant de contexto;
- estado de catálogo cuando aplique;
- procedencia y vigencia.

Jerarquía aprobada:

```text
Municipio
→ Urbana/Rural
→ Barrio/Vereda
```

Reglas:

1. `barrio` y `vereda` no se identifican únicamente por texto libre.
2. La dirección exacta es un dato personal restringido separado y nunca forma parte de la respuesta agregada de Alcaldía.
3. A-02 solo prepara tipos/configuración y usa etiquetas demo; no crea catálogo, IDs productivos, CRUD, geocodificación ni migración.
4. Una futura selección territorial podrá solicitar agregados de población objetivo, beneficiarios, cobertura, visitas/atenciones, programas activos, cuidadores disponibles, necesidades de cuidado, brechas y presupuesto metodológicamente atribuible.
5. Ese drill-down futuro requerirá contrato API, autorización, reglas de grupos pequeños, diseño aprobado y pruebas de aislamiento; no se implementa en A-02.

## 9. Relación futura con presupuesto

A-02 conserva estructuralmente la cadena:

```text
POBLACIÓN → TERRITORIO → PROGRAMA → PRESUPUESTO → EJECUCIÓN → EVIDENCIA
```

El frontend puede preparar una referencia opcional entre IDs de población/territorio/programa y una futura atribución financiera. No debe incorporar montos, porcentajes financieros, costo promedio, prorrateo ni cálculo en las vistas A-02.

Solo podrá mostrarse dinero asociado a población o territorio cuando exista una metodología aprobada con fuente, fórmula/regla de atribución, periodo, versión, responsable, evidencia y linaje. Una persona en varias poblaciones no autoriza duplicar gasto. La metodología de asignación, ejecución y cumplimiento físico pertenece a A-04 y sigue pendiente.

## 10. Brechas administrativas

A-02 prepara el concepto de alerta de gestión/brecha administrativa agregada. Ejemplos futuros permitidos, sujetos a reglas aprobadas:

- cobertura territorial bajo un umbral configurado;
- población objetivo no vinculada;
- necesidad de cuidado sin cuidador suficiente;
- población identificada sin seguimiento;
- visitas insuficientes frente a una meta;
- programa con bajo avance;
- presupuesto disponible con atención baja;
- diferencia material entre registros Elígeme y fuentes oficiales.

Límites:

1. A-02 no implementa motor, fórmula, umbral, severidad, notificación ni workflow.
2. El insight territorial y los conteos de alertas son fixtures administrativos.
3. No se infiere diagnóstico, riesgo clínico individual, triaje, urgencia ni decisión médica.
4. Una futura brecha debe conservar regla/versión, insumos, periodo, territorio, programa, fuente, fecha de cálculo, responsable y evidencia.
5. Los umbrales de cobertura, seguimiento, suficiencia, avance, comparación y privacidad son decisiones abiertas.

## 11. Dependencia futura de Paciente y Cuidador

**DEPENDENCIA DOCUMENTADA: SÍ.**

Una Task futura de Paciente debe capturar mediante catálogo territorial estructurado:

```text
Departamento → Municipio → Urbana/Rural → Barrio/Vereda
```

La dirección exacta debe mantenerse como campo restringido separado, con finalidad y permisos propios.

Una Task futura de Cuidador debe distinguir:

1. **Residencia:** departamento, municipio, urbana/rural y barrio/vereda normalizados.
2. **Área de prestación:** uno o más municipios, zonas y barrios/veredas normalizados, más disponibilidad de desplazamiento.

No debe usarse solo texto libre para barrio/vereda, evitando variantes como `San Luis`, `san luis` y `Vereda San Luis` como lugares distintos. A-02 no modifica Inscripción, Paciente, Cuidador ni Hospital y no decide todavía catálogo maestro, fuente geográfica, validación, precisión, retención o permisos.

## 12. Datos, propiedad, sensibilidad y minimización

| Dato | Uso A-02 | Procedencia A-02 | Sensibilidad | Restricción |
| --- | --- | --- | --- | --- |
| Conteos de población | tarjetas e intersecciones | fixture local | agregado demo | no oficial; sin registros base |
| Cobertura | barra y porcentaje | fixture local | agregado demo | no fórmula productiva |
| Calidad administrativa | conteos/porcentaje | fixture local | agregado demo potencialmente sensible | sin drill-down ni edición |
| Zona y métricas | distribución territorial | fixture local | agregado demo | sin dirección/coordenadas |
| Alertas | gestión territorial | fixture local | agregado demo | no clínica ni inferencia |
| Referencia territorial futura | interoperabilidad conceptual | contrato frontend | contextual | ID normalizado; no texto libre único |
| Referencia financiera futura | trazabilidad conceptual | contrato opcional | financiera | sin montos ni atribución inventada |

- **Propietario/custodio productivo:** por definir según tenant, municipio, institución, programa y fuente.
- **Entradas A-02:** configuración TypeScript ficticia.
- **Salidas A-02:** HTML accesible agregado; ningún dato se envía o persiste.
- **Retención A-02:** ninguna.
- **Datos prohibidos:** nombres, identificadores personales, documentos, teléfonos, correos, direcciones exactas, coordenadas individuales, HCE, diagnósticos, medicamentos, mediciones, notas/comentarios individuales y detalle clínico.
- **Pruebas:** solo datos ficticios; nunca datos reales de pacientes o cuidadores.

## 13. Privacidad, seguridad y auditoría

1. Alcaldía no puede ver nombres ni abrir fichas individuales desde estas vistas.
2. No se renderizan identificadores, atributos ocultos, tooltips, labels accesibles, URLs ni payloads con información nominal o clínica.
3. No existe acceso indirecto mediante links, botones, búsqueda, exportación o filas seleccionables.
4. La agregación no equivale por sí sola a anonimización irreversible. Una capacidad productiva futura debe aplicar mínimo necesario y protección frente a grupos pequeños.
5. El umbral de supresión/generalización para grupos pequeños no se inventa en A-02; es una decisión material previa a datos reales.
6. No hay llamadas de red, almacenamiento, cookies, telemetría ni logs del contenido.
7. No se implementa auditoría persistente. En una versión productiva deberán auditarse consulta sensible, cambio de filtros/contexto, exportación y acceso denegado según riesgo, minimizando valores.
8. Las respuestas productivas futuras deben aplicar aislamiento por tenant, institución y municipio en API/repositorio/datos, no solo en UI.

## 14. Integraciones y fallas

- A-02 no consume ni simula integraciones.
- Los literales `Proyección oficial`, `RLCPD`, `municipio y la red`, `EPS` o `ELÍGEME` no prueban conexión ni oficialidad.
- No se añade loading, error de red, estado vacío remoto o sincronización falsa.
- Un contrato futuro deberá distinguir fuente, modalidad manual/importada/integrada, fecha, versión, estado de sincronización, último éxito/error, reconciliación y limitaciones.
- Si implementar estas vistas exige backend, fuente real, integración o contrato API, Claude Code debe detener esa parte: A-02 solo autoriza fixtures locales.

## 15. Accesibilidad, responsive y performance

1. Mantener un único `h1` enfocable por vista y jerarquía de headings lógica.
2. Usar semántica de lista o tabla apropiada para intersecciones, calidad y distribución territorial; la estructura debe conservar relaciones de encabezado/dato al hacer reflow.
3. El diagrama de intersecciones debe tener alternativa textual completa. Si es decorativo respecto de la lista, ocultarlo a tecnologías de asistencia.
4. Las barras de cobertura exponen nombre y valor por texto/semántica; no dependen solo de ancho o color.
5. Las alertas administrativas tienen texto/número además de color.
6. Mantener foco visible, navegación por teclado y anuncio del cambio de vista de A-01.
7. Desktop `1340×900`, tablet `768×1024` y móvil `375×812` usan reflow. No crear drawer, hamburguesa ni navegación móvil alternativa.
8. No debe existir overflow horizontal de página, solapamiento, truncamiento de datos esenciales ni pérdida de orden. Una tabla/lista puede transformarse mediante el patrón visual compatible sin alterar contenido.
9. Verificar zoom/reflow al 200 %.
10. No añadir dependencias, imágenes, librerías de gráficos ni JavaScript innecesario. Las vistas son presentacionales y reutilizan la frontera cliente actual del shell.

## 16. Arquitectura frontend esperada

1. Crear componentes enfocados `MunicipalityPopulation` y `MunicipalityTerritory` dentro de la feature existente.
2. `MunicipalityShell` decide cuál vista montar; no debe acumular el markup interno de ambas pantallas.
3. `municipalityConfig.ts` conserva la fuente única tipada de fixtures y textos.
4. `municipalityViews.ts` reconoce `inicio`, `poblacion` y `territorio` como módulos con contenido propio.
5. Reutilizar `MunicipalitySidebar`, `MunicipalityTopbar`, `MunicipalityIcon`, branding, tokens y CSS Module existentes.
6. No crear rutas nuevas, layouts, context, store, cliente API, modelo Prisma o abstracción compartida con Hospital.
7. No importar componentes `Hospital*` ni modificar Hospital.
8. Los contratos de escalabilidad no deben convertirse en arquitectura especulativa extensa; limitarse a los campos necesarios para documentar territorio, procedencia y vínculo financiero futuro.

## 17. Archivos permitidos

Allowlist máxima; Claude Code debe usar el subconjunto mínimo:

- `apps/web/src/features/municipality/MunicipalityPopulation.tsx` — nueva vista Población.
- `apps/web/src/features/municipality/MunicipalityTerritory.tsx` — nueva vista Territorio.
- `apps/web/src/features/municipality/municipalityConfig.ts` — tipos, copy y fixtures centralizados.
- `apps/web/src/features/municipality/municipalityViews.ts` — marcar las dos vistas como implementadas.
- `apps/web/src/features/municipality/MunicipalityShell.tsx` — montar las dos vistas dentro del shell.
- `apps/web/src/features/municipality/municipality.module.css` — estilos vinculantes y reflow.
- `apps/web/src/features/municipality/MunicipalityPopulation.test.tsx` — pruebas nuevas de Población.
- `apps/web/src/features/municipality/MunicipalityTerritory.test.tsx` — pruebas nuevas de Territorio.
- `apps/web/src/features/municipality/municipalityViews.test.ts` — actualizar expectativa de módulos implementados.
- `apps/web/src/features/municipality/municipalityShell.test.tsx` — navegación/montaje y regresión de estados próximos.

No es necesario modificar `apps/web/src/app/municipality/page.tsx`, `MunicipalitySidebar.tsx`, `MunicipalityTopbar.tsx`, `MunicipalityHome.tsx`, `MunicipalityComingSoon.tsx`, `MunicipalityIcon.tsx` ni `municipalityTestUtils.ts`. Si se vuelve indispensable tocar uno, Claude Code debe justificarlo en el handoff y limitar el cambio a compatibilidad técnica de A-02. Cualquier archivo fuera de `apps/web/src/features/municipality/**` exige parada y revisión de alcance.

## 18. Archivos y áreas prohibidos

- `prototype-claude/**`
- `apps/web/src/features/hospital/**` y `/hospital`
- Paciente, Cuidador, Profesional e Inscripción
- backend/API
- `prisma/**`, migraciones y base de datos
- infraestructura, manifests, lockfiles y dependencias
- `AGENTS.md`, `CLAUDE.md` y documentación autoritativa
- cualquier operación de commit, push, merge, rebase, release o despliegue

Si surge una necesidad material fuera de la allowlist o se requiere modificar un área prohibida: **READY FOR CLAUDE: NO** para esa ampliación y retorno a Codex/Product Owner.

## 19. Criterios de aceptación

- **AC-01 Navegación:** Población y Territorio montan contenido propio dentro del shell y mantienen un solo item activo.
- **AC-02 Fidelidad Población:** título, descripción, secciones, orden, jerarquía y valores coinciden con el prototipo.
- **AC-03 Fixture población:** los siete indicadores objetivo y cobertura `37,5 %` coinciden exactamente y se identifican como demo.
- **AC-04 Deduplicación:** la suma programática de los siete segmentos exclusivos es `3.050`; el total único se muestra una vez y la aclaración permanece.
- **AC-05 Intersecciones:** se muestran las ocho filas textuales; el gráfico no sustituye la información accesible.
- **AC-06 No inferencia:** ninguna función deriva condiciones de edad, discapacidad o cuidado desde datos personales; todo es fixture explícito.
- **AC-07 Calidad:** se muestran los cinco indicadores exactos, administrativos, sin edición o drill-down.
- **AC-08 Fidelidad Territorio:** título, descripción, columnas, seis zonas, insight y valores coinciden con el prototipo.
- **AC-09 Privacidad territorial:** no aparecen direcciones exactas, coordenadas, nombres ni enlaces a personas.
- **AC-10 Modelo territorial:** tipos/configuración representan municipio → urbana/rural → barrio/vereda con referencia normalizada y padre, sin depender solo de texto libre.
- **AC-11 Brechas:** `alertas` e insight se describen como gestión administrativa demo; no existe diagnóstico, triaje ni riesgo clínico individual.
- **AC-12 Finanzas:** no se muestran montos ni se calcula/prorratea ejecución en estas vistas; el vínculo futuro es opcional y exige metodología.
- **AC-13 Procedencia:** fixtures, futuros agregados internos y fuentes oficiales permanecen diferenciados; no se afirma sincronización activa.
- **AC-14 Marca:** solo se muestra ELÍGEME/Elígeme; `MERDN` está ausente de UI visible y accesible.
- **AC-15 Datos negativos:** el HTML visible/accesible no contiene nombre de beneficiario, documento, teléfono, dirección individual, HCE, diagnóstico nominativo, nota clínica o detalle sensible.
- **AC-16 Sin backend:** no hay fetch, URL remota, API, storage, cookie, persistencia, integración o migración.
- **AC-17 A-01:** Inicio, selector, sidebar, topbar, accesos rápidos, foco y restantes estados próximos no regresan.
- **AC-18 Hospital:** código, render y pruebas Hospital permanecen sin cambios/regresión.
- **AC-19 Accesibilidad:** headings, listas/tablas, barras, estados, foco, alternativa de intersecciones y teclado cumplen §15.
- **AC-20 Responsive:** los tres viewports y zoom 200 % conservan contenido y uso sin overflow horizontal de página.
- **AC-21 Integridad:** diff limitado a la allowlist mínima; prototipo y áreas prohibidas intactos; sin dependencias.
- **AC-22 Calidad técnica:** lint, typecheck, build y suites relevantes pasan sin errores introducidos.

## 20. Pruebas requeridas

| ID | Tipo | Verificación |
| --- | --- | --- |
| T-01 | Navegación | Sidebar y acceso rápido de Inicio abren Población; sidebar abre Territorio; activo/foco correctos. |
| T-02 | Fixture | Siete tarjetas de población, valores, textos y cobertura exactos. |
| T-03 | Deduplicación | Los siete segmentos exclusivos suman 3.050 y coinciden con total único. |
| T-04 | Intersecciones | Ocho filas, orden, valores, aclaración y alternativa accesible. |
| T-05 | No inferencia | No existe función/regla que derive una condición de una persona; fixtures son declarativos. |
| T-06 | Calidad | Cinco métricas exactas; no botones, links, formularios o IDs de persona. |
| T-07 | Territorio | Seis zonas y cinco campos exactos por fila. |
| T-08 | Privacidad | Ausencia de nombre, documento, teléfono, dirección, coordenada, HCE y clínica individual. |
| T-09 | Modelo territorial | Contrato admite municipio, urbano/rural, barrio y vereda, ID estable y parent ID. |
| T-10 | Brechas | Alertas/insight son administrativos y demo; términos clínicos prohibidos ausentes. |
| T-11 | Finanzas | No hay montos, prorrateo o cálculo financiero; referencia futura no afirma atribución. |
| T-12 | Procedencia | Etiqueta demo visible y separación contractual de categorías/source/asOf/syncStatus. |
| T-13 | Periodo | Selector conserva cinco opciones y no recalcula los fixtures. |
| T-14 | Branding | ELÍGEME visible y ausencia visible/accesible de `MERDN`. |
| T-15 | A-01 | Inicio y módulos no implementados conservan contenido y navegación aprobados. |
| T-16 | Hospital | Suite Hospital existente pasa y sus archivos no cambian. |
| T-17 | Accesibilidad | Un h1, jerarquía, relaciones tabulares/listas, barras textuales, teclado y foco. |
| T-18 | Responsive visual | Capturas en 1340×900, 768×1024 y 375×812, más reflow/zoom 200 %. |
| T-19 | Integridad | Sin red/storage/integraciones; diff limitado; prototipo intacto; sin dependencias. |

Claude Code debe ejecutar y reportar como mínimo:

1. `npm.cmd run lint`;
2. `npm.cmd run typecheck`;
3. `npm.cmd run test --workspace @merdn/web`;
4. `npm.cmd run build:web`;
5. `npm.cmd run dev:web` y URL local exacta de `/municipality`;
6. revisión visual de ambas vistas en los tres viewports;
7. prueba manual de teclado, foco y zoom/reflow 200 %;
8. búsqueda negativa de datos prohibidos, `MERDN`, red y persistencia en la feature/render;
9. `git status --short` y diff exacto de archivos autorizados.

Una prueba no ejecutada se reporta como no ejecutada; nunca como aprobada. No se agregan dependencias para automatizar una comprobación que la infraestructura actual no soporte.

## 21. Evidencia requerida en el handoff

Claude Code debe devolver:

1. Task ID y estado real: implementada/verificada, parcial o bloqueada.
2. URL localhost exacta.
3. archivos creados/modificados y propósito; confirmación de cero eliminaciones, dependencias y cambios prohibidos.
4. matriz AC-01 a AC-22 con evidencia concreta.
5. comandos, salidas, fallos y pruebas no ejecutadas.
6. capturas de Población y Territorio en `1340×900`, `768×1024` y `375×812`.
7. comparación visual trazable con las líneas identificadas del `.dc.html`.
8. evidencia de teclado, foco, semántica, alternativa del diagrama, barras y zoom 200 %.
9. evidencia matemática del fixture de intersecciones y cobertura.
10. evidencia de ausencia nominal, dirección exacta, clínica, dinero atribuido, `MERDN`, red y persistencia.
11. evidencia de contrato territorial hasta barrio/vereda y separación de procedencia.
12. resultado de regresión de A-01 y Hospital.
13. `git status --short` y diff limitado a la allowlist.
14. supuestos, desviaciones, riesgos residuales, decisiones abiertas y STOP CONDITIONS.

El handoff no equivale a aceptación. Codex audita y el Product Owner acepta o rechaza.

## 22. Condiciones de parada

Claude Code debe detener la parte afectada y retornar a Codex/Product Owner si:

1. necesita modificar el prototipo o usar `.dc.html`/`support.js` como runtime;
2. necesita tocar Hospital, Paciente, Cuidador, Inscripción, backend, Prisma, migraciones o infraestructura;
3. necesita añadir dependencia, ruta o arquitectura global;
4. necesita inventar filtro visible, mapa, interacción, navegación o adaptación visual material;
5. necesita datos reales, API, integración, persistencia, autenticación o autorización;
6. necesita decidir identidad productiva, deduplicación, fuente oficial, fórmula de cobertura o categoría poblacional;
7. necesita decidir umbral de privacidad/grupo pequeño, regla de brecha, severidad o inferencia clínica;
8. necesita decidir catálogo geográfico maestro, precisión, geocodificación o dirección individual;
9. necesita mostrar o atribuir montos sin metodología financiera aprobada;
10. los fixtures no pueden mantenerse coherentes o contienen información real/sensible;
11. una prueba crítica falla o la fidelidad exige contradecir una decisión aprobada;
12. cambios ajenos se solapan con la allowlist y no pueden preservarse con seguridad.

Un defecto ordinario dentro del alcance no es condición de parada: debe corregirse y volver a probarse.

## 23. Compatibilidad, migración y rollback

- No hay migración, API ni compatibilidad de esquema.
- El cambio es aditivo dentro de la feature municipal existente.
- Mantiene los IDs `poblacion` y `territorio`, la ruta y el comportamiento local de A-01.
- Rollback conceptual: devolver esos dos IDs al estado próximo y retirar únicamente sus componentes/configuración/estilos/pruebas. Claude Code no ejecuta rollback ni borrado sin autorización.
- Hospital y demás experiencias permanecen intactos.

## 24. Decisiones, supuestos, riesgos y bloqueos

### 24.1 Decisiones aprobadas aplicadas

- diseño visual del prototipo sin rediseño ni mapa nuevo;
- Alcaldía sin nombres, ficha individual, dirección exacta ni clínica nominativa;
- datos agregados/anónimos y fixtures explícitamente demostrativos;
- territorio preparado hasta municipio, urbana/rural y barrio/vereda;
- deduplicación por persona y ocho segmentos del fixture;
- brechas exclusivamente administrativas;
- relación financiera solo con metodología válida y trabajo profundo en A-04;
- dependencia territorial de Paciente/Cuidador documentada, sin modificar formularios;
- reuso de `/municipality`, responsive A-01, marca ELÍGEME y prototipo protegido.

### 24.2 Supuestos controlados

- Todos los nombres territoriales, valores, porcentajes y referencias de fuente del prototipo son fixtures ficticios/controlados.
- Las `alertas` por zona son conteos administrativos demo porque así lo delimita la decisión del Product Owner.
- Los segmentos de intersección describen las 3.050 personas registradas/vinculadas del fixture, mientras que 8.142 es la población objetivo municipal deduplicada.
- Preparar el modelo/frontend significa tipos/configuración extensibles mínimos, no controles visibles, backend o esquema productivo.

### 24.3 Decisiones materiales pendientes

No bloquean A-02 porque A-02 usa fixtures y no las implementa:

1. fuente maestra y gobernanza del catálogo territorial;
2. reglas productivas de identidad, matching y deduplicación;
3. fuentes autorizadas, frecuencia, reconciliación y clasificación de cada indicador;
4. fórmulas de cobertura, integridad/calidad y metas;
5. umbrales y taxonomía de brechas administrativas;
6. umbral de grupos pequeños, supresión/generalización y reglas de exportación;
7. modelo definitivo de permisos municipales y cualquier caso excepcional nominal;
8. metodología de atribución población–territorio–programa–presupuesto–ejecución;
9. contrato API, filtros, paginación/drill-down y auditoría productivos;
10. captura territorial, precisión, retención y permisos en Paciente/Cuidador.

### 24.4 Riesgos residuales

- Los literales de “fuente oficial” del prototipo pueden confundirse con datos oficiales; se mitiga con rotulado demo y pruebas de no oficialidad/integración.
- Los agregados territoriales pueden reidentificar en grupos pequeños cuando existan datos reales; A-02 no usa datos reales y exige decisión de umbral antes de producción.
- El diagrama de intersecciones puede ser difícil en móvil o para lectores de pantalla; la lista textual completa es la representación canónica accesible.
- Los tipos futuros pueden confundirse con contrato productivo; comentarios y nombres deben señalar que son preparación frontend, no API/esquema definitivo.

### 24.5 Bloqueos actuales

Ninguno para el slice frontend demostrativo delimitado.

## 25. Definition of Done y gate

A-02 se considera implementada únicamente cuando ambas vistas son fieles, navegables, accesibles y responsive; fixtures y matemáticas son coherentes; privacidad, procedencia, límites clínicos y financieros se cumplen; A-01 y Hospital no regresan; las pruebas pasan; el prototipo y áreas prohibidas permanecen intactos; y Claude Code entrega evidencia completa para auditoría.

**READY FOR CLAUDE: SÍ**

Este gate autoriza exclusivamente a Claude Code a implementar y probar el alcance frontend demostrativo descrito en esta Task. No autoriza decisiones productivas pendientes, backend, datos reales, integraciones, cambios al prototipo, operaciones Git de escritura ni despliegue.
