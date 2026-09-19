# Tareas Verificables — Spec 027

**Spec**: `027-portal-central-cuenta-paciente-persistente`
**Formato**: Cada tarea tiene `ID`, `Descripción`, `Archivos`, `Criterio de Hecho (DoD)`, `Test Requerido`, `Dependencia`.

---

## FASE 0 — Keycloak (Infra)

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T0.1 | Verificar Keycloak corriendo en Docker | `docker-compose.yml` | `docker ps | grep keycloak` → UP, puerto 8080 | Manual | — |
| T0.2 | Crear realm `merdn-patient` | Admin API / Console | Realm visible en `http://localhost:8080/admin/master/console/#/merdn-patient` | Manual | T0.1 |
| T0.3 | Crear client `merdn-patient-client` (confidential, Standard Flow + Direct Grants + Service Accounts) | Admin API | Client ID/Secret generados; Redirect URIs: `http://localhost:3000/*`, `https://dominio.produccion/*` | Manual | T0.2 |
| T0.4 | Asignar role `manage-users` (realm-management) al service account del client | Admin API | Admin API puede crear usuarios via token service account | Manual | T0.3 |
| T0.5 | Documentar vars en `.env.example` | `.env.example` | 7 vars KEYCLOAK_* listadas con descripción | Revisión | T0.4 |
| T0.6 | Healthcheck Keycloak en CI | `.github/workflows/ci.yml` (o equivalente) | `curl -f http://keycloak:8080/realms/merdn-patient/.well-known/openid-configuration` pasa en CI | CI verde | T0.5 |

---

## FASE 1 — Backend Core: Provisión Cuenta

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T1.1 | Crear `KeycloakAdminClient` (nuevo) | `apps/api/src/patients/keycloak-admin.client.ts` | Clase con `createUser(dto)`, `getAccessToken()`, timeout 10s, retry 1x, lanza `KeycloakProvisionError` | Unit: mock fetch → éxito, error 4xx, timeout | T0.6 |
| T1.2 | Añadir validación `password` en `enrollment.validation.ts` | `apps/api/src/patients/enrollment.validation.ts` | `password?: string` opcional; si presente: min 8, 1 letra, 1 número | Unit: casos válidos/inválidos/ausente | — |
| T1.3 | Actualizar `PatientEnrollmentRequestDto` | `apps/api/src/patients/patient-enrollment.dto.ts` | `@IsOptional() @IsString() @MinLength(8) @Matches(/[a-zA-Z]/) @Matches(/\d/) password?: string` | Unit: class-validator | T1.2 |
| T1.4 | Añadir vars Keycloak en `environment.ts` + validación | `apps/api/src/config/environment.ts` | 7 vars KEYCLOAK_* requeridas; `loadApiEnvironment()` valida y expone en `ApiEnvironment` | Unit: config válida/inválida | T0.5 |
| T1.5 | Modificar `PatientEnrollmentService.enroll()` — provisión cuenta | `apps/api/src/patients/patient-enrollment.service.ts` | En transacción: crea HumanAccount + ExternalAuthIdentity (subject UUID v4); llama KeycloakAdminClient.createUser(); audita HUMAN_ACCOUNT_CREATED + HUMAN_IDENTITY_LINKED; rollback si Keycloak falla | Unit: mock tx + KeycloakClient → crea filas, llama cliente, audita; integración: Keycloak real → user creado | T1.1, T1.3, T1.4 |
| T1.6 | Actualizar `PatientEnrollmentController` (si cambia response) | `apps/api/src/patients/patient-enrollment.controller.ts` | Response 201 incluye info cuenta creada (opcional) o igual que antes | Integración: POST → 201, BD correcta | T1.5 |
| T1.7 | Tests unitarios backend Fase 1 | `apps/api/test/patient-enrollment.service.test.ts`, `enrollment.validation.test.ts`, `keycloak-admin.client.test.ts` | `vitest run` → 0 fallos en archivos modificados | CI | T1.5, T1.6 |

---

## FASE 2 — Backend Auth: Migración + TTL + Auditoría

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T2.1 | Añadir `ENROLLMENT_SESSION_REVOKED` a enum `AuditEventType` | `prisma/schema.prisma` (línea ~179) | Enum incluye nuevo valor | `npx prisma validate` OK | — |
| T2.2 | Generar y aplicar migración Prisma | — | `npx prisma migrate dev --name add_enrollment_session_revoked_audit` → migration creada y aplicada | `npx prisma migrate status` → applied | T2.1 |
| T2.3 | Añadir 3 métodos en `AuditService` | `apps/api/src/audit/audit.service.ts` | `recordHumanAccountCreatedWithin`, `recordHumanIdentityLinkedWithin`, `recordEnrollmentSessionRevokedWithin` — insert audit_event con campos correctos | Unit: mock tx → insert correcto | T2.2 |
| T2.4 | Modificar `HumanAuthService.completeLogin()` / `establishSession()` — revocar enrollment_session | `apps/api/src/human-auth/human-auth.service.ts` | Tras crear HumanSession, busca enrollment_session activa del mismo personId/tenantId, revoca (set revokedAt), audita ENROLLMENT_SESSION_REVOKED | Unit: mock tx → revoca + audita; Integración: login real → enrollment_session.revokedAt no null | T2.3 |
| T2.5 | Ajustar TTL sesión en `human-auth.config.ts` | `apps/api/src/human-auth/human-auth.config.ts` | `sessionTtlSeconds = 30*24*60*60`, `sessionIdleSeconds = 72*60*60` (o env vars) | Unit: config carga valores correctos | — |
| T2.6 | Tests unitarios backend Fase 2 | `apps/api/test/human-auth.service.test.ts`, `audit.service.test.ts` | `vitest run` → 0 fallos | CI | T2.4, T2.5 |

---

## FASE 3 — Frontend Inscripción: Campo Password

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T3.1 | Añadir `password?: string` a `DatosPaciente` | `apps/web/src/features/inscripcion/inscripcionFlow.ts` | Tipo actualizado, nullable | TypeScript compila | — |
| T3.2 | Paso 2 (Contacto) — renderizar input password + toggle + fortaleza | `apps/web/src/features/inscripcion/steps/PasosPaciente.tsx` | UI: input type=password, botón mostrar/ocultar, barra fortaleza 3 colores, help text, error accesible | Unit: render + interacciones (toggle, validación, fortaleza) | T3.1 |
| T3.3 | Validación cliente en paso 2 | `PasosPaciente.tsx` (lógica paso) | Al click "Continuar": si password presente y (len<8 o sin letra o sin número) → error + foco | Unit: dispatch setError casos válidos/inválidos | T3.2 |
| T3.4 | Actualizar `buildPatientEnrollmentRequest` + `submitPatientEnrollment` | `apps/web/src/features/inscripcion/patientEnrollmentClient.ts` | Request incluye `password` si presente; tipos correctos | Unit: request body tiene password | T3.1 |
| T3.5 | Tests unitarios frontend Fase 3 | `apps/web/src/features/inscripcion/steps/PasosPaciente.test.tsx`, `patientEnrollmentClient.test.ts` | `vitest run` → 0 fallos | CI | T3.2, T3.4 |

---

## FASE 4 — Frontend Portal: Badge Demo (Visual)

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T4.1 | Añadir badge "Datos de demostración" en 4 tarjetas institucionales | `apps/web/src/features/hub/HubAccessPortal.tsx` | 4 tarjetas (Alcaldía, Hospital, Personal Terreno, Médicos) muestran `<span className={styles.demoBadge}>Datos de demostración</span>` en `cardMeta` | Visual: inspección manual en `/` | — |
| T4.2 | Estilo `.demoBadge` en CSS | `apps/web/src/features/hub/hub.module.css` | Selector con fondo neutro, texto pequeño, border-radius, margin-top | Visual + snapshot test | T4.1 |
| T4.3 | Verificar sin regresión visual | — | Layout intacto, badges no rompen responsive | Manual + snapshot | T4.2 |

---

## FASE 5 — Integración E2E + Tests Completos

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T5.1 | Tests integración API: POST /enrollments | `apps/api/test/patient-enrollment.api.test.ts` | 201 + BD correcta; 400 password inválido; 409 duplicado; 500 Keycloak down (mock) | `vitest run` api | T1.7, T2.6 |
| T5.2 | Tests integración API: GET /human-auth/session + POST /login | `apps/api/test/human-auth.api.test.ts` | 200 activa-con-contexto; 401; 403; callback completa sesión | `vitest run` api | T2.6 |
| T5.3 | Test E2E completo (Playwright/Vitest) | `apps/web/e2e/patient-persistent-account.e2e.test.ts` (nuevo) | Flujo: inscripción → "Ingresar como Paciente" → Keycloak login → portal paciente → F5 → reabrir navegador → sigue logueado | E2E verde | T1.7, T2.6, T3.5, T4.3 |
| T5.4 | Script verificación BD post-E2E | `scripts/verify-patient-account.sql` | SQL devuelve 1 fila con: person, patient, human_account, external_auth_identity (issuer=keycloak, subject=uuid), enrollment_session.revokedAt no null, human_session activa | Ejecutar manual → output correcto | T5.3 |
| T5.5 | Verificación auditoría | — | `audit_event` tiene 4 eventos: HUMAN_ACCOUNT_CREATED, HUMAN_IDENTITY_LINKED, HUMAN_SESSION_CREATED, ENROLLMENT_SESSION_REVOKED | SQL query → 4 filas | T5.3 |
| T5.6 | Accesibilidad (axe-core) | `apps/web/test/a11y.test.ts` | 0 violations críticos/serios en `/inscripcion`, `/` (login), `/` (paciente portal) | `npm run test:a11y` | T5.3 |
| T5.7 | Navegación teclado + screen reader manual | — | Tab/Enter/Escape funcionan; NVDA/VoiceOver anuncian estados | Manual | T5.3 |

---

## FASE 6 — Documentación + Evidencia

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T6.1 | `git diff` completo guardado | `spec/specs/027-portal-central-cuenta-paciente-persistente/evidence/git-diff.txt` | `git diff > evidence/git-diff.txt` | Revisión | T5.7 |
| T6.2 | Output tests (`vitest run` web + api) | `evidence/test-output.txt` | `vitest run --reporter=verbose > evidence/test-output.txt` | Revisión | T5.7 |
| T6.3 | Verificación BD (SQL output) | `evidence/db-verification.txt` | Output de `verify-patient-account.sql` + auditoría query | Revisión | T5.4, T5.5 |
| T6.4 | Capturas/video E2E | `evidence/e2e-screenshots/` | 5-8 capturas: inscripción paso 2, completada, Keycloak login, portal paciente, refresh, reabrir navegador | Revisión | T5.3 |
| T6.5 | Reporte accesibilidad | `evidence/a11y-report.json` | Output axe-core | Revisión | T5.6 |
| T6.6 | Entrada bitácora/changelog | `spec/bitacora/decisiones/027-portal-central-cuenta-paciente-persistente.md` | Resumen decisiones, evidencia, aprobación | Revisión | T6.1-T6.5 |

---

## Resumen de Dependencias Críticas

```
T0.1 → T0.2 → T0.3 → T0.4 → T0.5 → T0.6
                                      ↓
T1.1 ← T1.2 ← T1.3 ← T1.4 ← T1.5 ← T1.6 → T1.7
                                      ↓
T2.1 → T2.2 → T2.3 → T2.4 → T2.5 → T2.6
                                      ↓
T3.1 → T3.2 → T3.3 → T3.4 → T3.5
                                      ↓
T4.1 → T4.2 → T4.3
                                      ↓
T5.1, T5.2, T5.3, T5.4, T5.5, T5.6, T5.7
                                      ↓
T6.1 → T6.2 → T6.3 → T6.4 → T6.5 → T6.6
```

**Punto de sincronización**: T1.7, T2.6, T3.5, T4.3 deben estar **todos verdes** antes de T5.3 (E2E).

---

## Comandos de Validación Rápida (para desarrollador)

```bash
# Backend (desde apps/api)
npm run lint && npm run typecheck && npm test -- --run

# Frontend (desde apps/web)
npm run lint && npm run typecheck && npm test -- --run

# Migración BD
npx prisma migrate dev --name add_enrollment_session_revoked_audit

# E2E (requiere docker-compose up: keycloak, api, web)
npm run test:e2e

# Accesibilidad
npm run test:a11y
```

---

## Notas para Implementador

1. **No commitear sin tests pasando** — cada fase debe tener `vitest run` verde antes de pasar a la siguiente.
2. **Keycloak Admin API** — usar `client_credentials` grant para obtener token, luego `POST /admin/realms/{realm}/users`. Ver `tools/identity-provisioning/` para patrón existente.
3. **Transacción BD** — Keycloak `createUser` va **fuera** de `prisma.withTenant()` pero **antes** del `return` del `enroll()`. Si falla → `throw` → rollback automático.
4. **Subject UUID** — generar `randomUUID()` en backend, usar mismo valor en `ExternalAuthIdentity.subject` y en Keycloak `attributes.merdn_subject` (para trazabilidad).
5. **Password en claro** — **NUNCA** loggear, **NUNCA** guardar en BD MERDN. Solo Keycloak lo ve (y hashea con scrypt).
6. **Badge demo** — tarea trivial, hacerla en cualquier momento para "quick win" visual.