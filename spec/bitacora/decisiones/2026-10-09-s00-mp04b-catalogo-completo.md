# Decisión PO — catálogo efectivo completo de pruebas

Fecha: 2026-10-09 (America/Indianapolis).

Fuente literal del Product Owner: «haz la recomendacion / Recomendación: catálogo efectivo completo de 27 tablas/28 policies», después de presentar S00-MP04B-PROPOSAL.md y solicitar decisión específica sobre catálogo/owner y baseline local aislada.

Se adopta la recomendación de esa propuesta: 26 tablas/27 policies históricas más access_request/access_request_tenant, 17 migraciones actuales exactas. El owner no privilegiado NOLOGIN merdn_test_migrator recibe también access_request exclusivamente en el PostgreSQL desechable de pruebas. Runtime conserva mínimos, sin ownership ni CREATE. No se modifica migración histórica, policy, grant o DB de aplicación.

La decisión resuelve para esta baseline la contradicción entre catálogo congelado 025 y ampliación 038; ambos documentos históricos se conservan. Codex continúa bajo su autorización previa como implementador, con contrato MP04B de cuatro archivos y operación local aislada detallada en la propuesta. Git solo local por decisión vigente; sin push/merge/main/despliegue. No decide D-02/D-03 ni fixtures humanos de S01.

El agente no ejecuta confirm-user-consent.sh ni altera el registro personal de consentimiento. Esta decisión registra la orden explícita del PO y su alcance; gates deben repetirse antes de código.
