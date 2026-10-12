# 041 — Accesos personales reales y recuperación administrada

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para implementación local`.
- Fecha de aprobación / Approval date: 2026-10-12.
- Aprobado por / Approved by: Product Owner, conversación vigente.
- Evidencia de aprobación / Approval evidence: ../../bitacora/decisiones/2026-10-12-ejecucion-modulos-reales-codex.md y ../../bitacora/decisiones/2026-10-12-recuperacion-administrada.md.
- Autoriza implementación de módulos reales y recuperación administrada; no constituye aceptación anticipada del resultado ni roles adicionales.

## Historia de usuario principal

Como solicitante Paciente, Cuidador o Visitador, quiero registrarme, recibir una decisión real, entrar con mi identidad y recuperar mi contraseña mediante el administrador autorizado.

## Contrato funcional y seguridad

1. Reutilizar OIDC, Person/HumanAccount, tres perfiles y aprobación Hospital existentes. Primer administrador exclusivo según 040; sin empleados, roles ni tenants nuevos.
2. Nuevas solicitudes públicas usan SELF_REGISTRATION fijado por servidor. Conservar TEST_DATA histórico. Procedencia nunca concede acceso ni prueba identidad.
3. Nuevas decisiones usan códigos operativos neutrales equivalentes a DEMO_*. Leer históricos sin reescribir eventos; validar escritura solo con códigos nuevos, sin texto libre.
4. Alta pública crea persona/cuenta nueva; no apropiarse de Person/HumanAccount por documento. Reintento probado mediante cookie Secure/HttpOnly/Strict aleatoria, solo hash y caducidad persistidos. Otro navegador/documento existente: conflicto opaco, sin referencia ni estado ajenos. Comparar identidad y expediente, nunca actualizar contraseña al reintentar. Perfil adicional de cuenta existente requiere flujo autenticado separado; no habilitarlo por endpoint público.
5. Preparar usuario deshabilitado; activar solo tras aprobación y verificación exacta remota. Rechazo, suspensión y revocación impiden acceso. Nunca reutilizar cuentas administradoras ni crear alias ajenos. Ninguna aprobación certifica habilitación profesional, consentimiento o relación clínica.
6. Cliente estricto con ambos orígenes y estados reales, confirmación de decisiones, errores recuperables, sin éxito simulado.
7. Recuperación solo por administrador Hospital confirmado de 040, autenticación reciente, mismo tenant, cuenta personal aprobada y vínculo externo exacto activo. Nunca resetear administradores mediante este flujo. Registrar confirmación explícita de verificación manual y referencia mínima del soporte; sin documentos adjuntos ni datos personales libres.
8. Contraseña temporal y confirmación validadas; enviarlas solo al IdP y exigir cambio en siguiente ingreso. No almacenar, devolver, auditar ni registrar contraseña. Entrega privada fuera del sistema a cargo del administrador, sin SMTP ni reset público por documento.
9. Operación persistente idempotente y auditoría de inicio antes de contactar IdP; revocar sesiones MERDN e IdP. Confirmar éxito solo tras reset y revocación remotos. Ante incertidumbre, estado pendiente/fallido visible y cuenta bloqueada hasta conciliación autorizada. No fingir atomicidad entre PostgreSQL e IdP ni repetir cambio oculto.
10. Pérdida del único administrador: procedimiento del operador autenticado del IdP, conservando reserva. Ningún endpoint público reabre el registro.
11. Tenant del servidor, RLS FORCE, rol runtime, FKs compuestas, bloqueos/versiones, origen permitido y controles de abuso. Auditar actor nominal, destino, acción, resultado y correlación; no secretos ni PII en logs/errores. Datos de prueba ficticios exclusivamente en entorno aislado.

## Escenarios y criterios de aceptación

- CUANDO una persona nueva registra un perfil, EL SISTEMA DEBERÁ persistir SELF_REGISTRATION, preparar usuario deshabilitado y devolver su referencia.
- SI otro navegador declara el documento, EL SISTEMA DEBERÁ denegar sin alterar cuenta/expediente/contraseña ni revelar referencia.
- CUANDO el administrador aprueba, EL SISTEMA DEBERÁ verificar IdP y permitir login real únicamente al perfil aprobado.
- CUANDO suspende/revoca, EL SISTEMA DEBERÁ rechazar sesiones previas.
- CUANDO recupera una cuenta, EL SISTEMA DEBERÁ invalidar sesiones antiguas y exigir cambio de contraseña en IdP.
- SI falla IdP/auditoría, EL SISTEMA DEBERÁ fallar cerrado y mostrar estado real sin acceso residual.
- SI interviene otro tenant, alias, solicitante o administrador no autorizado, EL SISTEMA DEBERÁ denegar uniformemente.

## Ámbito de archivos / File scope

- apps/api/src/access-requests/
- apps/api/src/audit/
- apps/api/src/human-auth/
- apps/api/src/identity-access/
- apps/api/src/institutional-auth/
- apps/api/test/
- apps/web/src/features/access/
- apps/web/src/features/auth/
- apps/web/src/features/hospital/
- apps/web/src/features/profesional/ (portal neutro sin participación ni pagos ficticios)
- apps/web/src/features/liquidations/liquidationsDemo.test.tsx (regresión: portada real sin entrada demo)
- apps/web/src/app/profesional/page.tsx (retirar bandera de presentación ficticia)
- apps/web/src/app/acceso/page.tsx (retirar la bandera de presentación ficticia)
- prisma/schema.prisma
- prisma/migrations/
- scripts/testing/
- scripts/identity/ (conciliación local del operador ante reset incierto)
- tests/testing/
- tests/e2e/
- infra/local-oidc/README.md
- docs/PLAN-TERMINO-FUNCIONAL.md
- docs/REVISION-MODULOS-REALES.md
- spec/specs/041-accesos-personales-reales/
- spec/specs/INDEX.md

## Criterios de éxito

PostgreSQL/IdP reales: tres perfiles, aprobación/rechazo/fallos/login, recuperación/cambio obligatorio, sesiones antiguas rechazadas, carreras y aislamiento. Tipos/build/pruebas/baseline sin omisiones/scanner/accesibilidad focal correctos. Backup y restauración comprobados antes de migrar base activa. No consumir el primer admin del usuario. Entregar detalle por módulo; aceptación PO separada. No declarar S02–S14 implementados.

## Contratos derivados de revisión independiente, 2026-10-12

- Autenticación reciente: step-up OIDC forzado con max_age=0/prompt=login,
  intento persistido ligado a sesión/cuenta/vínculo, auth_time verificado y
  ventana de cinco minutos. createdAt de HumanSession no demuestra reautenticación.
- AccessRequest fija externalAuthIdentityId mediante FK compuesta cuenta/tenant;
  no seleccionar el primer vínculo disponible ni otro alias de la misma cuenta.
- Recuperación pendiente/fallida mantiene bloqueo persistente consultado en
  callback, validación de sesión y approve/reactivate. ACTIVE no lo sustituye.
- Reset remoto temporal true, sin retry automático ante timeout; logout remoto
  explícito. Conciliación exige nueva acción del administrador y resultado visible.
- Saga personal con operationId/generación o lease CAS persistido. Solo el dueño
  vigente puede finalizar/fallar y modificar cuenta. Un worker tardío no puede
  deshabilitar una cuenta cuya aprobación ya confirmó otro proceso. Prueba con
  dos workers/barrera y éxito seguido de timeout; cuenta permanece ACTIVE.
- Excluir destinos con cualquier reserva institucional RESERVED/CONFIRMED o
  PlatformSupportCapability, incluso deshabilitada. Una aprobación personal no
  permite al Hospital apropiarse de cuentas de soporte o de Alcaldía.
- Una sola recuperación pendiente por cuenta; inicio atómico bloquea cuenta,
  revoca sesiones y audita. Finalización comparte bloqueo HumanAccount con
  suspensión/revocación; nunca reactiva una suspensión concurrente. Timeout
  conserva bloqueo, mismo operationId no repite reset. Resultado incierto exige
  acción expresa de nuevo reset y operación sucesora auditada, sin guardar secreto.
