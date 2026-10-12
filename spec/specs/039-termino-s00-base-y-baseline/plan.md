# Plan 039 — S00 base y baseline

## Estado

MP01 aceptado; MP02/MP03/MP04A verificados. MP04B aprobado por el PO el 2026-10-09: catálogo 27 tablas/28 policies y 17 migraciones verificados en PostgreSQL aislado, con owner no privilegiado y sondas RLS/tenant correctos. Baseline detenida en contratos API: falta MERDN_ACTIVE_TENANT_ID en entorno hijo; recursos propios limpiados. MP04C propuesto para resolver ese transporte confiable, pendiente de decisión material antes de código. El consentimiento original se conserva sin intervención del agente. Git local por decisión del PO; S00 completo pendiente.

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

## MP05 — prioridad de interfaz indicada por PO

Rama desde 389d5fe, independiente de implementación MP04C pendiente. Primero contrato y gates; después mensajes de registro/hub/revisión y precarga test completa con contraseña aleatoria; pruebas de nueve perfiles y regresión web; build/recreación exclusiva web; informe y commit local. Hallazgo source TEST_DATA exige paquete de procedencia separado.

MP05 verificado: 1901/1901 web, tipos/lint/scanner/build y HTTP local correctos. Interacción de navegador no verificada por falta de conexión; no cuentas/solicitudes creadas. Siguiente propuesta MP06 separa SELF_REGISTRATION nuevo de TEST_DATA histórico, pendiente de decisión material. MP04C continúa pendiente.
# MP04C — activado el 2026-10-12

Dependencias: MP04B catálogo/preflight real verificado y orden actual de ejecución.
Fases: contexto privado al terminar preflight; transmisión mínima al hijo;
negativas de contexto y regresión; ejecución real aislada de baseline.
Riesgos: contexto suplantado, filtración de UUID y reutilización de un cluster
distinto. Mantener env-file/identidad validados y no incluir contexto en evidencia.
Contrato/allowlist: S00-MP04C-PROPOSAL.md y decisión 2026-10-12-ejecucion-modulos-reales-codex.md.
