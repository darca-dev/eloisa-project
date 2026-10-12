# Plan 041

## Fases y dependencias

040 verificado, IdP configurado y baseline aislada. Antes de código de identidad, revisión especializada de ownership y reset.

1. Inventario y revisión de alias, pérdida de contraseña, fallos parciales y concurrencia.
2. Procedencia real y motivos neutrales, lectura histórica compatible.
3. Propiedad del intento público, migración aditiva, cuenta nueva y pruebas RLS/carreras/reintento.
4. Recuperación administrada, autenticación reciente, estado persistente, revocación local/remota, cambio obligatorio y UI protegida.
5. E2E real, regresión, accesibilidad, Docker local y entrega detallada.

## Alternativas y riesgos

El PO eligió recuperación administrada frente a SMTP institucional. Reset público por documento permitiría apropiación: descartado. Contraseña temporal con cambio obligatorio reutiliza Keycloak sin secretos persistidos. Dos sistemas requieren operación persistente y bloqueo ante incertidumbre. Verificación manual declarada no equivale a identidad certificada.

## Rollback

Migraciones aditivas; conservar procedencia, referencias, auditoría y reservas. Deshabilitar endpoint ante problema; no volver a versión que permita apropiación. Backup/restauración comprobados antes de cambios activos.

## Paquete inicial de persistencia y registro

Migración 20261012170000: enum SELF_REGISTRATION aditivo (default TEST_DATA se
conserva para fixtures históricos), hash/caducidad de intento en AccessRequest,
vínculo externo exacto con FK triple y lease de operación de provisión. Sin
backfill documental ni selección de un alias histórico; legacy sin vínculo exacto
necesita conciliación del marcador remoto antes de aprobar. No aplicar a base
activa hasta cerrar servicios/tests del paquete.

POST registration-attempt prepara cookie HttpOnly Secure Strict de 30 días, path
access-requests; no crea persona ni cuenta. Submit exige cookie y guarda hash y
caducidad de 30 días fijada al crear. Reintento expira en servidor, compara identidad
y expediente y no cambia contraseña. Pérdida de cookie no autoriza recuperación
pública. Solo solicitudes abiertas del mismo perfil; otro perfil/documento existente
no se apropia por declaración pública. Frontend usa credentials include y un
Web Lock del origen para serializar bootstrap/envío entre pestañas.

## Persistencia de recuperación y step-up

Migración aditiva 20261012180000: freshAuthenticatedAt en HumanSession,
intento de reautenticación ligado por FK a sesión/cuenta/vínculo exactos,
passwordRecoveryBlocked en HumanAccount y AccessPasswordRecovery con estados
PENDING/SUCCEEDED/UNCERTAIN/SUPERSEDED. FKs compuestas actor/destino/solicitud,
RLS FORCE, rol runtime sin DELETE y unicidad parcial de operación pendiente.
No guardar contraseñas. Auth_time firmado se persiste solo tras callback
forzado que revalida la sesión original y la misma identidad externa.

Inicio/finalización y decisiones comparten orden de bloqueo solicitud→cuenta.
Inicio bloquea cuenta, revoca sesiones y audita antes del IdP. Incertidumbre
queda bloqueada; repetir operationId solo lee, nueva contraseña exige nueva
operación con predecessor explícito y referencia del soporte. Nunca reemplazar
una operación PENDING en ejecución. Finalizar solo si sigue aprobado, con
vínculo exacto, destino elegible y actor autorizado; no reactivar suspensión.
Nueva tabla amplía catálogo aislado a 29 tablas/30 policies/22 migraciones.
Aplicar primero y probar en base aislada; ninguna migración activa todavía.

## Cierre de carreras de recuperación

La revisión independiente exige una migración aditiva 20261012190000: corte
persistente authenticationNotBefore en HumanAccount y generación
accessLifecycleVersion, capturada por cada recuperación. Un callback cuyo
intento comenzó antes del corte se rechaza incluso si el reset terminó.
El corte se avanza otra vez con el reloj de PostgreSQL al liberar el bloqueo,
para incluir intentos iniciados durante la revocación remota del SSO anterior.
Toda desactivación incrementa la generación; finalizar el reset exige la misma
generación para no deshacer la suspensión de otro perfil histórico.

Un sucesor de una operación UNCERTAIN hereda la incertidumbre y nunca libera
el bloqueo por su sola respuesta HTTP. Un timeout no prueba que el PUT remoto
terminó. La conciliación por tiempo solo clasifica el fallo; la liberación
requiere intervención autenticada del operador IdP y comprobar que no quedan
escrituras en vuelo. No hay botón público ni temporizador para desbloquear.
Catálogo aislado: 29 tablas, 30 policies y 23 migraciones.

Control de abuso de recuperación separado del registro público: autenticación
primero; por administrador, hasta 60 consultas/minuto y 5 mutaciones/15 minutos.
Consultar el estado no consume el cupo de escrituras ni el de altas personales.

## Corrección de participación ficticia heredada

El E2E real de Visitador encontró que 038 intentaba insertar un perfil de
Medicina general y una afiliación THIRD_PARTY ficticia para cualquier profesión.
Dar INSERT al runtime conservaría datos inventados y ampliaría privilegios:
alternativa descartada por la instrucción del PO «nada de demos».
FIELD_PROFESSIONAL aprobado, igual que CAREGIVER, obtiene solo su portal neutro
por solicitud aprobada y cuenta activa. No crea perfil clínico ni afiliación,
contrato o asignación. IdentityAccess conserva sus requisitos de perfil,
afiliación vigente y asignación para acceder a recursos profesionales.
No migrar ni alterar registros históricos; catálogo permanece en 23 migraciones.
Verificar portal real sin participación fabricada y denegación de recursos
clínicos, con revisión independiente de guards y regresión de experiencias.
La revisión confirma filtros clínicos intactos; la portada debe admitir sesión
activa sin contexto PROFESSIONAL para consultar la worklist vacía. Retirar su
tab LiquidationsDemo y la bandera demo de la ruta real. Pagos siguen pendientes
del módulo autorizado correspondiente; no mostrar movimientos inventados.

## Conciliación excepcional por operador local

CLI local, sin endpoint público, para la última operación PENDING/UNCERTAIN
de una cuenta personal bloqueada. Operador IdP autenticado; excluir todas las
reservas institucionales y capacidades de soporte. Mutex persistente exclusivo
por daemon/proyecto antes de cualquier mutación, sin caducidad automática.
Stop de la única API emisora y restart del MISMO contenedor IdP persistente:
elimina PUT anteriores en vuelo, preservando realm/subject/marcador. No recrear
contenedores ni borrar volúmenes. Verificar nuevamente operador y destino.

Auditar SYSTEM STARTED antes de un nuevo PUT temporal único, logout y lecturas
de requiredActions/sessions. Finalización solicitud→cuenta: revalidar versión,
generación, binding, APPROVED y exclusiones, avanzar corte con clock_timestamp
y liberar bloqueo solo con confirmación remota. Conservar auditoría UNCERTAIN
previa y correlación nueva; SUCCEEDED confirma la nueva contraseña entregada
por el operador, nunca la del HTTP original. Ante fallo, conservar bloqueo.

Mutex de recurso Docker de nombre único por daemon/proyecto, compartido entre
usuarios del SO y checkouts, con propietario/token exactos hasta restaurar API.
El contenedor mutex nunca se inicia y no tiene red; no vive en el home del usuario.
Tras crash,
no limpiar por reloj/PID aparente; operador confirma proceso muerto y repite
barrera de restart. Archivos de contraseña/evidencia con ACL efectiva Windows
verificada, no solo mode 0600. Pruebas: exclusión de procesos, fallo previo a PUT,
generación/tenant/exclusiones y conciliación en Docker/IdP aislados reales.
Diseño e implementación revisados por review_access; correcciones verificadas.
La revisión de implementación exige fijar cada llamada Docker al mismo endpoint
local verificado (npipe Docker Desktop o socket Unix). Rechazar contexto SSH/TCP
y DOCKER_HOST remoto antes de autenticación; labels/HostIp no prueban localidad.
