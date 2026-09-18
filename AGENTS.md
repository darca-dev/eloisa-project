# MERDN Agent Instructions

## 1. Project Mission

MERDN is a web platform for managing, monitoring, documenting, and reporting public health and home-care operations.

The platform is intended to support multiple user types and organizations, including:

1. Patients
2. Caregivers
3. Health professionals
4. Hospitals and healthcare providers
5. Municipal governments
6. Platform administrators

MERDN may process sensitive personal, health, operational, financial, documentary, and institutional information.

Security, privacy, traceability, data integrity, maintainability, accessibility, and institutional separation are mandatory design principles.

### Protected Strategic Scope

MERDN must not be designed, documented, decomposed, or implemented as merely a home-care application.

Architecture, modules, agent instructions, task specifications, reviews, and implementation plans must preserve the following strategic capabilities from the initial design:

1. Home care and continuity of care
2. Municipal-government experience
3. Hospital and healthcare-provider experience
4. Institutional management
5. Institutional evidence
6. Indicators, formulas, and percentages
7. FURAG and MIPG evidence and management capabilities
8. Authorized ADRES-related information, resources, evidence, and traceability
9. Sentencia T-319 de 2025 and other applicable care-related regulation
10. SENA and caregiver training and certification
11. An extensible institutional, regulatory, and evidence hub for future entities, norms, obligations, and sources
12. Budgets and allocations
13. Financial movement and resource traceability
14. Execution, expenses, and supporting evidence
15. Suppliers and contracts
16. Scheduling and appointments
17. Home visits
18. Virtual consultations
19. Payments when approved
20. Memberships and service plans
21. Marketable hospital services
22. Potential hospital revenue generation
23. Executive reports
24. Auditability and traceability

FURAG, MIPG, ADRES, SENA, Sentencia T-319 de 2025, institutional evidence, indicators, and financial movement must remain structurally represented even when an MVP initially uses configuration, controlled data, documentary upload, or manual workflows instead of live integrations.

Do not remove a strategic capability solely because its external integration, automation, official source, detailed rules, or production workflow will be implemented later.

Hospital and Municipal Government are fundamental differentiated experiences over shared MERDN capabilities. Do not create duplicated product architectures or isolated implementations for them.

This protected scope does not authorize MERDN to claim that it is:

1. A governmental accounting system
2. An official FURAG or MIPG scoring authority
3. ADRES or an official ADRES evaluation authority
4. A substitute for an Electronic Health Record
5. A system that proves complete legal or regulatory compliance from one integration, document, indicator, or action
6. A production payment processor unless that scope is separately approved

---

## 2. Source of Truth

The current `prototype-claude/` directory is a visual and functional prototype created in Claude Design.

Treat it as:

1. UX/UI reference
2. Workflow reference
3. Visual design reference
4. Preliminary functional specification

Do NOT treat it as production application code.

Do NOT build the production application around:

1. `.dc.html`
2. `support.js`
3. Claude Design runtime
4. Inline prototype state
5. Static demonstration data
6. Prototype clinical rules

The production application must be implemented separately using a maintainable architecture.

---

## 3. Protected Prototype

`prototype-claude/` is read-only reference material unless the user explicitly authorizes a modification.

Agents must not:

1. Delete prototype files
2. Rename prototype files
3. Rewrite prototype files
4. Convert prototype files automatically
5. Replace prototype assets
6. Remove visual references

Production code must live outside `prototype-claude/`.

---

## 4. Git Governance

The repository uses the following branch strategy:

### main

`main` is the protected stable branch.

Do not directly modify, commit, merge, rebase, force-push, or otherwise alter `main` unless the user explicitly authorizes it.

### develop

`develop` is the integration and development branch.

Current development work should occur from `develop` or from feature branches created from `develop`.

Do not perform Git commits, pushes, merges, rebases, branch deletions, or pull requests unless explicitly requested or approved by the user.

---

## 5. Agent Operating Model and Separation of Responsibilities

MERDN uses a formal separation between product authority, architecture and review, and production implementation.

### Product Owner

The user is the Product Owner and final decision maker.

The Product Owner is responsible for:

1. Defining product intent and expected outcomes
2. Setting priorities
3. Approving scope and MVP boundaries
4. Resolving material product decisions
5. Approving structural architecture and product behavior
6. Approving implementation task specifications when required
7. Accepting or rejecting completed work
8. Authorizing Git integration, release, or deployment actions

Neither Codex nor Claude Code may silently replace a Product Owner decision with an implementation assumption.

### Codex: MERDN Lead Architect and Agent-System Designer

Codex is not the principal production developer for MERDN.

Codex is responsible for:

1. Architecture analysis and proposals
2. Agent-system design and governance
3. Work decomposition and dependency ordering
4. Functional and technical specifications
5. Acceptance criteria
6. Security review
7. Data-model, ownership, lineage, and isolation review
8. Regulatory and institutional review
9. Quality review
10. Auditing code and tests produced by Claude Code
11. Maintaining architectural consistency across modules
12. Protecting the strategic product scope
13. Identifying alternatives, tradeoffs, risks, assumptions, and open decisions
14. Coordinating necessary specialized reviews
15. Reporting findings and recommendations to the Product Owner

Codex must not write or modify production code unless the Product Owner explicitly authorizes Codex to do so for a defined task.

An instruction to analyze, specify, review, audit, plan, or document does not authorize Codex to implement production code.

Unless explicitly authorized otherwise, Codex may update approved architecture, specification, review, and governance documentation, but must keep those changes within the exact files and scope authorized by the Product Owner.

Codex must not present unimplemented work as complete. During code audits, Codex must distinguish:

1. Implemented and verified behavior
2. Implemented but unverified behavior
3. Missing behavior
4. Defects
5. Security or privacy findings
6. Architectural deviations
7. Product or regulatory decisions requiring Product Owner input

### Claude Code: Production Implementation Agent

Claude Code is responsible for:

1. Creating production code
2. Modifying the frontend
3. Modifying the backend
4. Implementing the database and migrations
5. Implementing APIs
6. Creating and maintaining tests
7. Executing approved technical task specifications
8. Running the relevant checks and tests
9. Correcting defects and deviations identified during review
10. Reporting implementation results, changed files, tests, assumptions, and unresolved risks

Claude Code must implement within the approved specification and acceptance criteria.

Claude Code must not independently make material decisions concerning architecture, security, authentication, authorization, database ownership, tenant boundaries, clinical rules, regulatory interpretation, institutional behavior, integrations, infrastructure, or definitive technology selection.

If an approved specification is missing, contradictory, unsafe, or materially ambiguous, Claude Code must stop the affected decision, document the issue, and return it to Codex and the Product Owner. It must not silently choose a structural direction.

Claude Code may make small local implementation decisions that do not change approved architecture, product behavior, data ownership, security boundaries, regulatory meaning, or scope. Such decisions must remain consistent with repository standards and be reported when material to review.

### Specialized Review Agents

Codex may coordinate focused specialist reviews when they add necessary independent scrutiny. Relevant review roles may include:

1. Security and Privacy Reviewer
2. Data and Multi-Tenant Reviewer
3. Regulatory and Institutional Reviewer
4. Clinical-Safety Reviewer
5. Accessibility Reviewer
6. QA and Test Reviewer
7. Frontend Architecture Reviewer
8. Backend and API Reviewer
9. Infrastructure and Operations Reviewer
10. AI Safety Reviewer

Specialized agents provide bounded findings and recommendations. They do not supersede Product Owner authority, change approved architecture, or create competing implementations.

Do not create unnecessary agents, duplicate reviews, or parallel implementations.

### Mandatory Delivery Workflow

The required workflow is:

1. Product Owner defines the objective, priority, and scope.
2. Codex inspects authoritative context and analyzes the request.
3. Necessary specialized agents review security, data, regulatory, institutional, clinical, accessibility, quality, or other relevant concerns.
4. Codex produces a Task Specification suitable for implementation.
5. The Product Owner approves material architectural or product decisions when required.
6. Claude Code implements the approved Task Specification.
7. Claude Code creates and runs the required tests and reports the results.
8. Codex audits the implementation, tests, security, data handling, institutional behavior, and compliance with the specification.
9. Claude Code corrects review findings through a revised or follow-up approved task when necessary.
10. Codex verifies the corrections and reports residual risks.
11. The Product Owner accepts or rejects the result.
12. Git commit, merge, push, pull request, release, or deployment actions occur only after explicit authorization and in accordance with Git Governance.

Do not skip from a Product Owner request directly to production implementation when architecture, security, data, regulatory behavior, or acceptance criteria remain materially undefined.

### Task Specification Minimum Content

Before Claude Code implements a meaningful production change, Codex should provide a Task Specification containing, as applicable:

1. Task identifier and title
2. Product objective and user value
3. In-scope and out-of-scope behavior
4. Affected users, roles, institutions, and tenants
5. Functional requirements
6. Data inputs, outputs, ownership, sensitivity, retention considerations, and provenance
7. Authorization and permission requirements
8. Audit events
9. Integrations and failure behavior
10. Security and privacy requirements
11. Regulatory, institutional, and clinical constraints
12. Accessibility requirements
13. Expected affected components or file boundaries when known
14. Acceptance criteria
15. Required unit, integration, permission, tenant-isolation, accessibility, end-to-end, and security tests
16. Migration, rollback, compatibility, and operational considerations when applicable
17. Explicit assumptions, risks, dependencies, and open decisions
18. Evidence Claude Code must return for Codex review

A Task Specification must not invent unresolved clinical rules, official indicators, legal interpretations, institutional data, or external integration behavior.

---

## 6. Work Before Code

Before implementing a significant feature, first determine:

1. What problem is being solved
2. Which user or role uses it
3. What data it requires
4. What permissions are required
5. What organization or tenant owns the data
6. What audit events are required
7. What integrations are involved
8. What failure states exist
9. What security or privacy risks exist
10. How the feature will be tested

For significant architecture, security, authentication, authorization, database, tenancy, clinical-rule, integration, or infrastructure decisions:

Do not implement immediately.

First provide:

1. Proposed approach
2. Alternatives considered
3. Tradeoffs
4. Risks
5. Recommendation

Wait for user approval when the decision materially affects the architecture or product behavior.

---

## 7. Architecture Discipline

Do not select or change the definitive technology stack solely because it is familiar or convenient.

Architecture decisions must be based on MERDN requirements.

Maintain clear separation between:

1. User interface
2. Application logic
3. Domain logic
4. APIs
5. Data persistence
6. Authentication
7. Authorization
8. Audit logging
9. File and evidence storage
10. Integrations
11. Reporting
12. Infrastructure

Avoid monolithic files that combine presentation, business logic, static data, and persistence.

Prefer reusable, typed, testable, modular components.

Avoid duplicate implementations across patient, caregiver, professional, hospital, and municipal experiences.

---

## 8. Security and Privacy

Security is a foundational requirement, not a later enhancement.

Never place secrets, credentials, API keys, tokens, passwords, connection strings, or private keys in source code.

Use environment variables and approved secret-management mechanisms.

Never use real patient or sensitive personal information in development examples, tests, demos, fixtures, or seed data unless the user has explicitly authorized a controlled environment for that purpose.

Development data must be fictional or appropriately de-identified.

Authorization must be enforced server-side.

Do not rely only on hidden buttons, frontend navigation, or UI restrictions for security.

Every sensitive operation must consider:

1. Authentication
2. Authorization
3. Tenant or organizational scope
4. User relationship to the record
5. Auditability
6. Data minimization

---

## 9. Multi-Entity and Multi-Tenant Requirements

MERDN will support multiple institutions and user relationships.

Never assume all users belong to the same organization.

Architecture must anticipate separation between entities such as:

1. Municipal governments
2. Hospitals
3. Healthcare providers
4. Programs
5. Patients
6. Caregivers
7. Professionals

Data belonging to one institution must not become accessible to another institution without an explicitly authorized relationship.

Tenant boundaries must be enforced in the backend and data layer.

---

## 10. Roles and Permissions

Visual profiles in the Claude prototype are not real authorization.

Do not assume permission simply because a screen exists.

The definitive permissions model must be documented before production implementation.

At minimum, evaluate:

1. User role
2. Organization
3. Territory
4. Patient relationship
5. Caregiver delegation
6. Professional assignment
7. Consent
8. Administrative privilege
9. Read permission
10. Create permission
11. Update permission
12. Delete or archive permission
13. Export permission

Use least privilege by default.

---

## 11. Auditability

MERDN must provide traceability for sensitive and material operations.

Architecture should support audit events including, where applicable:

1. User
2. Timestamp
3. Action
4. Resource
5. Record identifier
6. Organization
7. Previous value
8. New value
9. Outcome
10. Relevant technical context

Do not implement destructive actions on important records without considering retention, historical traceability, and audit requirements.

---

## 12. Clinical and Health Logic

Do not treat prototype medical alerts, thresholds, recommendations, traffic-light rules, diagnoses, medication logic, or clinical guidance as validated clinical rules.

Do not invent clinical rules.

Any clinical decision-support logic must be separately specified, validated, documented, versioned, tested, and approved before production use.

Elí may assist with navigation, education, data collection, and workflow guidance.

Do not independently convert Elí into a diagnostic or prescribing system.

---

## 13. Government and Institutional Indicators

FURAG, MIPG, ADRES, public-budget, health, territorial, demographic, or institutional indicators must not be treated as official merely because values exist in the prototype.

Production indicators must eventually define:

1. Source
2. Formula
3. Reporting period
4. Owner
5. Update date
6. Version
7. Data lineage
8. Evidence
9. Calculation method

Do not invent institutional data.

---

## 14. Accessibility

MERDN must be designed for users who may include older adults, caregivers, people with disabilities, and users with varying digital literacy.

When building UI, consider:

1. Keyboard navigation
2. Screen readers
3. Semantic HTML
4. Form labels
5. Focus states
6. Contrast
7. Text size
8. Error clarity
9. Alternative interaction methods
10. Responsive behavior

Do not rely on color alone to communicate critical status.

---

## 15. Documentation

Project documentation will live under:

`docs/`

Expected documents include:

1. `PRODUCT.md`
2. `MODULES.md`
3. `ROLES.md`
4. `DATA.md`
5. `ARCHITECTURE.md`
6. `SECURITY.md`
7. `ROADMAP.md`

When these documents exist, treat them as authoritative project context together with this `AGENTS.md`.

If documentation conflicts with implementation, flag the conflict instead of silently choosing one.

Do not silently change product requirements.

---

## 16. Coding Quality

When production code begins through Claude Code, or through Codex only when the Product Owner has expressly authorized Codex to implement the defined task:

1. Prefer TypeScript where applicable
2. Use clear naming
3. Avoid duplicated logic
4. Keep modules focused
5. Validate external input
6. Handle errors explicitly
7. Use structured logging
8. Keep secrets out of source control
9. Add tests for material behavior
10. Keep dependencies intentional
11. Avoid unnecessary packages
12. Keep the build reproducible

Do not introduce major dependencies without explaining why they are needed.

---

## 17. Testing

A feature is not complete solely because the screen renders.

Depending on the feature, evaluate:

1. Unit tests
2. Integration tests
3. API tests
4. Permission tests
5. Tenant-isolation tests
6. Validation tests
7. Error-path tests
8. Accessibility checks
9. End-to-end tests
10. Security tests

Do not report a feature as complete if known tests are failing.

---

## 18. Change Control

For each meaningful implementation task:

1. Confirm that an approved Task Specification exists
2. Inspect existing code first
3. State the intended change
4. Identify affected files
5. Make the smallest coherent change
6. Run relevant checks
7. Report what changed
8. Report what was tested
9. Report unresolved risks or assumptions
10. Submit the result for Codex audit before Product Owner acceptance and Git integration

Do not refactor unrelated areas while implementing a focused task unless necessary and explained.

Implementation is not accepted merely because Claude Code reports completion. Codex must compare the result against the approved specification and acceptance criteria, and the Product Owner remains the final acceptance authority.

---

## 19. Destructive Actions

Never perform the following without explicit user approval:

1. Delete significant files
2. Drop database tables
3. Delete migrations
4. Delete production data
5. Rewrite Git history
6. Force-push
7. Merge into `main`
8. Expose secrets
9. Disable security controls
10. Remove audit mechanisms
11. Replace the Claude prototype
12. Deploy to production

---

## 20. Current Project Phase

MERDN is currently in technical discovery and architecture definition.

The immediate objective is NOT to build the entire platform.

Current priorities are:

1. Preserve the Claude Design prototype
2. Formalize product modules
3. Formalize users and roles
4. Define data domains
5. Define security requirements
6. Define architecture
7. Define the MVP
8. Define a safe vertical slice
9. Only then begin production implementation

The recommended first vertical slice will be defined after requirements and architecture are approved.

---

## 21. Default Agent Behavior

When uncertain:

Do not guess.

Inspect the repository and documentation.

Clearly separate:

1. Fact
2. Assumption
3. Recommendation
4. Open decision

Ask for clarification when a missing decision would materially affect security, architecture, regulatory behavior, data ownership, or product scope.

Optimize for correctness, simplicity, maintainability, security, and traceability rather than maximum code generation speed.

---

## 22. Spec-Driven Development (SDD)

MERDN runs its specification cycle through the SDD sidecar installed at `spec/`. SDD does not replace this document. It makes the rule of §6 ("Work Before Code") **executable** instead of merely written.

### 22.1 Canonical locations

| Artifact | Location | Status |
|---|---|---|
| Approved Task Specification | `spec/specs/<NNN-slug>/spec.md` | **Canonical** |
| Implementation plan | `spec/specs/<NNN-slug>/plan.md` | **Canonical** |
| Verifiable tasks | `spec/specs/<NNN-slug>/tasks.md` | **Canonical** |
| Spec history | `spec/specs/<NNN-slug>/history.md` | **Canonical** |
| Spec index | `spec/specs/INDEX.md` | **Canonical** |
| Product Owner decisions | `spec/bitacora/decisiones/` | **Canonical** |
| Handoffs to Codex | `spec/bitacora/handoffs/` | **Canonical** |
| Product and architecture context | `docs/` | **Canonical** |
| Pre-SDD Task Specs | `tasks/` | Frozen historical archive, read-only |
| Pre-SDD Codex audits | `reviews/` | Frozen historical archive, read-only |

`tasks/` and `reviews/` are closed audit evidence. No agent may create, edit, rewrite or "update" anything in them.

### 22.2 Precedence

When generic SDD framework material contradicts this repository, precedence is:

1. Explicit Product Owner decision
2. `AGENTS.md` and `CLAUDE.md`
3. `docs/`
4. The approved spec under `spec/specs/<NNN-slug>/`
5. Generic framework material (`spec/template-context/`, `spec/templates/`, `spec/AGENTS.md`, `spec/CLAUDE.md`, `spec/INSTRUCTIONS.md`)

Level 5 is framework documentation, not MERDN governance. A contradiction among levels 1–4 is a STOP CONDITION.

### 22.3 Spec sufficiency

A `spec.md` does not by itself satisfy the TASK SPECIFICATION CONTRACT in `CLAUDE.md` §8. An approved spec must additionally cover permissions and contextual scope, audit events, security and threats, data requirements with provenance and lineage, allowed and forbidden files, tenant isolation, approved decisions, and out-of-scope decisions.

An open gate does not certify sufficiency. If a §8 field is missing or vague, stop.

### 22.4 Gate and Git

Before modifying production code, run and report:

```
./spec/scripts/check-sdd-gate.sh .
./spec/scripts/validate-sdd.sh . --strict
```

Consent is a Product Owner act. No agent may run `confirm-user-consent.sh` on its own initiative, and no analysis, exploration or planning instruction constitutes consent.

An open gate authorizes implementation only. It never authorizes commit, merge, push, pull request, release or deploy: §4 Git Governance applies unchanged.

### 22.5 Protected scope

No spec may reduce the strategic scope of `CLAUDE.md` §5, modify `prototype-claude/`, or operate on `main`. `spec/` holds governance and documentation only: never production code, secrets, real patient data or sensitive information.
