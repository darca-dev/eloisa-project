# Investigación — Spec 029

## Hechos observados

- `merdn-postgres-1` alcanzó estado saludable.
- La imagen antigua de API falló al arrancar con un provider `KeycloakAdminClient` ausente, aunque el código fuente actual sí lo registra: la imagen era obsoleta.
- La reconstrucción del 2026-09-21 falló con diez errores TypeScript.
- El fallo raíz es la ausencia de `identity-access.service.ts`; `git show --stat ffef693` registra su eliminación de 199 líneas y los módulos actuales siguen importándolo.
- La fuente de autoridad para recuperar el contenido es la versión inmediatamente anterior, `ffef693^:apps/api/src/identity-access/identity-access.service.ts`.

## Decisión técnica

La recuperación restaura la última versión versionada y realiza solo los ajustes mecánicos requeridos para compilar. No se inventan reglas de identidad, tenencia, visitas ni provisión de cuentas.
