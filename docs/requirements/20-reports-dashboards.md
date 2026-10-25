# 20 — Reports & Dashboards
Code: `RPT` · Phase: 5 · Service: Work (reporting module on a read model) · Status: **Outline**

## 1. Purpose
Turn the data in the system into answers: are we on track, who is overloaded, where is time going, and what is stuck?

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Built-in project reports: task status distribution, overdue tasks, tasks by owner, planned vs. actual (dates), issue trends (open vs. closed over time), issues by severity. Project dashboard with fixed widgets. |
| V1 | Timesheet reports, workload report, phase report, budget report. Custom reports: pick module (including custom modules), filters, group-by (up to 2 levels), aggregations (count, sum, avg), chart type (bar, line, pie, table). Custom dashboards built from widgets (charts, KPIs, lists) by drag and drop. Share dashboards with users, teams, or project members. Export to CSV, Excel, or PDF. |
| V1 | Scheduled report emails (daily, weekly, or monthly to selected users). |
| LATER | Cross-portal analytics. Pivot tables. Embed external BI. Drill-through from a chart to a filtered list. |

## 3. Key business rules
- **RPT-BR-01** Reports respect the **viewer's** permissions, including field-level permissions. A shared dashboard shows each viewer only their visible data.
- **RPT-BR-02** Report data may lag live data by at most 5 minutes. The "as of" time is shown on each widget.
- **RPT-BR-03** Scheduled report emails are generated with each recipient's own permissions, never the scheduler's.
- **RPT-BR-04** Heavy report queries must not slow down normal usage (a requirement on the read model).
- **RPT-BR-05** Sensitive fields (CUS-US-10) are excluded from exports unless the user has permission.

## 4. Business events
`ReportCreated`, `DashboardShared`, `ReportScheduled`, `ReportExported` (audited).

## 5. Dependencies
All data modules. This step is best started after Steps 6–18 have stabilized their events.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
