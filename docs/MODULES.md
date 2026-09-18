# MERDN Functional Modules

## 1. Document purpose and status

This document defines the recommended functional modules for MERDN. It is a product specification for review and does not select a definitive technology stack, database, hosting model, integration provider, or deployment architecture.

It is authoritative together with `AGENTS.md` and `docs/PRODUCT.md`. Where the Claude Design prototype is cited, it is used only as a UX, workflow, visual, or preliminary functional reference. Its static data, clinical thresholds, indicators, rules, integrations, and `.dc.html` implementation are not production requirements by themselves.

## 2. Approved structural decisions

The module map incorporates the following Product Owner decisions:

1. MERDN must be configurable from the first production code for any municipality. Municipalities, institutions, territories, programs, catalogs, periods, evidence frameworks, and labels must not be hard-coded for a pilot municipality.
2. The Municipal Government experience is part of the MVP from its first design.
3. MERDN does not initially replace an Electronic Health Record. The MVP only consumes or displays authorized clinical information supplied by the hospital, with its source, institution, original date, import or synchronization context, and applicable version clearly identified.
4. Patient-caregiver relationships are many-to-many. Every relationship has its own authorization, scope, institution, status, validity period, provenance, and audit history.
5. MERDN is not merely a home-care application. It combines care coordination with public and institutional management, financial traceability, evidence, compliance, hospital sustainability, training, reporting, and extensible regulatory management.
6. Hospital and Municipal Government are fundamental, differentiated experiences over shared capabilities. They are not separate, duplicated applications or isolated data silos.

## 3. Functional organization

MERDN is organized into:

- **Operational Core:** people, authorized relationships, programs, care coordination, appointments, visits, virtual consultations, care logs, authorized clinical information, medications, alerts, and follow-up.
- **Institutional Core:** municipalities, hospitals, providers, territories, beneficiary populations, institutional programs, capacity, responsibilities, configuration, and executive management.
- **Financial Core:** budgets, allocations, commitments, expenses, suppliers, contracts, activities, beneficiaries, execution, and financial supporting evidence.
- **Evidence and Compliance Core:** evidence repository, indicators, reports, regulatory hub, FURAG/MIPG, ADRES-related management, requirements, gaps, actions, and auditability.
- **Hospital Commercial Core:** service catalog, capacity and agenda, memberships or plans, billable services, collections or payment references, and hospital revenue visibility when approved.
- **Cross-cutting Capabilities:** identity, authorization, audit, notifications, accessibility, training, Elí, data quality, and shared configuration.
- **Integrations:** controlled exchange with hospital clinical systems, ADRES-related authorized sources, Función Pública or other official sources where available, SENA, messaging, videoconferencing, payments, and future systems.

The cores define business boundaries, not a required deployment topology. Shared records must preserve owning organization, authorized purposes, territorial scope, provenance, and sensitivity classification.

## 4. MVP interpretation

In this document, **MVP presence** has three possible forms:

- **Operational:** a controlled end-to-end workflow is usable in the MVP.
- **Visible and manageable:** the value proposition is present in the product, with approved manual configuration, controlled data, documentary evidence, or limited calculations, even if an external integration is not yet connected.
- **Foundation only:** the model, permissions, auditability, and extension points are included, while advanced automation remains future work.

The MVP must visibly connect care activity, institutional management, financial traceability, evidence, and compliance. It must not present controlled or manually loaded data as official external data.

# CORE OPERATIVO

## 5. People, beneficiaries, caregivers, and professionals

**Objective:** Maintain a non-duplicated master record of people and their authorized operational profiles, including patient, caregiver, health professional, representative, contact, and institutional worker.

**Users:** Patients, caregivers, professionals, hospital personnel, municipal personnel with appropriately aggregated access, and authorized administrators.

**Functions:** Register and update people; assign one or more profiles; maintain patient, caregiver, and professional attributes; record contacts and authorized territorial data; verify professional credentials; classify beneficiary populations from defined sources; detect possible duplicates; measure completeness; preserve profile status and institutional affiliations.

**Data:** Person identity, contact details, demographics, address or territorial reference, population classifications, profile types, professional credentials, affiliations, verification state, provenance, and data-quality state.

**Permissions:** Self-service is limited to approved fields. Professional and institutional access depends on role, organization, territory, assignment, purpose, and relationship. Municipal access is aggregated or minimized by default. Profile administration does not grant unrestricted clinical access.

**Audit:** Creation, update, verification, rejection, affiliation changes, classification changes, duplicate merge, sensitive access, and export.

**Dependencies:** Identity and access; institutions and territory; relationships and consent; documents; audit.

**Prototype reference:** Registration flows in `Eligeme-Inscripcion.dc.html`; patient, caregiver, and professional experiences; beneficiary population and data-quality views in `Eligeme-Alcaldia.dc.html`; patient and professional management in `Eligeme-Hospital.dc.html`.

**MVP presence:** Operational.

**Initial implementation:** A configurable minimum dataset for patients, caregivers, professionals, and institutional users; municipality-neutral population catalogs; controlled deduplication review; no real sensitive demo data.

**Future evolution:** External identity validation, master-data reconciliation, richer population classifications, authoritative territorial catalogs, and controlled cross-institution matching.

## 6. Relationships, authorizations, consent, and assignments

**Objective:** Determine who may act for or access information about another person, for which purpose, institution, scope, and period.

**Users:** Patients, caregivers, representatives, professionals, hospital coordinators, privacy personnel, and auditors.

**Functions:** Create and validate patient-caregiver relationships; support multiple caregivers per patient and multiple patients per caregiver; record relationship type and delegation; manage consent and legal authorization; assign professionals and teams; approve, suspend, revoke, expire, and renew relationships; resolve conflicting requests; retain relationship history.

**Data:** Relationship parties, type, authorization basis, purpose, allowed actions and data categories, institution, territorial or program scope, state, start and end dates, supporting evidence, approver, provenance, revocation, and professional assignment.

**Permissions:** No relationship grants access before validation. Every authorization is evaluated independently. Revocation prevents future use without deleting history. Caregiver, representative, emergency contact, and nearby contact are distinct concepts. Professional access also requires a valid assignment and institutional context.

**Audit:** Request, approval, rejection, scope change, renewal, suspension, revocation, expiration, assignment, reassignment, and exceptional access.

**Dependencies:** People; institutions; programs; identity; documents; audit.

**Prototype reference:** Caregiver-to-patient linking and nearby contact in `Eligeme-Inscripcion.dc.html`; authorized patients in caregiver views; hospital assignment of patients, caregivers, and professionals.

**MVP presence:** Operational and mandatory before individual sensitive access.

**Initial implementation:** Explicit many-to-many relationships with configurable scope, institution, status, and validity; manual institutional validation; documentary support where required.

**Future evolution:** Digital consent flows, delegated administration, automated expiry and renewal, authoritative representation checks, and tightly governed emergency access.

## 7. Program enrollment and case coordination

**Objective:** Enroll beneficiaries in institutional or public programs and coordinate an accountable operational case across organizations and professionals.

**Users:** Municipal program managers, hospital coordinators, authorized admissions personnel, professionals, and auditors.

**Functions:** Configure programs; define target population, territory, owner, validity, services, and capacity; enroll, accept, wait-list, transfer, suspend, and discharge beneficiaries; assign responsible institution and team; maintain case status and follow-up plan; relate activities, resources, evidence, and outcomes.

**Data:** Program, version, institution, municipality, territory, target population, validity, capacity, enrollment, case, responsible team, authorized services, state, entry and exit reason, and provenance.

**Permissions:** Program creation and versioning are institutionally controlled. A professional sees assigned cases. Municipal users manage or review programs within authorized territory and purpose. Enrollment history is retained.

**Audit:** Program creation and versioning; enrollment decisions; status changes; transfers; team changes; eligibility override; and discharge.

**Dependencies:** Institutions; people; relationships; service catalog; documents; indicators; audit.

**Prototype reference:** Programs, beneficiary populations, population overlap, assignments, and program-resource-beneficiary chains in the Hospital and Municipal Government prototypes.

**MVP presence:** Operational for at least one configurable program, without hard-coding its municipality or program type.

**Initial implementation:** Manual program configuration and enrollment, controlled eligibility fields, case ownership, and links to activities and evidence.

**Future evolution:** Versioned eligibility engines, interinstitutional referrals, capacity forecasting, wait-list optimization, and external program registries.

## 8. Agenda, appointments, and service coordination

**Objective:** Plan and coordinate institutional, home, and virtual services while respecting professional availability and patient authorization.

**Users:** Patients, authorized caregivers, professionals, hospital schedulers, and program coordinators.

**Functions:** Request, schedule, confirm, reschedule, cancel, and assign appointments; manage professional availability; select service and modality; track scheduled, confirmed, en route, in service, completed, absent, and canceled states; send reminders; present day, week, and month views; relate appointments to programs and cases.

**Data:** Appointment, service, modality, participant, professional, institution, program, location, date, duration, state, reason, availability, and reminder status.

**Permissions:** Patients and caregivers act only for themselves or valid authorized relationships. Schedulers operate within institution and program scope. Reassignment and cancellation by another user require authority and reason. Calendars must not expose unrelated patient data.

**Audit:** Creation, confirmation, rescheduling, cancellation, assignment, modality change, attendance state, and override.

**Dependencies:** People; relationships; institutions; programs; service catalog; notifications; audit.

**Prototype reference:** “Agendar cita,” patient visits, professional daily agenda, and hospital day/week/month scheduling in the patient, professional, and hospital prototypes.

**MVP presence:** Operational for appointments and home visits; virtual consultation scheduling is visible and may initially use a controlled external link or manual coordination.

**Initial implementation:** Configurable service types, availability, core appointment states, assignment, reminders inside MERDN, and manual route information.

**Future evolution:** Route optimization, external calendar synchronization, wait lists, capacity rules, and automated virtual-session provisioning.

## 9. Care log, home visits, virtual consultations, and continuity

**Objective:** Record what care activity occurred, who performed or reported it, when, where, for whom, what evidence supports it, and what follow-up is required.

**Users:** Patients, authorized caregivers, assigned professionals, hospital coordinators, and authorized quality reviewers.

**Functions:** Guided care log; authorized observations and measurements; medication-taking reports; visit start and completion; professional activity record; virtual consultation record; tasks and continuity notes; supporting evidence; service evaluation; amendments without destructive overwrite; author and origin identification.

**Data:** Care-log entry, encounter, visit, virtual consultation, activity, observation, authorized measurement, medication report, task, result, location evidence when approved, author, source, timestamp, amendment, and rating.

**Permissions:** Patient and caregiver fields are distinct from professional clinical fields. Professionals act only within assignment and competence. Closed records are amended, not silently overwritten. Municipal users receive aggregated service information unless a separately approved basis permits more.

**Audit:** Creation, signing or closure, amendment, justified annulment, evidence attachment, access, export, and visit-state transitions.

**Dependencies:** Agenda; relationships; programs; authorized clinical information; alerts; documents; audit.

**Prototype reference:** Guided bitácora, measurements, symptoms, medication adherence, visit workflows, virtual consultations, continuity notes, and visit ratings across patient, caregiver, professional, and hospital prototypes.

**MVP presence:** Operational for the care log and home-visit lifecycle; virtual consultation is visible and minimally manageable.

**Initial implementation:** Approved configurable forms, clear source labeling, activity evidence, follow-up tasks, and amendment history. Prototype clinical thresholds are not implemented as validated rules.

**Future evolution:** Offline capture, digital signatures, richer professional documentation, route evidence, external encounter exchange, and additional service workflows.

## 10. Authorized clinical information and medications

**Objective:** Display the minimum authorized clinical information supplied by the hospital for care continuity without turning MERDN into an Electronic Health Record.

**Users:** Patient, authorized caregiver, assigned professional, and authorized hospital clinical personnel.

**Functions:** Display authorized clinical summary, conditions, allergies, care instructions, and current medications; identify source and responsible institution; distinguish hospital-supplied data from patient or caregiver reports; maintain original date, receipt date, and version; show synchronization state; record discrepancies for institutional review; restrict downloads and onward disclosure.

**Data:** External clinical summary, condition, allergy, medication, instruction, source system or controlled source, hospital, original author where supplied, original timestamp, import timestamp, version, validity, and discrepancy.

**Permissions:** Clinical information remains scoped by relationship, assignment, institution, purpose, sensitivity, and source authorization. Patients and caregivers cannot alter hospital-supplied prescriptions. Administrative privilege does not imply clinical access. Municipal users do not receive unrestricted individual clinical information.

**Audit:** Import or manual controlled load, reconciliation, view of sensitive information, export, source change, discrepancy resolution, and exceptional access.

**Dependencies:** Hospital institutions; relationships; integrations; audit; data classification.

**Prototype reference:** Patient clinical history and medicines; professional patient history; hospital “Historia clínica” import configuration and explicit origin tracking.

**MVP presence:** Visible and manageable, limited to authorized hospital-supplied information with explicit provenance.

**Initial implementation:** Controlled import, approved file or manual institutional load when integration is unavailable; read-only display; provenance and synchronization status; no autonomous clinical decision support.

**Future evolution:** Approved standards-based interoperability, reconciliation workflows, richer source attribution, and bidirectional exchange only if separately authorized.

## 11. Alerts, developments, and follow-up

**Objective:** Turn relevant clinical, operational, administrative, financial, or compliance events into accountable follow-up work.

**Users:** Patients, caregivers, professionals, hospital coordinators, municipal managers for nonclinical matters, finance personnel, compliance personnel, and auditors.

**Functions:** Report developments; create alerts manually or from approved rules; classify domain and priority; assign an owner; acknowledge, escalate, resolve, reopen, and close; measure response time; relate actions and evidence; separate “new information” from risk; distinguish individual care alerts from institutional pending actions.

**Data:** Alert or development, domain, source, rule version, subject, priority, responsible party, institution, state, timestamps, actions, resolution, evidence, and escalation.

**Permissions:** Reporters do not determine a definitive clinical classification unless authorized. Clinical alerts remain with authorized hospital teams. Municipal users see administrative, program, compliance, and aggregated operational alerts. Rule and severity changes require controlled authority.

**Audit:** Creation, rule trigger, classification, assignment, acknowledgment, escalation, action, resolution, closure, reopening, and suppressed duplicate.

**Dependencies:** Care operations; financial management; compliance hub; notifications; assignments; audit.

**Prototype reference:** Health semaphore, hospital alarms, caregiver developments, missed medication reports, municipal administrative pending actions, and the visual rule that fuchsia indicates novelty rather than danger.

**MVP presence:** Operational for manually classified developments and follow-up; visible separation of care, administrative, financial, and compliance alerts.

**Initial implementation:** Approved non-diagnostic rules and manual prioritization; configurable ownership and states; no unvalidated prototype clinical thresholds.

**Future evolution:** Validated and versioned rules, service-level escalation, cross-institution coordination, and clinically governed decision-support rules if approved.

# CORE INSTITUCIONAL

## 12. Institutions, municipalities, territories, and organizational configuration

**Objective:** Represent the multi-institution, multi-municipality operating context and enforce organizational and territorial separation.

**Users:** Platform administrators, municipal administrators, hospital administrators, institutional managers, and auditors.

**Functions:** Register municipalities, hospitals, ESEs, IPSs, EPSs, providers, secretariats, departments, sites, and organizational units; configure territory and coverage; associate users and positions; define authorized interinstitutional relationships; maintain responsible parties, validity, service capacity, and institutional parameters.

**Data:** Organization, organization type, legal identifiers, municipality, territory, site, unit, affiliation, position, capacity, interinstitutional agreement, responsible party, validity, and configuration version.

**Permissions:** Every operation is institution- and territory-scoped. Cross-institution access requires an explicit authorized relationship. A user with multiple affiliations operates in an identifiable institutional context. Platform support does not inherit clinical access.

**Audit:** Organization creation and update, affiliation, interinstitutional relationship, territory, responsible party, capacity, and configuration changes.

**Dependencies:** Identity; audit; shared catalogs.

**Prototype reference:** Hospital/ESE and Municipal Government dashboards, Secretary of Health profile, institutional registration, municipality filters, territorial views, and institution/integration configuration.

**MVP presence:** Operational and configurable for any municipality from the first code.

**Initial implementation:** Municipality-neutral catalogs and configuration; at least one municipal and one hospital experience; no municipality names, territories, indicators, or programs embedded as production constants.

**Future evolution:** Organizational hierarchies, regional or departmental aggregation, intermunicipal programs, institution federation, and authoritative geographic sources.

## 13. Beneficiary population and territorial management

**Objective:** Give authorized institutions reliable, deduplicated visibility of beneficiary populations, territorial coverage, gaps, and program participation.

**Users:** Municipal managers, hospital program managers, planners, authorized analysts, and auditors.

**Functions:** Define population categories and sources; deduplicate people across overlapping categories; view coverage by municipality, zone, institution, and program; measure information quality; identify unmet or unassigned populations; preserve aggregation rules; relate population to services, resources, evidence, and outcomes.

**Data:** Population category, source, person-to-category relation, territory, program, coverage, aggregation period, deduplication state, completeness, gap, and lineage.

**Permissions:** Individual access is minimized and purpose-bound. Municipal default views are aggregated. Small-group and reidentification risks must be controlled. Classification changes require traceable source and authority.

**Audit:** Category configuration, classification, source change, deduplication decision, aggregation execution, sensitive drill-down, and export.

**Dependencies:** People; institutions; programs; indicators; data quality; audit.

**Prototype reference:** “Población beneficiaria,” overlapping populations, unique beneficiary totals, territory, coverage, and information-quality panels in `Eligeme-Alcaldia.dc.html`.

**MVP presence:** Visible and manageable in the Municipal Government experience.

**Initial implementation:** Controlled population categories, source metadata, deduplicated counts, territorial aggregation, and completeness metrics.

**Future evolution:** Official population-source integrations, geospatial analysis, longitudinal coverage, gap forecasting, and privacy-preserving comparative analysis.

## 14. Institutional operations, responsibilities, and capacity

**Objective:** Coordinate institutional personnel, responsibilities, service capacity, pending work, and quality across programs and care operations.

**Users:** Hospital and municipal managers, program owners, supervisors, quality personnel, and auditors.

**Functions:** Manage personnel affiliation and operational state; define institutional responsibilities; assign owners to programs, requirements, alerts, and actions; view service capacity and workload; manage operational configuration; monitor pending actions, quality, and continuity; maintain institutional service and responsibility catalogs.

**Data:** Personnel affiliation, role assignment reference, responsibility, capacity, workload, action, due date, owner, service, institution, program, and quality state.

**Permissions:** Responsibilities and capacity remain organization-scoped. Personnel administration does not imply access to all beneficiary data. Supervisory access is limited to approved detail levels.

**Audit:** Personnel activation and deactivation, responsibility changes, capacity changes, action assignment, due-date override, and quality-state changes.

**Dependencies:** Institutions; identity; programs; alerts; audit.

**Prototype reference:** Hospital professional management, service configuration, agenda capacity, municipal responsible-party tracking, and control/evaluation concepts.

**MVP presence:** Operational in a minimal form for Hospital and Municipal Government.

**Initial implementation:** Personnel affiliation, responsible-party assignments, capacity summaries, and pending-action views.

**Future evolution:** Workforce planning, workload balancing, competency-based assignment, institutional scorecards, and cross-provider coordination.

# CORE FINANCIERO

## 15. Budget, allocation, execution, and resource traceability

**Objective:** Trace institutional resources from source and budget through allocation, commitment, expense, activity, beneficiary population, evidence, and result without automatically becoming an accounting system.

**Users:** Municipal finance and program teams, hospital finance teams, program managers, leadership, compliance personnel, and auditors.

**Functions:** Configure budget periods and sources; record assigned, committed, executed, and available amounts; allocate resources to programs and populations; register or import expenses; relate spending to activities and aggregated or authorized beneficiaries; calculate execution percentages; reconcile supporting evidence; identify incomplete traceability.

**Data:** Funding source, budget, period, allocation, commitment, expense, adjustment, program, activity, population, authorized beneficiary reference, amount, execution percentage, responsible party, source, and evidence status.

**Permissions:** Separation of preparation, approval, review, and audit duties. Finance access does not grant clinical access. Closed figures are adjusted through traceable entries. Institution and period boundaries apply. Individual beneficiary linkage requires an approved purpose.

**Audit:** Budget creation, allocation, commitment, expense entry, import, approval, rejection, adjustment, period closure, reconciliation, and export.

**Dependencies:** Institutions; programs; evidence; suppliers and contracts; indicators; audit.

**Prototype reference:** Budget and execution, assigned/executed/committed/available values, program and population distribution, cost-per-beneficiary concepts, and financial evidence in Hospital and Municipal Government views.

**MVP presence:** Visible and manageable as a core value proposition.

**Initial implementation:** Controlled manual configuration or file load; budget-to-program-to-activity-to-evidence traceability; execution percentages with explicit formulas and sources; no general ledger or official accounting claim.

**Future evolution:** Approved financial-system integrations, reconciliation, commitments, richer cost allocation, period controls, and institutional financial reporting.

## 16. Suppliers, contracts, expenses, and supporting documents

**Objective:** Relate suppliers, contracts, invoices or expense records, activities, populations, and documentary support.

**Users:** Finance personnel, procurement personnel, program managers, institutional reviewers, and auditors.

**Functions:** Register suppliers and contracts; maintain validity and responsible parties; register expenses and invoices; link them to budgets, programs, services, activities, and evidence; monitor missing support; record approval state; preserve source and amendment history.

**Data:** Supplier, contract, contract version, invoice or expense reference, amount, date, program, activity, responsible party, approval state, payment reference if approved, and supporting evidence.

**Permissions:** Institution-scoped access and separation of duties. Supplier management, expense entry, approval, and audit are distinct permissions. Financial records cannot expose unrelated clinical information.

**Audit:** Supplier creation, contract versioning, expense entry, approval, rejection, support attachment, status change, adjustment, and export.

**Dependencies:** Budget management; institutions; programs; evidence; audit.

**Prototype reference:** Suppliers, contracts, invoices, expenses and support, payroll and inputs as preliminary concepts in `Eligeme-Hospital.dc.html`, plus municipal evidence and budget views.

**MVP presence:** Visible and manageable at a basic level.

**Initial implementation:** Supplier and expense register, documentary support, approval status, and traceability to program/activity. Payroll, inventory, and public procurement workflows remain outside the initial implementation unless separately approved.

**Future evolution:** Contract lifecycle, procurement workflows, supplier performance, invoice validation, authorized payment integration, payroll references, and inventory or inputs.

# CORE DE EVIDENCIA Y CUMPLIMIENTO

## 17. Institutional documents and evidence repository

**Objective:** Make evidence a central product function by preserving documents and proof with provenance, integrity, classification, relationships, versions, and history.

**Users:** All authorized contributors, institutional reviewers, program managers, finance teams, compliance teams, and auditors.

**Functions:** Upload, classify, relate, version, verify, approve, reject, archive, search, and export evidence; maintain metadata and provenance; manage validity and missing supports; relate evidence to people, authorization, visits, programs, finance, requirements, actions, indicators, and reports; create evidence packages.

**Data:** Evidence item, file, category, sensitivity, owner, organization, author, source, date, version, integrity reference, state, validity, retention class, and business relationships.

**Permissions:** Access depends on evidence category, parent context, organization, purpose, relationship, and sensitivity. Identity, clinical, financial, contractual, and compliance evidence are separately controlled. Material deletion requires approved retention and disposition rules.

**Audit:** Upload, view, download, version, replacement, verification, approval, rejection, relationship change, export, archive, and disposition.

**Dependencies:** Identity; institutions; data classification; audit; retention policy.

**Prototype reference:** Identity and professional documents, caregiver certificates, visit evidence, contracts, invoices, program evidence, and the full evidence chain represented in Hospital and Municipal Government dashboards.

**MVP presence:** Operational and central.

**Initial implementation:** Configurable evidence categories, metadata, business links, review state, provenance, version history, and access controls; controlled file types and fictional/de-identified pilot content.

**Future evolution:** Digital signatures, stronger integrity verification, records-management policies, automated classification, evidence-package submission, and external repositories.

## 18. Institutional, regulatory, and evidence hub

**Objective:** Provide an extensible framework for managing norms, entities, obligations, requirements, actions, responsible parties, populations, evidence, indicators, gaps, and traceability without redesigning MERDN for each new framework.

**Users:** Municipal and hospital compliance teams, legal and planning personnel, program owners, control offices, leadership, and auditors.

**Functions:** Configure regulatory or institutional frameworks; register issuing authority, norm, decision, policy, version, validity, jurisdiction, and source; break frameworks into requirements; assign responsible parties and due dates; relate requirements to programs, populations, actions, evidence, risks, and indicators; manage gap assessment and improvement plans; preserve interpretations and approvals; support multiple future frameworks.

**Data:** Framework, authority, source, norm or policy, version, jurisdiction, requirement, interpretation, applicability, population, institution, responsible party, action, due date, evidence, indicator, gap, risk, status, and review history.

**Permissions:** Framework publication and interpretation require authorized institutional roles. Contributors may attach evidence only within assigned scope. Legal interpretation must be distinguishable from source text and operational status. A single item of evidence or integration cannot automatically prove complete compliance.

**Audit:** Framework creation and versioning, source update, applicability decision, interpretation approval, requirement assignment, evidence linkage, gap change, action closure, and export.

**Dependencies:** Institutions; programs; evidence; indicators; responsibilities; notifications; audit; integrations.

**Prototype reference:** FURAG/MIPG, ADRES, evidence, pending actions, responsible parties, historical comparisons, and management dashboards in `Eligeme-Alcaldia.dc.html`.

**MVP presence:** Visible and manageable as a strategic core.

**Initial implementation:** Configurable framework and requirement registers; manual source references; responsible parties, gaps, actions, evidence, and indicators. It must be possible to configure FURAG/MIPG, ADRES-related obligations or information, Sentencia T-319 de 2025, and other applicable care rules without hard-coded product redesign.

**Future evolution:** Official-source synchronization where legally and technically available, change monitoring, applicability workflows, cross-framework evidence reuse, controlled legal review, and advanced compliance analytics.

## 19. FURAG and MIPG management

**Objective:** Make FURAG and MIPG visible capabilities for evidence organization, indicator monitoring, responsible-party management, gap analysis, historical comparison, and traceability.

**Users:** Municipal and institutional planning, management, internal control, compliance, leadership, and auditors.

**Functions:** Configure dimensions and requirements from authorized sources; assign owners; relate evidence and management actions; monitor gaps and dates; define internal indicators; preserve historical periods; generate evidence and follow-up views; clearly identify official imported values versus internal calculations.

**Data:** Framework version, dimension, requirement, source, period, owner, evidence, action, gap, internal indicator, official value where imported, provenance, and validation state.

**Permissions:** Only authorized users configure frameworks or validate institutional responses. Official values are immutable imports or referenced records with source. Internal estimates cannot be labeled as official Función Pública scores.

**Audit:** Source and framework update, requirement assignment, evidence linkage, indicator calculation, validation, gap change, and report export.

**Dependencies:** Regulatory hub; evidence; indicators; institutions; integrations; audit.

**Prototype reference:** Dedicated FURAG/MIPG navigation, evidence pending actions, responsible tracking, gaps, and historical comparison in the Municipal Government prototype.

**MVP presence:** Visible and manageable.

**Initial implementation:** Manual or controlled loading of framework metadata and evidence; responsible parties, gaps, actions, periods, and traceability; no invented official scoring.

**Future evolution:** Authorized official-source updates, richer comparisons, evidence reuse recommendations, and controlled submission support where permitted.

## 20. ADRES-related information and resource traceability

**Objective:** Make authorized ADRES-related information, health resources, sources, evidence, population/service relationships, and institutional management visible without presenting MERDN as ADRES or as an official evaluation authority.

**Users:** Municipal health managers, hospital finance and management personnel, program managers, planners, compliance personnel, and auditors.

**Functions:** Register authorized ADRES-related sources and periods; load or integrate permitted resource information; relate resources to institutions, programs, populations, services, and evidence; monitor reconciliation or gaps; display provenance and update date; generate institutional reports with explicit limitations.

**Data:** ADRES-related source, dataset or document reference, period, institution, resource, program, population, service, amount where authorized, evidence, reconciliation state, provenance, and update timestamp.

**Permissions:** Access follows legal basis, institution, purpose, sensitivity, and data-minimization rules. Only authorized sources may be presented as official. Internal interpretation and imported information are clearly separated.

**Audit:** Source registration, data load, reconciliation, relationship creation, validation, correction, sensitive view, and export.

**Dependencies:** Regulatory hub; financial core; programs; evidence; indicators; integrations; audit.

**Prototype reference:** Dedicated ADRES navigation and resource, population, evidence, indicator, and reporting concepts in the Municipal Government prototype.

**MVP presence:** Visible and manageable.

**Initial implementation:** Controlled data or documentary load with source, period, owner, and limitation labels; relationships to programs, resources, and evidence; no invented “ADRES evaluation.”

**Future evolution:** Authorized integrations, reconciliation workflows, official dataset lineage, and institution-specific reporting.

## 21. Sentencia T-319 de 2025 and applicable care regulation

**Objective:** Relate applicable care-related legal and policy requirements—including Sentencia T-319 de 2025—to actions, responsible parties, populations, programs, evidence, and indicators.

**Users:** Legal, compliance, municipal and hospital managers, program owners, control offices, and auditors.

**Functions:** Register authoritative source and version; document institution-approved applicability and interpretation; decompose requirements; identify affected populations and programs; assign actions and owners; link evidence and indicators; monitor gaps and deadlines; preserve review history and limitations.

**Data:** Legal source, authoritative link or document, date, version, jurisdiction, approved interpretation, requirement, applicability, population, program, action, owner, evidence, indicator, gap, and review.

**Permissions:** Legal interpretation and applicability decisions require authorized review. Operational users may update assigned actions and evidence. MERDN must not claim complete compliance based on one integration, document, indicator, or action.

**Audit:** Source registration, interpretation approval, applicability decision, requirement change, owner assignment, evidence linkage, gap status, action closure, and report export.

**Dependencies:** Regulatory hub; evidence; programs; population; indicators; audit.

**Prototype reference:** No complete dedicated workflow exists; the Municipal Government evidence, gap, responsible-party, indicator, and reporting concepts provide preliminary UX references only.

**MVP presence:** Visible and manageable within the extensible hub.

**Initial implementation:** Source-linked configurable requirements, actions, owners, affected populations, evidence, gaps, and indicators. Legal content and interpretations must be supplied or approved by authorized specialists; MERDN does not invent them.

**Future evolution:** Regulatory change monitoring, cross-framework mapping, reviewed templates, deadline automation, and external legal-information sources.

## 22. Indicators, results, reports, and data lineage

**Objective:** Produce role-appropriate, reproducible indicators and reports from traceable operational, institutional, financial, evidence, and compliance data.

**Users:** Hospital managers, municipal managers, program owners, finance teams, compliance teams, leadership, professionals where applicable, and auditors.

**Functions:** Maintain an indicator catalog; define formula, source, owner, period, dimensions, version, update method, target, and validation status; calculate or load results; provide Hospital and Municipal Government dashboards; compare periods; report coverage, service, quality, resources, evidence, gaps, and outcomes; export according to permission.

**Data:** Indicator definition, formula, source, lineage, period, owner, version, dimensions, result, target, validation state, report, and export.

**Permissions:** Results are scoped by institution, territory, purpose, and aggregation level. Draft, internal, imported official, and published indicators are distinguished. Small-group disclosure and reidentification must be controlled. Exports require explicit permission.

**Audit:** Definition and formula changes, calculation or load, validation, publication, withdrawal, dashboard access, drill-down, and export.

**Dependencies:** All producing modules; data quality; audit.

**Prototype reference:** Hospital operational and clinical-management indicators; Municipal Government coverage, territory, budget, caregiver, FURAG/MIPG, ADRES, and executive reporting panels.

**MVP presence:** Visible and manageable for both Hospital and Municipal Government.

**Initial implementation:** A small approved catalog spanning care, population, program, financial execution, evidence completeness, and compliance actions; manual or controlled inputs allowed with explicit provenance.

**Future evolution:** Automated calculations, semantic catalogs, scheduled reports, comparative analysis, privacy-preserving benchmarking, and authorized official reporting.

# CORE COMERCIAL DEL HOSPITAL

## 23. Hospital service catalog, capacity, and revenue opportunities

**Objective:** Allow a hospital to configure services that support care delivery and may become sustainable revenue sources when institutionally and legally approved.

**Users:** Hospital administrators, service managers, schedulers, finance personnel, and authorized leadership.

**Functions:** Define home visits, virtual consultations, and other services; maintain duration, capacity, coverage, eligibility, price references, active state, and effective dates; relate services to agenda, professionals, programs, memberships, and financial tracking; distinguish public-program services from commercial offerings.

**Data:** Service, category, modality, institution, coverage, capacity, duration, eligibility, price reference, tax or billing metadata if later approved, validity, and version.

**Permissions:** Service publication and pricing require authorized hospital roles. Historical versions are preserved. Financial configuration does not permit clinical access. Municipal program services and commercial services remain distinguishable.

**Audit:** Service creation, versioning, activation, deactivation, capacity change, price-reference change, and program linkage.

**Dependencies:** Institutions; agenda; professionals; programs; financial core; audit.

**Prototype reference:** Hospital agenda and services configuration, home visits, virtual consultations, service capacity, and quick actions.

**MVP presence:** Visible and manageable.

**Initial implementation:** Configurable service catalog and capacity linked to agenda; price references may be displayed only when approved and labeled appropriately.

**Future evolution:** Costing, dynamic availability, packages, payer rules, billing integration, and service profitability analysis.

## 24. Memberships, plans, and entitlements

**Objective:** Manage versioned hospital memberships or service plans and the services they entitle, when the commercial model is approved.

**Users:** Hospital commercial and administrative personnel, finance personnel, patients, and authorized caregivers.

**Functions:** Define plans and included services; version prices and benefits; enroll or cancel members; track validity and renewal; determine entitlements; preserve historical terms; relate plan usage to appointments and services; distinguish plan membership from public-program enrollment.

**Data:** Plan, version, benefits, limits, price reference, period, member, validity, renewal state, entitlement, usage, and cancellation reason.

**Permissions:** Plan administration is restricted to authorized hospital roles. Patients and caregivers view only their authorized plans. Plan access does not change clinical permissions. Retroactive alteration of prior terms is prohibited.

**Audit:** Plan creation and versioning, enrollment, renewal, cancellation, entitlement use, override, and price change.

**Dependencies:** Service catalog; identity; relationships; agenda; financial core; notifications; audit.

**Prototype reference:** Hospital “Membresías,” versioned Basic/Wellness/Integral plan concepts, included visits and virtual consultations, and patient payment or membership visual references.

**MVP presence:** Visible and manageable with controlled plan data, because hospital sustainability is a permanent value proposition.

**Initial implementation:** Versioned plan catalog, manual membership state, service entitlements, and historical terms; no automatic charging or production payment processing.

**Future evolution:** Subscription lifecycle, eligibility, promotions, payer sponsorship, billing, collections, and approved payment-provider integration.

## 25. Charges, payment references, and hospital income visibility

**Objective:** Relate approved services and memberships to charges, payment evidence, and income visibility without assuming MERDN is initially a payment processor or full billing system.

**Users:** Hospital finance and commercial personnel, authorized patients or caregivers, leadership, and auditors.

**Functions:** Register charge or receivable references; associate service, membership, payer, and evidence; record controlled payment status; show income summaries; reconcile manual or imported references; separate paid, pending, failed, waived, and canceled states; issue or store supporting documents where approved.

**Data:** Charge reference, payer, patient or account, service, plan, amount, currency, status, due date, external transaction reference, evidence, source, and reconciliation state.

**Permissions:** Financial access is separate from clinical access. Patients and caregivers see only authorized account information. Payment status changes and waivers require controlled roles. Sensitive payment data must not be stored unless explicitly approved and appropriately protected.

**Audit:** Charge creation, status change, evidence attachment, reconciliation, waiver, cancellation, refund reference, import, and export.

**Dependencies:** Service catalog; memberships; financial core; evidence; integrations; audit.

**Prototype reference:** Patient “Mis pagos,” hospital membership prices, payment evidence, and prototype references to payment providers.

**MVP presence:** Visible and manageable through controlled or manual payment references.

**Initial implementation:** No production payment processing; manual or controlled payment status and evidence sufficient to demonstrate revenue traceability.

**Future evolution:** Approved gateway integration, billing-system exchange, receipts, refunds, reconciliation, and revenue analytics.

# CAPACIDADES TRANSVERSALES

## 26. Identity, access, onboarding, and account lifecycle

**Objective:** Securely manage registration, authentication, verification, recovery, session, activation, suspension, and first-run configuration.

**Users:** All users, institutional administrators, and platform administrators.

**Functions:** Role-aware registration; institutional invitation; identity and contact verification; account recovery; professional and caregiver document review; account states; first-run consent and accessibility preferences; session management.

**Data:** Account, credentials or authentication reference, claimed identity, contact method, verification, account state, session, recovery event, preference, and onboarding completion.

**Permissions:** Users manage approved personal account fields. Institutional administrators manage users within their scope. Technical administration never grants unrestricted clinical access. Verification and role assignment are separate authorities.

**Audit:** Registration, verification, rejection, login, failure, recovery, credential change, activation, suspension, invitation, and preference change.

**Dependencies:** Institutions; people; documents; notifications; audit.

**Prototype reference:** `Eligeme-Inscripcion.dc.html` and `Eligeme-First-Run.dc.html`, including differentiated flows and pending professional verification.

**MVP presence:** Operational.

**Initial implementation:** Approved registration paths, institutional invitation, account states, basic recovery, onboarding, and accessibility preferences.

**Future evolution:** Stronger identity proofing, additional authentication methods, federation, and higher-assurance access for privileged roles.

## 27. Authorization and permission policy

**Objective:** Enforce least privilege using role, organization, territory, relationship, assignment, consent, purpose, resource, action, and sensitivity.

**Users:** All users indirectly; authorized role and permission administrators directly; auditors.

**Functions:** Define roles and permissions; evaluate contextual access; separate read, create, update, archive, approve, export, and administer actions; control field or category sensitivity where necessary; manage temporary and delegated access; explain denied access without exposing sensitive facts.

**Data:** Role, permission, policy, organization, territory, relationship reference, assignment reference, purpose, consent reference, decision, and policy version.

**Permissions:** Permission administration is itself restricted and auditable. UI visibility is not authorization. All sensitive operations require server-side enforcement in the future architecture.

**Audit:** Role and policy changes, grants and revocations, denied sensitive operations, temporary access, export permission, and privileged access.

**Dependencies:** Identity; institutions; relationships; audit.

**Prototype reference:** Visual profiles and role-specific screens provide workflow references only; they are explicitly not a production permission model.

**MVP presence:** Operational and mandatory.

**Initial implementation:** Documented role baseline plus contextual checks for organization, relationship, professional assignment, territory, and action.

**Future evolution:** Policy administration, purpose-bound access, field-level controls, delegated administration, and formal emergency-access controls.

## 28. Audit, traceability, and control

**Objective:** Preserve reliable evidence of material actions, sensitive access, changes, outcomes, and technical context across MERDN.

**Users:** Auditors, security and privacy personnel, internal control, authorized institutional administrators, and support personnel with limited scope.

**Functions:** Record actor, timestamp, action, resource, identifier, organization, previous and new values where appropriate, outcome, source, and context; search authorized audit records; trace imports and exports; preserve user history after deactivation; support findings and improvement plans.

**Data:** Audit event, actor, acting organization, action, resource, identifier, timestamp, before and after representation, outcome, origin, correlation context, finding, and action plan.

**Permissions:** Audit records are append-only or equivalently protected by the future architecture. Access is highly restricted and separated by domain. Sensitive values are minimized. Ordinary administrators cannot erase history.

**Audit:** Access to audit, export of audit, audit-policy change, finding creation, assignment, resolution, and retention action are themselves audited.

**Dependencies:** All modules.

**Prototype reference:** Hospital system audit, individual worker codes, preserved inactive-user history, source tracking, and control/evaluation concepts.

**MVP presence:** Operational from the first vertical slice.

**Initial implementation:** Material business events, sensitive reads, exports, permission changes, evidence actions, financial changes, compliance changes, and source lineage.

**Future evolution:** Security monitoring, anomaly detection, immutable external anchoring, case investigation, and regulatory audit packages.

## 29. Notifications and communications

**Objective:** Deliver authorized transactional, operational, financial, training, and compliance messages through approved channels.

**Users:** All users and authorized institutional communicators.

**Functions:** In-product notifications; appointment and task reminders; alert delivery; document and evidence pending notices; compliance deadlines; training reminders; templates; recipient segmentation; preferences; delivery state; retries; communication history.

**Data:** Notification, template, purpose, recipient, institution, channel, consent or basis, business reference, schedule, delivery state, and preference.

**Permissions:** Mass communication requires explicit authority. Segmentation is institution- and purpose-scoped. Sensitive content is minimized. External channels cannot receive prohibited health or financial information.

**Audit:** Template change, send, delivery, failure, retry, preference change, mass communication, and cancellation.

**Dependencies:** Identity; programs; agenda; alerts; compliance; integrations; audit.

**Prototype reference:** Appointment reminders, alerts, developments, institutional notifications, campaigns, and WhatsApp references.

**MVP presence:** Operational in-product; external channels are visible as configurable integration states.

**Initial implementation:** In-product notifications and controlled templates. External delivery may be simulated or manually configured until approved.

**Future evolution:** Approved email, SMS, WhatsApp, push, escalation, multilingual templates, and delivery analytics.

## 30. Caregiver training, competency, and certification

**Objective:** Track caregiver training and certification as both a user-support capability and institutional evidence.

**Users:** Caregivers, hospital and municipal program managers, authorized verifiers, training providers, and auditors.

**Functions:** Record training need, enrollment, progress, completion, certificate upload, verification, rejection, validity, and renewal; recommend approved training options; relate training to programs, populations, requirements, evidence, and indicators; distinguish self-declaration from verified certification.

**Data:** Training offering, provider, participant, enrollment, progress, completion, certificate, code, date, validity, verification state, verifier, evidence, program, and requirement.

**Permissions:** Caregivers manage their submissions. Only authorized verifiers confirm a certificate. Training recommendations do not block access unless a separately approved policy requires it. Institutions see only necessary records.

**Audit:** Enrollment, progress update, completion, document upload, verification, rejection, expiry, renewal, and evidence linkage.

**Dependencies:** People; evidence; programs; compliance hub; notifications; integrations; audit.

**Prototype reference:** “Certificarme,” SENA options, training states, certificate support, and verification history in patient/caregiver-oriented prototypes.

**MVP presence:** Visible and manageable, including institutional evidence and indicators.

**Initial implementation:** Manual training and certificate records, evidence upload, verifier workflow, and controlled SENA source links or data.

**Future evolution:** SENA integration, provider catalogs, automatic status exchange, competency frameworks, learning pathways, and renewal management.

## 31. Elí guidance and accessible interaction

**Objective:** Help users understand and complete MERDN workflows through approved, accessible, contextual guidance.

**Users:** Primarily patients and caregivers; also professionals and institutional users where useful.

**Functions:** Explain roles, fields, permissions, and next steps; guide onboarding and care-log capture; surface notifications; locate functions; provide approved educational content; support plain language and accessible presentation; route out-of-scope questions to appropriate human or institutional channels.

**Data:** Guidance content, context, language, version, approval state, interaction, feedback, accessibility preference, and referral destination.

**Permissions:** Elí receives only the minimum contextual information required. It does not diagnose, prescribe, change treatments, determine emergencies autonomously, or make official compliance determinations. Future AI capabilities require separate approval and risk assessment.

**Audit:** Content publication, version change, sensitive contextual access, material recommendation or referral, and user feedback.

**Dependencies:** Identity; content governance; notifications; accessibility; audit.

**Prototype reference:** Elí character assets, contextual assistant, onboarding guidance, explanations, and explicit nonclinical limitations across the prototype.

**MVP presence:** Operational as deterministic, approved contextual guidance.

**Initial implementation:** Curated content and workflow assistance with no generative clinical or legal advice.

**Future evolution:** Voice, multilingual guidance, approved AI assistance, human handoff, stronger accessibility modes, and evaluated personalization.

## 32. Shared configuration, catalogs, data quality, and provenance

**Objective:** Make MERDN municipality-neutral and extensible while ensuring that values, formulas, sources, and configuration changes remain governed and traceable.

**Users:** Authorized platform and institutional administrators, data stewards, program owners, indicator owners, and auditors.

**Functions:** Manage municipality- and institution-specific catalogs; configure statuses, service types, territories, evidence categories, program types, framework types, periods, and labels; version formulas and rules; validate required fields; monitor completeness, duplication, reconciliation, freshness, and source lineage; promote configuration through approved states.

**Data:** Catalog, configuration key, scope, organization, municipality, version, validity, owner, source, rule, formula, quality issue, reconciliation state, and lineage.

**Permissions:** Platform defaults and institution overrides are separate authorities. Clinical rules, regulatory interpretations, and financial formulas require domain-specific approval. Configuration cannot bypass authorization or audit.

**Audit:** Configuration creation, versioning, activation, override, rollback reference, rule change, formula change, source change, and quality-resolution action.

**Dependencies:** Institutions; authorization; audit; all configurable modules.

**Prototype reference:** Hospital configuration tabs, institution and integration settings, agenda/services, semaphore and alert settings, and municipal filters and periods.

**MVP presence:** Operational and foundational.

**Initial implementation:** No production behavior tied to a named municipality; scoped catalogs, effective dates, owners, sources, and version history.

**Future evolution:** Configuration packages, controlled delegation, validation environments, cross-municipality templates, and automated quality monitoring.

# INTEGRACIONES

## 33. Integration and data-exchange management

**Objective:** Provide a governed boundary for importing, exporting, synchronizing, and reconciling authorized external information.

**Users:** Authorized technical administrators, data owners, security and privacy personnel, institutional integration owners, and auditors.

**Functions:** Register integration purpose and owner; configure institution scope; define authorized datasets and mappings; import or export; validate, quarantine, reconcile, retry, and monitor; identify manual, file-based, or connected modes; retain provenance; disable access; report errors without exposing secrets.

**Data:** Integration, external system, institution, purpose, legal or contractual basis, authorized fields, mapping version, execution, source record reference, error, reconciliation, credential reference, and status.

**Permissions:** Integration administration is separate from business-data access. Data exchange is minimized by purpose and institution. Secrets are never stored in source code or ordinary audit output. Imported data is not automatically treated as valid, official, or clinically authoritative.

**Audit:** Configuration, activation, suspension, credential-reference change, import, export, synchronization, failure, retry, quarantine, reconciliation, and scope change.

**Dependencies:** Identity; institutions; authorization; audit; data quality; each participating module.

**Prototype reference:** Hospital clinical import, integration-status configuration, videoconference provider, WhatsApp, SENA, ADRES/FURAG, payment providers, and external-system diagram references.

**MVP presence:** Foundation operational; integration states visible. External systems may initially be represented by controlled data, documentary load, or manual configuration.

**Initial implementation:** Governed import templates and source metadata for hospital clinical information, ADRES-related information, FURAG/MIPG evidence, SENA evidence, and payment references; no assumption of live connectivity.

**Future evolution:** Approved APIs, event exchange, standards-based clinical interoperability, automated reconciliation, monitoring, and partner certification.

## 34. Planned integration families

The following are integration families, not commitments to a specific provider or implementation technology:

### 34.1 Hospital clinical source

- **MVP:** Controlled file, approved institutional load, or read-only connection if available; explicit source and synchronization status.
- **Future:** Approved interoperable exchange and reconciliation.

### 34.2 FURAG/MIPG and official institutional sources

- **MVP:** Manual or controlled framework, evidence, period, and official-value references.
- **Future:** Authorized official-source updates. MERDN never invents or relabels an internal score as an official Función Pública score.

### 34.3 ADRES-related sources

- **MVP:** Controlled authorized datasets or documents with provenance and limitations.
- **Future:** Authorized exchange and reconciliation. MERDN is not ADRES and does not issue official ADRES evaluations.

### 34.4 SENA and training providers

- **MVP:** Approved links, controlled offerings, manual enrollment state, and certificate evidence.
- **Future:** Program discovery, enrollment-status, completion, and certificate verification exchange.

### 34.5 Messaging and notifications

- **MVP:** In-product notifications and visible channel configuration.
- **Future:** Approved WhatsApp, email, SMS, and push services with consent and sensitive-content controls.

### 34.6 Virtual consultation

- **MVP:** Scheduled modality with controlled session reference or manual coordination.
- **Future:** Approved videoconference provider, attendance events, and secure encounter context.

### 34.7 Payments and billing

- **MVP:** Manual or controlled charge and payment references with evidence; no production payment processing.
- **Future:** Approved gateway or billing integration, reconciliation, refunds, and receipts.

### 34.8 Future regulatory, public, and institutional sources

- **MVP:** The regulatory hub supports new framework configuration without application redesign.
- **Future:** Additional norms, entities, obligations, datasets, and evidence repositories through governed integrations.

# HUB INSTITUCIONAL, NORMATIVO Y DE EVIDENCIAS

## 35. Hub relationship model

The Hub is the shared institutional structure behind FURAG, MIPG, authorized ADRES-related management, Sentencia T-319 de 2025, SENA-related institutional evidence, and future norms, entities, obligations, and evidence frameworks. These named frameworks are initial configurations of an extensible capability, not five isolated technical applications.

Every Hub record must be able to relate, when applicable:

| Required concept | Functional meaning |
| --- | --- |
| Norm or entity | Issuing authority, institution, legal instrument, policy, framework, or external entity |
| Requirement | Versioned obligation, question, criterion, commitment, or management requirement |
| Period | Reporting, applicability, execution, or assessment period |
| Institution | Municipality, hospital, provider, organizational unit, or accountable entity |
| Program | Institutional or public program affected by the requirement |
| Responsible party | Accountable owner, contributor, reviewer, or approver |
| Population | Beneficiary or target population, using authorized and privacy-appropriate detail |
| Activity | Operational, corrective, preventive, training, financial, or reporting action |
| Indicator | Defined measure with formula, owner, period, source, version, and validation state |
| Source | Authoritative, institutional, imported, manual, or controlled origin |
| Document | Source document, policy, contract, certificate, report, or supporting file |
| Evidence | Versioned proof linked to the requirement, action, activity, resource, or result |
| Budget or resource | Related allocation, expense, health resource, contract, or nonfinancial resource |
| Result | Verified output or outcome, clearly distinguished from a target or assertion |
| Gap | Difference between required and evidenced state, including its approved assessment basis |
| State | Draft, applicable, assigned, in progress, evidenced, reviewed, closed, expired, or another configured state |
| Update date | Last material update, source date, and freshness context |

The Hub must preserve framework version, jurisdiction, applicability decision, approved interpretation, source provenance, evidence history, responsible institution, and audit trail. Internal calculations or interpretations must never be presented as official external determinations.

### Initial Hub configurations

- **FURAG and MIPG:** dimensions, requirements, periods, responsible parties, evidence, indicators, gaps, actions, and official-source references. MERDN does not issue official Función Pública scores.
- **ADRES:** authorized information and resource references, institution, population or program relationships, evidence, periods, provenance, and reconciliation status. MERDN is not ADRES and does not issue official ADRES evaluations.
- **Sentencia T-319 de 2025:** authoritative source, institution-approved applicability and interpretation, requirements, affected populations, actions, owners, evidence, indicators, and gaps. No single record proves complete compliance.
- **SENA:** training offerings or source references, caregiver participation, completion or certification evidence, verification state, program, institutional requirement, and indicators. MERDN is not a certifying authority unless a specific authorized role and source establish that status.
- **Future frameworks:** new entities, norms, obligations, sources, and indicator structures must be configurable without redesigning the core product.

### Hub MVP implementation

The MVP includes manual configuration, controlled source registration, documentary upload, responsibility assignment, gap and action tracking, and clearly labeled controlled or demonstration data. Live external integrations may evolve later, but the relationships and audit model are present from the initial design.

# MODELO DE VALOR ECONÓMICO DEL HOSPITAL

## 36. Hospital economic-value chain

The Hospital Commercial Core and Financial Core together represent hospital sustainability without turning MERDN into a full accounting, billing, or payment-processing system.

The model distinguishes:

1. **Institutionally funded services:** services financed by a municipality, program, contract, insurer, hospital allocation, or another approved institutional source.
2. **Private services:** services requested and funded outside an institutional program under approved hospital rules.
3. **Home visits:** scheduled services with professional assignment, delivery evidence, completion state, cost or charge reference, and outcome.
4. **Virtual consultations:** scheduled remote services with controlled session reference, delivery evidence, and charge or funding relationship.
5. **Memberships:** versioned plans that grant defined service entitlements for a validity period.
6. **Individual payments:** manual or integrated payment references linked to an approved charge; production payment processing is not assumed in the MVP.
7. **Programs:** public, institutional, sponsored, or commercial contexts that group population, services, resources, evidence, and results.
8. **Generated income:** controlled revenue or receivable visibility derived from delivered and supported services, clearly distinguished from official accounting recognition.
9. **Delivery evidence:** visit, consultation, professional, beneficiary or account, date, state, document, acceptance, or other approved proof.
10. **Agenda-to-income relationship:** agenda → authorized service or entitlement → charge or funding allocation → documented delivery → evidence review → payment or execution reference → income or resource report.

### Economic relationship rules

- A scheduled appointment does not by itself constitute a delivered service or earned income.
- A completed service requires the approved delivery evidence before it can become eligible for a charge, execution, or income reference.
- A membership entitlement, public-program authorization, and private charge are distinct funding mechanisms even when they reference the same service catalog.
- Financial users do not acquire clinical access by managing charges, budgets, or income.
- Financial corrections preserve the original record and use traceable adjustments.
- Controlled or demonstration amounts must be labeled and cannot be reported as official accounting figures.

### Economic MVP implementation

The MVP includes a configurable service catalog, hospital agenda, home and virtual modalities, versioned membership or plan data, manual charge or payment references, basic budget and execution relationships, delivery evidence, and income-oriented reports. Automated billing, gateway processing, formal accounting recognition, tax handling, refunds, and reconciliation remain advanced implementation subject to approval.

# PORTALES Y EXPERIENCIAS

## 37. Shared modules and differentiated experiences

The same functional modules feed all portals. Patient, Caregiver, Professional, Hospital, Municipal Government, Administration, and Audit are differentiated experiences, not seven independent technical applications.

| Experience | Primary shared capabilities | Required access boundary |
| --- | --- | --- |
| Patient | Own profile, relationships, agenda, care log, visits, authorized hospital information, notifications, training where relevant, membership or payment references, and Elí | Own information and explicitly authorized shared records |
| Caregiver | Authorized patients, relationship scope, care logs, appointments, visits, developments, instructions, training, certification, evidence, and notifications | Each patient relationship is independently validated, scoped, institution-bound, stateful, and time-bound |
| Professional | Assigned patients, agenda, visits, virtual consultations, authorized hospital information, continuity notes, alerts, evidence, and service metrics | Valid professional credential, institution, assignment, purpose, and permitted data category |
| Hospital | People, programs, professional capacity, agenda, care operations, alerts, authorized clinical source, evidence, services, memberships, income opportunities, finance, indicators, reports, and compliance | Hospital organization and authorized interinstitutional relationships; administrative roles do not inherit clinical access |
| Municipal Government | Beneficiary population, territory, programs, budgets, execution, suppliers, evidence, indicators, FURAG/MIPG, ADRES-related management, T-319, SENA evidence, gaps, actions, and executive reports | Municipality, institution, territory, purpose, aggregation, and data minimization; no unrestricted individual clinical access |
| Administration | Institution, municipality, catalog, identity, role, integration, configuration, and platform operations | Delegated administrative scope; no implicit clinical, financial, or compliance-content access |
| Audit | Authorized event history, evidence lineage, access records, financial changes, compliance changes, findings, and correction verification | Read-only or controlled review scope with domain separation and audit-of-audit |

## 38. Hospital and Municipal Government experiences

Hospital and Municipal Government are both fundamental parts of MERDN and of the MVP, but they use shared capabilities differently:

| Shared capability | Hospital experience | Municipal Government experience |
| --- | --- | --- |
| People and population | Individual authorized care coordination | Aggregated beneficiary, territory, coverage, and gap management by default |
| Programs | Enrollment, assignment, services, and operations | Program ownership, coverage, resources, evidence, and results |
| Care operations | Appointments, visits, virtual consultations, logs, alerts | Aggregated service delivery and authorized program follow-up |
| Clinical information | Authorized hospital-supplied detail according to assignment | No unrestricted individual clinical access |
| Financial core | Service cost, income opportunities, expenses, and support | Budget, allocation, execution, populations, suppliers, and evidence |
| Evidence | Clinical-operational, service, financial, contractual, and training evidence | Program, budget, regulatory, FURAG/MIPG, ADRES-related, and executive evidence |
| Compliance | Hospital responsibilities and improvement actions | Municipal frameworks, responsible parties, gaps, actions, and oversight |
| Indicators | Operational, service, quality, capacity, and income indicators | Population, territory, coverage, resource, compliance, and result indicators |

Neither experience duplicates the underlying modules. Access to shared records is governed by organization, territory, purpose, relationship, assignment, sensitivity, consent or other approved authorization, and data minimization.

# MVP ESTRUCTURAL

## 39. Recommended MVP module map

The MVP includes all strategic cores, with different implementation depth:

### Operational MVP

- People and profiles.
- Many-to-many authorized caregiver-patient relationships.
- Professional assignments.
- Configurable program enrollment.
- Agenda and home visits.
- Visible virtual consultation workflow.
- Care log and continuity.
- Authorized hospital-supplied clinical summary with provenance.
- Manually governed alerts and follow-up.

### Institutional MVP

- Configurable municipality, hospital, territory, organization, programs, responsibilities, and population catalogs.
- Differentiated Hospital and Municipal Government experiences.
- Beneficiary, territory, coverage, capacity, pending-action, and data-quality views.

### Financial MVP

- Budget source, allocation, expense, execution percentage, supplier, activity, population or authorized beneficiary relationship, and support evidence.
- No claim of official accounting, general ledger, or production payment processing.

### Evidence and compliance MVP

- Central evidence repository.
- Extensible regulatory hub.
- Visible FURAG/MIPG management.
- Visible ADRES-related resource and evidence management.
- Configurable representation of Sentencia T-319 de 2025 and other approved care-related requirements.
- Responsible parties, gaps, actions, evidence, indicators, sources, periods, and audit history.

### Hospital commercial MVP

- Configurable service catalog and capacity.
- Visible home-visit and virtual-consultation revenue opportunities.
- Versioned memberships or plans using controlled data.
- Manual charges and payment references with evidence.

### Cross-cutting MVP

- Identity, contextual authorization, audit, in-product notifications, accessible onboarding, caregiver training evidence, Elí deterministic guidance, shared configuration, data quality, and provenance.

### Integration MVP

- Governed manual, documentary, or file-based data exchange with explicit source and status.
- Visible integration catalog and readiness states.
- No fabricated live connection or official status.

# DEPENDENCIAS ENTRE MÓDULOS

## 40. Principal dependencies and implementation sequence

This is a functional dependency sequence, not a technology plan:

1. Shared configuration, institutions, municipalities, territories, identity, and audit.
2. People, profiles, authorization policy, relationships, consent, and professional assignments.
3. Programs, population, responsibilities, service catalog, and evidence categories.
4. Agenda, care activity, authorized clinical display, alerts, and notifications.
5. Budget, expenses, suppliers, activities, evidence chain, and execution indicators.
6. Regulatory hub, FURAG/MIPG, ADRES-related management, Sentencia T-319 configuration, gaps, and actions.
7. Hospital plans, memberships, charge references, training evidence, and controlled integration inputs.
8. Cross-domain indicators and reports for Hospital and Municipal Government.

No module that exposes sensitive individual data is complete without contextual authorization, tenant or organization enforcement, source provenance, and audit events.

## 41. Relationships and open decisions by module

The detailed module definitions above are completed by the following per-module relationship and decision register. “Open” means that the capability remains in the model but its detailed production behavior cannot be silently assumed.

| Module | Principal relationships with other modules | Decisions still open |
| --- | --- | --- |
| 5. People, beneficiaries, caregivers, and professionals | Identity; institutions; relationships; programs; population; evidence; clinical source | Minimum personal dataset; authoritative population classifications; deduplication and cross-institution matching rules; exact geospatial detail |
| 6. Relationships, authorizations, consent, and assignments | People; institutions; programs; professional assignments; clinical access; audit | Legal representation types; validators; consent texts and bases; renewal; conflict resolution; emergency-access policy |
| 7. Program enrollment and case coordination | Population; institutions; services; care operations; budget; evidence; indicators | Program types; eligibility; wait lists; transfer and discharge rules; responsible institution; public versus commercial program boundary |
| 8. Agenda, appointments, and service coordination | Services; people; relationships; professionals; visits; virtual consultations; notifications; charges | Scheduling authority; duration and availability rules; cancellations; route handling; external calendars; virtual-session provider |
| 9. Care log, home visits, virtual consultations, and continuity | Agenda; clinical source; alerts; evidence; indicators; service delivery; payments or execution | Approved forms; signature and closure; location evidence; offline work; correction rules; evidentiary standard; professional record boundary |
| 10. Authorized clinical information and medications | Hospital; patients; caregivers; professionals; care operations; integrations; audit | Exact clinical dataset; source system; write-back prohibition or scope; terminology; reconciliation; retention; emergency access |
| 11. Alerts, developments, and follow-up | Care log; agenda; finance; compliance Hub; notifications; responsible parties; audit | Taxonomy; validated clinical rules; priority authority; escalation times; after-hours responsibility; emergency channel |
| 12. Institutions, municipalities, territories, and configuration | Identity; population; programs; finance; evidence; integrations; reporting | Tenant and organizational hierarchy; multi-affiliation; authoritative geography; interinstitutional agreements; deployment ownership |
| 13. Beneficiary population and territorial management | People; territories; programs; budget; indicators; reports | Official sources; category governance; deduplication; small-group privacy thresholds; map precision; gap definition |
| 14. Institutional operations, responsibilities, and capacity | Institutions; personnel; programs; services; Hub requirements; alerts; reports | Responsibility catalog; capacity measures; workload rules; supervisory detail; cross-provider coordination |
| 15. Budget, allocation, execution, and resource traceability | Programs; populations; activities; suppliers; evidence; indicators; ADRES-related sources | Official financial source; approval workflow; periods; commitment model; cost allocation; beneficiary-level linkage; reconciliation |
| 16. Suppliers, contracts, expenses, and support | Budget; programs; activities; evidence; reports; payments | Procurement scope; contract lifecycle; invoice source; approval segregation; payroll and inventory inclusion; supplier access |
| 17. Institutional documents and evidence repository | Every operational, institutional, financial, commercial, and compliance module | File and size policy; integrity mechanism; signature; validity; retention; disposition; legal evidentiary requirements; external repository |
| 18. Institutional, regulatory, and evidence Hub | FURAG/MIPG; ADRES; T-319; SENA; institutions; programs; evidence; indicators; budget | Framework governance; applicability authority; interpretation approval; status catalog; reuse rules; regulatory update ownership |
| 19. FURAG and MIPG management | Hub; evidence; indicators; responsible parties; reports; integrations | Authorized sources; exact dimensions and periods; official versus internal values; submission scope; institutional reviewers |
| 20. ADRES-related information and resource traceability | Hub; financial core; population; programs; evidence; integrations | Authorized datasets; legal basis; institutional meaning; formulas; reconciliation; update frequency; individual-data scope |
| 21. Sentencia T-319 de 2025 and applicable regulation | Hub; population; programs; actions; evidence; indicators; audit | Authoritative legal source; approved interpretation; applicability; responsible institutions; requirements and proof standards |
| 22. Indicators, results, reports, and lineage | All source modules; Hub; finance; Hospital and Municipal portals | Indicator catalog; formulas; targets; owners; periods; official status; privacy thresholds; publication and export rules |
| 23. Hospital service catalog, capacity, and revenue opportunities | Agenda; professionals; programs; memberships; charges; evidence; finance | Approved services; prices; coverage; capacity rules; public/private distinction; billing and regulatory requirements |
| 24. Memberships, plans, and entitlements | Services; patients; caregivers; agenda; charges; notifications; evidence | Commercial approval; terms; renewal; eligibility; benefit limits; cancellation; sponsorship; consumer-protection requirements |
| 25. Charges, payment references, and hospital income visibility | Services; memberships; delivered activities; evidence; finance; payment integrations | Charging authority; payment channels; invoice or receipt rules; refunds; reconciliation; accounting-system boundary; sensitive payment data |
| 26. Identity, access, onboarding, and account lifecycle | People; institutions; authorization; notifications; audit | Authentication methods; identity proofing; recovery without email; privileged assurance; account-retention and support-access rules |
| 27. Authorization and permission policy | Identity; institutions; relationships; assignments; every protected resource | Definitive role matrix; purpose-based access; field controls; temporary access; export authority; emergency access; delegated administration |
| 28. Audit, traceability, and control | Every module; findings; evidence; security and privacy review | Retention; immutability mechanism; sensitive-value minimization; audit access; monitoring; incident integration; export rules |
| 29. Notifications and communications | Identity; agenda; alerts; training; Hub; evidence; payment status; integrations | Approved channels; consent or legal basis; sensitive content; templates; quiet hours; delivery evidence; channel costs |
| 30. Caregiver training, competency, and certification | People; programs; Hub; SENA; evidence; indicators; notifications | Recognized training; verification authority; validity; effect on assignments; SENA agreement; renewal; institutional reporting |
| 31. Elí guidance and accessible interaction | Onboarding; care log; notifications; training; content; audit | AI scope; voice; languages; content approval; conversation retention; human handoff; accessibility modes; evaluation criteria |
| 32. Shared configuration, catalogs, data quality, and provenance | All modules; municipalities; institutions; rules; formulas; integrations | Platform defaults versus local overrides; approval and promotion; catalog ownership; quality thresholds; configuration portability |
| 33. Integration and data-exchange management | Hospital clinical source; FURAG/MIPG; ADRES; SENA; messaging; video; payments; all consuming modules | Providers and contracts; formats; field mappings; frequency; credentials; failure ownership; reconciliation; data residency; service levels |

## 42. Explicit boundaries and unresolved decisions

This module specification does not approve:

- MERDN as an Electronic Health Record.
- Autonomous diagnosis, prescribing, or clinical decision-making.
- Prototype semaphore thresholds as validated clinical rules.
- MERDN as a governmental accounting system.
- MERDN as an official FURAG scoring authority.
- MERDN as ADRES or as an official ADRES evaluation authority.
- A production payment processor.
- A single document, integration, indicator, or action as proof of complete legal or regulatory compliance.
- A definitive technology, hosting, tenancy, interoperability, notification, payment, or AI implementation.

The following still require Product Owner and specialist definition before production implementation of their detailed behavior:

1. Exact personal and clinical dataset exposed in the MVP.
2. Exact municipal access to patient-level data, if any beyond exceptional approved purposes.
3. Formal consent and representation rules.
4. Indicator catalog, formulas, periods, owners, and privacy thresholds.
5. Authoritative FURAG/MIPG, ADRES, Sentencia T-319, and other regulatory sources and approved interpretations.
6. Budget and expense sources, approval workflow, and relationship to official financial systems.
7. Commercial plan, price, billing, payment, and refund rules.
8. Notification channels and permitted content.
9. Integration contracts, data mappings, and responsible institutions.
10. Data retention, evidence validity, digital signature, and disposition rules.
11. Detailed roles and permissions to be formalized in `docs/ROLES.md`.
12. Data ownership and classification to be formalized in `docs/DATA.md` and `docs/SECURITY.md`.

## 43. Relationship with `docs/PRODUCT.md`

The approved decisions represented here refine the open product decisions in `docs/PRODUCT.md`:

- Municipal Government participation in the MVP is now approved.
- The initial clinical scope is now constrained to authorized hospital-supplied information with explicit provenance.
- The many-to-many patient-caregiver relationship and its required authorization attributes are now approved.
- Municipality-neutral configurability from the first production code is now approved.
- FURAG/MIPG, ADRES-related management, the extensible regulatory hub, financial traceability, caregiver training evidence, and the hospital commercial value proposition must be visible in the MVP, although detailed integrations and official meanings remain subject to definition.

These refinements do not contradict the explicit non-goals in `docs/PRODUCT.md`: the MVP remains neither a replacement EHR, nor a governmental accounting system, nor an official FURAG or ADRES authority, nor a production payment processor, nor an autonomous clinical AI system.
