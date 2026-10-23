# 055 / MP07B — Compatibilidad de comprobaciones web B10

Fecha: 2026-10-23. Continuación técnica del contrato autorizado `MP07-CORRECCIONES-A01-A10.md`, con sus requisitos y exclusiones intactos. Claude implementa pruebas, Codex verifica; no nuevo comportamiento, permisos o dependencia.

## Evidencia

Tras B08–B09, Chromium `baseline-20261023t204020` pasa **12/12, 0 omitidas**, incluida unicidad del administrador, revocación clínica real, A02, A05, A06, A08, reintento, borradores, móvil, teclado y axe (sin serias/críticas detectadas en las vistas incluidas). Cleanup correcto; evidencia `.tmp/browser055-2026-10-23T20-40-20.391Z.json`. Build shared/API/web exit 0 con DSN ficticio inutilizable y API puerto 1.

La baseline `codex055-corrections`, evidencia `.tmp/final055-2026-10-23T20-42-38.902Z.json`, pasa provision, los tres typechecks y api-no-db-health 51/51, pero web da **1900/1902, 0 omitidas**, exit 1; cleanup correcto. Las etapas posteriores no corrieron. Se identifican dos expectativas anteriores que no contemplan la integración aprobada de 055; no se deben cambiar solo para ocultar defectos.

## B10 / P2 — Ajustar dos comprobaciones manteniendo sus garantías

1. `apps/web/src/features/hospital/hospitalAlcance.test.ts:308`: rechaza `HospitalShell.tsx: next/link` por su patrón anterior de imports. Next ya es dependencia aprobada (`apps/web/package.json`, 16.3.1). El enlace interno a `/hospital/cuidado` está aprobado por A05 y pasó el recorrido real con revisor sin administración. No hay nuevo paquete, transporte ni cliente clínico. Permitir exclusivamente `next/link` en `HospitalShell.tsx`, conservando la prohibición en otros archivos y para otros imports externos. Mantener intactas las comprobaciones de red, persistencia, telemetría, entorno, fachadas y reloj. Si se introduce un helper para la regla, comprobar tanto el caso autorizado como el rechazo de otro módulo/otro origen.
2. `apps/web/src/features/paciente/paciente.test.tsx:667`: cuenta dos atributos explícitos `aria-live="polite"` en SSR. Con A02, la región explícita del contexto está en el subárbol que se monta al seleccionar paciente; durante el SSR inicial `CareWorkspace` muestra `VistaEstadoGeneral`, que anuncia la carga mediante `role="status"` (polite implícito). El portal mantiene una región explícita para sus secciones de lectura. Ajustar la prueba para comprobar UNA región propia de lectura y el estado accesible de carga dentro del espacio de cuidado, sin exigir montar contexto/borradores antes de selección. No limitarse a cambiar 2→1 ni quitar las aserciones de accesibilidad. No añadir una región envolvente que anuncie listas clínicas completas para satisfacer un conteo antiguo.

## Allowlist adicional justificada

Además de los límites del contrato base, se autorizan exclusivamente estos dos archivos de pruebas afectados por la integración: `apps/web/src/features/hospital/hospitalAlcance.test.ts`, `apps/web/src/features/paciente/paciente.test.tsx`, y seguimiento en `contracts/MP07B-FROM-CLAUDE.md`. Se justifica la ampliación antes de editar: son los consumidores de verificación que la baseline completa acaba de identificar; no producción nueva ni módulos funcionales fuera de 055.

Antes de editar ejecutar los dos gates del contrato, leer este seguimiento y el código existente pertinente. No producción, esquema, migraciones, permisos, dependencias, secrets/env, DB/Docker/browser/servidores, agentes, prototipo, Git mutante ni consentimientos. Comprobar tipos web, lint de los dos tests y suite web completa; reportar exit/counts reales. Codex repetirá la baseline completa con evidencia y limpieza. El navegador ya aprobado solo se repite si cambia producción o su prueba. No aceptación del PO ni Git/despliegue implícitos.
