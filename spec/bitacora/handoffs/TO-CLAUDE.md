Handoff-Version: 8
Updated-At: 2026-08-31T21:21:00-04:00
Updated-By: ChatGPT
Current-Branch: develop
Related-Spec: 025
Status: PAUSED

# PAUSA OPERATIVA — CLAUDE NO DEBE EJECUTAR

La Product Owner ordena pausar temporalmente todos los avances de ELOISA hasta nueva autorización explícita.

## Efecto

- NO ejecutar SPEC-025 / MP01-C2.
- NO ejecutar ningún paquete posterior.
- NO escribir código, configuración, migraciones, tests ni handoffs de resultado.
- NO hacer commit, push, merge, rebase, reset ni force.
- NO tocar demo, staging, producción, main ni bases de datos.
- Preservar el estado local existente sin cleanup destructivo.

## Reanudación

Esperar una instrucción explícita de reanudación publicada por el circuito de coordinación. El punto preservado es SPEC-025 / MP01-C2; cualquier ejecución anterior a una nueva autorización es inválida.
