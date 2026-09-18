# Tareas 013 - Visitas domiciliarias visibles en el shell Hospital

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

### Packet A — cliente tipado (`0e5d183`)

- [x] `hospitalVisitsClient.ts` con las TRES operaciones de MP04 y ninguna más
- [x] `POST /api/v1/visits/materialize` con cuerpo `{ appointmentId }` exacto
- [x] `GET /api/v1/professional/visits/:visitId` sin cuerpo ni parámetros
- [x] `PATCH /api/v1/professional/visits/:visitId/status` con `{ status, expectedVersion }` exacto
- [x] `encodeURIComponent` sobre el identificador en las dos rutas profesionales
- [x] `credentials: 'include'` y `cache: 'no-store'` en las tres operaciones
- [x] Desenlaces tipados: `ok`, `solicitud-invalida`, `sin-sesion`, `sin-permiso`, `no-encontrado`, `conflicto`, `no-disponible`, `cancelado`
- [x] 400/401/403/404/409 mapeados; 503, otros fallos, red y JSON ilegible colapsan en `no-disponible`
- [x] `cancelado` distinguido del fallo real por `esCancelacionDeVisita`
- [x] El cliente nunca lanza hacia el componente
- [x] Textos de producto centralizados, sin código HTTP, ruta ni capa técnica
- [x] `requiereRefrescoDeVisita` verdadero solo ante conflicto
- [x] Cero importación de `hospitalVisitsConfig.ts` y cero repliegue demostrativo
- [x] Ningún campo de autoridad —tenant, paciente, profesional, actor, rol, instante— en ningún cuerpo
- [x] `fetchImpl` por parámetro para probar sin red
- [x] 32 pruebas de contrato en `hospitalVisitsClient.test.ts`
- [x] `hospitalVisitsClient.ts` añadido a la lista cerrada de clientes autorizados

### Packet B — interfaz conectada (`31cd54c`)

- [x] `esCitaMaterializable`: acción visible solo para `modality === 'HOME'` y `status === 'ASSIGNED'`
- [x] Acción textual accesible «Preparar visita domiciliaria» con ayuda por `aria-describedby`
- [x] Sin controlador `onVisitaMaterializada` la acción no se dibuja
- [x] La Agenda entrega el DTO real al shell y no navega ni lo conserva
- [x] Materialización y asignación comparten la guarda de doble envío
- [x] `HospitalShell` transporta la visita en `useState` y navega a la vista `visitas`
- [x] `HospitalHomeVisits` deja de importar `hospitalVisitsConfig`
- [x] Estado vacío honesto cuando no hay visita abierta
- [x] Las cuatro etiquetas del contrato: `Programada`, `En curso`, `Completada`, `No completada`
- [x] El estado se lee como texto; el color solo lo acompaña
- [x] Acciones por estado: `SCHEDULED` → Iniciar / No completada; `IN_PROGRESS` → Completar / No completada; terminales → ninguna
- [x] `SCHEDULED` nunca es destino de una acción
- [x] Acciones solo con `ok` confirmado por el servidor (`hayAccionesProfesionales`)
- [x] `sin-sesion` conserva `Programada`, explica qué falta y retira las acciones
- [x] `sin-permiso` y `no-encontrado` tampoco muestran acciones
- [x] Relectura de la visita tras cada transición, también ante conflicto
- [x] El estado visible nunca se compone con la respuesta del `PATCH`
- [x] `expectedVersion` tomada de la última lectura autorizada
- [x] Bloqueo de doble envío durante cada mutación
- [x] `AbortController` por consulta; respuesta tardía descartada por `vigente`
- [x] `montadoRef` evita escribir sobre una vista desmontada
- [x] Región `role="status" aria-live="polite"` para el desenlace
- [x] Botones con texto visible, `type="button"` y ayuda accesible
- [x] Cero identificadores, versiones, marcas de tiempo y códigos técnicos en el marcado
- [x] Cero paciente, profesional, dirección, zona y horario en el marcado
- [x] Nota que separa avance operativo de dato clínico
- [x] `HospitalHomeVisits.tsx` añadido a la lista cerrada de puntos de inyección
- [x] 44 pruebas T-10 en `hospitalOperaciones.test.tsx`, 11 T-A8/T-A9 en `hospitalAgenda.test.tsx`, 7 T-H16 en `hospitalShell.test.tsx`

## Límites conocidos (no autorizados como trabajo)

- [ ] Recuperar una visita ya materializada tras recargar la página: no hay listado y repetir la preparación responde `409`
- [ ] Mensaje propio para «esta cita ya materializó su visita», hoy indistinguible de un conflicto de versión
- [ ] Control explícito de reintento cuando la consulta profesional falla con `no-disponible`
- [ ] Más de una visita abierta a la vez: materializar otra reemplaza la anterior
- [ ] Persistencia o ruta de la visita abierta: hoy es estado efímero del montaje
- [ ] Propagación del `fetchImpl` del shell a `HospitalAgenda` y `HospitalHomeVisits`
- [ ] `AbortSignal` en `materializarVisita` y `cambiarEstadoVisita`
- [ ] Retirada de `hospitalVisitasDemo` del Inicio (`hospitalDashboardOperacion.ts:193`), que sigue publicando pacientes, zonas y profesionales ficticios
- [ ] Retirada de `hospitalVisitsConfig.ts`, que aún declara estados que el servidor no modela
- [ ] Limpieza de `hospitalVisits.module.css`: `.fecha`, `.textos`, `.paciente`, `.zona` y `.profesional` quedaron sin uso
- [ ] Corrección de la cabecera de `hospitalVisitsClient.ts:6-11`, que afirma que el servidor no ofrece listado cuando la spec 017 ya lo expone
- [ ] Consumo desde Hospital del worklist `GET /api/v1/professional/visits`
- [ ] Fecha, paciente, profesional, dirección, zona, horario, filtros y conteos en la vista: MP04 no los devuelve
- [ ] Cancelación, archivo, reapertura, notas, evidencia, geolocalización, rutas o check-in

## Verificación pendiente

- [ ] Instalar dependencias y ejecutar `npx vitest run --config apps/web/vitest.config.mts apps/web/src/features/hospital/hospitalVisitsClient.test.ts`
- [ ] Ejecutar `npx vitest run --root apps/web src/features/hospital/hospitalAgenda.test.tsx src/features/hospital/hospitalOperaciones.test.tsx src/features/hospital/hospitalShell.test.tsx src/features/hospital/hospitalAlcance.test.ts`
- [ ] Levantar PostgreSQL y la API y comprobar el flujo real: materializar, consultar y transicionar contra `visits.controller.ts`
- [ ] Contrastar los DTO declarados en `hospitalVisitsClient.ts:78-114` con respuestas reales de la API, no solo con el código del controlador
- [ ] Comprobar en navegador foco, orden de tabulación, contraste de la insignia de estado y anuncio efectivo de la región `aria-live`
- [ ] Comprobar el comportamiento con sesión profesional real emitida por Keycloak/OIDC
- [ ] Comprobar los guards de mismo origen en un despliegue configurado
