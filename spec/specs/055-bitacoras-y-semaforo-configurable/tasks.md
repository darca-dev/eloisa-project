# Tareas 055

## MP00 — diseño y colaboración

- [x] Revalidar rama limpia y gobernanza vigente sin modificar producto.
- [x] Inspeccionar flujos actuales, permisos, esquema y documentación de alarmas.
- [x] Confirmar como decisión del Product Owner que existe vía manual además de la automática.
- [x] Preparar propuesta con contrato funcional, permisos, auditoría, límites y aceptación.
- [x] Localizar Claude Code y verificar acceso por suscripción, sin utilizar API key.
- [x] Recibir y auditar revisión de Claude, registrar resultado real y resolver observaciones documentales.
- [x] Obtener aprobación D01–D07 del Product Owner (2026-10-21); registrar su acto explícito sin ejecutar confirm-user-consent.sh.
- [x] Cerrar contrato técnico MP01 de custodia y permisos sin valores clínicos; los contratos de siguientes paquetes se cierran antes de sus entregas.
- [x] Fijar modelo/contratos y allowlist exactos del primer paquete; comprobar suficiencia y gate específico.

## Implementación entregada — aceptación pendiente de correcciones

Claude entregó MP01–MP06. Las casillas siguientes representan aceptación verificada, no mera presencia del código. La auditoría consolidada de Codex está en `spec/bitacora/handoffs/055-AUDITORIA-CODEX.md`; sus hallazgos impiden marcar cierre funcional.

- [ ] MP01: custodia, concesiones, esquema, migraciones, RLS y pruebas de autorización.
- [ ] MP02: bitácoras, observaciones y enmiendas persistentes integradas en portales.
- [ ] MP03: creación manual idempotente y recepción visible en Hospital, sin requerir regla.
- [ ] MP04: reglas individualizadas validadas, evaluación, evidencia y alarmas automáticas.
- [ ] MP05: seguimiento/asignación/transiciones, conteos autorizados y semáforo accesible.
- [ ] MP06: pruebas integradas/E2E aisladas, tipos/lint/build/secretos y accesibilidad.
- [x] Auditar la entrega consolidada MP01–MP06 y documentar defectos, criterios afectados y pruebas adversas requeridas.
- [ ] Auditar implementación y correcciones contra cada criterio; distinguir lo verificado de lo pendiente.
- [ ] Presentar aceptación al Product Owner; Git/publicación/despliegue requieren autorización separada.
