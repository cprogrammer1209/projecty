# Task API contract (work-service, port 8082)

Final contract of the Task module backend. Base `/api/work`. Every call needs `Authorization: Bearer <token>` and
`X-Portal-Id`. Every response is the envelope `{ "success": true, "data": ... }` or
`{ "success": false, "error": { "code", "message", "details": { "<field>": "<message>" } } }`. Ids are UUIDs, dates are
`YYYY-MM-DD`, instants are ISO-8601 UTC. Field errors are `400 VALIDATION_FAILED` with every problem at once under
`details`, keyed by the request property (`title`, `dueDate`, `workHours`, `completion`, `tags`, `ownerIds`, `statusId`,
`listId`, `parentId`, `description`, `priority`, `name`, `body`, or a custom field `api_name`).

## Permissions

| Permission | Admin | Manager | Employee | Client |
|---|---|---|---|---|
| `TASKS_VIEW` | yes | yes | yes | yes |
| `TASKS_CREATE` | yes | yes | yes | no |
| `TASKS_EDIT` | yes | yes | yes | no |
| `TASKS_DELETE` | yes | yes | no | no |

Visibility: a task is visible when its project is (project rules: Admin all; others members and public projects; Clients
never public ones). A **Client** additionally sees only lists and tasks of `EXTERNAL` task lists. Anything not visible, or
in another portal, is a 404. Comments (read, add, edit own, delete own) need only `TASKS_VIEW`; an Admin can delete any
comment. Following yourself needs `TASKS_VIEW`; adding or removing another person needs `TASKS_EDIT`.
`GET .../tasks?trashed=true` and restore need `TASKS_DELETE`.

## Error codes

`TASK_NOT_FOUND` (404), `TASK_LIST_NOT_FOUND` (404), `TASK_COMMENT_NOT_FOUND` (404), `PROJECT_NOT_FOUND` (404),
`TASK_FORBIDDEN` (403, e.g. editing another person's comment), `FORBIDDEN` (403, missing permission),
`TASK_LIST_ARCHIVED` (422), `TASK_PARENT_TRASHED` (422), `TASK_NOT_TRASHED` (422), `TASK_LAYOUT_INVALID` (422),
`PROJECT_LAYOUT_INVALID` (422), `LAYOUT_NOT_FOUND` (404), `VALIDATION_FAILED` (400), status rules:
`LAYOUT_STATUS_NOT_FOUND` (404), `LAYOUT_STATUS_IN_USE` (422), `LAYOUT_STATUS_INVALID` (422), `LAYOUT_STATUS_LIMIT` (422).

## Shapes

```jsonc
// TaskListResponse
{ "id", "projectId", "name", "visibility": "INTERNAL|EXTERNAL", "sortOrder": 0, "archived": false,
  "taskCount": 3, "completedCount": 1, "createdAt" }

// TaskResponse (list rows, create, update, status, followers, restore)
{ "id", "projectId", "projectKey": "WEB", "projectName": "Website", "key": "WEB-T42", "number": 42,
  "listId", "listName", "parentId": null, "depth": 1,            // depth 1 = top level, max 5
  "title", "description": null,
  "statusId", "statusName", "statusType": "OPEN|CLOSED", "statusColor": "#2563eb",
  "priority": "NONE|LOW|MEDIUM|HIGH|CRITICAL",
  "startDate": null, "dueDate": null, "workHours": 2.5, "completion": 0,   // 0..100
  "ownerIds": [], "followerIds": [], "tags": [],
  "customValues": { "cf_effort": 3 },                             // active TASK fields only
  "layoutId", "subtaskCount": 0, "completedSubtaskCount": 0,      // direct subtasks, trashed excluded
  "commentCount": 0, "closedAt": null, "createdAt", "createdBy", "updatedAt", "deletedAt": null,
  "canEdit": true, "canDelete": false }

// LayoutStatus
{ "id", "name", "statusType": "OPEN|CLOSED", "color": "#2563eb"|null, "sortOrder": 0, "defaultStatus": true }

// TaskActivity
{ "id", "action", "field": null, "oldValue": null, "newValue": null, "detail": null,
  "actorUserId", "actorName", "createdAt" }
// action: TASK_CREATED | TASK_UPDATED (field + oldValue + newValue) | TASK_STATUS_CHANGED (field "statusId", status NAMES in
// the values) | TASK_TRASHED | TASK_RESTORED | TASK_COMMENT_ADDED | TASK_COMMENT_EDITED | TASK_COMMENT_DELETED (detail = text)
// field names: title, description, priority, startDate, dueDate, workHours, completion, ownerIds (ids joined by ", "),
// tags (joined by ", "), followerIds, listId, parentId, layoutId (layout NAMES), customValues.<api_name>. Ids stay ids.

// TaskComment
{ "id", "taskId", "authorUserId", "authorName", "body", "edited": false, "createdAt", "updatedAt",
  "canEdit": true, "canDelete": true }

// TaskDetail  (GET /tasks/{id} and PUT /tasks/{id}/layout)
{ "task": TaskResponse,                // customValues = answers of the fields placed in the layout
  "layout": { "id", "entityType": "TASK", "name", "description", "defaultLayout", "active",
              "sections": [ { "id", "name", "collapsible", "fields": [ LayoutField ] } ],  // same as the project layout
              "statuses": [ LayoutStatus ] },
  "hiddenValues": { },                 // answers of active fields the layout does not show
  "statuses": [ LayoutStatus ],        // same as layout.statuses, in order
  "subtasks": [ TaskResponse ],        // ALL descendants, flat, by depth then number (parentId builds the tree)
  "activity": [ TaskActivity ],        // newest first, at most 100
  "comments": [ TaskComment ],         // oldest first
  "followers": [ userId ] }
```

## Task lists

| Call | Body | Answer | Permission |
|---|---|---|---|
| `GET /projects/{projectId}/task-lists?includeArchived=false` | | `[TaskListResponse]` in order. A project with no list gets "General" (INTERNAL) first | TASKS_VIEW |
| `POST /projects/{projectId}/task-lists` (201) | `{ "name", "visibility"?: "INTERNAL" }` name 1..100, unique per project (any case) | `TaskListResponse` | TASKS_CREATE |
| `PATCH /task-lists/{id}` | `{ "name"?, "visibility"? }` (left out = unchanged) | `TaskListResponse` | TASKS_EDIT |
| `POST /task-lists/{id}/archive`, `/unarchive` | | `TaskListResponse` | TASKS_EDIT |
| `PUT /projects/{projectId}/task-lists/order` | `{ "ids": [listId] }` listed first, the rest follow; duplicates or foreign ids: 400 `ids` | `[TaskListResponse]` incl. archived | TASKS_EDIT |

An archived list takes no new tasks (422 `TASK_LIST_ARCHIVED`); its tasks stay.

## Tasks

`GET /projects/{projectId}/tasks` (TASKS_VIEW) answers a flat `[TaskResponse]` (subtasks included) in list order, then
number. Filters (all optional, AND): `listId`, `status` (a status id), `statusType=OPEN|CLOSED`, `ownerId`,
`priority`, `q` (title, display id or tag, any case), `parentId` (direct subtasks of that task), `trashed=true` (the trash:
top of each trashed branch, newest first; needs TASKS_DELETE).

`GET /tasks` (TASKS_VIEW) is the portal-wide list (the Tasks module): the live tasks, subtasks included, of every project the caller may
see. Same visibility as the per-project list: Admin all projects, others members and public projects, a Client never public
ones and only tasks of `EXTERNAL` lists. A project the caller cannot see contributes nothing. Query (all optional, AND):
`scope=mine|all` (default `all`; `mine` = the caller is one of the task's owners), `projectId` (one project; not visible or
foreign: 404 `PROJECT_NOT_FOUND`), `statusType=OPEN|CLOSED`, `ownerId`, `priority`, `q` (title, display id or tag, any
case), `dueBefore` / `dueAfter` (`YYYY-MM-DD`, inclusive; tasks without a due date never match either), `limit` (1..500,
default 200) and `cursor`. Bad `scope`, `statusType`, `limit` or `cursor`: 400 `VALIDATION_FAILED` under that name. Order:
`dueDate` ascending with no due date last, then project key, then number. Paging is offset based: `cursor` is the opaque
`nextCursor` of the previous page (a number today; send it back unchanged), so the order must be stable between calls;
tasks created or moved in between can shift rows.

```jsonc
// TaskPage
{ "items": [ TaskResponse ],      // each row carries projectKey and projectName
  "nextCursor": "200",            // null on the last page
  "total": 431 }                  // all matches the caller may see, not just this page
```

`POST /projects/{projectId}/tasks` (201, TASKS_CREATE) answers `TaskResponse`. Body (only `title` is needed):

```json
{ "title": "..", "description": "..", "listId": null, "parentId": null, "statusId": null, "priority": "NONE",
  "startDate": null, "dueDate": null, "workHours": null, "completion": null, "ownerIds": [], "tags": [],
  "customValues": { "cf_x": 1 } }
```

Rules: title 1..200 (trimmed); description <= 10000; `dueDate >= startDate` (error on `dueDate`); `workHours` 0..999999 with at most
2 decimals; `completion` 0..100; tags: at most 20 of 1..30 characters, case-insensitive duplicates dropped (first
spelling stays); owners: at most 20 active members of the portal; `listId` absent = the project's first active list;
a subtask (`parentId`) goes into its parent's list and may be at most level 5 (error on `parentId`); `statusId` absent =
the layout's default status; a task created in a Closed status gets `closedAt` and completion 100. The creator and the
owners follow the task. The task takes the project's task layout (`taskLayoutId`, else the default TASK layout).
Numbers are `KEY-T<n>`, sequential per project, never reused.

`GET /tasks/{id}` (TASKS_VIEW) answers `TaskDetail` (a trashed task is a 404).

`PATCH /tasks/{id}` (TASKS_EDIT) answers `TaskResponse`. **Partial by presence**: only properties in the body change.
`null` clears `description`, `startDate`, `dueDate`, `workHours`, `ownerIds`, `tags`, makes the task top-level
(`parentId`), or clears one custom answer (`customValues` merges by key; null/empty clears the key); `null` is refused
(400) for `title`, `priority`, `completion`, `statusId`, `listId`. Properties: `title`, `description`, `priority`,
`startDate`, `dueDate`, `workHours`, `completion`, `ownerIds`, `tags`, `statusId`, `listId` (moves the task and its
subtasks; a subtask cannot be moved alone: 400 `listId`), `parentId` (moves the branch; cycles and depth over 5: 400
`parentId`; the list follows the new parent), `customValues`.

Status behaviour (`statusId` in PATCH or `POST /tasks/{id}/status` with `{ "statusId" }`, TASKS_EDIT, answers
`TaskResponse`): the status must belong to the task's layout (400 `statusId`). Moving into a CLOSED status sets `closedAt`
and completion 100 (this wins over a `completion` sent in the same request); moving to an OPEN status clears `closedAt`
(completion stays).

`PUT /tasks/{id}/layout` `{ "layoutId" }` (TASKS_EDIT) answers `TaskDetail`. The layout must be an active TASK layout
(422 otherwise). The status is mapped by name (any case), else the new layout's default; custom answers are kept (hidden
ones show in `hiddenValues`).

`DELETE /tasks/{id}` (TASKS_DELETE) trashes the task and its not-yet-trashed subtasks (200, no data).
`POST /tasks/{id}/restore` (TASKS_DELETE) answers `TaskResponse`; it brings back the subtasks trashed together with it.
Restoring a subtask whose parent is still trashed: 422 `TASK_PARENT_TRASHED`; a live task: 422 `TASK_NOT_TRASHED`.

`POST /tasks/{id}/followers/{userId}`, `DELETE /tasks/{id}/followers/{userId}` answer `TaskResponse`. The person must be an
active member (400 `userId`).

## Comments

| Call | Body | Answer |
|---|---|---|
| `GET /tasks/{id}/comments` | | `[TaskComment]` oldest first |
| `POST /tasks/{id}/comments` (201) | `{ "body" }` 1..5000, trimmed | `TaskComment` |
| `PATCH /task-comments/{id}` | `{ "body" }` author only (403 `TASK_FORBIDDEN`) | `TaskComment` |
| `DELETE /task-comments/{id}` | | author or Admin (else 403) |

All need `TASKS_VIEW` and a visible task.

## Statuses of a task layout (customfield module)

`/layouts/{layoutId}/statuses`; `GET` needs `CUSTOM_FIELDS_VIEW`, the rest `CUSTOM_FIELDS_MANAGE`. Every call answers
`[LayoutStatus]`, the layout's full list in order. `POST` (201) `{ "name" 1..30, "statusType": "OPEN|CLOSED", "color"? }`;
`PATCH /{statusId}` `{ "name"?, "statusType"?, "color"? ("" clears), "defaultStatus"?: true }`; `DELETE /{statusId}`;
`PUT /order` `{ "ids": [statusId] }` (listed first, rest follow). Rules: names unique per layout (any case); at least one
OPEN and one CLOSED; exactly one default and it is OPEN (400/422 otherwise); a status that tasks use cannot be deleted
(422 `LAYOUT_STATUS_IN_USE`) or change type; at most 20. Only TASK layouts have statuses (a PROJECT layout: 422).
New TASK layouts are seeded with Open (default), In Progress, Closed; cloning copies them. `GET /layouts/{id}` (editor)
and every resolved layout carry `statuses`.

## Layouts and custom fields for tasks

All existing endpoints work with `entityType=TASK`: `GET/POST /custom-fields`, `GET /custom-fields/all`,
`GET /layouts?entityType=TASK`, `GET /layouts/active?entityType=TASK`, `POST /layouts` (`entityType: "TASK"`), etc. The
default TASK layout "Standard" (section "Details") is created the first time it is needed. A project's task layout:
`PUT /projects/{id}/task-layout` `{ "layoutId" }` (PROJECTS_EDIT and the usual project edit rule; must be an active TASK
layout, 422 `PROJECT_LAYOUT_INVALID` otherwise) answers the project detail; `taskLayoutId` is in every project response
(null = the portal's default TASK layout). `PUT /projects/{id}/layout` now refuses a TASK layout (422).
