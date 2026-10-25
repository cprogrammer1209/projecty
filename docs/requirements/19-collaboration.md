# 19 — Collaboration Extras
Code: `COL` · Phase: 4 · Service: Work · Status: **Outline**

## 1. Purpose
Communication beyond item comments: project activity streams, status updates, discussions, and shared documentation.

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Project feed: a chronological activity stream of the project (task, issue, document, and phase changes), filterable by type and user. Status posts: members post updates to the feed, and others comment and react. |
| V1 | Portal feed (across my projects). Forums: project discussion topics with categories, replies, mentions, attachments, followers, pinning, and marking the best answer. Pages/wiki: rich-text pages with a hierarchy, version history, and links to tasks. Followers/watchers consistent across all work items (tasks, issues, custom records, forum topics, pages). |
| LATER | Real-time chat (project channels and direct messages). Page templates. Page comments. |

## 3. Key business rules
- **COL-BR-01** The feed shows only events about items the viewer can see (same visibility rules as search and views).
- **COL-BR-02** Forum topics and pages carry the Internal/External flag. Client users see only External ones.
- **COL-BR-03** Page edits keep full version history. Restoring an old version creates a new version.
- **COL-BR-04** Concurrent page editing: last save wins, with a warning if the page changed since it was opened (no real-time co-editing).

## 4. Business events
`StatusPosted`, `ForumTopicCreated`, `ForumReplyAdded`, `PageCreated`, `PageUpdated`, `PageVersionRestored`.

## 5. Dependencies
Every work module (feed sources), Notifications (09), Documents (10).

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
