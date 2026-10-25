# 05 — Phases (Milestones)
Code: `PHS` · Phase: 1 · Service: Work · Status: **Draft**

## 1. Purpose
Phases break a project into time-boxed stages (e.g., "Design", "Build", "UAT"). They provide checkpoints, group task lists and issues, and control which stages clients can see.

## 2. Actors
Project Manager, Team Member, Client User.

## 3. Scope
**In:** phase CRUD, status, completion, internal/external flag, linking task lists and issues, archive, phase list view.
**Out:** Gantt bars (13), phase reports (20).

## 4. Key entities
| Entity | Business attributes |
|---|---|
| **Phase** | Project, name, description, owner, start date, end date, status (Active / Completed / Archived, with custom statuses in V1), flag (Internal / External), completion % (derived), order, created by and date |

## 5. User stories
| ID | Tier | Story |
|---|---|---|
| PHS-US-01 | MVP | As a Manager, I create a phase with a name, owner, start date, and end date. |
| PHS-US-02 | MVP | As a Manager, I edit or delete a phase. |
| PHS-US-03 | MVP | As a member, I see a project's phases in order, with dates, owner, status, and completion %. |
| PHS-US-04 | MVP | As a Manager, I attach a task list to a phase. |
| PHS-US-05 | MVP | As a Manager, I mark a phase Completed. |
| PHS-US-06 | V1 | As a Manager, I flag a phase as External, so client users can see it and its external task lists. |
| PHS-US-07 | V1 | As a Manager, I archive a completed phase to hide it from active views. |
| PHS-US-08 | V1 | As a Manager, I link issues to a phase (affected phase and release phase, see Step 11). |
| PHS-US-09 | V1 | As a member, I open a phase detail page with its task lists, tasks, issues, and progress. |
| PHS-US-10 | V1 | As a Manager, I reorder phases. |
| PHS-US-11 | LATER | As an Admin, I define custom phase statuses and phase custom fields. |

## 6. Business rules
- **PHS-BR-01** Phase end date ≥ start date. In a Strict project, phase dates must lie within the project dates.
- **PHS-BR-02 Completion %** = closed tasks / total tasks across all task lists linked to the phase.
- **PHS-BR-03** Marking a phase Completed while it still has open tasks asks for confirmation and lists the open tasks. It doesn't auto-close them.
- **PHS-BR-04** Deleting a phase **doesn't** delete its task lists. They become unlinked ("No phase"). This is a deliberate difference from the trash cascade.
- **PHS-BR-05** A task list belongs to at most one phase.
- **PHS-BR-06 Visibility:** client users see a phase only if it's External. They see a task list only if the list is External **and** its phase (if any) is External.
- **PHS-BR-07** An overdue phase (end date passed and not Completed) is highlighted on the project overview.

## 7. Acceptance criteria
- **PHS-US-05**
  - Given a phase with 2 open tasks, when the Manager marks it Completed, then a confirmation lists those 2 tasks. On confirm, the phase is Completed and the tasks stay open.
- **PHS-BR-04**
  - Given a phase with 2 task lists, when the phase is deleted, then both lists remain under "No phase" with their tasks intact.

## 8. Permissions
Profile module "Phases": View / Create / Edit / Delete with scope. Project-role Manager has full control. Members view by default.

## 9. Business events
`PhaseCreated`, `PhaseUpdated`, `PhaseCompleted`, `PhaseReopened`, `PhaseArchived`, `PhaseTrashed`, `PhaseRestored`.

## 10. Notifications
Phase owner assigned, phase due in N days (V1, via reminders), phase overdue (owner and project manager).

## 11. Dependencies
Projects (04). Task lists (06) for linking.

## 12. Open questions
- Zoho calls these "Milestones" in older versions and "Phases" in newer ones. We use **Phase** in the UI. Do we also need zero-duration "milestone markers" for Gantt (Step 13)? Proposal: yes, as a task flag in Step 13.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial draft |
