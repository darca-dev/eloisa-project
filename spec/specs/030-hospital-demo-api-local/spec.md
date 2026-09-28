# Especificación 030 — API demo local aislada para Hospital

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: `2026-09-21`
- Aprobado por / Approved by: `Product Owner`
- Evidencia de aprobación / Approval evidence: la Product Owner autorizó una
  «API demo local aislada para Hospital» para mostrar datos ficticios en las
  tablas, sin conexiones institucionales externas.

## Objetivo y valor

Hacer demostrable `/hospital` con datos totalmente ficticios y coherentes en
las vistas que actualmente esperan operaciones institucionales, sin consultar,
crear, actualizar ni exponer registros, sesiones o permisos reales.

La demostración debe dejar claro que los datos son locales y ficticios; no debe
presentarse como una integración hospitalaria ni como información clínica,
financiera, institucional u oficial.

## Escenarios de aceptación

1. Dado `/hospital` en modo demo, cuando se abre Agenda, Pacientes o
   Profesionales, entonces se muestran DTOs exclusivamente ficticios sin red.

## Criterios de aceptación (formato EARS recomendado) / Acceptance criteria (EARS format recommended)

- CUANDO se abra `/hospital` en modo demo, EL SISTEMA DEBERÁ mostrar datos
  ficticios en Agenda, Pacientes y Profesionales sin petición de red.
- CUANDO se vea un registro demo, EL SISTEMA DEBERÁ comunicar en texto que
  corresponde a datos ficticios locales.
- SI una persona intenta una acción persistente, ENTONCES EL SISTEMA DEBERÁ
  impedirla y explicar que el modo demo no guarda cambios.
- FUERA del punto demo, EL SISTEMA DEBERÁ conservar clientes institucionales y
  controles actuales.

## Requisitos

- La «API demo» será una capa local de proveedor/cliente en el frontend, no un
  endpoint HTTP y no un bypass de guards. Se inyectará únicamente desde el
  punto de entrada demostrativo para entregar DTOs compatibles con las vistas.
- Todos los nombres, iniciales, identificadores, fechas, conteos y estados son
  ficticios. La procedencia visible y técnica será `DEMO_LOCAL_FICTICIA`.
- No se añaden dependencias ni se almacenan datos en navegador, archivos, base
  de datos, logs, cookies o servicios de terceros.

## Propiedades de la spec (opcional, puente a specs ejecutables) / Spec properties (optional)

<!-- Propiedades universales que un test property-based podría verificar (estilo Kiro). / Universal properties a property-based test could verify. -->
<!-- Ejemplo / Example: "Para toda entrada de usuario, EL SISTEMA DEBERÁ responder en <2s" -->

## Ámbito de archivos / File scope

<!-- Opcional. Rutas que gobierna esta spec, una por línea, entre comillas invertidas. / Optional. Paths this spec governs, one per line, in backticks. -->
<!-- Ejemplo / Example: - `src/payments/` — flujo de cobro / charge flow -->

## Criterios de éxito

- Los tres módulos renderizan sus tablas con datos demo, sin red ni mutaciones.
- TypeScript, pruebas focalizadas y la compilación web finalizan correctamente.

## Alcance y límites obligatorios

### Incluido

1. Proveedor local para la ruta demostrativa `/hospital`.
2. DTOs ficticios deterministas para Agenda, Pacientes y Profesionales.
3. Marca visual y accesible «Datos ficticios de demostración local».
4. Pruebas de procedencia demo, aislamiento y ausencia de petición de red.

### Prohibido

- `apps/api/`, PostgreSQL, Prisma, migraciones, seeds, Docker, CORS y cualquier
  endpoint de la API institucional real.
- Autenticación, cookies, OIDC, roles, permisos, RLS, auditoría de negocio y
  credenciales.
- Crear, editar, asignar, borrar, materializar visitas o persistir cambios.
- Datos reales o semejantes a registros reales; diagnósticos, pagos, resultados
  clínicos, fuentes oficiales, integraciones o entidades externas.
- Cambios a `prototype-claude/`, `main`, `develop` o capacidades protegidas.

## Archivos permitidos

- `apps/web/src/app/hospital/`
- `apps/web/src/features/hospital/HospitalShell.tsx`
- `apps/web/src/features/hospital/HospitalAgenda.tsx`
- `apps/web/src/features/hospital/HospitalPatients.tsx`
- `apps/web/src/features/hospital/HospitalProfessionals.tsx`
- `apps/web/src/features/hospital/hospitalDemoLocal.*`
- pruebas focalizadas de los archivos anteriores
- `spec/specs/030-hospital-demo-api-local/**`, `spec/specs/INDEX.md` y
  `spec/.sdd/user-consent.log`

Todo archivo no listado queda prohibido. Una ampliación requiere actualizar y
aprobar esta especificación antes de modificarlo.

## Riesgos y reversión

El riesgo principal es confundir una pantalla demo con una institucional real.
Se reduce mediante inyección exclusiva desde `/hospital`, procedencia visible,
sin red y sin mutaciones. La reversión consiste en retirar el proveedor local y
sus inyecciones; no hay migraciones, datos persistentes ni contratos externos.
