# MERDN Task Specification

## Task Identification

- **Task ID:** TASK-002
- **Title:** Reconstruir fundación visual y primer flujo aprobado de MERDN
- **Status:** APPROVED — READY FOR CLAUDE CODE
- **Priority:** HIGH
- **Created by:** Codex — MERDN Orchestrator, con revisión de los agentes 02, 09 y 07
- **Approved by:** Product Owner mediante decisión expresa: First Run 1a completo, Línea Visual B y exclusión de Inscripción

## Objective

Reemplazar la página técnica temporal creada en TASK-001 por la primera experiencia visual real de MERDN en Next.js App Router, reconstruida como código productivo moderno y fiel al diseño aprobado en `prototype-claude/`.

La tarea debe establecer la fundación visual reutilizable de MERDN e implementar completo el First Run 1a, desde `1a-01 Bienvenida` hasta `1a-16 Inicio`, usando `Eligeme-Linea-Visual-B.dc.html` como referencia visual principal. La experiencia será demostrativa: no habrá autenticación, persistencia, backend de inscripción ni integraciones reales.

`Eligeme-Inscripcion.dc.html` no forma parte de TASK-002: se conserva intacto como referencia para una futura ruta alternativa de registro directo. Claude Code no puede añadirlo después de First Run 1a, mezclar alternativas ni reinterpretar el recorrido aprobado.

Los nombres comerciales definitivos aún no están decididos. MERDN permanece como nombre técnico interno; los nombres visibles existentes en el prototipo y el nombre Elí se conservan provisionalmente. Su uso debe quedar centralizado para permitir un cambio futuro de nombre sin reconstruir las pantallas y sin alterar ahora el diseño aprobado.

## Business Context

### Hechos aprobados

1. TASK-001 dejó una página técnica temporal en la ruta principal; TASK-002 debe sustituirla por una experiencia real de MERDN.
2. `prototype-claude/` es la referencia UX/UI oficial, vinculante y de solo lectura.
3. La producción debe reconstruir la experiencia sin ejecutar, copiar como runtime ni construir alrededor de `.dc.html`, `support.js`, estado inline o datos demostrativos.
4. El stack frontend aprobado es Next.js App Router, React y TypeScript dentro de `apps/web`.
5. La revisión visual del Product Owner mediante una URL local es un gate obligatorio; una suite automatizada no sustituye esa revisión.

### Decisiones visuales resueltas por el Product Owner

- First Run 1a es el flujo oficial y debe reconstruirse completo.
- Línea Visual B es la referencia visual principal y prevalece para la fundación visual sobre la línea base y los colores anteriores del archivo funcional.
- `1a-16 Inicio` es el destino final aprobado de esta tarea y conserva su alcance exclusivamente visual/local.
- `Eligeme-Inscripcion.dc.html` queda excluido para evitar duplicar el registro y se reserva intacto para una futura ruta alternativa.
- Estas elecciones fueron clasificadas como `REQUIERE DECISIÓN PRODUCT OWNER` y quedaron resueltas. No existe `REQUIERE CLAUDE DESIGN` por ellas.

### Branding provisional

- **Nombre técnico interno:** MERDN. No sustituye automáticamente el nombre visible del producto.
- **Nombre visible de la plataforma:** conservar exactamente el nombre mostrado en First Run 1a y Línea Visual B mientras el Product Owner no apruebe otro.
- **Nombre visible de la IA:** Elí, con carácter provisional.
- Los dos nombres visibles deben definirse una sola vez en una configuración de branding tipada, reutilizable y agnóstica del flujo.
- Los componentes deben consumir esa configuración o props derivadas; no repetir literales de marca innecesariamente en múltiples componentes.
- Centralizar branding no autoriza a cambiar textos, logos, assets, composición, estilos o jerarquía del prototipo.

## Users Affected

- **Usuarios o roles:** visitante no autenticado que recorre First Run 1a. Las opciones visibles del prototipo no conceden permisos ni crean roles productivos.
- **Instituciones:** ninguna institución o tenant se crea ni se selecciona en esta tarea.
- **Impacto esperado:** el Product Owner puede recorrer y comparar la primera experiencia visual real de MERDN desde un navegador local.

## Modules Affected

- **En alcance:** fundación visual transversal basada en Línea Visual B; First Run 1a completo; `1a-16 Inicio`; presencia visual y ayuda local de Elí según esas referencias.
- **Relacionados, sin implementación productiva:** personas, identidad y relaciones; accesibilidad; experiencia de paciente, cuidador o profesional.
- **No afectados:** todos los módulos backend, clínicos, institucionales, regulatorios, documentales, financieros, comerciales, de agenda, integraciones, autorización, auditoría y multi-tenancy.

## Binding Visual Inventory

### First Run — `prototype-claude/Eligeme-First-Run.dc.html`

El Product Owner seleccionó First Run 1a como única alternativa en alcance:

- **1a — “Paso a paso con Elí”, 390 × 844, 16 pantallas:** `1a-01 Bienvenida`; `1a-02 Rol`; `1a-03 Mi situación`; `1a-04 Cuidador o profesional`; `1a-05 Cédula`; `1a-06 Cómo llegar`; `1a-07 Código`; `1a-08 Consentimientos`; `1a-09 Accesibilidad`; `1a-10 Diagnósticos`; `1a-11 Cuidador`; `1a-12 Semáforo`; `1a-13 Plan`; `1a-14 Primera bitácora`; `1a-15 Listo`; `1a-16 Inicio`.

First Run 1b y 1c están fuera de alcance. Los controles de navegación del canvas que permiten saltar entre propuestas no forman parte del producto.

### Inscripción — referencia excluida

`prototype-claude/Eligeme-Inscripcion.dc.html` no se reconstruye, no se enlaza y no se añade después de First Run 1a. Debe permanecer intacto como flujo existente para una futura Task Specification de registro directo alternativo.

### Lenguaje visual

- **Referencia visual principal vinculante:** `prototype-claude/Eligeme-Linea-Visual-B.dc.html`.
- **Tipografía común observada:** Nunito 400, 600, 700, 800 y 900; fallback `system-ui, sans-serif`.
- **Assets de Elí observados y reutilizables solo según pantalla aprobada:** `assets/eli/guia.png`, `explica.png`, `escucha.png`, `motiva.png`, `agradece.png` y `saluda2.png`.
- La paleta, jerarquía de botones, iconografía, radios, sombras, espaciados y densidad deben proceder de Línea Visual B. Claude Code no mezclará tokens de la línea base ni conservará colores anteriores cuando contradigan B.
- Los datos, reglas clínicas, promesas de funcionamiento offline, permisos, consentimientos, diagnósticos y estados de cuenta del prototipo son contenido demostrativo, no comportamiento productivo validado.

## Functional Requirements

1. **FR-01 — Entrada real:** `/` debe dejar de mostrar la página técnica de TASK-001 y abrir la primera pantalla de la variante First Run aprobada.
2. **FR-02 — Flujo exacto:** todas y solo las pantallas aprobadas deben ser alcanzables en el orden y las bifurcaciones definidos por la referencia, sin omisiones, reordenamientos ni pantallas inventadas.
3. **FR-03 — Fundación visual:** implementar tokens y primitivas reutilizables para tipografía, colores, espaciado, radios, sombras, botones, campos, cards, estados y estructura responsive requeridos por las pantallas en alcance.
4. **FR-04 — Fidelidad:** preservar copy, jerarquía, composición, controles, indicadores de progreso, estados seleccionados/no seleccionados, assets y poses de Elí, y navegación de la referencia seleccionada.
5. **FR-05 — Interacción local:** avance, retroceso, selección, expansión de ayuda y validación se ejecutan solo en memoria del navegador. No usar API, Server Actions, cookies, `localStorage`, `sessionStorage` ni base de datos.
6. **FR-06 — Sin Inscripción:** no crear `/inscripcion`, no reconstruir su wizard y no enlazarlo desde First Run 1a.
7. **FR-07 — Validación local:** reproducir los estados de selección, campos y validación visibles de First Run 1a usando únicamente reglas locales inequívocas; no inventar reglas clínicas, institucionales o regulatorias.
8. **FR-08 — Error recuperable:** todo error local aprobado debe ser visible, estar asociado al control, impedir el avance cuando corresponda y desaparecer o actualizarse al corregir la entrada.
9. **FR-09 — Loading:** no aplica porque esta tarea no realiza fetch ni otra operación asíncrona real; no simularlo.
10. **FR-10 — Final local:** `1a-16 Inicio` debe ser alcanzable y el flujo debe poder reiniciarse. No se enviarán datos ni se afirmará persistencia real.
11. **FR-11 — Elí:** Elí conservará su ubicación, pose, alt text, función visual y ayuda contextual aprobadas. No será diagnóstico, prescriptor, asistente clínico real, chatbot conectado ni servicio de voz.
12. **FR-12 — Navegación acotada:** crear únicamente la navegación necesaria para demostrar el flujo aprobado; enlaces a módulos fuera de alcance no deben simular funcionalidad.
13. **FR-13 — Sin falsas capacidades:** la UI no debe ejecutar ni afirmar autenticación, registro persistente, verificación profesional, envío de código, geolocalización, sincronización hospitalaria, historia clínica, alertamiento, guardado de bitácora, offline real o acceso a un Inicio productivo.
14. **FR-14 — Reinicio determinista:** el recorrido debe poder volver al estado inicial sin recargar datos persistidos, facilitando revisión y capturas repetibles.
15. **FR-15 — Branding centralizado:** definir una configuración tipada y reutilizable con, como mínimo, `platformDisplayName` y `aiDisplayName`. First Run 1a debe renderizar los nombres visibles provisionales desde esa fuente, sin duplicarlos como literales dispersos.
16. **FR-16 — Sustitución futura:** una prueba debe demostrar que cambiar los valores de branding modifica las apariciones de marca cubiertas sin cambiar la estructura de componentes, rutas o pantallas. Los textos donde el nombre forme parte de una frase deben componerse desde la misma fuente sin degradar gramática, acentos ni accesibilidad.

## Frontend Architecture

### Routes and layouts

- `apps/web/src/app/layout.tsx`: Root Layout como Server Component; idioma `es`, metadata, fuente y estilos globales.
- `apps/web/src/app/page.tsx`: Server Component que compone la entrada First Run aprobada.
- `apps/web/src/app/(onboarding)/layout.tsx`: shell visual compartido, solo si reduce duplicación real sin alterar el diseño.
- `apps/web/src/config/branding.ts` o ubicación equivalente dentro de `apps/web/src/config/`: configuración tipada, estática y no sensible para los nombres visibles provisionales.
- No crear rutas para Inicio productivo, portales, autenticación, callback, pacientes, cuidadores, profesionales, Hospital o Alcaldía.
- No crear `/inscripcion` ni deep links por paso. `1a-16 Inicio` forma parte del recorrido local en `/`, sin convertirse en un portal productivo.

### Components

Crear únicamente los componentes compartidos requeridos por First Run 1a:

- tokens CSS de tipografía, color, espaciado, radio y sombra;
- `PageShell`/shell móvil o de inscripción;
- `BrandHeader`;
- `Button` con las variantes aprobadas;
- `Card`;
- `Field`, `Label`, `Input`, `Select`, `Textarea` y `FieldError`;
- `RoleCard` o `ChoiceCard`, checkbox/radio/chip accesibles cuando aparezcan;
- `StepHeader`, `ProgressIndicator` y controles de paso;
- `InfoBanner`, `InlineAlert` o `StatusBadge` cuando aparezcan;
- `FormActions`;
- `EliAvatar`, `EliSpeech` y `EliFloatingHelp` según la referencia;
- `CompletionCard` únicamente si el flujo aprobado la contiene.

No crear un design system general, variantes sin consumidor ni abstracciones para futuros portales.

Los componentes de marca y de Elí deben recibir o consumir los nombres desde la configuración central. El archivo de branding no debe contener JSX, estado, lógica de navegación, secretos, configuración por tenant ni nombres de roles; solo valores de identidad visual provisional y tipos mínimos necesarios.

### Server/Client boundaries

- Layouts, metadata, composición de página y copy estático permanecen como Server Components.
- Solo el componente mínimo que controla wizard, elecciones, validación, avance/retroceso, reinicio o ayuda expandible usa `'use client'`.
- El estado es efímero mediante `useState` o `useReducer`. No usar store global ni cruzar datos personales al servidor.

### Styling and dependencies

- Usar CSS nativo existente, CSS Modules o la convención ya presente que permita fidelidad sin una dependencia nueva.
- Integrar Nunito mediante el mecanismo soportado por Next.js que se apruebe para el proyecto, con fallback disponible y sin depender del runtime de Claude Design.
- Reutilizar únicamente assets aprobados necesarios. No importar rutas de `prototype-claude/` en el build productivo ni ejecutar sus archivos.
- Mantener Next.js, React, TypeScript y Vitest existentes. No añadir UI kit, librería de formularios, state manager, carousel, runtime de canvas ni otra dependencia innecesaria.
- Si la línea aprobada exige iconos Lucide y el proyecto no dispone de ellos, Claude Code debe solicitar aprobación antes de añadir la dependencia o reconstruir un sistema alternativo.

## Data Requirements

| Dato | Uso | Propietario | Procedencia | Sensibilidad | Retención | Restricción |
| --- | --- | --- | --- | --- | --- | --- |
| Estado de navegación | Demostrar pasos | Navegador local | Interacción ficticia | INTERNAL técnico | Solo memoria; se pierde al reiniciar | No cookies/storage/API |
| Valores de formulario ficticios | Demostrar validación | Ninguna institución | Entrada del revisor | Puede asemejarse a PII | Solo memoria | No usar datos reales; no enviar ni registrar |
| Assets de Elí | Identidad visual | MERDN/prototipo autorizado | `prototype-claude/assets/eli/` | PUBLIC de marca | Archivo estático productivo autorizado | Copiar solo el asset necesario, no runtime |

- **Entradas:** selecciones y valores locales ficticios.
- **Salidas:** estados visuales, mensajes de validación y final demostrativo.
- **Datos prohibidos:** pacientes reales, documentos reales, teléfonos reales, correos reales, diagnósticos reales, consentimientos válidos, credenciales, tokens o identificadores institucionales.
- No registrar valores de formularios en consola, URL, analytics, logs o reportes de prueba.

## Permissions, Tenancy and Audit

- No se implementan autenticación, autorización, permisos, consentimientos efectivos, tenant, organización activa, relaciones, RLS ni auditoría de negocio.
- Una tarjeta de rol o pantalla visible es solamente UX local y no concede acceso.
- No crear guards, middleware o roles hard-coded que aparenten seguridad productiva.
- Los eventos locales de UI no se presentan como auditoría MERDN.

## Security and Privacy Requirements

1. No realizar solicitudes a endpoints de identidad, usuarios, registro, códigos, geolocalización, voz, clínica o integraciones.
2. No persistir datos del formulario ni incluir valores sensibles en URL, consola, storage, cookies o logs.
3. Usar exclusivamente datos ficticios en pruebas, capturas y recorridos.
4. Los mensajes de error deben ser locales, claros y no revelar stack ni configuración.
5. No incluir secretos ni variables frontend nuevas para esta experiencia.
6. No copiar lógica clínica, permisos, verificaciones, promesas offline ni decisiones institucionales desde el estado inline del prototipo.

## Accessibility Requirements

1. Un `main` y una jerarquía de encabezados coherente por pantalla.
2. Botones y enlaces nativos para acciones; `fieldset`/`legend` para grupos; labels visibles asociados a cada campo.
3. Orden de foco igual al orden visual, foco visible y operación completa por teclado.
4. Errores asociados mediante `aria-describedby`/`aria-invalid`, anunciados de forma accesible y no comunicados solo por color; mover foco al primer error cuando se intenta avanzar.
5. Progreso con texto “Paso X de Y” y estado actual programático.
6. Controles táctiles de al menos 44 × 44 CSS px, salvo que la referencia requiera elevar una decisión de diseño.
7. Alt text contextual para imágenes informativas de Elí; imágenes decorativas ignoradas por tecnología asistiva.
8. La ayuda expandible de Elí debe exponer estado, relación con su panel y retorno de foco.
9. Respetar `prefers-reduced-motion`; zoom de 200 % y reflow hasta 400 % sin pérdida de contenido o funcionalidad.
10. Aplicar mejoras semánticas sin alterar la presentación vinculante; cualquier conflicto material se reporta como STOP CONDITION para decisión del Product Owner.

## Responsive Requirements

- First Run se compara obligatoriamente a 390 × 844.
- First Run 1a se presenta centrado en viewports mayores, preservando la composición móvil y sin inventar una interfaz desktop distinta.
- En viewports adicionales acordados, usar reflow guiado por contenido: sin overflow horizontal de página, controles inaccesibles, clipping, solapamiento ni campos ocultos al recibir foco.
- Mantener orden, jerarquía, copy, protagonismo de Elí y acción principal.
- No crear composiciones desktop visualmente nuevas. Usar reflow técnico conservador: contenedor fluido hasta el ancho móvil aprobado, padding seguro y scroll vertical cuando resulte necesario.

## Loading, Error and Empty States

- **Loading:** no aplica sin operación asíncrona. Su apariencia no está diseñada.
- **Error:** únicamente los estados locales visibles de First Run 1a; no existe error remoto.
- **Empty:** no aplica; no hay colecciones ni datos remotos.
- No inventar skeletons, spinners, modales, toasts o páginas de error visuales.

## Regulatory and Evidence Requirements

| Área | Evaluación | Restricción |
| --- | --- | --- |
| FURAG/MIPG | NO AFECTA | No implementar pantallas, datos, fórmulas ni afirmaciones |
| ADRES | NO AFECTA | No implementar consulta, integración ni evidencia |
| Sentencia T-319 de 2025 | NO AFECTA | No interpretar ni automatizar obligaciones |
| SENA | NO AFECTA | No implementar formación, inscripción o certificación |
| Hub Institucional | NO AFECTA | Sin trabajo de dominio |
| Presupuesto y finanzas | NO AFECTA | Sin datos, cálculos ni flujos |
| Evidencias e indicadores | NO AFECTA | Las capturas de QA son evidencia técnica, no evidencia institucional |

## Hospital Commercial Impact

Agenda, servicios, visitas, consultas virtuales, membresías, pagos, ingresos y evidencia de prestación: **NO AFECTA**. Los textos o accesos que aparezcan en una pantalla de “Inicio” son visuales y no se vuelven funcionales.

## Allowed Files

Claude Code puede crear o modificar exclusivamente, y solo cuando sean necesarios para esta tarea:

- `apps/web/src/app/**` — rutas, layouts, estilos globales y pruebas de ruta.
- `apps/web/src/features/onboarding/**` — componentes y estado local del flujo aprobado.
- `apps/web/src/components/ui/**` — primitivas visuales realmente compartidas.
- `apps/web/src/config/**` — únicamente configuración tipada de branding provisional necesaria para TASK-002; no autenticación, entornos ni configuración institucional.
- `apps/web/src/styles/**` — tokens o estilos compartidos si la organización existente lo requiere.
- `apps/web/public/**` — copias de los assets exactos de Elí aprobados y necesarios; no otros materiales.
- `apps/web/tests/**` — pruebas frontend/E2E si esa ubicación se ajusta a la convención existente.
- `apps/web/package.json` y `package-lock.json` — únicamente si una dependencia fue expresamente aprobada; se prefiere no modificarlos.
- `apps/web/README.md` — solo instrucciones de ejecución y recorrido local de TASK-002.

Toda ruta no listada queda fuera de alcance.

## Forbidden Files

- `prototype-claude/**`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/**`
- `agents/**`
- `reviews/**`
- `tasks/**`, incluido `tasks/TASK-002.md` durante su ejecución
- `.git/**`, `main` y su historial
- `apps/api/**`
- `packages/**`
- `prisma/**`
- `tests/**` de raíz
- archivos raíz de configuración no incluidos en **Allowed Files**
- archivos `.env`, secretos, credenciales, migraciones, seeds o datos locales

No eliminar, renombrar, reescribir ni convertir archivos protegidos. No hacer commit, push, merge, rebase, pull request, release ni despliegue.

## Dependencies

### Functional

- TASK-001 implementada como fundación técnica.
- Decisión expresa del Product Owner: First Run 1a, Línea Visual B, `1a-16 Inicio` y exclusión de Inscripción.

### Technical

- Stack y scripts actuales de `apps/web`.
- Navegador local para revisión.
- No hay backend ni integración externa.

### Failure behavior

- Si aparece una contradicción no cubierta por las decisiones aprobadas, detener solo la parte afectada y solicitar decisión del Product Owner; no usar un placeholder inventado.
- Si una acción de la referencia necesita backend, conservar solo la apariencia aprobada cuando pueda demostrarse honestamente como estado local; nunca simular una respuesta remota.
- Si el estado final no puede evitar una afirmación falsa sin cambiar el diseño, detenerlo y solicitar diseño/copy aprobado.

## Approved Decisions

1. **AD-01:** reconstruir en Next.js, sin usar `.dc.html` ni `support.js` como runtime.
2. **AD-02:** sustituir la página técnica de TASK-001 en `/`.
3. **AD-03:** crear fundación visual reutilizable limitada al flujo elegido.
4. **AD-04:** toda interacción de formulario es local, efímera y sin persistencia.
5. **AD-05:** no implementar autenticación, usuarios, backend de inscripción, permisos, dominios productivos ni integraciones.
6. **AD-06:** revisión visual local del Product Owner es obligatoria antes de considerar la tarea terminada.
7. **AD-07:** `prototype-claude/` y todos los archivos prohibidos permanecen intactos.
8. **AD-08:** First Run 1a es el flujo oficial y se implementa completo, incluidas sus 16 pantallas y `1a-16 Inicio`.
9. **AD-09:** Línea Visual B es la referencia principal y prevalece sobre la línea base y la paleta anterior del flujo.
10. **AD-10:** `Eligeme-Inscripcion.dc.html` no se añade después de First Run 1a; permanece intacto para una futura ruta alternativa de registro directo.
11. **AD-11:** la selección de variante, línea visual y tratamiento de Inscripción fue una decisión del Product Owner y está resuelta; no requiere Claude Design.
12. **AD-12:** MERDN continúa como nombre técnico interno del proyecto; los nombres visibles existentes en el prototipo y Elí permanecen provisionales.
13. **AD-13:** el nombre visible de plataforma y el nombre visible de IA deben centralizarse en configuración frontend reutilizable para permitir su sustitución futura sin reconstruir pantallas.
14. **AD-14:** centralizar branding no autoriza cambios visuales, de copy o de assets respecto del prototipo aprobado.

## Resolved Decisions and Implementation Gate

| ID | Decisión resuelta | Autoridad | Resultado | Estado |
| --- | --- | --- | --- | --- |
| RD-01 | Seleccionar First Run | Product Owner | 1a completo, 16 pantallas | RESUELTA |
| RD-02 | Seleccionar línea visual y precedencia | Product Owner | Línea Visual B como referencia principal | RESUELTA |
| RD-03 | Definir tratamiento de Inscripción | Product Owner | Excluida; futura ruta alternativa | RESUELTA |
| RD-04 | Definir final del recorrido | Product Owner | Termina en `1a-16 Inicio` | RESUELTA |
| RD-05 | Definir responsive y loading sin inventar diseño | Task Specification | Reflow conservador; loading no aplica | RESUELTA |

No quedan decisiones materiales abiertas ni `REQUIERE CLAUDE DESIGN` antes de entregar TASK-002 a Claude Code. Cualquier nueva necesidad de diseño o producto descubierta durante la implementación será una STOP CONDITION nueva y no reabre silenciosamente estas decisiones.

## Out of Scope

- Autenticación real, recuperación, sesiones, OIDC y códigos reales.
- Base de datos o API de usuarios/inscripción.
- Roles, permisos, consentimiento efectivo, tenant isolation, RLS y auditoría.
- Pacientes, cuidadores, profesionales, Hospital o Alcaldía productivos.
- Diagnósticos, historia clínica, bitácora persistente, semáforo o reglas clínicas.
- FURAG, MIPG, ADRES, SENA y Sentencia T-319 de 2025.
- Wompi, WhatsApp, Google Calendar, HCE, voz, geolocalización o funcionamiento offline real.
- Agenda, citas, visitas, consultas virtuales, pagos, membresías y servicios.
- Backend funcional de inscripción y verificación profesional.
- `Eligeme-Inscripcion.dc.html`, su selector, sus tres ramas, sus cinco pasos y una ruta `/inscripcion`.
- First Run 1b y First Run 1c.
- Línea Visual base como fuente principal o mezcla de sus tokens con Línea Visual B.
- Nuevas pantallas, copy, navegación o componentes no presentes en el diseño elegido.
- Refactors del API, Prisma, shared packages, infraestructura o documentación autoritativa.
- Commit, push, merge, PR, release o despliegue.

## Acceptance Criteria

1. **AC-01:** el frontend inicia sin errores y `/` muestra `1a-01 Bienvenida`, no la página técnica de TASK-001.
2. **AC-02:** cada pantalla en alcance es alcanzable en el orden aprobado y no existe ninguna pantalla, bifurcación, CTA o copy inventado, omitido o reordenado.
3. **AC-03:** capturas lado a lado de las 16 pantallas coinciden con First Run 1a aplicando Línea Visual B en jerarquía, textos, tipografía, colores, tamaños, espaciados, radios, sombras, controles, progreso, assets y poses de Elí.
4. **AC-04:** los componentes compartidos y tokens se reutilizan sin homogeneizar diferencias legítimas ni importar `.dc.html`/`support.js` como runtime.
5. **AC-05:** avance, retroceso, elección, reinicio y ayuda local funcionan; no hay llamada a backend, persistencia, storage, cookie ni afirmación engañosa de cuenta creada/verificada.
6. **AC-06:** no existe ruta, enlace, componente o paso de `Eligeme-Inscripcion.dc.html`; el recorrido continúa exclusivamente por las 16 pantallas de First Run 1a.
7. **AC-07:** no se implementa loading donde no existe operación asíncrona ni diseño; todo estado visual adicional está aprobado.
8. **AC-08:** a 390 × 844 y en los viewports adicionales de QA no hay overflow horizontal de página, clipping, solapamiento, acción inaccesible ni foco oculto.
9. **AC-09:** en viewports adicionales aprobados, el reflow preserva orden, jerarquía, contenido, Elí y acción principal sin crear un layout nuevo.
10. **AC-10:** teclado, foco, nombres accesibles, labels, fieldsets, errores anunciados, contraste, reduced motion y zoom/reflow cumplen los requisitos de accesibilidad de esta tarea.
11. **AC-11:** no hay errores o warnings relevantes de consola durante el recorrido completo ni solicitudes de red fuera de los assets/build de la app.
12. **AC-12:** lint pasa.
13. **AC-13:** typecheck pasa.
14. **AC-14:** pruebas unitarias/de componente y E2E correspondientes pasan.
15. **AC-15:** build web de producción pasa.
16. **AC-16:** el diff contiene únicamente archivos permitidos; `prototype-claude/**`, archivos autoritativos, TASK-002 y demás archivos prohibidos permanecen byte-for-byte intactos.
17. **AC-17:** no se añadió una dependencia sin aprobación y no se introdujeron secretos ni datos reales.
18. **AC-18:** Claude Code inicia el frontend, entrega una URL `localhost` y un recorrido determinista para comparar todas las pantallas y estados en alcance.
19. **AC-19:** los agentes 02 y 07 registran la comparación como PASS o desviaciones explícitas; una desviación mayor impide aceptación.
20. **AC-20:** el Product Owner recorre la URL local y aprueba expresamente la fidelidad. Hasta entonces el estado máximo es `READY FOR REVIEW`, no completado ni `READY FOR COMMIT`.
21. **AC-21:** existe una única configuración tipada que expone el nombre visible provisional de la plataforma y el nombre visible provisional de la IA; los componentes no contienen repeticiones hard-coded innecesarias de esos nombres.
22. **AC-22:** cambiar los valores de branding en la prueba correspondiente actualiza las apariciones cubiertas sin modificar componentes, rutas, layout o estilos, y los valores predeterminados conservan exactamente los nombres visibles del prototipo.
23. **AC-23:** la configuración de branding no introduce secretos, variables de entorno, comportamiento por tenant, llamadas de red ni cambios visuales no aprobados.

## Required Tests

| Test ID | Tipo | Escenario | Resultado esperado | Evidencia requerida |
| --- | --- | --- | --- | --- |
| T-01 | Scope | Comparar estado/diff antes y después | Solo archivos permitidos; cero eliminaciones o cambios prohibidos | rama/commit base, `git status --short`, `git diff --name-status` y consulta de rutas prohibidas |
| T-02 | Runtime smoke | Iniciar frontend y abrir `/` | HTTP 2xx, entrada aprobada visible, página TASK-001 ausente | comando, URL, salida y captura |
| T-03 | Component/Unit | Avance, retroceso, selección y reinicio | Estado local determinista en cada pantalla aprobada | comando y assertions |
| T-04 | E2E | Recorrer cada pantalla y rama en alcance | Orden, copy y navegación exactos | assertions y capturas pantalla por pantalla |
| T-05 | Validation | Intentar avanzar vacío/inválido y corregir | Bloqueo, error visible/accesible y recuperación | assertions, foco y capturas |
| T-06 | Visual | Comparar referencia e implementación | PASS o registro de desviación por agentes 02/07 | pares de capturas/contact sheet por pantalla y viewport |
| T-07 | Responsive | 390×844; 680×900 si aplica; viewports aprobados | Sin overflow, clipping, solapamiento o controles inaccesibles | capturas y comprobación de overflow |
| T-08 | Accessibility | axe disponible + revisión manual teclado/zoom | Sin violaciones bloqueantes; recorrido usable | reporte y checklist manual |
| T-09 | Console/Network | Recorrido completo | Sin errores relevantes, APIs, storage o exposición de datos | captura/export de consola y red |
| T-10 | Static | Ejecutar lint | Exit 0 | comando y salida |
| T-11 | Static | Ejecutar typecheck | Exit 0 | comando y salida |
| T-12 | Test | Ejecutar suite frontend | Exit 0 | comando y salida |
| T-13 | Build | Compilar web | Exit 0 | comando y salida |
| T-14 | Isolation | Buscar imports/referencias runtime a prototipo | No `.dc.html`, `support.js` ni runtime Claude Design | comando y salida |
| T-15 | Product review | Recorrido en localhost contra prototipo | Decisión explícita del Product Owner | URL, instrucciones, referencias y resultado fechado |
| T-16 | Unit/Architecture | Sustituir nombres de branding en el entorno de prueba | Plataforma e IA muestran los valores sustitutos sin cambiar componentes o pantallas | test automatizado y salida |
| T-17 | Static/Scope | Buscar literales de nombres visibles fuera de la configuración y fixtures justificadas | Sin repeticiones hard-coded innecesarias; excepciones documentadas | comando, salida y revisión |

- Cualquier prueba no ejecutada se reporta `NOT RUN`, nunca PASS.
- Las pruebas usan solo valores ficticios y no requieren API, DB o servicios externos.
- Permisos, tenant isolation, auditoría, integraciones y regulación son no aplicables; se verifica su ausencia, no se crean pruebas ficticias.

## Visual Review Classification

- **PASS:** coincide en estructura, jerarquía, flujo, estados vinculantes, responsive y accesibilidad.
- **MINOR VISUAL DEVIATION:** diferencia localizada que no cambia marca, comprensión, navegación, acción principal, estado ni accesibilidad; debe documentarse.
- **MAJOR VISUAL DEVIATION:** omisión, mezcla o cambio de pantalla, copy, paleta, jerarquía, Elí, navegación, estado, responsive o accesibilidad; bloquea aceptación.
- Cualquier necesidad nueva de diseño o producto se detiene y escala; no constituye libertad de implementación ni altera las decisiones resueltas.

## Expected Handoff

Claude Code debe entregar a Codex:

1. Task ID, estado y resumen; nunca declarar completada antes de la revisión visual del Product Owner.
2. Rama y commit base, y tabla exhaustiva de archivos creados/modificados/eliminados con propósito.
3. Variante, línea visual, pantallas y ramas aprobadas, mapeadas a rutas y componentes.
4. Comando de inicio, requisitos, URL `localhost` exacta y recorrido determinista.
5. Cumplimiento AC-01 a AC-20 con evidencia individual.
6. Comandos, salidas y exit codes de T-01 a T-17; fallos y pruebas no ejecutadas.
7. Capturas comparativas de cada pantalla, estado y viewport aprobado.
8. Evidencia de consola, red, accesibilidad automática y revisión manual.
9. Confirmación de ausencia de backend, autenticación, persistencia, storage, integraciones y datos reales.
10. Dependencias/configuración afectadas y aprobación correspondiente, si existe.
11. Confirmación de que `prototype-claude/**`, `tasks/TASK-002.md` y todos los archivos prohibidos permanecen intactos.
12. Desviaciones, riesgos residuales, errores conocidos y cualquier STOP CONDITION nueva.
13. Resultado de revisión de agentes 02 y 07 y estado pendiente/obtenido de aprobación visual del Product Owner.
14. Ruta y contrato de la configuración de branding, nombres provisionales configurados y evidencia de T-16/T-17.

El handoff inicia la auditoría de Codex. No autoriza commit, integración ni despliegue.
