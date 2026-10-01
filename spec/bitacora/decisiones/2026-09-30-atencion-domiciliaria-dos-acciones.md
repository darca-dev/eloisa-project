# Decisión de producto — Atención Domiciliaria con dos acciones

- Fecha: 2026-09-30
- Actor: Product Owner
- Spec relacionada: `038-demo-funcional-accesos-ficticios`
- Estado: Aprobada

## Decisión

La portada `/` conserva las tres experiencias diferenciadas: Atención
Domiciliaria, Hospital y Alcaldía.

La entrada de Atención Domiciliaria mostrará exclusivamente dos acciones:

1. `Iniciar sesión`.
2. `Regístrate`.

No existirá una acción visible separada llamada `Solicitar acceso` ni un tercer
enlace a `Registro guiado` dentro de esta entrada. Registrarse equivale a enviar
automáticamente una solicitud de acceso pendiente al Hospital. La persona no
obtiene acceso hasta que el Hospital aprueba y completa la provisión.

La implementación reutiliza el formulario persistente de SPEC 038 y su endpoint
`POST /api/v1/access-requests`. No crea otra API, no duplica solicitudes y no
convierte el registro histórico `/inscripcion` en fuente de autoridad.

## Motivo

Para la persona usuaria, registrarse es una sola intención. La solicitud al
Hospital es una consecuencia automática del registro y no debe presentarse como
una tercera tarea que tenga que entender o ejecutar por separado.

## Evidencia de origen

Instrucción explícita del Product Owner en la sesión del 2026-09-30.
