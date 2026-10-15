# Historial 050

| Fecha | Tipo | Cambio | Responsable |
|---|---|---|---|
| 2026-10-14 | Defecto | PO comunica el mismo cruce en pacientes. Alcance correctivo: entrada y selector personal, sin modificar paneles ni cuentas. | PO / Codex |
| 2026-10-14 | Implementación | Hub personal directo a OIDC /acceso, petición interactiva sin acreditar step-up y selector limitado a perfiles personales aprobados. Denegación ofrece cambiar cuenta. | Codex |
| 2026-10-14 | Validación | 105 casos web focales; PostgreSQL aislado22human-auth/26personal sin fallos/omisiones y limpieza PASS; builds/tipos/lint/scanner PASS. | Codex |
| 2026-10-14 | Operación | API/web050 con backup privado/configuración igual y PostgreSQL/IdP originales; sin migración ni cambios de cuentas. | Codex |
| 2026-10-14 | E2E | Municipal→personal exige credenciales, retorna /acceso y deniega patient-self403; sin loop, cambio de cuenta real disponible, registro/Hospital/Alcaldía/logout intactos, axe0. Navegación personal aprobada verificada con respuestas controladas de prueba, sin credenciales de paciente real. | Codex |
| 2026-10-14 | Revisión | Revisor independiente detectó que la reautenticación de recuperación Hospital aún volvía a /acceso. Corregida a /hospital con guardas/vínculos intactos, caso existente ampliado a POST/callback real con proveedor doble; eliminada escritura directa de freshness. Revisión final cierra bloqueante sin otros hallazgos. | Codex / review_access |
| 2026-10-14 | Verificación final | Repetidas por el ajuste API las suites aisladas22/26, build API/tipos/lint: PASS; runId baseline-20261014t231135. Web sin nuevos cambios, focales105/build previos siguen aplicables. | Codex |
| 2026-10-14 | Operación final | Segundo reemplazo rechazó igualdad por orden distinto de los mismos ExtraHosts y retuvo mutex. Verificación completa de imágenes/configuración/hosts como conjunto/salud y PostgreSQL/IdP idénticos resolvió la incertidumbre; liberado solo mutex propio de proceso terminado. Evidencia final deploy050-resolved.txt; intento previo rechazado conservado. | Codex |
