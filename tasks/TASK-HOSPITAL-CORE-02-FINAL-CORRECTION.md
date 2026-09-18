# TASK-HOSPITAL-CORE-02 — Final correction packet

## 1. Decisión

Se autoriza a Claude Code a completar únicamente la conexión frontend de **Hospital → Profesionales** y **Hospital → Agenda**, junto con las dos correcciones técnicas indispensables de alcance y CORS.

Este paquete sustituye, para esta corrección, cualquier allowlist parcial o ambigua de los paquetes anteriores. Es una allowlist cerrada: leer y ejecutar pruebas existentes está permitido, pero solo pueden modificarse o crearse los archivos enumerados en §3.

No autoriza cambios de modelo, migraciones, API funcional, seguridad, roles, otros módulos, commit, push, deploy ni datos reales.

## 2. Resultado autorizado por archivo

### 2.1 Profesionales

- `ProfessionalDetailPanel.tsx`: recibir y representar el detalle persistido ya entregado por la API; conservar panel, foco y estructura aprobados. Campos no soportados quedan neutrales y no factuales.
- `ProfessionalEngagementPanel.tsx`: representar exclusivamente afiliación persistida disponible. Documentos, economía, contrato y validaciones no modeladas permanecen como `No disponible en este módulo`; nunca usar fixtures como dato.
- `hospitalProfessionalsConfig.ts`: separar copy/estructura visual de los datos demostrativos; retirar del runtime de Profesionales las fichas y derivaciones factuales de Pacientes, Visitas y Virtuales. No borrar fixtures requeridos por otros módulos.
- `hospitalProfessionalsListado.ts`: adaptar helpers puros al view model de API o retirar únicamente lógica local sustituida por consulta server-side. No volver a filtrar como universo completo una página parcial.
- `hospitalProfessionals.module.css`: ajustes mínimos de estados carga/vacío/error/paginación y contenido real, sin rediseño ni tokens nuevos.

### 2.2 Agenda

- `hospitalAgendaConfig.ts`: conservar copy, labels, tonos y estructura no factual; retirar del runtime solicitudes, nombres, conteos, agosto de 2026, pagos, alertas, direcciones, profesionales y perspectivas demostrativas.
- `hospitalAgenda.module.css`: ajustes mínimos para estados reales, formulario controlado y mensajes accesibles, sin rediseño.

### 2.3 Soporte y gates

- `hospitalTestUtils.ts`: añadir únicamente dobles/helpers compartidos necesarios para probar Profesionales y Agenda sin red real. No crear fixture productivo ni datos globales.
- `hospitalAlcance.test.ts`: actualizar allowlists exactas de clientes, vistas con inyección y única excepción de reloj, manteniendo las prohibiciones globales.
- `apps/api/src/main.ts`: añadir únicamente `PATCH` a `methods` de CORS.

## 3. Allowlist definitiva

Claude puede modificar exactamente:

1. `apps/web/src/features/hospital/HospitalProfessionals.tsx`
2. `apps/web/src/features/hospital/ProfessionalDetailPanel.tsx`
3. `apps/web/src/features/hospital/ProfessionalEngagementPanel.tsx`
4. `apps/web/src/features/hospital/hospitalProfessionalsConfig.ts`
5. `apps/web/src/features/hospital/hospitalProfessionalsListado.ts`
6. `apps/web/src/features/hospital/hospitalProfessionals.module.css`
7. `apps/web/src/features/hospital/hospitalProfessionals.test.tsx`
8. `apps/web/src/features/hospital/hospitalProfessionalsClient.ts`
9. `apps/web/src/features/hospital/hospitalProfessionalsClient.test.ts`
10. `apps/web/src/features/hospital/HospitalAgenda.tsx`
11. `apps/web/src/features/hospital/hospitalAgendaConfig.ts`
12. `apps/web/src/features/hospital/hospitalAgenda.module.css`
13. `apps/web/src/features/hospital/hospitalAgenda.test.tsx`
14. `apps/web/src/features/hospital/hospitalAgendaClient.ts`
15. `apps/web/src/features/hospital/hospitalAgendaClient.test.ts`
16. `apps/web/src/features/hospital/hospitalTestUtils.ts`
17. `apps/web/src/features/hospital/hospitalAlcance.test.ts`
18. `apps/api/src/main.ts`

Los diez archivos objeto de la decisión final están autorizados. Los otros ocho de la lista son los clientes, vistas y pruebas directamente necesarios y ya previstos por la Task original.

Ningún otro archivo puede modificarse o crearse. Si falta cualquiera de estos archivos nuevos porque Claude se detuvo antes de crearlo, puede crearlo en la ruta exacta indicada. Si completar el trabajo requiere otro archivo: **STOP**.

## 4. Reglas cerradas de conexión

### 4.1 Red e inyección

Las únicas llamadas efectivas a `fetch` permitidas en Hospital son:

- `hospitalInstitutionClient.ts` — existente, sin modificar;
- `hospitalPatientsClient.ts` — existente, sin modificar;
- `hospitalProfessionalsClient.ts`;
- `hospitalAgendaClient.ts`.

Las únicas vistas/componentes autorizados a mencionar `fetch` para inyectarlo, sin invocarlo directamente, son:

- `HospitalShell.tsx` — existente, sin modificar;
- `HospitalPatients.tsx` — existente, sin modificar;
- `HospitalProfessionals.tsx`;
- `HospitalAgenda.tsx`.

`HospitalProfessionals` y `HospitalAgenda` pueden aceptar `fetchImpl?: typeof fetch` exclusivamente para pasarlo a su cliente. Los clientes usan `credentials: "include"`, `AbortSignal`, contratos existentes y ninguna cabecera/tenant/rol aportado por UI.

No se autoriza `XMLHttpRequest`, WebSocket, EventSource, axios, persistencia web, service worker, telemetría ni fallback a fixtures.

### 4.2 Único reloj autorizado

Solo `HospitalAgenda.tsx` puede obtener la fecha actual y únicamente para inicializar la ventana calendario.

- Debe aceptar reloj inyectable para pruebas, por ejemplo `now?: () => Date`.
- El default de producción puede ejecutar exactamente un `new Date()`.
- Debe convertir de inmediato a una fecha calendario `YYYY-MM-DD`.
- No puede usar `Date.now`, timers, polling temporal, fechas demo ni relecturas del reloj para reglas de dominio.
- La prueba de alcance debe conservar la prohibición global y comprobar que la excepción se limita al archivo y uso anteriores.

### 4.3 CORS y CSRF

En `apps/api/src/main.ts` el único cambio autorizado es:

```ts
methods: ['GET', 'POST', 'PATCH', 'OPTIONS']
```

No cambiar `origin`, `credentials`, `allowedHeaders`, `maxAge` ni añadir otros métodos.

Se mantiene sin modificación el mecanismo CSRF/origen implementado: `ApiEnvironment.webOrigins`, derivado de `API_WEB_ORIGINS`, es la allowlist compartida; comparación exacta por esquema/host/puerto, `Origin` preferido, `Referer` solo como fallback, y rechazo si ambos faltan o el origen es inválido/no autorizado/`null`.

No crear otro env var, token, cookie o mecanismo CSRF.

## 5. Comportamiento frontend exigido

### 5.1 Profesionales

- Renderizar listado paginado y filtros mediante API real.
- Abrir el panel con detalle persistido y descartar respuestas tardías.
- Derivar pacientes/citas/conteos únicamente de la respuesta API.
- Mostrar carga, vacío, sin resultados, error recuperable, 401, 403 y 503 sin mezclar datos previos ni demo.
- Mantener estructura, responsive, teclado, foco del panel y retorno al disparador.
- Calificación, disponibilidad inferida, documentos y economía no soportados no pueden mostrar cifras o afirmaciones demo.
- Acciones fuera de CORE-02 permanecen deshabilitadas y no llaman red.

### 5.2 Agenda

- Consultar la ventana real derivada de la fecha/escala activa.
- Renderizar solicitudes, profesionales, citas y conteos solo desde API.
- Selector usa `professionalId`, no nombre como identificador.
- `Asignar` requiere profesional, fecha y hora válidos; bloquea doble submit, conserva entrada ante error y refresca datos al éxito.
- Tratar 400/401/403/404/409/503 con mensajes accesibles y sin fallback demo.
- `Reprogramar` y `Rechazar` siguen deshabilitados; ningún otro endpoint o módulo se abre.
- No mostrar pagos, alertas, direcciones, solicitantes, WhatsApp ni perspectivas nominales provenientes de fixtures.

## 6. Pruebas específicas obligatorias

### 6.1 Gate de alcance

`hospitalAlcance.test.ts` debe demostrar:

1. las llamadas a red existen exactamente en los cuatro clientes autorizados;
2. ninguna otra fuente Hospital invoca red;
3. las referencias/inyecciones de `fetch` existen exactamente en clientes y cuatro vistas autorizadas;
4. no aparecen transportes alternativos, almacenamiento, telemetría, secretos ni dependencias externas;
5. `new Date()` aparece únicamente en `HospitalAgenda.tsx`, en el punto de reloj autorizado;
6. `Date.now` permanece ausente en todo Hospital;
7. Visitas, Virtuales, Finanzas, Reportes, Alertas y demás módulos siguen sin conexión.

La prueba debe usar igualdad exacta de conjuntos; no reemplazarla por `contains` ni allowlists abiertas.

### 6.2 Clientes

Para cada cliente nuevo:

- URL y query allowlist correctas;
- `credentials: "include"` y propagación de `AbortSignal`;
- no envía `tenantId`, rol ni actor;
- parsing de éxito y errores 400/401/403/404/409/503;
- error de red y respuesta inválida;
- Agenda PATCH usa JSON exacto y no repite mutación por doble submit.

### 6.3 Vistas

- reloj inyectado produce fecha/ventana determinista;
- cambio de filtro/página/escala cancela solicitud anterior y descarta respuesta tardía;
- estados carga, vacío, sin resultados, error y reintento;
- datos sensibles/factuales demo ausentes;
- asignación exitosa refresca Agenda y estado relacionado; 409 conserva formulario;
- foco, labels, región viva, teclado y responsive conservados;
- botones fuera de alcance no invocan clientes.

### 6.4 CORS/CSRF y regresión

- comprobación estática o prueba existente confirma que CORS contiene `PATCH` y no `PUT`/`DELETE`;
- ejecutar las pruebas existentes de origen/CSRF sin modificar el mecanismo;
- ejecutar suites Hospital afectadas, build/typecheck/lint de Web y API según scripts existentes;
- ejecutar regresión de Hospital Pacientes y sesión institucional.

## 7. Decisión RLS para este cierre

No investigar ni intentar corregir RLS en este paquete.

La ausencia de PostgreSQL normal con `MERDN_RUNTIME_ROLE=enforce` no bloquea este MVP local controlado. Claude debe mantener las pruebas pendientes y reportarlas como `UNVERIFIED`, nunca `PASS` o `VALIDATED`.

RLS enforce continúa siendo gate obligatorio antes de preproducción, datos reales o deploy. Este paquete no autoriza ninguna de esas etapas.

## 8. STOP CONDITIONS

Claude debe detenerse sin editar fuera del alcance si:

- necesita cualquier archivo no incluido en §3;
- necesita cambiar API, DTO, servicio, modelo, migración, permisos o seguridad;
- necesita modificar el mecanismo CSRF/origen;
- necesita abrir Visitas, Virtuales u otro módulo;
- necesita más de los cuatro clientes/puntos de inyección autorizados;
- necesita más de un reloj acotado en Agenda;
- necesita ampliar CORS más allá de `PATCH`;
- necesita inventar datos, usar fixtures como fallback o cambiar el diseño aprobado;
- una prueba falla por una causa que exige ampliar esta allowlist.

## 9. Handoff requerido

Claude debe entregar:

1. lista exacta de archivos modificados/creados, todos dentro de §3;
2. diff resumido por Profesionales, Agenda, alcance y CORS;
3. pruebas/comandos y resultados separados en PASS, FAIL, SKIPPED y UNVERIFIED;
4. evidencia del conjunto exacto de clientes/inyecciones y del único reloj;
5. confirmación de ausencia de fallback demo y de cambios a otros módulos;
6. RLS explícitamente `UNVERIFIED` con gate preproductivo pendiente;
7. riesgos o desviaciones; ninguna desviación silenciosa.

---

HOSPITAL-CORE-02 FINAL CORRECTION: READY

CLAUDE ACTION REQUIRED: YES

CLAUDE PACKET: `tasks/TASK-HOSPITAL-CORE-02-FINAL-CORRECTION.md`
