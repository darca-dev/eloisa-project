# IDENTITY-RELATIONSHIPS-CORE-01 — Owner Decision Packet

## Approval record — 2026-08-23

El Product Owner aprobó en bloque estas decisiones con una condición
vinculante posterior: ninguna dependencia OIDC externa puede bloquear el MVP
local/controlado. Codex cerró esa condición manteniendo un único contrato OIDC
estándar y usando un Keycloak local desechable para desarrollo/pruebas; Entra
External ID queda diferido como configuración futura. La resolución ejecutable
está en `tasks/IDENTITY-RELATIONSHIPS-CORE-01-CLAUDE-PACKET.md` y prevalece sobre
las referencias anteriores que exigían un tenant Entra no productivo.

## 1. Propósito y límite

Este paquete convierte las decisiones abiertas de
`IDENTITY-RELATIONSHIPS-CORE-01` §17 en una propuesta única para aprobación del
Product Owner.

Su objetivo es desbloquear con el menor alcance seguro:

- Profesional/Visitador;
- Paciente;
- Cuidador;
- convivencia con Hospital;
- los gates 1 y 2 de `VISITS-CORE-01`.

Las recomendaciones se limitan al MVP de MERDN con datos exclusivamente
ficticios o controlados. No autorizan datos reales, producción clínica ni la
implementación de este paquete. No modifican ni rediseñan `VISITS-CORE-01`.

> Nota de cierre: §17 contiene seis grupos de decisión solicitados más una
> exigencia de validación/procedencia. Para no dejar un STOP CONDITION abierto,
> la procedencia se resuelve dentro de la decisión 3.

## 2. Principio de mínima arquitectura

La propuesta reutiliza:

- Entra External ID y OIDC ya recomendados en Arquitectura/Seguridad;
- `Person`, `Patient` y `ProfessionalProfile` canónicos;
- `InstitutionalIdentity`/`InstitutionalSession` para una autoridad
  institucional limitada del MVP;
- tenant activo, `withTenant`, RLS y grants actuales;
- auditoría append-only y sesiones opacas con token hash;
- `ProfessionalAffiliation` y `CareAssignment` para autorización profesional.

No crea un sistema general de IAM, directorio, organizaciones, consentimientos,
documentos, representación legal o administración delegada.

## 3. Decisión 1 — Proveedor OIDC

### RECOMMENDED OPTION

Usar **Microsoft Entra External ID real en un tenant no productivo**, mediante
un adapter OIDC/OAuth 2.0 con Authorization Code + PKCE. La implementación debe
ser configurable y fallar cerrada si issuer, audience, client o JWKS no están
disponibles. Tests unitarios/integración usan un emisor OIDC de prueba
determinista; no se crean passwords ni un proveedor MERDN.

Para el MVP solo se habilitan cuentas ficticias/controladas creadas por el
Product Owner/equipo autorizado en ese tenant. Sin recuperación personalizada,
federación hospitalaria, social login, refresh tokens ni MFA propio de MERDN.

### WHY

- Es la decisión tecnológica ya documentada; evita una arquitectura paralela.
- Proporciona identidad externa verificable para los cuatro actores sin
  almacenar contraseñas.
- Un adapter con configuración fail-closed permite implementar y probar aunque
  la activación de un entorno dependa de credenciales externas.
- Un “mock login” desplegado no sería una identidad humana confiable y no
  desbloquearía honestamente Visits.

### MVP IMPACT

- Requiere un tenant Entra no productivo, application registration, redirect
  URIs exactos y secretos/configuración fuera de Git.
- Un único flujo autentica humanos; los perfiles y permisos siguen locales.
- Ausencia o error de configuración deshabilita login humano sin degradar a un
  bypass.
- No cambia las sesiones institucionales ni de inscripción existentes.

### DEFERRED PRODUCTION REQUIREMENT

Antes de datos reales/PROD: tenant y contratos productivos, dominio verificado,
MFA según riesgo, recovery y soporte, assurance formal, políticas de acceso,
monitoring, rotación de secretos/certificados, revisión de residencia y
tratamiento de datos, disponibilidad/SLA, pruebas de federación y respuesta a
incidentes. La configuración no productiva no se promociona a PROD.

## 4. Decisión 2 — Linking cuenta humana → Person

### RECOMMENDED OPTION

Usar **provisioning controlado, previo y allowlisted**, sin endpoint público de
linking. Un manifiesto de configuración fuera del repositorio, aplicado por un
comando idempotente de provisioning, contiene únicamente:

- tenant code configurado;
- `Person.id` existente y opaco;
- issuer allowlisted;
- subject OIDC opaco;
- estado activo.

El comando crea/reutiliza `HumanAccount` y `ExternalAuthIdentity` dentro de una
transacción tenant-aware y registra auditoría. Solo permite `Person` existente
del tenant activo. No busca ni enlaza por email, documento, nombre, teléfono o
claims. No usa ni canjea `EnrollmentSession`.

El manifiesto y el comando son exclusivamente mecanismos de bootstrap del MVP;
no son una pantalla de administración ni un flujo de autoservicio.

### WHY

- Es el flujo más corto que evita account takeover por coincidencias débiles.
- Reutiliza `Person` y no obliga a construir ahora invitaciones, recuperación,
  directorio o verificación documental.
- Es suficiente para un conjunto pequeño y conocido de usuarios ficticios del
  MVP.
- Mantiene separadas autenticación externa y autorización MERDN.

### MVP IMPACT

- Cada usuario humano del demo debe existir primero como `Person` y ser
  incluido explícitamente en el provisioning.
- Linking/unlinking no se ofrece a usuarios finales.
- Un subject solo puede vincularse una vez por tenant+issuer; conflictos fallan
  cerrados y son auditables.
- El secreto/configuración de provisioning no se registra ni se expone por API.
- Desvincular o deshabilitar requiere la misma operación controlada y revoca
  sesiones humanas afectadas.

### DEFERRED PRODUCTION REQUIREMENT

Este bootstrap **bloquea alta masiva y operación con datos reales**. Antes de
PROD se requiere un flujo gobernado de invitación/linking/unlinking, prueba de
identidad apropiada, segregación de funciones, aprobación individual,
recuperación segura, manejo de duplicados/fusión, notificación, soporte,
revisión de assurance y auditoría del operador humano. Nunca se habilitará
auto-link por email/documento sin una decisión distinta y controles formales.

## 5. Decisión 3 — Quién valida/revoca Patient–Caregiver

### RECOMMENDED OPTION

Para el MVP controlado, crear un **rol institucional dedicado y mínimo**:
`CAREGIVER_RELATIONSHIP_MANAGER`, aprovisionado mediante el mecanismo existente
de `InstitutionalIdentity` y autenticado con `InstitutionalSession`.

Ese rol puede únicamente:

1. crear una relación en `PENDING_VALIDATION`;
2. activarla con el catálogo aprobado en la decisión 5;
3. revocarla;
4. consultar el resultado mínimo necesario para esa gestión.

No puede actuar como Profesional/Visitador, Paciente o Cuidador; no puede usar
Visits, clínica, dirección, documentos, exportaciones ni otras superficies de
Hospital. `HOSPITAL_SCHEDULER` no obtiene esta capacidad.

La validación MVP se sustenta con procedencia estructurada mínima, sin archivos:

- `validationSource = CONTROLLED_MVP_OPERATOR_ASSERTION`;
- identificador opaco de la identidad institucional;
- `validatedAt` server-side;
- `authorizationReference` opaca, no secreta y sin PII, obligatoria;
- para revocación: fecha, actor y reason code controlado.

La referencia no demuestra representación legal, parentesco, capacidad o
consentimiento clínico. Solo documenta una decisión operativa sobre datos
ficticios/controlados.

### WHY

- Reutiliza identidad, sesión, guards, provisioning y auditoría institucionales
  ya construidos.
- Evita introducir ahora roles/capabilities humanas generales solo para
  administrar una relación.
- Mantiene separación de funciones respecto de `HOSPITAL_SCHEDULER`.
- Es honesto sobre la autoría: el audit identifica a la identidad institucional,
  no finge conocer a una persona operadora.

### MVP IMPACT

- Habrá una credencial institucional adicional y estrechamente autorizada por
  tenant MVP.
- Alta/activación/revocación son manuales y de bajo volumen.
- Mutación de relación y AuditEvent deben ser atómicos.
- Revocación elimina acceso futuro desde la siguiente petición, aun con sesión
  humana viva.
- No se cargan documentos ni PII de soporte.

### DEFERRED PRODUCTION REQUIREMENT

La identidad institucional compartida **no es suficiente para datos reales ni
PROD**. Antes de eso se requiere administrador humano individual autenticado,
MFA, capacidad contextual de mínimo privilegio, segregación/aprobación cuando
corresponda, política jurídica y de privacidad, prueba/evidencia autorizada,
retención, tipos de representación, menores/capacidad, conflictos, apelación,
notificación y autoría individual completa. También debe decidirse qué
institución es competente para validar cada vínculo.

## 6. Decisión 4 — Tenant como frontera institucional temporal

### RECOMMENDED OPTION

Aprobar que, **solo para este MVP controlado y este slice**, el tenant activo es
la única frontera institucional ejecutable. Toda cuenta, sesión, persona,
perfil, relación, scope y auditoría pertenece al mismo `tenantId` resuelto por
servidor.

No se crea `Institution`, `Organization`, sede, selector de contexto ni acceso
interinstitucional. La documentación y los nombres deben decir “frontera
institucional temporal del MVP”, nunca afirmar que Tenant e Institución son el
mismo concepto definitivo.

### WHY

- Coincide con el estado del esquema y `TenantContextService` actuales.
- Evita introducir el dominio de organizaciones antes de necesitarlo.
- Permite FKs compuestas, RLS y auditoría coherentes hoy.
- El MVP usa un tenant/despliegue controlado y no necesita movilidad entre
  instituciones.

### MVP IMPACT

- Todos los usuarios y relaciones del demo se mantienen en un único contexto
  institucional por tenant.
- No hay elección/cambio de institución ni relaciones entre instituciones.
- Un identificador de otro tenant es indistinguible de inexistente.
- Hospital y los actores humanos conviven en esa frontera sin compartir clase
  de principal.

### DEFERRED PRODUCTION REQUIREMENT

Esta decisión **bloquea producción multiinstitucional, redes de prestadores y
datos reales que requieran distinguir responsables dentro de un tenant**. Antes
de esos escenarios se debe modelar Institución/Organización, afiliaciones y
autoridades por institución, sedes/unidades, contexto activo, ownership,
intercambios autorizados, migración de relaciones existentes y RLS/policies por
organización además de tenant.

## 7. Decisión 5 — Catálogo mínimo de finalidades/permisos

### RECOMMENDED OPTION

Aprobar exactamente este catálogo cerrado para el MVP:

| Dimensión | Valores permitidos |
| --- | --- |
| Relationship type | `DECLARED_CARE_SUPPORT` |
| Purpose | `HOME_CARE_COORDINATION` |
| Status | `PENDING_VALIDATION`, `ACTIVE`, `REVOKED`, `EXPIRED` |
| Scope | `VISITS_VIEW` (`visits.view`) |
| Revocation reasons | `AUTHORIZATION_WITHDRAWN`, `RELATIONSHIP_ENDED`, `CREATED_IN_ERROR` |

Transiciones únicas:

- creación → `PENDING_VALIDATION`;
- `PENDING_VALIDATION → ACTIVE` por el Relationship Manager;
- `PENDING_VALIDATION | ACTIVE → REVOKED`;
- `ACTIVE → EXPIRED` por `endsAt` alcanzado, evaluado server-side;
- estados `REVOKED` y `EXPIRED` son terminales; una nueva autorización crea un
  nuevo episodio.

Reglas de autorización:

- solo `ACTIVE`, dentro de vigencia, purpose coincidente y `VISITS_VIEW` permite
  ver visitas del paciente relacionado;
- no wildcard, “cuidador total”, herencia por parentesco ni scopes libres;
- `visits.contribute`, `visits.execute`, clínica, agenda write, documentos y
  exportación permanecen denegados/no implementados.

### WHY

- Es el catálogo mínimo que satisface el gate Cuidador de Visits.
- Evita semántica legal o clínica no aprobada.
- Estados terminales y episodios nuevos simplifican historia y auditoría.
- Un único scope reduce superficie de pruebas y riesgo de escalamiento.

### MVP IMPACT

- El Cuidador solo consulta visitas autorizadas; no ejecuta ni aporta.
- Profesional ejecuta por `ProfessionalProfile` + afiliación +
  `CareAssignment`, nunca por esta relación.
- Paciente accede por su propio perfil, no por una relación consigo mismo.
- Relación sin scope exacto, vencida o revocada se deniega inmediatamente.

### DEFERRED PRODUCTION REQUIREMENT

Antes de ampliar producto/usar datos reales: catálogo versionado de finalidades
y scopes, reglas por sensibilidad, consentimientos o fundamento jurídico,
gestión de citas, contribuciones, clínica/documentos, suspensión/revisión,
delegación, conflictos, expiración/notificación y gobernanza de cambios. Cada
nuevo permiso requiere Task y pruebas; no se deriva automáticamente de
`VISITS_VIEW`.

## 8. Decisión 6 — Política de sesión humana

### RECOMMENDED OPTION

Política fija para el MVP:

- duración absoluta: **8 horas**;
- timeout de inactividad: **30 minutos**;
- máximo: **1 sesión humana activa por cuenta**;
- token opaco aleatorio; solo hash en DB;
- cookie exclusiva `merdn_human_session`, `HttpOnly`, `Secure` fuera de local,
  `SameSite=Lax`, `Path=/`, sin contenido de identidad;
- rotación al completar login; una nueva sesión revoca la anterior;
- logout revoca server-side y borra cookie;
- disable/unlink de cuenta revoca todas sus sesiones;
- revocar/vencer relación o afiliación no necesita cerrar sesión: la política
  se reevalúa en cada petición y deniega de inmediato;
- sin “remember me”, refresh token persistido, sesiones paralelas, selector de
  dispositivo ni administración de sesiones por UI;
- CSRF/origin en mutaciones y respuestas sensibles `private, no-store`.

### WHY

- Reutiliza el patrón de token hash, expiración, `lastUsedAt` y revocación ya
  probado.
- Una sola sesión reduce complejidad de concurrencia y exposición en el MVP.
- Ocho horas cubren una jornada controlada; 30 minutos limita abandono.
- Reevaluar relaciones/perfiles evita permisos obsoletos en la sesión.

### MVP IMPACT

- Login desde un segundo navegador/dispositivo cierra la sesión anterior.
- El usuario debe volver a autenticarse después del límite absoluto o de
  inactividad.
- Los valores son configuración tipada con defaults exactos del MVP y límites
  validados; no se pueden desactivar con cero/infinito.
- Las tres clases de cookie siguen siendo distintas y no intercambiables.

### DEFERRED PRODUCTION REQUIREMENT

Antes de datos reales/PROD: análisis de riesgo por rol, MFA/step-up, duración y
concurrencia diferenciadas, refresh/reauth controlados, gestión y visualización
de dispositivos/sesiones, revocación distribuida, eventos de riesgo, recovery,
política corporativa/federada, pruebas de carga y monitoreo. Los valores MVP no
son una política PROD.

## 9. Resultado combinado y dependencias

Las seis decisiones forman una sola opción mínima coherente:

```text
Entra External ID no productivo
  → binding allowlisted y preaprovisionado a Person
  → HumanSession 8h/30m/una sesión
  → resolución server-side a Patient o ProfessionalProfile
  → relación Cuidador gestionada por identidad institucional dedicada
  → tenant activo como frontera temporal
  → DECLARED_CARE_SUPPORT + HOME_CARE_COORDINATION + VISITS_VIEW
```

Después de aprobación, Codex puede actualizar el gate de
`IDENTITY-RELATIONSHIPS-CORE-01` y emitir un Claude Packet técnico. La aprobación
no equivale a implementación ni acepta el resultado futuro.

### Desbloquea tras implementación y verificación

- principal humano atribuible para Profesional/Visitador;
- principal propio para Paciente;
- relación autorizada de solo lectura para Cuidador;
- separación segura respecto de Hospital;
- gates de identidad/relación de `VISITS-CORE-01`.

### Sigue bloqueado para datos reales/producción

- IAM y administración humana productivos;
- linking/recuperación con prueba de identidad formal;
- validación individual y fundamento/evidencia de cuidadores;
- organización/institución interna y multiinstitución;
- catálogo ampliado, representación legal, menores y clínica;
- política de sesión, MFA, operación y cumplimiento productivos;
- cualquier uso de datos personales o clínicos reales en el MVP Hostinger no
  autorizado por la arquitectura vigente.

## 10. Propuesta única para aprobación del Product Owner

Se propone aprobar en un solo acto:

1. Entra External ID real en tenant no productivo, adapter OIDC + PKCE y
   fail-closed, solo para identidades ficticias/controladas.
2. Linking previo mediante provisioning allowlisted por `Person.id` + issuer +
   subject, sin endpoint público, auto-link ni EnrollmentSession.
3. `CAREGIVER_RELATIONSHIP_MANAGER` como identidad institucional dedicada del
   MVP, separada de Scheduler, con procedencia
   `CONTROLLED_MVP_OPERATOR_ASSERTION` y referencia opaca obligatoria.
4. Tenant activo como única frontera institucional temporal de este slice.
5. Catálogo cerrado `DECLARED_CARE_SUPPORT` + `HOME_CARE_COORDINATION` +
   `PENDING_VALIDATION/ACTIVE/REVOKED/EXPIRED` + `VISITS_VIEW`, con los tres
   reason codes definidos y sin permisos implícitos.
6. Sesión humana de 8 horas absolutas, 30 minutos de inactividad, una sesión
   activa, rotación/revocación server-side y reevaluación de autorización en
   cada petición.

La aprobación debe entenderse expresamente limitada a datos ficticios o
controlados y no como autorización de producción o datos reales.

---

OWNER DECISIONS READY: YES

RECOMMENDED MVP DECISIONS: Entra External ID no productivo; linking allowlisted y preaprovisionado a Person; CAREGIVER_RELATIONSHIP_MANAGER institucional dedicado con procedencia opaca; tenant activo como frontera institucional temporal; catálogo cerrado DECLARED_CARE_SUPPORT/HOME_CARE_COORDINATION/VISITS_VIEW; sesión 8h absoluta, 30m inactiva y una sesión activa

AFTER APPROVAL IDENTITY-RELATIONSHIPS READY FOR CLAUDE: YES
