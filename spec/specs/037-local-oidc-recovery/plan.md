# Plan 037 — Recuperación OIDC local ficticio

## Resumen

El realm de pacientes declara acciones requeridas como cadenas, mientras
Keycloak 26 espera representaciones de objeto. Se retirará esa declaración
innecesaria para usar las acciones integradas del proveedor.

## Fases de implementación

1. Ajustar el archivo de importación local.
2. Recrear solo `oidc-local` con el perfil correspondiente.
3. Comprobar salud, descubrimiento y redirección de inicio de sesión.

## Dependencias

- Docker Desktop activo y variables ficticias locales presentes en `.env`.

## Riesgos

- El proveedor puede revelar un segundo error de configuración; se reportará
  sin modificar credenciales ni otras superficies.
- El flujo completo de usuario puede requerir un vínculo de prueba ya existente
  en la base local; su creación queda fuera de este paquete.
