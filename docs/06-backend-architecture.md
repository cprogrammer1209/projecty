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
| `external/redis` | Key-value port over Redis (`KeyValueStore`: get, put with TTL, delete, exists, increment, time to live) and `CacheService` on top of it (hit-or-miss `read` with a loader, `peek`/`put` for batch lookups, versions with `bumpAfterCommit`, `evictAfterCommit`). `projecty.redis.type=memory` keeps it in-process (used by tests). **Fails open**: if Redis is down callers see an empty store, and after one failure Redis is left alone for `projecty.redis.backoff` so an outage costs one timeout, not one per call | `KeyValueStore` |

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

**Redis (cache, rate limits, token denylist).** One Redis shared with Work, always behind `external/redis/KeyValueStore`. If it is down, everything falls back to the database and nothing is throttled.
- **Membership cache.** `member/internal/helper/MemberAccessCache` holds "active member + permissions" per portal and user (`platform:access:{portalId}:{userId}`, TTL `projecty.redis.access-ttl`). `MembershipServiceImpl` reads through it, so the two per-request checks cost one lookup. `MemberServiceImpl.publish` (every member change goes through it) evicts the entry after the transaction commits. The TTL covers a Flyway permission change.
- **Rate limits.** `@RateLimit(RateLimitConstants.X)` on a controller method, enforced by `RateLimitInterceptor` (registered before `PermissionInterceptor`): a fixed window per client IP and name, `platform:ratelimit:{name}:{ip}`. Names and numbers: `projecty.rate-limit.limits.*` (login, refresh, signup, email, token). Over the limit: 429 `RATE_LIMITED` with `Retry-After`. The IP is `request.getRemoteAddr()`, so behind a proxy `SERVER_FORWARD_HEADERS_STRATEGY=native` must be set (the compose files do) or every user shares the proxy's address.
- **Cached reads (phase 2).** Same service-layer pattern everywhere: the service method hands its database code to a small cache helper as a loader, so a hit never runs it. `portal/.../PortalCache` (`findPortal`, `findByIds`, `getCurrent`; evicted by `updateSettings`), `account/.../UserCache` (`findById`, `findByIds`, `getMe`; evicted by sign-in, email verification, password reset and preference changes), `member/.../MemberResponseCache` (active portal ids, `/api/portal/me`, member list, profile list, invitation list). A member change evicts the user's entries and moves the portal's members version from the one place every member change goes through, `MemberServiceImpl.publish`; invitation changes move the invitations version. The keys are listed in `modules/shared/constants/CacheKeyConstants` because a module evicts keys another module caches (a member change drops the account module's `/api/me`). Lists look up their users and portals with one cache probe per id and a single database call for the misses.
- **Not cached on purpose:** admin tenant and audit screens (rare and constantly changing), the invitation preview and slug check (keyed by user input).
- **Token denylist.** Every session revocation (logout, refresh-token reuse, password reset, support session end, admin logout) calls `TokenWriteService.denySession`, which writes `denylist:sid:{sessionId}` for the access-token lifetime. `token/internal/helper/DenylistValidator` (in `JwtConfig`) refuses tokens whose `sid` is on it, so a revoked session stops working at once instead of after up to 15 minutes. The key is a **shared contract** with Work (see `docs/07-events.md`, Redis keys).

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
| `external/redis` | Key-value port and `CacheService` (copy of Platform's; adds `projecty.redis.definitions-ttl`) | `KeyValueStore` |

```
project ──▶ access.api, outbox.api, customfield.api   (field and layout ports)
task ──▶ access.api, outbox.api, customfield.api, project.api   (project never calls task)
customfield ──▶ access.api, outbox.api            (never imports project or task: it calls the CustomValueHolder and StatusUsageHolder they implement)
outbox  ──▶ external/broker
Platform ──projecty.member events──▶ access
```

**Redis in Work.**
- **Membership cache.** `access/internal/helper/MemberAccessCache` (`work:access:{portalId}:{userId}`) serves `isActiveMember` and `permissions`. `MemberAccessServiceImpl.apply` evicts the entry after the transaction commits, for every member event it applies, so a deactivation takes effect as soon as the event is consumed (about 2 s after the change, including Platform's outbox relay).
- **Definition cache.** `customfield/internal/helper/DefinitionCache` caches `findFields`, `getLayout` and `findStatuses` as JSON under `work:defs:{portalId}:{version}:{what}`. Every field or layout change bumps `work:defs:{portalId}:ver` after commit (inside the existing `publish` of `CustomFieldServiceImpl`, `LayoutServiceImpl` and `LayoutStatusServiceImpl`), so old entries are never read again and expire after `definitions-ttl`. Only a read-only transaction uses the cache: a transaction that changes data must see its own writes. `findActiveLayouts` and `getDefaultLayoutId` are not cached because they can create the default layout. Project visibility is not cached either, because it depends on the user, the project's members and the trash.
- **Cached reads (phase 2).** Service-layer helpers `project/.../ProjectResponseCache` and `task/.../TaskResponseCache` wrap `findVisibleProject`, project detail, project list, task detail and the per-project task list. The same `findMemberAccess` the services call for their `caller()` now reads the cached member-access entry too (profile key included).
  - **Keys carry who is asking.** A response differs per user (`canEdit`, visibility, a Client sees only EXTERNAL lists), so every key has the user and a fingerprint of their access (`modules/shared/helper/CacheKeyHelper`: admin/client plus a hash of the sorted permissions). A profile or permission change gives a new key by itself.
  - **Keys carry the versions of what they are built from:** the portal's definitions version, and for project data one of three versions owned by `project/api/ProjectCacheService`: the **project** version (the project row, members, visibility), the **task** version of a project (tasks, comments, task lists; also moved by every project change, because task views embed the project's key, name and visibility) and the **list** version of the portal's projects. `ProjectServiceImpl.publish` (every project write) calls `projectChanged`; `TaskHistory.publish`/`publishList` (every task, comment and task-list write) call `tasksChanged`. The lazily created "General" list publishes no event, so `TaskHistory.listsChanged` is called there. Versions move after commit; they are read before the database.
  - **Task detail** only knows the task id, so a `work:taskproj:{portal}:{task}` entry remembers which project it belongs to (tasks never change project; if a move is added, evict it there).
  - **Not cached:** `/tasks` across projects (N+1 and an offset cursor), the task-lists endpoint (not read-only: it can create the default list), comments list, project trash.
- **Token denylist.** `common/security/helper/DenylistValidator` (in `JwtConfig`) refuses a token whose `sid` is at `denylist:sid:{sessionId}`, which Platform writes when a session ends.

**Accepted limits of the Redis caches (both services).**
- A cached read is stale for at most its TTL (`response-ttl` 60 s, definitions 10 min) in two cases: a write made while Redis was down (its version bump or eviction could not happen, and entries written before the outage come back with Redis), and display data that no write moves, such as `lastLoginAt` in the member list.
- Only a read-only transaction uses the cache, so a transaction that changes data always reads fresh values; the cost is that write paths (create or edit a task) do not benefit.
- JSON round trip: responses are cached as JSON and parsed back into the DTO records; `Object` and `Map<String,Object>` values come back as plain JSON types, which the live checks showed to be byte-identical to a fresh response.

`common/` is copied from Platform (response envelope, errors, `X-Portal-Id` filter, `@RequirePermission`); `JwtConfig` differs: it checks Platform's tokens through `projecty.token.jwk-set-uri`, `issuer` and `audience`. The copied outbox, broker and `common/` code is duplicated on purpose for now; a shared library is a later cleanup.
