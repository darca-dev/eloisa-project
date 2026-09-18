# MERDN Product Definition

## 1. Product Name

Working technical name: MERDN

The existing Claude Design prototype may contain the names Elí or Elígeme.

Brand naming is not considered technically final unless explicitly approved by the Product Owner.

---

## 2. Product Purpose

MERDN is a web platform designed to help public institutions, healthcare providers, patients, caregivers, and health professionals coordinate, document, monitor, and evaluate care, vulnerable-population programs, institutional management, resource use, evidence, compliance, and results.

MERDN is not merely a home-care application. Home care and continuity of care are a central operational capability within a broader institutional product that also serves hospitals and municipal governments through financial traceability, evidence, indicators, regulatory management, reports, caregiver training, and hospital sustainability capabilities.

The platform must provide verifiable information about:

1. Who is receiving services
2. What services are being provided
3. Who provided the service
4. When and where the service occurred
5. What follow-up is required
6. What alerts or relevant events occurred
7. What institutional resources are being used
8. What documentary evidence supports the activity
9. What outcomes and indicators are being generated
10. What information can be reported to institutional decision makers

MERDN should transform fragmented operational information into traceable, auditable, and useful institutional evidence.

---

## 3. Approved Product Decisions

The following are approved product decisions. Their presence in the product is no longer an open question, although their detailed implementation may remain open:

1. MERDN must be configurable for multiple municipalities from its initial design. It must not be built around one hard-coded pilot municipality.
2. Municipal Government is part of the MVP and of MERDN's central value proposition.
3. Hospitals and municipal governments are both central product actors. Patient, Caregiver, Professional, Hospital, Municipal Government, Administration, and Audit are differentiated experiences over shared capabilities rather than independent technical applications.
4. MERDN does not initially replace an Electronic Health Record.
5. Clinical information shown in the MVP must be authorized information supplied by the hospital, with its source and provenance identified.
6. A patient may have multiple caregivers, and a caregiver may be authorized for multiple patients.
7. Each relationship among patient, caregiver, professional, and institution must preserve its own authorization, scope, state, and validity.
8. FURAG and MIPG are structurally present from the MVP for evidence, indicators, responsible-party management, gaps, and traceability. MERDN must not attribute official scores that were not issued by the corresponding authority.
9. ADRES-related management is structurally present from the MVP through authorized information, sources, evidence, health resources, and indicators. Official integrations may be implemented later, and MERDN is not an ADRES authority.
10. Sentencia T-319 de 2025 must be representable within an extensible Institutional, Regulatory, and Evidence Hub.
11. SENA-related sources and caregiver training and certification are structural parts of the institutional value proposition and may produce institutional evidence.
12. MERDN must provide an extensible Institutional, Regulatory, and Evidence Hub for future norms, entities, obligations, requirements, sources, and indicators.
13. Basic budget, resource allocation, expenses, execution, suppliers, supporting evidence, and percentages are part of the institutional MVP value proposition.
14. MERDN is not an official accounting system unless that scope is approved separately in the future.
15. Hospital scheduling, home visits, virtual consultations, marketable services, memberships, and payments are parts of the hospital sustainability and potential-income model.
16. The MVP may initially manage controlled payment references or states. Production payment processing may be implemented later after separate approval.
17. Institutional evidence, indicators, percentages, traceability, audit, and institutional and executive reports are central MERDN functions.
18. Where a live integration is not initially available, an MVP capability may use approved manual configuration, controlled data, documentary upload, or controlled import, while clearly identifying its source and status.

These decisions approve product direction and structural presence. They do not silently approve exact formulas, official sources, legal interpretations, commercial rules, prices, providers, data fields, integrations, or technical architecture.

---

## 4. Primary Product Problem

Home-care services and programs for older adults, people with disabilities, dependent patients, caregivers, and other vulnerable populations may involve multiple actors and disconnected information sources.

This can create problems such as:

1. Limited visibility of the population actually receiving services
2. Fragmented patient and caregiver information
3. Weak coordination between institutions and professionals
4. Manual or incomplete home-care records
5. Difficulty demonstrating what services were delivered
6. Difficulty linking expenditures to actual beneficiaries and evidence
7. Limited traceability of changes and actions
8. Insufficient management indicators
9. Difficulty generating executive and institutional reports
10. Limited evidence for planning, oversight, resource allocation, and compliance

MERDN is intended to create a unified operational and evidence layer across these activities.

---

## 5. Primary Users

### 5.1 Patient

A person receiving or requiring home, virtual, or coordinated care.

The patient experience should prioritize simplicity, accessibility, large readable interfaces, guided workflows, and minimal technical complexity.

Potential capabilities include:

1. View personal information
2. View scheduled care
3. Complete or participate in care logs
4. Report relevant events
5. View medications and care information where authorized
6. Request or manage appointments
7. Receive notifications
8. Access educational content
9. Interact with Elí for navigation and workflow guidance
10. Review visits and service information

---

### 5.2 Caregiver

A person responsible for supporting one or more patients.

Potential capabilities include:

1. View authorized patients
2. Complete care logs
3. Record observations and relevant events
4. Record authorized measurements
5. Review schedules
6. Review care instructions
7. Receive alerts and notifications
8. Access caregiver education
9. Upload authorized supporting evidence
10. Manage caregiver certifications or training information where applicable

A caregiver may have valid relationships with multiple patients, and a patient may have multiple caregivers. Access must be evaluated separately for each relationship according to its authorization, scope, institution, state, and validity.

---

### 5.3 Health Professional

A professional responsible for health or home-care activities.

Potential capabilities include:

1. View assigned patients
2. Review authorized patient information
3. Review care logs
4. Manage daily agenda
5. Record home visits
6. Record professional observations
7. Create authorized follow-up information
8. Review relevant alerts
9. Communicate information to the next authorized professional
10. Review performance and service metrics where applicable

Professional access must depend on authorization, assignment, institutional scope, and applicable patient relationships.

---

### 5.4 Hospital or Healthcare Provider

An institution responsible for coordinating health professionals, patients, services, visits, and operational resources.

Potential capabilities include:

1. Patient management
2. Professional management
3. Appointment management
4. Home-visit management
5. Virtual-care management
6. Alert monitoring
7. Service-quality monitoring
8. Program management
9. Membership or service-plan management where applicable
10. Provider management
11. Contract and support-document management
12. Reports
13. Evidence
14. Institutional configuration
15. User and access management

---

### 5.5 Municipal Government

A public-sector institutional user requiring aggregated operational, territorial, financial, documentary, and outcome visibility.

Potential capabilities include:

1. Beneficiary population monitoring
2. Territorial distribution
3. Program monitoring
4. Budget visibility
5. Expense and execution evidence
6. Supporting documentation
7. Population coverage
8. Service delivery indicators
9. Caregiver and training indicators
10. FURAG/MIPG-related management evidence
11. ADRES-related information and evidence
12. Care-right monitoring
13. Attention-gap analysis
14. Executive indicators
15. Executive reports
16. Evidence supporting institutional management

Municipal users must not automatically receive unrestricted access to individual clinical information.

Access must follow approved purpose, legal basis, authorization, and data-minimization rules.

Municipal Government is an approved MVP experience and a central part of MERDN's institutional value proposition.

---

### 5.6 Platform Administrator

A privileged role responsible for authorized technical and platform administration.

Potential responsibilities include:

1. Institution configuration
2. Tenant configuration
3. User administration
4. Role administration
5. Permission administration
6. Integration configuration
7. Platform monitoring
8. Audit administration
9. Authorized support activities

Administrative privilege must not imply unrestricted clinical-data access.

---

## 6. Product Domains

MERDN should conceptually separate the following domains.

### 6.1 Identity and Access

Includes:

1. Registration
2. Authentication
3. Users
4. Roles
5. Permissions
6. Organizations
7. Relationships
8. Delegation
9. Consent
10. Account recovery

---

### 6.2 Population and Beneficiaries

Includes:

1. Patients
2. Caregivers
3. Vulnerability classifications
4. Population groups
5. Territorial information
6. Institutional assignment
7. Program enrollment
8. Authorized relationships

---

### 6.3 Care Operations

Includes:

1. Care logs
2. Home visits
3. Virtual consultations
4. Appointments
5. Professional assignments
6. Relevant observations
7. Care activities
8. Follow-up
9. Events
10. Alerts

---

### 6.4 Institutional Operations

Includes:

1. Hospitals
2. Municipal governments
3. Providers
4. Programs
5. Personnel
6. Contracts
7. Service capacity
8. Operational configuration

---

### 6.5 Evidence and Documents

Includes:

1. Supporting documents
2. Payment evidence
3. Program evidence
4. Visit evidence
5. Contracts
6. Certificates
7. Institutional documents
8. Report attachments
9. Evidence metadata
10. Evidence history

---

### 6.6 Financial and Resource Monitoring

Potentially includes:

1. Program budgets
2. Allocations
3. Expenses
4. Payroll-related information where applicable
5. Suppliers
6. Contracts
7. Supporting invoices
8. Execution percentages
9. Cost-per-beneficiary indicators
10. Financial evidence

This domain is structurally present in the MVP at a basic management and evidence level.

MERDN must not be assumed to be a governmental accounting system unless that scope is separately approved.

---

### 6.7 Indicators and Results

Includes:

1. Population coverage
2. Service activity
3. Care activity
4. Alerts
5. Outcomes
6. Program indicators
7. Territorial indicators
8. Caregiver indicators
9. Service quality
10. Budget execution
11. Institutional results

Every production indicator must eventually have a defined source, formula, period, owner, and update methodology.

---

### 6.8 FURAG and MIPG

MERDN will structurally organize and present information useful for institutional management and evidence associated with FURAG and MIPG processes from the MVP.

MERDN must not claim that a value, score, evaluation, or recommendation is officially issued by Función Pública unless it comes from an authorized official source.

The product may support:

1. Evidence organization
2. Indicator monitoring
3. Gap visualization
4. Supporting documents
5. Historical comparisons
6. Management tracking
7. Responsible-party tracking

Exact sources, formulas, periods, official integrations, submission behavior, and institutional validation remain to be defined separately.

---

### 6.9 ADRES

MERDN will structurally organize, monitor, and contextualize authorized ADRES-related information from the MVP and may integrate with authorized sources where technically and legally available.

Potential use cases include:

1. Resource visibility
2. Institutional evidence
3. Population and service relationships
4. Authorized financial information
5. Supporting indicators
6. Reporting

The definitive meaning of an “ADRES evaluation” must not be invented by the software.

Data source, integration method, formulas, and institutional meaning must be formally defined before implementation.

---

### 6.10 Reporting

The platform must support role-appropriate institutional and executive reporting, beginning with a controlled MVP scope, for:

1. Healthcare providers
2. Municipal governments
3. Program managers
4. Authorized operational users
5. Executive leadership

Reports should be generated from traceable data rather than manually embedded values.

---

### 6.11 Institutional, Regulatory, and Evidence Hub

MERDN must provide an extensible Hub that relates institutional and regulatory frameworks to requirements, periods, institutions, programs, responsible parties, populations, activities, indicators, sources, documents, evidence, resources, results, gaps, states, and update history.

Initial structural configurations include:

1. FURAG
2. MIPG
3. ADRES-related management
4. Sentencia T-319 de 2025
5. SENA-related training and certification evidence

The Hub must support future norms, entities, obligations, sources, and institutional frameworks without redesigning the product. MERDN must distinguish authoritative source material, institution-approved interpretation, internal management status, and official external determinations.

---

### 6.12 Hospital Sustainability and Commercial Services

MERDN must support a hospital value model that relates service catalog, capacity, agenda, home visits, virtual consultations, programs, memberships, controlled charges or payments, delivery evidence, and potential income visibility.

The initial MVP may use controlled service, membership, price-reference, charge, or payment-state data. Exact commercial rules, prices, billing, collection, refunds, and production payment processing remain open and require separate approval.

---

## 7. Elí

Elí is the user-facing digital guide represented in the existing prototype.

The intended role of Elí is initially:

1. Guide users through workflows
2. Explain interface actions
3. Help patients and caregivers complete forms
4. Improve accessibility and comprehension
5. Surface relevant platform notifications
6. Help users locate information
7. Provide approved educational guidance

Elí must not be assumed to be:

1. A physician
2. An autonomous diagnostic system
3. A prescribing system
4. A replacement for a health professional

Any future AI capabilities must be separately defined, risk-assessed, tested, and authorized.

---

## 8. Product Principles

MERDN should follow these principles.

### Evidence First

Important institutional activity should produce traceable evidence.

### Security by Design

Sensitive information must be protected by architecture, not only by interface restrictions.

### Least Privilege

Users should access only the information required for their authorized responsibilities.

### Human-Centered Design

Patient and caregiver experiences must be simple and understandable.

### Institutional Traceability

Material actions should be attributable to a user, organization, date, and context.

### Data Separation

Clinical, operational, financial, territorial, and documentary information should be conceptually separated even when connected.

### Reuse

Shared functions should be reused rather than duplicated across interfaces.

### Accessibility

The platform should support older adults, caregivers, people with disabilities, and users with varying digital literacy.

### Verifiable Indicators

Institutional indicators must eventually have identifiable sources and formulas.

### Progressive Complexity

MERDN should begin with a controlled MVP rather than attempting to implement every prototype capability at once.

Progressive implementation must not remove strategic domains from the product model merely because their first MVP form uses manual configuration, controlled data, documentary evidence, or later integration.

---

## 9. Current Prototype Status

The Claude Design prototype is not the production application.

It currently provides:

1. Visual references
2. User-flow references
3. Preliminary screen organization
4. Preliminary interaction concepts
5. Demonstration data
6. Preliminary institutional dashboard concepts

It does not currently provide production-grade:

1. Authentication
2. Authorization
3. Database persistence
4. Backend services
5. APIs
6. Real institutional integrations
7. Audit trail
8. Tenant isolation
9. Production security
10. Production deployment

---

## 10. Current Product Phase

MERDN is currently in product formalization, modular specification, and technical discovery.

The strategic product direction and functional module map are now documented. The immediate goal is to formalize roles and permissions, data domains, security requirements, detailed MVP acceptance boundaries, architecture, and a safe vertical slice before production implementation.

The current sequence is:

1. Maintain the approved product definition
2. Maintain the approved functional module map
3. Define roles and permissions
4. Define data domains, ownership, classification, and lineage
5. Define security and privacy requirements
6. Define detailed MVP acceptance boundaries
7. Define architecture
8. Define a safe vertical slice and Task Specification
9. Claude Code implementation
10. Testing and Codex audit
11. Product Owner acceptance
12. Authorized Git integration and deployment

---

## 11. Preliminary MVP Principle

The MVP must prove both MERDN's care-operation value and its institutional value. It must securely connect authorized users and relationships, care activity, Hospital and Municipal Government experiences, beneficiary population, programs, evidence, indicators, basic resource traceability, compliance management, auditability, and hospital service sustainability.

The MVP must structurally include, at different implementation depths:

1. Patient, caregiver, professional, hospital, and Municipal Government experiences
2. Many-to-many patient-caregiver relationships and professional assignments
3. Programs, agenda, care logs, home visits, virtual-consultation visibility, developments, and follow-up
4. Authorized hospital-supplied clinical information with provenance
5. Beneficiary population, territory, evidence, indicators, percentages, reports, and audit
6. Basic budgets, allocation, expenses, execution, suppliers, and supporting evidence
7. The Institutional, Regulatory, and Evidence Hub, including FURAG/MIPG, ADRES-related management, Sentencia T-319 de 2025, and SENA-related evidence
8. Hospital service catalog, commercial agenda, memberships or plans, and controlled charge or payment references

Some capabilities may initially be visible and manageable through approved configuration, controlled data, documentary upload, or controlled imports. This does not authorize claims of official source integration, official scoring, complete legal compliance, accounting status, or completed payment processing.

Detailed workflows, exact datasets, formulas, providers, rules, and acceptance criteria remain to be specified before implementation.

Do not assume that every Claude Design screen belongs in the MVP.

---

## 12. Explicit Non-Goals at This Stage

The following remain explicit non-goals unless separately approved in the future:

1. An autonomous medical diagnostic platform
2. A prescribing platform
3. A replacement for an Electronic Health Record; the initial product only displays or consumes authorized hospital-supplied clinical information with provenance
4. An official governmental accounting platform; basic financial and execution traceability does not change this boundary
5. An official FURAG scoring authority
6. An official ADRES evaluation authority
7. A production payment processor; controlled payment references or states in the MVP do not constitute payment processing
8. A production AI clinical decision system

Any of these capabilities would require separate scope, architecture, regulatory, security, and product approval.

MERDN also must not claim that one document, integration, indicator, action, or dashboard demonstrates complete compliance with Sentencia T-319 de 2025 or any other norm.

---

## 13. Open Product Decisions

The following implementation and policy details remain open even though the strategic capabilities above are approved:

1. Definitive commercial product name
2. Exact authentication methods, identity proofing, recovery, and privileged-access assurance
3. Definitive role and permission matrix
4. Exact personal-data scope, ownership, classification, and municipal access to patient-level information
5. Exact clinical dataset, terminology, reconciliation, retention, and hospital integration method
6. Consent, delegation, legal representation, revocation, and emergency-access rules
7. Official indicator catalog, formulas, periods, owners, targets, publication states, and privacy thresholds
8. Authoritative FURAG/MIPG sources, exact framework versions, validation, official-value handling, and any submission scope
9. Authorized ADRES-related sources, legal basis, datasets, formulas, institutional meaning, and productive integration
10. Authoritative source, approved legal interpretation, applicability, responsibilities, and evidence standards for Sentencia T-319 de 2025 and other norms
11. SENA agreement, recognized training sources, certification-verification authority, and productive integration
12. Exact budget and expense sources, approval workflow, reconciliation, and relationship to official financial systems
13. Exact hospital service catalog, commercial rules, prices, memberships, billing, collection, refund, and consumer-protection requirements
14. Production payment providers, permitted payment data, reconciliation, and payment-processing scope
15. WhatsApp, email, SMS, push, and other notification providers, channels, consent, content, and delivery rules
16. Document and evidence retention, integrity, signature, validity, archival, and disposition requirements
17. Hosting ownership, infrastructure, data residency, availability, backup, recovery, and deployment model
18. SaaS versus licensed deployment variations
19. Definitive technology and integration architecture
20. Future AI capabilities, data use, retention, evaluation, and human oversight for Elí
21. Validated automated clinical rules, thresholds, escalation, responsibility, and after-hours behavior
22. Detailed MVP workflows, acceptance criteria, test requirements, and vertical-slice boundaries

These decisions must not be silently assumed by implementation agents.
