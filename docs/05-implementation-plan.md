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
| Events | Transactional **outbox table** now, broker later | Broker choice is open; the outbox makes events reliable from day one (SEC-US-06) |
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

### Slice 3: Tenant isolation and portal settings (PTL-US-02, -03, -04, -12)
- `TenantContext` filter: reads `X-Portal-Id`, checks it against the token's organizations, else 403
- Every repository query is scoped by `portal_id`
- Portal settings (time zone, date format, currency, week start); personal time zone
- Working portal switcher in the top bar
- **Done when:** a user in two portals switches between them, and a crafted request for a foreign portal gets 403

### Slice 4: Users and profiles (USR-US-01 to -06)
- Default profiles seeded per portal: Portal Owner, Admin, Manager, Employee, Client
- Permission check (`@RequirePermission`) on the API, plus a permission map in `/api/me` for the UI to hide actions
- Invite by email (an existing identity is reused), accept invite, list/search users, change profile
- Deactivate: disable the `portal_member`, revoke sessions, and reject requests at once via a status check
- **Done when:** an Admin invites a user, the invitee joins, and an Employee is blocked from admin pages and APIs

### Slice 5: Audit and events (SEC-US-05, SEC-US-06)
- `audit_log` table, written for every admin and security change
- `outbox` table written in the same transaction; a relay publishes the events (logged for now, sent to the broker later)
- Events: `PortalCreated`, `UserInvited`, `UserActivated`, `UserProfileChanged`, `UserDeactivated`
- Audit log page for Admins
- **Done when:** every action in Slices 1–4 leaves an audit row and an outbox event, and a rolled-back change leaves neither

## Deferred out of M0

| Story | Moved to | Reason |
|---|---|---|
| SEC-US-07 Trash and restore | Step 4 (Projects) | It applies to projects, tasks and documents, which live in Work. M0 only sets the soft-delete convention. |
| USR-US-07 Project members | Step 4 (Projects) | Needs projects to exist |
| Message broker | Phase 1, when Work starts consuming events | Nothing consumes events yet |
| 2FA (SEC-US-08), session list (SEC-US-09), change password (SEC-US-13) | V1 | Not needed for M0 |

## After M0

Phase 1 starts with `work-service`: a new Spring Boot app on 8082, configured as a resource server with `jwk-set-uri: http://localhost:8081/.well-known/jwks.json` and the same issuer and audience checks.
