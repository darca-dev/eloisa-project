# Inscripcion de cinco pasos e iconografia de Eli

- Fecha: 2026-09-30
- Actor: Product Owner
- Spec relacionada: `038-demo-funcional-accesos-ficticios`
- Estado: Aprobada

## Decision

La inscripcion de Atencion Domiciliaria debe reproducir la estructura funcional
de cinco pasos de `prototype-claude/Eligeme-Inscripcion.dc.html` para Paciente,
Cuidador y Visitador medico. La simplificacion de tres pasos de MP04-C2 queda
reemplazada.

Paciente conserva exactamente: Datos personales; Condicion y necesidades;
Ubicacion y EPS; Contactos; Confirmacion. Cuidador y Visitador conservan sus
cinco titulos y campos propios definidos por el mismo prototipo.

La superficie recupera la iconografia de Eli de la referencia: `guia.png` en
la cabecera, `escucha.png` en la orientacion de los pasos, `agradece.png` en el
cierre y `saluda2.png` en el activador del asistente. La marca visible continua
siendo `Eloisa`; no se restaura la palabra antigua `ELIGEME`.

## Persistencia

Los campos adicionales no pueden quedar solo en memoria ni descartarse al
enviar. Deben persistirse, con datos exclusivamente ficticios, como una
instantanea versionada de la solicitud y mostrarse solo en el detalle protegido
del Hospital del mismo tenant. La instantanea no es historia clinica ni fuente
de reglas clinicas, no prueba certificaciones y no crea relaciones ni
asignaciones al aprobar.

La contrasena queda excluida de toda instantanea, respuesta, auditoria y log.

## Fuente

- Correccion expresa del Product Owner en la sesion del 2026-09-30.
- `prototype-claude/Eligeme-Inscripcion.dc.html`, referencia protegida de cinco
  pasos, campos e iconografia.
