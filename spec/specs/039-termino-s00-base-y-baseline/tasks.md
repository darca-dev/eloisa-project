# Tareas 039 — control verificable S00

## Preparación y auditoría realizadas

- [x] Registrar selección del proyecto y D-01 sin mezclar historias.
- [x] Crear rama S00 desde origin/develop local 9980582.
- [x] Copiar fuera de OneDrive conservando original; verificar HEAD/main/árbol limpio antes de documentos.
- [x] Instalar dependencias sin hooks, generar cliente Prisma y validar esquema.
- [x] Ejecutar tipos y builds API/web: correctos.
- [x] Ejecutar web: 1882 correctas, 3 fallos de 1885.
- [x] Ejecutar contratos API seleccionados: 656 correctos tras corregir configuración de prueba; no valida DB real.
- [x] Ejecutar contratos puros de baseline con node:test: 72 correctos.
- [x] Ejecutar lint y scanner: 17 errores y 52 coincidencias por clasificar.
- [x] Verificar Docker operativo y reconocer servicios activos sin alterarlos.
- [x] Preparar spec/plan/research/history y runbook; importar auditoría/plan/catálogo sin secretos.

## Autorización e implementación pendientes

- [x] Product Owner aprueba S00-MP01 exclusivamente para Claude Code (2026-10-08).
- [x] Product Owner autoriza a Codex a continuar MP02 y tareas definidas, con commits/ramas locales; decisiones materiales abiertas conservadas.
- [x] Product Owner registra consentimiento SDD de 039 limitado a S00-MP01 (2026-10-08 14:47:34 -0400); Codex verifica sin sustituirlo.
- [x] Emitir handoff S00-2026-10-08 READY para Claude Code, paquete único S00-MP01, allowlist y hard stop.
- [x] Codex verifica gate EXIT 0 y strict EXIT 0; Claude debe repetirlos inmediatamente antes de código.
- [x] S00-MP01 implementado por Codex: lint 0, tipos/build API correctos, 65 contratos correctos; DI preservada.
- [x] S00-MP02: 1888/1888 pruebas web, tipos/lint/build correctos; branding configurable y ruta municipal sin bypass.
- [x] S00-MP03: 55 puntos clasificados (52 originales + 3 revelados); scanner EXIT 0, 16 adversariales correctas, E2E contraseña aleatoria en memoria; detección negativa preservada.
- [ ] Definir operación S00-MP04 con topología exacta 025/038, env-file, runId y límites de cleanup.
- [x] MP04A: comando API del runner alineado con workspace; 72 contratos y tres comandos reales correctos, sin DB.
- [x] Preparar propuesta MP04B: tabla/policy omitidas, catálogo 27/28, owner no privilegiado y topología local exacta.
- [ ] Product Owner resuelve contradicción de catálogo/owner y aprueba operación MP04B; no inferir respuesta del silencio.
- [ ] Validar DB/RLS/runtime y aislamiento real sin skips; identificar imagen exacta.
- [ ] Codex verifica correcciones y reporta riesgos residuales.
- [ ] Product Owner acepta S00; autoriza integración Git cuando proceda.

## Siguiente sección

- [ ] Reconciliar S01 con 038; resolver D-02/D-03/D-04 por paquete.
- [ ] Abrir rama S01 desde base aceptada e integrar catálogo de 32 escenarios como fixtures.
- [ ] Proveer cuentas reales de test en IdP y secretos en archivo local protegido; verificar logins/denegaciones y aislamiento.

## Cierre MP01

- [x] Codex coteja siete archivos permitidos y verifica cuerpo del job sin cambios.
- [x] Informe S00-MP01-FROM-CODEX.md registra pruebas y límites; HARD STOP cumplido.
- [x] Product Owner acepta S00-MP01 el 2026-10-08; S00 completo sigue pendiente.
