# 09 — Notifications
Code: `NTF` · Phase: 1 (extracted to the Notification service in Phase 2) · Service: Notification · Status: **Draft**

## 1. Purpose
Keeps people informed about what matters to them, through the right channel, at the right frequency, without spamming them.

## 2. Actors
All users (recipients), Admin (portal defaults), System (event sources, digests).

## 3. Scope
**In:** in-app notification center, email notifications, real-time push to the open browser, per-user preferences per event type and channel, daily and weekly digests, portal defaults.
**Out:** mobile push (no mobile apps), WhatsApp and SMS (LATER, through Automation), user-defined notification rules (Step 18).

## 4. Key entities
| Entity | Business attributes |
|---|---|
| **Notification** | Recipient, portal, event type, actor, target item (type, ID, title, project), summary text, created at, read at, archived, group key (to collapse similar notifications) |
| **Preference** | User, portal, event type, channel (in-app / email / digest-only / off) |
| **Portal default preferences** | Event type → default channel set |
| **Template** | Event type, channel, locale, subject and body with placeholders |
| **Delivery attempt** | Notification, channel, status (Pending / Sent / Failed / Bounced), attempts, last error |

### Event types (initial catalog)
| Category | Event types |
|---|---|
| Assignment | Task/issue assigned to me or my team, unassigned from me |
| Mentions | Mentioned in a comment or description |
| Activity on my items | Comment on an item I own or follow, status change, due date change |
| Time-based | Reminder, overdue, phase due soon |
| Membership | Added to a project, invited to a portal |
| Approvals (later steps) | Timesheet submitted or approved, blueprint approval needed |
| Security | New login, password changed (always email, can't be disabled) |

## 5. User stories
| ID | Tier | Story |
|---|---|---|
| NTF-US-01 | MVP | As a user, I see a bell icon with an unread count and a list of my notifications, newest first. |
| NTF-US-02 | MVP | As a user, I click a notification to open the related item, and it's marked read. |
| NTF-US-03 | MVP | As a user, I mark one or all notifications as read. |
| NTF-US-04 | MVP | As a user, I receive an email for assignments and mentions. |
| NTF-US-05 | V1 | As a user, I configure per event type whether I get in-app, email, digest, or nothing. |
| NTF-US-06 | V1 | As a user, new notifications appear instantly without refreshing (real-time). |
| NTF-US-07 | V1 | As a user, I receive a daily digest email (at a time I choose, in my time zone) with my overdue items, items due today, and unread activity. |
| NTF-US-08 | V1 | As a user, I get a weekly summary of my projects' progress. |
| NTF-US-09 | V1 | As an Admin, I set portal-wide default preferences for new users. |
| NTF-US-10 | V1 | As a user, I mute notifications for a specific project. |
| NTF-US-11 | V1 | As a user, I reply to a comment-notification email, and my reply is added as a comment. |
| NTF-US-12 | V1 | As a user, I filter the notification center by unread, mentions, or assigned to me. |
| NTF-US-13 | LATER | As a user, I snooze a notification until later. |
| NTF-US-14 | LATER | As a user, I set "do not disturb" hours. |

## 6. Business rules
- **NTF-BR-01** Never notify the actor about their own action.
- **NTF-BR-02** Before sending, re-check that the recipient can still see the item (they may have lost access between the event and delivery). The content must respect field permissions and the Internal/External flag.
- **NTF-BR-03 Collapse bursts:** multiple changes to the same item by the same actor within 2 minutes become one notification ("Asha made 4 changes to WEB-T42").
- **NTF-BR-04** Email is never sent for an event the user has already seen in-app. Emails for activity events wait 2 minutes, and are skipped if the notification was read in the meantime. Assignments and mentions are sent immediately.
- **NTF-BR-05** A slow or failing email provider must never slow down or fail the action that triggered it. Delivery is asynchronous, with retries (3 attempts, with backoff).
- **NTF-BR-06** Security notifications can't be turned off.
- **NTF-BR-07** Deactivated users receive nothing. Archived projects generate no notifications (PRJ-BR-04).
- **NTF-BR-08** Notifications are retained for 90 days, then deleted.
- **NTF-BR-09** Every email has an unsubscribe link for that event type (which updates preferences) and a link to the preferences page.
- **NTF-BR-10** Delivery decisions belong to Notification. Source modules only emit business events, and Notification decides recipients (owners, followers, mentioned users) and channels.

## 7. Acceptance criteria
- **NTF-US-04**
  - Given Asha assigns WEB-T42 to Ravi, then Ravi gets an in-app notification instantly and an email within 1 minute. Asha gets nothing.
- **NTF-BR-02**
  - Given Ravi is removed from the project after the event but before the email goes out, then no email is sent.
- **NTF-BR-03**
  - Given Asha changes 4 fields of a task Ravi follows within 1 minute, then Ravi sees one notification listing the 4 changes.

## 8. Permissions
Users manage only their own preferences and notifications. Admins set portal defaults.

## 9. Business events (consumed)
Consumes events from all modules: `TaskAssigned`, `UserMentioned`, `CommentAdded`, `TaskStatusChanged`, `TaskReminderDue`, `TaskOverdue`, `ProjectMemberAdded`, `UserInvited`, and so on. Emits `NotificationDelivered` and `NotificationFailed` (for diagnostics).

## 10. Notifications
Not applicable (this module *is* notifications).

## 11. Dependencies
The event pipeline (03), Users (02), Tasks (06). Starts as a module inside Work. It's extracted as its own service in Phase 2, so its interface must be "consume events, produce deliveries" from day one.

## 12. Open questions
- Reply-by-email (NTF-US-11) needs inbound email handling. Keep it V1, or move it to LATER along with the project email-in feature (PRJ-US-19)? Proposal: LATER, together.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial draft |
