# Revisión final — Alcaldía A-03 Programas

## 1. Identificación

- **Task:** `TASK-ALCALDIA-A-03`
- **Especificación:** `tasks/TASK-ALCALDIA-A-03.md`
- **Implementación revisada:** vista `Programas` dentro de `/municipality`, más el diálogo local `+ Nuevo programa`
- **Fuente visual vinculante:** `prototype-claude/Eligeme-Alcaldia.dc.html`, navegación (líneas 42–45), vista Programas (líneas 271–315) y fixtures (líneas 841–852)
- **Rama inspeccionada:** `develop`
- **Fecha de revisión:** 2026-08-21
- **Tipo de revisión:** final; código productivo en solo lectura, sin modificaciones ni operaciones Git

## 2. Estado

**IMPLEMENTADA Y VERIFICADA, SIN BLOQUEANTES, CON LIMITACIÓN DE EVIDENCIA VISUAL/INTERACTIVA NO BLOQUEANTE.**

La implementación cumple el alcance funcional de A-03: vista propia sobre el shell aprobado, cinco fixtures configurables, catálogo de poblaciones separado de la entidad Programa, relaciones múltiples programa–población y programa–ejecutor, catálogo cerrado de cinco estados, avance físico y financiero presentados juntos, resumen documental agregado, cierre preparado y alta local exclusivamente en `BORRADOR`. No se identificaron cambios fuera de la allowlist, dependencias nuevas, red, persistencia, lógica contable inventada ni exposición de datos personales.

Las validaciones exactas `1340×900`, `768×1024`, `375×812`, zoom/reflow 200 %, recorrido real de tabulado, `Escape`, devolución de foco y anuncio de la región viva **no fueron ejecutadas**. Por decisión expresa de la Product Owner quedan como **limitación de evidencia visual no bloqueante**, con el mismo criterio aplicado en A-01 y A-02; la Product Owner realizará la revisión visual normal en navegador.

## 3. Alcance y diff inspeccionado

Archivos modificados (6):

- `apps/web/src/features/municipality/MunicipalityShell.tsx`
- `apps/web/src/features/municipality/municipality.module.css`
- `apps/web/src/features/municipality/municipalityConfig.ts`
- `apps/web/src/features/municipality/municipalityShell.test.tsx`
- `apps/web/src/features/municipality/municipalityViews.test.ts`
- `apps/web/src/features/municipality/municipalityViews.ts`

Archivos nuevos (3):

- `apps/web/src/features/municipality/MunicipalityPrograms.tsx`
- `apps/web/src/features/municipality/MunicipalityProgramForm.tsx`
- `apps/web/src/features/municipality/municipalityPrograms.test.tsx`

Los nueve archivos pertenecen exactamente a la allowlist de §15. No hay archivos eliminados. `municipalityTestUtils.ts` fue reutilizado sin modificarse, como preveía la Task. El prototipo fue usado como referencia de solo lectura.

Verificación de áreas protegidas (`git status --short` acotado): `prototype-claude/`, `apps/web/src/features/hospital/`, `apps/web/src/app/hospital/`, Paciente, Cuidador, Inscripción, `apps/api/`, `prisma/`, `docs/`, `AGENTS.md`, `CLAUDE.md`, `package.json`, `package-lock.json` y `apps/web/package.json` **sin cambios**.

## 4. Verificaciones específicas solicitadas

### 4.1 Programa no está hardcodeado como una de las tres poblaciones — PASS

`MunicipalityPrograma` es una entidad propia. La pertenencia poblacional se expresa con `poblacionIds: readonly MunicipalityPoblacionBaseId[]`, y `MunicipalityPoblacionBaseId` es `string` **abierto**, no una unión cerrada de las tres poblaciones. El catálogo vive aparte, en `MUNICIPALITY_POBLACIONES_BASE`, y las etiquetas de presentación se resuelven por identificador.

Prueba de extensibilidad ejecutada: un programa con `poblacionIds: ['POBLACION_FUTURA']` y una entrada adicional en el catálogo se renderiza sin tocar tarjeta ni formulario.

Contraste deliberado y correcto: `origen`, `estado` y `tipo` de ejecutor **sí** son uniones cerradas, porque §7.3, §7.4 y §7.5 los declaran catálogos MVP exactos.

### 4.2 Los cinco fixtures no son los únicos programas posibles — PASS

`municipalityProgramasDemo` es un arreglo de configuración consumido por propiedades. Ningún nombre de programa ni de ejecutor aparece escrito dentro de `MunicipalityPrograms.tsx` ni de `MunicipalityProgramForm.tsx` (verificado por prueba automatizada sobre el código fuente). Sustituir la lista por otra configuración renderiza los programas nuevos y ninguno de los cinco iniciales.

### 4.3 `+ Nuevo programa` como frontend demostrativo — PASS

Diálogo `role="dialog" aria-modal="true"`, nombrado y descrito, con los diez grupos de campos mínimos, acciones `Cancelar` y `Crear borrador`, validación pura previa al alta y resumen de errores en región `role="alert"`. El alta agrega el borrador únicamente al estado en memoria de la vista. No hay `fetch`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, `document.cookie`, `sendBeacon`, URL, historial ni `FormData` en los archivos de A-03. El identificador del borrador es determinista (índice), sin `Date.now` ni `Math.random`.

### 4.4 Nuevo programa inicia BORRADOR — PASS

`formulario.estadoInicial` es `'BORRADOR'`; el campo «Estado inicial» es visible y `readOnly`; `crearProgramaBorrador` devuelve siempre `estado: 'BORRADOR'`; el diálogo no ofrece ningún control para elegir otro estado. El mensaje de confirmación declara literalmente que no fue aprobado, activado ni guardado y que desaparece al recargar.

### 4.5 Múltiples poblaciones y múltiples ejecutores — PASS

- Poblaciones: `Atención domiciliaria` declara las tres; `Cuidado en casa`, dos. Todas se muestran como lista de etiquetas.
- Ejecutores: `Adulto mayor` (Hospital/ESE + Fundación), `Discapacidad` (Hospital/ESE + Operador) y `Formación de cuidadores` (Otra entidad autorizada + Operador). Los cuatro tipos de participación están representados; todos los ejecutores se muestran con nombre y tipo.
- Ningún programa queda con colección vacía y ningún ejecutor está codificado como único.

### 4.6 Porcentaje físico y dinero/porcentaje financiero visibles juntos — PASS

Cada tarjeta presenta ambos bloques adyacentes:

- `Ejecución financiera 59 %` + `Presupuesto asignado: $680 M`, `Comprometido: $160 M`, `Ejecutado: $402 M`, `Disponible: $118 M`, `Moneda: COP`.
- `Cumplimiento físico 76 %` + `Meta: 540 personas`, `Atendidas: 412 personas`.

Nunca se muestra solo dinero ni solo porcentaje. La barra declara `role="progressbar"` con `aria-labelledby`, `aria-valuemin/max/now` y `aria-valuetext`, y el porcentaje sigue escrito como texto. Cuando el fixture no declara porcentaje (borrador local) no se dibuja barra y se lee `Sin registro`, que no equivale a cero.

### 4.7 No se inventó lógica contable A-04 — PASS

No existe aritmética sobre importes: la búsqueda de operadores, `parseInt`, `parseFloat`, `toFixed` y `Math.round/floor/ceil` en los dos componentes no arroja resultados. `comprometido`, `ejecutado`, `disponible` y los porcentajes son literales independientes del contrato de presentación; `comprometido` es `string | null` y solo se muestra cuando el fixture lo declara (rama nula probada con fixture ad hoc). El texto visible no contiene causación, obligación, pago, factura, proveedor ni calificación de eficiencia. Existe una nota explícita de que la pantalla no registra movimientos ni califica la ejecución, y el destino de la profundidad financiera queda tipado (`MUNICIPALITY_PROGRAMAS_DESTINO_FINANCIERO`) **sin control visible**, según la alternativa que autoriza FR-07.

Coherencia aritmética de los fixtures (declarada, no calculada), verificada manualmente por la revisión:

| Programa | Asignado | Comprometido | Ejecutado | Disponible | Suma | % declarado |
| --- | --- | --- | --- | --- | --- | --- |
| Atención domiciliaria | $680 M | $160 M | $402 M | $118 M | $680 M | 59 % |
| Adulto mayor | $420 M | $100 M | $248 M | $72 M | $420 M | 59 % |
| Discapacidad | $260 M | $60 M | $134 M | $66 M | $260 M | 52 % |
| Cuidado en casa | $150 M | $50 M | $68 M | $32 M | $150 M | 45 % |
| Formación de cuidadores | $70 M | $40 M | $18 M | $12 M | $70 M | 26 % |

Los cinco cuadran, y los porcentajes físicos, financieros y de cobertura son consistentes con sus valores absolutos. Además, los agregados de A-03 reconcilian con los titulares ya aprobados de A-01: asignado total `$1.580 M`, ejecutado total `$870 M` (55 %), evidencias registradas `232`, pendientes `18` y actividades `250`. La coherencia es una propiedad de los fixtures, no una regla productiva, y así está documentada en el código.

### 4.8 Privacidad — PASS

Solo agregados institucionales. Las búsquedas negativas sobre el texto visible y accesible de la vista y del shell no encuentran cédula, documento de identidad, NUIP, teléfono, correo electrónico, dirección, calle/carrera con número, diagnóstico, medicamento, historia clínica ni nota clínica; tampoco salario, honorario, nómina ni remuneración. No hay tabla, enlace, búsqueda de personas, exportación, descarga ni drill-down nominal. Las evidencias son conteos, no documentos. La aclaración de deduplicación está visible y las tarjetas no se suman para producir ningún total municipal (el componente no contiene `reduce` ni conversión numérica agregada).

### 4.9 No regresión A-01 / A-02 / Hospital — PASS

Suites de features completas: **25 archivos, 846 pruebas, todas en verde**, incluidas las suites de Hospital y las de Inicio, Población, Territorio, shell, vistas y privacidad municipal. Los módulos restantes conservan el estado neutro «Próximamente» y `programas` sale correctamente de esa lista.

El único fallo del repositorio es `src/config/branding.test.tsx`, que señala `app/hospital/page.tsx`, `features/hospital/hospitalProfessionals.test.tsx` y `features/hospital/hospitalProfessionalsConfig.ts`. Los tres archivos son idénticos a `HEAD` (no aparecen en el diff de A-03) y provienen del commit `e9d612b` (H-05): **fallo preexistente, ajeno a A-03**. Nota positiva colateral: esa misma prueba escanea todo `src/` y no señala ningún archivo de A-03, lo que confirma que A-03 no codifica literales de marca fuera de `config/branding.ts`.

### 4.10 Diff y allowlist — PASS

`git status --short` limitado a los nueve archivos autorizados. `git diff --check` sin errores de espacios. Cero dependencias nuevas: `package.json`, `package-lock.json` y `apps/web/package.json` sin cambios. Los dos componentes de A-03 no importan nada externo salvo `react` y no referencian `features/hospital`, `features/paciente` ni `features/inscripcion`.

## 5. Matriz de auditoría

| Área | Resultado | Evidencia |
| --- | --- | --- |
| AC-01 Fidelidad al prototipo | PASS | Título `Programas` y subtítulo exactos; lista vertical de tarjetas blancas con borde lateral de estado, badge en píldora, cuadrícula de seis datos y dos progresos paralelos. |
| AC-02 Navegación | PASS | `programas` en `MUNICIPALITY_MODULOS_IMPLEMENTADOS`; un solo `aria-current`; `h1` con `tabindex="-1"`; sin ruta, `href`, red ni almacenamiento. |
| AC-03 Fixtures | PASS | Cinco nombres exactos en orden; configuración sustituible; ningún nombre dentro de los componentes. |
| AC-04 Poblaciones | PASS | Tres poblaciones base exactas en catálogo separado; identificador abierto; programa con las tres. |
| AC-05 Deduplicación | PASS | Beneficiarios únicos por programa, aclaración visible, sin suma de tarjetas ni total calculado. |
| AC-06 Origen | PASS | Catálogo exacto de cuatro; los cuatro representados; formuladora y responsable independientes; fixture nacional y departamental sin afirmar integración. |
| AC-07 Ejecutores | PASS | Colección no vacía por programa; tres programas con dos ejecutores; cuatro tipos representados; Hospital no adquiere capacidad de creación. |
| AC-08 Estados | PASS | Catálogo cerrado de cinco; no aparecen los textos antiguos del prototipo; estado siempre escrito. |
| AC-09 Nuevo programa | PASS | Diálogo accesible con los diez grupos mínimos y dos acciones. |
| AC-10 Validación | PASS | Diez errores en formulario vacío, en orden de campo; presupuesto/meta no negativos; cero admitido; vigencia con fin anterior rechazada; origen fuera de catálogo rechazado. |
| AC-11 Memoria local | PASS | Borrador solo en memoria, anuncio explícito, sin aprobación, activación ni persistencia. |
| AC-12 Avance físico | PASS | Meta y resultado absolutos con unidad más porcentaje, con barra accesible. |
| AC-13 Avance financiero | PASS | Asignado, ejecutado, disponible, moneda y porcentaje juntos; comprometido solo cuando existe. |
| AC-14 Sin lógica financiera inventada | PASS | Sin aritmética, sin derivación de saldo ni porcentaje, sin semántica contable. |
| AC-15 Evidencia | PASS | Cuatro agregados documentales por tarjeta; ningún documento, archivo ni enlace. |
| AC-16 Cierre | PASS | Fixture `FINALIZADO` con los once datos; informe final `Pendiente`; sin generación ni cierre real. |
| AC-17 Privacidad | PASS | Búsquedas negativas de identidad, contacto, ubicación, clínica y compensación sin resultados. |
| AC-18 Procedencia | PASS | Todos los fixtures `FIXTURE_DEMO`, `asOf: null`, `SIN_INTEGRACION`; atribución con metodología en `null`. |
| AC-19 Marca | PASS | Marca pública desde configuración central; `MERDN` ausente del marcado; A-03 no aparece en el escaneo de literales de marca. |
| AC-20 Futuro privado | PASS | `organizacionId` obligatorio y `municipioId` anulable; sin condicional municipal en los componentes; sin UI ni copy comercial. |
| AC-21 A-01/A-02 | PASS | Suites municipales completas en verde; resto de módulos en «Próximamente». |
| AC-22 Hospital | PASS | Cero archivos Hospital modificados; suite Hospital en verde. |
| AC-23 Accesibilidad estructural | PASS | Un `h1` enfocable, un `h2` por programa, sin saltos de nivel, grupos nombrados, `progressbar` con nombre y valor, campos con `label`, errores asociados, diálogo modal con título enfocable y región `role="alert"`. |
| AC-24 Responsive | PASS por inspección estática | Reflow declarado a 900 px y 560 px: progresos y etiquetas se apilan, cuadrículas pasan a una columna, diálogo desplazable dentro del viewport. Validación visual exacta no ejecutada. |
| AC-25 Integridad | PASS | Diff limitado a la allowlist; áreas prohibidas intactas; cero dependencias. |
| AC-26 Calidad | PASS | Lint, typecheck y build sin errores; suites relevantes en verde. |

## 6. Pruebas ejecutadas por la revisión

| Comando | Resultado |
| --- | --- |
| `npm run lint` | PASS, sin hallazgos |
| `npm run typecheck` | PASS, cero errores |
| `npm run build:web` | PASS, `/municipality` compilada como estática |
| `npx vitest run src/features/municipality` | 7 archivos, **215 pruebas PASS** |
| `npx vitest run src/features` | 25 archivos, **846 pruebas PASS** (Municipality + Hospital) |
| `npm run test --workspace @merdn/web` | 897 PASS, 1 FAIL preexistente en `config/branding.test.tsx` (archivos Hospital de `e9d612b`) |
| `git status --short` | Nueve archivos, todos de la allowlist |
| `git diff --check` | PASS |
| `git status --short` sobre áreas protegidas | Sin cambios |
| Búsquedas negativas (red, storage, URL, reloj, azar, marca técnica, datos personales, términos A-04) | Sin resultados |

De las 89 pruebas específicas de A-03, se verificó su correspondencia con T-01 a T-25 de la Task.

**Pruebas NO ejecutadas** (declaradas como no ejecutadas, nunca como aprobadas):

- T-11 parcial: recorrido real de foco `Tab`/`Shift+Tab`, cierre con `Escape`, devolución de foco a `+ Nuevo programa` y desplazamiento del diálogo en móvil.
- T-12 parcial: anuncio efectivo de la región `role="status"` en lector de pantalla.
- T-24 completa: capturas en `1340×900`, `768×1024`, `375×812` y prueba de zoom/reflow al 200 %.

Causa: el repositorio no incluye jsdom ni driver de navegador y la Task prohíbe añadir dependencias para suplir esa limitación. Corresponden a la limitación visual no bloqueante acordada.

## 7. Desviaciones documentadas respecto de la Task

Ninguna incumple un requisito; se registran para trazabilidad.

1. **Composición de la cuadrícula de seis datos.** Se conserva el número y la forma de la cuadrícula del prototipo, pero su contenido cambia a `BENEFICIARIOS ÚNICOS`, `POBLACIÓN ATENDIDA`, `COBERTURA`, `TERRITORIO`, `VIGENCIA` y `ATENCIONES`/`CERTIFICADOS`. `ASIGNADO`, `EJECUTADO` y `DISPONIBLE` se trasladaron al bloque de avance financiero porque FR-06 exige presentar dinero y porcentaje juntos. Evita duplicar el mismo literal dos veces por tarjeta. Aceptable y coherente con FR-03 y FR-06.
2. **Estados representados entre los cinco fixtures visibles.** Aparecen `ACTIVO`, `SUSPENDIDO` y `FINALIZADO`. `BORRADOR` se demuestra mediante el alta local y `APROBADO` mediante el catálogo y una prueba que renderiza una tarjeta por estado. §22.2 recomienda —no exige— que los cinco estén «entre fixtures», y AC-08 solo exige que no aparezca ningún estado ajeno al catálogo. La decisión evita etiquetar como `BORRADOR` o `APROBADO` a un programa con ejecución en curso, que sería incoherente. **Requiere aceptación expresa de la Product Owner.**
3. **Comprometido declarado en los cinco fixtures.** Permite que asignado = comprometido + ejecutado + disponible cuadre en todos los casos. La rama «sin comprometido» exigida por AC-13 se verifica con un fixture ad hoc en pruebas.
4. **Nombres institucionales no municipales.** Se usan etiquetas explícitamente demostrativas («Entidad nacional formuladora (demostrativa)», «Gobernación departamental (demostrativa)», «Entidad de formación (demostrativa)») en lugar de entidades reales o de SENA, para no sugerir convenio, certificación ni adopción oficial. Más conservador que el mínimo exigido.
5. **Sin control «Ver presupuesto y evidencias».** Se aplica la alternativa que FR-07 autoriza expresamente: destino tipado y comentado, sin botón inerte en pantalla.
6. **Ejecutores por multiselección sobre catálogo demostrativo.** FR-08 admite «control local repetible o multiselección». Se eligió multiselección por simplicidad y accesibilidad. El catálogo productivo de organizaciones sigue siendo decisión pendiente (§22.3.4).

## 8. Hallazgos bloqueantes

**Ninguno.**

## 9. Hallazgos no bloqueantes

1. **Distribución de la fila de encabezado.** `.viewHeadRow` usa `justify-content: space-between` y `.viewTitle` no crece. Con tres elementos (título, etiqueta «Datos demostrativos» y `+ Nuevo programa`), la etiqueta queda repartida entre el título y el botón, mientras que en Población y Territorio —con dos elementos— queda pegada al borde derecho. Es una diferencia cosmética entre vistas municipales; no afecta jerarquía vinculante, semántica ni accesibilidad. Conviene confirmarlo en la revisión visual de la Product Owner y, si procede, corregirlo en una tarea posterior.
2. **Origen del borrador tomado del primer fixture.** `crearProgramaBorrador` copia `organizacionId` y `municipioId` de `config.programas[0]`, con valores de reserva. Es una heurística válida en un slice sin sesión ni contexto autenticado, pero el flujo productivo deberá tomar la organización propietaria del contexto autorizado, nunca del primer elemento de una lista. Registrar como requisito del contrato futuro.
3. **Confinamiento de foco basado en `keydown`.** El ciclo de foco se calcula al pulsar `Tab` y no hay `inert` ni `aria-hidden` sobre el contenido de fondo mientras el diálogo está abierto. `aria-modal="true"` está declarado y las tecnologías de asistencia modernas lo respetan. Verificar en la prueba manual de accesibilidad.
4. **Concentración de literales en `municipalityConfig.ts`.** El archivo supera las 1.800 líneas al incorporar tipos, catálogos, textos y fixtures de A-03. Cumple la arquitectura exigida por §14 (configuración centralizada, sin literales en componentes), pero conviene evaluar su segmentación por dominio antes de A-04.
5. **Fallo de branding preexistente.** `src/config/branding.test.tsx` sigue en rojo por tres archivos de Hospital ajenos a A-03. No es responsabilidad de esta tarea y debe resolverse en una tarea propia de Hospital.

## 10. Archivos fuera de alcance

**Ninguno.** El diff se limita exactamente a los nueve archivos de la allowlist de §15.

## 11. Dependencias nuevas

**Ninguna.**

## 12. Decisiones materiales que siguen pendientes

Se confirma que A-03 no las resuelve ni las anticipa silenciosamente: modelo persistente y jerarquía tenant–organización–municipio–programa; matriz de crear/aprobar/activar/suspender/finalizar/auditar; adopción de programas nacionales y departamentales; catálogo de organizaciones y términos de vinculación de ejecutores; contrato H-06B y visibilidad para Hospital/ESE; identidad y deduplicación productiva; elegibilidad e inscripción; fórmula, unidad, versión y gobernanza de metas, cobertura e indicadores; modelo financiero A-04; estándar y retención de evidencias e informe final; reglas de cierre y reapertura; umbral de grupos pequeños; taxonomía de auditoría; y modelo comercial privado futuro.

## 13. Conclusión

A-03 está **implementada, verificada y alineada con la Task y con el prototipo vinculante**. La decisión de la Product Owner de mantener el MVP simple —tres poblaciones prioritarias con posibilidad de incorporar programas nuevos— está correctamente reflejada: el catálogo de poblaciones es abierto y está separado de la entidad Programa, y los cinco fixtures son configuración sustituible, no una lista cerrada.

**READY FOR COMMIT: SÍ**, condicionado a que la Product Owner:

1. acepte expresamente la limitación de evidencia visual/interactiva no bloqueante, en los mismos términos de A-01 y A-02;
2. acepte la desviación 7.2 sobre los estados representados entre los cinco fixtures visibles.

El commit, la integración, el release y el despliegue requieren autorización independiente de la Product Owner conforme a §12 de `CLAUDE.md`.
