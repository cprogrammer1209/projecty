# 07 — Customization Engine
Code: `CUS` · Phase: 1 · Service: Work · Status: **Draft**

> The *data foundation* (field definitions, value storage, status sets, a default layout) is built **with Step 6**. This document covers the full engine. See [roadmap ordering note 1](../03-roadmap.md#ordering-notes-and-adjustments).

## 1. Purpose
Lets each portal shape modules to its own process without code: extra fields, different forms per work type, own statuses, conditional rules, and entirely new record types (custom modules), with field-level access control.

## 2. Actors
Portal Admin (configures), Project Manager (picks layouts per project), all users (fill in forms).

## 3. Scope
**In:** custom fields (all types), field properties and validation, layouts (sections, ordering, overrides), status sets per layout, layout rules, portal tags and picklists, field-level permissions, field history, custom modules with relations, user custom fields.
**Out:** the AI module builder (23), workflow/blueprint usage of fields (18), reports on custom fields (20).

## 4. Key entities
| Entity | Business attributes |
|---|---|
| **Field definition** | Module, label, API name (immutable), type, description, tooltip, default value, mandatory (global), unique, validation (min/max, length, regex, decimals), sensitive/PII flag, active flag, system vs. custom |
| **Picklist option** | Field, label, color, order, default flag, active flag |
| **Layout** | Module, name, default flag, active flag, sections (name, order, columns 1 or 2, collapsible), field placements (section, order, per-layout overrides: mandatory, read-only, default), status set |
| **Status** | Layout, name, color, type (Open / Closed), order, default-on-create flag |
| **Layout rule** | Layout, name, condition (field, operator, value, AND/OR groups), actions (show/hide field or section, make mandatory, set value), order, active |
| **Field permission** | Profile, field, access (Hidden / Read-only / Read & Write) |
| **Custom module** | Singular and plural name, API name, icon, scope (portal-level or project-level), record ID prefix, fields, layouts, statuses, relations |
| **Relation** | From module, to module, type (lookup: many-to-one, or related list: many-to-many), labels on both sides |

### Field types and tiers
| Type | Tier |
|---|---|
| Single-line text, multi-line text, number, decimal, date, picklist, checkbox, user picker (single) | MVP |
| Rich text, currency, percent, date-time, multi-select, user picker (multi), email, phone, URL, auto-number | V1 |
| Lookup (reference to another record/module), formula (computed, read-only), attachment field, dependent picklist | V1 |

## 5. User stories

### Custom fields
| ID | Tier | Story |
|---|---|---|
| CUS-US-01 | MVP | As an Admin, I add a custom field to Tasks with a label, type, and mandatory flag. |
| CUS-US-02 | MVP | As an Admin, I manage picklist options (add, reorder, color, deactivate). |
| CUS-US-03 | MVP | As a user, I see and fill in custom fields on task create, edit, and detail views, with validation. |
| CUS-US-04 | V1 | As an Admin, I set default values, unique constraints, and validation rules (min/max, length, regex). |
| CUS-US-05 | V1 | As an Admin, I rename a field's label without breaking anything (the API name stays the same). |
| CUS-US-06 | V1 | As an Admin, I deactivate a field. It disappears from forms, but its data is kept and can be reactivated. |
| CUS-US-07 | V1 | As an Admin, I hard-delete a field after seeing an impact report (layouts, views, rules, workflows, and reports that use it). |
| CUS-US-08 | V1 | As an Admin, I create formula fields (e.g., `Work hours × Rate`) and lookup fields. |
| CUS-US-09 | V1 | As an Admin, I create dependent picklists (Category → Subcategory). |
| CUS-US-10 | V1 | As an Admin, I mark a field Sensitive. It's masked by default and excluded from exports unless permitted. |
| CUS-US-11 | V1 | As a user, I see a field's change history (old → new, who, when) in the activity stream. |
| CUS-US-12 | LATER | As an Admin, I see a usage report listing everywhere a field is referenced. |

### Layouts & statuses
| ID | Tier | Story |
|---|---|---|
| CUS-US-20 | MVP | As an Admin, I edit the default Task layout's status set (add, rename, color, order, Open/Closed type). |
| CUS-US-21 | V1 | As an Admin, I create multiple task layouts (e.g., "Software Task", "Marketing Task"), each with its own sections, fields, and statuses. |
| CUS-US-22 | V1 | As an Admin, I drag and drop fields into sections, and I set per-layout mandatory, read-only, and default overrides. |
| CUS-US-23 | V1 | As a Manager, I choose a project's task and issue layouts at creation, or via a template. |
| CUS-US-24 | V1 | As an Admin, I change a project's layout and map old statuses and fields to new ones for existing records. |
| CUS-US-25 | V1 | As an Admin, I clone and deactivate layouts. |
| CUS-US-26 | LATER | As an Admin, I preview a layout as a specific profile. |
| CUS-US-27 | LATER | As an Admin, I export and import layout configuration. |

### Layout rules
| ID | Tier | Story |
|---|---|---|
| CUS-US-30 | V1 | As an Admin, I create a rule: "When Type = Bug, show Severity and make it mandatory." |
| CUS-US-31 | V1 | As an Admin, I chain rules (the result of one rule's set-value triggers another). |

### Field-level permissions
| ID | Tier | Story |
|---|---|---|
| CUS-US-40 | V1 | As an Admin, I set each field to Hidden, Read-only, or Read & Write per profile. |

### Custom modules
| ID | Tier | Story |
|---|---|---|
| CUS-US-50 | V1 | As an Admin, I create a custom module (e.g., "Risk") with fields, a layout, and statuses. It appears in project navigation. |
| CUS-US-51 | V1 | As a user, I create, list, edit, and delete records of a custom module, with comments, attachments, and activity like tasks. |
| CUS-US-52 | V1 | As an Admin, I relate a custom module to Tasks, Issues, or another custom module, and related lists show on both sides. |
| CUS-US-53 | LATER | As an Admin, I add custom fields to user profiles (e.g., "Department", "Skill"). |

### Tags & portal picklists
| ID | Tier | Story |
|---|---|---|
| CUS-US-60 | V1 | As an Admin, I manage portal-level tags (rename, merge, color, delete). |
| CUS-US-61 | LATER | As an Admin, I define global picklists reusable across fields. |

## 6. Business rules
- **CUS-BR-01** The API name is generated from the label at creation (`cf_customer_tier`), is unique per module, and never changes.
- **CUS-BR-02** A field's type can't be changed after creation, except for safe widenings (number → decimal, single-line → multi-line). Otherwise, create a new field.
- **CUS-BR-03** Deactivating a picklist option hides it from new selections. Existing records keep and display it with an "inactive" marker.
- **CUS-BR-04** Mandatory precedence: per-layout override > global flag. Layout rules can add mandatory dynamically.
- **CUS-BR-05 Field permission vs. mandatory:** if a field is mandatory but Hidden or Read-only for the user's profile, the field is **not** required for that user, and the default value is applied if one exists. The user is never blocked by a field they can't see.
- **CUS-BR-06** Layout rules are evaluated in the UI for UX **and** re-validated on the server on every save, from every path (form, inline, bulk, import, API).
- **CUS-BR-07** Rule cycles (A sets B, and B sets A) are detected and blocked at save time.
- **CUS-BR-08** Each layout owns its status set, with at least one Open and one Closed status. Exactly one status is the default on create.
- **CUS-BR-09** A status can't be deleted while records use it unless they are mapped to another status. Statuses used by an active blueprint can't be deleted (Step 18).
- **CUS-BR-10** Changing a record's layout (or a project's layout) requires a status mapping and a field mapping. Unmapped custom values are retained as hidden values, not destroyed, for 30 days.
- **CUS-BR-11** Formula fields are read-only, recalculated on save of the record (and of referenced records for lookups), and can't reference other formulas more than 3 levels deep.
- **CUS-BR-12** Hidden fields are omitted everywhere for that user: forms, lists, Kanban cards, exports, search results, notifications, API responses, and reports.
- **CUS-BR-13 Per-plan limits** (entitlements): e.g., 25 custom fields per module and 3 layouts per module on the default plan.
- **CUS-BR-14** Custom-field values must be filterable, sortable, and groupable in views like system fields. This is a requirement on storage design.
- **CUS-BR-15** Custom module records get IDs like `RSK-12` (per-module prefix and per-portal sequence).

## 7. Acceptance criteria
- **CUS-US-30**
  - Given rule "Type = Bug → show Severity (mandatory)", when a user picks Type = Bug, then Severity appears and is required. Switching back to Type = Feature hides it and its value isn't required.
  - Given an API call that sets Type = Bug without Severity, then the server rejects it with a field-level error.
- **CUS-US-40**
  - Given "Cost" is Hidden for the Employee profile, then an employee sees no Cost column in lists, no Cost in exports, can't filter by it, and doesn't see Cost changes in the activity stream.
- **CUS-BR-05**
  - Given "Approval Code" is mandatory and Read-only for Employee, when an employee creates a task, then the save succeeds without it.

## 8. Permissions
Admin only for all configuration. Managers choose layouts for their projects. Field permissions apply to everyone, including Managers (Admins see all).

## 9. Business events
`FieldCreated`, `FieldUpdated`, `FieldDeactivated`, `FieldDeleted`, `LayoutCreated`, `LayoutUpdated`, `StatusSetChanged`, `LayoutRuleChanged`, `FieldPermissionChanged`, `CustomModuleCreated`, `CustomModuleUpdated`, `CustomRecordCreated`, `CustomRecordUpdated`, `CustomRecordTrashed`, `ProjectLayoutChanged`.

## 10. Notifications
Mostly none (admin configuration). Custom module records reuse the task notifications (assigned, mentioned, commented).

## 11. Dependencies
Tasks (06) are the first consumer. Issues (11) are the second. Permissions (02) for field permissions.

## 12. Open questions
- Custom modules: project-scoped only, or also portal-scoped (e.g., a portal-wide "Vendors" list)? Proposal: both, with project-scoped first.
- Formula language: a small expression language (arithmetic, IF, dates) is enough. Confirm the scope before technical design.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial draft |
