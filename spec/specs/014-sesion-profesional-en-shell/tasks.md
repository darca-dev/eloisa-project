# Tareas 014 - Acceso institucional y sesión profesional en el shell

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

### Sesión institucional — API

- [x] `POST /api/v1/institutional/sessions` abre la sesión con
  `InstitutionalSignInRateLimitGuard` e `InstitutionalSameOriginGuard`
  (`apps/api/src/institutional-auth/institutional-auth.controller.ts:82-84`).
- [x] `GET /api/v1/institutional/sessions/current` describe la sesión vigente sin
  guard de rol, admitiendo cualquier rol implementado, con `401` uniforme
  (`institutional-auth.controller.ts:149-212`).
- [x] `DELETE /api/v1/institutional/sessions/current` revoca sin exigir rol, con
  `InstitutionalSameOriginGuard` e `InstitutionalSessionGuard`
  (`institutional-auth.controller.ts:214-266`).
- [x] `InstitutionalSessionGuard` autentica y NO autoriza: `401` uniforme, nunca
  `403`, y publica el principal en la petición
  (`institutional-session.guard.ts:52-101`).
- [x] `InstitutionalSameOriginGuard` exige un origen declarado y presente en
  `API_WEB_ORIGINS`, con denegación por defecto ante ausencia de `Origin` y
  `Referer` (`institutional-same-origin.guard.ts:60-98`).
- [x] Una cabecera de origen mal formada devuelve el valor literal —que nunca
  coincide— en lugar de `null`, para que no pueda convertirse en «sin origen»
  (`institutional-same-origin.guard.ts:84-98`).
- [x] Límite de intentos de 10 por 300 s, con clave = IP remota, sin registrarla
  ni auditarla (`institutional-signin-rate-limit.guard.ts:27-38`).
- [x] Cookie `merdn_institutional_session`: `HttpOnly`, `Path=/`, `SameSite` y
  `Domain` de la topología, `Secure` fuera de desarrollo, `Max-Age` acotado, y
  **solo** el token opaco (`institutional-session.cookie.ts:44-66`).
- [x] La credencial se deriva con `scrypt` (`N=16384, r=8, p=1`, sal de 16 B,
  derivación de 64 B) y se compara en tiempo constante
  (`institutional-secret.ts:47-99`).
- [x] Un código inexistente deriva contra un señuelo para igualar el coste
  temporal con el de una credencial incorrecta
  (`institutional-auth.service.ts:97-98,197-206`).
- [x] `establishSession` devuelve `null` de forma indistinguible ante código
  inexistente, identidad no aprovisionada, identidad deshabilitada y credencial
  incorrecta (`institutional-auth.service.ts:158-212`).
- [x] El rol y el tenant se leen siempre de la identidad persistida; el
  `identityCode` recibido solo elige qué credencial se verifica, y se acota con
  el patrón del contrato antes de tocar la base
  (`institutional-auth.service.ts:406-434`).
- [x] La revocación conserva la fila y solo marca `revokedAt`
  (`institutional-auth.service.ts:366-395`).
- [x] `INSTITUTIONAL_SESSION_CREATED` e `INSTITUTIONAL_SESSION_REVOKED` se
  escriben dentro de la misma transacción, con actor OPACO, rol efectivo,
  endpoint y `correlationId` (`institutional-audit.service.ts:96-141`).
- [x] Toda respuesta de sesión lleva `Cache-Control: private, no-store`,
  `Pragma: no-cache` y `Vary: Cookie`
  (`institutional-auth.controller.ts:294-298`).
- [x] Un contexto de ejecución inseguro se traduce a `503` controlado sin
  describir la topología (`institutional-auth.controller.ts:275-290`).

### Sesión humana — API consumida por esta capacidad

- [x] `GET /api/v1/human-auth/session` devuelve `expiresAt`,
  `idleExpiresInSeconds` y `contexts`, sin ningún identificador
  (`human-auth.controller.ts:174-221`, `human-auth.dto.ts:20-47`).
- [x] `GET /api/v1/human-auth/login` inicia OIDC Authorization Code + PKCE y
  `POST /logout` revoca con origen y sesión comprobados
  (`human-auth.controller.ts:85-99,233-235`).
- [x] `HUMAN_AUTH_RETURN_TARGETS = ['/']` es una allowlist literal, no una forma
  (`human-auth.contract.ts:70-91`).
- [x] `GET /api/v1/me/contexts` existe, con `HumanSessionGuard`, y devuelve solo
  los contextos derivados en el servidor (`me-contexts.controller.ts:53-102`).

### Shell Hospital — navegador

- [x] Tres estados observables: `consultando`, `sin-sesion` y autenticado
  (`HospitalShell.tsx:641,656,669`).
- [x] El marco neutral conserva sidebar y área principal sin topbar funcional,
  buscador, campana, perfil, módulo ni `data-hospital-content`
  (`HospitalShell.tsx:330-349`).
- [x] `HospitalSidebarNeutral` muestra las doce etiquetas del menú en el orden
  aprobado, dibujadas como `<li>` inertes con `data-hospital-nav="bloqueado"`
  (`HospitalSidebar.tsx:227-264`).
- [x] El menú neutral incluye un texto solo para lectores de pantalla que explica
  que la navegación exige sesión (`HospitalSidebar.tsx:238-240`).
- [x] El estado de comprobación se anuncia con `role="status"` dentro del área
  principal (`HospitalShell.tsx:643-646`).
- [x] El formulario de acceso vive integrado en el área principal, con `<label>`
  asociada por campo, `autocomplete="off"`, `type="password"`, `maxLength=512`,
  botón con estado ocupado y región viva `role="alert"` permanente
  (`HospitalShell.tsx:233-320`).
- [x] La credencial se borra del estado en el mismo gesto que la envía
  (`HospitalShell.tsx:264-271`).
- [x] El cuerpo enviado contiene EXACTAMENTE `identityCode` y `accessSecret`
  (`hospitalInstitutionClient.ts:288-289`).
- [x] La validación local comprueba la FORMA y no adelanta ningún desenlace del
  servidor (`hospitalInstitutionClient.ts:201-218`).
- [x] La identidad mostrada procede siempre de `current`, nunca del cuerpo de la
  apertura (`hospitalInstitutionClient.ts:256-270`, `HospitalShell.tsx:559-572`).
- [x] Cualquier desenlace que no sea sesión vigente limpia la identidad y NO
  repliega a los literales demostrativos (`HospitalShell.tsx:478-489`).
- [x] Solo `204` o `401` retiran la sesión de la pantalla; cualquier otro
  desenlace reconfirma contra `current`
  (`hospitalInstitutionClient.ts:427-440`, `HospitalShell.tsx:587-627`).
- [x] Si tras reconfirmar la sesión sigue vigente, se conserva, se avisa y el
  cambio de credencial queda bloqueado
  (`hospitalInstitutionClient.ts:451-468`).
- [x] El sidebar autenticado usa el nombre REAL del tenant y vacía tipo y
  municipio en lugar de inventarlos (`HospitalShell.tsx:499-508`).
- [x] La topbar autenticada muestra actor impersonal, etiqueta de rol y avatar
  sin iniciales de persona (`HospitalTopbar.tsx:62-81`).
- [x] La caducidad se anuncia solo a lectores de pantalla y se redacta desde la
  cadena del servidor, sin recalcularla (`HospitalTopbar.tsx:78`,
  `hospitalInstitutionClient.ts:130-140`).
- [x] `Cambiar sesión` y `Cerrar sesión` son botones reales que se deshabilitan
  mientras una operación está en curso (`HospitalTopbar.tsx:96-126`).
- [x] Un rol que la interfaz no rotula cae en la etiqueta neutra en lugar de
  recibir un nombre inventado (`hospitalInstitutionClient.ts:67-71`).
- [x] Ningún cliente lee, escribe ni copia la cookie de sesión: el token viaja
  siempre por `credentials: 'include'` con `cache: 'no-store'`
  (`hospitalInstitutionClient.ts:87-93,282-292,363-369`).

### Sesión profesional humana — navegador

- [x] `hospitalHumanSessionClient.ts` usa exactamente tres rutas humanas y
  ninguna más (`hospitalHumanSessionClient.ts:54-58`).
- [x] `urlDeLoginHumano()` compone la URL absoluta con `returnTo=/` y no pide el
  login por red (`hospitalHumanSessionClient.ts:127-137`).
- [x] `consultarSesionHumana` reduce a cinco desenlaces y falla CERRADO ante un
  cuerpo sin `contexts` utilizable (`hospitalHumanSessionClient.ts:182-227`).
- [x] `cerrarSesionHumana` usa `POST` y distingue seis desenlaces
  (`hospitalHumanSessionClient.ts:239-270`).
- [x] `cierreHumanoConfirmado` es una función pura y solo `ok` y `sin-sesion`
  confirman (`hospitalHumanSessionClient.ts:278-280`).
- [x] El DTO admitido tiene exactamente `expiresAt`, `idleExpiresInSeconds` y
  `contexts` (`hospitalHumanSessionClient.ts:84-88`).
- [x] «Abrir sesión profesional» es un `<a href>` con `target="_blank"` y
  `rel="noopener noreferrer"`, con ayuda accesible asociada
  (`HospitalHomeVisits.tsx:385-399`).
- [x] Solo `activa-profesional` vuelve a leer la visita; un contexto humano sin
  `PROFESSIONAL` no habilita nada (`HospitalHomeVisits.tsx:582-618`).
- [x] Detectar la sesión profesional NO habilita acciones: las acciones dependen
  del `ok` de la consulta de la visita (`HospitalHomeVisits.tsx:182-184`,
  `hospitalOperaciones.test.tsx:418-440`).
- [x] Solo un cierre confirmado retira la sesión y vuelve al estado fail-closed
  (`HospitalHomeVisits.tsx:624-670`).
- [x] La vista de visitas nunca nombra ni toca la sesión institucional
  (`hospitalOperaciones.test.tsx:502-509`).
- [x] Ningún mensaje del panel humano nombra código de estado, ruta, caducidad
  técnica ni dato de persona (`HospitalHomeVisits.tsx:194-215`,
  `hospitalOperaciones.test.tsx:456-490`).
- [x] Doble envío bloqueado en las dos operaciones humanas
  (`HospitalHomeVisits.tsx:582-584,624-626`).
- [x] La frontera de red del módulo Hospital queda en seis clientes exactos, con
  comprobación de igualdad y no de inclusión
  (`hospitalAlcance.test.ts:57-63,196-235`).

### Pruebas presentes

- [x] `apps/api/src/institutional-auth/institutional-auth.unit.test.ts` —
  derivación `scrypt`, atributos de la cookie y aprovisionamiento fail-closed por
  rol.
- [x] `apps/api/test/hospital-institutional-auth.api.test.ts` — roles disjuntos y
  bloque `MP-TODAY-01`: cierre por Viewer y por Scheduler, `403` por origen ajeno,
  `403` sin cabeceras con la sesión aún viva.
- [x] `apps/web/src/features/hospital/hospitalShell.test.tsx` — T-H11 a T-H16 y
  regresión H-FID-A.
- [x] `apps/web/src/features/hospital/hospitalInstitutionClient.test.ts` —
  apertura, cierre, validación local, mensajes, decisión de cierre y
  reconfirmación.
- [x] `apps/web/src/features/hospital/hospitalHumanSessionClient.test.ts` — URL
  OIDC, consulta, cierre y alcance negativo.
- [x] `apps/web/src/features/hospital/hospitalOperaciones.test.tsx` — T-10G.
- [x] `apps/web/src/features/hospital/hospitalAlcance.test.ts` — T-06B.
- [x] `apps/api/test/openapi.test.ts` — la superficie publicada es `post` en la
  colección y `['delete','get']` en `current`.

## Límites conocidos (no autorizados como trabajo)

- [ ] `apps/api/src/main.ts:37-47` no incluye `DELETE` en `methods` de
  `enableCors`. Con la topología por defecto —web `:3000`, API `:3001`, sin proxy
  en `next.config.ts`— el preflight de
  `DELETE /api/v1/institutional/sessions/current` quedaría bloqueado y `Cerrar
  sesión` y `Cambiar sesión` no funcionarían en el navegador. El contrato
  publicado sí declara `delete`.
- [ ] `enableCors` no tiene ninguna prueba, y las pruebas de API no lo ejecutan:
  usan `supertest` contra `app.init()`, que no pasa por `bootstrap()`.
- [ ] `.env.example` no declara `MERDN_HOSPITAL_PATIENT_VIEWER_SECRET`, `_CODE`,
  `MERDN_HOSPITAL_SCHEDULER_SECRET`, `_CODE`, `MERDN_MUNICIPAL_VIEWER_SECRET`,
  `_CODE` ni `MERDN_INSTITUTIONAL_SESSION_TTL_SECONDS`. Con la configuración de
  ejemplo, ninguna identidad se aprovisiona y el formulario siempre falla.
- [ ] `GET /api/v1/me/contexts` no tiene ningún consumidor web: el shell lee
  `contexts` desde `GET /api/v1/human-auth/session`.
- [ ] Los controles de sesión profesional no viven en el shell, sino dentro de
  `HospitalHomeVisits`. Solo aparecen con una visita abierta y tras un
  `sin-sesion` de la consulta de visita, o después de comprobar una vez. No hay
  control global de sesión profesional en topbar ni sidebar.
- [ ] Tras el login OIDC en pestaña nueva se aterriza en `/`, no en `/hospital`:
  `returnTo` solo admite `/`. Hay que volver a mano y pulsar «Comprobar sesión
  profesional». No hay mensaje entre ventanas ni reconsulta automática.
- [ ] El contexto institucional se consulta una sola vez, al montar. No hay
  renovación, ni reconsulta periódica, ni aviso visible de caducidad próxima: la
  caducidad solo se anuncia a lectores de pantalla.
- [ ] La sesión institucional no expira por inactividad (TTL absoluto de 8 h,
  máximo 24 h); la humana sí (30 min). La interfaz no explica esa diferencia.
- [ ] El límite de intentos es una ventana fija en memoria del proceso: no
  protege un despliegue con varias instancias. El `429` no está cubierto por
  ninguna prueba.
- [ ] Un intento fallido de sesión institucional no se audita: no existe
  `INSTITUTIONAL_SESSION_DENIED` en `AuditEventType`.
- [ ] `CAREGIVER_RELATIONSHIP_MANAGER` existe en el servidor pero la interfaz no
  lo rotula: cae en la etiqueta neutra «Acceso institucional».
- [ ] `HospitalInstitutionSettings` («Institución e integraciones») es
  presentación pura: estado local efímero, nada se guarda y nada administra la
  identidad institucional ni su credencial.
- [ ] `HospitalUserProfile` y la persona demostrativa de `hospitalShellDemo`
  (`Claudia Vargas`) ya no se renderizan en ninguna pantalla, pero siguen en el
  código y en la configuración.
- [ ] `apps/web/src/app/hospital/page.tsx:10-21` sigue afirmando que la pantalla
  «no llama a la API y no crea sesión» y que es «sin backend y sin permisos».
- [ ] `INSTITUTIONAL_ORIGIN_REJECTED_CODE` vive en el guard y no en
  `institutional-auth.contract.ts`, con el motivo declarado en el propio archivo.
  Consolidarlo sigue pendiente.
- [ ] No existe cambio de identidad institucional sin cerrar la actual, ni
  recuperación de credencial, ni registro, ni administración de usuarios. Es
  deliberado y sigue siendo el alcance declarado.
- [ ] Sin jsdom, ningún flujo interactivo se ejecuta en un DOM: `entrar`,
  `terminar`, `comprobarSesionProfesional` y `cerrarSesionProfesional` no se
  prueban ejecutándolos.
- [ ] Varias pruebas comprueban el TEXTO del archivo fuente
  (`expect(EFECTIVO).toContain(...)` en `hospitalOperaciones.test.tsx:442-516`):
  atan la prueba a la forma del código, no a su comportamiento.
- [ ] `hospital-institutional-auth.api.test.ts` se salta entero sin PostgreSQL
  migrado (`describe.skipIf(!puedeEjecutarse)`, líneas 102 y 371) y la suite no
  falla por ello.
- [ ] No existe auditoría de Codex registrada para esta capacidad, ni Task
  Specification archivada para `MP-TODAY-01` ni `MP-TODAY-02`, que es de donde
  procede el commit fundacional `231f6b6`.
- [ ] Los guards `InstitutionalSameOriginGuard`, `InstitutionalSessionGuard` y
  `InstitutionalSignInRateLimitGuard` no tienen prueba unitaria propia: solo se
  ejercitan indirectamente en la suite de API, que requiere base de datos.

## Verificación pendiente

- [ ] Ejecutar `npm run test --workspace @merdn/web -- --run
  src/features/hospital/hospitalShell.test.tsx
  src/features/hospital/hospitalInstitutionClient.test.ts
  src/features/hospital/hospitalHumanSessionClient.test.ts
  src/features/hospital/hospitalOperaciones.test.tsx
  src/features/hospital/hospitalAlcance.test.ts`. **No ejecutado el 2026-08-25:**
  `node_modules` ausente.
- [ ] Ejecutar `institutional-auth.unit.test.ts` y
  `hospital-institutional-auth.api.test.ts`. **No ejecutado:** `node_modules`
  ausente y PostgreSQL sin levantar; el segundo se saltaría igualmente.
- [ ] Comprobar en un navegador real si el preflight de
  `DELETE /api/v1/institutional/sessions/current` se bloquea con la
  configuración actual de CORS. Hoy es una deducción de configuración, no una
  observación.
- [ ] Comprobar el flujo OIDC de extremo a extremo con Keycloak levantado:
  redirección, cookie del intento, `callback`, aterrizaje en `/` y detección
  posterior de `PROFESSIONAL` con «Comprobar sesión profesional».
- [ ] Comprobar el aprovisionamiento real de identidades institucionales con las
  variables definidas: ver el `onModuleInit` registrando roles aprovisionables y
  la advertencia cuando no hay ninguna.
- [ ] Medir el coste temporal de `scrypt` y del señuelo para confirmar que
  «código desconocido» y «credencial incorrecta» no son distinguibles por tiempo.
- [ ] Verificar el anuncio real de `role="status"`, `role="alert"`,
  `aria-describedby` y `merdn-sr-only` con un lector de pantalla.
- [ ] Comprobar el comportamiento del `429` institucional agotando la ventana de
  intentos contra una API levantada.
