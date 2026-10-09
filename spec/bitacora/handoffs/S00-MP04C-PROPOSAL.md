# S00-MP04C — contexto confiable del tenant para la baseline

Updated-At: 2026-10-09
Related-Spec: 039-termino-s00-base-y-baseline
Implementation-Agent: Codex, bajo autorización de continuidad
Status: PROPOSAL — decisión de frontera pendiente; no READY

## Problema y decisión propuesta

MP04B verificó catálogo y RLS en PostgreSQL, pero la baseline se detuvo en api-no-db-health: falta MERDN_ACTIVE_TENANT_ID. Spec 024 exige ese UUID desde configuración confiable; el entorno cerrado implementado por el runner solo admite tres claves de prueba. Se propone ampliar ese contrato exclusivamente a una cuarta clave MERDN_ACTIVE_TENANT_ID obtenida y validada por tooling confiable sobre el cluster aislado. La orden anterior de continuidad no resuelve por sí sola esta ampliación de frontera.

Alternativas: heredar UUID del padre/env-file sin comprobarlo permite contexto ajeno; fijar uno en tests depende del seed y pierde linaje; runtime disabled o ignorar skips invalida la aceptación. Recomendación: resolver la única pareja id/código del tenant ficticio desde catálogo de pruebas ya identificado y validado, conservar el ID únicamente en memoria y pasarlo al hijo. No cambia autenticación ni permisos del producto.

## Alcance y archivos

Permitir, solo después de decisión PO y activación en spec/plan/tasks: scripts/testing/run-baseline.mjs, scripts/testing/test-db-preflight.mjs, tests/testing/run-baseline.test.mts, tests/testing/test-db-lifecycle.test.mts. Documentación del bundle 039, runbook, plan, índice y handoffs. Ninguna otra fuente. No modificar provisionador, env-file existente, guard/topología, migraciones, schema, aplicación, IdP, prototipo, specs 024/025/038, archivos históricos, lockfile o consent log.

## Contrato funcional, datos y seguridad

1. Antes de consultar el tenant, exigir env-file guardado/guard aprobado, identidad efectiva del recurso exclusivo, catálogo completo, owner/roles/grants/RLS/FORCE y preflight correcto. Usar acceso administrativo solo en tooling de preparación aislado; no añadir credenciales ni consultas privilegiadas al código API.
2. Consultar de solo lectura la única fila de tenant ficticio con código FICTIONAL_TENANT existente. Cero/múltiples filas, ID no UUID, pareja discordante, identidad cambiada o fallo SQL: denegar antes de cualquier subprocess de tests. No crear ni corregir tenants para pasar esta verificación.
3. Separar el contexto privado del resultado público del preflight. No agregar el UUID a buildPreflightEvidence, stdout/stderr, reportes, argv, archivos o Git. Agregarlo al saneamiento de errores. El contexto no confiere acceso fuera de las transacciones runtime y sus políticas.
4. Entorno hijo exacto: seis claves de sistema existentes y cuatro derivadas confiables. Las tres actuales conservan su contrato; la cuarta recibe exclusivamente el contexto validado. Ignorar/rechazar suplantación desde padre, NODE_OPTIONS, entrada HTTP o env-file no validado; no heredar entorno completo. No ampliar otros secretos o permisos ni cambiar el tratamiento existente de DATABASE_URL en este paquete; cualquier nueva incompatibilidad de privilegios requiere revisión separada.
5. Mantener enforce, 29 etapas/23 DB, rechazo de skip/todo/fallo/timeout y cleanup exclusivo. No alterar aserciones API ni inventar sesión, cuenta, regla clínica o dato institucional. Solo tenant ficticio del cluster desechable; sin pacientes reales, retención del contexto limitada al proceso.

## Aceptación y evidencia exigida

Pruebas negativas con dobles: contexto faltante, UUID inválido, tenant ausente/duplicado, pareja discordante, consulta fallida, suplantación del padre y claves adicionales. Comprobar que no inicia hijo al fallar, no revela ID/secretos, conserva exactitud de claves y rechazo de skips, y limpia solo recursos propios. No debilitar cobertura existente.

Gates antes de código; contratos puros, tipos, lint/scanner y revisión de diff. Después una nueva ejecución identificada desde cero en topología MP04B, nuevo runId y huella/commit: máximo 15 minutos por etapa, sin retries, primer fallo detiene y limpia. Mismo env-file privado validado, sin imprimir ni sobrescribir. Confirmar catálogo/RLS y contexto real, registrar conteos por etapa y distinguir pruebas con mocks de integraciones reales. La matriz completa deberá pasar sin omisiones para aceptar baseline; un fallo adicional se documenta, sin ampliar este paquete.

No cambios UI ni accesibilidad; no nuevas dependencias, migraciones, eventos de negocio o integraciones. Auditoría técnica: rama/HEAD, gates, runId, etapas, resultado y limpieza, todo minimizado. Rollback: diff inverso específico de estos archivos; no reset, restauración de bypass ni operación en DB compartida. Git local autorizado; no push/main/merge/despliegue. S01 y D-02/D-03/D-04 permanecen pendientes.

## Motivo de la decisión PO

AGENTS.md §6 exige: «Wait for user approval when the decision materially affects the architecture or product behavior». La ampliación de la allowlist de entorno confiable modifica una frontera de configuración de tenant y excede los cuatro archivos aprobados para MP04B. Se solicita aprobar únicamente este contrato y activar su implementación; no volver a autorizar Codex en general ni todo S00.
