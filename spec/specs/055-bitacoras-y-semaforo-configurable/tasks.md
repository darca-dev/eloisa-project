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

## Implementación entregada — verificación técnica y aceptación separadas

Claude entregó MP01–MP07. Las casillas siguientes representan verificación técnica,
no aceptación del Product Owner. La auditoría inicial A01–A10 se conserva como
antecedente; el dictamen actual está en
`contracts/055-CIERRE-AUDITORIA-CODEX-2026-10-26.md`. No se declara cerrado el
producto por la mera presencia de código ni por una batería verde.

- [x] MP01: custodia, concesiones, esquema, migraciones, RLS y pruebas de autorización.
- [x] MP02: bitácoras, observaciones y enmiendas persistentes integradas en portales.
- [x] MP03: creación manual idempotente y recepción visible en Hospital, sin requerir regla.
- [x] MP04: reglas individualizadas validadas, evaluación, evidencia y alarmas automáticas.
- [x] MP05: seguimiento/asignación/transiciones, conteos autorizados y semáforo accesible.
- [x] MP06: pruebas integradas/E2E aisladas, tipos/lint/build/secretos y accesibilidad; distinguir ejecución actual de builds previos.
- [x] Auditar la entrega consolidada MP01–MP06 y documentar defectos, criterios afectados y pruebas adversas requeridas.
- [x] Auditar implementación y correcciones contra cada criterio; distinguir lo verificado de lo pendiente y sus límites de cobertura.
- [x] Preparar y presentar el resultado técnico al Product Owner.
- [x] Obtener aceptación explícita del Product Owner el 2026-10-26; Git/publicación/despliegue requieren autorización separada.

## MP07 — correcciones A01–A10 autorizadas el 2026-10-22

Contrato: `contracts/MP07-CORRECCIONES-A01-A10.md`. Verificación en curso: `contracts/MP07-VERIFICACION-CODEX.md`. Estas casillas describen verificación técnica; la aceptación del PO se conserva separada.

Revisión vigente 2026-10-26: B10 ya estaba entregado y se verificó. Codex repitió
baseline **34/34 etapas, 2690 pruebas, cero fallos/omisiones**, y Chromium
**12/12**, móvil/teclado/axe; provisión/preflight/cleanup correctos. Web1904/1904,
API/OpenAPI169/169, fundación37/37, RLS6/6, API43/43 y runner49/49. Revisión parcial
de lectura adicional de Claude recibida; no se confirmó defecto bloqueante de
código en lo revisado. Posteriormente B11 aplicó el texto aprobado y se verificó
con API43/43, criterios17/17 y web/care48/48. Aceptación funcional del PO registrada el 2026-10-26.

- [x] Registrar autorización de corrección y precisar los dos paquetes, sin nueva regla médica ni permiso Git.
- [x] Probar actualización real del esquema anterior con duplicados históricos entre definiciones, sin reescribir evidencia ni inferir fuentes.
- [x] A01: semáforo sin estabilidad inferida, con regresiones de API y evaluador.
- [x] A03: definición exacta obligatoria en nuevas validaciones, revalidación ante cambios y compatibilidad de legado.
- [x] A04: identidad de ocurrencia y consumo entre versiones, frontera del cierre y concurrencia.
- [x] A07: snapshot efectivo inmutable y enmiendas anteriores/posteriores representadas con precisión (presentación web integrada en MP07B).
- [x] A09: destinatario plenamente elegible, revocaciones y asignaciones cruzadas verificadas en PostgreSQL (fundación 37/37 y regresión final conjunta correctas).
- [x] Revisar entrega MP07A y resolver las regresiones pendientes antes de iniciar MP07B (API 39/39; fundación 37/37; actualización histórica y RLS aprobadas).
- [x] A02: borradores, claves, mutaciones y detalles aislados por contexto con interacción real A→B.
- [x] A05: entrada visible para revisor sin administración, sin clínica para administrador o cuenta ajena.
- [x] A06: recorrer directorio/cola y todas las páginas de alarmas/registros sin truncamiento silencioso.
- [x] A08: nueva versión de la misma identidad de criterio, definición exacta y vigencia desde UI.
- [x] A10: mensaje del motor vigente y recepción manual aprobada.
- [x] Completar baseline y navegador actuales, revisar tipos/lint/secretos/gates y builds previos sin cambios de producto; auditar los diez cierres con sus límites.
- [x] Presentar resultado verificado al PO para aceptación, conservando Git/despliegue sin autorización nueva.
- [x] Decisión PO: conservar SIN_CRITERIOS y aclarar el texto de criterios vigentes, aprobada el 2026-10-26.
- [x] B11: implementar con Claude y verificar la etiqueta exacta en API y render sin cambiar el cálculo; API43/43, criterios17/17, web/care48/48.
- [x] Aceptación explícita del PO de 055, 2026-10-26, «si esta correcto prosigue».

Límite registrado: no hay prueba específica de actores mixtos por acción ni de
revocación concurrente en `decideManyWithin`. Existen pruebas reales de conjuntos
parciales y de revocación en otros caminos; no se generaliza AC11 a lo no probado.
