# 03 — Roadmap & Build Order

24 modules in 7 phases, ordered by dependency. Mobile apps are out of scope.

## Build order at a glance

| Step | Module | Phase | Service | Requirements |
|---|---|---|---|---|
| 1 | Portal & Multi-tenancy | 0 — Foundation | Platform | [01](requirements/01-portal-multitenancy.md) |
| 2 | Users, Roles & Permissions | 0 — Foundation | Platform | [02](requirements/02-users-roles-permissions.md) |
| 3 | Security Core (Auth, Audit, Events, Trash) | 0 — Foundation | Platform (+ shared libs) | [03](requirements/03-security-core.md) |
| 4 | Projects | 1 — Core Work Management | Work | [04](requirements/04-projects.md) |
| 5 | Phases (Milestones) | 1 — Core Work Management | Work | [05](requirements/05-phases.md) |
| 6 | Task Lists & Tasks | 1 — Core Work Management | Work | [06](requirements/06-tasks.md) |
| 7 | Customization Engine | 1 — Core Work Management | Work | [07](requirements/07-customization-engine.md) |
| 8 | Views | 1 — Core Work Management | Work | [08](requirements/08-views.md) |
| 9 | Notifications | 1 — Core Work Management | Notification* | [09](requirements/09-notifications.md) |
| 10 | Documents | 1 — Core Work Management | Work | [10](requirements/10-documents.md) |
| 11 | Issue Tracker | 2 — Second Work Type & Findability | Work | [11](requirements/11-issue-tracker.md) |
| 12 | Search | 2 — Second Work Type & Findability | Work | [12](requirements/12-search.md) |
| 13 | Scheduling & Gantt | 3 — Planning & Time | Work | [13](requirements/13-scheduling-gantt.md) |
| 14 | Calendar & Events | 3 — Planning & Time | Work | [14](requirements/14-calendar-events.md) |
| 15 | Time Tracking & Timesheets | 3 — Planning & Time | Work | [15](requirements/15-time-tracking.md) |
| 16 | Resource Management | 3 — Planning & Time | Work | [16](requirements/16-resource-management.md) |
| 17 | Budgeting & Finance | 3 — Planning & Time | Work | [17](requirements/17-budgeting-finance.md) |
| 18 | Automation (Workflows, Blueprints, SLA) | 4 — Automation & Collaboration | Work (validation) + Automation | [18](requirements/18-automation.md) |
| 19 | Collaboration Extras | 4 — Automation & Collaboration | Work | [19](requirements/19-collaboration.md) |
| 20 | Reports & Dashboards | 5 — Insight Layer | Work | [20](requirements/20-reports-dashboards.md) |
| 21 | Portfolio Management | 5 — Insight Layer | Work | [21](requirements/21-portfolio.md) |
| 22 | Integrations & Public API | 6 — Platform, AI & Commercial | Gateway + Automation | [22](requirements/22-integrations-api.md) |
| 23 | AI Features | 6 — Platform, AI & Commercial | Work | [23](requirements/23-ai-features.md) |
| 24 | Advanced Security, Compliance & Billing | 6 — Platform, AI & Commercial | Platform | [24](requirements/24-advanced-security-billing.md) |

\* Notifications start as a module inside Work and are extracted into the Notification service in Phase 2. See [Architecture Overview](04-architecture-overview.md#service-rollout).

## Phase rationale

- **Phase 0, Foundation:** tenancy, identity, permissions, audit, and the event pipeline. Everything depends on these, and they are expensive to retrofit.
- **Phase 1, Core Work Management:** the first usable product: projects, phases, tasks, customization, views, notifications, and documents.
- **Phase 2, Second Work Type & Findability:** issues reuse the work-item engine, and search spans everything built so far.
- **Phase 3, Planning & Time:** Gantt, calendar, time tracking, resources, and budgets. All of them build on tasks and dates.
- **Phase 4, Automation & Collaboration:** automation acts on every data module, so its trigger and action catalog is built once those modules exist.
- **Phase 5, Insight Layer:** reports and portfolio read from everything.
- **Phase 6, Platform, AI & Commercialization:** the public API, AI, enterprise security, and billing.

## Ordering notes and adjustments

1. **Steps 6 and 7 interleave.** Tasks must store custom field values and use layout-owned statuses from day one, or they'll need a rewrite. So: build the *data foundation* of the Customization Engine (field definitions, custom value storage, status sets, default layout) **together with** Step 6, then build the admin UI and the advanced parts (layout rules, custom modules, formula and lookup fields) in Step 7.
2. **Blueprint groundwork.** Status changes in Step 6 should go through a single "change status" path. That gives Step 18 one place to plug in transition validation.
3. **Timer in Step 6 feeds Step 15.** The task timer UI can wait until Step 15, when time logs exist. Until then it's tagged `V1`.
4. **The definition of done grows.** From Step 4 onward, every module is permission-checked, emits events, writes the activity stream, and triggers notifications. Once Step 12 exists, it is also indexed for search.

## Release milestones

"Complete" = **M6 shipped** (all `MVP` and `V1` features). `LATER` items are backlog.

| Milestone | Contents | Outcome |
|---|---|---|
| **M0: Foundation** | `MVP` features of Steps 1–3 | Sign up, create a portal, invite users, log in, assign profiles. Audit and events flowing. |
| **M1: Usable Core (MVP)** | `MVP` features of Steps 4–10 | A team can run real projects: tasks, subtasks, comments, list and Kanban views, notifications, attachments. **First deployable release.** |
| **M2: Core Complete** | `V1` features of Steps 1–10, plus `MVP` and `V1` of Steps 11–12 | Custom fields and layouts, issues, global search, Notification service extracted. |
| **M3: Planning & Time** | `MVP` and `V1` of Steps 13–17 | Gantt with dependencies, calendar, timesheets with approval, utilization, budgets. |
| **M4: Automation & Collaboration** | `MVP` and `V1` of Steps 18–19 | Workflow rules, blueprints with checklists, SLAs, feeds, forums, wiki. Automation service live. |
| **M5: Insight** | `MVP` and `V1` of Steps 20–21 | Built-in and custom reports, dashboards, portfolio view. |
| **M6: Platform & Commercial** | `MVP` and `V1` of Steps 22–24 | Public API, webhooks, AI features, SSO, plans and billing. **V1 complete.** |

## Progress tracker

Update this table as work moves. Status values: `Not started` → `Requirements` → `Design` → `In progress` → `Done`.

| Step | Module | Requirements | Tech design | MVP built | V1 built |
|---|---|---|---|---|---|
| 1 | Portal & Multi-tenancy | Draft | Design | In progress | — |
| 2 | Users, Roles & Permissions | Draft | Design | In progress | — |
| 3 | Security Core | Draft | Design | In progress | — |
| 4 | Projects | Draft | — | — | — |
| 5 | Phases | Draft | — | — | — |
| 6 | Task Lists & Tasks | Draft | — | — | — |
| 7 | Customization Engine | Draft | — | — | — |
| 8 | Views | Draft | — | — | — |
| 9 | Notifications | Draft | — | — | — |
| 10 | Documents | Draft | — | — | — |
| 11 | Issue Tracker | Outline | — | — | — |
| 12 | Search | Outline | — | — | — |
| 13 | Scheduling & Gantt | Outline | — | — | — |
| 14 | Calendar & Events | Outline | — | — | — |
| 15 | Time Tracking | Outline | — | — | — |
| 16 | Resource Management | Outline | — | — | — |
| 17 | Budgeting & Finance | Outline | — | — | — |
| 18 | Automation | Outline | — | — | — |
| 19 | Collaboration | Outline | — | — | — |
| 20 | Reports & Dashboards | Outline | — | — | — |
| 21 | Portfolio | Outline | — | — | — |
| 22 | Integrations & API | Outline | — | — | — |
| 23 | AI Features | Outline | — | — | — |
| 24 | Adv. Security & Billing | Outline | — | — | — |

**Draft** means detailed requirements are written and awaiting review. **Outline** means scope, key rules, and tiers are written, and the details get filled in before that phase starts, when we know more.

## Cross-cutting concerns (extend with every module)

| Concern | Introduced in | Applies to |
|---|---|---|
| Permissions (module, own/all, project role, field-level) | Step 2, extended in Step 7 | Every entity and field |
| Event pipeline and audit log | Step 3 | Every write |
| Activity stream | Step 6 | Every work item |
| Notifications | Step 9 | Every user-facing event |
| Custom fields and layouts | Step 7 | Every work-item module |
| Search indexing | Step 12 | Every searchable entity |
| Trash and restore | Step 3 | Every deletable entity |
| Internal/External visibility | Step 2 | Every client-visible entity |
