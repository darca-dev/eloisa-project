# Especificación 022 - Sesión institucional Alcaldía MVP

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado`
- Fecha de aprobación / Approval date: `2026-08-27`
- Aprobado por / Approved by: `Product Owner`
- Evidencia de aprobación / Approval evidence: autorización explícita del Product Owner en sesión del 2026-08-27: «APRUEBO Y DOY CONSENTIMIENTO PARA SPEC 022 ALCALDÍA MVP», sobre el alcance cerrado de esta spec.

> Esta spec está aprobada y consentida. El consentimiento específico está
> registrado en `.sdd/user-consent.log` y la compuerta SDD confirma la 022.
> Esto autoriza únicamente su implementación dentro de la allowlist; no autoriza
> commit, push, merge ni despliegue.

## Objetivo

Conectar legítimamente a una persona usuaria institucional con rol
`MUNICIPAL_VIEWER` a las dos vistas operativas existentes de Alcaldía —Población
y Territorio— reutilizando la autenticación institucional, la cookie HttpOnly,
la revocación, los guards, tenant/RLS, auditoría y agregados protegidos ya
implementados. Las otras once vistas permanecen demostrativas y no forman parte
del slice operativo.

## Historia de usuario principal

Como persona autorizada de una Alcaldía, quiero iniciar y recuperar una sesión
institucional y consultar Población y Territorio de mi institución, para acceder
a agregados reales sin exponer datos nominales ni confundir contenido
demostrativo con una capacidad operativa.

## Alcance funcional

1. `/municipality` consulta `GET /api/v1/institutional/sessions/current` al montar.
2. Sin sesión vigente muestra una entrada institucional accesible que solicita
   únicamente `identityCode` y `accessSecret`.
3. La entrada usa `POST /api/v1/institutional/sessions`; el token solo existe en
   la cookie `merdn_institutional_session` HttpOnly administrada por el navegador.
4. Tras abrir sesión, la interfaz vuelve a consultar `current` y solo habilita
   el slice si el rol confirmado es exactamente `MUNICIPAL_VIEWER`.
5. Una sesión de otro rol no abre Alcaldía ni revela si existen agregados.
6. Población y Territorio siguen consumiendo exclusivamente sus APIs de spec 008.
7. El cierre usa `DELETE /api/v1/institutional/sessions/current`. Solo `204` o
   `401` confirman ausencia de sesión. Ante fallo, la interfaz conserva el
   contexto visible y permite reintentar sin anunciar falso éxito.
8. Se representan `consultando`, `sin sesión`, `credenciales inválidas`,
   `rol no autorizado`, `sesión expirada/revocada`, `error/no disponible`,
   `cerrando` y `cierre fallido`, con reintento donde corresponda.
9. Las once vistas fuera del slice —Inicio, Programas, Presupuesto, Evidencias,
   FURAG/MIPG, ADRES, Derecho al cuidado, Brechas, Cuidadores y formación,
   Indicadores y Reportes— permanecen explícitamente demostrativas. No se
   convierten en operativas, no reciben datos nuevos y no se borran.

## Decisión técnica cerrada: reutilización del cliente institucional

La lógica genérica hoy alojada en
`features/hospital/hospitalInstitutionClient.ts` se mueve al módulo compartido
`features/auth/institutionalSessionClient.ts`. Hospital conserva una fachada
compatible en su ruta actual. Alcaldía consume el módulo compartido; no importa
desde Hospital y no duplica validación, mensajes de seguridad ni transporte.
Esto no cambia endpoints, cookie, backend ni arquitectura de autenticación.

## Escenarios de aceptación

1. Dada una sesión `MUNICIPAL_VIEWER` vigente, al abrir `/municipality`, se
   recupera el contexto y Población/Territorio consultan datos agregados reales.
2. Sin sesión, expirada, revocada o manipulada, la misma superficie neutra niega
   acceso y no monta datos operativos.
3. Con sesión `HOSPITAL_PATIENT_VIEWER`, `HOSPITAL_SCHEDULER` u otro rol, Alcaldía
   queda denegada y no se ejecutan las consultas municipales.
4. Con credenciales inválidas, la respuesta visible es uniforme y no permite
   enumerar identidad, institución, rol ni tenant.
5. Si falla la red al recuperar o abrir sesión, aparece un error accesible y un
   reintento real; no se muestran fixtures como sustitución.
6. Si el logout falla, no se anuncia éxito ni se retira falsamente la sesión; si
   se confirma con `204` o `401`, se eliminan los agregados visibles y se vuelve
   a la entrada institucional.
7. Cambiar entre Población y Territorio conserva foco accesible y sesión; una
   respuesta `401/403` posterior expulsa el slice operativo de forma fail-closed.
8. Ninguna de las once vistas demostrativas se presenta como dato operativo.

## Criterios de aceptación EARS

- CUANDO se monte `/municipality`, EL SISTEMA DEBERÁ recuperar la sesión desde
  el servidor antes de mostrar Población o Territorio operativos.
- SI el contexto no es una sesión vigente `MUNICIPAL_VIEWER`, ENTONCES EL
  SISTEMA NO DEBERÁ montar ni solicitar los agregados municipales.
- CUANDO se envíe la entrada, EL SISTEMA DEBERÁ transmitir únicamente
  `identityCode` y `accessSecret`, con `credentials: include`, sin persistirlos.
- CUANDO el servidor confirme el logout, EL SISTEMA DEBERÁ retirar contexto y
  datos municipales; SI no lo confirma, DEBERÁ conservarlos y permitir reintento.
- SI una API municipal responde `401` o `403`, ENTONCES EL SISTEMA DEBERÁ
  invalidar la experiencia operativa sin distinguir información sensible.
- CUANDO cambie el estado principal, EL SISTEMA DEBERÁ anunciarlo mediante
  semántica accesible y gestionar el foco sin depender solo del color.
- EL SISTEMA NO DEBERÁ aceptar tenant, municipio, rol ni sujeto desde el cliente
  como fuente de autorización.
- EL SISTEMA NO DEBERÁ usar datos reales, crear identidad pública, cambiar RLS,
  relajar guards ni añadir una arquitectura de autenticación nueva.

## Seguridad, privacidad, tenant y auditoría

- Autenticación y revocación: superficie institucional existente; mismo origen,
  cookie HttpOnly/SameSite/Secure según entorno y token server-side hasheado.
- Autorización: `MUNICIPAL_VIEWER` se confirma en servidor; los guards de los
  agregados siguen siendo la autoridad, nunca la UI.
- Tenant: deriva de la sesión institucional. Todas las lecturas conservan filtro
  explícito y `PrismaService.withTenant()` con RLS; ningún selector cliente.
- Auditoría: se reutilizan `INSTITUTIONAL_SESSION_CREATED`,
  `INSTITUTIONAL_SESSION_REVOKED` y los eventos de acceso municipal existentes.
  No se crea enum, migración ni evento nuevo.
- Minimización: el contexto visible se limita al contrato existente; nunca se
  muestran tenantId, identityId, secreto, token, conteos suprimidos ni PII.
- Fallo seguro: no hay fallback a fixtures, rol alterno, tenant por defecto ni
  sesión almacenada en localStorage/sessionStorage/IndexedDB/URL.

## Datos y procedencia

| Dato | Fuente | Persistencia/propiedad |
|---|---|---|
| Contexto institucional | `GET /api/v1/institutional/sessions/current` | Sesión server-side existente; institución/tenant propietario |
| Población agregada | `/api/v1/municipality/population-summary` | PostgreSQL real, tenant/RLS y supresión de spec 008 |
| Territorio agregado | `/api/v1/municipality/territory-summary` | PostgreSQL real, tenant/RLS y supresión de spec 008 |
| Once vistas restantes | fixtures rotulados existentes | Demostrativas; fuera del slice operativo |

Solo se permiten identidades y datos ficticios/controlados en pruebas y MVP.

## Ámbito de archivos / Allowlist

### Micro-paquete A — cliente compartido y fachada Hospital

- `apps/web/src/features/auth/institutionalSessionClient.ts`
- `apps/web/src/features/auth/institutionalSessionClient.test.ts`
- `apps/web/src/features/hospital/hospitalInstitutionClient.ts`
- `apps/web/src/features/hospital/hospitalInstitutionClient.test.ts`
- `apps/web/src/features/hospital/hospitalAlcance.test.ts`

### Micro-paquete B — gate y sesión municipal

- `apps/web/src/features/municipality/MunicipalityShell.tsx`
- `apps/web/src/features/municipality/municipalitySession.tsx`
- `apps/web/src/features/municipality/municipalitySession.test.tsx`
- `apps/web/src/features/municipality/municipality.module.css`
- `apps/web/src/features/municipality/municipalityShell.test.tsx`
- `apps/web/src/features/municipality/municipalityPrivacidad.test.tsx`
- `apps/web/src/app/municipality/page.tsx`

### Documentación

- Documentación de esta spec bajo `spec/specs/022-sesion-institucional-alcaldia-mvp/`

## Denylist

- `apps/api/**`, `prisma/**`, `package.json`, `package-lock.json`, `tsconfig*`
- APIs, guards, cookies, tablas, RLS, migraciones y enums existentes
- Las implementaciones de las once vistas demostrativas y `municipalityConfig.ts`
- `prototype-claude/**`, `main`, datos reales y cualquier secreto/configuración local

## Pruebas requeridas

1. Cliente compartido: recuperación, entrada, cierre, cancelación, errores,
   validación uniforme, cuerpo cerrado y ausencia de persistencia cliente.
2. Fachada Hospital: compatibilidad exacta y regresión Hospital completa.
3. Shell municipal: estados, rol exacto, no monta agregados antes de
   autorización, logout seguro, retry, sesión expirada y foco/live regions.
4. Población/Territorio: ejecutar sus pruebas existentes, sin modificarlas;
   siguen sin fallback a fixtures ante `401/403/error`.
5. Regresión municipal completa, web typecheck, lint focal y `git diff --check`.
6. Navegador real: entrada, recuperación, cambio Población/Territorio, teclado,
   cuatro viewports aplicables, expiración y logout exitoso/fallido. Si no hay
   navegador controlable: `BLOCKED_BROWSER_ACCESS`, sin declarar aceptación visual.

## Dependencias y cambios técnicos

- Dependencias funcionales: specs 005, 008 y la autenticación institucional
  existente nacida en 008 y ampliada por 014.
- Dependencias nuevas: ninguna.
- Backend/API/esquema/migración: ninguno.
- Configuración: usa las identidades `MUNICIPAL_VIEWER` aprovisionadas mediante
  variables locales existentes; no versiona secretos.

## Fuera de alcance

- Hacer operativas las otras once vistas.
- Crear, editar, exportar o persistir programas, presupuesto, evidencia o reportes.
- OIDC humano, autorregistro, recuperación de credenciales o administración de identidades.
- Cambiar supresión, métricas, fórmulas, permisos, RLS, auditoría o contratos API.
- Despliegue, datos reales o afirmación de cumplimiento oficial.

## STOP CONDITIONS

1. La sesión existente no puede reutilizarse sin cambiar backend, cookie o contrato.
2. Se requiere una dependencia, migración, API, guard, permiso o evento nuevo.
3. Un rol distinto de `MUNICIPAL_VIEWER` obtiene acceso o se consulta un agregado antes de autorizar.
4. Se requiere tocar una vista demostrativa, `municipalityConfig.ts` o datos reales.
5. Hospital pierde compatibilidad o aparece una regresión no preexistente.
6. La spec no está aprobada o no tiene consentimiento registrado.

## Criterios de éxito

- Población y Territorio son accesibles únicamente con sesión municipal legítima.
- Recuperación, expiración y logout son reales y fail-closed.
- Tenant/RLS, auditoría y supresión permanecen intactos.
- Ninguna vista demostrativa se presenta como operativa.
- Todas las pruebas automáticas pasan; la evidencia de navegador se distingue claramente.
