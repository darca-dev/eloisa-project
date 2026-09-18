# MERDN Task Specification

## Task Identification

- **Task ID:** TASK-BRAND-01
- **Title:** Migración transversal de branding visible a Eloisa + Isa
- **Status:** APPROVED
- **Priority:** HIGH
- **Created by:** Codex, MERDN Lead Architect
- **Approved by:** Product Owner mediante instrucción expresa de BRAND-01

## Objective

Aplicar una única corrección transversal y estrictamente textual para que toda superficie actualmente implementada y visible de `apps/web` use **Eloisa** como nombre definitivo de la plataforma y **Isa** como nombre definitivo de la asistente virtual, sin exponer el nombre técnico confidencial MERDN, sin conservar el branding anterior y sin modificar rutas, diseño, navegación, funcionalidad ni lógica de la asistente.

## Business Context

La implementación mantiene una configuración central de branding, pero todavía declara los valores provisionales `ELÍGEME`, `Elí` y `Evidencia · Local · Inteligente`. También existen literales visibles fuera de esa configuración en metadata y en una ficha del Hospital. El Product Owner aprobó como identidad definitiva `Eloisa` + `Isa`, ordenó eliminar la frase «Evidencia Local Inteligente» de toda superficie visible y declaró MERDN como nombre exclusivamente interno/técnico.

Esta tarea corrige la causa real del fallo preexistente de `branding.test.tsx`; no se permite relajar, eliminar o exceptuar la prueba para ocultar los infractores.

## Authoritative Reviews and Agents Used

1. **01 — MERDN Orchestrator:** delimitación, consolidación, allowlist y gate de entrega.
2. **02 — UX/UI Fidelity Guardian:** revisión de fidelidad, superficies visibles, accesibilidad y riesgo de reflow.
3. **04 — Security & Access Guardian:** confirmación de ausencia de impacto en datos, permisos, tenants, auditoría, secretos e integraciones.
4. **07 — QA & Acceptance Agent:** reproducción del fallo preexistente y matriz de aceptación/pruebas.
5. **09 — Frontend Application Architect:** estrategia de centralización, metadata, componentes y frontera mínima de archivos.

## Observed Baseline

### Branding central existente

Sí. `apps/web/src/config/branding.ts` contiene `platformDisplayName`, `platformTagline`, `inscriptionSubtitle`, `aiDisplayName` y `platformNameInSentence()`.

### Superficies con branding antiguo visible

1. **Inscripción `/`:** el encabezado y la asistente consumen `ELÍGEME`, `Evidencia · Local · Inteligente` y `Elí` desde la configuración central. El título global del navegador declara directamente `MERDN — Inscripción`.
2. **Hospital `/hospital`:** el título del navegador declara directamente `Elígeme — Hospital`; shells y configuraciones consumen la marca central; la ficha de profesionales declara directamente `Fecha de inscripción en Elígeme`.
3. **Alcaldía `/municipality`:** metadata, identidad, sidebar, indicadores, procedencias y textos institucionales consumen la configuración central; no se observó literal productivo antiguo adicional que exija modificar código municipal.
4. **Paciente implementado:** la transición desde Inscripción y su burbuja consumen la configuración central; deben migrar transitivamente. No se modifica el prototipo.
5. **Asistente y accesibilidad:** nombre visible, presentación, encabezado, activador, texto alternativo y nombre accesible de cierre se componen desde `aiDisplayName`.

### Fallo preexistente reproducido

Comando de diagnóstico:

```text
npm.cmd run test --workspace @merdn/web -- --run src/config/branding.test.tsx
```

Resultado de línea base: **FAIL**, 1 de 6 pruebas falló. `T-17` reportó exactamente estos infractores:

- `app\\hospital\\page.tsx`
- `features\\hospital\\hospitalProfessionals.test.tsx`
- `features\\hospital\\hospitalProfessionalsConfig.ts`

BRAND-01 cubre este fallo y debe dejarlo resuelto corrigiendo literales y expectativas, no agregando excepciones.

## Users and Experiences Affected

- Personas en Inscripción.
- Pacientes en la experiencia ya implementada.
- Personal de Hospital o prestador que usa la experiencia Hospital.
- Personal municipal que usa la experiencia Alcaldía.
- Cualquier persona que perciba metadata, texto visible o nombres accesibles de estas superficies.

No cambian roles, permisos, instituciones, relaciones, tenants ni comportamiento funcional.

## Scope

### In Scope

1. Sustituir el nombre visible de plataforma por `Eloisa`, con esa capitalización exacta.
2. Sustituir el nombre visible de la asistente por `Isa`, con esa capitalización exacta.
3. Eliminar `Evidencia · Local · Inteligente` del panel de Inscripción y cualquier variante visible del antiguo eslogan; no crear reemplazo.
4. Corregir metadata visible de Inscripción, Hospital y Alcaldía para que resulte respectivamente:
   - `Eloisa — Inscripción`
   - `Eloisa — Hospital`
   - `Eloisa — Alcaldía`
5. Corregir el texto visible de profesionales del Hospital a `Fecha de inscripción en Eloisa`, compuesto desde la fuente central.
6. Actualizar pruebas y añadir una prueba enfocada de metadata para las tres rutas.
7. Verificar las superficies implementadas de Inscripción, Paciente, Hospital y Alcaldía, incluidos texto accesible, headers, sidebars y asistente existente.

### Out of Scope

- Renombrar repositorio, workspaces, packages, rutas, carpetas, archivos, namespaces, componentes, clases, variables, claves, assets o documentación histórica.
- Renombrar identificadores técnicos como `ExperienciaMerdn`, `Eli`, `EliBubble`, `eliExpressions`, `/eli/*.png`, `ELIGEME`, `merdn-sr-only`, variables CSS o variables de entorno `MERDN_*`.
- Modificar `prototype-claude/**`.
- Rediseñar layout, colores, tamaños, tipografía, navegación, jerarquía o personaje.
- Cambiar lógica, capacidades o proveedor de la asistente; implementar IA nueva.
- Cambiar backend, Prisma, migraciones, infraestructura, API, datos, autenticación, autorización, tenancy, auditoría o integraciones.
- Sustituir o eliminar usos legítimos de «Atención domiciliaria» como capacidad, servicio o `platformTagline`.
- Cambiar documentación, Tasks o Reviews internas únicamente por contener nombres históricos.

## Functional Requirements

1. **FR-01 — Fuente central:** `branding.platformDisplayName` debe ser exactamente `Eloisa` y `branding.aiDisplayName` exactamente `Isa`.
2. **FR-02 — Nombre en frase:** `platformNameInSentence()` debe producir exactamente `Eloisa`.
3. **FR-03 — Eslogan eliminado:** eliminar `inscriptionSubtitle` del contrato/configuración si deja de tener uso; Inscripción debe mostrar únicamente `Panel de inscripción`, sin `·` residual, string vacío, nodo accesible vacío ni nuevo eslogan.
4. **FR-04 — Inscripción:** `/` debe mostrar `Eloisa`; la asistente existente debe nombrarse `Isa`; no debe renderizar branding prohibido.
5. **FR-05 — Hospital:** `/hospital` debe mostrar `Eloisa`; su metadata y el campo de fecha de inscripción deben proceder de la fuente central; cualquier superficie existente de asistente debe usar `Isa`.
6. **FR-06 — Alcaldía:** `/municipality` debe mostrar `Eloisa` en identidad y textos ya centralizados; no se debe añadir una asistente donde no existe.
7. **FR-07 — Paciente:** la experiencia implementada debe recibir transitivamente `Eloisa`/`Isa`; no se cambia su flujo ni su lógica.
8. **FR-08 — Accesibilidad:** alt, nombres accesibles, texto para lector de pantalla y controles de la asistente deben decir `Isa` donde corresponda. No deben quedar separadores o nombres obsoletos invisibles visualmente pero anunciados.
9. **FR-09 — Metadata:** ningún título o descripción renderizada de las tres rutas puede exponer `MERDN` o branding anterior.
10. **FR-10 — Rutas:** conservar exactamente `/`, `/hospital`, `/municipality` y todas las demás URLs existentes.
11. **FR-11 — Fidelidad:** el diff productivo debe limitarse a strings, composición desde branding y retirada del subtítulo; no modificar CSS, assets, DOM estructural salvo la mínima retirada de contenido prohibido, navegación, estados o handlers.
12. **FR-12 — Centralización negativa:** no introducir literales duplicados innecesarios `Eloisa` o `Isa` fuera de la configuración y de pruebas que validen el contrato.

## Data, Permissions, Audit and Security

- **Datos:** no se crean, leen, modifican, persisten ni transmiten datos nuevos. Los valores de branding son strings públicos estáticos.
- **Propiedad/tenant:** no aplica; no introducir branding por tenant ni organización.
- **Permisos:** no cambian autenticación, autorización, guards, roles, visibilidad o denegaciones.
- **Auditoría:** no se requiere evento de auditoría por renderizar branding; no cambiar contratos o mecanismos existentes.
- **Seguridad y privacidad:** conservar el test que prohíbe dependencia de `process.env`, `fetch`, tenant, secretos o tokens. No añadir red, proveedor remoto, logging ni persistencia.
- **Datos reales:** no aplica y no se autorizan.
- **Integraciones/fallas:** no aplica; no activar OpenAI u otra integración por cambiar el nombre de la asistente.

## Regulatory, Institutional and Clinical Constraints

FURAG/MIPG, ADRES, SENA, Sentencia T-319 de 2025, indicadores, evidencia, presupuesto y movimientos financieros quedan estructuralmente intactos. Solo cambia la marca interpolada que ya consumen. No se modifican fuentes, fórmulas, periodos, procedencia, oficialidad, disclaimers, reglas clínicas o significado institucional.

## Visual and Accessibility Constraints

- La referencia visual aprobada permanece vinculante, pero `prototype-claude/**` es de solo lectura.
- Mantener logo, personaje, poses, assets, colores, tamaños, espaciado, layout y jerarquía.
- `Eloisa` tiene longitud y caja distintas de `ELÍGEME`; comprobar que no cause clipping, overflow o wrapping destructivo en móvil y escritorio.
- Mantener teclado, foco, `Escape`, `aria-expanded`, `aria-controls` y retorno de foco de la burbuja.
- No depender de color para comunicar estado y no alterar etiquetas ajenas al branding.
- Una clase como `merdn-sr-only` o una ruta `/eli/*.png` es técnica, no texto visible; no debe disparar un rename.

## Allowed Files

Solo se pueden crear o modificar los siguientes archivos:

1. `apps/web/src/config/branding.ts` — valores definitivos y retirada del subtítulo obsoleto.
2. `apps/web/src/config/branding.test.tsx` — contrato definitivo, sustitución estructural y búsqueda negativa robusta.
3. `apps/web/src/features/inscripcion/InscripcionExperience.tsx` — eliminar el eslogan y separador del panel sin rediseño.
4. `apps/web/src/app/layout.tsx` — metadata raíz centralizada.
5. `apps/web/src/app/page.test.tsx` — expectativas renderizadas de Inscripción/Paciente.
6. `apps/web/src/app/hospital/page.tsx` — metadata Hospital centralizada.
7. `apps/web/src/features/hospital/hospitalProfessionalsConfig.ts` — texto de inscripción compuesto desde branding.
8. `apps/web/src/features/hospital/hospitalProfessionals.test.tsx` — expectativa corregida desde la fuente central.
9. `apps/web/src/app/brandingMetadata.test.ts` — nueva prueba enfocada de metadata para `/`, `/hospital` y `/municipality`.

Toda ruta no listada está fuera de alcance. Si la implementación demuestra que un archivo adicional es materialmente necesario, debe detenerse y devolver **READY FOR CLAUDE: NO** con evidencia; no ampliar la allowlist silenciosamente.

## Forbidden Files and Actions

- `prototype-claude/**`
- `apps/api/**`
- `prisma/**` y `prisma.config.ts`
- migraciones
- Docker, Compose, infraestructura o despliegue
- `AGENTS.md`, `CLAUDE.md`, `docs/**`, `agents/**`, otras Tasks o Reviews
- assets de `apps/web/public/**`
- CSS y tokens visuales
- cambios de rutas o URLs
- dependencias o lockfiles
- commits, push, merge, rebase, PR, release o despliegue

## Approved Decisions

1. La plataforma se llama definitivamente `Eloisa`.
2. La asistente virtual se llama definitivamente `Isa`.
3. «Evidencia Local Inteligente» y su variante implementada con puntos medios se eliminan sin reemplazo.
4. MERDN permanece confidencial e interno/técnico; no se renombra internamente y nunca aparece al usuario.
5. Las rutas permanecen iguales.
6. No hay rediseño; el cambio es mínimo y textual.
7. El prototipo permanece sin modificaciones.

## Open Decisions

Ninguna decisión material pendiente. La instrucción de eliminar el eslogan sin reemplazarlo permite conservar el renglón existente como `Panel de inscripción`, sin separador residual. No requiere Claude Design.

## Acceptance Criteria

1. **AC-01:** la configuración central devuelve exactamente `Eloisa`, `Isa` y `Eloisa` en forma de frase.
2. **AC-02:** `inscriptionSubtitle` y su contenido anterior ya no forman parte del runtime ni del contrato de branding.
3. **AC-03:** `/` renderiza `Eloisa` e `Isa`, conserva el flujo actual y no renderiza ninguna cadena prohibida.
4. **AC-04:** `/hospital` renderiza `Eloisa`; la ficha profesional muestra `Fecha de inscripción en Eloisa`; no renderiza cadenas prohibidas.
5. **AC-05:** `/municipality` renderiza `Eloisa` mediante la fuente central y conserva navegación, privacidad y contenido institucional.
6. **AC-06:** metadata resulta exactamente `Eloisa — Inscripción`, `Eloisa — Hospital` y `Eloisa — Alcaldía`.
7. **AC-07:** donde existe la asistente, texto visible, alt y nombres accesibles dicen `Isa`; no se añade a superficies donde no existe.
8. **AC-08:** en texto visible, metadata y atributos accesibles renderizados no aparecen `Elígeme`, `ELÍGEME`, el antiguo nombre de asistente `Elí`, `ELI` cuando sea marca, `Evidencia Local Inteligente`, `Evidencia · Local · Inteligente` ni `MERDN`.
9. **AC-09:** no se agregan excepciones destinadas a permitir literales antiguos; el fallo preexistente de `branding.test.tsx` pasa por corrección de causa.
10. **AC-10:** las rutas `/`, `/hospital` y `/municipality` permanecen sin cambio.
11. **AC-11:** no cambia layout, CSS, colores, tamaños, navegación, jerarquía, comportamiento, lógica de Isa ni assets.
12. **AC-12:** no se modifica ningún archivo fuera de la allowlist y `prototype-claude/**` permanece intacto.
13. **AC-13:** suite web, typecheck, build, lint y `git diff --check` finalizan correctamente.
14. **AC-14:** revisión visual móvil/escritorio no encuentra clipping, overflow, wrapping destructivo o regresión atribuible al texto nuevo.

## Required Tests

| Test ID | Tipo | Escenario | Resultado esperado |
| --- | --- | --- | --- |
| T-01 | Unit | Contrato central de branding | `Eloisa`, `Isa`, sin subtítulo obsoleto; helper devuelve `Eloisa`. |
| T-02 | Unit/Source guard | Literales de marca centralizados | No hay literales antiguos renderizables ni duplicación innecesaria; no se exceptúan infractores. Comentarios, identificadores y assets técnicos se distinguen de UI. |
| T-03 | Component | Render de `/` | Eloisa e Isa presentes; cadenas prohibidas ausentes; opciones, navegación y estados siguen funcionando. |
| T-04 | Component | Experiencia Paciente implementada | Isa aparece en burbuja/alt/controles existentes y los assets `/eli/*` siguen funcionando sin rename. |
| T-05 | Component | Shell y vistas relevantes de `/hospital` | Eloisa presente, literal profesional corregido, negativos limpios y navegación sin regresión. |
| T-06 | Component | Shell de `/municipality` | Eloisa presente; negativos limpios; menú, periodo, privacidad y textos institucionales intactos. |
| T-07 | Unit/Integration | Metadata de las tres rutas | Títulos exactos aprobados y descripciones sin branding prohibido. |
| T-08 | Accessibility | Isa en contenido accesible | Alt, texto SR, cierre y activador usan Isa; teclado, foco y Escape no cambian. |
| T-09 | Negative render | HTML/texto/atributos orientados al usuario | No aparecen los siete patrones prohibidos; no se inspeccionan ingenuamente nombres de clases, imports o rutas técnicas. |
| T-10 | Regression | Suite web completa | Todas las pruebas existentes pasan; no hay cambio funcional fuera de copy. |
| T-11 | Visual manual | `/`, `/hospital`, `/municipality` en móvil y escritorio | No hay cambio de diseño, clipping, overflow o wrapping destructivo. |

### Verification Commands

Ejecutar desde la raíz del repositorio con `npm.cmd` en Windows:

```text
npm.cmd run test --workspace @merdn/web
npm.cmd run typecheck --workspace @merdn/web
npm.cmd run build --workspace @merdn/web
npm.cmd run lint
git diff --check
```

Además:

- abrir `/`, `/hospital` y `/municipality` en navegador;
- revisar texto visible, metadata y nombres accesibles;
- comprobar móvil y escritorio;
- inspeccionar el diff para confirmar allowlist, rutas intactas y cero cambios en archivos prohibidos.

## Migration, Rollback and Compatibility

- No hay migración de datos, esquema, API o infraestructura.
- El cambio es compatible con consumidores que importan la configuración central, excepto la retirada intencional de `inscriptionSubtitle`; todo consumidor de esa propiedad debe quedar eliminado dentro de la allowlist.
- Rollback técnico: revertir únicamente el diff de BRAND-01. Un rollback restauraría branding prohibido y solo puede hacerse por decisión expresa del Product Owner.

## Expected Handoff from Claude Code

Claude Code debe devolver:

1. resumen y estado de TASK-BRAND-01;
2. lista exacta de archivos creados/modificados y propósito;
3. evidencia por cada criterio AC-01 a AC-14;
4. comandos exactos, resultados, conteos de pruebas, fallos y pruebas no ejecutadas;
5. resultado del test preexistente `branding.test.tsx` antes/después;
6. evidencia renderizada de `/`, `/hospital` y `/municipality`, incluida metadata;
7. evidencia de revisión accesible y visual móvil/escritorio;
8. confirmación de rutas sin cambios y `prototype-claude/**` intacto;
9. confirmación de ausencia de cambios fuera de la allowlist;
10. riesgos, supuestos, desviaciones o STOP CONDITIONS.

## Risks and Controls

- **Reflow por longitud/caja:** validar móvil/escritorio; no compensar alterando diseño salvo nueva autorización.
- **Búsqueda negativa falsa:** `merdn-sr-only`, `Eli*`, `/eli/*`, `ELIGEME` y nombres internos pueden permanecer; evaluar texto/metadata/ARIA que llega al usuario.
- **Búsqueda negativa incompleta:** incluir mayúsculas, acentos y ambas variantes del eslogan.
- **Falsa centralización:** metadata y ficha profesional deben importar la fuente central, no duplicar `Eloisa`.
- **Regresión de Inscripción:** retirar contenido y separador, manteniendo la clase/jerarquía mínima sin string vacío anunciado.

## Gate

**READY FOR CLAUDE: SÍ.**

Fundamento: objetivo, nombres definitivos, eliminación requerida, rutas, límites visuales, allowlist, criterios y pruebas están aprobados; las revisiones 02, 04, 07 y 09 no identificaron decisiones materiales pendientes, necesidad de Claude Design ni bloqueo técnico. Este gate autoriza únicamente la implementación delimitada por esta Task y no autoriza commit, push, merge, release o despliegue.
