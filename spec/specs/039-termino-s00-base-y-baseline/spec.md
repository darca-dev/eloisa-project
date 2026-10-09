# Especificación 039 — S00: base y baseline para el término funcional

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: 2026-10-08.
- Aprobado por / Approved by: Product Owner; exclusivamente S00-MP01; Codex sustituye a Claude por autorización explícita posterior.
- Evidencia / Approval evidence: «Apruebo S00-MP01 para Claude Code», respuesta explícita del Product Owner en esta sesión. MP02 aprobado por la instrucción posterior de continuidad; MP03 requiere clasificación/allowlist previa y MP04 alcance operativo suficiente.
- Consentimiento SDD de implementación: REGISTRADO personalmente por el Product Owner el 2026-10-08 14:47:34 -0400, exclusivamente S00-MP01 para Claude Code; ver spec/.sdd/user-consent.log. El agente solo verificó el registro.
- Estado operativo: auditoría y preparación realizadas; baseline funcional NO aceptada.

## 1. Task ID y objetivo

TERMINO-S00 / SPEC-039. Convertir la base elegida en una línea verificable antes de S01. Entregar evidencia reproducible y corregir defectos acotados sin alterar permisos, historia de migraciones ni arquitectura. El resultado útil es poder probar accesos reales con datos ficticios persistentes y reconocer qué sigue sin validar.

## 2. Contexto y autoridad

El Product Owner eligió Eloisa-develop del escritorio, pidió nueva rama y autorizó sacarla de OneDrive. Proyecto activo: C:\Users\10plu\Eloisa-develop\eloisa_project. Rama: feat/termino-00-base-y-baseline. HEAD base: 9980582bc40f41c80b90078f0c24374cbad9df9e, tomado de la referencia local origin/develop. El fetch falló; no se afirma sincronización remota.

La copia OneDrive queda como respaldo. main sigue en 1aa1201b8aa4483ecac6ffc59e15cb16cd79270b. No se fusionó la otra historia. ENTREGA.md conserva el diagnóstico de los snapshots anteriores y no certifica los resultados actuales. La instrucción futura es funcionamiento real, sin demo, con datos de prueba ficticios; overrides históricos no autorizan simulación en la entrega final.

AGENTS.md/CLAUDE.md y docs/ conservan precedencia. Esta spec coordina S00 y sus correcciones; no reemplaza la 025 ni cambia silenciosamente la 038. TO-CLAUDE.md v65 referencia otra rama y otro paquete: no sirve como autorización de estos cambios. La 027 sigue en cuarentena. Las aprobaciones anteriores no se transfieren a 039.

## 3. Usuarios, módulos y alcance

Afecta transversalmente a Paciente, Cuidador, Profesional, Hospital y Alcaldía. Conserva las experiencias diferenciadas y capacidades institucionales compartidas: evidencia, indicadores, FURAG/MIPG, ADRES, formación SENA, finanzas, agenda, servicios y reportes permanecen en S02–S14.

Incluye documentación de base, checks existentes, correcciones focales de lint/branding/puerta municipal, clasificación del escaneo y una futura baseline aislada. No añade CRUD, reglas clínicas, pagos, indicadores oficiales, privilegios, automatismos de aprobación ni rediseño visual. La provisión de cuentas y el recorrido integrado de accesos pertenecen a S01.

## 4. Requisitos funcionales y fallas

RF-01: siempre verificar directorio, rama, HEAD y cambios ajenos antes de cada paquete. No asumir que servicios Docker existentes corresponden a este HEAD.
RF-02: restaurar lint sin desactivar reglas, excluir archivos versionados a conveniencia ni alterar lógica de expiración. La dependencia runtime de NestJS debe conservarse mediante tokens explícitos cuando corresponda; no convertir mecánicamente imports a type y perder el token de inyección.
RF-03: branding debe proceder de config. El portal actual no tiene obligación de insertar Isa artificialmente. Probar sustitución de la marca en superficies que realmente la muestran y conservar estructura/accesibilidad. El literal Portal Eloisa debe derivarse de la configuración existente.
RF-04: la ruta municipal entregable usa la puerta de sesión real. Retirar la inyección SESION_DEMO_LOCAL y su selección por bandera de esa ruta; no reemplazarla por otra sesión ficticia ni retirar controles backend. Esta corrección aplica el objetivo sin demo del PO. Otras vías simuladas se inventarían/remediarían en S01, sin afirmar retiro total por este cambio.
RF-05: resolver los 52 hallazgos del escáner uno a uno por procedencia. Un nombre de variable de entorno no es una credencial; plantillas y casos negativos requieren clasificación precisa. No permitir todos los tests o toda la documentación. Mantener detección de claves reales, URLs autenticadas y archivos secretos.
RF-06: ejecutar integración DB únicamente en la topología aislada aprobada por 025, tras reconciliar el paquete vigente y la allowlist de operación. Si inventario, labels, owner, grants, catálogo o identidad difieren, detenerse. Nunca utilizar el PostgreSQL activo de la aplicación como reemplazo.
RF-07: no convertir skip, timeout, hooks fallidos o prueba con mocks en aceptación integrada. Registrar código de salida, conteos, omisiones y causa.
RF-08: los contenedores de aplicación e IdP ya activos se conservan; no reiniciarlos ni borrar su estado para hacer pasar S00. La prueba de imagen exacta necesita identificar build SHA y configuración aprobada.

## 5. Datos, propiedad, procedencia, linaje y retención

Entrada: Git local, lockfile, manifests, código versionado, specs, checks y fixtures existentes. Salida: conteos y resultados sanitizados por paquete/HEAD. No ingerir pacientes reales, dumps ni documentos sensibles.

Los datos de negocio siguen siendo del tenant y las relaciones autorizadas de cada módulo. S00 no crea ni cambia registros de negocio. Fixtures futuros solo ficticios, marcados TEST_DATA; nunca permisos por procedencia. Credenciales efímeras deben permanecer fuera de Git en mecanismo aprobado. El catálogo de 32 escenarios describe casos, no logins activos.

Linaje de evidencia: base Git → comandos exactos → resultado observado → revisión Codex → aceptación PO. Conservar los resúmenes en history/tasks/runbook; no guardar SQL, filas, passwords, tokens, URLs autenticadas o UUIDs internos en evidencia. No borrar evidencia histórica; cualquier redacción por una exposición confirmada requiere decisión explícita y rotación cuando aplique.

## 6. Permisos, aislamiento y consentimientos

No modifica el modelo de roles ni sesiones. Mantener autorización server-side, tenant/RLS/FORCE, consentimientos, relaciones y asignaciones vigentes. Login no concede permiso por sí solo. No elevar runtime a owner, superuser o BYPASSRLS para ejecutar pruebas.

La eliminación del atajo UI municipal conserva su puerta institucional y las denegaciones existentes. Nuevos contextos Hospital/Alcaldía nominales, compatibilidad de pacientes legados y ciclo de sesión se deciden en D-02/D-03 de S01, no por esta spec.

## 7. Auditoría y seguridad

Registrar operación técnica, fecha, actor agente, rama/base, archivos, comando, resultado y causa minimizada. No añadir eventos de negocio ficticios. No cambiar el cron de expiración, sus mutaciones ni su modelo de auditoría en el paquete de lint; el hallazgo de auditoría de expiración continúa en S02.

Amenazas: conexión accidental a la DB activa; relajación del scanner; pérdida de tokens DI; pruebas adaptadas para aceptar bypass; secretos en logs; confusión de imagen/HEAD; mezcla de historias. Controles: destino inutilizable para contratos sin DB, env-file explícito e identidad/labels para integración, allowlist, revisión de diff, gates y matriz negativa del scanner. No publicar hallazgos con valores secretos.

## 8. Integraciones y referencia visual

Stack existente: Node 24, npm, NestJS, Next.js, Prisma, PostgreSQL e IdP OIDC. Sin dependencias nuevas ni actualización de versiones. Docker Desktop 29.7.2 está operativo en esta máquina. Un build correcto no demuestra integración real.

prototype-claude/ es referencia visual de solo lectura. Conservar semántica, foco, etiquetas, navegación y respuesta adaptable. No cambiar layout para satisfacer una aserción de marca. No modificar el prototipo ni implementar reglas clínicas/regulatorias a partir de él.

## 9. Archivos permitidos por paquete propuesto

S00-MP01 está aprobado y consentido; implementador actual Codex por autorización explícita del PO. Repetir gate/strict antes de código. MP02 fue autorizado por el PO para Codex, con continuidad Git local. MP03 requiere clasificar/fijar allowlist y MP04 especificación operativa suficiente. Ejecutar/verificar/registrar un paquete antes del siguiente.

S00-MP01 / lint y DI:
- .tmp-inspect-keycloak.cjs
- .tmp-verify-eloisa-login.cjs
- apps/api/src/people-relationships/expire-relationships.job.ts (solo imports/tokens DI; no cuerpo del job)
- apps/api/test/identity-relationships-db.test.ts (tipado/reporte de omisión; no alterar assertions, fixtures ni scope)
- apps/api/test/application-composition.test.ts (solo si necesita verificar tokens del job)
- apps/web/e2e/accessibility.spec.ts
- apps/web/e2e/patient-persistent-account.spec.ts (solo imports/variables; no credenciales/provisión de cuentas)

S00-MP02 / tres regresiones web:
- apps/web/src/features/hub/HubAccessPortal.tsx (solo centralización del nombre; no nuevo flujo)
- apps/web/src/config/branding.test.tsx
- apps/web/src/app/municipality/page.tsx (retiro del bypass local de esa ruta)
- apps/web/src/features/municipality/municipalityPrivacidad.test.tsx
- apps/web/src/app/municipality/page.test.tsx (reconciliar la expectativa heredada del bypass retirado; mantener negativa y restaurar entorno)

S00-MP03 / clasificación del scanner: primero informe en research.md; la allowlist de remediación debe fijarse después de conocer cada causa y antes de editar. No se autoriza modificar los 52 puntos a ciegas ni ampliar la allowlist mediante interpretación.

Clasificación MP03 realizada (52/52) en research.md. Allowlist vigente bajo la autorización explícita de continuidad del PO:
- tests/secrets-scan.check.mjs: excepciones por ruta/regla/hash de línea, comprobación de catálogo, matches múltiples y marcadores exactos; sin excluir carpetas ni imprimir valores.
- tests/secrets-scan.exceptions.json: 53 entradas de evidencia no secreta para 54 ocurrencias clasificadas (incluidas tres detectadas al endurecer marcadores), con motivo y procedencia; sin valores.
- tests/secrets-scan.test.mjs: adversariales CLI en repositorios Git temporales, sin conexiones reales ni commits/remotos.
- apps/web/e2e/patient-persistent-account.spec.ts: sustituir únicamente contraseña fija por randomBytes en memoria; mantener datos, aserciones y flujo, sin provisión/ejecución E2E nueva.

No modificar los otros fixtures, environment.ts, FROM-CLAUDE histórico o plantillas. Las pruebas deben rechazar nueva credencial en cualquier ruta, mutaciones/reubicación de excepción, segundo secreto en línea, placeholders incrustados en valores y catálogo inválido. Mantener reglas de tokens/claves, plantillas y lockfile. Sin cambios a seguridad de aplicación/tenant/IdP. Este paquete corrige clasificación del tooling y retira credencial E2E fija; no define MFA ni decide D-02/D-03/D-04.

S00-MP04 / DB e imagen: autorización limitada por subpaquete. MP04A no opera infraestructura; MP04B sí autoriza provisionar, migrar y limpiar exclusivamente la topología desechable definida en S00-MP04B-TO-CODEX.md, por decisión PO de 2026-10-09. No autoriza cambiar Dockerfiles, operar servicios compartidos ni corregir fuera de su allowlist. Si faltan límites, parar solo esa parte.

MP04 se divide para avanzar sin decidir ownership pendiente:
- S00-MP04A (autorización de continuidad): corregir solo el comando de typecheck API del runner, equiparándolo al script existente de @merdn/api con --noEmit --allowImportingTsExtensions. Allowlist: scripts/testing/run-baseline.mjs y tests/testing/run-baseline.test.mts. No modifica matriz de 29 stages/23 DB, entorno hijo, timeouts, catálogo, roles, provisionamiento o cleanup. Repetir gate/strict antes de código; contratos 72 sin skips, tipos reales de los tres comandos, lint/scanner correctos. Sin infraestructura.
- S00-MP04B (APROBADO por orden PO 2026-10-09): catálogo efectivo 27 tablas/28 policies, incluidas access_request/access_request_tenant, 17 migraciones exactas; owner no privilegiado también para esa tabla en cluster desechable. Decisión 2026-10-09-s00-mp04b-catalogo-completo.md resuelve la contradicción 025/038 sin reescribirlas. Handoff S00-MP04B-TO-CODEX.md activa contrato suficiente de la propuesta: cuatro archivos técnicos, topología/env-file/runId/timeouts/cleanup exclusivos definidos. No aplicación/IdP ni permisos nuevos.

Documentación S00 permitida: este bundle completo; docs/PLAN-TERMINO-FUNCIONAL.md; docs/plan-funcional/00-BASE-Y-BASELINE.md; docs/plan-funcional/01-ACCESOS-REALES.md; catálogo/trazabilidad importados; spec/specs/INDEX.md; decisión de base y handoff S00 separados. ENTREGA.md se importa sin reescribir su auditoría histórica.

## 10. Archivos y acciones prohibidos

prototype-claude/, tasks/, reviews/, .git/refs/heads/main, migraciones históricas, secretos y .env existentes. No editar specs 025/038 ni handoffs anteriores para simular continuidad/aprobación. Fuera de la allowlist, ningún código de producto puede cambiar.

Prohibidos borrado de archivos significativos, reset de DB activa, cierre de contenedores ajenos, prune, force-push, rebase, mezcla de historias, commit/push/PR/merge/despliegue sin autorización aplicable. La autorización previa de push a eloisa-platform/Eloisa no cubre el origin de este proyecto.

## 11. Dependencias, migración, compatibilidad y rollback

D-01 resuelta solo para base local. Sincronización remota pendiente. D-02/D-03/D-04 siguen abiertas para accesos. MP03 clasificación precede remediación; MP04 operación se define con 025/038 y no reutiliza sin comprobar un READY histórico.

MP01/MP02 no requieren migración. Rollback se hace con diff inverso específico y preservación de cambios ajenos, nunca reset del árbol. No reactivar el bypass municipal como fallback ante fallo del login. El efecto de la ruta municipal es exigir la sesión real existente. No cambia su API ni permisos.

## 12. Criterios de aceptación y pruebas requeridas

CA-01: rama/base ubicadas y main inalterado; cambios limitados y sin secretos.
CA-02: npm ci con lockfile sin cambios, Prisma validate/generate, tipos y builds pasan.
CA-03: lint completo 0 errores; no exclusiones ni reglas desactivadas. Tokens del job y composición API siguen funcionando. Pruebas de contrato del job/composición cuando aplique.
CA-04: suite web completa 0 fallos; branding sustituible y municipal sin sesión inyectada. Casos sin sesión, sesión válida/expirada y bandera heredada no conceden entrada ficticia. Conservar cobertura y no saltar assertions.
CA-05: scanner 0 hallazgos pendientes tras clasificación. Probar que credenciales reales y URLs con password siguen rechazadas, referencias de variables no son secretos y excepciones ficticias son específicas.
CA-06: contratos API sin DB y scripts de baseline pasan sin skips relevantes; se reporta que son pruebas con mocks y no certifican aislamiento real.
CA-07: antes de aceptación completa S00, runner/DB con runtime enforce, catálogos/owners/grants, cross-tenant y fallas cerradas pasan en topología aislada sin omisiones. Imagen/servicios probados se identifican por SHA. El inventario antiguo 26 tablas/27 policies y AccessRequest deben reconciliarse con su spec gobernante, sin expandir ni reducir el catálogo por conveniencia.
CA-08: Codex audita evidencia; PO acepta. Hasta entonces S00 no se marca ACEPTADA ni S01 funcional.

Pruebas por riesgo: unitarias, composición DI, web regresión, permisos/denegaciones de puerta, scanner adversarial, tipos/build/lint, integración DB/RLS/tenant y E2E posterior con IdP real. Accesibilidad focal tras cualquier cambio visible. No ejecutar E2E con cuentas/datos no identificados.

## 13. Decisiones aprobadas, pendientes y evidencia de retorno

Aprobadas en sesión: proyecto Eloisa-develop como base; una rama por sección; copia fuera de OneDrive; funcionamiento real con datos ficticios; accesos primero. Se conserva el stack existente. El PO aprobó S00-MP01 y autorizó posteriormente a Codex a sustituir a Claude manteniendo su consentimiento; La orden posterior de continuidad autoriza MP02 y las tareas dadas con especificación suficiente; no resuelve decisiones materiales abiertas.

MP01 aceptado. MP02/MP03 verificados técnicamente y guardados en commits locales d00bb82/581eb65; MP04A guardado en 720d07b. MP04B aprobado por el PO: catálogo 27/28 y 17 migraciones verificados en PostgreSQL real, owner no privilegiado y sondas RLS/tenant correctos. Baseline detenida en api-no-db-health por ausencia de MERDN_ACTIVE_TENANT_ID en entorno hijo; cleanup exclusivo verificado. No ejecutadas las 23 etapas DB de la matriz ni aceptado S00. MP04C es propuesta separada de transporte de contexto confiable, pendiente de decisión material; no amplía esta allowlist. D-02/D-03/D-04 de S01 siguen abiertas. Codex es implementador autorizado; Git local por instrucción posterior, sin push. No convertir el catálogo de pruebas en cuentas activas antes de cumplir sus contratos.

Claude Code debe devolver Task ID/paquete, rama/HEAD, diff exacto, archivos y propósito, comandos/resultados/conteos/omisiones, cumplimiento por CA, datos/tenants afectados, ausencia de secretos, supuestos, fallos y rollback. Codex verifica antes de aceptación PO; no considerar terminado por su reporte solamente.
