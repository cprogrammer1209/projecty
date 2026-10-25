# 11 — Issue Tracker
Code: `ISS` · Phase: 2 · Service: Work · Status: **Outline**

## 1. Purpose
A second work type, for bugs, defects, and problem reports. It reuses the work-item engine from Steps 6–7 (comments, attachments, followers, activity, layouts, custom fields, statuses, views) and adds issue-specific fields and intake channels.

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Issue CRUD with fields: title, description, reporter, assignee, severity (Show-stopper / Critical / Major / Minor / None), classification (Bug / Enhancement / Feature / Other), module/component, reproducibility (Always / Sometimes / Rarely / Unable / Not applicable), due date, flag (Internal / External), attachments. Default issue status set (Open → In Progress → To be tested → Closed / Reopened). Comments, mentions, followers, activity. List and Kanban views, My Issues. |
| V1 | Issue layouts and custom fields. Custom issue statuses. Affected phase and release phase. Link issues ↔ tasks (relates to / blocks / caused by). Auto-assignment rules by module or classification. Issue reports (open vs. closed trend, by severity, by assignee). Client users can report issues. |
| V1 | Web-to-issue form: a public embeddable form that creates issues (with captcha and rate limiting). |
| LATER | Email-to-issue. Link to Git commits (GitHub/GitLab/Bitbucket, Step 22). SLA and escalation (Step 18). Duplicate detection. |

## 3. Key business rules
- **ISS-BR-01** Issue IDs: `KEY-I<n>`, sequential per project.
- **ISS-BR-02** The reporter is set automatically to the creator, or to the external submitter (web form). Reporters always follow their issues.
- **ISS-BR-03** Auto-assignment rules run in order, and the first match wins. Manual assignment overrides them.
- **ISS-BR-04** Reopening a closed issue records the reopen count, which is shown in reports.
- **ISS-BR-05** Web-form submissions arrive as "Unassigned / Open", from an anonymous reporter (name and email captured). They are always External.
- **ISS-BR-06** Severity and classification are system picklists. Their options are editable by the Admin.

## 4. Business events
`IssueCreated`, `IssueUpdated`, `IssueStatusChanged`, `IssueAssigned`, `IssueClosed`, `IssueReopened`, `IssueLinked`, `IssueSubmittedViaForm`, plus the shared comment, attachment, and follower events.

## 5. Dependencies
Tasks engine (06), Customization (07), Views (08), Phases (05).

## 6. Open questions
- Generalize tasks and issues into one "work item" engine with types, or keep two modules that share components? This is a business-visible question, because it affects whether a user can convert a task into an issue. Proposal: shared engine, separate modules, with "convert" as a V1 action.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
