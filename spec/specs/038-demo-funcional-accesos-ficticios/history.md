# Historial — 038 Demo funcional con accesos ficticios

| Fecha | Estado | Actor | Cambio |
|---|---|---|---|
| 2026-09-30 | Aceptacion MP03-C2 y autorizacion MP04 | Product Owner / Codex | El Product Owner acepta MP03-C2. Codex publica handoff v58 para provision OIDC, `sub` real, acceso por perfil, suspension/revocacion y portales protegidos; MP05 sigue cerrado. |
| 2026-09-30 | Implementacion y verificacion MP03-C2 | Codex autorizado por Product Owner | Sustituye la tabla Hospital en memoria por bandeja API para `HOSPITAL_ACCESS_REVIEWER`; busqueda, filtro, paginacion, detalle, decisiones, conflictos, expiracion y accesibilidad. Evidencia: 902 pruebas Hospital, 7 E2E, typecheck, lint y SDD verdes. MP04 permanece cerrado. |
| 2026-09-29 | Auditoria MP03-C1-C1 | Codex | PASS directo: busqueda documental, cursor canonico y 401 auditado corregidos; 33 focales, 150 regresiones API, typecheck y lint verdes. El reporte OpenCode quedo sin cierre. Se abre MP03-C2 para la bandeja Hospital real. |
| 2026-09-29 | Auditoria MP03-C1 | Codex | FAIL con correccion unica autorizada: completar busqueda documental formateada, validar cursor canonico exacto y auditar 401 como UNAUTHENTICATED. El supuesto import type del job de expiracion no existe en el arbol auditado. Se abre MP03-C1-C1; MP03-C2 sigue cerrado. |
| 2026-09-24 | Propuesta / Borrador | Codex | Se crea la especificación, el plan, las tareas, el contrato y la investigación a partir del estado real del repositorio y de revisiones especializadas de arquitectura, seguridad, datos y pruebas. |
| 2026-09-24 | Aprobación | Product Owner | Aprueba formalmente la spec 038 y adopta las recomendaciones OD-01 a OD-12 como decisiones de producto. |
| 2026-09-24 | Consentimiento SDD | Product Owner | Registra personalmente el consentimiento específico mediante `confirm-user-consent.sh` a las 22:34:29 -0600. |
| 2026-09-24 | Auditoría MP00 | Codex | `FAIL — CHANGES REQUIRED`: rama incorrecta, T00.3/T00.7/T00.8 incompletas, T00.9 sin disposición y pruebas de frontera debilitadas. MP01 permanece cerrado. |
| 2026-09-24 | Decisión Git | Product Owner | Autoriza considerar aceptados los once commits demo entre `develop` (`ad7a18c`) y `530a722`, crear `feat/038-demo-funcional-accesos-ficticios` en el mismo HEAD y cambiar el workspace sin commit, merge, rebase, push, PR ni despliegue. |
| 2026-09-24 | Handoff correctivo | Codex | Publica MP00-C1 para corregir los hallazgos de auditoría. MP01 continúa cerrado. |
| 2026-09-28 | Prioridad de producto | Product Owner | Difiere la infraestructura pendiente de SPEC 025 y prioriza 038 como entorno funcional local con datos de prueba ficticios persistentes; no como maqueta visual. |
| 2026-09-29 | Auditoría MP01-C1-C2 | Codex | PASS estático: modelo, migración, rollback, RLS declarada, FKs y formato Prisma coherentes. Las pruebas PostgreSQL quedan pendientes hasta retomar la infraestructura aislada. MP02-C1 queda abierto para el registro persistente sin acceso autenticable. |
| 2026-09-29 | Auditoría MP02-C1-C1 | Codex | PASS estático: el rechazo por origen precede al límite de solicitudes y no consume la cuota. Se revisaron 54 pruebas focales, composición del módulo, 47 pruebas OpenAPI y Prisma. MP02-C2 queda abierto para conectar la interfaz de registro. |
| 2026-09-29 | Decisión de producto | Product Owner | Confirma registro para Paciente, Cuidador y Visitador médico; revisión obligatoria en Hospital; acceso posterior solo al portal correspondiente; y datos deterministas de prueba para los tres perfiles. La aprobación no crea relaciones cuidador-paciente ni asignaciones profesionales. |
| 2026-09-29 | Auditoría MP02-C2 | Codex | FAIL con corrección autorizada: el formulario y cliente existen y pasan sus suites, pero el estado React no bloquea dos submits del mismo tick; status/source no se validan como literales; falta prueba de interacción; y deben corregirse el rótulo Visitador médico y el ejemplo OpenAPI. Se abre MP02-C2-C1. |
| 2026-09-29 | Decisión de producto | Product Owner | Unifica la portada para Atención Domiciliaria, Hospital y Alcaldía sobre un proveedor OIDC local compartido. Las cuentas ficticias se restringen por perfil en servidor, las nuevas cuentas humanas requieren aprobación Hospital y las credenciales de presentación solo pueden exponerse bajo modo local configurado por servidor. |
| 2026-09-29 | Auditoría MP02-C2-C1 | Codex | PASS: doble submit bloqueado sincrónicamente, respuesta 202 validada con literales, rótulo Visitador médico, OpenAPI corregido y siete pruebas Playwright focales. Se abre MP03-C1 para revisión Hospital persistente; DB real continúa diferida. |

## Estado de aprobación

- La especificación está **aprobada** por el Product Owner desde el 2026-09-24.
- Las decisiones `OD-01` a `OD-12` están **cerradas y aprobadas**.
- El consentimiento SDD específico está **registrado**.
- La implementación queda habilitada por paquetes y requiere revisión de Codex
  entre paquetes.
- No se ha autorizado integración Git, publicación ni despliegue.
- La creación de estos documentos no modifica código de producción ni el prototipo protegido.

## Evidencia requerida para cambios futuros

Cada actualización debe registrar aquí la fecha, la decisión o corrección, el actor y los artefactos afectados. El consentimiento SDD se registra por separado mediante el mecanismo definido por el repositorio y debe ser ejecutado personalmente por el Product Owner.
