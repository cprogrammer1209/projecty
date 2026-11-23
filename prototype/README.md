# ProjectY prototypes

Plain HTML, CSS and JS for designing screens before they go into `frontend/` (Angular). No backend: a mock in `localStorage` stands in for the services. Each step has its **own folder with its own copy** of the prototype, so any step can be opened on its own.

```
prototype/
  m0/                    M0 Foundation: sign-in and sign-up, portals, Home, Settings (Portal, Users, Audit log, My preferences)
    prototype.html
    css/  js/  assets/
  m1/
    step4/               M1 Step 4 Projects: M0 plus Projects list, create/edit, overview with members, trash
      prototype.html
      css/  js/  assets/
    step7/               M1 Step 7 Custom fields: Step 4 plus a Linear-style Settings (Portal; Modules → Projects: Fields, Layouts with the visual canvas layout builder, Statuses, Templates; other modules marked Soon), and custom fields on the project form and overview, grouped in the layout's sections
      prototype.html
      css/  js/  assets/
    step6-tasks/         M1 Step 6 Tasks: Step 7 plus Linear-style task views (project Tasks tab and portal My Tasks / All Tasks: grouped list or board, Display popover, filter chips, inline pickers, bulk bar, quick add, peek panel, keyboard shortcuts, Ctrl+K), the task page (inline title and description, sub-tasks, activity and comments timeline, properties sidebar with tags, followers and custom fields from the task layout), Settings → Tasks (Fields, Layouts, Statuses per layout) and the task layout in project settings, plus the portal-level Tasks module (sidebar Tasks: My Tasks, All Tasks across projects, New task with a project picker)
      prototype.html
      css/  js/  assets/
    explorations/        one-off comparisons, not part of a step (inline-edit.html: HubSpot, Zoho and Linear style editing)
    step5/ ...           added when each step is built, copied from the step before
```

The plan for what each step contains is in [`docs/project-plan.html`](../docs/project-plan.html) (open it, click a module).

## Run it

Open a step's `prototype.html` in a browser (double-click is fine, no server or build). Routes are hash-based, e.g. `m1/step4/prototype.html#/p/northwind-labs/projects`.

The step 7 mock store (`js/store.js`) mirrors the layout API of `work-service` (`GET /layouts/active`, `PUT /layouts/{id}`, `PUT /projects/{id}/layout`), so the Angular port is mechanical.

`step6-tasks` is a copy of step 7 (which stays untouched) with the task data model and rules in its store: task lists (lazy "General", Internal/External, archive), tasks with sequential `KEY-T<n>` ids that are never reused, subtasks to depth 5 in the parent's list, owners, priority, due date not before start date, work hours, completion 0 to 100, tags (20 per task, 30 characters, case-insensitive), followers (creator and owners follow), comments (edit own, Admins delete any), activity for every change, trash with subtasks and restore. Statuses belong to the task layout (Open or Closed type, one default, at least one of each, a status in use cannot be deleted); moving to a Closed status sets the closed date and completion 100, reopening restores the earlier completion, and closing a parent with open subtasks asks first. The customization engine is generalised by entity (`ctx.entity` = `PROJECT` or `TASK`), so Settings → Tasks → Fields and Layouts reuse the project screens and the canvas builder. Permissions `TASKS_VIEW / CREATE / EDIT / DELETE` (Admin and Manager all four, Employee view, create and edit, Client view). Task views are Linear style (files `js/views/tasklist.js` = the shared list engine, `tasks.js` = project tab chrome, Lists menu, trash and the task page, `alltasks.js` = portal tabs). The list engine draws thin 36px borderless rows in groups, a toolbar (Filter, search, Display, New task), removable filter chips (status, priority, owner, project, tag, search; filtering is client-side and multi-select, so one status name matches across projects), and a hint bar. Display popover: View List or Board, Grouping (status = default, task list, owner, priority, due date, none) and toggles (Subtasks, Archived lists, Closed tasks on My Tasks); the choice and collapsed groups are remembered per screen in localStorage (`py-tv-*`). Rows show priority icon (swapped for a checkbox on hover), key, status icon, title, subtask count, tags, project (portal), owners and due date; status, priority, owners and due are inline pickers (single status path `Store.setTaskStatus`, with the open-subtasks confirmation). Bulk bar for selected rows (Status, Owner, Priority; Owner replaces the owners, Status maps by status name per project). Quick add per group (header plus; title + Enter creates with the group's status, priority, owner or list; in the portal it asks for a project), New task modal (`C`: project, title, description, status, priority, owners, due date, list, "Create more"). Peek side panel (click a row or `Space`): the task page in compact form (`Tasks.detail(el, ctx, { peek: true })`), prev/next, open full page (`Enter`), edits refresh the list when it closes. Keyboard: J/K or arrows move, Space peek, Enter open, S / P / A / D pickers (for the selection if any), X select, C new task, Esc clears, Ctrl+K command menu (go to My tasks / All tasks / Projects / a project, new task, list or board, group by, search tasks). Board: columns are the grouping (layout statuses by default), native drag changes the status (or priority, owner, task list for those groupings), quick add per column. Task lists stay a grouping and live in the Lists menu (reorder, rename, archive, new list; managers only). Task page: breadcrumb, key + status + layout chips, click-to-edit title and description, sub-tasks with progress and quick add (depth 5), one timeline of activity and comments with the comment box (Ctrl+Enter), and a right properties sidebar (status, priority, owners, dates, work hours, completion, list, then the layout's custom field sections, tags, followers) with the same click-to-edit pickers as the project overview (no Save or Cancel). Portal Tasks module: `#/p/:slug/tasks` with tabs My Tasks (tasks I own, open by default, grouped by due date by default: Overdue / Today / This week / Later / No due date, closed past-due ones under Earlier; subtasks included) and All Tasks (grouped by status, Project on every row; `?tab=all`). Each tab keeps its own view, grouping and filters while you switch. "New task" asks for a project (only where the user may create tasks: TASKS_CREATE and a project member or Admin) and creates it in the project's default list. Row titles open the usual task page with `?from=tasks` or `?from=tasks-all`, whose back link returns to the tab the user came from (the project tab is unchanged). Visibility follows the project tab: Admin or project member, public projects for non-Clients, and a Client only sees tasks in External lists. Store additions for these screens: `Store.tasks` returns `canEdit`, `Store.allTasks` returns per-project `canEdit` and `statuses` and a `listName` per row. Routes: `#/p/:slug/projects/:id/tasks`, `.../tasks/:tid`, `#/p/:slug/settings/tasks/fields | layouts | statuses`, and the project settings "Task layout" section.

The Angular app (`frontend/`) has the Step 7 screens (Settings shell, fields, layouts and the layout builder, project form, overview and project settings) and this prototype matches it, including: every project property (name, owner, start and end date, who can see it, description) saves on its own from the overview's "About this project" card, and the Edit form still sends everything (`Store.updateProject` is partial by presence, like `PATCH /api/work/projects/{id}`); leaving the layout builder with unsaved changes asks first; the Fields list has no "Used by" column (the count is in the delete dialog); saved choices of a field cannot be reordered, new ones can. One difference left on purpose: the prototype always shows people's names in person pickers, while the Angular app shows "Unknown member" to people without `USERS_VIEW`.

Demo logins (password `password123`):

| Email | What you get |
|---|---|
| `priya@northwind.com` | Admin and owner of Northwind Labs, Employee in Acme Studio (two portals, so you see the picker) |
| `sara@northwind.com` | Manager in Northwind Labs (owns two projects) |
| `ravi@northwind.com` | Employee in Northwind Labs (no manage controls) |

"Reset demo data" in the sign-in footer restores that step's seed. Each step saves to its own `localStorage` key (`py-proto-m0`, `py-proto-m1-step4`, ...), so steps don't overwrite each other. Anything labelled **Prototype only** (mailbox stand-in buttons, demo-login note, reset link) is not part of the real UI; drop it when porting.

## Inside a step

```
css/tokens.css     copy of frontend/src/styles/projecty-tokens.css
css/base.css       frontend/src/styles.scss (global classes: py-btn, py-field, py-menu, ...)
css/*.css          one file per area (auth, shell, home, settings, projects)
js/icon.js         <py-icon> element
js/core.js         helpers: field(), input(), dates, theme, router, component()
js/store.js        the mock backend (all fake data and rules live here)
js/views/*.js      one file per area
js/app.js          route table and guards
```

Component CSS is scoped with a wrapper class (`.shell`, `.home`, `.users-page`, `.projects-page`, ...), standing in for Angular's view encapsulation. When you port a screen, drop the prefix and put the rules in the component's `.scss`.

## Starting the next step

1. Copy the previous step's folder (`cp -r m1/step4 m1/step5`), give `js/store.js` its own `KEY`, and set the `<title>` in `prototype.html`.
2. Add `css/<name>.css` and `js/views/<name>.js`, link them in `prototype.html`, register the routes in `js/app.js` (`portalRoute(...)`), and add the sidebar item in `js/views/shell.js`.
3. Mock data and rules go in `js/store.js`; throw `{ code, message }` for errors, like the real API will.
4. Update the module's plan in `docs/project-plan.data.js` (tasks, `protoUrl`, history).

## Porting a screen to Angular

- Class names, tokens and `<py-icon name="...">` are the same as in the app, so markup copies across. Turn the template strings back into `@if` / `@for`, and the `s.xxx` state into signals.
- Use the shared pieces instead of the helpers: `<py-field>` for `field()`, `<py-password-input>` for `passwordInput()`, `ThemeService`, the router.
- Use the real services instead of `Store`: `AuthService`, `ActivePortalService`, `PortalApi`, `MemberApi`, and read `response.data` / `error.code`.
- New backend work follows the rules in the root `CLAUDE.md` (feature module, portal-scoped, permission, outbox event).

## Differences from the app

- Email, reset and invitation links are buttons (the app uses Mailpit).
- Latency is a fixed 350ms. The real app's refresh-token rotation, lockout and support-session screens are not simulated.
- Step 6 (Tasks): mentions, attachments, reactions, recurrence, reminders, copy and move and phases are out (bulk edit is status, owner and priority only, Kanban is the Board view). Comment text is plain (no rich text) and dates are dates only. In steps 4 and 7 project progress is always 0% and task counts show "—" (tasks arrive with step 6-tasks).
