# Tareas 025 — FORCE RLS y baseline aislada

## Gate documental

- [x] Confirmar 26 tablas RLS y 27 policies.
- [x] Corregir diagnóstico: 11 tablas ya FORCE, 15 pendientes.
- [x] Definir migración forward sin editar historia.
- [x] Definir roles/ownership, preflight, postflight y remediation.
- [x] Congelar matriz 22+1 y stale fixes.
- [x] Diseñar 42 micro-paquetes con hard stop ≤15.
- [x] Revisión arquitectura/data isolation.
- [x] Revisión seguridad PostgreSQL.
- [x] Revisión testing/lifecycle/timeboxing.
- [x] Product Owner registra consentimiento final de implementación.
- [x] Gate particular 025 abierto y reportado antes de MP01.

## Implementación — consentida por micro-paquete secuencial

- [ ] MP01–MP03: topología y guardas anti-entorno.
- [ ] MP04–MP06: migración FORCE, catálogo y runbook.
- [ ] MP07–MP10: provision/preflight/cleanup y pruebas lifecycle.
- [ ] MP11–MP12: dos stale fixes.
- [ ] MP13–MP14: runner y pruebas.
- [ ] MP15: provisionar primera corrida.
- [ ] MP16–MP19: typecheck/API no DB/web/OpenAPI.
- [ ] MP20–MP41: ejecutar uno por uno los 22 DB-gated.
- [ ] MP42: agregar evidencia y cleanup.

## Criterios de seguridad verificables

- [ ] Nueva migración solo FORCE en 15 tablas; cero edición histórica/DML/schema/policy/grant.
- [ ] Las 26 tablas tienen RLS+FORCE y las 27 policies exactas.
- [ ] Runtime no owner, no superuser, no BYPASSRLS, no CREATEDB/CREATEROLE/CREATE schema.
- [ ] Owner sujeto a FORCE no accede sin policy/contexto aplicable.
- [ ] Tenant A positivo; B invisible; cross-tenant INSERT/UPDATE denegados.
- [ ] `territorial_unit` compartido y soporte home/target conservan semántica aprobada.
- [ ] Pool no conserva tenant previo; runtime no obtiene DELETE.
- [ ] Lock timeout/statement timeout/rollback transaccional probados.

## Criterios test/cleanup

- [ ] Guard rechaza demo/staging/prod/merdn_dev antes de Docker.
- [ ] Test ejecuta las 13 migraciones reales; no aplica FORCE ad hoc.
- [ ] DB ausente, skip, disabled, timeout o matriz incompleta son FAIL.
- [ ] Cada paquete termina/reporta antes de 15 minutos.
- [ ] Todos los stages comparten commit y run-id.
- [ ] Cleanup solo por proyecto/labels exactos y postcheck de cero recursos.
- [ ] Evidencia sanitizada; DB demo no consultada ni modificada.

## Evidencia por paquete

- [ ] HEAD/spec/gate/consentimiento previo.
- [ ] Tiempo inicio/review/hard stop y duración real.
- [ ] Allowlist/denylist y estado Git final.
- [ ] Comandos/códigos de salida sin secretos.
- [ ] PASS/BLOCKED y STOP CONDITION.
- [ ] Confirmación de que no hubo acción posterior al hard stop.
