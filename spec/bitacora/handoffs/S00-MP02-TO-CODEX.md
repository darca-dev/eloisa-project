# S00-MP02 — contrato vigente de ejecución para Codex

Updated-At: 2026-10-08
Current-Branch: feat/termino-00-mp02-web-real
Required-Base: 8bbdd6e128189928508147b9635cef21bb4fc3fb
Related-Spec: 039-termino-s00-base-y-baseline
Implementation-Agent: Codex
Authorized-Package: S00-MP02
Status: READY

## Autoridad

El PO aceptó MP01, ordenó nueva rama MP02 y continuidad hasta terminar las tareas dadas; luego ordenó guardar todo localmente. La aprobación de implementación amplía el paquete actual de spec 039 sin ejecutar confirm-user-consent.sh por el agente; evidencia en las decisiones de continuidad y Git local. Repetir gate/strict y comprobar suficiencia antes de código.

## Objetivo y allowlist

Corregir tres regresiones web contra las decisiones vigentes, preservando cobertura y estructura. Únicos archivos de producto/tests:
- apps/web/src/features/hub/HubAccessPortal.tsx: derivar el título desde configuración de marca; sin cambiar layout o añadir asistente artificial.
- apps/web/src/config/branding.test.tsx: verificar marca en portada actual y nombre/sustitución en el componente que sí renderiza asistente; mantener búsqueda negativa y comparación estructural.
- apps/web/src/app/municipality/page.tsx: eliminar constante/flag de sesión municipal simulada y montar siempre la puerta existente; metadata fiel al acceso institucional. No cambios backend/roles.
- apps/web/src/features/municipality/municipalityPrivacidad.test.tsx: probar que la bandera heredada true/false no muestra contenido sin sesión; conservar comprobaciones previas.
- apps/web/src/app/municipality/page.test.tsx: actualizar el caso heredado que exigía el bypass retirado; comprobar puerta en lugar de contenido y restaurar entorno entre casos. Extensión local necesaria encontrada por la suite completa; mismo comportamiento aprobado, sin nueva decisión de producto.

Datos/secretos: ninguno nuevo. Tenant/permisos: el servidor existente conserva decisión; bandera local nunca autoriza entrada. Auditoría de negocio sin cambios. Prototipo solo lectura. Sin nuevas dependencias, migraciones o reglas clínicas/institucionales.

## Pruebas y aceptación técnica

Unitarias focales y suite web completa 0 fallos; sustituir marca conserva estructura. Puerta SSR no monta contenido para ninguno de los valores legacy. Regresión municipal de sesión válida/expirada/rol incorrecto existente debe pasar. Tipos web, lint completo y build web correctos. No presentar SSR como OIDC/RLS/E2E integrado. Reportar paquetes pendientes y guardar commit local; no push/merge/main/despliegue.

Después: informe S00-MP02-FROM-CODEX.md, historial/tareas, commit local y siguiente rama para clasificación MP03. Si un cambio sale de allowlist o requiere decisión material, detener solo ese punto y presentar propuesta.
