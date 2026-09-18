# Plan 008 - Agregados municipales protegidos

## Resumen

**RETROSPECTIVO.** Este plan no propone trabajo: reconstruye, desde `history.md`
y desde el código, lo que ya se ejecutó. Dos commits, ambos del 2026-08-22, uno
de ellos con 43 archivos.

Lo que se construyó fue más que dos endpoints. Fue la primera superficie de
lectura institucional de MERDN, y con ella el cimiento de autenticación
institucional que después reutilizaron Hospital, Identidad y la shell
profesional.

## Contexto técnico

La capacidad se apoya íntegramente en la persistencia que abrió la spec 007. No
crea ni una sola tabla de datos de personas: lee `patient`, `person`,
`patient_address`, `population_membership` y el catálogo territorial, y solo
añade lo que le faltaba al repositorio para dejar mirar esos datos sin verlos:
identidad institucional, sesión y auditoría de acceso.

Tres decisiones técnicas gobiernan el resultado:

1. **El contrato de la respuesta es propio, no un reflejo del almacenamiento.**
   `municipality.contract.ts:6` lo declara y no importa nada de Prisma. Esa
   separación es la que permite que la unidad publicada sea `SuppressedCount`
   —una unión discriminada donde la variante suprimida tiene `value: null`— en
   lugar de un número.

2. **La supresión es un problema de álgebra, no de umbral.** La regla 1–4 por sí
   sola no protege nada si el total exacto se publica junto a sus partes. La
   implementación modela la respuesta como un sistema lineal y suprime celdas
   adicionales hasta que ningún conteo sensible quede determinado, con
   aritmética racional exacta sobre `bigint` para que la coma flotante no pueda
   declarar segura una celda que no lo es.

3. **La autorización se compone, no se duplica.** `MunicipalAggregateAccessGuard`
   envuelve a `MunicipalViewerGuard` en lugar de reimplementarlo, y añade
   únicamente la auditoría de las denegaciones. Esa forma es la que permitió que
   Hospital, en las specs 009 y 010, añadiera sus propios guards de rol sin
   tocar la decisión de autenticación.

## Fases de implementación (ejecutadas)

**Fase 1 — Task Specification.** Commit `06b0048` (2026-08-22), 1 archivo:
`tasks/TASK-MUNICIPALITY-CORE-01.md`. Fija las 14 acciones no negociables de
permisos, los datos prohibidos, la regla de supresión (OD-02), la adaptación de
la tabla territorial (OD-03) y difiere OD-04 y OD-05.

**Fase 2 — Implementación completa.** Commit `4094e88` (2026-08-22), 43
archivos, 34 de ellos nuevos. En un solo commit:

- *Migración*: `20260822130000_municipality_core_01/migration.sql` más
  `ROLLBACK-municipality_core_01.sql`. Enums, columnas de auditoría, dos tablas,
  RLS, políticas y mínimo privilegio sin `DELETE`.
- *Identidad institucional*: trece archivos nuevos en
  `apps/api/src/institutional-auth/`. Aquí nace la autenticación institucional de
  MERDN.
- *Módulo municipal*: once archivos en `apps/api/src/municipality/`, incluidas las
  tres pruebas unitarias.
- *Contrato público*: `openapi/openapi.ts` y `test/openapi.test.ts` modificados.
- *Pruebas de integración*: `municipality.api.test.ts`,
  `municipality-aggregates.db.test.ts`, `municipality-fixtures.ts`.
- *Web*: cuatro archivos nuevos —contrato, cliente, hook y prueba del cliente— y
  la modificación de las dos vistas que la spec 005 ya había construido, más sus
  pruebas y la de privacidad.

No hubo fase de auditoría. `ls reviews/` no contiene ningún
`REVIEW-MUNICIPALITY-CORE-01`, a diferencia de las specs vecinas 005 y 007.

## Dependencias

- **Spec 001**: monorepo, NestJS, Next.js, Prisma y PostgreSQL en Compose.
- **Spec 005**: `MunicipalityShell`, `MunicipalityPopulation.tsx` y
  `MunicipalityTerritory.tsx`, creadas en `672a11a` y `1a921ee`. Esta capacidad
  las conectó; no las diseñó.
- **Spec 006**: marca pública consumida por la feature.
- **Spec 007**: `withTenant()`, rol `merdn_runtime`, `merdn_current_tenant()`,
  RLS y las tablas que contienen los datos agregados. Sin inscripción persistida
  los dos endpoints devuelven ceros exactos, que es el comportamiento correcto y
  está probado (`population-summary.test.ts:121`).
- **Configuración de despliegue**: `MERDN_MUNICIPAL_VIEWER_SECRET`, sin valor por
  defecto. Sin ella la identidad no se aprovisiona y Alcaldía responde como no
  autenticada.

Consumidores posteriores: specs 009, 010, 011 y 014, todas apoyadas en
`institutional-auth/`.

## Hitos

- **H1 — Identidad y sesión institucional server-side.** Migración aplicada,
  cookie `HttpOnly`, token solo como SHA-256, credencial solo como derivación
  `scrypt`, y la base rechazando por CHECK cualquier otra forma. Fase 2.
- **H2 — Denegación por defecto con rastro.** `401`/`403` uniformes, con
  auditoría de la denegación que no puede convertirse en permiso. Fase 2.
- **H3 — Supresión primaria y complementaria.** Umbral 1–4 más eliminación de
  reconstrucción por subtotales, con aritmética exacta. Fase 2; probado en
  `suppression.test.ts:143`.
- **H4 — Aislamiento por institución verificado contra PostgreSQL.** RLS,
  ausencia de `DELETE` para el rol runtime y clave foránea compuesta. Fase 2;
  probado en `municipality-aggregates.db.test.ts:400`.
- **H5 — Dos vistas de Alcaldía leyendo datos reales sin repliegue a fixtures.**
  Fase 2. Alcanzado a nivel de código; ver el primer riesgo.

## Riesgos (vigentes hoy)

**R-1. Alcaldía no puede autenticarse desde Alcaldía.** Es el riesgo más serio.
La feature `municipality` no contiene ninguna forma de abrir una sesión
institucional: la única del navegador vive en
`apps/web/src/features/hospital/hospitalInstitutionClient.ts:272` y llegó con la
spec 014. H5 se cumple en el código —las vistas leen de la API y no tienen
fallback— pero para una persona que abre `/municipality` el desenlace esperable
hoy es el estado `no-autorizado`. Cualquier trabajo futuro sobre Alcaldía debería
empezar por aquí.

**R-2. El control de privacidad más delicado del repositorio nunca fue
auditado.** `suppression.ts` es correcto en lo que se puede leer y está bien
probado en sus 9 casos, pero es también la pieza donde un error no produce un
fallo visible: produce una filtración silenciosa. No hay veredicto de Codex sobre
él.

**R-3. El umbral no tiene validación jurídica.** OD-05 sigue diferida. El propio
archivo lo declara (`suppression.ts:23`): es una salvaguarda de producto, no un
umbral legal colombiano. Antes de cualquier uso con datos reales de personas eso
debería resolverse.

**R-4. La protección es por respuesta, no por serie de respuestas.**
`suppression.ts:25` reporta el riesgo residual: un observador que compare dos
consultas tomadas en momentos distintos puede deducir más que cualquiera de las
dos por separado. No hay privacidad diferencial ni ruido.

**R-5. Fixtures y datos reales conviven en la misma pantalla.** Once de las trece
vistas de Alcaldía siguen alimentándose de `municipalityConfig.ts`. Está
etiquetado —«Datos demostrativos» frente a «Datos registrados en la
plataforma»—, pero es una fuente permanente de confusión para quien revise la
experiencia, y el fixture de población (3.050 beneficiarios) sigue en el código
aunque la vista conectada ya no lo pinte.

**R-6. Documentación interna desincronizada.**
`apps/web/src/app/municipality/page.tsx:12` afirma que la experiencia no llama a
la API, y `municipalityPrivacidad.test.tsx:196` conserva un título que afirma que
la feature no consulta red. La prueba pasa por la forma en que está escrito el
cliente, no porque la afirmación siga siendo cierta. Quien lea solo esos dos
puntos se llevará una idea equivocada del sistema.

**R-7. Sin límite de tasa ni tiempo máximo en las dos lecturas.** Solo la
apertura de sesión está limitada. La Task pedía límites de tiempo y no se
implementaron. Súmese que ambas consultas traen todas las filas activas del
tenant y agregan en memoria del proceso Node
(`municipality.service.ts:62` y `:109`).

**R-8. Credencial compartida por rol.** La auditoría puede decir qué identidad
consultó, nunca quién. Es una limitación reconocida y deliberada del MVP, pero
significa que el rastro no sirve para atribuir responsabilidad individual.
