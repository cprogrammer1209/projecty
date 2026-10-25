# 01 — Product Vision & Scope

## 1. Vision

ProjectY is a multi-tenant SaaS project management application that lets organizations plan, execute, track, and report on projects. It covers task and issue management, scheduling, time and cost tracking, and process automation, and it is customizable enough that teams can shape it to their own way of working.

It mirrors the feature set of Zoho Projects so that the requirements are realistic and well-understood. The product decisions here are our own, though, and we simplify wherever Zoho's behavior adds cost without adding learning value.

## 2. Why this project exists

| Goal | What it means in practice |
|---|---|
| **Complete the product** | A smaller product that is finished beats a larger one that isn't. Scope is managed through release tiers (`MVP` → `V1` → `LATER`). Every release milestone ends in something deployable and demo-able. |
| **Learn production engineering** | Use real patterns rather than shortcuts: tenant isolation, RBAC with profiles, outbox and event-driven integration, a modular monolith inside services, state machines, scheduling algorithms, and search indexing. |

## 3. Target users (personas)

| Persona | Description | Primary needs |
|---|---|---|
| **Portal Owner / Admin** | Sets up the organization, invites users, configures roles, layouts, and automation. | Control, configuration, security, audit |
| **Project Manager** | Plans projects, assigns work, tracks progress, budgets, and schedules. | Planning (Gantt), visibility, reports, resource balancing |
| **Team Member** | Does the work: updates tasks, logs time, fixes issues, comments. | A clear "my work" list, fast updates, low friction |
| **Client User** | An external stakeholder from a client company. | Sees only items flagged "external", comments, reports issues |
| **Finance / Approver** | Approves timesheets and watches budgets. | Approval queues, cost vs. budget, billable hours |

## 4. Product principles

1. **Tenant isolation is absolute.** No data ever crosses portals.
2. **Permission-aware everywhere.** Every list, search result, report, export, and notification respects what the viewer is allowed to see, down to field level.
3. **Configurable, not hard-coded.** Statuses, fields, layouts, and workflows are data, not code, wherever Zoho makes them configurable.
4. **Everything leaves a trail.** Every change is attributable (who, what, when, old → new).
5. **Rules are enforced server-side.** The UI may hide or guide, but the server is the source of truth for permissions, blueprints, and validation, on every path (form, Kanban drag, bulk, import, API).
6. **Soft delete by default.** Deleted items go to trash and can be restored within a retention window.

## 5. Scope

### In scope
All 24 modules in the [roadmap](03-roadmap.md), delivered in tiers.

### Out of scope (whole project)
- Native mobile apps (iOS/Android). The web app should be responsive, but it won't be mobile-first.
- Offline mode.
- A proprietary scripting language like Zoho's Deluge. Custom functions, when we reach them, use a sandboxed mainstream language.
- Online editing of documents, sheets, and slides (Office-style editors).
- Real data-residency (multi-region) deployment. The portal setting may exist, but there is only one region.
- MS Project `.mpp` binary import. CSV and Excel import are in scope.

### Explicitly simplified
- **Chat:** no Zoho Cliq equivalent. Comments, forums, and feeds cover collaboration; real-time chat is `LATER`.
- **Native third-party integrations:** start with webhooks, a public API, and one or two showcase integrations (GitHub, Google Calendar) rather than the full marketplace.
- **Payments:** subscription plans and entitlement gating are in scope, but the payment gateway is a test-mode integration only.

## 6. Release tiers

Every feature in the requirements documents carries one tag:

| Tag | Meaning |
|---|---|
| `MVP` | Needed for the first usable release. A team could run real projects with it. |
| `V1` | Needed for the product to be called "complete" and comparable to Zoho Projects Standard/Premium. |
| `LATER` | Enterprise or nice-to-have. Built only after V1 ships, if at all. |

**"Complete" = every `MVP` and `V1` feature across all 24 modules is shipped.** `LATER` items are a backlog, not a commitment.

## 7. Success criteria

- A new user can sign up, create a portal, invite a teammate, create a project from a template, plan it on a Gantt chart, track tasks and issues, log time, and see a dashboard, all without touching the database.
- Two portals running side by side never see each other's data. This is verified by automated tests.
- A client user can never see an internal item through any channel: UI, search, notification, export, or API. This is also verified by automated tests.
- Each service can be deployed independently, and the whole system runs locally with one command.
