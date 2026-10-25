# 02 — Glossary

Shared vocabulary. When a term is used in requirements, it means exactly what's written here.

## Tenancy & people

| Term | Definition |
|---|---|
| **Portal** | The top-level tenant: an organization or workspace. It owns all users, projects, settings, and data. One person can belong to several portals. |
| **User / Portal user** | A person's membership in a portal. One login (identity) can map to many portal users, one per portal. |
| **Identity / Account** | The login credentials (email and password, 2FA, SSO). It is global, not per portal. |
| **Client company** | An external organization (a customer of the portal) whose people get restricted access. |
| **Client user** | A portal user who belongs to a client company. They see only items flagged **External**. |
| **Team (user group)** | A named group of portal users. Work can be assigned to a team. |
| **Profile** | A **permission set**: what actions a user may perform per module (view, create, edit, delete; own vs. all) and per field. It answers "what can I do?" |
| **Role** | A position in the **reporting hierarchy** (e.g., CEO → Manager → Engineer). It is used for data visibility up the hierarchy and for approvals. It answers "whose data can I see?" Role is distinct from Profile. |
| **Project role** | A user's role inside a specific project (e.g., Manager or Member). One user can be a Manager in project A and a Member in project B. |
| **Project member** | A user explicitly added to a project. |

## Work structure

| Term | Definition |
|---|---|
| **Project** | A container of work with an owner, dates, status, members, and enabled modules. |
| **Project group** | A category that bundles related projects. |
| **Project template** | A saved project structure (phases, task lists, tasks, dependencies, documents) used to create new projects. |
| **Phase** (aka milestone) | A time-boxed stage of a project with a start and end date and an owner. Task lists and issues can be linked to it. |
| **Task list** | A named group of tasks inside a project, optionally linked to a phase. Every project has a default "General" list. |
| **Task** | A unit of work with owners, dates, status, priority, and progress. |
| **Subtask** | A task whose parent is another task. Nesting can go multiple levels deep. |
| **Issue** | A bug or problem report. It is a second work type with its own fields (severity, classification, reproducibility). |
| **Work item** | A generic term for any trackable record: task, issue, or custom-module record. |
| **Custom module** | A user-defined record type (e.g., Risk Register, Contracts) with its own fields, layouts, and statuses. |
| **Internal / External flag** | Visibility flag on phases, tasks, issues, and so on. **External** items are visible to client users; **Internal** items are not. |

## Customization

| Term | Definition |
|---|---|
| **Field** | A data attribute of a module. It is either **system** (built-in) or **custom** (user-defined). |
| **API name** | The immutable internal identifier of a field. The label can be renamed; the API name never changes. |
| **Layout** | A configuration per module defining which fields appear, in which sections and order, and which status set applies. A project picks one task layout and one issue layout. |
| **Layout rule** | A conditional rule on a layout (e.g., "if Type = Bug, show Severity and make it mandatory"). |
| **Status set** | The ordered statuses owned by a layout. Each status has a type: **Open** or **Closed**. |
| **Picklist** | A field with predefined options (single select or multi-select). |
| **Field-level permission** | Per profile and field: Hidden, Read-only, or Read & Write. |

## Process & automation

| Term | Definition |
|---|---|
| **Blueprint** | A state machine that controls how a work item moves between statuses through defined **transitions**. |
| **Transition** | A named, allowed move between statuses (e.g., "Send for Review"). It has **Before** (who can perform it, and when), **During** (required inputs), and **After** (automated actions) settings. |
| **Checklist (transition checklist)** | Items that must be ticked before a transition or status completion is allowed. |
| **Workflow rule** | A rule of the form "when X happens and criteria match, do Y." It is asynchronous. |
| **SLA** | A time limit on a status or item. When it is breached, an escalation is triggered. |
| **Custom function** | User-written code run in a sandbox as a workflow action. |

## Planning & time

| Term | Definition |
|---|---|
| **Dependency** | A link between two tasks: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), or SF (Start-to-Finish). |
| **Lag / Lead** | A positive or negative delay applied to a dependency. |
| **Critical path** | The longest chain of dependent tasks. Delaying any task on it delays the project. |
| **Baseline** | A frozen snapshot of the plan, used to compare planned and actual dates. |
| **Strict / Flexible project mode** | In strict mode, task dates must stay within the project's dates. In flexible mode, they may extend past them. |
| **Business hours** | The portal's working days and hours. Durations and SLAs are computed against them. |
| **Holiday calendar** | Non-working dates that are excluded from scheduling. |
| **Time log** | Recorded hours against a task, an issue, or a project in general. It is either billable or non-billable. |
| **Timesheet** | A set of time logs for a period, submitted for approval. |
| **Utilization** | Allocated hours divided by available hours, per user per period. |

## System concepts (business-visible)

| Term | Definition |
|---|---|
| **Activity stream** | A human-readable history of changes on a record or project. |
| **Audit log** | A portal-level, tamper-evident record of security- and admin-relevant changes. |
| **Trash** | The holding area for soft-deleted items. They can be restored within the retention period. |
| **Entitlement** | Whether the portal's plan allows a feature or quota (e.g., "custom fields: max 50"). |
| **Follower** | A user who receives notifications about a record they don't own. |
