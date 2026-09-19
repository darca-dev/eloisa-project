-- ============================================================================
-- Verificación BD: Cuenta persistente paciente (Spec 027 Fase 5)
-- ============================================================================
-- Ejecutar tras test E2E exitoso para confirmar persistencia correcta
-- Uso: psql -h localhost -p 5432 -U merdn_dev -d merdn_dev -f scripts/verify-patient-account.sql
-- ============================================================================

-- 1. PACIENTE DE PRUEBA (buscar por documento o email)
-- Ajustar el documento según el test run actual
\set test_doc = '999...'  -- Reemplazar con documento real del test

-- Si se conoce el documento exacto:
-- \set test_doc '9991234567'

-- 2. VERIFICACIÓN PRINCIPAL: Cadena completa person → patient → human_account → external_auth_identity
SELECT
  '=== PACIENTE Y CUENTA HUMANA ===' as seccion;

SELECT
  p.documentNumber,
  p.givenNames,
  p.familyNames,
  p.birthDate,
  p.email,
  p.phone,
  pa.id AS patient_id,
  pa.enrolledAt,
  pa.epsCode,
  pa.epsNameControlled,
  pa.status AS patient_status,
  ha.id AS human_account_id,
  ha.status AS human_account_status,
  eai.id AS ext_auth_identity_id,
  eai.issuer,
  eai.subject,
  eai.status AS ext_auth_status,
  eai.linkedAt
FROM person p
JOIN patient pa ON pa.personId = p.id AND pa.tenantId = p.tenantId
LEFT JOIN human_account ha ON ha.personId = p.id AND ha.tenantId = p.tenantId
LEFT JOIN external_auth_identity eai ON eai.humanAccountId = ha.id AND eai.tenantId = p.tenantId
WHERE p.documentNumber = :'test_doc'
  AND p.tenantId = (SELECT id FROM tenant WHERE code = 'merdn-mvp');

-- 3. SESIONES: enrollment_session vs human_session
SELECT
  '=== SESIONES ===' as seccion;

SELECT
  es.id AS enrollment_session_id,
  es.patientId,
  es.revokedAt,
  es.expiresAt,
  es.createdAt,
  CASE
    WHEN es.revokedAt IS NOT NULL THEN 'REVOCADA'
    WHEN es.expiresAt < NOW() THEN 'EXPIRADA'
    ELSE 'ACTIVA'
  END AS enrollment_status
FROM enrollment_session es
JOIN patient pa ON pa.id = es.patientId
JOIN person p ON p.id = pa.personId
WHERE p.documentNumber = :'test_doc';

SELECT
  hs.id AS human_session_id,
  hs.humanAccountId,
  hs.revokedAt,
  hs.expiresAt,
  hs.createdAt,
  hs.lastUsedAt,
  CASE
    WHEN hs.revokedAt IS NOT NULL THEN 'REVOCADA'
    WHEN hs.expiresAt < NOW() THEN 'EXPIRADA'
    WHEN hs.lastUsedAt IS NOT NULL AND (NOW() - hs.lastUsedAt) > INTERVAL '72 hours' THEN 'IDLE_EXPIRADA'
    ELSE 'ACTIVA'
  END AS human_session_status
FROM human_session hs
JOIN human_account ha ON ha.id = hs.humanAccountId
JOIN person p ON p.id = ha.personId
WHERE p.documentNumber = :'test_doc';

-- 4. AUDITORÍA: 4 eventos esperados
SELECT
  '=== AUDITORÍA ===' as seccion;

SELECT
  ae.eventType,
  ae.actorType,
  ae.resourceType,
  ae.resourceId,
  ae.outcome,
  ae.endpoint,
  ae.occurredAt
FROM audit_event ae
JOIN person p ON p.tenantId = ae.tenantId
WHERE p.documentNumber = :'test_doc'
  AND ae.eventType IN (
    'HUMAN_ACCOUNT_CREATED',
    'HUMAN_IDENTITY_LINKED',
    'HUMAN_SESSION_CREATED',
    'ENROLLMENT_SESSION_REVOKED'
  )
ORDER BY ae.occurredAt;

-- 5. CONTEO DE EVENTOS ESPERADOS
SELECT
  '=== CONTEO EVENTOS ===' as seccion;

SELECT
  ae.eventType,
  COUNT(*) AS cantidad
FROM audit_event ae
JOIN person p ON p.tenantId = ae.tenantId
WHERE p.documentNumber = :'test_doc'
  AND ae.eventType IN (
    'HUMAN_ACCOUNT_CREATED',
    'HUMAN_IDENTITY_LINKED',
    'HUMAN_SESSION_CREATED',
    'ENROLLMENT_SESSION_REVOKED'
  )
GROUP BY ae.eventType;

-- 5. VERIFICACIÓN NO-DUPLICADOS
SELECT
  '=== NO DUPLICADOS ===' as seccion;

SELECT
  COUNT(DISTINCT p.id) AS total_personas,
  COUNT(DISTINCT pa.id) AS total_pacientes,
  COUNT(DISTINCT ha.id) AS total_human_accounts,
  COUNT(DISTINCT eai.id) AS total_ext_auth_identities
FROM person p
LEFT JOIN patient pa ON pa.personId = p.id AND pa.tenantId = p.tenantId
LEFT JOIN human_account ha ON ha.personId = p.id AND ha.tenantId = p.tenantId
LEFT JOIN external_auth_identity eai ON eai.humanAccountId = ha.id AND eai.tenantId = p.tenantId
WHERE p.documentNumber = :'test_doc';