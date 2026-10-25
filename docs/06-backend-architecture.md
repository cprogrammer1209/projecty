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
| `portal` | `Portal`, `PortalMember`; create portal, slug rules | `PortalLookUpService` (incl. `findAllPortals`, `findMembers`, `isActiveMember`) |
| `admin` | `AdminUser`, `AdminSession`; admin console sign-in (`/api/admin/auth`), first-admin bootstrap; tenant views (Aggregate service over portal + account) | `AdminLookUpService` |
| `impersonation` | `Impersonation`; every support-session endpoint: `POST /api/admin/impersonations`, `POST /api/auth/impersonation/redeem`, `/end` | — (no other module needs it) |
| `audit` | `AuditEvent` (append-only); `/api/admin/audit-events` | `AuditWriteService.record` |
| `common/security/helper` | `RefreshCookieHelper` for the customer `py_refresh` cookie (used by session and impersonation) | — |
| `shared` | `OpaqueTokenHelper` (account, session, admin, impersonation); `AuditEventConstants` (values every auditing module uses) | — |
| `external/mail` | SMTP sending | `MailService` |

```
session       ──▶ account.api, portal.api, token.api
account       ──▶ portal.api, external/mail
admin         ──▶ account.api, portal.api, token.api, audit.api
impersonation ──▶ session.api, account.api, portal.api, admin.api, audit.api
account ──UserPasswordResetEvent────▶ session
session ──SupportSessionExpiredEvent──▶ impersonation
```

**Two kinds of access token, one signing key.** Customer tokens have audience `projecty-api` (role USER); admin console tokens have audience `projecty-admin` (role PLATFORM_ADMIN). `SecurityConfig` gives `/api/admin/**` to PLATFORM_ADMIN and the rest of `/api/**` to USER, so neither token works on the other side. A support session is a normal customer token for the target user plus `act` (the admin) and `imp` (session id and end time).
