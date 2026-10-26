# 054 — Revisión de Codex

Task ID: `054-REV-CODEX-20261026`. Fecha: 2026-10-26.
Rama: `feat/preentrega-access-hardening`; HEAD e94e400. El árbol incluye el cambio
textual B11 de055 aún sin commit y documentación de ambas revisiones. No se
modifica código de054, configuración ni datos de la aplicación en esta revisión.

**Dictamen: apto técnicamente con observaciones para aceptación del PO.** No se
confirmó defecto bloqueante en las superficies revisadas. PE-01/PE-02 quedan
corregidos y verificados en el alcance de054. No se declara aceptada054 por el PO,
cerrado S01 completo, ni autorizado Git/despliegue.

## Inspección y evidencia

Se contrastaron spec/plan/tasks/history054 y PE-01/02 con los controladores de
inscripción y patient-self, resolución de identidad/aprobación, guard/validador
de sesión, desactivación por suspensión/revocación/recuperación, auditoría,
configuración Next y pruebas API/DB/unitarias correspondientes.

| Criterio de054 | Implementación y comprobación |
|---|---|
| 1. Endpoint heredado sin altas | `PatientEnrollmentController.create()` no recibe cuerpo ni llama al servicio: devuelve410/PATIENT_ENROLLMENT_RETIRED. API8/8 prueba contrato, no reflexión, no altas y concurrencia |
| 2. Redirección | `apps/web/next.config.ts:32` declara redirección permanente `/inscripcion`→`/acceso?accion=registro`; conserva el código visual anterior fuera del recorrido normal |
| 3. Participación sin aprobación denegada | `resolveApprovedPatientWithin` exige cuenta activa y aprobación PATIENT; API prueba403 en las tres rutas para paciente sin aprobación |
| 4. Identidad exacta | Cuenta/persona/tenant/binding exactos en filtros; binding ACTIVE de esa cuenta; unitarias verifican filtro, API verifica alias y cuenta ajenos, DB/IDOR verifica aislamiento |
| 5. Estados no aprobados | Solo APPROVED concede; API prueba PENDING/REJECTED/SUSPENDED/REVOKED en summary; las tres rutas comparten la misma autorización |
| 6. Proyección propia mínima | Summary de tres campos; citas/visitas sin identificadores ni datos ajenos; API y DB verifican contenido y self-scope |
| 7. Denegación auditada | `withApprovedPatient` devuelve denegación desde la transacción y lanza después del commit; API comprueba evento DENIED, actor y ausencia de PII |
| 8. Fallo cerrado y RLS | Guard fija no-store y401 uniforme; controlador traduce403/503; fallo de auditoría no devuelve datos; pruebas RLS/runtime/API correctas |

Pruebas focales ejecutadas ahora por Codex, con DSN ficticio inutilizable:

`npm run test --workspace @merdn/api -- src/identity-access/approved-patient-access.service.test.ts src/identity-access/approved-experiences.service.test.ts src/patient-self/patient-self.service.test.ts test/openapi.test.ts`

Resultado: **4 archivos,108/108,0 fallos/omisiones,exit0**. El error simulado de
conexión puerto1 y el error esperado de rol inseguro forman parte de los caminos
de fallo probados; no se consultó la base de la aplicación.

Evidencia PostgreSQL ejecutada antes hoy por Codex y reutilizada en esta revisión:
baseline `codex055-review-20261026`,
`.tmp/review055-2026-10-26T16-32-41.083Z.json`, commit e94e400:

| Suite | Resultado |
|---|---|
| patient-enrollment.api | 8/8 |
| patient-self.api | 42/42 |
| patient-self.db | 31/31 |
| runtime-fail-closed.db | 10/10 |

Cero fallos/omisiones y provision/preflight/cleanup correctos. Se comprobó
`git diff --quiet e94e400 --` sobre las fuentes y pruebas de054, human-auth,
access-requests y next.config: exit0. B11 solo cambió una etiqueta de cuidado y
sus consumidores; no altera estas rutas. No se repite la base efímera por una
revisión sin cambios de054 ni se presenta esa reutilización como otra ejecución.

## Concurrencia y límites de cobertura

- El resolver toma FOR SHARE sobre la cuenta antes de leer aprobación; no
  bloquea AccessRequest. La revisión de solicitudes toma AccessRequest FOR
  UPDATE y después cuenta FOR UPDATE antes de modificar estado. Suspensión,
  revocación y desactivación/sesiones/auditoría confirman en la misma transacción.
  No se observó inversión de esos bloqueos en el recorrido examinado.
- La prueba `patient-self.db.test.ts:953` demuestra contención entre SHARE/UPDATE
  mediante transacciones SQL manuales. No invoca el resolver real, el endpoint ni
  la revisión institucional completa. No certifica por sí sola ambos órdenes de
  una carrera extremo a extremo. Se recomienda completar esa cobertura en un
  paquete de pruebas acotado; no se confirmó un defecto de autorización.
- La validación de sesión ocurre en el guard antes de la transacción de negocio.
  El resolver revalida cuenta/aprobación/binding, pero no vuelve a comprobar la
  fila de sesión dentro de esa transacción. Esta revisión no demuestra la
  semántica de logout o caducidad concurrentes durante una petición ya admitida;
  no se afirma una garantía de linearización de sesión que054 no prueba.
- La prueba de fallo de auditoría es unitaria; el rollback ante fallo de traza
  no se inyectó nuevamente en PostgreSQL en esta revisión. La atomicidad se
  observa en el código y las denegaciones persistentes sí se prueban por API.
- La redirección se verifica por configuración actual y smoke histórico308 del
  20/10. No se inicia un servidor ni se repite aquí ese smoke HTTP.
- `GET /patients/me` conserva recuperación limitada por cookie de inscripción
  histórica, como documentan las pruebas y el alcance previo. No emite altas
  nuevas ni autentica patient-self; no se presenta como permiso humano aprobado.

## Verificación documental final

SDD estricta: exit0,0errores/0avisos. Escáner de secretos: exit0,1405archivos
versionables sin hallazgos. Diff-check: exit0. Los únicos cambios de producto
del árbol siguen siendo los cuatro archivos B11 de055; no se editó producción054.

## Resultado y siguientes pasos

Revisión independiente y actualización de revisión preentrega completadas. No
hay corrección de código exigida por este dictamen. Se conservan las
observaciones de cobertura para no equiparar batería verde con ausencia de riesgo.
Queda aceptación explícita del PO de054. La aceptación de055 no la sustituye ni
autoriza Git/despliegue. El siguiente bloque funcional pendiente es053, con
PE-04/PE-05 y su entrega aún sin cerrar.
