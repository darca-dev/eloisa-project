# Registro inicial único del administrador institucional

Fecha: 2026-10-12. Autoridad: Product Owner, conversación de esta fecha.

## Decisión y fuente

La Product Owner solicita registro en todos los apartados y aclara:

> solo un registro al primero ese es el admin nadie mas tiene acceso a eso despues se pueden hacer roles ahora no

En el contexto de la pregunta inmediatamente anterior, esta regla se aplica al
primer administrador de Hospital y al primero de Alcaldía, por institución.
La primera cuenta se convierte en administradora sin aprobación de un
administrador de plataforma. Después se cierra ese registro. No se implementan
altas de otros empleados, invitaciones, asignación de roles ni gestión de roles.

El registro ciudadano de Paciente, Cuidador y Visitador conserva su flujo de
solicitud y aprobación institucional; la exclusividad anterior corresponde al
registro administrativo institucional, no a la inscripción de pacientes.

## Precedencia y límites

Esta decisión sustituye la prohibición funcional de autorregistro institucional
de la spec 035, sección «Decisiones de producto cerradas», punto 1, únicamente
para el alta inicial de ese administrador. También sustituye la propuesta de
aprobación inicial por el administrador de Eloisa planteada en esta conversación.

No aprueba acceso entre instituciones, un administrador universal, acceso
clínico implícito, una segunda cuenta administradora ni funciones de empleados.
Tampoco constituye aprobación de una implementación técnica aún no presentada,
de una migración, de cambios Git ni de un despliegue público.

## Consecuencias

- La unicidad debe persistirse y comprobarse en servidor y base de datos.
- Dos envíos simultáneos no pueden producir dos administradores.
- Recargar, reiniciar Docker o deshabilitar la cuenta no reabre el registro.
- Después del alta, Hospital y Alcaldía ofrecen ingreso con la cuenta creada.
- El modo de demostración no puede conceder acceso a una institución ya registrada.
- Las cuentas técnicas anteriores requieren tratamiento explícito en la transición
  para que no permitan a otros entrar por una vía alternativa.

## Cuándo revisar

Cuando la Product Owner habilite más empleados, roles, recuperación o sustitución
del administrador, varias instituciones por instalación, o apertura del registro
fuera del entorno local. No ampliar el alcance por inferencia.

## Seguimiento

Propuesta técnica: `spec/specs/040-registro-unico-admin-institucional/`.
Regla funcional decidida; implementación pendiente de la autorización requerida
por AGENTS.md, sección 5, y de aprobación de la especificación técnica.
