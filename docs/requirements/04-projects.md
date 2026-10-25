# 04 — Projects
Code: `PRJ` · Phase: 1 · Service: Work · Status: **Draft**

## 1. Purpose
A project is the container for all work: phases, task lists, tasks, issues, documents, time, and budget. It defines who participates, which modules are used, and how work is shaped (layouts).

## 2. Actors
Project Manager, Portal Admin, Team Member, Client User.

## 3. Scope
**In:** project CRUD, archive, trash, groups, templates, statuses, overview page, members, visibility, module toggles, layout selection.
**Out:** budgets (17), Gantt (13), portfolio (21).

## 4. Key entities
| Entity | Business attributes |
|---|---|
| **Project** | Key/prefix (e.g., `WEB`, used in item IDs like `WEB-T42`), name, description (rich text), owner, group, status, start date, end date, mode (Strict / Flexible), visibility (Public / Private), enabled modules, task layout, issue layout, custom fields, client company (optional), progress % (derived), created by and date, archived flag |
| **Project group** | Name, order |
| **Project status** | Name, color, type (Active / Completed / On hold / Cancelled), order. Portal-level list. Default statuses: Active, In Progress, On Track, Delayed, On Hold, Completed, Cancelled. |
| **Project template** | Name, description, source content (phases, task lists, tasks with relative dates, dependencies, document folders, enabled modules, layouts) |

## 5. User stories
| ID | Tier | Story |
|---|---|---|
| PRJ-US-01 | MVP | As a Manager, I create a project with a name, key, owner, dates, and description. |
| PRJ-US-02 | MVP | As a Manager, I edit project details. |
| PRJ-US-03 | MVP | As a user, I see a list of projects I can access, with status, owner, progress, and dates, and I can search, sort, and filter it. |
| PRJ-US-04 | MVP | As a member, I open a project overview with progress %, open/closed task counts, upcoming phases, overdue items, and recent activity. |
| PRJ-US-05 | MVP | As a Manager, I add members to my project (see USR-US-07). |
| PRJ-US-06 | MVP | As a Manager, I delete a project (it goes to the trash). |
| PRJ-US-07 | MVP | As a Manager, I set the project's status. |
| PRJ-US-08 | V1 | As a Manager, I archive a completed project. It becomes read-only and drops out of active lists, and I can unarchive it. |
| PRJ-US-09 | V1 | As an Admin, I define project groups, and Managers assign projects to them. Lists can be grouped by project group. |
| PRJ-US-10 | V1 | As a Manager, I save a project as a template, and I create new projects from a template with a new start date. All dates shift relative to it. |
| PRJ-US-11 | V1 | As an Admin, I customize the list of project statuses (name, color, type). |
| PRJ-US-12 | V1 | As a Manager, I make a project Private (members only) or Public (visible to all portal employees as read-only, and they can join). |
| PRJ-US-13 | V1 | As a Manager, I enable or disable modules per project (Issues, Timesheets, Documents, Forums, and so on). Disabled modules disappear from the project. |
| PRJ-US-14 | V1 | As a Manager, I choose the task layout and issue layout for a project (see Step 7). |
| PRJ-US-15 | V1 | As a Manager, I set Strict or Flexible mode. Strict blocks task dates outside the project dates. |
| PRJ-US-16 | V1 | As a Manager, I duplicate a project (structure only, or structure and data). |
| PRJ-US-17 | V1 | As a Manager, I link a client company to the project, so its client users can be added. |
| PRJ-US-18 | V1 | As a user, I mark projects as favorites so they appear at the top. |
| PRJ-US-19 | LATER | As a member, I email the project's unique address to create a task or issue (email-in). |
| PRJ-US-20 | LATER | As an Admin, I define project layouts (different custom field sets per project type). |

## 6. Business rules
- **PRJ-BR-01** The project key is unique per portal, 2–10 uppercase alphanumerics, and immutable after creation, because item IDs depend on it.
- **PRJ-BR-02** Project end date ≥ start date. Dates are optional for MVP.
- **PRJ-BR-03 Progress %** = closed tasks / total tasks (excluding subtasks in MVP). In V1 it becomes configurable: by task count, or weighted by work hours.
- **PRJ-BR-04** An archived project is read-only for everyone: no edits, time logs, or comments. It's excluded from global "My Work" views and from notifications.
- **PRJ-BR-05** The project owner is always a member with the Manager project role. Changing the owner keeps the old owner as a member.
- **PRJ-BR-06** Private project: invisible to non-members (including in search and reports) except Admins. Public project: visible read-only to all employees (never to clients unless they are members).
- **PRJ-BR-07** Disabling a module hides its data but doesn't delete it. Re-enabling restores it.
- **PRJ-BR-08 Templates:** dates are stored as offsets from the project start. Members, comments, time logs, and attachments on tasks are **not** copied. Assignees are optionally kept, as a creation-time choice.
- **PRJ-BR-09** Strict mode applies going forward. Switching to Strict while existing tasks violate it shows a list of violations and doesn't auto-change them.
- **PRJ-BR-10** Deleting a project trashes all its content (see SEC-BR-08). Only the owner or an Admin can delete.

## 7. Acceptance criteria
- **PRJ-US-10**
  - Given a template with a task at +5 days lasting 3 days, when a project is created from it starting 2026-11-02, then the task runs 2026-11-07 → 2026-11-09 (calendar days in MVP; working days once Step 13 adds business-hours awareness).
- **PRJ-US-04**
  - Given a project with 10 tasks, 4 of them closed, then progress shows 40%. Overdue = open tasks with an end date before today, in the viewer's time zone.

## 8. Permissions
Profile module "Projects": Create / View / Edit / Delete / Archive with scope (Own = owner, Project = member, All). Project-role "Manager" can edit settings and membership.

## 9. Business events
`ProjectCreated`, `ProjectUpdated`, `ProjectStatusChanged`, `ProjectArchived`, `ProjectUnarchived`, `ProjectTrashed`, `ProjectRestored`, `ProjectModuleToggled`, `ProjectCreatedFromTemplate`, `ProjectTemplateSaved`.

## 10. Notifications
Added to project (member), project owner changed, project archived (members), project status changed (members who opted in).

## 11. Dependencies
Users & permissions (02), trash (03). Templates depend on Phases (05) and Tasks (06), so they're built after them.

## 12. Open questions
- Public project semantics: can non-members create tasks in public projects, or only view? Proposal: view only, plus a "Join" button.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial draft |
