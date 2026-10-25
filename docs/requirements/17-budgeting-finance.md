# 17 — Budgeting & Finance
Code: `BUD` · Phase: 3 · Service: Work (finance module) · Status: **Outline**

## 1. Purpose
Track what a project is expected to cost and earn against what it actually costs and earns, and warn before budgets are blown.

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Project budget: type (Fixed cost / Based on project hours / Based on user rates), budget amount or hours. Cost rates per user. Actual cost = approved hours × cost rate. Budget vs. actual on the project overview. |
| V1 | Revenue budget vs. cost budget. Billing methods: fixed fee, project hourly rate, task hours, staff rates. Billing rates per user per project. Expenses (amount, category, date, receipt, billable, approval). Threshold alerts (e.g., at 80% and 100% of budget). Planned vs. actual cost report. Simple invoice draft from billable hours and expenses (a PDF, not an accounting system). |
| LATER | Task-level budgets. Multi-currency per project. Integration with accounting tools. Role-based rates. |

## 3. Key business rules
- **BUD-BR-01** Amounts use the portal currency (PTL-BR-04). Rates are effective-dated: a rate change doesn't recalculate history unless explicitly requested.
- **BUD-BR-02** Only approved time logs (TIM-BR-02) count toward actual cost. Pending time is shown separately as "unapproved."
- **BUD-BR-03** Threshold alerts fire once per threshold per project, and fire again only if the budget is changed.
- **BUD-BR-04** Financial fields (rates, costs, budgets) are hidden from everyone except Admins, project owners, and users with the "View financials" permission.
- **BUD-BR-05** An invoiced time log or expense is locked and can't be invoiced twice.

## 4. Business events
`BudgetSet`, `BudgetChanged`, `RateChanged`, `ExpenseRecorded`, `ExpenseApproved`, `BudgetThresholdCrossed`, `InvoiceGenerated`.

## 5. Dependencies
Time tracking (15), Users (02), Projects (04).

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
