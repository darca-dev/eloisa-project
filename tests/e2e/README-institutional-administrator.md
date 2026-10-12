# Registro inicial institucional — E2E real 040

Ejecutar desde la raíz, con Node 24, Docker Desktop y Chromium de Playwright.
El stack de prueba usa únicamente la base aislada del runner: API 3003, web 3002,
Keycloak 8083. No usar la base activa ni registrar cuentas ficticias en ella.

```powershell
docker build -f apps/api/Dockerfile -t merdn-api:eloisa-admin040 .
docker build -f apps/web/Dockerfile -t merdn-web:eloisa-admin040 .
node scripts/testing/run-baseline.mjs --env-file .secrets/baseline-mp04.local.env --stage provision --run-id admin-040-e2e
node tests/e2e/prepare-institutional-administrator.real.mjs
node tests/e2e/institutional-administrator.real.mjs
```

Preparación exige el preflight real del runner. Genera secretos aleatorios en
`.secrets/`, importa un realm aislado sin personas predefinidas y ejecuta dos
veces la configuración del IdP para verificar idempotencia. El navegador prueba
ambas experiencias: alta, recuperación del resultado, login OIDC/PKCE, APIs
institucionales, experiencia ajena denegada, logout y cierre del registro.
Las llamadas de navegador al puerto de API compilado se reenvían a la API aislada;
no se simulan respuestas, identidad, permisos ni éxito de operaciones.

El script de navegador comprueba los labels test/disposable antes de dar de alta
identidades ficticias. Ejecutar sobre una base limpia: consume el primer cupo de
cada experiencia del entorno aislado. Para repetir, retirar primero ese stack,
limpiar exclusivamente por el runner y volver a provisionar:

```powershell
docker compose -f .secrets/admin040-e2e/compose.json down
node scripts/testing/run-baseline.mjs --env-file .secrets/baseline-mp04.local.env --stage cleanup --run-id admin-040-e2e-reset
```

No añadir `--volumes`, `--remove-orphans` ni comandos de borrado global.
Los screenshots de fallos quedan ignorados en `.tmp/admin040-browser/` y solo
corresponden a las identidades ficticias del test. El script no escribe contraseñas
en logs, evidencia ni Git.
