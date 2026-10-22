# 055 — Administración de permisos de cuidado y ratificación de D04.5

Fecha: 2026-10-21. Autoridad: Product Owner, en la conversación vigente con Claude Code, respondiendo a dos preguntas cerradas.

## Decisión 1 — Cómo se conceden los permisos de cuidado

Opción elegida: **«Pantalla del gestor»** (era la recomendada).

> En Hospital › Configuración, una cuenta humana designada como gestor crea el espacio de cuidado de un paciente y concede o revoca accesos, con referencia de autorización y auditoría. El primer gestor de cada organización se crea con un script controlado en el servidor.

Alternativas descartadas: solo un script controlado, sin pantalla; detenerse para que Codex especificara antes.

Alcance que esto habilita y que no:
- El gestor es la capacidad `OrganizationCareManager` de MP01. Ser gestor NO da acceso clínico (MP01 §4). El gestor no se concede a sí mismo reglas ni revisión, y no valida su propia competencia (CHECK de MP01).
- Las concesiones siguen exigiendo el vínculo previo que MP01 ya pide: relación de cuidado ACTIVE, asignación ACTIVE, o competencia declarada y validada por otra persona.
- Una organización `MUNICIPALITY` no se administra con fines clínicos.
- No autoriza datos reales, commit, push ni despliegue.

## Decisión 2 — D04.5, correcciones de datos ya evaluados

Opción elegida: **«Conservador»** (era la recomendada, y es la que está implementada).

> La corrección no crea, cierra ni rebaja alarmas; las evaluaciones futuras usan el valor corregido y la evidencia se marca «corregida después: revisar».

Alternativa descartada: reevaluar el criterio al corregir.

Con esto queda cerrado el punto de `MP04-05-CRITERIOS-ALARMAS-Y-SEMAFORO.md` §4 que estaba pendiente de ratificación. Cualquier cambio posterior requiere una versión nueva del motor; no se cambia en silencio.

## Registro

Registró: Claude Code. No se ejecutó `confirm-user-consent.sh`. Pendiente: auditoría de Codex de los paquetes implementados.
