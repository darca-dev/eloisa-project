# VISITADOR-CORE-01 · MP02 — Visible Worklist + Agenda

## Estado

- READY FOR CLAUDE
- Tiempo máximo: 15 minutos.
- Packet exclusivamente Web, de lectura y navegación.

## Objetivo

Crear la superficie funcional mínima `/visitador` para que una persona
Professional use el OIDC/HumanSession existente, consulte su worklist HOME real,
seleccione una cita y vea el detalle operativo real de la HomeVisit cuando ya
está materializada.

MP02 no ejecuta transiciones. START, COMPLETE y NOT_COMPLETED quedan para MP03.

## Contratos existentes que se reutilizan sin cambios

### Human Auth

Reutilizar directamente el cliente aprobado existente:

- `urlDeLoginHumano()` para navegar a
  `GET /api/v1/human-auth/login?returnTo=/`;
- `consultarSesionHumana()` para confirmar una sesión con contexto
  `PROFESSIONAL`;
- `cerrarSesionHumana()` para logout real;
- cookie HttpOnly administrada por el navegador, `credentials: include` y
  `cache: no-store`.

No copiar el cliente, no crear login, token, storage, cookie JS, cabecera de
identidad ni bypass. Importarlo desde su ubicación actual sin modificar ningún
archivo Hospital.

El contrato humano actual no devuelve nombre, especialidad ni identificadores
de la persona. Por tanto la interfaz puede mostrar `Sesión profesional activa`,
pero no puede inventar nombre, profesión, institución, avatar ni iniciales de la
Professional. La identidad real consiste en el contexto `PROFESSIONAL`
confirmado por el servidor y la resolución de `HumanPrincipal` que autoriza la
worklist.

### Visits

Consumir exclusivamente:

- `GET /api/v1/professional/visits?from=YYYY-MM-DD&to=YYYY-MM-DD`;
- `GET /api/v1/professional/visits/:visitId` solo cuando la fila contiene una
  HomeVisit materializada.

La worklist ya deriva server-side ProfessionalProfile, Affiliation y
CareAssignment desde la sesión. El navegador no envía tenantId,
professionalId, patientId, careAssignmentId, actor ni rol.

## Superficie visible mínima

Crear `/visitador` reutilizando como referencia de composición —no como fuente
de datos— `prototype-claude/Eligeme-Profesional.dc.html`:

1. Sin sesión profesional: encabezado simple de Visitador, explicación breve y
   enlace `Iniciar sesión profesional` al OIDC existente.
2. Sesión confirmada: mostrar `Sesión profesional activa`, acción `Cerrar
   sesión` y agenda real.
3. Agenda: ventana inicial del día UTC actual y controles accesibles para mover
   o elegir una ventana válida de hasta 31 días. No inventar zona institucional.
4. Cada fila/tarjeta muestra únicamente fecha/hora real, nombre e iniciales del
   Patient devueltos por el servidor, modalidad `Visita domiciliaria`, estado de
   cita `Asignada` y estado real de HomeVisit.
5. Estados de HomeVisit en lenguaje de producto:
   - `SCHEDULED` → `Programada`;
   - `IN_PROGRESS` → `En curso`;
   - `COMPLETED` → `Completada`;
   - `NOT_COMPLETED` → `No completada`.
6. Una cita con `visit=null` se muestra como `Pendiente de preparación por la
   institución`; no puede materializarse desde Visitador.
7. Una fila con visita permite `Abrir visita`. Al seleccionarla, consultar el
   detalle profesional real y mostrar estado y tiempos disponibles. Permitir
   `Volver a la agenda`.
8. No mostrar identificadores opacos, `version`, rutas, códigos HTTP, códigos
   internos ni lenguaje técnico.
9. Estados vacíos, carga, reintento, sesión ausente, permiso insuficiente,
   recurso no disponible, conflicto de lectura y servicio no disponible deben
   usar copy de producto y fallar cerrados, sin datos alternativos.
10. Responsive y accesible con estructura visual reconocible del prototipo,
    usando branding/estilos actuales; no recuperar rating, alertas, zonas,
    turnos, notas, direcciones, contactos, diagnósticos, métricas ni novedades
    ficticias.

## Cliente worklist

Crear un cliente tipado dedicado que:

- construya la query solo desde `from` y `to` validados;
- use `credentials: 'include'` y `cache: 'no-store'`;
- nunca acepte ni envíe IDs de autoridad;
- traduzca 400/401/403/404/409/503, red, cuerpo ilegible y abort a desenlaces
  seguros de UI;
- no lance ni repliegue a fixtures;
- pueda reutilizar el cliente Visits existente únicamente para GET detalle, sin
  modificarlo y sin importar componentes Hospital.

Los `appointmentId`/`homeVisitId` pueden vivir como valores opacos internos para
selección y navegación, pero nunca renderizarse como texto.

## Allowlist exacta

- `apps/web/src/app/visitador/page.tsx`
- `apps/web/src/features/visitador/VisitadorExperience.tsx`
- `apps/web/src/features/visitador/visitador.module.css`
- `apps/web/src/features/visitador/visitadorWorklistClient.ts`
- `apps/web/src/features/visitador/visitadorWorklistClient.test.ts`
- `apps/web/src/features/visitador/visitadorExperience.test.tsx`

Ningún otro archivo puede cambiar. En particular, no modificar Hospital ni los
clientes existentes que se reutilizan por importación.

## Pruebas focales

Desde la raíz:

```text
npx vitest run --root apps/web src/features/visitador/visitadorWorklistClient.test.ts src/features/visitador/visitadorExperience.test.tsx
npm run typecheck --workspace @merdn/web
npx eslint apps/web/src/app/visitador/page.tsx apps/web/src/features/visitador/VisitadorExperience.tsx apps/web/src/features/visitador/visitadorWorklistClient.ts apps/web/src/features/visitador/visitadorWorklistClient.test.ts apps/web/src/features/visitador/visitadorExperience.test.tsx
git diff --check
git status --short
```

Cubrir únicamente:

- enlace OIDC existente y cero `fetch` para iniciar login;
- detección con/sin contexto PROFESSIONAL y fail-closed;
- GET worklist con solo `from`/`to`, cookie implícita y no-store;
- ausencia de IDs de autoridad en request y de IDs/version/códigos técnicos en
  contenido visible;
- filas reales, `visit=null`, los cuatro estados y orden recibido;
- selección, GET detalle, volver y reintento;
- logout real retira la agenda y no deja datos profesionales visibles;
- respuestas vacía, 400/401/403/404/409/503, red, abort y cuerpo inválido;
- cero demo fallback y cero acciones de transición.

No ejecutar suite completa, tests Hospital ni browser visual en este packet.

## Fuera de alcance

- START, COMPLETE, NOT_COMPLETED o cualquier mutación;
- materialización de HomeVisit;
- backend, schema, migrations, fixtures o datos locales;
- Hospital, Admin Support, Reports, Municipality, Patient o Caregiver;
- nueva arquitectura, login, reglas clínicas, historia, evidencia o
  notificaciones;
- rediseño global o restauración de contenido demostrativo del prototipo.

## Stop conditions

Detenerse si hace falta:

1. modificar backend o cualquier archivo fuera de allowlist;
2. fabricar identidad, paciente, cita, visita o dato visible;
3. enviar tenant/professional/patient/careAssignment desde el cliente;
4. leer o escribir la cookie desde JavaScript;
5. habilitar una mutación o materialización;
6. ampliar el packet para mostrar nombre/especialidad de la Professional que el
   contrato vigente no expone.

## Evidencia requerida

- exactamente seis archivos de allowlist;
- pruebas focales PASS, typecheck y eslint scope PASS;
- OIDC/HumanSession existentes reutilizados por importación;
- worklist y detalle reales conectados;
- cero cambios Hospital/backend y cero fallback demo;
- cero IDs/códigos técnicos visibles y cero acciones profesionales todavía.

SAFE FOR CLAUDE: YES
ESTIMATED CLAUDE TIME: 15 minutes
