# Plan — Spec 023

## Fases / Phases

## Paquete A (≤15 minutos)

Crear el overlay Compose de staging, plantilla sin secretos, borde Caddy y
runbook Hostinger. Reutiliza Dockerfiles, servicios y healthchecks existentes;
no modifica `compose.yml` local.

Pruebas: Compose config, inspección de puertos/redes/healthchecks, secrets scan,
lint de configuración y `git diff --check`.

Dependencia: aprobación y consentimiento de esta spec. Termina antes de toda
acción externa.

## Paquete B (≤15 minutos)

Añadir preflight, comprobación runtime DB, backup/restore defensivos y smoke
HTTP. Los scripts no crean credenciales, no cambian roles y no despliegan.

Pruebas: tests focales con procesos/DB simulados, dry-run obligatorio,
typecheck/lint, secrets scan y `git diff --check`.

Dependencia: Paquete A validado. La validación consolidada corresponde a Codex.

## Dependencias / Dependencies

- Docker Compose v2 y las imágenes/Dockerfiles existentes.
- Secretos y credenciales de staging suministrados fuera del repositorio.
- Hostinger, DNS, firewall y certificados requieren autorización posterior y no
  forman parte de estos paquetes.

## Riesgos / Risks

- Exposición accidental de servicios internos: el overlay debe fallar cerrado.
- Uso del propietario como runtime o tenant persistente: el preflight lo bloquea.
- Backup no restaurable o migración incompatible: no se despliega hasta ensayar
  restauración y definir forward-fix/restore.
- Confundir smoke HTTP con aceptación visual: browser permanece evidencia aparte.

## Orden externo posterior (no autorizado aquí)

1. Product Owner aprueba y consiente la spec.
2. Claude implementa A y B; Codex audita.
3. Product Owner autoriza acciones Hostinger y provisión de secretos.
4. Técnico configura VPS, DNS/firewall/TLS y roles fuera del repo.
5. Backup y restore de ensayo.
6. Migración con rol propietario, despliegue inmutable y preflight.
7. Smoke y aceptación browser con datos ficticios.
