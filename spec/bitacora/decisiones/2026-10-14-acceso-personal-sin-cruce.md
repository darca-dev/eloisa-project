# Corregir ingreso personal — 2026-10-14

PO: «lo mismo pasa con el de pasientes». Se extiende la corrección de entrada049 al acceso personal: login directo desde hub, petición interactiva para /acceso y selector limitado a experiencias personales aprobadas por el servidor. Hospital/Alcaldía conservan sus entradas propias. Una cuenta solo municipal queda denegada en la entrada personal, con acción explícita para cambiar cuenta, sin bucle OIDC.

Autorización correctiva vigente para Codex y aplicación local respaldada. No migración, nuevas cuentas, aprobación de perfiles, cambio de permisos o publicación Git.

Compatibilidad de recuperación041: su único consumidor actual es Hospital; la verificación de identidad debe retornar explícitamente /hospital para no pasar por el selector personal. Ajuste necesario dentro del arreglo de destinos, sin nuevos permisos ni cambios del vínculo step-up/auth_time. Se amplía el caso existente de recuperación para comprobar intento y callback.
