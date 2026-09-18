# Especificación 002 - Experiencia de inscripción y paciente (visual)

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specifications originales: `tasks/TASK-002.md`,
`TASK-002A.md`, `TASK-002B.md`. Auditoría: `reviews/REVIEW-002-FINAL.md`.
Congeladas y de solo lectura.

## Objetivo

Que una persona pueda completar la inscripción a MERDN desde el móvil guiada por
Elí, en un flujo por pasos accesible, y que un paciente inscrito tenga una
pantalla de inicio y una bitácora. Es la capa visual: la persistencia llegó
después, con la spec 007.

## Historia de usuario principal

Como cuidador, paciente o visitador que llega a MERDN desde el móvil, quiero un
formulario por pasos con lenguaje claro y acompañamiento, para inscribirme sin
perderme ni tener que interpretar terminología institucional.

## Qué hace hoy el sistema

- **Tres recorridos de inscripción diferenciados** según quién inscribe:
  `steps/PasosPaciente.tsx`, `steps/PasosCuidador.tsx`, `steps/PasosVisitador.tsx`.
- **Máquina de pasos** en `inscripcionFlow.ts` (1.315 líneas), separada de la
  vista: decide qué paso sigue, valida y acumula respuestas.
- **Elí como guía** con expresiones seleccionadas por contexto
  (`components/ui/eliExpressions.ts`, 7 imágenes en `public/eli/`) y burbuja de
  diálogo (`EliBubble.tsx`).
- **Shell de móvil** `PhoneShell.tsx` e indicador de progreso.
- **Catálogo territorial DIVIPOLA** en `data/divipola.ts` (1.281 líneas) para
  departamento y municipio, sin municipio piloto codificado.
- **Experiencia de paciente**: `InicioPaciente.tsx` y `BitacoraPaciente.tsx`,
  con su flujo en `bitacoraFlow.ts`.
- **Restauración de sesión** de la experiencia (`ExperienciaMerdn.tsx`,
  cubierta por `restauracionSesion.test.tsx`).

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | App Next.js, tokens, tsconfig, ESLint | Sin la app y su compilación no hay dónde renderizar la experiencia |

**Dependencias externas:** ninguna. Esta capacidad nació sin backend; funciona
íntegramente en el navegador.

**Specs que dependen de esta:** 006 (marca, que consolida Elí y el logotipo) y
007 (persistencia, que envía a la API lo que este flujo recoge).

## Escenarios de aceptación

1. Dado que alguien inicia la inscripción, cuando elige quién es (paciente,
   cuidador o visitador), entonces el flujo presenta los pasos correspondientes a
   ese rol y no los de otro.
2. Dado un paso con error de validación, cuando la persona intenta avanzar,
   entonces el error se comunica con texto, no solo con color.
3. Dado que la persona abandona y vuelve, cuando reabre la experiencia, entonces
   se restaura el punto donde estaba.
4. Dado un departamento elegido, cuando se despliegan municipios, entonces
   provienen del catálogo DIVIPOLA y no de una lista fija de un municipio piloto.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se seleccione un rol de inscripción, EL SISTEMA DEBERÁ presentar
  únicamente los pasos definidos para ese rol.
- CUANDO se muestre un estado de error, EL SISTEMA DEBERÁ comunicarlo con texto
  además de con color (`CLAUDE.md` §7.14).
- CUANDO se pida el municipio, EL SISTEMA DEBERÁ derivarlo del catálogo DIVIPOLA
  filtrado por el departamento elegido.
- SI la persona reabre la experiencia con una sesión previa, ENTONCES EL SISTEMA
  DEBERÁ restaurar su progreso en vez de reiniciarlo.

## Ámbito de archivos / File scope

- `apps/web/src/features/inscripcion/` — flujo, pasos y piezas
- `apps/web/src/features/paciente/` — inicio y bitácora
- `apps/web/src/features/experiencia/` — shell y restauración de sesión
- `apps/web/src/components/ui/` — Elí, burbuja, shell móvil, campos
- `apps/web/src/data/divipola.ts` — catálogo territorial
- `apps/web/public/eli/` — expresiones de Elí

## Estado real y límites conocidos

- Esta capacidad nació **sin backend**. La persistencia real llega con la
  spec 007 (`patientEnrollmentClient.ts`), posterior.
- La bitácora del paciente (`bitacoraFlow.ts`) **no tiene persistencia**: no hay
  ningún modelo de bitácora en `prisma/schema.prisma`.
- Elí es guía determinista de interfaz. No emite contenido clínico
  (`CLAUDE.md` §7.13).

## Criterios de éxito

- Los tres recorridos completan sin callejones sin salida.
- El catálogo territorial no contiene ningún municipio codificado como piloto.
- La suite de `features/inscripcion` y `features/paciente` pasa.
