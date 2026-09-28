# Especificación 035 — Acceso central y aprobación institucional

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: `2026-09-23`.
- Aprobado por / Approved by: Product Owner.
- Evidencia de aprobación / Approval evidence: el 2026-09-23 la Product Owner
  definió que Hospital y Alcaldía dan acceso solo a empleados registrados por
  cada institución; Pacientes, Cuidadores y Personal de terreno solicitan
  registro y el Hospital verifica/aprueba su identidad antes de permitir el
  acceso. La Product Owner aprobó explícitamente el consentimiento SDD para
  implementar este alcance el mismo día.

## Objetivo

Crear una entrada central `/acceso` que separe inequívocamente **iniciar
sesión** de **registrarse/solicitar acceso**, dirija cada persona a su contexto
autorizado y haga cumplir que ninguna solicitud ciudadana o de terreno puede
trabajar antes de la aprobación de su Hospital.

## Decisiones de producto cerradas

1. Hospital y Alcaldía aprovisionan a sus propios empleados; no existe
   autorregistro institucional.
2. Paciente, Cuidador y Personal de terreno pueden solicitar registro desde el
   Portal Central, pero la solicitud no crea sesión ni permisos.
3. Hospital revisa, aprueba, rechaza, suspende o revoca únicamente solicitudes
   de su propio alcance institucional.
4. Un botón «Ir a Hospital» o «Ir a Alcaldía» lleva a acceso central primero;
   el destino solicitado nunca concede permiso.
5. Una persona puede tener varios contextos aprobados, pero debe seleccionar un
   contexto activo después de autenticarse. Los permisos se calculan en el
   servidor por rol, institución, relación y vigencia.
6. Decisión posterior de la Product Owner (2026-09-23): mientras MERDN está
   en demostración, todos los usuarios y datos visibles son ficticios. Este
   paquete es un demo local aislado: no crea cuentas, sesiones, cookies,
   credenciales ni registros persistentes, y no contacta APIs externas.

## Alcance demo local vigente

Esta sección tiene precedencia sobre cualquier texto anterior o posterior de
esta misma spec que describa API, autenticación, persistencia, autorización,
RLS o integración. Dichas capacidades quedan fuera de esta implementación.

- `/acceso` diferencia visualmente el ingreso institucional, el acceso de
  personas y la solicitud de registro, pero no autentica a nadie.
- Las solicitudes de paciente, cuidador y personal de terreno se representan
  únicamente en memoria del navegador y se anuncian como ficticias.
- Hospital, Alcaldía, Cuidador y Personal de terreno conservan sus canvases
  locales de demostración. Ningún canvas confirma identidad, aprobación,
  permiso o acceso a datos reales.
- La API de solicitudes, bandeja institucional persistente, RLS, auditoría y
  activación OIDC se dejan explícitamente para una spec de producción futura.

## Alcance funcional

- Añadir al Portal Central las acciones diferenciadas «Iniciar sesión» y
  «Registrarme / solicitar acceso».
- Crear `/acceso` con destino solicitado únicamente informativo y rutas de
  acceso diferenciadas: sesión institucional existente para Hospital/Alcaldía
  y sesión humana existente para identidades ciudadanas.
- Implementar solicitudes de acceso para `PATIENT`, `CAREGIVER` y
  `FIELD_PROFESSIONAL` con estado `PENDING`, `APPROVED`, `REJECTED`,
  `SUSPENDED` o `REVOKED`, institución verificadora, fecha, actor aprobador y
  motivo minimizado cuando sea rechazado, suspendido o revocado.
- Exponer al administrador autorizado del Hospital una bandeja de solicitudes
  de su institución con acciones explícitas de aprobar, rechazar, suspender y
  revocar; el aprobador no puede aprobar ni modificar su propia solicitud.
- Tras una aprobación, el solicitante usa autenticación humana. Sin aprobación
  vigente, se muestra «Pendiente de verificación» o «Acceso no autorizado» y
  nunca se monta la experiencia de negocio.
- Mantener el modo demo aislado: identidades, solicitudes y decisiones demo
  locales ficticias, sin suplantar ni crear sesiones productivas.

## Fuera de alcance

- Verificación automática de identidad, consulta a entidades externas,
  validación de cédulas/matrículas, biometría, correo/SMS, recuperación de
  contraseña, federación adicional, directorios institucionales o pagos.
- Otorgar roles por el cliente, credenciales hardcodeadas, login demo que abra
  rutas reales, suplantación, acceso de emergencia o acceso cruzado entre
  instituciones.
- Cambiar reglas clínicas, datos de pacientes, integraciones externas,
  `prototype-claude/`, `develop` o `main`.

## Datos, tenencia y privacidad

- Una solicitud pertenece a una institución verificadora concreta y a la
  persona solicitante; su estado, vigencia, decisiones y trazabilidad no se
  comparten con otra institución.
- El formulario recolecta solo campos mínimos necesarios para solicitar el
  perfil. No guarda documentos de identidad ni datos clínicos en esta fase.
- El solicitante elige una institución verificadora desde un catálogo controlado
  por tenant. Para demo se usa exclusivamente una institución ficticia local;
  no se presentan entidades externas como fuente ni verificación real.
- La relación Paciente–Cuidador y la asignación del Profesional siguen siendo
  autorizaciones independientes: aprobar una cuenta no concede por sí mismo
  acceso a un paciente o información clínica.

## Seguridad, permisos y auditoría

- La autenticación se mantiene en servidores/autorizadores existentes; el
  frontend nunca recibe, guarda ni fabrica tokens.
- Todo endpoint deriva actor, tenant e institución de la sesión; rechaza IDs de
  tenant/institución/actor enviados por cliente y aplica RLS/alcance del
  repositorio.
- Solo el rol administrativo institucional autorizado puede decidir solicitudes
  de su institución; el servidor impone esa regla.
- Registrar auditoría de solicitud creada, vista, aprobada, rechazada,
  suspendida, revocada, intento de acceso denegado y acceso concedido, con
  actor, recurso, institución, resultado, momento y motivo minimizado.
- Las sesiones deben comprobar aprobación y vigencia antes de exponer cada
  contexto sensible; la revocación bloquea operaciones futuras.

## Accesibilidad

- Formularios con etiquetas, errores asociados, foco visible y mensajes que no
  revelen si una persona existe en el sistema.
- Estados de solicitud comunicados con texto además de color.
- Los destinos y contextos se expresan claramente; no hay botones que aparenten
  conceder acceso sin confirmación del servidor.

## Archivos permitidos

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/acceso/page.tsx`
- `apps/web/src/features/hub/HubAccessPortal.tsx`
- `apps/web/src/features/hub/hub.module.css`
- `apps/web/src/features/auth/**`
- `apps/web/src/features/access/**`
- `apps/web/src/features/hospital/HospitalShell.tsx`
- `apps/web/src/features/municipality/**`
- `apps/web/src/features/experiencia/ExperienciaMerdn.tsx`
- `apps/web/src/features/inscripcion/**`
- `apps/api/src/human-auth/**`
- `apps/api/src/institutional-auth/**`
- `apps/api/src/access-requests/**`
- `apps/api/src/audit/**`
- `apps/api/src/database/**`
- `apps/api/src/app.module.ts`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `spec/specs/035-central-access-institutional-approval/**`
- `spec/specs/INDEX.md`
- `spec/.sdd/user-consent.log`

## Archivos demo adicionales autorizados

- `apps/web/src/features/hospital/HospitalAdministration.tsx`
- `apps/web/src/features/hospital/hospitalAdministrationConfig.ts`
- `apps/web/src/features/hospital/HospitalAccessApprovalsDemo.tsx`
- `apps/web/src/features/hospital/hospitalAccessApprovalsDemo.module.css`

## Criterios de aceptación

1. CUANDO se elige Hospital o Alcaldía desde el Portal Central, EL SISTEMA
   DEBERÁ exigir una sesión institucional válida y autorizada antes de montar
   cualquier dato del destino.
2. CUANDO una persona solicita registro como Paciente, Cuidador o Personal de
   terreno, EL SISTEMA DEBERÁ crear una solicitud `PENDING`, sin sesión ni
   acceso a datos de negocio.
3. CUANDO un administrador institucional autorizado aprueba una solicitud de
   su institución, EL SISTEMA DEBERÁ crear/activar solo el contexto aprobado y
   auditar la decisión; otro tenant o el propio solicitante no puede hacerlo.
4. CUANDO la solicitud no está aprobada y vigente, EL SISTEMA NO DEBERÁ montar
   una experiencia de Paciente, Cuidador o Visitador ni revelar información
   nominal, clínica, financiera o institucional.
5. Pruebas unitarias, API, permisos, tenant isolation, auditoría, accesibilidad
   y E2E del flujo aprobado/delegado DEBERÁN pasar junto con SDD y build.
