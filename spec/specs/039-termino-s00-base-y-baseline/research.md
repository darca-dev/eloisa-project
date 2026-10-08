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
