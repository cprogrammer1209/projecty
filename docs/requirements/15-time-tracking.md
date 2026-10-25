# 15 — Time Tracking & Timesheets
Code: `TIM` · Phase: 3 · Service: Work (time module) · Status: **Outline**

## 1. Purpose
Capture how much time people spend on what, distinguish billable from non-billable work, and get it approved, which feeds utilization (16), budgets (17), and invoicing.

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Log hours against a task, an issue, or the project in general: date, hours (or start and end time), notes, billable flag. Edit and delete own logs. Timer on a task (start / pause / stop) that creates a log. Weekly timesheet view (grid of days × items). |
| V1 | Daily and monthly views. Timesheet approval: submit a period → approve or reject (with a reason) by an approver (project manager or reporting role). Logging restrictions (portal settings): block logging on closed tasks, future dates, older than N days, or beyond estimated work hours. Time reports (by user, project, task, billable split) and export (CSV, Excel). Only one running timer per user. |
| V1 | Simple invoice generation from approved billable hours × rates (handed off to Budgeting, Step 17). |
| LATER | Integration with external invoicing tools. Idle-timer detection. Time log custom fields. |

## 3. Key business rules
- **TIM-BR-01** A time log belongs to one user, one date, and one target (task, issue, or project). Hours must be > 0 and ≤ 24 per user per day in total.
- **TIM-BR-02** Approved logs are locked. They can only be edited after the approver reopens them, which is audited.
- **TIM-BR-03** A rejected timesheet returns to the user as editable, with the reason attached.
- **TIM-BR-04** Billable defaults come from the project (setting), and the task (override).
- **TIM-BR-05** A running timer survives page reloads and logouts. Timers running for more than 12 hours prompt the user to confirm.
- **TIM-BR-06** Logged hours roll up: task → parent task → task list → phase → project. Actual vs. estimated work hours is shown on the task.
- **TIM-BR-07** Moving a task to another project moves its time logs, unless they are approved (in which case the move asks for confirmation).

## 4. Business events
`TimeLogged`, `TimeLogUpdated`, `TimeLogDeleted`, `TimerStarted`, `TimerStopped`, `TimesheetSubmitted`, `TimesheetApproved`, `TimesheetRejected`.

## 5. Dependencies
Tasks (06), Issues (11), Users and roles (02) for approvers.

## 6. Open questions
- Approval granularity: approve per log, or per user-week? Proposal: per user-week, with per-log rejection.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
