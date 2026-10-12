# Revisión de módulos reales

Actualización: 2026-10-12. Implementación local autorizada a Codex. Este registro
distingue comportamiento verificado de módulos pendientes; no sustituye la
aceptación del Product Owner.

## Registro del primer administrador — 040

Disponible en Docker local:

- Hospital: http://127.0.0.1:3000/hospital/registro
- Municipalidad: http://127.0.0.1:3000/municipality/registro

Cada experiencia admite un primer administrador. El formulario registra datos
personales, correo y contraseña en el proveedor de identidad real. Una reserva
persistente impide un segundo administrador incluso con peticiones simultáneas,
reinicios o una cuenta posteriormente deshabilitada. Una cuenta existente debe
autenticarse para reclamar el cupo disponible; declarar su documento no basta.

Después del alta se entra mediante OIDC/PKCE y cookie de sesión del servidor.
Hospital y Municipalidad conservan ámbitos distintos. Las credenciales y sesiones
institucionales anteriores no eluden el cierre del registro. No se añadió gestión
de empleados ni roles. El navegador propietario puede recuperar el resultado
si pierde la respuesta de un alta; la contraseña no se guarda en MERDN.

Implementación principal: servicio/controlador institucional, guards de las cinco
capacidades existentes, vínculo exacto de sesión humana, formulario compartido,
clientes de sesión y scripts reproducibles de configuración de Keycloak local.

Verificación ejecutada:

- E2E real aislada de ambas experiencias: alta, recuperación de resultado, login
  en Keycloak, acceso a APIs institucionales, denegación de la otra experiencia,
  logout y rechazo posterior. Sin respuestas simuladas ni cuentas ficticias en
  la base activa. Repetición con scripts versionados correcta, incluida la
  configuración del IdP ejecutada dos veces para verificar idempotencia.
- 20 pruebas de integración institucional en PostgreSQL real, incluidas carreras,
  RLS, cierre de registro, exactitud del vínculo y fallos de auditoría/proveedor.
- Suite web: 1909 pruebas correctas; contratos OpenAPI: 56 correctos.
- Configuración/perfil/conciliación local: 9 pruebas correctas.
- Formularios activos: cero violaciones automáticas axe WCAG A/AA, teclado y
  móvil de 320 px sin desbordamiento horizontal. Revisión visual móvil realizada.
- Revisión independiente de identidad: sin nuevos bloqueos tras correcciones;
  OpenAPI incluye OTRO y setup rechaza publicaciones adicionales fuera de loopback.
- Tipos, builds API/web y lint completo correctos. Baseline global correcta:
  30 etapas, 2596 pruebas correctas, cero fallos y cero omisiones, cleanup incluido.
  Se corrigieron expectativas históricas sin saltar casos ni reducir aislamiento.

Se aplicaron tres migraciones aditivas: integridad territorial compuesta,
reserva de primer administrador y vínculo exacto de sesión. La entrega 040 dejó
20 migraciones. Backup lógico restaurado y conteos comprobados antes de migrar.
Las 41 cuentas humanas y cuatro vínculos externos existentes se conservaron;
los cuatro subjects se cotejaron contra el mismo realm antes de conciliar issuer,
con auditoría y revocación de dos sesiones antiguas. No se cambiaron contraseñas
de esas personas. PostgreSQL y Keycloak activos se preservaron al renovar API/web.

El primer cupo de Hospital y Municipalidad en la base activa sigue libre.
Puedes registrar tu administrador y revisar el cierre del formulario después.
No restaurar una versión anterior que ignore la reserva después del alta: el
rollback debe desactivar el alta y conservar identidad, reserva e historial.

## Accesos personales y recuperación — 041

Implementado, verificado y disponible en Docker local. Método elegido por PO: recuperación gestionada
por administrador. Frontera IdP implementada y verificada también en Keycloak
real: autenticación reciente firmada, reset temporal, cambio obligatorio en
navegador, ingreso con contraseña nueva y cierre verificado de sesiones remotas.
39 pruebas unitarias de fronteras correctas. Implementados endpoint y UI de
recuperación, procedencia SELF_REGISTRATION, ownership del intento, vínculo
exacto por solicitud, lease exclusivo de provisión y step-up persistente.
21 pruebas PostgreSQL/HTTP correctas, con barreras controladas del proveedor
para carreras, fallo de auditoría y callbacks antes/durante reset. Registro,
aprobación e ingreso de tres perfiles pasan con Keycloak y formularios reales.
Se retiró la creación heredada de Medicina general y afiliación ficticia de
Visitador: su portal aprobado no concede recursos clínicos. Los recursos siguen
exigiendo perfil, afiliación y asignación vigentes. La portada real no muestra
LiquidationsDemo.

La E2E completa pasó con PostgreSQL, API, formularios y Keycloak reales:
registro/aprobación/ingreso de Paciente, Cuidador y Visitador, registro simultáneo
desde dos pestañas, reautenticación del administrador, recuperación auditada,
rechazo de contraseña y sesión anteriores, cambio obligatorio e ingreso con la
contraseña nueva. También pasaron teclado, axe focal sin violaciones, pantalla
de 320 px y cambio de solicitud mientras llega una respuesta anterior.

La conciliación excepcional del operador local pasó su E2E: rechaza cambios de
estado concurrentes y otro mantenimiento en curso, reinicia el mismo IdP para
terminar operaciones antiguas, establece una nueva contraseña temporal auditada
y verifica el cambio obligatorio e ingreso real. Su fixture incierto se prepara
expresamente en un tenant desechable; no simula una respuesta normal del IdP.
Endpoint Docker local fijo, mutex global del daemon y permisos privados del
archivo de contraseña tienen tres pruebas reales adicionales. Revisión
independiente focal: sin bloqueantes tras las correcciones.

Regresión global correcta: 31 etapas, 2626 pruebas aprobadas, cero fallos y cero
omisiones; cleanup aislado incluido. Tipos, imágenes API/web, lint y scanner
correctos. Gate SDD: cero errores y 19 advertencias históricas; validación
estricta: cero errores y cero advertencias. Se actualizaron expectativas
históricas de red, pagos ficticios y restricciones SQL, y una prueba de citas
que confundía «dentro de una hora» con «hoy» al cruzar medianoche UTC.

Aplicado a Docker local el 2026-10-12: tres migraciones aditivas nuevas, 23 en
total. Se detuvo API, se tomó un respaldo privado y se restauró en PostgreSQL
aislada antes de migrar. Conteos antes/después iguales: 41 personas, dos
pacientes, 41 cuentas, cuatro vínculos, 44 sesiones registradas, cero reservas
institucionales y cero solicitudes. Se renovaron solo API/web con las imágenes
`merdn-api:eloisa-access041` y `merdn-web:eloisa-access041`; PostgreSQL y Keycloak
mantuvieron sus IDs y datos. API saludable y web disponible. Ninguna cuenta
ficticia fue creada en la base activa.

Verificación posterior: ambos cupos iniciales libres; formularios institucionales
activos con axe sin violaciones, teclado y 320 px correctos; los tres perfiles
personales abren sus formularios sin precarga ficticia. Recuperación completa
probada en la instalación aislada, sin consumir tu cupo inicial activo.

Recorrido de revisión de 041:

1. Registrar el primer administrador en `/hospital/registro` y entrar al Hospital.
2. Abrir `/acceso?accion=registro`, elegir Paciente, Cuidador o Visitador y
   completar los cinco pasos. Conservar la referencia entregada; la solicitud
   pendiente todavía no permite entrar.
3. En Hospital → Configuración → Solicitudes, revisar la solicitud y aprobarla.
   Ingresar con esa referencia y su contraseña para comprobar el portal aprobado.
4. En el detalle de una solicitud aprobada, abrir recuperación, reautenticarse,
   confirmar la verificación de identidad y registrar referencia de soporte y
   contraseña temporal. Entregarla a la persona por un canal acordado.
5. Comprobar que la persona debe cambiar la contraseña temporal antes de entrar.
   La contraseña anterior y las sesiones anteriores quedan invalidadas.

La recuperación ordinaria cubre cuentas personales aprobadas del mismo Hospital.
No permite apropiarse de otra institución, una cuenta de soporte ni el primer
administrador. Si este pierde su acceso, interviene el operador nominal del IdP
mediante el procedimiento documentado en
[infra/local-oidc/README.md](../infra/local-oidc/README.md); no se abre otro cupo
de administrador. Un resultado incierto mantiene la cuenta bloqueada y requiere
la conciliación excepcional del operador local, sin reintentos automáticos.

## Alcance restante

S01 queda en revisión del Product Owner con 040 y 041 implementados y verificados.
S02–S14 conservan el alcance de
[PLAN-TERMINO-FUNCIONAL.md](PLAN-TERMINO-FUNCIONAL.md). Vistas interiores de
Hospital/Municipalidad aún contienen datos estáticos y capacidades pendientes;
el acceso real de 040 no acredita que esos módulos tengan persistencia real.
Se reemplazarán al implementar cada módulo, con evidencia y detalle propio.
