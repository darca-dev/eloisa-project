# Revisión final — Alcaldía A-04 Presupuesto y evidencias

## 1. Identificación

- **Task:** `TASK-ALCALDIA-A-04`
- **Especificación:** `tasks/TASK-ALCALDIA-A-04.md`
- **Fuente visual vinculante:** `prototype-claude/Eligeme-Alcaldia.dc.html`, secciones **Presupuesto y ejecución** y **Evidencias de ejecución**
- **Rama inspeccionada:** `develop`
- **Fecha:** 2026-08-21
- **Tipo:** auditoría final; implementación en solo lectura, sin cambios de código ni operaciones Git
- **Revisiones aplicadas:** 01 Orchestrator; 02 UX/UI; 03 Datos; 04 Seguridad; 05 Institucional/Regulatorio; 06 Integraciones; 07 QA; 09 Frontend

## 2. Estado

**IMPLEMENTADA Y VERIFICADA, SIN DEFECTOS BLOQUEANTES ATRIBUIBLES A A-04.**

A-04 cumple el alcance frontend demostrativo simplificado: presupuesto general y por programa, siete fuentes configuradas, semántica financiera demo cerrada, tabla aprobada **Facturas y soportes** como historial financiero, evidencia administrativa, detalle local sin archivos, relaciones por ID con Programas A-03 y metadatos preparatorios de sincronización sin integración activa.

La suite web completa conserva un fallo de branding preexistente en tres archivos Hospital fuera del diff. El Product Owner decidió expresamente diferir la corrección transversal a `BRAND-01`; por esa aceptación de baseline, el fallo se registra como excepción no bloqueante de A-04 y no se corrige en esta revisión.

## 3. Diff y allowlist

### Archivos modificados

1. `apps/web/src/features/municipality/MunicipalityShell.tsx`
2. `apps/web/src/features/municipality/municipality.module.css`
3. `apps/web/src/features/municipality/municipalityConfig.ts`
4. `apps/web/src/features/municipality/municipalityPrograms.test.tsx`
5. `apps/web/src/features/municipality/municipalityShell.test.tsx`
6. `apps/web/src/features/municipality/municipalityViews.test.ts`
7. `apps/web/src/features/municipality/municipalityViews.ts`

### Archivos nuevos

1. `apps/web/src/features/municipality/MunicipalityBudget.tsx`
2. `apps/web/src/features/municipality/MunicipalityEvidence.tsx`
3. `apps/web/src/features/municipality/MunicipalityFinancialDetails.tsx`
4. `apps/web/src/features/municipality/municipalityBudget.test.tsx`
5. `apps/web/src/features/municipality/municipalityEvidence.test.tsx`

Los doce archivos pertenecen a la allowlist exacta de la Task. No existen cambios en Hospital, backend, Prisma, migraciones, infraestructura, dependencias o `prototype-claude/**`. No hay archivos eliminados.

## 4. Verificaciones solicitadas

### 4.1 Presupuesto y cifras — PASS

La vista presenta:

| Métrica | Valor |
| --- | ---: |
| Asignado | $1.580 M |
| Ejecutado y pagado | $870 M |
| Comprometido | $410 M |
| Disponible | $300 M |
| Ejecución financiera | 55 % |

El fixture declara de forma explícita y localizada `$1.580 M = $410 M + $870 M + $300 M`. La Task y la interfaz aclaran que es una identidad interna del fixture, no una fórmula contable universal.

Los cinco programas conservan las cifras ya declaradas en A-03 y cada uno satisface su identidad demo:

| Programa | Asignado | Comprometido | Ejecutado | Disponible |
| --- | ---: | ---: | ---: | ---: |
| Atención domiciliaria | $680 M | $160 M | $402 M | $118 M |
| Adulto mayor | $420 M | $100 M | $248 M | $72 M |
| Discapacidad | $260 M | $60 M | $134 M | $66 M |
| Cuidado en casa | $150 M | $50 M | $68 M | $32 M |
| Formación de cuidadores | $70 M | $40 M | $18 M | $12 M |

Las sumas por programa producen los titulares generales: asignado $1.580 M, comprometido $410 M, ejecutado $870 M y disponible $300 M.

### 4.2 Coherencia de fuentes — PASS

Existen exactamente siete fuentes configurables:

1. SGP Salud Pública: $620 M.
2. Recursos propios: $320 M.
3. Recursos Nación: $220 M.
4. Recursos Departamento: $230 M.
5. ADRES / recurso administrado o girado mediante ADRES: $60 M.
6. Convenios: $100 M.
7. Otra fuente: $30 M.

Total: $1.580 M. Las asignaciones por fuente de cada programa suman su asignado y todo `sourceId` resuelve contra el catálogo.

### 4.3 Semántica financiero-contable demo — PASS

- `ASIGNADO`: presupuesto aprobado/asignado.
- `COMPROMETIDO`: recurso reservado todavía no pagado.
- `EJECUTADO`: exclusivamente dinero `PAGADO` y `VALIDADA` para la demo.
- `DISPONIBLE`: saldo restante declarado por el fixture.

`movimientoAlimentaEjecutado` exige simultáneamente `estadoFinanciero === 'PAGADO'` y `estadoValidacion === 'VALIDADA'`. No hay motor contable, asientos, causación, cierre, pago, persistencia ni mutación de saldos.

### 4.4 Factura no equivale automáticamente a ejecutado — PASS

`mov-demo-004` es una factura existente con estado financiero `CAUSADO_OBLIGADO` y validación `FALTA_SOPORTE`; no alimenta ejecutado. Los estados de evidencia y validación son tipos separados del estado financiero.

### 4.5 Historial Facturas y soportes — PASS

La vista no crea una nueva sección Movimientos. Reutiliza fielmente la tabla aprobada **Facturas y soportes** con fecha, factura/cuenta, proveedor/entidad, programa, fuente, valor, estado financiero, estado del soporte, origen y `Ver evidencia`.

Hay ocho movimientos demo: cuatro `PAGADO + VALIDADA` y cuatro que no alimentan ejecutado. La interfaz aclara que son una selección demostrativa y que su suma no reproduce el ejecutado total de los programas.

### 4.6 Estados de movimientos — PASS

Los estados financieros visibles son Asignado, Comprometido, Causado/Obligado y Pagado. Los estados de validación son Pendiente, En revisión, Falta soporte y Validada. Ambos ejes aparecen escritos y no dependen solo del color.

### 4.7 Evidencias — PASS

La vista conserva nivel de evidencia `92,8 %`, `232 de 250` actividades con soporte y `18` pendientes; tabla Facturas y soportes; proveedor/programa; fuente; valor; estado; cadena presupuesto–programa–actividad/movimiento–beneficiarios–evidencia–resultado.

Están preparados los diez tipos de soporte y los seis estados de evidencia aprobados. Cada evidencia referencia un `movimientoId`; no embebe ni duplica el movimiento.

### 4.8 Ver evidencia — PASS

`Ver evidencia` abre un detalle demostrativo accesible con metadatos locales del movimiento, evidencia, procedencia y sincronización. No contiene archivo, enlace, URL remota, carga, descarga, `FormData`, blob ni repositorio. La acción `Subir evidencia` puede navegar a esta vista sin simular una carga, conforme a la decisión del Product Owner.

### 4.9 Relación con Programas A-03 — PASS

Presupuestos, movimientos y evidencias conservan `programaId` y resuelven contra `municipalityProgramasDemo` mediante `programaMunicipal`. No se duplica la entidad Programa ni se reinterpreta `MunicipalityPrograma.origen` como fuente financiera.

### 4.10 Metadatos de sincronización futura — PASS

El movimiento canónico conserva ID interno, referencias externas con `sourceSystem`/`externalId`, `masterSystem`, `syncStatus`, `lastSyncedAt` y audiencias. Los fixtures usan solamente `NOT_CONNECTED` o `NOT_APPLICABLE`, con `lastSyncedAt: null`.

Los movimientos compartidos Hospital–Alcaldía son un solo registro con varias audiencias, no copias por experiencia. Las referencias externas no sustituyen al ID interno ni se repiten entre movimientos.

### 4.11 ADRES correctamente delimitado — PASS

Solo `fue-adres` declara `isAdresRelated: true`. Representa $60 M de $1.580 M (3,8 %) y aparece en un solo movimiento de ocho. El texto niega expresamente que ADRES sea origen total, propietario, aprobador o evaluador. No existe API, BDUA, LMA, consulta oficial ni activación del módulo A-05.

### 4.12 Privacidad — PASS

La UI usa agregados institucionales, roles y entidades ficticias. No expone HCE, diagnósticos, medicamentos, identidad/documento/dirección/contacto de pacientes, compensación individual, secretos o credenciales. No existe drill-down nominal ni acceso clínico.

### 4.13 Ausencia de integración falsa — PASS

No existen `fetch`, XHR, WebSocket, almacenamiento, cookies, temporizadores de sincronización o URLs externas. La interfaz muestra **Conexión no habilitada** y **Sin sincronización**, no fabrica fechas ni resultados de conciliación. No hay panel, CTA u operación de conciliación, redistribución o integración Hospital.

## 5. Fidelidad visual y accesibilidad

### Resultado — PASS estructural

- Presupuesto conserva encabezado, subtítulo, cinco métricas, barra/leyenda y desglose **Por población**.
- Evidencias conserva encabezado, panel azul de nivel de evidencia, tabla **Facturas y soportes**, `Ver evidencia` y cadena de relación.
- Las extensiones funcionales usan tarjetas, tablas, tipografía, colores, radios y tokens municipales existentes.
- Las tablas están dentro de regiones horizontales enfocables y nombradas, con `caption`, encabezados `scope=col` y filas `scope=row`.
- El detalle declara `role=dialog`, nombre, descripción, foco inicial, Escape, ciclo de foco y retorno al activador en el código.

Por decisión del Product Owner, el scroll horizontal legible/accesible es aceptable para este MVP. Los viewports exactos, zoom 200 % y recorrido real de tabulado no se ejecutaron y se registran como limitación visual no bloqueante, nunca como prueba aprobada.

## 6. Pruebas ejecutadas por la auditoría

| Comando/verificación | Resultado |
| --- | --- |
| `npm.cmd exec vitest run src/features/municipality/municipalityBudget.test.tsx src/features/municipality/municipalityEvidence.test.tsx --workspace @merdn/web` | **108/108 PASS** |
| Regresión municipal A-01/A-02/A-03 (7 archivos dirigidos) | **220/220 PASS** |
| Suite Hospital dirigida (14 archivos) | **541/541 PASS** |
| `npm.cmd run test --workspace @merdn/web` | **1010 PASS / 1 FAIL preexistente de branding** |
| `npm.cmd run lint` | PASS |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build:web` | PASS; `/municipality` generada correctamente |
| `git diff --check` | PASS |
| `git status --short`, diff y archivos no rastreados | Doce archivos, todos dentro de allowlist |

El fallo global está en `src/config/branding.test.tsx:154` y reporta literales en:

- `app/hospital/page.tsx`;
- `features/hospital/hospitalProfessionals.test.tsx`;
- `features/hospital/hospitalProfessionalsConfig.ts`.

Esos archivos no tienen diff A-04. La Product Owner ordenó no corregirlos ahora y trasladar el cambio transversal de marca a `BRAND-01`.

El reporte de Claude de «113 pruebas nuevas» es compatible con las 108 pruebas de los dos archivos A-04 nuevos más casos agregados en suites municipales existentes; esta auditoría toma como evidencia primaria los conteos ejecutados anteriores.

## 7. No regresión

- **A-01/A-02/A-03:** PASS, 220 pruebas dirigidas.
- **Hospital:** PASS, 541 pruebas dirigidas y cero archivos Hospital modificados.
- **Suite global:** una excepción de branding preexistente, aceptada y diferida por el Product Owner.
- **Prototipo:** intacto.
- **Backend/Prisma/infraestructura:** intactos.

No se identificó regresión atribuible a A-04.

## 8. Hallazgos bloqueantes

**Ninguno.**

## 9. Hallazgos no bloqueantes

1. **BRAND-01 pendiente:** la suite global permanece roja por tres archivos Hospital preexistentes. El Product Owner acepta el baseline y difiere la corrección transversal a ELOISA/ISA.
2. **Evidencia visual/interactiva no ejecutada:** no se verificaron empíricamente `1340×900`, `768×1024`, `375×812`, zoom/reflow 200 % ni recorrido completo de tabulado/lector de pantalla.
3. **Densidad vertical:** los bloques adicionales aprobados de semántica, fuentes, programas, estados y tipos hacen las vistas más largas que el prototipo. Conservan el orden y los patrones vinculantes; observar en la demostración normal del Product Owner.
4. **«Fuente oficial externa» demo:** un fixture usa esta procedencia, pero está rotulado `FIXTURE_DEMO`, desconectado y sin fecha de sincronización. No debe reutilizarse como afirmación oficial.
5. **Estados de sincronización futuros:** `MATCHED`, `DIFFERENCE` y `CONFLICT` existen en el contrato, pero ningún fixture los utiliza. Su semántica operativa corresponde a H-06B/Task posterior.
6. **Tamaño de configuración:** `municipalityConfig.ts` creció de forma considerable al centralizar tipos, copy y fixtures A-04. Está autorizado y no causa un defecto funcional, pero conviene segmentarlo por dominio en una Task posterior, sin refactorizar A-04 ahora.
7. **Referencias externas múltiples:** el modelo admite una colección 1:N, mientras el detalle muestra actualmente la primera referencia. Es suficiente para el demo; H-06B/conciliación deberá definir cómo presentar y gobernar varias referencias.

## 10. Limitaciones visuales aceptadas

1. Scroll horizontal de tablas en viewports estrechos, siempre que permanezca legible y enfocable.
2. Capturas exactas en tres viewports: no ejecutadas.
3. Zoom/reflow 200 %: no ejecutado.
4. Tabulado real, lector de pantalla y foco modal en navegador: no ejecutados; estructura revisada estáticamente.

Estas limitaciones son no bloqueantes por decisión expresa del Product Owner, bajo el mismo criterio aplicado a A-01/A-02/A-03.

## 11. Archivos fuera de alcance

**Ninguno.** El diff se limita a los doce archivos autorizados de `apps/web/src/features/municipality/**`.

## 12. Dependencias nuevas

**Ninguna.** No cambiaron manifests ni lockfiles.

## 13. Decisiones productivas pendientes, fuera de A-04

Permanecen abiertas para tareas posteriores: semántica contable productiva; estados y transiciones oficiales; roles, permisos y separación de funciones; persistencia; auditoría; retención e integridad documental; carga/descarga real; redistribución; conciliación; contrato H-06B; idempotencia/matching; conectores y fuentes oficiales; reportes/exportaciones; metodología oficial de atribución y costo promedio.

Ninguna bloquea el frontend demostrativo aprobado.

## 14. Conclusión y gate

A-04 está alineada con la Task simplificada y con las dos secciones vinculantes del prototipo. Una persona puede comprender cuánto se asignó, comprometió, pagó/ejecutó y dejó disponible; en qué programa; qué movimiento demostrativo explica el gasto; y qué evidencia administrativa lo respalda.

**READY FOR COMMIT: SÍ.**

Este gate reconoce la excepción de branding preexistente expresamente aceptada por el Product Owner y las limitaciones visuales no bloqueantes. No ejecuta ni autoriza por sí mismo commit, push, merge, release o despliegue; esas operaciones requieren autorización independiente.
