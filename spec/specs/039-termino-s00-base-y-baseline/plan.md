# Plan 039 — S00 base y baseline

## Estado

MP01 implementado por Codex con autorización explícita y aceptado por el PO. MP02 verificado: 1888/1888 web y tipos/lint/build correctos. MP03 verificado: scanner EXIT 0, 16 adversariales, tipos/lint correctos. MP04A corrige comando de tipos del runner: 72 contratos puros y tres comandos reales pasan, sin infraestructura. MP04B propuesto con catálogo/owner y operación exactos; requiere decisión PO. El consentimiento original se conserva; ningún agente lo ejecutó o editó. Git local por decisión posterior del PO; S00 completo pendiente.

## Estrategia y hitos

1. S00-PRE: fijar base, copiar fuera de OneDrive conservando respaldo, reproducir checks y registrar hallazgos. Realizado con límites en el runbook.
2. S00-MP01: corregir los 17 errores de lint dentro de allowlist, mantener DI y conducta. Revisión Codex antes de continuar.
3. S00-MP02: resolver tres regresiones web contra contrato vigente y retirar la inyección municipal. Revisión completa, sin modificar permisos backend ni insertar marca artificial.
4. S00-MP03: clasificar 52 coincidencias del scanner, fijar allowlist y remedios, conservar detección adversarial. No tratar todo test como excepción.
5. S00-MP04: emitir alcance operativo reconciliado con 025/038 para baseline aislada e imagen exacta. Nunca usar los servicios activos como prueba de este HEAD sin evidencia.
6. Aceptación de S00 por PO; integración Git solo autorizada. Después abrir S01 desde base aceptada.

## Dependencias

D-01 base local cerrada. Specs 025/038 e instrucciones actuales siguen autoritativas; 039 no hereda consentimiento. Dependencias instaladas mediante npm ci --ignore-scripts; Prisma generado localmente. Docker disponible con contenedores activos. MP03 depende de clasificación específica; MP04 de identidad/labels/runId/secret delivery/cleanup exactos.

## Riesgos y mitigación

- DI perdida al convertir imports: conservar tokens runtime y comprobar composición.
- Expectativas obsoletas: reconciliar contra decisión vigente, conservar prueba de comportamiento, no borrar cobertura.
- Scanner permisivo: excepciones específicas y casos adversariales, sin eximir tests/documentación enteros.
- DB incorrecta: contratos hacia puerto inutilizable; integración solo guard aprobada y topología exclusiva.
- Confusión de imagen, rama o autorización: registrar SHA; nuevo handoff separado; no reutilizar READY de otra rama.
- Secretos posibles: evidencia sin valores; ninguna publicación/redacción/rotación automática sin clasificación y autorización aplicables.

## Compatibilidad, rollback y operación

Sin nuevas dependencias ni migraciones en MP01/MP02. Conservar APIs/contratos y trazabilidad. No relajar puerta municipal al fallar IdP. Diff inverso puntual para corrección local; nunca reset, borrado de migraciones o limpieza de recursos no identificados. La autorización de commits y ramas locales proviene de la orden explícita del PO, no de este plan. Sin push, merge o despliegue.
