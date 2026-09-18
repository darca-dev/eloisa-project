# tests/ — verificaciones técnicas transversales (TASK-001)

Scripts de verificación que no pertenecen a una aplicación concreta del
monorepo. Las pruebas unitarias y de API viven dentro de cada workspace
(`apps/api`, `apps/web`, `packages/shared`).

| Script | Test de TASK-001 | Comando |
| --- | --- | --- |
| `db-connection.check.mjs` | T-11 | `npm run db:check` |
| `secrets-scan.check.mjs` | T-16 | `npm run secrets:scan` |

## `db-connection.check.mjs`

Ejecuta `SELECT 1;` mediante `prisma db execute --stdin` contra la base
PostgreSQL indicada en `DATABASE_URL`. No crea tablas, modelos, migraciones ni
datos, y nunca imprime la cadena de conexión.

Requiere que el contenedor PostgreSQL esté en ejecución
(`docker compose up -d postgres`) y un `.env` con `DATABASE_URL`.

## `secrets-scan.check.mjs`

Analiza los archivos versionables (`git ls-files --cached --others
--exclude-standard`) en busca de claves privadas, tokens, cadenas de conexión
con contraseña y artefactos prohibidos. Solo reporta archivo, línea y regla:
nunca el valor detectado.

Los lockfiles de texto versionables (`package-lock.json`, `npm-shrinkwrap.json`
y `*.lock`) **se inspeccionan por contenido** igual que el resto de archivos, con
un límite de tamaño propio. La salida del comando informa cuántos lockfiles
existen y cuántos fueron inspeccionados, y un lockfile que no pudiera leerse como
texto produce el hallazgo `cobertura:lockfile-no-inspeccionado` y salida distinta
de cero: el escaneo no declara una cobertura que no se produjo.

Los marcadores ficticios documentados en `.env.example`
(`change-me-local-only`, `merdn_dev`) y el marcador usado en pruebas
(`fictitious-not-a-secret`) están explícitamente permitidos.
