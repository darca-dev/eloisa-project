# MERDN Task Specification

## Task Identification

- **Task ID:** MUNICIPALITY-CORE-01
- **Title:** Población y territorio municipales con agregados de CORE-01
- **Status:** APPROVED — READY FOR CLAUDE CODE
- **Priority:** HIGH
- **Created by:** Codex
- **Approved by:** Product Owner — decisiones MUNICIPALITY-CORE-01 incorporadas

> El Product Owner cerró acceso municipal MVP, protección de grupos pequeños y adaptación visual de Territorio. Esta Task queda suficientemente definida para implementación por Claude Code. No autoriza commit, push, merge ni despliegue.

## Objective

Sustituir exclusivamente en las vistas existentes de Alcaldía **Población beneficiaria** y **Territorio** los fixtures que CORE-01 ya permite calcular por agregados reales de PostgreSQL del tenant activo, sin exponer personas ni direcciones individuales, sin inventar fuentes oficiales y sin rediseñar la experiencia aprobada.

## Inspected Baseline and Findings

### Hechos verificados

1. CORE-01 persiste `Person`, `Patient`, `PatientPopulationMembership`, `TerritorialUnit` y `PatientAddress` con `tenantId`, claves compuestas y RLS para tablas aisladas.
2. `Person.birthDate` permite calcular 60+ a la fecha de corte. La pertenencia persistida `OLDER_ADULT_60_PLUS` se deriva al inscribir, pero puede quedar obsoleta cuando una persona cumple 60; el resumen debe derivarla nuevamente desde `birthDate`.
3. `DISABILITY` y `HOME_CARE_REQUIRED` existen como pertenencias declaradas, no diagnósticos ni certificaciones oficiales.
4. `Patient.epsCode` y `epsNameControlled` son obligatorios. Con el esquema actual, “EPS faltante” siempre será cero para registros válidos de CORE-01 y no aporta una métrica de calidad útil.
5. El documento es obligatorio y único por tenant, por lo que CORE-01 previene duplicados por la clave normalizada. No existe motor de matching de “duplicados potenciales”.
6. La dirección contiene municipio canónico, `areaType`, unidad local canónica opcional y `localityPendingNormalization`. La dirección exacta y los textos no verificados son datos personales sensibles.
7. CORE-01 no contiene población total municipal, población objetivo oficial, RLCPD, visitas, alertas municipales, atención, cuidadores, presupuestos ni denominadores de cobertura.
8. La API implementada solo ofrece inscripción y `GET /api/v1/patients/me`; no existe módulo municipal, autenticación institucional ni autorización por rol.
9. Las vistas actuales reciben `municipalityDemo` y presentan valores ficticios. La tabla de Territorio conserva columnas de visitas, alertas y cobertura que CORE-01 no puede producir.
10. El runtime entra por `PrismaService.withTenant()`, adopta `merdn_runtime`, fija `merdn.tenant_id` con alcance transaccional y falla cerrado cuando no confirma rol y tenant.

### Matriz de calculabilidad

| Métrica | Estado | Fuente/regla permitida |
| --- | --- | --- |
| Beneficiarios únicos registrados | Calculable | `COUNT(DISTINCT Patient.personId)` de pacientes `ACTIVE` del tenant |
| 60+ | Calculable | `Person.birthDate` contra `asOfDate`, edad calendario UTC, umbral 60 |
| Discapacidad | Calculable | membresía declarada `DISABILITY` |
| Cuidado en casa | Calculable | membresía declarada `HOME_CARE_REQUIRED` |
| Siete intersecciones exclusivas | Calculable | combinación booleana por persona; cada persona cae en una sola región |
| Total deduplicado | Calculable | personas/pacientes únicos, nunca suma de categorías |
| Municipio → urbana/rural → barrio/vereda | Calculable | `PatientAddress` + unidades territoriales canónicas |
| Pendiente de normalización territorial | Calculable | `localityPendingNormalization = true` o `localUnitId IS NULL`, con invariante consistente |
| EPS faltante | Técnicamente cero | EPS es obligatoria; no presentar como hallazgo material |
| Registros incompletos | No definido | no existe definición aprobada de completitud; requiere catálogo de campos/regla |
| Duplicados potenciales | No calculable | no existe mecanismo de matching; la unicidad documental solo previene conflictos exactos |
| Población municipal/objetivo/RLCPD | No disponible | requiere fuente oficial externa con periodo, versión, propietario y linaje |
| Cobertura/brecha de vinculación | No calculable | falta denominador oficial válido |
| Visitas, alertas y cobertura territorial | No calculable | entidades y reglas ausentes de CORE-01 |

## Users and Modules Affected

- **Usuarios:** identidad institucional mínima con rol `MUNICIPAL_VIEWER`.
- **Institución/tenant:** Alcaldía del tenant activo resuelto en servidor.
- **Módulos en alcance:** experiencia Alcaldía; Población beneficiaria; Territorio; API municipal agregada; lectura de datos CORE-01.
- **Relacionados sin cambio funcional:** identidad/paciente, territorio, seguridad, auditoría y OpenAPI.
- **No afectados:** paciente individual, hospital, clínica, programas, finanzas, FURAG/MIPG, ADRES, SENA, agenda, visitas y pagos.

## Functional Requirements

1. **FR-01 — API específica.** Crear `GET /api/v1/municipality/population-summary` y `GET /api/v1/municipality/territory-summary`, salvo que una revisión de arquitectura justifique nombres equivalentes. Nunca reutilizar `/patients/me`.
2. **FR-02 — Contexto.** Resolver el tenant únicamente en servidor. No aceptar `tenantId` en query, path, body ni header aportado libremente por el navegador.
3. **FR-03 — Población.** Devolver total único, conteos de las tres condiciones y exactamente las siete combinaciones exclusivas. Incluir `asOfDate` para la edad y `generatedAt`.
4. **FR-04 — Edad.** Calcular 60+ desde `birthDate` a `asOfDate`; no confiar exclusivamente en la membresía histórica `OLDER_ADULT_60_PLUS`.
5. **FR-05 — Deduplicación.** La unidad de conteo es la persona/paciente único del tenant. La suma de las siete regiones debe ser igual al total único.
6. **FR-06 — Territorio.** Agregar por municipio canónico, `areaType` y unidad local canónica. La tabla funcional conserva su estructura visual y muestra: Zona/Barrio/Vereda, Personas registradas, 60+, Discapacidad, Cuidado en casa y Pendientes de normalización territorial.
7. **FR-07 — Pendientes.** Los registros pendientes se cuentan de forma agregada por municipio y área; no devolver el texto libre de localidad, corregimiento, dirección o indicaciones.
8. **FR-08 — Oficialidad.** Métricas oficiales ausentes se representan como `UNAVAILABLE`, con valor nulo y mensaje visible “Dato oficial no disponible”; nunca se envía el fixture como fallback.
9. **FR-09 — Calidad.** En este slice solo mostrar métricas con regla real: territorio pendiente. No mostrar “duplicados potenciales”, afiliaciones por verificar, documentos pendientes, completitud ni EPS faltante como si fueran hallazgos reales.
10. **FR-10 — Brechas.** Limitar brechas a conteos descriptivos verificables (territorio pendiente y población `HOME_CARE_REQUIRED`). No atribuir necesidad, causalidad, prioridad clínica ni insuficiencia de recursos.
11. **FR-11 — Estados UI.** Conservar composición y navegación aprobadas e incorporar, según diseño aprobado, carga, éxito, vacío, dato oficial no disponible, 401/403 y error recuperable. No mezclar fixtures con datos reales en una misma cifra.
12. **FR-12 — Fallo.** Si la API o el contexto seguro fallan, no mostrar datos anteriores de otro contexto ni reemplazarlos por fixtures; presentar el estado de error aprobado.
13. **FR-13 — Sesión institucional MVP.** Crear una identidad institucional mínima y reutilizable con sesión server-side segura en cookie `HttpOnly`, coherente con el patrón de CORE-01 pero separada de la sesión de autoinscripción. El frontend no contiene secretos y no envía ni selecciona tenant.
14. **FR-14 — Rol municipal.** Solo `MUNICIPAL_VIEWER` puede consumir los dos endpoints municipales agregados. La identidad institucional mínima no constituye el sistema completo de usuarios/roles y debe permitir evolución posterior sin acoplar autorización a la UI.
15. **FR-15 — Supresión.** Toda celda agregada sensible aplica en servidor: cero se representa como conteo exacto `0`; de uno a cuatro no devuelve el número exacto y se representa como `<5` con estado explícito `SUPPRESSED`; cinco o más se representa como conteo exacto. No habrá porcentajes, subtotales complementarios ni combinaciones que permitan reconstruir fácilmente un valor suprimido.

## API and DTO Contract

Los nombres finales se documentarán en OpenAPI. Los DTOs serán explícitos y no expondrán modelos Prisma.

### `PopulationSummaryDto`

- `source: "ELOISA_POSTGRESQL"`
- `asOfDate: YYYY-MM-DD`
- `generatedAt: ISO-8601`
- `uniqueRegistered: SuppressedCountDto`
- `populations: { olderAdult60Plus, disabilityDeclared, homeCareRequiredDeclared }`, cada valor como `SuppressedCountDto`
- `exclusiveIntersections: { olderOnly, disabilityOnly, homeCareOnly, olderAndDisabilityOnly, olderAndHomeCareOnly, disabilityAndHomeCareOnly, allThree }`, cada valor como `SuppressedCountDto`
- `officialMetrics`: población municipal, población objetivo, RLCPD y cobertura con estado `UNAVAILABLE`, `value: null` y sin denominador inventado.
- `quality: { territoryPendingNormalization }`

`SuppressedCountDto` es una unión discriminada: `{ status: "EXACT", value: 0 | integer>=5, display: string }` o `{ status: "SUPPRESSED", value: null, display: "<5" }`. La API nunca serializa el conteo real 1–4 en otro campo, metadato, porcentaje, total complementario o mensaje.

### `TerritorySummaryDto`

- `source`, `asOfDate`, `generatedAt`
- jerarquía `municipalities[] → areas[] → localUnits[]`
- identificadores territoriales canónicos mínimos: código oficial de municipio cuando exista, `areaType`, `localUnitId` opaco y nombre de exhibición normalizado.
- por nodo: `uniquePeople`, conteos poblacionales e intersecciones como `SuppressedCountDto`, eliminando cualquier subtotal o combinación de respuesta que reconstruya fácilmente valores suprimidos.
- `pendingNormalization` agregado como `SuppressedCountDto`, separado de unidades canónicas.
- prohibido incluir texto territorial no verificado.

No se añadirán campos de visitas, alertas, cobertura, pacientes o direcciones para conservar compatibilidad con fixtures.

## Data, Ownership and Minimization

| Entidad/dato | Uso | Propietario | Sensibilidad | Restricción |
| --- | --- | --- | --- | --- |
| `Person.birthDate` | Derivar 60+ | tenant | personal sensible | solo cálculo server-side; nunca en DTO municipal |
| `Patient.personId/status` | unidad de conteo | tenant | personal | solo `COUNT DISTINCT`; ningún ID en DTO |
| membresías | categorías agregadas | tenant | salud/declaración sensible | etiquetas deben decir “declarada” cuando corresponda |
| territorio canónico | agrupación | tenant/territorio común | sensible por granularidad | 0 exacto; 1–4 suprimido como `<5`; >=5 exacto |
| estado de normalización | calidad administrativa | tenant | agregado | sin texto libre ni dirección |

### Datos prohibidos en DTO, UI, logs, auditoría y errores

Nombre, documento, teléfono, correo, `patientId`, `personId`, fecha de nacimiento, edad individual, dirección exacta, indicaciones, texto libre de localidad/corregimiento, HCE, diagnóstico, consentimiento, EPS individual y cualquier listado o drill-down nominativo.

## Permissions and Tenant Isolation

El acceso municipal MVP queda aprobado con una identidad institucional mínima reutilizable y el único rol `MUNICIPAL_VIEWER`. No es el sistema completo de usuarios/roles.

Requisitos no negociables:

1. autorización server-side por usuario, función municipal, tenant, municipio, finalidad y vigencia;
2. `PrismaService.withTenant(tenantId)` en toda consulta de negocio;
3. filtros explícitos de `tenantId` más RLS como defensa complementaria;
4. ninguna confianza en un tenant o rol enviado por cliente;
5. cookie institucional `HttpOnly`, `Secure` fuera de desarrollo, `SameSite` apropiado, token aleatorio en claro solo en cookie y hash server-side con expiración, revocación y rotación/fijación protegida;
6. la cookie de autoinscripción de paciente no autentica Alcaldía y la sesión institucional no concede acceso a endpoints individuales de pacientes;
7. `401` para sesión ausente/inválida y `403` para identidad autenticada sin `MUNICIPAL_VIEWER`, con envelope estable y sin confirmar existencia de datos;
8. exportación, búsqueda, filtros arbitrarios y acceso nominal fuera de alcance.

## Audit Requirements

Añadir eventos de creación/revocación de sesión institucional y de acceso municipal exitoso/denegado. Registrar identificador opaco del actor institucional, tenant, rol/permiso, endpoint, timestamp, resultado y correlation ID. No registrar credenciales, tokens/hashes, conteos por grupos pequeños, payloads, SQL ni datos individuales. El enum y esquema actuales de `AuditEvent` no soportan estos eventos/actores: la implementación puede crear una migración aditiva mínima y documentar rollback, sin construir el sistema completo de identidades o auditoría.

## Security and Privacy Requirements

1. Deny-by-default y fail-closed si falla autenticación, autorización, resolución de tenant, rol runtime o RLS.
2. Protección MVP contra inferencia aplicada server-side: 0 exacto; 1–4 como `SUPPRESSED`/`<5`; >=5 exacto. Aplica a territorio, poblaciones, intersecciones y cualquier celda sensible. No es un umbral legal oficial colombiano y queda sujeto a validación jurídica futura.
3. Sin caché compartida entre tenants/usuarios. Respuestas municipales: `Cache-Control: private, no-store` mientras no exista diseño de caché seguro aprobado.
4. Consultas parametrizadas/Prisma, límites de tiempo y manejo uniforme de errores sin SQL, stack, IDs internos ni detalles de topología.
5. No emitir telemetría cliente con payloads o conteos granulares; logs estructurados y minimizados.
6. Pruebas solo con personas ficticias y combinaciones sintéticas, incluidos cumpleaños límite y grupos pequeños.

## Institutional and Regulatory Constraints

| Área | Evaluación | Restricción |
| --- | --- | --- |
| FURAG/MIPG | NO AFECTA | no calcular ni presentar puntuación |
| ADRES/RLCPD | AFECTA COMO AUSENCIA | mostrar no conectado/no disponible; no afirmar consulta oficial |
| Sentencia T-319 de 2025 | NO AFECTA | no derivar obligaciones o cumplimiento |
| SENA | NO AFECTA | sin datos de formación/certificación |
| Indicadores | AFECTA | los agregados ELOISA deben declarar fuente y fecha; no son estadísticas oficiales municipales |
| Finanzas/evidencia | NO AFECTA | ninguna brecha presupuestal, gasto o evidencia |

## Visual Reference

- `prototype-claude/Eligeme-Alcaldia.dc.html`, vistas Población y Territorio.
- `apps/web/src/features/municipality/MunicipalityPopulation.tsx` y `MunicipalityTerritory.tsx` son la implementación visual actual.
- Mantener navegación, jerarquía, tarjetas, diagrama, tabla, estilo, responsive y accesibilidad aprobados.
- Los números, fuentes, conclusiones, columnas de visitas/alertas/cobertura y rótulos “demo” son contenido demostrativo, no reglas productivas.

La adaptación visual está aprobada y **no requiere Claude Design**. Conservar estructura, jerarquía, cards/tablas, estilo y responsive existentes. Sustituir en la vista funcional `VISITAS`, `ALERTAS` y `COBERTURA` por `60+`, `DISCAPACIDAD`, `CUIDADO EN CASA` y `PENDIENTES DE NORMALIZACIÓN`, junto a Zona/Barrio/Vereda y Personas registradas. Es una adaptación de datos, no un rediseño. Las métricas retiradas podrán reincorporarse únicamente cuando existan visitas y alertas reales y un denominador oficial conectado.

## Allowed Files

- `apps/api/src/municipality/**` — módulo, controller, DTOs, servicio agregado y pruebas unitarias.
- `apps/api/src/institutional-auth/**` — identidad/sesión institucional mínima, guard y rol MVP reutilizables; no sistema completo de usuarios/roles.
- `apps/api/src/app.module.ts` — registrar módulo.
- `apps/api/src/openapi/**` y pruebas OpenAPI — contrato real.
- `apps/api/test/**municipality**` — API, DB, permiso, RLS y aislamiento.
- `apps/web/src/features/municipality/MunicipalityPopulation*`
- `apps/web/src/features/municipality/MunicipalityTerritory*`
- nuevos clientes/contratos municipales dentro de `apps/web/src/features/municipality/**`.
- `prisma/schema.prisma` y migración(es) aditiva(s) nuevas — identidad/sesión institucional mínima, rol y auditoría aprobados; nunca reescribir CORE-01.

## Forbidden Files and Actions

- `prototype-claude/**`, `AGENTS.md`, `CLAUDE.md` y documentación estratégica no autorizada.
- Reescribir migraciones CORE-01 ya aplicadas.
- Crear acceso municipal mediante `/patients/me` o cookie de autoinscripción.
- Añadir dependencias mayores, fixtures oficiales falsos, reglas clínicas o integraciones externas.
- Commit, push, merge, rebase, despliegue o modificación de `main`.

## Approved Decisions and Remaining Non-blocking Matters

| ID | Estado | Decisión |
| --- | --- | --- |
| OD-01 | CERRADA | identidad institucional mínima, cookie HttpOnly/sesión server-side y rol `MUNICIPAL_VIEWER` para agregados municipales |
| OD-02 | CERRADA | 0 exacto; 1–4 `SUPPRESSED` como `<5`; >=5 exacto; sin reconstrucción por porcentajes o complementos |
| OD-03 | CERRADA | adaptación de datos en tabla territorial aprobada; Claude Design no requerido |
| OD-04 | DIFERIDA, NO BLOQUEA | definición de “registro completo”; excluida del slice |
| OD-05 | DIFERIDA, NO BLOQUEA | validación jurídica final del umbral; la regla vigente es salvaguarda de producto, no umbral legal oficial |

## Out of Scope

Fuentes oficiales, integraciones ADRES/RLCPD, denominadores y cobertura; listados o drill-down de pacientes; exportación; búsqueda; mapa/geocodificación; visitas y alertas; cuidadores; atención/servicios; presupuesto; comparación causal; reglas clínicas; limpieza territorial; detección/fusión de duplicados; actualización de pertenencias persistidas; producción con datos sensibles.

## Acceptance Criteria

1. Los dos endpoints solo entregan agregados del tenant server-side y carecen de identificadores o datos individuales.
2. Para las siete combinaciones sintéticas, cada persona aparece exactamente en una región y la suma equivale a `uniqueRegistered`.
3. Una persona que cumple 60 en `asOfDate` cuenta como 60+ aunque su membresía histórica no haya sido actualizada; el día anterior no cuenta.
4. Las agrupaciones territoriales respetan municipio → urbana/rural → unidad local canónica, y pendientes quedan separados sin texto libre.
5. Un usuario/tenant no puede observar datos de otro tenant, aun manipulando parámetros, IDs o reutilizando conexiones.
6. Una petición no autenticada o sin permiso no recibe agregados.
7. La supresión se aplica server-side: 0 exacto, 1–4 con `value: null`/`display: "<5"`, >=5 exacto; evita reconstrucción mediante subtotales, porcentajes o combinaciones complementarias.
8. Población oficial, población objetivo, RLCPD y cobertura se muestran como no disponibles, nunca con fixture ni porcentaje calculado.
9. La UI no muestra duplicados potenciales, EPS faltante, completitud, visitas, alertas, cobertura o brechas no soportadas como datos reales.
10. Estados de carga, vacío, error, denegación y dato no disponible son accesibles y no sustituyen fallos por fixtures.
11. La adaptación de datos de Territorio aprobada por el Product Owner conserva la estructura visual existente, no requiere Claude Design y no modifica `prototype-claude/`.
12. OpenAPI coincide con la superficie implementada; pruebas existentes de API/web siguen pasando.
13. Tras crear varios pacientes ficticios mediante CORE-01, un `MUNICIPAL_VIEWER` ve los agregados persistidos; al agregar otro paciente y refrescar, los agregados cambian conforme a PostgreSQL.
14. La sesión institucional no habilita `/patients/me` ni ningún acceso individual, y la cookie de autoinscripción no habilita los endpoints municipales.

## Required Tests

| ID | Tipo | Escenario | Resultado esperado |
| --- | --- | --- | --- |
| T-01 | Unit/Data | 0, 1 y las siete combinaciones | conteos exactos e invariante de suma |
| T-02 | Unit/Data | cumpleaños 60: día anterior, mismo día y posterior; UTC | clasificación calendario correcta |
| T-03 | DB integration | datos mixtos de dos tenants | solo tenant activo, con filtros y RLS |
| T-04 | DB security | rol/contexto RLS ausente, incorrecto o conexión reutilizada | falla cerrada/sin fuga |
| T-05 | Permission/API | sin sesión, rol incorrecto, tenant/contexto incorrecto, autorizado | 401/403/éxito según contrato |
| T-05A | Auth integration | cookie institucional válida, expirada, revocada, manipulada y cookie de paciente | solo sesión institucional vigente con `MUNICIPAL_VIEWER` autoriza; tokens nunca quedan en logs/respuestas |
| T-06 | Privacy/API | inspección profunda de DTO y errores | ningún dato prohibido |
| T-07 | Territory | urbana, rural, local canónica y pendiente | jerarquía y pendientes exactos |
| T-08 | Small groups | bajo umbral, ceros y subtotales complementarios | supresión/generalización sin inferencia |
| T-09 | Official data | fuente externa ausente | `UNAVAILABLE`, nulo, sin cobertura |
| T-10 | Web component | éxito, cero, no disponible, 401/403 y 5xx | copy/estado aprobado y sin fixture fallback |
| T-11 | Accessibility | tabla, lista, diagrama, foco, teclado y announcements | semántica y alternativa textual preservadas |
| T-12 | OpenAPI/Regression | superficie y suites existentes | contrato exacto y cero regresiones |
| T-13 | E2E/DB | crear pacientes vía CORE-01, entrar como `MUNICIPAL_VIEWER`, abrir Población/Territorio, crear otro paciente y refrescar | UI refleja PostgreSQL y cambia sin fallback a fixtures |

## Rollback and Compatibility

- Cambio aditivo: desregistrar módulo/rutas y revertir consumo frontend restaura el comportamiento previo; no borrar datos CORE-01.
- Ninguna migración existente se modifica. Una migración nueva debe tener rollback documentado y no eliminar columnas/filas.
- No conservar fixtures como fallback silencioso; si se requiere modo demo separado, debe ser ruta/configuración explícita y fuera de este slice salvo aprobación.

## Expected Handoff

Claude Code deberá devolver archivos y propósito, contratos OpenAPI, estrategia de consulta, evidencia de invariantes y supresión, comandos/resultados exactos, pruebas negativas de autenticación/permisos y tenant/RLS, evidencia de ausencia de datos prohibidos, prueba E2E de actualización desde PostgreSQL, capturas de estados y viewports aprobados, verificación de que el prototipo no cambió, migración/rollback, desviaciones y riesgos. El resultado vuelve a Codex para auditoría y al Product Owner para aceptación; no autoriza Git ni despliegue.
