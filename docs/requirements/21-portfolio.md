# 21 — Portfolio Management
Code: `PFL` · Phase: 5 · Service: Work · Status: **Outline**

## 1. Purpose
Give leadership a view across many projects: health, progress, resources, and money.

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Portfolio dashboard: all accessible projects with status, owner, progress %, dates, overdue counts, and a health indicator (on track / at risk / off track). Filter by project group, owner, or status. |
| V1 | Health rules (e.g., at risk if > 10% of tasks are overdue or the end date is under 7 days away with less than 80% progress). Cross-project Gantt (projects and phases as bars). Cross-project resource utilization. Portfolio budget roll-up (budget vs. actual across projects). Portfolio reports and export. |
| LATER | Named portfolios (saved sets of projects with their own owners). Scenario planning. |

## 3. Key business rules
- **PFL-BR-01** Only projects the viewer can access are included. Financial columns follow BUD-BR-04.
- **PFL-BR-02** Health is computed by rules, but a Manager can override it manually with a comment. The override is shown as such.

## 4. Business events
`ProjectHealthChanged`, `ProjectHealthOverridden`.

## 5. Dependencies
Projects (04), Gantt (13), Resources (16), Budget (17), Reports (20).

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
