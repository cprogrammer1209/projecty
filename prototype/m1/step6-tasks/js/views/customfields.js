/*
 * M1 · Step 7 · Custom fields on projects (docs/requirements/07-customization-engine.md, MVP stories CUS-US-01 to 03).
 * Screens: Settings → Custom fields (list), create and edit (full pages with a live preview).
 * Also exports the pieces the project form and overview use: control(), read(), display().
 */
const CustomFields = (() => {
  const { esc, icon, spinner, field, input, alertBox, component, formatDate, Router } = PY;
  const TYPE_LABEL = Object.fromEntries(Store.FIELD_TYPES);
  const PICK = ['PICKLIST', 'MULTI_PICKLIST'];
  const NUMERIC = ['NUMBER', 'DECIMAL'];
  const options = (items, selected) => items.map(([v, l]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const base = (ctx) => `#/p/${ctx.slug}/settings/${ctx.entity === 'TASK' ? 'tasks' : 'projects'}/fields`;
  let noun = 'project'; // the record type the open screen is about (Settings → Projects or Tasks)
  let flash = null;
  const takeFlash = () => { const f = flash; flash = null; return f; };

  /* ---------- shared: one control per field type, used by the project form and by the preview here ---------- */
  /** The input for one field. Wrapped in [data-cf] so read() can find the value again. */
  function control(def, value, { people = [], id = 'cf-' + def.apiName, error = null, disabled = false } = {}) {
    const dis = disabled ? 'disabled' : '', bad = error ? 'aria-invalid="true"' : '';
    const v = value ?? '';
    let body;
    switch (def.type) {
      case 'LONG_TEXT': body = `<textarea id="${id}" class="py-textarea" rows="4" ${dis} ${bad}>${esc(v)}</textarea>`; break;
      case 'NUMBER': case 'DECIMAL':
        body = `<div class="py-input-wrap"><input id="${id}" type="number" inputmode="decimal" step="${def.type === 'NUMBER' ? 1 : 'any'}" value="${esc(v)}" ${dis} ${bad} /></div>`; break;
      case 'DATE': body = `<div class="py-input-wrap"><input id="${id}" type="date" value="${esc(v)}" ${dis} ${bad} /></div>`; break;
      case 'CHECKBOX': body = `<label class="cf-check"><input id="${id}" type="checkbox" ${value === true ? 'checked' : ''} ${dis} /><span>Yes</span></label>`; break;
      case 'PICKLIST': {
        const opts = def.options.filter((o) => o.active || o.id === value).map((o) => [o.id, o.label + (o.active ? '' : ' (inactive)')]);
        body = `<select id="${id}" class="py-select" ${dis} ${bad}><option value="">None</option>${options(opts, value)}</select>`; break;
      }
      case 'MULTI_PICKLIST': {
        const chosen = Array.isArray(value) ? value : [];
        body = `<div class="cf-multi" id="${id}" role="group">${def.options.filter((o) => o.active || chosen.includes(o.id)).map((o) =>
          `<label class="cf-check"><input type="checkbox" value="${esc(o.id)}" ${chosen.includes(o.id) ? 'checked' : ''} ${dis} /><span>${esc(o.label)}${o.active ? '' : ' (inactive)'}</span></label>`).join('') || '<span class="muted">No choices yet.</span>'}</div>`; break;
      }
      case 'USER': body = `<select id="${id}" class="py-select" ${dis} ${bad}><option value="">None</option>${options(people.map((x) => [x.userId, x.fullName]), value)}</select>`; break;
      default: body = `<div class="py-input-wrap"><input id="${id}" type="text" value="${esc(v)}" ${def.config?.maxLength ? `maxlength="${def.config.maxLength}"` : ''} ${dis} ${bad} /></div>`;
    }
    const req = def.mandatory ? '<span class="cf-req">Required</span>' : '';
    return field({ label: def.label, id, error, hint: error ? null : (def.description || hintFor(def)), action: req, body: `<div data-cf="${esc(def.apiName)}">${body}</div>` });
  }
  /** A short rule summary shown under a field when it has no description. */
  function hintFor(def) {
    const c = def.config || {};
    if (NUMERIC.includes(def.type) && (c.min != null || c.max != null)) return `${c.min != null ? 'From ' + c.min : ''}${c.min != null && c.max != null ? ' ' : ''}${c.max != null ? 'up to ' + c.max : ''}.`;
    if (def.type === 'MULTI_PICKLIST' && (c.minSelect || c.maxSelect)) return `Pick ${c.minSelect ? 'at least ' + c.minSelect : ''}${c.minSelect && c.maxSelect ? ', ' : ''}${c.maxSelect ? 'at most ' + c.maxSelect : ''}.`;
    return null;
  }
  /** The value a [data-cf] wrapper currently holds (null = empty). */
  function read(def, wrap) {
    const n = wrap.querySelector('input, select, textarea');
    switch (def.type) {
      case 'CHECKBOX': return n.checked;
      case 'MULTI_PICKLIST': { const ids = [...wrap.querySelectorAll('input:checked')].map((x) => x.value); return ids.length ? ids : null; }
      case 'NUMBER': case 'DECIMAL': return n.value === '' ? null : n.value;
      default: return n.value === '' ? null : n.value;
    }
  }
  /** Read-only text for a value, e.g. on the project overview. */
  function display(def, value, ctx, people = []) {
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '<span class="muted">Not set</span>';
    switch (def.type) {
      case 'CHECKBOX': return value ? 'Yes' : 'No';
      case 'DATE': return esc(formatDate(new Date(value + 'T00:00:00Z'), ctx.portal.dateFormat, 'UTC'));
      case 'PICKLIST': return esc(def.options.find((o) => o.id === value)?.label ?? 'Unknown choice');
      case 'MULTI_PICKLIST': return value.map((id) => `<span class="badge">${esc(def.options.find((o) => o.id === id)?.label ?? 'Unknown choice')}</span>`).join(' ');
      case 'USER': return esc(people.find((x) => x.userId === value)?.fullName ?? 'Unknown person');
      case 'LONG_TEXT': return `<span class="cf-long">${esc(value)}</span>`;
      case 'DECIMAL': return esc(Number(value).toLocaleString('en-US', { minimumFractionDigits: def.config?.decimals ?? 0, maximumFractionDigits: Math.max(def.config?.decimals ?? 0, 0) }));
      default: return esc(value);
    }
  }

  /* ---------- Linear-style properties (project overview): every value is a quiet button, nothing has Save or Cancel ---------- */
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const TEXTY = ['TEXT', 'LONG_TEXT', 'NUMBER', 'DECIMAL'];
  const isBlank = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
  const nameInitials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  /** The choices a popover offers: active ones, plus a deactivated one this record already holds. */
  function choices(def, value, people) {
    if (def.type === 'USER') return people.map((x) => ({ id: x.userId, label: x.fullName, person: true }));
    const held = Array.isArray(value) ? value : [value];
    return def.options.filter((o) => o.active || held.includes(o.id)).map((o) => ({ id: o.id, label: o.label + (o.active ? '' : ' (inactive)') }));
  }
  function optionList(def, value, ui, people) {
    const q = ui.q.trim().toLowerCase(), multi = def.type === 'MULTI_PICKLIST';
    const rows = choices(def, value, people).filter((o) => o.label.toLowerCase().includes(q)).map((o) => {
      if (multi) { const on = (value || []).includes(o.id); return `<button class="opt" type="button" data-opt="${esc(o.id)}"><span class="box${on ? ' on' : ''}">${on ? '✓' : ''}</span>${esc(o.label)}</button>`; }
      const lead = o.person ? `<span class="av">${esc(nameInitials(o.label))}</span>` : '<span class="dot"></span>';
      return `<button class="opt" type="button" data-opt="${esc(o.id)}">${lead}${esc(o.label)}${value === o.id ? '<span class="tick">✓</span>' : ''}</button>`;
    }).join('');
    const clear = !multi && !def.mandatory && !isBlank(value) && !q ? '<button class="opt muted" type="button" data-opt="">Clear</button>' : '';
    return (rows || '<div class="cf-none">No match</div>') + clear;
  }
  function calendar(def, value, ui) {
    const { y, m } = ui.cal, first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), now = new Date();
    const cells = [...Array(first).fill('<span></span>'), ...Array.from({ length: days }, (_, i) => {
      const d = i + 1, iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const today = now.getFullYear() === y && now.getMonth() === m && now.getDate() === d;
      return `<button type="button" data-day="${iso}" class="${value === iso ? 'sel' : ''}${today ? ' today' : ''}">${d}</button>`;
    })];
    return `<div class="cal-h"><button type="button" data-nav="-1" aria-label="Previous month">‹</button><span>${MONTHS[m]} ${y}</span><button type="button" data-nav="1" aria-label="Next month">›</button></div>
      <div class="cal-g">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span class="dow">${d}</span>`).join('')}${cells.join('')}</div>
      ${value && !def.mandatory ? '<div class="cf-hint"><button class="opt muted" type="button" data-day="">Clear date</button></div>' : ''}`;
  }
  /** What the pill says: the value, or "Set <field>" when empty. */
  function pillText(def, value, ctx, people) {
    if (isBlank(value)) return def.type === 'MULTI_PICKLIST' ? `Add ${esc(def.label.toLowerCase())}` : `Set ${esc(def.label.toLowerCase())}`;
    if (def.type === 'PICKLIST') return `<span class="dot"></span>${display(def, value, ctx, people)}`;
    if (def.type === 'USER') return `<span class="av">${esc(nameInitials(people.find((x) => x.userId === value)?.fullName ?? '?'))}</span>${display(def, value, ctx, people)}`;
    return display(def, value, ctx, people);
  }
  /** One property's value cell. `ui` = { pop, q, cal, editing, error, flash } kept by the page. */
  function propCell(def, value, ui, ctx, people, canEdit) {
    const k = def.apiName, blank = isBlank(value);
    if (!canEdit || def.readOnly) return `<span class="pv ro" title="${def.readOnly ? (def.readOnlyReason || 'Read-only in this layout') : (ctx.editHint || 'Only Admins, the owner and project Managers can edit')}">${display(def, value, ctx, people)}</span>`;
    const flash = ui.flash === k ? '<span class="saved" data-flash>✓ Saved</span>' : '';
    const err = ui.error?.k === k ? `<p class="py-field__error">${icon('alert')}${esc(ui.error.msg)}</p>` : '';
    if (def.type === 'CHECKBOX') return `<button class="pill" type="button" data-toggle="${esc(k)}"><span class="box${value ? ' on' : ''}">${value ? '✓' : ''}</span>${value ? 'Yes' : 'No'}</button>${flash}${err}`;
    if (TEXTY.includes(def.type)) {
      if (ui.editing === k) {
        const ctl = def.type === 'LONG_TEXT' ? `<textarea class="inl" rows="4" data-focus aria-label="${esc(def.label)}">${esc(value ?? '')}</textarea>`
          : `<input class="inl" data-focus type="${def.type === 'TEXT' ? 'text' : 'number'}" ${def.type === 'NUMBER' ? 'step="1"' : def.type === 'DECIMAL' ? 'step="any"' : ''} value="${esc(value ?? '')}" ${def.config?.maxLength ? `maxlength="${def.config.maxLength}"` : ''} aria-label="${esc(def.label)}">`;
        return `<div class="inl-wrap" data-inline="${esc(k)}">${ctl}${err}${def.type === 'LONG_TEXT' ? '<p class="cf-hint-line">Click outside to save. Esc to cancel.</p>' : ''}</div>`;
      }
      return `<button class="pill${blank ? ' empty' : ''}" type="button" data-edit="${esc(k)}">${blank ? `Set ${esc(def.label.toLowerCase())}` : def.type === 'LONG_TEXT' ? `<span class="cf-long">${esc(value)}</span>` : display(def, value, ctx, people)}</button>${flash}${err}`;
    }
    const open = ui.pop === k;
    let pop = '';
    if (open) {
      pop = def.type === 'DATE' ? `<div class="pop cal">${calendar(def, value, ui)}${err}</div>`
        : `<div class="pop"><input type="text" class="search" data-search data-focus placeholder="${def.type === 'MULTI_PICKLIST' ? 'Pick…' : 'Search…'}" value="${esc(ui.q)}" aria-label="Search ${esc(def.label)}">
            <div class="list" data-list>${optionList(def, value, ui, people)}</div>${err}${def.type === 'MULTI_PICKLIST' ? '<div class="cf-hint">Each tick saves. Esc to close.</div>' : ''}</div>`;
    }
    return `<button class="pill${open ? ' open' : ''}${blank ? ' empty' : ''}" type="button" data-pop="${esc(k)}" aria-haspopup="listbox" aria-expanded="${open}">${pillText(def, value, ctx, people)}</button>${flash}${open ? '' : err}${pop}`;
  }
  /** The whole property list. */
  const WIDE = ['LONG_TEXT', 'MULTI_PICKLIST']; // these take the whole row of the column grid
  function propsHtml(fields, values, ui, ctx, people, canEdit) {
    return fields.map((d) => `<div class="prop${(d.wide ?? WIDE.includes(d.type)) ? ' wide' : ''}"><div class="lab">${esc(d.label)}${d.mandatory ? ' <span class="cf-req" title="Required">*</span>' : ''}${d.readOnly ? ' <span class="cf-ro">Read-only</span>' : ''}</div><div class="cell" data-cell="${esc(d.apiName)}">${propCell(d, values?.[d.apiName], ui, ctx, people, canEdit)}</div></div>`).join('');
  }
  /**
   * Behaviour of the property list, after every paint:
   *   save(apiName, value, optimistic) -> Promise   (throws an Error with the message to show)
   *   repaint()                                     (draws the page again; `ui` survives)
   * Picks save when you pick (multi: every tick), the checkbox when you click it, text and numbers when you press Enter or click away.
   */
  function bindProps(root, { fields, values, ui, people, save, repaint }) {
    const def = (k) => fields.find((d) => d.apiName === k);
    const same = (a, b) => JSON.stringify(isBlank(a) ? null : a) === JSON.stringify(isBlank(b) ? null : b);
    const commit = async (k, val, { keepOpen = false, optimistic = false } = {}) => {
      if (same(values[k], val)) { ui.pop = keepOpen ? ui.pop : null; ui.editing = null; return repaint(); }
      ui.error = null; if (!keepOpen) ui.pop = null; ui.editing = null;
      try { await save(k, val, optimistic); ui.flash = k; setTimeout(() => { if (ui.flash === k) { ui.flash = null; document.querySelectorAll('[data-flash]').forEach((n) => n.remove()); } }, 1600); }
      catch (err) { ui.error = { k, msg: err.message }; if (TEXTY.includes(def(k).type)) ui.editing = k; else if (!keepOpen) ui.pop = k; }
      repaint();
    };
    const openPop = (k) => {
      ui.pop = k; ui.q = ''; ui.editing = null; ui.error = null;
      if (def(k).type === 'DATE') { const d = values[k] ? new Date(values[k] + 'T00:00:00') : new Date(); ui.cal = { y: d.getFullYear(), m: d.getMonth() }; }
      repaint();
    };
    root.addEventListener('click', (e) => {
      const T = (sel) => e.target.closest(sel);
      if (T('[data-toggle]')) { const k = T('[data-toggle]').dataset.toggle; return commit(k, !values[k], { optimistic: true }); }
      if (T('[data-pop]')) { const k = T('[data-pop]').dataset.pop; if (ui.pop === k) { ui.pop = null; ui.error = null; return repaint(); } return openPop(k); }
      if (T('[data-edit]')) { ui.pop = null; ui.error = null; ui.editing = T('[data-edit]').dataset.edit; return repaint(); }
      if (T('[data-opt]')) {
        const k = ui.pop, d = def(k), id = T('[data-opt]').dataset.opt;
        if (d.type === 'MULTI_PICKLIST') { const cur = new Set(values[k] || []); cur.has(id) ? cur.delete(id) : cur.add(id); return commit(k, [...cur], { keepOpen: true, optimistic: true }); }
        return commit(k, id || null, { optimistic: true });
      }
      if (T('[data-day]')) return commit(ui.pop, T('[data-day]').dataset.day || null, { optimistic: true });
      if (T('[data-nav]')) { let { y, m } = ui.cal; m += +T('[data-nav]').dataset.nav; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } ui.cal = { y, m }; return repaint(); }
    });
    root.addEventListener('input', (e) => {
      if (e.target.matches('[data-search]')) { ui.q = e.target.value; const k = ui.pop; root.querySelector('[data-list]').innerHTML = optionList(def(k), values[k], ui, people); }
    });
    const inline = (node) => node.closest('[data-inline]');
    root.addEventListener('keydown', (e) => {
      const box = inline(e.target);
      if (e.key === 'Escape') { if (ui.pop || ui.editing) { ui.pop = null; ui.editing = null; ui.error = null; repaint(); } return; }
      if (box && e.key === 'Enter' && (e.target.tagName !== 'TEXTAREA' || e.ctrlKey || e.metaKey)) { e.preventDefault(); const raw = e.target.value; commit(box.dataset.inline, raw === '' ? null : raw); }
    });
    root.addEventListener('focusout', (e) => {
      const box = inline(e.target); if (!box) return;
      const k = box.dataset.inline, node = e.target;
      setTimeout(() => { if (ui.editing === k && !(document.activeElement && document.activeElement.closest?.('[data-inline]'))) commit(k, node.value === '' ? null : node.value); }, 0);
    });
    // A click anywhere else closes the popover. Re-registered on every paint, so the previous handlers are dropped first.
    ui.off?.();
    const onDoc = (e) => { if (!root.isConnected) return ui.off?.(); if (ui.pop && e.target.isConnected && !root.contains(e.target)) { ui.pop = null; ui.error = null; repaint(); } };
    document.addEventListener('click', onDoc);
    ui.off = () => { document.removeEventListener('click', onDoc); ui.off = null; };
    const f = root.querySelector('[data-focus]');
    if (f) { f.focus(); if (f.setSelectionRange && f.type !== 'number') { const n = f.value.length; try { f.setSelectionRange(n, n); } catch (err) { /* date and number inputs have no caret */ } } }
  }

  /* ---------- small confirm dialog (mounted into #app so a route change removes it) ---------- */
  function confirmDialog({ title, body, label, danger = true, onConfirm }) {
    const host = document.createElement('div'); host.className = 'pd-overlay';
    document.getElementById('app').appendChild(host);
    const close = () => { host.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    host.onclick = (e) => { if (e.target === host) close(); };
    component(host, { busy: false, error: null }, (s) => `<section class="pd-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-title"><h2 id="pd-title">${esc(title)}</h2><p class="pd-lead">${body}</p>${s.error ? alertBox(s.error) : ''}
      <div class="pd-actions"><button class="py-btn py-btn--secondary" type="button" data-close>Cancel</button>
      <button class="py-btn ${danger ? 'py-btn--danger' : 'py-btn--primary'}" type="button" id="pd-yes" ${s.busy ? 'disabled' : ''}>${s.busy ? spinner : ''}${esc(label)}</button></div></section>`,
    (el, api) => {
      el.querySelector('[data-close]').addEventListener('click', close);
      el.querySelector('#pd-yes').addEventListener('click', async () => {
        api.set({ busy: true, error: null });
        try { await onConfirm(); close(); } catch (err) { api.set({ busy: false, error: err.message }); }
      });
    });
  }

  /* ---------- Settings → Custom fields ---------- */
  function ruleChips(f) {
    return [f.mandatory ? 'Required' : null, f.unique ? 'Unique' : null, f.sensitive ? 'Sensitive' : null].filter(Boolean).map((t) => `<span class="badge">${t}</span>`).join(' ') || '<span class="muted">None</span>';
  }
  function typeDetail(f) {
    if (PICK.includes(f.type)) { const n = f.options.filter((o) => o.active).length; return `${n} choice${n === 1 ? '' : 's'}`; }
    return '';
  }

  function tab(el, ctx) {
    noun = ctx.entity === 'TASK' ? 'task' : 'project';
    const canManage = ctx.can('CUSTOM_FIELDS_MANAGE');
    const s = { items: null, showInactive: true, error: null, notice: takeFlash(), busy: null };
    const shown = () => (s.items || []).filter((f) => s.showInactive || f.status === 'ACTIVE');
    const render = (s) => {
      const rows = shown().map((f, i, all) => `<tr class="${f.status === 'ACTIVE' ? '' : 'inactive'}">
        <td class="cf-order">${canManage ? `<button class="icon-x" type="button" data-up="${esc(f.id)}" aria-label="Move ${esc(f.label)} up" ${s.items.indexOf(f) === 0 || s.busy ? 'disabled' : ''}>↑</button><button class="icon-x" type="button" data-down="${esc(f.id)}" aria-label="Move ${esc(f.label)} down" ${s.items.indexOf(f) === s.items.length - 1 || s.busy ? 'disabled' : ''}>↓</button>` : ''}</td>
        <td><div class="person"><div><strong>${esc(f.label)}</strong><small><span class="mono">${esc(f.apiName)}</span>${f.description ? ' · ' + esc(f.description) : ''}</small></div></div></td>
        <td>${esc(TYPE_LABEL[f.type])}${typeDetail(f) ? `<small class="cf-sub">${typeDetail(f)}</small>` : ''}</td>
        <td>${ruleChips(f)}</td>
        <td>${f.status === 'ACTIVE' ? '<span class="badge ok">Active</span>' : '<span class="badge">Inactive</span>'}</td>
        <td class="actions">${canManage ? `<a class="py-btn py-btn--ghost" href="${base(ctx)}/${esc(f.id)}/edit">Edit</a>
          ${f.status === 'ACTIVE' ? `<button class="py-btn py-btn--ghost" type="button" data-deactivate="${esc(f.id)}">Deactivate</button>` : `<button class="py-btn py-btn--ghost" type="button" data-activate="${esc(f.id)}">Activate</button>`}
          <button class="py-btn py-btn--ghost danger" type="button" data-delete="${esc(f.id)}">Delete</button>` : ''}</td></tr>`).join('');
      const total = s.items?.length ?? 0;
      return `<div class="users-page projects-page">
        <section class="panel">
          <div class="panel-head"><div><h2>${s.items ? `${total} of ${Store.MAX_FIELDS} fields used` : 'Fields'}</h2></div>
            ${canManage ? `<a class="py-btn py-btn--primary ${total >= Store.MAX_FIELDS ? 'disabled' : ''}" href="${base(ctx)}/new">${icon('plus')}New field</a>` : ''}</div>
          ${s.error ? `<div class="cf-pad">${alertBox(s.error)}</div>` : ''}${s.notice ? `<div class="cf-pad"><div class="py-alert py-alert--ok" role="status">${icon('check')}<span>${esc(s.notice)}</span></div></div>` : ''}
          ${!canManage ? `<div class="cf-pad"><div class="py-alert" role="status">${icon('alert')}<span>Only Admins can add or change custom fields.</span></div></div>` : ''}
          <div class="filters"><label class="cf-check"><input type="checkbox" name="showInactive" ${s.showInactive ? 'checked' : ''} /><span>Show inactive fields</span></label></div>
          <div class="table-wrap"><table>
            <thead><tr><th></th><th>Field</th><th>Type</th><th>Rules</th><th>Status</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6" class="empty">${!s.items ? 'Loading fields…' : canManage ? 'No custom fields yet. Add the first one.' : 'No custom fields yet.'}</td></tr>`}</tbody></table></div>
        </section>
        <p class="hint cf-note">Fields are shown on the ${noun} form in this order. A deactivated field is hidden but keeps its answers, and can be activated again. Deleting removes the answers for good.</p></div>`;
    };
    let api;
    const load = async () => { try { s.items = await Store.customFieldsAdmin(ctx.portal.id, ctx.entity); } catch (err) { s.items = s.items || []; s.error = err.message; } api.paint(); };
    const act = async (fn, notice) => { s.error = null; s.notice = null; s.busy = true; api.paint(); try { await fn(); if (notice) s.notice = notice; } catch (err) { s.error = err.message; } s.busy = null; await load(); };
    api = component(el, s, render, (el) => {
      el.querySelector('[name="showInactive"]')?.addEventListener('change', (e) => { s.showInactive = e.target.checked; api.paint(); });
      const byId = (id) => s.items.find((f) => f.id === id);
      el.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => act(() => Store.moveCustomField(ctx.portal.id, b.dataset.up, -1))));
      el.querySelectorAll('[data-down]').forEach((b) => b.addEventListener('click', () => act(() => Store.moveCustomField(ctx.portal.id, b.dataset.down, 1))));
      el.querySelectorAll('[data-deactivate]').forEach((b) => b.addEventListener('click', () => { const f = byId(b.dataset.deactivate);
        confirmDialog({ title: `Deactivate ${f.label}?`, label: 'Deactivate', danger: false,
          body: `It disappears from ${noun} forms and pages. ${f.usage ? `The answers on ${f.usage} ${noun}${f.usage === 1 ? '' : 's'} are kept and come back if you activate it again.` : 'No ${noun} has an answer yet.'}`,
          onConfirm: async () => { await Store.deactivateCustomField(ctx.portal.id, f.id); s.notice = `${f.label} deactivated.`; load(); } }); }));
      el.querySelectorAll('[data-activate]').forEach((b) => b.addEventListener('click', () => { const f = byId(b.dataset.activate); act(() => Store.activateCustomField(ctx.portal.id, f.id), `${f.label} is active again.`); }));
      el.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
        const f = byId(b.dataset.delete);
        let count = f.usage; try { count = (await Store.customFieldUsage(ctx.portal.id, f.id)).count; } catch (e) {}
        confirmDialog({ title: `Delete ${f.label}?`, label: 'Delete field',
          body: `${count ? `${count} ${noun}${count === 1 ? ' has' : 's have'} an answer, and ${count === 1 ? 'it' : 'they'} will be removed. ` : `No ${noun} has an answer. `}This can't be undone. The key ${esc(f.apiName)} is retired, so a new field with the same name gets a new key. To keep the answers, deactivate it instead.`,
          onConfirm: async () => { await Store.deleteCustomField(ctx.portal.id, f.id); s.notice = `${f.label} deleted.`; load(); } });
      }));
    });
    load();
  }

  /* ---------- create and edit: one full page ---------- */
  function formPage(el, ctx, { def = null }) {
    noun = ctx.entity === 'TASK' ? 'task' : 'project';
    const editing = !!def;
    const s = { label: def?.label ?? '', type: def?.type ?? 'TEXT', description: def?.description ?? '', mandatory: def?.mandatory ?? false, unique: def?.unique ?? false, sensitive: def?.sensitive ?? false,
      defaultValue: def?.defaultValue ?? null, config: { ...(def?.config ?? {}) }, options: (def?.options ?? []).map((o) => ({ ...o, saved: true })),
      errors: {}, submitted: false, busy: false, error: null };
    const newOpt = () => ({ id: 'o' + Math.random().toString(36).slice(2, 10), label: '', active: true, saved: false });
    if (!editing) s.options = [newOpt()];
    const draft = () => ({ ...(def ?? {}), apiName: def?.apiName ?? 'cf_preview', label: s.label.trim() || 'Untitled field', type: s.type, description: s.description, mandatory: s.mandatory, config: s.config,
      options: s.options.filter((o) => o.label.trim()).map((o) => ({ id: o.id, label: o.label.trim(), active: o.active })) });
    const canUnique = Store.UNIQUE_TYPES.includes(s.type);
    const keyHint = () => 'cf_' + (s.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field');
    const num = (name, label, hint) => field({ label, id: 'c-' + name, hint, body: input({ id: 'c-' + name, name: 'c:' + name, type: 'number', value: s.config[name] ?? '' }) });
    const defaultRegion = () => {
      if (s.unique) return '<p class="hint">A unique field can\'t have a default value, because every record would get the same one.</p>';
      if (s.type === 'LONG_TEXT' || s.type === 'USER') return s.type === 'USER' ? '<p class="hint">No default for a person.</p>' : control({ ...draft(), mandatory: false, description: '' }, s.defaultValue, { id: 'cf-default' });
      return control({ ...draft(), mandatory: false, label: 'Default value', description: `Filled in when a ${noun} is created. Optional.` }, s.defaultValue, { id: 'cf-default', error: s.errors.defaultValue });
    };
    const optionRows = () => s.options.map((o, i) => `<li class="cf-opt${o.active ? '' : ' off'}">
        <input type="text" data-opt="${i}" value="${esc(o.label)}" placeholder="Choice ${i + 1}" aria-label="Choice ${i + 1}" maxlength="60" />
        ${o.saved ? '' : `<button class="icon-x" type="button" data-oup="${i}" aria-label="Move up" ${i === 0 || s.options[i - 1].saved ? 'disabled' : ''}>↑</button>
        <button class="icon-x" type="button" data-odown="${i}" aria-label="Move down" ${i === s.options.length - 1 ? 'disabled' : ''}>↓</button>`}
        ${o.saved ? `<button class="py-btn py-btn--ghost" type="button" data-otoggle="${i}">${o.active ? 'Deactivate' : 'Activate'}</button>` : `<button class="icon-x" type="button" data-oremove="${i}" aria-label="Remove choice">✕</button>`}</li>`).join('');
    const check = (name, label, hint, disabled = false) => `<label class="cf-rule${disabled ? ' off' : ''}"><input type="checkbox" name="${name}" ${s[name] ? 'checked' : ''} ${disabled ? 'disabled' : ''} /><span><strong>${label}</strong><small>${hint}</small></span></label>`;

    const render = () => `<div class="users-page projects-page form-page">
      <a class="back" href="${base(ctx)}">${icon('arrow-left')}Custom fields</a>
      <div class="page-title"><div><h1>${editing ? `Edit ${esc(def.label)}` : 'New custom field'}</h1>
        <p>${editing ? 'The type, the key and "unique" are fixed after creation, because answers already stored depend on them.' : 'Pick what kind of answer it holds. The type can\'t be changed later.'}</p></div></div>
      ${s.error ? alertBox(s.error) : ''}
      <form class="pf" novalidate><div class="pf-grid"><div class="pf-main">
        <section class="panel pf-card"><h2>Basics</h2>
          ${field({ label: 'Field name', id: 'cf-label', error: s.errors.label, hint: editing ? null : null, body: input({ id: 'cf-label', name: 'label', value: s.label, placeholder: 'Customer tier', error: s.errors.label }) })}
          <p class="cf-key">Key <span class="mono" data-key>${esc(editing ? def.apiName : keyHint())}</span> ${editing ? '' : '(made from the name; if it is taken a number is added)'}</p>
          ${field({ label: 'Type', id: 'cf-type', error: s.errors.type, hint: editing ? "Can't be changed after creation." : null,
            body: `<select id="cf-type" name="type" class="py-select" ${editing ? 'disabled' : ''}>${options(Store.FIELD_TYPES, s.type)}</select>` })}
          ${field({ label: 'Description', id: 'cf-desc', error: s.errors.description, hint: 'Optional. Shown under the field on the ${noun} form.', body: `<textarea id="cf-desc" name="description" class="py-textarea" rows="2">${esc(s.description)}</textarea>` })}
        </section>
        ${PICK.includes(s.type) ? `<section class="panel pf-card"><h2>Choices</h2><p class="pf-sub">${noun[0].toUpperCase() + noun.slice(1)}s already using a choice keep it after you deactivate it. Choices are never deleted.</p>
          ${s.errors.options ? `<p class="py-field__error">${icon('alert')}${esc(s.errors.options)}</p>` : ''}
          <ul class="cf-opts" id="cf-opts">${optionRows()}</ul>
          <div><button class="py-btn py-btn--secondary" type="button" id="add-opt">${icon('plus')}Add a choice</button></div></section>` : ''}
        <section class="panel pf-card"><h2>Rules</h2>
          ${check('mandatory', 'Required', `A ${noun} can't be saved without an answer.`)}
          ${check('unique', 'Unique', canUnique ? (editing ? "Fixed after creation." : `No two ${noun}s can have the same answer.`) : 'Only text, number, decimal and date fields can be unique.', editing || !canUnique)}
          ${check('sensitive', 'Sensitive', 'Marks the field for field-level access control (arrives later in this step).')}
          ${s.type === 'TEXT' || s.type === 'LONG_TEXT' ? num('maxLength', 'Longest answer (characters)', `Up to ${s.type === 'TEXT' ? 255 : 5000}. Leave empty for the maximum.`) : ''}
          ${NUMERIC.includes(s.type) ? `<div class="pf-row">${num('min', 'Smallest value')}${num('max', 'Largest value')}</div>` : ''}
          ${s.type === 'DECIMAL' ? num('decimals', 'Decimal places', 'Up to 6. Default 2.') : ''}
          ${s.type === 'MULTI_PICKLIST' ? `<div class="pf-row">${num('minSelect', 'Pick at least')}${num('maxSelect', 'Pick at most')}</div>` : ''}
          ${NUMERIC.includes(s.type) ? '<p class="hint">Numbers hold up to 12 digits, so they are stored exactly.</p>' : ''}
        </section>
        <section class="panel pf-card"><h2>Default value</h2><div id="cf-default-region">${defaultRegion()}</div></section>
      </div>
      <aside class="pf-side"><section class="panel pf-card pf-preview"><h2>On the ${noun} form</h2><div id="cf-preview"></div>
        <p class="hint">${editing ? `${def.usage} ${noun}${def.usage === 1 ? '' : 's'} already ${def.usage === 1 ? 'has' : 'have'} an answer.` : 'This is how people will fill it in.'}</p></section></aside></div>
      <div class="pf-bar"><a class="py-btn py-btn--secondary" href="${base(ctx)}">Cancel</a>
        <button class="py-btn py-btn--primary" type="submit" ${s.busy ? 'disabled' : ''}>${s.busy ? `${spinner}Saving` : editing ? 'Save changes' : 'Add field'}</button></div></form></div>`;

    const paintPreview = (el) => {
      const d = draft();
      el.querySelector('#cf-preview').innerHTML = control(d, s.defaultValue, { id: 'cf-pv', disabled: false, people: [{ userId: ctx.me.id, fullName: ctx.me.fullName }] });
      const k = el.querySelector('[data-key]'); if (k && !editing) k.textContent = keyHint();
    };
    const paintDefault = (el) => { el.querySelector('#cf-default-region').innerHTML = defaultRegion(); bindDefault(el); };
    const bindDefault = (el) => {
      const wrap = el.querySelector('#cf-default-region [data-cf]'); if (!wrap) return;
      const d = draft();
      wrap.addEventListener('input', () => { s.defaultValue = s.type === 'CHECKBOX' ? read(d, wrap) : read(d, wrap); paintPreview(el); });
      wrap.addEventListener('change', () => { s.defaultValue = read(draft(), wrap); paintPreview(el); });
    };
    const api = component(el, s, render, (el, a) => {
      el.querySelectorAll('[name="label"],[name="description"]').forEach((n) => n.addEventListener('input', () => { s[n.name] = n.value; paintPreview(el); }));
      el.querySelector('[name="type"]')?.addEventListener('change', (e) => { s.type = e.target.value; s.defaultValue = null; s.config = {}; if (!Store.UNIQUE_TYPES.includes(s.type)) s.unique = false; if (!PICK.includes(s.type)) s.options = []; else if (!s.options.length) s.options = [newOpt()]; a.paint(); });
      el.querySelectorAll('[type="checkbox"][name]').forEach((n) => n.addEventListener('change', () => { s[n.name] = n.checked; if (n.name === 'unique' && n.checked) s.defaultValue = null; if (n.name === 'unique') return a.paint(); paintPreview(el); }));
      el.querySelectorAll('[name^="c:"]').forEach((n) => n.addEventListener('input', () => { s.config[n.name.slice(2)] = n.value; paintPreview(el); }));
      el.querySelectorAll('[data-opt]').forEach((n) => n.addEventListener('input', () => {
        s.options[+n.dataset.opt].label = n.value; paintPreview(el); paintDefault(el);
        if (s.errors.options) { s.errors.options = null; el.querySelector('#cf-opts').previousElementSibling?.remove(); }
      }));
      const mv = (i, d) => { const j = i + d; if (j < 0 || j >= s.options.length || s.options[i].saved || s.options[j].saved) return; [s.options[i], s.options[j]] = [s.options[j], s.options[i]]; a.paint(); };
      el.querySelectorAll('[data-oup]').forEach((b) => b.addEventListener('click', () => mv(+b.dataset.oup, -1)));
      el.querySelectorAll('[data-odown]').forEach((b) => b.addEventListener('click', () => mv(+b.dataset.odown, 1)));
      el.querySelectorAll('[data-otoggle]').forEach((b) => b.addEventListener('click', () => { const o = s.options[+b.dataset.otoggle]; o.active = !o.active; if (!o.active && s.defaultValue === o.id) s.defaultValue = null; a.paint(); }));
      el.querySelectorAll('[data-oremove]').forEach((b) => b.addEventListener('click', () => { s.options.splice(+b.dataset.oremove, 1); a.paint(); }));
      el.querySelector('#add-opt')?.addEventListener('click', () => { s.options.push(newOpt()); a.paint(); el.querySelectorAll('[data-opt]')[s.options.length - 1].focus(); });
      bindDefault(el); paintPreview(el);
      el.querySelector('form').addEventListener('submit', async (ev) => {
        ev.preventDefault(); s.submitted = true; s.error = null; s.errors = {};
        if (!s.label.trim()) s.errors.label = 'Name the field.';
        if (PICK.includes(s.type) && !s.options.some((o) => o.label.trim() && o.active)) s.errors.options = 'Add at least one active choice.';
        if (Object.keys(s.errors).length) { a.paint(); window.scrollTo(0, 0); return PY.focusFirstInvalid(el); }
        a.set({ busy: true });
        const f = { label: s.label, type: s.type, description: s.description, mandatory: s.mandatory, unique: s.unique, sensitive: s.sensitive, defaultValue: s.unique ? null : s.defaultValue, config: s.config,
          options: s.options.filter((o) => o.label.trim()).map((o) => ({ id: o.id, label: o.label, active: o.active })) };
        try {
          if (editing) { await Store.updateCustomField(ctx.portal.id, def.id, f); flash = `${s.label.trim()} updated.`; }
          else { await Store.createCustomField(ctx.portal.id, { ...f, entityType: ctx.entity || 'PROJECT' }); flash = `${s.label.trim()} added. It now shows on the ${noun} form.`; }
          Router.navigate(base(ctx).slice(1));
        } catch (err) {
          s.errors = err.fields || {}; a.set({ busy: false, error: Object.keys(s.errors).length ? null : err.message }); window.scrollTo(0, 0);
        }
      });
      if (!editing && !s.label) el.querySelector('#cf-label').focus();
    });
    return api;
  }

  const frame = (el, inner) => { el.innerHTML = `<div class="users-page projects-page">${inner}</div>`; };
  const create = (el, ctx) => formPage(el, ctx, {});
  async function edit(el, ctx) {
    frame(el, '<p class="py-caption">Loading…</p>');
    try { formPage(el, ctx, { def: await Store.customField(ctx.portal.id, ctx.params.id) }); }
    catch (err) { frame(el, `<section class="panel"><div class="empty" style="padding:40px 18px"><b>Field not found</b><br>${esc(err.message)}<br><br><a class="py-btn py-btn--secondary" href="${base(ctx)}">Back to custom fields</a></div></section>`); }
  }

  return { control, read, display, propsHtml, bindProps, confirmDialog, tab, create, edit };
})();
