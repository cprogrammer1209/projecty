# 22 — Integrations & Public API
Code: `API` · Phase: 6 · Service: API Gateway + Automation · Status: **Outline**

## 1. Purpose
Let other systems and developers read and act on ProjectY data, and connect ProjectY to the tools teams already use.

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Public, versioned REST API for projects, phases, task lists, tasks, issues, comments, time logs, and users (read). Personal API tokens. API documentation (OpenAPI). Rate limits per portal. |
| V1 | OAuth 2.0 apps (register an app, scopes, consent screen). Outgoing webhooks: subscribe to events, signed payloads, retries with backoff, delivery log, auto-disable after repeated failures. Bulk import and export (CSV, Excel) for tasks, issues, and users. One showcase integration: GitHub (link commits and PRs to tasks or issues by ID in the commit message). |
| LATER | Slack and Microsoft Teams notifications. Google Calendar sync (Step 14). Zapier app. Migration importers (Jira, Trello, Asana, Monday.com). An extension/widget framework inside the UI. A browser extension. |

## 3. Key business rules
- **API-BR-01** The API enforces exactly the same permissions, validation, layout rules, and blueprints as the UI. There is no back door.
- **API-BR-02** Custom fields are read and written by **API name** (CUS-BR-01).
- **API-BR-03** Webhook payloads exclude fields the webhook owner can't see, and they are signed (HMAC) so receivers can verify them.
- **API-BR-04** API changes within a version are additive only. Breaking changes need a new version, with 6 months of overlap.
- **API-BR-05** Token creation, scope changes, and app authorizations are audited.

## 4. Business events
`ApiTokenCreated`, `ApiTokenRevoked`, `OAuthAppAuthorized`, `WebhookCreated`, `WebhookDisabled`, `ImportCompleted`, `ExportCompleted`.

## 5. Dependencies
All modules. Ideally the internal APIs are designed API-first from Phase 1, so this step mostly *exposes* them.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
