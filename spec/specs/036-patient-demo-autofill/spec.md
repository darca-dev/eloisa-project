# Especificación 036 — Autocarga de pacientes demo en inscripción

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: `2026-09-23`
- Aprobado por / Approved by: Product Owner
- Evidencia: la Product Owner solicitó tres pacientes ficticios que se puedan
  cargar desde **Inscripción como paciente** para evitar diligenciar el
  formulario manualmente durante cada demostración.

## Objetivo

Permitir recorrer rápidamente el formulario existente de inscripción de
Paciente usando tres perfiles ficticios completos, sin contraseñas, credenciales
reutilizables ni datos de personas reales.

## Alcance

- En el paso **Datos personales** de la rama Paciente se muestran tres botones
  accesibles: `Paciente demo 1`, `Paciente demo 2` y `Paciente demo 3`.
- Cada botón carga valores ficticios y válidos para los cinco pasos del
  formulario actual, incluidos datos de contacto, ubicación, consentimientos y
  clasificación declarada.
- La selección solo actualiza el estado local del formulario. No envía, crea,
  inicia sesión ni persiste nada automáticamente.
- La acción final de inscripción conserva exactamente el comportamiento ya
  existente; si se usa, sigue bajo sus validaciones y respuesta de API local.

## Fuera de alcance

- Contraseñas, usuarios precreados, credenciales hardcodeadas, inicio de sesión
  o recuperación de acceso.
- Cambios en API, base de datos, sesiones, reglas clínicas, instituciones
  externas o `prototype-claude/`.

## Seguridad y datos

- Los tres perfiles deben declararse visualmente como ficticios y no pueden
  corresponder a una persona real.
- No se incluyen contraseñas ni secretos en código fuente.
- La autocarga no llama APIs ni guarda en almacenamiento del navegador.

## Accesibilidad

- Los botones usan texto visible, `type="button"` y un anuncio claro de que
  cargan información ficticia.
- El foco y las validaciones existentes del formulario permanecen intactos.

## Archivos permitidos

- `apps/web/src/features/inscripcion/InscripcionExperience.tsx`
- `apps/web/src/features/inscripcion/inscripcionFlow.ts`
- `apps/web/src/features/inscripcion/patientDemoFixtures.ts`
- `apps/web/src/features/inscripcion/*.test.ts`
- `apps/web/src/features/inscripcion/inscripcion.module.css`
- `spec/specs/036-patient-demo-autofill/**`
- `spec/specs/INDEX.md`
- `spec/.sdd/user-consent.log`

## Criterios de aceptación

1. CUANDO se muestra el primer paso de Paciente, EL SISTEMA DEBERÁ ofrecer tres
   perfiles demo ficticios.
2. CUANDO se selecciona un perfil demo, EL SISTEMA DEBERÁ rellenar todos los
   datos requeridos para recorrer los cinco pasos sin errores de campos vacíos.
3. EL SISTEMA NO DEBERÁ almacenar ni enviar datos hasta que la persona use la
   acción final existente de inscripción.
4. Las pruebas de los fixtures, interfaz, TypeScript y build DEBERÁN pasar.
