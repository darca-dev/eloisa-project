# Especificación 003 - Experiencia visual Hospital

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Agrupa las Task Specifications `TASK-003H-01` a `TASK-003H-07`
(incluidas `02B`, `03B`, `03C`, `06A`) y sus siete auditorías
`reviews/REVIEW-003H-*`. Todas congeladas.

## Objetivo

Que la experiencia Hospital exista como shell navegable completo —dashboard,
operación, cuidado, administración, finanzas, analítica y reportes— sobre las
capacidades compartidas de MERDN, sin construir un producto aislado para
hospitales (`CLAUDE.md` §5).

## Historia de usuario principal

Como persona que opera un hospital dentro de MERDN, quiero un espacio de trabajo
con navegación estable y secciones diferenciadas, para encontrar población,
agenda, personal, recursos y reportes sin cambiar de aplicación.

## Qué hace hoy el sistema

Shell con barra lateral y superior (`HospitalShell.tsx`, `HospitalSidebar.tsx`,
`HospitalTopbar.tsx`) y estas secciones, todas navegables:

| Sección | Archivo principal | Origen de datos hoy |
|---|---|---|
| Dashboard y KPI | `HospitalDashboard.tsx` | Configuración estática |
| Pacientes | `HospitalPatients.tsx` | **API** (spec 009) |
| Profesionales | `HospitalProfessionals.tsx` | **API** (spec 010) |
| Agenda | `HospitalAgenda.tsx` | **API** (spec 010) |
| Visitas domiciliarias | `HospitalHomeVisits.tsx` | **API** (spec 013) |
| Alertas | `HospitalAlerts.tsx` | Configuración estática |
| Administración | `HospitalAdministration.tsx` | Configuración estática |
| Gestión financiera | `HospitalFinancialManagement.tsx` | Configuración estática |
| Membresías | `HospitalMemberships.tsx` | Configuración estática |
| Consultas virtuales | `HospitalVirtualConsultations.tsx` | Configuración estática |
| Valoraciones | `HospitalRatings.tsx` | Configuración estática |
| Reportes | `HospitalReports.tsx` | Configuración estática |
| Roles y permisos | `HospitalRolesPermissions.tsx` | Configuración estática |
| Acceso de personal | `HospitalPersonnelAccess.tsx` | Configuración estática |
| Novedades | `HospitalUpdates.tsx` | Configuración estática |
| Auditoría | `HospitalAudit.tsx` | Configuración estática |
| Importación clínica | `HospitalClinicalImport.tsx` | Configuración estática |
| Ajustes de institución | `HospitalInstitutionSettings.tsx` | **API** (spec 014) |

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | App Next.js y ruta `/hospital` | Sin la app no hay shell |
| 002-experiencia-inscripcion-visual | Componentes de interfaz compartidos | El shell Hospital los reutiliza en vez de duplicarlos |

**Dependencias externas:** ninguna en el momento de construirse. Las secciones
conectadas dependen hoy de la API y de PostgreSQL, por las specs 009, 010 y 013.

**Specs que dependen de esta:** 009, 010, 013 y 014 conectan secciones de este
shell a la API. 015 recupera la fidelidad visual que esas conexiones degradaron.

## Escenarios de aceptación

1. Dado el shell Hospital, cuando se navega entre secciones, entonces la
   navegación conserva el contexto institucional resuelto por el servidor y no
   pide al navegador que envíe tenant o institución.
2. Dado que una sección se alimenta de la API, cuando la petición falla, entonces
   la vista muestra un estado de error accesible y **no** sustituye las cifras por
   datos de demostración.
3. Dado que una sección se alimenta de configuración estática, cuando se muestra,
   entonces no afirma proceder de una fuente oficial ni de una integración viva.

## Criterios de aceptación (formato EARS recomendado)

- CUANDO se renderice cualquier sección Hospital, EL SISTEMA DEBERÁ resolver el
  contexto institucional en el servidor y nunca aceptarlo del navegador.
- SI una lectura de API falla, ENTONCES EL SISTEMA DEBERÁ mostrar el fallo y no
  degradar a fixtures.
- EL SISTEMA DEBERÁ mantener navegación por teclado, foco visible y estados
  críticos comunicados con algo más que color.
- EL SISTEMA NO DEBERÁ presentar información clínica, diagnósticos, umbrales ni
  semáforos que no procedan de una fuente autorizada con procedencia declarada.

## Ámbito de archivos / File scope

- `apps/web/src/features/hospital/` — 110 archivos
- `apps/web/src/app/hospital/page.tsx` — ruta de entrada

## Estado real y límites conocidos

**Este es el punto más importante de esta spec.** De las 18 secciones, **5
consultan la API**; las 13 restantes se alimentan de configuración estática. Los
archivos de configuración suman miles de líneas —`hospitalAdministrationConfig.ts`
(1.846), `hospitalFinancialMovimientos.ts` (1.298), `hospitalFinancialDemo.ts`,
`hospitalRatingsConfig.ts`, `hospitalUpdatesConfig.ts`, `hospitalVirtualConfig.ts`—.

Los dominios que esas secciones representan **no tienen ningún modelo en
`prisma/schema.prisma`**: finanzas, presupuesto, proveedores, contratos,
membresías, pagos, catálogo de servicios, alertas, evidencias, valoraciones,
importación clínica.

Esto es coherente con `CLAUDE.md` §5, que exige preservar la representación
estructural de esos dominios, y con `docs/MODULES.md` §39. **No** significa que
la capacidad exista en producción. Una spec futura que quiera darles persistencia
requiere decisiones de producto que hoy no están aprobadas (`CLAUDE.md` §4).

## Criterios de éxito

- Toda sección es alcanzable por teclado desde el shell.
- Ninguna sección estática se presenta como fuente oficial.
- Ninguna sección conectada degrada a fixtures ante un error.
