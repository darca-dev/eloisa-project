# Investigación 024 — Bootstrap de tenant con runtime enforce

## Hechos observados en `develop` `c030e48`

- `TenantContextService.resolveActiveTenant()` consulta `tenant` por código antes
  de llamar a `withTenant()` y solo cachea después de encontrar una fila.
- `PrismaService` selecciona `RUNTIME_DATABASE_URL` cuando existe; en `enforce`
  esa conexión separada es obligatoria y no cae a `DATABASE_URL`.
- `withTenant()` delimita una transacción, adopta `merdn_runtime`, fija
  `merdn.tenant_id` con alcance local y comprueba ambos antes del callback.
- `tenant_self` concede a `merdn_runtime` solo filas cuyo ID coincide con
  `merdn_current_tenant()`; sin GUC, la comparación con `NULL` no pasa.
- La migración de referencia genera el UUID con `gen_random_uuid()`: no puede
  deducirse del código ni fijarse en la aplicación sin leerlo administrativamente.
- Las suites API principales fuerzan actualmente `MERDN_RUNTIME_ROLE=disabled`;
  por ello no constituyen evidencia del arranque frío endurecido.

## Alternativas evaluadas

### `SECURITY DEFINER`

Rechazada para este defecto. Con parámetro de código crea una primitiva que puede
probar códigos; sin parámetro requiere una nueva fuente privilegiada de estado en
PostgreSQL y privilegios de ejecución cuidadosamente administrados. Es más amplia
que la necesidad y exige migración.

### Cliente propietario/migrador o lookup privilegiado

Rechazado. Introduce en el proceso API una credencial capaz de eludir RLS y rompe
la separación documentada entre migraciones y runtime. El uso sería corto, pero
el secreto y la autoridad existirían durante toda la vida del proceso.

### UUID explícito desde configuración confiable

Seleccionado. El UUID permite fijar primero el contexto transaccional existente;
RLS permite entonces verificar exclusivamente la misma fila y su código. No
añade autoridad de base, consulta global, función ni migración. La pareja evita
aceptar silenciosamente un UUID correcto para una institución equivocada.

## Decisión derivada

El bootstrap debe ser una verificación RLS de la pareja configurada, no un
descubrimiento por código. La obtención inicial del UUID pertenece al canal
administrativo/de despliegue y nunca al runtime ni a una petición.
