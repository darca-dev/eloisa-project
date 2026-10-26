# 055-MP07B-B11 — Texto de criterios vigentes

Estado: aprobado por decisión directa del PO del 2026-10-26, registrada en
`spec/bitacora/decisiones/2026-10-26-055-texto-sin-criterios-vigentes.md`.
Implementador: Claude Code. Auditor: Codex. Continuación acotada de MP07;
se heredan spec055 y `MP07-CORRECCIONES-A01-A10.md`, sin ampliar su alcance.

## Objetivo y comportamiento

Mostrar exactamente `Sin criterios vigentes ni solicitudes abiertas: no hay evaluación automática`
en la etiqueta de `SIN_CRITERIOS`, tanto en la respuesta API como en su presentación.
Se conserva el identificador SIN_CRITERIOS, su cálculo y todos los demás estados.
Un criterio vencido sin alarmas abiertas sigue sin ser ESTABLE, sin generar una
alarma ni reescribir la regla. Las clasificaciones abiertas mantienen A01/D04.5.

Usuarios: participantes autorizados actuales de paciente/cuidador/profesional/
Hospital. Tenant, organización, paciente, permisos, datos, fuentes, retención,
auditoría y fallos son idénticos al contrato MP07: no hay captura, acceso, evento
ni integración nuevos. No se inventan umbrales médicos ni se amplía acceso clínico.
Accesibilidad: conservar el texto explícito junto al color y los anuncios existentes.

## Archivos permitidos para Claude

1. `apps/api/src/care-criteria/care-criteria.contract.ts`: solo etiqueta SIN_CRITERIOS.
2. `apps/api/test/care-records-alarms.api.test.ts`: ampliar la aserción existente de
   criterio vencido para verificar el texto exacto y conservar todas las guardas.
3. `apps/web/src/features/care/care.test.tsx`: actualizar fixture y expectativa del
   estado sin criterios, preservando comprobaciones de texto/color/accesibilidad.
4. `apps/web/src/features/care/careCriteriaViews.tsx`: solo comentario de etiqueta,
   si es necesario para no conservar una descripción obsoleta.
5. `contracts/MP07B-B11-FROM-CLAUDE.md`: entrega nueva de este paquete.

Prohibido: motor, servicio, permisos, esquema, migraciones, dependencias, UI nueva,
cuentas, .env/.secrets/.tmp/.git, prototipo, tasks/reviews históricos, consentimientos,
otras decisiones y archivos fuera de la lista; Git mutante, servidores, DB/Docker,
navegador, otros agentes o transferencias de datos privados. Preservar los cambios
documentales de Codex existentes. No corregir/refactorizar asuntos ajenos.

## Verificación y entrega

Antes de editar ejecutar y reportar separadamente los dos gates canónicos.
Claude ejecuta tipos API/web, lint de los archivos tocados y unitarias focales
API de criterios/evaluador y web/care con DSN ficticio inutilizable. No ejecutar
DB ni presentar skips como aprobación. Codex ejecuta la suite API PostgreSQL
43 casos mediante el runner/preflight/clúster efímero aprobados y cleanup.

Aceptación: etiqueta exacta en API y render; mismo SIN_CRITERIOS y mismos conteos;
caso vencido sin estabilidad/alarma y sin mutación histórica; otros estados
intactos; pruebas/tipos/lint correctos. No necesita migración, dependencia ni
despliegue. Reversión del texto es una edición de constante, no cambio de datos.

Entregar archivos/propósito, comandos/exit/counts reales, verificaciones no
ejecutadas y diff mínimo. No actualizar aceptación PO ni canónicos de estado:
Codex lo hará tras auditar. La decisión de texto no acepta integralmente 055.
