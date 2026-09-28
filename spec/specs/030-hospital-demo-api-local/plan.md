# Plan NNN - Nombre

## Resumen

Construir un proveedor de DTOs exclusivamente ficticios e inyectarlo solo desde
`/hospital`, sin tocar API, base de datos, autenticación ni servicios externos.

## Contexto técnico

Agenda, Pacientes y Profesionales consultan hoy datos institucionales. El shell
de `/hospital` ya tiene una sesión demostrativa efímera. La capa demo reutiliza
contratos de presentación, pero no clientes HTTP ni fuentes institucionales.

## Fases de implementación

1. Crear DTOs demo tipados con procedencia explícita y fábrica determinista.
2. Inyectar la fuente exclusivamente al montaje demo y señalizar procedencia.
3. Desactivar con explicación cualquier acción que escriba en modo demo.
4. Añadir pruebas de composición, no-red y separación; ejecutar build web.

## Dependencias

- Consentimiento SDD explícito de la Product Owner para esta spec 030.
- Contratos DTO existentes de Agenda, Pacientes y Profesionales.

## Hitos

- `/hospital` llena las tablas previstas con datos ficticios locales.
- Ninguna llamada de red ni mutación ocurre desde el modo demo.

## Riesgos

- Un DTO demo puede desviarse del contrato real; se mitiga con TypeScript y
  pruebas de composición.
- Una acción visual podría sugerir persistencia; se mitiga deshabilitándola y
  explicando el alcance en texto.
