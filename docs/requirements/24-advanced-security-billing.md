# 24 — Advanced Security, Compliance & Billing
Code: `ADM` · Phase: 6 · Service: Platform · Status: **Outline**

## 1. Purpose
Make ProjectY acceptable to larger organizations (SSO, compliance, data control) and commercially viable (plans, gating, billing).

## 2. Security & compliance scope
| Tier | Features |
|---|---|
| V1 | SSO with SAML 2.0 and OIDC per portal, with optional enforcement (password login disabled except for the owner as a break-glass account). IP allowlist per portal. Full portal data export (JSON and CSV, including files, as an async job with a download link). Admin view of all active sessions, with force-logout. |
| V1 | GDPR: data subject export (everything about a person) and erasure (anonymize the person in history, delete their personal data). |
| LATER | Data retention policies (auto-delete closed items after N years). SCIM user provisioning. Customer-managed encryption keys. Scheduled backups to customer storage. |

## 3. Subscription & billing scope
| Tier | Features |
|---|---|
| V1 | Plans (Free / Premium / Enterprise) defined as entitlement sets: modules, feature flags, user limit, storage limit, custom field and layout limits, automation limits. Gating uses the entitlement check from Step 1. Trial (14 days of Premium for new portals). Upgrade and downgrade. Per-user pricing (monthly or yearly). Payment gateway in test mode (e.g., Stripe test). Invoices and billing history. |
| LATER | Add-ons (extra storage, AI credits). Coupons. Dunning (failed payment retry, then suspend, PTL-BR-08). Tax handling. |

## 4. Key business rules
- **ADM-BR-01** A downgrade never deletes data. Features over the new limits become read-only (e.g., existing custom fields beyond the limit are visible but no new ones can be added). Admins see a list of what's over the limit.
- **ADM-BR-02** When the user limit is reached, invitations are blocked. Existing users are never deactivated automatically.
- **ADM-BR-03** When the trial ends without payment, the portal moves to Free (not suspended).
- **ADM-BR-04** An SSO configuration change requires the admin to complete a test login before enforcement can be switched on, which prevents lockouts.
- **ADM-BR-05** GDPR erasure preserves business records (tasks stay) but replaces the person's identity with "Deleted user #N" everywhere. It is irreversible and audited.

## 5. Business events
`PlanChanged`, `TrialStarted`, `TrialEnded`, `PaymentSucceeded`, `PaymentFailed`, `EntitlementsChanged`, `SsoConfigured`, `IpRestrictionChanged`, `PortalExportRequested`, `PortalExportReady`, `PersonalDataErased`.

## 6. Dependencies
Portal (01), Users (02), Security core (03). Gating touches every module, via the entitlement check designed in Step 1.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
