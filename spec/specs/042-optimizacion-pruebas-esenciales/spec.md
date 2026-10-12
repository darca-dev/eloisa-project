# 042 — Optimización de pruebas esenciales

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para implementación local`.
- Fecha / Date: 2026-10-12.
- Aprobado por / Approved by: Product Owner, conversación vigente.
- Evidencia / Evidence: ../../bitacora/decisiones/2026-10-12-publicacion-y-optimizacion-pruebas.md.
- Rama: chore/optimizar-pruebas-esenciales, base d0be21e. La autorización de
  commit/push no incluye main/develop ni integración de historias diferentes.

## Objetivo y contexto

Conservar una regresión que detecte fallos útiles, reduciendo comprobaciones
duplicadas, acoplamiento a textos/estilos y reconstrucciones idénticas de markup.
Base medida: 1918 pruebas web en 72 archivos; baseline 31 etapas/2626 pruebas.
La orden del PO autoriza optimizar; no exige reducir cobertura por porcentaje.

## Usuarios y módulos afectados

Desarrolladores y revisores del proyecto. Primera reducción acotada a cuatro
suites de presentación heredadas: Finanzas, Administración y Reportes de Hospital,
y Programas municipales. No cambia el comportamiento de cuentas o instituciones.

## Requisitos funcionales

1. Inventariar todos los casos retirados y justificar duplicación o ausencia de
   señal funcional: copia literal de catálogo/fixture, medidas CSS exactas o
   comprobación de otro módulo ya cubierta por su suite propia.
2. Conservar montajes representativos y navegación del módulo, filtros/lógica
   pura, estados vacíos/errores, validación, privacidad, controles inertes de
   funciones pendientes, límites regulatorios y semántica accesible.
3. Compartir markup SSR determinista únicamente para combinaciones idénticas
   de propiedades y fixtures inmutables dentro de cada archivo. No cachear APIs,
   resultados de seguridad, efectos, pruebas de interacción ni datos mutables.
4. No añadir skip/todo/exclude ni desactivar el fallo por cero pruebas. No juntar
   casos solo para presentar una cifra menor; retirar comprobaciones innecesarias.
5. Mantener intactas las suites de autenticación, recuperación, guardas, RLS,
   tenant, sesiones, carreras, auditoría, catálogo SQL y E2E reales.

## Datos, permisos y auditoría

Entradas: código/fixtures ficticios existentes y resultados de pruebas. Salidas:
inventario, resultados agregados y reporte versionable sin secretos. Propietario:
repositorio del proyecto. Resultados detallados temporales quedan en .tmp; no
leer ni escribir datos activos, credenciales o reservas institucionales. No
cambian permisos ni eventos de auditoría del producto. Git/spec/history registran
la trazabilidad del cambio y los casos retirados.

## Seguridad y aislamiento

Amenaza principal: eliminar un caso que sea la única defensa comprobada frente a
fuga de datos o acceso indebido. Mitigar con allowlist de cuatro archivos,
inventario explícito y revisión independiente. No cambiar grants, APIs, producto,
modelos, migraciones, proveedor de identidad ni configuración de test discovery.
Las pruebas PostgreSQL usan exclusivamente el runner aislado existente.

## Referencia visual

Se conserva el producto aprobado. prototype-claude es referencia inmutable; el
objetivo no es validar cada cadena o píxel del prototipo por pruebas unitarias.
Semántica accesible, estados y privacidad de las vistas se siguen comprobando.

## Ámbito de archivos / File scope

- apps/web/src/features/hospital/hospitalFinancial.test.tsx
- apps/web/src/features/hospital/hospitalAdministration.test.tsx
- apps/web/src/features/hospital/hospitalReportsVista.test.tsx
- apps/web/src/features/municipality/municipalityPrograms.test.tsx
- docs/OPTIMIZACION-PRUEBAS.md
- spec/specs/042-optimizacion-pruebas-esenciales/
- spec/specs/INDEX.md
- spec/bitacora/decisiones/2026-10-12-publicacion-y-optimizacion-pruebas.md
- spec/.sdd/user-consent.log

## Archivos y decisiones prohibidos

Código de producción, package/dependencias/configuración de runners, migrations,
tests API/E2E y demás suites web fuera de allowlist. prototype-claude/, tasks/,
reviews/ y main protegidos. No implementar S02–S14 ni modificar arquitectura,
reglas clínicas, finanzas, regulación o roles; no convertir mocks en aceptación.

## Dependencias, riesgos y compatibilidad

Depende de la entrega local d0be21e, Vitest/TypeScript instalados y runner de
baseline aislado. Sin dependencias nuevas, migraciones o despliegue. Revertir el
diff de pruebas recupera casos anteriores sin afectar datos. La reducción inicial
no afirma que todas las demás suites hayan sido auditadas o sean mínimas.

## Criterios de aceptación y pruebas requeridas

- Cada retirada está documentada con razón y comprobación conservada cuando
  corresponde. Revisión independiente sin pérdidas críticas pendientes.
- Suite web completa correcta, sin skips; conteos antes/después extraídos del
  runner, con número real de comprobaciones eliminadas separado de tiempo medido.
- Tipos, lint, scanner, diff-check y baseline aislada completa correctos.
- Las 25 etapas PostgreSQL y sus casos permanecen; no repetir E2E/imagen Docker
  sin cambio de producto, pero conservar comandos y evidencia anterior.
- Informar límites, commit de entrega, estado real de publicación y rama nueva.
