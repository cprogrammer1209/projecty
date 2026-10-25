# 13 — Scheduling & Gantt
Code: `GNT` · Phase: 3 · Service: Work · Status: **Outline**

## 1. Purpose
Plan a project over time: dependencies between tasks, automatic rescheduling, the critical path, and comparison of the plan against reality.

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Gantt chart of phases, task lists, tasks, and subtasks with bars by start and due date. Drag to move and resize bars. Finish-to-Start dependencies drawn between bars. Today line. Zoom (day / week / month). Milestone markers (zero-duration tasks). |
| V1 | All four dependency types (FS, SS, FF, SF). Lag and lead (in working days). Auto-reschedule dependents when a predecessor moves. Working-day-aware durations using business hours and holiday calendars. Critical path calculation and highlighting. Baselines (save up to 5 snapshots, compare planned vs. actual). Circular dependency prevention. Progress shading on bars. |
| V1 | Import tasks from CSV and Excel (with column mapping). Export the Gantt to PDF or PNG. |
| LATER | Resource view inside the Gantt (by owner). MS Project (`.mpp`) import. Cross-project dependencies. |

## 3. Key business rules
- **GNT-BR-01** Dependencies can only link tasks in the same project (V1). Cycles are rejected at creation.
- **GNT-BR-02 Auto-reschedule:** when a predecessor's dates change, its dependents shift to satisfy the dependency plus lag, cascading down the chain. Only forward violations move tasks automatically; gaps aren't closed. A project-level setting can turn this off, in which case violations are highlighted instead.
- **GNT-BR-03** Durations are counted in working days: non-working days and holidays are skipped. A task can't start on a non-working day (it snaps to the next working day).
- **GNT-BR-04** In a Strict project, rescheduling that would push a task past the project end is blocked, and the conflict is shown.
- **GNT-BR-05** Critical path = the chain(s) of tasks with zero total float. It's recalculated on every schedule change.
- **GNT-BR-06** A baseline is immutable once saved. Variance = actual or current dates minus baseline dates, in working days.
- **GNT-BR-07** Closed tasks don't move during auto-reschedule.

## 4. Business events
`DependencyAdded`, `DependencyRemoved`, `TaskRescheduled` (with cause: manual or cascade), `BaselineCreated`, `TasksImported`.

## 5. Dependencies
Tasks (06), Phases (05), Portal business hours and holidays (01).

## 6. Open questions
- Should a parent task's dates auto-span its subtasks (summary task behavior)? Proposal: yes, in V1.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
