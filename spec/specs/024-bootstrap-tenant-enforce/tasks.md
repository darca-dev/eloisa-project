# Tasks — Spec 024

## Implementación pendiente

- [ ] Añadir `activeTenantId` UUID validado y obligatorio en `enforce`.
- [ ] Resolver/verificar exclusivamente ID+código configurados dentro de
      `PrismaService.withTenant(activeTenantId)` y cachear solo tras éxito.
- [ ] Mantener sanitizados los errores y sin fallback privilegiado.
- [ ] Propagar la variable a plantillas, Compose, preflight y runbook.

## Pruebas exactas requeridas

- [ ] Unit: primera llamada usa `withTenant(configuredId)` y consulta por ID+código;
      segunda llamada usa caché sin nueva consulta.
- [ ] Unit: ID ausente/malformado en `enforce` falla validación; configuración
      discordante/inexistente no cachea y devuelve el mismo error sanitizado.
- [ ] DB PostgreSQL real: API/servicio recién creado, conexión runtime separada,
      `MERDN_RUNTIME_ROLE=enforce`, tenant configurado se resuelve tras arranque.
- [ ] DB PostgreSQL real: ID inexistente, código inexistente y pareja cruzada con
      dos tenants ficticios fallan cerrados y no dejan contexto/caché residual.
- [ ] DB PostgreSQL real: consulta runtime de `tenant` sin GUC devuelve cero;
      bootstrap ve exactamente la fila propia; intentar listar/buscar el otro
      tenant dentro del contexto devuelve cero.
- [ ] DB PostgreSQL real: `current_user=merdn_runtime`, `rolbypassrls=false`, y rol
      y GUC no sobreviven al cierre de la transacción.
- [ ] API cold-start: Hospital institucional inicia sesión satisfactoriamente en
      la primera petición posterior a una instancia nueva.
- [ ] API cold-start: Alcaldía con rol exacto `MUNICIPAL_VIEWER` inicia sesión
      satisfactoriamente en la primera petición posterior a una instancia nueva.
- [ ] API cold-start: Paciente completa el callback OIDC humano y crea/recupera
      sesión satisfactoriamente en la primera petición posterior a instancia nueva.
- [ ] DB PostgreSQL real: lectura y escritura cross-tenant siguen bloqueadas por
      las políticas RLS existentes.
- [ ] Regresión: los tres flujos conservan eventos de auditoría actuales; el fallo
      técnico de bootstrap no crea eventos de identidad falsos.
- [ ] Ejecutar `npm run typecheck`, lint focal, suites unit/API/DB focales,
      `git diff --check`, `./spec/scripts/check-sdd-gate.sh .` y
      `./spec/scripts/validate-sdd.sh . --strict`.

## Evidencia que Claude debe devolver

- [ ] Archivos modificados dentro de allowlist y diff resumido.
- [ ] Comandos y resultados, identificando claramente cualquier prueba no ejecutada.
- [ ] Evidencia de rol efectivo, `NOBYPASSRLS`, cero enumeración y aislamiento.
- [ ] Confirmación de que no cambió migración, policy, grant, dato ni valor demo.
