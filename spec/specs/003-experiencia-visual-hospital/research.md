# Investigación 003 - Experiencia visual Hospital

Medido sobre `develop` el 2026-08-25.

## R1. Volumen

`apps/web/src/features/hospital/` contiene **110 archivos**. Es la mayor
concentración de código del repositorio después del propio catálogo de datos.

Archivos más grandes del ámbito: `hospitalAdministrationConfig.ts` (1.846),
`HospitalPatientsPieces.tsx` (1.521), `hospitalFinancialMovimientos.ts` (1.298),
`hospitalFinancial.test.tsx` (1.140), `HospitalFinancialPieces.tsx` (1.112),
`HospitalReportsPieces.tsx` (1.060), `hospitalPatients.test.tsx` (1.062).

## R2. Qué está conectado y qué no

Clientes de API existentes en el ámbito Hospital: `hospitalPatientsClient.ts`,
`hospitalProfessionalsClient.ts`, `hospitalAgendaClient.ts`,
`hospitalVisitsClient.ts`, `hospitalInstitutionClient.ts`,
`hospitalHumanSessionClient.ts`.

Componentes `.tsx` que importan alguno: `HospitalPatients`,
`HospitalPatientsPieces`, `HospitalProfessionals`, `ProfessionalDetailPanel`,
`ProfessionalEngagementPanel`, `HospitalAgenda`, `HospitalHomeVisits`,
`HospitalShell`, `HospitalTopbar`.

El resto de secciones importa un `*Config.ts` o `*Demo.ts` local.

## R3. Dominios sin persistencia

`grep -E "^model " prisma/schema.prisma` devuelve 20 modelos. Ninguno cubre
finanzas, presupuesto, proveedores, contratos, membresías, pagos, catálogo de
servicios, alertas, evidencias documentales, valoraciones ni importación clínica.

La brecha entre lo que la interfaz Hospital muestra y lo que el sistema puede
sostener es el riesgo de producto más grande del repositorio, y está documentado
aquí para que ninguna spec futura lo dé por resuelto.

## R4. Regla de no degradar a fixtures

`hospitalPatientsClient.ts` declara en su cabecera: «NO tiene repliegue a
fixtures: un fallo es un fallo, y así se comunica. La vista jamás sustituye un
error por cifras de demostración». Es una decisión explícita del código, no una
convención implícita.

## R5. Trazabilidad histórica

28 commits, siete Task Specifications (`TASK-003H-01` … `07`, más `02B`, `03B`,
`03C`, `06A`) y siete auditorías `REVIEW-003H-*`. La secuencia real fue: shell →
KPI → operaciones → cuidado y fuerza laboral → administración y centro de control
→ finanzas → analítica de pacientes → reportes.

## R6. Verificación no ejecutada

`node_modules` ausente: no se ejecutó la suite (45 archivos de prueba en `web`).
