# TASK-HOSPITAL-CORE-02 — Minimal close packet

## 1. Objetivo único

Cerrar el checkpoint de `TASK-HOSPITAL-CORE-02` actualizando el gate estático de alcance para que represente exactamente las conexiones, inyecciones y uso controlado de fecha ya implementados y aprobados.

No corregir ni refactorizar las vistas: la integración actual de Profesionales y Agenda compila y sus pruebas focales pasan.

## 2. Estado que debe preservarse

Está implementado y no debe repetirse:

- Profesionales conectado a listado/detalle persistidos, filtros y paginación server-side, cancelación/descarte de respuestas tardías, panel y foco.
- Agenda conectada a GET/PATCH persistidos, ventana por escala, asignación, bloqueo de doble envío, manejo de conflicto, refresco y reloj inyectable.
- Clientes de Profesionales y Agenda y sus pruebas.
- Eliminación del uso runtime de fixtures en ambas vistas.
- Copy neutral y estados no modelados.
- `PATCH` en CORS.
- CSRF/origen con `API_WEB_ORIGINS`.
- RLS declarado `UNVERIFIED` para MVP local.

Evidencia del checkpoint:

- Web typecheck: PASS.
- Profesionales + Agenda + clientes: 135 pruebas PASS en la corrida focal del checkpoint.
- Regresión focal de Pacientes, sesión y shell: 64 pruebas PASS.
- Únicos fallos observados: 5 aserciones de `hospitalAlcance.test.ts` que todavía describen CORE-01.

## 3. Allowlist cerrada

Claude puede modificar exactamente un archivo:

- `apps/web/src/features/hospital/hospitalAlcance.test.ts`

No modificar ningún otro archivo. Lectura y ejecución de las pruebas focales indicadas en §5 están permitidas.

## 4. Cambio exacto requerido

Actualizar textos, constantes y aserciones de `hospitalAlcance.test.ts` manteniendo allowlists cerradas e igualdad exacta.

### 4.1 Clientes con llamada efectiva a red

El conjunto exacto debe ser:

1. `hospitalAgendaClient.ts`
2. `hospitalInstitutionClient.ts`
3. `hospitalPatientsClient.ts`
4. `hospitalProfessionalsClient.ts`

Ordenar como lo haga el helper estable de la prueba. Ningún otro archivo puede invocar `fetch`.

### 4.2 Archivos autorizados a mencionar/injectar `fetch`

El conjunto exacto debe contener los cuatro clientes anteriores más:

- `HospitalAgenda.tsx`
- `HospitalPatients.tsx`
- `HospitalProfessionals.tsx`
- `HospitalShell.tsx`

Las vistas solo pueden mencionar/injectar `fetch`; las llamadas efectivas siguen confinadas a los clientes.

### 4.3 Fecha y reloj

Reemplazar la regla antigua que prohíbe cualquier `new Date` por tres comprobaciones precisas:

1. `Date.now()` está ausente de todas las fuentes Hospital.
2. `new Date()` sin argumentos aparece exactamente una vez y solo en `HospitalAgenda.tsx`, como default del reloj inyectable.
3. Constructores `new Date(...)` con argumentos aparecen únicamente en `hospitalAgendaClient.ts`, para validaciones y transformaciones deterministas de valores explícitos.

No autorizar timers, polling, otro reloj actual ni otro archivo con constructores `Date`.

La prueba debe distinguir `new Date()` sin argumentos de `new Date(valor)`; no usar un patrón que vuelva a confundir ambos.

### 4.4 Módulos que siguen sin conexión

Profesionales y Agenda ya no pertenecen al conjunto “demostrativo y sin conexión”. Excluirlos de esa aserción.

Mantener comprobación explícita de ausencia de red para los demás módulos fuera de CORE-02, incluidos como mínimo:

- Visitas domiciliarias;
- Consultas virtuales;
- Finanzas;
- Reportes;
- Alertas;
- Administración.

No alterar esos módulos.

### 4.5 Prohibiciones que permanecen

Mantener sin relajación:

- XMLHttpRequest, WebSocket, EventSource, axios y sendBeacon;
- localStorage, sessionStorage, IndexedDB y `document.cookie`;
- telemetría;
- secretos/entorno en el módulo;
- dependencias externas no autorizadas;
- igualdad exacta de allowlists.

## 5. Verificación mínima

Primero ejecutar:

```text
hospitalAlcance.test.ts
```

Después, únicamente como confirmación focal:

```text
hospitalProfessionals.test.tsx
hospitalAgenda.test.tsx
hospitalProfessionalsClient.test.ts
hospitalAgendaClient.test.ts
hospitalPatientsClient.test.ts
hospitalInstitutionClient.test.ts
hospitalShell.test.tsx
```

Finalmente ejecutar:

```text
npm --workspace apps/web run typecheck
```

No ejecutar suites completas ni benchmarking.

## 6. Criterios de cierre

1. Solo `hospitalAlcance.test.ts` fue modificado por esta corrida.
2. El gate afirma exactamente cuatro clientes y cuatro vistas/puntos de inyección.
3. Existe un único reloj actual controlado en Agenda.
4. Las construcciones deterministas de fecha quedan limitadas al cliente Agenda.
5. Otros módulos siguen sin red.
6. Gate, pruebas focales y typecheck pasan.
7. CORS, CSRF, RLS, API, clientes, vistas y configs no fueron modificados.
8. RLS se reporta `UNVERIFIED`; no impide el cierre del MVP local ni autoriza preproducción/datos reales/deploy.

## 7. STOP CONDITIONS

Detenerse si:

- se necesita modificar cualquier archivo distinto del allowlist;
- el gate actualizado revela una llamada de red o reloj no autorizados;
- falla una prueba funcional o typecheck por una causa distinta del gate obsoleto;
- se requiere cambiar CORS, CSRF, RLS, clientes, vistas, API o módulos externos.

## 8. Handoff requerido

- diff exacto del único archivo;
- resultados del gate, pruebas focales y typecheck;
- confirmación de cuatro clientes, cuatro vistas de inyección y único reloj;
- confirmación de cero cambios adicionales;
- RLS `UNVERIFIED` y gate preproductivo pendiente.

---

CORE-02 CURRENT STATUS: FUNCTIONALLY IMPLEMENTED — ONE OBSOLETE SCOPE GATE REMAINS

REMAINING WORK: Update only `hospitalAlcance.test.ts` and rerun the focused gate/regressions plus Web typecheck.

CAN CLOSE TONIGHT WITH SMALL CLAUDE RUN: YES

CLAUDE MINIMAL PACKET: `tasks/TASK-HOSPITAL-CORE-02-MINIMAL-CLOSE.md`
