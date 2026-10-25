# 06 — Task Lists & Tasks
Code: `TSK` · Phase: 1 · Service: Work · Status: **Draft**

> **The heart of the app.** Built together with the data foundation of the Customization Engine (Step 7). See [roadmap ordering note 1](../03-roadmap.md#ordering-notes-and-adjustments).

## 1. Purpose
Tasks are the units of work people plan, assign, discuss, and complete. Task lists organize them. Everything else (Gantt, time, resources, automation, reports) builds on tasks.

## 2. Actors
Project Manager, Team Member, Client User, Follower, System (recurrence, reminders).

## 3. Scope
**In:** task lists, task CRUD, all standard fields, multiple owners, subtasks with roll-up, statuses (from the layout), comments, mentions, reactions, attachments, followers, tags, activity stream, bulk actions, copy and move, recurrence, reminders.
**Out:** dependencies (13), time logs and timer (15), blueprints and checklists (18), custom field admin UI (07).

## 4. Key entities
| Entity | Business attributes |
|---|---|
| **Task list** | Project, name, phase (optional), flag (Internal / External), order, is-default ("General"), archived |
| **Task** | ID (`WEB-T42`), project, task list, parent task (for subtasks), title, description (rich text), owners (0..n users or a team), status, priority (None / Low / Medium / High / Critical), start date and time, end (due) date and time, duration (derived or entered), work hours (estimated effort), completion % (manual or derived), tags, followers, flag (inherits from list), custom field values, created by and date, closed date, order |
| **Comment** | Task, author, rich-text body, mentions, attachments, parent comment (thread reply), edited flag and time, reactions, visibility (Internal / External, for client projects) |
| **Reaction** | Comment, user, emoji |
| **Attachment** | File reference (see Step 10), uploaded by and date |
| **Recurrence rule** | Frequency (daily / weekly / monthly / yearly), interval, days-of-week or day-of-month, end condition (never / after N occurrences / until date), "create next when current closes" vs. "on schedule" |
| **Reminder** | Task, offset (e.g., 1 day before due, or on due date, or N days after), recipients (owners / followers / specific users), channel |
| **Activity entry** | Item, actor, action, field changes (old → new), timestamp |

## 5. User stories

### Task lists
| ID | Tier | Story |
|---|---|---|
| TSK-US-01 | MVP | As a Manager, I create, rename, reorder, and delete task lists. Every project has a "General" list. |
| TSK-US-02 | MVP | As a Manager, I link a task list to a phase (see PHS-US-04). |
| TSK-US-03 | V1 | As a Manager, I flag a task list as External or Internal. |
| TSK-US-04 | V1 | As a Manager, I archive a task list. |

### Core task
| ID | Tier | Story |
|---|---|---|
| TSK-US-10 | MVP | As a member, I create a task with just a title (quick add), then fill in other fields. |
| TSK-US-11 | MVP | As a member, I set the description (rich text), owners (one or more), start and due dates, priority, and status. |
| TSK-US-12 | MVP | As a member, I open a task detail page showing all fields, subtasks, comments, attachments, and activity. |
| TSK-US-13 | MVP | As an owner, I change a task's status. Moving it to a Closed-type status marks it complete. |
| TSK-US-14 | MVP | As a member, I delete a task (it goes to the trash, with its subtasks). |
| TSK-US-15 | MVP | As a member, I set work hours (an effort estimate) and completion %. |
| TSK-US-16 | MVP | As a member, I add tags to tasks (portal-level tags, created on the fly). |
| TSK-US-17 | V1 | As a member, I assign a task to a team (see USR-BR-10). |
| TSK-US-18 | V1 | As a member, I fill in custom fields defined on the project's task layout. |

### Subtasks
| ID | Tier | Story |
|---|---|---|
| TSK-US-20 | MVP | As a member, I add subtasks to a task and see them nested under it. |
| TSK-US-21 | V1 | As a member, I nest subtasks multiple levels deep. |
| TSK-US-22 | V1 | As a member, I see the parent's completion % and work hours rolled up from subtasks. |
| TSK-US-23 | V1 | As a member, I convert a task to a subtask (set its parent) or promote a subtask to a task. |

### Collaboration on a task
| ID | Tier | Story |
|---|---|---|
| TSK-US-30 | MVP | As a member, I comment on a task with rich text. |
| TSK-US-31 | MVP | As a member, I @mention a user in a comment, and they get notified. |
| TSK-US-32 | MVP | As a member, I attach files to a task or comment. |
| TSK-US-33 | MVP | As a comment author, I edit or delete my comment. |
| TSK-US-34 | MVP | As a member, I follow or unfollow a task, and I add other followers. |
| TSK-US-35 | V1 | As a member, I reply to a comment in a thread. |
| TSK-US-36 | V1 | As a member, I react to a comment with an emoji. |
| TSK-US-37 | MVP | As a member, I see a task's activity history: who changed what, from what, to what, and when. |
| TSK-US-38 | V1 | As a Manager in a client project, I mark a comment Internal so client users can't see it. |

### Bulk, copy, move
| ID | Tier | Story |
|---|---|---|
| TSK-US-40 | V1 | As a member, I select multiple tasks and update status, owner, priority, dates, or tags in one action. |
| TSK-US-41 | V1 | As a member, I bulk delete tasks. |
| TSK-US-42 | V1 | As a member, I move a task (with subtasks) to another task list or project. |
| TSK-US-43 | V1 | As a member, I copy a task (optionally with subtasks, attachments, and comments) to another list or project. |

### Recurrence & reminders
| ID | Tier | Story |
|---|---|---|
| TSK-US-50 | V1 | As a member, I make a task recurring (daily, weekly, monthly, yearly, with an end condition). |
| TSK-US-51 | V1 | As a member, I set reminders before or after the due date for owners, followers, or specific users. |
| TSK-US-52 | V1 | As an owner, I get a notification when my task becomes overdue. |

### Timer (handoff to Step 15)
| ID | Tier | Story |
|---|---|---|
| TSK-US-60 | V1 | As an owner, I start and stop a timer on a task, which creates a time log (delivered with Step 15). |

## 6. Business rules
- **TSK-BR-01** A task always belongs to exactly one project and one task list. A subtask belongs to the same project and list as its parent.
- **TSK-BR-02** Task IDs (`KEY-T<n>`) are sequential per project and never reused, even after deletion. Moving to another project assigns a new ID and keeps the old one as an alias that redirects.
- **TSK-BR-03** Due date ≥ start date. If only duration and start are given, due is derived (and vice versa). In a Strict project, both must be within project dates.
- **TSK-BR-04 Statuses come from the project's task layout.** Each status is of type Open or Closed. The default set is Open → In Progress → Closed. Setting a Closed-type status records the closed date and sets completion to 100%. Reopening clears the closed date and sets completion back to its previous value.
- **TSK-BR-05 Single status-change path.** Every status change (form, inline, Kanban drag, bulk, import, API) goes through the same server-side rule. That is where blueprints (Step 18) will plug in.
- **TSK-BR-06 Roll-up (V1):** parent work hours = sum of its children's work hours when the parent has children (the parent's own value becomes read-only). Parent completion % = work-hour-weighted average of children, or a simple average if there are no work hours.
- **TSK-BR-07** A parent task can be closed while subtasks are open only after confirmation. The open subtasks stay open. (A setting to block this instead comes in V1.)
- **TSK-BR-08 Maximum subtask depth** is 5 levels.
- **TSK-BR-09 Activity stream** records every field change, including custom fields, with old and new values. Description changes are recorded as "description updated," with no diff in MVP.
- **TSK-BR-10 Comments:** authors can edit within their profile scope. Edits show an "edited" marker. Deleted comments show "comment deleted" if they had replies; otherwise they disappear.
- **TSK-BR-11 Mentions** may only target users who can see the task. Mentioning a non-member offers "add to project?" (if the mentioner is a Manager) or is rejected.
- **TSK-BR-12 Followers:** owners, the creator, and mentioned users are auto-followers. A user can unfollow even if they are an owner, which mutes notifications only.
- **TSK-BR-13 Visibility:** the task's flag is inherited from its task list. Client users only see External tasks. A client user creating a task in an external list creates an External task.
- **TSK-BR-14 Recurrence:** the next occurrence is created when the current one is closed (default), or on schedule (option). It copies title, description, owners, priority, tags, work hours, and custom fields, but not comments, attachments, or time logs. Dates shift by the interval.
- **TSK-BR-15 Reminders** are computed in the recipient's time zone. Reminders on closed tasks don't fire.
- **TSK-BR-16 Move to another project:** custom field values that don't exist in the target layout are dropped (with a warning and a list), and the status is mapped to the target layout's status set (by name, else to the default Open status).
- **TSK-BR-17 Bulk actions** apply per-item permission checks. Items that fail are reported individually. The others succeed (partial success, not all-or-nothing).
- **TSK-BR-18 Tags** are portal-level, case-insensitive unique, with a color.

## 7. Acceptance criteria
- **TSK-US-13**
  - Given a task in "In Progress", when its owner sets "Closed", then completion = 100%, the closed date = now, the activity shows the change, and followers are notified.
  - Given a user without edit rights on the task, when they drag it on Kanban, then the server rejects it and the card returns to its column.
- **TSK-US-22**
  - Given a parent with children A (10h, 100%) and B (30h, 0%), then the parent shows 40h and 25%.
- **TSK-US-50**
  - Given a weekly recurring task due Monday, when it's closed on Wednesday, then a new task is created due next Monday with the same owners and fields and no comments.
- **TSK-US-40**
  - Given 10 selected tasks where the user can edit only 8, when they bulk-set priority High, then 8 update and the user sees "2 tasks skipped: no permission" with links.

## 8. Permissions
Profile module "Tasks": View / Create / Edit / Delete with scope Own / Project / All. Comments follow task view permission for reading. "Own" covers the creator and owners. Editing others' comments is Admin only.

## 9. Business events
`TaskListCreated`, `TaskListUpdated`, `TaskListTrashed`, `TaskCreated`, `TaskUpdated` (with changed fields), `TaskStatusChanged`, `TaskAssigned`, `TaskUnassigned`, `TaskClosed`, `TaskReopened`, `TaskMoved`, `TaskCopied`, `TaskTrashed`, `TaskRestored`, `CommentAdded`, `CommentEdited`, `CommentDeleted`, `UserMentioned`, `ReactionAdded`, `AttachmentAdded`, `FollowerAdded`, `TaskReminderDue`, `TaskOverdue`, `RecurringTaskGenerated`.

## 10. Notifications
Assigned to me, a task I own or follow changed status, a comment on a task I own or follow, I was mentioned, a reminder, my task is overdue, a due date I follow changed.

## 11. Dependencies
Projects (04), Phases (05), Customization data foundation (07), Documents storage for attachments (10). Notifications (09) are built right after, and events are emitted from day one.

## 12. Open questions
- Multiple owners and completion: when one of three owners closes the task, is it closed for all? Proposal: yes. A single status per task, as in Zoho.
- Should "start time / due time" (time of day) be in MVP, or dates only? Proposal: dates only in MVP, times in V1.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial draft |
