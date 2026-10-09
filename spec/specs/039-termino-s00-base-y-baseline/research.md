# Investigación 039 — hechos, hipótesis y pendientes

## Hechos verificados

- Base local y rama elegidas; main conservado. Remoto no sincronizado.
- Node 24.19.0; builds API/web, tipos y Prisma pasan.
- Docker Desktop instalado en AppData/Local/Programs/DockerDesktop; cliente y servidor 29.7.2. La ausencia inicial en Program Files/PATH de otro proceso no demostraba falta de Docker.
- Cuatro contenedores activos: API, web, PostgreSQL e IdP local. No prueban por sí solos el HEAD actual y no se tocaron.
- Lint 17 errores en seis archivos, incluidos .tmp-inspect-keycloak.cjs y .tmp-verify-eloisa-login.cjs: SON VERSIONADOS, aunque su nombre parezca temporal.
- Tres fallos web: expectativa Isa en portal que no la muestra; literal Eloisa fuera de config; ruta municipal con inyección demo contraria a la prueba de puerta.
- Scanner 52 coincidencias; environment.ts:673 referencia el NOMBRE de una variable de entorno, no contiene su valor: falso positivo confirmado para ese punto.
- Contratos API no cubren DB real; el rol disabled fue solo de comandos unitarios hacia puerto 1, no de servicios activos ni prueba de aislamiento.

## Hallazgos y decisiones antes de remediar

H-S00-01: lint del job de expiración tiene imports usados como tipos en fuente pero la DI Nest necesita tokens runtime. No aplicar import type mecánicamente. Revisar registro del provider y probar composición; cambios de auditoría/estado del job corresponden a S02.

H-S00-02: prueba de branding de la portada quedó atrás de la entrada unificada. No reinstalar UI histórica para que pase. Sí conservar sustitución de marca, centralización y estructura en la composición actual.

H-S00-03: atajo municipal existe incluso si la bandera por defecto está desactivada. Retiro conforme al objetivo sin demo; verificar sesión real y APIs, no declarar autenticación terminada por solo retirar una prop.

H-S00-04: el scanner no pasa. Clasificar las otras 51 coincidencias sin publicar valores; hay plantillas, unit tests, E2E y cinco puntos del handoff histórico. No afirmar fuga real por un patrón, ni afirmar que todos son falsos positivos. Si aparece una clave utilizable, detener su publicación y proponer rotación/redacción puntual al PO. No reescribir historia ni eximir toda carpeta.

H-S00-05: baseline 025 real pendiente de ejecución/reconciliación. Sus 26 tablas/27 policies son catálogo histórico; AccessRequest es ampliación gobernada por 038. Los 72 contratos de scripts con mocks no materializan ese catálogo.

H-S00-06: el último FROM-CLAUDE contiene reportes verdes de alcance parcial y el TO-CLAUDE v65 apunta a otra rama. Ninguno sustituye la prueba del árbol actual ni autorización del nuevo paquete.

## Decisiones abiertas

S00-MP01 aprobado y consentido para Claude Code; falta implementar/auditar y aprobar los otros paquetes; alcance operativo baseline e imagen; D-02 institucional/legado, D-03 sesión/MFA/recuperación y D-04 provisión/cleanup S01; credenciales de lectura/escritura del remoto actual. No requieren decidir un stack nuevo ni reducir alcance estratégico.

## 2026-10-08 — clasificación MP03 (52/52)

Base d00bb820567f69a49fd49d0a3db0a87b4bebe85e, rama feat/termino-00-mp03-secret-scan. Scanner EXIT 1; lockfile 1/1 y plantillas 3/3. Valores omitidos. Clasificación estática por uso/procedencia y contratos, no certificación de ausencia de secretos mediante una regex. 1 referencia de variable, 2 plantillas sintéticas, 11 centinelas unitarios, 32 contratos puros de baseline, 5 ejemplos históricos, 1 credencial fija E2E a retirar. No se halló evidencia de credencial de servicio real en estos 52 puntos.

| Archivo/línea | Regla | Procedencia y tratamiento |
|---|---|---|
| .env.test.example:31 | connection-string-with-password | Marcador ficticio de plantilla de topología test; no cuenta provisionada. |
| .env.test.example:33 | connection-string-with-password | Marcador ficticio de plantilla de topología test; no cuenta provisionada. |
| apps/api/src/config/environment.test.ts:384 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| apps/api/src/config/environment.ts:673 | hardcoded-credential-assignment | Referencia exacta de variable; no contiene su valor (mapa ACCESS_PROVISIONING_ENV_KEYS). |
| apps/api/src/patients/keycloak-admin.client.test.ts:26 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| apps/api/test/access-provisioning.test.ts:52 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| apps/api/test/access-provisioning.test.ts:230 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| apps/api/test/access-requests.test.ts:68 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| apps/api/test/access-requests.test.ts:682 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| apps/api/test/access-requests.test.ts:683 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| apps/api/test/access-requests.test.ts:684 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| apps/api/test/access-requests.test.ts:920 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| apps/web/e2e/patient-persistent-account.spec.ts:30 | hardcoded-credential-assignment | Contraseña fija de cuenta sintética creada por E2E: retirar literal y generar aleatoria en memoria; no exceptuar. |
| apps/web/src/features/access/accessRequestClient.test.ts:35 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| apps/web/src/features/hospital/hospitalAccessRequestsClient.test.ts:180 | hardcoded-credential-assignment | Dato centinela de prueba unitaria (configuración, transporte sustituido o validación negativa); no IdP/DB real. |
| spec/bitacora/handoffs/FROM-CLAUDE.md:325 | hardcoded-credential-assignment | Evidencia histórica de segundo cuerpo E2E sintético, no credencial de servicio. Mantener documento sin reescribirlo. |
| spec/bitacora/handoffs/FROM-CLAUDE.md:3834 | connection-string-with-password | Ejemplo histórico explicitamente ficticio de URL de baseline; no DSN activo. |
| spec/bitacora/handoffs/FROM-CLAUDE.md:4915 | connection-string-with-password | URL sintética usada como mensaje de ProvisionError para probar sanitización. |
| spec/bitacora/handoffs/FROM-CLAUDE.md:6909 | connection-string-with-password | Marcador reemplazar-por dentro de URL de operación propuesta, declarado inutilizable por el documento. |
| spec/bitacora/handoffs/FROM-CLAUDE.md:6910 | connection-string-with-password | Marcador reemplazar-por dentro de URL de operación propuesta, declarado inutilizable por el documento. |
| tests/testing/run-baseline.test.mts:50 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/run-baseline.test.mts:51 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-db-lifecycle.test.mts:79 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-db-lifecycle.test.mts:80 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-db-lifecycle.test.mts:154 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:59 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:60 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:200 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:201 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:202 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:203 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:204 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:205 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:206 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:207 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:223 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:229 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:235 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:241 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:250 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:251 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:267 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:268 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:278 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:279 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:288 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:315 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:326 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:334 | connection-string-with-password | Interpolación de constantes sintéticas en contratos con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:342 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:350 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |
| tests/testing/test-environment-guard.test.mts:351 | connection-string-with-password | URL/credencial sintética o malformada en contratos del guard/lifecycle/runner con dobles; no ejecución DB. |

Remediación: catálogo revisable de excepciones por ruta exacta, regla y SHA-256 de línea completa normalizada solo por CRLF. No se publican valores. 51 ocurrencias clasificadas producen 50 entradas únicas (una línea idéntica repetida del guard). Cambiar cualquier byte o mover a otra ruta reactiva hallazgo. Se conserva cobertura por contenido de tests, documentación, plantillas y lockfiles. E2E no se exceptúa: aleatoriedad criptográfica por proceso, misma contraseña en inscripción/login y sin persistirla. Scanner debe detectar todos los matches de cada regla en una línea y aceptar solo marcadores exactos, nunca substring. Pruebas adversariales en Git temporal exclusivamente, sin red/DB/IdP.

### MP03 — tres coincidencias adicionales por eliminar la excepcion substring

La coincidencia exacta de marcadores revelo tres puntos antes ocultos por includes. Se clasificaron antes de agregar al mismo catalogo: dos placeholders REPLACE en plantilla staging y un centinela de error de configuracion. No se amplio allowlist de archivos ni se modificaron esas fuentes. Total 55 puntos clasificados; 1 literal E2E retirado; 54 ocurrencias no secretas, 53 entradas unicas. La estimacion inicial 49 entradas fue corregida a 50 tras deduplicacion efectiva: solo una linea se repite.

- .env.staging.example:17: marcador sintetico explicito REPLACE de plantilla, no operable sin reemplazo.
- .env.staging.example:18: marcador sintetico explicito REPLACE de plantilla, no operable sin reemplazo.
- apps/api/src/config/environment.test.ts:140: centinela de prueba unitaria de error sanitizado, sin conexion real.

## MP04B — evidencia y hallazgo de configuración

27 tablas/28 policies y 17 migraciones efectivas reconciliadas por decisión PO de 2026-10-09. Provision y preflight real verificaron owner sobre las 27, roles no privilegiados, runtime sin ownership/CREATE, RLS/FORCE, denegación sin contexto y aislamiento cruzado. Baseline se detuvo tras types: runner CHILD_TEST_KEYS admite solo DATABASE_URL, RUNTIME_DATABASE_URL y MERDN_RUNTIME_ROLE; environment.ts exige MERDN_ACTIVE_TENANT_ID bajo enforce conforme a 024. Diagnóstico aislado sin DB confirmó ausencia/error de validación con 8 skips. No cambiar runtime a disabled, no inventar UUID ni heredar del padre. Propuesta MP04C define contexto validado solo desde cluster exclusivo, sin evidencia del UUID; pendiente de decisión PO sobre frontera de entorno. Las 23 etapas DB de la matriz no se ejecutaron. Véanse S00-MP04B-FROM-CODEX y JSON minimizados para linaje, digest y limpieza.

## MP05 — presentación frente a procedencia

Aviso de datos ficticios en dos ubicaciones wizard, cierre, ayuda de Isa/clave, perfil/pasos, hub y revisión Hospital. PO corrige el objetivo y conserva botones de test con contraseña. Fixtures nueve usuarios, contraseña antes manual, algunos campos opcionales Visitador vacíos. POST existente real y fail-closed; AccessRequestSource enum solo TEST_DATA, constante backend y validación cliente exacta: retirar texto no corrige esa procedencia ni demuestra provisión OIDC. Mantener hallazgo separado, no alterar histórico de pruebas.
