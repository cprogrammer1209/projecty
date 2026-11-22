/*
 * M1 · Step 7 · Layouts for projects, Linear style (docs/requirements/07-customization-engine.md: CUS-US-21, 22, 25; CUS-BR-04, 10, 13).
 * Settings → Projects → Layouts: the list, and the layout builder: a document of sections and slim field rows, drag and drop or keyboard
 * (↑ ↓ select, M move, Ctrl+↑ ↓ reorder, O overrides, Del hide), a live preview, and a save bar that appears when there are changes.
 * Edits a draft; nothing is stored until Save changes.
 */
const Layouts = (() => {
  const { ico, chip, head, toast, openPop, closePop, setAct, listNav, dialog, bar, typing, MOD } = LSettings;
  const { esc: E, Router } = PY;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TYPE_LABEL = Object.fromEntries(Store.FIELD_TYPES);
  const PICK = ['PICKLIST', 'MULTI_PICKLIST'];
  const base = (ctx) => `#/p/${ctx.slug}/settings/projects/layouts`;
  const plural = (n, w) => `${n} ${n === 1 ? w : w + 's'}`;

  /* ======================= list ======================= */
  function list(el, ctx) {
    const canManage = ctx.can('CUSTOM_FIELDS_MANAGE'), portalId = ctx.portal.id;
    const s = { items: null, notice: null };
    const draw = () => {
      const items = s.items || [];
      const notice = s.notice ? `<div class="notice ${s.notice.kind}" role="alert"><span>${E(s.notice.text)}</span><button type="button" data-close aria-label="Dismiss">${ico('x', 12)}</button></div>` : '';
      el.innerHTML = head('Layouts', 'Layouts decide which fields appear on the project form, and how they are grouped.', canManage ? `<button class="btn primary" type="button" id="new-layout">${ico('plus')} New layout</button>` : '', 'Projects') + notice +
        `<div class="group" id="llist">${items.map((l) => {
          const main = `<div class="t">${E(l.name)} ${l.isDefault ? chip('Default', 'acc') : ''}${l.active ? '' : chip('Inactive')}</div><div class="d">${E(l.description || 'No description')}</div><div class="m">${plural(l.sectionCount, 'section')} · ${plural(l.fieldCount, 'field')} · Used by ${plural(l.usage, 'project')}</div>`;
          return `<div class="lrow ${l.active ? '' : 'off'}" data-id="${E(l.id)}">${canManage ? `<a class="lmain" href="${base(ctx)}/${E(l.id)}">${main}</a><button class="ibtn more" type="button" data-menu="${E(l.id)}" aria-label="Actions for ${E(l.name)}" aria-haspopup="menu">${ico('more')}</button>` : `<div class="lmain">${main}</div>`}</div>`;
        }).join('') || `<div class="srow"><div class="l muted">${s.items ? 'No layouts.' : 'Loading layouts…'}</div></div>`}</div>
        <p class="foot">${items.length} of ${Store.MAX_LAYOUTS} layouts. Layouts are deactivated, never deleted. A field that isn't in a project's layout is hidden for that project, and its answer is kept.</p>
        ${canManage ? '' : '<p class="foot">Only Admins can add or change layouts.</p>'}`;
      $('#new-layout', el)?.addEventListener('click', () => newDialog());
      $('[data-close]', el)?.addEventListener('click', () => { s.notice = null; draw(); });
      $$('[data-menu]', el).forEach((b) => b.addEventListener('click', () => menu(b)));
    };
    const load = async () => { try { s.items = await Store.layoutsAdmin(portalId); } catch (err) { s.items = s.items || []; s.notice = { text: err.message, kind: 'err' }; } draw(); };
    const run = async (fn, ok) => { s.notice = null; try { await fn(); toast(ok); } catch (err) { s.notice = { text: err.message, kind: 'err' }; } await load(); };
    function menu(btn) {
      const l = s.items.find((x) => x.id === btn.dataset.menu); btn.setAttribute('aria-expanded', 'true');
      const p = openPop(btn, `<div role="menu"><button class="mi" role="menuitem" data-do="edit">${ico('layouts')} Edit</button><button class="mi" role="menuitem" data-do="clone">${ico('templates')} Clone…</button>
        <button class="mi ${l.isDefault || !l.active ? 'soft' : ''}" role="menuitem" data-do="default">${ico('check')} Make default</button>
        <button class="mi ${l.isDefault ? 'soft' : l.active ? 'danger' : ''}" role="menuitem" data-do="toggle">${ico(l.active ? 'x' : 'plus')} ${l.active ? 'Deactivate' : 'Activate'}</button></div>`,
        { kind: 'menu', alignRight: true, onClose: () => btn.removeAttribute('aria-expanded') });
      $('.mi', p).focus();
      p.addEventListener('click', (e) => {
        const a = e.target.closest('[data-do]')?.dataset.do; if (!a) return; closePop();
        if (a === 'edit') Router.navigate(`${base(ctx).slice(1)}/${l.id}`);
        else if (a === 'clone') newDialog(l.id);
        else if (a === 'default') { if (l.isDefault) { s.notice = { text: `${l.name} is already the default layout.`, kind: '' }; draw(); } else run(() => Store.setDefaultLayout(portalId, l.id), 'Default layout changed'); }
        else if (a === 'toggle') run(() => (l.active ? Store.deactivateLayout(portalId, l.id) : Store.activateLayout(portalId, l.id)), l.active ? 'Layout deactivated' : 'Layout activated');
      });
    }
    function newDialog(cloneId = null) {
      const src = cloneId ? s.items.find((l) => l.id === cloneId) : null, ls = s.items;
      dialog(cloneId ? 'Clone layout' : 'New layout', `<label class="fl">Name<input class="in" name="name" autocomplete="off" value="${src ? E('Copy of ' + src.name) : ''}" placeholder="e.g. Client onboarding"></label>
        <fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px"><label class="opt"><input type="radio" name="start" value="blank" ${src ? '' : 'checked'}> Start blank</label>
        <label class="opt"><input type="radio" name="start" value="copy" ${src ? 'checked' : ''}> Start from a copy of <select class="in" name="from" aria-label="Layout to copy">${ls.map((l) => `<option value="${E(l.id)}" ${src && src.id === l.id ? 'selected' : ''}>${E(l.name)}</option>`).join('')}</select></label></fieldset>`,
      cloneId ? 'Clone' : 'Create layout', async (f) => {
        try { const res = await Store.createLayout(portalId, { name: f.name.value, cloneFrom: f.start.value === 'copy' ? f.from.value : null }); toast('Layout created'); Router.navigate(`${base(ctx).slice(1)}/${res.id}`); }
        catch (e) { if (e.code === 'LIMIT') { s.notice = { text: e.message, kind: 'err' }; draw(); return; } return e.message; }
      });
    }
    draw(); load();
  }

  /* ======================= builder ======================= */
  /** A simple preview control (the styles are `.sm-ctl`), for a field as the layout configures it. */
  function pvControl(e) {
    const dis = e.readOnly ? 'disabled' : '', dv = e.defaultValue;
    let c;
    switch (e.type) {
      case 'LONG_TEXT': c = `<textarea rows="3" ${dis}>${E(dv ?? '')}</textarea>`; break;
      case 'NUMBER': case 'DECIMAL': c = `<input type="number" value="${E(dv ?? '')}" ${dis}>`; break;
      case 'DATE': c = `<input type="date" value="${E(dv ?? '')}" ${dis}>`; break;
      case 'CHECKBOX': c = `<label class="sm-check"><input type="checkbox" ${dv === true ? 'checked' : ''} ${dis}> Yes</label>`; break;
      case 'PICKLIST': c = `<select ${dis}><option value="">None</option>${e.options.filter((o) => o.active).map((o) => `<option ${o.id === dv ? 'selected' : ''}>${E(o.label)}</option>`).join('')}</select>`; break;
      case 'MULTI_PICKLIST': c = `<div class="sm-multi">${e.options.filter((o) => o.active).map((o) => `<label class="sm-check"><input type="checkbox" ${dis}> ${E(o.label)}</label>`).join('')}</div>`; break;
      case 'USER': c = `<select ${dis}><option value="">None</option></select>`; break;
      default: c = `<input type="text" value="${E(dv ?? '')}" ${dis}>`;
    }
    return `<div class="sm-ctl"><label class="sm-lab">${E(e.label)}${e.mandatory ? ' <span class="sm-req">*</span>' : ''}${e.readOnly ? ' <span class="sm-ro">read-only</span>' : ''}</label>${c}</div>`;
  }

  function builder(el, ctx, lay) {
    const portalId = ctx.portal.id, WIDE = ['LONG_TEXT', 'MULTI_PICKLIST'];
    const B = { d: { id: lay.id, name: lay.name, description: lay.description, isDefault: lay.isDefault, active: lay.active, usage: lay.usage, sections: lay.sections.map((x) => ({ ...x, fields: x.fields.map((p) => ({ ...p })) })) },
      fields: lay.fields, sel: null, tab: 'fields', q: '', view: 'edit', dev: 'desktop', drag: null };
    B.orig = JSON.stringify(B.d);
    const F = (k) => B.fields.find((f) => f.apiName === k);
    const dirty = () => JSON.stringify(B.d) !== B.orig;
    const newId = () => 's' + Math.random().toString(36).slice(2, 9);
    const DEVICES = [['desktop', 'Desktop', 1040], ['tablet', 'Tablet', 640], ['phone', 'Phone', 360]];

    /* --- the draft --- */
    const find = (k) => { for (const sec of B.d.sections) { const i = sec.fields.findIndex((p) => p.apiName === k); if (i >= 0) return { section: sec, index: i, placement: sec.fields[i] }; } return null; };
    const unplaced = () => B.fields.filter((f) => !find(f.apiName));
    function move(k, to, before = null) {
      const at = find(k), p = at ? at.section.fields.splice(at.index, 1)[0] : { apiName: k, mandatory: null, readOnly: false, defaultValue: null, wide: null };
      if (to === 'unplaced') return;
      const sec = B.d.sections.find((x) => x.id === to), i = before ? sec.fields.findIndex((x) => x.apiName === before) : -1;
      if (i >= 0) sec.fields.splice(i, 0, p); else sec.fields.push(p);
    }
    const shiftField = (k, d) => { const at = find(k), j = at.index + d; if (j >= 0 && j < at.section.fields.length) [at.section.fields[at.index], at.section.fields[j]] = [at.section.fields[j], at.section.fields[at.index]]; };
    const isWide = (k) => find(k)?.placement.wide ?? WIDE.includes(F(k).type);
    const effective = (k) => { const p = find(k)?.placement || {}, f = F(k); return { ...f, mandatory: p.mandatory ?? f.mandatory, readOnly: !!p.readOnly, defaultValue: p.defaultValue ?? f.defaultValue }; };
    const problem = () => {
      if (!B.d.name.trim()) return 'Name the layout.';
      const names = new Set();
      for (const s of B.d.sections) { const n = s.name.trim().toLowerCase(); if (!n) return 'Every section needs a name.'; if (names.has(n)) return `Two sections are called "${s.name.trim()}".`; names.add(n); }
      return null;
    };
    const defaultLabel = (f, v) => (f.type === 'PICKLIST' ? f.options.find((o) => o.id === v)?.label ?? v : f.type === 'CHECKBOX' ? 'Checked' : v);

    /* --- canvas --- */
    /** A grey sketch of the control, so the canvas reads like the form. */
    const sketch = (f) => ({ LONG_TEXT: '<i class="sk tall"></i>', CHECKBOX: '<i class="sk box"></i>', MULTI_PICKLIST: '<span class="sk-row"><i class="sk pill"></i><i class="sk pill"></i><i class="sk pill"></i></span>', DATE: '<i class="sk"></i>', PICKLIST: '<i class="sk sel"></i>', USER: '<i class="sk sel"></i>' }[f.type] || '<i class="sk"></i>');
    const cardHTML = (key) => {
      const f = F(key), at = find(key), e = effective(key); let c = '';
      if (at) {
        const p = at.placement;
        if (p.mandatory === true) c += chip('Required here', 'acc'); else if (p.mandatory === false && f.mandatory) c += chip('Optional here', 'acc');
        if (p.readOnly) c += chip('Read-only', 'acc');
        if (p.defaultValue != null && p.defaultValue !== '') c += chip('Default: ' + defaultLabel(f, p.defaultValue), 'acc');
      }
      if (f.status !== 'ACTIVE') c += chip('Inactive', 'warn');
      const wide = isWide(key);
      return `<div class="fcard ${wide ? 'wide' : ''} ${B.sel === key ? 'sel' : ''} ${f.status !== 'ACTIVE' ? 'inactive' : ''}" role="listitem" data-act="card" data-key="${E(key)}" draggable="true" tabindex="${B.sel === key ? 0 : -1}">
        <div class="fc-h"><span class="grip" aria-hidden="true">${ico('grip', 12)}</span><span class="fc-label">${E(f.label)}${e.mandatory ? ' <b class="req">*</b>' : ''}</span><span class="fc-type">${E(TYPE_LABEL[f.type])}</span>
          <span class="fc-tools"><button class="ibtn" type="button" data-act="fc-width" data-key="${E(key)}" aria-label="${wide ? 'Make half width' : 'Make full width'}" title="${wide ? 'Full width: click for half' : 'Half width: click for full'}">${ico(wide ? 'shrink' : 'expand')}</button><button class="ibtn" type="button" data-act="fc-settings" data-key="${E(key)}" aria-label="Settings for ${E(f.label)}" title="Settings (O)">${ico('prefs')}</button><button class="ibtn" type="button" data-act="fc-hide" data-key="${E(key)}" aria-label="Remove ${E(f.label)} from the layout" title="Remove from layout (Del)">${ico('x')}</button></span></div>
        <div class="fc-body">${sketch(f)}</div>${c ? `<div class="chips">${c}</div>` : ''}</div>`;
    };
    const sectionHTML = (s, i) => `<section class="cv-sec" data-sec="${E(s.id)}" aria-label="Section ${E(s.name)}">
        <div class="cv-sec-h"><input class="sec-name" value="${E(s.name)}" placeholder="Section name" aria-label="Section name">
          <label class="sw"><input type="checkbox" class="sec-coll" ${s.collapsible ? 'checked' : ''}> Collapsible</label><span class="cnt">${plural(s.fields.length, 'field')}</span>
          <span class="sec-tools"><button class="ibtn" type="button" data-act="sec-up" aria-label="Move section up" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>${ico('up')}</button><button class="ibtn" type="button" data-act="sec-down" aria-label="Move section down" ${i === B.d.sections.length - 1 ? 'disabled style="opacity:.3"' : ''}>${ico('down')}</button><button class="ibtn" type="button" data-act="sec-del" aria-label="Delete section" ${B.d.sections.length === 1 ? 'disabled style="opacity:.3"' : ''}>${ico('trash')}</button></span></div>
        <div class="cv-grid" role="list" data-drop="${E(s.id)}">${s.fields.map((p) => cardHTML(p.apiName)).join('') || '<div class="cv-empty">Drop a field here</div>'}</div></section>`;
    const canvasHTML = () => `${B.d.sections.map(sectionHTML).join('')}<button class="cv-add" type="button" data-act="b-add-section">${ico('plus')} Add a section</button>
      <p class="cv-note">The canvas shows two columns. On the real form, a section shows as many columns as fit the screen; a half-width field takes one, a full-width field takes the whole row.</p>`;
    const previewHTML = () => {
      const w = DEVICES.find((d) => d[0] === B.dev)[2];
      return `<div class="cv-device" style="max-width:${w}px">${B.d.sections.map((s) => {
        const items = s.fields.filter((p) => F(p.apiName).status === 'ACTIVE').map((p) => `<div class="cf-item${isWide(p.apiName) ? ' wide' : ''}">${pvControl(effective(p.apiName))}</div>`).join('');
        return `<section class="cv-pv-sec"><h3>${E(s.name || 'Untitled section')}</h3>${items ? `<div class="cf-grid">${items}</div>` : '<p class="pv-empty">No fields</p>'}</section>`;
      }).join('')}</div>`;
    };

    /* --- the side panel: palette of unplaced fields, or the inspector for the selected field --- */
    const defControl = (f, p) => {
      if (f.unique) return '<p class="muted" style="font-size:12px">Unique fields cannot have a default value.</p>';
      if (f.type === 'USER' || f.type === 'MULTI_PICKLIST') return '<p class="muted" style="font-size:12px">This field type cannot have a default value.</p>';
      let c;
      if (f.type === 'CHECKBOX') c = `<label class="sw"><input type="checkbox" name="def" ${p.defaultValue === true ? 'checked' : ''}> Checked by default</label>`;
      else if (f.type === 'PICKLIST') c = `<select class="in" name="def" aria-label="Default value"><option value="">None</option>${f.options.filter((o) => o.active).map((o) => `<option value="${E(o.id)}" ${o.id === p.defaultValue ? 'selected' : ''}>${E(o.label)}</option>`).join('')}</select>`;
      else c = `<input class="in" name="def" type="${f.type === 'DATE' ? 'date' : ['NUMBER', 'DECIMAL'].includes(f.type) ? 'number' : 'text'}" ${f.type === 'DECIMAL' ? 'step="any"' : ''} value="${E(p.defaultValue ?? '')}" aria-label="Default value" placeholder="No default">`;
      return `<label class="k">Default value</label>${c}`;
    };
    const inspectorHTML = () => {
      const at = find(B.sel), f = F(B.sel), p = at.placement;
      const mand = p.mandatory === true ? 'true' : p.mandatory === false ? 'false' : '';
      const dest = B.d.sections.filter((s) => s.id !== at.section.id);
      return `<div class="ins" data-ins><div class="ins-h"><div><b>${E(f.label)}</b><span class="muted">${E(TYPE_LABEL[f.type])} · in ${E(at.section.name || 'Untitled section')}</span></div></div>
        <p class="muted" style="font-size:12px;margin:0 0 4px">These settings apply to this layout only.</p>
        <label class="k">Required</label><div class="seg" role="radiogroup" aria-label="Required"><label><input type="radio" name="req" value="" ${mand === '' ? 'checked' : ''}>Same as field (${f.mandatory ? 'required' : 'optional'})</label><label><input type="radio" name="req" value="true" ${mand === 'true' ? 'checked' : ''}>Required here</label><label><input type="radio" name="req" value="false" ${mand === 'false' ? 'checked' : ''}>Optional here</label></div>
        <label class="k">Width</label><div class="seg" role="radiogroup" aria-label="Width"><label><input type="radio" name="width" value="half" ${!isWide(B.sel) ? 'checked' : ''}>Half (one column)</label><label><input type="radio" name="width" value="full" ${isWide(B.sel) ? 'checked' : ''}>Full (whole row)</label></div>
        <label class="sw" style="justify-content:space-between;color:var(--tx2)">Read-only<input type="checkbox" name="ro" ${p.readOnly ? 'checked' : ''}></label>
        ${defControl(f, p)}
        <label class="k">Section</label><select class="in" name="sec" aria-label="Move to section"><option value="${E(at.section.id)}" selected>${E(at.section.name || 'Untitled section')}</option>${dest.map((s) => `<option value="${E(s.id)}">${E(s.name || 'Untitled section')}</option>`).join('')}</select>
        <button class="btn" type="button" data-act="fc-hide" data-key="${E(B.sel)}" style="margin-top:6px">${ico('x')} Remove from layout</button></div>`;
    };
    const paletteHTML = () => {
      const q = B.q.trim().toLowerCase(), list = unplaced().filter((f) => f.label.toLowerCase().includes(q));
      return `<div class="pal-side"><div class="ins-h" style="margin-bottom:8px"><div><b>Fields not on this layout</b><span class="muted">Drag one onto the canvas, or press +. Their answers are kept.</span></div></div>
        <input class="in" data-pq placeholder="Search fields…" aria-label="Search fields" value="${E(B.q)}" autocomplete="off">
        <div class="pcards" role="list" data-drop="unplaced">${list.map((f) => `<div class="pcard ${f.status !== 'ACTIVE' ? 'inactive' : ''}" role="listitem" draggable="true" data-key="${E(f.apiName)}"><span class="grip" aria-hidden="true">${ico('grip', 12)}</span><span class="pc-main"><b>${E(f.label)}</b><small>${E(TYPE_LABEL[f.type])}${f.status !== 'ACTIVE' ? ' · inactive' : ''}</small></span><button class="ibtn" type="button" data-act="pc-add" data-key="${E(f.apiName)}" aria-label="Add ${E(f.label)} to the last section" title="Add to the last section">${ico('plus')}</button></div>`).join('') || `<div class="cv-empty">${B.q ? 'No match.' : 'Every field is on this layout.'}</div>`}</div>
        ${ctx.can('CUSTOM_FIELDS_MANAGE') ? `<button class="btn" type="button" data-act="b-new-field" style="margin-top:10px">${ico('plus')} New field</button>` : ''}</div>`;
    };
    const typesHTML = () => `<div class="pal-side"><div class="ins-h" style="margin-bottom:8px"><div><b>Create a field</b><span class="muted">Drag a type onto a section. You will name it, and it is created and placed there.</span></div></div>
      <div class="pcards" role="list">${Store.FIELD_TYPES.map(([id, l]) => `<div class="pcard tcard" role="listitem" draggable="true" data-newtype="${E(id)}"><span class="grip" aria-hidden="true">${ico('grip', 12)}</span><span class="pc-main"><b>${E(l)}</b></span><button class="ibtn" type="button" data-act="type-add" data-type="${E(id)}" aria-label="Create a ${E(l)} field" title="Create a ${E(l)} field">${ico('plus')}</button></div>`).join('')}</div></div>`;
    const tabsHTML = () => `<div class="segc side-tabs" role="tablist" aria-label="Side panel">${[['fields', `Fields (${unplaced().length})`], ['types', 'New'], ['field', 'Settings']].map(([id, l]) => `<button type="button" role="tab" data-act="side-tab" data-v="${id}" aria-selected="${B.tab === id}">${l}</button>`).join('')}</div>`;
    const sideHTML = () => tabsHTML() + (B.tab === 'field' ? (B.sel && find(B.sel) ? inspectorHTML() : '<p class="muted side-empty">Select a field on the canvas to change its settings. Double-click a field, or press O.</p>') : B.tab === 'types' ? typesHTML() : paletteHTML());

    /* --- whole builder --- */
    const builderInner = () => {
      const d = B.d;
      return `<div class="cv-top"><div class="cv-title"><div class="btop"><span id="crumb"><a href="${base(ctx)}">Layouts</a> / ${E(d.name || 'Untitled')}</span></div>
          <input class="btitle" value="${E(d.name)}" placeholder="Layout name" aria-label="Layout name"><div class="bmeta">${d.isDefault ? chip('Default', 'acc') : ''}${d.active ? '' : chip('Inactive')}${chip('Used by ' + plural(d.usage, 'project'))}</div></div>
        <div class="cv-modes">${B.view === 'edit' && ctx.can('CUSTOM_FIELDS_MANAGE') ? `<button class="btn" type="button" data-act="b-new-field" id="top-new-field">${ico('plus')} New field</button>` : ''}<div class="segc" role="tablist" aria-label="View"><button type="button" role="tab" data-act="view" data-v="edit" aria-selected="${B.view === 'edit'}">Edit</button><button type="button" role="tab" data-act="view" data-v="preview" aria-selected="${B.view === 'preview'}">Preview</button></div>
          ${B.view === 'preview' ? `<div class="segc" role="group" aria-label="Screen width">${DEVICES.map(([id, l]) => `<button type="button" data-act="dev" data-v="${id}" aria-pressed="${B.dev === id}">${l}</button>`).join('')}</div>` : ''}</div></div>
        <div id="problem" role="alert" hidden></div>
        <div class="cv-main ${B.view === 'preview' ? 'is-preview' : ''}"><div class="cv-canvas" id="canvas">${B.view === 'preview' ? previewHTML() : canvasHTML()}</div>
          ${B.view === 'preview' ? '' : `<aside class="cv-side" id="side" aria-label="Fields and settings">${sideHTML()}</aside>`}</div>
        <div class="hints" aria-label="Keyboard shortcuts"><span><kbd>↑</kbd><kbd>↓</kbd><em>select</em></span><span><kbd>M</kbd><em>move to…</em></span><span><kbd>${MOD}</kbd><kbd>↑</kbd><kbd>↓</kbd><em>reorder</em></span><span><kbd>W</kbd><em>half or full width</em></span><span><kbd>O</kbd><em>settings</em></span><span><kbd>Del</kbd><em>remove</em></span></div>`;
    };
    function refreshAux() {
      if (!$('#problem', el)) return;
      const pr = problem(), pe = $('#problem', el);
      pe.hidden = !pr; pe.textContent = pr || '';
      bar.show(dirty(), !!pr);
      const c = $('#crumb', el); if (c) c.innerHTML = `<a href="${base(ctx)}">Layouts</a> / ${E(B.d.name || 'Untitled')}`;
      $$('.cv-sec[data-sec]', el).forEach((n) => { const s = B.d.sections.find((x) => x.id === n.dataset.sec); if (s) $('.cnt', n).textContent = plural(s.fields.length, 'field'); });
    }
    const rb = (focus = true) => { $('#bwrap', el).innerHTML = builderInner(); refreshAux(); if (focus && B.sel && B.view === 'edit') focusSel(); };
    const repaintSide = () => { const s = $('#side', el); if (s) s.innerHTML = sideHTML(); };
    const cardEl = (k) => $$('.fcard', el).find((r) => r.dataset.key === k);
    function focusSel() { const r = cardEl(B.sel); if (r) { r.focus({ preventScroll: true }); r.scrollIntoView({ block: 'nearest' }); } }
    function select(key, { focus = true } = {}) {
      B.sel = key;
      $$('.fcard', el).forEach((r) => { const on = r.dataset.key === key; r.classList.toggle('sel', on); r.tabIndex = on ? 0 : -1; });
      if (B.tab === 'field') repaintSide(); if (focus) focusSel();
    }
    const swapCard = (k) => { const r = cardEl(k); if (r) { const w = document.createElement('div'); w.innerHTML = cardHTML(k); r.replaceWith(w.firstElementChild); } };

    /* --- popovers and dialogs --- */
    function openMove(key) {
      const f = F(key), at = find(key), cur = at ? at.section.id : 'unplaced';
      const opts = [...B.d.sections.map((s) => ({ id: s.id, label: s.name || 'Untitled section' })), { id: 'unplaced', label: 'Not on this layout' }];
      const p = openPop(cardEl(key) || el, `<div class="pop-h">Move “${E(f.label)}” to…</div><input class="in" placeholder="Search sections…" aria-label="Search sections" autocomplete="off"><ul role="listbox" aria-label="Sections">${opts.map((o) =>
        `<li role="option" data-to="${E(o.id)}" data-label="${E(o.label.toLowerCase())}">${ico(o.id === 'unplaced' ? 'eye' : 'layouts')}<span>${E(o.label)}</span>${o.id === cur ? '<span class="cur">current</span>' : ''}</li>`).join('')}</ul>`, { kind: 'move', offset: 28 });
      const q = $('input', p), ul = $('ul', p);
      q.addEventListener('input', () => { const v = q.value.toLowerCase(); $$('li', ul).forEach((li) => { li.hidden = !li.dataset.label.includes(v); }); setAct(ul, 0); });
      const pick = (li) => {
        const to = li.dataset.to; closePop();
        if ((at ? at.section.id : 'unplaced') !== to) { move(key, to); B.sel = key; if (to === 'unplaced') B.tab = 'fields'; rb(); toast(`Moved to ${to === 'unplaced' ? 'the field list' : B.d.sections.find((x) => x.id === to).name}`); }
      };
      listNav(q, ul, pick); ul.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) pick(li); });
      q.focus();
    }
    function newFieldDialog({ type = null, to = null, before = null } = {}) {
      const d = dialog('New field', `<label class="fl">Label<input class="in" name="label" autocomplete="off" placeholder="e.g. Region"></label>
        <label class="fl">Type<select class="in" name="type">${Store.FIELD_TYPES.map(([v, l]) => `<option value="${v}">${E(l)}</option>`).join('')}</select></label>
        <label class="fl opts" hidden>Choices, one per line<textarea class="in" name="opts" rows="3" placeholder="Low&#10;Medium&#10;High"></textarea></label>
        <label class="opt"><input type="checkbox" name="req"> Required by default</label>`, 'Create field', async (f) => {
        const choices = PICK.includes(f.type.value) ? f.opts.value.split('\n').map((x) => x.trim()).filter(Boolean).map((label) => ({ label, active: true })) : [];
        try {
          const wasDirty = dirty();
          const res = await Store.createCustomField(portalId, { label: f.label.value, type: f.type.value, description: '', mandatory: f.req.checked, unique: false, sensitive: false, defaultValue: null, config: {}, options: choices });
          const nf = await Store.customField(portalId, res.id); B.fields.push(nf);
          if (B.d.isDefault) { B.d.sections[B.d.sections.length - 1].fields.push({ apiName: nf.apiName, mandatory: null, readOnly: false, defaultValue: null, wide: null }); if (!wasDirty) B.orig = JSON.stringify(B.d); } // a new field lands in the default layout
          if (to) move(nf.apiName, to, before); // dropped on a section: place it there
          B.sel = nf.apiName; if (!find(nf.apiName)) B.tab = 'fields'; rb(false); toast(find(nf.apiName) ? 'Field created and added to this layout.' : 'Field created. Drag it onto the canvas.');
        } catch (e) { return e.message; }
      });
      const sel = $('select[name=type]', d); if (type) sel.value = type;
      const toggle = () => { $('.opts', d).hidden = !PICK.includes(sel.value); }; sel.addEventListener('change', toggle); toggle();
    }

    /* --- actions --- */
    const secOf = (n) => n.closest('[data-sec]').dataset.sec;
    function secMove(t, delta) {
      const id = secOf(t), i = B.d.sections.findIndex((s) => s.id === id), j = i + delta;
      if (j >= 0 && j < B.d.sections.length) [B.d.sections[i], B.d.sections[j]] = [B.d.sections[j], B.d.sections[i]];
      rb(false); const b = $(`[data-sec="${id}"] [data-act="${delta < 0 ? 'sec-up' : 'sec-down'}"]`, el); if (b && !b.disabled) b.focus();
    }
    function toggleWidth(k) { const at = find(k); if (!at) return; at.placement.wide = !isWide(k); swapCard(k); if (B.tab === 'field' && B.sel === k) repaintSide(); refreshAux(); }
    function hide(k) { if (!find(k)) return; move(k, 'unplaced'); if (B.sel === k) B.tab = 'fields'; rb(false); toast('Removed from the layout. Its answers are kept.'); }
    const acts = {
      card: (t) => select(t.dataset.key, { focus: false }),
      'fc-settings': (t) => { select(t.dataset.key, { focus: false }); B.tab = 'field'; repaintSide(); },
      'side-tab': (t) => { B.tab = t.dataset.v; repaintSide(); },
      'type-add': (t) => newFieldDialog({ type: t.dataset.type }),
      'fc-width': (t) => toggleWidth(t.dataset.key),
      'fc-hide': (t) => hide(t.dataset.key),
      'pc-add': (t) => { const k = t.dataset.key; move(k, B.d.sections[B.d.sections.length - 1].id); B.sel = k; rb(false); toast(`Added to ${B.d.sections[B.d.sections.length - 1].name || 'the last section'}`); },
      'sec-up': (t) => secMove(t, -1), 'sec-down': (t) => secMove(t, 1),
      'sec-del': (t) => {
        if (B.d.sections.length === 1) return toast('A layout needs at least one section.', 'err');
        const id = secOf(t), n = B.d.sections.find((x) => x.id === id).fields.length;
        B.d.sections = B.d.sections.filter((x) => x.id !== id); rb(false); if (n) toast(`${plural(n, 'field')} removed from the layout`);
      },
      'b-add-section': () => { const s = { id: newId(), name: '', collapsible: true, fields: [] }; B.d.sections.push(s); rb(false); const n = $(`[data-sec="${s.id}"] .sec-name`, el); n.focus(); n.scrollIntoView({ block: 'center' }); },
      'b-new-field': () => newFieldDialog(),
      view: (t) => { B.view = t.dataset.v; rb(false); },
      dev: (t) => { B.dev = t.dataset.v; rb(false); },
    };
    el.addEventListener('click', (e) => { const t = e.target.closest('[data-act]'); if (t && acts[t.dataset.act]) acts[t.dataset.act](t, e); });
    el.addEventListener('dblclick', (e) => { const c = e.target.closest('.fcard'); if (c && !e.target.closest('button, input')) { select(c.dataset.key, { focus: false }); B.tab = 'field'; repaintSide(); } });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.classList.contains('sec-coll')) { B.d.sections.find((s) => s.id === secOf(t)).collapsible = t.checked; refreshAux(); return; }
      const ins = t.closest('[data-ins]'); if (!ins || !B.sel) return;
      const at = find(B.sel), p = at.placement;
      if (t.name === 'req') p.mandatory = t.value === '' ? null : t.value === 'true';
      else if (t.name === 'ro') p.readOnly = t.checked;
      else if (t.name === 'width') p.wide = t.value === 'full';
      else if (t.name === 'def') { const v = t.type === 'checkbox' ? (t.checked ? true : null) : t.value; p.defaultValue = v === '' ? null : v; }
      else if (t.name === 'sec') { move(B.sel, t.value); rb(); return; }
      swapCard(B.sel); if (t.name === 'width') repaintSide(); refreshAux();
    });
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.classList.contains('btitle')) { B.d.name = t.value; refreshAux(); }
      else if (t.classList.contains('sec-name')) { B.d.sections.find((s) => s.id === secOf(t)).name = t.value; refreshAux(); }
      else if (t.matches('[data-pq]')) { B.q = t.value; const pos = t.selectionStart; repaintSide(); const n = $('[data-pq]', el); n.focus(); n.setSelectionRange(pos, pos); }
      else if (t.name === 'def' && t.closest('[data-ins]')) { find(B.sel).placement.defaultValue = t.value === '' ? null : t.value; swapCard(B.sel); }
    });

    /* --- save bar --- */
    const barEl = document.querySelector('.lset #bar');
    $('#savebtn', barEl).onclick = async () => {
      const pr = problem(); if (pr) return toast(pr, 'err');
      try { await Store.updateLayout(portalId, B.d.id, { name: B.d.name, description: B.d.description, sections: B.d.sections }); B.orig = JSON.stringify(B.d); refreshAux(); toast('Layout saved'); }
      catch (err) { toast(err.message, 'err'); }
    };
    $('#discardbtn', barEl).onclick = async () => {
      const fresh = await Store.layout(portalId, B.d.id); B.fields = fresh.fields;
      B.d = { id: fresh.id, name: fresh.name, description: fresh.description, isDefault: fresh.isDefault, active: fresh.active, usage: fresh.usage, sections: fresh.sections.map((x) => ({ ...x, fields: x.fields.map((p) => ({ ...p })) })) };
      B.orig = JSON.stringify(B.d); B.sel = null; B.tab = 'fields'; rb(false); toast('Changes discarded');
    };
    // Leaving with unsaved changes asks first (the Angular app does the same with a route guard).
    PY.Router.leaveGuard = () => !dirty() || window.confirm('You have unsaved changes. Leave without saving?');

    /* --- drag and drop: a card dropped on a section lands before or after the card under the pointer, or at the end; on the field list it is removed --- */
    const clearMarks = () => $$('.over,.ins-before,.ins-after,.dragging', el).forEach((x) => x.classList.remove('over', 'ins-before', 'ins-after', 'dragging'));
    const dropTarget = (e) => {
      const z = e.target.closest('[data-drop]'); if (!z) return null;
      const c = e.target.closest('.fcard'); let before = null, mark = null;
      if (c && c.dataset.key !== B.drag && z.dataset.drop !== 'unplaced') {
        const b = c.getBoundingClientRect(), after = c.classList.contains('wide') ? e.clientY > b.top + b.height / 2 : e.clientX > b.left + b.width / 2;
        const cards = $$('.fcard', z).filter((x) => x.dataset.key !== B.drag), i = cards.indexOf(c);
        before = after ? (cards[i + 1] ? cards[i + 1].dataset.key : null) : c.dataset.key; mark = [c, after ? 'ins-after' : 'ins-before'];
      }
      return { z, before, mark, over: c && c.dataset.key === B.drag };
    };
    el.addEventListener('dragstart', (e) => {
      const r = e.target.closest?.('.fcard, .pcard'); if (!r) return;
      B.drag = r.dataset.newtype ? '__new:' + r.dataset.newtype : r.dataset.key; e.dataTransfer.setData('text/plain', B.drag); e.dataTransfer.effectAllowed = 'move'; r.classList.add('dragging');
    });
    el.addEventListener('dragover', (e) => {
      if (!B.drag) return; const t = dropTarget(e); if (!t) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      $$('.over,.ins-before,.ins-after', el).forEach((x) => x.classList.remove('over', 'ins-before', 'ins-after')); t.z.classList.add('over'); if (t.mark) t.mark[0].classList.add(t.mark[1]);
    });
    el.addEventListener('drop', (e) => {
      if (!B.drag) return; const t = dropTarget(e); if (!t) return; e.preventDefault();
      const key = B.drag; B.drag = null; clearMarks(); if (t.over) return;
      if (key.startsWith('__new:')) { if (t.z.dataset.drop !== 'unplaced') newFieldDialog({ type: key.slice(6), to: t.z.dataset.drop, before: t.before }); return; }
      const to = t.z.dataset.drop; move(key, to, t.before); B.sel = key; rb(false);
      if (to !== 'unplaced') select(key, { focus: false });
    });
    el.addEventListener('dragend', () => { B.drag = null; clearMarks(); });

    /* --- keyboard --- */
    LSettings.setKeys((e) => {
      const mod = e.metaKey || e.ctrlKey, k = e.key;
      if (k === 'Escape') { if (typing(e.target)) { e.target.blur(); if (B.sel) focusSel(); } return; }
      if (typing(e.target) || B.view !== 'edit') return;
      if (LSettings.isPopOpen()) return;
      const cards = $$('.fcard', el);
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowRight' || k === 'ArrowLeft') {
        e.preventDefault(); if (!cards.length) return; const d = k === 'ArrowDown' || k === 'ArrowRight' ? 1 : -1, i = cards.findIndex((r) => r.dataset.key === B.sel);
        if (mod) { if (B.sel && find(B.sel)) { shiftField(B.sel, d); rb(); } return; }
        select(cards[i < 0 ? (d > 0 ? 0 : cards.length - 1) : Math.min(cards.length - 1, Math.max(0, i + d))].dataset.key);
        return;
      }
      if (!B.sel || mod || e.altKey) return;
      if (k === 'm' || k === 'M') { e.preventDefault(); openMove(B.sel); }
      else if (k === 'w' || k === 'W') { e.preventDefault(); toggleWidth(B.sel); }
      else if (k === 'o' || k === 'O' || k === 'Enter') { if (e.target.closest?.('button') && k === 'Enter') return; e.preventDefault(); B.tab = 'field'; repaintSide(); const f = $('[data-ins] input, [data-ins] select', el); if (f) f.focus(); }
      else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); hide(B.sel); }
    });

    el.innerHTML = `<div class="builder cvb" id="bwrap">${builderInner()}</div>`;
    refreshAux();
  }

  async function edit(el, ctx) {
    el.innerHTML = '<p class="muted">Loading layout…</p>';
    try { builder(el, ctx, await Store.layout(ctx.portal.id, ctx.params.id)); }
    catch (err) { el.innerHTML = head('Layout not found', E(err.message)) + `<a class="btn" href="${base(ctx)}">Back to layouts</a>`; }
  }

  return { list, edit };
})();
