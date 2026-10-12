# 040 — Registro inicial único de administrador institucional

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado para implementación local`.
- Fecha de propuesta: 2026-10-12.
- Responsable: Codex.
- Decisión funcional: Product Owner, conversación del 2026-10-12, recogida en
  `../../bitacora/decisiones/2026-10-12-registro-unico-admin-institucional.md`.
- Aprobado por / Approved by: Product Owner, conversación del 2026-10-12.
- Evidencia / Approval evidence: `../../bitacora/decisiones/2026-10-12-ejecucion-modulos-reales-codex.md`.
- Autorización expresa a Codex para realizar los módulos faltantes. La autorización se registró mediante confirm-user-consent.sh para esta spec tras recibir la instrucción expresa.

## 1. Objetivo y contexto

Permitir que el responsable de Hospital y el de Alcaldía creen su primera cuenta
administradora, entren con ella y encuentren cerrado el registro administrativo
después del alta. El producto no ofrece creación de otros empleados ni roles.

Actualmente HubAccessPortal ofrece registro solo para atención domiciliaria.
InstitutionalAuthController expone sesiones para identidades aprovisionadas por
configuración; no expone altas. La spec 035 prohibía autorregistro institucional;
la decisión nueva sustituye esa regla para el primer administrador exclusivamente.

## 2. Usuarios, institución y alcance

- Primer responsable del Hospital configurado y primer responsable de Alcaldía
  configurada. Una cuenta por pareja institución/experiencia, separadas entre sí.
- El servidor determina la institución y el tenant. Un parámetro Hospital/Alcaldía
  elige la experiencia solicitada, nunca permite elegir un tenant ni concederse permisos.
- En la instalación actual existe un tenant activo; no se añaden alta de tenants,
  catálogo de instituciones, selector de tenant ni cambios de ownership.
- Pacientes, Cuidadores y Visitadores conservan su inscripción y aprobación actuales.

## 3. Flujos y requisitos funcionales

1. Cada tarjeta institucional ofrece «Iniciar sesión» y, mientras corresponda,
   «Registrar administrador». Las pantallas de acceso también ofrecen ese registro.
2. Antes de presentar el formulario se consulta al servidor la disponibilidad
   del alta para la institución/experiencia. La respuesta no revela datos del administrador.
3. El formulario muestra la institución configurada y recoge tipo/número documental,
   nombres, apellidos, fecha de nacimiento, sexo/género, correo, contraseña y
   confirmación. Reutiliza Person y HumanAccount obligatorios. Son declaraciones, no prueba
   de identidad, afiliación laboral ni verificación oficial.
4. El servidor valida el cuerpo mediante una lista de campos permitidos y aplica
   los controles de contraseña del proveedor de identidad existente. Rechaza
   `tenantId`, institución arbitraria, rol, estado, permisos y usuario aprobador.
5. Una reserva exclusiva persistida en PostgreSQL impide que dos solicitudes creen
   dos administradores para la misma institución/experiencia. Debe existir una
   restricción única, además del control transaccional de la aplicación.
6. El alta usa el proveedor OIDC existente. No introduce contraseñas almacenadas
   por MERDN, ni login simulado, ni nueva autenticación propia.
7. No hay aprobación por un administrador de Eloisa ni por otro usuario. El primer
   registro confirmado es el administrador. El navegador nunca decide esa condición.
8. Solo se muestra «Registro completado» cuando están confirmados cuenta del IdP,
   vínculo exacto issuer/sub y habilitación local institucional. Después se inicia
   el flujo OIDC existente para entrar; registrarse no fabrica una sesión en el cliente.
9. Una vez completado, el formulario desaparece y el endpoint rechaza altas posteriores
   con conflicto y un mensaje de registro cerrado, sin datos del titular.
10. La reserva se conserva después de reinicios, deshabilitación o revocación.
    No existe botón ni endpoint público para reiniciarla o reemplazar al administrador.
11. El alta fallida no muestra éxito ni otorga acceso. El mismo intento puede
    reconciliarse de forma idempotente; un fallo entre IdP y DB no abre una ventana
    para otra cuenta. La conciliación se realiza sin borrar cuentas ajenas.
12. Tras el alta, la autenticación institucional rechaza otras identidades de esa
    institución/experiencia, incluidas identidades heredadas configuradas y sesiones
    anteriores. La historia y auditoría se conservan.
13. El modo demo no sustituye la cuenta registrada ni evita los guards.
14. No se añaden pantallas, endpoints ni acciones para otros usuarios, roles o invitaciones.

## 4. Arquitectura propuesta, dependencias y compatibilidad

Reutilizar la identidad humana OIDC, las cuentas persistentes y la sesión del
servidor existentes. Añadir una reserva institucional única, vinculada a la cuenta
y al issuer/sub confirmado. La pertenencia administrativa es resuelta en backend.

Hospital y Alcaldía comparten el ciclo de alta; sus ámbitos se mantienen separados.
La transición de la sesión institucional heredada debe conservar auditoría nominal
y rechazar identidades ajenas al único administrador cuando el alta esté completada.
No ampliar los cinco roles legados ni añadir un editor de permisos para este alcance.

Revisión especializada de identidad/datos: mantener Person obligatorio. El alta pública
crea una persona nueva; rechaza opacamente documentos existentes y nunca se apropia
de participaciones por un documento declarado. Para cuentas ya autenticadas, claim
deriva la cuenta de la sesión humana. Cada reserva confirmada posee capacidades
institucionales internas sin secreto: Hospital usa los cuatro roles operativos
existentes y Alcaldía MUNICIPAL_VIEWER. No son empleados ni credenciales nuevas.
Los guards resuelven el rol literal requerido a partir de HumanSession y reserva,
sin fallback legacy si existe cookie humana. Auditoría nominal HUMAN_ACCOUNT con
actorRole nulo; FKs operativas conservan la identidad interna persistida.

Saga: cookie HttpOnly aleatoria previa al envío, solo hash persistido; reserva única,
persona y cuenta DISABLED en transacción. Usuario remoto con username opaco y marcador
exacto; reconciliar antes de activar. Confirmar vínculo, cuenta, capacidades y
auditoría en transacción. Un fallo conserva la reserva y permite reintento probado
por cookie, nunca libera el cupo. No conservar contraseña ni resetearla al reintentar.
Experiencias HOSPITAL/MUNICIPALITY se derivan de reserva, separadas de los tres
AccessRequestProfile. Retorno OIDC sigue /acceso; no cambia su allowlist.

Alternativa descartada en la propuesta: agregar otra contraseña o cookie propia
exclusiva para registro. Duplicaría el ciclo de autenticación y contradice la
dirección vigente de identidad individual con OIDC de S01.

Dependencias: conectividad/configuración del IdP local, vínculo humano persistente,
resolución de tenant enforce y migración aditiva. Configuración ausente o parcial
debe fallar cerrada. No se sustituye por modo demo.

## 5. Datos, propiedad y procedencia

Reserva: UUID, tenant/institución/experiencia, estado de conciliación, identificador
opaco del intento, cuenta administradora, issuer/sub confirmado y fechas.
Unicidad permanente por institución/experiencia. FKs compuestas cuando aplique.

Nombre y correo pertenecen al expediente de la cuenta institucional de ese tenant.
En este entorno se prueban con datos ficticios. Contraseña y confirmación solo
transitan al proveedor: nunca aparecen en tablas, respuestas, logs ni auditoría.
No se fijan nuevos periodos legales de conservación ni se habilita borrado público.

## 6. Permisos, aislamiento y límites de negocio

El público solo consulta disponibilidad y presenta el primer registro permitido.
Después del alta, únicamente su cuenta activa puede autenticar esa experiencia.
La cuenta Hospital no entra en Alcaldía y viceversa, ni llega a otro tenant.

Ser administrador habilita la administración institucional especificada, no acceso
clínico universal ni permisos derivados del nombre de un cargo. Los guards de
datos, relaciones, pacientes, consentimientos y asignaciones siguen siendo
obligatorios. No se cambian reglas clínicas ni permisos de otros perfiles.

La implementación debe definir y probar la traducción del administrador Hospital
a la revisión institucional existente de solicitudes de su tenant; Alcaldía conserva
sus consultas agregadas autorizadas. No inferir capacidades clínicas o financieras.

## 7. Auditoría y seguridad

Auditar reserva inicial, confirmación del administrador, fallos de conciliación y
rechazos de altas posteriores. Actor anónimo antes de autenticar; identificador
de cuenta real al confirmarse. Incluir institución, recurso opaco, timestamp,
resultado y correlación. Excluir correo, nombre, contraseña, tokens y payload.
El cierre local y la auditoría se confirman en la misma transacción.

Reutilizar comprobación de origen y límites de intentos. No confiar en botones
ocultos, parámetros de URL, claims sin validar ni localStorage. Respuestas no-store.
Sesión con cookie HttpOnly y controles vigentes de vigencia y revocación.
La primera reserva se habilita exclusivamente en el entorno local controlado
para esta entrega; apertura pública y verificación institucional requieren otro alcance.

## 8. Referencia visual y accesibilidad

Conservar tarjetas del Portal Central y estilos de acceso actuales. Un componente
compartido sirve a Hospital/Alcaldía, con nombre institucional visible. Etiquetas
asociadas, foco de error/éxito, teclado, mensajes textuales y diseño adaptable.
La pantalla de registro cerrado dirige al inicio de sesión.
`prototype-claude/` sigue siendo referencia de solo lectura.

## 9. Archivos permitidos y prohibidos

Permitidos: `apps/api/src/institutional-auth/`,
`apps/api/src/human-auth/`, `apps/api/src/identity-access/`, guards institucionales
de `apps/api/src/access-requests/` cuando sea necesario, sus servicios de registro/provisión/revisión para impedir la reutilización pública de cuentas administradoras y la desactivación por solicitudes personales, su cliente compartido de
provisión y tests, `apps/api/src/audit/`, consumidores institucionales hospital/
municipality/identity-access/visits para propagar actor nominal y guards,
`prisma/schema.prisma`,
nuevas migraciones aditivas de `prisma/migrations/`, tests correspondientes;
`apps/web/src/features/auth/`, `apps/web/src/features/hub/HubAccessPortal.tsx`,
sus estilos/tests, puertas de `apps/web/src/features/hospital/HospitalShell.tsx`
y `apps/web/src/features/municipality/MunicipalityShell.tsx`, nuevas rutas
institucionales de alta y sus tests, y los artefactos de esta spec.
También catálogo/preflight de pruebas aisladas y tests: incorporar la nueva tabla
y migración a sus listas exactas manteniendo RLS/privilegios, sin reducir controles.
La prueba real de Keycloak exige configurar el atributo gestionado
`merdnAccessRequest`, visible/editable únicamente por administración, conservando
los atributos no gestionados deshabilitados. Los nombres y correo no se exigen
en el IdP: su fuente sigue siendo Person. Allowlist adicional:
`scripts/identity/local-oidc-profile.mjs` y sus pruebas, configuración
`infra/local-oidc/` y runbook local. La configuración activa y el perfil anterior
se respaldan antes de aplicar; no se regeneran usuarios ni secretos existentes.
La matriz baseline añade al final la prueba DB de administrador, sin retirar etapas.
El E2E detectó que las cookies de Keycloak se descartan en el origen HTTP
host.docker.internal. La topología local usa ahora el nombre exacto
`merdn.localhost`: el navegador lo resuelve a loopback y Compose lo mapea al
host-gateway para la API. Se permite ese nombre exacto en ambas configuraciones
humanas; se conserva la prohibición HTTP/local en mvp. Allowlist: `compose.yml`,
ejemplos de entorno, `apps/api/src/config/environment.ts` y pruebas, scripts
de configuración local de identidad y su documentación. No se cambian hosts
del sistema ni opciones del navegador. Se verifica issuer idéntico en ambos
lados. El adaptador convierte el timeout de milisegundos a segundos exigidos
por openid-client. La configuración de un realm existente se respalda y actualiza
sin recrear el contenedor ni perder usuarios.
Preflight activo encontró 41 cuentas y cuatro vínculos del issuer anterior,
todos verificados contra el mismo realm y subject. Se admite conciliación
administrativa local de esos cuatro vínculos, preservando IDs, cuentas, estados
y perfiles: solo cambia el issuer. Se revocan sesiones previas y se audita
la revinculación con actor SYSTEM en la misma transacción runtime/RLS. Cualquier
vínculo inesperado, conflicto o identidad remota ausente detiene esa operación.
No se usa correo/documento para emparejar ni se concede una cuenta nueva.

Prohibidos: `prototype-claude/`, `tasks/`, `reviews/`, cambios de normas clínicas,
finanzas, pagos, datos reales, archivos de secretos versionados, migraciones ya
aplicadas, Git commits/pushes/merges/PRs y despliegue público.
No modificar gobernanza ni abrir consentimiento de otras specs.

## 10. Criterios de aceptación y pruebas requeridas

- Alta inicial Hospital y Alcaldía, entrada posterior y logout con identidades ficticias.
- Dos envíos concurrentes: exactamente un administrador confirmado por experiencia.
- Segunda alta, llamada directa y reapertura tras reinicio: rechazadas en servidor/DB.
- Deshabilitar la cuenta no reabre el registro.
- Fallos de IdP, auditoría o DB: sin éxito falso, sin segundo administrador ni sesión indebida.
- Reintento idempotente y conciliación de resultado incierto del proveedor.
- Aislamiento entre Hospital/Alcaldía y entre dos tenants, con runtime enforce/RLS.
- Sesiones y credenciales heredadas no eluden la exclusividad después del alta.
- Cuerpo malicioso, origen ajeno, límites de intentos y secretos en logs: rechazados.
- Formularios accesibles y recorrido E2E real, sin atajos de demo.
- Regresión del registro de Paciente/Cuidador/Visitador y de revisión institucional.
- Build, tipos, lint focal y scripts SDD antes de entrega.

## 11. Migración, rollback y evidencia

Documentación de entrega autorizada: `docs/REVISION-MODULOS-REALES.md` y
actualización factual de `docs/PLAN-TERMINO-FUNCIONAL.md`. No convertir aceptación
técnica en aceptación PO ni declarar completos módulos pendientes.

Migración aditiva, sin borrar identidades/sesiones ni sobrescribir administradores.
Validar catálogo/RLS/ownership y backfill únicamente si existe dato verificable.
Una cuenta heredada no se convierte silenciosamente en el primer administrador.
Antes de aplicar cambios a la base local activa, verificar destino y obtener backup
lógico. Rollback desactiva el alta nueva y conserva la reserva, identidad e historial;
nunca restaura un registro público ya cerrado ni habilita otras cuentas.

La entrega debe incluir archivos cambiados, comandos y resultados de pruebas,
migraciones aplicadas, verificación HTTP/E2E y limitaciones de módulos existentes.
No declarar que una tarjeta renderizada prueba persistencia o autenticación.

## 12. Autorización vigente

El Product Owner autorizó expresamente a Codex a realizar todos los módulos
faltantes y detallarlos al completar cada entrega. La decisión del 2026-10-12
documenta esa instrucción. Se registró la autorización expresa mediante confirm-user-consent.sh exclusivamente para esta spec. No se habilita publicación pública.

### Correcciones de revisión independiente 2026-10-12

Cada sesión nueva conserva el vínculo externo exacto que autenticó al usuario; las capacidades institucionales exigen ese mismo vínculo. Las sesiones históricas sin atribución de vínculo no conceden administración. Una declaración pública no reutiliza cuentas administradoras, incluso durante la reserva. El claim de cuenta existente rechaza cuentas con solicitudes personales previas; bloqueo de persona serializa claim y submission. El navegador propietario puede recuperar el resultado confirmado tras perder la respuesta, sin reabrir el cupo.
