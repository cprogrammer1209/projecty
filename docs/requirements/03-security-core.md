# 03 — Security Core (Auth, Audit, Events, Trash)
Code: `SEC` · Phase: 0 · Service: Platform (plus shared mechanisms used by every service) · Status: **Draft**

## 1. Purpose
Provides identity and authentication, an auditable record of changes, the business-event backbone every later module plugs into, and a shared trash/restore mechanism.

## 2. Actors
Any person (signing up or logging in), Portal Admin (audit, sessions), System.

## 3. Scope
**In:** sign-up, email verification, login, logout, password reset, sessions, 2FA (TOTP), the portal audit log, business event publication (as a guarantee), trash and restore, encryption policy.
**Out:** SSO/SAML, IP restrictions, GDPR tooling, data export (Step 24).

## 4. Key entities
| Entity | Business attributes |
|---|---|
| **Identity** | Email (unique globally), password (hashed), email verified flag, 2FA enabled flag, recovery codes, locked-until, last login |
| **Session** | Identity, device/browser, IP, created, last seen, expires |
| **Audit entry** | Portal, actor (user or system), action, target type and ID, target name, changes (field: old → new), IP, timestamp, correlation ID |
| **Trash item** | Portal, item type, item ID, name, deleted by, deleted at, purge date, parent context (e.g., project) |

## 5. User stories
| ID | Tier | Story |
|---|---|---|
| SEC-US-01 | MVP | As a visitor, I sign up with email and password and verify my email. |
| SEC-US-02 | MVP | As a user, I log in and stay logged in across browser restarts until I log out or the session expires. |
| SEC-US-03 | MVP | As a user, I reset a forgotten password through an emailed link. |
| SEC-US-04 | MVP | As a user, I log out from the current device. |
| SEC-US-05 | MVP | As the system, I record an audit entry for every create, update, and delete of admin- and security-relevant data. |
| SEC-US-06 | MVP | As the system, every business change publishes a business event reliably: never lost, and never published for a change that was rolled back. |
| SEC-US-07 | MVP | As a user, deleting a project, task, or document moves it to the trash. I or an Admin can restore it. |
| SEC-US-08 | V1 | As a user, I enable 2FA with an authenticator app and get recovery codes. |
| SEC-US-09 | V1 | As a user, I see my active sessions and revoke any of them. |
| SEC-US-10 | V1 | As an Admin, I browse and filter the portal audit log by user, action, module, and date. |
| SEC-US-11 | V1 | As an Admin, I enforce 2FA for all users in my portal. |
| SEC-US-12 | V1 | As an Admin, I permanently delete items from the trash, or empty it. |
| SEC-US-13 | V1 | As a user, I change my password, which signs out my other sessions. |
| SEC-US-14 | LATER | As an Admin, I export the audit log to CSV. |
| SEC-US-15 | LATER | As a user, I log in with Google or Microsoft (social login). |

## 6. Business rules
- **SEC-BR-01 Password policy:** at least 10 characters, and not in a breached-password list. No forced periodic rotation.
- **SEC-BR-02 Lockout:** 5 failed attempts within 15 minutes locks the identity for 15 minutes. The response doesn't reveal whether the email exists.
- **SEC-BR-03 Sessions:** idle timeout 7 days, absolute timeout 30 days. Changing or resetting the password revokes all other sessions.
- **SEC-BR-04** Password reset and verification links are single-use and expire in 1 hour (reset) or 24 hours (verify).
- **SEC-BR-05 Audit scope:** user and permission changes, portal settings, customization changes, deletes and restores, logins (success and failure), exports, and blueprint overrides. Routine task field edits go to the **activity stream** (Step 6), not the audit log.
- **SEC-BR-06** Audit entries are append-only. No one, including Admins, can edit or delete them. Retention is 1 year (configurable later).
- **SEC-BR-07 Event guarantee:** events are published **at least once**, in order per item. Consumers must tolerate duplicates.
- **SEC-BR-08 Trash:** deleting a parent trashes its children with it (deleting a project trashes all its content). Restoring the parent restores the children that were deleted *with* it, not children deleted earlier.
- **SEC-BR-09** Trash retention is 30 days, after which items are purged permanently.
- **SEC-BR-10** Trashed items are invisible in all views, search, reports, and notifications. Their IDs return "not found."
- **SEC-BR-11** Data is encrypted in transit (TLS everywhere) and at rest (database and object storage). Secrets (2FA seeds, integration tokens) are encrypted at field level.

## 7. Acceptance criteria
- **SEC-US-06**
  - Given a task update whose transaction fails, then no `TaskUpdated` event is ever published.
  - Given a committed update while the broker is down, when the broker recovers, then the event is published.
- **SEC-US-07**
  - Given a deleted task with 3 subtasks, when it's restored, then all 3 subtasks reappear with their comments and attachments.
  - Given its project was also trashed afterwards, when restoring the task alone, then restore is refused with "restore the project first."

## 8. Permissions
| Action | Who |
|---|---|
| View audit log | Admin |
| Restore an item | Its deleter, or anyone with Delete permission on that module at a scope covering the item |
| Permanently delete from trash | Admin |

## 9. Business events
`IdentityRegistered`, `EmailVerified`, `LoginSucceeded`, `LoginFailed`, `IdentityLocked`, `PasswordChanged`, `TwoFactorEnabled`, `SessionRevoked`, `ItemTrashed`, `ItemRestored`, `ItemPurged`.

## 10. Notifications
Verification email, password reset email, new login from a new device (email, V1), 2FA enabled or disabled, password changed.

## 11. Dependencies
None. This is the base layer. Portal (01) and Users (02) build on identity.

## 12. Open questions
- ~~Should we build our own auth, or use an identity server?~~ **Decided 2026-10-25: Keycloak.** Login, 2FA, password reset, email verification and SSO are configured in Keycloak. Platform keeps portals, users, profiles and permissions. See [Implementation Plan](../05-implementation-plan.md#decisions-taken).

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial draft |
| 2026-10-25 | Identity provider decided: Keycloak |
