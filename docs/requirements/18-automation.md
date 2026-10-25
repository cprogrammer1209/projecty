# 18 — Automation (Workflow Rules, Blueprints, Checklists, SLA)
Code: `AUT` · Phase: 4 · Service: Work (blueprint validation) + Automation (rules, after-actions, timers) · Status: **Outline** (blueprint and checklist scope is already detailed)

## 1. Purpose
Let portals encode their process: automatic reactions to changes (workflow rules), enforced status flows (blueprints), quality gates (checklists), and time limits with escalation (SLA).

## 2. Workflow rules
| Tier | Features |
|---|---|
| MVP | Triggers: on create, on edit, on a specific field change. Criteria builder (AND/OR). Actions: field update, in-app/email notification, assign owner, add comment. Applies to Tasks and Issues. Enable or disable a rule. Execution log per rule. |
| V1 | Date-based triggers (e.g., 2 days before the due date). Actions: create task, webhook. Custom modules supported. Scheduled/recurring automations (e.g., every Monday, create a status-report task). Rule ordering. |
| LATER | Custom functions (sandboxed JavaScript or Python). WhatsApp/SMS actions. |

**Rules**
- **AUT-BR-01** Rules run asynchronously after the change commits. They never block or slow the user's save.
- **AUT-BR-02** A field update made by a rule goes through Work's normal API, so permissions (as the "Automation" system actor), layout rules, and blueprints still apply.
- **AUT-BR-03 Loop guard:** each change carries a correlation ID and depth. Rule chains stop at depth 5, and the stop is logged on the rule.
- **AUT-BR-04** Every rule execution is logged (trigger, matched?, actions run, result, errors) and kept for 30 days.

## 3. Blueprints (18A)
| Tier | Features |
|---|---|
| V1 | **Design:** a visual canvas. States come from the layout's status set. Named transitions with button labels. Multiple transitions per status. Common transitions (from any status). Start and end states. Publish-time validation (no orphan states, at least one path to a closed state). |
| V1 | **Entry criteria:** module + layout + record conditions. Multiple blueprints per layout with priority order. |
| V1 | **Before:** who can perform it (users, profiles, roles, record owner, a field-based user like "Reviewer"). Field conditions for the button to appear. |
| V1 | **During:** mandatory fields in a transition pop-up, required comment, required attachment, checklist (18B), pre-filled values. |
| V1 | **After:** field updates, notifications, webhooks, create a follow-up task, trigger a workflow rule. |
| V1 | **Enforcement:** the status dropdown is replaced by transition buttons. Enforced on every path (form, Kanban, bulk, import, API). Disallowed moves are rejected server-side. |
| V1 | **Lifecycle:** draft, publish, deactivate. Clone. **Visibility:** per-record transition history, current state, available transitions. |
| V1 | **Admin override** to force a status, with a mandatory reason. Audited. |
| LATER | Approval transitions (wait for an approver). Time limits per state with escalation (see SLA). Versioning with migration of in-flight records. Parallel transitions. Reports: time in state, bottlenecks. |

**Rules**
- **AUT-BR-10** Before and During checks run **synchronously in Work**, in the same transaction as the status change (TSK-BR-05). After-actions are published as events to Automation.
- **AUT-BR-11** When a blueprint is published, records already in a status not part of the blueprint stay where they are. Their only available transitions are the common transitions until they re-enter the flow.
- **AUT-BR-12** A status used by an active blueprint can't be deleted (CUS-BR-09).
- **AUT-BR-13** When several blueprints match a record, the highest-priority one applies, and it stays bound to the record until the record exits the flow.

## 4. Checklists before status completion (18B)
| Tier | Features |
|---|---|
| V1 | Admin-defined checklist templates. Attach to a transition or as exit criteria of a status. Items have text, mandatory or optional status, help text, and order. The transition is blocked until mandatory items are ticked. Partial progress is saved. Enforced on every path, with a clear error. Per-record history (who ticked what, when). Completion indicator ("4/6 done"). |
| V1 | In-task ad-hoc checklists (to-do items inside a task, not tied to status). |
| LATER | Conditional items (only when Priority = Critical). Per-item evidence (comment, attachment, or link). Item-level ownership (only QA can tick "Regression passed"). Reports on items that most often delay transitions. Admin override with reason. |

## 5. SLA & escalation
| Tier | Features |
|---|---|
| V1 | SLA policy per module and criteria (e.g., Critical issues must be resolved within 8 business hours). Measured in business hours (PTL-US-07). Escalation actions on breach and pre-breach (notify, reassign, change priority). SLA indicator on the record. |
| LATER | Multiple SLA targets (first response, resolution). Pause SLA in specific statuses. SLA reports. |

## 6. Business events
`WorkflowRuleExecuted`, `WorkflowRuleFailed`, `BlueprintPublished`, `TransitionPerformed` (with data entered), `BlueprintOverridden`, `ChecklistItemTicked`, `SlaWarning`, `SlaBreached`, `EscalationPerformed`.

## 7. Dependencies
Tasks (06), Customization (07), Issues (11), Notifications (09), business hours (01). This is where the Automation service is introduced.

## 8. Open questions
- Custom functions: is a sandboxed language worth the effort, given that webhooks cover most needs? Proposal: LATER; webhooks first.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial outline (blueprint and checklist detail carried over from the build-order plan) |
