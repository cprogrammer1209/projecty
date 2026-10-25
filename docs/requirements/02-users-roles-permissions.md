# 02 — Users, Roles & Permissions
Code: `USR` · Phase: 0 · Service: Platform · Status: **Draft**

## 1. Purpose
Controls who is in a portal and what each person can see and do. The permission model is evaluated on every request in every module, so it must be designed fully even though some parts (field-level, client visibility) are switched on later.

## 2. Actors
Portal Owner, Portal Admin, Project Manager, Team Member, Client User, the invitee.

## 3. Scope
**In:** invitations, user lifecycle, profiles (permission sets), roles (hierarchy), project-level roles, teams, client companies and client users, the permission evaluation rules.
**Out:** SSO and SCIM provisioning (Step 24), user custom fields (Step 7).

## 4. Key entities
| Entity | Business attributes |
|---|---|
| **Portal user** | Identity (email), display name, avatar, profile, role, status (Invited / Active / Deactivated), user type (Employee / Client), client company (if client), time zone, joined date, rate (later) |
| **Profile** | Name, description, system or custom, permission matrix (module × action × scope), field permissions (Step 7) |
| **Role** | Name, parent role (tree), "share data with peers" flag |
| **Project membership** | Project, user, project role (Manager / Member / Client / custom), added date |
| **Team** | Name, description, members, team lead |
| **Client company** | Name, website, address, associated projects |

### Permission matrix shape
For each **module** (Projects, Phases, Tasks, Issues, Documents, Timesheets, and so on) and each **action** (View, Create, Edit, Delete, plus module-specific actions like Approve or Export), the profile grants a **scope**:
- **None**: not allowed.
- **Own**: only items the user owns, is assigned to, or created.
- **Project**: all items in projects the user is a member of.
- **All**: all items in the portal (admin-level).

### Default profiles (system, not deletable)
| Profile | Summary |
|---|---|
| **Admin** | Everything, including portal settings, users, and customization. |
| **Manager** | Create projects. Full control within projects they manage. View all projects they are a member of. |
| **Employee** | Work on assigned items. Create tasks and issues in member projects. Edit own items. |
| **Client** | View external items in member projects. Create issues. Comment. No internal data. |

## 5. User stories
| ID | Tier | Story |
|---|---|---|
| USR-US-01 | MVP | As an Admin, I invite users by email with a profile, and optionally add them to projects. |
| USR-US-02 | MVP | As an invitee, I accept the invite. I create my identity if I don't have one, or I join with my existing login. |
| USR-US-03 | MVP | As an Admin, I see all portal users with their status, profile, and last active time, and I can search and filter. |
| USR-US-04 | MVP | As an Admin, I change a user's profile. |
| USR-US-05 | MVP | As an Admin, I deactivate a user. They lose access immediately, but their history stays attributed to them. |
| USR-US-06 | MVP | As a user, I am blocked from any action my profile doesn't allow, and the UI hides actions I can't perform. |
| USR-US-07 | MVP | As a Project Manager, I add or remove members of my project and set their project role. |
| USR-US-08 | V1 | As an Admin, I create custom profiles by cloning a system profile and adjusting the matrix. |
| USR-US-09 | V1 | As an Admin, I define a role hierarchy, so managers can see their reports' items. |
| USR-US-10 | V1 | As an Admin, I create teams. Work can be assigned to a team, and its members see it. |
| USR-US-11 | V1 | As an Admin, I create client companies and invite client users who see only external items in projects they belong to. |
| USR-US-12 | V1 | As an Admin, when deactivating or deleting a user, I reassign their open work (tasks, issues, project ownership) to another user. |
| USR-US-13 | V1 | As an Admin, I resend or revoke a pending invitation. |
| USR-US-14 | V1 | As an Admin, I reactivate a deactivated user. |
| USR-US-15 | V1 | As an Admin, I define custom project roles (e.g., "QA Lead") with their own project-scoped permissions. |
| USR-US-16 | LATER | As an Admin, I bulk-invite users from CSV. |
| USR-US-17 | LATER | As an Admin, I permanently delete a user, and their history is shown as "Deleted user". |

## 6. Business rules
- **USR-BR-01 (Permission evaluation order).** An action is allowed only if **all** of these pass:
  1. The user is Active in the current portal.
  2. The portal entitlement allows the module or feature.
  3. The module is enabled for the project (if project-scoped).
  4. The profile grants the action at a scope that covers the item (Own / Project / All).
  5. The project role allows it (if project-scoped). The **more restrictive** of profile and project role wins, except that Admins bypass project roles.
  6. Visibility: client users can only access items flagged External, and private projects only to members.
  7. Field-level permission (Step 7) applies to the individual fields read or written.
- **USR-BR-02** "Own" means the user is the creator, an owner/assignee, or (for projects) the project owner.
- **USR-BR-03** The role hierarchy grants **visibility** (read) of subordinates' owned items. It never grants edit rights by itself.
- **USR-BR-04** A deactivated user doesn't count against user limits, can't log in to that portal, and can't be newly assigned. Their existing assignments remain until reassigned.
- **USR-BR-05** Invitations expire after 7 days. Accepting an expired invite shows a "request a new invite" message.
- **USR-BR-06** The last Admin of a portal can't be demoted or deactivated.
- **USR-BR-07** System profiles can't be deleted. A custom profile can't be deleted while users hold it; they must be reassigned first.
- **USR-BR-08** A client user can never be given a non-Client profile while they belong to a client company, and an employee can't hold the Client profile.
- **USR-BR-09** Permission changes take effect within 1 minute for active sessions (a cached-token tolerance), and immediately for deactivation.
- **USR-BR-10** Team assignment: when a task is assigned to a team, every team member sees it as "assigned to my team." The team is the owner until a person claims it.
- **USR-BR-11** Email is unique per portal (one portal user per identity per portal).

## 7. Acceptance criteria
- **USR-US-05**
  - Given an active user with an open session, when the Admin deactivates them, then their next request is rejected and they're signed out of that portal (other portals are unaffected).
  - Their name still appears on past comments and changes, with a "deactivated" badge.
- **USR-US-06**
  - Given an Employee with Tasks: Edit = Own, when they try to edit a task they neither created nor are assigned to, then the server rejects it and the UI shows no edit control.
- **USR-US-11**
  - Given a client user in project P, when they list tasks, then only tasks flagged External (in External phases or task lists, where applicable) appear. Internal comments on external tasks are hidden.

## 8. Permissions
Only Admins manage users, profiles, roles, teams, and client companies. Project Managers manage membership of their own projects.

## 9. Business events
`UserInvited`, `InvitationAccepted`, `InvitationRevoked`, `UserProfileChanged`, `UserRoleChanged`, `UserDeactivated`, `UserReactivated`, `UserDeleted`, `WorkReassigned`, `ProfileCreated`, `ProfileChanged`, `ProfileDeleted`, `RoleHierarchyChanged`, `TeamCreated`, `TeamMembershipChanged`, `ClientCompanyCreated`, `ProjectMemberAdded`, `ProjectMemberRemoved`, `ProjectRoleChanged`.

## 10. Notifications
Invitation (email), added to project, profile changed (to the user), work reassigned (to the new owner).

## 11. Dependencies
Portal (01), Identity/auth (03). The reassign-work story (USR-US-12) needs Tasks and Issues (it becomes testable from Step 6 onward).

## 12. Open questions
- Should Role (hierarchy) be in V1 at all, or LATER? It adds complexity that's rarely essential for small teams. Proposal: keep in V1 but simple (visibility only).
- Custom project roles (USR-US-15): V1 or LATER?

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial draft |
