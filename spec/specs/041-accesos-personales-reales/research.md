# Investigación 041

Servicio actual fija TEST_DATA y motivos DEMO_*. MP06 propone SELF_REGISTRATION preservando históricos. La instrucción vigente exige módulos reales. Resolver Person por documento permite reutilizar cuenta; proteger solo administradores (040) no cierra riesgo personal. Exigir prueba del intento para repetir.

Keycloak ya es autoridad de contraseña. PO eligió recuperación administrada el 2026-10-12. Verificar documentación primaria de reset temporal, logout y acciones obligatorias antes de esas llamadas. No inferir éxito por habilitar una cuenta ni crear autenticación propia.

Fuentes primarias consultadas el 2026-10-12:
- https://www.keycloak.org/docs-api/26.7.0/rest-api/index.html — reset-password, logout y sesiones de usuario.
- https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest — max_age=0, prompt=login y auth_time.
- node_modules/openid-client/build/index.d.ts — AuthorizationCodeGrantChecks.maxAge exige auth_time firmado.

Revisión independiente concretó exclusión de soporte/administradores, vínculo
exacto por solicitud, operación persistente y no reactivación tras suspensión
concurrente. Hallazgo de saga tardía documentado en spec; corrección pendiente.

Resultado posterior: la corrección de saga se verificó con lease/CAS y barreras
PostgreSQL. El corte final de autenticación usa clock_timestamp bajo bloqueo de
cuenta, para rechazar también callbacks iniciados durante el reset. La E2E real
verificó el cambio obligatorio y el ingreso con la nueva contraseña. La
conciliación local reinicia el mismo IdP antes de una nueva contraseña temporal,
con endpoint Docker local fijo y mutex global del daemon; revisión focal final
sin bloqueantes. Ninguna incertidumbre remota se interpreta como éxito.
