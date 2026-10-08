# S01 — Accesos reales: contrato de trabajo propuesto

Fecha: 8 de octubre de 2026. Task ID de planificación: **TERMINO-S01**. Rama prevista: **feat/termino-01-accesos-reales**. Plan: [PLAN-TERMINO-FUNCIONAL.md](../PLAN-TERMINO-FUNCIONAL.md).

**Estado:** BORRADOR PARA ESPECIFICACIÓN CANÓNICA. La solicitud del usuario define el objetivo real y la división por ramas; ya fija repositorio/HEAD: `C:\Users\10plu\Eloisa-develop\eloisa_project`, base local `9980582`. Siguen pendientes el modelo nominal institucional y los valores de seguridad D-02/D-03/D-04. Este contrato debe reconciliarse con la spec vigente y pasar a spec/specs/<NNN-slug>/ en esta base antes de implementar. No registra consentimiento ni abre un gate.

## 1. Objetivo y valor

Permitir registro, revisión, login y uso autorizado de los portales de Paciente, Cuidador, Visitador médico, Hospital y Alcaldía con cuentas reales en el IdP y datos ficticios persistidos en un entorno de pruebas. Entregar al Product Owner un archivo protegido con credenciales efectivamente verificadas.

Cerrar primero la identidad y la puerta de autorización evita extender CRUD, finanzas o evidencia sobre una sesión ficticia o un permiso de pantalla.

## 2. Alcance incluido

- Registro de los tres perfiles humanos, con datos/campos del formulario aprobado; expediente y solicitud persistentes.
- Bandeja Hospital de revisión/decisión, identificación del actor institucional, búsqueda/filtro/paginación y auditoría.
- Provisión IdP, confirmación y vinculación issuer+sub; fallas, reintentos y compatibilidad con inscripción previa.
- Login OIDC, navegación/returnTo, sesión, experiencia/contexto, acceso directo por URL y APIs protegidas.
- Hospital y Alcaldía con identidad individual atribuible y capacidad institucional vigente.
- Suspensión, revocación, expiración, logout, recuperación y MFA conforme a decisión aprobada.
- Dataset de acceso en dos tenants aislados; seed idempotente, credenciales protegidas y cleanup conservador.
- Pruebas reales y aceptación de este recorrido; exclusión de las rutas de acceso simulado.

## 3. Fuera de alcance

Implementación integral de clínica, bitácora, finanzas, planes, pagos, documentos, Hub, formación y reportes corresponde a otras secciones. El hito de acceso no certifica que esos módulos estén terminados.

No se aprueba procesar datos reales de pacientes, emitir certificados/reglas/fórmulas oficiales, desplegar producción, modificar main, editar prototipo/historia, usar bypass RLS, guardar passwords en MERDN ni crear un proveedor de identidad casero.

Las relaciones/asignaciones mínimas del dataset son fixtures auditados explícitos. S02 implementa su administración funcional; ni el registro ni la aprobación las crean implícitamente.

## 4. Usuarios, roles, instituciones y tenants

| Identidad | Acceso positivo | Denegación que debe comprobarse |
|---|---|---|
| Paciente | Experiencia PATIENT y self-scope propio con aprobación/participación vigentes | Otro paciente, tenant ajeno, Hospital/Alcaldía, cuenta sin aprobación |
| Cuidador aprobado sin vínculo | Portada neutra, sin datos de pacientes | Contexto de recurso CAREGIVER y consulta de cualquier paciente |
| Cuidador con vínculo | Capacidades y datos mínimos delegados por relación/scope/vigencia | Otro paciente, scope no concedido, vínculo EXPIRED/REVOKED |
| Visitador médico | Experiencia FIELD_PROFESSIONAL; contexto PROFESSIONAL por perfil/afiliación; recurso solo con asignación | Visita/paciente sin asignación, afiliación vencida, otro tenant |
| HOSPITAL_PATIENT_VIEWER | Consultas hospitalarias nominales autorizadas | Agenda write, aprobación de solicitud o rol clínico implícito |
| HOSPITAL_SCHEDULER | Operaciones de agenda/asignación autorizadas | Aprobar accesos o leer self-scope por ese rol |
| CAREGIVER_RELATIONSHIP_MANAGER | Validar/gestionar vínculos según ámbito | Datos clínicos por ser validador; relación entre instituciones sin autorización |
| HOSPITAL_ACCESS_REVIEWER | Revisar/decidir solicitudes del tenant institucional autorizado | Otro tenant, autoasignación de privilegios o asignación clínica implícita |
| MUNICIPAL_VIEWER | Agregados municipales autorizados | Nominal/clínica por defecto; mutaciones no concedidas |

Los cuatro primeros roles institucionales más MUNICIPAL_VIEWER son los cinco encontrados en la base C. En A solo hay cuatro, por lo que HOSPITAL_ACCESS_REVIEWER requiere reconciliación con la spec 038 antes de introducirlo. Los nombres son capacidades técnicas, no nuevas identidades concedidas por esta tabla.

R1–R15 de docs/ROLES.md siguen siendo referencias funcionales; no se habilitan quince roles por defecto. Administración de plataforma no implica acceso a contenido de negocio. AC-29 a AC-32 del catálogo requieren sus contratos posteriores y no se provisionan en este paquete inicial.

Instituciones/tenants se resuelven en backend. TEST_A/TEST_B del catálogo son aliases de aislamiento, no IDs enviados por un formulario. D-02 debe fijar la relación entre actor, institución, capacidad y tenant que corresponde al modelo físico real.

## 5. Requisitos funcionales y estados

### 5.1 Registro

1. Ofrecer Paciente, Cuidador y Visitador médico con los campos/pasos de la referencia aprobada; validación de servidor, no solo navegador.
2. Validar cuerpo discriminado, longitudes, catálogos y datos ficticios del entorno; rechazar campos que intenten definir rol, estado, tenant, reviewer, sub o permisos.
3. Bloquear doble submit de manera síncrona y congelar campos/perfil/pasos durante envío. Aplicar idempotencia/concurrencia según contrato.
4. Persistir solicitud PENDING, expediente versionado y fuente TEST_DATA sin password. Respuesta pública mínima con referencia opaca; no revelar estados personales a terceros.
5. Preparar identidad deshabilitada si ese paso es el flujo aprobado. No activar ni otorgar Patient/afiliación/relación/asignación sin el paso autorizado.
6. Reintento después de falla requiere una credencial válida nueva si fue borrada del estado efímero; no reenviar password vacío.

### 5.2 Revisión y provisión

Estados encontrados en C:

- PENDING → APPROVED_PENDING_PROVISIONING o REJECTED.
- APPROVED_PENDING_PROVISIONING → APPROVED o PROVISIONING_FAILED.
- PROVISIONING_FAILED → APPROVED_PENDING_PROVISIONING o REJECTED.
- APPROVED → SUSPENDED o REVOKED.
- SUSPENDED → APPROVED_PENDING_PROVISIONING o REVOKED.

Toda transición requiere actor/capacidad/tenant/version, auditoría y comportamiento de concurrencia. APPROVED exige confirmar la identidad real y la participación mínima aprobada. HumanAccount usa ACTIVE/DISABLED; el estado administrativo de AccessRequest no debe confundirse con un enum inexistente de cuenta.

Aprobar Cuidador no crea relación. Aprobar Visitador puede crear el perfil/afiliación mínima definida por la spec, pero nunca asignaciones, pacientes ni capacidad clínica automática. Revisor institucional no comparte credencial con solicitantes.

### 5.3 Login y sesión

- OIDC Authorization Code + PKCE con firma, issuer, audience, nonce/state y destino validados.
- Vincular issuer+sub exactos a la cuenta autorizada. Un UUID inventado, email o documento coincidente no es prueba de vinculación.
- Resolver experiencia aprobada separadamente del contexto/participación. Ninguno sustituye permiso por acción/recurso.
- Paciente, Cuidador y Profesional solo navegan a portales compatibles; cuentas con varios perfiles tienen selector explícito.
- Las rutas directas y APIs vuelven a comprobar aprobación/cuenta/participación/tenant. No confiar en que el usuario pasó por /acceso.
- Suspensión/revocación/desvinculación afecta sesiones vigentes y la siguiente petición; el cierre visual solo acompaña la invalidación en servidor.
- Limpieza de caches, cursores, DTOs y selecciones tras logout/cambio de contexto. Abort/epoch o mecanismo equivalente evita aplicar respuesta tardía.

## 6. Enfoque arquitectónico, alternativas y decisiones

**Propuesta:** reutilizar la integración OIDC real y la autorización local existente, con actor nominal institucional, cuenta/participación/aprobación y vínculo institucional por capacidad. Conservar los guards por superficie y operación. El IdP autentica; MERDN decide permisos.

**Alternativa:** mantener temporalmente la credencial institucional opaca de las primeras specs. Puede autenticar de forma real, pero su atribución no equivale a una cuenta individual y no satisface el cierre nominal propuesto sin una decisión compensatoria explícita. No se acepta como solución final por mera comodidad.

**Otra alternativa:** duplicar IdP/usuarios por portal. Añade reconciliación y operación, y aumenta riesgo de inconsistencias. No se recomienda salvo requisito aprobado que lo justifique.

**Tradeoffs:** OIDC compartido reduce autenticación duplicada, pero no debe unir permisos de sesiones/roles. La transición institucional requiere diseñar membership, cookies/guards, logout y migración. Reusar cuenta no autoriza leer todos los tenants ni todos los recursos.

D-02 fija ese contrato antes de ACC-07. Si la base C ya contiene una decisión compatible de Keycloak local, debe verificarse su implementación y autoridad; no reemplazarla por la recomendación histórica de Entra de A sin decisión nueva.

## 7. Datos, propiedad, sensibilidad y procedencia

| Dato | Fuente/propietario | Uso y restricción |
|---|---|---|
| Persona/contacto/documento de test | Fixture o registro ficticio controlado; institución según tenant | Minimizar por endpoint; no copiar personas reales ni publicar contacto en logs |
| HumanAccount | Backend; vinculada a Person/tenant | ACTIVE/DISABLED; estado y actor de cambio auditables |
| ExternalAuthIdentity | Respuesta verificada del IdP | issuer+sub real; no matching por email ni reemplazo por UUID local |
| AccessRequest/snapshot | Registro público validado; tenant derivado por servidor | PENDING/estados/version/fuente TEST_DATA; expediente sin credencial; lectura solo por revisor autorizado |
| Sesión | Backend tras callback validado | Cookie opaca y expirable; token/refresh fuera de UI y logs |
| Identidad institucional/capacidad | Administración autorizada de la institución | Usuario individual y asignación vigente; cliente no autodefine privilegios |
| Relación/afiliación/asignación de prueba | Fixture administrativa auditada | Owner/tenant/runId y scopes explícitos; no creada por aprobación del registro |
| Contraseña/MFA de test | IdP y configuración privada del probador | Solo tránsito/archivo local protegido; nunca DB de negocio, snapshot, audit, UI publicada ni Git |

Retención: conservar historia de decisiones y auditoría por defecto. El dataset efímero se limpia únicamente con ownership de runId probado; periodos definitivos para datos reales deben aprobarse antes de ese uso. No se autoriza borrar globalmente territorio, pacientes o auditoría para resetear pruebas.

## 8. Autorización por acción y recurso

La decisión combina identidad vigente, rol/capacidad, tenant/institución, contexto, relación/asignación, consentimiento/fundamento aplicable, vigencia y acción solicitada. Ningún campo enviado por el navegador reemplaza esas verificaciones.

- Público: crear solicitud mínima; no listar personas/solicitudes ajenas, no elegir tenant arbitrario ni revisar.
- Humano: consultar su cuenta/experiencias/participación; self-scope propio o capacidad delegada/asignada vigente.
- Revisor: listar/detallar/decidir dentro de su institución; no otorgarse permisos ni actuar en otra institución.
- Institucional: acción concreta del rol vigente; Hospital/Alcaldía no se convierten en un superusuario compartido.
- Cuenta revocada/deshabilitada o capacidad retirada: denegación en servidor con retirada de datos en UI.

El caso legado AC-15 exige D-02. Recomendación: una cuenta con Patient pero sin aprobación no obtiene la experiencia ni APIs hasta una reconciliación administrativa auditada. El test no prueba que una solicitud nueva PENDING pueda entrar: la cuenta nueva permanece deshabilitada.

## 9. Tenant isolation y ownership

Cada operación de datos utiliza el contexto confiable withTenant y el rol runtime aprobado, con filtros/composite FKs y RLS/FORCE. Las políticas se verifican por catálogo y por comportamiento con el rol que realmente usa la aplicación.

Probar lectura por ID, listados, cursores, búsquedas, decisiones, replay, auditoría y relaciones entre TEST_A y TEST_B. Comparar dos consultas where tenantId no demuestra RLS por sí solo. No usar SUPERUSER/BYPASSRLS para que pase una suite de permisos.

Resolver actor institucional no acepta la organización/tenant enviados por cliente como autoridad. Cambio de institución valida membership y revoca o invalida todo estado anterior conforme a la política aprobada.

## 10. Auditoría requerida

Familias a verificar contra el enum/eventos reales antes de escribir migraciones: creación de solicitud, replay/conflicto, listado/detalle autorizado y denegado, decisión, intento/resultado de provisión, vinculación/desvinculación, login/denegación, experiencia permitida/denegada, logout/revocación, recuperación/cambio de método, asignación institucional y ejecución de fixture/cleanup.

Cada evento material conserva actor nominal o SYSTEM/PUBLIC explícito cuando corresponda, timestamp, acción, recurso, tenant/organización, versión/estado anterior/nuevo autorizado, outcome y correlación segura. No registrar password, tokens, cuerpo bruto del proveedor ni contacto/documento innecesarios.

Lectura/escritura y auditoría obligatorias deben tener atomicidad según contrato. En denegaciones, no lanzar una excepción dentro de la misma transacción que revierte el evento que se debía conservar. Probar tanto éxito como denegación y fallo de auditoría; no afirmar que un log de consola sustituye el evento persistido.

## 11. Integraciones y fallas

- IdP OIDC/administración: issuer permitido, client mínimo, conexión/timeout total/reintento acotados; subject devuelto por proveedor.
- DB: transacciones, rol/contexto, constraints, versión e idempotencia. Un fallo no se convierte en una lista o confirmación falsa.
- Provisión distribuida: llamada externa fuera de transacción DB larga; fase final revalida estado/versión. Si falla confirmar, impedir identidad utilizable sin autorización y permitir reconciliación según saga.
- Recuperación: usar capacidad real del IdP con mensajería real aprobada, o proceso administrativo nominal y auditado. Una UI no afirma que envió correo/SMS si no existe proveedor.
- Endpoint o IdP no configurados: indisponibilidad segura y readiness fallida, nunca sesión demo de fallback.

Reproducir timeout OIDC, 5xx continuo, token admin bloqueado, IdP caído, escritura DB fallida después de crear usuario y respuesta tardía después de revocación. El nuevo cliente acotado no corrige automáticamente el cliente Keycloak legado.

## 12. Seguridad y privacidad

CORS exacto por entorno y métodos reales, incluido DELETE donde el contrato lo use; validación de origen/CSRF, cookies HttpOnly/SameSite y Secure en HTTPS; no almacenar tokens en Web Storage. Un entorno HTTP loopback requiere configuración de desarrollo explícita y no certifica cookies de entrega HTTPS.

Proxy confiable acotado; no aceptar cualquier X-Forwarded-For como identidad del cliente. Cuotas por finalidad y logout/revocación operables con login limitado. No enumerar usuarios por error público, búsqueda o recuperación.

Acotar validación, tiempo y reintentos; sanitizar logs; comandos de test verifican host/puerto/DB/realm/labels/ownership antes de una escritura. Un .env encontrado no prueba que sea el entorno correcto.

TTL/idle, MFA, concurrencia de sesiones, recuperación y cambios sensibles quedan concretos en D-03. No imponer sin aprobación el TTL global de 30 días de C a perfiles privilegiados. Revocación crítica inmediata mantiene el contrato aprobado del acceso.

## 13. Accesibilidad y UX

Conservar diseño/prototipo aprobados fuera de su runtime. Formularios con labels/instrucciones, mensajes de error por campo, foco predecible, teclado, loading accesible y bloqueo durante envío. Selector de perfil/experiencia comprensible y sin color como única señal.

Modales contienen Tab/Shift+Tab, permiten Escape según contrato y devuelven foco; listados conservan controles montados durante carga. Revisar 320 px, lector/semántica y axe. Si un cambio material de UX exige Claude Design conforme a docs, documentarlo antes de implementarlo; no rediseñar por conveniencia.

## 14. Ámbito de archivos previsto

La allowlist final se fija por SHA y micro-paquete, no por todo el repositorio.

- API: apps/api/src/human-auth/, identity-access/, institutional-auth/, access-requests/ y la rama legada dentro de patients/ cuando exista en la base elegida.
- Datos/infraestructura: nuevas migraciones específicas; prisma/schema.prisma solo si el contrato institucional aprobado lo requiere; config/environment y el catálogo runtime/RLS correspondiente.
- Web: app de acceso y portales; features/access/, auth/, inscripcion/, paciente/, profesional/, caregiver/ y puertas Hospital/Alcaldía cuando lo exija el paquete.
- Herramientas: tools/identity-provisioning/ o herramienta de seed aislado aprobada, scripts/testing/, tests API/DB/web/E2E focales.
- Documentación: spec/plan/tasks/history y decisiones/handoffs canónicos de esa tarea; contexto docs solo dentro de la corrección aprobada.

ACC-01 deberá enumerar archivos exactos existentes para cada paquete. Si falta un módulo, esa creación se especifica; no importar archivos del escritorio automáticamente.

## 15. Archivos y acciones prohibidos

prototype-claude/, tasks/, reviews/, main, secretos/versionado de credenciales, datos reales, archivos ajenos al paquete, cambios de stack, pagos/reglas clínicas/integraciones no aprobados y migraciones históricas. Una corrección histórica excepcional necesita autorización específica; preferir una migración nueva cuando sea compatible.

No modificar AGENTS.md/CLAUDE.md para eludir gates. No confirmar consentimiento ni ejecutar cleanup global. Git/producción requieren su autorización y no están implícitos en un PASS técnico.

## 16. Micro-paquetes y evidencia de cierre

Cada paquete implementa y prueba un alcance acotado; no se inicia el siguiente antes de resolver los hallazgos necesarios. ACC-07 reutiliza lo establecido por ACC-05 y la revisión institucional; no crea otro sistema de identidad.

| Paquete | Objetivo | Dependencias/decisión | Cambio previsto | Criterio verificable |
|---|---|---|---|---|
| ACC-01 | Fijar contrato, base y matriz de permisos | S00; D-01/D-02 | Reconciliar 025/038/027, handoffs y registro legacy; identificar guards, modelo de membership y todos los endpoints activos. | Spec canónica suficiente, decisiones y allowlist por paquete; no permisos inferidos de UI. |
| ACC-02 | Cerrar rutas y fuentes demo | ACC-01 | Sustituir entradas con sesión ficticia, listas de usuarios estáticos y fallbacks de éxito; conservar prototipo y mocks de unitarias. | Login siempre consulta IdP/backend; URLs directas y banderas/query no conceden acceso; imágenes verificadas con modos demo apagados. |
| ACC-03 | Registro y solicitud persistentes | ACC-01, ACC-02 | Tres perfiles, validación por paso/cuerpo discriminado, snapshot sin contraseña, idempotencia/doble submit, POST y referencia opaca; campos bloqueados durante envío. | PENDING visible tras recarga y para revisora autorizada; password no llega al snapshot/log; duplicado/fallo/reintento correcto. |
| ACC-04 | Revisión Hospital atribuible | ACC-03; D-02 | Listado/búsqueda/filtros/keyset, detalle mínimo, versión y decisión por actor individual; separar creator/reviewer/tenant. | Decisión guardada y auditada; conflicto concurrente 409 controlado; rol incorrecto y tenant ajeno denegados; no autoasignación. |
| ACC-05 | Provisión OIDC y reconciliación legada | ACC-04 | Guardar issuer+sub real; usuario deshabilitado antes de aprobar; saga y compensación/reintento acotados; eliminar UUID usado como sub y éxito tras fallo proveedor; timeout en unidades correctas. | APPROVED solo tras confirmar IdP/DB; 5xx sostenido termina; sin huérfano activo ni vínculo erróneo; replay seguro y pruebas con IdP real. |
| ACC-06 | Login, experiencias y acceso directo | ACC-05 | Callback seguro, allowlist returnTo, selector por aprobación, contexto de participación y guards de recursos; /paciente directo y self-scope con aprobación compatible. | Los tres perfiles solo abren su experiencia; cuenta activa sin APPROVED se deniega según D-02; no se une permiso de varios perfiles. |
| ACC-07 | Acceso institucional nominal | ACC-01, ACC-04, ACC-05; D-02 | Usar identidad OIDC verificada y asignación institucional/capacidad; conservar fronteras Hospital/Alcaldía y guards por acción; migrar sesión institucional según compatibilidad aprobada. | Hospital/Alcaldía funcionan con credenciales reales de test y actor individual; paciente/scheduler no se convierten en reviewer; revocación de membership corta acceso. |
| ACC-08 | Sesiones, revocación, origen y cuotas | ACC-06, ACC-07; D-03 | TTL/idle/cookies; suspensión/desvinculación; logout server/IdP según contrato; CORS DELETE, CSRF, trust proxy acotado, logout independiente del bucket de login y limpieza de caché. | Siguiente petición revocada denegada; respuesta tardía no repuebla datos; origen adverso denegado; logout funciona con cuota agotada; dos sesiones y cambio de contexto probados. |
| ACC-09 | Recuperación y MFA reales | ACC-08; D-03 | Flujo IdP aprobado: recuperación automática solo con proveedor real configurado, o procedimiento administrativo nominal auditado; rotación de sesión/MFA de perfiles privilegiados. | Credencial anterior deja de servir según política y sesiones afectadas se invalidan; no toast de correo enviado sin envío; MFA probado realmente. |
| ACC-10 | Seed idempotente y accesos para testear | ACC-05, ACC-07, ACC-09; D-04 | Provisionar casos AC-01 a AC-28 con runId, datos ficticios, relaciones/asignaciones explícitas, claves por cuenta y entrega local protegida; usar aprobación administrativa auditada para precarga. | 28 escenarios preparados y vínculos verificados; archivo de accesos ignorado y protegido; segundo seed no duplica; cleanup no borra terceros/auditoría. |
| ACC-11 | Matriz integrada de acceso y regresión | ACC-10 | E2E con navegador/IdP/DB reales, permisos A/B, fallos externos, concurrencia, persistencia, APIs directas, recuperación/logout y accesibilidad. | Cero omitidos en matriz crítica; prueba apunta al SHA/imagen exactos; sin interceptores que suplanten autenticación/datos en aceptación. |
| ACC-12 | Auditoría y aceptación del hito | ACC-11 | Codex compara implementación/evidencias con spec, registra hallazgos y verifica correcciones; PO prueba cuentas de cada perfil e institución. | Criterios S01 verdes; credenciales entregadas seguras; aceptación PO e integración Git separadas; ninguna capacidad pendiente presentada como cerrada. |

## 17. Criterios EARS y pruebas exigidas

| Criterio | Prueba/evidencia |
|---|---|
| CUANDO una persona completa registro válido, EL SISTEMA guarda una única solicitud PENDING sin otorgar acceso de negocio | API real + DB + doble submit/replay/reinicio; referencia y snapshot mínimo |
| CUANDO una cuenta pendiente/rechazada/suspendida/revocada intenta entrar, EL SISTEMA deniega portal y API del perfil solicitado | Casos negativos; URL directa y endpoint, no solo navegación |
| CUANDO Hospital aprueba, EL SISTEMA persiste actor/decisión y confirma IdP antes de APPROVED | Dos sesiones, revisión real, sub emitido y auditoría DB; fallo distribuido |
| CUANDO IdP falla, EL SISTEMA termina con error seguro y estado reintentable, sin APPROVED falso | 5xx sostenido, timeout/token bloqueado, fallo tras creación y reconciliación |
| CUANDO una cuenta válida entra por otra superficie, EL SISTEMA deniega sin aumentar sus permisos | Paciente→Hospital/Alcaldía; scheduler→review; Municipalidad→clinical |
| CUANDO se accede a paciente/visita de otro tenant, EL SISTEMA deniega y no sirve datos | TEST_A/TEST_B en IDs, listas, cursores, búsquedas, export y respuestas directas |
| CUANDO se revoca sesión/cuenta/membership, EL SISTEMA deniega la siguiente petición y retira estado sensible | Sesión abierta, dos pestañas, logout y respuesta tardía |
| CUANDO un cuidador no tiene vínculo o un profesional no tiene asignación, EL SISTEMA permite solo la portada aprobada y no recursos ajenos | AC-02/AC-05, scopes mínimos, expiración de relación/afiliación |
| CUANDO se recupera cuenta, EL SISTEMA aplica el flujo real aprobado e invalida credenciales/sesiones según política | IdP, canal/procedimiento efectivo, MFA y prueba posterior; cero mensajes de envío simulado |
| CUANDO se repite seed/cleanup, EL SISTEMA conserva ownership e idempotencia sin borrar registros ajenos | Ejecución aislada, runId/resources, auditoría y segundo seed |

Tipos/lint/build/secrets-scan y gates complementan unidades, integración, DB, permisos, aislamiento, accesibilidad y E2E. Todo test crítico se ejecuta sin skip ni return verde por falta de DB. La aceptación E2E no intercepta con éxito fijo los endpoints de autenticación/decisión/provisión.

AC-01–AC-28 se materializan como escenarios de fixture. AC-29–AC-32 quedan para los contratos de administración/finanzas/auditoría posteriores. Escenarios adicionales incluyen CSRF/CORS, destino externo, issuer/audience falsos, replay de callback, sesión expirada, proveedor no configurado y cuota agotada.

## 18. Migración, rollback, compatibilidad y operación

Inventariar esquema/migraciones realmente aplicados antes de planear cambios. No corregir una identidad vinculada erróneamente sobrescribiendo sub sin procedencia y auditoría; preparar reconciliación verificable con el proveedor.

Introducir el contrato nominal institucional de forma compatible o con una transición controlada explícita. Sesiones/cookies antiguas no permanecen como vía de bypass. Registrar cuentas que deben aprobarse/reconciliarse en lugar de activar todas en un batch no revisado.

Ensayar rollback funcional, fallas de saga, reintento e idempotencia en entorno aislado. No retirar FORCE RLS ni ampliar grants como solución a fixtures que no funcionan. Backup/restore de identidad y MERDN se coordina; inconsistencias de vínculo producen fallo cerrado hasta reconciliación.

Entregar readiness efectiva de DB/tenant/IdP/configuración. Una página que responde 200 no prueba que pueda autenticarse. Registrar URL/puerto, SHA/imagen de web/API y realm de prueba verificados, sin secretos.

## 19. Decisiones aprobadas y abiertas

**Definido por la petición actual:** funcionamiento real; accesos primero; datos ficticios para test; división por secciones y ramas; preservar el alcance estratégico. No se modifica el rol de Codex como arquitecto/auditor ni se autoriza implementar todo directamente.

**Pendiente antes de implementación afectada:** D-01 repo/base; D-02 actor institucional/tenancy/compatibilidad legado; D-03 TTL/idle/MFA/recuperación; D-04 entorno/seed/cleanup/secret delivery. Reutilizar decisiones aprobadas en la base elegida cuando sean suficientes y consistentes; solicitar únicamente las que realmente falten.

Riesgos residuales a probar: rama candidata con entrega aún no auditada, identidad nominal institucional incompleta, coexistencia de dos registros, diferencias de políticas de sesión, catálogos RLS desactualizados, pruebas históricas con falsos verdes y servidor viejo en un puerto reutilizado.

## 20. Handoff y aceptación

Claude debe devolver: spec/paquete/allowlist; base y HEAD; archivos cambiados; migraciones/compatibilidad; resultados y comandos; matriz de cuentas sin secretos; evidencia IdP/DB de estados; eventos auditados; permisos/tenants/fallas/concurrencia; accesibilidad; pruebas omitidas con causa; riesgos y decisiones.

El archivo privado de acceso se entrega al Product Owner fuera de Git y se verifica que sus cuentas efectivamente funcionan o se deniegan según el caso. Codex no certifica una credencial solo porque está escrita en un catálogo.

Codex audita ACC-11/12 y las correcciones; Product Owner prueba al menos los tres perfiles humanos y Hospital/Alcaldía y acepta o rechaza. Solo después se considera el hito de acceso completo, y la integración requiere la autorización aplicable.
