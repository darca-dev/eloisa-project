# TASK-HOSPITAL-CORE-02 — Continuation after interrupted run

## 1. Propósito

Continuar `TASK-HOSPITAL-CORE-02-FINAL-CORRECTION` exclusivamente desde el estado actual del worktree, sin repetir lo ya implementado y sin diagnosticar la interrupción.

Este paquete no reabre arquitectura, backend, modelos, migraciones, seguridad, RLS ni CORS. Autoriza únicamente completar la integración frontend y sus gates focalizados.

## 2. Estado verificado que debe preservarse

### Completo y correcto — no rehacer

1. `hospitalProfessionalsClient.ts` y su prueba:
   - GET de listado/detalle;
   - allowlist de query;
   - `credentials: "include"`, no-store y `AbortSignal`;
   - mapeo de estados y ausencia de fallback.
2. `hospitalAgendaClient.ts` y su prueba:
   - GET de Agenda;
   - PATCH de asignación con body exacto;
   - control por versión, errores y cancelación;
   - helpers deterministas de ventana/fecha.
3. Resultado focal comprobado: los dos archivos de clientes suman **36 pruebas PASS**.
4. `hospitalProfessionalsConfig.ts` ya retiró imports y derivaciones factuales de Pacientes, Visitas y Virtuales y creó `hospitalProfesionalesCore` con copy neutral. Debe integrarse, no revertirse.
5. `apps/api/src/main.ts` ya añade únicamente `PATCH` a CORS. Es correcto y no debe tocarse.
6. CSRF/origen mediante `API_WEB_ORIGINS` está correcto e intacto. No modificar.
7. RLS permanece `UNVERIFIED` para el MVP local. No investigar ni ejecutar ahora las pruebas enforce pendientes.

### Aclaración definitiva sobre fecha y reloj

Los usos `new Date(valor)`, `new Date(milisegundos)` o `new Date(Date.UTC(...))` ya presentes en `hospitalAgendaClient.ts` son transformaciones deterministas de entradas explícitas; **no leen la fecha actual** y no deben reescribirse.

La restricción es:

- prohibido `Date.now()` en Hospital;
- prohibido `new Date()` **sin argumentos**, excepto el único default de reloj controlado en `HospitalAgenda.tsx`;
- permitido en `hospitalAgendaClient.ts` construir fechas con argumentos únicamente para validar, desplazar o convertir fechas/horas explícitas.

`hospitalAlcance.test.ts` debe distinguir estas categorías; no debe tratar todo constructor `Date` como lectura del reloj.

## 3. Trabajo pendiente exacto

### 3.1 Profesionales

1. Conectar `HospitalProfessionals.tsx` a los clientes ya existentes.
2. Reconciliar `ProfessionalDetailPanel.tsx`, `ProfessionalEngagementPanel.tsx` y `hospitalProfessionalsListado.ts` con los tipos/copy nuevos de `hospitalProfessionalsConfig.ts` y los DTO existentes.
3. Eliminar del árbol runtime el uso de `hospitalProfesionalesDemo`, `config.fichas` y helpers de filtrado sobre el universo fixture.
4. Implementar:
   - listado/paginación/filtros server-side;
   - `fetchImpl?: typeof fetch` pasado al cliente, sin invocación directa desde la vista;
   - carga, vacío, sin resultados, 400, 401, 403, 503 y reintento;
   - `AbortController` y descarte de respuestas tardías;
   - detalle remoto, 404, cierre y retorno de foco;
   - limpieza del detalle al cambiar contexto/consulta o ante error;
   - campos no modelados neutrales y acciones fuera de alcance deshabilitadas.
5. Ajustar CSS solo para esos estados sin rediseñar.
6. Sustituir pruebas demo de Profesionales por pruebas del flujo conectado.

### 3.2 Agenda

1. Conectar `HospitalAgenda.tsx` a `hospitalAgendaClient.ts`.
2. Separar en `hospitalAgendaConfig.ts` el copy/estructura no factual de solicitudes, calendario, totales, profesionales y perspectivas demo; el runtime no puede usar `hospitalAgendaDemo` como fuente.
3. Implementar:
   - reloj inyectable, por ejemplo `now?: () => Date`, cuyo default ejecuta el único `new Date()` sin argumentos autorizado;
   - fecha inicial convertida inmediatamente a `YYYY-MM-DD` mediante el helper existente;
   - consulta de ventana real por escala;
   - `fetchImpl?: typeof fetch` pasado al cliente, sin llamada directa en la vista;
   - carga, vacío, 400, 401, 403, 404, 409, 503 y reintento;
   - `AbortController` y descarte de respuestas tardías;
   - selector con `professionalId`, fecha/hora controladas y validación;
   - bloqueo de doble submit;
   - PATCH de asignación y refresco de Agenda tras éxito;
   - conservación de entrada y anuncio accesible ante `409`/error;
   - Reprogramar/Rechazar y toda acción fuera de scope deshabilitadas.
4. Retirar del runtime los nombres, agosto de 2026, conteos, pagos, alertas, direcciones y perspectivas nominales demo.
5. Ajustar CSS solo para estados/formulario real sin rediseñar.
6. Sustituir pruebas demo de Agenda por pruebas del flujo conectado.

### 3.3 Gate de alcance

Actualizar `hospitalAlcance.test.ts` sin debilitar la igualdad exacta:

- llamadas efectivas a red exactamente en:
  - `hospitalInstitutionClient.ts`;
  - `hospitalPatientsClient.ts`;
  - `hospitalProfessionalsClient.ts`;
  - `hospitalAgendaClient.ts`;
- menciones/inyección de `fetch` exactamente en esos cuatro clientes más:
  - `HospitalShell.tsx`;
  - `HospitalPatients.tsx`;
  - `HospitalProfessionals.tsx`;
  - `HospitalAgenda.tsx`;
- `Date.now()` ausente de todo Hospital;
- `new Date()` sin argumentos exactamente una vez y solo en `HospitalAgenda.tsx`;
- constructores `Date` con argumento autorizados solo en `hospitalAgendaClient.ts` para helpers deterministas;
- Visitas, Virtuales, Finanzas, Reportes, Alertas, Administración y demás módulos continúan sin red;
- almacenamiento web, cookies leídas por JS, telemetría, secretos, transportes alternativos y dependencias externas continúan prohibidos.

## 4. Allowlist mínima de continuación

Claude puede modificar exactamente:

1. `apps/web/src/features/hospital/HospitalProfessionals.tsx`
2. `apps/web/src/features/hospital/ProfessionalDetailPanel.tsx`
3. `apps/web/src/features/hospital/ProfessionalEngagementPanel.tsx`
4. `apps/web/src/features/hospital/hospitalProfessionalsConfig.ts`
5. `apps/web/src/features/hospital/hospitalProfessionalsListado.ts`
6. `apps/web/src/features/hospital/hospitalProfessionals.module.css`
7. `apps/web/src/features/hospital/hospitalProfessionals.test.tsx`
8. `apps/web/src/features/hospital/HospitalAgenda.tsx`
9. `apps/web/src/features/hospital/hospitalAgendaConfig.ts`
10. `apps/web/src/features/hospital/hospitalAgenda.module.css`
11. `apps/web/src/features/hospital/hospitalAgenda.test.tsx`
12. `apps/web/src/features/hospital/hospitalTestUtils.ts`
13. `apps/web/src/features/hospital/hospitalAlcance.test.ts`

No modificar los dos clientes ni sus pruebas: están implementados y sus pruebas pasan. No modificar `apps/api/src/main.ts`: el cambio CORS ya está correcto.

Si un defecto verificable impide usar uno de los clientes existentes, Claude debe detenerse y reportar evidencia; no ampliar por sí mismo la allowlist.

## 5. Pruebas específicas pendientes

### Profesionales

- carga → listado persistido;
- paginación y filtros provocan queries server-side correctas;
- vacío inicial versus sin resultados;
- 400/401/403/503 y reintento sin datos stale/demo;
- aborto y respuesta tardía no reemplazan estado actual;
- detalle remoto, 404, cierre y retorno de foco;
- pacientes/citas/conteos proceden del DTO;
- campos no modelados muestran texto neutral;
- acciones deshabilitadas no invocan red.

### Agenda

- reloj inyectado produce fecha inicial y ventanas deterministas;
- Día/Semana/Mes consultan rangos válidos y <=31 días;
- carga/vacío/400/401/403/404/503 sin fallback;
- aborto y respuesta tardía se descartan;
- selector usa ID opaco;
- botón Asignar exige profesional/fecha/hora y evita doble submit;
- body PATCH contiene exactamente `professionalId`, `scheduledStart`, `expectedVersion`;
- éxito refresca Agenda;
- `409` conserva selección y anuncia conflicto;
- región viva, labels y teclado;
- Reprogramar/Rechazar no llaman red.

### Gate y regresión focal

Ejecutar únicamente, durante la corrección:

```text
hospitalProfessionals.test.tsx
hospitalAgenda.test.tsx
hospitalProfessionalsClient.test.ts
hospitalAgendaClient.test.ts
hospitalAlcance.test.ts
hospitalPatientsClient.test.ts
hospitalInstitutionClient.test.ts
hospitalShell.test.tsx
```

Además ejecutar `npm --workspace apps/web run typecheck`.

No ejecutar suites completas salvo que uno de estos resultados revele una regresión que no pueda localizarse de otro modo.

Para CORS basta comprobar y reportar que `apps/api/src/main.ts` conserva exactamente `['GET', 'POST', 'PATCH', 'OPTIONS']`; no editarlo ni crear infraestructura de prueba nueva.

RLS debe reportarse `UNVERIFIED`; no ejecutar investigación `enforce` en esta continuación.

## 6. Estado actual que Claude debe resolver

Antes de continuar, el typecheck Web falla porque `hospitalProfessionalsConfig.ts` ya adoptó los contratos nuevos pero `HospitalProfessionals.tsx`, ambos paneles, `hospitalProfessionalsListado.ts` y la prueba todavía importan contratos demo eliminados. Esto es consecuencia directa del corte de ejecución y se resuelve conectando esos consumidores al contrato nuevo; no restaurar los exports/fixtures antiguos.

Resultado focal actual registrado:

- clientes nuevos: **36 PASS**;
- `hospitalAlcance.test.ts`: **4 FAIL** por allowlists/regla antigua de fecha;
- Web typecheck: **FAIL** por 43 errores concentrados en cinco consumidores antiguos de Profesionales.

Claude debe usar estos resultados como punto de partida, no volver a implementar clientes, CORS, CSRF, backend ni RLS.

## 7. STOP CONDITIONS

Detenerse si:

- se requiere un archivo fuera de §4;
- se requiere cambiar cliente, API, DTO, modelo, migración, rol, CORS, CSRF o RLS;
- se requiere abrir Visitas, Virtuales u otro módulo;
- se requiere restaurar datos demo o inventar datos no modelados;
- se requiere más de un reloj actual o red fuera de los cuatro clientes;
- una prueba focal falla por una causa que exige ampliar alcance.

## 8. Handoff requerido

1. Archivos modificados, todos dentro de §4.
2. Qué se conectó en Profesionales y Agenda.
3. Confirmación de que clientes/CORS/CSRF/backend/RLS no se modificaron.
4. Resultados exactos de pruebas focales y typecheck.
5. Evidencia del gate: cuatro clientes, cuatro vistas de inyección, un único reloj actual.
6. Ausencia de fixtures/fallback en ambos árboles runtime.
7. RLS `UNVERIFIED` y gate preproductivo pendiente.

---

CORE-02 RECOVERY STATUS: PARTIAL — SAFE TO CONTINUE

REMAINING CLAUDE WORK: Integrar las vistas y paneles de Profesionales/Agenda con los clientes ya probados, reconciliar config/helpers/CSS/tests, añadir el único reloj inyectable y actualizar el gate de alcance; no repetir clientes, CORS, CSRF, backend ni RLS.

CLAUDE CONTINUATION PACKET: `tasks/TASK-HOSPITAL-CORE-02-CONTINUATION.md`
