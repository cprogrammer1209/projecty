# 08 — Views
Code: `VEW` · Phase: 1 · Service: Work · Status: **Draft**

## 1. Purpose
Gives people multiple ways to look at and act on the same work: list, board, sheet, and saved filters, both within a project and across all projects ("My Work").

## 2. Actors
All users.

## 3. Scope
**In:** list view, Kanban, sheet view, filters, saved custom views, sharing, global "My" views, column chooser, per-user preferences.
**Out:** Gantt (13), calendar view (14), reports (20).

## 4. Key entities
| Entity | Business attributes |
|---|---|
| **View definition** | Name, module (Tasks / Issues / custom module), scope (one project / all projects), type (List / Kanban / Sheet), criteria (conditions with AND/OR groups), sort, group-by, columns, Kanban group-by field, owner, sharing (Private / specific users or teams / all members), system or custom |
| **User view preference** | User, module, context (project), last used view, column widths, collapsed groups, density |

## 5. User stories
| ID | Tier | Story |
|---|---|---|
| VEW-US-01 | MVP | As a member, I see a project's tasks in a **list view** grouped by task list, with subtasks indented. |
| VEW-US-02 | MVP | As a member, I sort by any column and group by status, owner, priority, task list, or phase. |
| VEW-US-03 | MVP | As a member, I filter by status, owner, priority, dates (including relative: "overdue", "due this week"), and tags. |
| VEW-US-04 | MVP | As a member, I use a **Kanban board** grouped by status, and drag cards between columns to change status. |
| VEW-US-05 | MVP | As a member, I edit status, owner, priority, and dates inline in the list view. |
| VEW-US-06 | MVP | As a user, I open **My Tasks**: all tasks assigned to me across projects, grouped by due date (Overdue, Today, This week, Later). |
| VEW-US-07 | V1 | As a member, I group Kanban by owner, priority, or a custom picklist field. Dragging updates that field. |
| VEW-US-08 | V1 | As a member, I build advanced filters with AND/OR groups on any field, including custom fields. |
| VEW-US-09 | V1 | As a member, I save a filter, sort, columns, and grouping as a named **custom view**, and share it with users, teams, or all project members. |
| VEW-US-10 | V1 | As a user, I choose which columns appear and their order, and my preference is remembered. |
| VEW-US-11 | V1 | As a user, I use a **sheet view**: a dense grid with keyboard navigation and inline edit of all editable fields. |
| VEW-US-12 | V1 | As a user, I open **My Issues** and **My Work** (tasks, issues, and custom-module records assigned to me). |
| VEW-US-13 | V1 | As a user, I see cross-project views ("All open tasks in my projects") with project as a column and group. |
| VEW-US-14 | V1 | As a user, my last-used view per project is restored when I return. |
| VEW-US-15 | V1 | As a user, I set WIP limits on Kanban columns (visual warning only). |
| VEW-US-16 | LATER | As a user, I pin favorite views to the sidebar. |

## 6. Business rules
- **VEW-BR-01** Every view returns only records the viewer is allowed to see, with hidden fields removed (CUS-BR-12). Shared views are evaluated with the **viewer's** permissions, not the creator's.
- **VEW-BR-02** A Kanban drag that changes status goes through the single status-change path (TSK-BR-05). Rejected moves snap back with an explanation.
- **VEW-BR-03** Kanban grouped by status shows the columns of the project's layout status set. In cross-project boards with different layouts, columns group by status **type** (Open / Closed) or by status name across layouts (user choice).
- **VEW-BR-04** Relative date filters ("overdue", "this week") are evaluated in the viewer's time zone and the portal's week-start day.
- **VEW-BR-05** Inline edits apply the same validation, layout rules, and permissions as the form. A failed inline edit reverts the cell and shows the error.
- **VEW-BR-06** Views must stay responsive with 10,000 tasks in a project through server-side paging, filtering, and sorting. The full set is never loaded into the browser.
- **VEW-BR-07** System views ("All Tasks", "My Open Tasks", "Overdue", "Closed") can't be edited or deleted, but they can be cloned.
- **VEW-BR-08** Deleting a custom field used in a saved view removes that condition and column and flags the view as "modified by admin."

## 7. Acceptance criteria
- **VEW-US-04**
  - Given a board grouped by status, when a member drags a card from "Open" to "In Progress", then the status updates, the activity records it, and other viewers of the board see the move without refreshing (V1: real-time).
- **VEW-US-09**
  - Given a view shared with Team QA, when a QA member who can't see the private project X opens it, then tasks from X don't appear.

## 8. Permissions
Creating personal views: everyone. Sharing views to a project: project members. Sharing portal-wide: Admin.

## 9. Business events
`ViewCreated`, `ViewUpdated`, `ViewShared`, `ViewDeleted`. Edits made inside views emit the underlying item events.

## 10. Notifications
A view was shared with you (V1).

## 11. Dependencies
Tasks (06), Customization (07). Extended by Issues (11) and custom modules.

## 12. Open questions
- Real-time updates on boards (WebSocket) in MVP or V1? Proposal: V1, which aligns with Notification service extraction.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial draft |
