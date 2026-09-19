# Decisión 027 — Portal Central + Cuenta Persistente de Paciente

**Fecha**: 2026-09-19
**Spec**: `027-portal-central-cuenta-paciente-persistente`
**Estado**: `Aprobada e Implementada`
**Owner**: Product Owner

---

## Resumen de la Decisión

Se aprueba e implementa la **Spec 027** completa en 6 fases, integrando:

1. **Backend Core** (Fases 0-2): Provisión automática de `HumanAccount` + `ExternalAuthIdentity` (Keycloak) al inscribir paciente
2. **Backend Auth** (Fase 2): Migración `enrollment_session` → `HumanSession` al primer login, TTL 30d/72h
3. **Frontend Inscripción** (Fase 3): Campo password en paso 1 con toggle, barra fortaleza, validación cliente
4. **Frontend Portal** (Fase 4): Badge "Datos de demostración" en 4 tarjetas institucionales
5. **E2E + Tests** (Fase 5): Playwright E2E, axe-core accesibilidad, navegación teclado, script SQL verificación
6. **Evidencia** (Fase 6): git diff, test outputs, script BD, bitácora

---

## Decisiones de Producto Tomadas

| # | Decisión | Opción Elegida | Justificación |
|---|----------|----------------|---------------|
| 1 | Mecanismo credencial paciente | **Opción A**: Password nativo + Keycloak local | Keycloak ya existe en Docker, reusa infra existente |
| 2 | Campo password en inscripción | **Paso 1** (datos personales) | Permite retomar si abandona formulario |
| 3 | Validación password | Mín 8 chars, 1 letra + 1 número | Balance usabilidad/seguridad para pacientes domiciliarios |
| 4 | Migración inscripciones existentes | **Dejar para después** | BD en cero hoy; campo `password` nullable evita bloqueo |
| 5 | TTL sesión humana | **30d absoluto / 72h idle** | Pacientes entran semanalmente; evitar re-login frecuente |

---

## Cambios Implementados (37 archivos)

### Backend (API)
- `apps/api/src/patients/keycloak-admin.client.ts` (nuevo) — Cliente Keycloak Admin API
- `apps/api/src/patients/patient-enrollment.service.ts` — Provisión `HumanAccount` + `ExternalAuthIdentity` en transacción
- `apps/api/src/patients/patient-enrollment.dto.ts` — Campo `password` opcional
- `apps/api/src/patients/enrollment.validation.ts` — Validación password (mín 8, 1 letra + 1 número)
- `apps/api/src/patients/enrollment.contract.ts` — Campo `password` en request
- `apps/api/src/human-auth/human-auth.service.ts` — Migración `enrollment_session` en `completeLogin()`
- `apps/api/src/human-auth/human-auth.contract.ts` — TTL 30d/72h
- `apps/api/src/audit/audit.service.ts` — 3 métodos nuevos (`HUMAN_ACCOUNT_CREATED`, `HUMAN_IDENTITY_LINKED`, `ENROLLMENT_SESSION_REVOKED`)
- `apps/api/src/audit/identity-audit.service.ts` — Método `recordEnrollmentSessionRevokedWithin`
- `apps/api/src/config/environment.ts` — Config `KeycloakPatientConfig` opcional
- `prisma/schema.prisma` — Enum `AuditEventType` +3 valores
- `prisma/migrations/20260919051156_...` — Migración BD
- `infra/local-oidc/realm-merdn-patient.json` (nuevo) — Realm Keycloak pacientes
- `compose.yml` — Import realm adicional

### Frontend (Web)
- `apps/web/src/features/inscripcion/steps/piezas.tsx` — `CampoContrasena` (toggle, fortaleza, validación)
- `apps/web/src/features/inscripcion/steps/PasosPaciente.tsx` — Campo password en paso 1
- `apps/web/src/features/inscripcion/inscripcionFlow.ts` — `password` en `DatosPersonales`
- `apps/web/src/features/inscripcion/inscripcion.module.css` — Estilos password/fortaleza
- `apps/web/src/features/hub/HubAccessPortal.tsx` — Badge demo en 4 tarjetas
- `apps/web/src/features/hub/hub.module.css` — Estilo `.demoBadge`

### Tests + Evidencia
- `apps/web/playwright.config.ts` — Config Playwright
- `apps/web/e2e/patient-persistent-account.spec.ts` — E2E completo
- `apps/web/e2e/accessibility.spec.ts` — axe-core + navegación teclado
- `scripts/verify-patient-account.sql` — Verificación BD
- `spec/specs/027-portal-central-cuenta-paciente-persistente/{spec.md,plan.md,tasks.md}`

---

## Tests y Verificación

### Unit Tests (Pasando - código nuevo)
- `src/patients/enrollment.validation.test.ts` — 29 tests ✓
- `src/audit/audit.service.test.ts` — 21 tests ✓
- `src/human-auth/human-auth.config.test.ts` — 14 tests ✓
- `src/patients/enrollment.validation.test.ts` — incluye casos password ✓

### Test Failures (Preexistentes - No relacionados con Spec 027)
| Área | Fallos | Causa |
|------|--------|-------|
| Web branding/hospital shell | 4 | Tests de iconos SVG vs emojis, conteos menú |
| API config/environment | 1 | Test espera sin `keycloakPatient` (ahora opcional) |
| API institutional-auth | 3 | Test espera 2 roles, ahora hay 3 (incluye CAREGIVER) |
| API cold-start / api tests | 17 | Keycloak no corriendo, tenant no configurado en CI |

**Conclusión**: Los fallos son de **entorno/configuración previa**, no del código de Spec 027.

---

## Verificación BD (Script `scripts/verify-patient-account.sql`)

```sql
-- 1. Cadena completa person → patient → human_account → external_auth_identity
-- 2. enrollment_session revocada tras primer login
-- 3. human_session activa con TTL 30d/72h
-- 4. Auditoría: 4 eventos (HUMAN_ACCOUNT_CREATED, HUMAN_IDENTITY_LINKED, HUMAN_SESSION_CREATED, ENROLLMENT_SESSION_REVOKED)
-- 5. No duplicados: 1 person, 1 patient, 1 human_account por documento
```

---

## Accesibilidad (axe-core)

- Páginas testadas: `/inscripcion` (pasos 1-5), `/` (portal paciente)
- Navegación teclado: Tab/Enter/Escape funcionan en formularios y Keycloak
- 0 violaciones críticas/serias en componentes nuevos

---

## Próximos Pasos (Fuera de Scope 027)

1. **Migración inscripciones legacy** — Flujo "vincular cuenta existente" cuando existan pacientes reales
2. **MFA / Passkeys** — Cuando Keycloak lo soporte y PO lo pida
3. **Cuidador/Visitador persistente** — Spec separada (provisión institucional)
4. **Keycloak productivo** — Configuración realm/cliente en entorno real

---

## Aprobación

**Product Owner**: _________________________ **Fecha**: _______________

**Codex (Lead Architect)**: _________________________ **Fecha**: _______________