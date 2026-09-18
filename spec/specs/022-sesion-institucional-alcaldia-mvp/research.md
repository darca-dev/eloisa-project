# Investigación 022 - Sesión institucional Alcaldía MVP

## Hallazgos

1. Spec 005 crea la experiencia visual y declara que solo Población/Territorio
   consultan API; permanece as-built y Pendiente.
2. Spec 008 implementa agregados protegidos, identidad/sesión institucional,
   `MUNICIPAL_VIEWER`, guards, auditoría, supresión, tenant/RLS y cliente de
   agregados. También permanece as-built y Pendiente.
3. Spec 008 documenta expresamente que `/municipality` no ofrece forma de abrir
   sesión y que esta es su brecha funcional principal.
4. `MunicipalityShell` no recupera contexto ni gobierna sus vistas por sesión.
5. `hospitalInstitutionClient.ts` ya implementa recuperación, apertura y cierre
   genéricos; el nombre/ruta son Hospital, pero su contrato incluye
   `MUNICIPAL_VIEWER` y no depende de datos Hospital.
6. El backend ya expone `POST /institutional/sessions`, `GET /current` y
   `DELETE /current`, con same-origin, cookie HttpOnly, hash server-side,
   auditoría y respuestas uniformes.
7. Los dos endpoints municipales ya exigen `MUNICIPAL_VIEWER`, ejecutan bajo
   `withTenant()` y RLS y no aceptan selector de tenant/sujeto.
8. No existe una spec aprobada que autorice exactamente la entrada y gestión de
   sesión institucional en la UI municipal. Crear la 022 evita ampliar
   retrospectivamente specs as-built pendientes.

## Decisiones derivadas

- Reutilizar la arquitectura existente; no crear OIDC ni backend municipal nuevo.
- Mover el cliente institucional genérico a `features/auth/` y conservar fachada
  Hospital para evitar dependencia Municipality→Hospital y duplicación.
- Limitar lo operativo a Población/Territorio y conservar las once vistas demo.
- No crear auditoría, migración, dependencia, seed, fixture ni dato nuevo.
- Separar evidencia automatizada de aceptación real de navegador.

## Decisiones de producto abiertas

Ninguna. El alcance solicitado por el Product Owner es cerrado; la aprobación
formal y el consentimiento específico quedaron registrados el 2026-08-27.
