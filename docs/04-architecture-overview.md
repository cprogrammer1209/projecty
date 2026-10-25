# 04 — Architecture Overview (Decision Record)

> This document records the **service decomposition decision** only. Detailed technical design (domain models, APIs, event schemas, databases, infrastructure) comes after the business requirements are signed off.

**Stack:** Angular frontend, Spring Boot microservices, and an API gateway in front.

## Decision: 4 services

Services are drawn around **which data must change together in one transaction**, not around features.

| # | Service | Owns | Why separate |
|---|---|---|---|
| 1 | **Platform** | Portals/tenants, identities, users, teams, roles, profiles, authentication (delegated to **Keycloak**, which handles login, 2FA, SSO and token issuance; Platform drives it through the Admin API), entitlements, plans, subscriptions, billing, and audit log storage | Identity and tenancy are the root of trust, and every other service depends on them through tokens rather than calls. |
| 2 | **Work** | Projects, phases, task lists, tasks, issues, custom modules, the customization engine, blueprint *validation*, views, Gantt and scheduling, calendar, documents (metadata), comments, collaboration, time tracking, timesheets, resources, budgets, search indexing, reports, portfolio, and AI | Timesheets, budgets, and resources constantly join with tasks, assignees, and hours. One database gives real joins and transactions with no event-fed copies to keep in sync. |
| 3 | **Notification** | Delivery of in-app, email, and digest notifications (and future push/WhatsApp), templates, user preferences, the in-app inbox, and real-time WebSocket push | Bursty fan-out (one comment can notify 50 people on 3 channels). Keeps slow email providers from ever blocking a task save. |
| 4 | **Automation** | Workflow rules engine, blueprint *after-actions*, SLA timers and escalations, scheduled jobs (recurring tasks, reminders, digests), custom function sandbox, outgoing webhooks, third-party integrations, and import/migration jobs | Runs user-written code that needs sandboxing. Long-running and time-based runtime model. A runaway workflow can't take down Work. |

## Module → service mapping

| Service | Roadmap steps |
|---|---|
| Platform | 1 Portal, 2 Users/Roles, 3 Security core, 24 SSO/Compliance/Billing |
| Work | 4 Projects, 5 Phases, 6 Tasks, 7 Customization, 8 Views, 10 Documents, 11 Issues, 12 Search, 13 Gantt, 14 Calendar, 15 Timesheets, 16 Resources, 17 Budgets, 19 Collaboration, 20 Reports, 21 Portfolio, 23 AI |
| Notification | 9 Notifications |
| Automation | 18 Workflow rules, SLAs, blueprint after-actions, custom functions, schedulers; 22 Webhooks/Integrations/Migration |
| API Gateway | 22 Public API routing, auth, and rate limiting |

## Boundary rules

1. **Database per service.** No service reads another service's tables.
2. **Almost no synchronous service-to-service calls.** Platform issues a token (JWT) that carries tenant, user, roles, and profile. Other services verify it locally, and they cache profile permissions, which are refreshed via events.
3. **Events for everything else.** Each service writes to its own outbox in the same transaction as the change, then publishes to a message broker.
4. **Blueprint is split.** Transition validation (who can perform it, mandatory fields, checklists) stays in **Work**, synchronous and in the same transaction as the status change. Only the *after-actions* go to **Automation** as events.
5. **Automation never writes Work's database.** A workflow action like "update field X" calls Work's internal API, so Work still enforces permissions, layout rules, and blueprints.
6. **Notification owns delivery, not decisions.** Work emits domain events ("task assigned", "user mentioned"), and Automation emits "send notification" commands from user-defined rules. Notification decides *how* and *whether* to deliver, based on templates and preferences.
7. **Guard against loops.** Events carry a correlation ID and a depth counter. Automation stops past a depth limit.
8. **Work is a modular monolith inside.** Each area (projects, tasks, issues, customization, blueprint, scheduling, time, finance, collaboration, search, reporting, AI) is its own internal module with no cross-module table access. That way reports, search, or AI can be lifted into their own service later without a rewrite.
9. **Permissions travel with data.** Search and reports must filter by project membership, the internal/external flag, and field permissions. Leaks most often happen through search results.

## Service rollout

| Phase | Running services |
|---|---|
| 0–1 | Platform + Work (notifications as a module inside Work) |
| 2 | + **Notification** extracted, once there are real channels, preferences, and digests |
| 4 | + **Automation**, once workflow rules and blueprint after-actions arrive |
| 6 | API Gateway exposes the public API. Webhooks and integrations go into Automation. |

## Decided

- Identity provider: **Keycloak** (2026-10-25). Services validate its JWTs locally as OAuth2 resource servers.

## To be decided in technical design

- Tenancy model: shared schema with `tenant_id` vs. schema-per-tenant
- Message broker (Kafka, Redpanda, RabbitMQ, or NATS)
- Database (PostgreSQL assumed), and storage for custom field values (JSONB vs. EAV)
- Search engine (OpenSearch vs. PostgreSQL full-text for the early phases)
- Object storage for documents (S3-compatible, MinIO locally)
- Angular architecture (standalone components, state management, micro-frontends or not)
- Local developer setup (Docker Compose) and deployment target
