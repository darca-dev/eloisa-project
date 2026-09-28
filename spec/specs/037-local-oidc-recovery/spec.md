# Especificación 037 — Recuperación OIDC local ficticio

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: `2026-09-24`
- Aprobado por / Approved by: Product Owner
- Evidencia: `Apruebo la spec 037 para recuperar OIDC local ficticio y verificar
  el acceso de prueba`.

## Objetivo

Recuperar el proveedor Keycloak local para que el flujo OIDC de prueba deje de
responder `HUMAN_AUTH_SERVICE_UNAVAILABLE` y pueda iniciar una autenticación de
personas ficticias.

## Alcance

- Corregir la importación local incompatible con Keycloak 26.
- Reiniciar únicamente el contenedor `oidc-local` con su perfil local.
- Verificar salud, documento de descubrimiento, emisor canónico y el inicio del
  flujo de autenticación contra el proveedor local.

## Fuera de alcance

- Cambios de roles, identidad, contraseñas, usuarios, API de pacientes,
  aprobaciones hospitalarias, migraciones, base de datos o instituciones
  externas.
- Ejecutar una limpieza de datos o exponer credenciales locales.

## Seguridad y operación

- Solo se usan realms, usuarios y variables ficticias de `infra/local-oidc/` y
  `.env` local ignorado por Git.
- Ninguna contraseña se añade al código, documentación versionada o salida de
  comandos.
- No se ejecuta `docker compose down --volumes`, `npm run docker:clean` ni otra
  operación destructiva.

## Archivos permitidos

- `infra/local-oidc/realm-merdn-patient.json`
- `infra/local-oidc/README.md`
- `.env` local ignorado por Git, exclusivamente para completar las variables
  OIDC ficticias; sus valores, en particular la clave de intento, no se
  registran en el repositorio ni en evidencia de comandos.
- `spec/specs/037-local-oidc-recovery/**`
- `spec/specs/INDEX.md`
- `spec/.sdd/user-consent.log`

## Criterios de aceptación

1. Keycloak local DEBERÁ iniciar sin error de importación.
2. El descubrimiento OIDC DEBERÁ responder `200` con el emisor local canónico.
3. El inicio de sesión humano DEBERÁ redirigir al proveedor local en vez de
   devolver `HUMAN_AUTH_SERVICE_UNAVAILABLE`.
4. No se expondrán ni versionarán credenciales y no se borrarán datos.
