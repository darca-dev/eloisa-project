# Historia 054

## 2026-10-15

- La revisión preentrega identificó que el endpoint heredado podía crear pacientes activos sin aprobación y que `patient-self` solo comprobaba la participación activa.
- El Product Owner ordenó ejecutar el plan de revisión preentrega mediante ramas y commits limpios.
- Se abrió `feat/preentrega-access-hardening` desde `051aad3` para resolver PE01 y PE02 como un bloque de seguridad coherente.

## 2026-10-20 — verificación local y publicación autorizada

- El Product Owner pidió levantar Docker con el proyecto actual y luego ordenar los cambios de la rama en commits y actualizarla en GitHub.
- Se revisaron los diffs existentes; no se cambió el comportamiento de producción durante esta organización. Se eliminó únicamente una línea vacía final de la prueba nueva para superar `git diff --check`.
- Se completaron fases, dependencias y riesgos del plan, el registro de investigación local y la entrada del índice. El primer gate detectó el plan incompleto y la validación estricta detectó la falta de `research.md`; ambos fallos documentales se corrigieron.
- Pruebas focales: 4 archivos, 107 casos correctos. Incluyen resolución de aprobación exacta, experiencias aprobadas, servicio propio del paciente y OpenAPI. No constituyen la suite completa del repositorio.
- Baseline aislada `baseline-20261020t195323`: inscripción retirada 8/8; API propia del paciente 42/42; DB propia del paciente 31/31; pacientes de Hospital 40/40; profesionales de Hospital 26/26; API municipal 25/25. Total: 172 correctos, 0 fallos y 0 omisiones. Provisionamiento y limpieza controlada correctos; no se ejecutaron esas suites contra la base de la aplicación.
- Typecheck de API, lint de los archivos modificados, escaneo de secretos y compilaciones Docker de API/web correctos. Gate SDD abierto con 0 errores y 19 avisos de aprobaciones históricas/consentimiento heredado; validación SDD estricta con 0 errores y 0 avisos. Estos controles no certifican suficiencia contractual ni aceptación del producto.
- Se reconstruyeron e iniciaron API y web con las variables, red, puertos y controles previos. PostgreSQL y Keycloak conservaron sus contenedores; no se ejecutaron migraciones ni cambios de datos. La configuración y las imágenes anteriores quedaron respaldadas en almacenamiento local privado, excluido de Git.
- Smoke HTTP: portada y `/health` responden `200`; descubrimiento OIDC responde `200`; `/inscripcion` responde `308` hacia `/acceso?accion=registro`; el endpoint heredado responde `410` con `PATIENT_ENROLLMENT_RETIRED` sin cookie. Los cuatro servicios de aplicación quedaron saludables.
- Commits publicados en `eloisa/feat/preentrega-access-hardening`: `72bb5c2` (especificación), `94254eb` (API y pruebas), `711deec` (redirección web). Se configuró seguimiento del remoto `https://github.com/eloisa-platform/Eloisa.git`. Sin merge, PR ni modificación de `main`.
- Pendientes explícitos: revisión independiente, actualización de la revisión preentrega y aceptación final del Product Owner. La publicación de la rama no cierra esos puntos.

## 2026-10-26 — Revisión independiente de Codex

- Tras aceptación funcional de055, se retoma054 sin modificar su código. Codex
  contrasta aprobación exacta, transacción de lectura/auditoría, retiro410,
  redirección Next, RLS, pruebas y orden de locks de revocación.
- Focales actuales:4archivos/108pruebas,0fallos/omisiones,exit0. Se reutiliza la
  baseline PostgreSQL de hoy `codex055-review-20261026`: inscripción8/8,
  patient-selfAPI42/42, DB31/31 y runtime10/10. Se comprueba diff0 de fuentes y
  pruebas054 respecto a e94e400; no se simula una nueva ejecución DB.
- Dictamen en `REVISION-CODEX-2026-10-26.md`: apto con observaciones, sin defecto
  bloqueante confirmado. La prueba concurrente existente utiliza SQL manual;
  no prueba el endpoint/resolver reales en ambos órdenes. Logout/caducidad en
  una petición ya admitida tampoco se demuestran con esa prueba. La inyección
  de fallo de auditoría es unitaria. No se amplían garantías por inferencia.
- Se actualiza revisión preentrega: PE-01/PE-02 corregidos/verificados dentro de054,
  sin declarar completo S01 ni los otros dominios. Se cierran las dos tareas
  documentales de revisión; queda aceptación explícita del PO de054.
- Sin cambios de producción054, DB de aplicación, migraciones, Git mutante ni
  despliegue. La aceptación de055 no se traslada automáticamente a054.
- Verificación final: SDD estricta0errores/0avisos, scanner1405archivos sin
  hallazgos y diff-check correctos, exit0.
