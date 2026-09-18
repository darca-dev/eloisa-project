# Decisión — Alcance del Paciente MVP

- **Fecha:** 2026-08-26
- **Decide:** Product Owner
- **Tipo:** decisión de **producto** (alcance)
- **Spec derivada:** `spec/specs/021-paciente-mvp-operativo/`
- **Hito objetivo:** 2 de septiembre de 2026

## Qué se decidió

El Product Owner aprueba el **alcance** del MVP de la experiencia de Paciente.

### Incluido

1. Acceso autenticado del Paciente.
2. Recuperación de sesión.
3. Logout real y revocable.
4. Resumen básico del paciente.
5. Consulta de **sus propias** citas.
6. Consulta de **sus propias** visitas.
7. Estados completos: `loading`, `empty`, `error`, `retry` y sesión expirada.
8. Autorización **self-scope**.
9. Tenant / RLS.
10. Auditoría.
11. Validación con datos **exclusivamente ficticios**: API, DB/RLS y
    runtime/navegador **cuando exista navegador controlable**.

### Fuera del MVP

No se implementan ahora: ayuda urgente; bitácora clínica; pagos; mensajes;
cuidador; consulta virtual; historia clínica; automatización clínica; y cualquier
capacidad demostrativa que no esté en el alcance aprobado.

Las funciones fuera del MVP deben quedar **fuera de la experiencia operativa** o
**no presentarse como funcionales**.

### Protección explícita

No se usan datos reales hasta el **hardening** y la **aceptación final**.

## Qué NO decide

- **No aprueba** la spec `021`. Su `Estado / Status` sigue en `Pendiente`.
- **No registra** el consentimiento SDD de implementación. Ese acto sigue
  pendiente y corresponde al Product Owner (`CLAUDE.md` §14.4).
- **No abre** la compuerta SDD y **no** autoriza escribir código.
- **No resuelve** ninguna de las diez decisiones de producto abiertas que la
  redacción de la spec dejó al descubierto (`spec.md` §17.B). Tres de ellas
  —mecanismo de sesión, camino de la inscripción a una cuenta autenticable, y
  ruta con su destino de retorno— bloquean toda la implementación.

## Por qué se registra aquí

`CLAUDE.md` §14.1 fija que las decisiones del Product Owner viven en
`spec/bitacora/decisiones/`. Esta es la decisión **de origen** de la spec 021: la
spec la transcribe en su §17.A y no la amplía.

## Consecuencias operativas registradas el mismo día

- Se creó la rama `feat/paciente-mvp-20260826` desde `develop` sincronizada
  (`ad25520`), sin tocar ni integrar `feat/visitador-mp02-corrections`.
- Visitador sigue en `048ba94`, sincronizada, con la spec 019 en
  `BLOCKED_BROWSER_ACCESS` y **sin integrar** en `develop`.
- Se creó la spec **021** —y no la 019— porque los identificadores 019 y 020 ya
  están ocupados en la rama de Visitador.
- **Cero código, cero dependencias, cero cambios de esquema, cero commits.**
