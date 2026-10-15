# 044 — Municipality con registros guardados

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para corrección y aplicación local`.
- Fecha / Date: 2026-10-14.
- Aprobado por / Approved by: PO, conversación vigente.
- Evidencia / Evidence: ../../bitacora/decisiones/2026-10-14-municipality-sin-cifras-ejemplo.md.

## Contrato

1. ID/objetivo: 044, retirar cifras de ejemplo del panel municipal operativo y
   mostrar únicamente registros guardados o indisponibilidad explícita.
2. Contexto: gate humano ya usa primer administrador real; shell interior aún
   monta fixtures. Población/Territorio ya consultan API/PostgreSQL con supresión.
3. Usuarios: administrador Municipality confirmado en tenant del servidor.
4. Módulos: composición municipal, nuevo resumen real y pendientes. Referencias
   de diseño conservadas sin servirse en la ruta autenticada por administrador.
5. Funcional: Inicio consulta resumen existente, estados carga/error/sin sesión/
   vacío, fechas y conteos publicados. Población/Territorio reutilizan vistas
   existentes. Otros apartados muestran pendiente de habilitar, sin cifras,
   formularios ficticios o acciones que simulen persistencia.
6. Datos: PopulationSummary existente y sesión institucional confirmada. Solo
   agregados protegidos; no personas/documentos/PII ni listados nuevos. Fuente,
   corte y protección de grupos pequeños permanecen visibles. Sin nuevas reglas.
7. Permisos: gate/servidor/RLS existentes, sin nuevos permisos, tenant aportado
   por cliente, sesiones manuales o tratamiento de fixtures como fallback.
8. Auditoría: las APIs existentes registran accesos; no nuevos eventos de negocio
   porque no se añaden escrituras. Preservar eventos/registro de administrador.
9. Seguridad: no guardar respuestas/tokens, sin consultas antes de autorización,
   cancelar respuestas tardías y no sustituir errores por cero o fixtures.
10. Visual: conservar shell/sidebar de Eloisa y todos los apartados estratégicos;
    retirar del runtime ciudad, perfil, periodos, indicadores/actividad ficticios.
11. Permitidos: apps/web/src/features/municipality/MunicipalityShell.tsx,
    MunicipalityOperationalPanel.tsx, MunicipalityOperationalPanel.test.tsx,
    municipalityPrivacidad.test.tsx (incluir nuevo consumidor autorizado del resumen),
    municipalityOperational.module.css; docs/ACCESO-ELOISA.md; spec/specs/044-
    municipality-registros-guardados/, spec/specs/INDEX.md, spec/.sdd/user-consent.log
    y decisión 2026-10-14-municipality-sin-cifras-ejemplo.md.
12. Prohibidos: API/schema/migrations, fixtures históricos, controles de acceso,
    Hospital, prototype-claude/, tasks/, reviews/, main/develop, nuevos roles,
    importación de datos reales no facilitados, borrado/reset de cuentas/datos.
13. Dependencias: endpoints municipales existentes, Docker web y datos actuales.
    Sin paquetes ni migraciones; rebuild solo web y mismo entorno/configuración.
14. Aceptación: ruta municipal del administrador no muestra fixtures en ninguna
    pestaña. Inicio usa respuesta API, nunca valores locales. Sin supresión rota,
    falsas fuentes oficiales o autoridad atribuida al nombre del fixture.
15. Pruebas: estados SSR significativos y E2E con API real, sin nuevas cuentas;
    navegación completa, error sin fallback, teclado/axe/320px, logout. Tipos,
    suite web, lint/scanner y diff/gate. No repetir baseline PostgreSQL intacta.
16. Aprobado: respuesta funcional a la instrucción PO, base actual mientras no
    exista fuente externa. Instalar nueva web conservando config y datos.
17. Fuera: CRUD de los diez apartados no implementados, cargas externas,
    fuentes oficiales y completar S02–S14. Reportar esos faltantes expresamente.
18. Compatibilidad/rollback/evidencia: conservar imagen/config de web previa
    para reversión, no tocar otros servicios/puertos/secretos; misma cuenta entra
    y sale; evidencias privadas sin credenciales y revisión focal independiente.
