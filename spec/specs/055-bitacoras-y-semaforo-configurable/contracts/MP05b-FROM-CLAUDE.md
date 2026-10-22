# 055 / MP05b — Administración de permisos de cuidado (Claude Code)

Fecha: 2026-10-21. Base: decisión del Product Owner `bitacora/decisiones/2026-10-21-055-administracion-permisos-y-d04-5.md` («Pantalla del gestor»). Sin contrato previo de Codex: el diseño sigue MP01 §2–§4 y D02. Estado: **implementado y verificado localmente**; pendiente de auditoría de Codex y de E2E de navegador.

## 1. Qué hace

- **Primer gestor**: `scripts/care/provision-care-manager.mjs`.
  - Usa la credencial administrativa solo desde `DATABASE_URL` y nunca la imprime.
  - Crea o reutiliza la organización (HOSPITAL o PROVIDER; nunca MUNICIPALITY) y nombra gestor a la cuenta humana ACTIVA única de la persona indicada.
  - El emisor debe tener capacidad de **Soporte de Plataforma ACTIVA**; el gestor no se nombra a sí mismo.
  - Una sola transacción, auditada con `CARE_ADMIN_MANAGER_PROVISIONED`. Idempotente, con `--dry-run`.
- **API** `/api/v1/care/admin`, con sesión humana; las escrituras además con mismo origen y límite de abuso:
  - `GET organizations`: las que la PROPIA cuenta gestiona, por descubrimiento acotado (2 políticas nuevas solo de SELECT).
  - `GET organizations/:id`: espacios, accesos y competencias de esa organización. Auditado como `CARE_ADMIN_READ`.
  - `POST organizations/:id/contexts`: espacio de cuidado del paciente por documento EXACTO normalizado. 409 si ya existe.
  - `POST organizations/:id/contexts/:ctx/grants`: concesión con referencia de soporte. Cada participante exige su vínculo:
    - cuidador: relación de cuidado ACTIVE con ese paciente;
    - profesional: asignación ACTIVE a ese paciente;
    - revisor, o permisos MANAGE_RULES/REVIEW_ALARMS: competencia ACTIVE en la organización.

    Además: nadie se concede reglas ni revisión a sí mismo; 409 ante un duplicado ACTIVE; el trigger de emisión de MP01 vuelve a verificarlo todo en base.
  - `POST organizations/:id/grants/:g/revoke` y `POST organizations/:id/competences[/:c/revoke]`: la competencia la valida el gestor, que no puede ser el sujeto. Revocar conserva la historia, y el instante lo fija la base.
- **Verificación del gestor** (`CareContextService.withManagedOrganization`), en la misma transacción y con bloqueos: sesión, cuenta y vínculo exactos; organización ACTIVE y no municipal; fila de gestor ACTIVE y vigente. La denegación se audita con el evento genérico, sin FK. **Ser gestor no da acceso clínico**; está probado que el gestor recibe 403 en la bitácora del espacio que creó.
- **Interfaz**: Hospital › Configuración › **Espacios de cuidado**, solo junto a «Solicitudes de acceso» en la sesión administrativa real; las ocho pestañas demostrativas no cambian. Permite crear espacios, registrar competencias y conceder o revocar accesos, con mensajes claros. No hay listados de pacientes ni de cuentas.

## 2. Archivos

- **Migración**: NUEVA `prisma/migrations/20261021150000_care_administration/migration.sql`. Contiene:
  - 7 eventos `CARE_ADMIN_*`;
  - INSERT, y UPDATE de columnas de ciclo de vida, sobre `patient_care_context`, `care_authorization` y `clinical_competence_attestation`;
  - UPDATE de `version` en `organization_care_manager`, solo para poder bloquear con FOR SHARE;
  - 2 políticas de descubrimiento;
  - CHECK de auditoría ampliado.
- **Esquema**: `prisma/schema.prisma`, enum `AuditEventType`.
- **API**: `care-admin/*` (contrato, request, servicio, controlador, módulo); `care-context/care-context.service.ts` (`withManagedOrganization`, `listManagedOrganizations`); `care-context/care-context.policy.ts` (`sessionHoldsWithin` público); `care-context/care-mutation.ts` (`ALREADY_EXISTS`); `app.module.ts`.
- **Script**: `scripts/care/provision-care-manager.mjs` y `.d.mts`; `tests/care/provision-care-manager.test.mjs`.
- **Web**: `features/care/{careAdminClient.ts,CareAdministration.tsx,careAdmin.test.tsx}` y `hospital/{HospitalAdministration.tsx,hospitalAdministrationConfig.ts}`. A estos dos se les quitó el atributo de solo lectura, como a los de MP02–03.
- **Pruebas y catálogos**: `test/care-records-alarms.api.test.ts` (2 casos), `test/care-context-fixtures.ts` (documento), `test/openapi.test.ts` (7 rutas), `test/force-rls-catalog.db.test.ts` (52 políticas), `scripts/testing/{test-db-provision,test-db-preflight}.mjs`, `tests/testing/baseline-catalog.test.mjs` (29 migraciones, 52 políticas).

## 3. Verificación

| Prueba | Resultado |
|---|---|
| `tsc` api / web | exit 0 / exit 0 |
| eslint focal | exit 0 |
| `node --test tests/care/provision-care-manager.test.mjs` | 4/4 |
| Runner aislado `mp05b-055-api1`: `db/care-records-alarms.api.test.ts` | **27/27** (2 de administración; el script real se ejecuta contra la base aislada) |
| Web `vitest src/features/care src/features/hospital` | 910/910 |
| Web `vitest run` completo | 1877/1878; la única falla es la previa de `branding.test.tsx`, ajena |
| Catálogo y runner | 45/45 |

La batería completa de PostgreSQL con esta migración se registra en `MP04-05-FROM-CLAUDE.md` / historial cuando termine.

## 4. Riesgos y límites

- La competencia la **declara** el gestor con una referencia de soporte; no acredita título ni consulta RETHUS (MP01).
- El documento se busca ya normalizado. El script exige el valor normalizado exacto; la API lo normaliza con la misma regla que la inscripción.
- No hay revocación de espacios de cuidado ni de gestores desde la interfaz. Quedan para un paquete posterior si se necesitan.
