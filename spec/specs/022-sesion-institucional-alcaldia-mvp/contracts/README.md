# Contrato de sesión institucional Alcaldía MVP

La spec reutiliza sin cambios estos contratos existentes:

- `POST /api/v1/institutional/sessions`
- `GET /api/v1/institutional/sessions/current`
- `DELETE /api/v1/institutional/sessions/current`
- `GET /api/v1/municipality/population-summary`
- `GET /api/v1/municipality/territory-summary`

Reglas cerradas:

1. La entrada envía exactamente `identityCode` y `accessSecret`.
2. El navegador administra la cookie HttpOnly; JavaScript no lee el token.
3. Solo el contexto confirmado `MUNICIPAL_VIEWER` abre el slice.
4. Ningún endpoint acepta tenant, municipio, rol o sujeto desde el cliente.
5. Logout solo se considera confirmado ante `204` o `401`.
6. `401/403` no revelan existencia, identidad, institución ni datos.
7. Población/Territorio conservan el contrato de supresión de spec 008.
8. No se añade ni modifica contrato backend alguno.

La aprobación y el consentimiento constan en los artefactos canónicos. La
implementación queda limitada por este contrato y por la allowlist de la spec.
