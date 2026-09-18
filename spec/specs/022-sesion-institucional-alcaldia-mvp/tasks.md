# Tareas 022 - Sesión institucional Alcaldía MVP

## Gate previo

- [x] T0.1 — Product Owner aprueba formalmente la spec 022.
- [x] T0.2 — Product Owner registra consentimiento específico mediante el mecanismo canónico.
- [x] T0.3 — `check-sdd-gate.sh` y `validate-sdd.sh --strict` pasan.

## MP1 — Cliente compartido

- [ ] T1.1 — Crear `features/auth/institutionalSessionClient.ts` desde la lógica existente.
- [ ] T1.2 — Mantener fachada Hospital compatible, sin cambiar consumidores.
- [ ] T1.3 — Probar contrato, cuerpo cerrado, cookies, cancelación y errores.
- [ ] T1.4 — Actualizar `hospitalAlcance.test.ts` para que el cliente institucional pase de conexión directa a la lista cerrada de fachadas.
- [ ] T1.5 — Ejecutar regresión focal Hospital.

## MP2 — Sesión municipal

- [ ] T2.1 — Recuperar sesión al montar y mantener estado `consultando` neutro.
- [ ] T2.2 — Implementar entrada con solo código y credencial, sin persistencia cliente.
- [ ] T2.3 — Confirmar rol exacto `MUNICIPAL_VIEWER`; denegar los demás.
- [ ] T2.4 — Implementar loading/error/retry/expired/unauthorized accesibles.
- [ ] T2.5 — Implementar logout confirmado, fallo seguro y reintento.
- [ ] T2.6 — No montar Población/Territorio antes de autorización.

## Validación consolidada — Codex, no Claude

- [ ] V1 — Población y Territorio conservan API real, supresión y no-fallback.
- [ ] V2 — `401/403` invalidan la experiencia operativa de forma uniforme.
- [ ] V3 — Las once vistas restantes siguen rotuladas como demo y sin cambios funcionales.
- [ ] V4 — Focales, Municipality y Hospital PASS.
- [ ] V5 — Web typecheck, lint focal y `git diff --check` PASS.
- [ ] V6 — Browser real PASS o `BLOCKED_BROWSER_ACCESS` explícito.
- [ ] V7 — Ningún commit/push/merge sin autorización separada.
