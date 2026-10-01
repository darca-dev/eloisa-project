# Inscripcion guiada y amistosa por perfil

- Fecha: 2026-09-30
- Actor: Product Owner
- Spec relacionada: `038-demo-funcional-accesos-ficticios`
- Estado: Aprobada

## Decision

La accion `Registrate` de Atencion Domiciliaria debe abrir una experiencia
guiada inspirada visualmente en `prototype-claude/Eligeme-Inscripcion.dc.html`.
La persona primero elige una de tres ramas: Paciente, Cuidador o Visitador
medico. Despues ve un formulario por pasos, con lenguaje sencillo, progreso
visible y solo los datos demo correspondientes a la rama elegida.

El flujo no recupera la semantica antigua de inscripcion directa. Al finalizar
debe efectuar exactamente el mismo `POST /api/v1/access-requests` vigente,
crear o reutilizar una solicitud `PENDING` y explicar que el Hospital debe
aprobarla antes de que la persona pueda iniciar sesion.

## Alcance cerrado

1. La referencia visual es el encabezado azul, las tarjetas blancas, la
   seleccion inicial de rol, la barra de progreso, la guia amistosa y la
   navegacion por pasos del prototipo protegido.
2. Se usan unicamente los nueve datos admitidos por el contrato vigente y la
   contrasena ficticia ya aprobada. No se capturan ni simulan datos clinicos,
   territoriales, relaciones cuidador-paciente, afiliaciones o asignaciones.
3. Cada rama conserva tres perfiles ficticios precargables. Despues de elegir
   una rama no deben mostrarse los botones demo de las otras dos.
4. Cambiar de perfil reinicia los datos capturados para impedir que una rama
   herede informacion de otra.
5. Los datos permanecen solo en memoria React durante el flujo. La contrasena
   se borra despues de todo intento de red, como exige OD-11.
6. `prototype-claude/` permanece sin cambios. La implementacion productiva
   vive en `apps/web`.

## Motivo

La pantalla tecnica actual muestra nueve fixtures y todos los campos en un solo
bloque. El Product Owner determina que la experiencia del prototipo es mas
clara y amistosa para los tres tipos de persona, sin cambiar el contrato ni la
aprobacion hospitalaria ya implementados.

## Fuentes

- Decision expresa del Product Owner en la sesion del 2026-09-30.
- `prototype-claude/Eligeme-Inscripcion.dc.html`, solo como referencia visual.
- `apps/web/src/features/access/AccessRequestForm.tsx`, flujo persistente actual.
