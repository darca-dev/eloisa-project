# 055 / MP01 — Revisión independiente de Codex

Fecha: 2026-10-21. Estado: **no aceptado todavía**. Esta revisión distingue la entrega de Claude de las comprobaciones independientes. No modifica código de producción ni autoriza MP02, Git o despliegue.

## Resultado observado

- El proceso de Claude iniciado por Codex terminó con exit code 0, pero su respuesta final informa que se detuvo por ediciones concurrentes de otra sesión. Ese exit code no demuestra la finalización del paquete.
- Existe una entrega posterior `MP01-FROM-CLAUDE.md` que describe reconciliación, implementación y pruebas satisfactorias. Se considera un informe del implementador; sus resultados no sustituyen esta verificación.
- No había procesos Claude activos al comprobar el estado.
- Codex ejecutó `npm.cmd run test --workspace @merdn/api -- src/care-context`: **41/41**.
- Codex ejecutó `node --test tests/testing/baseline-catalog.test.mjs tests/testing/run-baseline.test.mts`: **45/45**. Se verificó la ampliación de los catálogos aprobada por el Product Owner sin retirar sus comprobaciones exactas.
- PostgreSQL efímero, runner aislado, run-id `baseline-20261021t225839`: provision aprobado; `db/care-context-foundation.db.test.ts` **25 aprobadas / 1 fallida / 0 omitidas**; cleanup aprobado. No se aplicó la migración a la base de la aplicación.

## Hallazgos y cierre requerido

1. **Fallo reproducido en la aceptación P04.** El caso «el manager no obtiene acceso por su condición; un emisor que deja el cargo no anula lo emitido» espera `granted` y obtiene `denied`, en `care-context-foundation.db.test.ts:712`. Contradice el resultado 26/26 reportado. Debe diagnosticarse la vigencia histórica del emisor y la procedencia de sus instantes; no se ha confirmado todavía la causa. No eliminar la aserción ni aceptar acceso sin validar la emisión.
2. **Cobertura concurrente incompleta.** La política ya bloquea cuenta, sesión y vínculo, y exige competencia a profesionales tanto para MANAGE_RULES como REVIEW_ALARMS. La prueba PostgreSQL demuestra concurrencia de revocación de concesión, pero no cierre de sesión concurrente. Añadir el caso con barrera real de bloqueo y el caso de revocación que gana antes; no inferir esta garantía de mocks o esperas fijas.
3. **Catálogo RLS histórico fuera de la baseline.** `apps/api/test/force-rls-catalog.db.test.ts` conserva un conjunto exacto de 26 tablas y 27 políticas. El nuevo esquema contiene 35 tablas protegidas y 37 políticas. La baseline actual no ejecuta esa suite. Su actualización y ejecución requieren cerrar su alcance explícito; no puede presentarse la regresión de la baseline como cobertura de todas las suites PostgreSQL del repositorio.

## Estado del producto

MP01 aporta infraestructura interna sin endpoints ni UI y permanece pendiente de corrección y auditoría completa. Bitácoras persistentes, alarmas manuales, reglas individuales, evaluación automática y semáforo operativo siguen pendientes. No hubo commit, push ni despliegue durante esta revisión.
