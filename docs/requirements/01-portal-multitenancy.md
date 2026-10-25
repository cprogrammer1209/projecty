# 01 — Portal & Multi-tenancy
Code: `PTL` · Phase: 0 · Service: Platform · Status: **Draft**

## 1. Purpose
The portal is the tenant boundary. Every piece of data belongs to exactly one portal, and portal-level settings (time zone, currency, business hours, and so on) drive behavior across all modules.

## 2. Actors
Portal Owner, Portal Admin, any portal user (to switch portals), System (the Super Admin of the SaaS operator).

## 3. Scope
**In:** portal creation, settings, branding, multiple portals per identity, portal switching, business hours, holiday calendars, entitlement checks, portal deletion.
**Out:** real multi-region data residency (the setting is stored, but there is one region), payment and plans (Step 24).

## 4. Key entities
| Entity | Business attributes |
|---|---|
| **Portal** | Name, unique URL slug (`acme` → `acme.projecty.app` or `/p/acme`), owner, logo, theme color, time zone, currency, date format, time format (12/24h), week start day, language, region, plan, status (Active / Suspended / Pending deletion), created date |
| **Business hours** | Working days (Mon–Sun toggles), daily start/end time, hours per day (derived) |
| **Holiday calendar** | Name, list of holidays (date, name, recurring yearly yes/no). A portal can have several calendars; one is the default. |
| **Entitlement** | Feature key → enabled or limit (e.g., `custom_fields.max = 50`, `module.timesheets = true`) |

## 5. User stories
| ID | Tier | Story |
|---|---|---|
| PTL-US-01 | MVP | As a new user signing up, I create my first portal by giving it a name and slug, so I can start working. |
| PTL-US-02 | MVP | As a Portal Admin, I set the portal's time zone, date format, currency, and week start, so dates and money display correctly for everyone. |
| PTL-US-03 | MVP | As a user who belongs to several portals, I switch between them from the top bar, without logging in again. |
| PTL-US-04 | MVP | As a user, I see only the data of the portal I'm currently in. |
| PTL-US-05 | V1 | As a user, I create an additional portal (e.g., for a side business), and I become its owner. |
| PTL-US-06 | V1 | As a Portal Admin, I upload a logo and choose a theme color, so the portal looks like my company. |
| PTL-US-07 | V1 | As a Portal Admin, I define business hours (working days, start and end times), so scheduling and SLAs respect them. |
| PTL-US-08 | V1 | As a Portal Admin, I maintain holiday calendars, so non-working days are excluded from durations. |
| PTL-US-09 | V1 | As a Portal Owner, I transfer ownership to another admin. |
| PTL-US-10 | V1 | As a Portal Owner, I request deletion of the portal. After a grace period, all its data is permanently removed. |
| PTL-US-11 | V1 | As the system, I check entitlements before allowing a gated feature or exceeding a quota. |
| PTL-US-12 | MVP | As a user, I set my personal time zone, which overrides the portal default for display. |
| PTL-US-13 | LATER | As a Portal Admin, I configure a custom domain (`projects.acme.com`). |
| PTL-US-14 | LATER | As a Portal Owner, I choose a data region at creation. |
| PTL-US-15 | LATER | As a Portal Admin, I set the default language for new users. |

## 6. Business rules
- **PTL-BR-01** Every record in every module belongs to exactly one portal. Cross-portal reads or writes are impossible through any channel.
- **PTL-BR-02** The portal slug is unique across the system, 3–30 characters (lowercase letters, digits, hyphens), and doesn't start or end with a hyphen. A reserved list (e.g., `www`, `api`, `admin`) is blocked.
- **PTL-BR-03** A portal always has exactly one Owner. The Owner can't be removed or deactivated until ownership is transferred.
- **PTL-BR-04** Changing the portal currency doesn't convert existing amounts. A warning is shown, and the change is audited.
- **PTL-BR-05** Dates are stored in UTC and displayed in the user's time zone (if set) or else the portal's.
- **PTL-BR-06** Business hours default to Mon–Fri, 09:00–18:00, which is 8 working hours after a 1-hour break. Changing them doesn't retroactively change stored task dates; it only affects future calculations.
- **PTL-BR-07** Portal deletion has a 30-day grace period, during which the Owner can cancel. During the grace period the portal is read-only.
- **PTL-BR-08** A suspended portal (e.g., by the operator or for non-payment) blocks all writes. Reads are allowed for the Owner only.
- **PTL-BR-09** Until billing exists (Step 24), all portals get the "Free/Default" entitlement set, which is configurable by the operator.
- **PTL-BR-10** A user can belong to at most 20 portals (an anti-abuse limit, configurable).

## 7. Acceptance criteria
- **PTL-US-01**
  - Given a verified identity with no portals, when they submit a name and an available slug, then a portal is created, they become its Owner with the Admin profile, and they land on an empty portal home.
  - Given a slug that is already taken, when they submit it, then they see "slug unavailable" with suggestions.
- **PTL-US-03**
  - Given a user in portals A and B currently in A, when they switch to B, then all navigation, data, and settings reflect B, and no data from A is visible or cached in the view.
- **PTL-US-04**
  - Given a user of portal A who knows the ID of a record in portal B, when they request it by URL or API, then they get "not found" (not "forbidden", so its existence isn't revealed).

## 8. Permissions
| Action | Who |
|---|---|
| Edit portal settings, branding, business hours, holidays | Portal Admin profile |
| Transfer ownership, delete portal | Owner only |
| Create a new portal | Any verified identity (subject to PTL-BR-10) |

## 9. Business events
`PortalCreated`, `PortalSettingsChanged`, `PortalOwnershipTransferred`, `PortalSuspended`, `PortalDeletionRequested`, `PortalDeletionCancelled`, `PortalDeleted`, `BusinessHoursChanged`, `HolidayCalendarChanged`.

## 10. Notifications
Ownership transferred (old and new owner), deletion requested (all admins), deletion completed (owner, by email).

## 11. Dependencies
Identity and login (Step 3) to create a portal. Every other module depends on this one.

## 12. Open questions
- URL strategy: subdomain per portal (`acme.projecty.app`) or path-based (`projecty.app/acme`)? Path-based is simpler locally.
- Do holiday calendars apply per portal only, or can a user have a personal calendar (e.g., country-specific)? Proposal: portal calendars in V1, user assignment to a calendar in Step 16.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial draft |
