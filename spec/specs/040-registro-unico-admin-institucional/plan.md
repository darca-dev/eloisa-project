# Plan 040

## Dependencias

Cuenta humana/OIDC existente, tenant confiable, PostgreSQL runtime enforce,
sesión institucional heredada y revisión de solicitudes del Hospital.
La regla funcional y autorización expresa a Codex vienen de las decisiones del
2026-10-12. Revisión especializada de identidad completada antes de implementar.

## Fases

1. Aprobar especificación y cerrar traducción nominal de la sesión institucional.
2. Migración aditiva para la reserva única por institución/experiencia y pruebas
   reales de unicidad, RLS y concurrencia en una base aislada.
3. Alta/provisión idempotente OIDC, auditoría transaccional y conciliación de fallos.
4. Acceso del único administrador; exclusión de identidades/sesiones heredadas
   después del alta sin eliminar historial.
5. Formulario compartido, enlaces de registro en Hospital/Alcaldía y estado cerrado.
6. Regresión, E2E, build y verificación local en Docker.

## Riesgos

- La provisión OIDC y PostgreSQL no comparten transacción: reserva y conciliación
  deben impedir duplicados ante timeout o caída entre pasos.
- Las identidades institucionales actuales se aprovisionan por configuración;
  conservarlas activas después del alta incumpliría la exclusividad decidida.
- Los guards actuales usan capacidades disjuntas. El administrador inicial no
  puede convertirse por inferencia en acceso universal clínico o entre tenants.
- La copia actual no tiene `.env`; Docker conserva configuración previa. El
  despliegue local debe preservar secretos, comprobar destino y no publicar el alta.

## Rollback

Desactivar el endpoint de alta; conservar reserva, cuenta e historial. No borrar
volúmenes ni reabrir un registro completado. Restauración solo mediante procedimiento
explícito y verificable, fuera de la interfaz pública.
