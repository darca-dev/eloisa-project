# Historial 039

## 2026-10-08 — creación prospectiva por Codex

El PO eligió Eloisa-develop, autorizó nueva rama y continuar fuera de OneDrive. Se tomó origin/develop local 9980582, se conservó main 1aa1201 y el original como respaldo. Fetch del origin arvtechv no accesible con credenciales actuales.

Se creó este bundle como propuesta de S00; no modifica aprobaciones/consentimientos de 025/038 ni registra aprobación de 039. No hubo implementación, cuenta, migración, commit/push, merge o despliegue nuevos.

Checks: tipos/builds/schema correctos; web 1882/1885 con 3 fallos; contratos API 656 correctos en conjunto de selección; contratos baseline puros 72; lint 17 errores; scanner 52 coincidencias. DB/RLS/IdP integrados y E2E no ejecutados. Ver comandos y límites en docs/plan-funcional/00-BASE-Y-BASELINE.md.

Un primer intento de contratos API usó dos DSN ficticios idénticos y fue rechazado correctamente por configuración. Se corrigió únicamente el entorno del comando y se repitieron los tres archivos afectados: 64/64. Los otros 31 archivos ya pasaban 592/592. No se atribuye ese fallo de ejecución a un defecto del producto. Las pruebas node:test se relanzaron con su runner nativo tras un intento incorrecto con Vitest.

## 2026-10-08 — comprobaciones finales y aprobación MP01

Tras incorporar documentos, check-sdd-gate.sh y validate-sdd.sh --strict salieron 0; strict: 0 errores y 0 advertencias. El gate de framework no aprobó 039 por sí mismo. Scanner mantiene 52 coincidencias, sin nuevas en documentos importados/creados. Diff de código, lockfile y carpetas protegidas vacío; HEAD/main preservados.

El Product Owner respondió «Apruebo S00-MP01 para Claude Code». Se registra aprobación exclusivamente de ese paquete, implementador Claude Code y hard stop para auditoría. MP02/MP03/MP04 no quedan autorizados. Consentimiento SDD de 039 aún no registrado; ningún agente lo ejecutó. No se inició implementación.
### Estado específico posterior a aprobación

Gate: EXIT 1, 1 error/19 warnings; el único error es falta de consentimiento de 039. Strict: EXIT 0, 0 errores/0 warnings. No se reutilizaron los consentimientos de 025/038. Claude Code no se localizó como CLI en PATH, .local/bin/claude.exe o AppData/Roaming/npm/claude.cmd. No se instaló ni se invocó un sustituto. Handoff listo, ejecución retenida hasta el acto SDD del PO.
## 2026-10-08 — consentimiento verificado y handoff READY

El Product Owner ejecutó personalmente confirm-user-consent.sh y avisó «comando ingresado». Codex verificó una entrada [spec:039-termino-s00-base-y-baseline] de 2026-10-08 14:47:34 -0400: «Apruebo exclusivamente S00-MP01 para Claude Code». El agente no creó ni editó el log de consentimiento.

Gate EXIT 0, 0 errores/19 advertencias heredadas. Strict EXIT 0, 0 errores/0 advertencias. Handoff S00-2026-10-08 actualizado a READY exclusivamente para S00-MP01 / Claude Code. Codex conserva auditoría; no implementó producción. CLI Claude Code no disponible en PATH ni en las ubicaciones habituales verificadas; implementación aún no iniciada aquí. MP02/MP03/MP04 continúan sin autorización.
## 2026-10-08 — cambio explícito de implementador

El PO autorizó a Codex para S00-MP01 y mantuvo explícitamente el consentimiento SDD del mismo paquete al sustituir a Claude. Decisión: 2026-10-08-s00-mp01-codex.md. Se preserva intacto el log de consentimiento personal. Único paquete autorizado: MP01; lógica de negocio, permisos y demás paquetes fuera de alcance.
## 2026-10-08 — MP01 implementado y verificado por Codex

Siete archivos dentro de allowlist. Lint pasa (antes 17 errores), typecheck shared/API/web pasa, build API pasa, 65 contratos API pasan sin skips y 10 E2E se colectan sin ejecutarse. Herramientas CJS pasan node --check. Job cotejado contra HEAD restaurando solo import/tokens: lógica exacta sin cambios. Scanner conserva 52 coincidencias; web mantiene tres fallos previamente abiertos, fuera de MP01. No se ejecutó DB/RLS/E2E real ni se crearon cuentas.

Se registraron dos hallazgos residuales de pruebas heredadas: helper E2E tautológico y DB test con retorno temprano sin skipped. No se modificó su semántica dentro del paquete de lint. Informe completo: S00-MP01-FROM-CODEX.md. Cambios locales sin commit; main y fuentes protegidas conservados. Implementación/revisión técnica realizadas, aceptación PO pendiente. HARD STOP antes de MP02.
## 2026-10-08 — MP01 aceptado por PO; Git y continuidad autorizados

El PO aceptó MP01 y ordenó commit/push, nueva rama MP02 y repetir el ciclo hasta terminar las tareas dadas. Decisión: 2026-10-08-continuidad-git-por-paquete.md. La ejecución continua no resuelve decisiones materiales abiertas ni permite saltar specs suficientes o pruebas. Publicación pendiente: origin arvtechv/eloisa_project devuelve Repository not found con acceso actual. No se cambió destino.
## 2026-10-08 — MP01 commit local y rama MP02

MP01 guardado en 8bbdd6e128189928508147b9635cef21bb4fc3fb. El remoto permitió lectura tras hacerse público (develop coincide con 9980582); push devolvió 403 por falta de escritura de la cuenta activa. El PO ordenó guardar todo localmente, así que se cancelan intentos de publicación y se continúa por commits/ramas locales.

Rama MP02 creada desde MP01: feat/termino-00-mp02-web-real. Ejecución autorizada por instrucción explícita de continuidad; allowlist de cuatro archivos y contrato S00-MP02-TO-CODEX.md. No se marca S00 aceptado ni se transfieren decisiones materiales abiertas.
## 2026-10-08 — MP02 verificado, continuidad local

MP01 guardado en 8bbdd6e; MP02 en feat/termino-00-mp02-web-real. Cinco archivos web permitidos, incluida prueba de ruta heredada identificada por suite completa y añadida al contrato antes de editar. Gate/strict EXIT 0. Resultado final: 1888/1888 web, tipos/lint/build web correctos. Informe S00-MP02-FROM-CODEX.md; no aceptación total S00 ni evidencia DB/OIDC. Scanner mantiene 52 coincidencias. Sin push por orden del PO; commits y ramas locales autorizados.

## 2026-10-08 — contrato MP03 suficiente antes de código

52/52 coincidencias clasificadas en research.md. Allowlist exacta de cuatro archivos fijada; gate EXIT 0 (19 warnings heredados), strict EXIT 0 con dos avisos por historial aún no actualizado, subsanados en esta entrada. Catálogo ruta/regla/hash; E2E aleatorio; tests adversariales CLI sin recursos reales. Orden de continuidad del PO y Git local conservadas. No se altera consentimiento.

MP03: marcadores exactos descubrieron tres coincidencias sintéticas adicionales, clasificadas antes de incluirlas en catálogo. Total 55 clasificadas; catálogo 53 entradas para 54 ocurrencias. Sin cambios a las fuentes de fixtures/plantillas.

## 2026-10-08 — MP03 verificado

Scanner EXIT 0, 53 entradas exactas/54 ocurrencias sintéticas, E2E fijo retirado. 16/16 adversariales, tipos y lint correctos; Playwright colecta cinco casos sin ejecución. Strict final EXIT 0/0 warnings. Cuatro archivos técnicos en allowlist, sin servicios alterados. Informe S00-MP03-FROM-CODEX.md; S00/DB/OIDC pendientes. Commit local y siguiente rama MP04 bajo orden del PO.

## 2026-10-08 — preparación MP04

Rama MP04 desde 581eb65. Inventario puro: 27 tablas de esquema, catálogo 26/27, access_request ausente; 17 migraciones coinciden, 29 stages/23 DB. Runner typecheck API reproduce nueve TS5097; se abre MP04A técnico de dos archivos para igualar comando existente. MP04B queda PROPUESTA por contradicción de catálogo/owner y operación DB, no autorizada por el agente. Docker: cuatro contenedores de app detenidos externamente, cero running; no recursos baseline ni listener55432. Sin mutación Docker/DB.

## 2026-10-08 — MP04A verificado, MP04B propuesto

Dos archivos técnicos en allowlist; command API del runner corregido con opción existente. 72/72 contratos sin omisiones, tres comandos reales types EXIT0/0/0, lint correcto. Informe MP04A y propuesta MP04B registrados. Pregunta PO específica sobre catálogo/owner/operación aislada pendiente; no se toma silencio por aprobación ni se altera consent log. Scanner/diff check final antes de guardar commit local. DB/IdP intactos.

## 2026-10-09 — decisión PO MP04B y contrato activo

El PO ordenó aplicar la recomendación de catálogo completo 27 tablas/28 policies. Decisión explícita registrada; contrato MP04B de cuatro archivos y operación local desechable activado en feat/termino-00-mp04b-db-aislada desde 720d07b. Se preservan 025/038, consent log y Git local. Se repetirán gates antes de código y guard/identidad antes de cualquier infraestructura.

## 2026-10-09 — MP04B catálogo real verificado, baseline detenida

Gate previo EXIT0 (19 advertencias heredadas), strict previo y de cierre EXIT0 sin advertencias. Cuatro archivos técnicos permitidos: catálogo 27/28 y pruebas independientes del esquema/migraciones. 82/82 contratos sin skips/todo, 16/16 adversariales, lint/scanner correctos. Un intento real s00-mp04b-20261009-8aec95bd: provision 17 migraciones y preflight catálogo/owner/RLS/FORCE/tenant correctos, tres comandos types pasan; api-no-db-health falla por MERDN_ACTIVE_TENANT_ID ausente. Diagnóstico posterior sin DB confirma 1 fallo/1 pase/8 skips; conteos 0 del runner no concluyentes. Cleanup exclusivo correcto, cero recursos baseline, compartidos intactos. Informe/evidencia minimizados separados. MP04C propuesta concreta de contexto confiable, no implementación fuera de MP04B; decisión PO pendiente. S00 completo no aceptado, ninguna cuenta nueva. Se conserva autorización de commit/rama local; sin push/main/consent script.

## 2026-10-09 — contrato MP05 antes de código

PO solicita registro real y precisa mantener botones de usuarios test con todos los datos y contraseña. Rama feat/termino-00-mp05-accesos-sin-demo desde 389d5fe, contrato y decisión registrados. Plan inicial de retirar botones descartado antes de modificar producción. Allowlist exacta de once archivos web, sin backend/migraciones. Gates se repiten antes de implementar. MP04C y cierre de procedencia TEST_DATA pendientes; consent log intacto.

## 2026-10-09 — MP05 verificado y web actualizada

Once archivos web dentro de contrato; se conservaron botones test según corrección PO. Trece pruebas nuevas, focales 213/213 y suite web 1901/1901; tipos/lint/scanner y Docker build correctos. Imagen merdn-web:eloisa-mp05, huella web/shared/config de 307 archivos 7b405031dbb4dc25e58db50e9eb4bb3dd82c11c980c5949f2fd0835493f9f246. Solo web recreado, cuatro servicios healthy y hub/registro HTTP200; no navegador conectado ni envío real/E2E. Informe MP05 diferencia precarga real de cuentas aún no verificadas. MP06 propuesta de procedencia con nuevo enum/migración y linaje histórico, pendiente PO; MP04C tampoco aprobado. Git local, consent log y main conservados.

Cierre MP05: strict EXIT0/0 advertencias, scanner EXIT0 con excepciones específicas intactas y diff-check correcto. Se guarda commit local y se abre rama MP06 para la propuesta pendiente, sin implementación de procedencia.
