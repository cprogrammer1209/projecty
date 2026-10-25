# 05 — Implementation Plan: M0 Foundation

Goal: ship **M0** from the [roadmap](03-roadmap.md#release-milestones): sign up, create a portal, invite users, log in, assign profiles, with audit and events flowing.

Work is cut into **vertical slices**. Each slice ends with something you can run and click through, not just a layer of code.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Identity provider | **Keycloak 26.x** (Docker), one realm `projecty` | 2FA, password reset, email verification and SSO come by configuration, not code |
| Tenants in Keycloak | **Organizations** feature (one organization per portal) | Realm-per-tenant doesn't scale past a few hundred tenants |
| Active portal | Token lists the user's organizations; Angular sends `X-Portal-Id`; services check it against the token | Lets users switch portals without logging in again (PTL-US-03) |
| Permissions | Stored in Platform, **not** in Keycloak | Keycloak answers *who*, ProjectY answers *what they can do* |
| Database | PostgreSQL 17, one database per service | Architecture boundary rule 1 |
| Events | Transactional **outbox table** now, broker later | Broker choice is open; the outbox makes events reliable from day one (SEC-US-06) |
| Frontend auth | `angular-oauth2-oidc`, Authorization Code + PKCE | Standard OIDC, works with any IdP. BFF pattern deferred to Phase 6 |
| Local email | **Mailpit** container | Catches verification, invite, and reset emails locally |

### Local ports

| Component | Port |
|---|---|
| Angular dev server | 4200 |
| Keycloak | 8080 |
| Platform service | 8081 |
| Work service (Phase 1) | 8082 |
| Mailpit UI / SMTP | 8025 / 1025 |
| PostgreSQL | 5432 |

## Slices

### Slice 0: Dev environment
- Root `compose.yaml`: Postgres (databases `keycloak`, `platform`), Keycloak, Mailpit
- `git init` at the repo root, `.gitignore`, one-command startup documented in the README
- **Done when:** `docker compose up` starts everything, and the Keycloak admin console opens at :8080

### Slice 1: Keycloak realm as code
- Realm `projecty` with Organizations enabled, email via Mailpit, verify email and reset password turned on
- Client `projecty-web`: public, PKCE, redirect to `http://localhost:4200/*`
- Client `platform-admin`: confidential, service account allowed to manage users and organizations
- Mappers: audience `projecty-api`, organization claim
- Exported to `infra/keycloak/projecty-realm.json` and imported on startup
- **Done when:** a token is fetched with `curl`, decoded, and shows `iss`, `aud`, and `organization`

### Slice 2: Platform checks tokens
- `application.yml`: issuer URI, datasource, port 8081
- `SecurityConfig`: everything authenticated except health and signup
- `GET /api/me` returns the caller's claims
- Tests: valid token → 200; missing, expired, or wrong-issuer token → 401
- **Done when:** `curl` with the Slice 1 token gets 200, and a tampered token gets 401

### Slice 3: Angular login shell (SEC-US-02, SEC-US-04)
- OIDC config, login redirect, logout, silent refresh
- HTTP interceptor attaches the token; auth guard protects routes
- Dev proxy `/api` → 8081
- App shell: top bar (user menu, portal switcher placeholder), side nav, home page showing `/api/me`
- **Done when:** a user created by hand in Keycloak can log in, see their name, and log out

### Slice 4: Signup and portal (PTL-US-01, SEC-US-01, SEC-US-03)
- Flyway `V1`: `portal`, `app_user`, `portal_member`
- Public `POST /api/signup`: creates the Keycloak user and organization plus the Platform rows, with a compensating rollback if either side fails
- Angular signup page; verification email shows up in Mailpit
- Password reset: Keycloak's built-in flow, linked from the login page
- **Done when:** a new visitor signs up, verifies email, logs in, and lands in their own portal

### Slice 5: Tenant isolation and portal settings (PTL-US-02, -03, -04, -12)
- `TenantContext` filter: reads `X-Portal-Id`, checks it against the token's organizations, else 403
- Every repository query is scoped by `portal_id`
- Portal settings (time zone, date format, currency, week start); personal time zone
- Working portal switcher in the top bar
- **Done when:** a user in two portals switches between them, and a crafted request for a foreign portal gets 403

### Slice 6: Users and profiles (USR-US-01 to -06)
- Default profiles seeded per portal: Portal Owner, Admin, Manager, Employee, Client
- Permission check (`@RequirePermission`) on the API, plus a permission map in `/api/me` for the UI to hide actions
- Invite by email (existing Keycloak user is reused), accept invite, list/search users, change profile
- Deactivate: disable the `portal_member`, revoke Keycloak sessions, and reject requests at once via a status check
- **Done when:** an Admin invites a user, the invitee joins, and an Employee is blocked from admin pages and APIs

### Slice 7: Audit and events (SEC-US-05, SEC-US-06)
- `audit_log` table, written for every admin and security change
- `outbox` table written in the same transaction; a relay publishes the events (logged for now, sent to the broker later)
- Events: `PortalCreated`, `UserInvited`, `UserActivated`, `UserProfileChanged`, `UserDeactivated`
- Audit log page for Admins
- **Done when:** every action in Slices 4–6 leaves an audit row and an outbox event, and a rolled-back change leaves neither

## Deferred out of M0

| Story | Moved to | Reason |
|---|---|---|
| SEC-US-07 Trash and restore | Step 4 (Projects) | It applies to projects, tasks and documents, which live in Work. M0 only sets the soft-delete convention. |
| USR-US-07 Project members | Step 4 (Projects) | Needs projects to exist |
| Message broker | Phase 1, when Work starts consuming events | Nothing consumes events yet |
| 2FA enforcement policy | V1 | Keycloak supports OTP already; the per-portal policy is V1 |

## After M0

Phase 1 starts with `work-service`: a new Spring Boot app on 8082, configured as a resource server with the same issuer URI.
