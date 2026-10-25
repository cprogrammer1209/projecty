# 14 — Calendar & Events
Code: `CAL` · Phase: 3 · Service: Work · Status: **Outline**

## 1. Purpose
A time-based view of work (tasks, phases, events, leave) and the ability to schedule meetings within a project.

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Project calendar (month / week / day) showing tasks by due date and phases as spans. Drag a task to change its due date. My calendar across projects. |
| V1 | Events/meetings: title, description, date and time, duration, location or link, participants, reminders, recurrence. Portal calendar (all my projects). Leave and holidays shown. Filter by type, owner, or project. Invite participants (in-app and email, with an `.ics` attachment). |
| LATER | Two-way sync with Google Calendar and Outlook. Video meeting link generation. |

## 3. Key business rules
- **CAL-BR-01** The calendar shows only items the viewer can see (same rules as views).
- **CAL-BR-02** Event times are stored in UTC and shown in each participant's time zone.
- **CAL-BR-03** Recurring event edits offer "this occurrence / this and following / all."
- **CAL-BR-04** Event participants must be project members. Client users can be invited to External events only.

## 4. Business events
`EventCreated`, `EventUpdated`, `EventCancelled`, `EventReminderDue`.

## 5. Dependencies
Tasks (06), Phases (05), Notifications (09). Leave data comes from Resource Management (16).

## 6. Open questions
- Where is leave entered (Calendar or Resource Management)? Proposal: Resource Management owns leave, and Calendar displays it.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
