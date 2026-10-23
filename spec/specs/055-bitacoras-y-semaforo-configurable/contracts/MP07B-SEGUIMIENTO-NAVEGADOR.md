# 055 / MP07B — Seguimiento de navegador B08–B09

Fecha: 2026-10-23. Continuación del contrato autorizado `MP07-CORRECCIONES-A01-A10.md`, sus permisos/datos/auditoría/seguridad/aislamiento/retención y exclusiones. No decisiones clínicas, institucionales o de arquitectura nuevas. Claude implementa; Codex ejerce el entorno aislado y audita. Se conserva el único administrador Hospital ratificado por el PO.

## Evidencia y dependencia

Entrega B07 de Claude ya presente en el árbol: `care-browser.real.test.ts` SHA256 `DB64724CFA4620285D5E67EDB42DD6AAC689A7571DC21DEA832E2D4B654E382D`. Codex detuvo su sesión duplicada antes de editar al detectar esa entrega simultánea, y revisó la existente. Tipos API y lint del test exit 0.

Chromium real `baseline-20261023t203200`: **9 aprobadas, 3 fallidas, 0 omitidas**, exit 1, provision/preflight/cleanup correctos. Evidencia operativa saneada `.tmp/browser055-2026-10-23T20-32-00.408Z.json`. Servidores efímeros 3100/3101 detenidos; base de aplicación intacta.

B07 pasa en este recorrido: exactamente un administrador HOSPITAL, acceso positivo con concesión clínica, revocación por API de la gestora emisora, continuidad de administración y ausencia posterior de datos clínicos. También pasan A02 (escritura tardía A→B), conservación del borrador de criterio al guardar un dato, entrada del revisor sin administración, cuenta ajena y anónima. Axe no informa serias/críticas en las superficies efectivamente auditadas; no se extiende a los casos que fallaron antes de su auditoría.

## B08 / P2 — Selectores y sincronización de las pruebas

1. Línea 310 del test: `getByText(/Vigente hasta/u)` encuentra tanto el párrafo de la versión persistida como la etiqueta del formulario. Falla strict mode. Apuntar al resumen persistido del criterio correcto y mantener las comprobaciones DB de identidad, versiones, valores y vigencia. No resolver el selector ambiguo eligiendo arbitrariamente un elemento.
2. Línea 477: la espera `getByText(SOLICITUD)` puede reconocer el contenido del textarea aún sin terminar el envío; la consulta DB siguiente observa `[]`. Esperar el POST real (instalar la espera antes del click), comprobar 201 y esperar el desenlace de la recarga/nota en la bandeja, con un selector que excluya el formulario. Conservar las aserciones exactas de persistencia, contexto, borrador del otro formulario, UUID y repetición de la misma clave sin duplicados. No usar sleeps fijos ni relajar conteos.

## B09 / P2 — El conteo final de paginación desaparece

El caso B04/A06 vence esperando «56 solicitudes abiertas cargados. No hay más.» (`care-browser.real.test.ts:803`). `CareWorkspace.tsx` monta `ControlPagina` solo si hay `nextCursor` o error, tanto en bandeja como en registros. Al recibir la última página con cursor null se desmontan el conteo y el estado final; la rama «No hay más» del control resulta inaccesible en esos consumidores.

Conservar el conteo/estado accesible de la lista cargada al alcanzar el fin, ocultando únicamente el botón de continuación cuando no existe cursor ni error. Mantener distinción de cargados/total, filtro vigente, contexto, deduplicación, errores y aria-live. No cambiar paginación API, tamaños, permisos, RLS o timeout. No afirmar pérdida de filas: el fallo comprobado es la ausencia del estado final, no el truncamiento del backend.

## Archivos y comprobaciones

Edición de Claude acotada a `apps/api/test/care-browser.real.test.ts`, `apps/web/src/features/care/CareWorkspace.tsx` y seguimiento de `contracts/MP07B-FROM-CLAUDE.md`. Otra ruta imprescindible se justifica antes de tocarla. Sin esquema/migraciones/dependencias, prototipo, decisiones, secretos, DB/Docker/servidores/browser, Git mutante ni otros agentes. No modificar restricciones para pruebas.

Antes de editar, ejecutar gates del contrato base y leer esta revisión, la entrega B07 y la decisión de admin único. Comprobar tipos API/web y lint focal de esos dos archivos; reportar exit codes y pruebas no ejecutadas. Codex corre Chromium con los doce casos, móvil y axe. Conservar todas las comprobaciones y, en el recorrido de paginación, verificar una activación real de un control mediante teclado. Después de pasar navegador corresponde baseline completa y auditoría conjunta A01–A10. No aceptar ni integrar Git por disponer de código.
