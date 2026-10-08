# S00-MP03 — contrato vigente

Updated-At: 2026-10-08
Current-Branch: feat/termino-00-mp03-secret-scan
Required-Base: d00bb820567f69a49fd49d0a3db0a87b4bebe85e
Related-Spec: 039-termino-s00-base-y-baseline
Implementation-Agent: Codex
Status: READY

## Autoridad, objetivo y límites

Orden explícita del PO: continuar tareas definidas y guardar cada paquete con commit/rama local. Clasificación research.md 52/52 realizada antes de fijar cuatro archivos en allowlist de spec.md. No consentimientos fabricados ni push. Repetir gate/strict antes de código.

Solo detector, catálogo no secreto, prueba adversarial y aleatoriedad de contraseña E2E. Las 53 entradas finales de catálogo corresponden a 54 ocurrencias de fixtures/referencias, incluidas tres descubiertas tras endurecer marcadores y clasificadas en research; hash de línea completa + ruta exacta + regla, con motivo. Sin excepciones genéricas para tests, docs, variables uppercase o localhost. E2E fijo retirado, nunca exceptuado. No alterar prototipo, historiales de Claude, plantillas, fixtures de validación, permisos, migraciones o reglas de negocio.

Datos: referencias y centinelas sintéticos, sin pacientes reales ni credenciales nuevas persistidas. No tenants nuevos, servidor/IdP/red ni eventos de negocio. Evidencia técnica minimizada por ruta/regla/conteo; scanner nunca imprime valores. Sin dependencia nueva. Rollback puntual conserva evidencia y no reduce detección.

## Aceptación y evidencia

Scanner repo EXIT 0 con 53 excepciones exactas/54 ocurrencias y contenido lockfile/plantillas inspeccionado. Matriz CLI en Git temporal demuestra: claves/tokens/DSN nuevos rechazados; tests/docs/lockfiles/plantillas inspeccionados; segunda credencial en línea y placeholder incrustado rechazados; referencia de variable exacta permitida y variantes rechazadas; catálogo inválido/cambiado falla cerrado; salida no contiene valores. E2E solo --list para compilación/colecta, sin ejecución; tipos y lint correctos. Ejecutar contratos baseline puros si se necesita comprobar fixtures conservados. Informe, tareas/historial y commit local; rama siguiente MP04 para definición operativa, sin iniciar DB todavía.
