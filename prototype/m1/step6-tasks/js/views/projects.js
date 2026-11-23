/*
 * M1 · Step 4 · Projects (docs/requirements/04-projects.md, MVP stories PRJ-US-01 to 07, plus trash and members).
 * Screens: list, create and edit (full pages), overview (status, members, delete), trash.
 * Reuses the Settings table/panel/dialog look through the `.users-page` wrapper class.
 */
const Projects = (() => {
  const { esc, icon, spinner, field, input, alertBox, initials, component, formatDate, Router } = PY;
  const KEY_RX = /^[A-Z0-9]{2,10}$/;
  const KEY_CHECK_DELAY_MS = 350;
  const ACTION_LABELS = () => Object.fromEntries(Store.auditActions());

  /** One-shot message shown on the next screen (e.g. after create or delete). */
  let flash = null;
  const takeFlash = () => { const f = flash; flash = null; return f; };

  const base = (ctx) => `#/p/${ctx.slug}/projects`;
  const day = (d, ctx) => (d ? formatDate(new Date(d + 'T00:00:00Z'), ctx.portal.dateFormat, 'UTC') : '—');
  const dates = (p, ctx) => (p.startDate || p.endDate ? `${day(p.startDate, ctx)} → ${day(p.endDate, ctx)}` : 'No dates');
  const when = (t, ctx) => formatDate(t, `${ctx.portal.dateFormat}, h:mm a`, ctx.timeZone);
  const options = (items, selected) => items.map(([v, l]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const sync = (el, s, onChange) => el.querySelectorAll('[name]').forEach((n) => n.addEventListener('input', () => { s[n.name] = n.type === 'checkbox' ? n.checked : n.value; if (onChange) onChange(n.name, n); }));

  /* Same status list as the backend's default project statuses; the look is icon + label, never a solid fill. */
  const LOOK = { Active: ['progress', 's-progress'], 'In Progress': ['progress', 's-progress'], 'On Track': ['progress', 's-progress'], Delayed: ['review', 's-review'], 'On Hold': ['open', 'dot'], Completed: ['done', 'check'], Cancelled: ['blocked', 'alert'] };
  const pill = (status) => { const [cls, ic] = LOOK[status] || ['open', 'dot']; return `<span class="py-pill py-pill--${cls}">${icon(ic)}${esc(status)}</span>`; };
  const progress = (p) => `<div class="pbar" title="Progress is closed tasks divided by all tasks"><div class="bar"><i class="d" style="width:${p.progress}%"></i></div><span>${p.progress}%</span></div>`;
  const visChip = (v) => `<span class="chip-vis" title="${v === 'PUBLIC' ? 'Visible to every employee in the portal, read-only' : 'Only members and Admins can see it'}">${icon(v === 'PUBLIC' ? 'globe' : 'user')}${v === 'PUBLIC' ? 'Public' : 'Private'}</span>`;

  /** "Website Redesign" -> WR, "Mobile" -> MOBI (suggested while the key box is untouched). */
  function suggestKey(name) {
    const words = (name.match(/[A-Za-z0-9]+/g) || []);
    const key = (words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 5) : (words[0] || '').slice(0, 4)).toUpperCase();
    return key.length >= 2 ? key : '';
  }

  /* ---------- shared dialogs (mounted into #app, so a route change removes them) ---------- */
  function mountDialog(render, bind, state) {
    const host = document.createElement('div'); host.className = 'pd-overlay';
    document.getElementById('app').appendChild(host);
    const api = component(host, state, (s) => `<section class="pd-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-title">${render(s)}</section>`, (el, a) => {
      el.querySelectorAll('[data-pd-close]').forEach((b) => b.addEventListener('click', close));
      host.onclick = (e) => { if (e.target === host) close(); };
      bind(el, a);
    });
    function close() { host.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    api.close = close;
    return api;
  }

  function confirmDialog({ title, body, label, danger = true, onConfirm }) {
    mountDialog((s) => `<h2 id="pd-title">${esc(title)}</h2><p class="pd-lead">${esc(body)}</p>${s.error ? alertBox(s.error) : ''}
      <div class="pd-actions"><button class="py-btn py-btn--secondary" type="button" data-pd-close>Cancel</button>
      <button class="py-btn ${danger ? 'py-btn--danger' : 'py-btn--primary'}" type="button" id="pd-yes" ${s.busy ? 'disabled' : ''}>${s.busy ? spinner : ''}${esc(label)}</button></div>`,
    (el, api) => el.querySelector('#pd-yes').addEventListener('click', async () => {
      api.set({ busy: true, error: null });
      try { await onConfirm(); api.close(); } catch (err) { api.set({ busy: false, error: err.message }); }
    }), { busy: false, error: null });
  }

  /** Create and edit share one full page: details on the left, a live preview on the right, actions in a bar at the bottom. */
  function formPage(el, ctx, { project = null, people, layouts = [] }) {
    const editing = !!project;
    const s = { name: project?.name ?? '', key: project?.key ?? '', ownerId: project?.owner.id ?? ctx.me.id, startDate: project?.startDate ?? '', endDate: project?.endDate ?? '',
      visibility: project?.visibility ?? 'PRIVATE', description: project?.description ?? '', keyEdited: editing, keyStatus: { kind: 'idle' }, submitted: false, busy: false, error: null,
      layoutId: project?.layoutId ?? (layouts.find((l) => l.isDefault) ?? layouts[0])?.id, cf: editing ? { ...project.hiddenValues, ...project.customValues } : {}, cfErrors: {} };
    const curLayout = () => layouts.find((l) => l.id === s.layoutId) ?? layouts[0];
    const layoutFields = () => curLayout()?.sections.flatMap((x) => x.fields) ?? [];
    /** A new project starts with the defaults of the chosen layout (a layout can override the field's own default). */
    const applyDefaults = () => { if (!editing) for (const d of layoutFields()) if (s.cf[d.apiName] === undefined) s.cf[d.apiName] = d.defaultValue ?? null; };
    applyDefaults();
    let timer = null, seq = 0;
    const keyOk = () => KEY_RX.test(s.key);
    const errs = () => ({
      name: s.submitted && !s.name.trim() ? 'Name the project.' : s.submitted && s.name.length > 100 ? 'Use 100 characters or fewer.' : null,
      key: editing ? null : s.submitted && !keyOk() ? 'Use 2 to 10 capital letters or numbers.' : null,
      end: s.startDate && s.endDate && s.endDate < s.startDate ? "The end date can't be before the start date." : null,
    });
    const keyRegion = () => (s.keyStatus.kind === 'checking' ? '<p class="py-field__hint">Checking…</p>' : s.keyStatus.kind === 'ok' ? `<p class="py-field__ok">${icon('check')}${esc(s.key)} is available</p>`
      : s.keyStatus.kind === 'taken' ? `<p class="py-field__error">${icon('alert')}The key ${esc(s.key)} is already used in this portal.</p>` : '');
    const ownerName = () => people.find((x) => x.userId === s.ownerId)?.fullName ?? '';
    const back = editing ? `${base(ctx)}/${project.id}` : base(ctx);
    const radio = (value, title, text, ic) => `<label class="radio-card"><input type="radio" name="visibility" value="${value}" ${s.visibility === value ? 'checked' : ''}><span class="rc-ic">${icon(ic)}</span><span><strong>${title}</strong><small>${text}</small></span></label>`;

    const render = (s) => {
      const e = errs();
      return `<div class="users-page projects-page form-page">
        <a class="back" href="${back}">${icon('arrow-left')}${editing ? esc(project.name) : 'All projects'}</a>
        <div class="page-title"><div><h1>${editing ? 'Edit project' : 'New project'}</h1>
          <p>${editing ? 'Update the details. The key stays the same, because item IDs like ' + esc(project.key) + '-T42 depend on it.' : 'A project holds the phases, tasks and documents of one piece of work. You become its owner and Manager.'}</p></div></div>
        ${s.error ? alertBox(s.error) : ''}
        <form class="pf" novalidate>
          <div class="pf-grid">
            <div class="pf-main">
              <section class="panel pf-card"><h2>Basics</h2>
                ${field({ label: 'Project name', id: 'pj-name', error: e.name, body: input({ id: 'pj-name', name: 'name', value: s.name, placeholder: 'Website Redesign', error: e.name }) })}
                <div class="pf-row">
                  ${field({ label: 'Key', id: 'pj-key', error: e.key, hint: editing ? "Can't be changed after creation." : '2 to 10 capital letters or numbers. Used in item IDs.',
                    body: `<div class="py-input-wrap key-wrap"><input id="pj-key" name="key" type="text" value="${esc(s.key)}" maxlength="10" autocomplete="off" spellcheck="false" placeholder="WEB" ${editing ? 'disabled' : ''} ${e.key ? 'aria-invalid="true"' : ''} /></div><div id="pj-key-region">${keyRegion()}</div>` })}
                  ${field({ label: 'Owner', id: 'pj-owner', hint: 'The owner is always a Manager of the project.', body: `<select id="pj-owner" name="ownerId" class="py-select">${options(people.map((p) => [p.userId, p.fullName + (p.userId === ctx.me.id ? ' (you)' : '')]), s.ownerId)}</select>` })}
                </div>
                ${field({ label: 'Description', id: 'pj-desc', hint: 'Optional. Shown on the project overview.', body: `<textarea id="pj-desc" name="description" class="py-textarea" rows="5" placeholder="What is this project for?">${esc(s.description)}</textarea>` })}
              </section>
              <section class="panel pf-card"><h2>Schedule</h2><p class="pf-sub">Dates are optional. You can set them later.</p>
                <div class="pf-row">
                  ${field({ label: 'Start date', id: 'pj-start', body: input({ id: 'pj-start', name: 'startDate', type: 'date', value: s.startDate }) })}
                  ${field({ label: 'End date', id: 'pj-end', error: e.end, body: input({ id: 'pj-end', name: 'endDate', type: 'date', value: s.endDate, error: e.end }) })}
                </div>
              </section>
              <section class="panel pf-card"><h2>Who can see it</h2>
                <div class="radio-cards" role="radiogroup" aria-label="Who can see the project">
                  ${radio('PRIVATE', 'Private', 'Only the project members and Admins can see it.', 'user')}
                  ${radio('PUBLIC', 'Public', 'Every employee in the portal can see it, read-only. Clients only if they are members.', 'globe')}
                </div>
              </section>
              ${layouts.length > 1 && !editing ? `<section class="panel pf-card"><h2>Layout</h2>
                ${field({ label: 'Layout', id: 'pj-layout', hint: 'Decides which extra fields and sections this project has. You can change it later in the project settings.',
                  body: `<select id="pj-layout" name="layoutId" class="py-select">${options(layouts.map((l) => [l.id, l.name + (l.isDefault ? ' (default)' : '')]), s.layoutId)}</select>` })}</section>` : ''}
              ${editing ? `<p class="hint">Layout: <b>${esc(curLayout()?.name ?? '')}</b>. <a href="${base(ctx)}/${esc(project.id)}/settings">Change it in project settings</a>.</p>` : ''}
              ${curLayout()?.sections.filter((x) => x.fields.length).map((sec) => `<section class="panel pf-card cf-sec"><h2>${esc(sec.name)}</h2>
                <div class="cf-grid">${sec.fields.map((d) => `<div class="cf-item${(d.wide ?? ['LONG_TEXT', 'MULTI_PICKLIST'].includes(d.type)) ? ' wide' : ''}">${CustomFields.control(d, s.cf[d.apiName], { people, disabled: d.readOnly, error: s.cfErrors[d.apiName] ?? null })}</div>`).join('')}</div></section>`).join('') ?? ''}
            </div>
            <aside class="pf-side"><section class="panel pf-card pf-preview"><h2>Preview</h2>
              <div class="pv-top"><span class="key" data-pv="key"></span><span class="chip-vis" data-pv="vis"></span></div>
              <div class="pv-name" data-pv="name"></div>
              <dl class="pv-facts">
                <div><dt>Owner</dt><dd data-pv="owner"></dd></div>
                <div><dt>Dates</dt><dd data-pv="dates"></dd></div>
                <div><dt>Status</dt><dd>${editing ? esc(project.status) : 'Active (you can change it later)'}</dd></div>
                <div><dt>First item ID</dt><dd class="mono" data-pv="item"></dd></div>
              </dl></section></aside>
          </div>
          <div class="pf-bar"><a class="py-btn py-btn--secondary" href="${back}">Cancel</a>
            <button class="py-btn py-btn--primary" type="submit" ${s.busy ? 'disabled' : ''}>${s.busy ? `${spinner}Saving` : editing ? 'Save changes' : 'Create project'}</button></div>
        </form></div>`;
    };
    const paintPreview = (el) => {
      const set = (k, t) => { const n = el.querySelector(`[data-pv="${k}"]`); if (n) n.textContent = t; };
      set('key', s.key || 'KEY'); set('name', s.name.trim() || 'Untitled project'); set('owner', ownerName());
      set('dates', s.startDate || s.endDate ? `${day(s.startDate, ctx)} → ${day(s.endDate, ctx)}` : 'No dates yet'); set('item', `${s.key || 'KEY'}-T1`);
      const v = el.querySelector('[data-pv="vis"]'); if (v) v.innerHTML = `${icon(s.visibility === 'PUBLIC' ? 'globe' : 'user')}${s.visibility === 'PUBLIC' ? 'Public' : 'Private'}`;
    };
    const api = component(el, s, render, (el, a) => {
      if (s.keyStatus.kind === 'taken') el.querySelector('#pj-key')?.closest('.py-field').classList.add('is-invalid');
      const checkKey = () => {
        clearTimeout(timer);
        s.keyStatus = { kind: keyOk() ? 'checking' : 'idle' };
        el.querySelector('#pj-key-region').innerHTML = keyRegion();
        el.querySelector('#pj-key').closest('.py-field').classList.remove('is-invalid');
        if (!keyOk()) return;
        const mine = ++seq;
        timer = setTimeout(async () => {
          const res = await Store.keyStatus(ctx.portal.id, s.key);
          if (mine !== seq || !document.body.contains(el)) return;
          s.keyStatus = { kind: res.available ? 'ok' : 'taken' };
          el.querySelector('#pj-key-region').innerHTML = keyRegion();
          el.querySelector('#pj-key').closest('.py-field').classList.toggle('is-invalid', !res.available);
        }, KEY_CHECK_DELAY_MS);
      };
      sync(el, s, (name, node) => {
        if (name === 'layoutId') { applyDefaults(); return a.paint(); }
        if (name === 'name' && !editing && !s.keyEdited) { s.key = suggestKey(s.name); el.querySelector('#pj-key').value = s.key; checkKey(); }
        if (name === 'key') { const clean = node.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); node.value = clean; s.key = clean; s.keyEdited = clean.length > 0; checkKey(); }
        paintPreview(el);
      });
      el.querySelectorAll('.cf-sec [data-cf]').forEach((wrap) => {
        const d = layoutFields().find((x) => x.apiName === wrap.dataset.cf);
        const sync = () => { s.cf[d.apiName] = CustomFields.read(d, wrap); };
        wrap.addEventListener('input', sync); wrap.addEventListener('change', sync);
      });
      paintPreview(el);
      if (!editing && s.key) checkKey();
      el.querySelector('form').addEventListener('submit', async (ev) => {
        ev.preventDefault(); s.submitted = true; s.error = null; s.cfErrors = {};
        const e = errs();
        if (!s.name.trim() || e.name || (!editing && (!keyOk() || e.key || s.keyStatus.kind === 'taken')) || e.end) { a.paint(); window.scrollTo(0, 0); return PY.focusFirstInvalid(el); }
        a.set({ busy: true });
        try {
          const f = { name: s.name, key: s.key, ownerId: s.ownerId, startDate: s.startDate, endDate: s.endDate, visibility: s.visibility, description: s.description,
            layoutId: s.layoutId, customValues: Object.fromEntries(layoutFields().map((d) => [d.apiName, s.cf[d.apiName] ?? null])) };
          if (editing) { await Store.updateProject(ctx.portal.id, project.id, f); flash = 'Project updated.'; Router.navigate(`${base(ctx).slice(1)}/${project.id}`); }
          else { const res = await Store.createProject(ctx.portal.id, f); flash = 'Project created. You are its owner and Manager.'; Router.navigate(`${base(ctx).slice(1)}/${res.id}`); }
        } catch (err) {
          if (err.code === 'KEY_TAKEN') { s.keyStatus = { kind: 'taken' }; a.set({ busy: false }); }
          else if (err.fields) { s.cfErrors = err.fields; a.set({ busy: false, error: 'Some custom fields need attention.' }); window.scrollTo(0, 0); }
          else { a.set({ busy: false, error: err.message }); window.scrollTo(0, 0); }
        }
      });
      if (!editing && !s.name) el.querySelector('#pj-name').focus();
    });
    return api;
  }

  /** /projects/new: load the portal's people, then show the form. */
  async function create(el, ctx) {
    el.innerHTML = '<div class="users-page projects-page"><p class="py-caption">Loading…</p></div>';
    try { const [people, layouts] = await Promise.all([Store.projectPeople(ctx.portal.id), Store.layoutsResolved(ctx.portal.id)]); formPage(el, ctx, { people, layouts }); }
    catch (err) { el.innerHTML = `<div class="users-page projects-page">${alertBox(err.message)}</div>`; }
  }

  /** /projects/:id/edit: needs edit rights; otherwise explain and link back. */
  async function edit(el, ctx) {
    el.innerHTML = '<div class="users-page projects-page"><p class="py-caption">Loading…</p></div>';
    const notFound = (title, text) => { el.innerHTML = `<div class="users-page projects-page"><section class="panel"><div class="empty" style="padding:40px 18px"><b>${title}</b><br>${text}<br><br><a class="py-btn py-btn--secondary" href="${base(ctx)}">Back to projects</a></div></section></div>`; };
    try {
      const [project, people, active] = await Promise.all([Store.project(ctx.portal.id, ctx.params.id), Store.projectPeople(ctx.portal.id), Store.layoutsResolved(ctx.portal.id)]);
      const layouts = active.some((l) => l.id === project.layoutId) ? active : [project.layout, ...active]; // a project keeps a layout that was deactivated since
      if (!project.canEdit) return notFound("You can't edit this project", 'Only Admins, the owner and project Managers can edit it.');
      formPage(el, ctx, { project, people, layouts });
    } catch (err) { if (err.code === 'PROJECT_NOT_FOUND') notFound('Project not found', "It doesn't exist, was moved to the trash, or you can't see it."); else el.innerHTML = `<div class="users-page projects-page">${alertBox(err.message)}</div>`; }
  }

  /* ---------- list ---------- */
  function list(el, ctx) {
    const s = { items: null, q: '', status: 'ALL', owner: 'ALL', sort: 'name', error: null, notice: takeFlash() };
    const canCreate = ctx.can('PROJECTS_CREATE');
    const SORTS = { name: (a, b) => a.name.localeCompare(b.name), key: (a, b) => a.key.localeCompare(b.key), end: (a, b) => (a.endDate || '9999').localeCompare(b.endDate || '9999'), status: (a, b) => a.status.localeCompare(b.status) };
    const visible = () => (s.items || []).filter((p) => (s.status === 'ALL' || p.status === s.status) && (s.owner === 'ALL' || p.owner.id === s.owner)
      && (!s.q.trim() || `${p.name} ${p.key}`.toLowerCase().includes(s.q.trim().toLowerCase()))).sort(SORTS[s.sort]);
    const render = (s) => {
      const rows = visible().map((p) => `<tr class="click" data-open="${esc(p.id)}" tabindex="0" role="link" aria-label="Open ${esc(p.name)}">
        <td><div class="proj"><span class="key">${esc(p.key)}</span><div><strong>${esc(p.name)}</strong>${p.description ? `<small>${esc(p.description)}</small>` : ''}</div></div></td>
        <td>${pill(p.status)}</td>
        <td><div class="person"><span class="py-avatar py-avatar--sm">${esc(initials(p.owner.name))}</span><div><strong>${esc(p.owner.name)}</strong></div></div></td>
        <td>${progress(p)}</td><td class="nowrap">${esc(dates(p, ctx))}</td><td class="chev">${icon('chevron-right')}</td></tr>`).join('');
      const filtering = s.q || s.status !== 'ALL' || s.owner !== 'ALL';
      const empty = !s.items ? 'Loading projects…' : filtering ? 'No projects match.' : canCreate ? 'No projects yet. Create the first one.' : 'You are not in any project yet.';
      const owners = [...new Map((s.items || []).map((p) => [p.owner.id, p.owner.name])).entries()];
      return `<div class="users-page projects-page">
        <div class="page-title"><div><h1>Projects</h1><p>${s.items ? `${s.items.length} you can see in ${esc(ctx.portal.name)}` : ' '}</p></div>
          <div class="page-actions"><a class="py-btn py-btn--ghost" href="${base(ctx)}/trash">${icon('inbox')}Trash</a>
          ${canCreate ? `<a class="py-btn py-btn--primary" href="${base(ctx)}/new">${icon('plus')}New project</a>` : ''}</div></div>
        ${s.error ? alertBox(s.error) : ''}${s.notice ? `<div class="py-alert py-alert--ok" role="status">${icon('check')}<span>${esc(s.notice)}</span></div>` : ''}
        <section class="panel">
          <div class="filters">
            <label class="py-input-wrap search">${icon('search')}<input id="p-search" name="q" placeholder="Search by name or key" aria-label="Search projects" value="${esc(s.q)}" /></label>
            <select class="py-select" name="status" aria-label="Filter by status">${options([['ALL', 'All statuses'], ...Store.PROJECT_STATUSES.map((x) => [x.name, x.name])], s.status)}</select>
            <select class="py-select" name="owner" aria-label="Filter by owner">${options([['ALL', 'All owners'], ...owners], s.owner)}</select>
            <select class="py-select" name="sort" aria-label="Sort by">${options([['name', 'Sort: name'], ['key', 'Sort: key'], ['end', 'Sort: end date'], ['status', 'Sort: status']], s.sort)}</select>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>Project</th><th>Status</th><th>Owner</th><th>Progress</th><th>Dates</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6" class="empty">${empty}</td></tr>`}</tbody></table></div>
        </section></div>`;
    };
    let api;
    const repaint = () => { const had = document.activeElement?.id === 'p-search', pos = document.activeElement?.selectionStart; api.paint(); if (had) { const n = el.querySelector('#p-search'); n.focus(); n.setSelectionRange(pos, pos); } };
    const load = async () => { try { s.items = await Store.projects(ctx.portal.id); } catch (err) { s.items = s.items || []; s.error = err.message; } repaint(); };
    api = component(el, s, render, (el) => {
      sync(el, s, () => repaint());
      const open = (id) => Router.navigate(`${base(ctx).slice(1)}/${id}`);
      el.querySelectorAll('[data-open]').forEach((r) => { r.addEventListener('click', () => open(r.dataset.open)); r.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(r.dataset.open); }); });

    });
    load();
  }

  /* ---------- overview ---------- */
  /** Overview | Tasks tab strip shared by the project pages. */
  const tabs = (ctx, id, active, count = null) => `<nav class="ptabs" aria-label="Project sections"><a href="${base(ctx)}/${esc(id)}" ${active === 'overview' ? 'class="active" aria-current="page"' : ''}>Overview</a>
    ${ctx.can('TASKS_VIEW') ? `<a href="${base(ctx)}/${esc(id)}/tasks" id="tab-tasks" ${active === 'tasks' ? 'class="active" aria-current="page"' : ''}>Tasks${count == null ? '' : `<span class="tab-count">${count}</span>`}</a>` : ''}</nav>`;

  function overview(el, ctx) {
    const id = ctx.params.id;
    const s = { p: null, people: [], uiCore: { pop: null, q: '', cal: null, editing: null, error: null, flash: null, off: null }, ui: { pop: null, q: '', cal: null, editing: null, error: null, flash: null, off: null }, error: null, notice: takeFlash(), busy: false, addUser: '', addRole: 'Member', missing: false };
    /** The properties every project has, as pickers for the "About this project" card; a property's name is its key in an update. */
    const coreFields = () => [
      { apiName: 'name', label: 'Name', type: 'TEXT', mandatory: true, readOnly: false, config: { maxLength: 100 }, options: [] },
      { apiName: 'ownerId', label: 'Owner', type: 'USER', mandatory: true, readOnly: false, config: {}, options: [] },
      { apiName: 'startDate', label: 'Start date', type: 'DATE', mandatory: false, readOnly: false, config: {}, options: [] },
      { apiName: 'endDate', label: 'End date', type: 'DATE', mandatory: false, readOnly: false, config: {}, options: [] },
      { apiName: 'visibility', label: 'Who can see it', type: 'PICKLIST', mandatory: true, readOnly: false, config: {}, options: [{ id: 'PRIVATE', label: 'Private: only members and Admins', active: true }, { id: 'PUBLIC', label: 'Public: every employee, read-only', active: true }] },
      { apiName: 'description', label: 'Description', type: 'LONG_TEXT', mandatory: false, readOnly: false, wide: true, config: { maxLength: 5000 }, options: [] },
    ];
    const coreValues = (p) => ({ name: p.name, ownerId: p.owner.id, startDate: p.startDate, endDate: p.endDate, visibility: p.visibility, description: p.description });
    /** Only sections that have a visible field; collapsed state is remembered per person, per layout and section. */
    const sections = (p) => p.layout.sections.filter((x) => x.fields.length);
    const COLLAPSE_KEY = 'py-cf-collapsed';
    const stored = () => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; } catch (e) { return {}; } };
    const collapsed = (p, sec) => !!stored()[`${p.layout.id}:${sec.id}`];
    const toggleCollapsed = (p, sec) => { try { const m = stored(); m[`${p.layout.id}:${sec.id}`] = !m[`${p.layout.id}:${sec.id}`]; localStorage.setItem(COLLAPSE_KEY, JSON.stringify(m)); } catch (e) { /* not remembered */ } };
    const render = (s) => {
      if (s.missing) return `<div class="users-page projects-page"><section class="panel"><div class="empty" style="padding:40px 18px"><b>Project not found</b><br>It doesn't exist, was moved to the trash, or you can't see it.<br><br><a class="py-btn py-btn--secondary" href="${base(ctx)}">Back to projects</a></div></section></div>`;
      const p = s.p;
      if (!p) return `<div class="users-page projects-page"><p class="py-caption">Loading project…</p></div>`;
      const free = s.people.filter((x) => !p.members.some((m) => m.userId === x.userId));
      const labels = ACTION_LABELS();
      return `<div class="users-page projects-page">
        <a class="back" href="${base(ctx)}">${icon('arrow-left')}All projects</a>
        ${s.error ? alertBox(s.error) : ''}${s.notice ? `<div class="py-alert py-alert--ok" role="status">${icon('check')}<span>${esc(s.notice)}</span></div>` : ''}
        <div class="page-title"><div><div class="ov-key"><span class="key">${esc(p.key)}</span>${visChip(p.visibility)}${p.canEdit ? `<a class="chip-vis layout-link" href="${base(ctx)}/${esc(p.id)}/settings" title="Change the layout in project settings">${icon('layers')}${esc(p.layout.name)}</a>` : `<span class="chip-vis" title="The layout decides which extra fields this project has">${icon('layers')}${esc(p.layout.name)}</span>`}</div><h1>${esc(p.name)}</h1>
          <p>Owned by ${esc(p.owner.name)} · ${esc(dates(p, ctx))}</p></div>
          <div class="page-actions">
            ${p.canEdit ? `<select class="py-select status-select" id="status" aria-label="Project status">${options(Store.PROJECT_STATUSES.map((x) => [x.name, x.name]), p.status)}</select>` : pill(p.status)}
            ${p.canEdit ? `<a class="py-btn py-btn--secondary" id="edit" href="${base(ctx)}/${esc(p.id)}/edit">Edit</a><a class="py-btn py-btn--secondary" id="proj-settings" href="${base(ctx)}/${esc(p.id)}/settings">Settings</a>` : ''}
            ${p.canDelete ? `<button class="py-btn py-btn--ghost danger" type="button" id="del">${icon('log-out')}Delete</button>` : ''}</div></div>
        ${tabs(ctx, p.id, 'overview', p.taskCounts.total)}
        ${!p.canEdit ? `<div class="py-alert" role="status">${icon('alert')}<span>${p.isMember ? 'Your project role is Member, so this project is read-only for you.' : 'You can see this project, but you are not a member, so it is read-only.'}</span></div>` : ''}
        <div class="stats">${[['Progress', `${p.progress}%`, 'Closed tasks ÷ all tasks'], ['Open tasks', p.taskCounts.open, 'Not in a Closed status'], ['Closed tasks', p.taskCounts.closed, 'In a Closed status'], ['Overdue', p.taskCounts.overdue, 'Open and past the due date']].map(([l, v, f]) => `<div class="stat"><div class="stat-label">${l}</div><div class="stat-value">${v}</div><div class="stat-foot">${f}</div></div>`).join('')}</div>
        <div class="ov-grid">
          <div class="stack">
            <section class="panel cf-card"><div class="panel-head"><div><h2>About this project</h2></div></div>
              <div class="cf-props" id="cf-core">${CustomFields.propsHtml(coreFields(p), coreValues(p), s.uiCore, ctx, s.people, p.canEdit)}</div></section>
            ${sections(p).length ? `<div id="cf-sections" class="cf-sections">${p.canEdit ? '<p class="hint cf-top">Click a value to change it. Changes save as you go.</p>' : '<p class="hint cf-top">Read-only for you: only Admins, the owner and project Managers can change these.</p>'}
              ${sections(p).map((sec) => { const shut = sec.collapsible && collapsed(p, sec);
                return `<section class="panel cf-card"><div class="panel-head"><div><h2>${sec.collapsible ? `<button class="sec-toggle" type="button" data-collapse="${esc(sec.id)}" aria-expanded="${!shut}"><span aria-hidden="true">${shut ? '▸' : '▾'}</span> ${esc(sec.name)}</button>` : esc(sec.name)}</h2></div></div>
                ${shut ? '' : `<div class="cf-props">${CustomFields.propsHtml(sec.fields, p.customValues, s.ui, ctx, s.people, p.canEdit)}</div>`}</section>`; }).join('')}</div>` : ''}
            <section class="panel"><div class="panel-head"><div><h2>Upcoming phases</h2><p>Milestones and their dates</p></div></div><div class="empty line">Phases arrive with the next step.</div></section>
            <section class="panel"><div class="panel-head"><div><h2>Recent activity</h2><p>Changes to this project</p></div></div>
              ${p.activity.length ? `<ul class="act">${p.activity.map((a) => `<li><span class="py-avatar py-avatar--sm">${esc(initials(a.actorName))}</span><div><strong>${esc(a.actorName)}</strong> <span class="muted">${esc(labels[a.action] ?? a.action)}</span><br><small>${esc(a.detail ?? '')} · ${esc(when(a.occurredAt, ctx))}</small></div></li>`).join('')}</ul>` : '<div class="empty line">No activity yet.</div>'}</section>
          </div>
          <div class="stack">
            <section class="panel"><div class="panel-head"><div><h2>Members</h2><p>${p.members.length} in this project</p></div></div>
              <ul class="members">${p.members.map((m) => `<li><span class="py-avatar">${esc(initials(m.fullName))}</span><div class="mi"><strong>${esc(m.fullName)}${m.userId === ctx.me.id ? '<span class="you"> (you)</span>' : ''}</strong><small>${esc(m.email)}</small></div>
                <span class="chip">${m.owner ? 'Owner · ' : ''}${esc(m.role)}</span>${p.canEdit && !m.owner ? `<button class="icon-x" type="button" data-remove="${esc(m.userId)}" aria-label="Remove ${esc(m.fullName)} from the project" title="Remove">✕</button>` : ''}</li>`).join('')}</ul>
              ${p.canEdit ? `<form class="add-member" novalidate>${free.length ? `<select class="py-select" name="addUser" aria-label="Person to add"><option value="">Add a person…</option>${options(free.map((x) => [x.userId, `${x.fullName} · ${x.profileName}`]), s.addUser)}</select>
                <select class="py-select role" name="addRole" aria-label="Project role">${options([['Member', 'Member'], ['Manager', 'Manager']], s.addRole)}</select>
                <button class="py-btn py-btn--secondary" type="submit" ${!s.addUser || s.busy ? 'disabled' : ''}>Add</button>` : '<p class="muted">Everyone in the portal is already in this project.</p>'}</form>
                <p class="hint">Only people already in the portal can join. Invite new people in Settings → Users.</p>` : ''}</section>
          </div>
        </div></div>`;
    };
    let api;
    const load = async () => {
      try { const [p, people] = await Promise.all([Store.project(ctx.portal.id, id), Store.projectPeople(ctx.portal.id)]); s.p = p; s.people = people; }
      catch (err) { if (err.code === 'PROJECT_NOT_FOUND') s.missing = true; else s.error = err.message; }
      api.paint();
    };
    const act = async (fn, notice) => { s.error = null; s.notice = null; s.busy = true; api.paint(); try { await fn(); if (notice) s.notice = notice; } catch (err) { s.error = err.message; } s.busy = false; s.addUser = ''; await load(); };
    api = component(el, s, render, (el) => {
      sync(el, s, (name) => { if (name === 'addUser') { el.querySelector('.add-member button').disabled = !s.addUser; } });
      el.querySelectorAll('[data-collapse]').forEach((b) => b.addEventListener('click', () => { toggleCollapsed(s.p, s.p.layout.sections.find((x) => x.id === b.dataset.collapse)); api.paint(); }));
      if (s.p?.canEdit) {
        /* each property saves on its own: the update carries only that property */
        const applyCore = (k, v) => { if (k === 'ownerId') s.p.owner = { id: v, name: s.people.find((x) => x.userId === v)?.fullName ?? s.p.owner.name }; else s.p[k] = v ?? (k === 'description' ? '' : null); };
        CustomFields.bindProps(el.querySelector('#cf-core'), { fields: coreFields(), values: coreValues(s.p), ui: s.uiCore, people: s.people, repaint: () => api.paint(),
          save: async (k, v, optimistic) => {
            const prev = k === 'ownerId' ? s.p.owner.id : s.p[k];
            if (optimistic) { applyCore(k, v); api.paint(); }
            try { await Store.updateProject(ctx.portal.id, id, { [k]: v }); if (!optimistic) applyCore(k, v); }
            catch (err) { if (optimistic) applyCore(k, prev); throw err; }
            Store.project(ctx.portal.id, id).then((fresh) => { if (document.body.contains(el)) { s.p = fresh; api.paint(); } }).catch(() => {});
          } });
      }
      if (s.p?.canEdit && sections(s.p).length) {
        const apply = (k, v) => { const next = { ...s.p.customValues }; if (v == null || v === '' || (Array.isArray(v) && !v.length)) delete next[k]; else next[k] = v; s.p.customValues = next; };
        CustomFields.bindProps(el.querySelector('#cf-sections'), { fields: sections(s.p).flatMap((x) => x.fields), values: s.p.customValues || {}, ui: s.ui, people: s.people, repaint: () => api.paint(),
          save: async (k, v, optimistic) => {
            const prev = s.p.customValues?.[k];
            if (optimistic) { apply(k, v); api.paint(); } // pick, tick and date answers show at once
            try { await Store.setProjectCustomValue(ctx.portal.id, id, k, v); if (!optimistic) apply(k, v); }
            catch (err) { if (optimistic) apply(k, prev); throw err; }
            Store.project(ctx.portal.id, id).then((fresh) => { if (document.body.contains(el)) { s.p.activity = fresh.activity; s.p.customValues = fresh.customValues; s.p.layout = fresh.layout; api.paint(); } }).catch(() => {});
          } });
      }
      el.querySelector('#status')?.addEventListener('change', (e) => act(() => Store.setProjectStatus(ctx.portal.id, id, e.target.value), `Status changed to ${e.target.value}.`));
      el.querySelector('#del')?.addEventListener('click', () => confirmDialog({ title: `Delete ${s.p.name}?`, label: 'Move to trash',
        body: 'It moves to the trash with everything in it. You or an Admin can restore it from Projects → Trash.',
        onConfirm: async () => { await Store.deleteProject(ctx.portal.id, id); flash = `${s.p.name} moved to the trash.`; Router.navigate(base(ctx).slice(1)); } }));
      el.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => act(() => Store.removeProjectMember(ctx.portal.id, id, b.dataset.remove), 'Member removed.')));
      el.querySelector('.add-member')?.addEventListener('submit', (e) => { e.preventDefault(); if (s.addUser) act(() => Store.addProjectMember(ctx.portal.id, id, { userId: s.addUser, role: s.addRole }), 'Member added.'); });
    });
    load();
  }

  /* ---------- trash ---------- */
  function trash(el, ctx) {
    const s = { items: null, error: null, notice: null, busy: null };
    const render = (s) => `<div class="users-page projects-page">
      <a class="back" href="${base(ctx)}">${icon('arrow-left')}All projects</a>
      <div class="page-title"><div><h1>Trash</h1><p>Deleted projects you own or, as an Admin, in this portal. Restoring brings back everything in them.</p></div></div>
      ${s.error ? alertBox(s.error) : ''}${s.notice ? `<div class="py-alert py-alert--ok" role="status">${icon('check')}<span>${esc(s.notice)}</span></div>` : ''}
      <section class="panel"><div class="table-wrap"><table>
        <thead><tr><th>Project</th><th>Deleted by</th><th>Deleted</th><th></th></tr></thead>
        <tbody>${!s.items ? '<tr><td colspan="4" class="empty">Loading…</td></tr>' : s.items.length ? s.items.map((p) => `<tr>
          <td><div class="proj"><span class="key">${esc(p.key)}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.status)}</small></div></div></td>
          <td>${esc(p.deletedBy)}</td><td class="nowrap">${esc(when(p.deletedAt, ctx))}</td>
          <td class="actions"><button class="py-btn py-btn--secondary" type="button" data-restore="${esc(p.id)}" ${s.busy === p.id ? 'disabled' : ''}>Restore</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty">The trash is empty.</td></tr>'}</tbody></table></div></section></div>`;
    let api;
    const load = async () => { try { s.items = await Store.trashedProjects(ctx.portal.id); } catch (err) { s.items = s.items || []; s.error = err.message; } api.paint(); };
    api = component(el, s, render, (el) => el.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
      const p = s.items.find((x) => x.id === b.dataset.restore); s.busy = p.id; s.error = null; api.paint();
      try { await Store.restoreProject(ctx.portal.id, p.id); s.notice = `${p.name} restored.`; } catch (err) { s.error = err.message; }
      s.busy = null; load();
    })));
    load();
  }

  /* ---------- project settings: the layout this project uses ---------- */
  async function settings(el, ctx) {
    const id = ctx.params.id, portalId = ctx.portal.id;
    el.innerHTML = '<div class="users-page projects-page"><p class="py-caption">Loading…</p></div>';
    let p, layouts, fields, tlayouts = [], counts = [];
    try { [p, layouts, fields] = await Promise.all([Store.project(portalId, id), Store.layoutsResolved(portalId), Store.customFields(portalId)]); if (ctx.can('TASKS_VIEW')) [tlayouts, counts] = await Promise.all([Store.layoutsResolved(portalId, 'TASK'), Store.taskStatusCounts(portalId, id)]); }
    catch (err) { el.innerHTML = `<div class="users-page projects-page"><section class="panel"><div class="empty" style="padding:40px 18px"><b>Project not found</b><br>It doesn't exist, was moved to the trash, or you can't see it.<br><br><a class="py-btn py-btn--secondary" href="${base(ctx)}">Back to projects</a></div></section></div>`; return; }
    const all = () => (layouts.some((l) => l.id === p.layoutId) ? layouts : [p.layout, ...layouts]);
    const label = Object.fromEntries(fields.map((f) => [f.apiName, f.label]));
    const s = { tab: 'layout', sel: p.layoutId, tsel: p.taskLayoutId, busy: false, error: null, notice: null };
    
    const fieldsOf = (l) => l.sections.flatMap((x) => x.fields);
    /** What switching does: answers that stop showing (kept), and required fields of the new layout that have no answer yet. */
    const impact = (l) => {
      const answered = new Set([...Object.keys(p.customValues || {}), ...Object.keys(p.hiddenValues || {})]), inNew = new Set(fieldsOf(l).map((f) => f.apiName));
      return { hidden: [...answered].filter((k) => !inNew.has(k) && label[k]).map((k) => label[k]), needs: fieldsOf(l).filter((f) => f.mandatory && !f.readOnly && !answered.has(f.apiName)).map((f) => f.label) };
    };
    const byName = (l, name) => l.statuses.find((x) => x.name.toLowerCase() === name.toLowerCase());
    /** Where tasks land when the task layout changes: same-named statuses stay, the rest go to the new default Open (Closed ones to the first Closed). */
    const taskImpact = (l) => counts.filter((c) => c.count).map((c) => ({ name: c.name, count: c.count, to: (byName(l, c.name) || (c.type === 'CLOSED' ? l.statuses.find((x) => x.type === 'CLOSED') : l.statuses.find((x) => x.isDefault))).name, same: !!byName(l, c.name) }));
    const taskSection = (s) => {
      const pick = tlayouts.find((l) => l.id === s.tsel) || tlayouts[0], changed = s.tsel !== p.taskLayoutId, im = changed ? taskImpact(pick) : [];
      return `<section class="panel pf-card" id="task-layout-card"><h2>Task layout</h2>
        <p class="pf-sub">The task layout decides which statuses tasks in this project can have, and which extra fields they show. Admins create and edit task layouts in Settings → Tasks.</p>
        <div class="ps-layouts" role="radiogroup" aria-label="Task layout">${tlayouts.map((l) => `<label class="radio-card"><input type="radio" name="tlayout" value="${esc(l.id)}" ${l.id === s.tsel ? 'checked' : ''} ${p.canEdit ? '' : 'disabled'}>
          <span><strong>${esc(l.name)}${l.id === p.taskLayoutId ? '<span class="ps-tag cur">Current</span>' : ''}${l.isDefault ? '<span class="ps-tag">Default</span>' : ''}</strong>
          <small>${esc(l.description || 'No description')} · statuses: ${l.statuses.map((x) => esc(x.name)).join(', ')}</small></span></label>`).join('')}</div>
        ${changed ? `<div class="ps-impact" aria-live="polite">${im.filter((x) => !x.same).length ? `<p><b>Moves to another status:</b> ${im.filter((x) => !x.same).map((x) => `${x.count} task${x.count === 1 ? '' : 's'} in ${esc(x.name)} → ${esc(x.to)}`).join('; ')}.</p>` : '<p>Every task keeps its status.</p>'}
          <p>Answers for fields the new layout doesn't show are kept, but hidden.</p></div>` : ''}
        ${p.canEdit ? `<div class="ps-actions"><button class="py-btn py-btn--primary" type="button" id="apply-task" ${!changed || s.busy ? 'disabled' : ''}>${s.busy ? spinner : ''}Apply task layout</button>${changed ? '<button class="py-btn py-btn--ghost" type="button" id="reset-task">Cancel</button>' : ''}</div>` : ''}</section>`;
    };
    const render = (s) => {
      const cur = all().find((l) => l.id === p.layoutId), pick = all().find((l) => l.id === s.sel), im = impact(pick), changed = s.sel !== p.layoutId;
      return `<div class="users-page projects-page">
        <a class="back" href="${base(ctx)}/${esc(p.id)}">${icon('arrow-left')}${esc(p.name)}</a>
        <div class="page-title"><div><h1>Project settings</h1><p><span class="mono">${esc(p.key)}</span> · ${esc(p.name)}</p></div></div>
        ${s.error ? alertBox(s.error) : ''}${s.notice ? `<div class="py-alert py-alert--ok" role="status">${icon('check')}<span>${esc(s.notice)}</span></div>` : ''}
        ${!p.canEdit ? `<div class="py-alert" role="status">${icon('alert')}<span>Only Admins, the owner and project Managers can change these settings.</span></div>` : ''}
        <div class="ps-grid">
          <nav class="ps-nav" aria-label="Project settings"><button type="button" data-tab="layout" class="${s.tab === 'layout' ? 'active' : ''}" ${s.tab === 'layout' ? 'aria-current="page"' : ''}>Layout</button>
            ${ctx.can('TASKS_VIEW') ? `<button type="button" id="ps-task-layout" data-tab="tasks" class="${s.tab === 'tasks' ? 'active' : ''}" ${s.tab === 'tasks' ? 'aria-current="page"' : ''}>Task layout</button>` : ''}
            <button type="button" disabled>Modules <span class="soon">Soon</span></button><button type="button" disabled>Statuses <span class="soon">Soon</span></button><button type="button" disabled>Notifications <span class="soon">Soon</span></button></nav>
          ${s.tab === 'tasks' ? taskSection(s) : ''}<section class="panel pf-card" ${s.tab === 'tasks' ? 'hidden' : ''}><h2>Layout</h2>
            <p class="pf-sub">The layout decides which extra fields this project shows, and how they are grouped. Admins create and edit layouts in Settings → Projects → Layouts.</p>
            <div class="ps-layouts" role="radiogroup" aria-label="Layout">${all().map((l) => `<label class="radio-card"><input type="radio" name="layout" value="${esc(l.id)}" ${l.id === s.sel ? 'checked' : ''} ${p.canEdit ? '' : 'disabled'}>
              <span><strong>${esc(l.name)}${l.id === p.layoutId ? '<span class="ps-tag cur">Current</span>' : ''}${l.isDefault ? '<span class="ps-tag">Default</span>' : ''}${l.active ? '' : '<span class="ps-tag">Inactive</span>'}</strong>
              <small>${esc(l.description || 'No description')} · ${l.sections.length} section${l.sections.length === 1 ? '' : 's'} · ${fieldsOf(l).length} field${fieldsOf(l).length === 1 ? '' : 's'}</small></span></label>`).join('')}</div>
            <div><h3 class="ps-h">${esc(pick.name)} shows</h3><div class="ps-secs">${pick.sections.filter((x) => x.fields.length).map((x) => `<div><b>${esc(x.name)}</b><span>${x.fields.map((f) => esc(f.label)).join(', ')}</span></div>`).join('') || '<span>No fields yet.</span>'}</div></div>
            ${changed ? `<div class="ps-impact" aria-live="polite">${im.hidden.length ? `<p><b>Kept, but hidden:</b> the answers for ${esc(im.hidden.join(', '))}. They come back if the project moves to a layout that has those fields.</p>` : ''}
              ${im.needs.length ? `<p><b>Required here and still empty:</b> ${esc(im.needs.join(', '))}. You will be asked for them the next time the project is edited.</p>` : ''}
              ${!im.hidden.length && !im.needs.length ? `<p>Nothing is hidden and nothing new is required.</p>` : ''}</div>` : ''}
            ${p.canEdit ? `<div class="ps-actions"><button class="py-btn py-btn--primary" type="button" id="apply" ${!changed || s.busy ? 'disabled' : ''}>${s.busy ? spinner : ''}Apply layout</button>${changed ? '<button class="py-btn py-btn--ghost" type="button" id="reset">Cancel</button>' : ''}</div>` : ''}
          </section></div></div>`;
    };
    const api = component(el, s, render, (el) => {
      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { s.tab = b.dataset.tab; s.notice = null; s.error = null; api.paint(); }));
      el.querySelectorAll('[name=tlayout]').forEach((r) => r.addEventListener('change', () => { s.tsel = r.value; s.notice = null; api.paint(); el.querySelector('[name=tlayout]:checked')?.focus(); }));
      el.querySelector('#reset-task')?.addEventListener('click', () => { s.tsel = p.taskLayoutId; api.paint(); });
      el.querySelector('#apply-task')?.addEventListener('click', async () => {
        const l = tlayouts.find((x) => x.id === s.tsel); s.busy = true; s.error = null; api.paint();
        try { const r = await Store.setProjectTaskLayout(portalId, id, s.tsel); const [fresh, c2] = await Promise.all([Store.project(portalId, id), Store.taskStatusCounts(portalId, id)]); Object.assign(p, fresh); counts = c2; s.tsel = p.taskLayoutId; s.notice = `${l.name} is now the task layout of ${p.name}.${r.moved ? ` ${r.moved} task${r.moved === 1 ? ' was' : 's were'} moved to another status.` : ''}`; }
        catch (err) { s.error = err.message; }
        s.busy = false; api.paint();
      });
      el.querySelectorAll('[name=layout]').forEach((r) => r.addEventListener('change', () => { s.sel = r.value; s.notice = null; api.paint(); el.querySelector('[name=layout]:checked')?.focus(); }));
      el.querySelector('#reset')?.addEventListener('click', () => { s.sel = p.layoutId; api.paint(); });
      el.querySelector('#apply')?.addEventListener('click', async () => {
        const l = all().find((x) => x.id === s.sel); s.busy = true; s.error = null; api.paint();
        try { await Store.setProjectLayout(portalId, id, s.sel); const fresh = await Store.project(portalId, id); Object.assign(p, fresh); s.sel = p.layoutId; s.notice = `${l.name} applied to ${p.name}.`; }
        catch (err) { s.error = err.message; }
        s.busy = false; api.paint();
      });
    });
  }

  return { list, overview, trash, create, edit, settings, tabs };
})();
