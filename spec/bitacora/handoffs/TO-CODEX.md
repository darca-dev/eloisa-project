Handoff-Version: 20
Updated-At: 2026-08-31T21:21:00-04:00
Updated-By: ChatGPT
Current-Branch: develop
Related-Spec: 025
Status: PAUSED

# PAUSA OPERATIVA ORDENADA POR PRODUCT OWNER

## Decisión

La Product Owner ordena pausar temporalmente todos los avances de ELOISA hasta que pueda sentarse nuevamente a supervisar la labor coordinada de ChatGPT, Codex + agentes y Claude.

## Efecto inmediato

- NO iniciar ni continuar implementación.
- NO abrir nuevos micro-paquetes.
- NO ejecutar MP01-C2 ni MP02-MP42 mientras esta pausa esté vigente.
- NO hacer commit/push de producto, specs, migraciones, configuración o handoffs adicionales salvo que sea estrictamente necesario para preservar un estado ya ejecutado antes de recibir esta pausa.
- NO continuar trabajo del Relay, staging, Visitador, Spec 026, browser acceptance ni release.
- NO tocar main, demo, staging, producción ni bases de datos.
- Preservar todos los cambios locales y el estado Git actual; no reset, rebase, force, discard ni cleanup destructivo.

## Punto de reanudación preservado

Cuando la Product Owner autorice reanudar, volver exactamente a:

- Spec vigente: 025.
- Paquete vigente: MP01-C2.
- MP01 pendiente de checkpoint.
- MP02-MP42 cerrados hasta PASS + checkpoint de MP01-C2.
- Ruta posterior preservada: cerrar Spec 025 -> congelar MVP real -> Visitador -> Spec 026 mínima -> staging -> browser acceptance -> seguridad final -> release candidate.

## Gobernanza al reanudar

ChatGPT dirige prioridad, alcance y continuidad. Codex + agentes analizan, diseñan, supervisan, revisan y validan. Claude implementa únicamente el micro-paquete vigente autorizado, sin decidir arquitectura, ampliar alcance ni hacer commit/push. Codex incorpora únicamente resultados validados y hace checkpoint Git.

## Regla de pausa

No solicitar a la Product Owner ninguna acción técnica mientras la pausa esté vigente. Esperar una instrucción explícita de reanudación.
