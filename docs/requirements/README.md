# Business Requirements

One document per roadmap module. These describe **what** the product must do and **why**, in business terms. They don't cover **how** it's built. Technical design documents will reference these IDs.

## Status of documents

| Status | Meaning |
|---|---|
| **Draft** | Detailed: user stories, business rules, acceptance criteria. Awaiting review. |
| **Outline** | Scope, tiers, and key rules only. Gets detailed before its phase starts. |
| **Approved** | Reviewed and frozen for technical design. Changes go through the change log at the bottom of each document. |

Phases 0–1 (Steps 1–10) are at **Draft** level. Phases 2–6 are at **Outline** level on purpose: the details will be better informed once the core is built.

## Index

### Phase 0 — Foundation
- [01 — Portal & Multi-tenancy](01-portal-multitenancy.md)
- [02 — Users, Roles & Permissions](02-users-roles-permissions.md)
- [03 — Security Core](03-security-core.md)

### Phase 1 — Core Work Management
- [04 — Projects](04-projects.md)
- [05 — Phases](05-phases.md)
- [06 — Task Lists & Tasks](06-tasks.md)
- [07 — Customization Engine](07-customization-engine.md)
- [08 — Views](08-views.md)
- [09 — Notifications](09-notifications.md)
- [10 — Documents](10-documents.md)

### Phase 2 — Second Work Type & Findability
- [11 — Issue Tracker](11-issue-tracker.md)
- [12 — Search](12-search.md)

### Phase 3 — Planning & Time
- [13 — Scheduling & Gantt](13-scheduling-gantt.md)
- [14 — Calendar & Events](14-calendar-events.md)
- [15 — Time Tracking & Timesheets](15-time-tracking.md)
- [16 — Resource Management](16-resource-management.md)
- [17 — Budgeting & Finance](17-budgeting-finance.md)

### Phase 4 — Automation & Collaboration
- [18 — Automation (Workflows, Blueprints, Checklists, SLA)](18-automation.md)
- [19 — Collaboration Extras](19-collaboration.md)

### Phase 5 — Insight Layer
- [20 — Reports & Dashboards](20-reports-dashboards.md)
- [21 — Portfolio Management](21-portfolio.md)

### Phase 6 — Platform, AI & Commercialization
- [22 — Integrations & Public API](22-integrations-api.md)
- [23 — AI Features](23-ai-features.md)
- [24 — Advanced Security, Compliance & Billing](24-advanced-security-billing.md)

## Conventions

- **IDs.** Every module has a short code (e.g., `PRJ`).
  - User stories: `PRJ-US-01`
  - Business rules: `PRJ-BR-01`
  - Acceptance criteria refer to their story ID.
- **Tiers.** Every story is tagged `MVP`, `V1`, or `LATER` (see [Product Vision](../01-product-vision.md#6-release-tiers)).
- **Actors.** Use the personas from the [Product Vision](../01-product-vision.md#3-target-users-personas) and the terms from the [Glossary](../02-glossary.md).
- **Business events** are named in past tense (`TaskCreated`). They define what other modules can react to; their payloads are designed later.

## Template for a module document

```markdown
# NN — Module Name
Code: XXX · Phase: N · Service: ... · Status: Draft

## 1. Purpose
## 2. Actors
## 3. Scope (in / out)
## 4. Key entities (business attributes)
## 5. User stories  (ID · tier · story)
## 6. Business rules
## 7. Acceptance criteria (Given / When / Then for key stories)
## 8. Permissions
## 9. Business events emitted
## 10. Notifications triggered
## 11. Dependencies
## 12. Open questions
## Change log
```
