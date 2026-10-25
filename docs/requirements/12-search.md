# 12 — Search
Code: `SRC` · Phase: 2 · Service: Work (search index) · Status: **Outline**

## 1. Purpose
Find anything quickly (tasks, issues, projects, documents, comments, forum posts, custom records), and never show anything the searcher isn't allowed to see.

## 2. Scope by tier
| Tier | Features |
|---|---|
| MVP | Global search box with results grouped by type (projects, tasks, issues, documents, comments). Search by item ID (`WEB-T42`) jumps directly to the item. Search within the current project. Permission-aware results. |
| V1 | Quick results while typing (top 5 per type). Filters on results (type, project, owner, status, date). Saved searches. Search inside custom field values. Search document file names and descriptions. Recent searches and recently viewed items. |
| LATER | Full-text search inside document contents (PDF, Office). Search operators (`owner:me status:open`). Semantic search (Step 23). |

## 3. Key business rules
- **SRC-BR-01** Results respect *every* visibility rule: portal, project membership, private projects, Internal/External flag, field permissions (a hidden field's value must not match a search), and trash.
- **SRC-BR-02** The index updates within 5 seconds of a change. Permission changes (removed from a project) take effect in search within the same window.
- **SRC-BR-03** Results are ranked by: exact ID match, then title match, then recency, then other fields.
- **SRC-BR-04** Search must tolerate typos and prefixes ("deploym" finds "deployment").

## 4. Business events
Consumes all create, update, delete, and permission events. Emits nothing of business significance.

## 5. Dependencies
Every searchable module, the event pipeline (03), and permissions (02, 07).

## 6. Open questions
- Should archived projects' content appear in search? Proposal: yes, with an "archived" badge and a filter to exclude it.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline |
