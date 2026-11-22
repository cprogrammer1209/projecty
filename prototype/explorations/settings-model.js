/*
 * Shared sample data and operations for the four Settings page explorations (settings-zoho / hubspot / linear / jira .html).
 * In memory only: reload resets it. The pages differ in look and in how the layout builder works; the data and the rules are the same.
 * Mirrors m1/step7: fields, layouts (sections + placements + per-layout overrides), the 3-layout limit, unique section names.
 */
const SM = (() => {
  const TYPES = [['TEXT', 'Text'], ['LONG_TEXT', 'Long text'], ['NUMBER', 'Whole number'], ['DECIMAL', 'Decimal'], ['DATE', 'Date'], ['CHECKBOX', 'Checkbox'], ['PICKLIST', 'Pick one'], ['MULTI_PICKLIST', 'Pick several'], ['USER', 'Person']];
  const MAX_LAYOUTS = 3, MAX_FIELDS = 25;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = (p) => p + Math.random().toString(36).slice(2, 9);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pl = (key, o = {}) => ({ key, mandatory: o.m ?? null, readOnly: !!o.r, defaultValue: o.d ?? null });

  const seed = () => ({
    portal: { name: 'Northwind Labs', slug: 'northwind-labs', timeZone: 'Asia/Kolkata', dateFormat: 'MMM d, yyyy', currency: 'USD', weekStart: 'Monday' },
    /** Settings are module-wise: a module with `live: true` has settings today, the others show where theirs will go. */
    modules: [
      { id: 'projects', name: 'Projects', live: true, tabs: [['fields', 'Fields'], ['layouts', 'Layouts'], ['statuses', 'Statuses'], ['templates', 'Templates']] },
      { id: 'tasks', name: 'Tasks', live: false, note: 'Arrives with Step 6', tabs: [['fields', 'Fields'], ['layouts', 'Layouts'], ['statuses', 'Statuses']] },
      { id: 'issues', name: 'Issues', live: false, note: 'Arrives with Step 9', tabs: [['fields', 'Fields'], ['layouts', 'Layouts'], ['statuses', 'Statuses']] },
      { id: 'documents', name: 'Documents', live: false, note: 'Arrives in M1', tabs: [['fields', 'Fields'], ['folders', 'Folders']] },
      { id: 'time', name: 'Time tracking', live: false, note: 'Later', tabs: [['fields', 'Fields'], ['rules', 'Rules']] },
    ],
    fields: [
      { key: 'cf_customer_tier', label: 'Customer tier', type: 'PICKLIST', mandatory: true, unique: false, sensitive: false, status: 'ACTIVE', description: 'How important this customer is to us.', options: ['Gold', 'Silver', 'Bronze'], usage: 4 },
      { key: 'cf_budget', label: 'Budget', type: 'DECIMAL', mandatory: false, unique: false, sensitive: true, status: 'ACTIVE', description: 'Approved budget in the portal currency.', options: [], usage: 4 },
      { key: 'cf_go_live', label: 'Go-live', type: 'DATE', mandatory: false, unique: false, sensitive: false, status: 'ACTIVE', description: '', options: [], usage: 2 },
      { key: 'cf_vip', label: 'VIP', type: 'CHECKBOX', mandatory: false, unique: false, sensitive: false, status: 'ACTIVE', description: '', options: [], usage: 3 },
      { key: 'cf_channels', label: 'Channels', type: 'MULTI_PICKLIST', mandatory: false, unique: false, sensitive: false, status: 'ACTIVE', description: 'Where the work will be published.', options: ['Web', 'iOS', 'Android', 'Print'], usage: 2 },
      { key: 'cf_account_manager', label: 'Account manager', type: 'USER', mandatory: false, unique: false, sensitive: false, status: 'ACTIVE', description: 'The person who talks to the customer.', options: [], usage: 1 },
      { key: 'cf_contract_no', label: 'Contract number', type: 'TEXT', mandatory: false, unique: true, sensitive: false, status: 'INACTIVE', description: 'Must be different on every project.', options: [], usage: 0 },
      { key: 'cf_scope', label: 'Scope summary', type: 'LONG_TEXT', mandatory: false, unique: false, sensitive: false, status: 'ACTIVE', description: 'A few lines on what is in and out.', options: [], usage: 3 },
    ],
    layouts: [
      { id: 'l1', name: 'Standard', description: 'Every project field in one section.', isDefault: true, active: true, usage: 4,
        sections: [{ id: 's1', name: 'Details', collapsible: false, fields: ['cf_customer_tier', 'cf_budget', 'cf_go_live', 'cf_vip', 'cf_channels', 'cf_account_manager', 'cf_scope'].map((k) => pl(k)) }] },
      { id: 'l2', name: 'Marketing campaign', description: 'For campaigns: who it is for, and how it ships.', isDefault: false, active: true, usage: 1,
        sections: [
          { id: 's2', name: 'Client', collapsible: true, fields: [pl('cf_customer_tier', { m: false }), pl('cf_account_manager', { r: true })] },
          { id: 's3', name: 'Delivery', collapsible: true, fields: [pl('cf_channels', { m: true }), pl('cf_go_live'), pl('cf_vip')] },
        ] },
    ],
    statuses: [
      { id: 'st1', name: 'Active', type: 'Active', color: '#2f9e6f' }, { id: 'st2', name: 'In Progress', type: 'Active', color: '#2a5bd7' },
      { id: 'st3', name: 'On Track', type: 'Active', color: '#2a5bd7' }, { id: 'st4', name: 'Delayed', type: 'Active', color: '#e8890c' },
      { id: 'st5', name: 'On Hold', type: 'On hold', color: '#8a93a3' }, { id: 'st6', name: 'Completed', type: 'Completed', color: '#2f9e6f' },
      { id: 'st7', name: 'Cancelled', type: 'Cancelled', color: '#c8453c' },
    ],
    templates: [
      { id: 't1', name: 'Website launch', description: '12 tasks in 3 phases', uses: 6 }, { id: 't2', name: 'Mobile release', description: '18 tasks in 4 phases', uses: 3 },
    ],
    users: [
      { name: 'Priya Nair', email: 'priya@northwind.com', profile: 'Admin', status: 'Active', last: '5 minutes ago', owner: true },
      { name: 'Sara Lopez', email: 'sara@northwind.com', profile: 'Manager', status: 'Active', last: 'Yesterday' },
      { name: 'Ravi Kumar', email: 'ravi@northwind.com', profile: 'Employee', status: 'Active', last: '3 hours ago' },
      { name: 'Maya Chen', email: 'maya@northwind.com', profile: 'Client', status: 'Active', last: 'Never' },
      { name: 'Tom Becker', email: 'tom@northwind.com', profile: 'Employee', status: 'Deactivated', last: '40 days ago' },
    ],
    profiles: [
      { name: 'Admin', note: 'Everything, including portal settings and users.', people: 1 }, { name: 'Manager', note: 'Runs projects. Sees the people in the portal.', people: 1 },
      { name: 'Employee', note: 'Works on assigned items.', people: 2 }, { name: 'Client', note: 'External user. Sees only what is shared with them.', people: 1 },
    ],
    audit: [
      { when: 'Today, 10:42', who: 'Priya Nair', what: 'Portal settings changed', detail: 'currency: USD → EUR' }, { when: 'Today, 09:15', who: 'Priya Nair', what: 'Layout saved', detail: 'Marketing campaign' },
      { when: 'Yesterday', who: 'Priya Nair', what: 'Custom field added', detail: 'Scope summary (Long text)' }, { when: '2 days ago', who: 'Support (platform admin)', what: 'Support session started', detail: '30 minutes: help with invitations' },
      { when: '9 days ago', who: 'Priya Nair', what: 'User deactivated', detail: 'Tom Becker' }, { when: '20 days ago', who: 'Priya Nair', what: 'Profile changed', detail: 'Sara Lopez: Employee → Manager' },
    ],
  });
  let db = seed();

  const field = (key) => db.fields.find((f) => f.key === key);
  const typeLabel = (t) => (TYPES.find(([v]) => v === t) || [, t])[1];
  const layoutById = (id) => db.layouts.find((l) => l.id === id) || fail('That layout does not exist.');
  const fail = (m) => { throw new Error(m); };
  const toDraft = (l) => clone({ id: l.id, name: l.name, description: l.description, isDefault: l.isDefault, active: l.active, usage: l.usage, sections: l.sections });

  /** Pure operations on a layout draft: the builder edits a draft and calls saveLayout when the person saves. */
  const draft = {
    placed: (d, key) => d.sections.some((s) => s.fields.some((p) => p.key === key)),
    /** Fields not placed in the draft. Inactive ones are included (flagged) so they can be placed ahead of activation. */
    unplaced: (d) => db.fields.filter((f) => !draft.placed(d, f.key)),
    find: (d, key) => { for (const s of d.sections) { const i = s.fields.findIndex((p) => p.key === key); if (i >= 0) return { section: s, index: i, placement: s.fields[i] }; } return null; },
    /** to = a section id, or 'unplaced'. `beforeKey` inserts before that field instead of at the end. */
    move(d, key, to, beforeKey = null) {
      const at = draft.find(d, key), p = at ? at.section.fields.splice(at.index, 1)[0] : pl(key);
      if (to === 'unplaced') return d;
      const s = d.sections.find((x) => x.id === to) || fail('That section does not exist.'), i = beforeKey ? s.fields.findIndex((x) => x.key === beforeKey) : -1;
      if (i >= 0) s.fields.splice(i, 0, p); else s.fields.push(p);
      return d;
    },
    shiftField(d, key, delta) { const at = draft.find(d, key), j = at.index + delta; if (j >= 0 && j < at.section.fields.length) [at.section.fields[at.index], at.section.fields[j]] = [at.section.fields[j], at.section.fields[at.index]]; return d; },
    addSection: (d, name = '') => { const s = { id: uid('s'), name, collapsible: true, fields: [] }; d.sections.push(s); return s; },
    removeSection: (d, id) => { if (d.sections.length === 1) fail('A layout needs at least one section.'); d.sections = d.sections.filter((s) => s.id !== id); return d; },
    shiftSection(d, index, delta) { const j = index + delta; if (j >= 0 && j < d.sections.length) [d.sections[index], d.sections[j]] = [d.sections[j], d.sections[index]]; return d; },
    /** o = { mandatory: null|true|false, readOnly: bool, defaultValue: string|null } */
    override(d, key, o) { Object.assign(draft.find(d, key).placement, o); return d; },
    /** Effective settings of a placed field: the layout's override beats the field itself. */
    effective(d, key) { const at = draft.find(d, key), f = field(key), p = at?.placement || pl(key); return { ...f, mandatory: p.mandatory ?? f.mandatory, readOnly: p.readOnly, defaultValue: p.defaultValue }; },
    /** Message for the first problem that would stop a save, or null. */
    problem(d) {
      if (!d.name.trim()) return 'Name the layout.';
      if (db.layouts.some((l) => l.id !== d.id && l.name.toLowerCase() === d.name.trim().toLowerCase())) return 'A layout with this name already exists.';
      const names = new Set();
      for (const s of d.sections) { const n = s.name.trim().toLowerCase(); if (!n) return 'Every section needs a name.'; if (names.has(n)) return `Two sections are called "${s.name.trim()}".`; names.add(n); }
      return null;
    },
  };

  /** A simple unstyled control for a field type, for previews. Pages style `.sm-ctl` and its children as they like. */
  const control = (f, { mandatory = f.mandatory, readOnly = false, defaultValue = null } = {}) => {
    const dis = readOnly ? 'disabled' : '', dv = defaultValue ?? '';
    let c;
    switch (f.type) {
      case 'LONG_TEXT': c = `<textarea rows="3" ${dis}>${esc(dv)}</textarea>`; break;
      case 'NUMBER': case 'DECIMAL': c = `<input type="number" value="${esc(dv)}" ${dis}>`; break;
      case 'DATE': c = `<input type="date" value="${esc(dv)}" ${dis}>`; break;
      case 'CHECKBOX': c = `<label class="sm-check"><input type="checkbox" ${dv ? 'checked' : ''} ${dis}> Yes</label>`; break;
      case 'PICKLIST': c = `<select ${dis}><option value="">None</option>${f.options.map((o) => `<option ${o === dv ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
      case 'MULTI_PICKLIST': c = `<div class="sm-multi">${f.options.map((o) => `<label class="sm-check"><input type="checkbox" ${dis}> ${esc(o)}</label>`).join('')}</div>`; break;
      case 'USER': c = `<select ${dis}><option value="">None</option>${db.users.filter((u) => u.status === 'Active').map((u) => `<option>${esc(u.name)}</option>`).join('')}</select>`; break;
      default: c = `<input type="text" value="${esc(dv)}" ${dis}>`;
    }
    return `<div class="sm-ctl"><label class="sm-lab">${esc(f.label)}${mandatory ? ' <span class="sm-req">*</span>' : ''}${readOnly ? ' <span class="sm-ro">read-only</span>' : ''}</label>${c}</div>`;
  };

  return {
    TYPES, MAX_LAYOUTS, MAX_FIELDS, esc, typeLabel, control, draft, uid,
    reset() { db = seed(); },
    get portal() { return db.portal; }, get modules() { return db.modules; }, get users() { return db.users; }, get profiles() { return db.profiles; }, get audit() { return db.audit; },
    statuses: () => db.statuses, templates: () => db.templates,
    fields: () => db.fields, field,
    layouts: () => db.layouts.map((l) => ({ id: l.id, name: l.name, description: l.description, isDefault: l.isDefault, active: l.active, usage: l.usage, sectionCount: l.sections.length, fieldCount: l.sections.reduce((n, s) => n + s.fields.length, 0) })),
    /** A deep copy to edit. Nothing changes until saveLayout. */
    layout: (id) => toDraft(layoutById(id)),
    saveLayout(d) {
      const msg = draft.problem(d); if (msg) fail(msg);
      const l = layoutById(d.id); Object.assign(l, { name: d.name.trim(), description: d.description || '', sections: clone(d.sections).map((s) => ({ ...s, name: s.name.trim() })) });
    },
    createLayout({ name, cloneFrom = null }) {
      const label = String(name || '').trim();
      if (!label) fail('Name the layout.');
      if (db.layouts.length >= MAX_LAYOUTS) fail(`A module can have at most ${MAX_LAYOUTS} layouts. Deactivate one you no longer use, or edit it instead.`);
      if (db.layouts.some((l) => l.name.toLowerCase() === label.toLowerCase())) fail('A layout with this name already exists.');
      const src = cloneFrom ? layoutById(cloneFrom) : null;
      const l = { id: uid('l'), name: label, description: '', isDefault: false, active: true, usage: 0, sections: src ? clone(src.sections).map((s) => ({ ...s, id: uid('s') })) : [{ id: uid('s'), name: 'Details', collapsible: false, fields: [] }] };
      db.layouts.push(l); return l.id;
    },
    setDefault(id) { const l = layoutById(id); if (!l.active) fail('Activate the layout first.'); db.layouts.forEach((x) => { x.isDefault = x.id === id; }); },
    setActive(id, on) { const l = layoutById(id); if (!on && l.isDefault) fail('Make another layout the default first.'); l.active = on; },
    /** A new field (not placed in any layout yet). */
    createField({ label, type, mandatory = false }) {
      const text = String(label || '').trim();
      if (!text) fail('Name the field.');
      if (db.fields.length >= MAX_FIELDS) fail(`A module can have at most ${MAX_FIELDS} custom fields.`);
      let key = 'cf_' + (text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field'), n = 2; const base = key;
      while (db.fields.some((f) => f.key === key)) key = `${base}_${n++}`;
      const f = { key, label: text, type, mandatory, unique: false, sensitive: false, status: 'ACTIVE', description: '', options: ['PICKLIST', 'MULTI_PICKLIST'].includes(type) ? ['Option 1', 'Option 2'] : [], usage: 0 };
      db.fields.push(f); return f;
    },
    addStatus(name) { const n = String(name || '').trim(); if (!n) fail('Name the status.'); db.statuses.push({ id: uid('st'), name: n, type: 'Active', color: '#2a5bd7' }); },
  };
})();
