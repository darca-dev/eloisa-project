# 053-MP01 — Validación textual y vigencia tras bloqueo

Estado: continuación autorizada del contrato053 aprobado y de la decisión
`2026-10-26-053-continuacion-con-claude.md`. Implementación: Claude. Auditoría: Codex.
Base: e94e400, rama `feat/preentrega-access-hardening`, con cambios ajenos055 y
documentales054 que deben preservarse. No commit, push ni despliegue implícitos.

## Objetivo y alcance

Corregir PE-04/PE-05 antes de cerrar Configuración municipal. Se heredan los
16 puntos de spec053: catálogo de captura administrativa, revisiones append-only,
permisos del administrador municipal humano exacto, auditoría, procedencia,
tenant y límites. Este paquete no implementa el resto de los dominios MERDN.

Usuarios/datos: solo el administrador municipal confirmado de la cuenta/binding
exactos y su capacidad municipal activa. No acceso Hospital/soporte/paciente ni
nominalidad clínica. Datos institucionales agregados ficticios en pruebas; tenant,
actor y fechas servidor, sensibilidad institucional y procedencia originales.
Sin nuevos campos, fuentes, retención, eventos de auditoría o roles.

## PE-04 — comportamiento exacto

En values, campo opcional AUSENTE puede equivaler a vacío; cualquier campo
PRESENTE debe ser string, incluso vacío si no es obligatorio. Rechazar null,
undefined explícito, booleano, número, arreglo u objeto, sin coerción ni sustituir
un null por ''. Conservar límites y validación semántica de texto/fecha/URL/monto,
campos desconocidos, fuente oficial y requeridos. El dato válido sigue guardable,
recuperable, editable y guardable de nuevo.

El cliente debe rechazar una respuesta inválida del servidor; no debe llegar un
valor no textual al editor ni a .trim(). No reparar silenciosamente datos
persistidos ni reescribir revisiones históricas. Si existe legado inválido, se
expone error controlado y se documenta; no se permite borrado/backfill automático.

Pruebas: matriz de tipos inválidos en campos opcionales y requeridos; ausente y
vacío opcionales aceptados; cliente ante respuesta con null devuelve error;
API400 sin revisión ni evento SAVED para null; guardado válido→lectura→edición
posterior conserva versión y no rompe normalización.

## PE-05 — comportamiento exacto

El instante que se usa para verificar expiresAt debe obtenerse DESPUÉS de
completar el FOR SHARE de cuenta (y, para PUT, después de esperar el advisory
existente). No aumentar TTL, no usar hora de cliente ni renunciar a los locks.
Conservar filtros de cuenta activa/no bloqueada y binding exacto, reserva,
capacidad, sessionId y revocación. No cambiar el orden advisory→cuenta ni otros
flujos en este paquete. El timestamp de auditoría corresponde a esta decisión.

Si la sesión vence mientras se espera la cuenta, GET y PUT deben denegarse desde
el servicio real, conservar auditoría DENIED y no devolver documento, insertar
revisión ni generar SAVED. Error de auditoría sigue revirtiendo el trabajo.

Prueba PostgreSQL con barrera real, no sueño fijo ni reloj global simulado:
mantener cuenta FOR UPDATE en transacción propietaria efímera, iniciar
MunicipalityManagementService.document con principal/sesión ficticios válidos,
confirmar por pg_blocking_pids que la consulta real espera al blocker, expirar
la sesión a un instante posterior al inicio de la espera y anterior a liberar
la cuenta, confirmar la transacción y comprobar denegación del servicio real.
Usar pg_backend_pid del blocker, deadline/poll acotados y try/finally para liberar
locks/restaurar fixture. GET y PUT son casos separados. No comprobar solo un
SELECT manual ni dejar una promesa/transacción viva al fallar. La prueba no
reconecta a la base de la aplicación y no desactiva RLS/FORCE.

## Allowlist exacta

- `packages/shared/src/municipality-management.ts` y su `.test.ts`.
- `apps/api/src/municipality/municipality-management.service.ts`.
- `apps/api/test/municipality-management.api.cases.ts`.
- `apps/web/src/features/municipality/municipalityManagement.test.tsx`.
- Entrega nueva `spec/specs/053-configuracion-municipal-y-fuentes/MP01-FROM-CLAUDE.md`.

No modificar editor/clientes ni otros archivos de producto sin hallazgo y contrato
adicional; la validación compartida corrige el borde actual. Prohibido esquema,
migraciones publicadas, permisos, dependencias, catálogos oficiales, .env/.secrets,
.tmp/.git, prototipo, tasks/reviews históricos, cambios de otros paquetes y Git.
No reformat global; solo el menor cambio coherente. No agentes adicionales.

## Ejecución y evidencia

Antes de editar ejecutar separadamente los gates canónicos y reportar exit.
Claude ejecuta build shared (API/web consumen dist), tipos shared/API/web, lint de
los archivos tocados, tests shared y web/municipality. DSN ficticio inutilizable
puerto1, sin leer entornos privados ni ejecutar DB/Docker/browser/servidores.
Codex ejecuta municipality.api en clúster efímero con runner/preflight/cleanup y
verifica las nuevas barreras, RLS, permisos, auditoría y ausencia de omitidas.

Aprobación técnica: todos los tipos presentes no textuales rechazados; edición
válida posterior conservada; dos carreras reales de expiración denegadas sin
escritura/lectura; casos existentes no debilitados; tipos/lint/tests correctos.
No cambios de esquema, migración ni rollback de datos. Reversión de código
mediante edición acotada; no restaurar el defecto en una instancia usada.

Claude retorna archivos y propósito, comandos/exit/counts reales, diferencias
respecto al contrato, decisiones locales y pruebas DB preparadas/no ejecutadas.
No actualizar aceptación, docs de Codex o consentimientos; detenerse tras entrega.
Los siguientes paquetes de navegador, builds y aplicación local se fijan tras
auditar MP01; no ejecutar todo automáticamente ni afirmar cierre de053.
