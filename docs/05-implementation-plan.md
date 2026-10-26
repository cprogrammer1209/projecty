# 05 — Implementation Plan: M0 Foundation

Goal: ship **M0** from the [roadmap](03-roadmap.md#release-milestones): sign up, create a portal, invite users, log in, assign profiles, with audit and events flowing.

Work is cut into **vertical slices**. Each slice ends with something you can run and click through, not just a layer of code.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Identity | **Own auth in Platform** (2026-10-25). Replaces the earlier Keycloak choice made the same day. | Fully native login and signup screens, and email links that stay in the app. One user store. |
| Access tokens | RS256 JWT, 15 min, signed by Platform. Public keys at `/.well-known/jwks.json` | Other services check tokens locally (architecture boundary rule 2) |
| Refresh tokens | Opaque, rotated on every use, in an HttpOnly + SameSite=Strict cookie. Only the hash is stored. | JavaScript can't read them; reuse of a stolen token is detected |
| Active portal | Token lists the user's portal ids (`portals` claim); Angular sends `X-Portal-Id`; services check it against the token | Switch portals without logging in again (PTL-US-03) |
| Permissions | Stored in Platform, not in the token | Tokens stay small; permission changes take effect without re-login |
| Database | PostgreSQL 17, one database per service | Architecture boundary rule 1 |
| Events | Transactional **outbox table**, relayed to **Apache Kafka** (KRaft, 2026-10-26). Contract in [07 — Events](07-events.md) | The outbox makes events reliable (SEC-US-06); Kafka keeps history, so services added later can replay it |
| Local email | **Mailpit** container | Catches verification and reset emails locally |
| API docs | springdoc, Swagger UI at `/swagger-ui.html` | The frontend is built against a documented contract |
| Code structure | Modular monolith per service: [06 — Backend Architecture](06-backend-architecture.md) | One structure for every service; modules can be extracted later |
| Response shape | `AppResponse` envelope: `{success, data}` or `{success: false, error: {code, message, details}}` | One shape for the frontend to handle; errors keyed by `error.code` |

### Local ports

| Component | Port |
|---|---|
| Angular dev server | 4200 |
| Platform service | 8081 |
| Work service (Phase 1) | 8082 |
| Mailpit UI / SMTP | 8025 / 1025 |
| Kafka | 9092 |
| Redpanda Console (Kafka UI) | 8088 |
| PostgreSQL | 5432 |

## Slices

### Slice 0: Dev environment ✅ Done 2026-10-25
- Root `compose.yaml`: Postgres (`platform` database) and Mailpit
- Root repo for docs and infra; `frontend/` and `platform-service/` are separate repos
- **Done when:** `docker compose up -d` starts everything, and Platform's health check returns `UP`

### Slice 1: Backend auth and first portal ✅ Done 2026-10-25 (SEC-US-01 to -04, PTL-US-01)
- Flyway `V1`: `app_user`, `auth_session`, `refresh_token`, `email_token`, `signing_key`, `portal`, `portal_member`
- Signup → verify email → login → refresh → logout; forgot and reset password (revokes all sessions)
- Password policy (10+ characters, common-password list), lockout (5 failures in 15 min → 15 min lock)
- `GET /api/me`; `POST /api/portals` and slug availability with suggestions
- 30 tests: full flows against Testcontainers Postgres, plus JWT tamper, expiry, issuer and audience checks
- Restructured to the [backend architecture](06-backend-architecture.md): modules `account`, `session`, `token`, `portal`, plus `external/mail`
- **API contract:** Swagger UI at http://localhost:8081/swagger-ui.html. All responses use the `AppResponse` envelope, except `/.well-known/jwks.json`.

### Slice 2: Angular auth screens ✅ Done 2026-10-25
- Built from `frontend/prototypes/projecty-auth.html`, adapted to the backend flow: the portal is step 2, after verifying and signing in. Password rule is the backend's (10+ characters). SSO, "keep me signed in" and team size are left out until the backend supports them
- Code: `core/` (auth service, interceptor, guards, API clients, theme), `shared/ui/` (icon, field, password input), `features/auth/` (layout, showcases, screens), `features/home/` (placeholder portal home at `/p/:slug`)
- Tokens: `src/styles/projecty-tokens.css` is the single source (light, dark, follows the OS)
- 14 unit tests (single-flight refresh, interceptor retry, guards); full journey checked in a browser against the running backend and Mailpit
- Signup, verify-email, login, forgot-password and reset-password pages; create-portal page when `/api/me` returns no portals
- Read `response.data` on success and `error.code` on failure (every response is an `AppResponse`)
- Access token in memory; an interceptor attaches it and calls `/api/auth/refresh` once on 401 (one refresh at a time, since rotation revokes the session on reuse)
- On app start, call `/api/auth/refresh` to restore the session from the cookie
- Dev proxy `/api` → `http://localhost:8081`, so the refresh cookie is same-origin
- **Done when:** a new visitor signs up, verifies email, logs in, creates a portal, and lands in it

### Slice 2b: Admin console and support impersonation ✅ Done 2026-10-26
- New Angular app `admin-console/` (port 4300, own git repo), built from `projecty-tenant-admin.html`: admin sign-in, tenants list, tenant detail (details, users, permissions placeholder, activity), platform audit logs, "Start impersonation" dialog. Left out until the backend supports them: add/edit/suspend tenant, add/deactivate user, plan, domain, CSV export
- Platform service: modules `admin` (separate admin accounts and sessions, cookie `py_admin_refresh`, first admin from `projecty.admin.bootstrap`), `impersonation`, `audit`; Flyway `V2`
- Impersonation: admin picks user, duration (15 min–24 h), reason and comment, and confirms → audit `IMPERSONATION_REQUESTED` → one-time launch link (2 min) opens the customer app in a new tab → `/api/auth/impersonation/redeem` opens a session as the user whose token carries `act` (the admin) → banner "Support session · ends HH:MM · End session" → audit `STARTED` / `ENDED`. The session cannot outlive the chosen duration
- Tests: 5 backend integration tests (role separation, lockout, tenant views, request validation, full support-session flow); admin console specs; browser run across both apps

### Slice 3: Tenant isolation and portal settings ✅ Done 2026-10-26 (PTL-US-02, -03, -04, -12)
- **Isolation:**
  - the customer app sends `X-Portal-Id`, taken from the URL `/p/{slug}`
  - `common/security/filter/PortalContextFilter` checks it against the token's `portals` claim: not listed → 403 `PORTAL_ACCESS_DENIED`, malformed → 400
  - endpoints read the verified id from `common/service/RequestPortalContext`; `requirePortalId()` returns 400 `PORTAL_REQUIRED` when it's missing
- **Portal settings:**
  - `GET /api/portal` and `PATCH /api/portal/settings` (time zone, date format, currency, week start); owner-only until Slice 4
  - every change is audited as `PORTAL_SETTINGS_CHANGED`, with the before → after values (PTL-BR-04)
  - a new portal defaults to the creator's browser time zone
- **Personal time zone:** `PATCH /api/me/preferences`; `/api/me` returns `timeZone`. Dates show in the user's zone, else the portal's (PTL-BR-05, the `pyDate` pipe).
- **Customer app shell** from `projecty-home.html`:
  - sidebar with the portal switcher, top bar, Home with empty states (tasks and projects arrive in M1)
  - Settings → Portal / My preferences
  - an unknown slug shows "Portal not found"
- **Migration:** Flyway `V4`
- **Verification:** existing tests pass; checked by hand in the browser and with curl. No new automated tests were written for this slice, at your request.

### Slice 4: Users and profiles ✅ Done 2026-10-26 (USR-US-01 to -06)
- **New `member` module**, which owns `PortalMember`, `Profile`, `Invitation` and every user-management endpoint:
  - `portal` no longer touches membership
  - it publishes `PortalCreatedEvent`, and `member` seeds the profiles, adds the owner as Admin and enforces the 20-portal limit
- **Profiles:** four system profiles per portal (Admin, Manager, Employee, Client), stored as data (`profile`, `profile_permission`). The Owner is `portal.owner_user_id` and holds Admin. Custom profiles come in V1.
- **Permissions:** `PORTAL_SETTINGS_MANAGE`, `USERS_VIEW` and `USERS_MANAGE`, enforced by `@RequirePermission` (`common/security/handler/PermissionInterceptor`) through the `common/service/PortalAccessService` port that `member` implements. `GET /api/portal/me` gives the UI the caller's permissions.
- **Invitations:**
  - an email link, valid 7 days and single-use; re-inviting replaces a pending invite
  - a new person creates an already-verified account from the link
  - an existing user accepts while signed in, and the email must match
- **Deactivation:**
  - `PortalContextFilter` re-checks membership on every request, so access ends at once even with a valid token (USR-BR-09)
  - the owner can't be demoted or deactivated, and the last Admin rule is enforced too
- **Audit:** invitations, profile changes, deactivation and reactivation
- **Customer app:**
  - Settings → Users (list, search, filter, change profile, deactivate/reactivate, invite, pending invitations)
  - the `/invite` accept page, and actions hidden by permission
  - "You no longer have access" when removed mid-session
- **Migration:** Flyway `V5` (existing owners became Admins)
- **Verification:** existing tests pass (3 assertions updated for the new profile model); checked by hand with curl and in the browser. No new automated tests were written, at your request.

### Slice 5: Audit and events ✅ Done 2026-10-26 (SEC-US-05, SEC-US-06)
- **Audit:** `audit_event` already existed (V2). Added the missing actions: `USER_SIGNED_UP`, `LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `PASSWORD_RESET` (category `AUTH`, no portal) and `PORTAL_CREATED`. Login failures are only recorded for a known email, and are written in the existing no-rollback transaction, so they survive the 401. A database trigger rejects every UPDATE and DELETE on `audit_event` (SEC-BR-06).
- **Outbox:** new `outbox` module (`OutboxWriteService.publish`, `MANDATORY` transaction, so a rollback removes the event) and `outbox_event` table. `OutboxRelay` polls every second (`projecty.outbox.*`), locks the oldest unpublished rows with `FOR UPDATE SKIP LOCKED`, and marks each published after `external/broker` `BrokerPublisher` accepts it. Delivery is at least once and in id order. The only publisher logs the event; the broker comes in Phase 1.
- **Events:** `PortalCreated`, `UserInvited`, `UserActivated` (invitation accepted, reactivated), `UserProfileChanged`, `UserDeactivated`. Names live in `OutboxEventConstants`. Payloads hold ids only, no emails.
- **Audit log API:** `GET /api/audit-events?category=&action=&page=&size=` returns the current portal's events, newest first, as `PagedResponse` (`items`, `page`, `size`, `totalItems`, `totalPages`). Needs the new `AUDIT_VIEW` permission, which Admins have. The platform-wide `/api/admin/audit-events` is unchanged.
- **API change:** `PortalService.create` now takes the caller's name for the audit entry.
- **Migration:** Flyway `V6` (outbox table, `AUDIT_VIEW` for existing Admin profiles, append-only trigger).
- **Customer app:** the Settings → Audit log page is still to build in `frontend/`, against the contract above.
- **Verification:** existing 35 tests pass (one assertion updated: a portal's log now starts with `PORTAL_CREATED`); checked by hand with curl against a running backend: every action left its audit row and outbox event, the events were published, a rejected invite left neither, an Employee gets 403 and another portal's id gets `PORTAL_ACCESS_DENIED`. No new automated tests, at your request.

### Slice 5b: Kafka event backbone ✅ Done 2026-10-26
- **Kafka:** `compose.yaml` runs Apache Kafka 4.0 in KRaft mode (one node, no ZooKeeper), port 9092. `OutboxRelay` publishes through `KafkaBrokerPublisher` (acks=all, idempotent producer, short timeouts, waits for the broker's ack before marking a row published). Topics `projecty.portal`, `projecty.member`, `projecty.invitation` are created at startup from `projecty.broker.topics`. Tests use `projecty.broker.type=logging` (`src/test/resources/application.properties`).
- **Envelope and replay:** every message carries `eventId`, `type`, `version`, `occurredAt`, `portalId`, `aggregateType`, `aggregateId`, `actor` and `payload`. Flyway `V7` added the actor and version columns, moved relay ordering to `(created_at, id)`, re-sent the events the logging publisher had "published", and backfilled events for data created before the outbox existed (marked `"backfill": true`).
- **New events:** `PortalSettingsChanged`, `InvitationRevoked`. Published rows are purged after 7 days.
- **Contract:** [07 — Events](07-events.md).
- **Verification:** existing tests pass; all existing events arrived in Kafka (portal 22, member 16, invitation 11, every `eventId` unique); live flows produced one message per change; a rejected invite produced none; with Kafka stopped the API kept working and the events were delivered once after it restarted. The purge job was not exercised by hand. No new automated tests, at your request.

## Deferred out of M0

| Story | Moved to | Reason |
|---|---|---|
| SEC-US-07 Trash and restore | Step 4 (Projects) | It applies to projects, tasks and documents, which live in Work. M0 only sets the soft-delete convention. |
| USR-US-07 Project members | Step 4 (Projects) | Needs projects to exist |
| 2FA (SEC-US-08), session list (SEC-US-09), change password (SEC-US-13) | V1 | Not needed for M0 |

## After M0

Phase 1 starts with `work-service`: a new Spring Boot app on 8082, configured as a resource server with `jwk-set-uri: http://localhost:8081/.well-known/jwks.json` and the same issuer and audience checks.
