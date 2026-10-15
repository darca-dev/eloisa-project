# Historial 047

| Fecha | Tipo | Cambio | Responsable |
|---|---|---|---|
| 2026-10-14 | Solicitud | PO rechaza tarjeta «Acceso a la Alcaldía» redundante tras pulsar Ingresar; limita cambios a entradas/login de Hospital y Alcaldía. | PO / Codex |
| 2026-10-14 | Implementación | Solo dos enlaces del hub pasan a helper de login con HTML a; sin prefetch, paneles/gates/auth intactos. Caso existente comprueba destinos renderizados. | Codex |
| 2026-10-14 | Aplicación | Web eloisa-entry047 instalada con env/puertos/red conservados y otros tres servicios con mismo ID. | Codex |
| 2026-10-14 | Verificación | 91 casos, build/tipos/lint/scanner correctos. Ambos botones1clic,0prefetch,registroAPI intacto. Cuenta municipal real, callback/panel/13vistas/API/error/reintento/Hospitaldenied/logout204→401, sin autoOIDC al recargar; axe0 y responsive. | Codex |
| 2026-10-14 | Revisión | Revisión focal independiente de fuentes, build y E2E cerrada sin bloqueantes. Documentación vigente actualizada a047/imagenentry047. | review_access / Codex |
