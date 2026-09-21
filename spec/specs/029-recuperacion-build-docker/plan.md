# Plan — Spec 029 Recuperación de compilación y Docker

## Fase 1 — Recuperación mínima de composición

1. Obtener la última versión versionada de `IdentityAccessService` inmediatamente anterior a `ffef693` y restaurarla sin rediseñarla.
2. Confirmar que sus exports satisfacen exclusivamente los consumidores existentes de identidad, paciente y visitas.
3. Resolver los dos símbolos sin uso de `professional-visit-query.service.ts` sin cambiar la consulta autorizada.

## Fase 2 — Endurecimiento de cliente opcional

1. Convertir el acceso a configuración ausente de Keycloak en `KeycloakProvisionError` controlado.
2. No modificar configuración, secretos, realm ni flujos OIDC.

## Fase 3 — Verificación reproducible

1. Añadir prueba de compilación de `AppModule`.
2. Ejecutar typecheck/build y pruebas focalizadas.
3. Reconstruir Compose y verificar healthcheck y `/health`.

## Riesgos y controles

| Riesgo | Control |
|---|---|
| Recuperar lógica de autorización incorrecta | Restaurar desde Git, no reescribir; ejecutar prueba existente de identidad. |
| Efecto no previsto sobre Keycloak | No habilitar Keycloak ni llamar red; probar solo el error de configuración ausente. |
| Imagen Docker desactualizada | Verificar mediante `docker compose up -d --build`, no `compose start`. |

## Dependencias y orden

La fase 1 precede a todo build. La fase 2 es independiente en lógica pero se valida junto con la fase 1. La fase 3 no comienza hasta que ambas correcciones compilen localmente.
