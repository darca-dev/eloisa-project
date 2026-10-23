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

## MP07 — correcciones A01–A10 autorizadas el 2026-10-22

Contrato: `contracts/MP07-CORRECCIONES-A01-A10.md`. Verificación en curso: `contracts/MP07-VERIFICACION-CODEX.md`. Estas casillas describen verificación técnica; la aceptación del PO se conserva separada.

Revisión vigente 2026-10-23: B07–B09 corregidos; Chromium **12/12 sin omitidas**, móvil/teclado/axe y builds verificados por Codex. PostgreSQL API 43/43, fundación 37/37 y RLS6/6 ya verificados; API/OpenAPI169/169 y runner49/49. Baseline final se detuvo en web1900/1902 por B10 (dos tests consumidores anteriores, corrección acotada); cleanup correcto. Pendiente baseline completa y auditoría final, sin aceptación del PO.

- [x] Registrar autorización de corrección y precisar los dos paquetes, sin nueva regla médica ni permiso Git.
- [x] Probar actualización real del esquema anterior con duplicados históricos entre definiciones, sin reescribir evidencia ni inferir fuentes.
- [x] A01: semáforo sin estabilidad inferida, con regresiones de API y evaluador.
- [x] A03: definición exacta obligatoria en nuevas validaciones, revalidación ante cambios y compatibilidad de legado.
- [x] A04: identidad de ocurrencia y consumo entre versiones, frontera del cierre y concurrencia.
- [x] A07: snapshot efectivo inmutable y enmiendas anteriores/posteriores representadas con precisión (presentación web integrada en MP07B).
- [x] A09: destinatario plenamente elegible, revocaciones y asignaciones cruzadas verificadas en PostgreSQL (fundación 37/37; pendiente regresión final conjunta).
- [x] Revisar entrega MP07A y resolver las regresiones pendientes antes de iniciar MP07B (API 39/39; fundación 37/37; actualización histórica y RLS aprobadas).
- [ ] A02: borradores, claves, mutaciones y detalles aislados por contexto con interacción real A→B.
- [ ] A05: entrada visible para revisor sin administración, sin clínica para administrador o cuenta ajena.
- [ ] A06: recorrer directorio/cola y todas las páginas de alarmas/registros sin truncamiento silencioso.
- [ ] A08: nueva versión de la misma identidad de criterio, definición exacta y vigencia desde UI.
- [ ] A10: mensaje del motor vigente y recepción manual aprobada.
- [ ] Reejecutar baseline, navegador/accesibilidad, tipos/build/lint/secretos y gates; auditar los diez cierres.
- [ ] Presentar resultado verificado al PO para aceptación, conservando Git/despliegue sin autorización nueva.
