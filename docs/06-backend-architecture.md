# 06 — Backend Architecture (default for every Spring service)

Every ProjectY Spring Boot service (Platform, Work, Notification, Automation) follows [ARCHITECTURE.md](../ARCHITECTURE.md). This document adds the ProjectY-specific decisions on top of it, and maps the Platform service onto it.

---

## Part 1: The standard

The standard lives in **[ARCHITECTURE.md](../ARCHITECTURE.md)** at the repo root, and that file is the single source of truth. It covers the top-level split, the `api/` / `internal/` module layout, the `shared` module, inter-module communication, service patterns, dependency direction, constants, injection, `common/` and `external/`.

`CLAUDE.md` loads it automatically, so every Claude Code session in this repo applies it to new features.

---

## Part 2: ProjectY additions and decisions

| Topic | Decision |
|---|---|
| **Response envelope** | Every endpoint returns `AppResponse<T>`. Success is `{"success": true, "data": …}`, with `data` omitted when there is nothing to return. An error is `{"success": false, "error": {"code", "message", "details"}}`, and the HTTP status still carries meaning. Security failures (401/403) and standard Spring MVC errors use the same shape. |
| **Envelope exceptions** | Standard protocol documents stay raw, for example `/.well-known/jwks.json`. |
| **Error codes** | Stable UPPER_SNAKE codes, declared in the owning module's constants (or `AppConstants` for app-wide ones). The frontend switches on `error.code`, never on `message`. |
| **Extra `internal/` folders** | `config/` (the module's `@ConfigurationProperties` and beans), `helper/` (module-private helpers), `event/` (module-private events), `listener/` (handlers for other modules' events). |
| **Events in `api/`** | A module may publish domain events as records in `api/event/`. Use them when a direct `WriteService` call would create a dependency cycle, or when the publisher shouldn't know its listeners. Listeners that must be atomic with the change use `@EventListener` (same transaction); side effects such as email use `@TransactionalEventListener` (after commit). |
| **Configuration** | Each module binds its own prefix (`projecty.{module}.*`). App-wide settings are `projecty.*` in `common/config/AppProperties`. |
| **Lombok** | Allowed on entities for `@Getter` and `@NoArgsConstructor(access = PROTECTED)`. Not for injection. |
| **Constants exception** | `Logger` and `SecureRandom` fields may stay `private static final` in their class. |
| **Mappers** | Hand-written `@Component` classes; no MapStruct. |
| **Enforcement** | Convention and code review (no ArchUnit). A quick grep check: no `modules.X.internal` import inside `modules/Y`, and no stereotype annotations in `api/`. |

---

## Part 3: Platform service module map

| Module | Owns | Exposes (`api/`) |
|---|---|---|
| `account` | `AppUser`, `EmailToken`; signup, verify email, password reset, `/api/me` | `UserLookUpService` (`findById`, `findByIds`), `UserWriteService.authenticate`, `UserResponseDTO`, `UserPasswordResetEvent` |
| `session` | `AuthSession`, `RefreshToken`; login, refresh, logout | `SessionWriteService` (`revokeAllForUser`, `openSupportSession`, `endSupportSession`), `SupportSessionExpiredEvent` |
| `token` | `SigningKey`; JWT signing and checking, JWKS; maps audience → role (USER / PLATFORM_ADMIN) | `TokenWriteService.issueAccessToken`, `issueAdminAccessToken` |
| `portal` | `Portal`; create portal, slug rules, settings | `PortalLookUpService` (`findAllPortals`, `findPortal`, `findByIds`), `PortalCreatedEvent` |
| `member` | `PortalMember`, `Profile`, `Invitation`; user list, profiles, invitations, deactivation | `MemberLookUpService` (`findActivePortalIds`, `findMemberships`, `findMembers`, `isActiveMember`, `countMembers`); implements `common` `PortalAccessService` |
| `admin` | `AdminUser`, `AdminSession`; admin console sign-in (`/api/admin/auth`), first-admin bootstrap; tenant views (Aggregate service over portal + account) | `AdminLookUpService` |
| `impersonation` | `Impersonation`; every support-session endpoint: `POST /api/admin/impersonations`, `POST /api/auth/impersonation/redeem`, `/end` | — (no other module needs it) |
| `audit` | `AuditEvent` (append-only); `/api/admin/audit-events` (platform admins), `/api/audit-events` (portal Admins, `AUDIT_VIEW`) | `AuditWriteService.record` |
| `outbox` | `OutboxEvent`; the relay that publishes business events (SEC-US-06) | `OutboxWriteService.publish` (needs the caller's transaction) |
| `common/security/helper` | `RefreshCookieHelper` for the customer `py_refresh` cookie (used by session and impersonation) | — |
| `shared` | `OpaqueTokenHelper` (account, session, admin, impersonation); `AuditEventConstants` (values every auditing module uses) | — |
| `external/mail` | SMTP sending | `MailService` |
| `external/broker` | Kafka publisher (`BrokerPublisher`; `projecty.broker.type=logging` only logs, used by tests) and topic creation | `BrokerPublisher` |

```
session       ──▶ account.api, member.api, token.api
member        ──▶ portal.api, account.api, audit.api, outbox.api, external/mail
portal        ──▶ audit.api, outbox.api
outbox        ──▶ external/broker
portal ──PortalCreatedEvent──────────▶ member
account       ──▶ portal.api, member.api, audit.api, external/mail
admin         ──▶ account.api, portal.api, member.api, token.api, audit.api
impersonation ──▶ session.api, account.api, member.api, admin.api, audit.api
account ──UserPasswordResetEvent────▶ session
session ──SupportSessionExpiredEvent──▶ impersonation
```

**Portal-owned data (PTL-BR-01).**
- Every portal-owned table has a `portal_id`, and every repository method on it takes `portalId` (`findByIdAndPortalId…`).
- Services get the id only from `common/service/RequestPortalContext` (`requirePortalId()`), never from the request body or path.
- `PortalContextFilter` has already checked the id against the token, so a record from another portal is simply not found (404).
- Each feature adds a "foreign portal → 404" check.

**Permissions.**
- Annotate each portal endpoint with `@RequirePermission(PermissionConstants.X)`. `PermissionInterceptor` checks it through the `PortalAccessService` port, which is defined in `common/service` and implemented by `member`, so `common` never imports a module.
- Permission names live in `modules/shared/constants/PermissionConstants`. Profiles grant them in `MemberConstants.SYSTEM_PROFILES`.
- **Two service beans in `member`:** the read-only `MembershipService` (repositories + `portal.api`) and the management `MemberService` (needs `account.api`). This split prevents a bean cycle, because `account` reads memberships for `/api/me`.

**Two kinds of access token, one signing key.** Customer tokens have audience `projecty-api` (role USER); admin console tokens have audience `projecty-admin` (role PLATFORM_ADMIN). `SecurityConfig` gives `/api/admin/**` to PLATFORM_ADMIN and the rest of `/api/**` to USER, so neither token works on the other side. A support session is a normal customer token for the target user plus `act` (the admin) and `imp` (session id and end time).

## Part 4: Work service module map

`work-service` (port 8082, database `work`) follows the same standard. It never calls Platform to check a request: the token is checked against Platform's published keys, and "who is in this portal and what may they do" comes from Platform's member events.

| Module | Owns | Exposes (`api/`) |
|---|---|---|
| `access` | `MemberAccess` (portal, user, profile key, permissions, active), `ProcessedEvent`; the Kafka listener on `projecty.member`; the portal-access port the security filter needs | `MemberAccessLookUpService.findMemberAccess` |
| `project` | `Project`, `ProjectMember`, `ProjectActivity`; every `/api/work/projects*` and `/api/work/project-statuses` endpoint; the `custom_values`, `layout_id` and `task_layout_id` columns of `project`; `PUT /api/work/projects/{id}/layout` and `/task-layout`; `PATCH /api/work/projects/{id}` is a partial update (only the properties sent change, `null` clears a date, the description or an answer) | `ProjectLookUpService.findVisibleProject` (the project if the user may see it, as `ProjectSummaryDTO(id, key, name, taskLayoutId)`). Implements `CustomValueHolder` so `customfield` can count and clear its answers and count the projects on a layout |
| `customfield` | `CustomField`, `CustomFieldOption`, `CustomFieldUniqueValue`, `Layout`, `LayoutSection`, `LayoutField`, `LayoutStatus` (statuses of TASK layouts); every `/api/work/custom-fields*` and `/api/work/layouts*` endpoint (including `/layouts/{id}/statuses*`); the validator that checks every custom answer (see its README) | `CustomFieldLookUpService` (`findFields`, `validate` (per layout), `changedKeys`), `LayoutLookUpService` (`findActiveLayouts`, `getLayout`, `getDefaultLayoutId`, `findStatuses`, `getStatus`), `CustomFieldWriteService.reserveUniqueValues`, `CustomValueHolder` and `StatusUsageHolder` (implemented by modules that store answers or statuses), `CustomFieldResponseDTO` |
| `task` | `TaskList`, `Task`, `TaskComment`, `TaskActivity`; every `/api/work/projects/{id}/task-lists`, `/projects/{id}/tasks`, `/task-lists/*`, `/tasks/*` and `/task-comments/*` endpoint; the `task_sequence` numbering (`KEY-T<n>`, never reused) | — (nothing needs it yet). Implements `CustomValueHolder` and `StatusUsageHolder`; reads projects only through `ProjectLookUpService`. Contract: `docs/task-api-contract.md` |
| `outbox` | `OutboxEvent`; the relay that publishes Work's events (copy of Platform's) | `OutboxWriteService.publish` |
| `shared` | `PermissionConstants` (names Platform grants), `OutboxEventConstants` | — |
| `external/broker` | Kafka publisher and topic creation (copy of Platform's) | `BrokerPublisher` |

```
project ──▶ access.api, outbox.api, customfield.api   (field and layout ports)
task ──▶ access.api, outbox.api, customfield.api, project.api   (project never calls task)
customfield ──▶ access.api, outbox.api            (never imports project or task: it calls the CustomValueHolder and StatusUsageHolder they implement)
outbox  ──▶ external/broker
Platform ──projecty.member events──▶ access
```

`common/` is copied from Platform (response envelope, errors, `X-Portal-Id` filter, `@RequirePermission`); `JwtConfig` differs: it checks Platform's tokens through `projecty.token.jwk-set-uri`, `issuer` and `audience`. The copied outbox, broker and `common/` code is duplicated on purpose for now; a shared library is a later cleanup.
