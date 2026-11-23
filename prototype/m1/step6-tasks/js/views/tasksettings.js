/*
 * M1 · Step 6 · Settings → Tasks → Statuses (docs/requirements/06-tasks.md TSK-BR-04, 07-customization-engine.md).
 * Every task layout owns its statuses. A status is Open or Closed; exactly one Open status is the default for new tasks;
 * a layout keeps at least one Open and one Closed status; a status that tasks use can't be deleted.
 * Fields and Layouts for tasks reuse CustomFields.* and Layouts.* with ctx.entity = 'TASK'.
 */
const TaskSettings = (() => {
  const { esc: E } = PY;
  const { ico, chip, head, openPop, closePop, toast } = LSettings;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hex = (key) => (Store.STATUS_COLORS.find(([k]) => k === key) || Store.STATUS_COLORS[0])[2];

  function statuses(el, ctx) {
    const canManage = ctx.can('CUSTOM_FIELDS_MANAGE'), portalId = ctx.portal.id;
    const s = { layouts: null, layoutId: null, items: null, notice: null, editing: null, newName: '', newType: 'OPEN' };
    const layout = () => (s.layouts || []).find((l) => l.id === s.layoutId);
    const draw = () => {
      const items = s.items || [], lay = layout();
      const notice = s.notice ? `<div class="notice ${s.notice.kind}" role="${s.notice.kind === 'err' ? 'alert' : 'status'}" id="ts-notice"><span>${E(s.notice.text)}</span><button type="button" data-close aria-label="Dismiss">${ico('x', 12)}</button></div>` : '';
      el.innerHTML = `<div class="ts-page">
        <div class="ts-bar"><label class="fl-inline">Task layout <select class="in" id="ts-layout" aria-label="Task layout">${(s.layouts || []).map((l) => `<option value="${E(l.id)}" ${l.id === s.layoutId ? 'selected' : ''}>${E(l.name)}${l.isDefault ? ' (default)' : ''}</option>`).join('')}</select></label>
          <span class="muted">${lay ? E(lay.description || '') : ''}</span></div>
        ${notice}
        <div class="group" id="ts-list" role="list" aria-label="Statuses of ${E(lay?.name || '')}">${items.map((x, i) => `<div class="strow" role="listitem" data-id="${E(x.id)}" data-name="${E(x.name)}">
          ${canManage ? `<span class="so"><button class="ibtn" type="button" data-up="${E(x.id)}" aria-label="Move ${E(x.name)} up" ${i === 0 ? 'disabled' : ''}>${ico('up')}</button><button class="ibtn" type="button" data-down="${E(x.id)}" aria-label="Move ${E(x.name)} down" ${i === items.length - 1 ? 'disabled' : ''}>${ico('down')}</button></span>` : ''}
          ${canManage ? `<button class="dotbtn" type="button" data-color="${E(x.id)}" aria-label="Colour of ${E(x.name)}" aria-haspopup="menu"><span class="dot" style="background:${hex(x.color)}"></span></button>` : `<span class="dot" style="background:${hex(x.color)}"></span>`}
          <div class="sn">${s.editing === x.id ? `<input class="in" data-rename-input value="${E(x.name)}" maxlength="30" aria-label="Status name">` : canManage ? `<button class="namebtn" type="button" data-rename="${E(x.id)}" title="Click to rename">${E(x.name)}</button>` : `<b>${E(x.name)}</b>`}
            ${x.isDefault ? chip('Default', 'acc') : ''}<span class="muted use">${x.usage ? `${x.usage} task${x.usage === 1 ? '' : 's'}` : 'Not used'}</span></div>
          <div class="sr">${canManage ? `<select class="in" data-type="${E(x.id)}" aria-label="Type of ${E(x.name)}"><option value="OPEN" ${x.type === 'OPEN' ? 'selected' : ''}>Open</option><option value="CLOSED" ${x.type === 'CLOSED' ? 'selected' : ''}>Closed</option></select>` : chip(x.type === 'OPEN' ? 'Open' : 'Closed')}
            ${canManage && !x.isDefault && x.type === 'OPEN' ? `<button class="btn ghost" type="button" data-default="${E(x.id)}">Make default</button>` : ''}
            ${canManage ? `<button class="ibtn" type="button" data-del="${E(x.id)}" aria-label="Delete ${E(x.name)}" title="${x.usage ? 'In use: move its tasks first' : 'Delete'}">${ico('trash')}</button>` : ''}</div></div>`).join('') || `<div class="srow"><div class="l muted">${s.items ? 'No statuses.' : 'Loading statuses…'}</div></div>`}
          ${canManage && s.items ? `<form class="strow add" id="ts-add" novalidate><input class="in" name="name" placeholder="New status name" aria-label="New status name" maxlength="30" autocomplete="off" value="${E(s.newName)}">
            <select class="in" name="type" aria-label="Type of the new status"><option value="OPEN" ${s.newType === 'OPEN' ? 'selected' : ''}>Open</option><option value="CLOSED" ${s.newType === 'CLOSED' ? 'selected' : ''}>Closed</option></select>
            <button class="btn primary" type="submit">${ico('plus')} Add status</button></form>` : ''}</div>
        <p class="foot">${items.length} of ${Store.MAX_STATUSES} statuses. An <b>Open</b> status means the task is still being worked on; moving a task to a <b>Closed</b> status marks it complete (100%). New tasks start in the default status. A status that tasks use can't be deleted. ${canManage ? '' : 'Only Admins can change statuses.'}</p></div>`;
      bind();
    };
    const loadStatuses = async () => { try { s.items = await Store.layoutStatuses(portalId, s.layoutId); } catch (err) { s.items = s.items || []; s.notice = { text: err.message, kind: 'err' }; } draw(); };
    const run = async (fn, ok) => { s.notice = null; try { await fn(); if (ok) toast(ok); } catch (err) { s.notice = { text: err.message, kind: 'err' }; } await loadStatuses(); };
    function bind() {
      $('[data-close]', el)?.addEventListener('click', () => { s.notice = null; draw(); });
      $('#ts-layout', el)?.addEventListener('change', (e) => { s.layoutId = e.target.value; s.items = null; s.notice = null; s.editing = null; draw(); loadStatuses(); });
      $$('[data-up]', el).forEach((b) => b.addEventListener('click', () => reorder(b.dataset.up, -1)));
      $$('[data-down]', el).forEach((b) => b.addEventListener('click', () => reorder(b.dataset.down, 1)));
      $$('[data-type]', el).forEach((n) => n.addEventListener('change', () => run(() => Store.updateLayoutStatus(portalId, s.layoutId, n.dataset.type, { type: n.value }), 'Status type changed')));
      $$('[data-default]', el).forEach((b) => b.addEventListener('click', () => run(() => Store.updateLayoutStatus(portalId, s.layoutId, b.dataset.default, { isDefault: true }), 'Default status changed')));
      $$('[data-del]', el).forEach((b) => b.addEventListener('click', () => run(() => Store.deleteLayoutStatus(portalId, s.layoutId, b.dataset.del), 'Status deleted')));
      $$('[data-rename]', el).forEach((b) => b.addEventListener('click', () => { s.editing = b.dataset.rename; draw(); const i = $('[data-rename-input]', el); i.focus(); i.select(); }));
      const inp = $('[data-rename-input]', el);
      if (inp) {
        const id = s.editing; let done = false;
        const finish = (save) => { if (done) return; done = true; s.editing = null; if (save && inp.value.trim() !== s.items.find((x) => x.id === id).name) run(() => Store.updateLayoutStatus(portalId, s.layoutId, id, { name: inp.value }), 'Status renamed'); else draw(); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.stopPropagation(); finish(false); } });
        inp.addEventListener('blur', () => finish(true));
      }
      $$('[data-color]', el).forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.color, cur = s.items.find((x) => x.id === id).color;
        const p = openPop(b, `<div class="pop-h">Colour</div><div class="swatches" role="menu">${Store.STATUS_COLORS.map(([k, name, h]) => `<button class="swatch" type="button" role="menuitem" data-pick="${k}" aria-label="${name}" title="${name}" style="background:${h}">${k === cur ? ico('check', 12) : ''}</button>`).join('')}</div>`, { kind: 'menu' });
        p.addEventListener('click', (e) => { const k = e.target.closest('[data-pick]')?.dataset.pick; if (!k) return; closePop(); run(() => Store.updateLayoutStatus(portalId, s.layoutId, id, { color: k }), 'Colour changed'); });
      }));
      $('#ts-add', el)?.addEventListener('submit', (e) => { e.preventDefault(); const f = e.target; s.newName = ''; s.newType = 'OPEN'; run(() => Store.addLayoutStatus(portalId, s.layoutId, { name: f.name.value, type: f.type.value }), 'Status added'); });
      $('#ts-add [name=name]', el)?.addEventListener('input', (e) => { s.newName = e.target.value; });
      $('#ts-add [name=type]', el)?.addEventListener('change', (e) => { s.newType = e.target.value; });
    }
    function reorder(id, dir) {
      const ids = s.items.map((x) => x.id), i = ids.indexOf(id), j = i + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      run(() => Store.orderLayoutStatuses(portalId, s.layoutId, ids));
    }
    (async () => {
      draw();
      try { s.layouts = await Store.layoutsAdmin(portalId, 'TASK'); } catch (err) { s.notice = { text: err.message, kind: 'err' }; draw(); return; }
      s.layoutId = (s.layouts.find((l) => l.id === ctx.query.layout) || s.layouts.find((l) => l.isDefault) || s.layouts[0])?.id;
      draw(); loadStatuses();
    })();
  }
  return { statuses };
})();
