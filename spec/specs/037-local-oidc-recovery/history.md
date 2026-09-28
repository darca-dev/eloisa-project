# Historial 037 — Recuperación OIDC local ficticio

## 2026-09-24 - Recuperacion y verificacion local

- Se retiro la redeclaracion incompatible de `requiredActions` del realm de
  pacientes y se recreo solamente `oidc-local`, sin limpiar volumenes ni datos.
- Los realms `merdn-local` y `merdn-patient` se importaron correctamente; el
  proveedor y la API terminaron en estado `healthy`.
- Se completaron en el `.env` local ignorado las variables OIDC ficticias que
  la API requeria, incluida una clave de intento generada localmente. Ningun
  valor secreto se registro en esta evidencia.
- El descubrimiento OIDC respondio `200` con el emisor local y el endpoint de
  inicio humano respondio `302` hacia Keycloak, en lugar de
  `HUMAN_AUTH_SERVICE_UNAVAILABLE`.

## 2026-09-24 — Aprobación de Product Owner

La Product Owner aprobó recuperar el OIDC local ficticio y verificar el acceso
de prueba. El alcance se limita a la importación y operación local del proveedor.
