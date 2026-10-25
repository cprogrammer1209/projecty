# 16 — Resource Management
Code: `RES` · Phase: 3 · Service: Work · Status: **Outline**

## 1. Purpose
Help managers see who is over- or under-loaded and rebalance work before deadlines slip.

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Utilization chart: per user per day/week, allocated hours (from open tasks' work hours spread over their working days) vs. available hours (business hours minus leave and holidays). Color coding: under / optimal / over. Filter by project or team. |
| V1 | Per-user capacity override (e.g., part-time at 4h/day). Leave entry (user or manager, with type and dates). Workload report (over/under allocation list). Reassign a task by drag or quick action from the chart. Drill down into a user-day to see the tasks behind it. |
| LATER | Skills-based suggestions. Role-based planning (placeholder resources). Holiday calendar per user or location. |

## 3. Key business rules
- **RES-BR-01** Allocation for a task = work hours ÷ number of owners ÷ working days between start and due. Tasks without dates or work hours aren't counted, and are listed separately as "unscheduled."
- **RES-BR-02** Available hours = the user's capacity per working day − leave − holidays.
- **RES-BR-03** Utilization thresholds (portal setting): < 70% under, 70–100% optimal, > 100% over.
- **RES-BR-04** Users only see utilization for users they can see under the role hierarchy (USR-BR-03), or for projects they manage.

## 4. Business events
`LeaveRecorded`, `LeaveCancelled`, `CapacityChanged`. Reassignment emits `TaskAssigned`.

## 5. Dependencies
Tasks (06), Gantt dates (13), business hours and holidays (01), time tracking (15) for actuals.

## 6. Open questions
- Should leave need approval? Proposal: no approval in V1; the leave entry just records it.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
