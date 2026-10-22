# Investigación 055 — evidencia local

Fecha: 2026-10-21. Rama observada: `feat/preentrega-access-hardening`; HEAD inicial `fb077e8`; árbol limpio al iniciar. La rama y la implementación de 054 se conservan; ninguna aprobación previa de Git se reutiliza para este cambio.

## Estado comprobado

| Fuente | Hecho |
|---|---|
| `apps/web/src/features/hospital/HospitalShell.tsx:199` | En modo normal los módulos pendientes, incluido alarmas, no montan la demostración |
| `apps/web/src/features/hospital/HospitalPendingModule.tsx:4` | Semáforo explícitamente pendiente, sin consulta disponible |
| `apps/web/src/features/hospital/HospitalAlerts.tsx:33` | Presentación sin generación, motor ni auditoría productiva |
| `apps/web/src/features/paciente/bitacoraFlow.ts:13` | Respuestas solo en memoria, sin evaluación clínica |
| `apps/web/src/features/paciente/BitacoraPaciente.tsx:167` | Cierre explica que no se guardó ni envió información |
| `apps/web/src/features/caregiver/CaregiverAccessPortal.tsx:253` | Contenido autorizado actual monta una demostración de liquidaciones; no captura bitácora |
| `apps/web/src/features/profesional/ProfesionalPortal.tsx:237` | Detalle de visita declara que no registra notas clínicas ni evidencia |
| `prisma/schema.prisma:1123` y `:1142` | Finalidad HOME_CARE_COORDINATION excluye uso clínico; CaregiverScope solo admite VISITS_VIEW |
| `apps/api/src/people-relationships/caregiver-relationship.policy.ts` | Política existente autoriza consulta de visitas; no escritura ni clínica |
| `apps/api/src/identity-access/identity-access.service.ts` | Existen resolución de paciente aprobado y comprobación de asignación profesional; no sustituyen competencias clínicas |
| `apps/api/src/institutional-auth/institutional-administrator.contract.ts:8` | Capacidades administrativas no incluyen gobierno clínico de alarmas |
| `prisma/schema.prisma:1482` | HomeVisit guarda operación/estados; el comentario excluye nota clínica, alerta y evidencia |
| `prisma/schema.prisma` | No hay modelos persistentes de bitácora, regla individual o alarma. Tampoco una entidad general de organización; tenant/reserva administrativa no prueban custodia clínica |

## Contexto autoritativo

`AGENTS.md` §§5–6, 8–12, 18 y 22; `CLAUDE.md` §8; `docs/WORKFLOW-ALERTAS-ELI.md`; `docs/ROLES.md`; `docs/DATA.md`; `docs/SECURITY.md`; `docs/ARCHITECTURE.md`; `docs/PLAN-TERMINO-FUNCIONAL.md` S06/S12.

El flujo de alarmas aprobado admite activación manual, clasificación autorizada/versionada, visibilidad inmediata de posibles urgencias y seguimiento. También explicita que el motor, reglas clínicas y canales no estaban implementados. La nueva instrucción confirma la vía manual y la personalización; no aporta valores médicos ni elimina esos controles.

## Colaboración solicitada

Claude Code 2.1.304 localizado en la instalación de VS Code; autenticación observada mediante claude.ai/suscripción. Revisión limitada a Read/Grep/Glob, modo plan/restringido, sin MCP externo, ejecución de comandos ni edición. El prompt excluye secretos, pacientes, archivos externos y acciones Git.

Primer intento sin revisión por ECONNREFUSED. Tras rechazo automático del reintento y posterior autorización expresa del Product Owner para compartir documentación/código relacionados con Anthropic, la revisión terminó correctamente (`is_error=false`; sin denegaciones de herramientas reportadas). Resumen auditado en `spec/bitacora/handoffs/055-REVISION-CLAUDE-Y-CODEX.md`. No equivale a validación clínica, aceptación de arquitectura ni implementación.

No se efectuó investigación médica ni jurídica ni se seleccionaron umbrales. Las recomendaciones se limitan a arquitectura, integridad, seguridad y comportamiento de software propuesto.
