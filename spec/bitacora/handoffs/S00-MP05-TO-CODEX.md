# S00-MP05 — registro sin presentación demo y usuarios test completos

Updated-At: 2026-10-09
Current-Branch: feat/termino-00-mp05-accesos-sin-demo
Required-Base: 389d5fe
Related-Spec: 039-termino-s00-base-y-baseline
Implementation-Agent: Codex
Status: READY — petición PO explícita, incluidas sus correcciones

## Objetivo y alcance

Retirar avisos generales de datos ficticios en hub, registro y revisión hospitalaria; conservar solicitud/aprobación reales. Mantener los tres botones por perfil como usuarios test; precargar todos los campos aplicables y contraseña aleatoria por pulsación, sin enviar automáticamente. Ayuda de contraseña neutral, control Mostrar existente y borrado tras cada intento sin cambios.

Allowlist exacta: apps/web/src/features/access/AccessRegistrationWizard.tsx; accessRegistrationProfileData.ts; accessRegistrationProfileFields.tsx; accessRequestDemoFixtures.ts; nuevos accessRegistrationTestUser.ts y accessRegistrationTestUser.test.ts en ese directorio; CentralAccess.test.ts; apps/web/src/features/hub/HubAccessPortal.tsx; apps/web/src/features/hospital/HospitalAccessRequests.tsx; hospitalAccessRequests.test.tsx; hospitalAdministration.test.tsx. Documentación permitida de 039, decisiones/handoffs, plan/runbook e índice. No tocar código API, contrato source, schema/migraciones, IdP, prototipo, specs históricas, env-files/secretos, main o scanner.

## Datos, permisos y seguridad

Usuarios: Paciente/Cuidador/Visitador y revisor Hospital; experiencia Alcaldía conservada. Los nueve fixtures test existentes no se convierten en personas reales. Solo a petición del usuario se cargan en estado React; clonar datos para no mutar fixtures ni conservar datos del registro anterior. Completar los campos opcionales aplicables ausentes de Visitador con valores test, sin nuevas reglas clínicas. La contraseña procede de Web Crypto getRandomValues, al menos 128 bits aleatorios y cumple el validador vigente; nunca constante, Math.random, persistencia o log. No se conceden permisos por usar test ni se altera tenant, consentimiento manual, cuerpo/API, estado, idempotencia o bloqueo. La precarga test conserva las autorizaciones sintéticas ya presentes en esos fixtures; no cambia la casilla inicial del registro manual.

El formulario sigue usando submitAccessRequest: POST real y error ante indisponibilidad; no simular éxito ni crear sesión/aprobación. Mantener roles/relaciones, minimización y enfoque/semántica/etiquetas actuales. Texto de búsqueda de paciente conserva su limitación efectiva sin llamarla demo. No certificar integración OIDC ni producción por retirar avisos. No nuevos eventos de negocio: botón solo cambia borrador; eventos existentes del servidor permanecen. Sin integraciones, dependencias o migraciones nuevas.

## Aceptación, pruebas y operación

Repetir gate y strict antes de código. Tests de los nueve usuarios: cinco pasos válidos, cuerpo aceptable por cliente, contraseña variable válida, datos clonados/sin arrastre, rechazo de perfil/id incorrecto y ausencia de credencial en fixture. Mantener tests de API client, bloqueo, errores, limpieza de contraseña y permisos; actualizar únicamente expectativas visibles obsoletas. Ejecutar suite web, tipos, lint/scanner y diff check; build Docker web del árbol exacto y verificación de hub/registro local. No enviar datos de personas reales ni solicitudes test a DB compartida solo para probar texto. UI operativa verificada separada de integración aún pendiente.

Recrear solo web con imagen actual, puertos loopback y red/config existente; conservar DB/API/IdP/volúmenes. Rollback por diff inverso de estos archivos e imagen web previa; no reset ni borrados. Git local por autorización vigente, sin push/main/merge/despliegue de producción. Entregar archivos, comandos/conteos, imagen/huella y límites. Hard stop ante fallo fuera de allowlist; procedencia TEST_DATA del backend se eleva por separado.
