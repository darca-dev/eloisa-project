# S00-MP04A — comando de tipos del runner

Updated-At: 2026-10-08
Current-Branch: feat/termino-00-mp04-baseline-real
Required-Base: 581eb65
Related-Spec: 039-termino-s00-base-y-baseline
Implementation-Agent: Codex
Status: READY

Orden del PO de continuar tareas definidas y Git local. Paquete técnico independiente de ownership/infraestructura: scripts/testing/run-baseline.mjs, únicamente argv API de typecheck; tests/testing/run-baseline.test.mts, comprobar parity y conservar aserciones. El comando actual falla con nueve TS5097; el script aprobado del workspace ya usa --allowImportingTsExtensions con --noEmit. Sin nueva configuración del compilador, esquema o dependencias.

Datos/tenant/auditoría: ninguna mutación. No DB/IdP, nuevos secretos, eventos de dominio, infraestructura, cambio de permisos o catálogo. Mantener entorno mínimo, matriz cerrada, fail-closed, timeouts y cleanup. Gates previos; pruebas node:test 72 sin omisiones y ejecución real de los tres comandos de tipos, lint/scanner. Reporte y commit local. MP04B sigue propuesta pendiente de decisión PO; no inferirla de continuidad.
