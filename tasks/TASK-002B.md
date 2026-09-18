# MERDN Task Specification

## Identificación

- **Task ID:** TASK-002B
- **Título:** Ajuste mínimo de branding y Elí en inscripción
- **Estado:** APPROVED — READY FOR CLAUDE CODE
- **Prioridad:** HIGH
- **Dependencia:** implementación existente de TASK-002A
- **Autoridad:** instrucción expresa del Product Owner

## Objetivo

Aplicar únicamente dos correcciones visuales en la pantalla principal del Panel de inscripción ya implementado:

1. sustituir el personaje de Elí de la barra superior por el logo aprobado de corazón con tilde/check integrado; y
2. restaurar abajo a la derecha la burbuja flotante original de Elí, con su personaje, expresión y texto aprobados.

No se autoriza ningún otro cambio visual, funcional, textual, estructural ni técnico.

## Contexto y alcance

- **Pantalla afectada:** pantalla principal del Panel de inscripción y la misma barra/burbuja cuando se reutilizan dentro del flujo de inscripción.
- **Usuarios afectados:** personas que acceden al Panel de inscripción.
- **Datos, permisos, tenants y auditoría:** no cambian; esta tarea no crea, consulta, transforma ni persiste datos.
- **Backend, rutas e integraciones:** no afectados.
- **Dependencias nuevas:** prohibidas.
- **Prototipo:** referencia visual de solo lectura; no se importa ni ejecuta como código de producción.

## Referencias vinculantes identificadas

### Logo aprobado

- **Asset de producción existente:** `apps/web/public/brand/corazon-check.png`.
- **Componente existente:** `apps/web/src/components/ui/BrandLogo.tsx`.
- **Procedencia documentada por el componente:** recorte fiel del lockup aprobado en `prototype-claude/ref/personaje2.png`, sin redibujo ni reinterpretación.
- **Uso obligatorio:** reutilizar el asset y componente existentes. No crear, recortar, recolorear, reemplazar ni reinterpretar el logo.

### Burbuja original de Elí

- **Referencia de composición y posición:** `prototype-claude/Eligeme-Inscripcion.dc.html`, especialmente el activador flotante inferior derecho de sus líneas 851–854.
- **Asset original del personaje:** `prototype-claude/assets/eli/saluda2.png`.
- **Copia de producción existente y verificada como idéntica:** `apps/web/public/eli/saluda2.png` (104 × 100 px; mismo SHA-256 que la referencia: `FC96FD75B493EE92749DFA67E90D11AA922A0F42C21C15B9EBBB353986EFCE75`).
- **Mapeo semántico existente:** intención `saluda` en `apps/web/src/components/ui/eliExpressions.ts`.
- **Componente flotante existente:** `apps/web/src/components/ui/EliBubble.tsx` y sus estilos actuales en `eliBubble.module.css`.
- **Composición vinculante:** activador tipo píldora blanco, con sombra, personaje a la izquierda, texto a la derecha y posición fija inferior derecha, conforme a la referencia original.
- **Texto visible requerido por el Product Owner:** exactamente `¡Hola! Soy Elí`.

La instrucción de TASK-002B sustituye únicamente, para la burbuja de inscripción, la elección anterior de la expresión `pregunta` y el texto `¡Hola, soy Elí!`. No altera las expresiones de Elí en otras superficies.

## Requisitos funcionales y visuales

### FR-01 — Barra superior

1. Eliminar únicamente de la barra superior el avatar/personaje de Elí que actualmente usa la intención `escucha`.
2. Mantener el logo aprobado de corazón con tilde/check integrado junto al nombre de la plataforma, usando `BrandLogo` y `/brand/corazon-check.png`.
3. Conservar sin cambios el nombre, subtítulo, colores, tipografía, tamaños, espaciado, fondo, bordes, jerarquía y disposición restante de la barra.
4. No mostrar ninguna imagen del personaje de Elí dentro de esa barra.

### FR-02 — Burbuja flotante

1. La burbuja debe permanecer en la parte inferior derecha y conservar la apariencia del activador original de `Eligeme-Inscripcion.dc.html`.
2. El activador debe usar la expresión original `saluda`, resuelta por el mapeo existente a `/eli/saluda2.png`.
3. Debe mostrar exactamente el texto `¡Hola! Soy Elí`.
4. No sustituir la burbuja por una tarjeta ni crear una variante visual nueva.
5. No cambiar la personalidad, los colores, las dimensiones, la sombra, el comportamiento responsive, la posición o el panel de ayuda existente, salvo lo indispensable para seleccionar la expresión y texto específicos de inscripción.
6. Cualquier parametrización de `EliBubble` debe ser mínima, tipada, conservar el comportamiento actual por defecto y no producir cambios visuales o de contenido en otros consumidores, incluido Inicio del Paciente.

### FR-03 — No regresión

Fuera de los dos cambios anteriores, el HTML renderizado, el flujo, los formularios, la validación, la navegación, la lógica, el responsive y la apariencia deben permanecer sin cambios.

## Archivos permitidos

Claude Code podrá modificar solamente los siguientes archivos, y únicamente si el cambio resulta indispensable para implementar o verificar estos dos ajustes:

- `apps/web/src/features/inscripcion/InscripcionExperience.tsx` — retirar el avatar de la barra y configurar la burbuja de inscripción con la expresión/texto aprobados.
- `apps/web/src/components/ui/EliBubble.tsx` — admitir, de forma mínima y compatible, la configuración específica del activador de inscripción.
- `apps/web/src/components/ui/EliBubble.test.tsx` — verificar compatibilidad por defecto y configuración específica, si se modifica el componente.
- `apps/web/src/app/page.test.tsx` — verificar la pantalla principal, el logo, la ausencia del personaje en la barra y la burbuja original.
- `apps/web/src/features/inscripcion/pantallas.test.tsx` — ajustar exclusivamente las aserciones afectadas por la expresión restaurada y comprobar no regresión en el flujo de inscripción.

No se autoriza modificar CSS: los estilos existentes ya contienen la posición y apariencia requeridas. Si Claude Code determina que un cambio CSS es imprescindible, debe detenerse y reportarlo como bloqueo; no debe ampliar el alcance por su cuenta.

Toda ruta no listada queda prohibida.

## Archivos y áreas prohibidos

- `prototype-claude/**`
- `docs/**`
- `agents/**`
- `tasks/**`
- `reviews/**`
- `AGENTS.md`
- `CLAUDE.md`
- cualquier archivo de backend, ruta, configuración, dependencia, lockfile o infraestructura
- cualquier archivo de `apps/web/**` no incluido expresamente en **Archivos permitidos**

Claude Code no debe crear, eliminar ni renombrar archivos; no debe hacer commit, push, merge, rebase ni pull request.

## Fuera de alcance

- Formularios, campos obligatorios y validaciones.
- DIVIPOLA y Diagnósticos.
- Inicio del Paciente.
- Textos distintos del texto del activador indicado.
- Colores, tipografía, tamaños, layout general y responsive existente.
- Navegación, rutas, estado, lógica, backend o persistencia.
- Refactors, limpieza de código o cambios de comentarios no indispensables.
- Dependencias o assets nuevos.
- Cambios al panel expandido de ayuda de Elí.

## Restricciones de seguridad, privacidad e institucionales

Esta tarea es exclusivamente visual y no afecta autenticación, autorización, aislamiento institucional, información clínica, datos personales, auditoría, FURAG/MIPG, ADRES, Sentencia T-319 de 2025, SENA, evidencias, indicadores, presupuestos, movimiento financiero ni capacidades comerciales hospitalarias. No debe introducir comportamiento relacionado con esas áreas.

## Criterios de aceptación

1. **AC-01:** el frontend inicia correctamente con el comando existente del proyecto.
2. **AC-02:** la barra superior muestra `/brand/corazon-check.png` mediante el componente aprobado.
3. **AC-03:** la barra superior no contiene el avatar/personaje de Elí ni la imagen `/eli/escucha.png`.
4. **AC-04:** el activador flotante aparece abajo a la derecha con `/eli/saluda2.png` y el texto exacto `¡Hola! Soy Elí`.
5. **AC-05:** la burbuja conserva la composición visual original y no se sustituye por una tarjeta.
6. **AC-06:** el panel expandible y su accesibilidad existente (`aria-expanded`, `aria-controls` y cierre con Escape) no se degradan.
7. **AC-07:** no existe ninguna otra diferencia visual o funcional respecto del estado anterior.
8. **AC-08:** no se modificó ningún archivo fuera de la lista permitida y no se añadió ninguna dependencia o asset.

## Pruebas requeridas

La verificación queda limitada a:

1. iniciar el frontend con el comando ya definido por el proyecto y confirmar que no presenta error de arranque;
2. ejecutar las pruebas frontend existentes directamente afectadas por los archivos permitidos;
3. comprobar visualmente la pantalla principal en un viewport representativo existente:
   - logo correcto en la barra;
   - ausencia del personaje de Elí en la barra;
   - burbuja original abajo a la derecha;
   - personaje `saluda2.png` y texto exacto;
   - ausencia de cualquier otra diferencia visual;
4. revisar `git diff --` limitado a los archivos autorizados y `git status --short` para demostrar que Claude Code no tocó otras rutas.

No se autorizan cambios para corregir fallos preexistentes o no relacionados. Cualquier fallo ajeno debe reportarse sin modificar su código.

## Condiciones de parada

Claude Code debe detenerse y reportar un bloqueo si:

1. necesita modificar un archivo no permitido, incluido cualquier CSS;
2. no puede usar los assets existentes identificados;
3. implementar el cambio alteraría otra pantalla o consumidor;
4. encuentra ambigüedad que implique cambiar colores, tamaños, layout, responsive, lógica o texto no autorizado;
5. las pruebas revelan un fallo no relacionado que exigiría ampliar el alcance.

## Evidencia de entrega requerida

Claude Code debe devolver a Codex:

1. lista exacta de archivos modificados;
2. confirmación de que `/brand/corazon-check.png` se muestra en la barra y Elí ya no aparece allí como personaje;
3. confirmación de que la burbuja usa `/eli/saluda2.png`, el texto `¡Hola! Soy Elí` y la posición inferior derecha;
4. comandos ejecutados y resultados de arranque y pruebas;
5. evidencia visual comparativa limitada a los dos cambios;
6. confirmación de que no se modificaron dependencias, assets, CSS, otras pantallas, flujos, textos ni funcionalidades;
7. bloqueos, fallos preexistentes o riesgos residuales.

El handoff no constituye aceptación. Codex debe auditar la implementación y el Product Owner conserva la decisión final.
